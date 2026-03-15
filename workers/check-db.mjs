import { neon } from '@neondatabase/serverless';

const DB_URL = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;

if (!DB_URL) {
  throw new Error('Set DATABASE_URL or NEON_DATABASE_URL before running this script.');
}

const sql = neon(DB_URL);

try {
  // Check if table exists
  const tables = await sql`SELECT table_name FROM information_schema.tables WHERE table_name = 'daily_checkins'`;
  console.log('Tables:', JSON.stringify(tables));
  
  // Check columns
  const cols = await sql`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'daily_checkins' ORDER BY ordinal_position`;
  console.log('Columns:', JSON.stringify(cols));
  
  // Check triggers
  const triggers = await sql`SELECT trigger_name FROM information_schema.triggers WHERE event_object_table = 'daily_checkins'`;
  console.log('Triggers:', JSON.stringify(triggers));

  // Actually try doing a test insert with a fake user ID to see the error message
  const userId = '6e80336c-1062-4088-bf2d-1a785d82c959'; // admin user
  const today = new Date().toISOString().split('T')[0];
  
  try {
    const result = await sql`
      INSERT INTO daily_checkins (user_id, checkin_date, alignment_score, followed_strategy, followed_authority, notes, mood, energy_level, transit_snapshot)
      VALUES (${userId}, ${today}, 7, true, true, null, 'good', 6, null)
      ON CONFLICT (user_id, checkin_date) DO UPDATE SET
        alignment_score = EXCLUDED.alignment_score,
        followed_strategy = EXCLUDED.followed_strategy,
        followed_authority = EXCLUDED.followed_authority,
        notes = EXCLUDED.notes,
        mood = EXCLUDED.mood,
        energy_level = EXCLUDED.energy_level,
        transit_snapshot = EXCLUDED.transit_snapshot,
        updated_at = NOW()
      RETURNING id, user_id, checkin_date, alignment_score
    `;
    console.log('Insert result:', JSON.stringify(result));
  } catch(e) {
    console.error('Insert error:', e.message);
  }

} catch(e) {
  console.error('DB error:', e.message);
}
