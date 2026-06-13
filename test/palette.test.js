const { test } = require('node:test');
const assert = require('node:assert/strict');
const { getPal, PALETTES } = require('../game.js');

const PALETTE_KEYS = ['bg1', 'bg2', 'player', 'echo', 'yellow', 'red', 'lane', 'trail'];

test('getPal: returns an object with all required color keys', () => {
  const pal = getPal(1);
  for (const key of PALETTE_KEYS) {
    assert.ok(key in pal, `missing key: ${key}`);
  }
});

test('getPal: levels 1–5 return palette index 0', () => {
  for (let lvl = 1; lvl <= 5; lvl++) {
    assert.deepEqual(getPal(lvl), PALETTES[0], `level ${lvl}`);
  }
});

test('getPal: levels 6–10 return palette index 1', () => {
  for (let lvl = 6; lvl <= 10; lvl++) {
    assert.deepEqual(getPal(lvl), PALETTES[1], `level ${lvl}`);
  }
});

test('getPal: levels 11–15 return palette index 2', () => {
  for (let lvl = 11; lvl <= 15; lvl++) {
    assert.deepEqual(getPal(lvl), PALETTES[2], `level ${lvl}`);
  }
});

test('getPal: levels 16+ return palette index 3 (capped)', () => {
  for (let lvl = 16; lvl <= 25; lvl++) {
    assert.deepEqual(getPal(lvl), PALETTES[3], `level ${lvl}`);
  }
});

test('getPal: all palette color values are valid hex strings', () => {
  for (const pal of PALETTES) {
    for (const key of PALETTE_KEYS) {
      assert.match(pal[key], /^#[0-9a-fA-F]{6}$/, `palette.${key} = "${pal[key]}"`);
    }
  }
});

test('PALETTES: exactly 4 palettes defined', () => {
  assert.equal(PALETTES.length, 4);
});
