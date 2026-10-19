/**
 * API client
 * Wraps fetch, attaches the bearer token, serialises JSON and FormData,
 * normalises backend errors, and surfaces a toast for user-facing failures.
 */
(function (global) {
  'use strict';

  var API_BASE_URL = '/api/v1';
  var TOKEN_KEY = 'auth_token';
  var USER_KEY = 'user';

  var TOAST_DURATION = 4000;

  function iconMarkup(type) {
    var name = type === 'success' ? 'check' : type === 'error' ? 'alert-circle' : 'info';
    if (global.icons && global.icons.svg) {
      return global.icons.svg(name, { size: 16 });
    }
    return '';
  }

  /**
   * Show a toast. Enter/leave run through CSS transitions so a rapid second
   * toast retargets smoothly instead of restarting a keyframe animation.
   * The dismiss timer pauses while the pointer or focus is inside the toast.
   *
   * @param {string} message
   * @param {'info'|'success'|'error'} [type='info']
   * @param {number} [duration]
   */
  function showToast(message, type, duration) {
    type = type === 'success' || type === 'error' ? type : 'info';
    duration = duration !== undefined ? duration : TOAST_DURATION;

    if (typeof document === 'undefined') return null;

    var container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.className = '';
      document.body.appendChild(container);
    }

    var toast = document.createElement('div');
    toast.className = 'toast toast-' + type + ' is-entering';
    toast.setAttribute('role', type === 'error' ? 'alert' : 'status');

    var icon = document.createElement('span');
    icon.className = 'toast-icon';
    icon.innerHTML = iconMarkup(type);

    var body = document.createElement('div');
    body.className = 'toast-body';

    var msg = document.createElement('span');
    msg.className = 'toast-message';
    msg.textContent = message;
    body.appendChild(msg);

    var closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'toast-close';
    closeBtn.setAttribute('aria-label', 'Dismiss notification');
    closeBtn.innerHTML =
      global.icons && global.icons.svg ? global.icons.svg('close', { size: 13 }) : '&times;';

    toast.appendChild(icon);
    toast.appendChild(body);
    toast.appendChild(closeBtn);
    container.appendChild(toast);

    // Trigger the enter transition on the next frame.
    requestAnimationFrame(function () {
      toast.classList.remove('is-entering');
    });

    var timer = null;
    var removed = false;

    function startTimer() {
      if (duration <= 0) return;
      clearTimeout(timer);
      timer = setTimeout(removeToast, duration);
    }

    function pauseTimer() {
      clearTimeout(timer);
    }

    // A person reading a long error should not have it vanish under them.
    toast.addEventListener('mouseenter', pauseTimer);
    toast.addEventListener('mouseleave', startTimer);
    toast.addEventListener('focusin', pauseTimer);
    toast.addEventListener('focusout', startTimer);

    function removeToast() {
      if (removed) return;
      removed = true;
      clearTimeout(timer);
      toast.classList.add('is-leaving');
      var done = function () {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      };
      toast.addEventListener('transitionend', done, { once: true });
      setTimeout(done, 400); // fallback if the transition never fires
    }

    closeBtn.addEventListener('click', removeToast);
    startTimer();

    return { dismiss: removeToast, element: toast };
  }

  function getToken() {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch (e) {
      return null;
    }
  }

  function setToken(token) {
    try {
      if (token) localStorage.setItem(TOKEN_KEY, token);
      else localStorage.removeItem(TOKEN_KEY);
    } catch (e) {}
  }

  function getUser() {
    try {
      var raw = localStorage.getItem(USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function setUser(user) {
    try {
      if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
      else localStorage.removeItem(USER_KEY);
    } catch (e) {}
  }

  function clearAuth() {
    try {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    } catch (e) {}
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      try {
        window.dispatchEvent(new CustomEvent('auth:expired'));
      } catch (e) {}
    }
  }

  async function request(endpoint, options) {
    options = options || {};
    var method = (options.method || 'GET').toUpperCase();
    var headers = Object.assign({}, options.headers || {});
    var body = options.body;
    var isFormData =
      options.isFormData || (typeof FormData !== 'undefined' && body instanceof FormData);

    var url = endpoint.startsWith('http')
      ? endpoint
      : API_BASE_URL + (endpoint.startsWith('/') ? endpoint : '/' + endpoint);

    var token = getToken();
    if (token && !headers['Authorization']) {
      headers['Authorization'] = 'Bearer ' + token;
    }

    var fetchConfig = { method: method, headers: headers };

    if (body !== undefined && body !== null) {
      if (isFormData) {
        delete headers['Content-Type'];
        fetchConfig.body = body;
      } else if (typeof body === 'object') {
        if (!headers['Content-Type']) headers['Content-Type'] = 'application/json';
        fetchConfig.body = JSON.stringify(body);
      } else {
        fetchConfig.body = body;
      }
    }

    var response;
    try {
      response = await fetch(url, fetchConfig);
    } catch (networkErr) {
      var netErr = new Error('Could not reach the server. Check your connection and try again.');
      netErr.status = 0;
      netErr.code = 'NETWORK_ERROR';
      netErr.cause = networkErr;
      if (!options.suppressToast) showToast(netErr.message, 'error');
      throw netErr;
    }

    if (response.status === 401) clearAuth();
    if (response.status === 204) return null;

    var data;
    var contentType = response.headers ? response.headers.get('content-type') : null;
    if (contentType && contentType.includes('application/json')) {
      try {
        data = await response.json();
      } catch (e) {
        data = null;
      }
    } else {
      var text = await response.text();
      try {
        data = JSON.parse(text);
      } catch (e) {
        data = { message: text };
      }
    }

    if (!response.ok) {
      var errorMessage = 'Something went wrong. Please try again.';
      var errorCode = 'API_ERROR';

      if (data && data.error) {
        errorMessage = data.error.message || errorMessage;
        errorCode = data.error.code || errorCode;
      } else if (data && data.message) {
        errorMessage = data.message;
      }

      var error = new Error(errorMessage);
      error.status = response.status;
      error.code = errorCode;
      error.data = data;

      if (!options.suppressToast) showToast(errorMessage, 'error');
      throw error;
    }

    return data;
  }

  function get(endpoint, options) {
    return request(endpoint, Object.assign({}, options, { method: 'GET' }));
  }
  function post(endpoint, body, isFormData, options) {
    return request(endpoint, Object.assign({}, options, { method: 'POST', body: body, isFormData: isFormData }));
  }
  function put(endpoint, body, isFormData, options) {
    return request(endpoint, Object.assign({}, options, { method: 'PUT', body: body, isFormData: isFormData }));
  }
  function del(endpoint, options) {
    return request(endpoint, Object.assign({}, options, { method: 'DELETE' }));
  }

  var api = {
    request: request,
    get: get,
    post: post,
    put: put,
    delete: del,
    getToken: getToken,
    setToken: setToken,
    getUser: getUser,
    setUser: setUser,
    clearAuth: clearAuth,
    showToast: showToast,
    API_BASE_URL: API_BASE_URL,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  global.api = api;
  global.showToast = showToast;
})(typeof window !== 'undefined' ? window : globalThis);
