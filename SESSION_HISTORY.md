# Project Session History - 2026-01-24

## 📝 1. 프로젝트 요약
- **명칭**: 3D FPS Survival Mini-Game
- **기술 스택**: Vite, React, TypeScript, Three.js, TailwindCSS
- **작업 목적**: 로컬 서버 구동 및 GitHub 리포지토리 푸시/GitHub Pages 배포 설정

## 🚀 2. 주요 작업 내용

### ✅ 의존성 설치 (Dependency Installation)
- 네트워크 드라이브(`\\192.168.0.225`) 환경의 보안 정책 문제로 일반 `npm install` 실패.
- `powershell -ExecutionPolicy Bypass -Command "npm install --ignore-scripts"` 명령어를 통해 성공적으로 설치 완료.

### ✅ GitHub 연동 및 푸시
- **리포지토리**: `https://github.com/emineum/mini_valo_count.git`
- **사용자**: `sangigji163@gmail.com` / `Sangik Ji`
- **조치**: 
    1. 로컬 저장소 초기화 (`git init`)
    2. 원격 저장소 연결 (`git remote add origin`)
    3. 전체 코드 커밋 및 `main` 브랜치 푸시 완료.

### ✅ GitHub Pages 배포 자동화 설정
- **Vite 설정**: `vite.config.ts` 파일에 `base: '/mini_valo_count/'` 추가.
- **CI/CD**: `.github/workflows/deploy.yml` 파일을 생성하여 GitHub Actions를 통한 자동 빌드 및 배포 설정 완료.

## ⚠️ 3. 현재 이슈 및 다음 단계

### 🌐 GitHub Pages 404 에러
- **현상**: `https://emineum.github.io/mini_valo_count/` 접속 시 404 코드 발생.
- **원인**: 푸시 직후 GitHub Actions가 빌드 및 배포 작업을 수행하는 데 약 2~3분이 소요됩니다.
- **해결**: GitHub 리포지토리의 `Actions` 탭에서 작업이 완료되었는지 확인 후 재접속 필요.

### 🏠 로컬 서버 접속
- **주소**: `http://192.168.0.110:3000`
- **실행 명령어**: `npm run dev -- --host`
- **참고**: 네트워크 환경에 따라 외부 기기 접속 시 방화벽 확인이 필요할 수 있음.

---
*이 파일은 이후 작업 시 참고를 위해 생성되었으며, 프로젝트 루트에 보관됩니다.*
