// Test actual HTTP login endpoint
// Run this while your backend server is running

const testHttpLogin = async () => {
  const baseUrl = process.env.API_URL || 'http://localhost:5000';
  const endpoint = `${baseUrl}/api/auth/login`;

  const testCases = [
    { email: 'admin@test.com', password: 'password123', expected: true },
    { email: 'user@test.com', password: 'password123', expected: true },
    { email: 'admin@test.com', password: 'wrongpassword', expected: false },
  ];

  console.log('═══════════════════════════════════════════════════════');
  console.log('🧪 TESTING HTTP LOGIN ENDPOINT');
  console.log(`📍 Endpoint: ${endpoint}`);
  console.log('═══════════════════════════════════════════════════════\n');

  for (const testCase of testCases) {
    console.log(`\n📧 Testing: ${testCase.email} / ${testCase.password}`);
    console.log('─────────────────────────────────────────────────────');

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: testCase.email,
          password: testCase.password,
        }),
      });

      const data = await response.json();

      console.log(`Status: ${response.status}`);
      console.log(`Response:`, JSON.stringify(data, null, 2));

      if (response.ok && testCase.expected) {
        console.log('✅ LOGIN SUCCESS (as expected)');
      } else if (!response.ok && !testCase.expected) {
        console.log('✅ LOGIN FAILED (as expected)');
      } else if (response.ok && !testCase.expected) {
        console.log('❌ UNEXPECTED SUCCESS');
      } else {
        console.log('❌ UNEXPECTED FAILURE');
        console.log('   Expected success but got:', data.message || data.error);
      }
    } catch (error) {
      console.error('❌ REQUEST ERROR:');
      console.error('   Make sure your backend server is running!');
      console.error('   Error:', error.message);
      
      if (error.message.includes('fetch')) {
        console.error('\n💡 TIP: Start your backend server first:');
        console.error('   cd backend');
        console.error('   npm start');
      }
      break;
    }
  }
};

// Check if fetch is available (Node 18+)
if (typeof fetch === 'undefined') {
  console.error('❌ This script requires Node.js 18+ or install node-fetch');
  console.error('   Alternatively, use curl or Postman to test');
  process.exit(1);
}

testHttpLogin().catch(console.error);

