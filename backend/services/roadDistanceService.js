const https = require('https');

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';
/** Komoot Photon — better for production (shared IPs); no 1 req/s policy like Nominatim. */
const PHOTON_BASE = 'https://photon.komoot.io';
const OSRM_BASE = 'https://router.project-osrm.org';
/** photon (default) | nominatim | auto (photon then nominatim) */
const GEOCODER_SEARCH = (process.env.GEOCODER_SEARCH || 'photon').toLowerCase();
const USER_AGENT =
  process.env.NOMINATIM_USER_AGENT ||
  'CarbonDesk/1.0 (carbon-accounting; support@carbondesk.local)';

const geocodeCache = new Map();
/** Places from recent search results — avoids flaky Nominatim lookup on save. */
const searchPlaceById = new Map();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h — reduce repeat Nominatim calls
const MIN_SEARCH_LENGTH = 3;

/** Nominatim usage policy: max 1 request per second. */
const NOMINATIM_MIN_INTERVAL_MS = 1100;
let nominatimQueue = Promise.resolve();
let lastNominatimAt = 0;
const inFlightRequests = new Map();

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function httpsGetJson(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'application/json',
          'Accept-Language': 'en',
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

async function httpsGetJsonWithRetry(url, maxRetries = 4) {
  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await httpsGetJson(url);
    } catch (error) {
      lastError = error;
      if (error.statusCode === 429 && attempt < maxRetries) {
        await sleep(3000 * (attempt + 1));
        continue;
      }
      if (error.statusCode === 429) {
        const rateErr = new Error(
          'Location search is temporarily busy. Wait a few seconds and try a more specific address (e.g. city or postcode).'
        );
        rateErr.statusCode = 429;
        throw rateErr;
      }
      throw error;
    }
  }
  throw lastError;
}

function cacheSearchResults(cacheKey, places) {
  geocodeCache.set(cacheKey, { ts: Date.now(), data: places });
  for (const p of places) {
    if (p.place_id) searchPlaceById.set(String(p.place_id), p);
  }
  return places;
}

function normalizePhotonFeature(feature) {
  const props = feature.properties || {};
  const coords = feature.geometry?.coordinates;
  if (!coords || coords.length < 2) return null;

  const lon = parseFloat(coords[0]);
  const lat = parseFloat(coords[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  const line1 =
    props.housenumber && props.street
      ? `${props.housenumber} ${props.street}`
      : props.street || props.name;
  const parts = [
    line1,
    props.name && props.name !== line1 ? props.name : null,
    props.city || props.town || props.village || props.district,
    props.state,
    props.country
  ].filter(Boolean);

  const osmType = props.osm_type || 'N';
  const osmId = props.osm_id;
  const place_id =
    osmId != null
      ? `photon:${osmType}:${osmId}`
      : `photon:${lat.toFixed(5)},${lon.toFixed(5)}`;

  return {
    place_id,
    label: [...new Set(parts)].join(', ') || `${lat}, ${lon}`,
    name: props.name || line1 || '',
    lat,
    lon,
    country: (props.countrycode || props.country || '').toString().toUpperCase().slice(0, 2),
    type: props.type || props.osm_value || 'place'
  };
}

/**
 * Place search via Photon (recommended for Render / multi-tenant production).
 */
async function searchPlacesPhoton(query, limit = 10) {
  const url =
    `${PHOTON_BASE}/api/?q=${encodeURIComponent(query)}&limit=${limit}&lang=en`;
  const data = await httpsGetJson(url);
  const features = Array.isArray(data?.features) ? data.features : [];
  return features.map(normalizePhotonFeature).filter(Boolean);
}

/**
 * Serialize all Nominatim HTTP calls globally (1 req/sec).
 */
function enqueueNominatim(taskKey, fn) {
  if (taskKey && inFlightRequests.has(taskKey)) {
    return inFlightRequests.get(taskKey);
  }

  const run = nominatimQueue.then(async () => {
    const elapsed = Date.now() - lastNominatimAt;
    const wait = Math.max(0, NOMINATIM_MIN_INTERVAL_MS - elapsed);
    if (wait > 0) await sleep(wait);
    lastNominatimAt = Date.now();
    return fn();
  });

  nominatimQueue = run.catch(() => {});

  if (taskKey) {
    inFlightRequests.set(taskKey, run);
    run.finally(() => inFlightRequests.delete(taskKey));
  }

  return run;
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

async function searchPlacesNominatim(query, limit = 10) {
  const cacheKey = `search:nom:${query.toLowerCase()}:${limit}`;

  return enqueueNominatim(cacheKey, async () => {
    const url =
      `${NOMINATIM_BASE}/search?format=json&addressdetails=1&limit=${limit}` +
      `&q=${encodeURIComponent(query)}`;

    const rows = await httpsGetJsonWithRetry(url);
    return (Array.isArray(rows) ? rows : [])
      .filter((r) => r.lat && r.lon)
      .map(normalizePlace);
  });
}

/**
 * Search places — Photon by default (production-safe); Nominatim as fallback.
 */
async function searchPlaces(query, limit = 10) {
  const q = String(query || '').trim();
  if (q.length < MIN_SEARCH_LENGTH) return [];

  const cacheKey = `search:${q.toLowerCase()}:${limit}`;
  const cached = geocodeCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return cached.data;
  }

  const usePhoton = GEOCODER_SEARCH === 'photon' || GEOCODER_SEARCH === 'auto';
  const useNominatim = GEOCODER_SEARCH === 'nominatim' || GEOCODER_SEARCH === 'auto';

  if (usePhoton) {
    try {
      const photonPlaces = await searchPlacesPhoton(q, limit);
      if (photonPlaces.length) {
        return cacheSearchResults(cacheKey, photonPlaces);
      }
      if (GEOCODER_SEARCH === 'photon') {
        return cacheSearchResults(cacheKey, []);
      }
    } catch (photonErr) {
      if (GEOCODER_SEARCH === 'photon') {
        const err = new Error(
          photonErr.message || 'Location search failed. Try again in a moment.'
        );
        err.statusCode = photonErr.statusCode || 503;
        throw err;
      }
    }
  }

  if (useNominatim) {
    try {
      const places = await searchPlacesNominatim(q, limit);
      return cacheSearchResults(cacheKey, places);
    } catch (nomErr) {
      if (nomErr.statusCode === 429) {
        throw nomErr;
      }
      throw nomErr;
    }
  }

  return [];
}

/**
 * Reverse lookup by place_id (Nominatim details).
 */
async function getPlaceById(placeId) {
  const id = String(placeId || '').trim();
  if (!id) return null;

  if (searchPlaceById.has(id)) {
    return searchPlaceById.get(id);
  }

  const cacheKey = `place:${id}`;
  const cached = geocodeCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return cached.data;
  }

  const url = `${NOMINATIM_BASE}/lookup?format=json&addressdetails=1&place_ids=${encodeURIComponent(id)}`;
  const rows = await enqueueNominatim(`lookup:${id}`, () => httpsGetJsonWithRetry(url));
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

function organisationQuery(organisationId) {
  return { $or: [{ _id: organisationId }, { id: organisationId }] };
}

/**
 * Persist factory coordinates on organisation.config.site_coordinates
 */
async function saveOrganisationSiteCoordinates(organisationId, site) {
  const Organisation = require('../models/Organisation');
  const payload = siteCoordinatesPayload(site);

  await Organisation.findOneAndUpdate(organisationQuery(organisationId), {
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
  await Organisation.findOneAndUpdate(organisationQuery(organisationId), {
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
