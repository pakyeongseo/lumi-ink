# Lumi Ink v1.5

루미잉크는 메모, 로그, 페르소나, 캐릭터, 아이디어를 프로젝트별로 관리하는 로컬 우선 웹앱/PWA입니다.

## 현재 배포 기준

- 사용자 배포 버전: **v1.5**
- 개발 기준 빌드: **v66.8**
- 서비스 워커 캐시: `ink-memo-v1.5-v66.8-appjs-divider-palette`
- 상세 매뉴얼: `Lumi_Ink_Manual_1.html`
- 사용자 릴리스 노트: `Lumi_Ink_v1.5_Release_Notes.md`
- 현재 개발 변경 이력: `Lumi_Ink_v66.8_Release_Notes.md`

## 핵심 기능

- 자유 메모, HTML 작업실, 로어북, 로그 저장, 페르소나·캐릭터, 아이디어 보드
- 프로젝트별 관리와 전체/프로젝트 백업·복원, 자동 백업
- 로그 디자인 템플릿 50종과 사용자 템플릿 업로드
- 아이디어 보드 이미지 배경, PNG 캡처, HTML 내보내기
- 10종 PWA 설치 아이콘과 설치 간판 페이지
- 오른쪽 엣지 퀵메뉴, 사용자 지정 아이콘, 기능 바로가기
- 프리셋과 독립된 라이트/다크 사용자 지정 컬러 테마

## 배포 패키지 구성

### 실행·PWA 파일

- `index.html`, `app.js`, `service-worker.js`
- `assets-icons.js`, `assets-frames.js`, `quickmenu-icon-library.js`
- `log-templates.js`, `tokenizer.js`, `html2canvas.min.js`
- `manifest*.json`, `icon-*.png`
- `lumi-ink-get-started.html`, `install-*.html`

### 콘텐츠 자산

- `log-templates/` — 기본 로그 템플릿 50종
- `idea-board-backgrounds/` — 기본 이미지 배경 19종
- `idea-board-templates.js`, `idea-board-custom-templates.css`

### 사용자·제작 문서

- `Lumi_Ink_Manual_1.html`
- `Lumi_Ink_v1.5_Release_Notes.md`
- `Lumi_Ink_v66.8_Release_Notes.md`
- `lumink-log-template-guide.md`, `lumink-log-templates-50.html`
- `idea-board-design-guide.md`, `idea-board-template-registry-guide.md`, `idea-divider-template-guide.md`
- `THIRD_PARTY_NOTICES.md`

## Third-party

- `html2canvas 1.4.1` (MIT) is bundled locally as `html2canvas.min.js` for Idea Board PNG capture.

## v66.8

- 사용자 제공 개선 `app.js`를 반영하고 SVG 참조 재매핑·테마 역할 자동 계산을 동기화
- 메모 타입 7종 자동 팔레트는 라이트에서 기존 다크 추천의 선명도를 사용하고, 다크에서는 한 단계 더 밝게 파생

## v66.7

- 사용자 지정 테마의 누락 역할 5종을 편집·추천·JSON 백업 흐름까지 연결
- 퀵메뉴 기본 기능 아이콘 타일과 7개 메모 타입 팔레트를 메인 그라데이션 기반 자동 파생으로 전환

## v66.6

- 새 v2 퀵메뉴 아이콘 70종을 런타임 테마 토큰 기반으로 반영
- 퀵메뉴 최대 7슬롯, 로그 보기 본문 더블클릭/더블터치 편집 전환
- 사용자 지정 테마에 메모 타입 구분자 4종 색상 역할 추가
