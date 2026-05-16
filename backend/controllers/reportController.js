const mongoose = require('mongoose');
const { AIReport } = require('../models');
const reportDataService = require('../services/reportDataService');
const {
  assertCanGenerateReport,
  getOrganisationQuota
} = require('../services/aiReportQuotaService');
const logger = require('../utils/logger');

const ALLOWED_STATUS = ['pending', 'processing', 'completed', 'failed'];

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

    res.status(201).json({
      success: true,
      data: {
        id: report._id.toString(),
        status: report.status,
        filters: report.filters,
        createdAt: report.created_at,
        quota: {
          used: quota.used + 1,
          limit: quota.limit,
          remaining: Math.max(0, quota.remaining - 1)
        }
      },
      message: 'Report generation started'
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

    // company_data: alias for n8n OpenRouter prompts (same object as data)
    res.json({
      success: true,
      data: prepared,
      company_data: prepared,
      reportId: reportId || null
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
    if (reportContent != null) report.reportContent = reportContent;
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
        reportContent: report.reportContent,
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

    if (chartImages.length > 6) {
      return res.status(400).json({ success: false, message: 'Maximum 6 chart images allowed' });
    }

    const sanitized = chartImages
      .filter((img) => img?.id && img?.dataUrl && String(img.dataUrl).startsWith('data:image/'))
      .map((img) => ({
        id: String(img.id).slice(0, 64),
        title: String(img.title || 'Chart').slice(0, 120),
        dataUrl: String(img.dataUrl)
      }));

    const report = await AIReport.findOne({ _id: id, organisation_id: req.organisationId });
    if (!report) {
      return res.status(404).json({ success: false, message: 'Report not found' });
    }

    report.metadata = {
      ...(report.metadata || {}),
      chartImages: sanitized,
      chartImagesCapturedAt: new Date().toISOString()
    };
    await report.save();

    res.json({
      success: true,
      data: { chartImages: sanitized }
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
