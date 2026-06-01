const express = require('express');
const router = express.Router();
const User = require('../Models/User');
const bcrypt = require('bcryptjs');

// Login page
router.get('/login', (req, res) => {
  if (req.session.user) {
    return res.redirect(`/${req.session.user.role}-dashboard`);
  }
  res.render('login', { error: null });
});

// Register page
router.get('/register', (req, res) => {
  if (req.session.user) {
    return res.redirect(`/${req.session.user.role}-dashboard`);
  }
  res.render('register', { error: null });
});

// Process registration
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, confirmPassword, role, studentNumber } = req.body;
    
    if (password !== confirmPassword) {
      return res.render('register', { error: 'Passwords do not match' });
    }
    
    if (password.length < 6) {
      return res.render('register', { error: 'Password must be at least 6 characters' });
    }
    
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.render('register', { error: 'Email already registered' });
    }
    
    if (role === 'student') {
      const existingStudent = await User.findOne({ studentNumber });
      if (existingStudent) {
        return res.render('register', { error: 'Student number already registered' });
      }
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const user = new User({
      name,
      email,
      password: hashedPassword,
      role,
      studentNumber: role === 'student' ? studentNumber : undefined,
      modules: role === 'tutor' ? [] : undefined
    });
    
    await user.save();
    
    req.session.user = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      studentNumber: user.studentNumber
    };
    
    res.redirect(`/${user.role}-dashboard`);
  } catch (error) {
    console.error(error);
    res.render('register', { error: 'Registration failed. Please try again.' });
  }
});

// Process login
router.post('/login', async (req, res) => {
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
router.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

module.exports = router;