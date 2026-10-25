const test = require('node:test');
const assert = require('node:assert/strict');
const SFX = require('../src/sfx.js');

function fakeAudio() {
  const made = [];
  class AC {
    constructor() { this.state = 'running'; this.currentTime = 1; this.destination = {}; made.push(this); this.osc = []; }
    resume() { this.state = 'running'; }
    createOscillator() {
      const o = { type: '', frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {}, start() {}, stop() {} };
      this.osc.push(o); return o;
    }
    createGain() { return { gain: { setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} }; }
  }
  return { AC, made };
}

test('every event has a sound and a vibration pattern', () => {
  for (const name of ['ate', 'bonus', 'life', 'over', 'won']) {
    assert.ok(SFX.SOUNDS[name].length > 0, name);
    assert.ok(SFX.VIBES[name], name);
  }
});

test('play makes one oscillator per note and vibrates', () => {
  const { AC, made } = fakeAudio();
  const calls = [];
  const sfx = SFX.create({ AudioContext: AC, vibrate: (p) => calls.push(p) });
  sfx.play('bonus');
  assert.equal(made[0].osc.length, SFX.SOUNDS.bonus.length);
  assert.deepEqual(calls, [SFX.VIBES.bonus]);
});

test('sound off is silent but vibration still works, and the other way round', () => {
  const { AC, made } = fakeAudio();
  const calls = [];
  const sfx = SFX.create({ AudioContext: AC, vibrate: (p) => calls.push(p) });
  sfx.setSound(false);
  sfx.play('ate');
  assert.equal(made.length, 0, 'no audio context was even created');
  assert.equal(calls.length, 1);
  sfx.setSound(true);
  sfx.setHaptics(false);
  sfx.play('ate');
  assert.equal(made[0].osc.length, SFX.SOUNDS.ate.length);
  assert.equal(calls.length, 1);
});

test('a suspended context stays silent until unlock', () => {
  const { AC, made } = fakeAudio();
  const sfx = SFX.create({ AudioContext: AC });
  sfx.unlock();
  made[0].state = 'suspended';
  sfx.play('ate');
  assert.equal(made[0].osc.length, 0);
  sfx.unlock();
  sfx.play('ate');
  assert.equal(made[0].osc.length, SFX.SOUNDS.ate.length);
});

test('missing audio and vibration support, and throwing APIs, never throw', () => {
  const none = SFX.create({});
  assert.doesNotThrow(() => { none.unlock(); none.play('over'); });
  const bad = SFX.create({ AudioContext: function () { throw new Error('blocked'); }, vibrate: () => { throw new Error('no'); } });
  assert.doesNotThrow(() => { bad.unlock(); bad.play('over'); });
  assert.doesNotThrow(() => none.play('unknown'));
});
