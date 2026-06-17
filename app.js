"use strict";
/* ============================================================
   루미잉크 (Lumink) — app logic (1차)
   ============================================================ */
(function () {
  const L = window.__lumink;
  const st = L.state;
  const { $, uid, now, esc, fmtDate, plainText, deriveTitle, preview, toast,
          noteHtml, notesOf, getProject, getNote } = L.h;
  const { CHIP, TYPE_LABEL, openDB, getAll, put, del } = L;

  /* ---------- routing ---------- */
  const SCREENS = ["home", "project", "read", "editor"];
  function showScreen(s) { SCREENS.forEach((x) => $("screen-" + x).classList.toggle("active", x === s)); }
  function curView() { return st.viewStack[st.viewStack.length - 1]; }
  function render() {
    const v = curView();
    showScreen(v.s);
    if (v.s === "home") renderHome();
    else if (v.s === "project") renderProjectDetail();
    else if (v.s === "read") renderRead();
    else if (v.s === "editor") renderEditorMeta();
  }
  function go(view) { st.viewStack.push(view); history.pushState({ d: st.viewStack.length }, ""); render(); }
  function back() { if (st.viewStack.length > 1) { st.viewStack.pop(); render(); } }
  function closeTopOverlay() {
    if ($("modalScrim").classList.contains("open")) { closeModal(); return true; }
    if (document.body.classList.contains("sheet-open")) { closeSheet(); return true; }
    if (document.body.classList.contains("sidebar-open")) { closeSidebar(); return true; }
    return false;
  }
  window.addEventListener("popstate", () => {
    if (closeTopOverlay()) { history.pushState({}, ""); return; }
    if (curView().s === "editor") flushSave(true);
    if (st.viewStack.length > 1) { st.viewStack.pop(); render(); }
    else history.pushState({}, "");
  });

  /* ---------- migration ---------- */
  async function migrate() {
    const orphans = st.notes.filter((n) => !n.projectId || !n.type);
    if (orphans.length === 0 && st.projects.length > 0) return;
    let def = st.projects.find((p) => p.isDefault) || st.projects[0];
    if (!def) {
      def = { id: uid(), name: "기본 메모함", description: "여기에 메모가 모입니다.", icon: null, isDefault: true, createdAt: now(), updatedAt: now() };
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
        projIconHTML(p, "proj-icon") +
        `<div class="pc-name">${esc(p.name)}</div>` +
        `<div class="pc-meta">메모 ${cnt}개 · ${fmtDate(p.updatedAt || p.createdAt)}</div>` +
        `<div class="pc-more" data-pid="${p.id}"><svg viewBox="0 0 24 24"><circle cx="12" cy="5" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="12" cy="19" r="1.4"/></svg></div>`;
      card.addEventListener("click", (e) => {
        if (e.target.closest(".pc-more")) { e.stopPropagation(); openProjectSheet(p.id); return; }
        openProject(p.id);
      });
      attachLongPress(card, () => openProjectSheet(p.id));
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

  function renderProjectDetail() {
    const p = getProject(st.curProjectId);
    if (!p) { back(); return; }
    $("pdTopTitle").textContent = p.name;
    $("pdName").textContent = p.name;
    const desc = $("pdDesc");
    if (p.description && p.description.trim()) { desc.textContent = p.description; desc.classList.remove("empty"); }
    else { desc.textContent = "설명이 없습니다."; desc.classList.add("empty"); }
    const ns = notesOf(p.id);
    $("pdCount").textContent = `메모 ${ns.length}개`;
    const wrap = $("pdChips");
    if (!ns.length) { wrap.innerHTML = `<div class="grid-empty">이 프로젝트에 메모가 없어요.<br>아래 + 버튼으로 추가하세요.</div>`; return; }
    wrap.innerHTML = "";
    ns.forEach((n) => {
      const chip = document.createElement("div");
      chip.className = "memo-chip";
      const col = n.chipColor && CHIP[n.chipColor] ? CHIP[n.chipColor].c : null;
      const dotStyle = col ? `background:${col};box-shadow:0 0 8px ${col}` : "";
      chip.innerHTML =
        `<span class="mc-dot" style="${dotStyle}"></span>` +
        `<div class="mc-body"><div class="mc-title">${esc(n.title)}</div><div class="mc-meta">${fmtDate(n.updatedAt)} · ${esc(preview(noteHtml(n))) || "빈 메모"}</div></div>` +
        `<span class="mc-type">${TYPE_LABEL[n.type] || ""}</span>`;
      if (col) chip.style.borderColor = col.replace(")", ", .4)").replace("rgb", "rgba");
      chip.addEventListener("click", () => openNote(n.id));
      attachLongPress(chip, () => openNoteSheet(n.id));
      wrap.appendChild(chip);
    });
  }

  function renderRead() {
    const n = getNote(st.curNoteId);
    if (!n) { back(); return; }
    $("readTitle").textContent = n.title || "메모";
    $("readBody").innerHTML = noteHtml(n);
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
  }

  /* ---------- navigation actions ---------- */
  function openProject(id) { st.curProjectId = id; go({ s: "project" }); renderSidebar(); }
  function openNote(id) {
    const n = getNote(id); if (!n) return;
    st.curNoteId = id;
    if (n.type === "free") go({ s: "read" });
    else toast(TYPE_LABEL[n.type] + " 편집기는 다음 단계에서 제공돼요");
  }
  function editCurrentNote() { const n = getNote(st.curNoteId); if (n && n.type === "free") go({ s: "editor" }); }

  /* ---------- project CRUD ---------- */
  async function saveProject(p) { p.updatedAt = now(); await put("projects", p); }
  async function createProject(name, desc) {
    const p = { id: uid(), name: name || "새 프로젝트", description: desc || "", icon: null, createdAt: now(), updatedAt: now() };
    st.projects.push(p); await put("projects", p);
    return p;
  }
  async function deleteProject(id) {
    const p = getProject(id); if (!p) return;
    const ns = notesOf(id);
    for (const n of ns) { await del("notes", n.id); }
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
    const n = { id: uid(), projectId, type, title: "제목 없는 메모", chipColor: null, createdAt: now(), updatedAt: now(), data: type === "free" ? { html: "" } : {} };
    st.notes.push(n); await put("notes", n);
    const p = getProject(projectId); if (p) saveProject(p);
    st.curNoteId = n.id;
    return n;
  }
  async function deleteNote(id) {
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
  function scheduleSave() { setSaver("dirty"); clearTimeout(st.saveTimer); st.saveTimer = setTimeout(() => flushSave(false), 550); }
  async function flushSave(silent) {
    clearTimeout(st.saveTimer); st.saveTimer = null;
    const n = getNote(st.curNoteId); if (!n || n.type !== "free") return;
    const html = st.codeMode ? $("codeArea").value : $("editor").innerHTML;
    if (html === noteHtml(n)) return;
    n.data = n.data || {}; n.data.html = html;
    n.title = deriveTitle(html);
    $("edTitle").textContent = n.title;
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
      <div class="type-card disabled" data-t="lorebook">
        <div class="tc-ico"><svg viewBox="0 0 24 24"><path d="M4 5a2 2 0 0 1 2-2h12v18H6a2 2 0 0 1-2-2z"/><path d="M8 7h7M8 11h7"/></svg></div>
        <div><div class="tc-name">로어북</div><div class="tc-desc">World Info · 토큰 카운터</div></div>
        <span class="tc-soon">준비 중</span>
      </div>
      <div class="type-card disabled" data-t="persona">
        <div class="tc-ico"><svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg></div>
        <div><div class="tc-name">페르소나</div><div class="tc-desc">국문/영문 캐릭터 카드</div></div>
        <span class="tc-soon">준비 중</span>
      </div>
      <div class="m-row"><button class="m-btn" data-x="cancel">취소</button></div>
    `);
    $("modalBox").querySelectorAll(".type-card").forEach((card) => {
      card.addEventListener("click", () => {
        if (card.classList.contains("disabled")) { toast("다음 단계에서 제공될 기능이에요"); return; }
        const t = card.dataset.t;
        if (presetPid) { createNote(t, presetPid).then(() => { closeModal(); go({ s: "editor" }); }); }
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
    $("pickOk").addEventListener("click", () => { if (!selPid) return; createNote(type, selPid).then(() => { closeModal(); if (type === "free") go({ s: "editor" }); }); });
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
    icon: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="9" r="1.8"/><path d="M21 16l-5-5L5 21"/></svg>'
  };

  function openNoteSheet(id) {
    const n = getNote(id); if (!n) return;
    openSheet(n.title, [
      { icon: IC.rename, label: "이름 바꾸기", fn: () => renameModal("메모 이름", n.title, async (v) => { if (v) { n.title = v; await saveNote(n); render(); } }) },
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
      { icon: IC.icon, label: "아이콘 변경", fn: () => startIconChange(id) }
    ];
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

  /* ---------- icon upload ---------- */
  let iconTargetPid = null;
  function startIconChange(pid) { iconTargetPid = pid; $("iconInput").click(); }
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
    try { const data = await fileToResized(f, 256); const p = getProject(iconTargetPid); if (p) { p.icon = data; await saveProject(p); render(); renderSidebar(); toast("아이콘을 변경했어요"); } }
    catch (err) { toast("이미지를 불러오지 못했어요"); }
  });

  /* ---------- HTML export / import ---------- */
  function exportNote(id) {
    const n = getNote(id); if (!n) return;
    const title = n.title || "메모", html = noteHtml(n);
    const doc = `<!DOCTYPE html>
<html lang="ko"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="generator" content="Lumink"><meta name="lumink-created" content="${new Date(n.createdAt).toISOString()}">
<title>${esc(title)}</title>
<style>body{margin:0 auto;max-width:760px;padding:32px 20px;line-height:1.7;font-family:-apple-system,"Noto Sans KR",sans-serif;color:#1c1b19;word-break:break-word}img{max-width:100%;height:auto}a{color:#2f6fd0}blockquote{border-left:3px solid #2f6fd0;margin:8px 0;padding:2px 0 2px 14px;color:#555}table{border-collapse:collapse}td,th{border:1px solid #ddd;padding:4px 8px}pre{background:#f0ede6;padding:12px;border-radius:8px;overflow-x:auto}</style>
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
    $("homeSettings").addEventListener("click", () => toast("설정은 5단계에서 열려요"));
    $("homeNewMemo").addEventListener("click", () => showTypePicker(null));
    $("homeFab").addEventListener("click", () => showTypePicker(null));
    $("homeNewProject").addEventListener("click", () => showProjectForm(null, () => { render(); renderSidebar(); }));
    document.querySelectorAll(".nav-back").forEach((b) => b.addEventListener("click", back));
    $("pdMore").addEventListener("click", () => openProjectSheet(st.curProjectId));
    $("pdFab").addEventListener("click", () => showTypePicker(st.curProjectId));
    $("readEdit").addEventListener("click", editCurrentNote);
    $("readMore").addEventListener("click", () => openNoteSheet(st.curNoteId));
    $("edBack").addEventListener("click", () => { flushSave(true); back(); });
    $("edMore").addEventListener("click", () => openNoteSheet(st.curNoteId));
    $("sbNewProject").addEventListener("click", () => { closeSidebar(); showProjectForm(null, () => { render(); renderSidebar(); }); });
    $("sbImport").addEventListener("click", () => $("fileInput").click());
    $("sbTheme").addEventListener("click", () => applyTheme(st.theme === "light" ? "dark" : "light"));

    // editor
    $("editor").addEventListener("input", scheduleSave);
    $("editor").addEventListener("blur", () => flushSave(false));
    $("codeArea").addEventListener("input", scheduleSave);
    $("codeArea").addEventListener("blur", () => flushSave(false));
    $("codeToggle").addEventListener("click", () => setCodeMode(!st.codeMode));
    const fb = $("formatbar");
    const fbHandler = (e) => { const b = e.target.closest(".fbtn"); if (b && b.dataset.cmd) { e.preventDefault(); exec(b.dataset.cmd, b.dataset.val); } };
    fb.addEventListener("mousedown", fbHandler);
    fb.addEventListener("touchstart", fbHandler, { passive: false });
    $("colorPick").addEventListener("input", () => { $("colorSwatch").style.background = $("colorPick").value; exec("foreColor", $("colorPick").value); });

    window.addEventListener("beforeunload", () => flushSave(true));
    document.addEventListener("visibilitychange", () => { if (document.hidden) flushSave(true); });
  }

  /* ---------- init ---------- */
  async function init() {
    detectTheme(); bind();
    try { await openDB(); st.projects = await getAll("projects"); st.notes = await getAll("notes"); }
    catch (e) { console.warn("DB error", e); toast("저장소를 열 수 없어요"); }
    await migrate();
    history.replaceState({ d: 1 }, "");
    render();

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
