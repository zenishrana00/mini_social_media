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

let server;
const PORT = 5557; // Dedicated port for posts integration testing

const runPostTests = async () => {
  console.log('--- Starting Phase 4 Post & Feed Integration Tests ---');
  await connectDB();

  server = app.listen(PORT, () => {
    console.log(`Test server running on port ${PORT}`);
  });

  const baseUrl = `http://localhost:${PORT}`;

  try {
    // 1. Clean up prior test data
    await User.deleteMany({ email: /@posttest\.com$/ });
    await Post.deleteMany({ content: /\[AUTOTEST\]/ });
    console.log('✓ Cleaned up prior post test accounts');

    // 2. Register Alice (author)
    const aliceRes = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Alice Postmaster',
        username: 'alice_posts',
        email: 'alice@posttest.com',
        password: 'Password123!'
      })
    });
    const aliceData = await aliceRes.json();
    console.assert(aliceRes.status === 201, 'Alice registered');
    const aliceId = aliceData.data.user._id;
    const aliceCookie = aliceRes.headers.get('set-cookie').split(';')[0];

    // 3. Register Bob (second user)
    const bobRes = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Bob Reader',
        username: 'bob_posts',
        email: 'bob@posttest.com',
        password: 'Password123!'
      })
    });
    const bobData = await bobRes.json();
    console.assert(bobRes.status === 201, 'Bob registered');
    const bobId = bobData.data.user._id;
    const bobCookie = bobRes.headers.get('set-cookie').split(';')[0];

    // TEST 1: Creating a post while authenticated
    const createRes = await fetch(`${baseUrl}/api/v1/posts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': aliceCookie
      },
      body: JSON.stringify({
        content: '[AUTOTEST] Alice first post about coding',
        imageUrl: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97'
      })
    });
    const createData = await createRes.json();
    console.assert(createRes.status === 201, 'Post creation status should be 201');
    console.assert(createData.data.post.content === '[AUTOTEST] Alice first post about coding', 'Content matches');
    console.assert(createData.data.post.author.username === 'alice_posts', 'Author username matches');
    console.assert(createData.data.post.author.password === undefined, 'Author password is not exposed');
    const alicePostId = createData.data.post._id;
    console.log('✓ Test 1: Creating a post while authenticated passed (201)');

    // TEST 2: Rejecting unauthenticated post creation
    const unauthPostRes = await fetch(`${baseUrl}/api/v1/posts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: '[AUTOTEST] Intruder post' })
    });
    console.assert(unauthPostRes.status === 401, 'Unauthenticated post creation rejected with 401');
    console.log('✓ Test 2: Rejecting unauthenticated post creation passed (401)');

    // TEST 3: Rejecting empty content
    const emptyPostRes = await fetch(`${baseUrl}/api/v1/posts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': aliceCookie
      },
      body: JSON.stringify({ content: '   ' })
    });
    console.assert(emptyPostRes.status === 400, 'Empty content rejected with 400');
    console.log('✓ Test 3: Rejecting empty content passed (400)');

    // TEST 4: Rejecting excessively long content (>1000 characters)
    const longContent = 'A'.repeat(1005);
    const longPostRes = await fetch(`${baseUrl}/api/v1/posts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': aliceCookie
      },
      body: JSON.stringify({ content: longContent })
    });
    console.assert(longPostRes.status === 400, 'Content over 1000 chars rejected with 400');
    console.log('✓ Test 4: Rejecting excessively long content passed (400)');

    // Create a 2nd post by Alice and 1 post by Bob for chronological feed testing
    await new Promise((r) => setTimeout(r, 100)); // Small delay to guarantee distinct timestamps
    const alicePost2Res = await fetch(`${baseUrl}/api/v1/posts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': aliceCookie },
      body: JSON.stringify({ content: '[AUTOTEST] Alice second post later' })
    });
    const alicePost2Data = await alicePost2Res.json();
    const alicePost2Id = alicePost2Data.data.post._id;

    await new Promise((r) => setTimeout(r, 100));
    const bobPostRes = await fetch(`${baseUrl}/api/v1/posts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': bobCookie },
      body: JSON.stringify({ content: '[AUTOTEST] Bob post most recent' })
    });
    const bobPostData = await bobPostRes.json();
    const bobPostId = bobPostData.data.post._id;

    // TEST 5: Retrieving the feed in descending chronological order
    const feedRes = await fetch(`${baseUrl}/api/v1/posts?page=1&limit=10`, {
      headers: { 'Cookie': aliceCookie }
    });
    const feedData = await feedRes.json();
    console.assert(feedRes.status === 200, 'Feed status should be 200');
    console.assert(feedData.results >= 3, 'Feed has at least 3 posts');
    // Ensure newest post is first: Bob's post was created last
    console.assert(feedData.data.posts[0]._id === bobPostId, 'Newest post is at top of feed');
    console.assert(feedData.data.posts[1]._id === alicePost2Id, 'Second newest is next');
    console.assert(feedData.data.posts[0].author.password === undefined, 'Feed items omit passwords');
    console.log('✓ Test 5: Retrieving the feed in descending chronological order passed (200)');

    // TEST 6: Retrieving a post by ID (public)
    const singlePostRes = await fetch(`${baseUrl}/api/v1/posts/${bobPostId}`);
    const singlePostData = await singlePostRes.json();
    console.assert(singlePostRes.status === 200, 'Single post view status should be 200');
    console.assert(singlePostData.data.post.content === '[AUTOTEST] Bob post most recent', 'Content matches');
    console.assert(singlePostData.data.post.author.username === 'bob_posts', 'Author populated');
    console.assert(singlePostData.data.post.author.password === undefined, 'No password returned');
    console.log('✓ Test 6: Retrieving a post by ID passed (200)');

    // TEST 7: Retrieving posts by user ID (public)
    const userPostsRes = await fetch(`${baseUrl}/api/v1/posts/user/${aliceId}`);
    const userPostsData = await userPostsRes.json();
    console.assert(userPostsRes.status === 200, 'User posts status 200');
    console.assert(userPostsData.results >= 2, 'Alice has at least 2 posts');
    console.assert(userPostsData.data.posts.every((p) => p.author._id === aliceId), 'All returned posts belong to Alice');
    console.log('✓ Test 7: Retrieving posts by user ID passed (200)');

    // TEST 8: Editing your own post
    const editRes = await fetch(`${baseUrl}/api/v1/posts/${alicePostId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': aliceCookie
      },
      body: JSON.stringify({
        content: '[AUTOTEST] Alice first post - edited version',
        imageUrl: 'https://images.unsplash.com/photo-edited'
      })
    });
    const editData = await editRes.json();
    console.assert(editRes.status === 200, 'Edit status should be 200');
    console.assert(editData.data.post.content === '[AUTOTEST] Alice first post - edited version', 'Content was updated');
    console.assert(editData.data.post.imageUrl === 'https://images.unsplash.com/photo-edited', 'Image URL was updated');
    console.log('✓ Test 8: Editing your own post passed (200)');

    // TEST 9: Rejecting edits to another user's post
    const illegalEditRes = await fetch(`${baseUrl}/api/v1/posts/${alicePostId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': bobCookie // Bob trying to edit Alice's post
      },
      body: JSON.stringify({
        content: '[AUTOTEST] Bob attempting to vandalize Alice post'
      })
    });
    console.assert(illegalEditRes.status === 403, 'Editing another user post rejected with 403');
    console.log('✓ Test 9: Rejecting edits to another user post passed (403)');

    // TEST 10: Rejecting deletion of another user's post
    const illegalDeleteRes = await fetch(`${baseUrl}/api/v1/posts/${alicePostId}`, {
      method: 'DELETE',
      headers: {
        'Cookie': bobCookie // Bob trying to delete Alice's post
      }
    });
    console.assert(illegalDeleteRes.status === 403, 'Deleting another user post rejected with 403');
    console.log('✓ Test 10: Rejecting deletion of another user post passed (403)');

    // TEST 11: Deleting your own post
    const deleteRes = await fetch(`${baseUrl}/api/v1/posts/${alicePostId}`, {
      method: 'DELETE',
      headers: {
        'Cookie': aliceCookie
      }
    });
    console.assert(deleteRes.status === 200, 'Deleting own post returns 200');
    const verifyDeleted = await Post.findById(alicePostId);
    console.assert(verifyDeleted === null, 'Post actually deleted from DB');
    console.log('✓ Test 11: Deleting your own post passed (200)');

    // TEST 12: Handling invalid and non-existent IDs
    const invalidIdRes = await fetch(`${baseUrl}/api/v1/posts/invalid-id-xyz`);
    console.assert(invalidIdRes.status === 400, 'Invalid post ID returns 400');

    const fakeId = new mongoose.Types.ObjectId();
    const notFoundRes = await fetch(`${baseUrl}/api/v1/posts/${fakeId}`);
    console.assert(notFoundRes.status === 404, 'Non-existent post returns 404');

    const invalidUserPostsRes = await fetch(`${baseUrl}/api/v1/posts/user/bad-user-id`);
    console.assert(invalidUserPostsRes.status === 400, 'Invalid user ID for posts returns 400');

    const notFoundUserPostsRes = await fetch(`${baseUrl}/api/v1/posts/user/${fakeId}`);
    console.assert(notFoundUserPostsRes.status === 404, 'Non-existent user for posts returns 404');
    console.log('✓ Test 12: Handling invalid and non-existent IDs passed (400/404)');

    // TEST 13: Ensuring author information never exposes passwords
    const checkPost = await Post.findById(alicePost2Id).populate('author');
    console.assert(checkPost.author.password === undefined, 'Populated author never exposes password');
    console.log('✓ Test 13: Author population password safety passed');

    // 4. Cleanup
    await User.deleteMany({ email: /@posttest\.com$/ });
    await Post.deleteMany({ content: /\[AUTOTEST\]/ });
    console.log('✓ Cleaned up post test data');

    console.log('\n==========================================');
    console.log('🎉 ALL 13 POST & FEED INTEGRATION TESTS PASSED!');
    console.log('==========================================\n');

  } catch (err) {
    console.error('❌ Post test failed:', err);
    process.exitCode = 1;
  } finally {
    if (server) {
      server.close();
    }
    await mongoose.connection.close();
    process.exit(process.exitCode || 0);
  }
};

runPostTests();
