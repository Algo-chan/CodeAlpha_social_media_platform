/**
 * ProfileView
 * A profile header (avatar, name, handle, bio, join date), a stats row,
 * follow / unfollow with an optimistic update, an inline editor for your own
 * profile, and the user's posts.
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

  function getCurrentUser() {
    try {
      var raw = localStorage.getItem('user');
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function formatJoinedDate(dateStr) {
    if (!dateStr) return '';
    try {
      var d = new Date(dateStr);
      if (isNaN(d.getTime())) return '';
      return 'Joined ' + d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    } catch (e) {
      return '';
    }
  }

  function avatarHtmlFor(user, large) {
    var username = (user && user.username) || 'U';
    if (user && user.avatar_url) {
      var cls = large ? 'profile-avatar-large' : 'avatar-sm';
      return '<img src="' + escapeHtml(user.avatar_url) + '" alt="" class="' + cls +
        '" loading="lazy" decoding="async">';
    }
    var initial = username.charAt(0).toUpperCase() || 'U';
    var spanCls = large ? 'avatar-initials profile-avatar-large' : 'avatar-initials';
    return '<span class="' + spanCls + '">' + escapeHtml(initial) + '</span>';
  }

  /** Render the Profile view for a username. */
  function renderProfile(username) {
    if (!username) return;
    if (typeof document === 'undefined') return { username: username };

    var headingEl = document.getElementById('profile-heading');
    var handleEl = document.getElementById('profile-handle');
    var bioEl = document.getElementById('profile-bio');
    var joinedEl = document.getElementById('profile-joined-date');
    var avatarEl = document.getElementById('profile-avatar');
    var actionContainer = document.getElementById('profile-action-container');
    var statPosts = document.getElementById('stat-posts-count');
    var statFollowers = document.getElementById('stat-followers-count');
    var statFollowing = document.getElementById('stat-following-count');
    var postsContainer = document.getElementById('profile-posts-container');
    var editContainer = document.getElementById('profile-edit-container');

    if (headingEl) headingEl.textContent = username;
    if (handleEl) handleEl.textContent = '@' + username;
    if (bioEl) bioEl.textContent = 'Loading profile…';
    if (joinedEl) joinedEl.textContent = '';
    if (actionContainer) actionContainer.innerHTML = '';
    if (editContainer) {
      editContainer.style.display = 'none';
      editContainer.innerHTML = '';
    }
    if (postsContainer) {
      postsContainer.setAttribute('aria-busy', 'true');
      postsContainer.innerHTML = [
        '<div class="skeleton-card" aria-hidden="true">',
        '  <div class="skeleton-row">',
        '    <div class="skeleton skeleton-avatar"></div>',
        '    <div class="skeleton skeleton-line w-40"></div>',
        '  </div>',
        '  <div class="skeleton skeleton-line w-100"></div>',
        '  <div class="skeleton skeleton-line w-60"></div>',
        '</div>',
      ].join('');
    }

    var currentUser = getCurrentUser();

    global.api.get('/users/' + encodeURIComponent(username), { suppressToast: true })
      .then(function (res) {
        var user = res && res.data ? res.data : null;
        if (!user) return;

        if (headingEl) headingEl.textContent = user.username;
        if (handleEl) handleEl.textContent = '@' + user.username;
        if (bioEl) bioEl.textContent = user.bio || 'No bio yet.';
        if (joinedEl) joinedEl.textContent = formatJoinedDate(user.created_at);
        if (avatarEl) avatarEl.innerHTML = avatarHtmlFor(user, true);

        if (statPosts) statPosts.textContent = user.postsCount !== undefined ? user.postsCount : (user.posts ? user.posts.length : 0);
        if (statFollowers) statFollowers.textContent = user.followersCount || 0;
        if (statFollowing) statFollowing.textContent = user.followingCount || 0;

        var isOwnProfile = Boolean(currentUser) && currentUser.username === user.username;
        renderProfileAction(actionContainer, user, currentUser, isOwnProfile, statFollowers);
        renderProfilePosts(postsContainer, user, currentUser, statPosts, username);
      })
      .catch(function (err) {
        if (headingEl) headingEl.textContent = 'User not found';
        if (handleEl) handleEl.textContent = '';
        if (bioEl) bioEl.textContent = '';
        if (joinedEl) joinedEl.textContent = '';
        if (postsContainer) {
          postsContainer.setAttribute('aria-busy', 'false');
          postsContainer.innerHTML = [
            '<div class="empty-state">',
            '  <span class="empty-state-icon" aria-hidden="true">' +
              (global.icons ? global.icons.svg('search-x', { size: 22 }) : '') + '</span>',
            '  <h2 class="empty-state-title">Profile unavailable</h2>',
            '  <p class="empty-state-desc">' + escapeHtml(err.message || 'This account doesn\u2019t exist or was removed.') + '</p>',
            '  <div class="empty-state-actions">',
            '    <a href="#explore" class="btn btn-primary btn-sm">Back to Explore</a>',
            '  </div>',
            '</div>',
          ].join('');
        }
      });
  }

  function renderProfileAction(container, user, currentUser, isOwnProfile, statFollowers) {
    if (!container) return;
    container.innerHTML = '';

    if (isOwnProfile) {
      var editBtn = document.createElement('button');
      editBtn.id = 'btn-edit-profile-toggle';
      editBtn.className = 'btn btn-outline btn-sm';
      editBtn.type = 'button';
      editBtn.textContent = 'Edit Profile';
      editBtn.addEventListener('click', function () { toggleProfileEditor(user); });
      container.appendChild(editBtn);
      return;
    }

    var followBtn = document.createElement('button');
    followBtn.id = 'btn-follow-toggle';
    var isFollowing = Boolean(user.isFollowing);
    followBtn.className = isFollowing ? 'btn btn-outline btn-sm' : 'btn btn-primary btn-sm';
    followBtn.textContent = isFollowing ? 'Unfollow' : 'Follow';
    followBtn.type = 'button';
    followBtn.setAttribute('aria-pressed', isFollowing ? 'true' : 'false');

    followBtn.addEventListener('click', function (e) {
      e.preventDefault();

      var targetHash = '#profile/' + encodeURIComponent(user.username);
      if (typeof global.requireAuth === 'function') {
        if (!global.requireAuth(null, targetHash)) return;
      } else if (!currentUser) {
        var redirectUrl = '#register?redirect=' + encodeURIComponent(targetHash) + '&reason=interact';
        if (global.router) global.router.navigate(redirectUrl);
        return;
      }

      var prevFollowing = isFollowing;
      var nextFollowing = !prevFollowing;
      var prevFollowers = parseInt(statFollowers ? statFollowers.textContent : '0', 10) || 0;
      var nextFollowers = nextFollowing ? prevFollowers + 1 : Math.max(0, prevFollowers - 1);

      function paint(following) {
        isFollowing = following;
        followBtn.className = following ? 'btn btn-outline btn-sm' : 'btn btn-primary btn-sm';
        followBtn.textContent = following ? 'Unfollow' : 'Follow';
        followBtn.setAttribute('aria-pressed', following ? 'true' : 'false');
      }

      paint(nextFollowing);
      if (statFollowers) statFollowers.textContent = nextFollowers;

      var call = nextFollowing
        ? global.api.post('/users/' + user.id + '/follow')
        : global.api.delete('/users/' + user.id + '/follow');

      call.then(function (res) {
        if (res && res.data && typeof res.data.followersCount === 'number' && statFollowers) {
          statFollowers.textContent = res.data.followersCount;
        }
      }).catch(function (err) {
        paint(prevFollowing);
        if (statFollowers) statFollowers.textContent = prevFollowers;
        if (global.showToast) global.showToast(err.message || 'Couldn\'t update that follow.', 'error');
      });
    });

    container.appendChild(followBtn);
  }

  function renderProfilePosts(postsContainer, user, currentUser, statPosts, username) {
    if (!postsContainer) return;
    postsContainer.setAttribute('aria-busy', 'false');
    postsContainer.innerHTML = '';

    var posts = user.posts || [];
    if (posts.length === 0) {
      postsContainer.innerHTML = [
        '<div class="empty-state">',
        '  <span class="empty-state-icon" aria-hidden="true">' +
          (global.icons ? global.icons.svg('pen-square', { size: 22 }) : '') + '</span>',
        '  <h2 class="empty-state-title">No posts yet</h2>',
        '  <p class="empty-state-desc">@' + escapeHtml(user.username) + ' hasn\u2019t posted anything yet.</p>',
        '</div>',
      ].join('');
      return;
    }

    posts.forEach(function (p, index) {
      if (!(global.postCard && typeof global.postCard.renderPostCard === 'function')) return;
      var card = global.postCard.renderPostCard(p, currentUser, {
        onDelete: function () {
          var cnt = parseInt(statPosts ? statPosts.textContent : '1', 10) || 1;
          if (statPosts) statPosts.textContent = Math.max(0, cnt - 1);
          if (postsContainer.querySelectorAll('.post-card').length === 0) renderProfile(username);
        },
      });
      if (index > 3) card.classList.remove('is-new');
      card.classList.add('is-new');
      postsContainer.appendChild(card);
    });
  }

  /** Toggle the inline editor for your own profile. */
  function toggleProfileEditor(user) {
    var editContainer = document.getElementById('profile-edit-container');
    if (!editContainer) return;

    var isOpen = editContainer.style.display !== 'none';
    if (isOpen) {
      editContainer.style.display = 'none';
      return;
    }

    editContainer.style.display = 'block';
    editContainer.innerHTML = [
      '<form id="profile-edit-form" class="profile-edit-form">',
      '  <div class="form-group">',
      '    <label for="edit-bio" class="form-label">Bio</label>',
      '    <textarea id="edit-bio" class="form-input" rows="2" maxlength="160" aria-describedby="edit-bio-counter">' +
        escapeHtml(user.bio || '') + '</textarea>',
      '    <span id="edit-bio-counter" class="form-helper form-helper-block">160 characters left</span>',
      '  </div>',
      '  <div class="form-group">',
      '    <label for="edit-avatar-url" class="form-label">Avatar image URL</label>',
      '    <input type="url" id="edit-avatar-url" class="form-input" placeholder="https://example.com/avatar.jpg" value="' +
        escapeHtml(user.avatar_url || '') + '">',
      '  </div>',
      '  <div class="profile-edit-actions">',
      '    <button type="button" id="btn-cancel-edit-profile" class="btn btn-ghost btn-sm">Cancel</button>',
      '    <button type="submit" id="btn-save-edit-profile" class="btn btn-primary btn-sm"><span class="btn-label">Save changes</span></button>',
      '  </div>',
      '</form>',
    ].join('');

    var form = document.getElementById('profile-edit-form');
    var cancelBtn = document.getElementById('btn-cancel-edit-profile');
    var bioField = document.getElementById('edit-bio');
    var bioCounter = document.getElementById('edit-bio-counter');

    if (bioField && bioCounter) {
      var updateCounter = function () {
        bioCounter.textContent = (160 - bioField.value.length) + ' characters left';
      };
      bioField.addEventListener('input', updateCounter);
      updateCounter();
    }

    if (cancelBtn) {
      cancelBtn.addEventListener('click', function () { editContainer.style.display = 'none'; });
    }

    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var bioVal = document.getElementById('edit-bio').value.trim();
        var avatarVal = document.getElementById('edit-avatar-url').value.trim();
        var saveBtn = document.getElementById('btn-save-edit-profile');

        if (saveBtn) {
          saveBtn.disabled = true;
          saveBtn.classList.add('is-loading');
          var label = saveBtn.querySelector('.btn-label');
          if (label) label.textContent = 'Saving…';
        }

        global.api.put('/users/profile', { bio: bioVal, avatar_url: avatarVal || null })
          .then(function (res) {
            if (saveBtn) {
              saveBtn.disabled = false;
              saveBtn.classList.remove('is-loading');
              var l = saveBtn.querySelector('.btn-label');
              if (l) l.textContent = 'Save changes';
            }

            var updatedUser = res && res.data && res.data.user;
            if (!updatedUser) return;

            var bioEl = document.getElementById('profile-bio');
            if (bioEl) bioEl.textContent = updatedUser.bio || 'No bio yet.';
            var avatarEl = document.getElementById('profile-avatar');
            if (avatarEl) avatarEl.innerHTML = avatarHtmlFor(updatedUser, true);

            var stored = getCurrentUser() || {};
            stored.bio = updatedUser.bio;
            stored.avatarUrl = updatedUser.avatar_url;
            stored.avatar_url = updatedUser.avatar_url;
            try {
              localStorage.setItem('user', JSON.stringify(stored));
            } catch (e2) {}

            if (global.app && typeof global.app.updateAuthUI === 'function') global.app.updateAuthUI();

            editContainer.style.display = 'none';
            if (global.showToast) global.showToast('Profile updated.', 'success');
          })
          .catch(function (err) {
            if (saveBtn) {
              saveBtn.disabled = false;
              saveBtn.classList.remove('is-loading');
              var l2 = saveBtn.querySelector('.btn-label');
              if (l2) l2.textContent = 'Save changes';
            }
            if (global.showToast) global.showToast(err.message || 'Couldn\'t save your profile.', 'error');
          });
      });
    }
  }

  var profileView = {
    renderProfile: renderProfile,
    toggleProfileEditor: toggleProfileEditor,
    formatJoinedDate: formatJoinedDate,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = profileView;
  }
  global.profileView = profileView;
})(typeof window !== 'undefined' ? window : globalThis);
