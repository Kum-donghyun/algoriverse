const express = require('express');
const router = express.Router();
const boardController = require('../controllers/BoardController');
const authenticateUser = require('../config/middleware'); // 인증 미들웨어

// 전체 목록 조회: GET /api/board (공개)
router.get('/', boardController.getQuestions);

// 상세 조회: GET /api/board/:id (공개)
router.get('/:id', boardController.getQuestionDetail);

// 질문 등록: POST /api/board (인증 필요)
router.post('/', authenticateUser, boardController.createQuestion);

// 답변 등록: POST /api/board/answer (인증 필요, 관리자)
router.post('/answer', authenticateUser, boardController.createAnswer);

// 댓글 등록: POST /api/board/comment (인증 필요)
router.post('/comment', authenticateUser, boardController.createComment);

// 질문 수정: PUT /api/board/:id (인증 필요)
router.put('/:id', authenticateUser, boardController.updateQuestion);

// 질문 일괄 삭제: DELETE /api/board/bulk (인증 필요)
router.delete('/bulk', authenticateUser, boardController.deleteBulkQuestions);

// 질문 삭제: DELETE /api/board/:id (인증 필요)
router.delete('/:id', authenticateUser, boardController.deleteQuestion);

module.exports = router;