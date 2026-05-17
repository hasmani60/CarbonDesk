const path = require('path');
const fs = require('fs');
const multer = require('multer');
const crypto = require('crypto');

const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15 MB
const ALLOWED_MIMES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain'
]);

const storage = multer.diskStorage({
  destination(req, file, cb) {
    const orgId = req.organisationId || 'unknown';
    const offsetId = req.params.id || 'general';
    const dir = path.join(__dirname, '..', 'uploads', 'offsets', orgId, offsetId);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename(req, file, cb) {
    const ext = path.extname(file.originalname).slice(0, 20);
    const safe = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`;
    cb(null, safe);
  }
});

const fileFilter = (req, file, cb) => {
  if (ALLOWED_MIMES.has(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('File type not allowed. Upload PDF, images, Word, Excel, or plain text.'));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE, files: 10 }
});

module.exports = {
  uploadOffsetDocuments: upload.array('files', 10),
  MAX_FILE_SIZE,
  ALLOWED_MIMES
};
