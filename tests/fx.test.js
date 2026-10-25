const test = require('node:test');
const assert = require('node:assert/strict');
const FX = require('../src/fx.js');

const seeded = () => { let n = 0.3; return () => (n = (n * 9301 + 0.49297) % 1); };

test('eating pulses the head, bursts particles, floats the points and starts a bulge', () => {
  const fx = FX.create(seeded());
  assert.equal(fx.headPulse(), 0);
  fx.trigger('ate', { x: 4, y: 5, points: 1 });
  assert.equal(fx.bulgeIndex(300, 8), 0);
  fx.update(FX.PULSE_MS / 2);
  assert.ok(fx.headPulse() > 0.9);
  assert.equal(fx.state.particles.length, 10);
  assert.equal(fx.state.floaters[0].text, '+1');
  fx.update(300);
  assert.ok(fx.bulgeIndex(300, 8) > 0.9);
});

test('bonus gives a bigger burst and a bonus floater', () => {
  const fx = FX.create(seeded());
  fx.trigger('bonus', { x: 1, y: 1, points: 5 });
  assert.equal(fx.state.particles.length, 16);
  assert.equal(fx.state.floaters[0].kind, 'bonus');
  assert.equal(fx.state.floaters[0].text, '+5');
});

test('effects end on their own: particles, floaters, pulse, shake and flash', () => {
  const fx = FX.create(seeded());
  fx.trigger('ate', { x: 0, y: 0, points: 1 });
  fx.trigger('over', { x: 0, y: 0 });
  assert.ok(fx.flashAlpha() > 0.2);
  assert.notDeepEqual(fx.shakeOffset(), { x: 0, y: 0 });
  for (let i = 0; i < 100; i++) fx.update(20);
  assert.equal(fx.state.particles.length, 0);
  assert.equal(fx.state.floaters.length, 0);
  assert.equal(fx.headPulse(), 0);
  assert.equal(fx.flashAlpha(), 0);
  assert.deepEqual(fx.shakeOffset(), { x: 0, y: 0 });
});

test('the bulge ends at the tail', () => {
  const fx = FX.create(seeded());
  fx.trigger('ate', { x: 0, y: 0, points: 1 });
  fx.update(5000);
  assert.equal(fx.bulgeIndex(300, 4), null);
});

test('fruit pops in with an overshoot and settles at full size', () => {
  const fx = FX.create(seeded());
  assert.equal(fx.foodScale(), 1);
  fx.trigger('spawn', {});
  fx.update(1);
  assert.ok(fx.foodScale() < 0.2);
  fx.update(200);
  assert.ok(fx.foodScale() > 1);
  fx.update(500);
  assert.equal(fx.foodScale(), 1);
});

test('idle blink and tongue are brief and periodic', () => {
  const fx = FX.create(seeded());
  assert.equal(fx.blink(), true);
  fx.update(1000);
  assert.equal(fx.blink(), false);
  assert.equal(fx.tongue() >= 0 && fx.tongue() <= 1, true);
  fx.update(1900);
  assert.equal(fx.tongue(), 0);
});

test('reset clears every running effect', () => {
  const fx = FX.create(seeded());
  fx.trigger('ate', { x: 0, y: 0, points: 1 });
  fx.trigger('over', { x: 0, y: 0 });
  fx.reset();
  assert.equal(fx.state.particles.length, 0);
  assert.equal(fx.flashAlpha(), 0);
  assert.equal(fx.bulgeIndex(300, 8), null);
});
