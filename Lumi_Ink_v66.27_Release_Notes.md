# 개발 빌드 v66.27 · 정규식 작업실 옵션 명칭 정리

- placement를 select에서 체크박스 그룹으로 변경하고 `사용자 입력`, `AI 출력`, `슬래시 명령`, `월드 인포`, `Reasoning`을 지원하도록 확장했습니다.
- SillyTavern placement 값은 참고 JSON 기준으로 `[1, 2, 3, 5, 6]`을 사용합니다.
- `disabled`, `runOnEdit`, `markdownOnly`, `promptOnly`, `substituteRegex`의 UI 명칭을 사용자가 보는 이름으로 정리했습니다.
- 새 정규식 작업실의 체크박스 기본값을 모두 비선택 상태로 변경했습니다.
- 서비스 워커 캐시명을 갱신해 모바일/PWA 환경에서 이번 수정본이 바로 반영되도록 했습니다.
