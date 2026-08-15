'use strict';

const { spawnSync } = require('child_process');
const { join } = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { PROVIDERS } = require('./providers/index.js');

test('MCP tools/list exposes every provider and the with selector', () => {
  const request = JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' });
  const result = spawnSync(process.execPath, [join(__dirname, 'server.js')], {
    input: `${request}\n`,
    encoding: 'utf8',
    timeout: 5000,
  });

  assert.equal(result.status, 0, result.stderr);
  const response = JSON.parse(result.stdout.trim());
  const schema = response.result.tools[0].inputSchema;
  assert.deepEqual(schema.properties.with.items.enum, Object.keys(PROVIDERS));
  assert.deepEqual(schema.properties.skip.items.enum, Object.keys(PROVIDERS));
  assert.deepEqual(schema.properties.only.enum, Object.keys(PROVIDERS));
});
