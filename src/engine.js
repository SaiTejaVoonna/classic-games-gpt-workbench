// Deterministic Snake simulation. No DOM, storage, sound or wall clock.
// All rules and constants here are PROVISIONAL CLASSIC GAMES PROTOTYPE CHOICES. None is
// verified against any original handset; see docs/PLAYABLE_PROTOTYPE.md and
// docs/NOKIA_REFERENCE.md for what is and is not known.
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SnakeEngine = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Prototype speed settings (ms per tick). Comfort choices, not original levels.
  var SPEEDS = { slow: 300, medium: 220, fast: 150 };
  var SPEED_ORDER = ['slow', 'medium', 'fast'];
  var DEFAULT_SPEED = 'slow';

  // Lives modes. 'classic' is one life. 'extra' is a small fixed number of lives.
  // 'unlimited' is an assist mode: collisions never end the run (lives are null).
  var LIVES = { classic: 1, extra: 3, unlimited: null };
  var LIVES_ORDER = ['classic', 'extra', 'unlimited'];
  var DEFAULT_LIVES = 'classic';

  var EDGES_ORDER = ['walls', 'wrap'];
  var DEFAULT_EDGES = 'wrap'; // Classic Games prototype choice: the default play does not end at a screen edge

  var DEFAULTS = {
    cols: 21,          // provisional board size
    rows: 14,
    startLength: 3,
    maxQueuedTurns: 2,
    maxCatchUpSteps: 2 // bound on steps per rendered frame
  };

  // Bonus food (prototype choices, all configurable through createGame options):
  // every `bonusEvery` regular foods a bonus appears for `bonusTicks` ticks. It is worth
  // `bonusPoints` points and grows the snake only when `bonusGrows` is true. Missing it
  // has no penalty. It is not a life, shield or invincibility.
  var BONUS_DEFAULTS = { bonusEvery: 5, bonusTicks: 24, bonusPoints: 5, bonusGrows: false };

  // Maze layouts as solid rectangles [x, y, width, height] on the 21 by 14 board. They are
  // Classic Games prototype layouts, not maps from any original game. The snake start cells
  // (x 5 to 7, y 7) and the whole row y 7 up to x 14 are kept clear.
  var MAZES = {
    clear: [],
    pillars: [[4, 2, 2, 2], [15, 2, 2, 2], [4, 10, 2, 2], [15, 10, 2, 2]],
    gate: [[10, 0, 1, 5], [10, 9, 1, 5]],
    frame: [[6, 3, 9, 1], [6, 10, 9, 1]],
    // More Classic Games prototype layouts (same rules: solid blocks, start row clear).
    corners: [[1, 1, 4, 1], [1, 2, 1, 2], [16, 1, 4, 1], [19, 2, 1, 2], [1, 12, 4, 1], [1, 10, 1, 2], [16, 12, 4, 1], [19, 10, 1, 2]],
    tunnels: [[2, 4, 7, 1], [12, 4, 7, 1], [2, 10, 7, 1], [12, 10, 7, 1]],
    zigzag: [[6, 0, 1, 5], [10, 9, 1, 5], [14, 0, 1, 5], [18, 9, 1, 5]],
    rooms: [[3, 3, 7, 1], [11, 3, 7, 1], [3, 10, 7, 1], [11, 10, 7, 1], [3, 4, 1, 2], [17, 4, 1, 2], [3, 8, 1, 2], [17, 8, 1, 2]],
    diamond: [[10, 2, 1, 1], [9, 3, 1, 1], [11, 3, 1, 1], [8, 4, 1, 1], [12, 4, 1, 1], [10, 12, 1, 1], [9, 11, 1, 1], [11, 11, 1, 1], [8, 10, 1, 1], [12, 10, 1, 1]],
    islands: [[4, 3, 2, 1], [9, 2, 2, 1], [15, 3, 2, 1], [3, 10, 2, 1], [8, 11, 2, 1], [14, 10, 2, 1], [17, 6, 1, 2], [12, 5, 1, 2]],
    staircase: [[2, 1, 1, 1], [3, 2, 1, 1], [4, 3, 1, 1], [5, 4, 1, 1], [6, 5, 1, 1], [14, 8, 1, 1], [15, 9, 1, 1], [16, 10, 1, 1], [17, 11, 1, 1], [18, 12, 1, 1]],
    bars: [[5, 0, 1, 4], [5, 10, 1, 4], [15, 0, 1, 4], [15, 10, 1, 4]]
  };
  var MAZE_ORDER = ['clear', 'pillars', 'gate', 'frame', 'corners', 'tunnels', 'zigzag', 'rooms', 'diamond', 'islands', 'staircase', 'bars'];

  // Board shape. 'wide' is 21 by 14. 'tall' is the same board turned on its side (14 by 21):
  // every layout, the start cells and the start heading are transposed, so both shapes play
  // the same (294 cells, same rules) and best scores are comparable.
  var SHAPES = ['wide', 'tall'];
  var DEFAULT_BOARD = 'clear';

  var DELTA = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 }
  };
  var OPPOSITE = { up: 'down', down: 'up', left: 'right', right: 'left' };

  function hasOwn(obj, k) { return Object.prototype.hasOwnProperty.call(obj, k); }
  function key(x, y) { return x + ',' + y; }

  // mulberry32 as a pure step: returns [value in [0,1), nextState]
  function nextRandom(s) {
    s = (s + 0x6D2B79F5) | 0;
    var t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return [((t ^ (t >>> 14)) >>> 0) / 4294967296, s];
  }

  function mazeCells(board, shape) {
    var out = [];
    (MAZES[board] || []).forEach(function (r) {
      for (var dx = 0; dx < r[2]; dx++) {
        for (var dy = 0; dy < r[3]; dy++) {
          out.push(shape === 'tall' ? { x: r[1] + dy, y: r[0] + dx } : { x: r[0] + dx, y: r[1] + dy });
        }
      }
    });
    return out;
  }

  // Uniform choice among free cells (not on the snake and not in `avoid`).
  // Returns [cell|null, rngState].
  function placeFood(snake, cols, rows, rngState, avoid) {
    var occupied = {};
    var i;
    for (i = 0; i < snake.length; i++) occupied[key(snake[i].x, snake[i].y)] = true;
    if (avoid) for (i = 0; i < avoid.length; i++) if (avoid[i]) occupied[key(avoid[i].x, avoid[i].y)] = true;
    var free = [];
    for (var y = 0; y < rows; y++) {
      for (var x = 0; x < cols; x++) {
        if (!occupied[key(x, y)]) free.push({ x: x, y: y });
      }
    }
    if (free.length === 0) return [null, rngState];
    var r = nextRandom(rngState);
    return [free[Math.floor(r[0] * free.length)], r[1]];
  }

  function profileKey(p) {
    return [p.speed, p.lives, p.board, p.wrap ? 'wrap' : 'walls', p.bonus ? 'bonus' : 'nobonus'].join('|');
  }

  // True for a well formed score profile key such as "slow|classic|clear|walls|bonus".
  function isProfileKey(k) {
    if (typeof k !== 'string') return false;
    var p = k.split('|');
    return p.length === 5 && hasOwn(SPEEDS, p[0]) && hasOwn(LIVES, p[1]) && hasOwn(MAZES, p[2]) &&
      (p[3] === 'walls' || p[3] === 'wrap') && (p[4] === 'bonus' || p[4] === 'nobonus');
  }

  function posInt(v, fallback) {
    return typeof v === 'number' && isFinite(v) && v >= 1 && Math.floor(v) === v ? v : fallback;
  }

  function startSnake(cols, rows, length, shape) {
    var snake = [];
    var i;
    if (shape === 'tall') { // the wide start turned on its side, heading down
      var x = Math.floor(cols / 2);
      var headY = Math.min(rows - 1, length + 4);
      for (i = 0; i < length; i++) snake.push({ x: x, y: headY - i });
      return snake;
    }
    var headX = Math.min(cols - 1, length + 4); // fixed start cell
    var y = Math.floor(rows / 2);
    for (i = 0; i < length; i++) snake.push({ x: headX - i, y: y });
    return snake;
  }

  // status: 'ready' (not started, or waiting after a lost life), 'running', 'over', 'won'
  function createGame(options) {
    var opt = options || {};
    var shape = opt.shape === 'tall' ? 'tall' : 'wide';
    var cols = opt.cols || (shape === 'tall' ? DEFAULTS.rows : DEFAULTS.cols);
    var rows = opt.rows || (shape === 'tall' ? DEFAULTS.cols : DEFAULTS.rows);
    var startLength = opt.startLength || DEFAULTS.startLength;
    var seed = opt.seed !== undefined ? opt.seed | 0 : 1;
    var speed = hasOwn(SPEEDS, opt.speed) ? opt.speed : DEFAULT_SPEED;
    var livesMode = hasOwn(LIVES, opt.lives) ? opt.lives : DEFAULT_LIVES;
    var board = hasOwn(MAZES, opt.board) ? opt.board : DEFAULT_BOARD;
    var wrap = opt.wrap !== false; // wrap is the default; pass wrap:false for solid walls
    var bonus = opt.bonus !== false;
    var obstacles = mazeCells(board, shape);
    var blocked = {};
    obstacles.forEach(function (c) { blocked[key(c.x, c.y)] = true; });
    var snake = startSnake(cols, rows, startLength, shape);
    var f = placeFood(snake, cols, rows, seed, obstacles);
    return {
      cols: cols, rows: rows,
      maxQueuedTurns: opt.maxQueuedTurns || DEFAULTS.maxQueuedTurns,
      speed: speed, tickMs: SPEEDS[speed], // fixed for the life of the run
      livesMode: livesMode, lives: LIVES[livesMode], // null means unlimited
      board: board, obstacles: obstacles, blocked: blocked,
      wrap: wrap,
      bonusEnabled: bonus,
      bonusEvery: posInt(opt.bonusEvery, BONUS_DEFAULTS.bonusEvery),
      bonusTicks: posInt(opt.bonusTicks, BONUS_DEFAULTS.bonusTicks),
      bonusPoints: posInt(opt.bonusPoints, BONUS_DEFAULTS.bonusPoints),
      bonusGrows: opt.bonusGrows === true,
      profile: profileKey({ speed: speed, lives: livesMode, board: board, wrap: wrap, bonus: bonus }),
      startLength: startLength,
      shape: shape, startDir: shape === 'tall' ? 'down' : 'right',
      snake: snake, dir: shape === 'tall' ? 'down' : 'right', queue: [],
      food: f[0], rng: f[1],
      bonusItem: null, foodEaten: 0,
      score: 0, ticks: 0, status: 'ready', reason: null
    };
  }

  function copy(state, changes) {
    var out = {};
    for (var k in state) out[k] = state[k];
    for (var c in changes) out[c] = changes[c];
    return out;
  }

  // Queue a direction. A reversal of the most recent (queued or current) direction and a
  // repeat of it are ignored; at most maxQueuedTurns are kept. The first accepted input in
  // 'ready' starts the run (also after a lost life).
  function turn(state, dir) {
    if (!DELTA[dir]) return state;
    if (state.status === 'ready') {
      if (dir === OPPOSITE[state.dir]) return state;
      return copy(state, { status: 'running', queue: dir === state.dir ? [] : [dir] });
    }
    if (state.status !== 'running') return state;
    var last = state.queue.length ? state.queue[state.queue.length - 1] : state.dir;
    if (dir === last || dir === OPPOSITE[last]) return state;
    if (state.queue.length >= state.maxQueuedTurns) return state;
    return copy(state, { queue: state.queue.concat(dir) });
  }

  // A collision either ends the run or costs a life. After a lost life (or in unlimited
  // assist mode) the snake restarts at the start cells with the start length, the score is
  // kept, and the game waits in 'ready' for the next direction.
  function collide(state, reason, dir, queue) {
    var canContinue = state.lives === null || state.lives > 1;
    if (!canContinue) {
      return { state: copy(state, { status: 'over', reason: reason, dir: dir, queue: queue, lives: 0 }),
               events: [{ type: 'over', reason: reason }] };
    }
    var snake = startSnake(state.cols, state.rows, state.startLength, state.shape);
    var lives = state.lives === null ? null : state.lives - 1;
    var food = state.food;
    var rng = state.rng;
    var onSnake = function (c) { return c && snake.some(function (s) { return s.x === c.x && s.y === c.y; }); };
    if (onSnake(food)) {
      var f = placeFood(snake, state.cols, state.rows, rng, state.obstacles.concat(state.bonusItem ? [state.bonusItem] : []));
      food = f[0];
      rng = f[1];
    }
    var bonusItem = onSnake(state.bonusItem) ? null : state.bonusItem;
    return {
      state: copy(state, { status: 'ready', reason: reason, snake: snake, dir: state.startDir, queue: [],
                           lives: lives, food: food, rng: rng, bonusItem: bonusItem }),
      events: [{ type: 'lifeLost', reason: reason, lives: lives }]
    };
  }

  // Advance exactly one logical tick. Returns { state, events }.
  function step(state) {
    if (state.status !== 'running') return { state: state, events: [] };
    var dir = state.queue.length ? state.queue[0] : state.dir;
    var queue = state.queue.slice(1);
    var d = DELTA[dir];
    var head = state.snake[0];
    var nx = head.x + d.x;
    var ny = head.y + d.y;

    if (state.wrap) { // edge wrap is an explicit board rule
      nx = (nx + state.cols) % state.cols;
      ny = (ny + state.rows) % state.rows;
    } else if (nx < 0 || ny < 0 || nx >= state.cols || ny >= state.rows) {
      return collide(state, 'wall', dir, queue);
    }
    if (state.blocked[key(nx, ny)]) return collide(state, 'obstacle', dir, queue);

    var eatingFood = !!state.food && nx === state.food.x && ny === state.food.y;
    var bonusItem = state.bonusItem;
    var eatingBonus = !!bonusItem && nx === bonusItem.x && ny === bonusItem.y;
    var growing = eatingFood || (eatingBonus && state.bonusGrows);
    // The cell being vacated by the tail this tick is free unless the snake is growing.
    var limit = growing ? state.snake.length : state.snake.length - 1;
    for (var i = 0; i < limit; i++) {
      if (state.snake[i].x === nx && state.snake[i].y === ny) return collide(state, 'self', dir, queue);
    }

    var snake = [{ x: nx, y: ny }].concat(growing ? state.snake : state.snake.slice(0, -1));
    var changes = { snake: snake, dir: dir, queue: queue, ticks: state.ticks + 1 };
    var events = [];
    var score = state.score;
    var rng = state.rng;
    var food = state.food;
    var foodEaten = state.foodEaten;

    if (eatingBonus) {
      score += state.bonusPoints;
      bonusItem = null;
      events.push({ type: 'bonus', score: score });
    } else if (bonusItem) {
      var left = bonusItem.ticksLeft - 1;
      if (left <= 0) { // missing the bonus has no penalty
        bonusItem = null;
        events.push({ type: 'bonusExpired' });
      } else {
        bonusItem = { x: bonusItem.x, y: bonusItem.y, ticksLeft: left };
      }
    }

    if (eatingFood) {
      score += 1;
      foodEaten += 1;
      events.push({ type: 'ate', score: score });
      var f = placeFood(snake, state.cols, state.rows, rng, state.obstacles.concat(bonusItem ? [bonusItem] : []));
      food = f[0];
      rng = f[1];
      if (!food) {
        changes.status = 'won';
        events.push({ type: 'won' });
      } else if (state.bonusEnabled && !bonusItem && foodEaten % state.bonusEvery === 0) {
        var b = placeFood(snake, state.cols, state.rows, rng, state.obstacles.concat([food]));
        rng = b[1];
        if (b[0]) {
          bonusItem = { x: b[0].x, y: b[0].y, ticksLeft: state.bonusTicks };
          events.push({ type: 'bonusAppeared' });
        }
      }
    }

    changes.score = score;
    changes.rng = rng;
    changes.food = food;
    changes.foodEaten = foodEaten;
    changes.bonusItem = bonusItem;
    return { state: copy(state, changes), events: events };
  }

  // Frame-clock helper: converts elapsed time to a bounded number of ticks. Large gaps
  // (hidden tab, stalls) are clamped instead of replayed, so there is no catch-up burst.
  function advanceClock(acc, dtMs, tickMs, maxSteps) {
    var dt = Math.min(Math.max(dtMs, 0), tickMs * maxSteps);
    var total = acc + dt;
    var steps = Math.min(Math.floor(total / tickMs), maxSteps);
    var rest = total - steps * tickMs;
    return { steps: steps, acc: rest >= tickMs ? 0 : rest };
  }

  return {
    SPEEDS: SPEEDS,
    SPEED_ORDER: SPEED_ORDER,
    DEFAULT_SPEED: DEFAULT_SPEED,
    LIVES: LIVES,
    LIVES_ORDER: LIVES_ORDER,
    DEFAULT_LIVES: DEFAULT_LIVES,
    EDGES_ORDER: EDGES_ORDER,
    DEFAULT_EDGES: DEFAULT_EDGES,
    MAZES: MAZES,
    MAZE_ORDER: MAZE_ORDER,
    SHAPES: SHAPES,
    DEFAULT_BOARD: DEFAULT_BOARD,
    BONUS_DEFAULTS: BONUS_DEFAULTS,
    DEFAULTS: DEFAULTS,
    createGame: createGame,
    turn: turn,
    step: step,
    placeFood: placeFood,
    mazeCells: mazeCells,
    profileKey: profileKey,
    isProfileKey: isProfileKey,
    advanceClock: advanceClock
  };
});
