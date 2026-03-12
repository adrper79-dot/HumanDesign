import { execSync } from 'child_process';

const loginResp = JSON.parse(execSync('curl -s -X POST "https://prime-self-api.adrper79.workers.dev/api/auth/login" -H "Content-Type: application/json" -d "{\\"email\\":\\"adrper79@gmail.com\\",\\"password\\":\\"123qweASD\\"}"').toString());
const token = loginResp.accessToken;
console.log('Token:', token?.substring(0, 20));

const r = await fetch('https://prime-self-api.adrper79.workers.dev/api/diary', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
  body: JSON.stringify({ eventTitle: 'A'.repeat(100000), eventDate: '2026-03-10', content: 'B'.repeat(100000), type: 'insight' })
});
console.log('Status:', r.status);
const text = await r.text();
console.log('Body:', text.substring(0, 200));
