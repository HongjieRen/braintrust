'use strict';

/**
 * Get CLI args for invoking gemini as a generator.
 * --allowed-mcp-server-names skips the broken feishu-mcp server that
 * causes ~15s startup delay and connection errors.
 * @param {string} fullPrompt - System + user prompt combined
 * @returns {string[]}
 */
function getArgs(fullPrompt) {
  return ['-p', fullPrompt, '-o', 'json', '--allowed-mcp-server-names', 'sequential-thinking'];
}

/**
 * Parse gemini's JSON stdout into { content, model, parse_mode }.
 * Gemini prepends an MCP status line before the JSON output:
 *   "MCP issues detected. Run /mcp list for status."
 * We skip to the first '{' to handle this.
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
 * Handles potential JSON prefix noise using brace counter for robustness.
 * @param {string} stdout
 * @returns {string|null}
 */
function parseGeminiResponse(stdout) {
  const jsonStart = stdout.indexOf('{');
  if (jsonStart === -1) return null;

  // Use brace counter to find the complete JSON object
  let depth = 0;
  let jsonEnd = -1;
  for (let i = jsonStart; i < stdout.length; i++) {
    if (stdout[i] === '{') depth++;
    else if (stdout[i] === '}') {
      depth--;
      if (depth === 0) { jsonEnd = i + 1; break; }
    }
  }

  const jsonStr = jsonEnd !== -1 ? stdout.slice(jsonStart, jsonEnd) : stdout.slice(jsonStart);
  const j = JSON.parse(jsonStr);

  if (j.response) return j.response;

  // Handle nested response object
  for (const v of Object.values(j)) {
    if (v && typeof v === 'object' && typeof v.response === 'string') return v.response;
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
