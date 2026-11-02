/**
 * Mini Social Media Platform - Vanilla JavaScript
 * Handles API health checks, authentication state, user profiles, posts, feed, search, and modal interactions.
 */

document.addEventListener('DOMContentLoaded', async () => {
  console.log('[App] Mini Social Media Platform initialized.');

  // 1. Check API health if health status container is present
  const healthStatusEl = document.getElementById('api-health-status');
  if (healthStatusEl) {
    checkApiHealth(healthStatusEl);
  }

  // 2. Synchronize navigation bar based on active authentication state
  const currentUser = await fetchCurrentUser();
  updateNavbarAuth(currentUser);

  // 3. Initialize user search if search input is present
  initUserSearch();

  // 4. Initialize Home Feed & Post Creator (on index.html)
  initFeedPage(currentUser);

  // 5. Initialize Page-specific handlers
  initRegisterForm();
  initLoginForm();
  initProfilePage(currentUser);
});

/* ==========================================================================
   API Connectivity & Authentication State Helpers
   ========================================================================== */

/**
 * Pings the backend health-check API endpoint
 * @param {HTMLElement} displayElement - DOM element to render health info
 */
async function checkApiHealth(displayElement) {
  try {
    const response = await fetch('/api/v1/health', { credentials: 'include' });
    const data = await response.json();

    if (response.ok && data.status === 'success') {
      displayElement.innerHTML = `
        <span class="status-badge">
          <span class="status-dot"></span>
          Backend API Online (${escapeHtml(data.environment)})
        </span>
      `;
    } else {
      throw new Error(data.message || 'Health check returned non-success');
    }
  } catch (error) {
    console.error('[Health Check Failed]:', error);
    displayElement.innerHTML = `
      <span class="status-badge" style="background-color: #fef2f2; color: #991b1b; border-color: #fecaca;">
        <span class="status-dot" style="background-color: #ef4444;"></span>
        Backend API Offline
      </span>
    `;
  }
}

/**
 * Fetches the currently authenticated user from GET /api/v1/auth/me
 * @returns {Promise<Object|null>} - Authenticated user object or null
 */
async function fetchCurrentUser() {
  try {
    const response = await fetch('/api/v1/auth/me', {
      method: 'GET',
      credentials: 'include' // Sends HttpOnly cookie with request
    });

    if (response.ok) {
      const result = await response.json();
      return result.data.user;
    }
    return null;
  } catch (error) {
    console.warn('[Auth State] Could not retrieve session:', error.message);
    return null;
  }
}

/**
 * Updates navbar links dynamically based on login status
 * @param {Object|null} user - Currently logged-in user or null
 */
function updateNavbarAuth(user) {
  const navLinksContainer = document.querySelector('.nav-links');
  if (!navLinksContainer) return;

  const currentPath = window.location.pathname;

  if (user) {
    navLinksContainer.innerHTML = `
      <li><a href="/" class="${currentPath === '/' ? 'active' : ''}">Home</a></li>
      <li><a href="/profile" id="nav-profile-link" class="${currentPath === '/profile' && !window.location.search ? 'active' : ''}">@${escapeHtml(user.username)}</a></li>
      <li><button id="nav-logout-btn" class="btn btn-outline btn-sm" style="cursor: pointer;">Logout</button></li>
    `;

    const navLogoutBtn = document.getElementById('nav-logout-btn');
    if (navLogoutBtn) {
      navLogoutBtn.addEventListener('click', handleLogout);
    }
  } else {
    navLinksContainer.innerHTML = `
      <li><a href="/" class="${currentPath === '/' ? 'active' : ''}">Home</a></li>
      <li><a href="/login" class="${currentPath === '/login' ? 'active' : ''}">Login</a></li>
      <li><a href="/register" class="${currentPath === '/register' ? 'active' : ''}">Register</a></li>
    `;
  }
}

/* ==========================================================================
   User Search Functionality (Phase 3)
   ========================================================================== */

function initUserSearch() {
  const searchInput = document.getElementById('user-search-input');
  const resultsContainer = document.getElementById('search-results-list');
  if (!searchInput || !resultsContainer) return;

  let debounceTimer = null;

  searchInput.addEventListener('input', (e) => {
    const query = e.target.value.trim();
    clearTimeout(debounceTimer);

    if (!query) {
      resultsContainer.style.display = 'none';
      resultsContainer.innerHTML = '';
      return;
    }

    resultsContainer.style.display = 'block';
    resultsContainer.innerHTML = `<div class="search-empty-state">Searching for "${escapeHtml(query)}"...</div>`;

    debounceTimer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/v1/users/search?q=${encodeURIComponent(query)}`, {
          credentials: 'include'
        });
        const data = await response.json();

        if (response.ok && data.status === 'success') {
          renderSearchResults(data.data.users, query, resultsContainer);
        } else {
          resultsContainer.innerHTML = `<div class="search-empty-state">Failed to search users.</div>`;
        }
      } catch (err) {
        console.error('[Search Error]:', err);
        resultsContainer.innerHTML = `<div class="search-empty-state">Error connecting to server.</div>`;
      }
    }, 300);
  });

  document.addEventListener('click', (e) => {
    if (!searchInput.contains(e.target) && !resultsContainer.contains(e.target)) {
      resultsContainer.style.display = 'none';
    }
  });

  searchInput.addEventListener('focus', () => {
    if (searchInput.value.trim() && resultsContainer.children.length > 0) {
      resultsContainer.style.display = 'block';
    }
  });
}

function renderSearchResults(users, query, container) {
  if (!users || users.length === 0) {
    container.innerHTML = `<div class="search-empty-state">No users found matching "<strong>${escapeHtml(query)}</strong>"</div>`;
    return;
  }

  container.innerHTML = '';

  users.forEach((user) => {
    const item = document.createElement('a');
    item.href = `/profile?id=${user._id}`;
    item.className = 'search-result-item';

    const avatar = document.createElement('div');
    avatar.className = 'search-result-avatar';
    if (user.profilePicture) {
      const img = document.createElement('img');
      img.src = user.profilePicture;
      img.alt = user.name || 'User';
      img.style.width = '100%';
      img.style.height = '100%';
      img.style.objectFit = 'cover';
      img.onerror = () => {
        avatar.textContent = user.name ? user.name.charAt(0).toUpperCase() : '👤';
      };
      avatar.appendChild(img);
    } else {
      avatar.textContent = user.name ? user.name.charAt(0).toUpperCase() : '👤';
    }

    const info = document.createElement('div');
    info.className = 'search-result-info';

    const name = document.createElement('div');
    name.className = 'search-result-name';
    name.textContent = user.name || 'Anonymous';

    const username = document.createElement('div');
    username.className = 'search-result-username';
    username.textContent = `@${user.username}`;

    info.appendChild(name);
    info.appendChild(username);

    item.appendChild(avatar);
    item.appendChild(info);
    container.appendChild(item);
  });
}

/* ==========================================================================
   Home Feed & Post Management (Phase 4)
   ========================================================================== */

let feedCurrentPage = 1;
let feedHasMore = false;
let isFeedLoading = false;
let currentFeedTab = 'community'; // 'community' or 'following'

/**
 * Initializes the home feed page (index.html)
 * @param {Object|null} currentUser - Authenticated user or null
 */
function initFeedPage(currentUser) {
  const feedContainer = document.getElementById('feed-posts-container');
  if (!feedContainer) return;

  const createPostCard = document.getElementById('create-post-card');
  const guestWelcomeCard = document.getElementById('guest-welcome-card');
  const loadMoreBtn = document.getElementById('load-more-posts-btn');
  const feedTabs = document.getElementById('feed-tabs');
  const tabCommunity = document.getElementById('tab-community-feed');
  const tabFollowing = document.getElementById('tab-following-feed');
  const feedTitleText = document.getElementById('feed-title-text');

  // Modal dialog initialization for editing and deleting posts
  initEditPostModal();
  initDeletePostModal();

  if (currentUser) {
    if (createPostCard) createPostCard.style.display = 'block';
    if (guestWelcomeCard) guestWelcomeCard.style.display = 'none';
    if (feedTabs) feedTabs.style.display = 'flex';

    // Tab switching handlers
    if (tabCommunity && tabFollowing) {
      tabCommunity.addEventListener('click', () => {
        if (currentFeedTab === 'community') return;
        currentFeedTab = 'community';
        tabCommunity.classList.add('active');
        tabFollowing.classList.remove('active');
        if (feedTitleText) feedTitleText.textContent = 'Community Feed';
        fetchFeedPosts(1, false, currentUser);
      });

      tabFollowing.addEventListener('click', () => {
        if (currentFeedTab === 'following') return;
        currentFeedTab = 'following';
        tabFollowing.classList.add('active');
        tabCommunity.classList.remove('active');
        if (feedTitleText) feedTitleText.textContent = 'Following Feed';
        fetchFeedPosts(1, false, currentUser);
      });
    }

    // Set up post creation form
    initCreatePostForm(currentUser);

    // Fetch initial feed posts (page 1)
    fetchFeedPosts(1, false, currentUser);

    // Set up load more button
    if (loadMoreBtn) {
      loadMoreBtn.addEventListener('click', () => {
        if (!isFeedLoading && feedHasMore) {
          fetchFeedPosts(feedCurrentPage + 1, true, currentUser);
        }
      });
    }
  } else {
    // Guest view: show welcome card with login/register links
    if (createPostCard) createPostCard.style.display = 'none';
    if (guestWelcomeCard) guestWelcomeCard.style.display = 'block';
    if (feedTabs) feedTabs.style.display = 'none';

    feedContainer.innerHTML = `
      <div class="feed-empty-state">
        <h3>Community Feed</h3>
        <p>Please <a href="/login" style="color: var(--primary-color); font-weight: 600;">Sign In</a> or <a href="/register" style="color: var(--primary-color); font-weight: 600;">Create an Account</a> to view the live community feed and share posts!</p>
      </div>
    `;
    if (loadMoreBtn) loadMoreBtn.style.display = 'none';
  }
}

/**
 * Fetches feed posts from GET /api/v1/posts or GET /api/v1/posts/feed
 * @param {number} page - Page number
 * @param {boolean} append - Whether to append or replace current list
 * @param {Object} currentUser - Current authenticated user
 */
async function fetchFeedPosts(page = 1, append = false, currentUser) {
  const feedContainer = document.getElementById('feed-posts-container');
  const loadMoreBtn = document.getElementById('load-more-posts-btn');
  if (!feedContainer) return;

  isFeedLoading = true;
  if (!append) {
    feedContainer.innerHTML = `
      <div class="feed-empty-state">
        <p>Loading posts...</p>
      </div>
    `;
  } else if (loadMoreBtn) {
    setButtonLoading(loadMoreBtn, true, 'Loading more...');
  }

  try {
    const endpoint = currentFeedTab === 'following'
      ? `/api/v1/posts/feed?page=${page}&limit=10`
      : `/api/v1/posts?page=${page}&limit=10`;

    const response = await fetch(endpoint, {
      method: 'GET',
      credentials: 'include'
    });

    const data = await response.json();

    if (response.ok && data.status === 'success') {
      const posts = data.data.posts;
      feedCurrentPage = data.pagination.currentPage;
      feedHasMore = data.pagination.hasMore;

      if (!append) feedContainer.innerHTML = '';

      if (posts.length === 0 && page === 1) {
        if (currentFeedTab === 'following') {
          feedContainer.innerHTML = `
            <div class="feed-empty-state">
              <h3>Your Following Feed is Empty</h3>
              <p>You haven't followed anyone yet or the users you follow haven't posted. Explore the <strong>Community Feed</strong> to find peers to follow!</p>
            </div>
          `;
        } else {
          feedContainer.innerHTML = `
            <div class="feed-empty-state">
              <h3>No Posts Yet</h3>
              <p>Be the first to share an update with the community!</p>
            </div>
          `;
        }
        if (loadMoreBtn) loadMoreBtn.style.display = 'none';
        return;
      }

      posts.forEach((post) => {
        const cardEl = createPostCardElement(post, currentUser, (updatedPost) => {
          updatePostCardInDOM(cardEl, updatedPost, currentUser);
        }, () => {
          cardEl.remove();
          if (feedContainer.children.length === 0) {
            feedContainer.innerHTML = `
              <div class="feed-empty-state">
                <p>No posts to display.</p>
              </div>
            `;
          }
        });
        feedContainer.appendChild(cardEl);
      });

      if (loadMoreBtn) {
        loadMoreBtn.style.display = feedHasMore ? 'inline-block' : 'none';
      }
    } else {
      if (!append) {
        feedContainer.innerHTML = `
          <div class="feed-empty-state">
            <p>${escapeHtml(data.message || 'Failed to load posts.')}</p>
          </div>
        `;
      }
    }
  } catch (err) {
    console.error('[Fetch Feed Error]:', err);
    if (!append) {
      feedContainer.innerHTML = `
        <div class="feed-empty-state">
          <p>Network error loading posts. Please check connection.</p>
        </div>
      `;
    }
  } finally {
    isFeedLoading = false;
    if (loadMoreBtn) {
      setButtonLoading(loadMoreBtn, false, 'Load More Posts');
    }
  }
}

/**
 * Initializes the Create Post form handler
 * @param {Object} currentUser - Current user
 */
function initCreatePostForm(currentUser) {
  const form = document.getElementById('create-post-form');
  const contentInput = document.getElementById('post-content-input');
  const imageInput = document.getElementById('post-image-input');
  const charCount = document.getElementById('post-char-count');
  const alertBox = document.getElementById('create-post-alert');
  const feedContainer = document.getElementById('feed-posts-container');
  if (!form || !contentInput) return;

  // Live character counter
  contentInput.addEventListener('input', () => {
    if (charCount) charCount.textContent = contentInput.value.length;
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearAlert(alertBox);

    const content = contentInput.value.trim();
    const imageUrl = imageInput ? imageInput.value.trim() : '';

    if (!content) {
      showAlert(alertBox, 'Post content cannot be empty.', 'error');
      return;
    }

    if (content.length > 1000) {
      showAlert(alertBox, 'Post content exceeds 1000 characters.', 'error');
      return;
    }

    const submitBtn = document.getElementById('submit-post-btn');
    setButtonLoading(submitBtn, true, 'Publishing...');

    try {
      const response = await fetch('/api/v1/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ content, imageUrl })
      });

      const data = await response.json();

      if (response.ok && data.status === 'success') {
        const newPost = data.data.post;

        // Reset form
        contentInput.value = '';
        if (imageInput) imageInput.value = '';
        if (charCount) charCount.textContent = '0';

        // Prepend new post card to feed
        if (feedContainer) {
          // If empty state was showing, remove it
          const emptyState = feedContainer.querySelector('.feed-empty-state');
          if (emptyState) emptyState.remove();

          const cardEl = createPostCardElement(newPost, currentUser, (updatedPost) => {
            updatePostCardInDOM(cardEl, updatedPost, currentUser);
          }, () => {
            cardEl.remove();
          });

          feedContainer.prepend(cardEl);
        }

        showAlert(alertBox, 'Post published successfully!', 'success');
        setTimeout(() => clearAlert(alertBox), 3000);
      } else {
        showAlert(alertBox, data.message || 'Failed to publish post.', 'error');
      }
    } catch (err) {
      console.error('[Create Post Error]:', err);
      showAlert(alertBox, 'Network error while publishing post.', 'error');
    } finally {
      setButtonLoading(submitBtn, false, 'Publish Post');
    }
  });
}

/**
 * Loads posts belonging to a specific user on profile.html
 * @param {string} userId - User ID whose posts to fetch
 * @param {Object|null} currentUser - Currently authenticated user
 */
async function loadUserPosts(userId, currentUser) {
  const container = document.getElementById('user-posts-container');
  const countBadge = document.getElementById('user-posts-count-badge');
  if (!container) return;

  initEditPostModal();
  initDeletePostModal();

  container.innerHTML = `
    <div class="feed-empty-state">
      <p>Loading user posts...</p>
    </div>
  `;

  try {
    const response = await fetch(`/api/v1/posts/user/${encodeURIComponent(userId)}`, {
      method: 'GET',
      credentials: 'include'
    });

    const data = await response.json();

    if (response.ok && data.status === 'success') {
      const posts = data.data.posts;
      if (countBadge) countBadge.textContent = `${posts.length} Post${posts.length === 1 ? '' : 's'}`;

      if (posts.length === 0) {
        container.innerHTML = `
          <div class="feed-empty-state">
            <p>No posts published yet by this user.</p>
          </div>
        `;
        return;
      }

      container.innerHTML = '';
      posts.forEach((post) => {
        const cardEl = createPostCardElement(post, currentUser, (updatedPost) => {
          updatePostCardInDOM(cardEl, updatedPost, currentUser);
        }, () => {
          cardEl.remove();
          if (container.children.length === 0) {
            container.innerHTML = `
              <div class="feed-empty-state">
                <p>No posts published yet by this user.</p>
              </div>
            `;
            if (countBadge) countBadge.textContent = '0 Posts';
          }
        });
        container.appendChild(cardEl);
      });
    } else {
      container.innerHTML = `
        <div class="feed-empty-state">
          <p>${escapeHtml(data.message || 'Failed to retrieve posts.')}</p>
        </div>
      `;
    }
  } catch (err) {
    console.error('[Load User Posts Error]:', err);
    container.innerHTML = `
      <div class="feed-empty-state">
        <p>Network error loading posts.</p>
      </div>
    `;
  }
}

/**
 * Creates a safe DOM card element for a post (Strictly prevents XSS)
 * @param {Object} post - Post document
 * @param {Object|null} currentUser - Current authenticated user
 * @param {Function} onUpdated - Callback when post is updated
 * @param {Function} onDeleted - Callback when post is deleted
 * @returns {HTMLElement} - Rendered card element
 */
function createPostCardElement(post, currentUser, onUpdated, onDeleted) {
  const card = document.createElement('article');
  card.className = 'post-card';
  card.id = `post-${post._id}`;

  // 1. Post Header
  const header = document.createElement('div');
  header.className = 'post-header';

  const authorLink = document.createElement('a');
  authorLink.href = `/profile?id=${post.author?._id || ''}`;
  authorLink.className = 'post-author-wrapper';

  const avatar = document.createElement('div');
  avatar.className = 'post-author-avatar';
  if (post.author?.profilePicture) {
    const img = document.createElement('img');
    img.src = post.author.profilePicture;
    img.alt = post.author.name || 'User';
    img.style.width = '100%';
    img.style.height = '100%';
    img.style.objectFit = 'cover';
    img.onerror = () => {
      avatar.textContent = post.author?.name ? post.author.name.charAt(0).toUpperCase() : '👤';
    };
    avatar.appendChild(img);
  } else {
    avatar.textContent = post.author?.name ? post.author.name.charAt(0).toUpperCase() : '👤';
  }

  const meta = document.createElement('div');
  meta.className = 'post-author-meta';

  const name = document.createElement('span');
  name.className = 'post-author-name';
  name.textContent = post.author?.name || 'Anonymous';

  const username = document.createElement('span');
  username.className = 'post-author-username';
  username.textContent = post.author?.username ? `@${post.author.username}` : '';

  const time = document.createElement('span');
  time.className = 'post-timestamp';
  time.textContent = formatPostDate(post.createdAt);

  meta.appendChild(name);
  meta.appendChild(username);
  meta.appendChild(time);

  authorLink.appendChild(avatar);
  authorLink.appendChild(meta);
  header.appendChild(authorLink);

  // Author-only Actions (Edit & Delete)
  const isAuthor = currentUser && post.author && (post.author._id === currentUser._id || post.author === currentUser._id);

  if (isAuthor) {
    const actions = document.createElement('div');
    actions.className = 'post-actions';

    const editBtn = document.createElement('button');
    editBtn.className = 'btn btn-outline btn-sm';
    editBtn.textContent = '✏️ Edit';
    editBtn.addEventListener('click', (e) => {
      e.preventDefault();
      openEditPostModal(post, onUpdated);
    });

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn btn-outline btn-sm';
    deleteBtn.style.color = 'var(--danger-color)';
    deleteBtn.textContent = '🗑️ Delete';
    deleteBtn.addEventListener('click', (e) => {
      e.preventDefault();
      openDeletePostModal(post, onDeleted);
    });

    actions.appendChild(editBtn);
    actions.appendChild(deleteBtn);
    header.appendChild(actions);
  }

  card.appendChild(header);

  // 2. Post Content (Strictly textContent to prevent XSS)
  const content = document.createElement('div');
  content.className = 'post-content';
  content.textContent = post.content;
  card.appendChild(content);

  // 3. Post Image (Optional)
  if (post.imageUrl) {
    const imgContainer = document.createElement('div');
    imgContainer.className = 'post-image-container';

    const img = document.createElement('img');
    img.src = post.imageUrl;
    img.alt = 'Post attachment';
    img.className = 'post-image';
    img.loading = 'lazy';
    img.onerror = () => {
      imgContainer.style.display = 'none'; // Hide if image fails to load
    };

    imgContainer.appendChild(img);
    card.appendChild(imgContainer);
  }

  // 4. Interaction Bar (Like & Comment buttons)
  const interactions = document.createElement('div');
  interactions.className = 'post-interactions';

  // Like button
  const likeBtn = document.createElement('button');
  likeBtn.className = 'interaction-btn';
  const likesArray = post.likes || [];
  let isLiked = currentUser && likesArray.some(id => (typeof id === 'string' ? id : id?._id || id) === currentUser._id);
  let likesCount = likesArray.length;

  const updateLikeButton = () => {
    likeBtn.textContent = '';
    const heart = document.createElement('span');
    heart.textContent = isLiked ? '❤️' : '🤍';
    const count = document.createElement('span');
    count.className = 'interaction-count';
    count.textContent = likesCount;
    likeBtn.appendChild(heart);
    likeBtn.appendChild(count);
    likeBtn.classList.toggle('liked', isLiked);
  };
  updateLikeButton();

  likeBtn.addEventListener('click', async () => {
    if (!currentUser) {
      alert('Please log in to like posts.');
      return;
    }
    likeBtn.disabled = true;
    try {
      const method = isLiked ? 'DELETE' : 'PUT';
      const response = await fetch(`/api/v1/posts/${post._id}/like`, {
        method,
        credentials: 'include'
      });
      const data = await response.json();
      if (response.ok && data.status === 'success') {
        isLiked = data.data.isLiked;
        likesCount = data.data.likesCount;
        updateLikeButton();
      }
    } catch (err) {
      console.error('[Like Error]:', err);
    } finally {
      likeBtn.disabled = false;
    }
  });

  interactions.appendChild(likeBtn);

  // Comment toggle button
  const commentBtn = document.createElement('button');
  commentBtn.className = 'interaction-btn';
  const commentIcon = document.createElement('span');
  commentIcon.textContent = '💬';
  const commentCountSpan = document.createElement('span');
  commentCountSpan.className = 'interaction-count comment-count-label';
  commentCountSpan.textContent = '...';
  commentBtn.appendChild(commentIcon);
  commentBtn.appendChild(commentCountSpan);
  interactions.appendChild(commentBtn);

  card.appendChild(interactions);

  // 5. Comments Section (hidden by default)
  const commentsSection = document.createElement('div');
  commentsSection.className = 'comments-section';

  // Comment alert
  const commentAlert = document.createElement('div');
  commentAlert.className = 'comment-alert';
  commentsSection.appendChild(commentAlert);

  // Comment form (only for logged-in users)
  if (currentUser) {
    const commentForm = document.createElement('form');
    commentForm.className = 'comment-form';

    const commentInput = document.createElement('textarea');
    commentInput.className = 'comment-input';
    commentInput.placeholder = 'Write a comment...';
    commentInput.maxLength = 500;
    commentInput.rows = 1;

    const submitBtn = document.createElement('button');
    submitBtn.type = 'submit';
    submitBtn.className = 'comment-submit-btn';
    submitBtn.textContent = 'Post';

    commentForm.appendChild(commentInput);
    commentForm.appendChild(submitBtn);

    commentForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const content = commentInput.value.trim();
      if (!content) {
        showCommentAlert(commentAlert, 'Comment cannot be empty.', 'error');
        return;
      }
      if (content.length > 500) {
        showCommentAlert(commentAlert, 'Comment cannot exceed 500 characters.', 'error');
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = '...';

      try {
        const response = await fetch(`/api/v1/posts/${post._id}/comments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ content })
        });
        const data = await response.json();
        if (response.ok && data.status === 'success') {
          commentInput.value = '';
          hideCommentAlert(commentAlert);
          const commentEl = createCommentElement(data.data.comment, post, currentUser, commentsList, commentCountSpan);
          commentsList.prepend(commentEl);
          // Remove empty state if present
          const emptyEl = commentsList.querySelector('.comments-empty');
          if (emptyEl) emptyEl.remove();
          // Update count
          const currentCount = parseInt(commentCountSpan.textContent) || 0;
          commentCountSpan.textContent = currentCount + 1;
        } else {
          showCommentAlert(commentAlert, data.message || 'Failed to post comment.', 'error');
        }
      } catch (err) {
        console.error('[Create Comment Error]:', err);
        showCommentAlert(commentAlert, 'Network error posting comment.', 'error');
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Post';
      }
    });

    commentsSection.appendChild(commentForm);
  }

  // Comments list container
  const commentsList = document.createElement('div');
  commentsList.className = 'comments-list';
  commentsSection.appendChild(commentsList);

  card.appendChild(commentsSection);

  // Track comment loading state
  let commentsLoaded = false;

  commentBtn.addEventListener('click', () => {
    const isExpanded = commentsSection.classList.toggle('expanded');
    if (isExpanded && !commentsLoaded) {
      commentsLoaded = true;
      loadPostComments(post, currentUser, commentsList, commentCountSpan, commentAlert);
    }
  });

  // Eagerly fetch comment count
  fetchCommentCount(post._id, commentCountSpan);

  return card;
}

/**
 * Updates an existing post card in place after edit
 */
function updatePostCardInDOM(cardEl, updatedPost, currentUser) {
  const contentEl = cardEl.querySelector('.post-content');
  if (contentEl) {
    contentEl.textContent = updatedPost.content;
  }

  let imgContainer = cardEl.querySelector('.post-image-container');
  if (updatedPost.imageUrl) {
    if (!imgContainer) {
      imgContainer = document.createElement('div');
      imgContainer.className = 'post-image-container';
      cardEl.appendChild(imgContainer);
    }
    imgContainer.style.display = 'flex';
    imgContainer.innerHTML = '';
    const img = document.createElement('img');
    img.src = updatedPost.imageUrl;
    img.alt = 'Post attachment';
    img.className = 'post-image';
    img.onerror = () => {
      imgContainer.style.display = 'none';
    };
    imgContainer.appendChild(img);
  } else if (imgContainer) {
    imgContainer.remove();
  }
}

/* ==========================================================================
   Comment & Like Helpers (Phase 5)
   ========================================================================== */

/**
 * Fetches the comment count for a post (lightweight, no full comment data)
 */
async function fetchCommentCount(postId, countSpan) {
  try {
    const response = await fetch(`/api/v1/posts/${postId}/comments?page=1&limit=1`, {
      credentials: 'include'
    });
    const data = await response.json();
    if (response.ok && data.status === 'success') {
      countSpan.textContent = data.pagination.totalComments || 0;
    } else {
      countSpan.textContent = '0';
    }
  } catch (err) {
    console.error('[Comment Count Error]:', err);
    countSpan.textContent = '0';
  }
}

/**
 * Loads and renders comments for a post into the comments list container
 */
async function loadPostComments(post, currentUser, commentsList, commentCountSpan, commentAlert) {
  commentsList.innerHTML = '<div class="comments-loading">Loading comments...</div>';

  try {
    const response = await fetch(`/api/v1/posts/${post._id}/comments?page=1&limit=50`, {
      credentials: 'include'
    });
    const data = await response.json();

    if (response.ok && data.status === 'success') {
      commentsList.innerHTML = '';
      const comments = data.data.comments;
      commentCountSpan.textContent = data.pagination.totalComments || 0;

      if (comments.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'comments-empty';
        empty.textContent = 'No comments yet. Be the first to comment!';
        commentsList.appendChild(empty);
        return;
      }

      comments.forEach(comment => {
        const el = createCommentElement(comment, post, currentUser, commentsList, commentCountSpan);
        commentsList.appendChild(el);
      });
    } else {
      showCommentAlert(commentAlert, data.message || 'Failed to load comments.', 'error');
    }
  } catch (err) {
    console.error('[Load Comments Error]:', err);
    commentsList.innerHTML = '<div class="comments-empty">Error loading comments.</div>';
  }
}

/**
 * Creates a single comment DOM element with safe rendering
 */
function createCommentElement(comment, post, currentUser, commentsList, commentCountSpan) {
  const item = document.createElement('div');
  item.className = 'comment-item';
  item.dataset.commentId = comment._id;

  // Avatar
  const avatar = document.createElement('div');
  avatar.className = 'comment-avatar';
  if (comment.author?.profilePicture) {
    const img = document.createElement('img');
    img.src = comment.author.profilePicture;
    img.alt = comment.author.name || 'User';
    img.style.width = '100%';
    img.style.height = '100%';
    img.style.objectFit = 'cover';
    img.onerror = () => {
      avatar.textContent = comment.author?.name ? comment.author.name.charAt(0).toUpperCase() : '👤';
    };
    avatar.appendChild(img);
  } else {
    avatar.textContent = comment.author?.name ? comment.author.name.charAt(0).toUpperCase() : '👤';
  }
  item.appendChild(avatar);

  // Body
  const body = document.createElement('div');
  body.className = 'comment-body';

  const header = document.createElement('div');
  header.className = 'comment-header';

  const authorInfo = document.createElement('div');
  authorInfo.className = 'comment-author-info';

  const authorName = document.createElement('span');
  authorName.className = 'comment-author-name';
  authorName.textContent = comment.author?.name || 'Anonymous';

  const authorUsername = document.createElement('span');
  authorUsername.className = 'comment-author-username';
  authorUsername.textContent = comment.author?.username ? `@${comment.author.username}` : '';

  const time = document.createElement('span');
  time.className = 'comment-time';
  time.textContent = formatPostDate(comment.createdAt);

  authorInfo.appendChild(authorName);
  authorInfo.appendChild(authorUsername);
  authorInfo.appendChild(time);
  header.appendChild(authorInfo);

  // Delete button — show for comment author or post owner
  const isCommentAuthor = currentUser && comment.author && (comment.author._id === currentUser._id);
  const isPostOwner = currentUser && post.author && (
    (typeof post.author === 'string' ? post.author : post.author._id) === currentUser._id
  );

  if (isCommentAuthor || isPostOwner) {
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'comment-delete-btn';
    deleteBtn.textContent = '✕';
    deleteBtn.title = 'Delete comment';
    deleteBtn.addEventListener('click', async () => {
      if (!confirm('Delete this comment?')) return;
      deleteBtn.disabled = true;
      try {
        const response = await fetch(`/api/v1/comments/${comment._id}`, {
          method: 'DELETE',
          credentials: 'include'
        });
        const data = await response.json();
        if (response.ok && data.status === 'success') {
          item.remove();
          const currentCount = parseInt(commentCountSpan.textContent) || 0;
          commentCountSpan.textContent = Math.max(0, currentCount - 1);
          if (commentsList.children.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'comments-empty';
            empty.textContent = 'No comments yet. Be the first to comment!';
            commentsList.appendChild(empty);
          }
        } else {
          alert(data.message || 'Failed to delete comment.');
        }
      } catch (err) {
        console.error('[Delete Comment Error]:', err);
        alert('Network error deleting comment.');
      } finally {
        deleteBtn.disabled = false;
      }
    });
    header.appendChild(deleteBtn);
  }

  body.appendChild(header);

  const text = document.createElement('div');
  text.className = 'comment-text';
  text.textContent = comment.content; // Safe: textContent prevents XSS
  body.appendChild(text);

  item.appendChild(body);
  return item;
}

function showCommentAlert(el, message, type) {
  if (!el) return;
  el.className = `comment-alert alert-${type}`;
  el.textContent = message;
  setTimeout(() => hideCommentAlert(el), 4000);
}

function hideCommentAlert(el) {
  if (!el) return;
  el.className = 'comment-alert';
  el.textContent = '';
}

/* ==========================================================================
   Edit & Delete Post Modals (Phase 4)
   ========================================================================== */

let activeEditPost = null;
let activeEditCallback = null;

function initEditPostModal() {
  const modal = document.getElementById('edit-post-modal');
  const closeBtn = document.getElementById('edit-post-close-btn');
  const cancelBtn = document.getElementById('edit-post-cancel-btn');
  const form = document.getElementById('edit-post-form');
  const contentInput = document.getElementById('edit-post-content');
  const imageInput = document.getElementById('edit-post-image');
  const charCount = document.getElementById('edit-post-char-count');
  const alertBox = document.getElementById('edit-post-alert');

  if (!modal || !form) return;

  if (contentInput && charCount) {
    contentInput.addEventListener('input', () => {
      charCount.textContent = contentInput.value.length;
    });
  }

  const closeModal = () => {
    modal.classList.remove('active');
    activeEditPost = null;
    activeEditCallback = null;
    clearAlert(alertBox);
  };

  if (closeBtn) closeBtn.onclick = closeModal;
  if (cancelBtn) cancelBtn.onclick = closeModal;

  modal.onclick = (e) => {
    if (e.target === modal) closeModal();
  };

  form.onsubmit = async (e) => {
    e.preventDefault();
    if (!activeEditPost) return;

    clearAlert(alertBox);
    const content = contentInput.value.trim();
    const imageUrl = imageInput.value.trim();

    if (!content) {
      showAlert(alertBox, 'Post content cannot be empty.', 'error');
      return;
    }

    if (content.length > 1000) {
      showAlert(alertBox, 'Post content exceeds 1000 characters.', 'error');
      return;
    }

    const saveBtn = document.getElementById('save-post-btn');
    setButtonLoading(saveBtn, true, 'Saving...');

    try {
      const response = await fetch(`/api/v1/posts/${activeEditPost._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ content, imageUrl })
      });

      const data = await response.json();

      if (response.ok && data.status === 'success') {
        if (activeEditCallback) {
          activeEditCallback(data.data.post);
        }
        closeModal();
      } else {
        showAlert(alertBox, data.message || 'Failed to update post.', 'error');
      }
    } catch (err) {
      console.error('[Update Post Error]:', err);
      showAlert(alertBox, 'Network error updating post.', 'error');
    } finally {
      setButtonLoading(saveBtn, false, 'Save Changes');
    }
  };
}

function openEditPostModal(post, callback) {
  const modal = document.getElementById('edit-post-modal');
  const contentInput = document.getElementById('edit-post-content');
  const imageInput = document.getElementById('edit-post-image');
  const charCount = document.getElementById('edit-post-char-count');
  const alertBox = document.getElementById('edit-post-alert');

  if (!modal || !contentInput) return;

  activeEditPost = post;
  activeEditCallback = callback;
  clearAlert(alertBox);

  contentInput.value = post.content || '';
  if (imageInput) imageInput.value = post.imageUrl || '';
  if (charCount) charCount.textContent = (post.content || '').length;

  modal.classList.add('active');
  contentInput.focus();
}

let activeDeletePost = null;
let activeDeleteCallback = null;

function initDeletePostModal() {
  const modal = document.getElementById('delete-post-modal');
  const closeBtn = document.getElementById('delete-post-close-btn');
  const cancelBtn = document.getElementById('cancel-delete-post-btn');
  const confirmBtn = document.getElementById('confirm-delete-post-btn');

  if (!modal || !confirmBtn) return;

  const closeModal = () => {
    modal.classList.remove('active');
    activeDeletePost = null;
    activeDeleteCallback = null;
  };

  if (closeBtn) closeBtn.onclick = closeModal;
  if (cancelBtn) cancelBtn.onclick = closeModal;

  modal.onclick = (e) => {
    if (e.target === modal) closeModal();
  };

  confirmBtn.onclick = async () => {
    if (!activeDeletePost) return;

    setButtonLoading(confirmBtn, true, 'Deleting...');

    try {
      const response = await fetch(`/api/v1/posts/${activeDeletePost._id}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      const data = await response.json();

      if (response.ok && data.status === 'success') {
        if (activeDeleteCallback) {
          activeDeleteCallback();
        }
        closeModal();
      } else {
        alert(data.message || 'Failed to delete post.');
      }
    } catch (err) {
      console.error('[Delete Post Error]:', err);
      alert('Network error deleting post.');
    } finally {
      setButtonLoading(confirmBtn, false, 'Delete');
    }
  };
}

function openDeletePostModal(post, callback) {
  const modal = document.getElementById('delete-post-modal');
  if (!modal) {
    if (confirm('Are you sure you want to permanently delete this post?')) {
      // Fallback if modal not present
      fetch(`/api/v1/posts/${post._id}`, { method: 'DELETE', credentials: 'include' })
        .then((res) => res.json())
        .then((data) => {
          if (data.status === 'success' && callback) callback();
        });
    }
    return;
  }

  activeDeletePost = post;
  activeDeleteCallback = callback;
  modal.classList.add('active');
}

/**
 * Formats ISO timestamps into readable relative / calendar format
 */
function formatPostDate(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const diffSeconds = Math.floor((now - date) / 1000);

  if (diffSeconds < 60) return 'Just now';
  if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m ago`;
  if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)}h ago`;
  if (diffSeconds < 604800) return `${Math.floor(diffSeconds / 86400)}d ago`;

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
  });
}

/* ==========================================================================
   Profile Page Controller (Phase 3 & 4)
   ========================================================================== */

/**
 * Initializes the user profile view, supporting both own profile and external profiles by ID
 * @param {Object|null} currentUser - Authenticated user object or null
 */
async function initProfilePage(currentUser) {
  const profileCard = document.getElementById('profile-card');
  if (!profileCard) return;

  const alertBox = document.getElementById('alert-box');
  const nameEl = document.getElementById('profile-name');
  const usernameEl = document.getElementById('profile-username');
  const emailEl = document.getElementById('profile-email');
  const bioEl = document.getElementById('profile-bio');
  const avatarEl = document.getElementById('profile-avatar');
  const joinedEl = document.getElementById('profile-joined');
  const followersEl = document.getElementById('followers-count');
  const followingEl = document.getElementById('following-count');
  const postsTitleEl = document.getElementById('posts-card-title');

  const editProfileBtn = document.getElementById('edit-profile-btn');
  const logoutBtn = document.getElementById('logout-btn');
  const followBtn = document.getElementById('follow-btn');
  const backToMyProfileBtn = document.getElementById('back-to-my-profile-btn');

  const urlParams = new URLSearchParams(window.location.search);
  const targetUserId = urlParams.get('id');

  const isViewingOtherUser = targetUserId && (!currentUser || targetUserId !== currentUser._id);

  if (isViewingOtherUser) {
    // -------------------------------------------------------------
    // Scenario A: Viewing Another User's Public Profile by ID
    // -------------------------------------------------------------
    nameEl.textContent = 'Loading public profile...';
    usernameEl.textContent = '';
    emailEl.textContent = '';
    bioEl.textContent = '';

    try {
      const response = await fetch(`/api/v1/users/${encodeURIComponent(targetUserId)}`, {
        credentials: 'include'
      });
      const data = await response.json();

      if (!response.ok || data.status !== 'success') {
        showAlert(alertBox, data.message || 'User profile not found.', 'error');
        nameEl.textContent = 'User Not Found';
        bioEl.textContent = 'The profile you are looking for does not exist or may have been removed.';
        if (currentUser && backToMyProfileBtn) {
          backToMyProfileBtn.style.display = 'inline-block';
        }
        return;
      }

      const user = data.data.user;

      nameEl.textContent = user.name;
      usernameEl.textContent = `@${user.username}`;
      emailEl.textContent = ''; // Public profile keeps email private
      bioEl.textContent = user.bio ? user.bio : 'This user has not written a bio yet.';

      if (user.createdAt && joinedEl) {
        const date = new Date(user.createdAt);
        joinedEl.textContent = `Joined ${date.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}`;
      }

      if (followersEl) followersEl.textContent = user.followersCount || 0;
      if (followingEl) followingEl.textContent = user.followingCount || 0;
      if (postsTitleEl) postsTitleEl.textContent = `${user.name}'s Posts`;

      renderAvatar(avatarEl, user.profilePicture, user.name);

      if (currentUser && backToMyProfileBtn) {
        backToMyProfileBtn.style.display = 'inline-block';
      }
      if (editProfileBtn) editProfileBtn.style.display = 'none';
      if (logoutBtn) logoutBtn.style.display = 'none';

      // Follow / Unfollow logic
      if (followBtn) {
        followBtn.style.display = 'inline-block';
        if (currentUser) {
          try {
            const statusRes = await fetch(`/api/v1/users/${encodeURIComponent(targetUserId)}/follow-status`, {
              credentials: 'include'
            });
            const statusData = await statusRes.json();
            if (statusRes.ok && statusData.status === 'success') {
              let isFollowing = statusData.data.isFollowing;
              updateFollowButtonUI(followBtn, isFollowing);

              followBtn.onclick = async () => {
                setButtonLoading(followBtn, true, 'Processing...');
                try {
                  const method = isFollowing ? 'DELETE' : 'POST';
                  const res = await fetch(`/api/v1/users/${encodeURIComponent(targetUserId)}/follow`, {
                    method,
                    credentials: 'include'
                  });
                  const resData = await res.json();
                  if (res.ok && resData.status === 'success') {
                    isFollowing = resData.data.isFollowing;
                    updateFollowButtonUI(followBtn, isFollowing);
                    if (followersEl) followersEl.textContent = resData.data.followersCount;
                    showAlert(alertBox, resData.message, 'success');
                    setTimeout(() => clearAlert(alertBox), 3500);
                  } else {
                    showAlert(alertBox, resData.message || 'Action failed.', 'error');
                  }
                } catch (err) {
                  console.error('[Follow Action Error]:', err);
                  showAlert(alertBox, 'Network error. Please try again.', 'error');
                } finally {
                  setButtonLoading(followBtn, false, isFollowing ? 'Unfollow' : 'Follow');
                }
              };
            }
          } catch (err) {
            console.error('[Follow Status Error]:', err);
          }
        } else {
          followBtn.onclick = () => {
            window.location.href = '/login';
          };
        }
      }

      // Setup followers/following list click handlers
      setupFollowListListeners(user._id);

      // Load target user's posts
      loadUserPosts(user._id, currentUser);

    } catch (err) {
      console.error('[Fetch Profile Error]:', err);
      showAlert(alertBox, 'Failed to load user profile.', 'error');
      nameEl.textContent = 'Error Loading Profile';
    }

  } else {
    // -------------------------------------------------------------
    // Scenario B: Viewing Current Authenticated User's Profile
    // -------------------------------------------------------------
    if (!currentUser) {
      showAlert(alertBox, 'You are not logged in. Redirecting to login page...', 'error');
      nameEl.textContent = 'Access Restricted';
      usernameEl.textContent = '';
      bioEl.textContent = 'Please sign in to view your profile.';
      setTimeout(() => {
        window.location.href = '/login';
      }, 1200);
      return;
    }

    nameEl.textContent = currentUser.name;
    usernameEl.textContent = `@${currentUser.username}`;
    emailEl.textContent = currentUser.email;
    bioEl.textContent = currentUser.bio ? currentUser.bio : 'No bio added yet. Click "Edit Profile" to share something about yourself!';

    if (currentUser.createdAt && joinedEl) {
      const date = new Date(currentUser.createdAt);
      joinedEl.textContent = `Joined ${date.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}`;
    }

    if (followersEl) followersEl.textContent = currentUser.followersCount || 0;
    if (followingEl) followingEl.textContent = currentUser.followingCount || 0;
    if (postsTitleEl) postsTitleEl.textContent = 'My Posts';

    renderAvatar(avatarEl, currentUser.profilePicture, currentUser.name);

    if (editProfileBtn) editProfileBtn.style.display = 'inline-block';
    if (logoutBtn) {
      logoutBtn.style.display = 'inline-block';
      logoutBtn.addEventListener('click', handleLogout);
    }
    if (followBtn) followBtn.style.display = 'none';
    if (backToMyProfileBtn) backToMyProfileBtn.style.display = 'none';

    // Initialize Edit Profile Modal
    initEditProfileModal(currentUser);

    // Setup followers/following list click handlers
    setupFollowListListeners(currentUser._id);

    // Load logged-in user's posts
    loadUserPosts(currentUser._id, currentUser);
  }
}

/**
 * Updates Follow button styling and text based on follow status
 */
function updateFollowButtonUI(btn, isFollowing) {
  if (!btn) return;
  if (isFollowing) {
    btn.textContent = 'Unfollow';
    btn.className = 'btn btn-outline btn-sm btn-unfollow';
  } else {
    btn.textContent = 'Follow';
    btn.className = 'btn btn-primary btn-sm';
  }
}

/**
 * Sets up clicking on followers or following counts to display user list
 */
function setupFollowListListeners(targetUserId) {
  const followersItem = document.getElementById('followers-stat-item');
  const followingItem = document.getElementById('following-stat-item');
  const listSection = document.getElementById('follow-list-section');
  const closeBtn = document.getElementById('close-follow-list-btn');

  if (!followersItem || !followingItem || !listSection) return;

  if (closeBtn) {
    closeBtn.onclick = () => {
      listSection.style.display = 'none';
    };
  }

  followersItem.onclick = () => {
    loadFollowList(targetUserId, 'followers');
  };

  followingItem.onclick = () => {
    loadFollowList(targetUserId, 'following');
  };
}

/**
 * Loads followers or following users from the API and renders them
 */
async function loadFollowList(userId, type) {
  const listSection = document.getElementById('follow-list-section');
  const listTitle = document.getElementById('follow-list-title');
  const listContainer = document.getElementById('follow-list-container');
  if (!listSection || !listContainer) return;

  listSection.style.display = 'block';
  listTitle.textContent = type === 'followers' ? 'Followers' : 'Following';
  listContainer.innerHTML = '<div class="feed-empty-state"><p>Loading list...</p></div>';

  try {
    const res = await fetch(`/api/v1/users/${encodeURIComponent(userId)}/${type}`, {
      credentials: 'include'
    });
    const data = await res.json();
    if (res.ok && data.status === 'success') {
      const users = data.data.users || [];
      if (users.length === 0) {
        listContainer.innerHTML = `
          <div class="feed-empty-state">
            <p>${type === 'followers' ? 'No followers yet.' : 'Not following anyone yet.'}</p>
          </div>
        `;
        return;
      }

      listContainer.innerHTML = '';
      const listDiv = document.createElement('div');
      listDiv.className = 'follow-user-list';

      users.forEach((u) => {
        if (!u) return;
        const card = document.createElement('a');
        card.href = `/profile?id=${u._id}`;
        card.className = 'follow-user-card';

        const info = document.createElement('div');
        info.className = 'follow-user-info';

        const avatar = document.createElement('div');
        avatar.className = 'follow-user-avatar';
        if (u.profilePicture) {
          const img = document.createElement('img');
          img.src = u.profilePicture;
          img.alt = u.name || 'User';
          img.style.width = '100%';
          img.style.height = '100%';
          img.style.objectFit = 'cover';
          img.onerror = () => {
            avatar.textContent = u.name ? u.name.charAt(0).toUpperCase() : '👤';
          };
          avatar.appendChild(img);
        } else {
          avatar.textContent = u.name ? u.name.charAt(0).toUpperCase() : '👤';
        }

        const details = document.createElement('div');
        details.className = 'follow-user-details';

        const nameSpan = document.createElement('span');
        nameSpan.className = 'follow-user-name';
        nameSpan.textContent = u.name || 'Anonymous';

        const usernameSpan = document.createElement('span');
        usernameSpan.className = 'follow-user-username';
        usernameSpan.textContent = u.username ? `@${u.username}` : '';

        details.appendChild(nameSpan);
        details.appendChild(usernameSpan);

        if (u.bio) {
          const bioSpan = document.createElement('span');
          bioSpan.className = 'follow-user-bio';
          bioSpan.textContent = u.bio;
          details.appendChild(bioSpan);
        }

        info.appendChild(avatar);
        info.appendChild(details);
        card.appendChild(info);

        const viewLink = document.createElement('span');
        viewLink.className = 'btn btn-outline btn-sm';
        viewLink.textContent = 'View';
        card.appendChild(viewLink);

        listDiv.appendChild(card);
      });

      listContainer.appendChild(listDiv);
    } else {
      listContainer.innerHTML = `<div class="feed-empty-state"><p>${escapeHtml(data.message || 'Failed to load list.')}</p></div>`;
    }
  } catch (err) {
    console.error(`[Load ${type} Error]:`, err);
    listContainer.innerHTML = '<div class="feed-empty-state"><p>Error connecting to server.</p></div>';
  }
}

/**
 * Sets up the Edit Profile Modal dialog and submission handling
 * @param {Object} currentUser - Current authenticated user
 */
function initEditProfileModal(currentUser) {
  const modal = document.getElementById('edit-profile-modal');
  const openBtn = document.getElementById('edit-profile-btn');
  const closeBtn = document.getElementById('modal-close-btn');
  const cancelBtn = document.getElementById('modal-cancel-btn');
  const form = document.getElementById('edit-profile-form');
  const modalAlert = document.getElementById('modal-alert-box');
  const bioInput = document.getElementById('edit-bio');
  const bioCount = document.getElementById('bio-char-count');

  if (!modal || !form || !openBtn) return;

  const editName = document.getElementById('edit-name');
  const editUsername = document.getElementById('edit-username');
  const editProfilePicture = document.getElementById('edit-profile-picture');

  if (bioInput && bioCount) {
    bioInput.addEventListener('input', () => {
      bioCount.textContent = bioInput.value.length;
    });
  }

  openBtn.addEventListener('click', () => {
    clearAlert(modalAlert);
    editName.value = currentUser.name || '';
    editUsername.value = currentUser.username || '';
    editProfilePicture.value = currentUser.profilePicture || '';
    bioInput.value = currentUser.bio || '';
    if (bioCount) bioCount.textContent = bioInput.value.length;
    modal.classList.add('active');
  });

  const closeModal = () => {
    modal.classList.remove('active');
    clearAlert(modalAlert);
  };

  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('active')) {
      closeModal();
    }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearAlert(modalAlert);

    const updatedName = editName.value.trim();
    const updatedUsername = editUsername.value.trim();
    const updatedBio = bioInput.value.trim();
    const updatedProfilePicture = editProfilePicture.value.trim();

    if (!updatedName) {
      showAlert(modalAlert, 'Full name cannot be empty.', 'error');
      return;
    }
    if (!updatedUsername) {
      showAlert(modalAlert, 'Username cannot be empty.', 'error');
      return;
    }
    if (updatedUsername.length < 3 || updatedUsername.length > 30) {
      showAlert(modalAlert, 'Username must be between 3 and 30 characters.', 'error');
      return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(updatedUsername)) {
      showAlert(modalAlert, 'Username may only contain letters, numbers, and underscores.', 'error');
      return;
    }

    const saveBtn = document.getElementById('save-profile-btn');
    setButtonLoading(saveBtn, true, 'Saving...');

    try {
      const response = await fetch('/api/v1/users/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: updatedName,
          username: updatedUsername,
          bio: updatedBio,
          profilePicture: updatedProfilePicture
        })
      });

      const data = await response.json();

      if (response.ok && data.status === 'success') {
        const updatedUser = data.data.user;

        currentUser.name = updatedUser.name;
        currentUser.username = updatedUser.username;
        currentUser.bio = updatedUser.bio;
        currentUser.profilePicture = updatedUser.profilePicture;

        const nameEl = document.getElementById('profile-name');
        const usernameEl = document.getElementById('profile-username');
        const bioEl = document.getElementById('profile-bio');
        const avatarEl = document.getElementById('profile-avatar');
        const navProfileLink = document.getElementById('nav-profile-link');
        const mainAlert = document.getElementById('alert-box');

        if (nameEl) nameEl.textContent = updatedUser.name;
        if (usernameEl) usernameEl.textContent = `@${updatedUser.username}`;
        if (bioEl) bioEl.textContent = updatedUser.bio || 'No bio added yet.';
        if (navProfileLink) navProfileLink.textContent = `@${updatedUser.username}`;

        renderAvatar(avatarEl, updatedUser.profilePicture, updatedUser.name);

        closeModal();
        showAlert(mainAlert, 'Profile updated successfully!', 'success');
        setTimeout(() => clearAlert(mainAlert), 4000);

      } else {
        showAlert(modalAlert, data.message || 'Failed to update profile.', 'error');
      }
    } catch (err) {
      console.error('[Update Profile Error]:', err);
      showAlert(modalAlert, 'Network error. Please try again.', 'error');
    } finally {
      setButtonLoading(saveBtn, false, 'Save Changes');
    }
  });
}

/**
 * Safely renders the user avatar, either with an image or an uppercase initial
 * @param {HTMLElement} avatarEl - Container DOM element
 * @param {string} profilePicture - Image URL
 * @param {string} name - User's full name
 */
function renderAvatar(avatarEl, profilePicture, name) {
  if (!avatarEl) return;
  avatarEl.innerHTML = '';

  if (profilePicture) {
    const img = document.createElement('img');
    img.src = profilePicture;
    img.alt = name || 'User Avatar';
    img.style.width = '100%';
    img.style.height = '100%';
    img.style.objectFit = 'cover';
    img.onerror = () => {
      avatarEl.textContent = name ? name.charAt(0).toUpperCase() : '👤';
    };
    avatarEl.appendChild(img);
  } else {
    avatarEl.textContent = name ? name.charAt(0).toUpperCase() : '👤';
  }
}

/* ==========================================================================
   Auth Forms (Phase 2 Preserved)
   ========================================================================== */

function initRegisterForm() {
  const registerForm = document.getElementById('register-form');
  const alertBox = document.getElementById('alert-box');
  if (!registerForm) return;

  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearAlert(alertBox);

    const name = document.getElementById('name').value.trim();
    const username = document.getElementById('username').value.trim();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirm-password').value;

    if (!name || !username || !email || !password) {
      showAlert(alertBox, 'Please fill in all required fields.', 'error');
      return;
    }

    if (password.length < 6) {
      showAlert(alertBox, 'Password must be at least 6 characters long.', 'error');
      return;
    }

    if (password !== confirmPassword) {
      showAlert(alertBox, 'Passwords do not match. Please re-enter.', 'error');
      return;
    }

    const submitBtn = registerForm.querySelector('button[type="submit"]');
    setButtonLoading(submitBtn, true, 'Creating Account...');

    try {
      const response = await fetch('/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name, username, email, password })
      });

      const data = await response.json();

      if (response.ok && data.status === 'success') {
        showAlert(alertBox, 'Registration successful! Redirecting to profile...', 'success');
        setTimeout(() => {
          window.location.href = '/profile';
        }, 1000);
      } else {
        showAlert(alertBox, data.message || 'Registration failed. Please try again.', 'error');
      }
    } catch (error) {
      console.error('[Register Request Error]:', error);
      showAlert(alertBox, 'Network error. Please ensure the server is running.', 'error');
    } finally {
      setButtonLoading(submitBtn, false, 'Sign Up');
    }
  });
}

function initLoginForm() {
  const loginForm = document.getElementById('login-form');
  const alertBox = document.getElementById('alert-box');
  if (!loginForm) return;

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearAlert(alertBox);

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    if (!email || !password) {
      showAlert(alertBox, 'Please enter your email/username and password.', 'error');
      return;
    }

    const submitBtn = loginForm.querySelector('button[type="submit"]');
    setButtonLoading(submitBtn, true, 'Signing In...');

    try {
      const response = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (response.ok && data.status === 'success') {
        showAlert(alertBox, 'Login successful! Redirecting to feed...', 'success');
        setTimeout(() => {
          window.location.href = '/';
        }, 800);
      } else {
        showAlert(alertBox, data.message || 'Login failed. Invalid credentials.', 'error');
      }
    } catch (error) {
      console.error('[Login Request Error]:', error);
      showAlert(alertBox, 'Network error. Please ensure the server is running.', 'error');
    } finally {
      setButtonLoading(submitBtn, false, 'Sign In');
    }
  });
}

async function handleLogout() {
  try {
    const response = await fetch('/api/v1/auth/logout', {
      method: 'POST',
      credentials: 'include'
    });

    if (response.ok) {
      window.location.href = '/login';
    } else {
      alert('Logout failed. Please try again.');
    }
  } catch (error) {
    console.error('[Logout Request Error]:', error);
    window.location.href = '/login';
  }
}

/* ==========================================================================
   UI Helpers & XSS Protection
   ========================================================================== */

function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function showAlert(element, message, type = 'error') {
  if (!element) return;
  element.className = `alert alert-${type}`;
  element.textContent = message;
  element.style.display = 'block';
}

function clearAlert(element) {
  if (!element) return;
  element.textContent = '';
  element.className = 'alert';
  element.style.display = 'none';
}

function setButtonLoading(button, isLoading, text) {
  if (!button) return;
  button.disabled = isLoading;
  button.textContent = text;
}
