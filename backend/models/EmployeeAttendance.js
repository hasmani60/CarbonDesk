const mongoose = require('mongoose');

const employeeAttendanceSchema = new mongoose.Schema({
  organisation_id: {
    type: String,
    required: true,
    index: true
  },
  employee_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true,
    index: true
  },
  date: {
    type: Date,
    required: true,
    index: true
  },
  is_present: {
    type: Boolean,
    required: true
  },
  marked_by: {
    type: String,
    ref: 'User'
  },
  created_at: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: false
});

employeeAttendanceSchema.index(
  { organisation_id: 1, employee_id: 1, date: 1 },
  { unique: true }
);

employeeAttendanceSchema.set('toJSON', {
  virtuals: true,
  transform(doc, ret) {
    ret.id = ret._id.toString();
    if (ret.employee_id && ret.employee_id._id) {
      ret.employee_id = ret.employee_id._id.toString();
    }
    return ret;
  }
});

module.exports = mongoose.model('EmployeeAttendance', employeeAttendanceSchema);
