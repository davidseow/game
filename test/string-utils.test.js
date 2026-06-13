const { test } = require('node:test');
const assert = require('node:assert/strict');
const { sanitizeName } = require('../game.js');

test('sanitizeName: trims whitespace', () => {
  assert.equal(sanitizeName('  alice  '), 'alice');
});

test('sanitizeName: strips HTML angle brackets', () => {
  assert.equal(sanitizeName('<script>'), 'script');
});

test('sanitizeName: strips ampersand', () => {
  assert.equal(sanitizeName('tom&jerry'), 'tomjerry');
});

test('sanitizeName: strips double-quote', () => {
  assert.equal(sanitizeName('say"hi"'), 'sayhi');
});

test('sanitizeName: strips single-quote', () => {
  assert.equal(sanitizeName("it's"), 'its');
});

test('sanitizeName: strips backtick', () => {
  assert.equal(sanitizeName('`name`'), 'name');
});

test('sanitizeName: strips control characters', () => {
  // \x00 through \x1f and \x7f
  assert.equal(sanitizeName('ab\x01\x1fcd\x7f'), 'abcd');
});

test('sanitizeName: truncates to 12 characters', () => {
  assert.equal(sanitizeName('abcdefghijklmnop'), 'abcdefghijkl');
});

test('sanitizeName: empty string returns empty string', () => {
  assert.equal(sanitizeName(''), '');
});

test('sanitizeName: normal name passes through unchanged', () => {
  assert.equal(sanitizeName('Player1'), 'Player1');
});

test('sanitizeName: exactly 12 chars is not truncated', () => {
  assert.equal(sanitizeName('abcdefghijkl'), 'abcdefghijkl');
});
