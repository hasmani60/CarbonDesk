const { AnalyticsChat } = require('../models');
const analyticsChatService = require('../services/analyticsChatService');
const reportDataService = require('../services/reportDataService');
const {
  assertCanGenerateReport,
  getOrganisationQuota
} = require('../services/aiReportQuotaService');
const logger = require('../utils/logger');

function orgMeta(req) {
  return {
    ...(req.organisation || {}),
    default_reporting_period: req.organisationSettings?.default_reporting_period
  };
}

/**
 * @route GET /api/analytics-chats/quota
 */
const getQuota = async (req, res) => {
  try {
    const quota = await getOrganisationQuota(req.organisationId);
    if (!quota) {
      return res.status(404).json({ success: false, message: 'Organisation not found' });
    }
    res.json({ success: true, data: quota });
  } catch (error) {
    logger.error('analyticsChat getQuota', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @route GET /api/analytics-chats/filter-options
 */
const getFilterOptions = async (req, res) => {
  try {
    const options = await reportDataService.getFilterOptions(req.organisationId);
    res.json({ success: true, data: options });
  } catch (error) {
    logger.error('analyticsChat getFilterOptions', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @route GET /api/analytics-chats
 */
const listChats = async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 50);
    const chats = await AnalyticsChat.find({ organisation_id: req.organisationId })
      .sort({ updated_at: -1 })
      .limit(limit)
      .select('title filters created_at updated_at createdByName messages')
      .lean();

    res.json({
      success: true,
      data: chats.map((c) => ({
        id: c._id.toString(),
        title: c.title,
        filters: c.filters,
        createdAt: c.created_at,
        updatedAt: c.updated_at,
        createdByName: c.createdByName,
        messageCount: c.messages?.length || 0,
        lastMessage: c.messages?.length
          ? c.messages[c.messages.length - 1].content?.slice(0, 120)
          : null
      }))
    });
  } catch (error) {
    logger.error('analyticsChat listChats', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @route POST /api/analytics-chats
 * body: { filters, message?, title? }
 */
const createChat = async (req, res) => {
  try {
    const { filters = {}, message, title } = req.body || {};
    const hasPeriod =
      (filters.startDate && filters.endDate) ||
      (filters.reportingYear && filters.reportingMonth) ||
      filters.reportingYear;

    if (!hasPeriod) {
      return res.status(400).json({
        success: false,
        message: 'Select a date range or reporting month/year for analytics context'
      });
    }

    const chat = await AnalyticsChat.create({
      organisation_id: req.organisationId,
      title: title || analyticsChatService.suggestTitle(message) || 'Analytics chat',
      filters,
      createdBy: req.user.id,
      createdByName: req.user.name
    });

    if (message && String(message).trim()) {
      const userContent = String(message).trim();
      await assertCanGenerateReport(req.organisationId);
      chat.messages.push({ role: 'user', content: userContent });
      const assistantText = await analyticsChatService.generateAssistantReply(
        chat,
        userContent,
        req.organisationId,
        orgMeta(req)
      );
      chat.messages.push({ role: 'assistant', content: assistantText });
      if (!title) chat.title = analyticsChatService.suggestTitle(userContent);
      await chat.save();
    } else {
      await analyticsChatService.refreshContext(chat, req.organisationId, orgMeta(req));
      await chat.save();
    }

    const quota = await getOrganisationQuota(req.organisationId);

    res.status(201).json({
      success: true,
      data: formatChat(chat),
      quota
    });
  } catch (error) {
    logger.error('analyticsChat createChat', error);
    const status = error.statusCode || 500;
    res.status(status).json({
      success: false,
      message: error.message,
      code: error.code,
      quota: error.quota
    });
  }
};

/**
 * @route GET /api/analytics-chats/:id
 */
const getChat = async (req, res) => {
  try {
    const chat = await AnalyticsChat.findOne({
      _id: req.params.id,
      organisation_id: req.organisationId
    });
    if (!chat) {
      return res.status(404).json({ success: false, message: 'Chat not found' });
    }
    res.json({ success: true, data: formatChat(chat) });
  } catch (error) {
    logger.error('analyticsChat getChat', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @route POST /api/analytics-chats/:id/messages
 * body: { content, refreshContext?: boolean }
 */
const sendMessage = async (req, res) => {
  try {
    await assertCanGenerateReport(req.organisationId);

    const content = String(req.body?.content || '').trim();
    if (!content) {
      return res.status(400).json({ success: false, message: 'Message content is required' });
    }

    const chat = await AnalyticsChat.findOne({
      _id: req.params.id,
      organisation_id: req.organisationId
    });
    if (!chat) {
      return res.status(404).json({ success: false, message: 'Chat not found' });
    }

    if (req.body?.refreshContext) {
      await analyticsChatService.refreshContext(chat, req.organisationId, orgMeta(req));
    }

    chat.messages.push({ role: 'user', content });
    const assistantText = await analyticsChatService.generateAssistantReply(
      chat,
      content,
      req.organisationId,
      orgMeta(req)
    );
    chat.messages.push({ role: 'assistant', content: assistantText });
    await chat.save();

    const quota = await getOrganisationQuota(req.organisationId);

    res.json({
      success: true,
      data: formatChat(chat),
      quota
    });
  } catch (error) {
    logger.error('analyticsChat sendMessage', error);
    const status = error.statusCode || 500;
    res.status(status).json({
      success: false,
      message: error.message,
      code: error.code,
      quota: error.quota
    });
  }
};

/**
 * @route DELETE /api/analytics-chats/:id
 */
const deleteChat = async (req, res) => {
  try {
    const result = await AnalyticsChat.deleteOne({
      _id: req.params.id,
      organisation_id: req.organisationId
    });
    if (!result.deletedCount) {
      return res.status(404).json({ success: false, message: 'Chat not found' });
    }
    res.json({ success: true, message: 'Chat deleted' });
  } catch (error) {
    logger.error('analyticsChat deleteChat', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

function formatChat(chat) {
  return {
    id: chat._id.toString(),
    title: chat.title,
    filters: chat.filters,
    messages: (chat.messages || []).map((m) => ({
      role: m.role,
      content: m.content,
      createdAt: m.created_at
    })),
    contextRefreshedAt: chat.contextRefreshedAt,
    createdAt: chat.created_at,
    updatedAt: chat.updated_at,
    createdByName: chat.createdByName
  };
}

module.exports = {
  getQuota,
  getFilterOptions,
  listChats,
  createChat,
  getChat,
  sendMessage,
  deleteChat
};
