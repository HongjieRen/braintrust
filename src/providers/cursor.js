'use strict';

function getArgs(fullPrompt) {
  return ['-p', fullPrompt, '--output-format', 'json', '--mode', 'ask'];
}

function adapt(raw) {
  try {
    const response = JSON.parse(raw.stdout);
    if (typeof response.result === 'string') {
      return { content: response.result, model: 'cursor', parse_mode: 'json' };
    }
  } catch { /* fall through */ }
  return fallback(raw.stdout);
}

function extractJudgeText(raw) {
  return adapt(raw).content;
}

function fallback(stdout) {
  return { content: stdout.slice(-2000).trim() || '[no output]', model: 'cursor', parse_mode: 'fallback' };
}

module.exports = { getArgs, adapt, extractJudgeText };
