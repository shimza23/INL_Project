const mongoose = require("mongoose");

const bookingSchema = new mongoose.Schema({
    studentId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "User", 
        required: true 
    },
    tutorId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "Tutor", 
        required: true 
    },
    subjectId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "Subject", 
        required: true 
    },

    date: { type: Date, required: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    durationMinutes: { type: Number, required: true },

    status: { type: String, enum: ["pending", "approved", "declined", "completed", "cancelled", "no_show"], default: "pending" },

    notes: { type: String, default: "", trim: true },
    tutorNotes: { type: String, default: "", trim: true },

    meetingLink: { type: String, default: "" },

    reminderSent: { type: Boolean, default: false },
    noShowPredictionScore: { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model("Booking", bookingSchema);
