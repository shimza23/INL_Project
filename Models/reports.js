const mongoose = require("mongoose");

const analyticsSchema = new mongoose.Schema({
    type: { type: String, required: true, enum: ["monthly_summary", "weekly_summary", "daily_summary"] },
    month: { type: String, required: true },
    year: { type: Number, required: true },

    totalBookings: { type: Number, default: 0 },
    completedSessions: { type: Number, default: 0 },
    cancelledSessions: { type: Number, default: 0 },
    noShows: { type: Number, default: 0 },
    pendingSessions: { type: Number, default: 0 },
    approvedUpcoming: { type: Number, default: 0 },
    declinedSessions: { type: Number, default: 0 },

    mostRequestedSubject: { type: String, default: "" },
    peakBookingDay: { type: String, default: "" },
    peakBookingHour: { type: String, default: "" },

    tutorWorkload: {
        type: [Object], // can refine later into sub-schema if needed
        default: [],
    },

    subjectDemand: {
        type: [Object], // can refine into structured subject + count
        default: [],
    },

    noShowRatePercent: { type: Number, default: 0 },
    cancellationRatePercent: { type: Number, default: 0 },

    generatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Analytics", analyticsSchema);