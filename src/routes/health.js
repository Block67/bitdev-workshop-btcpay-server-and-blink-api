const express = require('express');
const router = express.Router();
const { getDb } = require('../database/connection');

router.get('/', async (req, res) => {
  try {
    await getDb().ping();
    res.json({
      status: 'ok',
      database: 'connected',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      database: 'disconnected',
    });
  }
});

module.exports = router;