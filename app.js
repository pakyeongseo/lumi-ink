"use strict";
/* ============================================================
   루미잉크 (Lumink) — app logic (1차)
   ============================================================ */
(function () {
  const L = window.__lumink;
  const st = L.state;
  const { $, uid, now, esc, fmtDate, plainText, deriveTitle, preview, toast, toastAction,
          noteHtml, notesOf, getProject, getNote } = L.h;
  const { CHIP, TYPE_LABEL, openDB, store, getAll, put, del } = L;
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
    return FRAME_COLOR_SET.has(color) ? color : null;
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
  function frameInner(p) {
    if (!p || !p.frame) return "";
    return frameSvgMarkup(p.frame, p.frameColor);
  }
  function getOne(name, id) { return new Promise((res, rej) => { const r = store(name, "readonly").get(id); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }

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
  function loreDraftFromEditor(n) { const d = jsonCopy((n && n.data) || {}) || {}; d.content = $("loreEdit").value; return d; }
  function personaDraftFromEditor(n) {
    const d = n && n.data ? n.data : {}; const ko = jsonCopy(d.ko || {}) || {}, en = jsonCopy(d.en || {}) || {};
    ko.name = $("perKoName").value; ko.detail = $("perKoDetail").value;
    en.name = $("perEnName").value; en.detail = $("perEnDetail").value;
    return { ko, en };
  }
  function draftDiffers(n, d) {
    if (!n || !d || !d.data) return false;
    if (d.type === "free") return !jsonSame({ html: noteHtml(n) }, d.data);
    if (d.type === "lorebook") return !jsonSame((n.data || {}).content || "", d.data.content || "");
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
    } else if (d.type === "lorebook") {
      n.data = Object.assign({}, n.data || {}, jsonCopy(d.data) || {});
      await saveLore(n, true);
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
    if (!n || n.type !== type) return;
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
  const SCREENS = ["home", "project", "read", "editor", "lore", "persona", "character", "settings", "search"];
  function showScreen(s) { SCREENS.forEach((x) => $("screen-" + x).classList.toggle("active", x === s)); }
  function curView() { return st.viewStack[st.viewStack.length - 1]; }
  function render() {
    const v = curView();
    showScreen(v.s);
    if (v.s === "home") renderHome();
    else if (v.s === "project") renderProjectDetail();
    else if (v.s === "read") renderRead();
    else if (v.s === "editor") renderEditorMeta();
    else if (v.s === "lore") renderLore();
    else if (v.s === "persona") renderPersona();
    else if (v.s === "character") renderCharacter();
    else if (v.s === "settings") renderSettings();
    else if (v.s === "search") renderSearch();
  }
  let navTransition = false;
  function commitGo(view) { st.viewStack.push(view); history.pushState({ d: st.viewStack.length }, ""); render(); }
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
    commitGo(view);
  }
  async function flushCurrentView(cur) {
    if (cur === "editor") await leaveFreeEditor();
    else if (cur === "lore") await flushLore();
    else if (cur === "persona") await flushPersona();
    else if (cur === "character") await flushCharacter();
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
    const orphans = st.notes.filter((n) => !n.projectId || !n.type);
    if (orphans.length === 0 && st.projects.length > 0) return;
    let def = st.projects.find((p) => p.isDefault) || st.projects[0];
    if (!def) {
      def = { id: uid(), name: "기본 메모함", description: "여기에 메모가 모입니다.", icon: DEFAULT_ICON, isDefault: true, createdAt: now(), updatedAt: now() };
      st.projects.push(def); await put("projects", def);
    }
    for (const n of orphans) {
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
    return `<div class="thumb-media">${p && p.icon ? `<img src="${p.icon}" alt="">` : '<span class="deflogo"></span>'}</div>`;
  }
  function projIconHTML(p, cls) {
    const framed = !!(p && frameById(p.frame));
    return `<div class="${cls}${framed ? " has-frame" : ""}">${projectThumbMedia(p)}${framed ? `<div class="frame">${frameInner(p)}</div>` : ""}</div>`;
  }

  const PIN_SVG = '<svg viewBox="0 0 24 24"><path d="M9 4h6l-1 6 3 3v2H7v-2l3-3z"/><path d="M12 15v5"/></svg>';
  const PIN_STAR = '<svg class="pin-star" viewBox="0 0 24 24"><path d="M12 2l2.7 6.6 7 .5-5.4 4.5 1.8 6.9L12 17.3 5.9 21l1.8-6.9L2.3 9.1l7-.5z"/></svg>';
  const SORT_LABELS = { recent: "최신순", recent_asc: "오래된순", name: "이름 ㄱ→ㅎ", name_desc: "이름 ㅎ→ㄱ" };
  const TYPE_COLOR = { free: "#7b9bff", lorebook: "#6ad0ff", persona: "#c79bff", character: "#ff9fcb" };
  const TYPE_TAG = { free: "F", lorebook: "R", persona: "P", character: "C" };
  function memoTagHTML(n) { return `<span class="memo-tag t-${n.type}">${TYPE_TAG[n.type] || "?"}</span>`; }
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
    if (!p.pinned) { if (st.projects.filter((x) => x.pinned).length >= 3) { toast("프로젝트는 최대 3개까지 고정돼요"); return; } p.pinned = true; p.pinnedAt = now(); }
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
        it.innerHTML = memoTagHTML(n) + `<div class="sb-memo-body"><div class="sb-memo-title">${esc(n.title || "(제목 없음)")}${n.pinnedSide ? PIN_STAR : ""}</div><div class="sb-memo-sub">${esc(proj ? proj.name : "")} · ${TYPE_LABEL[n.type] || ""}</div></div>`;
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
    if (n.type === "persona") {
      const d = n.data || {};
      const img = d.square || d.portrait || DEFAULT_ICON;
      lead = `<div class="mc-thumb"><img src="${img}" alt=""></div>`;
      meta = perTagsPreview(d);
    } else if (n.type === "character") {
      const d = ensureCharacterData(n), page = activeCharacterPage(n);
      const img = characterCoverImage(n);
      lead = `<div class="mc-thumb"><img src="${img}" alt=""></div>`;
      const tags = (page.ko && page.ko.tags) || (page.en && page.en.tags) || [];
      meta = `${d.pages.length}명 · ${tags.length ? tags.join(", ") : "캐릭터 카드"}`;
    } else {
      const dotStyle = col ? `background:${col};box-shadow:0 0 8px ${col}` : "";
      lead = `<span class="mc-dot" style="${dotStyle}"></span>`;
      meta = n.type === "lorebook" ? `키워드 ${((n.data && n.data.keywords) || []).length}개${n.data && n.data.alwaysActive ? " · 항상 활성" : ""}` : (preview(noteHtml(n)) || "빈 메모");
    }
    chip.innerHTML = '<span class="sel-check"><svg viewBox="0 0 24 24"><path d="M5 12l5 5 9-10"/></svg></span>' + lead +
      `<div class="mc-body"><div class="mc-title">${esc(n.title)}${n.pinned ? PIN_STAR : ""}</div><div class="mc-meta">${fmtDate(n.updatedAt)} · ${esc(meta)}</div></div>` +
      `<span class="mc-type">${TYPE_LABEL[n.type] || ""}</span>`;
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
    const SECTIONS = [["character", "캐릭터"], ["persona", "페르소나"], ["lorebook", "로어북"], ["free", "자유 메모"]];
    let firstSec = true;
    SECTIONS.forEach(([t, label]) => {
      const group = ns.filter((n) => n.type === t);
      if (!group.length) return;
      const [pin, rest] = partitionPinned(group);
      const ordered = [...pin, ...sortList(rest, st.noteSort, (n) => n.title || "", (n) => n.updatedAt || 0)];
      const sec = document.createElement("div"); sec.className = "chip-section";
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
    $("readBody").innerHTML = noteHtml(n);
    normalizeLinks($("readBody"));
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
      st.curProjectId = id; commitGo({ s: "project" }); renderSidebar();
    } finally { navTransition = false; }
  }
  async function flushPending() {
    if (curView().s === "editor") await leaveFreeEditor();
    else if (st.saveTimer || (freeEditorSession && freeEditorSession.active)) await flushSave(true);
    if (loreTimer) await flushLore();
    if (perTimer) await flushPersona();
    if (charTimer) await flushCharacter();
  }
  async function openNote(id) {
    const n = getNote(id); if (!n || navTransition) return;
    navTransition = true;
    try {
      await flushPending();
      // flush가 끝난 뒤에만 선택 noteId를 교체합니다. 이전 에디터의 DOM이 새 메모에 쓰일 여지를 차단합니다.
      st.curNoteId = id;
      if (n.type === "free") commitGo({ s: "read" });
      else if (n.type === "lorebook") commitGo({ s: "lore" });
      else if (n.type === "persona") { st.perEdit = false; commitGo({ s: "persona" }); }
      else if (n.type === "character") { st.charEdit = false; commitGo({ s: "character" }); }
      else toast(TYPE_LABEL[n.type] + " 편집기는 다음 단계에서 제공돼요");
    } finally { navTransition = false; }
  }
  function editCurrentNote() { const n = getNote(st.curNoteId); if (n && n.type === "free") go({ s: "editor" }); }
  async function goHome() {
    if (navTransition) return;
    navTransition = true;
    try {
      closeSidebar(); if (curView().s === "editor") await leaveFreeEditor();
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
  async function saveNote(n) { n.updatedAt = now(); await put("notes", n); const p = getProject(n.projectId); if (p) saveProject(p); triggerAutoBackup(); }
  async function createNote(type, projectId) {
    const n = {
      id: uid(), projectId, type,
      title: type === "lorebook" ? "이름 없는 로어북" : type === "persona" ? "이름 없는 페르소나" : type === "character" ? "이름 없는 캐릭터 메모" : "제목 없는 메모",
      titleLocked: type === "lorebook",
      chipColor: null, createdAt: now(), updatedAt: now(),
      data: type === "free" ? { html: "" }
          : type === "lorebook" ? { content: "", keywords: [], alwaysActive: false, depthOn: false, depth: 4 }
          : type === "persona" ? { portrait: null, square: null, gallery: [], ko: { name: "", brief: "", detail: "" }, en: { name: "", brief: "", detail: "" } }
          : type === "character" ? { activeId: null, pages: [makeCharacterPage()] }
          : {}
    };
    st.notes.push(n); await put("notes", n);
    const p = getProject(projectId); if (p) saveProject(p);
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
    toast("이동했어요");
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
      editor.innerHTML = html; code.value = html;
    } else if (!freeEditorSession.dirty) {
      if (editor.innerHTML !== html) editor.innerHTML = html;
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
    if (on) $("codeArea").value = html; else $("editor").innerHTML = html;
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
  function openColorEditor() {
    const sel = window.getSelection();
    colorRange = (sel && sel.rangeCount) ? sel.getRangeAt(0).cloneRange() : null;
    try { const last = localStorage.getItem("luminkLastColor"); if (last) colorCur = last; } catch (e) {}
    const pal = COLOR_PALETTE.map((c) => `<button class="ce-sw" data-c="${c}" style="background:${c}"></button>`).join("");
    openModal(`<h3>글자 색</h3>
      <div class="ce-preview"><span class="ce-preview-chip" id="cePrevChip"></span><span class="ce-preview-text" id="cePrevText">가나다 Sample</span></div>
      <div class="ce-section-label">기본 색상</div><div class="ce-swatches" id="cePalette">${pal}</div>
      <div class="ce-section-label">직접 입력</div>
      <div class="ce-custom-row"><input type="color" class="ce-native" id="ceNative"><input class="ce-hex" id="ceHex" maxlength="7" spellcheck="false" placeholder="#000000"><button class="ce-addbtn" id="ceSave">저장</button></div>
      <div class="ce-section-label">내 색상</div><div id="ceSavedWrap"></div>
      <div class="m-row"><button class="m-btn" id="ceCancel">취소</button><button class="m-btn primary" id="ceApply">적용</button></div>`);
    const setCur = (hex) => { const h = normHex(hex); if (!h) return; colorCur = h; $("cePrevChip").style.background = h; $("cePrevText").style.color = h; $("ceNative").value = h; if (document.activeElement !== $("ceHex")) $("ceHex").value = h; $("modalBox").querySelectorAll("#cePalette .ce-sw").forEach((s) => s.classList.toggle("sel", s.dataset.c === h)); };
    const drawSaved = () => {
      const arr = getSavedColors(), wrap = $("ceSavedWrap");
      if (!arr.length) { wrap.innerHTML = '<div class="ce-saved-empty">저장된 색이 없어요. 색을 고르고 “저장”을 눌러보세요.</div>'; return; }
      wrap.innerHTML = `<div class="ce-swatches">${arr.map((c) => `<button class="ce-sw" data-c="${c}" style="background:${c}"></button>`).join("")}</div>`;
      wrap.querySelectorAll(".ce-sw").forEach((s) => s.addEventListener("click", () => setCur(s.dataset.c)));
    };
    $("modalBox").querySelectorAll("#cePalette .ce-sw").forEach((s) => s.addEventListener("click", () => setCur(s.dataset.c)));
    $on("ceNative", "input", (e) => setCur(e.target.value));
    $on("ceHex", "input", (e) => { const h = normHex(e.target.value); if (h) setCur(h); });
    $on("ceSave", "click", () => { const arr = getSavedColors().filter((c) => c !== colorCur); arr.unshift(colorCur); setSavedColors(arr); drawSaved(); toast("색을 저장했어요"); });
    $on("ceCancel", "click", closeModal);
    $on("ceApply", "click", () => {
      try { localStorage.setItem("luminkLastColor", colorCur); } catch (e) {}
      const ed = $("editor"); ed.focus();
      if (colorRange) { const s = window.getSelection(); s.removeAllRanges(); s.addRange(colorRange); }
      document.execCommand("styleWithCSS", false, true);
      document.execCommand("foreColor", false, colorCur);
      const sw = $("colorSwatch"); if (sw) sw.style.background = colorCur;
      closeModal(); scheduleSave();
    });
    setCur(colorCur); drawSaved();
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
  async function insertImage(file) {
    if (!/^image\//.test(file.type)) { toast("이미지 파일만 넣을 수 있어요"); return; }
    try {
      const data = await fileToResized(file, 1280);
      $("editor").focus();
      document.execCommand("insertHTML", false, `<img src="${data}" style="max-width:100%;border-radius:6px"><br>`);
      scheduleSave();
    } catch (e) { toast((e && e.message) || "이미지를 넣지 못했어요"); }
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

  let loreTimer = null;
  function setLoreSaver(mode) {
    const s = $("loreSaver"); s.className = "saver " + mode;
    $("loreSaverText").textContent = mode === "dirty" ? "기록 중" : mode === "saved" ? "저장됨" : "";
    if (mode === "saved") setTimeout(() => { if (s.classList.contains("saved")) { s.className = "saver"; $("loreSaverText").textContent = ""; } }, 1500);
  }
  function renderLore() {
    const n = getNote(st.curNoteId);
    if (!n || n.type !== "lorebook") { back(); return; }
    const d = n.data = n.data || { content: "", keywords: [], alwaysActive: false, depthOn: false, depth: 4 };
    if (d.depth == null) d.depth = 4;
    if (d.depthOn == null) d.depthOn = false;
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
    const wrap = $("loreKeywords"), input = $("loreKwInput");
    wrap.querySelectorAll(".kw-chip").forEach((c) => c.remove());
    const kws = (n.data && n.data.keywords) || [];
    kws.forEach((kw, idx) => {
      const chip = document.createElement("span"); chip.className = "kw-chip";
      chip.innerHTML = `<span>${esc(kw)}</span><button aria-label="삭제">×</button>`;
      chip.querySelector("button").addEventListener("click", () => { n.data.keywords.splice(idx, 1); saveLore(n, true); renderKeywords(n); });
      wrap.insertBefore(chip, input);
    });
  }
  async function saveLore(n, silent) {
    n.updatedAt = now(); await put("notes", n);
    const p = getProject(n.projectId); if (p) saveProject(p);
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
    const content = (n.data && n.data.content) || "";
    $("loreTokens").textContent = "토큰 계산 중…";
    ensureTokenizer().then((ok) => {
      if (getNote(st.curNoteId) !== n) return;
      if (ok && window.__luminkCountTokens) {
        const t = window.__luminkCountTokens(content);
        $("loreTokens").innerHTML = (t == null) ? "— 토큰" : `<b>${t}</b> 토큰`;
      } else $("loreTokens").textContent = "토큰 계산 불가";
    });
  }
  function addKeywordFromInput() {
    const input = $("loreKwInput"), raw = input.value.trim();
    if (!raw) return;
    const n = getNote(st.curNoteId); if (!n) return;
    n.data.keywords = n.data.keywords || [];
    raw.split(",").map((s) => s.trim()).filter(Boolean).forEach((k) => { if (!n.data.keywords.includes(k)) n.data.keywords.push(k); });
    input.value = ""; saveLore(n, true); renderKeywords(n);
  }
  function toggleLoreActive() {
    const n = getNote(st.curNoteId); if (!n) return;
    n.data.alwaysActive = !n.data.alwaysActive;
    $("loreActive").classList.toggle("on", n.data.alwaysActive);
    saveLore(n, true);
  }
  function toggleLorePreview() {
    flushLore();
    const on = !document.body.classList.contains("lore-preview-on");
    if (on) $("lorePreview").innerHTML = mdToHtml($("loreEdit").value);
    document.body.classList.toggle("lore-preview-on", on);
  }

  // ST World Info export
  function buildWorldInfo(notes) {
    const entries = {};
    notes.forEach((n, i) => {
      const d = n.data || {};
      entries[String(i)] = {
        uid: i, key: (d.keywords || []).slice(), keysecondary: [], comment: n.title || "", content: d.content || "",
        constant: !!d.alwaysActive, vectorized: false, selective: true, selectiveLogic: 0, addMemo: true,
        order: 100, position: (d.depthOn ? 4 : 0), disable: false, ignoreBudget: false, excludeRecursion: false, preventRecursion: false,
        matchPersonaDescription: false, matchCharacterDescription: false, matchCharacterPersonality: false,
        matchCharacterDepthPrompt: false, matchScenario: false, matchCreatorNotes: false, delayUntilRecursion: false,
        probability: 100, useProbability: true, depth: (d.depthOn ? (d.depth == null ? 4 : d.depth) : 4), outletName: "", group: "", groupOverride: false, groupWeight: 100,
        scanDepth: null, caseSensitive: null, matchWholeWords: null, useGroupScoring: null, automationId: "",
        role: null, sticky: 0, cooldown: 0, delay: 0, triggers: [], displayIndex: i,
        characterFilter: { isExclude: false, names: [], tags: [] }
      };
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
      { icon: IC.select, label: "선택", fn: () => enterSelMode("note", n.id) },
      { icon: IC.pin, label: n.pinned ? "고정 해제" : "상단 고정", fn: () => togglePinNote(n.id) },
      { icon: IC.rename, label: "이름 바꾸기", fn: () => renameModal("로어북 이름", n.title, async (v) => { if (v) { n.title = v; n.titleLocked = true; await saveLore(n, true); render(); } }) },
      { icon: IC.color, label: "색상 지정", fn: () => showChipPicker(n.id) },
      { icon: IC.export, label: "World Info(.json)로 내보내기", fn: () => exportWorldInfoFlow([n]) },
      { icon: IC.move, label: "다른 프로젝트로 이동", fn: () => pickTargetProject(n.projectId, (pid) => moveNote(n.id, pid).then(render)) },
      { icon: IC.copy, label: "선택 위치로 복제", fn: () => pickTargetProject(n.projectId, (pid) => duplicateNote(n.id, pid).then(render)) },
      { icon: IC.del, label: "삭제", danger: true, fn: () => confirmModal("로어북 삭제", `'${n.title}'를 삭제할까요?`, "삭제", true, async () => { await deleteNote(n.id); back(); }) }
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
  async function savePersona(n, silent) { n.updatedAt = now(); await put("notes", n); const p = getProject(n.projectId); if (p) saveProject(p); if (!silent) setPerSaver("saved"); triggerAutoBackup(); }
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
  async function startCrop(file, ratio, outW, outH, cb) {
    let url;
    try {
      const checked = await validateImageFile(file);
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
      { icon: IC.select, label: "선택", fn: () => enterSelMode("note", n.id) },
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
    d.pages = Array.isArray(d.pages) && d.pages.length ? d.pages.map(ensureCharacterPage) : [makeCharacterPage()];
    if (!d.activeId || !d.pages.some((p) => p.id === d.activeId)) d.activeId = d.pages[0].id;
    // 대표 썸네일은 캐릭터 메모의 프로젝트 목록용 표지입니다.
    // 기존 데이터는 자동 대표(첫 페이지 이미지)로 자연스럽게 폴백합니다.
    d.coverImage = safeImageSource(d.coverImage) || null;
    return d;
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
    n.title = d.pages.length > 1 ? `${base} 외 ${d.pages.length - 1}명` : base;
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
    const p = getProject(n.projectId); if (p) saveProject(p);
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
    wrap.innerHTML = ""; wrap.hidden = d.pages.length < 2;
    d.pages.forEach((page) => {
      const b = document.createElement("button"); b.className = "char-nav-card" + (page.id === d.activeId ? " active" : "");
      const src = page.square || page.portrait || DEFAULT_ICON;
      b.innerHTML = `<span class="char-nav-thumb"><img src="${src}" alt=""></span><span class="char-nav-name">${esc(charPageName(page, charLang))}</span>`;
      b.title = charPageName(page, charLang);
      b.addEventListener("click", () => switchCharacterPage(page.id));
      wrap.appendChild(b);
    });
    const add = $(read ? "charRAddPage" : "charAddPage"); if (add) add.title = "새 캐릭터 페이지 추가";
    $("charPageCount").textContent = `캐릭터 ${d.pages.findIndex((p) => p.id === d.activeId) + 1} / ${d.pages.length}`;
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
            const cur = getNote(n.id); if (!cur || cur.type !== "character") return;
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
    const palette = COLOR_PALETTE.map((c) => `<button class="ce-sw creator-color" data-c="${c}" style="background:${c}"></button>`).join("");
    openModal(`<h3>글자 색</h3><div class="ce-preview"><span class="ce-preview-chip" id="ccPrevChip"></span><span class="ce-preview-text" id="ccPrevText">가나다 Sample</span></div><div class="ce-section-label">기본 색상</div><div class="ce-swatches" id="ccPalette">${palette}</div><div class="ce-section-label">직접 입력</div><div class="ce-custom-row"><input type="color" class="ce-native" id="ccNative"><input class="ce-hex" id="ccHex" maxlength="7" spellcheck="false" placeholder="#000000"></div><div class="m-row"><button class="m-btn" id="ccCancel">취소</button><button class="m-btn primary" id="ccApply">적용</button></div>`);
    const set = (value) => { const hex = normHex(value); if (!hex) return; current = hex; $("ccPrevChip").style.background = hex; $("ccPrevText").style.color = hex; $("ccNative").value = hex; if (document.activeElement !== $("ccHex")) $("ccHex").value = hex; $("modalBox").querySelectorAll(".creator-color").forEach((b) => b.classList.toggle("sel", b.dataset.c === hex)); };
    $("modalBox").querySelectorAll(".creator-color").forEach((b) => b.addEventListener("click", () => set(b.dataset.c)));
    $on("ccNative", "input", (e) => set(e.target.value));
    $on("ccHex", "input", (e) => { const hex = normHex(e.target.value); if (hex) set(hex); });
    $on("ccCancel", "click", closeModal);
    $on("ccApply", "click", () => { try { localStorage.setItem("luminkLastColor", current); } catch (e) {} closeModal(); restoreCreatorRange(range); document.execCommand("styleWithCSS", false, true); document.execCommand("foreColor", false, current); $("charCreatorColorSwatch").style.background = current; scheduleCreatorSave(); });
    set(current);
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
    const n = getNote(st.curNoteId); if (!n || n.type !== "character") return;
    const html = normalizeCreatorMemo(activeCharacterPage(n).creatorMemo); if (!html) return;
    openModal(`<h3>크리에이터 메모</h3><div class="creator-modal-body read-body">${html}</div><div class="m-row"><button class="m-btn primary" type="button" data-creator-modal-close>닫기</button></div>`);
    const box = $("modalBox");
    attachReadCodeCopy(box);
    // 모달 안에서 생성되는 버튼은 전역 ID 바인딩 대신 해당 모달 인스턴스에 직접 묶습니다.
    // 리치 본문에 같은 ID가 섞여도 닫기 동작이 흔들리지 않게 합니다.
    const closeButton = box && box.querySelector("[data-creator-modal-close]");
    if (closeButton) closeButton.addEventListener("click", (event) => {
      event.preventDefault(); event.stopPropagation(); closeModal();
    });
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
    sw.hidden = d.pages.length < 2;
    $("charPrev").disabled = index <= 0; $("charNext").disabled = index >= d.pages.length - 1;
    $("charSwitchHint").textContent = `${index + 1} / ${d.pages.length} · 좌우로 넘기기`;
  }
  function setCharLang(lang) {
    charLang = lang;
    document.querySelectorAll("#screen-character [data-char-lang]").forEach((b) => b.classList.toggle("active", b.dataset.charLang === lang));
    $("charFormKo").hidden = lang !== "ko"; $("charFormEn").hidden = lang !== "en";
    const n = getNote(st.curNoteId); if (n && n.type === "character") { renderCharNav(n, false); renderCharNav(n, true); if (!st.charEdit) renderCharacterRead(n); }
  }
  function renderCharacter() {
    const n = getNote(st.curNoteId); if (!n || n.type !== "character") { back(); return; }
    ensureCharacterData(n); syncCharacterTitle(n);
    $("charTitle").textContent = n.title || "캐릭터";
    $("charEditView").hidden = !st.charEdit; $("charReadView").hidden = !!st.charEdit; $("charSave").hidden = !st.charEdit;
    $("charViewIcon").innerHTML = st.charEdit ? '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>' : '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>';
    $("charViewToggle").title = st.charEdit ? "보기 모드로" : "편집 모드로";
    setCharLang(charLang || "ko"); renderCharNav(n, false); renderCharNav(n, true);
    if (st.charEdit) renderCharacterEdit(n); else renderCharacterRead(n);
    setCharSaver(""); updateCharTokens(n); queueDraftRecovery(n, "character");
  }
  function scheduleCharSave() {
    const n = getNote(st.curNoteId); if (!n || n.type !== "character" || !st.charEdit) return;
    writeDraft(n, "character", characterTextSnapshot(n, true));
    setCharSaver("dirty"); clearTimeout(charTimer); const id = n.id;
    charTimer = setTimeout(() => { if (st.curNoteId === id) flushCharacter(); }, 550);
  }
  async function flushCharacter() {
    clearTimeout(charTimer); charTimer = null;
    const n = getNote(st.curNoteId); if (!n || n.type !== "character" || !st.charEdit) return;
    const page = activeCharacterPage(n);
    page.ko.name = $("charKoName").value; page.ko.detail = $("charKoDetail").value;
    page.en.name = $("charEnName").value; page.en.detail = $("charEnDetail").value;
    page.creatorMemo = getCreatorMemoHtml();
    syncCharacterTitle(n); await saveCharacter(n); clearDraftIfSynced(n, "character", characterTextSnapshot(n, false)); updateCharTokens(n);
  }
  async function addCharTag(lang) {
    const input = $(lang === "ko" ? "charKoTagInput" : "charEnTagInput"), raw = input.value.trim(); if (!raw) return;
    const n = getNote(st.curNoteId); if (!n || n.type !== "character") return;
    const page = activeCharacterPage(n); raw.split(",").map((x) => x.trim()).filter(Boolean).forEach((tag) => { if (!page[lang].tags.includes(tag)) page[lang].tags.push(tag); });
    input.value = ""; await saveCharacter(n, true); renderCharTags(n, lang);
  }
  async function switchCharacterPage(id) {
    const n = getNote(st.curNoteId); if (!n || n.type !== "character") return;
    const d = ensureCharacterData(n); if (!d.pages.some((p) => p.id === id) || d.activeId === id) return;
    if (st.charEdit) await flushCharacter(); d.activeId = id; await saveCharacter(n, true); renderCharacter();
  }
  async function stepCharacter(delta) {
    const n = getNote(st.curNoteId); if (!n || n.type !== "character") return;
    const d = ensureCharacterData(n), index = d.pages.findIndex((p) => p.id === d.activeId), target = d.pages[index + delta];
    if (target) await switchCharacterPage(target.id);
  }
  async function addCharacterPage() {
    const n = getNote(st.curNoteId); if (!n || n.type !== "character") return;
    if (st.charEdit) await flushCharacter();
    const d = ensureCharacterData(n), page = makeCharacterPage(); d.pages.push(page); d.activeId = page.id; st.charEdit = true; syncCharacterTitle(n); await saveCharacter(n, true); renderCharacter(); toast("새 캐릭터 페이지를 추가했어요");
  }
  async function removeActiveCharacterPage() {
    const n = getNote(st.curNoteId); if (!n || n.type !== "character") return;
    if (st.charEdit) await flushCharacter();
    const d = ensureCharacterData(n); if (d.pages.length < 2) { toast("캐릭터 페이지는 최소 1개가 필요해요"); return; }
    const idx = d.pages.findIndex((p) => p.id === d.activeId), removed = d.pages.splice(idx, 1)[0]; d.activeId = d.pages[Math.max(0, idx - 1)].id; syncCharacterTitle(n); await saveCharacter(n, true); renderCharacter();
    const token = uid(); undoToken = token; if (undoTimer) clearTimeout(undoTimer);
    toastAction("캐릭터 페이지를 삭제했어요", "되돌리기", async () => {
      if (undoToken !== token) return; undoToken = null; if (undoTimer) clearTimeout(undoTimer);
      const cur = getNote(n.id); if (!cur || cur.type !== "character") return; const data = ensureCharacterData(cur); data.pages.splice(Math.min(idx, data.pages.length), 0, removed); data.activeId = removed.id; syncCharacterTitle(cur); await saveCharacter(cur, true); renderCharacter(); toast("삭제를 되돌렸어요");
    }, 6000);
    undoTimer = setTimeout(() => { if (undoToken === token) undoToken = null; }, 6200);
  }
  function applyCharImage(file) {
    const n = getNote(st.curNoteId); if (!n || n.type !== "character" || !charImgTarget || !/^image\//.test(file.type)) { toast("이미지 파일만 넣을 수 있어요"); return; }
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
    const n = getNote(st.curNoteId); if (!n || n.type !== "character") return;
    const page = activeCharacterPage(n); let added = 0, rejected = 0;
    for (const file of files) { try { page.gallery.push(await fileToResized(file, 1600)); added++; } catch (e) { rejected++; } }
    if (added) { await saveCharacter(n, true); renderCharGallery(n, false); toast(rejected ? `${added}장 추가 · ${rejected}장 제외` : `${added}장 추가했어요`); }
    else toast(imageLimitText());
  }
  async function removeCharImage(kind) {
    const n = getNote(st.curNoteId); if (!n || n.type !== "character") return;
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
      if (!current || current.type !== "character") return;
      const dataSet = ensureCharacterData(current);
      dataSet.coverImage = data;
      await saveCharacter(current, true);
      closeModal(); render(); renderSidebar();
      toast("새 대표 이미지를 적용했어요");
    });
  }
  async function chooseCharacterCover(n) {
    if (!n || n.type !== "character") return;
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
  function openCharacterSheet(n) {
    const d = ensureCharacterData(n);
    const items = [
      { icon: IC.select, label: "선택", fn: () => enterSelMode("note", n.id) },
      { icon: IC.pin, label: n.pinned ? "고정 해제" : "상단 고정", fn: () => togglePinNote(n.id) },
      { icon: IC.rename, label: "메모 이름 바꾸기", fn: () => renameModal("캐릭터 메모 이름", n.title, async (v) => { if (v) { n.title = v; n.titleLocked = true; await saveCharacter(n, true); render(); } }) },
      { icon: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2.5"/><circle cx="8.5" cy="9" r="1.7"/><path d="M21 16l-5-5L5 21"/></svg>', label: "대표 썸네일 지정", fn: () => chooseCharacterCover(n) },
      { icon: IC.color, label: "색상 지정", fn: () => showChipPicker(n.id) },
      { icon: IC.save, label: "HTML로 저장", fn: async () => { if (st.charEdit) await flushCharacter(); chooseCharacterExportOptions(n.id); } }
    ];
    if (d.pages.length > 1) items.push({ icon: '<svg viewBox="0 0 24 24"><path d="M8 5h8M8 19h8M12 5v14"/><path d="M5 12h14"/></svg>', label: "현재 캐릭터 페이지 삭제", danger: true, fn: () => removeActiveCharacterPage() });
    items.push(
      { icon: IC.move, label: "다른 프로젝트로 이동", fn: () => pickTargetProject(n.projectId, (pid) => moveNote(n.id, pid).then(render)) },
      { icon: IC.copy, label: "선택 위치로 복제", fn: () => pickTargetProject(n.projectId, (pid) => duplicateNote(n.id, pid).then(render)) },
      { icon: IC.del, label: "캐릭터 메모 삭제", danger: true, fn: () => confirmModal("캐릭터 메모 삭제", `'${n.title}'를 삭제할까요?`, "삭제", true, async () => { await deleteNote(n.id); back(); }) }
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
  function normalizeLinks(root) {
    root.querySelectorAll("a").forEach((a) => { a.classList.add("lumi-link"); a.setAttribute("target", "_blank"); a.setAttribute("rel", "noopener noreferrer"); });
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
  function openModal(html) { $("modalBox").innerHTML = html; $("modalScrim").classList.add("open"); }
  function closeModal() { $("modalScrim").classList.remove("open"); }
  $on("modalScrim", "click", (e) => { if (e.target === $("modalScrim")) closeModal(); });

  function showTypePicker(presetPid) {
    openModal(`
      <h3>새 메모</h3><p class="m-sub">메모 유형을 선택하세요.</p>
      <div class="type-card" data-t="free">
        <div class="tc-ico"><svg viewBox="0 0 24 24"><path d="M5 3h9l5 5v13H5z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h6"/></svg></div>
        <div><div class="tc-name">자유 메모</div><div class="tc-desc">서식 보존 · 코드 보기 지원</div></div>
      </div>
      <div class="type-card" data-t="lorebook">
        <div class="tc-ico"><svg viewBox="0 0 24 24"><path d="M4 5a2 2 0 0 1 2-2h12v18H6a2 2 0 0 1-2-2z"/><path d="M8 7h7M8 11h7"/></svg></div>
        <div><div class="tc-name">로어북</div><div class="tc-desc">마크다운 · 키워드 · 토큰 · World Info 내보내기</div></div>
      </div>
      <div class="type-card" data-t="persona">
        <div class="tc-ico"><svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg></div>
        <div><div class="tc-name">페르소나</div><div class="tc-desc">국문/영문 카드 · 이미지 · 토큰</div></div>
      </div>
      <div class="type-card" data-t="character">
        <div class="tc-ico"><svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.2"/><circle cx="16.5" cy="10" r="2.4"/><path d="M3.5 21a6.2 6.2 0 0 1 11 0"/><path d="M13 20.5a4.5 4.5 0 0 1 7.5 0"/></svg></div>
        <div><div class="tc-name">캐릭터 메모</div><div class="tc-desc">한 메모 안의 복수 캐릭터 카드 · 제작 메모</div></div>
      </div>
      <div class="m-row"><button class="m-btn" data-x="cancel">취소</button></div>
    `);
    $("modalBox").querySelectorAll(".type-card").forEach((card) => {
      card.addEventListener("click", () => {
        if (card.classList.contains("disabled")) { toast("다음 단계에서 제공될 기능이에요"); return; }
        const t = card.dataset.t;
        if (presetPid) { createNote(t, presetPid).then(() => { closeModal(); if (t === "persona") st.perEdit = true; if (t === "character") st.charEdit = true; go({ s: t === "lorebook" ? "lore" : t === "persona" ? "persona" : t === "character" ? "character" : "editor" }); }); }
        else showProjectPicker(t);
      });
    });
    $("modalBox").querySelector('[data-x="cancel"]').addEventListener("click", closeModal);
  }

  function showProjectPicker(type) {
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
    $on("pickNew", "click", () => showProjectForm(null, (np) => { selPid = np.id; showProjectPicker(type); }));
    $on("pickCancel", "click", closeModal);
    $on("pickOk", "click", () => { if (!selPid) return; createNote(type, selPid).then(() => { closeModal(); if (type === "persona") st.perEdit = true; if (type === "character") st.charEdit = true; go({ s: type === "lorebook" ? "lore" : type === "persona" ? "persona" : type === "character" ? "character" : "editor" }); }); });
  }

  // project create/edit form. onDone(project) optional
  function showProjectForm(editId, onDone) {
    const p = editId ? getProject(editId) : null;
    openModal(`
      <h3>${p ? "프로젝트 편집" : "새 프로젝트"}</h3>
      <div class="m-field-label">이름</div>
      <input class="m-input" id="pfName" maxlength="60" placeholder="프로젝트 이름" value="${p ? esc(p.name) : ""}">
      <div class="m-field-label">태그 (쉼표로 구분 · 선택)</div>
      <textarea class="m-textarea" id="pfDesc" maxlength="500" placeholder="예: 판타지, 로맨스, 진행중">${p ? esc(p.description || "") : ""}</textarea>
      <div class="m-row"><button class="m-btn" id="pfCancel">취소</button><button class="m-btn primary" id="pfOk">${p ? "저장" : "만들기"}</button></div>
    `);
    setTimeout(() => $("pfName").focus(), 120);
    $on("pfCancel", "click", closeModal);
    $on("pfOk", "click", async () => {
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
    if (n.type === "persona") { openPersonaSheet(n); return; }
    if (n.type === "character") { openCharacterSheet(n); return; }
    openSheet(n.title, [
      { icon: IC.select, label: "선택", fn: () => enterSelMode("note", id) },
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
  function showIconPicker(pid) {
    const p = getProject(pid); if (!p) return;
    const grid = ICONS.map((ic) => `<div class="icon-opt${p.icon === ic.data ? " sel" : ""}" data-icon="${ic.id}"><img src="${ic.data}" alt="${esc(ic.name)}"></div>`).join("");
    openModal(`
      <h3>프로젝트 썸네일</h3><p class="m-sub">${esc(p.name)}</p>
      <div class="icon-grid">${grid}
        <div class="icon-opt upload" id="iconUpload"><svg viewBox="0 0 24 24"><path d="M12 16V5M7 10l5-5 5 5"/><path d="M5 16v3h14v-3"/></svg><span>업로드</span></div>
      </div>
      <div class="m-row"><button class="m-btn" id="iconClose">닫기</button></div>
    `);
    $("modalBox").querySelectorAll(".icon-opt[data-icon]").forEach((el) => el.addEventListener("click", async () => {
      const ic = ICONS.find((x) => x.id === el.dataset.icon); if (!ic) return;
      p.icon = ic.data; await saveProject(p); closeModal(); render(); renderSidebar(); toast("썸네일을 변경했어요");
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
  function showFrameColorPicker(pid, fid) {
    const p = getProject(pid); if (!p) return;
    let color = normalizeFrameColor(p.frameColor) || "#d4af37";
    const themeAccent = resolveFrameColor(FRAME_THEME_TOKEN);
    const colors = FRAME_COLORS.concat([[FRAME_THEME_TOKEN, "테마와 연동", themeAccent]]);
    const isSelectedFrameColor = (key, value) => {
      if (key === FRAME_THEME_TOKEN) return color === FRAME_THEME_TOKEN;
      if (key === FRAME_PUNCH_TOKEN) return color === FRAME_PUNCH_TOKEN;
      return color === value.toLowerCase();
    };
    const sw = () => colors.map(([key, name, value]) => {
      const previewColor = key === FRAME_THEME_TOKEN ? themeAccent : value;
      const isGlass = key === "glass";
      const isPunch = key === FRAME_PUNCH_TOKEN;
      const punchStyle = 'background:linear-gradient(135deg, rgba(255,255,255,.68), rgba(255,255,255,.15)); box-shadow: inset 0 0 0 1px rgba(255,255,255,.85), inset 0 0 0 6px rgba(255,255,255,.14), 0 0 0 1px rgba(87,106,146,.32);';
      return `<div class="fcolor-sw${isGlass ? " glass" : ""}${isPunch ? " punch" : ""}${isSelectedFrameColor(key, value) ? " sel" : ""}" data-c="${key}" title="${esc(name)}"><span${isGlass ? "" : isPunch ? ` style="${punchStyle}"` : ` style="background:${previewColor}"`}></span></div>`;
    }).join("");
    openModal(`
      <h3>프레임 색상</h3><p class="m-sub">${esc((frameById(fid) || {}).name || "")} · ‘테마와 연동’은 앱 컬러 테마를 바꿀 때 함께 바뀌며, ‘투명 글래스’는 썸네일 위에 반투명하게 겹쳐지고, ‘글래시한 명암’은 반투명 하이라이트와 그림자로 유리 같은 깊이를 더해요.</p>
      <div class="fr-bigprev"><div class="proj-icon has-frame">${frameThumbInner(p)}<div class="frame" id="frBigFrame">${frameSvgFor(fid, color)}</div></div></div>
      <div class="fcolor-grid" id="fcGrid">${sw()}</div>
      <div class="m-row"><button class="m-btn" id="fcBack">뒤로</button><button class="m-btn primary" id="fcOk">적용</button></div>
    `);
    const refresh = () => {
      $("frBigFrame").innerHTML = frameSvgFor(fid, color);
      $("fcGrid").querySelectorAll(".fcolor-sw").forEach((item) => {
        const key = item.dataset.c;
        const value = key === FRAME_THEME_TOKEN ? themeAccent : (key === FRAME_PUNCH_TOKEN ? FRAME_PUNCH_TOKEN : FRAME_COLOR_BY_KEY.get(key));
        item.classList.toggle("sel", key === FRAME_THEME_TOKEN
          ? color === FRAME_THEME_TOKEN
          : color === value);
      });
    };
    $("fcGrid").querySelectorAll(".fcolor-sw").forEach((item) => item.addEventListener("click", () => {
      const key = item.dataset.c;
      color = key === FRAME_THEME_TOKEN ? FRAME_THEME_TOKEN : (key === FRAME_PUNCH_TOKEN ? FRAME_PUNCH_TOKEN : (FRAME_COLOR_BY_KEY.get(key) || color));
      refresh();
    }));
    $on("fcBack", "click", () => showFramePicker(pid));
    $on("fcOk", "click", async () => { p.frame = fid; p.frameColor = color; await saveProject(p); closeModal(); render(); renderSidebar(); toast(color === FRAME_THEME_TOKEN ? "테마와 연동되는 프레임을 적용했어요" : color === FRAME_PUNCH_TOKEN ? "글래시한 명암 프레임을 적용했어요" : "프레임을 적용했어요"); });
  }
  const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
  const MAX_IMAGE_PIXELS = 24 * 1000 * 1000;
  function imageLimitText() { return "이미지는 12MB 이하, 2,400만 픽셀 이하만 넣을 수 있어요"; }
  function loadImageFile(file) {
    return new Promise((res, rej) => {
      const url = URL.createObjectURL(file), img = new Image();
      img.onload = () => res({ img, url });
      img.onerror = () => { URL.revokeObjectURL(url); rej(new Error("이미지를 열 수 없어요")); };
      img.src = url;
    });
  }
  async function validateImageFile(file) {
    if (!file || !/^image\//.test(file.type) || /svg/i.test(file.type)) throw new Error("이미지 파일만 넣을 수 있어요");
    if (file.size > MAX_IMAGE_BYTES) throw new Error(imageLimitText());
    const loaded = await loadImageFile(file);
    const pixels = loaded.img.naturalWidth * loaded.img.naturalHeight;
    const meta = { width: loaded.img.naturalWidth, height: loaded.img.naturalHeight, img: loaded.img, url: loaded.url };
    if (!meta.width || !meta.height || pixels > MAX_IMAGE_PIXELS) { URL.revokeObjectURL(loaded.url); throw new Error(imageLimitText()); }
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
      const p = getProject(pid); if (p) { p.icon = data; await saveProject(p); closeModal(); render(); renderSidebar(); toast("썸네일을 변경했어요"); }
    });
  });

  /* ---------- search ---------- */
  function getNoteSearchText(n) {
    if (!n) return "";
    if (n.type === "lorebook") { const d = n.data || {}; return ((d.content || "") + " " + ((d.keywords || []).join(" "))).toLowerCase(); }
    if (n.type === "persona") { const d = n.data || {}, ko = d.ko || {}, en = d.en || {}; return [ko.name, (ko.tags || []).join(" "), ko.detail, en.name, (en.tags || []).join(" "), en.detail].filter(Boolean).join(" ").toLowerCase(); }
    if (n.type === "character") { const d = ensureCharacterData(n); return d.pages.map((p) => [p.ko.name, (p.ko.tags || []).join(" "), p.ko.detail, p.en.name, (p.en.tags || []).join(" "), p.en.detail, p.creatorMemo].join(" ")).join(" ").toLowerCase(); }
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
        sub.textContent = `첨부 ${files.length}개 · ${fmtSize(attachmentBytes)} · 자동 백업 ${backups.length}개`;
      } else {
        value.textContent = fmtSize(attachmentBytes);
        sub.textContent = `첨부 ${files.length}개 · 자동 백업 ${backups.length}개 · 브라우저 전체 용량은 확인 불가`;
      }
    } catch (e) { value.textContent = "확인 불가"; sub.textContent = "브라우저 저장공간 정보를 읽지 못했어요"; }
  }
  function renderSettings() {
    $("setThemeVal").textContent = st.theme === "light" ? "밝게" : "어둡게";
    $("setFontSub").textContent = (st.userFont && st.userFont.name) ? st.userFont.name : "기본 폰트";
    document.querySelectorAll("#fontSizeSeg button").forEach((b) => b.classList.toggle("on", b.dataset.fs === (st.fontScale || "normal")));
    const av = $("setAccentVal"); if (av && ACCENTS[st.accent || "blue"]) av.innerHTML = `<span class="accent-dot"></span>${ACCENTS[st.accent || "blue"].name}`;
    const toolbar = $("setToolbarModeVal"); if (toolbar) toolbar.textContent = st.formatbarMode === "folded" ? "접어두기" : "항상 표시";
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
  async function reloadState() { st.projects = await getAll("projects"); st.notes = await getAll("notes"); }
  async function exportBackup() {
    try {
      const files = await getAll("files"); const fileRecs = [];
      for (const f of files) { try { fileRecs.push({ id: f.id, noteId: f.noteId, name: f.name, type: f.type, size: f.size, createdAt: f.createdAt, data: await blobToBase64(f.blob) }); } catch (e) {} }
      const payload = { app: "lumink", version: 1, exportedAt: now(), projects: st.projects, notes: st.notes, files: fileRecs };
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
    return { activeId, coverImage: safeImageSource(src.coverImage), pages: safePages };
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
    const type = ["free", "lorebook", "persona", "character"].includes(raw.type) ? raw.type : null;
    if (!type) return null;
    const note = {
      id: raw.id, projectId: raw.projectId, type,
      title: cleanImportedText(raw.title, 180) || (type === "persona" ? "이름 없는 페르소나" : type === "character" ? "이름 없는 캐릭터 메모" : type === "lorebook" ? "이름 없는 로어북" : "제목 없는 메모"),
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
      note.data.html = sanitize(cleanImportedText(data.html, 1000000)).html;
      const attachments = normalizeImportedAttachments(data.attachments);
      if (attachments.length) note.data.attachments = attachments;
    } else if (type === "lorebook") {
      note.data = {
        content: cleanImportedText(data.content, 500000),
        keywords: (Array.isArray(data.keywords) ? data.keywords : []).map((key) => cleanImportedText(String(key), 180).trim()).filter(Boolean).slice(0, 300),
        alwaysActive: !!data.alwaysActive,
        depthOn: !!data.depthOn,
        depth: Math.min(999, Math.max(0, Number(data.depth) || 4))
      };
    } else if (type === "persona") {
      note.data = normalizeImportedPersonaData(data);
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
  async function applyImportData(projects, notes, files) {
    const curDefault = st.projects.find((p) => p.isDefault);
    const remap = {};
    const importedProjects = (projects || []).map(normalizeImportedProject).filter(Boolean);
    const importedNotes = (notes || []).map(normalizeImportedNote).filter(Boolean);
    const importedFiles = (files || []).map(normalizeImportedFile).filter(Boolean);
    for (const p of importedProjects) {
      if (p.isDefault && curDefault && p.id !== curDefault.id) { remap[p.id] = curDefault.id; continue; }
      await put("projects", p);
    }
    for (const n of importedNotes) {
      if (remap[n.projectId]) n.projectId = remap[n.projectId];
      await put("notes", n);
    }
    for (const f of importedFiles) {
      try { await put("files", f); } catch (e) {}
    }
  }
  async function replaceImportData(projects, notes, files) {
    await clearStore("notes"); await clearStore("projects"); await clearStore("files");
    await reloadState();
    await applyImportData(projects, notes, files);
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
        await applyImportData(payload.projects || [], payload.notes || [], payload.files || []);
        await reloadState(); render(); renderSidebar(); toast("병합 복원했어요");
      } catch (e) { toast("복원 중 오류가 났어요"); }
    }));
    $on("restoreReplace", "click", () => confirmModal("완전 교체 복원", "현재 프로젝트·메모·첨부파일을 지우고 백업 시점으로 되돌립니다. 방금 상태는 자동 백업에 보관돼요.", "완전 교체", true, async () => {
      try {
        await doAutoBackup();
        await replaceImportData(payload.projects || [], payload.notes || [], payload.files || []);
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
          await clearStore("notes"); await clearStore("projects"); await clearStore("files"); await clearStore("backups");
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
  function updateSelBar() {
    const ids = [...(st.selIds || [])];
    $("selCount").textContent = `${ids.length}개 선택`;
    const mb = $("selMerge");
    if (mb) {
      let ok = false;
      if (st.selType === "note" && ids.length >= 2) {
        const notes = ids.map(getNote).filter(Boolean);
        const t = notes[0] && notes[0].type;
        ok = !!t && t !== "persona" && t !== "character" && notes.every((n) => n.type === t);
      }
      mb.hidden = !ok;
    }
  }
  async function mergeSelected() {
    const ids = [...(st.selIds || [])];
    if (ids.length < 2) { toast("2개 이상 선택해 주세요"); return; }
    const notes = ids.map(getNote).filter(Boolean);
    const type = notes[0].type;
    if (type === "persona" || type === "character") { toast("페르소나·캐릭터 메모는 합칠 수 없어요"); return; }
    if (!notes.every((n) => n.type === type)) { toast("같은 종류끼리만 합칠 수 있어요"); return; }
    const pid = notes[0].projectId;
    if (type === "lorebook") {
      const merged = notes.map((n) => (n.data && n.data.content) || "").filter((s) => s.trim()).join("\n\n");
      const nn = await createNote("lorebook", pid);
      nn.title = "합친 로어북"; nn.data = { content: merged, keywords: [], alwaysActive: false, depthOn: false, depth: 4 };
      await saveLore(nn, true);
      exitSelMode(); st.curNoteId = nn.id; toast(`${notes.length}개를 합쳤어요`); go({ s: "lore" });
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
    const accent = ACCENTS[st.accent || "blue"] || ACCENTS.blue;
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
    const accent = ACCENTS[st.accent || "blue"] || ACCENTS.blue;
    openModal(`<h3>캐릭터 HTML로 저장</h3><p class="m-sub">현재 컬러 테마(<b>${esc(accent.name)}</b>)를 유지한 채 밝기를 고르고, 제작용 메모 포함 여부를 정해요.</p><label class="lore-toggle-wrap" style="margin:5px 0 16px"><input type="checkbox" id="cxCreator"> 크리에이터 메모 포함</label><p class="m-sub" style="margin-top:-7px">기본값은 미포함이에요. 공유용 카드에 제작 메모가 섞이지 않도록 보호합니다.</p><div class="m-row"><button class="m-btn" id="cxLight">밝게</button><button class="m-btn primary" id="cxDark">어둡게</button></div>`);
    const run = (theme) => { const includeCreator = !!$("cxCreator").checked; closeModal(); exportCharacterHtml(id, theme, includeCreator); };
    $on("cxLight", "click", () => run("light")); $on("cxDark", "click", () => run("dark"));
  }
  function exportCharacterHtml(id, theme, includeCreator) {
    const n = getNote(id); if (!n || n.type !== "character") return;
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
    const payload = JSON.stringify({ app: "lumink", kind: "character", title: n.title, data: exportData }).replace(/</g, "\\u003c");
    const css = personaExportCSS(theme === "dark" ? "dark" : "light") + `.cnav{display:flex;gap:8px;overflow:auto;margin:0 0 20px;padding:3px 1px 5px}.cnav button{border:1px solid ${personaExportPalette(theme === "dark" ? "dark" : "light").line};background:transparent;color:inherit;border-radius:12px;padding:6px 9px;display:flex;gap:7px;align-items:center;cursor:pointer;white-space:nowrap;font:inherit;font-size:12px}.cnav button.active{border-color:${personaExportPalette(theme === "dark" ? "dark" : "light").chipColor};background:${personaExportPalette(theme === "dark" ? "dark" : "light").chipBg};color:${personaExportPalette(theme === "dark" ? "dark" : "light").chipColor}}.cnav img,.nav-placeholder{width:28px;height:28px;border-radius:8px;object-fit:cover;background:${personaExportPalette(theme === "dark" ? "dark" : "light").panel2};display:grid;place-items:center}.char-page[hidden]{display:none}.creator{margin:0 0 28px}.creator-label{display:inline-block;font-weight:800;font-size:11px;letter-spacing:.11em;color:${personaExportPalette(theme === "dark" ? "dark" : "light").chipColor};background:${personaExportPalette(theme === "dark" ? "dark" : "light").chipBg};padding:5px 12px;border-radius:999px;margin-bottom:11px}.creator .detail{border-left:3px solid ${personaExportPalette(theme === "dark" ? "dark" : "light").chipColor}}.creator-rich img{max-width:100%;height:auto;border-radius:8px}.creator-rich pre{overflow:auto}.creator-rich a{color:${personaExportPalette(theme === "dark" ? "dark" : "light").chipColor}}`;
    const doc = `<!DOCTYPE html>
<html lang="ko"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><meta name="generator" content="Lumink"><meta name="lumink-kind" content="character"><title>${esc(n.title || "캐릭터 메모")}</title><style>${css}</style></head><body><main class="wrap"><h1 class="ptitle">${esc(n.title || "캐릭터 메모")}</h1>${nav}${pageHtml}<div class="foot">Lumi Ink · 캐릭터 메모</div></main><script type="application/json" id="lumink-character">${payload}<\/script><script>(function(){var pages=[].slice.call(document.querySelectorAll('.char-page')),buttons=[].slice.call(document.querySelectorAll('.cnav button'));function show(i){pages.forEach(function(p,x){p.hidden=x!==i});buttons.forEach(function(b,x){b.classList.toggle('active',x===i)});window.scrollTo({top:0,behavior:'smooth'})}buttons.forEach(function(b){b.addEventListener('click',function(){show(+b.dataset.page)})})})();<\/script></body></html>`;
    const name = ((n.title || "character").replace(/[\\/:*?"<>|]+/g, "_").slice(0, 50) || "character") + ".html";
    const blob = new Blob([doc], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob), a = document.createElement("a"); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500); toast("캐릭터 HTML로 저장했어요");
  }

  const SAFE_HTML_TAGS = new Set(["a", "abbr", "b", "blockquote", "br", "code", "del", "div", "em", "font", "h1", "h2", "h3", "h4", "h5", "h6", "hr", "i", "img", "li", "ol", "p", "pre", "s", "span", "strike", "strong", "u", "ul"]);
  const DROP_HTML_TAGS = new Set(["script", "style", "link", "meta", "base", "iframe", "frame", "object", "embed", "form", "input", "button", "select", "textarea", "video", "audio", "svg", "math", "template"]);
  const SAFE_STYLE_PROPS = new Set(["color", "background-color", "font-size", "font-weight", "font-style", "text-decoration", "text-align", "font-family", "white-space", "max-width", "border-radius", "vertical-align"]);
  function safeCss(style) {
    if (typeof style !== "string") return "";
    return style.split(";").map((part) => {
      const idx = part.indexOf(":"); if (idx < 1) return "";
      const prop = part.slice(0, idx).trim().toLowerCase();
      const value = part.slice(idx + 1).trim();
      if (!SAFE_STYLE_PROPS.has(prop) || !value || value.length > 180) return "";
      if (/url\s*\(|expression\s*\(|@import|javascript:|behavior\s*:|-moz-binding/i.test(value)) return "";
      return `${prop}:${value}`;
    }).filter(Boolean).join(";");
  }
  function safeLinkHref(value) {
    const href = typeof value === "string" ? value.trim() : "";
    if (!href) return "";
    if (/^(https?:|mailto:|tel:|#)/i.test(href)) return href;
    return "";
  }
  function unwrapHtmlElement(el) {
    const parent = el.parentNode; if (!parent) return;
    while (el.firstChild) parent.insertBefore(el.firstChild, el);
    el.remove();
  }
  function sanitize(html) {
    const doc = new DOMParser().parseFromString(String(html || ""), "text/html");
    const titleEl = doc.querySelector("title");
    [...doc.body.querySelectorAll("*")].forEach((el) => {
      const tag = el.tagName.toLowerCase();
      if (DROP_HTML_TAGS.has(tag)) { el.remove(); return; }
      if (!SAFE_HTML_TAGS.has(tag)) { unwrapHtmlElement(el); return; }
      const attrs = [...el.attributes].map((a) => [a.name.toLowerCase(), a.value]);
      [...el.attributes].forEach((a) => el.removeAttribute(a.name));
      const attr = (name) => { const found = attrs.find(([key]) => key === name); return found ? found[1] : ""; };
      const style = safeCss(attr("style")); if (style) el.setAttribute("style", style);
      const title = cleanImportedText(attr("title"), 240); if (title) el.setAttribute("title", title);
      if (tag === "a") {
        const href = safeLinkHref(attr("href"));
        if (href) el.setAttribute("href", href);
        else unwrapHtmlElement(el);
        if (href && attr("target") === "_blank") { el.setAttribute("target", "_blank"); el.setAttribute("rel", "noopener noreferrer"); }
      } else if (tag === "img") {
        const src = safeImageSource(attr("src"));
        if (!src) { el.remove(); return; }
        el.setAttribute("src", src);
        const alt = cleanImportedText(attr("alt"), 240); if (alt) el.setAttribute("alt", alt);
      } else if (tag === "font") {
        const color = cleanImportedText(attr("color"), 80); if (color && !/url\s*\(|expression|javascript:/i.test(color)) el.setAttribute("color", color);
        const face = cleanImportedText(attr("face"), 120); if (face) el.setAttribute("face", face);
        const size = cleanImportedText(attr("size"), 12); if (/^[1-7]|[+-][1-7]$/.test(size)) el.setAttribute("size", size);
      }
    });
    return { html: doc.body ? doc.body.innerHTML.trim() : "", title: titleEl ? cleanImportedText(titleEl.textContent, 180).trim() : "" };
  }
  function importHtmlFile(file) {
    const fr = new FileReader();
    fr.onload = () => {
      const raw = String(fr.result || "");
      const looksJson = /\.json$/i.test(file.name) || (raw.trim().startsWith("{") && raw.includes('"entries"'));
      if (looksJson) importWorldInfo(raw, file);
      else importHtmlPayload(raw, file);
    };
    fr.onerror = () => toast("파일을 읽지 못했어요");
    fr.readAsText(file, "UTF-8");
  }
  function importWorldInfo(raw, file) {
    let data; try { data = JSON.parse(raw); } catch (e) { toast("JSON을 읽지 못했어요"); return; }
    const entries = (data && data.entries) ? data.entries : data;
    const list = Array.isArray(entries) ? entries : Object.values(entries || {});
    const valid = list.filter((e) => e && typeof e === "object" && (("content" in e) || ("key" in e) || ("keys" in e)));
    if (!valid.length) { toast("월드인포 항목을 찾지 못했어요"); return; }
    pickTargetProject(st.curProjectId, async (pid) => {
      let cnt = 0;
      for (const e of valid) {
        const keys = e.key || e.keys || [];
        const n = await createNote("lorebook", pid);
        n.title = ((e.comment || "") + "").trim() || (Array.isArray(keys) && keys[0]) || ("로어북 " + (cnt + 1));
        n.titleLocked = true;
        n.data = { content: e.content || "", keywords: Array.isArray(keys) ? keys.slice() : [], alwaysActive: !!e.constant, depthOn: (e.position === 4), depth: (e.depth == null ? 4 : e.depth) };
        await saveLore(n, true);
        cnt++;
      }
      await reloadState(); st.curProjectId = pid; render(); renderSidebar();
      toast(`로어북 ${cnt}개를 불러왔어요`); go({ s: "project" });
    });
  }
  function importHtmlPayload(raw, file) {
    let pTag = null;
    try { const doc = new DOMParser().parseFromString(raw, "text/html"); pTag = doc.getElementById("lumink-persona") || doc.getElementById("lumink-character"); } catch (e) {}
    pickTargetProject(st.curProjectId, async (pid) => {
      if (pTag) {
        try {
          const pl = JSON.parse(pTag.textContent);
          if (pl && pl.kind === "persona" && pl.data) {
            const n = await createNote("persona", pid);
            n.title = cleanImportedText(pl.title, 180) || file.name.replace(/\.(html?)$/i, "") || "불러온 페르소나";
            n.titleLocked = true; n.data = normalizeImportedPersonaData(pl.data);
            await savePersona(n, true);
            st.curNoteId = n.id; perLang = "ko"; st.perEdit = false; st.curProjectId = pid;
            toast("페르소나를 불러왔어요"); go({ s: "persona" }); return;
          }
          if (pl && pl.kind === "character" && pl.data) {
            const n = await createNote("character", pid);
            n.title = cleanImportedText(pl.title, 180) || file.name.replace(/\.(html?)$/i, "") || "불러온 캐릭터 메모";
            n.titleLocked = true; n.data = normalizeImportedCharacterData(pl.data);
            await saveCharacter(n, true);
            st.curNoteId = n.id; charLang = "ko"; st.charEdit = false; st.curProjectId = pid;
            toast("캐릭터 메모를 불러왔어요"); go({ s: "character" }); return;
          }
        } catch (e) {}
      }
      const parsed = sanitize(raw);
      const n = await createNote("free", pid);
      n.title = parsed.title || file.name.replace(/\.(html?|HTML?)$/i, "") || "불러온 메모"; n.data.html = parsed.html;
      await saveNote(n);
      st.curNoteId = n.id; st.curProjectId = pid;
      toast("불러왔어요"); go({ s: "editor" });
    });
  }
  $on("fileInput", "change", (e) => { const f = e.target.files && e.target.files[0]; if (f) importHtmlFile(f); e.target.value = ""; closeSidebar(); });

  /* ---------- sidebar / theme ---------- */
  function openSidebar() { renderSidebar(); document.body.classList.add("sidebar-open"); }
  function closeSidebar() { document.body.classList.remove("sidebar-open"); }
  $on("sidebarScrim", "click", closeSidebar);
  function applyTheme(t) {
    st.theme = t; document.documentElement.setAttribute("data-theme", t);
    document.querySelector('meta[name=theme-color]').setAttribute("content", t === "light" ? "#f3f4f8" : "#0d0f17");
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
  function applyAccent(name) {
    if (!ACCENTS[name]) name = "blue";
    st.accent = name;
    if (name === "blue") document.documentElement.removeAttribute("data-accent");
    else document.documentElement.setAttribute("data-accent", name);
    const ig = ACCENTS[name].ig;
    const a = $("igA"), bb = $("igB");
    if (a) a.setAttribute("stop-color", ig[0]);
    if (bb) bb.setAttribute("stop-color", ig[1]);
    try { localStorage.setItem("luminkAccent", name); } catch (e) {}
    const v = $("setAccentVal"); if (v) v.innerHTML = `<span class="accent-dot"></span>${ACCENTS[name].name}`;
  }
  function detectAccent() { let a = "blue"; try { a = localStorage.getItem("luminkAccent") || "blue"; } catch (e) {} applyAccent(a); }
  function openAccentPicker() {
    const cur = st.accent || "blue";
    const cells = Object.keys(ACCENTS).map((k) => `<div class="accent-cell${k === cur ? " sel" : ""}" data-accent="${k}"><span class="ac-sw" style="background:${ACCENTS[k].grad}"></span><span class="ac-name">${ACCENTS[k].name}</span></div>`).join("");
    openModal(`<h3>컬러 테마</h3><p class="m-sub">앱 전체 강조색을 골라요. 밝게·어둡게 테마와 함께 적용돼요.</p><div class="accent-grid">${cells}</div><div class="m-row"><button class="m-btn" id="acClose">닫기</button></div>`);
    $on("acClose", "click", closeModal);
    document.querySelectorAll(".accent-cell").forEach((el) => el.addEventListener("click", () => {
      applyAccent(el.dataset.accent);
      document.querySelectorAll(".accent-cell").forEach((x) => x.classList.toggle("sel", x === el));
    }));
  }

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
  function openInstallIconPicker() {
    const choices = [
      ["ink", "잉크 블루", "차분한 기본 펜촉"], ["gold", "골드", "온화한 금빛 펜촉"],
      ["violet", "바이올렛", "몽환적인 보랏빛 펜촉"], ["rose", "로즈", "부드러운 장밋빛 펜촉"],
      ["forest", "포레스트", "짙은 숲빛 펜촉"], ["pastel-blue", "파스텔 블루", "맑고 부드러운 하늘빛"],
      ["pastel-pink", "파스텔 핑크", "포근한 솜사탕빛"], ["pastel-green", "파스텔 그린", "산뜻한 새잎빛"],
      ["pastel-purple", "파스텔 퍼플", "은은한 라일락빛"], ["pastel-yellow", "파스텔 옐로우", "따스한 레몬빛"]
    ];
    openModal(`<h3>앱 설치 아이콘</h3><p class="m-sub">아이콘을 고르면 해당 설치 전용 페이지로 이동해요. 이미 설치한 앱의 아이콘을 바꾸려면 기존 앱을 삭제한 뒤 다시 설치해 주세요.</p><div class="install-icon-grid">${choices.map(([id,name,sub]) => `<button class="install-icon-choice" data-install-icon="${id}"><img src="./icon-${id}-192.png" alt="${name}"><span><b>${name}</b><small>${sub}</small></span></button>`).join("")}</div><div class="m-row"><button class="m-btn" id="installIconClose">닫기</button></div>`);
    $("modalBox").querySelectorAll("[data-install-icon]").forEach((button) => button.addEventListener("click", () => { window.location.href = `./install-${button.dataset.installIcon}.html`; }));
    $on("installIconClose", "click", closeModal);
  }

  /* ---------- auto backup (last 10 snapshots) ---------- */
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
        id: "bk_" + autoBkLast, version: 2, ts: autoBkLast,
        projects: JSON.parse(JSON.stringify(st.projects)),
        notes: JSON.parse(JSON.stringify(st.notes)), files: snapFiles
      };
      await put("backups", snap);
      const all = (await getAll("backups")).sort((a, b) => b.ts - a.ts);
      for (let i = 10; i < all.length; i++) await del("backups", all[i].id);
    } catch (e) { console.warn("autobackup", e); }
  }
  function openAutoBackupList() {
    getAll("backups").then((all) => {
      all.sort((a, b) => b.ts - a.ts);
      if (!all.length) { openModal(`<h3>자동 백업</h3><p class="m-sub">아직 저장된 자동 백업이 없어요. 메모를 저장하면 자동으로 스냅샷이 쌓여요.</p><div class="m-row"><button class="m-btn primary" id="abClose">확인</button></div>`); $on("abClose", "click", closeModal); return; }
      const rows = all.map((s) => {
        const dt = new Date(s.ts), label = `${dt.getMonth() + 1}/${dt.getDate()} ${String(dt.getHours()).padStart(2, "0")}:${String(dt.getMinutes()).padStart(2, "0")}`;
        const fileLabel = Array.isArray(s.files) ? ` · 첨부 ${s.files.length}` : " · 첨부 미포함";
        return `<div class="lore-pick" data-bk="${s.id}"><div class="lp-body"><div class="lp-name">${label}</div><div class="lp-meta">프로젝트 ${s.projects.length} · 메모 ${s.notes.length}${fileLabel}</div></div><button class="ce-addbtn ab-restore" data-bk="${s.id}">복원 ›</button></div>`;
      }).join("");
      openModal(`<h3>자동 백업</h3><p class="m-sub">최근 ${all.length}개 스냅샷. v44부터 첨부파일도 함께 보관합니다. 복원 방식은 병합 또는 완전 교체를 고를 수 있어요.</p><div class="lore-pick-list">${rows}</div><div class="m-row"><button class="m-btn" id="abClose2">닫기</button></div>`);
      $on("abClose2", "click", closeModal);
      document.querySelectorAll(".ab-restore").forEach((btn) => btn.addEventListener("click", () => {
        const snap = all.find((x) => x.id === btn.dataset.bk); if (!snap) return;
        const dt = new Date(snap.ts), label = `${dt.getMonth() + 1}/${dt.getDate()} ${String(dt.getHours()).padStart(2, "0")}:${String(dt.getMinutes()).padStart(2, "0")}`;
        openRestoreModePicker({ app: "lumink", projects: snap.projects, notes: snap.notes, files: snap.files || [] }, `${label} 자동 백업`);
      }));
    });
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

  /* ---------- bind static ---------- */
  function bind() {
    $on("homeMenu", "click", openSidebar);
    $on("homeSettings", "click", () => go({ s: "settings" }));
    // settings rows
    $on("setTheme", "click", () => { applyTheme(st.theme === "light" ? "dark" : "light"); renderSettings(); });
    $on("setFont", "click", showFontDialog);
    $on("setBackup", "click", exportBackup);
    $on("setRestore", "click", () => $("restoreInput").click());
    $on("setReset", "click", resetData);
    $on("setAutoBackup", "click", openAutoBackupList);
    $on("setStorage", "click", () => {
      const val = $("setStorageVal").textContent, sub = $("setStorageSub").textContent;
      openModal(`<h3>저장공간</h3><p class="m-sub"><b>${esc(val)}</b><br>${esc(sub)}<br><br>표시 용량은 이 사이트가 브라우저에 저장한 데이터와 자동 백업을 포함해요. 이미지가 많을수록 자동 백업도 함께 커집니다.</p><div class="m-row"><button class="m-btn primary" id="storageClose">확인</button></div>`);
      $on("storageClose", "click", closeModal);
    });
    $on("setAccent", "click", openAccentPicker);
    $on("setToolbarMode", "click", openFormatbarModePicker);
    $on("setInstallIcon", "click", openInstallIconPicker);
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
    document.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === "s" || e.key === "S")) {
        const s = curView().s;
        if (s === "editor" || s === "lore" || s === "persona" || s === "character") {
          e.preventDefault();
          if (s === "editor") flushSave(true); else if (s === "lore") flushLore(); else if (s === "persona") flushPersona(); else flushCharacter();
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

    // global left-edge swipe -> open sidebar (any screen)
    let edgeX = null, edgeY = null;
    document.addEventListener("touchstart", (e) => {
      if (document.body.classList.contains("sidebar-open") || document.body.classList.contains("sheet-open") || $("modalScrim").classList.contains("open")) { edgeX = null; return; }
      const t = e.touches[0]; edgeX = t.clientX <= 24 ? t.clientX : null; edgeY = t.clientY;
    }, { passive: true });
    document.addEventListener("touchmove", (e) => {
      if (edgeX == null) return; const t = e.touches[0];
      if (t.clientX - edgeX > 55 && Math.abs(t.clientY - edgeY) < 45) { openSidebar(); edgeX = null; }
    }, { passive: true });
    document.addEventListener("touchend", () => { edgeX = null; });

    // editor
    $on("editor", "input", scheduleSave);
    $on("editor", "blur", () => { const s = freeEditorSession; if (s && s.active) void flushSave(false, s.noteId); });
    $on("codeArea", "input", scheduleSave);
    $on("codeArea", "blur", () => { const s = freeEditorSession; if (s && s.active) void flushSave(false, s.noteId); });
    $on("attachInput", "change", (e) => { const f = e.target.files && e.target.files[0]; if (f) addAttachment(f); e.target.value = ""; });
    $on("imgInput", "change", (e) => { const f = e.target.files && e.target.files[0]; if (f) insertImage(f); e.target.value = ""; });
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
      else if (id === "imgBtn") $("imgInput").click();
      else if (id === "alignBtn") showAlignMenu();
      else if (id === "codeBlockBtn") wrapCodeBlock();
      else if (id === "linkBtn") insertLinkPrompt();
      else if (id === "eraseBtn") eraseFormatting();
      else if (id === "codeToggle") setCodeMode(!st.codeMode);
      else if (id === "attachBtn") $("attachInput").click();
      else if (id === "colorBtn") openColorEditor();
    };
    fb.addEventListener("mousedown", fbHandler);
    fb.addEventListener("touchstart", fbHandler, { passive: false });
    bindHiliteButton();

    // lorebook
    $on("loreEdit", "input", scheduleLoreSave);
    $on("loreDepthSwitch", "click", () => { const n = getNote(st.curNoteId); if (!n || n.type !== "lorebook") return; n.data.depthOn = !n.data.depthOn; $("loreDepthSwitch").classList.toggle("on", n.data.depthOn); $("loreDepthWrap").classList.toggle("on", n.data.depthOn); saveLore(n, true); });
    $on("loreDepth", "change", (e) => { const n = getNote(st.curNoteId); if (!n || n.type !== "lorebook") return; let v = parseInt(e.target.value, 10); if (isNaN(v) || v < 0) v = 0; if (v > 999) v = 999; e.target.value = v; n.data.depth = v; saveLore(n, true); });
    $on("loreEdit", "blur", () => flushLore());
    $on("loreKwInput", "keydown", (e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addKeywordFromInput(); } });
    $on("loreKwInput", "blur", addKeywordFromInput);
    $on("loreActiveWrap", "click", toggleLoreActive);
    $on("lorePreviewBtn", "click", toggleLorePreview);
    $on("loreMore", "click", () => openNoteSheet(st.curNoteId));

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

    window.addEventListener("beforeunload", () => { flushSave(true); flushLore(); flushPersona(); flushCharacter(); });
    document.addEventListener("visibilitychange", () => { if (document.hidden) { flushSave(true); flushLore(); flushPersona(); flushCharacter(); } });
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
    try { await openDB(); st.projects = await getAll("projects"); st.notes = await getAll("notes"); }
    catch (e) { console.warn("DB error", e); toast("저장소를 열 수 없어요"); }
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
