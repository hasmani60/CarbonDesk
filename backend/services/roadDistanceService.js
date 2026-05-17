const https = require('https');

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';
const OSRM_BASE = 'https://router.project-osrm.org';
const USER_AGENT =
  process.env.NOMINATIM_USER_AGENT ||
  'CarbonDesk/1.0 (carbon-accounting; support@carbondesk.local)';

const geocodeCache = new Map();
const CACHE_TTL_MS = 60 * 60 * 1000;

function httpsGetJson(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'application/json',
          ...headers
        }
      },
      (res) => {
        let body = '';
        res.on('data', (c) => {
          body += c;
        });
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 400) {
            const err = new Error(`HTTP ${res.statusCode}: ${body.slice(0, 200)}`);
            err.statusCode = res.statusCode;
            return reject(err);
          }
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            reject(e);
          }
        });
      }
    );
    req.on('error', reject);
    req.setTimeout(15000, () => {
      req.destroy(new Error('Request timeout'));
    });
  });
}

function normalizePlace(item) {
  return {
    place_id: String(item.place_id),
    label: item.display_name,
    name: item.name || item.display_name?.split(',')[0] || '',
    lat: parseFloat(item.lat),
    lon: parseFloat(item.lon),
    country: item.address?.country_code?.toUpperCase() || item.address?.country || '',
    type: item.type || item.class || 'place'
  };
}

/**
 * Search places (addresses, cities, POIs) via OpenStreetMap Nominatim.
 */
async function searchPlaces(query, limit = 10) {
  const q = String(query || '').trim();
  if (q.length < 2) return [];

  const cacheKey = `search:${q.toLowerCase()}:${limit}`;
  const cached = geocodeCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return cached.data;
  }

  const url =
    `${NOMINATIM_BASE}/search?format=json&addressdetails=1&limit=${limit}` +
    `&q=${encodeURIComponent(q)}`;

  const rows = await httpsGetJson(url);
  const places = (Array.isArray(rows) ? rows : [])
    .filter((r) => r.lat && r.lon)
    .map(normalizePlace);

  geocodeCache.set(cacheKey, { ts: Date.now(), data: places });
  return places;
}

/**
 * Reverse lookup by place_id (Nominatim details).
 */
async function getPlaceById(placeId) {
  const id = String(placeId || '').trim();
  if (!id) return null;

  const cacheKey = `place:${id}`;
  const cached = geocodeCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return cached.data;
  }

  const url = `${NOMINATIM_BASE}/lookup?format=json&addressdetails=1&place_ids=${encodeURIComponent(id)}`;
  const rows = await httpsGetJson(url);
  if (!Array.isArray(rows) || !rows[0]) return null;

  const place = normalizePlace(rows[0]);
  geocodeCache.set(cacheKey, { ts: Date.now(), data: place });
  return place;
}

/**
 * Driving distance (km) via OSRM public routing API.
 */
async function calculateDrivingDistance(origin, destination, options = {}) {
  if (!origin?.lat || !origin?.lon || !destination?.lat || !destination?.lon) {
    const err = new Error('Origin and destination coordinates are required');
    err.statusCode = 400;
    throw err;
  }

  const coords = `${origin.lon},${origin.lat};${destination.lon},${destination.lat}`;
  const url = `${OSRM_BASE}/route/v1/driving/${coords}?overview=false&alternatives=false`;

  const data = await httpsGetJson(url);
  if (data.code !== 'Ok' || !data.routes?.[0]) {
    const err = new Error(data.message || 'Could not find a driving route between these locations');
    err.statusCode = 404;
    throw err;
  }

  const meters = data.routes[0].distance;
  const durationSec = data.routes[0].duration;
  const oneWayKm = parseFloat((meters / 1000).toFixed(1));
  const roundTrip = options.roundTrip === true;
  const distanceKm = roundTrip ? parseFloat((oneWayKm * 2).toFixed(1)) : oneWayKm;

  return {
    origin: {
      place_id: origin.place_id,
      label: origin.label,
      lat: origin.lat,
      lon: origin.lon
    },
    destination: {
      place_id: destination.place_id,
      label: destination.label,
      lat: destination.lat,
      lon: destination.lon
    },
    driving_distance_km: oneWayKm,
    duration_minutes: Math.round(durationSec / 60),
    round_trip: roundTrip,
    distance_km: distanceKm,
    method: 'osrm_driving'
  };
}

function organisationAddressQuery(organisation) {
  return [organisation.address, organisation.location, organisation.registered_address, organisation.name]
    .filter(Boolean)
    .join(', ');
}

/**
 * Geocode organisation address without using saved config (for save flow).
 */
async function geocodeOrganisationAddress(organisation) {
  if (!organisation) return null;

  const query = organisationAddressQuery(organisation);
  if (!query.trim()) return null;

  const results = await searchPlaces(query, 1);
  if (!results.length) return null;

  return {
    ...results[0],
    label: `${organisation.display_name || organisation.name} (factory)`,
    name: organisation.display_name || organisation.name,
    address: query,
    is_factory: true,
    source: 'geocoded_from_organisation_address'
  };
}

function siteCoordinatesPayload(site) {
  return {
    place_id: site.place_id || null,
    label: site.label || site.name || 'Factory site',
    address: site.address || '',
    lat: site.lat,
    lon: site.lon,
    updated_at: new Date().toISOString()
  };
}

/**
 * Persist factory coordinates on organisation.config.site_coordinates
 */
async function saveOrganisationSiteCoordinates(organisationId, site) {
  const Organisation = require('../models/Organisation');
  const payload = siteCoordinatesPayload(site);

  await Organisation.findByIdAndUpdate(organisationId, {
    $set: { 'config.site_coordinates': payload }
  });

  const cachePrefix = `factory:${organisationId}:`;
  for (const key of geocodeCache.keys()) {
    if (key.startsWith(cachePrefix)) geocodeCache.delete(key);
  }

  return payload;
}

async function clearOrganisationSiteCoordinates(organisationId) {
  const Organisation = require('../models/Organisation');
  await Organisation.findByIdAndUpdate(organisationId, {
    $unset: { 'config.site_coordinates': '' }
  });

  const cachePrefix = `factory:${organisationId}:`;
  for (const key of geocodeCache.keys()) {
    if (key.startsWith(cachePrefix)) geocodeCache.delete(key);
  }
}

/**
 * Resolve factory / site coordinates from organisation profile.
 */
async function resolveFactorySite(organisation) {
  if (!organisation) return null;

  const configSite = organisation.config?.site_coordinates;
  if (
    configSite?.lat != null &&
    configSite?.lon != null &&
    Number.isFinite(configSite.lat) &&
    Number.isFinite(configSite.lon)
  ) {
    return {
      place_id: configSite.place_id || 'factory-config',
      label: configSite.label || organisation.display_name || organisation.name,
      name: organisation.display_name || organisation.name,
      address:
        configSite.address ||
        organisation.address ||
        organisation.location ||
        '',
      lat: configSite.lat,
      lon: configSite.lon,
      is_factory: true,
      source: 'organisation_config'
    };
  }

  const query = organisationAddressQuery(organisation);
  if (!query.trim()) {
    return null;
  }

  const cacheKey = `factory:${organisation.id || organisation._id}:${query}`;
  const cached = geocodeCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return cached.data;
  }

  const results = await searchPlaces(query, 1);
  if (!results.length) return null;

  const site = {
    ...results[0],
    label: `${organisation.display_name || organisation.name} (factory)`,
    name: organisation.display_name || organisation.name,
    address: query,
    is_factory: true,
    source: 'geocoded_from_organisation_address'
  };

  geocodeCache.set(cacheKey, { ts: Date.now(), data: site });
  return site;
}

module.exports = {
  searchPlaces,
  getPlaceById,
  calculateDrivingDistance,
  organisationAddressQuery,
  geocodeOrganisationAddress,
  saveOrganisationSiteCoordinates,
  clearOrganisationSiteCoordinates,
  resolveFactorySite
};
