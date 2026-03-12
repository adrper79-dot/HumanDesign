/**
 * Register (or refresh) Discord slash commands for Prime Self.
 *
 * Run this script once before deploying the Worker, and any time
 * the command definition changes (name, options, descriptions).
 *
 * Usage:
 *   DISCORD_APPLICATION_ID=<id> DISCORD_BOT_TOKEN=<token> node scripts/register-commands.js
 *
 * Or add to .env and run:
 *   node --env-file=.env scripts/register-commands.js
 *
 * This registers commands globally — they propagate to all servers within ~1 hour.
 * For instant local testing during development, register to a single guild instead:
 *   Set DISCORD_GUILD_ID to your test server ID and use the guild-scoped endpoint.
 *
 * Discord API reference:
 *   https://discord.com/developers/docs/interactions/application-commands#bulk-overwrite-global-application-commands
 */

const APPLICATION_ID = process.env.DISCORD_APPLICATION_ID;
const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const GUILD_ID = process.env.DISCORD_GUILD_ID; // optional — dev/test only

if (!APPLICATION_ID || !BOT_TOKEN) {
  console.error(
    'Error: DISCORD_APPLICATION_ID and DISCORD_BOT_TOKEN must be set.\n' +
    'Example:\n' +
    '  DISCORD_APPLICATION_ID=123 DISCORD_BOT_TOKEN=your_token node scripts/register-commands.js',
  );
  process.exit(1);
}

/** The /primself command definition. */
const commands = [
  {
    name: 'primself',
    description: 'Get your Human Design Quick Start Guide — type, authority, profile, and decision protocol.',
    options: [
      {
        name: 'date',
        description: 'Birth date in YYYY-MM-DD format (e.g., 1990-06-15)',
        type: 3, // STRING
        required: true,
      },
      {
        name: 'time',
        description: 'Birth time in HH:MM 24-hour format (e.g., 14:30 for 2:30 PM)',
        type: 3, // STRING
        required: true,
      },
      {
        name: 'city',
        description: 'Birth city and country (e.g., Tampa, FL, USA)',
        type: 3, // STRING
        required: true,
      },
    ],
  },
];

// Use guild-scoped endpoint for instant dev propagation; global for production
const url = GUILD_ID
  ? `https://discord.com/api/v10/applications/${APPLICATION_ID}/guilds/${GUILD_ID}/commands`
  : `https://discord.com/api/v10/applications/${APPLICATION_ID}/commands`;

console.log(
  GUILD_ID
    ? `Registering commands to guild ${GUILD_ID} (instant propagation)...`
    : 'Registering commands globally (up to 1 hour propagation)...',
);

const res = await fetch(url, {
  method: 'PUT', // Bulk overwrite — idempotent, safe to re-run
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bot ${BOT_TOKEN}`,
  },
  body: JSON.stringify(commands),
});

const body = await res.json();

if (!res.ok) {
  console.error('Discord API error:', res.status, JSON.stringify(body, null, 2));
  process.exit(1);
}

console.log(`✓ ${body.length} command(s) registered successfully:`);
for (const cmd of body) {
  console.log(`  /${cmd.name}  (id: ${cmd.id})`);
}
