const { test } = require('node:test');
const assert = require('node:assert/strict');
const { CFG, hitTest } = require('../game.js');

// ─── CONFIG SANITY CHECKS ───────────────────────────────────────────────────

test('CFG: canvas dimensions are 360x640', () => {
  assert.equal(CFG.W, 360);
  assert.equal(CFG.H, 640);
});

test('CFG: exactly 3 lane Y-positions', () => {
  assert.equal(CFG.LANES.length, 3);
});

test('CFG: lane Y-positions are within canvas height', () => {
  for (const y of CFG.LANES) {
    assert.ok(y > 0 && y < CFG.H, `lane y=${y} out of canvas`);
  }
});

test('CFG: lane Y-positions are strictly increasing', () => {
  assert.ok(CFG.LANES[0] < CFG.LANES[1]);
  assert.ok(CFG.LANES[1] < CFG.LANES[2]);
});

test('CFG: echo delay max is greater than start', () => {
  assert.ok(CFG.ECHO_DELAY_MAX > CFG.ECHO_DELAY_START);
});

test('CFG: echo delay step is positive', () => {
  assert.ok(CFG.ECHO_DELAY_STEP > 0);
});

test('CFG: max speed is greater than base speed', () => {
  assert.ok(CFG.MAX_SPEED > CFG.BASE_SPEED);
});

test('CFG: spawn min is less than spawn base', () => {
  assert.ok(CFG.SPAWN_MIN < CFG.SPAWN_BASE);
});

test('CFG: PLAYER_X and ECHO_X are within canvas width', () => {
  assert.ok(CFG.PLAYER_X > 0 && CFG.PLAYER_X < CFG.W);
  assert.ok(CFG.ECHO_X > 0 && CFG.ECHO_X < CFG.W);
});

test('CFG: player and echo are on opposite sides (echo left, player right)', () => {
  assert.ok(CFG.ECHO_X < CFG.PLAYER_X);
});

test('CFG: HIST_CAP is a positive integer', () => {
  assert.ok(Number.isInteger(CFG.HIST_CAP) && CFG.HIST_CAP > 0);
});

// ─── HITTEST ────────────────────────────────────────────────────────────────

test('hitTest: point inside rect returns true', () => {
  const r = { x: 10, y: 10, w: 50, h: 30 };
  assert.equal(hitTest(35, 25, r), true);
});

test('hitTest: point outside rect (left) returns false', () => {
  const r = { x: 10, y: 10, w: 50, h: 30 };
  assert.equal(hitTest(5, 25, r), false);
});

test('hitTest: point outside rect (right) returns false', () => {
  const r = { x: 10, y: 10, w: 50, h: 30 };
  assert.equal(hitTest(65, 25, r), false);
});

test('hitTest: point outside rect (above) returns false', () => {
  const r = { x: 10, y: 10, w: 50, h: 30 };
  assert.equal(hitTest(35, 5, r), false);
});

test('hitTest: point outside rect (below) returns false', () => {
  const r = { x: 10, y: 10, w: 50, h: 30 };
  assert.equal(hitTest(35, 45, r), false);
});

test('hitTest: point on exact left edge returns true', () => {
  const r = { x: 10, y: 10, w: 50, h: 30 };
  assert.equal(hitTest(10, 25, r), true);
});

test('hitTest: point on exact right edge returns true', () => {
  const r = { x: 10, y: 10, w: 50, h: 30 };
  assert.equal(hitTest(60, 25, r), true);
});

test('hitTest: point on exact top edge returns true', () => {
  const r = { x: 10, y: 10, w: 50, h: 30 };
  assert.equal(hitTest(35, 10, r), true);
});

test('hitTest: point on exact bottom edge returns true', () => {
  const r = { x: 10, y: 10, w: 50, h: 30 };
  assert.equal(hitTest(35, 40, r), true);
});
