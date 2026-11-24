// Dieta Mamy — działa bez internetu. Zmień WERSJA przy każdej aktualizacji plików.
const WERSJA = 'dieta-v6';
const PLIKI = ['./', 'index.html', 'style.css', 'app.js', 'data/foods.js', 'data/recipes.js', 'manifest.webmanifest', 'icons/ikona.svg', 'icons/ikona-180.png', 'icons/ikona-192.png', 'icons/ikona-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(WERSJA).then(c => c.addAll(PLIKI)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== WERSJA).map(x => caches.delete(x)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin === location.origin) {
    // najpierw sieć (świeże przepisy), bez sieci — kopia
    e.respondWith(fetch(e.request).then(r => { const c = r.clone(); caches.open(WERSJA).then(x => x.put(e.request, c)); return r; }).catch(() => caches.match(e.request, { ignoreSearch: true })));
  } else if (url.hostname.endsWith('gstatic.com') || url.hostname.endsWith('googleapis.com')) {
    e.respondWith(caches.match(e.request).then(m => m || fetch(e.request).then(r => { const c = r.clone(); caches.open(WERSJA).then(x => x.put(e.request, c)); return r; })));
  }
});
