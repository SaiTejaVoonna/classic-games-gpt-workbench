'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../src/engine.js');
const R = require('../src/render.js');

const W = 630, H = 420; // 21 x 14 cells of 30 px
const cells = (arr) => arr.map(([x, y]) => ({ x, y }));
const game = (snake, dir, over) => Object.assign({}, E.createGame({ seed: 3 }), { snake: cells(snake), dir: dir || 'right' }, over || {});
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

const PALETTE = { boardLine: '#boardline', snake: '#snake', snakeHead: '#head', snakeEdge: '#edge', shine: '#shine', eye: '#eye', pupil: '#pupil', food: '#food', bonus: '#bonus', obstacle: '#obstacle', obstacleEdge: '#obstacleedge' };

// A recording stand-in for CanvasRenderingContext2D.
function mockCtx() {
  const log = [];
  const state = { fillStyle: null, strokeStyle: null, globalAlpha: 1, lineWidth: 1 };
  const ctx = new Proxy({}, {
    get(_, name) {
      if (name in state) return state[name];
      if (name === 'log') return log;
      return (...args) => { log.push({ op: name, args, fillStyle: state.fillStyle, strokeStyle: state.strokeStyle, alpha: state.globalAlpha }); };
    },
    set(_, name, value) { state[name] = value; return true; }
  });
  return ctx;
}

test('layout keeps square cells and centres the board', () => {
  const l = R.layout(21, 14, 700, 420);
  assert.equal(l.cell, 30);
  assert.equal(l.ox, 35);
  assert.equal(l.oy, 0);
});

test('body radius: tapers gently to the tail, full width through the body', () => {
  const n = 12, cell = 30;
  const radii = Array.from({ length: n }, (_, i) => R.bodyRadius(i, n, cell));
  for (let i = 1; i < n; i++) assert.ok(radii[i] <= radii[i - 1] + 1e-9, `non increasing toward the tail at ${i}`);
  assert.equal(radii[0], R.BODY_R * cell);
  assert.equal(radii[n - 1], R.TAIL_R * cell);
  assert.ok(radii[n - 1] < radii[n - 2] && radii[n - 2] < radii[n - 3], 'the taper is gradual');
  assert.equal(radii[n - 1 - R.TAPER_CELLS], R.BODY_R * cell, 'full width before the taper starts');
  // small snakes still taper
  const s = [0, 1, 2].map((i) => R.bodyRadius(i, 3, cell));
  assert.ok(s[2] < s[1] && s[1] <= s[0]);
});

test('straight path: joints sit on cell centres in a line, linked without gaps', () => {
  const g = R.snakeGeometry(game([[8, 7], [7, 7], [6, 7], [5, 7]]), W, H);
  assert.equal(g.joints.length, 4);
  assert.equal(g.links.length, 3);
  assert.equal(g.stubs.length, 0);
  g.joints.forEach((j, i) => { assert.equal(j.x, (8 - i + 0.5) * 30); assert.equal(j.y, 7.5 * 30); });
  g.links.forEach((k) => {
    const a = g.joints[k.from], b = g.joints[k.to];
    assert.equal(dist(a, b), 30, 'neighbouring joints are one cell apart');
    assert.ok(dist(a, b) < a.r + b.r + 1e-9 + 30, 'and the shapes overlap');
    assert.ok(a.r + b.r > 0.35 * 30, 'no pinch between segments');
  });
});

test('turns: each bend joins two cell centres, so the body is one connected path', () => {
  const path = [[10, 5], [9, 5], [9, 6], [9, 7], [10, 7], [11, 7], [11, 6], [12, 6]];
  const g = R.snakeGeometry(game(path), W, H);
  assert.equal(g.links.length, path.length - 1);
  g.links.forEach((k) => assert.equal(dist(g.joints[k.from], g.joints[k.to]), 30));
  // the corner joint at (9,5) is shared by a horizontal and a vertical link
  const corner = 1;
  const dirs = g.links.filter((k) => k.from === corner || k.to === corner).map((k) => {
    const o = g.joints[k.from === corner ? k.to : k.from];
    return Math.abs(o.x - g.joints[corner].x) > 1 ? 'h' : 'v';
  });
  assert.deepEqual(dirs.sort(), ['h', 'v']);
  // a bend joint is a circle at least as wide as the body there, which rounds the outer corner
  assert.ok(g.joints[corner].r >= 0.3 * 30);
});

test('wrap: a body crossing an edge gets half cell stubs and no long link', () => {
  const g = R.snakeGeometry(game([[1, 3], [0, 3], [20, 3], [19, 3]], 'right', { wrap: true }), W, H);
  assert.equal(g.links.length, 2, 'only the two real neighbours are linked');
  assert.equal(g.stubs.length, 2);
  const left = g.stubs.find((s) => s.joint === 1);
  const right = g.stubs.find((s) => s.joint === 2);
  assert.deepEqual([left.ux, left.uy], [-1, 0], 'the cell at x=0 continues out of the left edge');
  assert.deepEqual([right.ux, right.uy], [1, 0], 'the cell at x=20 continues out of the right edge');
  assert.equal(left.len, 15);
  g.links.forEach((k) => assert.equal(dist(g.joints[k.from], g.joints[k.to]), 30));
});

test('wrap vertically: stubs point out of the top and bottom edges', () => {
  const g = R.snakeGeometry(game([[4, 1], [4, 0], [4, 13], [4, 12]], 'up', { wrap: true }), W, H);
  assert.equal(g.stubs.length, 2);
  assert.deepEqual([g.stubs.find((s) => s.joint === 1).ux, g.stubs.find((s) => s.joint === 1).uy], [0, -1]);
  assert.deepEqual([g.stubs.find((s) => s.joint === 2).ux, g.stubs.find((s) => s.joint === 2).uy], [0, 1]);
});

test('head and eyes: distinct, inside the head, and oriented in the current direction', () => {
  const vec = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  for (const dir of Object.keys(vec)) {
    const [ux, uy] = vec[dir];
    const tail = [[10 - ux, 7 - uy], [10 - 2 * ux, 7 - 2 * uy]];
    const g = R.snakeGeometry(game([[10, 7], ...tail], dir), W, H);
    assert.equal(g.eyes.length, 2);
    assert.ok(g.head.r > g.joints[1].r, 'the head is larger than the neck');
    const [a, b] = g.eyes;
    for (const e of g.eyes) {
      const fwd = (e.x - g.head.x) * ux + (e.y - g.head.y) * uy;
      assert.ok(fwd > 0, `${dir}: eyes sit toward the front`);
      assert.ok(dist(e, g.head) + e.r <= g.head.r + 1e-9, `${dir}: eye inside the head`);
      assert.ok(e.pupil.r < e.r, 'pupil smaller than eye');
      assert.ok(dist(e, e.pupil) <= e.r, 'pupil inside the eye');
      assert.ok(e.r < 0.15 * 30, 'restrained eyes');
    }
    const side = (a.x - b.x) * -uy + (a.y - b.y) * ux; // separation across the direction
    assert.ok(Math.abs(side) > 0.3 * 30, `${dir}: eyes are apart across the head`);
    assert.ok(Math.abs((a.x - b.x) * ux + (a.y - b.y) * uy) < 1e-9, `${dir}: eyes level along the direction`);
  }
});

test('eyes turn with the snake: same body, different heading, mirrored eye layout', () => {
  const right = R.snakeGeometry(game([[10, 7], [9, 7], [8, 7]], 'right'), W, H);
  const left = R.snakeGeometry(game([[10, 7], [11, 7], [12, 7]], 'left'), W, H);
  assert.ok(right.eyes[0].x > right.head.x);
  assert.ok(left.eyes[0].x < left.head.x);
});

test('geometry is pure: the state is not changed', () => {
  const s = game([[5, 5], [4, 5], [3, 5]]);
  const before = JSON.stringify(s);
  R.snakeGeometry(s, W, H);
  assert.equal(JSON.stringify(s), before);
});

test('geometry scales with the canvas and keeps the same proportions', () => {
  const s = game([[8, 7], [7, 7], [6, 7], [5, 7]]);
  const a = R.snakeGeometry(s, 630, 420);
  const b = R.snakeGeometry(s, 1260, 840);
  a.joints.forEach((j, i) => { assert.ok(Math.abs(b.joints[i].r - 2 * j.r) < 1e-9); assert.ok(Math.abs(b.joints[i].x - 2 * j.x) < 1e-9); });
});

// ---------- drawing with a recording context ----------
const fills = (ctx) => ctx.log.filter((c) => c.op === 'fill').map((c) => c.fillStyle);

test('draw order: shadow, body, then head, then eyes; palette colours are used', () => {
  const ctx = mockCtx();
  R.draw(ctx, game([[8, 7], [7, 7], [6, 7], [5, 7]]), PALETTE, W, H);
  const f = fills(ctx);
  const firstBody = f.indexOf('#snake');
  const firstHead = f.indexOf('#head');
  assert.ok(f.indexOf('#edge') >= 0 && f.indexOf('#edge') < firstBody, 'soft shadow first');
  assert.ok(firstBody >= 0 && firstHead > firstBody, 'head after body');
  assert.ok(f.lastIndexOf('#pupil') > f.lastIndexOf('#eye'), 'pupils after eyes');
  assert.ok(f.lastIndexOf('#eye') > firstHead, 'eyes after head');
});

test('draw: shadow and highlight are subtle', () => {
  const ctx = mockCtx();
  R.draw(ctx, game([[8, 7], [7, 7], [6, 7]]), PALETTE, W, H);
  const shadow = ctx.log.filter((c) => c.op === 'fill' && c.fillStyle === '#edge');
  assert.ok(shadow.length > 0 && shadow.every((c) => c.alpha <= 0.4));
  const shine = ctx.log.filter((c) => c.op === 'stroke' && c.strokeStyle === '#shine');
  assert.equal(shine.length, 1, 'one continuous highlight along the body');
  assert.ok(shine[0].alpha <= 0.3);
});

test('draw: the highlight continues around turns and restarts after a wrap', () => {
  const ctx = mockCtx();
  R.draw(ctx, game([[1, 3], [0, 3], [20, 3], [19, 3]], 'right', { wrap: true }), PALETTE, W, H);
  const moves = ctx.log.filter((c) => c.op === 'moveTo').length;
  assert.ok(moves > 0);
  const ctx2 = mockCtx();
  R.draw(ctx2, game([[8, 7], [7, 7], [7, 8], [7, 9]]), PALETTE, W, H);
  assert.ok(ctx2.log.filter((c) => c.op === 'stroke' && c.strokeStyle === '#shine').length === 1);
});

test('draw: food, obstacles and the wrap edge only appear when present', () => {
  const plain = mockCtx();
  R.draw(plain, game([[8, 7], [7, 7], [6, 7]], 'right', { food: null, wrap: false }), PALETTE, W, H);
  assert.ok(!fills(plain).includes('#food'));
  assert.ok(!fills(plain).includes('#obstacle'));
  assert.ok(!plain.log.some((c) => c.op === 'setLineDash'));
  assert.ok(plain.log.some((c) => c.op === 'strokeRect'), 'solid walls show a solid inner edge');
  assert.ok(!plain.log.some((c) => c.op === 'setLineDash'), 'and no dashes');

  const full = mockCtx();
  const g = E.createGame({ seed: 3, board: 'pillars', wrap: true });
  R.draw(full, g, PALETTE, W, H);
  assert.equal(fills(full).filter((c) => c === '#obstacle').length, g.obstacles.length, 'one block per obstacle cell');
  assert.ok(fills(full).includes('#food'));
  assert.ok(full.log.some((c) => c.op === 'setLineDash'), 'dashed edge shows the wrap rule');
  assert.equal(full.log.filter((c) => c.op === 'strokeRect').length, 1, 'wrap draws one dashed edge, not a second solid one');
});

test('draw: obstacle blocks are grid aligned squares', () => {
  const ctx = mockCtx();
  const g = E.createGame({ seed: 3, board: 'gate' });
  R.draw(ctx, g, PALETTE, W, H);
  const arcs = ctx.log.filter((c) => c.op === 'moveTo');
  assert.ok(arcs.length > 0);
  const rects = ctx.log.filter((c) => c.op === 'arcTo');
  assert.ok(rects.length >= g.obstacles.length * 4, 'rounded square per block');
});

test('draw: the bonus ring shows the remaining time', () => {
  for (const [left, frac] of [[24, 1], [12, 0.5], [6, 0.25]]) {
    const ctx = mockCtx();
    R.draw(ctx, game([[8, 7], [7, 7], [6, 7]], 'right', { bonusItem: { x: 15, y: 3, ticksLeft: left }, bonusTicks: 24 }), PALETTE, W, H);
    const ring = ctx.log.find((c) => c.op === 'arc' && c.strokeStyle === '#bonus' && c.args[2] > 12 && c.args[2] < 14);
    assert.ok(ring, 'ring arc drawn');
    const sweep = ring.args[4] - ring.args[3];
    assert.ok(Math.abs(sweep - Math.PI * 2 * frac) < 1e-9, `${left}/24 ticks`);
  }
  const none = mockCtx();
  R.draw(none, game([[8, 7], [7, 7], [6, 7]]), PALETTE, W, H);
  assert.ok(!fills(none).includes('#bonus'));
});

test('draw: state is not mutated and call count stays linear in the snake length', () => {
  const body = [];
  for (let i = 0; i < 40; i++) body.push([i % 20 + 1, 2 + Math.floor(i / 20) * 2]);
  const s = Object.freeze(game(body.slice(0, 3)));
  assert.doesNotThrow(() => R.draw(mockCtx(), s, PALETTE, W, H));
  const small = mockCtx(); R.draw(small, game([[5, 5], [4, 5], [3, 5]]), PALETTE, W, H);
  const long = [];
  for (let i = 0; i < 60; i++) long.push([2 + (i % 18), 3 + Math.floor(i / 18)]);
  const big = mockCtx(); R.draw(big, game(long), PALETTE, W, H);
  assert.ok((big.log.length - small.log.length) / 57 < 30, `calls per extra cell ${(big.log.length - small.log.length) / 57}`);
});

// ---------- pixel style ----------
test('pixel style: one square per cell, inside its cell, head and eyes on the front', () => {
  const s = game([[10, 7], [9, 7], [8, 7], [7, 7]]);
  const g = R.pixelGeometry(s, W, H);
  assert.equal(g.cells.length, 4);
  g.cells.forEach((c, i) => {
    const cx = s.snake[i].x * 30, cy = s.snake[i].y * 30;
    assert.ok(c.x >= cx && c.y >= cy && c.x + c.size <= cx + 30 && c.y + c.size <= cy + 30, 'inside the cell ' + i);
    assert.equal(c.head, i === 0);
    assert.ok(c.size >= 24, 'a solid block');
  });
  assert.equal(g.eyes.length, 2);
  for (const e of g.eyes) assert.ok(e.x + e.size / 2 > 10.5 * 30 - 1, 'eyes toward the front (right)');
});

test('pixel style: draws squares (no round body), uses the palette and keeps the grid, food and blocks', () => {
  const ctx = mockCtx();
  const state = E.createGame({ seed: 3, board: 'pillars', wrap: false });
  R.draw(ctx, Object.assign({}, state, { snake: cells([[10, 7], [9, 7], [8, 7]]), dir: 'right' }), Object.assign({}, PALETTE, { style: 'pixel' }), W, H);
  const rects = ctx.log.filter((c) => c.op === 'fillRect');
  assert.equal(rects.length, 3 + 2, 'three cells and two eyes');
  assert.ok(rects.slice(0, 3).every((c) => c.fillStyle === '#snake' || c.fillStyle === '#head'));
  assert.equal(rects[0].fillStyle, '#head');
  assert.ok(!ctx.log.some((c) => c.op === 'arc' && c.fillStyle === '#snake'), 'no round body');
  assert.ok(ctx.log.some((c) => c.op === 'fill' && c.fillStyle === '#food'), 'fruit still drawn');
  assert.ok(ctx.log.some((c) => c.op === 'fill' && c.fillStyle === '#obstacle'), 'blocks still drawn');
});

test('smooth is the default style and pixel does not change the cells', () => {
  const s = game([[8, 7], [7, 7], [6, 7]]);
  const a = mockCtx(); R.draw(a, s, PALETTE, W, H);
  assert.ok(a.log.some((c) => c.op === 'arc'), 'smooth uses circles');
  const g1 = R.snakeGeometry(s, W, H), g2 = R.pixelGeometry(s, W, H);
  g1.joints.forEach((j, i) => assert.ok(g2.cells[i].x < j.x && j.x < g2.cells[i].x + g2.cells[i].size, 'same cell ' + i));
});

test('tall board geometry keeps square cells and fits the canvas', () => {
  const g = R.snakeGeometry(Object.assign({}, E.createGame({ seed: 3, shape: 'tall' })), 420, 630);
  assert.equal(g.layout.cols, 14); assert.equal(g.layout.rows, 21);
  assert.equal(g.layout.cell, 30);
  assert.equal(g.head.ux, 0); assert.equal(g.head.uy, 1);
  for (const e of g.eyes) assert.ok(e.y > g.head.y, 'eyes toward the front (down)');
});

test('glide: joints slide from the previous cells and arrive at the current ones', () => {
  const R = require('../src/render.js');
  const mk = (cells) => ({ cols: 10, rows: 10, dir: 'right', snake: cells.map(([x, y]) => ({ x, y })) });
  const prev = mk([[3, 5], [2, 5], [1, 5]]);
  const cur = mk([[4, 5], [3, 5], [2, 5]]);
  const at = (a) => R.snakeGeometry(cur, 100, 100, { prev, alpha: a }).joints.map((j) => j.x);
  const cell = 10;
  assert.deepEqual(at(0), [3.5 * cell, 2.5 * cell, 1.5 * cell]);
  assert.deepEqual(at(0.5), [4 * cell, 3 * cell, 2 * cell]);
  assert.deepEqual(at(1), [4.5 * cell, 3.5 * cell, 2.5 * cell]);
  assert.deepEqual(R.snakeGeometry(cur, 100, 100).joints.map((j) => j.x), at(1), 'no glide equals alpha 1');
});

test('glide: a growing snake keeps its tail still, and a wrap jumps instead of sweeping across the board', () => {
  const R = require('../src/render.js');
  const mk = (cells) => ({ cols: 10, rows: 10, dir: 'right', snake: cells.map(([x, y]) => ({ x, y })) });
  const prev = mk([[3, 5], [2, 5]]);
  const grown = mk([[4, 5], [3, 5], [2, 5]]);
  const xs = R.snakeGeometry(grown, 100, 100, { prev, alpha: 0 }).joints.map((j) => j.x);
  assert.equal(xs[2], 2.5 * 10, 'new tail joint starts where the old tail was');
  const pw = mk([[9, 5], [8, 5]]);
  const cw = mk([[0, 5], [9, 5]]);
  const wx = R.snakeGeometry(cw, 100, 100, { prev: pw, alpha: 0 }).joints.map((j) => j.x);
  assert.equal(wx[0], 0.5 * 10, 'the head that wrapped is drawn at its new cell');
});

test('glide is ignored when the previous state does not match', () => {
  const R = require('../src/render.js');
  const mk = (cols, cells) => ({ cols, rows: 10, dir: 'right', snake: cells.map(([x, y]) => ({ x, y })) });
  const cur = mk(10, [[4, 5], [3, 5], [2, 5]]);
  const other = mk(14, [[1, 1], [0, 1], [0, 0]]);
  assert.deepEqual(R.snakeGeometry(cur, 100, 100, { prev: other, alpha: 0 }).joints.map((j) => j.x), R.snakeGeometry(cur, 100, 100).joints.map((j) => j.x));
});

test('crawl: the body is one continuous curve that tapers toward the tail', () => {
  const R = require('../src/render.js');
  const st = { cols: 10, rows: 10, dir: 'right', snake: [[5, 5], [4, 5], [3, 5], [3, 4], [3, 3], [4, 3]].map(([x, y]) => ({ x, y })) };
  const g = R.snakeGeometry(st, 100, 100);
  const s = R.crawlSamples(g, 10, 0, 0);
  for (let i = 1; i < s.length; i++) assert.ok(Math.hypot(s[i].x - s[i - 1].x, s[i].y - s[i - 1].y) < 3, 'no gaps between samples');
  assert.ok(s[0].r > s[s.length - 1].r, 'the tail is thinner than the head end');
  assert.equal(s[0].x, g.joints[0].x);
  assert.equal(s[0].y, g.joints[0].y);
});

test('crawl: the wave moves the body sideways, never the head, and is flat with zero amplitude', () => {
  const R = require('../src/render.js');
  const st = { cols: 10, rows: 10, dir: 'right', snake: [[8, 5], [7, 5], [6, 5], [5, 5], [4, 5], [3, 5]].map(([x, y]) => ({ x, y })) };
  const g = R.snakeGeometry(st, 100, 100);
  const flat = R.crawlSamples(g, 10, 0, 0);
  const wavy = R.crawlSamples(g, 10, 0.1, 150);
  assert.ok(flat.every((q) => Math.abs(q.y - 55) < 1e-6), 'a straight snake stays straight without a wave');
  assert.equal(wavy[0].y, flat[0].y, 'the head sits on the path');
  assert.ok(wavy.some((q) => Math.abs(q.y - 55) > 0.3), 'the body sways');
  assert.ok(wavy.every((q) => Math.abs(q.y - 55) <= 1.0001), 'sway stays within a tenth of a cell');
  const later = R.crawlSamples(g, 10, 0.1, 400);
  assert.ok(later.some((q, i) => Math.abs(q.y - wavy[i].y) > 0.2), 'the wave travels over time');
});

test('crawl: a wrapped snake is drawn as separate runs, not one streak across the board', () => {
  const R = require('../src/render.js');
  const st = { cols: 10, rows: 10, dir: 'right', snake: [[0, 5], [9, 5], [8, 5]].map(([x, y]) => ({ x, y })) };
  const s = R.crawlSamples(R.snakeGeometry(st, 100, 100), 10, 0, 0);
  assert.ok(s.some((q) => q.x < 10) && s.some((q) => q.x > 80));
  const crossing = s.filter((q, i) => i > 0 && Math.abs(q.x - s[i - 1].x) > 30);
  assert.equal(crossing.length, 1, 'exactly one jump (the wrap), not a streak of samples across the board');
});
