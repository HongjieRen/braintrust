'use strict';

const { mkdirSync, existsSync } = require('fs');
const { dirname } = require('path');
const { DB_PATH } = require('../config.js');

let _db = null;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS runs (
  ts              TEXT PRIMARY KEY,
  question        TEXT NOT NULL,
  domain          TEXT,
  variant         TEXT,
  judge_model     TEXT,
  providers       TEXT,
  judge_report    TEXT,
  judge_summary   TEXT,
  parse_score_avg REAL,
  judge_score     REAL,
  state           TEXT DEFAULT 'pending_reflect',
  created_at      INTEGER NOT NULL,
  reflected_at    INTEGER
);

CREATE TABLE IF NOT EXISTS embeddings (
  ts       TEXT PRIMARY KEY REFERENCES runs(ts),
  model    TEXT NOT NULL,
  vector   BLOB NOT NULL,
  dim      INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS lessons (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  from_run   TEXT REFERENCES runs(ts),
  domain     TEXT,
  lesson     TEXT NOT NULL,
  active     INTEGER DEFAULT 1,
  upvotes    INTEGER DEFAULT 0,
  downvotes  INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS skills (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  name         TEXT NOT NULL UNIQUE,
  description  TEXT NOT NULL,
  template     TEXT NOT NULL,
  domain       TEXT,
  from_run     TEXT REFERENCES runs(ts),
  embedding    BLOB,
  use_count    INTEGER DEFAULT 0,
  success_rate REAL,
  active       INTEGER DEFAULT 1,
  created_at   INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS judge_stats (
  judge_model TEXT NOT NULL,
  domain      TEXT NOT NULL,
  successes   INTEGER DEFAULT 0,
  failures    INTEGER DEFAULT 0,
  total       INTEGER DEFAULT 0,
  PRIMARY KEY (judge_model, domain)
);

CREATE TABLE IF NOT EXISTS iterations (
  run_ts              TEXT REFERENCES runs(ts),
  round               INTEGER NOT NULL,
  provider            TEXT NOT NULL,
  content             TEXT NOT NULL,
  disagreement_score  REAL,
  PRIMARY KEY (run_ts, round, provider)
);

CREATE TABLE IF NOT EXISTS feedback (
  run_ts     TEXT REFERENCES runs(ts),
  vote       INTEGER NOT NULL,
  note       TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS eval_results (
  run_id          TEXT NOT NULL,
  question_id     TEXT NOT NULL,
  policy_version  INTEGER NOT NULL,
  score_covers    REAL,
  score_hallu     REAL,
  score_action    REAL,
  score_avg       REAL,
  created_at      INTEGER NOT NULL,
  PRIMARY KEY (run_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_runs_domain ON runs(domain) WHERE state='reflected';
CREATE INDEX IF NOT EXISTS idx_lessons_domain_active ON lessons(domain, active);
CREATE INDEX IF NOT EXISTS idx_runs_created ON runs(created_at);
`;

/**
 * Get or initialize the SQLite database connection.
 * Creates the database file and schema on first call.
 * @returns {import('better-sqlite3').Database}
 */
function getDb() {
  if (_db) return _db;

  // Ensure state directory exists
  const dir = dirname(DB_PATH);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  try {
    const Database = require('better-sqlite3');
    _db = new Database(DB_PATH);
    _db.pragma('journal_mode = WAL');
    _db.pragma('foreign_keys = ON');
    _db.exec(SCHEMA);
    return _db;
  } catch (err) {
    if (err.code === 'MODULE_NOT_FOUND') {
      process.stderr.write('[memory] better-sqlite3 not installed — run: npm install\n');
      return null;
    }
    throw err;
  }
}

/**
 * Insert a completed run into the database.
 * @param {object} run
 * @param {string} run.ts - Timestamp string (primary key)
 * @param {string} run.question
 * @param {string} [run.domain]
 * @param {string} [run.variant]
 * @param {string} [run.judgeModel]
 * @param {string[]} [run.providers]
 * @param {string|null} [run.judgeReport]
 * @param {number} [run.parseScoreAvg]
 */
function insertRun(run) {
  const db = getDb();
  if (!db) return;

  const judgeReport = run.judgeReport || null;
  const judgeSummary = judgeReport ? judgeReport.slice(0, 800) : null;

  db.prepare(`
    INSERT OR IGNORE INTO runs
      (ts, question, domain, variant, judge_model, providers,
       judge_report, judge_summary, parse_score_avg, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    run.ts,
    run.question,
    run.domain || null,
    run.variant || 'general',
    run.judgeModel || null,
    JSON.stringify(run.providers || []),
    judgeReport,
    judgeSummary,
    run.parseScoreAvg || null,
    Date.now()
  );
}

/**
 * Update a run's state (e.g., pending_reflect → reflected).
 */
function updateRunState(ts, state, extra = {}) {
  const db = getDb();
  if (!db) return;

  const fields = ['state = ?'];
  const values = [state];

  if (extra.judgeScore !== undefined) { fields.push('judge_score = ?'); values.push(extra.judgeScore); }
  if (extra.reflectedAt !== undefined) { fields.push('reflected_at = ?'); values.push(extra.reflectedAt); }

  values.push(ts);
  db.prepare(`UPDATE runs SET ${fields.join(', ')} WHERE ts = ?`).run(...values);
}

module.exports = { getDb, insertRun, updateRunState };
