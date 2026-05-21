const { AIReport, Organisation } = require('../models');
const reportDataService = require('./reportDataService');
const logger = require('../utils/logger');

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const runningJobs = new Set();

function isBackendEngineEnabled() {
  return Boolean(process.env.OPENROUTER_API_KEY?.trim());
}

function getReportEngine() {
  if (isBackendEngineEnabled() && process.env.FORCE_N8N_REPORT !== 'true') {
    return 'backend';
  }
  return 'n8n';
}

function buildMessages(aiContext) {
  const orgName = aiContext?.organisation?.name || 'the organisation';
  const requirements =
    aiContext?.writingRequirements ||
    'Write a complete GHG markdown report with Overview, Scope 1, Scope 2, Scope 3, Data quality, and Recommendations sections.';

  const system = [
    'You are an expert GHG Protocol corporate emissions reporting analyst.',
    'Output valid markdown only (no JSON wrappers).',
    'Use only numbers and categories present in the user data — never invent emissions figures.',
    'Be specific about hotspots and scope shares. Target at least 1200 words unless data is very sparse.',
    requirements
  ].join('\n');

  const user = [
    `Organisation: ${orgName}`,
    `Industry: ${aiContext?.organisation?.industry || 'not specified'}`,
    `Reporting period: ${aiContext?.reportingPeriod?.startDate || '?'} to ${aiContext?.reportingPeriod?.endDate || '?'}`,
    '',
    'Structured emissions data (JSON):',
    JSON.stringify(aiContext)
  ].join('\n');

  return [
    { role: 'system', content: system },
    { role: 'user', content: user }
  ];
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Call OpenRouter with Retry-After / exponential backoff on 429 and 503.
 */
async function callOpenRouter(messages) {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) {
    const err = new Error('OPENROUTER_API_KEY is not configured on the server');
    err.statusCode = 503;
    throw err;
  }

  const model = process.env.OPENROUTER_MODEL?.trim() || 'google/gemini-2.5-flash';
  const maxTokens = parseInt(process.env.OPENROUTER_MAX_TOKENS || '8192', 10);
  const maxRetries = parseInt(process.env.OPENROUTER_MAX_RETRIES || '6', 10);

  const body = {
    model,
    messages,
    max_tokens: Number.isFinite(maxTokens) ? maxTokens : 8192,
    temperature: 0.35
  };

  let attempt = 0;
  while (attempt <= maxRetries) {
    const res = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.OPENROUTER_HTTP_REFERER || 'https://carbondesk.app',
        'X-Title': process.env.OPENROUTER_APP_TITLE || 'Carbon Desk'
      },
      body: JSON.stringify(body)
    });

    if (res.status === 429 || res.status === 503) {
      const retryAfterHeader = Number(res.headers.get('Retry-After'));
      const waitMs =
        Number.isFinite(retryAfterHeader) && retryAfterHeader > 0
          ? retryAfterHeader * 1000
          : Math.min(90000, 3000 * Math.pow(2, attempt));

      attempt += 1;
      if (attempt > maxRetries) {
        const detail = (await res.text().catch(() => '')).slice(0, 240);
        const err = new Error(
          `AI provider rate limit (${res.status}). Wait a few minutes and retry.${detail ? ` ${detail}` : ''}`
        );
        err.statusCode = 429;
        err.code = 'OPENROUTER_RATE_LIMIT';
        throw err;
      }

      logger.warn('OpenRouter rate limited, retrying', {
        status: res.status,
        attempt,
        waitMs,
        model
      });
      await sleep(waitMs);
      continue;
    }

    if (!res.ok) {
      const detail = (await res.text().catch(() => '')).slice(0, 400);
      const err = new Error(`OpenRouter request failed (${res.status}): ${detail}`);
      err.statusCode = res.status === 402 ? 402 : 502;
      throw err;
    }

    const json = await res.json();
    const content = json?.choices?.[0]?.message?.content;
    if (!content || !String(content).trim()) {
      throw new Error('OpenRouter returned an empty report');
    }
    return String(content).trim();
  }

  throw new Error('OpenRouter request exhausted retries');
}

async function failReport(report, message, extra = {}) {
  report.status = 'failed';
  report.error = message;
  report.metadata = {
    ...(report.metadata || {}),
    failedAt: new Date().toISOString(),
    engine: 'backend',
    ...extra
  };
  await report.save();
}

async function runReportGeneration(reportId) {
  const report = await AIReport.findById(reportId);
  if (!report) {
    logger.warn('report LLM job: report not found', { reportId });
    return;
  }

  if (report.status === 'completed') return;
  if (report.status === 'failed' && report.reportContent) return;

  const organisationId = report.organisation_id;
  const org =
    (await Organisation.findOne({ id: organisationId }).lean()) ||
    (await Organisation.findById(organisationId).lean());
  if (!org) {
    await failReport(report, 'Organisation not found for report generation');
    return;
  }

  try {
    report.status = 'processing';
    report.error = null;
    report.metadata = {
      ...(report.metadata || {}),
      processingStartedAt: new Date().toISOString(),
      engine: 'backend'
    };
    await report.save();

    const prepared = await reportDataService.prepareReportData(
      { ...report.filters, reportId: report._id.toString(), organisationId },
      organisationId,
      {
        name: org.name,
        display_name: org.display_name,
        industry_type: org.industry_type,
        default_reporting_period: org.default_reporting_period
      }
    );

    const aiContext = reportDataService.buildAiReportContext(prepared);
    const markdown = await callOpenRouter(buildMessages(aiContext));

    report.status = 'completed';
    report.reportContent = markdown;
    report.generatedAt = new Date();
    report.error = null;
    report.metadata = {
      ...(report.metadata || {}),
      completedAt: new Date().toISOString(),
      engine: 'backend',
      openRouterModel: process.env.OPENROUTER_MODEL?.trim() || 'google/gemini-2.5-flash'
    };
    await report.save();

    logger.info('Report generated via backend OpenRouter', {
      reportId: report._id.toString(),
      organisationId
    });
  } catch (error) {
    logger.error('Report LLM job failed', {
      reportId: report._id.toString(),
      message: error.message
    });
    await failReport(report, error.message, {
      errorCode: error.code,
      httpStatus: error.statusCode
    });
  }
}

function enqueueReportGeneration(reportId) {
  const id = String(reportId);
  if (runningJobs.has(id)) return;
  runningJobs.add(id);

  setImmediate(async () => {
    try {
      await runReportGeneration(id);
    } catch (err) {
      logger.error('Unhandled report LLM job error', { reportId: id, message: err.message });
    } finally {
      runningJobs.delete(id);
    }
  });
}

module.exports = {
  isBackendEngineEnabled,
  getReportEngine,
  enqueueReportGeneration,
  runReportGeneration,
  callOpenRouter
};
