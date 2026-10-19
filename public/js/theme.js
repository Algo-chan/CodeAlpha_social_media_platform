/**
 * Adaptive Slate Theme Manager
 * Supports localStorage persistence & system prefers-color-scheme fallback
 */
(function (global) {
  'use strict';

  var THEME_KEY = 'theme';

  function getSystemPreference() {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'light';
  }

  function getStoredTheme() {
    try {
      return localStorage.getItem(THEME_KEY);
    } catch (e) {
      return null;
    }
  }

  function getTheme() {
    var stored = getStoredTheme();
    if (stored === 'dark' || stored === 'light') {
      return stored;
    }
    return getSystemPreference();
  }

  function updateToggleUI(theme) {
    if (typeof document === 'undefined') return;
    var isDark = theme === 'dark';
    var toggleButtons = document.querySelectorAll('.theme-toggle-btn');
    toggleButtons.forEach(function (btn) {
      btn.setAttribute('aria-label', isDark ? 'Switch to light mode' : 'Switch to dark mode');
      btn.setAttribute('title', isDark ? 'Switch to light mode' : 'Switch to dark mode');
      var moon = btn.querySelector('.icon-moon');
      var sun = btn.querySelector('.icon-sun');
      if (moon && sun) {
        // Show the icon for the mode a click will take you to.
        moon.style.display = isDark ? 'none' : 'block';
        sun.style.display = isDark ? 'block' : 'none';
      }
      // When the toggle is a menu row, spell out the target instead of
      // relying on the icon alone.
      var label = btn.querySelector('span:not(.theme-icon)');
      if (label) label.textContent = isDark ? 'Light mode' : 'Dark mode';
      // Keep the browser chrome in step with the app theme.
      var meta = document.querySelector('meta[name="theme-color"]:not([media])');
      if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute('name', 'theme-color');
        document.head.appendChild(meta);
      }
      meta.setAttribute('content', isDark ? '#0d0f14' : '#ffffff');
    });
  }

  function setTheme(theme) {
    if (theme !== 'dark' && theme !== 'light') {
      theme = 'light';
    }
    if (typeof document !== 'undefined' && document.documentElement) {
      document.documentElement.setAttribute('data-theme', theme);
    }
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch (e) {
      // Storage access disabled or quota exceeded
    }
    updateToggleUI(theme);

    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      try {
        window.dispatchEvent(new CustomEvent('themechange', { detail: { theme: theme } }));
      } catch (e) {
        // Fallback for older browsers
      }
    }
    return theme;
  }

  function toggleTheme() {
    var current = getTheme();
    var next = current === 'dark' ? 'light' : 'dark';
    return setTheme(next);
  }

  function initTheme() {
    var initialTheme = getTheme();
    setTheme(initialTheme);

    // Watch for OS theme changes if user has not set explicit preference
    if (typeof window !== 'undefined' && window.matchMedia) {
      var mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      var handler = function (e) {
        if (!getStoredTheme()) {
          setTheme(e.matches ? 'dark' : 'light');
        }
      };
      if (typeof mediaQuery.addEventListener === 'function') {
        mediaQuery.addEventListener('change', handler);
      } else if (typeof mediaQuery.addListener === 'function') {
        mediaQuery.addListener(handler);
      }
    }

    if (typeof document !== 'undefined') {
      var bindToggles = function () {
        var buttons = document.querySelectorAll('.theme-toggle-btn');
        buttons.forEach(function (btn) {
          if (!btn.__themeListenerAttached) {
            btn.__themeListenerAttached = true;
            btn.addEventListener('click', function (e) {
              e.preventDefault();
              toggleTheme();
            });
          }
        });
        updateToggleUI(getTheme());
      };

      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bindToggles);
      } else {
        bindToggles();
      }
    }

    return initialTheme;
  }

  // Self-initialize immediately to avoid flash of incorrect theme
  var currentTheme = initTheme();

  var ThemeManager = {
    getTheme: getTheme,
    setTheme: setTheme,
    toggleTheme: toggleTheme,
    initTheme: initTheme,
    currentTheme: currentTheme,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ThemeManager;
  }
  global.ThemeManager = ThemeManager;
  global.toggleTheme = toggleTheme;
  global.initTheme = initTheme;
})(typeof window !== 'undefined' ? window : globalThis);
