'use strict';

// Memory layer — Phase 1 implementation (retrieve, embed, persist)
// Currently exports stubs for Phase 0 compatibility.
// Full implementation in Phase 1.

const { getDb, insertRun, updateRunState } = require('./db.js');

/**
 * Persist a run to the database after artifacts are saved.
 * This is the Phase 0 write path — no embedding yet.
 * @param {object} opts
 */
function persistRun(opts) {
  try {
    insertRun(opts);
  } catch (err) {
    process.stderr.write(`[memory] Failed to persist run: ${err.message}\n`);
  }
}

/**
 * Retrieve similar past runs for few-shot injection.
 * Phase 0 stub — returns empty array until Phase 1 is implemented.
 * @returns {Promise<Array>}
 */
async function retrieve() {
  return [];
}

module.exports = { getDb, persistRun, retrieve, updateRunState };
