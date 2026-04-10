'use strict';

/**
 * Reflector — async background process (Phase 2)
 *
 * Invoked as a detached child: node reflector.js --run <ts>
 *
 * Verifier ≠ Executor principle:
 *   Uses REFLECTOR_CMD (codex gpt-5.4-mini) which differs from the default
 *   judge (claude). Avoids self-evaluation bias.
 *
 * One LLM call, three outputs:
 *   1. lessons  — 1-3 reusable rules (≤30 chars each)
 *   2. skills   — 0-2 reusable prompt templates (Voyager skill library)
 *   3. judge_score — 1-5 quality rating for the judge report
 */

const { appendFileSync } = require('fs');
const { spawn } = require('child_process');
const { join } = require('path');

const {
  REFLECTOR_CMD,
  REFLECTOR_ARGS_PREFIX,
  REFLECTOR_LOG,
  DB_PATH,
  ECONOMY,
} = require('./config.js');

// ─── Logging ──────────────────────────────────────────────────────────────────

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  try { appendFileSync(REFLECTOR_LOG, line); } catch { /* ignore */ }
}

// ─── Process runner (no timeout — reflector runs offline) ─────────────────────

function run(cmd, args) {
  return new Promise((resolve) => {
    const proc = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    proc.stdout.on('data', d => { stdout += d; });
    proc.stderr.on('data', d => { stderr += d; });
    proc.on('close', code => resolve({ stdout, stderr, code }));
    proc.on('error', err => resolve({ stdout: '', stderr: err.message, code: -1 }));
  });
}

// ─── Extract text from codex JSONL ────────────────────────────────────────────

function extractCodexText(stdout) {
  const lines = stdout.trim().split('\n').reverse();
  for (const l of lines) {
    try {
      const e = JSON.parse(l);
      if (e.item?.text) return e.item.text;
    } catch { /* skip */ }
  }
  return stdout.trim();
}

// ─── Build reflector prompt ───────────────────────────────────────────────────

function buildReflectorPrompt(question, judgeReport) {
  return `你是一个 AI 系统的元认知分析器。以下是一次 AI 智囊团的讨论结果，请完成 3 个任务：

问题: ${question}

Judge 融合报告:
${judgeReport.slice(0, 3000)}

---

**任务 1** — 提炼 1-3 条可复用的 lesson（每条 ≤30字，可操作的规则，不是泛泛而谈）
**任务 2** — 抽取 0-2 条 skill（命名 + 描述 + 可注入的 prompt 片段，参考示例格式）
**任务 3** — 给 judge 报告质量评分 1-5 分（具体性 × 可行性 × 完整度）

严格按以下 JSON 格式输出，不要有任何额外文字：
{
  "lessons": [
    {"domain": "general", "lesson": "简短可操作规则，≤30字"}
  ],
  "skills": [
    {
      "name": "snake_case_name",
      "description": "一句话描述用途",
      "template": "可直接注入 prompt 的模板文本",
      "domain": "general"
    }
  ],
  "judge_score": 4,
  "judge_weakness": "一句话说明 judge 报告最大的不足"
}

示例 skill:
{
  "name": "constraint_first_analysis",
  "description": "架构决策前先列约束，避免方案偏离实际",
  "template": "请先列出至少3个硬约束（性能/成本/团队能力），再给出候选方案。",
  "domain": "architecture"
}`;
}

// ─── Parse reflector JSON output ──────────────────────────────────────────────

function parseReflectorOutput(text) {
  // Find JSON object in the response
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('No JSON object found in reflector output');

  const raw = JSON.parse(text.slice(start, end + 1));

  return {
    lessons: Array.isArray(raw.lessons) ? raw.lessons : [],
    skills: Array.isArray(raw.skills) ? raw.skills : [],
    judgeScore: typeof raw.judge_score === 'number' ? raw.judge_score : null,
    judgeWeakness: raw.judge_weakness || null,
  };
}

// ─── Persist to DB ────────────────────────────────────────────────────────────

function persistReflections(ts, { lessons, skills, judgeScore }) {
  let db;
  try {
    const Database = require('better-sqlite3');
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  } catch (err) {
    log(`DB open failed: ${err.message}`);
    return;
  }

  const now = Date.now();

  // Insert lessons
  const insertLesson = db.prepare(`
    INSERT INTO lessons (from_run, domain, lesson, created_at)
    VALUES (?, ?, ?, ?)
  `);
  for (const l of lessons) {
    if (!l.lesson || l.lesson.length > 120) continue; // basic validation
    insertLesson.run(ts, l.domain || 'general', l.lesson, now);
  }

  // Insert skills
  const insertSkill = db.prepare(`
    INSERT OR IGNORE INTO skills (name, description, template, domain, from_run, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  for (const s of skills) {
    if (!s.name || !s.template) continue;
    insertSkill.run(
      s.name, s.description || '', s.template, s.domain || 'general', ts, now
    );
  }

  // Update run state + judge_score
  const updates = ['state = ?', 'reflected_at = ?'];
  const vals = ['reflected', now];
  if (judgeScore !== null) { updates.push('judge_score = ?'); vals.push(judgeScore); }
  vals.push(ts);
  db.prepare(`UPDATE runs SET ${updates.join(', ')} WHERE ts = ?`).run(...vals);

  db.close();
}

// ─── Main reflect() ───────────────────────────────────────────────────────────

async function reflect(ts) {
  if (ECONOMY) {
    log(`[${ts}] ECONOMY mode — reflector skipped`);
    return;
  }

  log(`[${ts}] starting reflection`);

  // Load run data from DB
  let db;
  try {
    const Database = require('better-sqlite3');
    db = new Database(DB_PATH);
  } catch (err) {
    log(`[${ts}] DB open failed: ${err.message}`);
    return;
  }

  const run = db.prepare('SELECT question, judge_report FROM runs WHERE ts = ?').get(ts);
  db.close();

  if (!run) { log(`[${ts}] run not found in DB`); return; }
  if (!run.judge_report) { log(`[${ts}] no judge_report — skipping (per design: only reflect judged runs)`); return; }

  const prompt = buildReflectorPrompt(run.question, run.judge_report);

  log(`[${ts}] calling ${REFLECTOR_CMD} with ${REFLECTOR_ARGS_PREFIX.join(' ')}`);
  const raw = await run_reflector(prompt);

  if (!raw.stdout) {
    log(`[${ts}] empty output from reflector (code=${raw.code}): ${raw.stderr.slice(0, 200)}`);
    return;
  }

  const text = extractCodexText(raw.stdout);

  let parsed;
  try {
    parsed = parseReflectorOutput(text);
  } catch (err) {
    log(`[${ts}] JSON parse failed: ${err.message}\nRaw: ${text.slice(0, 300)}`);
    return;
  }

  log(`[${ts}] lessons=${parsed.lessons.length} skills=${parsed.skills.length} score=${parsed.judgeScore}`);

  persistReflections(ts, parsed);
  log(`[${ts}] done`);
}

// We can't name the function run() due to conflict above — use alias
async function run_reflector(prompt) {
  return run(REFLECTOR_CMD, [...REFLECTOR_ARGS_PREFIX, prompt]);
}

// ─── CLI entry point ──────────────────────────────────────────────────────────

if (require.main === module) {
  const args = process.argv.slice(2);
  const runIdx = args.indexOf('--run');
  if (runIdx === -1 || !args[runIdx + 1]) {
    process.stderr.write('Usage: node reflector.js --run <ts>\n');
    process.exit(1);
  }
  const ts = args[runIdx + 1];
  reflect(ts).catch(err => {
    log(`[${ts}] uncaught error: ${err.message}`);
    process.exit(1);
  });
}

module.exports = { reflect };
