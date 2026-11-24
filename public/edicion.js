/* Edición protegida: todo se ve en modo lectura y solo cambia con Editar → Guardar.
   Sin DOM ni red: la app la usa (window.Edicion) y las pruebas la revisan (node --test).
   Incluye las reglas de los registros de peso. */
(function(root){
'use strict';

function copia(x){return x==null?x:JSON.parse(JSON.stringify(x))}
function igual(a,b){return JSON.stringify(a)===JSON.stringify(b)}

/* Estado de edición: una sola tarjeta a la vez.
   {id, base, borrador, pide} — pide: tarjeta que se quiso abrir con cambios sin guardar. */
function vacio(){return {id:null,base:null,borrador:null,pide:null}}
function sucio(st){return !!(st&&st.id&&!igual(st.base,st.borrador))}
function abrir(st,id,actual){
  if(st&&st.id===id)return st;
  if(sucio(st))return Object.assign({},st,{pide:{id:id,actual:copia(actual)}});
  return {id:id,base:copia(actual),borrador:copia(actual),pide:null};
}
/* "Descartar y editar la otra" */
function descartarYAbrir(st){if(!st||!st.pide)return st;return {id:st.pide.id,base:copia(st.pide.actual),borrador:copia(st.pide.actual),pide:null}}
function seguir(st){return Object.assign({},st,{pide:null})}
/* Solo cambia la tarjeta que está en edición: tocar en modo lectura no hace nada. */
function cambiar(st,id,patch){
  if(!st||st.id!==id)return st;
  var b=Object.assign({},st.borrador);
  Object.keys(patch).forEach(function(k){b[k]=copia(patch[k])});
  return Object.assign({},st,{borrador:b});
}
function editando(st,id){return !!(st&&st.id===id)}
function valor(st,id,actual){return editando(st,id)?st.borrador:actual}
function cancelar(){return vacio()}
/* guardarFn recibe el borrador; si devuelve {ok:false,razon[,patch]}, la tarjeta sigue en edición
   (patch marca el borrador, p. ej. para pedir confirmación al segundo Guardar). */
function guardar(st,guardarFn){
  if(!st||!st.id)return {st:st,ok:false};
  var r=guardarFn(copia(st.borrador));
  if(r&&r.ok===false){var st2=r.patch?cambiar(st,st.id,r.patch):st;return {st:Object.assign({},st2,{error:r.razon}),ok:false,razon:r.razon}}
  return {st:vacio(),ok:true};
}

/* ---------- pesos: un registro por fecha (pesos/AAAA-MM-DD) ---------- */
function validarPeso(fecha,kg,hoy){
  var v=parseFloat(kg);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(String(fecha||'')))return {ok:false,razon:'Elige la fecha.'};
  if(hoy&&fecha>hoy)return {ok:false,razon:'La fecha no puede ser futura.'};
  if(!(v>=30&&v<=250))return {ok:false,razon:'El peso va entre 30 y 250 kg.'};
  return {ok:true,fecha:fecha,kg:Math.round(v*10)/10};
}
/* Cambios a aplicar en la colección. desde = fecha original (null si es nuevo).
   Si la fecha nueva ya tiene registro, pide confirmar (conflicto) antes de reemplazarlo. */
function cambiosPeso(pesos,desde,fecha,kg,hoy,confirmado){
  var v=validarPeso(fecha,kg,hoy); if(!v.ok)return v;
  var previo=desde?pesos[desde]:null, ocupado=pesos[v.fecha]&&v.fecha!==desde;
  if(ocupado&&!confirmado)return {ok:false,conflicto:true,razon:'Ya tienes un peso el '+v.fecha+' ('+pesos[v.fecha].kg+' kg). ¿Lo reemplazo?'};
  var base=Object.assign({},ocupado?pesos[v.fecha]:{},previo||{}), doc=Object.assign(base,{fecha:v.fecha,kg:v.kg});
  if(doc.animo===undefined)doc.animo=null;
  var set={}; set[v.fecha]=doc;
  return {ok:true,set:set,del:desde&&desde!==v.fecha?[desde]:[]};
}
function aplicar(pesos,c){var o=Object.assign({},pesos);(c.del||[]).forEach(function(k){delete o[k]});Object.keys(c.set||{}).forEach(function(k){o[k]=c.set[k]});return o}

var API={vacio:vacio,sucio:sucio,abrir:abrir,descartarYAbrir:descartarYAbrir,seguir:seguir,cambiar:cambiar,editando:editando,valor:valor,cancelar:cancelar,guardar:guardar,
  validarPeso:validarPeso,cambiosPeso:cambiosPeso,aplicar:aplicar};
if(typeof module!=='undefined'&&module.exports)module.exports=API; else root.Edicion=API;
})(typeof window!=='undefined'?window:this);
