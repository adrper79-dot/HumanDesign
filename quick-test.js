#!/usr/bin/env node

const API = 'https://prime-self-api.adrper79.workers.dev';

async function quickTest() {
  console.log('Testing chart calculation...');
  const chartResponse = await fetch(API + '/api/chart/calculate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      birthDate: '1990-03-15',
      birthTime: '14:30',
      lat: 27.9506,
      lng: -82.4572,
      tz: 'America/New_York'
    })
  });
  console.log('Chart:', chartResponse.status, chartResponse.ok ? 'OK' : 'FAIL');

  console.log('\nTesting auth...');
  const email = `test_${Date.now()}@test.com`;
  const registerResponse = await fetch(API + '/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'Test123!' })
  });
  console.log('Register:', registerResponse.status, registerResponse.ok ? 'OK' : 'FAIL');

  const loginResponse = await fetch(API + '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'Test123!' })
  });
  const loginData = await loginResponse.json();
  console.log('Login:', loginResponse.status, loginResponse.ok ? 'OK' : 'FAIL');

  if (loginData.accessToken) {
    console.log('Token acquired!');
    
    console.log('\nTesting profile generation...');
    const profileResponse = await fetch(API + '/api/profile/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${loginData.accessToken}`
      },
      body: JSON.stringify({
        birthDate: '1990-03-15',
        birthTime: '14:30',
        lat: 27.9506,
        lng: -82.4572,
        tz: 'America/New_York',
        save: true
      })
    });
    
    console.log('Profile:', profileResponse.status, profileResponse.ok ? 'OK' : 'FAIL');
    if (!profileResponse.ok) {
      const errorData = await profileResponse.json();
      console.log('Error:', errorData);
    }
  }
  
  console.log('\n✅ Quick test complete!');
}

quickTest().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
