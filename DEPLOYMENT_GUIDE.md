# Algoriverse CI/CD Quick Reference

## 🔑 GitHub Secrets 등록 필요 항목

### 서버 정보
```
NCP_WAS_HOST=123.456.789.101
NCP_USERNAME=ubuntu
NCP_SSH_KEY=(SSH Private Key 전체 내용)
NCP_SSH_PORT=22
```

### 데이터베이스
```
DB_NAME=cgi_25K_donga1_p2_4
DB_USER=cgi_25K_donga1_p2_4
DB_PASSWORD=your_db_password
DB_HOST=project-db-campus.smhrd.com
DB_PORT=3307
```

### 애플리케이션
```
PORT=5000
JWT_SECRET=(64자 랜덤 문자열)
```

생성 방법:
```bash
openssl rand -hex 64
```

### API Keys
```
NAVER_CLIENT_ID=your_naver_id
NAVER_CLIENT_SECRET=your_naver_secret
OPENAI_API_KEY=sk-proj-...
SITEAI_API_KEY=sk-proj-...
```

---

## 📝 배포 전 체크리스트

### 1. 로컬 환경 준비
- [ ] `.gitignore` 확인 (민감한 정보 제외)
- [ ] `.env.example` 파일 생성 완료
- [ ] Health Check 엔드포인트 추가 (`/health`)
- [ ] 모든 변경사항 커밋

### 2. GitHub 설정
- [ ] GitHub Secrets 모두 등록 (위 목록 참고)
- [ ] GitHub Actions 워크플로 활성화

### 3. 서버 초기 설정 (최초 1회)
```bash
# Node.js 설치
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# PM2 설치
sudo npm install -g pm2

# Nginx 설치
sudo apt-get install -y nginx

# Python 설치
sudo apt-get install -y python3.9 python3-pip

# 프로젝트 디렉토리 생성
mkdir -p /home/$(whoami)/algoriverse

# Nginx 설정
sudo ln -s /home/$(whoami)/algoriverse/nginx.conf /etc/nginx/sites-available/algoriverse
sudo ln -s /etc/nginx/sites-available/algoriverse /etc/nginx/sites-enabled/

# PM2 자동 시작 설정
pm2 startup

# 방화벽 설정
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

### 4. SSH 키 설정
```bash
# 로컬에서 SSH 키 생성
ssh-keygen -t rsa -b 4096 -C "github-actions" -f ~/.ssh/github_actions

# Public Key를 서버의 ~/.ssh/authorized_keys에 추가
# Private Key를 GitHub Secrets의 NCP_SSH_KEY에 등록
```

### 5. 배포 실행
```bash
git add .
git commit -m "Setup CI/CD pipeline"
git push origin main
```

### 6. 배포 확인
- GitHub Actions 로그 확인
- 서버 접속하여 PM2 상태 확인: `pm2 list`
- Health Check: `curl http://localhost:5000/health`
- 웹사이트 접속 확인

---

## 🚨 트러블슈팅

### SSH 연결 실패
```bash
# SSH 키 권한 확인
chmod 600 ~/.ssh/github_actions
chmod 644 ~/.ssh/github_actions.pub

# 서버에서 authorized_keys 권한 확인
chmod 600 ~/.ssh/authorized_keys
chmod 700 ~/.ssh
```

### PM2 프로세스 확인
```bash
pm2 list
pm2 logs algoriverse-backend
pm2 restart algoriverse-backend
```

### Nginx 오류
```bash
# 설정 문법 검사
sudo nginx -t

# 재시작
sudo systemctl restart nginx

# 로그 확인
sudo tail -f /var/log/nginx/error.log
```

### 데이터베이스 연결 오류
```bash
# .env 파일 확인
cat /home/username/algoriverse/backend/.env

# 데이터베이스 연결 테스트
mysql -h $DB_HOST -P $DB_PORT -u $DB_USER -p
```

---

## 📊 모니터링

### 실시간 로그 확인
```bash
# PM2 로그
pm2 logs algoriverse-backend

# Nginx Access 로그
sudo tail -f /var/log/nginx/algoriverse-access.log

# Nginx Error 로그
sudo tail -f /var/log/nginx/algoriverse-error.log
```

### 상태 확인
```bash
# PM2 프로세스
pm2 list
pm2 monit

# Nginx 상태
sudo systemctl status nginx

# 디스크 사용량
df -h

# 메모리 사용량
free -m
```

---

## 🔄 롤백 방법

문제 발생 시 이전 버전으로 롤백:

```bash
# 서버에 SSH 접속
ssh username@your-server-ip

# 백업 목록 확인
ls -lh /home/$(whoami)/backups/

# 백업 복원
cd /home/$(whoami)/algoriverse
tar -xzf /home/$(whoami)/backups/algoriverse_YYYYMMDD_HHMMSS.tar.gz

# PM2 재시작
pm2 restart algoriverse-backend
```

---

## 📞 지원

상세한 가이드는 `README.deployment.md` 참고

문제 해결:
1. GitHub Actions 로그 확인
2. 서버 로그 확인
3. Health Check 확인: `curl https://your-domain.com/health`
