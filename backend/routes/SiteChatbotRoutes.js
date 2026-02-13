const express = require('express');
const router = express.Router();
const { generateChatResponse } = require('../controllers/SiteChatbotController');
/**
 * @route   POST /api/site-chatbot
 * @desc    기사 기반 AI 챗봇 답변 생성
 * @access  Public
 */

router.post('/', generateChatResponse);

module.exports = router;