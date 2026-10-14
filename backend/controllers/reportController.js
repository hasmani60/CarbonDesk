const mongoose = require('mongoose');
const { AIReport } = require('../models');
const reportDataService = require('../services/reportDataService');
const {
  assertCanGenerateReport,
  getOrganisationQuota
} = require('../services/aiReportQuotaService');
const logger = require('../utils/logger');

const ALLOWED_STATUS = ['pending', 'processing', 'completed', 'failed'];
const REPORT_ASSURANCE_NOTICE =
  '> Assurance status: “Verified” in Carbon Desk means internal record review only. This AI-generated report is not independently verified by an ACVA and is not evidence of regulatory acceptance.';

function ensureReportAssuranceNotice(content) {
  const markdown = String(content || '').trim();
  if (!markdown || markdown.includes(REPORT_ASSURANCE_NOTICE)) return markdown;
  return `${markdown}\n\n---\n\n${REPORT_ASSURANCE_NOTICE}`;
}

/**
 * Trigger n8n from the API (server-to-server) so the browser never hits CORS.
 * Set N8N_REPORT_WEBHOOK_URL on the backend (Render), e.g. local tunnel or n8n.cloud URL.
 */
async function triggerN8nWebhook({ reportId, organisationId, userId, filters }) {
  const webhookUrl = process.env.N8N_REPORT_WEBHOOK_URL;
  if (!webhookUrl) {
    return { triggered: false, reason: 'N8N_REPORT_WEBHOOK_URL not configured' };
  }

  // Render (or any cloud API) cannot call localhost on your laptop.
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/i.test(webhookUrl)) {
    throw new Error(
      `N8N_REPORT_WEBHOOK_URL points to localhost (${webhookUrl}). ` +
        'Use an n8n.cloud URL or a public tunnel (ngrok/Cloudflare) that Render can reach.'
    );
  }

  const payload = {
    reportId,
    organisationId,
    userId,
    ...(filters || {})
  };

  let res;
  try {
    res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } catch (networkErr) {
    throw new Error(
      `Cannot reach n8n at ${webhookUrl}: ${networkErr.message}. ` +
        'If n8n is local, expose it with a tunnel and set that HTTPS URL on Render.'
    );
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `n8n webhook returned HTTP ${res.status}`);
  }

  return { triggered: true };
}

/**
 * @desc  Distinct filter dimensions for the organisation
 * @route GET /api/reports/filter-options
 */
/**
 * @desc  AI report generation quota for the organisation
 * @route GET /api/reports/quota
 */
const getReportQuota = async (req, res) => {
  try {
    const quota = await getOrganisationQuota(req.organisationId);
    if (!quota) {
      return res.status(404).json({ success: false, message: 'Organisation not found' });
    }
    res.json({ success: true, data: quota });
  } catch (error) {
    logger.error('getReportQuota error', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const getFilterOptions = async (req, res) => {
  try {
    const options = await reportDataService.getFilterOptions(req.organisationId);
    res.json({ success: true, data: options });
  } catch (error) {
    logger.error('getFilterOptions error', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc  Start async AI report job (pending) — returns immediately
 * @route POST /api/reports/generate
 */
const generateReport = async (req, res) => {
  try {
    const quota = await assertCanGenerateReport(req.organisationId);
    const filters = req.body || {};
    const report = await AIReport.create({
      organisation_id: req.organisationId,
      filters,
      status: 'pending',
      createdBy: req.user.id,
      createdByName: req.user.name,
      metadata: {
        requestedAt: new Date().toISOString(),
        userEmail: req.user.email
      }
    });

    const reportId = report._id.toString();
    let webhook = { triggered: false };

    try {
      webhook = await triggerN8nWebhook({
        reportId,
        organisationId: req.organisationId,
        userId: req.user.id,
        filters
      });
      if (!webhook.triggered) {
        logger.warn('n8n webhook skipped', { reportId, reason: webhook.reason });
      }
    } catch (webhookError) {
      logger.error('n8n webhook trigger failed', {
        reportId,
        webhookUrl: process.env.N8N_REPORT_WEBHOOK_URL,
        error: webhookError.message
      });
      report.status = 'failed';
      report.error = `Automation webhook failed: ${webhookError.message}`;
      await report.save();
      return res.status(502).json({
        success: false,
        message: webhookError.message,
        code: 'N8N_WEBHOOK_FAILED',
        data: { id: reportId, status: report.status }
      });
    }

    res.status(201).json({
      success: true,
      data: {
        id: reportId,
        status: report.status,
        filters: report.filters,
        createdAt: report.created_at,
        webhookTriggered: Boolean(webhook.triggered),
        quota: {
          used: quota.used + 1,
          limit: quota.limit,
          remaining: Math.max(0, quota.remaining - 1)
        }
      },
      message: webhook.triggered
        ? 'Report generation started'
        : 'Report created — configure N8N_REPORT_WEBHOOK_URL on the API to start automation'
    });
  } catch (error) {
    logger.error('generateReport error', error);
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
 * @desc  Prepare structured data for AI (n8n or internal)
 * @route POST /api/reports/prepare-data
 */
const prepareReportData = async (req, res) => {
  try {
    const organisationId = req.organisationId;
    if (!organisationId) {
      return res.status(403).json({
        success: false,
        message: 'Organisation context required'
      });
    }

    const bodyOrg = req.body?.organisationId;
    if (bodyOrg != null && String(bodyOrg) !== String(organisationId)) {
      return res.status(403).json({
        success: false,
        message: 'organisationId in body does not match your organisation'
      });
    }

    const { reportId } = req.body;
    if (reportId) {
      const report = await AIReport.findOne({
        _id: reportId,
        organisation_id: organisationId
      });
      if (!report) {
        return res.status(404).json({ success: false, message: 'Report not found' });
      }
      if (report.status === 'completed') {
        return res.status(409).json({ success: false, message: 'Report already completed' });
      }
      report.status = 'processing';
      report.metadata = {
        ...(report.metadata || {}),
        processingStartedAt: new Date().toISOString()
      };
      await report.save();
    }

    const body = reportId
      ? { ...(await AIReport.findById(reportId).lean())?.filters, ...req.body }
      : req.body;

    const prepared = await reportDataService.prepareReportData(body, organisationId, {
      ...(req.organisation || {}),
      default_reporting_period: req.organisationSettings?.default_reporting_period
    });

    const reportContext = reportDataService.buildAiReportContext(prepared);

    // Single payload for n8n / OpenRouter — do not duplicate as aiContext, company_data, or full aggregates
    res.json({
      success: true,
      reportId: reportId || null,
      data: reportContext
    });
  } catch (error) {
    logger.error('prepareReportData error', error);
    const status = error.statusCode || 500;

    if (req.body?.reportId) {
      await AIReport.findOneAndUpdate(
        { _id: req.body.reportId, organisation_id: organisationId },
        {
          status: 'failed',
          error: error.message,
          metadata: { failedAt: new Date().toISOString() }
        }
      ).catch(() => {});
    }

    res.status(status).json({ success: false, message: error.message });
  }
};

/**
 * @desc  n8n callback — update report status and content
 * @route PATCH /api/reports/:id/callback
 */
const reportCallback = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, reportContent, error, metadata } = req.body;
    const organisationId = req.organisationId;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid report id — check the URL uses a valid MongoDB id (and n8n expression, e.g. $json.body.reportId)'
      });
    }

    if (!organisationId) {
      return res.status(403).json({ success: false, message: 'Organisation context required' });
    }

    const bodyOrg = req.body?.organisationId;
    if (bodyOrg != null && String(bodyOrg) !== String(organisationId)) {
      return res.status(403).json({
        success: false,
        message: 'organisationId in body does not match your organisation'
      });
    }

    if (status && !ALLOWED_STATUS.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `status must be one of: ${ALLOWED_STATUS.join(', ')}`
      });
    }

    const report = await AIReport.findOne({ _id: id, organisation_id: organisationId });
    if (!report) {
      return res.status(404).json({ success: false, message: 'Report not found' });
    }

    if (status) report.status = status;
    if (reportContent != null) report.reportContent = ensureReportAssuranceNotice(reportContent);
    if (error != null) report.error = error;
    if (metadata) {
      report.metadata = { ...(report.metadata || {}), callback: metadata };
    }
    if (status === 'completed') {
      report.generatedAt = new Date();
    }
    await report.save();

    res.json({
      success: true,
      data: {
        id: report._id.toString(),
        status: report.status,
        generatedAt: report.generatedAt
      }
    });
  } catch (error) {
    logger.error('reportCallback error', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc  Poll report by id
 * @route GET /api/reports/:id
 */
const getReportById = async (req, res) => {
  try {
    const report = await AIReport.findOne({
      _id: req.params.id,
      organisation_id: req.organisationId
    }).lean();

    if (!report) {
      return res.status(404).json({ success: false, message: 'Report not found' });
    }

    res.json({
      success: true,
      data: {
        id: report._id.toString(),
        status: report.status,
        filters: report.filters,
        reportContent: ensureReportAssuranceNotice(report.reportContent),
        error: report.error,
        generatedAt: report.generatedAt,
        createdAt: report.created_at,
        updatedAt: report.updated_at,
        createdBy: report.createdBy,
        createdByName: report.createdByName,
        metadata: report.metadata,
        chartImages: report.metadata?.chartImages || []
      }
    });
  } catch (error) {
    logger.error('getReportById error', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc  Recent reports for organisation
 * @route GET /api/reports
 */
const listReports = async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 10, 50);
    const reports = await AIReport.find({ organisation_id: req.organisationId })
      .sort({ created_at: -1 })
      .limit(limit)
      .select('status filters generatedAt created_at createdByName error')
      .lean();

    res.json({
      success: true,
      data: reports.map((r) => ({
        id: r._id.toString(),
        status: r.status,
        filters: r.filters,
        generatedAt: r.generatedAt,
        createdAt: r.created_at,
        createdByName: r.createdByName,
        error: r.error
      }))
    });
  } catch (error) {
    logger.error('listReports error', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc  Cancel a stuck pending/processing report (so user can start a new test)
 * @route PATCH /api/reports/:id/cancel
 */
const cancelReport = async (req, res) => {
  try {
    const report = await AIReport.findOne({
      _id: req.params.id,
      organisation_id: req.organisationId
    });

    if (!report) {
      return res.status(404).json({ success: false, message: 'Report not found' });
    }

    if (!['pending', 'processing'].includes(report.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot cancel a report with status "${report.status}"`
      });
    }

    report.status = 'failed';
    report.error = 'Cancelled by user';
    report.metadata = {
      ...(report.metadata || {}),
      cancelledAt: new Date().toISOString(),
      cancelledBy: req.user.id
    };
    await report.save();

    res.json({
      success: true,
      data: {
        id: report._id.toString(),
        status: report.status,
        error: report.error
      },
      message: 'Report cancelled'
    });
  } catch (error) {
    logger.error('cancelReport error', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc  Save chart snapshot images (base64 PNG) for a completed report
 * @route PATCH /api/reports/:id/chart-images
 */
const saveChartImages = async (req, res) => {
  try {
    const { id } = req.params;
    const { chartImages } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid report id' });
    }

    if (!Array.isArray(chartImages)) {
      return res.status(400).json({ success: false, message: 'chartImages must be an array' });
    }

    const MAX_CHART_IMAGES = 12;
    if (chartImages.length > MAX_CHART_IMAGES) {
      return res.status(400).json({
        success: false,
        message: `Maximum ${MAX_CHART_IMAGES} chart images allowed`
      });
    }

    const sanitizeOne = (img) => {
      const base = {
        id: String(img.id).slice(0, 64),
        title: String(img.title || 'Chart').slice(0, 120),
        dataUrl: String(img.dataUrl)
      };
      if (img.section) base.section = String(img.section).slice(0, 32);
      if (img.sectionTitle) base.sectionTitle = String(img.sectionTitle).slice(0, 120);
      if (Number.isFinite(img.order)) base.order = img.order;
      return base;
    };

    const sanitized = chartImages
      .filter((img) => img?.id && img?.dataUrl && String(img.dataUrl).startsWith('data:image/'))
      .map(sanitizeOne);

    const merge = req.body.merge === true;

    const report = await AIReport.findOne({ _id: id, organisation_id: req.organisationId });
    if (!report) {
      return res.status(404).json({ success: false, message: 'Report not found' });
    }

    let merged = sanitized;
    if (merge && Array.isArray(report.metadata?.chartImages)) {
      const byId = new Map(
        report.metadata.chartImages
          .filter((img) => img?.id && img?.dataUrl)
          .map((img) => [img.id, sanitizeOne(img)])
      );
      sanitized.forEach((img) => byId.set(img.id, img));
      merged = Array.from(byId.values())
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        .slice(0, MAX_CHART_IMAGES);
    }

    report.metadata = {
      ...(report.metadata || {}),
      chartImages: merged,
      chartImagesCapturedAt: new Date().toISOString()
    };
    await report.save();

    res.json({
      success: true,
      data: { chartImages: merged }
    });
  } catch (error) {
    logger.error('saveChartImages error', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getReportQuota,
  getFilterOptions,
  generateReport,
  prepareReportData,
  reportCallback,
  getReportById,
  listReports,
  cancelReport,
  saveChartImages
};
