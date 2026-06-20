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
  ];

  window.__luminkFrames = FRAMES;
})();
