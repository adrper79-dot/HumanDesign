/**
 * LiveSessionClient — GAP-008 Phase 1 MVP
 *
 * Handles the client and practitioner sides of a real-time live session.
 *
 * Usage (practitioner view):
 *   const client = new LiveSessionClient({ role: 'practitioner', sessionId });
 *   await client.connect();
 *   client.sendChartUpdate({ tab: 'transits', gateHighlight: 45 });
 *   client.sendPointer(x, y);  // x, y in [0,1] relative to chart container
 *   client.endSession();
 *
 * Usage (client view — after validating invite token):
 *   const client = new LiveSessionClient({ role: 'client', sessionId });
 *   await client.connect();
 *
 * Events dispatched on window:
 *   live-session:joined         — { role, sessionState }
 *   live-session:participant    — { type: 'joined'|'left', role, count }
 *   live-session:chart-update   — { tab, gateHighlight }
 *   live-session:pointer        — { x, y }
 *   live-session:note-update    — { content }
 *   live-session:ended          — { noteSaved }
 *   live-session:disconnected   — { code, reason }
 *   live-session:error          — { message }
 */

/* global switchTab, highlightGate */

const WS_RECONNECT_DELAY_MS = 3000;
const WS_MAX_RECONNECT      = 3;

class LiveSessionClient {
  /**
   * @param {{ role: 'practitioner'|'client', sessionId: string }} options
   */
  constructor({ role, sessionId }) {
    this.role      = role;
    this.sessionId = sessionId;
    this._ws       = null;
    this._reconnectCount = 0;
    this._ended    = false;
  }

  // ── Connection lifecycle ────────────────────────────────────────────────────

  connect() {
    return new Promise((resolve, reject) => {
      const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
      const url      = `${protocol}//${location.host}/api/live-session/connect/${this.sessionId}`;

      this._ws = new WebSocket(url);

      this._ws.addEventListener('open', () => {
        this._reconnectCount = 0;
        // resolve immediately — wait for server's 'joined' message to confirm auth
      });

      this._ws.addEventListener('message', (msg) => {
        let data;
        try { data = JSON.parse(msg.data); } catch (_) { return; }

        if (data.type === 'joined') {
          resolve(data);
        }
        this._handleMessage(data);
      });

      this._ws.addEventListener('close', (ev) => {
        this._dispatch('live-session:disconnected', { code: ev.code, reason: ev.reason });
        if (!this._ended && this._reconnectCount < WS_MAX_RECONNECT) {
          this._reconnectCount++;
          setTimeout(() => this.connect(), WS_RECONNECT_DELAY_MS);
        }
      });

      this._ws.addEventListener('error', () => {
        this._dispatch('live-session:error', { message: 'WebSocket error' });
        reject(new Error('WebSocket connection failed'));
      });
    });
  }

  disconnect() {
    this._ended = true;
    this._ws?.close(1000, 'Client closed');
  }

  // ── Practitioner send methods ───────────────────────────────────────────────

  /**
   * Sync chart tab + gate highlight to client.
   * @param {{ tab: string, gateHighlight?: number|null }} state
   */
  sendChartUpdate(state) {
    this._send({ type: 'chart_update', ...state });
  }

  /**
   * Broadcast practitioner pointer position (relative coords 0-1).
   * @param {number} x
   * @param {number} y
   */
  sendPointer(x, y) {
    this._send({ type: 'pointer', x, y });
  }

  /**
   * Sync session note content from practitioner's textarea.
   * @param {string} content
   */
  sendNoteUpdate(content) {
    this._send({ type: 'note_update', content });
  }

  /**
   * End the live session — calls HTTP POST, not WS message.
   * Worker saves notes to DB and broadcasts session_ended.
   * @returns {Promise<{ ok: boolean, noteSaved: boolean }>}
   */
  async endSession() {
    const res = await fetch(`/api/live-session/${this.sessionId}/end`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });
    this._ended = true;
    this.disconnect();
    return res.ok ? res.json() : {};
  }

  // ── Internal ────────────────────────────────────────────────────────────────

  _send(message) {
    if (this._ws?.readyState === WebSocket.OPEN) {
      this._ws.send(JSON.stringify(message));
    }
  }

  _dispatch(eventName, detail) {
    window.dispatchEvent(new CustomEvent(eventName, { detail, bubbles: false }));
  }

  _handleMessage(data) {
    switch (data.type) {
      case 'joined':
        this._dispatch('live-session:joined', { role: data.role, sessionState: data.sessionState });
        break;

      case 'participant_joined':
      case 'participant_left':
        this._dispatch('live-session:participant', {
          type:  data.type === 'participant_joined' ? 'joined' : 'left',
          role:  data.role,
          count: data.count,
        });
        break;

      case 'chart_update':
        this._dispatch('live-session:chart-update', { tab: data.tab, gateHighlight: data.gateHighlight });
        // Auto-apply to existing chart UI helpers if available
        if (this.role === 'client') {
          if (typeof switchTab === 'function' && data.tab) switchTab(data.tab);
          if (typeof highlightGate === 'function') highlightGate(data.gateHighlight ?? null);
        }
        break;

      case 'pointer':
        this._dispatch('live-session:pointer', { x: data.x, y: data.y });
        if (this.role === 'client') LiveSessionClient._movePointerOverlay(data.x, data.y);
        break;

      case 'note_update':
        this._dispatch('live-session:note-update', { content: data.content });
        if (this.role === 'client') LiveSessionClient._updateClientNotes(data.content);
        break;

      case 'session_ended':
        this._dispatch('live-session:ended', { noteSaved: data.noteSaved });
        this._ended = true;
        break;

      default:
        break;
    }
  }

  // ── Static DOM helpers ─────────────────────────────────────────────────────

  /** Move the practitioner-cursor overlay dot to relative position */
  static _movePointerOverlay(x, y) {
    const overlay = document.querySelector('.live-pointer-overlay');
    if (!overlay) return;
    const chart = document.querySelector('.live-pointer-anchor') || document.body;
    const rect  = chart.getBoundingClientRect();
    overlay.style.left    = `${rect.left + x * rect.width}px`;
    overlay.style.top     = `${rect.top  + y * rect.height + window.scrollY}px`;
    overlay.style.display = 'block';
  }

  /** Update the read-only client notes panel */
  static _updateClientNotes(content) {
    const el = document.querySelector('.live-session-client-notes');
    if (el) el.textContent = content;
  }
}

// ── Factory / Init (auto-called on client join pages) ─────────────────────────
/**
 * Auto-init for /live/:token pages.
 * Validates token → gets sessionId → connects WebSocket.
 */
async function initLiveSessionPage() {
  const tokenMatch = window.location.pathname.match(/^\/live\/([A-Za-z0-9_-]+)$/);
  if (!tokenMatch) return; // Not a live-session page

  const token = tokenMatch[1];

  // Validate invite token and get sessionId
  let sessionId;
  try {
    const res = await fetch(`/api/live-session/join/${token}`, { credentials: 'include' });
    if (!res.ok) {
      console.error('[live-session] invite token invalid or expired');
      return;
    }
    ({ sessionId } = await res.json());
  } catch (err) {
    console.error('[live-session] failed to validate invite', err);
    return;
  }

  const lsClient = new LiveSessionClient({ role: 'client', sessionId });
  window.liveSessionClient = lsClient;

  try {
    await lsClient.connect();
    console.debug('[live-session] connected as client to session', sessionId);
  } catch (err) {
    console.error('[live-session] WebSocket connect failed', err);
  }
}

// Expose globally for use by existing chart UI
window.LiveSessionClient = LiveSessionClient;

// Auto-init on client join pages
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initLiveSessionPage);
} else {
  initLiveSessionPage();
}
