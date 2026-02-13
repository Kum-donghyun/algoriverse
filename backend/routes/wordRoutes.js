const express = require('express');
const router = express.Router();

const {
    getTodayWordCloud
} = require('../controllers/wordController');

// 오늘 뉴스 기반 워드클라우드
// GET /api/wordcloud/today
router.get('/today', getTodayWordCloud);

module.exports = router;