const mongoose = require('mongoose');

const availabilitySchema = new mongoose.Schema({
  tutor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  dayOfWeek: { type: Number, min: 0, max: 6 },
  timeSlot: { type: String, enum: ['morning', 'afternoon', 'evening'] },
  date: Date,
  isAvailable: { type: Boolean, default: true }
});

module.exports = mongoose.model('Availability', availabilitySchema);