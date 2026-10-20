/**
 * Application orchestrator
 * Wires the router to the views, keeps the navbar in sync with the session,
 * and initialises the composer and auth forms.
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
      if (typeof actionCallback === 'function') return actionCallback(user);
      return true;
    }

    var currentTarget = target || (typeof window !== 'undefined' ? window.location.hash : '') || '#explore';
    var redirectUrl = '#register?redirect=' + encodeURIComponent(currentTarget) + '&reason=interact';

    if (global.router && typeof global.router.navigate === 'function') global.router.navigate(redirectUrl);
    else if (typeof window !== 'undefined') window.location.hash = redirectUrl;
    return false;
  }

  function show(el) { if (el) el.style.display = 'flex'; }
  function hide(el) { if (el) el.style.display = 'none'; }

  /* ---- Account menu ------------------------------------------------------ */
  var accountMenuOpen = false;

  function setAccountMenu(open) {
    if (typeof document === 'undefined') return;
    var menu = document.getElementById('account-menu');
    var trigger = document.getElementById('nav-user-profile-link');
    if (!menu || !trigger) return;

    accountMenuOpen = open;
    menu.hidden = !open;
    trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  function closeAccountMenu() { setAccountMenu(false); }

  function initAccountMenu() {
    if (typeof document === 'undefined') return;
    var trigger = document.getElementById('nav-user-profile-link');
    var menu = document.getElementById('account-menu');
    if (!trigger || !menu) return;

    trigger.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      setAccountMenu(!accountMenuOpen);
    });

    // Choosing anything from the menu closes it.
    menu.addEventListener('click', function (e) {
      var item = e.target.closest ? e.target.closest('.account-menu-item') : null;
      if (item) closeAccountMenu();
    });

    document.addEventListener('click', function (e) {
      if (!accountMenuOpen) return;
      var wrap = document.getElementById('nav-auth-logged-in');
      if (wrap && !wrap.contains(e.target)) closeAccountMenu();
    });

    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape' || !accountMenuOpen) return;
      closeAccountMenu();
      trigger.focus();
    });
  }

  function updateAuthUI() {
    if (typeof document === 'undefined') return;

    var token = (global.api && typeof global.api.getToken === 'function')
      ? global.api.getToken()
      : localStorage.getItem('auth_token');
    var user = getCurrentUser();

    var loggedOutSection = document.getElementById('nav-auth-logged-out');
    var loggedInSection = document.getElementById('nav-auth-logged-in');
    var userNameEl = document.getElementById('nav-user-name');
    var userAvatarEl = document.getElementById('nav-user-avatar');

    if (token && user) {
      hide(loggedOutSection);
      show(loggedInSection);

      if (userNameEl) userNameEl.textContent = user.username;

      var profileItem = document.getElementById('account-menu-profile');
      if (profileItem) profileItem.setAttribute('href', '#profile/' + encodeURIComponent(user.username));

      var handleEl = document.getElementById('account-menu-handle');
      if (handleEl) handleEl.textContent = '@' + user.username;

      var menuNameEl = document.getElementById('account-menu-name');
      if (menuNameEl) menuNameEl.textContent = user.username;

      var menuAvatarEl = document.getElementById('account-menu-avatar');
      if (menuAvatarEl) {
        var menuSrc = user.avatarUrl || user.avatar_url;
        if (menuSrc) {
          menuAvatarEl.innerHTML = '<img src="' + menuSrc + '" alt="" class="avatar-sm" loading="lazy">';
        } else {
          menuAvatarEl.textContent = (user.username || 'U').charAt(0).toUpperCase();
        }
      }

      if (userAvatarEl) {
        var src = user.avatarUrl || user.avatar_url;
        if (src) {
          userAvatarEl.innerHTML = '<img src="' + src + '" alt="" class="avatar-sm" loading="lazy">';
        } else {
          var initial = (user.username || 'U').charAt(0).toUpperCase();
          userAvatarEl.innerHTML = '<span class="avatar-initials">' + initial + '</span>';
        }
      }
    } else {
      show(loggedOutSection);
      hide(loggedInSection);
      closeAccountMenu();
    }
  }

  function handleLogout() {
    closeAccountMenu();
    if (global.api && typeof global.api.clearAuth === 'function') global.api.clearAuth();
    else {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user');
    }
    updateAuthUI();
    if (global.showToast) global.showToast('You\'re signed out.', 'info');
    if (global.router && typeof global.router.navigate === 'function') global.router.navigate('#explore');
  }

  function onRoute(routeInfo) {
    if (!routeInfo) return;
    var pattern = routeInfo.pattern || '';
    var hash = routeInfo.hash || '';

    if (pattern === '#explore' || pattern === '#feed' || hash === '#explore' || hash === '#feed') {
      if (global.feed) global.feed.renderFeed('explore');
    } else if (pattern === '#following' || hash === '#following') {
      if (global.feed) global.feed.renderFeed('following');
    } else if (pattern === '#login' || hash === '#login') {
      if (global.authView) global.authView.renderAuthView('login');
    } else if (pattern === '#register' || hash === '#register') {
      if (global.authView) global.authView.renderAuthView('register');
    } else if (pattern === '#profile/:username' || hash.indexOf('#profile/') === 0) {
      var username = (routeInfo.params && routeInfo.params.username)
        ? routeInfo.params.username
        : decodeURIComponent(hash.replace('#profile/', ''));
      if (global.profileView) global.profileView.renderProfile(username);
    } else if (hash === '#profile') {
      var user = getCurrentUser();
      if (global.router) {
        if (user && user.username) global.router.navigate('#profile/' + encodeURIComponent(user.username));
        else global.router.navigate('#login');
      }
    }
  }

  /** Grow the composer textarea with its content, up to a cap. */
  function autoGrowTextarea(el) {
    if (!el) return;
    var fit = function () {
      el.style.height = 'auto';
      el.style.height = Math.min(el.scrollHeight, 220) + 'px';
    };
    el.addEventListener('input', fit);
    fit();
  }

  function initApp() {
    updateAuthUI();

    if (global.feed && typeof global.feed.initPostComposer === 'function') global.feed.initPostComposer();
    if (global.authView && typeof global.authView.initAuthForms === 'function') global.authView.initAuthForms();

    autoGrowTextarea(document.getElementById('post-content-input'));

    if (typeof window !== 'undefined' && window.addEventListener) {
      window.addEventListener('auth:expired', function () {
        updateAuthUI();
        if (global.showToast) global.showToast('Your session ended. Please sign in again.', 'error');
      });
      window.addEventListener('auth:change', updateAuthUI);
    }

    initAccountMenu();

    var logoutBtn = document.getElementById('nav-logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', function (e) {
        e.preventDefault();
        handleLogout();
      });
    }

    var exploreTab = document.getElementById('tab-explore');
    var followingTab = document.getElementById('tab-following');
    if (exploreTab) exploreTab.addEventListener('click', function () { if (global.router) global.router.navigate('#explore'); });
    if (followingTab) followingTab.addEventListener('click', function () { if (global.router) global.router.navigate('#following'); });

    if (typeof window !== 'undefined' && window.addEventListener) {
      window.addEventListener('routechange', function (e) { onRoute(e.detail); });
    }

    var initialRoute = (global.router && typeof global.router.getCurrentRoute === 'function')
      ? global.router.getCurrentRoute()
      : null;

    if (initialRoute) {
      onRoute(initialRoute);
    } else {
      var currentHash = (typeof window !== 'undefined' && window.location.hash)
        ? window.location.hash.split('?')[0]
        : '#explore';
      onRoute({ hash: currentHash, pattern: currentHash });
    }
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initApp);
    else initApp();
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
