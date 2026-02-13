const express = require('express');
const router = express.Router();
const newsController = require('../controllers/newsController');

// 'GET /api/news' -> 실시간 뉴스 카테고리별로 가져오기
router.get('/', newsController.getNews);

// 'GET /api/news/analyzed/:keyword' -> 분석 완료된 키워드별 뉴스 데이터 가져오기
router.get('/analyzed/:keyword', newsController.getAnalyzedNews);

// 'GET /api/news/frame-set/:keyword' -> 프레임 분류 결과 가져오기
router.get('/frame-set/:keyword', newsController.getFrameSet);

// 'GET /api/news/news-set/:keyword' -> 키워드별 뉴스 원본 세트 가져오기
router.get('/news-set/:keyword', newsController.getNewsSet);

// 'POST /api/news/extract-issues' -> 기사 데이터에서 실시간 이슈 클러스터 추출
router.post('/extract-issues', newsController.extractIssueClusters);

module.exports = router;