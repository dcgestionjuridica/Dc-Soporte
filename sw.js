/* DC Soporte: trabajador mínimo para que la app se pueda instalar.
   Siempre pide primero a internet (así cada versión nueva llega sola);
   solo si no hay conexión usa la última copia guardada de la página.
   Nunca guarda nada del servidor (Supabase): solo archivos propios. */
const CACHE = 'dcsoporte-1.4.2';
self.addEventListener('install', e => { self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET' || new URL(r.url).origin !== self.location.origin) return;
  e.respondWith(fetch(r).then(res => {
    if (res.ok) { const c = res.clone(); caches.open(CACHE).then(ca => ca.put(r, c)); }
    return res;
  }).catch(() => caches.match(r).then(m => m || caches.match('./'))));
});
