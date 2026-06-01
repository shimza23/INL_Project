const express = require('express');
const router = express.Router();
const Booking = require('../models/Booking');
const User = require('../models/User');
const Subject = require('../models/Subject');
const Review = require('../models/Review');
const Notification = require('../models/Notification');
const { requireAuth, requireRole } = require('../middleware/auth');

// Student Dashboard
router.get('/student-dashboard', requireAuth, requireRole(['student']), async (req, res) => {
  try {
    const bookings = await Booking.find({ student: req.session.user.id, status: { $in: ['confirmed', 'pending'] } })
      .populate('tutor', 'name').populate('subject').sort({ date: 1 }).limit(4);
    
    const totalSessions = await Booking.countDocuments({ student: req.session.user.id });
    const upcomingSessions = await Booking.countDocuments({ student: req.session.user.id, status: 'confirmed', date: { $gte: new Date() } });
    const completedSessions = await Booking.countDocuments({ student: req.session.user.id, status: 'completed' });
    
    res.render('student-dashboard', { user: req.session.user, bookings, stats: { totalSessions, upcomingSessions, completedSessions } });
  } catch (error) {
    console.error(error);
    res.render('student-dashboard', { user: req.session.user, bookings: [], stats: { totalSessions: 0, upcomingSessions: 0, completedSessions: 0 } });
  }
});

// Tutor Dashboard
router.get('/tutor-dashboard', requireAuth, requireRole(['tutor']), async (req, res) => {
  try {
    const bookings = await Booking.find({ tutor: req.session.user.id, status: 'confirmed', date: { $gte: new Date() } })
      .populate('student', 'name').populate('subject').sort({ date: 1 }).limit(5);
    
    const pendingRequests = await Booking.countDocuments({ tutor: req.session.user.id, status: 'pending' });
    const totalSessions = await Booking.countDocuments({ tutor: req.session.user.id, status: 'completed' });
    
    res.render('tutor-dashboard', { user: req.session.user, bookings, stats: { pendingRequests, totalSessions, rating: req.session.user.rating || 0 } });
  } catch (error) {
    console.error(error);
    res.render('tutor-dashboard', { user: req.session.user, bookings: [], stats: { pendingRequests: 0, totalSessions: 0, rating: 0 } });
  }
});

// Admin Analytics
router.get('/admin-analytics', requireAuth, requireRole(['admin']), async (req, res) => {
  try {
    const totalBookings = await Booking.countDocuments();
    const activeTutors = await User.countDocuments({ role: 'tutor', totalSessions: { $gt: 0 } });
    const totalStudents = await User.countDocuments({ role: 'student' });
    const reviews = await Review.aggregate([{ $group: { _id: null, avgRating: { $avg: '$rating' } } }]);
    const avgRating = reviews[0]?.avgRating || 0;
    const recentBookings = await Booking.find().populate('student', 'name').populate('tutor', 'name').populate('subject').sort({ createdAt: -1 }).limit(10);
    
    res.render('admin-analytics', { user: req.session.user, stats: { totalBookings, activeTutors, totalStudents, avgRating }, recentBookings });
  } catch (error) {
    console.error(error);
    res.render('admin-analytics', { user: req.session.user, stats: { totalBookings: 0, activeTutors: 0, totalStudents: 0, avgRating: 0 }, recentBookings: [] });
  }
});

// My Bookings
router.get('/my-bookings', requireAuth, async (req, res) => {
  try {
    const query = req.session.user.role === 'student' ? { student: req.session.user.id } : { tutor: req.session.user.id };
    const bookings = await Booking.find(query).populate('student', 'name').populate('tutor', 'name').populate('subject').sort({ date: -1 });
    
    const now = new Date();
    for (const booking of bookings) {
      const sessionEnd = new Date(booking.date);
      const [hours, minutes] = booking.endTime.split(':');
      sessionEnd.setHours(parseInt(hours), parseInt(minutes));
      if (booking.status === 'confirmed' && sessionEnd < now) {
        booking.status = 'completed';
        await booking.save();
        
        const existingReview = await Review.findOne({ booking: booking._id });
        if (!existingReview) {
          await new Notification({
            user: booking.student._id,
            title: 'Session Completed!',
            message: `Your ${booking.subject.name} session has been completed. Please leave a review.`,
            type: 'review',
            relatedBooking: booking._id
          }).save();
        }
      }
    }
    
    const bookingsWithReviews = await Review.find({ booking: { $in: bookings.map(b => b._id) } });
    const reviewedBookingIds = new Set(bookingsWithReviews.map(r => r.booking.toString()));
    
    res.render('my-bookings', { user: req.session.user, bookings, reviewedBookingIds });
  } catch (error) {
    console.error(error);
    res.render('my-bookings', { user: req.session.user, bookings: [], reviewedBookingIds: new Set() });
  }
});

// Book Session page
router.get('/book-session', requireAuth, requireRole(['student']), async (req, res) => {
  try {
    const subjects = await Subject.find();
    const durations = [
      { value: 0.5, label: '30 minutes' },
      { value: 1, label: '1 hour' },
      { value: 1.5, label: '1.5 hours' },
      { value: 2, label: '2 hours' }
    ];
    const selectedSubjectId = req.query.subjectId || null;
    let tutors = [];
    
    if (selectedSubjectId) {
      const subject = await Subject.findById(selectedSubjectId);
      if (subject) {
        tutors = await User.find({ role: 'tutor', modules: { $in: [subject.code] } }).select('name rating modules');
      }
    }
    
    res.render('book-session', { 
      user: req.session.user, subjects, tutors, durations, selectedSubjectId,
      error: req.query.error || null, success: req.query.success || null
    });
  } catch (error) {
    console.error(error);
    res.render('book-session', { user: req.session.user, subjects: [], tutors: [], durations: [], selectedSubjectId: null, error: 'Failed to load page', success: null });
  }
});

// Notifications
router.get('/notifications', requireAuth, async (req, res) => {
  try {
    const notifications = await Notification.find({ user: req.session.user.id }).sort({ createdAt: -1 });
    const unreadCount = notifications.filter(n => !n.isRead).length;
    res.render('notifications', { user: req.session.user, notifications, unreadCount });
  } catch (error) {
    console.error(error);
    res.render('notifications', { user: req.session.user, notifications: [], unreadCount: 0 });
  }
});

// Student Requests (for tutors)
router.get('/student-requests', requireAuth, requireRole(['tutor']), async (req, res) => {
  try {
    const requests = await Booking.find({ tutor: req.session.user.id, status: 'pending' })
      .populate('student', 'name studentNumber').populate('subject').sort({ createdAt: -1 });
    res.render('student-requests', { user: req.session.user, requests });
  } catch (error) {
    console.error(error);
    res.render('student-requests', { user: req.session.user, requests: [] });
  }
});

module.exports = router;