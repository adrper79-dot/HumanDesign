import { neon } from '@neondatabase/serverless';

const DB_URL = "postgresql://neondb_owner:npg_FlB3I6JYdboV@ep-rapid-bird-aicgk9v2-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

const sql = neon(DB_URL);

// First find test users
const users = await sql`SELECT id, email, tier FROM users WHERE email LIKE '%testuser%' OR email LIKE '%test+%' LIMIT 5`;
console.log('Test users:', JSON.stringify(users));

// Check if there's a 'test.user.a' type account
const users2 = await sql`SELECT id, email, tier FROM users WHERE email LIKE '%test%' LIMIT 10`;
console.log('All test users:', JSON.stringify(users2));
