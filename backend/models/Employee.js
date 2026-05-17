const mongoose = require('mongoose');

const TRANSPORT_MODES = [
  'personal_car_petrol',
  'personal_car_diesel',
  'two_wheeler_petrol',
  'two_wheeler_diesel',
  'cng_vehicle',
  'electric_vehicle',
  'bus',
  'metro',
  'train',
  'cab_shared',
  'cab_solo',
  'bicycle',
  'walking'
];

const FUEL_BASED_MODES = [
  'personal_car_petrol',
  'personal_car_diesel',
  'two_wheeler_petrol',
  'two_wheeler_diesel',
  'cng_vehicle'
];

const employeeSchema = new mongoose.Schema({
  organisation_id: {
    type: String,
    required: true,
    index: true,
    ref: 'Organisation'
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  employee_id: {
    type: String,
    trim: true,
    default: ''
  },
  home_to_office_distance_km: {
    type: Number,
    required: true,
    min: 0
  },
  transport_mode: {
    type: String,
    required: true,
    enum: TRANSPORT_MODES
  },
  vehicle_number: {
    type: String,
    trim: true,
    default: ''
  },
  vehicle_fuel_efficiency_kmpl: {
    type: Number,
    min: 0,
    default: null
  },
  is_active: {
    type: Boolean,
    default: true,
    index: true
  },
  created_by: {
    type: String,
    ref: 'User'
  },
  created_at: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

employeeSchema.index({ organisation_id: 1, is_active: 1 });

employeeSchema.set('toJSON', {
  virtuals: true,
  transform(doc, ret) {
    ret.id = ret._id.toString();
    return ret;
  }
});

module.exports = mongoose.model('Employee', employeeSchema);
module.exports.TRANSPORT_MODES = TRANSPORT_MODES;
module.exports.FUEL_BASED_MODES = FUEL_BASED_MODES;
