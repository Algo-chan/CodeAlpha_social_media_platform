/**
 * Main Application Orchestrator
 * Connects theme management, navigation routing, authentication UI state, and toast alerts.
 */
(function (global) {
  'use strict';

  function getCurrentUser() {
    try {
      var raw = localStorage.getItem('user');
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function updateAuthUI() {
    var token = localStorage.getItem('auth_token');
    var user = getCurrentUser();

    var loggedOutSection = document.getElementById('nav-auth-logged-out');
    var loggedInSection = document.getElementById('nav-auth-logged-in');
    var userProfileLink = document.getElementById('nav-user-profile-link');
    var userNameEl = document.getElementById('nav-user-name');
    var userAvatarEl = document.getElementById('nav-user-avatar');

    if (token && user) {
      if (loggedOutSection) loggedOutSection.style.display = 'none';
      if (loggedInSection) loggedInSection.style.display = 'flex';

      if (userProfileLink) {
        userProfileLink.setAttribute('href', '#profile/' + encodeURIComponent(user.username));
      }
      if (userNameEl) {
        userNameEl.textContent = user.username;
      }
      if (userAvatarEl) {
        if (user.avatarUrl) {
          userAvatarEl.innerHTML = '<img src="' + user.avatarUrl + '" alt="' + user.username + '" class="avatar-sm">';
        } else {
          var initial = (user.username || 'U').charAt(0).toUpperCase();
          userAvatarEl.innerHTML = '<span class="avatar-initials">' + initial + '</span>';
        }
      }
    } else {
      if (loggedOutSection) loggedOutSection.style.display = 'flex';
      if (loggedInSection) loggedInSection.style.display = 'none';
    }
  }

  function handleLogout() {
    if (global.api && typeof global.api.clearAuth === 'function') {
      global.api.clearAuth();
    } else {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user');
    }
    updateAuthUI();
    if (global.showToast) {
      global.showToast('You have been logged out', 'info');
    }
    if (global.router && typeof global.router.navigate === 'function') {
      global.router.navigate('#explore');
    }
  }

  function initApp() {
    updateAuthUI();

    // Listen for auth changes
    window.addEventListener('auth:expired', function () {
      updateAuthUI();
      if (global.showToast) {
        global.showToast('Session expired. Please log in again.', 'error');
      }
    });

    window.addEventListener('auth:change', function () {
      updateAuthUI();
    });

    // Wire logout button
    var logoutBtn = document.getElementById('nav-logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', function (e) {
        e.preventDefault();
        handleLogout();
      });
    }

    // Feed tab navigation clicks
    var exploreTab = document.getElementById('tab-explore');
    var followingTab = document.getElementById('tab-following');
    if (exploreTab) {
      exploreTab.addEventListener('click', function () {
        if (global.router) global.router.navigate('#explore');
      });
    }
    if (followingTab) {
      followingTab.addEventListener('click', function () {
        if (global.router) global.router.navigate('#following');
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }

  var app = {
    getCurrentUser: getCurrentUser,
    updateAuthUI: updateAuthUI,
    handleLogout: handleLogout,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = app;
  }
  global.app = app;
})(typeof window !== 'undefined' ? window : globalThis);
