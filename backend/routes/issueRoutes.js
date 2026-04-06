const express = require('express');
const router = express.Router();
const issueController = require('../controllers/issueController');

// GET /api/issues/realtime - 실시간 이슈 목록
// Query params: category (all|정치|경제|사회|문화|세계|과학), timeRange (1h|6h|24h|3d|7d), limit (숫자)
router.get('/realtime', issueController.getRealtimeIssues);

// GET /api/issues/trending - 트렌딩 키워드 (워드클라우드용)
router.get('/trending', issueController.getTrendingKeywords);

// GET /api/issues/detail/:keyword - 이슈 상세 정보
router.get('/detail/:keyword', issueController.getIssueDetail);

module.exports = router;
