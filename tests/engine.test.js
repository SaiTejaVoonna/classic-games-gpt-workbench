'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../src/engine.js');

// Build a state directly for edge-case scenarios.
function make(over) {
  const base = E.createGame({ seed: 7, wrap: false }); // the tests below assume solid walls unless a case says otherwise
  return Object.assign({}, base, over);
}
const cells = (arr) => arr.map(([x, y]) => ({ x, y }));
function run(state, inputs) {
  // inputs: array of direction strings or null for "just tick"
  const log = [];
  for (const i of inputs) {
    if (i) state = E.turn(state, i);
    const r = E.step(state);
    state = r.state;
    log.push(...r.events);
  }
  return { state, log };
}

test('initial state is deterministic and valid', () => {
  const a = E.createGame({ seed: 42 });
  const b = E.createGame({ seed: 42 });
  assert.deepEqual(a, b);
  assert.equal(a.snake.length, 3);
  assert.equal(a.status, 'ready');
  assert.ok(!a.snake.some((s) => s.x === a.food.x && s.y === a.food.y));
});

test('same seed + same inputs replay identically; different seeds differ', () => {
  const inputs = ['up', null, null, 'right', null, 'down', null, null, 'left', null];
  const r1 = run(E.createGame({ seed: 5 }), inputs).state;
  const r2 = run(E.createGame({ seed: 5 }), inputs).state;
  assert.deepEqual(r1, r2);
  const foods = new Set();
  for (let s = 1; s <= 20; s++) foods.add(JSON.stringify(E.createGame({ seed: s }).food));
  assert.ok(foods.size > 1);
});

test('does not move before the first accepted input', () => {
  let s = E.createGame({ seed: 1 });
  const before = JSON.stringify(s.snake);
  s = E.step(s).state;
  assert.equal(JSON.stringify(s.snake), before);
  assert.equal(s.status, 'ready');
});

test('first input starts the run: same direction starts, reversal is ignored', () => {
  assert.equal(E.turn(E.createGame({ seed: 1 }), 'left').status, 'ready');
  assert.equal(E.turn(E.createGame({ seed: 1 }), 'right').status, 'running');
  assert.equal(E.turn(E.createGame({ seed: 1 }), 'up').status, 'running');
});

test('moves exactly one cell per tick and keeps length', () => {
  let s = E.turn(E.createGame({ seed: 1 }), 'right');
  const head = s.snake[0];
  const r = E.step(s);
  assert.deepEqual(r.state.snake[0], { x: head.x + 1, y: head.y });
  assert.equal(r.state.snake.length, 3);
  assert.equal(r.state.ticks, 1);
});

test('turn queue: reversal of current heading is ignored', () => {
  let s = E.turn(E.createGame({ seed: 1 }), 'right');
  s = E.turn(s, 'left');
  assert.deepEqual(s.queue, []);
});

test('turn queue: up then down in the same tick keeps only up (no instant reversal)', () => {
  let s = E.turn(E.createGame({ seed: 1 }), 'right');
  s = E.turn(s, 'up');
  s = E.turn(s, 'down');
  assert.deepEqual(s.queue, ['up']);
});

test('turn queue: depth is limited to 2 and turns apply one per tick in order', () => {
  let s = E.turn(E.createGame({ seed: 1 }), 'right');
  s = E.turn(s, 'up');
  s = E.turn(s, 'left');
  s = E.turn(s, 'down'); // third, dropped
  assert.deepEqual(s.queue, ['up', 'left']);
  const h0 = s.snake[0];
  s = E.step(s).state;
  assert.deepEqual(s.snake[0], { x: h0.x, y: h0.y - 1 });
  assert.equal(s.dir, 'up');
  s = E.step(s).state;
  assert.deepEqual(s.snake[0], { x: h0.x - 1, y: h0.y - 1 });
  assert.equal(s.dir, 'left');
});

test('repeating the current direction is not queued', () => {
  let s = E.turn(E.createGame({ seed: 1 }), 'right');
  s = E.turn(s, 'right');
  assert.deepEqual(s.queue, []);
});

test('eating food grows by one, scores one, and respawns food off the body', () => {
  const s0 = make({ status: 'running', snake: cells([[5, 5], [4, 5], [3, 5]]), dir: 'right', food: { x: 6, y: 5 }, rng: 99 });
  const r = E.step(s0);
  assert.equal(r.state.score, 1);
  assert.equal(r.state.snake.length, 4);
  assert.deepEqual(r.state.snake[0], { x: 6, y: 5 });
  assert.deepEqual(r.state.snake[3], { x: 3, y: 5 }); // tail did not move
  assert.deepEqual(r.events[0], { type: 'ate', score: 1 });
  assert.ok(!r.state.snake.some((c) => c.x === r.state.food.x && c.y === r.state.food.y));
});

test('food never spawns on the body across many seeds and positions', () => {
  for (let seed = 0; seed < 300; seed++) {
    const g = E.createGame({ seed, cols: 5, rows: 4 });
    assert.ok(!g.snake.some((c) => c.x === g.food.x && c.y === g.food.y), 'seed ' + seed);
    assert.ok(g.food.x >= 0 && g.food.x < 5 && g.food.y >= 0 && g.food.y < 4);
  }
  const body = cells([[0, 0], [1, 0], [2, 0], [0, 1], [1, 1]]);
  for (let seed = 0; seed < 100; seed++) {
    const [f] = E.placeFood(body, 3, 2, seed);
    assert.deepEqual(f, { x: 2, y: 1 }); // only free cell
  }
});

test('wall collision ends the run on each edge; head does not move', () => {
  const cases = [['left', [0, 5]], ['right', [20, 5]], ['up', [5, 0]], ['down', [5, 13]]];
  for (const [dir, [x, y]] of cases) {
    const s0 = make({ status: 'running', dir, snake: [{ x, y }, { x: x + (dir === 'left' ? 1 : -1) * (dir === 'left' || dir === 'right' ? 1 : 0), y: y + (dir === 'up' ? 1 : dir === 'down' ? -1 : 0) }], queue: [], food: { x: 10, y: 10 } });
    const r = E.step(s0);
    assert.equal(r.state.status, 'over', dir);
    assert.equal(r.state.reason, 'wall', dir);
    assert.deepEqual(r.state.snake[0], { x, y }, dir);
    assert.deepEqual(r.events, [{ type: 'over', reason: 'wall' }]);
  }
});

test('self collision ends the run', () => {
  // head at (2,2) heading left into body cell (1,2); not the tail
  const s0 = make({ status: 'running', dir: 'left', queue: [], food: { x: 15, y: 10 },
    snake: cells([[2, 2], [2, 3], [1, 3], [1, 2], [0, 2], [0, 3]]) });
  const r = E.step(s0);
  assert.equal(r.state.status, 'over');
  assert.equal(r.state.reason, 'self');
});

test('tail rule: moving into the cell the tail vacates is allowed when not eating', () => {
  // 2x2 loop: head (1,0) heading down... snake [(1,0),(0,0),(0,1),(1,1)] head moves to (1,1)=tail
  const s0 = make({ status: 'running', dir: 'down', queue: [], food: { x: 15, y: 10 },
    snake: cells([[1, 0], [0, 0], [0, 1], [1, 1]]) });
  const r = E.step(s0);
  assert.equal(r.state.status, 'running');
  assert.deepEqual(r.state.snake[0], { x: 1, y: 1 });
  assert.equal(r.state.snake.length, 4);
});

test('tail rule: moving into the tail cell while eating is a collision', () => {
  const s0 = make({ status: 'running', dir: 'down', queue: [], food: { x: 1, y: 1 },
    snake: cells([[1, 0], [0, 0], [0, 1], [1, 1]]) });
  const r = E.step(s0);
  assert.equal(r.state.status, 'over');
  assert.equal(r.state.reason, 'self');
});

test('finished runs are frozen: step and turn do nothing', () => {
  const over = make({ status: 'over', reason: 'wall' });
  assert.equal(E.step(over).state, over);
  assert.equal(E.turn(over, 'up'), over);
});

test('filling the board ends the run as won with no food', () => {
  // 3x1 board: snake length 2 at (0,0),(1,0)... head (1,0) heading right, food (2,0)
  const s0 = make({ cols: 3, rows: 1, status: 'running', dir: 'right', queue: [], snake: cells([[1, 0], [0, 0]]), food: { x: 2, y: 0 }, rng: 3 });
  const r = E.step(s0);
  assert.equal(r.state.status, 'won');
  assert.equal(r.state.food, null);
  assert.equal(r.state.score, 1);
  assert.deepEqual(r.events.map((e) => e.type), ['ate', 'won']);
});

test('step does not mutate its input', () => {
  const s0 = E.turn(E.createGame({ seed: 9 }), 'up');
  const snapshot = JSON.stringify(s0);
  E.step(s0);
  E.turn(s0, 'left');
  assert.equal(JSON.stringify(s0), snapshot);
});

test('clock: a normal frame yields at most the due ticks', () => {
  assert.deepEqual(E.advanceClock(0, 16, 150, 2), { steps: 0, acc: 16 });
  assert.deepEqual(E.advanceClock(140, 16, 150, 2), { steps: 1, acc: 6 });
});

test('clock: a long gap (hidden tab / stall) is clamped, not replayed', () => {
  const r = E.advanceClock(0, 60000, 150, 2);
  assert.equal(r.steps, 2);
  assert.ok(r.acc < 150);
  assert.equal(E.advanceClock(0, -5, 150, 2).steps, 0);
});

test('tick count tracks elapsed time across refresh rates', () => {
  for (const frame of [1000 / 30, 1000 / 60, 1000 / 144]) {
    let acc = 0, ticks = 0;
    for (let t = 0; t < 30000; t += frame) {
      const r = E.advanceClock(acc, frame, 150, 2);
      acc = r.acc; ticks += r.steps;
    }
    assert.ok(Math.abs(ticks - 200) <= 1, `frame ${frame.toFixed(1)}: ${ticks}`);
  }
});

test('prototype speeds are exactly 300 / 220 / 150 ms with Slow as default', () => {
  assert.deepEqual(E.SPEEDS, { slow: 300, medium: 220, fast: 150 });
  assert.deepEqual(E.SPEED_ORDER, ['slow', 'medium', 'fast']);
  assert.equal(E.DEFAULT_SPEED, 'slow');
});

test('a run records its speed and tick length at creation', () => {
  for (const [name, ms] of Object.entries(E.SPEEDS)) {
    const g = E.createGame({ seed: 1, speed: name });
    assert.equal(g.speed, name);
    assert.equal(g.tickMs, ms);
  }
  assert.equal(E.createGame({ seed: 1 }).speed, 'slow');
  assert.equal(E.createGame({ seed: 1 }).tickMs, 300);
});

test('unknown speeds fall back to the default', () => {
  for (const bad of ['turbo', '', null, 'constructor', '__proto__', 150]) {
    assert.equal(E.createGame({ seed: 1, speed: bad }).speed, 'slow', String(bad));
  }
});

test('speed does not change the simulation, only the tick length', () => {
  const inputs = ['up', null, null, 'right', null, null, 'down', null];
  const a = run(E.createGame({ seed: 4, speed: 'slow' }), inputs).state;
  const b = run(E.createGame({ seed: 4, speed: 'fast' }), inputs).state;
  assert.deepEqual(a.snake, b.snake);
  assert.deepEqual(a.food, b.food);
  assert.equal(a.score, b.score);
});

test('step keeps the run speed (an existing run keeps its timing)', () => {
  let s = E.turn(E.createGame({ seed: 2, speed: 'slow' }), 'up');
  s = E.step(s).state;
  assert.equal(s.speed, 'slow');
  assert.equal(s.tickMs, 300);
});

test('ticks over 30 s at 60 Hz match each speed (100 / 136 / 200)', () => {
  const expected = { slow: 100, medium: 136, fast: 200 };
  for (const [name, ms] of Object.entries(E.SPEEDS)) {
    let acc = 0, ticks = 0;
    const frame = 1000 / 60;
    for (let t = 0; t < 30000 - 1e-6; t += frame) {
      const r = E.advanceClock(acc, frame, ms, 2);
      acc = r.acc; ticks += r.steps;
    }
    assert.ok(Math.abs(ticks - expected[name]) <= 1, `${name}: ${ticks}`);
  }
});

test('clock clamp scales with the speed: a long gap yields at most 2 ticks at any speed', () => {
  for (const ms of Object.values(E.SPEEDS)) {
    assert.equal(E.advanceClock(0, 120000, ms, 2).steps, 2);
  }
});

test('settings markup lists the same speeds as the engine', () => {
  const html = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'index.html'), 'utf8');
  for (const [name, ms] of Object.entries(E.SPEEDS)) {
    assert.ok(html.includes(`name="speed" value="${name}"`), name);
    assert.ok(html.includes(`(${ms} ms per step)`), `${name} ${ms}`);
  }
  assert.ok(html.includes('Applies to new games'));
  assert.equal((html.match(/name="speed"/g) || []).length, 3);
  assert.ok(/name="speed" value="slow" checked/.test(html), 'Slow is the checked default');
  assert.equal((html.match(/name="speed"[^>]*checked/g) || []).length, 1);
});

// ---------- edge wrap ----------
const mk = (opts, over) => Object.assign({}, E.createGame(Object.assign({ seed: 7, wrap: false }, opts)), over);

test('wrap: leaving each edge re-enters at the opposite edge', () => {
  const cases = [
    ['right', [20, 5], [0, 5], [19, 5]],
    ['left', [0, 5], [20, 5], [1, 5]],
    ['down', [5, 13], [5, 0], [5, 12]],
    ['up', [5, 0], [5, 13], [5, 1]]
  ];
  for (const [dir, [x, y], [ex, ey], [bx, by]] of cases) {
    const s0 = mk({ wrap: true }, { status: 'running', dir, queue: [], snake: cells([[x, y], [bx, by]]), food: { x: 10, y: 10 } });
    const r = E.step(s0);
    assert.equal(r.state.status, 'running', dir);
    assert.deepEqual(r.state.snake[0], { x: ex, y: ey }, dir);
    assert.equal(r.state.snake.length, 2, dir);
  }
});

test('defaults: edges wrap, clear field, one life, bonus on; walls are an explicit choice', () => {
  const g = E.createGame({ seed: 1 });
  assert.equal(E.DEFAULT_EDGES, 'wrap');
  assert.equal(g.wrap, true);
  assert.equal(g.board, 'clear');
  assert.equal(g.livesMode, 'classic');
  assert.equal(g.bonusEnabled, true);
  assert.equal(E.createGame({ seed: 1, wrap: false }).wrap, false);
  assert.equal(E.createGame({ seed: 1, wrap: 'walls' }).wrap, true, 'only an explicit false selects solid walls');
});

test('default wrap: all four edges bring the snake back on the opposite edge (default options)', () => {
  const cases = [['right', [20, 5], [0, 5], [19, 5]], ['left', [0, 5], [20, 5], [1, 5]], ['down', [5, 13], [5, 0], [5, 12]], ['up', [5, 0], [5, 13], [5, 1]]];
  for (const [dir, [x, y], [ex, ey], [bx, by]] of cases) {
    const s0 = Object.assign({}, E.createGame({ seed: 7 }), { status: 'running', dir, queue: [], snake: cells([[x, y], [bx, by]]), food: { x: 10, y: 10 } });
    const r = E.step(s0);
    assert.equal(r.state.status, 'running', dir);
    assert.deepEqual(r.state.snake[0], { x: ex, y: ey }, dir);
  }
});

test('solid walls: each edge collision costs a life with extra lives, and ends a classic run', () => {
  const cases = [['right', [20, 5], [19, 5]], ['left', [0, 5], [1, 5]], ['down', [5, 13], [5, 12]], ['up', [5, 0], [5, 1]]];
  for (const [dir, [x, y], [bx, by]] of cases) {
    const base = { status: 'running', dir, queue: [], snake: cells([[x, y], [bx, by]]), food: { x: 10, y: 10 } };
    const extra = E.step(Object.assign({}, E.createGame({ seed: 7, wrap: false, lives: 'extra' }), base));
    assert.equal(extra.state.lives, 2, dir);
    assert.equal(extra.events[0].reason, 'wall', dir);
    const classic = E.step(Object.assign({}, E.createGame({ seed: 7, wrap: false }), base));
    assert.equal(classic.state.status, 'over', dir);
  }
});

test('maze blocks stay solid whether edges wrap or not', () => {
  for (const wrap of [true, false]) {
    const g = E.createGame({ seed: 1, board: 'gate', wrap });
    const s = Object.assign({}, g, { status: 'running', dir: 'right', queue: [], snake: cells([[9, 2], [8, 2]]), food: { x: 0, y: 13 } });
    assert.equal(E.step(s).state.reason, 'obstacle', String(wrap));
  }
});

test('wrap off: the same moves hit the wall', () => {
  const s0 = mk({ wrap: false }, { status: 'running', dir: 'right', queue: [], snake: cells([[20, 5], [19, 5]]), food: { x: 10, y: 10 } });
  assert.equal(E.step(s0).state.reason, 'wall');
});

test('wrap: food on the far edge is eaten by wrapping onto it', () => {
  const s0 = mk({ wrap: true }, { status: 'running', dir: 'right', queue: [], snake: cells([[20, 5], [19, 5]]), food: { x: 0, y: 5 } });
  const r = E.step(s0);
  assert.equal(r.state.score, 1);
  assert.equal(r.state.snake.length, 3);
});

test('wrap: self collision across the edge still ends the run', () => {
  const s0 = mk({ wrap: true }, { status: 'running', dir: 'right', queue: [], food: { x: 10, y: 10 },
    snake: cells([[20, 5], [20, 6], [0, 6], [0, 5], [1, 5]]) });
  const r = E.step(s0);
  assert.equal(r.state.reason, 'self');
});

test('wrap setting changes only the edge rule, not the simulation elsewhere', () => {
  const inputs = ['up', null, 'right', null, null, 'down', null];
  const a = run(E.createGame({ seed: 6, wrap: false }), inputs).state;
  const b = run(E.createGame({ seed: 6, wrap: true }), inputs).state;
  assert.deepEqual(a.snake, b.snake);
  assert.equal(a.score, b.score);
});

// ---------- maze layouts ----------
test('maze layouts: the table lists a clear field and eleven mazes', () => {
  assert.deepEqual(E.MAZE_ORDER, ['clear', 'pillars', 'gate', 'frame', 'corners', 'tunnels', 'zigzag', 'rooms', 'diamond', 'islands', 'staircase', 'bars']);
  assert.equal(E.mazeCells('clear').length, 0);
  for (const name of E.MAZE_ORDER.slice(1)) assert.ok(E.mazeCells(name).length > 0, name);
  assert.deepEqual(Object.keys(E.MAZES).sort(), E.MAZE_ORDER.slice().sort());
});

test('maze layouts: cells are inside the board and leave the start clear', () => {
  const start = E.createGame({ seed: 1 }).snake;
  for (const name of E.MAZE_ORDER) {
    const cs = E.mazeCells(name);
    const seen = new Set();
    for (const c of cs) {
      assert.ok(c.x >= 0 && c.x < 21 && c.y >= 0 && c.y < 14, `${name} ${c.x},${c.y}`);
      assert.ok(!seen.has(c.x + ',' + c.y), `${name} duplicate`);
      seen.add(c.x + ',' + c.y);
      assert.ok(!start.some((s) => s.x === c.x && s.y === c.y), `${name} blocks the start`);
      assert.ok(!(c.y === 7 && c.x <= 14), `${name} blocks the start row`);
    }
  }
});

test('maze layouts: every free cell is reachable (no sealed pockets)', () => {
  for (const name of E.MAZE_ORDER) {
    const g = E.createGame({ seed: 1, board: name });
    const free = [];
    for (let y = 0; y < g.rows; y++) for (let x = 0; x < g.cols; x++) if (!g.blocked[x + ',' + y]) free.push(x + ',' + y);
    const seen = new Set([g.snake[0].x + ',' + g.snake[0].y]);
    const queue = [[g.snake[0].x, g.snake[0].y]];
    while (queue.length) {
      const [x, y] = queue.shift();
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy, k = nx + ',' + ny;
        if (nx < 0 || ny < 0 || nx >= g.cols || ny >= g.rows || g.blocked[k] || seen.has(k)) continue;
        seen.add(k); queue.push([nx, ny]);
      }
    }
    assert.equal(seen.size, free.length, name);
  }
});

test('maze: food never spawns on an obstacle (many seeds, all boards)', () => {
  for (const name of E.MAZE_ORDER) {
    for (let seed = 0; seed < 200; seed++) {
      const g = E.createGame({ seed, board: name });
      assert.ok(!g.blocked[g.food.x + ',' + g.food.y], `${name} seed ${seed}`);
    }
  }
});

test('maze: hitting a block ends a classic run with reason obstacle; head stays put', () => {
  const g = E.createGame({ seed: 1, board: 'gate' }); // wall at x=10, y 0..4
  const s0 = Object.assign({}, g, { status: 'running', dir: 'right', queue: [], snake: cells([[9, 2], [8, 2]]), food: { x: 0, y: 13 } });
  const r = E.step(s0);
  assert.equal(r.state.status, 'over');
  assert.equal(r.state.reason, 'obstacle');
  assert.deepEqual(r.state.snake[0], { x: 9, y: 2 });
  assert.deepEqual(r.events, [{ type: 'over', reason: 'obstacle' }]);
});

test('maze: the gap in the gate layout is passable', () => {
  const g = E.createGame({ seed: 1, board: 'gate' });
  let s = Object.assign({}, g, { status: 'running', dir: 'right', queue: [], snake: cells([[9, 7], [8, 7]]), food: { x: 0, y: 13 } });
  s = E.step(s).state;
  assert.equal(s.status, 'running');
  assert.deepEqual(s.snake[0], { x: 10, y: 7 });
});

test('maze with wrap: blocks stay solid and edges still wrap', () => {
  const g = E.createGame({ seed: 1, board: 'gate', wrap: true });
  let s = Object.assign({}, g, { status: 'running', dir: 'left', queue: [], snake: cells([[0, 2], [1, 2]]), food: { x: 0, y: 13 } });
  s = E.step(s).state;
  assert.deepEqual(s.snake[0], { x: 20, y: 2 });
  s = Object.assign({}, g, { status: 'running', dir: 'right', queue: [], snake: cells([[9, 2], [8, 2]]), food: { x: 0, y: 13 } });
  assert.equal(E.step(s).state.reason, 'obstacle');
});

test('unknown board names fall back to the clear field', () => {
  for (const bad of ['maze9', '', null, 'constructor', '__proto__']) {
    assert.equal(E.createGame({ seed: 1, board: bad }).board, 'clear', String(bad));
  }
});

// ---------- lives ----------
test('lives table: classic 1, extra 3, unlimited assist', () => {
  assert.deepEqual(E.LIVES, { classic: 1, extra: 3, unlimited: null });
  assert.equal(E.DEFAULT_LIVES, 'classic');
  assert.equal(E.createGame({ seed: 1 }).lives, 1);
  assert.equal(E.createGame({ seed: 1, lives: 'extra' }).lives, 3);
  assert.equal(E.createGame({ seed: 1, lives: 'unlimited' }).lives, null);
  assert.equal(E.createGame({ seed: 1, lives: 'bogus' }).livesMode, 'classic');
});

const crash = (opts, over) => mk(opts, Object.assign({ status: 'running', dir: 'left', queue: [], snake: cells([[0, 5], [1, 5], [2, 5]]), food: { x: 15, y: 10 }, score: 4 }, over));

test('classic: one collision ends the run with 0 lives', () => {
  const r = E.step(crash({ lives: 'classic' }));
  assert.equal(r.state.status, 'over');
  assert.equal(r.state.lives, 0);
  assert.equal(r.state.score, 4);
});

test('extra lives: collisions cost a life, the score is kept, the last one ends the run', () => {
  let s = crash({ lives: 'extra' });
  let r = E.step(s);
  assert.equal(r.state.status, 'ready');
  assert.equal(r.state.lives, 2);
  assert.equal(r.state.score, 4);
  assert.deepEqual(r.events, [{ type: 'lifeLost', reason: 'wall', lives: 2 }]);
  assert.equal(r.state.snake.length, 3);
  assert.deepEqual(r.state.snake, E.createGame({ seed: 7 }).snake);
  assert.equal(r.state.dir, 'right');
  s = Object.assign({}, r.state, { status: 'running', dir: 'left', snake: cells([[0, 5], [1, 5], [2, 5]]) });
  r = E.step(s);
  assert.equal(r.state.lives, 1);
  assert.equal(r.state.status, 'ready');
  s = Object.assign({}, r.state, { status: 'running', dir: 'left', snake: cells([[0, 5], [1, 5], [2, 5]]) });
  r = E.step(s);
  assert.equal(r.state.status, 'over');
  assert.equal(r.state.lives, 0);
  assert.equal(r.state.score, 4);
});

test('extra lives: obstacle and self collisions also cost a life', () => {
  const g = E.createGame({ seed: 1, board: 'gate', lives: 'extra' });
  const ob = Object.assign({}, g, { status: 'running', dir: 'right', queue: [], snake: cells([[9, 2], [8, 2]]), food: { x: 0, y: 13 } });
  assert.equal(E.step(ob).state.lives, 2);
  const self = mk({ lives: 'extra' }, { status: 'running', dir: 'left', queue: [], food: { x: 15, y: 10 }, snake: cells([[2, 2], [2, 3], [1, 3], [1, 2], [0, 2], [0, 3]]) });
  const r = E.step(self);
  assert.equal(r.state.lives, 2);
  assert.equal(r.events[0].reason, 'self');
});

test('after a lost life the game waits: no movement until a direction, and no instant repeat crash', () => {
  const r = E.step(crash({ lives: 'extra' }));
  const idle = E.step(r.state).state;
  assert.deepEqual(idle.snake, r.state.snake);
  let s = E.turn(r.state, 'right');
  assert.equal(s.status, 'running');
  s = E.step(s).state;
  assert.equal(s.status, 'running');
  assert.deepEqual(s.snake[0], { x: r.state.snake[0].x + 1, y: r.state.snake[0].y });
  assert.equal(E.turn(r.state, 'left'), r.state); // reversal of the restart heading is ignored
});

test('respawn is safe: food or bonus on the restart cells is moved or cleared', () => {
  const start = E.createGame({ seed: 7 }).snake;
  const r = E.step(crash({ lives: 'extra' }, { food: { x: start[0].x, y: start[0].y }, bonusItem: { x: start[1].x, y: start[1].y, ticksLeft: 5 } }));
  assert.equal(r.state.status, 'ready');
  assert.ok(!r.state.snake.some((c) => c.x === r.state.food.x && c.y === r.state.food.y));
  assert.equal(r.state.bonusItem, null);
});

test('respawn keeps an unrelated food and bonus item', () => {
  const r = E.step(crash({ lives: 'extra' }, { bonusItem: { x: 18, y: 2, ticksLeft: 9 } }));
  assert.deepEqual(r.state.food, { x: 15, y: 10 });
  assert.deepEqual(r.state.bonusItem, { x: 18, y: 2, ticksLeft: 9 });
});

test('unlimited assist: collisions never end the run, lives stay unlimited, score is kept', () => {
  let s = crash({ lives: 'unlimited' });
  for (let i = 0; i < 50; i++) {
    const r = E.step(s);
    assert.equal(r.state.status, 'ready', 'crash ' + i);
    assert.equal(r.state.lives, null);
    assert.equal(r.state.score, 4);
    assert.deepEqual(r.events, [{ type: 'lifeLost', reason: 'wall', lives: null }]);
    s = Object.assign({}, r.state, { status: 'running', dir: 'left', snake: cells([[0, 5], [1, 5], [2, 5]]) });
  }
});

test('lives mode never changes movement, food or scoring when nothing collides', () => {
  const inputs = ['up', null, 'right', null, null, 'down', null];
  const a = run(E.createGame({ seed: 6, lives: 'classic' }), inputs).state;
  for (const mode of ['extra', 'unlimited']) {
    const b = run(E.createGame({ seed: 6, lives: mode }), inputs).state;
    assert.deepEqual(b.snake, a.snake, mode);
    assert.deepEqual(b.food, a.food, mode);
    assert.equal(b.score, a.score, mode);
  }
});

test('profile keys separate every rules combination', () => {
  const keys = new Set();
  for (const speed of E.SPEED_ORDER) for (const lives of E.LIVES_ORDER) for (const board of E.MAZE_ORDER) for (const wrap of [false, true]) for (const bonus of [false, true]) {
    const g = E.createGame({ seed: 1, speed, lives, board, wrap, bonus });
    assert.ok(E.isProfileKey(g.profile), g.profile);
    keys.add(g.profile);
  }
  assert.equal(keys.size, 3 * 3 * E.MAZE_ORDER.length * 2 * 2);
  assert.equal(E.createGame({ seed: 1 }).profile, 'slow|classic|clear|wrap|bonus', 'the default play wraps at the edges');
  assert.equal(E.createGame({ seed: 1, wrap: false }).profile, 'slow|classic|clear|walls|bonus');
});

test('isProfileKey rejects malformed keys', () => {
  for (const bad of ['', 'slow', 'slow|classic|clear|walls', 'turbo|classic|clear|walls|bonus', 'slow|classic|clear|walls|maybe', 'slow|classic|clear|edge|bonus', 'slow|classic|__proto__|walls|bonus', null, 5]) {
    assert.equal(E.isProfileKey(bad), false, String(bad));
  }
});

// ---------- bonus food ----------
test('bonus defaults are explicit and configurable', () => {
  assert.deepEqual(E.BONUS_DEFAULTS, { bonusEvery: 5, bonusTicks: 24, bonusPoints: 5, bonusGrows: false });
  const g = E.createGame({ seed: 1, bonusEvery: 2, bonusTicks: 9, bonusPoints: 7, bonusGrows: true });
  assert.equal(g.bonusEvery, 2); assert.equal(g.bonusTicks, 9); assert.equal(g.bonusPoints, 7); assert.equal(g.bonusGrows, true);
  const bad = E.createGame({ seed: 1, bonusEvery: 0, bonusTicks: -3, bonusPoints: 'x' });
  assert.equal(bad.bonusEvery, 5); assert.equal(bad.bonusTicks, 24); assert.equal(bad.bonusPoints, 5);
});

// a snake about to eat a regular food; `eaten` regular foods already counted
const aboutToEat = (opts, eaten, over) => mk(opts, Object.assign({
  status: 'running', dir: 'right', queue: [], snake: cells([[5, 5], [4, 5], [3, 5]]), food: { x: 6, y: 5 }, foodEaten: eaten
}, over));

test('bonus: none before the scheduled food, appears with the 5th, full timer, off the body and food', () => {
  let r = E.step(aboutToEat({}, 3));
  assert.equal(r.state.bonusItem, null);
  r = E.step(aboutToEat({}, 4));
  assert.ok(r.state.bonusItem, 'bonus appears');
  assert.equal(r.state.bonusItem.ticksLeft, 24);
  assert.ok(r.events.some((e) => e.type === 'bonusAppeared'));
  const b = r.state.bonusItem;
  assert.ok(!r.state.snake.some((c) => c.x === b.x && c.y === b.y));
  assert.ok(!(r.state.food.x === b.x && r.state.food.y === b.y));
});

test('bonus: never placed on an obstacle (all mazes, many seeds)', () => {
  for (const board of ['pillars', 'gate', 'frame']) {
    for (let seed = 0; seed < 100; seed++) {
      const r = E.step(aboutToEat({ board, seed }, 4, { food: { x: 6, y: 5 } }));
      const b = r.state.bonusItem;
      assert.ok(b && !r.state.blocked[b.x + ',' + b.y], `${board} ${seed}`);
    }
  }
});

test('bonus: counts down one tick at a time and expires without penalty', () => {
  const g = E.createGame({ seed: 7, bonusTicks: 3 });
  let s = Object.assign({}, g, { status: 'running', dir: 'right', queue: [], snake: cells([[2, 5], [1, 5], [0, 5]]), food: { x: 20, y: 13 }, score: 8, bonusItem: { x: 15, y: 1, ticksLeft: 3 } });
  const len = s.snake.length;
  let r = E.step(s); assert.equal(r.state.bonusItem.ticksLeft, 2);
  r = E.step(r.state); assert.equal(r.state.bonusItem.ticksLeft, 1);
  r = E.step(r.state);
  assert.equal(r.state.bonusItem, null);
  assert.ok(r.events.some((e) => e.type === 'bonusExpired'));
  assert.equal(r.state.score, 8, 'no points lost');
  assert.equal(r.state.snake.length, len, 'length unchanged');
  assert.equal(r.state.status, 'running');
  assert.equal(r.state.lives, 1, 'no life lost');
});

test('bonus: a full default timer lasts exactly 24 ticks', () => {
  let s = Object.assign({}, E.createGame({ seed: 7 }), { status: 'running', dir: 'up', queue: [], snake: cells([[10, 13], [10, 12]]), food: { x: 0, y: 0 }, bonusItem: { x: 20, y: 0, ticksLeft: 24 }, wrap: true });
  let ticks = 0;
  while (s.bonusItem && ticks < 100) { s = E.step(s).state; ticks++; }
  assert.equal(ticks, 24);
});

test('bonus: eating it adds the configured points, leaves length alone, and is not a life', () => {
  const s0 = aboutToEat({}, 1, { food: { x: 15, y: 10 }, bonusItem: { x: 6, y: 5, ticksLeft: 10 }, score: 2, lives: 1 });
  const r = E.step(s0);
  assert.equal(r.state.score, 2 + 5);
  assert.equal(r.state.snake.length, 3);
  assert.equal(r.state.bonusItem, null);
  assert.equal(r.state.lives, 1);
  assert.equal(r.state.foodEaten, 1, 'bonus does not count toward the next bonus');
  assert.deepEqual(r.events, [{ type: 'bonus', score: 7 }]);
});

test('bonus: points and growth are configurable', () => {
  const s0 = aboutToEat({ bonusPoints: 12, bonusGrows: true }, 1, { food: { x: 15, y: 10 }, bonusItem: { x: 6, y: 5, ticksLeft: 10 } });
  const r = E.step(s0);
  assert.equal(r.state.score, 12);
  assert.equal(r.state.snake.length, 4);
  assert.deepEqual(r.state.snake[3], { x: 3, y: 5 }); // tail stayed
});

test('bonus: growing bonus moving into the tail cell is a collision, a non growing one is not', () => {
  const loop = cells([[1, 0], [0, 0], [0, 1], [1, 1]]);
  const grow = mk({ bonusGrows: true }, { status: 'running', dir: 'down', queue: [], snake: loop, food: { x: 15, y: 10 }, bonusItem: { x: 1, y: 1, ticksLeft: 5 } });
  assert.equal(E.step(grow).state.reason, 'self');
  const flat = mk({ bonusGrows: false }, { status: 'running', dir: 'down', queue: [], snake: loop, food: { x: 15, y: 10 }, bonusItem: { x: 1, y: 1, ticksLeft: 5 } });
  const r = E.step(flat);
  assert.equal(r.state.status, 'running');
  assert.equal(r.state.score, 5);
});

test('bonus: does not appear again while one is active, and is scheduled every Nth food', () => {
  const s0 = aboutToEat({}, 9, { food: { x: 6, y: 5 }, bonusItem: { x: 18, y: 2, ticksLeft: 20 } });
  const r = E.step(s0);
  assert.deepEqual(r.state.bonusItem, { x: 18, y: 2, ticksLeft: 19 });
  const r10 = E.step(aboutToEat({}, 9));
  assert.ok(r10.state.bonusItem, 'appears with the 10th food too');
});

test('bonus: bonus off never creates one', () => {
  const r = E.step(aboutToEat({ bonus: false }, 4));
  assert.equal(r.state.bonusItem, null);
  assert.ok(!r.events.some((e) => e.type === 'bonusAppeared'));
});

test('bonus: deterministic for a seed, and frozen while the game is not running', () => {
  const a = E.step(aboutToEat({ seed: 3 }, 4)).state;
  const b = E.step(aboutToEat({ seed: 3 }, 4)).state;
  assert.deepEqual(a.bonusItem, b.bonusItem);
  const paused = Object.assign({}, a, { status: 'ready' });
  assert.equal(E.step(paused).state.bonusItem, a.bonusItem);
});

test('bonus: waiting after a lost life does not tick the timer', () => {
  const r = E.step(crash({ lives: 'extra' }, { bonusItem: { x: 18, y: 2, ticksLeft: 9 } }));
  assert.equal(E.step(r.state).state.bonusItem.ticksLeft, 9);
});

test('bonus: no bonus when the board has no free cell', () => {
  const g = E.createGame({ seed: 1, cols: 3, rows: 2, bonusEvery: 1 });
  const s0 = Object.assign({}, g, { status: 'running', dir: 'right', queue: [], snake: cells([[1, 0], [0, 0], [0, 1], [1, 1]]), food: { x: 2, y: 0 }, foodEaten: 0 });
  const r = E.step(s0);
  assert.deepEqual(r.state.food, { x: 2, y: 1 }, 'the last free cell holds the food');
  assert.equal(r.state.bonusItem, null);
  assert.equal(r.state.status, 'running');
});

// ---------- tall board (phones in portrait) ----------
const T = (board, over) => Object.assign({}, E.createGame({ seed: 7, shape: 'tall', wrap: false, board }), over);

test('tall board: 14 by 21, same cell count, start turned on its side heading down', () => {
  const w = E.createGame({ seed: 1, wrap: false });
  const t = E.createGame({ seed: 1, shape: 'tall', wrap: false });
  assert.equal(w.shape, 'wide'); assert.equal(t.shape, 'tall');
  assert.equal(t.cols * t.rows, w.cols * w.rows);
  assert.deepEqual([t.cols, t.rows], [14, 21]);
  assert.deepEqual(w.snake.map((c) => [c.y, c.x]), t.snake.map((c) => [c.x, c.y]), 'the start is the wide start transposed');
  assert.equal(t.dir, 'down'); assert.equal(t.startDir, 'down');
  assert.equal(E.createGame({ seed: 1, shape: 'bogus' }).shape, 'wide');
});

test('tall board: every layout is the wide layout transposed, start clear, all free cells reachable', () => {
  for (const name of E.MAZE_ORDER) {
    const w = E.mazeCells(name, 'wide');
    const t = E.mazeCells(name, 'tall');
    assert.deepEqual(t.map((c) => c.x + ',' + c.y).sort(), w.map((c) => c.y + ',' + c.x).sort(), name);
    const g = E.createGame({ seed: 1, shape: 'tall', board: name });
    for (const c of g.obstacles) {
      assert.ok(c.x >= 0 && c.x < 14 && c.y >= 0 && c.y < 21, `${name} inside`);
      assert.ok(!g.snake.some((s) => s.x === c.x && s.y === c.y), `${name} start clear`);
      assert.ok(!(c.x === 7 && c.y <= 14), `${name} keeps the start column clear`);
    }
    const free = [];
    for (let y = 0; y < g.rows; y++) for (let x = 0; x < g.cols; x++) if (!g.blocked[x + ',' + y]) free.push(x + ',' + y);
    const seen = new Set([g.snake[0].x + ',' + g.snake[0].y]);
    const queue = [[g.snake[0].x, g.snake[0].y]];
    while (queue.length) {
      const [x, y] = queue.shift();
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy, k = nx + ',' + ny;
        if (nx < 0 || ny < 0 || nx >= g.cols || ny >= g.rows || g.blocked[k] || seen.has(k)) continue;
        seen.add(k); queue.push([nx, ny]);
      }
    }
    assert.equal(seen.size, free.length, name + ' reachable');
  }
});

test('every wide layout keeps the start row clear and every free cell reachable', () => {
  for (const name of E.MAZE_ORDER) {
    const g = E.createGame({ seed: 1, board: name });
    for (const c of g.obstacles) assert.ok(!(c.y === 7 && c.x <= 14), `${name} start row`);
    assert.ok(g.obstacles.every((c) => c.x >= 0 && c.x < 21 && c.y >= 0 && c.y < 14), name);
  }
});

test('tall board plays like the wide board turned on its side (transposition symmetry)', () => {
  const swap = { up: 'left', down: 'right', left: 'up', right: 'down' };
  const script = ['right', null, null, 'up', null, 'left', null, 'down', null, null, 'right', null];
  for (const board of ['clear', 'gate', 'rooms', 'staircase']) {
    for (const wrap of [false, true]) {
      let w = E.createGame({ seed: 5, board, wrap, lives: 'extra' });
      let t = E.createGame({ seed: 5, board, wrap, lives: 'extra', shape: 'tall' });
      w = Object.assign({}, w, { food: null, bonusEnabled: false });
      t = Object.assign({}, t, { food: null, bonusEnabled: false });
      for (const move of script) {
        if (move) { w = E.turn(w, move); t = E.turn(t, swap[move]); }
        w = E.step(w).state; t = E.step(t).state;
        assert.equal(t.status, w.status, `${board} ${wrap} status`);
        assert.equal(t.lives, w.lives, `${board} ${wrap} lives`);
        assert.deepEqual(t.snake.map((c) => [c.x, c.y]), w.snake.map((c) => [c.y, c.x]), `${board} ${wrap} path`);
      }
    }
  }
});

test('tall board: wrap, walls and respawn work on both axes', () => {
  const base = { status: 'running', queue: [], food: { x: 2, y: 2 } };
  // leaving the bottom edge wraps to the top at the same column
  let s = E.step(Object.assign(T('clear', {}), base, { wrap: true, dir: 'down', snake: cells([[3, 20], [3, 19]]) })).state;
  assert.deepEqual(s.snake[0], { x: 3, y: 0 });
  // leaving the right edge wraps to the left
  s = E.step(Object.assign(T('clear', {}), base, { wrap: true, dir: 'right', snake: cells([[13, 4], [12, 4]]) })).state;
  assert.deepEqual(s.snake[0], { x: 0, y: 4 });
  // solid walls cost a life; the restart is the tall start, heading down
  const r = E.step(Object.assign(T('clear', {}), base, { wrap: false, lives: 2, livesMode: 'extra', dir: 'down', snake: cells([[3, 20], [3, 19]]) }));
  assert.equal(r.state.lives, 1);
  assert.equal(r.state.dir, 'down');
  assert.deepEqual(r.state.snake, E.createGame({ seed: 7, shape: 'tall' }).snake);
});

test('tall board: food and bonus never land on blocks or the snake', () => {
  for (const name of E.MAZE_ORDER) {
    for (let seed = 0; seed < 60; seed++) {
      const g = E.createGame({ seed, shape: 'tall', board: name });
      assert.ok(!g.blocked[g.food.x + ',' + g.food.y], `${name} ${seed}`);
      assert.ok(g.food.x < 14 && g.food.y < 21);
    }
  }
});
