/* DC Soporte · «Entrar con huella», igual que en la app del celular (modelos aprobados por Darío el 28-29/10/2026).
   Solo en celular o tableta con huella o cara. La huella nunca sale del equipo: el equipo guarda la llave y firma;
   la función «huella» de Supabase revisa la firma y entrega una sesión normal. Después, cada consulta de DC Soporte
   vuelve a exigir la cuenta de plataforma en el servidor, así que una huella de otra cuenta no ve nada. */
'use strict';
(function () {
  const FUNCION = 'https://okvxxppudwbcldxpxyfw.supabase.co/functions/v1/huella';
  const LLAVE_PUB = 'sb_publishable_oDR8SiWeo1owprP7to2azQ_S30AT_8Y';
  const K = 'dcsoporte-huella';
  const b64 = b => btoa(String.fromCharCode.apply(null, new Uint8Array(b))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const deb = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), c => c.charCodeAt(0));
  const leer = k => { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } };
  const guardar = (k, v) => { try { if (v) localStorage.setItem(k, v); else localStorage.removeItem(k); } catch (e) { } };

  // Solo celulares y tabletas (Android, iPhone, iPad) con huella o reconocimiento de la cara.
  const ua = navigator.userAgent;
  const esCelular = /Android|iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  const disponible = esCelular && window.PublicKeyCredential && PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable
    ? PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable().catch(() => false) : Promise.resolve(false);

  const activaAqui = () => !!leer(K);
  function quien() { try { return JSON.parse(leer(K + '-quien') || '{}'); } catch (e) { return {}; } }
  function olvidar() { guardar(K, ''); guardar(K + '-quien', ''); }

  // Si el servidor no responde a tiempo se avisa, en vez de quedarse pegado.
  async function llamar(cuerpo, token, segundos) {
    const h = { 'Content-Type': 'application/json', apikey: LLAVE_PUB };
    if (token) h.Authorization = 'Bearer ' + token;
    const corte = new AbortController();
    const reloj = setTimeout(() => corte.abort(), (segundos || 15) * 1000);
    try {
      const r = await fetch(FUNCION, { method: 'POST', headers: h, body: JSON.stringify(cuerpo), signal: corte.signal });
      const j = await r.json().catch(() => ({ error: 'Sin respuesta del servidor.' }));
      j.estado = r.status;
      return j;
    } catch (e) {
      return { error: 'La conexión está lenta. Toque otra vez la huella o entre con su contraseña.', estado: 0 };
    } finally { clearTimeout(reloj); }
  }

  // El reto se pide ANTES del toque (al mostrar la pantalla): así la huella sale al instante, y el iPhone,
  // que solo deja pedir la huella justo después del toque, nunca se queda sin mostrarla.
  const RETO_VIGENTE = 4 * 60 * 1000; // el servidor lo acepta 5 minutos
  let reto = null, pidiendo = null;
  const retoFresco = () => reto && Date.now() - reto.en < RETO_VIGENTE ? reto.op : null;
  function prepararReto() {
    if (retoFresco() || pidiendo) return pidiendo;
    pidiendo = llamar({ accion: 'entrada_opciones' }).then(op => { if (!op.error && op.challenge) reto = { op, en: Date.now() }; return op; })
      .finally(() => { pidiendo = null; });
    return pidiendo;
  }

  /** Pide la huella y devuelve { access_token, refresh_token }. Devuelve null si la persona canceló. */
  async function entrar() {
    let op = retoFresco(); reto = null; // cada reto sirve una sola vez
    if (!op) { const r0 = await prepararReto(); op = retoFresco(); reto = null; if (!op) throw new Error((r0 && r0.error) || 'No se pudo preparar la huella. Inténtelo de nuevo.'); }
    const guardada = leer(K);
    let permitidas = [];
    try { if (guardada.length > 1) permitidas = [{ id: deb(guardada), type: 'public-key', transports: ['internal'] }]; } catch (e) { }
    let cred;
    try {
      cred = await navigator.credentials.get({ publicKey: { challenge: deb(op.challenge), rpId: op.rpId, timeout: 60000, userVerification: 'required',
        allowCredentials: permitidas } });
    } catch (e) {
      if (e && (e.name === 'NotAllowedError' || e.name === 'AbortError')) return null;
      throw new Error('No se pudo usar la huella. Entre con su contraseña.');
    }
    if (api.alFirmar) api.alFirmar();
    const r = cred.response;
    const v = await llamar({ accion: 'entrada_verificar', respuesta: { id: cred.id, rawId: b64(cred.rawId), type: cred.type, clientExtensionResults: {}, response: {
      clientDataJSON: b64(r.clientDataJSON), authenticatorData: b64(r.authenticatorData), signature: b64(r.signature), userHandle: r.userHandle ? b64(r.userHandle) : undefined } } }, null, 30);
    if (v.error) { if (v.estado === 404) olvidar(); const e = new Error(v.error); e.estado = v.estado; throw e; }
    if (!v.access_token || !v.refresh_token) throw new Error('No se pudo abrir la sesión. Entre con su contraseña.');
    return v;
  }

  /** Activa la huella en este equipo (con la sesión ya abierta y comprobada como plataforma). */
  async function activar(token, nombre, correo) {
    const op = await llamar({ accion: 'registro_opciones' }, token);
    if (op.error) throw new Error(op.error);
    let cred;
    try {
      cred = await navigator.credentials.create({ publicKey: {
        challenge: deb(op.challenge), rp: op.rp, user: { id: deb(op.user.id), name: op.user.name, displayName: op.user.displayName || op.user.name },
        pubKeyCredParams: op.pubKeyCredParams, timeout: op.timeout, attestation: 'none', authenticatorSelection: op.authenticatorSelection,
        excludeCredentials: (op.excludeCredentials || []).map(c => ({ id: deb(c.id), type: 'public-key', transports: c.transports })) } });
    } catch (e) {
      // Este equipo ya tenía una huella para esta cuenta (por ejemplo, de la app del celular): queda activa aquí.
      if (e && e.name === 'InvalidStateError') { recordar('1', nombre, correo); return true; }
      if (e && (e.name === 'NotAllowedError' || e.name === 'AbortError')) return false;
      throw new Error('Este equipo no permitió activar la huella.');
    }
    const r = cred.response;
    const equipo = /iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) ? 'iPad · DC Soporte' : /iPhone/.test(ua) ? 'iPhone · DC Soporte' : /Android/.test(ua) ? 'Android · DC Soporte' : 'DC Soporte';
    const v = await llamar({ accion: 'registro_verificar', equipo, respuesta: { id: cred.id, rawId: b64(cred.rawId), type: cred.type, clientExtensionResults: {}, response: {
      clientDataJSON: b64(r.clientDataJSON), attestationObject: b64(r.attestationObject), transports: r.getTransports ? r.getTransports() : [] } } }, token);
    if (v.error) throw new Error(v.error);
    recordar(cred.id, nombre, correo);
    return true;
  }
  function recordar(id, nombre, correo) {
    guardar(K, id); guardar(K + '-no', '');
    guardar(K + '-quien', JSON.stringify({ nombre: nombre || '', correo: correo || '' }));
  }

  /** Apaga la huella en este equipo: se borra aquí y en el servidor. */
  async function quitar(token) {
    const id = leer(K);
    olvidar();
    if (token && id.length > 1) await llamar({ accion: 'quitar', credencial_id: id }, token).catch(() => { });
  }

  const api = {
    disponible: () => disponible, activaAqui, quien, olvidar, prepararReto, entrar, activar, quitar, alFirmar: null,
    yaRespondio: () => !!leer(K + '-no'), noQuiere: () => guardar(K + '-no', '1'),
  };
  window.DCHuella = api;
})();
