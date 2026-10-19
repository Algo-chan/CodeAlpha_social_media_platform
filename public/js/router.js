/**
 * Hash router
 * Maps #explore, #following, #login, #register and #profile/:username to a
 * view container. Views are toggled with the `hidden` attribute rather than
 * inline display so the stylesheet stays in charge of presentation.
 */
(function (global) {
  'use strict';

  var routes = [];
  var currentRoute = null;

  function addRoute(pattern, handler) {
    var paramNames = [];
    var regexPattern = pattern.replace(/:([a-zA-Z0-9_]+)/g, function (_, paramName) {
      paramNames.push(paramName);
      return '([^/]+)';
    });

    routes.push({
      pattern: pattern,
      regex: new RegExp('^' + regexPattern + '$'),
      paramNames: paramNames,
      handler: handler,
    });
  }

  function parseHash(hash) {
    if (!hash || hash === '' || hash === '#') return '#explore';
    return hash;
  }

  function setActiveView(viewId) {
    if (typeof document === 'undefined') return;
    var views = document.querySelectorAll('.view');
    Array.prototype.forEach.call(views, function (view) {
      var isActive = view.id === viewId;
      view.classList.toggle('active', isActive);
      view.hidden = !isActive;
    });
    if (typeof window !== 'undefined' && window.scrollTo) {
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
  }

  function isActivelyOn(hash, href) {
    return hash === href || (hash === '#feed' && href === '#explore');
  }

  function updateActiveNavLink(hash) {
    if (typeof document === 'undefined') return;
    var baseHash = hash.split('?')[0];

    Array.prototype.forEach.call(document.querySelectorAll('.nav-link'), function (link) {
      var active = isActivelyOn(baseHash, link.getAttribute('href'));
      link.classList.toggle('active', active);
      if (active) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });

    Array.prototype.forEach.call(document.querySelectorAll('.tab-btn'), function (tab) {
      var target = tab.getAttribute('data-tab');
      var selected =
        (target === 'explore' && (baseHash === '#explore' || baseHash === '#feed')) ||
        (target === 'following' && baseHash === '#following');
      tab.classList.toggle('active', selected);
      tab.setAttribute('aria-selected', selected ? 'true' : 'false');
    });
  }

  function setVisible(el, visible) {
    if (!el) return;
    el.hidden = !visible;
    el.style.display = visible ? '' : 'none';
  }

  function updateAuthForms(mode) {
    if (typeof document === 'undefined') return;
    var loginForm = document.getElementById('login-form');
    var registerForm = document.getElementById('register-form');
    var heading = document.getElementById('auth-heading');

    if (mode === 'register') {
      setVisible(loginForm, false);
      setVisible(registerForm, true);
      if (heading) heading.textContent = 'Create your account';
    } else {
      setVisible(loginForm, true);
      setVisible(registerForm, false);
      if (heading) heading.textContent = 'Welcome back';
    }
  }

  function handleRoute() {
    var fullHash = typeof window !== 'undefined' ? window.location.hash : '';
    var hash = parseHash(fullHash);

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
        if (typeof route.handler === 'function') route.handler(currentRoute);
        break;
      }
    }

    if (!matched) {
      if (cleanHash.startsWith('#profile/')) {
        currentRoute = {
          pattern: '#profile/:username',
          hash: cleanHash,
          params: { username: cleanHash.replace('#profile/', '') },
        };
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

    updateDocumentTitle();
  }

  function updateDocumentTitle() {
    if (typeof document === 'undefined' || !currentRoute) return;
    var hash = currentRoute.hash || '';
    var title = 'CodeAlpha Social';
    if (hash.startsWith('#profile/')) title = '@' + hash.replace('#profile/', '') + ' · CodeAlpha';
    else if (hash === '#following') title = 'Following · CodeAlpha';
    else if (hash === '#explore' || hash === '#feed') title = 'Explore · CodeAlpha';
    else if (hash === '#login') title = 'Log in · CodeAlpha';
    else if (hash === '#register') title = 'Sign up · CodeAlpha';
    document.title = title;
  }

  function navigate(path) {
    if (typeof window === 'undefined') return;
    if (!path.startsWith('#')) path = '#' + path;
    if (window.location.hash === path) handleRoute();
    else window.location.hash = path;
  }

  function init() {
    addRoute('#explore', function () { setActiveView('view-feed'); });
    addRoute('#feed', function () { setActiveView('view-feed'); });
    addRoute('#following', function () { setActiveView('view-feed'); });
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
        var name = info.params.username;
        if (headingEl) headingEl.textContent = name;
        if (handleEl) handleEl.textContent = '@' + name;
      }
    });

    if (typeof window !== 'undefined') {
      window.addEventListener('hashchange', handleRoute);
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', handleRoute);
      else handleRoute();
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

  init();

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = router;
  }
  global.router = router;
  global.navigate = navigate;
})(typeof window !== 'undefined' ? window : globalThis);
