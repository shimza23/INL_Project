const express = require('express');
const router = express.Router();
const Booking = require('../models/Booking');
const User = require('../models/User');
const Subject = require('../models/Subject');
const Notification = require('../models/Notification');
const Review = require('../models/Review');
const { generateTimeSlots, timeToMinutes, checkDoubleBooking, calculateEndTime } = require('../utils/helpers');
const { requireAuth } = require('../middleware/auth');

// Get available time slots for a tutor on a specific date
router.get('/available-slots/:tutorId/:date', async (req, res) => {
  try {
    const { tutorId, date } = req.params;
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);
    const nextDay = new Date(targetDate);
    nextDay.setDate(nextDay.getDate() + 1);
    
    const bookings = await Booking.find({
      tutor: tutorId,
      date: { $gte: targetDate, $lt: nextDay },
      status: { $in: ['confirmed', 'pending'] }
    });
    
    const bookedSlots = new Set();
    for (const booking of bookings) {
      const startMinutes = timeToMinutes(booking.startTime);
      const endMinutes = timeToMinutes(booking.endTime);
      for (let minutes = startMinutes; minutes < endMinutes; minutes += 30) {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        bookedSlots.add(`${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`);
      }
    }
    
    const allSlots = generateTimeSlots();
    const availableSlots = allSlots.filter(slot => !bookedSlots.has(slot));
    
    // Filter out past time slots for today's date
    const today = new Date().toISOString().split('T')[0];
    if (date === today) {
      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      return res.json(availableSlots.filter(slot => timeToMinutes(slot) > currentMinutes));
    }
    
    res.json(availableSlots);
  } catch (error) {
    console.error('Error fetching available slots:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get tutors for a specific subject
router.get('/tutors/by-subject/:subjectId', async (req, res) => {
  try {
    const subject = await Subject.findById(req.params.subjectId);
    if (!subject) return res.json([]);
    const tutors = await User.find({ role: 'tutor', modules: { $in: [subject.code] } }).select('name rating modules');
    res.json(tutors);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create booking
router.post('/bookings', requireAuth, async (req, res) => {
  try {
    const { subjectId, tutorId, date, startTime, duration, location, notes } = req.body;
    const studentId = req.session.user.id;
    const durationNum = parseFloat(duration);
    const endTime = calculateEndTime(startTime, durationNum);
    
    const subject = await Subject.findById(subjectId);
    const tutor = await User.findById(tutorId);
    
    if (!tutor.modules.includes(subject.code)) {
      return res.redirect('/book-session?error=Tutor does not teach this subject');
    }
    
    // Check for double bookings
    const studentDouble = await checkDoubleBooking(Booking, studentId, date, startTime, endTime, 'student');
    if (studentDouble) return res.redirect('/book-session?error=You already have a session at this time');
    
    const tutorDouble = await checkDoubleBooking(Booking, tutorId, date, startTime, endTime, 'tutor');
    if (tutorDouble) return res.redirect('/book-session?error=Tutor is already booked at this time');
    
    const booking = new Booking({
      student: studentId, tutor: tutorId, subject: subjectId,
      date: new Date(date), startTime, endTime, duration: durationNum,
      location, notes, status: 'pending'
    });
    await booking.save();
    
    // Notify tutor
    await new Notification({
      user: tutorId,
      title: 'New Booking Request',
      message: `${req.session.user.name} requested a ${durationNum} hour session for ${subject.name} at ${startTime}`,
      type: 'booking',
      relatedBooking: booking._id
    }).save();
    
    res.redirect('/my-bookings?success=Booking created successfully');
  } catch (error) {
    console.error(error);
    res.redirect('/book-session?error=Failed to create booking');
  }
});

// Update booking status (approve/decline)
router.put('/bookings/:id/status', requireAuth, async (req, res) => {
  try {
    const { status } = req.body;
    const booking = await Booking.findById(req.params.id).populate('student', 'name').populate('subject', 'name');
    booking.status = status;
    await booking.save();
    
    await new Notification({
      user: booking.student._id,
      title: `Booking ${status}`,
      message: `Your ${booking.subject.name} session has been ${status}`,
      type: 'booking',
      relatedBooking: booking._id
    }).save();
    
    res.redirect('/student-requests');
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: error.message });
  }
});

// Submit review
router.post('/reviews', requireAuth, async (req, res) => {
  try {
    const { tutorId, bookingId, rating, comment } = req.body;
    
    const existingReview = await Review.findOne({ booking: bookingId });
    if (existingReview) return res.redirect('/my-bookings?error=You already reviewed this session');
    
    const review = new Review({
      student: req.session.user.id,
      tutor: tutorId,
      booking: bookingId,
      rating: parseInt(rating),
      comment
    });
    await review.save();
    
    // Update tutor's average rating
    const reviews = await Review.aggregate([
      { $match: { tutor: tutorId } },
      { $group: { _id: null, avg: { $avg: '$rating' } } }
    ]);
    await User.findByIdAndUpdate(tutorId, { rating: Math.round(reviews[0]?.avg || 0) });
    
    // Notify tutor
    await new Notification({
      user: tutorId,
      title: 'New Review Received!',
      message: `${req.session.user.name} rated you ${rating}/5 stars`,
      type: 'review',
      relatedBooking: bookingId
    }).save();
    
    res.redirect('/my-bookings?success=Thank you for your review!');
  } catch (error) {
    console.error(error);
    res.redirect('/my-bookings?error=Failed to submit review');
  }
});

// Cancel booking
router.delete('/bookings/:id', requireAuth, async (req, res) => {
  try {
    await Booking.findByIdAndUpdate(req.params.id, { status: 'cancelled' });
    res.redirect('/my-bookings?success=Booking cancelled');
  } catch (error) {
    console.error(error);
    res.redirect('/my-bookings?error=Failed to cancel');
  }
});

// Mark notification as read
router.put('/notifications/:id/read', requireAuth, async (req, res) => {
  try {
    await Notification.findByIdAndUpdate(req.params.id, { isRead: true });
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Mark all notifications as read
router.put('/notifications/user/read-all', requireAuth, async (req, res) => {
  try {
    await Notification.updateMany({ user: req.session.user.id }, { isRead: true });
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get all subjects (API)
router.get('/subjects', async (req, res) => {
  try {
    const subjects = await Subject.find();
    res.json(subjects);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;