"use strict";
/* ============================================================
   루미잉크 (Lumink) — app logic (1차)
   ============================================================ */
(function () {
  const L = window.__lumink;
  const st = L.state;
  const { $, uid, now, esc, fmtDate, plainText, deriveTitle, preview, toast, toastAction,
          noteHtml, notesOf, getProject, getNote } = L.h;
  const { CHIP, TYPE_LABEL, openDB, store, getAll, put, del, transact } = L;
  function $on(id, type, fn, opts) { const el = $(id); if (el) el.addEventListener(type, fn, opts); else console.warn("[bind] #" + id + " not found — skipped"); }
  const ICONS = window.__luminkIcons || [];
  const DEFAULT_ICON = ICONS[0] ? ICONS[0].data : null;
  const FRAMES = window.__luminkFrames || [];
  const FRAME_COLORS = [
    ["gold", "골드", "#d4af37"], ["rosegold", "로즈골드", "#d99a8f"], ["silver", "실버", "#c0c6cc"],
    ["bronze", "브론즈", "#b08d57"], ["white", "화이트", "#f2f2f4"], ["black", "블랙", "#1c1c1e"],
    ["navy", "네이비", "#3a4f8a"], ["burgundy", "버건디", "#8a2336"], ["emerald", "에메랄드", "#1f8a5c"],
    ["violet", "바이올렛", "#8a5fd0"], ["sky", "스카이", "#5fb0e8"], ["rose", "로즈", "#e06a92"],
    ["pastel-blue", "파스텔 블루", "#9ed7f2"], ["pastel-aqua", "파스텔 아쿠아", "#9fe7df"],
    ["pastel-mint", "파스텔 민트", "#afe8c8"], ["pastel-lilac", "파스텔 라일락", "#cbb8f4"],
    ["pastel-pink", "파스텔 핑크", "#f2b6ca"], ["pastel-peach", "파스텔 피치", "#f5c29e"],
    ["pastel-butter", "파스텔 버터", "#f3e59a"], ["pastel-rose", "파스텔 로즈", "#edbed4"],
    ["pastel-sky", "파스텔 스카이", "#b6dff4"],
    ["glass", "투명 글래스", "rgba(255,255,255,.48)"],
    ["punch", "글래시한 명암", "punch"]
  ];
  const FRAME_THEME_TOKEN = "theme";
  const FRAME_PUNCH_TOKEN = "punch";
  const HTML_SOURCE_MAX = 5 * 1024 * 1024; // raw 코드 작업실: 원본 보존용 5 MiB 상한
  const FRAME_COLOR_BY_KEY = new Map(FRAME_COLORS.filter(([key]) => key !== FRAME_PUNCH_TOKEN).map(([key, , color]) => [key, color.toLowerCase()]));
  const FRAME_COLOR_SET = new Set(FRAME_COLORS.filter(([key]) => key !== FRAME_PUNCH_TOKEN).map(([, , color]) => color.toLowerCase()));
  function frameById(id) { return FRAMES.find((f) => f.id === id) || null; }
  function normalizeFrameColor(value) {
    if (value === FRAME_THEME_TOKEN || value === FRAME_PUNCH_TOKEN) return value;
    if (typeof value !== "string") return null;
    const color = value.trim().toLowerCase();
    // v49 초기 구현은 색상 키(gold, pastel-pink)를 저장했어요.
    // 기존 프로젝트·백업도 열 때 실제 HEX 값으로 승격해 보존합니다.
    if (FRAME_COLOR_BY_KEY.has(color)) return FRAME_COLOR_BY_KEY.get(color);
    return FRAME_COLOR_SET.has(color) ? color : (normHex(color) || null);
  }
  function resolveFrameColor(value) {
    if (value === FRAME_THEME_TOKEN) {
      return (getComputedStyle(document.documentElement).getPropertyValue("--accent") || "").trim() || "#d4af37";
    }
    if (value === FRAME_PUNCH_TOKEN) return FRAME_PUNCH_TOKEN;
    return normalizeFrameColor(value) || "#d4af37";
  }
  function punchedFrameInner(f) {
    if (!f) return "";
    const hi = f.build("#ffffff");
    const lo = f.build("#000000");
    const mid = f.build("rgba(255,255,255,.24)");
    return '<g opacity=".18">' + mid + '</g>' +
      '<g opacity=".24" transform="translate(-0.5,-0.5)">' + hi + '</g>' +
      '<g opacity=".18" transform="translate(0.6,0.6)">' + lo + '</g>';
  }
  function frameSvgMarkup(fid, color) {
    const f = frameById(fid); if (!f) return "";
    const resolved = resolveFrameColor(color);
    const inner = resolved === FRAME_PUNCH_TOKEN ? punchedFrameInner(f) : f.build(resolved);
    return '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" aria-hidden="true">' + inner + "</svg>";
  }
  function frameNineSliceMarkup(fid, color) {
    const f = frameById(fid); if (!f) return "";
    const resolved = resolveFrameColor(color);
    const inner = resolved === FRAME_PUNCH_TOKEN ? punchedFrameInner(f) : f.build(resolved);
    // 바로크는 아칸서스 모서리 장식이 넓어서, 모서리를 크게 보존하고
    // 가운데 띠만 좁게 잡습니다. 그 외 프레임은 기존의 균형 분할을 유지합니다.
    const cap = fid === "baroque" ? 42 : 28;
    const mid = 100 - cap * 2;
    const end = cap + mid;
    const kind = fid === "baroque" ? " idea-frame-9slice-baroque" : "";
    const svg = (viewBox, stretch, role) => `<svg class="idea-frame-slice idea-frame-slice-${role}" viewBox="${viewBox}" xmlns="http://www.w3.org/2000/svg"${stretch ? ' preserveAspectRatio="none"' : ''} aria-hidden="true">${inner}</svg>`;
    // 모서리는 고정 크기, 네 변의 중앙부만 늘리는 9-slice 프레임입니다.
    return `<span class="idea-frame-9slice${kind}" aria-hidden="true">${svg(`0 0 ${cap} ${cap}`,false,'tl')}${svg(`${cap} 0 ${mid} ${cap}`,true,'t')}${svg(`${end} 0 ${cap} ${cap}`,false,'tr')}${svg(`0 ${cap} ${cap} ${mid}`,true,'l')}<span class="idea-frame-slice idea-frame-slice-c"></span>${svg(`${end} ${cap} ${cap} ${mid}`,true,'r')}${svg(`0 ${end} ${cap} ${cap}`,false,'bl')}${svg(`${cap} ${end} ${mid} ${cap}`,true,'b')}${svg(`${end} ${end} ${cap} ${cap}`,false,'br')}</span>`;
  }
  function frameInner(p) {
    if (!p || !p.frame) return "";
    return frameSvgMarkup(p.frame, p.frameColor);
  }
  function getOne(name, id) { return new Promise((res, rej) => { const r = store(name, "readonly").get(id); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }



  /* ---------- right-edge quick menu · v65.2 code icon slots ---------- */
  const QUICK_MENU_SETTING_ID = "quickMenu";
  const QUICK_MENU_MIN = 1;
  const QUICK_MENU_DEFAULT = 5;
  const QUICK_MENU_LEGACY_DEFAULT = 7;
  const QUICK_MENU_MAX = 10;
  const QUICK_MENU_ALLOWED_TYPES = new Set(["free", "html", "regex", "lorebook", "log", "persona", "character", "idea"]);
  const QUICK_MENU_ICON_LIBRARY = Array.isArray(window.__luminkQuickMenuIcons) ? window.__luminkQuickMenuIcons.filter((item) => item && typeof item.id === "string" && typeof item.svg === "string") : [];
  const QUICK_MENU_ICON_BY_ID = new Map(QUICK_MENU_ICON_LIBRARY.map((item) => [item.id, item]));
  const QUICK_MENU_ICON_CATEGORIES = [
    ["all", "전체"], ["navigation", "이동"], ["action", "기능"], ["archive", "기록"], ["mood", "장식"]
  ];
  // v65.8: 홈 단일 바로가기를 확장한 기능 바로가기 목록입니다.
  // 설정 화면의 각 행과 1:1로 연결해, 자주 쓰는 기능을 퀵 메뉴에서 바로 실행할 수 있어요.
  const QUICK_MENU_FUNCTIONS = Object.freeze([
    { id:"home", group:"빠른 이동", label:"홈 바로가기", meta:"루미잉크 첫 화면으로 이동" },
    { id:"settings", group:"빠른 이동", label:"설정 바로가기", meta:"설정 화면을 바로 열기" },
    { id:"app-reload", group:"빠른 이동", label:"앱 새로고침", meta:"저장한 뒤 현재 화면을 다시 불러오기" },
    { id:"setting-theme", group:"화면 설정", label:"테마 전환", meta:"밝게 · 어둡게 즉시 전환" },
    { id:"setting-accent", group:"화면 설정", label:"컬러 테마", meta:"프리셋 또는 사용자 지정 테마 고르기" },
    { id:"setting-font", group:"화면 설정", label:"웹폰트", meta:"앱 글꼴 바꾸기" },
    { id:"setting-toolbar", group:"화면 설정", label:"자유 메모 툴바", meta:"툴바 표시 방식 고르기" },
    { id:"setting-quick-menu", group:"화면 설정", label:"퀵 메뉴 설정", meta:"슬롯과 표시 형태 편집" },
    { id:"setting-install", group:"화면 설정", label:"앱 설치 아이콘", meta:"설치 간판 페이지에서 아이콘 고르기" },
    { id:"setting-backup", group:"데이터 관리", label:"전체 백업", meta:"현재 데이터를 백업 파일로 저장" },
    { id:"setting-restore", group:"데이터 관리", label:"백업 복원", meta:"백업 파일을 선택해 복원" },
    { id:"setting-auto-backup", group:"데이터 관리", label:"자동 백업", meta:"저장된 자동 스냅샷 확인" },
    { id:"setting-storage", group:"데이터 관리", label:"저장공간", meta:"브라우저 저장 용량 확인" },
    { id:"setting-reset", group:"데이터 관리", label:"데이터 초기화", meta:"모든 로컬 데이터 삭제" },
    { id:"setting-manual", group:"도움말", label:"상세 매뉴얼", meta:"사용법 문서 열기" }
  ]);
  const QUICK_MENU_FUNCTION_BY_ID = new Map(QUICK_MENU_FUNCTIONS.map((item) => [item.id, item]));
  let quickMenuImageSlot = null;
  let quickMenuIconRenderSerial = 0;

  function quickMenuLibraryIconId(value) { return QUICK_MENU_ICON_BY_ID.has(String(value || "")) ? String(value) : null; }
  function quickMenuLibraryIcon(entryId) { return QUICK_MENU_ICON_BY_ID.get(quickMenuLibraryIconId(entryId)) || null; }
  function quickMenuIconThemeLabel(item) { return cleanImportedText(String((item && item.themeLabel) || "루미 기본"), 18).trim() || "루미 기본"; }
  function quickMenuIconCardMarkup(item, selected, scope) {
    const target = scope === "project" ? "data-project-library-icon" : "data-qm-library-icon";
    const classes = scope === "project" ? "project-library-icon-card" : "qm-library-card";
    const artClass = scope === "project" ? "project-library-art" : "qm-library-art";
    const selectedClass = scope === "project" ? (selected ? " sel" : "") : (selected ? " is-selected" : "");
    return `<button type="button" class="${classes}${selectedClass}" ${target}="${esc(item.id)}">${quickMenuLibraryIconMarkup(item.id, artClass)}<span class="li-card-title">${esc(item.label)}</span><small class="li-card-style">${esc(quickMenuIconThemeLabel(item))}</small></button>`;
  }
  function uniquifyInlineSvgIds(raw, scope) {
    const source = String(raw || "");
    if (!source) return "";
    const doc = new DOMParser().parseFromString(source, "text/html");
    const svg = doc.querySelector("svg");
    if (!svg) return "";
    const map = new Map();
    svg.querySelectorAll("[id]").forEach((node) => {
      const oldId = node.getAttribute("id");
      if (!oldId) return;
      const nextId = `${scope}-${oldId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
      map.set(oldId, nextId); node.setAttribute("id", nextId);
    });
    const rewrite = (text) => {
      let out = String(text || "");
      map.forEach((nextId, oldId) => {
        const escId = oldId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        out = out.replace(new RegExp(`url\\(\\s*['"]?#${escId}['"]?\\s*\\)`, "g"), `url(#${nextId})`)
                 .replace(new RegExp(`^#${escId}$`), `#${nextId}`);
      });
      return out;
    };
    svg.querySelectorAll("*").forEach((node) => {
      ["fill", "stroke", "filter", "clip-path", "mask", "href", "xlink:href", "style"].forEach((attr) => {
        if (node.hasAttribute(attr)) node.setAttribute(attr, rewrite(node.getAttribute(attr)));
      });
      if (node.tagName && node.tagName.toLowerCase() === "style") node.textContent = rewrite(node.textContent || "");
    });
    svg.setAttribute("aria-hidden", "true"); svg.setAttribute("focusable", "false");
    return svg.outerHTML;
  }
  function quickMenuLibraryIconMarkup(iconId, extraClass) {
    const item = quickMenuLibraryIcon(iconId);
    if (!item) return "";
    const safe = sanitizeQuickMenuSvg(item.svg);
    if (!safe) return "";
    const scope = `li-${item.id}-${++quickMenuIconRenderSerial}`;
    return `<span class="li-vector-icon ${extraClass || ""}" data-li-icon="${esc(item.id)}" title="${esc(item.label || "아이콘")}">${uniquifyInlineSvgIds(safe, scope)}</span>`;
  }

  function quickMenuFunctionId(value) { return QUICK_MENU_FUNCTION_BY_ID.has(String(value || "")) ? String(value) : "home"; }
  function quickMenuFunction(value) { return QUICK_MENU_FUNCTION_BY_ID.get(quickMenuFunctionId(value)) || QUICK_MENU_FUNCTION_BY_ID.get("home"); }
  function emptyQuickMenuSlot(index) {
    return { slotId: index + 1, kind: null, label: "", thumbnail: null, iconCode: null, libraryIconId: null, functionId: null, targetId: null, createType: null, createMode: "single", createProjectId: null };
  }
  function quickMenuSlotCount(value) {
    const n = Math.round(Number(value));
    return Number.isFinite(n) ? Math.max(QUICK_MENU_MIN, Math.min(QUICK_MENU_MAX, n)) : QUICK_MENU_DEFAULT;
  }
  function quickMenuHasStoredSlotCount(src) {
    return !!(src && Object.prototype.hasOwnProperty.call(src, "slotCount") && Number.isFinite(Number(src.slotCount)));
  }
  function quickMenuInitialSlotCount(src, list) {
    if (quickMenuHasStoredSlotCount(src)) return quickMenuSlotCount(src.slotCount);
    const hasLegacyConfig = !!(src && typeof src === "object" && (Array.isArray(src.slots) || "enabled" in src || "displayMode" in src || "updatedAt" in src || "version" in src));
    if (hasLegacyConfig) return Math.max(QUICK_MENU_LEGACY_DEFAULT, Math.min(QUICK_MENU_MAX, Array.isArray(list) ? list.length : QUICK_MENU_LEGACY_DEFAULT));
    return QUICK_MENU_DEFAULT;
  }
  function normalizeQuickMenu(raw) {
    const src = raw && typeof raw === "object" ? (raw.value && typeof raw.value === "object" ? raw.value : raw) : {};
    const list = Array.isArray(src.slots) ? src.slots : [];
    const slotCount = quickMenuInitialSlotCount(src, list);
    const slots = [];
    for (let i = 0; i < slotCount; i++) {
      const base = emptyQuickMenuSlot(i), item = list[i] && typeof list[i] === "object" ? list[i] : {};
      // v65.8: 기존 홈 바로가기는 기능 바로가기 안의 home 항목으로 안전하게 승격합니다.
      const kind = ["function", "project", "note", "create"].includes(item.kind) ? item.kind : (item.kind === "home" ? "function" : null);
      if (!kind) { slots.push(base); continue; }
      const thumb = safeImageSource(item.thumbnail);
      const slot = {
        slotId: i + 1,
        kind,
        label: cleanImportedText(String(item.label || ""), 42).trim(),
        thumbnail: thumb && thumb.length <= 900000 ? thumb : null,
        iconCode: normalizeQuickMenuIconCode(item.iconCode),
        libraryIconId: quickMenuLibraryIconId(item.libraryIconId),
        functionId: kind === "function" ? quickMenuFunctionId(item.functionId || (item.kind === "home" ? "home" : "home")) : null,
        targetId: isSafeRecordId(item.targetId) ? item.targetId : null,
        createType: QUICK_MENU_ALLOWED_TYPES.has(item.createType) ? item.createType : "free",
        createMode: item.createMode === "collection" ? "collection" : "single",
        createProjectId: isSafeRecordId(item.createProjectId) ? item.createProjectId : null
      };
      if ((kind === "project" || kind === "note") && !slot.targetId) { slots.push(base); continue; }
      slots.push(slot);
    }
    return {
      version: 6,
      updatedAt: Number(src.updatedAt) || 0,
      // v64.9: 기존 퀵 메뉴는 모두 기본형·사용 상태로 자연스럽게 승격합니다.
      enabled: src.enabled !== false,
      displayMode: src.displayMode === "mini" ? "mini" : "full",
      slotCount,
      slots
    };
  }
  function quickMenuConfig() {
    if (!st.quickMenu || !Array.isArray(st.quickMenu.slots)) st.quickMenu = normalizeQuickMenu(st.quickMenu);
    return st.quickMenu;
  }
  function quickMenuSlotLimit(cfg) { return quickMenuSlotCount((cfg || quickMenuConfig()).slotCount); }
  function quickMenuIsEnabled() { return quickMenuConfig().enabled !== false; }
  function quickMenuDisplayModeName(cfg) { return (cfg && cfg.displayMode) === "mini" ? "미니형" : "기본형"; }
  function quickMenuFilledCount() { return quickMenuConfig().slots.filter((slot) => !!slot.kind).length; }
  function quickMenuSlotActionName(slot) {
    if (!slot || !slot.kind) return "빈 슬롯";
    if (slot.kind === "function") return "기능 바로가기";
    if (slot.kind === "project") return "프로젝트 바로가기";
    if (slot.kind === "note") return "내 글 바로가기";
    return "메모 바로 만들기";
  }
  function quickMenuCreateTypeName(slot) {
    const type = slot && slot.createType;
    if (type === "persona") return slot.createMode === "collection" ? "다인 페르소나" : "페르소나";
    if (type === "character") return slot.createMode === "collection" ? "다인 캐릭터" : "캐릭터";
    return ({ free: "자유 메모", html: "코드 작업실", lorebook: "로어북", log: "로그 저장", idea: "아이디어 보드" })[type] || "메모";
  }
  function quickMenuSlotLabel(slot) {
    if (!slot || !slot.kind) return "새 슬롯 등록";
    if (slot.label) return slot.label;
    if (slot.kind === "function") return quickMenuFunction(slot.functionId).label;
    if (slot.kind === "project") { const p = getProject(slot.targetId); return p ? p.name : "삭제된 프로젝트"; }
    if (slot.kind === "note") { const n = getNote(slot.targetId); return n ? (n.title || "제목 없는 메모") : "삭제된 메모"; }
    return `${quickMenuCreateTypeName(slot)} 만들기`;
  }
  function quickMenuSlotMeta(slot) {
    if (!slot || !slot.kind) return "누르면 바로 등록";
    if (slot.kind === "function") return quickMenuFunction(slot.functionId).meta;
    if (slot.kind === "project") return "프로젝트 바로가기";
    if (slot.kind === "note") {
      const n = getNote(slot.targetId), p = n && getProject(n.projectId);
      return n ? `${p ? p.name : "프로젝트 없음"} · ${noteTypeLabel(n)}` : "삭제 시 자동 정리";
    }
    const p = slot.createProjectId && getProject(slot.createProjectId);
    return p ? `${p.name}에 바로 생성` : "현재 프로젝트 · 없으면 선택";
  }
  function sanitizeQuickMenuSvg(raw) {
    const source = cleanImportedText(String(raw || ""), 60000).trim();
    if (!source || !/<svg\b/i.test(source)) return null;
    const result = sanitize(source).html;
    const doc = new DOMParser().parseFromString(result, "text/html");
    const svg = doc.querySelector("svg");
    if (!svg) return null;
    svg.removeAttribute("id");
    svg.setAttribute("viewBox", svg.getAttribute("viewBox") || "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    return svg.outerHTML;
  }
  function sanitizeQuickMenuCssIcon(rawHtml, rawCss) {
    const markup = cleanImportedText(String(rawHtml || ""), 22000).trim();
    const css = cleanImportedText(String(rawCss || ""), 36000).trim();
    if (!markup || !css) return null;
    const result = sanitize(`<style>${css}</style><div class="qm-custom-art">${markup}</div>`).html;
    const doc = new DOMParser().parseFromString(result, "text/html");
    const art = doc.querySelector(".qm-custom-art");
    if (!art || !art.innerHTML.trim()) return null;
    const scopedCss = [...doc.querySelectorAll("style")].map((style) => style.textContent || "").join("\n")
      .replace(/\.lumink-user-html/g, ".quick-menu-custom-icon");
    if (!scopedCss.trim()) return null;
    return { html: art.outerHTML, css: scopedCss };
  }
  function normalizeQuickMenuIconCode(raw) {
    if (!raw || typeof raw !== "object") return null;
    if (raw.mode === "svg") {
      const svg = sanitizeQuickMenuSvg(raw.svg || raw.code || "");
      return svg ? { mode: "svg", svg } : null;
    }
    if (raw.mode === "css") {
      const safe = sanitizeQuickMenuCssIcon(raw.html || raw.markup || "", raw.css || "");
      return safe ? { mode: "css", html: safe.html, css: safe.css } : null;
    }
    return null;
  }
  function quickMenuCustomIconMarkup(iconCode) {
    const icon = normalizeQuickMenuIconCode(iconCode);
    if (!icon) return "";
    if (icon.mode === "svg") return `<span class="quick-menu-custom-icon quick-menu-custom-svg">${icon.svg}</span>`;
    return `<span class="quick-menu-custom-icon quick-menu-custom-css"><style>${String(icon.css || "").replace(/<\/style/gi, "")}</style>${icon.html || ""}</span>`;
  }
  function quickMenuIcon(slot) {
    const kind = slot && slot.kind;
    if (kind === "function") {
      const id = quickMenuFunction(slot.functionId).id;
      const art = {
        home:'<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1V10Z"/>',
        settings:'<circle cx="12" cy="12" r="3.1"/><path d="M19.4 13a7.8 7.8 0 0 0 0-2l2-1.5-2-3.4-2.3 1a7.6 7.6 0 0 0-1.7-1l-.3-2.5h-4l-.3 2.5a7.6 7.6 0 0 0-1.7 1l-2.3-1-2 3.4 2 1.5a7.8 7.8 0 0 0 0 2l-2 1.5 2 3.4 2.3-1a7.6 7.6 0 0 0 1.7 1l.3 2.5h4l.3-2.5a7.6 7.6 0 0 0 1.7-1l2.3 1 2-3.4z"/>',
        'app-reload':'<path d="M20 11a8.2 8.2 0 1 0 1.1 4.1"/><path d="M20 4v7h-7"/>',
        'setting-theme':'<circle cx="12" cy="12" r="3.6"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19"/>',
        'setting-accent':'<path d="M12 3a9 9 0 1 0 0 18 2.5 2.5 0 0 0 0-5h-1a2 2 0 0 1 0-4h2a3 3 0 0 0 0-6Z"/><circle cx="7.5" cy="11" r=".8" fill="currentColor"/><circle cx="10" cy="7.5" r=".8" fill="currentColor"/><circle cx="14.2" cy="7.2" r=".8" fill="currentColor"/>',
        'setting-font':'<path d="M5 19 10 5h4l5 14M7.2 14h9.6"/>',
        'setting-toolbar':'<path d="M4 6h16M4 12h11M4 18h16"/><circle cx="17" cy="12" r="2"/>',
        'setting-quick-menu':'<path d="M5 5h5v5H5zM14 5h5v5h-5zM5 14h5v5H5zM14 14h5v5h-5z"/>',
        'setting-install':'<path d="M12 3v11M8 10l4 4 4-4"/><path d="M5 18v2h14v-2"/>',
        'setting-backup':'<path d="M5 4h11l3 3v13H5z"/><path d="M8 4v5h8V4M8 18h8v-5H8z"/>',
        'setting-restore':'<path d="M5 8V4h4M5 4a8 8 0 1 1-1 8"/><path d="M12 8v8M8.5 12 12 8l3.5 4"/>',
        'setting-auto-backup':'<circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/>',
        'setting-storage':'<path d="M4 5h16v14H4z"/><path d="M4 9h16M8 13h3M8 16h7"/>',
        'setting-reset':'<path d="M12 3 2.8 20h18.4Z"/><path d="M12 9v5M12 17h.01"/>',
        'setting-manual':'<path d="M4 5.5c2.5-1 5.2-.6 8 1.2 2.8-1.8 5.5-2.2 8-1.2v13c-2.5-1-5.2-.6-8 1.2-2.8-1.8-5.5-2.2-8-1.2Z"/><path d="M12 6.7v13"/>'
      }[id] || '<circle cx="12" cy="12" r="8"/><path d="M12 8v5M12 16h.01"/>';
      return `<svg viewBox="0 0 24 24" aria-hidden="true">${art}</svg>`;
    }
    if (kind === "project") return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"/><path d="M3 10h18" opacity=".55"/></svg>';
    if (kind === "note") return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h9l3 3v15H6z"/><path d="M14 3v4h4M9 11h6M9 15h6"/></svg>';
    if (kind === "create") return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/><circle cx="12" cy="12" r="9" opacity=".45"/></svg>';
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/><circle cx="12" cy="12" r="9" opacity=".32"/></svg>';
  }
  function quickMenuSlotMedia(slot) {
    const image = slot && safeImageSource(slot.thumbnail);
    const code = slot && normalizeQuickMenuIconCode(slot.iconCode);
    const library = slot && quickMenuLibraryIcon(slot.libraryIconId);
    // v66.4: 업로드 이미지·내장 라이브러리·사용자 SVG/CSS는 모두 같은 "아트" 타입입니다.
    // 이 타입은 공통 기능 아이콘 프레임을 상속하지 않으므로 실제 메뉴와 편집 미리보기가 완전히 같은 상태로 그려집니다.
    const artType = code ? "code" : library ? "library" : image ? "image" : "";
    const cls = artType ? `qm-art-media has-${artType}-art${code ? " has-code-icon" : ""}${library ? " has-library-icon" : ""}${image ? " has-image-art" : ""}` : "";
    const content = code ? quickMenuCustomIconMarkup(code) : (image ? `<img src="${esc(image)}" alt="">` : (library ? quickMenuLibraryIconMarkup(library.id, "quick-menu-library-icon") : quickMenuIcon(slot)));
    return `<span class="quick-slot-media ${cls}"${artType ? ` data-qm-art="${artType}"` : ""}>${content}</span>`;
  }
  function quickMenuSlotMarkup(slot, index, manager) {
    const filled = !!(slot && slot.kind), cls = filled ? "is-filled" : "is-empty";
    const label = quickMenuSlotLabel(slot), meta = quickMenuSlotMeta(slot);
    if (manager) {
      return `<button type="button" class="qm-manager-slot ${cls}" data-qm-manage-slot="${index}">${quickMenuSlotMedia(slot)}<span class="qm-manager-copy"><b>${esc(label)}</b><small>${esc(filled ? `${quickMenuSlotActionName(slot)} · ${meta}` : "동작과 썸네일을 등록할 수 있어요")}</small></span><span class="qm-manager-index">SLOT ${String(index + 1).padStart(2, "0")}</span></button>`;
    }
    const aria = filled ? `${quickMenuSlotActionName(slot)}: ${label}` : `빈 슬롯 ${index + 1} 등록`;
    return `<button type="button" class="quick-menu-slot ${cls}" aria-label="${esc(aria)}" title="${esc(label)}" ${filled ? `data-qm-run="${index}"` : `data-qm-empty="${index}"`}>${quickMenuSlotMedia(slot)}<span class="quick-slot-copy"><b>${esc(label)}</b><small>${esc(meta)}</small></span><span class="quick-slot-arrow" aria-hidden="true">${filled ? "›" : "+"}</span><span class="quick-slot-num">${String(index + 1).padStart(2, "0")}</span></button>`;
  }
  function setQuickMenuOpen(open) {
    const on = !!open && quickMenuIsEnabled();
    document.body.classList.toggle("quick-menu-open", on);
    const tab = $("quickMenuTab"); if (tab) { tab.setAttribute("aria-expanded", String(on)); tab.setAttribute("aria-label", on ? "퀵 메뉴 접기" : "퀵 메뉴 펼치기"); }
  }
  function renderQuickMenu() {
    const box = $("quickMenuSlots"), count = $("quickMenuCount"), meta = $("quickMenuSlotMeta"), settingSub = $("setQuickMenuSub"), settingVal = $("setQuickMenuVal"), root = $("quickMenu");
    const cfg = quickMenuConfig(), enabled = cfg.enabled !== false, mini = cfg.displayMode === "mini";
    const limit = quickMenuSlotLimit(cfg);
    if (root) {
      root.hidden = !enabled;
      root.classList.toggle("is-mini", mini);
      root.setAttribute("aria-hidden", String(!enabled));
    }
    document.body.classList.toggle("quick-menu-disabled", !enabled);
    if (!enabled && document.body.classList.contains("quick-menu-open")) setQuickMenuOpen(false);
    if (box) {
      const markup = cfg.slots.map((slot, index) => quickMenuSlotMarkup(slot, index, false)).join("");
      // 화면 전환마다 동일한 슬롯을 재삽입하면 fixed 패널의 높이·중심점이 미세하게 다시 계산될 수 있어요.
      // 내용이 실제로 달라졌을 때만 교체해서 위치 흔들림을 막습니다.
      if (box.dataset.qmMarkup !== markup) {
        box.dataset.qmMarkup = markup;
        box.innerHTML = markup;
        box.querySelectorAll("[data-qm-run]").forEach((button) => button.addEventListener("click", () => { void runQuickMenuSlot(Number(button.dataset.qmRun)); }));
        box.querySelectorAll("[data-qm-empty]").forEach((button) => button.addEventListener("click", () => { setQuickMenuOpen(false); openQuickMenuSlotTypePicker(Number(button.dataset.qmEmpty)); }));
      }
    }
    const filled = quickMenuFilledCount();
    if (count) count.textContent = `${filled} / ${limit} 등록`;
    if (meta) meta.textContent = `SWIPE · ${limit} SLOTS`;
    if (settingSub) settingSub.textContent = enabled ? `오른쪽 가장자리 · ${quickMenuDisplayModeName(cfg)} · ${filled}/${limit} 등록` : "사용 안 함 · 퀵 메뉴 탭 숨김";
    if (settingVal) settingVal.textContent = enabled ? `${quickMenuDisplayModeName(cfg)} ›` : "꺼짐 ›";
  }
  async function persistQuickMenu(options) {
    const opt = options || {}, cfg = normalizeQuickMenu(quickMenuConfig());
    cfg.updatedAt = now(); st.quickMenu = cfg;
    await put("settings", { id: QUICK_MENU_SETTING_ID, value: jsonCopy(cfg), updatedAt: cfg.updatedAt });
    if (opt.backup !== false) triggerAutoBackup();
    renderQuickMenu();
    if (typeof curView === "function" && curView().s === "settings") renderSettings();
  }
  async function setQuickMenuSlotCount(value) {
    const cfg = quickMenuConfig(), next = quickMenuSlotCount(value);
    if (quickMenuSlotLimit(cfg) === next) return;
    const current = cfg.slots.slice(0, next);
    while (current.length < next) current.push(emptyQuickMenuSlot(current.length));
    cfg.slotCount = next;
    cfg.slots = current.map((slot, index) => Object.assign(emptyQuickMenuSlot(index), slot || {}, { slotId: index + 1 }));
    await persistQuickMenu();
  }
  async function loadQuickMenuSetting() {
    try {
      const row = await getOne("settings", QUICK_MENU_SETTING_ID);
      st.quickMenu = normalizeQuickMenu(row && row.value);
    } catch (e) { st.quickMenu = normalizeQuickMenu(null); }
    const changed = await pruneQuickMenuReferences(false);
    if (changed) await persistQuickMenu({ backup: false });
    renderQuickMenu();
  }
  async function restoreQuickMenuConfig(value) {
    if (!value || typeof value !== "object") return;
    st.quickMenu = normalizeQuickMenu(value);
    await pruneQuickMenuReferences(false);
    await persistQuickMenu({ backup: false });
  }
  async function pruneQuickMenuReferences(shouldPersist) {
    const cfg = quickMenuConfig(); let changed = false;
    cfg.slots.forEach((slot, index) => {
      if (!slot || !slot.kind) return;
      if (slot.kind === "project" && !getProject(slot.targetId)) { cfg.slots[index] = emptyQuickMenuSlot(index); changed = true; return; }
      if (slot.kind === "note" && !getNote(slot.targetId)) { cfg.slots[index] = emptyQuickMenuSlot(index); changed = true; return; }
      if (slot.kind === "create" && slot.createProjectId && !getProject(slot.createProjectId)) { slot.createProjectId = null; changed = true; }
    });
    if (changed && shouldPersist) await persistQuickMenu({ backup: false });
    else if (changed) renderQuickMenu();
    return changed;
  }
  function replaceQuickMenuSlot(index, next) {
    const cfg = quickMenuConfig(), old = cfg.slots[index] || emptyQuickMenuSlot(index);
    cfg.slots[index] = Object.assign(emptyQuickMenuSlot(index), {
      thumbnail: old.thumbnail || null,
      iconCode: normalizeQuickMenuIconCode(old.iconCode),
      label: old.label || ""
    }, next || {});
    return cfg.slots[index];
  }
  async function setQuickMenuSlot(index, next, options) {
    if (!Number.isInteger(index) || index < 0 || index >= quickMenuSlotLimit()) return;
    replaceQuickMenuSlot(index, next);
    await persistQuickMenu(options);
  }
  async function clearQuickMenuSlot(index) {
    const cfg = quickMenuConfig(); cfg.slots[index] = emptyQuickMenuSlot(index);
    await persistQuickMenu();
  }
  async function quickThumbnailFromFile(file) {
    const { img, url } = await validateImageFile(file, { maxBytes: 4 * 1024 * 1024, maxPixels: 12 * 1000 * 1000, limitText: "퀵 메뉴 썸네일은 4MB 이하, 1,200만 픽셀 이하만 사용할 수 있어요" });
    try {
      const side = Math.min(img.naturalWidth, img.naturalHeight), sx = Math.max(0, Math.round((img.naturalWidth - side) / 2)), sy = Math.max(0, Math.round((img.naturalHeight - side) / 2));
      const canvas = document.createElement("canvas"); canvas.width = 320; canvas.height = 320;
      canvas.getContext("2d").drawImage(img, sx, sy, side, side, 0, 0, 320, 320);
      return canvas.toDataURL("image/jpeg", .86);
    } finally { URL.revokeObjectURL(url); }
  }
  async function openQuickMenuStorageInfo() {
    const val = $("setStorageVal")?.textContent || "저장공간", sub = $("setStorageSub")?.textContent || "브라우저 저장소 사용량을 확인합니다.";
    openModal(`<h3>저장공간</h3><p class="m-sub"><b>${esc(val)}</b><br>${esc(sub)}<br><br>표시 용량은 이 사이트가 브라우저에 저장한 데이터와 자동 백업을 포함해요. 이미지가 많을수록 자동 백업도 함께 커집니다.</p><div class="m-row"><button class="m-btn primary" id="storageClose">확인</button></div>`);
    $on("storageClose", "click", closeModal);
  }
  async function openInstallStartPage() { await flushPending(); window.location.href = "./lumi-ink-get-started.html?from=app"; }
  async function openManualPage() { await flushPending(); window.location.href = "./Lumi_Ink_Manual_1.html?from=app"; }
  async function runQuickMenuFunction(functionId) {
    const id = quickMenuFunction(functionId).id;
    setQuickMenuOpen(false);
    if (id === "home") { await goHome(); return; }
    if (id === "settings") { await flushPending(); go({ s:"settings" }); return; }
    if (id === "app-reload") { await flushPending(); window.location.reload(); return; }
    if (id === "setting-theme") { applyTheme(st.theme === "light" ? "dark" : "light"); renderSettings(); return; }
    if (id === "setting-accent") { openAccentPicker(); return; }
    if (id === "setting-font") { showFontDialog(); return; }
    if (id === "setting-toolbar") { openFormatbarModePicker(); return; }
    if (id === "setting-quick-menu") { openQuickMenuSettings(); return; }
    if (id === "setting-install") { await openInstallStartPage(); return; }
    if (id === "setting-backup") { await exportBackup(); return; }
    if (id === "setting-restore") { $("restoreInput")?.click(); return; }
    if (id === "setting-auto-backup") { openAutoBackupList(); return; }
    if (id === "setting-storage") { await openQuickMenuStorageInfo(); return; }
    if (id === "setting-reset") { resetData(); return; }
    if (id === "setting-manual") { await openManualPage(); }
  }
  async function runQuickMenuSlot(index) {
    const slot = quickMenuConfig().slots[index];
    if (!slot || !slot.kind) { openQuickMenuSlotTypePicker(index); return; }
    if (slot.kind === "function") { await runQuickMenuFunction(slot.functionId); return; }
    if (slot.kind === "project") {
      const p = getProject(slot.targetId);
      if (!p) { await pruneQuickMenuReferences(true); toast("삭제된 프로젝트 바로가기를 정리했어요"); return; }
      setQuickMenuOpen(false); await openProject(p.id); return;
    }
    if (slot.kind === "note") {
      const n = getNote(slot.targetId);
      if (!n) { await pruneQuickMenuReferences(true); toast("삭제된 메모 바로가기를 정리했어요"); return; }
      setQuickMenuOpen(false); await openNote(n.id); return;
    }
    setQuickMenuOpen(false);
    const configured = slot.createProjectId && getProject(slot.createProjectId);
    const current = st.curProjectId && getProject(st.curProjectId);
    const pid = (configured || current) && (configured || current).id;
    if (pid) { await quickCreateFromSlot(slot, pid); return; }
    pickTargetProject(null, (projectId) => { void quickCreateFromSlot(slot, projectId); });
  }
  async function quickCreateFromSlot(slot, projectId) {
    const type = QUICK_MENU_ALLOWED_TYPES.has(slot.createType) ? slot.createType : "free";
    const p = getProject(projectId); if (!p) { toast("저장할 프로젝트를 찾지 못했어요"); return; }
    try {
      await flushPending();
      const n = await createNote(type, p.id, (type === "persona" || type === "character") ? { characterMode: slot.createMode === "collection" ? "collection" : "single" } : null);
      triggerAutoBackup();
      await openNote(n.id);
    } catch (e) { console.warn("quick menu create", e); toast("새 메모를 만들지 못했어요"); }
  }
  function openQuickMenuSettings() {
    const cfg = quickMenuConfig(), enabled = cfg.enabled !== false, mode = cfg.displayMode === "mini" ? "mini" : "full";
    const slotCount = quickMenuSlotLimit(cfg);
    const modePreview = (kind) => kind === "mini"
      ? `<span class="qm-display-schematic mini" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></span>`
      : `<span class="qm-display-schematic full" aria-hidden="true"><i></i><i></i><i></i></span>`;
    openModal(`<h3>퀵 메뉴 설정</h3><p class="m-sub">오른쪽 가장자리에서 빠르게 꺼내 쓰는 개인 런처예요. 숨기더라도 슬롯과 썸네일 구성은 그대로 보관됩니다.</p>
      <div class="qm-settings-card">
        <button type="button" class="qm-settings-toggle" id="qmToggleEnabled" role="switch" aria-checked="${enabled ? "true" : "false"}">
          <span class="qm-settings-toggle-copy"><b>퀵 메뉴 사용</b><small>${enabled ? "오른쪽 엣지 탭과 슬라이드 동작이 켜져 있어요" : "탭과 엣지 슬라이드는 숨겨진 상태예요"}</small></span>
          <span class="lore-switch ${enabled ? "on" : ""}" aria-hidden="true"></span>
        </button>
      </div>
      <div class="qm-settings-section"><div class="qm-settings-section-title">표시 형태</div><div class="qm-display-options">
        <button type="button" class="qm-display-option ${mode === "full" ? "is-active" : ""}" data-qm-display-mode="full">${modePreview("full")}<span><b>기본형</b><small>아이콘 · 제목 · 설명을 함께 표시</small></span></button>
        <button type="button" class="qm-display-option ${mode === "mini" ? "is-active" : ""}" data-qm-display-mode="mini">${modePreview("mini")}<span><b>미니형</b><small>설명 없이 아이콘만 간결하게 표시</small></span></button>
      </div></div>
      <div class="qm-settings-section"><div class="qm-settings-section-title">슬롯 개수</div>
        <div class="qm-slot-count-setting">
          <input id="qmSlotCountRange" type="range" min="${QUICK_MENU_MIN}" max="${QUICK_MENU_MAX}" step="1" value="${slotCount}" aria-label="퀵 메뉴 슬롯 개수">
          <label><input id="qmSlotCountInput" type="number" min="${QUICK_MENU_MIN}" max="${QUICK_MENU_MAX}" step="1" value="${slotCount}" inputmode="numeric" aria-label="퀵 메뉴 슬롯 개수 직접 입력"><span>개</span></label>
        </div>
      </div>
      <div class="qm-settings-manage"><span><b>등록한 바로가기</b><small>${quickMenuFilledCount()} / ${slotCount} 슬롯 사용 중</small></span><button type="button" class="m-btn primary" id="qmOpenManager">슬롯 편집</button></div>
      <div class="m-row"><button class="m-btn" id="qmSettingsClose">닫기</button></div>`);
    $on("qmToggleEnabled", "click", async () => {
      quickMenuConfig().enabled = !quickMenuIsEnabled();
      await persistQuickMenu();
      openQuickMenuSettings();
    });
    $("modalBox").querySelectorAll("[data-qm-display-mode]").forEach((button) => button.addEventListener("click", async () => {
      const next = button.dataset.qmDisplayMode === "mini" ? "mini" : "full";
      if (quickMenuConfig().displayMode === next) return;
      quickMenuConfig().displayMode = next;
      await persistQuickMenu();
      openQuickMenuSettings();
    }));
    const syncSlotCount = (value) => {
      const next = quickMenuSlotCount(value);
      const range = $("qmSlotCountRange"), input = $("qmSlotCountInput");
      if (range) range.value = String(next);
      if (input) input.value = String(next);
      return next;
    };
    $on("qmSlotCountRange", "input", (event) => syncSlotCount(event.target.value));
    $on("qmSlotCountRange", "change", async (event) => { await setQuickMenuSlotCount(syncSlotCount(event.target.value)); openQuickMenuSettings(); });
    $on("qmSlotCountInput", "change", async (event) => { await setQuickMenuSlotCount(syncSlotCount(event.target.value)); openQuickMenuSettings(); });
    $on("qmOpenManager", "click", openQuickMenuManager);
    $on("qmSettingsClose", "click", closeModal);
  }

  function openQuickMenuManager() {
    const cfg = quickMenuConfig(), limit = quickMenuSlotLimit(cfg);
    openModal(`<h3>퀵 메뉴 편집</h3><p class="m-sub">화면 오른쪽의 숨김 탭을 밀어 펼치면 사용할 최대 ${limit}개의 바로가기를 정해요. 등록 대상이 삭제되면 해당 슬롯은 자동으로 비워집니다.</p><div class="qm-manager-grid">${cfg.slots.map((slot, index) => quickMenuSlotMarkup(slot, index, true)).join("")}</div><div class="m-row"><button class="m-btn" id="qmManagerClose">닫기</button></div>`);
    $("modalBox").querySelectorAll("[data-qm-manage-slot]").forEach((button) => button.addEventListener("click", () => {
      const index = Number(button.dataset.qmManageSlot), slot = quickMenuConfig().slots[index];
      if (slot && slot.kind) openQuickMenuSlotEditor(index); else openQuickMenuSlotTypePicker(index);
    }));
    $on("qmManagerClose", "click", closeModal);
  }
  function openQuickMenuSlotTypePicker(index) {
    const blank = emptyQuickMenuSlot(index);
    openModal(`<h3>슬롯 ${index + 1} 등록</h3><p class="m-sub">바로 실행할 동작을 고르세요. 썸네일과 표시 이름은 다음 화면에서 바꿀 수 있어요.</p><div class="qm-choice-list">
      <button type="button" class="qm-choice" data-qm-kind="function">${quickMenuSlotMedia(Object.assign(blank,{kind:"function",functionId:"home"}))}<span class="qm-choice-copy"><b>기능 바로가기</b><small>홈 · 설정 · 설정 목록의 기능을 바로 실행</small></span><span class="qm-choice-arrow">›</span></button>
      <button type="button" class="qm-choice" data-qm-kind="project">${quickMenuSlotMedia(Object.assign(blank,{kind:"project"}))}<span class="qm-choice-copy"><b>프로젝트 바로가기</b><small>특정 프로젝트를 한 번에 열기</small></span><span class="qm-choice-arrow">›</span></button>
      <button type="button" class="qm-choice" data-qm-kind="note">${quickMenuSlotMedia(Object.assign(blank,{kind:"note"}))}<span class="qm-choice-copy"><b>내 글 바로가기</b><small>특정 메모를 바로 열기 · 이동 경로 자동 반영</small></span><span class="qm-choice-arrow">›</span></button>
      <button type="button" class="qm-choice" data-qm-kind="create">${quickMenuSlotMedia(Object.assign(blank,{kind:"create"}))}<span class="qm-choice-copy"><b>메모 바로 만들기</b><small>메모 타입과 저장 위치를 미리 지정</small></span><span class="qm-choice-arrow">›</span></button>
    </div><div class="m-row"><button class="m-btn" id="qmTypeCancel">취소</button></div>`);
    $("modalBox").querySelectorAll("[data-qm-kind]").forEach((button) => button.addEventListener("click", async () => {
      const kind = button.dataset.qmKind;
      if (kind === "function") openQuickMenuFunctionPicker(index);
      else if (kind === "project") openQuickMenuProjectPicker(index);
      else if (kind === "note") openQuickMenuNotePicker(index);
      else openQuickMenuCreateTypePicker(index);
    }));
    $on("qmTypeCancel", "click", closeModal);
  }
  function openQuickMenuFunctionPicker(index) {
    const blank = emptyQuickMenuSlot(index);
    const groups = [...new Set(QUICK_MENU_FUNCTIONS.map((item) => item.group))];
    const groupMarkup = groups.map((group) => {
      const rows = QUICK_MENU_FUNCTIONS.filter((item) => item.group === group).map((item) => `<button type="button" class="qm-picker-row qm-function-row" data-qm-function="${esc(item.id)}">${quickMenuSlotMedia(Object.assign(blank,{kind:"function",functionId:item.id}))}<span><b>${esc(item.label)}</b><small>${esc(item.meta)}</small></span><i>›</i></button>`).join("");
      return `<section class="qm-function-group"><h4>${esc(group)}</h4><div class="qm-picker-list">${rows}</div></section>`;
    }).join("");
    openModal(`<h3>기능 바로가기</h3><p class="m-sub">홈과 설정 화면, 그리고 설정 목록의 각 기능을 퀵 메뉴 슬롯에 바로 연결할 수 있어요.</p><div class="qm-function-picker">${groupMarkup}</div><div class="m-row"><button class="m-btn" id="qmFunctionBack">뒤로</button></div>`);
    $("modalBox").querySelectorAll("[data-qm-function]").forEach((button) => button.addEventListener("click", async () => {
      await setQuickMenuSlot(index, { kind:"function", functionId:button.dataset.qmFunction });
      openQuickMenuSlotEditor(index);
    }));
    $on("qmFunctionBack", "click", () => openQuickMenuSlotTypePicker(index));
  }

  function openQuickMenuProjectPicker(index) {
    const list = st.projects.slice().sort((a,b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    openModal(`<h3>프로젝트 바로가기</h3><p class="m-sub">삭제되면 이 퀵 메뉴 슬롯도 자동으로 비워집니다.</p><div class="qm-picker-list">${list.length ? list.map((p) => `<button type="button" class="qm-picker-row" data-qm-project="${esc(p.id)}"><b>${esc(p.name)}</b><small>${esc(p.description || "프로젝트 열기")}</small></button>`).join("") : '<div class="qm-picker-empty">먼저 프로젝트를 만들어 주세요.</div>'}</div><div class="m-row"><button class="m-btn" id="qmProjectBack">뒤로</button></div>`);
    $("modalBox").querySelectorAll("[data-qm-project]").forEach((button) => button.addEventListener("click", async () => {
      await setQuickMenuSlot(index, { kind: "project", targetId: button.dataset.qmProject }); openQuickMenuSlotEditor(index);
    }));
    $on("qmProjectBack", "click", () => openQuickMenuSlotTypePicker(index));
  }
  function openQuickMenuNotePicker(index) {
    let query = "";
    const draw = () => {
      const host = $("qmNoteList"); if (!host) return;
      const q = query.trim().toLocaleLowerCase("ko");
      const list = st.notes.slice().filter((n) => !q || `${n.title || ""} ${getProject(n.projectId)?.name || ""} ${noteTypeLabel(n)}`.toLocaleLowerCase("ko").includes(q)).sort((a,b) => (b.updatedAt || 0) - (a.updatedAt || 0));
      host.innerHTML = list.length ? list.map((n) => { const p = getProject(n.projectId); return `<button type="button" class="qm-picker-row" data-qm-note="${esc(n.id)}"><b>${esc(n.title || "제목 없는 메모")}</b><small>${esc(`${p ? p.name : "프로젝트 없음"} · ${noteTypeLabel(n)}`)}</small></button>`; }).join("") : '<div class="qm-picker-empty">일치하는 메모가 없어요.</div>';
      host.querySelectorAll("[data-qm-note]").forEach((button) => button.addEventListener("click", async () => { await setQuickMenuSlot(index, { kind: "note", targetId: button.dataset.qmNote }); openQuickMenuSlotEditor(index); }));
    };
    openModal(`<h3>내 글 바로가기</h3><p class="m-sub">메모가 다른 프로젝트로 이동해도 이 바로가기는 같은 글을 따라가요.</p><input class="m-input" id="qmNoteSearch" type="search" autocomplete="off" placeholder="제목 또는 프로젝트 검색"><div class="qm-picker-list" id="qmNoteList"></div><div class="m-row"><button class="m-btn" id="qmNoteBack">뒤로</button></div>`);
    $on("qmNoteSearch", "input", (event) => { query = event.target.value || ""; draw(); });
    $on("qmNoteBack", "click", () => openQuickMenuSlotTypePicker(index)); draw();
  }
  function openQuickMenuCreateTypePicker(index) {
    const options = [
      ["free", "single", "자유 메모", "바로 빈 문서 열기"], ["html", "single", "코드 작업실", "HTML · JSON · MD 원본 편집 시작"], ["regex", "single", "정규식 작업실", "SillyTavern Regex 만들기"], ["lorebook", "single", "로어북", "World Info용 항목 만들기"], ["log", "single", "로그 저장", "대화 로그용 메모 만들기"],
      ["persona", "single", "페르소나", "단일 페르소나 카드"], ["persona", "collection", "다인 페르소나", "페르소나 모음 카드"], ["character", "single", "캐릭터", "단일 캐릭터 카드"], ["character", "collection", "다인 캐릭터", "캐릭터 모음 카드"], ["idea", "single", "아이디어 보드", "자유 배치 보드 만들기"]
    ];
    openModal(`<h3>만들 메모 타입</h3><p class="m-sub">실행하면 이 타입의 새 메모를 바로 만듭니다.</p><div class="qm-picker-list">${options.map(([type, mode, label, desc]) => `<button type="button" class="qm-picker-row" data-qm-create-type="${type}" data-qm-create-mode="${mode}"><b>${esc(label)}</b><small>${esc(desc)}</small></button>`).join("")}</div><div class="m-row"><button class="m-btn" id="qmCreateTypeBack">뒤로</button></div>`);
    $("modalBox").querySelectorAll("[data-qm-create-type]").forEach((button) => button.addEventListener("click", () => openQuickMenuCreateProjectPicker(index, { createType: button.dataset.qmCreateType, createMode: button.dataset.qmCreateMode })));
    $on("qmCreateTypeBack", "click", () => openQuickMenuSlotTypePicker(index));
  }
  function openQuickMenuCreateProjectPicker(index, draft) {
    const projects = st.projects.slice().sort((a,b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    openModal(`<h3>새 메모 저장 위치</h3><p class="m-sub">고정 프로젝트를 고르면 한 번에 생성합니다. ‘현재 프로젝트’는 열고 있는 프로젝트가 없을 때만 선택창을 보여줘요.</p><div class="qm-picker-list"><button type="button" class="qm-picker-row" id="qmCreateCurrent"><b>현재 프로젝트에 만들기</b><small>홈에서는 실행할 때 프로젝트 선택</small></button>${projects.map((p) => `<button type="button" class="qm-picker-row" data-qm-create-project="${esc(p.id)}"><b>${esc(p.name)}</b><small>이 프로젝트에 바로 생성</small></button>`).join("")}</div><div class="m-row"><button class="m-btn" id="qmCreateProjectBack">뒤로</button></div>`);
    $on("qmCreateCurrent", "click", async () => { await setQuickMenuSlot(index, { kind: "create", createType: draft.createType, createMode: draft.createMode, createProjectId: null }); openQuickMenuSlotEditor(index); });
    $("modalBox").querySelectorAll("[data-qm-create-project]").forEach((button) => button.addEventListener("click", async () => { await setQuickMenuSlot(index, { kind: "create", createType: draft.createType, createMode: draft.createMode, createProjectId: button.dataset.qmCreateProject }); openQuickMenuSlotEditor(index); }));
    $on("qmCreateProjectBack", "click", () => openQuickMenuCreateTypePicker(index));
  }
  function openQuickMenuIconCodeEditor(index, draft) {
    const slot = quickMenuConfig().slots[index]; if (!slot || !slot.kind) { openQuickMenuSlotTypePicker(index); return; }
    const existing = normalizeQuickMenuIconCode(slot.iconCode);
    const state = Object.assign({ mode: existing ? existing.mode : "svg", svg: existing && existing.mode === "svg" ? existing.svg : "", html: existing && existing.mode === "css" ? existing.html : "", css: existing && existing.mode === "css" ? existing.css : "" }, draft || {});
    const svgMode = state.mode !== "css";
    const body = svgMode
      ? `<label class="qm-editor-label" for="qmIconSvg">SVG 코드</label><textarea class="m-input qm-code-input" id="qmIconSvg" spellcheck="false" placeholder="&lt;svg viewBox=&quot;0 0 24 24&quot; ...&gt;...&lt;/svg&gt;">${esc(state.svg || "")}</textarea><p class="qm-code-hint">외부 이미지·스크립트·&lt;foreignObject&gt;는 자동으로 제거됩니다. viewBox가 있는 단일 SVG를 권장해요.</p>`
      : `<label class="qm-editor-label" for="qmIconMarkup">HTML 마크업</label><textarea class="m-input qm-code-input qm-code-short" id="qmIconMarkup" spellcheck="false" placeholder="&lt;span class=&quot;orb&quot;&gt;&lt;/span&gt;">${esc(state.html || "")}</textarea><label class="qm-editor-label" for="qmIconCss">CSS 코드</label><textarea class="m-input qm-code-input" id="qmIconCss" spellcheck="false" placeholder=".orb { width:100%; height:100%; border-radius:50%; ... }">${esc(state.css || "")}</textarea><p class="qm-code-hint">CSS는 이 슬롯의 아이콘 영역 안으로만 자동 한정됩니다. 외부 URL·스크립트형 CSS는 저장되지 않습니다.</p>`;
    openModal(`<h3>슬롯 ${index + 1} 코드 아이콘</h3><p class="m-sub">이미지 업로드 대신 복붙 가능한 SVG 또는 CSS+마크업 아이콘을 등록합니다. 기본 아이콘과 사용자 썸네일은 그대로 보관돼요.</p><div class="qm-code-tabs"><button type="button" class="qm-code-tab ${svgMode ? "is-active" : ""}" id="qmIconModeSvg">SVG 코드</button><button type="button" class="qm-code-tab ${!svgMode ? "is-active" : ""}" id="qmIconModeCss">CSS + 마크업</button></div>${body}<div class="m-row"><button class="m-btn" id="qmIconCodeBack">뒤로</button>${existing ? '<button class="m-btn danger" id="qmIconCodeReset">코드 아이콘 해제</button>' : ''}<button class="m-btn primary" id="qmIconCodeSave">등록</button></div>`);
    const currentDraft = () => ({ mode: svgMode ? "svg" : "css", svg: svgMode ? ($("qmIconSvg")?.value || "") : "", html: !svgMode ? ($("qmIconMarkup")?.value || "") : "", css: !svgMode ? ($("qmIconCss")?.value || "") : "" });
    $on("qmIconModeSvg", "click", () => openQuickMenuIconCodeEditor(index, Object.assign(currentDraft(), { mode: "svg" })));
    $on("qmIconModeCss", "click", () => openQuickMenuIconCodeEditor(index, Object.assign(currentDraft(), { mode: "css" })));
    $on("qmIconCodeBack", "click", () => openQuickMenuSlotEditor(index));
    $on("qmIconCodeReset", "click", async () => { quickMenuConfig().slots[index].iconCode = null; await persistQuickMenu(); openQuickMenuSlotEditor(index); });
    $on("qmIconCodeSave", "click", async () => {
      const value = currentDraft();
      const safe = normalizeQuickMenuIconCode(value);
      if (!safe) { toast(svgMode ? "유효한 SVG 코드를 찾지 못했어요" : "유효한 CSS 아이콘 마크업과 CSS를 입력해 주세요"); return; }
      const current = quickMenuConfig().slots[index];
      current.iconCode = safe; current.thumbnail = null; current.libraryIconId = null;
      await persistQuickMenu();
      openQuickMenuSlotEditor(index);
    });
  }
  function openQuickMenuBuiltinIconPicker(index, category) {
    const slot = quickMenuConfig().slots[index]; if (!slot) return;
    const active = QUICK_MENU_ICON_CATEGORIES.some((row) => row[0] === category) ? category : "all";
    const available = QUICK_MENU_ICON_LIBRARY.filter((item) => active === "all" || item.category === active);
    const tabs = QUICK_MENU_ICON_CATEGORIES.map(([key, label]) => `<button type="button" class="qm-library-tab ${key === active ? "is-active" : ""}" data-qm-library-tab="${key}">${label}</button>`).join("");
    const cards = available.map((item) => quickMenuIconCardMarkup(item, slot.libraryIconId === item.id, "quick")).join("");
    openModal(`<h3>퀵메뉴 아이콘 모음</h3><p class="m-sub">루미잉크 벡터 아이콘 ${QUICK_MENU_ICON_LIBRARY.length}종입니다. 선택하면 해당 슬롯의 코드 아이콘과 사용자 썸네일은 해제되고, 테마에 반응하는 벡터 아이콘으로 바뀝니다.</p><div class="qm-library-tabs">${tabs}</div><div class="qm-library-grid">${cards}</div><div class="m-row"><button class="m-btn" id="qmLibraryBack">뒤로</button></div>`);
    $("modalBox").querySelectorAll("[data-qm-library-tab]").forEach((button) => button.addEventListener("click", () => openQuickMenuBuiltinIconPicker(index, button.dataset.qmLibraryTab)));
    $("modalBox").querySelectorAll("[data-qm-library-icon]").forEach((button) => button.addEventListener("click", async () => {
      const id = quickMenuLibraryIconId(button.dataset.qmLibraryIcon); if (!id) return;
      const current = quickMenuConfig().slots[index]; current.libraryIconId = id; current.thumbnail = null; current.iconCode = null;
      await persistQuickMenu(); openQuickMenuSlotEditor(index);
    }));
    $on("qmLibraryBack", "click", () => openQuickMenuSlotEditor(index));
  }

  function openQuickMenuSlotEditor(index) {
    const slot = quickMenuConfig().slots[index]; if (!slot || !slot.kind) { openQuickMenuSlotTypePicker(index); return; }
    openModal(`<h3>슬롯 ${index + 1} 편집</h3><p class="m-sub">기본 아이콘, 사용자 썸네일, 또는 SVG/CSS 코드 아이콘 중 원하는 방식을 등록할 수 있어요.</p><div class="qm-entry-preview">${quickMenuSlotMedia(slot)}<span class="qm-entry-preview-copy"><b>${esc(quickMenuSlotLabel(slot))}</b><small>${esc(`${quickMenuSlotActionName(slot)} · ${quickMenuSlotMeta(slot)}`)}</small></span></div><label class="qm-editor-label" for="qmSlotLabel">표시 이름 <span style="font-weight:500">(비우면 대상 이름을 자동 표시)</span></label><input class="m-input" id="qmSlotLabel" maxlength="42" value="${esc(slot.label || "")}" placeholder="예: 진행 중인 세계관"><div class="qm-editor-actions"><button class="m-btn" id="qmChangeAction">동작 변경</button><button class="m-btn" id="qmBuiltinIcon">아이콘 모음</button><button class="m-btn" id="qmThumbPick">썸네일 업로드</button><button class="m-btn" id="qmCodeIcon">SVG/CSS 아이콘</button><button class="m-btn qm-wide" id="qmDefaultIcon">기본 설정</button><button class="m-btn danger qm-wide" id="qmSlotDelete">이 슬롯 비우기</button></div><div class="m-row"><button class="m-btn" id="qmEditorBack">목록</button><button class="m-btn primary" id="qmEditorSave">저장</button></div>`);
    const saveLabel = async (stay) => {
      const cfg = quickMenuConfig(), current = cfg.slots[index]; if (!current) return;
      current.label = cleanImportedText($("qmSlotLabel").value || "", 42).trim(); await persistQuickMenu();
      if (stay) openQuickMenuManager(); else closeModal();
    };
    $on("qmChangeAction", "click", async () => { quickMenuConfig().slots[index].label = cleanImportedText($("qmSlotLabel").value || "", 42).trim(); await persistQuickMenu(); openQuickMenuSlotTypePicker(index); });
    $on("qmBuiltinIcon", "click", async () => { quickMenuConfig().slots[index].label = cleanImportedText($("qmSlotLabel").value || "", 42).trim(); await persistQuickMenu(); openQuickMenuBuiltinIconPicker(index); });
    $on("qmThumbPick", "click", async () => { quickMenuConfig().slots[index].label = cleanImportedText($("qmSlotLabel").value || "", 42).trim(); await persistQuickMenu(); quickMenuImageSlot = index; $("quickMenuImageInput").click(); });
    $on("qmCodeIcon", "click", async () => { quickMenuConfig().slots[index].label = cleanImportedText($("qmSlotLabel").value || "", 42).trim(); await persistQuickMenu(); openQuickMenuIconCodeEditor(index); });
    $on("qmDefaultIcon", "click", async () => { const current = quickMenuConfig().slots[index]; current.thumbnail = null; current.iconCode = null; current.libraryIconId = null; await persistQuickMenu(); toast("기본 아이콘으로 되돌렸어요"); openQuickMenuSlotEditor(index); });
    $on("qmSlotDelete", "click", () => confirmModal("퀵 메뉴 슬롯 비우기", `슬롯 ${index + 1}의 바로가기와 사용자 지정 아이콘을 지울까요?`, "비우기", true, async () => { await clearQuickMenuSlot(index); openQuickMenuManager(); }));
    $on("qmEditorBack", "click", () => { void saveLabel(true); });
    $on("qmEditorSave", "click", () => { void saveLabel(false); });
  }

  /* ---------- crash-safe local drafts ---------- */
  const DRAFT_PREFIX = "lumink:draft:v1:";
  const DRAFT_MAX_CHARS = 700000;
  const DRAFT_MAX_AGE = 1000 * 60 * 60 * 24 * 14;
  const draftPrompted = new Set();
  function jsonCopy(v) { try { return JSON.parse(JSON.stringify(v)); } catch (e) { return null; } }
  function jsonSame(a, b) { try { return JSON.stringify(a) === JSON.stringify(b); } catch (e) { return false; } }
  function draftKey(n) { return DRAFT_PREFIX + (n && n.id ? n.id : ""); }
  function readDraft(n) {
    if (!n || !n.id) return null;
    try {
      const raw = localStorage.getItem(draftKey(n));
      if (!raw) return null;
      const d = JSON.parse(raw);
      if (!d || d.noteId !== n.id || !d.type || !d.at || (Date.now() - d.at) > DRAFT_MAX_AGE) { localStorage.removeItem(draftKey(n)); return null; }
      return d;
    } catch (e) { return null; }
  }
  function writeDraft(n, type, data) {
    if (!n || !n.id || !data) return;
    try {
      const item = { noteId: n.id, type, at: Date.now(), data: jsonCopy(data) };
      const raw = JSON.stringify(item);
      // localStorage는 대용량 이미지 초안 저장소가 아니므로 텍스트 중심으로만 안전망을 둡니다.
      if (raw.length > DRAFT_MAX_CHARS) return;
      localStorage.setItem(draftKey(n), raw);
    } catch (e) { /* 저장공간이 부족해도 편집을 막지 않음 */ }
  }
  function discardDraft(n) { try { if (n && n.id) localStorage.removeItem(draftKey(n)); } catch (e) {} }
  function clearDraftIfSynced(n, type, data) {
    const d = readDraft(n);
    if (d && d.type === type && jsonSame(d.data, data)) discardDraft(n);
  }
  function freeDraftFromEditor() { return { html: st.codeMode ? $("codeArea").value : $("editor").innerHTML }; }
  function htmlDraftFromEditor() { return { source: $("htmlSource").value }; }
  function regexDraftFromEditor() { return regexDataFromEditor(); }
  function loreDraftFromEditor(n) { const d = jsonCopy((n && n.data) || {}) || {}; d.content = $("loreEdit").value; return d; }
  function logDraftFromEditor(n) {
    const d = jsonCopy((n && n.data) || {}) || {};
    d.content = $("logEdit").value;
    // 이름 바꾸기 세트는 전용 팝업에서 즉시 저장합니다. 본문 자동저장은
    // 이미 저장된 다섯 세트를 보존한 채 원문만 갱신합니다.
    d.nameSets = normalizeLogNameSets(d.nameSets, d.personaNames, d.personaAlias);
    d.personaNames = d.nameSets[0].names.slice();
    d.personaAlias = d.nameSets[0].replacement;
    delete d.personaName;
    return d;
  }
  function personaDraftFromEditor(n) {
    const d = n && n.data ? n.data : {}; const ko = jsonCopy(d.ko || {}) || {}, en = jsonCopy(d.en || {}) || {};
    ko.name = $("perKoName").value; ko.detail = $("perKoDetail").value;
    en.name = $("perEnName").value; en.detail = $("perEnDetail").value;
    return { ko, en };
  }
  function draftDiffers(n, d) {
    if (!n || !d || !d.data) return false;
    if (d.type === "free") return !jsonSame({ html: noteHtml(n) }, d.data);
    if (d.type === "html") return !jsonSame({ source: htmlSourceOf(n) }, d.data);
    if (d.type === "regex") return !jsonSame(normalizeRegexData(n.data || {}), normalizeRegexData(d.data || {}));
    if (d.type === "lorebook") return !jsonSame((n.data || {}).content || "", d.data.content || "");
    if (d.type === "log") return !jsonSame(n.data || {}, d.data);
    if (d.type === "persona") {
      const cur = n.data || {};
      return !jsonSame({ ko: cur.ko || {}, en: cur.en || {} }, d.data);
    }
    if (d.type === "character") return !jsonSame(characterTextSnapshot(n, false), d.data);
    return false;
  }
  async function restoreDraft(n, d) {
    if (!n || !d) return;
    if (d.type === "free") {
      n.data = n.data || {}; n.data.html = String((d.data && d.data.html) || "");
      if (!n.titleLocked) n.title = deriveTitle(n.data.html);
      await saveNote(n);
    } else if (d.type === "html") {
      n.data = n.data || {}; n.data.source = String((d.data && d.data.source) || "").slice(0, HTML_SOURCE_MAX);
      n.data.previewPolicy = "sandbox-web";
      await saveNote(n);
    } else if (d.type === "regex") {
      n.data = normalizeRegexData(d.data || {});
      await saveNote(n);
    } else if (d.type === "lorebook") {
      n.data = normalizeLoreData(Object.assign({}, n.data || {}, jsonCopy(d.data) || {}));
      await saveLore(n, true);
    } else if (d.type === "log") {
      n.data = normalizeLogData(Object.assign({}, n.data || {}, jsonCopy(d.data) || {}));
      if (!n.titleLocked) n.title = deriveLogTitle(n.data.content);
      await saveLog(n, true);
    } else if (d.type === "persona") {
      n.data = n.data || {};
      n.data.ko = Object.assign({}, n.data.ko || {}, jsonCopy(d.data.ko) || {});
      n.data.en = Object.assign({}, n.data.en || {}, jsonCopy(d.data.en) || {});
      if (!n.titleLocked) n.title = (n.data.ko.name || "").trim() || (n.data.en.name || "").trim() || "이름 없는 페르소나";
      await savePersona(n, true);
    } else if (d.type === "character") {
      const cur = ensureCharacterData(n), text = d.data && Array.isArray(d.data.pages) ? d.data : null;
      if (text) {
        text.pages.forEach((saved) => {
          const page = cur.pages.find((p) => p.id === saved.id); if (!page) return;
          ["ko", "en"].forEach((lang) => {
            const o = saved[lang] || {}; page[lang].name = String(o.name || ""); page[lang].detail = String(o.detail || "");
            page[lang].tags = Array.isArray(o.tags) ? o.tags.map(String).filter(Boolean) : page[lang].tags;
          });
          page.creatorMemo = normalizeCreatorMemo(saved.creatorMemo);
        });
        if (text.activeId && cur.pages.some((p) => p.id === text.activeId)) cur.activeId = text.activeId;
      }
      syncCharacterTitle(n); await saveCharacter(n, true);
    }
    discardDraft(n);
  }
  function queueDraftRecovery(n, type) {
    if (!n || (n.type !== type && !(type === "character" && isCharacterCardType(n)))) return;
    const d = readDraft(n);
    if (!d || d.type !== type || d.at <= (n.updatedAt || 0) || !draftDiffers(n, d)) return;
    const token = n.id + ":" + d.at;
    if (draftPrompted.has(token)) return;
    draftPrompted.add(token);
    setTimeout(() => {
      if (getNote(n.id) !== n || curView().s === "home") return;
      openModal(`<h3>저장되지 않은 임시 기록</h3><p class="m-sub">${esc(n.title || "이 메모")}에 앱 종료 전 남아 있던 임시 기록이 있어요. 복구할까요?</p><div class="m-row"><button class="m-btn" id="draftDiscard">버리기</button><button class="m-btn primary" id="draftRestore">복구</button></div>`);
      $on("draftDiscard", "click", () => { discardDraft(n); closeModal(); toast("임시 기록을 지웠어요"); });
      $on("draftRestore", "click", async () => {
        closeModal();
        try { await restoreDraft(n, d); render(); toast("임시 기록을 복구했어요"); }
        catch (e) { toast("임시 기록을 복구하지 못했어요"); }
      });
    }, 80);
  }

  /* ---------- routing ---------- */
  const SCREENS = ["home", "project", "read", "editor", "html", "regex", "lore", "log", "persona", "character", "idea", "settings", "search"];
  const NOTE_SCREENS = new Set(["read", "editor", "html", "regex", "lore", "log", "persona", "character", "idea"]);
  function showScreen(s) { SCREENS.forEach((x) => $("screen-" + x).classList.toggle("active", x === s)); }
  function curView() { return st.viewStack[st.viewStack.length - 1]; }
  function normalizeRouteView(view) {
    const next = Object.assign({}, view || { s: "home" });
    if (NOTE_SCREENS.has(next.s) && !next.id && st.curNoteId) next.id = st.curNoteId;
    return next;
  }
  function restoreRouteView(view) {
    if (view && NOTE_SCREENS.has(view.s) && view.id && getNote(view.id)) st.curNoteId = view.id;
  }
  function render() {
    const v = curView();
    restoreRouteView(v);
    showScreen(v.s);
    if (v.s === "home") renderHome();
    else if (v.s === "project") renderProjectDetail();
    else if (v.s === "read") renderRead();
    else if (v.s === "editor") renderEditorMeta();
    else if (v.s === "html") renderHtmlWorkshop();
    else if (v.s === "regex") renderRegexWorkshop();
    else if (v.s === "lore") renderLore();
    else if (v.s === "log") renderLog();
    else if (v.s === "persona") renderPersona();
    else if (v.s === "character") renderCharacter();
    else if (v.s === "idea") renderIdeaBoard();
    else if (v.s === "settings") renderSettings();
    else if (v.s === "search") renderSearch();
    renderQuickMenu();
  }
  let navTransition = false;
  function commitGo(view) { st.viewStack.push(normalizeRouteView(view)); history.pushState({ d: st.viewStack.length }, ""); render(); }
  function go(view) {
    const cur = curView();
    // 자유 메모 에디터는 화면을 떠난 뒤 발생하는 blur/timer가 다른 메모에 쓰이지 않도록
    // 저장 완료 → 세션 종료 → 화면 전환 순서로만 이동합니다.
    if (cur && cur.s === "editor" && view && view.s !== "editor") {
      if (navTransition) return;
      navTransition = true;
      void (async () => { try { await leaveFreeEditor(); commitGo(view); } finally { navTransition = false; } })();
      return;
    }
    if (cur && cur.s === "html" && view && view.s !== "html") {
      if (navTransition) return;
      navTransition = true;
      void (async () => { try { await leaveHtmlWorkshop(); commitGo(view); } finally { navTransition = false; } })();
      return;
    }
    if (cur && cur.s === "regex" && view && view.s !== "regex") {
      if (navTransition) return;
      navTransition = true;
      void (async () => { try { await leaveRegexWorkshop(); commitGo(view); } finally { navTransition = false; } })();
      return;
    }
    if (cur && cur.s === "idea" && view && view.s !== "idea") {
      if (navTransition) return;
      navTransition = true;
      void (async () => { try { await flushIdeaBoard(); commitGo(view); } finally { navTransition = false; } })();
      return;
    }
    if (cur && cur.s === "log" && view && view.s !== "log") {
      if (navTransition) return;
      navTransition = true;
      void (async () => { try { await flushLog(); commitGo(view); } finally { navTransition = false; } })();
      return;
    }
    commitGo(view);
  }
  async function flushCurrentView(cur) {
    if (cur === "editor") await leaveFreeEditor();
    else if (cur === "html") await leaveHtmlWorkshop();
    else if (cur === "regex") await leaveRegexWorkshop();
    else if (cur === "lore") await flushLore();
    else if (cur === "log") await flushLog();
    else if (cur === "persona") await flushPersona();
    else if (cur === "character") await flushCharacter();
    else if (cur === "idea") await flushIdeaBoard();
  }
  async function back() {
    if (st.selMode) { exitSelMode(); return; }
    if (navTransition) return;
    const cur = curView().s;
    navTransition = true;
    try {
      await flushCurrentView(cur);
      if (st.viewStack.length > 1) { st.viewStack.pop(); render(); }
    } finally { navTransition = false; }
  }
  function closeTopOverlay() {
    if (st.selMode) { exitSelMode(); return true; }
    if (!$("cropper").hidden) { closeCropper(); return true; }
    if (!$("lightbox").hidden) { closeLightbox(); return true; }
    if ($("modalScrim").classList.contains("open")) { closeModal(); return true; }
    if (document.body.classList.contains("sheet-open")) { closeSheet(); return true; }
    if (document.body.classList.contains("sidebar-open")) { closeSidebar(); return true; }
    return false;
  }
  window.addEventListener("popstate", () => {
    if (closeTopOverlay()) { history.pushState({}, ""); return; }
    if (navTransition) { history.pushState({}, ""); return; }
    navTransition = true;
    void (async () => {
      try {
        await flushCurrentView(curView().s);
        if (st.viewStack.length > 1) { st.viewStack.pop(); render(); }
        else history.pushState({}, "");
      } finally { navTransition = false; }
    })();
  });

  /* ---------- migration ---------- */
  async function migrate() {
    // dedupe duplicate default projects (from older backup-merge bug)
    const defs = st.projects.filter((p) => p.isDefault).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    if (defs.length > 1) {
      const keep = defs[0];
      for (let i = 1; i < defs.length; i++) {
        const dup = defs[i];
        for (const n of st.notes) { if (n.projectId === dup.id) { n.projectId = keep.id; await put("notes", n); } }
        st.projects = st.projects.filter((p) => p.id !== dup.id);
        await del("projects", dup.id);
      }
    }
    // v49: 프레임 데이터도 프로젝트 레코드의 일부로 정규화합니다.
    // 구버전·외부 복원 데이터의 잘못된 프레임 ID/색상은 렌더링 전에 안전하게 제거합니다.
    for (const project of st.projects) {
      const validFrame = frameById(project.frame) ? project.frame : null;
      const validColor = validFrame ? (normalizeFrameColor(project.frameColor) || "#d4af37") : null;
      if ((project.frame || null) !== validFrame || (project.frameColor || null) !== validColor) {
        project.frame = validFrame;
        project.frameColor = validColor;
        await put("projects", project);
      }
    }
    // v63.24: 정식 배포 전의 프로젝트 연동 프레임 실험값은 조각별 독립 프레임 모델에서 제거합니다.
    for (const note of st.notes) {
      if (!note || note.type !== "idea" || !note.data || !Array.isArray(note.data.items)) continue;
      let changed = false;
      note.data.items.forEach((item) => {
        if (!item || typeof item !== "object") return;
        if (Object.prototype.hasOwnProperty.call(item, "frameLinked") || Object.prototype.hasOwnProperty.call(item, "useProjectFrame")) {
          if (item.frameLinked === true || (item.useProjectFrame === true && !frameById(item.frame))) { item.frame = null; item.frameColor = null; }
          delete item.frameLinked; delete item.useProjectFrame; changed = true;
        }
      });
      if (changed) await put("notes", note);
    }
    // v64: persona and character share the card editor but remain separate memo types.
    // Old persona records are normalized to the card data model without changing their type.
    const legacyPersonas = st.notes.filter((n) => n && n.type === "persona");
    if (legacyPersonas.length) {
      try { await doAutoBackup(); } catch (e) { console.warn("persona pre-migration backup", e); }
      for (const n of legacyPersonas) {
        if (!n.data || !Array.isArray(n.data.pages)) n.data = legacyPersonaDataToCharacterData(n.data, true);
        n.updatedAt = n.updatedAt || now();
        migratePersonaDraftToCharacter(n);
        await put("notes", n);
      }
    }
    const promotedPersonas = st.notes.filter((n) => n && n.type === "character" && n.data && n.data.legacySourceType === "persona");
    if (promotedPersonas.length) {
      for (const n of promotedPersonas) {
        n.type = "persona";
        n.updatedAt = n.updatedAt || now();
        await put("notes", n);
      }
    }
    const legacySinglePersonas = st.notes.filter((n) => n && n.type === "character" && n.data && n.data.mode === "single" && n.data.cardTypeVersion !== 2);
    if (legacySinglePersonas.length) {
      for (const n of legacySinglePersonas) {
        n.type = "persona";
        n.data.cardTypeVersion = 2;
        n.updatedAt = n.updatedAt || now();
        await put("notes", n);
      }
    }
    const cardNotes = st.notes.filter((n) => n && (n.type === "persona" || n.type === "character") && n.data && Array.isArray(n.data.pages));
    for (const n of cardNotes) {
      if (n.data.cardTypeVersion !== 2) {
        n.data.cardTypeVersion = 2;
        await put("notes", n);
      }
    }
    const projectIds = new Set(st.projects.map((p) => p.id));
    const orphans = st.notes.filter((n) => !n.projectId || !n.type || !projectIds.has(n.projectId));
    if (orphans.length === 0 && st.projects.length > 0) return;
    let def = st.projects.find((p) => p.isDefault) || st.projects[0];
    if (!def) {
      def = { id: uid(), name: "기본 메모함", description: "여기에 메모가 모입니다.", icon: DEFAULT_ICON, isDefault: true, createdAt: now(), updatedAt: now() };
      st.projects.push(def); await put("projects", def);
    }
    for (const n of orphans) {
      if (n.type && n.data && typeof n.data === "object") {
        n.projectId = def.id;
        n.updatedAt = n.updatedAt || now();
        await put("notes", n);
        continue;
      }
      const html = (n.data && n.data.html != null) ? n.data.html : (n.html || "");
      n.projectId = def.id;
      n.type = "free";
      n.title = n.title || deriveTitle(html);
      n.chipColor = n.chipColor || null;
      n.createdAt = n.createdAt || now();
      n.updatedAt = n.updatedAt || now();
      n.data = { html };
      delete n.html;
      await put("notes", n);
    }
  }

  /* ---------- renderers ---------- */
  function projectThumbMedia(p) {
    const libraryId = p && quickMenuLibraryIconId(p.iconLibraryId);
    const art = p && p.icon ? `<img src="${p.icon}" alt="">` : (libraryId ? quickMenuLibraryIconMarkup(libraryId, "project-library-icon") : '<span class="deflogo"></span>');
    return `<div class="thumb-media ${libraryId && !(p && p.icon) ? "has-library-icon" : ""}">${art}</div>`;
  }
  function projIconHTML(p, cls) {
    const framed = !!(p && frameById(p.frame));
    return `<div class="${cls}${framed ? " has-frame" : ""}">${projectThumbMedia(p)}${framed ? `<div class="frame">${frameInner(p)}</div>` : ""}</div>`;
  }

  const PIN_SVG = '<svg viewBox="0 0 24 24"><path d="M9 4h6l-1 6 3 3v2H7v-2l3-3z"/><path d="M12 15v5"/></svg>';
  const PIN_STAR = '<svg class="pin-star" viewBox="0 0 24 24"><path d="M12 2l2.7 6.6 7 .5-5.4 4.5 1.8 6.9L12 17.3 5.9 21l1.8-6.9L2.3 9.1l7-.5z"/></svg>';
  const SORT_LABELS = { recent: "최신순", recent_asc: "오래된순", name: "이름 ㄱ→ㅎ", name_desc: "이름 ㅎ→ㄱ" };
  const TYPE_COLOR = { free: "#7b9bff", html: "#5eead4", regex: "#4ad1a7", lorebook: "#6ad0ff", log: "#f0a44d", persona: "#c79bff", character: "#ff9fcb", idea: "#f0c967" };
  const TYPE_TAG = { free: "F", html: "H", regex: "X", lorebook: "R", log: "L", persona: "P", character: "C", idea: "I" };
  // Persona and character notes share the card editor, but stay separate memo types.
  function isCharacterCardType(n) { return !!n && (n.type === "character" || n.type === "persona"); }
  function characterMode(n) {
    if (!isCharacterCardType(n)) return "collection";
    const d = ensureCharacterData(n);
    return d.mode === "single" ? "single" : "collection";
  }
  function isSingleCharacter(n) { return n && n.type === "character" && characterMode(n) === "single"; }
  function visualMemoType(n) { return n && n.type ? n.type : ""; }
  function noteTypeLabel(n) { return TYPE_LABEL[visualMemoType(n)] || (n && n.type) || ""; }
  function noteTypeShortLabel(n) {
    const type = visualMemoType(n);
    return ({ free:"자유메모", html:"HTML", regex:"정규식", lorebook:"로어북", log:"로그", persona:"페르소나", character:"캐릭터", idea:"아이디어 보드" })[type] || noteTypeLabel(n);
  }
  function noteSectionKey(n) { return n && n.type ? n.type : ""; }
  function memoTagHTML(n) { const type = visualMemoType(n); return `<span class="memo-tag t-${type}">${TYPE_TAG[type] || "?"}</span>`; }
  function recentMemos(limit, scope) {
    limit = limit || 10;
    const flag = scope === "home" ? "pinnedHome" : scope === "side" ? "pinnedSide" : "pinned";
    const at = flag + "At";
    const all = st.notes.slice();
    const pinned = all.filter((n) => n[flag]).sort((a, b) => (b[at] || 0) - (a[at] || 0)).slice(0, 3);
    const pid = new Set(pinned.map((n) => n.id));
    const rest = all.filter((n) => !pid.has(n.id)).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    return [...pinned, ...rest].slice(0, limit);
  }
  function loadSorts() {
    try { st.homeSort = localStorage.getItem("luminkHomeSort") || "recent"; st.noteSort = localStorage.getItem("luminkNoteSort") || "recent"; }
    catch (e) { st.homeSort = "recent"; st.noteSort = "recent"; }
  }
  function sortList(arr, mode, nameOf, timeOf) {
    const a = arr.slice();
    a.sort((x, y) => {
      if (mode === "recent") return (timeOf(y) || 0) - (timeOf(x) || 0);
      if (mode === "recent_asc") return (timeOf(x) || 0) - (timeOf(y) || 0);
      if (mode === "name") return nameOf(x).localeCompare(nameOf(y), "ko");
      if (mode === "name_desc") return nameOf(y).localeCompare(nameOf(x), "ko");
      return 0;
    });
    return a;
  }
  function partitionPinned(arr) {
    const pin = arr.filter((x) => x.pinned).sort((a, b) => (a.pinnedAt || 0) - (b.pinnedAt || 0));
    const rest = arr.filter((x) => !x.pinned);
    return [pin, rest];
  }
  function showSortMenu(which) {
    const cur = which === "home" ? st.homeSort : st.noteSort;
    const opts = [["recent", "최신순"], ["recent_asc", "오래된순 (과거순)"], ["name", "이름순 ㄱ→ㅎ"], ["name_desc", "이름순 ㅎ→ㄱ"]];
    openModal(`<h3>정렬</h3><div class="size-list">${opts.map(([v, l]) => `<div class="size-item sort-item" data-v="${v}">${l}${v === cur ? ' <span style="margin-left:auto;color:var(--accent);font-weight:800">✓</span>' : ""}</div>`).join("")}</div><div class="m-row"><button class="m-btn" id="sortClose">닫기</button></div>`);
    $("modalBox").querySelectorAll(".sort-item").forEach((it) => it.addEventListener("click", () => {
      const v = it.dataset.v;
      if (which === "home") { st.homeSort = v; try { localStorage.setItem("luminkHomeSort", v); } catch (e) {} }
      else { st.noteSort = v; try { localStorage.setItem("luminkNoteSort", v); } catch (e) {} }
      closeModal(); render(); if (which === "home") renderSidebar();
    }));
    $on("sortClose", "click", closeModal);
  }
  async function togglePinProject(id) {
    const p = getProject(id); if (!p) return;
    if (!p.pinned) { if (st.projects.filter((x) => x.pinned).length >= 4) { toast("프로젝트는 최대 4개까지 고정돼요"); return; } p.pinned = true; p.pinnedAt = now(); }
    else { p.pinned = false; delete p.pinnedAt; }
    await put("projects", p); render(); renderSidebar(); toast(p.pinned ? "상단에 고정했어요" : "고정을 해제했어요");
  }
  async function togglePinNote(id, scope) {
    const n = getNote(id); if (!n) return;
    scope = scope || "project";
    if (scope === "project") {
      if (!n.pinned) { if (notesOf(n.projectId).filter((x) => x.type === n.type && x.pinned).length >= 3) { toast("섹션당 최대 3개까지 고정돼요"); return; } n.pinned = true; n.pinnedAt = now(); }
      else { n.pinned = false; delete n.pinnedAt; }
      await put("notes", n); render(); toast(n.pinned ? "상단에 고정했어요" : "고정을 해제했어요"); return;
    }
    const flag = scope === "home" ? "pinnedHome" : "pinnedSide", at = flag + "At";
    if (!n[flag]) { if (st.notes.filter((x) => x[flag]).length >= 3) { toast("최대 3개까지 고정돼요"); return; } n[flag] = true; n[at] = now(); }
    else { n[flag] = false; delete n[at]; }
    await put("notes", n);
    if (scope === "home") renderHomeRecent(); else renderSidebar();
    toast(n[flag] ? "상단에 고정했어요" : "고정을 해제했어요");
  }
  // Home card overflow icon: each instance owns a unique SVG gradient ID so
  // project and recent-memo menus can use the active theme's full accent gradient.
  function homeMoreIcon(key) {
    const safe = String(key || "item").replace(/[^a-zA-Z0-9_-]/g, "");
    const gid = "home-more-grad-" + safe;
    return `<svg class="home-more-gradient" viewBox="0 0 24 24" aria-hidden="true"><defs><linearGradient id="${gid}" x1="3" y1="4" x2="21" y2="20" gradientUnits="userSpaceOnUse"><stop class="home-more-stop-a" offset="0"/><stop class="home-more-stop-b" offset="1"/></linearGradient></defs><circle cx="12" cy="5" r="1.55" fill="url(#${gid})"/><circle cx="12" cy="12" r="1.55" fill="url(#${gid})"/><circle cx="12" cy="19" r="1.55" fill="url(#${gid})"/></svg>`;
  }
  function makeProjCard(p) {
    const cnt = notesOf(p.id).length;
    const card = document.createElement("div");
    card.className = "proj-card";
    card.innerHTML =
      '<span class="sel-check"><svg viewBox="0 0 24 24"><path d="M5 12l5 5 9-10"/></svg></span>' +
      `<div class="pc-thumb">${projIconHTML(p, "proj-icon")}</div>` +
      `<div class="pc-name">${esc(p.name)}${p.pinned ? PIN_STAR : ""}</div>` +
      `<div class="pc-row"><span class="pc-count">메모 ${cnt}</span><span class="pc-time">${fmtDate(p.updatedAt || p.createdAt)}</span></div>` +
      `<div class="pc-more" data-pid="${p.id}" aria-label="프로젝트 메뉴">${homeMoreIcon("project-" + p.id)}</div>`;
    card.dataset.selid = p.id;
    if (p.chipColor && CHIP[p.chipColor]) { card.style.borderColor = CHIP[p.chipColor].c + "cc"; }
    if (st.selMode && st.selIds && st.selIds.has(p.id)) card.classList.add("selected");
    card.addEventListener("click", (e) => {
      if (st.selMode) { toggleSel(p.id); return; }
      if (e.target.closest(".pc-more")) { e.stopPropagation(); openProjectSheet(p.id); return; }
      openProject(p.id);
    });
    attachLongPress(card, () => { if (!st.selMode) openProjectSheet(p.id); });
    return card;
  }
  function renderHome() {
    const grid = $("projGrid");
    const lab = $("homeSortLabel"); if (lab) lab.textContent = SORT_LABELS[st.homeSort] || "최신순";
    if (!st.projects.length) { grid.innerHTML = `<div class="grid-empty">아직 프로젝트가 없어요.<br>새 프로젝트를 만들어 보세요.</div>`; return; }
    const [pin, rest] = partitionPinned(st.projects);
    const restSorted = sortList(rest, st.homeSort, (p) => p.name || "", (p) => p.updatedAt || p.createdAt || 0);
    grid.innerHTML = "";
    pin.forEach((p) => grid.appendChild(makeProjCard(p)));
    if (pin.length && restSorted.length) { const d = document.createElement("div"); d.className = "grid-div"; grid.appendChild(d); }
    restSorted.forEach((p) => grid.appendChild(makeProjCard(p)));
    renderHomeRecent();
    const hf = $("hfStats"); if (hf) hf.textContent = `프로젝트 ${st.projects.length} · 메모 ${st.notes.length}`;
  }
  function renderHomeRecent() {
    const wrap = $("homeRecent"); if (!wrap) return;
    const ms = recentMemos(10, "home");
    const head = $("homeRecentHead"); if (head) head.style.display = st.projects.length ? "" : "none";
    if (!st.projects.length) { wrap.innerHTML = ""; return; }
    if (!ms.length) { wrap.innerHTML = '<div class="hm-recent-empty">아직 메모가 없어요.</div>'; return; }
    wrap.innerHTML = "";
    ms.forEach((n) => {
      const proj = getProject(n.projectId);
      const it = document.createElement("div"); it.className = "hm-recent-item";
      it.innerHTML = memoTagHTML(n) +
        `<div class="hm-body"><div class="hm-title">${esc(n.title || "(제목 없음)")}${n.pinnedHome ? PIN_STAR : ""}</div><div class="hm-sub">${esc(proj ? proj.name : "")} · ${TYPE_LABEL[n.type] || ""} · ${fmtDate(n.updatedAt)}</div></div>` +
        `<div class="hm-more" aria-label="메모 메뉴">${homeMoreIcon("recent-" + n.id)}</div>`;
      it.addEventListener("click", (e) => { if (e.target.closest(".hm-more")) { e.stopPropagation(); openRecentSheet(n, "home"); return; } openNote(n.id); });
      attachLongPress(it, () => openRecentSheet(n, "home"));
      wrap.appendChild(it);
    });
  }
  function openRecentSheet(n, scope) {
    const flag = scope === "home" ? "pinnedHome" : "pinnedSide";
    const where = scope === "home" ? "홈" : "사이드바";
    openSheet(n.title, [
      { icon: '<svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg>', label: "열기", fn: () => openNote(n.id) },
      { icon: IC.pin, label: n[flag] ? `${where} 고정 해제` : `${where} 상단 고정`, fn: () => togglePinNote(n.id, scope) },
      { icon: IC.del, label: "삭제", danger: true, fn: () => confirmModal("메모 삭제", `'${n.title}'를 삭제할까요?`, "삭제", true, async () => { await deleteNote(n.id); render(); renderSidebar(); }) }
    ]);
  }

  function renderSidebar() {
    const list = $("sbList");
    const [pin, rest] = partitionPinned(st.projects);
    const restSorted = sortList(rest, st.homeSort, (p) => p.name || "", (p) => p.updatedAt || p.createdAt || 0);
    list.innerHTML = "";
    const mk = (p) => {
      const item = document.createElement("div");
      item.className = "sb-item" + (p.id === st.curProjectId ? " active" : "");
      item.innerHTML = projIconHTML(p, "sb-ico") + `<div class="sb-name">${esc(p.name)}${p.pinned ? PIN_STAR : ""}</div><div class="sb-num">${notesOf(p.id).length}</div>`;
      item.addEventListener("click", () => { closeSidebar(); openProject(p.id); });
      attachLongPress(item, () => { closeSidebar(); openProjectSheet(p.id); });
      return item;
    };
    pin.forEach((p) => list.appendChild(mk(p)));
    if (pin.length && restSorted.length) { const d = document.createElement("div"); d.className = "sb-divider"; list.appendChild(d); }
    restSorted.forEach((p) => list.appendChild(mk(p)));
    const rec = $("sbRecent");
    if (rec) {
      const ms = recentMemos(10, "side");
      rec.innerHTML = "";
      if (!ms.length) { rec.innerHTML = '<div class="sb-recent-empty">아직 메모가 없어요.</div>'; }
      else ms.forEach((n) => {
        const proj = getProject(n.projectId);
        const it = document.createElement("div"); it.className = "sb-memo";
        it.innerHTML = memoTagHTML(n) + `<div class="sb-memo-body"><div class="sb-memo-title">${esc(n.title || "(제목 없음)")}${n.pinnedSide ? PIN_STAR : ""}</div><div class="sb-memo-sub">${esc(proj ? proj.name : "")} · ${noteTypeLabel(n)}</div></div>`;
        it.addEventListener("click", () => { closeSidebar(); openNote(n.id); });
        attachLongPress(it, () => { closeSidebar(); openRecentSheet(n, "side"); });
        rec.appendChild(it);
      });
    }
  }

  function buildChip(n) {
    const chip = document.createElement("div");
    chip.className = "memo-chip";
    const col = n.chipColor && CHIP[n.chipColor] ? CHIP[n.chipColor].c : null;
    let lead, meta;
    if (isCharacterCardType(n)) {
      const d = ensureCharacterData(n), page = activeCharacterPage(n);
      const img = characterCoverImage(n);
      lead = `<div class="mc-thumb"><img src="${img}" alt=""></div>`;
      const tags = (page.ko && page.ko.tags) || (page.en && page.en.tags) || [];
      const base = n.type === "persona" ? "페르소나" : "캐릭터";
      meta = characterMode(n) === "single"
        ? (tags.length ? tags.join(", ") : `${base} 카드`)
        : `${d.pages.length}명 · ${base}`;
    } else {
      const dotStyle = col ? `background:${col};box-shadow:0 0 8px ${col}` : "";
      lead = `<span class="mc-dot" style="${dotStyle}"></span>`;
      meta = n.type === "idea" ? ideaBoardSummary(n) : n.type === "lorebook" ? `키워드 ${((n.data && n.data.keywords) || []).length}개${n.data && n.data.alwaysActive ? " · 항상 활성" : ""}` : n.type === "log" ? (String((n.data && n.data.content) || "").replace(/\s+/g, " ").trim().slice(0, 60) || "빈 로그") : n.type === "html" ? (htmlSourceSummary(n) || "빈 코드 원본") : n.type === "regex" ? (regexSourceSummary(n) || "빈 정규식") : (preview(noteHtml(n)) || "빈 메모");
    }
    chip.innerHTML = '<span class="sel-check"><svg viewBox="0 0 24 24"><path d="M5 12l5 5 9-10"/></svg></span>' + lead +
      `<div class="mc-body"><div class="mc-title">${esc(n.title)}${n.pinned ? PIN_STAR : ""}</div><div class="mc-meta">${fmtDate(n.updatedAt)} · ${esc(meta)}</div></div>` +
      `<span class="mc-type">${noteTypeLabel(n)}</span>`;
    if (col) chip.style.borderColor = col.replace(")", ", .4)").replace("rgb", "rgba");
    chip.dataset.selid = n.id;
    if (st.selMode && st.selIds && st.selIds.has(n.id)) chip.classList.add("selected");
    chip.addEventListener("click", () => { if (st.selMode) toggleSel(n.id); else openNote(n.id); });
    attachLongPress(chip, () => { if (!st.selMode) openNoteSheet(n.id); });
    return chip;
  }

  function renderProjectDetail() {
    const p = getProject(st.curProjectId);
    if (!p) { back(); return; }
    $("pdTopTitle").textContent = p.name;
    const hasProjectFrame = !!frameById(p.frame);
    $("pdThumb").classList.toggle("has-frame", hasProjectFrame);
    $("pdThumb").innerHTML = projectThumbMedia(p) + (hasProjectFrame ? `<div class="frame">${frameInner(p)}</div>` : '<div class="chip-glow"></div>');
    // 프레임이 있을 때는 프로젝트 칩 글로우가 액자 색과 섞이지 않도록 적용하지 않습니다.
    if (!hasProjectFrame && p.chipColor && CHIP[p.chipColor]) { const c = CHIP[p.chipColor].c, glow = $("pdThumb").querySelector(".chip-glow"); if (glow) glow.style.boxShadow = `inset 0 0 0 1.5px ${c}, inset 0 0 16px ${c}40`; }
    $("pdName").textContent = p.name;
    const desc = $("pdDesc");
    const dtags = (p.description || "").split(",").map((s) => s.trim()).filter(Boolean);
    if (dtags.length) { desc.classList.remove("empty"); desc.innerHTML = dtags.map((t) => `<span class="kw-chip">${esc(t)}</span>`).join(""); }
    else { desc.classList.add("empty"); desc.textContent = "태그가 없습니다."; }
    const ns = notesOf(p.id);
    $("pdCount").textContent = `메모 ${ns.length}개`;
    const wrap = $("pdChips");
    if (!ns.length) { wrap.innerHTML = `<div class="grid-empty">이 프로젝트에 메모가 없어요.<br>아래 + 버튼으로 추가하세요.</div>`; return; }
    wrap.innerHTML = "";
    const SECTIONS = [["persona", "페르소나"], ["character", "캐릭터"], ["log", "로그 저장"], ["lorebook", "로어북"], ["html", "코드 작업실"], ["regex", "정규식 작업실"], ["idea", "아이디어 보드"], ["free", "자유 메모"]];
    let firstSec = true;
    SECTIONS.forEach(([t, label]) => {
      const group = ns.filter((n) => noteSectionKey(n) === t);
      if (!group.length) return;
      const [pin, rest] = partitionPinned(group);
      const ordered = [...pin, ...sortList(rest, st.noteSort, (n) => n.title || "", (n) => n.updatedAt || 0)];
      const sec = document.createElement("div"); sec.className = "chip-section"; sec.dataset.noteType = t;
      const head = document.createElement("div"); head.className = "csec-head";
      head.innerHTML = `<span class="chip-section-label"><span class="csl-dot"></span>${label} <span class="csl-count">· ${group.length}</span></span>` +
        (firstSec ? `<button class="sort-btn" id="pdSort"><svg viewBox="0 0 24 24"><path d="M3 6h11M3 12h7M3 18h4M17 5v14M17 19l3-3M17 19l-3-3"/></svg><span id="pdSortLabel">${SORT_LABELS[st.noteSort] || "최신순"}</span></button>` : "");
      sec.appendChild(head);
      ordered.forEach((n) => sec.appendChild(buildChip(n)));
      wrap.appendChild(sec);
      firstSec = false;
    });
    if ($("pdSort")) $on("pdSort", "click", () => showSortMenu("note"));
  }

  function renderRead() {
    const n = getNote(st.curNoteId);
    if (!n) { back(); return; }
    $("readTitle").textContent = n.title || "메모";
    // 가져온 스타일시트는 이 래퍼를 기준으로 범위를 제한합니다.
    // 메모 디자인은 유지하면서 앱 전체 UI를 덮어쓰지 않게 해요.
    $("readBody").innerHTML = `<div class="lumink-user-html">${noteHtml(n)}</div>`;
    normalizeLinks($("readBody"));
    bindInternalNoteLinks($("readBody"));
    addCodeCopyButtons($("readBody"));
    renderAttachments("readAttach", n, false);
  }
  function addCodeCopyButtons(root) {
    root.querySelectorAll("pre").forEach((pre) => {
      if (pre.querySelector(".code-copy")) return;
      const codeText = pre.innerText;
      const btn = document.createElement("button"); btn.className = "code-copy"; btn.type = "button"; btn.contentEditable = "false";
      btn.innerHTML = '<svg viewBox="0 0 24 24"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h8"/></svg>복사';
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        clipboardCopy(codeText).then((ok) => {
          if (!ok) { toast("복사하지 못했어요"); return; }
          btn.classList.add("done"); btn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M5 12l5 5 9-10"/></svg>복사됨';
          setTimeout(() => { btn.classList.remove("done"); btn.innerHTML = '<svg viewBox="0 0 24 24"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h8"/></svg>복사'; }, 1500);
        });
      });
      pre.appendChild(btn);
    });
  }

  function renderEditorMeta() {
    const n = getNote(st.curNoteId);
    if (!n) { back(); return; }
    beginFreeEditorSession(n);
    $("edTitle").textContent = n.title || "메모";
    setSaver("");
    renderAttachments("edAttach", n, true);
    queueDraftRecovery(n, "free");
  }

  /* ---------- navigation actions ---------- */
  async function openProject(id) {
    if (navTransition) return;
    navTransition = true;
    try {
      if (curView().s === "editor") await leaveFreeEditor();
      else if (curView().s === "html") await leaveHtmlWorkshop();
      else if (curView().s === "regex") await leaveRegexWorkshop();
      else if (curView().s === "log") await flushLog();
      else if (curView().s === "idea") await flushIdeaBoard();
      st.curProjectId = id; commitGo({ s: "project" }); renderSidebar();
    } finally { navTransition = false; }
  }
  async function flushPending() {
    if (curView().s === "editor") await leaveFreeEditor();
    else if (curView().s === "html") await leaveHtmlWorkshop();
    else if (curView().s === "regex") await leaveRegexWorkshop();
    else if (st.saveTimer || (freeEditorSession && freeEditorSession.active)) await flushSave(true);
    if (loreTimer) await flushLore();
    if (logTimer) await flushLog();
    if (perTimer) await flushPersona();
    if (charTimer) await flushCharacter();
    if (ideaTimer) await flushIdeaBoard();
  }
  async function openNote(id) {
    const n = getNote(id); if (!n || navTransition) return;
    navTransition = true;
    try {
      await flushPending();
      // flush가 끝난 뒤에만 선택 noteId를 교체합니다. 이전 에디터의 DOM이 새 메모에 쓰일 여지를 차단합니다.
      st.curNoteId = id;
      if (n.type === "free") commitGo({ s: "read" });
      else if (n.type === "html") commitGo({ s: "html" });
      else if (n.type === "regex") commitGo({ s: "regex" });
      else if (n.type === "lorebook") commitGo({ s: "lore" });
      else if (n.type === "log") { logEditMode = false; commitGo({ s: "log" }); }
      else if (isCharacterCardType(n)) { st.charEdit = false; commitGo({ s: "character" }); }
      else if (n.type === "idea") { commitGo({ s: "idea" }); }
      else toast(TYPE_LABEL[n.type] + " 편집기는 다음 단계에서 제공돼요");
    } finally { navTransition = false; }
  }
  function editCurrentNote() { const n = getNote(st.curNoteId); if (n && n.type === "free") go({ s: "editor" }); }
  async function goHome() {
    if (navTransition) return;
    navTransition = true;
    try {
      closeSidebar(); if (curView().s === "editor") await leaveFreeEditor(); else if (curView().s === "html") await leaveHtmlWorkshop(); else if (curView().s === "regex") await leaveRegexWorkshop(); else if (curView().s === "log") await flushLog(); else if (curView().s === "idea") await flushIdeaBoard();
      st.viewStack = [{ s: "home" }]; history.replaceState({ d: 1 }, ""); render();
    } finally { navTransition = false; }
  }

  /* ---------- project CRUD ---------- */
  async function saveProject(p) {
    // 프레임 데이터는 저장 시에도 한 번 더 정규화해 백업·복제·가져오기 경로를 모두 동일하게 보호합니다.
    if (p) {
      p.frame = frameById(p.frame) ? p.frame : null;
      p.frameColor = p.frame ? (normalizeFrameColor(p.frameColor) || "#d4af37") : null;
      p.updatedAt = now();
      await put("projects", p);
    }
  }
  async function createProject(name, desc) {
    const p = { id: uid(), name: name || "새 프로젝트", description: desc || "", icon: DEFAULT_ICON, createdAt: now(), updatedAt: now() };
    st.projects.push(p); await put("projects", p);
    return p;
  }
  let undoTimer = null, undoToken = null;
  async function snapshotDeletedItems(projects, notes) {
    const ids = new Set(); notes.forEach((n) => ((n.data && n.data.attachments) || []).forEach((a) => a && a.id && ids.add(a.id)));
    const files = [];
    for (const id of ids) { const f = await getOne("files", id); if (f) files.push(f); }
    return { projects: (projects || []).map(jsonCopy).filter(Boolean), notes: (notes || []).map(jsonCopy).filter(Boolean), files };
  }
  async function restoreDeletedItems(bundle) {
    for (const p of bundle.projects || []) await put("projects", p);
    for (const n of bundle.notes || []) await put("notes", n);
    for (const f of bundle.files || []) await put("files", f);
    await reloadState(); render(); renderSidebar();
  }
  function armUndo(message, bundle) {
    const token = uid(); undoToken = token; if (undoTimer) clearTimeout(undoTimer);
    toastAction(message, "되돌리기", async () => {
      if (undoToken !== token) return;
      undoToken = null; if (undoTimer) clearTimeout(undoTimer);
      try { await restoreDeletedItems(bundle); toast("삭제를 되돌렸어요"); } catch (e) { toast("되돌리지 못했어요"); }
    }, 6000);
    undoTimer = setTimeout(() => { if (undoToken === token) undoToken = null; }, 6200);
  }
  async function deleteNotesBatch(ids, options) {
    const notes = [...new Set(ids || [])].map(getNote).filter(Boolean); if (!notes.length) return;
    const bundle = options && options.noUndo ? null : await snapshotDeletedItems([], notes);
    await doAutoBackup();
    for (const n of notes) { await purgeNoteFiles(n); await del("notes", n.id); }
    const removed = new Set(notes.map((n) => n.id));
    st.notes = st.notes.filter((n) => !removed.has(n.id));
    await pruneQuickMenuReferences(true);
    if (bundle) armUndo(notes.length === 1 ? "메모를 삭제했어요" : `${notes.length}개 메모를 삭제했어요`, bundle);
  }
  async function deleteProjectsBatch(ids, options) {
    const projects = [...new Set(ids || [])].map(getProject).filter((p) => p && !p.isDefault); if (!projects.length) return;
    const pids = new Set(projects.map((p) => p.id)), notes = st.notes.filter((n) => pids.has(n.projectId));
    const bundle = options && options.noUndo ? null : await snapshotDeletedItems(projects, notes);
    await doAutoBackup();
    for (const n of notes) { await purgeNoteFiles(n); await del("notes", n.id); }
    for (const p of projects) await del("projects", p.id);
    st.notes = st.notes.filter((n) => !pids.has(n.projectId));
    st.projects = st.projects.filter((p) => !pids.has(p.id));
    await pruneQuickMenuReferences(true);
    if (pids.has(st.curProjectId)) st.curProjectId = null;
    if (bundle) armUndo(projects.length === 1 ? "프로젝트를 삭제했어요" : `${projects.length}개 프로젝트를 삭제했어요`, bundle);
  }
  async function deleteProject(id, options) { await deleteProjectsBatch([id], options); }

  function copyNoteData(data) { return JSON.parse(JSON.stringify(data || {})); }
  async function buildNoteCopy(src, projectId, title) {
    const copy = {
      id: uid(), projectId, type: src.type,
      title: title == null ? src.title : title,
      titleLocked: !!src.titleLocked,
      chipColor: src.chipColor || null,
      createdAt: now(), updatedAt: now(),
      data: copyNoteData(src.data)
    };
    const attachments = (src.data && Array.isArray(src.data.attachments)) ? src.data.attachments : [];
    const createdFileIds = [];
    const copiedAttachments = [];
    const copiedFileIdMap = new Map();
    try {
      for (const attachment of attachments) {
        const sourceFile = await getOne("files", attachment.id);
        // 기존에 이미 누락된 파일은 복제본에 깨진 참조를 남기지 않아요.
        if (!sourceFile || !sourceFile.blob) continue;
        const newId = uid();
        const type = sourceFile.type || attachment.type || "application/octet-stream";
        const blob = sourceFile.blob.slice(0, sourceFile.blob.size, type);
        await put("files", {
          id: newId, noteId: copy.id,
          name: sourceFile.name || attachment.name || "첨부파일",
          type, size: sourceFile.size == null ? blob.size : sourceFile.size,
          blob, createdAt: now()
        });
        createdFileIds.push(newId);
        copiedFileIdMap.set(attachment.id, newId);
        copiedAttachments.push({
          id: newId,
          name: sourceFile.name || attachment.name || "첨부파일",
          type,
          size: sourceFile.size == null ? blob.size : sourceFile.size
        });
      }
      if (attachments.length) {
        if (copiedAttachments.length) copy.data.attachments = copiedAttachments;
        else delete copy.data.attachments;
      }
      if (src.type === "idea" && copy.data && Array.isArray(copy.data.items)) {
        copy.data.items = copy.data.items.filter((item) => !item || !item.fileId || copiedFileIdMap.has(item.fileId));
        copy.data.items.forEach((item) => { if (item && item.fileId) item.fileId = copiedFileIdMap.get(item.fileId); });
        if (copy.data.canvas && copy.data.canvas.backgroundImage) {
          const image=copy.data.canvas.backgroundImage;
          if (image.fileId && copiedFileIdMap.has(image.fileId)) image.fileId=copiedFileIdMap.get(image.fileId);
          else copy.data.canvas.backgroundImage=null;
        }
      }
      return copy;
    } catch (err) {
      await Promise.all(createdFileIds.map((fileId) => del("files", fileId).catch(() => {})));
      throw err;
    }
  }
  async function duplicateProject(id) {
    const p = getProject(id); if (!p) return;
    const np = {
      id: uid(), name: p.name + " (사본)", description: p.description || "", icon: p.icon || null,
      chipColor: p.chipColor || null,
      frame: frameById(p.frame) ? p.frame : null,
      frameColor: frameById(p.frame) ? (normalizeFrameColor(p.frameColor) || "#d4af37") : null,
      createdAt: now(), updatedAt: now()
    };
    const copiedNotes = [];
    try {
      await put("projects", np);
      for (const n of notesOf(id)) {
        let copy = null;
        try {
          copy = await buildNoteCopy(n, np.id, n.title);
          await put("notes", copy);
          copiedNotes.push(copy);
        } catch (err) {
          if (copy) await purgeNoteFiles(copy).catch(() => {});
          throw err;
        }
      }
      st.projects.push(np);
      st.notes.push(...copiedNotes);
      toast("프로젝트를 복제했어요");
    } catch (e) {
      await Promise.all(copiedNotes.map((n) => purgeNoteFiles(n).catch(() => {})));
      await Promise.all(copiedNotes.map((n) => del("notes", n.id).catch(() => {})));
      await del("projects", np.id).catch(() => {});
      toast("프로젝트 복제에 실패했어요");
    }
  }

  /* ---------- note CRUD ---------- */
  async function saveNote(n) { n.updatedAt = now(); await put("notes", n); const p = getProject(n.projectId); if (p) await saveProject(p); triggerAutoBackup(); }
  async function createNote(type, projectId, options) {
    const characterModeOption = options && options.characterMode === "single" ? "single" : "collection";
    const characterTitle = characterModeOption === "single" ? "이름 없는 캐릭터" : "이름 없는 캐릭터 모음";
    const personaTitle = characterModeOption === "single" ? "이름 없는 페르소나" : "이름 없는 페르소나 모음";
    const n = {
      id: uid(), projectId, type,
      title: type === "lorebook" ? "이름 없는 로어북" : type === "log" ? "이름 없는 로그" : type === "idea" ? "새 아이디어 보드" : type === "persona" ? personaTitle : type === "character" ? characterTitle : type === "html" ? "제목 없는 코드 작업실" : type === "regex" ? "새 정규식 작업실" : "제목 없는 메모",
      titleLocked: type === "lorebook",
      chipColor: null, createdAt: now(), updatedAt: now(),
      data: type === "free" ? { html: "" }
          : type === "html" ? { source: "", previewPolicy: "sandbox-web", exportFormat: "html" }
          : type === "regex" ? makeRegexData()
          : type === "lorebook" ? makeLoreData()
          : type === "log" ? { content: "", templateId: "system-ink-frame", personaName: "", personaAlias: "", templateSnapshot: null }
          : (type === "persona" || type === "character") ? { mode: characterModeOption, activeId: null, pages: [makeCharacterPage()], cardTypeVersion: 2 }
          : type === "idea" ? makeIdeaBoardData()
          : {}
    };
    st.notes.push(n); await put("notes", n);
    const p = getProject(projectId); if (p) await saveProject(p);
    st.curNoteId = n.id;
    return n;
  }
  async function deleteNote(id, options) { await deleteNotesBatch([id], options); }
  async function duplicateNote(id, targetPid) {
    const src = getNote(id); if (!src) return;
    let copy = null;
    try {
      copy = await buildNoteCopy(src, targetPid || src.projectId, src.title + " (사본)");
      await put("notes", copy);
      st.notes.push(copy);
      toast("복제했어요");
    } catch (e) {
      if (copy) await purgeNoteFiles(copy).catch(() => {});
      toast("메모 복제에 실패했어요");
    }
  }
  async function moveNote(id, targetPid) {
    const n = getNote(id); if (!n) return;
    n.projectId = targetPid; await saveNote(n);
    renderQuickMenu();
    toast("이동했어요");
  }



  /* ---------- Code workshop: source stays a string, preview is isolated or text-only ---------- */
  // 내부 메모 타입은 기존 백업 호환을 위해 html을 유지하지만, 사용자 화면에서는 코드 작업실로 표시합니다.
  // exportFormat은 열어 온 원본 형식과 다음 파일 저장의 기본값입니다. 원본 문자열은 절대 변형하지 않습니다.
  function htmlSourceOf(n) { return (n && n.data && typeof n.data.source === "string") ? n.data.source : ""; }
  function htmlExportFormatOf(n) {
    const format = n && n.data && n.data.exportFormat;
    return format === "json" || format === "md" ? format : "html";
  }
  function htmlExportMime(format) {
    return format === "json" ? "application/json;charset=utf-8" : format === "md" ? "text/markdown;charset=utf-8" : "text/html;charset=utf-8";
  }
  function htmlSourceKindLabel(n) {
    return ({ html: "HTML", json: "JSON", md: "MARKDOWN" })[htmlExportFormatOf(n)] || "CODE";
  }
  function htmlSourceHint(n) {
    const format = htmlExportFormatOf(n);
    if (format === "json") return "· JSON 원문 그대로 저장 · 파일 저장에서 .html / .json / .md 선택";
    if (format === "md") return "· Markdown 원문 그대로 저장 · 파일 저장에서 .html / .json / .md 선택";
    return "· HTML 원문 그대로 저장 · 파일 저장에서 .html / .json / .md 선택";
  }
  function htmlFileBaseName(name) {
    const base = String(name || "code-workshop").replace(/\.(?:html?|json|md|markdown|mdown|mkdn|mkd)$/i, "").replace(/[\\/:*?\"<>|]+/g, "_").trim();
    return (base || "code-workshop").slice(0, 80);
  }
  function jsonSourceValidation(source) {
    try {
      JSON.parse(String(source || "").replace(/^\uFEFF/, ""));
      return { ok: true, error: "" };
    } catch (error) {
      const message = String(error && error.message ? error.message : "JSON 형식이 올바르지 않아요");
      const position = message.match(/position\s+(\d+)/i);
      return { ok: false, error: position ? `JSON 문법 오류 · ${position[1]}번째 글자 부근을 확인해 주세요` : `JSON 문법 오류 · ${message}` };
    }
  }
  function htmlSourceSummary(n) {
    const source = htmlSourceOf(n);
    if (!source.trim()) return "";
    const title = source.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
    if (title) return String(title[1]).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 60) || "HTML 문서";
    const first = source.split(/\r?\n/).map((line) => line.trim()).find(Boolean) || "";
    return first.slice(0, 60);
  }
  let htmlWorkshopSession = null, htmlPreviewTimer = null, htmlViewMode = "source";
  function setHtmlSaver(mode) {
    const s = $("htmlSaver"); s.className = "saver " + mode;
    $("htmlSaverText").textContent = mode === "dirty" ? "기록 중" : mode === "saved" ? "저장됨" : "";
    if (mode === "saved") setTimeout(() => { if (s.classList.contains("saved")) { s.className = "saver"; $("htmlSaverText").textContent = ""; } }, 1500);
  }
  function updateHtmlSourceMeta(source) {
    const text = String(source || "");
    const lines = text ? text.split(/\r\n|\r|\n/).length : 0;
    $("htmlSourceMeta").textContent = `${text.length.toLocaleString("ko-KR")}자 · ${lines.toLocaleString("ko-KR")}줄`;
  }
  function buildSandboxPreview(source) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(String(source || ""), "text/html");
    // 원본은 절대 손대지 않습니다. 이 처리는 iframe에 넣을 미리보기 사본에만 적용됩니다.
    doc.querySelectorAll("script, noscript, iframe, frame, frameset, object, embed, applet, portal, base, form, meta[http-equiv='refresh']").forEach((node) => node.remove());
    doc.querySelectorAll("*").forEach((node) => {
      [...node.attributes].forEach((attr) => {
        const name = attr.name.toLowerCase();
        const value = String(attr.value || "").trim();
        if (name.startsWith("on")) { node.removeAttribute(attr.name); return; }
        if (["href", "src", "xlink:href", "action", "formaction"].includes(name) && /^(?:javascript|vbscript|data:text\/html)/i.test(value)) node.removeAttribute(attr.name);
      });
    });
    const head = doc.head || doc.documentElement.insertBefore(doc.createElement("head"), doc.body || null);
    const csp = doc.createElement("meta");
    csp.httpEquiv = "Content-Security-Policy";
    csp.content = "default-src 'none'; img-src https: http: data: blob:; style-src 'unsafe-inline' https: http:; font-src https: http: data:; media-src https: http: data:; connect-src 'none'; script-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-src 'none'; child-src 'none'";
    head.insertBefore(csp, head.firstChild);
    const guard = doc.createElement("style");
    guard.textContent = "html,body{min-height:100%;margin:0}*{box-sizing:border-box}";
    head.insertBefore(guard, csp.nextSibling);
    return "<!doctype html>\n" + doc.documentElement.outerHTML;
  }
  function buildPlainCodePreview(source, format) {
    const label = format === "json" ? "JSON 원문 보기" : "원문 보기";
    const color = "#87b5ff";
    return `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${label}</title><style>html,body{margin:0;min-height:100%;background:#101622;color:#e8edf8;font-family:ui-monospace,SFMono-Regular,Consolas,'D2Coding',monospace}header{position:sticky;top:0;padding:11px 14px;background:#161f31;border-bottom:1px solid #29364e;color:${color};font:700 12px/1.4 -apple-system,BlinkMacSystemFont,'Noto Sans KR',sans-serif;letter-spacing:.08em}pre{margin:0;padding:18px;white-space:pre-wrap;overflow-wrap:anywhere;font-size:13px;line-height:1.72;tab-size:2}</style><body><header>${label} · 렌더링 없이 원문만 표시</header><pre>${esc(String(source || ""))}</pre></body></html>`;
  }
  function markdownPreviewEscape(value) {
    return String(value == null ? "" : value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function markdownPreviewUrl(value, image) {
    const raw = String(value == null ? "" : value).trim();
    if (!raw) return "";
    if (/^data:image\/(?:png|gif|jpe?g|webp|avif);base64,/i.test(raw)) return image ? raw : "";
    try {
      const parsed = new URL(raw, window.location.href);
      const protocol = String(parsed.protocol || "").toLowerCase();
      if (protocol === "http:" || protocol === "https:") return raw;
      if (!image && protocol === "mailto:") return raw;
    } catch (e) {}
    return "";
  }
  function markdownPreviewInline(value) {
    let source = String(value == null ? "" : value);
    const slots = [];
    const slot = (html) => {
      const token = `\uE000${slots.length}\uE001`;
      slots.push(html); return token;
    };
    source = source.replace(/`([^`\n]+)`/g, (all, code) => slot(`<code>${markdownPreviewEscape(code)}</code>`));
    source = source.replace(/!\[([^\]]*)\]\(\s*<?([^\s>)]+)>?(?:\s+['\"][^'\"]*['\"])?\s*\)/g, (all, alt, url) => {
      const safe = markdownPreviewUrl(url, true);
      return safe ? slot(`<img src="${markdownPreviewEscape(safe)}" alt="${markdownPreviewEscape(alt)}" loading="lazy">`) : markdownPreviewEscape(all);
    });
    source = source.replace(/\[([^\]]+)\]\(\s*<?([^\s>)]+)>?(?:\s+['\"][^'\"]*['\"])?\s*\)/g, (all, label, url) => {
      const safe = markdownPreviewUrl(url, false);
      return safe ? slot(`<a href="${markdownPreviewEscape(safe)}" target="_blank" rel="noopener noreferrer">${markdownPreviewEscape(label)}</a>`) : markdownPreviewEscape(all);
    });
    source = markdownPreviewEscape(source);
    source = source.replace(/~~([^~\n]+)~~/g, "<del>$1</del>");
    source = source.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>");
    source = source.replace(/__([^_\n]+)__/g, "<strong>$1</strong>");
    source = source.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
    source = source.replace(/(^|[^_\w])_([^_\n]+)_/g, "$1<em>$2</em>");
    return source.replace(/\uE000(\d+)\uE001/g, (all, index) => slots[Number(index)] || "");
  }
  function markdownPreviewTableCells(line) {
    let row = String(line == null ? "" : line).trim();
    if (row.startsWith("|")) row = row.slice(1);
    if (row.endsWith("|")) row = row.slice(0, -1);
    return row.split("|").map((cell) => cell.trim());
  }
  function markdownPreviewIsTableDivider(line) {
    const cells = markdownPreviewTableCells(line);
    return cells.length > 0 && cells.every((cell) => /^:?-{2,}:?$/.test(cell));
  }
  function markdownPreviewHtml(source) {
    const lines = String(source == null ? "" : source).replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").split("\n");
    const out = []; let i = 0; let paragraph = [];
    const flushParagraph = () => {
      if (!paragraph.length) return;
      out.push(`<p>${paragraph.map(markdownPreviewInline).join("<br>")}</p>`);
      paragraph = [];
    };
    const isFence = (line) => /^\s*```/.test(line);
    while (i < lines.length) {
      const raw = lines[i];
      const trimmed = raw.trim();
      if (!trimmed) { flushParagraph(); i++; continue; }
      if (isFence(raw)) {
        flushParagraph();
        const language = (raw.match(/^\s*```\s*([^\s`]*)/) || ["", ""])[1].replace(/[^a-z0-9_+-]/gi, "").slice(0, 32);
        const code = []; i++;
        while (i < lines.length && !isFence(lines[i])) { code.push(lines[i]); i++; }
        if (i < lines.length) i++;
        out.push(`<pre class="md-code"><code${language ? ` class="language-${language}"` : ""}>${markdownPreviewEscape(code.join("\n"))}</code></pre>`);
        continue;
      }
      const heading = raw.match(/^\s*(#{1,6})\s+(.+?)\s*#*\s*$/);
      if (heading) { flushParagraph(); const level = heading[1].length; out.push(`<h${level}>${markdownPreviewInline(heading[2])}</h${level}>`); i++; continue; }
      if (/^\s*(?:---+|\*\*\*+|___+)\s*$/.test(raw)) { flushParagraph(); out.push("<hr>"); i++; continue; }
      if (i + 1 < lines.length && /\|/.test(raw) && markdownPreviewIsTableDivider(lines[i + 1])) {
        flushParagraph();
        const headers = markdownPreviewTableCells(raw), aligns = markdownPreviewTableCells(lines[i + 1]);
        const alignFor = (cell) => cell.startsWith(":") && cell.endsWith(":") ? "center" : cell.endsWith(":") ? "right" : cell.startsWith(":") ? "left" : "left";
        const rows = []; i += 2;
        while (i < lines.length && lines[i].trim() && /\|/.test(lines[i])) { rows.push(markdownPreviewTableCells(lines[i])); i++; }
        out.push(`<div class="md-table-wrap"><table><thead><tr>${headers.map((cell, index) => `<th style="text-align:${alignFor(aligns[index] || "")}">${markdownPreviewInline(cell)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${headers.map((_, index) => `<td style="text-align:${alignFor(aligns[index] || "")}">${markdownPreviewInline(row[index] || "")}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`);
        continue;
      }
      if (/^\s*>/.test(raw)) {
        flushParagraph(); const quote = [];
        while (i < lines.length && /^\s*>/.test(lines[i])) { quote.push(lines[i].replace(/^\s*>\s?/, "")); i++; }
        out.push(`<blockquote>${quote.map(markdownPreviewInline).join("<br>")}</blockquote>`);
        continue;
      }
      const listMatch = raw.match(/^(\s*)([-+*]|\d+[.)])\s+(.+)$/);
      if (listMatch) {
        flushParagraph(); const ordered = /\d/.test(listMatch[2]); const items = [];
        while (i < lines.length) {
          const current = lines[i].match(/^(\s*)([-+*]|\d+[.)])\s+(.+)$/);
          if (!current || /\d/.test(current[2]) !== ordered) break;
          const task = current[3].match(/^\[([ xX])\]\s+(.*)$/);
          items.push(task
            ? `<li class="task-item"><input type="checkbox" disabled ${/[xX]/.test(task[1]) ? "checked" : ""}><span>${markdownPreviewInline(task[2])}</span></li>`
            : `<li>${markdownPreviewInline(current[3])}</li>`);
          i++;
        }
        out.push(`<${ordered ? "ol" : "ul"}>${items.join("")}</${ordered ? "ol" : "ul"}>`);
        continue;
      }
      paragraph.push(raw); i++;
    }
    flushParagraph();
    return out.join("\n") || '<p class="md-empty">미리볼 Markdown 내용이 없습니다.</p>';
  }
  function buildMarkdownPreview(source) {
    const body = markdownPreviewHtml(source);
    const csp = "default-src 'none'; img-src https: http: data: blob:; style-src 'unsafe-inline'; font-src https: http: data:; base-uri 'none'; form-action 'none'; frame-src 'none'; child-src 'none'; script-src 'none'; object-src 'none'";
    return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="${csp}"><title>Markdown 미리보기</title><style>:root{color-scheme:light dark}*{box-sizing:border-box}html,body{margin:0;min-height:100%}body{background:#eef2f8;color:#202735;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans KR',sans-serif;line-height:1.78}.md-document{min-height:100vh;max-width:940px;margin:0 auto;padding:clamp(22px,5vw,56px);background:#fff;box-shadow:0 0 0 1px rgba(28,44,72,.05)}h1,h2,h3,h4,h5,h6{color:#19243a;line-height:1.35;margin:1.45em 0 .6em;font-weight:800;letter-spacing:-.02em}h1{font-size:2em;padding-bottom:.38em;border-bottom:2px solid #d9e2f1}h2{font-size:1.56em;padding-bottom:.3em;border-bottom:1px solid #e0e7f1}h3{font-size:1.27em}h4{font-size:1.08em}h5,h6{font-size:1em}h1:first-child,h2:first-child,h3:first-child{margin-top:0}p{margin:.1em 0 1em}a{color:#265fb8;text-decoration:underline;text-decoration-color:rgba(38,95,184,.3);text-underline-offset:2px}a:hover{color:#143c7c}code{font-family:ui-monospace,SFMono-Regular,Consolas,'D2Coding',monospace;font-size:.9em;background:#f0f4fa;color:#204c87;padding:.14em .36em;border-radius:5px;overflow-wrap:anywhere}.md-code{margin:1.15em 0;padding:15px 17px;overflow:auto;border:1px solid #202a3a;border-radius:12px;background:#101622;color:#dfe9f8;box-shadow:0 9px 22px rgba(20,31,49,.18)}.md-code code{display:block;padding:0;background:transparent;color:inherit;font-size:12.5px;line-height:1.7;white-space:pre}blockquote{margin:1.1em 0;padding:.72em 1em;border-left:4px solid #7d9dce;background:#f5f8fc;color:#4c5a70;border-radius:0 10px 10px 0}hr{border:0;border-top:1px solid #d9e2ef;margin:2em 0}ul,ol{margin:.35em 0 1.15em;padding-left:1.5em}li{margin:.32em 0}.task-item{list-style:none;margin-left:-1.25em;display:flex;align-items:flex-start;gap:.55em}.task-item input{margin:.46em 0 0;accent-color:#477bca}img{display:block;max-width:100%;height:auto;margin:1.15em 0;border-radius:12px;border:1px solid #dbe3f0;background:#f3f6fb;box-shadow:0 9px 24px rgba(32,50,78,.12)}.md-table-wrap{overflow:auto;margin:1.15em 0;border:1px solid #d8e1ee;border-radius:11px}table{border-collapse:collapse;width:100%;min-width:480px;font-size:.94em}th,td{padding:.64em .74em;border-bottom:1px solid #e2e8f1;vertical-align:top}th{background:#eef3fa;color:#223555;font-weight:800}tr:last-child td{border-bottom:0}.md-empty{color:#7b8799;font-style:italic}@media (prefers-color-scheme:dark){body{background:#0d131d;color:#dce5f3}.md-document{background:#111a27;box-shadow:none}h1,h2,h3,h4,h5,h6{color:#f1f6ff}h1{border-color:#32445d}h2{border-color:#2a3a50}a{color:#9ac2ff}a:hover{color:#d1e4ff}code{background:#1a2940;color:#b9d7ff}blockquote{background:#162337;color:#b9c8dc;border-color:#7fa2d9}.md-code{border-color:#37475f;background:#0b1018}.md-table-wrap{border-color:#32435a}th,td{border-color:#2b3b51}th{background:#18263a;color:#deebff}img{border-color:#34465f;background:#151f2d}}</style></head><body><main class="md-document">${body}</main></body></html>`;
  }
  function refreshHtmlPreview(source, format) {
    const frame = $("htmlPreview"); if (!frame) return;
    const note = getNote(st.curNoteId);
    const kind = format || htmlExportFormatOf(note);
    try { frame.srcdoc = kind === "html" ? buildSandboxPreview(source) : kind === "md" ? buildMarkdownPreview(source) : buildPlainCodePreview(source, "json"); }
    catch (e) { frame.srcdoc = "<!doctype html><meta charset='utf-8'><pre>미리보기를 만들지 못했어요.</pre>"; }
  }
  function openHtmlPreviewPage() {
    const note = getNote(st.curNoteId);
    if (!note || htmlExportFormatOf(note) !== "html") { toast("웹페이지로 열기는 HTML 원문에서만 사용할 수 있어요"); return; }
    const source = $("htmlSource").value || "<!doctype html><meta charset='utf-8'>";
    const blob = new Blob([source], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, "_blank", "noopener,noreferrer");
    if (!win) { URL.revokeObjectURL(url); toast("팝업 차단 때문에 웹페이지를 열지 못했어요"); return; }
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
  function queueHtmlPreview(source) {
    clearTimeout(htmlPreviewTimer);
    htmlPreviewTimer = setTimeout(() => refreshHtmlPreview(source), 280);
  }
  function setHtmlView(mode) {
    const screen = $("screen-html");
    const allowed = (mode === "preview" || mode === "split") ? mode : "source";
    htmlViewMode = allowed; screen.dataset.htmlView = allowed;
    $("htmlModeSource").classList.toggle("active", allowed === "source");
    $("htmlModePreview").classList.toggle("active", allowed === "preview");
    $("htmlModeSplit").classList.toggle("active", allowed === "split");
    if (allowed === "preview") refreshHtmlPreview($("htmlSource").value);
  }
  function beginHtmlWorkshopSession(n) {
    const source = htmlSourceOf(n), area = $("htmlSource");
    const same = htmlWorkshopSession && htmlWorkshopSession.active && htmlWorkshopSession.noteId === n.id;
    if (!same) {
      clearTimeout(st.saveTimer); st.saveTimer = null;
      htmlWorkshopSession = { noteId: n.id, active: true, dirty: false, revision: 0, lastQueuedRevision: -1, inFlight: Promise.resolve() };
      area.value = source;
      updateHtmlSourceMeta(source);
      refreshHtmlPreview(source);
      setHtmlView(htmlViewMode);
    } else if (!htmlWorkshopSession.dirty && area.value !== source) {
      area.value = source; updateHtmlSourceMeta(source); refreshHtmlPreview(source);
    }
  }
  function activeHtmlSession(expectedId) {
    const session = htmlWorkshopSession;
    if (!session || !session.active || !session.noteId) return null;
    if (expectedId && session.noteId !== expectedId) return null;
    if (st.curNoteId !== session.noteId) return null;
    return session;
  }
  function scheduleHtmlSave() {
    const session = activeHtmlSession();
    if (!session || curView().s !== "html") return;
    const n = getNote(session.noteId); if (!n || n.type !== "html") return;
    session.dirty = true; session.revision += 1;
    const draft = htmlDraftFromEditor();
    writeDraft(n, "html", draft); updateHtmlSourceMeta(draft.source); queueHtmlPreview(draft.source);
    setHtmlSaver("dirty"); clearTimeout(st.saveTimer);
    const id = session.noteId, revision = session.revision;
    st.saveTimer = setTimeout(() => {
      if (activeHtmlSession(id) === session && session.revision >= revision) void flushHtmlSave(false, id);
    }, 550);
  }
  function flushHtmlSave(silent, expectedId) {
    clearTimeout(st.saveTimer); st.saveTimer = null;
    const session = activeHtmlSession(expectedId);
    if (!session || !session.dirty) return session && session.inFlight ? session.inFlight : Promise.resolve();
    const noteId = session.noteId, n = getNote(noteId);
    if (!n || n.type !== "html") return Promise.resolve();
    const draft = htmlDraftFromEditor(), source = draft.source, revision = session.revision;
    if (source.length > HTML_SOURCE_MAX) { toast("코드 원본은 5MB 이하로 저장할 수 있어요"); return Promise.resolve(); }
    if (session.lastQueuedRevision === revision) return session.inFlight || Promise.resolve();
    session.lastQueuedRevision = revision;
    const write = async () => {
      const note = getNote(noteId); if (!note || note.type !== "html") return;
      if (source === htmlSourceOf(note)) {
        if (htmlWorkshopSession === session && session.revision === revision) { session.dirty = false; clearDraftIfSynced(note, "html", draft); }
        return;
      }
      note.data = note.data || {}; note.data.source = source; note.data.previewPolicy = "sandbox-web";
      await saveNote(note);
      if (htmlWorkshopSession === session && session.revision === revision) {
        session.dirty = false; clearDraftIfSynced(note, "html", draft); if (!silent) setHtmlSaver("saved");
      }
    };
    session.inFlight = (session.inFlight || Promise.resolve()).then(write, write);
    return session.inFlight;
  }
  async function leaveHtmlWorkshop() {
    const session = htmlWorkshopSession;
    if (!session || !session.active) return;
    await flushHtmlSave(true, session.noteId);
    if (htmlWorkshopSession === session) {
      session.active = false; session.noteId = null; session.dirty = false;
      clearTimeout(st.saveTimer); st.saveTimer = null; clearTimeout(htmlPreviewTimer);
    }
  }
  function syncCodeWorkshopFormatUi(n) {
    const note = n || getNote(st.curNoteId); if (!note || note.type !== "html") return;
    const format = htmlExportFormatOf(note);
    const kind = $("htmlSourceKind"), hint = $("htmlSourceFormatHint"), screen = $("screen-html");
    if (kind) kind.textContent = htmlSourceKindLabel(note);
    if (hint) hint.textContent = htmlSourceHint(note);
    if (screen) screen.dataset.codeFormat = format;
    const pageButton = $("htmlOpenPage");
    if (pageButton) {
      const enabled = format === "html";
      pageButton.disabled = !enabled;
      pageButton.title = enabled ? "웹페이지로 열기" : "웹페이지로 열기는 HTML 원문에서만 가능";
      pageButton.setAttribute("aria-label", pageButton.title);
    }
    const previewKicker = $("htmlPreviewKicker"), previewNote = $("htmlPreviewNote"), frame = $("htmlPreview");
    if (previewKicker) previewKicker.textContent = format === "html" ? "Sandbox preview" : format === "md" ? "Markdown preview" : "Raw text view";
    if (previewNote) previewNote.textContent = format === "html" ? "JavaScript · 폼 · 앱 접근 차단" : format === "md" ? "Markdown 렌더링 · HTML 실행 차단" : "렌더링 없이 원문만 표시";
    if (frame) frame.title = format === "html" ? "코드 작업실 HTML 미리보기" : format === "md" ? "코드 작업실 Markdown 미리보기" : `${htmlSourceKindLabel(note)} 원문 보기`;
  }
  function renderHtmlWorkshop() {
    const n = getNote(st.curNoteId);
    if (!n || n.type !== "html") { back(); return; }
    beginHtmlWorkshopSession(n);
    $("htmlTitle").textContent = n.title || "코드 작업실";
    syncCodeWorkshopFormatUi(n);
    setHtmlSaver(""); queueDraftRecovery(n, "html");
  }
  async function saveHtmlWorkshopFile(id, format, requestedName) {
    const n = getNote(id); if (!n || n.type !== "html") return false;
    const chosen = format === "json" ? "json" : format === "md" ? "md" : "html";
    await flushHtmlSave(true, id);
    const source = (activeHtmlSession(id) && $("htmlSource")) ? $("htmlSource").value : htmlSourceOf(n);
    if (chosen === "json") {
      const check = jsonSourceValidation(source);
      if (!check.ok) { toast(check.error); return false; }
    }
    const safeName = htmlFileBaseName(requestedName || n.title);
    // 원본 문자열을 래핑·정화·재직렬화하지 않고, 사용자가 고른 확장자와 MIME으로만 저장합니다.
    downloadDoc(source, `${safeName}.${chosen}`, htmlExportMime(chosen));
    n.data = n.data || {}; n.data.exportFormat = chosen; n.data.previewPolicy = "sandbox-web";
    await saveNote(n);
    syncCodeWorkshopFormatUi(n);
    refreshHtmlPreview(source, chosen);
    toast(`${chosen === "md" ? "Markdown" : chosen.toUpperCase()} 파일을 저장했어요`);
    return true;
  }
  function showHtmlExportDialog(id) {
    const n = getNote(id); if (!n || n.type !== "html") return;
    let selected = htmlExportFormatOf(n);
    const baseName = htmlFileBaseName(n.title || "code-workshop");
    openModal(`<h3>파일로 저장</h3><p class="m-sub">현재 원문을 앱 내부 저장과 별도로 내려받습니다. <b>.json</b>을 고르면 저장 전에 JSON 문법을 검사하며, HTML·JSON·Markdown 중 원하는 확장자를 선택할 수 있습니다.</p><div class="m-field-label">파일 이름</div><input class="m-input" id="htmlExportName" maxlength="80" value="${esc(baseName)}" autocapitalize="off" autocorrect="off"><div class="m-field-label">확장자</div><div class="type-card html-export-choice ${selected === "html" ? "is-selected" : ""}" id="htmlExportAsHtml"><div class="tc-ico"><svg viewBox="0 0 24 24"><path d="M5 3h9l5 5v13H5z"/><path d="M14 3v5h5M8 13h8M8 17h5"/></svg></div><div><div class="tc-name">HTML · .html</div><div class="tc-desc">웹페이지·상태창·배너 원문으로 저장</div></div><span class="tc-soon">${selected === "html" ? "선택됨" : "선택"}</span></div><div class="type-card html-export-choice ${selected === "json" ? "is-selected" : ""}" id="htmlExportAsJson"><div class="tc-ico"><svg viewBox="0 0 24 24"><path d="M7 5 3 12l4 7M17 5l4 7-4 7M13.5 3 10.5 21"/></svg></div><div><div class="tc-name">JSON · .json</div><div class="tc-desc">정렬·공백을 유지한 JSON 원문으로 저장</div></div><span class="tc-soon">${selected === "json" ? "선택됨" : "선택"}</span></div><div class="type-card html-export-choice ${selected === "md" ? "is-selected" : ""}" id="htmlExportAsMarkdown"><div class="tc-ico"><svg viewBox="0 0 24 24"><path d="M5 4h14v16H5z"/><path d="M8 16V9l2.5 3L13 9v7M15.5 10.5h1.5a1.5 1.5 0 0 1 0 3h-1.5v2.5"/></svg></div><div><div class="tc-name">Markdown · .md</div><div class="tc-desc">마크다운 문서 원문으로 저장</div></div><span class="tc-soon">${selected === "md" ? "선택됨" : "선택"}</span></div><div class="m-row"><button class="m-btn" id="htmlExportCancel">취소</button><button class="m-btn primary" id="htmlExportOk">파일 저장</button></div>`);
    const draw = () => {
      [["htmlExportAsHtml", "html"], ["htmlExportAsJson", "json"], ["htmlExportAsMarkdown", "md"]].forEach(([elId, format]) => {
        const el = $(elId); if (!el) return;
        const on = selected === format;
        el.classList.toggle("is-selected", on);
        const chip = el.querySelector(".tc-soon"); if (chip) chip.textContent = on ? "선택됨" : "선택";
      });
    };
    $on("htmlExportAsHtml", "click", () => { selected = "html"; draw(); });
    $on("htmlExportAsJson", "click", () => { selected = "json"; draw(); });
    $on("htmlExportAsMarkdown", "click", () => { selected = "md"; draw(); });
    $on("htmlExportCancel", "click", closeModal);
    $on("htmlExportOk", "click", async () => {
      const button = $("htmlExportOk");
      if (button) { button.disabled = true; button.textContent = "저장 중…"; }
      const ok = await saveHtmlWorkshopFile(id, selected, $("htmlExportName").value);
      if (ok) closeModal();
      else if (button) { button.disabled = false; button.textContent = "파일 저장"; }
    });
    setTimeout(() => { const input = $("htmlExportName"); if (input) { input.focus(); input.select(); } }, 80);
  }
  function exportHtmlSource(id) { showHtmlExportDialog(id); }
  function openHtmlSheet(n) {
    openSheet(n.title, [
      { icon: IC.pin, label: n.pinned ? "고정 해제" : "상단 고정", fn: () => togglePinNote(n.id) },
      { icon: IC.rename, label: "이름 바꾸기", fn: () => renameModal("코드 작업실 이름", n.title, async (v) => { if (v) { n.title = v; n.titleLocked = true; await saveNote(n); render(); } }) },
      { icon: IC.color, label: "색상 지정", fn: () => showChipPicker(n.id) },
      { icon: IC.copy, label: "원본 코드 복사", fn: () => clipboardCopy(htmlSourceOf(n)).then((ok) => toast(ok ? "원본 코드를 복사했어요" : "복사하지 못했어요")) },
      { icon: IC.save, label: "파일로 저장 (.html / .json / .md)", fn: () => exportHtmlSource(n.id) },
      { icon: IC.move, label: "다른 프로젝트로 이동", fn: () => pickTargetProject(n.projectId, (pid) => moveNote(n.id, pid).then(render)) },
      { icon: IC.copy, label: "선택 위치로 복제", fn: () => pickTargetProject(n.projectId, (pid) => duplicateNote(n.id, pid).then(render)) },
      { icon: IC.del, label: "삭제", danger: true, fn: () => confirmModal("코드 작업실 삭제", `'${n.title}'를 삭제할까요?`, "삭제", true, async () => { await deleteNote(n.id); back(); }) }
    ]);
  }

  /* ---------- Regex workshop: SillyTavern findRegex / replaceString lab ---------- */
  const REGEX_TRIM_MAX = 80;
  const REGEX_PLACEMENTS = [1, 2, 3, 5, 6];
  function regexSplitLiteral(value) {
    const text = String(value || "").trim();
    if (!text.startsWith("/")) return null;
    let escaped = false, inClass = false;
    for (let i = 1; i < text.length; i++) {
      const ch = text[i];
      if (escaped) { escaped = false; continue; }
      if (ch === "\\") { escaped = true; continue; }
      if (ch === "[") { inClass = true; continue; }
      if (ch === "]") { inClass = false; continue; }
      if (ch === "/" && !inClass) return { source: text.slice(1, i), flags: text.slice(i + 1), literal: true };
    }
    return { source: text.slice(1), flags: "", literal: true, unclosed: true };
  }
  function regexParseFind(value) {
    const raw = String(value || "").trim();
    if (!raw) return { ok: false, error: "IN 정규식이 비어 있습니다.", source: "", flags: "" };
    const literal = regexSplitLiteral(raw);
    const source = literal ? literal.source : raw;
    const flags = literal ? literal.flags : "";
    if (literal && literal.unclosed) return { ok: false, error: "정규식 리터럴의 닫는 /가 없습니다.", source, flags };
    try {
      const re = new RegExp(source, flags);
      return { ok: true, error: "", source, flags, regex: re, literal: !!literal };
    } catch (error) {
      return { ok: false, error: (error && error.message) ? error.message : "정규식 문법 오류입니다.", source, flags };
    }
  }
  function regexCountCaptures(source) {
    let count = 0, escaped = false, inClass = false;
    const text = String(source || "");
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (escaped) { escaped = false; continue; }
      if (ch === "\\") { escaped = true; continue; }
      if (ch === "[") { inClass = true; continue; }
      if (ch === "]") { inClass = false; continue; }
      if (ch !== "(" || inClass) continue;
      if (text[i + 1] !== "?") { count++; continue; }
      if (text[i + 2] === "<" && text[i + 3] !== "=" && text[i + 3] !== "!") count++;
    }
    return count;
  }
  function regexMaxReplacementIndex(value) {
    let max = 0;
    String(value || "").replace(/\$(\d{1,2})/g, (_, n) => { max = Math.max(max, Number(n) || 0); return _; });
    return max;
  }
  function regexUniqueFlags(flags) {
    const out = [];
    String(flags || "").split("").forEach((flag) => { if (flag && !out.includes(flag)) out.push(flag); });
    return out.join("");
  }
  function regexEscapeForLiteral(source) {
    let out = "", escaped = false, inClass = false;
    for (const ch of String(source || "")) {
      if (escaped) { out += ch; escaped = false; continue; }
      if (ch === "\\") { out += ch; escaped = true; continue; }
      if (ch === "[") { inClass = true; out += ch; continue; }
      if (ch === "]") { inClass = false; out += ch; continue; }
      out += (ch === "/" && !inClass) ? "\\/" : ch;
    }
    return out;
  }
  function regexSetGlobalInFind(value, enabled) {
    const raw = String(value || "").trim();
    if (!raw) return enabled ? "//g" : "";
    const literal = regexSplitLiteral(raw);
    if (enabled) {
      if (literal && !literal.unclosed) return `/${literal.source}/${regexUniqueFlags(literal.flags + "g")}`;
      return `/${regexEscapeForLiteral(raw)}/g`;
    }
    if (literal && !literal.unclosed) return literal.source;
    return raw;
  }
  function regexNullableNumber(value) {
    const text = String(value == null ? "" : value).trim();
    if (!text) return null;
    const n = Number(text);
    return Number.isFinite(n) ? Math.max(0, Math.min(999, Math.round(n))) : null;
  }
  function makeRegexData() {
    return normalizeRegexData({
      id: uid(), scriptName: "", findRegex: "", replaceString: "", sampleText: "", global: false,
      trimStrings: [], placement: [], disabled: false, markdownOnly: false, promptOnly: false,
      runOnEdit: false, substituteRegex: 0, minDepth: null, maxDepth: null
    });
  }
  function normalizeRegexData(raw) {
    const src = raw && typeof raw === "object" ? raw : {};
    const placement = Array.isArray(src.placement)
      ? Array.from(new Set(src.placement.map((n) => Number(n)).filter((n) => REGEX_PLACEMENTS.includes(n))))
      : [];
    const trimSource = Array.isArray(src.trimStrings) ? src.trimStrings : (typeof src.trimStrings === "string" ? src.trimStrings.split(/\r?\n/) : []);
    const findRegex = String(src.findRegex || "");
    const literal = regexSplitLiteral(findRegex);
    return {
      id: String(src.id || src.stId || uid()).slice(0, 180),
      scriptName: String(src.scriptName || "").slice(0, 180),
      findRegex: findRegex.slice(0, HTML_SOURCE_MAX),
      replaceString: String(src.replaceString || "").slice(0, HTML_SOURCE_MAX),
      sampleText: String(src.sampleText || "").slice(0, HTML_SOURCE_MAX),
      global: !!(literal && !literal.unclosed && /g/.test(literal.flags)) || (typeof src.global === "boolean" ? src.global : false),
      trimStrings: trimSource.map((item) => String(item || "").trim()).filter(Boolean).slice(0, REGEX_TRIM_MAX),
      placement: placement.length ? placement : [],
      disabled: !!src.disabled,
      markdownOnly: !!src.markdownOnly,
      promptOnly: !!src.promptOnly,
      runOnEdit: !!src.runOnEdit,
      substituteRegex: Math.max(0, Math.min(2, Number(src.substituteRegex) || 0)),
      minDepth: regexNullableNumber(src.minDepth),
      maxDepth: regexNullableNumber(src.maxDepth)
    };
  }
  // The sample textarea remains the single source of truth. This overlay only paints complete
  // [[…]] segments as capture-like slots so users can scan flexible values at a glance.
  function regexSampleHighlightMarkup(value) {
    const raw = String(value || "");
    if (!raw) return "";
    let html = "", index = 0, match;
    const token = /\[\[([\s\S]*?)\]\]/g;
    while ((match = token.exec(raw))) {
      html += esc(raw.slice(index, match.index));
      html += `<span class="rx-sample-token"><span class="rx-sample-bracket">[[</span>${esc(match[1])}<span class="rx-sample-bracket">]]</span></span>`;
      index = match.index + match[0].length;
    }
    html += esc(raw.slice(index));
    // A final line break is otherwise visually collapsed by <pre> at the bottom edge.
    if (raw.endsWith("\n")) html += " ";
    return html;
  }
  function syncRegexSampleHighlight() {
    const area = $("regexSample"), highlight = $("regexSampleHighlight");
    if (!area || !highlight) return;
    highlight.scrollTop = area.scrollTop;
    highlight.scrollLeft = area.scrollLeft;
  }
  function updateRegexSampleHighlight() {
    const area = $("regexSample"), highlight = $("regexSampleHighlight");
    if (!area || !highlight) return;
    highlight.innerHTML = regexSampleHighlightMarkup(area.value);
    syncRegexSampleHighlight();
  }

  function regexDataFromEditor() {
    const current = getNote(st.curNoteId);
    const placement = Array.from(document.querySelectorAll("[data-regex-placement]:checked"))
      .map((input) => Number(input.dataset.regexPlacement))
      .filter((n) => REGEX_PLACEMENTS.includes(n));
    return normalizeRegexData({
      id: (current && current.data && current.data.id) || (current && current.id),
      scriptName: $("regexScriptName") ? $("regexScriptName").value : "",
      findRegex: $("regexFind") ? $("regexFind").value : "",
      replaceString: $("regexReplace") ? $("regexReplace").value : "",
      sampleText: $("regexSample") ? $("regexSample").value : "",
      global: $("regexGlobal") ? $("regexGlobal").checked : false,
      trimStrings: $("regexTrimStrings") ? $("regexTrimStrings").value.split(/\r?\n/) : [],
      placement,
      disabled: $("regexDisabled") ? $("regexDisabled").checked : false,
      markdownOnly: $("regexMarkdownOnly") ? $("regexMarkdownOnly").checked : false,
      promptOnly: $("regexPromptOnly") ? $("regexPromptOnly").checked : false,
      runOnEdit: $("regexRunOnEdit") ? $("regexRunOnEdit").checked : false,
      substituteRegex: $("regexSubstituteRegex") ? $("regexSubstituteRegex").value : 0,
      minDepth: $("regexMinDepth") ? $("regexMinDepth").value : null,
      maxDepth: $("regexMaxDepth") ? $("regexMaxDepth").value : null
    });
  }
  function setRegexEditorData(data) {
    const d = normalizeRegexData(data);
    $("regexScriptName").value = d.scriptName;
    $("regexFind").value = d.findRegex;
    $("regexReplace").value = d.replaceString;
    $("regexSample").value = d.sampleText;
    updateRegexSampleHighlight();
    $("regexGlobal").checked = d.global;
    $("regexMarkdownOnly").checked = d.markdownOnly;
    $("regexPromptOnly").checked = d.promptOnly;
    $("regexRunOnEdit").checked = d.runOnEdit;
    $("regexDisabled").checked = d.disabled;
    document.querySelectorAll("[data-regex-placement]").forEach((input) => {
      input.checked = d.placement.includes(Number(input.dataset.regexPlacement));
    });
    $("regexSubstituteRegex").value = String(d.substituteRegex);
    $("regexMinDepth").value = d.minDepth == null ? "" : String(d.minDepth);
    $("regexMaxDepth").value = d.maxDepth == null ? "" : String(d.maxDepth);
    $("regexTrimStrings").value = d.trimStrings.join("\n");
  }
  function regexFileBaseName(name) {
    const base = String(name || "sillytavern-regex").replace(/\.json$/i, "").replace(/[\\/:*?"<>|]+/g, "_").trim();
    return (base || "sillytavern-regex").slice(0, 80);
  }
  function regexSourceSummary(n) {
    const d = normalizeRegexData(n && n.data ? n.data : {});
    const name = (d.scriptName || "").trim();
    if (name) return name.slice(0, 60);
    const first = String(d.findRegex || "").split(/\r?\n/).map((line) => line.trim()).find(Boolean) || "";
    return first ? first.slice(0, 60) : "";
  }
  function regexEscapeLiteral(text) { return String(text || "").replace(/[\\^$.*+?()[\]{}|]/g, "\\$&"); }
  function regexFlexibleLiteral(text) {
    let out = "";
    for (const ch of String(text || "")) {
      if (/\s/.test(ch)) out += "\\s*";
      else if (ch === ",") out += "\\s*,\\s*";
      else if (ch === "|") out += "\\s*\\|\\s*";
      else if (ch === ":") out += "\\s*:\\s*";
      else if (ch === "-") out += "\\s*-\\s*";
      else if (ch === "/") out += "\\s*\\/\\s*";
      else out += regexEscapeLiteral(ch);
    }
    return out.replace(/(?:\\s\*){2,}/g, "\\s*");
  }
  function regexPatternFromMarkedSample(sample) {
    const raw = String(sample || "");
    const token = /(\[\[[\s\S]*?\]\]|\{\{[\s\S]*?\}\})/g;
    let index = 0, pattern = "", plain = "", captures = 0, match;
    const addFixed = (value) => { if (!value) return; pattern += regexFlexibleLiteral(value); plain += value; };
    while ((match = token.exec(raw))) {
      addFixed(raw.slice(index, match.index));
      const text = match[0], inner = text.slice(2, -2);
      if (text.startsWith("[[")) { pattern += "\\s*([\\s\\S]+?)\\s*"; plain += inner; captures++; }
      else addFixed(inner);
      index = match.index + text.length;
    }
    addFixed(raw.slice(index));
    return { pattern, plain, captures };
  }
  function regexPlainSampleText(sample) {
    return String(sample || "")
      .replace(/\[\[([\s\S]*?)\]\]/g, "$1")
      .replace(/\{\{([\s\S]*?)\}\}/g, "$1");
  }
  function regexSkipGroup(source, start) {
    let depth = 0, escaped = false, inClass = false;
    for (let i = start; i < source.length; i++) {
      const ch = source[i];
      if (escaped) { escaped = false; continue; }
      if (ch === "\\") { escaped = true; continue; }
      if (ch === "[") { inClass = true; continue; }
      if (ch === "]") { inClass = false; continue; }
      if (inClass) continue;
      if (ch === "(") depth++;
      else if (ch === ")") {
        depth--;
        if (depth === 0) return i;
      }
    }
    return start;
  }
  function regexSkipQuantifier(source, index) {
    let i = index + 1;
    if ("?*+".includes(source[i])) return i;
    if (source[i] === "{") {
      while (i < source.length && source[i] !== "}") i++;
      return Math.min(i, source.length - 1);
    }
    return index;
  }
  function regexSampleValue(index) {
    const n = Math.max(1, Number(index) || 1);
    return String(n);
  }
  function regexSampleFromPattern(source, replaceString) {
    const needed = Math.max(regexCountCaptures(source), regexMaxReplacementIndex(replaceString), 1);
    let out = "", capture = 0, escaped = false, inClass = false;
    const text = String(source || "").replace(/^\^/, "").replace(/\$$/, "");
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (escaped) {
        escaped = false;
        if (ch === "n") out += "\n";
        else if (ch === "t") out += "\t";
        else if (ch === "r") out += "";
        else if (ch === "s") out += " ";
        else if (ch === "d") out += "1";
        else if (ch === "w") out += "A";
        else out += ch;
        continue;
      }
      if (ch === "\\") { escaped = true; continue; }
      if (ch === "[") {
        inClass = true;
        while (i < text.length && text[i] !== "]") i++;
        inClass = false;
        out += regexSampleValue(Math.min(capture + 1, needed));
        i = regexSkipQuantifier(text, i);
        continue;
      }
      if (inClass) { if (ch === "]") inClass = false; continue; }
      if (ch === "(") {
        const nonCapture = text[i + 1] === "?" && !(text[i + 2] === "<" && text[i + 3] !== "=" && text[i + 3] !== "!");
        const end = regexSkipGroup(text, i);
        if (!nonCapture) { capture++; out += regexSampleValue(capture); }
        i = regexSkipQuantifier(text, end);
        continue;
      }
      if ("?*+{}".includes(ch)) continue;
      if (ch === ".") { out += regexSampleValue(Math.min(capture + 1, needed)); continue; }
      if (ch === "|") { out += " "; continue; }
      out += ch;
    }
    return out.replace(/[ \t]{2,}/g, " ").replace(/\n\s+/g, "\n").trim() || regexSampleValue(1);
  }
  function regexValidationState(data) {
    const parsed = regexParseFind(data.findRegex);
    if (!parsed.ok) return Object.assign(parsed, { captureCount: 0, replacementMax: regexMaxReplacementIndex(data.replaceString) });
    return Object.assign(parsed, {
      captureCount: regexCountCaptures(parsed.source),
      replacementMax: regexMaxReplacementIndex(data.replaceString)
    });
  }
  function updateRegexMeta(data, validation) {
    const sourceChars = String(data.findRegex || "").length + String(data.replaceString || "").length;
    $("regexMeta").textContent = `${sourceChars.toLocaleString("ko-KR")}자 · ${validation.captureCount || 0}캡처`;
    const v = $("regexValidation");
    v.classList.toggle("ok", !!validation.ok);
    v.classList.toggle("bad", !validation.ok);
    v.textContent = validation.ok
      ? `정상 · ${validation.captureCount}캡처`
      : validation.error;
  }
  function regexPreviewFallback(message) {
    return `<!doctype html><meta charset="utf-8"><style>body{margin:0;padding:18px;background:#101622;color:#dbeaff;font:13px/1.7 -apple-system,BlinkMacSystemFont,'Noto Sans KR',sans-serif}</style><body>${esc(message)}</body>`;
  }
  function refreshRegexPreview() {
    const frame = $("regexPreview"); if (!frame) return;
    const data = regexDataFromEditor();
    const previewSample = regexPlainSampleText(data.sampleText);
    const validation = regexValidationState(data);
    updateRegexMeta(data, validation);
    const badge = $("regexPreviewBadge"), status = $("regexPreviewStatus"), captures = $("regexCaptures");
    captures.innerHTML = "";
    if (!validation.ok) {
      badge.className = "regex-status bad"; badge.textContent = "검증 실패";
      status.textContent = validation.error;
      frame.srcdoc = regexPreviewFallback(validation.error);
      return;
    }
    if (!data.replaceString.trim() || !previewSample.trim()) {
      badge.className = "regex-status"; badge.textContent = "미리보기 대기";
      status.textContent = "IN, OUT, sample을 채우면 결과가 표시됩니다.";
      frame.srcdoc = regexPreviewFallback("미리보기 대기 중");
      return;
    }
    let matchCount = 0, first = null, replaced = "";
    try {
      const flags = validation.flags.includes("g") ? validation.flags : regexUniqueFlags(validation.flags + "g");
      const counter = new RegExp(validation.source, flags);
      let match, guard = 0;
      while ((match = counter.exec(previewSample)) && guard < 500) {
        if (!first) first = match;
        matchCount++; guard++;
        if (match[0] === "") counter.lastIndex++;
      }
      const runner = new RegExp(validation.source, validation.flags);
      replaced = previewSample.replace(runner, data.replaceString);
    } catch (error) {
      const msg = error && error.message ? error.message : "미리보기를 만들지 못했습니다.";
      badge.className = "regex-status bad"; badge.textContent = "미리보기 실패";
      status.textContent = msg;
      frame.srcdoc = regexPreviewFallback(msg);
      return;
    }
    const matchLabel = matchCount === 1 ? "매치" : `${matchCount}개 매치`;
    badge.className = matchCount ? "regex-status ok" : "regex-status bad";
    badge.textContent = matchCount ? matchLabel : "매치 없음";
    status.textContent = matchCount
      ? `${matchLabel} · OUT HTML을 샌드박스에서 렌더링했습니다.`
      : "샘플에서 일치하는 범위를 찾지 못했습니다.";
    if (first && first.length > 1) {
      captures.innerHTML = first.slice(1).map((value, index) => `<div class="regex-capture-row"><b>$${index + 1}</b><span>${esc(value == null ? "" : String(value))}</span></div>`).join("");
    }
    frame.srcdoc = buildSandboxPreview(replaced);
  }
  let regexWorkshopSession = null, regexPreviewTimer = null, regexViewMode = "edit";
  function setRegexSaver(mode) {
    const s = $("regexSaver"); if (!s) return;
    s.className = "saver " + mode;
    $("regexSaverText").textContent = mode === "dirty" ? "기록 중" : mode === "saved" ? "저장됨" : "";
    if (mode === "saved") setTimeout(() => { if (s.classList.contains("saved")) { s.className = "saver"; $("regexSaverText").textContent = ""; } }, 1500);
  }
  function queueRegexPreview() {
    clearTimeout(regexPreviewTimer);
    regexPreviewTimer = setTimeout(refreshRegexPreview, 180);
  }
  function setRegexView(mode) {
    const screen = $("screen-regex");
    const allowed = (mode === "preview" || mode === "split") ? mode : "edit";
    regexViewMode = allowed; screen.dataset.regexView = allowed;
    $("regexModeEdit").classList.toggle("active", allowed === "edit");
    $("regexModePreview").classList.toggle("active", allowed === "preview");
    $("regexModeSplit").classList.toggle("active", allowed === "split");
    if (allowed !== "edit") refreshRegexPreview();
  }
  function beginRegexWorkshopSession(n) {
    const data = normalizeRegexData(n.data || {});
    const same = regexWorkshopSession && regexWorkshopSession.active && regexWorkshopSession.noteId === n.id;
    if (!same) {
      clearTimeout(st.saveTimer); st.saveTimer = null;
      regexWorkshopSession = { noteId: n.id, active: true, dirty: false, revision: 0, lastQueuedRevision: -1, inFlight: Promise.resolve() };
      setRegexEditorData(data);
      refreshRegexPreview();
      setRegexView(regexViewMode);
    } else if (!regexWorkshopSession.dirty && !jsonSame(regexDataFromEditor(), data)) {
      setRegexEditorData(data); refreshRegexPreview();
    }
  }
  function activeRegexSession(expectedId) {
    const session = regexWorkshopSession;
    if (!session || !session.active || !session.noteId) return null;
    if (expectedId && session.noteId !== expectedId) return null;
    if (st.curNoteId !== session.noteId) return null;
    return session;
  }
  function scheduleRegexSave() {
    const session = activeRegexSession();
    if (!session || curView().s !== "regex") return;
    const n = getNote(session.noteId); if (!n || n.type !== "regex") return;
    const literal = regexSplitLiteral($("regexFind").value);
    if (literal && !literal.unclosed) $("regexGlobal").checked = /g/.test(literal.flags);
    session.dirty = true; session.revision += 1;
    const draft = regexDraftFromEditor();
    writeDraft(n, "regex", draft); queueRegexPreview();
    setRegexSaver("dirty"); clearTimeout(st.saveTimer);
    const id = session.noteId, revision = session.revision;
    st.saveTimer = setTimeout(() => {
      if (activeRegexSession(id) === session && session.revision >= revision) void flushRegexSave(false, id);
    }, 550);
  }
  function flushRegexSave(silent, expectedId) {
    clearTimeout(st.saveTimer); st.saveTimer = null;
    const session = activeRegexSession(expectedId);
    if (!session || !session.dirty) return session && session.inFlight ? session.inFlight : Promise.resolve();
    const noteId = session.noteId, n = getNote(noteId);
    if (!n || n.type !== "regex") return Promise.resolve();
    const draft = regexDraftFromEditor(), revision = session.revision;
    if (session.lastQueuedRevision === revision) return session.inFlight || Promise.resolve();
    session.lastQueuedRevision = revision;
    const write = async () => {
      const note = getNote(noteId); if (!note || note.type !== "regex") return;
      if (jsonSame(normalizeRegexData(note.data || {}), draft)) {
        if (regexWorkshopSession === session && session.revision === revision) { session.dirty = false; clearDraftIfSynced(note, "regex", draft); }
        return;
      }
      note.data = normalizeRegexData(draft);
      if (!note.titleLocked && note.data.scriptName.trim()) note.title = note.data.scriptName.trim().slice(0, 80);
      await saveNote(note);
      if (regexWorkshopSession === session && session.revision === revision) {
        session.dirty = false; clearDraftIfSynced(note, "regex", draft); if (!silent) setRegexSaver("saved");
      }
    };
    session.inFlight = (session.inFlight || Promise.resolve()).then(write, write);
    return session.inFlight;
  }
  async function leaveRegexWorkshop() {
    const session = regexWorkshopSession;
    if (!session || !session.active) return;
    await flushRegexSave(true, session.noteId);
    if (regexWorkshopSession === session) {
      session.active = false; session.noteId = null; session.dirty = false;
      clearTimeout(st.saveTimer); st.saveTimer = null; clearTimeout(regexPreviewTimer);
    }
  }
  function renderRegexWorkshop() {
    const n = getNote(st.curNoteId);
    if (!n || n.type !== "regex") { back(); return; }
    beginRegexWorkshopSession(n);
    $("regexTitle").textContent = n.title || "정규식 작업실";
    setRegexSaver(""); queueDraftRecovery(n, "regex");
  }
  function regexBuildExportPayload(id) {
    const n = getNote(id); if (!n || n.type !== "regex") return null;
    const data = normalizeRegexData((activeRegexSession(id) && $("regexFind")) ? regexDataFromEditor() : (n.data || {}));
    return {
      id: data.id || n.id,
      scriptName: data.scriptName || n.title || "Lumink Regex",
      findRegex: regexSetGlobalInFind(data.findRegex, data.global),
      replaceString: data.replaceString,
      trimStrings: data.trimStrings,
      placement: data.placement,
      disabled: data.disabled,
      markdownOnly: data.markdownOnly,
      promptOnly: data.promptOnly,
      runOnEdit: data.runOnEdit,
      substituteRegex: data.substituteRegex,
      minDepth: data.minDepth,
      maxDepth: data.maxDepth
    };
  }
  async function exportRegexJson(id) {
    const n = getNote(id); if (!n || n.type !== "regex") return;
    await flushRegexSave(true, id);
    const payload = regexBuildExportPayload(id);
    const check = regexParseFind(payload.findRegex);
    if (!check.ok) { toast(check.error); return; }
    const json = JSON.stringify(payload, null, 4).replace(/</g, "\\u003c");
    downloadDoc(json, `${regexFileBaseName(payload.scriptName || n.title)}.json`, "application/json");
    toast("SillyTavern JSON을 저장했어요");
  }
  function openRegexSheet(n) {
    openSheet(n.title, [
      { icon: IC.pin, label: n.pinned ? "고정 해제" : "상단 고정", fn: () => togglePinNote(n.id) },
      { icon: IC.rename, label: "이름 바꾸기", fn: () => renameModal("정규식 작업실 이름", n.title, async (v) => { if (v) { n.title = v; n.titleLocked = true; await saveNote(n); render(); } }) },
      { icon: IC.color, label: "색상 지정", fn: () => showChipPicker(n.id) },
      { icon: IC.save, label: "SillyTavern JSON 내보내기", fn: () => void exportRegexJson(n.id) },
      { icon: IC.move, label: "다른 프로젝트로 이동", fn: () => pickTargetProject(n.projectId, (pid) => moveNote(n.id, pid).then(render)) },
      { icon: IC.copy, label: "선택 위치로 복제", fn: () => pickTargetProject(n.projectId, (pid) => duplicateNote(n.id, pid).then(render)) },
      { icon: IC.del, label: "삭제", danger: true, fn: () => confirmModal("정규식 작업실 삭제", `'${n.title}'를 삭제할까요?`, "삭제", true, async () => { await deleteNote(n.id); back(); }) }
    ]);
  }
  // Regex OUT template UI is intentionally hidden for now.
  // Keep these builders so the template feature can be restored later without rebuilding the designs.
  function regexStatusTemplate(count) {
    const rows = Array.from({ length: count }, (_, i) => `<div class="li-rx-stat"><span>항목 ${i + 1}</span><b>$${i + 1}</b></div>`).join("");
    return `<div class="li-rx-status"><style>.li-rx-status{max-width:620px;margin:16px auto;padding:18px;border:1px solid rgba(74,209,167,.35);border-radius:14px;background:linear-gradient(180deg,#10213a,#0d1728);color:#edf8ff;font-family:-apple-system,BlinkMacSystemFont,'Noto Sans KR',sans-serif;box-shadow:0 16px 40px rgba(0,0,0,.28)}.li-rx-status h3{margin:0 0 14px;font-size:13px;letter-spacing:.16em;text-transform:uppercase;color:#91ffe0}.li-rx-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px}.li-rx-stat{padding:10px;border-radius:8px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.08)}.li-rx-stat span{display:block;font-size:11px;color:#9bb2c8}.li-rx-stat b{display:block;margin-top:3px;font-size:18px;color:#fff;word-break:break-word}</style><h3>Status</h3><div class="li-rx-grid">${rows}</div></div>`;
  }
  function regexAlertTemplate(count) {
    const rows = Array.from({ length: count }, (_, i) => `<li><span>$${i + 1}</span></li>`).join("");
    return `<div class="li-rx-alert"><style>.li-rx-alert{max-width:520px;margin:18px auto;padding:16px 18px;border-radius:12px;background:#fff7e6;border:1px solid #f0c978;color:#3f2c0b;font-family:-apple-system,BlinkMacSystemFont,'Noto Sans KR',sans-serif;box-shadow:0 10px 26px rgba(104,72,20,.16)}.li-rx-alert strong{display:block;margin-bottom:9px;font-size:14px;color:#7a4c00}.li-rx-alert ul{margin:0;padding-left:18px}.li-rx-alert li{margin:6px 0}.li-rx-alert span{white-space:pre-wrap;overflow-wrap:anywhere}</style><strong>Notice</strong><ul>${rows}</ul></div>`;
  }
  function regexMessageTemplate(count) {
    const rows = Array.from({ length: count }, (_, i) => `<p>$${i + 1}</p>`).join("");
    return `<div class="li-rx-msg"><style>.li-rx-msg{max-width:560px;margin:16px auto;padding:16px;border-radius:14px;background:#f2f7fb;color:#223044;font-family:-apple-system,BlinkMacSystemFont,'Noto Sans KR',sans-serif}.li-rx-msg .bubble{padding:12px 14px;border-radius:12px;background:#fff;border:1px solid #dbe7f2;box-shadow:0 8px 18px rgba(39,64,91,.12)}.li-rx-msg p{margin:.35em 0;white-space:pre-wrap;overflow-wrap:anywhere}</style><div class="bubble">${rows}</div></div>`;
  }
  function openRegexTemplatePicker() {
    let selected = "status";
    const maxByType = { status: 20, alert: 10, message: 5 };
    const labelByType = { status: "상태창", alert: "알림창", message: "메시지창" };
    const renderChoice = (type, desc) => `<button type="button" class="type-card regex-template-choice ${selected === type ? "is-selected" : ""}" data-regex-template="${type}"><div class="tc-ico"><svg viewBox="0 0 24 24"><path d="M4 5h16v14H4z"/><path d="M8 9h8M8 13h5M8 17h7"/></svg></div><div><div class="tc-name">${labelByType[type]}</div><div class="tc-desc">${desc}</div></div><span class="tc-soon">${selected === type ? "선택됨" : "선택"}</span></button>`;
    const draw = () => {
      $("modalBox").querySelectorAll("[data-regex-template]").forEach((el) => {
        const on = el.dataset.regexTemplate === selected;
        el.classList.toggle("is-selected", on);
        const chip = el.querySelector(".tc-soon"); if (chip) chip.textContent = on ? "선택됨" : "선택";
      });
      const input = $("regexTemplateCount"); if (input) { input.max = String(maxByType[selected]); if (Number(input.value) > maxByType[selected]) input.value = String(maxByType[selected]); }
    };
    openModal(`<h3>OUT 템플릿</h3><p class="m-sub">디자인을 고른 뒤 사용할 $n 개수를 정하세요.</p>
      ${renderChoice("status", "$1~$20 상태 항목")}
      ${renderChoice("alert", "$1~$10 알림 항목")}
      ${renderChoice("message", "$1~$5 메시지 문단")}
      <div class="m-field-label">$n 개수</div><input class="m-input" id="regexTemplateCount" type="number" min="1" max="20" value="6" inputmode="numeric">
      <div class="m-row"><button class="m-btn" id="regexTemplateCancel">취소</button><button class="m-btn primary" id="regexTemplateApply">적용</button></div>`);
    $("modalBox").querySelectorAll("[data-regex-template]").forEach((el) => el.addEventListener("click", () => { selected = el.dataset.regexTemplate; draw(); }));
    $on("regexTemplateCancel", "click", closeModal);
    $on("regexTemplateApply", "click", () => {
      const max = maxByType[selected], count = Math.max(1, Math.min(max, Number($("regexTemplateCount").value) || 1));
      const html = selected === "status" ? regexStatusTemplate(count) : selected === "alert" ? regexAlertTemplate(count) : regexMessageTemplate(count);
      $("regexReplace").value = html;
      closeModal(); scheduleRegexSave(); setRegexView("split"); toast(`${labelByType[selected]} 템플릿을 OUT에 적용했어요`);
    });
    draw();
  }
  function applyRegexFromSample() {
    const sample = $("regexSample").value;
    if (!sample.trim()) { toast("샘플을 먼저 입력해 주세요"); return; }
    const built = regexPatternFromMarkedSample(sample);
    $("regexFind").value = regexSetGlobalInFind(built.pattern, $("regexGlobal").checked);
    updateRegexSampleHighlight();
    scheduleRegexSave();
    toast(`IN 정규식을 만들었어요 · ${built.captures}캡처`);
  }
  function applyRegexAutoSample() {
    const data = regexDataFromEditor(), parsed = regexParseFind(data.findRegex);
    if (!parsed.ok) { toast("올바른 IN 정규식을 먼저 입력해 주세요"); return; }
    $("regexSample").value = regexSampleFromPattern(parsed.source, data.replaceString);
    updateRegexSampleHighlight();
    scheduleRegexSave();
    toast("샘플을 자동 작성했어요");
  }

  /* ---------- free-memo editor ---------- */
  // 에디터 DOM은 한 개만 재사용됩니다. noteId를 세션으로 묶지 않으면 뒤늦은 blur·timer가
  // 다음에 연 빈 메모에 이전 DOM 내용을 덮어쓰는 경쟁 상태가 생길 수 있어요.
  let freeEditorSession = null;
  function setSaver(mode) {
    const s = $("saver"); s.className = "saver " + mode;
    $("saverText").textContent = mode === "dirty" ? "기록 중" : mode === "saved" ? "저장됨" : "";
    if (mode === "saved") setTimeout(() => { if (s.classList.contains("saved")) { s.className = "saver"; $("saverText").textContent = ""; } }, 1500);
  }
  function beginFreeEditorSession(n) {
    const html = noteHtml(n), editor = $("editor"), code = $("codeArea");
    const same = freeEditorSession && freeEditorSession.active && freeEditorSession.noteId === n.id;
    if (!same) {
      clearTimeout(st.saveTimer); st.saveTimer = null;
      freeEditorSession = { noteId: n.id, active: true, dirty: false, revision: 0, lastQueuedRevision: -1, inFlight: Promise.resolve() };
      clearEditorImageSelection();
      editor.classList.add("lumink-user-html");
      editor.innerHTML = html; code.value = html;
    } else if (!freeEditorSession.dirty) {
      if (editor.innerHTML !== html) { clearEditorImageSelection(); editor.innerHTML = html; }
      if (code.value !== html) code.value = html;
    }
    if (st.codeMode) { st.codeMode = false; document.body.classList.remove("code-mode"); $("codeToggle").classList.remove("active"); }
  }
  function activeFreeSession(expectedId) {
    const session = freeEditorSession;
    if (!session || !session.active || !session.noteId) return null;
    if (expectedId && session.noteId !== expectedId) return null;
    if (st.curNoteId !== session.noteId) return null;
    return session;
  }
  function scheduleSave() {
    const session = activeFreeSession();
    if (!session || curView().s !== "editor") return;
    if (!st.codeMode) normalizeLinks($("editor"));
    const n = getNote(session.noteId); if (!n || n.type !== "free") return;
    session.dirty = true; session.revision += 1;
    writeDraft(n, "free", freeDraftFromEditor());
    setSaver("dirty"); clearTimeout(st.saveTimer);
    const id = session.noteId, revision = session.revision;
    st.saveTimer = setTimeout(() => {
      if (activeFreeSession(id) === session && session.revision >= revision) void flushSave(false, id);
    }, 550);
  }
  function flushSave(silent, expectedId) {
    clearTimeout(st.saveTimer); st.saveTimer = null;
    const session = activeFreeSession(expectedId);
    if (!session || !session.dirty) return session && session.inFlight ? session.inFlight : Promise.resolve();
    const noteId = session.noteId, n = getNote(noteId);
    if (!n || n.type !== "free") return Promise.resolve();
    const draft = freeDraftFromEditor(), html = draft.html, revision = session.revision;
    if (session.lastQueuedRevision === revision) return session.inFlight || Promise.resolve();
    session.lastQueuedRevision = revision;
    const write = async () => {
      const note = getNote(noteId);
      if (!note || note.type !== "free") return;
      if (html === noteHtml(note)) {
        if (freeEditorSession === session && session.revision === revision) { session.dirty = false; clearDraftIfSynced(note, "free", draft); }
        return;
      }
      note.data = note.data || {}; note.data.html = html;
      if (!note.titleLocked) { note.title = deriveTitle(html); if (st.curNoteId === noteId) $("edTitle").textContent = note.title; }
      await saveNote(note);
      if (freeEditorSession === session && session.revision === revision) {
        session.dirty = false; clearDraftIfSynced(note, "free", draft);
        if (!silent) setSaver("saved");
      }
    };
    session.inFlight = (session.inFlight || Promise.resolve()).then(write, write);
    return session.inFlight;
  }
  async function leaveFreeEditor() {
    const session = freeEditorSession;
    if (!session || !session.active) return;
    await flushSave(true, session.noteId);
    if (freeEditorSession === session) {
      clearEditorImageSelection();
      session.active = false; session.noteId = null; session.dirty = false;
      clearTimeout(st.saveTimer); st.saveTimer = null;
    }
  }
  function exec(cmd, val) { $("editor").focus(); try { document.execCommand("styleWithCSS", false, true); } catch (e) {} document.execCommand(cmd, false, val || null); scheduleSave(); }
  async function setCodeMode(on) {
    const session = activeFreeSession();
    if (!session || on === st.codeMode) return;
    await flushSave(true, session.noteId);
    const html = noteHtml(getNote(session.noteId));
    if (on) { clearEditorImageSelection(); $("codeArea").value = html; }
    else { $("editor").innerHTML = html; }
    st.codeMode = on;
    document.body.classList.toggle("code-mode", on);
    $("codeToggle").classList.toggle("active", on);
    if (on) $("codeArea").focus(); else $("editor").focus();
  }
  const COLOR_PALETTE = ["#000000","#434343","#666666","#999999","#b7b7b7","#dddddd","#f3f3f3","#ffffff","#e11d48","#f43f5e","#f97316","#f59e0b","#eab308","#84cc16","#22c55e","#10b981","#14b8a6","#06b6d4","#0ea5e9","#3b82f6","#6366f1","#8b5cf6","#a855f7","#d946ef","#ec4899","#7f1d1d","#7c2d12","#14532d","#0c4a6e","#1e3a8a","#3b0764","#831843"];
  let colorRange = null, colorCur = "#6ad0ff";
  function getSavedColors() { try { return JSON.parse(localStorage.getItem("luminkColors") || "[]"); } catch (e) { return []; } }
  function setSavedColors(a) { try { localStorage.setItem("luminkColors", JSON.stringify(a.slice(0, 24))); } catch (e) {} }
  function normHex(v) { v = (v || "").trim(); if (!v) return null; if (v[0] !== "#") v = "#" + v; if (/^#[0-9a-fA-F]{3}$/.test(v)) v = "#" + v.slice(1).split("").map((c) => c + c).join(""); return /^#[0-9a-fA-F]{6}$/.test(v) ? v.toLowerCase() : null; }
  function hexToRgbParts(hex) { const h = normHex(hex) || "#000000"; return { r: parseInt(h.slice(1,3),16), g: parseInt(h.slice(3,5),16), b: parseInt(h.slice(5,7),16) }; }
  function clampRgb(value) { return Math.max(0, Math.min(255, Math.round(Number(value) || 0))); }
  function rgbPartsToHex(r, g, b) { return "#" + [clampRgb(r), clampRgb(g), clampRgb(b)].map((n) => n.toString(16).padStart(2, "0")).join(""); }

  function rgbToHsvParts(r, g, b) {
    const rr = clampRgb(r) / 255, gg = clampRgb(g) / 255, bb = clampRgb(b) / 255;
    const max = Math.max(rr, gg, bb), min = Math.min(rr, gg, bb), d = max - min;
    let h = 0;
    if (d) {
      if (max === rr) h = 60 * (((gg - bb) / d) % 6);
      else if (max === gg) h = 60 * (((bb - rr) / d) + 2);
      else h = 60 * (((rr - gg) / d) + 4);
    }
    if (h < 0) h += 360;
    return { h: Math.round(h), s: max ? Math.round((d / max) * 100) : 0, v: Math.round(max * 100) };
  }
  function hexToHsvParts(hex) { const rgb = hexToRgbParts(hex); return rgbToHsvParts(rgb.r, rgb.g, rgb.b); }
  function hsvToHex(h, s, v) {
    const hue = ((Number(h) % 360) + 360) % 360, sat = Math.max(0, Math.min(100, Number(s) || 0)) / 100, val = Math.max(0, Math.min(100, Number(v) || 0)) / 100;
    const c = val * sat, x = c * (1 - Math.abs(((hue / 60) % 2) - 1)), m = val - c;
    let r = 0, g = 0, b = 0;
    if (hue < 60) [r, g, b] = [c, x, 0];
    else if (hue < 120) [r, g, b] = [x, c, 0];
    else if (hue < 180) [r, g, b] = [0, c, x];
    else if (hue < 240) [r, g, b] = [0, x, c];
    else if (hue < 300) [r, g, b] = [x, 0, c];
    else [r, g, b] = [c, 0, x];
    return rgbPartsToHex((r + m) * 255, (g + m) * 255, (b + m) * 255);
  }
  // EyeDropper API 미지원 브라우저용 실제 화면 색추출기.
  // 화면을 캡처해 전체화면으로 띄우고, 손가락 위 돋보기로 정확한 지점의 색을 탭으로 추출합니다.
  async function runScreenEyedropper(onPick){
    if(typeof window.html2canvas!=="function"){ toast("이 브라우저에서는 화면 스포이드를 사용할 수 없어요."); return; }
    toast("화면을 준비하고 있어요…");
    const dpr=Math.max(1,Math.min(3,window.devicePixelRatio||1));
    const scrim=document.getElementById("modalScrim");
    const scrimViz=scrim?scrim.style.visibility:"";
    if(scrim) scrim.style.visibility="hidden";
    await new Promise((r)=>requestAnimationFrame(()=>requestAnimationFrame(r)));
    let shot;
    try{
      shot=await captureHtml2CanvasSafe(document.body,{
        backgroundColor:(getComputedStyle(document.body).backgroundColor)||"#0e1320",
        scale:dpr, logging:false, useCORS:true, allowTaint:false,
        x:window.scrollX, y:window.scrollY, width:window.innerWidth, height:window.innerHeight,
        scrollX:0, scrollY:0, windowWidth:document.documentElement.clientWidth, windowHeight:document.documentElement.clientHeight,
        onclone:(doc,el)=>{ try{ normalizeCloneColorFns(el||doc.body); }catch(e){} try{ rasterizeRepeatingGradients(el||doc.body); }catch(e){} try{ stripInsetShadows(el||doc.body); }catch(e){} }
      });
    }catch(e){ console.warn("eyedropper snapshot",e); if(scrim) scrim.style.visibility=scrimViz; toast("화면을 캡처하지 못해 스포이드를 열 수 없어요."); return; }
    if(scrim) scrim.style.visibility=scrimViz;
    const ctx=shot.getContext("2d", { willReadFrequently:true });
    await new Promise((resolve)=>{
      const ov=document.createElement("div"); ov.className="ce-eyedropper-overlay";
      ov.innerHTML=`<canvas class="ce-eyedropper-shot"></canvas><div class="ce-eyedropper-loupe" hidden><canvas></canvas><span class="ce-eyedropper-hex"></span></div><button type="button" class="ce-eyedropper-cancel">취소</button><div class="ce-eyedropper-hint">화면을 탭하면 그 지점의 색을 추출해요</div>`;
      const view=ov.querySelector(".ce-eyedropper-shot");
      view.width=shot.width; view.height=shot.height;
      view.getContext("2d").drawImage(shot,0,0);
      view.style.width=window.innerWidth+"px"; view.style.height=window.innerHeight+"px";
      const loupe=ov.querySelector(".ce-eyedropper-loupe"), lcv=loupe.querySelector("canvas"), hexEl=loupe.querySelector(".ce-eyedropper-hex");
      lcv.width=lcv.height=96;
      document.body.appendChild(ov);
      const toHex=(r,g,b)=>"#"+[r,g,b].map((x)=>Math.max(0,Math.min(255,x)).toString(16).padStart(2,"0")).join("");
      let lastHex=null;
      const sample=(clientX,clientY)=>{
        const cx=Math.max(0,Math.min(shot.width-1,Math.round(clientX*dpr))), cy=Math.max(0,Math.min(shot.height-1,Math.round(clientY*dpr)));
        let d; try{ d=ctx.getImageData(cx,cy,1,1).data; }catch(e){ return; }
        lastHex=toHex(d[0],d[1],d[2]);
        loupe.hidden=false;
        const lctx=lcv.getContext("2d"); lctx.imageSmoothingEnabled=false;
        const span=Math.round(lcv.width/8);
        lctx.clearRect(0,0,lcv.width,lcv.height);
        lctx.drawImage(shot, cx-span/2, cy-span/2, span, span, 0,0, lcv.width, lcv.height);
        lctx.strokeStyle="rgba(0,0,0,.55)"; lctx.strokeRect(lcv.width/2-6,lcv.height/2-6,12,12);
        lctx.strokeStyle="#fff"; lctx.strokeRect(lcv.width/2-5,lcv.height/2-5,10,10);
        hexEl.textContent=lastHex;
        let lx=clientX+20, ly=clientY-118; if(lx+112>window.innerWidth)lx=clientX-132; if(ly<8)ly=clientY+28;
        loupe.style.left=lx+"px"; loupe.style.top=ly+"px";
      };
      const move=(e)=>{ if(e.cancelable)e.preventDefault(); sample(e.clientX,e.clientY); };
      const cleanup=(done,hex)=>{ document.removeEventListener("keydown",onKey,true); ov.remove(); if(done&&hex&&typeof onPick==="function"){ onPick(hex); toast("스포이드 색상을 가져왔어요. 적용을 누르면 반영됩니다."); } resolve(); };
      const onKey=(e)=>{ if(e.key==="Escape"){ e.preventDefault(); cleanup(false); } };
      view.addEventListener("pointermove",move,{passive:false});
      view.addEventListener("pointerdown",(e)=>{ if(e.cancelable)e.preventDefault(); sample(e.clientX,e.clientY); });
      view.addEventListener("pointerup",(e)=>{ if(e.cancelable)e.preventDefault(); sample(e.clientX,e.clientY); cleanup(true,lastHex); });
      ov.querySelector(".ce-eyedropper-cancel").addEventListener("pointerdown",(e)=>{ e.preventDefault(); e.stopPropagation(); cleanup(false); });
      document.addEventListener("keydown",onKey,true);
      toast("화면을 탭해 색을 추출하세요");
    });
  }
  function colorStudioRgbFields(prefix) {
    return `<div class="ce-rgb-row" aria-label="RGB 직접 입력"><label class="ce-rgb-field"><span class="ce-rgb-tag">R</span><input class="ce-rgb" id="${prefix}RgbR" inputmode="numeric" type="number" min="0" max="255" aria-label="Red"></label><label class="ce-rgb-field"><span class="ce-rgb-tag">G</span><input class="ce-rgb" id="${prefix}RgbG" inputmode="numeric" type="number" min="0" max="255" aria-label="Green"></label><label class="ce-rgb-field"><span class="ce-rgb-tag">B</span><input class="ce-rgb" id="${prefix}RgbB" inputmode="numeric" type="number" min="0" max="255" aria-label="Blue"></label></div>`;
  }
  function colorStudioMarkup(prefix, options) {
    const opts = Object.assign({ saved: true, save: true }, options || {});
    const palette = COLOR_PALETTE.map((c) => `<button type="button" class="ce-sw" data-${prefix}-preset="${c}" style="background:${c}" aria-label="${c}" title="${c}"></button>`).join("");
    const save = opts.save ? `<button class="ce-addbtn" id="${prefix}Save" type="button">저장</button>` : "";
    const eyedropper = `<button class="ce-eye-btn" id="${prefix}Eyedropper" type="button" aria-label="화면에서 색상 추출" title="화면에서 색상 추출"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14.2 4.1 5.7 5.7-2.2 2.2-1.4-1.4-7.1 7.1a2.8 2.8 0 0 1-4 0l-.8-.8a2.8 2.8 0 0 1 0-4l7.1-7.1-1.4-1.4 2.2-2.2 1.9 1.9Z"/><path d="m3.5 20.5 4.2-4.2"/></svg></button>`;
    const saved = opts.saved ? `<div class="ce-section-label">내 색상</div><div id="${prefix}Saved"></div>` : "";
    return `<div class="ce-studio" data-color-studio="${prefix}">`
      + `<div class="ce-square" id="${prefix}Square" role="slider" aria-label="채도와 명도 선택"><span class="ce-square-cursor" id="${prefix}SquareCursor"></span></div>`
      + `<input class="ce-hue" id="${prefix}Hue" type="range" min="0" max="360" step="1" aria-label="색조">`
      + `<div class="ce-custom-row"><input type="color" class="ce-native" id="${prefix}Native" aria-label="색상 선택기"><input class="ce-hex" id="${prefix}Hex" maxlength="7" spellcheck="false" placeholder="#000000" aria-label="HEX 코드">${save}${eyedropper}</div>`
      + colorStudioRgbFields(prefix)
      + `<div class="ce-section-label">기본 색상</div><div class="ce-swatches" id="${prefix}Palette">${palette}</div>`
      + saved
      + `</div>`;
  }
  function bindColorStudio(prefix, initial, options) {
    const opts = Object.assign({ saved: true, save: true, onChange: null, onSave: null }, options || {});
    const root = $("modalBox");
    let current = normHex(initial) || "#7b9bff";
    let hsv = hexToHsvParts(current);
    const node = (suffix) => $(prefix + suffix);
    const square = node("Square"), cursor = node("SquareCursor"), hue = node("Hue");
    const sync = () => {
      const rgb = hexToRgbParts(current);
      const chip = node("PrevChip"), label = node("PrevText"), native = node("Native"), field = node("Hex");
      if (square) square.style.setProperty("--ce-hue", String(hsv.h));
      if (cursor) { cursor.style.left = `${hsv.s}%`; cursor.style.top = `${100 - hsv.v}%`; }
      if (hue && document.activeElement !== hue) hue.value = String(hsv.h);
      if (chip) chip.style.background = current;
      if (label) label.style.color = current;
      if (native) native.value = current;
      if (field && document.activeElement !== field) field.value = current;
      ["R", "G", "B"].forEach((part) => { const input = node("Rgb" + part); const key = part.toLowerCase(); if (input && document.activeElement !== input) input.value = rgb[key]; });
      if (root) root.querySelectorAll(`[data-${prefix}-preset]`).forEach((button) => button.classList.toggle("sel", button.getAttribute(`data-${prefix}-preset`) === current));
      if (typeof opts.onChange === "function") opts.onChange(current);
    };
    const setCurrent = (value, nextHsv) => {
      const hex = normHex(value); if (!hex) return;
      current = hex; hsv = nextHsv || hexToHsvParts(hex); sync();
    };
    const setSquarePoint = (event) => {
      if (!square) return;
      const rect = square.getBoundingClientRect();
      const s = Math.max(0, Math.min(100, ((event.clientX - rect.left) / Math.max(1, rect.width)) * 100));
      const v = Math.max(0, Math.min(100, (1 - ((event.clientY - rect.top) / Math.max(1, rect.height))) * 100));
      setCurrent(hsvToHex(hsv.h, s, v), { h: hsv.h, s, v });
    };
    if (square) {
      square.addEventListener("pointerdown", (event) => { if (event.button != null && event.button !== 0) return; event.preventDefault(); try { square.setPointerCapture(event.pointerId); } catch (e) {} setSquarePoint(event); });
      square.addEventListener("pointermove", (event) => { if (event.buttons || event.pointerType === "touch") setSquarePoint(event); });
    }
    if (hue) hue.addEventListener("input", () => { const h = Number(hue.value) || 0; setCurrent(hsvToHex(h, hsv.s, hsv.v), { h, s: hsv.s, v: hsv.v }); });
    if (root) root.querySelectorAll(`[data-${prefix}-preset]`).forEach((button) => button.addEventListener("click", () => setCurrent(button.getAttribute(`data-${prefix}-preset`))));
    const native = node("Native"), hexField = node("Hex");
    if (native) native.addEventListener("input", (event) => setCurrent(event.target.value));
    if (hexField) hexField.addEventListener("input", (event) => { const hex = normHex(event.target.value); if (hex) setCurrent(hex); });
    ["R", "G", "B"].forEach((part) => { const input = node("Rgb" + part); if (input) input.addEventListener("input", () => { const values = [node("RgbR").value, node("RgbG").value, node("RgbB").value]; if (values.some((value) => value === "")) return; setCurrent(rgbPartsToHex(values[0], values[1], values[2])); }); });
    const drawSaved = () => {
      const host = node("Saved"); if (!host) return;
      const saved = getSavedColors();
      host.innerHTML = saved.length ? `<div class="ce-swatches">${saved.map((color) => `<button type="button" class="ce-sw ce-saved-sw" data-${prefix}-saved="${color}" style="background:${color}" aria-label="${color}" title="${color} · 길게 눌러 삭제"></button>`).join("")}</div>` : '<div class="ce-saved-empty">저장된 색이 없어요. 색을 고르고 “저장”을 눌러보세요.</div>';
      host.querySelectorAll(`[data-${prefix}-saved]`).forEach((button) => {
        const color=button.getAttribute(`data-${prefix}-saved`), remove=()=>confirmModal("저장 색상 삭제", `${String(color||"").toUpperCase()} 색상을 내 색상에서 삭제할까요?`, "삭제", true, ()=>{
          setSavedColors(getSavedColors().filter((value)=>value!==color)); drawSaved(); toast("저장한 색상을 삭제했어요");
        });
        let timer=null, moved=false, held=false;
        const clear=()=>{ if(timer){clearTimeout(timer);timer=null;} };
        button.addEventListener("pointerdown",(event)=>{ if(event.button!=null&&event.button!==0)return; moved=false; held=false; clear(); timer=setTimeout(()=>{if(!moved){held=true;navigator.vibrate&&navigator.vibrate(12);remove();}},520); });
        button.addEventListener("pointermove",()=>{moved=true;clear();});
        button.addEventListener("pointerup",clear); button.addEventListener("pointercancel",clear); button.addEventListener("contextmenu",(event)=>{event.preventDefault();clear();held=true;remove();});
        button.addEventListener("click",(event)=>{ if(held){event.preventDefault();event.stopPropagation();held=false;return;} setCurrent(color); });
      });
    };
    const save = node("Save");
    if (save) save.addEventListener("click", () => { const colors = getSavedColors().filter((color) => color !== current); colors.unshift(current); setSavedColors(colors); drawSaved(); if (typeof opts.onSave === "function") opts.onSave(current); else toast("색을 저장했어요"); });
    const eyedropper = node("Eyedropper");
    if (eyedropper) {
      // 일부 브라우저/PWA에서는 EyeDropper가 없거나 중복 click 바인딩 때문에
      // open()이 두 번 호출되어 즉시 취소될 수 있었습니다. 한 번의 경로만 유지합니다.
      const EyeDropperCtor = (typeof window !== "undefined" && window.EyeDropper) || (typeof globalThis !== "undefined" && globalThis.EyeDropper);
      const supported = typeof EyeDropperCtor === "function";
      const nativeFallback = node("Native");
      eyedropper.disabled = false;
      eyedropper.classList.remove("unsupported");
      eyedropper.setAttribute("aria-disabled", "false");
      eyedropper.title = supported ? "화면에서 색상 추출" : "화면을 캡처해 색을 추출합니다";
      let sampling = false;
      eyedropper.addEventListener("click", async (event) => {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (sampling) return;
        sampling = true;
        eyedropper.classList.add("is-sampling");
        try {
          if (supported) {
            const result = await new EyeDropperCtor().open();
            if (result && result.sRGBHex) {
              setCurrent(result.sRGBHex);
              toast("스포이드 색상을 가져왔어요. 적용을 누르면 반영됩니다.");
            }
          } else {
            await runScreenEyedropper(setCurrent);
          }
        } catch (e) {
          if (e && e.name !== "AbortError") toast("스포이드를 실행하지 못했어요. 잠시 후 다시 시도해 주세요.");
        } finally {
          sampling = false;
          eyedropper.classList.remove("is-sampling");
        }
      });
    }
    sync(); if (opts.saved) drawSaved();
    return { get current() { return current; }, setCurrent };
  }
  function openAdvancedColorPicker(title, initial, onApply, options) {
    const opts = Object.assign({ prefix: "advancedColor", saved: true, save: true, intro: "사각형 안을 터치해 원하는 채도와 명도를 고르고, 색조 슬라이더로 전체 색감을 바꿀 수 있어요." }, options || {});
    openModal(`<h3>${esc(title || "직접 색상 선택")}</h3><p class="m-sub">${esc(opts.intro)}</p>${colorStudioMarkup(opts.prefix, opts)}<div class="m-row"><button class="m-btn" id="${opts.prefix}Cancel">취소</button><button class="m-btn primary" id="${opts.prefix}Apply">적용</button></div>`);
    const studio = bindColorStudio(opts.prefix, initial, opts);
    $on(opts.prefix + "Cancel", "click", closeModal);
    $on(opts.prefix + "Apply", "click", () => { try { localStorage.setItem("luminkLastColor", studio.current); } catch (e) {} closeModal(); if (typeof onApply === "function") onApply(studio.current); });
  }
  function openColorEditor() {
    const sel = window.getSelection();
    colorRange = (sel && sel.rangeCount) ? sel.getRangeAt(0).cloneRange() : null;
    try { const last = localStorage.getItem("luminkLastColor"); if (last) colorCur = last; } catch (e) {}
    openModal(`<h3>글자 색</h3><p class="m-sub">정사각형 색상판을 터치해 색을 고르거나, HEX·RGB로 정확히 맞출 수 있어요.</p>${colorStudioMarkup("ce", { saved:true, save:true })}<div class="m-row"><button class="m-btn" id="ceCancel">취소</button><button class="m-btn primary" id="ceApply">적용</button></div>`);
    const studio = bindColorStudio("ce", colorCur, { saved:true, save:true });
    $on("ceCancel", "click", closeModal);
    $on("ceApply", "click", () => {
      colorCur = studio.current;
      try { localStorage.setItem("luminkLastColor", colorCur); } catch (e) {}
      const ed = $("editor"); ed.focus();
      if (colorRange) { const s = window.getSelection(); s.removeAllRanges(); s.addRange(colorRange); }
      document.execCommand("styleWithCSS", false, true);
      document.execCommand("foreColor", false, colorCur);
      const sw = $("colorSwatch"); if (sw) sw.style.background = colorCur;
      closeModal(); scheduleSave();
    });
  }

  const HILITE_COLORS = [
    { id: "sky", label: "하늘색", value: "#a8e4ff" },
    { id: "pink", label: "핑크색", value: "#ffb6d9" },
    { id: "green", label: "연두색", value: "#c7f4ae" },
    { id: "purple", label: "연보라색", value: "#dec7ff" },
    { id: "yellow", label: "노란색", value: "#ffe27a" }
  ];
  let hiliteColor = "#ffe27a";

  function getHiliteColor() {
    const saved = HILITE_COLORS.find((x) => x.value === hiliteColor);
    return saved ? saved.value : "#ffe27a";
  }
  function setHiliteColor(color) {
    const found = HILITE_COLORS.find((x) => x.value === color);
    if (!found) return;
    hiliteColor = found.value;
    try { localStorage.setItem("luminkHiliteColor", hiliteColor); } catch (e) {}
    const btn = $("hiliteBtn");
    if (btn) {
      btn.style.setProperty("--hilite-color", hiliteColor);
      btn.setAttribute("aria-label", `형광펜 · ${found.label}`);
      btn.title = `형광펜 · ${found.label} (길게 눌러 색상 선택)`;
    }
  }
  function detectHiliteColor() {
    let saved = null;
    try { saved = localStorage.getItem("luminkHiliteColor"); } catch (e) {}
    setHiliteColor(HILITE_COLORS.some((x) => x.value === saved) ? saved : "#ffe27a");
  }
  function captureEditorRange() {
    const sel = window.getSelection();
    const ed = $("editor");
    if (!sel || !sel.rangeCount || !ed) return null;
    const range = sel.getRangeAt(0);
    return ed.contains(range.commonAncestorContainer) ? range.cloneRange() : null;
  }
  function restoreEditorRange(range) {
    const ed = $("editor");
    if (!ed) return false;
    try { ed.focus({ preventScroll: true }); } catch (e) { ed.focus(); }
    if (!range) return false;
    const sel = window.getSelection();
    sel.removeAllRanges(); sel.addRange(range);
    return true;
  }
  function unwrapHighlight(el) {
    const parent = el && el.parentNode;
    if (!parent) return;
    while (el.firstChild) parent.insertBefore(el.firstChild, el);
    parent.removeChild(el); parent.normalize();
  }
  function toggleHilite(color, savedRange, forceColor) {
    const range = savedRange || captureEditorRange();
    if (!range || range.collapsed) { toast("형광펜을 칠할 텍스트를 선택해 주세요"); return; }
    restoreEditorRange(range);
    const sel = window.getSelection();
    const activeRange = sel && sel.rangeCount ? sel.getRangeAt(0) : range;
    let start = activeRange.startContainer;
    let end = activeRange.endContainer;
    if (start.nodeType === 3) start = start.parentElement;
    if (end.nodeType === 3) end = end.parentElement;
    const existing = start && start.closest && start.closest("span.lumi-hl");
    const isSingleExisting = existing && end && existing.contains(end);
    if (isSingleExisting) {
      if (forceColor) {
        existing.style.backgroundColor = color || getHiliteColor();
        existing.style.color = "#222";
      } else {
        unwrapHighlight(existing);
      }
      scheduleSave(); return;
    }
    try {
      const mark = document.createElement("span");
      mark.className = "lumi-hl";
      mark.style.backgroundColor = color || getHiliteColor();
      mark.style.color = "#222";
      mark.style.borderRadius = "3px";
      mark.style.padding = "0 1px";
      activeRange.surroundContents(mark);
      sel.removeAllRanges();
    } catch (e) {
      try {
        document.execCommand("styleWithCSS", false, true);
        document.execCommand("hiliteColor", false, color || getHiliteColor());
      } catch (e2) {}
    }
    scheduleSave();
  }
  function openHilitePicker(savedRange) {
    const current = getHiliteColor();
    openModal(`<h3>형광펜 색상</h3><p class="m-sub">색을 고르면 현재 선택한 텍스트에 바로 적용돼요.</p>
      <div class="hilite-picker">${HILITE_COLORS.map((x) => `<button class="hilite-choice${x.value === current ? " sel" : ""}" data-color="${x.value}" aria-label="${x.label}"><span class="hilite-swatch" style="background:${x.value}"></span><span>${x.label}</span></button>`).join("")}</div>
      <div class="m-row"><button class="m-btn" id="hiliteCancel">취소</button></div>`);
    $("modalBox").querySelectorAll(".hilite-choice").forEach((btn) => btn.addEventListener("click", () => {
      const color = btn.dataset.color;
      setHiliteColor(color);
      closeModal();
      if (savedRange && !savedRange.collapsed) toggleHilite(color, savedRange, true);
      else toast(`${HILITE_COLORS.find((x) => x.value === color).label}으로 바꿨어요`);
    }));
    $on("hiliteCancel", "click", closeModal);
  }
  function bindHiliteButton() {
    const btn = $("hiliteBtn");
    if (!btn) return;
    let holdTimer = null, held = false, savedRange = null, pointerId = null;
    const clear = () => { clearTimeout(holdTimer); holdTimer = null; };
    const reset = () => { clear(); held = false; savedRange = null; pointerId = null; btn.classList.remove("holding"); };
    btn.addEventListener("pointerdown", (e) => {
      if (e.button != null && e.button !== 0) return;
      e.preventDefault();
      savedRange = captureEditorRange();
      pointerId = e.pointerId;
      held = false;
      btn.classList.add("holding");
      try { btn.setPointerCapture(pointerId); } catch (x) {}
      holdTimer = setTimeout(() => {
        holdTimer = null; held = true; btn.classList.remove("holding");
        if (navigator.vibrate) navigator.vibrate(12);
        openHilitePicker(savedRange);
      }, 480);
    });
    btn.addEventListener("pointerup", (e) => {
      if (pointerId != null && e.pointerId !== pointerId) return;
      const wasHeld = held;
      const range = savedRange;
      reset();
      if (!wasHeld) toggleHilite(getHiliteColor(), range, false);
    });
    btn.addEventListener("pointercancel", reset);
    btn.addEventListener("lostpointercapture", () => { if (!held) clear(); });
    btn.addEventListener("contextmenu", (e) => e.preventDefault());
    btn.addEventListener("click", (e) => {
      if (e.detail !== 0) return;
      e.preventDefault();
      toggleHilite(getHiliteColor(), captureEditorRange(), false);
    });
  }
  function fontStep(d) {
    $("editor").focus();
    let s = parseInt(document.queryCommandValue("fontSize"), 10); if (!s || isNaN(s)) s = 3;
    s = Math.min(7, Math.max(1, s + d));
    document.execCommand("fontSize", false, String(s));
    scheduleSave();
  }
  function showFontSizes() {
    $("editor").focus();
    const sel = window.getSelection();
    if (!sel.rangeCount || sel.isCollapsed) { toast("크기를 바꿀 텍스트를 선택해 주세요"); return; }
    const saved = sel.getRangeAt(0).cloneRange();
    const sizes = [["아주 작게", 1, 12], ["작게", 2, 14], ["보통", 3, 16], ["크게", 4, 19], ["더 크게", 5, 23], ["제목", 6, 28], ["대제목", 7, 34]];
    openModal(`<h3>글자 크기</h3><div class="size-list">${sizes.map(([n, v, px]) => `<div class="size-item" data-v="${v}" style="font-size:${px}px">${n}</div>`).join("")}</div><div class="m-row"><button class="m-btn" id="szClose">닫기</button></div>`);
    $("modalBox").querySelectorAll(".size-item").forEach((it) => it.addEventListener("click", () => {
      closeModal(); $("editor").focus();
      const s = window.getSelection(); s.removeAllRanges(); s.addRange(saved);
      document.execCommand("fontSize", false, it.dataset.v);
      scheduleSave();
    }));
    $on("szClose", "click", closeModal);
  }
  /* ---------- free-memo image resize ---------- */
  // 선택 테두리와 조절창은 에디터 HTML 밖의 fixed 레이어에만 둡니다.
  // 따라서 백업·내보내기에는 이미지의 실제 style(width/height)만 남고 보조 UI는 절대 섞이지 않아요.
  const IMAGE_RESIZE_MIN = 1;
  let editorImageResize = { image: null, ratio: 1, aspectLocked: true, raf: 0, drag: null };
  function isActiveEditorImage(img) {
    const tag = img && img.tagName ? img.tagName.toLowerCase() : "";
    return !!(img && (tag === "img" || tag === "video") && img.isConnected && $("editor") && $("editor").contains(img) && !st.codeMode && curView().s === "editor");
  }
  function clearEditorImageSelection() {
    const state = editorImageResize;
    if (state.raf) { cancelAnimationFrame(state.raf); state.raf = 0; }
    if (state.image) state.image.classList.remove("lumi-img-selected");
    state.image = null; state.drag = null;
    const layer = $("imgResizeLayer");
    if (layer) { layer.classList.remove("open"); layer.setAttribute("aria-hidden", "true"); }
  }
  function editorOverlayScale() {
    const raw = parseFloat(document.body && (document.body.style.zoom || getComputedStyle(document.body).zoom));
    return Number.isFinite(raw) && raw > 0 ? raw : 1;
  }
  function editorImageRect(img) {
    const r = img.getBoundingClientRect();
    return { width: Math.max(1, Math.round(r.width)), height: Math.max(1, Math.round(r.height)), left: r.left, top: r.top, right: r.right, bottom: r.bottom };
  }
  function editorImageRatio(img) {
    const r = editorImageRect(img);
    const natural = img.naturalWidth && img.naturalHeight ? img.naturalWidth / img.naturalHeight
      : (img.videoWidth && img.videoHeight ? img.videoWidth / img.videoHeight : 0);
    return Number.isFinite(natural) && natural > 0 ? natural : Math.max(.01, r.width / Math.max(1, r.height));
  }
  function editorImageMaxWidth(img) {
    const ed = $("editor");
    if (!ed) return IMAGE_RESIZE_MIN;
    const zoom = editorOverlayScale(), cs = getComputedStyle(ed), edRect = ed.getBoundingClientRect();
    // body zoom이 켜진 상태에서도 선택 박스·수치 입력·실물 크기가 모두 같은 시각 픽셀을 사용합니다.
    const pad = (parseFloat(cs.paddingLeft || 0) + parseFloat(cs.paddingRight || 0)) * zoom;
    const content = Math.max(IMAGE_RESIZE_MIN, edRect.width - pad);
    const parent = img.parentElement;
    const parentDisplay = parent ? getComputedStyle(parent).display : "block";
    const parentWidth = parent && parentDisplay !== "inline" && parentDisplay !== "contents" ? parent.getBoundingClientRect().width : content;
    return Math.max(IMAGE_RESIZE_MIN, Math.floor(Math.min(content, parentWidth || content)));
  }
  function positivePixels(v, fallback) {
    const n = Math.round(Number(v));
    return Number.isFinite(n) && n >= IMAGE_RESIZE_MIN ? n : fallback;
  }
  function syncEditorImageResizeUI() {
    const state = editorImageResize, img = state.image;
    if (!isActiveEditorImage(img)) { clearEditorImageSelection(); return; }
    const layer = $("imgResizeLayer"), box = $("imgResizeBox"), panel = $("imgResizePanel");
    if (!layer || !box || !panel) return;
    const r = img.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) { clearEditorImageSelection(); return; }
    // fixed 레이어도 body zoom을 상속합니다. 화면 좌표를 CSS 좌표로 역환산해야 large/small 글자 크기에서 밀리지 않습니다.
    const zoom = editorOverlayScale(), rr = { left:r.left / zoom, top:r.top / zoom, width:r.width / zoom, height:r.height / zoom, right:r.right / zoom, bottom:r.bottom / zoom };
    box.style.left = rr.left + "px"; box.style.top = rr.top + "px"; box.style.width = rr.width + "px"; box.style.height = rr.height + "px";
    const widthInput = $("imgResizeW"), heightInput = $("imgResizeH");
    if (document.activeElement !== widthInput) widthInput.value = String(Math.max(1, Math.round(r.width)));
    if (document.activeElement !== heightInput) heightInput.value = String(Math.max(1, Math.round(r.height)));
    const panelWidth = panel.offsetWidth || 326, panelHeight = panel.offsetHeight || 116, gutter = 12;
    const viewportW = window.innerWidth / zoom, viewportH = window.innerHeight / zoom;
    const centered = rr.left + rr.width / 2 - panelWidth / 2;
    const left = Math.max(gutter, Math.min(centered, viewportW - panelWidth - gutter));
    let top = rr.bottom + 14;
    if (top + panelHeight > viewportH - gutter) top = Math.max(gutter, rr.top - panelHeight - 14);
    panel.style.left = Math.round(left) + "px"; panel.style.top = Math.round(top) + "px";
  }
  function queueEditorImageResizeUI() {
    if (!editorImageResize.image || editorImageResize.raf) return;
    editorImageResize.raf = requestAnimationFrame(() => { editorImageResize.raf = 0; syncEditorImageResizeUI(); });
  }
  function selectEditorImage(img) {
    if (!isActiveEditorImage(img)) return;
    if (editorImageResize.image && editorImageResize.image !== img) editorImageResize.image.classList.remove("lumi-img-selected");
    editorImageResize.image = img;
    editorImageResize.ratio = editorImageRatio(img);
    editorImageResize.aspectLocked = true;
    img.classList.add("lumi-img-selected");
    img.draggable = false;
    const lock = $("imgAspectLock"); if (lock) lock.checked = true;
    const layer = $("imgResizeLayer");
    if (layer) { layer.classList.add("open"); layer.setAttribute("aria-hidden", "false"); }
    if (img.tagName && img.tagName.toLowerCase() === "video") {
      img.addEventListener("loadedmetadata", queueEditorImageResizeUI, { once: true });
      img.addEventListener("loadeddata", queueEditorImageResizeUI, { once: true });
    } else img.addEventListener("load", queueEditorImageResizeUI, { once: true });
    queueEditorImageResizeUI();
    requestAnimationFrame(() => requestAnimationFrame(queueEditorImageResizeUI));
  }
  function setEditorImageDimensions(width, height, source, persist) {
    const state = editorImageResize, img = state.image;
    if (!isActiveEditorImage(img)) return;
    const current = editorImageRect(img), ratio = Math.max(.01, state.ratio || current.width / Math.max(1, current.height));
    let w = positivePixels(width, current.width), h = positivePixels(height, current.height);
    if (state.aspectLocked) {
      if (source === "height") w = Math.round(h * ratio);
      w = Math.max(IMAGE_RESIZE_MIN, Math.min(editorImageMaxWidth(img), w));
      h = Math.max(1, Math.round(w / ratio));
      img.style.width = (w / editorOverlayScale()) + "px";
      img.style.height = "auto";
    } else {
      w = Math.max(IMAGE_RESIZE_MIN, Math.min(editorImageMaxWidth(img), w));
      h = Math.max(IMAGE_RESIZE_MIN, h);
      const zoom = editorOverlayScale();
      img.style.width = (w / zoom) + "px";
      img.style.height = (h / zoom) + "px";
      state.ratio = w / h;
    }
    if (!img.style.maxWidth) img.style.maxWidth = "100%";
    queueEditorImageResizeUI();
    if (persist) scheduleSave();
  }
  function applyImageResizeFromInput(source) {
    const img = editorImageResize.image;
    if (!isActiveEditorImage(img)) return;
    const current = editorImageRect(img);
    const w = positivePixels($("imgResizeW").value, current.width);
    const h = positivePixels($("imgResizeH").value, current.height);
    setEditorImageDimensions(w, h, source, true);
  }
  function resetEditorImageSize() {
    const img = editorImageResize.image;
    if (!isActiveEditorImage(img)) return;
    img.style.removeProperty("width");
    img.style.removeProperty("height");
    editorImageResize.ratio = editorImageRatio(img);
    queueEditorImageResizeUI();
    scheduleSave();
    toast((img.tagName && img.tagName.toLowerCase() === "video") ? "동영상을 자동 크기로 되돌렸어요" : "사진을 자동 크기로 되돌렸어요");
  }
  function beginEditorImageResize(event, handle) {
    const img = editorImageResize.image;
    if (!isActiveEditorImage(img)) return;
    if (event.button != null && event.button !== 0) return;
    event.preventDefault(); event.stopPropagation();
    const r = editorImageRect(img);
    editorImageResize.drag = { handle, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, startW: r.width, startH: r.height, ratio: Math.max(.01, r.width / Math.max(1, r.height)) };
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch (e) {}
  }
  function moveEditorImageResize(event) {
    const drag = editorImageResize.drag;
    if (!drag || (drag.pointerId != null && event.pointerId !== drag.pointerId)) return;
    const dx = event.clientX - drag.startX, dy = event.clientY - drag.startY;
    const east = drag.handle.indexOf("e") !== -1, south = drag.handle.indexOf("s") !== -1;
    let w, h;
    if (editorImageResize.aspectLocked) {
      const byX = east ? dx : -dx;
      const byY = (south ? dy : -dy) * drag.ratio;
      const delta = Math.abs(byX) >= Math.abs(byY) ? byX : byY;
      w = drag.startW + delta; h = Math.round(w / drag.ratio);
      setEditorImageDimensions(w, h, "width", false);
    } else {
      w = drag.startW + (east ? dx : -dx);
      h = drag.startH + (south ? dy : -dy);
      setEditorImageDimensions(w, h, "both", false);
    }
  }
  function endEditorImageResize(event) {
    const drag = editorImageResize.drag;
    if (!drag || (event && drag.pointerId != null && event.pointerId !== drag.pointerId)) return;
    editorImageResize.drag = null;
    if (isActiveEditorImage(editorImageResize.image)) scheduleSave();
  }
  function bindEditorImageResize() {
    const editor = $("editor"), wrap = $("editorWrap"), layer = $("imgResizeLayer");
    if (!editor || !wrap || !layer) return;
    // video 기본 컨트롤은 click을 소비할 수 있어 캡처 단계에서 먼저 선택합니다.
    editor.addEventListener("pointerdown", (event) => {
      const media = event.target && event.target.closest ? event.target.closest("img,video") : null;
      if (media && editor.contains(media)) requestAnimationFrame(() => selectEditorImage(media));
    }, true);
    editor.addEventListener("click", (event) => {
      const img = event.target && event.target.closest ? event.target.closest("img,video") : null;
      if (img && editor.contains(img)) { selectEditorImage(img); return; }
      clearEditorImageSelection();
    });
    editor.addEventListener("dragstart", (event) => { if (event.target && event.target.closest && event.target.closest("img,video")) event.preventDefault(); });
    wrap.addEventListener("scroll", queueEditorImageResizeUI, { passive: true });
    window.addEventListener("resize", queueEditorImageResizeUI, { passive: true });
    document.addEventListener("pointerdown", (event) => {
      const img = editorImageResize.image;
      if (!img || event.target === img || (event.target && event.target.closest && (event.target.closest("#imgResizeLayer") || event.target.closest("#editor")))) return;
      clearEditorImageSelection();
    }, true);
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && editorImageResize.image) { event.preventDefault(); clearEditorImageSelection(); }
    });
    layer.querySelectorAll(".img-resize-handle").forEach((handle) => {
      handle.addEventListener("pointerdown", (event) => beginEditorImageResize(event, handle.dataset.handle));
      handle.addEventListener("pointermove", moveEditorImageResize);
      handle.addEventListener("pointerup", endEditorImageResize);
      handle.addEventListener("pointercancel", endEditorImageResize);
    });
    $on("imgResizeClose", "click", clearEditorImageSelection);
    $on("imgResizeDone", "click", clearEditorImageSelection);
    $on("imgResizeReset", "click", resetEditorImageSize);
    $on("imgAspectLock", "change", (event) => {
      editorImageResize.aspectLocked = !!event.target.checked;
      if (editorImageResize.aspectLocked && isActiveEditorImage(editorImageResize.image)) editorImageResize.ratio = editorImageRatio(editorImageResize.image);
    });
    ["imgResizeW", "imgResizeH"].forEach((id) => {
      const input = $(id); if (!input) return;
      input.addEventListener("change", () => applyImageResizeFromInput(id === "imgResizeH" ? "height" : "width"));
      input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") { event.preventDefault(); applyImageResizeFromInput(id === "imgResizeH" ? "height" : "width"); input.blur(); }
      });
    });
  }

  const FREE_MEMO_VIDEO_MAX = 30 * 1024 * 1024;
  function freeMemoMediaPicker() {
    openModal(`<h3>미디어 삽입</h3><p class="m-sub">사진 또는 동영상을 기기의 파일 선택기로 불러옵니다. 동영상은 아이디어 보드와 같은 30MB 제한을 적용합니다.</p><div class="idea-add-menu free-media-menu"><button type="button" class="idea-add-choice" id="freeMediaPhoto"><span class="iac-ico">▧</span><span><b>사진</b><small>이미지 파일을 본문에 삽입</small></span></button><button type="button" class="idea-add-choice" id="freeMediaVideo"><span class="iac-ico">▶</span><span><b>동영상</b><small>30MB 이하 · 본문 안에서 크기 조절</small></span></button></div><div class="m-row"><button class="m-btn" id="freeMediaCancel">취소</button></div>`);
    $on("freeMediaPhoto", "click", () => { closeModal(); $("imgInput").click(); });
    $on("freeMediaVideo", "click", () => { closeModal(); $("freeVideoInput").click(); });
    $on("freeMediaCancel", "click", closeModal);
  }
  function fileToDataUrl(file) {
    return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result || "")); reader.onerror = () => reject(reader.error || new Error("file read error")); reader.readAsDataURL(file); });
  }
  async function insertImage(file) {
    if (!/^image\//.test(file.type)) { toast("사진 파일만 넣을 수 있어요"); return; }
    try {
      const data = await fileToResized(file, 1280);
      $("editor").focus();
      document.execCommand("insertHTML", false, `<img src="${data}" style="max-width:100%;height:auto;border-radius:10px"><br>`);
      scheduleSave();
      requestAnimationFrame(() => {
        const images = [...$("editor").querySelectorAll("img")];
        const inserted = images.length ? images[images.length - 1] : null;
        if (inserted) selectEditorImage(inserted);
      });
    } catch (e) { toast((e && e.message) || "사진을 넣지 못했어요"); }
  }
  async function insertFreeMemoVideo(file) {
    if (!file || !/^video\//i.test(file.type || "")) { toast("동영상 파일만 넣을 수 있어요"); return; }
    if (file.size > FREE_MEMO_VIDEO_MAX) { toast("동영상은 30MB 이하만 넣을 수 있어요"); return; }
    try {
      const data = await fileToDataUrl(file);
      if (!/^data:video\/(?:mp4|webm|ogg|quicktime);base64,/i.test(data)) throw new Error("지원하지 않는 동영상 형식이에요");
      const editor = $("editor"); editor.focus();
      // 메타데이터가 도착하기 전 브라우저 기본 원본 폭으로 튀는 일을 막기 위해
      // 처음부터 본문 폭에 맞는 안정적인 시작 폭을 부여합니다.
      document.execCommand("insertHTML", false, `<video controls playsinline preload="metadata" src="${data}" style="width:420px;max-width:100%;height:auto;border-radius:14px;background:transparent;box-shadow:0 10px 24px rgba(43,76,126,.16)"></video><br>`);
      scheduleSave();
      requestAnimationFrame(() => {
        const videos = [...editor.querySelectorAll("video")];
        const inserted = videos.length ? videos[videos.length - 1] : null;
        if (!inserted) return;
        const fitInitialSize = () => {
          const max = editorImageMaxWidth(inserted);
          const target = Math.max(220, Math.min(460, Math.round(max * .78)));
          inserted.style.width = Math.min(max, target) + "px";
          inserted.style.maxWidth = "100%";
          inserted.style.height = "auto";
          selectEditorImage(inserted);
          queueEditorImageResizeUI();
        };
        // loadedmetadata 전후 어느 순서에서도 한 번만 올바른 치수로 맞춥니다.
        if (inserted.readyState >= 1 && inserted.videoWidth > 0) fitInitialSize();
        else {
          inserted.addEventListener("loadedmetadata", fitInitialSize, { once:true });
          inserted.addEventListener("loadeddata", queueEditorImageResizeUI, { once:true });
          // 네트워크/코덱 지연에도 조절창을 잃지 않도록 임시 박스 기준으로 먼저 선택합니다.
          selectEditorImage(inserted);
        }
      });
    } catch (e) { toast((e && e.message) || "동영상을 넣지 못했어요"); }
  }
  function wrapCodeBlock() {
    $("editor").focus();
    try { document.execCommand("formatBlock", false, "pre"); } catch (e) {}
    scheduleSave();
  }
  function eraseFormatting() {
    const ed = $("editor"); ed.focus();
    const sel = window.getSelection();
    let range = sel.rangeCount ? sel.getRangeAt(0) : null;
    if (range && !range.collapsed) {
      [...ed.querySelectorAll("pre, code")].forEach((el) => { if (range.intersectsNode(el)) el.replaceWith(document.createTextNode(el.textContent)); });
    }
    try { document.execCommand("styleWithCSS", false, true); } catch (e) {}
    document.execCommand("removeFormat", false, null);
    document.execCommand("unlink", false, null);
    scheduleSave();
  }
  function showAlignMenu() {
    $("editor").focus();
    const sel = window.getSelection();
    const saved = sel.rangeCount ? sel.getRangeAt(0).cloneRange() : null;
    const items = [
      ["justifyLeft", "왼쪽 정렬", "M4 6h16M4 12h10M4 18h13"],
      ["justifyCenter", "가운데 정렬", "M4 6h16M7 12h10M5 18h14"],
      ["justifyRight", "오른쪽 정렬", "M4 6h16M10 12h10M7 18h13"]
    ];
    openModal(`<h3>정렬</h3><div class="size-list">${items.map(([c, n, d]) => `<div class="size-item al-item" data-c="${c}"><svg viewBox="0 0 24 24" style="width:20px;height:20px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;vertical-align:-4px;margin-right:10px"><path d="${d}"/></svg>${n}</div>`).join("")}</div><div class="m-row"><button class="m-btn" id="alClose">닫기</button></div>`);
    $("modalBox").querySelectorAll(".al-item").forEach((it) => it.addEventListener("click", () => {
      closeModal(); $("editor").focus();
      if (saved) { const s = window.getSelection(); s.removeAllRanges(); s.addRange(saved); }
      document.execCommand(it.dataset.c, false, null); scheduleSave();
    }));
    $on("alClose", "click", closeModal);
  }

  /* ---------- lorebook ---------- */
  // lightweight markdown -> html
  function mdToHtml(md) {
    const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const inline = (s) => {
      s = esc(s);
      s = s.replace(/`([^`]+)`/g, (m, c) => `<code>${c}</code>`);
      s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
      s = s.replace(/(^|[^*])\*([^*\s][^*]*)\*/g, "$1<em>$2</em>");
      s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
      s = s.replace(/(^|\s)(@@[A-Za-z0-9_가-힣./:-]+)/g, "$1<span class=\"md-command\">$2</span>");
      return s;
    };
    const lines = (md || "").replace(/\r\n/g, "\n").split("\n");
    const out = []; let inUl = false, inOl = false, inCode = false, code = []; const tagStack = [];
    const closeLists = () => { if (inUl) { out.push("</ul>"); inUl = false; } if (inOl) { out.push("</ol>"); inOl = false; } };
    for (const raw of lines) {
      if (/^```/.test(raw)) { if (inCode) { out.push("<pre><code>" + esc(code.join("\n")) + "</code></pre>"); code = []; inCode = false; } else { closeLists(); inCode = true; } continue; }
      if (inCode) { code.push(raw); continue; }
      const tline = raw.trim();
      let bm;
      if ((bm = tline.match(/^<([^/<>][^<>]*)>$/))) { closeLists(); const nm = bm[1].trim(); tagStack.push(nm); out.push(`<div class="md-tag"><div class="md-tag-open">&lt;${esc(nm)}&gt;</div><div class="md-tag-body">`); continue; }
      if ((bm = tline.match(/^<\/([^<>]*)>$/))) { closeLists(); if (tagStack.length) { const nm = tagStack.pop(); out.push(`</div><div class="md-tag-close">&lt;/${esc(nm)}&gt;</div></div>`); } continue; }
      if (/^\s*$/.test(raw)) { closeLists(); continue; }
      let m;
      if ((m = raw.match(/^\s*(@@[A-Za-z0-9_가-힣./:-]+)(?:\s+(.+))?\s*$/))) { closeLists(); out.push(`<div class="md-command-line"><span class="md-command">${esc(m[1])}</span>${m[2] ? `<span class="md-command-text">${inline(m[2])}</span>` : ""}</div>`); continue; }
      if ((m = raw.match(/^(#{1,3})\s*(.+?)\s*$/))) { closeLists(); out.push(`<h${m[1].length}>${inline(m[2])}</h${m[1].length}>`); continue; }
      if ((m = raw.match(/^\s*-\s*([^:：]+)[:：]\s*(.*)$/))) { closeLists(); out.push(`<div class="md-mini"><span class="md-mini-key">${inline(m[1].trim())}</span>${inline(m[2])}</div>`); continue; }
      if (/^\s*>\s?/.test(raw)) { closeLists(); out.push(`<blockquote>${inline(raw.replace(/^\s*>\s?/, ""))}</blockquote>`); continue; }
      if (/^\s*(---|\*\*\*|___)\s*$/.test(raw)) { closeLists(); out.push("<hr>"); continue; }
      if (/^\s*([-*+])\s*(.+)$/.test(raw)) { if (!inUl) { closeLists(); out.push("<ul>"); inUl = true; } out.push(`<li>${inline(raw.replace(/^\s*[-*+]\s*/, ""))}</li>`); continue; }
      if (/^\s*\d+\.\s+/.test(raw)) { if (!inOl) { closeLists(); out.push("<ol>"); inOl = true; } out.push(`<li>${inline(raw.replace(/^\s*\d+\.\s+/, ""))}</li>`); continue; }
      closeLists(); out.push(`<p>${inline(raw)}</p>`);
    }
    if (inCode) out.push("<pre><code>" + esc(code.join("\n")) + "</code></pre>");
    closeLists(); while (tagStack.length) { const nm = tagStack.pop(); out.push(`</div><div class="md-tag-close">&lt;/${esc(nm)}&gt;</div></div>`); }
    return out.join("\n");
  }

  // tokenizer (lazy)
  let tokReady = null;
  function ensureTokenizer() {
    if (window.__luminkCountTokens) return Promise.resolve(true);
    if (tokReady) return tokReady;
    tokReady = new Promise((res) => { const s = document.createElement("script"); s.src = "./tokenizer.js"; s.async = true; s.onload = () => res(true); s.onerror = () => res(false); document.head.appendChild(s); });
    return tokReady;
  }

  const LORE_ST_TRIGGERS = Object.freeze([
    ["normal", "평범함"], ["continue", "계속 생성"], ["impersonate", "사칭"], ["swipe", "Swipe"], ["regenerate", "재생성"], ["quiet", "Quiet"]
  ]);
  const LORE_ST_FIELDS = Object.freeze([
    "keysecondary", "constant", "vectorized", "selective", "selectiveLogic", "addMemo", "order", "position", "disable",
    "ignoreBudget", "excludeRecursion", "preventRecursion", "matchPersonaDescription", "matchCharacterDescription",
    "matchCharacterPersonality", "matchCharacterDepthPrompt", "matchScenario", "matchCreatorNotes", "delayUntilRecursion",
    "probability", "useProbability", "depth", "outletName", "group", "groupOverride", "groupWeight", "scanDepth",
    "caseSensitive", "matchWholeWords", "useGroupScoring", "automationId", "role", "sticky", "cooldown", "delay",
    "triggers", "displayIndex", "characterFilter"
  ]);
  const LORE_ST_FIELD_SET = new Set(LORE_ST_FIELDS.concat(["uid", "key", "keys", "comment", "content", "extra"]));
  const LORE_ST_DEFAULTS = Object.freeze({
    keysecondary: [], constant: false, vectorized: false, selective: true, selectiveLogic: 0, addMemo: true,
    order: 100, position: 0, disable: false, ignoreBudget: false, excludeRecursion: false, preventRecursion: false,
    matchPersonaDescription: false, matchCharacterDescription: false, matchCharacterPersonality: false,
    matchCharacterDepthPrompt: false, matchScenario: false, matchCreatorNotes: false, delayUntilRecursion: false,
    probability: 100, useProbability: true, depth: 4, outletName: "", group: "", groupOverride: false, groupWeight: 100,
    scanDepth: null, caseSensitive: null, matchWholeWords: null, useGroupScoring: null, automationId: "", role: null,
    sticky: 0, cooldown: 0, delay: 0, triggers: [], displayIndex: null,
    characterFilter: { isExclude: false, names: [], tags: [] }
  });
  function loreNum(value, fallback, min, max) {
    const n = Number(value);
    const v = Number.isFinite(n) ? Math.round(n) : fallback;
    return Math.min(max, Math.max(min, v));
  }
  function loreNullableNum(value, min, max) {
    if (value == null || value === "") return null;
    const n = Number(value);
    return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : null;
  }
  function loreBoolOrNull(value) {
    return value === true ? true : value === false ? false : null;
  }
  function loreStringList(value, limit, itemLimit) {
    const list = Array.isArray(value) ? value : String(value || "").split(/[,\n]+/);
    return [...new Set(list.map((item) => cleanImportedText(String(item || ""), itemLimit || 180).trim()).filter(Boolean))].slice(0, limit || 300);
  }
  function normalizeLoreCharacterFilter(value) {
    const src = value && typeof value === "object" ? value : {};
    return {
      isExclude: !!src.isExclude,
      names: loreStringList(src.names, 200, 180),
      tags: loreStringList(src.tags, 200, 180)
    };
  }
  function normalizeLoreSt(raw) {
    const src = raw && typeof raw === "object" ? raw : {};
    const out = {
      keysecondary: loreStringList(src.keysecondary || src.secondaryKeywords, 300, 180),
      constant: !!src.constant,
      vectorized: !!src.vectorized,
      selective: src.selective !== false,
      selectiveLogic: loreNum(src.selectiveLogic, 0, 0, 3),
      addMemo: src.addMemo !== false,
      order: loreNum(src.order, 100, -999999, 999999),
      position: loreNum(src.position, 0, 0, 6),
      disable: !!src.disable,
      ignoreBudget: !!src.ignoreBudget,
      excludeRecursion: !!src.excludeRecursion,
      preventRecursion: !!src.preventRecursion,
      matchPersonaDescription: !!src.matchPersonaDescription,
      matchCharacterDescription: !!src.matchCharacterDescription,
      matchCharacterPersonality: !!src.matchCharacterPersonality,
      matchCharacterDepthPrompt: !!src.matchCharacterDepthPrompt,
      matchScenario: !!src.matchScenario,
      matchCreatorNotes: !!src.matchCreatorNotes,
      delayUntilRecursion: !!src.delayUntilRecursion,
      probability: loreNum(src.probability, 100, 0, 100),
      useProbability: src.useProbability !== false,
      depth: loreNum(src.depth, 4, 0, 999),
      outletName: cleanImportedText(src.outletName, 120),
      group: cleanImportedText(src.group, 180),
      groupOverride: !!src.groupOverride,
      groupWeight: loreNum(src.groupWeight, 100, 1, 999999),
      scanDepth: loreNullableNum(src.scanDepth, 0, 999),
      caseSensitive: loreBoolOrNull(src.caseSensitive),
      matchWholeWords: loreBoolOrNull(src.matchWholeWords),
      useGroupScoring: loreBoolOrNull(src.useGroupScoring),
      automationId: cleanImportedText(src.automationId, 120),
      role: loreNullableNum(src.role, 0, 999),
      sticky: loreNum(src.sticky, 0, 0, 999999),
      cooldown: loreNum(src.cooldown, 0, 0, 999999),
      delay: loreNum(src.delay, 0, 0, 999999),
      triggers: loreStringList(src.triggers, 20, 80).filter((value) => LORE_ST_TRIGGERS.some(([key]) => key === value)),
      displayIndex: loreNullableNum(src.displayIndex, 0, 999999),
      characterFilter: normalizeLoreCharacterFilter(src.characterFilter)
    };
    const extra = (src.extra && typeof src.extra === "object") ? (jsonCopy(src.extra) || {}) : {};
    Object.keys(src).forEach((key) => {
      if (!LORE_ST_FIELD_SET.has(key)) extra[key] = jsonCopy(src[key]) ?? src[key];
    });
    if (Object.keys(extra).length) out.extra = extra;
    return out;
  }
  function normalizeLoreData(raw) {
    const src = raw && typeof raw === "object" ? raw : {};
    const hasSt = src.st && typeof src.st === "object";
    const stData = normalizeLoreSt(hasSt ? src.st : src);
    if (!hasSt) {
      if ("alwaysActive" in src) stData.constant = !!src.alwaysActive;
      if ("depthOn" in src && src.depthOn) stData.position = 4;
      if (src.depth != null) stData.depth = loreNum(src.depth, 4, 0, 999);
    }
    const d = {
      content: cleanImportedText(src.content, 500000),
      keywords: loreStringList(src.keywords || src.key || src.keys, 300, 180),
      secondaryKeywords: stData.keysecondary.slice(),
      alwaysActive: !!stData.constant,
      depthOn: stData.position === 4,
      depth: stData.depth,
      st: stData
    };
    return d;
  }
  function makeLoreData(overrides) {
    return normalizeLoreData(Object.assign({ content: "", keywords: [], st: LORE_ST_DEFAULTS }, overrides || {}));
  }
  function ensureLoreData(n) {
    if (!n) return makeLoreData();
    n.data = normalizeLoreData(n.data);
    return n.data;
  }
  function applyLoreStToLegacy(d) {
    d.st = normalizeLoreSt(d.st);
    d.secondaryKeywords = d.st.keysecondary.slice();
    d.alwaysActive = !!d.st.constant;
    d.depthOn = d.st.position === 4;
    d.depth = d.st.depth;
    return d;
  }

  let loreTimer = null;
  function setLoreSaver(mode) {
    const s = $("loreSaver"); s.className = "saver " + mode;
    $("loreSaverText").textContent = mode === "dirty" ? "기록 중" : mode === "saved" ? "저장됨" : "";
    if (mode === "saved") setTimeout(() => { if (s.classList.contains("saved")) { s.className = "saver"; $("loreSaverText").textContent = ""; } }, 1500);
  }
  function renderLore() {
    const n = getNote(st.curNoteId);
    if (!n || n.type !== "lorebook") { back(); return; }
    const d = ensureLoreData(n);
    $("loreTitle").textContent = n.title || "로어북";
    if ($("loreEdit").value !== (d.content || "")) $("loreEdit").value = d.content || "";
    if ($("loreDepth")) $("loreDepth").value = d.depth;
    if ($("loreDepthSwitch")) $("loreDepthSwitch").classList.toggle("on", !!d.depthOn);
    if ($("loreDepthWrap")) $("loreDepthWrap").classList.toggle("on", !!d.depthOn);
    renderKeywords(n);
    $("loreActive").classList.toggle("on", !!d.alwaysActive);
    $("lorePreview").innerHTML = mdToHtml(d.content || "");
    document.body.classList.toggle("lore-preview-on", !!(d.content && d.content.trim()));
    setLoreSaver("");
    updateLoreTokens(n);
    queueDraftRecovery(n, "lorebook");
  }
  function renderKeywords(n) {
    renderLoreKeywordList(n, "keywords", "loreKeywords", "loreKwInput");
    renderLoreKeywordList(n, "secondaryKeywords", "loreSecondaryKeywords", "loreSecondaryKwInput");
  }
  function renderLoreKeywordList(n, key, wrapId, inputId) {
    const wrap = $(wrapId), input = $(inputId);
    if (!wrap || !input) return;
    const d = ensureLoreData(n);
    wrap.querySelectorAll(".kw-chip").forEach((c) => c.remove());
    const kws = d[key] || [];
    kws.forEach((kw, idx) => {
      const chip = document.createElement("span"); chip.className = "kw-chip";
      chip.innerHTML = `<span>${esc(kw)}</span><button aria-label="삭제">×</button>`;
      chip.querySelector("button").addEventListener("click", () => {
        d[key].splice(idx, 1);
        if (key === "secondaryKeywords") d.st.keysecondary = d.secondaryKeywords.slice();
        saveLore(n, true);
        renderKeywords(n);
      });
      wrap.insertBefore(chip, input);
    });
  }
  async function saveLore(n, silent) {
    n.updatedAt = now(); await put("notes", n);
    const p = getProject(n.projectId); if (p) await saveProject(p);
    if (!silent) setLoreSaver("saved");
    triggerAutoBackup();
  }
  function scheduleLoreSave() {
    const n = getNote(st.curNoteId); if (n && n.type === "lorebook") writeDraft(n, "lorebook", loreDraftFromEditor(n));
    setLoreSaver("dirty"); clearTimeout(loreTimer); const id = st.curNoteId; loreTimer = setTimeout(() => { if (st.curNoteId === id) flushLore(); }, 550);
  }
  async function flushLore() {
    clearTimeout(loreTimer); loreTimer = null;
    const n = getNote(st.curNoteId); if (!n || n.type !== "lorebook") return;
    const c = $("loreEdit").value, draft = loreDraftFromEditor(n);
    if (c === (n.data.content || "")) { clearDraftIfSynced(n, "lorebook", draft); return; }
    n.data.content = c; await saveLore(n);
    clearDraftIfSynced(n, "lorebook", draft);
    $("lorePreview").innerHTML = mdToHtml(c);
    updateLoreTokens(n);
  }
  function updateLoreTokens(n) {
    const content = (ensureLoreData(n).content) || "";
    $("loreTokens").textContent = "토큰 계산 중…";
    ensureTokenizer().then((ok) => {
      if (getNote(st.curNoteId) !== n) return;
      if (ok && window.__luminkCountTokens) {
        const t = window.__luminkCountTokens(content);
        $("loreTokens").innerHTML = (t == null) ? "— 토큰" : `<b>${t}</b> 토큰`;
      } else $("loreTokens").textContent = "토큰 계산 불가";
    });
  }
  function addLoreKeywordFromInput(key, inputId) {
    const input = $(inputId), raw = input && input.value.trim();
    if (!raw) return;
    const n = getNote(st.curNoteId); if (!n) return;
    const d = ensureLoreData(n);
    d[key] = d[key] || [];
    raw.split(/[,\n]+/).map((s) => s.trim()).filter(Boolean).forEach((k) => { if (!d[key].includes(k)) d[key].push(k); });
    if (key === "secondaryKeywords") d.st.keysecondary = d.secondaryKeywords.slice();
    input.value = ""; saveLore(n, true); renderKeywords(n);
  }
  function addKeywordFromInput() {
    addLoreKeywordFromInput("keywords", "loreKwInput");
  }
  function addSecondaryKeywordFromInput() {
    addLoreKeywordFromInput("secondaryKeywords", "loreSecondaryKwInput");
  }
  function toggleLoreActive() {
    const n = getNote(st.curNoteId); if (!n) return;
    const d = ensureLoreData(n);
    d.st.constant = !d.st.constant;
    applyLoreStToLegacy(d);
    $("loreActive").classList.toggle("on", d.alwaysActive);
    saveLore(n, true);
  }
  function toggleLorePreview() {
    flushLore();
    const on = !document.body.classList.contains("lore-preview-on");
    if (on) $("lorePreview").innerHTML = mdToHtml($("loreEdit").value);
    document.body.classList.toggle("lore-preview-on", on);
  }
  function lorePositionValue(stv) {
    return `${stv.position}:${stv.role == null ? "" : stv.role}`;
  }
  function loreSwitchHtml(id, label, checked, hint) {
    return `<label class="lore-st-check"><input type="checkbox" id="${id}" ${checked ? "checked" : ""}><span><b>${esc(label)}</b>${hint ? `<small>${esc(hint)}</small>` : ""}</span></label>`;
  }
  function loreFieldHtml(label, html, hint) {
    return `<label class="lore-st-field"><span>${esc(label)}</span>${html}${hint ? `<small>${esc(hint)}</small>` : ""}</label>`;
  }
  function loreTriSelect(id, value) {
    const v = value === true ? "true" : value === false ? "false" : "";
    return `<select id="${id}"><option value="" ${v === "" ? "selected" : ""}>앱 기본값</option><option value="true" ${v === "true" ? "selected" : ""}>켜기</option><option value="false" ${v === "false" ? "selected" : ""}>끄기</option></select>`;
  }
  function loreTriFromSelect(id) {
    const v = $(id).value;
    return v === "true" ? true : v === "false" ? false : null;
  }
  function loreInputListValue(id) {
    const el = $(id);
    return loreStringList(el ? el.value : "", 200, 180);
  }
  function openLoreSettingsModal() {
    const n = getNote(st.curNoteId); if (!n || n.type !== "lorebook") return;
    const d = ensureLoreData(n), stv = d.st;
    const triggerChoices = LORE_ST_TRIGGERS.map(([key, label]) => loreSwitchHtml(`loreStTrigger_${key}`, label, stv.triggers.includes(key), key)).join("");
    const positionValue = lorePositionValue(stv);
    openModal(`<div class="lore-st-modal"><h3>SillyTavern 설정</h3><p class="m-sub">${esc(n.title || "로어북")} · World Info로 내보낼 세부 필드를 편집합니다.</p>
      <section class="lore-st-section"><h4>기본</h4><div class="lore-st-grid">
        ${loreSwitchHtml("loreStDisable", "비활성화", stv.disable, "disable")}
        ${loreSwitchHtml("loreStConstant", "상시 활성화", stv.constant, "constant")}
        ${loreSwitchHtml("loreStVectorized", "벡터화됨", stv.vectorized, "vectorized")}
        ${loreSwitchHtml("loreStSelective", "선택 필터 사용", stv.selective, "selective")}
        ${loreSwitchHtml("loreStAddMemo", "제목/메모 추가", stv.addMemo, "addMemo")}
        ${loreFieldHtml("선택 필터 모드", `<select id="loreStSelectiveLogic"><option value="0" ${stv.selectiveLogic === 0 ? "selected" : ""}>0 · 기본</option><option value="1" ${stv.selectiveLogic === 1 ? "selected" : ""}>1</option><option value="2" ${stv.selectiveLogic === 2 ? "selected" : ""}>2</option><option value="3" ${stv.selectiveLogic === 3 ? "selected" : ""}>3</option></select>`, "selectiveLogic")}
        ${loreFieldHtml("순서", `<input id="loreStOrder" type="number" value="${stv.order}" inputmode="numeric">`, "order")}
        ${loreFieldHtml("위치", `<select id="loreStPositionRole"><option value="0:" ${positionValue === "0:" ? "selected" : ""}>캐릭터 정의 전</option><option value="1:" ${positionValue === "1:" ? "selected" : ""}>캐릭터 정의 후</option><option value="5:" ${positionValue === "5:" ? "selected" : ""}>↑EM</option><option value="6:" ${positionValue === "6:" ? "selected" : ""}>↓EM</option><option value="2:" ${positionValue === "2:" ? "selected" : ""}>작가 노트 전</option><option value="3:" ${positionValue === "3:" ? "selected" : ""}>작가 노트 후</option><option value="4:" ${positionValue === "4:" ? "selected" : ""}>@D · 기본</option><option value="4:0" ${positionValue === "4:0" ? "selected" : ""}>@D · 시스템</option><option value="4:1" ${positionValue === "4:1" ? "selected" : ""}>@D · 유저</option></select>`, "position / role")}
        ${loreFieldHtml("깊이", `<input id="loreStDepth" type="number" min="0" max="999" value="${stv.depth}" inputmode="numeric">`, "depth")}
      </div></section>
      <section class="lore-st-section"><h4>발동 조건</h4><div class="lore-st-grid">
        ${loreSwitchHtml("loreStUseProbability", "확률 사용", stv.useProbability, "useProbability")}
        ${loreFieldHtml("확률", `<input id="loreStProbability" type="number" min="0" max="100" value="${stv.probability}" inputmode="numeric">`, "probability")}
        ${loreFieldHtml("스캔 깊이", `<input id="loreStScanDepth" type="number" min="0" max="999" value="${stv.scanDepth == null ? "" : stv.scanDepth}" placeholder="기본값" inputmode="numeric">`, "scanDepth")}
        ${loreFieldHtml("대소문자", loreTriSelect("loreStCaseSensitive", stv.caseSensitive), "caseSensitive")}
        ${loreFieldHtml("단어 전체 일치", loreTriSelect("loreStMatchWholeWords", stv.matchWholeWords), "matchWholeWords")}
      </div><div class="lore-st-trigger-grid">${triggerChoices}</div></section>
      <section class="lore-st-section"><h4>재귀·예산</h4><div class="lore-st-grid">
        ${loreSwitchHtml("loreStIgnoreBudget", "예산 무시", stv.ignoreBudget, "ignoreBudget")}
        ${loreSwitchHtml("loreStExcludeRecursion", "재귀에서 제외", stv.excludeRecursion, "excludeRecursion")}
        ${loreSwitchHtml("loreStPreventRecursion", "재귀 방지", stv.preventRecursion, "preventRecursion")}
        ${loreSwitchHtml("loreStDelayUntilRecursion", "재귀까지 지연", stv.delayUntilRecursion, "delayUntilRecursion")}
        ${loreFieldHtml("Sticky", `<input id="loreStSticky" type="number" min="0" value="${stv.sticky}" inputmode="numeric">`, "sticky")}
        ${loreFieldHtml("Cooldown", `<input id="loreStCooldown" type="number" min="0" value="${stv.cooldown}" inputmode="numeric">`, "cooldown")}
        ${loreFieldHtml("Delay", `<input id="loreStDelay" type="number" min="0" value="${stv.delay}" inputmode="numeric">`, "delay")}
      </div></section>
      <section class="lore-st-section"><h4>매칭 소스</h4><div class="lore-st-grid">
        ${loreSwitchHtml("loreStMatchPersonaDescription", "페르소나 설명", stv.matchPersonaDescription)}
        ${loreSwitchHtml("loreStMatchCharacterDescription", "캐릭터 설명", stv.matchCharacterDescription)}
        ${loreSwitchHtml("loreStMatchCharacterPersonality", "캐릭터 성격", stv.matchCharacterPersonality)}
        ${loreSwitchHtml("loreStMatchCharacterDepthPrompt", "캐릭터 노트", stv.matchCharacterDepthPrompt)}
        ${loreSwitchHtml("loreStMatchScenario", "시나리오", stv.matchScenario)}
        ${loreSwitchHtml("loreStMatchCreatorNotes", "제작자 메모", stv.matchCreatorNotes)}
      </div></section>
      <section class="lore-st-section"><h4>그룹·고급</h4><div class="lore-st-grid">
        ${loreFieldHtml("그룹", `<input id="loreStGroup" value="${esc(stv.group || "")}" placeholder="동일 라벨 그룹">`, "group")}
        ${loreSwitchHtml("loreStGroupOverride", "그룹 우선", stv.groupOverride, "groupOverride")}
        ${loreFieldHtml("그룹 가중치", `<input id="loreStGroupWeight" type="number" min="1" value="${stv.groupWeight}" inputmode="numeric">`, "groupWeight")}
        ${loreFieldHtml("그룹 스코어링", loreTriSelect("loreStUseGroupScoring", stv.useGroupScoring), "useGroupScoring")}
        ${loreFieldHtml("Automation ID", `<input id="loreStAutomationId" value="${esc(stv.automationId || "")}">`, "automationId")}
        ${loreFieldHtml("Outlet", `<input id="loreStOutletName" value="${esc(stv.outletName || "")}">`, "outletName")}
        ${loreFieldHtml("표시 순서", `<input id="loreStDisplayIndex" type="number" min="0" value="${stv.displayIndex == null ? "" : stv.displayIndex}" inputmode="numeric">`, "displayIndex")}
      </div></section>
      <section class="lore-st-section"><h4>캐릭터 필터</h4><div class="lore-st-grid">
        ${loreSwitchHtml("loreStCharacterFilterExclude", "제외 필터", stv.characterFilter && stv.characterFilter.isExclude, "isExclude")}
        ${loreFieldHtml("이름", `<textarea id="loreStCharacterFilterNames" rows="2" placeholder="쉼표 또는 줄바꿈">${esc(((stv.characterFilter && stv.characterFilter.names) || []).join(", "))}</textarea>`, "names")}
        ${loreFieldHtml("태그", `<textarea id="loreStCharacterFilterTags" rows="2" placeholder="쉼표 또는 줄바꿈">${esc(((stv.characterFilter && stv.characterFilter.tags) || []).join(", "))}</textarea>`, "tags")}
      </div></section>
      <div class="m-row"><button class="m-btn" id="loreStCancel">취소</button><button class="m-btn primary" id="loreStSave">저장</button></div></div>`);
    $on("loreStCancel", "click", closeModal);
    $on("loreStSave", "click", () => {
      const current = getNote(st.curNoteId); if (!current || current.type !== "lorebook") { closeModal(); return; }
      const data = ensureLoreData(current), next = data.st;
      const [pos, role] = String($("loreStPositionRole").value || "0:").split(":");
      next.disable = $("loreStDisable").checked;
      next.constant = $("loreStConstant").checked;
      next.vectorized = $("loreStVectorized").checked;
      next.selective = $("loreStSelective").checked;
      next.selectiveLogic = loreNum($("loreStSelectiveLogic").value, 0, 0, 3);
      next.addMemo = $("loreStAddMemo").checked;
      next.order = loreNum($("loreStOrder").value, 100, -999999, 999999);
      next.position = loreNum(pos, 0, 0, 6);
      next.role = role === "" ? null : loreNullableNum(role, 0, 999);
      next.depth = loreNum($("loreStDepth").value, 4, 0, 999);
      next.useProbability = $("loreStUseProbability").checked;
      next.probability = loreNum($("loreStProbability").value, 100, 0, 100);
      next.scanDepth = loreNullableNum($("loreStScanDepth").value, 0, 999);
      next.caseSensitive = loreTriFromSelect("loreStCaseSensitive");
      next.matchWholeWords = loreTriFromSelect("loreStMatchWholeWords");
      next.triggers = LORE_ST_TRIGGERS.map(([key]) => key).filter((key) => $("loreStTrigger_" + key).checked);
      next.ignoreBudget = $("loreStIgnoreBudget").checked;
      next.excludeRecursion = $("loreStExcludeRecursion").checked;
      next.preventRecursion = $("loreStPreventRecursion").checked;
      next.delayUntilRecursion = $("loreStDelayUntilRecursion").checked;
      next.sticky = loreNum($("loreStSticky").value, 0, 0, 999999);
      next.cooldown = loreNum($("loreStCooldown").value, 0, 0, 999999);
      next.delay = loreNum($("loreStDelay").value, 0, 0, 999999);
      next.matchPersonaDescription = $("loreStMatchPersonaDescription").checked;
      next.matchCharacterDescription = $("loreStMatchCharacterDescription").checked;
      next.matchCharacterPersonality = $("loreStMatchCharacterPersonality").checked;
      next.matchCharacterDepthPrompt = $("loreStMatchCharacterDepthPrompt").checked;
      next.matchScenario = $("loreStMatchScenario").checked;
      next.matchCreatorNotes = $("loreStMatchCreatorNotes").checked;
      next.group = cleanImportedText($("loreStGroup").value, 180);
      next.groupOverride = $("loreStGroupOverride").checked;
      next.groupWeight = loreNum($("loreStGroupWeight").value, 100, 1, 999999);
      next.useGroupScoring = loreTriFromSelect("loreStUseGroupScoring");
      next.automationId = cleanImportedText($("loreStAutomationId").value, 120);
      next.outletName = cleanImportedText($("loreStOutletName").value, 120);
      next.displayIndex = loreNullableNum($("loreStDisplayIndex").value, 0, 999999);
      next.characterFilter = { isExclude: $("loreStCharacterFilterExclude").checked, names: loreInputListValue("loreStCharacterFilterNames"), tags: loreInputListValue("loreStCharacterFilterTags") };
      applyLoreStToLegacy(data);
      saveLore(current, true);
      renderLore();
      closeModal();
      toast("ST 설정을 저장했어요");
    });
  }

  // ST World Info export
  function buildWorldInfo(notes) {
    const entries = {};
    notes.forEach((n, i) => {
      const d = ensureLoreData(n), stv = applyLoreStToLegacy(d).st;
      entries[String(i)] = Object.assign({}, jsonCopy(stv.extra) || {}, {
        uid: i,
        key: d.keywords.slice(),
        keysecondary: stv.keysecondary.slice(),
        comment: n.title || "",
        content: d.content || "",
        constant: !!stv.constant,
        vectorized: !!stv.vectorized,
        selective: !!stv.selective,
        selectiveLogic: stv.selectiveLogic,
        addMemo: !!stv.addMemo,
        order: stv.order,
        position: stv.position,
        disable: !!stv.disable,
        ignoreBudget: !!stv.ignoreBudget,
        excludeRecursion: !!stv.excludeRecursion,
        preventRecursion: !!stv.preventRecursion,
        matchPersonaDescription: !!stv.matchPersonaDescription,
        matchCharacterDescription: !!stv.matchCharacterDescription,
        matchCharacterPersonality: !!stv.matchCharacterPersonality,
        matchCharacterDepthPrompt: !!stv.matchCharacterDepthPrompt,
        matchScenario: !!stv.matchScenario,
        matchCreatorNotes: !!stv.matchCreatorNotes,
        delayUntilRecursion: !!stv.delayUntilRecursion,
        probability: stv.probability,
        useProbability: !!stv.useProbability,
        depth: stv.depth,
        outletName: stv.outletName || "",
        group: stv.group || "",
        groupOverride: !!stv.groupOverride,
        groupWeight: stv.groupWeight,
        scanDepth: stv.scanDepth,
        caseSensitive: stv.caseSensitive,
        matchWholeWords: stv.matchWholeWords,
        useGroupScoring: stv.useGroupScoring,
        automationId: stv.automationId || "",
        role: stv.role,
        sticky: stv.sticky,
        cooldown: stv.cooldown,
        delay: stv.delay,
        triggers: stv.triggers.slice(),
        displayIndex: stv.displayIndex == null ? i : stv.displayIndex,
        characterFilter: normalizeLoreCharacterFilter(stv.characterFilter)
      });
    });
    return { entries };
  }
  function defaultWiName(notes) {
    if (notes.length === 1) return notes[0].title || "lorebook";
    const p = getProject(notes[0].projectId); return p ? p.name : "lorebook";
  }
  function sumLoreTokens(notes, cb) {
    ensureTokenizer().then((ok) => {
      if (ok && window.__luminkCountTokens) {
        let total = 0;
        notes.forEach((n) => { total += (window.__luminkCountTokens((n.data && n.data.content) || "") || 0); });
        cb(total);
      } else cb(null);
    });
  }
  function exportWorldInfoFlow(notes) {
    if (!notes.length) { toast("내보낼 로어북이 없어요"); return; }
    openModal(`<h3>World Info 내보내기</h3><p class="m-sub">${notes.length}개 항목을 하나의 .json으로 묶어 내보냅니다.</p><div class="wi-toksum" id="wiTok">토큰 합산 중…</div><div class="m-field-label">파일 이름 (.json)</div><input class="m-input" id="wiName" placeholder="예: 세계관_로어북" value="${esc(defaultWiName(notes))}" autocapitalize="off"><div class="m-row"><button class="m-btn" id="wiNo">취소</button><button class="m-btn primary" id="wiOk">내보내기</button></div>`);
    sumLoreTokens(notes, (t) => { const el = $("wiTok"); if (el) el.innerHTML = (t == null) ? "토큰 합산 불가" : `합산 토큰 <b>${t.toLocaleString()}</b> · ${notes.length}개`; });
    setTimeout(() => { const i = $("wiName"); i.focus(); i.select(); }, 120);
    $on("wiNo", "click", closeModal);
    $on("wiOk", "click", () => {
      let name = ($("wiName").value.trim() || "lorebook").replace(/[\\/:*?"<>|]+/g, "_").slice(0, 60);
      const wi = buildWorldInfo(notes);
      const blob = new Blob([JSON.stringify(wi, null, 2)], { type: "application/json;charset=utf-8" });
      const url = URL.createObjectURL(blob), a = document.createElement("a");
      a.href = url; a.download = name + ".json"; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
      closeModal(); toast("World Info를 내보냈어요");
    });
  }
  function showLoreExportPicker(pid) {
    const lores = notesOf(pid).filter((n) => n.type === "lorebook");
    if (!lores.length) { toast("이 프로젝트에 로어북이 없어요"); return; }
    const sel = new Set(lores.map((n) => n.id));
    openModal(`<h3>World Info 내보내기</h3><p class="m-sub">하나의 .json으로 묶을 로어북을 선택하세요.</p><div class="lore-pick-list" id="lpList"></div><div class="wi-toksum" id="lpTok"></div><div class="m-row"><button class="m-btn" id="lpNo">취소</button><button class="m-btn primary" id="lpNext">다음</button></div>`);
    const list = $("lpList");
    const updTok = () => { const chosen = lores.filter((n) => sel.has(n.id)); const el = $("lpTok"); if (!el) return; if (!chosen.length) { el.textContent = "선택된 로어북 없음"; return; } el.textContent = "토큰 합산 중…"; sumLoreTokens(chosen, (t) => { if ($("lpTok")) $("lpTok").innerHTML = (t == null) ? "토큰 합산 불가" : `합산 토큰 <b>${t.toLocaleString()}</b> · ${chosen.length}개`; }); };
    const draw = () => {
      list.innerHTML = "";
      lores.forEach((n) => {
        const row = document.createElement("div"); row.className = "lore-pick" + (sel.has(n.id) ? " sel" : "");
        const tk = ((n.data && n.data.keywords) || []).length;
        row.innerHTML = `<div class="lp-check"><svg viewBox="0 0 24 24"><path d="M5 12l4 4 10-10"/></svg></div><div class="lp-body"><div class="lp-name">${esc(n.title)}</div><div class="lp-meta">키워드 ${tk}개${n.data && n.data.alwaysActive ? " · 항상 활성" : ""}</div></div>`;
        row.addEventListener("click", () => { if (sel.has(n.id)) sel.delete(n.id); else sel.add(n.id); draw(); updTok(); });
        list.appendChild(row);
      });
    };
    draw(); updTok();
    $on("lpNo", "click", closeModal);
    $on("lpNext", "click", () => {
      const chosen = lores.filter((n) => sel.has(n.id));
      if (!chosen.length) { toast("최소 1개를 선택하세요"); return; }
      exportWorldInfoFlow(chosen);
    });
  }
  function openLoreSheet(n) {
    openSheet(n.title, [
      { icon: IC.pin, label: n.pinned ? "고정 해제" : "상단 고정", fn: () => togglePinNote(n.id) },
      { icon: IC.rename, label: "이름 바꾸기", fn: () => renameModal("로어북 이름", n.title, async (v) => { if (v) { n.title = v; n.titleLocked = true; await saveLore(n, true); render(); } }) },
      { icon: IC.color, label: "색상 지정", fn: () => showChipPicker(n.id) },
      { icon: IC.export, label: "World Info(.json)로 내보내기", fn: () => exportWorldInfoFlow([n]) },
      { icon: IC.move, label: "다른 프로젝트로 이동", fn: () => pickTargetProject(n.projectId, (pid) => moveNote(n.id, pid).then(render)) },
      { icon: IC.copy, label: "선택 위치로 복제", fn: () => pickTargetProject(n.projectId, (pid) => duplicateNote(n.id, pid).then(render)) },
      { icon: IC.del, label: "삭제", danger: true, fn: () => confirmModal("로어북 삭제", `'${n.title}'를 삭제할까요?`, "삭제", true, async () => { await deleteNote(n.id); back(); }) }
    ]);
  }

  /* ---------- styled log memo ---------- */
  const LOG_TEMPLATE_STORAGE = "luminkLogTemplatesV1";
  const LOG_TEMPLATE_FAVORITES_STORAGE = "luminkLogTemplateFavoritesV1";
  const LOG_STYLE_PROPS = new Set(["background", "background-color", "color", "border", "border-left", "border-right", "border-top", "border-bottom", "border-radius", "padding", "padding-left", "padding-right", "padding-top", "padding-bottom", "margin", "margin-left", "margin-right", "margin-top", "margin-bottom", "box-shadow", "font-family", "font-size", "font-weight", "font-style", "text-decoration", "line-height", "letter-spacing", "text-align", "white-space", "word-break", "overflow-wrap", "display", "width", "max-width", "min-width", "height", "min-height"]);
  let logEditMode = true, logTimer = null, bundledLogTemplates = [], bundledLogTemplatesReady = null;
  let logTemplateTab = "builtin", logTemplateQuery = "", logTemplateSortAsc = true;

  function cleanLogStyle(raw) {
    const out = {};
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
    Object.entries(raw).slice(0, 60).forEach(([key, val]) => {
      const prop = String(key).trim().toLowerCase(), value = typeof val === "string" ? val.trim() : "";
      if (!LOG_STYLE_PROPS.has(prop) || !value || value.length > 220) return;
      if (/url\s*\(|expression\s*\(|@import|javascript:|behavior\s*:|-moz-binding/i.test(value)) return;
      out[prop] = value;
    });
    return out;
  }
  function riskyLogPattern(pattern) {
    return pattern.length > 300 || /(\([^)]*[+*][^)]*\))[+*{]/.test(pattern) || /(\.\*){2,}|(\.\+){2,}/.test(pattern) || /\\[1-9]/.test(pattern);
  }
  const LOG_NAME_DESIGN_COUNT = 5;
  const LOG_NAME_DESIGN_LABELS = ["솔리드 칩", "아웃라인", "언더라인", "소프트 틴트", "마커 하이라이트"];
  function logColorClamp(n) { return Math.max(0, Math.min(255, Math.round(Number(n) || 0))); }
  function logParseColor(input) {
    if (typeof input !== "string") return null;
    let s = input.trim().toLowerCase();
    if (!s) return null;
    if (s[0] === "#") {
      if (/^#[0-9a-f]{3}$/.test(s)) s = "#" + s.slice(1).split("").map((c) => c + c).join("");
      if (/^#[0-9a-f]{6}$/.test(s)) return { r: parseInt(s.slice(1, 3), 16), g: parseInt(s.slice(3, 5), 16), b: parseInt(s.slice(5, 7), 16), a: 1 };
      return null;
    }
    const m = s.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/);
    if (m) return { r: +m[1], g: +m[2], b: +m[3], a: m[4] != null ? +m[4] : 1 };
    if (s === "white") return { r: 255, g: 255, b: 255, a: 1 };
    if (s === "black") return { r: 0, g: 0, b: 0, a: 1 };
    if (s === "transparent") return { r: 0, g: 0, b: 0, a: 0 };
    return null;
  }
  function logHexStr(c) { return "#" + [c.r, c.g, c.b].map((n) => logColorClamp(n).toString(16).padStart(2, "0")).join(""); }
  function logRgbaStr(c, a) {
    const alpha = Math.max(0, Math.min(1, a));
    return `rgba(${logColorClamp(c.r)},${logColorClamp(c.g)},${logColorClamp(c.b)},${(+alpha.toFixed(3))})`;
  }
  function logMixColor(a, b, t) { return { r: a.r + (b.r - a.r) * t, g: a.g + (b.g - a.g) * t, b: a.b + (b.b - a.b) * t, a: 1 }; }
  function logLuminance(c) { return (0.299 * c.r + 0.587 * c.g + 0.114 * c.b) / 255; }
  // 이름 표시 디자인 1종(기존 persona.style)에서 5종 변주를 자동 생성합니다.
  // 칩 → 아웃라인 → 언더라인 → 소프트 틴트 → 마커 하이라이트.
  function deriveNameDesigns(baseStyle) {
    const base = cleanLogStyle(baseStyle);
    const radius = base["border-radius"] || "999px";
    const softRadius = radius === "999px" ? "7px" : radius;
    const weight = base["font-weight"] || "800";
    const spacing = base["letter-spacing"];
    const family = base["font-family"];
    const fill = logParseColor(base["background-color"]) || logParseColor(base["background"]);
    const text = logParseColor(base["color"]);
    const accent = (fill && fill.a > 0 ? fill : null) || text || logParseColor("#5967bd");
    const light = logLuminance(accent) > 0.62;
    const onAccent = (fill && fill.a > 0 ? (text || (light ? logParseColor("#1b2233") : logParseColor("#ffffff"))) : (light ? logParseColor("#1b2233") : logParseColor("#ffffff")));
    const accentDeep = light ? logMixColor(accent, { r: 0, g: 0, b: 0 }, 0.4) : accent;
    const common = (o) => { const s = Object.assign({}, o); if (spacing) s["letter-spacing"] = spacing; if (family) s["font-family"] = family; return s; };
    const chip = (fill && fill.a > 0) ? common(Object.assign({}, base)) : common({ "color": logHexStr(onAccent), "background-color": logHexStr(accent), "border-radius": radius, "padding": base["padding"] || "1px 8px", "font-weight": weight });
    const outline = common({ "color": logHexStr(accentDeep), "background-color": "transparent", "border": `1.5px solid ${logRgbaStr(accent, 0.85)}`, "border-radius": radius, "padding": "0 7px", "font-weight": weight });
    const underline = common({ "color": logHexStr(accentDeep), "border-bottom": `2px solid ${logRgbaStr(accent, 0.9)}`, "padding": "0 1px 1px", "font-weight": weight });
    const tint = common({ "color": logHexStr(accentDeep), "background-color": logRgbaStr(accent, 0.16), "border-radius": softRadius, "padding": "1px 7px", "font-weight": weight });
    const marker = common({ "color": logHexStr(accentDeep), "background": `linear-gradient(to top, ${logRgbaStr(accent, 0.42)} 42%, transparent 42%)`, "padding": "0 3px", "font-weight": weight });
    return [chip, outline, underline, tint, marker].map((style, i) => ({ label: LOG_NAME_DESIGN_LABELS[i], style: cleanLogStyle(style) }));
  }
  function normalizeLogPersona(rawPersona) {
    const p = rawPersona && typeof rawPersona === "object" ? rawPersona : {};
    const maskText = cleanImportedText(p.maskText, 80) || "•••";
    const baseStyle = cleanLogStyle(p.style);
    let designs = [];
    if (Array.isArray(p.designs) && p.designs.length) {
      designs = p.designs.slice(0, LOG_NAME_DESIGN_COUNT).map((d, i) => ({
        label: cleanImportedText(d && d.label, 40) || LOG_NAME_DESIGN_LABELS[i] || `디자인 ${i + 1}`,
        style: cleanLogStyle(d && d.style)
      })).filter((d) => Object.keys(d.style).length);
    }
    if (!designs.length) {
      designs = deriveNameDesigns(baseStyle);
      if (Object.keys(baseStyle).length) designs[0] = { label: LOG_NAME_DESIGN_LABELS[0], style: baseStyle };
    } else if (designs.length < LOG_NAME_DESIGN_COUNT) {
      const derived = deriveNameDesigns(designs[0].style);
      for (let i = designs.length; i < LOG_NAME_DESIGN_COUNT; i++) designs[i] = derived[i];
    }
    designs = designs.slice(0, LOG_NAME_DESIGN_COUNT).map((d, i) => ({ label: d.label || LOG_NAME_DESIGN_LABELS[i], style: d.style }));
    return { maskText, designs, style: designs[0].style };
  }
  function normalizeLogTemplate(raw) {
    if (!raw || raw.kind !== "lumink-log-template" || Number(raw.schemaVersion) !== 1) throw new Error("루미잉크 로그 템플릿 v1 형식이 아니에요");
    const id = String(raw.id || "").trim();
    if (!/^[a-z0-9][a-z0-9-]{2,63}$/i.test(id)) throw new Error("템플릿 id는 영문·숫자·하이픈 3~64자로 작성해 주세요");
    const styles = {}, srcStyles = raw.styles && typeof raw.styles === "object" ? raw.styles : {};
    ["canvas", "header", "body", "paragraph", "empty"].forEach((key) => { styles[key] = cleanLogStyle(srcStyles[key]); });
    const rules = (Array.isArray(raw.rules) ? raw.rules : []).slice(0, 20).map((rule, index) => {
      const pattern = typeof rule.pattern === "string" ? rule.pattern : "";
      if (!pattern || riskyLogPattern(pattern)) throw new Error(`${index + 1}번째 정규식이 너무 복잡하거나 안전하지 않아요`);
      let flags = String(rule.flags || "g").replace(/[^gimu]/g, ""); if (!flags.includes("g")) flags += "g"; flags = [...new Set(flags)].join("");
      try { new RegExp(pattern, flags); } catch (e) { throw new Error(`${index + 1}번째 정규식을 읽을 수 없어요`); }
      return {
        id: cleanImportedText(rule.id, 80) || `rule-${index + 1}`,
        label: cleanImportedText(rule.label, 120) || `규칙 ${index + 1}`,
        pattern, flags, capture: Math.min(9, Math.max(0, Number(rule.capture) || 0)),
        stripDelimiters: !!rule.stripDelimiters, style: cleanLogStyle(rule.style)
      };
    });
    return {
      kind: "lumink-log-template", schemaVersion: 1, id,
      name: cleanImportedText(raw.name, 100) || id,
      description: cleanImportedText(raw.description, 300), author: cleanImportedText(raw.author, 100),
      styles, rules, persona: normalizeLogPersona(raw.persona)
    };
  }
  function builtInLogTemplates() {
    return [...(Array.isArray(window.__luminkLogBuiltins) ? window.__luminkLogBuiltins : []), ...bundledLogTemplates].map((template) => {
      try { return normalizeLogTemplate(template); } catch (e) { return null; }
    }).filter(Boolean);
  }
  function loadBundledLogTemplates() {
    if (bundledLogTemplatesReady) return bundledLogTemplatesReady;
    const files = Array.isArray(window.__luminkLogTemplateFiles) ? window.__luminkLogTemplateFiles : [];
    bundledLogTemplatesReady = Promise.all(files.map(async (file) => {
      try {
        const response = await fetch(`./log-templates/${encodeURIComponent(file)}`);
        if (!response.ok) return null;
        return normalizeLogTemplate(await response.json());
      } catch (e) { console.warn("log template", file, e); return null; }
    })).then((templates) => {
      const seen = new Set((window.__luminkLogBuiltins || []).map((template) => template.id));
      bundledLogTemplates = templates.filter((template) => {
        if (!template || seen.has(template.id)) return false;
        seen.add(template.id); return true;
      });
      return bundledLogTemplates;
    });
    return bundledLogTemplatesReady;
  }
  function readCustomLogTemplates() {
    try {
      const list = JSON.parse(localStorage.getItem(LOG_TEMPLATE_STORAGE) || "[]");
      return (Array.isArray(list) ? list : []).map((template) => { try { return normalizeLogTemplate(template); } catch (e) { return null; } }).filter(Boolean).slice(0, 20);
    } catch (e) { return []; }
  }
  function writeCustomLogTemplates(list) {
    try { localStorage.setItem(LOG_TEMPLATE_STORAGE, JSON.stringify((list || []).slice(0, 20))); return true; }
    catch (e) { toast("템플릿 저장공간이 부족해요"); return false; }
  }
  function readLogTemplateFavorites() {
    try {
      const list = JSON.parse(localStorage.getItem(LOG_TEMPLATE_FAVORITES_STORAGE) || "[]");
      return new Set((Array.isArray(list) ? list : []).map((id) => String(id || "").trim()).filter(Boolean).slice(0, 200));
    } catch (e) { return new Set(); }
  }
  function writeLogTemplateFavorites(favorites) {
    try { localStorage.setItem(LOG_TEMPLATE_FAVORITES_STORAGE, JSON.stringify([...favorites].slice(0, 200))); return true; }
    catch (e) { toast("즐겨찾기를 저장하지 못했어요"); return false; }
  }
  function allLogTemplates(n) {
    const list = [...builtInLogTemplates(), ...readCustomLogTemplates()];
    const snap = n && n.data && n.data.templateSnapshot;
    if (snap) { try { const template = normalizeLogTemplate(snap); if (!list.some((item) => item.id === template.id)) list.push(template); } catch (e) {} }
    return list;
  }
  function getLogTemplate(n) {
    const list = allLogTemplates(n), id = n && n.data && n.data.templateId;
    return list.find((template) => template.id === id) || list[0] || normalizeLogTemplate({ kind: "lumink-log-template", schemaVersion: 1, id: "system-fallback", name: "기본", styles: {}, rules: [], persona: {} });
  }
  const LOG_NAME_SET_COUNT = 5;
  const LOG_NAME_SET_LIMIT = 20;
  function normalizeLogNameSet(raw) {
    const src = raw && typeof raw === "object" ? raw : {};
    const sourceNames = Array.isArray(src.names) ? src.names : (Array.isArray(src.personaNames) ? src.personaNames : []);
    const names = [...new Set(sourceNames.map((name) => cleanImportedText(String(name || ""), 80).trim()).filter(Boolean))].slice(0, LOG_NAME_SET_LIMIT);
    const replacement = cleanImportedText(src.replacement != null ? src.replacement : src.alias, 80).trim();
    const design = Math.max(0, Math.min(LOG_NAME_DESIGN_COUNT - 1, Math.floor(Number(src.design)) || 0));
    return { names, replacement, design };
  }
  function normalizeLogNameSets(rawSets, legacyNames, legacyAlias) {
    const source = Array.isArray(rawSets) ? rawSets : [];
    const out = Array.from({ length: LOG_NAME_SET_COUNT }, (_, index) => normalizeLogNameSet(source[index]));
    const hasConfiguredSet = out.some((set) => set.names.length || set.replacement);
    if (!hasConfiguredSet) {
      out[0] = normalizeLogNameSet({ names: legacyNames, replacement: legacyAlias });
    }
    // 원본 이름은 다섯 세트 전체에서 한 번만 쓸 수 있습니다.
    // 과거 데이터에 중복이 있다면 낮은 번호 세트(1 → 5)를 우선 보존해
    // 기존 로그의 표시 결과가 예측 가능하도록 안전 이전합니다.
    const used = new Set();
    return out.map((set) => {
      const names = [];
      (set.names || []).forEach((name) => {
        const key = logNameLookup(name);
        if (!key || used.has(key)) return;
        used.add(key); names.push(String(name || "").trim());
      });
      return { names, replacement: set.replacement || "", design: set.design || 0 };
    });
  }
  function logNameSetCount(sets) {
    return normalizeLogNameSets(sets).reduce((count, set) => count + set.names.length, 0);
  }
  function normalizeLogData(raw) {
    const src = raw && typeof raw === "object" ? raw : {};
    let snapshot = null;
    if (src.templateSnapshot) { try { snapshot = normalizeLogTemplate(src.templateSnapshot); } catch (e) {} }
    const rawNames = Array.isArray(src.personaNames) ? src.personaNames : (src.personaName ? [src.personaName] : []);
    const nameSets = normalizeLogNameSets(src.nameSets, rawNames, src.personaAlias);
    return {
      content: cleanImportedText(src.content, 500000),
      templateId: cleanImportedText(src.templateId, 80) || "system-ink-frame",
      nameSets,
      // v65.9 이하 백업 및 외부 HTML 불러오기 호환 필드. 첫 세트와 항상 동기화합니다.
      personaNames: nameSets[0].names.slice(),
      personaAlias: nameSets[0].replacement,
      templateSnapshot: snapshot
    };
  }
  function logStyleAttr(style) {
    return Object.entries(cleanLogStyle(style)).map(([key, value]) => `${key}:${value}`).join(";");
  }
  function mergeLogStyle(a, b) { return Object.assign({}, a || {}, b || {}); }
  function applyLogRule(segments, rule) {
    const next = [];
    segments.forEach((segment) => {
      const text = segment.text || ""; let regex;
      try { regex = new RegExp(rule.pattern, rule.flags); } catch (e) { next.push(segment); return; }
      let last = 0, match, count = 0;
      while ((match = regex.exec(text)) && count++ < 1000) {
        if (!match[0]) { regex.lastIndex += 1; continue; }
        const fullStart = match.index, fullEnd = fullStart + match[0].length;
        const capture = rule.capture > 0 && typeof match[rule.capture] === "string" ? match[rule.capture] : match[0];
        const inside = rule.capture > 0 ? match[0].indexOf(capture) : 0;
        const targetStart = fullStart + Math.max(0, inside), targetEnd = targetStart + capture.length;
        if (rule.stripDelimiters) {
          if (fullStart > last) next.push({ text: text.slice(last, fullStart), style: segment.style });
        } else {
          if (targetStart > last) next.push({ text: text.slice(last, targetStart), style: segment.style });
        }
        if (capture) next.push({ text: capture, style: mergeLogStyle(segment.style, rule.style) });
        if (!rule.stripDelimiters && fullEnd > targetEnd) next.push({ text: text.slice(targetEnd, fullEnd), style: segment.style });
        last = fullEnd;
      }
      if (last < text.length) next.push({ text: text.slice(last), style: segment.style });
      else if (!text.length) next.push(segment);
    });
    return next;
  }
  function applyPersonaMask(segments, name, alias, style) {
    if (!name) return segments;
    const out = [];
    segments.forEach((segment) => {
      if (segment.masked) { out.push(segment); return; }
      let at = 0, index;
      while ((index = segment.text.indexOf(name, at)) >= 0) {
        if (index > at) out.push({ text: segment.text.slice(at, index), style: segment.style });
        out.push({ text: alias, style: mergeLogStyle(segment.style, style), masked: true }); at = index + name.length;
      }
      if (at < segment.text.length) out.push({ text: segment.text.slice(at), style: segment.style });
      else if (!segment.text.length) out.push(segment);
    });
    return out;
  }
  function applyLogNameSets(segments, template, data) {
    const persona = template.persona || {};
    const designs = (Array.isArray(persona.designs) && persona.designs.length) ? persona.designs : [{ style: persona.style || {} }];
    const fallback = (persona.maskText || "•••").trim();
    normalizeLogNameSets(data && data.nameSets, data && data.personaNames, data && data.personaAlias).forEach((set) => {
      const replacement = (set.replacement || fallback).trim();
      if (!set.names.length || !replacement) return;
      const design = designs[Math.max(0, Math.min(designs.length - 1, set.design || 0))] || designs[0];
      const style = (design && design.style) || {};
      [...set.names].sort((a, b) => String(b).length - String(a).length).forEach((name) => {
        segments = applyPersonaMask(segments, String(name || "").trim(), replacement, style);
      });
    });
    return segments;
  }
  function renderLogSegments(segments) {
    return segments.map((segment) => {
      const style = logStyleAttr(segment.style), textHtml = esc(segment.text);
      return style ? `<span style="${esc(style)}">${textHtml}</span>` : textHtml;
    }).join("");
  }
  function renderLogMaskedText(text, template, data) {
    return renderLogSegments(applyLogNameSets([{ text: String(text || ""), style: {} }], template, data));
  }
  function renderLogLine(text, template, data) {
    let segments = [{ text: String(text || ""), style: {} }];
    template.rules.forEach((rule) => { segments = applyLogRule(segments, rule); });
    return renderLogSegments(applyLogNameSets(segments, template, data));
  }
  function renderLogInlineHtml(n) {
    const data = normalizeLogData(n && n.data), template = getLogTemplate(n), styles = template.styles;
    const lines = String(data.content || "").split(/\r?\n/);
    const body = lines.map((line) => line.length
      ? `<div style="${esc(logStyleAttr(styles.paragraph))}">${renderLogLine(line, template, data)}</div>`
      : `<div style="${esc(logStyleAttr(styles.empty))}"><br></div>`).join("");
    const header = `<div style="${esc(logStyleAttr(styles.header))}">${renderLogMaskedText((n && n.title) || "로그", template, data)}</div>`;
    return `<div data-lumink-log="1" style="${esc(logStyleAttr(styles.canvas))}">${header}<div style="${esc(logStyleAttr(styles.body))}">${body}</div></div>`;
  }
  function deriveLogTitle(content) {
    const first = String(content || "").split(/\r?\n/).map((line) => line.replace(/[\[\]*_'"`]/g, "").trim()).find(Boolean) || "";
    return first ? first.slice(0, 52) : "이름 없는 로그";
  }
  function setLogSaver(mode) {
    const saver = $("logSaver"); if (!saver) return;
    saver.className = "saver " + (mode || ""); $("logSaverText").textContent = mode === "dirty" ? "기록 중" : mode === "saved" ? "저장됨" : "";
    if (mode === "saved") setTimeout(() => { if (saver.classList.contains("saved")) { saver.className = "saver"; $("logSaverText").textContent = ""; } }, 1500);
  }
  function renderLogPreview(n) {
    const preview = $("logPreview");
    if (!(n.data && n.data.content || "").trim()) { preview.innerHTML = '<div class="log-preview-empty">원본 텍스트를 입력하면 여기에 디자인이 적용됩니다.</div>'; return; }
    preview.innerHTML = renderLogInlineHtml(n);
  }
  function renderLogRenameSets(sets) {
    const host = $("logRenameSets"); if (!host) return;
    const normalized = normalizeLogNameSets(sets);
    host.innerHTML = normalized.map((set, index) => {
      const ready = !!(set.names.length && set.replacement);
      const partial = !!(set.names.length && !set.replacement);
      const state = ready ? " is-configured" : (partial ? " is-partial" : "");
      const stateLabel = ready ? "설정됨" : (partial ? "바꿀 이름 미지정" : "비어 있음");
      return `<button class="log-rename-set${state}" type="button" data-log-rename-set="${index}" aria-label="이름 치환 세트 ${index + 1} 편집 · ${stateLabel}" title="이름 치환 세트 ${index + 1}"><span class="log-rename-index">${String(index + 1).padStart(2, "0")}</span><span class="log-rename-label">세트</span><span class="log-rename-state" aria-hidden="true"></span></button>`;
    }).join("");
    host.querySelectorAll("[data-log-rename-set]").forEach((button) => button.addEventListener("click", () => openLogNameSetEditor(Number(button.dataset.logRenameSet))));
  }
  function logSetNamesFromModal() {
    return [...document.querySelectorAll("#logSetNames .log-set-name")].map((input) => input.value.trim()).filter(Boolean);
  }
  function logNameLookup(value) { return cleanImportedText(String(value || ""), 80).trim().toLocaleLowerCase(); }
  function findLogNameSetConflicts(sets, currentIndex, names) {
    const wanted=[...new Set((names||[]).map(logNameLookup).filter(Boolean))]; if(!wanted.length)return [];
    const normalized=normalizeLogNameSets(sets), found=new Map();
    normalized.forEach((set,index)=>{ if(index===currentIndex)return; (set.names||[]).forEach((name)=>{const key=logNameLookup(name); if(!key||!wanted.includes(key))return; const row=found.get(key)||{name:String(name||"").trim(),sets:[]}; if(!row.sets.includes(index+1))row.sets.push(index+1); found.set(key,row); }); });
    return [...found.values()];
  }
  function logSetConflictMarkup(conflicts) {
    if(!conflicts.length)return "";
    const items=conflicts.map((row)=>`<li><b>${esc(row.name)}</b><span>세트 ${row.sets.join(", ")}에 먼저 등록됨</span></li>`).join("");
    return `<div class="log-set-conflict" id="logSetConflict" role="alert"><b>다른 세트에 이미 등록된 원본 이름입니다</b><small>원본 이름은 다섯 세트 전체에서 한 번만 사용할 수 있어요. 중복된 이름을 수정하거나 삭제한 뒤 저장해 주세요.</small><ul>${items}</ul></div>`;
  }
  function renderLogSetNames(names) {
    const host = $("logSetNames"); if (!host) return;
    const values = Array.isArray(names) && names.length ? names.slice(0, LOG_NAME_SET_LIMIT) : [""];
    host.innerHTML = values.map((name, index) => `<div class="log-set-name-row"><input class="m-input log-set-name" maxlength="80" value="${esc(name)}" placeholder="원본 이름 ${index + 1}"><button class="log-set-name-remove" type="button" data-log-set-remove="${index}" aria-label="원본 이름 삭제"${values.length === 1 ? " hidden" : ""}>×</button></div>`).join("");
    host.querySelectorAll("[data-log-set-remove]").forEach((button) => button.addEventListener("click", () => {
      const namesNow = logSetNamesFromModal(); namesNow.splice(Number(button.dataset.logSetRemove), 1); renderLogSetNames(namesNow.length ? namesNow : [""]);
      const nextHost = $("logSetNames"); if (nextHost) nextHost.dispatchEvent(new Event("input", { bubbles:true }));
    }));
  }
  // 이름 치환 디자인은 이름 자체가 아니라, 다섯 가지 표시 스타일의 차이를 빠르게 비교하는 용도입니다.
  // 따라서 어떤 세트에서도 같은 샘플 텍스트를 사용합니다.
  function logSetDesignSample() { return "미리보기"; }
  function logSetSelectedDesign() {
    const host = $("logSetDesigns");
    return host ? Math.max(0, Math.min(LOG_NAME_DESIGN_COUNT - 1, Number(host.dataset.selected) || 0)) : 0;
  }
  function renderLogSetDesigns(template, selected) {
    const host = $("logSetDesigns"); if (!host) return;
    const designs = (template && template.persona && template.persona.designs) || [];
    const canvas = (template && template.styles && template.styles.canvas) || {};
    const canvasBg = canvas["background"] || canvas["background-color"] || "#ffffff";
    const sample = esc(logSetDesignSample());
    const safeSelected = Math.max(0, Math.min(Math.max(0, designs.length - 1), Number(selected) || 0));
    host.dataset.selected = String(safeSelected);
    host.setAttribute("aria-label", "이름 표시 디자인 미리보기 5종");
    host.innerHTML = designs.slice(0, LOG_NAME_DESIGN_COUNT).map((d, index) => {
      const styleAttr = esc(logStyleAttr(d.style));
      const active = index === safeSelected ? " is-active" : "";
      return `<button type="button" class="log-set-design${active}" data-log-set-design="${index}" aria-pressed="${index === safeSelected ? "true" : "false"}" aria-label="미리보기 ${index + 1}" title="미리보기 ${index + 1}"><span class="log-set-design-chip" style="background:${esc(canvasBg)}"><span style="${styleAttr}">${sample}</span></span></button>`;
    }).join("");
    host.querySelectorAll("[data-log-set-design]").forEach((button) => button.addEventListener("click", () => {
      host.dataset.selected = button.dataset.logSetDesign;
      host.querySelectorAll(".log-set-design").forEach((element) => {
        const on = element === button; element.classList.toggle("is-active", on); element.setAttribute("aria-pressed", on ? "true" : "false");
      });
    }));
  }
  async function saveLogNameSet(index, draft) {
    const n=getNote(st.curNoteId); if(!n||n.type!=="log")return false;
    const safeIndex=Math.max(0,Math.min(LOG_NAME_SET_COUNT-1,Number(index)||0));
    const sets=normalizeLogNameSets(n.data&&n.data.nameSets,n.data&&n.data.personaNames,n.data&&n.data.personaAlias);
    const safeDraft=normalizeLogNameSet(draft);
    const conflicts=findLogNameSetConflicts(sets,safeIndex,safeDraft.names);
    if(conflicts.length){ toast("다른 세트에 등록된 원본 이름은 중복 저장할 수 없어요"); return false; }
    sets[safeIndex]=safeDraft;
    n.data=normalizeLogData(Object.assign({},n.data||{},{nameSets:sets}));
    await saveLog(n,true); closeModal(); renderLogRenameSets(n.data.nameSets); if(!logEditMode)renderLogPreview(n);
    toast(`이름 치환 세트 ${safeIndex+1}을 저장했어요`); return true;
  }
  function openLogNameSetEditor(index,seed) {
    const n = getNote(st.curNoteId); if (!n || n.type !== "log") return;
    const safeIndex = Math.max(0, Math.min(LOG_NAME_SET_COUNT - 1, Number(index) || 0));
    const sets = normalizeLogNameSets(n.data && n.data.nameSets, n.data && n.data.personaNames, n.data && n.data.personaAlias);
    const current = normalizeLogNameSet(seed || sets[safeIndex]);
    const template = getLogTemplate(n);
    openModal(`<h3>이름 치환 세트 ${safeIndex + 1}</h3><p class="m-sub">원본 이름은 최대 20개까지 묶을 수 있어요. 등록한 이름은 모두 아래 “바꿀 이름”으로 치환되고, 아래에서 고른 이름 표시 디자인이 이 세트에 적용됩니다. 원본 이름은 다른 세트와 중복 저장할 수 없습니다.</p><div class="m-field-label">바꿀 이름</div><input class="m-input" id="logSetReplacement" maxlength="80" value="${esc(current.replacement)}" placeholder="예: {{user}} 또는 주인공"><div class="m-field-label">미리보기</div><div class="log-set-design-list" id="logSetDesigns"></div><div class="log-set-modal-head"><span class="m-field-label">원본 이름</span><span id="logSetNameCount">${current.names.length}/${LOG_NAME_SET_LIMIT}</span></div><div class="log-set-name-list" id="logSetNames"></div><button class="m-btn log-set-add" id="logSetAdd" type="button">+ 원본 이름 추가</button><div id="logSetConflictHost"></div><div class="m-row"><button class="m-btn" id="logSetCancel">취소</button><button class="m-btn primary" id="logSetSave">세트 저장</button></div>`);
    renderLogSetNames(current.names);
    renderLogSetDesigns(template, current.design);
    const updateCount = () => { const label = $("logSetNameCount"); if (label) label.textContent = `${logSetNamesFromModal().length}/${LOG_NAME_SET_LIMIT}`; };
    const updateConflict = () => {
      const host = $("logSetConflictHost"); const saveButton = $("logSetSave"); if (!host || !saveButton) return [];
      const conflicts = findLogNameSetConflicts(sets, safeIndex, logSetNamesFromModal());
      host.innerHTML = logSetConflictMarkup(conflicts);
      saveButton.disabled = !!conflicts.length;
      saveButton.textContent = conflicts.length ? "중복 이름 수정 필요" : "세트 저장";
      saveButton.title = conflicts.length ? "다른 세트와 겹치는 원본 이름을 수정해 주세요" : "";
      return conflicts;
    };
    $("logSetNames").addEventListener("input",()=>{ updateCount(); updateConflict(); });
    updateConflict();
    $("logSetAdd").addEventListener("click", () => {
      const names = logSetNamesFromModal();
      if (names.length >= LOG_NAME_SET_LIMIT) { toast(`원본 이름은 최대 ${LOG_NAME_SET_LIMIT}개까지 추가할 수 있어요`); return; }
      names.push(""); renderLogSetNames(names); updateCount(); updateConflict();
      const inputs = $("logSetNames").querySelectorAll(".log-set-name"); if (inputs.length) inputs[inputs.length - 1].focus();
    });
    $("logSetCancel").addEventListener("click",closeModal);
    $("logSetSave").addEventListener("click", async () => {
      const replacement = $("logSetReplacement").value.trim();
      const names = logSetNamesFromModal();
      const conflicts = updateConflict();
      if (conflicts.length) {
        toast("다른 세트에 등록된 원본 이름은 중복 저장할 수 없어요");
        const first = $("logSetNames").querySelector(".log-set-name"); if (first) first.focus();
        return;
      }
      if (names.length && !replacement) { toast("바꿀 이름을 입력해 주세요"); $("logSetReplacement").focus(); return; }
      await saveLogNameSet(safeIndex, { names, replacement, design: logSetSelectedDesign() });
    });
    // 미리보기 문구는 모든 디자인에서 고정하므로, 이름 입력 중에는 선택 상태를 다시 그릴 필요가 없습니다.
    setTimeout(() => $("logSetReplacement").focus(), 80);
  }
  function renderLog() {
    const n = getNote(st.curNoteId); if (!n || n.type !== "log") { back(); return; }
    n.data = normalizeLogData(n.data); const template = getLogTemplate(n);
    $("logTitle").textContent = n.title || "로그"; $("logEdit").value = n.data.content;
    renderLogRenameSets(n.data.nameSets);
    $("logTemplateName").textContent = template.name; $("logTemplateDesc").textContent = template.description || template.author || "로그 디자인";
    $("logEditView").hidden = !logEditMode; $("logPreviewView").hidden = logEditMode;
    $("logModeLabel").textContent = logEditMode ? "원본 텍스트 편집 중" : "정규식 디자인 보기 중";
    $("logViewToggle").title = logEditMode ? "꾸며진 로그 보기" : "원본 텍스트 편집";
    $("logViewIcon").innerHTML = logEditMode ? '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>' : '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>';
    if (!logEditMode) renderLogPreview(n); setLogSaver(""); queueDraftRecovery(n, "log");
  }
  async function saveLog(n, silent) {
    if (!n) return; n.data = normalizeLogData(n.data); n.updatedAt = now(); await put("notes", n);
    const project = getProject(n.projectId); if (project) await saveProject(project);
    if (!silent) setLogSaver("saved"); triggerAutoBackup();
  }
  function scheduleLogSave() {
    const n = getNote(st.curNoteId); if (!n || n.type !== "log") return;
    writeDraft(n, "log", logDraftFromEditor(n)); setLogSaver("dirty"); clearTimeout(logTimer); const id = n.id;
    logTimer = setTimeout(() => { if (st.curNoteId === id) void flushLog(); }, 550);
  }
  async function flushLog() {
    clearTimeout(logTimer); logTimer = null; const n = getNote(st.curNoteId); if (!n || n.type !== "log") return;
    const draft = logDraftFromEditor(n); n.data = normalizeLogData(Object.assign({}, n.data || {}, draft));
    if (!n.titleLocked) { n.title = deriveLogTitle(n.data.content); $("logTitle").textContent = n.title; }
    await saveLog(n); clearDraftIfSynced(n, "log", n.data);
  }
  async function toggleLogView() { await flushLog(); logEditMode = !logEditMode; renderLog(); }
  let logPreviewEditSwitching = false;
  let logPreviewLastTapAt = 0;
  async function enterLogEditFromPreview() {
    if (logEditMode || logPreviewEditSwitching) return;
    logPreviewEditSwitching = true;
    try {
      await toggleLogView();
      setTimeout(() => { const editor = $("logEdit"); if (editor) editor.focus(); }, 40);
    } finally {
      setTimeout(() => { logPreviewEditSwitching = false; }, 180);
    }
  }
  async function applyLogMask() {
    await flushLog(); const n = getNote(st.curNoteId); if (!n) return;
    logEditMode = false; renderLog();
    const count = logNameSetCount(n.data.nameSets);
    toast(count ? `${count}개 원본 이름을 세트 규칙으로 바꿔 표시했어요` : "이름 바꾸기 세트가 비어 있어요");
  }
  async function selectLogTemplate(template) {
    const n = getNote(st.curNoteId); if (!n || n.type !== "log") return;
    const isBuiltIn = builtInLogTemplates().some((item) => item.id === template.id);
    n.data.templateId = template.id; n.data.templateSnapshot = isBuiltIn ? null : template; await saveLog(n, true); closeModal(); renderLog(); toast("로그 템플릿을 적용했어요");
  }
  function toggleLogTemplateFavorite(id) {
    const favorites = readLogTemplateFavorites(), adding = !favorites.has(id);
    if (adding) favorites.add(id); else favorites.delete(id);
    if (!writeLogTemplateFavorites(favorites)) return;
    drawLogTemplatePicker();
    toast(adding ? "즐겨찾기에 고정했어요" : "즐겨찾기에서 해제했어요");
  }
  function bindLogTemplatePress(button, template) {
    let timer = null, held = false, startX = 0, startY = 0;
    const cancel = () => { clearTimeout(timer); timer = null; };
    const hold = () => { if (held) return; held = true; cancel(); toggleLogTemplateFavorite(template.id); };
    button.addEventListener("pointerdown", (event) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      held = false; startX = event.clientX; startY = event.clientY; cancel();
      timer = setTimeout(hold, 560);
    });
    button.addEventListener("pointermove", (event) => {
      if (Math.abs(event.clientX - startX) > 10 || Math.abs(event.clientY - startY) > 10) cancel();
    });
    ["pointerup", "pointercancel", "pointerleave"].forEach((name) => button.addEventListener(name, cancel));
    button.addEventListener("contextmenu", (event) => { event.preventDefault(); hold(); });
    button.addEventListener("click", (event) => {
      if (held) { event.preventDefault(); event.stopPropagation(); held = false; return; }
      void selectLogTemplate(template);
    });
  }
  function drawLogTemplatePicker() {
    const listBox = $("logTemplateList"), n = getNote(st.curNoteId);
    if (!listBox || !n || n.type !== "log") return;
    const builtIns = builtInLogTemplates(), builtInIds = new Set(builtIns.map((template) => template.id));
    const customIds = new Set(readCustomLogTemplates().map((template) => template.id));
    const all = allLogTemplates(n), custom = all.filter((template) => !builtInIds.has(template.id));
    const favorites = readLogTemplateFavorites();
    const counts = { builtin: builtIns.length, custom: custom.length, favorite: all.filter((template) => favorites.has(template.id)).length };
    $("modalBox").querySelectorAll("[data-log-tab]").forEach((button) => {
      const tab = button.dataset.logTab; button.classList.toggle("active", tab === logTemplateTab);
      button.setAttribute("aria-selected", tab === logTemplateTab ? "true" : "false");
      const count = button.querySelector("small"); if (count) count.textContent = counts[tab];
    });
    const source = logTemplateTab === "builtin" ? builtIns : logTemplateTab === "custom" ? custom : all.filter((template) => favorites.has(template.id));
    const query = logTemplateQuery.trim().toLocaleLowerCase("ko");
    const filtered = source.filter((template) => {
      if (!query) return true;
      const ruleText = (template.rules || []).map((rule) => `${rule.label || ""} ${rule.pattern || ""}`).join(" ");
      return `${template.name} ${template.description || ""} ${template.author || ""} ${template.id} ${ruleText}`.toLocaleLowerCase("ko").includes(query);
    }).sort((a, b) => {
      const favoriteOrder = Number(favorites.has(b.id)) - Number(favorites.has(a.id));
      if (favoriteOrder && logTemplateTab !== "favorite") return favoriteOrder;
      const order = a.name.localeCompare(b.name, "ko", { sensitivity: "base" });
      return logTemplateSortAsc ? order : -order;
    });
    const sortButton = $("logTemplateSort"); if (sortButton) sortButton.textContent = logTemplateSortAsc ? "이름순 ↑" : "이름순 ↓";
    listBox.innerHTML = filtered.length ? filtered.map((template) => {
      const favorite = favorites.has(template.id);
      return `<div class="log-template-item${template.id === n.data.templateId ? " active" : ""}${favorite ? " favorite" : ""}"><button class="log-template-main" data-log-template="${esc(template.id)}"><span class="log-template-title"><b>${esc(template.name)}</b>${favorite ? '<span class="log-favorite-star" aria-label="즐겨찾기">★</span>' : ""}</span><small>${esc(template.description || template.author || template.id)}</small></button>${customIds.has(template.id) ? `<button class="log-template-del" data-log-delete="${esc(template.id)}" aria-label="사용자 템플릿 삭제">×</button>` : ""}</div>`;
    }).join("") : `<div class="log-template-empty">${query ? "검색 결과가 없어요." : logTemplateTab === "favorite" ? "템플릿을 길게 눌러 즐겨찾기에 고정해 보세요." : "이 탭에 표시할 템플릿이 없어요."}</div>`;
    listBox.querySelectorAll("[data-log-template]").forEach((button) => {
      const template = filtered.find((item) => item.id === button.dataset.logTemplate); if (template) bindLogTemplatePress(button, template);
    });
    listBox.querySelectorAll("[data-log-delete]").forEach((button) => button.addEventListener("click", (event) => {
      event.preventDefault(); event.stopPropagation(); const id = button.dataset.logDelete;
      confirmModal("사용자 템플릿 삭제", "이 템플릿을 목록에서 삭제할까요? 이미 적용된 메모에는 백업 사본이 유지됩니다.", "삭제", true, async () => {
        writeCustomLogTemplates(readCustomLogTemplates().filter((item) => item.id !== id));
        const savedFavorites = readLogTemplateFavorites(); savedFavorites.delete(id); writeLogTemplateFavorites(savedFavorites);
        const current = getNote(st.curNoteId); if (current && current.data.templateId === id && !current.data.templateSnapshot) { current.data.templateId = "system-ink-frame"; await saveLog(current, true); }
        showLogTemplatePicker();
      });
    }));
  }
  function showLogTemplatePicker() {
    const n = getNote(st.curNoteId); if (!n || n.type !== "log") return;
    logTemplateTab = "builtin"; logTemplateQuery = ""; logTemplateSortAsc = true;
    openModal(`<div class="log-template-manager"><h3>로그 디자인 템플릿</h3><p class="m-sub">템플릿을 길게 누르면 즐겨찾기 상단에 고정됩니다.</p><div class="log-template-tabs" role="tablist" aria-label="템플릿 구분"><button data-log-tab="builtin" role="tab">기본 <small></small></button><button data-log-tab="custom" role="tab">사용자 <small></small></button><button data-log-tab="favorite" role="tab">즐겨찾기 <small></small></button></div><div class="log-template-tools"><input class="m-input" id="logTemplateSearch" type="search" autocomplete="off" placeholder="템플릿 제목·내용 검색" value="${esc(logTemplateQuery)}"><button class="m-btn" id="logTemplateSort" type="button">이름순 ↑</button></div><div class="log-template-list" id="logTemplateList"></div><div class="log-template-actions"><button class="m-btn primary" id="logTemplateUpload">JSON 템플릿 업로드</button><a class="m-btn" href="./lumink-log-template-guide.md" download>제작 가이드 받기</a><a class="m-btn log-template-gallery-link" href="./lumink-log-templates-100.html" target="_blank" rel="noopener">100종 소개 보기</a></div><div class="m-row"><button class="m-btn" id="logTemplateClose">닫기</button></div></div>`);
    $("modalBox").classList.add("log-template-modal");
    $("modalScrim").classList.add("log-template-open");
    const galleryLink = $("modalBox").querySelector(".log-template-gallery-link");
    if (galleryLink) { galleryLink.removeAttribute("target"); galleryLink.removeAttribute("rel"); }
    $("modalBox").querySelectorAll("[data-log-tab]").forEach((button) => button.addEventListener("click", () => { logTemplateTab = button.dataset.logTab; drawLogTemplatePicker(); }));
    $("logTemplateSearch").addEventListener("input", (event) => { logTemplateQuery = event.target.value; drawLogTemplatePicker(); });
    $on("logTemplateSort", "click", () => { logTemplateSortAsc = !logTemplateSortAsc; drawLogTemplatePicker(); });
    $on("logTemplateUpload", "click", () => $("logTemplateInput").click()); $on("logTemplateClose", "click", closeModal);
    drawLogTemplatePicker();
  }
  function importLogTemplateFile(file) {
    if (!file || file.size > 200 * 1024) { toast("템플릿은 200KB 이하 JSON만 사용할 수 있어요"); return; }
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const template = normalizeLogTemplate(JSON.parse(String(reader.result || "")));
        const builtInIds = new Set(builtInLogTemplates().map((item) => item.id));
        if (builtInIds.has(template.id)) throw new Error("기본 템플릿과 다른 id를 사용해 주세요");
        const list = readCustomLogTemplates().filter((item) => item.id !== template.id); list.unshift(template);
        if (!writeCustomLogTemplates(list)) return;
        await selectLogTemplate(template);
      } catch (e) { toast((e && e.message) || "템플릿 JSON을 읽지 못했어요", 3200); }
    };
    reader.onerror = () => toast("템플릿 파일을 읽지 못했어요"); reader.readAsText(file, "UTF-8");
  }
  async function copyLogInlineHtml(id) {
    if (st.curNoteId === id) await flushLog();
    const n = getNote(id); if (!n || n.type !== "log") return;
    clipboardCopy(renderLogInlineHtml(n)).then((ok) => toast(ok ? "인라인 HTML 코드를 복사했어요" : "복사하지 못했어요"));
  }
  async function exportLogHtml(id) {
    if (st.curNoteId === id) await flushLog();
    const n = getNote(id); if (!n || n.type !== "log") return;
    const payload = JSON.stringify({ app: "lumink", kind: "log", title: n.title, data: normalizeLogData(n.data) }).replace(/</g, "\\u003c");
    const doc = `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="generator" content="Lumink"><meta name="lumink-kind" content="log"><title>${esc(n.title || "로그")}</title></head><body style="margin:0;padding:24px;background:#f4f5f8">${renderLogInlineHtml(n)}<script type="application/json" id="lumink-log">${payload}<\/script></body></html>`;
    downloadDoc(doc, `${((n.title || "log").replace(/[\\/:*?"<>|]+/g, "_").slice(0, 50) || "log")}.html`, "text/html"); toast("꾸며진 로그 HTML을 저장했어요");
  }

  const LOG_IMAGE_EXPORT_SIZES = [
    { width: 520, name: "좁은 인용글", desc: "520px · 모바일 게시판과 짧은 인용 박스" },
    { width: 680, name: "기본 게시판", desc: "680px · 일반 게시글용 권장 폭", recommended: true },
    { width: 840, name: "넓은 게시글", desc: "840px · 데스크톱 게시판과 긴 문단" }
  ];
  function logImageFileStem(value) {
    return (String(value || "log").replace(/[\\/:*?"<>|]+/g, "_").trim().slice(0, 80) || "log");
  }
  function downloadLogBlob(blob, name) {
    const url = URL.createObjectURL(blob), a = document.createElement("a");
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1600);
  }
  async function waitForLogPngAssets(root) {
    const waits = [];
    if (document.fonts && document.fonts.ready) waits.push(document.fonts.ready.catch(() => {}));
    (root ? root.querySelectorAll("img") : []).forEach((img) => {
      if (img.complete && img.naturalWidth) return;
      waits.push(new Promise((resolve) => { img.addEventListener("load", resolve, { once:true }); img.addEventListener("error", resolve, { once:true }); }));
    });
    await Promise.all(waits);
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  }
  function logPngCaptureScale(width, height) {
    const desired = 2;
    const maxSide = 8192;
    const maxPixels = 30000000;
    const bySide = maxSide / Math.max(1, width, height);
    const byPixels = Math.sqrt(maxPixels / Math.max(1, width * height));
    return Math.min(desired, bySide, byPixels);
  }
  async function exportLogPng(id, requestedWidth) {
    if (st.curNoteId === id) await flushLog();
    const n = getNote(id); if (!n || n.type !== "log") return;
    if (!(n.data && String(n.data.content || "").trim())) { toast("이미지로 저장할 로그 원문을 입력해 주세요"); return; }
    if (typeof window.html2canvas !== "function") { toast("PNG 캡처 도구를 불러오지 못했어요. 새로고침 후 다시 시도해 주세요."); return; }

    const width = Math.max(400, Math.min(960, Math.round(Number(requestedWidth) || 680)));
    const safePadding = 34;
    const host = document.createElement("div");
    host.className = "lumink-log-png-capture";
    host.setAttribute("aria-hidden", "true");
    host.style.cssText = `position:fixed;left:-100000px;top:0;width:${width + safePadding * 2}px;box-sizing:border-box;padding:${safePadding}px;overflow:visible;pointer-events:none;z-index:-1;background:transparent;contain:layout paint style;`;
    const wrap = document.createElement("div");
    wrap.innerHTML = renderLogInlineHtml(n);
    const card = wrap.firstElementChild;
    if (!card) { toast("꾸며진 로그를 준비하지 못했어요"); return; }
    card.style.width = `${width}px`;
    card.style.maxWidth = "none";
    card.style.margin = "0";
    card.style.boxSizing = "border-box";
    host.appendChild(card);
    document.body.appendChild(host);

    try {
      toast("꾸며진 로그 PNG를 준비하고 있어요");
      await waitForLogPngAssets(host);
      const box = host.getBoundingClientRect();
      const captureWidth = Math.max(1, Math.ceil(Math.max(host.scrollWidth, box.width)));
      const captureHeight = Math.max(1, Math.ceil(Math.max(host.scrollHeight, box.height)));
      const scale = logPngCaptureScale(captureWidth, captureHeight);
      if (!(scale >= 0.5)) throw new Error("로그가 너무 길어 한 장 PNG로 만들 수 없어요");
      const bitmap = await captureHtml2CanvasSafe(host, {
        backgroundColor: null,
        scale,
        logging: false,
        useCORS: true,
        allowTaint: false,
        width: captureWidth,
        height: captureHeight,
        windowWidth: captureWidth,
        windowHeight: captureHeight,
        scrollX: 0,
        scrollY: 0,
        onclone: (doc, el) => {
          const root = el || doc.body;
          try { normalizeCloneColorFns(root); } catch (e) {}
          try { rasterizeRepeatingGradients(root); } catch (e) {}
          try { stripInsetShadows(root); } catch (e) {}
        }
      });
      const png = await new Promise((resolve) => bitmap.toBlob(resolve, "image/png"));
      if (!png) throw new Error("png encode failed");
      downloadLogBlob(png, `${logImageFileStem(n.title)}-${width}px.png`);
      const quality = scale >= 1.85 ? "2배 해상도" : `${Math.round(scale * 100)}% 해상도`;
      toast(`꾸며진 로그 PNG를 저장했어요 · ${width}px · ${quality}`);
    } catch (e) {
      console.warn("log png export", e);
      const message = (e && e.message) || "PNG 저장에 실패했어요";
      toast(message.includes("너무 길어") ? `${message}. 로그를 나누거나 HTML로 저장해 주세요.` : "PNG 저장에 실패했어요. 글꼴 또는 템플릿을 다시 불러온 뒤 재시도해 주세요.", 3600);
    } finally {
      host.remove();
    }
  }
  function openLogImageExportPicker(id) {
    const n = getNote(id); if (!n || n.type !== "log") return;
    let selected = 680;
    const rows = LOG_IMAGE_EXPORT_SIZES.map((item) => `<button type="button" class="log-image-export-option${item.width === selected ? " is-selected" : ""}" data-log-image-width="${item.width}" aria-pressed="${item.width === selected ? "true" : "false"}"><span class="log-image-export-symbol">▣</span><span><b>${esc(item.name)}</b><small>${esc(item.desc)}</small></span>${item.recommended ? '<em>추천</em>' : ""}</button>`).join("");
    openModal(`<div class="log-image-export-modal"><h3>꾸며진 로그 PNG 저장</h3><p class="m-sub">앱 상단바와 편집 도구는 제외하고, 현재 템플릿이 적용된 로그 본문만 PNG로 저장합니다. 폭을 고르면 해당 반응형 폭으로 다시 배치해 캡처합니다.</p><div class="log-image-export-options" role="group" aria-label="PNG 저장 폭">${rows}</div><div class="log-image-export-note"><span>✦</span><span>기본은 2배 해상도로 저장합니다. 아주 긴 로그는 한 장 제한 안에서 자동으로 해상도가 낮아질 수 있어요.</span></div><div class="m-row"><button class="m-btn" id="logImageExportCancel">취소</button><button class="m-btn primary" id="logImageExportSave">PNG 저장</button></div></div>`);
    const draw = () => {
      $("modalBox").querySelectorAll("[data-log-image-width]").forEach((button) => {
        const on = Number(button.dataset.logImageWidth) === selected;
        button.classList.toggle("is-selected", on);
        button.setAttribute("aria-pressed", on ? "true" : "false");
      });
    };
    $("modalBox").querySelectorAll("[data-log-image-width]").forEach((button) => button.addEventListener("click", () => { selected = Number(button.dataset.logImageWidth) || 680; draw(); }));
    $("logImageExportCancel").addEventListener("click", closeModal);
    $("logImageExportSave").addEventListener("click", async () => {
      const button = $("logImageExportSave");
      if (button) { button.disabled = true; button.textContent = "PNG 준비 중…"; }
      closeModal();
      await exportLogPng(id, selected);
    });
  }

  function openLogSheet(n) {
    openSheet(n.title, [
      { icon: IC.pin, label: n.pinned ? "고정 해제" : "상단 고정", fn: () => togglePinNote(n.id) },
      { icon: IC.rename, label: "이름 바꾸기", fn: () => renameModal("로그 이름", n.title, async (value) => { if (value) { n.title = value; n.titleLocked = true; await saveLog(n, true); render(); } }) },
      { icon: IC.color, label: "색상 지정", fn: () => showChipPicker(n.id) },
      { icon: IC.icon, label: "디자인 템플릿", fn: showLogTemplatePicker },
      { icon: IC.copy, label: "인라인 HTML 코드 복사", fn: () => void copyLogInlineHtml(n.id) },
      { icon: IC.save, label: "꾸며진 HTML 파일로 저장", fn: () => void exportLogHtml(n.id) },
      { icon: IC.icon, label: "꾸며진 PNG 이미지로 저장", fn: () => openLogImageExportPicker(n.id) },
      { icon: IC.move, label: "다른 프로젝트로 이동", fn: () => pickTargetProject(n.projectId, (pid) => moveNote(n.id, pid).then(render)) },
      { icon: IC.copy, label: "선택 위치로 복제", fn: () => pickTargetProject(n.projectId, (pid) => duplicateNote(n.id, pid).then(render)) },
      { icon: IC.del, label: "삭제", danger: true, fn: () => confirmModal("로그 삭제", `'${n.title}'를 삭제할까요?`, "삭제", true, async () => { await deleteNote(n.id); back(); }) }
    ]);
  }

  /* ---------- persona ---------- */
  const PER_X = '<svg viewBox="0 0 24 24"><path d="M5 5l14 14M19 5L5 19"/></svg>';
  const PER_PH_PT = '<div class="per-ph"><svg viewBox="0 0 24 24"><rect x="4" y="3" width="16" height="18" rx="3"/><circle cx="9" cy="9" r="1.8"/><path d="M20 15l-5-4L6 19"/></svg><span>포트레이트 — 탭하여 추가</span></div>';
  const PER_PH_SQ = '<div class="per-ph sm"><svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="9" r="1.8"/><path d="M21 16l-5-5L5 21"/></svg></div>';
  let perTimer = null, perImgTarget = null, perLang = "ko";

  function perEnsureTags(o) { if (!o.tags) o.tags = o.brief ? [o.brief] : []; delete o.brief; return o.tags; }
  function perTagsPreview(d) {
    const k = (d.ko && (d.ko.tags || (d.ko.brief ? [d.ko.brief] : []))) || [];
    const e = (d.en && (d.en.tags || (d.en.brief ? [d.en.brief] : []))) || [];
    const t = k.length ? k : e;
    return t.length ? t.join(", ") : "페르소나";
  }
  function setPerSaver(mode) {
    const s = $("perSaver"); s.className = "saver " + mode;
    $("perSaverText").textContent = mode === "dirty" ? "기록 중" : mode === "saved" ? "저장됨" : "";
    if (mode === "saved") setTimeout(() => { if (s.classList.contains("saved")) { s.className = "saver"; $("perSaverText").textContent = ""; } }, 1500);
  }
  function renderPersona() {
    const n = getNote(st.curNoteId); if (!n || n.type !== "persona") { back(); return; }
    const d = n.data = n.data || {};
    d.ko = d.ko || { name: "", detail: "" }; d.en = d.en || { name: "", detail: "" }; d.gallery = d.gallery || [];
    perEnsureTags(d.ko); perEnsureTags(d.en);
    $("perTitle").textContent = n.title || "페르소나";
    document.body.classList.toggle("per-view-on", !st.perEdit);
    $("perReadView").hidden = st.perEdit;
    $("perViewIcon").innerHTML = st.perEdit
      ? '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>'
      : '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>';
    $("perViewToggle").title = st.perEdit ? "보기 모드로" : "편집 모드로";
    setPerLang(perLang || "ko");
    if (st.perEdit) renderPerEdit(n); else renderPerRead(n);
    setPerSaver(""); updatePerTokens(n);
    queueDraftRecovery(n, "persona");
  }
  function setPerLang(lang) {
    perLang = lang;
    document.querySelectorAll("#screen-persona .per-tab").forEach((t) => t.classList.toggle("active", t.dataset.lang === lang));
    $("perFormKo").hidden = lang !== "ko"; $("perFormEn").hidden = lang !== "en";
    if (!st.perEdit) { const n = getNote(st.curNoteId); if (n && n.type === "persona") renderPerRead(n); }
  }
  function renderPerEdit(n) {
    const d = n.data;
    $("perKoName").value = d.ko.name || ""; $("perKoDetail").value = d.ko.detail || "";
    $("perEnName").value = d.en.name || ""; $("perEnDetail").value = d.en.detail || "";
    renderPerImagesEdit(n);
    renderPerTags(n, "ko"); renderPerTags(n, "en");
    renderPerGallery(n);
  }
  function renderPerImagesEdit(n) {
    const d = n.data;
    $("perPortrait").innerHTML = d.portrait ? `<img src="${d.portrait}" alt=""><button class="per-del" aria-label="삭제">${PER_X}</button>` : PER_PH_PT;
    $("perSquare").innerHTML = d.square ? `<img src="${d.square}" alt=""><button class="per-del" aria-label="삭제">${PER_X}</button>` : PER_PH_SQ;
    const pt = $("perPortrait").querySelector(".per-del"); if (pt) pt.addEventListener("click", (e) => { e.stopPropagation(); removePerImage("portrait"); });
    const sq = $("perSquare").querySelector(".per-del"); if (sq) sq.addEventListener("click", (e) => { e.stopPropagation(); removePerImage("square"); });
  }
  function renderPerTags(n, lang) {
    const wrap = lang === "ko" ? $("perKoTags") : $("perEnTags");
    const input = lang === "ko" ? $("perKoTagInput") : $("perEnTagInput");
    wrap.querySelectorAll(".kw-chip").forEach((c) => c.remove());
    const tags = (n.data[lang] && n.data[lang].tags) || [];
    tags.forEach((t, idx) => {
      const chip = document.createElement("span"); chip.className = "kw-chip";
      chip.innerHTML = `<span>${esc(t)}</span><button aria-label="삭제">×</button>`;
      chip.querySelector("button").addEventListener("click", () => { n.data[lang].tags.splice(idx, 1); savePersona(n, true); renderPerTags(n, lang); });
      wrap.insertBefore(chip, input);
    });
  }
  function addPerTag(lang) {
    const input = lang === "ko" ? $("perKoTagInput") : $("perEnTagInput");
    const raw = input.value.trim(); if (!raw) return;
    const n = getNote(st.curNoteId); if (!n) return;
    n.data[lang].tags = n.data[lang].tags || [];
    raw.split(",").map((s) => s.trim()).filter(Boolean).forEach((t) => { if (!n.data[lang].tags.includes(t)) n.data[lang].tags.push(t); });
    input.value = ""; savePersona(n, true); renderPerTags(n, lang);
  }
  function renderPerGallery(n) {
    const wrap = $("perGallery"), g = (n.data && n.data.gallery) || [];
    wrap.innerHTML = "";
    g.forEach((src, idx) => {
      const it = document.createElement("div"); it.className = "pg-item"; it.dataset.idx = idx;
      it.innerHTML = `<img src="${src}" alt="" draggable="false"><button class="pg-del" aria-label="삭제">${PER_X}</button>`;
      it.querySelector(".pg-del").addEventListener("click", async (e) => {
        e.stopPropagation(); const removed = n.data.gallery.splice(idx, 1)[0];
        await savePersona(n, true); renderPerGallery(n);
        const token = uid(); undoToken = token; if (undoTimer) clearTimeout(undoTimer);
        toastAction("갤러리 이미지를 삭제했어요", "되돌리기", async () => {
          if (undoToken !== token) return; undoToken = null; if (undoTimer) clearTimeout(undoTimer);
          const cur = getNote(n.id); if (!cur || cur.type !== "persona") return;
          cur.data.gallery = cur.data.gallery || []; cur.data.gallery.splice(Math.min(idx, cur.data.gallery.length), 0, removed);
          await savePersona(cur, true); renderPerGallery(cur); toast("삭제를 되돌렸어요");
        }, 6000);
        undoTimer = setTimeout(() => { if (undoToken === token) undoToken = null; }, 6200);
      });
      attachGalleryDrag(it, n);
      wrap.appendChild(it);
    });
    const add = document.createElement("div"); add.className = "pg-add"; add.innerHTML = '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>';
    add.addEventListener("click", () => { perImgTarget = "gallery"; $("perImgInput").click(); });
    wrap.appendChild(add);
  }
  function attachGalleryDrag(it, n) {
    let timer = null, dragging = false, overIdx = null, sx = 0, sy = 0;
    const clearDrop = () => $("perGallery").querySelectorAll(".pg-item.drop-target").forEach((x) => x.classList.remove("drop-target"));
    const onDocMove = (e) => {
      if (!dragging) return;
      e.preventDefault();
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const tgt = el && el.closest && el.closest(".pg-item");
      clearDrop();
      if (tgt && tgt !== it && tgt.dataset.idx != null) { tgt.classList.add("drop-target"); overIdx = +tgt.dataset.idx; } else overIdx = null;
    };
    const finish = () => {
      clearTimeout(timer); timer = null;
      document.removeEventListener("pointermove", onDocMove);
      document.removeEventListener("pointerup", onDocUp);
      document.removeEventListener("pointercancel", onDocUp);
      if (!dragging) return;
      dragging = false; it.style.pointerEvents = ""; it.classList.remove("dragging"); clearDrop();
      const from = +it.dataset.idx;
      if (overIdx != null && overIdx !== from) { const arr = n.data.gallery; const [m] = arr.splice(from, 1); arr.splice(overIdx, 0, m); savePersona(n, true); }
      overIdx = null; renderPerGallery(n);
    };
    const onDocUp = () => finish();
    it.addEventListener("pointerdown", (e) => {
      if (e.target.closest(".pg-del")) return;
      sx = e.clientX; sy = e.clientY;
      timer = setTimeout(() => {
        dragging = true; overIdx = null; it.classList.add("dragging"); it.style.pointerEvents = "none";
        document.addEventListener("pointermove", onDocMove, { passive: false });
        document.addEventListener("pointerup", onDocUp);
        document.addEventListener("pointercancel", onDocUp);
      }, 300);
    });
    it.addEventListener("pointermove", (e) => { if (!dragging && timer && (Math.abs(e.clientX - sx) > 10 || Math.abs(e.clientY - sy) > 10)) { clearTimeout(timer); timer = null; } });
    it.addEventListener("pointerup", () => { if (!dragging) { clearTimeout(timer); timer = null; } });
    it.addEventListener("pointercancel", () => { if (!dragging) { clearTimeout(timer); timer = null; } });
  }
  async function addGalleryFiles(files) {
    const n = getNote(st.curNoteId); if (!n) return;
    n.data.gallery = n.data.gallery || [];
    let added = 0, rejected = 0;
    for (const f of files) { try { n.data.gallery.push(await fileToResized(f, 1600)); added++; } catch (e) { rejected++; } }
    if (added) { await savePersona(n, true); renderPerGallery(n); toast(rejected ? `${added}장 추가 · ${rejected}장 제외` : `${added}장 추가했어요`); }
    else toast(imageLimitText());
  }
  function personaDetailHTML(text) {
    const cleaned = String(text || "").replace(/<user\b[^>]*>/gi, "").replace(/<\/user>/gi, "");
    const lines = cleaned.split(/\r?\n/);
    let html = "";
    lines.forEach((ln) => {
      const m = ln.match(/^\s*(#{1,6})\s*(.+?)\s*$/);
      if (m) { const lvl = Math.min(m[1].length, 3); html += `<div class="pr-head pr-h${lvl}">${esc(m[2])}</div>`; return; }
      const mini = ln.match(/^\s*-\s*([^:：]+)[:：]\s*(.*)$/);
      if (mini) { html += `<div class="pr-mini"><span class="pr-mini-key">${esc(mini[1].trim())}</span>${esc(mini[2])}</div>`; return; }
      const li = ln.match(/^\s*-\s*(.+?)\s*$/);
      if (li) { html += `<div class="pr-li"><span class="pr-bullet">▶</span><span>${esc(li[1])}</span></div>`; return; }
      if (ln.trim() === "") html += '<div class="pr-gap"></div>';
      else html += `<div class="pr-line">${esc(ln)}</div>`;
    });
    return html.trim() ? html : '<span class="pr-empty">(상세 설명 없음)</span>';
  }
  function renderPerRead(n) {
    const d = n.data, o = d[perLang] || {};
    $("perRPortrait").innerHTML = d.portrait ? `<img src="${d.portrait}" alt="">` : '<div class="per-ph"><svg viewBox="0 0 24 24"><rect x="4" y="3" width="16" height="18" rx="3"/><circle cx="9" cy="9" r="1.8"/><path d="M20 15l-5-4L6 19"/></svg><span>이미지 없음</span></div>';
    $("perRPortrait").onclick = d.portrait ? () => openLightbox(d.portrait, [d.portrait], 0) : null;
    const sqSrc = d.square || d.portrait;
    $("perRSquare").innerHTML = `<img src="${sqSrc || DEFAULT_ICON}" alt="">`;
    $("perRSquare").onclick = sqSrc ? () => openLightbox(sqSrc, [sqSrc], 0) : null;
    $("perRName").textContent = o.name || "";
    const rt = $("perRTags"); rt.innerHTML = "";
    (o.tags || []).forEach((t) => { const c = document.createElement("span"); c.className = "kw-chip"; c.textContent = t; rt.appendChild(c); });
    $("perRDetail").innerHTML = personaDetailHTML(o.detail);
    const tokEl = $("perRTok"); tokEl.textContent = "계산 중…";
    ensureTokenizer().then((ok) => {
      if (getNote(st.curNoteId) !== n || st.perEdit) return;
      if (ok && window.__luminkCountTokens) tokEl.innerHTML = `<b>${window.__luminkCountTokens(o.detail || "")}</b> ${perLang === "en" ? "tokens" : "토큰"}`;
      else tokEl.textContent = "계산 불가";
    });
    const rg = $("perRGallery"); rg.innerHTML = "";
    const gal = d.gallery || [];
    if (!gal.length) { rg.innerHTML = '<div style="grid-column:1/-1;color:var(--faint);font-size:13px">이미지 없음</div>'; }
    else gal.forEach((src, idx) => { const it = document.createElement("div"); it.className = "pg-item"; it.innerHTML = `<img src="${src}" alt="">`; it.onclick = () => openLightbox(src, gal, idx); rg.appendChild(it); });
  }
  async function savePersona(n, silent) { n.updatedAt = now(); await put("notes", n); const p = getProject(n.projectId); if (p) await saveProject(p); if (!silent) setPerSaver("saved"); triggerAutoBackup(); }
  function schedulePerSave() {
    const n = getNote(st.curNoteId); if (n && n.type === "persona" && st.perEdit) writeDraft(n, "persona", personaDraftFromEditor(n));
    setPerSaver("dirty"); clearTimeout(perTimer); const id = st.curNoteId; perTimer = setTimeout(() => { if (st.curNoteId === id) flushPersona(); }, 550);
  }
  async function flushPersona() {
    clearTimeout(perTimer); perTimer = null;
    const n = getNote(st.curNoteId); if (!n || n.type !== "persona" || !st.perEdit) return;
    const draft = personaDraftFromEditor(n), d = n.data;
    d.ko.name = draft.ko.name; d.ko.detail = draft.ko.detail;
    d.en.name = draft.en.name; d.en.detail = draft.en.detail;
    if (!n.titleLocked) { n.title = (d.ko.name.trim() || d.en.name.trim() || "이름 없는 페르소나"); $("perTitle").textContent = n.title; }
    await savePersona(n);
    clearDraftIfSynced(n, "persona", draft);
    updatePerTokens(n);
  }
  function updatePerTokens(n) {
    const ko = (n.data && n.data.ko && n.data.ko.detail) || "", en = (n.data && n.data.en && n.data.en.detail) || "";
    $("perKoTok").textContent = "계산 중…"; $("perEnTok").textContent = "계산 중…";
    ensureTokenizer().then((ok) => {
      if (getNote(st.curNoteId) !== n) return;
      if (ok && window.__luminkCountTokens) {
        $("perKoTok").innerHTML = `<b>${window.__luminkCountTokens(ko)}</b> 토큰`;
        $("perEnTok").innerHTML = `<b>${window.__luminkCountTokens(en)}</b> tokens`;
      } else { $("perKoTok").textContent = "계산 불가"; $("perEnTok").textContent = "계산 불가"; }
    });
  }
  function applyPerImage(file) {
    const n = getNote(st.curNoteId); if (!n || !perImgTarget) return;
    if (!/^image\//.test(file.type)) { toast("이미지 파일만 넣을 수 있어요"); return; }
    if (perImgTarget === "gallery") {
      fileToResized(file, 1600).then((data) => { n.data.gallery = n.data.gallery || []; n.data.gallery.push(data); savePersona(n, true); renderPerGallery(n); toast("이미지를 추가했어요"); }).catch((e) => toast((e && e.message) || "이미지를 넣지 못했어요"));
      return;
    }
    const isPt = perImgTarget === "portrait", target = perImgTarget;
    startCrop(file, isPt ? 3 / 4 : 1, isPt ? 1200 : 1080, isPt ? 1600 : 1080, (data) => {
      const nn = getNote(st.curNoteId); if (!nn) return;
      nn.data[target] = data; savePersona(nn, true); renderPerImagesEdit(nn); toast("이미지를 적용했어요");
    });
  }
  async function removePerImage(k) {
    const n = getNote(st.curNoteId); if (!n) return;
    n.data[k] = null; await savePersona(n, true); renderPerImagesEdit(n);
  }
  function togglePerView() {
    if (st.perEdit) { flushPersona(); st.perEdit = false; } else { st.perEdit = true; }
    renderPersona();
  }
  let lightboxItems = [], lightboxIndex = 0;
  function closeLightbox() {
    $("lightbox").hidden = true;
    $("lightboxImg").removeAttribute("src");
    lightboxItems = []; lightboxIndex = 0;
  }
  function preloadLightboxNeighbors() {
    [-1, 1].forEach((delta) => { const src = lightboxItems[lightboxIndex + delta]; if (src) { const img = new Image(); img.src = src; } });
  }
  function renderLightboxImage() {
    const img = $("lightboxImg");
    const total = lightboxItems.length;
    const src = lightboxItems[lightboxIndex];
    if (!src) { closeLightbox(); return; }
    img.src = src;
    preloadLightboxNeighbors();
    img.alt = total > 1 ? `갤러리 이미지 ${lightboxIndex + 1} / ${total}` : "확대 이미지";
    const multi = total > 1;
    const prev = $("lbPrev"), next = $("lbNext"), counter = $("lbCounter");
    prev.hidden = !multi; next.hidden = !multi; counter.hidden = !multi;
    prev.disabled = lightboxIndex <= 0;
    next.disabled = lightboxIndex >= total - 1;
    counter.textContent = `${lightboxIndex + 1} / ${total}`;
  }
  function openLightbox(src, items, index) {
    if (!src) return;
    const list = (Array.isArray(items) && items.length ? items : [src]).filter(Boolean);
    if (!list.length) return;
    lightboxItems = list;
    lightboxIndex = Number.isInteger(index) && list[index] === src ? index : Math.max(0, list.indexOf(src));
    $("lightbox").hidden = false;
    renderLightboxImage();
  }
  function stepLightbox(delta) {
    if (lightboxItems.length < 2) return;
    const next = lightboxIndex + delta;
    if (next < 0 || next >= lightboxItems.length) return;
    lightboxIndex = next;
    renderLightboxImage();
  }

  // image cropper
  let cropState = null;
  function loadImg(src) { return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; }); }
  async function startCrop(file, ratio, outW, outH, cb, options) {
    let url;
    try {
      const checked = await validateImageFile(file, options);
      url = checked.url; const img = checked.img;
      const stage = $("cropStage"), cimg = $("cropImg"), zoom = $("cropZoom");
      $("cropper").hidden = false;
      const wrap = stage.parentElement;
      const availW = wrap.clientWidth, availH = wrap.clientHeight;
      let stageW = availW, stageH = stageW / ratio;
      if (stageH > availH) { stageH = availH; stageW = stageH * ratio; }
      stageW = Math.floor(stageW); stageH = Math.floor(stageH);
      stage.style.width = stageW + "px"; stage.style.height = stageH + "px";
      cimg.src = url; cimg.style.width = img.naturalWidth + "px"; cimg.style.height = img.naturalHeight + "px";
      const baseScale = Math.max(stageW / img.naturalWidth, stageH / img.naturalHeight);
      cropState = { img, url, stageW, stageH, iw: img.naturalWidth, ih: img.naturalHeight, baseScale, zoom: 1, tx: 0, ty: 0, outW, outH, cb };
      zoom.value = 1; centerCrop(); applyCropTransform();
    } catch (e) { toast((e && e.message) || "이미지를 불러오지 못했어요"); if (url) URL.revokeObjectURL(url); }
  }
  function centerCrop() { const s = cropState, sc = s.baseScale * s.zoom; s.tx = (s.stageW - s.iw * sc) / 2; s.ty = (s.stageH - s.ih * sc) / 2; clampCrop(); }
  function clampCrop() { const s = cropState, sc = s.baseScale * s.zoom; s.tx = Math.min(0, Math.max(s.stageW - s.iw * sc, s.tx)); s.ty = Math.min(0, Math.max(s.stageH - s.ih * sc, s.ty)); }
  function applyCropTransform() { const s = cropState; $("cropImg").style.transform = `translate(${s.tx}px,${s.ty}px) scale(${s.baseScale * s.zoom})`; }
  function setCropZoom(v) {
    const s = cropState; if (!s) return;
    const old = s.zoom; s.zoom = parseFloat(v);
    const cx = s.stageW / 2, cy = s.stageH / 2, r = (s.baseScale * s.zoom) / (s.baseScale * old);
    s.tx = cx - (cx - s.tx) * r; s.ty = cy - (cy - s.ty) * r;
    clampCrop(); applyCropTransform();
  }
  function closeCropper() { $("cropper").hidden = true; if (cropState && cropState.url) URL.revokeObjectURL(cropState.url); cropState = null; }
  function commitCrop() {
    const s = cropState; if (!s) return;
    const sc = s.baseScale * s.zoom;
    const sx = -s.tx / sc, sy = -s.ty / sc, sw = s.stageW / sc, sh = s.stageH / sc;
    const cv = document.createElement("canvas"); cv.width = s.outW; cv.height = s.outH;
    const ctx = cv.getContext("2d");
    ctx.drawImage(s.img, sx, sy, sw, sh, 0, 0, s.outW, s.outH);
    const data = cv.toDataURL("image/jpeg", 0.92);
    const cb = s.cb; closeCropper(); cb(data);
  }
  function openPersonaSheet(n) {
    openSheet(n.title, [
      { icon: IC.pin, label: n.pinned ? "고정 해제" : "상단 고정", fn: () => togglePinNote(n.id) },
      { icon: IC.rename, label: "이름 바꾸기", fn: () => renameModal("페르소나 이름", n.title, async (v) => { if (v) { n.title = v; n.titleLocked = true; await savePersona(n, true); render(); } }) },
      { icon: IC.color, label: "색상 지정", fn: () => showChipPicker(n.id) },
      { icon: IC.save, label: "HTML로 저장", fn: () => choosePersonaExportTheme(n.id) },
      { icon: IC.move, label: "다른 프로젝트로 이동", fn: () => pickTargetProject(n.projectId, (pid) => moveNote(n.id, pid).then(render)) },
      { icon: IC.copy, label: "선택 위치로 복제", fn: () => pickTargetProject(n.projectId, (pid) => duplicateNote(n.id, pid).then(render)) },
      { icon: IC.del, label: "삭제", danger: true, fn: () => confirmModal("페르소나 삭제", `'${n.title}'를 삭제할까요?`, "삭제", true, async () => { await deleteNote(n.id); back(); }) }
    ]);
  }


  /* ---------- character memo ---------- */
  let charTimer = null, charImgTarget = null, charLang = "ko", creatorCodeMode = false;
  function normalizeCreatorMemo(value) {
    const raw = String(value || "");
    if (!raw.trim()) return "";
    // v46의 일반 텍스트 메모는 줄바꿈을 보존해 리치 HTML로 부드럽게 마이그레이션합니다.
    const source = /<\/?[a-z][^>]*>/i.test(raw) ? raw : esc(raw).replace(/\r?\n/g, "<br>");
    return sanitize(source).html;
  }
  function creatorMemoPreview(html) {
    const text = plainText(normalizeCreatorMemo(html)).replace(/\s+/g, " ").trim();
    if (!text) return "";
    return text.length > 150 ? text.slice(0, 150) + "…" : text;
  }
  function makeCharacterPage() {
    return { id: uid(), portrait: null, square: null, gallery: [], creatorMemo: "", ko: { name: "", tags: [], detail: "" }, en: { name: "", tags: [], detail: "" } };
  }
  function ensureCharacterPage(page) {
    const p = page && typeof page === "object" ? page : makeCharacterPage();
    if (!p.id) p.id = uid();
    p.portrait = typeof p.portrait === "string" ? p.portrait : null;
    p.square = typeof p.square === "string" ? p.square : null;
    p.gallery = Array.isArray(p.gallery) ? p.gallery.filter((x) => typeof x === "string") : [];
    p.creatorMemo = normalizeCreatorMemo(p.creatorMemo);
    ["ko", "en"].forEach((lang) => {
      p[lang] = p[lang] && typeof p[lang] === "object" ? p[lang] : {};
      p[lang].name = String(p[lang].name || "");
      p[lang].detail = String(p[lang].detail || "");
      p[lang].tags = Array.isArray(p[lang].tags) ? p[lang].tags.map(String).filter(Boolean) : (p[lang].brief ? [String(p[lang].brief)] : []);
      delete p[lang].brief;
    });
    return p;
  }
  function ensureCharacterData(n) {
    const d = n.data = n.data && typeof n.data === "object" ? n.data : {};
    // v62 이전 캐릭터 메모는 모두 다인 모음으로 해석합니다.
    d.mode = d.mode === "single" ? "single" : "collection";
    d.cardTypeVersion = 2;
    d.pages = Array.isArray(d.pages) && d.pages.length ? d.pages.map(ensureCharacterPage) : [makeCharacterPage()];
    if (!d.activeId || !d.pages.some((p) => p.id === d.activeId)) d.activeId = d.pages[0].id;
    // 대표 썸네일은 캐릭터 메모의 프로젝트 목록용 표지입니다.
    // 기존 데이터는 자동 대표(첫 페이지 이미지)로 자연스럽게 폴백합니다.
    d.coverImage = safeImageSource(d.coverImage) || null;
    return d;
  }
  function legacyPersonaDataToCharacterData(raw, preserveLocal) {
    const source = raw && typeof raw === "object" ? raw : {};
    // 기존 앱 안의 레코드는 길이 제한 없이 원문을 옮기고, 외부 가져오기만 입력 정규화를 적용합니다.
    const normalized = preserveLocal ? (() => {
      const lang = (value) => {
        const o = value && typeof value === "object" ? value : {};
        const tags = Array.isArray(o.tags) ? o.tags.map(String).filter(Boolean) : (o.brief ? [String(o.brief)] : []);
        return { name: String(o.name || ""), detail: String(o.detail || ""), tags };
      };
      return {
        portrait: typeof source.portrait === "string" ? source.portrait : null,
        square: typeof source.square === "string" ? source.square : null,
        gallery: Array.isArray(source.gallery) ? source.gallery.filter((x) => typeof x === "string") : [],
        ko: lang(source.ko), en: lang(source.en)
      };
    })() : normalizeImportedPersonaData(source);
    const page = ensureCharacterPage({
      id: uid(), portrait: normalized.portrait, square: normalized.square, gallery: normalized.gallery,
      ko: normalized.ko, en: normalized.en, creatorMemo: source.creatorMemo || ""
    });
    // 과거/외부 백업의 확장 필드는 버리지 않고 별도로 보존합니다.
    const known = new Set(["portrait", "square", "gallery", "ko", "en", "creatorMemo", "coverImage", "activeId", "pages", "mode"]);
    const extras = {};
    Object.keys(source).forEach((key) => { if (!known.has(key)) extras[key] = jsonCopy(source[key]) ?? source[key]; });
    // 이전 스키마의 brief 같은 언어별 보조 필드도 조용히 버리지 않습니다.
    const langExtras = {};
    ["ko", "en"].forEach((lang) => {
      const original = source[lang] && typeof source[lang] === "object" ? source[lang] : {};
      const keep = {};
      Object.keys(original).forEach((key) => { if (!["name", "detail", "tags"].includes(key)) keep[key] = jsonCopy(original[key]) ?? original[key]; });
      if (Object.keys(keep).length) langExtras[lang] = keep;
    });
    const data = { mode: "single", activeId: page.id, coverImage: safeImageSource(source.coverImage) || null, pages: [page], legacySourceType: "persona", cardTypeVersion: 2 };
    if (Object.keys(extras).length) data.legacyPersonaExtras = extras;
    if (Object.keys(langExtras).length) data.legacyPersonaLangExtras = langExtras;
    return data;
  }
  function migratePersonaDraftToCharacter(n) {
    try {
      const key = draftKey(n), raw = localStorage.getItem(key); if (!raw) return;
      const draft = JSON.parse(raw); if (!draft || draft.type !== "persona" || !draft.data) return;
      const snapshot = characterTextSnapshot(n, false), page = snapshot.pages[0];
      if (!page) return;
      const ko = draft.data.ko || {}, en = draft.data.en || {};
      page.ko.name = String(ko.name || page.ko.name || ""); page.ko.detail = String(ko.detail || page.ko.detail || "");
      page.en.name = String(en.name || page.en.name || ""); page.en.detail = String(en.detail || page.en.detail || "");
      draft.type = "character"; draft.data = snapshot;
      localStorage.setItem(key, JSON.stringify(draft));
    } catch (e) { /* 초안 전환 실패는 원본 초안을 훼손하지 않음 */ }
  }
  function characterCoverImage(n) {
    const d = ensureCharacterData(n);
    if (d.coverImage) return d.coverImage;
    const first = d.pages[0] || activeCharacterPage(n);
    return (first && (first.square || first.portrait || (first.gallery && first.gallery[0]))) || DEFAULT_ICON;
  }
  function activeCharacterPage(n) {
    const d = ensureCharacterData(n);
    return d.pages.find((p) => p.id === d.activeId) || d.pages[0];
  }
  function charPageName(page, lang) {
    const a = page && page[lang] ? page[lang].name : "";
    const b = page && page[lang === "ko" ? "en" : "ko"] ? page[lang === "ko" ? "en" : "ko"].name : "";
    return (a || b || "이름 없는 캐릭터").trim();
  }
  function syncCharacterTitle(n) {
    if (!n || n.titleLocked) return;
    const d = ensureCharacterData(n), first = d.pages[0];
    const base = charPageName(first, "ko");
    const empty = n.type === "persona" ? "이름 없는 페르소나" : "이름 없는 캐릭터";
    n.title = d.mode === "single" ? (base === "이름 없는 캐릭터" ? empty : base) : (d.pages.length > 1 ? `${base} 외 ${d.pages.length - 1}명` : base);
    const title = $("charTitle"); if (title) title.textContent = n.title;
  }
  function characterTextSnapshot(n, fromEditor) {
    const d = ensureCharacterData(n);
    const copy = { activeId: d.activeId, pages: d.pages.map((p) => ({ id: p.id, ko: { name: p.ko.name, tags: p.ko.tags.slice(), detail: p.ko.detail }, en: { name: p.en.name, tags: p.en.tags.slice(), detail: p.en.detail }, creatorMemo: p.creatorMemo })) };
    if (fromEditor && st.charEdit) {
      const page = copy.pages.find((p) => p.id === d.activeId) || copy.pages[0];
      if (page) {
        page.ko.name = $("charKoName").value; page.ko.detail = $("charKoDetail").value;
        page.en.name = $("charEnName").value; page.en.detail = $("charEnDetail").value;
        page.creatorMemo = getCreatorMemoHtml();
      }
    }
    return copy;
  }
  function setCharSaver(mode) {
    const s = $("charSaver"); if (!s) return;
    s.className = "saver " + mode;
    $("charSaverText").textContent = mode === "dirty" ? "기록 중" : mode === "saved" ? "저장됨" : "";
    if (mode === "saved") setTimeout(() => { if (s.classList.contains("saved")) { s.className = "saver"; $("charSaverText").textContent = ""; } }, 1500);
  }
  async function saveCharacter(n, silent) {
    if (!n) return;
    n.updatedAt = now(); await put("notes", n);
    const p = getProject(n.projectId); if (p) await saveProject(p);
    if (!silent) setCharSaver("saved");
    triggerAutoBackup();
  }
  function updateCharTokens(n) {
    const page = activeCharacterPage(n), ko = page.ko.detail || "", en = page.en.detail || "";
    $("charKoTok").textContent = "계산 중…"; $("charEnTok").textContent = "계산 중…";
    ensureTokenizer().then((ok) => {
      if (getNote(st.curNoteId) !== n || curView().s !== "character") return;
      if (ok && window.__luminkCountTokens) {
        $("charKoTok").innerHTML = `<b>${window.__luminkCountTokens(ko)}</b> 토큰`;
        $("charEnTok").innerHTML = `<b>${window.__luminkCountTokens(en)}</b> tokens`;
      } else { $("charKoTok").textContent = "계산 불가"; $("charEnTok").textContent = "계산 불가"; }
    });
  }
  function renderCharNav(n, read) {
    const d = ensureCharacterData(n), wrap = $(read ? "charRNav" : "charNav");
    wrap.innerHTML = ""; wrap.hidden = d.mode === "single" || d.pages.length < 2;
    d.pages.forEach((page) => {
      const b = document.createElement("button"); b.className = "char-nav-card" + (page.id === d.activeId ? " active" : "");
      const src = page.square || page.portrait || DEFAULT_ICON;
      b.innerHTML = `<span class="char-nav-thumb"><img src="${src}" alt=""></span><span class="char-nav-name">${esc(charPageName(page, charLang))}</span>`;
      b.title = charPageName(page, charLang);
      b.addEventListener("click", () => switchCharacterPage(page.id));
      wrap.appendChild(b);
    });
    const add = $(read ? "charRAddPage" : "charAddPage"); if (add) add.title = "새 캐릭터 페이지 추가";
    $("charPageCount").textContent = d.mode === "single" ? (n.type === "persona" ? "페르소나" : "캐릭터") : `${n.type === "persona" ? "페르소나" : "캐릭터"} ${d.pages.findIndex((p) => p.id === d.activeId) + 1} / ${d.pages.length}`;
  }
  function renderCharTags(n, lang) {
    const page = activeCharacterPage(n), wrap = $(lang === "ko" ? "charKoTags" : "charEnTags"), input = $(lang === "ko" ? "charKoTagInput" : "charEnTagInput");
    wrap.querySelectorAll(".kw-chip").forEach((x) => x.remove());
    page[lang].tags.forEach((tag, idx) => {
      const chip = document.createElement("span"); chip.className = "kw-chip";
      chip.innerHTML = `<span>${esc(tag)}</span><button aria-label="삭제">×</button>`;
      chip.querySelector("button").addEventListener("click", async () => {
        page[lang].tags.splice(idx, 1); await saveCharacter(n, true); renderCharTags(n, lang);
      });
      wrap.insertBefore(chip, input);
    });
  }
  function renderCharImagesEdit(n) {
    const page = activeCharacterPage(n), portrait = $("charPortrait"), square = $("charSquare"), squareEn = $("charSquareEn");
    portrait.innerHTML = page.portrait ? `<img src="${page.portrait}" alt=""><button class="per-del" aria-label="삭제">${PER_X}</button>` : PER_PH_PT;
    square.innerHTML = page.square ? `<img src="${page.square}" alt=""><button class="per-del" aria-label="삭제">${PER_X}</button>` : PER_PH_SQ;
    squareEn.innerHTML = page.square || page.portrait ? `<img src="${page.square || page.portrait}" alt="">` : PER_PH_SQ;
    const pd = portrait.querySelector(".per-del"), sd = square.querySelector(".per-del");
    if (pd) pd.addEventListener("click", (e) => { e.stopPropagation(); removeCharImage("portrait"); });
    if (sd) sd.addEventListener("click", (e) => { e.stopPropagation(); removeCharImage("square"); });
  }
  function renderCharGallery(n, read) {
    const page = activeCharacterPage(n), pageId = page.id, wrap = $(read ? "charRGallery" : "charGallery"), gal = page.gallery || [];
    wrap.innerHTML = "";
    if (read && !gal.length) { wrap.innerHTML = '<div style="grid-column:1/-1;color:var(--faint);font-size:13px">이미지 없음</div>'; return; }
    gal.forEach((src, idx) => {
      const it = document.createElement("div"); it.className = "pg-item"; it.innerHTML = `<img src="${src}" alt="">`;
      if (read) it.addEventListener("click", () => openLightbox(src, gal, idx));
      else {
        const delBtn = document.createElement("button"); delBtn.className = "pg-del"; delBtn.setAttribute("aria-label", "삭제"); delBtn.innerHTML = PER_X;
        delBtn.addEventListener("click", async (e) => {
          e.stopPropagation(); const removed = page.gallery.splice(idx, 1)[0]; await saveCharacter(n, true); renderCharGallery(n, false);
          const token = uid(); undoToken = token; if (undoTimer) clearTimeout(undoTimer);
          toastAction("갤러리 이미지를 삭제했어요", "되돌리기", async () => {
            if (undoToken !== token) return; undoToken = null; if (undoTimer) clearTimeout(undoTimer);
            const cur = getNote(n.id); if (!cur || !isCharacterCardType(cur)) return;
            const target = ensureCharacterData(cur).pages.find((item) => item.id === pageId); if (!target) return;
            target.gallery.splice(Math.min(idx, target.gallery.length), 0, removed);
            await saveCharacter(cur, true); renderCharacter(); toast("삭제를 되돌렸어요");
          }, 6000);
          undoTimer = setTimeout(() => { if (undoToken === token) undoToken = null; }, 6200);
        });
        it.appendChild(delBtn);
      }
      wrap.appendChild(it);
    });
    if (!read) {
      const add = document.createElement("div"); add.className = "pg-add"; add.innerHTML = '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>';
      add.addEventListener("click", () => { charImgTarget = "gallery"; $("charImgInput").click(); }); wrap.appendChild(add);
    }
  }
  function getCreatorEditor() { return $("charCreatorEditor"); }
  function creatorRange() {
    const ed = getCreatorEditor(), sel = window.getSelection();
    if (!ed || !sel || !sel.rangeCount) return null;
    const range = sel.getRangeAt(0);
    return ed.contains(range.commonAncestorContainer) ? range.cloneRange() : null;
  }
  function restoreCreatorRange(range) {
    const ed = getCreatorEditor(); if (!ed) return false;
    try { ed.focus({ preventScroll: true }); } catch (e) { ed.focus(); }
    if (!range) return false;
    const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(range); return true;
  }
  function getCreatorMemoHtml() {
    const raw = creatorCodeMode ? $("charCreatorCode").value : getCreatorEditor().innerHTML;
    return normalizeCreatorMemo(raw);
  }
  function renderCreatorEditor(html) {
    const safe = normalizeCreatorMemo(html), editor = getCreatorEditor(), code = $("charCreatorCode");
    creatorCodeMode = false;
    editor.hidden = false; code.hidden = true;
    if (editor.innerHTML !== safe) editor.innerHTML = safe;
    if (code.value !== safe) code.value = safe;
    $("charCreatorCodeToggle").classList.remove("active");
  }
  function scheduleCreatorSave() { scheduleCharSave(); }
  function creatorExec(cmd, val) {
    const ed = getCreatorEditor(); ed.focus();
    try { document.execCommand("styleWithCSS", false, true); } catch (e) {}
    document.execCommand(cmd, false, val || null); scheduleCreatorSave();
  }
  async function setCreatorCodeMode(on) {
    if (on === creatorCodeMode) return;
    if (on) $("charCreatorCode").value = getCreatorMemoHtml();
    else getCreatorEditor().innerHTML = normalizeCreatorMemo($("charCreatorCode").value);
    creatorCodeMode = on;
    getCreatorEditor().hidden = on; $("charCreatorCode").hidden = !on;
    $("charCreatorCodeToggle").classList.toggle("active", on);
    if (on) $("charCreatorCode").focus(); else getCreatorEditor().focus();
    scheduleCreatorSave();
  }
  function creatorFontStep(delta) {
    const ed = getCreatorEditor(); ed.focus();
    let size = parseInt(document.queryCommandValue("fontSize"), 10); if (!size || isNaN(size)) size = 3;
    document.execCommand("fontSize", false, String(Math.min(7, Math.max(1, size + delta)))); scheduleCreatorSave();
  }
  function openCreatorFontSizes() {
    const range = creatorRange();
    if (!range || range.collapsed) { toast("크기를 바꿀 텍스트를 선택해 주세요"); return; }
    const sizes = [["아주 작게",1,12],["작게",2,14],["보통",3,16],["크게",4,19],["더 크게",5,23],["제목",6,28],["대제목",7,34]];
    openModal(`<h3>글자 크기</h3><div class="size-list">${sizes.map(([name,value,px]) => `<div class="size-item creator-size" data-v="${value}" style="font-size:${px}px">${name}</div>`).join("")}</div><div class="m-row"><button class="m-btn" id="creatorSizeClose">닫기</button></div>`);
    $("modalBox").querySelectorAll(".creator-size").forEach((item) => item.addEventListener("click", () => {
      closeModal(); restoreCreatorRange(range); document.execCommand("fontSize", false, item.dataset.v); scheduleCreatorSave();
    }));
    $on("creatorSizeClose", "click", closeModal);
  }
  function openCreatorColorEditor() {
    const range = creatorRange();
    if (!range || range.collapsed) { toast("색을 바꿀 텍스트를 선택해 주세요"); return; }
    let current = colorCur;
    try { current = localStorage.getItem("luminkLastColor") || current; } catch (e) {}
    openModal(`<h3>글자 색</h3><p class="m-sub">정사각형 색상판과 HEX·RGB 입력을 함께 사용할 수 있어요.</p>${colorStudioMarkup("cc", { saved:true, save:true })}<div class="m-row"><button class="m-btn" id="ccCancel">취소</button><button class="m-btn primary" id="ccApply">적용</button></div>`);
    const studio = bindColorStudio("cc", current, { saved:true, save:true });
    $on("ccCancel", "click", closeModal);
    $on("ccApply", "click", () => { const color = studio.current; try { localStorage.setItem("luminkLastColor", color); } catch (e) {} closeModal(); restoreCreatorRange(range); document.execCommand("styleWithCSS", false, true); document.execCommand("foreColor", false, color); $("charCreatorColorSwatch").style.background = color; scheduleCreatorSave(); });
  }

  function toggleCreatorHilite(color, savedRange, forceColor) {
    const range = savedRange || creatorRange();
    if (!range || range.collapsed) { toast("형광펜을 칠할 텍스트를 선택해 주세요"); return; }
    restoreCreatorRange(range);
    const sel = window.getSelection(), active = sel && sel.rangeCount ? sel.getRangeAt(0) : range;
    let start = active.startContainer, end = active.endContainer;
    if (start.nodeType === 3) start = start.parentElement; if (end.nodeType === 3) end = end.parentElement;
    const existing = start && start.closest && start.closest("span.lumi-hl");
    if (existing && end && existing.contains(end)) {
      if (forceColor) { existing.style.backgroundColor = color || getHiliteColor(); existing.style.color = "#222"; }
      else unwrapHighlight(existing);
      scheduleCreatorSave(); return;
    }
    try {
      const mark = document.createElement("span"); mark.className = "lumi-hl"; mark.style.backgroundColor = color || getHiliteColor(); mark.style.color = "#222"; mark.style.borderRadius = "3px"; mark.style.padding = "0 1px";
      active.surroundContents(mark); sel.removeAllRanges();
    } catch (e) { try { document.execCommand("styleWithCSS", false, true); document.execCommand("hiliteColor", false, color || getHiliteColor()); } catch (e2) {} }
    scheduleCreatorSave();
  }
  function openCreatorHilitePicker(range) {
    const current = getHiliteColor();
    openModal(`<h3>형광펜 색상</h3><p class="m-sub">색을 고르면 현재 선택한 텍스트에 바로 적용돼요.</p><div class="hilite-picker">${HILITE_COLORS.map((x) => `<button class="hilite-choice${x.value === current ? " sel" : ""}" data-color="${x.value}" aria-label="${x.label}"><span class="hilite-swatch" style="background:${x.value}"></span><span>${x.label}</span></button>`).join("")}</div><div class="m-row"><button class="m-btn" id="creatorHiliteCancel">취소</button></div>`);
    $("modalBox").querySelectorAll(".hilite-choice").forEach((btn) => btn.addEventListener("click", () => { const color = btn.dataset.color; setHiliteColor(color); $("charCreatorHiliteBtn").style.setProperty("--hilite-color", color); closeModal(); if (range && !range.collapsed) toggleCreatorHilite(color, range, true); else toast(`${HILITE_COLORS.find((x) => x.value === color).label}으로 바꿨어요`); }));
    $on("creatorHiliteCancel", "click", closeModal);
  }
  function bindCreatorHiliteButton() {
    const btn = $("charCreatorHiliteBtn"); if (!btn) return;
    let timer = null, held = false, saved = null, pointerId = null;
    const clear = () => { clearTimeout(timer); timer = null; };
    const reset = () => { clear(); held = false; saved = null; pointerId = null; btn.classList.remove("holding"); };
    btn.addEventListener("pointerdown", (e) => { if (e.button != null && e.button !== 0) return; e.preventDefault(); saved = creatorRange(); pointerId = e.pointerId; held = false; btn.classList.add("holding"); try { btn.setPointerCapture(pointerId); } catch (x) {} timer = setTimeout(() => { timer = null; held = true; btn.classList.remove("holding"); if (navigator.vibrate) navigator.vibrate(12); openCreatorHilitePicker(saved); }, 480); });
    btn.addEventListener("pointerup", (e) => { if (pointerId != null && e.pointerId !== pointerId) return; const wasHeld = held, range = saved; reset(); if (!wasHeld) toggleCreatorHilite(getHiliteColor(), range, false); });
    btn.addEventListener("pointercancel", reset); btn.addEventListener("lostpointercapture", () => { if (!held) clear(); }); btn.addEventListener("contextmenu", (e) => e.preventDefault());
  }
  async function insertCreatorImage(file) {
    if (!/^image\//.test(file.type)) { toast("이미지 파일만 넣을 수 있어요"); return; }
    try { const data = await fileToResized(file, 1280); getCreatorEditor().focus(); document.execCommand("insertHTML", false, `<img src="${data}" style="max-width:100%;border-radius:6px"><br>`); scheduleCreatorSave(); }
    catch (e) { toast((e && e.message) || "이미지를 넣지 못했어요"); }
  }
  function wrapCreatorCodeBlock() { getCreatorEditor().focus(); try { document.execCommand("formatBlock", false, "pre"); } catch (e) {} scheduleCreatorSave(); }
  function eraseCreatorFormatting() {
    const ed = getCreatorEditor(); ed.focus(); const sel = window.getSelection(), range = sel && sel.rangeCount ? sel.getRangeAt(0) : null;
    if (range && !range.collapsed) [...ed.querySelectorAll("pre, code")].forEach((el) => { if (range.intersectsNode(el)) el.replaceWith(document.createTextNode(el.textContent)); });
    try { document.execCommand("styleWithCSS", false, true); } catch (e) {} document.execCommand("removeFormat", false, null); document.execCommand("unlink", false, null); scheduleCreatorSave();
  }
  function showCreatorAlignMenu() {
    const range = creatorRange();
    const items = [["justifyLeft","왼쪽 정렬","M4 6h16M4 12h10M4 18h13"],["justifyCenter","가운데 정렬","M4 6h16M7 12h10M5 18h14"],["justifyRight","오른쪽 정렬","M4 6h16M10 12h10M7 18h13"]];
    openModal(`<h3>정렬</h3><div class="size-list">${items.map(([cmd,name,path]) => `<div class="size-item creator-align" data-c="${cmd}"><svg viewBox="0 0 24 24" style="width:20px;height:20px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;vertical-align:-4px;margin-right:10px"><path d="${path}"/></svg>${name}</div>`).join("")}</div><div class="m-row"><button class="m-btn" id="creatorAlignClose">닫기</button></div>`);
    $("modalBox").querySelectorAll(".creator-align").forEach((item) => item.addEventListener("click", () => { closeModal(); restoreCreatorRange(range); document.execCommand(item.dataset.c, false, null); scheduleCreatorSave(); }));
    $on("creatorAlignClose", "click", closeModal);
  }
  function insertCreatorLink() {
    const range = creatorRange();
    if (!range || range.collapsed) { toast("링크를 걸 텍스트를 먼저 선택해 주세요"); return; }
    openModal(`<h3>링크 삽입</h3><div class="m-field-label">연결할 주소</div><input class="m-input" id="creatorLinkUrl" placeholder="https://…" inputmode="url" autocapitalize="off" autocorrect="off"><div class="m-row"><button class="m-btn" id="creatorLinkCancel">취소</button><button class="m-btn primary" id="creatorLinkOk">삽입</button></div>`);
    setTimeout(() => $("creatorLinkUrl").focus(), 120);
    $on("creatorLinkCancel", "click", closeModal);
    $on("creatorLinkOk", "click", () => { let url = $("creatorLinkUrl").value.trim(); if (!url) return; if (!/^https?:\/\//i.test(url)) url = "https://" + url; closeModal(); restoreCreatorRange(range); document.execCommand("createLink", false, url); normalizeLinks(getCreatorEditor()); scheduleCreatorSave(); });
  }
  function creatorLinkifyBeforeCaret() {
    try {
      const ed = getCreatorEditor(), sel = window.getSelection();
      if (!ed || !sel || !sel.rangeCount || !sel.isCollapsed) return;
      const r = sel.getRangeAt(0), node = r.startContainer;
      if (!ed.contains(node) || node.nodeType !== 3 || (node.parentElement && node.parentElement.closest("a"))) return;
      const caret = r.startOffset, before = node.textContent.slice(0, caret), m = before.match(/(https?:\/\/[^\s]+)(\s)$/);
      if (!m) return;
      const url = m[1], start = caret - m[0].length, end = start + url.length;
      const rng = document.createRange(); rng.setStart(node, start); rng.setEnd(node, end);
      const a = document.createElement("a"); a.href = url; a.className = "lumi-link"; a.target = "_blank"; a.rel = "noopener noreferrer";
      rng.surroundContents(a);
      const after = a.nextSibling, sel2 = window.getSelection(), c = document.createRange();
      if (after && after.nodeType === 3) c.setStart(after, Math.min(1, after.textContent.length)); else c.setStartAfter(a);
      c.collapse(true); sel2.removeAllRanges(); sel2.addRange(c); scheduleCreatorSave();
    } catch (e) {}
  }
  function onCreatorPaste(e) {
    const text = ((e.clipboardData || window.clipboardData) || {}).getData ? (e.clipboardData || window.clipboardData).getData("text") : "";
    const url = (text || "").trim(), ed = getCreatorEditor();
    if (!url || !/^https?:\/\/[^\s]+$/i.test(url) || !ed) return;
    e.preventDefault();
    const sel = window.getSelection();
    if (sel && sel.rangeCount && !sel.isCollapsed) document.execCommand("createLink", false, url);
    else document.execCommand("insertHTML", false, `<a href="${url.replace(/"/g, "%22")}">${esc(url)}</a>&nbsp;`);
    normalizeLinks(ed); scheduleCreatorSave();
  }

  function openCreatorMemoModal() {
    const n = getNote(st.curNoteId); if (!n || !isCharacterCardType(n)) return;
    const html = normalizeCreatorMemo(activeCharacterPage(n).creatorMemo); if (!html) return;
    openModal(`<h3>크리에이터 메모</h3><div class="creator-modal-body read-body">${html}</div><div class="m-row"><button class="m-btn primary" type="button" data-creator-modal-close>닫기</button></div>`);
    const box = $("modalBox");
    // 닫기는 부가 기능보다 먼저 연결합니다. 코드 블록 복사 버튼 생성이 실패해도
    // 팝업이 갇히지 않도록 이 핸들러는 독립적으로 유지합니다.
    const closeButton = box && box.querySelector("[data-creator-modal-close]");
    if (closeButton) closeButton.addEventListener("click", (event) => {
      event.preventDefault(); event.stopPropagation(); closeModal();
    });
    // 기존 호출명은 존재하지 않는 함수여서 ReferenceError가 발생했고, 그 결과 위 닫기
    // 핸들러까지 등록되지 않았습니다. 실제 공용 헬퍼를 사용하고, 보조 기능 오류는 격리합니다.
    try { addCodeCopyButtons(box); } catch (error) { console.warn("creator note code-copy", error); }
  }

  function renderCharacterEdit(n) {
    const page = activeCharacterPage(n);
    $("charKoName").value = page.ko.name || ""; $("charKoDetail").value = page.ko.detail || "";
    $("charEnName").value = page.en.name || ""; $("charEnDetail").value = page.en.detail || "";
    renderCreatorEditor(page.creatorMemo);
    const hilite = $("charCreatorHiliteBtn"); if (hilite) hilite.style.setProperty("--hilite-color", getHiliteColor());
    renderCharImagesEdit(n); renderCharTags(n, "ko"); renderCharTags(n, "en"); renderCharGallery(n, false);
  }
  function renderCharacterRead(n) {
    const page = activeCharacterPage(n), o = page[charLang] || {};
    $("charRPortrait").innerHTML = page.portrait ? `<img src="${page.portrait}" alt="">` : '<div class="per-ph"><svg viewBox="0 0 24 24"><rect x="4" y="3" width="16" height="18" rx="3"/><circle cx="9" cy="9" r="1.8"/><path d="M20 15l-5-4L6 19"/></svg><span>이미지 없음</span></div>';
    $("charRPortrait").onclick = page.portrait ? () => openLightbox(page.portrait, [page.portrait], 0) : null;
    const sq = page.square || page.portrait;
    $("charRSquare").innerHTML = `<img src="${sq || DEFAULT_ICON}" alt="">`;
    $("charRSquare").onclick = sq ? () => openLightbox(sq, [sq], 0) : null;
    $("charRName").textContent = o.name || "";
    const tags = $("charRTags"); tags.innerHTML = ""; (o.tags || []).forEach((tag) => { const chip = document.createElement("span"); chip.className = "kw-chip"; chip.textContent = tag; tags.appendChild(chip); });
    $("charRDetail").innerHTML = personaDetailHTML(o.detail);
    const creator = $("charRCreator"), creatorHtml = normalizeCreatorMemo(page.creatorMemo);
    creator.hidden = !creatorHtml.trim();
    const token = $("charRTok"); token.textContent = "계산 중…";
    ensureTokenizer().then((ok) => {
      if (getNote(st.curNoteId) !== n || st.charEdit) return;
      if (ok && window.__luminkCountTokens) token.innerHTML = `<b>${window.__luminkCountTokens(o.detail || "")}</b> ${charLang === "en" ? "tokens" : "토큰"}`;
      else token.textContent = "계산 불가";
    });
    renderCharGallery(n, true);
    const d = ensureCharacterData(n), sw = $("charPageSwitch"), index = d.pages.findIndex((p) => p.id === d.activeId);
    sw.hidden = d.mode === "single" || d.pages.length < 2;
    $("charPrev").disabled = index <= 0; $("charNext").disabled = index >= d.pages.length - 1;
    $("charSwitchHint").textContent = `${index + 1} / ${d.pages.length} · 좌우로 넘기기`;
  }
  function setCharLang(lang) {
    charLang = lang;
    document.querySelectorAll("#screen-character [data-char-lang]").forEach((b) => b.classList.toggle("active", b.dataset.charLang === lang));
    $("charFormKo").hidden = lang !== "ko"; $("charFormEn").hidden = lang !== "en";
    const n = getNote(st.curNoteId); if (n && isCharacterCardType(n)) { renderCharNav(n, false); renderCharNav(n, true); if (!st.charEdit) renderCharacterRead(n); }
  }
  function renderCharacter() {
    const n = getNote(st.curNoteId); if (!n || !isCharacterCardType(n)) { back(); return; }
    const data = ensureCharacterData(n); syncCharacterTitle(n);
    const single = data.mode === "single";
    document.body.classList.toggle("char-single-mode", single);
    $("charTitle").textContent = n.title || (n.type === "persona" ? (single ? "페르소나" : "페르소나 모음") : (single ? "캐릭터" : "캐릭터 모음"));
    $("charEditView").hidden = !st.charEdit; $("charReadView").hidden = !!st.charEdit; $("charSave").hidden = !st.charEdit;
    $("charViewIcon").innerHTML = st.charEdit ? '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>' : '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>';
    $("charViewToggle").title = st.charEdit ? "보기 모드로" : "편집 모드로";
    setCharLang(charLang || "ko"); renderCharNav(n, false); renderCharNav(n, true);
    if (st.charEdit) renderCharacterEdit(n); else renderCharacterRead(n);
    setCharSaver(""); updateCharTokens(n); queueDraftRecovery(n, "character");
  }
  function scheduleCharSave() {
    const n = getNote(st.curNoteId); if (!n || !isCharacterCardType(n) || !st.charEdit) return;
    writeDraft(n, "character", characterTextSnapshot(n, true));
    setCharSaver("dirty"); clearTimeout(charTimer); const id = n.id;
    charTimer = setTimeout(() => { if (st.curNoteId === id) flushCharacter(); }, 550);
  }
  async function flushCharacter() {
    clearTimeout(charTimer); charTimer = null;
    const n = getNote(st.curNoteId); if (!n || !isCharacterCardType(n) || !st.charEdit) return;
    const page = activeCharacterPage(n);
    page.ko.name = $("charKoName").value; page.ko.detail = $("charKoDetail").value;
    page.en.name = $("charEnName").value; page.en.detail = $("charEnDetail").value;
    page.creatorMemo = getCreatorMemoHtml();
    syncCharacterTitle(n); await saveCharacter(n); clearDraftIfSynced(n, "character", characterTextSnapshot(n, false)); updateCharTokens(n);
  }
  async function addCharTag(lang) {
    const input = $(lang === "ko" ? "charKoTagInput" : "charEnTagInput"), raw = input.value.trim(); if (!raw) return;
    const n = getNote(st.curNoteId); if (!n || !isCharacterCardType(n)) return;
    const page = activeCharacterPage(n); raw.split(",").map((x) => x.trim()).filter(Boolean).forEach((tag) => { if (!page[lang].tags.includes(tag)) page[lang].tags.push(tag); });
    input.value = ""; await saveCharacter(n, true); renderCharTags(n, lang);
  }
  async function switchCharacterPage(id) {
    const n = getNote(st.curNoteId); if (!n || !isCharacterCardType(n)) return;
    const d = ensureCharacterData(n); if (!d.pages.some((p) => p.id === id) || d.activeId === id) return;
    if (st.charEdit) await flushCharacter(); d.activeId = id; await saveCharacter(n, true); renderCharacter();
  }
  async function stepCharacter(delta) {
    const n = getNote(st.curNoteId); if (!n || !isCharacterCardType(n)) return;
    const d = ensureCharacterData(n), index = d.pages.findIndex((p) => p.id === d.activeId), target = d.pages[index + delta];
    if (target) await switchCharacterPage(target.id);
  }
  async function setCharacterMode(n, mode) {
    if (!n || !isCharacterCardType(n)) return;
    const d = ensureCharacterData(n), next = mode === "single" ? "single" : "collection";
    const kind = n.type === "persona" ? "페르소나" : "캐릭터";
    if (next === "single" && d.pages.length > 1) { toast(`여러 페이지가 있는 메모는 단일 ${kind}로 바꿀 수 없어요`); return; }
    if (d.mode === next) return;
    d.mode = next;
    syncCharacterTitle(n); await saveCharacter(n, true);
    if (st.curNoteId === n.id) renderCharacter(); else { render(); renderSidebar(); }
    toast(next === "single" ? `단일 ${kind}로 정리했어요` : `${kind} 모음으로 확장했어요`);
  }
  async function addCharacterPage() {
    const n = getNote(st.curNoteId); if (!n || !isCharacterCardType(n)) return;
    if (st.charEdit) await flushCharacter();
    const d = ensureCharacterData(n);
    if (d.mode === "single") await setCharacterMode(n, "collection");
    const page = makeCharacterPage(); d.pages.push(page); d.activeId = page.id; st.charEdit = true; syncCharacterTitle(n); await saveCharacter(n, true); renderCharacter(); toast("새 캐릭터 페이지를 추가했어요");
  }
  async function removeActiveCharacterPage() {
    const n = getNote(st.curNoteId); if (!n || !isCharacterCardType(n)) return;
    if (st.charEdit) await flushCharacter();
    const d = ensureCharacterData(n); if (d.pages.length < 2) { toast("캐릭터 페이지는 최소 1개가 필요해요"); return; }
    const idx = d.pages.findIndex((p) => p.id === d.activeId), removed = d.pages.splice(idx, 1)[0]; d.activeId = d.pages[Math.max(0, idx - 1)].id; syncCharacterTitle(n); await saveCharacter(n, true); renderCharacter();
    const token = uid(); undoToken = token; if (undoTimer) clearTimeout(undoTimer);
    toastAction("캐릭터 페이지를 삭제했어요", "되돌리기", async () => {
      if (undoToken !== token) return; undoToken = null; if (undoTimer) clearTimeout(undoTimer);
      const cur = getNote(n.id); if (!cur || !isCharacterCardType(cur)) return; const data = ensureCharacterData(cur); data.pages.splice(Math.min(idx, data.pages.length), 0, removed); data.activeId = removed.id; syncCharacterTitle(cur); await saveCharacter(cur, true); renderCharacter(); toast("삭제를 되돌렸어요");
    }, 6000);
    undoTimer = setTimeout(() => { if (undoToken === token) undoToken = null; }, 6200);
  }
  function applyCharImage(file) {
    const n = getNote(st.curNoteId); if (!n || !isCharacterCardType(n) || !charImgTarget || !/^image\//.test(file.type)) { toast("이미지 파일만 넣을 수 있어요"); return; }
    const page = activeCharacterPage(n), pageId = page.id, target = charImgTarget;
    if (target === "gallery") {
      fileToResized(file, 1600).then(async (data) => { const cur = getNote(n.id); if (!cur) return; const p = ensureCharacterData(cur).pages.find((x) => x.id === pageId); if (!p) return; p.gallery.push(data); await saveCharacter(cur, true); renderCharGallery(cur, false); toast("이미지를 추가했어요"); }).catch((e) => toast((e && e.message) || "이미지를 넣지 못했어요"));
      return;
    }
    const isPortrait = target === "portrait";
    startCrop(file, isPortrait ? 3 / 4 : 1, isPortrait ? 1200 : 1080, isPortrait ? 1600 : 1080, async (data) => {
      const cur = getNote(n.id); if (!cur) return; const p = ensureCharacterData(cur).pages.find((x) => x.id === pageId); if (!p) return; p[target] = data; await saveCharacter(cur, true); renderCharacter(); toast("이미지를 적용했어요");
    });
  }
  async function addCharGalleryFiles(files) {
    const n = getNote(st.curNoteId); if (!n || !isCharacterCardType(n)) return;
    const page = activeCharacterPage(n); let added = 0, rejected = 0;
    for (const file of files) { try { page.gallery.push(await fileToResized(file, 1600)); added++; } catch (e) { rejected++; } }
    if (added) { await saveCharacter(n, true); renderCharGallery(n, false); toast(rejected ? `${added}장 추가 · ${rejected}장 제외` : `${added}장 추가했어요`); }
    else toast(imageLimitText());
  }
  async function removeCharImage(kind) {
    const n = getNote(st.curNoteId); if (!n || !isCharacterCardType(n)) return;
    activeCharacterPage(n)[kind] = null; await saveCharacter(n, true); renderCharImagesEdit(n);
  }
  function toggleCharView() {
    if (st.charEdit) { flushCharacter(); st.charEdit = false; } else st.charEdit = true;
    renderCharacter();
  }
  function characterCoverCandidates(n) {
    const d = ensureCharacterData(n), out = [], seen = new Set();
    const add = (src, label, uploaded) => {
      const safe = safeImageSource(src);
      if (!safe || seen.has(safe)) return;
      seen.add(safe); out.push({ src: safe, label, uploaded: !!uploaded });
    };
    // 캐릭터 페이지 이미지와 분리해서 올린 표지도 다시 열었을 때 선택 상태가 보이도록 맨 앞에 넣습니다.
    if (d.coverImage) add(d.coverImage, "직접 업로드한 대표 이미지", true);
    d.pages.forEach((page, index) => {
      const name = charPageName(page, "ko") || `캐릭터 ${index + 1}`;
      add(page.square, `${name} · 정사각 썸네일`);
      add(page.portrait, `${name} · 포트레이트`);
      (page.gallery || []).forEach((src, galleryIndex) => add(src, `${name} · 갤러리 ${galleryIndex + 1}`));
    });
    return out;
  }
  function applyUploadedCharacterCover(noteId, file) {
    if (!file || !/^image\//.test(file.type)) { toast("이미지 파일만 넣을 수 있어요"); return; }
    startCrop(file, 1, 1080, 1080, async (data) => {
      const current = getNote(noteId);
      if (!current || !isCharacterCardType(current)) return;
      const dataSet = ensureCharacterData(current);
      dataSet.coverImage = data;
      await saveCharacter(current, true);
      closeModal(); render(); renderSidebar();
      toast("새 대표 이미지를 적용했어요");
    });
  }
  async function chooseCharacterCover(n) {
    if (!n || !isCharacterCardType(n)) return;
    if (st.charEdit && st.curNoteId === n.id) await flushCharacter();
    const d = ensureCharacterData(n), candidates = characterCoverCandidates(n);
    const autoSrc = characterCoverImage(n);
    const option = (src, label, index, selected) => `<button type="button" class="char-cover-option${selected ? " selected" : ""}" data-cover-index="${index}"><span class="char-cover-media">${src ? `<img src="${src}" alt="">` : '<span class="char-cover-auto-mark">A</span>'}</span><span class="char-cover-label">${esc(label)}</span></button>`;
    const auto = option(autoSrc, "자동 선택 · 첫 캐릭터 이미지", -1, !d.coverImage);
    const cards = candidates.map((item, index) => option(item.src, item.label, index, d.coverImage === item.src)).join("");
    openModal(`
      <h3>대표 썸네일 지정</h3>
      <p class="m-sub">프로젝트 안의 캐릭터 메모 카드에 보일 이미지를 골라요. 캐릭터 페이지 이미지와 별개로 새 대표 이미지를 올릴 수도 있습니다.</p>
      <div class="char-cover-grid">${auto}${cards || '<div class="char-cover-empty">선택할 이미지가 아직 없어요. 아래 버튼으로 대표 이미지를 새로 올리거나, 캐릭터 페이지에 이미지를 추가해 주세요.</div>'}</div>
      <div class="m-row"><button class="m-btn primary" type="button" id="charCoverUpload">새 대표 이미지 업로드</button><button class="m-btn" type="button" id="charCoverClose">닫기</button></div>
    `);
    const box = $("modalBox");
    box.querySelectorAll("[data-cover-index]").forEach((button) => button.addEventListener("click", async () => {
      const index = Number(button.dataset.coverIndex);
      d.coverImage = index < 0 ? null : (candidates[index] ? candidates[index].src : null);
      await saveCharacter(n, true);
      closeModal(); render(); renderSidebar();
      toast(d.coverImage ? "대표 썸네일을 지정했어요" : "대표 썸네일을 자동 선택으로 바꿨어요");
    }));
    $on("charCoverUpload", "click", () => {
      const input = $("charCoverInput");
      if (input) { input.dataset.noteId = n.id; input.click(); }
    });
    $on("charCoverClose", "click", closeModal);
  }
  async function switchCharacterCardType(n) {
    if (!n || !isCharacterCardType(n)) return;
    if (st.charEdit && st.curNoteId === n.id) await flushCharacter();
    const nextType = n.type === "persona" ? "character" : "persona";
    n.type = nextType;
    ensureCharacterData(n).cardTypeVersion = 2;
    if (!n.titleLocked) syncCharacterTitle(n);
    await saveCharacter(n, true);
    if (st.curNoteId === n.id) renderCharacter();
    render(); renderSidebar();
    toast(nextType === "persona" ? "페르소나 타입으로 전환했어요" : "캐릭터 타입으로 전환했어요");
  }
  async function copyActiveCharacterPageAsSingle(n) {
    if (!n || !isCharacterCardType(n)) return;
    if (st.charEdit && st.curNoteId === n.id) await flushCharacter();
    const d = ensureCharacterData(n), page = activeCharacterPage(n);
    if (!page) return;
    const copy = ensureCharacterPage(jsonCopy(page) || makeCharacterPage());
    const sourcePageId = copy.id;
    copy.id = uid();
    const nn = await createNote(n.type, n.projectId, { characterMode: "single" });
    nn.data = {
      mode: "single",
      activeId: copy.id,
      coverImage: copy.square || copy.portrait || (copy.gallery && copy.gallery[0]) || null,
      pages: [copy],
      cardTypeVersion: 2,
      splitSource: { noteId: n.id, title: String(n.title || ""), pageId: sourcePageId, at: now() }
    };
    nn.chipColor = n.chipColor || null;
    nn.titleLocked = false;
    syncCharacterTitle(nn);
    await saveCharacter(nn, true);
    st.curNoteId = nn.id; st.charEdit = false;
    toast(n.type === "persona" ? "현재 페이지를 단일 페르소나로 복사했어요" : "현재 페이지를 단일 캐릭터로 복사했어요");
    go({ s: "character" });
  }
  function openCharacterSheet(n) {
    const d = ensureCharacterData(n), single = d.mode === "single";
    const baseKind = n.type === "persona" ? "페르소나" : "캐릭터";
    const kind = single ? baseKind : `${baseKind} 모음`;
    const items = [
      { icon: IC.pin, label: n.pinned ? "고정 해제" : "상단 고정", fn: () => togglePinNote(n.id) },
      { icon: IC.rename, label: "메모 이름 바꾸기", fn: () => renameModal(`${kind} 이름`, n.title, async (v) => { if (v) { n.title = v; n.titleLocked = true; await saveCharacter(n, true); render(); } }) },
      { icon: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2.5"/><circle cx="8.5" cy="9" r="1.7"/><path d="M21 16l-5-5L5 21"/></svg>', label: "대표 썸네일 지정", fn: () => chooseCharacterCover(n) },
      { icon: IC.color, label: "색상 지정", fn: () => showChipPicker(n.id) },
      { icon: IC.save, label: `${kind} HTML로 저장`, fn: async () => { if (st.charEdit) await flushCharacter(); chooseCharacterExportOptions(n.id); } }
    ];
    items.push({ icon: '<svg viewBox="0 0 24 24"><path d="M8 4h8l4 4v12H8z"/><path d="M4 8h8l4 4v8H4z"/><path d="M9 14h6M12 11v6"/></svg>', label: n.type === "persona" ? "캐릭터 타입으로 전환" : "페르소나 타입으로 전환", fn: () => switchCharacterCardType(n) });
    if (single) items.push({ icon: '<svg viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h16"/><path d="M18 16v5M15.5 18.5h5"/></svg>', label: `${baseKind} 모음으로 확장`, fn: () => setCharacterMode(n, "collection") });
    else if (d.pages.length === 1) items.push({ icon: '<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="3.5"/><path d="M5 21a7 7 0 0 1 14 0"/></svg>', label: `단일 ${baseKind}로 정리`, fn: () => setCharacterMode(n, "single") });
    if (!single && d.pages.length > 1) items.push({ icon: '<svg viewBox="0 0 24 24"><rect x="5" y="4" width="10" height="14" rx="2"/><path d="M9 8h2M9 12h2"/><path d="M15 10h4v10H9v-2"/></svg>', label: `현재 페이지를 단일 ${baseKind}로 분리 복사`, fn: () => copyActiveCharacterPageAsSingle(n) });
    if (!single && d.pages.length > 1) items.push({ icon: '<svg viewBox="0 0 24 24"><path d="M8 5h8M8 19h8M12 5v14"/><path d="M5 12h14"/></svg>', label: "현재 캐릭터 페이지 삭제", danger: true, fn: () => removeActiveCharacterPage() });
    items.push(
      { icon: IC.move, label: "다른 프로젝트로 이동", fn: () => pickTargetProject(n.projectId, (pid) => moveNote(n.id, pid).then(render)) },
      { icon: IC.copy, label: "선택 위치로 복제", fn: () => pickTargetProject(n.projectId, (pid) => duplicateNote(n.id, pid).then(render)) },
      { icon: IC.del, label: `${kind} 삭제`, danger: true, fn: () => confirmModal(`${kind} 삭제`, `'${n.title}'를 삭제할까요?`, "삭제", true, async () => { await deleteNote(n.id); back(); }) }
    );
    openSheet(n.title, items);
  }

  /* ---------- attachments ---------- */
  const MAX_ATTACH = 15 * 1024 * 1024;
  const DL_SVG = '<svg viewBox="0 0 24 24"><path d="M12 4v12M7 11l5 5 5-5"/><path d="M5 20h14"/></svg>';
  const RM_SVG = '<svg viewBox="0 0 24 24"><path d="M5 5l14 14M19 5L5 19"/></svg>';
  function fmtSize(b) { if (b < 1024) return b + " B"; if (b < 1048576) return (b / 1024).toFixed(1) + " KB"; return (b / 1048576).toFixed(1) + " MB"; }
  function fileIconSvg(type) {
    if (/^image\//.test(type)) return '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2.5"/><circle cx="8.5" cy="8.5" r="1.6"/><path d="M21 16l-5-5L5 21"/></svg>';
    if (/pdf|word|document|text|sheet|presentation/.test(type)) return '<svg viewBox="0 0 24 24"><path d="M6 2h8l5 5v15H6z"/><path d="M14 2v5h5"/><path d="M9 13h6M9 17h4"/></svg>';
    if (/zip|compress|rar|7z/.test(type)) return '<svg viewBox="0 0 24 24"><path d="M6 2h12v20H6z"/><path d="M11 4h2M11 7h2M11 10h2M10 13h4v4h-4z"/></svg>';
    if (/audio/.test(type)) return '<svg viewBox="0 0 24 24"><path d="M9 18V5l10-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="16" cy="16" r="3"/></svg>';
    if (/video/.test(type)) return '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M10 9l5 3-5 3z"/></svg>';
    return '<svg viewBox="0 0 24 24"><path d="M6 2h8l5 5v15H6z"/><path d="M14 2v5h5"/></svg>';
  }
  async function addAttachment(file) {
    const n = getNote(st.curNoteId); if (!n || n.type !== "free") return;
    if (file.size > MAX_ATTACH) { toast("15MB 이하 파일만 첨부할 수 있어요"); return; }
    const id = uid();
    try {
      await put("files", { id, noteId: n.id, name: file.name, type: file.type || "application/octet-stream", size: file.size, blob: file, createdAt: now() });
    } catch (e) { toast("첨부 저장에 실패했어요"); return; }
    n.data = n.data || {}; n.data.attachments = n.data.attachments || [];
    n.data.attachments.push({ id, name: file.name, type: file.type || "", size: file.size });
    await saveNote(n);
    renderAttachments("edAttach", n, true);
    toast("첨부했어요");
  }
  async function downloadAttachment(id) {
    try {
      const rec = await getOne("files", id); if (!rec || !rec.blob) { toast("파일을 찾을 수 없어요"); return; }
      const url = URL.createObjectURL(rec.blob), a = document.createElement("a");
      a.href = url; a.download = rec.name || "file"; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (e) { toast("다운로드에 실패했어요"); }
  }
  async function removeAttachment(id) {
    const n = getNote(st.curNoteId); if (!n) return;
    try { await del("files", id); } catch (e) {}
    n.data.attachments = (n.data.attachments || []).filter((a) => a.id !== id);
    await saveNote(n);
    renderAttachments("edAttach", n, true);
  }
  async function purgeNoteFiles(n) {
    if (!n || !n.data || !n.data.attachments) return;
    for (const a of n.data.attachments) { try { await del("files", a.id); } catch (e) {} }
  }
  function renderAttachments(cid, n, editable) {
    const wrap = $(cid); if (!wrap) return;
    const list = (n.data && n.data.attachments) || [];
    wrap.innerHTML = "";
    list.forEach((a) => {
      const card = document.createElement("div"); card.className = "attach-card";
      card.innerHTML = `<div class="ac-ico">${fileIconSvg(a.type || "")}</div><div class="ac-body"><div class="ac-name">${esc(a.name)}</div><div class="ac-size">${fmtSize(a.size)}</div></div>`;
      const dl = document.createElement("button"); dl.className = "ac-act"; dl.title = "다운로드"; dl.innerHTML = DL_SVG;
      dl.addEventListener("click", () => downloadAttachment(a.id)); card.appendChild(dl);
      if (editable) {
        const rm = document.createElement("button"); rm.className = "ac-act danger"; rm.title = "삭제"; rm.innerHTML = RM_SVG;
        rm.addEventListener("click", () => confirmModal("첨부 삭제", `'${a.name}'를 삭제할까요?`, "삭제", true, () => removeAttachment(a.id))); card.appendChild(rm);
      }
      wrap.appendChild(card);
    });
  }

  /* ---------- smart hyperlinks ---------- */
  const URL_RE = /^https?:\/\/[^\s]+$/i;
  function applyFreeMemoNoteLinkColor(link, color, textColor) {
    if (!link) return "";
    const value = normalizeIdeaColorValue(color, ideaPreferredColor());
    const ink = normalizeIdeaTextColorValue(textColor || link.dataset.lumiNoteTextColor || "auto");
    link.dataset.lumiNoteColor = value;
    link.dataset.lumiNoteTextColor = ink;
    Object.entries(ideaColorVars(value, ink)).forEach(([name, cssValue]) => link.style.setProperty(name, cssValue));
    return value;
  }
  function freeMemoNoteLinkCardInnerMarkup(note, fallbackTitle) {
    const title = String((note && note.title) || fallbackTitle || "제목 없는 메모");
    const typeLabel = note ? noteTypeShortLabel(note) : "메모 없음";
    return `<span class="idea-quote-mark" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M10 14 21 3"/><path d="M15 3h6v6"/><path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5"/></svg></span><span class="idea-quote-copy"><span class="idea-quote-eyebrow">내 메모</span><span class="idea-quote-title">${esc(title)}</span><span class="idea-quote-preview">${esc(typeLabel)}</span></span><span class="idea-quote-go" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg></span>`;
  }
  function ensureFreeMemoNoteLinkCard(link) {
    if (!link) return;
    const noteId = String(link.dataset.lumiNoteId || "").trim();
    const note = noteId ? getNote(noteId) : null;
    const fallbackTitle = String(link.dataset.lumiNoteTitle || link.textContent || "").trim();
    if (!link.querySelector(".idea-quote-copy") || !link.querySelector(".idea-quote-mark svg") || !link.querySelector(".idea-quote-go svg")) {
      link.innerHTML = freeMemoNoteLinkCardInnerMarkup(note, fallbackTitle);
    }
    if (!link.dataset.lumiNoteTitle) link.dataset.lumiNoteTitle = String((note && note.title) || fallbackTitle || "제목 없는 메모");
    if (!link.closest(".free-note-link-block") && link.parentNode) {
      const block = document.createElement("div");
      block.className = "free-note-link-block";
      link.parentNode.insertBefore(block, link);
      block.appendChild(link);
    }
  }
  function normalizeLinks(root) {
    if (!root) return;
    root.querySelectorAll("a").forEach((a) => {
      a.classList.add("lumi-link");
      const noteId = String(a.dataset.lumiNoteId || "").trim();
      if (noteId) {
        a.classList.add("lumi-note-link", "idea-quote-body");
        a.setAttribute("href", `#lumi-note-${noteId}`);
        a.removeAttribute("target"); a.removeAttribute("rel");
        const storedColor = String(a.dataset.lumiNoteColor || "").trim();
        const storedTextColor = String(a.dataset.lumiNoteTextColor || "").trim();
        if (storedColor || storedTextColor) applyFreeMemoNoteLinkColor(a, storedColor || ideaPreferredColor(), storedTextColor || "auto");
        ensureFreeMemoNoteLinkCard(a);
        return;
      }
      a.setAttribute("target", "_blank"); a.setAttribute("rel", "noopener noreferrer");
    });
  }
  function bindInternalNoteLinks(root) {
    if (!root) return;
    root.querySelectorAll("a[data-lumi-note-id]").forEach((link) => {
      if (link.dataset.lumiBound === "1") return;
      link.dataset.lumiBound = "1";
      link.addEventListener("click", (event) => {
        event.preventDefault(); event.stopPropagation();
        const targetId = String(link.dataset.lumiNoteId || "").trim();
        if (!targetId || !getNote(targetId)) { toast("연결된 메모를 찾을 수 없어요"); return; }
        void openNote(targetId);
      });
    });
  }
  function captureFreeEditorRange() {
    const editor = $("editor"), selection = window.getSelection();
    if (!editor || !selection || !selection.rangeCount) return null;
    const range = selection.getRangeAt(0);
    return editor.contains(range.commonAncestorContainer) ? range.cloneRange() : null;
  }
  function restoreFreeEditorRange(savedRange) {
    const editor = $("editor"); if (!editor) return false;
    editor.focus();
    const selection = window.getSelection(); if (!selection) return false;
    let range = savedRange;
    if (!range || !editor.contains(range.commonAncestorContainer)) {
      range = document.createRange(); range.selectNodeContents(editor); range.collapse(false);
    }
    selection.removeAllRanges(); selection.addRange(range); return true;
  }
  function insertFreeEditorMarkup(markup, savedRange) {
    if (st.codeMode) { toast("코드 보기에서는 본문 삽입을 사용할 수 없어요"); return false; }
    if (!activeFreeSession()) { toast("열린 자유 메모를 찾지 못했어요"); return false; }
    if (!restoreFreeEditorRange(savedRange)) return false;
    document.execCommand("insertHTML", false, markup);
    normalizeLinks($("editor")); scheduleSave();
    return true;
  }
  function freeMemoInternalLinkMarkup(note, color, textColor) {
    const title = String(note && note.title || "제목 없는 메모");
    const type = noteTypeShortLabel(note);
    const project = note && getProject(note.projectId);
    const hint = `${project ? project.name : "프로젝트 없음"} · ${type}`;
    const id = esc(note.id);
    const linkColor = normalizeIdeaColorValue(color, ideaPreferredColor());
    const linkTextColor = normalizeIdeaTextColorValue(textColor);
    return `<div class="free-note-link-block"><a class="lumi-link lumi-note-link idea-quote-body" href="#lumi-note-${id}" data-lumi-note-id="${id}" data-lumi-note-title="${esc(title)}" data-lumi-note-color="${esc(linkColor)}" data-lumi-note-text-color="${esc(linkTextColor)}" title="${esc(hint)}" style="${ideaColorStyleAttr(linkColor, linkTextColor)}">${freeMemoNoteLinkCardInnerMarkup(note, title)}</a></div><p><br></p>`;
  }
  function freeMemoNoteLinkPreviewMarkup(note, color, textColor, id) {
    const title = String(note && note.title || "제목 없는 메모");
    const type = noteTypeShortLabel(note);
    const project = note && getProject(note.projectId);
    const hint = `${project ? project.name : "프로젝트 없음"} · ${type}`;
    const linkColor = normalizeIdeaColorValue(color, ideaPreferredColor());
    const linkTextColor = normalizeIdeaTextColorValue(textColor);
    const attrs = id ? ` id="${esc(id)}"` : "";
    return `<a${attrs} class="lumi-link lumi-note-link idea-quote-body" href="#" data-lumi-note-id="preview" data-lumi-note-title="${esc(title)}" data-lumi-note-color="${esc(linkColor)}" data-lumi-note-text-color="${esc(linkTextColor)}" title="${esc(hint)}" style="${ideaColorStyleAttr(linkColor, linkTextColor)}">${freeMemoNoteLinkCardInnerMarkup(note, title)}</a>`;
  }
  function normalizeFreeDividerConfig(input) {
    const src = input && typeof input === "object" ? input : {};
    const style = Object.prototype.hasOwnProperty.call(IDEA_DIVIDER_STYLES, String(src.style || "")) ? String(src.style) : "solid";
    const weight = Math.max(1, Math.min(12, Math.round(Number(src.weight) || 3)));
    const color = normalizeIdeaColorValue(src.color, ideaPreferredColor());
    return { style, weight, color };
  }
  function freeDividerPreviewMarkup(config, id) {
    const data = normalizeFreeDividerConfig(config);
    const attrs = id ? ` id="${esc(id)}"` : "";
    return `<div${attrs} class="idea-preview-divider lumi-note-divider" data-divider-style="${esc(data.style)}" style="${ideaColorStyleAttr(data.color, "")};--idea-divider-weight:${data.weight}px"><div class="idea-divider-body" aria-hidden="true"><span></span></div></div>`;
  }
  function freeMemoDividerMarkup(config) {
    const data = normalizeFreeDividerConfig(config);
    return `<div class="idea-preview-divider lumi-note-divider" contenteditable="false" data-lumi-note-divider="1" data-divider-style="${esc(data.style)}" data-divider-color="${esc(data.color)}" style="${ideaColorStyleAttr(data.color, "")};--idea-divider-weight:${data.weight}px"><div class="idea-divider-body" aria-hidden="true"><span></span></div></div><p><br></p>`;
  }
  function openFreeMemoDividerStylePicker(savedRange, initialConfig) {
    const config = normalizeFreeDividerConfig(initialConfig);
    const tiles = Object.entries(IDEA_DIVIDER_STYLES).map(([key, meta]) =>
      `<button type="button" class="idea-divider-choice${config.style === key ? " active" : ""}" data-free-divider-style="${esc(key)}" title="${esc(meta.desc)}">`
      + freeDividerPreviewMarkup({ ...config, style: key })
      + `<small>${esc(meta.label)}</small></button>`).join("");
    openModal(`<h3>구분선 디자인</h3><p class="m-sub">아이디어 보드와 같은 구분선 도구입니다. 굵기와 디자인을 고른 뒤 컬러를 정합니다.</p>`
      + `<label class="idea-overlay-range idea-divider-weight-range"><span>선 굵기 <b id="freeDivWeightValue">${config.weight}px</b></span><input id="freeDivWeight" type="range" min="1" max="12" step="1" value="${config.weight}" aria-label="구분선 굵기"></label>`
      + `<div class="idea-divider-choice-grid">${tiles}</div>`
      + `<div class="m-row"><button class="m-btn" id="freeDividerStyleClose">닫기</button></div>`);
    const updateWeight = (value) => {
      config.weight = Math.max(1, Math.min(12, Math.round(Number(value) || 3)));
      const label = $("freeDivWeightValue"); if (label) label.textContent = config.weight + "px";
      $("modalBox").querySelectorAll(".idea-preview-divider").forEach((preview) => preview.style.setProperty("--idea-divider-weight", config.weight + "px"));
    };
    const weightInput = $("freeDivWeight");
    if (weightInput) weightInput.addEventListener("input", () => updateWeight(weightInput.value));
    $("modalBox").querySelectorAll("[data-free-divider-style]").forEach((button) => button.addEventListener("click", () => {
      config.style = button.dataset.freeDividerStyle || "solid";
      openFreeMemoDividerColorPicker(savedRange, config);
    }));
    $on("freeDividerStyleClose", "click", closeModal);
  }
  function openFreeMemoDividerColorPicker(savedRange, initialConfig) {
    const config = normalizeFreeDividerConfig(initialConfig);
    const preview = () => freeDividerPreviewMarkup(config, "freeDividerColorPreview");
    openModal(`<h3>구분선 컬러</h3><p class="m-sub">${esc((IDEA_DIVIDER_STYLES[config.style] || IDEA_DIVIDER_STYLES.solid).label)} 디자인에 적용할 색을 고릅니다.</p>`
      + preview()
      + `<div class="idea-options-label">구분선 컬러</div><div class="idea-color-grid palette-grid">${ideaColorChoicesMarkup(config.color, "data-free-divider-color", true)}</div>`
      + `<div class="m-row"><button class="m-btn" id="freeDividerColorBack">뒤로가기</button><button class="m-btn primary" id="freeDividerColorDone">삽입</button></div>`);
    const update = () => {
      const target = $("freeDividerColorPreview");
      if (!target) return;
      target.dataset.dividerStyle = config.style;
      target.setAttribute("style", `${ideaColorStyleAttr(config.color, "")};--idea-divider-weight:${config.weight}px`);
    };
    $("modalBox").querySelectorAll("[data-free-divider-color]").forEach((button) => button.addEventListener("click", () => {
      config.color = button.dataset.freeDividerColor || config.color;
      $("modalBox").querySelectorAll("[data-free-divider-color]").forEach((item) => item.classList.toggle("active", item === button));
      update();
    }));
    $("modalBox").querySelectorAll('[data-idea-custom-color="data-free-divider-color"]').forEach((button) => button.addEventListener("click", () => {
      openIdeaCustomColorPicker("구분선 컬러 직접 선택", config.color, (value) => {
        config.color = value;
        openFreeMemoDividerColorPicker(savedRange, config);
      });
    }));
    $on("freeDividerColorBack", "click", () => openFreeMemoDividerStylePicker(savedRange, config));
    $on("freeDividerColorDone", "click", () => {
      closeModal();
      if (insertFreeEditorMarkup(freeMemoDividerMarkup(config), savedRange)) toast("구분선을 넣었어요");
    });
    update();
  }
  function openFreeMemoNoteLinkColorPicker(savedRange, note, initialColor, initialTextColor) {
    const config = { color: normalizeIdeaColorValue(initialColor, ideaPreferredColor()), textColor: normalizeIdeaTextColorValue(initialTextColor || "auto") };
    const preview = () => `<div class="free-note-link-preview">${freeMemoNoteLinkPreviewMarkup(note, config.color, config.textColor, "freeNoteLinkColorPreview")}</div><div class="idea-options-label">글자색</div><div class="idea-color-grid palette-grid">${ideaTextColorChoicesMarkup(config.textColor, "data-free-note-link-text-color", true)}</div>`;
    openModal(`<h3>바로가기 버튼 컬러</h3><p class="m-sub">자유 메모 본문에서 보일 버튼 컬러를 고릅니다. 연결 대상은 메모 ID를 따라가므로, 프로젝트를 옮겨도 유지됩니다.</p>`
      + preview()
      + `<div class="idea-options-label">버튼 컬러</div><div class="idea-color-grid palette-grid">${ideaColorChoicesMarkup(config.color, "data-free-note-link-color", true)}</div>`
      + `<div class="m-row"><button class="m-btn" id="freeNoteLinkColorBack">뒤로가기</button><button class="m-btn primary" id="freeNoteLinkColorDone">삽입</button></div>`);
    const update = () => {
      const target = $("freeNoteLinkColorPreview");
      if (!target) return;
      target.dataset.lumiNoteColor = config.color;
      target.dataset.lumiNoteTextColor = config.textColor;
      target.setAttribute("style", ideaColorStyleAttr(config.color, config.textColor));
    };
    $("modalBox").querySelectorAll("[data-free-note-link-color]").forEach((button) => button.addEventListener("click", () => {
      config.color = normalizeIdeaColorValue(button.dataset.freeNoteLinkColor, config.color);
      $("modalBox").querySelectorAll("[data-free-note-link-color]").forEach((item) => item.classList.toggle("active", item === button));
      update();
    }));
    $("modalBox").querySelectorAll("[data-free-note-link-text-color]").forEach((button) => button.addEventListener("click", () => {
      config.textColor = normalizeIdeaTextColorValue(button.dataset.freeNoteLinkTextColor);
      $("modalBox").querySelectorAll("[data-free-note-link-text-color]").forEach((item) => item.classList.toggle("active", item === button));
      update();
    }));
    $("modalBox").querySelectorAll('[data-idea-custom-color="data-free-note-link-color"]').forEach((button) => button.addEventListener("click", () => {
      openIdeaCustomColorPicker("바로가기 버튼 컬러 직접 선택", config.color, (value) => {
        config.color = normalizeIdeaColorValue(value, config.color);
        openFreeMemoNoteLinkColorPicker(savedRange, note, config.color, config.textColor);
      });
    }));
    $("modalBox").querySelectorAll('[data-idea-custom-color="data-free-note-link-text-color"]').forEach((button) => button.addEventListener("click", () => {
      openIdeaCustomColorPicker("바로가기 버튼 글자색 직접 선택", ideaTextColorValue(config.textColor) || "#20242d", (value) => {
        config.textColor = normalizeIdeaTextColorValue(value);
        openFreeMemoNoteLinkColorPicker(savedRange, note, config.color, config.textColor);
      });
    }));
    $on("freeNoteLinkColorBack", "click", () => openFreeMemoNoteLinkPicker(savedRange));
    $on("freeNoteLinkColorDone", "click", () => {
      closeModal();
      if (insertFreeEditorMarkup(freeMemoInternalLinkMarkup(note, config.color, config.textColor), savedRange)) toast("내 글 바로가기를 넣었어요");
    });
    update();
  }

  function openFreeMemoNoteLinkPicker(savedRange) {
    const current = getNote(st.curNoteId);
    const candidates = st.notes.filter((note) => note.id !== (current && current.id));
    const bodyText = (note) => { try { return [preview(noteHtml(note)), JSON.stringify(note.data || {}).slice(0, 3000)].join(" "); } catch (e) { return preview(noteHtml(note)); } };
    const searchText = (note) => [note.title || "", noteTypeShortLabel(note), noteTypeLabel(note), TYPE_TAG[visualMemoType(note)] || "", note.type === "idea" ? ideaBoardSummary(note) : bodyText(note)].join(" ").toLocaleLowerCase("ko");
    let tab = "all", selectedProjectId = null, query = "";
    const projectName = (projectId) => { const project = getProject(projectId); return project ? project.name : "프로젝트 없음"; };
    const pick = (id) => {
      const target = getNote(id);
      if (!target) { toast("연결할 메모를 찾지 못했어요"); return; }
      openFreeMemoNoteLinkColorPicker(savedRange, target, ideaPreferredColor());
    };
    const noteRows = (list) => list.length ? list.map((note) => `<div class="log-template-item idea-quote-item"><button class="log-template-main" type="button" data-free-note-link="${esc(note.id)}"><span class="log-template-title"><span class="memo-tag t-${visualMemoType(note)}">${TYPE_TAG[visualMemoType(note)] || "?"}</span><b>${esc(note.title || "제목 없는 메모")}</b></span><small>${esc(projectName(note.projectId))} · ${esc(noteTypeShortLabel(note))} · ${esc(note.type === "idea" ? ideaBoardSummary(note) : preview(noteHtml(note)) || "내용 없음")}</small></button></div>`).join("") : '<div class="log-template-empty">검색 결과가 없어요.</div>';
    const projectRows = (list) => list.length ? list.map((project) => {
      const count = candidates.filter((note) => note.projectId === project.id).length;
      const framed = frameById(project.frame);
      const thumb = `<span class="idea-quote-project-thumb${framed ? " has-frame" : ""}">${projectThumbMedia(project)}${framed ? `<span class="frame">${frameInner(project)}</span>` : ""}</span>`;
      return `<div class="log-template-item idea-quote-project-item"><button class="log-template-main" type="button" data-free-note-project="${esc(project.id)}">${thumb}<span class="idea-quote-project-copy"><span class="log-template-title"><b>${esc(project.name || "이름 없는 프로젝트")}</b></span><small>연결 가능한 메모 ${count}개</small></span></button></div>`;
    }).join("") : '<div class="log-template-empty">표시할 프로젝트가 없어요.</div>';
    openModal(`<div class="log-template-manager idea-quote-manager free-note-link-manager"><h3>내 글 바로가기</h3><p class="m-sub">아이디어 보드와 같은 방식으로, 연결할 메모를 전체 또는 프로젝트별로 골라요.</p><div class="log-template-tabs" role="tablist" aria-label="내 글 바로가기 구분"><button data-free-note-tab="all" role="tab">전체보기 <small></small></button><button data-free-note-tab="project" role="tab">프로젝트별 <small></small></button></div><div class="log-template-tools"><input class="m-input" id="freeNoteLinkSearch" type="search" autocomplete="off" placeholder="제목·내용·종류 검색"></div><div class="log-template-list idea-quote-results" id="freeNoteLinkList"></div><div class="m-row"><button class="m-btn" id="freeNoteProjectBack" type="button" hidden>← 뒤로가기</button><button class="m-btn" id="freeNoteLinkCancel">닫기</button></div></div>`);
    $("modalBox").classList.add("log-template-modal", "idea-quote-modal");
    $("modalScrim").classList.add("log-template-open");
    const draw = () => {
      $("modalBox").querySelectorAll("[data-free-note-tab]").forEach((button) => {
        const active = button.dataset.freeNoteTab === tab;
        button.classList.toggle("active", active); button.setAttribute("aria-selected", active ? "true" : "false");
        const small = button.querySelector("small"); if (small) small.textContent = button.dataset.freeNoteTab === "all" ? String(candidates.length) : String(st.projects.length);
      });
      const input = $("freeNoteLinkSearch"), back = $("freeNoteProjectBack"), box = $("freeNoteLinkList");
      if (!box) return;
      if (input && document.activeElement !== input) input.value = query;
      const q = query.trim().toLocaleLowerCase("ko");
      if (back) back.hidden = !(tab === "project" && selectedProjectId);
      if (tab === "project" && selectedProjectId == null) {
        if (input) input.placeholder = "프로젝트 이름 검색";
        const projects = st.projects.filter((project) => !q || String(project.name || "").toLocaleLowerCase("ko").includes(q)).sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "ko"));
        box.innerHTML = projectRows(projects);
        box.querySelectorAll("[data-free-note-project]").forEach((button) => button.addEventListener("click", () => { selectedProjectId = button.dataset.freeNoteProject; query = ""; draw(); }));
        return;
      }
      if (input) input.placeholder = tab === "project" ? `${projectName(selectedProjectId)} 안에서 검색` : "제목·내용·종류 검색";
      const source = (tab === "project" && selectedProjectId) ? candidates.filter((note) => note.projectId === selectedProjectId) : candidates;
      const list = (q ? source.filter((note) => searchText(note).includes(q)) : source).sort((a, b) => String(a.title || "").localeCompare(String(b.title || ""), "ko"));
      box.innerHTML = source.length ? noteRows(list) : '<div class="log-template-empty">연결할 메모가 없어요.</div>';
      box.querySelectorAll("[data-free-note-link]").forEach((button) => button.addEventListener("click", () => pick(button.dataset.freeNoteLink)));
    };
    $("modalBox").querySelectorAll("[data-free-note-tab]").forEach((button) => button.addEventListener("click", () => { tab = button.dataset.freeNoteTab; selectedProjectId = null; query = ""; draw(); }));
    $("freeNoteLinkSearch").addEventListener("input", (event) => { query = event.target.value; draw(); });
    $on("freeNoteProjectBack", "click", () => { selectedProjectId = null; query = ""; draw(); });
    $on("freeNoteLinkCancel", "click", closeModal);
    draw();
  }
  function openFreeInsertMenu(savedRange) {
    if (st.codeMode) { toast("코드 보기에서는 본문 삽입을 사용할 수 없어요"); return; }
    const range = savedRange || captureFreeEditorRange();
    openModal(`<h3>본문에 삽입</h3><p class="m-sub">현재 커서 위치에 내 글 바로가기 또는 구분선을 넣습니다.</p><div class="idea-add-menu free-insert-menu"><button type="button" class="idea-add-choice" id="freeInsertNoteLink"><span class="iac-ico">↗</span><span><b>내 글 바로가기</b><small>작성한 다른 메모를 여는 연결 칩</small></span></button><button type="button" class="idea-add-choice" id="freeInsertDivider"><span class="iac-ico">—</span><span><b>구분선</b><small>굵기·디자인·컬러를 골라 삽입</small></span></button></div><div class="m-row"><button class="m-btn" id="freeInsertCancel">취소</button></div>`);
    $on("freeInsertNoteLink", "click", () => openFreeMemoNoteLinkPicker(range));
    $on("freeInsertDivider", "click", () => openFreeMemoDividerStylePicker(range));
    $on("freeInsertCancel", "click", closeModal);
  }
  function insertLinkPrompt() {
    $("editor").focus();
    const sel = window.getSelection();
    if (!sel.rangeCount || sel.isCollapsed) { toast("링크를 걸 텍스트를 먼저 선택해 주세요"); return; }
    const saved = sel.getRangeAt(0).cloneRange();
    openModal(`<h3>링크 삽입</h3><div class="m-field-label">연결할 주소</div><input class="m-input" id="lkUrl" placeholder="https://…" inputmode="url" autocapitalize="off" autocorrect="off"><div class="m-row"><button class="m-btn" id="lkNo">취소</button><button class="m-btn primary" id="lkOk">삽입</button></div>`);
    setTimeout(() => $("lkUrl").focus(), 120);
    $on("lkNo", "click", closeModal);
    $on("lkOk", "click", () => {
      let u = $("lkUrl").value.trim(); if (!u) return;
      if (!/^https?:\/\//i.test(u)) u = "https://" + u;
      closeModal(); $("editor").focus();
      const s = window.getSelection(); s.removeAllRanges(); s.addRange(saved);
      document.execCommand("createLink", false, u);
      normalizeLinks($("editor")); scheduleSave();
    });
  }
  function linkifyBeforeCaret() {
    try {
      const sel = window.getSelection(); if (!sel.rangeCount || !sel.isCollapsed) return;
      const r = sel.getRangeAt(0), node = r.startContainer;
      if (node.nodeType !== 3) return;
      if (node.parentElement && node.parentElement.closest("a")) return;
      const caret = r.startOffset, before = node.textContent.slice(0, caret);
      const m = before.match(/(https?:\/\/[^\s]+)(\s)$/);
      if (!m) return;
      const url = m[1], start = caret - m[0].length, end = start + url.length;
      const rng = document.createRange(); rng.setStart(node, start); rng.setEnd(node, end);
      const a = document.createElement("a"); a.href = url; a.className = "lumi-link"; a.target = "_blank"; a.rel = "noopener noreferrer";
      rng.surroundContents(a);
      const after = a.nextSibling;
      const sel2 = window.getSelection(); const c = document.createRange();
      if (after && after.nodeType === 3) c.setStart(after, Math.min(1, after.textContent.length)); else c.setStartAfter(a);
      c.collapse(true); sel2.removeAllRanges(); sel2.addRange(c);
      scheduleSave();
    } catch (e) {}
  }

  function onEditorPaste(e) {
    const t = ((e.clipboardData || window.clipboardData) || {}).getData ? (e.clipboardData || window.clipboardData).getData("text") : "";
    const u = (t || "").trim();
    if (u && URL_RE.test(u)) {
      e.preventDefault();
      const sel = window.getSelection();
      if (sel.rangeCount && !sel.isCollapsed) document.execCommand("createLink", false, u);
      else document.execCommand("insertHTML", false, `<a href="${u.replace(/"/g, "%22")}">${esc(u)}</a>&nbsp;`);
      normalizeLinks($("editor")); scheduleSave();
    }
  }

  /* ---------- modal ---------- */
  function openModal(html) { const box = $("modalBox"), scrim = $("modalScrim"); box.className = "modal"; box.innerHTML = html; scrim.classList.remove("log-template-open"); scrim.classList.add("open"); }
  function closeModal() {
    if (customThemePreviewRestore) { const restore = customThemePreviewRestore; customThemePreviewRestore = null; try { restore(); } catch (e) {} }
    $("modalScrim").classList.remove("open");
  }
  $on("modalScrim", "click", (e) => { if (e.target === $("modalScrim")) closeModal(); });

  function newNoteScreen(type) {
    if (type === "html") return "html";
    if (type === "regex") return "regex";
    if (type === "lorebook") return "lore";
    if (type === "log") return "log";
    if (type === "character" || type === "persona") return "character";
    if (type === "idea") return "idea";
    return "editor";
  }
  function openCreatedNote(type) {
    closeModal();
    if (type === "character" || type === "persona") st.charEdit = true;
    if (type === "log") logEditMode = true;
    go({ s: newNoteScreen(type) });
  }
  function typePickerOptions(button) {
    const type = button.dataset.createType || button.dataset.t;
    const mode = button.dataset.characterMode === "single" ? "single" : "collection";
    return { type, options: (type === "character" || type === "persona") ? { characterMode: mode } : null };
  }
  function showTypePicker(presetPid) {
    const icon = (paths) => `<svg viewBox="0 0 24 24">${paths}</svg>`;
    const card = (type, mode, title, desc, ico) => `
      <button type="button" class="type-card" data-create-type="${type}"${mode ? ` data-character-mode="${mode}"` : ""}>
        <div class="tc-ico">${ico}</div><div><div class="tc-name">${title}</div><div class="tc-desc">${desc}</div></div>
      </button>`;
    const icons = {
      persona: icon('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'),
      people: icon('<circle cx="9" cy="8" r="3.2"/><circle cx="16.5" cy="10" r="2.4"/><path d="M3.5 21a6.2 6.2 0 0 1 11 0"/><path d="M13 20.5a4.5 4.5 0 0 1 7.5 0"/>'),
      lore: icon('<path d="M4 5a2 2 0 0 1 2-2h12v18H6a2 2 0 0 1-2-2z"/><path d="M8 7h7M8 11h7"/>'),
      html: icon('<path d="M9 7l-5 5 5 5M15 7l5 5-5 5"/><path d="M13 4l-2 16"/>'),
      regex: icon('<path d="M4 6h16M4 18h16"/><path d="M8 10v4M6 12h4M14 10l4 4M18 10l-4 4"/>'),
      free: icon('<path d="M5 3h9l5 5v13H5z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h6"/>'),
      log: icon('<path d="M4 4h16v16H4z"/><path d="M7 8h10M7 12h7M7 16h9"/><path d="M4 7h16"/>'),
      idea: icon('<rect x="4" y="4" width="16" height="16" rx="2.5"/><path d="M8 16.5l2.4-5.8 2.3 4.2 1.5-2.2 2.8 3.8"/><circle cx="15.8" cy="8.2" r="1.5"/><path d="M7 7.5h4"/>')
    };
    openModal(`
      <div class="type-picker-modal">
        <h3>새 메모</h3><p class="m-sub">생성할 메모 타입을 골라주세요</p>
        <button type="button" class="type-quick-free" data-create-type="free" aria-label="자유 메모 만들기">
          <span class="tqf-icon">${icons.free}</span>
          <span class="tqf-copy"><span class="tqf-eyebrow">QUICK NOTE</span><span class="tqf-title">자유 메모</span><span class="tqf-sub">서식 보존 편집기로 바로 시작하기</span></span>
          <span class="tqf-arrow">${icon('<path d="M5 12h14M13 6l6 6-6 6"/>')}</span>
        </button>
        <div class="type-picker-tabs" role="tablist" aria-label="새 메모 분류">
          <button type="button" class="type-picker-tab active" data-type-tab="character" role="tab" aria-selected="true">캐릭터</button>
          <button type="button" class="type-picker-tab" data-type-tab="studio" role="tab" aria-selected="false">작업실</button>
          <button type="button" class="type-picker-tab" data-type-tab="atelier" role="tab" aria-selected="false">아뜰리에</button>
        </div>
        <div class="type-picker-pane active" data-type-pane="character" role="tabpanel">
          <div class="type-pane-caption">Persona &amp; Character</div>
          ${card("persona", "single", "페르소나", "단일 페르소나 카드 · 국문/영문 · 이미지", icons.persona)}
          ${card("persona", "collection", "다인 페르소나", "여러 페르소나를 한 카드 묶음으로 관리", icons.people)}
          ${card("character", "single", "캐릭터", "단일 캐릭터 카드 · 국문/영문 · 이미지", icons.persona)}
          ${card("character", "collection", "다인 캐릭터", "여러 캐릭터를 하나의 카드 묶음으로 관리", icons.people)}
        </div>
        <div class="type-picker-pane" data-type-pane="studio" role="tabpanel" hidden>
          <div class="type-pane-caption">Writing tools</div>
          ${card("lorebook", "", "로어북", "마크다운 · 키워드 · 토큰 · World Info 내보내기", icons.lore)}
          ${card("html", "", "코드 작업실", "원본 코드 보존 · 샌드박스 미리보기 · 그대로 내보내기", icons.html)}
          ${card("regex", "", "정규식 작업실", "IN 검증 · OUT HTML 미리보기 · SillyTavern JSON 내보내기", icons.regex)}
        </div>
        <div class="type-picker-pane" data-type-pane="atelier" role="tabpanel" hidden>
          <div class="type-pane-caption">Creative atelier</div>
          ${card("free", "", "자유 메모", "서식 보존 · 이미지 · 코드 보기 지원", icons.free)}
          ${card("log", "", "로그 저장", "대화 로그 · 이름 가림 · 게시용 HTML 내보내기", icons.log)}
          ${card("idea", "", "아이디어 보드", "캔버스에 요소를 배치해 자유롭게 꾸미기", icons.idea)}
        </div>
        <div class="m-row"><button class="m-btn" data-x="cancel">취소</button></div>
      </div>
    `);
    const box = $("modalBox");
    const selectTab = (name) => {
      box.querySelectorAll(".type-picker-tab").forEach((tab) => {
        const active = tab.dataset.typeTab === name;
        tab.classList.toggle("active", active); tab.setAttribute("aria-selected", active ? "true" : "false");
      });
      box.querySelectorAll(".type-picker-pane").forEach((pane) => {
        const active = pane.dataset.typePane === name;
        pane.classList.toggle("active", active); pane.hidden = !active;
      });
    };
    box.querySelectorAll(".type-picker-tab").forEach((tab) => tab.addEventListener("click", () => selectTab(tab.dataset.typeTab)));
    box.querySelectorAll("[data-create-type]").forEach((button) => {
      button.addEventListener("click", () => {
        const { type, options } = typePickerOptions(button);
        const openCreated = () => openCreatedNote(type);
        if (presetPid) createNote(type, presetPid, options).then(openCreated);
        else showProjectPicker(type, options);
      });
    });
    box.querySelector('[data-x="cancel"]').addEventListener("click", closeModal);
  }

  function showProjectPicker(type, options) {
    let selPid = st.projects.length ? st.projects[0].id : null;
    const items = st.projects.map((p) =>
      `<div class="pick-item${p.id === selPid ? " sel" : ""}" data-pid="${p.id}">${projIconHTML(p, "pk-ico")}<div class="pk-name">${esc(p.name)}</div><span class="pk-check"><svg viewBox="0 0 24 24"><path d="M5 12l4 4 10-10"/></svg></span></div>`
    ).join("");
    openModal(`
      <h3>저장할 프로젝트</h3><p class="m-sub">메모를 보관할 위치를 선택하세요.</p>
      <div class="proj-pick" id="pickList">${items || '<div class="m-sub">프로젝트가 없어요. 아래에서 만들어 주세요.</div>'}</div>
      <div class="m-link" id="pickNew"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg> 새 프로젝트 만들기</div>
      <div class="m-row"><button class="m-btn" id="pickCancel">취소</button><button class="m-btn primary" id="pickOk"${selPid ? "" : " disabled"}>만들기</button></div>
    `);
    const sync = () => $("modalBox").querySelectorAll(".pick-item").forEach((it) => it.classList.toggle("sel", it.dataset.pid === selPid));
    $("modalBox").querySelectorAll(".pick-item").forEach((it) => it.addEventListener("click", () => { selPid = it.dataset.pid; sync(); $("pickOk").disabled = false; }));
    $on("pickNew", "click", () => showProjectForm(null, (np) => { selPid = np.id; showProjectPicker(type, options); }));
    $on("pickCancel", "click", closeModal);
    $on("pickOk", "click", () => { if (!selPid) return; createNote(type, selPid, options).then(() => openCreatedNote(type)); });
  }

  function projectTagListFromText(value) {
    return String(value || "").split(/[,\n]+/).map((s) => s.trim()).filter(Boolean);
  }
  function bindProjectTagEditor(initialValue) {
    const editor = $("pfTagEditor"), list = $("pfTagList"), input = $("pfTagInput"), source = $("pfDesc");
    if (!editor || !list || !input || !source) return;
    let tags = [];
    const maxLength = Number(source.getAttribute("maxlength")) || 500;
    const syncSource = () => { source.value = tags.join(", "); };
    const draw = () => {
      list.innerHTML = tags.map((tag, idx) => `<span class="project-tag-chip"><span>${esc(tag)}</span><button type="button" aria-label="삭제" data-project-tag-remove="${idx}">×</button></span>`).join("");
      list.querySelectorAll("[data-project-tag-remove]").forEach((button) => button.addEventListener("click", (e) => {
        e.stopPropagation();
        tags.splice(Number(button.dataset.projectTagRemove) || 0, 1);
        syncSource();
        draw();
        input.focus();
      }));
      editor.classList.toggle("is-empty", !tags.length);
    };
    const add = (raw) => {
      const next = projectTagListFromText(raw).map((tag) => tag.slice(0, 40));
      if (!next.length) return false;
      next.forEach((tag) => {
        if (tags.includes(tag) || tags.length >= 30) return;
        const candidate = tags.concat(tag);
        if (candidate.join(", ").length <= maxLength) tags.push(tag);
      });
      syncSource();
      draw();
      return true;
    };
    tags = projectTagListFromText(initialValue).map((tag) => tag.slice(0, 40)).filter((tag, idx, arr) => arr.indexOf(tag) === idx).slice(0, 30);
    syncSource();
    draw();
    editor.addEventListener("click", () => input.focus());
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === ",") {
        e.preventDefault();
        if (add(input.value)) input.value = "";
      } else if (e.key === "Backspace" && !input.value && tags.length) {
        tags.pop();
        syncSource();
        draw();
      }
    });
    input.addEventListener("input", () => {
      if (!input.value.includes(",")) return;
      const parts = input.value.split(",");
      input.value = parts.pop().trimStart();
      add(parts.join(","));
    });
    input.addEventListener("blur", () => { if (add(input.value)) input.value = ""; });
  }

  // project create/edit form. onDone(project) optional
  function showProjectForm(editId, onDone) {
    const p = editId ? getProject(editId) : null;
    const desc = p ? (p.description || "") : "";
    openModal(`
      <h3>${p ? "프로젝트 편집" : "새 프로젝트"}</h3>
      <div class="m-field-label">이름</div>
      <input class="m-input" id="pfName" maxlength="60" placeholder="프로젝트 이름" value="${p ? esc(p.name) : ""}">
      <div class="m-field-label">태그</div>
      <textarea class="project-tag-source" id="pfDesc" maxlength="500" hidden>${esc(desc)}</textarea>
      <div class="project-tag-editor" id="pfTagEditor">
        <div class="project-tag-list" id="pfTagList"></div>
        <input class="project-tag-input" id="pfTagInput" maxlength="80" placeholder="예: 판타지, 로맨스, 진행중" autocomplete="off" autocapitalize="off">
      </div>
      <div class="m-row"><button class="m-btn" id="pfCancel">취소</button><button class="m-btn primary" id="pfOk">${p ? "저장" : "만들기"}</button></div>
    `);
    bindProjectTagEditor(desc);
    setTimeout(() => $("pfName").focus(), 120);
    $on("pfCancel", "click", closeModal);
    $on("pfOk", "click", async () => {
      if ($("pfTagInput") && $("pfTagInput").value.trim()) $("pfTagInput").dispatchEvent(new Event("blur"));
      const name = $("pfName").value.trim(), desc = $("pfDesc").value.trim();
      if (!name) { $("pfName").focus(); return; }
      let result;
      if (p) { p.name = name; p.description = desc; await saveProject(p); result = p; toast("저장했어요"); }
      else { result = await createProject(name, desc); }
      closeModal();
      if (onDone) onDone(result); else render(), renderSidebar();
    });
  }

  function showChipPicker(noteId) {
    const n = getNote(noteId); if (!n) return;
    const swatches = Object.keys(CHIP).map((k) =>
      `<div class="chip-swatch${n.chipColor === k ? " sel" : ""}" data-k="${k}" style="background:${CHIP[k].c};box-shadow:0 0 12px ${CHIP[k].c}66" title="${CHIP[k].name}"></div>`
    ).join("");
    openModal(`
      <h3>색상 지정</h3><p class="m-sub">${esc(n.title)}</p>
      <div class="chip-palette">${swatches}
        <div class="chip-swatch${!n.chipColor ? " sel" : ""}" data-k="" style="background:var(--surface-2)"><span class="none-mark"><svg viewBox="0 0 24 24"><path d="M5 5l14 14M19 5L5 19"/></svg></span></div>
      </div>
      <div class="m-row"><button class="m-btn" id="chipClose">닫기</button></div>
    `);
    $("modalBox").querySelectorAll(".chip-swatch").forEach((sw) => sw.addEventListener("click", async () => {
      n.chipColor = sw.dataset.k || null; await saveNote(n);
      closeModal(); render();
    }));
    $on("chipClose", "click", closeModal);
  }
  function showProjectColorPicker(id) {
    const p = getProject(id); if (!p) return;
    const swatches = Object.keys(CHIP).map((k) =>
      `<div class="chip-swatch${p.chipColor === k ? " sel" : ""}" data-k="${k}" style="background:${CHIP[k].c};box-shadow:0 0 12px ${CHIP[k].c}66" title="${CHIP[k].name}"></div>`
    ).join("");
    openModal(`
      <h3>프로젝트 색상</h3><p class="m-sub">${esc(p.name)}</p>
      <div class="chip-palette">${swatches}
        <div class="chip-swatch${!p.chipColor ? " sel" : ""}" data-k="" style="background:var(--surface-2)"><span class="none-mark"><svg viewBox="0 0 24 24"><path d="M5 5l14 14M19 5L5 19"/></svg></span></div>
      </div>
      <div class="m-row"><button class="m-btn" id="chipClose">닫기</button></div>
    `);
    $("modalBox").querySelectorAll(".chip-swatch").forEach((sw) => sw.addEventListener("click", async () => {
      p.chipColor = sw.dataset.k || null; await saveProject(p);
      closeModal(); render(); renderSidebar();
    }));
    $on("chipClose", "click", closeModal);
  }

  function confirmModal(title, msg, okLabel, danger, onOk) {
    openModal(`<h3>${esc(title)}</h3><p class="m-sub">${esc(msg)}</p><div class="m-row"><button class="m-btn" id="cfNo">취소</button><button class="m-btn ${danger ? "danger" : "primary"}" id="cfYes">${esc(okLabel)}</button></div>`);
    $on("cfNo", "click", closeModal);
    $on("cfYes", "click", () => { closeModal(); onOk(); });
  }
  /* ---------- attachments ---------- */
  /* ---------- top bar title quick rename ---------- */
  let topTitleRenameCooldown = 0;
  const TOP_TITLE_IDS = ["edTitle", "readTitle", "htmlTitle", "regexTitle", "loreTitle", "logTitle", "perTitle", "charTitle", "ideaTitle"];
  function titleKindLabel(n) {
    if (!n) return "메모";
    return ({ free:"메모", html:"코드 작업실", regex:"정규식 작업실", lorebook:"로어북", log:"로그", persona:"페르소나", character:"캐릭터", idea:"아이디어 보드" })[n.type] || "메모";
  }
  async function saveTopTitleRename(n, value) {
    const next = cleanImportedText(value, 80).trim(); if (!n || !next) return;
    n.title = next; n.titleLocked = true;
    if (n.type === "lorebook") await saveLore(n, true);
    else if (n.type === "log") await saveLog(n, true);
    else if (n.type === "persona") await savePersona(n, true);
    else if (n.type === "character") await saveCharacter(n, true);
    else await saveNote(n);
    TOP_TITLE_IDS.forEach((id) => { const el = $(id); if (el) el.textContent = next; });
    renderSidebar();
    toast("제목을 고정했어요");
  }
  function openTopTitleRename() {
    const nowAt = Date.now();
    if (nowAt < topTitleRenameCooldown || $("modalScrim").classList.contains("open")) return;
    const n = getNote(st.curNoteId); if (!n) return;
    topTitleRenameCooldown = nowAt + 420;
    renameModal(`${titleKindLabel(n)} 이름`, n.title || titleKindLabel(n), (value) => { void saveTopTitleRename(n, value); });
  }
  function bindTopTitleRename(id) {
    const el = $(id); if (!el) return;
    let lastTouch = 0, lastX = 0, lastY = 0, pointerHandledUntil = 0;
    el.classList.add("title-quick-rename");
    el.title = "더블클릭 또는 더블터치하여 이름 바꾸기";
    el.addEventListener("dblclick", (event) => {
      event.preventDefault();
      if (Date.now() < pointerHandledUntil) return;
      openTopTitleRename();
    });
    el.addEventListener("pointerup", (event) => {
      if (event.pointerType === "mouse") return;
      const at = Date.now(), dx = Math.abs(event.clientX - lastX), dy = Math.abs(event.clientY - lastY);
      if (lastTouch && at - lastTouch < 340 && dx < 28 && dy < 28) {
        pointerHandledUntil = at + 520; lastTouch = 0; event.preventDefault(); openTopTitleRename(); return;
      }
      lastTouch = at; lastX = event.clientX; lastY = event.clientY;
    });
  }

  function renameModal(title, current, onOk) {
    openModal(`<h3>${esc(title)}</h3><input class="m-input" id="rnInput" maxlength="80" value="${esc(current)}"><div class="m-row"><button class="m-btn" id="rnNo">취소</button><button class="m-btn primary" id="rnOk">저장</button></div>`);
    setTimeout(() => { const i = $("rnInput"); i.focus(); i.select(); }, 120);
    $on("rnNo", "click", closeModal);
    $on("rnOk", "click", () => { const v = $("rnInput").value.trim(); closeModal(); onOk(v); });
  }

  /* ---------- action sheet ---------- */
  function openSheet(title, items) {
    $("sheetTitle").textContent = title;
    const wrap = $("sheetItems"); wrap.innerHTML = "";
    items.forEach((it) => {
      const el = document.createElement("div");
      el.className = "sheet-item" + (it.danger ? " danger" : "");
      el.innerHTML = `${it.icon || ""}<span>${esc(it.label)}</span>`;
      el.addEventListener("click", () => { closeSheet(); it.fn(); });
      wrap.appendChild(el);
    });
    document.body.classList.add("sheet-open");
  }
  function closeSheet() { document.body.classList.remove("sheet-open"); }
  $on("sheetScrim", "click", closeSheet);
  const IC = {
    rename: '<svg viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>',
    color: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="9" r="1.3" fill="currentColor" stroke="none"/><circle cx="15" cy="12" r="1.3" fill="currentColor" stroke="none"/><circle cx="9" cy="12" r="1.3" fill="currentColor" stroke="none"/></svg>',
    save: '<svg viewBox="0 0 24 24"><path d="M12 4v12M7 11l5 5 5-5"/><path d="M5 20h14"/></svg>',
    move: '<svg viewBox="0 0 24 24"><path d="M5 9l-3 3 3 3M2 12h10M14 5h6a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-6"/></svg>',
    copy: '<svg viewBox="0 0 24 24"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h8"/></svg>',
    del: '<svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>',
    icon: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="9" r="1.8"/><path d="M21 16l-5-5L5 21"/></svg>',
    export: '<svg viewBox="0 0 24 24"><path d="M12 3v12M8 7l4-4 4 4"/><path d="M5 14v5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-5"/></svg>',
    select: '<svg viewBox="0 0 24 24"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>',
    pin: '<svg viewBox="0 0 24 24"><path d="M9 4h6l-1 6 3 3v2H7v-2l3-3z"/><path d="M12 15v5"/></svg>'
  };

  function openNoteSheet(id) {
    const n = getNote(id); if (!n) return;
    if (n.type === "lorebook") { openLoreSheet(n); return; }
    if (n.type === "log") { openLogSheet(n); return; }
    if (isCharacterCardType(n)) { openCharacterSheet(n); return; }
    if (n.type === "idea") { openIdeaBoardSheet(n); return; }
    if (n.type === "html") { openHtmlSheet(n); return; }
    if (n.type === "regex") { openRegexSheet(n); return; }
    openSheet(n.title, [
      { icon: IC.pin, label: n.pinned ? "고정 해제" : "상단 고정", fn: () => togglePinNote(id) },
      { icon: IC.rename, label: "이름 바꾸기", fn: () => renameModal("메모 이름", n.title, async (v) => { if (v) { n.title = v; n.titleLocked = true; await saveNote(n); render(); } }) },
      { icon: IC.color, label: "색상 지정", fn: () => showChipPicker(id) },
      { icon: IC.save, label: ".html로 저장", fn: () => exportNote(id) },
      { icon: IC.move, label: "다른 프로젝트로 이동", fn: () => pickTargetProject(n.projectId, (pid) => moveNote(id, pid).then(render)) },
      { icon: IC.copy, label: "선택 위치로 복제", fn: () => pickTargetProject(n.projectId, (pid) => duplicateNote(id, pid).then(render)) },
      { icon: IC.del, label: "삭제", danger: true, fn: () => confirmModal("메모 삭제", `'${n.title}'를 삭제할까요?`, "삭제", true, async () => { await deleteNote(id); if (curView().s !== "home" && curView().s !== "project") back(); else render(); }) }
    ]);
  }
  function openProjectSheet(id) {
    const p = getProject(id); if (!p) return;
    const items = [
      { icon: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>', label: "새 메모", fn: () => showTypePicker(id) },
      { icon: IC.pin, label: p.pinned ? "고정 해제" : "상단 고정", fn: () => togglePinProject(id) },
      { icon: IC.rename, label: "이름 · 설명 편집", fn: () => showProjectForm(id, () => { render(); renderSidebar(); }) },
      { icon: IC.color, label: "색상 지정", fn: () => showProjectColorPicker(id) },
      { icon: IC.export, label: "프로젝트 파일로 내보내기", fn: () => void exportProjectPackage(id) },
      { icon: IC.copy, label: "복제", fn: () => duplicateProject(id).then(() => { render(); renderSidebar(); }) },
      { icon: IC.icon, label: "아이콘 변경", fn: () => showIconPicker(id) },
      { icon: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><rect x="7.5" y="7.5" width="9" height="9" rx="1"/></svg>', label: "썸네일 프레임", fn: () => showFramePicker(id) }
    ];
    if (curView().s === "home") items.unshift({ icon: IC.select, label: "선택", fn: () => enterSelMode("project", id) });
    if (notesOf(id).some((n) => n.type === "lorebook")) items.push({ icon: IC.export, label: "로어북 → World Info 내보내기", fn: () => showLoreExportPicker(id) });
    if (!p.isDefault) items.push({ icon: IC.del, label: "삭제", danger: true, fn: () => {
      const cnt = notesOf(id).length;
      confirmModal("프로젝트 삭제", cnt ? `프로젝트와 소속 메모 ${cnt}개가 모두 삭제됩니다.` : "이 프로젝트를 삭제할까요?", "삭제", true, async () => { await deleteProject(id); if (curView().s === "project") back(); else { render(); renderSidebar(); } });
    } });
    openSheet(p.name, items);
  }

  function pickTargetProject(excludeOrCurrent, onPick) {
    let sel = st.projects[0] ? st.projects[0].id : null;
    const items = st.projects.map((p) => `<div class="pick-item${p.id === sel ? " sel" : ""}" data-pid="${p.id}">${projIconHTML(p, "pk-ico")}<div class="pk-name">${esc(p.name)}</div><span class="pk-check"><svg viewBox="0 0 24 24"><path d="M5 12l4 4 10-10"/></svg></span></div>`).join("");
    openModal(`<h3>프로젝트 선택</h3><div class="proj-pick">${items}</div><div class="m-link" id="ptNew"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg> 새 프로젝트 만들기</div><div class="m-row"><button class="m-btn" id="ptNo">취소</button><button class="m-btn primary" id="ptOk">선택</button></div>`);
    const sync = () => $("modalBox").querySelectorAll(".pick-item").forEach((it) => it.classList.toggle("sel", it.dataset.pid === sel));
    $("modalBox").querySelectorAll(".pick-item").forEach((it) => it.addEventListener("click", () => { sel = it.dataset.pid; sync(); }));
    $on("ptNew", "click", () => showProjectForm(null, () => pickTargetProject(excludeOrCurrent, onPick)));
    $on("ptNo", "click", closeModal);
    $on("ptOk", "click", () => { if (sel) { closeModal(); onPick(sel); } });
  }

  /* ---------- icon picker ---------- */
  let iconTargetPid = null;
  function showIconPicker(pid, tab, category) {
    const p = getProject(pid); if (!p) return;
    const activeTab = tab === "library" ? "library" : "images";
    const activeCat = QUICK_MENU_ICON_CATEGORIES.some((row) => row[0] === category) ? category : "all";
    const tabBar = `<div class="project-icon-tabs"><button type="button" class="project-icon-tab ${activeTab === "images" ? "is-active" : ""}" data-project-icon-tab="images">기본 이미지</button><button type="button" class="project-icon-tab ${activeTab === "library" ? "is-active" : ""}" data-project-icon-tab="library">아이콘 <span>${QUICK_MENU_ICON_LIBRARY.length}</span></button></div>`;
    let content = "";
    if (activeTab === "images") {
      const grid = ICONS.map((ic) => `<div class="icon-opt${!p.iconLibraryId && p.icon === ic.data ? " sel" : ""}" data-icon="${ic.id}"><img src="${ic.data}" alt="${esc(ic.name)}"></div>`).join("");
      content = `<div class="icon-grid">${grid}<div class="icon-opt upload" id="iconUpload"><svg viewBox="0 0 24 24"><path d="M12 16V5M7 10l5-5 5 5"/><path d="M5 16v3h14v-3"/></svg><span>업로드</span></div></div>`;
    } else {
      const cats = QUICK_MENU_ICON_CATEGORIES.map(([key, label]) => `<button type="button" class="project-icon-cat ${key === activeCat ? "is-active" : ""}" data-project-icon-cat="${key}">${label}</button>`).join("");
      const items = QUICK_MENU_ICON_LIBRARY.filter((item) => activeCat === "all" || item.category === activeCat);
      content = `<div class="project-icon-cats">${cats}</div><div class="project-icon-library-grid">${items.map((item) => quickMenuIconCardMarkup(item, p.iconLibraryId === item.id && !p.icon, "project")).join("")}</div>`;
    }
    openModal(`<h3>프로젝트 썸네일</h3><p class="m-sub">${esc(p.name)} · 기본 이미지와 루미잉크 아이콘 중에서 선택할 수 있어요.</p>${tabBar}${content}<div class="m-row"><button class="m-btn" id="iconClose">닫기</button></div>`);
    $("modalBox").querySelectorAll("[data-project-icon-tab]").forEach((el) => el.addEventListener("click", () => showIconPicker(pid, el.dataset.projectIconTab, activeCat)));
    $("modalBox").querySelectorAll("[data-project-icon-cat]").forEach((el) => el.addEventListener("click", () => showIconPicker(pid, "library", el.dataset.projectIconCat)));
    $("modalBox").querySelectorAll(".icon-opt[data-icon]").forEach((el) => el.addEventListener("click", async () => {
      const ic = ICONS.find((x) => x.id === el.dataset.icon); if (!ic) return;
      p.icon = ic.data; p.iconLibraryId = null; await saveProject(p); closeModal(); render(); renderSidebar(); toast("기본 이미지 썸네일을 적용했어요");
    }));
    $("modalBox").querySelectorAll("[data-project-library-icon]").forEach((el) => el.addEventListener("click", async () => {
      const id = quickMenuLibraryIconId(el.dataset.projectLibraryIcon); if (!id) return;
      p.icon = null; p.iconLibraryId = id; await saveProject(p); closeModal(); render(); renderSidebar(); toast("아이콘 썸네일을 적용했어요");
    }));
    $on("iconUpload", "click", () => { iconTargetPid = pid; $("iconInput").click(); });
    $on("iconClose", "click", closeModal);
  }
  function frameThumbInner(p) { return projectThumbMedia(p); }
  function frameSvgFor(fid, color) {
    return frameSvgMarkup(fid, color);
  }
  function showFramePicker(pid) {
    const p = getProject(pid); if (!p) return;
    const prevColor = normalizeFrameColor(p.frameColor) || "#d4af37";
    const none = `<div class="frame-opt${p.frame ? "" : " sel"}" data-fid=""><div class="proj-icon fr-prev">${frameThumbInner(p)}</div><span>없음</span></div>`;
    const grid = FRAMES.map((f) => `<div class="frame-opt${p.frame === f.id ? " sel" : ""}" data-fid="${f.id}"><div class="proj-icon fr-prev has-frame">${frameThumbInner(p)}<div class="frame">${frameSvgFor(f.id, prevColor)}</div></div><span>${esc(f.name)}</span></div>`).join("");
    openModal(`
      <h3>썸네일 프레임</h3><p class="m-sub">${esc(p.name)} · 디자인을 고르면 색을 선택해요</p>
      <div class="frame-grid">${none}${grid}</div>
      <div class="m-row"><button class="m-btn" id="frClose">닫기</button></div>
    `);
    $("modalBox").querySelectorAll(".frame-opt").forEach((el) => el.addEventListener("click", async () => {
      const fid = el.dataset.fid;
      if (!fid) { p.frame = null; p.frameColor = null; await saveProject(p); closeModal(); render(); renderSidebar(); toast("프레임을 제거했어요"); return; }
      showFrameColorPicker(pid, fid);
    }));
    $on("frClose", "click", closeModal);
  }
  function showFrameColorPicker(pid, fid, initialColor) {
    const p = getProject(pid); if (!p) return;
    let color = normalizeFrameColor(initialColor || p.frameColor) || "#d4af37";
    const themeAccent = resolveFrameColor(FRAME_THEME_TOKEN);
    const colors = FRAME_COLORS.concat([[FRAME_THEME_TOKEN, "테마와 연동", themeAccent]]);
    const isCustom = () => { const h = normHex(color); return !!h && !FRAME_COLOR_SET.has(h); };
    const isSelectedFrameColor = (key, value) => {
      if (key === "__custom__") return isCustom();
      if (key === FRAME_THEME_TOKEN) return color === FRAME_THEME_TOKEN;
      if (key === FRAME_PUNCH_TOKEN) return color === FRAME_PUNCH_TOKEN;
      return color === String(value).toLowerCase();
    };
    const sw = () => colors.map(([key, name, value]) => {
      const previewColor = key === FRAME_THEME_TOKEN ? themeAccent : value;
      const isGlass = key === "glass";
      const isPunch = key === FRAME_PUNCH_TOKEN;
      const punchStyle = 'background:linear-gradient(135deg, rgba(255,255,255,.68), rgba(255,255,255,.15)); box-shadow: inset 0 0 0 1px rgba(255,255,255,.85), inset 0 0 0 6px rgba(255,255,255,.14), 0 0 0 1px rgba(87,106,146,.32);';
      return `<button type="button" class="fcolor-sw${isGlass ? " glass" : ""}${isPunch ? " punch" : ""}${isSelectedFrameColor(key, value) ? " sel" : ""}" data-c="${key}" title="${esc(name)}" aria-label="${esc(name)}"><span${isGlass ? "" : isPunch ? ` style="${punchStyle}"` : ` style="background:${previewColor}"`}></span></button>`;
    }).join("") + `<button type="button" class="fcolor-sw fcolor-custom${isSelectedFrameColor("__custom__") ? " sel" : ""}" data-c="__custom__" title="직접 색상 선택" aria-label="직접 색상 선택"><span>+</span></button>`;
    openModal(`
      <h3>프레임 색상</h3><p class="m-sub">${esc((frameById(fid) || {}).name || "")} · 직접 색상은 정사각형 색상판과 HEX·RGB 입력으로 고를 수 있어요.</p>
      <div class="fr-bigprev"><div class="proj-icon has-frame">${frameThumbInner(p)}<div class="frame" id="frBigFrame">${frameSvgFor(fid, color)}</div></div></div>
      <div class="fcolor-grid" id="fcGrid">${sw()}</div>
      <div class="m-row"><button class="m-btn" id="fcBack">뒤로</button><button class="m-btn primary" id="fcOk">적용</button></div>
    `);
    const refresh = () => {
      $("frBigFrame").innerHTML = frameSvgFor(fid, color);
      $("fcGrid").querySelectorAll(".fcolor-sw").forEach((item) => {
        const key = item.dataset.c;
        const value = key === FRAME_THEME_TOKEN ? themeAccent : (key === FRAME_PUNCH_TOKEN ? FRAME_PUNCH_TOKEN : FRAME_COLOR_BY_KEY.get(key));
        item.classList.toggle("sel", isSelectedFrameColor(key, value));
      });
    };
    $("fcGrid").querySelectorAll(".fcolor-sw").forEach((item) => item.addEventListener("click", () => {
      const key = item.dataset.c;
      if (key === "__custom__") { openAdvancedColorPicker("프레임 직접 색상", normHex(color) || "#d4af37", (value) => showFrameColorPicker(pid, fid, value), { prefix:"projectFrameCustom", saved:true, save:true }); return; }
      color = key === FRAME_THEME_TOKEN ? FRAME_THEME_TOKEN : (key === FRAME_PUNCH_TOKEN ? FRAME_PUNCH_TOKEN : (FRAME_COLOR_BY_KEY.get(key) || color));
      refresh();
    }));
    $on("fcBack", "click", () => showFramePicker(pid));
    $on("fcOk", "click", async () => { p.frame = fid; p.frameColor = color; await saveProject(p); closeModal(); render(); renderSidebar(); toast(color === FRAME_THEME_TOKEN ? "테마와 연동되는 프레임을 적용했어요" : color === FRAME_PUNCH_TOKEN ? "글래시한 명암 프레임을 적용했어요" : "프레임을 적용했어요"); });
  }

  const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
  const MAX_IMAGE_PIXELS = 24 * 1000 * 1000;
  function imageLimitText() { return "이미지는 12MB 이하, 2,400만 픽셀 이하만 넣을 수 있어요"; }
  function isLikelyImageFile(file) {
    return !!(file && (/^image\//i.test(file.type || "") || /\.(png|jpe?g|gif|webp|bmp|avif)$/i.test(file.name || "")));
  }
  function loadImageFile(file) {
    return new Promise((res, rej) => {
      const url = URL.createObjectURL(file), img = new Image();
      img.onload = () => res({ img, url });
      img.onerror = () => { URL.revokeObjectURL(url); rej(new Error("이미지를 열 수 없어요")); };
      img.src = url;
    });
  }
  async function validateImageFile(file, options) {
    const opt = options && typeof options === "object" ? options : {};
    const limitText = typeof opt.limitText === "function" ? opt.limitText() : (opt.limitText || imageLimitText());
    const maxBytes = Number(opt.maxBytes) || MAX_IMAGE_BYTES;
    const maxPixels = Number(opt.maxPixels) || MAX_IMAGE_PIXELS;
    if (!isLikelyImageFile(file) || /svg/i.test(file.type || "") || /\.svgz?$/i.test(file.name || "")) throw new Error("이미지 파일만 넣을 수 있어요");
    if (file.size > maxBytes) throw new Error(limitText);
    const loaded = await loadImageFile(file);
    const pixels = loaded.img.naturalWidth * loaded.img.naturalHeight;
    const meta = { width: loaded.img.naturalWidth, height: loaded.img.naturalHeight, img: loaded.img, url: loaded.url };
    if (!meta.width || !meta.height || pixels > maxPixels) { URL.revokeObjectURL(loaded.url); throw new Error(limitText); }
    return meta;
  }
  async function fileToResized(file, max) {
    const { img, url } = await validateImageFile(file);
    try {
      const sc = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      const cw = Math.max(1, Math.round(img.naturalWidth * sc)), ch = Math.max(1, Math.round(img.naturalHeight * sc));
      const cv = document.createElement("canvas"); cv.width = cw; cv.height = ch;
      cv.getContext("2d").drawImage(img, 0, 0, cw, ch);
      return cv.toDataURL("image/jpeg", 0.92);
    } finally { URL.revokeObjectURL(url); }
  }
  $on("iconInput", "change", (e) => {
    const f = e.target.files && e.target.files[0]; e.target.value = "";
    if (!f || !iconTargetPid) return;
    const pid = iconTargetPid;
    startCrop(f, 1, 512, 512, async (data) => {
      const p = getProject(pid); if (p) { p.icon = data; p.iconLibraryId = null; await saveProject(p); closeModal(); render(); renderSidebar(); toast("썸네일을 변경했어요"); }
    });
  });

  /* ---------- search ---------- */
  function getNoteSearchText(n) {
    if (!n) return "";
    if (n.type === "lorebook") { const d = n.data || {}; return ((d.content || "") + " " + ((d.keywords || []).join(" "))).toLowerCase(); }
    if (n.type === "log") { const d = normalizeLogData(n.data); return [d.content, ...(d.personaNames || []), d.personaAlias].filter(Boolean).join(" ").toLowerCase(); }
    if (n.type === "persona") { const d = n.data || {}, ko = d.ko || {}, en = d.en || {}; return [ko.name, (ko.tags || []).join(" "), ko.detail, en.name, (en.tags || []).join(" "), en.detail].filter(Boolean).join(" ").toLowerCase(); }
    if (isCharacterCardType(n)) { const d = ensureCharacterData(n); return d.pages.map((p) => [p.ko.name, (p.ko.tags || []).join(" "), p.ko.detail, p.en.name, (p.en.tags || []).join(" "), p.en.detail, p.creatorMemo].join(" ")).join(" ").toLowerCase(); }
    if (n.type === "html") return plainText(htmlSourceOf(n)).toLowerCase();
    if (n.type === "regex") { const d = normalizeRegexData(n.data || {}); return [d.scriptName, d.findRegex, d.replaceString, d.sampleText, d.trimStrings.join(" ")].join(" ").toLowerCase(); }
    return plainText(noteHtml(n)).toLowerCase();
  }
  function doSearch(q) {
    st.searchQuery = (q || "").trim();
    if (curView().s === "search") renderSearch();
    else go({ s: "search" });
  }
  function renderSearch() {
    if (!st.searchScope) st.searchScope = "both";
    const q = (st.searchQuery || "").trim().toLowerCase();
    const si = $("searchInput"); if (si) { if (si.value !== (st.searchQuery || "")) si.value = st.searchQuery || ""; const bar = si.closest(".searchbar"); if (bar) bar.classList.toggle("has-text", !!si.value.length); }
    document.querySelectorAll("#screen-search .scope-btn").forEach((b) => b.classList.toggle("active", b.dataset.s === st.searchScope));
    const scope = st.searchScope;
    const projGrid = $("srProjGrid"), noteList = $("srNoteList");
    projGrid.innerHTML = ""; noteList.innerHTML = "";
    if (!q) {
      $("srProjCount").textContent = "0"; $("srNoteCount").textContent = "0";
      projGrid.innerHTML = '<div class="search-empty">검색어를 입력하세요.</div>';
      noteList.innerHTML = '<div class="search-empty">제목·내용에서 찾아드려요.</div>';
      return;
    }
    const projHit = st.projects.filter((p) => {
      const t = (p.name || "").toLowerCase(), c = (p.description || "").toLowerCase();
      if (scope === "title") return t.includes(q);
      if (scope === "content") return c.includes(q);
      return t.includes(q) || c.includes(q);
    });
    const noteHit = st.notes.filter((n) => {
      const t = (n.title || "").toLowerCase();
      if (scope === "title") return t.includes(q);
      if (scope === "content") return getNoteSearchText(n).includes(q);
      return t.includes(q) || getNoteSearchText(n).includes(q);
    });
    $("srProjCount").textContent = projHit.length;
    $("srNoteCount").textContent = noteHit.length;
    if (!projHit.length) projGrid.innerHTML = '<div class="search-empty">일치하는 프로젝트가 없어요.</div>';
    else projHit.forEach((p) => projGrid.appendChild(makeProjCard(p)));
    if (!noteHit.length) noteList.innerHTML = '<div class="search-empty">일치하는 메모가 없어요.</div>';
    else { const sorted = sortList(noteHit, "recent", (n) => n.title || "", (n) => n.updatedAt || 0); sorted.forEach((n) => noteList.appendChild(buildChip(n))); }
  }

  /* ---------- settings ---------- */
  async function updateStorageUsage() {
    const value = $("setStorageVal"), sub = $("setStorageSub"); if (!value || !sub) return;
    value.textContent = "계산 중";
    try {
      const [files, backups] = await Promise.all([getAll("files"), getAll("backups")]);
      const attachmentBytes = files.reduce((sum, f) => sum + (Number(f.size) || (f.blob && f.blob.size) || 0), 0);
      if (navigator.storage && navigator.storage.estimate) {
        const est = await navigator.storage.estimate();
        const usage = Number(est.usage) || 0, quota = Number(est.quota) || 0;
        value.textContent = quota ? `${fmtSize(usage)} / ${fmtSize(quota)}` : fmtSize(usage);
        sub.textContent = `첨부 ${files.length}개 · ${fmtSize(attachmentBytes)} · 자동 백업 ${backups.length}/${getAutoBackupLimit()}개`;
      } else {
        value.textContent = fmtSize(attachmentBytes);
        sub.textContent = `첨부 ${files.length}개 · 자동 백업 ${backups.length}/${getAutoBackupLimit()}개 · 브라우저 전체 용량은 확인 불가`;
      }
    } catch (e) { value.textContent = "확인 불가"; sub.textContent = "브라우저 저장공간 정보를 읽지 못했어요"; }
  }
  function renderSettings() {
    $("setThemeVal").textContent = st.theme === "light" ? "밝게" : "어둡게";
    $("setFontSub").textContent = (st.userFont && st.userFont.name) ? st.userFont.name : "기본 폰트";
    document.querySelectorAll("#fontSizeSeg button").forEach((b) => b.classList.toggle("on", b.dataset.fs === (st.fontScale || "normal")));
    const av = $("setAccentVal"); if (av) av.innerHTML = `<span class="accent-dot"></span>${themeDisplayName()}`;
    const toolbar = $("setToolbarModeVal"); if (toolbar) toolbar.textContent = st.formatbarMode === "folded" ? "접어두기" : "항상 표시";
    const backupLimit = getAutoBackupLimit(), backupSub = $("setAutoBackupSub"), backupVal = $("setAutoBackupVal");
    if (backupSub) backupSub.textContent = `저장할 때마다 최근 ${backupLimit}개 스냅샷 보관`;
    if (backupVal) backupVal.textContent = `${backupLimit}개 보관 ›`;
    updateStorageUsage();
  }
  const FONT_PRESETS = [
    { name: "Pretendard", label: "프리텐다드", url: "https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.min.css" },
    { name: "Nanum Myeongjo", label: "나눔명조", url: "https://fonts.googleapis.com/css2?family=Nanum+Myeongjo:wght@400;700;800&display=swap" },
    { name: "Gowun Dodum", label: "고운돋움", url: "https://fonts.googleapis.com/css2?family=Gowun+Dodum&display=swap" },
    { name: "IBM Plex Sans KR", label: "IBM Plex Sans KR", url: "https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+KR:wght@400;500;700&display=swap" },
    { name: "Noto Serif KR", label: "본명조 · Noto Serif KR", url: "https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@400;600;700&display=swap" }
  ];
  function applyUserFont(cfg) {
    const old = $("userFontLink"); if (old) old.remove();
    if (cfg && cfg.url) { const l = document.createElement("link"); l.id = "userFontLink"; l.rel = "stylesheet"; l.href = cfg.url; document.head.appendChild(l); }
    if (cfg && cfg.name) { document.documentElement.style.setProperty("--user-font", `'${cfg.name}'`); document.body.classList.add("has-userfont"); }
    else { document.documentElement.style.removeProperty("--user-font"); document.body.classList.remove("has-userfont"); }
    st.userFont = cfg || null;
    try { localStorage.setItem("luminkFont", cfg ? JSON.stringify(cfg) : ""); } catch (e) {}
  }
  function detectUserFont() { let c = null; try { const s = localStorage.getItem("luminkFont"); if (s) c = JSON.parse(s); } catch (e) {} if (c && c.name) applyUserFont(c); }
  function showFontDialog() {
    const cur = st.userFont || {};
    const presets = FONT_PRESETS.map((f, i) => `<button class="font-preset" data-i="${i}" style="font-family:'${f.name}',serif">${f.label}<span class="fp-sub">${f.name}</span></button>`).join("");
    openModal(`<h3>웹폰트</h3><p class="m-sub">프리셋을 고르거나 구글 폰트 등의 CSS 링크를 직접 넣어요.</p>
      <div class="font-presets">${presets}</div>
      <input class="m-input" id="fontUrl" placeholder="폰트 CSS 링크 (https://…)" value="${esc(cur.url || "")}" autocapitalize="off" autocorrect="off">
      <input class="m-input" id="fontName" placeholder="font-family 이름 (예: Nanum Myeongjo)" value="${esc(cur.name || "")}" autocapitalize="off" autocorrect="off" style="margin-top:8px">
      <div class="m-row"><button class="m-btn" id="fontReset">기본으로</button><button class="m-btn primary" id="fontApply">적용</button></div>`);
    FONT_PRESETS.forEach((f) => { if (!document.querySelector(`link[data-prev='${f.name}']`)) { const l = document.createElement("link"); l.rel = "stylesheet"; l.href = f.url; l.setAttribute("data-prev", f.name); document.head.appendChild(l); } });
    $("modalBox").querySelectorAll(".font-preset").forEach((b) => b.addEventListener("click", () => { const f = FONT_PRESETS[+b.dataset.i]; $("fontUrl").value = f.url; $("fontName").value = f.name; }));
    $on("fontReset", "click", () => { applyUserFont(null); closeModal(); renderSettings(); toast("기본 폰트로 되돌렸어요"); });
    $on("fontApply", "click", () => {
      const url = $("fontUrl").value.trim(), name = $("fontName").value.trim();
      if (!name) { toast("font-family 이름을 입력해 주세요"); return; }
      applyUserFont({ url, name }); closeModal(); renderSettings(); toast("폰트를 적용했어요");
    });
  }
  /* backup / restore */
  function blobToBase64(blob) { return new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result).split(",")[1] || ""); fr.onerror = rej; fr.readAsDataURL(blob); }); }
  function base64ToBlob(b64, type) { const bin = atob(b64 || ""); const arr = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i); return new Blob([arr], { type: type || "application/octet-stream" }); }
  function dateStamp() { const d = new Date(), p = (x) => String(x).padStart(2, "0"); return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`; }
  function downloadDoc(text, name, type) {
    const blob = new Blob([text], { type: (type || "text/html") + ";charset=utf-8" });
    const url = URL.createObjectURL(blob), a = document.createElement("a");
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }
  function clearStore(name) { return new Promise((res, rej) => { const r = store(name, "readwrite").clear(); r.onsuccess = () => res(); r.onerror = () => rej(r.error); }); }
  async function reloadState() { st.projects = await getAll("projects"); st.notes = await getAll("notes"); await loadQuickMenuSetting(); }
  async function exportBackup() {
    try {
      const files = await getAll("files"); const fileRecs = [];
      for (const f of files) { try { fileRecs.push({ id: f.id, noteId: f.noteId, name: f.name, type: f.type, size: f.size, createdAt: f.createdAt, data: await blobToBase64(f.blob) }); } catch (e) {} }
      const payload = { app: "lumink", version: 3, exportedAt: now(), projects: st.projects, notes: st.notes, files: fileRecs, quickMenu: jsonCopy(quickMenuConfig()), appearance: appearanceSnapshot() };
      const json = JSON.stringify(payload).replace(/</g, "\\u003c");
      const summary = st.projects.map((p) => {
        const ns = st.notes.filter((n) => n.projectId === p.id);
        return `<section><h2>${esc(p.name)}</h2>${p.description ? `<p class="d">${esc(p.description)}</p>` : ""}<p class="c">메모 ${ns.length}개</p><ul>${ns.map((n) => `<li>${esc(n.title || "(제목 없음)")} <em>${TYPE_LABEL[n.type] || n.type}</em></li>`).join("")}</ul></section>`;
      }).join("");
      const doc = `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>루미잉크 백업 ${new Date().toLocaleDateString("ko")}</title>
<style>body{font-family:-apple-system,"Noto Sans KR",sans-serif;max-width:720px;margin:0 auto;padding:34px 20px;line-height:1.6;color:#1c1b19;background:#faf9f7}h1{font-size:23px;margin:0 0 4px}h2{font-size:17px;margin:22px 0 6px;border-bottom:1px solid #e7e3da;padding-bottom:5px}em{color:#9a948a;font-style:normal;font-size:.82em;margin-left:4px}ul{margin:6px 0 0;padding-left:20px}li{margin:2px 0}.note{color:#a09a8f;font-size:13px}.d{color:#666;margin:2px 0}.c{color:#9a948a;font-size:13px;margin:2px 0}</style></head>
<body><h1>루미 ✦ 잉크 백업</h1><p class="note">${new Date().toLocaleString("ko")} · 프로젝트 ${st.projects.length}개 · 메모 ${st.notes.length}개</p>${summary}
<p class="note" style="margin-top:26px">이 파일을 루미잉크 → 설정 → 백업 복원에서 가져오면 데이터가 복원됩니다.</p>
<script type="application/json" id="lumink-backup">${json}<\/script></body></html>`;
      downloadDoc(doc, `lumink-backup-${dateStamp()}.html`, "text/html");
      toast("백업을 저장했어요");
    } catch (e) { toast("백업에 실패했어요"); }
  }
  function cleanImportedText(value, max) {
    return typeof value === "string" ? value.slice(0, max || 100000) : "";
  }
  function isSafeRecordId(value) {
    return typeof value === "string" && value.length > 0 && value.length <= 180;
  }
  function safeImageSource(value) {
    if (typeof value !== "string") return null;
    const src = value.trim();
    // 앱이 생성하는 이미지 형식만 수용합니다. 외부 원격 주소·SVG·스크립트 URI는 차단해요.
    if (!/^data:image\/(?:png|jpe?g|gif|webp|avif);base64,/i.test(src)) return null;
    return src.length <= 32 * 1024 * 1024 ? src : null;
  }
  function safeVideoSource(value) {
    if (typeof value !== "string") return null;
    const src = value.trim();
    if (!/^data:video\/(?:mp4|webm|ogg|quicktime);base64,/i.test(src)) return null;
    // 30MiB 원본의 Base64 확장분까지 고려한 상한입니다.
    return src.length <= 41 * 1024 * 1024 ? src : null;
  }
  function normalizeImportedProject(raw) {
    if (!raw || !isSafeRecordId(raw.id)) return null;
    return {
      id: raw.id,
      name: cleanImportedText(raw.name, 120) || "이름 없는 프로젝트",
      description: cleanImportedText(raw.description, 2000),
      icon: safeImageSource(raw.icon),
      chipColor: CHIP[raw.chipColor] ? raw.chipColor : null,
      frame: frameById(raw.frame) ? raw.frame : null,
      frameColor: frameById(raw.frame) ? (normalizeFrameColor(raw.frameColor) || "#d4af37") : null,
      isDefault: !!raw.isDefault,
      pinned: !!raw.pinned,
      pinnedAt: Number(raw.pinnedAt) || undefined,
      createdAt: Number(raw.createdAt) || now(),
      updatedAt: Number(raw.updatedAt) || now()
    };
  }
  function normalizeImportedPersonaData(raw) {
    const src = raw && typeof raw === "object" ? raw : {};
    const lang = (value) => {
      const o = value && typeof value === "object" ? value : {};
      const rawTags = Array.isArray(o.tags) ? o.tags : (typeof o.brief === "string" && o.brief.trim() ? [o.brief] : []);
      return {
        name: cleanImportedText(o.name, 240),
        detail: cleanImportedText(o.detail, 200000),
        tags: rawTags.map((tag) => cleanImportedText(String(tag), 120).trim()).filter(Boolean).slice(0, 100)
      };
    };
    return {
      portrait: safeImageSource(src.portrait),
      square: safeImageSource(src.square),
      gallery: (Array.isArray(src.gallery) ? src.gallery : []).map(safeImageSource).filter(Boolean).slice(0, 100),
      ko: lang(src.ko),
      en: lang(src.en)
    };
  }
  function normalizeImportedCharacterData(raw) {
    const src = raw && typeof raw === "object" ? raw : {};
    const pages = Array.isArray(src.pages) ? src.pages : [];
    const normalized = pages.map((page) => {
      const p = normalizeImportedPersonaData(page);
      return {
        id: isSafeRecordId(page && page.id) ? page.id : uid(), portrait: p.portrait, square: p.square, gallery: p.gallery,
        ko: p.ko, en: p.en, creatorMemo: cleanImportedText(page && page.creatorMemo, 200000)
      };
    }).slice(0, 100);
    const safePages = normalized.length ? normalized : [makeCharacterPage()];
    const activeId = isSafeRecordId(src.activeId) && safePages.some((p) => p.id === src.activeId) ? src.activeId : safePages[0].id;
    return { mode: src.mode === "single" ? "single" : "collection", activeId, coverImage: safeImageSource(src.coverImage), pages: safePages, cardTypeVersion: 2 };
  }

  function normalizeImportedAttachments(raw) {
    if (!Array.isArray(raw)) return [];
    return raw.map((a) => {
      if (!a || !isSafeRecordId(a.id)) return null;
      return {
        id: a.id,
        name: cleanImportedText(a.name, 240) || "첨부파일",
        type: cleanImportedText(a.type, 180) || "application/octet-stream",
        size: Math.max(0, Number(a.size) || 0)
      };
    }).filter(Boolean);
  }
  function normalizeImportedNote(raw) {
    if (!raw || !isSafeRecordId(raw.id) || !isSafeRecordId(raw.projectId)) return null;
    const sourceType = ["free", "html", "regex", "lorebook", "log", "persona", "character", "idea"].includes(raw.type) ? raw.type : null;
    if (!sourceType) return null;
    const type = sourceType;
    const note = {
      id: raw.id, projectId: raw.projectId, type,
      title: cleanImportedText(raw.title, 180) || (sourceType === "persona" ? "이름 없는 페르소나" : type === "character" ? "이름 없는 캐릭터 모음" : type === "html" ? "제목 없는 코드 작업실" : type === "regex" ? "새 정규식 작업실" : type === "lorebook" ? "이름 없는 로어북" : type === "log" ? "이름 없는 로그" : "제목 없는 메모"),
      titleLocked: !!raw.titleLocked,
      chipColor: CHIP[raw.chipColor] ? raw.chipColor : null,
      createdAt: Number(raw.createdAt) || now(),
      updatedAt: Number(raw.updatedAt) || now(),
      pinned: !!raw.pinned,
      pinnedAt: Number(raw.pinnedAt) || undefined,
      pinnedHome: !!raw.pinnedHome,
      pinnedHomeAt: Number(raw.pinnedHomeAt) || undefined,
      pinnedSide: !!raw.pinnedSide,
      pinnedSideAt: Number(raw.pinnedSideAt) || undefined,
      data: {}
    };
    const data = raw.data && typeof raw.data === "object" ? raw.data : {};
    if (type === "free") {
      note.data.html = sanitize(cleanImportedText(data.html, 45 * 1024 * 1024)).html;
      const attachments = normalizeImportedAttachments(data.attachments);
      if (attachments.length) note.data.attachments = attachments;
    } else if (type === "html") {
      // 백업·프로젝트 가져오기에서도 raw source를 sanitize/DOM serialization 없이 문자열 그대로 되살립니다.
      note.data = { source: cleanImportedText(data.source, HTML_SOURCE_MAX), previewPolicy: "sandbox-web", exportFormat: data.exportFormat === "json" || data.exportFormat === "md" ? data.exportFormat : "html" };
    } else if (type === "regex") {
      note.data = normalizeRegexData(data);
    } else if (type === "lorebook") {
      note.data = normalizeLoreData(data);
    } else if (type === "log") {
      note.data = normalizeLogData(data);
    } else if (type === "idea") {
      note.data = normalizeImportedIdeaBoardData(data);
    } else if (sourceType === "persona") {
      note.data = Array.isArray(data.pages) ? normalizeImportedCharacterData(data) : legacyPersonaDataToCharacterData(data);
    } else {
      note.data = normalizeImportedCharacterData(data);
    }
    return note;
  }
  function fileBlobFromImport(raw) {
    if (raw && raw.blob instanceof Blob) return raw.blob;
    if (raw && typeof raw.data === "string") {
      try { return base64ToBlob(raw.data, raw.type); } catch (e) { return null; }
    }
    return null;
  }
  function normalizeImportedFile(raw) {
    if (!raw || !isSafeRecordId(raw.id) || !isSafeRecordId(raw.noteId)) return null;
    const blob = fileBlobFromImport(raw);
    if (!blob) return null;
    return {
      id: raw.id, noteId: raw.noteId,
      name: cleanImportedText(raw.name, 240) || "첨부파일",
      type: cleanImportedText(raw.type, 180) || blob.type || "application/octet-stream",
      size: Math.max(0, Number(raw.size) || blob.size || 0),
      createdAt: Number(raw.createdAt) || now(), blob
    };
  }
  function prepareImportData(projects, notes, files, existingFiles, replace) {
    const curDefault = replace ? null : st.projects.find((p) => p.isDefault);
    const remap = {};
    const importedProjects = (projects || []).map(normalizeImportedProject).filter(Boolean);
    const sourceNotes = (notes || []).map(normalizeImportedNote).filter(Boolean);
    const projectsToWrite = [];
    for (const project of importedProjects) {
      if (project.isDefault && curDefault && project.id !== curDefault.id) { remap[project.id] = curDefault.id; continue; }
      projectsToWrite.push(project);
    }

    if (replace && projectsToWrite.length) {
      const primaryDefault = projectsToWrite.find((project) => project.isDefault) || projectsToWrite[0];
      projectsToWrite.forEach((project) => { project.isDefault = project.id === primaryDefault.id; });
    }

    if (replace && !projectsToWrite.length && sourceNotes.length) {
      projectsToWrite.push({ id: uid(), name: "기본 메모함", description: "복원된 메모가 모입니다.", icon: DEFAULT_ICON, isDefault: true, createdAt: now(), updatedAt: now() });
    }

    const availableProjects = replace ? projectsToWrite.slice() : [...st.projects, ...projectsToWrite];
    const projectIds = new Set(availableProjects.map((project) => project.id));
    const fallbackProject = curDefault || availableProjects.find((project) => project.isDefault) || availableProjects[0];
    const notesToWrite = sourceNotes.map((note) => {
      if (remap[note.projectId]) note.projectId = remap[note.projectId];
      if (!projectIds.has(note.projectId) && fallbackProject) note.projectId = fallbackProject.id;
      return projectIds.has(note.projectId) ? note : null;
    }).filter(Boolean);

    const availableNoteIds = new Set((replace ? notesToWrite : [...st.notes, ...notesToWrite]).map((note) => note.id));
    const filesToWrite = (files || []).map(normalizeImportedFile).filter((file) => file && availableNoteIds.has(file.noteId));
    const availableFileIds = new Set([...(replace ? [] : (existingFiles || [])).map((file) => file.id), ...filesToWrite.map((file) => file.id)]);
    for (const note of notesToWrite) {
      if (note.data && Array.isArray(note.data.attachments)) {
        note.data.attachments = note.data.attachments.filter((attachment) => availableFileIds.has(attachment.id));
        if (note.type === "idea" && Array.isArray(note.data.items)) {
          note.data.items = note.data.items.filter((item) => !item.fileId || availableFileIds.has(item.fileId));
          if (note.data.canvas && note.data.canvas.backgroundImage && !availableFileIds.has(note.data.canvas.backgroundImage.fileId)) note.data.canvas.backgroundImage=null;
        }
      }
    }
    return { projects: projectsToWrite, notes: notesToWrite, files: filesToWrite };
  }
  async function applyImportData(projects, notes, files, replace) {
    const existingFiles = replace ? [] : await getAll("files");
    const data = prepareImportData(projects, notes, files, existingFiles, !!replace);
    await transact(["projects", "notes", "files"], "readwrite", (tx) => {
      const projectStore = tx.objectStore("projects"), noteStore = tx.objectStore("notes"), fileStore = tx.objectStore("files");
      if (replace) { projectStore.clear(); noteStore.clear(); fileStore.clear(); }
      data.projects.forEach((project) => projectStore.put(project));
      data.notes.forEach((note) => noteStore.put(note));
      data.files.forEach((file) => fileStore.put(file));
    });
  }
  async function replaceImportData(projects, notes, files) {
    await applyImportData(projects, notes, files, true);
  }
  function restorePayloadLabel(payload, label) {
    const files = Array.isArray(payload.files) ? ` · 첨부 ${payload.files.length}` : "";
    return `${label || "선택한 백업"} · 프로젝트 ${(payload.projects || []).length} · 메모 ${(payload.notes || []).length}${files}`;
  }
  function openRestoreModePicker(payload, label) {
    const summary = restorePayloadLabel(payload, label);
    openModal(`<h3>백업 복원 방식</h3><p class="m-sub">${esc(summary)}</p>
      <button class="restore-mode" id="restoreMerge"><b>현재 데이터에 병합</b><span>같은 ID의 항목만 백업 내용으로 덮어쓰고, 나머지 현재 데이터는 유지해요.</span></button>
      <button class="restore-mode warning" id="restoreReplace"><b>백업 시점으로 완전히 교체</b><span>현재 프로젝트·메모·첨부파일을 지우고 백업 내용만 남겨요.</span></button>
      <p class="m-sub" style="margin:12px 0 0">복원 직전 현재 상태는 자동 백업으로 한 번 더 저장합니다.</p>
      <div class="m-row"><button class="m-btn" id="restoreCancel">취소</button></div>`);
    $on("restoreCancel", "click", closeModal);
    $on("restoreMerge", "click", () => confirmModal("병합 복원", "현재 데이터는 유지하고, 같은 항목만 백업 내용으로 덮어씁니다. 계속할까요?", "병합 복원", false, async () => {
      try {
        await doAutoBackup();
        await applyImportData(payload.projects || [], payload.notes || [], payload.files || [], false);
        await restoreQuickMenuConfig(payload.quickMenu);
        await restoreAppearanceConfig(payload.appearance);
        await reloadState(); render(); renderSidebar(); toast("병합 복원했어요");
      } catch (e) { toast("복원 중 오류가 났어요"); }
    }));
    $on("restoreReplace", "click", () => confirmModal("완전 교체 복원", "현재 프로젝트·메모·첨부파일을 지우고 백업 시점으로 되돌립니다. 방금 상태는 자동 백업에 보관돼요.", "완전 교체", true, async () => {
      try {
        await doAutoBackup();
        await replaceImportData(payload.projects || [], payload.notes || [], payload.files || []);
        await restoreQuickMenuConfig(payload.quickMenu);
        await restoreAppearanceConfig(payload.appearance);
        await reloadState(); goHome(); renderSidebar(); toast("백업 시점으로 되돌렸어요");
      } catch (e) { toast("복원 중 오류가 났어요"); }
    }));
  }
  function restoreBackup(file) {
    const fr = new FileReader();
    fr.onload = () => {
      try {
        const doc = new DOMParser().parseFromString(String(fr.result || ""), "text/html");
        const tag = doc.getElementById("lumink-backup");
        if (!tag) { toast("백업 데이터를 찾지 못했어요"); return; }
        const payload = JSON.parse(tag.textContent);
        if (!payload || payload.app !== "lumink" || !Array.isArray(payload.projects)) { toast("올바른 백업 파일이 아니에요"); return; }
        openRestoreModePicker(payload, "선택한 백업 파일");
      } catch (e) { toast("복원에 실패했어요"); }
    };
    fr.onerror = () => toast("파일을 읽지 못했어요");
    fr.readAsText(file, "UTF-8");
  }
  function resetData() {
    confirmModal("데이터 초기화", "모든 프로젝트·메모·첨부파일과 자동 백업이 영구 삭제됩니다. 먼저 전체 백업을 권장해요.", "계속", true, () => {
      confirmModal("정말 초기화할까요?", "자동 백업을 포함해 되돌릴 수 없어요.", "전부 삭제", true, async () => {
        try {
          if (autoBkTimer) { clearTimeout(autoBkTimer); autoBkTimer = null; }
          await clearStore("notes"); await clearStore("projects"); await clearStore("files"); await clearStore("backups"); await clearStore("settings");
        } catch (e) {}
        location.reload();
      });
    });
  }

  /* ---------- multi-select ---------- */
  function enterSelMode(type, id) {
    st.selMode = true; st.selType = type; st.selIds = new Set(id ? [id] : []);
    document.body.classList.add("sel-mode");
    $("selMove").hidden = type !== "note";
    updateSelBar(); render();
  }
  function exitSelMode() { st.selMode = false; st.selType = null; st.selIds = new Set(); document.body.classList.remove("sel-mode"); updateSelBar(); render(); }
  function toggleSel(id) {
    if (!st.selIds) st.selIds = new Set();
    if (st.selIds.has(id)) st.selIds.delete(id); else st.selIds.add(id);
    updateSelBar();
    document.querySelectorAll(`[data-selid="${id}"]`).forEach((el) => el.classList.toggle("selected", st.selIds.has(id)));
  }
  function isPersonCardNote(n) { return isCharacterCardType(n); }
  function personCardMergeSnapshot(note, sourceIndex) {
    // 병합 결과는 원본을 참조하지 않습니다. 각 페이지와 보조 필드를 복제해
    // 원본 메모를 삭제해도 새 캐릭터 모음이 독립적으로 남도록 합니다.
    const raw = jsonCopy(note && note.data) || {};
    // v64.7: v64에서 페르소나도 pages 기반 카드 데이터로 전환되었습니다.
    // 이미 전환된 페르소나를 구형 변환기에 다시 넣으면 pages가 새 빈 페이지로
    // 치환될 수 있으므로, pages가 있으면 캐릭터 모음과 같은 경로로 그대로 복제합니다.
    const source = Array.isArray(raw.pages)
      ? ensureCharacterData({ data: raw })
      : (note && note.type === "persona"
        ? legacyPersonaDataToCharacterData(raw, true)
        : ensureCharacterData({ data: raw }));
    const coreKeys = new Set(["mode", "activeId", "pages", "coverImage"]);
    const dataExtras = {};
    Object.keys(source).forEach((key) => {
      if (!coreKeys.has(key)) dataExtras[key] = jsonCopy(source[key]) ?? source[key];
    });
    const sourceMeta = {
      noteId: note.id,
      title: String(note.title || ""),
      sourceType: note.type,
      sourceMode: source.mode,
      coverImage: source.coverImage || null,
      chipColor: note.chipColor || null,
      createdAt: note.createdAt || null,
      updatedAt: note.updatedAt || null,
      dataExtras
    };
    const pages = source.pages.map((page, pageIndex) => {
      const copy = jsonCopy(page) || makeCharacterPage();
      // ID 충돌을 막고, 원본 메모·페이지의 출처도 보관합니다.
      copy.id = uid();
      copy.mergeSource = {
        noteId: note.id,
        noteTitle: String(note.title || ""),
        sourceType: note.type,
        sourceMode: source.mode,
        sourceIndex,
        pageIndex
      };
      return ensureCharacterPage(copy);
    });
    return { pages, sourceMeta };
  }
  async function mergePersonCards(notes) {
    const pid = notes[0] && notes[0].projectId;
    if (!pid || !notes.every((n) => n.projectId === pid)) { toast("같은 프로젝트의 인물 카드만 합칠 수 있어요"); return; }
    const targetType = notes[0] && notes[0].type;
    if (!notes.every((n) => n.type === targetType)) { toast("페르소나와 캐릭터는 서로 다른 개념이라 함께 합치지 않아요"); return; }
    const targetLabel = targetType === "persona" ? "페르소나 모음" : "캐릭터 모음";
    let mergedNote = null;
    try {
      // 원본은 삭제하지 않지만, 병합 전 시점도 자동 백업에 남겨 둡니다.
      try { await doAutoBackup(); } catch (e) { console.warn("character merge pre-backup", e); }
      const snapshots = notes.map(personCardMergeSnapshot);
      const pages = snapshots.flatMap((entry) => entry.pages);
      if (!pages.length) { toast("병합할 인물 페이지를 찾지 못했어요"); return; }
      mergedNote = await createNote(targetType, pid, { characterMode: "collection" });
      const firstCover = snapshots.map((entry) => entry.sourceMeta.coverImage).find(Boolean) || null;
      mergedNote.data = {
        mode: "collection",
        activeId: pages[0].id,
        coverImage: firstCover,
        pages,
        cardTypeVersion: 2,
        // 각 원본의 노트 수준 호환 필드와 출처를 보관합니다.
        mergedSources: snapshots.map((entry) => entry.sourceMeta),
        mergedAt: now()
      };
      mergedNote.chipColor = notes.find((n) => n.chipColor)?.chipColor || null;
      mergedNote.titleLocked = false;
      ensureCharacterData(mergedNote);
      syncCharacterTitle(mergedNote);
      await saveCharacter(mergedNote, true);
      exitSelMode();
      st.curNoteId = mergedNote.id;
      st.charEdit = false;
      toast(`${notes.length}개 인물 카드를 ${targetLabel}으로 합쳤어요`);
      go({ s: "character" });
    } catch (e) {
      console.warn("character card merge", e);
      if (mergedNote) {
        st.notes = st.notes.filter((n) => n.id !== mergedNote.id);
        await del("notes", mergedNote.id).catch(() => {});
      }
      toast("인물 카드 병합에 실패했어요. 원본 메모는 그대로 유지됩니다.");
    }
  }
  function updateSelBar() {
    const ids = [...(st.selIds || [])];
    $("selCount").textContent = `${ids.length}개 선택`;
    const mb = $("selMerge");
    if (mb) {
      let ok = false, personCards = false;
      if (st.selType === "note" && ids.length >= 2) {
        const notes = ids.map(getNote).filter(Boolean);
        const t = notes[0] && notes[0].type;
        personCards = notes.length === ids.length && notes.every(isPersonCardNote) && notes.every((n) => n.type === notes[0].type);
        ok = personCards || (!!t && t !== "html" && t !== "idea" && notes.every((n) => n.type === t));
      }
      mb.hidden = !ok;
      mb.textContent = personCards ? "모음으로 합치기" : "합치기";
    }
  }
  async function mergeSelected() {
    const ids = [...(st.selIds || [])];
    if (ids.length < 2) { toast("2개 이상 선택해 주세요"); return; }
    const notes = ids.map(getNote).filter(Boolean);
    if (notes.length !== ids.length) { toast("선택한 메모를 찾지 못했어요"); return; }
    if (notes.every(isPersonCardNote)) {
      if (!notes.every((n) => n.type === notes[0].type)) { toast("페르소나와 캐릭터는 서로 다른 개념이라 함께 합치지 않아요"); return; }
      const label = notes[0].type === "persona" ? "페르소나 모음" : "캐릭터 모음";
      confirmModal(`${label}으로 합치기`, `선택한 ${notes.length}개 인물 카드의 모든 페이지를 새 ${label}에 복제합니다. 원본 메모는 삭제하지 않아요.`, `${label} 만들기`, false, () => { void mergePersonCards(notes); });
      return;
    }
    const type = notes[0].type;
    if (type === "html" || type === "idea") { toast(type === "html" ? "코드 작업실은 원본 보존을 위해 합치지 않아요" : "아이디어 보드는 캔버스 배치를 보존하기 위해 합치지 않아요"); return; }
    if (!notes.every((n) => n.type === type)) { toast("같은 종류끼리만 합칠 수 있어요"); return; }
    const pid = notes[0].projectId;
    if (type === "lorebook") {
      const merged = notes.map((n) => (n.data && n.data.content) || "").filter((s) => s.trim()).join("\n\n");
      const nn = await createNote("lorebook", pid);
      nn.title = "합친 로어북"; nn.data = makeLoreData({ content: merged });
      await saveLore(nn, true);
      exitSelMode(); st.curNoteId = nn.id; toast(`${notes.length}개를 합쳤어요`); go({ s: "lore" });
      return;
    }
    if (type === "log") {
      const first = normalizeLogData(notes[0].data), merged = notes.map((n) => String((n.data && n.data.content) || "")).filter((text) => text.trim()).join("\n\n");
      const nn = await createNote("log", pid);
      nn.title = "합친 로그"; nn.titleLocked = true; nn.data = Object.assign({}, first, { content: merged });
      await saveLog(nn, true); exitSelMode(); st.curNoteId = nn.id; logEditMode = false; toast(`${notes.length}개를 합쳤어요`); go({ s: "log" });
      return;
    }
    const merged = notes.map((n) => noteHtml(n) || "").filter((s) => s.trim()).join('<div><br></div>');
    const nn = await createNote("free", pid);
    nn.data.html = merged; nn.titleLocked = false; nn.title = deriveTitle(merged) || "합친 메모";
    try {
      const allFiles = await getAll("files"); const byId = {}; allFiles.forEach((f) => { byId[f.id] = f; });
      const atts = [];
      for (const n of notes) {
        const list = (n.data && n.data.attachments) || [];
        for (const a of list) {
          const src = byId[a.id]; if (!src) continue;
          const nid = uid();
          await put("files", { id: nid, noteId: nn.id, name: src.name, type: src.type, size: src.size, blob: src.blob, createdAt: now() });
          atts.push({ id: nid, name: a.name, type: a.type, size: a.size });
        }
      }
      if (atts.length) nn.data.attachments = atts;
    } catch (e) {}
    await saveNote(nn);
    exitSelMode(); st.curNoteId = nn.id; toast(`${notes.length}개를 합쳤어요`); go({ s: "read" });
  }
  function selectAllCurrent() {
    if (!st.selIds) st.selIds = new Set();
    if (st.selType === "note") notesOf(st.curProjectId).forEach((n) => st.selIds.add(n.id));
    else st.projects.forEach((p) => st.selIds.add(p.id));
    updateSelBar(); render();
  }
  function bulkDelete() {
    const ids = [...(st.selIds || [])]; if (!ids.length) { toast("선택된 항목이 없어요"); return; }
    const isNote = st.selType === "note";
    confirmModal(isNote ? "메모 삭제" : "프로젝트 삭제", `선택한 ${ids.length}개를 삭제할까요?${isNote ? "" : " 소속 메모도 함께 삭제돼요."}`, "삭제", true, async () => {
      if (isNote) await deleteNotesBatch(ids); else await deleteProjectsBatch(ids);
      exitSelMode(); renderSidebar();
    });
  }
  function bulkMove() {
    const ids = [...(st.selIds || [])]; if (!ids.length) { toast("선택된 항목이 없어요"); return; }
    pickTargetProject(st.curProjectId, async (pid) => { for (const id of ids) await moveNote(id, pid); exitSelMode(); renderSidebar(); toast("이동했어요"); });
  }

  /* ---------- HTML export / import ---------- */
  function exportNote(id) {
    const n = getNote(id); if (!n) return;
    const title = n.title || "메모", html = noteHtml(n);
    const doc = `<!DOCTYPE html>
<html lang="ko"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="generator" content="Lumink"><meta name="lumink-created" content="${new Date(n.createdAt).toISOString()}">
<title>${esc(title)}</title>
<style>body{margin:0 auto;max-width:760px;padding:32px 20px;line-height:1.7;font-family:-apple-system,"Noto Sans KR",sans-serif;color:#1c1b19;word-break:break-word}img{max-width:100%;height:auto}a{color:#2f6fd0}a.lumi-link{color:#2f6fd0;text-decoration:none;font-weight:600;background:rgba(47,111,208,.09);border:1px solid rgba(47,111,208,.3);padding:1px 7px;border-radius:7px}blockquote{border-left:3px solid #2f6fd0;margin:8px 0;padding:2px 0 2px 14px;color:#555}table{border-collapse:collapse}td,th{border:1px solid #ddd;padding:4px 8px}pre{background:#f0ede6;padding:12px;border-radius:8px;overflow-x:auto}</style>
</head><body>
${html}
</body></html>`;
    const name = (title.replace(/[\\/:*?"<>|]+/g, "_").slice(0, 50) || "memo") + ".html";
    const blob = new Blob([doc], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob), a = document.createElement("a");
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    toast(".html로 저장했어요");
  }
  async function exportProjectPackage(id) {
    await flushPending();
    const project = getProject(id); if (!project) { toast("프로젝트를 찾을 수 없어요"); return; }
    try {
      const notes = notesOf(id).map(jsonCopy).filter(Boolean);
      const noteIds = new Set(notes.map((note) => note.id));
      const sourceFiles = (await getAll("files")).filter((file) => noteIds.has(file.noteId));
      const files = [];
      for (const file of sourceFiles) {
        try {
          files.push({
            id: file.id, noteId: file.noteId, name: file.name, type: file.type,
            size: file.size, createdAt: file.createdAt, data: await blobToBase64(file.blob)
          });
        } catch (e) { console.warn("project export file", file && file.id, e); }
      }
      const payload = {
        app: "lumink", kind: "project", version: 1, exportedAt: now(),
        project: jsonCopy(project), notes, files
      };
      const json = JSON.stringify(payload).replace(/</g, "\\u003c");
      const counts = notes.reduce((result, note) => {
        const key = TYPE_LABEL[note.type] || note.type; result[key] = (result[key] || 0) + 1; return result;
      }, {});
      const countText = Object.entries(counts).map(([type, count]) => `${esc(type)} ${count}`).join(" · ") || "메모 없음";
      const noteList = notes.length
        ? `<ul>${notes.map((note) => `<li><span>${esc(note.title || "(제목 없음)")}</span><em>${esc(TYPE_LABEL[note.type] || note.type)}</em></li>`).join("")}</ul>`
        : '<p class="empty">이 프로젝트에는 메모가 없습니다.</p>';
      const doc = `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="generator" content="Lumink"><meta name="lumink-kind" content="project"><title>${esc(project.name)} · 루미잉크 프로젝트</title>
<style>body{font-family:-apple-system,"Noto Sans KR",sans-serif;max-width:720px;margin:0 auto;padding:36px 20px 64px;line-height:1.65;color:#1d2330;background:#f7f8fb}main{background:#fff;border:1px solid #dfe4ee;border-radius:18px;padding:24px;box-shadow:0 8px 28px rgba(38,56,92,.1)}h1{margin:0 0 6px;font-size:24px}.meta,.hint,.empty{color:#6d7687;font-size:13px}.tags{margin:15px 0;color:#49556a}.tags span{display:inline-block;margin:0 5px 5px 0;padding:4px 10px;border-radius:999px;background:#edf2ff;color:#405b95;font-size:12px}ul{list-style:none;padding:0;margin:20px 0 0}li{display:flex;justify-content:space-between;gap:14px;padding:10px 0;border-top:1px solid #edf0f5}li span{min-width:0;overflow-wrap:anywhere}em{flex:0 0 auto;color:#7c8799;font-style:normal;font-size:12px}.hint{margin-top:24px;padding-top:16px;border-top:1px solid #edf0f5}</style></head><body><main><h1>${esc(project.name)}</h1><p class="meta">내보낸 시각 ${esc(new Date(payload.exportedAt).toLocaleString("ko"))} · 메모 ${notes.length}개 · 첨부 ${files.length}개</p>${project.description ? `<div class="tags">${String(project.description).split(",").map((tag) => tag.trim()).filter(Boolean).map((tag) => `<span>${esc(tag)}</span>`).join("")}</div>` : ""}<p class="meta">${countText}</p>${noteList}<p class="hint">루미잉크의 사이드바 → 열기에서 이 파일을 선택하면 새 프로젝트로 가져올 수 있습니다.</p></main><script type="application/json" id="lumink-project">${json}<\/script></body></html>`;
      const safeName = (project.name || "project").replace(/[\\/:*?"<>|]+/g, "_").slice(0, 50) || "project";
      downloadDoc(doc, `${safeName}-lumink-project-${dateStamp()}.html`, "text/html");
      toast(`프로젝트를 저장했어요 · 메모 ${notes.length}개`);
    } catch (e) { console.warn("project export", e); toast("프로젝트 내보내기에 실패했어요"); }
  }
  function personaExportPalette(theme) {
    const root = document.documentElement;
    const hadTheme = root.hasAttribute("data-theme");
    const previousTheme = root.getAttribute("data-theme");
    root.setAttribute("data-theme", theme === "light" ? "light" : "dark");
    const css = getComputedStyle(root);
    const read = (name, fallback) => css.getPropertyValue(name).trim() || fallback;
    const palette = {
      bg: read("--bg", "#0d0f17"),
      text: read("--ink", "#e9eaf2"),
      title: read("--logo-ink", "#aebcec"),
      panel: read("--surface", "#181b26"),
      panel2: read("--surface-2", "#20242f"),
      line: read("--line", "#272b38"),
      chipBg: read("--accent-soft", "#16202f"),
      chipColor: read("--accent", "#6ad0ff"),
      muted: read("--muted", "#9a9fb2"),
      shadow: read("--shadow", "0 1px 4px rgba(46,86,170,.30), 0 6px 16px rgba(14,22,48,.46)")
    };
    if (hadTheme) root.setAttribute("data-theme", previousTheme);
    else root.removeAttribute("data-theme");
    return palette;
  }
  function personaExportCSS(theme) {
    const c = personaExportPalette(theme);
    return `body{margin:0;background:${c.bg};color:${c.text};font-family:-apple-system,BlinkMacSystemFont,"Noto Sans KR","Segoe UI",sans-serif;word-break:break-word}
.wrap{max-width:680px;margin:0 auto;padding:28px 18px 64px}
.ptitle{font-size:24px;font-weight:800;color:${c.title};margin:0 0 18px}
.portrait{width:280px;max-width:82%;aspect-ratio:3/4;margin:0 auto 24px;border-radius:16px;overflow:hidden;background:${c.panel2};box-shadow:${c.shadow}}
.portrait img{width:100%;height:100%;object-fit:cover;display:block}
.lang{margin:0 0 28px}
.lang-head{display:inline-block;font-weight:700;font-size:13px;color:${c.chipColor};background:${c.chipBg};padding:5px 13px;border-radius:999px;margin-bottom:13px}
.idrow{display:flex;gap:14px;align-items:center;margin-bottom:14px}
.sq{width:100px;height:100px;border-radius:15px;overflow:hidden;flex:0 0 auto;background:${c.panel2}}
.sq img{width:100%;height:100%;object-fit:cover;display:block}
.pname{font-size:21px;font-weight:750;margin-bottom:8px}
.tags{display:flex;flex-wrap:wrap;gap:6px}
.kw-chip{display:inline-block;background:${c.chipBg};color:${c.chipColor};border:1px solid ${c.line};padding:4px 11px;border-radius:8px;font-size:13px}
.detail{background:${c.panel};border:1px solid ${c.line};border-radius:14px;padding:15px 16px;line-height:1.72;font-size:15.5px;box-shadow:${c.shadow}}
.detail .pr-line{white-space:pre-wrap}.detail .pr-gap{height:.7em}.detail .pr-empty{color:${c.muted}}
.detail .pr-head{margin:14px 0 10px;padding:9px 14px;border-radius:11px;border:1px solid ${c.line};border-left:2px solid ${c.chipColor};background:linear-gradient(135deg,${c.chipBg},transparent);font-weight:750;color:${c.chipColor}}
.detail .pr-head:first-child{margin-top:0}
.detail .pr-li{display:flex;gap:7px;align-items:baseline;margin:4px 0;padding-left:9px}
.detail .pr-bullet{color:${c.chipColor};font-size:8px;flex:0 0 auto}
.detail .pr-mini{margin:6px 0;line-height:1.6}
.detail .pr-mini-key{display:inline-block;background:${c.chipBg};color:${c.chipColor};font-weight:700;font-size:.9em;padding:2px 10px;border-radius:7px;margin-right:8px}
.detail .md-tag{margin:13px 0}
.detail .md-tag-open,.detail .md-tag-close{font-family:ui-monospace,monospace;font-size:.82em;font-weight:700;color:${c.chipColor};opacity:.82}
.detail .md-tag-open{margin-bottom:5px}.detail .md-tag-close{margin-top:5px}
.detail .md-tag-body{padding:9px 13px;border-left:2px solid ${c.chipColor};border-radius:0 10px 10px 0;background:${c.chipBg}}
.gal-label{display:inline-block;font-weight:700;font-size:13px;color:${c.chipColor};background:${c.chipBg};padding:5px 13px;border-radius:999px;margin:24px 0 12px}
.gallery{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.gallery img{width:100%;aspect-ratio:1;object-fit:cover;border-radius:11px;display:block}
.foot{margin-top:30px;text-align:center;color:${c.muted};font-size:12px}`;
  }
  function choosePersonaExportTheme(id) {
    const accent = { name: themeDisplayName() };
    openModal(`<h3>HTML로 저장</h3><p class="m-sub">현재 컬러 테마(<b>${esc(accent.name)}</b>)를 유지한 채, 저장할 카드의 밝기만 골라요.</p><div class="m-row"><button class="m-btn" id="pxLight">밝게</button><button class="m-btn primary" id="pxDark">어둡게</button></div>`);
    $on("pxLight", "click", () => { closeModal(); exportPersonaHtml(id, "light"); });
    $on("pxDark", "click", () => { closeModal(); exportPersonaHtml(id, "dark"); });
  }
  function exportPersonaHtml(id, theme) {
    const n = getNote(id); if (!n || n.type !== "persona") return;
    const d = n.data || {};
    const langBlock = (o, label) => {
      if (!o) return "";
      const has = (o.name || "").trim() || (o.detail || "").trim() || (o.tags || []).length;
      if (!has) return "";
      const tags = (o.tags || []).map((t) => `<span class="kw-chip">${esc(t)}</span>`).join("");
      const sq = d.square || d.portrait;
      return `<section class="lang"><div class="lang-head">${label}</div>
  <div class="idrow">${sq ? `<div class="sq"><img src="${sq}" alt=""></div>` : ""}<div class="idtext"><div class="pname">${esc(o.name || "(이름 없음)")}</div><div class="tags">${tags}</div></div></div>
  <div class="detail">${personaDetailHTML(o.detail)}</div></section>`;
    };
    const portrait = d.portrait ? `<div class="portrait"><img src="${d.portrait}" alt=""></div>` : "";
    const gallery = (d.gallery && d.gallery.length) ? `<div class="gal-label">갤러리</div><div class="gallery">${d.gallery.map((s) => `<img src="${s}" alt="">`).join("")}</div>` : "";
    const payload = JSON.stringify({ app: "lumink", kind: "persona", title: n.title, data: d }).replace(/</g, "\\u003c");
    const doc = `<!DOCTYPE html>
<html lang="ko"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="generator" content="Lumink"><meta name="lumink-kind" content="persona">
<title>${esc(n.title || "페르소나")}</title>
<style>${personaExportCSS(theme === "dark" ? "dark" : "light")}</style>
</head><body>
<main class="wrap">
<h1 class="ptitle">${esc(n.title || "페르소나")}</h1>
${portrait}
${langBlock(d.ko, "한국어")}
${langBlock(d.en, "English")}
${gallery}
<div class="foot">Lumi Ink · 페르소나 카드</div>
</main>
<script type="application/json" id="lumink-persona">${payload}<\/script>
</body></html>`;
    const name = ((n.title || "persona").replace(/[\\/:*?"<>|]+/g, "_").slice(0, 50) || "persona") + ".html";
    const blob = new Blob([doc], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob), a = document.createElement("a");
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    toast("HTML로 저장했어요");
  }
  function chooseCharacterExportOptions(id) {
    const n = getNote(id); if (!n || !isCharacterCardType(n)) return;
    const accent = { name: themeDisplayName() };
    const title = n.type === "persona" ? (characterMode(n) === "single" ? "페르소나 HTML로 저장" : "페르소나 모음 HTML로 저장") : (characterMode(n) === "single" ? "캐릭터 HTML로 저장" : "캐릭터 모음 HTML로 저장");
    openModal(`<h3>${title}</h3><p class="m-sub">현재 컬러 테마(<b>${esc(accent.name)}</b>)를 유지한 채 밝기를 고르고, 제작용 메모 포함 여부를 정해요.</p><label class="lore-toggle-wrap" style="margin:5px 0 16px"><input type="checkbox" id="cxCreator"> 크리에이터 메모 포함</label><p class="m-sub" style="margin-top:-7px">기본값은 미포함이에요. 공유용 카드에 제작 메모가 섞이지 않도록 보호합니다.</p><div class="m-row"><button class="m-btn" id="cxLight">밝게</button><button class="m-btn primary" id="cxDark">어둡게</button></div>`);
    const run = (theme) => { const includeCreator = !!$("cxCreator").checked; closeModal(); exportCharacterHtml(id, theme, includeCreator); };
    $on("cxLight", "click", () => run("light")); $on("cxDark", "click", () => run("dark"));
  }
  function exportCharacterHtml(id, theme, includeCreator) {
    const n = getNote(id); if (!n || !isCharacterCardType(n)) return;
    const d = ensureCharacterData(n);
    const langBlock = (page, lang, label) => {
      const o = page[lang] || {}, has = (o.name || "").trim() || (o.detail || "").trim() || (o.tags || []).length;
      if (!has) return "";
      const tags = (o.tags || []).map((tag) => `<span class="kw-chip">${esc(tag)}</span>`).join("");
      const sq = page.square || page.portrait;
      return `<section class="lang"><div class="lang-head">${label}</div><div class="idrow">${sq ? `<div class="sq"><img src="${sq}" alt=""></div>` : ""}<div class="idtext"><div class="pname">${esc(o.name || "(이름 없음)")}</div><div class="tags">${tags}</div></div></div><div class="detail">${personaDetailHTML(o.detail)}</div></section>`;
    };
    const pageHtml = d.pages.map((page, index) => {
      const portrait = page.portrait ? `<div class="portrait"><img src="${page.portrait}" alt=""></div>` : "";
      const gallery = page.gallery && page.gallery.length ? `<div class="gal-label">갤러리</div><div class="gallery">${page.gallery.map((src) => `<img src="${src}" alt="">`).join("")}</div>` : "";
      const creatorHtml = normalizeCreatorMemo(page.creatorMemo);
      const creator = includeCreator && creatorHtml.trim() ? `<section class="creator"><div class="creator-label">CREATOR NOTE</div><div class="detail creator-rich">${creatorHtml}</div></section>` : "";
      return `<article class="char-page" data-page="${index}"${index ? " hidden" : ""}>${portrait}${langBlock(page, "ko", "한국어")}${langBlock(page, "en", "English")}${creator}${gallery}</article>`;
    }).join("");
    const nav = d.pages.length > 1 ? `<nav class="cnav">${d.pages.map((page, index) => { const src = page.square || page.portrait; return `<button type="button" data-page="${index}"${index === 0 ? ' class="active"' : ""}>${src ? `<img src="${src}" alt="">` : `<span class="nav-placeholder">${index + 1}</span>`}<span>${esc(charPageName(page, "ko"))}</span></button>`; }).join("")}</nav>` : "";
    const exportData = jsonCopy(d) || { activeId: d.activeId, pages: d.pages };
    if (!includeCreator) exportData.pages.forEach((page) => { page.creatorMemo = ""; });
    const exportKind = n.type === "persona" ? "persona" : "character";
    const single = characterMode(n) === "single";
    const kindName = exportKind === "persona" ? "페르소나" : "캐릭터";
    const collectionName = `${kindName} 모음`;
    const fallbackTitle = single ? kindName : collectionName;
    const footLabel = single ? `${kindName} 카드` : collectionName;
    const payload = JSON.stringify({ app: "lumink", kind: exportKind, title: n.title, data: exportData }).replace(/</g, "\\u003c");
    const css = personaExportCSS(theme === "dark" ? "dark" : "light") + `.cnav{display:flex;gap:8px;overflow:auto;margin:0 0 20px;padding:3px 1px 5px}.cnav button{border:1px solid ${personaExportPalette(theme === "dark" ? "dark" : "light").line};background:transparent;color:inherit;border-radius:12px;padding:6px 9px;display:flex;gap:7px;align-items:center;cursor:pointer;white-space:nowrap;font:inherit;font-size:12px}.cnav button.active{border-color:${personaExportPalette(theme === "dark" ? "dark" : "light").chipColor};background:${personaExportPalette(theme === "dark" ? "dark" : "light").chipBg};color:${personaExportPalette(theme === "dark" ? "dark" : "light").chipColor}}.cnav img,.nav-placeholder{width:28px;height:28px;border-radius:8px;object-fit:cover;background:${personaExportPalette(theme === "dark" ? "dark" : "light").panel2};display:grid;place-items:center}.char-page[hidden]{display:none}.creator{margin:0 0 28px}.creator-label{display:inline-block;font-weight:800;font-size:11px;letter-spacing:.11em;color:${personaExportPalette(theme === "dark" ? "dark" : "light").chipColor};background:${personaExportPalette(theme === "dark" ? "dark" : "light").chipBg};padding:5px 12px;border-radius:999px;margin-bottom:11px}.creator .detail{border-left:3px solid ${personaExportPalette(theme === "dark" ? "dark" : "light").chipColor}}.creator-rich img{max-width:100%;height:auto;border-radius:8px}.creator-rich pre{overflow:auto}.creator-rich a{color:${personaExportPalette(theme === "dark" ? "dark" : "light").chipColor}}`;
    const doc = `<!DOCTYPE html>
<html lang="ko"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><meta name="generator" content="Lumink"><meta name="lumink-kind" content="${exportKind}"><title>${esc(n.title || fallbackTitle)}</title><style>${css}</style></head><body><main class="wrap"><h1 class="ptitle">${esc(n.title || fallbackTitle)}</h1>${nav}${pageHtml}<div class="foot">Lumi Ink · ${footLabel}</div></main><script type="application/json" id="lumink-character">${payload}<\/script><script>(function(){var pages=[].slice.call(document.querySelectorAll('.char-page')),buttons=[].slice.call(document.querySelectorAll('.cnav button'));function show(i){pages.forEach(function(p,x){p.hidden=x!==i});buttons.forEach(function(b,x){b.classList.toggle('active',x===i)});window.scrollTo({top:0,behavior:'smooth'})}buttons.forEach(function(b){b.addEventListener('click',function(){show(+b.dataset.page)})})})();<\/script></body></html>`;
    const name = ((n.title || exportKind).replace(/[\\/:*?"<>|]+/g, "_").slice(0, 50) || exportKind) + ".html";
    const blob = new Blob([doc], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob), a = document.createElement("a"); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500); toast(`${footLabel} HTML로 저장했어요`);
  }

  // 자유 메모는 인라인 디자인 HTML을 보관하는 용도도 겸합니다.
  // 실행 코드만 막고, 정적인 구조·SVG·인라인 CSS는 최대한 손실 없이 보존합니다.
  const SAFE_HTML_TAGS = new Set([
    "a", "abbr", "address", "article", "aside", "b", "bdi", "bdo", "blockquote", "br", "caption", "cite", "code", "col", "colgroup",
    "data", "dd", "del", "details", "dfn", "div", "dl", "dt", "em", "figcaption", "figure", "font", "footer", "h1", "h2", "h3", "h4", "h5", "h6",
    "header", "hr", "i", "img", "ins", "kbd", "li", "main", "mark", "menu", "nav", "ol", "p", "picture", "pre", "q", "s", "samp", "section", "video",
    "small", "source", "span", "strike", "strong", "sub", "summary", "sup", "table", "tbody", "td", "tfoot", "th", "thead", "time", "tr", "u", "ul", "var", "wbr"
  ]);
  const SAFE_SVG_TAGS = new Set([
    "svg", "g", "path", "rect", "circle", "ellipse", "line", "polyline", "polygon", "defs", "lineargradient", "radialgradient", "stop",
    "clippath", "mask", "pattern", "symbol", "use", "marker", "filter", "fegaussianblur", "feoffset", "fecolormatrix", "feblend", "femerge",
    "femergenode", "fedropshadow", "text", "tspan", "title", "desc"
  ]);
  const DROP_HTML_TAGS = new Set(["script", "link", "meta", "base", "iframe", "frame", "object", "embed", "form", "input", "button", "select", "textarea", "audio", "math", "template", "foreignobject"]);
  const SAFE_SVG_ATTRS = new Set([
    "alignment-baseline", "baseline-shift", "clip-path", "clip-rule", "color", "cx", "cy", "d", "dominant-baseline", "dx", "dy", "fill", "fill-opacity", "fill-rule",
    "filter", "font-family", "font-size", "font-style", "font-weight", "gradienttransform", "gradientunits", "height", "letter-spacing", "marker-end", "marker-height",
    "marker-mid", "marker-start", "marker-width", "mask", "offset", "opacity", "orient", "overflow", "pathlength", "patterncontentunits", "patterntransform", "patternunits",
    "points", "preserveaspectratio", "r", "refx", "refy", "rotate", "rx", "ry", "shape-rendering", "spreadmethod", "stop-color", "stop-opacity", "stroke", "stroke-dasharray",
    "stroke-dashoffset", "stroke-linecap", "stroke-linejoin", "stroke-miterlimit", "stroke-opacity", "stroke-width", "text-anchor", "transform", "transform-origin", "vector-effect", "viewbox",
    "visibility", "width", "x", "x1", "x2", "y", "y1", "y2"
  ]);
  const BLOCKED_CSS = /(?:expression\s*\(|javascript\s*:|vbscript\s*:|@import\b|behavior\s*:|-moz-binding\b)/i;
  const SVG_ATTR_CANON = {
    viewbox: "viewBox", preserveaspectratio: "preserveAspectRatio", gradienttransform: "gradientTransform", gradientunits: "gradientUnits",
    markerheight: "markerHeight", markerwidth: "markerWidth", refx: "refX", refy: "refY", patterncontentunits: "patternContentUnits",
    patterntransform: "patternTransform", patternunits: "patternUnits", pathlength: "pathLength"
  };

  function splitCssTopLevel(value, delimiter) {
    const out = [], src = String(value || "");
    let buf = "", quote = "", depth = 0, escaped = false;
    for (let i = 0; i < src.length; i++) {
      const ch = src[i];
      if (quote) {
        buf += ch;
        if (escaped) { escaped = false; continue; }
        if (ch === "\\") { escaped = true; continue; }
        if (ch === quote) quote = "";
        continue;
      }
      if (ch === '"' || ch === "'") { quote = ch; buf += ch; continue; }
      if (ch === "(" || ch === "[") { depth++; buf += ch; continue; }
      if (ch === ")" || ch === "]") { depth = Math.max(0, depth - 1); buf += ch; continue; }
      if (ch === delimiter && depth === 0) { out.push(buf); buf = ""; continue; }
      buf += ch;
    }
    out.push(buf);
    return out;
  }
  function splitCssDecl(part) {
    const bits = splitCssTopLevel(part, ":");
    if (bits.length < 2) return null;
    const prop = bits.shift().trim().toLowerCase();
    const value = bits.join(":").trim();
    return { prop, value };
  }
  function safeCssUrl(raw) {
    const value = String(raw || "").trim().replace(/^['"]|['"]$/g, "");
    // 배경 이미지는 앱이 자체 보관한 data:image과 내부 SVG 참조만 허용합니다.
    if (/^#[-a-zA-Z0-9_:.]+$/.test(value)) return `url("${value}")`;
    return /^data:image\/(?:png|jpe?g|gif|webp|avif);base64,/i.test(value) ? `url("${value}")` : "";
  }
  function safeCssValue(value) {
    if (!value || value.length > 12000 || BLOCKED_CSS.test(value)) return "";
    let safe = value.replace(/url\(\s*([^)]*?)\s*\)/gi, (_all, raw) => safeCssUrl(raw));
    if (BLOCKED_CSS.test(safe)) return "";
    return safe.trim();
  }
  function safeCss(style) {
    if (typeof style !== "string") return "";
    return splitCssTopLevel(style, ";").map((part) => {
      const decl = splitCssDecl(part); if (!decl) return "";
      const { prop } = decl;
      if (!/^(?:--[a-z0-9_-]+|-(?:webkit|moz|ms|o)-[a-z][a-z0-9-]*|[a-z][a-z0-9-]*)$/i.test(prop)) return "";
      if (prop === "behavior" || prop === "-moz-binding") return "";
      const value = safeCssValue(decl.value); if (!value) return "";
      return `${prop}:${value}`;
    }).filter(Boolean).join(";");
  }
  function cssBlockEnd(src, openIndex) {
    let depth = 0, quote = "", escaped = false;
    for (let i = openIndex; i < src.length; i++) {
      const ch = src[i];
      if (quote) {
        if (escaped) { escaped = false; continue; }
        if (ch === "\\") { escaped = true; continue; }
        if (ch === quote) quote = "";
        continue;
      }
      if (ch === '"' || ch === "'") { quote = ch; continue; }
      if (ch === "{") depth++;
      else if (ch === "}" && --depth === 0) return i;
    }
    return -1;
  }
  function cssNextBrace(src, from) {
    let quote = "", escaped = false, paren = 0;
    for (let i = from; i < src.length; i++) {
      const ch = src[i];
      if (quote) {
        if (escaped) { escaped = false; continue; }
        if (ch === "\\") { escaped = true; continue; }
        if (ch === quote) quote = "";
        continue;
      }
      if (ch === '"' || ch === "'") { quote = ch; continue; }
      if (ch === "(") { paren++; continue; }
      if (ch === ")") { paren = Math.max(0, paren - 1); continue; }
      if (ch === "{" && paren === 0) return i;
    }
    return -1;
  }
  function scopeCssSelector(selector) {
    let s = String(selector || "").trim();
    if (!s) return "";
    // 문서 전역 선택자는 메모 미리보기 래퍼로 한정합니다.
    s = s.replace(/(^|[\s>+~])(?:html|body|:root)(?=\b|[.#[:])/gi, "$1.lumink-user-html");
    if (s === "*" || s === ":scope") return ".lumink-user-html" + (s === "*" ? " *" : "");
    if (s.startsWith(".lumink-user-html")) return s;
    return `.lumink-user-html ${s}`;
  }
  function scopeCssSelectors(prelude) {
    return splitCssTopLevel(prelude, ",").map(scopeCssSelector).filter(Boolean).join(",");
  }
  function sanitizeKeyframes(css) {
    const src = String(css || ""); let out = "", at = 0;
    while (at < src.length) {
      const open = cssNextBrace(src, at); if (open < 0) break;
      const close = cssBlockEnd(src, open); if (close < 0) break;
      const label = src.slice(at, open).trim();
      const decl = safeCss(src.slice(open + 1, close));
      if (label && decl) out += `${label}{${decl}}`;
      at = close + 1;
    }
    return out;
  }
  function scopeUserCss(css) {
    const src = String(css || "").replace(/\/\*[\s\S]*?\*\//g, "");
    if (!src || src.length > 350000 || BLOCKED_CSS.test(src)) return "";
    let out = "", at = 0;
    while (at < src.length) {
      const open = cssNextBrace(src, at); if (open < 0) break;
      const close = cssBlockEnd(src, open); if (close < 0) break;
      const prelude = src.slice(at, open).trim();
      const inner = src.slice(open + 1, close);
      if (/^@(media|supports|container|layer)\b/i.test(prelude)) {
        const nested = scopeUserCss(inner); if (nested) out += `${prelude}{${nested}}`;
      } else if (/^@(?:-webkit-)?keyframes\b/i.test(prelude)) {
        const frames = sanitizeKeyframes(inner); if (frames) out += `${prelude}{${frames}}`;
      } else if (!/^@/i.test(prelude)) {
        const selectors = scopeCssSelectors(prelude), decl = safeCss(inner);
        if (selectors && decl) out += `${selectors}{${decl}}`;
      }
      at = close + 1;
    }
    return out;
  }
  function safeLinkHref(value) {
    const href = typeof value === "string" ? value.trim() : "";
    if (!href) return "";
    if (/^(https?:|mailto:|tel:|#)/i.test(href)) return href;
    return "";
  }
  function safeSvgHref(value) {
    const href = typeof value === "string" ? value.trim() : "";
    if (/^#[-a-zA-Z0-9_:.]+$/.test(href)) return href;
    return safeImageSource(href) || "";
  }
  function safeAttrText(value, max) {
    const str = cleanImportedText(value, max || 1000);
    return /(?:javascript:|vbscript:|<\/?script)/i.test(str) ? "" : str;
  }
  function safeClassName(value) {
    return safeAttrText(value, 1800).split(/\s+/).filter((name) => /^[a-zA-Z_][\w:-]*$/.test(name)).join(" ");
  }
  function unwrapHtmlElement(el) {
    const parent = el.parentNode; if (!parent) return;
    while (el.firstChild) parent.insertBefore(el.firstChild, el);
    el.remove();
  }
  function sanitize(html) {
    const doc = new DOMParser().parseFromString(String(html || ""), "text/html");
    const titleEl = doc.querySelector("title");
    // <head>와 본문에 있던 static CSS는 보관하되, 메모 래퍼 내부로만 범위를 좁힙니다.
    const styles = [...doc.querySelectorAll("style")].map((style) => style.textContent || "");
    doc.querySelectorAll("style").forEach((style) => style.remove());
    [...doc.body.querySelectorAll("*")].forEach((el) => {
      const tag = el.tagName.toLowerCase();
      const isSvg = SAFE_SVG_TAGS.has(tag);
      if (DROP_HTML_TAGS.has(tag)) { el.remove(); return; }
      if (!SAFE_HTML_TAGS.has(tag) && !isSvg) { unwrapHtmlElement(el); return; }
      const attrs = [...el.attributes].map((a) => [a.name.toLowerCase(), a.value]);
      [...el.attributes].forEach((a) => el.removeAttribute(a.name));
      const find = (name) => { const found = attrs.find(([key]) => key === name); return found ? found[1] : ""; };
      const set = (name, value) => { if (value) el.setAttribute(name, value); };
      const style = safeCss(find("style")); if (style) set("style", style);
      const title = safeAttrText(find("title"), 500); if (title) set("title", title);
      const cls = safeClassName(find("class")); if (cls) set("class", cls);
      const id = safeAttrText(find("id"), 240); if (/^[a-zA-Z_][\w:.-]*$/.test(id)) set("id", id);
      const role = safeAttrText(find("role"), 80); if (/^[a-zA-Z-]+$/.test(role)) set("role", role);
      attrs.forEach(([name, value]) => {
        if (/^(?:data|aria)-[a-z0-9_.:-]+$/i.test(name)) { const safe = safeAttrText(value, 1000); if (safe) set(name, safe); }
      });
      if (tag === "a") {
        const href = safeLinkHref(find("href"));
        if (!href) { unwrapHtmlElement(el); return; }
        set("href", href);
        if (find("target") === "_blank") { set("target", "_blank"); set("rel", "noopener noreferrer"); }
      } else if (tag === "img") {
        const src = safeImageSource(find("src"));
        if (!src) { el.remove(); return; }
        set("src", src);
        const alt = safeAttrText(find("alt"), 500); if (alt) set("alt", alt);
        const width = safeAttrText(find("width"), 12); if (/^\d{1,5}$/.test(width)) set("width", width);
        const height = safeAttrText(find("height"), 12); if (/^\d{1,5}$/.test(height)) set("height", height);
      } else if (tag === "video") {
        const src = safeVideoSource(find("src"));
        if (!src) { el.remove(); return; }
        set("src", src);
        set("controls", "controls");
        set("playsinline", "playsinline");
        const preload = find("preload"); if (/^(none|metadata|auto)$/i.test(preload)) set("preload", preload.toLowerCase());
        const width = safeAttrText(find("width"), 12); if (/^\d{1,5}$/.test(width)) set("width", width);
        const height = safeAttrText(find("height"), 12); if (/^\d{1,5}$/.test(height)) set("height", height);
      } else if (tag === "font") {
        const color = safeAttrText(find("color"), 120); if (color) set("color", color);
        const face = safeAttrText(find("face"), 200); if (face) set("face", face);
        const size = safeAttrText(find("size"), 12); if (/^[1-7]|[+-][1-7]$/.test(size)) set("size", size);
      } else if (isSvg) {
        attrs.forEach(([name, value]) => {
          if (SAFE_SVG_ATTRS.has(name)) { const safe = safeAttrText(value, 4000); if (safe) set(SVG_ATTR_CANON[name] || name, safe); }
        });
        const href = safeSvgHref(find("href") || find("xlink:href"));
        if (href) set("href", href);
      }
    });
    const scopedCss = scopeUserCss(styles.join("\n"));
    const styleTag = scopedCss ? `<style data-lumink-user-style="1">${scopedCss.replace(/<\/style/gi, "")}</style>` : "";
    return { html: `${styleTag}${doc.body ? doc.body.innerHTML.trim() : ""}`.trim(), title: titleEl ? cleanImportedText(titleEl.textContent, 180).trim() : "" };
  }
  /* ---------- file open: HTML / JSON ---------- */
  // JSON은 월드인포만 가져오는 파일이 아니라, 설정·정규식·캐릭터 카드처럼
  // 내용을 확인해야 하는 원본 문서이기도 합니다. 구조형 가져오기와 원문 열기를 분리합니다.
  const JSON_OPEN_MAX = HTML_SOURCE_MAX;
  function isJsonFile(file) {
    // 모바일 파일 제공자는 MIME을 비워 두거나 application/octet-stream으로 넘기는 경우가 많습니다.
    // 그래서 MIME만 믿지 않고 파일명 확장자와 흔한 JSON 계열 MIME을 함께 확인합니다.
    const name = String((file && file.name) || "").trim();
    const type = String((file && file.type) || "").toLowerCase().split(";")[0].trim();
    return /\.json$/i.test(name)
      || type === "application/json"
      || type === "text/json"
      || type === "application/ld+json"
      || /\+json$/i.test(type);
  }
  function looksLikeJsonText(raw) {
    // 확장자·MIME이 유실된 모바일 공유 파일도 내용이 JSON이면 JSON 열기 흐름으로 보냅니다.
    const text = String(raw == null ? "" : raw).replace(/^\uFEFF/, "").trimStart();
    if (!text) return false;
    if (text[0] !== "{" && text[0] !== "[") return false;
    try { JSON.parse(text); return true; }
    catch (e) { return true; } // JSON처럼 보이지만 문법이 깨졌다면 원본 작업실에서 점검할 수 있게 둡니다.
  }
  function looksLikeBinaryText(raw) {
    // 열기 선택기는 Android 파일 앱의 MIME 분류에 의존하지 않도록 전체 파일을 보이게 둡니다.
    // 대신 앱 안에서 NUL·제어문자가 많은 이진 파일만 막아 HTML/JSON 원문 흐름이 깨지지 않게 합니다.
    const text = String(raw == null ? "" : raw);
    if (!text) return false;
    const sample = text.slice(0, 8192);
    if (sample.indexOf("\u0000") >= 0) return true;
    let controls = 0;
    for (let i = 0; i < sample.length; i++) {
      const code = sample.charCodeAt(i);
      if (code < 32 && code !== 9 && code !== 10 && code !== 13) controls++;
    }
    return controls > Math.max(6, Math.floor(sample.length * 0.03));
  }
  function jsonImportedTitle(file) {
    const name = cleanImportedText(String((file && file.name) || ""), 220).trim().replace(/\.json$/i, "");
    return name || "불러온 JSON";
  }
  function isMarkdownFile(file) {
    const name = String((file && file.name) || "").trim();
    const type = String((file && file.type) || "").toLowerCase().split(";")[0].trim();
    return /\.(?:md|markdown|mdown|mkdn|mkd)$/i.test(name)
      || type === "text/markdown"
      || type === "text/x-markdown"
      || type === "application/markdown"
      || type === "text/md";
  }
  function markdownImportedTitle(file) {
    const name = cleanImportedText(String((file && file.name) || ""), 220).trim().replace(/\.(?:md|markdown|mdown|mkdn|mkd)$/i, "");
    return name || "불러온 Markdown";
  }
  function worldInfoEntriesFromPayload(data) {
    const entries = (data && typeof data === "object" && data.entries) ? data.entries : data;
    const list = Array.isArray(entries) ? entries : Object.values(entries || {});
    return list.filter((entry) => entry && typeof entry === "object" && (("content" in entry) || ("key" in entry) || ("keys" in entry)));
  }
  function jsonReadableText(raw, payload) {
    if (payload == null) return String(raw || "");
    try { return JSON.stringify(payload, null, 2); }
    catch (e) { return String(raw || ""); }
  }
  function openJsonAsFreeMemo(raw, file, payload) {
    if (raw.length > JSON_OPEN_MAX) { toast("JSON 파일은 5MB 이하만 메모로 열 수 있어요"); return; }
    pickTargetProject(st.curProjectId, async (pid) => {
      const n = await createNote("free", pid);
      n.title = jsonImportedTitle(file);
      n.titleLocked = true;
      // 구조를 망가뜨리지 않도록 JSON을 HTML로 해석하지 않고, 코드 블록의 텍스트로만 넣습니다.
      n.data.html = `<pre><code class="language-json">${esc(jsonReadableText(raw, payload))}</code></pre>`;
      await saveNote(n);
      st.curNoteId = n.id; st.curProjectId = pid;
      toast("JSON 내용을 메모로 열었어요");
      go({ s: "read" });
    });
  }
  function openJsonAsHtmlWorkshop(raw, file) {
    if (raw.length > JSON_OPEN_MAX) { toast("JSON 원본은 5MB 이하만 작업실로 열 수 있어요"); return; }
    pickTargetProject(st.curProjectId, async (pid) => {
      const n = await createNote("html", pid);
      n.title = jsonImportedTitle(file);
      n.titleLocked = true;
      // 코드 작업실에는 파일의 공백·정렬을 포함한 원본 문자열을 그대로 보관합니다.
      n.data = { source: raw, previewPolicy: "sandbox-web", exportFormat: "json" };
      await saveNote(n);
      st.curNoteId = n.id; st.curProjectId = pid;
      toast("JSON 원본을 코드 작업실로 열었어요");
      go({ s: "html" });
    });
  }
  function isSillyTavernRegexPayload(payload) {
    return !!(payload && typeof payload === "object" && typeof payload.findRegex === "string" && typeof payload.replaceString === "string");
  }
  function openJsonAsRegexWorkshop(raw, file, payload) {
    if (!isSillyTavernRegexPayload(payload)) { toast("SillyTavern 정규식 JSON을 찾지 못했어요"); return; }
    pickTargetProject(st.curProjectId, async (pid) => {
      const n = await createNote("regex", pid);
      n.title = cleanImportedText(payload.scriptName, 180) || jsonImportedTitle(file) || "가져온 정규식";
      n.titleLocked = true;
      n.data = normalizeRegexData({
        id: payload.id,
        scriptName: payload.scriptName || n.title,
        findRegex: payload.findRegex,
        replaceString: payload.replaceString,
        trimStrings: payload.trimStrings,
        placement: payload.placement,
        disabled: payload.disabled,
        markdownOnly: payload.markdownOnly,
        promptOnly: payload.promptOnly,
        runOnEdit: payload.runOnEdit,
        substituteRegex: payload.substituteRegex,
        minDepth: payload.minDepth,
        maxDepth: payload.maxDepth
      });
      await saveNote(n);
      st.curNoteId = n.id; st.curProjectId = pid;
      toast("정규식 작업실로 열었어요");
      go({ s: "regex" });
    });
  }
  function showJsonOpenChoice(raw, file, payload, parseError) {
    const title = jsonImportedTitle(file);
    const worldInfoEntries = payload ? worldInfoEntriesFromPayload(payload) : [];
    const packagePreview = payload ? projectPackagePreview(payload) : null;
    const regexPreview = payload && isSillyTavernRegexPayload(payload);
    const status = parseError
      ? "JSON 문법을 확인하지 못했어요. 구조형 가져오기는 할 수 없지만 원문은 열어 볼 수 있어요."
      : `원본 ${raw.length.toLocaleString("ko-KR")}자 · 메모 보기 또는 원본 작업실 중 선택하세요.`;
    const structured = `${packagePreview ? `<div class="type-card" id="jsonAsProject"><div class="tc-ico"><svg viewBox="0 0 24 24"><path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"/><path d="M3 10h18"/></svg></div><div><div class="tc-name">루미잉크 프로젝트로 가져오기</div><div class="tc-desc">프로젝트 · 메모 ${packagePreview.noteCount}개 · 첨부 ${packagePreview.fileCount}개</div></div></div>` : ""}${regexPreview ? `<div class="type-card" id="jsonAsRegex"><div class="tc-ico"><svg viewBox="0 0 24 24"><path d="M4 6h16M4 18h16"/><path d="M8 10v4M6 12h4M14 10l4 4M18 10l-4 4"/></svg></div><div><div class="tc-name">정규식 작업실로 가져오기</div><div class="tc-desc">findRegex · replaceString · SillyTavern 옵션을 편집</div></div></div>` : ""}${worldInfoEntries.length ? `<div class="type-card" id="jsonAsWorldInfo"><div class="tc-ico"><svg viewBox="0 0 24 24"><path d="M4 5.5c2.5-1 5.2-.6 8 1.2 2.8-1.8 5.5-2.2 8-1.2v13c-2.5-1-5.2-.6-8 1.2-2.8-1.8-5.5-2.2-8-1.2Z"/><path d="M12 6.7v13"/></svg></div><div><div class="tc-name">로어북으로 가져오기</div><div class="tc-desc">인식한 World Info 항목 ${worldInfoEntries.length}개를 로어북으로 생성</div></div></div>` : ""}`;
    openModal(`<h3>JSON 열기</h3><p class="m-sub"><b>${esc(title)}</b><br>${esc(status)}</p>${structured}
      <div class="type-card" id="jsonAsFreeMemo"><div class="tc-ico"><svg viewBox="0 0 24 24"><path d="M5 3h9l5 5v13H5z"/><path d="M14 3v5h5M8 12h8M8 16h8"/></svg></div><div><div class="tc-name">메모로 내용 보기</div><div class="tc-desc">읽기 쉬운 들여쓰기로 정리 · 코드 블록 형태로 안전하게 표시</div></div></div>
      <div class="type-card" id="jsonAsHtmlSource"><div class="tc-ico"><svg viewBox="0 0 24 24"><path d="M9 7l-5 5 5 5M15 7l5 5-5 5"/><path d="M13 4l-2 16"/></svg></div><div><div class="tc-name">코드 작업실로 원본 열기</div><div class="tc-desc">공백까지 보존 · JSON 원본을 그대로 편집·복사</div></div></div>
      <div class="m-row"><button class="m-btn" id="jsonOpenCancel">취소</button></div>`);
    $on("jsonOpenCancel", "click", closeModal);
    $on("jsonAsFreeMemo", "click", () => { closeModal(); openJsonAsFreeMemo(raw, file, payload); });
    $on("jsonAsHtmlSource", "click", () => { closeModal(); openJsonAsHtmlWorkshop(raw, file); });
    if (regexPreview) $on("jsonAsRegex", "click", () => { closeModal(); openJsonAsRegexWorkshop(raw, file, payload); });
    if (worldInfoEntries.length) $on("jsonAsWorldInfo", "click", () => { closeModal(); importWorldInfoData(payload, file); });
    if (packagePreview) $on("jsonAsProject", "click", () => { closeModal(); showProjectPackageImport(payload); });
  }
  function importJsonFile(raw, file) {
    let payload = null, parseError = null;
    // UTF-8 BOM이 붙은 JSON도 흔하므로, 원본 보관 문자열은 유지하고 파싱용 사본에서만 제거합니다.
    const parseSource = String(raw || "").replace(/^\uFEFF/, "");
    try { payload = JSON.parse(parseSource); }
    catch (e) { parseError = e; }
    showJsonOpenChoice(raw, file, payload, parseError);
  }
  function openMarkdownAsHtmlWorkshop(raw, file) {
    if (raw.length > HTML_SOURCE_MAX) { toast("Markdown 원본은 5MB 이하만 코드 작업실로 열 수 있어요"); return; }
    pickTargetProject(st.curProjectId, async (pid) => {
      const n = await createNote("html", pid);
      n.title = markdownImportedTitle(file);
      n.titleLocked = true;
      n.data = { source: raw, previewPolicy: "sandbox-web", exportFormat: "md" };
      await saveNote(n);
      st.curNoteId = n.id; st.curProjectId = pid;
      toast("Markdown 원본을 코드 작업실로 열었어요");
      go({ s: "html" });
    });
  }
  function importHtmlFile(file) {
    const declaredJson = isJsonFile(file);
    const declaredMarkdown = isMarkdownFile(file);
    const size = Number(file && file.size || 0);
    if (declaredJson && size > JSON_OPEN_MAX) { toast("JSON 파일은 5MB 이하만 열 수 있어요"); return; }
    if (declaredMarkdown && size > HTML_SOURCE_MAX) { toast("Markdown 원본은 5MB 이하만 열 수 있어요"); return; }
    if (!file) { toast("열 파일을 찾지 못했어요"); return; }
    const fr = new FileReader();
    fr.onload = () => {
      const raw = String(fr.result || "");
      if (looksLikeBinaryText(raw)) {
        toast("열기는 HTML · JSON · Markdown · 일반 텍스트 파일만 지원해요");
        return;
      }
      // .md 확장자는 내용이 JSON처럼 보여도 Markdown 원문으로 우선 열어 파일 형식을 보존합니다.
      if (declaredMarkdown) {
        openMarkdownAsHtmlWorkshop(raw, file);
        return;
      }
      // .json 확장자/MIME이 사라진 파일도 실제 내용이 JSON이면 일반 JSON 열기 창으로 보냅니다.
      const jsonCandidate = declaredJson || looksLikeJsonText(raw);
      if (jsonCandidate) {
        if (raw.length > JSON_OPEN_MAX) { toast("JSON 원본은 5MB 이하만 열 수 있어요"); return; }
        importJsonFile(raw, file);
        return;
      }
      importHtmlPayload(raw, file);
    };
    fr.onerror = () => {
      const reason = (fr.error && (fr.error.name || fr.error.message)) ? ` (${fr.error.name || fr.error.message})` : "";
      toast(`파일을 읽지 못했어요${reason}`);
    };
    try { fr.readAsText(file, "UTF-8"); }
    catch (e) { toast("파일 열기를 시작하지 못했어요"); }
  }
  function importWorldInfo(raw, file) {
    let data; try { data = JSON.parse(String(raw || "").replace(/^\uFEFF/, "")); } catch (e) { toast("JSON을 읽지 못했어요"); return; }
    importWorldInfoData(data, file);
  }
  function importWorldInfoData(data, file) {
    const valid = worldInfoEntriesFromPayload(data);
    if (!valid.length) { toast("월드인포 항목을 찾지 못했어요"); return; }
    pickTargetProject(st.curProjectId, async (pid) => {
      let cnt = 0;
      for (const e of valid) {
        const keys = e.key || e.keys || [];
        const n = await createNote("lorebook", pid);
        n.title = ((e.comment || "") + "").trim() || (Array.isArray(keys) && keys[0]) || ("로어북 " + (cnt + 1));
        n.titleLocked = true;
        n.data = normalizeLoreData(Object.assign({}, e, { keywords: Array.isArray(keys) ? keys.slice() : [] }));
        await saveLore(n, true);
        cnt++;
      }
      await reloadState(); st.curProjectId = pid; render(); renderSidebar();
      toast(`로어북 ${cnt}개를 불러왔어요`); go({ s: "project" });
    });
  }
  function projectPackagePreview(payload) {
    if (!payload || payload.app !== "lumink" || payload.kind !== "project" || Number(payload.version) !== 1) return null;
    const project = normalizeImportedProject(payload.project);
    if (!project) return null;
    const notes = (Array.isArray(payload.notes) ? payload.notes : [])
      .map(normalizeImportedNote).filter((note) => note && note.projectId === project.id);
    return {
      project,
      noteCount: new Set(notes.map((note) => note.id)).size,
      fileCount: Array.isArray(payload.files) ? payload.files.length : 0
    };
  }
  function uniqueImportedProjectName(value) {
    const base = (cleanImportedText(value, 120).trim() || "불러온 프로젝트").slice(0, 120);
    const used = new Set(st.projects.map((project) => String(project.name || "").trim().toLocaleLowerCase("ko-KR")));
    if (!used.has(base.toLocaleLowerCase("ko-KR"))) return base;
    for (let number = 1; number < 10000; number++) {
      const suffix = number === 1 ? " (가져옴)" : ` (가져옴 ${number})`;
      const candidate = base.slice(0, Math.max(1, 120 - suffix.length)) + suffix;
      if (!used.has(candidate.toLocaleLowerCase("ko-KR"))) return candidate;
    }
    return `가져온 프로젝트 ${dateStamp()}`;
  }
  function buildProjectPackageCopy(payload, reservedFileIds) {
    const preview = projectPackagePreview(payload);
    if (!preview) throw new Error("invalid project package");
    const sourceNotes = [], seenNoteIds = new Set();
    for (const raw of (Array.isArray(payload.notes) ? payload.notes : [])) {
      const note = normalizeImportedNote(raw);
      if (!note || note.projectId !== preview.project.id || seenNoteIds.has(note.id)) continue;
      seenNoteIds.add(note.id); sourceNotes.push(note);
    }
    const usedIds = new Set([
      ...st.projects.map((project) => project.id),
      ...st.notes.map((note) => note.id),
      ...(reservedFileIds || [])
    ]);
    const freshId = () => {
      let id;
      do { id = uid(); } while (usedIds.has(id));
      usedIds.add(id); return id;
    };
    const importedAt = now(), projectId = freshId();
    const project = Object.assign({}, preview.project, {
      id: projectId,
      name: uniqueImportedProjectName(preview.project.name),
      isDefault: false,
      pinned: false,
      updatedAt: importedAt
    });
    delete project.pinnedAt;

    const noteIdMap = new Map();
    sourceNotes.forEach((note) => noteIdMap.set(note.id, freshId()));
    const notes = sourceNotes.map((source) => {
      const note = jsonCopy(source) || source;
      note.id = noteIdMap.get(source.id); note.projectId = projectId;
      note.pinnedHome = false; note.pinnedSide = false;
      delete note.pinnedHomeAt; delete note.pinnedSideAt;
      return note;
    });

    const fileIdMap = new Map(), files = [];
    for (const raw of (Array.isArray(payload.files) ? payload.files : [])) {
      const source = normalizeImportedFile(raw);
      if (!source || !noteIdMap.has(source.noteId) || fileIdMap.has(source.id)) continue;
      const id = freshId(); fileIdMap.set(source.id, id);
      files.push(Object.assign({}, source, { id, noteId: noteIdMap.get(source.noteId) }));
    }
    for (const note of notes) {
      if (!note.data || !Array.isArray(note.data.attachments)) continue;
      note.data.attachments = note.data.attachments.map((attachment) => {
        const id = fileIdMap.get(attachment.id);
        return id ? Object.assign({}, attachment, { id }) : null;
      }).filter(Boolean);
      if (note.type === "idea" && Array.isArray(note.data.items)) {
        note.data.items = note.data.items.filter((item) => !item || !item.fileId || fileIdMap.has(item.fileId));
        note.data.items.forEach((item) => { if (item && item.fileId) item.fileId = fileIdMap.get(item.fileId); });
        if (note.data.canvas && note.data.canvas.backgroundImage) {
          const image=note.data.canvas.backgroundImage;
          if (image.fileId && fileIdMap.has(image.fileId)) image.fileId=fileIdMap.get(image.fileId);
          else note.data.canvas.backgroundImage=null;
        }
      }
    }
    return { project, notes, files };
  }
  async function importProjectPackage(payload) {
    await flushPending();
    await doAutoBackup();
    const existingFiles = await getAll("files");
    const data = buildProjectPackageCopy(payload, existingFiles.map((file) => file.id));
    await transact(["projects", "notes", "files"], "readwrite", (tx) => {
      tx.objectStore("projects").put(data.project);
      data.notes.forEach((note) => tx.objectStore("notes").put(note));
      data.files.forEach((file) => tx.objectStore("files").put(file));
    });
    await reloadState();
    closeModal(); st.curProjectId = data.project.id; st.curNoteId = null;
    renderSidebar(); go({ s: "project" });
    toast(`프로젝트를 가져왔어요 · 메모 ${data.notes.length}개 · 첨부 ${data.files.length}개`);
  }
  function showProjectPackageImport(payload) {
    const preview = projectPackagePreview(payload);
    if (!preview) { toast("올바른 루미잉크 프로젝트 파일이 아니에요"); return; }
    openModal(`<h3>프로젝트 불러오기</h3><p class="m-sub"><b>${esc(preview.project.name)}</b><br>메모 ${preview.noteCount}개 · 첨부 ${preview.fileCount}개</p><p class="m-sub">현재 데이터를 변경하지 않고 새 프로젝트로 가져옵니다. 같은 이름의 프로젝트가 있으면 이름에 ‘가져옴’ 표시가 붙습니다.</p><div class="m-row"><button class="m-btn" id="projectImportCancel">취소</button><button class="m-btn primary" id="projectImportOk">새 프로젝트로 가져오기</button></div>`);
    $on("projectImportCancel", "click", closeModal);
    $on("projectImportOk", "click", async () => {
      const button = $("projectImportOk"); if (button) { button.disabled = true; button.textContent = "가져오는 중…"; }
      try { await importProjectPackage(payload); }
      catch (e) {
        console.warn("project import", e);
        if (button) { button.disabled = false; button.textContent = "새 프로젝트로 가져오기"; }
        toast("프로젝트를 가져오지 못했어요");
      }
    });
  }
  function importHtmlPayload(raw, file) {
    let pTag = null, projectTag = null, ideaTag = null;
    try {
      const doc = new DOMParser().parseFromString(raw, "text/html");
      projectTag = doc.getElementById("lumink-project");
      pTag = doc.getElementById("lumink-persona") || doc.getElementById("lumink-character") || doc.getElementById("lumink-log");
      ideaTag = doc.getElementById("lumink-idea");
    } catch (e) {}
    if (projectTag) {
      try { showProjectPackageImport(JSON.parse(projectTag.textContent)); }
      catch (e) { toast("올바른 루미잉크 프로젝트 파일이 아니에요"); }
      return;
    }
    pickTargetProject(st.curProjectId, async (pid) => {
      if (pTag) {
        try {
          const pl = JSON.parse(pTag.textContent);
          if (pl && pl.kind === "persona" && pl.data) {
            const n = await createNote("persona", pid, { characterMode: "single" });
            n.title = cleanImportedText(pl.title, 180) || file.name.replace(/\.(html?)$/i, "") || "불러온 페르소나";
            n.titleLocked = true; n.data = pl.data && Array.isArray(pl.data.pages) ? normalizeImportedCharacterData(pl.data) : legacyPersonaDataToCharacterData(pl.data);
            await saveCharacter(n, true);
            st.curNoteId = n.id; charLang = "ko"; st.charEdit = false; st.curProjectId = pid;
            toast("페르소나를 불러왔어요"); go({ s: "character" }); return;
          }
          if (pl && pl.kind === "character" && pl.data) {
            const n = await createNote("character", pid);
            n.title = cleanImportedText(pl.title, 180) || file.name.replace(/\.(html?)$/i, "") || "불러온 캐릭터 모음";
            n.titleLocked = true; n.data = normalizeImportedCharacterData(pl.data);
            await saveCharacter(n, true);
            st.curNoteId = n.id; charLang = "ko"; st.charEdit = false; st.curProjectId = pid;
            toast("캐릭터 메모를 불러왔어요"); go({ s: "character" }); return;
          }
          if (pl && pl.kind === "log" && pl.data) {
            const n = await createNote("log", pid);
            n.title = cleanImportedText(pl.title, 180) || file.name.replace(/\.(html?)$/i, "") || "불러온 로그";
            n.titleLocked = true; n.data = normalizeLogData(pl.data);
            await saveLog(n, true); st.curNoteId = n.id; st.curProjectId = pid; logEditMode = false;
            toast("로그를 불러왔어요"); go({ s: "log" }); return;
          }
        } catch (e) {}
      }
      if (ideaTag) {
        try {
          const payload=JSON.parse(ideaTag.textContent);
          if (isIdeaBoardExportPayload(payload)) { await importIdeaBoardHtmlPayload(payload,pid,file); return; }
        } catch (e) { toast("아이디어 보드 데이터를 읽지 못했어요"); return; }
      }
      showHtmlImportChoice(raw, file, pid);
    });
  }
  function showHtmlImportChoice(raw, file, pid) {
    const name = file.name.replace(/\.(html?|HTML?)$/i, "") || "불러온 HTML";
    openModal(`<h3>HTML 가져오기 방식</h3><p class="m-sub"><b>${esc(name)}</b><br>문서로 정리할지, 원본 코드를 그대로 보관할지 선택하세요.</p>
      <div class="type-card" id="importAsHtmlSource"><div class="tc-ico"><svg viewBox="0 0 24 24"><path d="M9 7l-5 5 5 5M15 7l5 5-5 5"/><path d="M13 4l-2 16"/></svg></div><div><div class="tc-name">코드 작업실로 원본 가져오기</div><div class="tc-desc">정화하지 않음 · 원본 문자열 그대로 저장 · 샌드박스 미리보기</div></div></div>
      <div class="type-card" id="importAsFreeMemo"><div class="tc-ico"><svg viewBox="0 0 24 24"><path d="M5 3h9l5 5v13H5z"/><path d="M14 3v5h5"/></svg></div><div><div class="tc-name">자유 메모 문서로 가져오기</div><div class="tc-desc">리치 에디터 정화 규칙 적용 · 문서형으로 편집</div></div></div>
      <div class="m-row"><button class="m-btn" id="htmlImportCancel">취소</button></div>`);
    $on("htmlImportCancel", "click", closeModal);
    $on("importAsHtmlSource", "click", async () => {
      closeModal();
      if (raw.length > HTML_SOURCE_MAX) { toast("코드 원본은 5MB 이하만 가져올 수 있어요"); return; }
      const n = await createNote("html", pid);
      n.title = cleanImportedText(name, 180) || "불러온 HTML"; n.titleLocked = true;
      n.data = { source: raw, previewPolicy: "sandbox-web", exportFormat: "html" };
      await saveNote(n); st.curNoteId = n.id; st.curProjectId = pid;
      toast("원본 HTML을 코드 작업실로 가져왔어요"); go({ s: "html" });
    });
    $on("importAsFreeMemo", "click", async () => {
      closeModal();
      const parsed = sanitize(raw);
      const n = await createNote("free", pid);
      n.title = parsed.title || name || "불러온 메모"; n.data.html = parsed.html;
      await saveNote(n); st.curNoteId = n.id; st.curProjectId = pid;
      toast("문서 메모로 가져왔어요"); go({ s: "editor" });
    });
  }
  $on("fileInput", "change", (e) => {
    const input = e.target;
    const f = input && input.files && input.files[0];
    // Android 파일 선택기는 값을 즉시 비우거나 패널을 닫을 때 파일 접근이 끊기는 구현이 있어,
    // File 객체를 먼저 잡고 다음 프레임에서 읽기를 시작합니다.
    if (input) input.value = "";
    closeSidebar();
    if (f) requestAnimationFrame(() => importHtmlFile(f));
  });

  /* ---------- sidebar / theme ---------- */
  function openSidebar() { renderSidebar(); document.body.classList.add("sidebar-open"); }
  function closeSidebar() { document.body.classList.remove("sidebar-open"); }
  $on("sidebarScrim", "click", closeSidebar);
  function applyTheme(t) {
    st.theme = t; document.documentElement.setAttribute("data-theme", t);
    // Custom colors are intentionally a light-mode surface layer. Accent presets,
    // logo colors and all existing gradients stay under the normal preset system.
    applyCustomTheme(st.customTheme, { persist: false });
    $("themeIcon").innerHTML = t === "light"
      ? '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M6.5 17.5L5 19"/>'
      : '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>';
    try { localStorage.setItem("luminkTheme", t); } catch (e) {}
  }
  function detectTheme() { let t = null; try { t = localStorage.getItem("luminkTheme"); } catch (e) {} applyTheme(t || "dark"); }

  /* ---------- color theme (accent) ---------- */
  const ACCENTS = {
    blue: { name: "블루", grad: "linear-gradient(135deg, #7b9bff, #b58bff)", ig: ["#7b9bff", "#b58bff"] },
    pink: { name: "핑크", grad: "linear-gradient(135deg, #ff93cb, #c98bff)", ig: ["#ff93cb", "#c98bff"] },
    green: { name: "그린", grad: "linear-gradient(135deg, #45e3a6, #4fd6c4)", ig: ["#45e3a6", "#4fd6c4"] },
    purple: { name: "퍼플", grad: "linear-gradient(135deg, #a880ff, #7c8bff)", ig: ["#a880ff", "#7c8bff"] },
    gold: { name: "골드", grad: "linear-gradient(135deg, #ffd86b, #e0a23c)", ig: ["#ffd86b", "#e0a23c"] },
    pblue: { name: "파스텔 블루", grad: "linear-gradient(135deg, #8fb6ec, #9ba6e6)", ig: ["#8fb6ec", "#9ba6e6"] },
    ppink: { name: "파스텔 핑크", grad: "linear-gradient(135deg, #efa6cc, #d3a6e8)", ig: ["#efa6cc", "#d3a6e8"] },
    polive: { name: "파스텔 올리브", grad: "linear-gradient(135deg, #a8b85e, #93b06e)", ig: ["#a8b85e", "#93b06e"] },
    ppurple: { name: "파스텔 퍼플", grad: "linear-gradient(135deg, #b39ee8, #a3a6e6)", ig: ["#c5aef0", "#b3b0ee"] },
    pgold: { name: "파스텔 골드", grad: "linear-gradient(135deg, #e8d49a, #d8c182)", ig: ["#e8d49a", "#d8c182"] },
    navy: { name: "네이비", grad: "linear-gradient(135deg, #3f6fd8, #4a5fc8)", ig: ["#5b8def", "#6f7fe0"] },
    burgundy: { name: "버건디", grad: "linear-gradient(135deg, #c0405e, #9a2f48)", ig: ["#e0607e", "#d05068"] },
    dgreen: { name: "딥그린", grad: "linear-gradient(135deg, #2faa72, #1f8a6a)", ig: ["#3fc78a", "#3aa890"] },
    dviolet: { name: "딥바이올렛", grad: "linear-gradient(135deg, #8a4ee0, #6a3fc8)", ig: ["#a06ef0", "#8a5fe0"] },
    lgold: { name: "럭셔리골드", grad: "linear-gradient(135deg, #c89a28, #a87c14)", ig: ["#f0c64a", "#d9a832"] },
    mono: { name: "무채색", grad: "linear-gradient(135deg, #b8b8c0, #909098)", ig: ["#c8c8d0", "#a8a8b0"] },
    brown: { name: "브라운", grad: "linear-gradient(135deg, #b58a56, #98703e)", ig: ["#d2a878", "#c0905e"] },
    silver: { name: "메탈릭 실버", grad: "linear-gradient(135deg, #9aabbc, #7e8ea0)", ig: ["#bcc8d4", "#9fb0c0"] },
    mgold: { name: "메탈릭 골드", grad: "linear-gradient(135deg, #d4b842, #b89826)", ig: ["#e8cc5e", "#ccae3e"] },
    bw: { name: "블랙&화이트", grad: "linear-gradient(135deg, #ffffff 0%, #ffffff 50%, #141414 50%, #141414 100%)", ig: ["#9a9a9a", "#7a7a7a"] }
  };
  /* ---------- v65.7: independent two-stop custom gradient themes ---------- */
  /*
     Preset palette contract:
     - v64.9's root and every preset accent block remain the source of truth.
     - A custom theme is an independent two-colour gradient theme, not a modified preset.
     - The same two stops drive logo, buttons, SVG icon art and the recommended structural palette.
  */
  const CUSTOM_THEME_SETTING_ID = "customTheme";
  const LEGACY_CUSTOM_ACCENT = "custom";
  const CUSTOM_THEME_COLOR_META = Object.freeze([
    { key:"mainA",          label:"메인 색상 1 · 시작", variable:"--accent",                         fallback:"#2F6FD0", group:"main" },
    { key:"mainB",          label:"메인 색상 2 · 끝",   variable:"--accent-2",                       fallback:"#5A73D8", group:"main" },
    { key:"softAccentBg",   label:"옅은 강조·선택 배경", variable:"--accent-soft",                    fallback:"#EAF0FF", group:"highlight" },
    { key:"logoCore",       label:"로고 중심부",         variable:"--custom-logo-ink",                fallback:"#FFFFFF", group:"brand" },
    { key:"sectionTitleBg", label:"작은 섹션 제목 배경", variable:"--section-title-bg",                fallback:"#EAF0FF", group:"section", derived:true },
    { key:"tagBorder",      label:"태그 칩 테두리",       variable:"--tag-border-color",               fallback:"#6AD0FF", group:"section" },
    { key:"sidebarFootBg",  label:"사이드바 하단 버튼 배경", variable:"--sidebar-foot-bg",              fallback:"#E8EEF9", group:"sidebar", derived:true },
    { key:"sidebarSectionGradientStart", label:"사이드바 섹션 제목 그라데이션 1", variable:"--sidebar-section-grad-a", fallback:"#EAF0FF", group:"sidebar", derived:true },
    { key:"sidebarCountBg", label:"사이드바 메모 개수 배경", variable:"--sidebar-count-bg",             fallback:"#EAF0FF", group:"sidebar", derived:true },
    { key:"bg",             label:"앱 배경",             variable:"--bg",                             fallback:"#F3F4F8", group:"background" },
    { key:"bg2",            label:"보조 배경",           variable:"--bg-2",                           fallback:"#ECEEF4", group:"background" },
    { key:"paper",          label:"문서 바탕",           variable:"--paper",                          fallback:"#FCFCFD", group:"background" },
    { key:"surface",        label:"카드 표면",           variable:"--surface",                        fallback:"#FFFFFF", group:"card" },
    { key:"surface2",       label:"보조 카드",           variable:"--surface-2",                      fallback:"#F1F2F7", group:"card" },
    { key:"surface3",       label:"눌림·보조 표면",      variable:"--surface-3",                      fallback:"#E7E9F1", group:"card" },
    { key:"barBg",          label:"상단바",              variable:"--bar-bg",                         fallback:"#FFFFFF", group:"bar" },
    { key:"barBg2",         label:"상단바 보조",         variable:"--bar-bg-2",                       fallback:"#F6F7FB", group:"bar" },
    { key:"barLine",        label:"상단바 경계",         variable:"--bar-line",                       fallback:"#E1E3EC", group:"bar" },
    { key:"topbarShadow",   label:"상단 제목바 아래 그림자", variable:"--topbar-shadow-color",          fallback:"#7690C2", group:"bar" },
    { key:"memoShadow",     label:"메모 그림자",             variable:"--memo-shadow-color",            fallback:"#7690C2", group:"memo" },
    { key:"glowColor",      label:"글로우",                 variable:"--glow-color",                   fallback:"#6AD0FF", group:"main" },
    { key:"memoCodeBg",     label:"자유 메모 코드 보기 배경", variable:"--memo-code-bg",                  fallback:"#FCFCFD", group:"memo" },
    { key:"memoCodeIconBg", label:"자유 메모 코드 보기 아이콘 배경", variable:"--memo-code-icon-bg",       fallback:"#EAF0FF", group:"memo", derived:true },
    { key:"memoTitle",      label:"메모 제목",           variable:"--memo-title-color",               fallback:"#283A63", group:"type" },
    { key:"homeSectionTitle", label:"메인 화면 섹션 제목·정렬 글자", variable:"--home-section-title-color", fallback:"#5E6377", group:"home", derived:true },
    { key:"homeSectionTitleBg", label:"메인 화면 섹션 제목 배경", variable:"--home-section-title-bg",   fallback:"#EAF0FF", group:"home", derived:true },
    { key:"homeShadow",     label:"메인 화면 그림자",     variable:"--home-shadow-color",              fallback:"#7690C2", group:"home", derived:true },
    { key:"projectCountBg", label:"프로젝트 메모 개수 배경", variable:"--project-count-bg",              fallback:"#EAF0FF", group:"home", derived:true },
    { key:"projectCountText", label:"프로젝트 메모 개수 글자", variable:"--project-count-color",          fallback:"#2F6FD0", group:"home" },
    { key:"homeSortBg",     label:"메인 화면 정렬 배경", variable:"--home-sort-bg",                     fallback:"#EAF0FF", group:"home", derived:true },
    { key:"modalTitle",     label:"팝업 제목",           variable:"--modal-title-color",              fallback:"#283A63", group:"popup", derived:true },
    { key:"newNoteIconBg",  label:"새 메모 팝업 아이콘 배경", variable:"--new-note-icon-bg",              fallback:"#EAF0FF", group:"popup", derived:true },
    { key:"settingsGroupTitle", label:"설정 그룹 제목",  variable:"--settings-group-title-color",      fallback:"#5E6377", group:"settings", derived:true },
    { key:"settingsRowTitle", label:"설정 항목 제목",    variable:"--settings-row-title-color",        fallback:"#1B1D27", group:"settings", derived:true },
    { key:"settingsShadow", label:"설정 그림자",         variable:"--settings-shadow-color",           fallback:"#7690C2", group:"settings", derived:true },
    { key:"settingsPressedBg", label:"설정 버튼 눌림",    variable:"--settings-pressed-bg",             fallback:"#F1F2F7", group:"settings", derived:true },
    { key:"ink",            label:"본문 글자",           variable:"--ink",                            fallback:"#1B1D27", group:"type" },
    { key:"muted",          label:"보조 글자",           variable:"--muted",                          fallback:"#5E6377", group:"type" },
    { key:"faint",          label:"희미한 글자",         variable:"--faint",                          fallback:"#A3A8BA", group:"type" },
    { key:"line",           label:"기본 경계선",         variable:"--line",                           fallback:"#E1E3EC", group:"line" },
    { key:"lineSoft",       label:"옅은 경계선",         variable:"--line-soft",                      fallback:"#EBEDF3", group:"line" }
  ]);
  const CUSTOM_THEME_GROUPS = Object.freeze([
    ["main", "메인 그라데이션"], ["highlight", "옅은 강조·선택 배경"], ["brand", "로고"], ["section", "섹션 제목"], ["sidebar", "사이드바"], ["background", "바탕"], ["card", "카드"],
    ["bar", "상단바"], ["memo", "자유 메모 코드"], ["home", "메인 화면"], ["popup", "팝업"], ["settings", "설정"], ["type", "글자"], ["line", "경계선"]
  ]);
  const CUSTOM_THEME_STYLE_VARS = Object.freeze([
    ...CUSTOM_THEME_COLOR_META.map((item) => item.variable),
    "--accent-deep", "--accent-soft", "--accent-ink", "--grad-blue", "--glow", "--shadow", "--logo-ink", "--custom-glow-color",
    "--custom-main-a", "--custom-main-b", "--custom-logo-body", "--custom-logo-tip", "--custom-logo-ink", "--custom-logo-glow",
    "--quickmenu-default-icon-bg-a", "--quickmenu-default-icon-bg-b", "--quickmenu-panel-bg-b",
    "--custom-note-type-free", "--custom-note-type-html", "--custom-note-type-lorebook", "--custom-note-type-log", "--custom-note-type-persona", "--custom-note-type-character", "--custom-note-type-idea",
    "--custom-note-type-free-ink", "--custom-note-type-html-ink", "--custom-note-type-lorebook-ink", "--custom-note-type-log-ink", "--custom-note-type-persona-ink", "--custom-note-type-character-ink", "--custom-note-type-idea-ink",
    "--custom-note-divider-text", "--custom-note-divider-count"
  ]);
  const CUSTOM_THEME_FALLBACK_COLORS = Object.freeze(Object.fromEntries(CUSTOM_THEME_COLOR_META.map((item) => [item.key, item.fallback])));
  const CUSTOM_THEME_SHARED_SOFT_KEYS = Object.freeze([
    "sectionTitleBg", "sidebarFootBg", "sidebarSectionGradientStart", "sidebarCountBg",
    "memoCodeIconBg", "homeSectionTitleBg", "projectCountBg", "homeSortBg",
    "newNoteIconBg", "settingsPressedBg"
  ]);
  const CUSTOM_THEME_SHARED_SOFT_VARS = Object.freeze(Object.fromEntries(CUSTOM_THEME_COLOR_META
    .filter((item) => CUSTOM_THEME_SHARED_SOFT_KEYS.includes(item.key))
    .map((item) => [item.variable, item.key])));
  let customThemePreviewRestore = null;

  function normalizeThemeHex(value, fallback) {
    const m = String(value || "").trim().match(/^#?([0-9a-f]{6})$/i);
    return m ? `#${m[1].toUpperCase()}` : (fallback || "#F3F4F8");
  }
  function cloneThemeObject(value) { return JSON.parse(JSON.stringify(value)); }
  function validAccentName(value) { return ACCENTS[value] ? value : "blue"; }
  function setOrRemoveAttr(node, name, value) { if (value == null || value === "") node.removeAttribute(name); else node.setAttribute(name, value); }
  function rgbFromHex(hex) { const h = normalizeThemeHex(hex, "#7B9BFF").slice(1); return { r:parseInt(h.slice(0,2),16), g:parseInt(h.slice(2,4),16), b:parseInt(h.slice(4,6),16) }; }
  function colorDistance(a,b) { const x=rgbFromHex(a), y=rgbFromHex(b); return Math.pow(x.r-y.r,2)+Math.pow(x.g-y.g,2)+Math.pow(x.b-y.b,2); }
  function clampThemeNumber(value,min,max){ return Math.min(max,Math.max(min,Number(value)||0)); }
  function hexToHsl(hex){ const {r,g,b}=rgbFromHex(hex); const rr=r/255,gg=g/255,bb=b/255,max=Math.max(rr,gg,bb),min=Math.min(rr,gg,bb); let h=0,sat=0,l=(max+min)/2; if(max!==min){const d=max-min; sat=l>.5?d/(2-max-min):d/(max+min); if(max===rr)h=(gg-bb)/d+(gg<bb?6:0); else if(max===gg)h=(bb-rr)/d+2; else h=(rr-gg)/d+4; h*=60;} return {h,s:sat,l}; }
  function hslToHex(h,s,l){ const hue=((h%360)+360)%360/360; const sat=clampThemeNumber(s,0,1), light=clampThemeNumber(l,0,1); if(sat===0){const v=Math.round(light*255).toString(16).padStart(2,"0");return `#${v}${v}${v}`.toUpperCase();} const q=light<.5?light*(1+sat):light+sat-light*sat,p=2*light-q; const f=(t)=>{let x=t;if(x<0)x+=1;if(x>1)x-=1;const c=x<1/6?p+(q-p)*6*x:x<1/2?q:x<2/3?p+(q-p)*(2/3-x)*6:p;return Math.round(c*255).toString(16).padStart(2,"0");}; return `#${f(hue+1/3)}${f(hue)}${f(hue-1/3)}`.toUpperCase(); }
  function themeHexAlpha(hex,alpha){ const {r,g,b}=rgbFromHex(hex); return `rgba(${r},${g},${b},${clampThemeNumber(alpha,0,1)})`; }
  function lerpHue(a,b,t){ const delta=((b-a+540)%360)-180; return (a+delta*clampThemeNumber(t,0,1)+360)%360; }
  function blendHsl(a,b,t){ const x=hexToHsl(a),y=hexToHsl(b),p=clampThemeNumber(t,0,1); return { h:lerpHue(x.h,y.h,p), s:x.s+(y.s-x.s)*p, l:x.l+(y.l-x.l)*p }; }
  function gradientMate(hex){ const h=hexToHsl(hex); return hslToHex(h.h+22,Math.max(.40,Math.min(.84,h.s*.92+.06)),Math.max(.38,Math.min(.70,h.l+.06))); }
  function contrastInk(hex, darkMode){ const h=hexToHsl(hex); if(darkMode) return hslToHex(h.h,Math.max(.14,h.s*.30),.92); return h.l < .62 ? "#FFFFFF" : hslToHex(h.h,Math.max(.22,h.s*.54),.22); }
  function recommendCustomPalette(mainA,mainB,mode){
    // 메인 두 색만으로 전체 구조 팔레트를 추천합니다.
    // 원칙: ① 색조(hue)는 두 색의 중간값 하나로 고정해 어떤 조합에서도 색이 튀지 않게 하고,
    //       ② 역할이 같은 배경/그림자/제목은 같은 값으로 묶어 일관된 결과(=평타)를 보장합니다.
    const start=normalizeThemeHex(mainA,"#2F6FD0"), end=normalizeThemeHex(mainB,gradientMate(start));
    const mid=blendHsl(start,end,.5), dark=mode==="dark";
    const H=mid.h;
    const S=Math.max(.30,Math.min(.90,mid.s)); // 채도: 하한으로 칙칙함 방지, 상한으로 과채도 방지
    const L=(sat,light)=>hslToHex(H,Math.max(0,Math.min(1,sat)),Math.max(0,Math.min(1,light)));
    const out={mainA:start,mainB:end,logoCore:contrastInk(start,dark),glowColor:start,tagBorder:start,projectCountText:start};
    if(!dark){
      const tint=L(S*.40,.930), tintHi=L(S*.30,.955);       // 통합 틴트 배경
      const shadow=L(Math.max(.30,S*.42),.52);              // 통합 그림자
      const titleInk=L(Math.max(.30,S*.46),.235);           // 통합 진한 제목
      const inkC=L(Math.max(.28,S*.42),.180);
      const mutedC=L(Math.max(.16,S*.26),.420);
      const faintC=L(Math.max(.12,S*.18),.620);
      const lineC=L(S*.20,.892), lineSoftC=L(S*.13,.942);
      Object.assign(out,{
        bg:L(S*.14,.978), bg2:L(S*.18,.953), paper:L(S*.07,.994),
        surface:L(S*.08,.999), surface2:L(S*.14,.968), surface3:L(S*.20,.936),
        barBg:L(S*.07,.998), barBg2:L(S*.12,.983), barLine:lineC,
        topbarShadow:shadow, memoShadow:shadow, homeShadow:shadow, settingsShadow:shadow,
        softAccentBg:tint, memoCodeBg:L(S*.08,.986), memoCodeIconBg:tint,
        sectionTitleBg:tint, homeSectionTitleBg:tint, homeSortBg:tint, projectCountBg:tint, tagBorder:start, projectCountText:start,
        sidebarCountBg:tint, sidebarSectionGradientStart:tint, sidebarFootBg:tint, newNoteIconBg:tint, settingsPressedBg:tint,
        memoTitle:titleInk, modalTitle:titleInk, settingsRowTitle:inkC,
        homeSectionTitle:mutedC, settingsGroupTitle:mutedC,
        ink:inkC, muted:mutedC, faint:faintC, line:lineC, lineSoft:lineSoftC
      });
    } else {
      const tint=L(S*.30,.205), tintHi=L(S*.26,.175);
      const shadow=L(Math.max(.30,S*.42),.030);
      const titleInk=L(Math.max(.12,S*.18),.950);
      const inkC=L(Math.max(.11,S*.16),.930);
      const mutedC=L(Math.max(.10,S*.14),.690);
      const faintC=L(Math.max(.08,S*.10),.480);
      const lineC=L(S*.22,.260), lineSoftC=L(S*.16,.195);
      Object.assign(out,{
        bg:L(S*.26,.075), bg2:L(S*.28,.105), paper:L(S*.20,.092),
        surface:L(S*.24,.135), surface2:L(S*.26,.178), surface3:L(S*.27,.225),
        barBg:L(S*.30,.145), barBg2:L(S*.32,.188), barLine:lineC,
        topbarShadow:shadow, memoShadow:shadow, homeShadow:shadow, settingsShadow:shadow,
        softAccentBg:tint, memoCodeBg:L(S*.20,.105), memoCodeIconBg:tint,
        sectionTitleBg:tint, homeSectionTitleBg:tint, homeSortBg:tint, projectCountBg:tint, tagBorder:start, projectCountText:start,
        sidebarCountBg:tint, sidebarSectionGradientStart:tint, sidebarFootBg:tint, newNoteIconBg:tint, settingsPressedBg:tint,
        memoTitle:titleInk, modalTitle:titleInk, settingsRowTitle:inkC,
        homeSectionTitle:mutedC, settingsGroupTitle:mutedC,
        ink:inkC, muted:mutedC, faint:faintC, line:lineC, lineSoft:lineSoftC
      });
    }
    return out;
  }
  const CUSTOM_NOTE_TYPE_KEYS = Object.freeze(["free","html","lorebook","log","persona","character","idea"]);
  function customThemeAutoTypeVars(mainA,mainB,dark){
    const a=hexToHsl(mainA),b=hexToHsl(mainB),mid=blendHsl(mainA,mainB,.5);
    const delta=Math.abs(((b.h-a.h+540)%360)-180), spread=delta<46?16:7, saturation=Math.max(.46,Math.min(.84,mid.s*.92+.06));
    // v66.8: 기존 다크 추천 팔레트의 선명한 타입색(L .69)을 라이트 모드의 기준으로 승격합니다.
    // 다크 표면에서는 같은 팔레트를 한 단계 밝힌 L .77로 사용해, 일곱 타입의 점·태그가 묻히지 않게 합니다.
    // 태그 글자는 표면 모드와 무관하게 실제 배경 밝기에 맞춰 계산해 밝은 태그 위에서도 읽히게 유지합니다.
    const typeLightness=dark?.77:.69;
    const vars={"--custom-note-divider-text":dark?hslToHex(mid.h,Math.max(.12,mid.s*.16),.93):hslToHex(mid.h,Math.max(.22,mid.s*.42),.27),"--custom-note-divider-count":dark?hslToHex(mid.h,Math.max(.10,mid.s*.12),.61):hslToHex(mid.h,Math.max(.12,mid.s*.20),.54)};
    CUSTOM_NOTE_TYPE_KEYS.forEach((type,index)=>{
      const point=index/(CUSTOM_NOTE_TYPE_KEYS.length-1), hue=lerpHue(a.h,b.h,point)+(index-3)*spread;
      const color=hslToHex(hue,Math.min(.86,saturation+(index%3)*.025),typeLightness);
      vars[`--custom-note-type-${type}`]=color;
      vars[`--custom-note-type-${type}-ink`]=contrastInk(color,false);
    });
    return vars;
  }
  function customThemeAccentVars(palette,mode){
    const c=palette.colors, a=normalizeThemeHex(c.mainA,"#2F6FD0"), b=normalizeThemeHex(c.mainB,gradientMate(a));
    const mid=blendHsl(a,b,.5),dark=mode==="dark", deep=dark?hslToHex(mid.h,Math.max(.28,mid.s*.55),.23):hslToHex(mid.h,Math.max(.34,mid.s*.58),.30);
    const suggestedSoft=dark?hslToHex(mid.h,Math.max(.18,mid.s*.28),.18):hslToHex(mid.h,Math.max(.14,mid.s*.24),.91);
    const soft=normalizeThemeHex(c.softAccentBg,suggestedSoft);
    const glowColor=normalizeThemeHex(c.glowColor||a,a),logoBody=a,logoTip=b,logoInk=normalizeThemeHex(c.logoCore,contrastInk(a,dark)),word=dark?hslToHex(mid.h,Math.max(.15,mid.s*.22),.88):hslToHex(mid.h,Math.max(.24,mid.s*.42),.27);
    const quickB=dark?hslToHex(hexToHsl(b).h,Math.max(.22,hexToHsl(b).s*.48),.18):hslToHex(hexToHsl(b).h,Math.max(.14,hexToHsl(b).s*.28),.965);
    return {
      "--accent":a,"--accent-2":b,"--accent-deep":deep,"--accent-soft":soft,"--accent-ink":c.ink,
      "--grad-blue":`linear-gradient(135deg, ${a} 0%, ${b} 100%)`,"--glow":`0 0 ${dark?24:18}px ${themeHexAlpha(glowColor,dark?.30:.18)}`,"--logo-ink":word,
      "--custom-main-a":a,"--custom-main-b":b,"--custom-glow-color":glowColor,"--custom-logo-body":logoBody,"--custom-logo-tip":logoTip,"--custom-logo-ink":logoInk,
      "--custom-logo-glow":`drop-shadow(0 0 ${dark?13:6}px ${themeHexAlpha(glowColor,dark?.46:.28)})`,
      "--quickmenu-default-icon-bg-a":soft,"--quickmenu-default-icon-bg-b":quickB,"--quickmenu-panel-bg-b":soft,
      ...customThemeAutoTypeVars(a,b,dark)
    };
  }
  function inferLegacyBaseAccent(raw) { const src=raw&&typeof raw==="object"?raw:{}; const primary=normalizeThemeHex(src.primary||src.main||src.mainA,"#7B9BFF"), secondary=normalizeThemeHex(src.secondary||src.mainB,"#B58BFF"); let best="blue", score=Infinity; Object.entries(ACCENTS).forEach(([name,meta])=>{const s=colorDistance(primary,meta.ig[0])+colorDistance(secondary,meta.ig[1]);if(s<score){score=s;best=name;}}); return best; }
  function withPresetComputed(accentName, mode, read) {
    const root=document.documentElement, oldTheme=root.getAttribute("data-theme"), oldAccent=root.getAttribute("data-accent"), oldCustom=root.getAttribute("data-custom-theme");
    const inline=new Map(CUSTOM_THEME_STYLE_VARS.map((name)=>[name,root.style.getPropertyValue(name)]));
    try { root.removeAttribute("data-custom-theme"); CUSTOM_THEME_STYLE_VARS.forEach((name)=>root.style.removeProperty(name)); root.setAttribute("data-theme",mode); const accent=validAccentName(accentName); if(accent==="blue")root.removeAttribute("data-accent");else root.setAttribute("data-accent",accent); return read(getComputedStyle(root)); }
    finally { setOrRemoveAttr(root,"data-theme",oldTheme); setOrRemoveAttr(root,"data-accent",oldAccent); setOrRemoveAttr(root,"data-custom-theme",oldCustom); inline.forEach((value,name)=>{if(value)root.style.setProperty(name,value);else root.style.removeProperty(name);}); }
  }
  function capturePresetPalette(accentName,mode){ return withPresetComputed(accentName,mode,(css)=>Object.fromEntries(CUSTOM_THEME_COLOR_META.map((item)=>{
    const sourceVar=({ softAccentBg:"--accent-soft", logoCore:"--accent-ink", glowColor:"--accent", tagBorder:"--accent", sectionTitleBg:"--accent-soft", sidebarFootBg:"--accent-soft", sidebarSectionGradientStart:"--accent-soft", sidebarCountBg:"--accent-soft", topbarShadow:"--accent", memoShadow:"--accent", memoCodeBg:"--paper", memoCodeIconBg:"--accent-soft", memoTitle:"--logo-ink", homeSectionTitle:"--muted", homeSectionTitleBg:"--accent-soft", homeShadow:"--accent", projectCountBg:"--accent-soft", projectCountText:"--accent", homeSortBg:"--accent-soft", modalTitle:"--logo-ink", newNoteIconBg:"--accent-soft", settingsGroupTitle:"--muted", settingsRowTitle:"--ink", settingsShadow:"--accent", settingsPressedBg:"--surface-2" })[item.key] || item.variable;
    return [item.key,normalizeThemeHex((css.getPropertyValue(sourceVar)||"").trim(),item.fallback)];
  }))) || cloneThemeObject(CUSTOM_THEME_FALLBACK_COLORS); }
  function normalizePalette(raw,fallback,mode){
    const src=raw&&typeof raw==="object"?raw:{}, ref=fallback||CUSTOM_THEME_FALLBACK_COLORS, out={};
    // v66.18: older palettes exposed only a section title tint. Preserve it as the new shared
    // light-accent background so existing user palettes do not suddenly change character.
    const legacySharedSoft=src.softAccentBg||src.sectionTitleBg||src.memoCodeIconBg||src.homeSectionTitleBg||src.newNoteIconBg||src.sidebarCountBg||src.homeSortBg;
    const legacyMain=normalizeThemeHex(src.main||src.mainA,ref.mainA||"#2F6FD0");
    out.mainA=normalizeThemeHex(src.mainA||src.main,ref.mainA||legacyMain);
    out.mainB=normalizeThemeHex(src.mainB,ref.mainB||gradientMate(legacyMain));
    const recommended=recommendCustomPalette(out.mainA,out.mainB,mode==="dark"?"dark":"light");
    CUSTOM_THEME_COLOR_META.filter((item)=>item.key!=="mainA"&&item.key!=="mainB").forEach((item)=>{
      if(item.key==="softAccentBg"){
        out[item.key]=normalizeThemeHex(legacySharedSoft,recommended[item.key]||item.fallback);
        return;
      }
      if(CUSTOM_THEME_SHARED_SOFT_KEYS.includes(item.key)){
        out[item.key]=out.softAccentBg;
        return;
      }
      if(item.derived){ out[item.key]=normalizeThemeHex(recommended[item.key],item.fallback); return; }
      const missingRole=["logoCore","glowColor","tagBorder","topbarShadow","memoShadow","memoCodeBg","memoTitle","homeSectionTitle","homeShadow","projectCountText","modalTitle","settingsGroupTitle","settingsRowTitle","settingsShadow"].includes(item.key);
      out[item.key]=normalizeThemeHex(src[item.key],missingRole?(recommended[item.key]||item.fallback):(ref[item.key]||item.fallback));
    });
    return out;
  }
  function normalizeCustomTheme(raw){
    const src=raw&&typeof raw==="object"?(raw.value&&typeof raw.value==="object"?raw.value:raw):{};
    const legacyV1=Number(src.version||1)<2&&(src.primary||src.secondary||src.accent===LEGACY_CUSTOM_ACCENT);
    const baseAccent=validAccentName(src.baseAccent||(legacyV1?inferLegacyBaseAccent(src):"blue"));
    const presetLight=capturePresetPalette(baseAccent,"light"),presetDark=capturePresetPalette(baseAccent,"dark");
    const oldLight=src.light&&typeof src.light==="object"?src.light:{enabled:legacyV1?true:src.enabled===true,colors:src.colors};
    const oldDark=src.dark&&typeof src.dark==="object"?src.dark:{enabled:false,colors:null};
    const hasStoredPalette=!!(src.light||src.dark||src.colors||src.main||src.mainA||src.mainB||src.primary||src.secondary);
    return {version:15,baseAccent,
      light:{enabled:hasStoredPalette ? oldLight.enabled!==false : false,colors:normalizePalette(oldLight.colors,presetLight,"light")},
      dark:{enabled:hasStoredPalette ? oldDark.enabled!==false : false,colors:normalizePalette(oldDark.colors,presetDark,"dark")},
      updatedAt:Number(src.updatedAt)||0};
  }
  function currentCustomTheme(){ if(!st.customTheme||typeof st.customTheme!=="object")st.customTheme=normalizeCustomTheme(null); return normalizeCustomTheme(st.customTheme); }
  function customThemeSeedFromActiveAccent(){ const activeAccent=st.accent===LEGACY_CUSTOM_ACCENT?currentCustomTheme().baseAccent:validAccentName(st.accent); const baseAccent=validAccentName(activeAccent); const lightPreset=capturePresetPalette(baseAccent,"light"),darkPreset=capturePresetPalette(baseAccent,"dark"); return {version:15,baseAccent,light:{enabled:true,colors:recommendCustomPalette(lightPreset.mainA,lightPreset.mainB,"light")},dark:{enabled:true,colors:recommendCustomPalette(darkPreset.mainA,darkPreset.mainB,"dark")},updatedAt:now()}; }
  function customThemeStyleVars(palette,mode){
    const colors=palette.colors||{};
    const soft=normalizeThemeHex(colors.softAccentBg,"#EAF0FF");
    const memoShadow=normalizeThemeHex(colors.memoShadow||colors.homeShadow||colors.settingsShadow,mode==="dark"?"#0E1630":"#7690C2");
    const shadow=mode==="dark"
      ? `0 1px 4px ${themeHexAlpha(memoShadow,.30)}, 0 6px 16px ${themeHexAlpha(memoShadow,.24)}`
      : `0 1px 3px ${themeHexAlpha(memoShadow,.13)}, 0 5px 14px ${themeHexAlpha(memoShadow,.15)}`;
    const direct=Object.fromEntries(CUSTOM_THEME_COLOR_META.map((item)=>[item.variable,colors[item.key]]));
    const aliases=Object.fromEntries(Object.keys(CUSTOM_THEME_SHARED_SOFT_VARS).map((variable)=>[variable,soft]));
    return Object.assign({"--shadow":shadow},direct,customThemeAccentVars(palette,mode),aliases);
  }
  function clearCustomThemeStyles(){ const root=document.documentElement; CUSTOM_THEME_STYLE_VARS.forEach((name)=>root.style.removeProperty(name)); root.removeAttribute("data-custom-theme"); root.style.removeProperty("--custom-preview-a"); root.style.removeProperty("--custom-preview-b"); }
  function updateThemeMetaColor(){ const meta=document.querySelector('meta[name=theme-color]');if(!meta)return;const value=(getComputedStyle(document.documentElement).getPropertyValue("--bg")||"").trim();meta.setAttribute("content",/^#[0-9a-f]{6}$/i.test(value)?value:(st.theme==="light"?"#f3f4f8":"#0d0f17")); }
  function syncAccentGradientAndLabel(){ const css=getComputedStyle(document.documentElement),first=(css.getPropertyValue("--accent")||"#7B9BFF").trim(),second=(css.getPropertyValue("--accent-2")||"#B58BFF").trim();const a=$("igA"),bb=$("igB");if(a)a.setAttribute("stop-color",first);if(bb)bb.setAttribute("stop-color",second);const value=$("setAccentVal");if(value)value.innerHTML=`<span class="accent-dot"></span>${themeDisplayName()}`; }
  function applyCustomTheme(config,options){ const opt=options||{},cfg=normalizeCustomTheme(config),root=document.documentElement;st.customTheme=cfg;clearCustomThemeStyles();const active=st.theme==="dark"?"dark":"light",palette=cfg[active];if(st.accent===LEGACY_CUSTOM_ACCENT){root.setAttribute("data-custom-theme",active);Object.entries(customThemeStyleVars(palette,active)).forEach(([key,value])=>root.style.setProperty(key,value));}root.style.setProperty("--custom-preview-a",cfg.light.colors.mainA);root.style.setProperty("--custom-preview-b",cfg.light.colors.mainB);if(opt.persist!==false){try{localStorage.setItem("luminkCustomTheme",JSON.stringify(cfg));}catch(e){}}syncAccentGradientAndLabel();updateThemeMetaColor(); }
  async function persistCustomTheme(config,options){ const opt=options||{},cfg=normalizeCustomTheme(Object.assign({},config,{updatedAt:now()}));cfg.light.enabled=true;cfg.dark.enabled=true;st.customTheme=cfg;try{localStorage.setItem("luminkCustomTheme",JSON.stringify(cfg));}catch(e){}try{await put("settings",{id:CUSTOM_THEME_SETTING_ID,value:cfg,updatedAt:cfg.updatedAt});}catch(e){if(!opt.silent)toast("직접 지정 색상을 저장하지 못했어요");throw e;}if(opt.backup!==false)triggerAutoBackup();return cfg; }
  async function loadCustomThemeSetting(){let stored=null;try{const row=await getOne("settings",CUSTOM_THEME_SETTING_ID);stored=row&&row.value;}catch(e){}if(!stored){try{const raw=localStorage.getItem("luminkCustomTheme");if(raw)stored=JSON.parse(raw);}catch(e){}}const cfg=normalizeCustomTheme(stored||st.customTheme||null);st.customTheme=cfg;const needsMigration=stored&&Number((stored.value||stored).version||1)<15;if(needsMigration){try{await persistCustomTheme(cfg,{backup:false,silent:true});}catch(e){}}applyCustomTheme(cfg,{persist:false});}
  function appearanceSnapshot(){return {version:10,accent:st.accent===LEGACY_CUSTOM_ACCENT?LEGACY_CUSTOM_ACCENT:validAccentName(st.accent),customTheme:normalizeCustomTheme(st.customTheme||null),updatedAt:now()};}
  async function restoreAppearanceConfig(value){if(!value||typeof value!=="object")return;const cfg=normalizeCustomTheme(value.customTheme||st.customTheme||null),accent=value.accent===LEGACY_CUSTOM_ACCENT?LEGACY_CUSTOM_ACCENT:validAccentName(value.accent||cfg.baseAccent);st.customTheme=cfg;try{await put("settings",{id:CUSTOM_THEME_SETTING_ID,value:cfg,updatedAt:cfg.updatedAt||now()});}catch(e){}try{localStorage.setItem("luminkCustomTheme",JSON.stringify(cfg));}catch(e){}applyAccent(accent);applyCustomTheme(cfg,{persist:false});}
  function themeDisplayName(){ if(st.accent===LEGACY_CUSTOM_ACCENT)return "사용자 지정"; return (ACCENTS[validAccentName(st.accent)]||ACCENTS.blue).name; }
  function applyAccent(name){const custom=name===LEGACY_CUSTOM_ACCENT;const accent=custom?LEGACY_CUSTOM_ACCENT:validAccentName(name);st.accent=accent;if(custom||accent==="blue")document.documentElement.removeAttribute("data-accent");else document.documentElement.setAttribute("data-accent",accent);if(!custom&&st.customTheme){st.customTheme.baseAccent=accent;}try{localStorage.setItem("luminkAccent",accent);}catch(e){}applyCustomTheme(st.customTheme,{persist:false});}
  function detectAccent(){let name=null,rawTheme=null;try{name=localStorage.getItem("luminkAccent");const raw=localStorage.getItem("luminkCustomTheme");if(raw)rawTheme=JSON.parse(raw);}catch(e){}const cfg=normalizeCustomTheme(rawTheme||null);st.customTheme=cfg;const configured=rawTheme&&!!((rawTheme.light&&rawTheme.light.enabled===true)||(rawTheme.dark&&rawTheme.dark.enabled===true));if(!name&&configured)name=LEGACY_CUSTOM_ACCENT;applyAccent(name===LEGACY_CUSTOM_ACCENT?LEGACY_CUSTOM_ACCENT:validAccentName(name||"blue"));}
  function customThemePreviewPaint(box,palette){if(!box)return;const c=palette.colors;Object.entries({"--ct-bg":c.bg,"--ct-card":c.surface,"--ct-card-2":c.surface2,"--ct-ink":c.ink,"--ct-muted":c.muted,"--ct-line":c.line,"--ct-bar":c.barBg2,"--ct-main-a":c.mainA,"--ct-main-b":c.mainB}).forEach(([k,v])=>box.style.setProperty(k,v));box.classList.toggle("is-off",!palette.enabled);}
  const CUSTOM_THEME_EXPORT_KIND = "lumink-custom-theme";
  const CUSTOM_THEME_EXPORT_VERSION = 1;
  function exportCustomThemeJson(config) {
    const payload={kind:CUSTOM_THEME_EXPORT_KIND,schemaVersion:CUSTOM_THEME_EXPORT_VERSION,exportedAt:now(),customTheme:normalizeCustomTheme(config)};
    downloadDoc(JSON.stringify(payload,null,2).replace(/</g,"\\u003c"),`lumink-custom-theme-${dateStamp()}.json`,"application/json");
  }
  function importCustomThemeJson(onLoad) {
    const input=document.createElement("input"); input.type="file"; input.accept="application/json,.json"; input.style.display="none"; document.body.appendChild(input);
    input.addEventListener("change",()=>{const file=input.files&&input.files[0]; if(!file){input.remove();return;} const reader=new FileReader(); reader.onload=()=>{try{const raw=JSON.parse(String(reader.result||"{}")); const source=raw&&typeof raw==="object"?(raw.customTheme||raw):null; if(!source||typeof source!=="object")throw new Error("invalid"); const cfg=normalizeCustomTheme(source); if(typeof onLoad==="function")onLoad(cfg); }catch(e){toast("사용자 테마 JSON 파일을 읽지 못했어요");} finally{input.remove();}}; reader.onerror=()=>{toast("사용자 테마 JSON 파일을 읽지 못했어요");input.remove();}; reader.readAsText(file,"UTF-8");});
    input.click();
  }
  function openCustomThemeStudio(seed,initialMode){
    const before=cloneThemeObject(currentCustomTheme()), beforeAccent=st.accent; let draft=seed?normalizeCustomTheme(seed):(before.light.enabled||before.dark.enabled?cloneThemeObject(before):customThemeSeedFromActiveAccent()); draft.light.enabled=true; draft.dark.enabled=true; let mode=initialMode==="dark"?"dark":"light";
    const restore=()=>{st.customTheme=cloneThemeObject(before);applyAccent(beforeAccent===LEGACY_CUSTOM_ACCENT?LEGACY_CUSTOM_ACCENT:validAccentName(beforeAccent));applyCustomTheme(before,{persist:false});};customThemePreviewRestore=restore;
    const palette=draft[mode],fields=CUSTOM_THEME_GROUPS.map(([key,label])=>{const groupItems=CUSTOM_THEME_COLOR_META.filter((item)=>item.group===key&&!item.derived);if(!groupItems.length)return "";const items=groupItems.map((item)=>`<button type="button" class="custom-theme-field custom-theme-field-button${key==="main"?" is-main":""}" data-custom-editor-key="${item.key}"><span><b>${esc(item.label)}</b><small>${palette.colors[item.key]}</small></span><i style="background:${palette.colors[item.key]}"></i><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14.8 4.2 5 5L9 20H4v-5Z"/><path d="m12.2 6.8 5 5"/></svg></button>`).join("");return `<section class="custom-theme-group custom-theme-group-${key}"><h4>${label}</h4>${items}</section>`;}).join("");
    const title=mode==="dark"?"다크 모드 독립 테마":"라이트 모드 독립 테마";
    openModal(`<h3>사용자 지정 테마</h3><p class="m-sub">사용자 지정은 프리셋의 변형이 아니라, <b>두 메인 색상의 그라데이션</b>에서 시작하는 독립 테마입니다. 로고·버튼·아이콘까지 같은 두 색을 함께 사용합니다.</p><div class="custom-theme-tabs"><button class="custom-theme-tab ${mode==="light"?"is-active":""}" data-custom-tab="light">라이트 모드</button><button class="custom-theme-tab ${mode==="dark"?"is-active":""}" data-custom-tab="dark">다크 모드</button></div><div class="custom-theme-studio"><div class="custom-theme-preview" id="customThemePreview"><span class="custom-theme-preview-mark"><svg viewBox="0 0 24 24"><path d="M12 3v18M3 12h18"/><path d="m5 5 14 14M19 5 5 19" opacity=".45"/></svg></span><span class="custom-theme-preview-copy"><b>${title}</b><small id="customThemePreviewText">두 메인 색상으로 로고와 추천 팔레트를 함께 구성합니다</small></span><span class="custom-theme-swatches"><i></i><i></i></span></div><div class="custom-theme-fields">${fields}</div><div class="custom-theme-tools custom-theme-tools-stacked"><small>메인 색상 1·2를 고른 뒤 추천 팔레트를 만들면 두 색의 결을 살린 배경·카드·글자·경계선이 한 번에 채워집니다. 옅은 강조·선택 배경 하나를 바꾸면 코드 보기 아이콘, 글자 크기 선택, 새 메모 아이콘, 카운트·태그·섹션 제목 배경, 퀵메뉴 기본 아이콘의 첫 색과 패널 하단 색조까지 함께 정리됩니다. 메인 화면 섹션 제목 색은 홈·프로젝트 내부의 정렬 글자와 아이콘에도 함께 적용됩니다.</small><div><button type="button" class="custom-theme-auto primary" id="customThemeRecommend">두 메인 색상으로 추천 팔레트 만들기</button><button type="button" class="custom-theme-auto" id="customThemeReset">현재 프리셋 색상 불러오기</button></div></div><div class="custom-theme-file-actions"><button type="button" class="custom-theme-auto" id="customThemeExport">현재 세팅 JSON 저장</button><button type="button" class="custom-theme-auto" id="customThemeImport">JSON 불러오기</button></div><p class="custom-theme-note">현재 편집 중인 라이트·다크 팔레트는 JSON으로 따로 보관하거나 다시 불러올 수 있습니다.</p></div><div class="m-row"><button class="m-btn" id="customThemeCancel">취소</button><button class="m-btn primary" id="customThemeApply">적용</button></div>`);
    const preview=()=>{customThemePreviewPaint($("customThemePreview"),draft[mode]); if(st.theme===mode){ st.customTheme=normalizeCustomTheme(draft); applyAccent(LEGACY_CUSTOM_ACCENT); }};
    document.querySelectorAll("[data-custom-tab]").forEach((b)=>b.addEventListener("click",()=>openCustomThemeStudio(draft,b.dataset.customTab)));
    document.querySelectorAll("[data-custom-editor-key]").forEach((b)=>b.addEventListener("click",()=>{const key=b.dataset.customEditorKey,item=CUSTOM_THEME_COLOR_META.find((x)=>x.key===key);openAdvancedColorPicker(`${item.label} 색상`,draft[mode].colors[key],(value)=>{draft[mode].colors[key]=value;openCustomThemeStudio(draft,mode);},{prefix:"customThemeRole",saved:true,save:true,intro:"정사각형 색상판·HEX·RGB·스포이드로 정확하게 조절할 수 있어요."});}));
    $("customThemeRecommend").addEventListener("click",()=>{draft[mode].colors=recommendCustomPalette(draft[mode].colors.mainA,draft[mode].colors.mainB,mode);draft[mode].enabled=true;openCustomThemeStudio(draft,mode);});
    $("customThemeReset").addEventListener("click",()=>{draft[mode].colors=capturePresetPalette(validAccentName(draft.baseAccent),mode);draft[mode].enabled=true;preview();openCustomThemeStudio(draft,mode);});
    $("customThemeExport").addEventListener("click",()=>{exportCustomThemeJson(draft);toast("사용자 테마 JSON을 저장했어요");});
    $("customThemeImport").addEventListener("click",()=>importCustomThemeJson((loaded)=>{toast("사용자 테마를 불러왔어요. 적용을 누르면 반영됩니다.");openCustomThemeStudio(loaded,mode);}));
    $("customThemeCancel").addEventListener("click",closeModal);$("customThemeApply").addEventListener("click",async()=>{try{draft.light.enabled=true;draft.dark.enabled=true;const saved=await persistCustomTheme(draft);applyAccent(LEGACY_CUSTOM_ACCENT);applyCustomTheme(saved,{persist:false});customThemePreviewRestore=null;closeModal();renderSettings();toast("사용자 지정 테마를 적용했어요");}catch(e){}});preview();
  }
  function openAccentPicker(){const cur=st.accent===LEGACY_CUSTOM_ACCENT?LEGACY_CUSTOM_ACCENT:validAccentName(st.accent||"blue"),cells=Object.keys(ACCENTS).map((key)=>`<div class="accent-cell${key===cur?" sel":""}" data-accent="${key}"><span class="ac-sw" style="background:${ACCENTS[key].grad}"></span><span class="ac-name">${ACCENTS[key].name}</span></div>`).join(""),customCfg=currentCustomTheme(),customCell=`<div class="accent-cell accent-custom${cur===LEGACY_CUSTOM_ACCENT?" sel is-custom":""}" data-custom-light="1" style="--custom-preview-a:${customCfg.light.colors.mainA};--custom-preview-b:${customCfg.light.colors.mainB}"><span class="ac-sw"></span><span class="ac-name">사용자 지정</span></div>`;openModal(`<h3>컬러 테마</h3><p class="m-sub">프리셋은 v64.9 원래 색상 결을 유지합니다. <b>사용자 지정</b>을 선택하면 프리셋 선택은 해제되고, 라이트·다크 각각의 두 색 그라데이션 독립 테마가 적용됩니다.</p><div class="accent-grid">${cells}${customCell}</div><div class="m-row"><button class="m-btn" id="acClose">닫기</button></div>`);$on("acClose","click",closeModal);document.querySelectorAll(".accent-cell[data-accent]").forEach((el)=>el.addEventListener("click",()=>{applyAccent(el.dataset.accent);document.querySelectorAll(".accent-cell").forEach((x)=>x.classList.toggle("sel",x===el));renderSettings();}));const cell=document.querySelector(".accent-cell[data-custom-light]");if(cell)cell.addEventListener("click",()=>{applyAccent(LEGACY_CUSTOM_ACCENT);closeModal();openCustomThemeStudio();});}

  /* ---------- font scale ---------- */
  const FS_ZOOM = { small: 0.9, normal: 1, large: 1.12 };
  function applyFontScale(v) {
    if (!FS_ZOOM[v]) v = "normal";
    st.fontScale = v;
    document.documentElement.setAttribute("data-fs", v);
    document.documentElement.style.setProperty("--fs-zoom", FS_ZOOM[v]);
    document.body.style.zoom = FS_ZOOM[v];
    try { localStorage.setItem("luminkFontScale", v); } catch (e) {}
    document.querySelectorAll("#fontSizeSeg button").forEach((b) => b.classList.toggle("on", b.dataset.fs === v));
  }
  function detectFontScale() { let v = "normal"; try { v = localStorage.getItem("luminkFontScale") || "normal"; } catch (e) {} applyFontScale(v); }

  /* ---------- free memo toolbar / install icon ---------- */
  function applyFormatbarMode(mode) {
    st.formatbarMode = mode === "folded" ? "folded" : "always";
    document.body.classList.toggle("formatbar-folded", st.formatbarMode === "folded");
    try { localStorage.setItem("luminkFormatbarMode", st.formatbarMode); } catch (e) {}
    const value = $("setToolbarModeVal"); if (value) value.textContent = st.formatbarMode === "folded" ? "접어두기" : "항상 표시";
  }
  function detectFormatbarMode() { let mode = "always"; try { mode = localStorage.getItem("luminkFormatbarMode") || "always"; } catch (e) {} applyFormatbarMode(mode); }
  function toggleFormatbarFold() { document.body.classList.toggle("formatbar-folded"); }
  function openFormatbarModePicker() {
    const current = st.formatbarMode === "folded" ? "folded" : "always";
    openModal(`<h3>자유 메모 툴바</h3><p class="m-sub">기본 상태를 정해요. 접어둔 상태에서도 왼쪽 화살표로 잠시 펼칠 수 있어요.</p><div class="size-list"><div class="size-item toolbar-mode" data-v="always">항상 표시${current === "always" ? ' <span style="margin-left:auto;color:var(--accent);font-weight:800">✓</span>' : ""}</div><div class="size-item toolbar-mode" data-v="folded">접어두기${current === "folded" ? ' <span style="margin-left:auto;color:var(--accent);font-weight:800">✓</span>' : ""}</div></div><div class="m-row"><button class="m-btn" id="tbModeClose">닫기</button></div>`);
    $("modalBox").querySelectorAll(".toolbar-mode").forEach((item) => item.addEventListener("click", () => { applyFormatbarMode(item.dataset.v); closeModal(); }));
    $on("tbModeClose", "click", closeModal);
  }
  // 설치 아이콘 선택은 v65.8부터 간판 페이지에서 진행합니다.
  // 컬러별 설치 페이지로 바로 점프하지 않아도 전체 소개와 색상 선택을 한 흐름으로 볼 수 있어요.
  function openInstallIconPicker() { void openInstallStartPage(); }

  /* ---------- auto backup (user-selectable retention: 1–15 snapshots) ---------- */
  const AUTO_BACKUP_LIMIT_KEY = "luminkAutoBackupLimit";
  const AUTO_BACKUP_LIMIT_DEFAULT = 10;
  const AUTO_BACKUP_LIMIT_MIN = 1;
  const AUTO_BACKUP_LIMIT_MAX = 15;
  function clampAutoBackupLimit(value) {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed)) return AUTO_BACKUP_LIMIT_DEFAULT;
    return Math.min(AUTO_BACKUP_LIMIT_MAX, Math.max(AUTO_BACKUP_LIMIT_MIN, parsed));
  }
  function getAutoBackupLimit() {
    try { return clampAutoBackupLimit(localStorage.getItem(AUTO_BACKUP_LIMIT_KEY)); }
    catch (e) { return AUTO_BACKUP_LIMIT_DEFAULT; }
  }
  function setAutoBackupLimit(value) {
    const limit = clampAutoBackupLimit(value);
    try { localStorage.setItem(AUTO_BACKUP_LIMIT_KEY, String(limit)); } catch (e) {}
    return limit;
  }
  async function pruneAutoBackups(limit, snapshots) {
    const keep = clampAutoBackupLimit(limit);
    const all = Array.isArray(snapshots) ? snapshots.slice() : await getAll("backups");
    all.sort((a, b) => (Number(b.ts) || 0) - (Number(a.ts) || 0));
    for (let i = keep; i < all.length; i++) await del("backups", all[i].id);
    return Math.max(0, all.length - keep);
  }
  let autoBkTimer = null, autoBkLast = 0;
  function triggerAutoBackup() {
    const nowt = Date.now();
    if (autoBkTimer) return;
    const wait = Math.max(0, 18000 - (nowt - autoBkLast));
    autoBkTimer = setTimeout(() => { autoBkTimer = null; doAutoBackup(); }, wait);
  }
  async function doAutoBackup() {
    autoBkLast = Date.now();
    try {
      const files = await getAll("files");
      // Blob은 불변값이라 스냅샷에 안전하게 보관되며, 원본 파일 레코드와 독립적으로 복원됩니다.
      const snapFiles = files.map((f) => ({
        id: f.id, noteId: f.noteId, name: f.name, type: f.type,
        size: f.size, createdAt: f.createdAt, blob: f.blob
      }));
      const snap = {
        id: "bk_" + autoBkLast, version: 3, ts: autoBkLast,
        projects: JSON.parse(JSON.stringify(st.projects)),
        notes: JSON.parse(JSON.stringify(st.notes)), files: snapFiles,
        quickMenu: jsonCopy(quickMenuConfig()), appearance: appearanceSnapshot()
      };
      await put("backups", snap);
      await pruneAutoBackups(getAutoBackupLimit());
    } catch (e) { console.warn("autobackup", e); }
  }
  function openAutoBackupSettings() {
    const limit = getAutoBackupLimit();
    getAll("backups").then((all) => {
      const count = all.length;
      openModal(`<h3>자동 백업 보관 설정</h3><p class="m-sub">메모를 저장할 때마다 현재 상태를 스냅샷으로 남겨요. 보관 수를 줄이면 가장 오래된 백업부터 바로 정리됩니다.</p>
        <div class="backup-limit-control" role="group" aria-label="자동 백업 보관 개수">
          <button type="button" class="backup-step-btn" id="autoBackupMinus" aria-label="보관 개수 줄이기">−</button>
          <label class="backup-limit-readout"><input id="autoBackupLimitInput" type="number" inputmode="numeric" min="${AUTO_BACKUP_LIMIT_MIN}" max="${AUTO_BACKUP_LIMIT_MAX}" value="${limit}" aria-label="보관할 자동 백업 개수"><span>개 보관</span></label>
          <button type="button" class="backup-step-btn" id="autoBackupPlus" aria-label="보관 개수 늘리기">+</button>
        </div>
        <div class="backup-limit-note"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 10v6M12 7h.01"/></svg><span>최소 ${AUTO_BACKUP_LIMIT_MIN}개부터 최대 ${AUTO_BACKUP_LIMIT_MAX}개까지 설정할 수 있어요. 현재 ${count}개 저장됨.</span></div>
        <div class="m-row"><button class="m-btn" id="autoBackupBackToList">목록으로</button><button class="m-btn primary" id="autoBackupSave">저장</button></div>`);
      const input = $("autoBackupLimitInput");
      const current = () => clampAutoBackupLimit(input.value);
      const sync = (value) => { input.value = String(clampAutoBackupLimit(value)); };
      $on("autoBackupMinus", "click", () => sync(current() - 1));
      $on("autoBackupPlus", "click", () => sync(current() + 1));
      input.addEventListener("blur", () => sync(current()));
      input.addEventListener("input", () => { if (input.value && Number(input.value) > AUTO_BACKUP_LIMIT_MAX) sync(AUTO_BACKUP_LIMIT_MAX); });
      $on("autoBackupBackToList", "click", () => { closeModal(); openAutoBackupList(); });
      $on("autoBackupSave", "click", async () => {
        const next = setAutoBackupLimit(current());
        try {
          const removed = await pruneAutoBackups(next);
          renderSettings(); closeModal();
          toast(removed ? `자동 백업 보관 수를 ${next}개로 설정하고 ${removed}개를 정리했어요` : `자동 백업 보관 수를 ${next}개로 설정했어요`);
        } catch (e) { toast("자동 백업 설정을 저장하지 못했어요"); }
      });
    }).catch(() => { toast("자동 백업 정보를 읽지 못했어요"); });
  }

  function openAutoBackupList() {
    getAll("backups").then((all) => {
      all.sort((a, b) => b.ts - a.ts);
      const limit = getAutoBackupLimit();
      const rows = all.map((s) => {
        const dt = new Date(s.ts), label = `${dt.getMonth() + 1}/${dt.getDate()} ${String(dt.getHours()).padStart(2, "0")}:${String(dt.getMinutes()).padStart(2, "0")}`;
        const fileLabel = Array.isArray(s.files) ? ` · 첨부 ${s.files.length}` : " · 첨부 미포함";
        return `<div class="lore-pick" data-bk="${s.id}"><div class="lp-body"><div class="lp-name">${label}</div><div class="lp-meta">프로젝트 ${s.projects.length} · 메모 ${s.notes.length}${fileLabel}</div></div><button class="ce-addbtn ab-restore" data-bk="${s.id}">복원 ›</button></div>`;
      }).join("");
      const listBody = all.length
        ? `<div class="lore-pick-list">${rows}</div>`
        : `<div class="auto-backup-empty"><span class="auto-backup-empty-icon"><svg viewBox="0 0 24 24"><path d="M6 4h12v16H6z"/><path d="M9 8h6M9 12h6M9 16h4"/></svg></span><div><b>아직 저장된 자동 백업이 없어요</b><small>메모를 저장하면 이곳에 스냅샷이 쌓여요.</small></div></div>`;
      openModal(`<h3>자동 백업</h3><p class="m-sub">최근 ${all.length}/${limit}개 스냅샷. v44부터 첨부파일도 함께 보관합니다. 복원 방식은 병합 또는 완전 교체를 고를 수 있어요.</p>${listBody}<div class="m-row"><button class="m-btn" id="abSettings">보관 설정</button><button class="m-btn primary" id="abClose2">닫기</button></div>`);
      $on("abClose2", "click", closeModal);
      $on("abSettings", "click", () => { closeModal(); openAutoBackupSettings(); });
      document.querySelectorAll(".ab-restore").forEach((btn) => btn.addEventListener("click", () => {
        const snap = all.find((x) => x.id === btn.dataset.bk); if (!snap) return;
        const dt = new Date(snap.ts), label = `${dt.getMonth() + 1}/${dt.getDate()} ${String(dt.getHours()).padStart(2, "0")}:${String(dt.getMinutes()).padStart(2, "0")}`;
        openRestoreModePicker({ app: "lumink", projects: snap.projects, notes: snap.notes, files: snap.files || [], quickMenu: snap.quickMenu || null, appearance: snap.appearance || null }, `${label} 자동 백업`);
      }));
    }).catch(() => { toast("자동 백업 정보를 읽지 못했어요"); });
  }


  /* ---------- long-press ---------- */
  function fallbackCopy(text) { try { const ta = document.createElement("textarea"); ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0"; document.body.appendChild(ta); ta.focus(); ta.select(); const ok = document.execCommand("copy"); ta.remove(); return ok; } catch (e) { return false; } }
  function clipboardCopy(text) {
    return new Promise((res) => {
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(() => res(true)).catch(() => res(fallbackCopy(text)));
      else res(fallbackCopy(text));
    });
  }
  function attachLongPress(el, fn) {
    let timer = null, moved = false;
    const start = () => { moved = false; timer = setTimeout(() => { if (!moved) { navigator.vibrate && navigator.vibrate(12); fn(); } }, 500); };
    const cancel = () => { clearTimeout(timer); };
    el.addEventListener("touchstart", start, { passive: true });
    el.addEventListener("touchmove", () => { moved = true; cancel(); }, { passive: true });
    el.addEventListener("touchend", cancel);
    el.addEventListener("contextmenu", (e) => { e.preventDefault(); fn(); });
  }

  function bindQuickMenuInteractions() {
    const menu = $("quickMenu");
    if (!menu) return;
    // 외부 영역을 누르면 항상 접습니다. 메뉴 내부의 버튼·슬롯 입력은 그대로 유지합니다.
    document.addEventListener("pointerdown", (event) => {
      if (!document.body.classList.contains("quick-menu-open")) return;
      if (menu.contains(event.target)) return;
      setQuickMenuOpen(false);
    }, true);
    let active = null;
    const finish = (event) => {
      if (!active || (event.pointerId != null && active.id !== event.pointerId)) return;
      const dx = event.clientX - active.x, dy = event.clientY - active.y;
      if (Math.abs(dx) > 30 && Math.abs(dx) > Math.abs(dy) * 1.25) {
        if (dx < 0) setQuickMenuOpen(true);
        else if (active.open) setQuickMenuOpen(false);
      }
      active = null;
    };
    document.addEventListener("pointerdown", (event) => {
      if (event.pointerType === "mouse") return;
      const edgeStart = event.clientX >= window.innerWidth - 34;
      if (menu.contains(event.target) || edgeStart) active = { id:event.pointerId, x:event.clientX, y:event.clientY, open:document.body.classList.contains("quick-menu-open") };
    }, { passive:true });
    document.addEventListener("pointerup", finish, { passive:true });
    document.addEventListener("pointercancel", () => { active = null; }, { passive:true });
  }

  /* ---------- bind static ---------- */
  function bind() {
    $on("homeMenu", "click", openSidebar);
    $on("homeSettings", "click", () => go({ s: "settings" }));
    $on("quickMenuTab", "click", () => setQuickMenuOpen(!document.body.classList.contains("quick-menu-open")));
    $on("quickMenuEdit", "click", () => { setQuickMenuOpen(false); openQuickMenuManager(); });
    $on("quickMenuManage", "click", () => { setQuickMenuOpen(false); openQuickMenuManager(); });
    bindQuickMenuInteractions();
    $on("quickMenuImageInput", "change", async (event) => {
      const file = event.target.files && event.target.files[0], index = quickMenuImageSlot; event.target.value = "";
      if (!file || !Number.isInteger(index)) return;
      try { const current = quickMenuConfig().slots[index]; current.thumbnail = await quickThumbnailFromFile(file); current.iconCode = null; current.libraryIconId = null; await persistQuickMenu(); openQuickMenuSlotEditor(index); }
      catch (e) { toast((e && e.message) || "썸네일을 바꾸지 못했어요"); }
      finally { quickMenuImageSlot = null; }
    });
    // settings rows
    $on("setTheme", "click", () => { applyTheme(st.theme === "light" ? "dark" : "light"); renderSettings(); });
    $on("setFont", "click", showFontDialog);
    $on("setBackup", "click", exportBackup);
    $on("setRestore", "click", () => $("restoreInput").click());
    $on("setReset", "click", resetData);
    $on("setAutoBackup", "click", openAutoBackupList);
    $on("setStorage", "click", () => { void openQuickMenuStorageInfo(); });
    $on("setAccent", "click", openAccentPicker);
    $on("setQuickMenu", "click", openQuickMenuSettings);
    $on("setToolbarMode", "click", openFormatbarModePicker);
    $on("setInstallIcon", "click", openInstallIconPicker);
    $on("setManual", "click", () => { void openManualPage(); });
    document.querySelectorAll("#fontSizeSeg button").forEach((b) => b.addEventListener("click", () => applyFontScale(b.dataset.fs)));
    $on("restoreInput", "change", (e) => { const f = e.target.files && e.target.files[0]; if (f) restoreBackup(f); e.target.value = ""; });
    // selection bar
    $on("selCancel", "click", exitSelMode);
    $on("selAll", "click", selectAllCurrent);
    $on("selMove", "click", bulkMove);
    $on("selMerge", "click", mergeSelected);
    $on("selDelete", "click", bulkDelete);
    $on("homeNewMemo", "click", () => showTypePicker(null));
    $on("homeFab", "click", () => showTypePicker(null));
    $on("homeNewProject", "click", () => showProjectForm(null, () => { render(); renderSidebar(); }));
    document.querySelectorAll(".nav-back").forEach((b) => b.addEventListener("click", back));
    document.querySelectorAll(".nav-menu").forEach((b) => b.addEventListener("click", openSidebar));
    TOP_TITLE_IDS.forEach(bindTopTitleRename);
    $on("pdMore", "click", () => openProjectSheet(st.curProjectId));
    $on("pdSelect", "click", () => { if (notesOf(st.curProjectId).length) enterSelMode("note", null); else toast("선택할 메모가 없어요"); });
    $on("pdFab", "click", () => showTypePicker(st.curProjectId));
    $on("readEdit", "click", editCurrentNote);
    $on("edView", "click", async () => { if (navTransition) return; navTransition = true; try { await leaveFreeEditor(); commitGo({ s: "read" }); } finally { navTransition = false; } });
    $on("readMore", "click", () => openNoteSheet(st.curNoteId));
    $on("edBack", "click", () => { void back(); });
    $on("edMore", "click", () => openNoteSheet(st.curNoteId));
    $on("sbNewProject", "click", () => { closeSidebar(); showProjectForm(null, () => { render(); renderSidebar(); }); });
    $on("sbNewMemo", "click", () => { closeSidebar(); showTypePicker(null); });
    $on("sbSettings", "click", () => { closeSidebar(); go({ s: "settings" }); });
    $on("edSave", "click", async () => { await flushSave(true); toast("저장했어요"); });
    $on("loreSave", "click", async () => { await flushLore(); toast("저장했어요"); });
    $on("logSave", "click", async () => { await flushLog(); toast("저장했어요"); });
    document.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === "s" || e.key === "S")) {
        const s = curView().s;
        if (s === "html" && e.shiftKey) {
          e.preventDefault(); showHtmlExportDialog(st.curNoteId); return;
        }
        if (s === "regex" && e.shiftKey) {
          e.preventDefault(); void exportRegexJson(st.curNoteId); return;
        }
        if (s === "editor" || s === "html" || s === "regex" || s === "lore" || s === "log" || s === "persona" || s === "character" || s === "idea") {
          e.preventDefault();
          if (s === "editor") flushSave(true); else if (s === "html") flushHtmlSave(true); else if (s === "regex") flushRegexSave(true); else if (s === "lore") flushLore(); else if (s === "log") flushLog(); else if (s === "persona") flushPersona(); else if (s === "idea") flushIdeaBoard(); else flushCharacter();
          toast("저장했어요");
        }
      }
    });
    $on("perSave", "click", async () => { await flushPersona(); toast("저장했어요"); });
    $on("homeSort", "click", () => showSortMenu("home"));
    const toggleHasText = (inp) => { const bar = inp.closest(".searchbar"); if (bar) bar.classList.toggle("has-text", !!inp.value.length); };
    $on("homeSearch", "input", (e) => toggleHasText(e.target));
    $on("homeSearch", "keydown", (e) => { if (e.key === "Enter") { const v = e.target.value.trim(); if (v) { doSearch(v); e.target.value = ""; toggleHasText(e.target); } } });
    $on("homeGo", "click", () => { const i = $("homeSearch"), v = i.value.trim(); if (v) { doSearch(v); i.value = ""; toggleHasText(i); } });
    $on("homeClear", "click", () => { const i = $("homeSearch"); i.value = ""; toggleHasText(i); i.focus(); });
    $on("sbSearch", "input", (e) => toggleHasText(e.target));
    $on("sbSearch", "keydown", (e) => { if (e.key === "Enter") { const v = e.target.value.trim(); if (v) { closeSidebar(); doSearch(v); e.target.value = ""; toggleHasText(e.target); } } });
    $on("sbGo", "click", () => { const i = $("sbSearch"), v = i.value.trim(); if (v) { closeSidebar(); doSearch(v); i.value = ""; toggleHasText(i); } });
    $on("sbClear", "click", () => { const i = $("sbSearch"); i.value = ""; toggleHasText(i); i.focus(); });
    $on("searchInput", "input", (e) => { st.searchQuery = e.target.value; toggleHasText(e.target); renderSearch(); });
    $on("searchInput", "keydown", (e) => { if (e.key === "Enter") e.target.blur(); });
    $on("searchGo", "click", () => { $("searchInput").blur(); renderSearch(); });
    $on("searchClear", "click", () => { st.searchQuery = ""; const i = $("searchInput"); i.value = ""; toggleHasText(i); i.focus(); renderSearch(); });
    document.querySelectorAll("#screen-search .scope-btn").forEach((b) => b.addEventListener("click", () => { st.searchScope = b.dataset.s; renderSearch(); }));
    attachLongPress($("readBody"), () => {
      const t = ($("readBody").innerText || "").trim();
      if (t) clipboardCopy(t).then((ok) => toast(ok ? "본문을 복사했어요" : "복사하지 못했어요"));
    });
    attachLongPress($("perRDetail"), () => {
      if (st.perEdit) return;
      const n = getNote(st.curNoteId); if (!n) return;
      const o = (n.data && n.data[perLang]) || {}; const t = (o.detail || "").trim();
      if (t) clipboardCopy(t).then((ok) => toast(ok ? "설명을 복사했어요" : "복사하지 못했어요"));
    });
    attachLongPress($("lorePreview"), () => {
      const n = getNote(st.curNoteId); if (!n || n.type !== "lorebook") return;
      const t = ((n.data && n.data.content) || "").trim();
      if (t) clipboardCopy(t).then((ok) => toast(ok ? "원본을 복사했어요" : "복사하지 못했어요"));
    });
    $on("sbLogo", "click", goHome);
    $on("homeLogo", "click", () => { const hs = document.querySelector(".home-scroll"); if (hs) hs.scrollTo({ top: 0, behavior: "smooth" }); });
    $on("sbImport", "click", () => $("fileInput").click());
    $on("sbTheme", "click", () => applyTheme(st.theme === "light" ? "dark" : "light"));

    // read: double-tap to edit
    $on("readBody", "dblclick", editCurrentNote);

    // global edge swipes: left opens navigation, right opens the compact quick menu.
    let edgeX = null, edgeY = null, quickEdgeX = null, quickEdgeY = null, quickDragX = null, quickDragY = null;
    document.addEventListener("touchstart", (e) => {
      if (document.body.classList.contains("sidebar-open") || document.body.classList.contains("sheet-open") || $("modalScrim").classList.contains("open")) { edgeX = null; quickEdgeX = null; quickDragX = null; return; }
      const t = e.touches[0], root = $("quickMenu"), quickEnabled = quickMenuIsEnabled();
      edgeX = t.clientX <= 24 ? t.clientX : null; edgeY = t.clientY;
      quickEdgeX = quickEnabled && t.clientX >= window.innerWidth - 26 ? t.clientX : null; quickEdgeY = t.clientY;
      if (quickEnabled && root && document.body.classList.contains("quick-menu-open") && e.target.closest && e.target.closest("#quickMenuPanel")) { quickDragX = t.clientX; quickDragY = t.clientY; }
    }, { passive: true });
    document.addEventListener("touchmove", (e) => {
      const t = e.touches[0];
      if (edgeX != null && t.clientX - edgeX > 55 && Math.abs(t.clientY - edgeY) < 45) { openSidebar(); edgeX = null; quickEdgeX = null; }
      if (quickEdgeX != null && quickEdgeX - t.clientX > 45 && Math.abs(t.clientY - quickEdgeY) < 48) { setQuickMenuOpen(true); quickEdgeX = null; }
      if (quickDragX != null && t.clientX - quickDragX > 62 && Math.abs(t.clientY - quickDragY) < 48) { setQuickMenuOpen(false); quickDragX = null; }
    }, { passive: true });
    document.addEventListener("touchend", () => { edgeX = null; quickEdgeX = null; quickDragX = null; });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && document.body.classList.contains("quick-menu-open")) setQuickMenuOpen(false); });

    // HTML workshop
    $on("htmlSource", "input", scheduleHtmlSave);
    $on("htmlSource", "blur", () => { const s = htmlWorkshopSession; if (s && s.active) void flushHtmlSave(false, s.noteId); });
    $on("htmlSave", "click", () => { const s = htmlWorkshopSession; if (s && s.active) void flushHtmlSave(false, s.noteId); });
    $on("htmlMore", "click", () => openNoteSheet(st.curNoteId));
    $on("htmlCopy", "click", () => clipboardCopy($("htmlSource").value).then((ok) => toast(ok ? "원본 코드를 복사했어요" : "복사하지 못했어요")));
    $on("htmlExport", "click", () => showHtmlExportDialog(st.curNoteId));
    $on("htmlReload", "click", () => { refreshHtmlPreview($("htmlSource").value); toast("미리보기를 새로고침했어요"); });
    $on("htmlOpenPage", "click", openHtmlPreviewPage);
    $on("htmlModeSource", "click", () => setHtmlView("source"));
    $on("htmlModePreview", "click", () => setHtmlView("preview"));
    $on("htmlModeSplit", "click", () => setHtmlView("split"));

    // regex workshop
    ["regexScriptName", "regexFind", "regexReplace", "regexTrimStrings", "regexMinDepth", "regexMaxDepth"].forEach((id) => {
      $on(id, "input", scheduleRegexSave);
      $on(id, "blur", () => { const s = regexWorkshopSession; if (s && s.active) void flushRegexSave(false, s.noteId); });
    });
    $on("regexSample", "input", () => { updateRegexSampleHighlight(); scheduleRegexSave(); });
    $on("regexSample", "scroll", syncRegexSampleHighlight, { passive: true });
    $on("regexSample", "blur", () => { const s = regexWorkshopSession; if (s && s.active) void flushRegexSave(false, s.noteId); });
    ["regexMarkdownOnly", "regexPromptOnly", "regexRunOnEdit", "regexDisabled", "regexSubstituteRegex"].forEach((id) => {
      $on(id, "change", scheduleRegexSave);
    });
    document.querySelectorAll("[data-regex-placement]").forEach((input) => input.addEventListener("change", scheduleRegexSave));
    $on("regexGlobal", "change", () => { $("regexFind").value = regexSetGlobalInFind($("regexFind").value, $("regexGlobal").checked); scheduleRegexSave(); });
    $on("regexSave", "click", () => { const s = regexWorkshopSession; if (s && s.active) void flushRegexSave(false, s.noteId); });
    $on("regexMore", "click", () => openNoteSheet(st.curNoteId));
    $on("regexCopyIn", "click", () => clipboardCopy($("regexFind").value).then((ok) => toast(ok ? "IN 정규식을 복사했어요" : "복사하지 못했어요")));
    $on("regexCopyOut", "click", () => clipboardCopy($("regexReplace").value).then((ok) => toast(ok ? "OUT을 복사했어요" : "복사하지 못했어요")));
    $on("regexExport", "click", () => void exportRegexJson(st.curNoteId));
    $on("regexReload", "click", () => { refreshRegexPreview(); toast("미리보기를 새로고침했어요"); });
    $on("regexFromSample", "click", applyRegexFromSample);
    $on("regexAutoSample", "click", applyRegexAutoSample);
    $on("regexModeEdit", "click", () => setRegexView("edit"));
    $on("regexModePreview", "click", () => setRegexView("preview"));
    $on("regexModeSplit", "click", () => setRegexView("split"));



    // idea board
    $on("ideaBack", "click", () => { void back(); });
    $on("ideaAdd", "click", () => { if (!isIdeaReadonly()) openIdeaAddMenu(null, false); });
    $on("ideaMore", "click", () => { const n=getNote(st.curNoteId); if(n&&n.type==="idea") openIdeaBoardSheet(n); });
    $on("ideaSave", "click", async () => { await flushIdeaBoard(); toast("저장했어요"); });
    $on("ideaViewToggle", "click", () => setIdeaView(ideaViewMode === "view" ? "board" : "view"));
    $on("ideaScreenshot", "click", () => { const n=currentIdeaNote(); if(n) void exportIdeaViewportPng(n.id); });
    $on("ideaUndo", "click", ideaUndo);
    $on("ideaRedo", "click", ideaRedo);
    $on("ideaZoomIn", "click", () => setIdeaZoom(ideaZoom + 0.2));
    $on("ideaZoomOut", "click", () => setIdeaZoom(ideaZoom - 0.2));
    $on("ideaZoomFit", "click", ideaZoomFit);
    $on("ideaZoomRange", "input", (e) => setIdeaZoom(Number(e.target.value) / 100));
    const applyIdeaZoomInput=()=>{ const input=$("ideaZoomInput"); if(!input)return; const raw=Number(String(input.value||"").replace(/%/g,"").trim()); const fallback=Math.round(ideaZoom*100); const min=Math.round(ideaMinAllowedZoom()*100), max=Math.round(IDEA_ZOOM_MAX*100); const pct=Number.isFinite(raw)?Math.max(min,Math.min(max,raw)):fallback; setIdeaZoom(pct/100); input.value=String(Math.round(ideaZoom*100)); };
    $on("ideaZoomInput","change",applyIdeaZoomInput);
    $on("ideaZoomInput","blur",applyIdeaZoomInput);
    $on("ideaZoomInput","keydown",(e)=>{if(e.key==="Enter"){e.preventDefault();applyIdeaZoomInput();e.currentTarget.blur();}});
    $on("ideaSnapToggle", "click", () => { if (isIdeaReadonly()) return; const d=currentIdeaData(); ideaSnapOn = !ideaSnapOn; if(d)d.canvas.snapOn=ideaSnapOn; updateIdeaSnapButton(); if (!ideaSnapOn) clearIdeaSnapGuides(); scheduleIdeaSave(0); toast(ideaSnapOn ? "스냅 ON" : "스냅 OFF"); });
    $on("ideaMultiToggle", "click", () => setIdeaMultiSelectMode(!ideaMultiSelectMode));
    (() => {
      const stage = $("ideaStageWrap"); if (!stage) return;
      stage.addEventListener("pointerdown", (e) => { if (e.pointerType !== "touch") return; ideaPointers.set(e.pointerId, { x:e.clientX, y:e.clientY }); if (ideaPointers.size === 2) { const p = [...ideaPointers.values()]; ideaPinch = { dist:Math.hypot(p[0].x-p[1].x, p[0].y-p[1].y) || 1, zoom:ideaZoom }; } }, { passive:true });
      stage.addEventListener("pointermove", (e) => { if (e.pointerType !== "touch" || !ideaPointers.has(e.pointerId)) return; ideaPointers.set(e.pointerId, { x:e.clientX, y:e.clientY }); if (ideaPinch && ideaPointers.size >= 2) { const p = [...ideaPointers.values()]; const dist = Math.hypot(p[0].x-p[1].x, p[0].y-p[1].y); const mx = (p[0].x+p[1].x)/2, my = (p[0].y+p[1].y)/2; setIdeaZoom(ideaPinch.zoom * dist / ideaPinch.dist, mx, my, false); e.preventDefault(); } }, { passive:false });
      const endP = (e) => { if (ideaPointers.has(e.pointerId)) ideaPointers.delete(e.pointerId); if (ideaPointers.size < 2) { if (ideaPinch) { const d = currentIdeaData(); if (d) { d.canvas.zoom = ideaZoom; scheduleIdeaSave(700); } } ideaPinch = null; } };
      stage.addEventListener("pointerup", endP); stage.addEventListener("pointercancel", endP);
    })();
    const refreshIdeaViewportFit = () => {
      if (!$("screen-idea").classList.contains("active") || ideaViewMode === "list") return;
      const d = currentIdeaData(); if (!d) return;
      if (d.canvas.fitMode) {
        ideaZoom = ideaLongAxisFitZoom();
        d.canvas.zoom = ideaZoom;
        applyIdeaZoom();
        const wrap = $("ideaStageWrap"); if (wrap) { wrap.scrollLeft = 0; wrap.scrollTop = 0; }
        scheduleIdeaSave(700);
        return;
      }
      const before = ideaZoom; ideaZoom = ideaClampZoom(ideaZoom);
      applyIdeaZoom();
      if (Math.abs(before - ideaZoom) >= .001) { d.canvas.zoom = ideaZoom; scheduleIdeaSave(700); }
    };
    window.addEventListener("resize", refreshIdeaViewportFit);
    if (window.visualViewport) window.visualViewport.addEventListener("resize", refreshIdeaViewportFit, { passive:true });
    document.addEventListener("keydown", (e) => {
      if (!$("screen-idea").classList.contains("active")) return;
      const t = (e.target.tagName || "").toLowerCase(), typing = t === "textarea" || t === "input" || e.target.isContentEditable;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "a") {
        const noteText = e.target.closest && e.target.closest(".idea-note-text");
        const activeItem = e.target.closest && e.target.closest(".idea-item");
        const item = activeItem && getIdeaItem(activeItem.dataset.itemId);
        if (noteText || (item && item.kind === "note" && ideaIsLocked(item))) {
          if (item && item.kind === "note" && ideaIsLocked(item) && activeItem) {
            const editor = activeItem.querySelector(".idea-note-text");
            if (editor) {
              e.preventDefault();
              const range = document.createRange();
              range.selectNodeContents(editor);
              const sel = window.getSelection();
              if (sel) { sel.removeAllRanges(); sel.addRange(range); }
            }
          }
          return;
        }
      }
      if (isIdeaReadonly()) return;
      if (mod && e.key.toLowerCase() === "z" && !typing) { e.preventDefault(); e.shiftKey ? ideaRedo() : ideaUndo(); return; }
      if (mod && e.key.toLowerCase() === "y" && !typing) { e.preventDefault(); ideaRedo(); return; }
      if (ideaViewMode !== "board") return;
      const el = document.activeElement;
      if (!el || !el.classList || !el.classList.contains("idea-item")) return;
      const id = el.dataset.itemId, item = getIdeaItem(id), d = currentIdeaData(); if (!item || !d) return;
      if (mod && e.key.toLowerCase() === "d") { e.preventDefault(); duplicateIdeaItem(id); return; }
      if (e.key === "]") { e.preventDefault(); reorderIdeaItem(id, true); return; }
      if (e.key === "[") { e.preventDefault(); reorderIdeaItem(id, false); return; }
      if (e.key === "ArrowLeft" || e.key === "ArrowRight" || e.key === "ArrowUp" || e.key === "ArrowDown") {
        e.preventDefault(); const step = e.shiftKey ? 40 : 8;
        if (!ideaKeyMoveActive) { pushIdeaUndo(); ideaKeyMoveActive = true; }
        clearTimeout(ideaKeyMoveTimer); ideaKeyMoveTimer = setTimeout(() => { ideaKeyMoveActive = false; }, 650);
        item.x = Math.round(Math.max(0, Math.min(d.canvas.width - item.w, item.x + (e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0))));
        item.y = Math.round(Math.max(0, Math.min(d.canvas.height - item.h, item.y + (e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0))));
        setIdeaItemGeometry(el, item); positionIdeaTransformControls(el, item); scheduleIdeaSave(300); return;
      }
      if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); removeIdeaItem(id); toast("조각을 지웠어요 · Ctrl+Z로 되돌리기"); requestAnimationFrame(() => { const first = $("ideaCanvas").querySelector(".idea-item"); if (first && first.focus) first.focus(); }); return; }
      if (e.key === "Enter") { e.preventDefault(); if (item.kind === "note") { const editor = el.querySelector(".idea-note-text"); if (editor) editor.focus(); } else { openIdeaItemOptions(id); } return; }
      if (e.key === " ") { e.preventDefault(); openIdeaItemOptions(id); return; }
      if (e.key === "Escape") { e.preventDefault(); clearIdeaSelection(); el.blur(); return; }
    });
    $on("ideaBoardMode", "click", () => setIdeaView("board"));
    $on("ideaListMode", "click", () => setIdeaView("list"));
    $on("ideaMediaInput", "change", (e) => { const f=e.target.files&&e.target.files[0],kind=e.target.dataset.ideaKind||"image",replaceId=e.target.dataset.ideaReplaceId||""; e.target.value="";delete e.target.dataset.ideaKind;delete e.target.dataset.ideaReplaceId;if(f){if(replaceId)void replaceIdeaMediaFile(replaceId,f,kind);else void addIdeaMediaFile(f,kind);} });
    $on("ideaFileInput", "change", (e) => { const f=e.target.files&&e.target.files[0],replaceId=e.target.dataset.ideaReplaceId||"";e.target.value="";delete e.target.dataset.ideaReplaceId;if(f){if(replaceId)void replaceIdeaMediaFile(replaceId,f,"file");else void addIdeaMediaFile(f,"file");} });
    $on("ideaCanvasBgInput", "change", (e) => { const f=e.target.files&&e.target.files[0]; e.target.value=""; if(f) void addIdeaCanvasBackgroundImage(f); });
    bindIdeaCanvasLongPress();

    // editor
    $on("editor", "input", scheduleSave);
    $on("editor", "blur", () => { const s = freeEditorSession; if (s && s.active) void flushSave(false, s.noteId); });
    $on("codeArea", "input", scheduleSave);
    $on("codeArea", "blur", () => { const s = freeEditorSession; if (s && s.active) void flushSave(false, s.noteId); });
    $on("attachInput", "change", (e) => { const f = e.target.files && e.target.files[0]; if (f) addAttachment(f); e.target.value = ""; });
    $on("imgInput", "change", (e) => { const f = e.target.files && e.target.files[0]; if (f) void insertImage(f); e.target.value = ""; });
    $on("freeVideoInput", "change", (e) => { const f = e.target.files && e.target.files[0]; if (f) void insertFreeMemoVideo(f); e.target.value = ""; });
    $on("editor", "paste", onEditorPaste);
    $on("editor", "keydown", (e) => { if (e.key === " " || e.key === "Enter") setTimeout(linkifyBeforeCaret, 0); });
    const fb = $("formatbar");
    const fbHandler = (e) => {
      const b = e.target.closest(".fbtn"); if (!b) return;
      const id = b.id;
      if (id === "hiliteBtn") return;
      e.preventDefault();
      if (id === "formatbarToggle") { toggleFormatbarFold(); return; }
      if (b.dataset.cmd) exec(b.dataset.cmd, b.dataset.val);
      else if (id === "fsDown") fontStep(-1);
      else if (id === "fsUp") fontStep(1);
      else if (id === "fsList") showFontSizes();
      else if (id === "imgBtn") freeMemoMediaPicker();
      else if (id === "alignBtn") showAlignMenu();
      else if (id === "codeBlockBtn") wrapCodeBlock();
      else if (id === "linkBtn") insertLinkPrompt();
      else if (id === "eraseBtn") eraseFormatting();
      else if (id === "codeToggle") setCodeMode(!st.codeMode);
      else if (id === "attachBtn") $("attachInput").click();
      else if (id === "freeInsertBtn") openFreeInsertMenu();
      else if (id === "colorBtn") openColorEditor();
    };
    fb.addEventListener("mousedown", fbHandler);
    fb.addEventListener("touchstart", fbHandler, { passive: false });
    bindHiliteButton();
    bindEditorImageResize();

    // lorebook
    $on("loreEdit", "input", scheduleLoreSave);
    $on("loreDepthSwitch", "click", () => { const n = getNote(st.curNoteId); if (!n || n.type !== "lorebook") return; const d = ensureLoreData(n); d.st.position = d.st.position === 4 ? 0 : 4; d.st.role = d.st.position === 4 ? d.st.role : null; applyLoreStToLegacy(d); $("loreDepthSwitch").classList.toggle("on", d.depthOn); $("loreDepthWrap").classList.toggle("on", d.depthOn); saveLore(n, true); });
    $on("loreDepth", "change", (e) => { const n = getNote(st.curNoteId); if (!n || n.type !== "lorebook") return; const d = ensureLoreData(n); let v = parseInt(e.target.value, 10); if (isNaN(v) || v < 0) v = 0; if (v > 999) v = 999; e.target.value = v; d.st.depth = v; applyLoreStToLegacy(d); saveLore(n, true); });
    $on("loreEdit", "blur", () => flushLore());
    $on("loreKwInput", "keydown", (e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addKeywordFromInput(); } });
    $on("loreKwInput", "blur", addKeywordFromInput);
    $on("loreSecondaryKwInput", "keydown", (e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addSecondaryKeywordFromInput(); } });
    $on("loreSecondaryKwInput", "blur", addSecondaryKeywordFromInput);
    $on("loreActiveWrap", "click", toggleLoreActive);
    $on("loreSettingsBtn", "click", openLoreSettingsModal);
    $on("lorePreviewBtn", "click", toggleLorePreview);
    $on("loreMore", "click", () => openNoteSheet(st.curNoteId));

    // styled log
    $on("logEdit", "input", scheduleLogSave);
    $on("logEdit", "blur", () => flushLog());
    // 이름 바꾸기 세트는 각 버튼의 팝업에서 즉시 저장합니다.
    $on("logTemplateBtn", "click", showLogTemplatePicker);
    $on("logViewToggle", "click", toggleLogView);
    $on("logPreview", "dblclick", (event) => {
      event.preventDefault();
      void enterLogEditFromPreview();
    });
    $on("logPreview", "touchend", (event) => {
      if (logEditMode) return;
      const stamp = Date.now();
      if (stamp - logPreviewLastTapAt <= 340) {
        event.preventDefault();
        logPreviewLastTapAt = 0;
        void enterLogEditFromPreview();
      } else {
        logPreviewLastTapAt = stamp;
      }
    }, { passive:false });
    $on("logMore", "click", () => openNoteSheet(st.curNoteId));
    $on("logTemplateInput", "change", (e) => { const file = e.target.files && e.target.files[0]; e.target.value = ""; if (file) importLogTemplateFile(file); });

    // persona
    ["perKoName", "perKoDetail", "perEnName", "perEnDetail"].forEach((id) => {
      $(id).addEventListener("input", schedulePerSave);
      $(id).addEventListener("blur", () => flushPersona());
    });
    $on("perKoTagInput", "keydown", (e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addPerTag("ko"); } });
    $on("perKoTagInput", "blur", () => addPerTag("ko"));
    $on("perEnTagInput", "keydown", (e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addPerTag("en"); } });
    $on("perEnTagInput", "blur", () => addPerTag("en"));
    document.querySelectorAll("#screen-persona .per-tab").forEach((t) => t.addEventListener("click", () => setPerLang(t.dataset.lang)));
    $on("perPortrait", "click", (e) => { if (e.target.closest(".per-del")) return; perImgTarget = "portrait"; $("perImgInput").click(); });
    $on("perSquare", "click", (e) => { if (e.target.closest(".per-del")) return; perImgTarget = "square"; $("perImgInput").click(); });
    $on("perImgInput", "change", (e) => { const files = e.target.files ? [...e.target.files] : []; if (files.length) { if (perImgTarget === "gallery") addGalleryFiles(files); else applyPerImage(files[0]); } e.target.value = ""; });
    $on("perViewToggle", "click", togglePerView);
    $on("perMore", "click", () => openNoteSheet(st.curNoteId));

    // character memo
    ["charKoName", "charKoDetail", "charEnName", "charEnDetail"].forEach((id) => {
      $(id).addEventListener("input", scheduleCharSave);
      $(id).addEventListener("blur", () => flushCharacter());
    });
    $on("charCreatorEditor", "input", scheduleCreatorSave);
    $on("charCreatorCode", "input", scheduleCreatorSave);
    $on("charCreatorEditor", "blur", () => flushCharacter());
    $on("charCreatorCode", "blur", () => flushCharacter());
    $on("charCreatorEditor", "paste", onCreatorPaste);
    $on("charCreatorEditor", "keydown", (e) => { if (e.key === " " || e.key === "Enter") setTimeout(creatorLinkifyBeforeCaret, 0); });
    $on("charKoTagInput", "keydown", (e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addCharTag("ko"); } });
    $on("charKoTagInput", "blur", () => addCharTag("ko"));
    $on("charEnTagInput", "keydown", (e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addCharTag("en"); } });
    $on("charEnTagInput", "blur", () => addCharTag("en"));
    document.querySelectorAll("#screen-character [data-char-lang]").forEach((tab) => tab.addEventListener("click", () => setCharLang(tab.dataset.charLang)));
    $on("charPortrait", "click", (e) => { if (e.target.closest(".per-del")) return; charImgTarget = "portrait"; $("charImgInput").click(); });
    $on("charSquare", "click", (e) => { if (e.target.closest(".per-del")) return; charImgTarget = "square"; $("charImgInput").click(); });
    $on("charImgInput", "change", async (e) => { const files = e.target.files ? [...e.target.files] : []; e.target.value = ""; if (!files.length) return; if (charImgTarget === "gallery") await addCharGalleryFiles(files); else applyCharImage(files[0]); });
    $on("charCoverInput", "change", (e) => {
      const input = e.currentTarget, file = input.files && input.files[0], noteId = input.dataset.noteId;
      input.value = ""; delete input.dataset.noteId;
      if (file && noteId) applyUploadedCharacterCover(noteId, file);
    });
    $on("charCreatorImgInput", "change", (e) => { const file = e.target.files && e.target.files[0]; e.target.value = ""; if (file) insertCreatorImage(file); });
    $on("charCreatorOpen", "click", openCreatorMemoModal);
    $on("charCreatorCodeToggle", "click", () => setCreatorCodeMode(!creatorCodeMode));
    const creatorToolbar = $("charCreatorToolbar");
    const creatorToolbarHandler = (e) => {
      const btn = e.target.closest(".fbtn"); if (!btn) return;
      const id = btn.id; if (id === "charCreatorHiliteBtn") return;
      e.preventDefault();
      if (btn.dataset.creatorCmd) creatorExec(btn.dataset.creatorCmd, btn.dataset.val);
      else if (id === "charCreatorFsDown") creatorFontStep(-1);
      else if (id === "charCreatorFsUp") creatorFontStep(1);
      else if (id === "charCreatorFsList") openCreatorFontSizes();
      else if (id === "charCreatorColorBtn") openCreatorColorEditor();
      else if (id === "charCreatorAlignBtn") showCreatorAlignMenu();
      else if (id === "charCreatorImgBtn") $("charCreatorImgInput").click();
      else if (id === "charCreatorLinkBtn") insertCreatorLink();
      else if (id === "charCreatorCodeBlockBtn") wrapCreatorCodeBlock();
      else if (id === "charCreatorEraseBtn") eraseCreatorFormatting();
    };
    creatorToolbar.addEventListener("mousedown", creatorToolbarHandler);
    creatorToolbar.addEventListener("touchstart", creatorToolbarHandler, { passive: false });
    bindCreatorHiliteButton();
    $on("charViewToggle", "click", toggleCharView);
    $on("charMore", "click", () => openNoteSheet(st.curNoteId));
    $on("charSave", "click", async () => { await flushCharacter(); toast("저장했어요"); });
    $on("charAddPage", "click", addCharacterPage);
    $on("charRAddPage", "click", addCharacterPage);
    $on("charPrev", "click", () => stepCharacter(-1));
    $on("charNext", "click", () => stepCharacter(1));
    let charSwipe = null;
    $on("charScroll", "touchstart", (e) => {
      if (st.charEdit || e.target.closest("textarea,input,button,.char-nav")) { charSwipe = null; return; }
      const t = e.touches && e.touches[0]; if (t) charSwipe = { x: t.clientX, y: t.clientY };
    }, { passive: true });
    $on("charScroll", "touchend", (e) => {
      if (!charSwipe) return; const t = e.changedTouches && e.changedTouches[0], start = charSwipe; charSwipe = null; if (!t) return;
      const dx = t.clientX - start.x, dy = t.clientY - start.y;
      if (Math.abs(dx) >= 58 && Math.abs(dx) > Math.abs(dy) * 1.35) stepCharacter(dx > 0 ? -1 : 1);
    }, { passive: true });
    $on("charScroll", "touchcancel", () => { charSwipe = null; }, { passive: true });
    // lightbox
    $on("lbClose", "click", closeLightbox);
    $on("lbPrev", "click", () => stepLightbox(-1));
    $on("lbNext", "click", () => stepLightbox(1));
    $on("lightbox", "click", (e) => { if (e.target.id === "lightbox") closeLightbox(); });
    let lightboxSwipe = null;
    $on("lightbox", "touchstart", (e) => {
      if ($("lightbox").hidden || e.target.closest("button")) return;
      const t = e.touches && e.touches[0]; if (t) lightboxSwipe = { x: t.clientX, y: t.clientY };
    }, { passive: true });
    $on("lightbox", "touchend", (e) => {
      if (!lightboxSwipe) return;
      const t = e.changedTouches && e.changedTouches[0], start = lightboxSwipe; lightboxSwipe = null;
      if (!t) return;
      const dx = t.clientX - start.x, dy = t.clientY - start.y;
      if (Math.abs(dx) >= 56 && Math.abs(dx) > Math.abs(dy) * 1.35) stepLightbox(dx > 0 ? -1 : 1);
    }, { passive: true });
    $on("lightbox", "touchcancel", () => { lightboxSwipe = null; }, { passive: true });
    document.addEventListener("keydown", (e) => {
      if ($("lightbox").hidden) return;
      if (e.key === "Escape") { e.preventDefault(); closeLightbox(); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); stepLightbox(-1); }
      else if (e.key === "ArrowRight") { e.preventDefault(); stepLightbox(1); }
    });
    // cropper
    $on("cropCancel", "click", closeCropper);
    $on("cropOk", "click", commitCrop);
    $on("cropZoom", "input", (e) => setCropZoom(e.target.value));
    (function () {
      const stage = $("cropStage"); let dragging = false, lx = 0, ly = 0;
      stage.addEventListener("pointerdown", (e) => { if (!cropState) return; dragging = true; lx = e.clientX; ly = e.clientY; try { stage.setPointerCapture(e.pointerId); } catch (x) {} });
      stage.addEventListener("pointermove", (e) => { if (!dragging || !cropState) return; cropState.tx += e.clientX - lx; cropState.ty += e.clientY - ly; lx = e.clientX; ly = e.clientY; clampCrop(); applyCropTransform(); });
      stage.addEventListener("pointerup", () => { dragging = false; });
      stage.addEventListener("pointercancel", () => { dragging = false; });
    })();

    window.addEventListener("beforeunload", () => { flushSave(true); flushLore(); flushLog(); flushPersona(); flushCharacter(); flushIdeaBoard(true); });
    document.addEventListener("visibilitychange", () => { if (document.hidden) { flushSave(true); flushLore(); flushLog(); flushPersona(); flushCharacter(); flushIdeaBoard(true); } });
  }



  /* ---------- idea board ---------- */
  const IDEA_MAX_VIDEO = 30 * 1024 * 1024;
  const IDEA_MAX_MEDIA = 30 * 1024 * 1024;
  // 아이디어 보드는 앱의 20종 컬러 테마를 조각·오버레이에 공용으로 사용합니다.
  // 이 표는 ACCENTS 선언보다 먼저 실행되는 보드 정규화에도 안전하도록 독립 보관합니다.
  const IDEA_THEME_COLORS = Object.freeze({
    blue:{name:"블루",grad:"linear-gradient(135deg, #7b9bff, #b58bff)",ig:["#7b9bff","#b58bff"]},
    pink:{name:"핑크",grad:"linear-gradient(135deg, #ff93cb, #c98bff)",ig:["#ff93cb","#c98bff"]},
    green:{name:"그린",grad:"linear-gradient(135deg, #45e3a6, #4fd6c4)",ig:["#45e3a6","#4fd6c4"]},
    purple:{name:"퍼플",grad:"linear-gradient(135deg, #a880ff, #7c8bff)",ig:["#a880ff","#7c8bff"]},
    gold:{name:"골드",grad:"linear-gradient(135deg, #ffd86b, #e0a23c)",ig:["#ffd86b","#e0a23c"]},
    pblue:{name:"파스텔 블루",grad:"linear-gradient(135deg, #8fb6ec, #9ba6e6)",ig:["#8fb6ec","#9ba6e6"]},
    ppink:{name:"파스텔 핑크",grad:"linear-gradient(135deg, #efa6cc, #d3a6e8)",ig:["#efa6cc","#d3a6e8"]},
    polive:{name:"파스텔 올리브",grad:"linear-gradient(135deg, #a8b85e, #93b06e)",ig:["#a8b85e","#93b06e"]},
    ppurple:{name:"파스텔 퍼플",grad:"linear-gradient(135deg, #c5aef0, #b3b0ee)",ig:["#c5aef0","#b3b0ee"]},
    pgold:{name:"파스텔 골드",grad:"linear-gradient(135deg, #e8d49a, #d8c182)",ig:["#e8d49a","#d8c182"]},
    navy:{name:"네이비",grad:"linear-gradient(135deg, #5b8def, #6f7fe0)",ig:["#5b8def","#6f7fe0"]},
    burgundy:{name:"버건디",grad:"linear-gradient(135deg, #e0607e, #d05068)",ig:["#e0607e","#d05068"]},
    dgreen:{name:"딥그린",grad:"linear-gradient(135deg, #3fc78a, #3aa890)",ig:["#3fc78a","#3aa890"]},
    dviolet:{name:"딥바이올렛",grad:"linear-gradient(135deg, #a06ef0, #8a5fe0)",ig:["#a06ef0","#8a5fe0"]},
    lgold:{name:"럭셔리골드",grad:"linear-gradient(135deg, #f0c64a, #d9a832)",ig:["#f0c64a","#d9a832"]},
    mono:{name:"무채색",grad:"linear-gradient(135deg, #c8c8d0, #a8a8b0)",ig:["#c8c8d0","#a8a8b0"]},
    brown:{name:"브라운",grad:"linear-gradient(135deg, #d2a878, #c0905e)",ig:["#d2a878","#c0905e"]},
    silver:{name:"메탈릭 실버",grad:"linear-gradient(135deg, #bcc8d4, #9fb0c0)",ig:["#bcc8d4","#9fb0c0"]},
    mgold:{name:"메탈릭 골드",grad:"linear-gradient(135deg, #e8cc5e, #ccae3e)",ig:["#e8cc5e","#ccae3e"]},
    bw:{name:"블랙&화이트",grad:"linear-gradient(135deg, #f5f5f7 0%, #f5f5f7 50%, #35353b 50%, #35353b 100%)",ig:["#d4d4da","#888892"]}
  });
  // v63.4 이전 보드의 메모지 색상은 시각을 바꾸지 않고 계속 읽습니다.
  const IDEA_LEGACY_COLORS = Object.freeze({
    yellow:{name:"레몬 옐로",grad:"linear-gradient(135deg,#fff5a2,#ffd94d)",ig:["#fff5a2","#ffd94d"]},
    lime:{name:"라임 그린",grad:"linear-gradient(135deg,#e2ffa8,#9de66b)",ig:["#e2ffa8","#9de66b"]}
  });
  // 테마 외에 자주 쓰는 재질색. 캔버스 오버레이와 조각 컬러에서 공통으로 씁니다.
  const IDEA_SAMPLE_COLORS = Object.freeze({
    cream:{name:"크림",grad:"linear-gradient(135deg,#fff3d8,#e8c98d)",ig:["#fff3d8","#e8c98d"]},
    ink:{name:"먹색",grad:"linear-gradient(135deg,#303846,#111721)",ig:["#303846","#111721"]}
  });
  const IDEA_ALL_COLORS = Object.freeze({ ...IDEA_THEME_COLORS, ...IDEA_LEGACY_COLORS, ...IDEA_SAMPLE_COLORS });
  const IDEA_PLAIN_BACKGROUND_TEMPLATES = Object.fromEntries(Object.entries(IDEA_THEME_COLORS).map(([key, meta]) => [`plain-${key}`, { label:`${meta.name} 빈 캔버스`, desc:"질감 없이 컬러만 남긴 깨끗한 기본 바탕" }]));
  const IDEA_LIGHT_BACKGROUND_TEMPLATES = Object.fromEntries(Object.entries(IDEA_THEME_COLORS).map(([key, meta]) => [`plain-light-${key}`, { label:`${meta.name} 라이트 캔버스`, desc:"같은 계열을 더 밝게 풀어낸 부드러운 컬러 바탕" }]));
  const IDEA_BUILTIN_BG_TEMPLATES = {
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
    ...IDEA_PLAIN_BACKGROUND_TEMPLATES,
    ...IDEA_LIGHT_BACKGROUND_TEMPLATES
  };
  const IDEA_BUILTIN_NOTE_TEMPLATES = {
    marker: { label: "형광 마커", desc: "형광 잉크가 번진 듯한 러프 메모" },
    tape: { label: "테이프 노트", desc: "상단 테이프로 붙인 종이 조각" },
    receipt: { label: "영수증", desc: "절취선과 바코드가 찍힌 감열지 메모" },
    polaroid: { label: "폴라로이드", desc: "넓은 하단 여백의 즉석사진 카드" },
    label: { label: "라벨 스티커", desc: "두 겹 테두리의 깔끔한 라벨 카드" },
    ledger: { label: "연구 노트", desc: "좌측 여백선과 서명란의 줄노트" },
    paperclip: { label: "클립 메모", desc: "좌상단 금속 클립을 끼운 종이" },
    waxSeal: { label: "봉랍 편지", desc: "데클 가장자리와 봉랍 씰의 양피지" },
    neonGlass: { label: "네온 글래스", desc: "어두운 보드용 네온 테두리 글래스 카드" },
    speechBubble: { label: "말풍선", desc: "꼬리가 달린 대화형 부착 메모" }
  };
  // 새 템플릿은 idea-board-templates.js에만 등록하면 됩니다. 외부 파일이
  // 누락돼도 내장 카탈로그가 남아 있어 기존 보드 데이터는 안전하게 보존됩니다.
  function readIdeaTemplateRegistry(raw) {
    const out = {};
    if (!raw || typeof raw !== "object") return out;
    Object.entries(raw).forEach(([key, value]) => {
      if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,47}$/.test(key) || !value || typeof value !== "object") return;
      const label = typeof value.label === "string" ? value.label.trim().slice(0, 42) : "";
      const desc = typeof value.desc === "string" ? value.desc.trim().slice(0, 96) : "";
      if (label) out[key] = { label, desc };
    });
    return out;
  }
  const IDEA_TEMPLATE_REGISTRY = (typeof window !== "undefined" && window.LumiInkIdeaTemplates && typeof window.LumiInkIdeaTemplates === "object") ? window.LumiInkIdeaTemplates : {};
  function readIdeaImageBackgroundRegistry(raw) {
    const out = {};
    if (!raw || typeof raw !== "object") return out;
    Object.entries(raw).forEach(([key, value]) => {
      if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,47}$/.test(key) || !value || typeof value !== "object") return;
      const label = typeof value.label === "string" ? value.label.trim().slice(0, 42) : "";
      const desc = typeof value.desc === "string" ? value.desc.trim().slice(0, 96) : "";
      const src = typeof value.src === "string" ? value.src.trim() : "";
      if (!label || !/^\.\/idea-board-backgrounds\/[A-Za-z0-9._-]+\.png$/i.test(src)) return;
      out[key] = { label, desc, src };
    });
    return out;
  }
  const IDEA_IMAGE_BACKGROUND_PRESETS = Object.freeze(readIdeaImageBackgroundRegistry(IDEA_TEMPLATE_REGISTRY.imageBackgrounds));
  if (typeof console !== "undefined" && IDEA_TEMPLATE_REGISTRY.imageBackgrounds && !Object.keys(IDEA_IMAGE_BACKGROUND_PRESETS).length) {
    console.warn("[Lumi Ink] 이미지 배경 레지스트리를 읽지 못했습니다. 키/경로 형식을 확인하세요.");
  }
  const IDEA_BG_TEMPLATES = Object.freeze({ ...IDEA_BUILTIN_BG_TEMPLATES, ...readIdeaTemplateRegistry(IDEA_TEMPLATE_REGISTRY.backgrounds) });
  const IDEA_NOTE_TEMPLATES = Object.freeze({ ...IDEA_BUILTIN_NOTE_TEMPLATES, ...readIdeaTemplateRegistry(IDEA_TEMPLATE_REGISTRY.noteStyles || IDEA_TEMPLATE_REGISTRY.notes) });
  const IDEA_NOTE_COLORS = IDEA_THEME_COLORS;
  const IDEA_NOTE_TEXT_PRESETS = Object.freeze({
    auto: { name: "자동", value: "" },
    ink: { name: "진한 먹색", value: "#27303a" },
    cream: { name: "밝은 크림", value: "#fffaf4" },
    white: { name: "화이트", value: "#ffffff" }
  });
  function ideaPreferredColor() { return IDEA_THEME_COLORS[st && st.accent] ? st.accent : "blue"; }
  function isIdeaColorKey(key) { return typeof key === "string" && Object.prototype.hasOwnProperty.call(IDEA_ALL_COLORS, key); }
  function isIdeaHexColor(value) { return !!normHex(value); }
  function isIdeaColorValue(value) { return isIdeaColorKey(value) || isIdeaHexColor(value); }
  function normalizeIdeaColorValue(value, fallback) { return isIdeaColorKey(value) ? value : (normHex(value) || fallback || ideaPreferredColor()); }
  function isIdeaNoteTextColorKey(key) { return key === "auto" || Object.prototype.hasOwnProperty.call(IDEA_NOTE_TEXT_PRESETS, key) || isIdeaColorKey(key) || isIdeaHexColor(key); }
  function normalizeIdeaTextColorValue(value) { return isIdeaNoteTextColorKey(value) ? (isIdeaHexColor(value) ? normHex(value) : value) : "auto"; }
  function ideaColorMeta(key) {
    if (isIdeaColorKey(key)) return IDEA_ALL_COLORS[key];
    const custom=normHex(key);
    if (custom) {
      const a = mixHex(custom, "#ffffff", .18);
      const b = mixHex(custom, "#ffffff", .04);
      return { name:custom, grad:`linear-gradient(135deg,${a},${b})`, ig:[a,b] };
    }
    return IDEA_THEME_COLORS.blue;
  }
  function hexRgb(hex) { const value=String(hex||"").replace("#",""); if(!/^[0-9a-fA-F]{6}$/.test(value)) return [106,208,255]; return [parseInt(value.slice(0,2),16),parseInt(value.slice(2,4),16),parseInt(value.slice(4,6),16)]; }
  function mixHex(a,b,weight) { const aa=hexRgb(a),bb=hexRgb(b),t=Math.max(0,Math.min(1,Number(weight)||0)); return "#"+aa.map((v,i)=>Math.round(v*(1-t)+bb[i]*t).toString(16).padStart(2,"0")).join(""); }
  function rgbaHex(hex,alpha) { const [r,g,b]=hexRgb(hex); return `rgba(${r},${g},${b},${Math.max(0,Math.min(1,Number(alpha)||0))})`; }
  function ideaTextColorValue(key) {
    const normalized = normalizeIdeaTextColorValue(key);
    if (normalized === "auto") return "";
    if (IDEA_NOTE_TEXT_PRESETS[normalized]) return IDEA_NOTE_TEXT_PRESETS[normalized].value;
    if (normHex(normalized)) return normHex(normalized);
    return mixHex(ideaColorMeta(normalized).ig[1], "#151922", .24);
  }
  function ideaColorVars(key, textColor) {
    const meta=ideaColorMeta(key), a=meta.ig[0], b=meta.ig[1], paper=mixHex(a,"#ffffff",.64), edge=mixHex(b,"#ffffff",.18);
    const customInk = ideaTextColorValue(textColor);
    return {"--idea-color-a":a,"--idea-color-b":b,"--idea-color-grad":meta.grad,"--idea-chip-fill":mixHex(a,"#ffffff",.84),"--idea-chip-edge":edge,"--idea-chip-ink":customInk || "#20242d","--stick-1":paper,"--stick-2":edge,"--stick-ink":customInk || "#27303a"};
  }
  function applyIdeaColor(el,item) { if(!el||!item)return; el.dataset.color=item.color; const vars=ideaColorVars(item.color, item.textColor); Object.entries(vars).forEach(([name,value])=>el.style.setProperty(name,value)); }
  function ideaColorStyleAttr(key, textColor) { return Object.entries(ideaColorVars(key, textColor)).map(([name,value])=>`${name}:${value}`).join(";"); }
  function ideaCustomColorChoiceMarkup(attrName, compact, selected) {
    const active=!!normHex(selected);
    const cls=`idea-color-choice palette idea-custom-color${active?" active":""}`;
    const aria=`aria-label="직접 색상 선택" title="직접 색상 선택"`;
    return `<button type="button" class="${cls}" data-idea-custom-color="${esc(attrName)}" ${aria}><span><i>+</i></span></button>`;
  }
  function ideaColorChoicesMarkup(selected, attrName, compact = false, includeSamples = true) {
    const entries=[...Object.entries(IDEA_THEME_COLORS), ...(includeSamples ? Object.entries(IDEA_SAMPLE_COLORS) : [])];
    const colors=entries.map(([key,meta])=>{
      const cls=`idea-color-choice theme${compact ? " palette" : ""} ${selected===key?"active":""}`;
      const aria=`aria-label="${esc(meta.name)}" title="${esc(meta.name)}"`;
      return compact
        ? `<button type="button" class="${cls}" ${attrName}="${esc(key)}" ${aria}><span style="background:${meta.grad}"></span></button>`
        : `<button type="button" class="${cls}" ${attrName}="${esc(key)}" ${aria}><span style="background:${meta.grad}"></span>${esc(meta.name)}</button>`;
    }).join("");
    return colors + ideaCustomColorChoiceMarkup(attrName, compact, selected);
  }
  function ideaTextColorChoicesMarkup(selected, attrName, compact = false) {
    const normalized = normalizeIdeaTextColorValue(selected);
    const presets = Object.entries(IDEA_NOTE_TEXT_PRESETS).map(([key, meta]) => {
      const swatch = key === "auto" ? "linear-gradient(135deg,#27303a 0 50%,#fffaf4 50% 100%)" : meta.value;
      const cls=`idea-color-choice text text-preset${compact ? " palette" : ""} ${normalized===key?"active":""}`;
      const aria=`aria-label="${esc(meta.name)}" title="${esc(meta.name)}"`;
      return compact
        ? `<button type="button" class="${cls}" ${attrName}="${esc(key)}" ${aria}><span style="background:${esc(swatch)}"></span></button>`
        : `<button type="button" class="${cls}" ${attrName}="${esc(key)}" ${aria}><span style="background:${esc(swatch)}"></span>${esc(meta.name)}</button>`;
    }).join("");
    const themes = ideaColorChoicesMarkup(normalized, attrName, compact, false);
    return presets + themes;
  }
  // Legacy call site compatibility for extension CSS and older embedded scripts.
  function ideaNoteTextColorChoicesMarkup(selected, attrName, compact = false) { return ideaTextColorChoicesMarkup(selected, attrName, compact); }
  function openIdeaCustomColorPicker(title, initial, onApply) {
    openAdvancedColorPicker(title || "직접 색상 선택", initial, onApply, { prefix:"ideaCustom", saved:true, save:true, intro:"정사각형 색상판을 터치해 색을 고르고, HEX·RGB 입력으로 정확한 코드도 맞출 수 있어요." });
  }

  const IDEA_NOTE_RICH_TAGS = new Set(["B","STRONG","I","EM","S","STRIKE","U","BR","DIV","P","SPAN","FONT"]);
  function sanitizeIdeaNoteRichHtml(raw) {
    if (!raw || typeof raw !== "string" || typeof document === "undefined") return "";
    const host=document.createElement("div"); host.innerHTML=String(raw).slice(0,48000);
    const safeColor=(value)=>{const v=String(value||"").trim(); return /^#[0-9a-f]{3,8}$/i.test(v)||/^rgba?\([\d\s.,%]+\)$/i.test(v)||/^hsla?\([\d\s.,%]+\)$/i.test(v)?v:"";};
    const cleanStyle=(node)=>{const style=node.style, out=[]; const color=safeColor(style.color),bg=safeColor(style.backgroundColor),size=String(style.fontSize||"").trim(),align=String(style.textAlign||"").trim(),weight=String(style.fontWeight||"").trim(),italic=String(style.fontStyle||"").trim(),deco=String(style.textDecoration||"").trim(); if(color)out.push(`color:${color}`);if(bg)out.push(`background-color:${bg}`);if(/^(?:[0-9]{1,2}px|xx-small|x-small|small|medium|large|x-large|xx-large)$/i.test(size))out.push(`font-size:${size}`);if(/^(left|right|center|justify)$/i.test(align))out.push(`text-align:${align}`);if(/^(normal|bold|[1-9]00)$/i.test(weight))out.push(`font-weight:${weight}`);if(/^(normal|italic)$/i.test(italic))out.push(`font-style:${italic}`);if(/^(none|underline|line-through|underline line-through|line-through underline)$/i.test(deco))out.push(`text-decoration:${deco}`); node.removeAttribute("style"); if(out.length)node.setAttribute("style",out.join(";"));};
    const walk=(parent)=>{Array.from(parent.childNodes).forEach((node)=>{if(node.nodeType===3)return;if(node.nodeType!==1){node.remove();return;}let tag=node.tagName.toUpperCase();if(!IDEA_NOTE_RICH_TAGS.has(tag)){const frag=document.createDocumentFragment();while(node.firstChild)frag.appendChild(node.firstChild);node.replaceWith(frag);walk(parent);return;}if(tag==="FONT"){const span=document.createElement("span"),color=safeColor(node.getAttribute("color")),size=Number(node.getAttribute("size")); if(color)span.style.color=color; if(size>=1&&size<=7)span.style.fontSize=["xx-small","x-small","small","medium","large","x-large","xx-large"][size-1];while(node.firstChild)span.appendChild(node.firstChild);node.replaceWith(span);node=span;tag="SPAN";}Array.from(node.attributes).forEach((attr)=>{if(attr.name.toLowerCase()!=="style")node.removeAttribute(attr.name);});cleanStyle(node);walk(node);});};
    walk(host); return host.innerHTML.slice(0,24000);
  }
  function ideaNoteHtml(item) { const rich=sanitizeIdeaNoteRichHtml(item&&item.richText); return rich || (item&&item.text ? esc(item.text).replace(/\n/g,"<br>") : ""); }
  function ideaNotePlainText(html) { if(typeof document==="undefined")return String(html||"").replace(/<[^>]*>/g,""); const host=document.createElement("div");host.innerHTML=sanitizeIdeaNoteRichHtml(html);return String(host.innerText||host.textContent||"").replace(/\u00a0/g," ").slice(0,12000); }
  let ideaTimer = null, ideaDirty = false, ideaViewMode = "board", ideaObjectUrls = new Map(), ideaPendingPos = null;
  let ideaActiveBoardId = null, ideaEditState = { itemId: null, mode: null }, ideaGesture = null;
  let ideaUndoStack = [], ideaRedoStack = [], ideaHistoryBoardId = null, ideaRemovedBlobIds = new Set();
  let ideaKeyMoveActive = false, ideaKeyMoveTimer = null;
  const IDEA_HISTORY_MAX = 20;
  const IDEA_KIND_LABEL = { note:"메모지", image:"이미지", audio:"음악", video:"영상", file:"파일", quote:"링크", frame:"프레임", divider:"구분선" };
  const IDEA_DIVIDER_STYLES = Object.freeze({
    solid: { label:"실선", desc:"가장 기본적인 단일 구분선" },
    dashed: { label:"파선", desc:"짧은 선이 반복되는 구분선" },
    dotted: { label:"점선", desc:"동그란 점이 이어지는 구분선" },
    dashDot: { label:"일점쇄선", desc:"선과 점이 번갈아 나오는 구분선" },
    longDash: { label:"긴 파선", desc:"길쭉한 선이 반복되는 구분선" },
    fineDash: { label:"잔파선", desc:"촘촘한 짧은 선 구분선" },
    double: { label:"이중선", desc:"두 줄이 나란한 구분선" },
    triple: { label:"삼중선", desc:"세 줄이 나란한 구분선" },
    gradientFade: { label:"페이드", desc:"양끝이 흐려지는 그라데이션 선" },
    taperedLens: { label:"렌즈", desc:"가운데가 도톰한 렌즈형 선" },
    glowLine: { label:"네온", desc:"은은하게 빛나는 선" },
    shadowLine: { label:"그림자선", desc:"진한 그림자가 깔린 선" },
    beads: { label:"구슬", desc:"동그란 구슬이 꿰인 구분선" },
    squareDash: { label:"각진 파선", desc:"사각 조각이 이어지는 구분선" },
    railroad: { label:"레일", desc:"두 줄과 침목의 레일선" },
    ladder: { label:"사다리", desc:"가로줄과 세로 칸의 사다리선" },
    morse: { label:"모스", desc:"길고 짧은 점선의 리듬 구분선" },
    dotCenter: { label:"가운데 점", desc:"중앙에 점이 있는 선" },
    circleCenter: { label:"가운데 원", desc:"중앙에 빈 원이 있는 선" },
    diamondCenter: { label:"가운데 마름모", desc:"중앙 마름모 장식 선" },
    squareCenter: { label:"가운데 사각", desc:"중앙 사각 장식 선" },
    starCenter: { label:"가운데 별", desc:"중앙 별 장식 선" },
    flowerCenter: { label:"가운데 꽃", desc:"중앙 꽃 장식 선" },
    leafCenter: { label:"가운데 잎", desc:"중앙 잎 장식 선" },
    heartCenter: { label:"가운데 하트", desc:"중앙 하트 장식 선" },
    plusCenter: { label:"가운데 십자", desc:"중앙 십자 장식 선" },
    gemCenter: { label:"가운데 보석", desc:"중앙 보석 장식 선" },
    dotsTrio: { label:"세 점", desc:"가운데 점 세 개 구분선" },
    arrowEnds: { label:"화살 끝", desc:"양끝이 화살표인 선" },
    bracketEnds: { label:"괄호 끝", desc:"양끝에 괄호 장식 선" },
    taperDots: { label:"점 페이드", desc:"가운데 마름모에 점이 번지는 선" },
    ornateScroll: { label:"스크롤", desc:"중앙 소용돌이 장식 선" },
    wave: { label:"물결", desc:"부드러운 곡선이 출렁이는 구분선" },
    zigzag: { label:"지그재그", desc:"꺾인 선이 반복되는 구분선" },
    rope: { label:"꼬임", desc:"두 가닥이 꼬인 밧줄 구분선" },
    chainLink: { label:"사슬", desc:"고리가 이어진 사슬 구분선" },
    groove: { label:"음각", desc:"홈이 파인 듯한 입체 구분선" },
    ribbon: { label:"리본", desc:"굵은 띠에 가는 테두리가 더해진 선" },
    barcode: { label:"바코드", desc:"굵기가 다른 세로 막대 구분선" },
    scallop: { label:"스캘럽", desc:"반원이 이어지는 부채꼴 구분선" },
    pearlRow: { label:"진주", desc:"큰 진주와 잔점이 교차하는 구분선" },
    gradedDots: { label:"점강", desc:"가운데가 굵고 양끝으로 작아지는 점선" },
    lattice: { label:"그물", desc:"교차 사선이 짜인 그물 구분선" },
    brick: { label:"벽돌", desc:"위아래 두 줄이 엇갈린 벽돌 구분선" },
    sparkleCenter: { label:"가운데 반짝", desc:"중앙 반짝이 장식 선" },
    snowCenter: { label:"가운데 눈", desc:"중앙 눈송이 장식 선" },
    sunCenter: { label:"가운데 해", desc:"중앙 태양 장식 선" },
    quatrefoilCenter: { label:"가운데 네잎", desc:"중앙 네잎 장식 선" },
    crossCenter: { label:"가운데 십자가", desc:"중앙 장식 십자가 선" },
    asteriskCenter: { label:"가운데 별표", desc:"중앙 별표꽃 장식 선" },
    floretCenter: { label:"가운데 꽃송이", desc:"중앙 꽃송이 장식 선" },
    lozengeCenter: { label:"가운데 빈 마름모", desc:"중앙 빈 마름모 윤곽 선" },
    diamondEnds: { label:"마름모 끝", desc:"양끝에 마름모가 달린 선" },
    dotEnds: { label:"점 끝", desc:"양끝에 큰 점이 달린 선" },
    ringEnds: { label:"고리 끝", desc:"양끝에 빈 고리가 달린 선" },
    featherEnds: { label:"깃 끝", desc:"양끝에 깃 장식이 대칭으로 달린 선" },
    flourishEnds: { label:"잎 끝", desc:"양끝에 잎 장식이 대칭으로 달린 선" },
    lace: { label:"레이스", desc:"윗선·잔점·스캘럽이 겹친 레이스 구분선" },
    arabesque: { label:"아라베스크", desc:"S자 당초무늬가 흐르는 구분선" },
    greekKey: { label:"뇌문", desc:"직각 미로가 반복되는 그리스풍 구분선" },
    vine: { label:"덩굴", desc:"잎이 달린 곡선 덩굴 구분선" },
    celtic: { label:"켈틱 매듭", desc:"고리가 엮인 켈틱풍 구분선" },
    filigree: { label:"필리그리", desc:"이중선·소용돌이·잔구슬의 세공 구분선" },
    jewelBand: { label:"보석 띠", desc:"패싯이 빛나는 보석 띠 구분선" },
    prism: { label:"프리즘", desc:"광택 사선이 반짝이는 구분선" },
    crystalLine: { label:"크리스탈", desc:"깎인 보석 바 형태의 구분선" },
    metallicGold: { label:"메탈 광택", desc:"금속 하이라이트가 흐르는 구분선" },
    opal: { label:"오팔", desc:"영롱한 다색 펄이 번지는 구분선" },
    gemChain: { label:"보석 사슬", desc:"패싯 마름모가 이어진 보석 사슬 구분선" },
    aurora: { label:"오로라", desc:"다색 빛이 흐르며 발광하는 구분선" },
    neonTube: { label:"네온관", desc:"강한 글로우에 화이트 코어가 든 구분선" },
    starlight: { label:"별빛", desc:"중앙 큰 별과 잔별이 빛나는 구분선" },
    emberGlow: { label:"잉걸불", desc:"발광 점이 가운데서 사그라드는 구분선" },
    fairyLights: { label:"꼬마전구", desc:"줄에 색색 전구가 매달린 구분선" },
    floralWreath: { label:"꽃 화환", desc:"이중선에 꽃과 잎을 두른 구분선" },
    roseLine: { label:"장미", desc:"중앙 장미와 좌우 잎의 구분선" },
    cherryBlossom: { label:"벚꽃", desc:"꽃잎이 흩날리는 벚꽃 구분선" },
    laurel: { label:"월계", desc:"중앙 보석에 좌우 잎을 두른 구분선" },
    royalCrest: { label:"문장", desc:"이중선·중앙 보석·좌우 깃의 엠블럼 구분선" },
    scrollEnds: { label:"두루마리 끝", desc:"양끝 소용돌이와 중앙 마름모 구분선" },
    gemDrop: { label:"펜던트", desc:"본선에서 보석이 늘어진 구분선" },
    doubleRibbon: { label:"더블 리본", desc:"광택 두 줄과 중앙 매듭 구분선" },
    mosaic: { label:"모자이크", desc:"다색 타일이 박힌 모자이크 구분선" },
    chevronLux: { label:"쉐브론", desc:"굵은 V가 반복되는 광택 구분선" },
    sunburst: { label:"햇살", desc:"중앙 방사 빛살이 퍼지는 구분선" },
    damask: { label:"다마스크", desc:"마름모 격자가 짜인 다마스크 구분선" },
    botanical: { label:"식물 줄기", desc:"줄기에 잎이 엇갈려 달린 구분선" },
    thorns: { label:"가시덩굴", desc:"가시가 돋은 덩굴의 고딕 구분선" },
    bats: { label:"박쥐떼", desc:"날개 편 박쥐가 늘어선 구분선" },
    bloodDrip: { label:"핏방울", desc:"핏빛 선에서 방울이 흘러내리는 구분선" },
    cobweb: { label:"거미줄", desc:"늘어진 거미줄 커튼 구분선" },
    gothicCross: { label:"고딕 십자가", desc:"어두운 선에 십자가를 두른 구분선" },
    stardust: { label:"별가루", desc:"별가루가 흩날리며 빛나는 구분선" },
    heartChain: { label:"하트 체인", desc:"하트가 이어진 파스텔 구분선" },
    magicWand: { label:"마법봉", desc:"빛나는 별에 별가루 트레일 구분선" },
    sparkleTrail: { label:"반짝이", desc:"발광 다이아가 점강하는 구분선" },
    ribbonBow: { label:"리본", desc:"중앙 리본 매듭의 파스텔 구분선" },
    moonPhases: { label:"달의 위상", desc:"초승달에서 보름달로 차는 구분선" },
    runicLine: { label:"룬", desc:"직선 룬 문자가 새겨진 구분선" },
    pentacle: { label:"펜타클", desc:"원 안에 오망성을 둔 오컬트 구분선" }
  });
  const IDEA_DIVIDER_TEMPLATE_GUIDE = `# Lumi Ink 아이디어 보드 구분선 템플릿 가이드

구분선 요소는 \`kind: "divider"\`와 \`dividerStyle\` 키로 구분됩니다.

## 레지스트리

\`app.js\`의 \`IDEA_DIVIDER_STYLES\`에 다음 형식으로 키를 추가합니다.

\`\`\`js
ornamentLine: { label: "장식 실선", desc: "중앙 장식이 있는 구분선" }
\`\`\`

키 규칙: 영문/숫자로 시작하고 영문, 숫자, 하이픈, 언더바만 사용합니다.

## CSS 선택자

\`\`\`css
.idea-divider[data-divider-style="ornamentLine"] .idea-divider-body span {
  height: 2px;
  border: 0;
  background: linear-gradient(90deg, transparent, var(--idea-color-b), transparent);
}

.idea-divider[data-divider-style="ornamentLine"] .idea-divider-body::before {
  content: "✦";
  color: var(--idea-color-b);
}
\`\`\`

## 권장 구조

- 실제 선은 \`.idea-divider-body span\`에 그립니다.
- 장식은 \`::before\`, \`::after\`를 사용합니다.
- 색상은 \`--idea-color-a\`, \`--idea-color-b\`, \`--idea-chip-ink\`를 사용하면 앱 테마 컬러와 잘 맞습니다.
- 구분선은 사용자가 자유롭게 회전·크기 조절할 수 있으므로 고정 px보다 상대 단위와 \`height:100%\` 기반 배치가 안전합니다.
`;
  let ideaMultiSelectMode = false, ideaSelectedIds = new Set(), ideaMultiToolsExpanded = null;
  const IDEA_EYE_SVG = '<svg viewBox="0 0 24 24"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z"/><circle cx="12" cy="12" r="3"/></svg>';
  const IDEA_PENCIL_SVG = '<svg viewBox="0 0 24 24"><path d="M4 20h4l10.5-10.5a2.8 2.8 0 0 0-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/></svg>';
  let ideaZoom = 1, ideaSnapOn = false, ideaPinch = null; const ideaPointers = new Map();
  const IDEA_ZOOM_MIN = 0.2, IDEA_ZOOM_MAX = 2.5;
  const ideaReduceMotion = () => !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  function ideaSnapshot() { const d = currentIdeaData(); if (!d) return null; try { return JSON.stringify({ items: d.items, canvas: d.canvas, attachments: d.attachments }); } catch (e) { return null; } }
  function ideaSnapshotFileIds(snap) { try { const o = JSON.parse(snap); return new Set((o.items || []).map((i) => i && i.fileId).filter(Boolean)); } catch (e) { return new Set(); } }
  function syncIdeaHistoryBoard() { const n = currentIdeaNote(); const id = n ? n.id : null; if (ideaHistoryBoardId !== id) { ideaUndoStack.length = 0; ideaRedoStack.length = 0; ideaHistoryBoardId = id; } }
  function commitIdeaRemovedBlobs(note, ignoreHistory) {
    if (!ideaRemovedBlobIds.size) return;
    const histIds = new Set();
    if (!ignoreHistory) [...ideaUndoStack, ...ideaRedoStack].forEach((s) => ideaSnapshotFileIds(s).forEach((f) => histIds.add(f)));
    Array.from(ideaRemovedBlobIds).forEach((fileId) => {
      const refData = !!(note && note.data && Array.isArray(note.data.items) && note.data.items.some((i) => i && i.fileId === fileId));
      if (!refData && !histIds.has(fileId)) {
        del("files", fileId).catch(() => {});
        const u = ideaObjectUrls.get(fileId); if (u) { try { URL.revokeObjectURL(u); } catch (e) {} ideaObjectUrls.delete(fileId); }
        ideaRemovedBlobIds.delete(fileId);
      }
    });
  }
  function finalizeIdeaBoardHistory(boardId) { const note = boardId ? getNote(boardId) : null; ideaUndoStack.length = 0; ideaRedoStack.length = 0; commitIdeaRemovedBlobs(note, true); ideaRemovedBlobIds.clear(); }
  function pushIdeaUndo(snap) { const n = currentIdeaNote(); if (!n) return; syncIdeaHistoryBoard(); const s = snap || ideaSnapshot(); if (s == null) return; ideaUndoStack.push(s); ideaRedoStack.length = 0; while (ideaUndoStack.length > IDEA_HISTORY_MAX) ideaUndoStack.shift(); commitIdeaRemovedBlobs(n, false); updateIdeaHistoryButtons(); }
  function applyIdeaSnapshot(s) { const d = currentIdeaData(); if (!d || s == null) return; try { const o = JSON.parse(s); d.items = Array.isArray(o.items) ? o.items : []; if (o.canvas) d.canvas = o.canvas; d.attachments = Array.isArray(o.attachments) ? o.attachments : []; } catch (e) { return; } ideaEditState = { itemId: null, groupId:null, mode: null }; renderIdeaBoard(); scheduleIdeaSave(0); }
  function ideaUndo() { syncIdeaHistoryBoard(); if (!ideaUndoStack.length) { toast("되돌릴 작업이 없어요"); return; } const cur = ideaSnapshot(); const prev = ideaUndoStack.pop(); if (cur != null) ideaRedoStack.push(cur); applyIdeaSnapshot(prev); updateIdeaHistoryButtons(); toast("되돌렸어요"); }
  function ideaRedo() { syncIdeaHistoryBoard(); if (!ideaRedoStack.length) { toast("다시 실행할 작업이 없어요"); return; } const cur = ideaSnapshot(); const next = ideaRedoStack.pop(); if (cur != null) ideaUndoStack.push(cur); applyIdeaSnapshot(next); updateIdeaHistoryButtons(); toast("다시 적용했어요"); }
  function updateIdeaHistoryButtons() { const u = $("ideaUndo"), r = $("ideaRedo"); if (u) u.disabled = !ideaUndoStack.length; if (r) r.disabled = !ideaRedoStack.length; }

  function makeIdeaBoardData() {
    return { canvas: { width: 1600, height: 1100, background: "blueprint", backgroundMode: "template", backgroundImage: null, backgroundPreset: null, fitMode: false, snapOn: false }, items: [], attachments: [], viewMode: "board" };
  }
  function normalizeIdeaCanvasImage(raw) {
    if (!raw || typeof raw !== "object" || typeof raw.fileId !== "string" || !raw.fileId) return null;
    return {
      fileId: raw.fileId,
      name: typeof raw.name === "string" ? raw.name.slice(0,240) : "캔버스 이미지",
      overlayColor: normalizeIdeaColorValue(raw.overlayColor, ideaPreferredColor()),
      overlayOpacity: Math.max(0, Math.min(.92, Number(raw.overlayOpacity) || 0))
    };
  }
  function normalizeIdeaCanvasPreset(raw) {
    if (!raw || typeof raw !== "object" || typeof raw.key !== "string" || !Object.prototype.hasOwnProperty.call(IDEA_IMAGE_BACKGROUND_PRESETS, raw.key)) return null;
    return {
      key: raw.key,
      overlayColor: normalizeIdeaColorValue(raw.overlayColor, ideaPreferredColor()),
      overlayOpacity: Math.max(0, Math.min(.92, Number(raw.overlayOpacity) || 0))
    };
  }
  function ideaPresetBackgroundMeta(key) { return Object.prototype.hasOwnProperty.call(IDEA_IMAGE_BACKGROUND_PRESETS, key) ? IDEA_IMAGE_BACKGROUND_PRESETS[key] : null; }
  function defaultIdeaImageBackgroundKey() {
    return ideaPresetBackgroundMeta("17-cosmic-whale") ? "17-cosmic-whale" : Object.keys(IDEA_IMAGE_BACKGROUND_PRESETS)[0];
  }
  function ideaCanvasImageSource(config) {
    const uploaded=normalizeIdeaCanvasImage(config && config.backgroundImage);
    const preset=normalizeIdeaCanvasPreset(config && config.backgroundPreset);
    if (config && config.backgroundMode === "image" && uploaded) return { type:"image", id:`file:${uploaded.fileId}`, image:uploaded, src:"" };
    if (config && config.backgroundMode === "preset" && preset) {
      const meta=ideaPresetBackgroundMeta(preset.key);
      return meta ? { type:"preset", id:`preset:${preset.key}`, preset, meta, src:meta.src } : null;
    }
    return null;
  }
  function ensureIdeaBoardData(n) {
    const d = n.data = n.data && typeof n.data === "object" ? n.data : makeIdeaBoardData();
    d.canvas = d.canvas && typeof d.canvas === "object" ? d.canvas : {};
    d.canvas.width = Math.max(900, Math.min(6000, Number(d.canvas.width) || 1600));
    d.canvas.height = Math.max(700, Math.min(6000, Number(d.canvas.height) || 1100));
    d.canvas.zoom = Math.max(IDEA_ZOOM_MIN, Math.min(IDEA_ZOOM_MAX, Number(d.canvas.zoom) || 1));
    // 화면 맞춤은 고정 배율이 아니라 현재 기기의 가용 스테이지 크기를 따라가는 모드입니다.
    // 구형 보드는 false로 시작해, 사용자가 직접 맞춤을 눌렀을 때만 자동 재계산됩니다.
    d.canvas.fitMode = d.canvas.fitMode === true;
    d.canvas.snapOn = d.canvas.snapOn === true;
    d.canvas.background = IDEA_BG_TEMPLATES[d.canvas.background] ? d.canvas.background : "blueprint";
    d.canvas.backgroundImage = normalizeIdeaCanvasImage(d.canvas.backgroundImage);
    d.canvas.backgroundPreset = normalizeIdeaCanvasPreset(d.canvas.backgroundPreset);
    // 배경 소스는 템플릿 / 업로드 이미지 / 제공 이미지 프리셋 중 하나만 활성화합니다.
    // 구형 이미지 보드는 한 번만 image 모드로 승격하고, 나머지 소스는 비활성 상태로 보존합니다.
    const requestedMode = d.canvas.backgroundMode;
    if (requestedMode === "preset" && d.canvas.backgroundPreset) d.canvas.backgroundMode = "preset";
    else if (d.canvas.backgroundImage && (requestedMode === "image" || requestedMode == null)) d.canvas.backgroundMode = "image";
    else d.canvas.backgroundMode = "template";
    d.items = Array.isArray(d.items) ? d.items.filter((item) => item && typeof item === "object").map(normalizeIdeaItem) : [];
    d.attachments = Array.isArray(d.attachments) ? d.attachments.filter((a) => a && a.id) : [];
    d.viewMode = d.viewMode === "list" ? "list" : d.viewMode === "view" ? "view" : "board";
    return d;
  }
  function normalizeIdeaItem(raw) {
    // 정규화는 기존 객체를 갱신합니다. 캔버스 드래그 중 참조가 바뀌면
    // DOM에는 움직였지만 저장 데이터에는 남지 않는 유령 이동이 생기기 때문입니다.
    const item = raw && typeof raw === "object" ? raw : {};
    const kind = ["note", "image", "audio", "video", "file", "quote", "frame", "divider"].includes(item.kind) ? item.kind : "note";
    const defaults = ideaItemDefaults(kind);
    const minSize = ideaItemMinSize(kind);
    const numeric = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
    const aspectRaw = Number(item.aspect);
    const aspect = Number.isFinite(aspectRaw) && aspectRaw > .08 && aspectRaw < 20 ? aspectRaw : defaults.w / defaults.h;
    let normalizedW = Math.max(minSize.w, Math.min(1400, numeric(item.w, defaults.w)));
    let normalizedH = Math.max(minSize.h, Math.min(1100, numeric(item.h, defaults.h)));
    const normalizedRichText=sanitizeIdeaNoteRichHtml(typeof item.richText === "string" ? item.richText : "");
    const normalizedPlainText=typeof item.text === "string" ? item.text.slice(0,12000) : ideaNotePlainText(normalizedRichText);
    // v63.4의 기본값만 새 조각 언어(통통한 플레이어·칩)로 다듬습니다.
    // 사용자가 이미 리사이즈한 값은 그대로 보존합니다.
    if (kind === "audio" && normalizedW === 330 && normalizedH === 96) { normalizedW = 360; normalizedH = 82; }
    if (kind === "quote" && normalizedW === 310 && normalizedH === 170) { normalizedW = 300; normalizedH = 62; }
    if (kind === "file" && normalizedW === 300 && normalizedH === 86) { normalizedH = 62; }
    const legacyLinkedFrame = item.frameLinked === true || (item.useProjectFrame === true && !frameById(item.frame));
    const lockMode = item.lockMode === "transform" ? "transform" : item.locked === true ? "full" : null;
    delete item.frameLinked; delete item.useProjectFrame;
    return Object.assign(item, {
      id: typeof item.id === "string" ? item.id : uid(), kind,
      x: Math.max(0, Math.min(5900, numeric(item.x, defaults.w / 2))),
      y: Math.max(0, Math.min(5900, numeric(item.y, defaults.h / 2))),
      w: normalizedW,
      h: normalizedH,
      z: Math.max(1, Math.min(99999, numeric(item.z, 1))),
      rotation: Math.max(-180, Math.min(180, numeric(item.rotation, 0))),
      aspect,
      // 이미지·동영상만 비율 고정 설정을 가집니다. 메모지·음악·링크·첨부는 프레임 유무와 무관하게 항상 자유 비율입니다.
      lockAspect: (kind === "image" || kind === "video") ? item.lockAspect !== false : item.lockAspect === true,
      text: normalizedPlainText,
      richText: normalizedRichText,
      color: normalizeIdeaColorValue(item.color, ideaPreferredColor()),
      textColor: normalizeIdeaTextColorValue(item.textColor),
      noteStyle: Object.prototype.hasOwnProperty.call(IDEA_NOTE_TEMPLATES, item.noteStyle) ? item.noteStyle : "marker",
      fileId: typeof item.fileId === "string" ? item.fileId : null,
      noteId: typeof item.noteId === "string" ? item.noteId : null,
      // 빈 프레임은 표시 제목을 갖지 않습니다. 예전 "빈 프레임" 텍스트도 열 때 정리합니다.
      title: kind === "frame" ? "" : (typeof item.title === "string" ? item.title.slice(0, 240) : ""),
      showTitle: item.showTitle !== false,
      audioMode: kind === "audio" && item.audioMode === "light" ? "light" : "dark",
      flipX: (kind === "note" || kind === "image") && item.flipX === true,
      // v63.24부터 프레임은 조각별 독립 값만 보관합니다. 과거 프로젝트 연동 전용 값은 정리합니다.
      frame: legacyLinkedFrame ? null : (frameById(item.frame) ? item.frame : null),
      frameColor: legacyLinkedFrame ? null : (frameById(item.frame) ? (normalizeFrameColor(item.frameColor) || "#d4af37") : null),
      videoDecor: item.videoDecor !== false,
      videoDecorColor: normalizeIdeaColorValue(item.videoDecorColor, isIdeaColorValue(item.color) ? item.color : ideaPreferredColor()),
      shadow: item.shadow !== false
      , locked: lockMode === "full"
      , lockMode
      , groupId: typeof item.groupId === "string" && item.groupId ? item.groupId : null
      , vAlign: kind === "note" && item.vAlign === "center" ? "center" : "top"
      , dividerStyle: kind === "divider" && Object.prototype.hasOwnProperty.call(IDEA_DIVIDER_STYLES, item.dividerStyle) ? item.dividerStyle : "solid"
      , dividerWeight: Math.max(1, Math.min(12, Math.round(Number(item.dividerWeight) || 3)))
    });
  }
  function ideaItemDefaults(kind) {
    return kind === "note" ? { w: 270, h: 190 }
      : kind === "image" ? { w: 340, h: 255 }
      : kind === "audio" ? { w: 360, h: 82 }
      : kind === "video" ? { w: 390, h: 260 }
      : kind === "frame" ? { w: 340, h: 230 }
      : kind === "divider" ? { w: 360, h: 24 }
      : kind === "quote" ? { w: 300, h: 62 }
      : { w: 300, h: 62 };
  }
  function ideaItemMinSize(kind) {
    return kind === "image" ? { w: 24, h: 24 }
      : kind === "video" ? { w: 80, h: 54 }
      : kind === "audio" ? { w: 180, h: 46 }
      : kind === "frame" ? { w: 60, h: 60 }
      : kind === "divider" ? { w: 60, h: 8 }
      : kind === "note" ? { w: 90, h: 64 }
      : { w: 90, h: 40 };
  }
  function ideaClampItemSize(kind, w, h) {
    const min=ideaItemMinSize(kind);
    return { w:Math.max(min.w,Math.min(1400,Math.round(Number(w)||min.w))), h:Math.max(min.h,Math.min(1100,Math.round(Number(h)||min.h))) };
  }
  function ideaLockMode(item) { return item && item.lockMode === "transform" ? "transform" : item && item.locked === true ? "full" : null; }
  function ideaIsLocked(item) { return !!ideaLockMode(item); }
  function ideaIsFullyLocked(item) { return ideaLockMode(item) === "full"; }
  function setIdeaLockMode(item, mode) {
    if (!item) return;
    const next = mode === "transform" ? "transform" : mode === "full" ? "full" : null;
    item.lockMode = next;
    item.locked = next === "full";
  }
  function ideaCanEditItem(item, message) {
    if (!item || !ideaIsLocked(item)) return true;
    if (message !== false) toast(ideaIsFullyLocked(item) ? "전체 보호 잠금 상태입니다. 먼저 잠금을 풀어주세요." : "요소 잠금 상태입니다. 메모 내용만 편집할 수 있어요.");
    return false;
  }
  function normalizeImportedIdeaBoardData(raw) {
    const d = raw && typeof raw === "object" ? raw : {};
    const temp = { type: "idea", data: { canvas: d.canvas, items: d.items, attachments: normalizeImportedAttachments(d.attachments), viewMode: d.viewMode } };
    return ensureIdeaBoardData(temp);
  }
  function ideaBoardSummary(n) {
    const d = ensureIdeaBoardData(n), counts = {};
    d.items.forEach((item) => { counts[item.kind] = (counts[item.kind] || 0) + 1; });
    const labels = { note: "메모지", image: "이미지", audio: "음악", video: "영상", file: "파일", quote: "링크", frame:"프레임", divider:"구분선" };
    return Object.keys(counts).slice(0, 3).map((k) => `${labels[k]} ${counts[k]}`).join(" · ") || "빈 캔버스";
  }
  function currentIdeaNote() { const n = getNote(st.curNoteId); return n && n.type === "idea" ? n : null; }
  function currentIdeaData() { const n = currentIdeaNote(); return n ? ensureIdeaBoardData(n) : null; }
  function isIdeaReadonly() { return ideaViewMode === "view"; }
  function getIdeaItem(id) { const d = currentIdeaData(); return d ? d.items.find((item) => item.id === id) || null : null; }
  function updateIdeaSnapButton() {
    const b = $("ideaSnapToggle"); if (!b) return;
    b.setAttribute("aria-pressed", String(ideaSnapOn));
    b.classList.toggle("on", ideaSnapOn);
  }
  function updateIdeaTopViewToggle() {
    const b=$("ideaViewToggle"); if(!b)return;
    const readOnly=ideaViewMode==="view";
    b.innerHTML=readOnly ? IDEA_PENCIL_SVG : IDEA_EYE_SVG;
    b.setAttribute("aria-label", readOnly ? "편집 모드" : "보기 모드");
    b.setAttribute("title", readOnly ? "편집 모드로 돌아가기" : "보기 전용 모드");
    b.classList.toggle("on", readOnly);
    const shot=$("ideaScreenshot"); if(shot) shot.hidden=!readOnly;
  }
  function setIdeaSaver(mode) {
    const s = $("ideaSaver"); if (!s) return;
    s.className = "saver " + mode;
    $("ideaSaverText").textContent = mode === "dirty" ? "기록 중" : mode === "saved" ? "저장됨" : "";
    if (mode === "saved") setTimeout(() => { if (s.classList.contains("saved")) { s.className = "saver"; $("ideaSaverText").textContent = ""; } }, 1500);
  }
  function scheduleIdeaSave(delay = 420) {
    if (!currentIdeaNote()) return;
    ideaDirty = true; setIdeaSaver("dirty"); clearTimeout(ideaTimer);
    ideaTimer = setTimeout(() => { void flushIdeaBoard(false); }, delay);
  }
  async function flushIdeaBoard(silent) {
    clearTimeout(ideaTimer); ideaTimer = null;
    const n = currentIdeaNote(); if (!n || !ideaDirty) return;
    ensureIdeaBoardData(n);
    try { await saveNote(n); ideaDirty = false; if (!silent) setIdeaSaver("saved"); }
    catch (e) { setIdeaSaver("dirty"); toast("아이디어 보드를 저장하지 못했어요"); }
  }
  function updateIdeaItem(id, patch, immediate) {
    const item = getIdeaItem(id); if (!item) return null;
    Object.assign(item, patch || {});
    scheduleIdeaSave(immediate ? 0 : 420);
    return item;
  }
  function revokeIdeaObjectUrls() { ideaObjectUrls.forEach((url) => { try { URL.revokeObjectURL(url); } catch (e) {} }); ideaObjectUrls.clear(); }
  async function ideaFileUrl(fileId) {
    if (!fileId) return null;
    if (ideaObjectUrls.has(fileId)) return ideaObjectUrls.get(fileId);
    try { const rec = await getOne("files", fileId); if (!rec || !rec.blob) return null; const url = URL.createObjectURL(rec.blob); ideaObjectUrls.set(fileId, url); return url; } catch (e) { return null; }
  }
  function itemAttachment(n, fileId) { return ((n.data && n.data.attachments) || []).find((x) => x && x.id === fileId) || null; }
  function ideaItemTitle(item, n) {
    if (item.kind === "note") return (item.text || "새 메모지").replace(/\s+/g, " ").trim().slice(0, 46) || "새 메모지";
    if (item.kind === "quote") { const ref = getNote(item.noteId); return item.title || (ref ? (ref.title || "제목 없는 메모") : "연결된 메모"); }
    if (item.kind === "frame") return "프레임";
    const a = itemAttachment(n, item.fileId); return item.title || (a && a.name) || "첨부 조각";
  }
  function renderIdeaBoard() {
    const n = currentIdeaNote(); if (!n) { back(); return; }
    const d = ensureIdeaBoardData(n); revokeIdeaObjectUrls();
    if (ideaActiveBoardId !== n.id) { if (ideaActiveBoardId) finalizeIdeaBoardHistory(ideaActiveBoardId); ideaActiveBoardId = n.id; ideaHistoryBoardId = n.id; ideaDirty = false; ideaEditState = { itemId: null, groupId:null, mode: null }; ideaSelectedIds.clear(); ideaMultiSelectMode=false; ideaZoom = Math.max(IDEA_ZOOM_MIN, Math.min(IDEA_ZOOM_MAX, Number(d.canvas.zoom) || 1)); }
    ideaSnapOn = d.canvas.snapOn === true;
    ideaViewMode = d.viewMode || "board";
    const readOnly = ideaViewMode === "view", boardLike = ideaViewMode !== "list";
    if (readOnly) { if (ideaEditState.itemId) ideaEditState = { itemId: null, groupId:null, mode: null }; ideaMultiSelectMode=false; ideaSelectedIds.clear(); }
    $("ideaTitle").textContent = n.title || "아이디어 보드"; if (!ideaDirty) setIdeaSaver("");
    const screen = $("screen-idea"); screen.classList.toggle("idea-board-mode", boardLike); screen.classList.toggle("idea-list-mode", ideaViewMode === "list"); screen.classList.toggle("idea-readonly-mode", readOnly);
    $("ideaBoardMode").classList.toggle("active", ideaViewMode !== "list"); $("ideaListMode").classList.toggle("active", ideaViewMode === "list"); const multiToggle=$("ideaMultiToggle"); if(multiToggle) multiToggle.hidden=readOnly; updateIdeaTopViewToggle(); updateIdeaSnapButton();
    const canvas = $("ideaCanvas"), sizer = $("ideaCanvasSizer");
    if (sizer) { sizer.style.width = d.canvas.width + "px"; sizer.style.height = d.canvas.height + "px"; }
    canvas.style.width = d.canvas.width + "px"; canvas.style.minHeight = d.canvas.height + "px"; applyIdeaCanvasAppearance(canvas, d); canvas.innerHTML = "";
    // 맞춤 모드로 저장된 보드는 새 기기·세로/가로 전환에서도 현재 스테이지에 다시 맞춥니다.
    ideaZoom = d.canvas.fitMode ? ideaLongAxisFitZoom() : ideaClampZoom(ideaZoom);
    if (d.canvas.fitMode) d.canvas.zoom = ideaZoom;
    applyIdeaZoom();
    if (!d.items.length) canvas.innerHTML = '<div class="idea-canvas-empty"><div><b>아직 붙인 조각이 없어요</b>빈 공간을 길게 누르거나, 상단 + 버튼으로 첫 아이디어를 놓아보세요.</div></div>';
    d.items.slice().sort((a,b) => a.z - b.z).forEach((item) => canvas.appendChild(createIdeaItemElement(n, item)));
    applyIdeaMultiSelectionClasses(); updateIdeaMultiButton(); renderIdeaMultiTools();
    if (ideaEditState.itemId && !readOnly) requestAnimationFrame(() => mountIdeaTransformControls(ideaEditState.itemId));
    renderIdeaList(n); updateIdeaHistoryButtons();
  }
  function ideaItemElement(id) { return $("ideaCanvas") && $("ideaCanvas").querySelector(`[data-item-id="${CSS.escape(id)}"]`); }
  function setIdeaItemGeometry(el, item) {
    el.style.left = item.x + "px"; el.style.top = item.y + "px"; el.style.width = item.w + "px"; el.style.height = item.h + "px"; el.style.zIndex = item.z;
    el.style.setProperty("--idea-rot", (item.rotation || 0) + "deg");
    const baseH = item.kind === "audio" ? 82 : (["file","quote"].includes(item.kind) ? 62 : (item.kind === "video" ? 260 : (item.kind === "image" ? 255 : (item.kind === "frame" ? 230 : 190))));
    el.style.setProperty("--idea-scale", Math.max(.74, Math.min(2.4, (Number(item.h) || baseH) / baseH)).toFixed(3));
    const frame=ideaMediaFrameConfig(item);
    const minSide=Math.max(54, Math.min(Number(item.w)||110, Number(item.h)||54));
    const cap=Math.round(Math.max(16, Math.min(44, minSide * .16)));
    el.style.setProperty("--idea-frame-cap", cap + "px");
    el.style.setProperty("--idea-frame-outset", Math.round(Math.max(6, Math.min(14, cap * .34))) + "px");
    el.classList.toggle("has-media-frame", !!frame);
    el.classList.toggle("flipped-x", !!item.flipX);
    el.classList.toggle("locked", ideaIsLocked(item));
    el.classList.toggle("transform-locked", ideaLockMode(item) === "transform");
    el.classList.toggle("fully-locked", ideaIsFullyLocked(item));
    el.classList.toggle("grouped", !!item.groupId);
    el.dataset.flipX = item.flipX ? "true" : "";
    if (el.classList.contains("selected")) positionIdeaTransformControls(el, item);
  }
  function ideaPlainBackgroundMeta(key) {
    const raw = String(key || "");
    if (raw.startsWith("plain-light-")) {
      const base = IDEA_THEME_COLORS[raw.slice(12)];
      if (!base) return null;
      const a = mixHex(base.ig[0], "#ffffff", .72), b = mixHex(base.ig[1], "#ffffff", .64);
      return { name:`${base.name} 라이트`, grad:`linear-gradient(135deg, ${a}, ${b})`, ig:[a, b] };
    }
    return raw.startsWith("plain-") ? IDEA_THEME_COLORS[raw.slice(6)] || null : null;
  }
  function ideaCanvasPlainStyle(key) {
    const plain = ideaPlainBackgroundMeta(key);
    return plain ? `--idea-canvas-a:${plain.ig[0]};--idea-canvas-b:${plain.ig[1]};` : "";
  }
  function applyIdeaCanvasAppearance(canvas, data) {
    if (!canvas || !data || !data.canvas) return;
    const config=data.canvas, source=ideaCanvasImageSource(config);
    const activeBackground=source ? (source.type === "preset" ? "preset" : "uploaded") : config.background;
    const plain=ideaPlainBackgroundMeta(activeBackground);
    canvas.dataset.background=activeBackground;
    if (plain) { canvas.style.setProperty("--idea-canvas-a", plain.ig[0]); canvas.style.setProperty("--idea-canvas-b", plain.ig[1]); }
    else { canvas.style.removeProperty("--idea-canvas-a"); canvas.style.removeProperty("--idea-canvas-b"); }
    canvas.classList.toggle("has-canvas-image", !!source);
    canvas.style.removeProperty("--idea-canvas-image");
    if (!source) { canvas.dataset.canvasImageId=""; canvas.style.removeProperty("--idea-canvas-overlay"); return; }
    const overlay=source.type === "preset" ? source.preset : source.image;
    const meta=ideaColorMeta(overlay.overlayColor);
    canvas.style.setProperty("--idea-canvas-overlay", rgbaHex(meta.ig[0], overlay.overlayOpacity));
    canvas.dataset.canvasImageId=source.id;
    if (source.type === "preset") {
      canvas.style.setProperty("--idea-canvas-image", ideaCssUrl(source.src));
      return;
    }
    const fileId=source.image.fileId;
    void ideaFileUrl(fileId).then((url)=>{
      if (!url || !canvas.isConnected || canvas.dataset.canvasImageId !== source.id) return;
      canvas.style.setProperty("--idea-canvas-image", ideaCssUrl(url));
    });
  }

  function createIdeaItemElement(n, item) {
    const readOnly = isIdeaReadonly();
    const el = document.createElement("article");
    el.className = `idea-item idea-${item.kind}` + (item.kind === "note" ? " idea-sticky" : "") + (item.shadow === false ? " no-shadow" : ""); el.dataset.itemId = item.id;
    el.tabIndex = 0; el.setAttribute("role", "group"); el.setAttribute("aria-roledescription", "보드 조각"); el.setAttribute("aria-label", `${IDEA_KIND_LABEL[item.kind] || "조각"}: ${ideaItemTitle(item, n)}`);
    el.addEventListener("focus", () => { if (!readOnly && !ideaMultiSelectMode && ideaEditState.itemId !== item.id) selectIdeaItem(item.id, null); });
    if (["note","audio","quote","file","frame","divider"].includes(item.kind)) applyIdeaColor(el, item);
    if (item.kind === "note") { el.dataset.noteStyle = item.noteStyle; el.dataset.vAlign = item.vAlign === "center" ? "center" : "top"; }
    setIdeaItemGeometry(el, item);
    if (item.kind === "note") {
      const noteHtml=ideaNoteHtml(item);
      el.innerHTML = `<div class="idea-note-rich-tools" role="toolbar" aria-label="메모지 서식"><button type="button" data-idea-note-cmd="bold" aria-label="굵게" title="굵게"><b>B</b></button><button type="button" data-idea-note-cmd="italic" aria-label="기울기" title="기울기"><i>I</i></button><button type="button" data-idea-note-cmd="underline" aria-label="밑줄" title="밑줄"><u>U</u></button><button type="button" data-idea-note-cmd="strikeThrough" aria-label="취소선" title="취소선"><s>S</s></button><button type="button" data-idea-note-cmd="foreColor" aria-label="글자색" title="글자색"><span class="idea-note-ink" style="--idea-note-fore-color:${esc(ideaTextColorValue(item.textColor)||"#27303a")}">A</span></button><button type="button" data-idea-note-cmd="hiliteColor" aria-label="형광펜" title="형광펜"><span class="idea-note-hi">H</span></button><span class="idea-note-tool-sep"></span><button type="button" data-idea-note-cmd="justifyLeft" aria-label="왼쪽 정렬" title="왼쪽 정렬">≡</button><button type="button" data-idea-note-cmd="justifyCenter" aria-label="가운데 정렬" title="가운데 정렬">≡</button><button type="button" data-idea-note-cmd="justifyRight" aria-label="오른쪽 정렬" title="오른쪽 정렬">≡</button><select class="idea-note-font-size" aria-label="글자 크기" title="글자 크기"><option value="2">A--</option><option value="3">A-</option><option value="4" selected>A</option><option value="5">A+</option><option value="6">A++</option><option value="7">A+++</option></select><span class="idea-note-tool-sep"></span><button type="button" data-idea-note-cmd="removeFormat" aria-label="서식 지우개" title="서식 지우개">Tx</button></div><div class="idea-note-text" contenteditable="${readOnly || ideaIsFullyLocked(item) ? "false" : "true"}" spellcheck="true" tabindex="-1" aria-label="메모지 내용" data-placeholder="메모지를 적어보세요…">${noteHtml}</div>`;
      if (!readOnly && !ideaIsFullyLocked(item)) bindIdeaNoteRichEditor(el, item, el.querySelector(".idea-note-text"));
    } else if (item.kind === "quote") {
      const ref = getNote(item.noteId);
      const typeLabel = ref ? noteTypeShortLabel(ref) : "메모 없음";
      const detail = ref ? typeLabel : "원본 메모가 삭제되었거나 이동되었습니다.";
      el.innerHTML = `<div class="idea-quote-body" title="${esc(detail || "연결된 메모 열기")}"><span class="idea-quote-mark" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M10 14 21 3"/><path d="M15 3h6v6"/><path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5"/></svg></span><span class="idea-quote-copy"><span class="idea-quote-eyebrow">내 메모</span><span class="idea-quote-title">${esc(ideaItemTitle(item, n))}</span><span class="idea-quote-preview">${esc(typeLabel)}</span></span><button class="idea-quote-go" type="button" aria-label="연결된 메모 열기"><svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg></button></div>`;
      el.querySelector(".idea-quote-go").addEventListener("click", (e) => { e.stopPropagation(); if (item.noteId && getNote(item.noteId)) openNote(item.noteId); else toast("연결된 메모를 찾을 수 없어요"); });
    } else if (item.kind === "file") {
      const att = itemAttachment(n, item.fileId), name = item.title || (att && att.name) || "첨부 파일";
      const fileExt = (String(name).split(".").pop() || "").slice(0, 5).toUpperCase();
      const fileMeta = att ? `${fileExt && fileExt !== name.toUpperCase() ? fileExt + " · " : ""}${fmtSize(att.size)}` : "파일을 찾을 수 없음";
      el.innerHTML = `<div class="idea-file-body" title="${att ? esc(fmtSize(att.size)) : "파일을 찾을 수 없음"}"><span class="idea-file-icon">${fileIconSvg((att && att.type) || "")}</span><span class="idea-file-info"><span class="idea-file-name">${esc(name)}</span><span class="idea-file-meta">${esc(fileMeta)}</span></span><button class="idea-file-download" type="button" aria-label="${esc(name)} 다운로드">${DL_SVG}</button></div>`;
      el.querySelector(".idea-file-download").addEventListener("click", (e) => { e.stopPropagation(); if (item.fileId) downloadAttachment(item.fileId); });
    } else if (item.kind === "audio") {
      const att = itemAttachment(n, item.fileId);
      const trackName = item.title || (att && att.name) || "오디오 트랙";
      const titleClass = item.showTitle === false ? " is-title-hidden" : "";
      const audioModeClass = item.audioMode === "light" ? " is-player-light" : " is-player-dark";
      el.innerHTML = `<div class="idea-audio-shell${titleClass}${audioModeClass}" aria-label="음악 플레이어"><div class="idea-audio-head"><span class="idea-audio-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M9 17V6.2l9-2V15" stroke="#fff" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/><circle cx="6.4" cy="17.3" r="2.7" fill="#fff"/><circle cx="15.4" cy="15.3" r="2.7" fill="#fff"/></svg></span><span class="idea-audio-meta"><span class="idea-audio-eyebrow">MUSIC</span><span class="idea-audio-name">${esc(trackName)}</span></span><span class="idea-audio-spark" aria-hidden="true">✦</span></div><div class="idea-media-content"><div class="idea-media-loading">불러오는 중…</div></div></div>`;
      hydrateIdeaMedia(el, item, att);
    } else if (item.kind === "frame") {
      // 프레임 조각은 장식만 남기고 캔버스/목록에 제목을 표시하지 않습니다.
      el.innerHTML = `<div class="idea-empty-frame-body" aria-hidden="true"></div>`;
    } else if (item.kind === "divider") {
      el.dataset.dividerStyle = item.dividerStyle || "solid";
      el.style.setProperty("--idea-divider-weight", (Math.max(1,Math.min(12,Math.round(Number(item.dividerWeight)||3)))) + "px");
      el.innerHTML = `<div class="idea-divider-body" aria-hidden="true"><span></span></div>`;
    } else {
      const needsFrame = item.kind === "image" || item.kind === "video";
      const videoDecor = item.kind === "video" ? ideaVideoDecorMarkup(item) : "";
      el.innerHTML = needsFrame ? `<div class="idea-media-shell${item.kind === "video" ? " idea-video-shell" : ""}">${videoDecor}<div class="idea-media-content"><div class="idea-media-loading">불러오는 중…</div></div><div class="idea-media-frame" aria-hidden="true"></div></div>` : `<div class="idea-media-content"><div class="idea-media-loading">불러오는 중…</div></div>`;
      refreshIdeaMediaFrame(el, item);
      hydrateIdeaMedia(el, item, itemAttachment(n, item.fileId));
    }
    // 모든 조각이 동일한 독립 프레임 레이어를 공유합니다.
    refreshIdeaMediaFrame(el, item);
    if (ideaIsLocked(item)) el.insertAdjacentHTML("beforeend", `<span class="idea-lock-badge" aria-label="${ideaIsFullyLocked(item) ? "전체 보호 잠금" : "요소 잠금"}">${ideaIsFullyLocked(item) ? "🔒" : "✎"}</span>`);
    bindIdeaItemInteractions(el, item);
    return el;
  }
  function captureIdeaNoteRange(editor) {
    const sel=window.getSelection(); if(!sel||!sel.rangeCount||!editor)return null;
    const range=sel.getRangeAt(0); return editor.contains(range.commonAncestorContainer)?range.cloneRange():null;
  }
  function restoreIdeaNoteRange(editor, range) {
    if(!editor)return false; try{editor.focus({preventScroll:true});}catch(e){editor.focus();}
    if(!range)return false; const sel=window.getSelection(); sel.removeAllRanges();sel.addRange(range);return true;
  }
  function applyIdeaNoteColorRange(editor, range, cssColor) {
    if(!editor || !range || range.collapsed) return null;
    try {
      if(!editor.contains(range.startContainer) || !editor.contains(range.endContainer)) return null;
      const work=range.cloneRange();
      const span=document.createElement("span");
      span.style.color=cssColor;
      span.appendChild(work.extractContents());
      work.insertNode(span);
      const selected=document.createRange();
      selected.selectNodeContents(span);
      const sel=window.getSelection();
      if(sel){sel.removeAllRanges();sel.addRange(selected);}
      return selected.cloneRange();
    } catch(e) {
      try{restoreIdeaNoteRange(editor,range);document.execCommand("styleWithCSS",false,true);document.execCommand("foreColor",false,cssColor);return captureIdeaNoteRange(editor);}catch(_e){return null;}
    }
  }
  function openIdeaNoteHilitePicker(onPick) {
    const current = getHiliteColor();
    openModal(`<h3>메모지 형광펜 색상</h3><p class="m-sub">다섯 가지 형광펜 색 중 하나를 골라 메모지에 적용합니다.</p><div class="hilite-picker">${HILITE_COLORS.map((x) => `<button class="hilite-choice${x.value === current ? " sel" : ""}" data-color="${x.value}" aria-label="${x.label}"><span class="hilite-swatch" style="background:${x.value}"></span><span>${x.label}</span></button>`).join("")}</div><div class="m-row"><button class="m-btn" id="ideaHiliteCancel">취소</button></div>`);
    $("modalBox").querySelectorAll(".hilite-choice").forEach((btn)=>btn.addEventListener("click",()=>{const color=btn.dataset.color; setHiliteColor(color); closeModal(); if(typeof onPick==="function") onPick(color);}));
    $on("ideaHiliteCancel","click",closeModal);
  }
  function openIdeaNoteForeColorPicker(item, onPick) {
    const selected = item && item.textColor ? item.textColor : "auto";
    const initial = ideaTextColorValue(selected) || "#27303a";
    openAdvancedColorPicker("메모지 글자색", initial, (value)=>{
      if(typeof onPick === "function") onPick(value);
    }, {
      prefix:"ideaNoteForeStudio",
      saved:true,
      save:true,
      intro:"자유메모의 글자색 편집기와 같은 색상판입니다. 정사각형 안을 터치하거나 HEX·RGB 값으로 글자색을 정확히 맞출 수 있어요."
    });
  }

  function bindIdeaNoteRichEditor(el,item,editor) {
    if(!editor)return;
    const tools=el.querySelector(".idea-note-rich-tools"); let before=null,dirty=false,savedRange=null,lastForeColor=(item&&item.textColor)||"auto";
    const begin=()=>{if(before==null)before=ideaSnapshot();};
    const persist=()=>{const html=sanitizeIdeaNoteRichHtml(editor.innerHTML);const plain=ideaNotePlainText(html);const fresh=getIdeaItem(item.id);if(!fresh)return;if(fresh.richText!==html||fresh.text!==plain){fresh.richText=html;fresh.text=plain;dirty=true;scheduleIdeaSave(420);}};
    const applyHilite=(color,range)=>{begin();restoreIdeaNoteRange(editor,range||savedRange||captureIdeaNoteRange(editor));try{document.execCommand("styleWithCSS",false,true);}catch(e){}try{document.execCommand("hiliteColor",false,color||getHiliteColor());}catch(e){}savedRange=captureIdeaNoteRange(editor);persist();};
    const applyForeColor=(value,range,remember)=>{
      const target=range||savedRange||captureIdeaNoteRange(editor);
      if(!target || target.collapsed){ toast("색을 바꿀 글자를 먼저 선택해 주세요"); return; }
      begin(); restoreIdeaNoteRange(editor,target);
      if(remember) lastForeColor=normalizeIdeaTextColorValue(value);
      const cssColor=ideaTextColorValue(value)||getComputedStyle(editor).getPropertyValue("--stick-ink")||"#27303a";
      savedRange=applyIdeaNoteColorRange(editor,target,cssColor)||captureIdeaNoteRange(editor);persist();
      const ink=tools&&tools.querySelector('[data-idea-note-cmd="foreColor"] .idea-note-ink'); if(ink)ink.style.color=cssColor;
    };
    const command=(cmd,value)=>{begin();restoreIdeaNoteRange(editor,savedRange||captureIdeaNoteRange(editor));try{document.execCommand("styleWithCSS",false,true);}catch(e){}if(cmd==="removeFormat"){try{document.execCommand("removeFormat",false,null);document.execCommand("unlink",false,null);}catch(e){}}else{try{document.execCommand(cmd,false,value||null);}catch(e){}}savedRange=captureIdeaNoteRange(editor);persist();};
    const bindHoldAction=(button,onTap,onHold)=>{
      if(!button)return;
      let holdTimer=null,held=false,pointerId=null,holdRange=null;
      const clear=()=>{if(holdTimer){clearTimeout(holdTimer);holdTimer=null;}};
      const reset=()=>{clear();held=false;pointerId=null;button.classList.remove("holding");};
      button.addEventListener("pointerdown",(e)=>{
        if(e.button!=null&&e.button!==0)return;
        e.preventDefault();e.stopPropagation();savedRange=captureIdeaNoteRange(editor);holdRange=savedRange?savedRange.cloneRange():null;pointerId=e.pointerId;held=false;button.classList.add("holding");
        try{button.setPointerCapture(pointerId);}catch(_e){}
        holdTimer=setTimeout(()=>{holdTimer=null;held=true;button.classList.remove("holding");if(navigator.vibrate)navigator.vibrate(10);},480);
      });
      button.addEventListener("pointerup",(e)=>{
        if(pointerId!=null&&e.pointerId!==pointerId)return;
        e.preventDefault();e.stopImmediatePropagation();const range=holdRange,wasHeld=held;reset();
        // 팝업은 손을 뗀 뒤에만 열어, 같은 터치의 click/pointerup이 팝업을 바로 닫지 못하게 합니다.
        if(wasHeld) requestAnimationFrame(()=>onHold(range)); else onTap(range);
      });
      button.addEventListener("pointercancel",(e)=>{if(pointerId==null||e.pointerId===pointerId)reset();});
      button.addEventListener("lostpointercapture",()=>{if(!held)reset();});
      button.addEventListener("click",(e)=>{e.preventDefault();e.stopImmediatePropagation();});
      button.addEventListener("contextmenu",(e)=>e.preventDefault());
    };
    editor.addEventListener("focus",()=>{before=null;dirty=false;savedRange=captureIdeaNoteRange(editor);});
    editor.addEventListener("input",()=>{begin();persist();savedRange=captureIdeaNoteRange(editor);});
    editor.addEventListener("compositionend",()=>{begin();persist();});
    editor.addEventListener("blur",()=>{setTimeout(()=>{persist();if(dirty&&before!=null)pushIdeaUndo(before);before=null;dirty=false;void flushIdeaBoard(false);},0);});
    editor.addEventListener("keydown",(e)=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="s"){e.preventDefault();persist();void flushIdeaBoard(false);}else if(e.key==="Escape"){e.preventDefault();editor.blur();el.focus();}});
    if(!tools)return;
    const hilite=tools.querySelector('[data-idea-note-cmd="hiliteColor"]');
    if(hilite){
      hilite.style.setProperty("--hilite-color",getHiliteColor());
      bindHoldAction(hilite,(range)=>applyHilite(getHiliteColor(),range),(range)=>openIdeaNoteHilitePicker((color)=>applyHilite(color,range)));
    }
    const fore=tools.querySelector('[data-idea-note-cmd="foreColor"]');
    if(fore){
      const fresh=getIdeaItem(item.id); const current=ideaTextColorValue(fresh&&fresh.textColor)||getComputedStyle(editor).getPropertyValue("--stick-ink")||"#27303a";
      const ink=fore.querySelector(".idea-note-ink");if(ink)ink.style.color=current;
      bindHoldAction(fore,(range)=>applyForeColor(lastForeColor||"auto",range,false),(range)=>openIdeaNoteForeColorPicker(Object.assign({},getIdeaItem(item.id)||item,{textColor:lastForeColor}),(value)=>applyForeColor(value,range,true)));
    }
    tools.addEventListener("pointerdown",(e)=>{e.stopPropagation();savedRange=captureIdeaNoteRange(editor);const button=e.target.closest("button");if(button&&button.dataset.ideaNoteCmd!=="hiliteColor"&&button.dataset.ideaNoteCmd!=="foreColor"){e.preventDefault();command(button.dataset.ideaNoteCmd||"",button.dataset.ideaNoteValue||"");}});
    tools.addEventListener("click",(e)=>{e.stopPropagation();const button=e.target.closest("button");if(button&&button.dataset.ideaNoteCmd!=="hiliteColor"&&button.dataset.ideaNoteCmd!=="foreColor"&&e.detail===0)command(button.dataset.ideaNoteCmd||"",button.dataset.ideaNoteValue||"");});
    const size=tools.querySelector(".idea-note-font-size");if(size){size.addEventListener("pointerdown",(e)=>{e.stopPropagation();savedRange=captureIdeaNoteRange(editor);begin();});size.addEventListener("change",()=>command("fontSize",size.value));}
  }

  function ideaMediaFrameConfig(item) {
    if (!item || !frameById(item.frame)) return null;
    return { id:item.frame, color:normalizeFrameColor(item.frameColor) || "#d4af37" };
  }

  function ideaMediaFrameMarkup(item) {
    const config=ideaMediaFrameConfig(item);
    return config ? frameNineSliceMarkup(config.id, config.color) : "";
  }
  function ideaMediaFrameLabel(item) {
    const config=ideaMediaFrameConfig(item);
    return config ? ((frameById(config.id) || {}).name || "프레임") : "프레임 없음";
  }

  function ideaVideoDecorStyle(item) {
    const meta = ideaColorMeta(item && item.videoDecorColor || ideaPreferredColor());
    return `--idea-video-decor-a:${meta.ig[0]};--idea-video-decor-b:${meta.ig[1]};`;
  }
  function ideaVideoDecorMarkup(item) {
    if (!item || item.kind !== "video" || item.videoDecor === false) return "";
    return `<div class="idea-video-decor" style="${ideaVideoDecorStyle(item)}" aria-hidden="true"><span class="idea-video-ribbon">PLAY</span><span class="idea-video-sparkle">✦</span></div>`;
  }
  function refreshIdeaVideoDecor(el, item) {
    if (!el || !item || item.kind !== "video") return;
    const shell = el.querySelector(".idea-video-shell"); if (!shell) return;
    shell.querySelectorAll(".idea-video-decor").forEach((node) => node.remove());
    const markup = ideaVideoDecorMarkup(item);
    if (markup) shell.insertAdjacentHTML("afterbegin", markup);
  }
  function refreshIdeaMediaFrame(el, item) {
    if (!el) return;
    const config = ideaMediaFrameConfig(item), markup = ideaMediaFrameMarkup(item);
    let frame = el.querySelector(".idea-media-frame");
    const shell = el.querySelector(".idea-media-shell");
    if (!frame && config) {
      frame = document.createElement("div");
      frame.className = "idea-media-frame idea-item-frame";
      frame.setAttribute("aria-hidden", "true");
      el.appendChild(frame);
    }
    if (frame) {
      frame.innerHTML = markup;
      if (!config && frame.classList.contains("idea-item-frame")) frame.remove();
    }
    if (shell) shell.classList.toggle("has-project-frame", !!markup);
    el.classList.toggle("has-media-frame", !!config);
    refreshIdeaVideoDecor(el, item);
  }

  async function hydrateIdeaMedia(el, item, att) {
    const content = el.querySelector(".idea-media-content"); if (!content) return;
    const url = await ideaFileUrl(item.fileId); if (!url || !el.isConnected) { content.textContent = "파일을 찾을 수 없어요"; return; }
    if (item.kind === "image") {
      const img = document.createElement("img"); img.src = url; img.alt = item.title || "보드 이미지"; img.draggable = false; content.replaceChildren(img);
      refreshIdeaMediaFrame(el, item);
      img.addEventListener("load", () => syncIdeaMediaAspect(item.id, img.naturalWidth, img.naturalHeight));
    } else if (item.kind === "audio") {
      const audio = document.createElement("audio"); audio.src = url; audio.controls = true; audio.preload = "metadata"; content.replaceChildren(audio);
    } else if (item.kind === "video") {
      const video = document.createElement("video"); video.src = url; video.controls = true; video.preload = "metadata"; video.playsInline = true; content.replaceChildren(video);
      refreshIdeaMediaFrame(el, item);
      video.addEventListener("loadedmetadata", () => syncIdeaMediaAspect(item.id, video.videoWidth, video.videoHeight));
    }
  }
  function syncIdeaMediaAspect(id, w, h) {
    if (isIdeaReadonly()) return;
    if (!w || !h) return; const item = getIdeaItem(id); if (!item) return;
    const aspect = Math.max(.08, Math.min(20, w / h));
    const legacyNoAspect = !item.aspect;
    item.aspect = aspect;
    if (legacyNoAspect || item.lockAspect) { const min=ideaItemMinSize(item.kind); item.h = Math.max(min.h, Math.min(1100, Math.round(item.w / aspect))); }
    const el = ideaItemElement(id); if (el) setIdeaItemGeometry(el, item);
    scheduleIdeaSave();
  }
  function renderIdeaList(n) {
    const d = ensureIdeaBoardData(n), list = $("ideaList"); list.innerHTML = ""; list.hidden = ideaViewMode !== "list";
    if (!d.items.length) { list.innerHTML = '<div class="idea-list-empty">아직 관리할 조각이 없어요.<br>보드로 돌아가 + 버튼을 눌러 추가해 보세요.</div>'; return; }
    d.items.slice().sort((a,b) => b.z-a.z).forEach((item) => {
      const card = document.createElement("div"); card.className = "idea-list-card"; const att = itemAttachment(n, item.fileId);
      const icon = item.kind === "note" ? "✦" : item.kind === "image" ? "▧" : item.kind === "audio" ? "♫" : item.kind === "video" ? "▶" : item.kind === "quote" ? "↗" : item.kind === "frame" ? "□" : item.kind === "divider" ? "—" : "⌁";
      const isEmptyFrame=item.kind === "frame";
      const listCopy=isEmptyFrame
        ? `<div class="idea-list-copy idea-list-copy-frame"><div class="idea-list-kind">FRAME</div></div>`
        : `<div class="idea-list-copy"><div class="idea-list-kind">${esc({note:"MEMO",image:"IMAGE",audio:"AUDIO",video:"VIDEO",file:"FILE",quote:"MEMO LINK",divider:"DIVIDER"}[item.kind]||"ITEM")}</div><div class="idea-list-title">${esc(ideaItemTitle(item,n))}</div><div class="idea-list-sub">${esc(item.kind === "note" ? (item.text || "내용 없음").replace(/\s+/g," ").slice(0,70) : item.kind === "quote" ? "연결된 메모 열기" : item.kind === "divider" ? (IDEA_DIVIDER_STYLES[item.dividerStyle] || IDEA_DIVIDER_STYLES.solid).label : (att ? `${att.type || "file"} · ${fmtSize(att.size)}` : "파일 없음"))}</div></div>`;
      card.innerHTML = `<div class="idea-list-thumb">${icon}</div>${listCopy}<button class="idea-list-act" type="button" title="미리보기">◉</button><button class="idea-list-act" type="button" title="보드에서 보기">⌖</button><button class="idea-list-act danger" type="button" title="삭제">×</button>`;
      const actions = card.querySelectorAll("button");
      actions[0].addEventListener("click", () => openIdeaArtifactPreview(item.id));
      actions[1].addEventListener("click", () => focusIdeaItem(item.id));
      actions[2].addEventListener("click", () => confirmModal("조각 삭제", `'${ideaItemTitle(item,n)}' 조각을 보드에서 지울까요?`, "삭제", true, () => removeIdeaItem(item.id)));
      if (item.kind === "image" && item.fileId) hydrateIdeaListThumb(card.querySelector(".idea-list-thumb"), item.fileId, item.title);
      list.appendChild(card);
    });
  }
  async function hydrateIdeaListThumb(wrap, fileId, alt) {
    if (!wrap) return; const url = await ideaFileUrl(fileId); if (!url || !wrap.isConnected) return;
    const img = document.createElement("img"); img.src = url; img.alt = alt || "이미지"; wrap.replaceChildren(img);
  }
  function openIdeaArtifactPreview(id) {
    const n = currentIdeaNote(), item = getIdeaItem(id); if (!n || !item) return;
    const title = ideaItemTitle(item, n);
    let body = "";
    if (item.kind === "note") body = `<div class="idea-preview-note idea-sticky${item.flipX ? " flipped-x" : ""}" data-color="${esc(item.color)}" data-note-style="${esc(item.noteStyle)}" data-v-align="${esc(item.vAlign==="center"?"center":"top")}" style="${ideaColorStyleAttr(item.color, item.textColor)}"><div class="idea-note-text">${ideaNoteHtml(item) || "내용 없는 메모지"}</div></div>`;
    else if (item.kind === "quote") body = `<div class="idea-preview-quote idea-preview-chip" style="${ideaColorStyleAttr(item.color, item.textColor)}"><b>↗ ${esc(title)}</b><button class="m-btn primary" id="ideaPreviewOpenQuote">메모 열기</button></div>`;
    else if (item.kind === "file") body = `<div class="idea-preview-file idea-preview-chip" style="${ideaColorStyleAttr(item.color, item.textColor)}"><div>${fileIconSvg((itemAttachment(n,item.fileId)||{}).type||"")}</div><b>${esc(title)}</b><button class="m-btn primary" id="ideaPreviewDownload">파일 다운로드</button></div>`;
    else if (item.kind === "frame") body = `<div class="idea-preview-file idea-preview-chip idea-preview-frame" style="${ideaColorStyleAttr(item.color, item.textColor)}"><b>□</b><small>${esc(ideaMediaFrameLabel(item))}</small></div>`;
    else if (item.kind === "divider") body = `<div class="idea-preview-file idea-preview-chip idea-preview-divider" data-divider-style="${esc(item.dividerStyle || "solid")}" style="${ideaColorStyleAttr(item.color, item.textColor)};--idea-divider-weight:${Math.max(1,Math.min(12,Math.round(Number(item.dividerWeight)||3)))}px"><b>— ${esc(title)}</b><div class="idea-divider-body"><span></span></div></div>`;
    else body = `<div class="idea-preview-media${item.kind === "audio" ? ` idea-preview-audio ${item.audioMode === "light" ? "is-player-light" : "is-player-dark"}` : ""}${item.kind === "image" && item.flipX ? " flipped-x" : ""}" id="ideaPreviewMedia" style="${item.kind === "audio" ? ideaColorStyleAttr(item.color) : ""}"><div class="idea-media-loading">불러오는 중…</div></div>`;
    openModal(`<h3>${esc(title)}</h3><div class="idea-preview-wrap">${body}</div><div class="m-row"><button class="m-btn" id="ideaPreviewClose">닫기</button></div>`);
    $on("ideaPreviewClose", "click", closeModal);
    if (item.kind === "quote") $on("ideaPreviewOpenQuote", "click", () => { closeModal(); if (item.noteId && getNote(item.noteId)) openNote(item.noteId); else toast("연결된 메모를 찾을 수 없어요"); });
    if (item.kind === "file") $on("ideaPreviewDownload", "click", () => { if (item.fileId) downloadAttachment(item.fileId); });
    if (["image","audio","video"].includes(item.kind)) void hydrateIdeaPreviewMedia(item);
  }
  async function hydrateIdeaPreviewMedia(item) {
    const target = $("ideaPreviewMedia"); if (!target) return; const url = await ideaFileUrl(item.fileId); if (!url || !target.isConnected) { target.textContent = "파일을 찾을 수 없어요"; return; }
    let media;
    if (item.kind === "image") { media = document.createElement("img"); media.src = url; media.alt = item.title || "이미지"; }
    else if (item.kind === "audio") { media = document.createElement("audio"); media.src = url; media.controls = true; media.preload = "metadata"; }
    else { media = document.createElement("video"); media.src = url; media.controls = true; media.preload = "metadata"; media.playsInline = true; }
    target.replaceChildren(media);
  }
  function focusIdeaItem(id) {
    const n = currentIdeaNote(); if (!n) return; const d = ensureIdeaBoardData(n); d.viewMode = "board"; ideaViewMode = "board"; renderIdeaBoard();
    requestAnimationFrame(() => { const el = ideaItemElement(id); if (!el) return; selectIdeaItem(id, null); const wrap = $("ideaStageWrap"); wrap.scrollTo({ left:Math.max(0,el.offsetLeft*ideaZoom-wrap.clientWidth/2+el.offsetWidth*ideaZoom/2), top:Math.max(0,el.offsetTop*ideaZoom-wrap.clientHeight/2+el.offsetHeight*ideaZoom/2), behavior:"smooth" }); });
    scheduleIdeaSave();
  }
  function setIdeaView(mode) {
    const n = currentIdeaNote(); if (!n) return; const d = ensureIdeaBoardData(n); d.viewMode = mode === "list" ? "list" : mode === "view" ? "view" : "board"; ideaViewMode = d.viewMode; if (ideaViewMode === "view") clearIdeaSelection(); renderIdeaBoard(); scheduleIdeaSave();
  }
  function ideaBoardDims() { const d = currentIdeaData(); return d ? { w:d.canvas.width, h:d.canvas.height } : { w:1600, h:1100 }; }
  function ideaStageVisibleSize() {
    const wrap = $("ideaStageWrap");
    if (!wrap) return { w:1, h:1 };
    const rect = wrap.getBoundingClientRect();
    let w = Math.max(1, wrap.clientWidth || rect.width || 1);
    let h = Math.max(1, wrap.clientHeight || rect.height || 1);
    // 모바일 브라우저의 주소창·제스처 영역 변화까지 반영합니다. CSS의 100dvh를
    // 지원하지 않는 환경에서도 실제 보이는 영역보다 크게 맞춰 아래에 빈 공간이
    // 남는 일을 막습니다.
    const vv = window.visualViewport;
    if (vv && Number.isFinite(vv.height) && vv.height > 0) {
      const visibleTop = Math.max(rect.top, vv.offsetTop || 0);
      const visibleBottom = Math.min(rect.bottom, (vv.offsetTop || 0) + vv.height);
      const visibleH = Math.max(0, visibleBottom - visibleTop);
      if (visibleH > 0) h = Math.max(1, Math.min(h, visibleH));
    }
    return { w, h };
  }
  function ideaLongAxisFitZoom() {
    const dim = ideaBoardDims(), avail = ideaStageVisibleSize();
    // 세로 화면은 보드의 세로축을, 가로 화면은 가로축을 정확히 스테이지 끝까지
    // 맞춥니다. 고정 padding을 빼지 않아 하단의 불필요한 여백이 생기지 않습니다.
    const z = avail.h >= avail.w ? avail.h / dim.h : avail.w / dim.w;
    return Math.max(IDEA_ZOOM_MIN, Math.min(IDEA_ZOOM_MAX, z));
  }
  function ideaMinAllowedZoom() { return Math.min(IDEA_ZOOM_MAX, ideaLongAxisFitZoom()); }
  function ideaClampZoom(z) {
    const value = Number(z);
    return Math.max(ideaMinAllowedZoom(), Math.min(IDEA_ZOOM_MAX, Number.isFinite(value) ? value : 1));
  }
  function applyIdeaZoom() {
    const canvas = $("ideaCanvas"), sizer = $("ideaCanvasSizer"); if (!canvas) return;
    ideaZoom = ideaClampZoom(ideaZoom);
    const dim = ideaBoardDims();
    canvas.style.transformOrigin = "0 0"; canvas.style.transform = "scale(" + ideaZoom + ")";
    if (sizer) { sizer.style.width = Math.round(dim.w * ideaZoom) + "px"; sizer.style.height = Math.round(dim.h * ideaZoom) + "px"; }
    const percent=Math.round(ideaZoom * 100);
    const lbl = $("ideaZoomLabel"); if (lbl) lbl.textContent = percent + "%";
    const input = $("ideaZoomInput"); if (input) { input.min=String(Math.round(ideaMinAllowedZoom()*100)); input.max=String(Math.round(IDEA_ZOOM_MAX*100)); if(document.activeElement!==input) input.value=String(percent); }
    const rng = $("ideaZoomRange"); if (rng) { rng.min = String(Math.round(ideaMinAllowedZoom() * 100)); if (document.activeElement !== rng) rng.value = String(percent); }
  }
  function setIdeaZoom(z, focalClientX, focalClientY, persist) {
    const wrap = $("ideaStageWrap"); if (!wrap) return;
    const raw = Number(z); if (!Number.isFinite(raw)) return;
    const nz = ideaClampZoom(raw);
    const rect = wrap.getBoundingClientRect();
    const fx = (focalClientX == null ? rect.left + rect.width / 2 : focalClientX) - rect.left;
    const fy = (focalClientY == null ? rect.top + rect.height / 2 : focalClientY) - rect.top;
    const cx = (wrap.scrollLeft + fx) / ideaZoom, cy = (wrap.scrollTop + fy) / ideaZoom;
    ideaZoom = nz; applyIdeaZoom();
    wrap.scrollLeft = Math.max(0, cx * ideaZoom - fx); wrap.scrollTop = Math.max(0, cy * ideaZoom - fy);
    const d = currentIdeaData(); if (d) {
      // 수동 확대·축소 또는 핀치는 자동 화면 맞춤을 해제합니다.
      d.canvas.fitMode = false;
      d.canvas.zoom = ideaZoom;
      if (persist !== false) scheduleIdeaSave(700);
    }
  }
  function ideaZoomFit() {
    const wrap = $("ideaStageWrap"); if (!wrap) return;
    ideaZoom = ideaLongAxisFitZoom(); applyIdeaZoom();
    wrap.scrollLeft = 0; wrap.scrollTop = 0;
    const d = currentIdeaData(); if (d) {
      d.canvas.fitMode = true;
      d.canvas.zoom = ideaZoom;
      scheduleIdeaSave(700);
    }
    const rng = $("ideaZoomRange"); if (rng) rng.value = String(Math.round(ideaZoom * 100));
    toast("화면에 맞췄어요 (" + Math.round(ideaZoom * 100) + "%)");
  }
  function ideaSnapTargets(d, excludedIds) {
    const excluded = new Set(excludedIds || []);
    const targetsX = [d.canvas.width / 2], targetsY = [d.canvas.height / 2];
    d.items.forEach((it) => {
      if (!it || excluded.has(it.id)) return;
      targetsX.push(it.x, it.x + it.w / 2, it.x + it.w);
      targetsY.push(it.y, it.y + it.h / 2, it.y + it.h);
    });
    return { targetsX, targetsY };
  }
  function ideaSnapBounds(bounds, d, excludedIds) {
    if (!ideaSnapOn || !bounds || !d) return null;
    const TH = 8 / Math.max(ideaZoom || 1, IDEA_ZOOM_MIN);
    const { targetsX, targetsY } = ideaSnapTargets(d, excludedIds);
    const edgesX = [bounds.x, bounds.x + bounds.w / 2, bounds.x + bounds.w];
    const edgesY = [bounds.y, bounds.y + bounds.h / 2, bounds.y + bounds.h];
    let bestX = null, bestY = null, guideX = null, guideY = null;
    edgesX.forEach((edge) => targetsX.forEach((target) => {
      const diff = target - edge;
      if (Math.abs(diff) <= TH && (bestX === null || Math.abs(diff) < Math.abs(bestX))) { bestX = diff; guideX = target; }
    }));
    edgesY.forEach((edge) => targetsY.forEach((target) => {
      const diff = target - edge;
      if (Math.abs(diff) <= TH && (bestY === null || Math.abs(diff) < Math.abs(bestY))) { bestY = diff; guideY = target; }
    }));
    return { dx:bestX || 0, dy:bestY || 0, guideX, guideY };
  }
  function ideaSnapResizeBounds(bounds, d, excludedIds) {
    if (!ideaSnapOn || !bounds || !d) return null;
    const TH = 8 / Math.max(ideaZoom || 1, IDEA_ZOOM_MIN);
    const { targetsX, targetsY } = ideaSnapTargets(d, excludedIds);
    const edgesX = [bounds.x + bounds.w / 2, bounds.x + bounds.w];
    const edgesY = [bounds.y + bounds.h / 2, bounds.y + bounds.h];
    let bestX = null, bestY = null, guideX = null, guideY = null;
    edgesX.forEach((edge) => targetsX.forEach((target) => {
      const diff = target - edge;
      if (Math.abs(diff) <= TH && (bestX === null || Math.abs(diff) < Math.abs(bestX))) { bestX = diff; guideX = target; }
    }));
    edgesY.forEach((edge) => targetsY.forEach((target) => {
      const diff = target - edge;
      if (Math.abs(diff) <= TH && (bestY === null || Math.abs(diff) < Math.abs(bestY))) { bestY = diff; guideY = target; }
    }));
    return { dw:bestX || 0, dh:bestY || 0, guideX, guideY, snapped:bestX !== null || bestY !== null };
  }
  function ideaSnapPosition(fresh, d) {
    if (!fresh) return null;
    return ideaSnapBounds({ x:fresh.x, y:fresh.y, w:fresh.w, h:fresh.h }, d, [fresh.id]);
  }
  function ideaSnapResize(fresh, d, start, excludedIds) {
    if (!ideaSnapOn || !fresh || !d) return;
    const snap = ideaSnapResizeBounds({ x:fresh.x, y:fresh.y, w:fresh.w, h:fresh.h }, d, excludedIds || [fresh.id]);
    if (snap && snap.snapped) {
      const lock=!!fresh.lockAspect, aspect=(start&&start.aspect)||fresh.aspect||fresh.w/fresh.h;
      let w=fresh.w+snap.dw, h=fresh.h+snap.dh;
      if(lock){
        if(snap.dw && !snap.dh) h=w/aspect;
        else if(snap.dh && !snap.dw) w=h*aspect;
      }
      const size=ideaClampItemSize(fresh.kind,w,h);
      fresh.w=size.w; fresh.h=size.h;
      showIdeaSnapGuides(snap.guideX, snap.guideY);
    } else clearIdeaSnapGuides();
  }
  function showIdeaSnapGuides(guideX, guideY) {
    const canvas = $("ideaCanvas"); if (!canvas) return;
    let gx = canvas.querySelector(".idea-snap-guide.gx"), gy = canvas.querySelector(".idea-snap-guide.gy");
    if (guideX != null) { if (!gx) { gx = document.createElement("div"); gx.className = "idea-snap-guide gx"; canvas.appendChild(gx); } gx.style.left = guideX + "px"; gx.style.display = "block"; } else if (gx) gx.style.display = "none";
    if (guideY != null) { if (!gy) { gy = document.createElement("div"); gy.className = "idea-snap-guide gy"; canvas.appendChild(gy); } gy.style.top = guideY + "px"; gy.style.display = "block"; } else if (gy) gy.style.display = "none";
  }
  function clearIdeaSnapGuides() { const canvas = $("ideaCanvas"); if (canvas) canvas.querySelectorAll(".idea-snap-guide").forEach((g) => g.remove()); }
  function boardPointFromEvent(e) {
    const canvas = $("ideaCanvas"), rect = canvas.getBoundingClientRect();
    return { x: Math.max(0,Math.round((e.clientX-rect.left)*canvas.offsetWidth/rect.width)), y: Math.max(0,Math.round((e.clientY-rect.top)*canvas.offsetHeight/rect.height)) };
  }
  function boardDeltaFromEvent(dx,dy) {
    const canvas = $("ideaCanvas"), rect = canvas.getBoundingClientRect();
    return { x: dx * canvas.offsetWidth / rect.width, y: dy * canvas.offsetHeight / rect.height };
  }
  function nextIdeaZ(d) { return Math.max(0,...d.items.map((item)=>Number(item.z)||0))+1; }
  function findIdeaDropPosition(d, size) {
    const w=size.w,h=size.h,candidates=[]; for(let y=42;y<d.canvas.height-h;y+=66) for(let x=42;x<d.canvas.width-w;x+=74) candidates.push({x,y});
    const intersects=(p)=>d.items.some((it)=>p.x < it.x+it.w+26 && p.x+w+26 > it.x && p.y < it.y+it.h+26 && p.y+h+26 > it.y);
    return candidates.find((p)=>!intersects(p)) || {x:42+(d.items.length%5)*56,y:42+(d.items.length%7)*48};
  }
  function addIdeaItem(kind, pos, extra) {
    if (isIdeaReadonly()) return null;
    const n=currentIdeaNote(); if (!n) return null; const d=ensureIdeaBoardData(n); pushIdeaUndo(); const def=ideaItemDefaults(kind); const p=pos || findIdeaDropPosition(d,def);
    const item=Object.assign({ id:uid(), kind, x:Math.max(0,Math.min(d.canvas.width-def.w,p.x)), y:Math.max(0,Math.min(d.canvas.height-def.h,p.y)), w:def.w, h:def.h, z:nextIdeaZ(d), rotation:0, aspect:def.w/def.h, lockAspect:(kind==="image"||kind==="video"), text:"", color:ideaPreferredColor(), noteStyle:"marker", fileId:null, noteId:null, title:"" },extra||{});
    d.items.push(normalizeIdeaItem(item)); renderIdeaBoard(); scheduleIdeaSave(); return d.items[d.items.length-1];
  }
  function removeIdeaItem(id, skipUndo) {
    if (isIdeaReadonly()) return;
    const n=currentIdeaNote(); if (!n) return; const d=ensureIdeaBoardData(n), item=d.items.find((x)=>x.id===id); if (!item) return;
    if (!ideaCanEditItem(item)) return;
    if (!skipUndo) pushIdeaUndo();
    d.items=d.items.filter((x)=>x.id!==id); if (ideaEditState.itemId === id) ideaEditState={itemId:null,mode:null};
    if (item.fileId && !d.items.some((x)=>x.fileId===item.fileId)) { d.attachments=d.attachments.filter((a)=>a.id!==item.fileId); ideaRemovedBlobIds.add(item.fileId); const url=ideaObjectUrls.get(item.fileId); if(url){try{URL.revokeObjectURL(url)}catch(e){};ideaObjectUrls.delete(item.fileId);} }
    renderIdeaBoard(); scheduleIdeaSave();
  }
  function duplicateIdeaItem(id) {
    if (isIdeaReadonly()) return null;
    const n=currentIdeaNote(), d=currentIdeaData(), src=getIdeaItem(id); if(!n||!d||!src) return null;
    if (!ideaCanEditItem(src)) return null;
    pushIdeaUndo();
    const clone=normalizeIdeaItem(Object.assign({}, src, { id:uid(), groupId:null, locked:false, lockMode:null, z:nextIdeaZ(d),
      x:Math.max(0,Math.min(d.canvas.width-(src.w||120), (Number(src.x)||0)+24)),
      y:Math.max(0,Math.min(d.canvas.height-(src.h||60), (Number(src.y)||0)+24)) }));
    d.items.push(clone); renderIdeaBoard(); scheduleIdeaSave(0);
    requestAnimationFrame(()=>{ selectIdeaItem(clone.id,null); const el=ideaItemElement(clone.id); if(el&&el.focus)el.focus(); });
    toast("조각을 복제했어요"); return clone;
  }
  function reorderIdeaItem(id, toFront) {
    if (isIdeaReadonly()) return;
    const d=currentIdeaData(), it=getIdeaItem(id); if(!d||!it) return;
    if (!ideaCanEditItem(it)) return;
    pushIdeaUndo();
    // z는 normalizeIdeaItem에서 최소 1로 보정되므로, 1..n으로 재배열해 항상 유효하게 유지합니다.
    const others=d.items.filter((x)=>x.id!==id).sort((a,b)=>(Number(a.z)||0)-(Number(b.z)||0));
    const ordered=toFront?[...others,it]:[it,...others];
    ordered.forEach((x,i)=>{ x.z=i+1; });
    renderIdeaBoard(); scheduleIdeaSave(0);
    requestAnimationFrame(()=>{ selectIdeaItem(id, ideaEditState.mode); const el=ideaItemElement(id); if(el&&el.focus)el.focus(); });
    toast(toFront?"맨 앞으로 가져왔어요":"맨 뒤로 보냈어요");
  }
  function selectIdeaItem(id, mode) {
    if (isIdeaReadonly()) { clearIdeaSelection(); return; }
    const item=getIdeaItem(id);
    ideaEditState = { itemId:id, groupId:item && item.groupId ? item.groupId : null, mode:mode || null };
    const canvas=$("ideaCanvas");
    canvas.querySelectorAll(".idea-item.selected,.idea-item.group-selected").forEach((x)=>x.classList.remove("selected","group-selected","move-mode"));
    canvas.querySelector(".idea-group-box")?.remove();
    if (ideaEditState.groupId) canvas.querySelectorAll(".idea-item").forEach((node)=>{const it=getIdeaItem(node.dataset.itemId);if(it&&it.groupId===ideaEditState.groupId)node.classList.add("group-selected");});
    const el=ideaItemElement(id); if (el) { el.classList.add("selected"); if(mode==="move")el.classList.add("move-mode"); }
    mountIdeaTransformControls(id);
  }
  function clearIdeaSelection() { ideaEditState={itemId:null,groupId:null,mode:null}; const c=$("ideaCanvas"); if(c)c.querySelectorAll(".idea-item.selected,.idea-item.group-selected").forEach((x)=>x.classList.remove("selected","group-selected","move-mode")); c&&c.querySelector(".idea-transform-tools")?.remove(); c&&c.querySelector(".idea-group-box")?.remove(); }
  function expandIdeaGroupSelectionIds(ids) {
    const d=currentIdeaData(), requested=new Set([...(ids||[])].filter(Boolean));
    if(!d) return requested;
    const groupIds=new Set();
    d.items.forEach((item)=>{ if(requested.has(item.id) && item.groupId) groupIds.add(item.groupId); });
    if(groupIds.size) d.items.forEach((item)=>{ if(item.groupId && groupIds.has(item.groupId)) requested.add(item.id); });
    return requested;
  }
  function selectedIdeaItems() { const d=currentIdeaData(); return d ? d.items.filter((item)=>ideaSelectedIds.has(item.id)) : []; }
  function ideaItemsBounds(items) {
    const list=(items||[]).filter(Boolean); if(!list.length)return null;
    const left=Math.min(...list.map((x)=>x.x)), top=Math.min(...list.map((x)=>x.y));
    const right=Math.max(...list.map((x)=>x.x+x.w)), bottom=Math.max(...list.map((x)=>x.y+x.h));
    return { x:left, y:top, w:right-left, h:bottom-top, right, bottom };
  }
  function updateIdeaMultiButton() { const btn=$("ideaMultiToggle"); if(btn){btn.setAttribute("aria-pressed",String(ideaMultiSelectMode));btn.classList.toggle("on",ideaMultiSelectMode);} }
  function setIdeaMultiSelectMode(on) {
    if(isIdeaReadonly())return;
    ideaMultiSelectMode=!!on;
    ideaMultiToolsExpanded=null;
    if(!ideaMultiSelectMode) ideaSelectedIds.clear();
    clearIdeaSelection();
    updateIdeaMultiButton();
    // 조각별 포인터 핸들러는 렌더 시점의 모드를 기준으로 붙습니다.
    // 클래스만 바꾸면 단일선택 핸들러가 남으므로, 다중선택 전환 때는 반드시 재바인드합니다.
    renderIdeaBoard();
    toast(ideaMultiSelectMode?"다중선택 ON":"다중선택 OFF");
  }
  function setIdeaMultiSelection(ids) { ideaSelectedIds=expandIdeaGroupSelectionIds(ids); applyIdeaMultiSelectionClasses(); renderIdeaMultiTools(); }
  function toggleIdeaMultiItem(id) {
    if(!id)return;
    const d=currentIdeaData(), item=d&&d.items.find((it)=>it.id===id);
    if(!item)return;
    const memberIds=item.groupId ? d.items.filter((it)=>it.groupId===item.groupId).map((it)=>it.id) : [id];
    const allSelected=memberIds.every((memberId)=>ideaSelectedIds.has(memberId));
    memberIds.forEach((memberId)=>{ if(allSelected)ideaSelectedIds.delete(memberId); else ideaSelectedIds.add(memberId); });
    ideaSelectedIds=expandIdeaGroupSelectionIds(ideaSelectedIds);
    applyIdeaMultiSelectionClasses(); renderIdeaMultiTools();
  }
  function applyIdeaMultiSelectionClasses() {
    const canvas=$("ideaCanvas"); if(!canvas)return;
    const d=currentIdeaData(), valid=new Set(d?d.items.map((i)=>i.id):[]);
    [...ideaSelectedIds].forEach((id)=>{if(!valid.has(id))ideaSelectedIds.delete(id);});
    canvas.querySelectorAll(".idea-item").forEach((el)=>{
      const selected=ideaSelectedIds.has(el.dataset.itemId);
      el.classList.toggle("multi-selected",selected);
      el.setAttribute("aria-selected",selected?"true":"false");
    });
  }
  function selectionHasGroupedItem() { return selectedIdeaItems().some((item)=>!!item.groupId); }
  function allIdeaItemsSelected() { const d=currentIdeaData(); return !!(d && d.items.length && d.items.every((item)=>ideaSelectedIds.has(item.id))); }
  function renderIdeaMultiTools() {
    const wrap=$("ideaStageWrap"); if(!wrap)return; wrap.querySelector(".idea-multi-tools")?.remove();
    if(!ideaMultiSelectMode || isIdeaReadonly())return;
    const count=ideaSelectedIds.size, all=allIdeaItemsSelected(), canArrange=count>=2, canSpace=count>=3;
    const hasGroup=selectionHasGroupedItem();
    const lockLabel=count && selectedIdeaItems().every((item)=>ideaIsLocked(item))?"잠금 해제":"잠금";
    const alignOpen=ideaMultiToolsExpanded==="align", groupOpen=ideaMultiToolsExpanded==="group";
    const tools=document.createElement("div"); tools.className="idea-multi-tools";
    tools.innerHTML=`
      <div class="idea-multi-tools-head"><span>${count?`${count}개 선택`:'요소를 터치해 선택'}</span></div>
      <div class="idea-multi-tools-main">
        <button type="button" data-multi="all" class="${all?'active':''}">${all?'전체해제':'전체선택'}</button>
        <button type="button" data-multi="align" class="${alignOpen?'active':''}" ${canArrange?'':'disabled'}>정렬</button>
        <button type="button" data-multi="group" class="${groupOpen?'active':''}" ${count?'':'disabled'}>그룹</button>
        <button type="button" data-multi="lock" ${count?'':''}>${lockLabel}</button>
        <button type="button" data-multi="duplicate" ${count?'':'disabled'}>선택 복제</button>
        <button type="button" data-multi="delete" class="danger" ${count?'':'disabled'}>선택 삭제</button>
      </div>
      <div class="idea-multi-popover ${alignOpen?'open':''}" data-multi-panel="align" ${alignOpen?'':'hidden'}>
        <span class="idea-multi-popover-label">정렬</span>
        <button type="button" data-multi="left" ${canArrange?'':'disabled'}>왼쪽</button>
        <button type="button" data-multi="cx" ${canArrange?'':'disabled'}>가로 중앙</button>
        <button type="button" data-multi="right" ${canArrange?'':'disabled'}>오른쪽</button>
        <button type="button" data-multi="top" ${canArrange?'':'disabled'}>위</button>
        <button type="button" data-multi="cy" ${canArrange?'':'disabled'}>세로 중앙</button>
        <button type="button" data-multi="bottom" ${canArrange?'':'disabled'}>아래</button>
        <span class="idea-multi-popover-divider"></span>
        <button type="button" data-multi="space-x" ${canSpace?'':'disabled'}>가로 간격</button>
        <button type="button" data-multi="space-y" ${canSpace?'':'disabled'}>세로 간격</button>
      </div>
      <div class="idea-multi-popover ${groupOpen?'open':''}" data-multi-panel="group" ${groupOpen?'':'hidden'}>
        <span class="idea-multi-popover-label">그룹</span>
        <button type="button" data-multi="group-apply" ${count>=2?'':'disabled'}>그룹화</button>
        <button type="button" data-multi="group-remove" ${hasGroup?'':'disabled'}>그룹 해제</button>
      </div>`;
    tools.addEventListener("pointerdown",(e)=>e.stopPropagation());
    tools.addEventListener("click",(e)=>{
      const b=e.target.closest("button[data-multi]"); if(!b||b.disabled)return;
      const action=b.dataset.multi;
      if(action==="all") selectAllIdeaItems();
      else if(action==="align"||action==="group") { ideaMultiToolsExpanded=ideaMultiToolsExpanded===action?null:action; renderIdeaMultiTools(); }
      else if(["left","cx","right","top","cy","bottom"].includes(action)) alignIdeaSelection(action);
      else if(action==="space-x") distributeIdeaSelection("x");
      else if(action==="space-y") distributeIdeaSelection("y");
      else if(action==="group-apply") groupIdeaSelection();
      else if(action==="group-remove") ungroupIdeaSelection();
      else if(action==="lock") toggleLockIdeaSelection();
      else if(action==="duplicate") duplicateIdeaSelection();
      else if(action==="delete") deleteIdeaSelection();
    });
    wrap.appendChild(tools);
  }
  function selectAllIdeaItems() {
    const d=currentIdeaData(); if(!d)return;
    setIdeaMultiSelection(allIdeaItemsSelected()?[]:d.items.map((i)=>i.id));
  }
  function alignIdeaSelection(type) {
    const items=selectedIdeaItems().filter((i)=>!ideaIsLocked(i)); if(items.length<2){toast("잠기지 않은 조각을 2개 이상 선택하세요");return;}
    const b=ideaItemsBounds(items); if(!b)return; pushIdeaUndo();
    items.forEach((it)=>{ if(type==="left")it.x=b.x; else if(type==="right")it.x=b.right-it.w; else if(type==="cx")it.x=b.x+(b.w-it.w)/2; else if(type==="top")it.y=b.y; else if(type==="bottom")it.y=b.bottom-it.h; else if(type==="cy")it.y=b.y+(b.h-it.h)/2; it.x=Math.round(it.x); it.y=Math.round(it.y); const el=ideaItemElement(it.id); if(el)setIdeaItemGeometry(el,it); });
    scheduleIdeaSave(0); applyIdeaMultiSelectionClasses(); toast("정렬했어요");
  }
  function distributeIdeaSelection(axis) {
    const items=selectedIdeaItems().filter((i)=>!ideaIsLocked(i)); if(items.length<3){toast("간격맞춤은 잠기지 않은 조각 3개 이상에서 사용할 수 있어요");return;}
    const key=axis==="x"?"x":"y", sizeKey=axis==="x"?"w":"h";
    const ordered=items.slice().sort((a,b)=>(a[key]-b[key])||((a.z||0)-(b.z||0)));
    const first=ordered[0], last=ordered[ordered.length-1];
    const span=(last[key]+last[sizeKey])-first[key], total=ordered.reduce((sum,it)=>sum+it[sizeKey],0);
    const gap=Math.max(0,(span-total)/(ordered.length-1));
    pushIdeaUndo(); let cursor=first[key];
    ordered.forEach((it,index)=>{ if(index===0){cursor=it[key]+it[sizeKey]+gap;return;} it[key]=Math.round(cursor);cursor=it[key]+it[sizeKey]+gap;const el=ideaItemElement(it.id);if(el)setIdeaItemGeometry(el,it); });
    scheduleIdeaSave(0); applyIdeaMultiSelectionClasses(); toast(axis==="x"?"가로 간격을 맞췄어요":"세로 간격을 맞췄어요");
  }
  function groupIdeaSelection() {
    {
      const selected=selectedIdeaItems(), lockedCount=selected.filter((i)=>ideaIsLocked(i)).length;
      const items=selected.filter((i)=>!ideaIsLocked(i));
      if(items.length<2){toast("잠금되지 않은 조각을 2개 이상 선택해 주세요");return;}
      pushIdeaUndo();
      const gid=uid();
      items.forEach((it)=>{it.groupId=gid;});
      scheduleIdeaSave(0);
      renderIdeaBoard();
      setIdeaMultiSelection(items.map((i)=>i.id));
      toast("선택한 조각을 그룹화했어요");
      if(lockedCount) setTimeout(()=>toast(`잠금 조각 ${lockedCount}개는 그룹에서 제외했어요`),120);
      return;
    }
    const items=selectedIdeaItems().filter((i)=>!ideaIsLocked(i)); if(items.length<2){toast("잠기지 않은 조각을 2개 이상 선택하세요");return;}
    pushIdeaUndo(); const gid=uid(); items.forEach((it)=>{it.groupId=gid;}); scheduleIdeaSave(0); renderIdeaBoard(); setIdeaMultiSelection(items.map((i)=>i.id)); toast("선택한 조각을 그룹화했어요");
  }
  function ungroupIdeaSelection() {
    const items=selectedIdeaItems().filter((i)=>!ideaIsLocked(i)&&i.groupId); if(!items.length){toast("해제할 그룹이 없어요");return;}
    pushIdeaUndo(); items.forEach((it)=>{it.groupId=null;}); scheduleIdeaSave(0); renderIdeaBoard(); setIdeaMultiSelection(items.map((i)=>i.id)); toast("그룹을 풀었어요");
  }
  function toggleLockIdeaSelection() {
    const items=selectedIdeaItems(); if(!items.length)return; pushIdeaUndo(); const lock=items.some((it)=>!ideaIsLocked(it)); items.forEach((it)=>{setIdeaLockMode(it,lock?"full":null);}); scheduleIdeaSave(0); renderIdeaBoard(); setIdeaMultiSelection(items.map((i)=>i.id)); toast(lock?"선택 조각을 잠갔어요":"선택 조각 잠금을 해제했어요");
  }
  function duplicateIdeaSelection() {
    const d=currentIdeaData(), items=selectedIdeaItems(); if(!d||!items.length)return;
    pushIdeaUndo();
    const clones=items.map((src,index)=>normalizeIdeaItem(Object.assign({},src,{id:uid(),groupId:null,locked:false,lockMode:null,z:nextIdeaZ(d)+index,x:Math.max(0,Math.min(d.canvas.width-(src.w||90),(Number(src.x)||0)+24)),y:Math.max(0,Math.min(d.canvas.height-(src.h||40),(Number(src.y)||0)+24))})));
    d.items.push(...clones); scheduleIdeaSave(0); renderIdeaBoard(); setIdeaMultiSelection(clones.map((item)=>item.id)); toast(`${clones.length}개 조각을 복제했어요`);
  }
  function deleteIdeaSelection() {
    const d=currentIdeaData(), items=selectedIdeaItems().filter((item)=>!ideaIsLocked(item)); if(!d||!items.length){toast("잠긴 조각은 먼저 잠금을 해제하세요");return;}
    confirmModal("선택 조각 삭제", `${items.length}개 조각을 보드에서 삭제할까요?`, "삭제", true, ()=>{
      pushIdeaUndo(); const ids=new Set(items.map((item)=>item.id));
      const removedFileIds=items.map((item)=>item.fileId).filter(Boolean);
      d.items=d.items.filter((item)=>!ids.has(item.id));
      removedFileIds.forEach((fileId)=>{if(!d.items.some((item)=>item.fileId===fileId)){d.attachments=d.attachments.filter((a)=>a.id!==fileId);ideaRemovedBlobIds.add(fileId);}});
      ideaSelectedIds.clear(); scheduleIdeaSave(0); renderIdeaBoard(); toast(`${items.length}개 조각을 삭제했어요`);
    });
  }
  function positionIdeaTransformControls(el, item) {
    const d=currentIdeaData(); if(!el || !item || !d) return;
    // 상단에 붙인 메모지는 위쪽 핸들이 캔버스 밖으로 나가므로 아래쪽으로 피합니다.
    el.classList.toggle("idea-tools-below", Number(item.y) < 92);
    // 우하단에 맞닿은 조각은 리사이즈 핸들을 안쪽으로 옮겨서 항상 누를 수 있게 합니다.
    el.classList.toggle("idea-tools-inset", Number(item.x) + Number(item.w) > d.canvas.width - 26 || Number(item.y) + Number(item.h) > d.canvas.height - 26);
  }
  function mountIdeaTransformControls(id) {
    if (isIdeaReadonly()) return;
    const item=getIdeaItem(id), el=ideaItemElement(id); if(!item||!el)return;
    $("ideaCanvas").querySelectorAll(".idea-transform-tools").forEach((x)=>x.remove());
    $("ideaCanvas").querySelector(".idea-group-box")?.remove();
    if(item.groupId){ mountIdeaGroupTransformControls(item.groupId); return; }
    el.classList.add("selected"); positionIdeaTransformControls(el,item);
    const grip=(corner,label)=>`<button type="button" class="idea-resize-handle corner-${corner}" data-corner="${corner}" aria-label="${label} 크기 조절"><span></span></button>`;
    const tools=document.createElement("div"); tools.className="idea-transform-tools"; tools.innerHTML=`<button type="button" class="idea-move-handle" aria-label="이동"><svg viewBox="0 0 24 24"><path d="M12 3v18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3"/><path d="M3 12h18M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3"/></svg></button><button type="button" class="idea-option-dot" aria-label="조각 옵션"><svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="19" cy="12" r="1.7"/></svg></button><button type="button" class="idea-rotate-handle" aria-label="회전"><svg viewBox="0 0 24 24"><path d="M20 11.5a8 8 0 1 1-2.1-5.4"/><path d="M20.5 3.5v4h-4"/></svg></button>${grip("tl","왼쪽 위")}${grip("tr","오른쪽 위")}${grip("bl","왼쪽 아래")}${grip("br","오른쪽 아래")}`;
    el.appendChild(tools);
    tools.querySelector(".idea-option-dot").addEventListener("pointerdown",(e)=>e.stopPropagation());
    tools.querySelector(".idea-option-dot").addEventListener("click",(e)=>{e.stopPropagation();openIdeaItemOptions(id);});
    bindIdeaMoveHandle(tools.querySelector(".idea-move-handle"),item,el);
    tools.querySelectorAll(".idea-resize-handle").forEach((handle)=>bindIdeaResizeHandle(handle,item,el,handle.dataset.corner||"br"));
    bindIdeaRotateHandle(tools.querySelector(".idea-rotate-handle"),item,el);
  }
  function ideaGroupItems(groupId) { const d=currentIdeaData(); return d && groupId ? d.items.filter((it)=>it.groupId===groupId) : []; }
  function mountIdeaGroupTransformControls(groupId) {
    const canvas=$("ideaCanvas"), items=ideaGroupItems(groupId); if(!canvas||!items.length)return;
    canvas.querySelector(".idea-group-box")?.remove();
    const b=ideaItemsBounds(items); if(!b)return;
    const box=document.createElement("div"); box.className="idea-group-box"; box.dataset.groupId=groupId; box.style.left=b.x+"px"; box.style.top=b.y+"px"; box.style.width=b.w+"px"; box.style.height=b.h+"px"; box.style.zIndex=Math.max(...items.map((i)=>i.z||1))+2;
    const tools=document.createElement("div"); tools.className="idea-transform-tools"; tools.innerHTML=`<button type="button" class="idea-option-dot" aria-label="그룹 옵션"><svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="19" cy="12" r="1.7"/></svg></button><button type="button" class="idea-move-handle" aria-label="그룹 이동"><svg viewBox="0 0 24 24"><path d="M12 3v18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3"/><path d="M3 12h18M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3"/></svg></button><button type="button" class="idea-resize-handle" aria-label="그룹 크기 조절"><svg viewBox="0 0 24 24"><path d="M14 20h6v-6"/><path d="M20 20l-8.5-8.5"/></svg></button>`;
    box.appendChild(tools); canvas.appendChild(box);
    tools.querySelector(".idea-option-dot").addEventListener("pointerdown",(e)=>e.stopPropagation());
    tools.querySelector(".idea-option-dot").addEventListener("click",(e)=>{e.stopPropagation();openIdeaGroupOptions(groupId);});
    bindIdeaGroupMoveHandle(tools.querySelector(".idea-move-handle"),groupId,box);
    bindIdeaGroupResizeHandle(tools.querySelector(".idea-resize-handle"),groupId,box);
  }
  function updateIdeaGroupBoxGeometry(box,groupId) {
    if(!box)return;
    const items=ideaGroupItems(groupId), b=ideaItemsBounds(items); if(!b)return;
    box.style.left=b.x+"px"; box.style.top=b.y+"px"; box.style.width=b.w+"px"; box.style.height=b.h+"px";
    box.style.zIndex=Math.max(...items.map((it)=>it.z||1))+2;
  }
  function bindIdeaGroupMoveHandle(handle,groupId,box) {
    handle.addEventListener("pointerdown",(e)=>{
      if(e.button!=null&&e.button!==0)return;e.preventDefault();e.stopPropagation();
      const d=currentIdeaData(), items=ideaGroupItems(groupId); if(!d||!items.length)return;
      if(items.some((it)=>ideaIsLocked(it))){toast("잠긴 조각이 포함된 그룹입니다. 먼저 그룹 잠금을 해제하세요.");return;}
      const bounds=ideaItemsBounds(items); if(!bounds)return;
      const memberIds=new Set(items.map((it)=>it.id));
      const start={x:e.clientX,y:e.clientY,bounds,items:items.map((it)=>({id:it.id,x:it.x,y:it.y}))}; const snap=ideaSnapshot(); let pushed=false;
      const limitX=(value)=>Math.max(-start.bounds.x,Math.min(d.canvas.width-start.bounds.right,value));
      const limitY=(value)=>Math.max(-start.bounds.y,Math.min(d.canvas.height-start.bounds.bottom,value));
      const apply=(dx,dy)=>items.forEach((it)=>{const row=start.items.find((x)=>x.id===it.id);it.x=Math.round(row.x+dx);it.y=Math.round(row.y+dy);const node=ideaItemElement(it.id);if(node)setIdeaItemGeometry(node,it);});
      try{handle.setPointerCapture(e.pointerId);}catch(_e){}
      const move=(ev)=>{
        if(ev.pointerId!==e.pointerId)return;
        if(!pushed){pushIdeaUndo(snap);pushed=true;}
        const raw=boardDeltaFromEvent(ev.clientX-start.x,ev.clientY-start.y);
        let dx=limitX(raw.x),dy=limitY(raw.y);
        if(ideaSnapOn){
          const snapped=ideaSnapBounds({x:start.bounds.x+dx,y:start.bounds.y+dy,w:start.bounds.w,h:start.bounds.h},d,memberIds);
          if(snapped){
            dx=limitX(dx+snapped.dx);dy=limitY(dy+snapped.dy);
            showIdeaSnapGuides(snapped.guideX,snapped.guideY);
          }
        } else clearIdeaSnapGuides();
        apply(dx,dy);updateIdeaGroupBoxGeometry(box,groupId);scheduleIdeaSave(220);ev.preventDefault();
      };
      const end=(ev)=>{if(ev&&ev.pointerId!=null&&ev.pointerId!==e.pointerId)return;document.removeEventListener("pointermove",move);document.removeEventListener("pointerup",end);document.removeEventListener("pointercancel",end);clearIdeaSnapGuides();scheduleIdeaSave(0);};
      document.addEventListener("pointermove",move,{passive:false});document.addEventListener("pointerup",end);document.addEventListener("pointercancel",end);handle.addEventListener("lostpointercapture",end,{once:true});
    });
  }
  function bindIdeaGroupResizeHandle(handle,groupId,box) {
    handle.addEventListener("pointerdown",(e)=>{
      if(e.button!=null&&e.button!==0)return;e.preventDefault();e.stopPropagation();
      const d=currentIdeaData(),items=ideaGroupItems(groupId); if(!d||!items.length)return;
      if(items.some((it)=>ideaIsLocked(it))){toast("잠긴 조각이 포함된 그룹입니다. 먼저 그룹 잠금을 해제하세요.");return;}
      const b=ideaItemsBounds(items); if(!b)return;
      const memberIds=new Set(items.map((it)=>it.id));
      const start={x:e.clientX,y:e.clientY,b,items:items.map((it)=>({id:it.id,x:it.x,y:it.y,w:it.w,h:it.h}))}; const snap=ideaSnapshot(); let pushed=false;
      const minScaleX=Math.max(...start.items.map((row)=>ideaItemMinSize((d.items.find((it)=>it.id===row.id)||{}).kind||"note").w/Math.max(1,row.w)));
      const minScaleY=Math.max(...start.items.map((row)=>ideaItemMinSize((d.items.find((it)=>it.id===row.id)||{}).kind||"note").h/Math.max(1,row.h)));
      const apply=(nw,nh)=>{
        const sx=nw/start.b.w,sy=nh/start.b.h;
        items.forEach((it)=>{const row=start.items.find((x)=>x.id===it.id);it.x=Math.round(start.b.x+(row.x-start.b.x)*sx);it.y=Math.round(start.b.y+(row.y-start.b.y)*sy);it.w=Math.round(row.w*sx);it.h=Math.round(row.h*sy);it.aspect=Math.max(.08,Math.min(20,it.w/Math.max(1,it.h)));const node=ideaItemElement(it.id);if(node)setIdeaItemGeometry(node,it);});
      };
      try{handle.setPointerCapture(e.pointerId);}catch(_e){}
      const move=(ev)=>{
        if(ev.pointerId!==e.pointerId)return;
        if(!pushed){pushIdeaUndo(snap);pushed=true;}
        const delta=boardDeltaFromEvent(ev.clientX-start.x,ev.clientY-start.y);
        let nw=Math.max(start.b.w*minScaleX,Math.min(d.canvas.width-start.b.x,start.b.w+delta.x));
        let nh=Math.max(start.b.h*minScaleY,Math.min(d.canvas.height-start.b.y,start.b.h+delta.y));
        if(ideaSnapOn){
          const snapped=ideaSnapResizeBounds({x:start.b.x,y:start.b.y,w:nw,h:nh},d,memberIds);
          if(snapped && snapped.snapped){
            nw=Math.max(start.b.w*minScaleX,Math.min(d.canvas.width-start.b.x,nw+snapped.dw));
            nh=Math.max(start.b.h*minScaleY,Math.min(d.canvas.height-start.b.y,nh+snapped.dh));
            showIdeaSnapGuides(snapped.guideX,snapped.guideY);
          }
        } else clearIdeaSnapGuides();
        apply(nw,nh);updateIdeaGroupBoxGeometry(box,groupId);scheduleIdeaSave(220);ev.preventDefault();
      };
      const end=(ev)=>{if(ev&&ev.pointerId!=null&&ev.pointerId!==e.pointerId)return;document.removeEventListener("pointermove",move);document.removeEventListener("pointerup",end);document.removeEventListener("pointercancel",end);clearIdeaSnapGuides();scheduleIdeaSave(0);};
      document.addEventListener("pointermove",move,{passive:false});document.addEventListener("pointerup",end);document.addEventListener("pointercancel",end);handle.addEventListener("lostpointercapture",end,{once:true});
    });
  }
  function openIdeaGroupOptions(groupId) {
    const items=ideaGroupItems(groupId); if(!items.length)return; const locked=items.every((it)=>ideaIsLocked(it));
    openModal(`<h3>그룹 옵션</h3><p class="m-sub">${items.length}개 조각 그룹입니다.</p><div class="idea-options-grid"><button class="idea-options-action" id="ideaGroupLock"><b>${locked?"그룹 잠금 해제":"그룹 잠금"}</b><small>그룹 안의 모든 조각 잠금 전환</small></button><button class="idea-options-action" id="ideaGroupMove"><b>그룹 이동</b><small>그룹 박스의 이동 핸들 사용</small></button><button class="idea-options-action" id="ideaGroupUngroup"><b>그룹 풀기</b><small>조각을 다시 개별 요소로 분리</small></button></div><div class="m-row"><button class="m-btn" id="ideaGroupClose">닫기</button></div>`);
    $on("ideaGroupClose","click",closeModal);
    $on("ideaGroupLock","click",()=>{pushIdeaUndo();items.forEach((it)=>{setIdeaLockMode(it,!locked?"full":null);});scheduleIdeaSave(0);closeModal();renderIdeaBoard();});
    $on("ideaGroupMove","click",()=>{closeModal();ideaEditState={itemId:items[0].id,groupId,mode:"move"};mountIdeaGroupTransformControls(groupId);});
    $on("ideaGroupUngroup","click",()=>{if(items.some((it)=>ideaIsLocked(it))){toast("잠긴 그룹은 먼저 잠금을 해제하세요.");return;}pushIdeaUndo();items.forEach((it)=>{it.groupId=null;});scheduleIdeaSave(0);closeModal();renderIdeaBoard();});
  }
  function bindIdeaMoveHandle(handle,item,el) {
    handle.addEventListener("pointerdown",(e)=>{
      if(e.button!=null&&e.button!==0)return;
      e.preventDefault();e.stopPropagation(); const d=currentIdeaData(),fresh=d&&d.items.find((x)=>x.id===item.id);if(!fresh||!d)return;
      if(!ideaCanEditItem(fresh))return;
      const start={x:e.clientX,y:e.clientY,left:fresh.x,top:fresh.y}; const mvPreSnap=ideaSnapshot(); let mvPushed=false;
      fresh.z=nextIdeaZ(d); setIdeaItemGeometry(el,fresh); el.classList.add("dragging","move-mode");
      try{handle.setPointerCapture(e.pointerId)}catch(_e){}
      const move=(ev)=>{if(ev.pointerId!==e.pointerId)return;if(!mvPushed){pushIdeaUndo(mvPreSnap);mvPushed=true;}const delta=boardDeltaFromEvent(ev.clientX-start.x,ev.clientY-start.y);fresh.x=Math.round(Math.max(0,Math.min(d.canvas.width-fresh.w,start.left+delta.x)));fresh.y=Math.round(Math.max(0,Math.min(d.canvas.height-fresh.h,start.top+delta.y)));if(ideaSnapOn){const sn=ideaSnapPosition(fresh,d);if(sn){fresh.x=Math.round(Math.max(0,Math.min(d.canvas.width-fresh.w,fresh.x+sn.dx)));fresh.y=Math.round(Math.max(0,Math.min(d.canvas.height-fresh.h,fresh.y+sn.dy)));showIdeaSnapGuides(sn.guideX,sn.guideY);}}setIdeaItemGeometry(el,fresh);ev.preventDefault();};
      const end=(ev)=>{if(ev&&ev.pointerId!=null&&ev.pointerId!==e.pointerId)return;document.removeEventListener("pointermove",move);document.removeEventListener("pointerup",end);document.removeEventListener("pointercancel",end);el.classList.remove("dragging");if(ideaEditState.mode!=="move")el.classList.remove("move-mode");clearIdeaSnapGuides();scheduleIdeaSave(0);};
      document.addEventListener("pointermove",move,{passive:false});document.addEventListener("pointerup",end);document.addEventListener("pointercancel",end); handle.addEventListener("lostpointercapture", end, { once:true });
    });
  }
  function bindIdeaResizeHandle(handle,item,el,corner) {
    let lastTapAt = 0;
    const isLeft=()=>String(corner||"br").includes("l"), isTop=()=>String(corner||"br").includes("t");
    handle.addEventListener("pointerdown",(e)=>{
      if(e.button!=null&&e.button!==0)return;
      e.preventDefault();e.stopPropagation(); const d=currentIdeaData(), fresh=d&&d.items.find((it)=>it.id===item.id);if(!fresh||!d)return;if(!ideaCanEditItem(fresh))return;
      const start={cx:e.clientX,cy:e.clientY,w:fresh.w,h:fresh.h,x:fresh.x,y:fresh.y,rot:fresh.rotation||0,aspect:fresh.aspect||fresh.w/fresh.h,lock:fresh.lockAspect}; const rzPreSnap=ideaSnapshot(); let rzPushed=false;
      try{handle.setPointerCapture(e.pointerId)}catch(_e){}
      let moved=false;
      const move=(ev)=>{if(ev.pointerId!==e.pointerId)return;if(!rzPushed){pushIdeaUndo(rzPreSnap);rzPushed=true;}moved=true;
        const delta=boardDeltaFromEvent(ev.clientX-start.cx,ev.clientY-start.cy);const rad=-start.rot*Math.PI/180, lx=delta.x*Math.cos(rad)-delta.y*Math.sin(rad), ly=delta.x*Math.sin(rad)+delta.y*Math.cos(rad);
        let dw=(isLeft()?-1:1)*lx, dh=(isTop()?-1:1)*ly; let w=start.w+dw,h=start.h+dh;
        if(start.lock){if(Math.abs(dw)>Math.abs(dh*start.aspect))h=w/start.aspect;else w=h*start.aspect;}
        const clamped=ideaClampItemSize(fresh.kind,w,h);w=clamped.w;h=clamped.h;
        fresh.w=w;fresh.h=h;
        if(isLeft()) fresh.x=Math.round(start.x+(start.w-w)); else fresh.x=start.x;
        if(isTop()) fresh.y=Math.round(start.y+(start.h-h)); else fresh.y=start.y;
        fresh.x=Math.max(0,Math.min(d.canvas.width-fresh.w,fresh.x));fresh.y=Math.max(0,Math.min(d.canvas.height-fresh.h,fresh.y));
        if(ideaSnapOn){ideaSnapResize(fresh,d,start);}else{clearIdeaSnapGuides();}
        setIdeaItemGeometry(el,fresh);scheduleIdeaSave(220);ev.preventDefault();
      };
      const end=(ev)=>{if(ev&&ev.pointerId!=null&&ev.pointerId!==e.pointerId)return;document.removeEventListener("pointermove",move);document.removeEventListener("pointerup",end);document.removeEventListener("pointercancel",end);const at=Date.now();if(!moved&&at-lastTapAt<340){lastTapAt=0;openIdeaSizeModal(item.id);}else{lastTapAt=moved?0:at;if(moved)scheduleIdeaSave(0);}};
      document.addEventListener("pointermove",move,{passive:false});document.addEventListener("pointerup",end);document.addEventListener("pointercancel",end); handle.addEventListener("lostpointercapture", end, { once:true });
    });
  }
  function openIdeaSizeModal(id) {
    const item=getIdeaItem(id); if(!item)return;if(!ideaCanEditItem(item))return;
    const ratio=Math.max(.08,Math.min(20,(Number(item.w)||110)/Math.max(1,Number(item.h)||54)));
    const defaultLocked=(item.kind === "image" || item.kind === "video") ? item.lockAspect !== false : item.lockAspect === true;
    const lockControl=["image","video"].includes(item.kind)?`<label class="idea-size-lock"><input type="checkbox" id="ideaSizeLock" ${defaultLocked?"checked":""}><span>비율 고정</span><small>가로 또는 세로를 바꾸면 현재 비율로 함께 계산합니다.</small></label>`:"";
    const min=ideaItemMinSize(item.kind);
    openModal(`<h3>조각 크기 입력</h3><p class="m-sub">정확한 픽셀 수치를 입력해 크기를 맞춥니다.</p><div class="m-row"><input class="m-input" id="ideaSizeW" inputmode="numeric" type="number" min="${min.w}" max="1400" value="${Math.round(item.w)}" aria-label="너비"><input class="m-input" id="ideaSizeH" inputmode="numeric" type="number" min="${min.h}" max="1100" value="${Math.round(item.h)}" aria-label="높이"></div>${lockControl}<div class="m-row"><button class="m-btn" id="ideaSizeCancel">취소</button><button class="m-btn primary" id="ideaSizeApply">적용</button></div>`);
    const sync=(source)=>{const lock=$("ideaSizeLock");if(!lock||!lock.checked)return;const w=Math.max(min.w,Number($("ideaSizeW").value)||item.w),h=Math.max(min.h,Number($("ideaSizeH").value)||item.h);if(source==="w")$("ideaSizeH").value=String(Math.max(min.h,Math.min(1100,Math.round(w/ratio))));else $("ideaSizeW").value=String(Math.max(min.w,Math.min(1400,Math.round(h*ratio))));};
    $on("ideaSizeW","input",()=>sync("w"));$on("ideaSizeH","input",()=>sync("h"));
    setTimeout(()=>{const input=$("ideaSizeW");if(input){input.focus();input.select();}},80);
    $on("ideaSizeCancel","click",closeModal);
    $on("ideaSizeApply","click",()=>{const fresh=getIdeaItem(id);if(!fresh||!ideaCanEditItem(fresh))return;let w=Number($("ideaSizeW").value)||fresh.w,h=Number($("ideaSizeH").value)||fresh.h;const locked=["image","video"].includes(fresh.kind) && $("ideaSizeLock") && $("ideaSizeLock").checked;if(locked)h=w/ratio;const clamped=ideaClampItemSize(fresh.kind,w,h);pushIdeaUndo();fresh.w=clamped.w;fresh.h=clamped.h;if(["image","video"].includes(fresh.kind))fresh.lockAspect=!!locked;else fresh.lockAspect=false;fresh.aspect=Math.max(.08,Math.min(20,fresh.w/fresh.h));const el=ideaItemElement(id);if(el)setIdeaItemGeometry(el,fresh);scheduleIdeaSave(0);closeModal();toast(`크기를 ${fresh.w}×${fresh.h}px로 맞췄어요`);});
  }
  function bindIdeaRotateHandle(handle,item,el) {
    let lastTapAt = 0;
    handle.addEventListener("pointerdown",(e)=>{
      if (e.button != null && e.button !== 0) return;
      e.preventDefault(); e.stopPropagation();
      const d=currentIdeaData(), fresh=d && d.items.find((x)=>x.id===item.id); if(!fresh)return;
      if(!ideaCanEditItem(fresh))return;
      const rect=el.getBoundingClientRect(), cx=rect.left+rect.width/2,cy=rect.top+rect.height/2;
      let moved=false; const rotPreSnap=ideaSnapshot(); let rotPushed=false;
      try{handle.setPointerCapture(e.pointerId)}catch(_e){}
      const move=(ev)=>{
        if (ev.pointerId !== e.pointerId) return;
        if(!rotPushed){pushIdeaUndo(rotPreSnap);rotPushed=true;}
        moved=true;
        const deg=Math.atan2(ev.clientY-cy,ev.clientX-cx)*180/Math.PI+90;
        fresh.rotation=Math.round(((deg+180)%360+360)%360-180);
        setIdeaItemGeometry(el,fresh); ev.preventDefault();
      };
      const end=(ev)=>{
        if (ev && ev.pointerId != null && ev.pointerId !== e.pointerId) return;
        document.removeEventListener("pointermove",move);document.removeEventListener("pointerup",end);document.removeEventListener("pointercancel",end);
        const at=Date.now();
        if (!moved && at-lastTapAt < 340) {
          pushIdeaUndo(rotPreSnap); fresh.rotation=0; lastTapAt=0; setIdeaItemGeometry(el,fresh); scheduleIdeaSave(0); toast("회전을 0°로 복원했어요");
        } else {
          lastTapAt = moved ? 0 : at;
          if (moved) scheduleIdeaSave(0);
        }
      };
      document.addEventListener("pointermove",move,{passive:false});document.addEventListener("pointerup",end);document.addEventListener("pointercancel",end); handle.addEventListener("lostpointercapture", end, { once:true });
    });
  }
  function bindIdeaItemInteractions(el,item) {
    let holdTimer=null,start=null,dragging=false,dragPointerId=null,movedBeforeHold=false,dragPreSnap=null,dragUndoPushed=false,lastPointerType="";
    let suppressOptionsUntil=0,lastTouchTap=null;
    const cancelHold=()=>{clearTimeout(holdTimer);holdTimer=null;};
    const cleanupDragListeners=()=>{document.removeEventListener("pointermove",onDragMove);document.removeEventListener("pointerup",endDrag);document.removeEventListener("pointercancel",endDrag);};
    const nativeControl=(target)=>target && target.closest && target.closest("audio,video");
    const textEditor=(target)=>target && target.closest && target.closest(".idea-note-text,.idea-note-rich-tools");
    const isTransformControl=(target)=>target && target.closest && target.closest(".idea-transform-tools");
    if (isIdeaReadonly()) {
      el.addEventListener("dblclick",(e)=>{ if(textEditor(e.target)||nativeControl(e.target))return; e.preventDefault(); openIdeaArtifactPreview(item.id); });
      el.addEventListener("contextmenu",(e)=>{ if(nativeControl(e.target))return; e.preventDefault(); openIdeaArtifactPreview(item.id); });
      return;
    }
    if (ideaMultiSelectMode) {
      // 다중선택은 캡처 단계에서 먼저 잡습니다. video/audio/button 내부의 자체 핸들러가
      // 이벤트를 소비해도 조각 선택 토글이 빠지지 않도록 보장합니다.
      let lastMultiToggleAt=0;
      const toggleFromMultiPointer=(e)=>{
        if(e.button!=null&&e.button!==0)return;
        if(isTransformControl(e.target))return;
        if(Date.now()-lastMultiToggleAt<260)return;
        lastMultiToggleAt=Date.now();
        e.preventDefault(); e.stopImmediatePropagation();
        toggleIdeaMultiItem(item.id);
      };
      const toggleFromMultiTouch=(e)=>{
        if(isTransformControl(e.target))return;
        if(Date.now()-lastMultiToggleAt<260)return;
        lastMultiToggleAt=Date.now();
        e.preventDefault(); e.stopImmediatePropagation();
        toggleIdeaMultiItem(item.id);
      };
      const toggleFromMultiClick=(e)=>{
        if(isTransformControl(e.target))return;
        if(Date.now()-lastMultiToggleAt>=320) toggleIdeaMultiItem(item.id);
        e.preventDefault();e.stopImmediatePropagation();
      };
      const blockMultiClick=(e)=>{e.preventDefault();e.stopImmediatePropagation();};
      el.addEventListener("pointerdown",toggleFromMultiPointer,true);
      el.addEventListener("touchstart",toggleFromMultiTouch,{capture:true,passive:false});
      el.addEventListener("pointerup",blockMultiClick,true);
      el.addEventListener("click",toggleFromMultiClick,true);
      el.addEventListener("dblclick",blockMultiClick,true);
      return;
    }
    if (ideaIsLocked(item)) {
      el.addEventListener("pointerdown",(e)=>{if(e.button!=null&&e.button!==0)return;if(isTransformControl(e.target)||nativeControl(e.target))return;if(ideaLockMode(item)==="transform" && textEditor(e.target))return;selectIdeaItem(item.id,null);});
      el.addEventListener("dblclick",(e)=>{if(nativeControl(e.target)|| (ideaLockMode(item)==="transform" && textEditor(e.target)))return;e.preventDefault();openIdeaItemOptions(item.id);});
      el.addEventListener("contextmenu",(e)=>{if(nativeControl(e.target))return;e.preventDefault();openIdeaItemOptions(item.id);});
      return;
    }
    const canStartOn=(target, event)=>{
      if (isTransformControl(target)) return false;
      const inEditor=!!textEditor(target), inMedia=!!nativeControl(target);
      // 마우스에서는 본문 선택/재생을 우선하지만, 터치에서는 짧게 탭하면 원래 동작,
      // 길게 누르면 모든 조각을 이동할 수 있어야 합니다.
      return !(inEditor || inMedia) || ideaEditState.mode === "move" || event.pointerType !== "mouse";
    };
    const beginDrag=(e, immediate)=>{
      const d=currentIdeaData(), fresh=d && d.items.find((x)=>x.id===item.id); if(!fresh||!d)return;
      dragPreSnap=ideaSnapshot(); dragUndoPushed=false;
      start={x:e.clientX,y:e.clientY,left:fresh.x,top:fresh.y}; dragging=true; dragPointerId=e.pointerId; movedBeforeHold=false;
      fresh.z=nextIdeaZ(d); setIdeaItemGeometry(el,fresh); el.classList.add("dragging");
      try{el.setPointerCapture(e.pointerId)}catch(_e){}
      cleanupDragListeners();
      document.addEventListener("pointermove",onDragMove,{passive:false});document.addEventListener("pointerup",endDrag);document.addEventListener("pointercancel",endDrag);
      if(!immediate && !ideaReduceMotion())navigator.vibrate&&navigator.vibrate(10);
    };
    const onDragMove=(e)=>{
      if(!dragging || e.pointerId!==dragPointerId || !start)return;
      const d=currentIdeaData(),fresh=d && d.items.find((x)=>x.id===item.id); if(!fresh||!d)return;
      if(!dragUndoPushed){pushIdeaUndo(dragPreSnap);dragUndoPushed=true;}
      const dx=e.clientX-start.x,dy=e.clientY-start.y,delta=boardDeltaFromEvent(dx,dy);
      fresh.x=Math.round(Math.max(0,Math.min(d.canvas.width-fresh.w,start.left+delta.x)));
      fresh.y=Math.round(Math.max(0,Math.min(d.canvas.height-fresh.h,start.top+delta.y)));
      if(ideaSnapOn){ const sn=ideaSnapPosition(fresh,d); if(sn){ fresh.x=Math.round(Math.max(0,Math.min(d.canvas.width-fresh.w,fresh.x+sn.dx))); fresh.y=Math.round(Math.max(0,Math.min(d.canvas.height-fresh.h,fresh.y+sn.dy))); showIdeaSnapGuides(sn.guideX,sn.guideY); } }
      setIdeaItemGeometry(el,fresh);
      // 좌표는 종료 이벤트가 누락되는 환경에서도 보존되어야 합니다.
      scheduleIdeaSave(260);
      e.preventDefault();
    };
    const endDrag=(e)=>{
      if(dragPointerId!=null && e && e.pointerId!=null && e.pointerId!==dragPointerId)return;
      const wasDragging=dragging;
      cancelHold(); cleanupDragListeners(); dragging=false; dragPointerId=null;
      if(wasDragging){el.classList.remove("dragging");suppressOptionsUntil=Date.now()+650;clearIdeaSnapGuides();scheduleIdeaSave(0);}
      start=null;
    };
    const maybeOpenTouchOptions=(e)=>{
      if(e.pointerType!=="touch" || movedBeforeHold || Date.now()<suppressOptionsUntil) return;
      if (e.target.closest?.(".idea-file-body,.idea-quote-body")) return;
      const now=Date.now(), point={x:e.clientX,y:e.clientY};
      if(lastTouchTap && now-lastTouchTap.at<320 && Math.hypot(point.x-lastTouchTap.x,point.y-lastTouchTap.y)<24){
        lastTouchTap=null; suppressOptionsUntil=now+420; e.preventDefault(); openIdeaItemOptions(item.id);
      } else lastTouchTap={at:now,x:point.x,y:point.y};
    };
    // 길게 끌고 난 뒤의 click이 링크 열기/다운로드로 이어지지 않도록 캡처 단계에서 차단합니다.
    el.addEventListener("click",(e)=>{if(Date.now()<suppressOptionsUntil){e.preventDefault();e.stopImmediatePropagation();}},true);
    el.addEventListener("pointerdown",(e)=>{
      if(e.button!=null&&e.button!==0)return;
      lastPointerType=e.pointerType || "";
      if(!canStartOn(e.target,e)) return;
      cancelHold(); movedBeforeHold=false;
      selectIdeaItem(item.id, ideaEditState.itemId===item.id?ideaEditState.mode:null);
      const d=currentIdeaData(),fresh=d && d.items.find((x)=>x.id===item.id);
      if(fresh && fresh.groupId){ start=null; return; }
      if(ideaEditState.itemId===item.id&&ideaEditState.mode==="move"){e.preventDefault();beginDrag(e,true);return;}
      start={x:e.clientX,y:e.clientY,left:fresh?fresh.x:item.x,top:fresh?fresh.y:item.y};
      holdTimer=setTimeout(()=>{holdTimer=null; if(!movedBeforeHold)beginDrag(e,false);},420);
    });
    el.addEventListener("pointermove",(e)=>{
      if(!start || dragging)return;
      if(Math.abs(e.clientX-start.x)>8||Math.abs(e.clientY-start.y)>8){movedBeforeHold=true;cancelHold();}
    });
    el.addEventListener("pointerup",(e)=>{if(!dragging){cancelHold();maybeOpenTouchOptions(e);start=null;}});
    el.addEventListener("pointercancel",()=>{if(!dragging){cancelHold();start=null;}});
    el.addEventListener("lostpointercapture",()=>{ if(dragging) endDrag({ pointerId:dragPointerId }); else { cancelHold(); start=null; } });
    el.addEventListener("dblclick",(e)=>{
      if(Date.now()<suppressOptionsUntil || textEditor(e.target)||nativeControl(e.target))return;
      e.preventDefault();openIdeaItemOptions(item.id);
    });
    el.addEventListener("contextmenu",(e)=>{
      e.preventDefault();
      if(dragging || Date.now()<suppressOptionsUntil) return;
      if(lastPointerType==="touch") return;
      openIdeaItemOptions(item.id);
    });
  }
  function renderIdeaTemplateChoice(kind, key, template, selected) {
    const isBackground = kind === "background";
    const plain=ideaPlainBackgroundMeta(key), previewStyle=plain ? ` style="--idea-canvas-a:${plain.ig[0]};--idea-canvas-b:${plain.ig[1]}"` : "";
    const preview = isBackground
      ? `<span class="idea-template-preview idea-template-preview-bg"><span class="idea-template-thumb idea-template-bg-thumb idea-canvas" data-background="${esc(key)}"${previewStyle} aria-hidden="true"><i>✦</i></span></span>`
      : `<span class="idea-template-preview idea-template-preview-note"><span class="idea-template-thumb idea-template-note-thumb idea-sticky" data-note-style="${esc(key)}" data-color="blue" style="${ideaColorStyleAttr("blue")}" aria-hidden="true"><i>IDEA</i></span></span>`;
    const attr = isBackground ? `data-idea-bg="${esc(key)}"` : `data-idea-note-style="${esc(key)}"`;
    return `<button type="button" class="idea-template-choice idea-template-card${selected ? " active" : ""}" ${attr} aria-pressed="${selected ? "true" : "false"}">${preview}<span class="idea-template-copy"><b>${esc(template.label)}</b><small>${esc(template.desc || "사용자 템플릿")}</small></span><span class="idea-template-state">${selected ? "선택됨" : "선택"}</span></button>`;
  }

  function openIdeaNoteLockPicker(id) {
    const item=getIdeaItem(id); if(!item || item.kind!=="note") return;
    const mode=ideaLockMode(item);
    openModal(`<h3>메모지 잠금</h3><p class="m-sub">요소 잠금은 배치·크기·디자인 변경을 막지만 메모 내용은 계속 편집할 수 있습니다. 전체 보호 잠금은 메모 내용까지 모두 보호합니다.</p><div class="idea-options-grid"><button class="idea-options-action" data-idea-note-lock="transform"><b>요소만 잠금</b><small>${mode==="transform"?"현재 적용됨":"이동·크기·회전·디자인 변경만 막기"}</small></button><button class="idea-options-action" data-idea-note-lock="full"><b>전체 보호 잠금</b><small>${mode==="full"?"현재 적용됨":"메모 내용과 모든 조작을 보호"}</small></button>${mode?`<button class="idea-options-action" data-idea-note-lock=""><b>잠금 해제</b><small>메모지의 모든 편집을 다시 허용</small></button>`:""}</div><div class="m-row"><button class="m-btn" id="ideaNoteLockCancel">취소</button></div>`);
    $("modalBox").querySelectorAll("[data-idea-note-lock]").forEach((button)=>button.addEventListener("click",()=>{const fresh=getIdeaItem(id);if(!fresh)return;pushIdeaUndo();setIdeaLockMode(fresh,button.dataset.ideaNoteLock||null);scheduleIdeaSave(0);closeModal();renderIdeaBoard();requestAnimationFrame(()=>openIdeaItemOptions(id));}));
    $on("ideaNoteLockCancel","click",closeModal);
  }

  function openIdeaItemOptions(id) {
    if (isIdeaReadonly()) { openIdeaArtifactPreview(id); return; }
    const n=currentIdeaNote(), item=getIdeaItem(id);if(!n||!item)return;selectIdeaItem(id,null);
    const supportsAspect=["image","video"].includes(item.kind);
    const isColorable=["note","audio","quote","file"].includes(item.kind);
    const blocked=()=>!ideaCanEditItem(item);
    const noteLockMode=ideaLockMode(item);
    const lockAction=item.kind==="note" ? `<button class="idea-options-action" id="ideaOptLock"><b>${noteLockMode==="transform"?"요소 잠금":""}${noteLockMode==="full"?"전체 보호 잠금":""}${!noteLockMode?"잠금":""}</b><small>${noteLockMode==="transform"?"본문 편집은 가능 · 요소 조작 보호":noteLockMode==="full"?"본문까지 모든 편집 보호":"요소만 / 전체 보호 잠금 중 선택"}</small></button>` : `<button class="idea-options-action" id="ideaOptLock"><b>${ideaIsLocked(item)?"잠금 해제":"잠금"}</b><small>${ideaIsLocked(item)?"이 조각을 다시 편집 가능하게 합니다":"이동·크기·회전·삭제를 막습니다"}</small></button>`;
    const noteOptions=item.kind==="note"?`<div class="idea-options-section"><div class="idea-options-label">메모지 디자인</div><button class="idea-options-row" id="ideaOptDesign"><span>✦</span><span><b>${esc(IDEA_NOTE_TEMPLATES[item.noteStyle].label)}</b><small>디자인 선택 후 색상·글자색을 고르기</small></span></button><button class="idea-options-row" id="ideaOptVAlign"><span>↕</span><span><b>${item.vAlign==="center"?"세로 중앙맞춤":"세로 위맞춤"}</b><small>메모지 안쪽 내용을 세로 기준으로 맞춥니다</small></span></button></div>`:"";
    const dividerOptions=item.kind==="divider"?`<div class="idea-options-section"><div class="idea-options-label">구분선 디자인</div><button class="idea-options-row" id="ideaOptDividerStyle"><span>—</span><span><b>${esc((IDEA_DIVIDER_STYLES[item.dividerStyle] || IDEA_DIVIDER_STYLES.solid).label)}</b><small>굵기 · 디자인 100종에서 선택</small></span></button></div>`:"";
    const colorOption=isColorable&&item.kind!=="note"?`<div class="idea-options-section"><div class="idea-options-label">테마 컬러</div><button class="idea-options-row" id="ideaOptColor"><span style="color:${esc(ideaColorMeta(item.color).ig[0])}">●</span><span><b>${esc(ideaColorMeta(item.color).name)}</b><small>테마 · 크림 · 먹색 · 직접 선택</small></span></button></div>`:"";
    const emptyFrameOptions=item.kind==="frame"?`<div class="idea-options-section idea-empty-frame-options"><div class="idea-options-label">테마</div><p class="idea-options-help">장식용 빈 프레임입니다. 프레임 종류와 컬러를 이곳에서 고릅니다.</p><button class="idea-options-row" id="ideaOptFrameType"><span>□</span><span><b>${esc(ideaMediaFrameLabel(item))}</b><small>프레임 종류 변경</small></span></button><button class="idea-options-row" id="ideaOptFrameColor"><span style="color:${esc(resolveFrameColor(item.frameColor||"#d4af37"))}">●</span><span><b>프레임 컬러</b><small>${esc((item.frameColor===FRAME_THEME_TOKEN?"테마":(frameById(item.frame)?String(item.frameColor||"#d4af37"):"프레임을 먼저 고르세요")))}</small></span></button></div>`:"";
    const renameAction=["quote","file","audio"].includes(item.kind)?`<button class="idea-options-action" id="ideaOptRename"><b>${item.kind==="audio"?"제목 바꾸기":"표시 제목"}</b><small>${item.kind==="audio"?"원본은 유지하고 보드에서만 바꾸기":"보드에서만 이름 바꾸기"}</small></button>`:"";
    const audioTitleAction=item.kind==="audio"?`<button class="idea-options-action" id="ideaOptAudioTitle"><b>${item.showTitle===false?"제목 표시 끔":"제목 표시 켬"}</b><small>플레이어 상단 제목 보이기/숨기기</small></button>`:"";
    const audioModeAction=item.kind==="audio"?`<button class="idea-options-action" id="ideaOptAudioMode"><b>플레이어 ${item.audioMode==="light"?"라이트":"다크"}</b><small>안쪽 오디오 바의 밝은/어두운 모드 전환</small></button>`:"";
    const frameAction=["note","image","audio","video","file","quote"].includes(item.kind)?`<button class="idea-options-action" id="ideaOptFrame"><b>${esc(ideaMediaFrameLabel(item))}</b><small>전체 프레임·색상 라이브러리를 이 조각에 적용</small></button>`:"";
    const videoDecorAction=item.kind==="video"?`<button class="idea-options-action" id="ideaOptVideoDecor"><b>${item.videoDecor===false?"영상 장식 꺼짐":"영상 장식 켜짐"}</b><small>PLAY 배지·별 장식의 표시와 색상 조절</small></button>`:"";
    const replaceAction=["image","audio","video","file","quote"].includes(item.kind)?`<button class="idea-options-action" id="ideaOptReplace"><b>교체</b><small>${item.kind==="quote"?"연결할 메모를 새로 고르기":"현재 위치·크기·테마를 유지하고 새 파일로 교체"}</small></button>`:"";
    const flipAction=["note","image"].includes(item.kind)?`<button class="idea-options-action" id="ideaOptFlipX"><b>${item.flipX?"좌우 반전 켜짐":"좌우 반전 꺼짐"}</b><small>${item.kind==="note"?"메모지 디자인만 뒤집고 글자는 유지":"이미지를 좌우로 뒤집기"}</small></button>`:"";
    openModal(`<h3>${esc(item.kind === "audio" ? "음악 플레이어" : ideaItemTitle(item,n))}</h3><p class="m-sub">${ideaIsFullyLocked(item)?"전체 보호 잠금 상태입니다. 잠금 해제 후 모든 편집이 가능합니다.":ideaLockMode(item)==="transform"?"요소 잠금 상태입니다. 메모 내용은 편집할 수 있지만 조각 조작은 보호됩니다.":"길게 누르면 이동하고, 선택된 조각의 핸들로 직접 조절할 수 있어요."}</p><div class="idea-options-grid">${lockAction}<button class="idea-options-action" id="ideaOptMove"><b>이동 모드</b><small>한 번 눌러 바로 드래그</small></button><button class="idea-options-action" id="ideaOptAdjust"><b>크기 · 회전</b><small>조절 핸들 표시</small></button>${supportsAspect?`<button class="idea-options-action" id="ideaOptAspect"><b>${item.lockAspect?"비율 고정됨":"자유 비율"}</b><small>이미지·영상 비율 전환</small></button>`:""}${flipAction}${frameAction}${videoDecorAction}${replaceAction}${renameAction}${audioTitleAction}${audioModeAction}<button class="idea-options-action" id="ideaOptShadow"><b>${item.shadow===false?"그림자 꺼짐":"그림자 켜짐"}</b><small>조각 그림자 표시 전환</small></button><button class="idea-options-action" id="ideaOptPreview"><b>미리보기</b><small>이 조각만 크게 보기</small></button><button class="idea-options-action" id="ideaOptDuplicate"><b>복제</b><small>같은 조각 하나 더 · Ctrl+D</small></button><button class="idea-options-action" id="ideaOptFront"><b>맨 앞으로</b><small>다른 조각 위로 · ]</small></button><button class="idea-options-action" id="ideaOptBack"><b>맨 뒤로</b><small>다른 조각 아래로 · [</small></button><button class="idea-options-action danger" id="ideaOptDelete"><b>조각 삭제</b><small>보드에서 제거</small></button></div>${noteOptions}${dividerOptions}${colorOption}${emptyFrameOptions}<div class="m-row"><button class="m-btn" id="ideaOptClose">닫기</button></div>`);
    $on("ideaOptClose","click",closeModal);
    $on("ideaOptLock","click",()=>{if(item.kind==="note"){openIdeaNoteLockPicker(id);return;}pushIdeaUndo();setIdeaLockMode(item,ideaIsLocked(item)?null:"full");renderIdeaBoard();scheduleIdeaSave(0);closeModal();requestAnimationFrame(()=>openIdeaItemOptions(id));});
    $on("ideaOptMove","click",()=>{if(blocked())return;closeModal();selectIdeaItem(id,"move");toast("이동 모드: 조각을 드래그해 배치하세요");});
    $on("ideaOptAdjust","click",()=>{if(blocked())return;closeModal();selectIdeaItem(id,"transform");toast("네 모서리 손잡이로 크기, ↻로 회전을 조절하세요");});
    if(supportsAspect)$on("ideaOptAspect","click",()=>{if(blocked())return;pushIdeaUndo();item.lockAspect=!item.lockAspect;scheduleIdeaSave(0);closeModal();openIdeaItemOptions(id);});
    if(["note","image"].includes(item.kind))$on("ideaOptFlipX","click",()=>{if(blocked())return;pushIdeaUndo();item.flipX=!item.flipX;const el=ideaItemElement(id);if(el)setIdeaItemGeometry(el,item);scheduleIdeaSave(0);closeModal();openIdeaItemOptions(id);});
    if(["quote","file","audio"].includes(item.kind))$on("ideaOptRename","click",()=>{if(blocked())return;renameIdeaItemTitle(id);});
    if(item.kind==="audio")$on("ideaOptAudioTitle","click",()=>{if(blocked())return;pushIdeaUndo();item.showTitle=item.showTitle===false;renderIdeaBoard();scheduleIdeaSave(0);closeModal();requestAnimationFrame(()=>openIdeaItemOptions(id));});
    if(item.kind==="audio")$on("ideaOptAudioMode","click",()=>{if(blocked())return;pushIdeaUndo();item.audioMode=item.audioMode==="light"?"dark":"light";renderIdeaBoard();scheduleIdeaSave(0);closeModal();requestAnimationFrame(()=>openIdeaItemOptions(id));});
    if(["note","image","audio","video","file","quote"].includes(item.kind))$on("ideaOptFrame","click",()=>{if(blocked())return;openIdeaMediaFramePicker(id);});
    if(item.kind==="frame")$on("ideaOptFrameType","click",()=>{if(blocked())return;openIdeaMediaFramePicker(id);});
    if(item.kind==="frame")$on("ideaOptFrameColor","click",()=>{if(blocked())return; if(item.frame)openIdeaMediaFrameColorPicker(id,item.frame,item.frameColor);else openIdeaMediaFramePicker(id);});
    if(["image","audio","video","file","quote"].includes(item.kind))$on("ideaOptReplace","click",()=>{if(blocked())return;openIdeaItemReplacePicker(id);});
    if(item.kind==="video")$on("ideaOptVideoDecor","click",()=>{if(blocked())return;openIdeaVideoDecorPicker(id);});
    $on("ideaOptShadow","click",()=>{if(blocked())return;pushIdeaUndo();item.shadow=item.shadow===false;const el=ideaItemElement(id);if(el)el.classList.toggle("no-shadow",item.shadow===false);scheduleIdeaSave(0);closeModal();openIdeaItemOptions(id);});
    $on("ideaOptPreview","click",()=>{closeModal();openIdeaArtifactPreview(id);});
    $on("ideaOptDuplicate","click",()=>{if(blocked())return;closeModal();duplicateIdeaItem(id);});
    $on("ideaOptFront","click",()=>{if(blocked())return;closeModal();reorderIdeaItem(id,true);});
    $on("ideaOptBack","click",()=>{if(blocked())return;closeModal();reorderIdeaItem(id,false);});
    $on("ideaOptDelete","click",()=>{if(blocked())return;closeModal();confirmModal("조각 삭제",`'${ideaItemTitle(item,n)}' 조각을 보드에서 지울까요?`,"삭제",true,()=>removeIdeaItem(id));});
    if(item.kind==="note")$on("ideaOptDesign","click",()=>{if(blocked())return;openIdeaNoteDesignPicker(id);});
    if(item.kind==="note")$on("ideaOptVAlign","click",()=>{if(blocked())return;pushIdeaUndo();item.vAlign=item.vAlign==="center"?"top":"center";const el=ideaItemElement(id);if(el)el.dataset.vAlign=item.vAlign;scheduleIdeaSave(0);closeModal();openIdeaItemOptions(id);});
    if(item.kind==="divider")$on("ideaOptDividerStyle","click",()=>{if(blocked())return;openIdeaDividerStylePicker(id);});
    if(isColorable&&item.kind!=="note")$on("ideaOptColor","click",()=>{if(blocked())return;openIdeaItemColorPicker(id);});
  }
  function openIdeaDividerStylePicker(id) {
    const item=getIdeaItem(id); if(!item || item.kind!=="divider" || !ideaCanEditItem(item)) return;
    const clampW=(v)=>Math.max(1,Math.min(12,Math.round(Number(v)||3)));
    const w=clampW(item.dividerWeight);
    const colorVars=ideaColorStyleAttr(item.color, item.textColor);
    const tiles=Object.entries(IDEA_DIVIDER_STYLES).map(([key,meta])=>
      `<button type="button" class="idea-divider-choice${item.dividerStyle===key?" active":""}" data-idea-divider-style="${esc(key)}" title="${esc(meta.desc)}">`
      +`<div class="idea-preview-divider" data-divider-style="${esc(key)}" style="${colorVars};--idea-divider-weight:${w}px"><div class="idea-divider-body" aria-hidden="true"><span></span></div></div>`
      +`<small>${esc(meta.label)}</small></button>`).join("");
    openModal(`<h3>구분선 디자인</h3><p class="m-sub">선 굵기를 정한 뒤 디자인을 고르면 바로 컬러 선택으로 넘어갑니다.</p>`
      +`<label class="idea-overlay-range idea-divider-weight-range"><span>선 굵기 <b id="ideaDivWeightValue">${w}px</b></span><input id="ideaDivWeight" type="range" min="1" max="12" step="1" value="${w}" aria-label="구분선 굵기"></label>`
      +`<div class="idea-divider-choice-grid">${tiles}</div>`
      +`<div class="m-row"><button class="m-btn" id="ideaDividerStyleClose">닫기</button></div>`);
    let pushedUndo=false; const ensureUndo=()=>{ if(!pushedUndo){ pushIdeaUndo(); pushedUndo=true; } };
    const weightInput=$("ideaDivWeight");
    if(weightInput) weightInput.addEventListener("input",()=>{
      const fresh=getIdeaItem(id); if(!fresh)return;
      const val=clampW(weightInput.value);
      ensureUndo();
      fresh.dividerWeight=val;
      const vEl=$("ideaDivWeightValue"); if(vEl)vEl.textContent=val+"px";
      const el=ideaItemElement(id); if(el)el.style.setProperty("--idea-divider-weight",val+"px");
      $("modalBox").querySelectorAll(".idea-preview-divider").forEach((p)=>p.style.setProperty("--idea-divider-weight",val+"px"));
      scheduleIdeaSave(0);
    });
    $("modalBox").querySelectorAll("[data-idea-divider-style]").forEach((button)=>button.addEventListener("click",()=>{
      const fresh=getIdeaItem(id); if(!fresh)return;
      ensureUndo();
      fresh.dividerStyle=button.dataset.ideaDividerStyle;
      const el=ideaItemElement(id); if(el)el.dataset.dividerStyle=fresh.dividerStyle;
      $("modalBox").querySelectorAll(".idea-divider-choice").forEach((b)=>b.classList.toggle("active",b===button));
      scheduleIdeaSave(0);
      openIdeaDividerColorPicker(id);
    }));
    $on("ideaDividerStyleClose","click",closeModal);
  }
  function openIdeaDividerColorPicker(id) {
    const item=getIdeaItem(id); if(!item || item.kind!=="divider" || !ideaCanEditItem(item)) return;
    let cpPushed=false; const cpUndo=()=>{ if(!cpPushed){ pushIdeaUndo(); cpPushed=true; } };
    const w=Math.max(1,Math.min(12,Math.round(Number(item.dividerWeight)||3)));
    const colorVars=ideaColorStyleAttr(item.color, item.textColor);
    openModal(`<h3>구분선 컬러</h3><p class="m-sub">${esc((IDEA_DIVIDER_STYLES[item.dividerStyle] || IDEA_DIVIDER_STYLES.solid).label)} 디자인에 적용할 색을 고릅니다.</p>`
      +`<div class="idea-preview-divider idea-divider-color-preview" id="ideaDividerColorPreview" data-divider-style="${esc(item.dividerStyle || "solid")}" style="${colorVars};--idea-divider-weight:${w}px"><div class="idea-divider-body" aria-hidden="true"><span></span></div></div>`
      +`<div class="idea-options-label">구분선 컬러</div><div class="idea-color-grid palette-grid">${ideaColorChoicesMarkup(item.color,"data-idea-divider-color",true)}</div>`
      +`<div class="m-row"><button class="m-btn" id="ideaDividerColorBack">뒤로가기</button><button class="m-btn primary" id="ideaDividerColorDone">완료</button></div>`);
    const update=()=>{
      const fresh=getIdeaItem(id), preview=$("ideaDividerColorPreview"), el=ideaItemElement(id);
      if(!fresh)return;
      if(preview){preview.dataset.dividerStyle=fresh.dividerStyle||"solid";preview.setAttribute("style",`${ideaColorStyleAttr(fresh.color,fresh.textColor)};--idea-divider-weight:${Math.max(1,Math.min(12,Math.round(Number(fresh.dividerWeight)||3)))}px`);}
      if(el)applyIdeaColor(el,fresh);
    };
    $("modalBox").querySelectorAll("[data-idea-divider-color]").forEach((button)=>button.addEventListener("click",()=>{
      const fresh=getIdeaItem(id); if(!fresh)return; cpUndo(); fresh.color=button.dataset.ideaDividerColor; scheduleIdeaSave(0);
      $("modalBox").querySelectorAll("[data-idea-divider-color]").forEach((x)=>x.classList.toggle("active",x===button)); update();
    }));
    $("modalBox").querySelectorAll('[data-idea-custom-color="data-idea-divider-color"]').forEach((button)=>button.addEventListener("click",()=>{
      const fresh=getIdeaItem(id); if(!fresh)return;
      openIdeaCustomColorPicker("구분선 컬러 직접 선택",fresh.color,(value)=>{cpUndo();const next=getIdeaItem(id);if(!next)return;next.color=value;scheduleIdeaSave(0);openIdeaDividerColorPicker(id);});
    }));
    $on("ideaDividerColorBack","click",()=>openIdeaDividerStylePicker(id));
    $on("ideaDividerColorDone","click",closeModal);
    update();
  }
  function ideaFramePreviewMarkup(fid, color, p) {
    const media=frameThumbInner(p || {});
    const frame=fid ? frameNineSliceMarkup(fid,color) : "";
    return `<div class="idea-frame-select-preview${frame ? " has-frame" : ""}">${media}${frame ? `<div class="idea-media-frame">${frame}</div>` : ""}</div>`;
  }

  function openIdeaMediaFramePicker(id) {
    const item=getIdeaItem(id); if(!item || !["note","image","audio","video","file","quote","frame"].includes(item.kind) || !ideaCanEditItem(item)) return;
    const p=getProject(st.curProjectId), config=ideaMediaFrameConfig(item);
    const activeId=config && config.id, activeColor=config ? config.color : "#d4af37";
    const allowNone=item.kind !== "frame";
    const none=allowNone?`<button type="button" class="frame-opt${!config ? " sel" : ""}" data-idea-frame=""><div class="idea-frame-select-preview">${frameThumbInner(p || {})}</div><span>없음</span></button>`:"";
    const grid=FRAMES.map((f)=>`<button type="button" class="frame-opt${activeId===f.id ? " sel" : ""}" data-idea-frame="${esc(f.id)}">${ideaFramePreviewMarkup(f.id, activeId===f.id ? activeColor : "#d4af37", p)}<span>${esc(f.name)}</span></button>`).join("");
    openModal(`<h3>${item.kind==="frame"?"프레임 종류":"조각 프레임"}</h3><p class="m-sub">${item.kind==="frame"?"빈 프레임의 종류를 고릅니다. 다음 화면에서 프레임 컬러를 정할 수 있어요.":`프로젝트 썸네일과 같은 ${FRAMES.length}종 프레임과 색상 환경을 사용합니다. 프레임 값은 이 조각 안에만 독립 저장됩니다.`}</p><div class="frame-grid idea-media-frame-grid">${none}${grid}</div><div class="m-row"><button class="m-btn" id="ideaFramePickerClose">닫기</button></div>`);
    $("modalBox").querySelectorAll("[data-idea-frame]").forEach((button)=>button.addEventListener("click",()=>{
      const fid=button.dataset.ideaFrame;
      if(!fid){ pushIdeaUndo(); item.frame=null; item.frameColor=null; renderIdeaBoard(); scheduleIdeaSave(0); closeModal(); toast("프레임을 제거했어요"); return; }
      openIdeaMediaFrameColorPicker(id,fid);
    }));
    $on("ideaFramePickerClose","click",closeModal);
  }

  function openIdeaMediaFrameColorPicker(id,fid,initialColor) {
    const item=getIdeaItem(id); if(!item || !frameById(fid)) return;
    const p=getProject(st.curProjectId);
    let color=normalizeFrameColor(initialColor || (item.frame===fid ? item.frameColor : null)) || "#d4af37";
    const themeAccent=resolveFrameColor(FRAME_THEME_TOKEN);
    const colors=FRAME_COLORS.concat([[FRAME_THEME_TOKEN,"테마와 연동",themeAccent]]);
    const isCustom=()=>{const h=normHex(color); return !!h && !FRAME_COLOR_SET.has(h);};
    const isSelected=(key,value)=> key==="__custom__" ? isCustom() : key===FRAME_THEME_TOKEN ? color===FRAME_THEME_TOKEN : key===FRAME_PUNCH_TOKEN ? color===FRAME_PUNCH_TOKEN : color===String(value).toLowerCase();
    const swatches=()=>colors.map(([key,name,value])=>{
      const preview=key===FRAME_THEME_TOKEN?themeAccent:value;
      const isGlass=key==="glass", isPunch=key===FRAME_PUNCH_TOKEN;
      const punch='background:linear-gradient(135deg, rgba(255,255,255,.68), rgba(255,255,255,.15)); box-shadow:inset 0 0 0 1px rgba(255,255,255,.85), inset 0 0 0 6px rgba(255,255,255,.14), 0 0 0 1px rgba(87,106,146,.32);';
      return `<button type="button" class="fcolor-sw${isGlass?" glass":""}${isPunch?" punch":""}${isSelected(key,value)?" sel":""}" data-idea-frame-color="${esc(key)}" title="${esc(name)}" aria-label="${esc(name)}"><span${isGlass?"":isPunch?` style="${punch}"`:` style="background:${preview}"`}></span></button>`;
    }).join("") + `<button type="button" class="fcolor-sw fcolor-custom${isSelected("__custom__")?" sel":""}" data-idea-frame-color="__custom__" title="직접 색상 선택" aria-label="직접 색상 선택"><span>+</span></button>`;
    openModal(`<h3>프레임 색상</h3><p class="m-sub">${esc((frameById(fid)||{}).name||"")} · 직접 색상은 정사각형 색상판과 HEX·RGB 입력으로 정밀하게 고를 수 있어요.</p><div class="idea-frame-big-preview" id="ideaFrameBigPreview">${ideaFramePreviewMarkup(fid,color,p)}</div><div class="fcolor-grid" id="ideaFrameColorGrid">${swatches()}</div><div class="m-row"><button class="m-btn" id="ideaFrameColorBack">뒤로</button><button class="m-btn primary" id="ideaFrameColorApply">적용</button></div>`);
    const refresh=()=>{
      const preview=$("ideaFrameBigPreview"); if(preview) preview.innerHTML=ideaFramePreviewMarkup(fid,color,p);
      $("ideaFrameColorGrid").querySelectorAll("[data-idea-frame-color]").forEach((button)=>{
        const key=button.dataset.ideaFrameColor;
        const value=key===FRAME_THEME_TOKEN?themeAccent:(key===FRAME_PUNCH_TOKEN?FRAME_PUNCH_TOKEN:FRAME_COLOR_BY_KEY.get(key));
        button.classList.toggle("sel", isSelected(key,value));
      });
    };
    $("ideaFrameColorGrid").querySelectorAll("[data-idea-frame-color]").forEach((button)=>button.addEventListener("click",()=>{
      const key=button.dataset.ideaFrameColor;
      if(key==="__custom__") { openAdvancedColorPicker("프레임 직접 색상", normHex(color) || "#d4af37", (value)=>openIdeaMediaFrameColorPicker(id,fid,value), { prefix:"ideaFrameCustom", saved:true, save:true }); return; }
      color=key===FRAME_THEME_TOKEN?FRAME_THEME_TOKEN:(key===FRAME_PUNCH_TOKEN?FRAME_PUNCH_TOKEN:(FRAME_COLOR_BY_KEY.get(key)||color)); refresh();
    }));
    $on("ideaFrameColorBack","click",()=>openIdeaMediaFramePicker(id));
    $on("ideaFrameColorApply","click",()=>{
      pushIdeaUndo(); item.frame=fid; item.frameColor=color; renderIdeaBoard(); scheduleIdeaSave(0); closeModal(); toast("프레임을 적용했어요");
    });
  }


  function openIdeaVideoDecorPicker(id) {
    const item=getIdeaItem(id); if(!item || item.kind!=="video") return;
    let pushed=false;
    const commit=()=>{ if(!pushed){pushIdeaUndo();pushed=true;} };
    const render=()=>{
      const fresh=getIdeaItem(id); if(!fresh) return;
      openModal(`<h3>영상 장식</h3><p class="m-sub">네이티브 동영상 컨트롤은 유지하고, 위에 얹는 PLAY 배지와 별 장식만 조절합니다.</p><div class="idea-video-decor-preview" id="ideaVideoDecorPreview">${ideaVideoDecorMarkup(fresh) || '<span class="idea-video-decor-off">장식이 꺼져 있습니다</span>'}</div><label class="idea-size-lock"><input id="ideaVideoDecorOn" type="checkbox" ${fresh.videoDecor===false?"":"checked"}><span>장식 표시</span><small>PLAY 배지와 별 장식을 영상 위에 보입니다.</small></label><div class="idea-options-label">장식 컬러</div><div class="idea-color-grid palette-grid" id="ideaVideoDecorColors">${ideaColorChoicesMarkup(fresh.videoDecorColor,"data-idea-video-decor-color",true)}</div><div class="m-row"><button class="m-btn" id="ideaVideoDecorBack">뒤로</button><button class="m-btn primary" id="ideaVideoDecorDone">완료</button></div>`);
      const refresh=()=>{
        const current=getIdeaItem(id); if(!current)return;
        const preview=$("ideaVideoDecorPreview"); if(preview)preview.innerHTML=ideaVideoDecorMarkup(current)||'<span class="idea-video-decor-off">장식이 꺼져 있습니다</span>';
        const el=ideaItemElement(id); if(el)refreshIdeaVideoDecor(el,current);
        $("modalBox").querySelectorAll("[data-idea-video-decor-color]").forEach((b)=>b.classList.toggle("active",b.dataset.ideaVideoDecorColor===current.videoDecorColor));
      };
      $on("ideaVideoDecorOn","change",(e)=>{const current=getIdeaItem(id);if(!current)return;commit();current.videoDecor=!!e.target.checked;scheduleIdeaSave(0);refresh();});
      $("modalBox").querySelectorAll("[data-idea-video-decor-color]").forEach((b)=>b.addEventListener("click",()=>{const current=getIdeaItem(id);if(!current)return;commit();current.videoDecorColor=b.dataset.ideaVideoDecorColor;current.videoDecor=true;scheduleIdeaSave(0);const on=$("ideaVideoDecorOn");if(on)on.checked=true;refresh();}));
      $("modalBox").querySelectorAll('[data-idea-custom-color="data-idea-video-decor-color"]').forEach((b)=>b.addEventListener("click",()=>{const current=getIdeaItem(id);if(!current)return;openIdeaCustomColorPicker("영상 장식 직접 색상",current.videoDecorColor,(value)=>{commit();const next=getIdeaItem(id);if(!next)return;next.videoDecorColor=value;next.videoDecor=true;scheduleIdeaSave(0);openIdeaVideoDecorPicker(id);});}));
      $on("ideaVideoDecorBack","click",()=>openIdeaItemOptions(id));
      $on("ideaVideoDecorDone","click",closeModal);
    };
    render();
  }

  function renameIdeaItemTitle(id) {
    const n=currentIdeaNote(), item=getIdeaItem(id); if(!n||!item)return;
    const fallback=item.kind==="frame"?"빈 프레임":item.kind==="quote"?(getNote(item.noteId)?.title||"연결된 메모"):(item.kind==="audio"?((itemAttachment(n,item.fileId)?.name)||"오디오 트랙"):(itemAttachment(n,item.fileId)?.name||"첨부 파일"));
    renameModal("보드 표시 제목", item.title || fallback, (value)=>{const fresh=getIdeaItem(id);if(!fresh)return;pushIdeaUndo();fresh.title=String(value||"").trim().slice(0,240);scheduleIdeaSave(0);renderIdeaBoard();requestAnimationFrame(()=>selectIdeaItem(id,null));toast(fresh.title?"표시 제목을 바꿨어요":"원본 제목 표시로 되돌렸어요");});
  }
  function openIdeaNoteDesignPicker(id) {
    const item=getIdeaItem(id);if(!item)return;
    const styles=Object.entries(IDEA_NOTE_TEMPLATES).map(([key,t])=>renderIdeaTemplateChoice("note",key,t,item.noteStyle===key)).join("");
    openModal(`<h3>메모지 디자인</h3><p class="m-sub">디자인을 먼저 고르면 다음 화면에서 컬러와 글자색을 정합니다.</p><div class="idea-template-grid">${styles}</div><div class="m-row"><button class="m-btn" id="ideaNoteDesignCancel">닫기</button></div>`);
    $("modalBox").querySelectorAll("[data-idea-note-style]").forEach((b)=>b.addEventListener("click",()=>{const fresh=getIdeaItem(id);if(!fresh)return;pushIdeaUndo();fresh.noteStyle=b.dataset.ideaNoteStyle;scheduleIdeaSave(0);const el=ideaItemElement(id);if(el)el.dataset.noteStyle=fresh.noteStyle;openIdeaNoteColorPicker(id);}));
    $on("ideaNoteDesignCancel","click",closeModal);
  }
  function openIdeaNoteColorPicker(id) {
    const item=getIdeaItem(id);if(!item)return;
    let cpPushed=false; const cpUndo=()=>{ if(!cpPushed){ pushIdeaUndo(); cpPushed=true; } };
    const sample=esc(item.text || "메모지 미리보기\n컬러와 글자색을 고르면 바로 반영됩니다.");
    openModal(`<h3>메모지 컬러</h3><p class="m-sub">${esc(IDEA_NOTE_TEMPLATES[item.noteStyle].label)} 디자인에 적용할 색을 고릅니다.</p><article class="idea-preview-note idea-sticky${item.flipX ? " flipped-x" : ""}" id="ideaNoteColorPreview" data-note-style="${esc(item.noteStyle)}" data-color="${esc(item.color)}" style="${ideaColorStyleAttr(item.color,item.textColor)}"><div class="idea-note-text">${sample}</div></article><div class="idea-options-label">메모지 컬러</div><div class="idea-color-grid palette-grid">${ideaColorChoicesMarkup(item.color,"data-idea-note-color",true)}</div><div class="idea-options-label">글자색</div><div class="idea-color-grid palette-grid">${ideaTextColorChoicesMarkup(item.textColor,"data-idea-note-text-color",true)}</div><div class="m-row"><button class="m-btn" id="ideaNoteColorBack">디자인 다시 선택</button><button class="m-btn primary" id="ideaNoteColorDone">완료</button></div>`);
    const update=()=>{const fresh=getIdeaItem(id), preview=$("ideaNoteColorPreview"), el=ideaItemElement(id);if(!fresh)return;if(preview){preview.dataset.color=fresh.color;preview.dataset.noteStyle=fresh.noteStyle;preview.setAttribute("style",ideaColorStyleAttr(fresh.color,fresh.textColor));}if(el)applyIdeaColor(el,fresh);};
    $("modalBox").querySelectorAll("[data-idea-note-color]").forEach((b)=>b.addEventListener("click",()=>{const fresh=getIdeaItem(id);if(!fresh)return;cpUndo();fresh.color=b.dataset.ideaNoteColor;scheduleIdeaSave(0);$("modalBox").querySelectorAll("[data-idea-note-color]").forEach(x=>x.classList.toggle("active",x===b));update();}));
    $("modalBox").querySelectorAll("[data-idea-note-text-color]").forEach((b)=>b.addEventListener("click",()=>{const fresh=getIdeaItem(id);if(!fresh)return;cpUndo();fresh.textColor=b.dataset.ideaNoteTextColor;scheduleIdeaSave(0);$("modalBox").querySelectorAll("[data-idea-note-text-color]").forEach(x=>x.classList.toggle("active",x===b));update();}));
    $("modalBox").querySelectorAll('[data-idea-custom-color="data-idea-note-color"]').forEach((b)=>b.addEventListener("click",()=>{const fresh=getIdeaItem(id);if(!fresh)return;openIdeaCustomColorPicker("메모지 컬러 직접 선택",fresh.color,(value)=>{cpUndo();fresh.color=value;scheduleIdeaSave(0);openIdeaNoteColorPicker(id);});}));
    $("modalBox").querySelectorAll('[data-idea-custom-color="data-idea-note-text-color"]').forEach((b)=>b.addEventListener("click",()=>{const fresh=getIdeaItem(id);if(!fresh)return;openIdeaCustomColorPicker("메모지 글자색 직접 선택",ideaTextColorValue(fresh.textColor)||"#27303a",(value)=>{cpUndo();fresh.textColor=value;scheduleIdeaSave(0);openIdeaNoteColorPicker(id);});}));
    $on("ideaNoteColorBack","click",()=>openIdeaNoteDesignPicker(id));
    $on("ideaNoteColorDone","click",closeModal);
    update();
  }
  function openIdeaItemColorPicker(id) {
    const item=getIdeaItem(id); if(!item) return;
    let cpPushed=false;
    const label={audio:"음악 플레이어",quote:"메모 링크",file:"첨부파일",note:"메모지",divider:"구분선"}[item.kind] || "조각";
    const supportsText=["quote","file"].includes(item.kind);
    const textBlock=supportsText?`<div class="idea-options-label">글자색</div><div class="idea-color-grid palette-grid">${ideaTextColorChoicesMarkup(item.textColor,"data-idea-item-text-color",true)}</div>`:"";
    openModal(`<h3>${esc(label)} 컬러</h3><p class="m-sub">색상은 이름 없이 스와치 그리드에서 고릅니다. 앱 전체 테마를 바꿔도 이 조각의 색은 유지돼요.</p><div class="idea-color-grid palette-grid">${ideaColorChoicesMarkup(item.color,"data-idea-item-color",true)}</div>${textBlock}<div class="m-row"><button class="m-btn" id="ideaItemColorDone">완료</button></div>`);
    const update=()=>{const fresh=getIdeaItem(id),el=ideaItemElement(id);if(el&&fresh)applyIdeaColor(el,fresh);};
    $("modalBox").querySelectorAll("[data-idea-item-color]").forEach((button)=>button.addEventListener("click",()=>{
      const fresh=getIdeaItem(id); if(!fresh) return; if(!cpPushed){pushIdeaUndo();cpPushed=true;} fresh.color=button.dataset.ideaItemColor; scheduleIdeaSave(0);
      $("modalBox").querySelectorAll("[data-idea-item-color]").forEach((x)=>x.classList.toggle("active",x===button)); update();
    }));
    $("modalBox").querySelectorAll("[data-idea-item-text-color]").forEach((button)=>button.addEventListener("click",()=>{
      const fresh=getIdeaItem(id); if(!fresh) return; if(!cpPushed){pushIdeaUndo();cpPushed=true;} fresh.textColor=button.dataset.ideaItemTextColor; scheduleIdeaSave(0);
      $("modalBox").querySelectorAll("[data-idea-item-text-color]").forEach((x)=>x.classList.toggle("active",x===button)); update();
    }));
    $("modalBox").querySelectorAll('[data-idea-custom-color="data-idea-item-color"]').forEach((button)=>button.addEventListener("click",()=>{const fresh=getIdeaItem(id);if(!fresh)return;openIdeaCustomColorPicker(`${label} 컬러 직접 선택`,fresh.color,(value)=>{if(!cpPushed){pushIdeaUndo();cpPushed=true;}fresh.color=value;scheduleIdeaSave(0);openIdeaItemColorPicker(id);});}));
    $("modalBox").querySelectorAll('[data-idea-custom-color="data-idea-item-text-color"]').forEach((button)=>button.addEventListener("click",()=>{const fresh=getIdeaItem(id);if(!fresh)return;openIdeaCustomColorPicker(`${label} 글자색 직접 선택`,ideaTextColorValue(fresh.textColor)||"#20242d",(value)=>{if(!cpPushed){pushIdeaUndo();cpPushed=true;}fresh.textColor=value;scheduleIdeaSave(0);openIdeaItemColorPicker(id);});}));
    $on("ideaItemColorDone","click",closeModal);
    update();
  }
  function bindIdeaCanvasLongPress() {
    const canvas=$("ideaCanvas");let timer=null,start=null;
    const clear=()=>{clearTimeout(timer);timer=null;};
    canvas.addEventListener("pointerdown",(e)=>{
      if(isIdeaReadonly())return;
      if(ideaMultiSelectMode){
        if(e.target!==canvas&&!e.target.closest(".idea-canvas-empty"))return;if(e.button!=null&&e.button!==0)return;
        e.preventDefault();const origin=boardPointFromEvent(e);let box=canvas.querySelector(".idea-selection-box");if(!box){box=document.createElement("div");box.className="idea-selection-box";canvas.appendChild(box);}
        const update=(ev)=>{const p=boardPointFromEvent(ev),x=Math.min(origin.x,p.x),y=Math.min(origin.y,p.y),w=Math.abs(p.x-origin.x),h=Math.abs(p.y-origin.y);box.style.left=x+"px";box.style.top=y+"px";box.style.width=w+"px";box.style.height=h+"px";const ids=[];const d=currentIdeaData();if(d)d.items.forEach((it)=>{if(it.x<x+w&&it.x+it.w>x&&it.y<y+h&&it.y+it.h>y)ids.push(it.id);});setIdeaMultiSelection(ids);};
        const done=(ev)=>{document.removeEventListener("pointermove",update);document.removeEventListener("pointerup",done);document.removeEventListener("pointercancel",done);box.remove();renderIdeaMultiTools();};
        document.addEventListener("pointermove",update,{passive:false});document.addEventListener("pointerup",done);document.addEventListener("pointercancel",done);update(e);return;
      }
      if(e.target!==canvas&&!e.target.closest(".idea-canvas-empty"))return;if(e.button!=null&&e.button!==0)return;start=boardPointFromEvent(e);clear();timer=setTimeout(()=>{ideaPendingPos=start;openIdeaAddMenu(start,true);navigator.vibrate&&navigator.vibrate(10);},520);});
    canvas.addEventListener("pointermove",(e)=>{if(!start)return;const p=boardPointFromEvent(e);if(Math.abs(p.x-start.x)>10||Math.abs(p.y-start.y)>10)clear();});
    canvas.addEventListener("pointerup",()=>{clear();start=null;});canvas.addEventListener("pointercancel",()=>{clear();start=null;});
    canvas.addEventListener("contextmenu",(e)=>{if(isIdeaReadonly())return;if(e.target!==canvas&&!e.target.closest(".idea-canvas-empty"))return;e.preventDefault();const p=boardPointFromEvent(e);ideaPendingPos=p;openIdeaAddMenu(p,true);});
    canvas.addEventListener("pointerdown",(e)=>{if(e.target===canvas&&ideaEditState.itemId)clearIdeaSelection();});
  }
  function itemHasCustomDisplayTitle(item, n) {
    if(!item || !item.title) return false;
    if(item.kind === "quote") return item.title !== ((getNote(item.noteId)||{}).title || "연결된 메모");
    const att=itemAttachment(n,item.fileId); return !!(att && att.name && item.title !== att.name);
  }
  async function replaceIdeaMediaFile(id,file,kind) {
    const n=currentIdeaNote(), item=getIdeaItem(id); if(!n||!item||!file||item.kind!==kind||!ideaCanEditItem(item))return;
    if(kind==="video"&&file.size>IDEA_MAX_VIDEO){toast("동영상은 30MB 이하만 붙일 수 있어요");return;}
    if(file.size>IDEA_MAX_MEDIA){toast("미디어 파일은 30MB 이하만 붙일 수 있어요");return;}
    const expected={image:"image/",audio:"audio/",video:"video/"}[kind];
    if(expected && !String(file.type||"").startsWith(expected)){toast(`${kind==="image"?"이미지":kind==="audio"?"오디오":"동영상"} 파일만 교체할 수 있어요`);return;}
    const d=ensureIdeaBoardData(n), oldId=item.fileId, customTitle=itemHasCustomDisplayTitle(item,n), newId=uid();
    try{
      await put("files",{id:newId,noteId:n.id,name:file.name||"미디어",type:file.type||"application/octet-stream",size:file.size,blob:file,createdAt:now()});
      pushIdeaUndo();
      d.attachments.push({id:newId,name:file.name||"미디어",type:file.type||"",size:file.size});
      item.fileId=newId;
      if(!customTitle)item.title=file.name||"미디어";
      if(oldId && !d.items.some((it)=>it.id!==item.id&&it.fileId===oldId)) { d.attachments=d.attachments.filter((a)=>a.id!==oldId); ideaRemovedBlobIds.add(oldId); const url=ideaObjectUrls.get(oldId);if(url){try{URL.revokeObjectURL(url);}catch(e){}ideaObjectUrls.delete(oldId);} }
      renderIdeaBoard(); scheduleIdeaSave(0); toast("조각을 새 파일로 교체했어요");
    }catch(e){toast("파일을 교체하지 못했어요");}
  }
  function replaceIdeaQuote(id, noteId) {
    const n=currentIdeaNote(), item=getIdeaItem(id), ref=getNote(noteId); if(!n||!item||item.kind!=="quote"||!ref||!ideaCanEditItem(item))return;
    const customTitle=itemHasCustomDisplayTitle(item,n);
    pushIdeaUndo(); item.noteId=ref.id; if(!customTitle)item.title=ref.title||"연결된 메모";
    renderIdeaBoard(); scheduleIdeaSave(0); toast("연결 메모를 교체했어요");
  }
  function openIdeaItemReplacePicker(id) {
    const item=getIdeaItem(id); if(!item)return;
    if(item.kind==="quote"){openIdeaQuotePicker(null,id);return;}
    const input=$(item.kind==="file"?"ideaFileInput":"ideaMediaInput"); if(!input)return;
    input.dataset.ideaKind=item.kind; input.dataset.ideaReplaceId=id; input.click();
  }

  function openIdeaAddMenu(pos, anchored) {
    if (isIdeaReadonly()) return;
    const target=pos||(()=>{const d=currentIdeaData();return d?findIdeaDropPosition(d,ideaItemDefaults("note")):{x:42,y:42};})();ideaPendingPos=target;
    openModal(`<h3>${anchored?"여기에 추가하기":"아이디어 추가"}</h3><p class="m-sub">원하는 조각을 캔버스에 붙여보세요.</p><div class="idea-add-menu"><button class="idea-add-choice" data-idea-add="note"><span class="iac-ico">✦</span><span><b>메모지</b><small>짧은 문장과 러프 아이디어</small></span></button><button class="idea-add-choice" data-idea-add="image"><span class="iac-ico">▧</span><span><b>이미지 · GIF</b><small>원본 비율을 살려 붙여요</small></span></button><button class="idea-add-choice" data-idea-add="audio"><span class="iac-ico">♫</span><span><b>음악 · 오디오</b><small>제목과 플레이어만 깔끔하게</small></span></button><button class="idea-add-choice" data-idea-add="video"><span class="iac-ico">▶</span><span><b>동영상</b><small>30MB 이하 · 원본 비율 유지</small></span></button><button class="idea-add-choice" data-idea-add="quote"><span class="iac-ico">↗</span><span><b>메모 인용 링크</b><small>작성한 다른 메모로 바로 이동</small></span></button><button class="idea-add-choice" data-idea-add="file"><span class="iac-ico">⌁</span><span><b>첨부파일</b><small>파일 조각을 자유 위치에 배치</small></span></button><button class="idea-add-choice" data-idea-add="frame"><span class="iac-ico">□</span><span><b>빈 프레임</b><small>장식용 프레임만 캔버스에 배치</small></span></button><button class="idea-add-choice" data-idea-add="divider"><span class="iac-ico">—</span><span><b>구분선</b><small>실선·점선으로 영역을 나누는 선</small></span></button></div><div class="m-row"><button class="m-btn" id="ideaAddCancel">취소</button></div>`);
    $("modalBox").querySelectorAll("[data-idea-add]").forEach((button)=>button.addEventListener("click",()=>{const kind=button.dataset.ideaAdd;closeModal();if(kind==="note"){const item=addIdeaItem("note",ideaPendingPos);setTimeout(()=>{const el=item&&ideaItemElement(item.id);if(el)el.querySelector(".idea-note-text")?.focus();},50);}else if(kind==="frame"){addIdeaItem("frame",ideaPendingPos,{frame:(FRAMES[0]&&FRAMES[0].id)||null,frameColor:"#d4af37"});}else if(kind==="divider"){addIdeaItem("divider",ideaPendingPos,{title:"구분선",dividerStyle:"solid",color:ideaPreferredColor(),shadow:false});}else if(kind==="quote")openIdeaQuotePicker(ideaPendingPos);else{const inp=$(kind==="file"?"ideaFileInput":"ideaMediaInput");inp.dataset.ideaKind=kind;inp.click();}}));
    $on("ideaAddCancel","click",closeModal);
  }
  function openIdeaQuotePicker(pos, replaceItemId) {
    if (isIdeaReadonly()) return;
    const cur=currentIdeaNote();if(!cur)return;
    const candidates=st.notes.filter((n)=>n.id!==cur.id&&["free","html","lorebook","log","idea","character"].includes(n.type));
    const bodyText=(n)=>{try{return [preview(noteHtml(n)),JSON.stringify(n.data||{}).slice(0,3000)].join(" ");}catch(e){return preview(noteHtml(n));}};
    const searchText=(n)=>[n.title||"",noteTypeShortLabel(n),noteTypeLabel(n),TYPE_TAG[visualMemoType(n)]||"",n.type==="idea"?ideaBoardSummary(n):bodyText(n)].join(" ").toLowerCase();
    let tab="all", selectedProjectId=null, query="";
    const projectName=(pid)=>{const p=getProject(pid);return p?p.name:"프로젝트 없음";};
    const pick=(id)=>{const ref=getNote(id);closeModal();if(!ref)return;if(replaceItemId)replaceIdeaQuote(replaceItemId,ref.id);else addIdeaItem("quote",pos,{noteId:ref.id,title:ref.title||"연결된 메모"});};
    const noteRows=(list)=>list.length?list.map((n)=>`<div class="log-template-item idea-quote-item"><button class="log-template-main" type="button" data-idea-quote="${esc(n.id)}"><span class="log-template-title"><span class="memo-tag t-${visualMemoType(n)}">${TYPE_TAG[visualMemoType(n)]||"?"}</span><b>${esc(n.title||"제목 없는 메모")}</b></span><small>${esc(projectName(n.projectId))} · ${esc(noteTypeShortLabel(n))} · ${esc(n.type==="idea"?ideaBoardSummary(n):preview(noteHtml(n))||"내용 없음")}</small></button></div>`).join(""):'<div class="log-template-empty">검색 결과가 없어요.</div>';
    const projectRows=(list)=>list.length?list.map((p)=>{const count=candidates.filter((n)=>n.projectId===p.id).length;const framed=frameById(p.frame);const thumb=`<span class="idea-quote-project-thumb${framed?" has-frame":""}">${projectThumbMedia(p)}${framed?`<span class="frame">${frameInner(p)}</span>`:""}</span>`;return `<div class="log-template-item idea-quote-project-item"><button class="log-template-main" type="button" data-idea-quote-project="${esc(p.id)}">${thumb}<span class="idea-quote-project-copy"><span class="log-template-title"><b>${esc(p.name||"이름 없는 프로젝트")}</b></span><small>연결 가능한 메모 ${count}개</small></span></button></div>`;}).join(""):'<div class="log-template-empty">표시할 프로젝트가 없어요.</div>';
    openModal(`<div class="log-template-manager idea-quote-manager"><h3>${replaceItemId?"메모 링크 교체":"내 메모 링크"}</h3><p class="m-sub">보드에서 바로 열 수 있는 메모 조각을 선택하세요.</p><div class="log-template-tabs" role="tablist" aria-label="내 메모 링크 구분"><button data-idea-quote-tab="all" role="tab">전체보기 <small></small></button><button data-idea-quote-tab="project" role="tab">프로젝트별 <small></small></button></div><div class="log-template-tools"><input class="m-input" id="ideaQuoteSearch" type="search" autocomplete="off" placeholder="제목·내용·종류 검색"></div><div class="log-template-list idea-quote-results" id="ideaQuoteResults"></div><div class="m-row"><button class="m-btn" id="ideaQuoteProjectBack" type="button" hidden>← 뒤로가기</button><button class="m-btn" id="ideaQuoteCancel">닫기</button></div></div>`);
    $("modalBox").classList.add("log-template-modal","idea-quote-modal");
    $("modalScrim").classList.add("log-template-open");
    const draw=()=>{
      $("modalBox").querySelectorAll("[data-idea-quote-tab]").forEach((button)=>{const active=button.dataset.ideaQuoteTab===tab;button.classList.toggle("active",active);button.setAttribute("aria-selected",active?"true":"false");const small=button.querySelector("small");if(small)small.textContent=button.dataset.ideaQuoteTab==="all"?String(candidates.length):String(st.projects.length);});
      const input=$("ideaQuoteSearch"), back=$("ideaQuoteProjectBack"), box=$("ideaQuoteResults");
      if(!box)return;
      if(input&&document.activeElement!==input)input.value=query;
      const q=query.trim().toLocaleLowerCase("ko");
      if(back) back.hidden=!(tab==="project" && selectedProjectId);
      if(tab==="project" && selectedProjectId==null) {
        if(input)input.placeholder="프로젝트 이름 검색";
        const projects=st.projects.filter((p)=>!q||String(p.name||"").toLocaleLowerCase("ko").includes(q)).sort((a,b)=>String(a.name||"").localeCompare(String(b.name||""),"ko"));
        box.innerHTML=projectRows(projects);
        box.querySelectorAll("[data-idea-quote-project]").forEach((button)=>button.addEventListener("click",()=>{selectedProjectId=button.dataset.ideaQuoteProject;query="";draw();}));
        return;
      }
      if(input)input.placeholder=tab==="project"?`${projectName(selectedProjectId)} 안에서 검색`:"제목·내용·종류 검색";
      const source=(tab==="project"&&selectedProjectId)?candidates.filter((n)=>n.projectId===selectedProjectId):candidates;
      const list=(q?source.filter((n)=>searchText(n).toLocaleLowerCase("ko").includes(q)):source).sort((a,b)=>String(a.title||"").localeCompare(String(b.title||""),"ko"));
      box.innerHTML=source.length?noteRows(list):'<div class="log-template-empty">연결할 메모가 없어요.</div>';
      box.querySelectorAll("[data-idea-quote]").forEach((button)=>button.addEventListener("click",()=>pick(button.dataset.ideaQuote)));
    };
    $("modalBox").querySelectorAll("[data-idea-quote-tab]").forEach((button)=>button.addEventListener("click",()=>{tab=button.dataset.ideaQuoteTab;selectedProjectId=null;query="";draw();}));
    $("ideaQuoteSearch").addEventListener("input",(event)=>{query=event.target.value;draw();});
    $on("ideaQuoteProjectBack","click",()=>{selectedProjectId=null;query="";draw();});
    $on("ideaQuoteCancel","click",closeModal);
    draw();
  }
  function measureIdeaMedia(file, kind) {
    return new Promise((resolve)=>{
      if(!file || !["image","video"].includes(kind))return resolve(null);
      const url=URL.createObjectURL(file);
      const done=(value)=>{try{URL.revokeObjectURL(url)}catch(e){}resolve(value);};
      if(kind==="image"){const img=new Image();img.onload=()=>done(img.naturalWidth&&img.naturalHeight?{w:img.naturalWidth,h:img.naturalHeight}:null);img.onerror=()=>done(null);img.src=url;}
      else {const video=document.createElement("video");video.preload="metadata";video.onloadedmetadata=()=>done(video.videoWidth&&video.videoHeight?{w:video.videoWidth,h:video.videoHeight}:null);video.onerror=()=>done(null);video.src=url;}
    });
  }
  function ideaMediaSize(kind, dims) {
    const def=ideaItemDefaults(kind);if(!dims||!dims.w||!dims.h)return {w:def.w,h:def.h,aspect:def.w/def.h};const aspect=dims.w/dims.h;let w=Math.min(460,Math.max(180,dims.w));let h=w/aspect;if(h>340){h=340;w=h*aspect;}if(w>560){w=560;h=w/aspect;}return {w:Math.round(w),h:Math.round(h),aspect};
  }
  async function addIdeaMediaFile(file, kind) {
    const n=currentIdeaNote();if(!n||!file)return;
    if(kind==="video"&&file.size>IDEA_MAX_VIDEO){toast("동영상은 30MB 이하만 붙일 수 있어요");return;}if(file.size>IDEA_MAX_MEDIA){toast("미디어 파일은 30MB 이하만 붙일 수 있어요");return;}
    const id=uid();try{const dims=await measureIdeaMedia(file,kind);await put("files",{id,noteId:n.id,name:file.name||"미디어",type:file.type||"application/octet-stream",size:file.size,blob:file,createdAt:now()});const d=ensureIdeaBoardData(n);d.attachments.push({id,name:file.name||"미디어",type:file.type||"",size:file.size});const keepAspect=["image","video"].includes(kind);const size=keepAspect?ideaMediaSize(kind,dims):{};addIdeaItem(kind,ideaPendingPos,{fileId:id,title:file.name||"미디어",...size,lockAspect:keepAspect});toast(kind==="image"?"이미지를 붙였어요":kind==="audio"?"오디오를 붙였어요":kind==="video"?"동영상을 붙였어요":"파일을 붙였어요");}catch(e){toast("파일을 보드에 저장하지 못했어요");}
  }
  function canvasBackgroundImageStatus(d) {
    const image=d && d.canvas && normalizeIdeaCanvasImage(d.canvas.backgroundImage);
    return image ? (image.name || "캔버스 이미지") : "업로드한 이미지 없음";
  }
  function refreshIdeaCanvasImageControls() {
    const n=currentIdeaNote(); if(!n) return; const d=ensureIdeaBoardData(n), image=normalizeIdeaCanvasImage(d.canvas.backgroundImage);
    const status=$("ideaBgImageStatus"), remove=$("ideaBgImageRemove"), opacity=$("ideaBgOverlayOpacity"), value=$("ideaBgOverlayValue"), pick=$("ideaBgImagePick"), preview=$("ideaBgImagePreview");
    if(status) status.textContent=canvasBackgroundImageStatus(d);
    if(remove) remove.hidden=!image;
    if(pick) pick.textContent=image?"파일 다시 선택":"파일 선택";
    if(opacity) { opacity.disabled=!image; opacity.value=String(Math.round((image ? image.overlayOpacity : 0)*100)); }
    if(value) value.textContent=`${Math.round((image ? image.overlayOpacity : 0)*100)}%`;
    if(preview) {
      applyIdeaCanvasAppearance(preview,{canvas:{...d.canvas, backgroundMode:image ? "image" : d.canvas.backgroundMode}});
      const title=preview.querySelector(".idea-bg-upload-title"), sub=preview.querySelector(".idea-bg-upload-sub");
      if (!image) preview.dataset.background = "upload-placeholder";
      if(title) title.textContent=image ? (image.name || "캔버스 이미지") : "미리보기를 눌러 파일 선택";
      if(sub) sub.textContent=image ? "새 파일을 고르면 보드 비율에 맞춰 다시 크롭합니다." : "일반 파일 선택기로 이미지를 고릅니다.";
    }
  }
  async function saveIdeaCanvasBackgroundBlob(blob, name) {
    const n=currentIdeaNote(); if(!n||!blob) return;
    if(blob.size>IDEA_MAX_MEDIA){toast("캔버스 이미지는 30MB 이하만 사용할 수 있어요");return;}
    const d=ensureIdeaBoardData(n), old=normalizeIdeaCanvasImage(d.canvas.backgroundImage), id=uid();
    pushIdeaUndo();
    const fileName=String(name||"캔버스 이미지").slice(0,240) || "캔버스 이미지";
    try {
      await put("files",{id,noteId:n.id,name:fileName,type:blob.type||"image/jpeg",size:blob.size,blob,createdAt:now()});
      d.attachments.push({id,name:fileName,type:blob.type||"image/jpeg",size:blob.size});
      d.canvas.backgroundImage={fileId:id,name:fileName,overlayColor:old ? old.overlayColor : ideaPreferredColor(),overlayOpacity:old ? old.overlayOpacity : .24};
      d.canvas.backgroundMode="image";
      if(old && old.fileId && !d.items.some((item)=>item.fileId===old.fileId)) { d.attachments=d.attachments.filter((a)=>a.id!==old.fileId); await del("files",old.fileId).catch(()=>{}); const url=ideaObjectUrls.get(old.fileId);if(url){try{URL.revokeObjectURL(url)}catch(e){}ideaObjectUrls.delete(old.fileId);} }
      const canvas=$("ideaCanvas"); if(canvas) applyIdeaCanvasAppearance(canvas,d); refreshIdeaCanvasImageControls(); scheduleIdeaSave(0); toast("캔버스 배경 이미지를 적용했어요");
    } catch(e) { toast("캔버스 이미지를 저장하지 못했어요"); }
  }
  async function addIdeaCanvasBackgroundImage(file) {
    const n=currentIdeaNote(); if(!n||!file) return;
    if(!isLikelyImageFile(file)){toast("캔버스 배경에는 이미지 파일만 사용할 수 있어요");return;}
    if(file.size>IDEA_MAX_MEDIA){toast("캔버스 이미지는 30MB 이하만 사용할 수 있어요");return;}
    const d=ensureIdeaBoardData(n), ratio=d.canvas.width/d.canvas.height;
    const maxOut=2400, scale=Math.min(1,maxOut/Math.max(d.canvas.width,d.canvas.height));
    const outW=Math.max(1,Math.round(d.canvas.width*scale)), outH=Math.max(1,Math.round(d.canvas.height*scale));
    toast("배경으로 쓸 영역을 보드 비율에 맞게 잘라주세요");
    startCrop(file,ratio,outW,outH,async(data)=>{
      const blob=ideaDataUrlAsBlob(data,"image/jpeg");
      if(!blob){toast("크롭한 이미지를 읽지 못했어요");return;}
      await saveIdeaCanvasBackgroundBlob(blob,file.name||"캔버스 이미지.jpg");
    },{maxBytes:IDEA_MAX_MEDIA,maxPixels:48*1000*1000,limitText:"캔버스 이미지는 30MB 이하, 4,800만 픽셀 이하만 사용할 수 있어요"});
  }
  function removeIdeaCanvasBackgroundImage() {
    const n=currentIdeaNote(); if(!n) return; const d=ensureIdeaBoardData(n), image=normalizeIdeaCanvasImage(d.canvas.backgroundImage); if(!image)return;
    pushIdeaUndo();
    d.canvas.backgroundImage=null; d.canvas.backgroundMode="template"; d.attachments=d.attachments.filter((a)=>a.id!==image.fileId); del("files",image.fileId).catch(()=>{});
    const url=ideaObjectUrls.get(image.fileId);if(url){try{URL.revokeObjectURL(url)}catch(e){}ideaObjectUrls.delete(image.fileId);}
    const canvas=$("ideaCanvas");if(canvas)applyIdeaCanvasAppearance(canvas,d);refreshIdeaCanvasImageControls();scheduleIdeaSave(0);toast("캔버스 이미지를 제거했어요");
  }
  function ideaPresetThumbStyle(preset, overlay) {
    if (!preset) return "";
    const color=ideaColorMeta(overlay && overlay.overlayColor || ideaPreferredColor());
    const opacity=Math.max(0,Math.min(.92,Number(overlay && overlay.overlayOpacity) || 0));
    return `--idea-canvas-image:${ideaCssUrl(preset.src)};--idea-canvas-overlay:${rgbaHex(color.ig[0],opacity)};`;
  }
  function renderIdeaPresetBackgroundChoice(key, preset, selected, overlay) {
    const style=ideaPresetThumbStyle(preset, overlay);
    return `<button type="button" class="idea-template-choice idea-template-card${selected?" active":""}" data-idea-preset-bg="${esc(key)}" aria-pressed="${selected?"true":"false"}"><span class="idea-template-preview idea-template-preview-bg"><span class="idea-template-thumb idea-template-bg-thumb idea-canvas has-canvas-image" data-background="preset" style="${esc(style)}" aria-hidden="true"><i>▧</i></span></span><span class="idea-template-copy"><b>${esc(preset.label)}</b><small>${esc(preset.desc || "제공 이미지 배경")}</small></span><span class="idea-template-state">${selected?"선택됨":"선택"}</span></button>`;
  }
  function openIdeaBoardBackgroundPicker(n) {
    const d=ensureIdeaBoardData(n), image=normalizeIdeaCanvasImage(d.canvas.backgroundImage), preset=normalizeIdeaCanvasPreset(d.canvas.backgroundPreset);
    const imageActive=!!image && d.canvas.backgroundMode === "image", presetActive=!!preset && d.canvas.backgroundMode === "preset";
    let bgPushed=false;
    const commitTemplate=(key)=>{ if(!bgPushed){pushIdeaUndo();bgPushed=true;} d.canvas.background=key; d.canvas.backgroundMode="template"; scheduleIdeaSave(0); const c=$("ideaCanvas");if(c)applyIdeaCanvasAppearance(c,d); };
    const currentPlain=ideaPlainBackgroundMeta(d.canvas.background);
    const colorKey=currentPlain?d.canvas.background:`plain-${ideaPreferredColor()}`;
    const colorCard=`<button type="button" class="idea-template-choice idea-template-card idea-bg-special${!imageActive&&!presetActive&&currentPlain?" active":""}" id="ideaBgOpenColors" aria-pressed="${!imageActive&&!presetActive&&currentPlain?"true":"false"}"><span class="idea-template-preview idea-template-preview-bg"><span class="idea-template-thumb idea-template-bg-thumb idea-canvas" data-background="${esc(colorKey)}" style="${ideaCanvasPlainStyle(colorKey)}" aria-hidden="true"><i>●</i></span></span><span class="idea-template-copy"><b>컬러 캔버스</b><small>기본 색상과 더 밝은 색상을 한 화면에서 선택</small></span><span class="idea-template-state">${!imageActive&&!presetActive&&currentPlain?"선택됨":"열기"}</span></button>`;
    const presetMeta=preset ? ideaPresetBackgroundMeta(preset.key) : null;
    const presetDefaultKey=defaultIdeaImageBackgroundKey(), presetDefaultMeta=ideaPresetBackgroundMeta(presetDefaultKey);
    const presetPreviewMeta=presetMeta || presetDefaultMeta, presetPreviewOverlay=preset || { key:presetDefaultKey, overlayColor:ideaPreferredColor(), overlayOpacity:.24 };
    const presetThumb=presetPreviewMeta ? `<span class="idea-template-thumb idea-template-bg-thumb idea-canvas has-canvas-image" data-background="preset" style="${esc(ideaPresetThumbStyle(presetPreviewMeta,presetPreviewOverlay))}" aria-hidden="true"><i>▧</i></span>` : `<span class="idea-template-thumb idea-template-bg-thumb idea-canvas idea-bg-thumb-placeholder" data-background="preset-placeholder" aria-hidden="true"><i>🐋</i></span>`;
    const presetCard=`<button type="button" class="idea-template-choice idea-template-card idea-bg-special${presetActive?" active":""}" id="ideaBgOpenPreset" aria-pressed="${presetActive?"true":"false"}"><span class="idea-template-preview idea-template-preview-bg">${presetThumb}</span><span class="idea-template-copy"><b>이미지 배경</b><small>${esc(presetMeta ? presetMeta.label : "19종 제공 이미지 · 오버레이 조절")}</small></span><span class="idea-template-state">${presetActive?"선택됨":"열기"}</span></button>`;
    const rows=Object.entries(IDEA_BG_TEMPLATES).filter(([key])=>!ideaPlainBackgroundMeta(key)).map(([key,t])=>renderIdeaTemplateChoice("background",key,t,!imageActive&&!presetActive&&d.canvas.background===key)).join("");
    const imageCard=`<button type="button" class="idea-template-choice idea-template-card idea-bg-special${imageActive?" active":""}" id="ideaBgOpenImage" aria-pressed="${imageActive?"true":"false"}"><span class="idea-template-preview idea-template-preview-bg">${imageActive?`<span class="idea-template-thumb idea-template-bg-thumb idea-canvas" data-background="uploaded" aria-hidden="true"><i>▧</i></span>`:`<span class="idea-template-thumb idea-template-bg-thumb idea-canvas idea-bg-thumb-placeholder" data-background="upload-placeholder" style="--upload-thumb:${ideaColorMeta(ideaPreferredColor()).ig[0]};" aria-hidden="true"><i>⤴</i></span>`}</span><span class="idea-template-copy"><b>이미지 업로드</b><small>${esc(image?canvasBackgroundImageStatus(d):"파일 선택, 크롭, 오버레이 조절")}</small></span><span class="idea-template-state">${imageActive?"선택됨":image?"저장됨":"설정"}</span></button>`;
    openModal(`<h3>보드 배경</h3><p class="m-sub">한 번에 하나의 배경만 활성화됩니다. 제공 이미지와 업로드 이미지는 모두 오버레이 컬러·투명도를 조절할 수 있어요.</p><div class="idea-template-grid">${colorCard}${presetCard}${rows}${imageCard}</div><div class="m-row"><button class="m-btn" id="ideaBgDone">완료</button></div>`);
    $("modalBox").querySelectorAll("[data-idea-bg]").forEach((b)=>b.addEventListener("click",()=>{commitTemplate(b.dataset.ideaBg); $("modalBox").querySelectorAll("[data-idea-bg]").forEach(x=>{const on=d.canvas.backgroundMode==="template"&&x===b;x.classList.toggle("active",on);x.setAttribute("aria-pressed",String(on));const state=x.querySelector(".idea-template-state");if(state)state.textContent=on?"선택됨":"선택";});}));
    $on("ideaBgOpenColors","click",()=>openIdeaColorCanvasPicker(n));
    $on("ideaBgOpenPreset","click",()=>{ if(preset && d.canvas.backgroundMode!=="preset"){if(!bgPushed){pushIdeaUndo();bgPushed=true;}d.canvas.backgroundMode="preset";scheduleIdeaSave(0);const c=$("ideaCanvas");if(c)applyIdeaCanvasAppearance(c,d);} openIdeaPresetImageBackgroundPicker(n); });
    $on("ideaBgOpenImage","click",()=>{ if(image && d.canvas.backgroundMode!=="image"){if(!bgPushed){pushIdeaUndo();bgPushed=true;}d.canvas.backgroundMode="image";scheduleIdeaSave(0);const c=$("ideaCanvas");if(c)applyIdeaCanvasAppearance(c,d);} openIdeaCanvasImagePicker(n); });
    $on("ideaBgDone","click",closeModal);
  }
  function openIdeaPresetImageBackgroundPicker(n) {
    const d=ensureIdeaBoardData(n), existing=normalizeIdeaCanvasPreset(d.canvas.backgroundPreset);
    const entries=Object.entries(IDEA_IMAGE_BACKGROUND_PRESETS);
    if (!entries.length) { toast("제공 이미지 배경을 찾지 못했어요"); return; }
    let pushed=false;
    const initialKey=(existing && existing.key) || defaultIdeaImageBackgroundKey() || entries[0][0];
    const ensurePreset=(key)=>{
      const current=normalizeIdeaCanvasPreset(d.canvas.backgroundPreset);
      const nextKey=Object.prototype.hasOwnProperty.call(IDEA_IMAGE_BACKGROUND_PRESETS,key) ? key : initialKey;
      return { key:nextKey, overlayColor:current ? current.overlayColor : ideaPreferredColor(), overlayOpacity:current ? current.overlayOpacity : .24 };
    };
    if (!existing) d.canvas.backgroundPreset=ensurePreset(initialKey);
    const render=()=>{
      const current=normalizeIdeaCanvasPreset(d.canvas.backgroundPreset) || ensurePreset(initialKey);
      const meta=ideaPresetBackgroundMeta(current.key);
      const rows=entries.map(([key,p])=>renderIdeaPresetBackgroundChoice(key,p,current.key===key,current)).join("");
      openModal(`<h3>이미지 배경</h3><p class="m-sub">제공된 19종 그림을 먼저 고릅니다. 다음 단계에서 오버레이 컬러와 투명도를 조정합니다.</p><div class="idea-bg-live-preview idea-canvas has-canvas-image idea-bg-preset-preview" id="ideaBgPresetPreview" data-background="preset" style="${esc(ideaPresetThumbStyle(meta,current))}"><span>${esc(meta ? meta.label : "이미지 배경 미리보기")}</span></div><div class="idea-options-label">제공 이미지</div><div class="idea-template-grid idea-template-grid-compact idea-bg-preset-list">${rows}</div><div class="m-row"><button class="m-btn" id="ideaBgPresetBack">배경 목록</button><button class="m-btn primary" id="ideaBgPresetNext">다음</button></div>`);
      const refresh=()=>{
        const fresh=normalizeIdeaCanvasPreset(d.canvas.backgroundPreset) || ensurePreset(initialKey), freshMeta=ideaPresetBackgroundMeta(fresh.key), preview=$("ideaBgPresetPreview");
        if(preview && freshMeta){ preview.dataset.background="preset"; preview.classList.add("has-canvas-image"); preview.setAttribute("style",ideaPresetThumbStyle(freshMeta,fresh)); const label=preview.querySelector("span"); if(label)label.textContent=freshMeta.label || "이미지 배경 미리보기"; }
        $("modalBox").querySelectorAll("[data-idea-preset-bg]").forEach((x)=>{const on=x.dataset.ideaPresetBg===fresh.key;x.classList.toggle("active",on);x.setAttribute("aria-pressed",String(on));const state=x.querySelector(".idea-template-state");if(state)state.textContent=on?"선택됨":"선택";});
        const c=$("ideaCanvas"); if(c)applyIdeaCanvasAppearance(c,d);
      };
      $("modalBox").querySelectorAll("[data-idea-preset-bg]").forEach((button)=>button.addEventListener("click",()=>{if(!pushed){pushIdeaUndo();pushed=true;}d.canvas.backgroundPreset=ensurePreset(button.dataset.ideaPresetBg);d.canvas.backgroundMode="preset";scheduleIdeaSave(0);refresh();}));
      $on("ideaBgPresetBack","click",()=>openIdeaBoardBackgroundPicker(n));
      $on("ideaBgPresetNext","click",()=>{if(d.canvas.backgroundMode!=="preset"){if(!pushed){pushIdeaUndo();pushed=true;}d.canvas.backgroundMode="preset";scheduleIdeaSave(0);const c=$("ideaCanvas");if(c)applyIdeaCanvasAppearance(c,d);}openIdeaPresetOverlayPicker(n);});
    };
    render();
  }

  function openIdeaPresetOverlayPicker(n) {
    const d=ensureIdeaBoardData(n), entries=Object.entries(IDEA_IMAGE_BACKGROUND_PRESETS);
    if (!entries.length) { toast("제공 이미지 배경을 찾지 못했어요"); return; }
    let pushed=false;
    const fallbackKey=defaultIdeaImageBackgroundKey() || entries[0][0];
    const ensurePreset=()=>{
      const current=normalizeIdeaCanvasPreset(d.canvas.backgroundPreset);
      return current || { key:fallbackKey, overlayColor:ideaPreferredColor(), overlayOpacity:.24 };
    };
    if(!normalizeIdeaCanvasPreset(d.canvas.backgroundPreset)) d.canvas.backgroundPreset=ensurePreset();
    const current=ensurePreset(), meta=ideaPresetBackgroundMeta(current.key);
    const colors=ideaColorChoicesMarkup(current.overlayColor,"data-idea-preset-overlay-color",true);
    openModal(`<h3>이미지 배경 조정</h3><p class="m-sub">선택한 이미지 위에 올릴 오버레이 컬러와 투명도를 조정합니다.</p><div class="idea-bg-live-preview idea-canvas has-canvas-image idea-bg-preset-preview" id="ideaBgPresetPreview" data-background="preset" style="${esc(ideaPresetThumbStyle(meta,current))}"><span>${esc(meta ? meta.label : "이미지 배경 미리보기")}</span></div><div class="idea-options-label">이미지 오버레이 컬러</div><div class="idea-color-grid palette-grid">${colors}</div><label class="idea-overlay-range"><span>오버레이 투명도 <b id="ideaBgPresetOverlayValue">${Math.round(current.overlayOpacity*100)}%</b></span><input id="ideaBgPresetOverlayOpacity" type="range" min="0" max="92" step="1" value="${Math.round(current.overlayOpacity*100)}"></label><div class="m-row"><button class="m-btn" id="ideaBgPresetBack">이미지 다시 선택</button><button class="m-btn primary" id="ideaBgPresetDone">완료</button></div>`);
    const refresh=()=>{
      const fresh=ensurePreset(), freshMeta=ideaPresetBackgroundMeta(fresh.key), preview=$("ideaBgPresetPreview");
      if(preview && freshMeta) preview.setAttribute("style",ideaPresetThumbStyle(freshMeta,fresh));
      const label=$("ideaBgPresetOverlayValue"); if(label)label.textContent=`${Math.round(fresh.overlayOpacity*100)}%`;
      $("modalBox").querySelectorAll("[data-idea-preset-overlay-color]").forEach((x)=>x.classList.toggle("active",x.dataset.ideaPresetOverlayColor===fresh.overlayColor));
      const c=$("ideaCanvas"); if(c)applyIdeaCanvasAppearance(c,d);
    };
    $("modalBox").querySelectorAll("[data-idea-preset-overlay-color]").forEach((button)=>button.addEventListener("click",()=>{if(!pushed){pushIdeaUndo();pushed=true;}const fresh=ensurePreset();fresh.overlayColor=button.dataset.ideaPresetOverlayColor;d.canvas.backgroundPreset=fresh;d.canvas.backgroundMode="preset";scheduleIdeaSave(0);refresh();}));
    $("modalBox").querySelectorAll('[data-idea-custom-color="data-idea-preset-overlay-color"]').forEach((button)=>button.addEventListener("click",()=>{const current=ensurePreset();openIdeaCustomColorPicker("이미지 배경 오버레이 색상",current.overlayColor,(value)=>{if(!pushed){pushIdeaUndo();pushed=true;}const fresh=ensurePreset();fresh.overlayColor=value;d.canvas.backgroundPreset=fresh;d.canvas.backgroundMode="preset";scheduleIdeaSave(0);openIdeaPresetOverlayPicker(n);});}));
    $on("ideaBgPresetOverlayOpacity","input",(e)=>{if(!pushed){pushIdeaUndo();pushed=true;}const fresh=ensurePreset();fresh.overlayOpacity=Math.max(0,Math.min(.92,Number(e.target.value)/100));d.canvas.backgroundPreset=fresh;d.canvas.backgroundMode="preset";scheduleIdeaSave(180);refresh();});
    $on("ideaBgPresetBack","click",()=>openIdeaPresetImageBackgroundPicker(n));
    $on("ideaBgPresetDone","click",closeModal);
  }

  function openIdeaColorCanvasPicker(n) {
    const d=ensureIdeaBoardData(n);
    let bgPushed=false;
    const entries=Object.entries({ ...IDEA_PLAIN_BACKGROUND_TEMPLATES, ...IDEA_LIGHT_BACKGROUND_TEMPLATES });
    const previewKey=ideaPlainBackgroundMeta(d.canvas.background)?d.canvas.background:`plain-${ideaPreferredColor()}`;
    const rows=entries.map(([key,t])=>renderIdeaTemplateChoice("background",key,t,d.canvas.background===key)).join("");
    openModal(`<h3>컬러 캔버스</h3><p class="m-sub">기존 컬러와 더 밝은 라이트 컬러를 고를 수 있어요. 선택 즉시 보드와 미리보기에 반영됩니다.</p><div class="idea-bg-live-preview idea-canvas" id="ideaBgColorPreview" data-background="${esc(previewKey)}" style="${ideaCanvasPlainStyle(previewKey)}"><span>컬러 캔버스 미리보기</span></div><div class="idea-template-grid idea-template-grid-compact">${rows}</div><div class="m-row"><button class="m-btn" id="ideaBgColorBack">배경 목록</button><button class="m-btn primary" id="ideaBgColorDone">완료</button></div>`);
    const refresh=()=>{const key=ideaPlainBackgroundMeta(d.canvas.background)?d.canvas.background:previewKey, preview=$("ideaBgColorPreview"); if(preview){preview.dataset.background=key; preview.setAttribute("style",ideaCanvasPlainStyle(key));} $("modalBox").querySelectorAll("[data-idea-bg]").forEach(x=>{const on=d.canvas.backgroundMode==="template"&&x.dataset.ideaBg===d.canvas.background;x.classList.toggle("active",on);x.setAttribute("aria-pressed",String(on));const state=x.querySelector(".idea-template-state");if(state)state.textContent=on?"선택됨":"선택";}); const c=$("ideaCanvas");if(c)applyIdeaCanvasAppearance(c,d);};
    $("modalBox").querySelectorAll("[data-idea-bg]").forEach((b)=>b.addEventListener("click",()=>{if(!bgPushed){pushIdeaUndo();bgPushed=true;}d.canvas.background=b.dataset.ideaBg;d.canvas.backgroundMode="template";scheduleIdeaSave(0);refresh();}));
    $on("ideaBgColorBack","click",()=>openIdeaBoardBackgroundPicker(n));
    $on("ideaBgColorDone","click",closeModal);
  }
  function openIdeaCanvasImagePicker(n) {
    const d=ensureIdeaBoardData(n), image=normalizeIdeaCanvasImage(d.canvas.backgroundImage);
    const colors=ideaColorChoicesMarkup(image ? image.overlayColor : ideaPreferredColor(),"data-idea-bg-overlay-color",true);
    openModal(`<h3>이미지 업로드 배경</h3><p class="m-sub">미리보기 화면을 누르거나 파일 선택 버튼으로 이미지를 고른 뒤, 보드 비율에 맞게 크롭합니다.</p><button type="button" class="idea-bg-upload-preview idea-canvas" id="ideaBgImagePreview" data-background="${esc(d.canvas.background)}" style="${ideaCanvasPlainStyle(d.canvas.background)}"><span><b class="idea-bg-upload-title">${esc(image?image.name||"캔버스 이미지":"미리보기를 눌러 파일 선택")}</b><small class="idea-bg-upload-sub">${image?"새 파일을 고르면 다시 크롭합니다.":"일반 파일 선택기로 이미지를 고릅니다."}</small></span></button><div class="idea-bg-image-panel idea-bg-image-panel-compact"><div class="idea-bg-file-actions"><button class="m-btn primary" id="ideaBgImagePick">${image?"파일 다시 선택":"파일 선택"}</button><button class="m-btn danger" id="ideaBgImageRemove" ${image?"":"hidden"}>제거</button></div><div class="idea-options-label">이미지 오버레이 컬러</div><div class="idea-color-grid palette-grid">${colors}</div><label class="idea-overlay-range"><span>오버레이 투명도 <b id="ideaBgOverlayValue">${Math.round((image?image.overlayOpacity:0)*100)}%</b></span><input id="ideaBgOverlayOpacity" type="range" min="0" max="92" step="1" value="${Math.round((image?image.overlayOpacity:0)*100)}" ${image?"":"disabled"}></label></div><div class="m-row"><button class="m-btn" id="ideaBgImageBack">배경 목록</button><button class="m-btn primary" id="ideaBgImageDone">완료</button></div>`);
    refreshIdeaCanvasImageControls();
    const pick=()=>$("ideaCanvasBgInput").click();
    $on("ideaBgImagePreview","click",pick);
    $on("ideaBgImagePick","click",pick);
    $on("ideaBgImageRemove","click",removeIdeaCanvasBackgroundImage);
    $("modalBox").querySelectorAll("[data-idea-bg-overlay-color]").forEach((b)=>b.addEventListener("click",()=>{const fresh=normalizeIdeaCanvasImage(d.canvas.backgroundImage);if(!fresh){toast("먼저 배경 이미지를 업로드해주세요");return;}fresh.overlayColor=b.dataset.ideaBgOverlayColor;d.canvas.backgroundImage=fresh;d.canvas.backgroundMode="image";scheduleIdeaSave(0);$("modalBox").querySelectorAll("[data-idea-bg-overlay-color]").forEach(x=>x.classList.toggle("active",x===b));const c=$("ideaCanvas");if(c)applyIdeaCanvasAppearance(c,d);refreshIdeaCanvasImageControls();}));
    $("modalBox").querySelectorAll('[data-idea-custom-color="data-idea-bg-overlay-color"]').forEach((b)=>b.addEventListener("click",()=>{const fresh=normalizeIdeaCanvasImage(d.canvas.backgroundImage);if(!fresh){toast("먼저 배경 이미지를 업로드해주세요");return;}openIdeaCustomColorPicker("업로드 배경 오버레이 색상",fresh.overlayColor,(value)=>{const next=normalizeIdeaCanvasImage(d.canvas.backgroundImage);if(!next)return;next.overlayColor=value;d.canvas.backgroundImage=next;d.canvas.backgroundMode="image";scheduleIdeaSave(0);openIdeaCanvasImagePicker(n);});}));
    $on("ideaBgOverlayOpacity","input",(e)=>{const fresh=normalizeIdeaCanvasImage(d.canvas.backgroundImage);if(!fresh){refreshIdeaCanvasImageControls();return;}fresh.overlayOpacity=Math.max(0,Math.min(.92,Number(e.target.value)/100));d.canvas.backgroundImage=fresh;d.canvas.backgroundMode="image";const c=$("ideaCanvas");if(c)applyIdeaCanvasAppearance(c,d);refreshIdeaCanvasImageControls();scheduleIdeaSave(180);});
    $on("ideaBgImageBack","click",()=>openIdeaBoardBackgroundPicker(n));
    $on("ideaBgImageDone","click",closeModal);
  }
  function ideaExportSafeName(value) { return (String(value || "idea-board").replace(/[\\/:*?"<>|]+/g, "_").trim().slice(0, 80) || "idea-board"); }
  function ideaBlobAsDataUrl(blob) {
    return new Promise((resolve, reject) => { const reader=new FileReader(); reader.onload=()=>resolve(String(reader.result || "")); reader.onerror=()=>reject(reader.error || new Error("file read error")); reader.readAsDataURL(blob); });
  }
  function ideaDataUrlAsBlob(value, fallbackType) {
    try {
      const match=String(value || "").match(/^data:([^;,]+)?;base64,([\s\S]+)$/i); if(!match) return null;
      const binary=atob(match[2].replace(/\s/g,"")), bytes=new Uint8Array(binary.length);
      for(let i=0;i<binary.length;i++) bytes[i]=binary.charCodeAt(i);
      return new Blob([bytes],{type:match[1] || fallbackType || "application/octet-stream"});
    } catch(e) { return null; }
  }
  function ideaCssUrl(value) { return `url("${String(value || "").replace(/["\\\r\n]/g,"\\$&")}")`; }
  async function collectIdeaExportStyles() {
    // 현재 앱과 함께 등록된 CSS에서 idea-* 규칙을 추출합니다.
    // cssRules 접근이 막히는 환경을 대비해 템플릿 CSS 파일도 직접 읽어 독립 HTML에 포함합니다.
    const blocks = [];
    const seen = new Set();
    const addBlock = (css) => {
      const text = String(css || "").trim();
      if (!text || seen.has(text)) return;
      seen.add(text); blocks.push(text);
    };
    const walk = (rules) => Array.from(rules || []).map((rule) => {
      try {
        if (rule.cssRules) {
          const inner = walk(rule.cssRules);
          if (!inner) return "";
          const cssText = String(rule.cssText || "");
          const head = cssText.slice(0, cssText.indexOf("{"));
          return `${head}{${inner}}`;
        }
        const css = String(rule.cssText || "");
        return /\.idea-(?:canvas|item|sticky|note|media|audio|file|quote|preview|export|template|bg|color|options|overlay|frame|divider)/.test(css) ? css : "";
      } catch (e) { return ""; }
    }).join("\n");
    Array.from(document.styleSheets || []).forEach((sheet) => {
      try { addBlock(walk(sheet.cssRules)); } catch (e) {}
    });
    const links = Array.from(document.querySelectorAll('link[rel~="stylesheet"][href]'))
      .map((link) => link.getAttribute("href") || "")
      .filter((href) => /idea-board-custom-templates\.css(?:[?#].*)?$/i.test(href));
    for (const href of links) {
      try {
        const response = await fetch(href, { cache: "no-store" });
        if (response && response.ok) addBlock(await response.text());
      } catch (e) {}
    }
    return blocks.join("\n");
  }
  function ideaExportBaseCss() {
    return `:root{--surface:#fff;--surface-2:#f3f6fb;--line:#dfe5ef;--ink:#232936;--muted:#6f7889;--accent:#5c7cfa;--accent-soft:#edf1ff;--bg:#eef1f7;--user-font:ui-sans-serif,system-ui,-apple-system,"Apple SD Gothic Neo","Noto Sans KR",sans-serif}*{box-sizing:border-box}html,body{margin:0;min-height:100%;background:#edf1f7;color:#202633;font-family:var(--user-font)}body{padding:32px;min-width:320px}.idea-export{width:max-content;min-width:100%;margin:0 auto}.idea-export-head{width:min(1600px,100%);margin:0 auto 16px;display:flex;justify-content:space-between;gap:12px;align-items:baseline;color:#485267}.idea-export-head h1{margin:0;font-size:22px;letter-spacing:-.02em}.idea-export-head p{margin:0;font-size:12px;color:#778196}.idea-export-stage{width:100%;overflow:auto;padding:18px;background:rgba(255,255,255,.7);border:1px solid #dfe5ef;border-radius:20px;box-shadow:0 18px 48px rgba(36,49,75,.12)}.idea-canvas{position:relative;isolation:isolate;overflow:visible;margin:0 auto}.idea-canvas::after{content:"";position:absolute;inset:0;pointer-events:none;z-index:0}.idea-canvas>*{position:relative;z-index:1}.idea-item{position:absolute;min-width:110px;min-height:54px;transform:rotate(var(--idea-rot,0deg));transform-origin:center center}.idea-sticky{overflow:visible;isolation:isolate}.idea-note-text{position:relative;display:block;width:100%;height:100%;min-height:54px;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere;color:var(--stick-ink,#27303a);font:650 14px/1.62 var(--user-font);padding:18px 15px 15px}.idea-media-content{width:100%;height:100%;display:grid;place-items:center;overflow:hidden;border-radius:12px;background:rgba(9,13,20,.72);box-shadow:0 14px 25px rgba(0,0,0,.26)}.idea-image .idea-media-content{overflow:visible;border-radius:0;background:transparent;box-shadow:none}.idea-image img,.idea-video video{display:block;width:100%;height:100%;object-fit:contain;background:transparent}.idea-image img{filter:drop-shadow(0 9px 12px rgba(0,0,0,.20))}.idea-audio-shell{height:100%;display:flex;align-items:center;gap:11px;padding:12px 14px;border-radius:999px;background:var(--idea-color-grad,linear-gradient(135deg,#7b9bff,#b58bff));color:#fff;box-shadow:0 14px 25px rgba(72,93,185,.28),inset 0 1px 0 rgba(255,255,255,.30)}.idea-audio-icon{width:42px;height:42px;display:grid;place-items:center;flex:0 0 auto;border-radius:50%;background:rgba(255,255,255,.19);border:1px solid rgba(255,255,255,.30);font-size:23px}.idea-audio .idea-media-content{height:42px;flex:1;min-width:0;background:transparent;box-shadow:none}.idea-audio audio{width:100%;height:42px}.idea-file-body,.idea-quote-body{width:100%;height:100%;display:flex;align-items:center;gap:11px;padding:12px 15px;border-radius:999px;background:var(--idea-chip-fill,#f7f8fe);border:1px solid var(--idea-chip-edge,#cfd7ff);color:var(--idea-chip-ink,#20242d);box-shadow:0 10px 18px rgba(0,0,0,.13);font:750 13px/1.2 var(--user-font);text-decoration:none;overflow:hidden}.idea-file-icon,.idea-quote-mark{width:30px;height:30px;display:grid;place-items:center;flex:0 0 auto;border-radius:50%;background:var(--idea-color-grad,linear-gradient(135deg,#7b9bff,#b58bff));color:#fff;font-size:17px}.idea-file-name,.idea-quote-title{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.idea-file-download,.idea-quote-go{margin-left:auto;flex:0 0 auto;font-size:11px;opacity:.72}.idea-canvas.has-canvas-image::before{content:"";position:absolute;inset:0;z-index:0;pointer-events:none;background-image:linear-gradient(var(--idea-canvas-overlay,transparent),var(--idea-canvas-overlay,transparent)),var(--idea-canvas-image);background-size:cover;background-position:center;background-repeat:no-repeat}.idea-canvas.has-canvas-image::after{display:none}.idea-canvas.has-canvas-image>*{z-index:1}@media print{body{padding:0;background:#fff}.idea-export-head{display:none}.idea-export-stage{padding:0;border:0;box-shadow:none;border-radius:0;overflow:visible}}`;
  }
  function ideaExportTightCss() {
    return `.idea-export{width:max-content;min-width:0;margin:0 auto}.idea-export-head{width:100%;max-width:1600px}.idea-export-stage{width:max-content;max-width:none;overflow:visible;padding:0;background:transparent;border:0;border-radius:0;box-shadow:none}.idea-export-stage .idea-canvas{margin:0}.idea-export-viewport{position:relative;overflow:hidden;margin:0 auto;background:transparent}.idea-export-viewport .idea-canvas{position:absolute;left:0;top:0;margin:0;max-width:none;max-height:none}`;
  }
  async function buildIdeaBoardExportPayload(n) {
    const d=jsonCopy(ensureIdeaBoardData(n)) || makeIdeaBoardData();
    const refs=new Set(); d.items.forEach((item)=>{if(item && item.fileId)refs.add(item.fileId);});
    if(d.canvas && d.canvas.backgroundImage && d.canvas.backgroundImage.fileId) refs.add(d.canvas.backgroundImage.fileId);
    (d.attachments || []).forEach((a)=>{if(a && a.id)refs.add(a.id);});
    const files=[];
    for(const id of refs) {
      const rec=await getOne("files",id); if(!rec || !rec.blob) continue;
      const dataUrl=await ideaBlobAsDataUrl(rec.blob);
      files.push({id:String(id),name:String(rec.name || "첨부 파일").slice(0,240),type:String(rec.type || rec.blob.type || "application/octet-stream").slice(0,160),size:Number(rec.size || rec.blob.size || 0),dataUrl});
    }
    return {app:"lumink",kind:"idea",schemaVersion:1,exportedAt:now(),title:n.title || "아이디어 보드",data:d,files};
  }
  function renderIdeaExportItem(item,n,fileMap) {
    const colorStyle=(["note","audio","quote","file","frame","divider"].includes(item.kind) ? ideaColorStyleAttr(item.color, item.textColor) : "");
    const base=`left:${Math.round(item.x)}px;top:${Math.round(item.y)}px;width:${Math.round(item.w)}px;height:${Math.round(item.h)}px;z-index:${Math.round(item.z)};--idea-rot:${Math.round(item.rotation || 0)}deg;${colorStyle}`;
    const cls=`idea-item idea-${esc(item.kind)}${item.kind==="note" ? " idea-sticky" : ""}${item.flipX ? " flipped-x" : ""}${item.shadow===false ? " no-shadow" : ""}${ideaIsLocked(item) ? " locked" : ""}`;
    if(item.kind==="note") { const noteFrame=ideaMediaFrameConfig(item), noteMarkup=noteFrame?`<div class="idea-media-frame idea-item-frame">${frameNineSliceMarkup(noteFrame.id,noteFrame.color)}</div>`:"", noteStyle=noteFrame?`--idea-frame-cap:${Math.round(Math.max(16,Math.min(44,Math.min(Number(item.w)||110,Number(item.h)||54)*.16)))}px;--idea-frame-outset:10px;`:""; return `<article class="${cls}${noteFrame?" has-media-frame":""}" data-note-style="${esc(item.noteStyle)}" data-v-align="${esc(item.vAlign==="center"?"center":"top")}" data-color="${esc(item.color)}" style="${esc(base+noteStyle)}"><div class="idea-note-text">${ideaNoteHtml(item)}</div>${noteMarkup}</article>`; }
    const source=fileMap.get(item.fileId) || "", title=ideaItemTitle(item,n);
    const frameConfig=ideaMediaFrameConfig(item);
    const frameMarkup=frameConfig ? `<div class="idea-media-frame">${frameNineSliceMarkup(frameConfig.id,frameConfig.color)}</div>` : "";
    const frameStyle=frameConfig ? `--idea-frame-cap:${Math.round(Math.max(16,Math.min(44,Math.min(Number(item.w)||110,Number(item.h)||54)*.16)))}px;--idea-frame-outset:10px;` : "";
    if(item.kind==="image") return `<article class="${cls}${frameConfig?" has-media-frame":""}" style="${esc(base+frameStyle)}"><div class="idea-media-shell${frameConfig?" has-project-frame":""}"><div class="idea-media-content">${source?`<img src="${esc(source)}" alt="${esc(title)}">`:`<span>이미지 파일 없음</span>`}</div>${frameMarkup}</div></article>`;
    if(item.kind==="video") return `<article class="${cls}${frameConfig?" has-media-frame":""}" style="${esc(base+frameStyle)}"><div class="idea-media-shell${frameConfig?" has-project-frame":""} idea-video-shell">${ideaVideoDecorMarkup(item)}<div class="idea-media-content">${source?`<video controls playsinline src="${esc(source)}"></video>`:`<span>동영상 파일 없음</span>`}</div>${frameMarkup}</div></article>`;
    const genericFrame=frameConfig ? `<div class="idea-media-frame idea-item-frame">${frameNineSliceMarkup(frameConfig.id,frameConfig.color)}</div>` : "";
    const genericBase=base+frameStyle;
    if(item.kind==="audio") { const aTitleCls=item.showTitle===false?" is-title-hidden":"", aModeCls=item.audioMode==="light"?" is-player-light":" is-player-dark"; return `<article class="${cls}${frameConfig?" has-media-frame":""}" data-color="${esc(item.color)}" style="${esc(genericBase)}"><div class="idea-audio-shell${aTitleCls}${aModeCls}"><div class="idea-audio-head"><span class="idea-audio-icon"><svg viewBox="0 0 24 24" fill="none"><path d="M9 17V6.2l9-2V15" stroke="#fff" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/><circle cx="6.4" cy="17.3" r="2.7" fill="#fff"/><circle cx="15.4" cy="15.3" r="2.7" fill="#fff"/></svg></span><span class="idea-audio-meta"><span class="idea-audio-eyebrow">MUSIC</span><span class="idea-audio-name">${esc(title)}</span></span><span class="idea-audio-spark">✦</span></div><div class="idea-media-content">${source?`<audio controls src="${esc(source)}"></audio>`:`<span>오디오 파일 없음</span>`}</div></div>${genericFrame}</article>`; }
    if(item.kind==="quote") { const ref=getNote(item.noteId), typeLabel=ref?noteTypeShortLabel(ref):"메모 없음"; return `<article class="${cls}${frameConfig?" has-media-frame":""}" data-color="${esc(item.color)}" style="${esc(genericBase)}"><div class="idea-quote-body"><span class="idea-quote-mark">↗</span><span class="idea-quote-copy"><span class="idea-quote-eyebrow">내 메모</span><span class="idea-quote-title">${esc(title)}</span><span class="idea-quote-preview">${esc(typeLabel)}</span></span><span class="idea-quote-go">연결 메모</span></div>${genericFrame}</article>`; }
    if(item.kind==="frame") return `<article class="${cls}${frameConfig?" has-media-frame":""}" data-color="${esc(item.color)}" style="${esc(genericBase)}"><div class="idea-empty-frame-body"></div>${genericFrame}</article>`;
    if(item.kind==="divider") return `<article class="${cls}" data-color="${esc(item.color)}" data-divider-style="${esc(item.dividerStyle || "solid")}" style="${esc(genericBase)};--idea-divider-weight:${Math.max(1,Math.min(12,Math.round(Number(item.dividerWeight)||3)))}px"><div class="idea-divider-body"><span></span></div></article>`;
    return `<article class="${cls}${frameConfig?" has-media-frame":""}" data-color="${esc(item.color)}" style="${esc(genericBase)}">${source?`<a class="idea-file-body" href="${esc(source)}" download="${esc(title)}"><span class="idea-file-icon">⌁</span><span class="idea-file-name">${esc(title)}</span><span class="idea-file-download">받기</span></a>`:`<div class="idea-file-body"><span class="idea-file-icon">⌁</span><span class="idea-file-name">${esc(title)}</span><span class="idea-file-download">파일 없음</span></div>`}${genericFrame}</article>`;
  }
  async function exportIdeaBoardHtmlLegacy(id) {
    if(st.curNoteId===id) await flushIdeaBoard(false);
    const n=getNote(id); if(!n || n.type!=="idea") return;
    try {
      toast("꾸며진 보드 HTML을 준비하고 있어요…");
      const payload=await buildIdeaBoardExportPayload(n), d=normalizeImportedIdeaBoardData(payload.data), fileMap=new Map(payload.files.map((file)=>[file.id,file.dataUrl]));
      const source=ideaCanvasImageSource(d.canvas);
      const activeBackground=source ? (source.type === "preset" ? "preset" : "uploaded") : d.canvas.background;
      let imageStyle=`width:${d.canvas.width}px;min-height:${d.canvas.height}px;${ideaCanvasPlainStyle(activeBackground)}`, imageClass="";
      if(source) {
        const overlay=source.type === "preset" ? source.preset : source.image;
        let imageUrl=source.type === "image" ? fileMap.get(source.image.fileId) : "";
        if(source.type === "preset") {
          try { const response=await fetch(source.src); if(response.ok) imageUrl=await ideaBlobAsDataUrl(await response.blob()); } catch(e) { imageUrl=source.src; }
        }
        if(imageUrl) { imageClass=" has-canvas-image"; imageStyle+=`--idea-canvas-image:${ideaCssUrl(imageUrl)};--idea-canvas-overlay:${rgbaHex(ideaColorMeta(overlay.overlayColor).ig[0],overlay.overlayOpacity)};`; }
      }
      const items=d.items.slice().sort((a,b)=>a.z-b.z).map((item)=>renderIdeaExportItem(item,n,fileMap)).join("") || '<div class="idea-canvas-empty"><div><b>빈 아이디어 보드</b>아직 붙인 조각이 없습니다.</div></div>';
      const css=(ideaExportBaseCss()+"\n"+ideaExportTightCss()+"\n"+await collectIdeaExportStyles()).replace(/<\/style/gi,"");
      const json=JSON.stringify(payload).replace(/</g,"\\u003c");
      const doc=`<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="generator" content="Lumink"><meta name="lumink-kind" content="idea"><title>${esc(n.title || "아이디어 보드")}</title><style>${css}</style></head><body><main class="idea-export"><header class="idea-export-head"><div><h1>${esc(n.title || "아이디어 보드")}</h1><p>루미잉크 아이디어 보드 · ${esc(new Date(payload.exportedAt).toLocaleString("ko"))}</p></div><p>조각 ${d.items.length}개 · 첨부 ${payload.files.length}개</p></header><div class="idea-export-stage"><section class="idea-canvas${imageClass}" data-background="${esc(activeBackground)}" style="${esc(imageStyle)}">${items}</section></div></main><script type="application/json" id="lumink-idea">${json}<\/script></body></html>`;
      downloadDoc(doc,`${ideaExportSafeName(n.title)}.html`,"text/html"); toast("꾸며진 아이디어 보드 HTML을 저장했어요");
    } catch(e) { console.warn("idea export",e); toast("아이디어 보드 HTML 내보내기에 실패했어요"); }
  }
  function ideaVisibleBoardRect(d, noteId) {
    const full = { x:0, y:0, w:Math.max(1, d.canvas.width || 1600), h:Math.max(1, d.canvas.height || 1100) };
    const wrap = $("ideaStageWrap");
    if (!wrap || st.curNoteId !== noteId) return full;
    const zoom = Math.max(.01, ideaZoom || 1);
    const viewW = Math.max(1, Math.min(full.w, (wrap.clientWidth || wrap.getBoundingClientRect().width || full.w * zoom) / zoom));
    const viewH = Math.max(1, Math.min(full.h, (wrap.clientHeight || wrap.getBoundingClientRect().height || full.h * zoom) / zoom));
    const x = Math.max(0, Math.min(full.w - viewW, (wrap.scrollLeft || 0) / zoom));
    const y = Math.max(0, Math.min(full.h - viewH, (wrap.scrollTop || 0) / zoom));
    return { x, y, w:viewW, h:viewH };
  }
  async function buildIdeaExportVisual(n, payload, visualMode) {
    const d = normalizeImportedIdeaBoardData(payload.data);
    const fileMap = new Map(payload.files.map((file)=>[file.id,file.dataUrl]));
    const source = ideaCanvasImageSource(d.canvas);
    const activeBackground = source ? (source.type === "preset" ? "preset" : "uploaded") : d.canvas.background;
    let imageStyle = `width:${d.canvas.width}px;height:${d.canvas.height}px;min-height:${d.canvas.height}px;${ideaCanvasPlainStyle(activeBackground)}`;
    let imageClass = "";
    if (source) {
      const overlay = source.type === "preset" ? source.preset : source.image;
      let imageUrl = source.type === "image" ? fileMap.get(source.image.fileId) : "";
      if (source.type === "preset") {
        try { const response = await fetch(source.src); if (response.ok) imageUrl = await ideaBlobAsDataUrl(await response.blob()); }
        catch (e) { imageUrl = source.src; }
      }
      if (imageUrl) {
        imageClass = " has-canvas-image";
        imageStyle += `--idea-canvas-image:${ideaCssUrl(imageUrl)};--idea-canvas-overlay:${rgbaHex(ideaColorMeta(overlay.overlayColor).ig[0], overlay.overlayOpacity)};`;
      }
    }
    const items = d.items.slice().sort((a,b)=>a.z-b.z).map((item)=>renderIdeaExportItem(item,n,fileMap)).join("") || '<div class="idea-canvas-empty"><div><b>빈 아이디어 보드</b>아직 붙인 조각이 없습니다.</div></div>';
    const fullStage = `<div class="idea-export-stage"><section class="idea-canvas${imageClass}" data-background="${esc(activeBackground)}" style="${esc(imageStyle)}">${items}</section></div>`;
    if (visualMode !== "visible") return { d, fileMap, stage:fullStage, width:d.canvas.width, height:d.canvas.height, mode:"full", label:"전체 화면" };
    const crop = ideaVisibleBoardRect(d, n.id);
    const width = Math.max(1, Math.round(crop.w));
    const height = Math.max(1, Math.round(crop.h));
    const shifted = `${imageStyle}transform:translate(${-Math.round(crop.x)}px,${-Math.round(crop.y)}px);`;
    const stage = `<div class="idea-export-stage"><div class="idea-export-viewport" style="width:${width}px;height:${height}px"><section class="idea-canvas${imageClass}" data-background="${esc(activeBackground)}" style="${esc(shifted)}">${items}</section></div></div>`;
    return { d, fileMap, stage, width, height, mode:"visible", label:"현재 보이는 화면" };
  }
  function downloadIdeaBlob(blob, name) {
    const url = URL.createObjectURL(blob), a = document.createElement("a");
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }
  function openIdeaExportModePicker(id) {
    openModal(`<h3>아이디어 보드 HTML 내보내기</h3><p class="m-sub">복원용 데이터는 항상 전체 보드를 포함합니다. 아래 선택은 HTML을 열었을 때 보이는 시각 범위만 바꿉니다.</p><div class="idea-options-section"><button class="idea-options-row" id="ideaExportVisible"><span>▣</span><span><b>현재 보이는 화면</b><small>상단 바를 제외한 현재 작업 영역만 보이게 저장</small></span></button><button class="idea-options-row" id="ideaExportFull"><span>□</span><span><b>전체 화면</b><small>보드 전체가 보이게 저장</small></span></button></div><div class="m-row"><button class="m-btn" id="ideaExportCancel">닫기</button></div>`);
    $on("ideaExportVisible","click",()=>{ closeModal(); void exportIdeaBoardHtml(id,"visible"); });
    $on("ideaExportFull","click",()=>{ closeModal(); void exportIdeaBoardHtml(id,"full"); });
    $on("ideaExportCancel","click",closeModal);
  }
  async function exportIdeaBoardHtml(id, visualMode) {
    if(st.curNoteId===id) await flushIdeaBoard(false);
    const n=getNote(id); if(!n || n.type!=="idea") return;
    try {
      toast("아이디어 보드 HTML을 준비하고 있어요");
      const payload = await buildIdeaBoardExportPayload(n);
      const visual = await buildIdeaExportVisual(n, payload, visualMode === "visible" ? "visible" : "full");
      const css = (ideaExportBaseCss()+"\n"+ideaExportTightCss()+"\n"+await collectIdeaExportStyles()).replace(/<\/style/gi,"");
      const json = JSON.stringify(payload).replace(/</g,"\\u003c");
      const suffix = visual.mode === "visible" ? "-visible" : "-full";
      const doc = `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="generator" content="Lumink"><meta name="lumink-kind" content="idea"><title>${esc(n.title || "아이디어 보드")}</title><style>${css}</style></head><body><main class="idea-export"><header class="idea-export-head"><div><h1>${esc(n.title || "아이디어 보드")}</h1><p>루미잉크 아이디어 보드 · ${esc(new Date(payload.exportedAt).toLocaleString("ko"))} · 표시: ${esc(visual.label)}</p></div><p>조각 ${visual.d.items.length}개 · 첨부 ${payload.files.length}개</p></header>${visual.stage}</main><script type="application/json" id="lumink-idea">${json}<\/script></body></html>`;
      downloadDoc(doc,`${ideaExportSafeName(n.title)}${suffix}.html`,"text/html");
      toast(`아이디어 보드 HTML을 저장했어요 · ${visual.label}`);
    } catch(e) { console.warn("idea export",e); toast("아이디어 보드 HTML 내보내기에 실패했어요"); }
  }
  async function waitForIdeaPngAssets(root) {
    if (!root) return;
    const waits=[];
    if (document.fonts && document.fonts.ready) waits.push(document.fonts.ready.catch(() => {}));
    root.querySelectorAll("img").forEach((img)=>{
      if (img.complete && img.naturalWidth) return;
      waits.push(new Promise((resolve)=>{ img.addEventListener("load",resolve,{once:true}); img.addEventListener("error",resolve,{once:true}); }));
    });
    root.querySelectorAll("video").forEach((video)=>{
      if (video.readyState >= 2) return;
      waits.push(new Promise((resolve)=>{ video.addEventListener("loadeddata",resolve,{once:true}); video.addEventListener("error",resolve,{once:true}); }));
    });
    await Promise.all(waits);
    await new Promise((resolve)=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  }
  function ideaCaptureSafeCss() {
    return `.lumink-capture-safe,.lumink-capture-safe *,.lumink-capture-safe *::before,.lumink-capture-safe *::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}`
      +`.lumink-capture-safe .idea-transform-tools,.lumink-capture-safe .idea-note-rich-tools,.lumink-capture-safe .idea-snap-guide,.lumink-capture-safe .idea-selection-box,.lumink-capture-safe .idea-lock-badge,.lumink-capture-safe .idea-multi-tools,.lumink-capture-safe .idea-group-box{display:none!important}`
      +`.lumink-capture-safe .idea-item,.lumink-capture-safe .idea-media-content,.lumink-capture-safe .idea-media-shell,.lumink-capture-safe .idea-audio-shell,.lumink-capture-safe .idea-file-body,.lumink-capture-safe .idea-quote-body,.lumink-capture-safe .idea-divider-body span,.lumink-capture-safe .idea-divider-body::before,.lumink-capture-safe .idea-divider-body::after{-webkit-backdrop-filter:none!important;backdrop-filter:none!important;mix-blend-mode:normal!important}`;
  }
  function ensureIdeaCaptureSafeStyle(doc) {
    const d=doc || document;
    if(d.getElementById("luminkCaptureSafeStyle")) return;
    const style=d.createElement("style");
    style.id="luminkCaptureSafeStyle";
    style.textContent=ideaCaptureSafeCss();
    (d.head || d.documentElement).appendChild(style);
  }
  async function captureHtml2CanvasSafe(target, options) {
    const opts=Object.assign({}, options || {});
    const prev=opts.onclone;
    opts.onclone=(doc,el)=>{
      try{
        ensureIdeaCaptureSafeStyle(doc);
        if(doc.documentElement) doc.documentElement.classList.add("lumink-capture-safe-root");
        if(doc.body) doc.body.classList.add("lumink-capture-safe");
        const root=el || doc.body;
        if(root && root.classList) root.classList.add("lumink-capture-safe");
        normalizeCloneColorFns(root || doc.body);
      }catch(e){}
      if(typeof prev==="function") prev(doc,el);
    };
    return window.html2canvas(target, opts);
  }
  // html2canvas는 color()/color-mix() 같은 최신 색 함수를 파싱하지 못해 캡처가 실패합니다.
  // 캡처 직전 복제본의 색을 캔버스로 rgb()로 환산해 주입해, 보드의 color-mix 디자인도 정상 캡처되게 합니다.
  let __colorFnCtx=null;
  function __colorFnToRgb(token){
    try{
      if(!__colorFnCtx) __colorFnCtx=document.createElement("canvas").getContext("2d");
      __colorFnCtx.fillStyle="#abcdef"; __colorFnCtx.fillStyle=token;
      const a=__colorFnCtx.fillStyle;
      __colorFnCtx.fillStyle="#123456"; __colorFnCtx.fillStyle=token;
      const b=__colorFnCtx.fillStyle;
      if(a===b) return a;
    }catch(e){}
    try{
      const probe=document.createElement("span");
      probe.style.color=token;
      if(!probe.style.color) return null;
      probe.style.cssText+=";position:absolute;left:-9999px;top:-9999px;visibility:hidden";
      document.body.appendChild(probe);
      const value=getComputedStyle(probe).color;
      probe.remove();
      return value || null;
    }catch(e){ return null; }
  }
  function resolveColorFunctions(value){
    if(typeof value!=="string" || (value.indexOf("color(")<0 && value.indexOf("color-mix(")<0)) return value;
    let out="", i=0;
    while(i<value.length){
      const m=/^color(?:-mix)?\(/i.exec(value.slice(i));
      if(m){
        let depth=0, j=i+m[0].length-1;
        for(; j<value.length; j++){ if(value[j]==="(")depth++; else if(value[j]===")"){ depth--; if(depth===0){ j++; break; } } }
        const token=value.slice(i,j), rgb=__colorFnToRgb(token);
        out+= rgb || token; i=j;
      } else { out+=value[i]; i++; }
    }
    return out;
  }
  function normalizeCloneColorFns(root){
    if(!root) return;
    const win=(root.ownerDocument&&root.ownerDocument.defaultView)||window;
    const doc=root.ownerDocument || document;
    const props=["color","background","backgroundColor","backgroundImage","borderColor","borderTopColor","borderRightColor","borderBottomColor","borderLeftColor","outlineColor","boxShadow","textShadow","filter","fill","stroke","columnRuleColor","textDecorationColor","caretColor"];
    const cssName=(p)=>p.replace(/[A-Z]/g,(m)=>"-"+m.toLowerCase());
    const pseudoRules=[];
    const nodes=[root].concat([...root.querySelectorAll("*")]);
    nodes.forEach((node,idx)=>{
      if(node.nodeType!==1) return;
      let cs; try{ cs=win.getComputedStyle(node); }catch(e){ return; }
      props.forEach((p)=>{
        const val=cs[p];
        if(val && (val.indexOf("color(")>=0 || val.indexOf("color-mix(")>=0)){
          const fixed=resolveColorFunctions(val);
          if(fixed && fixed!==val){ try{ node.style[p]=fixed; }catch(e){} }
        }
      });
      ["::before","::after"].forEach((pseudo)=>{
        let ps; try{ ps=win.getComputedStyle(node,pseudo); }catch(e){ return; }
        if(!ps) return;
        const fixes=[];
        props.forEach((p)=>{
          const val=ps[p];
          if(val && (val.indexOf("color(")>=0 || val.indexOf("color-mix(")>=0)){
            const fixed=resolveColorFunctions(val);
            if(fixed && fixed!==val) fixes.push(`${cssName(p)}:${fixed}!important`);
          }
        });
        if(fixes.length){
          const mark=`data-lumink-capture-pseudo-${idx}`;
          try{ node.setAttribute(mark,""); pseudoRules.push(`[${mark}]${pseudo}{${fixes.join(";")}}`); }catch(e){}
        }
      });
    });
    if(pseudoRules.length){
      const style=doc.createElement("style");
      style.setAttribute("data-lumink-capture-pseudo","1");
      style.textContent=pseudoRules.join("\n");
      (doc.head || doc.documentElement).appendChild(style);
    }
  }
  // html2canvas는 repeating-linear-gradient(괘선·종이결·텍스처)를 렌더하지 못합니다.
  // 캡처 직전 복제본에서 축정렬 반복 그라데이션을 한 주기 타일 PNG로 구워 url()로 교체해, 실제와 동일하게 캡처되게 합니다.
  function __rgSplitTop(str,sep){ const out=[]; let depth=0,cur=""; for(let i=0;i<str.length;i++){ const c=str[i]; if(c==="(")depth++; else if(c===")")depth--; if(c===sep&&depth===0){ out.push(cur); cur=""; } else cur+=c; } if(cur.trim()!=="") out.push(cur); return out; }
  function __rgAxis(angle){ angle=(angle||"").trim(); const m={"to top":{a:"v",d:-1},"to bottom":{a:"v",d:1},"to left":{a:"h",d:-1},"to right":{a:"h",d:1}}; if(m[angle])return m[angle]; const x=/^(-?[\d.]+)deg$/.exec(angle); if(!x)return null; let d=((parseFloat(x[1])%360)+360)%360; if(d===0)return{a:"v",d:-1}; if(d===180)return{a:"v",d:1}; if(d===90)return{a:"h",d:1}; if(d===270)return{a:"h",d:-1}; return null; }
  // html2canvas는 그라데이션의 transparent를 검정으로 페이드시켜 음영처럼 어둡게 깨뜨립니다.
  // transparent를 인접 색의 알파0으로 바꿔 색조를 유지한 채 자연스럽게 사라지게 합니다.
  function __isTransparentTok(p){ return /\btransparent\b/.test(p) || /rgba\(\s*0\s*,\s*0\s*,\s*0\s*,\s*0\s*\)/.test(p) || /\/\s*0\s*\)/.test(p); }
  function __colorTok(part){ const m=/(rgba?\([^)]*\)|color\([^)]*\)|hsla?\([^)]*\)|#[0-9a-fA-F]{3,8})/.exec(part); return m?m[1]:null; }
  function __toAlphaZero(c){ const r=resolveColorFunctions(c)||c; let m=/rgba?\(([^)]+)\)/.exec(r); if(m){ const n=m[1].split(",").map((s)=>s.trim()); if(n.length>=3) return "rgba("+n[0]+", "+n[1]+", "+n[2]+", 0)"; } m=/color\(\s*srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/i.exec(c); if(m){ const to=(x)=>Math.max(0,Math.min(255,Math.round(parseFloat(x)*255))); return "rgba("+to(m[1])+", "+to(m[2])+", "+to(m[3])+", 0)"; } return null; }
  function __neutralizeGradientStr(grad){
    const open=grad.indexOf("("); if(open<0) return grad;
    const fn=grad.slice(0,open), inner=grad.slice(open+1, grad.lastIndexOf(")"));
    const parts=__rgSplitTop(inner,",").map((s)=>s.trim());
    const trans=parts.map(__isTransparentTok);
    const colorOf=parts.map((p,i)=> trans[i]?null:__colorTok(p));
    let changed=false;
    const out=parts.map((part,idx)=>{
      if(!trans[idx]) return part;
      let nc=null;
      for(let dd=1; dd<parts.length && !nc; dd++){ for(const j of [idx-dd, idx+dd]){ if(j>=0&&j<parts.length&&colorOf[j]){ nc=colorOf[j]; break; } } }
      if(!nc) return part;
      const z=__toAlphaZero(nc); if(!z) return part;
      changed=true;
      return part.replace(/\btransparent\b|rgba\(\s*0\s*,\s*0\s*,\s*0\s*,\s*0\s*\)/, z);
    });
    return changed ? fn+"("+out.join(", ")+")" : grad;
  }
  function __rgTile(layer){
    const inner=layer.slice(layer.indexOf("(")+1, layer.lastIndexOf(")"));
    const parts=__rgSplitTop(inner,",").map((s)=>s.trim()).filter(Boolean);
    if(parts.length<2) return null;
    let angle="180deg", stopParts=parts;
    if(/deg\s*$/.test(parts[0])||/^to\s/.test(parts[0])){ angle=parts[0]; stopParts=parts.slice(1); }
    const axis=__rgAxis(angle); if(!axis) return null;
    const stops=[];
    for(const sp of stopParts){
      const mm=/^(.*\S)\s+(-?[\d.]+)px$/.exec(sp);
      if(mm) stops.push({c:mm[1].trim(), p:parseFloat(mm[2])});
      else if(/%\s*$/.test(sp)) return null; // % 위치는 px 환산 불가 → 건너뜀
      else stops.push({c:sp.trim(), p:null});
    }
    const pos=stops.filter((s)=>s.p!==null);
    if(pos.length<2) return null;
    const base=pos[0].p, period=pos[pos.length-1].p-base;
    if(!(period>0)||period>3000) return null;
    const OS=3, thin=4;
    const W=axis.a==="v"?thin:Math.max(1,Math.round(period));
    const H=axis.a==="v"?Math.max(1,Math.round(period)):thin;
    const cnv=document.createElement("canvas"); cnv.width=W*OS; cnv.height=H*OS;
    const ctx=cnv.getContext("2d"); if(!ctx) return null; ctx.scale(OS,OS);
    let grad;
    if(axis.a==="v") grad= axis.d===1? ctx.createLinearGradient(0,0,0,period) : ctx.createLinearGradient(0,period,0,0);
    else grad= axis.d===1? ctx.createLinearGradient(0,0,period,0) : ctx.createLinearGradient(period,0,0,0);
    for(const s of stops){ if(s.p===null) continue; let off=(s.p-base)/period; off=Math.max(0,Math.min(1,off)); let col; if(__isTransparentTok(s.c)){ let nc=null; for(let dd=1;dd<stops.length&&!nc;dd++){ for(const j of [stops.indexOf(s)-dd, stops.indexOf(s)+dd]){ if(j>=0&&j<stops.length&&!__isTransparentTok(stops[j].c)){ nc=stops[j].c; break; } } } col=(nc&&__toAlphaZero(nc))||"rgba(0,0,0,0)"; } else { col=resolveColorFunctions(s.c)||s.c; } try{ grad.addColorStop(off,col); }catch(e){ return null; } }
    ctx.fillStyle=grad; ctx.fillRect(0,0,W,H);
    let url; try{ url=cnv.toDataURL("image/png"); }catch(e){ return null; }
    return { url, size: axis.a==="v"? (W+"px "+Math.round(period)+"px") : (Math.round(period)+"px "+H+"px") };
  }
  function rasterizeRepeatingGradients(root){
    if(!root) return;
    const win=(root.ownerDocument&&root.ownerDocument.defaultView)||window;
    const doc=root.ownerDocument||document;
    const pseudoRules=[];
    const nodes=[root].concat([...root.querySelectorAll("*")]);
    nodes.forEach((node,idx)=>{
      if(node.nodeType!==1) return;
      [null,"::before","::after"].forEach((pseudo)=>{
        let cs; try{ cs=win.getComputedStyle(node,pseudo); }catch(e){ return; }
        if(!cs) return;
        const bi=cs.backgroundImage;
        if(!bi || bi==="none") return;
        const needsRG = bi.indexOf("repeating-linear-gradient")>=0;
        const needsNeut = /gradient\(/.test(bi) && (/\btransparent\b/.test(bi) || /rgba\(\s*0\s*,\s*0\s*,\s*0\s*,\s*0\s*\)/.test(bi) || /\/\s*0\s*\)/.test(bi));
        if(!needsRG && !needsNeut) return;
        if(pseudo){ const ct=cs.content; if(!ct||ct==="none") return; }
        const layers=__rgSplitTop(bi,",").map((s)=>s.trim());
        const sizes=__rgSplitTop(cs.backgroundSize||"",",").map((s)=>s.trim());
        const repeats=__rgSplitTop(cs.backgroundRepeat||"",",").map((s)=>s.trim());
        const positions=__rgSplitTop(cs.backgroundPosition||"",",").map((s)=>s.trim());
        let changed=false; const nImg=[],nSize=[],nRep=[],nPos=[];
        layers.forEach((layer,i)=>{
          const p=positions.length?positions[i%positions.length]:"0% 0%";
          if(/^repeating-linear-gradient\(/i.test(layer)){
            const t=__rgTile(layer);
            if(t){ changed=true; nImg.push("url("+t.url+")"); nSize.push(t.size); nRep.push("repeat"); nPos.push(p); return; }
          }
          let outLayer=layer;
          if(/gradient\(/i.test(layer) && __isTransparentTok(layer)){
            const neut=__neutralizeGradientStr(layer);
            if(neut!==layer){ outLayer=neut; changed=true; }
          }
          nImg.push(outLayer); nSize.push(sizes.length?sizes[i%sizes.length]:"auto"); nRep.push(repeats.length?repeats[i%repeats.length]:"repeat"); nPos.push(p);
        });
        if(!changed) return;
        const decl="background-image:"+nImg.join(", ")+";background-size:"+nSize.join(", ")+";background-repeat:"+nRep.join(", ")+";background-position:"+nPos.join(", ")+";";
        if(pseudo){
          const mark="data-lumink-rg-"+idx+"-"+(pseudo==="::before"?"b":"a");
          try{ node.setAttribute(mark,""); pseudoRules.push("["+mark+"]"+pseudo+"{"+decl.replace(/;/g,"!important;")+"}"); }catch(e){}
        } else {
          try{ node.style.cssText+=";"+decl; }catch(e){}
        }
      });
    });
    if(pseudoRules.length){
      const style=doc.createElement("style");
      style.setAttribute("data-lumink-rg","1");
      style.textContent=pseudoRules.join("\n");
      (doc.head||doc.documentElement).appendChild(style);
    }
  }
  // html2canvas는 inset box-shadow를 요소 전체 흰색/검정 범람으로 잘못 렌더해 배경을 덮어버립니다.
  // 캡처 직전 inset 그림자만 제거하고 일반 드롭 섀도는 유지합니다.
  function stripInsetShadows(root){
    if(!root) return;
    const win=(root.ownerDocument&&root.ownerDocument.defaultView)||window;
    const doc=root.ownerDocument||document;
    const pseudoRules=[];
    const nodes=[root].concat([...root.querySelectorAll("*")]);
    nodes.forEach((node,idx)=>{
      if(node.nodeType!==1) return;
      [null,"::before","::after"].forEach((pseudo)=>{
        let cs; try{ cs=win.getComputedStyle(node,pseudo); }catch(e){ return; }
        if(!cs) return;
        const bs=cs.boxShadow;
        if(!bs || bs==="none" || bs.indexOf("inset")<0) return;
        if(pseudo){ const ct=cs.content; if(!ct||ct==="none") return; }
        const kept=__rgSplitTop(bs,",").map((s)=>s.trim()).filter((p)=>p && !/\binset\b/.test(p));
        const newBs=kept.length?kept.join(", "):"none";
        if(pseudo){
          const mark="data-lumink-bs-"+idx+"-"+(pseudo==="::before"?"b":"a");
          try{ node.setAttribute(mark,""); pseudoRules.push("["+mark+"]"+pseudo+"{box-shadow:"+newBs+" !important;}"); }catch(e){}
        } else {
          try{ node.style.boxShadow=newBs; }catch(e){}
        }
      });
    });
    if(pseudoRules.length){
      const style=doc.createElement("style");
      style.setAttribute("data-lumink-bs","1");
      style.textContent=pseudoRules.join("\n");
      (doc.head||doc.documentElement).appendChild(style);
    }
  }
  async function exportIdeaViewportPng(id) {
    if(st.curNoteId===id) await flushIdeaBoard(false);
    const n=getNote(id); if(!n || n.type!=="idea") return;
    const d=ensureIdeaBoardData(n), source=$("ideaCanvas");
    if(!source || st.curNoteId!==id){ toast("현재 열린 보드 화면에서만 장면을 PNG로 저장할 수 있어요."); return; }
    if(typeof window.html2canvas!=="function"){ toast("PNG 캡처 도구를 불러오지 못했어요. 새로고침 후 다시 시도해 주세요."); return; }
    const crop=ideaVisibleBoardRect(d,n.id);
    const host=document.createElement("div");
    host.className="idea-png-capture-viewport";
    host.setAttribute("aria-hidden","true");
    host.style.cssText=`position:fixed;left:-100000px;top:0;width:${Math.max(1,Math.round(crop.w))}px;height:${Math.max(1,Math.round(crop.h))}px;overflow:hidden;pointer-events:none;z-index:-1;contain:layout paint style;`;
    const clone=source.cloneNode(true);
    clone.removeAttribute("id");
    clone.classList.add("idea-png-capture-canvas");
    clone.querySelectorAll(".idea-transform-tools,.idea-note-rich-tools,.idea-snap-guide,.idea-selection-box,.idea-lock-badge").forEach((node)=>node.remove());
    clone.style.transformOrigin="0 0";
    clone.style.transform=`translate(${-Math.round(crop.x)}px,${-Math.round(crop.y)}px)`;
    clone.style.width=`${d.canvas.width}px`;
    clone.style.height=`${d.canvas.height}px`;
    clone.style.minHeight=`${d.canvas.height}px`;
    host.appendChild(clone);
    document.body.appendChild(host);
    try {
      toast("현재 장면 PNG를 준비하고 있어요");
      await waitForIdeaPngAssets(host);
      const scale=Math.max(1,Math.min(2,window.devicePixelRatio||1));
      const bitmap=await captureHtml2CanvasSafe(host,{
        backgroundColor:null,
        scale,
        logging:false,
        useCORS:true,
        allowTaint:false,
        onclone:(doc,el)=>{ try{ normalizeCloneColorFns(el||doc.body); }catch(e){} try{ rasterizeRepeatingGradients(el||doc.body); }catch(e){} try{ stripInsetShadows(el||doc.body); }catch(e){} },
        width:Math.max(1,Math.round(crop.w)),
        height:Math.max(1,Math.round(crop.h)),
        windowWidth:Math.max(1,Math.round(crop.w)),
        windowHeight:Math.max(1,Math.round(crop.h)),
        scrollX:0,
        scrollY:0
      });
      const png=await new Promise((resolve)=>bitmap.toBlob(resolve,"image/png"));
      if(!png) throw new Error("png encode failed");
      downloadIdeaBlob(png,`${ideaExportSafeName(n.title)}-viewport.png`);
      toast("현재 장면을 PNG로 저장했어요");
    } catch(e) {
      console.warn("idea png screenshot",e);
      toast("PNG 저장에 실패했어요. 이미지 배경 또는 첨부 파일을 다시 불러온 뒤 재시도해 주세요.");
    } finally {
      host.remove();
    }
  }
  function isIdeaBoardExportPayload(payload) { return !!(payload && payload.app==="lumink" && payload.kind==="idea" && Number(payload.schemaVersion)===1 && payload.data && typeof payload.data==="object"); }
  async function importIdeaBoardHtmlPayload(payload,pid,file) {
    if(!isIdeaBoardExportPayload(payload)) throw new Error("invalid idea payload");
    await flushPending(); await doAutoBackup();
    const n=await createNote("idea",pid); const createdIds=[];
    try {
      n.title=cleanImportedText(payload.title,180) || String((file && file.name) || "").replace(/\.(html?)$/i,"") || "불러온 아이디어 보드"; n.titleLocked=true;
      const d=normalizeImportedIdeaBoardData(payload.data), wanted=new Set();
      d.items.forEach((item)=>{if(item && item.fileId)wanted.add(item.fileId);}); if(d.canvas && d.canvas.backgroundImage && d.canvas.backgroundImage.fileId)wanted.add(d.canvas.backgroundImage.fileId);
      (d.attachments || []).forEach((a)=>{if(a && a.id)wanted.add(a.id);});
      const fileMap=new Map(), fileRecords=[];
      for(const raw of (Array.isArray(payload.files)?payload.files:[])) {
        if(!raw || typeof raw.id!=="string" || !wanted.has(raw.id) || fileMap.has(raw.id)) continue;
        const blob=ideaDataUrlAsBlob(raw.dataUrl,raw.type); if(!blob || blob.size>IDEA_MAX_MEDIA) continue;
        const fresh=uid(); fileMap.set(raw.id,fresh); createdIds.push(fresh);
        fileRecords.push({id:fresh,noteId:n.id,name:cleanImportedText(raw.name,240) || "첨부 파일",type:cleanImportedText(raw.type,160) || blob.type || "application/octet-stream",size:blob.size,blob,createdAt:now()});
      }
      d.items.forEach((item)=>{if(item && item.fileId)item.fileId=fileMap.get(item.fileId) || null;});
      if(d.canvas && d.canvas.backgroundImage) { const image=d.canvas.backgroundImage; image.fileId=fileMap.get(image.fileId) || null; if(!image.fileId)d.canvas.backgroundImage=null; }
      d.attachments=fileRecords.map((row)=>({id:row.id,name:row.name,type:row.type,size:row.size}));
      n.data=d; ensureIdeaBoardData(n); n.updatedAt=now();
      await transact(["notes","files"],"readwrite",(tx)=>{tx.objectStore("notes").put(n); fileRecords.forEach((row)=>tx.objectStore("files").put(row));});
      const project=getProject(pid); if(project) await saveProject(project); triggerAutoBackup();
      st.curNoteId=n.id; st.curProjectId=pid; ideaViewMode="board"; toast(`아이디어 보드를 가져왔어요 · 조각 ${d.items.length}개 · 첨부 ${fileRecords.length}개`); go({s:"idea"});
    } catch(e) {
      st.notes=st.notes.filter((note)=>note.id!==n.id); await Promise.all(createdIds.map((id)=>del("files",id).catch(()=>{}))); await del("notes",n.id).catch(()=>{}); throw e;
    }
  }

  function openIdeaBoardSheet(n) {
    const items=[
      {icon:IC.color,label:"보드 배경",fn:()=>openIdeaBoardBackgroundPicker(n)},
      {icon:IC.save,label:"꾸며진 HTML로 내보내기",fn:()=>openIdeaExportModePicker(n.id)},
      {icon:IC.rename,label:"보드 이름 바꾸기",fn:()=>renameModal("아이디어 보드 이름",n.title,async(v)=>{if(v){n.title=v;n.titleLocked=true;await saveNote(n);render();}})},
      {icon:IC.move,label:"다른 프로젝트로 이동",fn:()=>pickTargetProject(n.projectId,(pid)=>moveNote(n.id,pid).then(render))},
      {icon:IC.copy,label:"선택 위치로 복제",fn:()=>pickTargetProject(n.projectId,(pid)=>duplicateNote(n.id,pid).then(render))},
      {icon:IC.del,label:"아이디어 보드 삭제",danger:true,fn:()=>confirmModal("아이디어 보드 삭제",`'${n.title}'를 삭제할까요?`,"삭제",true,async()=>{await deleteNote(n.id);back();})}
    ];openSheet(n.title,items);
  }

  /* ---------- init ---------- */
  async function init() {
    detectTheme();
    detectAccent();
    detectHiliteColor();
    detectUserFont();
    detectFontScale();
    detectFormatbarMode();
    loadSorts();
    try {
      Object.keys(localStorage).filter((k) => k.indexOf(DRAFT_PREFIX) === 0).forEach((k) => {
        try { const d = JSON.parse(localStorage.getItem(k)); if (!d || !d.at || (Date.now() - d.at) > DRAFT_MAX_AGE) localStorage.removeItem(k); } catch (e) { localStorage.removeItem(k); }
      });
    } catch (e) {}
    try { bind(); } catch (e) { console.warn("bind", e); }
    const logTemplatesLoaded = loadBundledLogTemplates();
    try { await openDB(); st.projects = await getAll("projects"); st.notes = await getAll("notes"); await loadCustomThemeSetting(); await loadQuickMenuSetting(); }
    catch (e) { console.warn("DB error", e); st.quickMenu = normalizeQuickMenu(null); toast("저장소를 열 수 없어요"); }
    try { await logTemplatesLoaded; } catch (e) { console.warn("log templates", e); }
    try { await migrate(); } catch (e) { console.warn("migrate", e); }
    history.replaceState({ d: 1 }, "");
    try { render(); } catch (e) { console.warn("render", e); }

    if ("launchQueue" in window && window.LaunchParams && "files" in LaunchParams.prototype) {
      launchQueue.setConsumer(async (params) => {
        if (!params || !params.files || !params.files.length) return;
        for (const handle of params.files) { try { const file = await handle.getFile(); importHtmlFile(file); } catch (e) { console.warn(e); } }
      });
    }
  }
  if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("./service-worker.js").catch((e) => console.warn("SW", e)));
  init();
})();
