/* Marcas y experiencia por disciplina: validación, máximo estimado (Epley), archivo de marcas viejas
   y el resumen de una línea que recibe el coach. Sin DOM ni red: la app lo usa (window.Marcas)
   y las pruebas lo revisan (node --test). */
(function(root){
'use strict';

var BASE=[['correr','Correr'],['gym','Gym'],['natacion','Natación'],['bici','Bici']];
var DIST_CORRER=[['5k','5K',5],['10k','10K',10],['21k','21K',21.1],['otra','Otra',0]];
var TIPO_CORRER=[['carrera','Carrera'],['entreno','Entrenamiento'],['prueba','Prueba']];
var DATOS=[['tiempo','Tiempo'],['distancia','Distancia'],['pesorep','Peso × repeticiones'],['duracion','Duración'],['nota','Solo una nota']];
var NIVELES=[['principiante','Principiante'],['intermedio','Intermedio'],['avanzado','Avanzado']];
var MAX=30;          /* marcas por disciplina en el perfil; las más viejas se archivan */
var MAX_ARCHIVO=200; /* por disciplina en el archivo */

/* ---------- utilidades ---------- */
function num(v){if(v==null||v==='')return null;var n=parseFloat(String(v).replace(',','.'));return isFinite(n)?n:null}
function pos(v,max){var n=num(v);return n!=null&&n>0&&n<=max?n:null}
/* "1:05:30", "28:30" o "28" (minutos) → segundos */
function aSeg(s){
  s=String(s==null?'':s).trim(); if(!s)return null;
  if(/^\d+([.,]\d+)?$/.test(s)){var m=num(s);return m>0?Math.round(m*60):null}
  if(!/^\d{1,3}(:\d{1,2}){1,2}$/.test(s))return null;
  var p=s.split(':').map(Number);
  if(p.slice(1).some(function(x){return x>59}))return null;
  var seg=p.length===3?p[0]*3600+p[1]*60+p[2]:p[0]*60+p[1];
  return seg>0?seg:null;
}
function deSeg(seg){
  if(!(seg>0))return '';
  var h=Math.floor(seg/3600),m=Math.floor(seg%3600/60),s=Math.round(seg%60),pad=function(n){return String(n).padStart(2,'0')};
  if(s===60){s=0;m++} if(m===60){m=0;h++}
  return h?h+':'+pad(m)+':'+pad(s):m+':'+pad(s);
}
function redondo(x,d){var f=Math.pow(10,d||0);return Math.round(x*f)/f}
/* Máximo estimado con Epley: peso × (1 + reps/30). Solo con 10 repeticiones o menos. */
function epley(kg,reps){kg=num(kg);reps=num(reps);if(!(kg>0)||!(reps>=1)||reps>10||reps%1)return null;return redondo(kg*(1+reps/30),1)}
function esPropia(d){return String(d).indexOf('x:')===0}
function nombreDisc(d){var b=BASE.filter(function(x){return x[0]===d})[0];return b?b[1]:esPropia(d)?d.slice(2):String(d)}
function nuevoId(){return Date.now().toString(36)+Math.random().toString(36).slice(2,6)}

/* ---------- validar una marca ---------- */
/* Devuelve {ok:true, marca} o {ok:false, razon}. Todo es opcional menos la fecha, pero debe haber
   al menos un dato o una nota. */
function limpiar(disc,r,hoy){
  r=r||{}; var m={id:r.id||nuevoId(),fecha:r.fecha||hoy}, nota=String(r.nota||'').trim().slice(0,200);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(m.fecha))return {ok:false,razon:'Revisa la fecha.'};
  if(hoy&&m.fecha>hoy)return {ok:false,razon:'La fecha no puede ser futura.'};
  var sent=num(r.sent); if(sent>=1&&sent<=5)m.sent=Math.round(sent);
  if(nota)m.nota=nota;
  var malT=r.tiempo&&!aSeg(r.tiempo);
  if(malT)return {ok:false,razon:'El tiempo va como h:mm:ss o mm:ss (por ejemplo 28:30).'};
  var t=aSeg(r.tiempo);
  if(disc==='correr'){
    var d=DIST_CORRER.filter(function(x){return x[0]===r.dist})[0];
    if(d){m.dist=d[0];if(d[0]==='otra'){var km=pos(r.km,500);if(km)m.km=km;else delete m.dist}}
    if(t)m.seg=t;
    if(TIPO_CORRER.some(function(x){return x[0]===r.tipo}))m.tipo=r.tipo;
  } else if(disc==='gym'){
    var ej=String(r.ejercicio||'').trim().slice(0,60); if(ej)m.ej=ej;
    if(r.ejId)m.ejId=String(r.ejId).slice(0,40);
    var kg=pos(r.kg,600), reps=pos(r.reps,200); if(kg)m.kg=kg; if(reps)m.reps=Math.round(reps);
  } else if(disc==='natacion'){
    var mts=pos(r.m,20000); if(mts)m.m=Math.round(mts); if(t)m.seg=t;
  } else if(disc==='bici'){
    var kmb=pos(r.km,1000), kmh=pos(r.kmh,90); if(kmb)m.km=kmb; if(t)m.seg=t; if(kmh&&!t)m.kmh=kmh;
  } else {
    var dato=DATOS.some(function(x){return x[0]===r.dato})?r.dato:'nota'; m.dato=dato;
    if(dato==='tiempo'&&t)m.seg=t;
    if(dato==='duracion'){var mi=pos(r.min,1440);if(mi)m.min=Math.round(mi)}
    if(dato==='distancia'){var v=pos(r.km,1000);if(v)m.km=v}
    if(dato==='pesorep'){var k2=pos(r.kg,600),r2=pos(r.reps,500);if(k2)m.kg=k2;if(r2)m.reps=Math.round(r2)}
  }
  var datos=['dist','seg','ej','kg','reps','m','km','kmh','min'].some(function(k){return m[k]!=null});
  if(!datos&&!m.nota)return {ok:false,razon:'Escribe al menos un dato o una nota (por ejemplo: "hago dominadas, llego a 5").'};
  return {ok:true,marca:m};
}

/* ---------- guardar con tope ---------- */
function porFecha(a,b){return a.fecha<b.fecha?1:a.fecha>b.fecha?-1:0}   /* más reciente primero */
/* Agrega la marca y deja las 30 más recientes; devuelve también las que se archivan. */
function agregar(lista,marca){
  var l=(lista||[]).concat([marca]).sort(porFecha);
  return {lista:l.slice(0,MAX),archivadas:l.slice(MAX)};
}
function archivar(archivo,archivadas){return (archivo||[]).concat(archivadas||[]).sort(porFecha).slice(0,MAX_ARCHIVO)}

/* ---------- texto ---------- */
function ritmo(seg,km){if(!(seg>0&&km>0))return '';return deSeg(seg/km)+'/km'}
function textoMarca(disc,m){
  var t=[];
  if(disc==='correr'){
    var d=DIST_CORRER.filter(function(x){return x[0]===m.dist})[0], km=m.dist==='otra'?m.km:d&&d[2];
    if(d)t.push(m.dist==='otra'?m.km+' km':d[1]);
    if(m.seg)t.push((t.length?'en ':'')+deSeg(m.seg)+(km?' ('+ritmo(m.seg,km)+')':''));
    if(m.tipo)t.push('· '+TIPO_CORRER.filter(function(x){return x[0]===m.tipo})[0][1].toLowerCase());
  } else if(disc==='gym'||m.dato==='pesorep'){
    if(m.ej)t.push(m.ej);
    if(m.kg)t.push(m.kg+' kg'+(m.reps?' × '+m.reps:''));
    else if(m.reps)t.push(m.reps+' repeticiones');
    var e=m.reps===1?m.kg:epley(m.kg,m.reps); if(e&&m.reps>1)t.push('→ ~'+e+' kg máximo estimado');
  } else if(disc==='natacion'){
    if(m.m)t.push(m.m+' m'); if(m.seg)t.push((m.m?'en ':'')+deSeg(m.seg)+(m.m?' ('+deSeg(m.seg/m.m*100)+'/100 m)':''));
  } else if(disc==='bici'){
    if(m.km)t.push(m.km+' km'); var v=m.kmh||(m.seg&&m.km?redondo(m.km/(m.seg/3600),1):null);
    if(m.seg)t.push((m.km?'en ':'')+deSeg(m.seg)); if(v)t.push('a '+v+' km/h');
  } else {
    if(m.seg)t.push(deSeg(m.seg)); if(m.km)t.push(m.km+' km'); if(m.min)t.push(m.min+' min');
  }
  var s=t.join(' ');
  if(m.nota)s+=(s?' · ':'')+'"'+m.nota+'"';
  return s||'(sin datos)';
}
function textoFicha(f){
  if(!f)return '';var t=[];
  if(f.nivel)t.push(f.nivel);
  if(f.tiempo>0)t.push(f.tiempo+' '+(f.unidad==='meses'?(f.tiempo===1?'mes':'meses'):(f.tiempo===1?'año':'años')));
  if(f.frec>0)t.push(f.frec+'/sem'+(f.frecCuando==='pasada'?' (antes)':''));
  if(/^\d{4}-\d{2}$/.test(f.ultima||''))t.push('última vez '+['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'][+f.ultima.slice(5)-1]+' '+f.ultima.slice(0,4));
  return t.join(', ');
}
/* Lo más representativo de cada disciplina, en pocas palabras. */
function destacados(disc,lista){
  lista=(lista||[]).slice().sort(porFecha);
  if(disc==='correr'){
    var out=[];['21k','10k','5k'].forEach(function(d){var b=lista.filter(function(m){return m.dist===d&&m.seg}).sort(function(a,b){return a.seg-b.seg})[0];if(b&&out.length<2)out.push(textoMarca(disc,{dist:d,seg:b.seg}))});
    if(!out.length){var o=lista.filter(function(m){return m.dist==='otra'&&m.km}).sort(function(a,b){return b.km-a.km})[0];if(o)out.push(textoMarca(disc,{dist:'otra',km:o.km,seg:o.seg}))}
    return out;
  }
  if(disc==='gym'){
    var mej={};lista.forEach(function(m){if(!m.ej||!m.kg)return;var e=m.reps===1?m.kg:epley(m.kg,m.reps),k=m.ej.toLowerCase();var v=e||m.kg;if(!mej[k]||v>mej[k].v)mej[k]={v:v,est:!!e&&m.reps>1,m:m}});
    return Object.keys(mej).map(function(k){return mej[k]}).sort(function(a,b){return b.v-a.v}).slice(0,3).map(function(x){return x.m.ej.toLowerCase()+' '+(x.est?'~'+x.v+' kg estimado':x.m.kg+' kg × '+(x.m.reps||'?'))});
  }
  if(disc==='natacion'){var n=lista.filter(function(m){return m.m&&m.seg}).sort(function(a,b){return a.seg/a.m-b.seg/b.m})[0];return n?[textoMarca(disc,{m:n.m,seg:n.seg})]:[]}
  if(disc==='bici'){var b2=lista.filter(function(m){return m.km}).sort(function(a,b){return b.km-a.km})[0];return b2?[textoMarca(disc,{km:b2.km,seg:b2.seg,kmh:b2.kmh})]:[]}
  return lista.length&&(lista[0].seg||lista[0].km||lista[0].min||lista[0].kg)?[textoMarca(disc,Object.assign({},lista[0],{nota:null}))]:[];
}
/* Una línea por disciplina para el coach: marcas destacadas + ficha + última nota si no hay números. */
function resumen(disc,ficha,lista){
  var partes=destacados(disc,lista), f=textoFicha(ficha);
  if(!partes.length){var conNota=(lista||[]).slice().sort(porFecha).filter(function(m){return m.nota})[0];if(conNota)partes.push('"'+conNota.nota.slice(0,80)+'"')}
  if(!partes.length&&!f)return '';
  return nombreDisc(disc)+': '+partes.join(', ')+(partes.length&&f?' · ':'')+f;
}

/* ---------- experiencia para evaluar metas ----------
   Las carreras registradas suben la "carrera más larga terminada", y la salida más larga del último
   mes llena ese dato si no lo escribiste. Nunca bajan lo que pusiste a mano. */
var NIVEL_DIST={'5k':1,'10k':2,'21k':3,'42k':4,'703':5,'ironman':6};
function expConMarcas(exp,marcas,hoy){
  var e=Object.assign({},exp||{}), lista=((marcas||{}).correr)||[], nivel=NIVEL_DIST[e.max]||0;
  lista.forEach(function(m){
    if(m.tipo!=='carrera')return;
    var d=m.dist==='otra'?(m.km>=42?'42k':m.km>=21?'21k':m.km>=10?'10k':m.km>=5?'5k':null):m.dist;
    if(d&&NIVEL_DIST[d]>nivel){nivel=NIVEL_DIST[d];e.max=d}
  });
  if(!(+e.larga>0)&&hoy){
    var lim=new Date(hoy);lim.setDate(lim.getDate()-31);var limS=lim.toISOString().slice(0,10);
    var km=Math.max.apply(null,[0].concat(lista.filter(function(m){return m.fecha>=limS}).map(function(m){return m.dist==='otra'?m.km||0:(DIST_CORRER.filter(function(x){return x[0]===m.dist})[0]||[0,0,0])[2]})));
    if(km>0){e.larga=Math.round(km*2)/2;e.largaDeMarcas=true}
  }
  return e;
}

var API={BASE:BASE,DIST_CORRER:DIST_CORRER,TIPO_CORRER:TIPO_CORRER,DATOS:DATOS,NIVELES:NIVELES,MAX:MAX,MAX_ARCHIVO:MAX_ARCHIVO,
  aSeg:aSeg,deSeg:deSeg,epley:epley,esPropia:esPropia,nombreDisc:nombreDisc,limpiar:limpiar,agregar:agregar,archivar:archivar,
  textoMarca:textoMarca,textoFicha:textoFicha,resumen:resumen,expConMarcas:expConMarcas};
if(typeof module!=='undefined'&&module.exports)module.exports=API; else root.Marcas=API;
})(typeof window!=='undefined'?window:this);
