'use strict';

const { PROVIDERS } = require('./providers/index.js');
const { summarize } = require('./normalize.js');
const { LESSONS_INJECT_LIMIT } = require('./config.js');

class JudgeProviderError extends Error {
  constructor(provider, errorType) {
    super(`Judge ${provider} failed: ${errorType}`);
    this.name = 'JudgeProviderError';
    this.code = 'JUDGE_PROVIDER_FAILED';
    this.error_type = errorType;
  }
}

/**
 * Build the judge prompt, optionally injecting lessons from memory.
 * @param {string} question
 * @param {Array} results - Normalized provider results
 * @param {{ lessons?: string[], skills?: string[] }} opts
 * @returns {string}
 */
function buildJudgePrompt(question, results, opts = {}) {
  const valid = results.filter(r => !r.error);
  const summaries = valid
    .map((r, i) => `--- 候选 ${String.fromCharCode(65 + i)} (${r.provider}) ---\n${summarize(r)}`)
    .join('\n\n');

  const lessonsBlock = buildLessonsBlock(opts.lessons || []);

  return `你是一个高级技术评审。${valid.length} 个 AI 模型对同一问题给出了各自的回答。
${lessonsBlock}
问题：${question}

${summaries}

请按以下结构输出你的评审（用中文标签分隔）：

## 核心共识
（各模型都认同的关键结论）

## 独特洞见
（某个模型独有但有价值的见解，注明来自哪个候选）

## 分歧裁决
（如果存在矛盾，给出你的判断和理由；如无分歧则写"无明显分歧"）

## 集大成方案
（综合各方的最优可执行方案）

## 风险提示
（需要注意的假设、风险或待验证项）`;
}

/**
 * Build a lessons injection block, respecting the hard char limit.
 * @param {string[]} lessons
 * @returns {string}
 */
function buildLessonsBlock(lessons) {
  if (!lessons.length) return '';
  const joined = lessons.slice(0, 5).join('\n');
  const trimmed = joined.slice(0, LESSONS_INJECT_LIMIT);
  return `\n<past-lessons>\n${trimmed}\n</past-lessons>\n`;
}

/**
 * Run the judge model and return the report text.
 * @param {string} question
 * @param {Array} results - Normalized provider results
 * @param {object} opts
 * @param {string} [opts.judgeModel='claude'] - Which model to use as judge
 * @param {object} opts.runner - Shared process/HTTP runner
 * @param {string[]} [opts.lessons] - Lessons to inject
 * @returns {Promise<string>}
 */
async function runJudge(question, results, opts = {}) {
  const { judgeModel = 'claude', runner, lessons = [] } = opts;
  const judgePrompt = buildJudgePrompt(question, results, { lessons });

  process.stderr.write(`\n[Judge (${judgeModel}): running...]\n`);
  const start = Date.now();

  const provider = PROVIDERS[judgeModel];
  if (!provider) {
    throw new Error(`Unknown judge model: ${judgeModel}. Use ${Object.keys(PROVIDERS).join('|')}.`);
  }

  const raw = await provider.run(judgePrompt, runner);
  if (raw.error_type) {
    throw new JudgeProviderError(judgeModel, raw.error_type);
  }
  const ms = Date.now() - start;
  process.stderr.write(`[Judge: done ${(ms / 1000).toFixed(1)}s]\n`);

  return provider.extractJudgeText(raw);
}

module.exports = { JudgeProviderError, buildJudgePrompt, runJudge, buildLessonsBlock };
