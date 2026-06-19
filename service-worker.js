/* 잉크 메모 — Service Worker
   업데이트를 배포할 때는 아래 CACHE 버전 숫자만 올리면
   기존 캐시가 정리되고 새 파일로 갱신됩니다. (예: v1 -> v2) */
const CACHE = "ink-memo-v29";

const ASSETS = [
  "./",
  "./index.html",
  "./app.js",
  "./assets-icons.js",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./favicon.png"
];

// 설치: 핵심 파일 미리 캐싱
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

// 활성화: 옛 버전 캐시 정리
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
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
  const isAppCode = req.mode === "navigate" || /\.(html|js)$/i.test(url.pathname);
  if (isAppCode) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.status === 200 && res.type === "basic") {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match(req).then((c) => c || caches.match("./index.html")))
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
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match("./index.html"));
    })
  );
});
