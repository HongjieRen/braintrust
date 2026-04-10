'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { extractSection } = require('./normalize.js');

// ─── Fixture 1: Gemini bold headers ──────────────────────────────────────────
// Gemini often wraps section tags in ** bold **

test('Fixture 1: gemini **bold** tag format', () => {
  const text = `
**[核心结论]**
结论一：使用 Redis Cluster
结论二：读写分离

**[详细方案]**
1. 部署 3 主 3 从

**[关键假设]**
假设一：QPS < 100k

**[风险与不确定性]**
风险：网络分区问题
`;

  const claims = extractSection(text, '核心结论');
  assert.ok(claims.length >= 2, `Expected ≥2 claims, got ${claims.length}: ${JSON.stringify(claims)}`);
  assert.ok(claims.some(c => c.includes('Redis')), 'Should contain Redis claim');
  assert.ok(claims.some(c => c.includes('读写分离')), 'Should contain 读写分离 claim');

  const risks = extractSection(text, '风险与不确定性');
  assert.ok(risks.length >= 1, `Expected ≥1 risk, got ${risks.length}`);
  assert.ok(risks.some(r => r.includes('网络分区')), 'Should contain 网络分区 risk');
});

// ─── Fixture 2: Codex dialogue tail contamination ─────────────────────────────
// Codex sometimes includes conversational text after the structured output

test('Fixture 2: codex trailing dialogue noise', () => {
  const text = `
[核心结论]
结论一：采用微服务架构
结论二：使用 Kubernetes

[详细方案]
详细内容在这里

[关键假设]
假设：团队有 K8s 经验

[风险与不确定性]
风险：运维复杂度高

如果你需要更多帮助，请告诉我！
我可以进一步解释任何部分。
`;

  const claims = extractSection(text, '核心结论');
  assert.ok(claims.length >= 2, `Expected ≥2 claims, got ${claims.length}`);
  assert.ok(!claims.some(c => c.includes('告诉我')), 'Should not include trailing dialogue');

  const risks = extractSection(text, '风险与不确定性');
  assert.ok(risks.length >= 1, `Expected ≥1 risk, got ${risks.length}`);
  assert.ok(!risks.some(r => r.includes('告诉我')), 'Trailing dialogue should not leak into risks');
});

// ─── Fixture 3: --- separator contamination ───────────────────────────────────
// Some models include --- separator lines inside sections

test('Fixture 3: --- separator noise removal', () => {
  const text = `
[核心结论]
---
结论一：选择 PostgreSQL
---
结论二：使用连接池
---

[关键假设]
---
假设：单机即可满足需求

[风险与不确定性]
---
风险一：数据量超预期
风险二：并发瓶颈
`;

  const claims = extractSection(text, '核心结论');
  assert.ok(claims.length >= 2, `Expected ≥2 claims after stripping ---, got ${claims.length}: ${JSON.stringify(claims)}`);
  assert.ok(!claims.some(c => c === '---'), 'Should not contain raw --- separators');
  assert.ok(claims.some(c => c.includes('PostgreSQL')), 'Should contain PostgreSQL claim');

  const risks = extractSection(text, '风险与不确定性');
  assert.ok(risks.length >= 2, `Expected ≥2 risks, got ${risks.length}`);
  assert.ok(!risks.some(r => r === '---'), 'Should not contain raw --- separators in risks');
});

// ─── Fixture 4: English tags ──────────────────────────────────────────────────

test('Fixture 4: English tag variants', () => {
  const text = `
[Key Claims]
Claim 1: Use distributed caching
Claim 2: Implement rate limiting

[Assumptions]
Assumption: Traffic < 10k RPS

[Risks]
Risk: Cache invalidation complexity
`;

  const claims = extractSection(text, 'Key Claims');
  assert.ok(claims.length >= 2, `Expected ≥2 English claims, got ${claims.length}`);
  assert.ok(claims.some(c => c.includes('caching')), 'Should contain caching claim');
});

// ─── Fixture 5: Empty / missing section ───────────────────────────────────────

test('Fixture 5: missing section returns empty array', () => {
  const text = '[核心结论]\n结论一：这是结论\n';
  const risks = extractSection(text, '风险与不确定性');
  assert.deepEqual(risks, [], 'Missing section should return []');
});
