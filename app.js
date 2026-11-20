/* DC Soporte · centro de control de la plataforma DC Gestión Jurídica
   Solo la cuenta de plataforma puede ver datos: cada consulta la verifica el servidor. */
'use strict';
const VERSION = '1.4.1';
const SB = 'https://okvxxppudwbcldxpxyfw.supabase.co';
const LLAVE = 'sb_publishable_oDR8SiWeo1owprP7to2azQ_S30AT_8Y';
const CLAVE_SESION = 'dcsoporte-sesion';
const INACTIVIDAD_MIN = 15;
const ZONA = 'America/Bogota';

const $app = document.getElementById('app');
const E = { vista: 'inicio', filtro: 'todos', busca: '', det: null, detTab: 'resumen', tablero: null, despachos: null, detalle: null, perfil: null, ventas: null, periodo: 'mes', verTodosMov: false, soporte: null, modo: null, vivo: null, todasAcc: false, sopTab: 'buzon', buzTab: 'abiertos', buzon: null, caso: null, casoId: null };

/* ---------- utilidades ---------- */
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function ic(nombre, peso = 'regular', tam = 20) {
  const k = ICONOS[nombre + ':' + peso] || ICONOS[nombre + ':regular'] || '';
  return `<svg class="ico" width="${tam}" height="${tam}" viewBox="0 0 256 256" aria-hidden="true">${k}</svg>`;
}
const pesos = n => '$' + Math.round(Number(n) || 0).toLocaleString('es-CO');
const corto = n => { n = Number(n) || 0; if (n >= 1e6) return (n / 1e6).toLocaleString('es-CO', { maximumFractionDigits: 1 }) + 'M'; if (n >= 1e3) return Math.round(n / 1e3) + 'K'; return String(n); };
const fecha = (f, o) => f ? new Date(f).toLocaleDateString('es-CO', Object.assign({ timeZone: ZONA, day: '2-digit', month: '2-digit', year: 'numeric' }, o || {})) : '—';
const hora = f => f ? new Date(f).toLocaleTimeString('es-CO', { timeZone: ZONA, hour: 'numeric', minute: '2-digit' }) : '';
function hace(f) {
  if (!f) return 'Nunca';
  const m = Math.round((Date.now() - new Date(f).getTime()) / 60000);
  if (m < -60) { const d = Math.ceil(-m / 1440); return d <= 1 ? 'Mañana' : `En ${d} días`; }
  if (m < 1) return 'Ahora'; if (m < 60) return `Hace ${m} min`;
  const h = Math.round(m / 60); if (h < 24) return `Hace ${h} h`;
  const d = Math.round(h / 24); if (d === 1) return 'Ayer'; if (d < 30) return `Hace ${d} días`;
  return fecha(f);
}
const duracion = min => { min = Math.round(min || 0); const h = Math.floor(min / 60), m = min % 60; return h ? `${h} h ${m ? m + ' min' : ''}`.trim() : `${m} min`; };
const iniciales = n => String(n || '?').replace(/[^\p{L}\s]/gu, ' ').trim().split(/\s+/).filter(w => w.length > 2 || /^[A-ZÁÉÍÓÚÑ]/.test(w)).slice(0, 2).map(w => w[0].toUpperCase()).join('') || '?';
function toast(t) { const d = document.createElement('div'); d.className = 'toast'; d.textContent = t; document.body.appendChild(d); setTimeout(() => d.remove(), 2600); }
const TIPO = { pago: ['Pago', 'e-pago'], prueba: ['Prueba', 'e-prueba'], invitado: ['Invitado', 'e-invitado'] };
function salud(n) { let s = ''; const c = n >= 4 ? 'g' : n === 3 ? 'y' : 'r'; for (let i = 1; i <= 5; i++) s += `<s class="${i <= n ? c : ''}"></s>`; return `<span class="salud" title="Salud ${n} de 5">${s}</span>`; }

/* ---------- sesión (se borra al cerrar el navegador) ---------- */
function leerSesion() { try { return JSON.parse(sessionStorage.getItem(CLAVE_SESION)); } catch (e) { return null; } }
function guardarSesion(s) { try { sessionStorage.setItem(CLAVE_SESION, JSON.stringify(s)); } catch (e) { } }
function borrarSesion() { try { sessionStorage.removeItem(CLAVE_SESION); } catch (e) { } }
async function auth(tipo, cuerpo) {
  const r = await fetch(`${SB}/auth/v1/token?grant_type=${tipo}`, { method: 'POST', headers: { apikey: LLAVE, 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error_description || j.msg || 'No se pudo entrar');
  const s = { t: j.access_token, r: j.refresh_token, exp: Date.now() + (j.expires_in - 60) * 1000, correo: j.user && j.user.email };
  guardarSesion(s); return s;
}
async function token() {
  let s = leerSesion(); if (!s) throw new Error('SIN_SESION');
  if (Date.now() > s.exp) { try { s = await auth('refresh_token', { refresh_token: s.r }); } catch (e) { borrarSesion(); throw new Error('SIN_SESION'); } }
  return s.t;
}
async function rpc(fn, datos = {}) {
  const t = await token();
  const r = await fetch(`${SB}/rest/v1/rpc/${fn}`, { method: 'POST', headers: { apikey: LLAVE, Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' }, body: JSON.stringify({ datos }) });
  const j = await r.json().catch(() => null);
  if (!r.ok) {
    const msg = (j && (j.message || j.hint)) || 'Error del servidor';
    if (r.status === 401 || /DC403|solo de la plataforma|JWT/i.test(msg)) { borrarSesion(); throw new Error('NO_PLATAFORMA'); }
    throw new Error(msg);
  }
  return j;
}
async function salir(motivo) {
  const s = leerSesion();
  if (s) fetch(`${SB}/auth/v1/logout`, { method: 'POST', headers: { apikey: LLAVE, Authorization: 'Bearer ' + s.t } }).catch(() => { });
  borrarSesion(); Object.assign(E, { tablero: null, despachos: null, detalle: null, det: null, ventas: null, vista: 'inicio' });
  pintarEntrada(motivo);
}
let reloj = null;
function vigilarInactividad() {
  const reiniciar = () => { clearTimeout(reloj); reloj = setTimeout(() => salir('Se cerró la sesión por 15 minutos sin uso.'), INACTIVIDAD_MIN * 60000); };
  ['pointerdown', 'keydown', 'scroll', 'touchstart'].forEach(ev => addEventListener(ev, reiniciar, { passive: true }));
  reiniciar();
}

/* ---------- entrada (copia de la entrada de la web de DC Gestión Jurídica) ---------- */
let apagarEntrada = null;
function pintarEntrada(aviso) {
  if (apagarEntrada) apagarEntrada();
  $app.classList.add('modo-ent');
  const sv = (vb, cuerpo, extra) => `<svg viewBox="${vb}" fill="none" ${extra || ''}>${cuerpo}</svg>`;
  const mv = (icono, t) => `<div class="mv">${ic(icono, 'dt', 46)}${t}</div>`;
  $app.innerHTML = `<main class="ent">
  <div class="cielo"></div><canvas id="red" aria-hidden="true"></canvas><canvas id="chispas" aria-hidden="true"></canvas>
  <section class="ent-marca"><div class="marca-in" id="marcaIn">
    <div class="escenario" id="logo3d" role="img" aria-label="DC Soporte">
      <div class="ent-logo capa" data-p="-.5"><div class="fondo-logo"></div><div class="luz-logo"></div><div class="barrido"></div></div>
      <svg class="filo" viewBox="0 0 228 200" aria-hidden="true"><defs><linearGradient id="gfilo" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#cfe2ff"/><stop offset=".35" stop-color="#4f86ea"/><stop offset=".7" stop-color="#173a86"/><stop offset="1" stop-color="#8fb6ff"/></linearGradient></defs><rect x="1.5" y="1.5" width="225" height="197" rx="29" pathLength="1000"/></svg>
      <div class="letra capa" data-p="1.15" id="letraD"></div><div class="letra capa" data-p="1.15" id="letraC"></div>
    </div>
    <div class="nombre capa" data-p=".5"><span class="tinta">DC Soporte<sup>®</sup></span></div>
    <div class="linea-oro capa" data-p=".4"></div>
    <div class="lema capa" data-p=".3">Centro de control y soporte</div>
    <div class="frase capa" data-p=".2"><span class="ent-barra"></span><p>Control, soporte y crecimiento<br>de toda la plataforma.</p></div>
    <div class="modulos capa" data-p=".12">${mv('buildings', 'Despachos')}${mv('chart-line-up', 'Ventas')}${mv('headset', 'Soporte')}</div>
  </div></section>
  <section class="tarjeta">
    <div class="avatar">${sv('0 0 24 24', '<circle cx="12" cy="8" r="4.2"/><path d="M4 20.5c0-4.2 3.6-6.8 8-6.8s8 2.6 8 6.8z" stroke-linejoin="round"/>', 'stroke="#fff" stroke-width="1.8"')}</div>
    <h1>Iniciar Sesión</h1>
    <div class="sub">Acceda a su centro de control y soporte</div>
    <div class="subraya"></div>
    <label class="campo">${sv('0 0 24 24', '<rect x="2.5" y="5" width="19" height="14" rx="1.5"/><path d="M3 6l9 7 9-7"/>', 'stroke="#1b2438" stroke-width="1.8"')}
      <input id="correo" type="email" autocomplete="username" placeholder="Correo electrónico"></label>
    <label class="campo">${sv('0 0 24 24', '<rect x="4" y="10.5" width="16" height="11" rx="1.5"/><path d="M7.5 10.5V7.5a4.5 4.5 0 0 1 9 0v3"/><circle cx="12" cy="15" r="1.4" fill="#1b2438"/><path d="M12 16v2.5"/>', 'stroke="#1b2438" stroke-width="1.8"')}
      <input id="clave" type="password" autocomplete="current-password" placeholder="Contraseña">
      <button type="button" class="ojo" id="ver" aria-label="Mostrar contraseña"></button></label>
    <div id="msg">${aviso ? `<div class="msg mal">${esc(aviso)}</div>` : ''}</div>
    <div class="olvido"><button type="button" id="olvido">¿Olvidó su contraseña?</button></div>
    <button class="btn-ent" id="entrar">${sv('0 0 40 36', '<path d="M22 4h10a4 4 0 0 1 4 4v20a4 4 0 0 1-4 4H22"/><path d="M4 18h21M17 10l8 8-8 8"/>', 'stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"')}<span>Ingresar</span></button>
    <div class="sellos">
      <div class="sello">${sv('0 0 24 24', '<path d="M12 2.5l8 3v6c0 5-3.4 8.6-8 10-4.6-1.4-8-5-8-10v-6z"/><path d="M8.3 12l2.6 2.6 4.9-5"/>', 'stroke="#141d33" stroke-width="1.6" stroke-linejoin="round"')}Datos seguros</div>
      <div class="sello">${sv('0 0 24 24', '<rect x="4" y="10.5" width="16" height="11" rx="1.5"/><path d="M7.5 10.5V7.5a4.5 4.5 0 0 1 9 0v3"/><path d="M12 14.5v3"/>', 'stroke="#141d33" stroke-width="1.6" stroke-linejoin="round"')}Acceso exclusivo</div>
      <div class="sello">${sv('0 0 24 24', '<path d="M12 3l10 5-10 5L2 8z"/><path d="M2 12l10 5 10-5M2 16l10 5 10-5"/>', 'stroke="#141d33" stroke-width="1.6" stroke-linejoin="round"')}Registro de auditoría</div>
    </div>
  </section>
  <div class="version">DC Soporte · Versión ${VERSION}</div>
</main>`;
  const ojo = (abierto) => sv('0 0 24 24', abierto
    ? '<path d="M1.5 12S5.5 5 12 5s10.5 7 10.5 7-4 7-10.5 7S1.5 12 1.5 12z"/><circle cx="12" cy="12" r="3.3"/>'
    : '<path d="M1.5 12S5.5 5 12 5s10.5 7 10.5 7-4 7-10.5 7S1.5 12 1.5 12z"/><circle cx="12" cy="12" r="3.3"/><path d="M3 3l18 18"/>', 'stroke="#1b2438" stroke-width="1.9"');
  const c = document.getElementById('correo'), k = document.getElementById('clave'), b = document.getElementById('entrar'), v = document.getElementById('ver'), msg = document.getElementById('msg');
  const decir = (t, bien) => { msg.innerHTML = t ? `<div class="msg ${bien ? 'bien' : 'mal'}">${esc(t)}</div>` : ''; };
  v.innerHTML = ojo(true);
  v.onclick = () => { const ver = k.type === 'password'; k.type = ver ? 'text' : 'password'; v.innerHTML = ojo(!ver); v.setAttribute('aria-label', ver ? 'Ocultar contraseña' : 'Mostrar contraseña'); };
  const ir = async () => {
    if (!c.value.trim() || !k.value) return decir('Escriba su correo y su contraseña.');
    b.disabled = true; b.querySelector('span').textContent = 'Un momento…'; decir('');
    try { await auth('password', { email: c.value.trim(), password: k.value }); if (apagarEntrada) { apagarEntrada(); apagarEntrada = null; } await iniciar(); }
    catch (e) {
      b.disabled = false; b.querySelector('span').textContent = 'Ingresar';
      decir(e.message === 'NO_PLATAFORMA' ? 'Esta cuenta no es la de la plataforma. Solo el dueño puede entrar.' : 'Correo o contraseña incorrectos.');
    }
  };
  document.getElementById('olvido').onclick = async () => {
    const correo = c.value.trim();
    if (!correo) { decir('Escriba su correo arriba y vuelva a tocar «¿Olvidó su contraseña?».'); c.focus(); return; }
    try {
      const r = await fetch(`${SB}/auth/v1/recover`, { method: 'POST', headers: { apikey: LLAVE, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: correo }) });
      if (!r.ok) throw new Error();
      decir('Le enviamos al correo un enlace para crear una contraseña nueva.', true);
    } catch (e) { decir('No se pudo enviar el enlace. Intente de nuevo en un momento.'); }
  };
  b.onclick = ir; [c, k].forEach(i => i.onkeydown = e => { if (e.key === 'Enter') ir(); });
  apagarEntrada = efectosEntrada();
}

/* ---------- armazón ---------- */
function nav() {
  const it = (v, icono, t) => `<button class="it ${E.vista === v ? 'on' : ''}" data-ir="${v}">${ic(icono, E.vista === v ? 'fill' : 'regular', 25)}${t}</button>`;
  const on = E.vista === 'inicio';
  return `<nav class="nav"><div class="base">${it('despachos', 'buildings', 'Despachos')}${it('ventas', 'chart-line-up', 'Ventas')}<div class="hueco"></div>${it('soporte', 'lifebuoy', 'Soporte')}${it('ajustes', 'gear-six', 'Ajustes')}</div>
    <button class="centro ${on ? 'on' : ''}" data-ir="inicio" aria-label="Inicio">${ic('house', on ? 'fill' : 'bold', 32)}</button><span class="lab ${on ? 'on' : ''}">Inicio</span></nav>`;
}
function pintar(html) {
  if (apagarEntrada) { apagarEntrada(); apagarEntrada = null; }
  $app.classList.remove('modo-ent');
  $app.innerHTML = html + nav();
  $app.querySelectorAll('[data-ir]').forEach(b => b.onclick = () => ir(b.dataset.ir));
  $app.querySelectorAll('[data-desp]').forEach(b => b.onclick = () => abrirDespacho(Number(b.dataset.desp)));
  $app.querySelectorAll('[data-pronto]').forEach(b => b.onclick = () => toast(b.dataset.pronto));
  $app.querySelectorAll('[data-chat]').forEach(b => b.onclick = () => abrirChatDespacho(Number(b.dataset.chat)));
  $app.querySelectorAll('[data-modo]').forEach(b => b.onclick = () => { pararVivo(); E.vista = 'soporte'; E.det = null; E.casoId = null; E.modo = Number(b.dataset.modo); E.vivo = null; scrollTo(0, 0); render(); });
  const ct = document.getElementById('cambiar-tema');
  if (ct) ct.onclick = () => {
    const nuevo = document.documentElement.getAttribute('data-tema') === 'claro' ? 'oscuro' : 'claro';
    try { localStorage.setItem('dcsoporte-tema', nuevo); } catch (e) { }
    document.documentElement.setAttribute('data-tema', nuevo); render();
  };
}
function ir(v) { if (v === 'soporte') { E.modo = null; E.soporte = null; E.casoId = null; E.buzon = null; } pararVivo(); E.vista = v; if (v !== 'despachos') E.det = null; scrollTo(0, 0); render(); }
function render() {
  try {
    if (E.vista === 'inicio') return vistaInicio();
    if (E.vista === 'despachos') return vistaDespachos();
    if (E.vista === 'ajustes') return vistaAjustes();
    if (E.vista === 'ventas') return vistaVentas();
    if (E.vista === 'soporte') return E.casoId ? vistaCaso() : E.modo ? vistaModo() : vistaSoporte();
    return vistaPronto(E.vista);
  } catch (e) { console.error(e); pintar(`<div class="cuerpo"><div class="aviso">${ic('warning-circle')}<div>Algo falló al mostrar esta pantalla. Toque Inicio para volver.</div></div></div>`); }
}
async function cargar(clave, fn, datos) {
  try { E[clave] = await fn(datos); return true; }
  catch (e) { if (e.message === 'SIN_SESION') { salir(); return false; } if (e.message === 'NO_PLATAFORMA') { salir('Esta cuenta no es la de la plataforma.'); return false; } toast('No se pudo cargar: ' + e.message); return false; }
}

/* ---------- Inicio ---------- */
const ATN = { asistencia: ['siren', '#b91c1c'], vence: ['hourglass-medium', '#8a5a00'], error: ['bug-beetle', '#b91c1c'], venta: ['credit-card', '#15803d'] };
function vistaInicio() {
  const T = E.tablero;
  const hoy = new Date().toLocaleDateString('es-CO', { timeZone: ZONA, weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });
  const cab = `<header class="cab"><div class="logo">DC</div><div class="marca"><b>DC Soporte<sup>®</sup></b><span>Centro de control</span></div>
    <div class="hola"><small>Bienvenido,</small><h2>Darío Carvajal</h2><div class="rol">${ic('shield-check', 'fill', 15).replace('class="ico"', 'class="ico" style="color:#e7b94a"')}Dueño de la plataforma</div>
    <div class="fecha">${ic('calendar-blank', 'regular', 17)}${esc(hoy.charAt(0).toUpperCase() + hoy.slice(1))}</div></div>
    <div class="der"><button class="btn-ico" id="cambiar-tema" aria-label="Cambiar modo claro u oscuro">${ic(document.documentElement.getAttribute('data-tema') === 'claro' ? 'moon' : 'sun', 'regular', 26)}</button>
    <button class="btn-ico" data-pronto="Las alertas al celular llegan en la etapa 6." aria-label="Avisos">${ic('bell', 'regular', 26)}${T && T.atencion.length ? '<i></i>' : ''}</button>
    <button class="btn-ico" data-ir="ajustes" aria-label="Mi cuenta">${ic('user-circle', 'regular', 28)}</button></div></header>`;
  if (!T) { pintar(cab + '<div class="cargando"></div>'); return; }
  const dif = T.ingreso_mes_anterior > 0 ? Math.round((T.ingreso_mes - T.ingreso_mes_anterior) * 100 / T.ingreso_mes_anterior) : null;
  const k = (icono, n, l, e, cl, flecha) => `<div class="k"><div class="l1">${ic(icono, 'regular', 24)}<b>${esc(n)}</b></div><span>${esc(l)}</span><em class="${cl}">${flecha ? ic(flecha, 'bold', 11) : ''}${esc(e)}</em></div>`;
  const kpis = `<div class="kpis">
    ${k('buildings', T.despachos, 'Despachos', T.nuevos_mes ? `+${T.nuevos_mes} nuevos` : 'sin nuevos', T.nuevos_mes ? 'up' : 'neu', T.nuevos_mes ? 'trend-up' : '')}
    ${k('currency-circle-dollar', corto(T.ingreso_mes), 'Ventas mes', dif == null ? 'este mes' : `${dif >= 0 ? '+' : ''}${dif}%`, dif == null ? 'neu' : dif >= 0 ? 'up' : 'down', dif == null ? '' : dif >= 0 ? 'trend-up' : 'trend-down')}
    ${k('pulse', T.conectados, 'Conectados', `${T.usuarios_hoy} hoy`, 'neu', '')}
    ${k('warning-circle', T.errores_7d, 'Errores 7 días', T.errores_7d > T.errores_ayer ? `+${T.errores_7d - T.errores_ayer}` : 'en calma', T.errores_7d > T.errores_ayer ? 'down' : 'up', T.errores_7d > T.errores_ayer ? 'trend-up' : '')}</div>`;
  const M = (v, icono, t, extra, msg) => `<button class="mod ${v === 'despachos' ? 'on' : ''}" ${msg ? `data-pronto="${esc(msg)}"` : `data-ir="${v}"`}>${ic(icono, 'dt', 38).replace('class="ico"', 'class="ico" style="color:#0f1e3d"')}<div>${t}</div>${extra || ''}</button>`;
  const grid = `<div class="sec">${ic('squares-four', 'fill', 22)}Centro de control<a data-ir="despachos">Ver todo${ic('caret-right', 'bold', 12)}</a></div><div class="grid">
    ${M('despachos', 'buildings', 'Despachos')}${M('ventas', 'chart-line-up', 'Ventas')}
    ${M('asist', 'headset', 'Asistencia', '', 'La asistencia remota llega en la etapa 4.')}${M('err', 'bug-beetle', 'Errores', T.errores_7d ? `<span class="bad">${T.errores_7d}</span>` : '', 'El buzón de errores llega en la etapa 5.')}
    ${M('pqrs', 'chat-circle-text', 'PQRS', '', 'El buzón de PQRS llega en la etapa 5.')}${M('anun', 'megaphone', 'Anuncios', '', 'Los anuncios llegan en la etapa 6.')}
    ${M('planes', 'tag', 'Planes y precios', '', 'Planes y precios llegan en la etapa 6.')}${M('salud', 'heartbeat', 'Salud', '', 'La salud del sistema llega en la etapa 6.')}</div>
</div>`;
  const acc = (lado) => `<div class="acc acc-${lado}"><button class="btn oro" data-pronto="Dar de alta un despacho desde aquí llega en la etapa 6. Por ahora use Soporte técnico en la app."><span class="cir">${ic('plus', 'bold', 16)}</span>Nuevo despacho</button>
    <button class="btn az" data-pronto="Los anuncios a todos los despachos llegan en la etapa 6.">${ic('paper-plane-tilt', 'regular', 20)}Enviar anuncio</button>`;
  const atn = T.atencion.length ? T.atencion.map(a => {
    const [icono, col] = ATN[a.tipo] || ['warning-circle', '#5b6478'];
    return `<div class="fl" ${a.despacho_id ? `data-desp="${Number(a.despacho_id)}" style="cursor:pointer"` : ''}>${ic(icono, 'dt', 26).replace('class="ico"', `class="ico" style="color:${col}"`)}<p>${esc(a.titulo)}<small>${esc(a.detalle)}</small></p><div class="h">${esc(hace(a.fecha))}</div></div>`;
  }).join('') : `<div class="vacio">${ic('shield-check', 'dt', 24).replace('class="ico"', 'class="ico" style="color:#15803d"')}Todo en orden. No hay nada pendiente.</div>`;
  const tar = `<div class="tar"><h4>${ic('clock-countdown', 'regular', 22)}Requiere su atención<a data-ir="despachos">Ver todo${ic('caret-right', 'bold', 12)}</a></h4>${atn}</div>
    <div class="tar"><h4>${ic('heartbeat', 'dt', 22).replace('class="ico"', 'class="ico" style="color:#0f1e3d"')}Resumen de despachos</h4>
      <div class="dato"><span>Pagaron por la página</span><b>${T.pagos}</b></div><div class="dato"><span>En prueba</span><b>${T.prueba}</b></div>
      <div class="dato"><span>Invitados</span><b>${T.invitados}</b></div><div class="dato"><span>Versión en uso</span><b>${esc(T.version || '—')}</b></div></div>`;
  pintar(cab + `<div class="cuerpo"><div class="inicio-cols"><div>${kpis}${grid}${acc('izq')}</div><div>${tar}${acc('der')}</div></div></div>`);
}

/* ---------- Despachos ---------- */
function filaDespacho(d) {
  const [t, c] = TIPO[d.tipo] || ['—', 'e-gris'];
  const vence = d.vigente_hasta && new Date(d.vigente_hasta) < new Date(Date.now() + 3 * 864e5);
  const sub = d.conectado ? `<span class="vivo"></span>Conectado ahora · ${d.usuarios} de ${d.usuarios_limite || '—'} usuarios`
    : vence ? `${new Date(d.vigente_hasta) < new Date() ? 'Vencido' : 'Vence'} ${fecha(d.vigente_hasta)} · ${hace(d.ultima).toLowerCase()}`
    : `Última conexión: ${d.ultima ? hace(d.ultima).toLowerCase() : 'nunca'} · ${d.usuarios} ${d.usuarios === 1 ? 'usuario' : 'usuarios'}`;
  return `<div class="desp" data-desp="${Number(d.id)}"><div class="av">${esc(iniciales(d.nombre))}</div><p>${esc(d.nombre)}<small>${sub}</small>${salud(d.salud)}</p>
    <span class="et ${vence ? 'e-ven' : c}">${vence ? 'VENCE' : esc(d.tipo === 'pago' ? d.plan.toUpperCase() : t.toUpperCase())}</span></div>`;
}
function vistaDespachos() {
  const L = E.despachos && E.despachos.despachos;
  const cab = `<header class="top2"><div class="logo">DC</div><div><b>Despachos</b><small>${L ? `${L.length} en total · ${L.filter(d => d.conectado).length} conectados ahora` : 'Cargando…'}</small></div>
    <button class="vol" style="margin-left:auto" id="recargar" aria-label="Actualizar">${ic('arrows-clockwise', 'regular', 20)}</button></header>`;
  if (!L) { pintar(cab + '<div class="cargando"></div>'); return; }
  const cuenta = t => L.filter(d => d.tipo === t).length;
  const q = E.busca.trim().toLowerCase();
  const vis = L.filter(d => (E.filtro === 'todos' || d.tipo === E.filtro) && (!q || d.nombre.toLowerCase().includes(q)));
  const seg = `<div class="seg">${[['todos', 'Todos', L.length], ['pago', 'Pagos', cuenta('pago')], ['prueba', 'Prueba', cuenta('prueba')], ['invitado', 'Invitados', cuenta('invitado')]].map(([v, t, n]) => `<button data-f="${v}" class="${E.filtro === v ? 'on' : ''}">${t} ${n}</button>`).join('')}</div>`;
  const pagos = vis.filter(d => d.tipo === 'pago'), otros = vis.filter(d => d.tipo !== 'pago');
  const bloque = (icono, titulo, arr) => arr.length ? `<div class="tar"><h4>${ic(icono, 'dt', 22).replace('class="ico"', 'class="ico" style="color:#0f1e3d"')}${titulo}</h4>${arr.map(filaDespacho).join('')}</div>` : '';
  const lista = `${seg}<div class="bus">${ic('magnifying-glass', 'regular', 18)}<input id="busca" placeholder="Buscar por nombre" value="${esc(E.busca)}"></div>
    ${bloque('credit-card', 'Pagaron por la página (Bold)', pagos)}${bloque('gift', 'En prueba e invitados', otros)}
    ${!vis.length ? `<div class="tar"><div class="vacio">${ic('magnifying-glass')}No hay despachos con ese filtro.</div></div>` : ''}`;
  const det = E.det ? panelDetalle() : `<div class="tar"><div class="vacio">${ic('buildings', 'dt', 24).replace('class="ico"', 'class="ico" style="color:#0f1e3d"')}Toque un despacho para ver su detalle.</div></div>`;
  pintar((E.det && innerWidth < 900 ? '' : cab) + `<div class="cuerpo"><div class="split ${E.det ? 'con-det' : ''}"><div class="panel-lista">${lista}</div><div class="panel-det">${det}</div></div></div>`);
  $app.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { E.filtro = b.dataset.f; vistaDespachos(); });
  const bi = document.getElementById('busca'); if (bi) bi.oninput = () => { E.busca = bi.value; const p = bi.selectionStart; vistaDespachos(); const n = document.getElementById('busca'); n.focus(); n.setSelectionRange(p, p); };
  const rc = document.getElementById('recargar'); if (rc) rc.onclick = async () => { E.despachos = null; vistaDespachos(); await cargar('despachos', () => rpc('dcsoporte_despachos_transaccional')); vistaDespachos(); };
  $app.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { E.detTab = b.dataset.tab; vistaDespachos(); });
  const v = document.getElementById('volver'); if (v) v.onclick = () => { E.det = null; vistaDespachos(); };
  $app.querySelectorAll('[data-pronto]').forEach(b => b.onclick = () => toast(b.dataset.pronto));
}
async function abrirDespacho(id) {
  E.vista = 'despachos'; E.det = id; E.detTab = 'resumen'; E.detalle = null;
  if (!E.despachos) cargar('despachos', () => rpc('dcsoporte_despachos_transaccional')).then(() => E.vista === 'despachos' && vistaDespachos());
  scrollTo(0, 0); vistaDespachos();
  if (await cargar('detalle', () => rpc('dcsoporte_despacho_transaccional', { id }))) if (E.det === id) vistaDespachos();
}
function panelDetalle() {
  const D = E.detalle;
  const volver = `<button class="vol" id="volver" aria-label="Volver">${ic('caret-left', 'bold', 20)}</button>`;
  if (!D || D.id !== E.det) return `<div class="top2" style="padding:4px 0 12px">${volver}</div><div class="cargando"></div>`;
  const [t] = TIPO[D.tipo] || ['—'];
  const cab = `<div class="top2" style="padding:4px 0 12px">${volver}<div class="av" style="width:48px;height:48px">${esc(iniciales(D.nombre))}</div>
    <div style="min-width:0"><b style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(D.nombre)}</b><small>${esc(t)} · plan ${esc(D.plan ? D.plan.nombre : 'sin plan')} · desde ${fecha(D.creado_en)}</small></div></div>`;
  const tabs = `<div class="seg">${[['resumen', 'Resumen'], ['actividad', 'Actividad'], ['usuarios', 'Usuarios'], ['pagos', 'Pagos']].map(([v, n]) => `<button data-tab="${v}" class="${E.detTab === v ? 'on' : ''}">${n}</button>`).join('')}</div>`;
  let cuerpo = '';
  const U = D.ultima;
  if (E.detTab === 'resumen') {
    const lim = (D.plan ? D.plan.usuarios : 0) + (D.usuarios_extra || 0);
    const activos = D.usuarios.filter(u => u.activo).length;
    const roles = {}; D.usuarios.filter(u => u.activo).forEach(u => roles[u.rol] = (roles[u.rol] || 0) + 1);
    const vencido = D.vigente_hasta && new Date(D.vigente_hasta) < new Date();
    cuerpo = `<div class="kpis dos">
      <div class="k"><div class="l1">${ic('plugs-connected', 'regular', 24)}<b>${U && U.conectado ? 'Ahora' : esc(U ? hace(U.fecha) : 'Nunca')}</b></div><span>Última conexión${U ? ' · ' + esc(U.equipo || '') : ''}</span><em class="${U && U.conectado ? 'up' : 'neu'}">${U ? (U.conectado ? ic('circle', 'fill', 9) : '') + esc(U.usuario || '') : 'Aún no entra'}</em></div>
      <div class="k"><div class="l1">${ic('timer', 'regular', 24)}<b>${esc(duracion(D.minutos_total))}</b></div><span>Tiempo de uso total</span><em class="${D.minutos_7d ? 'up' : 'neu'}">${D.minutos_7d ? ic('trend-up', 'bold', 11) : ''}${esc(duracion(D.minutos_7d))} esta semana</em></div>
      <div class="k"><div class="l1">${ic('users-three', 'regular', 24)}<b>${activos} de ${lim || '—'}</b></div><span>Usuarios del plan</span><em class="neu">${esc(Object.entries(roles).map(([r, n]) => `${n} ${r}`).join(' · ') || 'Sin usuarios')}</em></div>
      <div class="k"><div class="l1">${ic('calendar-check', 'regular', 24)}<b>${D.vigente_hasta ? esc(fecha(D.vigente_hasta, { year: '2-digit' })) : 'Sin fecha'}</b></div><span>Vigente hasta</span><em class="${vencido ? 'down' : 'neu'}">${vencido ? 'Vencido' : D.tipo === 'pago' ? 'Renueva con Bold' : 'Sin cobro'}</em></div></div>
      ${D.soporte ? `<div class="aviso">${ic('lock-key', 'fill', 22)}<div>Este despacho le dio permiso de soporte hasta el ${esc(fecha(D.soporte.vence_en))} a las ${esc(hora(D.soporte.vence_en))}</div></div>` : ''}
      ${tarUso(D, 5)}
      <div class="tar"><h4>${ic('identification-card', 'dt', 22).replace('class="ico"', 'class="ico" style="color:#0f1e3d"')}Datos del despacho</h4>
        <div class="dato"><span>Sesiones totales</span><b>${D.sesiones}</b></div><div class="dato"><span>Versión que usa</span><b>${esc(U ? U.version || '—' : '—')}</b></div>
        <div class="dato"><span>Errores en 30 días</span><b>${D.errores_30d}</b></div><div class="dato"><span>Procesos incluidos</span><b>${(D.plan ? D.plan.procesos : 0) + (D.procesos_extra || 0)}</b></div></div>
      <div class="acc"><button class="btn oro" ${D.soporte ? `data-modo="${Number(D.id)}"` : `data-pronto="${esc(D.nombre)} no le ha dado permiso de soporte. Pídale que lo autorice en Configuración › Soporte técnico."`}><span class="cir">${ic('headset', 'bold', 15)}</span>Dar soporte</button>
      <button class="btn az" data-chat="${Number(D.id)}">${ic('envelope-simple', 'regular', 20)}Escribirle</button></div>`;
  } else if (E.detTab === 'actividad') {
    cuerpo = tarRecorrido(D);
  } else if (E.detTab === 'usuarios') {
    cuerpo = `<div class="tar"><h4>${ic('users-three', 'dt', 22).replace('class="ico"', 'class="ico" style="color:#0f1e3d"')}Usuarios (${D.usuarios.length})</h4>${D.usuarios.length ? D.usuarios.map(u => `
      <div class="fl">${ic(u.titular ? 'crown' : 'user-gear', 'dt', 26).replace('class="ico"', 'class="ico" style="color:#0f1e3d"')}<p>${esc(u.nombre)}${u.titular ? ' · titular' : ''}<small>${esc(u.rol)} · ${esc(u.correo || '')}<br>${u.ultima ? 'Última vez ' + esc(hace(u.ultima).toLowerCase()) : 'Nunca ha entrado'}${u.equipos && u.equipos.length ? ' · ' + esc(u.equipos.join(', ')) : ''}</small></p>
      <span class="et ${u.activo ? 'e-pago' : 'e-gris'}">${u.activo ? 'ACTIVO' : 'INACTIVO'}</span></div>`).join('') : `<div class="vacio">Sin usuarios.</div>`}</div>`;
  } else {
    cuerpo = `<div class="tar"><h4>${ic('receipt', 'dt', 22).replace('class="ico"', 'class="ico" style="color:#0f1e3d"')}Pagos y renovaciones</h4>${D.pagos.length ? D.pagos.map(p => `
      <div class="fl">${ic(p.anulado ? 'arrow-u-up-left' : (p.monto > 0 ? 'plus-circle' : 'gift'), 'dt', 26).replace('class="ico"', `class="ico" style="color:${p.anulado ? '#b91c1c' : p.monto > 0 ? '#15803d' : '#1d4ed8'}"`)}<p>${p.anulado ? 'Anulado' : p.monto > 0 ? 'Pago' : 'Días sin cobro'} · ${esc(p.plan || D.plan && D.plan.nombre || '')}<small>${esc(fecha(p.fecha))} · ${p.dias} días · ${esc(p.fuente || '')}${p.referencia ? ' · ' + esc(p.referencia) : ''}</small></p>
      <b style="font-size:13px;${p.anulado ? 'color:#b91c1c;text-decoration:line-through' : ''}">${p.monto > 0 ? pesos(p.monto) : '—'}</b></div>`).join('') : `<div class="vacio">Todavía no tiene pagos.</div>`}</div>`;
  }
  return cab + tabs + cuerpo;
}
const NOMBRE_MODULO = {
  DASHBOARD: ['Inicio', 'house'], SEGUIMIENTO_JUDICIAL: ['Vigilancia judicial', 'binoculars'], AVISOS_DEL_DIA: ['Avisos del día', 'megaphone'],
  SIMULADOR_LIQUIDACION: ['Simulador de liquidación', 'calculator'], NUEVO_CLIENTE: ['Nuevo cliente', 'identification-card'], CLIENTES: ['Clientes', 'identification-card'],
  MENSAJES_CLIENTES: ['Mensajes de clientes', 'chat-circle-text'], CLIENTES_PORTAL: ['Portal del cliente', 'identification-card'], CARTERA: ['Cartera', 'coins'],
  CONTABILIDAD: ['Contabilidad', 'calculator'], COTIZACIONES: ['Cotizaciones', 'receipt'], CONTRATOS: ['Contratos', 'receipt'], EXPEDIENTES: ['Expedientes', 'folder-open'],
  HISTORIA_JURIDICA: ['Historia jurídica', 'folder-open'], TERMINOS_JURIDICOS: ['Términos', 'hourglass-medium'], CENTRO_VENCIMIENTOS: ['Vencimientos', 'hourglass-medium'],
  CALENDARIO_AGENDA: ['Calendario y agenda', 'calendar-check'], ALERTAS_RIESGO: ['Alertas de riesgo', 'siren'], LECTURA_DOCUMENTOS: ['Lectura de documentos', 'folder-open'],
  ASISTENTE_JURIDICO: ['Doc Dai', 'chat-circle-text'], CONSULTA_RAMA_JUDICIAL: ['Consulta Rama Judicial', 'binoculars'], FIRMA_ELECTRONICA: ['Firma y solicitudes', 'receipt'],
  TAREAS_RECORDATORIOS: ['Tareas', 'list-checks'], ADMIN_PLANTILLAS_JURIDICAS: ['Plantillas jurídicas', 'receipt'], DOCUMENTOS: ['Documentos', 'folder-open'],
  AUDITORIA: ['Auditoría', 'list-checks'], CONFIGURACION: ['Configuración', 'user-gear'], INSOLVENCIA: ['Insolvencia', 'coins'], INFORMES_VIGILANCIA: ['Informes de vigilancia', 'binoculars'],
  ENVIO_CORREO_CERTIFICADO: ['Correo certificado', 'paper-plane-tilt'], ADMIN_DC: ['Administración DC', 'crown']
};
const nomMod = m => (NOMBRE_MODULO[m] || [String(m || 'General').toLowerCase().replace(/_/g, ' ').replace(/^./, c => c.toUpperCase()), 'folder-open']);
const tiempoMod = seg => { const m = Math.round((seg || 0) / 60); if (m < 1) return 'menos de 1 min'; if (m < 60) return m + ' min'; const h = Math.floor(m / 60), r = m % 60; return h + ' h' + (r ? ' ' + r + ' min' : ''); };
function tarUso(D, n) {
  const U = D.uso_modulos || [];
  if (!U.length) return tarModulos(D, n);
  const M = U.slice(0, n), max = Math.max(1, ...M.map(m => m.segundos));
  return `<div class="tar"><h4>${ic('list-magnifying-glass', 'regular', 22)}Módulos más usados (30 días)${n < 50 ? `<a data-tab="actividad">Recorrido${ic('caret-right', 'bold', 12)}</a>` : ''}</h4>
    ${M.map(m => { const [t, i] = nomMod(m.modulo); return `<div class="mo"><span class="n">${ic(i, 'dt', 20).replace('class="ico"', 'class="ico" style="color:#0f1e3d"')}${esc(t)}</span><div class="barra"><i style="width:${Math.max(3, Math.round(m.segundos * 100 / max))}%"></i></div><b>${esc(tiempoMod(m.segundos))}</b></div>`; }).join('')}</div>`;
}
function tarRecorrido(D) {
  const U = D.uso_modulos || [], H = D.uso_hoy || [];
  const ahora = D.modulo_actual ? `<div class="aviso">${ic('circle', 'fill', 12).replace('class="ico"', 'class="ico" style="color:#22c55e"')}<div>Conectado ahora en <b>${esc(nomMod(D.modulo_actual)[0])}</b></div></div>` : '';
  const hoy = `<div class="tar"><h4>${ic('clock-countdown', 'regular', 22)}Recorrido de hoy</h4>${H.length ? H.map(h => { const [t, i] = nomMod(h.modulo); return `<div class="fl">${ic(i, 'dt', 24).replace('class="ico"', 'class="ico" style="color:#0f1e3d"')}<p>${esc(t)}<small>${esc(h.usuario || 'Usuario')} · último uso ${esc(hora(h.ultima))}</small></p><div class="h">${esc(tiempoMod(h.segundos))}</div></div>`; }).join('') : `<div class="vacio">Hoy todavía no ha usado ningún módulo.</div>`}</div>`;
  const tabla = U.length ? `<div class="tar"><h4>${ic('list-magnifying-glass', 'regular', 22)}Tiempo por módulo (30 días)</h4>${U.map(m => { const [t, i] = nomMod(m.modulo); return `<div class="fl">${ic(i, 'dt', 24).replace('class="ico"', 'class="ico" style="color:#0f1e3d"')}<p>${esc(t)}<small>${m.visitas} ${m.visitas === 1 ? 'entrada' : 'entradas'} · ${m.usuarios} ${m.usuarios === 1 ? 'usuario' : 'usuarios'} · último uso ${esc(hace(m.ultima).toLowerCase())}</small></p><div class="monto">${esc(tiempoMod(m.segundos))}</div></div>`; }).join('')}</div>`
    : `<div class="aviso">${ic('clock-countdown', 'regular', 22)}<div>El tiempo en cada módulo se empieza a contar desde la versión 1.7.43 de la app comercial. Abajo se ven las acciones que la app ya anotaba.</div></div>`;
  return ahora + hoy + tabla + tarModulos(D, 50);
}
function tarModulos(D, n) {
  const M = D.modulos.slice(0, n); const max = Math.max(1, ...M.map(m => m.acciones));
  return `<div class="tar"><h4>${ic('list-magnifying-glass', 'regular', 22)}Actividad por módulo (30 días)${n < 50 ? `<a data-tab="actividad">Ver todo${ic('caret-right', 'bold', 12)}</a>` : ''}</h4>
    ${M.length ? M.map(m => `<div class="mo"><span class="n">${ic('folder-open', 'dt', 20).replace('class="ico"', 'class="ico" style="color:#0f1e3d"')}${esc(m.modulo || 'General')}</span><div class="barra"><i style="width:${Math.max(3, Math.round(m.acciones * 100 / max))}%"></i></div><b>${m.acciones} acc.</b></div>`).join('')
      : `<div class="vacio">Sin actividad registrada en 30 días.</div>`}</div>`;
}

/* ---------- Ajustes ---------- */
function vistaAjustes() {
  let modo = 'auto'; try { modo = localStorage.getItem('dcsoporte-tema') || 'auto'; } catch (e) { }
  const s = leerSesion() || {};
  pintar(`<header class="top2"><div class="logo">DC</div><div><b>Ajustes</b><small>DC Soporte ${VERSION}</small></div></header><div class="cuerpo">
    <div class="tar"><h4>${ic('circle-half', 'regular', 22)}Apariencia</h4><div class="opc" style="margin-top:8px">
      ${[['oscuro', 'moon', 'Oscuro'], ['claro', 'sun', 'Claro'], ['auto', 'circle-half', 'Automático']].map(([v, i, t]) => `<button data-modo="${v}" class="${modo === v ? 'on' : ''}">${ic(i, 'regular', 24)}${t}</button>`).join('')}</div>
      <div class="nota">Automático usa el modo que tenga puesto su celular o computador.</div></div>
    <div class="tar"><h4>${ic('shield-check', 'regular', 22)}Seguridad</h4>
      <div class="dato"><span>Cuenta</span><b>${esc(s.correo || '—')}</b></div>
      <div class="dato"><span>Cierre por inactividad</span><b>${INACTIVIDAD_MIN} minutos</b></div>
      <div class="dato"><span>Al cerrar el navegador</span><b>Se cierra la sesión</b></div>
      <div class="nota">Cada consulta la revisa el servidor: si la cuenta no es la de la plataforma, no se entrega ningún dato.</div></div>
    <button class="btn az" id="salir" style="width:100%">${ic('sign-out', 'regular', 20)}Cerrar sesión</button></div>`);
  $app.querySelectorAll('[data-modo]').forEach(b => b.onclick = () => {
    try { localStorage.setItem('dcsoporte-tema', b.dataset.modo); } catch (e) { }
    const m = b.dataset.modo; document.documentElement.setAttribute('data-tema', m === 'auto' ? (matchMedia('(prefers-color-scheme: light)').matches ? 'claro' : 'oscuro') : m);
    vistaAjustes();
  });
  document.getElementById('salir').onclick = () => salir();
}
/* ---------- Ventas (etapa 2): pagos de Bold, renovaciones, anulaciones y ajustes manuales ---------- */
const MOV = {
  venta: ['plus-circle', '#15803d', 'Venta'], renovacion: ['arrows-clockwise', '#c58a12', 'Renovación'],
  anulacion: ['arrow-u-up-left', '#b91c1c', 'Anulación'], manual: ['sliders-horizontal', '#5b6478', 'Ajuste manual']
};
const PERIODOS = [['semana', 'Semana'], ['mes', 'Mes'], ['anio', 'Año'], ['todo', 'Todo']];
const MEDIO = { CARD: 'tarjeta', PSE: 'PSE', NEQUI: 'Nequi', BANCOLOMBIA_TRANSFER: 'Bancolombia', manual: 'a mano' };
function tituloPeriodo(V) {
  const ahora = new Date();
  if (V.periodo === 'mes') return 'Ingreso de ' + ahora.toLocaleDateString('es-CO', { timeZone: ZONA, month: 'long' });
  if (V.periodo === 'anio') return 'Ingreso de ' + ahora.toLocaleDateString('es-CO', { timeZone: ZONA, year: 'numeric' });
  if (V.periodo === 'semana') return 'Ingreso de los últimos 7 días';
  return 'Ingreso total';
}
function grafica(serie) {
  const vals = (serie || []).map(s => Number(s.total) || 0);
  if (vals.length < 2) vals.unshift(0);
  let acc = 0; const pts = vals.map(v => (acc += v));               // acumulado: la línea sube con cada pago
  const W = 600, H = 150, max = Math.max(1, ...pts);
  const xy = pts.map((v, i) => [Math.round(i * W / (pts.length - 1)), Math.round(H - 8 - (v / max) * (H - 26))]);
  const linea = xy.map((p, i) => (i ? 'L' : 'M') + p[0] + ',' + p[1]).join(' ');
  return `<svg class="graf" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="gv" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e7b94a" stop-opacity=".45"/><stop offset="1" stop-color="#e7b94a" stop-opacity="0"/></linearGradient></defs>
    <path d="${linea} L${W},${H} L0,${H} Z" fill="url(#gv)"/><path d="${linea}" fill="none" stroke="#c9941f" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/></svg>`;
}
function filaMov(m) {
  const [icono, col, t] = MOV[m.tipo] || MOV.venta;
  const plan = m.plan ? m.plan : (m.tipo === 'manual' ? `${m.dias} días` : 'Plan');
  const sub = `${esc(plan)}${m.medio && m.tipo !== 'manual' ? ' · ' + esc(MEDIO[m.medio] || m.medio) : ''} · ${esc(hace(m.fecha))}`;
  const monto = m.monto == null ? '<span class="neu">sin cobro</span>' : (m.tipo === 'anulacion' ? `<span class="rojo">−${pesos(m.monto)}</span>` : pesos(m.monto));
  return `<div class="fl" ${m.despacho_id ? `data-desp="${Number(m.despacho_id)}" style="cursor:pointer"` : ''}>${ic(icono, 'dt', 26).replace('class="ico"', `class="ico" style="color:${col}"`)}
    <p>${t} · ${esc(m.despacho)}<small>${sub}${m.tipo === 'anulacion' && m.motivo ? ' · ' + esc(m.motivo) : ''}</small></p><div class="monto">${monto}</div></div>`;
}
function menuDescarga(V) {
  const h = document.createElement('div'); h.className = 'hoja';
  h.innerHTML = `<div class="caja" role="dialog" aria-label="Descargar informe"><i class="asa"></i><h4>Descargar informe de ventas</h4><small>${esc(periodoTexto(V))} · ${V.movimientos.length} ${V.movimientos.length === 1 ? 'movimiento' : 'movimientos'}</small>
    <button data-fmt="pdf">${ic('file-pdf', 'dt', 34).replace('class="ico"', 'class="ico" style="color:#b91c1c"')}<span><b>PDF</b><em>Para ver, imprimir o enviar</em></span>${ic('caret-right', 'bold', 16)}</button>
    <button data-fmt="xlsx">${ic('microsoft-excel-logo', 'dt', 34).replace('class="ico"', 'class="ico" style="color:#15803d"')}<span><b>Excel</b><em>Tabla con filtros, totales y fórmulas</em></span>${ic('caret-right', 'bold', 16)}</button>
    <button class="cancelar" data-fmt="">Cancelar</button></div>`;
  const cerrar = () => { h.classList.remove('on'); setTimeout(() => h.remove(), 220); };
  h.onclick = e => { if (e.target === h) cerrar(); };
  h.querySelectorAll('[data-fmt]').forEach(b => b.onclick = async () => {
    const f = b.dataset.fmt; if (!f) return cerrar();
    b.disabled = true; b.querySelector('em').textContent = 'Preparando el archivo…';
    try { await (f === 'pdf' ? informePDF(V) : informeExcel(V)); cerrar(); toast(f === 'pdf' ? 'Listo: el PDF quedó en sus descargas.' : 'Listo: el Excel quedó en sus descargas.'); }
    catch (e) { console.error(e); b.disabled = false; b.querySelector('em').textContent = 'No se pudo crear. Toque para intentar de nuevo.'; }
  });
  document.body.appendChild(h); requestAnimationFrame(() => h.classList.add('on'));
}
function vistaVentas() {
  const V = E.ventas && E.ventas.periodo === E.periodo ? E.ventas : null;
  const cab = `<header class="top2"><div class="logo">DC</div><div><b>Ventas</b><small>Pagos procesados por Bold</small></div>
    <button class="vol" style="margin-left:auto" id="bajar" aria-label="Descargar informe en PDF o Excel">${ic('download-simple', 'regular', 22)}</button></header>`;
  const seg = `<div class="seg">${PERIODOS.map(([v, t]) => `<button data-per="${v}" class="${E.periodo === v ? 'on' : ''}">${t}</button>`).join('')}</div>`;
  if (!V) {
    pintar(cab + `<div class="cuerpo">${seg}<div class="cargando"></div></div>`); enlazarVentas(null);
    cargar('ventas', () => rpc('dcsoporte_ventas_transaccional', { periodo: E.periodo })).then(ok => ok && E.vista === 'ventas' && vistaVentas());
    return;
  }
  const dif = V.total_anterior > 0 ? Math.round((V.total - V.total_anterior) * 100 / V.total_anterior) : null;
  const ingreso = `<div class="tar ingreso"><h4>${ic('chart-line-up', 'regular', 22)}${esc(tituloPeriodo(V))}${dif != null ? `<em class="${dif >= 0 ? 'up' : 'down'}">${ic(dif >= 0 ? 'trend-up' : 'trend-down', 'bold', 13)}${dif >= 0 ? '+' : ''}${dif}%</em>` : ''}</h4>
    <div class="cifra">${pesos(V.total)}</div>${grafica(V.serie)}
    <div class="nota">${V.ventas_n} ${V.ventas_n === 1 ? 'venta nueva' : 'ventas nuevas'} por ${pesos(V.ventas_monto)}${V.pendientes ? ` · ${V.pendientes} ${V.pendientes === 1 ? 'compra empezada sin pagar' : 'compras empezadas sin pagar'}` : ''}</div></div>`;
  const k = (icono, n, l, e, cl) => `<div class="k"><div class="l1">${ic(icono, 'regular', 24)}<b>${esc(n)}</b></div><span>${esc(l)}</span><em class="${cl}">${esc(e)}</em></div>`;
  const kpis = `<div class="kpis dos">${k('arrows-clockwise', V.renovaciones_n, V.renovaciones_n === 1 ? 'Renovación' : 'Renovaciones', pesos(V.renovaciones_monto), V.renovaciones_n ? 'up' : 'neu')}
    ${k('arrow-u-up-left', V.anulaciones_n, (V.anulaciones_n === 1 ? 'Anulación' : 'Anulaciones') + ' · ' + pesos(V.anulaciones_monto), V.anulaciones_n ? 'descontado' : 'ninguna', V.anulaciones_n ? 'down' : 'up')}</div>`;
  const todos = E.verTodosMov, lista = todos ? V.movimientos : V.movimientos.slice(0, 5);
  const movs = `<div class="tar"><h4>${ic('receipt', 'regular', 22)}Movimientos${V.movimientos.length > 5 ? `<a id="vertodos">${todos ? 'Ver menos' : `Ver todos (${V.movimientos.length})`}${ic('caret-right', 'bold', 12)}</a>` : ''}</h4>
    ${lista.length ? lista.map(filaMov).join('') : `<div class="vacio">${ic('receipt', 'dt', 24).replace('class="ico"', 'class="ico" style="color:#0f1e3d"')}No hubo movimientos en este periodo.</div>`}
    ${V.manuales_n ? `<div class="nota">Los ajustes manuales son días que usted dio a mano desde la app (sin cobro por Bold).</div>` : ''}</div>`;
  pintar(cab + `<div class="cuerpo"><div class="ventas-cols"><div>${seg}${ingreso}${kpis}</div><div>${movs}</div></div></div>`);
  enlazarVentas(V);
}
function enlazarVentas(V) {
  $app.querySelectorAll('[data-per]').forEach(b => b.onclick = () => { E.periodo = b.dataset.per; E.verTodosMov = false; vistaVentas(); });
  const bj = document.getElementById('bajar'); if (bj) bj.onclick = () => V ? menuDescarga(V) : toast('Espere a que carguen las ventas.');
  const vt = document.getElementById('vertodos'); if (vt) vt.onclick = () => { E.verTodosMov = !E.verTodosMov; vistaVentas(); };
  $app.querySelectorAll('.fl[data-desp]').forEach(b => b.onclick = () => { E.vista = 'despachos'; abrirDespacho(Number(b.dataset.desp)); });
}

/* ---------- Soporte (etapa 4): asistencia remota con el permiso que da cada despacho ---------- */
const APP_COMERCIAL = 'https://dcgestionjuridica.github.io/dc-gestion-juridica-app/';
const quedan = m => m == null ? '' : m >= 1440 ? `${Math.floor(m / 1440)} d ${Math.floor(m % 1440 / 60)} h` : m >= 60 ? `${Math.floor(m / 60)} h ${m % 60 ? (m % 60) + ' min' : ''}`.trim() : `${m} min`;
const NOMBRE_ACCION = { ENTRAR: 'Entró a la app', SALIR: 'Salió de la app', CREAR: 'Creó', EDITAR: 'Editó', ELIMINAR: 'Eliminó', GUARDAR: 'Guardó', ENVIAR: 'Envió' };
const nomAccion = a => NOMBRE_ACCION[a] || String(a || '').toLowerCase().replace(/_/g, ' ').replace(/^./, c => c.toUpperCase());
let relojVivo = null;
function pararVivo() { if (relojVivo) { clearInterval(relojVivo); relojVivo = null; } }
function vistaSoporte() {
  pararVivo();
  if (E.sopTab === 'buzon') return vistaBuzon();
  const S = E.soporte;
  const cab = cabSoporte('Asistencia remota con permiso del despacho');
  if (!S) {
    pintar(cab + `<div class="cuerpo">${segSoporte()}<div class="cargando"></div></div>`); enlazarSegSoporte();
    cargar('soporte', () => rpc('dcsoporte_soporte_transaccional')).then(ok => ok && E.vista === 'soporte' && !E.modo && vistaSoporte());
    return;
  }
  const con = S.despachos.filter(d => d.minutos != null), sin = S.despachos.filter(d => d.minutos == null);
  const fila = d => {
    const vivo = S.atendiendo === d.id, gente = d.conectados ? `${d.conectados} ${d.conectados === 1 ? 'conectado' : 'conectados'} ahora` : 'Nadie conectado';
    const sub = d.minutos != null ? `Quedan ${quedan(d.minutos)} · ${gente}` : `${gente}${d.ultima_ayuda ? ' · última ayuda ' + hace(d.ultima_ayuda).toLowerCase() : ''}`;
    const et = vivo ? '<span class="et e-ven">EN VIVO</span>' : d.minutos != null ? '<span class="et e-pago">CON PERMISO</span>' : '';
    return `<div class="desp" data-sop="${Number(d.id)}" style="cursor:pointer"><div class="av">${esc(iniciales(d.nombre))}</div><p>${esc(d.nombre)}<small>${d.conectados ? '<i class="pt-verde"></i>' : ''}${esc(sub)}</small></p>${et}${ic('caret-right', 'bold', 14)}</div>`;
  };
  const icT = (n, col) => ic(n, 'dt', 22).replace('class="ico"', `class="ico" style="color:${col || '#0f1e3d'}"`);
  const conP = `<div class="tar"><h4>${icT('lock-key')}Le dieron permiso (${con.length})</h4>${con.length ? con.map(fila).join('') : `<div class="vacio">${icT('lifebuoy')}Ningún despacho tiene el permiso de soporte abierto en este momento.</div>`}</div>`;
  const sinP = sin.length ? `<div class="tar"><h4>${icT('buildings')}Sin permiso (${sin.length})</h4>${sin.map(fila).join('')}</div>` : '';
  const como = `<div class="aviso">${ic('lock-key', 'fill', 22)}<div>Usted solo entra a un despacho cuando el titular o un administrador le da permiso desde su app, en <b>Configuración › Soporte técnico</b>, por 2, 24 o 72 horas. Todo lo que haga queda anotado y ellos lo ven.</div></div>`;
  pintar(cab + `<div class="cuerpo">${segSoporte()}<div class="ventas-cols"><div>${como}${conP}</div><div>${sinP}</div></div></div>`);
  enlazarSegSoporte();
  $app.querySelectorAll('[data-sop]').forEach(b => b.onclick = () => {
    const d = S.despachos.find(x => x.id === Number(b.dataset.sop));
    if (d.minutos == null) return toast(`${d.nombre} no le ha dado permiso de soporte. Pídale que lo autorice en Configuración › Soporte técnico.`);
    E.modo = d.id; E.vivo = null; scrollTo(0, 0); vistaModo();
  });
}
async function cargarVivo() {
  const id = E.modo;
  try { const r = await rpc('dcsoporte_en_vivo_transaccional', { id }); if (E.modo === id) { E.vivo = r; if (E.vista === 'soporte' && !document.querySelector('.hoja')) vistaModo(); } }
  catch (e) {
    if (e.message === 'SIN_SESION') return salir(); if (e.message === 'NO_PLATAFORMA') return salir('Esta cuenta no es la de la plataforma.');
    pararVivo(); toast(/autoriz|venci/i.test(e.message) ? 'El permiso de soporte de este despacho venció o lo retiraron.' : 'No se pudo cargar: ' + e.message);
    E.modo = null; E.soporte = null; if (E.vista === 'soporte') vistaSoporte();
  }
}
function vistaModo() {
  const V = E.vivo && E.vivo.id === E.modo ? E.vivo : null;
  const d = (E.soporte && E.soporte.despachos.find(x => x.id === E.modo)) || {};
  const nombre = V ? V.nombre : d.nombre || '';
  const enVivo = V ? V.atendiendo : E.soporte && E.soporte.atendiendo === E.modo;
  const cab = `<header class="top2"><button class="vol" id="volver-sop" aria-label="Volver">${ic('caret-left', 'bold', 20)}</button>
    <div style="min-width:0"><b>Modo soporte</b><small class="sub2">${esc(nombre)}${V && V.minutos != null ? ' · quedan ' + esc(quedan(V.minutos)) : ''}</small></div>
    <span class="et ${enVivo ? 'e-ven' : 'e-oro'}" style="margin-left:auto">${enVivo ? 'EN VIVO' : 'SOLO MIRAR'}</span></header>`;
  if (!relojVivo) { cargarVivo(); relojVivo = setInterval(cargarVivo, 15000); }
  if (!V) { pintar(cab + `<div class="cuerpo"><div class="cargando"></div></div>`); enlazarModo(); return; }
  const icT = (n, col, t = 22) => ic(n, 'dt', t).replace('class="ico"', `class="ico" style="color:${col || '#0f1e3d'}"`);
  const aviso = `<div class="aviso">${ic('lock-key', 'fill', 22)}<div>El despacho le <b>concedió</b> este acceso. Todo lo que haga queda anotado y ellos lo ven en su historial. Mirar en vivo no abre datos de sus clientes; solo se abren si usted entra a corregir.</div></div>`;
  const gente = `<div class="tar" id="en-vivo"><h4>${icT('eye')}En vivo ahora<a id="act-vivo">Actualiza sola · ${esc(hora(V.ahora))}</a></h4>${V.conectados.length ? V.conectados.map(u => `
    <div class="fl">${icT(u.modulo ? nomMod(u.modulo)[1] : 'user', '#0f1e3d', 26)}<p>${esc(u.usuario)} · ${esc(u.rol || '')}<small>${u.modulo ? 'En <b>' + esc(nomMod(u.modulo)[0]) + '</b> · ' : ''}${esc(u.equipo || '')}${u.version ? ' · v' + esc(u.version) : ''}</small></p><div class="h">${esc(hace(u.ultima))}</div></div>`).join('')
    : `<div class="vacio">${icT('user')}Nadie del despacho está conectado en este momento.</div>`}</div>`;
  const todas = E.todasAcc, lista = V.acciones.slice(0, todas ? 15 : 8);
  const acciones = `<div class="tar" id="acciones"><h4>${icT('list-checks')}Últimas acciones${V.acciones.length > 2 ? `<a id="ver-acc">${todas ? 'Ver menos' : 'Ver todas'}${ic('caret-right', 'bold', 12)}</a>` : ''}</h4>${lista.length ? lista.map(a => {
    const mal = a.resultado && !/^ok$/i.test(a.resultado);
    return `<div class="fl">${mal ? icT('warning-octagon', '#b91c1c', 24) : icT('check-circle', '#15803d', 24)}<p>${esc(nomAccion(a.accion))}${a.modulo ? ' · ' + esc(a.modulo) : ''}<small>${esc(a.usuario || '')}${mal ? ' · ' + esc(a.resultado) : ''}</small></p><div class="h">${esc(hace(a.fecha))}<br>${esc(hora(a.fecha))}</div></div>`; }).join('')
    : `<div class="vacio">${icT('list-checks')}Todavía no hay acciones anotadas.</div>`}</div>`;
  const t = (id, icono, col, l1, l2) => `<button class="mosaico" id="${id}">${icT(icono, col, 40)}<b>${l1}</b><span>${l2}</span></button>`;
  const mosaicos = `<div class="mosaicos">${t('m-ver', 'eye', '#0f1e3d', 'Ver en vivo', '(solo mirar)')}${t('m-corregir', 'pencil-simple-line', '#0f1e3d', 'Corregir', '(con segundo sí)')}
    ${t('m-version', 'arrows-clockwise', '#c58a12', 'Forzar versión', 'nueva')}${t('m-chat', 'chats', '#0f1e3d', 'Chat del', 'caso')}</div>`;
  const fin = `<button class="btn rojo-fin" id="m-fin">${ic('stop-circle', 'bold', 22)}Terminar y enviar resumen</button>`;
  const y = scrollY;
  pintar(cab + `<div class="cuerpo"><div class="ventas-cols"><div>${aviso}${gente}</div><div>${mosaicos}${fin}${acciones}</div></div></div>`);
  if (!todas) {                                   // se muestran las acciones que caben en la pantalla; el resto con «Ver todas»
    const filas = [...document.querySelectorAll('#acciones .fl')];
    while (filas.length > 2 && document.documentElement.scrollHeight > innerHeight + 1) filas.pop().remove();
    const va = document.getElementById('ver-acc'); if (va && filas.length >= V.acciones.length) va.remove();
  }
  scrollTo(0, y); enlazarModo();
}
function hojaSoporte(html, alAbrir) {
  const h = document.createElement('div'); h.className = 'hoja';
  h.innerHTML = `<div class="caja" role="dialog"><i class="asa"></i>${html}</div>`;
  const cerrar = () => { h.classList.remove('on'); setTimeout(() => h.remove(), 220); };
  h.onclick = e => { if (e.target === h) cerrar(); };
  h.querySelectorAll('[data-cerrar]').forEach(b => b.onclick = cerrar);
  document.body.appendChild(h); requestAnimationFrame(() => h.classList.add('on'));
  if (alAbrir) alAbrir(h, cerrar);
}
function enlazarModo() {
  const v = document.getElementById('volver-sop'); if (v) v.onclick = () => { pararVivo(); E.modo = null; E.soporte = null; vistaSoporte(); };
  const ver = document.getElementById('m-ver'); if (ver) ver.onclick = () => { document.getElementById('en-vivo').scrollIntoView({ behavior: 'smooth', block: 'start' }); cargarVivo(); toast('Mirando en vivo. Se actualiza cada 15 segundos.'); };
  const va = document.getElementById('ver-acc'); if (va) va.onclick = () => { E.todasAcc = !E.todasAcc; vistaModo(); };
  const ver2 = document.getElementById('m-version'); if (ver2) ver2.onclick = () => forzarVersion(E.modo, E.vivo ? E.vivo.nombre : '');
  const ch = document.getElementById('m-chat'); if (ch) ch.onclick = () => abrirChatDespacho(E.modo);
  const co = document.getElementById('m-corregir'); if (co) co.onclick = () => {
    const nombre = E.vivo ? E.vivo.nombre : '';
    hojaSoporte(`<h4>¿Entrar a corregir?</h4><small>Va a entrar a <b>${esc(nombre)}</b> con su cuenta de la plataforma. Verá sus datos como ellos los ven, cada cambio queda anotado y el despacho lo ve en su historial. Se abre la app comercial en otra pestaña.</small>
      <button class="hb" id="h-si">${ic('pencil-simple-line', 'dt', 30).replace('class="ico"', 'class="ico" style="color:#0f1e3d"')}<span><b>Sí, entrar a corregir</b><em>Segundo sí: queda anotado al instante</em></span>${ic('arrow-square-out', 'bold', 16)}</button>
      <button class="cancelar" data-cerrar>Cancelar</button>`, (h, cerrar) => {
      h.querySelector('#h-si').onclick = async () => {
        const pest = window.open('', '_blank');                  // se abre ya, para que el navegador no la bloquee
        try {
          await rpc('plataforma_entrar_despacho_transaccional', { despacho_id: E.modo });
          if (pest) { pest.opener = null; pest.location.href = APP_COMERCIAL; } else location.assign(APP_COMERCIAL);
          cerrar(); toast('Entró al despacho. Cuando termine, vuelva aquí y toque «Terminar y enviar resumen».'); cargarVivo();
        } catch (e) { if (pest) pest.close(); toast('No se pudo entrar: ' + e.message); }
      };
    });
  };
  const fin = document.getElementById('m-fin'); if (fin) fin.onclick = () => {
    hojaSoporte(`<h4>Terminar el soporte</h4><small>Escriba en pocas palabras qué revisó o qué corrigió. El despacho lo verá en su historial de soporte.</small>
      <textarea id="h-res" maxlength="300" rows="4" placeholder="Ejemplo: Revisé el error al guardar abonos en Cartera y quedó corregido."></textarea><div class="cuenta"><span id="h-n">0</span>/300</div>
      <button class="hb" id="h-env">${ic('paper-plane-tilt', 'dt', 30).replace('class="ico"', 'class="ico" style="color:#b91c1c"')}<span><b>Enviar resumen y salir</b><em>Usted sale del despacho; el permiso sigue hasta que venza</em></span>${ic('caret-right', 'bold', 16)}</button>
      <button class="cancelar" data-cerrar>Cancelar</button>`, (h, cerrar) => {
      const ta = h.querySelector('#h-res'), n = h.querySelector('#h-n');
      ta.oninput = () => { n.textContent = ta.value.length; }; setTimeout(() => ta.focus(), 250);
      h.querySelector('#h-env').onclick = async () => {
        const r = ta.value.trim(); if (r.length < 5) { ta.focus(); return toast('Escriba un resumen corto de lo que hizo.'); }
        const b = h.querySelector('#h-env'); b.disabled = true;
        try { await rpc('dcsoporte_soporte_terminar_transaccional', { id: E.modo, resumen: r }); cerrar(); pararVivo(); E.modo = null; E.soporte = null; vistaSoporte(); toast('Listo: salió del despacho y el resumen quedó en su historial.'); }
        catch (e) { b.disabled = false; toast('No se pudo enviar: ' + e.message); }
      };
    });
  };
}

/* ---------- Buzón (etapa 5): casos que escribe cada despacho, PQRS, errores automáticos y chat del caso ---------- */
const TIPO_CASO = {
  error: ['bug-beetle', '#b91c1c', 'ERROR', 'e-ven'], peticion: ['question', '#1d4ed8', 'PETICIÓN', 'e-prueba'], queja: ['megaphone', '#8a5a00', 'QUEJA', 'e-oro'],
  reclamo: ['megaphone', '#8a5a00', 'RECLAMO', 'e-oro'], sugerencia: ['lightbulb', '#15803d', 'SUGERENCIA', 'e-pago'], felicitacion: ['star', '#c58a12', 'FELICITACIÓN', 'e-oro']
};
const tipoCaso = t => TIPO_CASO[t] || TIPO_CASO.peticion;
const numCaso = id => '#' + String(id).padStart(4, '0');
function cabSoporte(sub) {
  return `<header class="top2"><div class="logo">DC</div><div><b>${E.sopTab === 'buzon' ? 'Buzón de soporte' : 'Soporte'}</b><small>${sub}</small></div>
    <button class="vol" style="margin-left:auto" id="recargar-sop" aria-label="Actualizar">${ic('arrows-clockwise', 'regular', 22)}</button></header>`;
}
function segSoporte() {
  const B = E.buzon, nuevos = B ? B.casos.filter(c => c.estado !== 'cerrado' && c.sin_leer).length : 0;
  return `<div class="seg seg-sop"><button data-stab="buzon" class="${E.sopTab === 'buzon' ? 'on' : ''}">${ic('chat-circle-text', 'dt', 18)}Buzón${nuevos ? ` <i class="pt-num">${nuevos}</i>` : ''}</button><button data-stab="asistencia" class="${E.sopTab === 'asistencia' ? 'on' : ''}">${ic('headset', 'dt', 18)}Asistencia remota</button></div>`;
}
function enlazarSegSoporte() {
  $app.querySelectorAll('[data-stab]').forEach(b => b.onclick = () => { E.sopTab = b.dataset.stab; scrollTo(0, 0); vistaSoporte(); });
  const rc = document.getElementById('recargar-sop'); if (rc) rc.onclick = () => { E.soporte = null; E.buzon = null; vistaSoporte(); };
}
function vistaBuzon() {
  const B = E.buzon, cab = cabSoporte('Casos, errores y PQRS en un lugar');
  if (!B) {
    pintar(cab + `<div class="cuerpo">${segSoporte()}<div class="cargando"></div></div>`); enlazarSegSoporte();
    cargar('buzon', () => rpc('dcsoporte_buzon_transaccional')).then(ok => ok && E.vista === 'soporte' && E.sopTab === 'buzon' && !E.casoId && !E.modo && vistaBuzon());
    return;
  }
  const abiertos = B.casos.filter(c => c.estado !== 'cerrado'), pqrs = abiertos.filter(c => ['peticion', 'queja', 'reclamo'].includes(c.tipo)), cerrados = B.casos.filter(c => c.estado === 'cerrado');
  const tabs = [['abiertos', 'Abiertos', abiertos.length], ['errores', 'Errores', B.errores.length], ['pqrs', 'PQRS', pqrs.length], ['cerrados', 'Cerrados', cerrados.length]];
  const seg2 = `<div class="seg">${tabs.map(([v, t, n]) => `<button data-btab="${v}" class="${E.buzTab === v ? 'on' : ''}">${t}${v !== 'cerrados' ? ' ' + n : ''}</button>`).join('')}</div>`;
  const icT = (n, col, t = 26) => ic(n, 'dt', t).replace('class="ico"', `class="ico" style="color:${col}"`);
  const filaCaso = c => {
    const [icono, col, et, cl] = tipoCaso(c.tipo);
    const dias = c.vence_en && c.estado !== 'cerrado' ? Math.ceil((new Date(c.vence_en) - Date.now()) / 864e5) : null;
    const sub = `${esc(c.despacho)} · ${esc(hace(c.actualizado_en).toLowerCase())}${dias != null ? ` · ${dias > 0 ? 'vence en ' + dias + (dias === 1 ? ' día' : ' días') : '<b class="rojo">vencido</b>'}` : ''}`;
    return `<div class="fl caso" data-caso="${Number(c.id)}">${icT(icono, col)}<p>${numCaso(c.id)} · ${esc(c.asunto)}<small>${sub}</small>${c.ultimo ? `<small class="ult">${esc(c.ultimo)}</small>` : ''}</p>
      <div class="lado">${c.urgente ? '<span class="et e-ven">URGENTE</span>' : `<span class="et ${cl}">${et}</span>`}${c.sin_leer ? `<i class="pt-num">${c.sin_leer}</i>` : c.estado === 'respondido' ? '<small class="resp">Respondido</small>' : ''}</div></div>`;
  };
  const filaError = e => `<div class="fl">${icT('bug-beetle', '#b91c1c')}<p>${esc(e.mensaje || e.tipo)}<small>${e.despachos} ${e.despachos === 1 ? 'despacho' : 'despachos'}, ${e.veces} ${e.veces === 1 ? 'vez' : 'veces'}${e.version ? ' · ' + esc(e.version) : ''}${e.pantalla ? ' · ' + esc(nomMod(e.pantalla)[0]) : ''}</small><small class="ult">${esc((e.nombres || []).join(', '))} · ${esc(hace(e.ultima).toLowerCase())}</small></p><span class="et e-ven">${esc(String(e.tipo || 'ERROR').replace(/_/g, ' ').slice(0, 14))}</span></div>`;
  let lista, vacio;
  if (E.buzTab === 'errores') { lista = B.errores.map(filaError); vacio = 'No hubo errores automáticos en los últimos 7 días.'; }
  else { const L = E.buzTab === 'pqrs' ? pqrs : E.buzTab === 'cerrados' ? cerrados : abiertos; lista = L.map(filaCaso); vacio = E.buzTab === 'cerrados' ? 'No hay casos cerrados en los últimos 60 días.' : 'No hay casos abiertos. Cuando un despacho escriba desde su app, aparece aquí.'; }
  const tarjeta = `<div class="tar buz">${lista.length ? lista.join('') : `<div class="vacio">${icT('check-circle', '#15803d', 24)}${vacio}</div>`}</div>`;
  const nota = E.buzTab === 'errores' ? `<div class="aviso">${ic('bug-beetle', 'dt', 22)}<div>Estos errores los anota la app sola, sin que el despacho escriba nada. Se agrupan por mensaje (últimos 7 días).</div></div>`
    : E.buzTab === 'pqrs' ? `<div class="aviso">${ic('hourglass-medium', 'dt', 22)}<div>Las peticiones, quejas y reclamos deben responderse dentro de 15 días hábiles. Cada caso muestra cuánto le queda.</div></div>` : '';
  pintar(cab + `<div class="cuerpo">${segSoporte()}${seg2}${nota}${tarjeta}</div>`);
  enlazarSegSoporte();
  $app.querySelectorAll('[data-btab]').forEach(b => b.onclick = () => { E.buzTab = b.dataset.btab; vistaBuzon(); });
  $app.querySelectorAll('[data-caso]').forEach(b => b.onclick = () => abrirCaso(Number(b.dataset.caso)));
}
function abrirCaso(id) { pararVivo(); E.vista = 'soporte'; E.casoId = id; E.caso = null; scrollTo(0, 0); render(); }
async function abrirChatDespacho(desp) {
  if (!E.buzon) await cargar('buzon', () => rpc('dcsoporte_buzon_transaccional'));
  const c = E.buzon && E.buzon.casos.find(x => x.despacho_id === desp && x.estado !== 'cerrado');
  if (c) return abrirCaso(c.id);
  toast('Este despacho no tiene casos abiertos. Cuando escriba desde su app, el chat aparece aquí.');
}
async function cargarCaso(silencio) {
  const id = E.casoId;
  try { const r = await rpc('dcsoporte_caso_transaccional', { id }); if (E.casoId !== id) return;
    const cambio = !E.caso || E.caso.mensajes.length !== r.mensajes.length || E.caso.estado !== r.estado; E.caso = r;
    if (E.vista === 'soporte' && (cambio || !silencio) && !document.querySelector('.hoja')) vistaCaso(); }
  catch (e) { if (e.message === 'SIN_SESION') return salir(); if (!silencio) toast('No se pudo cargar: ' + e.message); }
}
function vistaCaso() {
  const C = E.caso && E.caso.id === E.casoId ? E.caso : null;
  const volver = `<button class="vol" id="volver-caso" aria-label="Volver">${ic('caret-left', 'bold', 20)}</button>`;
  if (!relojVivo) { cargarCaso(); relojVivo = setInterval(() => cargarCaso(true), 15000); }
  if (!C) { pintar(`<header class="top2">${volver}<div><b>Caso</b></div></header><div class="cuerpo"><div class="cargando"></div></div>`); enlazarCaso(); return; }
  const [icono, col, et, cl] = tipoCaso(C.tipo);
  const borrador = (document.getElementById('resp') || {}).value || E.borrador || '';
  const cab = `<header class="top2">${volver}<div style="min-width:0"><b class="tit1">${numCaso(C.id)} · ${esc(C.asunto)}</b><small class="sub2">${esc(C.despacho)}${C.modulo ? ' · ' + esc(nomMod(C.modulo)[0]) : ''}${C.version ? ' · v' + esc(C.version) : ''}</small></div>
    <span class="et ${C.estado === 'cerrado' ? 'e-gris' : cl}" style="margin-left:auto">${C.estado === 'cerrado' ? 'CERRADO' : et}</span></header>`;
  const dias = C.vence_en && C.estado !== 'cerrado' ? Math.ceil((new Date(C.vence_en) - Date.now()) / 864e5) : null;
  const avisos = dias != null ? `<div class="aviso">${ic('hourglass-medium', 'dt', 22)}<div>${dias > 0 ? `Debe responder este caso en los próximos <b>${dias} ${dias === 1 ? 'día' : 'días'}</b>.` : '<b>El plazo para responder este caso ya venció.</b> Respóndalo cuanto antes.'}</div></div>` : '';
  let ultDia = '';
  const burbujas = C.mensajes.map(m => {
    const dia = fecha(m.fecha), sep = dia !== ultDia ? `<div class="dia">${esc(dia === fecha(new Date()) ? 'Hoy' : dia)}</div>` : ''; ultDia = dia;
    return `${sep}<div class="msj ${m.autor === 'soporte' ? 'yo' : ''}"><div class="bur"><b>${esc(m.nombre || '')}</b>${esc(m.texto).replace(/\n/g, '<br>')}<small>${esc(hora(m.fecha))}${m.autor === 'soporte' ? (m.leido ? ' · Leído' : ' · Enviado') : ''}</small></div></div>`;
  }).join('');
  const chat = `<div class="tar chat"><h4>${ic(icono, 'dt', 22).replace('class="ico"', `class="ico" style="color:${col}"`)}Chat del caso<a>${C.estado === 'cerrado' ? 'Cerrado' : 'Se actualiza solo'}</a></h4><div class="msjs" id="msjs">${burbujas}</div></div>`;
  const escribir = `<div class="escribir"><textarea id="resp" rows="2" maxlength="2000" placeholder="Escriba su respuesta…">${esc(borrador)}</textarea><button id="enviar" aria-label="Enviar">${ic('paper-plane-tilt', 'dt', 24)}</button></div>`;
  const acc = `<div class="acc">${C.soporte ? `<button class="btn oro" data-modo="${Number(C.despacho_id)}"><span class="cir">${ic('headset', 'bold', 15)}</span>Dar soporte</button>` : `<button class="btn oro" data-pronto="${esc(C.despacho)} no le ha dado permiso de soporte. Pídaselo en el chat: Configuración › Soporte técnico."><span class="cir">${ic('headset', 'bold', 15)}</span>Dar soporte</button>`}
    <button class="btn az" id="cerrar-caso">${ic(C.estado === 'cerrado' ? 'arrow-u-up-left' : 'check-circle', C.estado === 'cerrado' ? 'regular' : 'dt', 20)}${C.estado === 'cerrado' ? 'Reabrir' : 'Cerrar caso'}</button></div>`;
  pintar(cab + `<div class="cuerpo"><div class="ventas-cols caso-cols"><div>${avisos}${chat}</div><div>${escribir}${acc}</div></div></div>`);
  const ms = document.getElementById('msjs'); if (ms) ms.scrollTop = ms.scrollHeight;
  enlazarCaso();
}
function enlazarCaso() {
  const v = document.getElementById('volver-caso'); if (v) v.onclick = () => { pararVivo(); E.casoId = null; E.caso = null; E.buzon = null; E.borrador = ''; vistaSoporte(); };
  const ta = document.getElementById('resp'); if (ta) ta.oninput = () => { E.borrador = ta.value; };
  const en = document.getElementById('enviar'); if (en) en.onclick = async () => {
    const t = ta.value.trim(); if (!t) { ta.focus(); return; }
    en.disabled = true;
    try { await rpc('dcsoporte_caso_responder_transaccional', { id: E.casoId, texto: t }); E.borrador = ''; ta.value = ''; await cargarCaso(); toast('Respuesta enviada. El despacho la ve en su app.'); }
    catch (e) { en.disabled = false; toast('No se pudo enviar: ' + e.message); }
  };
  const cc = document.getElementById('cerrar-caso'); if (cc) cc.onclick = async () => {
    const cerrar = E.caso.estado !== 'cerrado', t = (ta && ta.value.trim()) || '';
    cc.disabled = true;
    try { await rpc('dcsoporte_caso_responder_transaccional', { id: E.casoId, texto: t, estado: cerrar ? 'cerrado' : 'abierto' }); E.borrador = ''; await cargarCaso(); toast(cerrar ? 'Caso cerrado.' : 'Caso reabierto.'); }
    catch (e) { cc.disabled = false; toast('No se pudo: ' + e.message); }
  };
}
function forzarVersion(id, nombre) {
  hojaSoporte(`<h4>¿Forzar la versión nueva?</h4><small>En el próximo minuto, la app de <b>${esc(nombre)}</b> se recarga sola con la versión nueva en todos sus equipos abiertos. No se cierra la sesión. Úselo solo si es urgente: la app ya se actualiza sola cuando cada persona sale y vuelve a entrar.</small>
    <button class="hb" id="h-forzar">${ic('arrows-clockwise', 'dt', 30).replace('class="ico"', 'class="ico" style="color:#c58a12"')}<span><b>Sí, forzar ahora</b><em>Queda anotado en el historial del despacho</em></span>${ic('caret-right', 'bold', 16)}</button>
    <button class="cancelar" data-cerrar>Cancelar</button>`, (h, cerrar) => {
    h.querySelector('#h-forzar').onclick = async () => {
      try { const r = await rpc('dcsoporte_forzar_version_transaccional', { id }); cerrar(); toast(r.conectados ? `Listo. ${r.conectados} ${r.conectados === 1 ? 'equipo se recarga' : 'equipos se recargan'} en el próximo minuto.` : 'Listo. Nadie está conectado ahora; entrarán ya con la versión nueva.'); }
      catch (e) { toast('No se pudo: ' + e.message); }
    };
  });
}

function vistaPronto(v) {
  const P = { ventas: ['chart-line-up', 'Ventas', 'La contabilidad de ventas, renovaciones y anulaciones de Bold llega en la etapa 2.'], soporte: ['lifebuoy', 'Soporte', 'La asistencia remota llega en la etapa 4, y el buzón de errores y PQRS en la etapa 5.'] }[v] || ['gear-six', 'Próximamente', ''];
  pintar(`<header class="top2"><div class="logo">DC</div><div><b>${P[1]}</b><small>En construcción</small></div></header><div class="cuerpo">
    <div class="tar" style="text-align:center;padding:28px 18px">${ic(P[0], 'dt', 56).replace('class="ico"', 'class="ico" style="color:#0f1e3d;margin:0 auto 10px"')}<b style="font-size:16px">${P[1]}</b><div class="nota" style="font-size:13px">${P[2]}</div></div></div>`);
}

/* ---------- arranque ---------- */
async function iniciar() {
  E.vista = 'inicio'; render();
  vigilarInactividad();
  const ok = await cargar('tablero', () => rpc('dcsoporte_tablero_transaccional'));
  if (ok && E.vista === 'inicio') render();
  cargar('despachos', () => rpc('dcsoporte_despachos_transaccional')).then(r => r && E.vista === 'despachos' && !E.det && vistaDespachos());
}
matchMedia('(prefers-color-scheme: light)').addEventListener && matchMedia('(prefers-color-scheme: light)').addEventListener('change', e => {
  let m = 'auto'; try { m = localStorage.getItem('dcsoporte-tema') || 'auto'; } catch (x) { }
  if (m === 'auto') document.documentElement.setAttribute('data-tema', e.matches ? 'claro' : 'oscuro');
});
let anchoPrevio = innerWidth >= 900;
addEventListener('resize', () => { const a = innerWidth >= 900; if (a !== anchoPrevio) { anchoPrevio = a; if (leerSesion()) render(); } });
if (leerSesion()) iniciar(); else pintarEntrada();

// Permite instalar DC Soporte como aplicación (tableta, celular o computador).
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
