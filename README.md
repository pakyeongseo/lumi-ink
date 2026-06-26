# Lumi Ink v1.5

루미잉크는 프로젝트 단위로 여러 종류의 메모를 관리하는 로컬 웹앱/PWA입니다. 이 배포본의 사용자 버전은 **v1.5**이며, 기능 기준 개발 빌드는 **v64.5**입니다.

## 현재 버전

- 사용자 배포 버전: **v1.5**
- 개발 기준 빌드: `v64.5`
- 서비스워커 캐시: `ink-memo-v1.5-v64.5-color-restored`
- 상세 매뉴얼: `Lumi_Ink_Manual_1.html`
- 최신 사용자 릴리스 노트: `Lumi_Ink_v1.5_Release_Notes.md`
- 개발 변경 이력: `Lumi_Ink_v64.5_Release_Notes.md`

## 주요 기능

### 메모 타입

- 자유 메모
- HTML 작업실
- 로어북
- 로그 저장
- 페르소나 / 다인 페르소나
- 캐릭터 / 다인 캐릭터
- 아이디어 보드

### 새 메모 생성기

- 상단 **자유 메모** 빠른 생성 카드
- **캐릭터 / 작업실 / 아뜰리에** 3탭 분류
- 다인 형식까지 분리한 인물 카드 생성
- 기존 색감의 카드·아이콘 칩 배경을 유지하면서 타입 카드 폭을 동일하게 정렬

### 자동 백업

- 설정 → 자동 백업에서 스냅샷 목록을 먼저 표시
- 목록 하단의 **보관 설정**에서 보관 수 조절
- 최소 1개, 최대 15개, 기본 10개
- 보관 수를 줄일 때 가장 오래된 스냅샷부터 즉시 정리
- 병합 복원 또는 완전 교체 복원

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
- 단일 조각과 그룹 모두에 적용되는 스냅 ON/OFF 및 정렬 가이드
- 메모지 리치 편집, 선택 영역 글자색·형광펜, 세로 중앙 맞춤
- 직접 색상 선택과 스포이드
- 보드 배경 템플릿, 컬러 캔버스, 제공 이미지 배경, 업로드 이미지 배경
- 보기 전용 모드와 현재 작업 영역 PNG 저장
- 꾸며진 HTML 내보내기 및 아이디어 보드 HTML 불러오기

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
- `Lumi_Ink_v1.5_Release_Notes.md`
- `Lumi_Ink_v64.5_Release_Notes.md` (개발 변경 이력)
- `lumink-log-template-guide.md`
- `lumink-log-templates-50.html`
- `idea-board-design-guide.md`
- `idea-board-template-registry-guide.md`
- `idea-divider-template-guide.md`

## v1.5 문서 정합성 검수 기준

- 상세 매뉴얼의 사용자 버전(v1.5)과 개발 기준(v64.5) 분리 표기
- 새 메모 3탭 / 자유 메모 빠른 생성 / 기존 색감 카드·동일 폭 설명 반영
- 자동 백업 목록 우선 → 보관 설정 분리 동선 반영
- PNG 전용 저장, 스포이드, 다중선택, 그룹 스냅 안내 반영
- 현재 프로젝트 메모 섹션 순서와 고정 최대 4개 반영
- 매뉴얼 외부에 붙어 있던 변경 기록 제거 및 유효 HTML 문서 구조 확인
- 서비스워커 자산 목록과 실제 파일 존재 여부 확인

## Third-party

- `html2canvas 1.4.1` (MIT) is bundled locally as `html2canvas.min.js` for Idea Board PNG capture.
