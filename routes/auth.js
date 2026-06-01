const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Subject = require('../models/Subject');
const bcrypt = require('bcryptjs');

// Login page
router.get('/login', (req, res) => {
  if (req.session.user) {
    return res.redirect(`/${req.session.user.role}-dashboard`);
  }
  res.render('login', { error: null });
});

// Register page
router.get('/register', async (req, res) => {
  if (req.session.user) {
    return res.redirect(`/${req.session.user.role}-dashboard`);
  }
  const subjects = await Subject.find();
  res.render('register', { error: null, subjects });
});

// Process registration
router.post('/register', async (req, res) => {
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
      name, email, password: hashedPassword, role,
      studentNumber: role === 'student' ? studentNumber : undefined,
      modules: role === 'tutor' ? (Array.isArray(tutorModules) ? tutorModules : tutorModules ? [tutorModules] : []) : []
    });
    
    await user.save();
    
    req.session.user = {
      id: user._id, name: user.name, email: user.email, role: user.role,
      studentNumber: user.studentNumber, modules: user.modules || []
    };
    
    res.redirect(`/${user.role}-dashboard`);
  } catch (error) {
    console.error(error);
    const subjects = await Subject.find();
    res.render('register', { error: 'Registration failed. Please try again.', subjects });
  }
});

// Process login
router.post('/login', async (req, res) => {
  try {
    const { email, password, role } = req.body;
    const user = await User.findOne({ email });
    
    if (!user || user.role !== role) {
      return res.render('login', { error: 'Invalid email or password' });
    }
    
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.render('login', { error: 'Invalid email or password' });
    }
    
    req.session.user = {
      id: user._id, name: user.name, email: user.email, role: user.role,
      studentNumber: user.studentNumber, modules: user.modules || []
    };
    
    res.redirect(`/${user.role}-dashboard`);
  } catch (error) {
    console.error(error);
    res.render('login', { error: 'Login failed. Please try again.' });
  }
});

// Logout
router.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

module.exports = router;