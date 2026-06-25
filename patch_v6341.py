from pathlib import Path
import re
base=Path('/mnt/data/work_v63_41')
app=base/'app.js'
text=app.read_text(encoding='utf-8')
orig=text

# 1) Remove note-internal selection actions across all note-type action sheets.
# Only note selection entries are removed; project/home selection remains (enterSelMode("project", ...)).
pattern=r'\n\s*\{\s*icon\s*:\s*IC\.select\s*,\s*label\s*:\s*"선택"\s*,\s*fn\s*:\s*\(\)\s*=>\s*enterSelMode\(\s*"note"\s*,[^\n}]*?\)\s*\}\s*,?'
text, count = re.subn(pattern, '', text)
print('removed note selection menu entries', count)

# 2) Hide board multi-select control in readonly view.
old='$("ideaBoardMode").classList.toggle("active", ideaViewMode !== "list"); $("ideaListMode").classList.toggle("active", ideaViewMode === "list"); updateIdeaTopViewToggle(); updateIdeaSnapButton();'
new='$("ideaBoardMode").classList.toggle("active", ideaViewMode !== "list"); $("ideaListMode").classList.toggle("active", ideaViewMode === "list"); const multiToggle=$("ideaMultiToggle"); if(multiToggle) multiToggle.hidden=readOnly; updateIdeaTopViewToggle(); updateIdeaSnapButton();'
if old not in text: raise SystemExit('render marker not found')
text=text.replace(old,new,1)

# 3) finer memo rich text font-size steps
old='<select class="idea-note-font-size" aria-label="글자 크기" title="글자 크기"><option value="2">A−</option><option value="3" selected>A</option><option value="5">A+</option><option value="6">A++</option></select>'
new='<select class="idea-note-font-size" aria-label="글자 크기" title="글자 크기"><option value="2">A--</option><option value="3">A-</option><option value="4" selected>A</option><option value="5">A+</option><option value="6">A++</option><option value="7">A+++</option></select>'
if old not in text: raise SystemExit('font selector marker not found')
text=text.replace(old,new,1)

# 4) Make note fore-color long press use exactly the advanced free-memo color studio.
start=text.index('  function openIdeaNoteForeColorPicker(item, onPick) {')
end=text.index('\n\n  function bindIdeaNoteRichEditor', start)
replacement='''  function openIdeaNoteForeColorPicker(item, onPick) {
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
  }'''
text=text[:start]+replacement+text[end:]

# 5) Capture-phase multi-select: inner media/control handlers cannot swallow selection gestures.
old='''    if (ideaMultiSelectMode) {
      // 다중선택에서는 본문·미디어 내부를 포함한 조각 전체를 선택 토글 영역으로 취급합니다.
      // 기본 링크 이동/다운로드/재생 click까지 차단해 단일 조각 동작으로 빠지지 않게 합니다.
      el.addEventListener("pointerdown",(e)=>{if(e.button!=null&&e.button!==0)return;if(isTransformControl(e.target))return;e.preventDefault();e.stopPropagation();toggleIdeaMultiItem(item.id);});
      el.addEventListener("click",(e)=>{e.preventDefault();e.stopImmediatePropagation();},true);
      return;
    }'''
new='''    if (ideaMultiSelectMode) {
      // 다중선택은 캡처 단계에서 먼저 잡습니다. video/audio/button 내부의 자체 핸들러가
      // 이벤트를 소비해도 조각 선택 토글이 빠지지 않도록 보장합니다.
      const toggleFromMultiPointer=(e)=>{
        if(e.button!=null&&e.button!==0)return;
        if(isTransformControl(e.target))return;
        e.preventDefault(); e.stopImmediatePropagation();
        toggleIdeaMultiItem(item.id);
      };
      const blockMultiClick=(e)=>{e.preventDefault();e.stopImmediatePropagation();};
      el.addEventListener("pointerdown",toggleFromMultiPointer,true);
      el.addEventListener("pointerup",blockMultiClick,true);
      el.addEventListener("click",blockMultiClick,true);
      el.addEventListener("dblclick",blockMultiClick,true);
      return;
    }'''
if old not in text: raise SystemExit('multi branch marker not found')
text=text.replace(old,new,1)

# 6) The menu action is now not relevant inside any note, remove remnants from board sheet literal if regex didn't catch compressed form.
text=text.replace('''    const items=[
      {icon:IC.select,label:"선택",fn:()=>enterSelMode("note",n.id)},
      {icon:IC.color,label:"보드 배경",fn:()=>openIdeaBoardBackgroundPicker(n)},''','''    const items=[
      {icon:IC.color,label:"보드 배경",fn:()=>openIdeaBoardBackgroundPicker(n)},''')

# 7) More robust item normalization: preserve font-size 7 sanitization already permits 1..2 digit px but named list needs xx-large applies.
# No code needed, execCommand fontSize maps it safely through sanitizer.

if text==orig: raise SystemExit('No app changes')
app.write_text(text,encoding='utf-8')
print('app patched',len(orig),'->',len(text))
