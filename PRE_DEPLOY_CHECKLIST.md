# 🚀 배포 전 빠른 체크리스트

배포하기 전에 이 항목들을 확인하세요!

## ✅ 코드 준비

- [ ] `.env` 파일이 `.gitignore`에 포함되어 있음
- [ ] `.env.example` 파일 생성 완료
- [ ] 민감한 정보(비밀번호, API 키)가 코드에 하드코딩되지 않음
- [ ] Health Check 엔드포인트 추가 (`/health`)
- [ ] 모든 변경사항이 커밋됨

**검증 스크립트 실행:**
```powershell
.\pre-deploy-check.ps1
```

---

## ✅ GitHub 설정

- [ ] GitHub Secrets 15개 모두 등록 ([GITHUB_SECRETS_CHECKLIST.md](./GITHUB_SECRETS_CHECKLIST.md) 참고)
- [ ] GitHub Actions workflow 파일 있음 (`.github/workflows/deploy.yml`)
- [ ] 저장소가 Private인지 확인 (민감한 정보 보호)

---

## ✅ 서버 준비 (최초 1회)

- [ ] Node.js 18.x 설치
  ```bash
  curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
  sudo apt-get install -y nodejs
  ```

- [ ] Python 3.9 설치
  ```bash
  sudo apt-get install -y python3.9 python3-pip
  ```

- [ ] PM2 설치
  ```bash
  sudo npm install -g pm2
  pm2 startup
  ```

- [ ] Nginx 설치
  ```bash
  sudo apt-get install -y nginx
  ```

- [ ] 프로젝트 디렉토리 생성
  ```bash
  mkdir -p /home/$(whoami)/algoriverse
  ```

- [ ] SSH 키 등록
  ```bash
  # Windows에서 생성한 Public Key 내용을 복사
  nano ~/.ssh/authorized_keys
  chmod 600 ~/.ssh/authorized_keys
  chmod 700 ~/.ssh
  ```

- [ ] 방화벽 설정
  ```bash
  sudo ufw allow 22/tcp
  sudo ufw allow 80/tcp
  sudo ufw allow 443/tcp
  sudo ufw enable
  ```

---

## ✅ 로컬 테스트

- [ ] Backend 로컬 실행 성공
  ```bash
  cd backend
  npm install
  npm start
  ```

- [ ] Frontend 로컬 빌드 성공
  ```bash
  cd front
  npm install
  npm run build
  ```

- [ ] Health Check 응답 확인
  ```bash
  curl http://localhost:5000/health
  ```

---

## ✅ 네트워크 설정

- [ ] 서버 IP 또는 도메인 확인
- [ ] DNS 설정 (도메인 사용 시)
- [ ] SSL 인증서 준비 (HTTPS 사용 시)
- [ ] 포트 5000이 열려 있음

---

## 🚀 배포 실행

모든 항목 확인 완료 후:

```bash
# 1. 검증 스크립트 실행
.\pre-deploy-check.ps1

# 2. Git 커밋 및 푸시
git add .
git commit -m "Setup CI/CD pipeline for production deployment"
git push origin main

# 3. GitHub Actions 확인
# 브라우저에서 저장소의 Actions 탭 확인
```

---

## 📊 배포 후 확인

배포 완료 후 다음을 확인하세요:

- [ ] GitHub Actions 워크플로 성공 (녹색 체크)
- [ ] 서버 SSH 접속 가능
  ```bash
  ssh username@your-server-ip
  ```

- [ ] PM2 프로세스 실행 중
  ```bash
  pm2 list
  ```

- [ ] Health Check 응답
  ```bash
  curl http://your-server-ip:5000/health
  ```

- [ ] Nginx 정상 작동
  ```bash
  sudo systemctl status nginx
  ```

- [ ] 웹사이트 접속 가능
  - http://your-domain.com 또는
  - http://your-server-ip

- [ ] 로그 확인
  ```bash
  pm2 logs algoriverse-backend
  sudo tail -f /var/log/nginx/algoriverse-error.log
  ```

---

## 🆘 문제 발생 시

### GitHub Actions 실패
1. Actions 탭에서 에러 로그 확인
2. GitHub Secrets 값 재확인
3. SSH 연결 테스트

### 서버 접속 불가
```bash
# SSH 디버그 모드
ssh -vvv username@your-server-ip
```

### 애플리케이션 시작 실패
```bash
# PM2 로그 확인
pm2 logs algoriverse-backend --lines 100

# 수동 실행 테스트
cd /home/username/algoriverse/backend
node app.js
```

### Nginx 오류
```bash
# 설정 파일 검사
sudo nginx -t

# 로그 확인
sudo tail -50 /var/log/nginx/error.log
```

---

## 📚 추가 문서

- 상세 가이드: [README.deployment.md](./README.deployment.md)
- SSH 키 설정: [SSH_KEY_SETUP_WINDOWS.md](./SSH_KEY_SETUP_WINDOWS.md)
- Secrets 목록: [GITHUB_SECRETS_CHECKLIST.md](./GITHUB_SECRETS_CHECKLIST.md)

---

**마지막 업데이트**: 2026-02-13

**배포 성공하세요! 🎉**
