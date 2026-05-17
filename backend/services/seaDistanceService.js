const path = require('path');
const fs = require('fs');
const { greatCircleDistanceKm } = require('./flightDistanceService');

/** Typical sailed distance vs great-circle (lanes, coastlines, traffic separation). */
const SEA_ROUTING_FACTOR = 1.12;

let portsCache = null;

function loadPorts() {
  if (portsCache) return portsCache;
  const filePath = path.join(__dirname, '../data/ports.json');
  portsCache = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  return portsCache;
}

function getPortByCode(code) {
  if (!code) return null;
  const normalized = String(code).trim().toUpperCase().replace(/\s/g, '');
  return loadPorts().find((p) => p.code === normalized) || null;
}

function searchPorts(query, limit = 20) {
  const q = String(query || '').trim().toLowerCase();
  if (q.length < 1) return [];

  const ports = loadPorts();
  const results = [];

  for (const port of ports) {
    const haystack = [port.code, port.name, port.city, port.country]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    if (
      port.code.toLowerCase() === q ||
      port.code.toLowerCase().startsWith(q) ||
      haystack.includes(q)
    ) {
      results.push(port);
      if (results.length >= limit) break;
    }
  }

  results.sort((a, b) => {
    const aExact = a.code.toLowerCase() === q ? 0 : 1;
    const bExact = b.code.toLowerCase() === q ? 0 : 1;
    if (aExact !== bExact) return aExact - bExact;
    return a.name.localeCompare(b.name);
  });

  return results.slice(0, limit);
}

function calculateSeaDistance(originCode, destinationCode, options = {}) {
  const origin = getPortByCode(originCode);
  const destination = getPortByCode(destinationCode);

  if (!origin) {
    const err = new Error(`Unknown origin port: ${originCode}`);
    err.statusCode = 404;
    throw err;
  }
  if (!destination) {
    const err = new Error(`Unknown destination port: ${destinationCode}`);
    err.statusCode = 404;
    throw err;
  }
  if (origin.code === destination.code) {
    const err = new Error('Origin and destination must be different ports');
    err.statusCode = 400;
    throw err;
  }

  const routingFactor = options.routingFactor ?? SEA_ROUTING_FACTOR;
  const greatCircleKm = greatCircleDistanceKm(
    origin.lat,
    origin.lon,
    destination.lat,
    destination.lon
  );
  const seaDistanceKm = greatCircleKm * routingFactor;

  const roundTrip = options.roundTrip === true;
  const oneWayKm = parseFloat(seaDistanceKm.toFixed(1));
  const distanceKm = roundTrip ? parseFloat((oneWayKm * 2).toFixed(1)) : oneWayKm;

  return {
    origin: {
      code: origin.code,
      name: origin.name,
      city: origin.city,
      country: origin.country,
      lat: origin.lat,
      lon: origin.lon
    },
    destination: {
      code: destination.code,
      name: destination.name,
      city: destination.city,
      country: destination.country,
      lat: destination.lat,
      lon: destination.lon
    },
    great_circle_km: parseFloat(greatCircleKm.toFixed(1)),
    routing_factor: routingFactor,
    sea_distance_km: oneWayKm,
    round_trip: roundTrip,
    distance_km: distanceKm,
    method: 'great_circle_with_sea_routing_factor'
  };
}

module.exports = {
  SEA_ROUTING_FACTOR,
  loadPorts,
  getPortByCode,
  searchPorts,
  calculateSeaDistance
};
