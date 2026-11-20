/* Ejercicios ilustrados: figura humana sin rostro, dibujada por código (SVG), 2 a 3 posiciones por ejercicio.
   Cada posición son ángulos en grados medidos desde "abajo" (0 = hacia el piso, + = hacia adelante, la figura mira a la derecha):
   t torso (desde "arriba"), a/b brazo y antebrazo, c/d muslo y espinilla, l2 = segunda pierna [muslo, espinilla], e = pie. */
(function () {
  var NS = 'http://www.w3.org/2000/svg';
  var LEN = { t: 32, u: 18, f: 17, th: 26, sh: 26, hd: 7, ft: 9 };
  var COL = { body: '#D9E2F2', far: '#7E92B8', arm: '#9DB6E8', acc: '#FF6A00', floor: '#2B3A5C', bench: '#4A5E87' };
  function rad(d) { return d * Math.PI / 180; }
  function add(p, a, len) { return [p[0] + Math.sin(rad(a)) * len, p[1] + Math.cos(rad(a)) * len]; }

  function pose(f) {
    var hip = [0, 0], tt = f.t || 0, hd = tt + (f.hd || 0);
    var S = [Math.sin(rad(tt)) * LEN.t, -Math.cos(rad(tt)) * LEN.t];
    var H = [S[0] + Math.sin(rad(hd)) * (LEN.hd + 5), S[1] - Math.cos(rad(hd)) * (LEN.hd + 5)];
    var E = add(S, f.a || 0, LEN.u), W = add(E, f.b || 0, LEN.f);
    var K = add(hip, f.c || 0, LEN.th), A = add(K, f.d || 0, LEN.sh);
    var e = rad(f.e || 0), F = [A[0] + Math.cos(e) * LEN.ft, A[1] + Math.sin(e) * LEN.ft];
    var o = { hip: hip, S: S, H: H, E: E, W: W, K: K, A: A, F: F };
    if (f.l2) { o.K2 = add(hip, f.l2[0], LEN.th); o.A2 = add(o.K2, f.l2[1], LEN.sh); o.F2 = [o.A2[0] + LEN.ft, o.A2[1]]; }
    return o;
  }
  function shift(o, dx, dy) { var r = {}; for (var k in o) r[k] = [o[k][0] + dx, o[k][1] + dy]; return r; }
  // Coloca la figura: con los pies en el piso, o con la cadera fija si la posición es acostada/sentada.
  function colocar(f) {
    var o = pose(f), floor;
    if (f.hip) { floor = f.floor != null ? f.floor : Math.max(o.A[1], o.F[1]) + 1; return { o: o, floor: floor }; }
    var low = Math.max(o.A[1], o.F[1], o.A2 ? o.A2[1] : -1e9, o.F2 ? o.F2[1] : -1e9);
    o = shift(o, -o.A[0], -low); return { o: o, floor: 1 };
  }
  function el(n, at) { var e = document.createElementNS(NS, n); for (var k in at) e.setAttribute(k, at[k]); return e; }
  function seg(g, p, q, w, c) { g.appendChild(el('line', { x1: p[0], y1: p[1], x2: q[0], y2: q[1], stroke: c, 'stroke-width': w, 'stroke-linecap': 'round' })); }
  function eq(g, items, o) {
    (items || []).forEach(function (it) {
      var p = it.at ? o[it.at] : o.hip;
      if (it.k === 'db') g.appendChild(el('rect', { x: p[0] - 7, y: p[1] - 3.2, width: 14, height: 6.4, rx: 2.5, fill: COL.acc }));
      else if (it.k === 'plate') { g.appendChild(el('circle', { cx: p[0], cy: p[1], r: 9, fill: 'none', stroke: COL.acc, 'stroke-width': 3 })); g.appendChild(el('circle', { cx: p[0], cy: p[1], r: 2, fill: COL.acc })); }
      else if (it.k === 'bench') g.appendChild(el('rect', { x: o.hip[0] + (it.x1 != null ? it.x1 : -34), y: o.hip[1] + 7, width: (it.x2 != null ? it.x2 : 46) - (it.x1 != null ? it.x1 : -34), height: 5, rx: 2, fill: COL.bench }));
      else if (it.k === 'cable') { seg(g, p, [p[0] + it.to[0], p[1] + it.to[1]], 1.6, COL.acc); }
      else if (it.k === 'plat') g.appendChild(el('rect', { x: p[0] + (it.dx || 2), y: p[1] - 18, width: 5, height: 36, rx: 2, fill: COL.bench }));
      else if (it.k === 'pad') g.appendChild(el('rect', { x: p[0] - 3, y: p[1] - 4, width: 6, height: 8, rx: 3, fill: COL.acc }));
    });
  }
  function dibujar(f, vb) {
    var c = colocar(f), o = c.o, g = el('g', {});
    var svg = el('svg', { viewBox: vb.join(' '), class: 'ej-fig', role: 'img', 'aria-hidden': 'true', focusable: 'false' });
    svg.appendChild(el('line', { x1: vb[0], y1: c.floor, x2: vb[0] + vb[2], y2: c.floor, stroke: COL.floor, 'stroke-width': 1.5 }));
    eq(g, (f.eq || []).filter(function (i) { return i.k === 'bench' || i.k === 'plat'; }), o);
    if (o.K2) { seg(g, o.hip, o.K2, 7, COL.far); seg(g, o.K2, o.A2, 7, COL.far); seg(g, o.A2, o.F2, 5, COL.far); }
    seg(g, o.hip, o.K, 8.5, COL.body); seg(g, o.K, o.A, 7.5, COL.body); seg(g, o.A, o.F, 5.5, COL.body);
    seg(g, o.hip, o.S, 12, COL.body);
    g.appendChild(el('circle', { cx: o.H[0], cy: o.H[1], r: LEN.hd, fill: COL.body }));
    seg(g, o.S, o.E, 6.5, COL.arm); seg(g, o.E, o.W, 5.5, COL.arm);
    eq(g, (f.eq || []).filter(function (i) { return i.k !== 'bench' && i.k !== 'plat'; }), o);
    svg.appendChild(g); return svg;
  }
  function caja(frames) {
    var x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    frames.forEach(function (f) {
      var c = colocar(f), o = c.o;
      for (var k in o) { x0 = Math.min(x0, o[k][0]); x1 = Math.max(x1, o[k][0]); y0 = Math.min(y0, o[k][1]); y1 = Math.max(y1, o[k][1]); }
      y1 = Math.max(y1, c.floor);
    });
    var pad = 14; x0 -= pad + 6; x1 += pad + 6; y0 -= pad; y1 += 6;
    var w = x1 - x0, h = y1 - y0, side = Math.max(w, h * 0.9);   // marco casi cuadrado para todas las posiciones
    var cx = (x0 + x1) / 2; x0 = cx - side / 2; w = side; h = Math.max(h, side * 0.9);
    return [Math.round(x0), Math.round(y1 - h), Math.round(w), Math.round(h)];
  }

  var BENCH = { k: 'bench' }, SEAT = { k: 'bench', x1: -14, x2: 16 }, SEATREC = { k: 'bench', x1: -38, x2: 4 };
  var LISTA = [
    { id: 'sentadilla', nombre: 'Sentadilla', alias: ['sentadilla', 'goblet', 'squat'], tip: 'Pies al ancho de hombros, rodillas hacia donde miran los pies y espalda recta. Baja hasta que los muslos queden casi paralelos al piso.',
      frames: [
        { cap: 'Inicio', t: 0, a: 35, b: 135, c: 0, d: 0, eq: [{ k: 'db', at: 'W' }] },
        { cap: 'Abajo', t: 38, a: 35, b: 135, c: 85, d: -30, eq: [{ k: 'db', at: 'W' }] }] },
    { id: 'peso-muerto', nombre: 'Peso muerto rumano', alias: ['peso muerto', 'rumano'], tip: 'Rodillas casi estiradas, lleva la cadera hacia atrás con la espalda recta y baja la barra pegada a las piernas. Sube empujando la cadera al frente.',
      frames: [
        { cap: 'Inicio', t: 0, a: 4, b: 4, c: 0, d: 0, eq: [{ k: 'plate', at: 'W' }] },
        { cap: 'Abajo', t: 72, a: 8, b: 0, c: 14, d: -4, eq: [{ k: 'plate', at: 'W' }] }] },
    { id: 'zancada', nombre: 'Zancada', alias: ['zancada', 'desplante', 'lunge'], tip: 'Da un paso largo, baja la rodilla de atrás hacia el piso y mantén el torso erguido. Empuja con el pie de adelante para volver.',
      frames: [
        { cap: 'Inicio', t: 0, a: 4, b: 4, c: 0, d: 0 },
        { cap: 'Abajo', t: 0, a: 4, b: 4, c: 82, d: -4, l2: [-28, -105] }] },
    { id: 'press-pecho', nombre: 'Press de pecho', alias: ['press de pecho', 'press plano', 'press banca', 'press con mancuernas'], tip: 'Acostado en el banco, baja las mancuernas hasta que los codos queden un poco por debajo del pecho y empuja hacia arriba sin bloquear los codos.',
      frames: [
        { cap: 'Arriba', hip: true, floor: 24, t: 90, c: -108, d: -22, a: 180, b: 180, eq: [BENCH, { k: 'db', at: 'W' }] },
        { cap: 'Abajo', hip: true, floor: 24, t: 90, c: -108, d: -22, a: 45, b: 175, eq: [BENCH, { k: 'db', at: 'W' }] }] },
    { id: 'remo-mancuerna', nombre: 'Remo con mancuerna', alias: ['remo con mancuerna', 'remo inclinado', 'remo con barra'], tip: 'Torso casi paralelo al piso y espalda recta. Lleva la mancuerna hacia la cadera llevando el codo hacia atrás, sin girar el tronco.',
      frames: [
        { cap: 'Inicio', t: 72, a: 4, b: 0, c: 14, d: -8, eq: [{ k: 'db', at: 'W' }] },
        { cap: 'Arriba', t: 72, a: -62, b: -8, c: 14, d: -8, eq: [{ k: 'db', at: 'W' }] }] },
    { id: 'press-hombro', nombre: 'Press de hombro', alias: ['press de hombro', 'press militar', 'press arnold'], tip: 'Mancuernas a la altura de los hombros, abdomen firme. Empuja hacia arriba sin arquear la espalda y baja con control.',
      frames: [
        { cap: 'Inicio', t: 0, a: 20, b: 168, c: 0, d: 0, eq: [{ k: 'db', at: 'W' }] },
        { cap: 'Arriba', t: 0, a: 172, b: 176, c: 0, d: 0, eq: [{ k: 'db', at: 'W' }] }] },
    { id: 'curl-biceps', nombre: 'Curl de bíceps', alias: ['curl de biceps', 'curl con mancuerna', 'curl biceps', 'curl con barra'], tip: 'Codos pegados al cuerpo. Sube la mancuerna sin balancear el torso y baja despacio hasta estirar el brazo.',
      frames: [
        { cap: 'Inicio', t: 0, a: 0, b: 0, c: 0, d: 0, eq: [{ k: 'db', at: 'W' }] },
        { cap: 'Arriba', t: 0, a: 4, b: 148, c: 0, d: 0, eq: [{ k: 'db', at: 'W' }] }] },
    { id: 'triceps-cabeza', nombre: 'Extensión de tríceps', alias: ['triceps', 'extension de triceps', 'press frances'], tip: 'Codos apuntando al techo y cerca de la cabeza. Baja la mancuerna detrás de la cabeza y estira los brazos sin mover los codos.',
      frames: [
        { cap: 'Arriba', t: 0, a: 176, b: 176, c: 0, d: 0, eq: [{ k: 'db', at: 'W' }] },
        { cap: 'Abajo', t: 0, a: 176, b: -22, c: 0, d: 0, eq: [{ k: 'db', at: 'W' }] }] },
    { id: 'jalon-pecho', nombre: 'Jalón al pecho', alias: ['jalon', 'jalón al pecho', 'dominadas asistidas', 'lat pulldown'], tip: 'Sentado con el pecho erguido, jala la barra hacia la parte alta del pecho llevando los codos hacia abajo y atrás. Sube controlando.',
      frames: [
        { cap: 'Arriba', hip: true, floor: 27, t: -6, c: 88, d: 2, a: 170, b: 172, eq: [SEAT, { k: 'cable', at: 'W', to: [4, -34] }] },
        { cap: 'Abajo', hip: true, floor: 27, t: -10, c: 88, d: 2, a: 18, b: 158, eq: [SEAT, { k: 'cable', at: 'W', to: [6, -54] }] }] },
    { id: 'remo-polea', nombre: 'Remo sentado en polea', alias: ['remo sentado', 'remo en polea', 'remo en maquina'], tip: 'Sentado con la espalda recta, jala el agarre hacia el abdomen juntando los omóplatos. Regresa despacio sin encorvarte.',
      frames: [
        { cap: 'Inicio', hip: true, floor: 27, t: 6, c: 92, d: 30, a: 80, b: 84, eq: [SEAT, { k: 'cable', at: 'W', to: [30, 0] }] },
        { cap: 'Final', hip: true, floor: 27, t: -4, c: 92, d: 30, a: -38, b: 62, eq: [SEAT, { k: 'cable', at: 'W', to: [44, 0] }] }] },
    { id: 'puente-gluteo', nombre: 'Puente de glúteo', alias: ['puente de gluteo', 'puente de glúteo', 'hip thrust', 'elevacion de cadera', 'elevación de cadera'], tip: 'Acostado, pies apoyados y rodillas dobladas. Sube la cadera apretando los glúteos hasta formar una línea del hombro a la rodilla.',
      frames: [
        { cap: 'Inicio', t: 90, c: -120, d: -28, a: -92, b: -92 },
        { cap: 'Arriba', t: 104, c: -98, d: -6, a: -92, b: -92 }] },
    { id: 'plancha', nombre: 'Plancha', alias: ['plancha', 'plank'], tip: 'Antebrazos y puntas de los pies en el piso, cuerpo en línea recta. Abdomen y glúteos firmes, sin dejar caer la cadera.',
      frames: [
        { cap: 'Posición', t: 72, c: -76, d: -76, a: 0, b: 86, e: 70 }] },
    { id: 'flexiones', nombre: 'Flexiones', alias: ['flexion', 'flexiones', 'lagartija', 'push up', 'push-up'], tip: 'Manos bajo los hombros y cuerpo en línea recta. Baja el pecho hacia el piso con los codos a unos 45 grados y empuja para subir.',
      frames: [
        { cap: 'Arriba', t: 62, c: -66, d: -66, a: 2, b: 2, e: 70 },
        { cap: 'Abajo', t: 80, c: -82, d: -82, a: -42, b: 72, e: 70 }] },
    { id: 'prensa-pierna', nombre: 'Prensa de pierna', alias: ['prensa', 'prensa de pierna', 'leg press'], tip: 'Espalda y cadera pegadas al respaldo. Baja hasta que las rodillas formen unos 90 grados y empuja sin bloquear las rodillas al final.',
      frames: [
        { cap: 'Extendida', hip: true, floor: 30, t: -56, c: 124, d: 120, a: 60, b: 80, eq: [SEATREC, { k: 'plat', at: 'A', dx: 4 }] },
        { cap: 'Flexionada', hip: true, floor: 30, t: -56, c: 148, d: 84, a: 60, b: 80, eq: [SEATREC, { k: 'plat', at: 'A', dx: 4 }] }] },
    { id: 'abdominal', nombre: 'Abdominal (crunch)', alias: ['abdominal', 'crunch', 'abdominales'], tip: 'Acostado con rodillas dobladas, sube solo los hombros del piso contrayendo el abdomen. No jales el cuello con las manos.',
      frames: [
        { cap: 'Inicio', hip: true, floor: 22, t: 90, c: -122, d: -26, a: -92, b: -92 },
        { cap: 'Arriba', hip: true, floor: 22, t: 58, c: -122, d: -26, a: -92, b: -92 }] },
    { id: 'pantorrilla', nombre: 'Elevación de talones', alias: ['pantorrilla', 'elevacion de talones', 'elevación de talones', 'gemelos'], tip: 'De pie, sube de puntas lo más alto que puedas, pausa un segundo y baja el talón con control.',
      frames: [
        { cap: 'Abajo', t: 0, a: 4, b: 4, c: 0, d: 0 },
        { cap: 'Arriba', t: 0, a: 4, b: 4, c: 0, d: 0, e: 52 }] },
    { id: 'extension-cuadriceps', nombre: 'Extensión de cuádriceps', alias: ['extension de cuadriceps', 'extensión de cuádriceps', 'extension de pierna', 'cuadriceps en maquina'], tip: 'Sentado con la espalda en el respaldo, estira las piernas hasta casi bloquear y baja despacio sin dejar caer el peso.',
      frames: [
        { cap: 'Inicio', hip: true, floor: 27, t: -4, c: 90, d: 0, a: 20, b: 20, eq: [SEAT] },
        { cap: 'Arriba', hip: true, floor: 27, t: -4, c: 90, d: 88, a: 20, b: 20, eq: [SEAT, { k: 'pad', at: 'A' }] }] }
  ];

  function norm(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  var POR = {}; LISTA.forEach(function (x) { POR[x.id] = x; x._al = x.alias.map(norm); x.vb = caja(x.frames); });

  function figura(id) {
    var x = POR[id]; if (!x) return null;
    var wrap = document.createElement('div'); wrap.className = 'ej';
    var t = document.createElement('div'); t.className = 'ej-t'; t.textContent = x.nombre; wrap.appendChild(t);
    var row = document.createElement('div'); row.className = 'ej-row'; row.style.setProperty('--n', String(Math.max(2, x.frames.length)));
    x.frames.forEach(function (f, i) {
      var cell = document.createElement('figure'); cell.className = 'ej-cell';
      var s = dibujar(f, x.vb); cell.appendChild(s);
      var cp = document.createElement('figcaption'); cp.textContent = (i + 1) + '. ' + f.cap; cell.appendChild(cp);
      row.appendChild(cell);
    });
    wrap.appendChild(row);
    var tip = document.createElement('p'); tip.className = 'small mut'; tip.textContent = x.tip; wrap.appendChild(tip);
    return wrap;
  }
  // Busca ejercicios del catálogo mencionados en un texto libre.
  function detectar(texto) { var t = norm(texto), out = []; LISTA.forEach(function (x) { if (x._al.some(function (a) { return t.indexOf(a) >= 0; })) out.push(x.id); }); return out; }
  window.Ejercicios = { lista: LISTA.map(function (x) { return { id: x.id, nombre: x.nombre }; }), existe: function (id) { return !!POR[id]; }, figura: figura, detectar: detectar };
})();
