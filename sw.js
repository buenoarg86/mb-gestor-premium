// MB Gestor Luxury Pro V12.6.4 — Verified Assessment Save Hotfix • External Body Fat Preserved
const CACHE='mb-gestor-luxury-pro-v12-6-4-verified-assessment-save-hotfix';
const ASSETS=['./','./index.html','./styles.css?v=12.6.4','./app.js?v=12.6.4','./manifest.webmanifest','./assets/icon-192.png','./assets/icon-512.png','./assets/apple-touch-icon.png'];
// V12.6.4 • atualização segura: worker sem skipWaiting; a sessão ativa não é forçada a recarregar.
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS))));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  const core=event.request.mode==='navigate'||['/app.js','/styles.css','/index.html','/sw.js'].some(x=>url.pathname.endsWith(x));
  if(core){event.respondWith(fetch(event.request,{cache:'no-store'}).then(res=>{const copy=res.clone();caches.open(CACHE).then(c=>c.put(event.request,copy));return res}).catch(()=>caches.match(event.request).then(r=>r||caches.match('./index.html'))));return;}
  event.respondWith(caches.match(event.request).then(r=>r||fetch(event.request).then(res=>{const copy=res.clone();caches.open(CACHE).then(c=>c.put(event.request,copy));return res})));
});
