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
  // Ten chapters: a day that runs into night and out to dawn. kit and life are used by the sound.
  var CHAPTERS = [
    { name: 'Dawn Meadow', kit: 'piano', bed: 'meadow', life: ['songbirds', 'balloon', 'windmill'], balloon: 1, sky: ['#5f9fe6', '#b7d8f7', '#ffe7c8'], sunX: .3, sunY: .55, sunC: '#fff4cf', ground: ['#9bd06f', '#6fb251'], road: '#50586a', edge: '#f0ece0', line: '#fbf7ea', fog: '#d8ecff',
      ridge: ['#a9c9d8', '#86b69a', '#5e9a6e'], mist: .5, night: 0, stars: 0, rain: 0, snow: 0, leaves: 0, petals: 1, aurora: 0, heat: 0, skyline: 0, wind: 1, tintC: '#ffd9a0', tintA: .04,
      objs: ['round', 'round', 'pine', 'birch', 'bush', 'round', 'cherry', 'hut'] },
    { name: 'Cherry Hills', kit: 'pluck', bed: 'meadow', life: ['songbirds', 'windchimes', 'butterflies'], sky: ['#7fb2f0', '#f6c8e0', '#fff0e0'], sunX: .62, sunY: .5, sunC: '#fff6d8', ground: ['#a4d878', '#80c462'], road: '#58606f', edge: '#fff0f4', line: '#ffffff', fog: '#ffe4ee',
      ridge: ['#d9a6c6', '#9fc9a0', '#6fb07a'], mist: .6, night: 0, stars: 0, rain: 0, snow: 0, leaves: 0, petals: 1.6, aurora: 0, heat: 0, skyline: 0, wind: 1.2, tintC: '#ffb6d0', tintA: .05,
      objs: ['cherry', 'cherry', 'cherry', 'round', 'bush', 'hut', 'birch'] },
    { name: 'Desert Road', kit: 'acoustic', bed: 'desert', life: ['windchimes', 'flag', 'crickets'], sky: ['#3f93e8', '#9fd0ff', '#fde7b9'], sunX: .72, sunY: .35, sunC: '#fff7d0', ground: ['#e8c07e', '#d8ac68'], road: '#6a5c54', edge: '#efd9ae', line: '#fff0c2', fog: '#f6dcae',
      ridge: ['#e3b57a', '#d29f62', '#be8a52'], mist: .5, night: 0, stars: 0, rain: 0, snow: 0, leaves: 0, petals: 0, aurora: 0, heat: 1, skyline: 0, wind: .6, tintC: '#ffd27a', tintA: .07,
      objs: ['cactus', 'rock', 'cactus', 'bush', 'rock', 'cactus', 'hut'] },
    { name: 'Amber Valley', kit: 'cello', bed: 'meadow', life: ['windmill', 'crow', 'churchbell', 'crickets'], balloon: 1, sky: ['#6b5fb5', '#ff8f7a', '#ffd29a'], sunX: .72, sunY: .78, sunC: '#fff3c4', ground: ['#a8b45a', '#7a9a46'], road: '#5a4f6a', edge: '#f6dcc0', line: '#fff2d6', fog: '#ffc7a0',
      ridge: ['#9a6f9a', '#7d6a7a', '#5f7d56'], mist: .65, night: .15, stars: 0, rain: 0, snow: 0, leaves: 1, petals: 0, aurora: 0, heat: 0, skyline: 0, wind: 1.2, tintC: '#ff9a50', tintA: .09,
      objs: ['maple', 'maple', 'pine', 'hut', 'round', 'windmill', 'bush', 'hut'] },
    { name: 'Sunset Coast', kit: 'handpan', bed: 'waves', life: ['gulls', 'bellbuoy', 'boathorn', 'balloon'], water: 1, balloon: 1, sky: ['#5a4fb5', '#ff7f6e', '#ffd09a'], sunX: .5, sunY: .86, sunC: '#fff0b8', ground: ['#e9c792', '#d7b07c'], road: '#4a4a62', edge: '#fbe3c6', line: '#fff0d6', fog: '#ffb08c',
      ridge: ['#7b5aa8', '#a7607e', '#2f7fb4'], mist: .55, night: 0, stars: 0, rain: 0, snow: 0, leaves: 0, petals: 0, aurora: 0, heat: 0, skyline: 0, wind: 1.4, tintC: '#ff8a50', tintA: .1,
      objs: ['palm', 'umbrella', 'palm', 'bush', 'umbrella', 'house', 'palm', 'lighthouse', 'rock'] },
    { name: 'Dusk City', kit: 'electro-soft', bed: 'city', life: ['siren', 'cityhorns', 'plane', 'train'], sky: ['#1b2a5e', '#7a3d7a', '#ff9a6a'], sunX: .22, sunY: .9, sunC: '#ffcf9a', ground: ['#5b6272', '#4c5362'], road: '#2c3040', edge: '#9aa3c0', line: '#ffd98a', fog: '#a5527a',
      ridge: ['#4a3a70', '#33325e', '#26264a'], mist: .5, night: .6, stars: .4, rain: 0, snow: 0, leaves: 0, petals: 0, aurora: 0, heat: 0, skyline: 1, wind: .4, tintC: '#5a3a7a', tintA: .08,
      objs: ['tower', 'tower', 'lamp', 'tower', 'house', 'lamp', 'tower'] },
    { name: 'Neon Quarter', kit: 'electro', bed: 'rain', life: ['thunderfar', 'siren', 'raingust'], sky: ['#07031a', '#2a0f5e', '#ff4f9a'], sunX: .5, sunY: .95, sunC: '#ff6ec0', ground: ['#120d2a', '#0d0a20'], road: '#171a2c', edge: '#2c3a78', line: '#7fe3ff', fog: '#3b1a6a',
      ridge: ['#3a1670', '#2a1058', '#190a3c'], mist: .5, night: 1, stars: .8, rain: 1, snow: 0, leaves: 0, petals: 0, aurora: 0, heat: 0, skyline: 1, wind: .2, tintC: '#6a1a9a', tintA: .1,
      objs: ['neon', 'neon', 'tower', 'tower', 'neon', 'lamp', 'tower'] },
    { name: 'Storm Pass', kit: 'cinematic', bed: 'storm', life: ['thunderclose', 'thunderfar', 'raingust', 'tunnel'], lightning: 1, sky: ['#1a2230', '#3a4658', '#6a7a90'], sunX: .5, sunY: .9, sunC: '#9fb0c8', ground: ['#3a4f40', '#2f4235'], road: '#2a2f3a', edge: '#7d879a', line: '#c9d3e4', fog: '#56657c',
      ridge: ['#2c3748', '#27402f', '#1f3426'], mist: .7, night: .5, stars: 0, rain: 1, snow: 0, leaves: 0, petals: 0, aurora: 0, heat: 0, skyline: 0, wind: 3, tintC: '#102040', tintA: .12,
      objs: ['pine', 'pine', 'lamp', 'rock', 'pine', 'bush'] },
    { name: 'Northern Lights', kit: 'pads', bed: 'snow', life: ['owl', 'windchimes', 'train'], sky: ['#02040d', '#0b1a3a', '#1d4a6a'], sunX: .2, sunY: .45, sunC: '#f4f1e0', ground: ['#2a4a6a', '#cfdcec'], road: '#2a3350', edge: '#cfe0ff', line: '#e8f1ff', fog: '#2a4a7a',
      ridge: ['#16264a', '#0f1c3a', '#0a1430'], mist: .5, night: 1, stars: 1, rain: 0, snow: 1, leaves: 0, petals: 0, aurora: 1, heat: 0, skyline: 0, wind: .8, tintC: '#103a7a', tintA: .1,
      objs: ['pinesnow', 'pinesnow', 'pinesnow', 'cabin', 'pinesnow'] },
    { name: 'Sunrise Coast', kit: 'epic', bed: 'waves', life: ['gulls', 'foghorn', 'balloon', 'fireworks'], water: 1, balloon: 1, sky: ['#3f5fb0', '#ff9a8a', '#ffe0a0'], sunX: .5, sunY: .93, sunC: '#fff2c0', ground: ['#efd3a2', '#e0bb88'], road: '#4d5068', edge: '#fff0dc', line: '#fff6e6', fog: '#ffd0b0',
      ridge: ['#8c6aa8', '#c0788a', '#3f90c8'], mist: .6, night: 0, stars: 0, rain: 0, snow: 0, leaves: 0, petals: 0, aurora: 0, heat: 0, skyline: 0, wind: 1.4, tintC: '#ffb070', tintA: .08,
      objs: ['palm', 'umbrella', 'palm', 'bush', 'lighthouse', 'umbrella', 'palm', 'house'] }
  ];
  var JOURNEY_CHAPTERS = CHAPTERS.length;
  var CHAPTER_LENS = { demo: 900, full: 3600 }; // metres per chapter. Demo shows every look in about 3 minutes.
  var chapterLen = 900;
  var tripMode = 'journey'; // journey | endless

  function chapterAt(s) {
    var u = s / chapterLen;
    var i = Math.floor(u);
    return { i: i, idx: ((i % CHAPTERS.length) + CHAPTERS.length) % CHAPTERS.length, frac: u - i };
  }

  var NUM_KEYS = ['water', 'lightning', 'sunX', 'sunY', 'mist', 'night', 'stars', 'rain', 'snow', 'leaves', 'petals', 'aurora', 'heat', 'skyline', 'wind', 'tintA'];
  var COL_KEYS = ['sunC', 'road', 'edge', 'line', 'fog', 'tintC'];
  // The scene at distance s: the chapter's look, blending into the next one over its last 22%.
  function sceneAt(s) {
    var c = chapterAt(s);
    var a = CHAPTERS[c.idx];
    var b = CHAPTERS[(c.idx + 1) % CHAPTERS.length];
    var t = clamp((c.frac - .78) / .22, 0, 1);
    t = t * t * (3 - 2 * t);
    if (tripMode === 'journey' && c.i >= JOURNEY_CHAPTERS - 1) t = 0; // the last chapter does not fade into the first
    var o = { name: a.name, chapter: c.i, frac: c.frac, t: t, a: a, b: b };
    NUM_KEYS.forEach(function (k) { o[k] = lerp(a[k] || 0, b[k] || 0, t); });
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
  var mode = 'menu'; // menu | run | over | done
  var paused = false;
  var dist = 0;
  var speed = 0;
  var lane = 0; // continuous, lanes at -1, 0, 1
  var laneTarget = 0;
  var tAnim = 0;
  var traffic = [];
  var nextSpawn = 300;
  var combo = 0;
  var comboTimer = 0;
  var score = 0;
  var lives = 3;
  var maxLives = 3;
  var shieldT = 0;
  var flashT = 0;
  var lightningT = 0;
  var shake = 0;
  var lastChapter = -1;
  var nextStop = 0; // index into the rest stops
  var particles = [];
  var nearTimer = 0;
  var chTimer = 0;
  var braking = false;
  var coinNote = 0;
  var coinNoteT = 0;
  var collected = {};
  var run = { near: 0, coins: 0, hits: 0 };

  var CAR_KINDS = ['hatch', 'sedan', 'suv', 'sport', 'van', 'taxi', 'truck'];
  var CAR_COLS = ['#e11d48', '#2563eb', '#f59e0b', '#7c3aed', '#10b981', '#06b6d4', '#f97316', '#ef4444', '#ec4899'];
  var seedN = 1;
  function rand() { seedN = (seedN * 16807) % 2147483647; return (seedN - 1) / 2147483646; }

  // Speed choices (game units per second) and difficulty (lives, traffic, shield time).
  var SPEEDS = { relaxed: { start: 34, max: 72 }, normal: { start: 44, max: 92 }, fast: { start: 56, max: 110 } };
  var DIFFS = {
    easy: { lives: 3, gapMin: 140, gapRand: 70, twoFrom: 99999, twoChance: 0, shield: 2.6 },
    normal: { lives: 2, gapMin: 95, gapRand: 60, twoFrom: 1800, twoChance: .3, shield: 2 },
    hard: { lives: 1, gapMin: 75, gapRand: 50, twoFrom: 900, twoChance: .45, shield: 1.4 }
  };
  var REST_STOPS = [2, 4, 6, 8]; // after chapters 2, 4, 6 and 8 of a journey (in chapter lengths)
  var PREFS_KEY = 'classic-games.racer.prefs';
  var STATS_KEY = 'classic-games.racer.stats';
  var BESTS_KEY = 'classic-games.racer.bests';
  var CHECK_KEY = 'classic-games.racer.checkpoint';
  var APP_KEY = 'classic-games.app';
  var STYLES = ['auto', 'cinematic', 'piano', 'electronic', 'acoustic'];

  function readJson(key) { try { var raw = window.localStorage.getItem(key); return raw ? JSON.parse(raw) : null; } catch (e) { return null; } }
  function writeJson(key, v) { try { window.localStorage.setItem(key, JSON.stringify(v)); } catch (e) { /* storage unavailable: fine */ } }
  function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }

  var prefs = { mode: 'journey', difficulty: 'easy', speed: 'relaxed', length: 'demo', music: 'on', sfx: 'on', style: 'auto', volMusic: 60, volFx: 70, bass: 50, calm: 'off' };
  (function loadPrefs() {
    var s = readJson(PREFS_KEY); if (!s || typeof s !== 'object') return;
    if (s.mode === 'journey' || s.mode === 'endless') prefs.mode = s.mode;
    if (has(DIFFS, s.difficulty)) prefs.difficulty = s.difficulty;
    if (has(SPEEDS, s.speed)) prefs.speed = s.speed;
    if (s.length === 'demo' || s.length === 'full') prefs.length = s.length;
    if (s.music === 'on' || s.music === 'off') prefs.music = s.music;
    if (s.sfx === 'on' || s.sfx === 'off') prefs.sfx = s.sfx;
    if (STYLES.indexOf(s.style) >= 0) prefs.style = s.style;
    if (s.calm === 'on' || s.calm === 'off') prefs.calm = s.calm;
    ['volMusic', 'volFx', 'bass'].forEach(function (k) { if (typeof s[k] === 'number' && s[k] >= 0 && s[k] <= 100) prefs[k] = Math.round(s[k]); });
  })();
  function savePrefs() { writeJson(PREFS_KEY, prefs); }

  function appChoice(name) { var a = readJson(APP_KEY); return a && a.chosen && a.chosen[name] === 'off' ? 'off' : 'on'; }

  var stats = (function () {
    var s = readJson(STATS_KEY) || {}; var o = {};
    ['runs', 'near', 'nearBest', 'coins', 'journeys', 'noHitJourneys', 'maxChapter', 'bestDistance'].forEach(function (k) { o[k] = typeof s[k] === 'number' && isFinite(s[k]) ? s[k] : 0; });
    return o;
  })();
  function saveStats() { writeJson(STATS_KEY, stats); }
  function bestKey() { return prefs.mode + '|' + prefs.difficulty + (prefs.mode === 'journey' ? '|' + prefs.length : ''); }
  function getBest() { var b = readJson(BESTS_KEY) || {}; return typeof b[bestKey()] === 'number' ? b[bestKey()] : 0; }
  function submitBest(sc) { var b = readJson(BESTS_KEY) || {}; var k = bestKey(); var isBest = sc > (typeof b[k] === 'number' ? b[k] : 0); if (isBest) { b[k] = sc; writeJson(BESTS_KEY, b); } return isBest; }
  function getCheckpoint() {
    var c = readJson(CHECK_KEY);
    if (!c || c.mode !== 'journey' || typeof c.chapter !== 'number' || c.chapter < 1 || c.chapter >= JOURNEY_CHAPTERS || !has(DIFFS, c.difficulty) || !has(CHAPTER_LENS, c.length)) return null;
    return c;
  }

  function cfgSpeed() { return SPEEDS[prefs.speed]; }
  function targetSpeed(d) { var sp = cfgSpeed(); return Math.min(sp.max, sp.start + d * 0.005); }

  function applyTrip() {
    tripMode = prefs.mode; chapterLen = CHAPTER_LENS[prefs.length];
    maxLives = DIFFS[prefs.difficulty].lives;
  }

  function reset(fromCheckpoint) {
    applyTrip();
    dist = 0; speed = cfgSpeed().start; lane = 0; laneTarget = 0; traffic = []; nextSpawn = 300; combo = 0; comboTimer = 0;
    score = 0; shake = 0; particles = []; lastChapter = -1; nearTimer = 0; shieldT = 0; flashT = 0; lives = maxLives; nextStop = 0; collected = {};
    run = { near: 0, coins: 0, hits: 0 }; coinNote = 0; coinNoteT = 0; braking = false; paused = false;
    if (fromCheckpoint) {
      dist = fromCheckpoint.chapter * chapterLen; lives = clamp(fromCheckpoint.lives, 1, maxLives); score = fromCheckpoint.score || 0; run.hits = 1;
      nextSpawn = dist + 260; while (nextStop < REST_STOPS.length && REST_STOPS[nextStop] * chapterLen <= dist) nextStop++;
    }
    seedN = (Date.now() % 100000) + 7;
    if (params.get('seed')) seedN = parseInt(params.get('seed'), 10) || 7;
  }

  function spawnWave(z) {
    var d = DIFFS[prefs.difficulty];
    var n = dist > d.twoFrom && rand() < d.twoChance ? 2 : 1;
    var lanes = [-1, 0, 1];
    for (var i = 0; i < n; i++) {
      var k = Math.floor(rand() * lanes.length);
      var ln = lanes.splice(k, 1)[0];
      var kind = CAR_KINDS[Math.floor(rand() * CAR_KINDS.length)];
      traffic.push({ z: z + i * 6 * rand(), lane: ln, v: speed * (.38 + rand() * .3), kind: kind, col: CAR_COLS[Math.floor(rand() * CAR_COLS.length)], passed: false, minGap: 9 });
    }
  }

  // Coins come in short lines, hearts are rare. Positions come from the road distance, so the
  // drawing and the pickup always agree.
  function coinChunk(cn) {
    if (rnd(cn, 72) < .35) return null;
    return { lane: Math.floor(rnd(cn, 71) * 3) - 1, count: 5 + Math.floor(rnd(cn, 73) * 3), start: cn * 90 + 20 };
  }
  function heartChunk(hn) {
    if (rnd(hn, 81) < .45) return null;
    return { lane: Math.floor(rnd(hn, 82) * 3) - 1, at: hn * 600 + 330 };
  }
  function nearStop(pos) { // calm road around rest stops and the finish
    for (var i = 0; i < REST_STOPS.length; i++) if (Math.abs(pos - REST_STOPS[i] * chapterLen) < 110) return true;
    return tripMode === 'journey' && pos > JOURNEY_CHAPTERS * chapterLen - 160;
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
  // Hills: the road rises and falls. Rows are shifted up or down with distance, and a row can
  // never be lower than the one in front of it, so a crest hides what is behind it.
  var HILL = [10, 3.8]; var ES = 0; var e0 = 0; var hyR = 0;
  function elev(s) { return HILL[0] * Math.sin(s / 330) + HILL[1] * Math.sin(s / 143 + 1.3); }
  function rowAt(d) { var p = pOf(d); return { y: yOf(p) - (elev(dist + d) - e0) * p * ES, p: p, ct: cx + (xoAt(d) - camX) * p * RH, hw: RH * p }; }
  var rows = [];
  function buildRows() {
    rows = []; var prev = 1e9; var d = -.5;
    while (d <= DRAW) {
      var r = rowAt(d); r.d = d; if (r.y > prev - .3) r.y = prev - .3; prev = r.y; rows.push(r);
      d += d < 8 ? .35 : d < 30 ? .8 : d < 100 ? 1.6 : 3;
    }
  }
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
    // Rear tyres, drawn behind the body but with visible outer tread and sidewall.
    g.fillStyle = '#10131a'; rr(x - Wd * .49, by - Wd * .25, Wd * .17, Wd * .29, Wd * .035); g.fill(); rr(x + Wd * .32, by - Wd * .25, Wd * .17, Wd * .29, Wd * .035); g.fill();
    g.fillStyle = '#8993a1'; rr(x - Wd * .455, by - Wd * .19, Wd * .09, Wd * .12, Wd * .018); g.fill(); rr(x + Wd * .365, by - Wd * .19, Wd * .09, Wd * .12, Wd * .018); g.fill();
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
    } else if (kind === 'umbrella') {
      g.fillStyle = '#e8dcc6'; g.beginPath(); g.ellipse(18 * s, -2 * s, 22 * s, 4 * s, 0, 0, TAU); g.fill();
      g.fillStyle = '#7a5a3a'; g.fillRect(-1.5 * s, -44 * s, 3 * s, 44 * s);
      var uc = ['#e8483f', '#35a7ff', '#ffd54f', '#7cc67a'][k % 4];
      for (var us = 0; us < 6; us++) { g.fillStyle = us % 2 ? '#ffffff' : uc; g.beginPath(); g.moveTo(0, -48 * s); g.quadraticCurveTo(-24 * s + us * 8 * s, -52 * s, -24 * s + us * 8 * s + 8 * s, -36 * s); g.lineTo(-24 * s + us * 8 * s, -36 * s); g.fill(); }
    } else if (kind === 'lighthouse') {
      g.fillStyle = '#f4f1ea'; g.beginPath(); g.moveTo(-10 * s, 0); g.lineTo(-6 * s, -80 * s); g.lineTo(6 * s, -80 * s); g.lineTo(10 * s, 0); g.fill();
      g.fillStyle = '#c0392b'; [18, 42, 66].forEach(function (yy) { g.fillRect(-9 * s + (yy / 80) * 3 * s, -yy * s, 18 * s - (yy / 80) * 6 * s, 9 * s); });
      g.fillStyle = '#2d3440'; g.fillRect(-8 * s, -88 * s, 16 * s, 8 * s); glowDot(0, -92 * s, 30 * s, '#ffe9a0');
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
        g.globalAlpha = lit2 ? (.75 + .25 * Math.sin(tAnim * (rnd(r + c2, 5) > .9 ? 1.6 : .5) + r + c2)) : 1;
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
    g.fillStyle = sk; g.fillRect(0, 0, W, Math.max(hy, hyR) + 2);
    if (S.stars > .02) { for (var i = 0; i < 90; i++) { g.fillStyle = 'rgba(255,255,255,' + (S.stars * (.25 + .6 * Math.abs(Math.sin(tAnim * 1.5 + i)))) + ')'; g.fillRect(rnd(i, 1) * W, rnd(i, 2) * hy * .8, 1.5 * dpr, 1.5 * dpr); } }
    var sx0 = S.sunX * W; var sy0 = hy * S.sunY;
    var sunA = 1 - S.stars * .6;
    var breathe = 1 + .06 * Math.sin(tAnim * .9);
    var gl = g.createRadialGradient(sx0, sy0, 0, sx0, sy0, W * .55 * breathe);
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
    // life in the sky: a flock of birds, a slow balloon, a shooting star
    if (S.night < .5 && S.stars < .4) {
      var bu = ((tAnim + 3) % 26) / 26;
      if (bu < .5) {
        var bx0 = -W * .1 + bu * 2 * W * 1.2; var by0 = hy * .3 + Math.sin(bu * 6) * hy * .05;
        g.strokeStyle = 'rgba(40,30,60,.7)'; g.lineWidth = 1.8 * dpr; g.lineCap = 'round';
        for (var bi = 0; bi < 7; bi++) {
          var row = Math.ceil(bi / 2); var sd = bi % 2 ? 1 : -1; var bx = bx0 - row * 20 * dpr; var by = by0 + sd * row * 9 * dpr; var wing = Math.sin(tAnim * 8 + bi) * 4 * dpr;
          g.beginPath(); g.moveTo(bx - 8 * dpr, by + wing * .3); g.quadraticCurveTo(bx - 4 * dpr, by - 5 * dpr - wing, bx, by); g.quadraticCurveTo(bx + 4 * dpr, by - 5 * dpr - wing, bx + 8 * dpr, by + wing * .3); g.stroke();
        }
      }
    }
    if (S.a.balloon && S.night < .5) {
      var lx = ((tAnim * 6 * dpr) % (W * 1.5)) - W * .25; var ly = hy * .5 + Math.sin(tAnim * .4) * 7 * dpr; var u = dpr; var sway = Math.sin(tAnim * .7) * .05;
      g.save(); g.translate(lx, ly); g.rotate(sway);
      var env = g.createRadialGradient(-6 * u, -8 * u, 2 * u, 0, 0, 30 * u); env.addColorStop(0, '#ff8a7a'); env.addColorStop(.6, '#e8483f'); env.addColorStop(1, '#a52a2a');
      g.fillStyle = env; g.beginPath(); g.moveTo(0, -26 * u); g.bezierCurveTo(26 * u, -24 * u, 28 * u, 10 * u, 6 * u, 24 * u); g.lineTo(-6 * u, 24 * u); g.bezierCurveTo(-28 * u, 10 * u, -26 * u, -24 * u, 0, -26 * u); g.fill();
      g.save(); g.clip(); g.fillStyle = '#ffd966'; g.beginPath(); g.ellipse(0, 0, 8 * u, 30 * u, 0, 0, TAU); g.fill(); g.fillStyle = '#fff3d0'; g.beginPath(); g.ellipse(0, 0, 2.5 * u, 30 * u, 0, 0, TAU); g.fill(); g.fillStyle = 'rgba(255,255,255,.22)'; g.beginPath(); g.ellipse(-12 * u, -8 * u, 4 * u, 16 * u, .3, 0, TAU); g.fill(); g.restore();
      g.strokeStyle = 'rgba(60,40,30,.7)'; g.lineWidth = u; g.beginPath(); g.moveTo(-6 * u, 24 * u); g.lineTo(-4 * u, 34 * u); g.moveTo(6 * u, 24 * u); g.lineTo(4 * u, 34 * u); g.stroke();
      g.fillStyle = '#7a5230'; rr(-6 * u, 34 * u, 12 * u, 8 * u, 2 * u); g.fill(); g.fillStyle = '#5a3a20'; g.fillRect(-6 * u, 36 * u, 12 * u, 2 * u);
      glowDot(0, 27 * u, 9 * u, '#ffb347'); g.restore();
    }
    if (S.stars > .6) {
      var su = (tAnim % 16) / 16;
      if (su < .07) { var q = su / .07; var sx1 = W * (.2 + q * .5); var sy1 = hy * (.1 + q * .3); var sg = g.createLinearGradient(sx1, sy1, sx1 - 90 * dpr, sy1 - 45 * dpr); sg.addColorStop(0, 'rgba(255,255,255,' + (1 - q) + ')'); sg.addColorStop(1, 'rgba(255,255,255,0)'); g.strokeStyle = sg; g.lineWidth = 2 * dpr; g.beginPath(); g.moveTo(sx1, sy1); g.lineTo(sx1 - 90 * dpr, sy1 - 45 * dpr); g.stroke(); }
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
    // ridges and the far skyline sit on the hill-shifted horizon
    var far = xoAt(DRAW * .8) * .12; var hySaved = hy; hy = hyR;
    for (var L = 0; L < 3; L++) {
      var amp = H * (.05 + L * .012); var base = hy - H * .008 * (2 - L);
      var rgr = g.createLinearGradient(0, base - amp * 1.1, 0, hy + 6); rgr.addColorStop(0, S.ridge[L]); rgr.addColorStop(.7, S.ridge[L]); rgr.addColorStop(1, mix(S.ridge[L], mix(S.ground[0], S.fog, .55), .92));
      g.fillStyle = rgr; g.beginPath(); g.moveTo(0, hy + 6);
      for (var xx = 0; xx <= W; xx += 8 * dpr) {
        var q = xx / dpr - far * 40 * (.3 + L * .4) + dist * .01 * (L + 1);
        g.lineTo(xx, base - amp * (.5 + .5 * Math.sin(q * .011 + L * 2)) - amp * .4 * Math.sin(q * .027 + L * 5));
      }
      g.lineTo(W, hy + 6); g.fill();
      var mg = g.createLinearGradient(0, base - amp * 1.4, 0, hy + 10); mg.addColorStop(0, 'rgba(255,255,255,0)'); mg.addColorStop(.55, mix(S.fog, '#ffffff', .1) + Math.round(S.mist * (.38 - L * .08) * 255).toString(16).padStart(2, '0')); mg.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = mg; g.fillRect(0, base - amp * 1.4, W, hy + 10 - (base - amp * 1.4));
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
    hy = hySaved;
  }

  function drawWater(S) {
    var n = rows.length; if (n < 3) return;
    g.save(); g.globalAlpha = clamp(S.water, 0, 1);
    var gw = g.createLinearGradient(0, rows[n - 1].y, 0, H); gw.addColorStop(0, '#8fd0ec'); gw.addColorStop(1, '#2a7fb4');
    g.fillStyle = gw;
    [-1, 1].forEach(function (sd) {
      g.beginPath(); g.moveTo(sd < 0 ? 0 : W, rows[0].y);
      for (var i = 0; i < n; i++) g.lineTo(rows[i].ct + sd * rows[i].hw * 1.9, rows[i].y);
      g.lineTo(sd < 0 ? 0 : W, rows[n - 1].y); g.closePath(); g.fill();
    });
    g.strokeStyle = 'rgba(255,255,255,' + (.45 + .15 * Math.sin(tAnim * 1.3)) + ')'; g.lineWidth = 2 * dpr;
    [-1, 1].forEach(function (sd) {
      g.beginPath();
      for (var j = 0; j < n; j++) { var r = rows[j]; if (j === 0) g.moveTo(r.ct + sd * r.hw * 1.9, r.y); else g.lineTo(r.ct + sd * r.hw * 1.9, r.y); }
      g.stroke();
    });
    for (var wv = 0; wv < 16; wv++) {
      var wd = (((wv * 19 - tAnim * 6) % 300) + 300) % 300 + 2; var rw = rowAt(wd);
      var wa = clamp(rw.p * 1.7, 0, .6) * clamp(S.water, 0, 1) * (1 - wd / 320);
      [-1, 1].forEach(function (sd) {
        var x0 = rw.ct + sd * rw.hw * 1.9; var x1 = sd < 0 ? 0 : W;
        g.strokeStyle = 'rgba(255,255,255,' + wa + ')'; g.lineWidth = Math.max(1, 2.4 * rw.p * dpr); g.beginPath(); g.moveTo(x0, rw.y);
        for (var si = 1; si <= 10; si++) g.lineTo(x0 + (x1 - x0) * si / 10, rw.y + Math.sin(tAnim * 1.3 + si * 1.2 + wv) * rw.p * 3.5 * dpr);
        g.stroke();
      });
    }
    g.fillStyle = S.sunC;
    for (var q = 0; q < 26; q++) {
      var rj = rows[Math.floor(rnd(q, 61) * (n - 1) * .85)]; var gx = rj.ct + (q % 2 ? 1 : -1) * rj.hw * (2.1 + rnd(q, 62) * 5);
      g.globalAlpha = clamp(S.water, 0, 1) * (.15 + .5 * Math.max(0, Math.sin(tAnim * 1.2 + q * 1.9)));
      g.beginPath(); g.ellipse(gx, rj.y, (4 + rnd(q, 63) * 8) * rj.p * dpr + 1, Math.max(.6, rj.p * 1.6 * dpr), 0, 0, TAU); g.fill();
    }
    g.globalAlpha = clamp(S.water, 0, 1);
    var bx = W * (.2 + .06 * Math.sin(tAnim * .05)); var by = rows[n - 1].y + H * .03; // a sailboat
    g.fillStyle = '#f4efe6'; g.beginPath(); g.moveTo(bx, by - 26 * dpr); g.lineTo(bx + 12 * dpr, by - 3 * dpr); g.lineTo(bx, by - 3 * dpr); g.fill();
    g.fillStyle = '#c0392b'; g.beginPath(); g.moveTo(bx - 14 * dpr, by - 2 * dpr); g.lineTo(bx + 14 * dpr, by - 2 * dpr); g.lineTo(bx + 9 * dpr, by + 3 * dpr); g.lineTo(bx - 9 * dpr, by + 3 * dpr); g.fill();
    g.restore();
  }

  function drawGround(S) {
    var top = Math.min(hyR, rows.length ? rows[rows.length - 1].y : hy);
    var gg = g.createLinearGradient(0, top, 0, H);
    gg.addColorStop(0, mix(S.ground[0], S.fog, .55)); gg.addColorStop(.12, mix(S.ground[0], S.fog, .3)); gg.addColorStop(1, S.ground[1]);
    g.fillStyle = gg; g.fillRect(0, top, W, H - top);
    if (S.water > .03) drawWater(S);
  }

  // The road is drawn as smooth filled shapes (not thin slices), so its edges are anti-aliased
  // and nothing flickers as it scrolls.
  function drawRoad(S) {
    var n = rows.length; if (n < 3) return;
    var rg = g.createLinearGradient(0, rows[n - 1].y, 0, H); rg.addColorStop(0, mix(S.road, S.fog, .55)); rg.addColorStop(1, S.road);
    g.fillStyle = rg; g.beginPath(); g.moveTo(rows[0].ct - rows[0].hw, rows[0].y);
    var i;
    for (i = 1; i < n; i++) g.lineTo(rows[i].ct - rows[i].hw, rows[i].y);
    for (i = n - 1; i >= 0; i--) g.lineTo(rows[i].ct + rows[i].hw, rows[i].y);
    g.closePath(); g.fill();
    g.fillStyle = S.edge;
    [-1, 1].forEach(function (sd) {
      g.beginPath(); g.moveTo(rows[0].ct + sd * rows[0].hw, rows[0].y);
      for (var a = 1; a < n; a++) g.lineTo(rows[a].ct + sd * rows[a].hw, rows[a].y);
      for (var b = n - 1; b >= 0; b--) g.lineTo(rows[b].ct + sd * rows[b].hw * .955, rows[b].y);
      g.closePath(); g.fill();
    });
    // lane dashes: each dash is one smooth shape that follows the curve and the hill
    var LEN = 7; var PER = 16; g.fillStyle = S.line;
    for (var side = -1; side <= 1; side += 2) {
      g.beginPath();
      for (var m = Math.floor(dist / PER); m * PER < dist + DRAW; m++) {
        var s0 = m * PER - dist; var s1 = s0 + LEN; if (s1 < 0) continue; s0 = Math.max(s0, -.4); if (s0 > DRAW) break; s1 = Math.min(s1, DRAW);
        var L = []; var R = [];
        for (var j = 0; j <= 6; j++) { var dd = s0 + (s1 - s0) * j / 6; var rw = rowAt(dd); var lw = rw.hw * .02; var c = rw.ct + side * rw.hw / 3; L.push([c - lw, rw.y]); R.push([c + lw, rw.y]); }
        g.moveTo(L[0][0], L[0][1]); for (var k = 1; k <= 6; k++) g.lineTo(L[k][0], L[k][1]); for (var k2 = 6; k2 >= 0; k2--) g.lineTo(R[k2][0], R[k2][1]); g.closePath();
      }
      g.fill();
    }
    if (S.rain > .1) {
      g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = .18 * S.rain;
      var cols = ['#ff4fd8', '#35e6ff', '#ffe066'];
      for (var q = 0; q < 8; q++) {
        var kk = (rnd(q, 9) * 2 - 1) * .9; var rg2 = g.createLinearGradient(0, rows[n - 1].y, 0, H); rg2.addColorStop(0, cols[q % 3]); rg2.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = rg2; g.fillRect(cx + kk * RH * .5 - 3 * dpr, rows[n - 1].y + (H - rows[n - 1].y) * .05, (6 + rnd(q, 3) * 14) * dpr, (H - rows[n - 1].y) * .9);
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
    var MS = 55;
    for (var mn = Math.floor((dist + 10) / MS); mn <= Math.floor((dist + DRAW) / MS); mn++) {
      for (var ms = -1; ms <= 1; ms += 2) {
        var mk = mn * 2 + (ms > 0 ? 1 : 0) + 500; if (rnd(mk, 51) < .3) continue;
        var md = mn * MS + rnd(mk, 52) * 30 - dist; if (md < 10 || md > DRAW) continue;
        items.push({ d: md, mound: true, lat: ms * (2.4 + rnd(mk, 53) * 3.5), size: 80 + rnd(mk, 54) * 160, k: mk });
      }
    }
    var cn; var ci;
    for (cn = Math.floor(dist / 90); cn <= Math.floor((dist + DRAW) / 90); cn++) {
      var ck = coinChunk(cn); if (!ck || nearStop(ck.start)) continue;
      for (ci = 0; ci < ck.count; ci++) { var cd = ck.start + ci * 7 - dist; var cid = cn * 10 + ci; if (cd > 3 && cd < DRAW && !collected[cid]) items.push({ d: cd, coin: true, lat: ck.lane / 1.7, k: cid }); }
    }
    for (var hn = Math.floor(dist / 600); hn <= Math.floor((dist + DRAW) / 600); hn++) {
      var hk = heartChunk(hn); if (!hk || nearStop(hk.at) || collected['h' + hn]) continue;
      var hd = hk.at - dist; if (hd > 3 && hd < DRAW) items.push({ d: hd, heart: true, lat: hk.lane / 1.7, k: hn });
    }
    if (tripMode === 'journey') {
      REST_STOPS.concat([JOURNEY_CHAPTERS]).forEach(function (cl, i) { var ad = cl * chapterLen - dist; if (ad > 2 && ad < DRAW) items.push({ d: ad, arch: true, finish: i === REST_STOPS.length }); });
    }
    traffic.forEach(function (c) { var d = c.z - dist; if (d > 1 && d < DRAW) items.push({ d: d, car: c }); });
    items.sort(function (a, b) { return b.d - a.d; });
    var rockC = mix(S.ground[1], '#7a6a5a', .5);
    var S2 = { night: S.night, rockC: rockC };
    items.forEach(function (it) {
      var rw = rowAt(it.d); var p = rw.p; var y = rw.y;
      if (it.arch) {
        var as = p * (W / 230) * 1.35; var ac = xoAt(it.d); var ax0 = cx + (ac - 1.12 - camX) * p * RH; var ax1 = cx + (ac + 1.12 - camX) * p * RH; var ah = 96 * as;
        g.fillStyle = '#2a3350'; g.fillRect(ax0 - 4 * as, y - ah, 8 * as, ah); g.fillRect(ax1 - 4 * as, y - ah, 8 * as, ah);
        g.fillStyle = it.finish ? '#f4f1ea' : '#1f2a44'; g.fillRect(ax0 - 6 * as, y - ah - 22 * as, ax1 - ax0 + 12 * as, 24 * as);
        if (it.finish) { g.fillStyle = '#111'; var sq = 8 * as; for (var qx = 0; qx * sq < ax1 - ax0 + 12 * as; qx++) for (var qy = 0; qy < 3; qy++) if ((qx + qy) % 2 === 0) g.fillRect(ax0 - 6 * as + qx * sq, y - ah - 22 * as + qy * sq, sq, sq); }
        else { g.fillStyle = '#ffd166'; g.font = '800 ' + (13 * as) + 'px system-ui, sans-serif'; g.textAlign = 'center'; g.fillText('REST STOP', (ax0 + ax1) / 2, y - ah - 5 * as); }
        if (S.night > .4) { glowDot(ax0, y - ah - 10 * as, 22 * as, '#ffd98a'); glowDot(ax1, y - ah - 10 * as, 22 * as, '#ffd98a'); }
        return;
      }
      if (it.heart) {
        var hx = cx + (xoAt(it.d) + it.lat - camX) * p * RH; var hs = p * (W / 230) * 1.35; var hy2 = y - (16 + Math.sin(tAnim * 3) * 2) * hs;
        glowDot(hx, hy2, 24 * hs, '#ff6b8a'); g.fillStyle = '#ff4d73'; g.beginPath(); g.moveTo(hx, hy2 + 9 * hs); g.bezierCurveTo(hx - 16 * hs, hy2 - 2 * hs, hx - 9 * hs, hy2 - 14 * hs, hx, hy2 - 6 * hs); g.bezierCurveTo(hx + 9 * hs, hy2 - 14 * hs, hx + 16 * hs, hy2 - 2 * hs, hx, hy2 + 9 * hs); g.fill();
        g.fillStyle = 'rgba(255,255,255,.4)'; g.beginPath(); g.ellipse(hx - 5 * hs, hy2 - 5 * hs, 2.5 * hs, 1.6 * hs, -.6, 0, TAU); g.fill();
        return;
      }
      if (it.coin) {
        var kx = cx + (xoAt(it.d) + it.lat - camX) * p * RH; var cs = p * (W / 230) * 1.35; var cr = 8 * cs; var cw = Math.max(.15, Math.abs(Math.cos(tAnim * 3 + it.k * .6))) * cr; var cy = y - 14 * cs;
        glowDot(kx, cy, cr * 2.2, '#ffd166');
        var cg = g.createLinearGradient(kx - cw, cy - cr, kx + cw, cy + cr); cg.addColorStop(0, '#fff2a8'); cg.addColorStop(.5, '#ffc933'); cg.addColorStop(1, '#c98a10');
        g.fillStyle = cg; g.beginPath(); g.ellipse(kx, cy, cw, cr, 0, 0, TAU); g.fill(); g.strokeStyle = '#b87a0c'; g.lineWidth = Math.max(1, cs * .8); g.stroke();
        return;
      }
      if (it.mound) {
        var mx = cx + (xoAt(it.d) + it.lat - camX) * p * RH; var mw = it.size * p * (W / 230) * 1.35; var mh = mw * (.26 + rnd(it.k, 55) * .16);
        var mg = g.createLinearGradient(0, y - mh, 0, y); var fogT = clamp((1 - p) * .5, 0, .5);
        mg.addColorStop(0, mix(mix(S.ground[0], '#ffffff', .07), S.fog, fogT)); mg.addColorStop(1, mix(S.ground[0], S.fog, fogT));
        g.fillStyle = mg; g.beginPath(); g.ellipse(mx, y, mw, mh, 0, Math.PI, 0); g.fill();
        return;
      }
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
    var py = H * .875; var pw = W * .44; var tilt = clamp((laneTarget - lane) * .12, -.14, .14);
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
    if (shieldT > 0) {
      var sa = shieldT < .8 ? (Math.sin(tAnim * 30) > 0 ? .5 : .15) : .45;
      g.save(); g.translate(x, py - pw * .18); g.globalAlpha = sa;
      var sgr = g.createRadialGradient(0, 0, pw * .1, 0, 0, pw * .62); sgr.addColorStop(0, 'rgba(120,220,255,0)'); sgr.addColorStop(1, 'rgba(120,220,255,.9)');
      g.fillStyle = sgr; g.beginPath(); g.ellipse(0, 0, pw * .62, pw * .45, 0, 0, TAU); g.fill(); g.restore();
    }
  }

  function drawWeather(S) {
    if (lightningT > 0) {
      var la = lightningT / .4;
      g.fillStyle = 'rgba(235,242,255,' + (.45 * la * (Math.sin(lightningT * 60) > -.3 ? 1 : .4)) + ')'; g.fillRect(0, 0, W, H);
      g.strokeStyle = 'rgba(245,248,255,' + la + ')'; g.lineWidth = 3 * dpr; g.beginPath(); var bx0 = W * (.3 + rnd(Math.floor(tAnim), 91) * .4); g.moveTo(bx0, 0);
      for (var bi = 1; bi < 8; bi++) g.lineTo(bx0 + (rnd(bi + Math.floor(tAnim), 92) - .5) * 60 * dpr, bi * hy / 8); g.stroke();
    }
    if (flashT > 0 && mode === 'run') { g.fillStyle = 'rgba(255,60,60,' + (.28 * flashT / .35) + ')'; g.fillRect(0, 0, W, H); }
    if (S.rain > .05) {
      g.strokeStyle = 'rgba(200,225,255,' + (.34 * S.rain) + ')'; g.lineWidth = 1.5 * dpr;
      var n = Math.round(90 * S.rain);
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
    if (S.night > .25 && S.rain < .3 && S.snow < .3) { // fireflies
      for (var ff = 0; ff < 16; ff++) {
        var fx = rnd(ff, 1) * W + Math.sin(tAnim * .6 + ff) * 30 * dpr; var fy = hy + (H - hy) * (.25 + rnd(ff, 2) * .45) + Math.cos(tAnim * .5 + ff) * 20 * dpr;
        g.globalAlpha = clamp(S.night, 0, 1) * (.35 + .5 * Math.max(0, Math.sin(tAnim * 1.3 + ff * 2))); glowDot(fx, fy, 9 * dpr, '#d8ff7a');
      }
      g.globalAlpha = 1;
    }
    // fog band at the horizon
    var fg = g.createLinearGradient(0, hy - H * .05, 0, hy + H * .26);
    fg.addColorStop(0, S.fog + '00'); fg.addColorStop(.3, S.fog + 'ff'); fg.addColorStop(1, S.fog + '00');
    g.globalAlpha = .5 + S.mist * .2; g.fillStyle = fg; g.fillRect(0, hyR - H * .06, W, H * .34); g.globalAlpha = 1;
    // speed lines
    if (mode === 'run' && speed > 82) {
      g.save(); g.strokeStyle = 'rgba(255,255,255,' + clamp((speed - 82) / 120, 0, .1) + ')'; g.lineWidth = 1.5 * dpr;
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
    hy = H * .4 + Math.sin(tAnim * .9) * 1.2 * dpr; cx = W / 2; RH = W * .9; camX = lane / 1.7 * .5;
    ES = H * .02; e0 = elev(dist);
    buildCurve();
    hyR = hy - (elev(dist + DRAW * .8) - e0) * pOf(DRAW * .8) * ES * .7;
    buildRows();
    var S = sceneAt(dist);
    g.save();
    if (shake > 0) g.translate((Math.random() - .5) * shake * dpr, (Math.random() - .5) * shake * dpr);
    drawSky(S); drawGround(S); drawRoad(S); drawWorld(S); drawPlayer(S); drawWeather(S); drawParticles();
    g.restore();
    return S;
  }

  // ---------- audio ----------
  var A = window.RacerAudio ? window.RacerAudio.create({
    AudioContext: window.AudioContext || window.webkitAudioContext,
    vibrate: window.navigator.vibrate ? window.navigator.vibrate.bind(window.navigator) : null,
    setInterval: window.setInterval.bind(window), clearInterval: window.clearInterval.bind(window)
  }) : null;
  function au(fn, a, b) { if (A && typeof A[fn] === 'function') { try { return A[fn](a, b); } catch (e) { return undefined; } } return undefined; }
  function audioPrefs() {
    au('setPrefs', {
      music: prefs.music === 'on', sfx: prefs.sfx === 'on', style: prefs.style, volMusic: prefs.volMusic / 100, volFx: prefs.volFx / 100, bass: prefs.bass / 100,
      calm: prefs.calm === 'on', sound: appChoice('sound') === 'on', haptics: appChoice('haptics') === 'on'
    });
  }
  audioPrefs();

  // ---------- HUD ----------
  var elDist = $('dist'); var elSpd = $('spd'); var elNear = $('near'); var elHearts = $('hearts'); var elCoins = $('coinc');
  var elChapter = $('chapter'); var elChNum = $('ch-num'); var elChName = $('ch-name'); var elTrip = $('trip'); var elFill = $('trip-fill'); var elDots = $('trip-dots');
  var cache = {};
  function setText(el, key, v) { if (cache[key] !== v) { cache[key] = v; el.textContent = v; } }
  function hearts() { var s = ''; var i; for (i = 0; i < lives; i++) s += '♥'; for (i = lives; i < maxLives; i++) s += '♡'; return s; }
  function hud() {
    setText(elDist, 'd', String(Math.floor(score)));
    setText(elSpd, 's', String(Math.round(speed * 3.6)));
    setText(elHearts, 'h', hearts());
    setText(elCoins, 'c', '● ' + run.coins);
    var showTrip = tripMode === 'journey' && mode === 'run';
    elTrip.hidden = !showTrip;
    if (showTrip) elFill.style.width = clamp(dist / (JOURNEY_CHAPTERS * chapterLen) * 100, 0, 100).toFixed(1) + '%';
  }
  function buildTrip() {
    elDots.textContent = '';
    var total = JOURNEY_CHAPTERS * chapterLen;
    REST_STOPS.concat([JOURNEY_CHAPTERS]).forEach(function (cl, i) {
      var d = document.createElement('i'); d.className = i === REST_STOPS.length ? 'f' : 'r'; d.style.left = (cl * chapterLen / total * 100) + '%'; elDots.appendChild(d);
    });
  }
  function showChapter(num, name) { elChNum.textContent = num; elChName.textContent = name; elChapter.classList.add('show'); chTimer = 3.2; }
  function showNear(text) { elNear.textContent = text; elNear.classList.add('show'); nearTimer = .9; }

  // ---------- results, stats and checkpoints ----------
  function endRun(finished) {
    stats.runs += 1; stats.near += run.near; stats.nearBest = Math.max(stats.nearBest, run.comboMax || 0); stats.coins += run.coins;
    stats.maxChapter = Math.max(stats.maxChapter, chapterAt(dist).i); stats.bestDistance = Math.max(stats.bestDistance, Math.floor(dist));
    if (finished) { stats.journeys += 1; if (run.hits === 0) stats.noHitJourneys += 1; }
    saveStats();
  }
  function clearCheckpoint() { try { window.localStorage.removeItem(CHECK_KEY); } catch (e) { /* fine */ } }
  function saveCheckpoint(chapter) { writeJson(CHECK_KEY, { v: 1, mode: 'journey', difficulty: prefs.difficulty, length: prefs.length, chapter: chapter, lives: lives, score: Math.floor(score) }); }

  var ovTitle = $('ov-title'); var ovSub = $('ov-sub'); var ovStats = $('ov-stats'); var optsBox = $('opts'); var playBtn = $('play'); var contBtn = $('cont');
  function showOverlay(kind, o) {
    o = o || {};
    ovTitle.textContent = o.title || 'Racer'; ovSub.textContent = o.sub || '';
    ovStats.textContent = '';
    (o.stats || []).forEach(function (r) { var d = document.createElement('div'); var a = document.createElement('span'); a.textContent = r[0]; var b = document.createElement('b'); b.textContent = r[1]; d.appendChild(a); d.appendChild(b); ovStats.appendChild(d); });
    ovStats.hidden = !(o.stats && o.stats.length);
    optsBox.hidden = kind !== 'menu';
    playBtn.textContent = kind === 'menu' ? 'Play' : 'Play again';
    var cp = tripMode === 'journey' || kind === 'menu' ? getCheckpoint() : null;
    contBtn.hidden = !cp; if (cp) contBtn.textContent = 'Continue: chapter ' + (cp.chapter + 1) + '  ' + new Array(cp.lives + 1).join('♥');
    $('ov').setAttribute('data-kind', kind); $('ov').hidden = false;
    $('menu-btn').hidden = kind === 'menu';
  }
  function gameOver() {
    mode = 'over'; speed = 0; shake = 18; flashT = .5; braking = false;
    burst(cx, H * .8, 40, ['#ffb347', '#ff6b4a', '#ffd166', '#888']);
    au('event', 'crash'); au('stop');
    endRun(false);
    var s = Math.floor(score); var isBest = submitBest(s);
    window.setTimeout(function () {
      if (mode !== 'over') return;
      showOverlay('over', { title: 'Crash', sub: isBest ? 'New best!' : 'Best ' + getBest(), stats: [['Distance', Math.floor(dist) + ' m'], ['Score', String(s)], ['Coins', String(run.coins)], ['Close calls', String(run.near)]] });
    }, 700);
  }
  function finishJourney() {
    mode = 'done'; braking = false; score += lives * 100; flashT = 0;
    au('event', 'finish'); au('stop');
    endRun(true); clearCheckpoint();
    var s = Math.floor(score); var isBest = submitBest(s);
    burst(cx, H * .5, 50, ['#ffd166', '#ff9ab0', '#9fe9ff', '#fff']);
    window.setTimeout(function () {
      if (mode !== 'done') return;
      showOverlay('done', { title: 'You made it', sub: (isBest ? 'New best. ' : '') + 'Sunrise Coast reached.', stats: [['Distance', Math.floor(dist) + ' m'], ['Score', String(s)], ['Lives left', hearts()], ['Coins', String(run.coins)], ['Close calls', String(run.near)], ['Bumps', String(run.hits)]] });
    }, 1400);
  }
  function bump() {
    run.hits += 1; lives -= 1; combo = 0; comboTimer = 0;
    if (lives <= 0) { gameOver(); return; }
    shieldT = DIFFS[prefs.difficulty].shield; shake = 12; flashT = .35;
    traffic = traffic.filter(function (c) { var d = c.z - dist; return d > 90 || d < -12; }); // the road ahead clears so you can recover
    nextSpawn = Math.max(nextSpawn, dist + 120);
    burst(cx, H * .8, 14, ['#ffb347', '#ffd166']);
    au('event', 'bump');
  }

  // ---------- loop ----------
  var last = null; var lastScene = null; var sceneTick = 0;
  function burst(x, y, n, cols) {
    for (var i = 0; i < n; i++) { var a = Math.random() * TAU; var v = 40 + Math.random() * 220; particles.push({ x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, life: 1, r: 2 + Math.random() * 3, c: cols[i % cols.length] }); }
  }
  function step(dt) {
    if (paused) return;
    tAnim += dt;
    particles.forEach(function (p) { p.x += p.vx * dt * dpr; p.y += p.vy * dt * dpr; p.vy += 300 * dt; p.life -= dt * 1.4; });
    particles = particles.filter(function (p) { return p.life > 0; });
    if (shake > 0) shake = Math.max(0, shake - dt * 40);
    if (flashT > 0) flashT = Math.max(0, flashT - dt);
    if (lightningT > 0) lightningT = Math.max(0, lightningT - dt);
    if (chTimer > 0) { chTimer -= dt; if (chTimer <= 0) elChapter.classList.remove('show'); }
    if (nearTimer > 0) { nearTimer -= dt; if (nearTimer <= 0) elNear.classList.remove('show'); }
    lane += (laneTarget - lane) * Math.min(1, dt * 11);
    if (lastScene && lastScene.lightning > .5 && lightningT <= 0 && Math.random() < dt * .16) { lightningT = .4; au('event', 'thunder'); }
    if (mode === 'menu') { dist += 20 * dt; return; }
    if (mode !== 'run') return;
    shieldT = Math.max(0, shieldT - dt);
    speed += (targetSpeed(dist) * (braking ? .55 : 1) - speed) * Math.min(1, dt * (braking ? 1.6 : .8));
    dist += speed * dt; score += speed * dt * .1;
    if (comboTimer > 0) { comboTimer -= dt; if (comboTimer <= 0) combo = 0; }
    var c0 = chapterAt(dist);
    if (tripMode === 'journey' && c0.i >= JOURNEY_CHAPTERS) { finishJourney(); return; }
    if (c0.i !== lastChapter) { lastChapter = c0.i; showChapter('Chapter ' + (c0.i + 1), CHAPTERS[c0.idx].name); au('setChapter', c0.idx); if (c0.i > 0) au('event', 'chapter'); }
    if (tripMode === 'journey' && nextStop < REST_STOPS.length && dist >= REST_STOPS[nextStop] * chapterLen) {
      var cpCh = REST_STOPS[nextStop]; nextStop++;
      if (lives < maxLives) lives++;
      saveCheckpoint(cpCh); showChapter('Rest stop', 'Heart restored'); au('event', 'rest');
    }
    var diff = DIFFS[prefs.difficulty];
    while (nextSpawn < dist + DRAW) {
      if (!nearStop(nextSpawn)) spawnWave(nextSpawn);
      nextSpawn += diff.gapMin + rand() * diff.gapRand - Math.min(25, dist * .002); if (chapterAt(nextSpawn).frac < .08) nextSpawn += 50;
    }
    // pickups
    var cn;
    for (cn = Math.floor((dist - 4) / 90); cn <= Math.floor((dist + 6) / 90); cn++) {
      var ck = coinChunk(cn); if (!ck || nearStop(ck.start)) continue;
      for (var ci = 0; ci < ck.count; ci++) {
        var id = cn * 10 + ci; if (collected[id]) continue;
        var cd = ck.start + ci * 7 - dist;
        if (cd < 2.6 && cd > -2.6 && Math.abs(lane - ck.lane) < .75) {
          collected[id] = true; run.coins += 1; score += 2;
          coinNote = tAnim - coinNoteT < 1.6 ? coinNote + 1 : 0; coinNoteT = tAnim; au('event', 'coin', { i: coinNote });
        }
      }
    }
    var hn = Math.floor((dist + 2) / 600); var hk = heartChunk(hn);
    if (hk && !nearStop(hk.at) && !collected['h' + hn]) {
      var hd = hk.at - dist;
      if (hd < 2.8 && hd > -2.8 && Math.abs(lane - hk.lane) < .75) { collected['h' + hn] = true; if (lives < maxLives) { lives++; au('event', 'heart'); } else { score += 25; au('event', 'coin', { i: 6 }); } }
    }
    for (var i = 0; i < traffic.length; i++) {
      var c = traffic[i]; c.z += c.v * dt; var d = c.z - dist; var gap = Math.abs(lane - c.lane);
      if (Math.abs(d) < 8) c.minGap = Math.min(c.minGap, gap);
      if (!c.whoosh && d < 16 && d > 0) { c.whoosh = true; au('event', 'pass', { side: c.lane - lane, v: speed }); }
      if (d < 4.6 && d > -4.6 && gap < .66 && shieldT <= 0) { bump(); if (mode !== 'run') return; break; }
      if (!c.passed && d < -4.6) {
        c.passed = true;
        if (c.minGap < 1.35) {
          combo += 1; comboTimer = 3; run.near += 1; run.comboMax = Math.max(run.comboMax || 0, combo); score += 5 * combo;
          showNear(combo > 1 ? 'CLOSE  x' + combo : 'CLOSE'); au('event', 'near', { combo: combo });
        }
      }
    }
    traffic = traffic.filter(function (c) { return c.z > dist - 30; });
    au('setSpeed', speed); au('setIntensity', clamp((speed - 30) / 60 + combo * .12 + (shieldT > 0 ? .1 : 0), 0, 1)); au('setBrake', braking);
    sceneTick = (sceneTick + 1) % 8;
    if (sceneTick === 0 && lastScene) au('setScene', { water: lastScene.water, rain: lastScene.rain, night: lastScene.night, snow: lastScene.snow, wind: lastScene.wind, heat: lastScene.heat, bed: lastScene.a.bed, nextBed: lastScene.b.bed, t: lastScene.t, life: lastScene.a.life, idx: c0.idx });
    hud();
  }
  function frame(t) {
    if (last === null) last = t;
    var dt = Math.min(.05, (t - last) / 1000); last = t;
    step(dt); lastScene = render();
    window.requestAnimationFrame(frame);
  }

  // ---------- starting, pausing and the menu ----------
  function start(fromCheckpoint) {
    if (fromCheckpoint) { prefs.mode = 'journey'; prefs.difficulty = fromCheckpoint.difficulty; prefs.length = fromCheckpoint.length; savePrefs(); }
    reset(fromCheckpoint); mode = 'run'; $('ov').hidden = true; $('ps').hidden = true; $('ss').hidden = true;
    buildTrip(); au('unlock'); audioPrefs(); au('setChapter', chapterAt(dist).idx); au('start'); hud();
  }
  function backToMenu() {
    mode = 'menu'; paused = false; applyTrip(); dist = 0; lastChapter = -1; traffic = []; speed = 0; shieldT = 0; flashT = 0; lives = maxLives; run = { near: 0, coins: 0, hits: 0 }; combo = 0;
    au('stop'); $('ps').hidden = true; $('ss').hidden = true; elChapter.classList.remove('show'); elNear.classList.remove('show');
    showOverlay('menu', { title: 'Racer', sub: 'Swipe left or right to change lane. Pass close to traffic for combos.' }); renderOpts(); hud();
  }
  function pauseGame() { if (mode !== 'run' || paused) return; paused = true; braking = false; au('pause'); $('ps').hidden = false; $('ps-resume').focus(); }
  function resumeGame() { if (!paused) return; paused = false; $('ps').hidden = true; $('ss').hidden = true; au('resume'); last = null; }
  function openSound(from) { $('ss').hidden = false; $('ss').setAttribute('data-from', from); $('ss-close').focus(); }
  function closeSound() { $('ss').hidden = true; if (paused) $('ps-resume').focus(); }

  function renderOpts() {
    Array.prototype.forEach.call(document.querySelectorAll('.opt'), function (row) {
      var name = row.getAttribute('data-opt');
      Array.prototype.forEach.call(row.querySelectorAll('button'), function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-val') === String(prefs[name]))); });
    });
    $('opt-length').hidden = prefs.mode !== 'journey';
    $('best-line').textContent = 'Best in this mode: ' + getBest();
    var vm = $('vol-music'); var vf = $('vol-fx'); var vb = $('vol-bass'); vm.value = prefs.volMusic; vf.value = prefs.volFx; vb.value = prefs.bass;
    var cp = getCheckpoint(); contBtn.hidden = !cp || $('ov').getAttribute('data-kind') !== 'menu'; if (cp) contBtn.textContent = 'Continue: chapter ' + (cp.chapter + 1) + '  ' + new Array(cp.lives + 1).join('♥');
  }
  Array.prototype.forEach.call(document.querySelectorAll('.opt button'), function (b) {
    b.addEventListener('click', function () {
      var name = b.closest('.opt').getAttribute('data-opt'); var v = b.getAttribute('data-val');
      prefs[name] = v; savePrefs(); applyTrip(); renderOpts(); audioPrefs(); au('unlock');
    });
  });
  [['vol-music', 'volMusic'], ['vol-fx', 'volFx'], ['vol-bass', 'bass']].forEach(function (p) {
    $(p[0]).addEventListener('input', function () { prefs[p[1]] = parseInt($(p[0]).value, 10); savePrefs(); audioPrefs(); });
  });

  // ---------- input ----------
  function go(dir) {
    if (mode !== 'run' || paused) return;
    var before = laneTarget; laneTarget = clamp(laneTarget + dir, -1, 1);
    if (before !== laneTarget) { au('unlock'); au('event', 'lane', { dir: dir }); }
  }
  playBtn.addEventListener('click', function () { start(null); });
  contBtn.addEventListener('click', function () { var cp = getCheckpoint(); if (cp) start(cp); });
  $('menu-btn').addEventListener('click', backToMenu);
  $('pause').addEventListener('click', function () { if (paused) resumeGame(); else pauseGame(); });
  $('ps-resume').addEventListener('click', resumeGame);
  $('ps-restart').addEventListener('click', function () { start(null); });
  $('ps-sound').addEventListener('click', function () { openSound('pause'); });
  $('sound-btn').addEventListener('click', function () { openSound('menu'); });
  $('ss-close').addEventListener('click', closeSound);
  var brake = $('brake');
  function brakeOn(e) { braking = true; brake.setAttribute('aria-pressed', 'true'); if (e && e.pointerId !== undefined) { try { brake.setPointerCapture(e.pointerId); } catch (x) { /* fine */ } } }
  function brakeOff() { braking = false; brake.setAttribute('aria-pressed', 'false'); }
  brake.addEventListener('pointerdown', brakeOn); brake.addEventListener('pointerup', brakeOff); brake.addEventListener('pointercancel', brakeOff); brake.addEventListener('lostpointercapture', brakeOff);
  document.addEventListener('keydown', function (e) {
    var k = e.key;
    if (k === 'ArrowLeft' || k === 'a') { go(-1); e.preventDefault(); }
    else if (k === 'ArrowRight' || k === 'd') { go(1); e.preventDefault(); }
    else if (k === 'ArrowDown' || k === 's') { if (mode === 'run' && !paused) braking = true; e.preventDefault(); }
    else if (k === 'p' || k === 'Escape') { if (!$('ss').hidden) closeSound(); else if (paused) resumeGame(); else pauseGame(); }
    else if (k === 'Enter' && !$('ov').hidden && document.activeElement && document.activeElement.tagName !== 'BUTTON') { start(null); e.preventDefault(); }
  });
  document.addEventListener('keyup', function (e) { if (e.key === 'ArrowDown' || e.key === 's') braking = false; });
  var stage = $('stage'); var sw0 = null;
  stage.addEventListener('pointerdown', function (e) { if (e.target.closest('button,a,input,.sheet,.overlay')) return; sw0 = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false }; });
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
  document.addEventListener('visibilitychange', function () { last = null; if (document.hidden) pauseGame(); });
  window.addEventListener('resize', render);
  window.addEventListener('storage', function () { audioPrefs(); });

  // ---------- init ----------
  applyTrip(); reset(null); showOverlay('menu', { title: 'Racer', sub: 'Swipe left or right to change lane. Pass close to traffic for combos.' }); renderOpts(); hud();
  if (DEBUG) {
    // test and gallery hook: draw a still frame at a distance with demo traffic, and drive the game
    window.racerDebug = {
      state: function () { return { paused: paused, braking: braking, prefs: JSON.parse(JSON.stringify(prefs)), mode: mode, dist: dist, speed: speed, lane: lane, laneTarget: laneTarget, combo: combo, score: score, lives: lives, maxLives: maxLives, shield: shieldT, coins: run.coins, hits: run.hits, traffic: traffic.length, chapter: chapterAt(dist).i, chapterLen: chapterLen, tripMode: tripMode, nextStop: nextStop, checkpoint: getCheckpoint(), stats: JSON.parse(JSON.stringify(stats)) }; },
      still: function (d, t, laneV, withTraffic) {
        mode = 'menu'; dist = d; tAnim = t; lane = laneV || 0; laneTarget = lane; speed = 70; traffic = [];
        if (withTraffic !== false) [[55, -1], [120, 1], [190, 0]].forEach(function (a, i) { traffic.push({ z: d + a[0], lane: a[1], v: 0, kind: CAR_KINDS[(i * 3 + Math.floor(d / 300)) % CAR_KINDS.length], col: CAR_COLS[(i * 2 + Math.floor(d / 200)) % CAR_COLS.length], passed: false, minGap: 9 }); });
        $('ov').hidden = true; lastScene = render(); return lastScene;
      },
      start: start, pause: pauseGame, resume: resumeGame, elev: elev, backToMenu: backToMenu,
      teleport: function (d) { dist = d; nextSpawn = d + 300; nextStop = 0; while (nextStop < REST_STOPS.length && REST_STOPS[nextStop] * chapterLen <= d) nextStop++; lastChapter = chapterAt(d).i - 1; traffic = []; },
      addCar: function (ln, ahead) { traffic.push({ z: dist + ahead, lane: ln, v: 0, kind: 'sedan', col: '#2563eb', passed: false, minGap: 9 }); },
      setLives: function (n) { lives = n; },
      setLane: function (l) { lane = laneTarget = l; },
      stopSpawning: function () { nextSpawn = 1e9; },
      advance: function (sec) { var n = Math.round(sec / .02); for (var i = 0; i < n; i++) step(.02); },
      coinChunk: coinChunk, heartChunk: heartChunk
    };
    if (params.get('still')) { window.racerDebug.still(parseFloat(params.get('still')), parseFloat(params.get('t') || '1'), 0, true); $('ov').hidden = true; }
    else window.requestAnimationFrame(frame);
  } else {
    window.requestAnimationFrame(frame);
  }
})();
