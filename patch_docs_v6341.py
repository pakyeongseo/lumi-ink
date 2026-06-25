from pathlib import Path
import re, shutil
base=Path('/mnt/data/work_v63_41')
manual=base/'Lumi_Ink_Manual_1.html'
text=manual.read_text(encoding='utf-8')
# title and high-level version string
text=text.replace('루미잉크 전체 기능 상세 매뉴얼 · v63.40','루미잉크 전체 기능 상세 매뉴얼 · v63.41')
text=text.replace('<h2>v63.40 · 보드 조작·프레임·링크 교체 정비</h2>', '<h2>v63.40 · 보드 조작·프레임·링크 교체 정비</h2>')
entry='''\n  <div class="section-head"><div class="nib-num">41</div><h2>v63.41 · 메모 메뉴 정리·보드 선택 안정화</h2></div>\n  <p>모든 메모 타입은 메모 안으로 들어간 보기·편집 화면의 더보기 메뉴에서 <strong>선택</strong> 항목을 제거했습니다. 다중선택 관리는 홈·프로젝트 화면에서만 사용합니다.</p>\n  <ul>\n    <li>아이디어 보드와 HTML 작업실의 구분 마크는 현재 테마색을 바탕으로 각각 골드 계열·시안 계열의 겹치지 않는 색을 사용합니다.</li>\n    <li>아이디어 보드 메모지의 글자 크기를 <code>A-- · A- · A · A+ · A++ · A+++</code> 여섯 단계로 촘촘하게 조정했습니다.</li>\n    <li>메모지 글자색을 길게 누르면 자유메모의 리치 에디터와 동일한 정사각형 색상판·색조 슬라이더·HEX·RGB 입력기를 엽니다.</li>\n    <li>다중선택은 조각 내부의 이미지·음악·영상·버튼 위를 터치해도 캡처 단계에서 먼저 처리됩니다. 보기 모드에서는 다중선택 아이콘이 나타나지 않습니다.</li>\n  </ul>\n'''
# Add at end before closing body if not already
if 'v63.41 · 메모 메뉴 정리·보드 선택 안정화' not in text:
    text=text.replace('</body>',entry+'\n</body>',1)
manual.write_text(text,encoding='utf-8')

notes=base/'Lumi_Ink_v63.41_Release_Notes.md'
notes.write_text('''# Lumi Ink v63.41 — Note Menu Cleanup & Board Selection Stability\n\n## 핵심 변경\n\n- 메모 안의 보기/편집 더보기 메뉴에서 `선택` 항목 제거\n  - 홈·프로젝트 화면의 다중선택 관리 기능은 유지\n- 아이디어 보드·HTML 작업실의 메모 구분 마크에 테마 기조를 공유한 비중첩 색상 적용\n  - 아이디어 보드: 골드 계열\n  - HTML 작업실: 시안 계열\n- 아이디어 보드 메모지 리치 도구 글자 크기를 `A-- / A- / A / A+ / A++ / A+++` 6단계로 세분화\n- 메모지 글자색 길게 누르기에서 자유메모 리치 에디터와 동일한 정사각형 색상판·색조 슬라이더·HEX·RGB 입력기 사용\n- 다중선택 조각 터치를 캡처 단계에서 우선 처리\n  - 내부 이미지·음악·영상·링크·첨부 버튼 위 터치도 선택/해제로 동작\n  - 그룹은 기존처럼 단위 전체가 함께 선택\n- 아이디어 보드 보기 모드에서 다중선택 아이콘 숨김\n\n## 호환성\n\n- 기존 아이디어 보드 데이터와 조각 위치·프레임·잠금·그룹 데이터는 변경하지 않습니다.\n- 이 버전은 UI 이벤트 우선순위와 메뉴 노출만 정리합니다.\n''',encoding='utf-8')

readme=base/'README.md'
r=readme.read_text(encoding='utf-8')
r='# Lumi Ink v63.41 — Note Menu Cleanup & Board Selection Stability\n\n- 메모 내부 선택 메뉴 제거, 보드 다중선택 캡처 처리, 타입 마크 색상, 메모지 글자색 스튜디오/글자 크기 단계 정리\n- 릴리즈 노트: `Lumi_Ink_v63.41_Release_Notes.md`\n- 서비스워커 캐시: `ink-memo-v63.41-note-menu-multiselect`\n\n'+r
readme.write_text(r,encoding='utf-8')

sw=base/'service-worker.js'
s=sw.read_text(encoding='utf-8')
s=s.replace('ink-memo-v63.40-board-operations-replace','ink-memo-v63.41-note-menu-multiselect')
s=s.replace('"./Lumi_Ink_v63.40_Release_Notes.md",','"./Lumi_Ink_v63.40_Release_Notes.md",\n  "./Lumi_Ink_v63.41_Release_Notes.md",')
sw.write_text(s,encoding='utf-8')
# standalone manual
shutil.copy2(manual, base/'Lumi_Ink_Manual_v63.41_current.html')
shutil.copy2(manual, Path('/mnt/data/Lumi_Ink_Manual_v63.41_current.html'))
shutil.copy2(notes, Path('/mnt/data/Lumi_Ink_v63.41_Release_Notes.md'))
print('docs patched')
