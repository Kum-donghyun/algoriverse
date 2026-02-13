const express = require('express');
const router = express.Router();
const loadingController = require('../controllers/loadingController');

// app.js에서 '/api/analysis'로 이미 붙였으므로 여기서는 'status'만
router.get('/status', loadingController.checkStatus);   // GET /api/analysis/status
router.post('/start', loadingController.startAnalysis); // POST /api/analysis/start

module.exports = router;
