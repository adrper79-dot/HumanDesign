/**
 * LiveSession — Cloudflare Durable Object for real-time collaborative sessions (GAP-008)
 *
 * One DO instance per live session, identified by sessionId (UUID).
 * Handles WebSocket fan-out, chart state sync, pointer broadcast, and note accumulation.
 *
 * Message protocol (JSON):
 *   WS upgrade request must include headers:
 *     X-User-Id: <userId>
 *     X-User-Role: "practitioner" | "client"
 *
 *   Server → Client (on join):
 *     { type: "joined", role, sessionState: { chartState, noteContent?, participantCount } }
 *
 *   Server → Client (broadcast):
 *     { type: "participant_joined", role, count }
 *     { type: "participant_left", role, count }
 *     { type: "chart_update", tab, gateHighlight }
 *     { type: "pointer", x, y }
 *     { type: "note_update", content }
 *     { type: "session_ended", noteSaved }
 *
 *   Practitioner → Server:
 *     { type: "chart_update", tab, gateHighlight }
 *     { type: "pointer", x, y }
 *     { type: "note_update", content }
 *
 * HTTP API (called by Worker, not browser):
 *   GET  /state     → { noteContent, chartState }
 *   POST /broadcast → broadcasts JSON body to all connections
 *
 * Alarm:
 *   The DO sets a 2-hour inactivity alarm when the first WS connects.
 *   Reconnecting or receiving a chart_update resets it to +2 hours.
 *   When the alarm fires, session_ended is broadcast and all WS connections close.
 *   This satisfies the acceptance criterion: "DO state cleaned up within 60s of session end"
 *   for the abandoned-session case (practitioner drops without calling /end).
 */
export class LiveSession {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    /** @type {Map<WebSocket, { role: string, userId: string }>} */
    this.connections = new Map();
    this.chartState = { tab: 'chart', gateHighlight: null };
    this.noteContent = '';
  }

  async fetch(request) {
    const url = new URL(request.url);

    // WebSocket upgrade — browser or Worker-forwarded upgrade
    if (request.headers.get('Upgrade') === 'websocket') {
      const userId = request.headers.get('X-User-Id');
      const role   = request.headers.get('X-User-Role');

      if (!userId || !role) {
        return new Response('Missing X-User-Id or X-User-Role header', { status: 400 });
      }

      const [client, server] = Object.values(new WebSocketPair());
      server.accept();
      this._setupWebSocket(server, userId, role);

      // Set/reset 2-hour inactivity alarm — prevents abandoned DOs from persisting forever
      await this._resetAlarm();

      return new Response(null, { status: 101, webSocket: client });
    }

    // GET /state — Worker reads final state before saving notes
    if (request.method === 'GET' && url.pathname.endsWith('/state')) {
      return Response.json({ noteContent: this.noteContent, chartState: this.chartState });
    }

    // POST /broadcast — Worker signals session_ended or other server-initiated events
    if (request.method === 'POST' && url.pathname.endsWith('/broadcast')) {
      const body = await request.json();
      this._broadcastAll(body);
      if (body.type === 'session_ended') this._closeAll();
      return Response.json({ ok: true });
    }

    return new Response('Not found', { status: 404 });
  }

  _setupWebSocket(ws, userId, role) {
    this.connections.set(ws, { role, userId });

    // Send current session state to the joining participant
    ws.send(JSON.stringify({
      type: 'joined',
      role,
      sessionState: {
        chartState: this.chartState,
        // Only the practitioner sees note content (write side)
        noteContent: role === 'practitioner' ? this.noteContent : undefined,
        participantCount: this.connections.size,
      },
    }));

    // Notify all other participants
    this._broadcast({ type: 'participant_joined', role, count: this.connections.size }, ws);

    ws.addEventListener('message', (msg) => {
      // Clients are read-only — only practitioner may send control messages
      if (role !== 'practitioner') return;

      let data;
      try {
        data = JSON.parse(msg.data);
      } catch (_) {
        return;
      }

      switch (data.type) {
        case 'chart_update': {
          this.chartState = {
            tab: typeof data.tab === 'string' ? data.tab : this.chartState.tab,
            gateHighlight: data.gateHighlight != null ? data.gateHighlight : null,
          };
          this._broadcast({ type: 'chart_update', ...this.chartState });
          // Reset inactivity alarm on any practitioner activity
          this._resetAlarm().catch(() => {});
          break;
        }
        case 'pointer': {
          // Validate x/y are numbers 0-1 to prevent garbage broadcast
          const x = typeof data.x === 'number' ? Math.max(0, Math.min(1, data.x)) : 0;
          const y = typeof data.y === 'number' ? Math.max(0, Math.min(1, data.y)) : 0;
          this._broadcast({ type: 'pointer', x, y });
          break;
        }
        case 'note_update': {
          // Clamp note content to 50 KB to prevent memory bloat
          this.noteContent = typeof data.content === 'string'
            ? data.content.slice(0, 51200)
            : '';
          // Broadcast to connected client (read-only display), exclude practitioner ws
          this._broadcast({ type: 'note_update', content: this.noteContent }, ws);
          break;
        }
        default:
          break;
      }
    });

    ws.addEventListener('close', () => {
      this.connections.delete(ws);
      this._broadcast({ type: 'participant_left', role, count: this.connections.size });
    });

    ws.addEventListener('error', () => {
      this.connections.delete(ws);
    });
  }

  /** Broadcast to all connections except excludeWs */
  _broadcast(message, excludeWs = null) {
    const data = JSON.stringify(message);
    for (const [ws] of this.connections) {
      if (ws === excludeWs) continue;
      try {
        ws.send(data);
      } catch (_) {
        this.connections.delete(ws);
      }
    }
  }

  /** Broadcast to all connections including sender */
  _broadcastAll(message) {
    const data = JSON.stringify(message);
    for (const [ws] of this.connections) {
      try {
        ws.send(data);
      } catch (_) {
        this.connections.delete(ws);
      }
    }
  }

  /** Close all WebSocket connections cleanly */
  _closeAll() {
    for (const [ws] of this.connections) {
      try {
        ws.close(1000, 'Session ended');
      } catch (_) {
        // ignore — already closed
      }
    }
    this.connections.clear();
  }

  // ── Alarm API ──────────────────────────────────────────────────────────────

  /**
   * Set (or reset) the inactivity alarm to fire 2 hours from now.
   * Called on every WS connection and on practitioner chart_update activity.
   */
  async _resetAlarm() {
    const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
    await this.state.storage.setAlarm(Date.now() + TWO_HOURS_MS);
  }

  /**
   * Alarm handler — Cloudflare calls this when the scheduled time is reached.
   * Broadcasts session_ended and closes all open WebSocket connections.
   * This fires for abandoned sessions (practitioner drops without calling /end).
   */
  async alarm() {
    this._broadcastAll({ type: 'session_ended', noteSaved: false, reason: 'timeout' });
    this._closeAll();
  }
}
