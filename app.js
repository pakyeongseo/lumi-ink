"use strict";
/* ============================================================
   루미잉크 (Lumink) — app logic (1차)
   ============================================================ */
(function () {
  const L = window.__lumink;
  const st = L.state;
  const { $, uid, now, esc, fmtDate, plainText, deriveTitle, preview, toast,
          noteHtml, notesOf, getProject, getNote } = L.h;
  const { CHIP, TYPE_LABEL, openDB, store, getAll, put, del } = L;
  function $on(id, type, fn, opts) { const el = $(id); if (el) el.addEventListener(type, fn, opts); else console.warn("[bind] #" + id + " not found — skipped"); }
  const ICONS = window.__luminkIcons || [];
  const DEFAULT_ICON = ICONS[0] ? ICONS[0].data : null;
  function getOne(name, id) { return new Promise((res, rej) => { const r = store(name, "readonly").get(id); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }

  /* ---------- routing ---------- */
  const SCREENS = ["home", "project", "read", "editor", "lore", "persona", "settings", "search"];
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
    else if (v.s === "settings") renderSettings();
    else if (v.s === "search") renderSearch();
  }
  function go(view) { st.viewStack.push(view); history.pushState({ d: st.viewStack.length }, ""); render(); }
  function back() {
    if (st.selMode) { exitSelMode(); return; }
    const cur = curView().s;
    if (cur === "editor") flushSave(true);
    if (cur === "lore") flushLore();
    if (cur === "persona") flushPersona();
    if (st.viewStack.length > 1) { st.viewStack.pop(); render(); }
  }
  function closeTopOverlay() {
    if (st.selMode) { exitSelMode(); return true; }
    if (!$("cropper").hidden) { closeCropper(); return true; }
    if (!$("lightbox").hidden) { $("lightbox").hidden = true; return true; }
    if ($("modalScrim").classList.contains("open")) { closeModal(); return true; }
    if (document.body.classList.contains("sheet-open")) { closeSheet(); return true; }
    if (document.body.classList.contains("sidebar-open")) { closeSidebar(); return true; }
    return false;
  }
  window.addEventListener("popstate", () => {
    if (closeTopOverlay()) { history.pushState({}, ""); return; }
    if (curView().s === "editor") flushSave(true);
    if (curView().s === "lore") flushLore();
    if (curView().s === "persona") flushPersona();
    if (st.viewStack.length > 1) { st.viewStack.pop(); render(); }
    else history.pushState({}, "");
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
  function projIconHTML(p, cls) {
    if (p && p.icon) return `<div class="${cls}"><img src="${p.icon}" alt=""><div class="frame"></div></div>`;
    return `<div class="${cls}"><span class="deflogo"></span><div class="frame"></div></div>`;
  }

  const PIN_SVG = '<svg viewBox="0 0 24 24"><path d="M9 4h6l-1 6 3 3v2H7v-2l3-3z"/><path d="M12 15v5"/></svg>';
  const PIN_STAR = '<svg class="pin-star" viewBox="0 0 24 24"><path d="M12 2l2.7 6.6 7 .5-5.4 4.5 1.8 6.9L12 17.3 5.9 21l1.8-6.9L2.3 9.1l7-.5z"/></svg>';
  const SORT_LABELS = { recent: "최신순", recent_asc: "오래된순", name: "이름 ㄱ→ㅎ", name_desc: "이름 ㅎ→ㄱ" };
  const TYPE_COLOR = { free: "#7b9bff", lorebook: "#6ad0ff", persona: "#c79bff" };
  const TYPE_TAG = { free: "F", lorebook: "R", persona: "P" };
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
  function makeProjCard(p) {
    const cnt = notesOf(p.id).length;
    const card = document.createElement("div");
    card.className = "proj-card";
    card.innerHTML =
      '<span class="sel-check"><svg viewBox="0 0 24 24"><path d="M5 12l5 5 9-10"/></svg></span>' +
      `<div class="pc-thumb">${projIconHTML(p, "proj-icon")}${p.pinned ? `<span class="pc-pin">${PIN_STAR}</span>` : ""}</div>` +
      `<div class="pc-name">${esc(p.name)}</div>` +
      `<div class="pc-row"><span class="pc-count">메모 ${cnt}</span><span class="pc-time">${fmtDate(p.updatedAt || p.createdAt)}</span></div>` +
      `<div class="pc-more" data-pid="${p.id}"><svg viewBox="0 0 24 24"><circle cx="12" cy="5" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="12" cy="19" r="1.4"/></svg></div>`;
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
        `<div class="hm-more"><svg viewBox="0 0 24 24"><circle cx="12" cy="5" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="12" cy="19" r="1.4"/></svg></div>`;
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
    $("pdThumb").innerHTML = p.icon ? `<img src="${p.icon}" alt=""><div class="frame"></div>` : `<span class="deflogo"></span><div class="frame"></div>`;
    if (p.chipColor && CHIP[p.chipColor]) { const c = CHIP[p.chipColor].c, fr = $("pdThumb").querySelector(".frame"); if (fr) fr.style.boxShadow = `inset 0 0 0 1.5px ${c}, inset 0 0 16px ${c}40`; }
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
    const SECTIONS = [["persona", "페르소나"], ["lorebook", "로어북"], ["free", "자유 메모"]];
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
    $("edTitle").textContent = n.title || "메모";
    const html = noteHtml(n);
    if ($("editor").innerHTML !== html) $("editor").innerHTML = html;
    if ($("codeArea").value !== html) $("codeArea").value = html;
    if (st.codeMode) { st.codeMode = false; document.body.classList.remove("code-mode"); $("codeToggle").classList.remove("active"); }
    setSaver("");
    renderAttachments("edAttach", n, true);
  }

  /* ---------- navigation actions ---------- */
  function openProject(id) { st.curProjectId = id; go({ s: "project" }); renderSidebar(); }
  function flushPending() {
    if (st.saveTimer) flushSave(true);
    if (loreTimer) flushLore();
    if (perTimer) flushPersona();
  }
  function openNote(id) {
    const n = getNote(id); if (!n) return;
    flushPending();
    st.curNoteId = id;
    if (n.type === "free") go({ s: "read" });
    else if (n.type === "lorebook") go({ s: "lore" });
    else if (n.type === "persona") { st.perEdit = false; go({ s: "persona" }); }
    else toast(TYPE_LABEL[n.type] + " 편집기는 다음 단계에서 제공돼요");
  }
  function editCurrentNote() { const n = getNote(st.curNoteId); if (n && n.type === "free") go({ s: "editor" }); }
  function goHome() { closeSidebar(); st.viewStack = [{ s: "home" }]; history.replaceState({ d: 1 }, ""); render(); }

  /* ---------- project CRUD ---------- */
  async function saveProject(p) { p.updatedAt = now(); await put("projects", p); }
  async function createProject(name, desc) {
    const p = { id: uid(), name: name || "새 프로젝트", description: desc || "", icon: DEFAULT_ICON, createdAt: now(), updatedAt: now() };
    st.projects.push(p); await put("projects", p);
    return p;
  }
  async function deleteProject(id) {
    const p = getProject(id); if (!p) return;
    await doAutoBackup();
    const ns = notesOf(id);
    for (const n of ns) { await purgeNoteFiles(n); await del("notes", n.id); }
    st.notes = st.notes.filter((n) => n.projectId !== id);
    st.projects = st.projects.filter((x) => x.id !== id);
    await del("projects", id);
    if (st.curProjectId === id) st.curProjectId = null;
    toast("프로젝트를 삭제했어요");
  }
  async function duplicateProject(id) {
    const p = getProject(id); if (!p) return;
    const np = await createProject(p.name + " (사본)", p.description);
    np.icon = p.icon || null; await put("projects", np);
    const ns = notesOf(id);
    for (const n of ns) {
      const copy = { id: uid(), projectId: np.id, type: n.type, title: n.title, chipColor: n.chipColor || null, createdAt: now(), updatedAt: now(), data: JSON.parse(JSON.stringify(n.data || {})) };
      st.notes.push(copy); await put("notes", copy);
    }
    toast("프로젝트를 복제했어요");
  }

  /* ---------- note CRUD ---------- */
  async function saveNote(n) { n.updatedAt = now(); await put("notes", n); const p = getProject(n.projectId); if (p) saveProject(p); triggerAutoBackup(); }
  async function createNote(type, projectId) {
    const n = {
      id: uid(), projectId, type,
      title: type === "lorebook" ? "이름 없는 로어북" : type === "persona" ? "이름 없는 페르소나" : "제목 없는 메모",
      titleLocked: type === "lorebook",
      chipColor: null, createdAt: now(), updatedAt: now(),
      data: type === "free" ? { html: "" }
          : type === "lorebook" ? { content: "", keywords: [], alwaysActive: false, depthOn: false, depth: 4 }
          : type === "persona" ? { portrait: null, square: null, gallery: [], ko: { name: "", brief: "", detail: "" }, en: { name: "", brief: "", detail: "" } }
          : {}
    };
    st.notes.push(n); await put("notes", n);
    const p = getProject(projectId); if (p) saveProject(p);
    st.curNoteId = n.id;
    return n;
  }
  async function deleteNote(id) {
    const n = getNote(id);
    await doAutoBackup();
    await purgeNoteFiles(n);
    st.notes = st.notes.filter((n) => n.id !== id);
    await del("notes", id);
    toast("메모를 삭제했어요");
  }
  async function duplicateNote(id, targetPid) {
    const src = getNote(id); if (!src) return;
    const copy = { id: uid(), projectId: targetPid || src.projectId, type: src.type, title: src.title + " (사본)", chipColor: src.chipColor || null, createdAt: now(), updatedAt: now(), data: JSON.parse(JSON.stringify(src.data || {})) };
    st.notes.push(copy); await put("notes", copy);
    toast("복제했어요");
  }
  async function moveNote(id, targetPid) {
    const n = getNote(id); if (!n) return;
    n.projectId = targetPid; await saveNote(n);
    toast("이동했어요");
  }

  /* ---------- free-memo editor ---------- */
  function setSaver(mode) {
    const s = $("saver"); s.className = "saver " + mode;
    $("saverText").textContent = mode === "dirty" ? "기록 중" : mode === "saved" ? "저장됨" : "";
    if (mode === "saved") setTimeout(() => { if (s.classList.contains("saved")) { s.className = "saver"; $("saverText").textContent = ""; } }, 1500);
  }
  function scheduleSave() { if (!st.codeMode) normalizeLinks($("editor")); setSaver("dirty"); clearTimeout(st.saveTimer); const id = st.curNoteId; st.saveTimer = setTimeout(() => { if (st.curNoteId === id) flushSave(false); }, 550); }
  async function flushSave(silent) {
    clearTimeout(st.saveTimer); st.saveTimer = null;
    const n = getNote(st.curNoteId); if (!n || n.type !== "free") return;
    const html = st.codeMode ? $("codeArea").value : $("editor").innerHTML;
    if (html === noteHtml(n)) return;
    n.data = n.data || {}; n.data.html = html;
    if (!n.titleLocked) { n.title = deriveTitle(html); $("edTitle").textContent = n.title; }
    await saveNote(n);
    if (!silent) setSaver("saved");
  }
  function exec(cmd, val) { $("editor").focus(); try { document.execCommand("styleWithCSS", false, true); } catch (e) {} document.execCommand(cmd, false, val || null); scheduleSave(); }
  function setCodeMode(on) {
    if (on === st.codeMode || !st.curNoteId) return;
    flushSave(true);
    const html = noteHtml(getNote(st.curNoteId));
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
  function toggleHilite() {
    $("editor").focus();
    const sel = window.getSelection();
    if (!sel.rangeCount || sel.isCollapsed) { toast("형광펜을 칠할 텍스트를 선택해 주세요"); return; }
    const range = sel.getRangeAt(0);
    let anc = range.commonAncestorContainer;
    if (anc.nodeType === 3) anc = anc.parentElement;
    const existing = anc && anc.closest && anc.closest("span.lumi-hl");
    if (existing) {
      const parent = existing.parentNode;
      while (existing.firstChild) parent.insertBefore(existing.firstChild, existing);
      parent.removeChild(existing); parent.normalize();
      scheduleSave(); return;
    }
    try {
      const mark = document.createElement("span");
      mark.className = "lumi-hl"; mark.style.background = "#ffe27a"; mark.style.color = "#222";
      mark.style.borderRadius = "3px"; mark.style.padding = "0 1px";
      range.surroundContents(mark);
      sel.removeAllRanges();
    } catch (e) {
      try { document.execCommand("styleWithCSS", false, true); document.execCommand("hiliteColor", false, "#ffe27a"); } catch (e2) {}
    }
    scheduleSave();
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
    } catch (e) { toast("이미지를 넣지 못했어요"); }
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
      if ((m = raw.match(/^(#{1,3})\s+(.*)$/))) { closeLists(); out.push(`<h${m[1].length}>${inline(m[2])}</h${m[1].length}>`); continue; }
      if ((m = raw.match(/^\s*-\s+([^:：]+)[:：]\s*(.*)$/))) { closeLists(); out.push(`<div class="md-mini"><span class="md-mini-key">${inline(m[1].trim())}</span>${inline(m[2])}</div>`); continue; }
      if (/^\s*>\s?/.test(raw)) { closeLists(); out.push(`<blockquote>${inline(raw.replace(/^\s*>\s?/, ""))}</blockquote>`); continue; }
      if (/^\s*([-*+])\s+/.test(raw)) { if (!inUl) { closeLists(); out.push("<ul>"); inUl = true; } out.push(`<li>${inline(raw.replace(/^\s*[-*+]\s+/, ""))}</li>`); continue; }
      if (/^\s*\d+\.\s+/.test(raw)) { if (!inOl) { closeLists(); out.push("<ol>"); inOl = true; } out.push(`<li>${inline(raw.replace(/^\s*\d+\.\s+/, ""))}</li>`); continue; }
      if (/^\s*(---|\*\*\*|___)\s*$/.test(raw)) { closeLists(); out.push("<hr>"); continue; }
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
  function scheduleLoreSave() { setLoreSaver("dirty"); clearTimeout(loreTimer); const id = st.curNoteId; loreTimer = setTimeout(() => { if (st.curNoteId === id) flushLore(); }, 550); }
  async function flushLore() {
    clearTimeout(loreTimer); loreTimer = null;
    const n = getNote(st.curNoteId); if (!n || n.type !== "lorebook") return;
    const c = $("loreEdit").value;
    if (c === (n.data.content || "")) return;
    n.data.content = c; await saveLore(n);
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
      it.querySelector(".pg-del").addEventListener("click", (e) => { e.stopPropagation(); n.data.gallery.splice(idx, 1); savePersona(n, true); renderPerGallery(n); });
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
    let added = 0;
    for (const f of files) { if (!/^image\//.test(f.type)) continue; try { n.data.gallery.push(await fileToResized(f, 1600)); added++; } catch (e) {} }
    if (added) { await savePersona(n, true); renderPerGallery(n); toast(`${added}장 추가했어요`); }
    else toast("이미지를 넣지 못했어요");
  }
  function personaDetailHTML(text) {
    const cleaned = String(text || "").replace(/<user\b[^>]*>/gi, "").replace(/<\/user>/gi, "");
    const lines = cleaned.split(/\r?\n/);
    let html = "";
    lines.forEach((ln) => {
      const m = ln.match(/^\s*(#{1,6})\s+(.+?)\s*$/);
      if (m) { const lvl = Math.min(m[1].length, 3); html += `<div class="pr-head pr-h${lvl}">${esc(m[2])}</div>`; return; }
      const mini = ln.match(/^\s*-\s+([^:：]+)[:：]\s*(.*)$/);
      if (mini) { html += `<div class="pr-mini"><span class="pr-mini-key">${esc(mini[1].trim())}</span>${esc(mini[2])}</div>`; return; }
      const li = ln.match(/^\s*-\s+(.+?)\s*$/);
      if (li) { html += `<div class="pr-li"><span class="pr-bullet">▶</span><span>${esc(li[1])}</span></div>`; return; }
      if (ln.trim() === "") html += '<div class="pr-gap"></div>';
      else html += `<div class="pr-line">${esc(ln)}</div>`;
    });
    return html.trim() ? html : '<span class="pr-empty">(상세 설명 없음)</span>';
  }
  function renderPerRead(n) {
    const d = n.data, o = d[perLang] || {};
    $("perRPortrait").innerHTML = d.portrait ? `<img src="${d.portrait}" alt="">` : '<div class="per-ph"><svg viewBox="0 0 24 24"><rect x="4" y="3" width="16" height="18" rx="3"/><circle cx="9" cy="9" r="1.8"/><path d="M20 15l-5-4L6 19"/></svg><span>이미지 없음</span></div>';
    $("perRPortrait").onclick = d.portrait ? () => openLightbox(d.portrait) : null;
    const sqSrc = d.square || d.portrait;
    $("perRSquare").innerHTML = `<img src="${sqSrc || DEFAULT_ICON}" alt="">`;
    $("perRSquare").onclick = sqSrc ? () => openLightbox(sqSrc) : null;
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
    else gal.forEach((src) => { const it = document.createElement("div"); it.className = "pg-item"; it.innerHTML = `<img src="${src}" alt="">`; it.onclick = () => openLightbox(src); rg.appendChild(it); });
  }
  async function savePersona(n, silent) { n.updatedAt = now(); await put("notes", n); const p = getProject(n.projectId); if (p) saveProject(p); if (!silent) setPerSaver("saved"); triggerAutoBackup(); }
  function schedulePerSave() { setPerSaver("dirty"); clearTimeout(perTimer); const id = st.curNoteId; perTimer = setTimeout(() => { if (st.curNoteId === id) flushPersona(); }, 550); }
  async function flushPersona() {
    clearTimeout(perTimer); perTimer = null;
    const n = getNote(st.curNoteId); if (!n || n.type !== "persona" || !st.perEdit) return;
    const d = n.data;
    d.ko.name = $("perKoName").value; d.ko.detail = $("perKoDetail").value;
    d.en.name = $("perEnName").value; d.en.detail = $("perEnDetail").value;
    if (!n.titleLocked) { n.title = (d.ko.name.trim() || d.en.name.trim() || "이름 없는 페르소나"); $("perTitle").textContent = n.title; }
    await savePersona(n);
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
      fileToResized(file, 1600).then((data) => { n.data.gallery = n.data.gallery || []; n.data.gallery.push(data); savePersona(n, true); renderPerGallery(n); toast("이미지를 추가했어요"); }).catch(() => toast("이미지를 넣지 못했어요"));
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
  function openLightbox(src) { if (!src) return; $("lightboxImg").src = src; $("lightbox").hidden = false; }

  // image cropper
  let cropState = null;
  function loadImg(src) { return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; }); }
  async function startCrop(file, ratio, outW, outH, cb) {
    let url;
    try {
      url = URL.createObjectURL(file); const img = await loadImg(url);
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
    } catch (e) { toast("이미지를 불러오지 못했어요"); if (url) URL.revokeObjectURL(url); }
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
      <div class="m-row"><button class="m-btn" data-x="cancel">취소</button></div>
    `);
    $("modalBox").querySelectorAll(".type-card").forEach((card) => {
      card.addEventListener("click", () => {
        if (card.classList.contains("disabled")) { toast("다음 단계에서 제공될 기능이에요"); return; }
        const t = card.dataset.t;
        if (presetPid) { createNote(t, presetPid).then(() => { closeModal(); if (t === "persona") st.perEdit = true; go({ s: t === "lorebook" ? "lore" : t === "persona" ? "persona" : "editor" }); }); }
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
    $on("pickOk", "click", () => { if (!selPid) return; createNote(type, selPid).then(() => { closeModal(); if (type === "persona") st.perEdit = true; go({ s: type === "lorebook" ? "lore" : type === "persona" ? "persona" : "editor" }); }); });
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
      { icon: IC.icon, label: "아이콘 변경", fn: () => showIconPicker(id) }
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
  function fileToResized(file, max) {
    return new Promise((res, rej) => {
      const fr = new FileReader();
      fr.onload = () => { const img = new Image(); img.onload = () => {
        let w = img.width, h = img.height; const sc = Math.min(1, max / Math.max(w, h));
        const cw = Math.round(w * sc), ch = Math.round(h * sc);
        const cv = document.createElement("canvas"); cv.width = cw; cv.height = ch;
        cv.getContext("2d").drawImage(img, 0, 0, cw, ch);
        res(cv.toDataURL("image/jpeg", 0.92));
      }; img.onerror = rej; img.src = fr.result; };
      fr.onerror = rej; fr.readAsDataURL(file);
    });
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
  function renderSettings() {
    $("setThemeVal").textContent = st.theme === "light" ? "밝게" : "어둡게";
    $("setFontSub").textContent = (st.userFont && st.userFont.name) ? st.userFont.name : "기본 폰트";
    document.querySelectorAll("#fontSizeSeg button").forEach((b) => b.classList.toggle("on", b.dataset.fs === (st.fontScale || "normal")));
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
  async function applyImportData(projects, notes, files) {
    const curDefault = st.projects.find((p) => p.isDefault);
    const remap = {};
    for (const p of (projects || [])) {
      if (p.isDefault && curDefault && p.id !== curDefault.id) { remap[p.id] = curDefault.id; continue; }
      await put("projects", p);
    }
    for (const n of (notes || [])) {
      if (remap[n.projectId]) n.projectId = remap[n.projectId];
      await put("notes", n);
    }
    for (const f of (files || [])) {
      try { await put("files", { id: f.id, noteId: f.noteId, name: f.name, type: f.type, size: f.size, createdAt: f.createdAt, blob: base64ToBlob(f.data, f.type) }); } catch (e) {}
    }
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
        confirmModal("백업 복원", `프로젝트 ${payload.projects.length}개, 메모 ${(payload.notes || []).length}개를 현재 데이터에 병합할까요? 같은 항목은 백업 내용으로 덮어써요.`, "복원", false, async () => {
          try {
            await applyImportData(payload.projects, payload.notes || [], payload.files || []);
            await reloadState(); render(); renderSidebar(); toast("복원했어요");
          } catch (e) { toast("복원 중 오류가 났어요"); }
        });
      } catch (e) { toast("복원에 실패했어요"); }
    };
    fr.onerror = () => toast("파일을 읽지 못했어요");
    fr.readAsText(file, "UTF-8");
  }
  function resetData() {
    confirmModal("데이터 초기화", "모든 프로젝트와 메모가 영구 삭제됩니다. 먼저 백업을 권장해요.", "계속", true, () => {
      confirmModal("정말 초기화할까요?", "이 작업은 되돌릴 수 없어요.", "전부 삭제", true, async () => {
        try { await clearStore("notes"); await clearStore("projects"); await clearStore("files"); } catch (e) {}
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
        ok = !!t && t !== "persona" && notes.every((n) => n.type === t);
      }
      mb.hidden = !ok;
    }
  }
  async function mergeSelected() {
    const ids = [...(st.selIds || [])];
    if (ids.length < 2) { toast("2개 이상 선택해 주세요"); return; }
    const notes = ids.map(getNote).filter(Boolean);
    const type = notes[0].type;
    if (type === "persona") { toast("페르소나 메모는 합칠 수 없어요"); return; }
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
      for (const id of ids) { if (isNote) await deleteNote(id); else { const p = getProject(id); if (p && !p.isDefault) await deleteProject(id); } }
      exitSelMode(); renderSidebar(); toast("삭제했어요");
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
  function personaExportCSS(theme) {
    const D = theme === "dark";
    const c = D ? {
      bg: "#0f1320", text: "#e7e9f2", titleC: "#aebcec", panel: "#171c2b", panel2: "#1d2335", line: "#2a3147",
      chipBg: "#1b2740", chipC: "#7fbfff", chipBd: "#2f5183", headC: "#6fd6ff", accent: "#6ad0ff", muted: "#aeb4c7", shadow: "0 4px 18px rgba(0,0,0,.45)"
    } : {
      bg: "#f4f6fb", text: "#1c2233", titleC: "#283a63", panel: "#fff", panel2: "#e7ebf5", line: "#e2e7f1",
      chipBg: "#e9f0fc", chipC: "#3a6fd0", chipBd: "#cfe0fa", headC: "#283a63", accent: "#3a6fd0", muted: "#9aa0b4", shadow: "0 2px 10px rgba(60,90,160,.06)"
    };
    return `body{margin:0;background:${c.bg};color:${c.text};font-family:-apple-system,BlinkMacSystemFont,"Noto Sans KR","Segoe UI",sans-serif;word-break:break-word}
.wrap{max-width:680px;margin:0 auto;padding:28px 18px 64px}
.ptitle{font-size:24px;font-weight:800;color:${c.titleC};margin:0 0 18px}
.portrait{width:280px;max-width:82%;aspect-ratio:3/4;margin:0 auto 24px;border-radius:16px;overflow:hidden;background:${c.panel2};box-shadow:${c.shadow}}
.portrait img{width:100%;height:100%;object-fit:cover;display:block}
.lang{margin:0 0 28px}
.lang-head{display:inline-block;font-weight:700;font-size:13px;color:${c.chipC};background:${c.chipBg};padding:5px 13px;border-radius:999px;margin-bottom:13px}
.idrow{display:flex;gap:14px;align-items:center;margin-bottom:14px}
.sq{width:100px;height:100px;border-radius:15px;overflow:hidden;flex:0 0 auto;background:${c.panel2}}
.sq img{width:100%;height:100%;object-fit:cover;display:block}
.pname{font-size:21px;font-weight:750;margin-bottom:8px}
.tags{display:flex;flex-wrap:wrap;gap:6px}
.kw-chip{display:inline-block;background:${c.chipBg};color:${c.chipC};border:1px solid ${c.chipBd};padding:4px 11px;border-radius:8px;font-size:13px}
.detail{background:${c.panel};border:1px solid ${c.line};border-radius:14px;padding:15px 16px;line-height:1.72;font-size:15.5px;box-shadow:${c.shadow}}
.detail .pr-line{white-space:pre-wrap}.detail .pr-gap{height:.7em}.detail .pr-empty{color:${c.muted}}
.detail .pr-head{margin:14px 0 10px;padding:9px 14px;border-radius:11px;border:1px solid ${c.line};border-left:2px solid ${c.accent};background:linear-gradient(135deg,${c.chipBg},transparent);font-weight:750;color:${c.headC}}
.detail .pr-head:first-child{margin-top:0}
.detail .pr-li{display:flex;gap:7px;align-items:baseline;margin:4px 0;padding-left:9px}
.detail .pr-bullet{color:${c.accent};font-size:8px;flex:0 0 auto}
.detail .pr-mini{margin:6px 0;line-height:1.6}
.detail .pr-mini-key{display:inline-block;background:${c.chipBg};color:${c.chipC};font-weight:700;font-size:.9em;padding:2px 10px;border-radius:7px;margin-right:8px}
.detail .md-tag{margin:13px 0}
.detail .md-tag-open,.detail .md-tag-close{font-family:ui-monospace,monospace;font-size:.82em;font-weight:700;color:${c.accent};opacity:.82}
.detail .md-tag-open{margin-bottom:5px}.detail .md-tag-close{margin-top:5px}
.detail .md-tag-body{padding:9px 13px;border-left:2px solid ${c.accent};border-radius:0 10px 10px 0;background:${D ? "rgba(106,208,255,.09)" : "rgba(58,111,208,.07)"}}
.gal-label{display:inline-block;font-weight:700;font-size:13px;color:${c.chipC};background:${c.chipBg};padding:5px 13px;border-radius:999px;margin:24px 0 12px}
.gallery{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.gallery img{width:100%;aspect-ratio:1;object-fit:cover;border-radius:11px;display:block}
.foot{margin-top:30px;text-align:center;color:${c.muted};font-size:12px}`;
  }
  function choosePersonaExportTheme(id) {
    openModal(`<h3>HTML로 저장</h3><p class="m-sub">내보낼 카드 테마를 선택하세요.</p><div class="m-row"><button class="m-btn" id="pxLight">밝게</button><button class="m-btn primary" id="pxDark">어둡게</button></div>`);
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
  function sanitize(html) {
    const doc = new DOMParser().parseFromString(html, "text/html");
    doc.querySelectorAll("script, link[rel='stylesheet'], meta, base").forEach((el) => el.remove());
    doc.querySelectorAll("*").forEach((el) => [...el.attributes].forEach((a) => {
      const nm = a.name.toLowerCase();
      if (nm.startsWith("on")) el.removeAttribute(a.name);
      if ((nm === "href" || nm === "src") && /^\s*javascript:/i.test(a.value)) el.removeAttribute(a.name);
    }));
    const titleEl = doc.querySelector("title");
    return { html: doc.body ? doc.body.innerHTML.trim() : html, title: titleEl ? titleEl.textContent.trim() : "" };
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
    try { pTag = new DOMParser().parseFromString(raw, "text/html").getElementById("lumink-persona"); } catch (e) {}
    pickTargetProject(st.curProjectId, async (pid) => {
      if (pTag) {
        try {
          const pl = JSON.parse(pTag.textContent);
          if (pl && pl.kind === "persona" && pl.data) {
            const n = await createNote("persona", pid);
            n.title = pl.title || file.name.replace(/\.(html?)$/i, "") || "불러온 페르소나";
            n.titleLocked = true; n.data = pl.data;
            await savePersona(n, true);
            st.curNoteId = n.id; perLang = "ko"; st.perEdit = false; st.curProjectId = pid;
            toast("페르소나를 불러왔어요"); go({ s: "persona" }); return;
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
      const snap = { id: "bk_" + autoBkLast, ts: autoBkLast,
        projects: JSON.parse(JSON.stringify(st.projects)), notes: JSON.parse(JSON.stringify(st.notes)) };
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
        return `<div class="lore-pick" data-bk="${s.id}"><div class="lp-body"><div class="lp-name">${label}</div><div class="lp-meta">프로젝트 ${s.projects.length} · 메모 ${s.notes.length}</div></div><button class="ce-addbtn ab-restore" data-bk="${s.id}">복원</button></div>`;
      }).join("");
      openModal(`<h3>자동 백업</h3><p class="m-sub">최근 ${all.length}개 스냅샷. 복원하면 그 시점의 프로젝트·메모가 현재 데이터에 병합돼요.</p><div class="lore-pick-list">${rows}</div><div class="m-row"><button class="m-btn" id="abClose2">닫기</button></div>`);
      $on("abClose2", "click", closeModal);
      document.querySelectorAll(".ab-restore").forEach((btn) => btn.addEventListener("click", () => {
        const snap = all.find((x) => x.id === btn.dataset.bk); if (!snap) return;
        const dt = new Date(snap.ts), label = `${dt.getMonth() + 1}/${dt.getDate()} ${String(dt.getHours()).padStart(2, "0")}:${String(dt.getMinutes()).padStart(2, "0")}`;
        confirmModal("백업 복원", `${label} 시점의 백업(프로젝트 ${snap.projects.length} · 메모 ${snap.notes.length})을 현재 데이터에 병합할까요?`, "복원", false, () => {
          confirmModal("정말 복원할까요?", "같은 항목은 백업 내용으로 덮어써져요. 이 작업은 되돌리기 어려워요.", "복원 실행", false, async () => {
            try {
              await applyImportData(snap.projects, snap.notes, []);
              await reloadState(); render(); renderSidebar(); toast("백업을 복원했어요");
            } catch (e) { toast("복원 중 오류가 났어요"); }
          });
        });
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
    $on("edView", "click", () => { flushSave(true); go({ s: "read" }); });
    $on("readMore", "click", () => openNoteSheet(st.curNoteId));
    $on("edBack", "click", () => { flushSave(true); back(); });
    $on("edMore", "click", () => openNoteSheet(st.curNoteId));
    $on("sbNewProject", "click", () => { closeSidebar(); showProjectForm(null, () => { render(); renderSidebar(); }); });
    $on("sbNewMemo", "click", () => { closeSidebar(); showTypePicker(null); });
    $on("sbSettings", "click", () => { closeSidebar(); go({ s: "settings" }); });
    $on("edSave", "click", async () => { await flushSave(true); toast("저장했어요"); });
    $on("loreSave", "click", async () => { await flushLore(); toast("저장했어요"); });
    document.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === "s" || e.key === "S")) {
        const s = curView().s;
        if (s === "editor" || s === "lore" || s === "persona") {
          e.preventDefault();
          if (s === "editor") flushSave(true); else if (s === "lore") flushLore(); else flushPersona();
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
    $on("editor", "blur", () => flushSave(false));
    $on("codeArea", "input", scheduleSave);
    $on("codeArea", "blur", () => flushSave(false));
    $on("attachInput", "change", (e) => { const f = e.target.files && e.target.files[0]; if (f) addAttachment(f); e.target.value = ""; });
    $on("imgInput", "change", (e) => { const f = e.target.files && e.target.files[0]; if (f) insertImage(f); e.target.value = ""; });
    $on("editor", "paste", onEditorPaste);
    $on("editor", "keydown", (e) => { if (e.key === " " || e.key === "Enter") setTimeout(linkifyBeforeCaret, 0); });
    const fb = $("formatbar");
    const fbHandler = (e) => {
      const b = e.target.closest(".fbtn"); if (!b) return;
      e.preventDefault();
      const id = b.id;
      if (b.dataset.cmd) exec(b.dataset.cmd, b.dataset.val);
      else if (id === "hiliteBtn") toggleHilite();
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
    // lightbox
    $on("lbClose", "click", () => { $("lightbox").hidden = true; });
    $on("lightbox", "click", (e) => { if (e.target.id === "lightbox") $("lightbox").hidden = true; });
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

    window.addEventListener("beforeunload", () => { flushSave(true); flushLore(); flushPersona(); });
    document.addEventListener("visibilitychange", () => { if (document.hidden) { flushSave(true); flushLore(); flushPersona(); } });
  }

  /* ---------- init ---------- */
  async function init() {
    detectTheme();
    detectUserFont();
    detectFontScale();
    loadSorts();
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
