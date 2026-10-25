'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const K = require('../src/skins.js');

const css = fs.readFileSync(path.join(__dirname, '..', 'styles.css'), 'utf8');
function vars(sel) {
  const i = css.indexOf(sel);
  const body = css.slice(css.indexOf('{', i) + 1, css.indexOf('}', i));
  const o = {};
  body.replace(/--([\w-]+):\s*([^;]+);/g, (_, k, v) => { o[k] = v.trim(); });
  return o;
}
const base = vars(':root {');
const THEMES = { colour: base, night: Object.assign({}, base, vars(':root[data-theme="night"]')) };
const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const lum = (c) => { const f = rgb(c).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * f[0] + 0.7152 * f[1] + 0.0722 * f[2]; };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const dist = (a, b) => Math.hypot(...rgb(a).map((v, i) => v - rgb(b)[i]));

test('the colour and style lists are fixed and the defaults are the current look', () => {
  assert.deepEqual(K.COLOURS, ['green', 'cyan', 'blue', 'violet', 'pink', 'lime']);
  assert.deepEqual(K.STYLES, ['smooth', 'pixel']);
  assert.equal(K.DEFAULT_COLOUR, 'green');
  assert.equal(K.DEFAULT_STYLE, 'smooth');
  assert.deepEqual(K.resolve('night', 'green'), { snake: THEMES.night.snake, snakeHead: THEMES.night['snake-head'], snakeEdge: THEMES.night['snake-edge'] });
  assert.deepEqual(K.resolve('colour', 'green'), { snake: THEMES.colour.snake, snakeHead: THEMES.colour['snake-head'], snakeEdge: THEMES.colour['snake-edge'] }, 'green is exactly what the theme already uses');
});

test('LCD stays monochrome and unknown names are ignored', () => {
  assert.equal(K.resolve('lcd', 'pink'), null);
  assert.equal(K.resolve('night', 'red'), null);
  assert.equal(K.resolve('night', '__proto__'), null);
  assert.equal(K.resolve('constructor', 'green'), null);
});

test('every colour keeps at least 3:1 against the board in both themes (body and head)', () => {
  for (const theme of ['colour', 'night']) {
    for (const c of K.COLOURS) {
      const r = K.resolve(theme, c);
      assert.ok(ratio(r.snake, THEMES[theme].board) >= 3, `${theme} ${c} body ${ratio(r.snake, THEMES[theme].board).toFixed(2)}`);
      assert.ok(ratio(r.snakeHead, THEMES[theme].board) >= 3, `${theme} ${c} head ${ratio(r.snakeHead, THEMES[theme].board).toFixed(2)}`);
    }
  }
});

test('the head is distinct from the body, and no snake colour is close to the fruit or the bonus', () => {
  for (const theme of ['colour', 'night']) {
    for (const c of K.COLOURS) {
      const r = K.resolve(theme, c);
      assert.ok(dist(r.snake, r.snakeHead) >= 40, `${theme} ${c} head vs body`);
      assert.ok(dist(r.snake, THEMES[theme].food) >= 80, `${theme} ${c} vs fruit`);
      assert.ok(dist(r.snake, THEMES[theme].bonus) >= 80, `${theme} ${c} vs bonus`);
      assert.ok(dist(r.snake, THEMES[theme].obstacle) >= 60, `${theme} ${c} vs maze blocks`);
    }
  }
});

test('eyes stay readable on every head colour', () => {
  for (const theme of ['colour', 'night']) {
    for (const c of K.COLOURS) {
      const r = K.resolve(theme, c);
      assert.ok(ratio(THEMES[theme].eye, r.snakeHead) >= 3, `${theme} ${c} eye vs head ${ratio(THEMES[theme].eye, r.snakeHead).toFixed(2)}`);
    }
  }
});

test('the table has no red, orange or yellow body colours', () => {
  for (const theme of ['colour', 'night']) {
    for (const c of K.COLOURS) {
      const [r, g, b] = rgb(K.resolve(theme, c).snake);
      const warm = r > g * 1.35 && r > b * 1.35 && g < r; // red or orange family
      assert.ok(!warm, `${theme} ${c}`);
    }
  }
});
