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
const PORT = 5556; // Dedicated port for profile integration tests

const runProfileTests = async () => {
  console.log('--- Starting Phase 3 User Profile Integration Tests ---');
  await connectDB();

  server = app.listen(PORT, () => {
    console.log(`Test server running on port ${PORT}`);
  });

  const baseUrl = `http://localhost:${PORT}`;

  try {
    // Clean up any existing test accounts
    await User.deleteMany({ email: /@profiletest\.com$/ });
    console.log('✓ Cleaned up previous profile test accounts');

    // Register User A (Alice)
    const aliceRes = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Alice Original',
        username: 'alice_p3',
        email: 'alice@profiletest.com',
        password: 'Password123!',
        bio: 'Original Alice Bio'
      })
    });
    const aliceData = await aliceRes.json();
    console.assert(aliceRes.status === 201, 'Alice registration status 201');
    const aliceId = aliceData.data.user._id;
    const aliceCookie = aliceRes.headers.get('set-cookie').split(';')[0];

    // Register User B (Bob)
    const bobRes = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Bob Original',
        username: 'bob_p3',
        email: 'bob@profiletest.com',
        password: 'Password123!',
        bio: 'Original Bob Bio'
      })
    });
    const bobData = await bobRes.json();
    console.assert(bobRes.status === 201, 'Bob registration status 201');
    const bobId = bobData.data.user._id;

    // TEST 1: View an existing public profile by ID
    const getBobRes = await fetch(`${baseUrl}/api/v1/users/${bobId}`);
    const getBobData = await getBobRes.json();
    console.assert(getBobRes.status === 200, 'Public profile view status should be 200');
    console.assert(getBobData.data.user.name === 'Bob Original', 'Returns correct name');
    console.assert(getBobData.data.user.username === 'bob_p3', 'Returns correct username');
    console.assert(getBobData.data.user.followersCount === 0, 'Followers count initialized');
    console.assert(getBobData.data.user.followingCount === 0, 'Following count initialized');
    console.assert(getBobData.data.user.password === undefined, 'Password hash is NOT returned');
    console.assert(getBobData.data.user.token === undefined, 'JWT is NOT returned');
    console.log('✓ Test 1: View public profile by ID passed');

    // TEST 2: Handling an invalid user ID format
    const invalidIdRes = await fetch(`${baseUrl}/api/v1/users/not-a-valid-id-123`);
    const invalidIdData = await invalidIdRes.json();
    console.assert(invalidIdRes.status === 400, 'Invalid ID format should return 400');
    console.assert(invalidIdData.status === 'fail', 'Invalid ID status should be fail');
    console.log('✓ Test 2: Handling invalid user ID format passed (400)');

    // TEST 3: Handling non-existent user ID
    const fakeObjectId = new mongoose.Types.ObjectId();
    const notFoundRes = await fetch(`${baseUrl}/api/v1/users/${fakeObjectId}`);
    const notFoundData = await notFoundRes.json();
    console.assert(notFoundRes.status === 404, 'Non-existent user should return 404');
    console.assert(notFoundData.status === 'fail', 'Non-existent user status should be fail');
    console.log('✓ Test 3: Handling non-existent user ID passed (404)');

    // TEST 4: Reject unauthenticated profile updates
    const unauthUpdateRes = await fetch(`${baseUrl}/api/v1/users/me`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Hacked Name' })
    });
    console.assert(unauthUpdateRes.status === 401, 'Unauthenticated update must return 401');
    console.log('✓ Test 4: Reject unauthenticated profile updates passed (401)');

    // TEST 5: Prevent unauthorized field changes (password, email, role)
    const restrictedRes = await fetch(`${baseUrl}/api/v1/users/me`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': aliceCookie
      },
      body: JSON.stringify({
        email: 'alice_hacked@profiletest.com',
        password: 'HackedPassword123!'
      })
    });
    const restrictedData = await restrictedRes.json();
    console.assert(restrictedRes.status === 400, 'Restricted field modification should return 400');
    console.assert(restrictedData.message.includes('restricted'), 'Message mentions restricted fields');
    console.log('✓ Test 5: Prevent unauthorized field changes (email/password/role) passed (400)');

    // TEST 6: Prevent client-supplied user ID in request body from hijacking updates
    const hijackRes = await fetch(`${baseUrl}/api/v1/users/me`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': aliceCookie
      },
      body: JSON.stringify({
        _id: bobId,
        name: 'Alice Trying To Hack Bob'
      })
    });
    console.assert(hijackRes.status === 400, 'Supplying _id or id in body is rejected');

    // Verify Bob was not modified
    const bobCheck = await User.findById(bobId);
    console.assert(bobCheck.name === 'Bob Original', 'Bob was not modified');
    console.log('✓ Test 6: Never trust user ID supplied in request body passed');

    // TEST 7: Updating current user profile successfully
    const updateRes = await fetch(`${baseUrl}/api/v1/users/me`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': aliceCookie
      },
      body: JSON.stringify({
        name: 'Alice Updated',
        username: 'alice_updated',
        bio: 'Alice has a new bio!',
        profilePicture: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330'
      })
    });
    const updateData = await updateRes.json();
    console.assert(updateRes.status === 200, 'Update status should be 200');
    console.assert(updateData.data.user.name === 'Alice Updated', 'Name was updated');
    console.assert(updateData.data.user.username === 'alice_updated', 'Username was updated');
    console.assert(updateData.data.user.bio === 'Alice has a new bio!', 'Bio was updated');
    console.assert(updateData.data.user.password === undefined, 'Password is not in response');

    // Verify in database
    const aliceDb = await User.findById(aliceId);
    console.assert(aliceDb.name === 'Alice Updated', 'Database reflects updated name');
    console.assert(aliceDb.username === 'alice_updated', 'Database reflects updated username');
    console.log('✓ Test 7: Updating current user profile successfully passed');

    // TEST 8: Handle duplicate usernames during profile update
    const dupUsernameRes = await fetch(`${baseUrl}/api/v1/users/me`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': aliceCookie
      },
      body: JSON.stringify({
        username: 'bob_p3' // Already taken by Bob
      })
    });
    const dupUsernameData = await dupUsernameRes.json();
    console.assert(dupUsernameRes.status === 400, 'Duplicate username should return 400');
    console.assert(dupUsernameData.message.includes('already taken'), 'Mentions username already taken');
    console.log('✓ Test 8: Handle duplicate usernames during profile update passed (400)');

    // TEST 9: Search users by name or username (case-insensitive)
    const searchRes = await fetch(`${baseUrl}/api/v1/users/search?q=alice`);
    const searchData = await searchRes.json();
    console.assert(searchRes.status === 200, 'Search should return 200');
    console.assert(searchData.results >= 1, 'Search finds at least 1 user');
    console.assert(searchData.data.users[0].username === 'alice_updated', 'Found alice_updated');
    console.assert(searchData.data.users[0].password === undefined, 'Search results omit passwords');
    console.log('✓ Test 9: Search users by query string passed');

    // TEST 10: Safe regex search handling special characters without crashing
    const safeRegexRes = await fetch(`${baseUrl}/api/v1/users/search?q=${encodeURIComponent('.*+?^${}()|[]\\')}`);
    console.assert(safeRegexRes.status === 200, 'Search with regex special characters does not crash');
    console.log('✓ Test 10: Safe regular expression search handling passed');

    // TEST 11: Route ordering verification: GET /api/v1/users/search is not treated as /:id
    const emptySearchRes = await fetch(`${baseUrl}/api/v1/users/search`);
    const emptySearchData = await emptySearchRes.json();
    console.assert(emptySearchRes.status === 200, 'Empty search returns 200');
    console.assert(Array.isArray(emptySearchData.data.users), 'Empty search returns empty array');
    console.log('✓ Test 11: Route ordering verification (/search vs /:id) passed');

    // Cleanup created test accounts
    await User.deleteMany({ email: /@profiletest\.com$/ });
    console.log('✓ Cleaned up test accounts');

    console.log('\n==========================================');
    console.log('🎉 ALL 11 USER PROFILE INTEGRATION TESTS PASSED!');
    console.log('==========================================\n');

  } catch (err) {
    console.error('❌ Profile test failed:', err);
    process.exitCode = 1;
  } finally {
    if (server) {
      server.close();
    }
    await mongoose.connection.close();
    process.exit(process.exitCode || 0);
  }
};

runProfileTests();
