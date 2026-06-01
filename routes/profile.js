const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Subject = require('../models/Subject');
const { requireAuth } = require('../middleware/auth');

// Profile Settings - GET
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

// Profile Settings - UPDATE
router.put('/profile-settings', requireAuth, async (req, res) => {
  try {
    const { name, phone, bio, modules } = req.body;
    const updateData = { name, phone, bio };
    
    if (req.session.user.role === 'tutor') {
      updateData.modules = Array.isArray(modules) ? modules : (modules ? [modules] : []);
    }
    
    await User.findByIdAndUpdate(req.session.user.id, updateData);
    req.session.user.name = name;
    if (req.session.user.role === 'tutor') req.session.user.modules = updateData.modules;
    
    res.redirect('/profile-settings?success=Profile updated');
  } catch (error) {
    console.error(error);
    res.redirect('/profile-settings?error=Update failed');
  }
});

module.exports = router;