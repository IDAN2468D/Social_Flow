/**
 * SocialFlow - Frontend Application
 * Connects to SocialFlow API Gateway at http://localhost:8088
 */

// Configuration - Auto-detects Docker Nginx Proxy
const isDockerEnv = window.location.port === '3000' || window.location.port === '80';

const CONFIG = {
  // When running in Docker Nginx on port 3000, use relative paths so Nginx internally proxies to api-gateway in Docker
  API_BASE: isDockerEnv ? '' : 'http://localhost:8088',
  FALLBACK_SERVICES: {
    user: 'http://localhost:8081',
    post: 'http://localhost:8082',
    feed: 'http://localhost:8083',
    elasticsearch: 'http://localhost:9205'
  },
  DEFAULT_USER: {
    userId: 1,
    username: 'idan',
    fullName: 'עידן כהן',
    email: 'idan@example.com',
    token: ''
  },
  PRESET_USERS: [
    { userId: 1, username: 'idan', fullName: 'עידן כהן' },
    { userId: 4, username: 'testuser99', fullName: 'משתמש בדיקה' },
    { userId: 2, username: 'david', fullName: 'דוד לוי' },
    { userId: 3, username: 'sara', fullName: 'שרה אהרוני' }
  ],
  REACTIONS: [
    { type: 'LIKE', emoji: '👍', label: 'אהבתי' },
    { type: 'LOVE', emoji: '❤️', label: 'אוהב' },
    { type: 'CELEBRATE', emoji: '🎉', label: 'חוגג' },
    { type: 'SUPPORT', emoji: '🤝', label: 'תומך' },
    { type: 'INSIGHTFUL', emoji: '💡', label: 'מעניין' },
    { type: 'FUNNY', emoji: '😂', label: 'מצחיק' }
  ]
};

// Application State
const state = {
  currentUser: null,
  activeTab: 'for-you',
  activeTagFilter: null,
  posts: [],
  trendingTags: [],
  searchDebounceTimer: null
};

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
  initUser();
  setupEventListeners();
  loadTrendingTags();
  loadFeed();
  checkServicesHealth();
});

// ============================================================================
// Authentication & User Management
// ============================================================================

function initUser() {
  const saved = localStorage.getItem('socialflow_user');
  if (saved) {
    try {
      state.currentUser = JSON.parse(saved);
    } catch (e) {
      state.currentUser = { ...CONFIG.DEFAULT_USER };
    }
  } else {
    state.currentUser = { ...CONFIG.DEFAULT_USER };
    saveUser(state.currentUser);
  }

  renderAuthSection();
  renderQuickUsers();
  updateComposerAvatar();
}

function saveUser(user) {
  state.currentUser = user;
  localStorage.setItem('socialflow_user', JSON.stringify(user));
}

function getAuthHeaders() {
  const headers = {
    'Content-Type': 'application/json',
    'X-Auth-UserId': String(state.currentUser.userId || 1),
    'X-Auth-Username': state.currentUser.username || 'idan'
  };

  if (state.currentUser.token) {
    headers['Authorization'] = `Bearer ${state.currentUser.token}`;
  }

  return headers;
}

function switchUser(userObj) {
  state.currentUser = {
    ...state.currentUser,
    ...userObj
  };
  saveUser(state.currentUser);
  renderAuthSection();
  renderQuickUsers();
  updateComposerAvatar();
  showToast(`הוחלף משתמש אל @${userObj.username}`, 'info');
  loadFeed();
}

function renderAuthSection() {
  const authSection = document.getElementById('auth-section');
  if (!authSection) return;

  const user = state.currentUser;
  const avatarUrl = `https://api.dicebear.com/7.x/bottts/svg?seed=${user.username}`;

  authSection.innerHTML = `
    <div class="user-profile-badge" id="btn-user-profile" title="לחץ לשינוי הגדרות חשבון">
      <img src="${avatarUrl}" alt="${user.username}" class="user-badge-avatar">
      <span class="user-badge-name">@${user.username}</span>
    </div>
  `;

  document.getElementById('btn-user-profile')?.addEventListener('click', () => {
    openAuthModal('login');
  });
}

function renderQuickUsers() {
  const grid = document.getElementById('quick-users-grid');
  if (!grid) return;

  grid.innerHTML = CONFIG.PRESET_USERS.map(u => {
    const isActive = state.currentUser && state.currentUser.username === u.username;
    const avatar = `https://api.dicebear.com/7.x/bottts/svg?seed=${u.username}`;
    return `
      <button class="quick-user-btn ${isActive ? 'active-user' : ''}" data-username="${u.username}">
        <img src="${avatar}" class="quick-avatar" alt="${u.username}">
        <span class="quick-name">${u.fullName}</span>
        <span class="quick-id">ID: ${u.userId}</span>
      </button>
    `;
  }).join('');

  grid.querySelectorAll('.quick-user-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const username = btn.dataset.username;
      const found = CONFIG.PRESET_USERS.find(u => u.username === username);
      if (found) switchUser(found);
    });
  });
}

function updateComposerAvatar() {
  const avatar = document.getElementById('composer-avatar');
  if (avatar && state.currentUser) {
    avatar.src = `https://api.dicebear.com/7.x/bottts/svg?seed=${state.currentUser.username}`;
  }
}

// ============================================================================
// Event Listeners & Navigation
// ============================================================================

function setupEventListeners() {
  // Navigation Tabs
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.activeTab = btn.dataset.tab;
      state.activeTagFilter = null;
      updateFeedHeading();
      loadFeed();
    });
  });

  // Refresh Button
  document.getElementById('btn-refresh-feed')?.addEventListener('click', () => {
    loadFeed();
    loadTrendingTags();
    showToast('הפיד רוענן', 'info');
  });

  // Post Composer Buttons
  document.getElementById('btn-publish-post')?.addEventListener('click', handlePublishPost);
  document.getElementById('btn-toggle-media')?.addEventListener('click', toggleMediaInput);
  document.getElementById('btn-confirm-media')?.addEventListener('click', confirmMediaUrl);
  document.getElementById('btn-remove-media')?.addEventListener('click', removeMedia);
  document.getElementById('btn-toggle-poll')?.addEventListener('click', togglePollBuilder);
  document.getElementById('btn-close-poll')?.addEventListener('click', closePollBuilder);
  document.getElementById('btn-add-poll-option')?.addEventListener('click', addPollOption);
  document.getElementById('btn-add-hashtag')?.addEventListener('click', insertHashtagPrompt);

  // Search
  const searchInput = document.getElementById('global-search-input');
  searchInput?.addEventListener('input', handleSearchInput);
  searchInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const q = searchInput.value.trim();
      if (q) performDirectSearch(q);
    }
  });

  // Close search dropdown on click outside
  document.addEventListener('click', (e) => {
    const searchWrapper = document.querySelector('.nav-search');
    const dropdown = document.getElementById('search-results-dropdown');
    if (searchWrapper && !searchWrapper.contains(e.target)) {
      dropdown?.classList.add('hidden');
    }
  });

  // Diagnostics Modal
  document.getElementById('system-status-pill')?.addEventListener('click', openDiagnosticsModal);
  document.getElementById('btn-run-diagnostics')?.addEventListener('click', openDiagnosticsModal);
  document.getElementById('btn-close-diagnostics')?.addEventListener('click', closeDiagnosticsModal);
  document.getElementById('btn-retest-diagnostics')?.addEventListener('click', runFullDiagnostics);

  // Auth Modal
  document.getElementById('btn-close-auth-modal')?.addEventListener('click', closeAuthModal);
  document.getElementById('modal-tab-login')?.addEventListener('click', () => switchAuthTab('login'));
  document.getElementById('modal-tab-register')?.addEventListener('click', () => switchAuthTab('register'));
  document.getElementById('login-form')?.addEventListener('submit', handleLoginSubmit);
  document.getElementById('register-form')?.addEventListener('submit', handleRegisterSubmit);

  // Quick fill buttons in auth modal
  document.querySelectorAll('.fill-login-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.getElementById('login-username').value = btn.dataset.user;
      document.getElementById('login-password').value = btn.dataset.pass;
    });
  });
}

function updateFeedHeading() {
  const heading = document.getElementById('feed-heading');
  if (!heading) return;

  if (state.activeTagFilter) {
    heading.textContent = `פוסטים עם תגית #${state.activeTagFilter}`;
    return;
  }

  const titles = {
    'for-you': 'פיד בשבילך (For You)',
    'following': 'פוסטים מנעקבים (Following)',
    'trending': 'טרנדים פופולריים',
    'bookmarks': 'הסימניות שלי'
  };

  heading.textContent = titles[state.activeTab] || 'פיד פוסטים';
}

// ============================================================================
// Feed & Posts Management
// ============================================================================

async function loadFeed() {
  const container = document.getElementById('feed-container');
  const countBadge = document.getElementById('feed-count-badge');
  if (!container) return;

  container.innerHTML = `
    <div class="feed-loading-skeleton">
      <div class="skeleton-card"></div>
      <div class="skeleton-card"></div>
    </div>
  `;

  if (countBadge) countBadge.textContent = 'טוען...';

  try {
    let url = '';
    const userId = state.currentUser ? state.currentUser.userId : 1;

    if (state.activeTagFilter) {
      url = `${CONFIG.API_BASE}/api/v1/search?query=${encodeURIComponent(state.activeTagFilter)}`;
    } else {
      switch (state.activeTab) {
        case 'following':
          url = `${CONFIG.API_BASE}/api/v1/feed/following?userId=${userId}&page=0&size=20`;
          break;
        case 'trending':
          url = `${CONFIG.API_BASE}/api/v1/feed/trending?page=0&size=20`;
          break;
        case 'bookmarks':
          url = `${CONFIG.API_BASE}/api/v1/posts/bookmarks?page=0&size=20`;
          break;
        case 'for-you':
        default:
          url = `${CONFIG.API_BASE}/api/v1/feed/for-you?userId=${userId}&page=0&size=20`;
          break;
      }
    }

    const response = await fetch(url, {
      method: 'GET',
      headers: getAuthHeaders()
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: שגיאה בטעינת פיד`);
    }

    const data = await response.json();
    let posts = [];

    if (data.content && Array.isArray(data.content)) {
      posts = data.content;
    } else if (Array.isArray(data)) {
      posts = data;
    }

    // Fallback: If feed returned 0 posts, try fetching single post 1 to showcase content
    if (posts.length === 0 && state.activeTab === 'for-you' && !state.activeTagFilter) {
      try {
        const p1Res = await fetch(`${CONFIG.API_BASE}/api/v1/posts/1`, { headers: getAuthHeaders() });
        if (p1Res.ok) {
          const p1 = await p1Res.json();
          posts = [p1];
        }
      } catch (err) {
        // ignore
      }
    }

    state.posts = posts;
    renderFeed(posts);

    if (countBadge) {
      countBadge.textContent = `${posts.length} פוסטים`;
    }
  } catch (error) {
    console.error('Failed to load feed:', error);
    container.innerHTML = `
      <div class="card glass-card text-center p-4">
        <p style="color: var(--danger); font-weight: 700; margin-bottom: 8px;">שגיאה בחיבור לשירות הפיד / שער הכניסה</p>
        <p style="color: var(--text-muted); font-size: 0.85rem; margin-bottom: 14px;">${error.message}</p>
        <button class="btn btn-secondary btn-sm" onclick="loadFeed()">נסה שוב</button>
      </div>
    `;
    if (countBadge) countBadge.textContent = 'שגיאה';
  }
}

function renderFeed(posts) {
  const container = document.getElementById('feed-container');
  if (!container) return;

  if (posts.length === 0) {
    container.innerHTML = `
      <div class="card glass-card text-center p-4">
        <p style="font-size: 1.1rem; font-weight: 700; margin-bottom: 6px;">אין פוסטים להצגה כרגע</p>
        <p style="color: var(--text-muted); font-size: 0.88rem;">היה הראשון לפרסם פוסט באמצעות התיבה למעלה!</p>
      </div>
    `;
    return;
  }

  container.innerHTML = posts.map(post => createPostCardHtml(post)).join('');

  // Attach interactive listeners for the rendered posts
  posts.forEach(post => {
    attachPostInteractions(post);
  });
}

function createPostCardHtml(post) {
  const avatar = `https://api.dicebear.com/7.x/bottts/svg?seed=${post.authorUsername || 'user'}`;
  const formattedContent = formatPostContent(post.content || '');
  const timeFormatted = formatTimestamp(post.createdAt);
  const postId = post.id || post.postId;

  // Media HTML
  let mediaHtml = '';
  if (post.mediaUrls && post.mediaUrls.length > 0) {
    mediaHtml = `
      <div class="post-media-wrap">
        <img src="${post.mediaUrls[0]}" alt="Post media" loading="lazy" onerror="this.parentElement.style.display='none'">
      </div>
    `;
  }

  // Poll HTML
  let pollHtml = '';
  if (post.poll) {
    const totalVotes = (post.poll.options || []).reduce((acc, opt) => acc + (opt.voteCount || 0), 0);
    const optionsHtml = (post.poll.options || []).map(opt => {
      const pct = totalVotes > 0 ? Math.round(((opt.voteCount || 0) / totalVotes) * 100) : 0;
      return `
        <div class="poll-option-row" data-post-id="${postId}" data-option-id="${opt.id}">
          <div class="poll-bar" style="width: ${pct}%"></div>
          <span class="poll-opt-text">${opt.text}</span>
          <span class="poll-opt-percent">${pct}% (${opt.voteCount || 0})</span>
        </div>
      `;
    }).join('');

    pollHtml = `
      <div class="post-poll-container">
        <div class="poll-question">📊 ${post.poll.question}</div>
        ${optionsHtml}
        <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 6px;">סה"כ קולות: ${totalVotes}</div>
      </div>
    `;
  }

  // Active Reaction display
  const userReaction = post.userReaction;
  const reactionObj = CONFIG.REACTIONS.find(r => r.type === userReaction);
  const totalReactions = post.likesCount || post.totalReactions || 0;
  const commentsCount = post.commentsCount || 0;

  return `
    <article class="post-card" id="post-card-${postId}" data-post-id="${postId}">
      <header class="post-header">
        <div class="post-author-meta">
          <img src="${avatar}" alt="${post.authorUsername}" class="post-author-avatar">
          <div class="post-author-names">
            <span class="post-author-name">${post.authorUsername || 'משתמש'}</span>
            <span class="post-author-handle">@${post.authorUsername || 'user'}</span>
          </div>
        </div>
        <time class="post-timestamp">${timeFormatted}</time>
      </header>

      <div class="post-content">${formattedContent}</div>

      ${mediaHtml}
      ${pollHtml}

      <!-- Action Toolbar -->
      <footer class="post-actions-bar">
        <!-- Reaction Button & Popover Tray -->
        <div class="action-btn-group">
          <button class="action-btn reaction-main-btn ${userReaction ? 'active-reacted' : ''}" data-post-id="${postId}">
            <span class="reaction-icon">${reactionObj ? reactionObj.emoji : '👍'}</span>
            <span class="reaction-label">${reactionObj ? reactionObj.label : 'אהבתי'}</span>
            <span class="reaction-count">(${totalReactions})</span>
          </button>

          <!-- Reaction Hover / Click Tray -->
          <div class="reaction-tray hidden" id="reaction-tray-${postId}">
            ${CONFIG.REACTIONS.map(r => `
              <button class="reaction-emoji-btn" data-post-id="${postId}" data-reaction-type="${r.type}" title="${r.label}">
                ${r.emoji}
              </button>
            `).join('')}
          </div>
        </div>

        <!-- Comments Button -->
        <button class="action-btn btn-comments-toggle" data-post-id="${postId}">
          <span>💬</span>
          <span>תגובות (${commentsCount})</span>
        </button>

        <!-- Bookmark Button -->
        <button class="action-btn btn-bookmark-toggle ${post.bookmarked ? 'active-bookmarked' : ''}" data-post-id="${postId}">
          <span>${post.bookmarked ? '⭐' : '🔖'}</span>
          <span>${post.bookmarked ? 'נשמר' : 'שמור'}</span>
        </button>

        <!-- Repost Button -->
        <button class="action-btn btn-repost-toggle" data-post-id="${postId}">
          <span>🔁</span>
          <span>שתף (${post.repostsCount || 0})</span>
        </button>
      </footer>

      <!-- Comments Thread Drawer (Collapsed by default) -->
      <div class="post-comments-section hidden" id="comments-section-${postId}">
        <div class="comment-input-row">
          <input type="text" class="form-input-sm comment-text-input" placeholder="כתוב תגובה..." id="comment-input-${postId}">
          <button class="btn btn-primary btn-xs btn-submit-comment" data-post-id="${postId}">שלח</button>
        </div>
        <div class="comments-list" id="comments-list-${postId}">
          <div style="font-size: 0.8rem; color: var(--text-muted);">טוען תגובות...</div>
        </div>
      </div>
    </article>
  `;
}

function attachPostInteractions(post) {
  const postId = post.id || post.postId;
  const postCard = document.getElementById(`post-card-${postId}`);
  if (!postCard) return;

  const reactionMainBtn = postCard.querySelector('.reaction-main-btn');
  const reactionTray = document.getElementById(`reaction-tray-${postId}`);

  // Reaction Tray Open/Close
  reactionMainBtn?.addEventListener('mouseenter', () => {
    reactionTray?.classList.remove('hidden');
  });

  postCard.querySelector('.action-btn-group')?.addEventListener('mouseleave', () => {
    reactionTray?.classList.add('hidden');
  });

  // Default Like Click
  reactionMainBtn?.addEventListener('click', (e) => {
    if (e.target.closest('.reaction-tray')) return;
    const currentReaction = post.userReaction;
    const nextReaction = currentReaction ? currentReaction : 'LIKE';
    submitReaction(postId, nextReaction);
  });

  // Reaction Tray Emoji Click
  reactionTray?.querySelectorAll('.reaction-emoji-btn').forEach(emojiBtn => {
    emojiBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const rType = emojiBtn.dataset.reactionType;
      submitReaction(postId, rType);
      reactionTray.classList.add('hidden');
    });
  });

  // Comments Toggle
  const commentsBtn = postCard.querySelector('.btn-comments-toggle');
  const commentsDrawer = document.getElementById(`comments-section-${postId}`);
  commentsBtn?.addEventListener('click', () => {
    const isHidden = commentsDrawer.classList.contains('hidden');
    if (isHidden) {
      commentsDrawer.classList.remove('hidden');
      loadComments(postId);
    } else {
      commentsDrawer.classList.add('hidden');
    }
  });

  // Submit Comment
  const submitCommentBtn = postCard.querySelector('.btn-submit-comment');
  submitCommentBtn?.addEventListener('click', () => {
    handleAddComment(postId);
  });

  const commentInput = document.getElementById(`comment-input-${postId}`);
  commentInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleAddComment(postId);
  });

  // Bookmark Toggle
  const bookmarkBtn = postCard.querySelector('.btn-bookmark-toggle');
  bookmarkBtn?.addEventListener('click', async () => {
    try {
      const res = await fetch(`${CONFIG.API_BASE}/api/v1/posts/${postId}/bookmark`, {
        method: 'POST',
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        post.bookmarked = data.bookmarked;
        bookmarkBtn.classList.toggle('active-bookmarked', data.bookmarked);
        bookmarkBtn.innerHTML = `
          <span>${data.bookmarked ? '⭐' : '🔖'}</span>
          <span>${data.bookmarked ? 'נשמר' : 'שמור'}</span>
        `;
        showToast(data.bookmarked ? 'הפוסט נשמר בסימניות' : 'הפוסט הוסר מהסימניות', 'success');
      }
    } catch (e) {
      showToast('שגיאה בשמירת סימניה', 'error');
    }
  });

  // Repost Button
  const repostBtn = postCard.querySelector('.btn-repost-toggle');
  repostBtn?.addEventListener('click', async () => {
    if (!confirm('האם תרצה לשתף מחדש (Repost) את הפוסט הזה?')) return;
    try {
      const res = await fetch(`${CONFIG.API_BASE}/api/v1/posts/${postId}/repost`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({})
      });
      if (res.ok) {
        showToast('הפוסט שותף מחדש בהצלחה!', 'success');
        loadFeed();
      }
    } catch (e) {
      showToast('שגיאה בשיתוף הפוסט', 'error');
    }
  });

  // Poll Vote options
  postCard.querySelectorAll('.poll-option-row').forEach(row => {
    row.addEventListener('click', async () => {
      const optId = row.dataset.optionId;
      try {
        const res = await fetch(`${CONFIG.API_BASE}/api/v1/posts/${postId}/poll/vote?optionId=${optId}`, {
          method: 'POST',
          headers: getAuthHeaders()
        });
        if (res.ok) {
          showToast('הצבעתך בסקר נקלטה בהצלחה!', 'success');
          loadFeed();
        } else {
          const err = await res.json().catch(() => ({}));
          showToast(err.message || 'לא ניתן להצביע שוב בסקר זה', 'error');
        }
      } catch (e) {
        showToast('שגיאה בהצבעה בסקר', 'error');
      }
    });
  });

  // Clickable hashtag handlers
  postCard.querySelectorAll('.post-tag').forEach(tagEl => {
    tagEl.addEventListener('click', () => {
      const tagText = tagEl.textContent.replace('#', '');
      filterByTag(tagText);
    });
  });
}

// ============================================================================
// Reactions API Call
// ============================================================================

async function submitReaction(postId, reactionType) {
  try {
    const res = await fetch(`${CONFIG.API_BASE}/api/v1/posts/${postId}/reactions`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ reactionType: reactionType })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `שגיאה ${res.status}`);
    }

    const summary = await res.json();

    // Update UI dynamically
    const postCard = document.getElementById(`post-card-${postId}`);
    if (postCard) {
      const mainBtn = postCard.querySelector('.reaction-main-btn');
      const reactionObj = CONFIG.REACTIONS.find(r => r.type === summary.userReaction);

      if (summary.userReaction) {
        mainBtn.classList.add('active-reacted');
        mainBtn.querySelector('.reaction-icon').textContent = reactionObj ? reactionObj.emoji : '👍';
        mainBtn.querySelector('.reaction-label').textContent = reactionObj ? reactionObj.label : 'אהבתי';
      } else {
        mainBtn.classList.remove('active-reacted');
        mainBtn.querySelector('.reaction-icon').textContent = '👍';
        mainBtn.querySelector('.reaction-label').textContent = 'אהבתי';
      }

      mainBtn.querySelector('.reaction-count').textContent = `(${summary.totalReactions})`;
    }

    showToast(summary.userReaction ? `נוספה תגובה: ${reactionType}` : 'התגובה הוסרה (Toggle)', 'success');
  } catch (error) {
    console.error('Error submitting reaction:', error);
    showToast(`שגיאה בשליחת Reaction: ${error.message}`, 'error');
  }
}

// ============================================================================
// Comments Management
// ============================================================================

async function loadComments(postId) {
  const listEl = document.getElementById(`comments-list-${postId}`);
  if (!listEl) return;

  try {
    const res = await fetch(`${CONFIG.API_BASE}/api/v1/posts/${postId}/comments`, {
      headers: getAuthHeaders()
    });

    if (!res.ok) throw new Error('שגיאה בטעינת תגובות');

    const comments = await res.json();
    if (comments.length === 0) {
      listEl.innerHTML = '<div style="font-size: 0.8rem; color: var(--text-muted);">אין תגובות עדיין. היה הראשון להגיב!</div>';
      return;
    }

    listEl.innerHTML = comments.map(c => `
      <div class="comment-bubble">
        <img src="https://api.dicebear.com/7.x/bottts/svg?seed=${c.authorUsername}" class="comment-author-avatar" alt="">
        <div class="comment-body">
          <div class="comment-author">@${c.authorUsername}</div>
          <div class="comment-text">${escapeHtml(c.content)}</div>
        </div>
      </div>
    `).join('');
  } catch (e) {
    listEl.innerHTML = `<div style="font-size: 0.8rem; color: var(--danger);">${e.message}</div>`;
  }
}

async function handleAddComment(postId) {
  const input = document.getElementById(`comment-input-${postId}`);
  if (!input) return;

  const content = input.value.trim();
  if (!content) return;

  try {
    const res = await fetch(`${CONFIG.API_BASE}/api/v1/posts/${postId}/comments`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ content })
    });

    if (!res.ok) throw new Error('שגיאה בפרסום תגובה');

    input.value = '';
    showToast('התגובה נוספה בהצלחה!', 'success');
    loadComments(postId);
  } catch (e) {
    showToast(e.message, 'error');
  }
}

// ============================================================================
// Post Publishing Composer
// ============================================================================

async function handlePublishPost() {
  const contentInput = document.getElementById('composer-content');
  const publishBtn = document.getElementById('btn-publish-post');
  const spinner = publishBtn?.querySelector('.spinner');
  const btnLabel = publishBtn?.querySelector('.btn-label');

  const content = contentInput.value.trim();
  if (!content) {
    showToast('תוכן הפוסט אינו יכול להיות ריק', 'error');
    contentInput.focus();
    return;
  }

  // Extract Hashtags automatically from content (#tag)
  const autoTags = (content.match(/#([\w\u0590-\u05fe]+)/g) || []).map(t => t.replace('#', ''));

  // Media
  const previewImg = document.getElementById('preview-image');
  const mediaUrls = previewImg && previewImg.src && !document.getElementById('composer-media-preview').classList.contains('hidden')
    ? [previewImg.src]
    : [];

  // Poll
  let poll = null;
  const pollBox = document.getElementById('composer-poll-box');
  if (pollBox && !pollBox.classList.contains('hidden')) {
    const question = document.getElementById('poll-question').value.trim();
    const options = Array.from(document.querySelectorAll('.poll-opt-input'))
      .map(inp => inp.value.trim())
      .filter(v => v.length > 0);

    if (question && options.length >= 2) {
      poll = {
        question: question,
        options: options,
        durationHours: 24
      };
    }
  }

  const visibility = document.getElementById('composer-visibility')?.value || 'PUBLIC';

  const payload = {
    content,
    mediaUrls,
    tags: autoTags,
    visibility,
    poll
  };

  try {
    if (publishBtn) publishBtn.disabled = true;
    spinner?.classList.remove('hidden');
    if (btnLabel) btnLabel.textContent = 'מפרסם...';

    const res = await fetch(`${CONFIG.API_BASE}/api/v1/posts`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `שגיאה בפרסום פוסט (${res.status})`);
    }

    const createdPost = await res.json();
    showToast('הפוסט פורסם בהצלחה!', 'success');

    // Reset Form
    contentInput.value = '';
    removeMedia();
    closePollBuilder();

    // Reload Feed & Tags
    loadFeed();
    loadTrendingTags();
  } catch (error) {
    console.error('Publish error:', error);
    showToast(error.message, 'error');
  } finally {
    if (publishBtn) publishBtn.disabled = false;
    spinner?.classList.add('hidden');
    if (btnLabel) btnLabel.textContent = 'פרסם פוסט';
  }
}

// Media attachment helpers
function toggleMediaInput() {
  const wrap = document.getElementById('media-url-input-wrap');
  wrap?.classList.toggle('hidden');
  if (!wrap?.classList.contains('hidden')) {
    document.getElementById('media-url-input')?.focus();
  }
}

function confirmMediaUrl() {
  const input = document.getElementById('media-url-input');
  const url = input?.value.trim();
  if (url) {
    const preview = document.getElementById('composer-media-preview');
    const img = document.getElementById('preview-image');
    if (img && preview) {
      img.src = url;
      preview.classList.remove('hidden');
    }
    input.value = '';
    document.getElementById('media-url-input-wrap')?.classList.add('hidden');
  }
}

function removeMedia() {
  const preview = document.getElementById('composer-media-preview');
  const img = document.getElementById('preview-image');
  if (img) img.src = '';
  preview?.classList.add('hidden');
}

// Poll builder helpers
function togglePollBuilder() {
  const box = document.getElementById('composer-poll-box');
  box?.classList.toggle('hidden');
}

function closePollBuilder() {
  document.getElementById('composer-poll-box')?.classList.add('hidden');
  document.getElementById('poll-question').value = '';
}

function addPollOption() {
  const list = document.getElementById('poll-options-list');
  const currentCount = list.querySelectorAll('.poll-opt-input').length;
  if (currentCount >= 5) {
    showToast('ניתן להגדיר עד 5 אפשרויות בסקר', 'info');
    return;
  }
  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = `אפשרות ${currentCount + 1}`;
  input.className = 'form-input poll-opt-input mb-1';
  list.appendChild(input);
}

function insertHashtagPrompt() {
  const tag = prompt('הזן שם תגית (ללא #):');
  if (tag) {
    const textarea = document.getElementById('composer-content');
    textarea.value += ` #${tag.trim()} `;
    textarea.focus();
  }
}

// ============================================================================
// Trending Hashtags
// ============================================================================

async function loadTrendingTags() {
  const container = document.getElementById('trending-tags-container');
  if (!container) return;

  try {
    const res = await fetch(`${CONFIG.API_BASE}/api/v1/feed/trending-tags?limit=10`, {
      headers: getAuthHeaders()
    });

    if (!res.ok) throw new Error('שגיאה בטעינת תגיות');

    const tags = await res.json();
    state.trendingTags = tags;

    if (tags.length === 0) {
      container.innerHTML = '<span style="font-size: 0.8rem; color: var(--text-muted);">אין תגיות עדיין</span>';
      return;
    }

    container.innerHTML = tags.map(t => {
      const tagName = t.tag || t.hashtag || 'SocialFlow';
      return `
      <button class="trending-tag-chip" data-tag="${tagName}">
        <span>#${tagName}</span>
        <span class="tag-count">${t.count || t.postCount || 1}</span>
      </button>
    `;
    }).join('');

    container.querySelectorAll('.trending-tag-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        filterByTag(btn.dataset.tag);
      });
    });
  } catch (e) {
    container.innerHTML = '<span style="font-size: 0.8rem; color: var(--text-muted);">שירות תגיות לא זמין</span>';
  }
}

function filterByTag(tag) {
  state.activeTagFilter = tag;
  updateFeedHeading();
  loadFeed();
  showToast(`מסנן לפי #${tag}`, 'info');
}

// ============================================================================
// Elasticsearch Live Search
// ============================================================================

function handleSearchInput(e) {
  const query = e.target.value.trim();
  const dropdown = document.getElementById('search-results-dropdown');

  clearTimeout(state.searchDebounceTimer);

  if (query.length < 2) {
    dropdown?.classList.add('hidden');
    return;
  }

  state.searchDebounceTimer = setTimeout(async () => {
    try {
      const res = await fetch(`${CONFIG.API_BASE}/api/v1/search?query=${encodeURIComponent(query)}&page=0&size=5`, {
        headers: getAuthHeaders()
      });

      if (!res.ok) return;

      const data = await res.json();
      const results = data.content || (Array.isArray(data) ? data : []);

      if (results.length === 0) {
        dropdown.innerHTML = '<div class="p-2 text-center" style="font-size: 0.82rem; color: var(--text-muted);">לא נמצאו תוצאות ב-Elasticsearch</div>';
        dropdown.classList.remove('hidden');
        return;
      }

      dropdown.innerHTML = results.map(post => `
        <div class="search-result-item" data-id="${post.id || post.postId}">
          <div class="search-result-header">
            <span>@${post.authorUsername}</span>
            <span>${formatTimestamp(post.createdAt)}</span>
          </div>
          <div class="search-result-content">${escapeHtml(post.content || '')}</div>
        </div>
      `).join('');

      dropdown.classList.remove('hidden');

      dropdown.querySelectorAll('.search-result-item').forEach(item => {
        item.addEventListener('click', () => {
          dropdown.classList.add('hidden');
          filterByTag(query);
        });
      });
    } catch (err) {
      console.error('Search error:', err);
    }
  }, 280);
}

function performDirectSearch(q) {
  state.activeTagFilter = q;
  document.getElementById('search-results-dropdown')?.classList.add('hidden');
  updateFeedHeading();
  loadFeed();
}

// ============================================================================
// Diagnostics & Health Monitor
// ============================================================================

async function checkServicesHealth() {
  try {
    const res = await fetch(`${CONFIG.API_BASE}/api/v1/feed/trending-tags`, { method: 'GET' });
    const pill = document.getElementById('system-status-pill');
    if (res.ok) {
      pill.className = 'status-pill status-healthy';
      pill.querySelector('.status-label').textContent = 'שער הכניסה (8088) פעיל';
    }
  } catch (e) {
    const pill = document.getElementById('system-status-pill');
    if (pill) {
      pill.className = 'status-pill';
      pill.style.borderColor = 'var(--danger)';
      pill.style.color = 'var(--danger)';
      pill.querySelector('.status-dot').style.background = 'var(--danger)';
      pill.querySelector('.status-label').textContent = 'שער הכניסה לא מגיב';
    }
  }
}

function openDiagnosticsModal() {
  document.getElementById('diagnostics-modal')?.classList.remove('hidden');
  runFullDiagnostics();
}

function closeDiagnosticsModal() {
  document.getElementById('diagnostics-modal')?.classList.add('hidden');
}

async function runFullDiagnostics() {
  const grid = document.getElementById('diagnostics-results-grid');
  if (!grid) return;

  grid.innerHTML = '<div style="color: var(--text-muted); padding: 12px;">מבצע בדיקות חיות מול שירותי המערכת...</div>';

  const checks = [
    { name: 'API Gateway (8088)', url: `${CONFIG.API_BASE}/api/v1/feed/trending-tags` },
    { name: 'Post Service (8082)', url: `${CONFIG.API_BASE}/api/v1/posts/1` },
    { name: 'Feed Service (8083)', url: `${CONFIG.API_BASE}/api/v1/feed/for-you?userId=1` },
    { name: 'User Service (8081)', url: `${CONFIG.API_BASE}/api/users/1/following-ids` },
    { name: 'Elasticsearch (ES Index)', url: `${CONFIG.API_BASE}/api/v1/search?query=socialflow` }
  ];

  const results = await Promise.all(checks.map(async check => {
    const startTime = performance.now();
    try {
      const res = await fetch(check.url, { headers: getAuthHeaders(), method: 'GET' });
      const latency = Math.round(performance.now() - startTime);
      return {
        name: check.name,
        pass: res.status < 500,
        statusText: `HTTP ${res.status} (${latency}ms)`
      };
    } catch (e) {
      return {
        name: check.name,
        pass: false,
        statusText: `שגיאת תקשורת / CORS`
      };
    }
  }));

  grid.innerHTML = results.map(r => `
    <div class="diag-item">
      <div class="diag-item-header">
        <span>${r.name}</span>
        <span class="diag-status-badge ${r.pass ? 'pass' : 'fail'}">${r.pass ? 'PASS ✅' : 'FAIL ❌'}</span>
      </div>
      <div class="diag-details">${r.statusText}</div>
    </div>
  `).join('');
}

// ============================================================================
// Auth Modal (Login / Register)
// ============================================================================

function openAuthModal(tab = 'login') {
  document.getElementById('auth-modal')?.classList.remove('hidden');
  switchAuthTab(tab);
}

function closeAuthModal() {
  document.getElementById('auth-modal')?.classList.add('hidden');
}

function switchAuthTab(tab) {
  const loginBtn = document.getElementById('modal-tab-login');
  const regBtn = document.getElementById('modal-tab-register');
  const loginForm = document.getElementById('login-form');
  const regForm = document.getElementById('register-form');

  if (tab === 'login') {
    loginBtn?.classList.add('active');
    regBtn?.classList.remove('active');
    loginForm?.classList.remove('hidden');
    regForm?.classList.add('hidden');
  } else {
    regBtn?.classList.add('active');
    loginBtn?.classList.remove('active');
    regForm?.classList.remove('hidden');
    loginForm?.classList.add('hidden');
  }
}

async function handleLoginSubmit(e) {
  e.preventDefault();
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value.trim();

  try {
    const res = await fetch(`${CONFIG.API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'שם משתמש או סיסמה שגויים');
    }

    const data = await res.json();
    saveUser({
      userId: data.userId || 1,
      username: data.username || username,
      email: data.email || `${username}@example.com`,
      token: data.token || ''
    });

    showToast(`ברוך הבא, @${data.username}!`, 'success');
    closeAuthModal();
    renderAuthSection();
    renderQuickUsers();
    updateComposerAvatar();
    loadFeed();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function handleRegisterSubmit(e) {
  e.preventDefault();
  const username = document.getElementById('reg-username').value.trim();
  const fullName = document.getElementById('reg-fullname').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const password = document.getElementById('reg-password').value.trim();

  try {
    const res = await fetch(`${CONFIG.API_BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, fullName, email, password })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'שגיאה ביצירת משתמש');
    }

    const data = await res.json();
    saveUser({
      userId: data.userId || Date.now(),
      username: data.username || username,
      email: data.email || email,
      token: data.token || ''
    });

    showToast(`נרשמת בהצלחה! שלום @${username}`, 'success');
    closeAuthModal();
    renderAuthSection();
    renderQuickUsers();
    updateComposerAvatar();
    loadFeed();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ============================================================================
// Utilities & Toast Helpers
// ============================================================================

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  const iconMap = {
    success: '✅',
    error: '❌',
    info: 'ℹ️'
  };

  toast.innerHTML = `
    <span>${iconMap[type] || '✨'}</span>
    <span>${escapeHtml(message)}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(-20px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

function formatPostContent(content) {
  let safe = escapeHtml(content);
  // Highlight #hashtags
  safe = safe.replace(/#([\w\u0590-\u05fe]+)/g, '<span class="post-tag">#$1</span>');
  // Highlight @mentions
  safe = safe.replace(/@([\w\u0590-\u05fe]+)/g, '<span class="post-mention">@$1</span>');
  return safe;
}

function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatTimestamp(isoString) {
  if (!isoString) return 'זה עתה';
  try {
    const date = new Date(isoString);
    const now = new Date();
    const diffSec = Math.floor((now - date) / 1000);

    if (diffSec < 60) return 'לפני מספר שניות';
    if (diffSec < 3600) return `לפני ${Math.floor(diffSec / 60)} דק'`;
    if (diffSec < 86400) return `לפני ${Math.floor(diffSec / 3600)} שעות`;
    return date.toLocaleDateString('he-IL', { day: 'numeric', month: 'short' });
  } catch (e) {
    return 'לאחרונה';
  }
}
