/**
 * Feed
 * Two tabs (Explore / Following), a post composer with an image preview, and
 * the shared gate that sends signed-out visitors to registration before they
 * can like, comment, follow, or post.
 */
(function (global) {
  'use strict';

  function icon(name, opts) {
    return global.icons && global.icons.svg ? global.icons.svg(name, opts) : '';
  }

  /**
   * Gate for any action that requires an account. Returns the callback result
   * when signed in; otherwise redirects to registration and returns false.
   */
  function requireAuth(actionCallback, target) {
    var user = null;
    try {
      var raw = localStorage.getItem('user');
      user = raw ? JSON.parse(raw) : null;
    } catch (e) {
      user = null;
    }

    var token = (global.api && typeof global.api.getToken === 'function')
      ? global.api.getToken()
      : (typeof localStorage !== 'undefined' ? localStorage.getItem('auth_token') : null);

    if (token && user) {
      if (typeof actionCallback === 'function') return actionCallback(user);
      return true;
    }

    var currentTarget = target || (typeof window !== 'undefined' ? window.location.hash : '') || '#explore';
    var redirectUrl = '#register?redirect=' + encodeURIComponent(currentTarget) + '&reason=interact';

    if (global.router && typeof global.router.navigate === 'function') {
      global.router.navigate(redirectUrl);
    } else if (typeof window !== 'undefined') {
      window.location.hash = redirectUrl;
    }
    return false;
  }

  function getCurrentUser() {
    try {
      var raw = localStorage.getItem('user');
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function renderSkeletons(container) {
    var card = [
      '<div class="skeleton-card" aria-hidden="true">',
      '  <div class="skeleton-row">',
      '    <div class="skeleton skeleton-avatar"></div>',
      '    <div class="skeleton skeleton-line w-40"></div>',
      '  </div>',
      '  <div class="skeleton skeleton-line w-100"></div>',
      '  <div class="skeleton skeleton-line w-80"></div>',
      '  <div class="skeleton skeleton-media"></div>',
      '</div>',
    ].join('');
    container.innerHTML = card + card;
  }

  /**
   * Render the feed for a tab: 'explore' or 'following'.
   */
  function renderFeed(tab) {
    tab = tab === 'following' ? 'following' : 'explore';

    if (typeof document === 'undefined') return { tab: tab };

    var exploreTabBtn = document.getElementById('tab-explore');
    var followingTabBtn = document.getElementById('tab-following');
    if (exploreTabBtn) exploreTabBtn.setAttribute('aria-selected', tab === 'explore' ? 'true' : 'false');
    if (followingTabBtn) followingTabBtn.setAttribute('aria-selected', tab === 'following' ? 'true' : 'false');

    var feedContainer = document.getElementById('feed-posts-container');
    if (!feedContainer) return;

    var currentUser = getCurrentUser();

    // A signed-out visitor on Following gets a prompt, not an empty list.
    if (tab === 'following' && !currentUser) {
      feedContainer.setAttribute('aria-busy', 'false');
      feedContainer.innerHTML = [
        '<div class="empty-state">',
        '  <span class="empty-state-icon" aria-hidden="true">' + icon('users', { size: 22 }) + '</span>',
        '  <h2 class="empty-state-title">Follow creators to fill your feed</h2>',
        '  <p class="empty-state-desc">Sign in to see posts from people you follow, or explore trending public creators.</p>',
        '  <div class="empty-state-actions">',
        '    <a href="#register?redirect=' + encodeURIComponent('#following') + '&reason=interact" class="btn btn-primary btn-sm">Sign up</a>',
        '    <a href="#explore" class="btn btn-outline btn-sm" id="btn-empty-explore">Explore creators</a>',
        '  </div>',
        '</div>',
      ].join('');

      var exploreBtn = document.getElementById('btn-empty-explore');
      if (exploreBtn) {
        exploreBtn.addEventListener('click', function (e) {
          e.preventDefault();
          if (global.router) global.router.navigate('#explore');
        });
      }
      return;
    }

    feedContainer.setAttribute('aria-busy', 'true');
    renderSkeletons(feedContainer);

    global.api.get('/posts?tab=' + tab, { suppressToast: true })
      .then(function (res) {
        feedContainer.setAttribute('aria-busy', 'false');
        feedContainer.innerHTML = '';
        var posts = (res && res.data && res.data.posts) ? res.data.posts : [];

        if (posts.length === 0) {
          if (tab === 'following') {
            feedContainer.innerHTML = [
              '<div class="empty-state">',
              '  <span class="empty-state-icon" aria-hidden="true">' + icon('sparkle', { size: 22 }) + '</span>',
              '  <h2 class="empty-state-title">Your following feed is quiet</h2>',
              '  <p class="empty-state-desc">You\'re not following anyone yet. Discover creators in Explore!</p>',
              '  <div class="empty-state-actions">',
              '    <a href="#explore" class="btn btn-primary btn-sm" id="btn-discover-explore">Discover creators</a>',
              '  </div>',
              '</div>',
            ].join('');

            var discoverBtn = document.getElementById('btn-discover-explore');
            if (discoverBtn) {
              discoverBtn.addEventListener('click', function (e) {
                e.preventDefault();
                if (global.router) global.router.navigate('#explore');
              });
            }
          } else {
            feedContainer.innerHTML = [
              '<div class="empty-state">',
              '  <span class="empty-state-icon" aria-hidden="true">' + icon('pen-square', { size: 22 }) + '</span>',
              '  <h2 class="empty-state-title">No posts here yet</h2>',
              '  <p class="empty-state-desc">Be the first to share something with the community.</p>',
              '</div>',
            ].join('');
          }
          return;
        }

        posts.forEach(function (post, index) {
          if (global.postCard && typeof global.postCard.renderPostCard === 'function') {
            var cardEl = global.postCard.renderPostCard(post, currentUser, {
              onDelete: function () {
                if (feedContainer.querySelectorAll('.post-card').length === 0) renderFeed(tab);
              },
            });
            // Only the first screenful animates in; the rest appear instantly.
            if (index > 3) cardEl.classList.remove('is-new');
            cardEl.classList.add('is-new');
            feedContainer.appendChild(cardEl);
          }
        });
      })
      .catch(function (err) {
        feedContainer.setAttribute('aria-busy', 'false');
        feedContainer.innerHTML = [
          '<div class="empty-state">',
          '  <span class="empty-state-icon" aria-hidden="true">' + icon('alert-circle', { size: 22 }) + '</span>',
          '  <h2 class="empty-state-title">Couldn\'t load the feed</h2>',
          '  <p class="empty-state-desc">' + (err.message || 'Check your connection and try again.') + '</p>',
          '  <div class="empty-state-actions">',
          '    <button class="btn btn-outline btn-sm" id="btn-retry-feed" type="button">Try again</button>',
          '  </div>',
          '</div>',
        ].join('');

        var retryBtn = document.getElementById('btn-retry-feed');
        if (retryBtn) retryBtn.addEventListener('click', function () { renderFeed(tab); });
      });
  }

  /**
   * Post composer: character counter, optional image with an instant preview,
   * and submit handling.
   */
  function initPostComposer() {
    if (typeof document === 'undefined') return;

    var composerForm = document.getElementById('create-post-form');
    var contentInput = document.getElementById('post-content-input');
    var mediaInput = document.getElementById('post-media-input');
    var mediaFilename = document.getElementById('post-media-filename');
    var submitBtn = document.getElementById('btn-submit-post');
    var charCounter = document.getElementById('post-char-counter');
    var previewContainer = document.getElementById('post-media-preview-container');
    var previewImg = document.getElementById('post-media-preview');
    var removeMediaBtn = document.getElementById('btn-remove-media');

    if (!composerForm || !contentInput) return;

    var MAX_LENGTH = 500;
    var selectedFile = null;

    contentInput.addEventListener('focus', function () {
      requireAuth(null, '#explore');
    });

    function updateCharCounter() {
      var len = contentInput.value.length;
      if (charCounter) {
        charCounter.textContent = String(MAX_LENGTH - len);
        var over = len > MAX_LENGTH;
        charCounter.classList.toggle('char-counter-over', over);
        if (submitBtn) submitBtn.disabled = over;
      }
    }
    contentInput.addEventListener('input', updateCharCounter);

    function clearMediaPreview() {
      selectedFile = null;
      if (mediaInput) mediaInput.value = '';
      if (mediaFilename) mediaFilename.textContent = '';
      if (previewContainer) previewContainer.hidden = true;
      if (previewImg) previewImg.removeAttribute('src');
    }

    if (mediaInput) {
      mediaInput.addEventListener('click', function (e) {
        if (!requireAuth(null, '#explore')) e.preventDefault();
      });

      mediaInput.addEventListener('change', function () {
        var file = mediaInput.files && mediaInput.files[0];
        if (!file) { clearMediaPreview(); return; }

        var allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
        if (allowedTypes.indexOf(file.type) === -1) {
          if (global.showToast) global.showToast('That file type isn\'t supported. Use a JPEG, PNG, WebP, or GIF.', 'error');
          clearMediaPreview();
          return;
        }
        if (file.size > 5 * 1024 * 1024) {
          if (global.showToast) global.showToast('That image is over 5MB. Pick a smaller file.', 'error');
          clearMediaPreview();
          return;
        }

        selectedFile = file;
        if (mediaFilename) mediaFilename.textContent = file.name;

        if (previewContainer && previewImg) {
          var reader = new FileReader();
          reader.onload = function (e) {
            previewImg.src = e.target.result;
            previewContainer.hidden = false;
          };
          reader.readAsDataURL(file);
        }
      });
    }

    if (removeMediaBtn) {
      removeMediaBtn.addEventListener('click', function (e) {
        e.preventDefault();
        clearMediaPreview();
      });
    }

    function setSubmitting(on) {
      if (!submitBtn) return;
      submitBtn.disabled = on;
      submitBtn.classList.toggle('is-loading', on);
      submitBtn.setAttribute('aria-busy', on ? 'true' : 'false');
    }

    composerForm.addEventListener('submit', function (e) {
      e.preventDefault();

      if (!requireAuth(null, '#explore')) return;

      var content = contentInput.value.trim();
      if (!content) {
        if (global.showToast) global.showToast('Add some text before posting.', 'error');
        contentInput.focus();
        return;
      }
      if (content.length > MAX_LENGTH) {
        if (global.showToast) global.showToast('Posts are limited to ' + MAX_LENGTH + ' characters.', 'error');
        return;
      }

      setSubmitting(true);

      var formData = new FormData();
      formData.append('content', content);
      if (selectedFile) formData.append('image', selectedFile);

      global.api.post('/posts', formData, true)
        .then(function (res) {
          setSubmitting(false);
          contentInput.value = '';
          updateCharCounter();
          clearMediaPreview();

          if (global.showToast) global.showToast('Your post is live.', 'success');

          var newPost = res && res.data && res.data.post;
          if (!newPost) return;

          var feedContainer = document.getElementById('feed-posts-container');
          if (feedContainer && global.postCard && typeof global.postCard.renderPostCard === 'function') {
            var emptyState = feedContainer.querySelector('.empty-state');
            if (emptyState) emptyState.remove();

            var cardEl = global.postCard.renderPostCard(newPost, getCurrentUser());
            cardEl.classList.add('is-new');
            if (feedContainer.firstChild) feedContainer.insertBefore(cardEl, feedContainer.firstChild);
            else feedContainer.appendChild(cardEl);
            cardEl.scrollIntoView({ block: 'nearest' });
          }
        })
        .catch(function (err) {
          setSubmitting(false);
          if (global.showToast) global.showToast(err.message || 'Couldn\'t publish that post.', 'error');
        });
    });

    updateCharCounter();
  }

  var feed = {
    renderFeed: renderFeed,
    initPostComposer: initPostComposer,
    requireAuth: requireAuth,
    getCurrentUser: getCurrentUser,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = feed;
  }
  global.feed = feed;
  global.requireAuth = requireAuth;
})(typeof window !== 'undefined' ? window : globalThis);
