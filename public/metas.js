/* Reglas de metas: tipos, esfuerzo, disciplinas, bloqueo, revisión de riesgo y plan por fases.
   Sin DOM ni red: la app las usa (window.Metas) y las pruebas las revisan (node --test tests/).
   Los números son guías generales de entrenamiento, no indicaciones médicas. */
(function(root){
'use strict';

/* ---------- fechas (cadenas AAAA-MM-DD en hora local) ---------- */
var pad=function(n){return String(n).padStart(2,'0')};
function iso(d){return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())}
function parse(s){var p=String(s).split('-').map(Number);return new Date(p[0],p[1]-1,p[2])}
function addDays(d,n){var x=new Date(d);x.setDate(x.getDate()+n);return x}
function dias(a,b){return Math.round((parse(b)-parse(a))/864e5)}            /* de a hasta b */
function semanasEntre(a,b){return Math.floor(dias(a,b)/7)}
/* inicio de la semana que contiene s; ini = 0 lunes … 6 domingo */
function inicioSemana(s,ini){var x=parse(s);x.setDate(x.getDate()-((((x.getDay()+6)%7)-(ini||0)+7)%7));return iso(x)}
var MESES=['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
function fmt(s){var d=parse(s);return d.getDate()+' '+MESES[d.getMonth()]}
function redondo(x){return Math.round(x*2)/2}

/* ---------- tipos de meta y esfuerzo ---------- */
/* Cada tipo define qué disciplinas se entrenan. Las demás quedan bloqueadas mientras la meta esté activa. */
var TIPOS={
  calle:{t:'Carrera en calle',disc:['correr','gym'],enfoque:'Correr y fuerza en gimnasio.'},
  montana:{t:'Montaña o senderismo',disc:['correr','gym'],enfoque:'Correr en subida y en terreno, fuerza de piernas y gimnasio.'},
  triatlon:{t:'Triatlón',disc:['natacion','bici','correr','gym'],enfoque:'Natación, bici y carrera, más una sesión corta de fuerza a la semana.'}
};
/* n = nivel de esfuerzo, de menor a mayor */
var DIST={
  '5k':{t:'5K',n:1,tipo:'calle',km:5},
  '10k':{t:'10K',n:2,tipo:'calle',km:10},
  '21k':{t:'Medio maratón',n:3,tipo:'calle',km:21.1},
  '42k':{t:'Maratón',n:4,tipo:'calle',km:42.2},
  '703':{t:'Ironman 70.3',n:5,tipo:'triatlon'},
  'ironman':{t:'Ironman',n:6,tipo:'triatlon'}
};
var NIVEL=['','5K','10K','medio maratón','maratón','Ironman 70.3','Ironman'];
/* Montaña: km-esfuerzo = km + desnivel positivo / 100. Cortes para equipararlo a la escala de calle. */
var MONTANA_CORTES=[10,20,35,60,100];
/* Experiencia: carrera más larga terminada. */
var EXP=[['0','Ninguna'],['5k','5K'],['10k','10K'],['21k','Medio maratón'],['42k','Maratón'],['703','Ironman 70.3'],['ironman','Ironman']];
function nivelExp(exp){var m=(exp||{}).max;return DIST[m]?DIST[m].n:0}

function distDe(m){
  if(!m)return null;
  if(DIST[m.dist])return m.dist;
  if(m.tipo==='montana')return null;
  var n=String(m.nombre||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
  if(/70\.?3|medio ironman|half ironman/.test(n))return '703';
  if(/ironman/.test(n))return 'ironman';
  if(/medio|half|21/.test(n))return '21k';
  if(/marat|42/.test(n))return '42k';
  if(/10 ?k/.test(n))return '10k';
  if(/5 ?k/.test(n))return '5k';
  return null;
}
function tipoDe(m){if(m&&m.tipo==='montana')return 'montana';var d=distDe(m);return d?DIST[d].tipo:null}
function kmEsfuerzo(m){return (+m.km||0)+(+m.desnivel||0)/100}
function esfuerzo(m){
  var t=tipoDe(m);
  if(t==='montana'){var k=kmEsfuerzo(m),n=1;MONTANA_CORTES.forEach(function(c){if(k>=c)n++});return n}
  var d=distDe(m);return d?DIST[d].n:0;
}
function descripcion(m){
  var t=tipoDe(m);
  if(t==='montana')return 'Montaña '+(+m.km||0)+' km · '+(+m.desnivel||0)+' m de subida (≈ '+NIVEL[esfuerzo(m)]+')';
  var d=distDe(m);return d?DIST[d].t:'Otra';
}
function clave(m){return m.fecha+'|'+m.nombre}
function ordenar(l){return (l||[]).slice().sort(function(a,b){return a.fecha<b.fecha?-1:a.fecha>b.fecha?1:0})}

/* ---------- estado: principal, secundarias, en pausa ---------- */
function activa(m,hoy){return !m.lograda&&m.fecha>=hoy}
function principal(metas,hoy){return ordenar(metas).filter(function(m){return m.prio==='A'&&activa(m,hoy)})[0]||null}
/* Secundaria activa de mayor esfuerzo que la principal (p. ej. datos de antes de esta regla): espera su turno. */
function enPausa(m,metas,hoy){var p=principal(metas,hoy);return !!p&&clave(m)!==clave(p)&&activa(m,hoy)&&esfuerzo(m)>esfuerzo(p)}
function rol(m,metas,hoy){
  if(m.lograda)return 'lograda';
  if(m.fecha<hoy)return 'pasada';
  var p=principal(metas,hoy);
  if(p&&clave(p)===clave(m))return 'principal';
  return enPausa(m,metas,hoy)?'pausa':'secundaria';
}
/* Disciplinas permitidas: las del tipo de la meta principal; sin principal, todas (null). */
function disciplinas(metas,hoy){var p=principal(metas,hoy),t=p&&tipoDe(p);return t?TIPOS[t].disc.slice():null}

function no(razon,codigo){return {ok:false,razon:razon,codigo:codigo||'dato'}}
/* ¿Se puede agregar esta meta? Devuelve {ok, rol:'principal'|'secundaria'} o {ok:false, razon, codigo}. */
function validar(m,metas,hoy){
  var t=tipoDe(m);
  if(!m.fecha)return no('Elige la fecha de la meta.');
  if(m.fecha<hoy)return no('La fecha ya pasó.');
  if(!t)return no('Elige el tipo y la distancia de la meta.');
  if(t==='montana'&&!(+m.km>0))return no('Escribe la distancia de la ruta en km.');
  if(t==='montana'&&!(+m.desnivel>=0))return no('Escribe el desnivel positivo en metros (0 si es plano).');
  if((metas||[]).some(function(x){return clave(x)===clave(m)}))return no('Ya tienes esa meta.');
  var p=principal(metas,hoy);
  if(!p)return {ok:true,rol:'principal'};
  if(esfuerzo(m)>esfuerzo(p))return no('Tu meta principal es '+p.nombre+' ('+descripcion(p)+', '+fmt(p.fecha)+'). Mientras esté activa no puedes agregar una meta de mayor esfuerzo ('+descripcion(m)+'): tu plan está armado para la principal y sumar algo más exigente aumenta mucho el riesgo de lesión. Se habilita cuando pase su fecha o la marques como lograda.','mayor');
  return {ok:true,rol:'secundaria'};
}
/* ¿Puede esta meta pasar a ser la principal? Solo si no hay otra principal activa. */
function puedeSerPrincipal(m,metas,hoy){
  if(!activa(m,hoy))return no('Esa meta ya no está activa.');
  var p=principal(metas,hoy);
  if(p&&clave(p)!==clave(m))return no('Ya tienes una meta principal activa ('+p.nombre+'). Se puede cambiar cuando pase su fecha o la marques como lograda.','hay_principal');
  return {ok:true};
}

/* ---------- revisión de riesgo (semáforo) ---------- */
/* semanas desde hoy: [mínimo, recomendado]. Menos del mínimo = riesgoso; menos del recomendado = precaución. */
var PREP={1:{nueva:[6,8],conocida:[3,4]},2:{nueva:[8,10],conocida:[4,6]},3:{nueva:[12,16],conocida:[6,10]},4:{nueva:[18,20],conocida:[10,16]},5:{nueva:[20,24],conocida:[12,16]},6:{nueva:[30,36],conocida:[20,24]}};
var REQUISITO={4:3,5:3,6:5};   /* nivel que conviene haber terminado antes */
function revisar(metas,exp,hoy){
  var avisos=[], hecho=nivelExp(exp), prev=null;
  function av(m,nivel,texto){avisos.push({clave:clave(m),nivel:nivel,texto:texto})}
  ordenar(metas).filter(function(m){return activa(m,hoy)}).forEach(function(m){
    var n=esfuerzo(m); if(!n)return;
    var t=descripcion(m), nueva=n>hecho, s=semanasEntre(hoy,m.fecha), r=PREP[n][nueva?'nueva':'conocida'];
    if(s<r[0])av(m,'rojo','Faltan '+s+' semanas para '+t+'. '+(nueva?'Como sería tu primera vez en ese esfuerzo, ':'')+'lo mínimo seguro son '+r[0]+' semanas de preparación. Riesgo alto de lesión.');
    else if(s<r[1])av(m,'amarillo','Faltan '+s+' semanas para '+t+'. Lo ideal son '+r[1]+'; vas justo, así que la subida de carga será más cuidadosa.');
    if(REQUISITO[n]&&hecho<REQUISITO[n])av(m,'rojo','Antes de '+t+' conviene haber terminado al menos un '+NIVEL[REQUISITO[n]]+'. Saltar directo aumenta mucho el riesgo de lesión.');
    if(prev){
      var pn=esfuerzo(prev), g=semanasEntre(prev.fecha,m.fecha);
      if(pn>=4&&n>=4){if(g<12)av(m,'rojo','Solo '+g+' semanas después de otra prueba de larga distancia. Para recuperarte y volver a prepararte necesitas al menos 12.');else if(g<16)av(m,'amarillo','A '+g+' semanas de otra prueba de larga distancia. Lo ideal son 16 o más.')}
      else if(pn>=4&&n===3){if(g<4)av(m,'rojo','Solo '+g+' semanas después de una prueba de larga distancia. El cuerpo necesita al menos 4 para recuperarse.');else if(g<6)av(m,'amarillo','A '+g+' semanas de una prueba de larga distancia. Hazla suave, sin buscar marca.')}
      else if(pn===3&&n>=4){var min=nueva?12:4;if(g<min)av(m,'rojo',(nueva?'Tu primera prueba de este esfuerzo quedaría a solo '+g+' semanas de tu medio maratón. Deja al menos 12 semanas entre ambas. ':'Solo '+g+' semanas después de tu medio maratón. ')+'Riesgo alto de lesión.')}
      else if(n>=3&&pn>=3&&g<3)av(m,'amarillo','Dos pruebas largas con solo '+g+' semanas entre ellas.');
    }
    hecho=Math.max(hecho,n); prev=m;
  });
  return avisos;
}

/* ---------- plan por fases ----------
   Duración fija que termina en la semana de la meta, así que el número de semana no se mueve.
   Fases: Base → Desarrollo → Afinación (incluye la semana de la meta) → Recuperación (después). */
var PLAN_LEN={1:[8,6],2:[10,8],3:[16,12],4:[20,16],5:[20,16],6:[30,24]};   /* [primera vez, ya lo hizo] */
var AFINA={1:1,2:1,3:2,4:3,5:2,6:3};                                       /* incluye la semana de la meta */
var RECUP={1:1,2:1,3:2,4:3,5:3,6:4};                                       /* semanas después */
var LARGA_INI={0:3,1:5,2:8,3:12,4:14,5:14,6:16};                           /* km si no dice su salida reciente */
var LARGA_PICO={1:8,2:12,3:18,4:32,5:18,6:30};
var BICI_H={5:[1.5,3.5],6:[2,6]};                                          /* horas de bici larga: inicio, pico */
var FASES={
  pre:{t:'Base general',f:'Constancia y kilómetros suaves en Zona 2, más fuerza. Sin ritmos rápidos.'},
  base:{t:'Base',f:'Volumen suave en Zona 2, técnica y fuerza. Todavía nada de ritmo rápido.'},
  desarrollo:{t:'Desarrollo',f:'La sesión larga sube poco a poco y entra una sesión de calidad por semana (tempo o intervalos). Las últimas semanas son las más exigentes.'},
  afinacion:{t:'Afinación',f:'Baja el volumen, mantén un poco de ritmo y descansa para llegar fresco.'},
  recuperacion:{t:'Recuperación',f:'Actividad muy suave, movilidad y descanso. Nada intenso hasta que el cuerpo se sienta bien.'}
};
var DESCARGA='Semana de descarga: baja 20 a 30% el volumen para que el cuerpo asimile.';
var CARRERA='Semana de la meta: solo sesiones cortas y suaves. Duerme bien, come lo de siempre y disfruta.';

function plan(meta,exp,ini){
  var n=esfuerzo(meta), t=tipoDe(meta); if(!n)return null;
  var nueva=n>nivelExp(exp), L=PLAN_LEN[n][nueva?0:1], A=AFINA[n], rest=L-A;
  var base=Math.max(1,Math.round(rest*.4)), des=rest-base;
  var top=t==='montana'?Math.max(5,Math.min(35,redondo(+meta.km*.75))):LARGA_PICO[n];
  var ini0=+(exp||{}).larga>0?+exp.larga:LARGA_INI[nivelExp(exp)], paso=n>=4?2:1.5;
  var dTop=t==='montana'?Math.round(Math.min((+meta.desnivel||0)*.7,2500)/50)*50:0, bici=BICI_H[n];
  var inicio=iso(addDays(parse(inicioSemana(meta.fecha,ini)),-7*(L-1))), sem=[], lr=Math.min(ini0,top), max=0, bh=bici?bici[0]:0;
  for(var k=1;k<=L;k++){
    var fase=k<=base?'base':k<=rest?'desarrollo':'afinacion', ultimaDes=k===rest;
    var desc=fase!=='afinacion'&&!ultimaDes&&k%4===0, w={k:k,lunes:iso(addDays(parse(inicio),7*(k-1))),fase:fase,desc:desc,carrera:k===L};
    if(k<=rest){
      lr=Math.max(lr,Math.min(top,ini0+(top-ini0)*k/rest,lr+paso)); max=Math.max(max,lr);
      w.km=redondo(desc?lr*.75:lr);
      if(bici){bh=Math.min(bici[1],bici[0]+(bici[1]-bici[0])*k/rest);w.bici=redondo(desc?bh*.75:bh)}
    } else if(!w.carrera){var f=.75-.2*(k-rest-1);w.km=redondo(max*f);if(bici)w.bici=redondo(bh*f)}
    else w.km=DIST[distDe(meta)]&&DIST[distDe(meta)].km||null;
    if(dTop&&!w.carrera&&w.km)w.desnivel=Math.round(dTop*Math.min(1,w.km/top)/50)*50;
    sem.push(w);
  }
  return {meta:meta,tipo:t,n:n,L:L,nueva:nueva,inicio:inicio,sem:sem,ini:ini0,top:top,max:redondo(max),fases:{base:base,desarrollo:des,afinacion:A}};
}
/* Semana del plan que contiene la fecha: {k,...}, {pre:true,faltan} o null si ya pasó. */
function semanaPlan(p,fecha,ini){
  var k=Math.round(dias(p.inicio,inicioSemana(fecha,ini))/7)+1;
  if(k<1)return {pre:true,faltan:1-k,fase:'pre',km:redondo(Math.min(p.ini,p.top))};
  return p.sem[k-1]||null;
}
/* Recuperación tras la última meta principal terminada (lograda o con fecha pasada). */
function recuperacion(metas,hoy){
  var hechas=ordenar(metas).filter(function(m){return m.prio==='A'&&(m.lograda||m.fecha<hoy)&&esfuerzo(m)});
  for(var i=hechas.length-1;i>=0;i--){
    var m=hechas[i], fin=m.lograda&&m.lograda<m.fecha?m.lograda:m.fecha, d=dias(fin,hoy), R=RECUP[esfuerzo(m)];
    if(d>=0&&d<7*R)return {meta:m,k:Math.floor(d/7)+1,R:R};
  }
  return null;
}
/* Texto para el coach sobre la fase de la semana que empieza en fecha. */
function textoFase(metas,exp,hoy,fecha,ini){
  var out=[], rec=recuperacion(metas,fecha<hoy?hoy:fecha);
  if(rec)out.push('RECUPERACIÓN: semana '+rec.k+' de '+rec.R+' después de '+rec.meta.nombre+'. '+FASES.recuperacion.f);
  var p=principal(metas,hoy), pl=p&&plan(p,exp,ini);
  if(!pl){out.push(p?'PLAN: la meta principal no tiene un esfuerzo reconocible; arma semanas equilibradas.':'PLAN: sin meta principal; arma semanas equilibradas de mantenimiento.');return out.join('\n')}
  var s=semanaPlan(pl,fecha,ini), m=p.nombre+' ('+descripcion(p)+', '+p.fecha+')', enf=TIPOS[pl.tipo].enfoque;
  if(!s){out.push('PLAN: la meta principal ya pasó.');return out.join('\n')}
  if(s.pre)out.push('PLAN: '+(s.faltan===1?'falta 1 semana':'faltan '+s.faltan+' semanas')+' para que empiece el plan de '+pl.L+' semanas hacia '+m+'. Fase: Base general. '+FASES.pre.f+' '+enf+' Salida larga de hasta '+s.km+' km.');
  else{
    var extra=[];
    if(!s.carrera&&s.km)extra.push('salida larga objetivo '+s.km+' km'+(s.desnivel?' con unos '+s.desnivel+' m de subida':''));
    if(!s.carrera&&s.bici)extra.push('bici larga de '+s.bici+' h');
    out.push('PLAN: semana '+s.k+' de '+pl.L+' hacia '+m+'. Fase: '+FASES[s.fase].t+'. '+(s.carrera?CARRERA:s.desc?DESCARGA:FASES[s.fase].f)+' '+enf+(extra.length?' Objetivos: '+extra.join('; ')+' (no los pases más de 10%).':''));
  }
  return out.join('\n');
}

var API={
  iso:iso,parse:parse,addDays:addDays,dias:dias,semanasEntre:semanasEntre,inicioSemana:inicioSemana,fmt:fmt,
  TIPOS:TIPOS,DIST:DIST,NIVEL:NIVEL,EXP:EXP,FASES:FASES,DESCARGA:DESCARGA,CARRERA:CARRERA,
  distDe:distDe,tipoDe:tipoDe,esfuerzo:esfuerzo,kmEsfuerzo:kmEsfuerzo,descripcion:descripcion,clave:clave,ordenar:ordenar,nivelExp:nivelExp,
  activa:activa,principal:principal,enPausa:enPausa,rol:rol,disciplinas:disciplinas,validar:validar,puedeSerPrincipal:puedeSerPrincipal,
  revisar:revisar,plan:plan,semanaPlan:semanaPlan,recuperacion:recuperacion,textoFase:textoFase
};
if(typeof module!=='undefined'&&module.exports)module.exports=API; else root.Metas=API;
})(typeof window!=='undefined'?window:this);
