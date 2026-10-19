/**
 * PostCard Component
 * Renders post cards with user avatar, timestamp, media attachments,
 * optimistic like button, inline comment drawer, and author delete button.
 */
(function (global) {
  'use strict';

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatTimestamp(dateStr) {
    if (!dateStr) return '';
    try {
      var date = new Date(dateStr);
      var now = new Date();
      var diffMs = now.getTime() - date.getTime();
      var diffSec = Math.floor(diffMs / 1000);
      var diffMin = Math.floor(diffSec / 60);
      var diffHour = Math.floor(diffMin / 60);
      var diffDay = Math.floor(diffHour / 24);

      if (diffSec < 60) return 'Just now';
      if (diffMin < 60) return diffMin + 'm ago';
      if (diffHour < 24) return diffHour + 'h ago';
      if (diffDay < 7) return diffDay + 'd ago';
      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch (e) {
      return '';
    }
  }

  /**
   * Helper to ensure authentication for guest interactions
   */
  function checkAuth(target) {
    if (typeof global.requireAuth === 'function') {
      return global.requireAuth(null, target);
    }
    var token = global.api && typeof global.api.getToken === 'function' ? global.api.getToken() : null;
    if (token) return true;

    var currentTarget = target || (typeof window !== 'undefined' ? window.location.hash : '') || '#explore';
    var redirectUrl = '#register?redirect=' + encodeURIComponent(currentTarget) + '&reason=interact';
    if (global.router && typeof global.router.navigate === 'function') {
      global.router.navigate(redirectUrl);
    } else if (typeof window !== 'undefined') {
      window.location.hash = redirectUrl;
    }
    return false;
  }

  /**
   * Returns HTML string representation of a post card
   */
  function getPostCardHtml(post, currentUser) {
    post = post || {};
    var author = post.author || {};
    var authorName = author.username || 'user';
    var authorInitial = (authorName.charAt(0) || 'U').toUpperCase();
    var avatarHtml = author.avatar_url
      ? '<img src="' + escapeHtml(author.avatar_url) + '" alt="' + escapeHtml(authorName) + '" class="avatar-sm">'
      : '<span class="avatar-initials">' + escapeHtml(authorInitial) + '</span>';

    var isAuthor = currentUser && (currentUser.id === post.user_id || currentUser.id === author.id);
    var isLiked = Boolean(post.isLiked);
    var likesCount = post.likesCount || 0;
    var commentsCount = post.commentsCount || 0;

    var imageHtml = post.image_url
      ? '<div class="post-media-container"><img class="post-media" src="' + escapeHtml(post.image_url) + '" alt="Post media attachment" loading="lazy"></div>'
      : '';

    var deleteBtnHtml = isAuthor
      ? '<button class="btn-post-delete" type="button" aria-label="Delete post" title="Delete post">🗑️</button>'
      : '';

    return [
      '<article class="post-card" data-post-id="' + post.id + '">',
      '  <div class="post-header">',
      '    <div class="post-author-info">',
      '      <a href="#profile/' + encodeURIComponent(authorName) + '" class="nav-user-profile" style="padding:0;">',
      '        ' + avatarHtml,
      '      </a>',
      '      <div>',
      '        <a href="#profile/' + encodeURIComponent(authorName) + '" class="post-author-name">' + escapeHtml(authorName) + '</a>',
      '        <span class="post-author-handle">@' + escapeHtml(authorName) + '</span>',
      '        <span class="post-timestamp" style="margin-left: 0.5rem;">' + escapeHtml(formatTimestamp(post.created_at)) + '</span>',
      '      </div>',
      '    </div>',
      '    ' + deleteBtnHtml,
      '  </div>',
      '  <div class="post-content">' + escapeHtml(post.content) + '</div>',
      imageHtml,
      '  <div class="post-actions">',
      '    <button type="button" class="btn-like ' + (isLiked ? 'liked' : '') + '" aria-label="' + (isLiked ? 'Unlike' : 'Like') + '">',
      '      <span class="heart-icon">' + (isLiked ? '❤️' : '🤍') + '</span>',
      '      <span class="likes-count">' + likesCount + '</span>',
      '    </button>',
      '    <button type="button" class="btn-comment-action" aria-label="Comments">',
      '      <span class="comment-icon">💬</span>',
      '      <span class="comments-count">' + commentsCount + '</span>',
      '    </button>',
      '  </div>',
      '  <div class="comments-drawer" style="display: none;">',
      '    <form class="comment-form">',
      '      <input type="text" class="comment-input form-input" placeholder="Write a comment..." maxlength="300" required>',
      '      <button type="submit" class="btn btn-primary btn-sm comment-submit-btn">Reply</button>',
      '    </form>',
      '    <div class="comments-list"></div>',
      '  </div>',
      '</article>'
    ].join('\n');
  }

  /**
   * Builds an interactive PostCard DOM element
   */
  function renderPostCard(post, currentUser, callbacks) {
    callbacks = callbacks || {};

    if (typeof document === 'undefined') {
      // In environment without DOM, return object with HTML representation
      return {
        html: getPostCardHtml(post, currentUser),
        post: post,
      };
    }

    var temp = document.createElement('div');
    temp.innerHTML = getPostCardHtml(post, currentUser).trim();
    var cardEl = temp.firstElementChild || temp;

    var likeBtn = cardEl.querySelector('.btn-like');
    var heartIcon = cardEl.querySelector('.heart-icon');
    var likesCountSpan = cardEl.querySelector('.likes-count');

    var commentBtn = cardEl.querySelector('.btn-comment-action');
    var commentsCountSpan = cardEl.querySelector('.comments-count');
    var commentsDrawer = cardEl.querySelector('.comments-drawer');
    var commentForm = cardEl.querySelector('.comment-form');
    var commentInput = cardEl.querySelector('.comment-input');
    var commentsList = cardEl.querySelector('.comments-list');
    var deleteBtn = cardEl.querySelector('.btn-post-delete');

    var commentsLoaded = false;

    // --- Like / Unlike Interactivity with Optimistic Updates ---
    if (likeBtn) {
      likeBtn.addEventListener('click', function (e) {
        e.preventDefault();
        var targetHash = (typeof window !== 'undefined' ? window.location.hash : '') || '#explore';
        if (!checkAuth(targetHash)) return;

        var wasLiked = likeBtn.classList.contains('liked');
        var currentCount = parseInt(likesCountSpan.textContent, 10) || 0;
        var nextLiked = !wasLiked;
        var nextCount = nextLiked ? currentCount + 1 : Math.max(0, currentCount - 1);

        // Optimistic UI update
        likeBtn.classList.toggle('liked', nextLiked);
        heartIcon.textContent = nextLiked ? '❤️' : '🤍';
        likesCountSpan.textContent = nextCount;
        post.isLiked = nextLiked;
        post.likesCount = nextCount;

        var apiCall = nextLiked
          ? global.api.post('/posts/' + post.id + '/likes')
          : global.api.delete('/posts/' + post.id + '/likes');

        apiCall.then(function (res) {
          if (res && res.data && typeof res.data.likesCount === 'number') {
            likesCountSpan.textContent = res.data.likesCount;
            post.likesCount = res.data.likesCount;
          }
        }).catch(function (err) {
          // Revert optimistic update on failure
          likeBtn.classList.toggle('liked', wasLiked);
          heartIcon.textContent = wasLiked ? '❤️' : '🤍';
          likesCountSpan.textContent = currentCount;
          post.isLiked = wasLiked;
          post.likesCount = currentCount;
          if (global.showToast) {
            global.showToast(err.message || 'Unable to update like', 'error');
          }
        });
      });
    }

    // --- Inline Comment Drawer Toggle & Loading ---
    function loadComments() {
      if (!commentsList) return;
      commentsList.innerHTML = '<p class="form-helper" style="padding: 0.5rem 0;">Loading comments...</p>';

      global.api.get('/posts/' + post.id + '/comments')
        .then(function (res) {
          commentsLoaded = true;
          var comments = (res && res.data && res.data.comments) ? res.data.comments : [];
          renderCommentsList(comments);
        })
        .catch(function (err) {
          commentsList.innerHTML = '<p class="form-error">Could not load comments</p>';
        });
    }

    function renderCommentsList(comments) {
      if (!commentsList) return;
      commentsList.innerHTML = '';

      if (!comments || comments.length === 0) {
        commentsList.innerHTML = '<p class="form-helper" style="padding: 0.5rem 0; font-style: italic;">No comments yet. Be the first to share your thoughts!</p>';
        return;
      }

      comments.forEach(function (c) {
        commentsList.appendChild(createCommentElement(c));
      });
    }

    function createCommentElement(c) {
      var item = document.createElement('div');
      item.className = 'comment-item';
      var authorName = (c.author && c.author.username) ? c.author.username : 'user';
      var initial = authorName.charAt(0).toUpperCase();
      var avatar = (c.author && c.author.avatar_url)
        ? '<img src="' + escapeHtml(c.author.avatar_url) + '" class="avatar-sm" alt="' + escapeHtml(authorName) + '">'
        : '<span class="avatar-initials avatar-sm">' + escapeHtml(initial) + '</span>';

      item.innerHTML = [
        '<div class="comment-header">',
        '  <div class="comment-author-info">',
        '    ' + avatar,
        '    <a href="#profile/' + encodeURIComponent(authorName) + '" class="comment-author-name">' + escapeHtml(authorName) + '</a>',
        '  </div>',
        '  <span class="comment-timestamp">' + escapeHtml(formatTimestamp(c.created_at)) + '</span>',
        '</div>',
        '<div class="comment-content">' + escapeHtml(c.content) + '</div>'
      ].join('');
      return item;
    }

    if (commentBtn && commentsDrawer) {
      commentBtn.addEventListener('click', function (e) {
        e.preventDefault();
        var isOpen = commentsDrawer.style.display !== 'none';
        if (isOpen) {
          commentsDrawer.style.display = 'none';
        } else {
          commentsDrawer.style.display = 'block';
          if (!commentsLoaded) {
            loadComments();
          }
        }
      });
    }

    // --- Comment Submission (Gated) ---
    if (commentForm && commentInput) {
      commentInput.addEventListener('focus', function () {
        var targetHash = (typeof window !== 'undefined' ? window.location.hash : '') || '#explore';
        checkAuth(targetHash);
      });

      commentForm.addEventListener('submit', function (e) {
        e.preventDefault();
        var targetHash = (typeof window !== 'undefined' ? window.location.hash : '') || '#explore';
        if (!checkAuth(targetHash)) return;

        var text = commentInput.value.trim();
        if (!text) return;
        if (text.length > 300) {
          if (global.showToast) global.showToast('Comment must not exceed 300 characters', 'error');
          return;
        }

        var submitBtn = commentForm.querySelector('.comment-submit-btn');
        if (submitBtn) submitBtn.disabled = true;

        global.api.post('/posts/' + post.id + '/comments', { content: text })
          .then(function (res) {
            if (submitBtn) submitBtn.disabled = false;
            commentInput.value = '';

            var newComment = res && res.data && res.data.comment;
            if (newComment) {
              // Remove empty prompt if present
              var emptyPrompt = commentsList.querySelector('.form-helper');
              if (emptyPrompt) emptyPrompt.remove();

              // Prepend new comment
              var el = createCommentElement(newComment);
              if (commentsList.firstChild) {
                commentsList.insertBefore(el, commentsList.firstChild);
              } else {
                commentsList.appendChild(el);
              }

              // Update comment count
              var currentCommentsCount = parseInt(commentsCountSpan.textContent, 10) || 0;
              commentsCountSpan.textContent = currentCommentsCount + 1;
              post.commentsCount = currentCommentsCount + 1;

              if (global.showToast) {
                global.showToast('Comment posted!', 'success');
              }
            }
          })
          .catch(function (err) {
            if (submitBtn) submitBtn.disabled = false;
            if (global.showToast) {
              global.showToast(err.message || 'Could not post comment', 'error');
            }
          });
      });
    }

    // --- Delete Post Action ---
    if (deleteBtn) {
      deleteBtn.addEventListener('click', function (e) {
        e.preventDefault();
        if (typeof window !== 'undefined' && window.confirm && !window.confirm('Are you sure you want to delete this post?')) {
          return;
        }

        global.api.delete('/posts/' + post.id)
          .then(function () {
            cardEl.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
            cardEl.style.opacity = '0';
            cardEl.style.transform = 'scale(0.95)';
            setTimeout(function () {
              if (cardEl.parentNode) {
                cardEl.parentNode.removeChild(cardEl);
              }
            }, 200);

            if (typeof callbacks.onDelete === 'function') {
              callbacks.onDelete(post.id);
            }
            if (global.showToast) {
              global.showToast('Post deleted', 'info');
            }
          })
          .catch(function (err) {
            if (global.showToast) {
              global.showToast(err.message || 'Unable to delete post', 'error');
            }
          });
      });
    }

    return cardEl;
  }

  var postCard = {
    renderPostCard: renderPostCard,
    getPostCardHtml: getPostCardHtml,
    formatTimestamp: formatTimestamp,
    escapeHtml: escapeHtml,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = postCard;
  }
  global.postCard = postCard;
})(typeof window !== 'undefined' ? window : globalThis);
