'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { PROVIDERS, getActiveProviders } = require('./index.js');

async function withEnv(entries, fn) {
  const previous = Object.fromEntries(Object.keys(entries).map(key => [key, process.env[key]]));
  Object.assign(process.env, entries);
  try { return await fn(); } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test('default providers stay unchanged and optional providers require --with', () => {
  assert.deepEqual(getActiveProviders().map(p => p.name), ['claude', 'codex', 'gemini']);
  assert.deepEqual(getActiveProviders([], ['cursor', 'kimi', 'cursor']).map(p => p.name), [
    'claude', 'codex', 'gemini', 'cursor', 'kimi',
  ]);
  assert.deepEqual(getActiveProviders(['codex', 'cursor'], ['cursor', 'grok']).map(p => p.name), [
    'claude', 'gemini', 'grok',
  ]);
  assert.throws(() => getActiveProviders(['typo']), /Unknown provider in --skip: typo/);
  assert.throws(() => getActiveProviders([], ['typo']), /Unknown provider in --with: typo/);
});

test('Kimi Code injects its full Claude Code environment only for its child process', async () => {
  await withEnv({ KIMI_API_KEY: 'kimi-test-key', BRAINTRUST_KIMI_MODEL: 'kimi-test' }, async () => {
    let kimiOptions;
    let kimiArgs;
    await PROVIDERS.kimi.run('hello', { process: async (_cmd, args, options) => {
      kimiArgs = args;
      kimiOptions = options;
      return { stdout: '', stderr: '', code: 0, error_type: null };
    } });
    assert.deepEqual(kimiArgs.slice(-2), ['--permission-mode', 'plan']);
    assert.equal(kimiOptions.env.ANTHROPIC_BASE_URL, 'https://api.kimi.com/coding/');
    assert.equal(kimiOptions.env.ANTHROPIC_API_KEY, 'kimi-test-key');
    assert.equal(kimiOptions.env.ANTHROPIC_MODEL, 'kimi-test');
    for (const key of [
      'ANTHROPIC_DEFAULT_FABLE_MODEL',
      'ANTHROPIC_DEFAULT_OPUS_MODEL',
      'ANTHROPIC_DEFAULT_SONNET_MODEL',
      'ANTHROPIC_DEFAULT_HAIKU_MODEL',
      'CLAUDE_CODE_SUBAGENT_MODEL',
    ]) assert.equal(kimiOptions.env[key], 'kimi-test');
    assert.equal(kimiOptions.env.CLAUDE_CODE_EFFORT_LEVEL, 'high');
    assert.equal(kimiOptions.env.CLAUDE_CODE_AUTO_COMPACT_WINDOW, '262144');
    assert.equal(kimiOptions.env.CLAUDE_CODE_MAX_CONTEXT_TOKENS, '262144');

    let claudeOptions;
    await PROVIDERS.claude.run('hello', { process: async (_cmd, _args, options) => {
      claudeOptions = options;
      return { stdout: '', stderr: '', code: 0, error_type: null };
    } });
    assert.deepEqual(claudeOptions, {});
  });
});

test('Kimi Code degrades without KIMI_API_KEY', async () => {
  await withEnv({ KIMI_API_KEY: '' }, async () => {
    const raw = await PROVIDERS.kimi.run('hello', { process: async () => assert.fail('must not spawn') });
    assert.equal(raw.error_type, 'missing_api_key');
  });
});
