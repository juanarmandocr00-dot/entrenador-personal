// Pruebas de marcas y experiencia por disciplina. Correr con: node --test
const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('../public/marcas.js');

const HOY = '2026-11-24';

test('tiempo: acepta h:mm:ss, mm:ss y minutos; rechaza lo que no es tiempo', () => {
  assert.equal(R.aSeg('1:05:30'), 3930);
  assert.equal(R.aSeg('28:30'), 1710);
  assert.equal(R.aSeg('28'), 1680);
  assert.equal(R.aSeg('28:75'), null);
  assert.equal(R.aSeg('rápido'), null);
  assert.equal(R.deSeg(3930), '1:05:30');
  assert.equal(R.deSeg(1710), '28:30');
});

test('Epley: peso × (1 + reps/30), solo con 10 repeticiones o menos', () => {
  assert.equal(R.epley(80, 5), 93.3);
  assert.equal(R.epley(60, 10), 80);
  assert.equal(R.epley(60, 12), null);
  assert.equal(R.epley(60, 0), null);
});

test('una marca puede ser solo una nota', () => {
  const r = R.limpiar('x:Calistenia', { dato: 'nota', nota: 'hago dominadas, llego a 5' }, HOY);
  assert.equal(r.ok, true);
  assert.equal(r.marca.nota, 'hago dominadas, llego a 5');
  assert.equal(r.marca.fecha, HOY);
});

test('una marca vacía o con fecha futura no se guarda', () => {
  assert.equal(R.limpiar('correr', {}, HOY).ok, false);
  assert.equal(R.limpiar('correr', { dist: '5k', fecha: '2026-12-01' }, HOY).ok, false);
  assert.equal(R.limpiar('correr', { tiempo: '99:99' }, HOY).ok, false);
});

test('los campos cambian según la disciplina', () => {
  const c = R.limpiar('correr', { dist: '10k', tiempo: '58:20', tipo: 'carrera', sent: 4, kg: 80 }, HOY).marca;
  assert.deepEqual([c.dist, c.seg, c.tipo, c.sent, c.kg], ['10k', 3500, 'carrera', 4, undefined]);
  const g = R.limpiar('gym', { ejercicio: 'Sentadilla', kg: 80, reps: 5 }, HOY).marca;
  assert.match(R.textoMarca('gym', g), /~93.3 kg máximo estimado/);
  const n = R.limpiar('natacion', { m: 1000, tiempo: '22:00' }, HOY).marca;
  assert.match(R.textoMarca('natacion', n), /2:12\/100 m/);
  const b = R.limpiar('bici', { km: 40, tiempo: '1:36:00' }, HOY).marca;
  assert.match(R.textoMarca('bici', b), /25 km\/h/);
  const p = R.limpiar('x:Remo', { dato: 'distancia', km: 5 }, HOY).marca;
  assert.equal(p.km, 5);
});

test('máximo 30 marcas por disciplina: las más viejas se archivan', () => {
  let lista = [];
  let archivo = [];
  for (let i = 1; i <= 32; i++) {
    const fecha = '2026-' + String(Math.ceil(i / 28)).padStart(2, '0') + '-' + String(((i - 1) % 28) + 1).padStart(2, '0');
    const r = R.agregar(lista, { id: 'm' + i, fecha, nota: 'n' + i });
    lista = r.lista;
    archivo = R.archivar(archivo, r.archivadas);
  }
  assert.equal(lista.length, 30);
  assert.equal(archivo.length, 2);
  assert.deepEqual(archivo.map((m) => m.id).sort(), ['m1', 'm2']);
});

test('resumen de una línea para el coach', () => {
  const marcas = [
    { fecha: '2026-10-01', ej: 'Sentadilla', kg: 80, reps: 5 },
    { fecha: '2026-11-01', ej: 'Sentadilla', kg: 85, reps: 3 },
    { fecha: '2026-11-02', ej: 'Press de pecho', kg: 50, reps: 8 },
  ];
  const s = R.resumen('gym', { nivel: 'intermedio', tiempo: 2, unidad: 'anios' }, marcas);
  assert.equal(s, 'Gym: sentadilla ~93.5 kg estimado, press de pecho ~63.3 kg estimado · intermedio, 2 años');
  assert.ok(!s.includes('\n'));
  assert.equal(R.resumen('bici', null, []), '');
  assert.equal(R.resumen('x:Calistenia', null, [{ fecha: HOY, nota: 'llego a 5 dominadas' }]), 'Calistenia: "llego a 5 dominadas"');
});

test('las carreras registradas alimentan la experiencia para evaluar metas', () => {
  const marcas = { correr: [{ fecha: '2026-06-01', dist: '21k', seg: 7800, tipo: 'carrera' }, { fecha: '2026-11-10', dist: 'otra', km: 14, tipo: 'entreno' }] };
  const e = R.expConMarcas({ max: '10k' }, marcas, HOY);
  assert.equal(e.max, '21k');
  assert.equal(e.larga, 14);
  // nunca baja lo que escribiste a mano
  assert.equal(R.expConMarcas({ max: '42k', larga: 20 }, marcas, HOY).max, '42k');
  assert.equal(R.expConMarcas({ max: '42k', larga: 20 }, marcas, HOY).larga, 20);
});
