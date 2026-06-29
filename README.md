# Lumi Ink v1.5

루미잉크는 메모, 로그, 페르소나, 캐릭터, 아이디어를 프로젝트별로 관리하는 로컬 우선 웹앱/PWA입니다.

## 현재 배포 기준

- 사용자 배포 버전: **v1.5**
- 개발 기준 빌드: **v66.35**
- 서비스 워커 캐시: `ink-memo-v1.5-v66.35-regex-micro-options-idea-quote-links`
- 상세 매뉴얼: `Lumi_Ink_Manual_1.html`
- 사용자 릴리스 노트: `Lumi_Ink_v1.5_Release_Notes.md`
- 현재 개발 변경 이력: `Lumi_Ink_v66.35_Release_Notes.md`

## 핵심 기능

- 자유 메모, HTML·JSON·Markdown 원문을 통합하는 코드 작업실, 로어북, 로그 저장, 페르소나·캐릭터, 아이디어 보드
- 프로젝트별 관리와 전체/프로젝트 백업·복원, 자동 백업
- 로그 디자인 템플릿 100종과 사용자 템플릿 업로드 · 이름 가림 디자인 5종 · 게시판용 PNG 내보내기
- 사이드바 **열기**는 Android 파일 선택기에서 모든 파일을 표시하고, 앱 안에서 HTML · JSON · Markdown · 일반 텍스트를 판별합니다. Markdown은 코드 작업실에서 렌더링 미리보기로 확인할 수 있습니다.
- 사이드바 열기에서 일반 JSON 원문을 메모 또는 코드 작업실로 안전하게 열기
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

- `log-templates/` — 파일 템플릿 97종 + 내장 3종 = 기본 로그 템플릿 100종
- `idea-board-backgrounds/` — 기본 이미지 배경 19종
- `idea-board-templates.js`, `idea-board-custom-templates.css`

### 사용자·제작 문서

- `Lumi_Ink_Manual_1.html`
- `Lumi_Ink_v1.5_Release_Notes.md`
- `Lumi_Ink_v66.9_Release_Notes.md`, `Lumi_Ink_v66.12_Release_Notes.md`, `Lumi_Ink_v66.13_Release_Notes.md`, `Lumi_Ink_v66.15_Release_Notes.md`, `Lumi_Ink_v66.16_Release_Notes.md`, `Lumi_Ink_v66.17_Release_Notes.md`, `Lumi_Ink_v66.18_Release_Notes.md`, `Lumi_Ink_v66.19_Release_Notes.md`, `Lumi_Ink_v66.20_Release_Notes.md`, `Lumi_Ink_v66.21_Release_Notes.md`, `Lumi_Ink_v66.24_Release_Notes.md`~`Lumi_Ink_v66.35_Release_Notes.md`
- `lumink-log-template-guide.md`, `lumink-log-templates-100.html`
- `idea-board-design-guide.md`, `idea-board-template-registry-guide.md`, `idea-divider-template-guide.md`
- `THIRD_PARTY_NOTICES.md`

## Third-party

- `html2canvas 1.4.1` (MIT) is bundled locally as `html2canvas.min.js` for Idea Board PNG capture.

## v66.35

- 정규식 작업실의 옵션 소제목 및 검증 상태를 초소형 위계로 정리했습니다.
- 하단 옵션을 `그 외 옵션`과 `Ephemerality` 두 묶음으로 분리했습니다.
- 자유 메모의 내 글 바로가기 디자인을 아이디어 보드 메모 인용 링크와 통일했습니다.

## v66.34

- 자유 메모의 구분선은 화면·본문 폭에 맞춰 100% 유동 폭으로 표시됩니다.
- 자유 메모의 **내 글 바로가기**는 버튼형 디자인으로 삽입되며, 메모 선택 뒤 테마 팔레트 또는 직접 색상으로 버튼 컬러를 고를 수 있습니다.

## v66.32

- 정규식 작업실의 IN 입력 영역은 한 줄 정규식에 맞춰 더 얕게, OUT은 조금 더 여유 있게, Sample은 검증용 본문처럼 더 넓게 조정했습니다.
- 내보내기 옵션의 소제목 칩은 기존 대비 약 60% 크기로 더 작고 가볍게 정리했습니다.
- 자유 메모의 **구분선**은 아이디어 보드와 같은 32종 디자인, 1~12px 굵기, 테마 팔레트·직접 색상 선택을 거쳐 삽입합니다.
- 자유 메모의 **내 글 바로가기** 선택기는 아이디어 보드 메모 링크 선택기와 같은 전체보기/프로젝트별 탭, 프로젝트 썸네일, 검색 결과 카드 구조로 통일했습니다.

## v66.31

- 정규식 작업실의 옵션 라벨을 현재 설계 기준으로 정리했습니다: `Export options`, `영향을 미침`, `Ephemerality`. `Ephemerality` 아래에는 형식 표시·형식 프롬프트 관련 옵션이 함께 배치됩니다.

## v66.30

- 정규식 PREVIEW의 샌드박스가 앱의 뒤로가기·사이드바·퀵메뉴 제스처를 가로막지 않도록 확인 전용 입력 처리로 분리했습니다. 단일 정상 결과 표기는 **매치**로 간결하게 바꿨고, 옵션 제목은 작은 칩 형태로 정리했습니다.
- 사용자 지정 테마의 **옅은 강조·선택 배경**이 퀵메뉴 기본 아이콘 첫 그라데이션과 패널 하단 그라데이션까지 제어합니다.
- 자유 메모 툴바의 첨부파일 오른쪽 `＋`에서 **내 글 바로가기**와 **구분선**을 삽입합니다. 내 글 바로가기는 다른 메모를 검색해 연결하고, 읽기 화면에서 연결 대상을 바로 엽니다.

## v66.29

- 정규식 작업실의 보기 전환 탭 배경을 투명하게 정리하고, 검증·매치·오류 상태 문구를 더 작은 보조 정보로 조정했습니다.
- 내보내기 옵션은 트림아웃, 플레이스먼트, 최소/최대 깊이, 다른 옵션·Macros 순서로 재배치했습니다.
- 상세 매뉴얼에 정규식 작업실의 생성·가져오기·미리보기·옵션·JSON 내보내기 흐름을 추가했습니다.

## v66.21

- 코드 작업실에서 Markdown 원문을 열면 PREVIEW·SPLIT 보기에서 제목, 목록, 인용문, 체크리스트, 표, 코드 블록, 링크, 이미지를 렌더링한 문서로 확인합니다.
- Markdown의 HTML 태그와 스크립트는 실행하지 않으며, 원문 편집·`.md` 내보내기는 그대로 유지합니다.
- Markdown 형식을 선택해 파일로 저장할 때 실제로 `.md` 확장자와 `text/markdown` MIME을 사용하도록 저장 분기를 보정했습니다.

## v66.20

- 사용자 지정 컬러 테마의 **메인 화면 섹션 제목·정렬 글자** 역할을 하나로 묶었습니다.
- 홈 화면과 프로젝트 내부 화면의 정렬 버튼은 이제 같은 `--home-section-title-color`를 사용하며, 글자와 정렬 아이콘이 함께 바뀝니다.

## v66.19

- 기존 **HTML 작업실**을 **코드 작업실**로 이름을 바꾸고, HTML · JSON · Markdown 원문을 하나의 편집 화면에서 보관·수정·내보낼 수 있게 통합했습니다.
- `.md`, `.markdown`, `.mdown`, `.mkdn`, `.mkd` 파일은 코드 작업실에서 바로 열리며 원문 공백과 줄바꿈을 유지합니다.
- 파일 저장에서 `.html` · `.json` · `.md`를 고를 수 있습니다. JSON 저장만 문법 검사를 수행합니다.
- HTML은 기존 샌드박스 미리보기·웹페이지 새 창 열기를 유지하고, JSON·Markdown은 실행하지 않는 원문 보기로 안전하게 표시합니다.

## v66.18

- 사용자 지정 컬러 테마에 **옅은 강조·선택 배경** 색상 역할을 추가했습니다.
- 이 한 색상이 선택된 글자 크기, 자유 메모 코드 보기 아이콘, 새 메모의 빠른 생성·타입 아이콘, 섹션·카운트·태그·칩·탭·활성 버튼 및 아이디어 보드의 선택 강조처럼 `--accent-soft`를 쓰는 모든 공통 UI에 적용됩니다.
- 이전 사용자 테마는 기존의 작은 섹션 제목 배경 값을 자동 승계해, 갑작스러운 색 변화 없이 새 공통 역할로 마이그레이션합니다.

## v66.12

- 코드 작업실에서 HTML·JSON·Markdown 원문을 열고, **`.html` · `.json` · `.md` 확장자**를 직접 선택해 저장할 수 있습니다.
- JSON 원본으로 연 코드 작업실은 `.json`, Markdown 원본은 `.md`, 일반 HTML 원본은 `.html`을 기본 선택합니다.
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
