'use strict';

const claude = require('./claude.js');
const codex = require('./codex.js');
const gemini = require('./gemini.js');
const cursor = require('./cursor.js');
const { deepseek, grok, missingKeyResult } = require('./openai-compatible.js');

const PROVIDERS = {
  claude: cliProvider('claude', 'claude', claude),
  codex: cliProvider('codex', 'codex', codex),
  gemini: cliProvider('gemini', 'agy', gemini),
  cursor: { ...cliProvider('cursor', 'cursor-agent', cursor), optional: true },
  kimi: {
    name: 'kimi',
    cmd: 'claude',
    ...claude,
    optional: true,
    getArgs(prompt) {
      return getKimiArgs(prompt);
    },
    run(prompt, runner) {
      const apiKey = process.env.KIMI_API_KEY;
      if (!apiKey) return Promise.resolve(missingKeyResult());
      return runner.process('claude', getKimiArgs(prompt), {
        env: {
          ANTHROPIC_BASE_URL: 'https://api.kimi.com/coding/',
          ANTHROPIC_API_KEY: apiKey,
          ANTHROPIC_MODEL: kimiModel(),
          ANTHROPIC_DEFAULT_FABLE_MODEL: kimiModel(),
          ANTHROPIC_DEFAULT_OPUS_MODEL: kimiModel(),
          ANTHROPIC_DEFAULT_SONNET_MODEL: kimiModel(),
          ANTHROPIC_DEFAULT_HAIKU_MODEL: kimiModel(),
          CLAUDE_CODE_SUBAGENT_MODEL: kimiModel(),
          CLAUDE_CODE_EFFORT_LEVEL: 'high',
          CLAUDE_CODE_AUTO_COMPACT_WINDOW: '262144',
          CLAUDE_CODE_MAX_CONTEXT_TOKENS: '262144',
        },
      });
    },
  },
  deepseek: { ...deepseek, optional: true },
  grok: { ...grok, optional: true },
};

function cliProvider(name, cmd, adapter) {
  return {
    name,
    cmd,
    ...adapter,
    run(prompt, runner) {
      return runner.process(cmd, adapter.getArgs(prompt), {});
    },
  };
}

function kimiModel() {
  return process.env.BRAINTRUST_KIMI_MODEL || 'k3-256k';
}

function getKimiArgs(prompt) {
  return [...claude.getArgs(prompt), '--permission-mode', 'plan'];
}

/**
 * Get the list of providers to run, excluding skipped ones.
 * @param {string[]} skip - Provider names to skip
 * @param {string[]} withProviders - Optional provider names to add
 * @returns {Array<{name, run, adapt, extractJudgeText}>}
 */
function getActiveProviders(skip = [], withProviders = []) {
  assertKnownProviders(skip, 'skip');
  assertKnownProviders(withProviders, 'with');
  const enabledOptional = new Set(withProviders);
  return Object.values(PROVIDERS).filter(p =>
    !skip.includes(p.name) && (!p.optional || enabledOptional.has(p.name))
  );
}

function assertKnownProviders(names, option) {
  for (const name of names) {
    if (!Object.hasOwn(PROVIDERS, name)) {
      throw new Error(`Unknown provider in --${option}: ${name}. Use ${Object.keys(PROVIDERS).join('|')}.`);
    }
  }
}

module.exports = { PROVIDERS, getActiveProviders, assertKnownProviders };
