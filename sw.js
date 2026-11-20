/* DC Soporte: trabajador mínimo para que la app se pueda instalar.
   Siempre pide primero a internet (así cada versión nueva llega sola);
   solo si no hay conexión usa la última copia guardada de la página.
   Nunca guarda nada del servidor (Supabase): solo archivos propios. */
const CACHE = 'dcsoporte-1.5.0';
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
self.addEventListener('push', e => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch (x) { d = { texto: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.titulo || 'DC Soporte', { body: d.texto || '', tag: d.etiqueta || undefined, icon: 'img/app/icono-192.png', badge: 'img/app/icono-192.png', data: { url: d.url || './' } }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => { for (const c of cs) { if ('focus' in c) return c.focus(); } return self.clients.openWindow(e.notification.data && e.notification.data.url || './'); }));
});
