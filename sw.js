self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open("checkin-cache-v1").then((cache) =>
      cache.addAll(["./", "./index.html", "./styles.css", "./app.js", "./manifest.json"]),
    ),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => response || fetch(event.request)),
  );
});
