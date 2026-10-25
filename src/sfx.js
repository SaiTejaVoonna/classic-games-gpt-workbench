// Sound and vibration. Sounds are synthesised with the Web Audio API (no audio files) and are
// quiet by default. Everything fails soft: no audio support, no vibration support, or a
// blocked audio context simply means silence.
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SnakeSfx = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Each note: start offset (s), frequency (Hz), end frequency (Hz, for a slide), length (s), wave, volume.
  var SOUNDS = {
    ate:   [{ at: 0, f: 520, to: 700, d: 0.09, w: 'triangle', v: 0.5 }, { at: 0.07, f: 780, to: 780, d: 0.1, w: 'triangle', v: 0.45 }],
    bonus: [{ at: 0, f: 660, to: 660, d: 0.08, w: 'triangle', v: 0.5 }, { at: 0.08, f: 880, to: 880, d: 0.08, w: 'triangle', v: 0.5 }, { at: 0.16, f: 1175, to: 1175, d: 0.16, w: 'triangle', v: 0.45 }],
    life:  [{ at: 0, f: 330, to: 140, d: 0.28, w: 'sawtooth', v: 0.35 }],
    over:  [{ at: 0, f: 330, to: 260, d: 0.16, w: 'sawtooth', v: 0.35 }, { at: 0.17, f: 260, to: 200, d: 0.16, w: 'sawtooth', v: 0.35 }, { at: 0.34, f: 200, to: 110, d: 0.36, w: 'sawtooth', v: 0.35 }],
    won:   [{ at: 0, f: 523, to: 523, d: 0.1, w: 'triangle', v: 0.5 }, { at: 0.1, f: 659, to: 659, d: 0.1, w: 'triangle', v: 0.5 }, { at: 0.2, f: 784, to: 784, d: 0.1, w: 'triangle', v: 0.5 }, { at: 0.3, f: 1047, to: 1047, d: 0.25, w: 'triangle', v: 0.5 }]
  };
  var VIBES = { ate: 14, bonus: [18, 40, 18], life: [60, 40, 90], over: [90, 50, 90, 50, 160], won: [30, 40, 30, 40, 80] };
  var MASTER = 0.18;

  // env: { AudioContext, vibrate } injectable for tests.
  function create(env) {
    env = env || {};
    var AC = env.AudioContext;
    var vib = env.vibrate;
    var ctx = null;
    var soundOn = true;
    var hapticsOn = true;

    function ensure() {
      if (ctx || !AC) return ctx;
      try { ctx = new AC(); } catch { ctx = null; }
      return ctx;
    }

    // Browsers only start audio after a tap or key press, so main.js calls this from one.
    function unlock() {
      var c = ensure();
      if (c && c.state === 'suspended' && c.resume) { try { c.resume(); } catch { /* stay silent */ } }
    }

    function tone(c, note, base) {
      var o = c.createOscillator();
      var g = c.createGain();
      var t0 = base + note.at;
      o.type = note.w;
      o.frequency.setValueAtTime(note.f, t0);
      if (note.to !== note.f && o.frequency.exponentialRampToValueAtTime) o.frequency.exponentialRampToValueAtTime(note.to, t0 + note.d);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(MASTER * note.v, t0 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + note.d);
      o.connect(g);
      g.connect(c.destination);
      o.start(t0);
      o.stop(t0 + note.d + 0.02);
    }

    function play(name) {
      if (soundOn && SOUNDS[name]) {
        var c = ensure();
        if (c && c.state !== 'suspended') {
          try { SOUNDS[name].forEach(function (n) { tone(c, n, c.currentTime); }); } catch { /* stay silent */ }
        }
      }
      if (hapticsOn && vib && VIBES[name]) {
        try { vib(VIBES[name]); } catch { /* not supported */ }
      }
    }

    return {
      play: play, unlock: unlock,
      setSound: function (on) { soundOn = !!on; },
      setHaptics: function (on) { hapticsOn = !!on; }
    };
  }

  return { create: create, SOUNDS: SOUNDS, VIBES: VIBES };
});
