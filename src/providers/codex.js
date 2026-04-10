'use strict';

/**
 * Get CLI args for invoking codex as a generator.
 * NOTE: --json MUST come before the prompt argument — codex's parser treats
 * args after the prompt text as [COMMAND] positional, not as options.
 * @param {string} fullPrompt - System + user prompt combined
 * @returns {string[]}
 */
function getArgs(fullPrompt) {
  return ['exec', '--json', '--skip-git-repo-check', '--ephemeral', fullPrompt];
}

/**
 * Parse codex's JSONL stdout into { content, model, parse_mode }.
 * Codex streams newline-delimited JSON events. We look for the last
 * item.completed event with an agent_message type.
 * @param {{ stdout: string, stderr: string, code: number|string }} raw
 * @returns {{ content: string, model: string, parse_mode: string }}
 */
function adapt(raw) {
  try {
    const lines = raw.stdout.trim().split('\n');
    const events = [];
    for (const l of lines) {
      try { events.push(JSON.parse(l)); } catch { /* skip non-JSON lines */ }
    }

    // Prefer agent_message events
    const agentMsg = events
      .filter(e => e.type === 'item.completed' && e.item?.type === 'agent_message')
      .pop();
    if (agentMsg?.item?.text) {
      return { content: agentMsg.item.text, model: 'codex', parse_mode: 'jsonl' };
    }

    // Fallback: last completed event with any text
    const lastWithText = events
      .filter(e => e.type === 'item.completed' && e.item?.text)
      .pop();
    if (lastWithText?.item?.text) {
      return { content: lastWithText.item.text, model: 'codex', parse_mode: 'jsonl' };
    }
  } catch { /* fall through */ }

  return fallback(raw.stdout);
}

/**
 * Extract text from codex judge output (same JSONL format).
 * @param {{ stdout: string }} raw
 * @returns {string}
 */
function extractJudgeText(raw) {
  const lines = raw.stdout.trim().split('\n').reverse();
  for (const l of lines) {
    try {
      const e = JSON.parse(l);
      if (e.item?.text) return e.item.text;
    } catch { /* skip */ }
  }
  return raw.stdout.trim();
}

function fallback(stdout) {
  return { content: stdout.slice(-2000).trim() || '[no output]', model: 'codex', parse_mode: 'fallback' };
}

module.exports = { getArgs, adapt, extractJudgeText };
