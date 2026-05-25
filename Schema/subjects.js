const mongoose = require("mongoose");

const subjectSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  code: { type: String, required: true, unique: true, uppercase: true, trim: true },
  description: { type: String, default: "" },
  level: { type: String, enum: ["High School", "Undergraduate", "Postgraduate"], required: true },
  isActive: { type: Boolean, default: true },
}, { timestamps: { createdAt: true, updatedAt: false } });

module.exports = mongoose.model("Subject", subjectSchema);