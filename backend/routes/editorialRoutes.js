
const express = require('express');
const router = express.Router();
const editorialController = require('../controllers/editorialController');
// GET /api/editorials/test-pipeline?date=YYYY-MM-DD
router.get('/test-pipeline', editorialController.testEditorialPipelineFromRaw);

// GET /api/editorials/list?date=YYYY-MM-DD
router.get('/list', editorialController.fetchEditorialsForDate);

// POST /api/editorials/collect { date }
router.post('/collect', editorialController.collectEditorials);

// GET /api/editorials/analyze?date=YYYY-MM-DD
router.get('/analyze', editorialController.analyzeEditorials);

// GET /api/editorials/opinionbot?date=YYYY-MM-DD — 오피니언봇 분석 실행
router.get('/opinionbot', editorialController.runOpinionBot);

// GET /api/editorials/opinionbot-result?date=YYYY-MM-DD (캐시 결과 조회) 
router.get('/opinionbot-result', editorialController.getOpinionBotResult);

// GET /api/editorials/trend-timeline - 교육 템플릿용 사설 타임라인 로드
router.get('/trend-timeline', editorialController.getEditorialTrendTimeline);

module.exports = router;
