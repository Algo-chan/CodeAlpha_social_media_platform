/**
 * Icon set
 * Inline SVG so the app keeps its zero-CDN guarantee and icons inherit
 * currentColor. Each entry is the inner markup of a 24x24 viewBox.
 */
(function (global) {
  'use strict';

  var PATHS = {
    heart:
      '<path d="M12 20.4l-1.35-1.23C5.4 14.56 2 11.47 2 7.68 2 4.6 4.42 2.2 7.5 2.2c1.74 0 3.41.81 4.5 2.09 1.09-1.28 2.76-2.09 4.5-2.09C19.58 2.2 22 4.6 22 7.68c0 3.79-3.4 6.88-8.65 11.5L12 20.4z"/>',
    comment:
      '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>',
    trash:
      '<path d="M3 6h18"/><path d="M8 6V4.5A1.5 1.5 0 0 1 9.5 3h5A1.5 1.5 0 0 1 16 4.5V6"/><path d="M19 6l-.8 12.1a2 2 0 0 1-2 1.9H7.8a2 2 0 0 1-2-1.9L5 6"/><path d="M10 11v6M14 11v6"/>',
    check:
      '<path d="M20 6L9 17l-5-5"/>',
    'alert-circle':
      '<circle cx="12" cy="12" r="9"/><path d="M12 8v4.5"/><path d="M12 16h.01"/>',
    info:
      '<circle cx="12" cy="12" r="9"/><path d="M12 16v-4.5"/><path d="M12 8h.01"/>',
    close:
      '<path d="M18 6L6 18M6 6l12 12"/>',
    users:
      '<path d="M16 20v-1.5a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4V20"/><circle cx="9" cy="7" r="3.2"/><path d="M22 20v-1.5a4 4 0 0 0-3-3.87"/><path d="M16 3.6a4 4 0 0 1 0 7.75"/>',
    'pen-square':
      '<path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.4 2.6a2 2 0 0 1 2.8 2.8L12.5 14 9 15l1-3.5 8.4-8.9z"/>',
    'search-x':
      '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.6-3.6"/><path d="M9 9l4 4M13 9l-4 4"/>',
    image:
      '<rect x="3" y="4" width="18" height="16" rx="2.5"/><circle cx="8.6" cy="9.4" r="1.6"/><path d="M21 16.5l-4.6-4.3L7 20"/>',
    sparkle:
      '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z"/>',
  };

  /**
   * Returns an <svg> string for the named icon.
   * @param {string} name
   * @param {{size?:number, className?:string, filled?:boolean}} [options]
   */
  function svg(name, options) {
    options = options || {};
    var inner = PATHS[name];
    if (!inner) return '';

    var size = options.size || 20;
    var cls = options.className ? ' class="' + options.className + '"' : '';
    var fill = options.filled ? 'currentColor' : 'none';

    return (
      '<svg viewBox="0 0 24 24" width="' + size + '" height="' + size + '"' + cls +
      ' fill="' + fill + '" stroke="currentColor" stroke-width="1.8"' +
      ' stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' +
      inner +
      '</svg>'
    );
  }

  var icons = { svg: svg, PATHS: PATHS };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = icons;
  }
  global.icons = icons;
})(typeof window !== 'undefined' ? window : globalThis);
