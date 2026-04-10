'use strict';

const claude = require('./claude.js');
const codex = require('./codex.js');
const gemini = require('./gemini.js');

const PROVIDERS = {
  claude: { name: 'claude', cmd: 'claude', ...claude },
  codex:  { name: 'codex',  cmd: 'codex',  ...codex },
  gemini: { name: 'gemini', cmd: 'gemini', ...gemini },
};

/**
 * Get the list of providers to run, excluding skipped ones.
 * @param {string[]} skip - Provider names to skip
 * @returns {Array<{name, cmd, getArgs, adapt, extractJudgeText}>}
 */
function getActiveProviders(skip = []) {
  return Object.values(PROVIDERS).filter(p => !skip.includes(p.name));
}

module.exports = { PROVIDERS, getActiveProviders };
