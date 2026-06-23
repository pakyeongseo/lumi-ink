/*
 * Lumi Ink Idea Board Template Registry
 * 새 배경/포스트잇을 추가할 때는 이 파일의 항목 1개와
 * idea-board-custom-templates.css의 같은 key 선택자 1세트만 추가하세요.
 * 이벤트·저장·드래그 코드에는 손대지 않습니다.
 */
window.LumiInkIdeaTemplates = {
  schemaVersion: 1,
  backgrounds: {
    blueprint: { label: "청사진 그리드", desc: "차가운 모눈과 은은한 광원 · 작업용 기본 보드" },
    scrapbook: { label: "스크랩북 페이퍼", desc: "종이 결, 테이프 자국, 따뜻한 콜라주 바탕" },
    corkboard: { label: "코르크 보드", desc: "압정 자국 어울리는 따뜻한 코르크 핀보드" },
    chalkboard: { label: "칠판", desc: "분필 가루 내려앉은 짙은 녹색 슬레이트" },
    graphpaper: { label: "모눈 노트", desc: "옅은 청색 모눈이 깔린 크림 제도지" },
    starchart: { label: "별자리도", desc: "성운과 잔별이 흩뿌려진 깊은 밤하늘" },
    linen: { label: "리넨 패브릭", desc: "올이 고운 베이지 천 위 차분한 보드" },
    kraft: { label: "크라프트지", desc: "결이 살아있는 따뜻한 갈색 포장지" },
    slateGrid: { label: "다크 그리드", desc: "중성 차콜에 도트 격자 · 모던 작업판" },
    dossier: { label: "기밀 문서판", desc: "낡은 종이와 핏빛 얼룩의 수사 보드" },
    sakura: { label: "벚꽃 보드", desc: "복숭아빛 크림에 꽃잎이 흩날리는 보드" },
    terminal: { label: "터미널", desc: "녹색 주사선이 흐르는 어두운 CRT 화면" },
    velvet: { label: "벨벳 나이트", desc: "보랏빛 벨벳에 은은한 중앙 광원" },
    "plain-blue": { label: "블루 빈 캔버스", desc: "질감 없이 컬러만 남긴 깨끗한 기본 바탕" },
    "plain-pink": { label: "핑크 빈 캔버스", desc: "질감 없이 컬러만 남긴 깨끗한 기본 바탕" },
    "plain-green": { label: "그린 빈 캔버스", desc: "질감 없이 컬러만 남긴 깨끗한 기본 바탕" },
    "plain-purple": { label: "퍼플 빈 캔버스", desc: "질감 없이 컬러만 남긴 깨끗한 기본 바탕" },
    "plain-gold": { label: "골드 빈 캔버스", desc: "질감 없이 컬러만 남긴 깨끗한 기본 바탕" },
    "plain-pblue": { label: "파스텔 블루 빈 캔버스", desc: "질감 없이 컬러만 남긴 깨끗한 기본 바탕" },
    "plain-ppink": { label: "파스텔 핑크 빈 캔버스", desc: "질감 없이 컬러만 남긴 깨끗한 기본 바탕" },
    "plain-polive": { label: "파스텔 올리브 빈 캔버스", desc: "질감 없이 컬러만 남긴 깨끗한 기본 바탕" },
    "plain-ppurple": { label: "파스텔 퍼플 빈 캔버스", desc: "질감 없이 컬러만 남긴 깨끗한 기본 바탕" },
    "plain-pgold": { label: "파스텔 골드 빈 캔버스", desc: "질감 없이 컬러만 남긴 깨끗한 기본 바탕" },
    "plain-navy": { label: "네이비 빈 캔버스", desc: "질감 없이 컬러만 남긴 깨끗한 기본 바탕" },
    "plain-burgundy": { label: "버건디 빈 캔버스", desc: "질감 없이 컬러만 남긴 깨끗한 기본 바탕" },
    "plain-dgreen": { label: "딥그린 빈 캔버스", desc: "질감 없이 컬러만 남긴 깨끗한 기본 바탕" },
    "plain-dviolet": { label: "딥바이올렛 빈 캔버스", desc: "질감 없이 컬러만 남긴 깨끗한 기본 바탕" },
    "plain-lgold": { label: "럭셔리골드 빈 캔버스", desc: "질감 없이 컬러만 남긴 깨끗한 기본 바탕" },
    "plain-mono": { label: "무채색 빈 캔버스", desc: "질감 없이 컬러만 남긴 깨끗한 기본 바탕" },
    "plain-brown": { label: "브라운 빈 캔버스", desc: "질감 없이 컬러만 남긴 깨끗한 기본 바탕" },
    "plain-silver": { label: "메탈릭 실버 빈 캔버스", desc: "질감 없이 컬러만 남긴 깨끗한 기본 바탕" },
    "plain-mgold": { label: "메탈릭 골드 빈 캔버스", desc: "질감 없이 컬러만 남긴 깨끗한 기본 바탕" },
    "plain-bw": { label: "블랙&화이트 빈 캔버스", desc: "질감 없이 컬러만 남긴 깨끗한 기본 바탕" }
  },
  noteStyles: {
    marker: { label: "형광 마커", desc: "형광 잉크가 번진 듯한 러프 메모" },
    tape: { label: "테이프 노트", desc: "상단 테이프로 붙인 종이 조각" },
    receipt: { label: "영수증", desc: "절취선과 바코드가 찍힌 감열지 메모" },
    polaroid: { label: "폴라로이드", desc: "넓은 하단 여백의 즉석사진 카드" },
    label: { label: "라벨 스티커", desc: "두 겹 테두리의 깔끔한 라벨 카드" },
    ledger: { label: "연구 노트", desc: "좌측 여백선과 서명란의 줄노트" },
    paperclip: { label: "클립 메모", desc: "좌상단 금속 클립을 끼운 종이" },
    waxSeal: { label: "봉랍 편지", desc: "데클 가장자리와 봉랍 씰의 양피지" },
    neonGlass: { label: "네온 글래스", desc: "어두운 보드용 네온 테두리 글래스 카드" }
  }
};
