const {
  searchAirports,
  getAirportByIata,
  calculateFlightDistance
} = require('../services/flightDistanceService');

const searchAirportsHandler = async (req, res) => {
  try {
    const q = req.query.q || req.query.search || '';
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 50);

    if (String(q).trim().length < 1) {
      return res.json({ success: true, data: [] });
    }

    const results = searchAirports(q, limit);
    res.json({ success: true, data: results });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to search airports'
    });
  }
};

const getAirportHandler = async (req, res) => {
  try {
    const airport = getAirportByIata(req.params.iata);
    if (!airport) {
      return res.status(404).json({
        success: false,
        message: `Airport not found: ${req.params.iata}`
      });
    }
    res.json({ success: true, data: airport });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch airport'
    });
  }
};

const calculateDistanceHandler = async (req, res) => {
  try {
    const origin = req.query.origin || req.query.from;
    const destination = req.query.destination || req.query.to;
    const roundTrip =
      req.query.roundTrip === 'true' || req.query.round_trip === 'true';

    if (!origin || !destination) {
      return res.status(400).json({
        success: false,
        message: 'origin and destination IATA codes are required'
      });
    }

    const result = calculateFlightDistance(origin, destination, { roundTrip });
    res.json({ success: true, data: result });
  } catch (error) {
    const status = error.statusCode || 500;
    res.status(status).json({
      success: false,
      message: error.message || 'Failed to calculate flight distance'
    });
  }
};

module.exports = {
  searchAirportsHandler,
  getAirportHandler,
  calculateDistanceHandler
};
