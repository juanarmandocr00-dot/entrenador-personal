// Pruebas de las reglas de metas. Correr con: node --test tests/
const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../public/metas.js');

const HOY = '2026-11-23';
const medio = { nombre: 'Medio Monterrey', tipo: 'calle', dist: '21k', fecha: '2027-03-14', prio: 'A' };

test('sin meta principal, la primera meta es la principal', () => {
  const r = M.validar(medio, [], HOY);
  assert.equal(r.ok, true);
  assert.equal(r.rol, 'principal');
});

test('agregar una meta menor dentro del plan: se permite como secundaria', () => {
  const diezK = { nombre: '10K Navidad', tipo: 'calle', dist: '10k', fecha: '2027-01-10' };
  const r = M.validar(diezK, [medio], HOY);
  assert.equal(r.ok, true);
  assert.equal(r.rol, 'secundaria');
});

test('una meta del mismo esfuerzo se permite', () => {
  const otroMedio = { nombre: 'Medio Saltillo', tipo: 'calle', dist: '21k', fecha: '2027-02-07' };
  assert.equal(M.validar(otroMedio, [medio], HOY).ok, true);
});

test('intentar una meta mayor con principal activa: bloqueada y explica por qué', () => {
  const maraton = { nombre: 'Maratón CDMX', tipo: 'calle', dist: '42k', fecha: '2027-05-09' };
  const r = M.validar(maraton, [medio], HOY);
  assert.equal(r.ok, false);
  assert.equal(r.codigo, 'mayor');
  assert.match(r.razon, /mayor esfuerzo/);
  assert.match(r.razon, /Medio Monterrey/);
});

test('triatlón y montaña larga también se bloquean frente a un medio maratón', () => {
  const tri = { nombre: '70.3 Monterrey', tipo: 'triatlon', dist: '703', fecha: '2027-06-01' };
  const trail = { nombre: 'Ultra sierra', tipo: 'montana', km: 30, desnivel: 2000, fecha: '2027-06-01' }; // 50 km-esfuerzo ≈ maratón
  assert.equal(M.validar(tri, [medio], HOY).codigo, 'mayor');
  assert.equal(M.validar(trail, [medio], HOY).codigo, 'mayor');
  const trailCorto = { nombre: 'Trail Chipinque', tipo: 'montana', km: 10, desnivel: 500, fecha: '2027-01-20' }; // 15 ≈ 10K
  assert.equal(M.validar(trailCorto, [medio], HOY).ok, true);
});

test('meta vencida: la mayor se desbloquea cuando pasa la fecha de la principal', () => {
  const maraton = { nombre: 'Maratón CDMX', tipo: 'calle', dist: '42k', fecha: '2027-08-29' };
  const despues = '2027-03-15'; // el día después del medio maratón
  assert.equal(M.principal([medio], despues), null);
  const r = M.validar(maraton, [medio], despues);
  assert.equal(r.ok, true);
  assert.equal(r.rol, 'principal');
});

test('meta marcada como lograda: se desbloquea aunque no haya pasado la fecha', () => {
  const lograda = Object.assign({}, medio, { lograda: '2027-03-14' });
  const maraton = { nombre: 'Maratón CDMX', tipo: 'calle', dist: '42k', fecha: '2027-08-29' };
  assert.equal(M.validar(maraton, [lograda], '2027-03-14').ok, true);
});

test('no se puede cambiar la principal mientras hay una activa', () => {
  const diezK = { nombre: '10K Navidad', tipo: 'calle', dist: '10k', fecha: '2027-01-10', prio: 'B' };
  const r = M.puedeSerPrincipal(diezK, [medio, diezK], HOY);
  assert.equal(r.ok, false);
  assert.equal(r.codigo, 'hay_principal');
});

test('una secundaria mayor que ya existía queda en pausa', () => {
  const maraton = { nombre: 'Maratón CDMX', tipo: 'calle', dist: '42k', fecha: '2027-05-09', prio: 'B' };
  assert.equal(M.rol(maraton, [medio, maraton], HOY), 'pausa');
  assert.equal(M.rol(medio, [medio, maraton], HOY), 'principal');
});

test('disciplinas según la meta principal', () => {
  assert.deepEqual(M.disciplinas([medio], HOY), ['correr', 'gym']);
  const tri = { nombre: '70.3', tipo: 'triatlon', dist: '703', fecha: '2027-09-01', prio: 'A' };
  assert.deepEqual(M.disciplinas([tri], HOY), ['natacion', 'bici', 'correr', 'gym']);
  assert.equal(M.disciplinas([], HOY), null); // sin principal: todas
});

test('orden de esfuerzo: 5K < 10K < medio < maratón < 70.3 < Ironman', () => {
  const n = ['5k', '10k', '21k', '42k', '703', 'ironman'].map((d) => M.esfuerzo({ dist: d }));
  assert.deepEqual(n, [1, 2, 3, 4, 5, 6]);
});

test('plan por fases: base, desarrollo y afinación hasta la fecha; luego recuperación', () => {
  const p = M.plan(medio, { max: '10k' }, 0);
  assert.equal(p.L, 16);
  assert.deepEqual([...new Set(p.sem.map((s) => s.fase))], ['base', 'desarrollo', 'afinacion']);
  assert.equal(p.sem[p.L - 1].carrera, true);
  assert.equal(p.sem[p.L - 1].lunes, M.inicioSemana(medio.fecha, 0));
  // la salida larga nunca sube más de 1.5 km por semana (comparando semanas normales)
  const normales = p.sem.filter((s) => s.fase !== 'afinacion' && !s.desc);
  normales.forEach((s, i) => { if (i) assert.ok(s.km - normales[i - 1].km <= 1.5 + 1e-9); });
  const rec = M.recuperacion([medio], '2027-03-20');
  assert.equal(rec.k, 1);
  assert.equal(rec.R, 2);
  assert.equal(M.recuperacion([medio], '2027-04-01'), null);
});

test('el semáforo marca riesgoso un primer maratón a 8 semanas de un medio', () => {
  const metas = [Object.assign({}, medio, { prio: 'B' }), { nombre: 'Maratón', dist: '42k', fecha: '2027-05-09', prio: 'A' }];
  const av = M.revisar(metas, { max: '10k' }, HOY);
  assert.ok(av.some((a) => a.nivel === 'rojo' && /12 semanas/.test(a.texto)));
});

test('editar una meta: cambia nombre y fecha con las mismas reglas', () => {
  const diezK = { nombre: '10K Navidad', tipo: 'calle', dist: '10k', fecha: '2027-01-10', prio: 'B' };
  const metas = [medio, diezK];
  const ok = M.validarEdicion(diezK, Object.assign({}, diezK, { nombre: '10K Reyes', fecha: '2027-01-06' }), metas, HOY);
  assert.equal(ok.ok, true);
  assert.equal(ok.prio, 'B');
  const mayor = M.validarEdicion(diezK, Object.assign({}, diezK, { dist: '42k' }), metas, HOY);
  assert.equal(mayor.codigo, 'mayor');
  // la principal puede cambiar de distancia y sigue siendo principal
  const p = M.validarEdicion(medio, Object.assign({}, medio, { dist: '42k' }), metas, HOY);
  assert.equal(p.prio, 'A');
});

test('marcar una meta como lograda guarda el resultado y aparece en resultados', () => {
  const MR = require('../public/marcas.js');
  const diezK = { nombre: '10K Navidad', tipo: 'calle', dist: '10k', fecha: '2026-11-22', prio: 'B' };
  const r = M.lograr([medio, diezK], M.clave(diezK), { fecha: '2026-11-22', seg: 3480, sent: 4 }, HOY);
  assert.equal(r.ok, true);
  const hecha = r.metas.find((m) => m.nombre === '10K Navidad');
  assert.deepEqual([hecha.lograda, hecha.resultado.seg, hecha.resultado.sent], ['2026-11-22', 3480, 4]);
  const { disc, marca } = MR.marcaDeMeta(hecha, { fecha: hecha.lograda, seg: 3480, sent: 4 });
  const res = MR.resultados({ [disc]: [marca] });
  assert.equal(res.length, 1);
  assert.equal(res[0].marca.metaId, M.clave(diezK));
  assert.match(MR.textoMarca(disc, res[0].marca), /10K en 58:00.*carrera/);
  assert.equal(M.lograr([diezK], M.clave(diezK), { fecha: '2026-12-01' }, HOY).ok, false); // fecha futura
  assert.equal(M.desmarcar(r.metas, M.clave(diezK)).find((m) => m.nombre === '10K Navidad').lograda, undefined);
});
