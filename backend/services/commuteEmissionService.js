const EmissionFactor = require('../models/EmissionFactor');
const { FUEL_BASED_MODES } = require('../models/Employee');

const COMMUTE_CATEGORY = 'scope3_commute';

/**
 * Fetch commute emission factor from DB (org-specific overrides global).
 */
async function getCommuteEmissionFactor(organisationId, transportMode) {
  const baseQuery = {
    scope: 3,
    category: COMMUTE_CATEGORY,
    subcategory: transportMode,
    isActive: true
  };

  const orgFactor = await EmissionFactor.findOne({
    ...baseQuery,
    organisation_id: organisationId
  }).lean();

  if (orgFactor) return orgFactor;

  const globalFactor = await EmissionFactor.findOne({
    scope: 3,
    category: COMMUTE_CATEGORY,
    subcategory: transportMode,
    isActive: true,
    $or: [
      { organisation_id: null },
      { organisation_id: { $exists: false } },
      { organisation_id: '' }
    ]
  }).lean();

  return globalFactor;
}

/**
 * List transport modes used by org that lack a configured factor.
 */
async function getMissingCommuteFactors(organisationId, transportModes) {
  const uniqueModes = [...new Set(transportModes)];
  const missing = [];

  for (const mode of uniqueModes) {
    const factor = await getCommuteEmissionFactor(organisationId, mode);
    if (!factor) {
      missing.push(mode);
    }
  }

  return missing;
}

/**
 * Calculate CO2e for one employee over attendance days.
 */
async function calculateCommuteEmissions(employee, attendanceDays, organisationId) {
  const factorDoc = await getCommuteEmissionFactor(organisationId, employee.transport_mode);

  if (!factorDoc) {
    const err = new Error(
      `No emission factor configured for transport mode "${employee.transport_mode}". Ask an admin to configure scope3_commute factors.`
    );
    err.code = 'MISSING_EMISSION_FACTOR';
    err.transport_mode = employee.transport_mode;
    throw err;
  }

  const factorValue = factorDoc.factor;
  const unit = factorDoc.unit;
  const distanceKm = employee.home_to_office_distance_km;
  let co2PerDay = 0;

  if (unit === 'kg_co2_per_litre') {
    if (!FUEL_BASED_MODES.includes(employee.transport_mode)) {
      throw new Error(`Transport mode ${employee.transport_mode} expects distance-based factor unit`);
    }
    const efficiency = employee.vehicle_fuel_efficiency_kmpl;
    if (!efficiency || efficiency <= 0) {
      throw new Error('Fuel efficiency (km/L) is required for fuel-based transport modes');
    }
    const fuelPerDay = (distanceKm / efficiency) * 2;
    co2PerDay = fuelPerDay * factorValue;
  } else if (unit === 'kg_co2_per_passenger_km') {
    co2PerDay = distanceKm * 2 * factorValue;
  } else {
    throw new Error(`Unsupported emission factor unit: ${unit}`);
  }

  const presentDays = attendanceDays.filter((d) => d.is_present).length;
  const totalCo2eKg = co2PerDay * presentDays;

  return {
    co2_per_day_kg: parseFloat(co2PerDay.toFixed(4)),
    present_days: presentDays,
    total_co2e_kg: parseFloat(totalCo2eKg.toFixed(4)),
    total_co2e_tonnes: parseFloat((totalCo2eKg / 1000).toFixed(6)),
    factor: {
      value: factorValue,
      unit,
      source: factorDoc.source || 'EmissionFactor collection'
    }
  };
}

function startOfDayUTC(dateInput) {
  const d = new Date(dateInput);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function monthRangeUTC(monthStr) {
  const [year, month] = monthStr.split('-').map(Number);
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
  return { start, end };
}

module.exports = {
  COMMUTE_CATEGORY,
  getCommuteEmissionFactor,
  getMissingCommuteFactors,
  calculateCommuteEmissions,
  startOfDayUTC,
  monthRangeUTC
};
