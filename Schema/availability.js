const mongoose = require("mongoose");

const availabilitySchema = new mongoose.Schema({
    tutorId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "Tutor", 
        required: true 
    },

    dayOfWeek: { type: String, required: true, enum: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    isRecurring: { type: Boolean, default: true },
    isBooked: { type: Boolean, default: false },
}, { timestamps: { createdAt: true, updatedAt: false } });

module.exports = mongoose.model("Availability", availabilitySchema);