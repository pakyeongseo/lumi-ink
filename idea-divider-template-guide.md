# Lumi Ink 아이디어 보드 구분선 템플릿 가이드

구분선 요소는 아이디어 보드 조각의 한 종류입니다. 기본 제공 템플릿은 `solid`와 `dashed`이며, 이후 CSS와 레지스트리를 추가해 더 많은 디자인을 등록할 수 있습니다.

## 1. JS 레지스트리 형식

`app.js`의 `IDEA_DIVIDER_STYLES`에 다음 형식으로 키를 추가합니다.

```js
const IDEA_DIVIDER_STYLES = Object.freeze({
  solid: { label: "실선", desc: "가장 기본적인 단일 구분선" },
  dashed: { label: "점선", desc: "짧은 선이 반복되는 구분선" },
  lace: { label: "레이스", desc: "장식적인 레이스형 구분선" }
});
```

키 이름은 영문, 숫자, 하이픈·언더스코어만 사용하는 것을 권장합니다. 예: `lace`, `starLine`, `ribbon-gold`.

## 2. CSS 선택자 형식

구분선 조각에는 다음 속성이 붙습니다.

```html
<article class="idea-item idea-divider" data-divider-style="solid">
  <div class="idea-divider-body"><span></span></div>
</article>
```

템플릿 CSS는 아래처럼 작성합니다.

```css
.idea-divider[data-divider-style="lace"] .idea-divider-body span {
  height:10px;
  border-top:0;
  background:
    radial-gradient(circle, var(--idea-color-b,#7b9bff) 0 3px, transparent 4px) 0 50% / 18px 10px repeat-x;
  filter:drop-shadow(0 2px 3px rgba(0,0,0,.12));
}
```

## 3. 색상 변수

구분선에는 아이디어 보드 컬러 팔레트의 변수가 들어옵니다.

- `--idea-color-a`: 밝은 계열 색
- `--idea-color-b`: 중심 색
- `--idea-color-c`: 짙은 계열 색
- `--idea-color-grad`: 테마 그라데이션

디자인은 가능하면 이 변수를 사용해야 테마 컬러 선택과 자연스럽게 연동됩니다.

## 4. 권장 크기와 주의사항

- 기본 크기: `360px × 24px`
- 최소 크기: `60px × 8px`
- 본문 텍스트가 없는 장식 요소이므로 `::before`, `::after`, `.idea-divider-body span` 중심으로 꾸미는 것을 권장합니다.
- 클릭·드래그 조작을 방해하지 않도록 장식 요소에는 `pointer-events:none`을 유지합니다.
- 내보내기 HTML에도 같은 CSS가 인라인으로 포함되므로 외부 이미지 URL보다는 CSS 그라데이션, SVG data URL, 색상 변수 사용을 권장합니다.

