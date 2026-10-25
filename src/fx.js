// Visual effects only: particles, floating score text, shake, flash and the idle motion
// clock. Nothing here changes the rules or the scores. Pure data in and out so it can be
// unit tested; main.js feeds it game events and draws it over the board.
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SnakeFx = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var PULSE_MS = 260;
  var SHAKE_MS = 420;
  var FLASH_MS = 520;
  var FLOAT_MS = 700;
  var PARTICLE_MS = 520;
  var POP_MS = 320;

  function easeOutBack(p) {
    var c1 = 1.70158;
    var c3 = c1 + 1;
    return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2);
  }

  // rand: () => [0,1), injectable for tests.
  function create(rand) {
    rand = rand || Math.random;
    var s = { t: 0, particles: [], floaters: [], pulse: -1, shake: -1, flash: -1, pop: -1, bulge: null };

    function burst(cx, cy, n, color, speed) {
      for (var i = 0; i < n; i++) {
        var a = (i / n) * Math.PI * 2 + rand() * 0.6;
        var v = speed * (0.5 + rand() * 0.8);
        s.particles.push({ x: cx, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v, age: 0, r: 0.06 + rand() * 0.06, color: color });
      }
    }

    // info: { x, y } cell of the event, plus type-specific fields
    function trigger(type, info) {
      if (type === 'ate' || type === 'bonus') {
        s.pulse = 0;
        burst(info.x, info.y, type === 'bonus' ? 16 : 10, type === 'bonus' ? 'bonus' : 'food', 3.2);
        s.floaters.push({ x: info.x, y: info.y, text: '+' + info.points, kind: type === 'bonus' ? 'bonus' : 'food', age: 0 });
        s.bulge = { age: 0 };
      } else if (type === 'lifeLost' || type === 'over') {
        s.shake = 0;
        s.flash = 0;
        burst(info.x, info.y, 14, 'snake', 3.6);
      } else if (type === 'spawn') {
        s.pop = 0;
      }
    }

    function adv(v, dt, max) { return v < 0 ? v : (v + dt >= max ? -1 : v + dt); }

    function update(dt) {
      s.t += dt;
      s.pulse = adv(s.pulse, dt, PULSE_MS);
      s.shake = adv(s.shake, dt, SHAKE_MS);
      s.flash = adv(s.flash, dt, FLASH_MS);
      s.pop = adv(s.pop, dt, POP_MS);
      if (s.bulge) { s.bulge.age += dt; }
      s.particles.forEach(function (p) {
        p.age += dt;
        p.x += p.vx * dt / 1000;
        p.y += p.vy * dt / 1000 + 0.6 * dt / 1000 * (p.age / 1000);
      });
      s.particles = s.particles.filter(function (p) { return p.age < PARTICLE_MS; });
      s.floaters.forEach(function (f) { f.age += dt; });
      s.floaters = s.floaters.filter(function (f) { return f.age < FLOAT_MS; });
    }

    // 0..1 head pulse (peaks mid-way), 0 when idle
    function headPulse() { return s.pulse < 0 ? 0 : Math.sin(Math.PI * s.pulse / PULSE_MS); }
    function foodScale() { return s.pop < 0 ? 1 : Math.max(0, easeOutBack(s.pop / POP_MS)); }
    function foodBob() { return Math.sin(s.t / 380) * 0.035; }
    // cells of shake offset
    function shakeOffset() {
      if (s.shake < 0) return { x: 0, y: 0 };
      var k = 1 - s.shake / SHAKE_MS;
      return { x: Math.sin(s.shake / 22) * 0.28 * k, y: Math.cos(s.shake / 17) * 0.2 * k };
    }
    function flashAlpha() { return s.flash < 0 ? 0 : 0.26 * (1 - s.flash / FLASH_MS); }
    function blink() { return (s.t % 3700) < 150; }
    // 0..1 tongue extension for a short flick every few seconds
    function tongue() { var p = (s.t % 2900) / 520; return p >= 1 ? 0 : Math.sin(Math.PI * p); }
    // position (in snake cells from the head) of the bulge travelling down the body, or null
    function bulgeIndex(tickMs, length) {
      if (!s.bulge) return null;
      var i = s.bulge.age / Math.max(60, tickMs * 0.9);
      if (i >= length - 1) { s.bulge = null; return null; }
      return i;
    }
    function reset() { s.particles = []; s.floaters = []; s.pulse = s.shake = s.flash = s.pop = -1; s.bulge = null; }

    return {
      state: s, trigger: trigger, update: update, reset: reset,
      headPulse: headPulse, foodScale: foodScale, foodBob: foodBob, shakeOffset: shakeOffset,
      flashAlpha: flashAlpha, blink: blink, tongue: tongue, bulgeIndex: bulgeIndex
    };
  }

  return { create: create, PULSE_MS: PULSE_MS, SHAKE_MS: SHAKE_MS, FLOAT_MS: FLOAT_MS, PARTICLE_MS: PARTICLE_MS };
});
