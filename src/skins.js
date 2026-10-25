// Snake colours and styles. Presentation only: nothing here touches the rules or the scores.
// The LCD theme stays monochrome and ignores the colour choice.
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SnakeSkins = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var COLOURS = ['green', 'cyan', 'blue', 'violet', 'pink', 'lime'];
  var STYLES = ['smooth', 'pixel'];

  // No red, orange or yellow: the fruit is red or amber and the bonus is gold, so the
  // snake must never look like either. body, head and edge (shadow) colours per theme.
  var TABLE = {
    night: {
      green:  { body: '#34e39c', head: '#7cf7c0', edge: '#01070a' },
      cyan:   { body: '#22d3ee', head: '#a5f3fc', edge: '#01070a' },
      blue:   { body: '#60a5fa', head: '#bfdbfe', edge: '#01070a' },
      violet: { body: '#a78bfa', head: '#ddd6fe', edge: '#01070a' },
      pink:   { body: '#f472b6', head: '#fbcfe8', edge: '#01070a' },
      lime:   { body: '#a3e635', head: '#d9f99d', edge: '#01070a' }
    },
    colour: {
      green:  { body: '#2f7d4f', head: '#1f5c38', edge: '#1b3d2a' },
      cyan:   { body: '#0e7490', head: '#164e63', edge: '#082f49' },
      blue:   { body: '#2563eb', head: '#1e40af', edge: '#172554' },
      violet: { body: '#7c3aed', head: '#5b21b6', edge: '#2e1065' },
      pink:   { body: '#c026d3', head: '#86198f', edge: '#4a044e' },
      lime:   { body: '#4d7c0f', head: '#365314', edge: '#1a2e05' }
    }
  };

  function hasOwn(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }

  // Returns { snake, snakeHead, snakeEdge } for a theme and colour, or null when the theme
  // keeps its own monochrome snake (LCD) or the names are unknown.
  function resolve(theme, colour) {
    if (!hasOwn(TABLE, theme) || !hasOwn(TABLE[theme], colour)) return null;
    var c = TABLE[theme][colour];
    return { snake: c.body, snakeHead: c.head, snakeEdge: c.edge };
  }

  return {
    COLOURS: COLOURS,
    STYLES: STYLES,
    DEFAULT_COLOUR: 'green',
    DEFAULT_STYLE: 'smooth',
    TABLE: TABLE,
    resolve: resolve
  };
});
