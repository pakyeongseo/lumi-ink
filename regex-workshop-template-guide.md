# Lumi Ink Regex Workshop Template Guide

정규식 작업실의 OUT 템플릿은 SillyTavern `replaceString`에 그대로 들어가는 HTML 문자열입니다.

## 기본 규칙

- 값 슬롯은 `$1`, `$2`, `$3` 형식으로 작성합니다.
- 상태창은 `$1`부터 `$20`까지, 알림창은 `$1`부터 `$10`까지, 메시지창은 `$1`부터 `$5`까지 준비합니다.
- 디자인은 하나의 최상위 래퍼 안에 넣어 주세요.
- CSS는 템플릿 내부의 `<style>`에 넣고, 선택자는 고유 접두사를 붙여 주세요. 예: `.li-rx-status`, `.my-status-card`.
- 외부 스크립트, `onclick`, `iframe`, `form`은 사용하지 않는 편이 좋습니다. 루미잉크 미리보기는 스크립트와 폼 실행을 차단합니다.
- 외부 이미지는 `https://...` 이미지 URL 또는 `data:image/...`를 권장합니다.

## 권장 구조

```html
<div class="my-regex-template">
  <style>
    .my-regex-template {
      max-width: 620px;
      margin: 16px auto;
      padding: 18px;
      border-radius: 14px;
      background: #101827;
      color: #f5f7fb;
      font-family: -apple-system, BlinkMacSystemFont, "Noto Sans KR", sans-serif;
    }
    .my-regex-template .row {
      display: flex;
      justify-content: space-between;
      gap: 12px;
    }
  </style>
  <div class="row"><span>Level</span><b>$1</b></div>
  <div class="row"><span>HP</span><b>$2 / $3</b></div>
</div>
```

## 샘플에서 IN 만들기

샘플 입력에서는 유동적으로 바뀌는 값만 `[[캡처될 값]]`으로 표시합니다. 별도로 감싸지 않은 텍스트는 고정 구간으로 취급됩니다.

```text
<RLST>
- [Lv: [[12]] ] | [HP: [[80]] / [[100]] ]
</RLST>
```

`샘플→IN`을 누르면 고정 구간은 넓은 공백 허용 패턴으로, 유동 구간은 `$1`, `$2`, `$3`에 대응하는 캡처 그룹으로 변환됩니다.
`{{고정 텍스트}}` 표기는 현재 UI 설명에서는 숨겨 두었지만, 추후 템플릿 제공 기능을 다시 열 수 있도록 내부 호환 기능으로 유지합니다.
