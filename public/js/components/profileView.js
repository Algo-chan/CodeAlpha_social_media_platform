/**
 * ProfileView Component
 * Renders user profile header, stats row (posts, followers, following),
 * follow/unfollow toggle with optimistic updates, bio/avatar editor for self-profile,
 * and user posts stream.
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
      return 'Joined ' + d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    } catch (e) {
      return '';
    }
  }

  /**
   * Renders the Profile View for a given username
   */
  function renderProfile(username) {
    if (!username) return;

    if (typeof document === 'undefined') {
      return { username: username };
    }

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
    if (bioEl) bioEl.textContent = 'Loading profile...';
    if (postsContainer) {
      postsContainer.innerHTML = '<div class="empty-state" style="border:none;"><p class="form-helper">Loading posts...</p></div>';
    }
    if (editContainer) editContainer.style.display = 'none';

    var currentUser = getCurrentUser();

    global.api.get('/users/' + encodeURIComponent(username))
      .then(function (res) {
        var user = res && res.data ? res.data : null;
        if (!user) return;

        // Populate profile header
        if (headingEl) headingEl.textContent = user.username;
        if (handleEl) handleEl.textContent = '@' + user.username;
        if (bioEl) bioEl.textContent = user.bio || 'No bio provided yet.';
        if (joinedEl) joinedEl.textContent = formatJoinedDate(user.created_at);

        // Avatar
        if (avatarEl) {
          if (user.avatar_url) {
            avatarEl.innerHTML = '<img src="' + escapeHtml(user.avatar_url) + '" alt="' + escapeHtml(user.username) + '" class="profile-avatar-large">';
          } else {
            var initial = (user.username || 'U').charAt(0).toUpperCase();
            avatarEl.innerHTML = '<span class="avatar-initials profile-avatar-large" style="display:flex;align-items:center;justify-content:center;font-size:2rem;font-weight:700;">' + escapeHtml(initial) + '</span>';
          }
        }

        // Stats
        if (statPosts) statPosts.textContent = user.postsCount !== undefined ? user.postsCount : (user.posts ? user.posts.length : 0);
        if (statFollowers) statFollowers.textContent = user.followersCount || 0;
        if (statFollowing) statFollowing.textContent = user.followingCount || 0;

        // Action Container: Follow / Unfollow or Edit Profile
        var isOwnProfile = currentUser && currentUser.username === user.username;

        if (actionContainer) {
          actionContainer.innerHTML = '';

          if (isOwnProfile) {
            // Edit Profile Button
            var editBtn = document.createElement('button');
            editBtn.id = 'btn-edit-profile-toggle';
            editBtn.className = 'btn btn-outline btn-sm';
            editBtn.type = 'button';
            editBtn.textContent = 'Edit Profile';

            editBtn.addEventListener('click', function () {
              toggleProfileEditor(user);
            });
            actionContainer.appendChild(editBtn);
          } else {
            // Follow / Unfollow Button
            var followBtn = document.createElement('button');
            followBtn.id = 'btn-follow-toggle';
            var isFollowing = Boolean(user.isFollowing);

            followBtn.className = isFollowing ? 'btn btn-outline btn-sm' : 'btn btn-primary btn-sm';
            followBtn.textContent = isFollowing ? 'Unfollow' : 'Follow';
            followBtn.type = 'button';

            followBtn.addEventListener('click', function (e) {
              e.preventDefault();

              // Gated check
              var targetHash = '#profile/' + encodeURIComponent(user.username);
              if (typeof global.requireAuth === 'function') {
                if (!global.requireAuth(null, targetHash)) return;
              } else if (!currentUser) {
                var redirectUrl = '#register?redirect=' + encodeURIComponent(targetHash) + '&reason=interact';
                if (global.router) global.router.navigate(redirectUrl);
                return;
              }

              // Optimistic toggle
              var currentFollowState = isFollowing;
              var nextFollowState = !currentFollowState;
              var currentFollowersCount = parseInt(statFollowers.textContent, 10) || 0;
              var nextFollowersCount = nextFollowState ? currentFollowersCount + 1 : Math.max(0, currentFollowersCount - 1);

              isFollowing = nextFollowState;
              followBtn.className = isFollowing ? 'btn btn-outline btn-sm' : 'btn btn-primary btn-sm';
              followBtn.textContent = isFollowing ? 'Unfollow' : 'Follow';
              if (statFollowers) statFollowers.textContent = nextFollowersCount;

              var apiCall = nextFollowState
                ? global.api.post('/users/' + user.id + '/follow')
                : global.api.delete('/users/' + user.id + '/follow');

              apiCall.then(function (res) {
                if (res && res.data && typeof res.data.followersCount === 'number') {
                  if (statFollowers) statFollowers.textContent = res.data.followersCount;
                }
              }).catch(function (err) {
                // Revert on failure
                isFollowing = currentFollowState;
                followBtn.className = isFollowing ? 'btn btn-outline btn-sm' : 'btn btn-primary btn-sm';
                followBtn.textContent = isFollowing ? 'Unfollow' : 'Follow';
                if (statFollowers) statFollowers.textContent = currentFollowersCount;

                if (global.showToast) {
                  global.showToast(err.message || 'Unable to update follow', 'error');
                }
              });
            });

            actionContainer.appendChild(followBtn);
          }
        }

        // Render User Posts
        if (postsContainer) {
          postsContainer.innerHTML = '';
          var posts = user.posts || [];

          if (posts.length === 0) {
            postsContainer.innerHTML = [
              '<div class="empty-state">',
              '  <div class="empty-state-icon">✍️</div>',
              '  <h3 class="empty-state-title">No posts yet</h3>',
              '  <p class="empty-state-desc">@' + escapeHtml(user.username) + ' hasn\'t posted anything yet.</p>',
              '</div>'
            ].join('');
          } else {
            posts.forEach(function (p) {
              if (global.postCard && typeof global.postCard.renderPostCard === 'function') {
                var card = global.postCard.renderPostCard(p, currentUser, {
                  onDelete: function () {
                    // Update stats
                    var cnt = parseInt(statPosts.textContent, 10) || 1;
                    statPosts.textContent = Math.max(0, cnt - 1);
                    if (postsContainer.querySelectorAll('.post-card').length === 0) {
                      renderProfile(username);
                    }
                  }
                });
                postsContainer.appendChild(card);
              }
            });
          }
        }
      })
      .catch(function (err) {
        if (headingEl) headingEl.textContent = 'User Not Found';
        if (bioEl) bioEl.textContent = 'The requested user could not be found.';
        if (postsContainer) {
          postsContainer.innerHTML = [
            '<div class="empty-state">',
            '  <div class="empty-state-icon">🔍</div>',
            '  <h3 class="empty-state-title">Profile unavailable</h3>',
            '  <p class="empty-state-desc">' + (err.message || 'The user does not exist or was deleted.') + '</p>',
            '  <a href="#explore" class="btn btn-primary btn-sm">Back to Explore</a>',
            '</div>'
          ].join('');
        }
      });
  }

  /**
   * Toggles the inline edit profile form
   */
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
      '<form id="profile-edit-form" class="profile-edit-form" style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--border-subtle);">' +
      '  <div class="form-group">' +
      '    <label for="edit-bio" class="form-label">Bio (Max 160 characters)</label>' +
      '    <textarea id="edit-bio" class="form-input" rows="2" maxlength="160">' + escapeHtml(user.bio || '') + '</textarea>' +
      '  </div>' +
      '  <div class="form-group">' +
      '    <label for="edit-avatar-url" class="form-label">Avatar Image URL</label>' +
      '    <input type="url" id="edit-avatar-url" class="form-input" placeholder="https://example.com/avatar.jpg" value="' + escapeHtml(user.avatar_url || '') + '">' +
      '  </div>' +
      '  <div style="display: flex; gap: 0.5rem; justify-content: flex-end;">' +
      '    <button type="button" id="btn-cancel-edit-profile" class="btn btn-secondary btn-sm">Cancel</button>' +
      '    <button type="submit" id="btn-save-edit-profile" class="btn btn-primary btn-sm">Save Changes</button>' +
      '  </div>' +
      '</form>'
    ].join('');

    var form = document.getElementById('profile-edit-form');
    var cancelBtn = document.getElementById('btn-cancel-edit-profile');

    if (cancelBtn) {
      cancelBtn.addEventListener('click', function () {
        editContainer.style.display = 'none';
      });
    }

    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var bioVal = document.getElementById('edit-bio').value.trim();
        var avatarVal = document.getElementById('edit-avatar-url').value.trim();
        var saveBtn = document.getElementById('btn-save-edit-profile');

        if (saveBtn) {
          saveBtn.disabled = true;
          saveBtn.textContent = 'Saving...';
        }

        global.api.put('/users/profile', { bio: bioVal, avatar_url: avatarVal || null })
          .then(function (res) {
            if (saveBtn) {
              saveBtn.disabled = false;
              saveBtn.textContent = 'Save Changes';
            }

            var updatedUser = res && res.data && res.data.user;
            if (updatedUser) {
              // Update DOM
              var bioEl = document.getElementById('profile-bio');
              if (bioEl) bioEl.textContent = updatedUser.bio || 'No bio provided yet.';

              var avatarEl = document.getElementById('profile-avatar');
              if (avatarEl) {
                if (updatedUser.avatar_url) {
                  avatarEl.innerHTML = '<img src="' + escapeHtml(updatedUser.avatar_url) + '" alt="' + escapeHtml(updatedUser.username) + '" class="profile-avatar-large">';
                } else {
                  var initial = (updatedUser.username || 'U').charAt(0).toUpperCase();
                  avatarEl.innerHTML = '<span class="avatar-initials profile-avatar-large" style="display:flex;align-items:center;justify-content:center;font-size:2rem;font-weight:700;">' + escapeHtml(initial) + '</span>';
                }
              }

              // Update stored user
              var currentUser = getCurrentUser() || {};
              currentUser.bio = updatedUser.bio;
              currentUser.avatarUrl = updatedUser.avatar_url;
              currentUser.avatar_url = updatedUser.avatar_url;
              localStorage.setItem('user', JSON.stringify(currentUser));

              if (global.app && typeof global.app.updateAuthUI === 'function') {
                global.app.updateAuthUI();
              }

              editContainer.style.display = 'none';
              if (global.showToast) {
                global.showToast('Profile updated successfully!', 'success');
              }
            }
          })
          .catch(function (err) {
            if (saveBtn) {
              saveBtn.disabled = false;
              saveBtn.textContent = 'Save Changes';
            }
            if (global.showToast) {
              global.showToast(err.message || 'Unable to update profile', 'error');
            }
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
