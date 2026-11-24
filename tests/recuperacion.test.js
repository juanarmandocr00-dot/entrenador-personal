// Pruebas de la recuperación después de una carrera o meta (bloque H). Correr con: node --test
const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('../public/recuperacion.js');
const M = require('../public/metas.js');

const dias = (inicio, tipo) => Array.from({ length: 7 }, (_, i) => {
  const f = M.iso(M.addDays(M.parse(inicio), i));
  return { fecha: f, tipo, titulo: tipo, detalle: '', min: 60 };
});
const lograda = (m, fecha, r) => Object.assign({ prio: 'B' }, m, { lograda: fecha, resultado: r || {} });

test('meta 10K lograda: no se corre al día siguiente y la semana siguiente baja', () => {
  // 10K el domingo 3 ene; la semana empieza en lunes
  const p = { exp: { max: '10k' }, metas: [lograda({ nombre: '10K Reyes', tipo: 'calle', dist: '10k', fecha: '2027-01-03' }, '2027-01-03', { sent: 3, prevKm: 10 })] };
  const rec = R.semana(p, '2027-01-04', 0);
  assert.equal(rec.k, 1);
  assert.equal(rec.tipo, 'normal');
  assert.equal(rec.red, 20);
  assert.match(rec.motivo, /Semana de recuperación después de tu 10K Reyes del 3 ene/);
  const d = R.aplicar(dias('2027-01-04', 'correr'), rec, '2027-01-04', R.maxMin(420, rec.red));
  assert.equal(d[0].tipo, 'descanso'); // lunes 4: el día siguiente no se corre
  const total = d.reduce((s, x) => s + (x.tipo === 'descanso' ? 0 : x.min), 0);
  assert.ok(total <= 340);
  // el tope nunca se pasa aunque redondear a 5 min no cuadre
  const d2 = R.aplicar(dias('2027-01-04', 'gym'), rec, '2027-01-04', 220);
  assert.ok(d2.reduce((s, x) => s + (x.tipo === 'descanso' ? 0 : x.min), 0) <= 220);
  assert.match(R.linea(rec, '2027-01-04', 340), /máximo 340 min.*sin correr el Lun 4 ene/);
});

test('un 10K que es tu carrera más larga cuenta como larga: 1 día de descanso completo', () => {
  const p = { metas: [lograda({ nombre: '10K Navidad', tipo: 'calle', dist: '10k', fecha: '2026-12-27' }, '2026-12-27', { prevKm: 5 })] };
  const rec = R.semana(p, '2026-12-28', 0);
  assert.equal(rec.tipo, 'larga');
  assert.equal(rec.red, 35);
  assert.deepEqual(rec.descanso, ['2026-12-28']);
});

test('medio maratón logrado: 2 días de descanso y semana claramente más baja', () => {
  const p = { exp: { max: '21k' }, metas: [lograda({ nombre: 'Medio Monterrey', tipo: 'calle', dist: '21k', fecha: '2027-03-14', prio: 'A' }, '2027-03-14', { seg: 7200, sent: 4 })] };
  const rec = R.semana(p, '2027-03-15', 0);
  assert.equal(rec.tipo, 'larga');
  assert.deepEqual(rec.descanso, ['2027-03-15', '2027-03-16']);
  assert.ok(rec.red >= 30 && rec.red <= 40);
  const d = R.aplicar(dias('2027-03-15', 'correr'), rec, '2027-03-15', R.maxMin(420, rec.red));
  assert.deepEqual(d.slice(0, 2).map((x) => x.titulo), ['Descanso completo', 'Descanso completo']);
  // la semana después sube gradual: la mitad de la reducción
  const sig = R.semana(p, '2027-03-22', 0);
  assert.equal(sig.k, 2);
  assert.ok(sig.red > 0 && sig.red < rec.red);
  assert.equal(R.semana(p, '2027-03-29', 0), null);
});

test('5K normal: reducción leve, sin descanso obligatorio', () => {
  const p = { exp: { max: '10k' }, marcas: { correr: [{ id: 'a', fecha: '2026-11-22', dist: '5k', seg: 1500, tipo: 'carrera', sent: 3 }] } };
  const rec = R.semana(p, '2026-11-23', 0);
  assert.equal(rec.tipo, 'normal');
  assert.ok(rec.red >= 15 && rec.red <= 25);
  assert.deepEqual(rec.descanso, []);
  assert.deepEqual(rec.sinCorrer, ['2026-11-23']);
  // esfuerzo 5 de 5 la vuelve larga
  p.marcas.correr[0].sent = 5;
  assert.equal(R.semana(p, '2026-11-23', 0).tipo, 'larga');
});

test('Conservador / Normal / Exigente cambian la reducción', () => {
  const base = { metas: [lograda({ nombre: 'Medio', tipo: 'calle', dist: '21k', fecha: '2027-03-14' }, '2027-03-14')] };
  const red = (a) => R.semana(Object.assign({ recuperacion: a }, base), '2027-03-15', 0);
  assert.ok(red('conservador').red > red('normal').red && red('normal').red > red('exigente').red);
  assert.equal(red('exigente').descanso.length, 1);
});

test('meta lograda dentro de un plan de medio maratón: se inserta la recuperación y la fase se retoma', () => {
  const medio = { nombre: 'Medio Monterrey', tipo: 'calle', dist: '21k', fecha: '2027-03-14', prio: 'A' };
  const diezK = lograda({ nombre: '10K Reyes', tipo: 'calle', dist: '10k', fecha: '2027-01-17' }, '2027-01-17', { prevKm: 10 });
  const pl = M.plan(medio, { max: '10k' }, 0);
  const p = { metas: [medio, diezK] };
  const rec = R.semanaAjustada(pl, '2027-01-18', p, 0); // semana 9 del plan: se usa para recuperar
  assert.equal(rec.recuperacion, true);
  assert.equal(rec.k, 9);
  const despues = R.semanaAjustada(pl, '2027-01-25', p, 0);
  assert.equal(despues.k, 10);
  assert.equal(despues.retoma, 9); // retoma los objetivos de la semana 9, sin saltarla
  assert.equal(despues.km, pl.sem[8].km);
  assert.equal(despues.fase, 'desarrollo');
  // si la recuperación cae en una semana de descarga, esa semana ya era suave: no se recorre nada
  const enDescarga = { metas: [medio, Object.assign({}, diezK, { fecha: '2027-01-10', lograda: '2027-01-10' })] };
  assert.equal(R.semanaAjustada(pl, '2027-01-18', enDescarga, 0).retoma, undefined);
  // la afinación sigue pegada a la fecha de la meta
  assert.equal(R.semanaAjustada(pl, '2027-03-08', p, 0).fase, 'afinacion');
  assert.match(M.textoFase(p.metas, { max: '10k' }, '2027-01-25', '2027-01-25', 0, { semana: (a, f) => R.semanaAjustada(a, f, p, 0) }), /retoma los objetivos de la semana/);
});
