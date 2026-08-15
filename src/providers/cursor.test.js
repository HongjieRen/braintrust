'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const cursor = require('./cursor.js');

test('Cursor uses JSON print mode and read-only ask mode', () => {
  const args = cursor.getArgs('review this');
  assert.deepEqual(args, ['-p', 'review this', '--output-format', 'json', '--mode', 'ask']);
  assert.equal(args.includes('--force'), false);
  assert.equal(args.includes('--yolo'), false);
});

test('Cursor reads the final JSON result', () => {
  const result = cursor.adapt({ stdout: JSON.stringify({ result: 'answer' }), stderr: '', code: 0 });
  assert.deepEqual(result, { content: 'answer', model: 'cursor', parse_mode: 'json' });
});

test('Cursor falls back on malformed JSON', () => {
  const result = cursor.adapt({ stdout: 'not json', stderr: '', code: 0 });
  assert.deepEqual(result, { content: 'not json', model: 'cursor', parse_mode: 'fallback' });
});
