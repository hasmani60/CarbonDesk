const Organisation = require('../models/Organisation');
const {
  searchPlaces,
  getPlaceById,
  calculateDrivingDistance,
  geocodeOrganisationAddress,
  organisationAddressQuery,
  saveOrganisationSiteCoordinates,
  clearOrganisationSiteCoordinates,
  resolveFactorySite
} = require('../services/roadDistanceService');

function placeFromParams(params) {
  const lat = parseFloat(params.lat);
  const lon = parseFloat(params.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return {
    place_id: params.place_id || params.placeId || null,
    label: params.label || `${lat}, ${lon}`,
    lat,
    lon
  };
}

const searchPlacesHandler = async (req, res) => {
  try {
    const q = req.query.q || req.query.search || '';
    const limit = Math.min(parseInt(req.query.limit, 10) || 10, 15);

    if (String(q).trim().length < 2) {
      return res.json({ success: true, data: [] });
    }

    const places = await searchPlaces(q, limit);
    res.json({ success: true, data: places });
  } catch (error) {
    console.error('searchPlaces error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to search locations'
    });
  }
};

const getPlaceHandler = async (req, res) => {
  try {
    const place = await getPlaceById(req.params.placeId);
    if (!place) {
      return res.status(404).json({
        success: false,
        message: 'Location not found'
      });
    }
    res.json({ success: true, data: place });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch location'
    });
  }
};

const getFactorySiteHandler = async (req, res) => {
  try {
    const organisationId = req.organisationId;
    const organisation = await Organisation.findById(organisationId).lean();

    if (!organisation) {
      return res.status(404).json({
        success: false,
        message: 'Organisation not found'
      });
    }

    const site = await resolveFactorySite(organisation);

    if (!site) {
      return res.json({
        success: true,
        data: null,
        message:
          'Factory location could not be resolved. Add an address under Organisation settings.'
      });
    }

    const saved = organisation.config?.site_coordinates;

    res.json({
      success: true,
      data: {
        ...site,
        organisation_id: organisationId,
        organisation_name: organisation.display_name || organisation.name,
        is_saved: site.source === 'organisation_config',
        saved_at: saved?.updated_at || null
      }
    });
  } catch (error) {
    console.error('getFactorySite error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to resolve factory location'
    });
  }
};

const calculateDistanceHandler = async (req, res) => {
  try {
    let origin = placeFromParams({
      lat: req.query.originLat,
      lon: req.query.originLon,
      place_id: req.query.originPlaceId,
      label: req.query.originLabel
    });

    let destination = placeFromParams({
      lat: req.query.destLat ?? req.query.destinationLat,
      lon: req.query.destLon ?? req.query.destinationLon,
      place_id: req.query.destPlaceId ?? req.query.destinationPlaceId,
      label: req.query.destLabel ?? req.query.destinationLabel
    });

    if (req.query.originPlaceId && !origin) {
      origin = await getPlaceById(req.query.originPlaceId);
    }
    if ((req.query.destPlaceId || req.query.destinationPlaceId) && !destination) {
      destination = await getPlaceById(
        req.query.destPlaceId || req.query.destinationPlaceId
      );
    }

    if (!origin || !destination) {
      return res.status(400).json({
        success: false,
        message:
          'Origin and destination are required (lat/lon or place_id for each)'
      });
    }

    const roundTrip =
      req.query.roundTrip === 'true' || req.query.round_trip === 'true';

    const result = await calculateDrivingDistance(origin, destination, {
      roundTrip
    });

    res.json({ success: true, data: result });
  } catch (error) {
    const status = error.statusCode || 500;
    res.status(status).json({
      success: false,
      message: error.message || 'Failed to calculate road distance'
    });
  }
};

const saveFactorySiteHandler = async (req, res) => {
  try {
    const organisationId = req.organisationId;
    const organisation = await Organisation.findById(organisationId).lean();

    if (!organisation) {
      return res.status(404).json({ success: false, message: 'Organisation not found' });
    }

    let site = null;
    const body = req.body || {};

    if (body.geocodeFromAddress === true) {
      site = await geocodeOrganisationAddress(organisation);
      if (!site) {
        return res.status(404).json({
          success: false,
          message:
            'Could not geocode organisation address. Add address, location, or registered address first.'
        });
      }
    } else if (body.place_id) {
      site = await getPlaceById(body.place_id);
      if (!site) {
        return res.status(404).json({ success: false, message: 'Location not found' });
      }
      site = {
        ...site,
        label: body.label || `${organisation.display_name || organisation.name} (factory)`,
        name: organisation.display_name || organisation.name,
        address: body.address || site.label,
        is_factory: true,
        source: 'organisation_config'
      };
    } else if (
      body.lat != null &&
      body.lon != null &&
      Number.isFinite(parseFloat(body.lat)) &&
      Number.isFinite(parseFloat(body.lon))
    ) {
      site = {
        place_id: body.place_id || 'manual',
        label: body.label || `${organisation.display_name || organisation.name} (factory)`,
        name: organisation.display_name || organisation.name,
        address: body.address || organisationAddressQuery(organisation),
        lat: parseFloat(body.lat),
        lon: parseFloat(body.lon),
        is_factory: true,
        source: 'organisation_config'
      };
    } else {
      return res.status(400).json({
        success: false,
        message:
          'Provide geocodeFromAddress: true, place_id, or lat/lon to save factory coordinates'
      });
    }

    const saved = await saveOrganisationSiteCoordinates(organisationId, site);

    res.json({
      success: true,
      message: 'Factory site coordinates saved',
      data: {
        ...site,
        ...saved,
        organisation_id: organisationId,
        is_saved: true,
        saved_at: saved.updated_at
      }
    });
  } catch (error) {
    console.error('saveFactorySite error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to save factory site'
    });
  }
};

const clearFactorySiteHandler = async (req, res) => {
  try {
    const organisationId = req.organisationId;
    await clearOrganisationSiteCoordinates(organisationId);

    res.json({
      success: true,
      message: 'Saved factory coordinates cleared. Road routes will geocode from address again.'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to clear factory site'
    });
  }
};

module.exports = {
  searchPlacesHandler,
  getPlaceHandler,
  getFactorySiteHandler,
  saveFactorySiteHandler,
  clearFactorySiteHandler,
  calculateDistanceHandler
};
