/* 잉크 메모 — Service Worker
   업데이트를 배포할 때는 아래 CACHE 버전 숫자만 올리면
   기존 캐시가 정리되고 새 파일로 갱신됩니다. (예: v1 -> v2) */
const CACHE = "ink-memo-v8";

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

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((res) => {
          // 동일 출처 GET 응답을 런타임 캐시에 추가 (오프라인 대비)
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
