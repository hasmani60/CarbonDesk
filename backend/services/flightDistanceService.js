const path = require('path');
const fs = require('fs');

/** Great-circle distance is ~5–12% shorter than typical flown track (DEFRA / ICAO guidance). */
const FLIGHT_ROUTING_FACTOR = 1.09;

let airportsCache = null;

function loadAirports() {
  if (airportsCache) return airportsCache;
  const filePath = path.join(__dirname, '../data/airports.json');
  airportsCache = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  return airportsCache;
}

function getAirportByIata(iata) {
  if (!iata) return null;
  const code = String(iata).trim().toUpperCase();
  return loadAirports().find((a) => a.iata === code) || null;
}

/**
 * Haversine great-circle distance in km.
 */
function greatCircleDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Search airports by IATA, name, city, or country.
 */
function searchAirports(query, limit = 20) {
  const q = String(query || '').trim().toLowerCase();
  if (q.length < 1) return [];

  const airports = loadAirports();
  const results = [];

  for (const airport of airports) {
    const haystack = [
      airport.iata,
      airport.icao,
      airport.name,
      airport.city,
      airport.country
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    if (
      airport.iata.toLowerCase() === q ||
      airport.iata.toLowerCase().startsWith(q) ||
      haystack.includes(q)
    ) {
      results.push(airport);
      if (results.length >= limit) break;
    }
  }

  // Prefer exact IATA matches first
  results.sort((a, b) => {
    const aExact = a.iata.toLowerCase() === q ? 0 : 1;
    const bExact = b.iata.toLowerCase() === q ? 0 : 1;
    if (aExact !== bExact) return aExact - bExact;
    return a.name.localeCompare(b.name);
  });

  return results.slice(0, limit);
}

/**
 * Compute flight distance between two IATA airports.
 */
function calculateFlightDistance(originIata, destinationIata, options = {}) {
  const origin = getAirportByIata(originIata);
  const destination = getAirportByIata(destinationIata);

  if (!origin) {
    const err = new Error(`Unknown origin airport: ${originIata}`);
    err.statusCode = 404;
    throw err;
  }
  if (!destination) {
    const err = new Error(`Unknown destination airport: ${destinationIata}`);
    err.statusCode = 404;
    throw err;
  }
  if (origin.iata === destination.iata) {
    const err = new Error('Origin and destination must be different airports');
    err.statusCode = 400;
    throw err;
  }

  const routingFactor = options.routingFactor ?? FLIGHT_ROUTING_FACTOR;
  const greatCircleKm = greatCircleDistanceKm(
    origin.lat,
    origin.lon,
    destination.lat,
    destination.lon
  );
  const flightDistanceKm = greatCircleKm * routingFactor;

  const roundTrip = options.roundTrip === true;
  const oneWayKm = parseFloat(flightDistanceKm.toFixed(1));
  const distanceKm = roundTrip ? parseFloat((oneWayKm * 2).toFixed(1)) : oneWayKm;

  return {
    origin: {
      iata: origin.iata,
      name: origin.name,
      city: origin.city,
      country: origin.country,
      lat: origin.lat,
      lon: origin.lon
    },
    destination: {
      iata: destination.iata,
      name: destination.name,
      city: destination.city,
      country: destination.country,
      lat: destination.lat,
      lon: destination.lon
    },
    great_circle_km: parseFloat(greatCircleKm.toFixed(1)),
    routing_factor: routingFactor,
    flight_distance_km: oneWayKm,
    round_trip: roundTrip,
    distance_km: distanceKm,
    method: 'great_circle_with_routing_factor'
  };
}

module.exports = {
  FLIGHT_ROUTING_FACTOR,
  loadAirports,
  getAirportByIata,
  searchAirports,
  calculateFlightDistance,
  greatCircleDistanceKm
};
