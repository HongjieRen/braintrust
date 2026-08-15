'use strict';

/**
 * Get CLI args for invoking Gemini through Antigravity CLI.
 * @param {string} fullPrompt - System + user prompt combined
 * @returns {string[]}
 */
function getArgs(fullPrompt) {
  return ['-p', fullPrompt, '--output-format', 'json', '--disable-slash-commands'];
}

/**
 * Parse Antigravity's JSON stdout into { content, model, parse_mode }.
 * We scan complete JSON objects to tolerate warning lines before the payload.
 * @param {{ stdout: string, stderr: string, code: number|string }} raw
 * @returns {{ content: string, model: string, parse_mode: string }}
 */
function adapt(raw) {
  try {
    const response = parseGeminiResponse(raw.stdout);
    if (response) return { content: response, model: 'gemini', parse_mode: 'json' };
  } catch { /* fall through */ }
  return fallback(raw.stdout);
}

/**
 * Extract the response text from gemini's JSON output.
 * Handles prefix noise and braces inside JSON strings.
 * @param {string} stdout
 * @returns {string|null}
 */
function parseGeminiResponse(stdout) {
  for (let start = stdout.indexOf('{'); start !== -1; start = stdout.indexOf('{', start + 1)) {
    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let i = start; i < stdout.length; i++) {
      const char = stdout[i];
      if (inString) {
        if (escaped) escaped = false;
        else if (char === '\\') escaped = true;
        else if (char === '"') inString = false;
        continue;
      }
      if (char === '"') inString = true;
      else if (char === '{') depth++;
      else if (char === '}' && --depth === 0) {
        try {
          const j = JSON.parse(stdout.slice(start, i + 1));
          if (Object.hasOwn(j, 'status') && j.status !== 'SUCCESS') return null;
          if (typeof j.response === 'string') return j.response;
          for (const v of Object.values(j)) {
            if (v && typeof v === 'object' && typeof v.response === 'string') return v.response;
          }
        } catch { /* try the next object */ }
        break;
      }
    }
  }
  return null;
}

/**
 * Extract text from gemini judge output.
 * @param {{ stdout: string }} raw
 * @returns {string}
 */
function extractJudgeText(raw) {
  try {
    const response = parseGeminiResponse(raw.stdout);
    if (response) return response;
  } catch { /* fall through */ }
  return raw.stdout.trim();
}

function fallback(stdout) {
  return { content: stdout.slice(-2000).trim() || '[no output]', model: 'gemini', parse_mode: 'fallback' };
}

module.exports = { getArgs, adapt, extractJudgeText, parseGeminiResponse };
