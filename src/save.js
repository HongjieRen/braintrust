'use strict';

const { writeFileSync, mkdirSync } = require('fs');
const { join } = require('path');

/**
 * Save all run artifacts to disk.
 * Creates: raw/*.txt, normalized.json, report.md, summary.md
 *
 * @param {string} runDir - Absolute path to the run directory
 * @param {string} question - The user's question
 * @param {object} raws - Map of provider name → raw process result
 * @param {Array} results - Normalized provider results
 * @param {string|null} judgeOutput - Judge fusion report markdown
 */
function saveArtifacts(runDir, question, raws, results, judgeOutput) {
  mkdirSync(join(runDir, 'raw'), { recursive: true });

  // Save raw provider outputs
  for (const [name, raw] of Object.entries(raws)) {
    writeFileSync(join(runDir, 'raw', `${name}.txt`), raw.stdout || '');
  }

  // Save normalized JSON
  writeFileSync(join(runDir, 'normalized.json'), JSON.stringify(results, null, 2));

  // Save full report (all provider outputs + judge)
  writeFileSync(join(runDir, 'report.md'), buildReport(question, results, judgeOutput));

  // Save summary (question + judge only, token-efficient for context loading)
  writeFileSync(join(runDir, 'summary.md'), buildSummary(question, results, judgeOutput));
}

/**
 * Build the full report markdown.
 */
function buildReport(question, results, judgeOutput) {
  const lines = [
    `**问题**: ${question}`,
    `**时间**: ${new Date().toISOString()}`,
    '',
    '---',
    '',
  ];

  for (const r of results) {
    const timing = `${(r.duration_ms / 1000).toFixed(1)}s`;
    const warn = r.error ? ` ⚠ ${r.error}` : '';
    lines.push(`## ${r.provider} (${timing}${warn})`);
    lines.push('');
    lines.push(r.content || '[no content]');
    lines.push('');
    lines.push('---');
    lines.push('');
  }

  if (judgeOutput) {
    lines.push('# 🧠 BRAINTRUST — 智囊团融合报告');
    lines.push('');
    lines.push(judgeOutput);
  }

  return lines.join('\n');
}

/**
 * Build the summary markdown (question + judge only, ~500-1000 chars).
 * Used for token-efficient context loading via --context-dir.
 */
function buildSummary(question, results, judgeOutput) {
  const lines = [
    `**问题**: ${question}`,
    `**时间**: ${new Date().toISOString()}`,
    '',
  ];

  if (judgeOutput) {
    lines.push(judgeOutput);
  } else {
    // No judge: include key_claims from each successful model
    for (const r of results) {
      if (!r.error && r.key_claims.length) {
        lines.push(`## ${r.provider}`);
        lines.push(r.key_claims.join('\n'));
        lines.push('');
      }
    }
  }

  return lines.join('\n');
}

module.exports = { saveArtifacts };
