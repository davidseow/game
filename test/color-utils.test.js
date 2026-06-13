const { test } = require('node:test');
const assert = require('node:assert/strict');
const { hexToRgb, lerpHex } = require('../game.js');

test('hexToRgb: pure red', () => {
  assert.deepEqual(hexToRgb('#ff0000'), [255, 0, 0]);
});

test('hexToRgb: pure green', () => {
  assert.deepEqual(hexToRgb('#00ff00'), [0, 255, 0]);
});

test('hexToRgb: pure blue', () => {
  assert.deepEqual(hexToRgb('#0000ff'), [0, 0, 255]);
});

test('hexToRgb: black', () => {
  assert.deepEqual(hexToRgb('#000000'), [0, 0, 0]);
});

test('hexToRgb: white', () => {
  assert.deepEqual(hexToRgb('#ffffff'), [255, 255, 255]);
});

test('hexToRgb: mixed color', () => {
  assert.deepEqual(hexToRgb('#1a2b3c'), [0x1a, 0x2b, 0x3c]);
});

test('lerpHex: t=0 returns first color', () => {
  assert.equal(lerpHex('#000000', '#ffffff', 0), '#000000');
});

test('lerpHex: t=1 returns second color', () => {
  assert.equal(lerpHex('#000000', '#ffffff', 1), '#ffffff');
});

test('lerpHex: t=0.5 returns midpoint', () => {
  const result = lerpHex('#000000', '#ffffff', 0.5);
  const [r, g, b] = hexToRgb(result);
  // midpoint of 0–255 is 128 (rounded from 127.5)
  assert.ok(r >= 127 && r <= 128, `red channel ${r} not near 128`);
  assert.ok(g >= 127 && g <= 128, `green channel ${g} not near 128`);
  assert.ok(b >= 127 && b <= 128, `blue channel ${b} not near 128`);
});

test('lerpHex: result is valid hex string', () => {
  const result = lerpHex('#ff0000', '#0000ff', 0.3);
  assert.match(result, /^#[0-9a-f]{6}$/);
});

test('lerpHex: interpolates each channel independently', () => {
  // red to blue at t=0.5: r=128, g=0, b=128
  const result = lerpHex('#ff0000', '#0000ff', 0.5);
  const [r, g, b] = hexToRgb(result);
  assert.ok(r >= 127 && r <= 128);
  assert.equal(g, 0);
  assert.ok(b >= 127 && b <= 128);
});
