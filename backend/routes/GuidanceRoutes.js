const express = require('express');
const router = express.Router();
const { searchNews } = require('../controllers/GuidanceController');

// 뉴스 관점 지도 검색 라우트 (GET /api/guidance/search?keyword=...)
router.get('/search', searchNews);

module.exports = router;