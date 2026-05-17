const mongoose = require('mongoose');
const ProductionRecord = require('../models/ProductionRecord');
const { PRODUCTION_UNITS } = require('../models/ProductionRecord');
const logger = require('../utils/logger');

function normalizeMonth(input) {
  if (!input) return null;
  const s = String(input).trim();
  if (/^\d{4}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function currentMonth() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function validatePayload(body, isUpdate = false) {
  const errors = [];

  if (!isUpdate || body.product_name !== undefined) {
    if (!body.product_name || !String(body.product_name).trim()) {
      errors.push('product_name is required');
    }
  }

  if (!isUpdate || body.quantity !== undefined) {
    const q = parseFloat(body.quantity);
    if (Number.isNaN(q) || q < 0) {
      errors.push('quantity must be a non-negative number');
    }
  }

  if (!isUpdate || body.unit !== undefined) {
    if (!body.unit || !PRODUCTION_UNITS.includes(body.unit)) {
      errors.push(`unit must be one of: ${PRODUCTION_UNITS.join(', ')}`);
    }
  }

  if (!isUpdate || body.period_month !== undefined) {
    const month = normalizeMonth(body.period_month);
    if (!month) {
      errors.push('period_month must be YYYY-MM');
    }
  }

  return errors;
}

const listProduction = async (req, res) => {
  try {
    const filter = { organisation_id: req.organisationId };
    const month = normalizeMonth(req.query.month);
    if (month) filter.period_month = month;

    const records = await ProductionRecord.find(filter)
      .sort({ period_month: -1, product_name: 1 })
      .lean();

    res.json({
      success: true,
      data: records.map((r) => ({ ...r, id: r._id.toString() }))
    });
  } catch (error) {
    logger.error('listProduction error', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to list production' });
  }
};

const getProductionSummary = async (req, res) => {
  try {
    const month = normalizeMonth(req.query.month) || currentMonth();
    const rows = await ProductionRecord.aggregate([
      { $match: { organisation_id: req.organisationId, period_month: month } },
      {
        $group: {
          _id: { product_name: '$product_name', unit: '$unit' },
          total_quantity: { $sum: '$quantity' },
          entries: { $sum: 1 }
        }
      },
      { $sort: { '_id.product_name': 1 } }
    ]);

    const grandTotal = rows.reduce((s, r) => s + r.total_quantity, 0);

    res.json({
      success: true,
      data: {
        period_month: month,
        by_product: rows.map((r) => ({
          product_name: r._id.product_name,
          unit: r._id.unit,
          total_quantity: r.total_quantity,
          entries: r.entries
        })),
        total_entries: rows.reduce((s, r) => s + r.entries, 0),
        note: 'Totals are grouped by product and unit; mixed units are not summed together.'
      }
    });
  } catch (error) {
    logger.error('getProductionSummary error', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to summarise production' });
  }
};

const createProduction = async (req, res) => {
  try {
    const errors = validatePayload(req.body);
    if (errors.length) {
      return res.status(400).json({ success: false, message: errors.join('; ') });
    }

    const record = await ProductionRecord.create({
      organisation_id: req.organisationId,
      product_name: String(req.body.product_name).trim(),
      product_code: req.body.product_code ? String(req.body.product_code).trim() : '',
      quantity: parseFloat(req.body.quantity),
      unit: req.body.unit,
      period_month: normalizeMonth(req.body.period_month) || currentMonth(),
      notes: req.body.notes ? String(req.body.notes).trim() : '',
      created_by: req.user?.id || req.user?._id?.toString() || ''
    });

    res.status(201).json({
      success: true,
      data: { ...record.toObject(), id: record._id.toString() }
    });
  } catch (error) {
    logger.error('createProduction error', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to create production record' });
  }
};

const updateProduction = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid record id' });
    }

    const errors = validatePayload(req.body, true);
    if (errors.length) {
      return res.status(400).json({ success: false, message: errors.join('; ') });
    }

    const updates = {};
    if (req.body.product_name !== undefined) updates.product_name = String(req.body.product_name).trim();
    if (req.body.product_code !== undefined) updates.product_code = String(req.body.product_code).trim();
    if (req.body.quantity !== undefined) updates.quantity = parseFloat(req.body.quantity);
    if (req.body.unit !== undefined) updates.unit = req.body.unit;
    if (req.body.period_month !== undefined) updates.period_month = normalizeMonth(req.body.period_month);
    if (req.body.notes !== undefined) updates.notes = String(req.body.notes).trim();

    const record = await ProductionRecord.findOneAndUpdate(
      { _id: req.params.id, organisation_id: req.organisationId },
      { $set: updates },
      { new: true }
    ).lean();

    if (!record) {
      return res.status(404).json({ success: false, message: 'Production record not found' });
    }

    res.json({
      success: true,
      data: { ...record, id: record._id.toString() }
    });
  } catch (error) {
    logger.error('updateProduction error', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to update production record' });
  }
};

const deleteProduction = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid record id' });
    }

    const result = await ProductionRecord.findOneAndDelete({
      _id: req.params.id,
      organisation_id: req.organisationId
    });

    if (!result) {
      return res.status(404).json({ success: false, message: 'Production record not found' });
    }

    res.json({ success: true, message: 'Production record deleted' });
  } catch (error) {
    logger.error('deleteProduction error', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to delete production record' });
  }
};

module.exports = {
  listProduction,
  getProductionSummary,
  createProduction,
  updateProduction,
  deleteProduction,
  PRODUCTION_UNITS
};
