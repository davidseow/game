const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mulberry32 } = require('../game.js');

test('mulberry32: returns a function', () => {
  assert.equal(typeof mulberry32(42), 'function');
});

test('mulberry32: output is in [0, 1)', () => {
  const rng = mulberry32(1234);
  for (let i = 0; i < 100; i++) {
    const v = rng();
    assert.ok(v >= 0 && v < 1, `value ${v} out of range`);
  }
});

test('mulberry32: same seed produces identical sequence', () => {
  const a = mulberry32(999);
  const b = mulberry32(999);
  for (let i = 0; i < 20; i++) {
    assert.equal(a(), b());
  }
});

test('mulberry32: different seeds produce different sequences', () => {
  const a = mulberry32(1);
  const b = mulberry32(2);
  const seqA = Array.from({ length: 10 }, () => a());
  const seqB = Array.from({ length: 10 }, () => b());
  assert.notDeepEqual(seqA, seqB);
});

test('mulberry32: generates distinct values (not stuck)', () => {
  const rng = mulberry32(5);
  const vals = new Set(Array.from({ length: 20 }, () => rng()));
  assert.ok(vals.size > 1, 'PRNG produced all identical values');
});
