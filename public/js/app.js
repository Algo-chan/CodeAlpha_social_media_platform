/**
 * Main Application Orchestrator
 * Connects theme management, navigation routing, authentication UI state,
 * post composer, feed rendering, auth views, profile views, and gated interaction interception.
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

  function requireAuth(actionCallback, target) {
    if (global.feed && typeof global.feed.requireAuth === 'function') {
      return global.feed.requireAuth(actionCallback, target);
    }
    var user = getCurrentUser();
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

  function updateAuthUI() {
    if (typeof document === 'undefined') return;

    var token = (global.api && typeof global.api.getToken === 'function')
      ? global.api.getToken()
      : localStorage.getItem('auth_token');
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
        if (user.avatarUrl || user.avatar_url) {
          var avatarSrc = user.avatarUrl || user.avatar_url;
          userAvatarEl.innerHTML = '<img src="' + avatarSrc + '" alt="' + user.username + '" class="avatar-sm">';
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

  function onRoute(routeInfo) {
    if (!routeInfo) return;
    var pattern = routeInfo.pattern || '';
    var hash = routeInfo.hash || '';

    if (pattern === '#explore' || pattern === '#feed' || hash === '#explore' || hash === '#feed') {
      if (global.feed && typeof global.feed.renderFeed === 'function') {
        global.feed.renderFeed('explore');
      }
    } else if (pattern === '#following' || hash === '#following') {
      if (global.feed && typeof global.feed.renderFeed === 'function') {
        global.feed.renderFeed('following');
      }
    } else if (pattern === '#login' || hash === '#login') {
      if (global.authView && typeof global.authView.renderAuthView === 'function') {
        global.authView.renderAuthView('login');
      }
    } else if (pattern === '#register' || hash === '#register') {
      if (global.authView && typeof global.authView.renderAuthView === 'function') {
        global.authView.renderAuthView('register');
      }
    } else if (pattern === '#profile/:username' || hash.startsWith('#profile/')) {
      var username = (routeInfo.params && routeInfo.params.username)
        ? routeInfo.params.username
        : decodeURIComponent(hash.replace('#profile/', ''));
      if (global.profileView && typeof global.profileView.renderProfile === 'function') {
        global.profileView.renderProfile(username);
      }
    } else if (hash === '#profile') {
      var user = getCurrentUser();
      if (user && user.username) {
        if (global.router) global.router.navigate('#profile/' + encodeURIComponent(user.username));
      } else {
        if (global.router) global.router.navigate('#login');
      }
    }
  }

  function initApp() {
    updateAuthUI();

    // Initialize interactive post composer & auth forms
    if (global.feed && typeof global.feed.initPostComposer === 'function') {
      global.feed.initPostComposer();
    }
    if (global.authView && typeof global.authView.initAuthForms === 'function') {
      global.authView.initAuthForms();
    }

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

    // Route change listener
    window.addEventListener('routechange', function (e) {
      onRoute(e.detail);
    });

    // Initial route handling
    var initialRoute = (global.router && typeof global.router.getCurrentRoute === 'function')
      ? global.router.getCurrentRoute()
      : null;

    if (initialRoute) {
      onRoute(initialRoute);
    } else {
      var currentHash = (typeof window !== 'undefined' && window.location.hash) ? window.location.hash.split('?')[0] : '#explore';
      onRoute({ hash: currentHash, pattern: currentHash });
    }
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initApp);
    } else {
      initApp();
    }
  }

  var app = {
    getCurrentUser: getCurrentUser,
    updateAuthUI: updateAuthUI,
    handleLogout: handleLogout,
    requireAuth: requireAuth,
    onRoute: onRoute,
    initApp: initApp,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = app;
  }
  global.app = app;
  global.requireAuth = requireAuth;
})(typeof window !== 'undefined' ? window : globalThis);
