'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { PROVIDERS } = require('./providers/index.js');
const { JudgeProviderError, runJudge } = require('./judge.js');

test('Judge dispatches through provider.run with the shared runner', async () => {
  const originalRun = PROVIDERS.claude.run;
  const runner = { process() { throw new Error('provider.run was not used'); } };
  let received;
  PROVIDERS.claude.run = async (prompt, suppliedRunner) => {
    received = { prompt, suppliedRunner };
    return { stdout: JSON.stringify({ result: 'judge result' }), stderr: '', code: 0 };
  };

  try {
    const output = await runJudge('test question', [{
      provider: 'codex', content: 'candidate answer', key_claims: [], risks: [], assumptions: [], error: null,
    }], { judgeModel: 'claude', runner });
    assert.equal(output, 'judge result');
    assert.equal(received.suppliedRunner, runner);
    assert.match(received.prompt, /问题：test question/);
  } finally {
    PROVIDERS.claude.run = originalRun;
  }
});

for (const errorType of ['missing_api_key', 'nonzero', 'timeout']) {
  test(`Judge rejects ${errorType} provider output`, async () => {
    const originalRun = PROVIDERS.claude.run;
    PROVIDERS.claude.run = async () => ({
      stdout: JSON.stringify({ error: { message: 'provider failure' } }),
      stderr: '',
      code: errorType === 'nonzero' ? 401 : -1,
      error_type: errorType,
    });

    try {
      await assert.rejects(
        runJudge('test question', [{
          provider: 'codex', content: 'candidate answer', key_claims: [], risks: [], assumptions: [], error: null,
        }], { judgeModel: 'claude', runner: {} }),
        err => err instanceof JudgeProviderError && err.error_type === errorType,
      );
    } finally {
      PROVIDERS.claude.run = originalRun;
    }
  });
}

test('Judge propagates unexpected extractor errors', async () => {
  const originalRun = PROVIDERS.claude.run;
  const originalExtract = PROVIDERS.claude.extractJudgeText;
  PROVIDERS.claude.run = async () => ({ stdout: '{}', stderr: '', code: 0, error_type: null });
  PROVIDERS.claude.extractJudgeText = () => { throw new Error('extractor broke'); };

  try {
    await assert.rejects(
      runJudge('test question', [{
        provider: 'codex', content: 'candidate answer', key_claims: [], risks: [], assumptions: [], error: null,
      }], { judgeModel: 'claude', runner: {} }),
      /extractor broke/,
    );
  } finally {
    PROVIDERS.claude.run = originalRun;
    PROVIDERS.claude.extractJudgeText = originalExtract;
  }
});
