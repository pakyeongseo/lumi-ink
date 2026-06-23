# 아이디어 보드 템플릿 등록 빠른 안내

## 딱 두 곳만 수정합니다

1. `idea-board-templates.js` — 이름을 등록합니다.  
2. `idea-board-custom-templates.css` — 같은 키로 모양을 만듭니다.

앱의 저장·드래그·리사이즈 코드는 수정하지 않습니다.

## 배경 1개 추가 예시

```js
// idea-board-templates.js > backgrounds 안
museumWall: { label: "뮤지엄 월", desc: "아이보리 벽면과 전시 라벨의 조용한 보드" }
```

```css
/* idea-board-custom-templates.css */
.idea-canvas[data-background="museumWall"] {
  background-color: #e7e1d5;
  background-image: linear-gradient(90deg, rgba(0,0,0,.025) 1px, transparent 1px);
  background-size: 42px 42px;
}
```

## 포스트잇 1개 추가 예시

```js
// idea-board-templates.js > noteStyles 안
museumLabel: { label: "전시 라벨", desc: "번호와 작은 캡션이 어울리는 정갈한 메모" }
```

```css
/* idea-board-custom-templates.css */
.idea-sticky[data-note-style="museumLabel"] {
  background: linear-gradient(160deg, #fffdfa, var(--stick-1));
  border: 1px solid color-mix(in srgb, var(--stick-2) 58%, white);
  border-radius: 4px;
  box-shadow: 0 10px 20px rgba(40,34,20,.16);
}
.idea-sticky[data-note-style="museumLabel"] .idea-note-text {
  color: var(--stick-ink);
  padding: 18px 16px;
}
```

## 즉시 확인할 것

- 키가 정확히 일치하는가?
- 배경/포스트잇 선택 창에 썸네일이 보이는가?
- 포스트잇의 다섯 색을 바꿔도 읽히는가?
- 길게 눌러 이동하고, 회전·크기 조절이 가능한가?

상세 규칙과 AI 프롬프트는 `idea-board-design-guide.md`를 참고하세요.
