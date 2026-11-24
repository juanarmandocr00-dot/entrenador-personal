// Pruebas de la configuración semanal. Correr con: node --test
const test = require('node:test');
const assert = require('node:assert/strict');
const W = require('../public/semanas.js');

const perfil = { libres: ['Sáb'], no: ['Mié'], descanso: 'Dom', minutos: { Lun: 60 }, plan: { disc: ['correr', 'gym'], modo: 'auto' }, porque: 'salud' };

test('título con semana ISO y rango según el día de inicio', () => {
  assert.equal(W.titulo('2026-11-23'), 'Semana 48 · 23 a 29 nov');
  assert.equal(W.titulo('2026-11-29'), 'Semana 49 · 29 nov a 5 dic'); // empieza en domingo
  assert.equal(W.numero('2026-12-28'), 53);
  assert.equal(W.numero('2027-01-04'), 1);
});

test('sin semanas configuradas se parte del perfil (solo los campos semanales)', () => {
  const c = W.config({}, '2026-11-23', perfil);
  assert.equal(c.de, 'perfil');
  assert.deepEqual(c.config.libres, ['Sáb']);
  assert.equal(c.config.porque, undefined);
});

test('Agregar nueva semana copia la configuración de la anterior', () => {
  const semanas = { '2026-11-23': { inicio: '2026-11-23', dias: [], config: W.limpiar(Object.assign({}, perfil, { libres: ['Vie'] })) } };
  const n = W.nueva(semanas, '2026-11-23', perfil);
  assert.equal(n.inicio, '2026-11-30');
  assert.deepEqual(n.config, semanas['2026-11-23'].config);
  // con la siguiente ya creada, la nueva es la de después
  semanas['2026-11-30'] = W.conConfig(null, n.inicio, Object.assign({}, n.config, { descanso: 'Sáb' }));
  const n2 = W.nueva(semanas, '2026-11-23', perfil);
  assert.equal(n2.inicio, '2026-12-07');
  assert.equal(n2.config.descanso, 'Sáb');
});

test('la semana vigente alimenta la generación: cada semana usa la suya y si no tiene, la anterior', () => {
  const semanas = {
    '2026-11-23': { config: W.limpiar({ minutos: { Lun: 60 }, plan: { disc: ['correr'] } }) },
    '2026-11-30': { config: W.limpiar({ minutos: { Lun: 30 }, plan: { disc: ['gym'] } }) },
  };
  assert.equal(W.config(semanas, '2026-11-23', perfil).config.minutos.Lun, 60);
  assert.equal(W.config(semanas, '2026-11-30', perfil).config.minutos.Lun, 30);
  assert.deepEqual(W.config(semanas, '2026-12-07', perfil).config.plan.disc, ['gym']);
});

test('guardar la configuración no borra la rutina ya generada', () => {
  const doc = { inicio: '2026-11-23', dias: [{ fecha: '2026-11-23', tipo: 'correr' }], resumen: 'x' };
  const d = W.conConfig(doc, '2026-11-23', { libres: ['Sáb'], no: ['Sáb'] });
  assert.equal(d.dias.length, 1);
  assert.deepEqual(d.config.libres, []); // un día no puede ser libre y no disponible a la vez
});
