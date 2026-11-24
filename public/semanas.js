/* Configuración semanal: días libres, días sin entrenar, día de sobreesfuerzo, minutos y disciplinas.
   Vive en el documento de cada semana (semanas/AAAA-MM-DD, campo config); lo permanente sigue en el perfil.
   Sin DOM ni red: la app la usa (window.Semanas) y las pruebas la revisan (node --test). */
(function(root){
'use strict';
var DIAS=['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];
var MESES=['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
var pad=function(n){return String(n).padStart(2,'0')};
function iso(d){return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())}
function parse(s){var p=String(s).split('-').map(Number);return new Date(p[0],p[1]-1,p[2])}
function addDays(s,n){var x=parse(s);x.setDate(x.getDate()+n);return iso(x)}

/* Campos semanales. Todo lo demás del perfil es permanente. */
var CAMPOS=['libres','no','descanso','minutosModo','minutos','plan'];

/* Número de semana ISO. Con un inicio distinto al lunes se toma el día de en medio (inicio + 3),
   así la semana lleva el número donde cae la mayoría de sus días. */
function numero(inicio){
  var d=parse(addDays(inicio,3)), dia=(d.getDay()+6)%7;
  var jue=new Date(d);jue.setDate(d.getDate()-dia+3);
  var ene4=new Date(jue.getFullYear(),0,4), lunes1=new Date(ene4);lunes1.setDate(ene4.getDate()-((ene4.getDay()+6)%7));
  return 1+Math.round((jue-lunes1)/864e5/7);
}
function rango(inicio){
  var a=parse(inicio), b=parse(addDays(inicio,6));
  return a.getMonth()===b.getMonth()?a.getDate()+' a '+b.getDate()+' '+MESES[b.getMonth()]:a.getDate()+' '+MESES[a.getMonth()]+' a '+b.getDate()+' '+MESES[b.getMonth()];
}
function titulo(inicio){return 'Semana '+numero(inicio)+' · '+rango(inicio)}

function limpiar(c){
  c=c||{};
  var dia=function(x){return DIAS.indexOf(x)>=0};
  var no=(c.no||[]).filter(dia), libres=(c.libres||[]).filter(function(x){return dia(x)&&no.indexOf(x)<0});
  var descanso=dia(c.descanso)&&no.indexOf(c.descanso)<0?c.descanso:'';
  var min={}; Object.keys(c.minutos||{}).forEach(function(d){var v=parseInt(c.minutos[d],10);if(dia(d)&&v>=0)min[d]=Math.min(300,v)});
  var pl=c.plan||{}, dd={}; Object.keys(pl.dias||{}).forEach(function(k){dd[k]=(pl.dias[k]||[]).filter(dia)});
  return {libres:libres,no:no,descanso:descanso,minutosModo:c.minutosModo==='personalizado'?'personalizado':'igual',minutos:min,
    plan:{disc:(pl.disc||[]).filter(function(x){return typeof x==='string'}).slice(0,10),modo:pl.modo==='manual'?'manual':'auto',dias:dd}};
}
/* Lo que había antes en el perfil sirve de punto de partida. */
function dePerfil(p){var o={};CAMPOS.forEach(function(k){if(p&&p[k]!=null)o[k]=p[k]});return limpiar(o)}

/* Configuración vigente de una semana: la suya; si no tiene, la de la semana anterior más cercana; si no, la del perfil. */
function config(semanas,inicio,perfil){
  var ks=Object.keys(semanas||{}).filter(function(k){return k<=inicio&&semanas[k]&&semanas[k].config}).sort();
  if(ks.length){var k=ks[ks.length-1];return {config:limpiar(semanas[k].config),de:k,propia:k===inicio}}
  return {config:dePerfil(perfil),de:'perfil',propia:false};
}
/* "Agregar nueva semana": la que sigue a la última configurada (o a la actual), copiando su configuración. */
function nueva(semanas,actual,perfil){
  var ks=Object.keys(semanas||{}).filter(function(k){return k>=actual&&semanas[k]&&semanas[k].config}).sort();
  var ultima=ks.length?ks[ks.length-1]:actual, inicio=addDays(ultima,7);
  return {inicio:inicio,config:config(semanas,ultima,perfil).config};
}
/* Documento de la semana con la configuración, sin tocar la rutina ya generada. */
function conConfig(doc,inicio,c){return Object.assign({inicio:inicio},doc||{},{config:limpiar(c)})}
/* Semanas a mostrar: la actual primero, luego las próximas y al final las anteriores (más reciente primero). */
function lista(semanas,actual){
  var ks=Object.keys(semanas||{}).filter(function(k){return semanas[k]&&(semanas[k].config||semanas[k].dias)});
  var prox=ks.filter(function(k){return k>actual&&semanas[k].config}).sort(), ant=ks.filter(function(k){return k<actual}).sort().reverse();
  return [actual].concat(prox,ant);
}

var API={DIAS:DIAS,CAMPOS:CAMPOS,numero:numero,rango:rango,titulo:titulo,limpiar:limpiar,dePerfil:dePerfil,config:config,nueva:nueva,conConfig:conConfig,lista:lista,addDays:addDays};
if(typeof module!=='undefined'&&module.exports)module.exports=API; else root.Semanas=API;
})(typeof window!=='undefined'?window:this);
