const mongoose = require("mongoose");

const reviewSchema = new mongoose.Schema({
    bookingId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "Booking", 
        required: true 
    },
    studentId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "User", 
        required: true 
    },

    tutorId: { type: mongoose.Schema.Types.ObjectId, ref: "Tutor", required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, default: "", trim: true },
}, { timestamps: { createdAt: true, updatedAt: false } });

module.exports = mongoose.model("Review", reviewSchema);