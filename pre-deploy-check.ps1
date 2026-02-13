#!/usr/bin/env pwsh
# PowerShell 배포 전 검증 스크립트

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Algoriverse 배포 전 검증 시작" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$errors = 0
$warnings = 0

# 1. .gitignore 파일 확인
Write-Host "[1/10] .gitignore 파일 확인..." -ForegroundColor Yellow
if (Test-Path ".gitignore") {
    $gitignore = Get-Content ".gitignore" -Raw
    if ($gitignore -match "\.env" -and $gitignore -match "node_modules") {
        Write-Host "  ✓ .gitignore 파일 OK" -ForegroundColor Green
    } else {
        Write-Host "  ✗ .gitignore에 .env 또는 node_modules 누락" -ForegroundColor Red
        $errors++
    }
} else {
    Write-Host "  ✗ .gitignore 파일이 없습니다" -ForegroundColor Red
    $errors++
}

# 2. .env.example 파일 확인
Write-Host "[2/10] 환경변수 템플릿 파일 확인..." -ForegroundColor Yellow
if (Test-Path "backend\.env.example") {
    Write-Host "  ✓ backend/.env.example OK" -ForegroundColor Green
} else {
    Write-Host "  ✗ backend/.env.example 파일이 없습니다" -ForegroundColor Red
    $errors++
}

if (Test-Path "front\.env.example") {
    Write-Host "  ✓ front/.env.example OK" -ForegroundColor Green
} else {
    Write-Host "  ⚠ front/.env.example 파일이 없습니다" -ForegroundColor Yellow
    $warnings++
}

# 3. .env 파일이 Git에 포함되지 않았는지 확인
Write-Host "[3/10] .env 파일 Git 추적 확인..." -ForegroundColor Yellow
$trackedFiles = git ls-files
if ($trackedFiles -match "\.env$") {
    Write-Host "  ✗ .env 파일이 Git에 추적되고 있습니다!" -ForegroundColor Red
    Write-Host "    실행: git rm --cached backend/.env" -ForegroundColor Yellow
    $errors++
} else {
    Write-Host "  ✓ .env 파일이 Git에 추적되지 않음" -ForegroundColor Green
}

# 4. GitHub Actions workflow 파일 확인
Write-Host "[4/10] GitHub Actions workflow 확인..." -ForegroundColor Yellow
if (Test-Path ".github\workflows\deploy.yml") {
    Write-Host "  ✓ GitHub Actions workflow 파일 존재" -ForegroundColor Green
} else {
    Write-Host "  ✗ .github/workflows/deploy.yml 파일이 없습니다" -ForegroundColor Red
    $errors++
}

# 5. PM2 ecosystem 파일 확인
Write-Host "[5/10] PM2 설정 파일 확인..." -ForegroundColor Yellow
if (Test-Path "backend\ecosystem.config.js") {
    Write-Host "  ✓ PM2 ecosystem.config.js 존재" -ForegroundColor Green
} else {
    Write-Host "  ✗ backend/ecosystem.config.js 파일이 없습니다" -ForegroundColor Red
    $errors++
}

# 6. Nginx 설정 파일 확인
Write-Host "[6/10] Nginx 설정 파일 확인..." -ForegroundColor Yellow
if (Test-Path "nginx.conf") {
    Write-Host "  ✓ nginx.conf 존재" -ForegroundColor Green
} else {
    Write-Host "  ✗ nginx.conf 파일이 없습니다" -ForegroundColor Red
    $errors++
}

# 7. Health Check 엔드포인트 확인
Write-Host "[7/10] Health Check 엔드포인트 확인..." -ForegroundColor Yellow
if (Test-Path "backend\app.js") {
    $appJs = Get-Content "backend\app.js" -Raw
    if ($appJs -match "/health") {
        Write-Host "  ✓ Health Check 엔드포인트 존재" -ForegroundColor Green
    } else {
        Write-Host "  ✗ app.js에 /health 엔드포인트가 없습니다" -ForegroundColor Red
        $errors++
    }
} else {
    Write-Host "  ✗ backend/app.js 파일이 없습니다" -ForegroundColor Red
    $errors++
}

# 8. package.json 확인
Write-Host "[8/10] package.json 파일 확인..." -ForegroundColor Yellow
$packageJsonOk = $true
if (Test-Path "backend\package.json") {
    Write-Host "  ✓ backend/package.json 존재" -ForegroundColor Green
} else {
    Write-Host "  ✗ backend/package.json 파일이 없습니다" -ForegroundColor Red
    $errors++
    $packageJsonOk = $false
}

if (Test-Path "front\package.json") {
    Write-Host "  ✓ front/package.json 존재" -ForegroundColor Green
} else {
    Write-Host "  ✗ front/package.json 파일이 없습니다" -ForegroundColor Red
    $errors++
    $packageJsonOk = $false
}

# 9. Python requirements.txt 확인
Write-Host "[9/10] Python requirements.txt 확인..." -ForegroundColor Yellow
if (Test-Path "backend\bias_model\requirements.txt") {
    Write-Host "  ✓ requirements.txt 존재" -ForegroundColor Green
} else {
    Write-Host "  ⚠ backend/bias_model/requirements.txt 파일이 없습니다" -ForegroundColor Yellow
    $warnings++
}

# 10. 민감한 정보 확인
Write-Host "[10/10] 코드 내 민감한 정보 확인..." -ForegroundColor Yellow
$sensitivePatterns = @(
    "password\s*=\s*['\"](?!your_|example_)[^'\"]{6,}",
    "api_key\s*=\s*['\"](?!your_|example_|sk-proj-xxx)[^'\"]{20,}",
    "secret\s*=\s*['\"](?!your_|example_)[^'\"]{20,}"
)

$foundSensitive = $false
Get-ChildItem -Path . -Recurse -Include *.js,*.jsx,*.ts,*.tsx,*.py -Exclude node_modules,dist,build | ForEach-Object {
    $content = Get-Content $_.FullName -Raw -ErrorAction SilentlyContinue
    foreach ($pattern in $sensitivePatterns) {
        if ($content -match $pattern) {
            Write-Host "  ⚠ 민감한 정보 발견 가능: $($_.FullName)" -ForegroundColor Yellow
            $foundSensitive = $true
            $warnings++
        }
    }
}

if (-not $foundSensitive) {
    Write-Host "  ✓ 명백한 민감한 정보 없음" -ForegroundColor Green
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  검증 결과" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

if ($errors -eq 0 -and $warnings -eq 0) {
    Write-Host "✓ 모든 검사 통과! 배포 준비 완료" -ForegroundColor Green
    Write-Host ""
    Write-Host "다음 단계:" -ForegroundColor Cyan
    Write-Host "1. GitHub Secrets 등록 확인 (GITHUB_SECRETS_CHECKLIST.md 참고)" -ForegroundColor White
    Write-Host "2. git add . && git commit -m 'Setup CI/CD'" -ForegroundColor White
    Write-Host "3. git push origin main" -ForegroundColor White
    exit 0
} elseif ($errors -eq 0) {
    Write-Host "⚠ 경고 $warnings 개 발견 (배포 가능하지만 확인 필요)" -ForegroundColor Yellow
    Write-Host ""
    exit 0
} else {
    Write-Host "✗ 오류 $errors 개, 경고 $warnings 개 발견" -ForegroundColor Red
    Write-Host "위의 오류를 수정한 후 다시 실행하세요." -ForegroundColor Red
    Write-Host ""
    exit 1
}
