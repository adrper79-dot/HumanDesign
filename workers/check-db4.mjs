import { neon } from '@neondatabase/serverless';
const DB_URL = "postgresql://neondb_owner:npg_FlB3I6JYdboV@ep-rapid-bird-aicgk9v2-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";
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
