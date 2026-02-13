const express = require('express');
const router = express.Router();
const { User } = require('../models');
const userController = require('../controllers/userController');
const Middleware = require('../config/middleware');

// 1. 분석 시작 (POST /api/analysis/start)
router.post('/start', (req, res) => {
    const { keyword } = req.body;
    console.log(`분석 시작 키워드: ${keyword}`);
    // 여기서 분석 로직 실행 (파이썬 스크립트 실행 등)
    res.json({ message: "분석이 시작되었습니다." });
});

// 2. 상태 확인 (GET /api/analysis/status)
router.get('/status', (req, res) => {
    const { keyword } = req.query;
    // 실제 분석 완료 여부를 확인하는 로직 필요
    // 일단 테스트를 위해 true를 보내보세요.
    res.json({ completed: true, count: 120 }); 
});

router.post('/register', userController.createUser); //회원등록
router.post('/login', userController.loginUser); //회원로그인
router.post('/logout', userController.logoutUser); //회원로그아웃
router.post('/delete', Middleware, userController.deleteUser); //회원탈퇴
router.post('/find-id', userController.findId); // ID 찾기
router.post('/find-pw', userController.findPw); // PW 찾기
router.get('/me', Middleware, userController.getMe); // 내 정보 보기
router.post('/check-password', Middleware, userController.checkPassword); // 비밀번호 확인
router.put('/update', Middleware, userController.updateUser); // 사용자 정보 수정
router.delete('/delete', Middleware, userController.deleteUser);


// ID 중복 확인 라우트 추가
// adminRoutes.js or adminController.js
router.get('/check/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log('ID 중복확인 요청 들어옴:', id);  // ✅ 확인 로그

    const user = await User.findByPk(id);
    res.json({ exists: !!user });
  } catch (error) {
    console.error('중복 확인 오류:', error);  // ✅ 여기에 에러 찍힘
    res.status(500).json({ error: '중복 확인 실패' });
  }
});

module.exports = router;