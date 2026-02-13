#!/bin/bash

# Algoriverse 배포 스크립트
# 사용법: ./deploy.sh

set -e  # 에러 발생 시 스크립트 중단

echo "=========================================="
echo "Algoriverse Deployment Starting..."
echo "=========================================="

# 1. 변수 설정
PROJECT_DIR="/home/$(whoami)/algoriverse"
BACKUP_DIR="/home/$(whoami)/backups"
DATE=$(date +"%Y%m%d_%H%M%S")

# 2. 백업 디렉토리 생성
mkdir -p $BACKUP_DIR

# 3. 현재 버전 백업
echo "Creating backup..."
if [ -d "$PROJECT_DIR" ]; then
    tar -czf "$BACKUP_DIR/algoriverse_$DATE.tar.gz" -C "$PROJECT_DIR" . 2>/dev/null || true
    echo "Backup created: algoriverse_$DATE.tar.gz"
fi

# 4. 프로젝트 디렉토리로 이동
cd $PROJECT_DIR

# 5. Frontend 빌드
echo "Building Frontend..."
cd front
npm ci
npm run build
cd ..

# 6. Backend 의존성 설치
echo "Installing Backend dependencies..."
cd backend
npm ci --production

# 7. Python 의존성 설치
echo "Installing Python dependencies..."
cd bias_model
pip install -r requirements.txt
cd ..

# 8. PM2로 Backend 재시작
echo "Restarting Backend with PM2..."
pm2 reload ecosystem.config.js --env production
pm2 save

# 9. Nginx 재시작
echo "Reloading Nginx..."
sudo nginx -t && sudo systemctl reload nginx

# 10. 상태 확인
echo "Checking application status..."
pm2 list
sudo systemctl status nginx

# 11. 오래된 백업 삭제 (30일 이상)
echo "Cleaning up old backups..."
find $BACKUP_DIR -name "algoriverse_*.tar.gz" -mtime +30 -delete

echo "=========================================="
echo "Deployment completed successfully!"
echo "=========================================="

# 12. Health Check
sleep 5
echo "Performing health check..."
if curl -f http://localhost:5000/health > /dev/null 2>&1; then
    echo "✓ Backend is healthy"
else
    echo "✗ Backend health check failed"
    exit 1
fi

echo "All checks passed!"
