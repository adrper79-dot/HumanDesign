/**
 * Notion Integration Handler — OAuth, Database Sync, Page Export
 * 
 * Endpoints:
 * - GET  /api/notion/auth - Initiate Notion OAuth flow
 * - GET  /api/notion/callback - OAuth callback handler
 * - GET  /api/notion/status - Get connection status
 * - POST /api/notion/sync/clients - Sync practitioner clients to Notion database
 * - POST /api/notion/export/profile/:id - Export profile to Notion page
 * - DELETE /api/notion/disconnect - Disconnect Notion integration
 */

import { NotionClient } from '../lib/notion.js';
import { createQueryFn, QUERIES } from '../db/queries.js';
import { getUserFromRequest } from '../middleware/auth.js';

/**
 * GET /api/notion/auth
 * Initiate Notion OAuth flow - redirects to Notion authorization page
 */
export async function handleNotionAuth(request, env, ctx) {
  try {
    const user = await getUserFromRequest(request, env);
    if (!user) return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    const query = createQueryFn(env.NEON_CONNECTION_STRING);
    
    // Generate OAuth state token for CSRF protection
    const state = crypto.randomUUID();
    
    // Store state token in database (expires in 10 minutes)
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    await query(QUERIES.insertOAuthState, [user.id, state, expiresAt]);
    
    // Notion OAuth URL
    const NOTION_CLIENT_ID = env.NOTION_CLIENT_ID;
const REDIRECT_URI = `${env.BASE_URL || 'https://primeself.app'}/api/notion/callback`;
    
    const authUrl = new URL('https://api.notion.com/v1/oauth/authorize');
    authUrl.searchParams.set('client_id', NOTION_CLIENT_ID);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('owner', 'user');
    authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
    authUrl.searchParams.set('state', state);
    
    return Response.json({
      success: true,
      authUrl: authUrl.toString()
    });
    
  } catch (error) {
    console.error('Error initiating Notion auth:', error);
    return Response.json({
      success: false,
      error: 'Failed to initiate Notion authorization'
    }, { status: 500 });
  }
}

/**
 * GET /api/notion/callback
 * OAuth callback - exchange code for access token
 */
export async function handleNotionCallback(request, env, ctx) {
  try {
    const url = new URL(request.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');
    
    if (error) {
      // BL-R-H7: HTML-escape error parameter to prevent reflected XSS
      const safeError = String(error)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;');
      return new Response(`
        <!DOCTYPE html>
        <html>
          <head><title>Notion Authorization Failed</title></head>
          <body>
            <h1>Authorization Failed</h1>
            <p>Error: ${safeError}</p>
            <a href="/">Return to Prime Self</a>
          </body>
        </html>
      `, {
        status: 400,
        headers: { 'Content-Type': 'text/html' }
      });
    }
    
    if (!code || !state) {
      return new Response('Missing code or state', { status: 400 });
    }
    
    // Verify state token
    const query = createQueryFn(env.NEON_CONNECTION_STRING);
    const { rows: stateRecords } = await query(QUERIES.verifyOAuthState, [state]);
    
    if (!stateRecords || stateRecords.length === 0) {
      return new Response('Invalid or expired state token', { status: 400 });
    }
    
    const userId = stateRecords[0].user_id;
    
    // Delete used state token
    await query(QUERIES.deleteOAuthState, [state]);
    
    // Exchange code for access token
    const NOTION_CLIENT_ID = env.NOTION_CLIENT_ID;
    const NOTION_CLIENT_SECRET = env.NOTION_CLIENT_SECRET;
    const REDIRECT_URI = `${env.BASE_URL || 'https://primeself.app'}/api/notion/callback`;
    
    const tokenResponse = await fetch('https://api.notion.com/v1/oauth/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(`${NOTION_CLIENT_ID}:${NOTION_CLIENT_SECRET}`)}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI
      })
    });
    
    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Notion token exchange failed:', errorText);
      return new Response('Failed to exchange authorization code', { status: 500 });
    }
    
    const tokenData = await tokenResponse.json();
    
    // Store access token and workspace info
    await query(QUERIES.upsertNotionConnection, [
      userId,
      tokenData.access_token,
      tokenData.workspace_id,
      tokenData.workspace_name,
      tokenData.bot_id,
      tokenData.owner?.type || 'user',
      tokenData.owner?.user?.id || null
    ]);
    
    // Redirect to success page
    return new Response(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Notion Connected</title>
          <style>
            body { font-family: system-ui; max-width: 600px; margin: 100px auto; text-align: center; }
            h1 { color: #48bb78; }
            button { padding: 12px 24px; background: #48bb78; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 16px; }
            button:hover { background: #38a169; }
          </style>
        </head>
        <body>
          <h1>✓ Notion Connected Successfully!</h1>
          <p>Your Prime Self account is now connected to Notion.</p>
          <p>You can now sync your client roster and export profiles to Notion.</p>
          <button onclick="window.close() || (window.location.href = '/')">Return to Prime Self</button>
        </body>
      </html>
    `, {
      status: 200,
      headers: { 'Content-Type': 'text/html' }
    });
    
  } catch (error) {
    console.error('Error handling Notion callback:', error);
    return new Response('Internal server error', { status: 500 });
  }
}

/**
 * GET /api/notion/status
 * Get Notion connection status
 */
export async function handleNotionStatus(request, env, ctx) {
  try {
    const user = await getUserFromRequest(request, env);
    if (!user) return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    const query = createQueryFn(env.NEON_CONNECTION_STRING);
    
    // Check if user has Notion connection
    const { rows: connections } = await query(QUERIES.getNotionConnection, [user.id]);
    
    if (!connections || connections.length === 0) {
      return Response.json({
        success: true,
        connected: false
      });
    }
    
    const connection = connections[0];
    
    return Response.json({
      success: true,
      connected: true,
      workspace: {
        id: connection.workspace_id,
        name: connection.workspace_name
      },
      connectedAt: connection.created_at,
      lastUpdated: connection.updated_at
    });
    
  } catch (error) {
    console.error('Error getting Notion status:', error);
    return Response.json({
      success: false,
      error: 'Failed to get Notion status'
    }, { status: 500 });
  }
}

/**
 * POST /api/notion/sync/clients
 * Sync practitioner clients to Notion database
 */
export async function handleSyncClients(request, env, ctx) {
  try {
    const user = await getUserFromRequest(request, env);
    if (!user) return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    const query = createQueryFn(env.NEON_CONNECTION_STRING);
    
    // Verify user is practitioner
    if (user.tier !== 'practitioner' && user.tier !== 'guide') {
      return Response.json({
        success: false,
        error: 'Practitioner or Guide tier required'
      }, { status: 403 });
    }
    
    // Get Notion connection
    const { rows: connections } = await query(QUERIES.getNotionAccessToken, [user.id]);
    
    if (!connections || connections.length === 0) {
      return Response.json({
        success: false,
        error: 'Notion not connected. Please connect Notion first.'
      }, { status: 400 });
    }
    
    const accessToken = connections[0].access_token;
    
    // Get or create Notion database for clients
    const notion = new NotionClient(accessToken);
    
    // Check if database already exists
    let { rows: dbRecords } = await query(QUERIES.getNotionSyncRecord, [user.id]);
    
    let databaseId;
    
    if (!dbRecords || dbRecords.length === 0) {
      // Create new database
      const database = await notion.createClientsDatabase('Prime Self — Client Roster');
      databaseId = database.id;
      
      // Store database ID
      await query(QUERIES.insertNotionSync, [user.id, databaseId]);
      
    } else {
      databaseId = dbRecords[0].notion_database_id;
    }
    
    // Get practitioner ID
    const { rows: practitioners } = await query(QUERIES.getPractitionerById, [user.id]);
    
    if (!practitioners || practitioners.length === 0) {
      return Response.json({
        success: false,
        error: 'Practitioner record not found'
      }, { status: 404 });
    }
    
    const practitionerId = practitioners[0].id;
    
    // Get all clients
    const { rows: clients } = await query(QUERIES.getPractitionerClients2, [practitionerId]);
    
    // Sync each client to Notion
    let syncedCount = 0;
    let errorCount = 0;
    
    for (const client of clients) {
      try {
        const chartData = client.hd_json ? (typeof client.hd_json === 'string' ? JSON.parse(client.hd_json) : client.hd_json) : null;
        
        // Create or update page in Notion database
        await notion.createOrUpdateClientPage(databaseId, {
          email: client.email,
          birthDate: client.birth_date,
          type: chartData?.type || 'Unknown',
          profile: chartData?.profile || 'Unknown',
          authority: chartData?.authority || 'Unknown',
          joinedAt: client.joined_at
        });
        
        syncedCount++;
        
      } catch (pageError) {
        console.error(`Error syncing client ${client.email}:`, pageError);
        errorCount++;
      }
    }
    
    // Update last sync time
    await query(QUERIES.updateNotionSyncTime, [user.id]);
    
    return Response.json({
      success: true,
      synced: syncedCount,
      errors: errorCount,
      total: clients.length,
      databaseId
    });
    
  } catch (error) {
    console.error('Error syncing clients to Notion:', error);
    return Response.json({
      success: false,
      error: 'Failed to sync clients to Notion'
    }, { status: 500 });
  }
}

/**
 * POST /api/notion/export/profile/:id
 * Export profile to Notion page
 */
export async function handleExportProfile(request, env, ctx, profileId) {
  try {
    const user = await getUserFromRequest(request, env);
    if (!user) return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    const query = createQueryFn(env.NEON_CONNECTION_STRING);
    
    // Get Notion connection
    const { rows: connections } = await query(QUERIES.getNotionAccessTokenOnly, [user.id]);
    
    if (!connections || connections.length === 0) {
      return Response.json({
        success: false,
        error: 'Notion not connected. Please connect Notion first.'
      }, { status: 400 });
    }
    
    const accessToken = connections[0].access_token;
    
    // Get profile
    const { rows: profiles } = await query(QUERIES.getNotionExportProfile, [profileId, user.id]);
    
    if (!profiles || profiles.length === 0) {
      return Response.json({
        success: false,
        error: 'Profile not found'
      }, { status: 404 });
    }
    
    const profile = profiles[0];
    const profileData = typeof profile.profile_json === 'string' ? JSON.parse(profile.profile_json) : profile.profile_json;
    const chartData = typeof profile.hd_json === 'string' ? JSON.parse(profile.hd_json) : profile.hd_json;
    
    // Create Notion page
    const notion = new NotionClient(accessToken);
    const page = await notion.createProfilePage({
      email: profile.email,
      type: chartData.type,
      profile: chartData.profile,
      authority: chartData.authority,
      definition: chartData.definition,
      strategy: profileData.strategy || chartData.strategy,
      signature: profileData.signature,
      notSelfTheme: profileData.notSelfTheme,
      centers: chartData.centers,
      gates: chartData.gates,
      channels: chartData.channels,
      synthesis: profileData.synthesis
    });
    
    return Response.json({
      success: true,
      pageId: page.id,
      pageUrl: page.url
    });
    
  } catch (error) {
    console.error('Error exporting profile to Notion:', error);
    return Response.json({
      success: false,
      error: 'Failed to export profile to Notion'
    }, { status: 500 });
  }
}

/**
 * DELETE /api/notion/disconnect
 * Disconnect Notion integration
 */
export async function handleNotionDisconnect(request, env, ctx) {
  try {
    const user = await getUserFromRequest(request, env);
    if (!user) return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    const query = createQueryFn(env.NEON_CONNECTION_STRING);
    
    // Delete connection
    await query(QUERIES.deleteNotionConnection, [user.id]);
    
    // Delete sync records
    await query(QUERIES.deleteNotionSyncs, [user.id]);
    
    return Response.json({
      success: true,
      message: 'Notion integration disconnected'
    });
    
  } catch (error) {
    console.error('Error disconnecting Notion:', error);
    return Response.json({
      success: false,
      error: 'Failed to disconnect Notion'
    }, { status: 500 });
  }
}
