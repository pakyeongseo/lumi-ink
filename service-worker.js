/* 잉크 메모 — Service Worker
   업데이트를 배포할 때는 아래 CACHE 버전 숫자만 올리면
   기존 캐시가 정리되고 새 파일로 갱신됩니다. (예: v1 -> v2) */
const CACHE_PREFIX = "ink-memo-";
const CACHE = "ink-memo-v1.5-v66.8-appjs-divider-palette";

const ASSETS = [
  "./",
  "./index.html",
  "./Lumi_Ink_Manual_1.html",
  "./Lumi_Ink_v1.5_Release_Notes.md",
  "./Lumi_Ink_v66.8_Release_Notes.md",
  "./app.js",
  "./assets-icons.js",
  "./quickmenu-icon-library.js",
  "./assets-frames.js",
  "./log-templates.js",
  "./lumink-log-template-guide.md",
  "./lumink-log-templates-50.html",
  "./idea-board-design-guide.md",
  "./idea-board-template-registry-guide.md",
  "./idea-divider-template-guide.md",
  "./idea-board-templates.js",
  "./idea-board-custom-templates.css",
  "./html2canvas.min.js",
  "./idea-board-backgrounds/01-moonlit-crystal-castle.png",
  "./idea-board-backgrounds/02-firefly-forest.png",
  "./idea-board-backgrounds/03-butterfly-path.png",
  "./idea-board-backgrounds/04-coral-garden.png",
  "./idea-board-backgrounds/05-sunlit-underwater.png",
  "./idea-board-backgrounds/06-rose-bunny-room.png",
  "./idea-board-backgrounds/07-dreamy-bunny-room.png",
  "./idea-board-backgrounds/08-snowy-pine-forest.png",
  "./idea-board-backgrounds/09-moonlit-snow-woods.png",
  "./idea-board-backgrounds/10-golden-throne-hall.png",
  "./idea-board-backgrounds/11-crystal-flower-garden.png",
  "./idea-board-backgrounds/12-wonderland-rabbit-forest.png",
  "./idea-board-backgrounds/13-rose-bunny-window.png",
  "./idea-board-backgrounds/14-ruby-throne-room.png",
  "./idea-board-backgrounds/15-moonlit-study.png",
  "./idea-board-backgrounds/16-dawn-snow-castle.png",
  "./idea-board-backgrounds/17-cosmic-whale.png",
  "./idea-board-backgrounds/18-blue-hour-city.png",
  "./idea-board-backgrounds/19-cloud-castle.png",
  "./log-templates/lumi-aoharu-sky.json",
  "./log-templates/lumi-ashfall-signal.json",
  "./log-templates/lumi-brass-cog.json",
  "./log-templates/lumi-campus-note.json",
  "./log-templates/lumi-celestial-tablet.json",
  "./log-templates/lumi-cloudsea-jade.json",
  "./log-templates/lumi-derelict-whisper.json",
  "./log-templates/lumi-fae-spring.json",
  "./log-templates/lumi-ink-bamboo.json",
  "./log-templates/lumi-leaf-cabin.json",
  "./log-templates/lumi-mauve-dialog.json",
  "./log-templates/lumi-midnight-typewriter.json",
  "./log-templates/lumi-neon-terminal.json",
  "./log-templates/lumi-obsidian-sanctum.json",
  "./log-templates/lumi-pixel-console.json",
  "./log-templates/lumi-plain-mono.json",
  "./log-templates/lumi-pop-gag.json",
  "./log-templates/lumi-prism-heart.json",
  "./log-templates/lumi-quest-board.json",
  "./log-templates/lumi-rainfall-glass.json",
  "./log-templates/lumi-rewind-thread.json",
  "./log-templates/lumi-ribbon-candy.json",
  "./log-templates/lumi-rose-court.json",
  "./log-templates/lumi-royal-decree.json",
  "./log-templates/lumi-smoke-whiskey.json",
  "./log-templates/lumi-starship-hud.json",
  "./log-templates/lumi-vellum-scroll.json",
  "./log-templates/lumi-amethyst-luxe.json",
  "./log-templates/lumi-concerto-stage.json",
  "./log-templates/lumi-maple-autumn.json",
  "./log-templates/lumi-mono-contrast.json",
  "./log-templates/lumi-painter-canvas.json",
  "./log-templates/lumi-sakura-spring.json",
  "./log-templates/lumi-snowflake-winter.json",
  "./log-templates/lumi-storybook-gilt.json",
  "./log-templates/lumi-verdant-summer.json",
  "./log-templates/lumi-wedding-march.json",
  "./log-templates/lumi-bordeaux-vintage.json",
  "./log-templates/lumi-carrot-patch.json",
  "./log-templates/lumi-first-rose.json",
  "./log-templates/lumi-grandfather-clock.json",
  "./log-templates/lumi-harvest-moon.json",
  "./log-templates/lumi-holy-night.json",
  "./log-templates/lumi-old-library.json",
  "./log-templates/lumi-requiem-rest.json",
  "./log-templates/lumi-royal-crimson.json",
  "./log-templates/lumi-starry-night.json",
  "./tokenizer.js",
  "./manifest.json",
  "./manifest-ink.json",
  "./manifest-violet.json",
  "./manifest-rose.json",
  "./manifest-forest.json",
  "./manifest-gold.json",
  "./manifest-pastel-blue.json",
  "./manifest-pastel-pink.json",
  "./manifest-pastel-green.json",
  "./manifest-pastel-purple.json",
  "./manifest-pastel-yellow.json",
  "./lumi-ink-get-started.html",
  "./install-ink.html",
  "./install-violet.html",
  "./install-rose.html",
  "./install-forest.html",
  "./install-gold.html",
  "./install-pastel-blue.html",
  "./install-pastel-pink.html",
  "./install-pastel-green.html",
  "./install-pastel-purple.html",
  "./install-pastel-yellow.html",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-ink-192.png",
  "./icon-ink-512.png",
  "./icon-violet-192.png",
  "./icon-violet-512.png",
  "./icon-rose-192.png",
  "./icon-rose-512.png",
  "./icon-forest-192.png",
  "./icon-forest-512.png",
  "./icon-gold-192.png",
  "./icon-gold-512.png",
  "./icon-pastel-blue-192.png",
  "./icon-pastel-blue-512.png",
  "./icon-pastel-pink-192.png",
  "./icon-pastel-pink-512.png",
  "./icon-pastel-green-192.png",
  "./icon-pastel-green-512.png",
  "./icon-pastel-purple-192.png",
  "./icon-pastel-purple-512.png",
  "./icon-pastel-yellow-192.png",
  "./icon-pastel-yellow-512.png"
];

const REQUIRED_ASSETS = ["./", "./index.html", "./app.js", "./assets-icons.js", "./assets-frames.js", "./log-templates.js", "./tokenizer.js", "./manifest.json"];

// 설치: 핵심 파일 미리 캐싱
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(REQUIRED_ASSETS)
        .then(() => Promise.all(ASSETS.filter((asset) => !REQUIRED_ASSETS.includes(asset)).map((asset) => cache.add(asset).catch(() => null)))))
      .then(() => self.skipWaiting())
  );
});

// 활성화: 옛 버전 캐시 정리
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith(CACHE_PREFIX) && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// 요청: 캐시 우선, 없으면 네트워크, 둘 다 실패 시 앱 셸로 폴백
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  // 외부 도메인 요청은 건드리지 않음
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // 앱 코드(HTML/JS)는 네트워크 우선 — 항상 최신 버전을 받고, 오프라인일 때만 캐시로 폴백
  const isNavigation = req.mode === "navigate";
  const isAppCode = isNavigation || /\.(html|js)$/i.test(url.pathname);
  if (isAppCode) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.status === 200 && res.type === "basic") {
            const copy = res.clone();
            return caches.open(CACHE).then((c) => c.put(req, copy)).then(() => res);
          }
          return res;
        })
        .catch(() => caches.match(req).then((cached) => {
          if (cached) return cached;
          if (isNavigation) return caches.match("./index.html").then((shell) => shell || new Response("오프라인 상태입니다.", { status: 503 }));
          return new Response("오프라인 상태입니다.", { status: 503 });
        }))
    );
    return;
  }

  // 그 외 정적 리소스(아이콘·토크나이저 등)는 캐시 우선
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((res) => {
          if (res && res.status === 200 && res.type === "basic") {
            const copy = res.clone();
            return caches.open(CACHE).then((c) => c.put(req, copy)).then(() => res);
          }
          return res;
        })
        .catch(() => new Response("오프라인 상태입니다.", { status: 503 }));
    })
  );
});
