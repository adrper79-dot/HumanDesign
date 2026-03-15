import { neon } from '@neondatabase/serverless';

const DB_URL = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;

if (!DB_URL) {
	throw new Error('Set DATABASE_URL or NEON_DATABASE_URL before running this script.');
}

const sql = neon(DB_URL);

// First find test users
const users = await sql`SELECT id, email, tier FROM users WHERE email LIKE '%testuser%' OR email LIKE '%test+%' LIMIT 5`;
console.log('Test users:', JSON.stringify(users));

// Check if there's a 'test.user.a' type account
const users2 = await sql`SELECT id, email, tier FROM users WHERE email LIKE '%test%' LIMIT 10`;
console.log('All test users:', JSON.stringify(users2));
