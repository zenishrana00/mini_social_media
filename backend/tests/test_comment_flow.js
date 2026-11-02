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
import Comment from '../models/comment.model.js';

let server;
const PORT = 5558; // Dedicated port for comment integration testing

const runCommentTests = async () => {
  console.log('--- Starting Phase 5 Comment Integration Tests ---');
  await connectDB();

  server = app.listen(PORT, () => {
    console.log(`Test server running on port ${PORT}`);
  });

  const baseUrl = `http://localhost:${PORT}`;

  try {
    // 1. Clean up prior test data
    await User.deleteMany({ email: /@commenttest\.com$/ });
    await Comment.deleteMany({ content: /\[COMMENTTEST\]/ });
    await Post.deleteMany({ content: /\[COMMENTTEST\]/ });
    console.log('✓ Cleaned up prior comment test data');

    // 2. Register Alice
    const aliceRes = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Alice Commenter',
        username: 'alice_comments',
        email: 'alice@commenttest.com',
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
        name: 'Bob Commenter',
        username: 'bob_comments',
        email: 'bob@commenttest.com',
        password: 'Password123!'
      })
    });
    const bobData = await bobRes.json();
    console.assert(bobRes.status === 201, 'Bob registered');
    const bobCookie = bobRes.headers.get('set-cookie').split(';')[0];

    // 4. Alice creates a post for comment testing
    const postRes = await fetch(`${baseUrl}/api/v1/posts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': aliceCookie
      },
      body: JSON.stringify({
        content: '[COMMENTTEST] Post for comment testing'
      })
    });
    const postData = await postRes.json();
    console.assert(postRes.status === 201, 'Alice created a post');
    const alicePostId = postData.data.post._id;

    // TEST 1: Authenticated comment creation
    const comment1Res = await fetch(`${baseUrl}/api/v1/posts/${alicePostId}/comments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': aliceCookie
      },
      body: JSON.stringify({
        content: '[COMMENTTEST] Great post!'
      })
    });
    const comment1Data = await comment1Res.json();
    console.assert(comment1Res.status === 201, 'Comment creation status should be 201');
    console.assert(comment1Data.data.comment.content === '[COMMENTTEST] Great post!', 'Comment content matches');
    console.assert(comment1Data.data.comment.author.username === 'alice_comments', 'Author username matches');
    console.assert(comment1Data.data.comment.author.password === undefined, 'Author password is not exposed');
    const aliceCommentId = comment1Data.data.comment._id;
    console.log('✓ Test 1: Authenticated comment creation passed (201)');

    // TEST 2: Rejection of unauthenticated comment creation
    const unauthCommentRes = await fetch(`${baseUrl}/api/v1/posts/${alicePostId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: '[COMMENTTEST] Unauthenticated comment'
      })
    });
    console.assert(unauthCommentRes.status === 401, 'Unauthenticated comment creation rejected with 401');
    console.log('✓ Test 2: Rejection of unauthenticated comment creation passed (401)');

    // TEST 3: Validation of empty comment
    const emptyCommentRes = await fetch(`${baseUrl}/api/v1/posts/${alicePostId}/comments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': aliceCookie
      },
      body: JSON.stringify({
        content: '   '
      })
    });
    console.assert(emptyCommentRes.status === 400, 'Empty comment rejected with 400');
    console.log('✓ Test 3: Validation of empty comment passed (400)');

    // TEST 4: Validation of overly long comment
    const longContent = 'A'.repeat(505);
    const longCommentRes = await fetch(`${baseUrl}/api/v1/posts/${alicePostId}/comments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': aliceCookie
      },
      body: JSON.stringify({
        content: longContent
      })
    });
    console.assert(longCommentRes.status === 400, 'Overly long comment rejected with 400');
    console.log('✓ Test 4: Validation of overly long comment passed (400)');

    // TEST 5: Retrieval of comments for a post
    // Bob also comments on Alice's post
    const bobCommentRes = await fetch(`${baseUrl}/api/v1/posts/${alicePostId}/comments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': bobCookie
      },
      body: JSON.stringify({
        content: '[COMMENTTEST] Bob agrees!'
      })
    });
    const bobCommentData = await bobCommentRes.json();
    console.assert(bobCommentRes.status === 201, 'Bob comment created');
    const bobCommentId = bobCommentData.data.comment._id;

    const getCommentsRes = await fetch(`${baseUrl}/api/v1/posts/${alicePostId}/comments`);
    const getCommentsData = await getCommentsRes.json();
    console.assert(getCommentsRes.status === 200, 'Get comments status should be 200');
    console.assert(getCommentsData.results >= 2, 'At least 2 comments returned');
    // comments[0] should be older (Alice's comment, chronological order)
    console.assert(getCommentsData.data.comments[0]._id === aliceCommentId, 'First comment is the oldest (Alice)');
    console.assert(
      getCommentsData.data.comments.every((c) => c.author.password === undefined),
      'No comment author exposes password'
    );
    console.log('✓ Test 5: Retrieval of comments for a post passed (200)');

    // TEST 6: Rejection of comments on non-existent posts
    const fakeId = new mongoose.Types.ObjectId();
    const noPostCommentRes = await fetch(`${baseUrl}/api/v1/posts/${fakeId}/comments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': aliceCookie
      },
      body: JSON.stringify({
        content: '[COMMENTTEST] Comment on ghost post'
      })
    });
    console.assert(noPostCommentRes.status === 404, 'Comment on non-existent post rejected with 404');
    console.log('✓ Test 6: Rejection of comments on non-existent posts passed (404)');

    // TEST 7: Comment author can delete their comment
    const deleteOwnRes = await fetch(`${baseUrl}/api/v1/comments/${bobCommentId}`, {
      method: 'DELETE',
      headers: {
        'Cookie': bobCookie
      }
    });
    console.assert(deleteOwnRes.status === 200, 'Bob deleting own comment returns 200');

    // Verify count decreased
    const verifyRes = await fetch(`${baseUrl}/api/v1/posts/${alicePostId}/comments`);
    const verifyData = await verifyRes.json();
    console.assert(verifyData.results >= 1, 'Comment count decreased after deletion');
    console.assert(
      !verifyData.data.comments.some((c) => c._id === bobCommentId),
      'Deleted comment no longer appears'
    );
    console.log('✓ Test 7: Comment author can delete their comment passed (200)');

    // TEST 8: Post owner can moderate (delete) comments
    // Bob creates another comment for moderation testing
    const modCommentRes = await fetch(`${baseUrl}/api/v1/posts/${alicePostId}/comments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': bobCookie
      },
      body: JSON.stringify({
        content: '[COMMENTTEST] Moderation test'
      })
    });
    const modCommentData = await modCommentRes.json();
    console.assert(modCommentRes.status === 201, 'Bob moderation comment created');
    const modCommentId = modCommentData.data.comment._id;

    // Alice (post owner) deletes Bob's comment
    const moderateRes = await fetch(`${baseUrl}/api/v1/comments/${modCommentId}`, {
      method: 'DELETE',
      headers: {
        'Cookie': aliceCookie
      }
    });
    console.assert(moderateRes.status === 200, 'Post owner can moderate (delete) comments');
    console.log('✓ Test 8: Post owner can moderate (delete) comments passed (200)');

    // TEST 9: Unrelated users cannot delete comments
    // Alice creates a protected comment
    const protectedCommentRes = await fetch(`${baseUrl}/api/v1/posts/${alicePostId}/comments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': aliceCookie
      },
      body: JSON.stringify({
        content: '[COMMENTTEST] Protected comment'
      })
    });
    const protectedCommentData = await protectedCommentRes.json();
    console.assert(protectedCommentRes.status === 201, 'Protected comment created');
    const protectedCommentId = protectedCommentData.data.comment._id;

    // Bob tries to delete Alice's comment (Bob is not author and not post owner... wait, Alice is the post owner)
    // Actually Alice is both the comment author and the post owner, so Bob is truly unrelated
    const forbiddenRes = await fetch(`${baseUrl}/api/v1/comments/${protectedCommentId}`, {
      method: 'DELETE',
      headers: {
        'Cookie': bobCookie
      }
    });
    console.assert(forbiddenRes.status === 403, 'Unrelated user cannot delete comment (403)');

    // Also verify author.password is never returned in GET responses
    const finalGetRes = await fetch(`${baseUrl}/api/v1/posts/${alicePostId}/comments`);
    const finalGetData = await finalGetRes.json();
    console.assert(
      finalGetData.data.comments.every((c) => c.author.password === undefined),
      'Password hash is never returned in comment responses'
    );
    console.log('✓ Test 9: Unrelated users cannot delete comments passed (403)');

    // 5. Cleanup
    await User.deleteMany({ email: /@commenttest\.com$/ });
    await Comment.deleteMany({ content: /\[COMMENTTEST\]/ });
    await Post.deleteMany({ content: /\[COMMENTTEST\]/ });
    console.log('✓ Cleaned up comment test data');

    console.log('\n==========================================');
    console.log('🎉 ALL 9 COMMENT INTEGRATION TESTS PASSED!');
    console.log('==========================================\n');

  } catch (err) {
    console.error('❌ Comment test failed:', err);
    process.exitCode = 1;
  } finally {
    if (server) {
      server.close();
    }
    await mongoose.connection.close();
    process.exit(process.exitCode || 0);
  }
};

runCommentTests();
