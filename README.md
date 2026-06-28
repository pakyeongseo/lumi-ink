# Lumi Ink v1.5

루미잉크는 메모, 로그, 페르소나, 캐릭터, 아이디어를 프로젝트별로 관리하는 로컬 우선 웹앱/PWA입니다.

## 현재 배포 기준

- 사용자 배포 버전: **v1.5**
- 개발 기준 빌드: **v66.13**
- 서비스 워커 캐시: `ink-memo-v1.5-v66.13-log-png-export`
- 상세 매뉴얼: `Lumi_Ink_Manual_1.html`
- 사용자 릴리스 노트: `Lumi_Ink_v1.5_Release_Notes.md`
- 현재 개발 변경 이력: `Lumi_Ink_v66.13_Release_Notes.md`

## 핵심 기능

- 자유 메모, HTML·JSON 원문 작업실, 로어북, 로그 저장, 페르소나·캐릭터, 아이디어 보드
- 프로젝트별 관리와 전체/프로젝트 백업·복원, 자동 백업
- 로그 디자인 템플릿 80종과 사용자 템플릿 업로드 · 이름 가림 디자인 5종 · 게시판용 PNG 내보내기
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

- `log-templates/` — 파일 템플릿 77종 + 내장 3종 = 기본 로그 템플릿 80종
- `idea-board-backgrounds/` — 기본 이미지 배경 19종
- `idea-board-templates.js`, `idea-board-custom-templates.css`

### 사용자·제작 문서

- `Lumi_Ink_Manual_1.html`
- `Lumi_Ink_v1.5_Release_Notes.md`
- `Lumi_Ink_v66.9_Release_Notes.md`, `Lumi_Ink_v66.12_Release_Notes.md`, `Lumi_Ink_v66.13_Release_Notes.md`
- `lumink-log-template-guide.md`, `lumink-log-templates-80.html`
- `idea-board-design-guide.md`, `idea-board-template-registry-guide.md`, `idea-divider-template-guide.md`
- `THIRD_PARTY_NOTICES.md`

## Third-party

- `html2canvas 1.4.1` (MIT) is bundled locally as `html2canvas.min.js` for Idea Board PNG capture.

## v66.12

- HTML 작업실에서 원문을 내려받을 때 **`.html` 또는 `.json` 확장자**를 직접 선택할 수 있습니다.
- JSON 원본으로 연 작업실은 `.json`을 기본 선택하며, 일반 HTML 작업실은 `.html`을 기본 선택합니다.
- `.json` 저장 전에는 JSON 문법을 검사합니다. 오류가 있으면 파일을 만들지 않고 오류 위치를 안내합니다.
- 작업실 상단의 **파일 저장** 버튼, 더보기 메뉴, `Ctrl/Cmd + Shift + S`가 같은 저장 선택 창을 엽니다. 기존 `Ctrl/Cmd + S`와 상단 디스켓은 앱 내부 저장만 수행합니다.

## v66.9

- 사이드바 `열기`에서 일반 `.json` 파일을 **코드 블록 메모** 또는 **원본 JSON 작업실**로 열 수 있도록 확장
- World Info·루미잉크 프로젝트 JSON은 기존 구조형 가져오기를 보존하면서, 내용 확인 경로도 함께 제공
- JSON 문법 오류 파일도 원문 점검용으로 열 수 있으며, 원본 편집 한도는 5MB

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


## v66.13

- 로그 이름 치환 디자인을 다섯 가지 **미리보기**만 한 줄로 비교하도록 정리했습니다.
- 로그 더보기 메뉴에 **꾸며진 PNG 이미지로 저장**을 추가했습니다. 520px·680px·840px 반응형 폭 중 하나를 고르면 앱 UI 없이 꾸며진 본문만 PNG로 내려받습니다.
