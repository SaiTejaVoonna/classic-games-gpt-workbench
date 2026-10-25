// Racer: an early playable prototype. A pseudo-3D road (projected horizontal slices, the
// classic technique) with curves, ten changing chapters, weather, sway and lights. The road
// rules are small: three lanes, traffic ahead, a crash ends the run. Everything here is a
// Classic Games prototype choice. Drawing and rules are in one file for now.
(function () {
  'use strict';

  var TAU = Math.PI * 2;
  var $ = function (id) { return document.getElementById(id); };
  var canvas = $('c');
  var g = canvas.getContext('2d');
  var params = new URLSearchParams(window.location.search);
  var DEBUG = params.get('debug') === '1';

  // ---------- helpers ----------
  function rnd(i, a) { var x = Math.sin(i * 127.1 + a * 311.7) * 43758.5453; return x - Math.floor(x); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function hex(h) { return [1, 3, 5].map(function (i) { return parseInt(h.slice(i, i + 2), 16); }); }
  function mix(a, b, t) {
    var A = hex(a); var B = hex(b);
    return '#' + A.map(function (v, i) { return Math.round(lerp(v, B[i], t)).toString(16).padStart(2, '0'); }).join('');
  }
  function rr(x, y, w, h, r) {
    g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }

  // ---------- chapters (scene looks); numbers blend, colours blend, lists switch ----------
  var CHAPTERS = [
    { name: 'Dawn Meadow', sky: ['#5f9fe6', '#b7d8f7', '#ffe7c8'], sunX: .3, sunY: .55, sunC: '#fff4cf', ground: ['#9bd06f', '#6fb251'], road: '#50586a', edge: '#f0ece0', line: '#fbf7ea', fog: '#d8ecff',
      ridge: ['#a9c9d8', '#86b69a', '#5e9a6e'], mist: .5, night: 0, stars: 0, rain: 0, snow: 0, leaves: 0, petals: 1, aurora: 0, heat: 0, skyline: 0, wind: 1, tintC: '#ffd9a0', tintA: .04,
      objs: ['round', 'round', 'pine', 'birch', 'bush', 'round', 'cherry', 'hut'] },
    { name: 'Sunset Coast', sky: ['#5a4fb5', '#ff7f6e', '#ffd09a'], sunX: .5, sunY: .86, sunC: '#fff0b8', ground: ['#e9c792', '#d7b07c'], road: '#4a4a62', edge: '#fbe3c6', line: '#fff0d6', fog: '#ffb08c',
      ridge: ['#7b5aa8', '#a7607e', '#2f7fb4'], mist: .55, night: 0, stars: 0, rain: 0, snow: 0, leaves: 0, petals: 0, aurora: 0, heat: 0, skyline: 0, wind: 1.4, tintC: '#ff8a50', tintA: .1,
      objs: ['palm', 'palm', 'bush', 'house', 'palm', 'rock'] },
    { name: 'Amber Valley', sky: ['#6b5fb5', '#ff8f7a', '#ffd29a'], sunX: .72, sunY: .78, sunC: '#fff3c4', ground: ['#a8b45a', '#7a9a46'], road: '#5a4f6a', edge: '#f6dcc0', line: '#fff2d6', fog: '#ffc7a0',
      ridge: ['#9a6f9a', '#7d6a7a', '#5f7d56'], mist: .65, night: .15, stars: 0, rain: 0, snow: 0, leaves: 1, petals: 0, aurora: 0, heat: 0, skyline: 0, wind: 1.2, tintC: '#ff9a50', tintA: .09,
      objs: ['maple', 'maple', 'pine', 'hut', 'round', 'windmill', 'bush', 'hut'] },
    { name: 'Dusk City', sky: ['#1b2a5e', '#7a3d7a', '#ff9a6a'], sunX: .22, sunY: .9, sunC: '#ffcf9a', ground: ['#5b6272', '#4c5362'], road: '#2c3040', edge: '#9aa3c0', line: '#ffd98a', fog: '#a5527a',
      ridge: ['#4a3a70', '#33325e', '#26264a'], mist: .5, night: .6, stars: .4, rain: 0, snow: 0, leaves: 0, petals: 0, aurora: 0, heat: 0, skyline: 1, wind: .4, tintC: '#5a3a7a', tintA: .08,
      objs: ['tower', 'tower', 'lamp', 'tower', 'house', 'lamp', 'tower'] },
    { name: 'Neon Quarter', sky: ['#07031a', '#2a0f5e', '#ff4f9a'], sunX: .5, sunY: .95, sunC: '#ff6ec0', ground: ['#120d2a', '#0d0a20'], road: '#171a2c', edge: '#2c3a78', line: '#7fe3ff', fog: '#3b1a6a',
      ridge: ['#3a1670', '#2a1058', '#190a3c'], mist: .5, night: 1, stars: .8, rain: 1, snow: 0, leaves: 0, petals: 0, aurora: 0, heat: 0, skyline: 1, wind: .2, tintC: '#6a1a9a', tintA: .1,
      objs: ['neon', 'neon', 'tower', 'tower', 'neon', 'lamp', 'tower'] },
    { name: 'Desert Road', sky: ['#3f93e8', '#9fd0ff', '#fde7b9'], sunX: .72, sunY: .35, sunC: '#fff7d0', ground: ['#e8c07e', '#d8ac68'], road: '#6a5c54', edge: '#efd9ae', line: '#fff0c2', fog: '#f6dcae',
      ridge: ['#e3b57a', '#d29f62', '#be8a52'], mist: .5, night: 0, stars: 0, rain: 0, snow: 0, leaves: 0, petals: 0, aurora: 0, heat: 1, skyline: 0, wind: .6, tintC: '#ffd27a', tintA: .07,
      objs: ['cactus', 'rock', 'cactus', 'bush', 'rock', 'cactus', 'hut'] },
    { name: 'Northern Lights', sky: ['#02040d', '#0b1a3a', '#1d4a6a'], sunX: .2, sunY: .45, sunC: '#f4f1e0', ground: ['#2a4a6a', '#cfdcec'], road: '#2a3350', edge: '#cfe0ff', line: '#e8f1ff', fog: '#2a4a7a',
      ridge: ['#16264a', '#0f1c3a', '#0a1430'], mist: .5, night: 1, stars: 1, rain: 0, snow: 1, leaves: 0, petals: 0, aurora: 1, heat: 0, skyline: 0, wind: .8, tintC: '#103a7a', tintA: .1,
      objs: ['pinesnow', 'pinesnow', 'pinesnow', 'cabin', 'pinesnow'] }
  ];
  var CHAPTER_LEN = 900; // metres per chapter (short on purpose so a prototype shows every look)

  function chapterAt(s) {
    var u = s / CHAPTER_LEN;
    var i = Math.floor(u);
    return { i: i, idx: ((i % CHAPTERS.length) + CHAPTERS.length) % CHAPTERS.length, frac: u - i };
  }

  var NUM_KEYS = ['sunX', 'sunY', 'mist', 'night', 'stars', 'rain', 'snow', 'leaves', 'petals', 'aurora', 'heat', 'skyline', 'wind', 'tintA'];
  var COL_KEYS = ['sunC', 'road', 'edge', 'line', 'fog', 'tintC'];
  // The scene at distance s: the chapter's look, blending into the next one over its last 22%.
  function sceneAt(s) {
    var c = chapterAt(s);
    var a = CHAPTERS[c.idx];
    var b = CHAPTERS[(c.idx + 1) % CHAPTERS.length];
    var t = clamp((c.frac - .78) / .22, 0, 1);
    t = t * t * (3 - 2 * t);
    var o = { name: a.name, chapter: c.i, frac: c.frac, t: t, a: a, b: b };
    NUM_KEYS.forEach(function (k) { o[k] = lerp(a[k], b[k], t); });
    COL_KEYS.forEach(function (k) { o[k] = mix(a[k], b[k], t); });
    o.sky = a.sky.map(function (col, i) { return mix(col, b.sky[i], t); });
    o.ground = a.ground.map(function (col, i) { return mix(col, b.ground[i], t); });
    o.ridge = a.ridge.map(function (col, i) { return mix(col, b.ridge[i], t); });
    return o;
  }

  // ---------- sizing ----------
  var W = 0; var H = 0; var dpr = 1;
  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    var r = canvas.getBoundingClientRect();
    W = Math.max(2, Math.round(r.width * dpr));
    H = Math.max(2, Math.round(r.height * dpr));
    if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
  }

  // ---------- game state ----------
  var mode = 'menu'; // menu | run | crash
  var dist = 0;
  var speed = 0;
  var lane = 0; // continuous, lanes at -1, 0, 1
  var laneTarget = 0;
  var tAnim = 0;
  var traffic = [];
  var nextSpawn = 120;
  var combo = 0;
  var comboTimer = 0;
  var score = 0;
  var best = 0;
  var shake = 0;
  var crashT = 0;
  var lastChapter = -1;
  var particles = [];
  var nearTimer = 0;
  var BEST_KEY = 'classic-games.racer.best';
  try { best = parseInt(window.localStorage.getItem(BEST_KEY), 10) || 0; } catch (e) { best = 0; }

  var CAR_KINDS = ['hatch', 'sedan', 'suv', 'sport', 'van', 'taxi', 'truck'];
  var CAR_COLS = ['#e11d48', '#2563eb', '#f59e0b', '#7c3aed', '#10b981', '#06b6d4', '#f97316', '#ef4444', '#ec4899'];
  var seedN = 1;
  function rand() { seedN = (seedN * 16807) % 2147483647; return (seedN - 1) / 2147483646; }

  function startSpeed() { return 44; }
  function targetSpeed(d) { return Math.min(92, 44 + d * 0.006); }

  function reset() {
    dist = 0; speed = startSpeed(); lane = 0; laneTarget = 0; traffic = []; nextSpawn = 140; combo = 0; comboTimer = 0;
    score = 0; shake = 0; crashT = 0; particles = []; lastChapter = -1; nearTimer = 0;
    seedN = (Date.now() % 100000) + 7;
    if (params.get('seed')) seedN = parseInt(params.get('seed'), 10) || 7;
  }

  function spawnWave(z) {
    var n = dist > 700 && rand() < .45 ? 2 : 1;
    var lanes = [-1, 0, 1];
    for (var i = 0; i < n; i++) {
      var k = Math.floor(rand() * lanes.length);
      var ln = lanes.splice(k, 1)[0];
      var kind = CAR_KINDS[Math.floor(rand() * CAR_KINDS.length)];
      traffic.push({ z: z + i * 6 * rand(), lane: ln, v: speed * (.38 + rand() * .3), kind: kind, col: CAR_COLS[Math.floor(rand() * CAR_COLS.length)], passed: false, minGap: 9 });
    }
  }

  // ---------- road geometry ----------
  var DRAW = 330; // metres drawn
  var K = 0.03;   // perspective strength
  var CURVE_A = 1.6e-4;
  function curveAt(s) {
    var gate = clamp(Math.sin(s / 1100) * 2.2, -1, 1);
    return CURVE_A * (gate * Math.sin(s / 380 + 1) + .5 * Math.sin(s / 170) * Math.abs(gate));
  }
  var xo = new Float32Array(DRAW + 2); // curve offset by metre ahead (road-half units)
  function buildCurve() {
    var x = 0; var dx = 0;
    xo[0] = 0;
    for (var d = 1; d <= DRAW + 1; d++) { dx += curveAt(dist + d) * 1; x += dx * 1; xo[d] = x; }
  }
  function xoAt(d) { var i = clamp(Math.floor(d), 0, DRAW); var f = d - i; return lerp(xo[i], xo[Math.min(DRAW + 1, i + 1)], f); }

  var hy = 0; var cx = 0; var RH = 0; var camX = 0;
  function pOf(d) { return 1 / (1 + d * K); }
  function yOf(p) { return hy + (H - hy) * p; }
  function sx(d, lat) { var p = pOf(d); return cx + (xoAt(d) + lat - camX) * p * RH; }

  // ---------- sprites ----------
  function carRear(x, by, w, col, kind, o) {
    o = o || {};
    var T = { hatch: { bh: .36, ch: .3, ct: .74, w: 1 }, sedan: { bh: .34, ch: .28, ct: .66, w: 1.02 }, suv: { bh: .42, ch: .34, ct: .78, w: 1.08 }, sport: { bh: .3, ch: .22, ct: .62, w: 1.06, sp: 1 }, taxi: { bh: .34, ch: .28, ct: .66, w: 1.02, roof: 1 }, van: { bh: .46, ch: .4, ct: .86, w: 1.1 }, truck: { box: 1, w: 1.15 } }[kind] || { bh: .36, ch: .3, ct: .74, w: 1 };
    var Wd = w * T.w;
    g.save();
    g.fillStyle = 'rgba(0,0,0,.38)'; g.beginPath(); g.ellipse(x, by + Wd * .02, Wd * .62, Wd * .09, 0, 0, TAU); g.fill();
    if (o.under) {
      var ug = g.createRadialGradient(x, by, 0, x, by, Wd * .9);
      ug.addColorStop(0, o.under + 'aa'); ug.addColorStop(1, o.under + '00');
      g.fillStyle = ug; g.beginPath(); g.ellipse(x, by, Wd * .9, Wd * .22, 0, 0, TAU); g.fill();
    }
    g.fillStyle = '#0b0d12'; rr(x - Wd * .47, by - Wd * .2, Wd * .14, Wd * .2, Wd * .04); g.fill(); rr(x + Wd * .33, by - Wd * .2, Wd * .14, Wd * .2, Wd * .04); g.fill();
    var tail = o.tail || '#ff3a3a';
    if (T.box) {
      var h = Wd;
      var gr = g.createLinearGradient(0, by - h, 0, by); gr.addColorStop(0, '#eef1f6'); gr.addColorStop(1, '#aeb5c3');
      g.fillStyle = gr; rr(x - Wd / 2, by - h, Wd, h - Wd * .12, Wd * .05); g.fill();
      g.fillStyle = '#262b36'; g.fillRect(x - Wd / 2, by - Wd * .2, Wd, Wd * .1);
    } else {
      var bh = Wd * T.bh; var ch = Wd * T.ch;
      var bg = g.createLinearGradient(0, by - bh - Wd * .1, 0, by);
      bg.addColorStop(0, mix(col, '#ffffff', .3)); bg.addColorStop(.4, col); bg.addColorStop(1, mix(col, '#000000', .55));
      g.fillStyle = bg; rr(x - Wd / 2, by - bh - Wd * .08, Wd, bh + Wd * .02, Wd * .1); g.fill();
      var ctw = Wd * T.ct;
      g.beginPath(); g.moveTo(x - Wd * .46, by - bh - Wd * .02); g.lineTo(x - ctw / 2, by - bh - ch - Wd * .04);
      g.quadraticCurveTo(x, by - bh - ch - Wd * .09, x + ctw / 2, by - bh - ch - Wd * .04); g.lineTo(x + Wd * .46, by - bh - Wd * .02); g.closePath();
      g.fillStyle = mix(col, '#000000', .15); g.fill();
      var gg = g.createLinearGradient(x - ctw / 2, 0, x + ctw / 2, 0); gg.addColorStop(0, '#0e1522'); gg.addColorStop(.5, '#25354f'); gg.addColorStop(1, '#0e1522');
      g.beginPath(); g.moveTo(x - Wd * .4, by - bh - Wd * .05); g.lineTo(x - ctw / 2 + Wd * .04, by - bh - ch - Wd * .01);
      g.quadraticCurveTo(x, by - bh - ch - Wd * .05, x + ctw / 2 - Wd * .04, by - bh - ch - Wd * .01); g.lineTo(x + Wd * .4, by - bh - Wd * .05); g.closePath();
      g.fillStyle = gg; g.fill();
      if (T.sp) { g.fillStyle = mix(col, '#000000', .5); rr(x - Wd * .44, by - bh - Wd * .12, Wd * .88, Wd * .045, Wd * .02); g.fill(); }
      if (T.roof) { g.fillStyle = '#fff7a8'; rr(x - Wd * .13, by - bh - ch - Wd * .1, Wd * .26, Wd * .07, Wd * .02); g.fill(); }
      g.fillStyle = '#1a1d25'; rr(x - Wd * .5, by - Wd * .12, Wd, Wd * .12, Wd * .05); g.fill();
      g.save(); g.shadowColor = tail; g.shadowBlur = Wd * (o.brake ? .35 : .2); g.fillStyle = tail;
      rr(x - Wd * .47, by - bh * .8, Wd * .24, Wd * .08, Wd * .03); g.fill(); rr(x + Wd * .23, by - bh * .8, Wd * .24, Wd * .08, Wd * .03); g.fill();
      g.globalAlpha = .8; g.fillRect(x - Wd * .22, by - bh * .76, Wd * .44, Wd * .022); g.restore();
      g.fillStyle = '#e9edf2'; rr(x - Wd * .09, by - Wd * .15, Wd * .18, Wd * .055, Wd * .01); g.fill();
      var sh = g.createLinearGradient(0, by - bh, 0, by - bh * .4); sh.addColorStop(0, 'rgba(255,255,255,.28)'); sh.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = sh; rr(x - Wd * .46, by - bh - Wd * .04, Wd * .92, bh * .5, Wd * .08); g.fill();
    }
    g.restore();
  }

  function glowDot(x, y, r, col) {
    g.save(); g.globalCompositeOperation = 'lighter';
    var gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, col + 'cc'); gr.addColorStop(1, col + '00');
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); g.restore();
  }

  // Roadside objects stand on the ground at (x, y) with scale s. sw = wind sway.
  function drawObj(kind, x, y, s, k, S, sw, lit) {
    var col, v = .8 + rnd(k, 7) * .5;
    g.save(); g.translate(x, y); g.transform(1, 0, sw * .02, 1, 0, 0); g.scale(v, v * (.92 + rnd(k, 9) * .25));
    var greens = ['#4f9a4a', '#3f8a46', '#5aa55a', '#3a7a40'];
    var autumn = ['#e08a2e', '#c2410c', '#e8b040', '#d9822b'];
    if (kind === 'round' || kind === 'maple') {
      col = kind === 'maple' ? autumn[k % 4] : greens[k % 4];
      g.fillStyle = '#5a4130'; g.fillRect(-3 * s, -28 * s, 6 * s, 28 * s);
      [[0, -48, 24, 0], [-11, -40, 17, 1], [12, -41, 17, 1], [0, -56, 16, 2]].forEach(function (c) {
        g.fillStyle = c[3] === 0 ? mix(col, '#000000', .22) : c[3] === 2 ? mix(col, '#ffffff', .22) : col;
        g.beginPath(); g.arc(c[0] * s, c[1] * s, c[2] * s, 0, TAU); g.fill();
      });
    } else if (kind === 'pine' || kind === 'pinesnow') {
      col = kind === 'pinesnow' ? '#16382c' : ['#2f5a44', '#3a6a4a'][k % 2];
      g.fillStyle = '#3a2a20'; g.fillRect(-2 * s, -10 * s, 4 * s, 10 * s);
      for (var i = 0; i < 5; i++) {
        g.fillStyle = col; g.beginPath(); g.moveTo(sw * .1 * i * s, -(72 - i * 11) * s); g.lineTo((8 + i * 5) * s, -(42 - i * 10) * s); g.lineTo(-(8 + i * 5) * s, -(42 - i * 10) * s); g.fill();
        if (kind === 'pinesnow') { g.fillStyle = '#eaf2fb'; g.beginPath(); g.moveTo(0, -(72 - i * 11) * s); g.lineTo((4 + i * 2) * s, -(62 - i * 11) * s); g.lineTo(-(4 + i * 2) * s, -(62 - i * 11) * s); g.fill(); }
      }
    } else if (kind === 'birch') {
      g.fillStyle = '#e8e4d8'; g.fillRect(-2.5 * s, -46 * s, 5 * s, 46 * s); g.fillStyle = '#444';
      for (var q = 0; q < 4; q++) g.fillRect(-2.5 * s, -(8 + q * 10) * s, 5 * s, 1.5 * s);
      [[0, -54, 15], [-9, -46, 11], [10, -47, 11]].forEach(function (c) { g.fillStyle = '#b9c85a'; g.beginPath(); g.arc(c[0] * s, c[1] * s, c[2] * s, 0, TAU); g.fill(); });
    } else if (kind === 'cherry') {
      g.fillStyle = '#5a4130'; g.fillRect(-3 * s, -30 * s, 6 * s, 30 * s);
      [[0, -52, 22], [-14, -44, 15], [14, -46, 16], [0, -62, 14]].forEach(function (c, j) { g.fillStyle = j % 2 ? '#ffb7d0' : '#ff9fc0'; g.beginPath(); g.arc(c[0] * s, c[1] * s, c[2] * s, 0, TAU); g.fill(); });
    } else if (kind === 'palm') {
      g.strokeStyle = '#8a6a3c'; g.lineWidth = 5 * s; g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(6 * s + sw * .3 * s, -30 * s, 2 * s + sw * .6 * s, -58 * s); g.stroke();
      for (var a = 0; a < 7; a++) { var an = a / 7 * TAU; g.strokeStyle = '#2f9e6a'; g.lineWidth = 4 * s; g.beginPath(); g.moveTo(2 * s + sw * .6 * s, -58 * s); g.quadraticCurveTo(2 * s + Math.cos(an) * 18 * s, -70 * s + Math.sin(an) * 6 * s, 2 * s + Math.cos(an) * 30 * s, -56 * s + Math.sin(an) * 14 * s); g.stroke(); }
    } else if (kind === 'cactus') {
      g.fillStyle = '#4e8f55'; rr(-5 * s, -42 * s, 10 * s, 42 * s, 5 * s); g.fill(); rr(-17 * s, -30 * s, 8 * s, 18 * s, 4 * s); g.fill(); g.fillRect(-17 * s, -14 * s, 14 * s, 6 * s); rr(9 * s, -36 * s, 8 * s, 18 * s, 4 * s); g.fill(); g.fillRect(3 * s, -20 * s, 14 * s, 6 * s);
    } else if (kind === 'rock') {
      g.fillStyle = S.rockC; g.beginPath(); g.moveTo(-22 * s, 0); g.quadraticCurveTo(-18 * s, -24 * s, -2 * s, -22 * s); g.quadraticCurveTo(16 * s, -26 * s, 24 * s, 0); g.fill();
      g.fillStyle = 'rgba(255,255,255,.14)'; g.beginPath(); g.moveTo(-12 * s, -6 * s); g.quadraticCurveTo(-6 * s, -20 * s, 2 * s, -18 * s); g.lineTo(-4 * s, -4 * s); g.fill();
    } else if (kind === 'bush') {
      [[-9, -7, 10, 0], [3, -10, 12, 1], [14, -6, 9, 0]].forEach(function (c) { g.fillStyle = c[3] ? '#6fb85a' : '#4f9a4a'; g.beginPath(); g.arc(c[0] * s, c[1] * s, c[2] * s, 0, TAU); g.fill(); });
      g.fillStyle = '#ffd1e8'; [[-6, -9], [8, -14], [12, -5]].forEach(function (c) { g.beginPath(); g.arc(c[0] * s, c[1] * s, 2 * s, 0, TAU); g.fill(); });
    } else if (kind === 'hut' || kind === 'house' || kind === 'cabin') {
      var w = (kind === 'house' ? 44 : 34) * s; var h = (kind === 'house' ? 34 : 24) * s;
      g.fillStyle = kind === 'cabin' ? '#7a5a3a' : ['#d9c3a0', '#f4e3c8', '#cfe3f5', '#f6c9c0'][k % 4]; g.fillRect(-w / 2, -h, w, h);
      g.fillStyle = kind === 'cabin' ? '#e9f1fb' : ['#b5532f', '#7a3b2e', '#34495e'][k % 3];
      g.beginPath(); g.moveTo(-w * .65, -h); g.lineTo(0, -h - 20 * s); g.lineTo(w * .65, -h); g.fill();
      var on = lit > .3 || kind === 'cabin';
      g.fillStyle = on ? '#ffd27a' : '#2a3347';
      if (on) { g.save(); g.shadowColor = '#ffcf70'; g.shadowBlur = 12 * s; g.fillRect(-w * .4, -h * .75, 8 * s, 8 * s); g.fillRect(w * .22, -h * .75, 8 * s, 8 * s); g.restore(); } else { g.fillRect(-w * .4, -h * .75, 8 * s, 8 * s); g.fillRect(w * .22, -h * .75, 8 * s, 8 * s); }
      if (kind !== 'house') { for (var sm = 0; sm < 3; sm++) { var u = (tAnim * .4 + sm / 3 + k * .13) % 1; g.fillStyle = 'rgba(235,235,240,' + (.5 * (1 - u)) + ')'; g.beginPath(); g.arc(w * .2 + u * 10 * s, -h - 18 * s - u * 30 * s, (3 + u * 6) * s, 0, TAU); g.fill(); } }
    } else if (kind === 'windmill') {
      g.fillStyle = '#efe6d2'; g.beginPath(); g.moveTo(-12 * s, 0); g.lineTo(-7 * s, -44 * s); g.lineTo(7 * s, -44 * s); g.lineTo(12 * s, 0); g.fill();
      g.fillStyle = '#8a5a3a'; g.beginPath(); g.moveTo(-9 * s, -44 * s); g.lineTo(0, -56 * s); g.lineTo(9 * s, -44 * s); g.fill();
      g.save(); g.translate(0, -46 * s); g.rotate(tAnim * .9 + k); g.fillStyle = '#e8dcc0'; for (var b = 0; b < 4; b++) { g.rotate(Math.PI / 2); g.fillRect(-1.5 * s, 0, 3 * s, 30 * s); g.fillRect(-8 * s, 8 * s, 16 * s, 18 * s); } g.restore();
    } else if (kind === 'tower' || kind === 'neon') {
      var tw = (30 + rnd(k, 1) * 26) * s; var th = (100 + rnd(k, 2) * 150) * s;
      var gr = g.createLinearGradient(-tw / 2, 0, tw / 2, 0);
      var neon = kind === 'neon' || S.night > .8;
      gr.addColorStop(0, neon ? '#2b2f6a' : '#5b6b86'); gr.addColorStop(1, neon ? '#12162e' : '#34405a');
      g.fillStyle = gr; g.fillRect(-tw / 2, -th, tw, th);
      var cols = Math.max(2, Math.floor(tw / (9 * s))); var rows = Math.max(2, Math.floor(th / (11 * s)));
      for (var r = 0; r < rows; r++) for (var c2 = 0; c2 < cols; c2++) {
        var lit2 = lit > .25 && rnd(r * 9 + c2 + k, 4) > .38;
        g.fillStyle = lit2 ? (neon ? ['#ff4fd8', '#35e6ff', '#ffe066'][(r + c2) % 3] : '#ffd97a') : 'rgba(20,30,50,.55)';
        g.globalAlpha = lit2 ? (.75 + .25 * Math.sin(tAnim * (rnd(r + c2, 5) > .9 ? 10 : 1.2) + r + c2)) : 1;
        g.fillRect(-tw / 2 + 3 * s + c2 * (tw - 6 * s) / cols, -th + 4 * s + r * 11 * s, (tw - 6 * s) / cols - 2 * s, 6 * s);
      }
      g.globalAlpha = 1;
      g.fillStyle = '#222'; g.fillRect(-s, -th - 14 * s, 2 * s, 14 * s);
      if (((tAnim * 1.2 + k) % 1) < .5) { g.save(); g.shadowColor = '#ff3b3b'; g.shadowBlur = 12; g.fillStyle = '#ff3b3b'; g.beginPath(); g.arc(0, -th - 14 * s, 2.4 * s, 0, TAU); g.fill(); g.restore(); }
      if (kind === 'neon') {
        var nc = ['#ff4fd8', '#35e6ff', '#ffe066', '#7cff6b'][k % 4];
        var onn = ((tAnim * (1 + rnd(k, 2))) % 1) > .12;
        g.save(); g.shadowColor = nc; g.shadowBlur = onn ? 18 : 2; g.fillStyle = onn ? nc : '#333'; rr(-tw * .5 - 14 * s, -th * .5, 28 * s, 18 * s, 4 * s); g.fill(); g.restore();
      }
    } else if (kind === 'lamp') {
      g.fillStyle = '#2f3644'; g.fillRect(-2 * s, -64 * s, 4 * s, 64 * s); g.fillRect(0, -66 * s, 16 * s, 3 * s);
      if (lit > .2) { glowDot(14 * s, -62 * s, 28 * s, '#ffd98a'); g.fillStyle = '#ffe9a8'; g.beginPath(); g.arc(14 * s, -62 * s, 4 * s, 0, TAU); g.fill(); }
    }
    g.restore();
  }

  // ---------- drawing ----------
  function drawSky(S) {
    var sk = g.createLinearGradient(0, 0, 0, hy);
    sk.addColorStop(0, S.sky[0]); sk.addColorStop(.55, S.sky[1]); sk.addColorStop(1, S.sky[2]);
    g.fillStyle = sk; g.fillRect(0, 0, W, hy + 2);
    if (S.stars > .02) { for (var i = 0; i < 90; i++) { g.fillStyle = 'rgba(255,255,255,' + (S.stars * (.25 + .6 * Math.abs(Math.sin(tAnim * 1.5 + i)))) + ')'; g.fillRect(rnd(i, 1) * W, rnd(i, 2) * hy * .8, 1.5 * dpr, 1.5 * dpr); } }
    var sx0 = S.sunX * W; var sy0 = hy * S.sunY;
    var sunA = 1 - S.stars * .6;
    var gl = g.createRadialGradient(sx0, sy0, 0, sx0, sy0, W * .55);
    gl.addColorStop(0, 'rgba(255,240,200,' + (.85 * sunA) + ')'); gl.addColorStop(.2, 'rgba(255,210,150,' + (.4 * sunA) + ')'); gl.addColorStop(1, 'rgba(255,190,120,0)');
    g.fillStyle = gl; g.fillRect(0, 0, W, hy + 30 * dpr);
    g.fillStyle = S.sunC; g.beginPath(); g.arc(sx0, sy0, W * .05, 0, TAU); g.fill();
    if (S.stars > .5) { g.fillStyle = 'rgba(8,10,24,.7)'; g.beginPath(); g.arc(sx0 + W * .02, sy0, W * .05, 0, TAU); g.fill(); }
    // clouds
    for (var c = 0; c < 4; c++) {
      var x = ((rnd(c, 5) * W * 1.4 + tAnim * 14 * dpr * (.5 + rnd(c, 6))) % (W * 1.4)) - W * .2; var y = hy * (.12 + rnd(c, 7) * .45);
      g.fillStyle = 'rgba(255,255,255,' + (.55 - S.stars * .35) + ')';
      [0, 30, 60, 22, 46].forEach(function (dx, k2) { g.beginPath(); g.ellipse(x + dx * dpr, y + (k2 > 2 ? 6 * dpr : 0), 34 * dpr, 13 * dpr, 0, 0, TAU); g.fill(); });
    }
    if (S.aurora > .02) {
      g.save(); g.globalCompositeOperation = 'screen'; g.globalAlpha = S.aurora * .9;
      for (var b = 0; b < 3; b++) {
        var ag = g.createLinearGradient(0, hy * .05, 0, hy * .85); var cc = ['90,255,180', '70,200,255', '150,120,255'][b];
        ag.addColorStop(0, 'rgba(' + cc + ',0)'); ag.addColorStop(.45, 'rgba(' + cc + ',.45)'); ag.addColorStop(1, 'rgba(' + cc + ',0)');
        g.fillStyle = ag; g.beginPath(); g.moveTo(0, hy * .9);
        for (var x2 = 0; x2 <= W; x2 += 10 * dpr) g.lineTo(x2, hy * (.3 + b * .1) + Math.sin(x2 / dpr * .009 + tAnim * .7 + b * 1.7) * hy * .12);
        g.lineTo(W, hy * .9); g.fill();
      }
      g.restore();
    }
    // ridges
    var far = xoAt(DRAW * .8) * .12;
    for (var L = 0; L < 3; L++) {
      var amp = H * (.05 + L * .012); var base = hy - H * .008 * (2 - L);
      g.fillStyle = S.ridge[L]; g.beginPath(); g.moveTo(0, hy + 6);
      for (var xx = 0; xx <= W; xx += 8 * dpr) {
        var q = xx / dpr - far * 40 * (.3 + L * .4) + dist * .01 * (L + 1);
        g.lineTo(xx, base - amp * (.5 + .5 * Math.sin(q * .011 + L * 2)) - amp * .4 * Math.sin(q * .027 + L * 5));
      }
      g.lineTo(W, hy + 6); g.fill();
      var mg = g.createLinearGradient(0, base - amp * 1.2, 0, hy + 8); mg.addColorStop(0, 'rgba(255,255,255,0)'); mg.addColorStop(1, mix(S.fog, '#ffffff', .1) + Math.round(S.mist * (.55 - L * .12) * 255).toString(16).padStart(2, '0'));
      g.fillStyle = mg; g.fillRect(0, base - amp * 1.2, W, hy + 8 - (base - amp * 1.2));
    }
    if (S.skyline > .02) {
      g.globalAlpha = S.skyline;
      for (var i2 = 0; i2 < 20; i2++) {
        var bw = W / 20; var bh = H * (.04 + rnd(i2, 3) * .11); var bx = i2 * bw - far * 30;
        g.fillStyle = mix(S.ridge[1], '#ff4f9a', .08); g.fillRect(bx, hy - bh, bw - 2, bh + 2);
        if (S.night > .4) { g.fillStyle = 'rgba(255,224,130,.55)'; for (var k3 = 0; k3 < bh / (9 * dpr); k3++) if (rnd(i2 * 7 + k3, 4) > .5) g.fillRect(bx + 3 * dpr, hy - bh + 3 * dpr + k3 * 9 * dpr, bw - 8 * dpr, 3 * dpr); }
      }
      g.globalAlpha = 1;
    }
  }

  function drawGround(S) {
    var gg = g.createLinearGradient(0, hy, 0, H);
    gg.addColorStop(0, mix(S.ground[0], S.fog, .35)); gg.addColorStop(1, S.ground[1]);
    g.fillStyle = gg; g.fillRect(0, hy, W, H - hy);
    for (var y = hy + 2; y < H; y += 3 * dpr) {
      var p = (y - hy) / (H - hy); var d = (1 / Math.max(.02, p) - 1) / K;
      if (Math.floor((d + dist) / 7) % 2 === 0) { g.fillStyle = 'rgba(0,0,0,.05)'; g.fillRect(0, y, W, 3 * dpr); }
    }
  }

  function drawRoad(S) {
    var step = 1 * dpr;
    for (var y = H; y > hy + 1; y -= step) {
      var p = (y - hy) / (H - hy); if (p < .012) break;
      var d = (1 / p - 1) / K; if (d > DRAW) break;
      var hw = RH * p; var ct = cx + (xoAt(d) - camX) * p * RH;
      g.fillStyle = mix(S.road, S.fog, Math.max(0, .55 - p * 1.1)); g.fillRect(ct - hw, y - step, hw * 2, step + .6);
      var ew = Math.max(1, RH * .035 * p); var rum = Math.floor((d + dist) / 4) % 2 === 0;
      g.fillStyle = rum ? S.edge : mix(S.edge, '#c0392b', .55); g.fillRect(ct - hw, y - step, ew, step + .6); g.fillRect(ct + hw - ew, y - step, ew, step + .6);
      if (Math.floor((d + dist) / 6) % 2 === 0) {
        g.fillStyle = S.line; var lw = Math.max(1, RH * .014 * p);
        g.fillRect(ct - hw / 3 - lw / 2, y - step, lw, step + .6); g.fillRect(ct + hw / 3 - lw / 2, y - step, lw, step + .6);
      }
    }
    if (S.rain > .1) {
      g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = .2 * S.rain;
      var cols = ['#ff4fd8', '#35e6ff', '#ffe066'];
      for (var i = 0; i < 10; i++) {
        var k = (rnd(i, 9) * 2 - 1) * .9; var rg = g.createLinearGradient(0, hy, 0, H); rg.addColorStop(0, cols[i % 3]); rg.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = rg; g.fillRect(cx + k * RH * .5 - 3 * dpr, hy + (H - hy) * .05, (6 + rnd(i, 3) * 14) * dpr, (H - hy) * .9);
      }
      g.restore();
    }
  }

  function objectKind(a, k) { return a.objs[Math.floor(rnd(k, 33) * a.objs.length)]; }

  function drawWorld(S) {
    // collect roadside objects and traffic, draw far to near
    var items = []; var SP = 11;
    var n0 = Math.floor((dist + 6) / SP); var n1 = Math.floor((dist + DRAW) / SP);
    for (var n = n0; n <= n1; n++) {
      for (var sd = -1; sd <= 1; sd += 2) {
        var k = n * 2 + (sd > 0 ? 1 : 0); if (rnd(k, 41) < .12) continue;
        var pos = n * SP + rnd(k, 42) * 6; var d = pos - dist; if (d < 4 || d > DRAW) continue;
        var ch = chapterAt(pos); var A = CHAPTERS[ch.idx]; var B = CHAPTERS[(ch.idx + 1) % CHAPTERS.length];
        var use = ch.frac > .88 && rnd(k, 43) < (ch.frac - .88) / .12 ? B : A;
        items.push({ d: d, kind: objectKind(use, k), side: sd, k: k, lat: sd * (1.12 + rnd(k, 44) * .75), lit: Math.max(use.night, S.night * .5), snow: use.snow, S: use });
      }
    }
    traffic.forEach(function (c) { var d = c.z - dist; if (d > 1 && d < DRAW) items.push({ d: d, car: c }); });
    items.sort(function (a, b) { return b.d - a.d; });
    var rockC = mix(S.ground[1], '#7a6a5a', .5);
    var S2 = { night: S.night, rockC: rockC };
    items.forEach(function (it) {
      var p = pOf(it.d); var y = yOf(p);
      if (it.car) {
        var c = it.car; var x = cx + (xoAt(it.d) + c.lane / 1.7 - camX) * p * RH; var w = W * .3 * p * 1.7 / (dpr > 1 ? 1 : 1);
        if (S.night > .5) { glowDot(x, y, w * .7, '#ff2a4a'); }
        carRear(x, y, w, c.col, c.kind, { brake: false, tail: '#ff3a3a', under: S.night > .85 ? c.col : null });
        return;
      }
      var s = p * (W / 230) * 1.35; var x2 = cx + (xoAt(it.d) + it.lat - camX) * p * RH;
      if (x2 < -W * .3 || x2 > W * 1.3) return;
      var sway = Math.sin(tAnim * 2.4 + it.k * 1.7) * S.wind * s * 3;
      drawObj(it.kind, x2, y, s, it.k, S2, sway, it.lit);
    });
  }

  function drawPlayer(S) {
    var py = H * .93; var pw = W * .44; var tilt = clamp((laneTarget - lane) * .12, -.14, .14);
    if (S.night > .5 || S.rain > .3) {
      var px = cx + (lane / 1.7 - camX) * RH;
      g.save(); g.globalCompositeOperation = 'lighter'; g.translate(px, py - pw * .5); g.scale(1, 3.4);
      var hl = g.createRadialGradient(0, 0, 0, 0, 0, W * .26); hl.addColorStop(0, 'rgba(255,244,200,.34)'); hl.addColorStop(1, 'rgba(255,244,200,0)');
      g.fillStyle = hl; g.beginPath(); g.arc(0, 0, W * .26, 0, TAU); g.fill(); g.restore();
    }
    var x = cx + (lane / 1.7 - camX) * RH;
    g.save(); g.translate(x, py); g.rotate(tilt);
    carRear(0, 0, pw, '#eef1f8', 'sport', { under: S.night > .6 ? '#35e6ff' : null, tail: '#ff3355', brake: false });
    g.restore();
  }

  function drawWeather(S) {
    if (S.rain > .05) {
      g.strokeStyle = 'rgba(200,225,255,' + (.45 * S.rain) + ')'; g.lineWidth = 1.5 * dpr;
      var n = Math.round(130 * S.rain);
      for (var i = 0; i < n; i++) { var x = rnd(i, 1) * W; var y = ((rnd(i, 2) * H + tAnim * 1100 * dpr) % H); g.beginPath(); g.moveTo(x, y); g.lineTo(x - 7 * dpr, y + 26 * dpr); g.stroke(); }
      g.fillStyle = 'rgba(15,22,40,' + (.2 * S.rain) + ')'; g.fillRect(0, 0, W, H);
    }
    if (S.snow > .05) {
      g.fillStyle = '#fff';
      for (var j = 0; j < 90 * S.snow; j++) { g.globalAlpha = .4 + rnd(j, 3) * .5; g.beginPath(); g.arc((rnd(j, 1) * W + Math.sin(tAnim * 2 + j) * 16 * dpr) % W, (rnd(j, 2) * H + tAnim * 150 * dpr * (.4 + rnd(j, 4))) % H, (1.2 + rnd(j, 3) * 2.4) * dpr, 0, TAU); g.fill(); }
      g.globalAlpha = 1;
    }
    if (S.leaves > .05) {
      for (var l = 0; l < 16 * S.leaves; l++) { var x3 = (rnd(l, 1) * W + Math.sin(tAnim * 2 + l) * 30 * dpr + tAnim * 120 * dpr) % W; var y3 = (rnd(l, 2) * H + tAnim * 110 * dpr) % H; g.fillStyle = ['#e8b040', '#c2410c', '#e08a2e'][l % 3]; g.save(); g.translate(x3, y3); g.rotate(tAnim + l); g.beginPath(); g.ellipse(0, 0, 6 * dpr, 3 * dpr, 0, 0, TAU); g.fill(); g.restore(); }
    }
    if (S.petals > .05) {
      for (var q = 0; q < 22 * S.petals; q++) { var x4 = (rnd(q, 1) * W + tAnim * 170 * dpr + q * 9) % W; var y4 = H * .5 + rnd(q, 2) * H * .4 + Math.sin(tAnim * 3 + q) * 14 * dpr; g.fillStyle = ['#ffd1e8', '#fff3c4'][q % 2]; g.beginPath(); g.ellipse(x4, y4, 5 * dpr, 2.4 * dpr, tAnim * 3 + q, 0, TAU); g.fill(); }
    }
    if (S.heat > .05) { g.save(); g.globalAlpha = .1 * S.heat; g.fillStyle = '#fff'; for (var h = 0; h < 5; h++) g.fillRect(0, hy + (10 + h * 16 + Math.sin(tAnim * 3 + h) * 3) * dpr, W, 3 * dpr); g.restore(); }
    // fog band at the horizon
    var fg = g.createLinearGradient(0, hy - H * .05, 0, hy + H * .26);
    fg.addColorStop(0, S.fog + 'ff'); fg.addColorStop(1, S.fog + '00');
    g.globalAlpha = .55 + S.mist * .2; g.fillStyle = fg; g.fillRect(0, hy - H * .05, W, H * .31); g.globalAlpha = 1;
    // speed lines
    if (mode === 'run' && speed > 70) {
      g.save(); g.strokeStyle = 'rgba(255,255,255,' + clamp((speed - 70) / 60, 0, .3) + ')'; g.lineWidth = 1.5 * dpr;
      for (var i2 = 0; i2 < 18; i2++) { var a = rnd(i2, 11) * TAU, r0 = W * (.5 + rnd(i2, 2) * .15), r1 = W * (.9 + rnd(i2, 3) * .4); g.beginPath(); g.moveTo(cx + Math.cos(a) * r0, hy + H * .2 + Math.sin(a) * r0 * .8); g.lineTo(cx + Math.cos(a) * r1, hy + H * .2 + Math.sin(a) * r1 * .8); g.stroke(); }
      g.restore();
    }
    // tint, light vignette
    g.fillStyle = S.tintC; g.globalAlpha = S.tintA; g.fillRect(0, 0, W, H); g.globalAlpha = 1;
    var vg = g.createRadialGradient(cx, H * .55, W * .35, cx, H * .55, W * .95);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,' + (.25 + S.night * .3) + ')');
    g.fillStyle = vg; g.fillRect(0, 0, W, H);
  }

  function drawParticles() {
    particles.forEach(function (p) {
      g.globalAlpha = clamp(p.life, 0, 1); g.fillStyle = p.c; g.beginPath(); g.arc(p.x, p.y, p.r * dpr, 0, TAU); g.fill();
    });
    g.globalAlpha = 1;
  }

  function render() {
    resize();
    hy = H * .4; cx = W / 2; RH = W * .9; camX = lane / 1.7 * .5;
    buildCurve();
    var S = sceneAt(dist);
    g.save();
    if (shake > 0) g.translate((Math.random() - .5) * shake * dpr, (Math.random() - .5) * shake * dpr);
    drawSky(S); drawGround(S); drawRoad(S); drawWorld(S); drawPlayer(S); drawWeather(S); drawParticles();
    g.restore();
    return S;
  }

  // ---------- audio ----------
  var sfx = window.SnakeSfx ? window.SnakeSfx.create({ AudioContext: window.AudioContext || window.webkitAudioContext, vibrate: window.navigator.vibrate ? window.navigator.vibrate.bind(window.navigator) : null }) : null;
  var muted = false;
  try { muted = window.localStorage.getItem('classic-games.racer.muted') === '1'; } catch (e) { muted = false; }
  if (sfx) { sfx.setSound(!muted); }
  var engine = null;
  function startEngine() {
    if (engine || muted) return;
    var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    try {
      var ac = new AC(); var o = ac.createOscillator(); var f = ac.createBiquadFilter(); var gn = ac.createGain();
      o.type = 'sawtooth'; f.type = 'lowpass'; f.frequency.value = 420; gn.gain.value = 0.03; o.connect(f); f.connect(gn); gn.connect(ac.destination); o.start();
      engine = { ac: ac, o: o, g: gn, f: f };
    } catch (e) { engine = null; }
  }
  function updateEngine() { if (engine) { engine.o.frequency.value = 52 + speed * 2.4; engine.f.frequency.value = 300 + speed * 5; engine.g.gain.value = mode === 'run' && !muted ? .03 : 0; } }
  function stopEngine() { if (engine) { engine.g.gain.value = 0; } }

  // ---------- HUD ----------
  var elDist = $('dist'); var elSpd = $('spd'); var elCombo = $('combo'); var elRing = $('ring'); var elNear = $('near');
  var elChapter = $('chapter'); var elChNum = $('ch-num'); var elChName = $('ch-name'); var chTimer = 0;
  function hud() {
    elDist.textContent = String(Math.floor(score));
    elSpd.textContent = String(Math.round(speed * 3.6));
    elCombo.textContent = 'x' + Math.max(1, combo);
    elRing.style.setProperty('--p', Math.round(clamp(comboTimer / 3, 0, 1) * 100) + '%');
  }
  function showChapter(i, name) { elChNum.textContent = 'Chapter ' + (i % 10 + 1); elChName.textContent = name; elChapter.classList.add('show'); chTimer = 3.2; }
  function showNear(text) { elNear.textContent = text; elNear.classList.add('show'); nearTimer = .9; }

  // ---------- loop ----------
  var last = null;
  function burst(x, y, n, cols) {
    for (var i = 0; i < n; i++) { var a = Math.random() * TAU; var v = 40 + Math.random() * 220; particles.push({ x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, life: 1, r: 2 + Math.random() * 3, c: cols[i % cols.length] }); }
  }
  function step(dt) {
    tAnim += dt;
    particles.forEach(function (p) { p.x += p.vx * dt * dpr; p.y += p.vy * dt * dpr; p.vy += 300 * dt; p.life -= dt * 1.4; });
    particles = particles.filter(function (p) { return p.life > 0; });
    if (shake > 0) shake = Math.max(0, shake - dt * 40);
    if (chTimer > 0) { chTimer -= dt; if (chTimer <= 0) elChapter.classList.remove('show'); }
    if (nearTimer > 0) { nearTimer -= dt; if (nearTimer <= 0) elNear.classList.remove('show'); }
    lane += (laneTarget - lane) * Math.min(1, dt * 11);
    if (mode !== 'run') { if (mode === 'menu') { dist += 20 * dt; } return; }
    speed += (targetSpeed(dist) - speed) * Math.min(1, dt * .8);
    dist += speed * dt; score += speed * dt * .1;
    if (comboTimer > 0) { comboTimer -= dt; if (comboTimer <= 0) combo = 0; }
    while (nextSpawn < dist + DRAW) { spawnWave(nextSpawn); nextSpawn += 46 + rand() * 30 - Math.min(14, dist * .0015); }
    var c0 = chapterAt(dist);
    if (c0.i !== lastChapter) { lastChapter = c0.i; showChapter(c0.i, CHAPTERS[c0.idx].name); }
    for (var i = 0; i < traffic.length; i++) {
      var c = traffic[i]; c.z += c.v * dt; var d = c.z - dist; var gap = Math.abs(lane - c.lane);
      if (Math.abs(d) < 8) c.minGap = Math.min(c.minGap, gap);
      if (d < 4.6 && d > -4.6 && gap < .66) { crash(c); return; }
      if (!c.passed && d < -4.6) {
        c.passed = true;
        if (c.minGap < 1.35) { combo += 1; comboTimer = 3; score += 5 * combo; showNear(combo > 1 ? 'CLOSE  x' + combo : 'CLOSE'); if (sfx) sfx.play('bonus'); }
      }
    }
    traffic = traffic.filter(function (c) { return c.z > dist - 30; });
    updateEngine();
    hud();
  }
  function crash(c) {
    mode = 'crash'; shake = 18; crashT = 0; speed = 0;
    burst(cx, H * .85, 40, ['#ffb347', '#ff6b4a', '#ffd166', '#888']);
    if (sfx) sfx.play('over');
    stopEngine();
    var s = Math.floor(score); var isBest = s > best;
    if (isBest) { best = s; try { window.localStorage.setItem(BEST_KEY, String(best)); } catch (e) { /* fine */ } }
    $('ov-title').textContent = 'Crash';
    $('ov-sub').textContent = 'Distance score ' + s + (isBest ? '. New best!' : '. Best ' + best + '.');
    $('play').textContent = 'Play again';
    window.setTimeout(function () { $('ov').hidden = false; }, 650);
  }
  function frame(t) {
    if (last === null) last = t;
    var dt = Math.min(.05, (t - last) / 1000); last = t;
    step(dt); render();
    window.requestAnimationFrame(frame);
  }

  // ---------- input ----------
  function go(dir) { if (mode !== 'run') return; laneTarget = clamp(laneTarget + dir, -1, 1); if (sfx) { sfx.unlock(); } }
  function start() {
    reset(); mode = 'run'; $('ov').hidden = true; startEngine(); if (sfx) sfx.unlock();
    if (engine && engine.ac.state === 'suspended') engine.ac.resume();
    hud();
  }
  $('play').addEventListener('click', start);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowLeft' || e.key === 'a') { go(-1); e.preventDefault(); }
    else if (e.key === 'ArrowRight' || e.key === 'd') { go(1); e.preventDefault(); }
    else if ((e.key === 'Enter' || e.key === ' ') && !$('ov').hidden) { start(); e.preventDefault(); }
  });
  var stage = $('stage'); var sw0 = null;
  stage.addEventListener('pointerdown', function (e) { if (e.target.closest('button,a')) return; sw0 = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false }; });
  stage.addEventListener('pointermove', function (e) {
    if (!sw0 || sw0.id !== e.pointerId) return;
    var dx = e.clientX - sw0.x;
    if (Math.abs(dx) > 26 && Math.abs(dx) > Math.abs(e.clientY - sw0.y)) { go(dx > 0 ? 1 : -1); sw0.x = e.clientX; sw0.y = e.clientY; sw0.moved = true; }
  });
  stage.addEventListener('pointerup', function (e) {
    if (sw0 && sw0.id === e.pointerId && !sw0.moved && mode === 'run') { var r = stage.getBoundingClientRect(); go(e.clientX < r.left + r.width / 2 ? -1 : 1); }
    sw0 = null;
  });
  stage.addEventListener('pointercancel', function () { sw0 = null; });
  $('mute').addEventListener('click', function () {
    muted = !muted; try { window.localStorage.setItem('classic-games.racer.muted', muted ? '1' : '0'); } catch (e) { /* fine */ }
    if (sfx) sfx.setSound(!muted); $('mute').textContent = muted ? 'Sound off' : 'Sound on'; $('mute').setAttribute('aria-pressed', String(muted)); if (!muted) startEngine(); else stopEngine();
  });
  $('mute').textContent = muted ? 'Sound off' : 'Sound on';
  document.addEventListener('visibilitychange', function () { last = null; });
  window.addEventListener('resize', render);

  // ---------- init ----------
  reset();
  if (DEBUG) {
    // test and gallery hook: draw a still frame at a distance with demo traffic
    window.racerDebug = {
      state: function () { return { mode: mode, dist: dist, speed: speed, lane: lane, laneTarget: laneTarget, combo: combo, score: score, traffic: traffic.length, chapter: chapterAt(dist).i }; },
      still: function (d, t, laneV, withTraffic) {
        mode = 'menu'; dist = d; tAnim = t; lane = laneV || 0; laneTarget = lane; speed = 70; traffic = [];
        if (withTraffic !== false) [[40, -1], [72, 1], [118, 0], [160, -1], [205, 1]].forEach(function (a, i) { traffic.push({ z: d + a[0], lane: a[1], v: 0, kind: CAR_KINDS[(i * 3 + Math.floor(d / 300)) % CAR_KINDS.length], col: CAR_COLS[(i * 2 + Math.floor(d / 200)) % CAR_COLS.length], passed: false, minGap: 9 }); });
        $('ov').hidden = true; return render();
      },
      start: start,
      crashNow: function () { crash(traffic[0] || {}); },
      stage: function () { return stage.getBoundingClientRect(); },
      setLane: function (l) { lane = laneTarget = l; }
    };
    if (params.get('still')) { window.racerDebug.still(parseFloat(params.get('still')), parseFloat(params.get('t') || '1'), 0, true); $('ov').hidden = true; }
    else window.requestAnimationFrame(frame);
  } else {
    window.requestAnimationFrame(frame);
  }
})();
