const mongoose = require('mongoose');
const Employee = require('../models/Employee');
const EmployeeAttendance = require('../models/EmployeeAttendance');
const { FUEL_BASED_MODES, TRANSPORT_MODES } = require('../models/Employee');
const {
  calculateCommuteEmissions,
  getMissingCommuteFactors,
  startOfDayUTC,
  monthRangeUTC
} = require('../services/commuteEmissionService');
const { ensureScope3CommuteFactors } = require('../services/scope3CommuteFactorSeed');
const { aggregateCommuteEmissions } = require('../services/commuteAnalyticsService');
const logger = require('../utils/logger');

const validateEmployeePayload = (body, isUpdate = false) => {
  const errors = [];

  if (!isUpdate || body.name !== undefined) {
    if (!body.name || !String(body.name).trim()) {
      errors.push('name is required');
    }
  }

  if (!isUpdate || body.home_to_office_distance_km !== undefined) {
    const dist = parseFloat(body.home_to_office_distance_km);
    if (Number.isNaN(dist) || dist < 0) {
      errors.push('home_to_office_distance_km must be a non-negative number');
    }
  }

  if (!isUpdate || body.transport_mode !== undefined) {
    if (!body.transport_mode || !TRANSPORT_MODES.includes(body.transport_mode)) {
      errors.push(`transport_mode must be one of: ${TRANSPORT_MODES.join(', ')}`);
    }
  }

  const mode = body.transport_mode;
  if (mode && FUEL_BASED_MODES.includes(mode)) {
    const eff = parseFloat(body.vehicle_fuel_efficiency_kmpl);
    if (Number.isNaN(eff) || eff <= 0) {
      errors.push('vehicle_fuel_efficiency_kmpl is required for fuel-based transport modes');
    }
  }

  return errors;
};

const listEmployees = async (req, res) => {
  try {
    const includeInactive = req.query.includeInactive === 'true';
    const filter = { organisation_id: req.organisationId };
    if (!includeInactive) {
      filter.is_active = true;
    }

    const employees = await Employee.find(filter).sort({ name: 1 }).lean();

    res.json({
      success: true,
      data: employees.map((e) => ({ ...e, id: e._id.toString() }))
    });
  } catch (error) {
    logger.error('listEmployees error', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to list employees' });
  }
};

const createEmployee = async (req, res) => {
  try {
    const errors = validateEmployeePayload(req.body);
    if (errors.length) {
      return res.status(400).json({ success: false, message: errors.join('; ') });
    }

    const employee = await Employee.create({
      organisation_id: req.organisationId,
      name: String(req.body.name).trim(),
      employee_id: req.body.employee_id ? String(req.body.employee_id).trim() : '',
      home_to_office_distance_km: parseFloat(req.body.home_to_office_distance_km),
      transport_mode: req.body.transport_mode,
      vehicle_number: req.body.vehicle_number ? String(req.body.vehicle_number).trim() : '',
      vehicle_fuel_efficiency_kmpl: FUEL_BASED_MODES.includes(req.body.transport_mode)
        ? parseFloat(req.body.vehicle_fuel_efficiency_kmpl)
        : null,
      created_by: req.user.id
    });

    res.status(201).json({
      success: true,
      data: { ...employee.toObject(), id: employee._id.toString() }
    });
  } catch (error) {
    logger.error('createEmployee error', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to create employee' });
  }
};

const updateEmployee = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid employee ID' });
    }

    const errors = validateEmployeePayload(req.body, true);
    if (errors.length) {
      return res.status(400).json({ success: false, message: errors.join('; ') });
    }

    const employee = await Employee.findOne({
      _id: req.params.id,
      organisation_id: req.organisationId
    });

    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    const fields = [
      'name',
      'employee_id',
      'home_to_office_distance_km',
      'transport_mode',
      'vehicle_number',
      'vehicle_fuel_efficiency_kmpl',
      'is_active'
    ];

    for (const field of fields) {
      if (req.body[field] !== undefined) {
        if (field === 'home_to_office_distance_km' || field === 'vehicle_fuel_efficiency_kmpl') {
          employee[field] = parseFloat(req.body[field]);
        } else if (field === 'is_active') {
          employee[field] = Boolean(req.body[field]);
        } else {
          employee[field] = req.body[field];
        }
      }
    }

    const mode = employee.transport_mode;
    if (!FUEL_BASED_MODES.includes(mode)) {
      employee.vehicle_fuel_efficiency_kmpl = null;
    }

    await employee.save();

    res.json({
      success: true,
      data: { ...employee.toObject(), id: employee._id.toString() }
    });
  } catch (error) {
    logger.error('updateEmployee error', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to update employee' });
  }
};

const deleteEmployee = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid employee ID' });
    }

    const employee = await Employee.findOneAndUpdate(
      { _id: req.params.id, organisation_id: req.organisationId },
      { is_active: false },
      { new: true }
    );

    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    res.json({ success: true, message: 'Employee deactivated', data: { id: employee._id.toString() } });
  } catch (error) {
    logger.error('deleteEmployee error', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to deactivate employee' });
  }
};

const bulkAttendance = async (req, res) => {
  try {
    const { date, records } = req.body;

    if (!date || !Array.isArray(records) || records.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'date and records array are required'
      });
    }

    const dayStart = startOfDayUTC(date);
    const ops = [];

    for (const row of records) {
      if (!mongoose.Types.ObjectId.isValid(row.employee_id)) {
        return res.status(400).json({ success: false, message: `Invalid employee_id: ${row.employee_id}` });
      }

      const employee = await Employee.findOne({
        _id: row.employee_id,
        organisation_id: req.organisationId,
        is_active: true
      });

      if (!employee) {
        return res.status(404).json({
          success: false,
          message: `Active employee not found: ${row.employee_id}`
        });
      }

      ops.push(
        EmployeeAttendance.findOneAndUpdate(
          {
            organisation_id: req.organisationId,
            employee_id: row.employee_id,
            date: dayStart
          },
          {
            organisation_id: req.organisationId,
            employee_id: row.employee_id,
            date: dayStart,
            is_present: Boolean(row.is_present),
            marked_by: req.user.id
          },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        )
      );
    }

    const saved = await Promise.all(ops);

    res.json({
      success: true,
      data: {
        date: dayStart.toISOString().slice(0, 10),
        count: saved.length
      }
    });
  } catch (error) {
    logger.error('bulkAttendance error', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to save attendance' });
  }
};

const getAttendance = async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) {
      return res.status(400).json({ success: false, message: 'date query parameter is required (YYYY-MM-DD)' });
    }

    const dayStart = startOfDayUTC(date);
    const dayEnd = new Date(dayStart);
    dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

    const records = await EmployeeAttendance.find({
      organisation_id: req.organisationId,
      date: { $gte: dayStart, $lt: dayEnd }
    }).lean();

    res.json({
      success: true,
      data: records.map((r) => ({
        ...r,
        id: r._id.toString(),
        employee_id: r.employee_id.toString()
      }))
    });
  } catch (error) {
    logger.error('getAttendance error', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch attendance' });
  }
};

const getEmissions = async (req, res) => {
  try {
    const month = req.query.month;
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({
        success: false,
        message: 'month query parameter is required (YYYY-MM)'
      });
    }

    const { start, end } = monthRangeUTC(month);
    const orgId = req.organisationId;

    const employees = await Employee.find({ organisation_id: orgId, is_active: true }).lean();
    const attendance = await EmployeeAttendance.find({
      organisation_id: orgId,
      date: { $gte: start, $lte: end }
    }).lean();

    const attendanceByEmployee = {};
    for (const row of attendance) {
      const key = row.employee_id.toString();
      if (!attendanceByEmployee[key]) attendanceByEmployee[key] = [];
      attendanceByEmployee[key].push(row);
    }

    await ensureScope3CommuteFactors();

    const missingFactors = await getMissingCommuteFactors(
      orgId,
      employees.map((e) => e.transport_mode)
    );

    const byEmployee = [];
    const byModeMap = {};
    let totalCo2eKg = 0;
    let workingDaysRecorded = new Set();

    for (const emp of employees) {
      const empId = emp._id.toString();
      const days = attendanceByEmployee[empId] || [];

      days.forEach((d) => {
        workingDaysRecorded.add(d.date.toISOString().slice(0, 10));
      });

      if (missingFactors.includes(emp.transport_mode)) {
        byEmployee.push({
          employee_id: empId,
          name: emp.name,
          transport_mode: emp.transport_mode,
          present_days: days.filter((d) => d.is_present).length,
          total_co2e_kg: 0,
          error: 'missing_emission_factor'
        });
        continue;
      }

      try {
        const result = await calculateCommuteEmissions(emp, days, orgId);
        totalCo2eKg += result.total_co2e_kg;

        byEmployee.push({
          employee_id: empId,
          name: emp.name,
          employee_code: emp.employee_id,
          transport_mode: emp.transport_mode,
          present_days: result.present_days,
          co2_per_day_kg: result.co2_per_day_kg,
          total_co2e_kg: result.total_co2e_kg
        });

        if (!byModeMap[emp.transport_mode]) {
          byModeMap[emp.transport_mode] = 0;
        }
        byModeMap[emp.transport_mode] += result.total_co2e_kg;
      } catch (err) {
        byEmployee.push({
          employee_id: empId,
          name: emp.name,
          transport_mode: emp.transport_mode,
          present_days: days.filter((d) => d.is_present).length,
          total_co2e_kg: 0,
          error: err.message
        });
      }
    }

    const byMode = Object.entries(byModeMap).map(([mode, co2]) => ({
      transport_mode: mode,
      total_co2e_kg: parseFloat(co2.toFixed(4))
    }));

    const missing_fuel_efficiency = employees
      .filter(
        (e) =>
          FUEL_BASED_MODES.includes(e.transport_mode) &&
          (!e.vehicle_fuel_efficiency_kmpl || e.vehicle_fuel_efficiency_kmpl <= 0)
      )
      .map((e) => ({ employee_id: e._id.toString(), name: e.name }));

    res.json({
      success: true,
      data: {
        month,
        total_co2e_kg: parseFloat(totalCo2eKg.toFixed(4)),
        total_co2e_tonnes: parseFloat((totalCo2eKg / 1000).toFixed(6)),
        employee_count: employees.length,
        working_days_recorded: workingDaysRecorded.size,
        missing_factors: missingFactors,
        missing_fuel_efficiency,
        by_employee: byEmployee,
        by_mode: byMode
      }
    });
  } catch (error) {
    logger.error('getEmissions error', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to calculate emissions' });
  }
};

const getCommuteTotal = async (req, res) => {
  try {
    const orgId = req.organisationId;
    let startDate = null;
    let endDate = null;

    if (req.query.startDate) {
      startDate = new Date(req.query.startDate);
      if (Number.isNaN(startDate.getTime())) {
        return res.status(400).json({ success: false, message: 'Invalid startDate' });
      }
    }
    if (req.query.endDate) {
      endDate = new Date(req.query.endDate);
      if (Number.isNaN(endDate.getTime())) {
        return res.status(400).json({ success: false, message: 'Invalid endDate' });
      }
    }

    const commute = await aggregateCommuteEmissions(orgId, startDate, endDate);

    res.json({
      success: true,
      data: {
        total_co2e_kg: commute.total_co2e_kg,
        present_days: commute.present_days,
        employee_count: commute.employee_count,
        missing_factors: commute.missing_factors
      }
    });
  } catch (error) {
    logger.error('getCommuteTotal error', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to calculate commute emissions total'
    });
  }
};

module.exports = {
  listEmployees,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  bulkAttendance,
  getAttendance,
  getEmissions,
  getCommuteTotal
};
