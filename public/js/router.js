/**
 * Client-Side Hash Router
 * Manages view toggling for #feed, #explore, #following, #login, #register, #profile/:username
 */
(function (global) {
  'use strict';

  var routes = [];
  var currentRoute = null;

  /**
   * Register a route pattern and handler
   * @param {string} pattern - e.g. '#explore', '#profile/:username'
   * @param {Function} handler - callback({ route, params, hash })
   */
  function addRoute(pattern, handler) {
    var paramNames = [];
    var regexPattern = pattern
      .replace(/:([a-zA-Z0-9_]+)/g, function (_, paramName) {
        paramNames.push(paramName);
        return '([^/]+)';
      });
    
    var regex = new RegExp('^' + regexPattern + '$');
    routes.push({
      pattern: pattern,
      regex: regex,
      paramNames: paramNames,
      handler: handler,
    });
  }

  function parseHash(hash) {
    if (!hash || hash === '' || hash === '#') {
      return '#explore';
    }
    return hash;
  }

  function setActiveView(viewId) {
    if (typeof document === 'undefined') return;
    var views = document.querySelectorAll('.view');
    views.forEach(function (view) {
      if (view.id === viewId) {
        view.classList.add('active');
      } else {
        view.classList.remove('active');
      }
    });
  }

  function updateActiveNavLink(hash) {
    if (typeof document === 'undefined') return;
    var baseHash = hash.split('?')[0];
    var navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(function (link) {
      var href = link.getAttribute('href');
      if (href === baseHash || (baseHash === '#feed' && href === '#explore')) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });

    // Also update feed tabs if on feed view
    var feedTabs = document.querySelectorAll('.tab-btn');
    feedTabs.forEach(function (tab) {
      var tabTarget = tab.getAttribute('data-tab');
      if ((baseHash === '#explore' || baseHash === '#feed') && tabTarget === 'explore') {
        tab.classList.add('active');
      } else if (baseHash === '#following' && tabTarget === 'following') {
        tab.classList.add('active');
      } else {
        tab.classList.remove('active');
      }
    });
  }

  function updateAuthForms(mode) {
    if (typeof document === 'undefined') return;
    var loginForm = document.getElementById('login-form');
    var registerForm = document.getElementById('register-form');
    var heading = document.getElementById('auth-heading');

    if (mode === 'register') {
      if (loginForm) loginForm.style.display = 'none';
      if (registerForm) registerForm.style.display = 'block';
      if (heading) heading.textContent = 'Join CodeAlpha';
    } else {
      if (loginForm) loginForm.style.display = 'block';
      if (registerForm) registerForm.style.display = 'none';
      if (heading) heading.textContent = 'Welcome Back';
    }
  }

  function handleRoute() {
    var fullHash = typeof window !== 'undefined' ? window.location.hash : '';
    var hash = parseHash(fullHash);

    // If initial hash was empty, update url
    if (typeof window !== 'undefined' && (!window.location.hash || window.location.hash === '#')) {
      window.location.hash = hash;
      return;
    }

    var cleanHash = hash.split('?')[0];
    var matched = false;

    for (var i = 0; i < routes.length; i++) {
      var route = routes[i];
      var match = cleanHash.match(route.regex);
      if (match) {
        var params = {};
        for (var p = 0; p < route.paramNames.length; p++) {
          params[route.paramNames[p]] = decodeURIComponent(match[p + 1]);
        }

        currentRoute = {
          pattern: route.pattern,
          hash: cleanHash,
          fullHash: hash,
          params: params,
        };

        matched = true;
        updateActiveNavLink(cleanHash);

        if (typeof route.handler === 'function') {
          route.handler(currentRoute);
        }
        break;
      }
    }

    // Default fallback handling if no route explicitly matched
    if (!matched) {
      if (cleanHash.startsWith('#profile/')) {
        var username = cleanHash.replace('#profile/', '');
        currentRoute = { pattern: '#profile/:username', hash: cleanHash, params: { username: username } };
        setActiveView('view-profile');
      } else if (cleanHash === '#login') {
        currentRoute = { pattern: '#login', hash: cleanHash, params: {} };
        setActiveView('view-auth');
        updateAuthForms('login');
      } else if (cleanHash === '#register') {
        currentRoute = { pattern: '#register', hash: cleanHash, params: {} };
        setActiveView('view-auth');
        updateAuthForms('register');
      } else {
        currentRoute = { pattern: '#explore', hash: '#explore', params: {} };
        setActiveView('view-feed');
      }
      updateActiveNavLink(cleanHash);
    }

    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      try {
        window.dispatchEvent(new CustomEvent('routechange', { detail: currentRoute }));
      } catch (e) {}
    }
  }

  function navigate(path) {
    if (typeof window === 'undefined') return;
    if (!path.startsWith('#')) {
      path = '#' + path;
    }
    if (window.location.hash === path) {
      handleRoute();
    } else {
      window.location.hash = path;
    }
  }

  function init() {
    // Register default routes & views
    addRoute('#explore', function () {
      setActiveView('view-feed');
    });

    addRoute('#feed', function () {
      setActiveView('view-feed');
    });

    addRoute('#following', function () {
      setActiveView('view-feed');
    });

    addRoute('#login', function () {
      setActiveView('view-auth');
      updateAuthForms('login');
    });

    addRoute('#register', function () {
      setActiveView('view-auth');
      updateAuthForms('register');
    });

    addRoute('#profile/:username', function (info) {
      setActiveView('view-profile');
      var handleEl = document.getElementById('profile-handle');
      var headingEl = document.getElementById('profile-heading');
      if (info && info.params && info.params.username) {
        if (handleEl) handleEl.textContent = '@' + info.params.username;
        if (headingEl) headingEl.textContent = info.params.username;
      }
    });

    if (typeof window !== 'undefined') {
      window.addEventListener('hashchange', handleRoute);
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', handleRoute);
      } else {
        handleRoute();
      }
    }
  }

  var router = {
    addRoute: addRoute,
    on: addRoute,
    navigate: navigate,
    handleRoute: handleRoute,
    init: init,
    getCurrentRoute: function () {
      return currentRoute;
    },
    setActiveView: setActiveView,
    updateAuthForms: updateAuthForms,
  };

  // Self-init default router configuration
  init();

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = router;
  }
  global.router = router;
  global.navigate = navigate;
})(typeof window !== 'undefined' ? window : globalThis);
