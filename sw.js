// MB Gestor Luxury Pro V12.18.10 — Portal do Aluno • Autenticação Simplificada
const CACHE='mb-gestor-luxury-pro-v12-18-10-auth-clean';
const ASSETS=['./','./index.html','./styles.css?v=12.18.10','./app.js?v=12.18.10','./student-portal.html','./student-portal.js?v=12.18.10','./manifest.webmanifest','./assets/icon-192.png','./assets/icon-512.png','./assets/apple-touch-icon.png'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  // Segurança: nunca interceptar/cachear Auth ou API externa (tokens e snapshots).
  if(url.origin!==self.location.origin)return;
  const core=event.request.mode==='navigate'||['/app.js','/styles.css','/index.html','/student-portal.html','/student-portal.js','/sw.js'].some(x=>url.pathname.endsWith(x));
  if(core){event.respondWith(fetch(event.request,{cache:'no-store'}).then(res=>{const copy=res.clone();caches.open(CACHE).then(c=>c.put(event.request,copy));return res}).catch(()=>caches.match(event.request).then(r=>r||caches.match('./index.html'))));return;}
  event.respondWith(caches.match(event.request).then(r=>r||fetch(event.request).then(res=>{const copy=res.clone();caches.open(CACHE).then(c=>c.put(event.request,copy));return res})));
});
