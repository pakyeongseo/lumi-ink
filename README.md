# Lumi Ink v63.45

루미잉크는 프로젝트 단위로 여러 종류의 메모를 관리하는 로컬 웹앱/PWA입니다. 이 배포본은 v63.44 정리본 이후 아이디어 보드에서 실제 사용 중 남아 있던 이벤트·잠금·색상·썸네일·스크린샷 문제를 보수한 버전입니다.

## 현재 버전

- 버전: v63.45
- 기준 빌드: `lumi-ink-v63.43-note-lock-handles-eyedropper`
- 서비스워커 캐시: `ink-memo-v63.45-idea-board-fixes`
- 상세 매뉴얼: `Lumi_Ink_Manual_1.html`
- 릴리즈 노트: `Lumi_Ink_v63.45_Release_Notes.md`

## 주요 기능

### 메모 타입

- 자유 메모
- HTML 작업실
- 통합 정보 카드
- 로그 저장 메모
- 아이디어 보드

### 로그 저장 메모

- 기본 제공 로그 템플릿 50종
- 사용자 템플릿 업로드
- 템플릿 검색, 정렬, 즐겨찾기
- 원본 이름·애칭 가림 처리
- 원본 편집 모드와 보기 모드 분리
- 인라인 스타일 HTML 복사 및 꾸며진 HTML 파일 내보내기
- 템플릿 소개 페이지와 템플릿 제작 가이드 포함

### 아이디어 보드

- 메모지, 이미지/GIF, 음악, 동영상, 첨부파일, 내 메모 링크, 빈 프레임, 구분선 조각 배치
- 조각 이동, 크기 조정, 회전, 복제, 삭제, 잠금
- 다중선택, 전체선택, 정렬, 간격 맞춤, 그룹화/그룹 해제
- 그룹화 시 잠금 조각 자동 제외
- 스냅 ON/OFF 및 보드별 스냅 상태 저장
- 메모지 리치 편집, 선택 영역 글자색·형광펜, 세로 중앙 맞춤
- 메모지 디자인, 컬러, 글자색 선택
- 메모지·이미지 좌우반전
- 음악 플레이어 라이트/다크 모드
- 이미지·음악·동영상·첨부파일·메모 링크 교체
- 보드 배경 템플릿, 컬러 캔버스, 제공 이미지 배경, 업로드 이미지 배경
- 보기 전용 모드
- 보기 모드에서 현재 작업 영역 PNG 스크린샷 저장, 실패 시 SVG 대체 저장
- 꾸며진 HTML 내보내기
  - 현재 보이는 화면만 표시
  - 전체 화면 표시
  - 두 방식 모두 복원용 전체 데이터 포함
- 아이디어 보드 HTML 불러오기

### 프로젝트 관리

- 프로젝트 단위 내보내기/불러오기
- 전체 백업/복원
- 자동 백업
- 프로젝트별 아이콘, 프레임, 색상, 썸네일
- 홈 프로젝트 고정 최대 4개

## 배포 패키지 구성

필수 실행 파일:

- `index.html`
- `app.js`
- `service-worker.js`
- `manifest*.json`
- `assets-icons.js`
- `assets-frames.js`
- `tokenizer.js`
- `log-templates.js`
- `log-templates/`
- `idea-board-templates.js`
- `idea-board-custom-templates.css`
- `idea-board-backgrounds/`
- `html2canvas.min.js` (아이디어 보드 PNG 캡처용)

문서·가이드:

- `Lumi_Ink_Manual_1.html`
- `Lumi_Ink_v63.45_Release_Notes.md`
- `Lumi_Ink_v63.46_Release_Notes.md`
- `Lumi_Ink_v64.1_Release_Notes.md`
- `Lumi_Ink_v64.2_Release_Notes.md`
- `lumink-log-template-guide.md`
- `lumink-log-templates-50.html`
- `idea-board-design-guide.md`
- `idea-board-template-registry-guide.md`
- `idea-divider-template-guide.md`

## v64.2 검수 기준

- JavaScript 문법 검사 통과
- 서비스워커 캐시 목록과 실제 파일 존재 여부 확인
- 새 메모 3탭 생성 경로와 빠른 자유 메모 경로 확인
- 자동 백업 보관 수 1–15 정규화 및 즉시 정리 경로 확인
- JavaScript 문법 검사 통과
- 서비스워커 캐시 목록과 실제 파일 존재 여부 확인
- manifest JSON 파싱 확인
- HTML 중복 ID 확인
- 다중선택 터치 fallback 확인
- 메모지 선택 글자색 적용 경로 확인
- 화면 DOM 직접 PNG 래스터화 경로 확인
- SVG 대체 저장 분기 제거 확인
- 그룹 이동·리사이즈 스냅 경로 확인



## Third-party

- `html2canvas 1.4.1` (MIT) is bundled locally as `html2canvas.min.js` for Idea Board PNG capture.
