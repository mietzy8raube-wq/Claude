/* Service Worker: macht den GF Tracker installierbar und lädt die App-Dateien
   auch bei schwacher Verbindung schnell. Daten (/api/…) werden NIE zwischengespeichert. */
const CACHE = "gft-shell-v1";
const ASSETS = ["/app.css", "/app.js", "/shared.js", "/favicon.svg", "/icons/icon-192.png", "/offline.html"];
self.addEventListener("install", (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())); });
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/") || url.pathname.startsWith("/portal")) return;
  if (e.request.mode === "navigate") {
    e.respondWith(fetch(e.request).catch(() => caches.match("/offline.html")));
    return;
  }
  // Netzwerk zuerst (damit Updates sofort ankommen), sonst aus dem Zwischenspeicher
  e.respondWith(fetch(e.request).then((res) => {
    if (res.ok && ASSETS.includes(url.pathname)) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
    return res;
  }).catch(() => caches.match(e.request)));
});
