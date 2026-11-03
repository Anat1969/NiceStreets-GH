// הדף תמיד מהרשת, כדי שכל פריסה תיראה מיד. בלי רשת: הגרסה האחרונה שנשמרה.
// נכסים קבועים (קוד, אייקונים, צילומי המסמך) מהמטמון. נתונים (/api) לעולם לא נשמרים כאן.
const CACHE = "nicestreets-v1";
const STATIC = /^\/(_next\/static\/|icon|examples\/|criteria\/|geo\/|logo-|street-placeholder)/;

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) =>
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  ),
);

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin || url.pathname.startsWith("/api/")) return;

  // מסכי הצוות אינם נשמרים במכשיר: מכשיר משותף לא יחזיר אותם בלי רשת.
  if (req.mode === "navigate" && !url.pathname.startsWith("/admin")) {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req)),
    );
    return;
  }

  if (!STATIC.test(url.pathname)) return;
  e.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        }),
    ),
  );
});
