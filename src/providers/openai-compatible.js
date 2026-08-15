'use strict';

const DEEPSEEK_ENDPOINT = 'https://api.deepseek.com/chat/completions';
const GROK_ENDPOINT = 'https://api.x.ai/v1/responses';

function makeProvider({ name, endpoint, apiKeyEnv, modelEnv, defaultModel, buildBody, extractContent }) {
  return {
    name,
    async run(prompt, runner) {
      const apiKey = process.env[apiKeyEnv];
      if (!apiKey) return missingKeyResult();
      return runner.request(endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(buildBody(process.env[modelEnv] || defaultModel, prompt)),
      });
    },
    adapt(raw) {
      try {
        const content = extractContent(JSON.parse(raw.stdout));
        if (content) return { content, model: name, parse_mode: 'json' };
      } catch { /* fall through */ }
      return fallback(raw.stdout, name);
    },
    extractJudgeText(raw) {
      return this.adapt(raw).content;
    },
  };
}

const deepseek = makeProvider({
  name: 'deepseek',
  endpoint: DEEPSEEK_ENDPOINT,
  apiKeyEnv: 'DEEPSEEK_API_KEY',
  modelEnv: 'BRAINTRUST_DEEPSEEK_MODEL',
  defaultModel: 'deepseek-chat',
  buildBody: (model, prompt) => ({ model, messages: [{ role: 'user', content: prompt }], stream: false }),
  extractContent: response => response.choices?.[0]?.message?.content,
});

const grok = makeProvider({
  name: 'grok',
  endpoint: GROK_ENDPOINT,
  apiKeyEnv: 'XAI_API_KEY',
  modelEnv: 'BRAINTRUST_GROK_MODEL',
  defaultModel: 'grok-4',
  buildBody: (model, prompt) => ({ model, input: prompt, store: false }),
  extractContent: response => {
    if (typeof response.output_text === 'string') return response.output_text;
    return (response.output || [])
      .filter(item => item.type === 'message')
      .flatMap(item => item.content || [])
      .filter(item => item.type === 'output_text' && typeof item.text === 'string')
      .map(item => item.text)
      .join('');
  },
});

function missingKeyResult() {
  return { stdout: '', stderr: '', code: -1, error_type: 'missing_api_key' };
}

function fallback(stdout, model) {
  return { content: stdout.slice(-2000).trim() || '[no output]', model, parse_mode: 'fallback' };
}

module.exports = { DEEPSEEK_ENDPOINT, GROK_ENDPOINT, deepseek, grok, makeProvider, missingKeyResult };
