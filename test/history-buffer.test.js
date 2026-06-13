// The history buffer is a shared singleton in game.js.
// Each test clears it first to avoid cross-test contamination.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { hist, CFG } = require('../game.js');

test('hist: clear resets len and head', () => {
  hist.clear();
  assert.equal(hist.len, 0);
  assert.equal(hist.head, 0);
});

test('hist: queryAt on empty buffer returns default lane 1', () => {
  hist.clear();
  assert.equal(hist.queryAt(9999), 1);
});

test('hist: push increments len', () => {
  hist.clear();
  hist.push(0, 100);
  assert.equal(hist.len, 1);
  hist.push(1, 200);
  assert.equal(hist.len, 2);
});

test('hist: queryAt returns the lane recorded at that timestamp', () => {
  hist.clear();
  hist.push(0, 100);
  hist.push(1, 200);
  hist.push(2, 300);
  assert.equal(hist.queryAt(100), 0);
  assert.equal(hist.queryAt(200), 1);
  assert.equal(hist.queryAt(300), 2);
});

test('hist: queryAt returns the newest entry whose t <= target', () => {
  hist.clear();
  hist.push(0, 100);
  hist.push(2, 300);
  // target 250 should return the entry at t=100 (lane 0), not t=300
  assert.equal(hist.queryAt(250), 0);
});

test('hist: queryAt with target before oldest entry returns that oldest lane', () => {
  hist.clear();
  hist.push(2, 500);
  // Target earlier than any pushed entry: should return oldest lane (2)
  assert.equal(hist.queryAt(100), 2);
});

test('hist: queryAt returns the most recent entry for a very large target', () => {
  hist.clear();
  hist.push(0, 100);
  hist.push(1, 200);
  hist.push(2, 300);
  assert.equal(hist.queryAt(99999), 2);
});

test('hist: len caps at HIST_CAP', () => {
  hist.clear();
  for (let i = 0; i < CFG.HIST_CAP + 10; i++) {
    hist.push(i % 3, i);
  }
  assert.equal(hist.len, CFG.HIST_CAP);
});

test('hist: ring buffer wrap-around preserves correct queryAt behavior', () => {
  hist.clear();
  // Fill to capacity with lane=0 at timestamps 0..HIST_CAP-1
  for (let i = 0; i < CFG.HIST_CAP; i++) {
    hist.push(0, i);
  }
  // Overwrite oldest entries with lane=2 at timestamps HIST_CAP..HIST_CAP+9
  for (let i = 0; i < 10; i++) {
    hist.push(2, CFG.HIST_CAP + i);
  }
  // The most recent entries have lane=2
  assert.equal(hist.queryAt(CFG.HIST_CAP + 9), 2);
  // An entry still in the buffer from the first fill should return lane=0
  assert.equal(hist.queryAt(CFG.HIST_CAP - 1), 0);
});
