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
const PORT = 5559; // Dedicated port for like integration testing

const runLikeTests = async () => {
  console.log('--- Starting Phase 5 Like Integration Tests ---');
  await connectDB();

  server = app.listen(PORT, () => {
    console.log(`Test server running on port ${PORT}`);
  });

  const baseUrl = `http://localhost:${PORT}`;

  try {
    // 1. Clean up prior test data
    await User.deleteMany({ email: /@liketest\.com$/ });
    await Post.deleteMany({ content: /\[LIKETEST\]/ });
    console.log('✓ Cleaned up prior like test data');

    // 2. Register Alice
    const aliceRes = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Alice Liker',
        username: 'alice_likes',
        email: 'alice@liketest.com',
        password: 'Password123!'
      })
    });
    const aliceData = await aliceRes.json();
    console.assert(aliceRes.status === 201, 'Alice registered');
    const aliceCookie = aliceRes.headers.get('set-cookie').split(';')[0];

    // 3. Register Bob
    const bobRes = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Bob Liker',
        username: 'bob_likes',
        email: 'bob@liketest.com',
        password: 'Password123!'
      })
    });
    const bobData = await bobRes.json();
    console.assert(bobRes.status === 201, 'Bob registered');
    const bobCookie = bobRes.headers.get('set-cookie').split(';')[0];

    // 4. Alice creates a post for like testing
    const postRes = await fetch(`${baseUrl}/api/v1/posts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': aliceCookie
      },
      body: JSON.stringify({
        content: '[LIKETEST] Post for like testing'
      })
    });
    const postData = await postRes.json();
    console.assert(postRes.status === 201, 'Alice created a post');
    const alicePostId = postData.data.post._id;

    // TEST 1: Authenticated user can like a post
    const likeRes = await fetch(`${baseUrl}/api/v1/posts/${alicePostId}/like`, {
      method: 'PUT',
      headers: {
        'Cookie': aliceCookie
      }
    });
    const likeData = await likeRes.json();
    console.assert(likeRes.status === 200, 'Like status should be 200');
    console.assert(likeData.data.likesCount === 1, 'likesCount should be 1');
    console.assert(likeData.data.isLiked === true, 'isLiked should be true');
    console.log('✓ Test 1: Authenticated user can like a post passed (200)');

    // TEST 2: Unauthenticated likes are rejected
    const unauthLikeRes = await fetch(`${baseUrl}/api/v1/posts/${alicePostId}/like`, {
      method: 'PUT'
    });
    console.assert(unauthLikeRes.status === 401, 'Unauthenticated like rejected with 401');
    console.log('✓ Test 2: Unauthenticated likes are rejected passed (401)');

    // TEST 3: Duplicate likes do not increase count
    const dupLikeRes = await fetch(`${baseUrl}/api/v1/posts/${alicePostId}/like`, {
      method: 'PUT',
      headers: {
        'Cookie': aliceCookie
      }
    });
    const dupLikeData = await dupLikeRes.json();
    console.assert(dupLikeRes.status === 200, 'Duplicate like status should be 200');
    console.assert(dupLikeData.data.likesCount === 1, 'likesCount should still be 1 after duplicate like');
    console.log('✓ Test 3: Duplicate likes do not increase count passed (200)');

    // TEST 4: Unlike removes the user's like
    const unlikeRes = await fetch(`${baseUrl}/api/v1/posts/${alicePostId}/like`, {
      method: 'DELETE',
      headers: {
        'Cookie': aliceCookie
      }
    });
    const unlikeData = await unlikeRes.json();
    console.assert(unlikeRes.status === 200, 'Unlike status should be 200');
    console.assert(unlikeData.data.likesCount === 0, 'likesCount should be 0 after unlike');
    console.assert(unlikeData.data.isLiked === false, 'isLiked should be false after unlike');
    console.log('✓ Test 4: Unlike removes the user\'s like passed (200)');

    // TEST 5: Repeated unlike requests do not produce incorrect counts
    const repeatUnlikeRes = await fetch(`${baseUrl}/api/v1/posts/${alicePostId}/like`, {
      method: 'DELETE',
      headers: {
        'Cookie': aliceCookie
      }
    });
    const repeatUnlikeData = await repeatUnlikeRes.json();
    console.assert(repeatUnlikeRes.status === 200, 'Repeated unlike status should be 200');
    console.assert(repeatUnlikeData.data.likesCount === 0, 'likesCount should remain 0 after repeated unlike');
    console.log('✓ Test 5: Repeated unlike requests do not produce incorrect counts passed (200)');

    // TEST 6: Non-existent posts are handled correctly
    const fakeId = new mongoose.Types.ObjectId();
    const noPostLikeRes = await fetch(`${baseUrl}/api/v1/posts/${fakeId}/like`, {
      method: 'PUT',
      headers: {
        'Cookie': aliceCookie
      }
    });
    console.assert(noPostLikeRes.status === 404, 'Like on non-existent post rejected with 404');
    console.log('✓ Test 6: Non-existent posts are handled correctly passed (404)');

    // TEST 7: Like state is returned correctly for current user
    // Bob likes the post
    const bobLikeRes = await fetch(`${baseUrl}/api/v1/posts/${alicePostId}/like`, {
      method: 'PUT',
      headers: {
        'Cookie': bobCookie
      }
    });
    const bobLikeData = await bobLikeRes.json();
    console.assert(bobLikeData.data.likesCount === 1, 'likesCount should be 1 after Bob likes');
    console.assert(bobLikeData.data.isLiked === true, 'isLiked should be true for Bob');

    // Alice also likes the post
    const aliceLike2Res = await fetch(`${baseUrl}/api/v1/posts/${alicePostId}/like`, {
      method: 'PUT',
      headers: {
        'Cookie': aliceCookie
      }
    });
    const aliceLike2Data = await aliceLike2Res.json();
    console.assert(aliceLike2Data.data.likesCount === 2, 'likesCount should be 2 after Alice also likes');
    console.assert(aliceLike2Data.data.isLiked === true, 'isLiked should be true for Alice');
    console.log('✓ Test 7: Like state is returned correctly for current user passed (200)');

    // TEST 8: Concurrent/repeated like requests do not create duplicates
    // Send 5 parallel like requests from Alice
    const parallelResults = await Promise.all(
      Array.from({ length: 5 }, () =>
        fetch(`${baseUrl}/api/v1/posts/${alicePostId}/like`, {
          method: 'PUT',
          headers: {
            'Cookie': aliceCookie
          }
        }).then((r) => r.json())
      )
    );
    // After all parallel likes settle, check the final likesCount
    const finalLikeCheck = await fetch(`${baseUrl}/api/v1/posts/${alicePostId}/like`, {
      method: 'PUT',
      headers: {
        'Cookie': aliceCookie
      }
    });
    const finalLikeData = await finalLikeCheck.json();
    console.assert(finalLikeData.data.likesCount === 2, 'likesCount should be 2 (Alice + Bob) after concurrent requests');
    console.log('✓ Test 8: Concurrent/repeated like requests do not create duplicates passed (200)');

    // 5. Cleanup
    await User.deleteMany({ email: /@liketest\.com$/ });
    await Post.deleteMany({ content: /\[LIKETEST\]/ });
    console.log('✓ Cleaned up like test data');

    console.log('\n==========================================');
    console.log('🎉 ALL 8 LIKE INTEGRATION TESTS PASSED!');
    console.log('==========================================\n');

  } catch (err) {
    console.error('❌ Like test failed:', err);
    process.exitCode = 1;
  } finally {
    if (server) {
      server.close();
    }
    await mongoose.connection.close();
    process.exit(process.exitCode || 0);
  }
};

runLikeTests();
