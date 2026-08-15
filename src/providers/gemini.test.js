'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const gemini = require('./gemini.js');
const { PROVIDERS } = require('./index.js');

test('Gemini provider uses Antigravity CLI print mode', () => {
  assert.equal(PROVIDERS.gemini.cmd, 'agy');
  assert.deepEqual(gemini.getArgs('hello'), [
    '-p',
    'hello',
    '--output-format',
    'json',
    '--disable-slash-commands',
  ]);
});

test('Gemini provider reads Antigravity JSON responses', () => {
  const result = gemini.adapt({
    stdout: JSON.stringify({ status: 'SUCCESS', response: 'OK\n' }),
    stderr: '',
    code: 0,
  });

  assert.equal(result.content, 'OK\n');
  assert.equal(result.model, 'gemini');
  assert.equal(result.parse_mode, 'json');
});

test('Gemini provider tolerates warnings and braces inside response text', () => {
  const stdout = 'Warning: config {legacy}\n'
    + JSON.stringify({ status: 'SUCCESS', response: 'Use {a: "}"} safely' })
    + '\nDone';

  assert.equal(gemini.parseGeminiResponse(stdout), 'Use {a: "}"} safely');
});

test('Gemini provider rejects non-success envelopes', () => {
  for (const status of ['ERROR', 'CANCELED']) {
    const stdout = JSON.stringify({ status, response: 'partial', error: 'failed', usage: {} });
    const result = gemini.adapt({ stdout, stderr: '', code: 1 });

    assert.equal(gemini.parseGeminiResponse(stdout), null);
    assert.equal(result.parse_mode, 'fallback');
  }
});

test('Legacy CLI uses Antigravity for Gemini generator and judge', () => {
  const cli = readFileSync(join(__dirname, '..', '..', 'braintrust'), 'utf8');
  assert.equal((cli.match(/runProcess\('agy'/g) || []).length, 1);
  assert.equal((cli.match(/cmd: 'agy'/g) || []).length, 1);
  assert.doesNotMatch(cli, /runProcess\('gemini'/);
});
