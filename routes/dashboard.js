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
    
    res.render('student-dashboard', { 
      user: req.session.user, 
      bookings, 
      stats: { totalSessions, upcomingSessions, completedSessions } 
    });
  } catch (error) {
    console.error(error);
    res.render('student-dashboard', { 
      user: req.session.user, 
      bookings: [], 
      stats: { totalSessions: 0, upcomingSessions: 0, completedSessions: 0 } 
    });
  }
});

// Tutor Dashboard with Attendance Features and Reviews
router.get('/tutor-dashboard', requireAuth, requireRole(['tutor']), async (req, res) => {
  try {
    // Get upcoming confirmed sessions
    const bookings = await Booking.find({ 
      tutor: req.session.user.id,
      status: 'confirmed',
      date: { $gte: new Date() }
    })
    .populate('student', 'name')
    .populate('subject')
    .sort({ date: 1 })
    .limit(10);
    
    // Get pending requests count
    const pendingRequests = await Booking.countDocuments({ 
      tutor: req.session.user.id,
      status: 'pending'
    });
    
    // Get completed sessions for attendance stats
    const completedBookings = await Booking.find({
      tutor: req.session.user.id,
      status: 'completed'
    });
    
    // Calculate attendance statistics
    const totalSessions = completedBookings.length;
    const attendedCount = completedBookings.filter(b => b.attendance === 'attended').length;
    const missedCount = completedBookings.filter(b => b.attendance === 'missed').length;
    const attendanceRate = totalSessions > 0 ? Math.round((attendedCount / totalSessions) * 100) : 0;
    
    // Get pending attendance (past sessions not marked)
    const pendingAttendance = await Booking.find({
      tutor: req.session.user.id,
      attendance: 'pending',
      status: 'confirmed',
      date: { $lt: new Date() }
    }).populate('student', 'name').populate('subject');
    
    // Get all reviews for this tutor
    const reviews = await Review.find({ tutor: req.session.user.id })
      .populate('student', 'name')
      .populate('booking')
      .sort({ createdAt: -1 });
    
    // Calculate average rating
    const totalRating = reviews.reduce((sum, r) => sum + r.rating, 0);
    const avgRating = reviews.length > 0 ? (totalRating / reviews.length).toFixed(1) : req.session.user.rating || 0;
    
    // Get rating distribution
    const ratingDistribution = {
      5: reviews.filter(r => r.rating === 5).length,
      4: reviews.filter(r => r.rating === 4).length,
      3: reviews.filter(r => r.rating === 3).length,
      2: reviews.filter(r => r.rating === 2).length,
      1: reviews.filter(r => r.rating === 1).length
    };
    
    // Get success/error messages from query parameters
    const success = req.query.success || null;
    const error = req.query.error || null;
    
    res.render('tutor-dashboard', {
      user: req.session.user,
      bookings,
      pendingAttendance,
      reviews,
      ratingDistribution,
      stats: { 
        pendingRequests, 
        totalSessions,
        attendedCount,
        missedCount,
        attendanceRate,
        rating: avgRating,
        totalReviews: reviews.length
      },
      success: success,
      error: error
    });
  } catch (error) {
    console.error(error);
    res.render('tutor-dashboard', { 
      user: req.session.user, 
      bookings: [],
      pendingAttendance: [],
      reviews: [],
      ratingDistribution: {5:0,4:0,3:0,2:0,1:0},
      stats: { 
        pendingRequests: 0, 
        totalSessions: 0,
        attendedCount: 0,
        missedCount: 0,
        attendanceRate: 0,
        rating: 0,
        totalReviews: 0
      },
      success: null,
      error: null
    });
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
    const recentBookings = await Booking.find()
      .populate('student', 'name')
      .populate('tutor', 'name')
      .populate('subject')
      .sort({ createdAt: -1 })
      .limit(10);
    
    res.render('admin-analytics', { 
      user: req.session.user, 
      stats: { totalBookings, activeTutors, totalStudents, avgRating }, 
      recentBookings 
    });
  } catch (error) {
    console.error(error);
    res.render('admin-analytics', { 
      user: req.session.user, 
      stats: { totalBookings: 0, activeTutors: 0, totalStudents: 0, avgRating: 0 }, 
      recentBookings: [] 
    });
  }
});

// My Bookings
router.get('/my-bookings', requireAuth, async (req, res) => {
  try {
    const query = req.session.user.role === 'student' 
      ? { student: req.session.user.id } 
      : { tutor: req.session.user.id };
    
    const bookings = await Booking.find(query)
      .populate('student', 'name')
      .populate('tutor', 'name')
      .populate('subject')
      .sort({ date: -1 });
    
    const now = new Date();
    for (const booking of bookings) {
      const sessionEnd = new Date(booking.date);
      const [hours, minutes] = booking.endTime.split(':');
      sessionEnd.setHours(parseInt(hours), parseInt(minutes));
      
      if (booking.status === 'confirmed' && sessionEnd < now && booking.attendance === 'attended') {
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
    
    res.render('my-bookings', { 
      user: req.session.user, 
      bookings, 
      reviewedBookingIds 
    });
  } catch (error) {
    console.error(error);
    res.render('my-bookings', { 
      user: req.session.user, 
      bookings: [], 
      reviewedBookingIds: new Set() 
    });
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
        tutors = await User.find({ 
          role: 'tutor', 
          modules: { $in: [subject.code] } 
        }).select('name rating modules totalSessions');
      }
    }
    
    res.render('book-session', { 
      user: req.session.user, 
      subjects, 
      tutors, 
      durations, 
      selectedSubjectId,
      error: req.query.error || null, 
      success: req.query.success || null
    });
  } catch (error) {
    console.error(error);
    res.render('book-session', { 
      user: req.session.user, 
      subjects: [], 
      tutors: [], 
      durations: [], 
      selectedSubjectId: null, 
      error: 'Failed to load page', 
      success: null 
    });
  }
});

// Notifications
router.get('/notifications', requireAuth, async (req, res) => {
  try {
    const notifications = await Notification.find({ user: req.session.user.id })
      .sort({ createdAt: -1 });
    const unreadCount = notifications.filter(n => !n.isRead).length;
    res.render('notifications', { 
      user: req.session.user, 
      notifications, 
      unreadCount 
    });
  } catch (error) {
    console.error(error);
    res.render('notifications', { 
      user: req.session.user, 
      notifications: [], 
      unreadCount: 0 
    });
  }
});

// Student Requests (for tutors)
router.get('/student-requests', requireAuth, requireRole(['tutor']), async (req, res) => {
  try {
    const requests = await Booking.find({ 
      tutor: req.session.user.id, 
      status: 'pending' 
    })
    .populate('student', 'name studentNumber')
    .populate('subject')
    .sort({ createdAt: -1 });
    
    res.render('student-requests', { 
      user: req.session.user, 
      requests 
    });
  } catch (error) {
    console.error(error);
    res.render('student-requests', { 
      user: req.session.user, 
      requests: [] 
    });
  }
});

// Profile Settings
router.get('/profile-settings', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.session.user.id);
    const subjects = await Subject.find();
    res.render('profile-settings', { user, subjects });
  } catch (error) {
    console.error(error);
    res.render('profile-settings', { user: req.session.user, subjects: [] });
  }
});

// Update Profile
router.put('/profile-settings', requireAuth, async (req, res) => {
  try {
    const { name, phone, bio, modules } = req.body;
    const updateData = { name, phone, bio };
    
    if (req.session.user.role === 'tutor') {
      updateData.modules = Array.isArray(modules) ? modules : (modules ? [modules] : []);
    }
    
    await User.findByIdAndUpdate(req.session.user.id, updateData);
    req.session.user.name = name;
    if (req.session.user.role === 'tutor') {
      req.session.user.modules = updateData.modules;
    }
    
    res.redirect('/profile-settings?success=Profile updated');
  } catch (error) {
    console.error(error);
    res.redirect('/profile-settings?error=Update failed');
  }
});

module.exports = router;