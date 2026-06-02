const express = require('express');
const router = express.Router();

// Simple working routes
router.post('/', (req, res) => {
  res.redirect('/my-bookings');
});

router.put('/:id/status', (req, res) => {
  res.redirect('/student-requests');
});

router.delete('/:id', (req, res) => {
  res.redirect('/my-bookings');
});

module.exports = router;