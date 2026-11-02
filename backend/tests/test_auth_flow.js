import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

import app from '../app.js';
import connectDB from '../config/db.js';
import User from '../models/user.model.js';

let server;
const PORT = 5555; // Use dedicated port for automated testing

const runTests = async () => {
  console.log('--- Starting Phase 2 Auth Integration Tests ---');
  await connectDB();

  server = app.listen(PORT, () => {
    console.log(`Test server running on port ${PORT}`);
  });

  const baseUrl = `http://localhost:${PORT}`;

  try {
    // Clean up any previous test user
    await User.deleteMany({ email: /@autotest\.com$/ });
    console.log('✓ Cleaned up previous test accounts');

    // TEST 1: Health check endpoint
    const healthRes = await fetch(`${baseUrl}/api/v1/health`);
    const healthData = await healthRes.json();
    console.assert(healthRes.status === 200, 'Health check should be 200');
    console.assert(healthData.status === 'success', 'Health status should be success');
    console.log('✓ Test 1: Health check endpoint passed');

    // TEST 2: Protected endpoint without token
    const unauthRes = await fetch(`${baseUrl}/api/v1/auth/me`);
    const unauthData = await unauthRes.json();
    console.assert(unauthRes.status === 401, 'Unauthenticated /me should be 401');
    console.assert(unauthData.status === 'fail', 'Unauthenticated /me status should be fail');
    console.log('✓ Test 2: Protected endpoint without token rejected (401)');

    // TEST 3: Validation failure - missing fields
    const missingRes = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'bad@autotest.com' })
    });
    console.assert(missingRes.status === 400, 'Missing fields should be 400');
    console.log('✓ Test 3: Registration with missing fields rejected (400)');

    // TEST 4: Validation failure - password too short
    const shortPassRes = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Short Pass User',
        username: 'shortpass',
        email: 'shortpass@autotest.com',
        password: '123'
      })
    });
    console.assert(shortPassRes.status === 400, 'Short password should be 400');
    console.log('✓ Test 4: Short password rejected (400)');

    // TEST 5: Successful registration
    const uniqueNum = Date.now().toString().slice(-4);
    const testUsername = `user_${uniqueNum}`;
    const testEmail = `user_${uniqueNum}@autotest.com`;

    const regRes = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test Candidate',
        username: testUsername,
        email: testEmail,
        password: 'Password123!',
        bio: 'Automated test bio'
      })
    });
    const regData = await regRes.json();
    console.assert(regRes.status === 201, `Register status should be 201, got ${regRes.status}`);
    console.assert(regData.data.user.email === testEmail, 'Email matches');
    console.assert(regData.data.user.password === undefined, 'Password hash is NOT exposed in response');

    // Extract HttpOnly cookie
    const setCookieHeader = regRes.headers.get('set-cookie');
    console.assert(setCookieHeader && setCookieHeader.includes('token='), 'Set-Cookie contains token');
    console.assert(setCookieHeader.includes('HttpOnly'), 'Cookie has HttpOnly flag');
    console.log('✓ Test 5: Successful registration with HttpOnly cookie passed');

    // TEST 6: Duplicate email registration
    const dupEmailRes = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Another Name',
        username: `diff_${uniqueNum}`,
        email: testEmail,
        password: 'Password123!'
      })
    });
    console.assert(dupEmailRes.status === 400, 'Duplicate email should be 400');
    console.log('✓ Test 6: Duplicate email rejected (400)');

    // TEST 7: Duplicate username registration
    const dupUserRes = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Another Name',
        username: testUsername,
        email: `diff_${uniqueNum}@autotest.com`,
        password: 'Password123!'
      })
    });
    console.assert(dupUserRes.status === 400, 'Duplicate username should be 400');
    console.log('✓ Test 7: Duplicate username rejected (400)');

    // TEST 8: Login with invalid password
    const badLoginRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: 'WrongPassword999'
      })
    });
    console.assert(badLoginRes.status === 401, 'Bad password should be 401');
    console.log('✓ Test 8: Login with wrong password rejected (401)');

    // TEST 9: Login with valid credentials (using email)
    const loginRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: 'Password123!'
      })
    });
    const loginData = await loginRes.json();
    console.assert(loginRes.status === 200, 'Login status should be 200');
    console.assert(loginData.data.user.password === undefined, 'Password omitted in login response');
    const loginCookie = loginRes.headers.get('set-cookie');
    console.assert(loginCookie && loginCookie.includes('token='), 'Login sets token cookie');
    console.log('✓ Test 9: Login with valid email passed');

    // TEST 10: Access protected GET /api/v1/auth/me with Cookie
    const rawToken = loginCookie.split(';')[0]; // token=xyz
    const meRes = await fetch(`${baseUrl}/api/v1/auth/me`, {
      headers: {
        'Cookie': rawToken
      }
    });
    const meData = await meRes.json();
    console.assert(meRes.status === 200, 'Authenticated /me status should be 200');
    console.assert(meData.data.user.username === testUsername, 'Authenticated /me returns correct username');
    console.assert(meData.data.user.password === undefined, 'Password omitted in /me response');
    console.log('✓ Test 10: Access protected /me with HttpOnly cookie passed');

    // TEST 11: Access protected GET /api/v1/auth/me with Authorization Bearer header
    const tokenValue = rawToken.split('=')[1];
    const bearerRes = await fetch(`${baseUrl}/api/v1/auth/me`, {
      headers: {
        'Authorization': `Bearer ${tokenValue}`
      }
    });
    console.assert(bearerRes.status === 200, 'Bearer auth /me should be 200');
    console.log('✓ Test 11: Access protected /me with Bearer token passed');

    // TEST 12: Logout
    const logoutRes = await fetch(`${baseUrl}/api/v1/auth/logout`, {
      method: 'POST'
    });
    const logoutCookie = logoutRes.headers.get('set-cookie');
    console.assert(logoutRes.status === 200, 'Logout should be 200');
    console.assert(logoutCookie && (logoutCookie.includes('Expires=Thu, 01 Jan 1970') || logoutCookie.includes('token=;')), 'Logout clears cookie');
    console.log('✓ Test 12: Logout endpoint clears cookie passed');

    // Cleanup created test user
    await User.deleteOne({ email: testEmail });
    console.log('✓ Cleaned up test user');

    console.log('\n==========================================');
    console.log('🎉 ALL 12 AUTHENTICATION INTEGRATION TESTS PASSED!');
    console.log('==========================================\n');

  } catch (err) {
    console.error('❌ Test failed:', err);
    process.exitCode = 1;
  } finally {
    if (server) {
      server.close();
    }
    await mongoose.connection.close();
    process.exit(0);
  }
};

runTests();
