const fs = require('fs');
const OffsetOpportunity = require('../models/OffsetOpportunity');
const OffsetDocument = require('../models/OffsetDocument');
const OffsetUtilization = require('../models/OffsetUtilization');
const { OFFSET_TYPES, OFFSET_UNITS } = require('../models/OffsetOpportunity');
const logger = require('../utils/logger');
const {
  isExpired,
  getUtilizedQuantity,
  enrichOffset,
  getGrossEmissions,
  getNetEmissionsSummary,
  appendActivity
} = require('../services/offsetService');

const notDeleted = { deleted_at: null };

function parseYear(val) {
  const y = parseInt(val, 10);
  return Number.isFinite(y) && y >= 1990 && y <= 2100 ? y : null;
}

function validateOffsetBody(body, isUpdate = false) {
  const errors = [];
  if (!isUpdate || body.offset_name !== undefined) {
    if (!body.offset_name || !String(body.offset_name).trim()) errors.push('offset_name is required');
  }
  if (!isUpdate || body.offset_type !== undefined) {
    if (!body.offset_type || !OFFSET_TYPES.includes(body.offset_type)) {
      errors.push(`offset_type must be one of: ${OFFSET_TYPES.join(', ')}`);
    }
  }
  if (!isUpdate || body.certificate_number !== undefined) {
    if (!body.certificate_number || !String(body.certificate_number).trim()) {
      errors.push('certificate_number is required');
    }
  }
  if (!isUpdate || body.reporting_year !== undefined) {
    if (!parseYear(body.reporting_year)) errors.push('reporting_year is required');
  }
  if (!isUpdate || body.total_quantity !== undefined) {
    const q = parseFloat(body.total_quantity);
    if (Number.isNaN(q) || q < 0) errors.push('total_quantity must be a non-negative number');
  }
  if (!isUpdate || body.unit !== undefined) {
    if (!body.unit || !OFFSET_UNITS.includes(body.unit)) {
      errors.push(`unit must be one of: ${OFFSET_UNITS.join(', ')}`);
    }
  }
  if (body.applicable_scopes !== undefined) {
    const scopes = Array.isArray(body.applicable_scopes)
      ? body.applicable_scopes.map((s) => parseInt(s, 10))
      : [];
    if (!scopes.length) errors.push('applicable_scopes must include at least one scope');
    if (scopes.some((s) => s < 1 || s > 3)) errors.push('applicable_scopes must be 1, 2, or 3');
  }
  return errors;
}

async function findOffsetOr404(id, organisationId) {
  const offset = await OffsetOpportunity.findOne({
    id,
    organisation_id: organisationId,
    ...notDeleted
  });
  return offset;
}

const listOffsets = async (req, res) => {
  try {
    const {
      page = '1',
      limit = '20',
      search = '',
      status,
      offset_type,
      reporting_year,
      sort = 'createdAt',
      order = 'desc'
    } = req.query;

    const filter = { organisation_id: req.organisationId, ...notDeleted };
    if (status) filter.status = status;
    if (offset_type) filter.offset_type = offset_type;
    const year = parseYear(reporting_year);
    if (year) filter.reporting_year = year;

    if (search && String(search).trim()) {
      const q = String(search).trim();
      filter.$or = [
        { offset_name: { $regex: q, $options: 'i' } },
        { certificate_number: { $regex: q, $options: 'i' } },
        { issuing_authority: { $regex: q, $options: 'i' } }
      ];
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const sortField = ['offset_name', 'expiry_date', 'createdAt', 'reporting_year', 'status'].includes(sort)
      ? sort
      : 'createdAt';
    const sortDir = order === 'asc' ? 1 : -1;

    const [raw, total] = await Promise.all([
      OffsetOpportunity.find(filter)
        .sort({ [sortField]: sortDir })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .lean(),
      OffsetOpportunity.countDocuments(filter)
    ]);

    const data = await Promise.all(
      raw.map(async (row) => enrichOffset(row, req.organisationId))
    );

    res.json({
      success: true,
      data: {
        items: data,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum) || 1
        }
      }
    });
  } catch (error) {
    logger.error('listOffsets error', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to list offsets' });
  }
};

const getOffsetSummary = async (req, res) => {
  try {
    const reportingYear = parseYear(req.query.reporting_year) || new Date().getFullYear();
    const orgId = req.organisationId;

    const offsets = await OffsetOpportunity.find({
      organisation_id: orgId,
      ...notDeleted
    }).lean();

    let totalOffsets = 0;
    let availableQuantity = 0;
    let utilizedQuantity = 0;

    for (const row of offsets) {
      const utilized = await getUtilizedQuantity(row.id, orgId);
      const available = Math.max(0, row.total_quantity - utilized);
      totalOffsets += 1;
      availableQuantity += available;
      utilizedQuantity += utilized;
    }

    const netSummary = await getNetEmissionsSummary(orgId, reportingYear);

    res.json({
      success: true,
      data: {
        total_offsets: totalOffsets,
        available_quantity: availableQuantity,
        utilized_quantity: utilizedQuantity,
        net_emissions_reduced: netSummary.total_offsets_applied,
        reporting_year: reportingYear,
        ...netSummary
      }
    });
  } catch (error) {
    logger.error('getOffsetSummary error', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to load summary' });
  }
};

const getNetEmissions = async (req, res) => {
  try {
    const reportingYear = parseYear(req.query.reporting_year);
    if (!reportingYear) {
      return res.status(400).json({ success: false, message: 'reporting_year is required' });
    }
    const data = await getNetEmissionsSummary(req.organisationId, reportingYear);
    res.json({ success: true, data });
  } catch (error) {
    logger.error('getNetEmissions error', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to calculate net emissions' });
  }
};

const getOffsetById = async (req, res) => {
  try {
    const offset = await findOffsetOr404(req.params.id, req.organisationId);
    if (!offset) {
      return res.status(404).json({ success: false, message: 'Offset not found' });
    }

    const enriched = await enrichOffset(offset.toObject(), req.organisationId);

    const [documents, utilizations] = await Promise.all([
      OffsetDocument.find({
        offset_id: offset.id,
        organisation_id: req.organisationId,
        deleted_at: null
      })
        .sort({ createdAt: -1 })
        .lean(),
      OffsetUtilization.find({
        offset_id: offset.id,
        organisation_id: req.organisationId,
        deleted_at: null
      })
        .sort({ createdAt: -1 })
        .lean()
    ]);

    res.json({
      success: true,
      data: {
        ...enriched,
        documents,
        utilizations,
        activity_log: enriched.activity_log || []
      }
    });
  } catch (error) {
    logger.error('getOffsetById error', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to load offset' });
  }
};

const createOffset = async (req, res) => {
  try {
    const errors = validateOffsetBody(req.body);
    if (errors.length) {
      return res.status(400).json({ success: false, message: errors.join('; ') });
    }

    const duplicate = await OffsetOpportunity.findOne({
      organisation_id: req.organisationId,
      certificate_number: String(req.body.certificate_number).trim(),
      ...notDeleted
    });
    if (duplicate) {
      return res.status(409).json({ success: false, message: 'Certificate number already exists' });
    }

    const scopes = (req.body.applicable_scopes || []).map((s) => parseInt(s, 10));
    const offset = new OffsetOpportunity({
      organisation_id: req.organisationId,
      offset_name: String(req.body.offset_name).trim(),
      offset_type: req.body.offset_type,
      certificate_number: String(req.body.certificate_number).trim(),
      issuing_authority: String(req.body.issuing_authority || '').trim(),
      vintage_year: req.body.vintage_year ? parseInt(req.body.vintage_year, 10) : undefined,
      expiry_date: req.body.expiry_date ? new Date(req.body.expiry_date) : undefined,
      reporting_year: parseYear(req.body.reporting_year),
      applicable_scopes: scopes,
      total_quantity: parseFloat(req.body.total_quantity),
      unit: req.body.unit || 'tco2e',
      notes: String(req.body.notes || '').trim(),
      created_by: req.user?.email || req.user?.id || ''
    });

    appendActivity(offset, 'created', 'Offset opportunity created', req.user);
    if (isExpired(offset.expiry_date)) offset.status = 'expired';

    await offset.save();
    const enriched = await enrichOffset(offset.toObject(), req.organisationId);

    res.status(201).json({ success: true, data: enriched });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: 'Certificate number already exists' });
    }
    logger.error('createOffset error', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to create offset' });
  }
};

const updateOffset = async (req, res) => {
  try {
    const offset = await findOffsetOr404(req.params.id, req.organisationId);
    if (!offset) {
      return res.status(404).json({ success: false, message: 'Offset not found' });
    }

    const errors = validateOffsetBody(req.body, true);
    if (errors.length) {
      return res.status(400).json({ success: false, message: errors.join('; ') });
    }

    if (req.body.certificate_number !== undefined) {
      const cert = String(req.body.certificate_number).trim();
      const dup = await OffsetOpportunity.findOne({
        organisation_id: req.organisationId,
        certificate_number: cert,
        id: { $ne: offset.id },
        ...notDeleted
      });
      if (dup) {
        return res.status(409).json({ success: false, message: 'Certificate number already exists' });
      }
      offset.certificate_number = cert;
    }

    const fields = [
      'offset_name',
      'offset_type',
      'issuing_authority',
      'vintage_year',
      'expiry_date',
      'reporting_year',
      'total_quantity',
      'unit',
      'notes'
    ];
    fields.forEach((f) => {
      if (req.body[f] === undefined) return;
      if (f === 'offset_name') offset.offset_name = String(req.body.offset_name).trim();
      else if (f === 'reporting_year') offset.reporting_year = parseYear(req.body.reporting_year);
      else if (f === 'total_quantity') offset.total_quantity = parseFloat(req.body.total_quantity);
      else if (f === 'vintage_year') offset.vintage_year = parseInt(req.body.vintage_year, 10);
      else if (f === 'expiry_date') offset.expiry_date = req.body.expiry_date ? new Date(req.body.expiry_date) : null;
      else if (f === 'issuing_authority' || f === 'notes') offset[f] = String(req.body[f] || '').trim();
      else offset[f] = req.body[f];
    });

    if (req.body.applicable_scopes !== undefined) {
      offset.applicable_scopes = req.body.applicable_scopes.map((s) => parseInt(s, 10));
    }

    const utilized = await getUtilizedQuantity(offset.id, req.organisationId);
    if (offset.total_quantity < utilized) {
      return res.status(400).json({
        success: false,
        message: `total_quantity cannot be less than utilized quantity (${utilized})`
      });
    }

    appendActivity(offset, 'updated', 'Offset details updated', req.user);
    offset.status = (await enrichOffset(offset.toObject(), req.organisationId)).status;
    await offset.save();

    const enriched = await enrichOffset(offset.toObject(), req.organisationId);
    res.json({ success: true, data: enriched });
  } catch (error) {
    logger.error('updateOffset error', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to update offset' });
  }
};

const deleteOffset = async (req, res) => {
  try {
    const offset = await findOffsetOr404(req.params.id, req.organisationId);
    if (!offset) {
      return res.status(404).json({ success: false, message: 'Offset not found' });
    }
    offset.deleted_at = new Date();
    appendActivity(offset, 'deleted', 'Offset soft-deleted', req.user);
    await offset.save();
    res.json({ success: true, message: 'Offset deleted' });
  } catch (error) {
    logger.error('deleteOffset error', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to delete offset' });
  }
};

const uploadDocuments = async (req, res) => {
  try {
    const offset = await findOffsetOr404(req.params.id, req.organisationId);
    if (!offset) {
      return res.status(404).json({ success: false, message: 'Offset not found' });
    }
    if (!req.files?.length) {
      return res.status(400).json({ success: false, message: 'No files uploaded' });
    }

    const documentType = req.body.document_type || 'other';
    const created = [];

    for (const file of req.files) {
      const doc = await OffsetDocument.create({
        organisation_id: req.organisationId,
        offset_id: offset.id,
        original_name: file.originalname,
        stored_name: file.filename,
        mime_type: file.mimetype,
        size_bytes: file.size,
        storage_path: file.path,
        document_type: documentType,
        uploaded_by: req.user?.email || ''
      });
      created.push(doc.toObject());
    }

    appendActivity(
      offset,
      'documents_uploaded',
      `${created.length} document(s) uploaded`,
      req.user
    );
    await offset.save();

    res.status(201).json({ success: true, data: created });
  } catch (error) {
    logger.error('uploadDocuments error', error);
    res.status(500).json({ success: false, message: error.message || 'Upload failed' });
  }
};

const downloadDocument = async (req, res) => {
  try {
    const doc = await OffsetDocument.findOne({
      id: req.params.docId,
      offset_id: req.params.id,
      organisation_id: req.organisationId,
      deleted_at: null
    });
    if (!doc || !fs.existsSync(doc.storage_path)) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }
    res.download(doc.storage_path, doc.original_name);
  } catch (error) {
    logger.error('downloadDocument error', error);
    res.status(500).json({ success: false, message: error.message || 'Download failed' });
  }
};

const deleteDocument = async (req, res) => {
  try {
    const doc = await OffsetDocument.findOne({
      id: req.params.docId,
      offset_id: req.params.id,
      organisation_id: req.organisationId,
      deleted_at: null
    });
    if (!doc) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }
    doc.deleted_at = new Date();
    await doc.save();
    res.json({ success: true, message: 'Document removed' });
  } catch (error) {
    logger.error('deleteDocument error', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to delete document' });
  }
};

const applyUtilization = async (req, res) => {
  try {
    const { offset_id, reporting_year, quantity_applied, notes } = req.body;
    const year = parseYear(reporting_year);
    const qty = parseFloat(quantity_applied);

    if (!offset_id) {
      return res.status(400).json({ success: false, message: 'offset_id is required' });
    }
    if (!year) {
      return res.status(400).json({ success: false, message: 'reporting_year is required' });
    }
    if (Number.isNaN(qty) || qty <= 0) {
      return res.status(400).json({ success: false, message: 'quantity_applied must be positive' });
    }

    const offset = await findOffsetOr404(offset_id, req.organisationId);
    if (!offset) {
      return res.status(404).json({ success: false, message: 'Offset not found' });
    }

    if (isExpired(offset.expiry_date)) {
      return res.status(400).json({ success: false, message: 'Expired certificates cannot be used' });
    }

    const utilized = await getUtilizedQuantity(offset.id, req.organisationId);
    const available = offset.total_quantity - utilized;
    if (qty > available) {
      return res.status(400).json({
        success: false,
        message: `Quantity exceeds available balance (${available})`
      });
    }

    const gross = await getGrossEmissions(req.organisationId, year);
    const alreadyApplied = await getNetEmissionsSummary(req.organisationId, year);
    const remainingEmissions = Math.max(0, gross - alreadyApplied.total_offsets_applied);

    const countsTowardNet = offset.unit === 'tco2e';
    if (countsTowardNet && qty > remainingEmissions) {
      return res.status(400).json({
        success: false,
        message: `Cannot apply more than remaining gross emissions (${remainingEmissions.toFixed(4)} tCO₂e)`
      });
    }

    const utilization = await OffsetUtilization.create({
      organisation_id: req.organisationId,
      offset_id: offset.id,
      reporting_year: year,
      quantity_applied: qty,
      unit: offset.unit,
      counts_toward_net: countsTowardNet,
      gross_emissions_at_apply: gross,
      applied_by: req.user?.email || '',
      notes: String(notes || '').trim()
    });

    appendActivity(
      offset,
      'utilization_applied',
      `Applied ${qty} ${offset.unit} for reporting year ${year}`,
      req.user
    );
    const enriched = await enrichOffset(offset.toObject(), req.organisationId);
    offset.status = enriched.status;
    await offset.save();

    const netSummary = await getNetEmissionsSummary(req.organisationId, year);

    res.status(201).json({
      success: true,
      data: {
        utilization: utilization.toObject(),
        offset: enriched,
        emissions: netSummary
      }
    });
  } catch (error) {
    logger.error('applyUtilization error', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to apply utilization' });
  }
};

const listUtilizations = async (req, res) => {
  try {
    const year = parseYear(req.query.reporting_year);
    const filter = {
      organisation_id: req.organisationId,
      deleted_at: null
    };
    if (year) filter.reporting_year = year;
    if (req.query.offset_id) filter.offset_id = req.query.offset_id;

    const rows = await OffsetUtilization.find(filter).sort({ createdAt: -1 }).lean();
    res.json({ success: true, data: rows });
  } catch (error) {
    logger.error('listUtilizations error', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to list utilizations' });
  }
};

module.exports = {
  listOffsets,
  getOffsetSummary,
  getNetEmissions,
  getOffsetById,
  createOffset,
  updateOffset,
  deleteOffset,
  uploadDocuments,
  downloadDocument,
  deleteDocument,
  applyUtilization,
  listUtilizations
};
