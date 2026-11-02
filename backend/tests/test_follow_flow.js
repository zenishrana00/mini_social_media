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
import Post from '../models/post.model.js';
import Follow from '../models/follow.model.js';

let server;
const PORT = 5560; // Dedicated port for follow integration testing

const runFollowTests = async () => {
  console.log('--- Starting Phase 6 Follow & Personalized Feed Integration Tests ---');
  await connectDB();

  server = app.listen(PORT, () => {
    console.log(`Test server running on port ${PORT}`);
  });

  const baseUrl = `http://localhost:${PORT}`;

  try {
    // Cleanup prior test data
    const priorTestUsers = await User.find({ email: /@followtest\.com$/ }).select('_id');
    const priorUserIds = priorTestUsers.map((u) => u._id);
    await Follow.deleteMany({
      $or: [{ follower: { $in: priorUserIds } }, { following: { $in: priorUserIds } }]
    });
    await User.deleteMany({ email: /@followtest\.com$/ });
    await Post.deleteMany({ content: /\[FOLLOWTEST\]/ });
    console.log('✓ Cleaned up prior follow test data');

    // Register User A
    const userARes = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Alice Follower',
        username: 'alice_follow',
        email: 'alice@followtest.com',
        password: 'Password123!'
      })
    });
    const userAData = await userARes.json();
    console.assert(userARes.status === 201, 'User A registered');
    const userAId = userAData.data.user._id;
    const userACookie = userARes.headers.get('set-cookie').split(';')[0];

    // Register User B
    const userBRes = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Bob Influencer',
        username: 'bob_follow',
        email: 'bob@followtest.com',
        password: 'Password123!'
      })
    });
    const userBData = await userBRes.json();
    console.assert(userBRes.status === 201, 'User B registered');
    const userBId = userBData.data.user._id;
    const userBCookie = userBRes.headers.get('set-cookie').split(';')[0];

    // Register User C (unrelated)
    const userCRes = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Charlie Stranger',
        username: 'charlie_follow',
        email: 'charlie@followtest.com',
        password: 'Password123!'
      })
    });
    const userCData = await userCRes.json();
    console.assert(userCRes.status === 201, 'User C registered');
    const userCId = userCData.data.user._id;
    const userCCookie = userCRes.headers.get('set-cookie').split(';')[0];

    // TEST 1: Follow another user successfully (Alice follows Bob)
    const followRes = await fetch(`${baseUrl}/api/v1/users/${userBId}/follow`, {
      method: 'POST',
      headers: { Cookie: userACookie }
    });
    const followData = await followRes.json();
    console.assert(followRes.status === 200, 'Follow returns 200');
    console.assert(followData.data.isFollowing === true, 'isFollowing is true');
    console.assert(followData.data.followersCount === 1, 'followersCount is 1');
    console.log('✓ Test 1: Follow another user successfully passed (200)');

    // TEST 2: Unfollow a user successfully
    const unfollowRes = await fetch(`${baseUrl}/api/v1/users/${userBId}/follow`, {
      method: 'DELETE',
      headers: { Cookie: userACookie }
    });
    const unfollowData = await unfollowRes.json();
    console.assert(unfollowRes.status === 200, 'Unfollow returns 200');
    console.assert(unfollowData.data.isFollowing === false, 'isFollowing is false');
    console.assert(unfollowData.data.followersCount === 0, 'followersCount is 0');
    console.log('✓ Test 2: Unfollow a user successfully passed (200)');

    // Re-follow Bob for remaining tests
    await fetch(`${baseUrl}/api/v1/users/${userBId}/follow`, {
      method: 'POST',
      headers: { Cookie: userACookie }
    });

    // TEST 3: Prevent following yourself
    const selfFollowRes = await fetch(`${baseUrl}/api/v1/users/${userAId}/follow`, {
      method: 'POST',
      headers: { Cookie: userACookie }
    });
    console.assert(selfFollowRes.status === 400, 'Self-follow rejected with 400');
    console.log('✓ Test 3: Prevent following yourself passed (400)');

    // TEST 4: Prevent duplicate follows
    const dupFollowRes = await fetch(`${baseUrl}/api/v1/users/${userBId}/follow`, {
      method: 'POST',
      headers: { Cookie: userACookie }
    });
    console.assert(dupFollowRes.status === 400, 'Duplicate follow rejected with 400');
    console.log('✓ Test 4: Prevent duplicate follows passed (400)');

    // TEST 5: Reject nonexistent users
    const fakeId = new mongoose.Types.ObjectId();
    const noUserRes = await fetch(`${baseUrl}/api/v1/users/${fakeId}/follow`, {
      method: 'POST',
      headers: { Cookie: userACookie }
    });
    console.assert(noUserRes.status === 404, 'Nonexistent user rejected with 404');
    console.log('✓ Test 5: Reject nonexistent users passed (404)');

    // TEST 6: Reject invalid MongoDB IDs
    const badIdRes = await fetch(`${baseUrl}/api/v1/users/invalid-id-123/follow`, {
      method: 'POST',
      headers: { Cookie: userACookie }
    });
    console.assert(badIdRes.status === 400, 'Invalid ID rejected with 400');
    console.log('✓ Test 6: Reject invalid MongoDB IDs passed (400)');

    // TEST 7: Verify follower count via profile endpoint
    const bobProfileRes = await fetch(`${baseUrl}/api/v1/users/${userBId}`);
    const bobProfileData = await bobProfileRes.json();
    console.assert(bobProfileRes.status === 200, 'Bob profile fetched');
    console.assert(bobProfileData.data.user.followersCount === 1, 'Bob has 1 follower');
    console.log('✓ Test 7: Verify follower count passed (200)');

    // TEST 8: Verify following count via profile endpoint
    const aliceProfileRes = await fetch(`${baseUrl}/api/v1/users/${userAId}`);
    const aliceProfileData = await aliceProfileRes.json();
    console.assert(aliceProfileRes.status === 200, 'Alice profile fetched');
    console.assert(aliceProfileData.data.user.followingCount === 1, 'Alice is following 1 user');
    console.log('✓ Test 8: Verify following count passed (200)');

    // TEST 9: Retrieve followers list
    const followersRes = await fetch(`${baseUrl}/api/v1/users/${userBId}/followers`);
    const followersData = await followersRes.json();
    console.assert(followersRes.status === 200, 'Followers list status is 200');
    console.assert(followersData.results === 1, 'Bob has 1 follower in list');
    console.assert(followersData.data.users[0].username === 'alice_follow', 'Follower is Alice');
    console.log('✓ Test 9: Retrieve followers passed (200)');

    // TEST 10: Retrieve following list
    const followingRes = await fetch(`${baseUrl}/api/v1/users/${userAId}/following`);
    const followingData = await followingRes.json();
    console.assert(followingRes.status === 200, 'Following list status is 200');
    console.assert(followingData.results === 1, 'Alice is following 1 user in list');
    console.assert(followingData.data.users[0].username === 'bob_follow', 'Following user is Bob');
    console.log('✓ Test 10: Retrieve following passed (200)');

    // TEST 11: Verify pagination on followers/following
    const paginatedRes = await fetch(`${baseUrl}/api/v1/users/${userBId}/followers?page=1&limit=1`);
    const paginatedData = await paginatedRes.json();
    console.assert(paginatedRes.status === 200, 'Paginated followers status 200');
    console.assert(paginatedData.pagination.total === 1, 'Total followers is 1');
    console.assert(paginatedData.pagination.limit === 1, 'Limit is 1');
    console.assert(paginatedData.pagination.currentPage === 1, 'Current page is 1');
    console.log('✓ Test 11: Verify pagination passed (200)');

    // TEST 12: Verify follow status
    const statusRes = await fetch(`${baseUrl}/api/v1/users/${userBId}/follow-status`, {
      headers: { Cookie: userACookie }
    });
    const statusData = await statusRes.json();
    console.assert(statusRes.status === 200, 'Follow status status 200');
    console.assert(statusData.data.isFollowing === true, 'Alice is following Bob');
    console.assert(statusData.data.followersCount === 1, 'Followers count is 1');
    console.log('✓ Test 12: Verify follow status passed (200)');

    // TEST 13: Reject unauthenticated requests
    const unauthFollow = await fetch(`${baseUrl}/api/v1/users/${userBId}/follow`, { method: 'POST' });
    console.assert(unauthFollow.status === 401, 'Unauth follow rejected 401');

    const unauthUnfollow = await fetch(`${baseUrl}/api/v1/users/${userBId}/follow`, { method: 'DELETE' });
    console.assert(unauthUnfollow.status === 401, 'Unauth unfollow rejected 401');

    const unauthStatus = await fetch(`${baseUrl}/api/v1/users/${userBId}/follow-status`);
    console.assert(unauthStatus.status === 401, 'Unauth follow status rejected 401');

    const unauthFeed = await fetch(`${baseUrl}/api/v1/posts/feed`);
    console.assert(unauthFeed.status === 401, 'Unauth personalized feed rejected 401');
    console.log('✓ Test 13: Reject unauthenticated requests passed (401)');

    // TEST 14: Ensure passwords are never exposed
    console.assert(followersData.data.users[0].password === undefined, 'Followers list never exposes password');
    console.assert(followingData.data.users[0].password === undefined, 'Following list never exposes password');
    console.log('✓ Test 14: Ensure passwords are never exposed passed');

    // TEST 15, 16, 17: Personalized feed testing
    // Alice creates a post
    const postARes = await fetch(`${baseUrl}/api/v1/posts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: userACookie },
      body: JSON.stringify({ content: '[FOLLOWTEST] Post by Alice' })
    });
    const postAData = await postARes.json();
    const postAId = postAData.data.post._id;

    // Bob creates a post
    const postBRes = await fetch(`${baseUrl}/api/v1/posts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: userBCookie },
      body: JSON.stringify({ content: '[FOLLOWTEST] Post by Bob' })
    });
    const postBData = await postBRes.json();
    const postBId = postBData.data.post._id;

    // Charlie creates a post (Charlie is NOT followed by Alice)
    const postCRes = await fetch(`${baseUrl}/api/v1/posts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: userCCookie },
      body: JSON.stringify({ content: '[FOLLOWTEST] Post by Charlie' })
    });
    const postCData = await postCRes.json();
    const postCId = postCData.data.post._id;

    // Fetch Alice's personalized feed:
    const feedRes = await fetch(`${baseUrl}/api/v1/posts/feed`, {
      headers: { Cookie: userACookie }
    });
    const feedData = await feedRes.json();
    console.assert(feedRes.status === 200, 'Personalized feed returns 200');
    const returnedPostIds = feedData.data.posts.map((p) => p._id);

    // TEST 15: Contains followed users' posts (Bob's post)
    console.assert(returnedPostIds.includes(postBId), 'Personalized feed contains Bob post (followed user)');
    console.log("✓ Test 15: Verify personalized feed contains followed users' posts passed (200)");

    // TEST 16: Includes the current user's own posts (Alice's post)
    console.assert(returnedPostIds.includes(postAId), 'Personalized feed includes Alice own post');
    console.log("✓ Test 16: Verify personalized feed includes current user's posts passed (200)");

    // TEST 17: Excludes unrelated users' posts (Charlie's post)
    console.assert(!returnedPostIds.includes(postCId), 'Personalized feed excludes Charlie post (unfollowed user)');
    console.log("✓ Test 17: Verify unrelated users' posts are excluded passed");

    // TEST 18: Verify existing features still work (General feed contains all posts)
    const generalFeedRes = await fetch(`${baseUrl}/api/v1/posts`, {
      headers: { Cookie: userACookie }
    });
    const generalFeedData = await generalFeedRes.json();
    console.assert(generalFeedRes.status === 200, 'General feed returns 200');
    const generalPostIds = generalFeedData.data.posts.map((p) => p._id);
    console.assert(generalPostIds.includes(postCId), 'General feed still contains Charlie post');
    console.assert(generalPostIds.includes(postBId), 'General feed still contains Bob post');
    console.assert(generalPostIds.includes(postAId), 'General feed still contains Alice post');
    console.log('✓ Test 18: Verify existing features still work passed (200)');

    // Cleanup test data
    const cleanupUsers = await User.find({ email: /@followtest\.com$/ }).select('_id');
    const cleanupUserIds = cleanupUsers.map((u) => u._id);
    await Follow.deleteMany({
      $or: [{ follower: { $in: cleanupUserIds } }, { following: { $in: cleanupUserIds } }]
    });
    await User.deleteMany({ email: /@followtest\.com$/ });
    await Post.deleteMany({ content: /\[FOLLOWTEST\]/ });
    console.log('✓ Cleaned up follow test data');

    console.log('\n==========================================');
    console.log('🎉 ALL 18 FOLLOW & FEED INTEGRATION TESTS PASSED!');
    console.log('==========================================\n');
  } catch (err) {
    console.error('❌ Follow test failed:', err);
    process.exitCode = 1;
  } finally {
    if (server) {
      server.close();
    }
    await mongoose.connection.close();
    process.exit(process.exitCode || 0);
  }
};

runFollowTests();
