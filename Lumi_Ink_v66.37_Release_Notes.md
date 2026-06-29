# Lumi Ink v66.37 릴리스 노트

## ✨ 아이디어 보드·자유메모 — 화려한 구분선 30종 추가 (총 57 → 87종)

기존 단정한 라인 위주에서 한 단계 나아가, 장식 밀도가 높은 화려한 컨셉 30종을 새로 등록했습니다. 모두 테마 컬러(`--idea-color-b`)·굵기 슬라이더(`--idea-divider-weight`)에 자동 연동됩니다.

### A. 레이스·세공 6종
레이스(lace) · 아라베스크(arabesque) · 뇌문(greekKey) · 덩굴(vine) · 켈틱 매듭(celtic) · 필리그리(filigree)

### B. 보석·광택 6종
보석 띠(jewelBand) · 프리즘(prism) · 크리스탈(crystalLine) · 메탈 광택(metallicGold) · 오팔(opal) · 보석 사슬(gemChain)

### C. 발광 5종
오로라(aurora) · 네온관(neonTube) · 별빛(starlight) · 잉걸불(emberGlow) · 꼬마전구(fairyLights)

### D. 꽃·식물 6종
꽃 화환(floralWreath) · 장미(roseLine) · 벚꽃(cherryBlossom) · 월계(laurel) · 다마스크(damask) · 식물 줄기(botanical)

### E. 엠블럼·리본 4종
문장(royalCrest) · 두루마리 끝(scrollEnds) · 펜던트(gemDrop) · 더블 리본(doubleRibbon)

### F. 기하 화려 3종
모자이크(mosaic) · 쉐브론(chevronLux) · 햇살(sunburst)

## 🔧 기술 메모
- 화려함은 단일 선이 아니라 **다층 그라데이션·conic 패싯·box-shadow 군집·SVG 마스크 윤곽**을 쌓아 구현
- 발광 계열은 `box-shadow`/`filter:drop-shadow`로 글로우, color-mix로 다색 펄 표현
- 곡선·매듭·미앤더·마름모 윤곽은 SVG `mask` + `background:var(--c)` 방식으로 색 변수 연동
- 기존 57종 키·라벨·CSS는 전량 보존, 추가만 수행
- 옵션 안내 문구 "디자인 57종" → "87종", 캐시 버전 `v66.37-divider-luxe-30`로 bump
