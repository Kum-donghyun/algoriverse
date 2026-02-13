# Algoriverse - AI 기반 뉴스 편향성 분석 플랫폼

> 네이버 클라우드 기반 CI/CD 자동 배포 파이프라인 구축 완료

## 📌 프로젝트 개요

Algoriverse는 AI를 활용하여 뉴스 기사의 편향성을 자동으로 분석하고 시각화하는 웹 플랫폼입니다.

### 주요 기능
- 🔍 키워드 기반 뉴스 검색 및 편향성 분석
- 📊 프레임 분석 및 시각화 (워드클라우드, 차트)
- 🎓 페르소나별 맞춤 대시보드 (전문가/학습자/교육자/일반)
- 📝 교육 자료 템플릿 및 인터랙티브 퀴즈
- 💬 AI 챗봇 기반 분석 도우미
- 📤 다중 포맷 내보내기 (PDF, Markdown, Image, CSV)

## 🏗️ 기술 스택

### Frontend
- **Framework**: React 19.2 + Vite
- **Routing**: React Router DOM 6.30
- **Visualization**: Recharts, D3.js, D3-Cloud
- **Export**: html2canvas, jsPDF
- **HTTP Client**: Axios

### Backend
- **Runtime**: Node.js + Express 4.21
- **Database**: MySQL 2 (Sequelize ORM)
- **Authentication**: JWT (jsonwebtoken)
- **External APIs**: Naver News API, OpenAI GPT-4
- **Process Manager**: PM2

### AI/ML
- **Language**: Python 3.9
- **Models**: GPT-4o-mini (편향성 분석)
- **Web Scraping**: Cheerio, Axios

### DevOps
- **CI/CD**: GitHub Actions
- **Web Server**: Nginx
- **Cloud**: Naver Cloud Platform
- **Version Control**: Git + GitHub

## 📁 프로젝트 구조

```
back/
├── .github/
│   └── workflows/
│       └── deploy.yml          # CI/CD 파이프라인
├── backend/
│   ├── app.js                  # Express 서버 엔트리포인트
│   ├── package.json
│   ├── ecosystem.config.js     # PM2 설정
│   ├── .env.example            # 환경변수 템플릿
│   ├── bias_model/             # Python AI 모델
│   │   ├── main.py
│   │   ├── predict.py
│   │   ├── auto_system.py
│   │   └── requirements.txt
│   ├── config/                 # 데이터베이스 및 API 설정
│   ├── controllers/            # 비즈니스 로직
│   ├── models/                 # Sequelize 모델
│   ├── routes/                 # API 라우트
│   └── data/                   # 크롤링 데이터 및 분석 결과
├── front/
│   ├── src/
│   │   ├── components/         # React 컴포넌트
│   │   │   ├── common/         # 공통 컴포넌트
│   │   │   └── layout/         # 레이아웃 컴포넌트
│   │   ├── pages/              # 페이지 컴포넌트
│   │   ├── styles/             # CSS 스타일시트
│   │   ├── utils/              # 유틸리티 함수
│   │   └── config/             # 설정 파일
│   ├── package.json
│   ├── vite.config.js          # Vite 설정
│   └── .env.example            # 환경변수 템플릿
├── nginx.conf                  # Nginx 설정 파일
├── deploy.sh                   # 수동 배포 스크립트
├── .gitignore                  # Git 제외 파일
├── DEPLOYMENT_GUIDE.md         # 배포 간편 가이드
└── README.deployment.md        # 배포 상세 문서
```

## 🚀 빠른 시작

### 로컬 개발 환경

#### 1. 저장소 클론
```bash
git clone https://github.com/your-username/algoriverse.git
cd algoriverse
```

#### 2. Backend 설정
```bash
cd backend

# 의존성 설치
npm install

# 환경변수 설정
cp .env.example .env
# .env 파일을 열어서 데이터베이스 및 API 키 정보 입력

# Python 의존성 설치
cd bias_model
pip install -r requirements.txt
cd ..

# 서버 실행
npm start
# 또는 개발 모드: npm run dev
```

#### 3. Frontend 설정
```bash
cd front

# 의존성 설치
npm install

# 환경변수 설정 (선택사항)
cp .env.example .env

# 개발 서버 실행
npm run dev
```

#### 4. 브라우저에서 접속
```
Frontend: http://localhost:5173
Backend API: http://localhost:5000
```

## 🔧 환경 변수 설정

### Backend (.env)
```env
# Database
DB_NAME=your_database_name
DB_USER=your_database_user
DB_PASSWORD=your_database_password
DB_HOST=your_database_host
DB_PORT=3307

# Server
PORT=5000

# JWT
JWT_SECRET=your_jwt_secret_key

# External APIs
NAVER_CLIENT_ID=your_naver_client_id
NAVER_CLIENT_SECRET=your_naver_client_secret
OPENAI_API_KEY=your_openai_api_key
SITEAI_API_KEY=your_siteai_api_key

# Features
ENABLE_GPT_BIAS=1
ENABLE_AI_ANALYSIS=1
OPENAI_MODEL=gpt-4o-mini
```

### Frontend (.env)
```env
VITE_API_URL=http://localhost:5000/api
```

## 📦 프로덕션 빌드

### Frontend 빌드
```bash
cd front
npm run build
# 빌드 결과물: front/dist/
```

### Backend 프로덕션 실행
```bash
cd backend
NODE_ENV=production node app.js
# 또는 PM2 사용
pm2 start ecosystem.config.js --env production
```

## 🌐 CI/CD 배포

### GitHub Secrets 설정 필요 항목

배포를 위해 GitHub 저장소의 Secrets에 다음 정보를 등록하세요:

#### 서버 접속 정보
- `NCP_WAS_HOST`: WAS 서버 IP (예: 123.456.789.101)
- `NCP_USERNAME`: SSH 사용자명 (예: ubuntu)
- `NCP_SSH_KEY`: SSH Private Key 전체 내용
- `NCP_SSH_PORT`: SSH 포트 (기본: 22)

#### 데이터베이스
- `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT`

#### 애플리케이션
- `PORT`: Backend 포트 (예: 5000)
- `JWT_SECRET`: JWT 비밀키 (64자 이상)

#### API Keys
- `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET`
- `OPENAI_API_KEY`, `SITEAI_API_KEY`

### 배포 실행

```bash
# main 브랜치에 푸시하면 자동 배포
git add .
git commit -m "Deploy to production"
git push origin main
```

GitHub Actions가 자동으로:
1. ✅ 코드 체크아웃
2. ✅ 의존성 설치 (Node.js, Python)
3. ✅ Frontend 빌드
4. ✅ 서버에 파일 전송
5. ✅ Backend 배포 및 PM2 재시작
6. ✅ Nginx 재시작
7. ✅ Health Check

### 배포 상태 확인

- **GitHub Actions**: 저장소의 `Actions` 탭에서 워크플로 확인
- **서버 로그**: `pm2 logs algoriverse-backend`
- **Health Check**: `curl http://your-server/health`

## 📖 상세 문서

- **배포 가이드**: [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) - 빠른 참조
- **배포 상세 문서**: [README.deployment.md](./README.deployment.md) - 전체 가이드

## 🛠️ 개발 가이드

### API 엔드포인트

```
# 뉴스 관련
GET  /api/news/search?keyword={keyword}    # 뉴스 검색
POST /api/news/analyze                     # 편향성 분석

# 사용자
POST /api/user/register                    # 회원가입
POST /api/user/login                       # 로그인

# 워드클라우드
GET  /api/wordcloud?keyword={keyword}      # 워드클라우드 데이터

# 챗봇
POST /api/chat                             # AI 챗봇 대화
POST /api/site-chatbot                     # 사이트 도우미

# 게시판
GET  /api/board                            # 게시글 목록
POST /api/board                            # 게시글 작성

# Health Check
GET  /health                               # 서버 상태 확인
```

### 주요 컴포넌트

```
Visualization.jsx      # 프레임 분석 시각화
PersonaDashboard.jsx   # 페르소나별 대시보드
EducationTemplate.jsx  # 교육 자료 템플릿
BiasQuiz.jsx          # 인터랙티브 퀴즈
ExportButton.jsx      # 다중 포맷 내보내기
```

## 🧪 테스트

```bash
# Backend 테스트
cd backend
npm test

# Frontend 테스트
cd front
npm test
```

## 📊 모니터링

### PM2 모니터링
```bash
pm2 list              # 프로세스 목록
pm2 logs             # 실시간 로그
pm2 monit            # 실시간 모니터링
pm2 restart app      # 재시작
```

### Nginx 로그
```bash
sudo tail -f /var/log/nginx/algoriverse-access.log
sudo tail -f /var/log/nginx/algoriverse-error.log
```

## 🔒 보안

- ✅ JWT 기반 인증
- ✅ CORS 설정
- ✅ 환경변수로 민감 정보 관리
- ✅ SQL Injection 방지 (Sequelize ORM)
- ✅ XSS 방지 (React 자동 이스케이핑)
- ✅ HTTPS 지원 (Nginx SSL)

## 🤝 기여

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 라이선스

This project is licensed under the ISC License.

## 👥 개발팀

- Backend & AI: [Team Member]
- Frontend: [Team Member]
- DevOps: [Team Member]

## 📞 문의

- Email: support@algoriverse.com
- Issues: [GitHub Issues](https://github.com/your-username/algoriverse/issues)

---

**⚠️ 주의사항**
- `.env` 파일은 절대 Git에 커밋하지 마세요
- API 키는 반드시 환경변수로 관리하세요
- 프로덕션 배포 전 `.env.example`을 참고하여 모든 환경변수를 설정하세요
