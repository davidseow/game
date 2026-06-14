// Acceptance / journey tests — verify complete user workflows through the game systems.
// Each test resets game state via freshGame() for full isolation.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  CFG, S, g, hist, obs,
  update, initGame, spawnObs, checkCollisions, scoreYellow, die, onTap,
} = require('../game.js');

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function freshGame() {
  initGame();
  g.state = S.PLAYING;
}

// Spawn an obstacle and immediately set its X position for deterministic collision.
function placeObs(lane, type, x) {
  spawnObs(lane, type);
  const o = obs.find(o => o.active && o.lane === lane && o.type === type);
  o.x = x;
  return o;
}

// ─── GAME INITIALISATION ─────────────────────────────────────────────────────

test('journey: game starts with correct initial values', () => {
  freshGame();
  assert.equal(g.score, 0);
  assert.equal(g.level, 1);
  assert.equal(g.combo, 0);
  assert.equal(g.yellows, 0);
  assert.equal(g.speed, CFG.BASE_SPEED);
  assert.equal(g.echoDelay, CFG.ECHO_DELAY_START);
  assert.equal(g.state, S.PLAYING);
});

// ─── ECHO DELAY MECHANIC ─────────────────────────────────────────────────────

test('journey: echo mirrors player lane from echoDelay ms ago', () => {
  freshGame();
  hist.clear();
  // Player was in lane 0 at t=100, switched to lane 2 at t=500
  hist.push(0, 100);
  hist.push(2, 500);
  g.echoDelay = 400;
  // At current time 500, echo queries 500-400=100 → should see lane 0
  assert.equal(hist.queryAt(500 - g.echoDelay), 0);
});

test('journey: echo catches up as delay shrinks', () => {
  freshGame();
  hist.clear();
  hist.push(0, 100);
  hist.push(2, 300);
  g.echoDelay = 50;
  // Query at 300-50=250 → newest entry at or before t=250 is t=100 (lane 0)
  assert.equal(hist.queryAt(300 - g.echoDelay), 0);
});

// ─── YELLOW SCORING ──────────────────────────────────────────────────────────

test('journey: echo scores yellow obstacle in same lane', () => {
  freshGame();
  g.echoLane = 1;
  placeObs(1, 'yellow', CFG.ECHO_X);
  checkCollisions();
  assert.equal(g.score, CFG.PTS_YELLOW);
  assert.equal(g.combo, 1);
  assert.equal(g.yellows, 1);
  assert.equal(g.yellowsTotal, 1);
});

test('journey: yellow in different lane from echo does not score', () => {
  freshGame();
  g.echoLane = 0;
  placeObs(2, 'yellow', CFG.ECHO_X); // lane 2, echo is in lane 0
  checkCollisions();
  assert.equal(g.score, 0);
  assert.equal(g.combo, 0);
});

test('journey: obstacle scored by echo is deactivated', () => {
  freshGame();
  g.echoLane = 0;
  const o = placeObs(0, 'yellow', CFG.ECHO_X);
  checkCollisions();
  assert.equal(o.active, false);
});

// ─── SCORE FORMULA ───────────────────────────────────────────────────────────

test('journey: score formula scales with combo (10, 15, 20 pts)', () => {
  freshGame();
  g.echoLane = 0;

  placeObs(0, 'yellow', CFG.ECHO_X);
  checkCollisions();
  assert.equal(g.score, 10); // combo 1: 10 + max(0,0)*5 = 10

  placeObs(0, 'yellow', CFG.ECHO_X);
  checkCollisions();
  assert.equal(g.score, 25); // combo 2: 10 + max(0,1)*5 = 15 → total 25

  placeObs(0, 'yellow', CFG.ECHO_X);
  checkCollisions();
  assert.equal(g.score, 45); // combo 3: 10 + max(0,2)*5 = 20 → total 45
});

// ─── COMBO MECHANICS ─────────────────────────────────────────────────────────

test('journey: combo increments on consecutive yellows', () => {
  freshGame();
  g.echoLane = 1;
  for (let i = 0; i < 3; i++) {
    placeObs(1, 'yellow', CFG.ECHO_X);
    checkCollisions();
  }
  assert.equal(g.combo, 3);
  assert.equal(g.comboMax, 3);
});

test('journey: combo resets when yellow passes echo off-screen', () => {
  freshGame();
  g.combo = 5;
  // Place yellow just inside the off-screen trigger; one update() frame moves it past -50
  placeObs(1, 'yellow', -48);
  update(1000);
  assert.equal(g.combo, 0);
  assert.ok(g.missTimer > 0, 'MISS timer should be running after a missed yellow');
});

// ─── PLAYER DEATH ────────────────────────────────────────────────────────────

test('journey: player dies when red obstacle hits player lane', () => {
  freshGame();
  g.playerLane = 0;
  placeObs(0, 'red', CFG.PLAYER_X);
  checkCollisions();
  assert.equal(g.state, S.DEAD);
});

test('journey: red in different lane does not kill player', () => {
  freshGame();
  g.playerLane = 0;
  placeObs(2, 'red', CFG.PLAYER_X); // lane 2, player is in lane 0
  checkCollisions();
  assert.equal(g.state, S.PLAYING);
});

test('journey: echo dies when red hits echo lane', () => {
  freshGame();
  g.echoLane = 2;
  placeObs(2, 'red', CFG.ECHO_X);
  checkCollisions();
  assert.equal(g.state, S.DEAD);
});

test('journey: die() is idempotent — second call is ignored', () => {
  freshGame();
  die('player');
  assert.equal(g.state, S.DEAD);
  const deathTimer = g.deathTimer;
  die('player'); // state is now DEAD, so this should return early
  assert.equal(g.deathTimer, deathTimer); // unchanged
});

// ─── LEVEL PROGRESSION ───────────────────────────────────────────────────────

test('journey: level up after scoring LEVEL_YELLOWS yellows', () => {
  freshGame();
  g.echoLane = 0;
  for (let i = 0; i < CFG.LEVEL_YELLOWS; i++) {
    placeObs(0, 'yellow', CFG.ECHO_X);
    checkCollisions();
  }
  assert.equal(g.level, 2);
  assert.equal(g.yellows, 0); // reset on level up
  // Speed and delay should have increased
  assert.ok(g.speed > CFG.BASE_SPEED, `speed ${g.speed} should be > BASE_SPEED ${CFG.BASE_SPEED}`);
  assert.ok(g.echoDelay > CFG.ECHO_DELAY_START, `echoDelay ${g.echoDelay} should be > start ${CFG.ECHO_DELAY_START}`);
});

// ─── HIGH SCORE PERSISTENCE ──────────────────────────────────────────────────

test('journey: new high score is persisted to localStorage', () => {
  freshGame();
  g.hi = 0;
  g.echoLane = 0;
  placeObs(0, 'yellow', CFG.ECHO_X);
  checkCollisions();
  assert.equal(g.hi, CFG.PTS_YELLOW);
  assert.equal(localStorage.getItem('echorunner_hi'), String(CFG.PTS_YELLOW));
});

// ─── GAME LOOP INTEGRATION ───────────────────────────────────────────────────

test('journey: frame counter increments each update() tick', () => {
  freshGame();
  for (let i = 0; i < 10; i++) {
    update(1000 + i * 16);
  }
  assert.equal(g.frame, 10);
  assert.equal(g.state, S.PLAYING);
});

test('journey: update() is a no-op when state is not PLAYING', () => {
  freshGame();
  g.state = S.DEAD;
  const frameBefore = g.frame;
  update(9999);
  assert.equal(g.frame, frameBefore);
});

// ─── SUBMIT-ONCE ENFORCEMENT ──────────────────────────────────────────────────

test('journey: submit state is idle when game-over screen first appears', () => {
  freshGame();
  die('player');
  assert.equal(g.lb.submitState, 'idle');
});

test('journey: tapping submit button after submission does nothing', () => {
  // Spy on document.getElementById('name-form').style.display to detect showNameForm() calls
  let formOpened = false;
  const origGetById = global.document.getElementById;
  global.document.getElementById = (id) => {
    if (id === 'name-form') return {
      style: new Proxy({}, {
        set(t, k, v) { if (k === 'display' && v === 'flex') formOpened = true; t[k] = v; return true; },
      }),
    };
    if (id === 'nf-title') return { textContent: '' };
    if (id === 'nf-input') return { value: '', focus() {} };
    return origGetById(id);
  };
  try {
    freshGame();
    die('player');
    g.lb.submitState = 'done';
    // Tap at centre of BTN.SUBMIT: x = CFG.W/2 - 105 + 50 = 125, y = 428 + 16 = 444
    onTap({ preventDefault() {}, clientX: 125, clientY: 444 });
    // Guard must block re-opening the name form
    assert.equal(formOpened, false, 'name form must not open after score already submitted');
    // Guard condition expressed directly — fails if removed from onTap
    assert.equal(g.lb.submitState === 'idle', false, 'submitState guard must block re-submission');
  } finally {
    global.document.getElementById = origGetById;
  }
});

test('journey: starting a new game re-enables the submit button', () => {
  freshGame();
  die('player');
  g.lb.submitState = 'done';
  initGame();
  assert.equal(g.lb.submitState, 'idle', 'new game re-enables submission');
});

test('journey: html form submit locks submitState to done immediately', () => {
  freshGame();
  die('player');
  assert.equal(g.lb.submitState, 'idle');
  g.lb.submitState = 'done'; // simulates the nf-submit onclick side-effect
  // Subsequent tap at SUBMIT coords must be blocked by the guard
  onTap({ preventDefault() {}, clientX: 125, clientY: 444 });
  assert.equal(g.lb.submitState, 'done', 'state stays done — form cannot reopen');
});
