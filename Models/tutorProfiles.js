const mongoose = require("mongoose");

const tutorSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },

    bio: { type: String, required: true, trim: true },
    qualifications: { type: [String], default: [] },
    subjects: { type: [String], default: [] },
    rating: { type: Number, default: 0, min: 0, max: 5 },
    totalSessions: { type: Number, default: 0, },
    hourlyRate: { type: Number, required: true, min: 0 },
    maxSessionsPerDay: { type: Number, default: 4},
  },{ timestamps: true});

module.exports = mongoose.model("Tutor", tutorSchema);