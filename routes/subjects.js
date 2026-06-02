const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.json([]);
});

router.post('/seed', (req, res) => {
  res.json({ message: 'Seeded' });
});

module.exports = router;