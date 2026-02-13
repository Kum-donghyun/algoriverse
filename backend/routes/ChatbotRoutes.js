const express = require('express');
const router = express.Router();
const chatbotController = require('../controllers/ChatbotController');

// POST /api/chat
router.post('/', chatbotController.getReply);

module.exports = router;