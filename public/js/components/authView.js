/**
 * AuthView Component
 * Renders Login and Register views, handles gated redirect reason banner
 * ("Create an account or sign in to like, comment, and connect"),
 * and navigates back to original target upon successful authentication.
 */
(function (global) {
  'use strict';

  function parseQueryParams(hash) {
    var h = hash || (typeof window !== 'undefined' ? window.location.hash : '');
    var qIndex = h.indexOf('?');
    var params = {};
    if (qIndex === -1) return params;

    var queryString = h.substring(qIndex + 1);
    var pairs = queryString.split('&');
    for (var i = 0; i < pairs.length; i++) {
      var pair = pairs[i].split('=');
      if (pair[0]) {
        params[decodeURIComponent(pair[0])] = decodeURIComponent(pair[1] || '');
      }
    }
    return params;
  }

  function getRedirectTarget(params) {
    if (params && params.redirect) {
      return params.redirect;
    }
    return '#explore';
  }

  /**
   * Renders Auth View in 'login' or 'register' mode, rendering banner if reason=interact
   */
  function renderAuthView(mode) {
    mode = mode === 'register' ? 'register' : 'login';

    if (typeof document === 'undefined') {
      return { mode: mode };
    }

    var loginForm = document.getElementById('login-form');
    var registerForm = document.getElementById('register-form');
    var heading = document.getElementById('auth-heading');
    var subtitle = document.getElementById('auth-subtitle');
    var banner = document.getElementById('auth-banner');
    var switchToRegister = document.getElementById('switch-to-register');
    var switchToLogin = document.getElementById('switch-to-login');

    var currentHash = typeof window !== 'undefined' ? window.location.hash : '';
    var params = parseQueryParams(currentHash);

    // Reason Banner for Gated Interaction
    if (banner) {
      if (params.reason === 'interact') {
        banner.style.display = 'flex';
        banner.innerHTML = [
          '<span class="auth-banner-icon" aria-hidden="true">✨</span>',
          '<div class="auth-banner-text">',
          '  <strong>Create an account or sign in to like, comment, and connect.</strong>',
          '</div>'
        ].join('');
      } else {
        banner.style.display = 'none';
        banner.innerHTML = '';
      }
    }

    // Toggle Forms
    if (mode === 'register') {
      if (loginForm) loginForm.style.display = 'none';
      if (registerForm) registerForm.style.display = 'block';
      if (heading) heading.textContent = 'Join CodeAlpha';
      if (subtitle) subtitle.textContent = 'Connect and share with developers and creators worldwide';
    } else {
      if (loginForm) loginForm.style.display = 'block';
      if (registerForm) registerForm.style.display = 'none';
      if (heading) heading.textContent = 'Welcome Back';
      if (subtitle) subtitle.textContent = 'Sign in to access your feed and connections';
    }

    // Preserve query parameters when switching between login and register tabs
    var qString = '';
    var qIndex = currentHash.indexOf('?');
    if (qIndex !== -1) {
      qString = currentHash.substring(qIndex);
    }

    if (switchToRegister) {
      switchToRegister.setAttribute('href', '#register' + qString);
    }
    if (switchToLogin) {
      switchToLogin.setAttribute('href', '#login' + qString);
    }
  }

  /**
   * Initializes Auth Forms Submission Handlers
   */
  function initAuthForms() {
    if (typeof document === 'undefined') return;

    var loginForm = document.getElementById('login-form');
    var registerForm = document.getElementById('register-form');

    // --- Login Form Handler ---
    if (loginForm) {
      loginForm.addEventListener('submit', function (e) {
        e.preventDefault();

        var emailInput = document.getElementById('login-email');
        var passwordInput = document.getElementById('login-password');
        var submitBtn = document.getElementById('btn-login-submit');

        var login = emailInput ? emailInput.value.trim() : '';
        var password = passwordInput ? passwordInput.value : '';

        if (!login || !password) {
          if (global.showToast) global.showToast('Please enter your login and password', 'error');
          return;
        }

        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.textContent = 'Logging in...';
        }

        global.api.post('/auth/login', { login: login, password: password })
          .then(function (res) {
            if (submitBtn) {
              submitBtn.disabled = false;
              submitBtn.textContent = 'Log in';
            }

            var token = res && res.data && res.data.token;
            var user = res && res.data && res.data.user;

            if (token && user) {
              global.api.setToken(token);
              localStorage.setItem('user', JSON.stringify(user));

              if (global.app && typeof global.app.updateAuthUI === 'function') {
                global.app.updateAuthUI();
              }

              if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
                window.dispatchEvent(new CustomEvent('auth:change', { detail: { user: user } }));
              }

              if (global.showToast) {
                global.showToast('Welcome back, ' + user.username + '!', 'success');
              }

              // Return redirection
              var params = parseQueryParams(window.location.hash);
              var target = getRedirectTarget(params);

              if (global.router && typeof global.router.navigate === 'function') {
                global.router.navigate(target);
              } else {
                window.location.hash = target;
              }
            }
          })
          .catch(function (err) {
            if (submitBtn) {
              submitBtn.disabled = false;
              submitBtn.textContent = 'Log in';
            }
            if (global.showToast) {
              global.showToast(err.message || 'Login failed. Please check credentials.', 'error');
            }
          });
      });
    }

    // --- Register Form Handler ---
    if (registerForm) {
      registerForm.addEventListener('submit', function (e) {
        e.preventDefault();

        var usernameInput = document.getElementById('register-username');
        var emailInput = document.getElementById('register-email');
        var passwordInput = document.getElementById('register-password');
        var submitBtn = document.getElementById('btn-register-submit');

        var username = usernameInput ? usernameInput.value.trim() : '';
        var email = emailInput ? emailInput.value.trim() : '';
        var password = passwordInput ? passwordInput.value : '';

        if (!username || !email || !password) {
          if (global.showToast) global.showToast('All fields are required', 'error');
          return;
        }

        if (username.length < 3) {
          if (global.showToast) global.showToast('Username must be at least 3 characters', 'error');
          return;
        }

        if (password.length < 6) {
          if (global.showToast) global.showToast('Password must be at least 6 characters', 'error');
          return;
        }

        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.textContent = 'Creating account...';
        }

        global.api.post('/auth/register', { username: username, email: email, password: password })
          .then(function (res) {
            if (submitBtn) {
              submitBtn.disabled = false;
              submitBtn.textContent = 'Create Account';
            }

            var token = res && res.data && res.data.token;
            var user = res && res.data && res.data.user;

            if (token && user) {
              global.api.setToken(token);
              localStorage.setItem('user', JSON.stringify(user));

              if (global.app && typeof global.app.updateAuthUI === 'function') {
                global.app.updateAuthUI();
              }

              if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
                window.dispatchEvent(new CustomEvent('auth:change', { detail: { user: user } }));
              }

              if (global.showToast) {
                global.showToast('Account created! Welcome to CodeAlpha, ' + user.username + '!', 'success');
              }

              // Return redirection
              var params = parseQueryParams(window.location.hash);
              var target = getRedirectTarget(params);

              if (global.router && typeof global.router.navigate === 'function') {
                global.router.navigate(target);
              } else {
                window.location.hash = target;
              }
            }
          })
          .catch(function (err) {
            if (submitBtn) {
              submitBtn.disabled = false;
              submitBtn.textContent = 'Create Account';
            }
            if (global.showToast) {
              global.showToast(err.message || 'Registration failed', 'error');
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
