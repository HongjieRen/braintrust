'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { deepseek, grok, DEEPSEEK_ENDPOINT, GROK_ENDPOINT } = require('./openai-compatible.js');
const { normalize } = require('../normalize.js');

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

test('DeepSeek sends a Chat Completions request through the shared runner', async () => {
  await withEnv({ DEEPSEEK_API_KEY: 'test-key' }, async () => {
    let call;
    const raw = await deepseek.run('hello', { request: async (...args) => {
      call = args;
      return { stdout: '{"choices":[{"message":{"content":"ok"}}]}', stderr: '', code: 200, error_type: null };
    } });
    const [url, options] = call;
    assert.equal(url, DEEPSEEK_ENDPOINT);
    assert.equal(options.headers.authorization, 'Bearer test-key');
    assert.deepEqual(JSON.parse(options.body), {
      model: 'deepseek-chat', messages: [{ role: 'user', content: 'hello' }], stream: false,
    });
    assert.equal(deepseek.adapt(raw).content, 'ok');
  });
});

test('Grok sends Responses input and reads output text', async () => {
  await withEnv({ XAI_API_KEY: 'test-key', BRAINTRUST_GROK_MODEL: 'grok-test' }, async () => {
    let call;
    const raw = await grok.run('hello', { request: async (...args) => {
      call = args;
      return { stdout: JSON.stringify({ output: [{ type: 'message', content: [{ type: 'output_text', text: 'ok' }] }] }), stderr: '', code: 200, error_type: null };
    } });
    const [url, options] = call;
    assert.equal(url, GROK_ENDPOINT);
    assert.deepEqual(JSON.parse(options.body), { model: 'grok-test', input: 'hello', store: false });
    assert.equal(grok.adapt(raw).content, 'ok');
  });
});

test('HTTP errors, timeouts, and absent keys remain degraded provider results', async () => {
  await withEnv({ DEEPSEEK_API_KEY: '' }, async () => {
    const missing = await deepseek.run('hello', { request: async () => assert.fail('must not request') });
    assert.equal(missing.error_type, 'missing_api_key');
  });
  const unauthorized = { stdout: '{"error":{"message":"nope"}}', stderr: '', code: 401, error_type: 'nonzero' };
  const fallback = grok.adapt(unauthorized);
  assert.equal(fallback.parse_mode, 'fallback');
  assert.equal(normalize('grok', unauthorized, fallback, 1).error, 'exit 401');

  await withEnv({ XAI_API_KEY: 'test-key' }, async () => {
    const timeout = await grok.run('hello', { request: async () => (
      { stdout: '', stderr: '', code: 'timeout', error_type: 'timeout' }
    ) });
    assert.equal(normalize('grok', timeout, grok.adapt(timeout), 1).error, 'timeout');
  });
});
