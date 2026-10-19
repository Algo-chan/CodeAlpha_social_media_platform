/**
 * PostCard
 * Renders one post: author, body, optional media, an optimistic like toggle,
 * an inline comment thread, and a delete action for the author.
 *
 * Markup contract: the class names and text nodes below (`btn-like`,
 * `heart-icon`, `likes-count`, `comments-drawer`, `comment-form`,
 * `placeholder="Write a comment..."`, `btn-post-delete`, `post-media-container`)
 * are relied on by tests/frontend-components.test.js. Change them together.
 */
(function (global) {
  'use strict';

  function escapeHtml(str) {
    if (str === null || str === undefined || str === '') return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function icon(name, opts) {
    return global.icons && global.icons.svg ? global.icons.svg(name, opts) : '';
  }

  function formatTimestamp(dateStr) {
    if (!dateStr) return '';
    try {
      var date = new Date(dateStr);
      if (isNaN(date.getTime())) return '';
      var diffSec = Math.floor((Date.now() - date.getTime()) / 1000);

      if (diffSec < 60) return 'Just now';
      if (diffSec < 3600) return Math.floor(diffSec / 60) + 'm ago';
      if (diffSec < 86400) return Math.floor(diffSec / 3600) + 'h ago';
      if (diffSec < 604800) return Math.floor(diffSec / 86400) + 'd ago';

      var sameYear = date.getFullYear() === new Date().getFullYear();
      return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: sameYear ? undefined : 'numeric',
      });
    } catch (e) {
      return '';
    }
  }

  function absoluteTime(dateStr) {
    if (!dateStr) return '';
    try {
      return new Date(dateStr).toLocaleString();
    } catch (e) {
      return '';
    }
  }

  function count(value) {
    var n = Number(value) || 0;
    return n > 999 ? n.toLocaleString() : String(n);
  }

  function initials(name) {
    return (name || 'U').trim().charAt(0).toUpperCase() || 'U';
  }

  /** Avatar as an <img> when a URL exists, otherwise a tinted initials chip. */
  function avatarMarkup(url, username, large) {
    if (url) {
      var imgCls = large ? 'profile-avatar-large' : 'avatar-sm';
      return (
        '<img src="' + escapeHtml(url) + '" alt="" class="' + imgCls +
        '" loading="lazy" decoding="async">'
      );
    }
    var cls = large ? 'avatar-initials profile-avatar-large' : 'avatar-initials';
    return '<span class="' + cls + '">' + escapeHtml(initials(username)) + '</span>';
  }

  function checkAuth(target) {
    if (typeof global.requireAuth === 'function') {
      return global.requireAuth(null, target);
    }
    var token = global.api && typeof global.api.getToken === 'function' ? global.api.getToken() : null;
    if (token) return true;

    var currentTarget = target || (typeof window !== 'undefined' ? window.location.hash : '') || '#explore';
    var redirectUrl = '#register?redirect=' + encodeURIComponent(currentTarget) + '&reason=interact';
    if (global.router && typeof global.router.navigate === 'function') global.router.navigate(redirectUrl);
    else if (typeof window !== 'undefined') window.location.hash = redirectUrl;
    return false;
  }

  function getPostCardHtml(post, currentUser) {
    post = post || {};
    var author = post.author || {};
    var authorName = author.username || 'user';
    var isAuthor = Boolean(currentUser) &&
      (currentUser.id === post.user_id || currentUser.id === author.id);
    var isLiked = Boolean(post.isLiked);
    var likesCount = Number(post.likesCount) || 0;
    var commentsCount = Number(post.commentsCount) || 0;

    var profileHref = '#profile/' + encodeURIComponent(authorName);

    var imageHtml = post.image_url
      ? '<div class="post-media-container"><img class="post-media" src="' + escapeHtml(post.image_url) +
        '" alt="Image attached to ' + escapeHtml(authorName) + '\'s post" loading="lazy" decoding="async"></div>'
      : '';

    var deleteBtnHtml = isAuthor
      ? '<button class="btn-post-delete" type="button" aria-label="Delete post" title="Delete post">' +
        icon('trash', { size: 16 }) + '</button>'
      : '';

    return [
      '<article class="post-card" data-post-id="' + escapeHtml(post.id) + '">',
      '  <div class="post-header">',
      '    <div class="post-author-info">',
      '      <a href="' + profileHref + '" class="post-author-avatar-link" tabindex="-1" aria-hidden="true">' +
        avatarMarkup(author.avatar_url, authorName, false) + '</a>',
      '      <div class="post-author-meta">',
      '        <a href="' + profileHref + '" class="post-author-name">' + escapeHtml(authorName) + '</a>',
      '        <time class="post-timestamp" datetime="' + escapeHtml(post.created_at || '') +
        '" title="' + escapeHtml(absoluteTime(post.created_at)) + '">' +
        escapeHtml(formatTimestamp(post.created_at)) + '</time>',
      '      </div>',
      '    </div>',
      '    ' + deleteBtnHtml,
      '  </div>',
      '  <div class="post-content">' + escapeHtml(post.content) + '</div>',
      imageHtml,
      '  <div class="post-actions">',
      '    <button type="button" class="btn-like ' + (isLiked ? 'liked' : '') + '" data-action-btn',
      '            aria-pressed="' + (isLiked ? 'true' : 'false') + '"',
      '            aria-label="' + (isLiked ? 'Remove like' : 'Like this post') + '">',
      '      <span class="heart-icon">' + (isLiked ? '❤️' : '🤍') + '</span>',
      '      <span class="likes-count">' + count(likesCount) + '</span>',
      '    </button>',
      '    <button type="button" class="btn-comment-action" data-action-btn aria-expanded="false" aria-label="Show comments">',
      '      <span class="comment-icon">' + icon('comment', { size: 16 }) + '</span>',
      '      <span class="comments-count">' + count(commentsCount) + '</span>',
      '    </button>',
      '  </div>',
      '  <div class="comments-drawer" hidden>',
      '    <form class="comment-form">',
      '      <label class="visually-hidden" for="comment-input-' + escapeHtml(post.id) + '">Write a comment</label>',
      '      <input type="text" id="comment-input-' + escapeHtml(post.id) + '" class="comment-input"',
      '             placeholder="Write a comment..." maxlength="300" required>',
      '      <button type="submit" class="btn btn-primary btn-sm comment-submit-btn">Reply</button>',
      '    </form>',
      '    <div class="comments-list"></div>',
      '  </div>',
      '</article>',
    ].join('\n');
  }

  function renderPostCard(post, currentUser, callbacks) {
    callbacks = callbacks || {};

    if (typeof document === 'undefined') {
      return { html: getPostCardHtml(post, currentUser), post: post };
    }

    var temp = document.createElement('div');
    temp.innerHTML = getPostCardHtml(post, currentUser).trim();
    var cardEl = temp.firstElementChild || temp;

    var likeBtn = cardEl.querySelector('.btn-like');
    var likesCountSpan = cardEl.querySelector('.likes-count');
    var heartSpan = cardEl.querySelector('.heart-icon');
    var commentBtn = cardEl.querySelector('.btn-comment-action');
    var commentsCountSpan = cardEl.querySelector('.comments-count');
    var commentsDrawer = cardEl.querySelector('.comments-drawer');
    var commentForm = cardEl.querySelector('.comment-form');
    var commentInput = cardEl.querySelector('.comment-input');
    var commentsList = cardEl.querySelector('.comments-list');
    var deleteBtn = cardEl.querySelector('.btn-post-delete');

    var commentsLoaded = false;

    function currentHash() {
      return (typeof window !== 'undefined' ? window.location.hash : '') || '#explore';
    }

    // --- Like / unlike, optimistic ------------------------------------------
    if (likeBtn && likesCountSpan) {
      likeBtn.addEventListener('click', function () {
        if (!checkAuth(currentHash())) return;

        var wasLiked = likeBtn.classList.contains('liked');
        var previousCount = parseInt(likesCountSpan.textContent.replace(/[^0-9]/g, ''), 10) || 0;
        var nextLiked = !wasLiked;
        var nextCount = nextLiked ? previousCount + 1 : Math.max(0, previousCount - 1);

        function paint(liked, value) {
          likeBtn.classList.toggle('liked', liked);
          likeBtn.setAttribute('aria-pressed', liked ? 'true' : 'false');
          likeBtn.setAttribute('aria-label', liked ? 'Remove like' : 'Like this post');
          likesCountSpan.textContent = count(value);
          if (heartSpan) heartSpan.textContent = liked ? '❤️' : '🤍';
        }

        paint(nextLiked, nextCount);
        post.isLiked = nextLiked;
        post.likesCount = nextCount;

        if (nextLiked) {
          likeBtn.classList.remove('just-liked');
          void likeBtn.offsetWidth; // force a reflow so the pop can replay
          likeBtn.classList.add('just-liked');
        }

        var call = nextLiked
          ? global.api.post('/posts/' + post.id + '/likes')
          : global.api.delete('/posts/' + post.id + '/likes');

        call
          .then(function (res) {
            if (res && res.data && typeof res.data.likesCount === 'number') {
              paint(nextLiked, res.data.likesCount);
              post.likesCount = res.data.likesCount;
            }
          })
          .catch(function (err) {
            paint(wasLiked, previousCount);
            post.isLiked = wasLiked;
            post.likesCount = previousCount;
            if (global.showToast) global.showToast(err.message || 'Could not update that like.', 'error');
          });
      });
    }

    // --- Comment thread -------------------------------------------------------
    function createCommentElement(c) {
      c = c || {};
      var author = c.author || {};
      var authorName = author.username || 'user';
      var item = document.createElement('div');
      item.className = 'comment-item is-new';
      item.innerHTML = [
        '<div class="comment-header">',
        '  <div class="comment-author-info">',
        '    <a href="#profile/' + encodeURIComponent(authorName) +
          '" class="post-author-avatar-link" tabindex="-1" aria-hidden="true">' +
          avatarMarkup(author.avatar_url, authorName, false) + '</a>',
        '    <a href="#profile/' + encodeURIComponent(authorName) + '" class="comment-author-name">' +
          escapeHtml(authorName) + '</a>',
        '  </div>',
        '  <time class="comment-timestamp" title="' + escapeHtml(absoluteTime(c.created_at)) + '">' +
          escapeHtml(formatTimestamp(c.created_at)) + '</time>',
        '</div>',
        '<div class="comment-content">' + escapeHtml(c.content) + '</div>',
      ].join('');
      return item;
    }

    function renderCommentsList(comments) {
      if (!commentsList) return;
      commentsList.innerHTML = '';
      if (!comments || comments.length === 0) {
        var empty = document.createElement('p');
        empty.className = 'form-helper';
        empty.textContent = 'No comments yet. Start the conversation.';
        commentsList.appendChild(empty);
        return;
      }
      comments.forEach(function (c) {
        commentsList.appendChild(createCommentElement(c));
      });
    }

    function loadComments() {
      if (!commentsList) return;
      commentsList.innerHTML = '<p class="form-helper">Loading comments…</p>';
      global.api
        .get('/posts/' + post.id + '/comments', { suppressToast: true })
        .then(function (res) {
          commentsLoaded = true;
          renderCommentsList((res && res.data && res.data.comments) || []);
        })
        .catch(function () {
          commentsList.innerHTML = '';
          var failed = document.createElement('p');
          failed.className = 'form-error';
          failed.textContent = 'Could not load comments. Try again in a moment.';
          commentsList.appendChild(failed);
        });
    }

    function setDrawerOpen(open) {
      if (!commentsDrawer || !commentBtn) return;
      commentsDrawer.hidden = !open;
      commentBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
      commentBtn.setAttribute('aria-label', open ? 'Hide comments' : 'Show comments');
      if (open && !commentsLoaded) loadComments();
    }

    if (commentBtn && commentsDrawer) {
      commentBtn.addEventListener('click', function () {
        setDrawerOpen(commentsDrawer.hidden);
      });
    }

    // --- Comment submission ----------------------------------------------------
    if (commentForm && commentInput) {
      commentInput.addEventListener('focus', function () {
        checkAuth(currentHash());
      });

      commentForm.addEventListener('submit', function (e) {
        e.preventDefault();
        if (!checkAuth(currentHash())) return;

        var text = commentInput.value.trim();
        if (!text) {
          commentInput.focus();
          return;
        }
        if (text.length > 300) {
          if (global.showToast) global.showToast('Comments are limited to 300 characters.', 'error');
          return;
        }

        var submitBtn = commentForm.querySelector('.comment-submit-btn');
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.classList.add('is-loading');
        }

        global.api
          .post('/posts/' + post.id + '/comments', { content: text })
          .then(function (res) {
            if (submitBtn) {
              submitBtn.disabled = false;
              submitBtn.classList.remove('is-loading');
            }
            commentInput.value = '';

            var newComment = res && res.data && res.data.comment;
            if (!newComment || !commentsList) return;

            var emptyPrompt = commentsList.querySelector('.form-helper');
            if (emptyPrompt) emptyPrompt.remove();

            var el = createCommentElement(newComment);
            if (commentsList.firstChild) commentsList.insertBefore(el, commentsList.firstChild);
            else commentsList.appendChild(el);

            if (commentsCountSpan) {
              var next = (parseInt(commentsCountSpan.textContent.replace(/[^0-9]/g, ''), 10) || 0) + 1;
              commentsCountSpan.textContent = count(next);
              post.commentsCount = next;
            }
            if (global.showToast) global.showToast('Comment added.', 'success');
          })
          .catch(function (err) {
            if (submitBtn) {
              submitBtn.disabled = false;
              submitBtn.classList.remove('is-loading');
            }
            if (global.showToast) global.showToast(err.message || 'Could not post that comment.', 'error');
          });
      });
    }

    // --- Delete -----------------------------------------------------------------
    if (deleteBtn) {
      deleteBtn.addEventListener('click', function () {
        var confirmed =
          typeof window === 'undefined' || !window.confirm
            ? true
            : window.confirm('Delete this post? This cannot be undone.');
        if (!confirmed) return;

        deleteBtn.disabled = true;
        cardEl.classList.add('is-removing');

        global.api
          .delete('/posts/' + post.id)
          .then(function () {
            var done = function () {
              if (cardEl.parentNode) cardEl.parentNode.removeChild(cardEl);
              if (typeof callbacks.onDelete === 'function') callbacks.onDelete(post.id);
            };
            cardEl.addEventListener('transitionend', done, { once: true });
            setTimeout(done, 260);
            if (global.showToast) global.showToast('Post deleted.', 'info');
          })
          .catch(function (err) {
            deleteBtn.disabled = false;
            cardEl.classList.remove('is-removing');
            if (global.showToast) global.showToast(err.message || 'Could not delete that post.', 'error');
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
