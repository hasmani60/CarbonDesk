const reportDataService = require('./reportDataService');
const { chatCompletion } = require('./openRouterService');

const CHAT_SYSTEM_PROMPT = `You are an expert carbon analytics assistant for a GHG accounting SaaS platform.

RULES:
- Answer using ONLY the JSON analytics context provided in the first system message.
- Express all emissions in kg CO2e (kilogram carbon dioxide equivalent).
- Be clear and concise; use bullet points or short paragraphs when helpful.
- Use markdown tables only when comparing numbers.
- Do NOT invent figures, benchmarks, or facilities not in the JSON.
- Do NOT write a full formal GHG report unless the user explicitly asks for one.
- If the user asks about data not in the JSON, say what is missing.
- You may explain Scope 1/2/3, trends, hotspots, velocity, and practical reduction ideas grounded in the data.`;

/** Smaller JSON for chat — reduces provider 502s on free models with large context */
function compactContextForChat(data) {
  if (!data || typeof data !== 'object') return data;
  const monthly = Array.isArray(data.trends?.monthly) ? data.trends.monthly : [];
  return {
    organisation: data.organisation,
    filters: data.filters,
    units: data.units,
    summary: data.summary,
    trends: {
      monthly: monthly.slice(-18),
      velocity: data.trends?.velocity ?? null,
      scopeMigration: data.trends?.scopeMigration ?? null
    },
    topSources: {
      categories: (data.topSources?.categories || []).slice(0, 12),
      locations: (data.topSources?.locations || []).slice(0, 8),
      paretoHotspots: (data.topSources?.paretoHotspots || []).slice(0, 8)
    },
    reductions: {
      trajectoryMetrics: data.reductions?.trajectoryMetrics ?? null,
      trajectoryBaseline: data.reductions?.trajectoryBaseline ?? null
    },
    dataQuality: data.dataQuality,
    generatedAt: data.generatedAt
  };
}

function buildContextSystemMessage(contextData) {
  const compact = compactContextForChat(contextData);
  return {
    role: 'system',
    content: `${CHAT_SYSTEM_PROMPT}\n\n## Analytics context (JSON)\n\`\`\`json\n${JSON.stringify(compact)}\n\`\`\``
  };
}

async function refreshContext(chat, organisationId, organisationMeta) {
  const prepared = await reportDataService.prepareReportData(
    chat.filters || {},
    organisationId,
    organisationMeta
  );
  chat.contextData = prepared;
  chat.contextRefreshedAt = new Date();
  return prepared;
}

/**
 * Run one user turn and return assistant text (does not persist).
 */
async function generateAssistantReply(chat, userContent, organisationId, organisationMeta) {
  if (!chat.contextData) {
    await refreshContext(chat, organisationId, organisationMeta);
  }

  const history = (chat.messages || [])
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .slice(-8)
    .map((m) => ({
      role: m.role,
      content: String(m.content || '').slice(0, 4000)
    }));

  const messages = [
    buildContextSystemMessage(chat.contextData),
    ...history,
    { role: 'user', content: userContent }
  ];

  const { content } = await chatCompletion({
    messages,
    temperature: 0.4,
    max_tokens: 2000
  });

  return content;
}

function suggestTitle(firstMessage) {
  const t = String(firstMessage || '').trim();
  if (!t) return 'Analytics chat';
  return t.length > 48 ? `${t.slice(0, 48)}…` : t;
}

module.exports = {
  CHAT_SYSTEM_PROMPT,
  compactContextForChat,
  refreshContext,
  generateAssistantReply,
  suggestTitle,
  buildContextSystemMessage
};
