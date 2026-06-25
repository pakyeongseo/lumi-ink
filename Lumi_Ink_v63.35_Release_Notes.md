# Lumi Ink v63.35 Release Notes

## 핵심 변경

- 아이디어 보드 배경 템플릿 5종을 추가했습니다.
  - 베르사유 벽지
  - 마녀의 숲
  - 요정의 반짝임
  - 마법소녀
  - 청춘 카드
- 아이디어 보드 메모지 템플릿 5종을 추가했습니다.
  - 베르사유 카드
  - 마녀의 약초지
  - 요정 반짝 메모
  - 마법소녀 카드
  - 청춘 카드
- 새 템플릿 CSS는 `idea-board-custom-templates.css`에 추가했습니다.
- 새 템플릿 레지스트리는 `idea-board-templates.js`의 `backgrounds`와 `noteStyles`에 등록했습니다.
- 새 CSS/JS가 즉시 갱신되도록 서비스워커 캐시명을 `ink-memo-v63.35-idea-board-5themes`로 변경했습니다.

## 검수 항목

- `node --check app.js` 통과
- `node --check idea-board-templates.js` 통과
- 새 배경 5종과 CSS 선택자 매칭 확인
- 새 메모지 5종과 CSS 선택자 매칭 확인
- manifest JSON 11개 파싱 확인
- 서비스워커 자산 124개 존재 확인
- HTML 중복 ID 없음
- CSS 중괄호 균형 확인
