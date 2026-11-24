// Pruebas de edición protegida (Editar / Guardar / Cancelar) y de los registros de peso. Correr con: node --test
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../public/edicion.js');

const HOY = '2026-11-24';

test('tocar campos en modo lectura no cambia nada', () => {
  const st = E.vacio();
  assert.deepEqual(E.cambiar(st, 'porque', { porque: 'otra cosa' }), st);
  // con otra tarjeta en edición, tampoco cambia la que está en lectura
  const otra = E.abrir(st, 'gym', { nombre: 'Smart Fit' });
  assert.equal(E.cambiar(otra, 'porque', { porque: 'x' }), otra);
});

test('Editar y Cancelar no guardan', () => {
  let guardado = null;
  let st = E.abrir(E.vacio(), 'porque', { porque: 'correr feliz' });
  st = E.cambiar(st, 'porque', { porque: 'algo nuevo' });
  assert.equal(E.valor(st, 'porque', null).porque, 'algo nuevo');
  st = E.cancelar(st);
  assert.equal(guardado, null);
  assert.equal(E.editando(st, 'porque'), false);
  assert.equal(E.valor(st, 'porque', { porque: 'correr feliz' }).porque, 'correr feliz');
});

test('Editar y Guardar sí guardan y regresan a lectura', () => {
  let guardado = null;
  let st = E.abrir(E.vacio(), 'porque', { porque: 'correr feliz' });
  st = E.cambiar(st, 'porque', { porque: 'por mi salud' });
  const r = E.guardar(st, (b) => { guardado = b; });
  assert.equal(r.ok, true);
  assert.deepEqual(guardado, { porque: 'por mi salud' });
  assert.equal(r.st.id, null);
});

test('solo una tarjeta a la vez: con cambios sin guardar, pregunta antes de abrir otra', () => {
  let st = E.abrir(E.vacio(), 'gym', { nombre: 'A' });
  // sin cambios, cambia directo
  assert.equal(E.abrir(st, 'porque', { porque: '' }).id, 'porque');
  st = E.cambiar(st, 'gym', { nombre: 'B' });
  const p = E.abrir(st, 'porque', { porque: '' });
  assert.equal(p.id, 'gym');
  assert.equal(p.pide.id, 'porque');
  assert.equal(E.seguir(p).borrador.nombre, 'B');
  assert.equal(E.descartarYAbrir(p).id, 'porque');
});

test('agregar un peso: fecha de hoy por defecto y valor entre 30 y 250 kg', () => {
  assert.equal(E.cambiosPeso({}, null, HOY, 20, HOY).ok, false);
  assert.equal(E.cambiosPeso({}, null, HOY, 251, HOY).ok, false);
  assert.equal(E.cambiosPeso({}, null, '2026-12-01', 90, HOY).ok, false);
  const c = E.cambiosPeso({}, null, HOY, '92.44', HOY);
  assert.equal(c.ok, true);
  assert.deepEqual(c.set[HOY], { fecha: HOY, kg: 92.4, animo: null });
});

test('editar un peso: cambia kg y fecha, conserva el ánimo y la nota, y pide confirmar si la fecha ya tiene peso', () => {
  const pesos = { '2026-11-20': { fecha: '2026-11-20', kg: 93, animo: 3, nota: 'bien' }, '2026-11-22': { fecha: '2026-11-22', kg: 92.5 } };
  const kg = E.cambiosPeso(pesos, '2026-11-20', '2026-11-20', 92.8, HOY);
  assert.deepEqual(E.aplicar(pesos, kg)['2026-11-20'], { fecha: '2026-11-20', kg: 92.8, animo: 3, nota: 'bien' });
  const mover = E.cambiosPeso(pesos, '2026-11-20', '2026-11-21', 93, HOY);
  const nuevo = E.aplicar(pesos, mover);
  assert.equal(nuevo['2026-11-20'], undefined);
  assert.equal(nuevo['2026-11-21'].nota, 'bien');
  const choque = E.cambiosPeso(pesos, '2026-11-20', '2026-11-22', 93, HOY);
  assert.equal(choque.conflicto, true);
  assert.equal(E.aplicar(pesos, E.cambiosPeso(pesos, '2026-11-20', '2026-11-22', 93, HOY, true))['2026-11-22'].kg, 93);
});

test('borrar un peso', () => {
  const pesos = { '2026-11-20': { fecha: '2026-11-20', kg: 93 } };
  assert.deepEqual(E.aplicar(pesos, { del: ['2026-11-20'] }), {});
});
