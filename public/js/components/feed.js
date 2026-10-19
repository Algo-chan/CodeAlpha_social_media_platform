/**
 * Feed Component & Gated Interaction Interceptor
 * Manages dual feed tabs (Explore vs Following), post composer with thumbnail preview,
 * and gated interaction intercepts for unauthenticated guests.
 */
(function (global) {
  'use strict';

  /**
   * Universal Gated Interaction Interceptor
   * Checks if user is authenticated; if not, intercepts and redirects to
   * #register?redirect=<target>&reason=interact
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
      if (typeof actionCallback === 'function') {
        return actionCallback(user);
      }
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

  /**
   * Render feed for tab: 'explore' or 'following'
   */
  function renderFeed(tab) {
    tab = tab === 'following' ? 'following' : 'explore';

    if (typeof document === 'undefined') {
      return { tab: tab };
    }

    // Update active tab buttons
    var exploreTabBtn = document.getElementById('tab-explore');
    var followingTabBtn = document.getElementById('tab-following');
    if (exploreTabBtn) exploreTabBtn.classList.toggle('active', tab === 'explore');
    if (followingTabBtn) followingTabBtn.classList.toggle('active', tab === 'following');

    var feedContainer = document.getElementById('feed-posts-container');
    if (!feedContainer) return;

    var currentUser = getCurrentUser();

    // If guest clicks Following tab: show engaging prompt to register/login
    if (tab === 'following' && !currentUser) {
      feedContainer.innerHTML = [
        '<div class="empty-state">',
        '  <div class="empty-state-icon">👥</div>',
        '  <h3 class="empty-state-title">Follow creators to fill your feed</h3>',
        '  <p class="empty-state-desc">Sign in to see posts from people you follow, or explore trending public creators.</p>',
        '  <div style="display: flex; gap: 0.75rem; justify-content: center; margin-top: 1rem;">',
        '    <a href="#register?redirect=' + encodeURIComponent('#following') + '&reason=interact" class="btn btn-primary btn-sm">Sign Up</a>',
        '    <a href="#explore" class="btn btn-secondary btn-sm" id="btn-empty-explore">Explore Creators</a>',
        '  </div>',
        '</div>'
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

    // Loading State
    feedContainer.innerHTML = [
      '<div class="empty-state" style="border: none;">',
      '  <div class="form-helper" style="font-size: 1rem;">Loading posts...</div>',
      '</div>'
    ].join('');

    // Fetch feed posts from API
    global.api.get('/posts?tab=' + tab)
      .then(function (res) {
        feedContainer.innerHTML = '';
        var posts = (res && res.data && res.data.posts) ? res.data.posts : [];

        if (posts.length === 0) {
          if (tab === 'following') {
            feedContainer.innerHTML = [
              '<div class="empty-state">',
              '  <div class="empty-state-icon">🌟</div>',
              '  <h3 class="empty-state-title">No posts in your following feed</h3>',
              '  <p class="empty-state-desc">You\'re not following anyone yet. Discover creators in Explore!</p>',
              '  <a href="#explore" class="btn btn-primary btn-sm" id="btn-discover-explore" style="display: inline-flex; margin-top: 0.5rem;">Discover Creators</a>',
              '</div>'
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
              '  <div class="empty-state-icon">✍️</div>',
              '  <h3 class="empty-state-title">Welcome to the Feed</h3>',
              '  <p class="empty-state-desc">No posts found. Share the first post above!</p>',
              '</div>'
            ].join('');
          }
          return;
        }

        posts.forEach(function (post) {
          if (global.postCard && typeof global.postCard.renderPostCard === 'function') {
            var cardEl = global.postCard.renderPostCard(post, currentUser, {
              onDelete: function () {
                // If container becomes empty after deleting
                if (feedContainer.querySelectorAll('.post-card').length === 0) {
                  renderFeed(tab);
                }
              }
            });
            feedContainer.appendChild(cardEl);
          }
        });
      })
      .catch(function (err) {
        feedContainer.innerHTML = [
          '<div class="empty-state">',
          '  <div class="empty-state-icon">⚠️</div>',
          '  <h3 class="empty-state-title">Unable to load feed</h3>',
          '  <p class="empty-state-desc">' + (err.message || 'Please check your connection and try again.') + '</p>',
          '  <button class="btn btn-outline btn-sm" id="btn-retry-feed" type="button">Try Again</button>',
          '</div>'
        ].join('');

        var retryBtn = document.getElementById('btn-retry-feed');
        if (retryBtn) {
          retryBtn.addEventListener('click', function () {
            renderFeed(tab);
          });
        }
      });
  }

  /**
   * Initializes Post Composer (create post form, character counter, file thumbnail preview)
   */
  function initPostComposer() {
    if (typeof document === 'undefined') return;

    var composerContainer = document.getElementById('create-post-container');
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

    var selectedFile = null;

    // Gate interaction when unauthenticated user focuses composer
    contentInput.addEventListener('focus', function () {
      requireAuth(null, '#explore');
    });

    // Character counter live update
    function updateCharCounter() {
      var len = contentInput.value.length;
      if (charCounter) {
        charCounter.textContent = len + ' / 500';
        if (len > 500) {
          charCounter.classList.add('char-counter-over');
          if (submitBtn) submitBtn.disabled = true;
        } else {
          charCounter.classList.remove('char-counter-over');
          if (submitBtn) submitBtn.disabled = false;
        }
      }
    }
    contentInput.addEventListener('input', updateCharCounter);

    // Media File Input Preview & Validation
    if (mediaInput) {
      mediaInput.addEventListener('click', function (e) {
        if (!requireAuth(null, '#explore')) {
          e.preventDefault();
        }
      });

      mediaInput.addEventListener('change', function () {
        var file = mediaInput.files && mediaInput.files[0];
        if (!file) {
          clearMediaPreview();
          return;
        }

        // Validate MIME type
        var allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
        if (!allowedTypes.includes(file.type)) {
          if (global.showToast) {
            global.showToast('Please select a valid image (JPEG, PNG, WebP, GIF)', 'error');
          }
          mediaInput.value = '';
          clearMediaPreview();
          return;
        }

        // Validate File Size (Max 5MB)
        if (file.size > 5 * 1024 * 1024) {
          if (global.showToast) {
            global.showToast('Image size must not exceed 5MB', 'error');
          }
          mediaInput.value = '';
          clearMediaPreview();
          return;
        }

        selectedFile = file;
        if (mediaFilename) mediaFilename.textContent = file.name;

        // Instant client-side thumbnail preview
        if (previewContainer && previewImg) {
          var reader = new FileReader();
          reader.onload = function (e) {
            previewImg.src = e.target.result;
            previewContainer.style.display = 'block';
          };
          reader.readAsDataURL(file);
        }
      });
    }

    function clearMediaPreview() {
      selectedFile = null;
      if (mediaInput) mediaInput.value = '';
      if (mediaFilename) mediaFilename.textContent = '';
      if (previewContainer) previewContainer.style.display = 'none';
      if (previewImg) previewImg.src = '';
    }

    if (removeMediaBtn) {
      removeMediaBtn.addEventListener('click', function (e) {
        e.preventDefault();
        clearMediaPreview();
      });
    }

    // Form Submission
    composerForm.addEventListener('submit', function (e) {
      e.preventDefault();

      if (!requireAuth(null, '#explore')) return;

      var content = contentInput.value.trim();
      if (!content) {
        if (global.showToast) global.showToast('Please enter text for your post', 'error');
        contentInput.focus();
        return;
      }

      if (content.length > 500) {
        if (global.showToast) global.showToast('Post cannot exceed 500 characters', 'error');
        return;
      }

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Posting...';
      }

      var formData = new FormData();
      formData.append('content', content);
      if (selectedFile) {
        formData.append('image', selectedFile);
      }

      global.api.post('/posts', formData, true)
        .then(function (res) {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Post';
          }

          contentInput.value = '';
          updateCharCounter();
          clearMediaPreview();

          if (global.showToast) {
            global.showToast('Post published successfully!', 'success');
          }

          // Prepend new post to feed
          var newPost = res && res.data && res.data.post;
          if (newPost) {
            var feedContainer = document.getElementById('feed-posts-container');
            if (feedContainer && global.postCard && typeof global.postCard.renderPostCard === 'function') {
              // Remove empty state if present
              var emptyState = feedContainer.querySelector('.empty-state');
              if (emptyState) emptyState.remove();

              var currentUser = getCurrentUser();
              var cardEl = global.postCard.renderPostCard(newPost, currentUser);
              if (feedContainer.firstChild) {
                feedContainer.insertBefore(cardEl, feedContainer.firstChild);
              } else {
                feedContainer.appendChild(cardEl);
              }
            }
          }
        })
        .catch(function (err) {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Post';
          }
          if (global.showToast) {
            global.showToast(err.message || 'Unable to create post', 'error');
          }
        });
    });
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
