const mongoose = require('mongoose');
const crypto = require('crypto');

const offsetDocumentSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      default: () => crypto.randomUUID(),
      unique: true,
      index: true
    },
    organisation_id: { type: String, required: true, index: true },
    offset_id: { type: String, required: true, index: true },
    original_name: { type: String, required: true },
    stored_name: { type: String, required: true },
    mime_type: { type: String, default: 'application/octet-stream' },
    size_bytes: { type: Number, default: 0 },
    storage_path: { type: String, required: true },
    document_type: {
      type: String,
      enum: ['certificate', 'verification', 'supporting', 'other'],
      default: 'other'
    },
    uploaded_by: { type: String, default: '' },
    deleted_at: { type: Date, default: null }
  },
  { timestamps: true }
);

offsetDocumentSchema.index({ offset_id: 1, deleted_at: 1 });

module.exports = mongoose.model('OffsetDocument', offsetDocumentSchema);
