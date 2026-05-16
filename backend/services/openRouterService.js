const logger = require('../utils/logger');

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

/**
 * @param {{ messages: Array<{role:string,content:string}>, temperature?: number, max_tokens?: number }} opts
 */
async function chatCompletion({ messages, temperature = 0.4, max_tokens = 2000 }) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    const err = new Error(
      'OPENROUTER_API_KEY is not configured on the server. Add it in Render environment variables.'
    );
    err.statusCode = 503;
    err.code = 'OPENROUTER_NOT_CONFIGURED';
    throw err;
  }

  const model =
    process.env.OPENROUTER_MODEL || 'deepseek/deepseek-v4-flash:free';

  const res = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.APP_PUBLIC_URL || process.env.FRONTEND_URL || 'https://carbondesk.app',
      'X-Title': 'Carbon Accounting Analytics'
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens
    })
  });

  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    const msg =
      body?.error?.message ||
      body?.message ||
      `OpenRouter request failed (${res.status})`;
    logger.warn('OpenRouter error', { status: res.status, body });
    const err = new Error(msg);
    err.statusCode = res.status === 429 ? 429 : 502;
    err.code = res.status === 429 ? 'OPENROUTER_RATE_LIMIT' : 'OPENROUTER_ERROR';
    throw err;
  }

  const content = body?.choices?.[0]?.message?.content;
  if (!content) {
    const err = new Error('OpenRouter returned no message content');
    err.statusCode = 502;
    throw err;
  }

  return { content, model, usage: body.usage || null };
}

module.exports = { chatCompletion };
