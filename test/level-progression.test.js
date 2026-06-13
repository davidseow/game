// Tests for the speed and echo-delay formulas used in levelUp().
// Formula (from game.js):
//   speed     = min(BASE_SPEED + (level-1) * SPEED_PER_LEVEL, MAX_SPEED)
//   echoDelay = min(ECHO_DELAY_MAX, ECHO_DELAY_START + (level-1) * ECHO_DELAY_STEP)

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { CFG } = require('../game.js');

function speedAtLevel(level) {
  return Math.min(CFG.BASE_SPEED + (level - 1) * CFG.SPEED_PER_LEVEL, CFG.MAX_SPEED);
}

function echoDelayAtLevel(level) {
  return Math.min(CFG.ECHO_DELAY_MAX, CFG.ECHO_DELAY_START + (level - 1) * CFG.ECHO_DELAY_STEP);
}

// ─── SPEED FORMULA ──────────────────────────────────────────────────────────

test('speed: level 1 equals BASE_SPEED', () => {
  assert.equal(speedAtLevel(1), CFG.BASE_SPEED);
});

test('speed: increases by SPEED_PER_LEVEL each level', () => {
  for (let lvl = 2; lvl <= 10; lvl++) {
    const expected = Math.min(
      CFG.BASE_SPEED + (lvl - 1) * CFG.SPEED_PER_LEVEL,
      CFG.MAX_SPEED
    );
    assert.ok(
      Math.abs(speedAtLevel(lvl) - expected) < 1e-9,
      `level ${lvl}: expected ${expected}, got ${speedAtLevel(lvl)}`
    );
  }
});

test('speed: never exceeds MAX_SPEED', () => {
  for (let lvl = 1; lvl <= 50; lvl++) {
    assert.ok(speedAtLevel(lvl) <= CFG.MAX_SPEED, `level ${lvl} exceeded MAX_SPEED`);
  }
});

test('speed: caps exactly at MAX_SPEED for high levels', () => {
  assert.equal(speedAtLevel(100), CFG.MAX_SPEED);
});

// ─── ECHO DELAY FORMULA ─────────────────────────────────────────────────────

test('echoDelay: level 1 equals ECHO_DELAY_START', () => {
  assert.equal(echoDelayAtLevel(1), CFG.ECHO_DELAY_START);
});

test('echoDelay: increases by ECHO_DELAY_STEP each level until cap', () => {
  for (let lvl = 2; lvl <= 10; lvl++) {
    const expected = Math.min(
      CFG.ECHO_DELAY_MAX,
      CFG.ECHO_DELAY_START + (lvl - 1) * CFG.ECHO_DELAY_STEP
    );
    assert.equal(echoDelayAtLevel(lvl), expected, `level ${lvl}`);
  }
});

test('echoDelay: never exceeds ECHO_DELAY_MAX', () => {
  for (let lvl = 1; lvl <= 50; lvl++) {
    assert.ok(echoDelayAtLevel(lvl) <= CFG.ECHO_DELAY_MAX, `level ${lvl} exceeded ECHO_DELAY_MAX`);
  }
});

test('echoDelay: caps exactly at ECHO_DELAY_MAX for high levels', () => {
  assert.equal(echoDelayAtLevel(100), CFG.ECHO_DELAY_MAX);
});

test('echoDelay: level at which cap is first reached', () => {
  // Cap hits when ECHO_DELAY_START + (level-1)*STEP >= ECHO_DELAY_MAX
  // level >= 1 + (MAX - START) / STEP
  const capLevel = 1 + (CFG.ECHO_DELAY_MAX - CFG.ECHO_DELAY_START) / CFG.ECHO_DELAY_STEP;
  assert.equal(echoDelayAtLevel(capLevel), CFG.ECHO_DELAY_MAX);
  assert.ok(echoDelayAtLevel(capLevel - 1) < CFG.ECHO_DELAY_MAX);
});
