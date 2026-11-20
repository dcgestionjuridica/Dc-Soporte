/* DC Soporte · efectos de la pantalla de entrada (copia de la web de DC Gestión Jurídica):
   red de puntos que huye del dedo o del ratón, logo que se inclina en 3D, luz sobre el logo, chispas doradas y azules.
   efectosEntrada() los arranca y devuelve una función que los apaga al salir de la pantalla. */
'use strict';
function efectosEntrada() {
  const raiz = document.querySelector('.ent'); if (!raiz) return () => { };
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let vivo = true; const quitar = [];
  const on = (o, ev, f, op) => { o.addEventListener(ev, f, op); quitar.push(() => o.removeEventListener(ev, f, op)); };

  /* red de puntos */
  const c = document.getElementById('red'), x = c.getContext('2d'), d = Math.min(2, devicePixelRatio || 1), m = { x: -9999, y: -9999 };
  let W, H, P = [], last = 0;
  function tam() {
    W = raiz.clientWidth; H = Math.max(innerHeight, raiz.offsetHeight);
    c.width = W * d; c.height = H * d; c.style.height = H + 'px'; x.setTransform(d, 0, 0, d, 0, 0);
    const n = Math.max(20, Math.min(90, Math.round(W * H / 16000))); P = [];
    for (let i = 0; i < n; i++) P.push({ x: Math.random() * W, y: Math.random() * H, vx: (Math.random() - .5) * .35, vy: (Math.random() - .5) * .35, r: Math.random() * 1.5 + .5 });
  }
  function cuadro(t) {
    if (!vivo) return;
    const k = last ? Math.min(3, (t - last) / 16.7) : 1; last = t; x.clearRect(0, 0, W, H);
    for (let i = 0; i < P.length; i++) {
      const p = P[i]; p.x += p.vx * k; p.y += p.vy * k;
      if (p.x < 0 || p.x > W) p.vx *= -1; if (p.y < 0 || p.y > H) p.vy *= -1;
      const dx = p.x - m.x, dy = p.y - m.y, dm = Math.hypot(dx, dy);
      if (dm < 110 && dm > 0) { p.x += dx / dm * 1.4 * k; p.y += dy / dm * 1.4 * k; }
      for (let j = i + 1; j < P.length; j++) {
        const q = P[j], dd = Math.hypot(p.x - q.x, p.y - q.y);
        if (dd < 120) { x.strokeStyle = 'rgba(126,170,255,' + (.16 * (1 - dd / 120)) + ')'; x.lineWidth = 1; x.beginPath(); x.moveTo(p.x, p.y); x.lineTo(q.x, q.y); x.stroke(); }
      }
      if (dm < 180) { x.strokeStyle = 'rgba(160,195,255,' + (.45 * (1 - dm / 180)) + ')'; x.beginPath(); x.moveTo(p.x, p.y); x.lineTo(m.x, m.y); x.stroke(); }
      x.fillStyle = 'rgba(170,200,255,.7)'; x.beginPath(); x.arc(p.x, p.y, p.r, 0, 7); x.fill();
    }
    requestAnimationFrame(cuadro);
  }
  on(window, 'resize', tam);
  on(window, 'pointermove', e => { m.x = e.clientX; m.y = e.clientY + scrollY; });
  on(document, 'pointerleave', () => { m.x = m.y = -9999; });
  tam(); requestAnimationFrame(cuadro);

  /* logo 3D, luz y chispas */
  const L = document.getElementById('logo3d'), M = document.getElementById('marcaIn'), capas = M.querySelectorAll('.capa'), luz = L.querySelector('.luz-logo');
  const cv = document.getElementById('chispas'), g = cv.getContext('2d'), Ch = [];
  const obj = { x: 0, y: 0 }, act = { x: 0, y: 0 }; let cerca = false, f = .45, ult = { x: 0, y: 0 };
  function tc() { cv.width = innerWidth * d; cv.height = innerHeight * d; g.setTransform(d, 0, 0, d, 0, 0); }
  tc(); on(window, 'resize', tc);
  on(window, 'pointermove', e => {
    const r = L.getBoundingClientRect(), mx = r.left + r.width / 2, my = r.top + r.height / 2;
    obj.x = Math.max(-1, Math.min(1, (e.clientX - mx) / (innerWidth / 2))); obj.y = Math.max(-1, Math.min(1, (e.clientY - my) / (innerHeight / 2)));
    const mr = M.getBoundingClientRect();
    const dentro = e.clientX > mr.left - 40 && e.clientX < mr.right + 40 && e.clientY > mr.top - 40 && e.clientY < mr.bottom + 40;
    if (dentro !== cerca) { cerca = dentro; L.classList.toggle('cerca', cerca); }
    luz.style.setProperty('--lx', (e.clientX - r.left) + 'px'); luz.style.setProperty('--ly', (e.clientY - r.top) + 'px');
    if (cerca && !reduce) {
      const v = Math.hypot(e.clientX - ult.x, e.clientY - ult.y);
      for (let i = 0; i < Math.min(4, 1 + v / 12); i++) Ch.push({ x: e.clientX, y: e.clientY, vx: (Math.random() - .5) * 1.6, vy: (Math.random() - .5) * 1.6 - .6, v: 1, r: Math.random() * 1.8 + .6, o: Math.random() < .55 });
    }
    ult = { x: e.clientX, y: e.clientY };
  });
  on(document, 'pointerleave', () => { obj.x = obj.y = 0; cerca = false; L.classList.remove('cerca'); });
  const tactil = !matchMedia('(hover: hover)').matches;
  function paso(t) {
    if (!vivo) return;
    if (tactil) { obj.x = Math.sin(t / 2600) * .35; obj.y = Math.cos(t / 3100) * .25; }
    act.x += (obj.x - act.x) * .08; act.y += (obj.y - act.y) * .08; f += ((cerca ? 1 : .45) - f) * .08;
    M.style.transform = 'rotateY(' + (act.x * 12 * f) + 'deg) rotateX(' + (-act.y * 10 * f) + 'deg)';
    for (let i = 0; i < capas.length; i++) { const p = parseFloat(capas[i].dataset.p); capas[i].style.translate = (act.x * p * 24 * f) + 'px ' + (act.y * p * 18 * f) + 'px'; }
    g.clearRect(0, 0, innerWidth, innerHeight);
    for (let i = Ch.length - 1; i >= 0; i--) {
      const s = Ch[i]; s.x += s.vx; s.y += s.vy; s.vy += .025; s.v -= .018; if (s.v <= 0) { Ch.splice(i, 1); continue; }
      g.globalAlpha = s.v * .28; g.fillStyle = s.o ? '#f3c659' : '#7fb0ff'; g.beginPath(); g.arc(s.x, s.y, s.r * 3.2, 0, 7); g.fill();
      g.globalAlpha = s.v; g.fillStyle = s.o ? '#f6d68c' : '#cfe2ff'; g.beginPath(); g.arc(s.x, s.y, s.r, 0, 7); g.fill();
    }
    g.globalAlpha = 1; requestAnimationFrame(paso);
  }
  if (!reduce) requestAnimationFrame(paso);
  on(L, 'click', () => {
    const b = L.querySelector('.barrido'); b.style.animation = 'none'; void b.offsetWidth; b.style.animation = 'entBarre 1.4s ease-in-out 1';
    const tn = M.querySelector('.tinta'); tn.classList.remove('brilla'); void tn.offsetWidth; tn.classList.add('brilla');
  });

  return () => { vivo = false; quitar.forEach(q => q()); };
}
