const {
  searchPorts,
  getPortByCode,
  calculateSeaDistance
} = require('../services/seaDistanceService');

const searchPortsHandler = async (req, res) => {
  try {
    const q = req.query.q || req.query.search || '';
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 50);

    if (String(q).trim().length < 1) {
      return res.json({ success: true, data: [] });
    }

    res.json({ success: true, data: searchPorts(q, limit) });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to search ports'
    });
  }
};

const getPortHandler = async (req, res) => {
  try {
    const port = getPortByCode(req.params.code);
    if (!port) {
      return res.status(404).json({
        success: false,
        message: `Port not found: ${req.params.code}`
      });
    }
    res.json({ success: true, data: port });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch port'
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
        message: 'origin and destination port codes are required'
      });
    }

    const result = calculateSeaDistance(origin, destination, { roundTrip });
    res.json({ success: true, data: result });
  } catch (error) {
    const status = error.statusCode || 500;
    res.status(status).json({
      success: false,
      message: error.message || 'Failed to calculate sea distance'
    });
  }
};

module.exports = {
  searchPortsHandler,
  getPortHandler,
  calculateDistanceHandler
};
