const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.json([]);
});

router.get('/:id', (req, res) => {
  res.json({});
});

router.put('/:id', (req, res) => {
  res.json({});
});

router.delete('/:id', (req, res) => {
  res.json({});
});

module.exports = router;