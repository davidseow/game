const { test } = require('node:test');
const assert = require('node:assert/strict');
const { g, S } = require('../game.js');

// ─── FSM STATE CONSTANTS ─────────────────────────────────────────────────────

test('S: all FSM states are defined', () => {
  for (const key of ['TITLE', 'PLAYING', 'DEAD', 'AD', 'LEADERBOARD']) {
    assert.ok(key in S, `S.${key} is missing`);
  }
});

test('S: all FSM state values are strings', () => {
  for (const [key, val] of Object.entries(S)) {
    assert.equal(typeof val, 'string', `S.${key} is not a string`);
  }
});

test('S: all FSM state values are unique', () => {
  const vals = Object.values(S);
  assert.equal(new Set(vals).size, vals.length, 'duplicate FSM state values');
});

// ─── INITIAL GAME STATE SHAPE ────────────────────────────────────────────────

const REQUIRED_KEYS = [
  'state', 'playerLane', 'echoLane', 'score', 'hi',
  'level', 'combo', 'yellows', 'speed', 'echoDelay',
  'frame', 'nextSpawn', 'deathTimer', 'tutStep',
  'palBlend', 'prevPal',
  'laneAnim', 'echoAnim',
  'comboTimer', 'missTimer', 'levelTimer', 'flashTimer',
  'comboMax', 'sessionStart', 'tapCount', 'yellowsTotal',
  'lb',
  'shakeFrames', 'shakeMag',
  'achTimer', 'achLabel',
  'dailyMode', 'dailyDate',
];

test('g: all required state keys are present', () => {
  for (const key of REQUIRED_KEYS) {
    assert.ok(key in g, `g.${key} is missing`);
  }
});

test('g: playerLane is 0, 1, or 2', () => {
  assert.ok([0, 1, 2].includes(g.playerLane));
});

test('g: echoLane is 0, 1, or 2', () => {
  assert.ok([0, 1, 2].includes(g.echoLane));
});

test('g: laneAnim has required fields', () => {
  assert.ok('active' in g.laneAnim);
  assert.ok('from' in g.laneAnim);
  assert.ok('to' in g.laneAnim);
  assert.ok('t' in g.laneAnim);
});

test('g: echoAnim has required fields', () => {
  assert.ok('active' in g.echoAnim);
  assert.ok('from' in g.echoAnim);
  assert.ok('to' in g.echoAnim);
  assert.ok('t' in g.echoAnim);
});

test('g: lb has required fields', () => {
  assert.ok('entries' in g.lb);
  assert.ok('loading' in g.lb);
  assert.ok('submitState' in g.lb);
  assert.ok(Array.isArray(g.lb.entries));
});

test('g: initial state is S.TITLE', () => {
  // After boot, game goes to S.TITLE
  assert.equal(g.state, S.TITLE);
});

test('g: score and level start at valid values', () => {
  assert.equal(typeof g.score, 'number');
  assert.equal(typeof g.level, 'number');
  assert.ok(g.level >= 1);
});
