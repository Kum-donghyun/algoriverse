const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const db = require('./models'); // db 객체 import
const newsRoutes = require('./routes/newsRoutes');
const userRoutes = require('./routes/userRoutes');
// const loadingRoutes = require('./routes/loadingRoutes');
const wordRoutes = require('./routes/wordRoutes');
const boardRoutes = require('./routes/BoardRoutes');
const chatbotRoutes = require('./routes/ChatbotRoutes');
const siteChatbotRoutes = require('./routes/SiteChatbotRoutes');
const guidanceRoutes = require('./routes/GuidanceRoutes');
const issueRoutes = require('./routes/issueRoutes');
const editorialRoutes = require('./routes/editorialRoutes');
// const insightRoutes = require('./routes/InsightRoutes');

const app = express();

// CORS 설정(프론트서버)
app.use(cors({
  // 프론트엔드 개발 서버 주소에 맞게 변경합니다.
  origin: 'http://localhost:5173',
  credentials: true                 // 쿠키, 인증 헤더 등 허용하려면 true
}));

//req.body (json) 사용
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// 라우터
app.use('/api/news', newsRoutes);
app.use('/api/user', userRoutes);
// app.use('/api/analysis', loadingRoutes);
app.use('/api/wordcloud', wordRoutes);
app.use('/api/board', boardRoutes);
app.use('/api/chat', chatbotRoutes);
app.use('/api/site-chatbot', siteChatbotRoutes);
app.use('/api/guidance', guidanceRoutes);
app.use('/api/issues', issueRoutes);
app.use('/api/editorials', editorialRoutes);
// app.use('/api/insight', insightRoutes);
// app.use('/', loadingRoutes);

// Health Check 엔드포인트 (CI/CD용)
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    service: 'Algoriverse Backend'
  });
});

// DB 연결 확인 후 서버 실행 (데이터베이스 생성 로직 추가)
const mysql = require('mysql2/promise');
const config = require('./config/db')[process.env.NODE_ENV || 'development'];

mysql.createConnection({
  host: config.host,
  port: config.port,
  user: config.username,
  password: config.password,
})
  .then((connection) => {
    return connection.query(`CREATE DATABASE IF NOT EXISTS \`${config.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`)
      .then(() => {
        console.log('✅ 데이터베이스 생성 또는 존재 확인 완료.');
        return connection.end();
      });
  })
  .then(() => {
    return db.sequelize.authenticate();
  })
  .then(() => {
    console.log('✅ 데이터베이스 연결 성공.');
    
    // 자동으로 테이블 생성/동기화
    return db.sequelize.sync({ alter: true });
  })
  .then(() => {
    console.log('✅ 데이터베이스 테이블 동기화 완료.');
    
    // 서버 실행
    app.listen(5000, '0.0.0.0', () => {
      console.log('🚀 서버 실행 중 (포트: 5000)');
    });
  })
  .catch(err => {
    console.error('❌ 데이터베이스 연결/동기화 실패:', err.message);
    process.exit(1);
  });