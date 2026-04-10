'use strict';

/**
 * Get CLI args for invoking claude as a generator.
 * @param {string} fullPrompt - System + user prompt combined
 * @returns {string[]}
 */
function getArgs(fullPrompt) {
  return ['-p', fullPrompt, '--output-format', 'json', '--no-session-persistence'];
}

/**
 * Parse claude's JSON stdout into { content, model, parse_mode }.
 * @param {{ stdout: string, stderr: string, code: number|string }} raw
 * @returns {{ content: string, model: string, parse_mode: string }}
 */
function adapt(raw) {
  try {
    const j = JSON.parse(raw.stdout);
    const content = j.result || j.content || '';
    const model = Object.keys(j.modelUsage || {})[0] || 'claude';
    return { content, model, parse_mode: 'json' };
  } catch {
    return fallback(raw.stdout);
  }
}

/**
 * Extract text from claude judge output.
 * @param {{ stdout: string }} raw
 * @returns {string}
 */
function extractJudgeText(raw) {
  try {
    return JSON.parse(raw.stdout).result || raw.stdout.trim();
  } catch {
    return raw.stdout.trim();
  }
}

function fallback(stdout) {
  return { content: stdout.slice(-2000).trim() || '[no output]', model: 'claude', parse_mode: 'fallback' };
}

module.exports = { getArgs, adapt, extractJudgeText };
