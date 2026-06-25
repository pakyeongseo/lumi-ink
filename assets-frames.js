/* Lumi Ink — decorative project-thumbnail frames.
   Each frame: build(color) -> inner SVG markup (no <svg> wrapper).
   Drawn in a 0..100 square viewBox, overlaid on a square thumbnail.
   The molding band sits on the edges; the center stays open for the image. */
(function () {
  // molding band (raised picture-frame edge) with bevel highlight + shadow
  function band(c, o, w, rx) {
    var mid = o + w / 2, mr = 100 - mid * 2;
    var s = 100 - o * 2;
    return (
      '<rect x="' + mid + '" y="' + mid + '" width="' + mr + '" height="' + mr + '" rx="' + rx + '" fill="none" stroke="' + c + '" stroke-width="' + w + '"/>' +
      '<rect x="' + (o + 1) + '" y="' + (o + 1) + '" width="' + (s - 2) + '" height="' + (s - 2) + '" rx="' + (rx + w / 2 - 1) + '" fill="none" stroke="#ffffff" stroke-opacity=".26" stroke-width="1.3"/>' +
      '<rect x="' + (o + w - 1) + '" y="' + (o + w - 1) + '" width="' + (s - (w - 1) * 2) + '" height="' + (s - (w - 1) * 2) + '" rx="' + Math.max(2, rx - w / 2) + '" fill="none" stroke="#000000" stroke-opacity=".28" stroke-width="1.3"/>'
    );
  }
  // thin accent line rect
  function line(c, inset, sw, rx, op) {
    var s = 100 - inset * 2;
    return '<rect x="' + inset + '" y="' + inset + '" width="' + s + '" height="' + s + '" rx="' + rx + '" fill="none" stroke="' + c + '"' + (op ? ' stroke-opacity="' + op + '"' : '') + ' stroke-width="' + sw + '"/>';
  }
  // mirror a top-left corner ornament to all four corners
  function corners(inner) {
    return (
      '<g>' + inner + '</g>' +
      '<g transform="translate(100,0) scale(-1,1)">' + inner + '</g>' +
      '<g transform="translate(0,100) scale(1,-1)">' + inner + '</g>' +
      '<g transform="translate(100,100) scale(-1,-1)">' + inner + '</g>'
    );
  }
  // beads along all four inner edges
  function beadRing(c, pos, from, to, step, r) {
    var s = '', x;
    for (x = from; x <= to; x += step) {
      s += '<circle cx="' + x + '" cy="' + pos + '" r="' + r + '" fill="' + c + '"/>';
      s += '<circle cx="' + x + '" cy="' + (100 - pos) + '" r="' + r + '" fill="' + c + '"/>';
      s += '<circle cx="' + pos + '" cy="' + x + '" r="' + r + '" fill="' + c + '"/>';
      s += '<circle cx="' + (100 - pos) + '" cy="' + x + '" r="' + r + '" fill="' + c + '"/>';
    }
    return s;
  }

  var FRAMES = [
    // 1. Classic — molding + inner accent line (refined museum frame)
    { id: "classic", name: "클래식", build: function (c) {
      return band(c, 6, 11, 11) + line(c, 21, 1.4, 6, ".85") + line("#ffffff", 23, 0.8, 5, ".3");
    } },

    // 2. Double bead — molding with a ring of beads on the inner step
    { id: "bead", name: "비드", build: function (c) {
      return band(c, 5, 10, 10) + beadRing(c, 19.5, 19.5, 80.5, 8.1, 1.7) +
        '<g fill="#ffffff" fill-opacity=".5">' + beadRing("#ffffff", 19.5, 19.5, 80.5, 8.1, 0.6).replace(/fill="#ffffff"/g, '') + '</g>';
    } },

    // 3. Baroque — molding + scrolled acanthus flourishes at corners
    { id: "baroque", name: "바로크", build: function (c) {
      var orn =
        '<path d="M8 30 C8 18 18 8 30 8" fill="none" stroke="' + c + '" stroke-width="3.2" stroke-linecap="round"/>' +
        '<path d="M30 9 C24 14 22 20 25 25 C27 28 32 28 33 24 C34 21 31 19 29 21" fill="none" stroke="' + c + '" stroke-width="2.3" stroke-linecap="round"/>' +
        '<path d="M9 30 C14 24 20 22 25 25" fill="none" stroke="' + c + '" stroke-width="2.3" stroke-linecap="round"/>' +
        '<circle cx="27.5" cy="23.5" r="1.7" fill="' + c + '"/>';
      return band(c, 7, 7, 9) + line(c, 17, 1.2, 6, ".7") + corners(orn);
    } },

    // 4. Art Deco — stepped geometric corners + twin lines
    { id: "deco", name: "아르데코", build: function (c) {
      var orn =
        '<path d="M11 30 L11 19 L19 19 L19 11 L30 11" fill="none" stroke="#ffffff" stroke-width="3.4" stroke-opacity=".35" stroke-linejoin="miter"/>' +
        '<path d="M11 30 L11 19 L19 19 L19 11 L30 11" fill="none" stroke="' + c + '" stroke-width="2" stroke-linejoin="miter"/>' +
        '<circle cx="14" cy="14" r="2.4" fill="' + c + '"/>';
      return band(c, 6, 8, 4) + line(c, 18, 1.1, 2, ".5") + corners(orn);
    } },

    // 5. Rope — twisted cord border
    { id: "rope", name: "로프", build: function (c) {
      var seg = '', x; var p = 14;
      for (x = 14; x <= 86; x += 5) {
        seg += '<path d="M' + x + ' ' + (p - 3.4) + ' Q' + (x + 2.5) + ' ' + p + ' ' + (x) + ' ' + (p + 3.4) + '" fill="none" stroke="' + c + '" stroke-width="2.5" stroke-linecap="round"/>';
        seg += '<path d="M' + x + ' ' + (100 - p + 3.4) + ' Q' + (x + 2.5) + ' ' + (100 - p) + ' ' + x + ' ' + (100 - p - 3.4) + '" fill="none" stroke="' + c + '" stroke-width="2.5" stroke-linecap="round"/>';
        seg += '<path d="M' + (p - 3.4) + ' ' + x + ' Q' + p + ' ' + (x + 2.5) + ' ' + (p + 3.4) + ' ' + x + '" fill="none" stroke="' + c + '" stroke-width="2.5" stroke-linecap="round"/>';
        seg += '<path d="M' + (100 - p + 3.4) + ' ' + x + ' Q' + (100 - p) + ' ' + (x + 2.5) + ' ' + (100 - p - 3.4) + ' ' + x + '" fill="none" stroke="' + c + '" stroke-width="2.5" stroke-linecap="round"/>';
      }
      return line(c, 7, 2, 9, ".9") + seg;
    } },

    // 6. Gothic — pointed trefoil corner tracery
    { id: "gothic", name: "고딕", build: function (c) {
      var orn =
        '<path d="M7 28 L7 13 Q7 7 13 7 L28 7" fill="none" stroke="' + c + '" stroke-width="3" stroke-linecap="round"/>' +
        '<path d="M13 22 Q13 13 22 13" fill="none" stroke="' + c + '" stroke-width="2" stroke-opacity=".8"/>' +
        '<circle cx="11" cy="11" r="2.6" fill="none" stroke="' + c + '" stroke-width="1.8"/>' +
        '<path d="M9 24 q2 -3 4 0 q-2 2 -4 0 M24 9 q3 -2 0 4 q-2 -2 0 -4" fill="' + c + '"/>';
      return band(c, 7, 6, 4) + line(c, 16, 1.2, 3, ".7") + corners(orn);
    } },

    // 7. Botanical — leafy vine sprigs at corners
    { id: "botanical", name: "보태니컬", build: function (c) {
      var orn =
        '<path d="M9 31 C12 22 19 13 31 9" fill="none" stroke="' + c + '" stroke-width="2.2" stroke-linecap="round"/>' +
        '<path d="M16 19 q-5 -1 -7 -6 q6 0 7 6 Z" fill="' + c + '"/>' +
        '<path d="M19 16 q-1 -5 -6 -7 q0 6 6 7 Z" fill="' + c + '"/>' +
        '<path d="M24 12.5 q5 -2 9 0 q-4 3 -9 0 Z" fill="' + c + '" fill-opacity=".9"/>' +
        '<circle cx="11.5" cy="11.5" r="1.6" fill="' + c + '"/>';
      return band(c, 6.5, 6, 10) + line(c, 16, 1, 6, ".6") + corners(orn);
    } },

    // 8. Scallop — scalloped inner edge
    { id: "scallop", name: "스캘럽", build: function (c) {
      var s = '', x, r = 4.2, y = 18.5, step = r * 2;
      for (x = 16 + r; x <= 84; x += step) {
        s += '<path d="M' + (x - r) + ' ' + y + ' A' + r + ' ' + r + ' 0 0 1 ' + (x + r) + ' ' + y + '" fill="none" stroke="' + c + '" stroke-width="1.8"/>';
        s += '<path d="M' + (x - r) + ' ' + (100 - y) + ' A' + r + ' ' + r + ' 0 0 0 ' + (x + r) + ' ' + (100 - y) + '" fill="none" stroke="' + c + '" stroke-width="1.8"/>';
        s += '<path d="M' + y + ' ' + (x - r) + ' A' + r + ' ' + r + ' 0 0 0 ' + y + ' ' + (x + r) + '" fill="none" stroke="' + c + '" stroke-width="1.8"/>';
        s += '<path d="M' + (100 - y) + ' ' + (x - r) + ' A' + r + ' ' + r + ' 0 0 1 ' + (100 - y) + ' ' + (x + r) + '" fill="none" stroke="' + c + '" stroke-width="1.8"/>';
      }
      return band(c, 6, 9, 11) + s;
    } },

    // 9. Starlight — thin double frame with sparkle corners
    { id: "starlight", name: "스타라이트", build: function (c) {
      function star(cx, cy, R) {
        var pts = '', i, a, r;
        for (i = 0; i < 8; i++) { a = Math.PI / 2 + i * Math.PI / 4; r = i % 2 ? R * 0.4 : R; pts += (cx + r * Math.cos(a)).toFixed(1) + ',' + (cy - r * Math.sin(a)).toFixed(1) + ' '; }
        return '<polygon points="' + pts + '" fill="' + c + '"/>';
      }
      var orn = star(14, 14, 7.5) + '<circle cx="28" cy="11" r="1.5" fill="' + c + '"/><circle cx="11" cy="28" r="1.5" fill="' + c + '"/>';
      return band(c, 6, 6, 9) + line(c, 16, 1, 5, ".5") + corners(orn);
    } },

    // 10. Royal — thick molding, bead ring + fleur-de-lis corners (most ornate)
    { id: "royal", name: "로열", build: function (c) {
      var orn =
        '<path d="M13 25 L13 16 M13 16 C13 11 9 10 9.5 14 C10 11 13 12 13 16 C13 12 16 11 16.5 14 C17 10 13 11 13 16" fill="none" stroke="' + c + '" stroke-width="2.2" stroke-linecap="round"/>' +
        '<path d="M10 25 q3 -2 6 0" fill="none" stroke="' + c + '" stroke-width="2" stroke-linecap="round"/>' +
        '<circle cx="13" cy="11.5" r="1.5" fill="' + c + '"/>';
      return band(c, 5, 11, 12) + beadRing(c, 18.5, 22, 78, 9.3, 1.5) + corners(orn);
    } }
,

    // ── 추가 일반 프레임 15종 ──
    // 11N. Cushion — 두툼하고 둥근 쿠션 몰딩
    { id: "cushion", name: "쿠션 몰딩", build: function (c) {
      return band(c, 5, 13, 16) + line("#ffffff", 22, 1, 9, ".34") + line(c, 24, 1.2, 7, ".7");
    } },

    // 12N. Stepped — 2단 단차 몰딩
    { id: "stepped", name: "단 몰딩", build: function (c) {
      return band(c, 5, 7, 8) + band(c, 15, 5, 6) + line(c, 24, 1, 4, ".7");
    } },

    // 13N. Round bead — 굵은 라운드 비드 링
    { id: "roundbead", name: "라운드 비드", build: function (c) {
      return band(c, 6, 9, 9) + beadRing(c, 20.5, 20.5, 79.5, 9.9, 2.5) +
        '<g fill="#ffffff" fill-opacity=".45">' + beadRing("#ffffff", 19.4, 20.5, 79.5, 9.9, 0.9).replace(/fill="#ffffff"/g, '') + '</g>';
    } },

    // 14N. Corner rosette — 모서리 꽃 로제트 + 라인
    { id: "rosette", name: "코너 로제트", build: function (c) {
      var orn = '', i, a, R = 6.4, cx = 13, cy = 13;
      for (i = 0; i < 8; i++) { a = i / 8 * Math.PI * 2; orn += '<circle cx="' + (cx + Math.cos(a) * R).toFixed(2) + '" cy="' + (cy + Math.sin(a) * R).toFixed(2) + '" r="2" fill="' + c + '"/>'; }
      orn += '<circle cx="' + cx + '" cy="' + cy + '" r="2.6" fill="' + c + '"/>';
      return line(c, 9, 1.6, 7, ".9") + line(c, 14, 0.9, 5, ".5") + corners(orn);
    } },

    // 15N. Laurel — 모서리 월계 잎가지 + 라인
    { id: "laurel", name: "월계관", build: function (c) {
      var orn = '<path d="M8 26 C8 16 16 8 26 8" fill="none" stroke="' + c + '" stroke-width="1.5"/>';
      var L = [[9.5, 22.5, 248], [12.5, 18, 236], [16.5, 13, 222], [21, 9.5, 208]], i;
      for (i = 0; i < L.length; i++) {
        orn += '<ellipse cx="0" cy="0" rx="3.5" ry="1.7" fill="' + c + '" transform="translate(' + L[i][0] + ' ' + L[i][1] + ') rotate(' + L[i][2] + ')"/>';
        orn += '<ellipse cx="0" cy="0" rx="3.5" ry="1.7" fill="' + c + '" transform="translate(' + (L[i][0] + 3.3) + ' ' + (L[i][1] + 3.3) + ') rotate(' + (L[i][2] - 56) + ')"/>';
      }
      return line(c, 7, 1.3, 9, ".85") + corners(orn);
    } },

    // 16N. Sunray — 데코 모서리 햇살 + 몰딩
    { id: "sunray", name: "선레이", build: function (c) {
      var orn = '', i, a;
      for (i = 0; i < 5; i++) { a = i / 4 * (Math.PI / 2); orn += '<line x1="6.5" y1="6.5" x2="' + (6.5 + Math.cos(a) * 17).toFixed(2) + '" y2="' + (6.5 + Math.sin(a) * 17).toFixed(2) + '" stroke="' + c + '" stroke-width="1.5" stroke-linecap="round"/>'; }
      orn += '<circle cx="6.5" cy="6.5" r="2.4" fill="' + c + '"/>';
      return band(c, 5, 7, 5) + corners(orn);
    } },

    // 17N. Pearl drop — 펄 비드 변 + 모서리 진주 송이
    { id: "pearlDrop", name: "펄 드롭", build: function (c) {
      var orn = '<circle cx="11" cy="11" r="3" fill="' + c + '"/><circle cx="9.7" cy="9.7" r="1" fill="#ffffff" fill-opacity=".6"/>' +
        '<circle cx="18.5" cy="11" r="1.7" fill="' + c + '"/><circle cx="11" cy="18.5" r="1.7" fill="' + c + '"/>';
      return band(c, 6, 8, 9) + beadRing(c, 20, 32, 68, 7.2, 1.4) + corners(orn);
    } },

    // 18N. Cartouche — 모서리 스크롤 카르투슈 + 몰딩
    { id: "cartouche", name: "카르투슈", build: function (c) {
      var orn = '<path d="M7 24 C7 14 14 7 24 7" fill="none" stroke="' + c + '" stroke-width="2.4" stroke-linecap="round"/>' +
        '<path d="M11.5 21.5 C11.5 16 16 11.5 21.5 11.5" fill="none" stroke="' + c + '" stroke-width="1.3"/>' +
        '<path d="M24 7 c-3 1 -4 4 -2 6 c1.6 1.6 4 .4 3.2 -1.7" fill="none" stroke="' + c + '" stroke-width="1.6" stroke-linecap="round"/>' +
        '<path d="M7 24 c1 -3 4 -4 6 -2 c1.6 1.6 .4 4 -1.7 3.2" fill="none" stroke="' + c + '" stroke-width="1.6" stroke-linecap="round"/>';
      return band(c, 6, 6, 7) + corners(orn);
    } },

    // 19N. Ivy — 모서리 아이비 덩굴잎 + 라인
    { id: "ivy", name: "아이비", build: function (c) {
      var orn = '<path d="M8 27 C11 16 16 11 27 8" fill="none" stroke="' + c + '" stroke-width="1.4"/>';
      var P = [[11, 20], [16, 14.5], [21.5, 11]], i;
      for (i = 0; i < P.length; i++) {
        var x = P[i][0], y = P[i][1];
        orn += '<path d="M0 0 C-3.4 -1.6 -3.4 -5 0 -5.4 C3.4 -5 3.4 -1.6 0 0 Z" fill="' + c + '" transform="translate(' + x + ' ' + y + ') rotate(' + (i * 18 - 30) + ')"/>';
      }
      return line(c, 8, 1.3, 11, ".85") + corners(orn);
    } },

    // 20N. Nouveau — 아르누보 휘플래시 곡선 모서리 + 라인
    { id: "nouveau", name: "아르누보", build: function (c) {
      var orn = '<path d="M6 27 C6 14 14 6 27 6" fill="none" stroke="' + c + '" stroke-width="1.5"/>' +
        '<path d="M10 24 C10 22 12 15 19 12 C24 10 25 14 22 15 C20 15.6 19 14 20.5 12.8" fill="none" stroke="' + c + '" stroke-width="1.7" stroke-linecap="round"/>' +
        '<circle cx="21.5" cy="11.6" r="1.5" fill="' + c + '"/>';
      return line(c, 9, 1.2, 13, ".85") + corners(orn);
    } },

    // 21N. Medallion — 모서리 메달리온 + 몰딩
    { id: "medallion", name: "메달리온", build: function (c) {
      var orn = '<circle cx="13" cy="13" r="6.6" fill="none" stroke="' + c + '" stroke-width="1.5"/>' +
        '<circle cx="13" cy="13" r="3.4" fill="none" stroke="' + c + '" stroke-width="1.1"/>' +
        '<circle cx="13" cy="13" r="1.4" fill="' + c + '"/>';
      return band(c, 6, 7, 8) + corners(orn);
    } },

    // 22N. Corner block — 모서리 블록(코너 장식) + 몰딩
    { id: "cornerBlock", name: "코너 블록", build: function (c) {
      var orn = '<rect x="6" y="6" width="15" height="15" rx="3" fill="none" stroke="' + c + '" stroke-width="2"/>' +
        '<rect x="10.5" y="10.5" width="6" height="6" rx="1.4" fill="' + c + '"/>';
      return band(c, 6, 5, 4) + line(c, 24, 1, 4, ".7") + corners(orn);
    } },

    // 23N. Filigree — 모서리 더블 스크롤 필리그리 + 라인
    { id: "filigree", name: "필리그리", build: function (c) {
      var orn = '<path d="M7 22 C7 14 14 7 22 7" fill="none" stroke="' + c + '" stroke-width="1.3"/>' +
        '<path d="M9 20 c0 -5 4 -9 9 -9 c3 0 4 3 1.5 4 c-1.6 .7 -3 -1 -1.6 -2.2" fill="none" stroke="' + c + '" stroke-width="1.3" stroke-linecap="round"/>' +
        '<path d="M20 9 c5 0 9 4 9 9" fill="none" stroke="' + c + '" stroke-width="1.1" stroke-opacity=".7" transform="translate(0 0)"/>' +
        '<circle cx="18.6" cy="12.6" r="1.2" fill="' + c + '"/>';
      return line(c, 8, 1.2, 10, ".85") + line(c, 13, 0.8, 7, ".5") + corners(orn);
    } },

    // 24N. Bouquet — 모서리 작은 꽃다발 + 라인
    { id: "bouquet", name: "플로럴 부케", build: function (c) {
      var orn = '', i, a, R = 3.6, cx = 12, cy = 12;
      for (i = 0; i < 5; i++) { a = i / 5 * Math.PI * 2 - 1.2; orn += '<circle cx="' + (cx + Math.cos(a) * R).toFixed(2) + '" cy="' + (cy + Math.sin(a) * R).toFixed(2) + '" r="2.2" fill="' + c + '"/>'; }
      orn += '<circle cx="' + cx + '" cy="' + cy + '" r="1.7" fill="#ffffff" fill-opacity=".55"/>';
      orn += '<path d="M16 16 C20 18 22 22 23 26" fill="none" stroke="' + c + '" stroke-width="1.3" stroke-linecap="round"/>';
      orn += '<ellipse cx="0" cy="0" rx="3" ry="1.4" fill="' + c + '" transform="translate(20 20) rotate(40)"/>';
      return line(c, 8, 1.2, 11, ".8") + corners(orn);
    } },

    // 25N. Beveled — 넓은 베벨 골드 몰딩 + 안쪽 라인
    { id: "beveled", name: "베벨 몰딩", build: function (c) {
      return band(c, 4, 15, 12) + line("#ffffff", 13, 1.4, 6, ".3") + line("#000000", 19, 1.2, 4, ".22") + line(c, 22, 1.3, 4, ".85");
    } },

    // 11. Slim hairline — two ultra-thin concentric lines
    { id: "slim-hairline", name: "슬림 헤어라인", build: function (c) {
      return line(c, 7, 1.1, 12, "1") + line(c, 11, 0.7, 9, ".5");
    } },

    // 12. Slim corner bracket — thin L brackets at corners only
    { id: "slim-bracket", name: "슬림 코너 브래킷", build: function (c) {
      var orn = '<path d="M9 24 L9 11 Q9 9 11 9 L24 9" fill="none" stroke="' + c + '" stroke-width="1.7" stroke-linecap="round"/>';
      return corners(orn);
    } },

    // 13. Slim inset dot — inset line plus small corner dots
    { id: "slim-insetdot", name: "슬림 인셋 닷", build: function (c) {
      var orn = '<circle cx="12" cy="12" r="2" fill="' + c + '"/>';
      return line(c, 9, 1.2, 10, ".95") + corners(orn);
    } },

    // 14. Slim fine bead — sparse fine-bead ring
    { id: "slim-finebead", name: "슬림 파인 비드", build: function (c) {
      return line(c, 14, 0.9, 7, ".7") + beadRing(c, 9.5, 16, 84, 8.5, 1.1);
    } },

    // 15. Slim diamond corners — thin border with tiny diamonds
    { id: "slim-diamond", name: "슬림 다이아 코너", build: function (c) {
      var orn = '<polygon points="12,7.5 16.5,12 12,16.5 7.5,12" fill="' + c + '"/>';
      return line(c, 8, 1, 9, ".85") + corners(orn);
    } },

    // 16. Slim mini notch — thin border with cut corners
    { id: "slim-notch", name: "슬림 미니 노치", build: function (c) {
      var orn = '<path d="M8 17 L17 8" fill="none" stroke="' + c + '" stroke-width="1.6" stroke-linecap="round"/>' +
                '<circle cx="9" cy="9" r="1.4" fill="' + c + '"/>';
      return line(c, 10, 1.2, 4, ".9") + corners(orn);
    } },

    // 17. Slim sprig — delicate vines at corners
    { id: "slim-sprig", name: "슬림 덩굴", build: function (c) {
      var orn = '<path d="M10 27 C13 19 19 13 27 10" fill="none" stroke="' + c + '" stroke-width="1.3" stroke-linecap="round"/>' +
                '<path d="M16 18 q-4 -1 -5 -5 q5 0 5 5 Z" fill="' + c + '"/>' +
                '<path d="M19 15 q-1 -4 -5 -5 q0 5 5 5 Z" fill="' + c + '"/>';
      return line(c, 9, 0.9, 11, ".7") + corners(orn);
    } },

    // 18. Slim wave — a single slim scalloped wave
    { id: "slim-wave", name: "슬림 물결", build: function (c) {
      var s = '', x, r = 4, y = 12, step = r * 2;
      for (x = 14 + r; x <= 86; x += step) {
        s += '<path d="M' + (x - r) + ' ' + y + ' A' + r + ' ' + r + ' 0 0 1 ' + (x + r) + ' ' + y + '" fill="none" stroke="' + c + '" stroke-width="1.2"/>';
        s += '<path d="M' + (x - r) + ' ' + (100 - y) + ' A' + r + ' ' + r + ' 0 0 0 ' + (x + r) + ' ' + (100 - y) + '" fill="none" stroke="' + c + '" stroke-width="1.2"/>';
        s += '<path d="M' + y + ' ' + (x - r) + ' A' + r + ' ' + r + ' 0 0 0 ' + y + ' ' + (x + r) + '" fill="none" stroke="' + c + '" stroke-width="1.2"/>';
        s += '<path d="M' + (100 - y) + ' ' + (x - r) + ' A' + r + ' ' + r + ' 0 0 1 ' + (100 - y) + ' ' + (x + r) + '" fill="none" stroke="' + c + '" stroke-width="1.2"/>';
      }
      return s;
    } },

    // 19. Slim dashed — fine dashed frame
    { id: "slim-dashed", name: "슬림 점선", build: function (c) {
      return '<rect x="9" y="9" width="82" height="82" rx="10" fill="none" stroke="' + c + '" stroke-width="1.4" stroke-dasharray="3.2 3.2" stroke-linecap="round"/>' +
        line(c, 14, 0.7, 7, ".4");
    } },

    // 20. Slim sparkle — tiny star sparks at corners
    { id: "slim-sparkle", name: "슬림 스파클", build: function (c) {
      var orn = '<path d="M12 6 L13.1 10.9 L18 12 L13.1 13.1 L12 18 L10.9 13.1 L6 12 L10.9 10.9 Z" fill="' + c + '"/>' +
                '<circle cx="22" cy="9" r="0.9" fill="' + c + '"/><circle cx="9" cy="22" r="0.9" fill="' + c + '"/>';
      return line(c, 8, 0.9, 11, ".8") + corners(orn);
    } },

    // ── 추가 슬림 프레임 5종 ──
    // 21S. Slim arc — 모서리 사분원 아크 + 가는 라인
    { id: "slim-arc", name: "슬림 아크", build: function (c) {
      var orn = '<path d="M9 21 A12 12 0 0 1 21 9" fill="none" stroke="' + c + '" stroke-width="1.3" stroke-linecap="round"/>';
      return line(c, 13, 0.8, 6, ".55") + corners(orn);
    } },

    // 22S. Slim ring — 모서리 작은 링(빈 원) + 가는 라인
    { id: "slim-ring", name: "슬림 링", build: function (c) {
      var orn = '<circle cx="12" cy="12" r="3.2" fill="none" stroke="' + c + '" stroke-width="1.2"/>';
      return line(c, 9, 0.9, 10, ".8") + corners(orn);
    } },

    // 23S. Slim heart — 모서리 작은 하트 + 가는 라인
    { id: "slim-heart", name: "슬림 하트", build: function (c) {
      var orn = '<path d="M12 16 C7 12 8.5 8 11 9 C11.7 9.3 12 9.9 12 10.4 C12 9.9 12.3 9.3 13 9 C15.5 8 17 12 12 16 Z" fill="' + c + '"/>';
      return line(c, 9, 0.9, 11, ".8") + corners(orn);
    } },

    // 24S. Slim plus — 모서리 작은 플러스 + 가는 라인
    { id: "slim-plus", name: "슬림 플러스", build: function (c) {
      var orn = '<path d="M12 8 V16 M8 12 H16" fill="none" stroke="' + c + '" stroke-width="1.3" stroke-linecap="round"/>';
      return line(c, 10, 0.9, 8, ".75") + corners(orn);
    } },

    // 25S. Slim chevron — 모서리 작은 셰브론 + 가는 라인
    { id: "slim-chevron", name: "슬림 셰브론", build: function (c) {
      var orn = '<path d="M9 17 L9 9 L17 9" fill="none" stroke="' + c + '" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>' +
        '<path d="M13 20 L13 13 L20 13" fill="none" stroke="' + c + '" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round" stroke-opacity=".6"/>';
      return line(c, 14, 0.8, 6, ".5") + corners(orn);
    } },

  ];

  window.__luminkFrames = FRAMES;
})();
