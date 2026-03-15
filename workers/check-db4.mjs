import { neon } from '@neondatabase/serverless';
const DB_URL = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;

if (!DB_URL) {
  throw new Error('Set DATABASE_URL or NEON_DATABASE_URL before running this script.');
}

const sql = neon(DB_URL);

// Check key tables
const tables = await sql`SELECT table_name FROM information_schema.tables WHERE table_name IN ('analytics_events', 'profiles', 'user_achievement_stats', 'checkin_reminders') ORDER BY table_name`;
console.log('Tables:', tables.map(t => t.table_name));

// Try the weekly users query
try {
  const r = await sql`SELECT COUNT(DISTINCT user_id) as count FROM analytics_events WHERE event_name = 'chart_calculate' AND created_at >= NOW() - INTERVAL '7 days'`;
  console.log('analytics_events query OK:', JSON.stringify(r));
} catch(e) {
  console.error('analytics_events query FAILED:', e.message);
}
