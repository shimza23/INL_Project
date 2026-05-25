const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['student', 'tutor', 'admin'], required: true },
  studentNumber: { type: String, unique: true, sparse: true },
  phone: String,
  bio: String,
  modules: [{ type: String }], // modules they tutor (for tutors)
  rating: { type: Number, default: 0 },
  totalSessions: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', userSchema);
