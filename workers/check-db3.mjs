import { neon } from '@neondatabase/serverless';

const DB_URL = "postgresql://neondb_owner:npg_FlB3I6JYdboV@ep-rapid-bird-aicgk9v2-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

const sql = neon(DB_URL);

// Test insert for a test user
const userId = '05d341de-7dc4-4d4a-8c76-862168a2318b'; // testa_1773192162940
const today = new Date().toISOString().split('T')[0];

console.log('Testing checkin for user:', userId, 'date:', today);

try {
  const result = await sql`
    INSERT INTO daily_checkins (user_id, checkin_date, alignment_score, followed_strategy, followed_authority, notes, mood, energy_level, transit_snapshot)
    VALUES (${userId}, ${today}, 7, true, true, 'Automated test', 'good', 6, null)
    ON CONFLICT (user_id, checkin_date) DO UPDATE SET
      alignment_score = EXCLUDED.alignment_score,
      followed_strategy = EXCLUDED.followed_strategy,
      followed_authority = EXCLUDED.followed_authority,
      notes = EXCLUDED.notes,
      mood = EXCLUDED.mood,
      energy_level = EXCLUDED.energy_level,
      transit_snapshot = EXCLUDED.transit_snapshot,
      updated_at = NOW()
    RETURNING id, user_id, checkin_date, alignment_score, followed_strategy, followed_authority, notes, mood, energy_level, transit_snapshot, created_at, updated_at
  `;
  console.log('Insert OK:', JSON.stringify(result));
} catch(e) {
  console.error('Insert FAILED:', e.message);
}

// Test getCheckinDatesOrdered
try {
  const dates = await sql`SELECT checkin_date FROM daily_checkins WHERE user_id = ${userId} ORDER BY checkin_date ASC`;
  console.log('Dates:', JSON.stringify(dates));
} catch(e) {
  console.error('Dates query FAILED:', e.message);
}
