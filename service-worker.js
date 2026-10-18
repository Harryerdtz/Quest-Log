const CACHE = "questlog-v12";
const ASSETS = [
  "/", "/index.html", "/manifest.json",
  "/css/styles.css",
  "/js/app.js", "/js/storage.js", "/js/audio.js", "/js/quest-manager.js",
  "/js/shop.js", "/js/raid.js", "/js/dungeon.js", "/js/map.js",
  "/js/items.js", "/js/inventory.js", "/js/classes.js", "/js/battle.js",
  "/icons/icon-192.png", "/icons/icon-512.png"
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  e.respondWith(
    caches.match(e.request).then((r) => r || fetch(e.request))
  );
});
