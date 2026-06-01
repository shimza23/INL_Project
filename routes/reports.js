const express = require('express');
const router = express.Router();

router.get('/analytics', (req, res) => {
  res.json({ totalBookings: 0, activeTutors: 0, totalStudents: 0, avgRating: 0 });
});

module.exports = router;