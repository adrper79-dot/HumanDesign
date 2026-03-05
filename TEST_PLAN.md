# Prime Self - Comprehensive Test Plan

## Overview
This document outlines all endpoints, UI interactions, and test scenarios to ensure the application works correctly.

---

## 🎯 API Endpoints Testing

### Authentication
| Endpoint | Method | Auth Required | Test Cases |
|----------|--------|---------------|------------|
| `/api/auth/register` | POST | No | ✓ Valid email/password<br>✗ Duplicate email<br>✗ Weak password<br>✗ Invalid email format |
| `/api/auth/login` | POST | No | ✓ Valid credentials<br>✗ Wrong password<br>✗ Non-existent user<br>✗ Missing fields |

### Chart Calculation
| Endpoint | Method | Auth Required | Test Cases |
|----------|--------|---------------|------------|
| `/api/chart/calculate` | POST | No | ✓ Valid birth data<br>✓ Save chart (with auth)<br>✗ Invalid date<br>✗ Missing location<br>✗ Invalid time format |
| `/api/geocode?q=<location>` | GET | No | ✓ Valid city name<br>✓ City with state<br>✗ Nonexistent location<br>✗ Empty query |

### Profile Generation
| Endpoint | Method | Auth Required | Test Cases |
|----------|--------|---------------|------------|
| `/api/profile/generate` | POST | Yes | ✓ Valid birth data<br>✓ Without saving<br>✓ With saving<br>✗ Unauthenticated<br>✗ Invalid data |
| `/api/profile/list` | GET | Yes | ✓ Returns saved profiles<br>✓ Empty list<br>✗ Unauthenticated |
| `/api/profile/<id>` | GET | Yes | ✓ Valid profile ID<br>✗ Invalid ID<br>✗ Someone else's profile |

### Transits
| Endpoint | Method | Auth Required | Test Cases |
|----------|--------|---------------|------------|
| `/api/transits/today` | GET | No | ✓ Returns current positions<br>✓ Valid gate activations |

### Composite Charts
| Endpoint | Method | Auth Required | Test Cases |
|----------|--------|---------------|------------|
| `/api/composite` | POST | No | ✓ Two valid birth dates<br>✗ Same person twice<br>✗ Invalid birth data |

### Rectification
| Endpoint | Method | Auth Required | Test Cases |
|----------|--------|---------------|------------|
| `/api/rectify` | POST | No | ✓ Valid life events<br>✓ Time window analysis<br>✗ Missing events<br>✗ Invalid date format |

### Practitioner Tools
| Endpoint | Method | Auth Required | Test Cases |
|----------|--------|---------------|------------|
| `/api/practitioner/roster` | GET | Yes | ✓ Returns client list<br>✓ Empty roster<br>✗ Unauthenticated |
| `/api/practitioner/roster/add` | POST | Yes | ✓ Valid client name + profile ID<br>✗ Missing fields<br>✗ Duplicate client |

### Cluster Management
| Endpoint | Method | Auth Required | Test Cases |
|----------|--------|---------------|------------|
| `/api/cluster/create` | POST | Yes | ✓ Valid name + challenge<br>✗ Empty name<br>✗ Unauthenticated |
| `/api/cluster/list` | GET | Yes | ✓ Returns user's clusters<br>✓ Empty list<br>✗ Unauthenticated |
| `/api/cluster/<id>` | GET | Yes | ✓ Valid cluster ID<br>✗ Invalid ID<br>✗ Not a member |
| `/api/cluster/<id>/join` | POST | Yes | ✓ Add member with birth data<br>✗ Already a member<br>✗ Invalid cluster |
| `/api/cluster/<id>/leave` | POST | Yes | ✓ Leave cluster<br>✗ Not a member<br>✗ Last member |

### SMS Subscription
| Endpoint | Method | Auth Required | Test Cases |
|----------|--------|---------------|------------|
| `/api/sms/subscribe` | POST | No | ✓ Valid phone number<br>✗ Invalid format<br>✗ Already subscribed |
| `/api/sms/unsubscribe` | POST | No | ✓ Unsubscribe existing<br>✗ Not subscribed |

### Onboarding
| Endpoint | Method | Auth Required | Test Cases |
|----------|--------|---------------|------------|
| `/api/onboarding/start` | POST | No | ✓ Start new session<br>✓ Returns session ID |
| `/api/onboarding/session/<id>/next` | POST | No | ✓ Progress through steps<br>✗ Invalid session ID |

### PDF Export
| Endpoint | Method | Auth Required | Test Cases |
|----------|--------|---------------|------------|
| `/api/pdf/<profileId>` | GET | Yes | ✓ Generate PDF<br>✗ Invalid profile ID<br>✗ Not owner |

---

## 🖱️ UI Interaction Testing

### Authentication Flow
- [ ] **Sign In** - Click "Sign In" button → overlay opens
  - [ ] Enter valid credentials → successful login
  - [ ] Enter wrong password → error message shown
  - [ ] Toggle to "Create Account" → form changes
  - [ ] "Continue without signing in" → closes overlay
  - [ ] Close overlay with X → overlay closes

- [ ] **Sign Out** - Click "Sign Out" → clears session
  - [ ] Verify token cleared from localStorage
  - [ ] Verify email cleared
  - [ ] Verify UI updates to logged-out state

### Tab Navigation
- [ ] **Chart Tab** - Click "Chart" → shows calculator
- [ ] **Profile Tab** - Click "Profile" → shows profile generator
- [ ] **Transits Tab** - Click "Transits" → shows transit positions
- [ ] **Composite Tab** - Click "Composite" → shows two-person form
- [ ] **Rectify Tab** - Click "Rectify" → shows rectification form
- [ ] **Practitioner Tab** - Click "Practitioner" → shows roster (or auth prompt)
- [ ] **Clusters Tab** - Click "Clusters" → shows clusters (or auth prompt)
- [ ] **SMS Tab** - Click "SMS" → shows subscription form
- [ ] **Onboarding Tab** - Click "Onboarding" → shows questionnaire
- [ ] **Saved Tab** - Click "Saved" → shows history (or auth prompt)

### Chart Calculator
- [ ] **Fill Form** - Enter birth data
  - [ ] Date picker works
  - [ ] Time input accepts HH:MM format
  - [ ] Location autocomplete
  
- [ ] **Geocode Location** - Click "Look Up"
  - [ ] Valid city → shows lat/lng/timezone
  - [ ] Invalid city → error message
  - [ ] Updates hidden fields

- [ ] **Calculate Chart** - Click "Calculate"
  - [ ] Shows loading state on button
  - [ ] Renders chart data
  - [ ] Shows HD chart (type, authority, profile, etc.)
  - [ ] Shows astrology data (planets, houses)
  - [ ] Shows centers and channels
  - [ ] Shows "Save Chart" option (if authenticated)

- [ ] **Try Example** - Click "Try Example"
  - [ ] Pre-fills form with sample data

### Profile Generator  
- [ ] **Generate Profile** - Click "Generate Prime Self Profile"
  - [ ] Requires sign-in → shows auth overlay
  - [ ] Shows loading state (15-30 seconds)
  - [ ] Renders 8-layer synthesis
  - [ ] Shows quick start guide sections
  - [ ] Shows Gene Keys, Numerology, Astrology sections
  - [ ] Shows technical toggles
  - [ ] Offers PDF download (if saved)

### Transits
- [ ] **Load Transits** - Click "View Today's Transits"
  - [ ] Shows current planetary positions
  - [ ] Shows gates/lines active
  - [ ] Includes planetary symbols and meanings

### Composite Charts
- [ ] **Fill Two Forms** - Enter data for person A and B
  - [ ] Both geocode buttons work
  - [ ] Validates both have data

- [ ] **Generate Composite** - Click "Generate Composite"
  - [ ] Shows loading state
  - [ ] Renders relationship dynamics
  - [ ] Shows electromagnetic & companionship channels
  - [ ] Shows relationship insights

### Rectification
- [ ] **Fill Rectification Form**
  - [ ] Enter approximate birth data
  - [ ] Add life events

- [ ] **Run Rectification** - Click "Analyze Time Windows"
  - [ ] Shows loading state
  - [ ] Returns sensitivity analysis
  - [ ] Shows variations in type/profile/authority
  - [ ] Provides guidance

### Practitioner Tools
- [ ] **Add Client** - Click "+ Add Client"
  - [ ] Requires auth
  - [ ] Prompts for name and profile ID
  - [ ] Adds to roster

- [ ] **Load Roster** - Click "↻ Refresh Roster"
  - [ ] Shows client list
  - [ ] Empty state if no clients

### Cluster Management
- [ ] **Create Cluster** - Click "+ New Cluster"
  - [ ] Requires auth
  - [ ] Shows creation form
  - [ ] Enter name and challenge
  - [ ] Click "Create" → creates cluster

- [ ] **Load Clusters** - Click "↻ Refresh"
  - [ ] Shows cluster cards
  - [ ] Shows member count
  - [ ] Empty state if no clusters

- [ ] **View Cluster Detail** - Click cluster card
  - [ ] Shows cluster name and challenge
  - [ ] Shows member list
  - [ ] Shows composition chart
  - [ ] Shows "Add Member" button

- [ ] **Add Member** - Click "+ Add Member"
  - [ ] Shows birth data form
  - [ ] Enter and submit
  - [ ] Updates cluster

- [ ] **Synthesize Cluster** - Click "Generate Synthesis"
  - [ ] (Not implemented - placeholder)

- [ ] **Leave Cluster** - Click "Leave Cluster"
  - [ ] Confirms action
  - [ ] Removes user from cluster

### SMS Subscription
- [ ] **Subscribe** - Enter phone number → Click "Subscribe"
  - [ ] Validates phone format
  - [ ] Success message

- [ ] **Unsubscribe** - Enter phone number → Click "Unsubscribe"
  - [ ] Success message

### Onboarding
- [ ] **Start Onboarding** - Click "Begin Your Story"
  - [ ] Starts session
  - [ ] Shows questions/responses
  - [ ] Completes with success message

### History/Saved Profiles
- [ ] **Load History** - Click "Load Saved Profiles"
  - [ ] Requires auth
  - [ ] Shows saved profiles list
  - [ ] Click profile → loads full data

---

## 🧪 Error Scenarios to Test

### Network Errors
- [ ] Server unreachable (API offline)
- [ ] Timeout (slow response)
- [ ] 500 Internal Server Error
- [ ] CORS issues

### Authentication Errors
- [ ] Expired token
- [ ] Invalid token
- [ ] Accessing protected route without auth
- [ ] Token refresh

### Data Validation Errors
- [ ] Empty required fields
- [ ] Invalid date formats
- [ ] Future birth dates
- [ ] Invalid latitude/longitude
- [ ] Special characters in names
- [ ] SQL injection attempts
- [ ] XSS attempts

### Edge Cases
- [ ] Very old birth dates (1900s)
- [ ] Birth at midnight (00:00)
- [ ] International locations with special characters
- [ ] Multiple rapid clicks (double submission)
- [ ] Browser back/forward navigation
- [ ] Page refresh during operation
- [ ] Concurrent logins (multiple tabs)

### Browser Compatibility
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)
- [ ] Mobile Safari (iOS)
- [ ] Mobile Chrome (Android)

### Responsive Design
- [ ] Desktop (1920x1080)
- [ ] Laptop (1366x768)
- [ ] Tablet (768x1024)
- [ ] Mobile (375x667)
- [ ] Ultra-wide (2560x1080)

---

## 🤖 Automated Testing Script

Create a test runner that hits all endpoints:

```javascript
// test-runner.js
const API = 'https://prime-self-api.adrper79.workers.dev';
const FRONTEND = 'https://selfprime.net';

const testResults = {
  passed: [],
  failed: [],
  errors: []
};

async function runTests() {
  console.log('🧪 Starting comprehensive API tests...\n');

  // Test 1: Geocode
  await testEndpoint('GET', '/api/geocode?q=Tampa, FL', null, false, 
    'Valid city geocode');

  // Test 2: Chart calculation (no auth)
  await testEndpoint('POST', '/api/chart/calculate', {
    date: '1990-03-15',
    time: '14:30',
    lat: 27.9506,
    lng: -82.4572,
    tz: 'America/New_York'
  }, false, 'Calculate chart without auth');

  // Test 3: Auth - Register
  const testEmail = `test_${Date.now()}@example.com`;
  await testEndpoint('POST', '/api/auth/register', {
    email: testEmail,
    password: 'TestPassword123!'
  }, false, 'Register new user');

  // Test 4: Auth - Login
  const loginRes = await testEndpoint('POST', '/api/auth/login', {
    email: testEmail,
    password: 'TestPassword123!'
  }, false, 'Login with credentials');
  
  const token = loginRes?.token;

  // Test 5: Profile generate (with auth)
  await testEndpoint('POST', '/api/profile/generate', {
    birth: {
      date: '1990-03-15',
      time: '14:30',
      lat: 27.9506,
      lng: -82.4572,
      tz: 'America/New_York'
    },
    save: true
  }, token, 'Generate and save profile');

  // Test 6: Profile list (with auth)
  await testEndpoint('GET', '/api/profile/list', null, token, 
    'List saved profiles');

  // Test 7: Transits
  await testEndpoint('GET', '/api/transits/today', null, false, 
    'Get today\'s transits');

  // Test 8: Composite
  await testEndpoint('POST', '/api/composite', {
    personA: {
      date: '1990-03-15', time: '14:30',
      lat: 27.9506, lng: -82.4572, tz: 'America/New_York'
    },
    personB: {
      date: '1985-07-20', time: '08:15',
      lat: 40.7128, lng: -74.0060, tz: 'America/New_York'
    }
  }, false, 'Generate composite chart');

  // Test 9: Rectify
  await testEndpoint('POST', '/api/rectify', {
    approximateBirth: {
      date: '1990-03-15',
      timeRange: { start: '12:00', end: '18:00' },
      lat: 27.9506, lng: -82.4572, tz: 'America/New_York'
    },
    lifeEvents: [
      { date: '2010-06-01', event: 'Graduated college', significance: 'high' }
    ]
  }, false, 'Rectification analysis');

  // Test 10: Cluster create (with auth)
  const clusterRes = await testEndpoint('POST', '/api/cluster/create', {
    name: 'Test Team',
    challenge: 'Testing the system'
  }, token, 'Create cluster');

  // Test 11: Cluster list (with auth)
  await testEndpoint('GET', '/api/cluster/list', null, token, 
    'List clusters');

  // Test 12: SMS subscribe
  await testEndpoint('POST', '/api/sms/subscribe', {
    phoneNumber: '+15555551234'
  }, false, 'SMS subscribe');

  // Print results
  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST RESULTS');
  console.log('='.repeat(60));
  console.log(`✅ PASSED: ${testResults.passed.length}`);
  console.log(`❌ FAILED: ${testResults.failed.length}`);
  console.log(`⚠️  ERRORS: ${testResults.errors.length}`);
  
  if (testResults.failed.length > 0) {
    console.log('\n❌ Failed Tests:');
    testResults.failed.forEach(t => console.log(`  - ${t}`));
  }
  
  if (testResults.errors.length > 0) {
    console.log('\n⚠️  Error Tests:');
    testResults.errors.forEach(t => console.log(`  - ${t}`));
  }
}

async function testEndpoint(method, path, body, authToken, description) {
  const url = API + path;
  const options = {
    method,
    headers: {}
  };

  if (authToken) {
    options.headers['Authorization'] = `Bearer ${authToken}`;
  }

  if (body) {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }

  try {
    console.log(`Testing: ${description}`);
    const response = await fetch(url, options);
    const data = await response.json();

    if (response.ok && !data.error) {
      console.log(`  ✅ PASS (${response.status})`);
      testResults.passed.push(description);
      return data;
    } else {
      console.log(`  ❌ FAIL (${response.status}): ${data.error || 'Unknown error'}`);
      testResults.failed.push(description);
      return null;
    }
  } catch (error) {
    console.log(`  ⚠️  ERROR: ${error.message}`);
    testResults.errors.push(description);
    return null;
  }
}

// Run tests
runTests();
```

---

## 🎯 Manual Testing Checklist

### Daily Smoke Test (5 minutes)
- [ ] Load homepage → ambient art visible
- [ ] Calculate chart with example data → renders correctly
- [ ] Sign in → authentication works
- [ ] Generate profile → synthesis completes
- [ ] Check saved profiles → list loads

### Weekly Full Test (30 minutes)
Run through all UI interactions above, testing:
- Happy paths (expected usage)
- Error cases (invalid inputs)
- Edge cases (boundary conditions)
- Mobile responsiveness

### Pre-Deployment Test (60 minutes)
- [ ] Run automated test script
- [ ] Complete manual checklist
- [ ] Test in multiple browsers
- [ ] Test on mobile devices
- [ ] Verify all error messages are user-friendly
- [ ] Check console for JavaScript errors
- [ ] Verify no 404s or broken resources
- [ ] Test authentication flow completely
- [ ] Verify data persistence (localStorage)

---

## 🔍 Debugging Tools

### Browser DevTools
- **Network Tab** - Monitor API calls, check status codes
- **Console** - Watch for JavaScript errors
- **Application Tab** - Inspect localStorage (token, email)
- **Performance Tab** - Check for slow rendering

### API Testing Tools
- **cURL** - Command-line API testing
- **Postman** - GUI-based API testing
- **HTTPie** - Modern cURL alternative

### Example cURL Tests
```bash
# Test geocode
curl "https://prime-self-api.adrper79.workers.dev/api/geocode?q=Tampa,FL"

# Test chart calculation
curl -X POST https://prime-self-api.adrper79.workers.dev/api/chart/calculate \
  -H "Content-Type: application/json" \
  -d '{"date":"1990-03-15","time":"14:30","lat":27.9506,"lng":-82.4572,"tz":"America/New_York"}'

# Test login
curl -X POST https://prime-self-api.adrper79.workers.dev/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```

---

## 📝 Test Data Sets

### Valid Birth Data Examples
```javascript
const testBirths = [
  { name: 'Tampa', date: '1990-03-15', time: '14:30', lat: 27.9506, lng: -82.4572, tz: 'America/New_York' },
  { name: 'London', date: '1985-07-20', time: '08:15', lat: 51.5074, lng: -0.1278, tz: 'Europe/London' },
  { name: 'Tokyo', date: '1995-12-01', time: '23:45', lat: 35.6762, lng: 139.6503, tz: 'Asia/Tokyo' },
  { name: 'Sydney', date: '1988-06-10', time: '06:00', lat: -33.8688, lng: 151.2093, tz: 'Australia/Sydney' }
];
```

### Invalid Data for Error Testing
```javascript
const invalidInputs = [
  { date: '2030-01-01', reason: 'Future date' },
  { date: '1899-01-01', reason: 'Too old' },
  { time: '25:00', reason: 'Invalid time' },
  { lat: 200, lng: 200, reason: 'Invalid coordinates' },
  { email: 'not-an-email', reason: 'Invalid email format' },
  { phone: 'abc123', reason: 'Invalid phone' }
];
```

---

## 🚀 Next Steps

1. **Run the automated test script** to verify all endpoints
2. **Complete the manual UI checklist** systematically
3. **Document any bugs found** with steps to reproduce
4. **Test on production** before each deployment
5. **Set up monitoring** for API errors and user issues

**Last Updated:** March 5, 2026
