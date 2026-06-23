# Lumi Ink 아이디어 보드 디자인 제작 가이드

이 문서는 **아이디어 보드 배경과 포스트잇 외형을 추가하는 디자이너·AI용 명세**입니다.  
이제 앱 본체인 `app.js`나 `index.html`을 수정하지 않습니다. 새 디자인은 아래 두 파일만 다룹니다.

| 파일 | 역할 |
|---|---|
| `idea-board-templates.js` | 선택 라이브러리에 보일 키·이름·설명 등록 |
| `idea-board-custom-templates.css` | 실제 배경·포스트잇 CSS |

현재 선택 창은 실제 질감을 축소 렌더링하므로, 등록한 CSS가 그대로 썸네일에도 반영됩니다.

---

## 1. 절대 규칙

- JavaScript 이벤트, 저장, 이동, 리사이즈, 회전 로직을 수정하지 않습니다.
- **키는 영문으로 시작하는 camelCase 또는 kebab-case 1~48자**만 사용합니다. 예: `occultCork`, `star-paper`
- 외부 이미지·외부 폰트·외부 CSS·JavaScript 의존은 쓰지 않습니다.
- 장식용 `::before`, `::after`는 반드시 `pointer-events:none`입니다.
- `.idea-item`의 `position`, `left`, `top`, `width`, `height`, `transform`, `touch-action`, `z-index`를 변경하지 않습니다.
- 배경은 조각의 가독성을 침범하지 않아야 하고, 포스트잇은 최소 크기 `110×54px`과 긴 텍스트에서도 읽혀야 합니다.

---

## 2. 보드 배경 추가

### 2-1. 등록 — `idea-board-templates.js`

```js
backgrounds: {
  // 기존 항목 아래에 추가
  occultCork: {
    label: "오컬트 코르크",
    desc: "낡은 코르크와 잉크 얼룩의 조사 보드"
  }
}
```

### 2-2. 스타일 — `idea-board-custom-templates.css`

```css
.idea-canvas[data-background="occultCork"] {
  background-color: #32271f;
  background-image:
    radial-gradient(circle at 18% 20%, rgba(217,184,118,.11), transparent 28%),
    repeating-linear-gradient(12deg, rgba(255,255,255,.025) 0 1px, transparent 1px 8px),
    repeating-linear-gradient(78deg, rgba(0,0,0,.055) 0 1px, transparent 1px 11px);
}

.idea-canvas[data-background="occultCork"] .idea-canvas-empty {
  color: rgba(239,222,180,.70);
}
```

### 2-3. 배경 허용 속성

- `background-color`, `background-image`, `background-size`, `background-position`, `background-blend-mode`
- 빈 보드 안내문을 위한 `.idea-canvas-empty`의 `color`
- gradient는 4겹 이하 권장

**금지:** `position`, `overflow`, `transform`, `z-index`, `pointer-events`, `width`, `height`

---

## 3. 포스트잇 디자인 추가

### 3-1. 등록 — `idea-board-templates.js`

```js
noteStyles: {
  // 기존 항목 아래에 추가
  starPaper: {
    label: "별 종이",
    desc: "별가루가 묻은 작은 마법 메모"
  }
}
```

### 3-2. 스타일 — `idea-board-custom-templates.css`

```css
.idea-sticky[data-note-style="starPaper"] {
  background:
    radial-gradient(circle at 18% 18%, rgba(255,255,255,.55) 0 1px, transparent 1.6px),
    linear-gradient(150deg, var(--stick-1), color-mix(in srgb, var(--stick-1) 72%, white));
  background-size: 17px 17px, auto;
  border: 1px solid color-mix(in srgb, var(--stick-2) 56%, white);
  border-radius: 13px 4px 13px 4px;
  box-shadow: 0 13px 24px rgba(35,30,12,.20), inset 0 1px 0 rgba(255,255,255,.42);
}
.idea-sticky[data-note-style="starPaper"]::before {
  content: "✦";
  position: absolute;
  right: 10px;
  top: 8px;
  color: color-mix(in srgb, var(--stick-ink) 36%, white);
  font-size: 14px;
  pointer-events: none;
}
.idea-sticky[data-note-style="starPaper"] .idea-note-text {
  color: var(--stick-ink);
  padding: 22px 16px 16px;
}
```

### 3-3. 포스트잇 색상 변수

| 변수 | 쓰임 |
|---|---|
| `--stick-1` | 기본 종이색 |
| `--stick-2` | 테두리·테이프·포인트 |
| `--stick-ink` | 텍스트 색 |

`yellow`, `pink`, `lime`, `blue`, `purple`의 다섯 색이 자동으로 들어옵니다. 새 포스트잇은 위 세 변수를 사용해야 색상 변경 기능을 그대로 얻습니다.

**금지:** `position`, `width`, `height`, `transform`, `touch-action`, `z-index`, `overflow` / 장식의 `pointer-events:auto`

---

## 4. AI에게 보낼 프롬프트

```text
루미잉크 아이디어 보드에 추가할 {보드 배경 / 포스트잇} CSS를 만들어줘.

[무드]
- {세계관·소재·감정선을 구체적으로 적기}

[등록 키]
- {예: occultCork 또는 starPaper}

[제출 순서]
1) idea-board-templates.js에 넣을 backgrounds 또는 noteStyles 등록 객체 한 줄
2) idea-board-custom-templates.css에 넣을 CSS만 출력

[공통 규칙]
- 외부 이미지·폰트·JS 금지. CSS gradient, border, shadow만 사용.
- position, width, height, transform, touch-action, z-index, overflow는 선언하지 말 것.
- ::before/::after는 pointer-events:none.
- 배경은 4겹 이하의 background 레이어 권장.
- 포스트잇은 --stick-1, --stick-2, --stick-ink를 사용해 5색에 자동 대응.
- 최소 크기 110×54px, 긴 본문, 회전·리사이즈에서도 읽히게 만들 것.
- label은 14자 이내, desc는 45자 이내의 한국어로 작성.
```

---

## 5. 추가 전 30초 점검

1. 등록 키와 CSS의 `data-background` 또는 `data-note-style` 키가 완전히 같은가?
2. CSS 파일을 `idea-board-custom-templates.css`에 추가했는가?
3. 앱을 다시 열거나 새로고침해 서비스 워커의 새 캐시를 받았는가?
4. 배경에서 이미지·영상·다섯 포스트잇 색이 모두 읽히는가?
5. 포스트잇에서 길게 누르기 이동, 회전·리사이즈, 텍스트 입력이 모두 되는가?
