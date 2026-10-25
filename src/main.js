// Early playable prototype. Wiring and lifecycle only; game rules live in engine.js and
// drawing lives in render.js. All rules are Classic Games prototype choices (see
// docs/PLAYABLE_PROTOTYPE.md).
(function () {
  'use strict';

  var E = window.SnakeEngine;
  var S = window.SnakeStorage;
  var R = window.SnakeRender;
  var FX = window.SnakeFx;
  var SFX = window.SnakeSfx;

  var THEME_KEY = 'classic-games.theme';
  var THEMES = ['colour', 'lcd', 'night'];

  var $ = function (id) { return document.getElementById(id); };
  var root = document.documentElement;
  var canvas = $('canvas');
  var ctx = canvas.getContext('2d');
  var params = new URLSearchParams(window.location.search);

  function safeStorage() {
    try { return window.localStorage; } catch { return null; }
  }
  var storage = safeStorage();

  // ---------- Theme ----------
  function readTheme() {
    try {
      var t = storage && storage.getItem(THEME_KEY);
      return THEMES.indexOf(t) >= 0 ? t : 'colour';
    } catch { return 'colour'; }
  }
  function saveTheme(t) {
    try { if (storage) storage.setItem(THEME_KEY, t); } catch { /* storage unavailable: fine */ }
  }
  function applyTheme(t) {
    root.setAttribute('data-theme', t);
    var radio = document.querySelector('input[name="theme"][value="' + t + '"]');
    if (radio) radio.checked = true;
    draw();
    drawThumbs();
  }

  // Small previews of each board in Game settings.
  function drawThumbs() {
    var p = basePalette();
    Array.prototype.forEach.call(document.querySelectorAll('.tile'), function (tile) {
      var c = tile.querySelector('canvas.thumb');
      var name = tile.querySelector('input').value;
      var g = c.getContext('2d');
      var cell = Math.floor(Math.min(c.width / 21, c.height / 14));
      var ox = Math.floor((c.width - cell * 21) / 2);
      var oy = Math.floor((c.height - cell * 14) / 2);
      g.clearRect(0, 0, c.width, c.height);
      g.fillStyle = cssVar('--board');
      g.fillRect(ox, oy, cell * 21, cell * 14);
      g.fillStyle = p.obstacle;
      E.mazeCells(name, 'wide').forEach(function (m) { g.fillRect(ox + m.x * cell, oy + m.y * cell, cell, cell); });
    });
  }

  // ---------- Game state ----------
  // mode: menu | ready | running | paused | over | won
  var mode = 'menu';
  var game;
  var SPEED_LABELS = { slow: 'Slow', medium: 'Medium', fast: 'Fast' };
  var BOARD_LABELS = { clear: 'Clear field' };
  E.MAZE_ORDER.forEach(function (b) {
    if (b !== 'clear') BOARD_LABELS[b] = b.charAt(0).toUpperCase() + b.slice(1) + ' maze';
  });
  var LIVES_LABELS = { classic: 'Classic', extra: 'Extra lives', unlimited: 'Unlimited' };
  var EDGES_LABELS = { walls: 'Solid walls', wrap: 'Wrap around' };
  var RULE_SCHEMA = {
    board: E.MAZE_ORDER,
    edges: E.EDGES_ORDER,
    lives: E.LIVES_ORDER,
    bonus: ['on', 'off']
  };
  var RULE_DEFAULTS = { board: E.DEFAULT_BOARD, edges: E.DEFAULT_EDGES, lives: E.DEFAULT_LIVES, bonus: 'on' };

  // Best scores are kept per rules profile. Older data (one value per speed, recorded with
  // classic lives, a clear field, solid walls and no bonus) migrates to that profile.
  var best = S.createBestStore(storage, {
    isKey: E.isProfileKey,
    legacyKey: function (speed) {
      return E.isProfileKey(speed + '|classic|clear|walls|nobonus') ? speed + '|classic|clear|walls|nobonus' : '';
    }
  });
  best.load();
  var speedPref = S.createSpeedPref(storage, E.SPEED_ORDER, E.DEFAULT_SPEED);
  speedPref.load();
  var rulesPref = S.createRulesPref(storage, RULE_SCHEMA, RULE_DEFAULTS);
  rulesPref.load();
  var K = window.SnakeSkins;
  var skinPref = S.createChoicePref(storage, S.SKIN_KEY, { colour: K.COLOURS, style: K.STYLES },
    { colour: K.DEFAULT_COLOUR, style: K.DEFAULT_STYLE });
  skinPref.load();
  var reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  // Effects follow the phone's Reduce motion setting until the player chooses.
  var uiPref = S.createChoicePref(storage, S.UI_KEY, { dpad: ['on', 'off'], fx: ['on', 'off'] },
    { dpad: 'off', fx: reduceMotion ? 'off' : 'on' });
  uiPref.load();
  // App-wide choices (shared by every game): sound and vibration.
  var appPref = S.createChoicePref(storage, S.APP_KEY, { sound: ['on', 'off'], haptics: ['on', 'off'] },
    { sound: 'on', haptics: 'on' });
  appPref.load();
  var sfx = SFX.create({
    AudioContext: window.AudioContext || window.webkitAudioContext,
    vibrate: window.navigator.vibrate ? window.navigator.vibrate.bind(window.navigator) : null
  });
  function applyApp() {
    sfx.setSound(appPref.get().sound === 'on');
    sfx.setHaptics(appPref.get().haptics === 'on');
  }
  applyApp();
  // Audio can only start after a tap or key press.
  ['pointerdown', 'keydown', 'touchend'].forEach(function (ev) {
    document.addEventListener(ev, function () { sfx.unlock(); }, { passive: true });
  });
  var readyNote = ''; // set after a lost life
  var rafId = 0;
  var lastTime = null;
  var acc = 0;
  var MAX_STEPS = E.DEFAULTS.maxCatchUpSteps;

  // The board is tall on narrow portrait screens (the same 294 cells, so scores stay
  // comparable) and wide elsewhere. It only changes between runs.
  var tallQuery = window.matchMedia ? window.matchMedia('(max-width: 640px) and (orientation: portrait)') : null;
  function wantedShape() {
    var q = params.get('shape');
    if (q === 'tall' || q === 'wide') return q;
    return tallQuery && tallQuery.matches ? 'tall' : 'wide';
  }
  var currentShape = wantedShape();

  // Options for a new run from the saved speed and rules choices.
  function gameOptions() {
    var r = rulesPref.get();
    var o = { shape: currentShape, speed: speedPref.get(), board: r.board, wrap: r.edges === 'wrap', lives: r.lives, bonus: r.bonus === 'on' };
    if (params.get('debug') === '1') { // test hooks: bonus tuning for browser checks
      ['bonusEvery', 'bonusTicks', 'bonusPoints'].forEach(function (k) {
        var v = parseInt(params.get(k), 10);
        if (isFinite(v)) o[k] = v;
      });
      if (params.get('bonusGrows') === '1') o.bonusGrows = true;
    }
    return o;
  }
  function newGame() {
    var o = gameOptions();
    o.seed = newSeed();
    return E.createGame(o);
  }

  function newSeed() {
    var q = parseInt(params.get('seed'), 10);
    if (isFinite(q)) return q; // test hook for deterministic runs
    return ((Date.now() ^ Math.floor(Math.random() * 4294967296)) >>> 0);
  }

  // ---------- Drawing ----------
  function cssVar(name) { return getComputedStyle(root).getPropertyValue(name).trim(); }

  function palette() {
    var p = basePalette();
    var skin = K.resolve(root.getAttribute('data-theme'), skinPref.get().colour);
    if (skin) { p.snake = skin.snake; p.snakeHead = skin.snakeHead; p.snakeEdge = skin.snakeEdge; }
    p.style = skinPref.get().style;
    return p;
  }

  function basePalette() {
    return {
      boardLine: cssVar('--board-line'), snake: cssVar('--snake'), snakeHead: cssVar('--snake-head'),
      snakeEdge: cssVar('--snake-edge'), shine: cssVar('--shine'), eye: cssVar('--eye'),
      pupil: cssVar('--pupil'), food: cssVar('--food'), bonus: cssVar('--bonus'),
      obstacle: cssVar('--obstacle'), obstacleEdge: cssVar('--obstacle-edge')
    };
  }

  function resizeCanvas() {
    var rect = canvas.getBoundingClientRect();
    var dpr = window.devicePixelRatio || 1;
    var w = Math.max(1, Math.round(rect.width * dpr));
    var h = Math.max(1, Math.round(rect.height * dpr));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    draw();
  }

  var fx = FX.create();
  function fxOn() { return uiPref.get().fx === 'on'; }
  var lastFood = '';
  var prevGame = null; // the state one step ago, for the glide between cells
  var GLIDE_SHARE = 1; // the snake keeps moving through the whole step: no stop and go

  function draw() {
    if (!game) return;
    var w = canvas.width;
    var h = canvas.height;
    var pal = palette();
    if (!fxOn()) { R.draw(ctx, game, pal, w, h); return; }
    var fk = game.food ? game.food.x + ',' + game.food.y : '';
    if (fk !== lastFood) { lastFood = fk; if (fk) fx.trigger('spawn', {}); }
    var live = mode === 'running' || mode === 'ready' || mode === 'menu';
    var anim = {
      foodBob: fx.foodBob(), foodScale: fx.foodScale(), headPulse: fx.headPulse(),
      blink: live && fx.blink(), tongue: live ? fx.tongue() : 0,
      bulge: fx.bulgeIndex(game.tickMs, game.snake.length)
    };
    if (pal.style !== 'pixel' && pal.snake) {
      anim.crawl = true; // a smooth crawling body with a gentle wave
      anim.t = fx.state.t;
      anim.waveAmp = mode === 'running' ? 0.075 : mode === 'ready' || mode === 'menu' ? 0.03 : 0;
    }
    if (prevGame && (mode === 'running' || mode === 'paused')) {
      anim.glide = { prev: prevGame, alpha: acc / (game.tickMs * GLIDE_SHARE) };
    }
    var l = R.layout(game.cols, game.rows, w, h);
    var sh = fx.shakeOffset();
    ctx.clearRect(0, 0, w, h);
    ctx.save();
    ctx.translate(sh.x * l.cell, sh.y * l.cell);
    R.draw(ctx, game, pal, w, h, anim);
    drawEffects(l, pal);
    ctx.restore();
    var fa = fx.flashAlpha();
    if (fa > 0) { ctx.save(); ctx.globalAlpha = fa; ctx.fillStyle = pal.food; ctx.fillRect(0, 0, w, h); ctx.restore(); }
  }

  function drawEffects(l, pal) {
    var st = fx.state;
    var colors = { food: pal.food, bonus: pal.bonus, snake: pal.snakeHead };
    st.particles.forEach(function (p) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - p.age / FX.PARTICLE_MS);
      ctx.fillStyle = colors[p.color] || pal.food;
      ctx.beginPath();
      ctx.arc(l.ox + (p.x + 0.5) * l.cell, l.oy + (p.y + 0.5) * l.cell, p.r * l.cell, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
    st.floaters.forEach(function (f) {
      var k = f.age / FX.FLOAT_MS;
      ctx.save();
      ctx.globalAlpha = k < 0.6 ? 1 : Math.max(0, 1 - (k - 0.6) / 0.4);
      ctx.font = '800 ' + Math.round(l.cell * 0.85) + 'px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.lineWidth = Math.max(2, l.cell * 0.12);
      ctx.strokeStyle = pal.snakeEdge;
      ctx.fillStyle = f.kind === 'bonus' ? pal.bonus : '#ffffff';
      var fx0 = l.ox + (f.x + 0.5) * l.cell;
      var fy0 = l.oy + (f.y + 0.5) * l.cell - k * l.cell * 1.6 - l.cell * 0.6;
      ctx.strokeText(f.text, fx0, fy0);
      ctx.fillText(f.text, fx0, fy0);
      ctx.restore();
    });
  }

  // One animation clock drives idle motion (blink, tongue, fruit bob) and one-off effects.
  var animRaf = 0;
  var animLast = null;
  function animFrame(t) {
    animRaf = 0;
    if (!fxOn() || document.hidden) return;
    fx.update(animLast === null ? 0 : Math.min(50, t - animLast));
    animLast = t;
    draw();
    animRaf = window.requestAnimationFrame(animFrame);
  }
  function startAnim() {
    if (animRaf || !fxOn()) return;
    animLast = null;
    animRaf = window.requestAnimationFrame(animFrame);
  }

  // ---------- UI ----------
  var btnNew = $('btn-new');
  var btnPause = $('btn-pause');
  var btnContinue = $('btn-continue');
  var dpadButtons = document.querySelectorAll('.dpad-btn');
  var overlay = $('overlay');

  var LABELS = { menu: 'Menu', ready: 'Ready', running: 'Running', paused: 'Paused', over: 'Game over', won: 'Board full' };

  function statusText() {
    switch (mode) {
      case 'menu': return 'Press Play or New game to start.';
      case 'ready': return readyNote || 'Ready. Swipe, or press an arrow key, WASD or a direction button to start.';
      case 'running': return 'Playing.';
      case 'paused': return 'Paused. Press Continue, or Space or P on the board, to resume.';
      case 'over': return 'Game over. Score ' + game.score + '.';
      default: return 'Board full. Score ' + game.score + '.';
    }
  }

  function overlayText() {
    switch (mode) {
      case 'menu': return 'Snake';
      case 'ready': return readyNote ? 'Swipe or press a direction to continue' : 'Swipe or press a direction to start';
      case 'paused': return 'Paused';
      case 'over': return 'Game over. Score ' + game.score + '.';
      case 'won': return 'Board full. Score ' + game.score + '.';
      default: return '';
    }
  }

  // Big buttons on the board: Play at the start, Continue and New game when paused,
  // Play again at the end. The ready state needs none (steer to start).
  var OV = {
    menu: [['Play', startNewGame]],
    paused: [['Continue', function () { if (resume()) $('board').focus(); }], ['New game', requestNewGame]],
    over: [['Play again', startNewGame]],
    won: [['Play again', startNewGame]]
  };
  var ovHandlers = [null, null];
  function renderOverlayButtons() {
    var defs = OV[mode] || [];
    ['ov-primary', 'ov-secondary'].forEach(function (id, i) {
      var b = $(id);
      b.hidden = !defs[i];
      if (defs[i]) { b.textContent = defs[i][0]; ovHandlers[i] = defs[i][1]; }
    });
  }
  $('ov-primary').addEventListener('click', function () { if (ovHandlers[0]) ovHandlers[0](); });
  $('ov-secondary').addEventListener('click', function () { if (ovHandlers[1]) ovHandlers[1](); });

  function renderBest() {
    $('best').textContent = String(best.get(game.profile));
    $('best-note').textContent = '(this setup' + (best.isPersistent() ? '' : ', this session') + ')';
  }

  // d: { livesMode, board, wrap, bonusEnabled } (a game state or the selected options)
  function rulesText(d) {
    var parts = [];
    parts.push(d.livesMode === 'unlimited' ? 'Assist: unlimited lives' : d.livesMode === 'extra' ? '3 lives' : '1 life');
    parts.push(d.board === 'clear' ? 'clear field' : BOARD_LABELS[d.board].toLowerCase());
    parts.push(d.wrap ? 'wrap around edges' : 'solid walls');
    parts.push(d.bonusEnabled ? 'bonus food on' : 'bonus food off');
    return parts.join(', ') + '.';
  }

  function selectedRules() {
    var o = gameOptions();
    return { livesMode: o.lives, board: o.board, wrap: o.wrap, bonusEnabled: o.bonus };
  }

  // The rules of the run on screen, and, when the saved choice differs, what the next game uses.
  function renderRules() {
    var active = runInProgress();
    $('rules-line').textContent = (active ? 'This run: ' : 'Next game: ') + rulesText(game);
    var sel = selectedRules();
    var differs = game.livesMode !== sel.livesMode || game.board !== sel.board || game.wrap !== sel.wrap || game.bonusEnabled !== sel.bonusEnabled;
    var next = $('rules-next');
    next.hidden = !(active && differs);
    next.textContent = 'Next game: ' + rulesText(sel);
  }

  function bonusSeconds(g) {
    return Math.max(1, Math.ceil(g.bonusItem.ticksLeft * g.tickMs / 1000));
  }

  function renderBonus() {
    var item = $('bonus-item');
    if (game.bonusItem && (mode === 'running' || mode === 'paused' || mode === 'ready')) {
      item.hidden = false;
      var t = bonusSeconds(game) + ' s';
      if ($('bonus-time').textContent !== t) $('bonus-time').textContent = t;
    } else {
      item.hidden = true;
    }
  }

  function updateUI(announce) {
    $('state-name').textContent = LABELS[mode];
    $('speed-name').textContent = SPEED_LABELS[game.speed];
    if (announce !== false) $('status').textContent = statusText();
    var text = overlayText();
    overlay.hidden = !text;
    overlay.setAttribute('data-kind', mode);
    $('overlay-text').textContent = text;
    renderOverlayButtons();
    $('score').textContent = String(game.score);
    $('length').textContent = String(game.snake.length);
    $('lives').textContent = game.lives === null ? 'Unlimited' : String(game.lives);
    $('speed-dots').setAttribute('data-level', String({ slow: 1, medium: 2, fast: 3 }[game.speed]));
    $('btn-speed').setAttribute('aria-label', 'Speed: ' + SPEED_LABELS[game.speed] + '. Tap to change for the next game.');
    renderRules();
    renderBonus();
    btnPause.disabled = mode !== 'running';
    btnPause.hidden = mode === 'paused';
    btnContinue.disabled = mode !== 'paused';
    btnContinue.hidden = mode !== 'paused';
    var active = mode === 'ready' || mode === 'running';
    Array.prototype.forEach.call(dpadButtons, function (b) { b.disabled = !active; });
    renderBest();
    draw();
  }

  // ---------- Loop ----------
  function stopLoop() {
    if (rafId) { window.cancelAnimationFrame(rafId); rafId = 0; }
  }

  function startLoop() {
    stopLoop();
    lastTime = null; // never replay time spent paused, hidden or not yet started
    acc = 0;
    rafId = window.requestAnimationFrame(frame);
  }

  function frame(t) {
    rafId = 0;
    if (mode !== 'running') return;
    var dt = lastTime === null ? 0 : t - lastTime;
    lastTime = t;
    var r = E.advanceClock(acc, dt, game.tickMs, MAX_STEPS);
    acc = r.acc;
    var lifeLost = false;
    for (var i = 0; i < r.steps && game.status === 'running'; i++) {
      var prev = game;
      var res = E.step(game);
      game = res.state;
      prevGame = prev;
      res.events.forEach(function (e) {
        if (e.type === 'lifeLost') { lifeLost = true; prevGame = null; }
        if (e.type === 'ate' || e.type === 'bonus' || e.type === 'lifeLost' || e.type === 'over' || e.type === 'won') sfx.play(e.type);
        if (!fxOn()) return;
        if (e.type === 'ate' || e.type === 'bonus') {
          fx.trigger(e.type, { x: game.snake[0].x, y: game.snake[0].y, points: game.score - prev.score });
        } else if (e.type === 'lifeLost' || e.type === 'over') {
          fx.trigger(e.type, { x: prev.snake[0].x, y: prev.snake[0].y });
        }
      });
    }
    if (game.status === 'over' || game.status === 'won') {
      finish();
      return;
    }
    if (lifeLost) { // the snake is back at the start and waits for a direction
      mode = 'ready';
      readyNote = game.lives === null
        ? 'Back at the start. Press a direction to continue.'
        : 'Life lost. ' + game.lives + (game.lives === 1 ? ' life left' : ' lives left') + '. Press a direction to continue.';
      updateUI();
      return;
    }
    $('score').textContent = String(game.score);
    $('length').textContent = String(game.snake.length);
    renderBonus();
    draw();
    rafId = window.requestAnimationFrame(frame);
  }

  function finish() {
    var before = best.get(game.profile);
    mode = game.status;
    best.submit(game.profile, game.score);
    updateUI();
    if (game.score > before && game.score > 0) {
      $('status').textContent = statusText() + ' New best.';
    }
  }

  // ---------- Commands ----------
  function startNewGame() {
    stopLoop();
    fx.reset();
    prevGame = null;
    currentShape = wantedShape();
    applyShape();
    game = newGame();
    readyNote = '';
    mode = 'ready';
    updateUI();
    $('board').focus(); // so keys work immediately after an explicit start
  }

  function applyShape() {
    $('layout').setAttribute('data-shape', currentShape);
  }

  function pause() {
    if (mode !== 'running') return false;
    mode = 'paused';
    stopLoop();
    updateUI();
    return true;
  }

  function resume() {
    if (mode !== 'paused') return false;
    mode = 'running';
    updateUI();
    startLoop();
    return true;
  }

  function input(dir) {
    if (mode !== 'ready' && mode !== 'running') return;
    var next = E.turn(game, dir);
    var started = mode === 'ready' && next.status === 'running';
    game = next;
    if (started) {
      prevGame = null;
      readyNote = '';
      mode = 'running';
      updateUI();
      startLoop();
    }
  }

  function requestNewGame() {
    if (mode === 'running' || mode === 'paused') {
      var wasRunning = pause();
      var dlg = $('dlg-confirm');
      if (typeof dlg.showModal === 'function') {
        dlg.returnValue = '';
        dlg.showModal();
        dlg.addEventListener('close', function onClose() {
          dlg.removeEventListener('close', onClose);
          if (dlg.returnValue === 'confirm') startNewGame();
          else if (wasRunning || mode === 'paused') btnContinue.focus();
        });
        return;
      }
    }
    startNewGame();
  }

  btnNew.addEventListener('click', requestNewGame);
  btnPause.addEventListener('click', function () {
    if (pause()) btnContinue.focus();
  });
  btnContinue.addEventListener('click', function () {
    if (resume()) $('board').focus();
  });

  // Auto-pause when the tab is hidden; resuming is always explicit and never catches up.
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) pause(); else startAnim();
  });

  // ---------- Input ----------
  var DIRS = { up: 'up', down: 'down', left: 'left', right: 'right' };
  Array.prototype.forEach.call(dpadButtons, function (b) {
    b.addEventListener('click', function () { input(DIRS[b.getAttribute('data-dir').toLowerCase()]); });
  });

  var KEYS = {
    ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
    w: 'up', a: 'left', s: 'down', d: 'right'
  };
  // Keys act only while the board has focus, so form fields and the rest of the page keep
  // their normal behaviour.
  $('board').addEventListener('keydown', function (e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    var k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    var dir = KEYS[k];
    if (dir && (mode === 'ready' || mode === 'running')) {
      e.preventDefault();
      input(dir);
    } else if ((k === ' ' || k === 'p') && (mode === 'running' || mode === 'paused')) {
      e.preventDefault();
      if (mode === 'running') pause(); else resume();
    }
  });

  // Swipe steering. A drag of at least SWIPE_PX along one axis turns the snake; the start
  // point then moves to the finger, so one long drag can chain turns. Shorter movements
  // are ignored. The board has touch-action: none, so this never scrolls the page.
  var SWIPE_PX = 24;
  var swipe = null;
  var boardEl = $('board');
  boardEl.addEventListener('pointerdown', function (e) {
    if (e.target.closest && e.target.closest('button')) return;
    swipe = { id: e.pointerId, x: e.clientX, y: e.clientY };
    try { boardEl.setPointerCapture(e.pointerId); } catch { /* not supported: fine */ }
  });
  boardEl.addEventListener('pointermove', function (e) {
    if (!swipe || swipe.id !== e.pointerId) return;
    var dx = e.clientX - swipe.x;
    var dy = e.clientY - swipe.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_PX) return;
    input(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
    swipe.x = e.clientX;
    swipe.y = e.clientY;
  });
  ['pointerup', 'pointercancel'].forEach(function (ev) {
    boardEl.addEventListener(ev, function (e) { if (swipe && swipe.id === e.pointerId) swipe = null; });
  });

  // Optional direction buttons.
  function renderDpad() {
    var on = uiPref.get().dpad === 'on';
    $('layout').classList.toggle('dpad-on', on);
    $('btn-dpad').setAttribute('aria-pressed', String(on));
    $('btn-dpad').setAttribute('aria-label', on ? 'Hide direction buttons' : 'Show direction buttons');
  }
  $('btn-dpad').addEventListener('click', function () {
    uiPref.set('dpad', uiPref.get().dpad === 'on' ? 'off' : 'on');
    renderDpad();
  });

  // Tapping the speed cell picks the next speed (it applies from the next game).
  $('btn-speed').addEventListener('click', function () {
    var order = E.SPEED_ORDER;
    var next = order[(order.indexOf(speedPref.get()) + 1) % order.length];
    speedPref.set(next);
    adoptSettings();
    if (runInProgress()) {
      $('status').textContent = SPEED_LABELS[next] + ' starts with your next new game.';
    } else {
      $('status').textContent = 'Speed: ' + SPEED_LABELS[next] + '.';
    }
  });

  // Full screen where the browser supports it (not on iPhone Safari).
  var fsBtn = $('btn-fullscreen');
  if (document.fullscreenEnabled && root.requestFullscreen) {
    fsBtn.hidden = false;
    fsBtn.addEventListener('click', function () {
      if (document.fullscreenElement) document.exitFullscreen();
      else root.requestFullscreen().catch(function () { /* refused: stay as is */ });
    });
    document.addEventListener('fullscreenchange', function () {
      var on = !!document.fullscreenElement;
      fsBtn.setAttribute('aria-pressed', String(on));
      fsBtn.setAttribute('aria-label', on ? 'Exit full screen' : 'Full screen');
      $('fullscreen-tip').textContent = on ? 'Exit full screen' : 'Full screen';
    });
  }

  // ---------- Dialogs and settings ----------
  Array.prototype.forEach.call(document.querySelectorAll('[data-open]'), function (b) {
    b.addEventListener('click', function () {
      var id = b.getAttribute('data-open');
      var dlg = $(id);
      if (!dlg || typeof dlg.showModal !== 'function') return;
      if (id === 'dlg-top') {
        var list = $('top-list');
        list.textContent = '';
        best.entries().slice(0, 8).forEach(function (e) {
          var li = document.createElement('li');
          li.textContent = profileLabel(e[0]) + ': ' + e[1];
          list.appendChild(li);
        });
        $('top-text').textContent = best.entries().length ? 'Best scores by setup:' : 'No score yet.';
        $('top-note').textContent = best.isPersistent()
          ? 'Scores are kept separately for each speed and rules setup, and saved on this device.'
          : 'Storage is unavailable, so best scores last for this session only.';
      }
      if (id === 'dlg-settings' || id === 'dlg-setup') syncSettingsControls();
      // Opening a panel mid-run pauses it; resuming stays explicit.
      pause();
      dlg.showModal();
      // Start at the top: scroll position reset and focus on the heading, not on Close.
      var body = dlg.querySelector('.dlg-scroll');
      if (body) body.scrollTop = 0;
      var h = dlg.querySelector('h2');
      var want = b.getAttribute('data-focus');
      var target = want && dlg.querySelector('#fs-' + want + ' input:checked');
      if (target) { target.focus(); target.scrollIntoView({ block: 'center' }); }
      else if (h) h.focus({ preventScroll: true });
    });
  });

  Array.prototype.forEach.call(document.querySelectorAll('input[name="theme"]'), function (r) {
    r.addEventListener('change', function () {
      if (r.checked) { applyTheme(r.value); saveTheme(r.value); }
    });
  });

  ['snakecolour', 'snakestyle'].forEach(function (name) {
    Array.prototype.forEach.call(document.querySelectorAll('input[name="' + name + '"]'), function (r) {
      r.addEventListener('change', function () {
        if (!r.checked) return;
        skinPref.set(name === 'snakecolour' ? 'colour' : 'style', r.value);
        draw();
      });
    });
  });

  ['sound', 'haptics'].forEach(function (name) {
    Array.prototype.forEach.call(document.querySelectorAll('input[name="' + name + '"]'), function (r) {
      r.addEventListener('change', function () {
        if (!r.checked) return;
        appPref.set(name, r.value);
        applyApp();
        if (r.value === 'on') { sfx.unlock(); sfx.play(name === 'sound' ? 'ate' : 'bonus'); } // a short preview
      });
    });
  });

  Array.prototype.forEach.call(document.querySelectorAll('input[name="fx"]'), function (r) {
    r.addEventListener('change', function () {
      if (!r.checked) return;
      uiPref.set('fx', r.value);
      fx.reset();
      if (fxOn()) startAnim(); else draw();
    });
  });

  // ---------- Speed and rules settings ----------
  function profileLabel(key) {
    var p = key.split('|');
    return [SPEED_LABELS[p[0]], LIVES_LABELS[p[1]], BOARD_LABELS[p[2]], EDGES_LABELS[p[3]],
            p[4] === 'bonus' ? 'Bonus on' : 'Bonus off'].join(', ');
  }

  // A change applies to the next New game so a run's rules and timing never change mid-run.
  // With no run started yet (menu or a fresh ready state) the pending game adopts it at once.
  function runInProgress() {
    return mode === 'running' || mode === 'paused' || mode === 'over' || mode === 'won' ||
      (mode === 'ready' && readyNote !== '');
  }

  function syncSettingsControls() {
    var sel = speedPref.get();
    var rules = rulesPref.get();
    var skin = skinPref.get();
    var checks = { speed: sel, board: rules.board, edges: rules.edges, lives: rules.lives, bonus: rules.bonus,
      snakecolour: skin.colour, snakestyle: skin.style, fx: uiPref.get().fx,
      sound: appPref.get().sound, haptics: appPref.get().haptics };
    Object.keys(checks).forEach(function (name) {
      var radio = document.querySelector('input[name="' + name + '"][value="' + checks[name] + '"]');
      if (radio) radio.checked = true;
    });
    var note = 'Applies to new games.';
    if ((mode === 'running' || mode === 'paused') && game.speed !== sel) {
      note = 'This run keeps ' + SPEED_LABELS[game.speed] + '. ' + SPEED_LABELS[sel] + ' starts with your next new game.';
    }
    if (!speedPref.isPersistent()) note += ' Not saved on this device.';
    $('speed-note').textContent = note;
    var rulesNote = 'Game settings: rules apply to the next run. Mazes, wrap, lives and bonus food are Classic Games choices, not verified original rules.';
    var now = gameOptions();
    var same = game.board === now.board && game.wrap === now.wrap && game.livesMode === now.lives && game.bonusEnabled === now.bonus;
    if ((mode === 'running' || mode === 'paused') && !same) {
      rulesNote = 'This run keeps its board, edges, lives and bonus. Changes start with your next new game.';
    }
    if (!rulesPref.isPersistent()) rulesNote += ' Not saved on this device.';
    $('rules-note').textContent = rulesNote;
    $('setup-summary').textContent = 'Selected for the next run: ' + rulesText(selectedRules());
    renderRules();
  }

  function adoptSettings() {
    if (!runInProgress()) {
      prevGame = null;
      game = newGame();
      updateUI(false);
    }
    syncSettingsControls();
  }

  Array.prototype.forEach.call(document.querySelectorAll('input[name="speed"]'), function (r) {
    r.addEventListener('change', function () {
      if (!r.checked) return;
      speedPref.set(r.value);
      adoptSettings();
    });
  });
  ['board', 'edges', 'lives', 'bonus'].forEach(function (field) {
    Array.prototype.forEach.call(document.querySelectorAll('input[name="' + field + '"]'), function (r) {
      r.addEventListener('change', function () {
        if (!r.checked) return;
        rulesPref.set(field, r.value);
        adoptSettings();
      });
    });
  });

  // ---------- Header tooltips ----------
  // Labels show on hover and keyboard focus. Escape hides them (and they come back on the
  // next hover or focus), so they never get in the way.
  var header = $('site-header');
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && header.querySelector('.icon-btn:focus-visible, .icon-btn:hover')) {
      header.classList.add('tips-dismissed');
    }
  });
  Array.prototype.forEach.call(header.querySelectorAll('.icon-btn'), function (b) {
    ['pointerenter', 'focus'].forEach(function (ev) {
      b.addEventListener(ev, function () { header.classList.remove('tips-dismissed'); });
    });
  });

  // ---------- Init ----------
  if (params.get('debug') === '1') {
    // Test hook (read-only snapshot); not used by the app.
    window.classicGamesDebug = {
      state: function () { return JSON.parse(JSON.stringify({ game: game, mode: mode })); },
      fx: fx
    };
  }
  game = newGame();
  applyShape();
  renderDpad();
  if (tallQuery && tallQuery.addEventListener) {
    // rotating a fresh page adopts the matching board; a run in progress keeps its own
    tallQuery.addEventListener('change', function () {
      if (mode === 'menu' || (mode === 'ready' && !runInProgress())) {
        currentShape = wantedShape();
        applyShape();
        game = newGame();
        updateUI(false);
      }
    });
  }
  applyTheme(readTheme());
  syncSettingsControls();
  updateUI();
  if (window.ResizeObserver) {
    new ResizeObserver(resizeCanvas).observe(canvas);
  } else {
    window.addEventListener('resize', resizeCanvas);
  }
  resizeCanvas();
  startAnim();
})();
