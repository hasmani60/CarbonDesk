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

const COMMUTE_ACTIVITY_LABEL = 'Employee Commuting (Category 7)';

function includesScope3InFilters(filters = {}) {
  const raw =
    filters.selectedScopes ||
    filters.scopes ||
    (filters.scope != null ? [filters.scope] : null);
  if (raw == null) return true;
  const arr = Array.isArray(raw) ? raw : String(raw).split(',').map((s) => s.trim());
  const scopes = [...new Set(arr.map((s) => parseInt(s, 10)).filter((n) => n >= 1 && n <= 3))];
  return scopes.length === 0 || scopes.includes(3);
}

/**
 * Merge commute into scope-3 / company totals (kg CO2e).
 */
function applyCommuteToTotals({
  scope3Co2e = 0,
  scope3Count = 0,
  totalCo2e = 0,
  totalCount = 0,
  commute
}) {
  const kg = commute?.total_co2e_kg || 0;
  const days = commute?.present_days || 0;
  return {
    scope3_co2e: scope3Co2e + kg,
    scope3_count: scope3Count + days,
    total_co2e: totalCo2e + kg,
    total_count: totalCount + days,
    commute_co2e_kg: kg,
    commute_present_days: days
  };
}

/**
 * Add commute CO2e to each period's scope3 and total (array of { period, scope1, scope2, scope3, total }).
 */
function mergeCommuteIntoScopePeriods(periods, commuteByMonth) {
  if (!commuteByMonth?.size) return periods;

  const periodMap = Object.fromEntries(periods.map((p) => [p.period, { ...p }]));

  commuteByMonth.forEach((co2e, period) => {
    if (!periodMap[period]) {
      periodMap[period] = {
        period,
        scope1: 0,
        scope2: 0,
        scope3: 0,
        total: 0
      };
    }
    periodMap[period].scope3 = (periodMap[period].scope3 || 0) + co2e;
    periodMap[period].total = (periodMap[period].total || 0) + co2e;
  });

  return Object.values(periodMap).sort((a, b) =>
    String(a.period).localeCompare(String(b.period))
  );
}

/**
 * Merge commute into dashboard monthly trend rows ({ month, total_co2e, count }).
 */
function mergeCommuteIntoMonthlyTrend(monthlyTrend, commuteByMonth) {
  if (!commuteByMonth?.size) return monthlyTrend;

  const byMonth = Object.fromEntries(
    (monthlyTrend || []).map((row) => {
      const key = row.month || row.date;
      return [key, { ...row }];
    })
  );

  commuteByMonth.forEach((co2e, period) => {
    if (byMonth[period]) {
      byMonth[period].total_co2e = (byMonth[period].total_co2e || 0) + co2e;
    } else {
      byMonth[period] = { month: period, total_co2e: co2e, count: 0 };
    }
  });

  return Object.values(byMonth).sort((a, b) =>
    String(a.month || a.date).localeCompare(String(b.month || b.date))
  );
}

/**
 * Include employee commuting in scope-3 top-activities list when material.
 */
function upsertCommuteInTopActivities(activities, commuteKg, limit = 3) {
  if (!commuteKg || commuteKg <= 0) return activities;

  const merged = [
    ...activities,
    {
      activity: COMMUTE_ACTIVITY_LABEL,
      scope: 3,
      count: 0,
      total_co2e: parseFloat(commuteKg.toFixed(2))
    }
  ]
    .sort((a, b) => (b.total_co2e || 0) - (a.total_co2e || 0))
    .slice(0, limit);

  return merged;
}

module.exports = {
  COMMUTE_ACTIVITY_LABEL,
  aggregateCommuteEmissions,
  aggregateCommuteEmissionsByMonth,
  includesScope3InFilters,
  applyCommuteToTotals,
  mergeCommuteIntoScopePeriods,
  mergeCommuteIntoMonthlyTrend,
  upsertCommuteInTopActivities
};
