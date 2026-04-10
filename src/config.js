'use strict';

const { join } = require('path');

const PROJECT_ROOT = join(__dirname, '..');
const OUTPUT_DIR = join(PROJECT_ROOT, 'ai-outputs');
const STATE_DIR = join(OUTPUT_DIR, '.state');
const DB_PATH = join(STATE_DIR, 'braintrust.sqlite');
const POLICY_PATH = join(STATE_DIR, 'policy.json');
const REFLECTOR_LOG = join(STATE_DIR, 'reflector.log');

const DEFAULT_TIMEOUT_S = 120;
const DEFAULT_JUDGE_MODEL = 'claude';
const DEFAULT_MEMORY_K = 3;
const MAX_CONTEXT_CHARS = 30000;
const CONTEXT_FILE_MAX = 8000;

// Memory injection hard limits (chars)
const MEMORY_INJECT_LIMIT = 1500;
const LESSONS_INJECT_LIMIT = 600;
const SKILLS_INJECT_LIMIT = 800;

// Novelty check threshold: cosine similarity above this → prompt reuse
const NOVELTY_THRESHOLD = 0.9;

// Critique-revise disagreement threshold
const DISAGREE_THRESHOLD = 0.5;

// Economy mode: disable all extra LLM calls
const ECONOMY = process.env.BRAINTRUST_ECONOMY === '1';

// Reflector model: codex with gpt-5.4-mini.
// Chosen over haiku/flash for better Chinese text quality.
// Must differ from the default judge model (claude) to avoid self-evaluation bias.
const REFLECTOR_MODEL = 'gpt-5.4-mini';
const REFLECTOR_CMD = 'codex';
const REFLECTOR_ARGS_PREFIX = ['exec', '--json', '--skip-git-repo-check', '--ephemeral', '-m', REFLECTOR_MODEL];

module.exports = {
  PROJECT_ROOT,
  OUTPUT_DIR,
  STATE_DIR,
  DB_PATH,
  POLICY_PATH,
  REFLECTOR_LOG,
  DEFAULT_TIMEOUT_S,
  DEFAULT_JUDGE_MODEL,
  DEFAULT_MEMORY_K,
  MAX_CONTEXT_CHARS,
  CONTEXT_FILE_MAX,
  MEMORY_INJECT_LIMIT,
  LESSONS_INJECT_LIMIT,
  SKILLS_INJECT_LIMIT,
  NOVELTY_THRESHOLD,
  DISAGREE_THRESHOLD,
  ECONOMY,
  REFLECTOR_MODEL,
  REFLECTOR_CMD,
  REFLECTOR_ARGS_PREFIX,
};
