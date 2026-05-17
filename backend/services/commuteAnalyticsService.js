const Employee = require('../models/Employee');
const EmployeeAttendance = require('../models/EmployeeAttendance');
const {
  calculateCommuteEmissions,
  getMissingCommuteFactors
} = require('./commuteEmissionService');
const { ensureScope3CommuteFactors } = require('./scope3CommuteFactorSeed');

/**
 * Aggregate employee commute CO2e for an organisation over an optional date range.
 */
async function aggregateCommuteEmissions(organisationId, startDate = null, endDate = null) {
  await ensureScope3CommuteFactors();

  const attendanceQuery = { organisation_id: organisationId };
  if (startDate || endDate) {
    attendanceQuery.date = {};
    if (startDate) attendanceQuery.date.$gte = startDate;
    if (endDate) attendanceQuery.date.$lte = endDate;
  }

  const employeeIds = new Set();
  const attendance = await EmployeeAttendance.find(attendanceQuery).lean();

  for (const row of attendance) {
    employeeIds.add(row.employee_id.toString());
  }

  if (employeeIds.size === 0) {
    return {
      total_co2e_kg: 0,
      present_days: 0,
      employee_count: 0,
      missing_factors: []
    };
  }

  const employees = await Employee.find({
    organisation_id: organisationId,
    _id: { $in: [...employeeIds] }
  }).lean();

  const attendanceByEmployee = {};
  for (const row of attendance) {
    const key = row.employee_id.toString();
    if (!attendanceByEmployee[key]) attendanceByEmployee[key] = [];
    attendanceByEmployee[key].push(row);
  }

  const missingFactors = await getMissingCommuteFactors(
    organisationId,
    employees.map((e) => e.transport_mode)
  );

  let totalCo2eKg = 0;
  let presentDays = 0;

  for (const emp of employees) {
    const empId = emp._id.toString();
    const days = attendanceByEmployee[empId] || [];
    const present = days.filter((d) => d.is_present);

    if (missingFactors.includes(emp.transport_mode)) continue;

    try {
      const result = await calculateCommuteEmissions(emp, days, organisationId);
      totalCo2eKg += result.total_co2e_kg;
      presentDays += result.present_days;
    } catch {
      /* skip employees that cannot be calculated */
    }
  }

  return {
    total_co2e_kg: parseFloat(totalCo2eKg.toFixed(4)),
    present_days: presentDays,
    employee_count: employees.length,
    missing_factors: missingFactors
  };
}

/**
 * Monthly commute totals for scope-migration charts.
 * Returns Map of 'YYYY-MM' -> co2e kg
 */
async function aggregateCommuteEmissionsByMonth(organisationId, startDate = null, endDate = null) {
  await ensureScope3CommuteFactors();

  const attendanceQuery = { organisation_id: organisationId, is_present: true };
  if (startDate || endDate) {
    attendanceQuery.date = {};
    if (startDate) attendanceQuery.date.$gte = startDate;
    if (endDate) attendanceQuery.date.$lte = endDate;
  }

  const attendance = await EmployeeAttendance.find(attendanceQuery).lean();
  if (!attendance.length) return new Map();

  const employeeIds = [...new Set(attendance.map((a) => a.employee_id.toString()))];
  const employees = await Employee.find({
    organisation_id: organisationId,
    _id: { $in: employeeIds }
  }).lean();

  const empMap = Object.fromEntries(employees.map((e) => [e._id.toString(), e]));
  const missingFactors = await getMissingCommuteFactors(
    organisationId,
    employees.map((e) => e.transport_mode)
  );

  const byMonthEmployeeDays = {};

  for (const row of attendance) {
    if (!row.is_present) continue;
    const empId = row.employee_id.toString();
    const emp = empMap[empId];
    if (!emp || missingFactors.includes(emp.transport_mode)) continue;

    const d = new Date(row.date);
    const period = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    const key = `${period}|${empId}`;
    if (!byMonthEmployeeDays[key]) {
      byMonthEmployeeDays[key] = { period, emp, days: [] };
    }
    byMonthEmployeeDays[key].days.push(row);
  }

  const monthTotals = new Map();

  for (const { period, emp, days } of Object.values(byMonthEmployeeDays)) {
    try {
      const result = await calculateCommuteEmissions(emp, days, organisationId);
      monthTotals.set(period, (monthTotals.get(period) || 0) + result.total_co2e_kg);
    } catch {
      /* skip */
    }
  }

  return monthTotals;
}

module.exports = {
  aggregateCommuteEmissions,
  aggregateCommuteEmissionsByMonth
};
