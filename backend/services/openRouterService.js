const logger = require('../utils/logger');

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseModelList() {
  const primary = process.env.OPENROUTER_MODEL || 'deepseek/deepseek-v4-flash:free';
  const fallbacks = (process.env.OPENROUTER_FALLBACK_MODELS || 'openrouter/free')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return [...new Set([primary, ...fallbacks])];
}

function userFacingMessage(status, body, model) {
  const providerMsg = body?.error?.message || body?.message;
  if (status === 429) {
    return 'AI rate limit reached. Please wait a minute and try again.';
  }
  if (status === 502 || providerMsg === 'Provider returned error') {
    return `The AI model (${model}) is temporarily unavailable. Wait a moment and try again, or set OPENROUTER_MODEL / OPENROUTER_FALLBACK_MODELS on the server.`;
  }
  return providerMsg || `OpenRouter request failed (${status})`;
}

async function requestCompletion(apiKey, model, { messages, temperature, max_tokens }) {
  const res = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer':
        process.env.APP_PUBLIC_URL || process.env.FRONTEND_URL || 'https://carbondesk.app',
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
    logger.warn('OpenRouter error', {
      status: res.status,
      model,
      message: body?.error?.message,
      metadata: body?.error?.metadata,
      code: body?.error?.code
    });
    const err = new Error(userFacingMessage(res.status, body, model));
    err.statusCode = res.status === 429 ? 429 : 502;
    err.code = res.status === 429 ? 'OPENROUTER_RATE_LIMIT' : 'OPENROUTER_ERROR';
    err.providerMetadata = body?.error?.metadata;
    throw err;
  }

  const content = body?.choices?.[0]?.message?.content;
  if (!content) {
    const err = new Error('OpenRouter returned no message content');
    err.statusCode = 502;
    err.code = 'OPENROUTER_ERROR';
    throw err;
  }

  return { content, model, usage: body.usage || null };
}

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

  const models = parseModelList();
  const retryable = new Set([429, 502, 503]);
  let lastError;

  for (const model of models) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await requestCompletion(apiKey, model, {
          messages,
          temperature,
          max_tokens
        });
      } catch (error) {
        lastError = error;
        const retry =
          retryable.has(error.statusCode) && attempt < 2;
        if (retry) {
          const delayMs = 1500 * (attempt + 1);
          logger.warn('OpenRouter retry', { model, attempt: attempt + 1, delayMs });
          await sleep(delayMs);
          continue;
        }
        if (error.statusCode === 429 || error.statusCode === 502) {
          break;
        }
        throw error;
      }
    }
  }

  throw lastError;
}

module.exports = { chatCompletion, parseModelList };
