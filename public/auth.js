/* Mi Entrenador: inicio de sesión, verificación en dos pasos y conexión con la base de datos.
   Seguridad:
   - Supabase Auth con flujo PKCE. El token de acceso dura poco y se renueva con un token de refresco que rota.
   - Sin registro público: la cuenta se crea desde el panel de Supabase.
   - Verificación en dos pasos (TOTP) obligatoria. La base de datos exige nivel aal2 (ver supabase/schema.sql).
   - Los datos se leen y escriben con las políticas RLS: solo tu usuario ve tus filas.
   - Todo el texto de usuario se pinta con textContent. La CSP bloquea scripts ajenos. */
(function () {
  'use strict';
  var C = window.APP_CONFIG || {};
  var $ = function (id) { return document.getElementById(id); };
  var authEl = $('auth'), shell = $('shell'), navwrap = $('navwrap');
  var LAST_KEY = 'entrenador.lastActive';

  function h(tag, attrs) {
    var e = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      var v = attrs[k];
      if (k === 'class') e.className = v;
      else if (k === 'text') e.textContent = v;
      else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), v);
      else if (v === true) e.setAttribute(k, '');
      else if (v !== false && v != null) e.setAttribute(k, v);
    }
    for (var i = 2; i < arguments.length; i++) {
      var c = arguments[i]; if (c == null || c === false) continue;
      e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    }
    return e;
  }
  function pantalla() {
    shell.classList.add('hide'); navwrap.classList.add('hide'); authEl.classList.remove('hide');
    var kids = Array.prototype.slice.call(arguments);
    authEl.replaceChildren.apply(authEl, [h('img', { class: 'logo', src: 'icon-192.png', alt: '' }), h('h1', { text: 'Mi Entrenador' })].concat(kids));
    var first = authEl.querySelector('input'); if (first) first.focus();
  }
  function aviso(texto) { pantalla(h('p', { class: 'mut', text: texto })); }

  if (!window.supabase || !C.SUPABASE_URL || /TU-PROYECTO/.test(C.SUPABASE_URL) || /TU-ANON/.test(C.SUPABASE_ANON_KEY || '')) {
    aviso('Falta configurar config.js con la URL y la anon key de tu proyecto de Supabase.'); return;
  }
  var sb = window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY, {
    auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });

  /* ---------- inactividad ---------- */
  var idleMs = (Number(C.IDLE_MINUTES) || 0) * 60000, lastWrite = 0, timer = null;
  function tocar() {
    var n = Date.now(); if (n - lastWrite < 15000) return; lastWrite = n;
    try { localStorage.setItem(LAST_KEY, String(n)); } catch (e) {}
  }
  function inactivo() {
    if (!idleMs) return false;
    var l = 0; try { l = Number(localStorage.getItem(LAST_KEY)) || 0; } catch (e) {}
    return l > 0 && Date.now() - l > idleMs;
  }
  function vigilar() {
    if (!idleMs) return;
    ['click', 'keydown', 'touchstart', 'visibilitychange'].forEach(function (ev) { document.addEventListener(ev, function () { if (ev === 'visibilitychange' && document.hidden) return; if (inactivo()) { sb.auth.signOut(); } else tocar(); }, { passive: true }); });
    clearInterval(timer); timer = setInterval(function () { if (inactivo()) sb.auth.signOut(); }, 30000);
  }

  /* ---------- pantallas ---------- */
  var fallos = 0, bloqueoHasta = 0;
  function pantallaLogin(nota) {
    var email = h('input', { type: 'email', id: 'em', autocomplete: 'username', required: true, maxlength: '254', placeholder: 'tu correo' });
    var pass = h('input', { type: 'password', id: 'pw', autocomplete: 'current-password', required: true, maxlength: '200', placeholder: 'contraseña' });
    var err = h('div', { class: 'err', role: 'alert', text: nota || '' });
    var btn = h('button', { class: 'p', type: 'submit', text: 'Entrar' });
    var form = h('form', null,
      h('label', { for: 'em' }, 'Correo', email), h('label', { for: 'pw' }, 'Contraseña', pass), err, btn,
      h('button', { class: 'link', type: 'button', text: 'Olvidé mi contraseña', onclick: function () { pantallaRecuperar(email.value.trim()); } }));
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      if (Date.now() < bloqueoHasta) { err.textContent = 'Espera ' + Math.ceil((bloqueoHasta - Date.now()) / 1000) + ' segundos para intentar otra vez.'; return; }
      btn.disabled = true; err.textContent = '';
      sb.auth.signInWithPassword({ email: email.value.trim(), password: pass.value }).then(function (r) {
        pass.value = '';
        if (r.error) {
          fallos++; if (fallos >= 3) bloqueoHasta = Date.now() + Math.min(300, 30 * (fallos - 2)) * 1000;
          err.textContent = 'Correo o contraseña incorrectos.'; btn.disabled = false; return;
        }
        fallos = 0; tocar(); route();
      }).catch(function () { err.textContent = 'No se pudo conectar. Revisa tu internet.'; btn.disabled = false; });
    });
    pantalla(form);
  }
  var ultimoEnvio = 0;
  function pantallaRecuperar(correoInicial) {
    var email = h('input', { type: 'email', id: 'rem', autocomplete: 'username', required: true, maxlength: '254', placeholder: 'tu correo', value: correoInicial || '' });
    var err = h('div', { class: 'err', role: 'alert' });
    var ok = h('p', { class: 'mut', role: 'status' });
    var btn = h('button', { class: 'p', type: 'submit', text: 'Enviar enlace' });
    var form = h('form', null,
      h('p', { class: 'mut', text: 'Confirma tu correo y te enviaremos un enlace para cambiar la contraseña.' }),
      h('label', { for: 'rem' }, 'Correo', email), err, ok, btn,
      h('button', { class: 'link', type: 'button', text: 'Volver a iniciar sesión', onclick: function () { pantallaLogin(); } }));
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var espera = 60000 - (Date.now() - ultimoEnvio);
      if (espera > 0) { err.textContent = 'Espera ' + Math.ceil(espera / 1000) + ' segundos para pedir otro enlace.'; return; }
      var correo = email.value.trim(); if (!correo) return;
      btn.disabled = true; err.textContent = ''; ok.textContent = '';
      ultimoEnvio = Date.now();
      sb.auth.resetPasswordForEmail(correo, { redirectTo: location.origin + location.pathname }).then(function () {
        ok.textContent = 'Si el correo existe, te enviamos un enlace. Revisa tu bandeja (y el spam).'; btn.disabled = false;
      }).catch(function () { err.textContent = 'No se pudo enviar. Inténtalo más tarde.'; btn.disabled = false; });
    });
    pantalla(form);
  }
  function campoCodigo() { return h('input', { type: 'text', id: 'cod', inputmode: 'numeric', pattern: '[0-9]{6}', maxlength: '6', autocomplete: 'one-time-code', required: true, placeholder: '123456' }); }
  function pantallaMfa(factorId) {
    var cod = campoCodigo(), err = h('div', { class: 'err', role: 'alert' }), btn = h('button', { class: 'p', type: 'submit', text: 'Verificar' });
    var form = h('form', null, h('p', { class: 'mut', text: 'Escribe el código de 6 dígitos de tu app de autenticación.' }), h('label', { for: 'cod' }, 'Código', cod), err, btn,
      h('button', { class: 'link', type: 'button', text: 'Cancelar', onclick: function () { sb.auth.signOut(); } }));
    form.addEventListener('submit', function (ev) {
      ev.preventDefault(); btn.disabled = true; err.textContent = '';
      sb.auth.mfa.challengeAndVerify({ factorId: factorId, code: cod.value.trim() }).then(function (r) {
        if (r.error) { err.textContent = 'Código incorrecto o vencido.'; btn.disabled = false; cod.value = ''; return; }
        route();
      }).catch(function () { err.textContent = 'No se pudo verificar.'; btn.disabled = false; });
    });
    pantalla(form);
  }
  function pantallaEnroll() {
    pantalla(h('p', { class: 'mut', text: 'Preparando la verificación en dos pasos...' }));
    sb.auth.mfa.listFactors().then(function (r) {
      var sinVerificar = ((r.data && r.data.all) || []).filter(function (f) { return f.status !== 'verified'; });
      return Promise.all(sinVerificar.map(function (f) { return sb.auth.mfa.unenroll({ factorId: f.id }); }));
    }).then(function () {
      return sb.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Entrenador ' + Date.now() });
    }).then(function (r) {
      if (r.error) throw r.error;
      var f = r.data, cod = campoCodigo(), err = h('div', { class: 'err', role: 'alert' }), btn = h('button', { class: 'p', type: 'submit', text: 'Activar' });
      var form = h('form', null,
        h('p', { text: 'Activa la verificación en dos pasos. Es obligatoria.' }),
        h('p', { class: 'mut small', text: '1. Abre una app de autenticación (Apple Contraseñas, Google Authenticator, 1Password) y escanea el código.' }),
        h('img', { class: 'qr', src: f.totp.qr_code, alt: 'Código QR para tu app de autenticación' }),
        h('p', { class: 'mut small', text: 'Si no puedes escanear, escribe esta clave a mano. Guárdala en tu gestor de contraseñas: con ella recuperas el acceso si pierdes el teléfono.' }),
        h('code', { text: f.totp.secret }),
        h('p', { class: 'mut small', text: '2. Escribe el código de 6 dígitos que muestra la app.' }),
        h('label', { for: 'cod' }, 'Código', cod), err, btn,
        h('button', { class: 'link', type: 'button', text: 'Cancelar', onclick: function () { sb.auth.signOut(); } }));
      form.addEventListener('submit', function (ev) {
        ev.preventDefault(); btn.disabled = true; err.textContent = '';
        sb.auth.mfa.challengeAndVerify({ factorId: f.id, code: cod.value.trim() }).then(function (x) {
          if (x.error) { err.textContent = 'Código incorrecto. Revisa la hora de tu teléfono y vuelve a intentar.'; btn.disabled = false; cod.value = ''; return; }
          route();
        });
      });
      pantalla(form);
    }).catch(function () { pantalla(h('p', { class: 'err', text: 'No se pudo preparar la verificación. Recarga la página.' })); });
  }
  function pantallaNuevaClave() {
    var a = h('input', { type: 'password', id: 'n1', autocomplete: 'new-password', required: true, minlength: '12', maxlength: '200' });
    var b = h('input', { type: 'password', id: 'n2', autocomplete: 'new-password', required: true, minlength: '12', maxlength: '200' });
    var err = h('div', { class: 'err', role: 'alert' }), btn = h('button', { class: 'p', type: 'submit', text: 'Guardar contraseña' });
    var form = h('form', null, h('p', { class: 'mut', text: 'Elige una contraseña nueva de al menos 12 caracteres.' }),
      h('label', { for: 'n1' }, 'Contraseña nueva', a), h('label', { for: 'n2' }, 'Repítela', b), err, btn);
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      if (a.value.length < 12) { err.textContent = 'Usa al menos 12 caracteres.'; return; }
      if (a.value !== b.value) { err.textContent = 'Las contraseñas no coinciden.'; return; }
      btn.disabled = true;
      sb.auth.updateUser({ password: a.value }).then(function (r) {
        a.value = b.value = '';
        if (r.error) { err.textContent = 'No se pudo cambiar la contraseña. Pide otro enlace.'; btn.disabled = false; return; }
        route();
      });
    });
    pantalla(form);
  }

  /* ---------- base de datos (tabla docs con RLS) ---------- */
  function makeDb(uid) {
    var rows = new Map(), subs = [];
    function notify() { subs.slice().forEach(function (s) { s.fire(); }); }
    function snapDoc(path) { var has = rows.has(path); return { id: path.split('/').pop(), exists: has, data: function () { return has ? rows.get(path) : undefined; } }; }
    function snapCol(col) {
      var docs = [];
      rows.forEach(function (v, k) { var i = k.indexOf('/'); if (k.slice(0, i) === col && k.indexOf('/', i + 1) < 0) docs.push({ id: k.slice(i + 1), exists: true, data: function () { return v; } }); });
      return { docs: docs, size: docs.length, empty: !docs.length };
    }
    function register(fire) { var s = { fire: fire }; subs.push(s); fire(); return function () { subs = subs.filter(function (x) { return x !== s; }); }; }
    function load() {
      return sb.from('docs').select('path,data').then(function (r) {
        if (r.error) throw r.error;
        rows = new Map((r.data || []).map(function (x) { return [x.path, x.data]; })); notify();
      });
    }
    return {
      load: load,
      dispose: function () { subs = []; rows = new Map(); },
      doc: function (path) {
        return {
          set: function (data) {
            return sb.from('docs').upsert({ user_id: uid, path: path, data: data }, { onConflict: 'user_id,path' }).then(function (r) { if (r.error) throw r.error; rows.set(path, data); notify(); });
          },
          delete: function () {
            return sb.from('docs').delete().eq('user_id', uid).eq('path', path).then(function (r) { if (r.error) throw r.error; rows.delete(path); notify(); });
          },
          onSnapshot: function (next) { return register(function () { next(snapDoc(path)); }); }
        };
      },
      collection: function (col) { return { onSnapshot: function (next) { return register(function () { next(snapCol(col)); }); } }; }
    };
  }

  /* ---------- coach (función en el servidor, la llave de Anthropic nunca llega aquí) ---------- */
  function makeSample() {
    function llamar(input, json) {
      var msgs = typeof input === 'string' ? [{ role: 'user', content: input }] : input;
      return sb.auth.getSession().then(function (r) {
        var s = r.data && r.data.session; if (!s) throw { code: 'not_granted' };
        return fetch(C.SUPABASE_URL + '/functions/v1/coach', {
          method: 'POST', credentials: 'omit', referrerPolicy: 'no-referrer',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + s.access_token, 'apikey': C.SUPABASE_ANON_KEY },
          body: JSON.stringify({ messages: msgs, json: !!json })
        });
      }).then(function (res) {
        if (res.status === 429) throw { code: 'rate_limited' };
        if (res.status === 401 || res.status === 403) throw { code: 'not_granted' };
        if (!res.ok) throw { code: 'unavailable' };
        return res.json();
      }).then(function (j) { return String(j.text || ''); });
    }
    var f = function (input) { return llamar(input, false).then(function (t) { return { text: t, truncated: false }; }); };
    f.json = function (input) {
      return llamar(input, true).then(function (t) {
        var a = t.indexOf('{'), b = t.lastIndexOf('}'); if (a < 0 || b < a) throw { code: 'bad_json' };
        return JSON.parse(t.slice(a, b + 1));
      });
    };
    return f;
  }

  function makeGymSearch() {
    return function (q) {
      return sb.auth.getSession().then(function (r) {
        var s = r.data && r.data.session; if (!s) throw { code: 'not_granted' };
        return fetch(C.SUPABASE_URL + '/functions/v1/coach', {
          method: 'POST', credentials: 'omit', referrerPolicy: 'no-referrer',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + s.access_token, 'apikey': C.SUPABASE_ANON_KEY },
          body: JSON.stringify({ action: 'gym_search', q: String(q).slice(0, 100) })
        });
      }).then(function (res) { if (!res.ok) throw { code: 'unavailable' }; return res.json(); })
        .then(function (j) { return Array.isArray(j.results) ? j.results : []; });
    };
  }
  var descargas = {
    save: function (o) {
      var url = URL.createObjectURL(new Blob([o.data], { type: 'application/json' }));
      var a = h('a', { href: url, download: o.filename }); document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 2000); return Promise.resolve();
    }
  };

  /* ---------- entrada a la app ---------- */
  var dbActual = null, entrando = false;
  function salirDeApp() {
    if (dbActual) { dbActual.dispose(); dbActual = null; }
    window.EntrenadorApp.stop();
  }
  function entrar(session) {
    if (entrando) return; entrando = true;
    var db = makeDb(session.user.id);
    db.load().then(function () {
      dbActual = db; authEl.classList.add('hide'); authEl.replaceChildren();
      shell.classList.remove('hide'); navwrap.classList.remove('hide');
      window.EntrenadorApp.start({
        db: db, sample: makeSample(), gymSearch: makeGymSearch(), descargas: descargas,
        account: { email: session.user.email || '', signOut: function () { return sb.auth.signOut(); }, signOutAll: function () { return sb.auth.signOut({ scope: 'global' }); } }
      });
      window.EntrenadorApp.status('Guardado en línea');
    }).catch(function () { pantalla(h('p', { class: 'err', text: 'No se pudieron cargar tus datos. Recarga la página.' })); })
      .then(function () { entrando = false; });
  }
  function route() {
    sb.auth.getSession().then(function (r) {
      var s = r.data && r.data.session;
      if (!s) { salirDeApp(); return pantallaLogin(); }
      return sb.auth.mfa.getAuthenticatorAssuranceLevel().then(function (a) {
        var lvl = a.data && a.data.currentLevel;
        if (lvl === 'aal2') return entrar(s);
        salirDeApp();
        return sb.auth.mfa.listFactors().then(function (f) {
          var ok = ((f.data && f.data.totp) || []).filter(function (x) { return x.status === 'verified'; });
          if (ok.length) return pantallaMfa(ok[0].id);
          return pantallaEnroll();
        });
      });
    }).catch(function () { pantallaLogin('No se pudo conectar. Revisa tu internet.'); });
  }

  sb.auth.onAuthStateChange(function (event) {
    if (event === 'PASSWORD_RECOVERY') { setTimeout(pantallaNuevaClave, 0); return; }
    if (event === 'SIGNED_OUT') {
      try { localStorage.removeItem(LAST_KEY); } catch (e) {}
      setTimeout(route, 0);
    }
  });

  /* arranque: si pasó demasiado tiempo sin usar la app, se cierra la sesión antes de mostrar nada */
  vigilar();
  if (inactivo()) { sb.auth.signOut().then(function () { route(); }); } else { route(); }
  window.addEventListener('pageshow', function (e) { if (e.persisted) route(); });
})();
