const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema({
    userId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "User", 
        required: true 
    },
    
    type: { type: String, required: true, enum: ["booking_confirmed", "booking_cancelled", "booking_reminder", "payment_received", "system"] },
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    relatedBookingId: { type: mongoose.Schema.Types.ObjectId, ref: "Booking" },
    isRead: { type: Boolean, default: false },
}, { timestamps: { createdAt: true, updatedAt: false } });

module.exports = mongoose.model("Notification", notificationSchema);