/**
 * Social Media Platform API Client
 * Wraps Fetch API, automatically attaches Bearer tokens, handles JSON & FormData,
 * parses standardized backend error responses, and dispatches toasts.
 */
(function (global) {
  'use strict';

  var API_BASE_URL = '/api/v1';
  var TOKEN_KEY = 'auth_token';
  var USER_KEY = 'user';

  /**
   * Display toast notification
   * @param {string} message 
   * @param {'info'|'success'|'error'} [type='info'] 
   * @param {number} [duration=3500] 
   */
  function showToast(message, type, duration) {
    type = type || 'info';
    duration = duration !== undefined ? duration : 3500;

    if (typeof document === 'undefined') return;

    var container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.setAttribute('aria-live', 'polite');
      document.body.appendChild(container);
    }

    var toast = document.createElement('div');
    toast.className = 'toast toast-' + type;
    toast.setAttribute('role', 'alert');

    var msgSpan = document.createElement('span');
    msgSpan.className = 'toast-message';
    msgSpan.textContent = message;

    var closeBtn = document.createElement('button');
    closeBtn.className = 'toast-close';
    closeBtn.setAttribute('aria-label', 'Close toast');
    closeBtn.innerHTML = '&times;';
    closeBtn.onclick = function () {
      removeToast(toast);
    };

    toast.appendChild(msgSpan);
    toast.appendChild(closeBtn);
    container.appendChild(toast);

    var timer = setTimeout(function () {
      removeToast(toast);
    }, duration);

    function removeToast(el) {
      clearTimeout(timer);
      el.style.opacity = '0';
      el.style.transform = 'translateY(10px)';
      setTimeout(function () {
        if (el.parentNode) {
          el.parentNode.removeChild(el);
        }
      }, 200);
    }
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
      if (token) {
        localStorage.setItem(TOKEN_KEY, token);
      } else {
        localStorage.removeItem(TOKEN_KEY);
      }
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

  /**
   * Main request handler
   */
  async function request(endpoint, options) {
    options = options || {};
    var method = (options.method || 'GET').toUpperCase();
    var headers = Object.assign({}, options.headers || {});
    var body = options.body;
    var isFormData = options.isFormData || (typeof FormData !== 'undefined' && body instanceof FormData);

    // Format URL
    var url = endpoint.startsWith('http') ? endpoint : API_BASE_URL + (endpoint.startsWith('/') ? endpoint : '/' + endpoint);

    // Injects Authorization header if available
    var token = getToken();
    if (token && !headers['Authorization']) {
      headers['Authorization'] = 'Bearer ' + token;
    }

    var fetchConfig = {
      method: method,
      headers: headers,
    };

    if (body !== undefined && body !== null) {
      if (isFormData) {
        // Let the browser set Content-Type with multipart boundary
        delete headers['Content-Type'];
        fetchConfig.body = body;
      } else if (typeof body === 'object') {
        if (!headers['Content-Type']) {
          headers['Content-Type'] = 'application/json';
        }
        fetchConfig.body = JSON.stringify(body);
      } else {
        fetchConfig.body = body;
      }
    }

    var response;
    try {
      response = await fetch(url, fetchConfig);
    } catch (networkErr) {
      var err = new Error(networkErr.message || 'Network connection failed');
      err.status = 0;
      err.code = 'NETWORK_ERROR';
      if (!options.suppressToast) {
        showToast('Network error: Unable to reach the server', 'error');
      }
      throw err;
    }

    // Handle 401 Unauthorized
    if (response.status === 401) {
      clearAuth();
    }

    // Handle 204 No Content
    if (response.status === 204) {
      return null;
    }

    // Parse JSON
    var data;
    var contentType = response.headers ? response.headers.get('content-type') : null;
    if (contentType && contentType.includes('application/json')) {
      try {
        data = await response.json();
      } catch (parseErr) {
        data = null;
      }
    } else {
      var textData = await response.text();
      try {
        data = JSON.parse(textData);
      } catch (e) {
        data = { message: textData };
      }
    }

    // Check HTTP status code
    if (!response.ok) {
      var errorMessage = 'Request failed';
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

      if (!options.suppressToast) {
        showToast(errorMessage, 'error');
      }
      throw error;
    }

    return data;
  }

  // HTTP Helper methods
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
