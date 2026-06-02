const express = require('express');
const router = express.Router();

router.get('/tutor/:tutorId', (req, res) => {
  res.json([]);
});

router.post('/', (req, res) => {
  res.json({ success: true });
});

module.exports = router;