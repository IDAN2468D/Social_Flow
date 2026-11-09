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

// Notifications State
const notificationsState = {
  items: [],
  unreadCount: 0,
  stompClient: null,
  isConnected: false,
  pollTimer: null
};

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
  initUser();
  setupEventListeners();
  loadTrendingTags();
  loadFeed();
  checkServicesHealth();
  initNotificationsWebSocket();
  fetchNotifications();
  fetchUnreadNotificationsCount();
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
      state.currentUser = null;
    }
  } else {
    state.currentUser = null;
  }

  // Ensure default active user exists so actions like voting and posting are seamless
  if (!state.currentUser) {
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

function handleLogout() {
  localStorage.removeItem('socialflow_user');
  state.currentUser = null;
  renderAuthSection();
  renderQuickUsers();
  updateComposerAvatar();

  if (notificationsState.stompClient) {
    try { notificationsState.stompClient.disconnect(); } catch (e) {}
  }
  notificationsState.items = [];
  notificationsState.unreadCount = 0;
  updateNotificationBadges();
  renderNotificationsList();

  showToast('התנתקת מהמערכת בהצלחה', 'info');
}

function getAuthHeaders() {
  const headers = {
    'Content-Type': 'application/json',
    'X-Auth-UserId': String(state.currentUser?.userId || 1),
    'X-Auth-Username': state.currentUser?.username || 'idan'
  };

  if (state.currentUser?.token) {
    headers['Authorization'] = `Bearer ${state.currentUser.token}`;
  }

  return headers;
}

function switchUser(userObj) {
  state.currentUser = {
    userId: userObj.userId,
    username: userObj.username,
    fullName: userObj.fullName,
    email: `${userObj.username}@example.com`,
    token: ''
  };
  saveUser(state.currentUser);
  renderAuthSection();
  renderQuickUsers();
  updateComposerAvatar();
  showToast(`הוחלף משתמש אל @${userObj.username}`, 'info');

  initNotificationsWebSocket();
  fetchNotifications();
  fetchUnreadNotificationsCount();

  loadFeed();
}

function renderAuthSection() {
  const authSection = document.getElementById('auth-section');
  if (!authSection) return;

  if (state.currentUser && state.currentUser.username) {
    const user = state.currentUser;
    const avatarUrl = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(user.username)}`;

    authSection.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px;">
        <div class="user-profile-badge" id="btn-user-profile" title="משתמש מחובר: @${user.username}">
          <img src="${avatarUrl}" alt="${user.username}" class="user-badge-avatar">
          <span class="user-badge-name">@${user.username}</span>
        </div>
        <button class="btn btn-secondary btn-sm" id="btn-logout" title="התנתק מהחשבון" style="border-radius: 8px; padding: 6px 12px; font-size: 0.8rem; background: rgba(239, 68, 68, 0.1); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.25); cursor: pointer;">
          <span>🚪</span> התנתק
        </button>
      </div>
    `;

    document.getElementById('btn-logout')?.addEventListener('click', handleLogout);
  } else {
    authSection.innerHTML = `
      <div style="display: flex; gap: 8px; align-items: center;">
        <a href="login.html" class="btn btn-secondary btn-sm" style="border-radius: 8px; padding: 6px 14px; font-weight: 600; text-decoration: none;">
          <span>🔑</span> התחברות
        </a>
        <a href="register.html" class="btn btn-primary btn-sm" style="border-radius: 8px; padding: 6px 14px; font-weight: 600; text-decoration: none;">
          <span>✨</span> הרשמה
        </a>
      </div>
    `;
  }
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
  document.getElementById('btn-trigger-upload')?.addEventListener('click', () => {
    document.getElementById('media-file-input')?.click();
  });
  document.getElementById('media-file-input')?.addEventListener('change', handleMediaFileUpload);
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

  // Notification Bell Toggle & Dropdown Handlers
  const notifToggle = document.getElementById('btn-notifications-toggle');
  const notifDropdown = document.getElementById('notifications-dropdown');
  if (notifToggle && notifDropdown) {
    notifToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      notifDropdown.classList.toggle('hidden');
      if (!notifDropdown.classList.contains('hidden')) {
        fetchNotifications();
        fetchUnreadNotificationsCount();
      }
    });

    document.addEventListener('click', (e) => {
      if (!notifDropdown.contains(e.target) && !notifToggle.contains(e.target)) {
        notifDropdown.classList.add('hidden');
      }
    });
  }

  // Mark all read button in dropdown
  document.getElementById('btn-mark-all-read')?.addEventListener('click', (e) => {
    e.stopPropagation();
    markAllNotificationsAsRead();
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
    'notifications': 'התראות ואירועים חיים (Notifications)',
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

  if (state.activeTab === 'notifications') {
    renderNotificationsFeedPage(container, countBadge);
    return;
  }

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

    // Enrich any posts that have polls with poll question & options from post-service
    const pollPosts = posts.filter(p => (p.hasPoll || p.poll) && (!p.poll || !p.poll.options || p.poll.options.length === 0));
    if (pollPosts.length > 0) {
      await Promise.all(pollPosts.map(async p => {
        try {
          const pId = p.postId || p.id;
          const detailRes = await fetch(`${CONFIG.API_BASE}/api/v1/posts/${pId}`, {
            headers: getAuthHeaders()
          });
          if (detailRes.ok) {
            const detail = await detailRes.json();
            if (detail.poll) {
              p.poll = detail.poll;
            }
          }
        } catch (err) {
          console.warn('Poll enrichment failed for post:', p, err);
        }
      }));
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
    const totalVotes = post.poll.totalVotes != null ? post.poll.totalVotes : (post.poll.options || []).reduce((acc, opt) => acc + (opt.voteCount || 0), 0);
    const hasVoted = post.poll.hasVoted;
    const selectedOptionId = post.poll.selectedOptionId;

    const optionsHtml = (post.poll.options || []).map(opt => {
      const isSelected = opt.selected || (selectedOptionId && selectedOptionId === opt.id);
      const pct = opt.percentage != null && opt.percentage > 0 
        ? Math.round(opt.percentage) 
        : (totalVotes > 0 ? Math.round(((opt.voteCount || 0) / totalVotes) * 100) : 0);
      return `
        <div class="poll-option-row ${isSelected ? 'voted-option' : ''}" data-post-id="${postId}" data-option-id="${opt.id}">
          <div class="poll-bar" style="width: ${pct}%"></div>
          <span class="poll-opt-text">${opt.text} ${isSelected ? '✓' : ''}</span>
          <span class="poll-opt-percent">${pct}% (${opt.voteCount || 0})</span>
        </div>
      `;
    }).join('');

    pollHtml = `
      <div class="post-poll-container" id="poll-container-${postId}">
        <div class="poll-question">📊 ${post.poll.question}</div>
        <div class="poll-options-list">
          ${optionsHtml}
        </div>
        <div class="poll-footer" style="font-size: 0.75rem; color: var(--text-muted); margin-top: 8px; display: flex; justify-content: space-between; align-items: center;">
          <span>סה"כ הצבעות: <strong class="poll-total-count">${totalVotes}</strong></span>
          ${hasVoted ? '<span style="color: var(--accent-primary); font-weight: 600;">✓ הצבעת בסקר</span>' : '<span>לחץ על אפשרות להצבעה</span>'}
        </div>
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

  // Poll Vote delegation on postCard
  postCard.addEventListener('click', async (e) => {
    const row = e.target.closest('.poll-option-row');
    if (!row) return;

    if (!state.currentUser) {
      state.currentUser = { ...CONFIG.DEFAULT_USER };
      saveUser(state.currentUser);
    }

    const optId = row.dataset.optionId;
    if (!optId) return;

    try {
      const res = await fetch(`${CONFIG.API_BASE}/api/v1/posts/${postId}/poll/vote?optionId=${optId}`, {
        method: 'POST',
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const updatedPoll = await res.json();
        showToast('הצבעתך בסקר נקלטה בהצלחה!', 'success');
        const targetPost = state.posts.find(p => (p.postId || p.id) == postId);
        if (targetPost) {
          targetPost.poll = updatedPoll;
        }
        updatePollUI(postId, updatedPoll);
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err.message || 'לא ניתן להצביע שוב בסקר זה', 'error');
      }
    } catch (err) {
      showToast('שגיאה בהצבעה בסקר', 'error');
    }
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
  if (!state.currentUser) {
    showToast('עליך להתחבר כדי לסמן תגובה (Reaction)', 'error');
    return;
  }
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
  if (!state.currentUser) {
    showToast('עליך להתחבר כדי להגיב לפוסט!', 'error');
    setTimeout(() => { window.location.href = 'login.html'; }, 700);
    return;
  }
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
  if (!state.currentUser) {
    state.currentUser = { ...CONFIG.DEFAULT_USER };
    saveUser(state.currentUser);
  }
  const contentInput = document.getElementById('composer-content');
  const publishBtn = document.getElementById('btn-publish-post');
  const spinner = publishBtn?.querySelector('.spinner');
  const btnLabel = publishBtn?.querySelector('.btn-label');

  let content = contentInput.value.trim();

  // Poll
  let poll = null;
  const pollBox = document.getElementById('composer-poll-box');
  if (pollBox && !pollBox.classList.contains('hidden')) {
    const question = document.getElementById('poll-question')?.value.trim() || '';
    const options = Array.from(document.querySelectorAll('.poll-opt-input'))
      .map(inp => inp.value.trim())
      .filter(v => v.length > 0);

    if (question && options.length >= 2) {
      poll = {
        question: question,
        options: options,
        durationHours: 24
      };
      if (!content) {
        content = question;
      }
    } else if (question || options.length > 0) {
      showToast('סקר חייב לכלול שאלת סקר ולפחות 2 אפשרויות בחירה', 'error');
      return;
    }
  }

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

    // Prepend immediately to state.posts for instantaneous UI update
    if (createdPost && (createdPost.id || createdPost.postId)) {
      state.posts = [createdPost, ...state.posts.filter(p => (p.postId || p.id) !== (createdPost.postId || createdPost.id))];
      renderFeed(state.posts);
    }

    // Reload Feed & Tags from backend
    setTimeout(() => {
      loadFeed();
      loadTrendingTags();
    }, 400);
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

async function handleMediaFileUpload(e) {
  const file = e.target.files?.[0];
  if (!file) return;

  const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (!validTypes.includes(file.type)) {
    showToast('קובץ לא נתמך. נא לבחור תמונה מסוג JPG, PNG, WEBP או GIF', 'error');
    e.target.value = '';
    return;
  }

  const spinner = document.getElementById('media-upload-spinner');
  const uploadBtn = document.getElementById('btn-trigger-upload');
  const preview = document.getElementById('composer-media-preview');
  const img = document.getElementById('preview-image');

  try {
    spinner?.classList.remove('hidden');
    if (uploadBtn) uploadBtn.disabled = true;
    showToast('מייצר כתובת העלאה מאובטחת...', 'info');

    // 1. Request presigned URL from Media Service through API Gateway
    const headers = {
      'Content-Type': 'application/json',
      'X-Auth-UserId': String(state.currentUser?.userId || 1),
      'X-Auth-Username': state.currentUser?.username || 'idan'
    };
    if (state.currentUser?.token) {
      headers['Authorization'] = `Bearer ${state.currentUser.token}`;
    }

    const res = await fetch(`${CONFIG.API_BASE}/api/v1/media/upload-url`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        filename: file.name,
        contentType: file.type
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`שגיאה בהנפקת כתובת העלאה: ${res.status}`);
    }

    const { uploadUrl, accessUrl } = await res.json();
    showToast('מעלה את הקובץ לשרת האחסון (MinIO S3)...', 'info');

    // 2. Upload file directly to S3 / MinIO via presigned PUT
    const uploadRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': file.type
      },
      body: file
    });

    if (!uploadRes.ok) {
      throw new Error(`שגיאה בהעלאה ל-S3 (${uploadRes.status})`);
    }

    // 3. Attach image to composer preview
    if (img && preview) {
      img.src = accessUrl;
      preview.classList.remove('hidden');
    }
    document.getElementById('media-url-input-wrap')?.classList.add('hidden');
    showToast('התמונה הועלתה בהצלחה ל-S3 / MinIO!', 'success');
  } catch (err) {
    console.error('Media upload error:', err);
    showToast(`העלאת תמונה נכשלה: ${err.message}`, 'error');
  } finally {
    spinner?.classList.add('hidden');
    if (uploadBtn) uploadBtn.disabled = false;
    e.target.value = '';
  }
}

// Poll builder helpers
function togglePollBuilder() {
  const box = document.getElementById('composer-poll-box');
  if (!box) return;
  const isHidden = box.classList.contains('hidden');
  if (isHidden) {
    box.classList.remove('hidden');
    document.getElementById('poll-question')?.focus();
  } else {
    closePollBuilder();
  }
}

function closePollBuilder() {
  const box = document.getElementById('composer-poll-box');
  if (box) box.classList.add('hidden');
  const q = document.getElementById('poll-question');
  if (q) q.value = '';
  const list = document.getElementById('poll-options-list');
  if (list) {
    list.innerHTML = `
      <input type="text" placeholder="אפשרות 1" class="form-input poll-opt-input mb-1">
      <input type="text" placeholder="אפשרות 2" class="form-input poll-opt-input mb-1">
    `;
  }
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
  input.focus();
}

function updatePollUI(postId, poll) {
  const container = document.getElementById(`poll-container-${postId}`);
  if (!container || !poll) return;

  const totalVotes = poll.totalVotes != null ? poll.totalVotes : (poll.options || []).reduce((acc, opt) => acc + (opt.voteCount || 0), 0);
  const selectedOptionId = poll.selectedOptionId;

  const optionsHtml = (poll.options || []).map(opt => {
    const isSelected = opt.selected || (selectedOptionId && selectedOptionId === opt.id);
    const pct = opt.percentage != null && opt.percentage > 0 
      ? Math.round(opt.percentage) 
      : (totalVotes > 0 ? Math.round(((opt.voteCount || 0) / totalVotes) * 100) : 0);
    return `
      <div class="poll-option-row ${isSelected ? 'voted-option' : ''}" data-post-id="${postId}" data-option-id="${opt.id}">
        <div class="poll-bar" style="width: ${pct}%"></div>
        <span class="poll-opt-text">${opt.text} ${isSelected ? '✓' : ''}</span>
        <span class="poll-opt-percent">${pct}% (${opt.voteCount || 0})</span>
      </div>
    `;
  }).join('');

  container.innerHTML = `
    <div class="poll-question">📊 ${poll.question}</div>
    <div class="poll-options-list">
      ${optionsHtml}
    </div>
    <div class="poll-footer" style="font-size: 0.75rem; color: var(--text-muted); margin-top: 8px; display: flex; justify-content: space-between; align-items: center;">
      <span>סה"כ הצבעות: <strong class="poll-total-count">${totalVotes}</strong></span>
      <span style="color: var(--accent-primary); font-weight: 600;">✓ הצבעת בסקר</span>
    </div>
  `;
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

      const aiAskRow = `
        <div class="search-result-item ai-search-ask-item" style="background: rgba(99, 102, 241, 0.12); border-bottom: 1px solid var(--border-subtle); cursor: pointer;">
          <div style="font-weight: 700; color: var(--accent-primary); display: flex; align-items: center; gap: 6px;">
            <span>✨</span> <span>שאל את מנוע ה-RAG על הפיד:</span>
          </div>
          <div style="font-size: 0.84rem; color: var(--text-main); margin-top: 2px;">"${escapeHtml(query)}"</div>
        </div>
      `;

      if (results.length === 0) {
        dropdown.innerHTML = aiAskRow + '<div class="p-2 text-center" style="font-size: 0.82rem; color: var(--text-muted);">לא נמצאו תוצאות ישירות ב-Elasticsearch</div>';
        dropdown.classList.remove('hidden');
        document.querySelector('.ai-search-ask-item')?.addEventListener('click', () => {
          dropdown.classList.add('hidden');
          askFeedAIRag(query);
        });
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
    { name: 'Media Service & S3 (8084)', url: `${CONFIG.API_BASE}/api/v1/media/health` },
    { name: 'Post Service (8082)', url: `${CONFIG.API_BASE}/api/v1/posts/1` },
    { name: 'Feed Service (8083)', url: `${CONFIG.API_BASE}/api/v1/feed/for-you?userId=1` },
    { name: 'User Service (8081)', url: `${CONFIG.API_BASE}/api/users/1/following-ids` },
    { name: 'Notification Service (8085)', url: `${CONFIG.API_BASE}/api/v1/notifications/unread-count` },
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

// ============================================================================
// Real-Time Notifications & WebSocket Management
// ============================================================================

function initNotificationsWebSocket() {
  if (notificationsState.stompClient && notificationsState.isConnected) {
    try {
      notificationsState.stompClient.disconnect();
    } catch (e) {}
  }

  const userId = state.currentUser ? state.currentUser.userId : 1;
  const wsStatusEl = document.getElementById('ws-status-indicator');

  // Attempt STOMP over SockJS
  if (typeof SockJS !== 'undefined' && typeof Stomp !== 'undefined') {
    try {
      const endpoint = `${CONFIG.API_BASE}/ws/notifications`;
      const socket = new SockJS(endpoint);
      const stompClient = Stomp.over(socket);
      stompClient.debug = null; // Quiet console logging

      stompClient.connect({}, (frame) => {
        notificationsState.isConnected = true;
        notificationsState.stompClient = stompClient;
        if (wsStatusEl) {
          wsStatusEl.className = 'ws-status-pill ws-connected';
          const textEl = wsStatusEl.querySelector('.ws-status-text');
          if (textEl) textEl.textContent = 'חי';
          wsStatusEl.title = 'מחובר ב-WebSocket בזמן אמת';
        }

        // Subscribe to user private channel
        const topic = `/topic/user.${userId}.notifications`;
        stompClient.subscribe(topic, (message) => {
          try {
            const notif = JSON.parse(message.body);
            handleIncomingNotification(notif);
          } catch (err) {
            console.error('Failed to parse incoming notification:', err);
          }
        });
      }, (error) => {
        notificationsState.isConnected = false;
        if (wsStatusEl) {
          wsStatusEl.className = 'ws-status-pill ws-disconnected';
          const textEl = wsStatusEl.querySelector('.ws-status-text');
          if (textEl) textEl.textContent = 'ריענון';
          wsStatusEl.title = 'חיבור WebSocket במצב המתנה - פעיל בריענון אוטומטי';
        }
      });
    } catch (e) {
      console.warn('WebSocket connection attempt failed, using polling fallback', e);
    }
  }

  // Polling fallback
  if (!notificationsState.pollTimer) {
    notificationsState.pollTimer = setInterval(() => {
      fetchUnreadNotificationsCount();
    }, 10000);
  }
}

function handleIncomingNotification(notif) {
  // Prepend to notifications list
  notificationsState.items.unshift(notif);
  notificationsState.unreadCount++;
  updateNotificationBadges();
  renderNotificationsList();

  // Show Toast
  const emoji = getNotificationEmoji(notif.type);
  showToast(`${emoji} ${notif.message}`, 'info');

  // If on notifications tab, refresh page view
  if (state.activeTab === 'notifications') {
    loadFeed();
  }
}

async function fetchNotifications() {
  try {
    const res = await fetch(`${CONFIG.API_BASE}/api/v1/notifications`, {
      method: 'GET',
      headers: getAuthHeaders()
    });
    if (res.ok) {
      const data = await res.json();
      notificationsState.items = Array.isArray(data) ? data : [];
      const unread = notificationsState.items.filter(n => !n.isRead).length;
      notificationsState.unreadCount = unread;
      updateNotificationBadges();
      renderNotificationsList();
    }
  } catch (e) {
    console.error('Error fetching notifications:', e);
  }
}

async function fetchUnreadNotificationsCount() {
  try {
    const res = await fetch(`${CONFIG.API_BASE}/api/v1/notifications/unread-count`, {
      method: 'GET',
      headers: getAuthHeaders()
    });
    if (res.ok) {
      const data = await res.json();
      notificationsState.unreadCount = typeof data.unreadCount === 'number' ? data.unreadCount : 0;
      updateNotificationBadges();
    }
  } catch (e) {
    // Ignore polling failures
  }
}

async function markNotificationAsRead(id, e) {
  if (e) e.stopPropagation();
  try {
    const res = await fetch(`${CONFIG.API_BASE}/api/v1/notifications/${id}/read`, {
      method: 'PATCH',
      headers: getAuthHeaders()
    });
    if (res.ok) {
      const updated = await res.json();
      const idx = notificationsState.items.findIndex(n => n.id === id);
      if (idx !== -1) {
        notificationsState.items[idx].isRead = true;
      }
      notificationsState.unreadCount = Math.max(0, notificationsState.unreadCount - 1);
      updateNotificationBadges();
      renderNotificationsList();
      if (state.activeTab === 'notifications') {
        loadFeed();
      }
    }
  } catch (e) {
    console.error('Error marking notification as read:', e);
  }
}

async function markAllNotificationsAsRead() {
  try {
    const res = await fetch(`${CONFIG.API_BASE}/api/v1/notifications/read-all`, {
      method: 'PATCH',
      headers: getAuthHeaders()
    });
    if (res.ok) {
      notificationsState.items.forEach(n => n.isRead = true);
      notificationsState.unreadCount = 0;
      updateNotificationBadges();
      renderNotificationsList();
      if (state.activeTab === 'notifications') {
        loadFeed();
      }
      showToast('כל ההתראות סומנו כנקראו', 'success');
    }
  } catch (e) {
    console.error('Error marking all notifications as read:', e);
  }
}

function renderNotificationsList() {
  const listEl = document.getElementById('notifications-list');
  if (!listEl) return;

  if (notificationsState.items.length === 0) {
    listEl.innerHTML = `
      <div class="notifications-empty">
        <span class="notifications-empty-icon">🔕</span>
        <span class="notifications-empty-text">אין התראות חדשות</span>
      </div>
    `;
    return;
  }

  listEl.innerHTML = notificationsState.items.slice(0, 20).map(notif => `
    <div class="notification-item ${!notif.isRead ? 'unread' : ''}" onclick="markNotificationAsRead(${notif.id}, event)">
      <div class="notif-badge-icon notif-icon-${notif.type || 'LIKE'}">
        ${getNotificationEmoji(notif.type)}
      </div>
      <div class="notif-content-wrap">
        <span class="notif-message">${escapeHtml(notif.message)}</span>
        <span class="notif-time">${formatNotificationTime(notif.createdAt)}</span>
      </div>
      ${!notif.isRead ? '<span class="unread-dot" title="לא נקרא"></span>' : ''}
    </div>
  `).join('');
}

async function renderNotificationsFeedPage(container, countBadge) {
  if (notificationsState.items.length === 0) {
    await fetchNotifications();
  }

  if (countBadge) countBadge.textContent = `${notificationsState.items.length} התראות`;

  if (notificationsState.items.length === 0) {
    container.innerHTML = `
      <div class="card glass-card empty-feed-card" style="text-align: center; padding: 48px 24px;">
        <div style="font-size: 3rem; margin-bottom: 12px;">🔔</div>
        <h3 style="font-size: 1.2rem; color: var(--text-primary); margin-bottom: 8px;">אין לך התראות כרגע</h3>
        <p style="color: var(--text-muted); font-size: 0.9rem;">כאשר משתמשים יגיבו, יעשו לייק או יעקבו אחריך, תראה את ההתראות כאן בזמן אמת!</p>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; padding: 0 4px;">
      <span style="font-size: 0.9rem; color: var(--text-secondary);">כל ההתראות והאירועים האחרונים של חשבונך</span>
      <button class="btn btn-secondary btn-sm" onclick="markAllNotificationsAsRead()">✓ סמן הכל כנקרא</button>
    </div>
    <div class="notifications-feed-list">
      ${notificationsState.items.map(notif => `
        <div class="notifications-feed-card ${!notif.isRead ? 'unread' : ''}" onclick="markNotificationAsRead(${notif.id}, event)">
          <div class="notif-badge-icon notif-icon-${notif.type || 'LIKE'}">
            ${getNotificationEmoji(notif.type)}
          </div>
          <div class="notif-content-wrap">
            <span class="notif-message">${escapeHtml(notif.message)}</span>
            <span class="notif-time">${formatNotificationTime(notif.createdAt)}</span>
          </div>
          ${!notif.isRead ? '<span class="unread-dot" title="לא נקרא"></span>' : '<span style="color: var(--text-muted); font-size: 0.8rem;">נקרא</span>'}
        </div>
      `).join('')}
    </div>
  `;
}

function updateNotificationBadges() {
  const count = notificationsState.unreadCount;
  const bellBadge = document.getElementById('unread-notifications-count');
  const sidebarBadge = document.getElementById('sidebar-unread-badge');

  if (bellBadge) {
    if (count > 0) {
      bellBadge.textContent = count > 99 ? '99+' : count;
      bellBadge.classList.remove('hidden');
    } else {
      bellBadge.classList.add('hidden');
    }
  }

  if (sidebarBadge) {
    if (count > 0) {
      sidebarBadge.textContent = count > 99 ? '99+' : count;
      sidebarBadge.classList.remove('hidden');
    } else {
      sidebarBadge.classList.add('hidden');
    }
  }
}

function getNotificationEmoji(type) {
  switch (type) {
    case 'LIKE': return '❤️';
    case 'COMMENT': return '💬';
    case 'FOLLOW': return '👤';
    default: return '🔔';
  }
}

function formatNotificationTime(timestamp) {
  if (!timestamp) return 'הרגע';
  try {
    const date = new Date(timestamp);
    const now = new Date();
    const diffSec = Math.floor((now - date) / 1000);
    if (diffSec < 60) return 'לפני מספר שניות';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `לפני ${diffMin} דקות`;
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `לפני ${diffHour} שעות`;
    const diffDays = Math.floor(diffHour / 24);
    return `לפני ${diffDays} ימים`;
  } catch (e) {
    return 'לאחרונה';
  }
}

/* =========================================================================
   SocialFlow Modern UI Handlers: Stories, AI Assist, Messenger & Follow
   ========================================================================= */

document.addEventListener('DOMContentLoaded', () => {
  initSocialShowcaseFeatures();
});

let storyTimer = null;

function initSocialShowcaseFeatures() {
  // 1. AI Enhance Button (Gemini 3.5 Flash-Lite)
  const aiBtn = document.getElementById('btn-ai-enhance');
  if (aiBtn) {
    aiBtn.addEventListener('click', async () => {
      const textarea = document.getElementById('composer-content');
      const text = textarea?.value?.trim();
      if (!text) {
        showToast('כתוב תחילה טיוטה של פוסט לפני השיפור עם AI', 'info');
        return;
      }

      aiBtn.disabled = true;
      aiBtn.innerHTML = '<span>⏳</span> <span>משפר עם Gemini...</span>';

      try {
        const res = await fetch(`${CONFIG.API_BASE}/api/v1/ai/analyze`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: text })
        });

        if (res.ok) {
          const data = await res.json();
          let tags = '';
          if (data.suggested_tags && Array.isArray(data.suggested_tags)) {
            tags = ' ' + data.suggested_tags.map(t => t.startsWith('#') ? t : `#${t}`).join(' ');
          }
          textarea.value = text + '\n\n' + tags.trim();
          showToast('הפוסט שופר בהצלחה והתווספו האשטאגים מותאמים! ✨', 'success');
        } else {
          showToast('לא ניתן היה לעבד עם שירות ה-AI כעת', 'info');
        }
      } catch (e) {
        console.error(e);
        showToast('שגיאה בחיבור ל-ai-service', 'error');
      } finally {
        aiBtn.disabled = false;
        aiBtn.innerHTML = '<span>✨</span> <span>שפר עם AI</span>';
      }
    });
  }

  // 1.1 LangGraph Autonomous Agent Integration
  const btnLangGraph = document.getElementById('btn-langgraph-agent');
  const agentModal = document.getElementById('agent-modal');
  const btnCloseAgentModal = document.getElementById('btn-close-agent-modal');
  const btnStartAgent = document.getElementById('btn-start-agent');
  const agentTopicInput = document.getElementById('agent-topic-input');
  const agentAudienceInput = document.getElementById('agent-audience-input');
  const agentProgressBox = document.getElementById('agent-progress-box');
  const agentLogsList = document.getElementById('agent-logs-list');
  const agentResultBox = document.getElementById('agent-result-box');
  const agentDraftPreview = document.getElementById('agent-draft-preview');
  const agentPollPreview = document.getElementById('agent-poll-preview');
  const btnApprovePublish = document.getElementById('btn-agent-approve-publish');
  const btnCopyEditor = document.getElementById('btn-agent-copy-editor');

  let currentAgentState = null;

  if (btnLangGraph && agentModal) {
    btnLangGraph.addEventListener('click', () => {
      agentModal.classList.remove('hidden');
      agentTopicInput?.focus();
    });

    btnCloseAgentModal?.addEventListener('click', () => {
      agentModal.classList.add('hidden');
    });

    agentModal.addEventListener('click', (e) => {
      if (e.target === agentModal) agentModal.classList.add('hidden');
    });

    btnStartAgent?.addEventListener('click', async () => {
      const topic = agentTopicInput?.value.trim();
      if (!topic) {
        showToast('אנא הזן נושא למחקר וניסוח על ידי הסוכן', 'info');
        return;
      }

      const audience = agentAudienceInput?.value.trim() || 'קהל כללי';

      btnStartAgent.disabled = true;
      btnStartAgent.innerHTML = '<span>⏳</span> <span>סוכן LangGraph חוקר ומנסח...</span>';
      agentProgressBox.classList.remove('hidden');
      agentResultBox.classList.add('hidden');
      agentLogsList.innerHTML = '<div>🚀 מאתחל StateGraph של LangGraph...</div>';

      try {
        const res = await fetch(`${CONFIG.API_BASE}/api/v1/ai/agent/run`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            topic: topic,
            user_id: STATE.currentUser.id || 1,
            target_audience: audience,
            user_approved: false
          })
        });

        if (res.ok) {
          const result = await res.json();
          currentAgentState = result;

          if (result.logs && Array.isArray(result.logs)) {
            agentLogsList.innerHTML = result.logs.map(log => `<div>${log}</div>`).join('');
          }

          agentDraftPreview.textContent = result.draft_content || '';
          if (result.suggested_poll && result.suggested_poll.question) {
            agentPollPreview.classList.remove('hidden');
            const opts = (result.suggested_poll.options || []).map(o => `<li>• ${o}</li>`).join('');
            agentPollPreview.innerHTML = `<strong>📊 סקר מוצע:</strong> ${result.suggested_poll.question}<ul style="margin:4px 0 0 16px; padding:0;">${opts}</ul>`;
          } else {
            agentPollPreview.classList.add('hidden');
          }

          agentResultBox.classList.remove('hidden');
          showToast('הסוכן השלים את המחקר והניסוח וממתין לאישורך! 🤖', 'success');
        } else {
          showToast(`שגיאה בהפעלת הסוכן: HTTP ${res.status}`, 'error');
        }
      } catch (err) {
        console.error(err);
        showToast('שגיאת חיבור ל-LangGraph Agent', 'error');
      } finally {
        btnStartAgent.disabled = false;
        btnStartAgent.innerHTML = '<span>🚀</span> <span>הפעל סוכן לחקר וניסוח</span>';
      }
    });

    btnApprovePublish?.addEventListener('click', async () => {
      if (!currentAgentState) return;
      btnApprovePublish.disabled = true;
      btnApprovePublish.textContent = '⏳ מפרסם בפיד...';

      try {
        const res = await fetch(`${CONFIG.API_BASE}/api/v1/ai/agent/run`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            topic: currentAgentState.topic,
            user_id: STATE.currentUser.id || 1,
            target_audience: currentAgentState.target_audience,
            user_approved: true
          })
        });

        if (res.ok) {
          showToast('הפוסט פורסם בהצלחה בפיד על ידי סוכן ה-AI! 🎉', 'success');
          agentModal.classList.add('hidden');
          loadFeed();
        } else {
          showToast('שגיאה בפרסום הפוסט', 'error');
        }
      } catch (e) {
        console.error(e);
        showToast('שגיאת תקשורת בפרסום', 'error');
      } finally {
        btnApprovePublish.disabled = false;
        btnApprovePublish.textContent = '✓ אשר ופרסם בפיד';
      }
    });

    btnCopyEditor?.addEventListener('click', () => {
      if (!currentAgentState) return;
      const textarea = document.getElementById('composer-content');
      if (textarea) {
        let text = currentAgentState.draft_content;
        if (currentAgentState.suggested_tags && currentAgentState.suggested_tags.length) {
          text += '\n\n' + currentAgentState.suggested_tags.map(t => `#${t}`).join(' ');
        }
        textarea.value = text;
        showToast('התוכן הועבר בהצלחה לעורך הראשי!', 'success');
        agentModal.classList.add('hidden');
        textarea.scrollIntoView({ behavior: 'smooth' });
      }
    });
  }

  // 2. Stories Viewer & Creator Interaction
  const storyModal = document.getElementById('story-modal');
  const btnCloseStory = document.getElementById('btn-close-story');
  const progressFill = document.getElementById('story-progress-fill');

  function openStoryViewer(name, img, avatar) {
    document.getElementById('story-viewer-name').textContent = name;
    document.getElementById('story-viewer-avatar').src = avatar;
    document.getElementById('story-viewer-img').src = img;

    storyModal?.classList.remove('hidden');

    if (progressFill) {
      progressFill.style.width = '0%';
      setTimeout(() => { progressFill.style.width = '100%'; }, 50);
    }

    clearTimeout(storyTimer);
    storyTimer = setTimeout(() => {
      closeStory();
    }, 5000);
  }

  function setupStoryClick(item) {
    item.addEventListener('click', () => {
      const name = item.dataset.name || 'משתמש';
      const img = item.dataset.img || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb';
      const avatar = item.querySelector('.story-avatar')?.src || '';
      openStoryViewer(name, img, avatar);
      item.querySelector('.story-avatar-wrapper')?.classList.remove('unread');
    });
  }

  document.querySelectorAll('.story-item:not(.create-story)').forEach(setupStoryClick);

  // Create Story Handler
  const btnCreateStory = document.getElementById('btn-create-story');
  btnCreateStory?.addEventListener('click', () => {
    const storyText = prompt('הזן כיתוב או תיאור לסטורי שלך (למשל: סיימתי לפתח את המיקרו-שירותים של SocialFlow! 🚀):');
    if (!storyText || !storyText.trim()) return;

    const imgOptions = [
      'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80'
    ];
    const chosenImg = imgOptions[Math.floor(Math.random() * imgOptions.length)];

    const newStory = document.createElement('div');
    newStory.className = 'story-item';
    newStory.dataset.user = state.currentUser?.username || 'idan';
    newStory.dataset.name = state.currentUser?.fullName || 'הסטורי שלך';
    newStory.dataset.img = chosenImg;
    newStory.innerHTML = `
      <div class="story-avatar-wrapper unread">
        <img src="https://api.dicebear.com/7.x/bottts/svg?seed=${state.currentUser?.username || 'idan'}" alt="My Story" class="story-avatar">
      </div>
      <span class="story-username">${escapeHtml(storyText.slice(0, 10))}...</span>
    `;

    btnCreateStory.after(newStory);
    setupStoryClick(newStory);
    showToast('הסטורי שלך פורסם בהצלחה ופעיל ל-24 שעות! 📸', 'success');
  });

  btnCloseStory?.addEventListener('click', closeStory);
  storyModal?.addEventListener('click', (e) => {
    if (e.target === storyModal) closeStory();
  });

  function closeStory() {
    clearTimeout(storyTimer);
    storyModal?.classList.add('hidden');
    if (progressFill) progressFill.style.width = '0%';
  }

  // 3. Messenger Drawer Interaction
  const btnMessenger = document.getElementById('btn-open-messenger');
  const messengerDrawer = document.getElementById('messenger-drawer');
  const btnCloseMessenger = document.getElementById('btn-close-messenger');
  const messengerInput = document.getElementById('messenger-input');
  const btnSendMessage = document.getElementById('btn-send-message');
  const messengerBody = document.getElementById('messenger-body');

  btnMessenger?.addEventListener('click', () => {
    messengerDrawer?.classList.toggle('hidden');
    messengerInput?.focus();
  });

  btnCloseMessenger?.addEventListener('click', () => {
    messengerDrawer?.classList.add('hidden');
  });

  async function sendChatMessage() {
    const text = messengerInput?.value?.trim();
    if (!text) return;

    const time = new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble outgoing';
    bubble.innerHTML = `<span>${escapeHtml(text)}</span><span class="bubble-time">${time}</span>`;
    messengerBody?.appendChild(bubble);
    messengerInput.value = '';
    messengerBody.scrollTop = messengerBody.scrollHeight;

    const activeFriendName = document.getElementById('chat-active-name')?.textContent || 'דניאל לוי';

    // Call live AI chat endpoint for intelligent Hebrew replies
    try {
      const res = await fetch(`${CONFIG.API_BASE}/api/v1/ai/chat-reply`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ sender: activeFriendName, message: text })
      });
      if (res.ok) {
        const data = await res.json();
        const replyTime = new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
        const replyBubble = document.createElement('div');
        replyBubble.className = 'chat-bubble incoming';
        replyBubble.innerHTML = `<span>${escapeHtml(data.reply || 'תודה על ההודעה!')}</span><span class="bubble-time">${replyTime}</span>`;
        messengerBody?.appendChild(replyBubble);
        messengerBody.scrollTop = messengerBody.scrollHeight;
        return;
      }
    } catch (err) {
      console.warn('AI chat reply fallback:', err);
    }

    setTimeout(() => {
      const replyBubble = document.createElement('div');
      replyBubble.className = 'chat-bubble incoming';
      replyBubble.innerHTML = `<span>אחלה רעיון! תודה על העדכון 👍</span><span class="bubble-time">${time}</span>`;
      messengerBody?.appendChild(replyBubble);
      messengerBody.scrollTop = messengerBody.scrollHeight;
    }, 1000);
  }

  btnSendMessage?.addEventListener('click', sendChatMessage);
  messengerInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendChatMessage();
  });

  // 4. Follow buttons on suggestions
  document.querySelectorAll('.btn-follow-toggle').forEach(btn => {
    btn.addEventListener('click', function() {
      if (this.classList.contains('following')) {
        this.classList.remove('following');
        this.textContent = 'עקוב';
      } else {
        this.classList.add('following');
        this.textContent = 'עוקב ✓';
        showToast('נוסף לרשימת הנעקבים שלך!', 'success');
      }
    });
  });

  // 5. Brand click returns to For-You feed
  document.getElementById('nav-brand-logo')?.addEventListener('click', () => {
    document.getElementById('nav-for-you')?.click();
  });
}

window.openChatWith = function(name, avatar) {
  const drawer = document.getElementById('messenger-drawer');
  document.getElementById('chat-active-name').textContent = name;
  document.getElementById('chat-active-avatar').src = avatar;
  drawer?.classList.remove('hidden');
  document.getElementById('messenger-input')?.focus();
};


// ============================================================================
// AI Feed RAG & Semantic QA
// ============================================================================

async function askFeedAIRag(question) {
  const container = document.getElementById('feed-container');
  if (!container) return;

  showToast('מפעיל שאילתת RAG חכמה עם Gemini 3.5 Flash-Lite...', 'info');

  const skeletonCard = document.createElement('div');
  skeletonCard.className = 'card glass-card p-4 mb-3 ai-rag-card';
  skeletonCard.innerHTML = `
    <div style="display: flex; align-items: center; gap: 8px; color: var(--accent-primary); font-weight: 700; margin-bottom: 8px;">
      <span class="pulse-dot"></span> <span>עוזר הפיד (RAG Intelligence Engine) מעבד את שאלתך: "${escapeHtml(question)}"...</span>
    </div>
    <div style="font-size: 0.88rem; color: var(--text-muted);">סורק פוסטים וסקרים אחרונים ב-SocialFlow...</div>
  `;
  container.prepend(skeletonCard);

  try {
    const res = await fetch(`${CONFIG.API_BASE}/api/v1/ai/ask-feed`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ question, posts: state.posts })
    });

    if (!res.ok) throw new Error('שגיאה בתקשורת עם מנוע ה-AI');
    const data = await res.json();

    skeletonCard.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; border-bottom: 1px solid var(--border-subtle); padding-bottom: 8px;">
        <div style="display: flex; align-items: center; gap: 8px; font-weight: 700; color: var(--accent-primary);">
          <span>✨</span> <span>תשובת מנוע ה-RAG (Gemini 3.5 Flash-Lite)</span>
        </div>
        <button class="btn-text-xs" onclick="this.closest('.ai-rag-card').remove()">סגור</button>
      </div>
      <div style="font-size: 0.92rem; line-height: 1.6; color: var(--text-main); white-space: pre-wrap; margin-bottom: 10px;">
        ${escapeHtml(data.answer || 'לא התקבלה תשובה')}
      </div>
      <div style="font-size: 0.76rem; color: var(--text-muted); display: flex; gap: 12px;">
        <span>📊 פוסטים שנסרקו: <strong>${data.relevant_posts_count || state.posts.length}</strong></span>
        <span>⚡ מודל: <strong>Gemini 3.5 Flash-Lite</strong></span>
      </div>
    `;
  } catch (err) {
    skeletonCard.innerHTML = `
      <div style="color: var(--danger); font-weight: 700;">שגיאה בביצוע שאילתת RAG</div>
      <div style="font-size: 0.82rem; color: var(--text-muted);">${err.message}</div>
    `;
  }
}
