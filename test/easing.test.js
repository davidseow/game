const { test } = require('node:test');
const assert = require('node:assert/strict');
const { easeOut, stepAnim } = require('../game.js');

// easeOut(t) = 1 - (1-t)^2

test('easeOut: t=0 returns 0', () => {
  assert.equal(easeOut(0), 0);
});

test('easeOut: t=1 returns 1', () => {
  assert.equal(easeOut(1), 1);
});

test('easeOut: t=0.5 returns 0.75', () => {
  assert.equal(easeOut(0.5), 0.75);
});

test('easeOut: output is always in [0, 1] for inputs in [0, 1]', () => {
  for (let i = 0; i <= 10; i++) {
    const v = easeOut(i / 10);
    assert.ok(v >= 0 && v <= 1, `easeOut(${i / 10}) = ${v} out of range`);
  }
});

test('easeOut: is monotonically non-decreasing', () => {
  let prev = 0;
  for (let i = 1; i <= 10; i++) {
    const curr = easeOut(i / 10);
    assert.ok(curr >= prev, `easeOut not monotonic at t=${i / 10}`);
    prev = curr;
  }
});

// stepAnim advances t by 0.18 each call; marks inactive when t >= 1

test('stepAnim: does nothing when inactive', () => {
  const anim = { active: false, t: 0.0, from: 0, to: 1 };
  stepAnim(anim);
  assert.equal(anim.t, 0.0);
  assert.equal(anim.active, false);
});

test('stepAnim: advances t by 0.18', () => {
  const anim = { active: true, t: 0.0, from: 0, to: 1 };
  stepAnim(anim);
  assert.ok(Math.abs(anim.t - 0.18) < 1e-9);
  assert.equal(anim.active, true);
});

test('stepAnim: clamps t to 1 and marks inactive', () => {
  const anim = { active: true, t: 0.9, from: 0, to: 1 };
  stepAnim(anim);
  assert.equal(anim.t, 1);
  assert.equal(anim.active, false);
});

test('stepAnim: multiple steps reach t=1 and stop', () => {
  const anim = { active: true, t: 0.0, from: 0, to: 2 };
  for (let i = 0; i < 20; i++) stepAnim(anim);
  assert.equal(anim.t, 1);
  assert.equal(anim.active, false);
});
