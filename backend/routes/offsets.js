const express = require('express');
const router = express.Router();
const { authorizeRoles } = require('../middleware/auth');
const { uploadOffsetDocuments } = require('../middleware/offsetUpload');
const {
  listOffsets,
  getOffsetSummary,
  getNetEmissions,
  getOffsetById,
  createOffset,
  updateOffset,
  deleteOffset,
  uploadDocuments,
  downloadDocument,
  deleteDocument,
  applyUtilization,
  listUtilizations
} = require('../controllers/offsetController');

const readRoles = ['admin', 'analyst', 'contributor', 'viewer'];
const writeRoles = ['admin', 'analyst'];
const utilizeRoles = ['admin', 'analyst', 'contributor'];

router.get('/summary', authorizeRoles(...readRoles), getOffsetSummary);
router.get('/net-emissions', authorizeRoles(...readRoles), getNetEmissions);
router.get('/utilizations', authorizeRoles(...readRoles), listUtilizations);
router.post('/utilize', authorizeRoles(...utilizeRoles), applyUtilization);

router.get('/', authorizeRoles(...readRoles), listOffsets);
router.post('/', authorizeRoles(...writeRoles), createOffset);
router.get('/:id', authorizeRoles(...readRoles), getOffsetById);
router.put('/:id', authorizeRoles(...writeRoles), updateOffset);
router.delete('/:id', authorizeRoles(...writeRoles), deleteOffset);

router.post(
  '/:id/documents',
  authorizeRoles(...writeRoles),
  (req, res, next) => {
    uploadOffsetDocuments(req, res, (err) => {
      if (err) {
        return res.status(400).json({ success: false, message: err.message || 'Upload failed' });
      }
      next();
    });
  },
  uploadDocuments
);
router.get('/:id/documents/:docId/download', authorizeRoles(...readRoles), downloadDocument);
router.delete('/:id/documents/:docId', authorizeRoles(...writeRoles), deleteDocument);

module.exports = router;
