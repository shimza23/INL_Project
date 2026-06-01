const express = require('express');
const router = express.Router();

// Simple dashboard routes for testing
router.get('/student-dashboard', (req, res) => {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  res.render('student-dashboard', { 
    user: req.session.user,
    bookings: [],
    stats: { totalSessions: 0, upcomingSessions: 0, completedSessions: 0 }
  });
});

router.get('/tutor-dashboard', (req, res) => {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  res.render('tutor-dashboard', { 
    user: req.session.user,
    bookings: [],
    stats: { pendingRequests: 0, totalSessions: 0, rating: 0 }
  });
});

router.get('/admin-analytics', (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') {
    return res.redirect('/login');
  }
  res.render('admin-analytics', { 
    user: req.session.user,
    stats: { totalBookings: 0, activeTutors: 0, totalStudents: 0, avgRating: 0 },
    recentBookings: []
  });
});

router.get('/my-bookings', (req, res) => {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  res.render('my-bookings', { user: req.session.user, bookings: [] });
});

router.get('/book-session', (req, res) => {
  if (!req.session.user || req.session.user.role !== 'student') {
    return res.redirect('/login');
  }
  res.render('book-session', { user: req.session.user, subjects: [], tutors: [] });
});

router.get('/notifications', (req, res) => {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  res.render('notifications', { user: req.session.user, notifications: [], unreadCount: 0 });
});

router.get('/profile-settings', (req, res) => {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  res.render('profile-settings', { user: req.session.user, subjects: [] });
});

router.get('/student-requests', (req, res) => {
  if (!req.session.user || req.session.user.role !== 'tutor') {
    return res.redirect('/login');
  }
  res.render('student-requests', { user: req.session.user, requests: [] });
});

module.exports = router;