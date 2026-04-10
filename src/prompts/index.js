'use strict';

const { readFileSync } = require('fs');
const { join } = require('path');

const TEMPLATES_DIR = __dirname;

// Supported variants and their template files
const VARIANTS = {
  general: 'general.md',
  code: 'code.md',
  architecture: 'architecture.md',
  writing: 'writing.md',
};

// Cache loaded templates
const _cache = new Map();

function loadTemplate(name) {
  if (_cache.has(name)) return _cache.get(name);
  const file = VARIANTS[name] || VARIANTS.general;
  const content = readFileSync(join(TEMPLATES_DIR, file), 'utf8').trim();
  _cache.set(name, content);
  return content;
}

/**
 * Build the system prompt for a generator.
 * @param {string} variant - One of general|code|architecture|writing
 * @param {string[]} [lessons] - Injected lesson strings from memory
 * @param {string[]} [skills] - Injected skill template strings from memory
 * @returns {string}
 */
function buildGeneratorSystem(variant = 'general', lessons = [], skills = []) {
  const base = loadTemplate(variant);
  const parts = [base];

  if (lessons.length > 0) {
    parts.push(`\n<past-lessons>\n${lessons.slice(0, 5).join('\n')}\n</past-lessons>`);
  }

  if (skills.length > 0) {
    parts.push(`\n<skills>\n${skills.join('\n\n')}\n</skills>`);
  }

  return parts.join('');
}

module.exports = { buildGeneratorSystem, VARIANTS };
