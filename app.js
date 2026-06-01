require('dotenv').config();

const express = require('express');
const path = require('path');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const methodOverride = require('method-override'); // ADD THIS LINE
const connectDB = require('./connection');

const app = express();
const port = process.env.PORT || 3000;

// Connect to MongoDB
connectDB();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(methodOverride('_method')); // ADD THIS LINE - enables PUT/DELETE from forms
app.use(cookieParser());
app.use(express.static('public'));

// Session middleware
app.use(session({
  secret: process.env.SESSION_SECRET || 'smarttutor-secret',
  resave: false,
  saveUninitialized: true,
  cookie: { 
    secure: false,
    maxAge: 24 * 60 * 60 * 1000
  }
}));

// Make user available to all templates
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  next();
});

// Set EJS as view engine
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// ============ IMPORT MODELS ============
const User = require('./Models/User');
const Subject = require('./Models/Subject');
const Booking = require('./Models/Booking');
const Notification = require('./Models/Notification');
const bcrypt = require('bcryptjs');

// ============ INITIALIZE DATA ============
async function initializeSubjects() {
  const count = await Subject.countDocuments();
  if (count === 0) {
    const subjects = [
      { code: 'WPR37(8)1', name: 'Web Programming', icon: '🌐', description: 'JavaScript, Node.js, EJS', yearLevel: 3 },
      { code: 'DBD37(8)1', name: 'Database Design', icon: '🗄️', description: 'MongoDB, Data Modelling', yearLevel: 3 },
      { code: 'MLG37(8)1', name: 'Machine Learning', icon: '🤖', description: 'Prediction, Classification', yearLevel: 3 },
      { code: 'DAL371', name: 'Data Analytics', icon: '📊', description: 'Power BI, Dashboards', yearLevel: 3 },
      { code: 'PRG271', name: 'Programming', icon: '💻', description: 'C#, OOP, Algorithms', yearLevel: 2 },
      { code: 'LPR271', name: 'Linear Programming', icon: '📐', description: 'Optimisation, Simplex', yearLevel: 2 },
      { code: 'UAX37(8)1', name: 'UX Design', icon: '🎨', description: 'Figma, Prototyping', yearLevel: 3 },
      { code: 'CYB371', name: 'Cybersecurity', icon: '🔒', description: 'Auth, Encryption, OWASP', yearLevel: 3 }
    ];
    await Subject.insertMany(subjects);
    console.log('✓ Subjects initialized');
  }
}

// ============ AUTH ROUTES ============

// Login page
app.get('/login', (req, res) => {
  if (req.session.user) {
    return res.redirect(`/${req.session.user.role}-dashboard`);
  }
  res.render('login', { error: null });
});

// Register page
app.get('/register', async (req, res) => {
  if (req.session.user) {
    return res.redirect(`/${req.session.user.role}-dashboard`);
  }
  const subjects = await Subject.find();
  res.render('register', { error: null, subjects });
});

// Process registration
app.post('/register', async (req, res) => {
  try {
    const { name, email, password, confirmPassword, role, studentNumber, tutorModules } = req.body;
    
    if (password !== confirmPassword) {
      const subjects = await Subject.find();
      return res.render('register', { error: 'Passwords do not match', subjects });
    }
    
    if (password.length < 6) {
      const subjects = await Subject.find();
      return res.render('register', { error: 'Password must be at least 6 characters', subjects });
    }
    
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      const subjects = await Subject.find();
      return res.render('register', { error: 'Email already registered', subjects });
    }
    
    if (role === 'student') {
      const existingStudent = await User.findOne({ studentNumber });
      if (existingStudent) {
        const subjects = await Subject.find();
        return res.render('register', { error: 'Student number already registered', subjects });
      }
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const user = new User({
      name,
      email,
      password: hashedPassword,
      role,
      studentNumber: role === 'student' ? studentNumber : undefined,
      modules: role === 'tutor' ? (Array.isArray(tutorModules) ? tutorModules : tutorModules ? [tutorModules] : []) : []
    });
    
    await user.save();
    
    req.session.user = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      studentNumber: user.studentNumber,
      modules: user.modules || []
    };
    
    res.redirect(`/${user.role}-dashboard`);
  } catch (error) {
    console.error(error);
    const subjects = await Subject.find();
    res.render('register', { error: 'Registration failed. Please try again.', subjects });
  }
});

// Process login
app.post('/login', async (req, res) => {
  try {
    const { email, password, role } = req.body;
    
    const user = await User.findOne({ email });
    
    if (!user) {
      return res.render('login', { error: 'Invalid email or password' });
    }
    
    if (user.role !== role) {
      return res.render('login', { error: `No ${role} account found with this email` });
    }
    
    const isValid = await bcrypt.compare(password, user.password);
    
    if (!isValid) {
      return res.render('login', { error: 'Invalid email or password' });
    }
    
    req.session.user = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      studentNumber: user.studentNumber,
      modules: user.modules || []
    };
    
    res.redirect(`/${user.role}-dashboard`);
  } catch (error) {
    console.error(error);
    res.render('login', { error: 'Login failed. Please try again.' });
  }
});

// Logout
app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

// ============ DASHBOARD ROUTES ============

// Student Dashboard
app.get('/student-dashboard', async (req, res) => {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  try {
    const bookings = await Booking.find({ 
      student: req.session.user.id,
      status: { $in: ['confirmed', 'pending'] }
    })
    .populate('tutor', 'name')
    .populate('subject')
    .sort({ date: 1 })
    .limit(4);
    
    const totalSessions = await Booking.countDocuments({ student: req.session.user.id });
    const upcomingSessions = await Booking.countDocuments({ 
      student: req.session.user.id,
      status: 'confirmed',
      date: { $gte: new Date() }
    });
    const completedSessions = await Booking.countDocuments({ 
      student: req.session.user.id,
      status: 'completed'
    });
    
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

// Tutor Dashboard
app.get('/tutor-dashboard', async (req, res) => {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  try {
    const bookings = await Booking.find({ 
      tutor: req.session.user.id,
      status: 'confirmed',
      date: { $gte: new Date() }
    })
    .populate('student', 'name')
    .populate('subject')
    .sort({ date: 1 })
    .limit(5);
    
    const pendingRequests = await Booking.countDocuments({ 
      tutor: req.session.user.id,
      status: 'pending'
    });
    
    const totalSessions = await Booking.countDocuments({ 
      tutor: req.session.user.id,
      status: 'completed'
    });
    
    res.render('tutor-dashboard', {
      user: req.session.user,
      bookings,
      stats: { pendingRequests, totalSessions, rating: req.session.user.rating || 0 }
    });
  } catch (error) {
    console.error(error);
    res.render('tutor-dashboard', { 
      user: req.session.user, 
      bookings: [],
      stats: { pendingRequests: 0, totalSessions: 0, rating: 0 }
    });
  }
});

// Admin Analytics
app.get('/admin-analytics', async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') {
    return res.redirect('/login');
  }
  try {
    const totalBookings = await Booking.countDocuments();
    const activeTutors = await User.countDocuments({ role: 'tutor', totalSessions: { $gt: 0 } });
    const totalStudents = await User.countDocuments({ role: 'student' });
    
    const recentBookings = await Booking.find()
      .populate('student', 'name')
      .populate('tutor', 'name')
      .populate('subject')
      .sort({ createdAt: -1 })
      .limit(10);
    
    res.render('admin-analytics', {
      user: req.session.user,
      stats: { totalBookings, activeTutors, totalStudents, avgRating: 4.7 },
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
app.get('/my-bookings', async (req, res) => {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  try {
    let query = {};
    if (req.session.user.role === 'student') {
      query.student = req.session.user.id;
    } else if (req.session.user.role === 'tutor') {
      query.tutor = req.session.user.id;
    }
    
    const bookings = await Booking.find(query)
      .populate('student', 'name')
      .populate('tutor', 'name')
      .populate('subject')
      .sort({ date: -1 });
    
    res.render('my-bookings', { user: req.session.user, bookings });
  } catch (error) {
    console.error(error);
    res.render('my-bookings', { user: req.session.user, bookings: [] });
  }
});

// Book Session page - FILTER TUTORS BY SELECTED MODULE
app.get('/book-session', async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'student') {
    return res.redirect('/login');
  }
  try {
    await initializeSubjects();
    const subjects = await Subject.find();
    
    const selectedSubjectId = req.query.subjectId || null;
    let tutors = [];
    
    if (selectedSubjectId) {
      const subject = await Subject.findById(selectedSubjectId);
      if (subject) {
        tutors = await User.find({ 
          role: 'tutor', 
          modules: { $in: [subject.code] }
        }).select('name rating modules');
      }
    }
    
    res.render('book-session', { 
      user: req.session.user, 
      subjects, 
      tutors,
      selectedSubjectId 
    });
  } catch (error) {
    console.error(error);
    res.render('book-session', { user: req.session.user, subjects: [], tutors: [], selectedSubjectId: null });
  }
});

// Get tutors for a specific subject (AJAX endpoint)
app.get('/api/tutors/by-subject/:subjectId', async (req, res) => {
  try {
    const subject = await Subject.findById(req.params.subjectId);
    if (!subject) {
      return res.json([]);
    }
    
    const tutors = await User.find({ 
      role: 'tutor', 
      modules: { $in: [subject.code] }
    }).select('name rating modules');
    
    res.json(tutors);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create Booking
app.post('/api/bookings', async (req, res) => {
  try {
    const { subjectId, tutorId, date, startTime, endTime, location, notes } = req.body;
    const studentId = req.session.user.id;
    
    const subject = await Subject.findById(subjectId);
    const tutor = await User.findById(tutorId);
    
    if (!tutor.modules.includes(subject.code)) {
      return res.redirect('/book-session?error=Tutor does not teach this subject');
    }
    
    const booking = new Booking({
      student: studentId,
      tutor: tutorId,
      subject: subjectId,
      date: new Date(date),
      startTime,
      endTime,
      duration: parseInt(endTime.split(':')[0]) - parseInt(startTime.split(':')[0]),
      location,
      notes,
      status: 'pending'
    });
    
    await booking.save();
    
    const notification = new Notification({
      user: tutorId,
      title: 'New Booking Request',
      message: `${req.session.user.name} requested a session for ${subject.name}`,
      type: 'booking',
      relatedBooking: booking._id
    });
    await notification.save();
    
    res.redirect('/my-bookings?success=Booking created');
  } catch (error) {
    console.error(error);
    res.redirect('/book-session?error=Failed to create booking');
  }
});

// Update booking status
app.put('/api/bookings/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const booking = await Booking.findById(req.params.id)
      .populate('student', 'name')
      .populate('subject', 'name');
    
    booking.status = status;
    await booking.save();
    
    const notification = new Notification({
      user: booking.student._id,
      title: `Booking ${status}`,
      message: `Your ${booking.subject.name} session has been ${status}`,
      type: 'booking',
      relatedBooking: booking._id
    });
    await notification.save();
    
    res.redirect('/student-requests');
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: error.message });
  }
});

// Cancel booking
app.delete('/api/bookings/:id', async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    booking.status = 'cancelled';
    await booking.save();
    
    res.redirect('/my-bookings?success=Booking cancelled');
  } catch (error) {
    console.error(error);
    res.redirect('/my-bookings?error=Failed to cancel');
  }
});

// Notifications
app.get('/notifications', async (req, res) => {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  try {
    const notifications = await Notification.find({ user: req.session.user.id })
      .sort({ createdAt: -1 });
    
    const unreadCount = notifications.filter(n => !n.isRead).length;
    
    res.render('notifications', { user: req.session.user, notifications, unreadCount });
  } catch (error) {
    console.error(error);
    res.render('notifications', { user: req.session.user, notifications: [], unreadCount: 0 });
  }
});

// Mark notification as read
app.put('/api/notifications/:id/read', async (req, res) => {
  try {
    await Notification.findByIdAndUpdate(req.params.id, { isRead: true });
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Mark all notifications as read
app.put('/api/notifications/user/read-all', async (req, res) => {
  try {
    await Notification.updateMany(
      { user: req.session.user.id },
      { isRead: true }
    );
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Profile Settings - GET
app.get('/profile-settings', async (req, res) => {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  try {
    const user = await User.findById(req.session.user.id);
    const subjects = await Subject.find();
    
    res.render('profile-settings', { user, subjects });
  } catch (error) {
    console.error(error);
    res.render('profile-settings', { user: req.session.user, subjects: [] });
  }
});

// Profile Settings - UPDATE (using PUT with method-override)
app.put('/profile-settings', async (req, res) => {
  try {
    const { name, phone, bio, modules } = req.body;
    
    const updateData = {
      name,
      phone,
      bio
    };
    
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

// Student Requests (for tutors)
app.get('/student-requests', async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'tutor') {
    return res.redirect('/login');
  }
  try {
    const requests = await Booking.find({ 
      tutor: req.session.user.id,
      status: 'pending'
    })
    .populate('student', 'name studentNumber')
    .populate('subject')
    .sort({ createdAt: -1 });
    
    res.render('student-requests', { user: req.session.user, requests });
  } catch (error) {
    console.error(error);
    res.render('student-requests', { user: req.session.user, requests: [] });
  }
});

// API Routes
app.get('/api/subjects', async (req, res) => {
  try {
    const subjects = await Subject.find();
    res.json(subjects);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Home page
app.get('/', (req, res) => {
  if (req.session.user) {
    return res.redirect(`/${req.session.user.role}-dashboard`);
  }
  res.render('index');
});

// Start server
app.listen(port, async () => {
  await initializeSubjects();
  console.log(`\n🚀 Server running on http://localhost:${port}`);
  console.log(`📚 SmartTutor Platform Ready\n`);
});