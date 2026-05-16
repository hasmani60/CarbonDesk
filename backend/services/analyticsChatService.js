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

function buildContextSystemMessage(contextData) {
  return {
    role: 'system',
    content: `${CHAT_SYSTEM_PROMPT}\n\n## Analytics context (JSON)\n\`\`\`json\n${JSON.stringify(contextData, null, 2)}\n\`\`\``
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
    .slice(-20)
    .map((m) => ({ role: m.role, content: m.content }));

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
  refreshContext,
  generateAssistantReply,
  suggestTitle,
  buildContextSystemMessage
};
