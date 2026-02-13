# Algoriverse CI/CD 배포 가이드

## 📋 목차
1. [사전 준비](#사전-준비)
2. [GitHub Secrets 설정](#github-secrets-설정)
3. [서버 초기 설정](#서버-초기-설정)
4. [배포 프로세스](#배포-프로세스)
5. [트러블슈팅](#트러블슈팅)

---

## 🚀 사전 준비

### 1. 네이버 클라우드 서버 요구사항

**WEB 서버 (Nginx)**
- OS: Ubuntu 20.04 LTS 이상
- Nginx 설치 필요
- 최소 2GB RAM

**WAS 서버 (Node.js)**
- OS: Ubuntu 20.04 LTS 이상
- Node.js 18.x 이상
- Python 3.9 이상
- PM2 프로세스 매니저
- 최소 4GB RAM

### 2. 필수 소프트웨어 설치

```bash
# Node.js 18.x 설치
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Python 3.9 설치
sudo apt-get install -y python3.9 python3-pip

# PM2 설치
sudo npm install -g pm2

# Nginx 설치
sudo apt-get install -y nginx

# Git 설치
sudo apt-get install -y git
```

---

## 🔐 GitHub Secrets 설정

GitHub 저장소의 `Settings > Secrets and variables > Actions`에서 다음 Secrets를 등록하세요:

### 필수 Secrets

#### 서버 접속 정보
- `NCP_WAS_HOST`: WAS 서버 IP 또는 도메인
  - 예: `123.456.789.101`
- `NCP_USERNAME`: 서버 SSH 사용자명
  - 예: `ubuntu` 또는 `root`
- `NCP_SSH_KEY`: SSH Private Key (전체 내용)
  - 생성 방법: `ssh-keygen -t rsa -b 4096 -C "github-actions"`
  - `~/.ssh/id_rsa` 파일의 전체 내용 복사
- `NCP_SSH_PORT`: SSH 포트 번호
  - 기본값: `22`

#### 데이터베이스
- `DB_NAME`: 데이터베이스 이름
  - 예: `cgi_25K_donga1_p2_4`
- `DB_USER`: 데이터베이스 사용자
- `DB_PASSWORD`: 데이터베이스 비밀번호
- `DB_HOST`: 데이터베이스 호스트
  - 예: `project-db-campus.smhrd.com`
- `DB_PORT`: 데이터베이스 포트
  - 예: `3307`

#### 애플리케이션
- `PORT`: Backend 포트 번호
  - 예: `5000`
- `JWT_SECRET`: JWT 토큰 비밀키 (64자 이상)
  - 생성: `openssl rand -hex 64`

#### API Keys
- `NAVER_CLIENT_ID`: 네이버 뉴스 API 클라이언트 ID
- `NAVER_CLIENT_SECRET`: 네이버 뉴스 API 시크릿
- `OPENAI_API_KEY`: OpenAI API 키
- `SITEAI_API_KEY`: Site AI API 키

---

## 🖥️ 서버 초기 설정

### 1. SSH 키 설정

#### GitHub Actions용 SSH 키 생성 (로컬 머신에서)
```bash
ssh-keygen -t rsa -b 4096 -C "github-actions" -f ~/.ssh/github_actions
```

#### 서버에 Public Key 등록
```bash
# 서버에 SSH 접속
ssh username@your-server-ip

# .ssh 디렉토리 생성
mkdir -p ~/.ssh
chmod 700 ~/.ssh

# authorized_keys에 Public Key 추가
# (로컬에서 ~/.ssh/github_actions.pub 내용을 복사하여 붙여넣기)
nano ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

### 2. 프로젝트 디렉토리 설정

```bash
# 프로젝트 디렉토리 생성
mkdir -p /home/$(whoami)/algoriverse
cd /home/$(whoami)/algoriverse

# 로그 디렉토리 생성
mkdir -p backend/logs
```

### 3. Nginx 설정

```bash
# Nginx 설정 파일 심볼릭 링크
sudo ln -s /home/$(whoami)/algoriverse/nginx.conf /etc/nginx/sites-available/algoriverse
sudo ln -s /etc/nginx/sites-available/algoriverse /etc/nginx/sites-enabled/

# 기본 설정 제거 (선택사항)
sudo rm /etc/nginx/sites-enabled/default

# nginx.conf 파일 수정 (USERNAME을 실제 사용자명으로 변경)
sed -i "s/USERNAME/$(whoami)/g" /home/$(whoami)/algoriverse/nginx.conf

# Nginx 설정 테스트 및 재시작
sudo nginx -t
sudo systemctl restart nginx
sudo systemctl enable nginx
```

### 4. Nginx 실행 권한 설정

```bash
# Nginx가 프로젝트 디렉토리에 접근할 수 있도록 권한 설정
sudo usermod -a -G $(whoami) www-data
chmod 755 /home/$(whoami)
chmod -R 755 /home/$(whoami)/algoriverse
```

### 5. PM2 설정

```bash
# PM2 자동 시작 설정
pm2 startup
# 출력된 명령어를 복사하여 실행

# 예: sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u ubuntu --hp /home/ubuntu
```

### 6. 방화벽 설정

```bash
# UFW 활성화
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable
```

---

## 🔄 배포 프로세스

### 자동 배포 (GitHub Actions)

1. **코드 푸시**
   ```bash
   git add .
   git commit -m "Your commit message"
   git push origin main
   ```

2. **GitHub Actions 실행**
   - GitHub 저장소의 `Actions` 탭에서 워크플로 진행 상황 확인
   - 성공 시 자동으로 서버에 배포됨

### 수동 배포

```bash
# 서버에 SSH 접속
ssh username@your-server-ip

# 배포 스크립트 실행
cd /home/$(whoami)/algoriverse
chmod +x deploy.sh
./deploy.sh
```

---

## 📊 모니터링 및 로그 확인

### PM2 모니터링
```bash
# 프로세스 상태 확인
pm2 list

# 실시간 로그 확인
pm2 logs algoriverse-backend

# 모니터링 대시보드
pm2 monit
```

### Nginx 로그
```bash
# Access 로그
sudo tail -f /var/log/nginx/algoriverse-access.log

# Error 로그
sudo tail -f /var/log/nginx/algoriverse-error.log
```

### 애플리케이션 로그
```bash
# Backend 로그
tail -f /home/$(whoami)/algoriverse/backend/logs/out.log
tail -f /home/$(whoami)/algoriverse/backend/logs/err.log
```

---

## 🔧 트러블슈팅

### 1. 배포 실패 시

**GitHub Actions에서 실패**
```bash
# 로컬에서 빌드 테스트
cd front
npm install
npm run build

cd ../backend
npm install
npm start
```

**SSH 연결 실패**
- GitHub Secrets의 `NCP_SSH_KEY` 확인
- 서버의 `~/.ssh/authorized_keys` 확인
- SSH 포트 번호 확인 (`NCP_SSH_PORT`)

### 2. Nginx 오류

```bash
# Nginx 설정 문법 검사
sudo nginx -t

# Nginx 재시작
sudo systemctl restart nginx

# Nginx 상태 확인
sudo systemctl status nginx
```

### 3. Backend가 시작되지 않는 경우

```bash
# PM2 프로세스 확인
pm2 list

# 상세 로그 확인
pm2 logs algoriverse-backend --lines 100

# 프로세스 재시작
pm2 restart algoriverse-backend

# 환경변수 확인
cat /home/$(whoami)/algoriverse/backend/.env
```

### 4. 데이터베이스 연결 실패

```bash
# 데이터베이스 연결 테스트
mysql -h $DB_HOST -P $DB_PORT -u $DB_USER -p

# .env 파일 확인
cat backend/.env
```

### 5. 포트 충돌

```bash
# 5000번 포트 사용 프로세스 확인
sudo lsof -i :5000

# 프로세스 종료
sudo kill -9 <PID>
```

---

## 🔒 보안 권장사항

1. **SSH 키 기반 인증만 허용**
   ```bash
   sudo nano /etc/ssh/sshd_config
   # PasswordAuthentication no
   sudo systemctl restart sshd
   ```

2. **Fail2Ban 설치** (무차별 대입 공격 방지)
   ```bash
   sudo apt-get install fail2ban
   sudo systemctl enable fail2ban
   ```

3. **정기적인 시스템 업데이트**
   ```bash
   sudo apt-get update && sudo apt-get upgrade
   ```

4. **SSL/TLS 인증서 설치** (Let's Encrypt)
   ```bash
   sudo apt-get install certbot python3-certbot-nginx
   sudo certbot --nginx -d your-domain.com
   ```

---

## 📝 체크리스트

배포 전 확인사항:

- [ ] GitHub Secrets 모두 등록
- [ ] 서버에 SSH 접속 가능
- [ ] Node.js, Python, PM2, Nginx 설치 완료
- [ ] 프로젝트 디렉토리 생성 (`/home/username/algoriverse`)
- [ ] Nginx 설정 파일 수정 (USERNAME 변경)
- [ ] 방화벽 포트 오픈 (22, 80, 443)
- [ ] PM2 startup 설정 완료
- [ ] `.env.example` 파일 작성
- [ ] Health Check 엔드포인트 추가 (`/health`)

---

## 🆘 지원

문제가 발생하면:
1. GitHub Actions 로그 확인
2. 서버 로그 확인 (`pm2 logs`, Nginx 로그)
3. 네트워크 연결 확인
4. 데이터베이스 연결 확인

---

## 📚 참고 자료

- [PM2 문서](https://pm2.keymetrics.io/docs/usage/quick-start/)
- [Nginx 문서](https://nginx.org/en/docs/)
- [GitHub Actions 문서](https://docs.github.com/en/actions)
- [네이버 클라우드 문서](https://guide.ncloud-docs.com/)
