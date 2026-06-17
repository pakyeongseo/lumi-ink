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
  const ICONS = window.__luminkIcons || [];
  const DEFAULT_ICON = ICONS[0] ? ICONS[0].data : null;
  function getOne(name, id) { return new Promise((res, rej) => { const r = store(name, "readonly").get(id); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }

  /* ---------- routing ---------- */
  const SCREENS = ["home", "project", "read", "editor", "lore", "persona", "settings"];
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

  function renderHome() {
    const grid = $("projGrid");
    const ordered = st.projects.slice().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    if (!ordered.length) { grid.innerHTML = `<div class="grid-empty">아직 프로젝트가 없어요.<br>새 프로젝트를 만들어 보세요.</div>`; return; }
    grid.innerHTML = "";
    ordered.forEach((p) => {
      const cnt = notesOf(p.id).length;
      const card = document.createElement("div");
      card.className = "proj-card";
      card.innerHTML =
        '<span class="sel-check"><svg viewBox="0 0 24 24"><path d="M5 12l5 5 9-10"/></svg></span>' +
        projIconHTML(p, "proj-icon") +
        `<div class="pc-name">${esc(p.name)}</div>` +
        `<div class="pc-meta">메모 ${cnt}개 · ${fmtDate(p.updatedAt || p.createdAt)}</div>` +
        `<div class="pc-more" data-pid="${p.id}"><svg viewBox="0 0 24 24"><circle cx="12" cy="5" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="12" cy="19" r="1.4"/></svg></div>`;
      card.dataset.selid = p.id;
      if (st.selMode && st.selIds && st.selIds.has(p.id)) card.classList.add("selected");
      card.addEventListener("click", (e) => {
        if (st.selMode) { toggleSel(p.id); return; }
        if (e.target.closest(".pc-more")) { e.stopPropagation(); openProjectSheet(p.id); return; }
        openProject(p.id);
      });
      attachLongPress(card, () => { if (!st.selMode) openProjectSheet(p.id); });
      grid.appendChild(card);
    });
  }

  function renderSidebar() {
    const list = $("sbList");
    const ordered = st.projects.slice().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    list.innerHTML = "";
    ordered.forEach((p) => {
      const item = document.createElement("div");
      item.className = "sb-item" + (p.id === st.curProjectId ? " active" : "");
      item.innerHTML = projIconHTML(p, "sb-ico") + `<div class="sb-name">${esc(p.name)}</div><div class="sb-num">${notesOf(p.id).length}</div>`;
      item.addEventListener("click", () => { closeSidebar(); openProject(p.id); });
      attachLongPress(item, () => { closeSidebar(); openProjectSheet(p.id); });
      list.appendChild(item);
    });
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
      `<div class="mc-body"><div class="mc-title">${esc(n.title)}</div><div class="mc-meta">${fmtDate(n.updatedAt)} · ${esc(meta)}</div></div>` +
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
    $("pdName").textContent = p.name;
    const desc = $("pdDesc");
    if (p.description && p.description.trim()) { desc.textContent = p.description; desc.classList.remove("empty"); }
    else { desc.textContent = "설명이 없습니다."; desc.classList.add("empty"); }
    const ns = notesOf(p.id);
    $("pdCount").textContent = `메모 ${ns.length}개`;
    const wrap = $("pdChips");
    if (!ns.length) { wrap.innerHTML = `<div class="grid-empty">이 프로젝트에 메모가 없어요.<br>아래 + 버튼으로 추가하세요.</div>`; return; }
    wrap.innerHTML = "";
    const SECTIONS = [["persona", "페르소나"], ["lorebook", "로어북"], ["free", "자유 메모"]];
    SECTIONS.forEach(([t, label]) => {
      const group = ns.filter((n) => n.type === t);
      if (!group.length) return;
      const sec = document.createElement("div"); sec.className = "chip-section";
      const lab = document.createElement("div"); lab.className = "chip-section-label";
      lab.innerHTML = `<span class="csl-dot"></span>${label} <span class="csl-count">· ${group.length}</span>`;
      sec.appendChild(lab);
      group.forEach((n) => sec.appendChild(buildChip(n)));
      wrap.appendChild(sec);
    });
  }

  function renderRead() {
    const n = getNote(st.curNoteId);
    if (!n) { back(); return; }
    $("readTitle").textContent = n.title || "메모";
    $("readBody").innerHTML = noteHtml(n);
    normalizeLinks($("readBody"));
    renderAttachments("readAttach", n, false);
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
  function openNote(id) {
    const n = getNote(id); if (!n) return;
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
  async function saveNote(n) { n.updatedAt = now(); await put("notes", n); const p = getProject(n.projectId); if (p) saveProject(p); }
  async function createNote(type, projectId) {
    const n = {
      id: uid(), projectId, type,
      title: type === "lorebook" ? "이름 없는 로어북" : type === "persona" ? "이름 없는 페르소나" : "제목 없는 메모",
      titleLocked: type === "lorebook",
      chipColor: null, createdAt: now(), updatedAt: now(),
      data: type === "free" ? { html: "" }
          : type === "lorebook" ? { content: "", keywords: [], alwaysActive: false }
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
  function scheduleSave() { if (!st.codeMode) normalizeLinks($("editor")); setSaver("dirty"); clearTimeout(st.saveTimer); st.saveTimer = setTimeout(() => flushSave(false), 550); }
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
    $("szClose").addEventListener("click", closeModal);
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
    $("alClose").addEventListener("click", closeModal);
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
    const out = []; let inUl = false, inOl = false, inCode = false, code = [];
    const closeLists = () => { if (inUl) { out.push("</ul>"); inUl = false; } if (inOl) { out.push("</ol>"); inOl = false; } };
    for (const raw of lines) {
      if (/^```/.test(raw)) { if (inCode) { out.push("<pre><code>" + esc(code.join("\n")) + "</code></pre>"); code = []; inCode = false; } else { closeLists(); inCode = true; } continue; }
      if (inCode) { code.push(raw); continue; }
      if (/^\s*$/.test(raw)) { closeLists(); continue; }
      let m;
      if ((m = raw.match(/^(#{1,3})\s+(.*)$/))) { closeLists(); out.push(`<h${m[1].length}>${inline(m[2])}</h${m[1].length}>`); continue; }
      if (/^\s*>\s?/.test(raw)) { closeLists(); out.push(`<blockquote>${inline(raw.replace(/^\s*>\s?/, ""))}</blockquote>`); continue; }
      if (/^\s*([-*+])\s+/.test(raw)) { if (!inUl) { closeLists(); out.push("<ul>"); inUl = true; } out.push(`<li>${inline(raw.replace(/^\s*[-*+]\s+/, ""))}</li>`); continue; }
      if (/^\s*\d+\.\s+/.test(raw)) { if (!inOl) { closeLists(); out.push("<ol>"); inOl = true; } out.push(`<li>${inline(raw.replace(/^\s*\d+\.\s+/, ""))}</li>`); continue; }
      if (/^\s*(---|\*\*\*|___)\s*$/.test(raw)) { closeLists(); out.push("<hr>"); continue; }
      closeLists(); out.push(`<p>${inline(raw)}</p>`);
    }
    if (inCode) out.push("<pre><code>" + esc(code.join("\n")) + "</code></pre>");
    closeLists();
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
    const d = n.data = n.data || { content: "", keywords: [], alwaysActive: false };
    $("loreTitle").textContent = n.title || "로어북";
    if ($("loreEdit").value !== (d.content || "")) $("loreEdit").value = d.content || "";
    renderKeywords(n);
    $("loreActive").classList.toggle("on", !!d.alwaysActive);
    document.body.classList.remove("lore-preview-on");
    $("lorePreview").innerHTML = mdToHtml(d.content || "");
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
  }
  function scheduleLoreSave() { setLoreSaver("dirty"); clearTimeout(loreTimer); loreTimer = setTimeout(flushLore, 550); }
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
        order: 100, position: 0, disable: false, ignoreBudget: false, excludeRecursion: false, preventRecursion: false,
        matchPersonaDescription: false, matchCharacterDescription: false, matchCharacterPersonality: false,
        matchCharacterDepthPrompt: false, matchScenario: false, matchCreatorNotes: false, delayUntilRecursion: false,
        probability: 100, useProbability: true, depth: 4, outletName: "", group: "", groupOverride: false, groupWeight: 100,
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
  function exportWorldInfoFlow(notes) {
    if (!notes.length) { toast("내보낼 로어북이 없어요"); return; }
    openModal(`<h3>World Info 내보내기</h3><p class="m-sub">${notes.length}개 항목을 하나의 .json으로 묶어 내보냅니다.</p><div class="m-field-label">파일 이름 (.json)</div><input class="m-input" id="wiName" placeholder="예: 세계관_로어북" value="${esc(defaultWiName(notes))}" autocapitalize="off"><div class="m-row"><button class="m-btn" id="wiNo">취소</button><button class="m-btn primary" id="wiOk">내보내기</button></div>`);
    setTimeout(() => { const i = $("wiName"); i.focus(); i.select(); }, 120);
    $("wiNo").addEventListener("click", closeModal);
    $("wiOk").addEventListener("click", () => {
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
    openModal(`<h3>World Info 내보내기</h3><p class="m-sub">하나의 .json으로 묶을 로어북을 선택하세요.</p><div class="lore-pick-list" id="lpList"></div><div class="m-row"><button class="m-btn" id="lpNo">취소</button><button class="m-btn primary" id="lpNext">다음</button></div>`);
    const list = $("lpList");
    const draw = () => {
      list.innerHTML = "";
      lores.forEach((n) => {
        const row = document.createElement("div"); row.className = "lore-pick" + (sel.has(n.id) ? " sel" : "");
        const tk = ((n.data && n.data.keywords) || []).length;
        row.innerHTML = `<div class="lp-check"><svg viewBox="0 0 24 24"><path d="M5 12l4 4 10-10"/></svg></div><div class="lp-body"><div class="lp-name">${esc(n.title)}</div><div class="lp-meta">키워드 ${tk}개${n.data && n.data.alwaysActive ? " · 항상 활성" : ""}</div></div>`;
        row.addEventListener("click", () => { if (sel.has(n.id)) sel.delete(n.id); else sel.add(n.id); draw(); });
        list.appendChild(row);
      });
    };
    draw();
    $("lpNo").addEventListener("click", closeModal);
    $("lpNext").addEventListener("click", () => {
      const chosen = lores.filter((n) => sel.has(n.id));
      if (!chosen.length) { toast("최소 1개를 선택하세요"); return; }
      exportWorldInfoFlow(chosen);
    });
  }
  function openLoreSheet(n) {
    openSheet(n.title, [
      { icon: IC.select, label: "선택", fn: () => enterSelMode("note", n.id) },
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
      const it = document.createElement("div"); it.className = "pg-item";
      it.innerHTML = `<img src="${src}" alt=""><button class="pg-del" aria-label="삭제">${PER_X}</button>`;
      it.querySelector(".pg-del").addEventListener("click", (e) => { e.stopPropagation(); n.data.gallery.splice(idx, 1); savePersona(n, true); renderPerGallery(n); });
      wrap.appendChild(it);
    });
    const add = document.createElement("div"); add.className = "pg-add"; add.innerHTML = '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>';
    add.addEventListener("click", () => { perImgTarget = "gallery"; $("perImgInput").click(); });
    wrap.appendChild(add);
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
    $("perRDetail").textContent = o.detail || "";
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
  async function savePersona(n, silent) { n.updatedAt = now(); await put("notes", n); const p = getProject(n.projectId); if (p) saveProject(p); if (!silent) setPerSaver("saved"); }
  function schedulePerSave() { setPerSaver("dirty"); clearTimeout(perTimer); perTimer = setTimeout(flushPersona, 550); }
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
      fileToResized(file, 640).then((data) => { n.data.gallery = n.data.gallery || []; n.data.gallery.push(data); savePersona(n, true); renderPerGallery(n); toast("이미지를 추가했어요"); }).catch(() => toast("이미지를 넣지 못했어요"));
      return;
    }
    const isPt = perImgTarget === "portrait", target = perImgTarget;
    startCrop(file, isPt ? 3 / 4 : 1, isPt ? 600 : 768, isPt ? 800 : 768, (data) => {
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
    const data = cv.toDataURL("image/jpeg", 0.85);
    const cb = s.cb; closeCropper(); cb(data);
  }
  function openPersonaSheet(n) {
    openSheet(n.title, [
      { icon: IC.select, label: "선택", fn: () => enterSelMode("note", n.id) },
      { icon: IC.rename, label: "이름 바꾸기", fn: () => renameModal("페르소나 이름", n.title, async (v) => { if (v) { n.title = v; n.titleLocked = true; await savePersona(n, true); render(); } }) },
      { icon: IC.color, label: "색상 지정", fn: () => showChipPicker(n.id) },
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
    $("lkNo").addEventListener("click", closeModal);
    $("lkOk").addEventListener("click", () => {
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
  $("modalScrim").addEventListener("click", (e) => { if (e.target === $("modalScrim")) closeModal(); });

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
    $("pickNew").addEventListener("click", () => showProjectForm(null, (np) => { selPid = np.id; showProjectPicker(type); }));
    $("pickCancel").addEventListener("click", closeModal);
    $("pickOk").addEventListener("click", () => { if (!selPid) return; createNote(type, selPid).then(() => { closeModal(); if (type === "persona") st.perEdit = true; go({ s: type === "lorebook" ? "lore" : type === "persona" ? "persona" : "editor" }); }); });
  }

  // project create/edit form. onDone(project) optional
  function showProjectForm(editId, onDone) {
    const p = editId ? getProject(editId) : null;
    openModal(`
      <h3>${p ? "프로젝트 편집" : "새 프로젝트"}</h3>
      <div class="m-field-label">이름</div>
      <input class="m-input" id="pfName" maxlength="60" placeholder="프로젝트 이름" value="${p ? esc(p.name) : ""}">
      <div class="m-field-label">설명 (선택)</div>
      <textarea class="m-textarea" id="pfDesc" maxlength="500" placeholder="이 프로젝트에 대한 간략한 설명">${p ? esc(p.description || "") : ""}</textarea>
      <div class="m-row"><button class="m-btn" id="pfCancel">취소</button><button class="m-btn primary" id="pfOk">${p ? "저장" : "만들기"}</button></div>
    `);
    setTimeout(() => $("pfName").focus(), 120);
    $("pfCancel").addEventListener("click", closeModal);
    $("pfOk").addEventListener("click", async () => {
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
    $("chipClose").addEventListener("click", closeModal);
  }

  function confirmModal(title, msg, okLabel, danger, onOk) {
    openModal(`<h3>${esc(title)}</h3><p class="m-sub">${esc(msg)}</p><div class="m-row"><button class="m-btn" id="cfNo">취소</button><button class="m-btn ${danger ? "danger" : "primary"}" id="cfYes">${esc(okLabel)}</button></div>`);
    $("cfNo").addEventListener("click", closeModal);
    $("cfYes").addEventListener("click", () => { closeModal(); onOk(); });
  }
  function renameModal(title, current, onOk) {
    openModal(`<h3>${esc(title)}</h3><input class="m-input" id="rnInput" maxlength="80" value="${esc(current)}"><div class="m-row"><button class="m-btn" id="rnNo">취소</button><button class="m-btn primary" id="rnOk">저장</button></div>`);
    setTimeout(() => { const i = $("rnInput"); i.focus(); i.select(); }, 120);
    $("rnNo").addEventListener("click", closeModal);
    $("rnOk").addEventListener("click", () => { const v = $("rnInput").value.trim(); closeModal(); onOk(v); });
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
  $("sheetScrim").addEventListener("click", closeSheet);
  const IC = {
    rename: '<svg viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>',
    color: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="9" r="1.3" fill="currentColor" stroke="none"/><circle cx="15" cy="12" r="1.3" fill="currentColor" stroke="none"/><circle cx="9" cy="12" r="1.3" fill="currentColor" stroke="none"/></svg>',
    save: '<svg viewBox="0 0 24 24"><path d="M12 4v12M7 11l5 5 5-5"/><path d="M5 20h14"/></svg>',
    move: '<svg viewBox="0 0 24 24"><path d="M5 9l-3 3 3 3M2 12h10M14 5h6a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-6"/></svg>',
    copy: '<svg viewBox="0 0 24 24"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h8"/></svg>',
    del: '<svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>',
    icon: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="9" r="1.8"/><path d="M21 16l-5-5L5 21"/></svg>',
    export: '<svg viewBox="0 0 24 24"><path d="M12 3v12M8 7l4-4 4 4"/><path d="M5 14v5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-5"/></svg>',
    select: '<svg viewBox="0 0 24 24"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>'
  };

  function openNoteSheet(id) {
    const n = getNote(id); if (!n) return;
    if (n.type === "lorebook") { openLoreSheet(n); return; }
    if (n.type === "persona") { openPersonaSheet(n); return; }
    openSheet(n.title, [
      { icon: IC.select, label: "선택", fn: () => enterSelMode("note", id) },
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
      { icon: IC.rename, label: "이름 · 설명 편집", fn: () => showProjectForm(id, () => { render(); renderSidebar(); }) },
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
    $("ptNew").addEventListener("click", () => showProjectForm(null, () => pickTargetProject(excludeOrCurrent, onPick)));
    $("ptNo").addEventListener("click", closeModal);
    $("ptOk").addEventListener("click", () => { if (sel) { closeModal(); onPick(sel); } });
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
    $("iconUpload").addEventListener("click", () => { iconTargetPid = pid; $("iconInput").click(); });
    $("iconClose").addEventListener("click", closeModal);
  }
  function fileToResized(file, max) {
    return new Promise((res, rej) => {
      const fr = new FileReader();
      fr.onload = () => { const img = new Image(); img.onload = () => {
        let w = img.width, h = img.height; const sc = Math.min(1, max / Math.max(w, h));
        const cw = Math.round(w * sc), ch = Math.round(h * sc);
        const cv = document.createElement("canvas"); cv.width = cw; cv.height = ch;
        cv.getContext("2d").drawImage(img, 0, 0, cw, ch);
        res(cv.toDataURL("image/jpeg", 0.85));
      }; img.onerror = rej; img.src = fr.result; };
      fr.onerror = rej; fr.readAsDataURL(file);
    });
  }
  $("iconInput").addEventListener("change", async (e) => {
    const f = e.target.files && e.target.files[0]; e.target.value = "";
    if (!f || !iconTargetPid) return;
    try { const data = await fileToResized(f, 256); const p = getProject(iconTargetPid); if (p) { p.icon = data; await saveProject(p); closeModal(); render(); renderSidebar(); toast("아이콘을 변경했어요"); } }
    catch (err) { toast("이미지를 불러오지 못했어요"); }
  });

  /* ---------- settings ---------- */
  function renderSettings() {
    $("setThemeVal").textContent = st.theme === "light" ? "밝게" : "어둡게";
    $("setFontSub").textContent = (st.userFont && st.userFont.name) ? st.userFont.name : "기본 폰트";
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
    $("fontReset").addEventListener("click", () => { applyUserFont(null); closeModal(); renderSettings(); toast("기본 폰트로 되돌렸어요"); });
    $("fontApply").addEventListener("click", () => {
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
            for (const p of payload.projects) await put("projects", p);
            for (const n of (payload.notes || [])) await put("notes", n);
            for (const f of (payload.files || [])) await put("files", { id: f.id, noteId: f.noteId, name: f.name, type: f.type, size: f.size, createdAt: f.createdAt, blob: base64ToBlob(f.data, f.type) });
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
  function updateSelBar() { $("selCount").textContent = `${st.selIds ? st.selIds.size : 0}개 선택`; }
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
    fr.onload = async () => {
      const parsed = sanitize(String(fr.result || ""));
      const fallback = file.name.replace(/\.(html?|HTML?)$/i, "");
      let pid = st.curProjectId || (st.projects[0] && st.projects[0].id);
      if (!pid) { const p = await createProject("기본 메모함", ""); pid = p.id; }
      const n = await createNote("free", pid);
      n.title = parsed.title || fallback || "불러온 메모"; n.data.html = parsed.html;
      await saveNote(n);
      st.curNoteId = n.id;
      toast("불러왔어요"); go({ s: "editor" });
    };
    fr.onerror = () => toast("파일을 읽지 못했어요");
    fr.readAsText(file, "UTF-8");
  }
  $("fileInput").addEventListener("change", (e) => { const f = e.target.files && e.target.files[0]; if (f) importHtmlFile(f); e.target.value = ""; closeSidebar(); });

  /* ---------- sidebar / theme ---------- */
  function openSidebar() { renderSidebar(); document.body.classList.add("sidebar-open"); }
  function closeSidebar() { document.body.classList.remove("sidebar-open"); }
  $("sidebarScrim").addEventListener("click", closeSidebar);
  function applyTheme(t) {
    st.theme = t; document.documentElement.setAttribute("data-theme", t);
    document.querySelector('meta[name=theme-color]').setAttribute("content", t === "light" ? "#f3f4f8" : "#0d0f17");
    $("themeIcon").innerHTML = t === "light"
      ? '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M6.5 17.5L5 19"/>'
      : '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>';
    try { localStorage.setItem("luminkTheme", t); } catch (e) {}
  }
  function detectTheme() { let t = null; try { t = localStorage.getItem("luminkTheme"); } catch (e) {} applyTheme(t || "dark"); }

  /* ---------- long-press ---------- */
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
    $("homeMenu").addEventListener("click", openSidebar);
    $("homeSettings").addEventListener("click", () => go({ s: "settings" }));
    // settings rows
    $("setTheme").addEventListener("click", () => { applyTheme(st.theme === "light" ? "dark" : "light"); renderSettings(); });
    $("setFont").addEventListener("click", showFontDialog);
    $("setBackup").addEventListener("click", exportBackup);
    $("setRestore").addEventListener("click", () => $("restoreInput").click());
    $("setReset").addEventListener("click", resetData);
    $("restoreInput").addEventListener("change", (e) => { const f = e.target.files && e.target.files[0]; if (f) restoreBackup(f); e.target.value = ""; });
    // selection bar
    $("selCancel").addEventListener("click", exitSelMode);
    $("selAll").addEventListener("click", selectAllCurrent);
    $("selMove").addEventListener("click", bulkMove);
    $("selDelete").addEventListener("click", bulkDelete);
    $("homeNewMemo").addEventListener("click", () => showTypePicker(null));
    $("homeFab").addEventListener("click", () => showTypePicker(null));
    $("homeNewProject").addEventListener("click", () => showProjectForm(null, () => { render(); renderSidebar(); }));
    document.querySelectorAll(".nav-back").forEach((b) => b.addEventListener("click", back));
    document.querySelectorAll(".nav-menu").forEach((b) => b.addEventListener("click", openSidebar));
    $("pdMore").addEventListener("click", () => openProjectSheet(st.curProjectId));
    $("pdSelect").addEventListener("click", () => { if (notesOf(st.curProjectId).length) enterSelMode("note", null); else toast("선택할 메모가 없어요"); });
    $("pdFab").addEventListener("click", () => showTypePicker(st.curProjectId));
    $("readEdit").addEventListener("click", editCurrentNote);
    $("readMore").addEventListener("click", () => openNoteSheet(st.curNoteId));
    $("edBack").addEventListener("click", () => { flushSave(true); back(); });
    $("edMore").addEventListener("click", () => openNoteSheet(st.curNoteId));
    $("sbNewProject").addEventListener("click", () => { closeSidebar(); showProjectForm(null, () => { render(); renderSidebar(); }); });
    $("sbNewMemo").addEventListener("click", () => { closeSidebar(); showTypePicker(null); });
    $("sbLogo").addEventListener("click", goHome);
    $("homeLogo").addEventListener("click", () => { const hs = document.querySelector(".home-scroll"); if (hs) hs.scrollTo({ top: 0, behavior: "smooth" }); });
    $("sbImport").addEventListener("click", () => $("fileInput").click());
    $("sbTheme").addEventListener("click", () => applyTheme(st.theme === "light" ? "dark" : "light"));

    // read: double-tap to edit
    $("readBody").addEventListener("dblclick", editCurrentNote);

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
    $("editor").addEventListener("input", scheduleSave);
    $("editor").addEventListener("blur", () => flushSave(false));
    $("codeArea").addEventListener("input", scheduleSave);
    $("codeArea").addEventListener("blur", () => flushSave(false));
    $("attachInput").addEventListener("change", (e) => { const f = e.target.files && e.target.files[0]; if (f) addAttachment(f); e.target.value = ""; });
    $("imgInput").addEventListener("change", (e) => { const f = e.target.files && e.target.files[0]; if (f) insertImage(f); e.target.value = ""; });
    $("editor").addEventListener("paste", onEditorPaste);
    $("editor").addEventListener("keydown", (e) => { if (e.key === " " || e.key === "Enter") setTimeout(linkifyBeforeCaret, 0); });
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
      else if (id === "codeToggle") setCodeMode(!st.codeMode);
      else if (id === "attachBtn") $("attachInput").click();
    };
    fb.addEventListener("mousedown", fbHandler);
    fb.addEventListener("touchstart", fbHandler, { passive: false });
    $("colorPick").addEventListener("input", () => { $("colorSwatch").style.background = $("colorPick").value; exec("foreColor", $("colorPick").value); });

    // lorebook
    $("loreEdit").addEventListener("input", scheduleLoreSave);
    $("loreEdit").addEventListener("blur", () => flushLore());
    $("loreKwInput").addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addKeywordFromInput(); } });
    $("loreKwInput").addEventListener("blur", addKeywordFromInput);
    $("loreActiveWrap").addEventListener("click", toggleLoreActive);
    $("lorePreviewBtn").addEventListener("click", toggleLorePreview);
    $("loreMore").addEventListener("click", () => openNoteSheet(st.curNoteId));

    // persona
    ["perKoName", "perKoDetail", "perEnName", "perEnDetail"].forEach((id) => {
      $(id).addEventListener("input", schedulePerSave);
      $(id).addEventListener("blur", () => flushPersona());
    });
    $("perKoTagInput").addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addPerTag("ko"); } });
    $("perKoTagInput").addEventListener("blur", () => addPerTag("ko"));
    $("perEnTagInput").addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addPerTag("en"); } });
    $("perEnTagInput").addEventListener("blur", () => addPerTag("en"));
    document.querySelectorAll("#screen-persona .per-tab").forEach((t) => t.addEventListener("click", () => setPerLang(t.dataset.lang)));
    $("perPortrait").addEventListener("click", (e) => { if (e.target.closest(".per-del")) return; perImgTarget = "portrait"; $("perImgInput").click(); });
    $("perSquare").addEventListener("click", (e) => { if (e.target.closest(".per-del")) return; perImgTarget = "square"; $("perImgInput").click(); });
    $("perImgInput").addEventListener("change", (e) => { const f = e.target.files && e.target.files[0]; if (f) applyPerImage(f); e.target.value = ""; });
    $("perViewToggle").addEventListener("click", togglePerView);
    $("perMore").addEventListener("click", () => openNoteSheet(st.curNoteId));
    // lightbox
    $("lbClose").addEventListener("click", () => { $("lightbox").hidden = true; });
    $("lightbox").addEventListener("click", (e) => { if (e.target.id === "lightbox") $("lightbox").hidden = true; });
    // cropper
    $("cropCancel").addEventListener("click", closeCropper);
    $("cropOk").addEventListener("click", commitCrop);
    $("cropZoom").addEventListener("input", (e) => setCropZoom(e.target.value));
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
