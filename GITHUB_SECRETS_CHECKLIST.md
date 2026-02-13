# GitHub Secrets 등록 체크리스트

배포 전에 GitHub 저장소의 `Settings > Secrets and variables > Actions > New repository secret`에서 다음 항목들을 등록하세요.

## ✅ 서버 접속 정보 (4개)

### NCP_WAS_HOST
- **설명**: WAS 서버의 IP 주소 또는 도메인
- **예시**: `123.456.789.101`
- **확인 방법**: 네이버 클라우드 콘솔에서 서버 정보 확인
- [ ] 등록 완료

### NCP_USERNAME  
- **설명**: SSH 접속 사용자명
- **예시**: `ubuntu` (Ubuntu 서버) 또는 `root`
- **확인 방법**: 서버 생성 시 설정한 사용자명
- [ ] 등록 완료

### NCP_SSH_KEY
- **설명**: SSH Private Key 전체 내용
- **생성 방법**: 
  ```powershell
  ssh-keygen -t rsa -b 4096 -C "github-actions" -f $env:USERPROFILE\.ssh\github_actions
  Get-Content $env:USERPROFILE\.ssh\github_actions
  ```
- **주의**: `-----BEGIN OPENSSH PRIVATE KEY-----`부터 `-----END OPENSSH PRIVATE KEY-----`까지 전체 복사
- [ ] 등록 완료

### NCP_SSH_PORT
- **설명**: SSH 포트 번호
- **예시**: `22` (기본값)
- **확인 방법**: 서버 SSH 설정 확인
- [ ] 등록 완료

---

## ✅ 데이터베이스 정보 (5개)

### DB_NAME
- **설명**: 데이터베이스 이름
- **현재 값**: `cgi_25K_donga1_p2_4`
- [ ] 등록 완료

### DB_USER
- **설명**: 데이터베이스 사용자명
- **현재 값**: `cgi_25K_donga1_p2_4`
- [ ] 등록 완료

### DB_PASSWORD
- **설명**: 데이터베이스 비밀번호
- **⚠️ 주의**: 실제 비밀번호를 입력하세요
- [ ] 등록 완료

### DB_HOST
- **설명**: 데이터베이스 호스트 주소
- **현재 값**: `project-db-campus.smhrd.com`
- [ ] 등록 완료

### DB_PORT
- **설명**: 데이터베이스 포트
- **현재 값**: `3307`
- [ ] 등록 완료

---

## ✅ 애플리케이션 설정 (2개)

### PORT
- **설명**: Backend 서버 포트
- **예시**: `5000`
- [ ] 등록 완료

### JWT_SECRET
- **설명**: JWT 토큰 서명용 비밀키 (64자 이상 권장)
- **생성 방법**:
  ```powershell
  # PowerShell에서 실행
  -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 64 | ForEach-Object {[char]$_})
  ```
- **또는**: https://www.grc.com/passwords.htm 에서 생성
- [ ] 등록 완료

---

## ✅ API Keys (4개)

### NAVER_CLIENT_ID
- **설명**: 네이버 뉴스 API 클라이언트 ID
- **현재 값**: `faWYXJn7YVVt36Bzyte_`
- **⚠️ 주의**: 실제 키로 업데이트하세요
- [ ] 등록 완료

### NAVER_CLIENT_SECRET
- **설명**: 네이버 뉴스 API 시크릿
- **현재 값**: `XbZAtCcN3S`
- **⚠️ 주의**: 실제 키로 업데이트하세요
- [ ] 등록 완료

### OPENAI_API_KEY
- **설명**: OpenAI API 키 (GPT 모델 사용)
- **예시**: `sk-proj-...`
- **발급**: https://platform.openai.com/api-keys
- **⚠️ 주의**: 실제 유효한 키를 입력하세요
- [ ] 등록 완료

### SITEAI_API_KEY
- **설명**: Site AI Analysis API 키
- **예시**: `sk-proj-...`
- **⚠️ 주의**: 실제 유효한 키를 입력하세요
- [ ] 등록 완료

---

## 📝 등록 방법

1. GitHub 저장소로 이동
2. `Settings` 탭 클릭
3. 왼쪽 메뉴에서 `Secrets and variables` > `Actions` 클릭
4. `New repository secret` 버튼 클릭
5. Name과 Value를 입력하고 `Add secret` 클릭
6. 모든 Secret 등록 완료 후 이 체크리스트 확인

## ⚠️ 중요 주의사항

- **절대 Secret 값을 코드에 하드코딩하지 마세요**
- **Secret은 한 번 저장하면 다시 볼 수 없습니다** (수정만 가능)
- **API 키는 정기적으로 교체하세요**
- **SSH Private Key는 안전하게 보관하세요**
- **프로덕션 환경의 DB 비밀번호는 강력하게 설정하세요**

## ✅ 최종 확인

모든 Secret 등록 완료 후:

- [ ] 총 15개의 Secret이 등록되었는지 확인
- [ ] SSH Key가 서버의 `~/.ssh/authorized_keys`에 등록되었는지 확인
- [ ] 로컬에서 SSH 연결 테스트 성공
- [ ] `.env` 파일이 `.gitignore`에 포함되어 있는지 확인
- [ ] GitHub Actions workflow 파일이 올바른지 확인

---

## 🚀 다음 단계

모든 Secret 등록이 완료되면:

```bash
git add .
git commit -m "Setup CI/CD pipeline"
git push origin main
```

GitHub Actions의 `Actions` 탭에서 배포 진행 상황을 확인하세요!

---

## 🆘 문제 해결

### Secret을 잘못 입력한 경우
1. 해당 Secret 옆의 `Update` 버튼 클릭
2. 올바른 값으로 수정
3. `Update secret` 클릭

### SSH Key 관련 오류
- Private Key 전체 내용이 복사되었는지 확인
- 줄바꿈이 올바르게 포함되었는지 확인
- Public Key가 서버에 제대로 등록되었는지 확인

### API Key 오류
- 키가 유효한지 확인 (만료되지 않았는지)
- 키 앞뒤에 공백이 없는지 확인
- 따옴표를 포함하지 마세요 (값만 입력)

---

**마지막 업데이트**: 2026-02-13
