const { test } = require('node:test');
const assert = require('node:assert/strict');
const { t, uiFont, LANG } = require('../game.js');

// Note: currentLang defaults to 'en' after initLang() reads from stubbed localStorage/navigator.

test('t: known English key returns a non-empty string', () => {
  const val = t('tapToPlay');
  assert.equal(typeof val, 'string');
  assert.ok(val.length > 0);
});

test('t: all English keys resolve to strings', () => {
  for (const key of Object.keys(LANG.en)) {
    const val = t(key);
    assert.equal(typeof val, 'string', `key "${key}" did not resolve to string`);
  }
});

test('t: unknown key falls back to the key itself', () => {
  assert.equal(t('nonexistent_key_xyz'), 'nonexistent_key_xyz');
});

test('t: English and Chinese have the same set of keys', () => {
  const enKeys = new Set(Object.keys(LANG.en));
  const zhKeys = new Set(Object.keys(LANG.zh));
  for (const k of enKeys) {
    assert.ok(zhKeys.has(k), `zh missing key: ${k}`);
  }
  for (const k of zhKeys) {
    assert.ok(enKeys.has(k), `en missing key: ${k}`);
  }
});

test('uiFont: returns a string containing a size', () => {
  const font = uiFont(16);
  assert.equal(typeof font, 'string');
  assert.ok(font.includes('16'), `uiFont(16) = "${font}" does not include size`);
});

test('uiFont: English mode uses monospace', () => {
  // Default lang is 'en' in test environment
  const font = uiFont(14);
  assert.ok(font.includes('monospace'));
});
