# Lumi Ink 아이디어 보드 디자인 제작 가이드

이 문서는 **루미잉크 아이디어 보드에 새 보드 배경과 포스트잇 외형을 추가하기 위해 AI에게 전달하는 제작 명세**입니다.  
목표는 기능을 건드리지 않고, 배경·재질·색·장식만 교체하는 것입니다.

---

## 0. 절대 규칙

- 결과물은 **CSS와 등록용 설정 객체만** 작성합니다. JavaScript 이벤트, 드래그, 저장, 리사이즈 로직은 수정하지 않습니다.
- `.idea-item`의 `position`, `left`, `top`, `width`, `height`, `transform`, `touch-action`, `z-index`를 덮어쓰지 않습니다.
- 장식용 `::before`, `::after`는 반드시 `pointer-events:none`입니다.
- 조각의 선택 테두리, 회전 핸들, 리사이즈 핸들, 길게 누르기 이동을 가리지 않습니다.
- 외부 이미지, 외부 폰트, JavaScript, SVG 파일 의존 없이 CSS만 사용합니다.
- 다크/라이트 앱 테마와 무관하게 보드 조각의 텍스트와 조작 버튼이 읽혀야 합니다.
- 긴 텍스트, 좁아진 포스트잇, 180도 회전, 110×54px 최소 크기에서도 레이아웃이 깨지지 않아야 합니다.

---

# A. 보드 배경 템플릿

## A-1. 구조 계약

보드 배경은 아래 요소 하나에만 적용합니다.

```css
.idea-canvas[data-background="YOUR_KEY"] { /* 새 배경 */ }
```

등록 키는 `app.js`의 `IDEA_BG_TEMPLATES`에 아래 규격으로 한 줄 추가합니다.

```js
YOUR_KEY: {
  label: "사용자에게 보이는 이름",
  desc: "선택 팝업에 보일 한 줄 설명"
}
```

### 허용되는 디자인 수단

- `background-color`
- 여러 겹의 `background-image` (linear/radial/repeating gradient)
- `background-size`, `background-position`, `background-blend-mode`
- 색감, 종이결, 격자, 별자리, 코르크판, 도면, 패브릭 등의 **비상호작용 장식**

### 금지되는 변경

```css
/* 금지: 캔버스 크기, 스크롤, 드래그 레이어를 바꾸면 안 됩니다. */
.idea-canvas[data-background="YOUR_KEY"] {
  position: fixed;      /* 금지 */
  overflow: auto;       /* 금지 */
  transform: ...;       /* 금지 */
  z-index: ...;         /* 금지 */
  pointer-events: ...;  /* 금지 */
}
```

## A-2. AI에게 그대로 보낼 프롬프트

```text
루미잉크 아이디어 보드용 새 배경 CSS를 만들어줘.

[세계관/무드]
- {예: 빗물에 젖은 마도서 연구실의 코르크 보드}

[배경 키]
- {예: occult-cork}

[규칙]
- 결과는 CSS 한 블록과 IDEA_BG_TEMPLATES 등록 객체 한 줄만 출력해.
- 선택자는 반드시 .idea-canvas[data-background="{키}"] 하나를 사용해.
- CSS gradient만 사용하고 외부 이미지·폰트·JS는 금지.
- position, overflow, transform, z-index, pointer-events, width, height는 선언하지 마.
- 조각 위에서 이동·회전·리사이즈가 되어야 하므로 상호작용 요소를 만들지 마.
- 바탕은 너무 밝거나 복잡하지 않게, 이미지·포스트잇·영상이 전면에서 읽히도록 설계해.
- 한 번에 4겹 이하의 배경 레이어로 성능을 고려해.
- 설명은 선택 팝업에 들어갈 35자 이내 한국어 한 줄로 써.
```

## A-3. 검수 체크

- 포스트잇 5색이 모두 배경과 구분되는가?
- 이미지의 투명 PNG와 어두운 영상이 묻히지 않는가?
- CSS가 캔버스의 스크롤 크기와 선택 핸들을 건드리지 않는가?
- 모바일 화면에서 패턴이 과하게 깜빡이거나 눈부시지 않는가?

---

# B. 포스트잇 디자인 템플릿

## B-1. 구조 계약

포스트잇 스타일은 아래 선택자로만 추가합니다.

```css
.idea-sticky[data-note-style="YOUR_STYLE"] { /* 바탕과 그림자 */ }
.idea-sticky[data-note-style="YOUR_STYLE"]::before { /* 장식: 선택 */ }
.idea-sticky[data-note-style="YOUR_STYLE"]::after { /* 장식: 선택 */ }
.idea-sticky[data-note-style="YOUR_STYLE"] .idea-note-text { /* 글 여백·글자색 */ }
```

등록 키는 `app.js`의 `IDEA_NOTE_TEMPLATES`에 아래 규격으로 추가합니다.

```js
YOUR_STYLE: {
  label: "사용자에게 보이는 디자인 이름",
  desc: "선택 팝업에 보일 한 줄 설명"
}
```

색상은 이미 아래 CSS 변수로 제공됩니다.

| 변수 | 용도 |
|---|---|
| `--stick-1` | 주 배경색 |
| `--stick-2` | 포인트·테이프·테두리 색 |
| `--stick-ink` | 본문 글자색 |

기본 색상 키는 `yellow`, `pink`, `lime`, `blue`, `purple`입니다. 새 디자인은 이 5색을 그대로 재사용해야 합니다. 새 색을 만들 때만 `IDEA_NOTE_COLORS`와 색상 CSS를 함께 확장합니다.

### 금지되는 변경

```css
/* 금지: 실제 위치·크기·회전과 편집 기능을 막으면 안 됩니다. */
.idea-sticky[data-note-style="YOUR_STYLE"] {
  position: relative;  /* 선언하지 않기 */
  width: 300px;        /* 금지 */
  height: 200px;       /* 금지 */
  transform: rotate(); /* 금지 */
  overflow: visible;   /* 금지: 텍스트 영역을 망가뜨릴 수 있음 */
}
.idea-sticky[data-note-style="YOUR_STYLE"]::before {
  pointer-events: auto; /* 금지 */
}
```

## B-2. AI에게 그대로 보낼 프롬프트

```text
루미잉크 아이디어 보드용 새 포스트잇 디자인 CSS를 만들어줘.

[세계관/무드]
- {예: 마법소녀가 색연필로 붙여 둔 별 모양 메모}

[스타일 키]
- {예: star-paper}

[규칙]
- 결과는 CSS 블록과 IDEA_NOTE_TEMPLATES 등록 객체 한 줄만 출력해.
- 선택자는 .idea-sticky[data-note-style="{키}"] 및 그 내부 .idea-note-text만 사용해.
- 색은 반드시 --stick-1, --stick-2, --stick-ink 변수를 사용해 5가지 기본 컬러에 자동 대응하게 해.
- ::before/::after 장식은 pointer-events:none으로 작성해.
- position, width, height, transform, touch-action, z-index를 선언하지 마.
- 텍스트 영역은 반드시 width:100%, height:100%를 유지하고, 편집과 스크롤을 가리지 마.
- 최소 크기 110×54px과 긴 글에서도 내용을 가리지 않게 해.
- 외부 이미지·폰트·JS는 금지. CSS gradient, border, shadow만 사용해.
- 선택 핸들과 회전 핸들이 포스트잇 위에 표시될 수 있도록 상단 바깥 장식을 과하게 확장하지 마.
- 설명은 선택 팝업에 들어갈 35자 이내 한국어 한 줄로 써.
```

## B-3. 추천 디자인 방향

- **영수증 메모**: 미세한 점선 절취선, 모서리 찢김을 gradient로 표현
- **폴라로이드 메모**: 하단 여백을 넓게, 색은 종이 그림자와 테두리에만 반영
- **라벨 스티커**: 작은 둥근 모서리, 두 겹 테두리, 깔끔한 정보 카드 느낌
- **마스킹 테이프 조각**: 반투명 테이프를 위·좌측에 얹되 `pointer-events:none`
- **연구 노트**: 옅은 줄노트, 서명란, 차분한 잉크 톤

---

# C. 제출 형식 예시

```js
// app.js
const IDEA_BG_TEMPLATES = {
  blueprint: { label: "청사진 그리드", desc: "차가운 모눈과 은은한 광원 · 작업용 기본 보드" },
  scrapbook: { label: "스크랩북 페이퍼", desc: "종이 결, 테이프 자국, 따뜻한 콜라주 바탕" },
  occultCork: { label: "오컬트 코르크", desc: "낡은 코르크와 잉크 얼룩의 조사 보드" }
};

const IDEA_NOTE_TEMPLATES = {
  marker: { label: "형광 마커", desc: "형광 잉크가 번진 듯한 러프 메모" },
  tape: { label: "테이프 노트", desc: "상단 테이프로 붙인 종이 조각" },
  starPaper: { label: "별 종이", desc: "별가루가 묻은 작은 마법 메모" }
};
```

```css
.idea-canvas[data-background="occultCork"] {
  background-color: #32271f;
  background-image:
    radial-gradient(circle at 18% 20%, rgba(217,184,118,.11), transparent 28%),
    repeating-linear-gradient(12deg, rgba(255,255,255,.025) 0 1px, transparent 1px 8px),
    repeating-linear-gradient(78deg, rgba(0,0,0,.055) 0 1px, transparent 1px 11px);
}

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

---

## 최종 전달 전 점검 문장

AI에게 결과를 받은 뒤 아래 한 줄을 추가로 요청하면 안전합니다.

```text
위 CSS에서 .idea-item의 위치·크기·회전·포인터 이벤트를 바꾸는 선언과, 장식 레이어의 pointer-events:auto 선언이 있는지 스스로 검사하고 제거해줘.
```
