(function () {
  "use strict";

  window.__luminkLogTemplateFiles = [
    "lumi-aoharu-sky.json", "lumi-ashfall-signal.json", "lumi-brass-cog.json", "lumi-campus-note.json",
    "lumi-celestial-tablet.json", "lumi-cloudsea-jade.json", "lumi-derelict-whisper.json", "lumi-fae-spring.json",
    "lumi-ink-bamboo.json", "lumi-leaf-cabin.json", "lumi-mauve-dialog.json", "lumi-midnight-typewriter.json",
    "lumi-neon-terminal.json", "lumi-obsidian-sanctum.json", "lumi-pixel-console.json", "lumi-plain-mono.json",
    "lumi-pop-gag.json", "lumi-prism-heart.json", "lumi-quest-board.json", "lumi-rainfall-glass.json",
    "lumi-rewind-thread.json", "lumi-ribbon-candy.json", "lumi-rose-court.json", "lumi-royal-decree.json",
    "lumi-smoke-whiskey.json", "lumi-starship-hud.json", "lumi-vellum-scroll.json",
    "lumi-amethyst-luxe.json", "lumi-concerto-stage.json", "lumi-maple-autumn.json", "lumi-mono-contrast.json",
    "lumi-painter-canvas.json", "lumi-sakura-spring.json", "lumi-snowflake-winter.json", "lumi-storybook-gilt.json",
    "lumi-verdant-summer.json", "lumi-wedding-march.json",
    "lumi-bordeaux-vintage.json", "lumi-carrot-patch.json", "lumi-first-rose.json", "lumi-grandfather-clock.json",
    "lumi-harvest-moon.json", "lumi-holy-night.json", "lumi-old-library.json", "lumi-requiem-rest.json",
    "lumi-royal-crimson.json", "lumi-starry-night.json"
  ];

  window.__luminkLogBuiltins = [
    {
      kind: "lumink-log-template",
      schemaVersion: 1,
      id: "system-ink-frame",
      name: "잉크 프레임",
      description: "짙은 잉크색 바탕과 은은한 테두리의 기본 로그",
      author: "Lumi Ink",
      styles: {
        canvas: { "background": "linear-gradient(145deg,#101629,#171d34)", "color": "#e9edff", "border": "1px solid #3b4a78", "border-radius": "18px", "padding": "22px", "box-shadow": "0 16px 40px rgba(4,8,20,.28)", "font-family": "-apple-system,BlinkMacSystemFont,'Noto Sans KR',sans-serif", "line-height": "1.75", "max-width": "760px", "margin": "0 auto" },
        header: { "color": "#aebfff", "font-size": "13px", "font-weight": "800", "letter-spacing": ".12em", "border-bottom": "1px solid #34416a", "padding": "0 0 12px", "margin": "0 0 16px" },
        body: { "white-space": "pre-wrap", "overflow-wrap": "anywhere" },
        paragraph: { "margin": "0 0 11px" },
        empty: { "height": "10px" }
      },
      rules: [
        { id: "double-quote", label: "큰따옴표", pattern: "\"([^\"\\n]+)\"", flags: "g", capture: 0, stripDelimiters: false, style: { "color": "#ffd6ef", "background-color": "rgba(255,132,197,.10)", "border-radius": "6px", "padding": "1px 4px" } },
        { id: "single-quote", label: "작은따옴표", pattern: "'([^'\\n]+)'", flags: "g", capture: 0, stripDelimiters: false, style: { "color": "#aee8ff", "font-style": "italic" } },
        { id: "bracket", label: "대괄호", pattern: "\\[([^\\]\\n]+)\\]", flags: "g", capture: 0, stripDelimiters: false, style: { "color": "#ffd978", "font-weight": "700" } },
        { id: "bold", label: "마크다운 굵게", pattern: "\\*\\*([^*\\n]+)\\*\\*", flags: "g", capture: 1, stripDelimiters: true, style: { "color": "#ffffff", "font-weight": "800" } },
        { id: "italic", label: "마크다운 기울임", pattern: "\\*([^*\\n]+)\\*", flags: "g", capture: 1, stripDelimiters: true, style: { "color": "#c8d3ff", "font-style": "italic" } }
      ],
      persona: { maskText: "◆◆◆", style: { "color": "#111629", "background-color": "#9fb3ff", "border-radius": "999px", "padding": "1px 7px", "font-weight": "800", "letter-spacing": ".08em" } }
    },
    {
      kind: "lumink-log-template",
      schemaVersion: 1,
      id: "system-paper-note",
      name: "크림 기록지",
      description: "게시글에 편안하게 어울리는 밝은 기록지",
      author: "Lumi Ink",
      styles: {
        canvas: { "background-color": "#fffaf0", "color": "#3d372f", "border": "1px solid #dfd2bd", "border-radius": "14px", "padding": "24px", "box-shadow": "0 10px 28px rgba(92,70,35,.12)", "font-family": "Georgia,'Noto Serif KR',serif", "line-height": "1.82", "max-width": "760px", "margin": "0 auto" },
        header: { "color": "#8b6642", "font-size": "14px", "font-weight": "700", "border-bottom": "2px double #d8c4a5", "padding": "0 0 11px", "margin": "0 0 18px" },
        body: { "white-space": "pre-wrap", "overflow-wrap": "anywhere" },
        paragraph: { "margin": "0 0 12px" },
        empty: { "height": "10px" }
      },
      rules: [
        { id: "double-quote", label: "큰따옴표", pattern: "\"([^\"\\n]+)\"", flags: "g", capture: 0, stripDelimiters: false, style: { "color": "#8f3f51", "font-weight": "700" } },
        { id: "single-quote", label: "작은따옴표", pattern: "'([^'\\n]+)'", flags: "g", capture: 0, stripDelimiters: false, style: { "color": "#426a73", "font-style": "italic" } },
        { id: "bracket", label: "대괄호", pattern: "\\[([^\\]\\n]+)\\]", flags: "g", capture: 1, stripDelimiters: true, style: { "color": "#6d5136", "background-color": "#f1e5cf", "border": "1px solid #ddc9a7", "border-radius": "5px", "padding": "1px 6px" } },
        { id: "bold", label: "마크다운 굵게", pattern: "\\*\\*([^*\\n]+)\\*\\*", flags: "g", capture: 1, stripDelimiters: true, style: { "color": "#2e2923", "font-weight": "800" } },
        { id: "italic", label: "마크다운 기울임", pattern: "\\*([^*\\n]+)\\*", flags: "g", capture: 1, stripDelimiters: true, style: { "color": "#755f47", "font-style": "italic" } }
      ],
      persona: { maskText: "기록 불명", style: { "color": "#fffaf0", "background-color": "#765b3d", "border-radius": "4px", "padding": "1px 6px", "font-weight": "700" } }
    },
    {
      kind: "lumink-log-template",
      schemaVersion: 1,
      id: "system-clean-line",
      name: "클린 라인",
      description: "어떤 게시판에도 붙이기 쉬운 절제된 중립형 로그",
      author: "Lumi Ink",
      styles: {
        canvas: { "background-color": "#ffffff", "color": "#20242b", "border": "1px solid #d9dde5", "border-left": "5px solid #6979d7", "border-radius": "10px", "padding": "20px", "font-family": "-apple-system,BlinkMacSystemFont,'Noto Sans KR',sans-serif", "line-height": "1.72", "max-width": "760px", "margin": "0 auto" },
        header: { "color": "#5262bd", "font-size": "12px", "font-weight": "800", "letter-spacing": ".1em", "margin": "0 0 15px" },
        body: { "white-space": "pre-wrap", "overflow-wrap": "anywhere" },
        paragraph: { "margin": "0 0 10px" },
        empty: { "height": "8px" }
      },
      rules: [
        { id: "double-quote", label: "큰따옴표", pattern: "\"([^\"\\n]+)\"", flags: "g", capture: 1, stripDelimiters: true, style: { "color": "#b12f68", "font-weight": "700" } },
        { id: "single-quote", label: "작은따옴표", pattern: "'([^'\\n]+)'", flags: "g", capture: 1, stripDelimiters: true, style: { "color": "#276b81", "font-style": "italic" } },
        { id: "bracket", label: "대괄호", pattern: "\\[([^\\]\\n]+)\\]", flags: "g", capture: 0, stripDelimiters: false, style: { "color": "#6b56bd", "background-color": "#f0edff", "border-radius": "4px", "padding": "1px 4px" } },
        { id: "bold", label: "마크다운 굵게", pattern: "\\*\\*([^*\\n]+)\\*\\*", flags: "g", capture: 1, stripDelimiters: true, style: { "font-weight": "800", "text-decoration": "underline" } },
        { id: "italic", label: "마크다운 기울임", pattern: "\\*([^*\\n]+)\\*", flags: "g", capture: 1, stripDelimiters: true, style: { "color": "#59616f", "font-style": "italic" } }
      ],
      persona: { maskText: "•••", style: { "color": "#ffffff", "background-color": "#5967bd", "border-radius": "4px", "padding": "1px 6px", "font-weight": "800" } }
    }
  ];
})();
