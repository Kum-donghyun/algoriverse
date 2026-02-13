# Windows에서 SSH 키 생성 가이드

## 1. PowerShell에서 SSH 키 생성

```powershell
# PowerShell 관리자 권한으로 실행

# OpenSSH 클라이언트 설치 확인
Get-WindowsCapability -Online | Where-Object Name -like 'OpenSSH.Client*'

# 설치되어 있지 않다면 설치
Add-WindowsCapability -Online -Name OpenSSH.Client~~~~0.0.1.0

# SSH 키 생성 (GitHub Actions용)
ssh-keygen -t rsa -b 4096 -C "github-actions" -f $env:USERPROFILE\.ssh\github_actions

# 생성 완료 후 파일 위치:
# Private Key: C:\Users\YourUsername\.ssh\github_actions
# Public Key: C:\Users\YourUsername\.ssh\github_actions.pub
```

## 2. Public Key를 서버에 등록

### 방법 1: 직접 복사
```powershell
# Public Key 내용 출력
Get-Content $env:USERPROFILE\.ssh\github_actions.pub

# 출력된 내용을 복사하여 서버의 ~/.ssh/authorized_keys에 추가
```

### 방법 2: ssh-copy-id 사용 (WSL 필요)
```bash
# WSL에서 실행
ssh-copy-id -i ~/.ssh/github_actions.pub username@your-server-ip
```

## 3. Private Key를 GitHub Secrets에 등록

```powershell
# Private Key 내용 출력 (전체 복사)
Get-Content $env:USERPROFILE\.ssh\github_actions

# 출력된 내용을 GitHub Secrets의 NCP_SSH_KEY에 등록
# -----BEGIN OPENSSH PRIVATE KEY----- 부터
# -----END OPENSSH PRIVATE KEY----- 까지 전체 복사
```

## 4. 연결 테스트

```powershell
# SSH 연결 테스트
ssh -i $env:USERPROFILE\.ssh\github_actions username@your-server-ip

# 연결 성공 후 서버에서 확인
cat ~/.ssh/authorized_keys
```

## 5. JWT Secret 생성

### PowerShell에서 생성
```powershell
# 64자 랜덤 문자열 생성
-join ((48..57) + (65..90) + (97..122) | Get-Random -Count 64 | ForEach-Object {[char]$_})
```

### 또는 온라인 도구 사용
- https://www.grc.com/passwords.htm

## 6. 파일 권한 설정

```powershell
# SSH 키 파일 권한 설정 (보안 강화)
icacls $env:USERPROFILE\.ssh\github_actions /inheritance:r
icacls $env:USERPROFILE\.ssh\github_actions /grant:r "$env:USERNAME:(R)"
```

---

## 트러블슈팅

### "Permission denied (publickey)" 오류
1. Public Key가 서버의 `~/.ssh/authorized_keys`에 올바르게 등록되었는지 확인
2. 서버에서 파일 권한 확인:
   ```bash
   chmod 700 ~/.ssh
   chmod 600 ~/.ssh/authorized_keys
   ```

### SSH 연결이 안 되는 경우
```powershell
# 상세 디버그 모드로 연결 시도
ssh -vvv -i $env:USERPROFILE\.ssh\github_actions username@your-server-ip
```

### Windows에 OpenSSH가 없는 경우
- Git Bash 사용
- WSL (Windows Subsystem for Linux) 설치
- PuTTY 사용

---

## 참고사항

- SSH 키는 절대 공개하지 마세요
- Private Key는 안전한 곳에 백업하세요
- 정기적으로 키를 교체하는 것이 좋습니다
- 서버에 접속할 때마다 `-i` 옵션을 사용하기 싫다면 SSH config 파일을 설정하세요

### SSH Config 설정 (선택사항)
```powershell
# SSH config 파일 생성
New-Item -ItemType File -Path $env:USERPROFILE\.ssh\config -Force

# 내용 추가
@"
Host ncp-server
    HostName your-server-ip
    User ubuntu
    Port 22
    IdentityFile ~/.ssh/github_actions
"@ | Out-File -FilePath $env:USERPROFILE\.ssh\config -Encoding UTF8

# 이제 간단하게 접속 가능
ssh ncp-server
```
