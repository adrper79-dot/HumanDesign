#!/usr/bin/env node

/**
 * Prime Self API Test Runner
 * Automated endpoint testing
 */

const API = 'https://prime-self-api.adrper79.workers.dev';

const testResults = {
  passed: [],
  failed: [],
  errors: []
};

let globalToken = null;

async function testEndpoint(method, path, body, useAuth, description) {
  const url = API + path;
  const options = {
    method,
    headers: {}
  };

  if (useAuth && globalToken) {
    options.headers['Authorization'] = `Bearer ${globalToken}`;
  }

  if (body) {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }

  try {
    console.log(`\n🧪 ${description}`);
    console.log(`   ${method} ${path}`);
    
    const response = await fetch(url, options);
    const data = await response.json();

    if (response.ok && !data.error) {
      console.log(`   ✅ PASS (${response.status})`);
      testResults.passed.push(description);
      return data;
    } else {
      console.log(`   ❌ FAIL (${response.status}): ${data.error || JSON.stringify(data)}`);
      testResults.failed.push(description);
      return null;
    }
  } catch (error) {
    console.log(`   ⚠️  ERROR: ${error.message}`);
    testResults.errors.push(description);
    return null;
  }
}

async function runTests() {
  console.log('╔═══════════════════════════════════════════════════════╗');
  console.log('║       Prime Self API - Comprehensive Test Suite       ║');
  console.log('╚═══════════════════════════════════════════════════════╝');
  console.log(`\n📍 Testing API: ${API}`);
  console.log(`⏰ Started: ${new Date().toISOString()}\n`);
  console.log('─'.repeat(60));

  // ═══════════════════════════════════════════════════════
  // SECTION 1: PUBLIC ENDPOINTS (No Auth Required)
  // ═══════════════════════════════════════════════════════
  console.log('\n📦 SECTION 1: Public Endpoints');
  console.log('─'.repeat(60));

  // Test 1: Geocode - Valid city
  await testEndpoint(
    'GET', 
    '/api/geocode?q=Tampa, FL', 
    null, 
    false, 
    'Geocode: Valid city (Tampa, FL)'
  );

  // Test 2: Geocode - Invalid city
  await testEndpoint(
    'GET', 
    '/api/geocode?q=NotARealCityXYZ123', 
    null, 
    false, 
    'Geocode: Invalid city (should fail gracefully)'
  );

  // Test 3: Chart calculation (no auth, no save)
  await testEndpoint(
    'POST', 
    '/api/chart/calculate', 
    {
      date: '1990-03-15',
      time: '14:30',
      lat: 27.9506,
      lng: -82.4572,
      tz: 'America/New_York'
    }, 
    false, 
    'Chart: Calculate without auth'
  );

  // Test 4: Chart calculation with invalid date
  await testEndpoint(
    'POST', 
    '/api/chart/calculate', 
    {
      date: '2030-01-01',
      time: '14:30',
      lat: 27.9506,
      lng: -82.4572,
      tz: 'America/New_York'
    }, 
    false, 
    'Chart: Future date (should fail)'
  );

  // Test 5: Transits
  await testEndpoint(
    'GET', 
    '/api/transits/today', 
    null, 
    false, 
    'Transits: Get today\'s positions'
  );

  // Test 6: Composite chart
  await testEndpoint(
    'POST', 
    '/api/composite', 
    {
      personA: {
        date: '1990-03-15',
        time: '14:30',
        lat: 27.9506,
        lng: -82.4572,
        tz: 'America/New_York'
      },
      personB: {
        date: '1985-07-20',
        time: '08:15',
        lat: 40.7128,
        lng: -74.0060,
        tz: 'America/New_York'
      }
    }, 
    false, 
    'Composite: Two valid birth dates'
  );

  // ═══════════════════════════════════════════════════════
  // SECTION 2: AUTHENTICATION
  // ═══════════════════════════════════════════════════════
  console.log('\n\n🔐 SECTION 2: Authentication');
  console.log('─'.repeat(60));

  const testEmail = `test_${Date.now()}@primeself.test`;
  const testPassword = 'TestPassword123!';

  // Test 7: Register new user
  const registerResult = await testEndpoint(
    'POST', 
    '/api/auth/register', 
    {
      email: testEmail,
      password: testPassword
    }, 
    false, 
    'Auth: Register new user'
  );

  // Test 8: Register duplicate email (should fail)
  await testEndpoint(
    'POST', 
    '/api/auth/register', 
    {
      email: testEmail,
      password: testPassword
    }, 
    false, 
    'Auth: Duplicate email (should fail)'
  );

  // Test 9: Login with correct credentials
  const loginResult = await testEndpoint(
    'POST', 
    '/api/auth/login', 
    {
      email: testEmail,
      password: testPassword
    }, 
    false, 
    'Auth: Login with valid credentials'
  );

  if (loginResult?.token) {
    globalToken = loginResult.token;
    console.log(`   🔑 Token acquired: ${globalToken.substring(0, 20)}...`);
  }

  // Test 10: Login with wrong password
  await testEndpoint(
    'POST', 
    '/api/auth/login', 
    {
      email: testEmail,
      password: 'WrongPassword123!'
    }, 
    false, 
    'Auth: Login with wrong password (should fail)'
  );

  // ═══════════════════════════════════════════════════════
  // SECTION 3: AUTHENTICATED ENDPOINTS
  // ═══════════════════════════════════════════════════════
  console.log('\n\n🔒 SECTION 3: Authenticated Endpoints');
  console.log('─'.repeat(60));

  if (!globalToken) {
    console.log('⚠️  No token available - skipping authenticated tests');
  } else {
    // Test 11: Generate profile with save
    const profileResult = await testEndpoint(
      'POST', 
      '/api/profile/generate', 
      {
        birth: {
          date: '1990-03-15',
          time: '14:30',
          lat: 27.9506,
          lng: -82.4572,
          tz: 'America/New_York'
        },
        save: true
      }, 
      true, 
      'Profile: Generate and save'
    );

    // Test 12: List saved profiles
    await testEndpoint(
      'GET', 
      '/api/profile/list', 
      null, 
      true, 
      'Profile: List all saved profiles'
    );

    // Test 13: Get specific profile
    if (profileResult?.profileId) {
      await testEndpoint(
        'GET', 
        `/api/profile/${profileResult.profileId}`, 
        null, 
        true, 
        'Profile: Get specific profile by ID'
      );
    }

    // Test 14: Create cluster
    const clusterResult = await testEndpoint(
      'POST', 
      '/api/cluster/create', 
      {
        name: 'Test Team Alpha',
        challenge: 'Testing the cluster system'
      }, 
      true, 
      'Cluster: Create new cluster'
    );

    // Test 15: List clusters
    await testEndpoint(
      'GET', 
      '/api/cluster/list', 
      null, 
      true, 
      'Cluster: List all clusters'
    );

    // Test 16: Get cluster details
    if (clusterResult?.clusterId) {
      await testEndpoint(
        'GET', 
        `/api/cluster/${clusterResult.clusterId}`, 
        null, 
        true, 
        'Cluster: Get cluster details'
      );
    }

    // Test 17: Add client to practitioner roster
    await testEndpoint(
      'POST', 
      '/api/practitioner/roster/add', 
      {
        clientName: 'Test Client',
        profileId: profileResult?.profileId || 'test-profile-id'
      }, 
      true, 
      'Practitioner: Add client to roster'
    );

    // Test 18: Get practitioner roster
    await testEndpoint(
      'GET', 
      '/api/practitioner/roster', 
      null, 
      true, 
      'Practitioner: Get client roster'
    );
  }

  // ═══════════════════════════════════════════════════════
  // SECTION 4: SPECIAL ENDPOINTS
  // ═══════════════════════════════════════════════════════
  console.log('\n\n⚙️  SECTION 4: Special Endpoints');
  console.log('─'.repeat(60));

  // Test 19: Rectification
  await testEndpoint(
    'POST', 
    '/api/rectify', 
    {
      approximateBirth: {
        date: '1990-03-15',
        timeRange: { start: '12:00', end: '18:00' },
        lat: 27.9506,
        lng: -82.4572,
        tz: 'America/New_York'
      },
      lifeEvents: [
        { date: '2010-06-01', event: 'Graduated college', significance: 'high' }
      ]
    }, 
    false, 
    'Rectify: Birth time rectification'
  );

  // Test 20: SMS Subscribe
  await testEndpoint(
    'POST', 
    '/api/sms/subscribe', 
    {
      phoneNumber: '+15555551234'
    }, 
    false, 
    'SMS: Subscribe to updates'
  );

  // Test 21: SMS Unsubscribe
  await testEndpoint(
    'POST', 
    '/api/sms/unsubscribe', 
    {
      phoneNumber: '+15555551234'
    }, 
    false, 
    'SMS: Unsubscribe from updates'
  );

  // Test 22: Onboarding - Start session
  const onboardingResult = await testEndpoint(
    'POST', 
    '/api/onboarding/start', 
    {}, 
    false, 
    'Onboarding: Start new session'
  );

  // Test 23: Onboarding - Next step
  if (onboardingResult?.sessionId) {
    await testEndpoint(
      'POST', 
      `/api/onboarding/session/${onboardingResult.sessionId}/next`, 
      {}, 
      false, 
      'Onboarding: Get next step'
    );
  }

  // ═══════════════════════════════════════════════════════
  // TEST SUMMARY
  // ═══════════════════════════════════════════════════════
  printSummary();
}

function printSummary() {
  console.log('\n\n' + '═'.repeat(60));
  console.log('📊 TEST RESULTS SUMMARY');
  console.log('═'.repeat(60));
  
  const total = testResults.passed.length + testResults.failed.length + testResults.errors.length;
  const passRate = Math.round((testResults.passed.length / total) * 100);
  
  console.log(`\n📈 Statistics:`);
  console.log(`   Total Tests:  ${total}`);
  console.log(`   ✅ Passed:    ${testResults.passed.length}`);
  console.log(`   ❌ Failed:    ${testResults.failed.length}`);
  console.log(`   ⚠️  Errors:    ${testResults.errors.length}`);
  console.log(`   📊 Pass Rate: ${passRate}%`);
  
  if (testResults.failed.length > 0) {
    console.log(`\n❌ Failed Tests:`);
    testResults.failed.forEach((t, i) => {
      console.log(`   ${i + 1}. ${t}`);
    });
  }
  
  if (testResults.errors.length > 0) {
    console.log(`\n⚠️  Error Tests:`);
    testResults.errors.forEach((t, i) => {
      console.log(`   ${i + 1}. ${t}`);
    });
  }
  
  if (testResults.passed.length === total) {
    console.log(`\n🎉 ALL TESTS PASSED! 🎉`);
  }
  
  console.log(`\n⏰ Completed: ${new Date().toISOString()}`);
  console.log('═'.repeat(60) + '\n');
  
  // Exit with error code if tests failed
  process.exit(testResults.failed.length > 0 || testResults.errors.length > 0 ? 1 : 0);
}

// Run the test suite
runTests().catch(err => {
  console.error('Fatal error running tests:', err);
  process.exit(1);
});
