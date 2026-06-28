# 루미잉크 로그 템플릿 제작 가이드

이 문서는 디자이너 또는 다른 AI가 루미잉크용 로그 디자인을 JSON으로 제작할 때 사용하는 규격입니다.

## 핵심 원칙

- 파일 인코딩은 UTF-8, 확장자는 `.json`입니다.
- `kind`는 반드시 `lumink-log-template`, `schemaVersion`은 `1`입니다.
- HTML과 JavaScript는 사용할 수 없습니다. 디자인은 허용된 인라인 스타일과 정규식 규칙으로 표현합니다.
- 정규식은 JavaScript 문법을 사용합니다. JSON 안에서는 역슬래시를 두 번 써야 합니다. 예: `\\[`.
- 한 템플릿은 200KB 이하, 규칙은 최대 20개를 권장합니다.
- 지나치게 복잡한 중첩 반복 정규식은 업로드 단계에서 거부될 수 있습니다.

## 전체 예시

```json
{
  "kind": "lumink-log-template",
  "schemaVersion": 1,
  "id": "author-template-name",
  "name": "템플릿 표시 이름",
  "description": "짧은 디자인 설명",
  "author": "제작자 이름",
  "styles": {
    "canvas": {
      "background": "linear-gradient(145deg,#111827,#202a44)",
      "color": "#eef2ff",
      "border": "1px solid #4b5f96",
      "border-radius": "16px",
      "padding": "22px",
      "max-width": "760px",
      "margin": "0 auto",
      "font-family": "'Noto Sans KR',sans-serif",
      "line-height": "1.75"
    },
    "header": {
      "color": "#aebfff",
      "font-size": "13px",
      "font-weight": "800",
      "border-bottom": "1px solid #405080",
      "padding": "0 0 12px",
      "margin": "0 0 16px"
    },
    "body": {
      "white-space": "pre-wrap",
      "overflow-wrap": "anywhere"
    },
    "paragraph": { "margin": "0 0 11px" },
    "empty": { "height": "10px" }
  },
  "rules": [
    {
      "id": "double-quote",
      "label": "큰따옴표 안쪽",
      "pattern": "\\\"([^\\\"\\n]+)\\\"",
      "flags": "g",
      "capture": 1,
      "stripDelimiters": false,
      "style": {
        "color": "#ffd1ea",
        "font-weight": "700"
      }
    },
    {
      "id": "bold",
      "label": "마크다운 굵게",
      "pattern": "\\*\\*([^*\\n]+)\\*\\*",
      "flags": "g",
      "capture": 1,
      "stripDelimiters": true,
      "style": {
        "font-weight": "800",
        "color": "#ffffff"
      }
    }
  ],
  "persona": {
    "maskText": "◆◆◆",
    "style": {
      "color": "#111827",
      "background-color": "#aebfff",
      "border-radius": "999px",
      "padding": "1px 7px",
      "font-weight": "800"
    }
  }
}
```

## 스타일 영역

- `canvas`: 로그 전체 배경과 외곽선
- `header`: 메모 제목 영역
- `body`: 본문 컨테이너
- `paragraph`: 일반 문단 한 줄
- `empty`: 빈 줄

주요 허용 속성은 `background`, `background-color`, `color`, `border`, `border-left`, `border-bottom`, `border-radius`, `padding`, `margin`, `box-shadow`, `font-family`, `font-size`, `font-weight`, `font-style`, `text-decoration`, `line-height`, `letter-spacing`, `text-align`, `white-space`, `word-break`, `overflow-wrap`, `width`, `max-width`, `height`입니다.

외부 이미지 URL, `@import`, `expression`, `javascript:` 및 임의 HTML은 허용되지 않습니다.

## 정규식 규칙

각 `rules` 항목은 다음 필드를 사용합니다.

- `id`: 템플릿 안에서 고유한 영문 식별자
- `label`: 사람이 읽는 규칙 이름
- `pattern`: JavaScript 정규식 문자열
- `flags`: `g`, `i`, `m`, `u`만 사용 가능. `g`는 자동으로 추가됩니다.
- `capture`: 스타일을 적용할 캡처 그룹 번호. `0`이면 일치 전체입니다.
- `stripDelimiters`: `true`이면 캡처 바깥의 따옴표·별표 같은 구분자를 보기 결과에서 제거합니다.
- `style`: 일치한 부분에 적용할 인라인 스타일

규칙은 배열 순서대로 적용됩니다. 마크다운 굵게(`**...**`)는 기울임(`*...*`)보다 앞에 두는 것을 권장합니다.

## 페르소나명 가림

`persona.maskText`는 사용자가 지정한 이름들 대신 표시할 기본 문자열입니다. 사용자는 메모 화면에서 본명·애칭·호칭 등 원본 이름을 최대 20개까지 추가하고, 다른 대체 문구를 직접 입력할 수도 있습니다. 모든 원본 이름은 같은 대체 문구를 사용합니다.

이름 가림 표시는 기본적으로 다음 5종을 제공합니다: `솔리드 칩`, `아웃라인`, `언더라인`, `소프트 틴트`, `마커 하이라이트`.

- `persona.style`만 제공한 기존 템플릿은 첫 번째 스타일을 기준으로 나머지 4종이 자동 파생됩니다.
- 각 변주를 직접 지정하려면 `persona.designs` 배열에 최대 5개를 넣습니다. 각 항목은 `label`, `style`을 사용하며, 부족한 항목은 첫 번째 스타일에서 자동 파생됩니다.
- 앱은 선택된 가림 디자인을 로그 보기·복사·내보내기에 동일하게 적용합니다.

## 제작 요청용 프롬프트 예시

다른 AI에게 다음처럼 요청할 수 있습니다.

> 첨부한 루미잉크 로그 템플릿 제작 가이드의 schemaVersion 1을 엄격히 따라 JSON 템플릿 하나를 만들어 주세요. 임의 HTML이나 JavaScript 없이, 모든 디자인은 허용된 style 객체로 표현하세요. 큰따옴표, 작은따옴표, 대괄호, 마크다운 굵게와 기울임 규칙을 포함하고, 서로 다른 규칙의 색상 위계를 분명하게 해주세요. 결과는 설명 없이 유효한 JSON 코드 블록 하나로만 출력하세요.

## 제출 전 확인

1. JSON 파싱 오류가 없는가
2. `id`가 영문·숫자·하이픈 조합이며 다른 템플릿과 겹치지 않는가
3. 모든 정규식에 무한 반복 가능성이 없는가
4. 어두운 배경에서는 글자 대비가 충분한가
5. 모바일 폭에서도 `max-width`와 여백이 자연스러운가
6. 큰따옴표·작은따옴표·대괄호·굵게·기울임 예제를 모두 시험했는가
