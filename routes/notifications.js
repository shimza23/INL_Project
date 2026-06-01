const express = require('express');
const router = express.Router();

router.put('/:id/read', (req, res) => {
  res.json({ success: true });
});

router.put('/user/read-all', (req, res) => {
  res.json({ success: true });
});

module.exports = router;