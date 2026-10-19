/**
 * AuthView
 * Log in and sign up in one card. When a signed-out visitor hits a gated
 * action, the reason banner explains why they landed here, and a successful
 * sign-in returns them to whatever they were trying to do.
 */
(function (global) {
  'use strict';

  function icon(name, opts) {
    return global.icons && global.icons.svg ? global.icons.svg(name, opts) : '';
  }

  function parseQueryParams(hash) {
    var h = hash || (typeof window !== 'undefined' ? window.location.hash : '');
    var qIndex = h.indexOf('?');
    var params = {};
    if (qIndex === -1) return params;

    var pairs = h.substring(qIndex + 1).split('&');
    for (var i = 0; i < pairs.length; i++) {
      var pair = pairs[i].split('=');
      if (pair[0]) params[decodeURIComponent(pair[0])] = decodeURIComponent(pair[1] || '');
    }
    return params;
  }

  function getRedirectTarget(params) {
    return params && params.redirect ? params.redirect : '#explore';
  }

  function setFieldError(input, message) {
    if (!input) return;
    var group = input.closest ? input.closest('.form-group') : null;
    if (group) group.classList.add('field-error');

    var err = input.parentNode ? input.parentNode.querySelector('.form-error') : null;
    if (err) {
      err.textContent = message;
      return;
    }
    if (!input.parentNode || typeof document === 'undefined') return;
    err = document.createElement('span');
    err.className = 'form-error';
    err.textContent = message;
    input.parentNode.appendChild(err);
  }

  function clearFieldErrors(form) {
    if (!form || !form.querySelectorAll) return;
    Array.prototype.forEach.call(form.querySelectorAll('.field-error'), function (el) {
      el.classList.remove('field-error');
    });
    Array.prototype.forEach.call(form.querySelectorAll('.form-error'), function (el) {
      el.remove();
    });
  }

  function setBusy(btn, busy, busyLabel, idleLabel) {
    if (!btn) return;
    btn.disabled = busy;
    btn.classList.toggle('is-loading', busy);
    btn.setAttribute('aria-busy', busy ? 'true' : 'false');
    var label = btn.querySelector ? btn.querySelector('.btn-label') : null;
    if (label) label.textContent = busy ? busyLabel : idleLabel;
    else btn.textContent = busy ? busyLabel : idleLabel;
  }

  /**
   * Show the view in 'login' or 'register' mode, with the reason banner when
   * the visitor was sent here from a gated action.
   */
  function renderAuthView(mode) {
    mode = mode === 'register' ? 'register' : 'login';

    if (typeof document === 'undefined') return { mode: mode };

    var loginForm = document.getElementById('login-form');
    var registerForm = document.getElementById('register-form');
    var heading = document.getElementById('auth-heading');
    var subtitle = document.getElementById('auth-subtitle');
    var banner = document.getElementById('auth-banner');
    var switchToRegister = document.getElementById('switch-to-register');
    var switchToLogin = document.getElementById('switch-to-login');

    var currentHash = typeof window !== 'undefined' ? window.location.hash : '';
    var params = parseQueryParams(currentHash);

    if (banner) {
      if (params.reason === 'interact') {
        banner.style.display = 'flex';
        banner.innerHTML = [
          '<span class="auth-banner-icon" aria-hidden="true">' + icon('sparkle', { size: 16 }) + '</span>',
          '<div class="auth-banner-text">',
          '  <strong>Create an account or sign in to like, comment, and connect.</strong>',
          '</div>',
        ].join('');
      } else {
        banner.style.display = 'none';
        banner.innerHTML = '';
      }
    }

    if (mode === 'register') {
      if (loginForm) loginForm.style.display = 'none';
      if (registerForm) registerForm.style.display = 'block';
      if (heading) heading.textContent = 'Join CodeAlpha';
      if (subtitle) subtitle.textContent = 'Create your account and start sharing.';
    } else {
      if (loginForm) loginForm.style.display = 'block';
      if (registerForm) registerForm.style.display = 'none';
      if (heading) heading.textContent = 'Welcome Back';
      if (subtitle) subtitle.textContent = 'Sign in to post, reply, and follow people.';
    }

    // Keep the mode switcher on the same destination the visitor came from.
    var qString = '';
    var qIndex = currentHash.indexOf('?');
    if (qIndex !== -1) qString = currentHash.substring(qIndex);

    if (switchToRegister) switchToRegister.setAttribute('href', '#register' + qString);
    if (switchToLogin) switchToLogin.setAttribute('href', '#login' + qString);
  }

  function persistSession(res) {
    var token = res && res.data && res.data.token;
    var user = res && res.data && res.data.user;
    if (!token || !user) return null;

    global.api.setToken(token);
    try {
      localStorage.setItem('user', JSON.stringify(user));
    } catch (e) {}

    if (global.app && typeof global.app.updateAuthUI === 'function') global.app.updateAuthUI();
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new CustomEvent('auth:change', { detail: { user: user } }));
    }
    return user;
  }

  function goToRedirectTarget() {
    var params = parseQueryParams(typeof window !== 'undefined' ? window.location.hash : '');
    var target = getRedirectTarget(params);
    if (global.router && typeof global.router.navigate === 'function') global.router.navigate(target);
    else if (typeof window !== 'undefined') window.location.hash = target;
  }

  function initAuthForms() {
    if (typeof document === 'undefined') return;

    var loginForm = document.getElementById('login-form');
    var registerForm = document.getElementById('register-form');

    // --- Log in ---------------------------------------------------------------
    if (loginForm) {
      loginForm.addEventListener('submit', function (e) {
        e.preventDefault();
        clearFieldErrors(loginForm);

        var emailInput = document.getElementById('login-email');
        var passwordInput = document.getElementById('login-password');
        var submitBtn = document.getElementById('btn-login-submit');

        var login = emailInput ? emailInput.value.trim() : '';
        var password = passwordInput ? passwordInput.value : '';

        if (!login) {
          setFieldError(emailInput, 'Enter your email or username.');
          if (emailInput) emailInput.focus();
          return;
        }
        if (!password) {
          setFieldError(passwordInput, 'Enter your password.');
          if (passwordInput) passwordInput.focus();
          return;
        }

        setBusy(submitBtn, true, 'Logging in…', 'Log in');

        global.api.post('/auth/login', { login: login, password: password })
          .then(function (res) {
            setBusy(submitBtn, false, 'Logging in…', 'Log in');
            var user = persistSession(res);
            if (user && global.showToast) global.showToast('Signed in as ' + user.username + '.', 'success');
            if (user) goToRedirectTarget();
          })
          .catch(function (err) {
            setBusy(submitBtn, false, 'Logging in…', 'Log in');
            if (global.showToast) {
              global.showToast(err.message || 'That email or password didn\'t match. Try again.', 'error');
            }
          });
      });
    }

    // --- Register -------------------------------------------------------------
    if (registerForm) {
      registerForm.addEventListener('submit', function (e) {
        e.preventDefault();
        clearFieldErrors(registerForm);

        var usernameInput = document.getElementById('register-username');
        var emailInput = document.getElementById('register-email');
        var passwordInput = document.getElementById('register-password');
        var submitBtn = document.getElementById('btn-register-submit');

        var username = usernameInput ? usernameInput.value.trim() : '';
        var email = emailInput ? emailInput.value.trim() : '';
        var password = passwordInput ? passwordInput.value : '';

        if (!username) {
          setFieldError(usernameInput, 'Pick a username.');
          if (usernameInput) usernameInput.focus();
          return;
        }
        if (username.length < 3) {
          setFieldError(usernameInput, 'Usernames need at least 3 characters.');
          if (usernameInput) usernameInput.focus();
          return;
        }
        if (!email) {
          setFieldError(emailInput, 'Enter your email address.');
          if (emailInput) emailInput.focus();
          return;
        }
        if (!password) {
          setFieldError(passwordInput, 'Choose a password.');
          if (passwordInput) passwordInput.focus();
          return;
        }
        if (password.length < 6) {
          setFieldError(passwordInput, 'Passwords need at least 6 characters.');
          if (passwordInput) passwordInput.focus();
          return;
        }

        setBusy(submitBtn, true, 'Creating account…', 'Create account');

        global.api.post('/auth/register', { username: username, email: email, password: password })
          .then(function (res) {
            setBusy(submitBtn, false, 'Creating account…', 'Create account');
            var user = persistSession(res);
            if (user && global.showToast) global.showToast('Welcome to CodeAlpha, ' + user.username + '.', 'success');
            if (user) goToRedirectTarget();
          })
          .catch(function (err) {
            setBusy(submitBtn, false, 'Creating account…', 'Create account');
            if (global.showToast) {
              global.showToast(err.message || 'We couldn\'t create that account. Try again.', 'error');
            }
          });
      });
    }
  }

  var authView = {
    renderAuthView: renderAuthView,
    initAuthForms: initAuthForms,
    parseQueryParams: parseQueryParams,
    getRedirectTarget: getRedirectTarget,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = authView;
  }
  global.authView = authView;
})(typeof window !== 'undefined' ? window : globalThis);
