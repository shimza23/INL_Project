const express = require('express');
const router = express.Router();

router.post('/', (req, res) => {
  res.redirect('/my-bookings');
});

router.get('/tutor/:tutorId', (req, res) => {
  res.json([]);
});

module.exports = router;