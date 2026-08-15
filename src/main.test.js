'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { PROVIDERS } = require('./providers/index.js');
const { main } = require('./main.js');

test('Judge failure degrades without failing the generator run', async () => {
  const originals = Object.fromEntries(Object.entries(PROVIDERS).map(([name, provider]) => [name, provider.run]));
  const stderrWrite = process.stderr.write;
  const consoleLog = console.log;
  const stdinDescriptor = Object.getOwnPropertyDescriptor(process.stdin, 'isTTY');
  let stderr = '';
  const output = [];

  PROVIDERS.claude.run = async prompt => prompt.includes('你是一个高级技术评审')
    ? { stdout: JSON.stringify({ error: { message: 'missing key' } }), stderr: '', code: -1, error_type: 'missing_api_key' }
    : { stdout: JSON.stringify({ result: 'claude generator' }), stderr: '', code: 0, error_type: null };
  PROVIDERS.codex.run = async () => ({
    stdout: JSON.stringify({ type: 'item.completed', item: { type: 'agent_message', text: 'codex generator' } }),
    stderr: '', code: 0, error_type: null,
  });
  PROVIDERS.gemini.run = async () => ({
    stdout: JSON.stringify({ response: 'gemini generator' }), stderr: '', code: 0, error_type: null,
  });
  process.stderr.write = chunk => { stderr += chunk; return true; };
  console.log = (...args) => output.push(args.join(' '));
  Object.defineProperty(process.stdin, 'isTTY', { configurable: true, value: true });

  try {
    await main(['--no-save', 'test question']);
    assert.match(stderr, /Judge degraded: Judge claude failed: missing_api_key/);
    assert.equal(output.some(line => line.includes('BRAINTRUST — 智囊团融合报告')), false);
  } finally {
    for (const [name, run] of Object.entries(originals)) PROVIDERS[name].run = run;
    process.stderr.write = stderrWrite;
    console.log = consoleLog;
    if (stdinDescriptor) Object.defineProperty(process.stdin, 'isTTY', stdinDescriptor);
    else delete process.stdin.isTTY;
  }
});

test('Unknown judge fails before any generator runs', async () => {
  const originals = Object.fromEntries(Object.entries(PROVIDERS).map(([name, provider]) => [name, provider.run]));
  const stdinDescriptor = Object.getOwnPropertyDescriptor(process.stdin, 'isTTY');
  let calls = 0;
  for (const provider of Object.values(PROVIDERS)) {
    provider.run = async () => { calls++; throw new Error('must not run'); };
  }
  Object.defineProperty(process.stdin, 'isTTY', { configurable: true, value: true });

  try {
    await assert.rejects(main(['--no-save', '--judge-model', 'unknown', 'test question']), /Unknown judge model: unknown/);
    assert.equal(calls, 0);
  } finally {
    for (const [name, run] of Object.entries(originals)) PROVIDERS[name].run = run;
    if (stdinDescriptor) Object.defineProperty(process.stdin, 'isTTY', stdinDescriptor);
    else delete process.stdin.isTTY;
  }
});

test('Unexpected judge extractor error is not degraded', async () => {
  const originals = Object.fromEntries(Object.entries(PROVIDERS).map(([name, provider]) => [name, provider.run]));
  const originalExtract = PROVIDERS.claude.extractJudgeText;
  const stdinDescriptor = Object.getOwnPropertyDescriptor(process.stdin, 'isTTY');
  PROVIDERS.claude.run = async prompt => prompt.includes('你是一个高级技术评审')
    ? { stdout: '{}', stderr: '', code: 0, error_type: null }
    : { stdout: JSON.stringify({ result: 'claude generator' }), stderr: '', code: 0, error_type: null };
  PROVIDERS.codex.run = async () => ({
    stdout: JSON.stringify({ type: 'item.completed', item: { type: 'agent_message', text: 'codex generator' } }),
    stderr: '', code: 0, error_type: null,
  });
  PROVIDERS.gemini.run = async () => ({
    stdout: JSON.stringify({ response: 'gemini generator' }), stderr: '', code: 0, error_type: null,
  });
  PROVIDERS.claude.extractJudgeText = () => { throw new Error('extractor broke'); };
  Object.defineProperty(process.stdin, 'isTTY', { configurable: true, value: true });

  try {
    await assert.rejects(main(['--no-save', 'test question']), /extractor broke/);
  } finally {
    for (const [name, run] of Object.entries(originals)) PROVIDERS[name].run = run;
    PROVIDERS.claude.extractJudgeText = originalExtract;
    if (stdinDescriptor) Object.defineProperty(process.stdin, 'isTTY', stdinDescriptor);
    else delete process.stdin.isTTY;
  }
});
