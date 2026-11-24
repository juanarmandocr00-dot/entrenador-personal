/* Mi Entrenador. Núcleo de la app (vistas y lógica). No contiene llaves ni secretos. */

(function(){
'use strict';
var DIAS=['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];
var pad=function(n){return String(n).padStart(2,'0')};
var iso=function(d){return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())};
var parse=function(s){var p=s.split('-').map(Number);return new Date(p[0],p[1]-1,p[2])};
var addDays=function(d,n){var x=new Date(d);x.setDate(x.getDate()+n);return x};
var dayName=function(d){return DIAS[(d.getDay()+6)%7]};
var startIdx=function(){var i=DIAS.indexOf((S.perfil||{}).inicioSemana);return i<0?0:i};
var monday=function(d){var x=new Date(d);x.setDate(x.getDate()-((((x.getDay()+6)%7)-startIdx()+7)%7));x.setHours(0,0,0,0);return x};
var MESES=['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
var fmt=function(s){var d=parse(s);return d.getDate()+' '+MESES[d.getMonth()]};

var S={perfil:{},semanas:{},pesos:{},molestias:{},archivo:{}};
var db=null, sample=null, tab='hoy', busy=false, msg='', chat=[], draftMood=null, razon=false, lastTriage=null, drafts={}, descargas=null, acct=null, gymSearch=null, nuevaMeta={tipo:'calle',dist:'21k'}, revisar=null, msgMeta='', bloqueo='', quitarMeta=null, marcaUi=null, discAbierta=null;
var ICON={
  hoy:'<path d="M4 11l8-7 8 7v9a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z"/>',
  check:'<path d="M5 12l4 4 10-10"/><rect x="3" y="3" width="18" height="18" rx="4"/>',
  coach:'<path d="M4 5h16v11H9l-5 4z"/>',
  prog:'<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1"/>',
  perfil:'<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/>'
};
var TABS=[['hoy','Hoy'],['check','Check-in'],['coach','Coach'],['prog','Plan'],['perfil','Perfil']];

function h(tag,attrs){
  var e=document.createElement(tag);
  if(attrs){for(var k in attrs){var v=attrs[k];
    if(k==='class')e.className=v; else if(k==='text')e.textContent=v; else if(k==='style')e.style.cssText=v;
    else if(k.slice(0,2)==='on')e.addEventListener(k.slice(2),v);
    else if(v===true)e.setAttribute(k,''); else if(v!==false&&v!=null)e.setAttribute(k,v);}}
  for(var i=2;i<arguments.length;i++){var c=arguments[i];if(c==null||c===false)continue;
    if(Array.isArray(c))c.forEach(function(x){if(x)e.appendChild(x)}); else e.appendChild(typeof c==='string'?document.createTextNode(c):c);}
  return e;
}

/* ---------- datos ---------- */
function perfil(){var p=S.perfil||{};return Object.assign({libres:[],no:[],descanso:'',carga:'Normal',inicioSemana:'Lun',minutos:{},porque:'',metas:[],gym:{}},p)}
function guardar(coleccion,id,data){
  S[coleccion][id]=data; render();
  if(db){return db.doc(coleccion+'/'+id).set(data).catch(function(){msg='No se pudo guardar. Revisa tu conexión.';render()})}
  return Promise.resolve();
}
function guardarPerfil(patch){var antes=S.perfil,p=Object.assign({},perfil(),patch);S.perfil=p;if(db)db.doc('perfil/yo').set(p).catch(function(){S.perfil=antes;msg='No se pudo guardar el cambio. Revisa tu conexión e inténtalo otra vez.';render()});}
function semanaActual(){return S.semanas[iso(monday(new Date()))]}
function proximaMeta(){
  var hoy=iso(new Date());
  return MT.ordenar(perfil().metas).filter(function(x){return MT.activa(x,hoy)})[0]||null;
}
function pesosOrdenados(){return Object.keys(S.pesos).sort().map(function(k){return S.pesos[k]})}

/* ---------- metas: las reglas viven en metas.js (probadas con node --test) ---------- */
var MT=window.Metas, MR=window.Marcas, FASES=MT.FASES;
function hoyS(){return iso(new Date())}
/* la experiencia escrita a mano, completada con tus marcas de correr (nunca la baja) */
function expP(){var p=perfil();return MR.expConMarcas(p.exp,p.marcas,hoyS())}
function metasP(){return perfil().metas||[]}
function metaPrincipal(){return MT.principal(metasP(),hoyS())}
function revisarMetas(metas){return MT.revisar(metas,expP(),hoyS())}
function planDe(meta){return MT.plan(meta,expP(),startIdx())}
function semanaPlan(pl,f){return MT.semanaPlan(pl,f,startIdx())}
function textoFase(f){return MT.textoFase(metasP(),expP(),hoyS(),f,startIdx())}
function claveMeta(m){return MT.clave(m)}
function permitidas(){return MT.disciplinas(metasP(),hoyS())}
/* Una línea por disciplina que está en el plan de la semana (y permitida por la meta). Nunca la lista completa. */
function lineasMarcas(){var p=perfil();return planSel().disc.map(function(k){return MR.resumen(k,(p.discExp||{})[k],(p.marcas||{})[k])}).filter(Boolean)}
function nivelDe(avisos,m){var k=claveMeta(m),l=avisos.filter(function(x){return x.clave===k});return l.some(function(x){return x.nivel==='rojo'})?'rojo':l.length?'amarillo':'verde'}

/* ---------- coach ---------- */
var REGLAS=[
 'Eres el entrenador personal de Armando (30 años, Nuevo León, México). Habla en español claro y directo.',
 'No eres médico. Ante dolor o molestia activa, baja la carga y recomienda ver a un médico deportivo o fisioterapeuta; si hay dolor fuerte, hinchazón o no puede apoyar, dile que no entrene y que acuda a un médico.',
 'Armando es supinador y corre con Adidas Duramo SL2. Ritmo de Zona 2: 7:30 por km. Quiere bajar 8 kg o más (empezó el 14 de octubre de 2026).',
 'Gimnasio: el del campo gym del perfil. Usa solo los aparatos de gym.aparatos; si esa lista no existe o está vacía, arma la rutina con aparatos básicos (peso corporal, mancuernas, barra, banco, bandas). Rutinas con tres niveles: Básica, Media y Alta.',
 'Programa solo las disciplinas que Armando eligió para la semana (correr, gym, natación, bici); el resto de los días es descanso. Si eligió los días de una disciplina, respétalos; si no, distribúyelas tú con buen espaciado. Con varias disciplinas cuida el volumen total: natación y bici en Zona 2 salvo que el plan pida otra cosa.',
 'Nunca dupliques la carga por una sesión perdida. Prioridad si hay que elegir: salida larga, luego pierna, luego brazo.',
 'La pierna solo en nivel Básica o Media si cae a menos de 48 horas de la salida larga.',
 'Dos sesiones perdidas seguidas reducen la semana. "No realizada" no es lo mismo que "Descanso".',
 'Día de sobreesfuerzo: es un día libre de su trabajo o escuela, no de ejercicio. Ahí va la salida larga o la sesión más exigente, con tope de seguridad, y el día siguiente va más ligero.',
 'Respeta los días en que no puede entrenar y los minutos disponibles de cada día. No subas el volumen semanal de golpe.',
 'En la semana previa a una carrera baja el volumen y evita sesiones nuevas o muy duras.',
 'La META PRINCIPAL manda el plan: cada semana la acerca a ella según su fase (base, desarrollo, afinación y recuperación). Las metas secundarias son de menor esfuerzo y van dentro del plan: solo baja la carga 2 o 3 días antes, sin afinación completa. Las metas en pausa no se entrenan todavía.',
 'Usa solo las DISCIPLINAS PERMITIDAS por la meta principal; nunca programes otras. En metas de montaña, las salidas van en subida o en terreno y la fuerza se enfoca en piernas.',
 'Sigue la fase del PLAN de la semana que generas: su enfoque y sus objetivos. En semana de descarga baja el volumen aunque el usuario se sienta bien. Si hubo una carrera en los últimos 10 días, empieza con días de recuperación.',
 'Si hay RIESGOS en rojo, dilo en el resumen y prioriza la salud: no subas el volumen más rápido de lo seguro para llegar a esa carrera.'
].join('\n');

function contexto(){
  var p=perfil(), sem=semanaActual(), pesos=pesosOrdenados().slice(-8);
  var hoy=new Date(), lim=iso(addDays(hoy,-14));
  var mol=Object.keys(S.molestias).map(function(k){return S.molestias[k]}).filter(function(m){return m.fecha>=lim});
  var hoyI=iso(hoy), ROLES={principal:'principal',secundaria:'secundaria',pausa:'en pausa: no entrenar para ella todavía'};
  var metas=MT.ordenar(p.metas).filter(function(m){return MT.activa(m,hoyI)}).map(function(m){return {nombre:m.nombre,fecha:m.fecha,meta:MT.descripcion(m),rol:ROLES[MT.rol(m,p.metas,hoyI)],semanasRestantes:MT.semanasEntre(hoyI,m.fecha)}});
  var mp=metaPrincipal(), perm=permitidas(), riesgos=revisarMetas(p.metas||[]).map(function(x){return x.nivel+': '+x.texto});
  var recientes=(p.metas||[]).filter(function(m){var fin=m.lograda||m.fecha;return (m.lograda||m.fecha<hoyI)&&fin>=iso(addDays(hoy,-10))}).map(function(m){return m.nombre+' '+(m.lograda||m.fecha)+(m.lograda?' (lograda)':'')});
  return REGLAS+'\n\nHoy es '+DIAS[(hoy.getDay()+6)%7]+' '+iso(hoy)+'.\n'
   +'PERFIL: '+JSON.stringify({libres:p.libres,noPuedeEntrenar:p.no,diaSobreesfuerzo:p.descanso,cargaDeTrabajo:p.carga,minutosPorDia:p.minutos,gym:p.gym,porque:p.porque,carreraMasLargaTerminada:(MT.EXP.filter(function(e){return e[0]===((p.exp||{}).max||'0')})[0]||MT.EXP[0])[1]})+'\n'
   +'METAS: '+JSON.stringify(metas)+'\n'
   +'CARRERAS RECIENTES (10 días): '+JSON.stringify(recientes)+'\n'
   +'META PRINCIPAL: '+(mp?mp.nombre+' ('+MT.descripcion(mp)+') el '+mp.fecha+', faltan '+MT.semanasEntre(hoyI,mp.fecha)+' semanas. '+MT.TIPOS[MT.tipoDe(mp)].enfoque:'ninguna')+'\n'
   +'DISCIPLINAS PERMITIDAS: '+(perm?perm.join(', '):'todas (no hay meta principal)')+'\n'
   +'RIESGOS: '+JSON.stringify(riesgos)+'\n'
   +'MARCAS Y EXPERIENCIA (disciplinas de esta semana): '+(function(l){return l.length?l.join(' | '):'sin datos'})(lineasMarcas())+'\n'
   +textoFase(iso(hoy))+'\n'
   +'SEMANA ACTUAL: '+JSON.stringify(sem&&sem.dias||[])+'\n'
   +'PESOS RECIENTES: '+JSON.stringify(pesos.map(function(x){return {f:x.fecha,kg:x.kg,animo:x.animo}}))+'\n'
   +'MOLESTIAS RECIENTES: '+JSON.stringify(mol.map(function(m){return {f:m.fecha,zona:m.zona,intensidad:m.intensidad,nivel:m.nivel}}));
}

function idsEjercicios(d){
  if(!window.Ejercicios||!d)return [];
  var ids=(d.ejercicios||[]).filter(function(i){return Ejercicios.existe(i)});
  if(!ids.length&&d.tipo==='gym'){var n=d.niveles||{};ids=Ejercicios.detectar([d.titulo,d.detalle,n.basica,n.media,n.alta].join(' '))}
  return ids.filter(function(x,i,a){return a.indexOf(x)===i}).slice(0,8);
}
function bloqueEjercicios(d){
  var ids=idsEjercicios(d);if(!ids.length)return null;
  var b=h('div',{class:'ejs'},h('h3',{text:'Cómo se hacen'}));
  ids.forEach(function(i){var f=Ejercicios.figura(i);if(f)b.appendChild(f)});
  return b;
}
var DISC=[['correr','Correr'],['gym','Gym'],['natacion','Natación'],['bici','Bici']];
/* Con meta principal solo aparecen sus disciplinas; las demás (y las propias) quedan bloqueadas. */
function discList(){var perm=permitidas();if(perm)return DISC.filter(function(d){return perm.indexOf(d[0])>=0});return DISC.concat((perfil().extras||[]).map(function(n){return ['x:'+n,n]}))}
function planSel(){var q=perfil().plan||{};var disc=(q.disc||[]).filter(function(x){return discList().some(function(d){return d[0]===x})});return {disc:disc.length?disc:(permitidas()||['correr','gym']),modo:q.modo==='manual'?'manual':'auto',dias:q.dias||{}}}
function textoPlan(){var pl=planSel(),perm=permitidas(),s=(perm?'DISCIPLINAS PERMITIDAS POR LA META PRINCIPAL: '+perm.join(', ')+'. No uses ninguna otra.\n':'')+'DISCIPLINAS ELEGIDAS PARA ESTA SEMANA: '+pl.disc.map(function(k){return k.indexOf('x:')===0?k.slice(2)+' (disciplina propia, tipo "otra"; pon su nombre al inicio del título)':k}).join(', ')+'.';
  if(pl.modo==='manual'){var o={};pl.disc.forEach(function(k){o[k]=pl.dias[k]||[]});s+=' Armando eligió los días de cada disciplina: '+JSON.stringify(o)+'. Respétalos y distribuye tú las que queden sin días.'}
  else s+=' Distribuye los días tú.';return s}
function errorCoach(e,que){var c=e&&e.code;if(c==='not_granted')return 'Tu sesión no tiene permiso para usar el coach. Cierra sesión y vuelve a entrar.';if(c==='rate_limited')return 'Llegaste al límite de consultas de hoy. Mañana se reinicia.';if(c==='offline')return 'No hay conexión con el coach. Revisa tu internet.';if(c==='timeout')return 'El coach tardó demasiado. Inténtalo otra vez.';if(c==='bad_json')return 'La respuesta del coach llegó incompleta. Inténtalo otra vez.';return que}
function planificar(semanaIso,reajuste){
  if(!sample){msg='El coach no está disponible en esta vista.';render();return}
  busy=true;msg='Pensando tu semana. Puede tardar un minuto.';render();
  var inicio=parse(semanaIso), fechas=DIAS.map(function(_,i){var f=addDays(inicio,i);return dayName(f)+' '+iso(f)}).join(', ');
  var desde=reajuste?iso(new Date()):semanaIso;
  var prompt=contexto()+'\n\nTAREA: '+(reajuste?'Reajusta lo que queda de la semana desde '+desde+' inclusive, considerando las sesiones ya hechas o no realizadas.':'Genera la rutina de la semana de entrenamiento que empieza el '+dayName(inicio)+' '+semanaIso+' y termina 6 días después. Armando elige el día de inicio, no tiene que ser lunes.')
   +'\nDías de la semana: '+fechas+'.\n'+textoFase(semanaIso)+'\n'+textoPlan()+(window.Ejercicios?'\nEJERCICIOS CON ILUSTRACIÓN (ids): '+Ejercicios.lista.map(function(x){return x.id+' ('+x.nombre+')'}).join(', ')+'. En cada sesión de gym agrega "ejercicios":["id"] con 3 a 6 ids de esa lista, acordes a los aparatos disponibles y al grupo muscular del día; los ejercicios que no estén en la lista van solo en el texto.':'')+'\nDevuelve SOLO JSON con esta forma: {"resumen":"2 frases","dias":[{"dia":"Lun","fecha":"AAAA-MM-DD","tipo":"correr|gym|natacion|bici|otra|descanso","titulo":"corto","detalle":"qué hacer, con ritmos o ejercicios","min":0,"niveles":{"basica":"...","media":"...","alta":"..."}}]}. Incluye un objeto por cada día desde '+desde+'. Los niveles solo en sesiones de gym. Usa "descanso" para días sin entrenar.';
  sample.json(prompt,{modelTier:'default',cache:false}).then(function(r){
    var pf=perfil(), perm=permitidas(), okTipo={correr:1,gym:1,natacion:1,bici:1,otra:1,descanso:1}, rango={};
    DIAS.forEach(function(_,i){rango[iso(addDays(inicio,i))]=1});
    var cut=function(v,n){return String(v==null?'':v).slice(0,n)};
    var nuevo=(r&&Array.isArray(r.dias)?r.dias:[]).filter(function(d){return d&&typeof d.fecha==='string'&&rango[d.fecha]&&d.fecha>=desde}).map(function(d){
      var dn=dayName(parse(d.fecha)), t=okTipo[d.tipo]?d.tipo:'descanso', min=Math.max(0,Math.min(300,parseInt(d.min,10)||0)), cap=pf.minutos[dn];
      var o={dia:dn,fecha:d.fecha,tipo:t,titulo:cut(d.titulo,80),detalle:cut(d.detalle,600),min:min};
      if(perm&&o.tipo!=='descanso'&&perm.indexOf(o.tipo)<0){o.tipo='descanso';o.titulo='Descanso';o.detalle='El coach propuso una disciplina que no es parte de tu meta principal, así que este día queda de descanso.';o.min=0}
      if(pf.no.indexOf(dn)>=0||cap===0){o.tipo='descanso';o.titulo='No entrenas';o.detalle='Marcaste este día como no disponible.';o.min=0}
      else if(cap!=null&&min>cap){o.min=cap;o.detalle+=' (Ajustado a tus '+cap+' min disponibles.)'}
      if(o.tipo==='gym'&&window.Ejercicios&&Array.isArray(d.ejercicios))o.ejercicios=d.ejercicios.filter(function(i){return typeof i==='string'&&Ejercicios.existe(i)}).filter(function(x,i,a){return a.indexOf(x)===i}).slice(0,8);
      if(d.niveles&&o.tipo==='gym')o.niveles={basica:cut(d.niveles.basica,400),media:cut(d.niveles.media,400),alta:cut(d.niveles.alta,400)};
      return o});
    if(!nuevo.length)throw new Error('vacío');
    var previo=(S.semanas[semanaIso]&&S.semanas[semanaIso].dias)||[];
    var mapa={};previo.forEach(function(d){mapa[d.fecha]=d});
    nuevo.forEach(function(d){var antes=mapa[d.fecha];d.estado=(antes&&antes.estado&&!reajuste)?antes.estado:'pendiente';
      if(reajuste&&antes&&antes.estado&&antes.estado!=='pendiente'&&d.fecha<desde)d=antes; mapa[d.fecha]=d});
    var dias=DIAS.map(function(_,i){var f=iso(addDays(inicio,i));return mapa[f]}).filter(Boolean);
    busy=false;msg='';
    return guardar('semanas',semanaIso,{inicio:semanaIso,dias:dias,resumen:r.resumen||'',generada:Date.now()});
  }).catch(function(e){busy=false;msg=errorCoach(e,'No pude generar la semana. Inténtalo otra vez.');render()});
}

function enviarChat(texto){
  if(!sample||!texto.trim())return;
  chat.push({role:'user',content:texto});busy=true;render();
  var rec=chat.slice(-9);var turnos=rec.map(function(t,i){return i===0?{role:'user',content:contexto()+'\n\nPREGUNTA: '+t.content}:t});
  sample(turnos,{modelTier:'default',cache:false}).then(function(r){chat.push({role:'assistant',content:r.text});busy=false;render()})
   .catch(function(e){chat.pop();busy=false;msg=errorCoach(e,'No pude responder. Inténtalo otra vez.');render()});
}

/* ---------- vistas ---------- */
function cuenta(meta){var d=Math.round((parse(meta.fecha)-parse(iso(new Date())))/864e5);return d}

function vistaHoy(){
  var out=[], meta=proximaMeta(), sem=semanaActual(), hoyIso=iso(new Date()), p=perfil();
  var n=meta?cuenta(meta):null, semanaCarrera=meta&&n<=7;
  /* la carrera solo es protagonista en su semana; el resto del tiempo manda el entreno de hoy */
  if(semanaCarrera)out.push(h('div',{class:'race'},h('div',{class:'kicker',text:'Semana de carrera'}),h('div',{class:'row sp'},h('div',null,h('div',{class:'big',text:n===0?'Hoy':String(n)}),h('div',{class:'small',text:n===0?'':(n===1?'día':'días')})),h('div',{style:'text-align:right'},h('h3',{text:meta.nombre}),h('div',{class:'small',text:fmt(meta.fecha)})))));
  var lim3=iso(addDays(new Date(),-3)), mr=Object.keys(S.molestias).map(function(k){return S.molestias[k]}).filter(function(m){return m.fecha>=lim3&&(m.nivel==='urgente'||m.nivel==='pronto')});
  if(mr.length){var urg=mr.some(function(m){return m.nivel==='urgente'}), zs=mr.map(function(m){return m.zona}).filter(function(z,i,a){return a.indexOf(z)===i}).join(', ');
    out.push(h('div',{class:urg?'alert':'note'},h('b',{text:urg?'Molestia urgente reciente. ':'Molestia reciente. '}),(urg?'No entrenes hasta que te revise un médico. ':'Baja la carga y evita impacto. ')+'Zona: '+zs+'.'))}
  if(revisarMetas(p.metas||[]).some(function(x){return x.nivel==='rojo'}))out.push(h('div',{class:'alert'},h('b',{text:'Tu plan de carreras tiene un riesgo alto. '}),'El coach va a priorizar tu salud. ',h('button',{class:'link',onclick:function(){tab='prog';render();window.scrollTo(0,0)}},'Revisar metas')));
  if(!p.libres.length&&!p.no.length&&!p.descanso){out.push(h('div',{class:'note'},'Aún no me dices tus días libres. ',h('button',{class:'chip',style:'margin-left:4px',onclick:function(){tab='perfil';render()}},'Configurar')))}
  var hoyDia=sem&&sem.dias.find(function(d){return d.fecha===hoyIso});
  if(hoyDia){
    var desc=hoyDia.tipo==='descanso';
    var c=h('div',{class:'hero t-'+hoyDia.tipo},
      h('div',{class:'row sp'},h('div',{class:'kicker',text:'Hoy · '+hoyDia.dia+' '+fmt(hoyDia.fecha)}),desc?null:estadoPill(hoyDia)),
      h('h2',{class:'hero-t',text:hoyDia.titulo}),
      hoyDia.detalle?h('p',{class:'mut',text:hoyDia.detalle}):null,
      hoyDia.min?h('div',{class:'small mut',text:hoyDia.min+' min · '+nombreTipo(hoyDia.tipo)}):desc?h('div',{class:'small mut',text:'Recupera. También es parte del plan.'}):null);
    var ebh=bloqueEjercicios(hoyDia);if(ebh)c.appendChild(h('details',null,h('summary',null,h('span',{class:'t',text:'Ver cómo se hacen los ejercicios'})),ebh));
    if(!desc&&hoyDia.estado==='pendiente'){
      c.appendChild(h('div',{class:'row'},h('button',{class:'p',onclick:function(){marcar(hoyDia.fecha,'hecha')}},'Hecha'),h('button',{onclick:function(){razon=!razon;render()}},'Hoy no pude')));
      if(razon){c.appendChild(h('div',{class:'row'},['Trabajo','Cansancio','Dolor','Clima','Otra'].map(function(m){return h('button',{class:'chip',onclick:function(){razon=false;marcar(hoyDia.fecha,'no_realizada',m);if(m==='Dolor'){tab='check';render()}}},m)})))}
    }
    if(hoyDia.estado==='no_realizada'){c.appendChild(h('p',{class:'small mut',text:'Quedó como no realizada'+(hoyDia.motivo?' ('+hoyDia.motivo+')':'')+'. No se duplica en otro día.'}));
      c.appendChild(h('button',{onclick:function(){planificar(iso(monday(new Date())),true)},disabled:busy},'Reajustar el resto de la semana'))}
    out.push(c);
  } else out.push(h('div',{class:'hero'},h('div',{class:'kicker',text:'Hoy · '+dayName(new Date())+' '+fmt(hoyIso)}),h('h2',{class:'hero-t',text:'Tu semana aún no está lista'}),h('p',{class:'mut',text:'Elige abajo qué vas a entrenar y genera tu semana.'})));
  var mpH=metaPrincipal(), plH=mpH&&planDe(mpH), swH=plH&&semanaPlan(plH,hoyIso), recH=MT.recuperacion(p.metas||[],hoyIso);
  function irPlan(){tab='prog';render();window.scrollTo(0,0)}
  if(recH)out.push(h('button',{class:'fase-hoy',onclick:irPlan},h('span',{class:'kicker',text:'Recuperación · semana '+recH.k+' de '+recH.R}),h('span',null,'Después de ',h('b',{text:recH.meta.nombre}),'. Todo suave esta semana.')));
  else if(swH&&!swH.pre&&!swH.carrera)out.push(h('button',{class:'fase-hoy',onclick:irPlan},h('span',{class:'kicker',text:'Semana '+swH.k+' de '+plH.L}),h('span',null,h('b',{text:FASES[swH.fase].t+(swH.desc?' · descarga':'')}),swH.km?' · salida larga '+swH.km+' km':'')));
  if(meta&&!semanaCarrera){var mp=metaPrincipal();
    out.push(h('div',{class:'race-mini'},h('div',{class:'race-n'},h('span',{class:'num',text:String(n)}),h('span',{class:'small mut',text:n===1?'día':'días'})),
      h('div',{class:'race-i'},h('b',{text:meta.nombre}),h('div',{class:'small mut',text:fmt(meta.fecha)+(mp&&claveMeta(mp)===claveMeta(meta)?' · meta principal':'')}))))}
  else if(!meta)out.push(h('div',{class:'race-mini'},h('div',{class:'race-i'},h('b',{text:'Sin carreras próximas'}),h('div',{class:'small mut',text:'Una meta le da dirección a tus semanas.'})),h('button',{class:'chip',onclick:function(){tab='prog';render();window.scrollTo(0,0)}},'Agregar meta')))
  out.push(vistaSemana(sem));
  if(msg)out.push(h('div',{class:'note',text:msg}));
  return out;
}
var TIPOS={correr:'Correr',gym:'Gym',natacion:'Natación',bici:'Bici',otra:'Otra',descanso:'Descanso'};
function nombreTipo(t){return TIPOS[t]||'Otra'}
function marcador(d,hoyIso){
  if(d.estado==='hecha')return h('span',{class:'st ok',title:'Hecha'},'✓',h('span',{class:'sr',text:'Hecha'}));
  if(d.estado==='no_realizada')return h('span',{class:'st bad',title:'No realizada'},'✕',h('span',{class:'sr',text:'No realizada'}));
  if(d.fecha===hoyIso&&d.tipo!=='descanso')return h('span',{class:'pill acc',text:'Hoy'});
  return null;
}
/* tira de 7 días: color = disciplina, relleno = hecha, ✕ = no realizada; el texto de cada día lo dice también */
function tiraSemana(sem,hoyIso){
  var tipos=[];
  var t=h('div',{class:'tira',role:'list','aria-label':'Resumen de la semana'},sem.dias.map(function(d){
    if(d.tipo!=='descanso'&&tipos.indexOf(d.tipo)<0)tipos.push(d.tipo);
    var est=d.tipo==='descanso'?'descanso':d.estado==='hecha'?'hecha':d.estado==='no_realizada'?'no realizada':'pendiente';
    return h('div',{class:'td t-'+d.tipo+' e-'+(d.estado||'pendiente')+(d.fecha===hoyIso?' hoy':''),role:'listitem','aria-label':d.dia+': '+(d.tipo==='descanso'?'descanso':d.titulo+', '+est),title:d.dia+' · '+d.titulo},
      h('span',{class:'td-l',text:d.dia.charAt(0)}),h('span',{class:'td-p'},d.estado==='no_realizada'?'✕':''));
  }));
  var ley=h('div',{class:'leyenda small mut'},tipos.map(function(k){return h('span',{class:'t-'+k},h('i'),nombreTipo(k))}));
  return h('div',null,t,ley);
}
function estadoPill(d){
  if(d.tipo==='descanso')return h('span',{class:'pill',text:'Descanso'});
  if(d.estado==='hecha')return h('span',{class:'pill ok',text:'Hecha'});
  if(d.estado==='no_realizada')return h('span',{class:'pill bad',text:'No realizada'});
  return h('span',{class:'pill acc',text:'Pendiente'});
}
function marcar(fecha,estado,motivo){
  var k=iso(monday(parse(fecha))), sem=S.semanas[k]; if(!sem)return;
  var dias=sem.dias.map(function(d){return d.fecha===fecha?Object.assign({},d,{estado:estado,motivo:motivo||''}):d});
  guardar('semanas',k,Object.assign({},sem,{dias:dias}));
}
function selectorSemana(){
  var pl=planSel(), box=h('div',{style:'display:flex;flex-direction:column;gap:10px'});
  var perm=permitidas(), mpS=metaPrincipal();
  box.appendChild(h('div',{class:'small mut',text:'¿Qué entrenas en la semana que vas a generar?'}));
  box.appendChild(h('div',{class:'row'},discList().map(function(x){return h('button',{class:'chip','aria-pressed':String(pl.disc.indexOf(x[0])>=0),onclick:function(){var d=toggle(pl.disc,x[0]);if(!d.length)return;guardarPerfil({plan:Object.assign({},pl,{disc:d})});render()}},x[1])})));
  box.appendChild(h('div',{class:'row'},[['auto','Días automáticos'],['manual','Elegir los días']].map(function(m){return h('button',{class:'chip','aria-pressed':String(pl.modo===m[0]),onclick:function(){guardarPerfil({plan:Object.assign({},pl,{modo:m[0]})});render()}},m[1])})));
  if(pl.modo==='manual')discList().filter(function(x){return pl.disc.indexOf(x[0])>=0}).forEach(function(x){
    box.appendChild(grupo('Días de '+x[1].toLowerCase(),'',pl.dias[x[0]]||[],function(d){var dd=Object.assign({},pl.dias);dd[x[0]]=toggle(dd[x[0]]||[],d);guardarPerfil({plan:Object.assign({},pl,{dias:dd})});render()}))});
  if(perm){box.appendChild(h('p',{class:'small mut',text:'Tu meta principal ('+mpS.nombre+') usa: '+discList().map(function(d){return d[1]}).join(', ')+'. Las demás disciplinas están bloqueadas hasta que la termines.'}));return box}
  var ext=perfil().extras||[], nx=h('input',{type:'text',id:'dx',maxlength:'30',placeholder:'Otra disciplina (ej. yoga, remo)'});
  function agregarDisc(){var v=nx.value.trim();if(!v||ext.length>=6||ext.some(function(e){return e.toLowerCase()===v.toLowerCase()})||DISC.some(function(d){return d[1].toLowerCase()===v.toLowerCase()}))return;nx.value='';drafts.dx='';guardarPerfil({extras:ext.concat([v]),plan:Object.assign({},pl,{disc:pl.disc.concat(['x:'+v])})});render()}
  nx.addEventListener('keydown',function(ev){if(ev.key==='Enter'){ev.preventDefault();agregarDisc()}});
  box.appendChild(h('div',{class:'row'},nx,h('button',{onclick:agregarDisc},'Agregar disciplina')));
  if(ext.length)box.appendChild(h('div',{class:'row'},ext.map(function(n){return h('button',{class:'link','aria-label':'Quitar '+n,onclick:function(){var k='x:'+n,dd=Object.assign({},pl.dias);delete dd[k];guardarPerfil({extras:ext.filter(function(e){return e!==n}),plan:Object.assign({},pl,{disc:pl.disc.filter(function(x){return x!==k}).length?pl.disc.filter(function(x){return x!==k}):['correr'],dias:dd})});render()}},'Quitar '+n)})));
  return box;
}
function vistaSemana(sem){
  var lunes=iso(monday(new Date())), sig=iso(addDays(monday(new Date()),7));
  var c=h('div',{class:'card'},h('div',{class:'row sp'},h('h2',{text:'Mi semana'}),sem?h('span',{class:'small mut',text:sem.dias.filter(function(d){return d.estado==='hecha'}).length+' de '+sem.dias.filter(function(d){return d.tipo!=='descanso'}).length+' hechas'}):null));
  if(sem){
    var p=perfil(), hoyIso=iso(new Date());
    c.appendChild(tiraSemana(sem,hoyIso));
    if(sem.resumen)c.appendChild(h('p',{class:'small mut',text:sem.resumen}));
    sem.dias.forEach(function(d){
      var det=h('details',null,h('summary',{class:'t-'+d.tipo+(d.fecha===hoyIso?' es-hoy':'')+(d.tipo==='descanso'?' es-desc':'')},h('span',{class:'d',text:d.dia}),h('span',{class:'t'},h('div',{style:'font-weight:600',text:d.titulo}),h('div',{class:'small mut',text:fmt(d.fecha)+(d.tipo!=='descanso'?' · '+nombreTipo(d.tipo):'')+(d.min?' · '+d.min+' min':'')+(d.fecha===p.descanso||d.dia===p.descanso?' · sobreesfuerzo':'')})),marcador(d,hoyIso)));
      det.appendChild(h('p',{class:'small',text:d.detalle}));
      if(d.niveles){det.appendChild(h('div',{class:'niv'},[['basica','Básica'],['media','Media'],['alta','Alta']].map(function(n){return d.niveles[n[0]]?h('div',null,h('b',{text:n[1]+': '}),d.niveles[n[0]]):null})))}
      var eb=bloqueEjercicios(d);if(eb)det.appendChild(eb);
      c.appendChild(det);
    });
  } else c.appendChild(h('p',{class:'mut small',text:'Todavía no hay rutina para esta semana.'}));
  c.appendChild(selectorSemana());
  c.appendChild(h('div',{class:'row'},
    h('button',{class:'p',disabled:busy||!sample,onclick:function(){planificar(lunes,false)}},sem?'Regenerar esta semana':'Generar esta semana'),
    h('button',{disabled:busy||!sample,onclick:function(){planificar(sig,false)}},'Generar la próxima')));
  if(!sample)c.appendChild(h('p',{class:'small mut',text:'El coach necesita abrir la página dentro de Claude.'}));
  return c;
}

var ANIMOS=['Sin energía','Flojera','Normal','Con ganas','Muy animado'];
var FRASES=['Hoy cuenta aunque sea poco. Baja la carga y cumple lo básico.','Empieza suave. A los diez minutos decides si sigues.','Un día normal también construye. Haz tu sesión.','Aprovecha las ganas, pero respeta el plan.','Buen día para empujar. Hazlo con cabeza y no te pases.'];
function vistaCheck(){
  var hoyIso=iso(new Date()), fSel=(drafts.fechaCk&&drafts.fechaCk<=hoyIso)?drafts.fechaCk:hoyIso, reg=S.pesos[fSel], p=perfil();
  var fecha=h('input',{type:'date',id:'fechaCk',max:hoyIso,value:fSel});
  fecha.addEventListener('change',function(){if(!fecha.value||fecha.value>hoyIso)return;drafts.fechaCk=fecha.value;delete drafts.kg;delete drafts.nota;draftMood=null;render()});
  var kg=h('input',{type:'number',id:'kg',step:'0.1',min:'30',max:'250',inputmode:'decimal',placeholder:'Ej. 92.4',value:reg&&reg.kg||''});
  var nota=h('input',{type:'text',id:'nota',maxlength:'200',placeholder:'Cómo dormiste, cómo te sientes',value:reg&&reg.nota||''});
  var animo=draftMood!=null?draftMood:(reg&&reg.animo!=null?reg.animo:null);
  var moods=h('div',{class:'moods',role:'group','aria-label':'Ánimo'},ANIMOS.map(function(a,i){return h('button',{'aria-pressed':String(animo===i),onclick:function(){draftMood=i;render()}},a)}));
  var out=[h('div',{class:'card hi'},h('h2',{text:'Check-in · '+fmt(fSel)}),
    h('label',{for:'fechaCk'},'Fecha',fecha),
    h('label',{for:'kg'},'Peso (kg)',kg),h('div',null,h('div',{class:'small mut',style:'margin-bottom:6px',text:'Ánimo'}),moods),
    animo!=null?h('div',{class:'ok-box'},p.porque&&animo<=1?'Recuerda tu porqué: '+p.porque:FRASES[animo]):null,
    h('label',{for:'nota'},'Nota',nota),
    h('button',{class:'p',onclick:function(){var v=parseFloat(kg.value);var vOk=v>=30&&v<=250;if(!vOk&&animo==null){msg='Escribe tu peso (entre 30 y 250 kg) o elige tu ánimo.';render();return}
      msg='';draftMood=null;guardar('pesos',fSel,{fecha:fSel,kg:vOk?v:((reg&&reg.kg)||null),animo:animo,nota:nota.value.trim().slice(0,200)})}},'Guardar check-in'),
    reg?h('div',{class:'small mut',text:'Guardado'+(reg.kg?': '+reg.kg+' kg':'')}):null)];
  out.push(vistaMolestia());
  if(msg)out.push(h('div',{class:'note',text:msg}));
  return out;
}
var ZONAS={'Pie':'podólogo o médico deportivo (eres supinador)','Tobillo':'médico deportivo o fisioterapeuta','Espinilla':'podólogo o médico deportivo (revisa tu pisada)','Pantorrilla':'médico deportivo o fisioterapeuta','Rodilla':'ortopedista deportivo o fisioterapeuta','Muslo':'fisioterapeuta deportivo','Cadera':'ortopedista deportivo o fisioterapeuta','Espalda baja':'fisioterapeuta o médico','Otra':'médico deportivo'};
function vistaMolestia(){
  var zona=h('select',{id:'zona'},Object.keys(ZONAS).map(function(z){return h('option',{value:z,text:z})}));
  var inten=h('input',{type:'range',id:'int',min:'1',max:'10',value:'4'});
  var val=h('span',{class:'pill',text:'4'});inten.addEventListener('input',function(){val.textContent=inten.value});
  var cks=[['hin','Hay hinchazón'],['apo','No puedo apoyar o caminar bien'],['noc','Duele en reposo o de noche']].map(function(x){var i=h('input',{type:'checkbox',id:x[0],style:'width:22px;height:22px'});return {id:x[0],i:i,l:h('label',{for:x[0],style:'flex-direction:row;align-items:center;gap:10px;min-height:44px;font-size:14px;color:var(--fg)'},i,x[1])}});
  var c=h('div',{class:'card'},h('h2',{text:'Molestia o dolor'}),h('label',{for:'zona'},'Dónde',zona),h('label',{for:'int'},h('span',{class:'row sp'},'Intensidad (1 a 10)',val),inten),cks.map(function(x){return x.l}),
    h('button',{onclick:function(){
      var z=zona.value,n=parseInt(inten.value,10),hin=cks[0].i.checked,apo=cks[1].i.checked,noc=cks[2].i.checked,nivel,txt;
      if(apo||n>=8||(hin&&n>=5)){nivel='urgente';txt='No entrenes. Acude hoy a urgencias o con un médico.'}
      else if(n>=5||noc||hin){nivel='pronto';txt='Pide cita pronto con '+ZONAS[z]+'. Baja la carga y evita impacto hasta que te revisen.'}
      else{nivel='observa';txt='Obsérvalo 48 horas. Baja el impacto y la intensidad. Si empeora o no cede, ve con '+ZONAS[z]+'.'}
      lastTriage={nivel:nivel,txt:txt};
      var id=String(Date.now());guardar('molestias',id,{fecha:iso(new Date()),zona:z,intensidad:n,nivel:nivel,hinchazon:hin,noApoya:apo,noche:noc});
    }},'Evaluar'));
  if(lastTriage)c.appendChild(h('div',{class:lastTriage.nivel==='urgente'?'alert':(lastTriage.nivel==='pronto'?'note':'ok-box')},h('b',{text:lastTriage.nivel==='urgente'?'Urgente. ':(lastTriage.nivel==='pronto'?'Consulta pronto. ':'Observa. ')}),lastTriage.txt));
  c.appendChild(h('p',{class:'small mut',text:'Es orientación, no un diagnóstico. El coach toma en cuenta tus molestias de los últimos 14 días.'}));
  return c;
}

function vistaCoach(){
  var inp=h('input',{type:'text',id:'q',placeholder:'Pregúntale a tu entrenador'});
  var enviar=function(){var t=inp.value;inp.value='';drafts.q='';enviarChat(t)};
  inp.addEventListener('keydown',function(e){if(e.key==='Enter')enviar()});
  var log=h('div',{class:'chat'},chat.map(function(m){return h('div',{class:'msg '+(m.role==='user'?'u':'a'),text:m.content})}),busy?h('div',{class:'msg a mut',text:'Pensando...'}):null);
  var c=h('div',{class:'card hi'},h('h2',{text:'Coach'}),
    chat.length?log:h('p',{class:'mut small',text:'Conoce tu perfil, tus metas, tu semana, tus pesos y tus molestias recientes.'}),
    h('div',{class:'row'},['¿Cómo voy para el 10K?','Hoy me siento cansado, ¿qué hago?','¿Cuándo cambio los tenis?'].map(function(q){return h('button',{class:'chip',disabled:busy||!sample,onclick:function(){enviarChat(q)}},q)})),
    h('div',{class:'row',style:'flex-wrap:nowrap'},h('div',{style:'flex:1;min-width:0'},inp),h('button',{class:'p',disabled:busy||!sample,onclick:enviar},'Enviar')));
  if(!sample)c.appendChild(h('p',{class:'small mut',text:'El coach necesita abrir la página dentro de Claude.'}));
  var out=[c];if(msg)out.push(h('div',{class:'note',text:msg}));return out;
}

function vistaProg(){
  var p=perfil(), pesos=pesosOrdenados().filter(function(x){return x.kg}), out=[tarjetaPlan(),tarjetaMetas(p),tarjetaExperiencia(p),tarjetaMarcas(p),tarjetaMinutos()];
  var c=h('div',{class:'card'},h('h2',{text:'Peso'}));
  if(pesos.length){
    var primero=pesos[0].kg, ultimo=pesos[pesos.length-1].kg, dif=ultimo-primero;
    c.appendChild(h('div',{class:'row sp'},h('div',null,h('div',{class:'big',text:ultimo.toFixed(1)}),h('div',{class:'small mut',text:'kg, último registro'})),h('div',{style:'text-align:right'},h('div',{style:'font-weight:800;font-size:22px;color:'+(dif<=0?'var(--ok)':'var(--warn)'),text:(dif>0?'+':'')+dif.toFixed(1)+' kg'}),h('div',{class:'small mut',text:'desde '+fmt(pesos[0].fecha)}))));
    var meta=primero-8, falta=ultimo-meta;
    c.appendChild(h('div',{class:'small mut',text:'Meta de al menos 8 kg: '+meta.toFixed(1)+' kg. '+(falta>0?'Faltan '+falta.toFixed(1)+' kg.':'Meta alcanzada.')}));
    c.appendChild(grafica(pesos,meta));
  } else c.appendChild(h('p',{class:'mut small',text:'Registra tu peso en Check-in.'}));
  out.push(c);
  var reg=Object.keys(S.pesos).sort().reverse().slice(0,10);
  if(reg.length){var lc=h('div',{class:'card'},h('h2',{text:'Registros recientes'}));
    reg.forEach(function(k){var x=S.pesos[k];lc.appendChild(h('div',{class:'row sp'},h('span',null,h('b',{text:fmt(x.fecha)}),x.kg?' · '+x.kg+' kg':'',x.animo!=null?' · '+ANIMOS[x.animo]:''),h('button',{class:'chip','aria-label':'Borrar registro del '+fmt(x.fecha),onclick:function(){borrar('pesos',k)}},'Borrar')))});
    out.push(lc)}
  var todas=Object.keys(S.semanas).sort().reverse().slice(0,6).map(function(k){return S.semanas[k]});
  var cc=h('div',{class:'card'},h('h2',{text:'Sesiones por semana'}));
  if(todas.length)todas.forEach(function(s){var tot=s.dias.filter(function(d){return d.tipo!=='descanso'}).length,ok=s.dias.filter(function(d){return d.estado==='hecha'}).length,no=s.dias.filter(function(d){return d.estado==='no_realizada'}).length;
    cc.appendChild(h('div',{class:'row sp'},h('span',{text:'Semana del '+fmt(s.inicio)}),h('span',{class:'small mut',text:ok+' hechas · '+no+' no realizadas · '+tot+' planeadas'})))});
  else cc.appendChild(h('p',{class:'mut small',text:'Aún no hay semanas registradas.'}));
  out.push(cc);return out;
}
/* minutos por semana: planeado (barra fantasma) contra hecho (barra naranja). Un solo eje. */
function tarjetaMinutos(){
  var ks=Object.keys(S.semanas).sort().slice(-8), c=h('div',{class:'card'},h('h2',{text:'Minutos por semana'}));
  if(!ks.length){c.appendChild(h('p',{class:'mut small',text:'Cuando tengas semanas generadas verás aquí lo planeado contra lo hecho.'}));return c}
  var ws=ks.map(function(k){var s=S.semanas[k],pl=0,ok=0;(s.dias||[]).forEach(function(d){if(d.tipo==='descanso')return;var m=+d.min||0;pl+=m;if(d.estado==='hecha')ok+=m});return {k:k,pl:pl,ok:ok}});
  var u=ws[ws.length-1], lectura=h('p',{class:'small',role:'status'});
  function leer(w){lectura.textContent='Semana del '+fmt(w.k)+': '+w.ok+' de '+w.pl+' min hechos'+(w.pl?' ('+Math.round(w.ok/w.pl*100)+'%)':'')+'.'}
  leer(u);
  var W=460,H=170,L=34,R=8,T=10,B=24,NS='http://www.w3.org/2000/svg', mx=Math.max(60,Math.max.apply(null,ws.map(function(w){return w.pl})));
  mx=Math.ceil(mx/60)*60;
  function el(t,a){var e=document.createElementNS(NS,t);for(var k in a)e.setAttribute(k,a[k]);return e}
  function barra(x,y,w,hh){var r=Math.min(4,hh,w/2);if(hh<=0)return 'M0 0';return 'M'+x+' '+(y+hh)+'V'+(y+r)+'Q'+x+' '+y+' '+(x+r)+' '+y+'H'+(x+w-r)+'Q'+(x+w)+' '+y+' '+(x+w)+' '+(y+r)+'V'+(y+hh)+'Z'}
  var svg=el('svg',{viewBox:'0 0 '+W+' '+H,class:'chart',role:'img','aria-label':'Minutos planeados y hechos por semana'});
  var ih=H-T-B, slot=(W-L-R)/ws.length, bw=Math.min(28,slot*.55), y=function(v){return T+ih-v/mx*ih};
  [0,mx/2,mx].forEach(function(v){svg.appendChild(el('line',{x1:L,x2:W-R,y1:y(v),y2:y(v),class:'grid'}));var tx=el('text',{x:L-6,y:y(v)+4,'text-anchor':'end',class:'ax'});tx.textContent=v;svg.appendChild(tx)});
  ws.forEach(function(w,i){
    var x=L+slot*i+(slot-bw)/2, g=el('g',{tabindex:'0',class:'bar-g'});
    g.appendChild(el('path',{d:barra(x,y(w.pl),bw,T+ih-y(w.pl)),class:'ghost'}));
    if(w.ok>0)g.appendChild(el('path',{d:barra(x+2,y(w.ok)+2,bw-4,Math.max(0,T+ih-y(w.ok)-2)),class:'done'}));
    g.appendChild(el('rect',{x:L+slot*i,y:T,width:slot,height:ih,class:'hit'}));
    var lx=el('text',{x:x+bw/2,y:H-6,'text-anchor':'middle',class:'ax'});lx.textContent=(ws.length>5&&(ws.length-1-i)%2)?'':fmt(w.k);g.appendChild(lx);
    ['pointerenter','focus','click'].forEach(function(ev){g.addEventListener(ev,function(){leer(w)})});
    svg.appendChild(g);
  });
  c.appendChild(h('div',{class:'leyenda small mut'},h('span',{class:'lg-done'},h('i'),'Hecho'),h('span',{class:'lg-ghost'},h('i'),'Planeado')));
  c.appendChild(h('div',{class:'chartbox'},svg));
  c.appendChild(lectura);
  return c;
}
function grafica(pesos,meta){
  var W=460,H=180,L=36,R=12,T=12,B=26,NS='http://www.w3.org/2000/svg';
  var ys=pesos.map(function(p){return p.kg}).concat([meta]), mn=Math.floor(Math.min.apply(null,ys)-1), mx=Math.ceil(Math.max.apply(null,ys)+1);
  var t0=parse(pesos[0].fecha).getTime(), t1=parse(pesos[pesos.length-1].fecha).getTime(); if(t1===t0)t1=t0+864e5;
  var X=function(f){return L+(parse(f).getTime()-t0)/(t1-t0)*(W-L-R)}, Y=function(v){return T+(mx-v)/(mx-mn)*(H-T-B)};
  var svg=document.createElementNS(NS,'svg');svg.setAttribute('viewBox','0 0 '+W+' '+H);svg.setAttribute('role','img');svg.setAttribute('aria-label','Peso a lo largo del tiempo');svg.style.cssText='width:100%;min-width:320px;height:auto;display:block';
  var add=function(tag,a,txt){var e=document.createElementNS(NS,tag);for(var k in a)e.setAttribute(k,a[k]);if(txt!=null)e.textContent=txt;svg.appendChild(e);return e};
  [mn,(mn+mx)/2,mx].forEach(function(v){add('line',{x1:L,x2:W-R,y1:Y(v),y2:Y(v),stroke:'rgba(110,150,210,.2)'});add('text',{x:L-6,y:Y(v)+4,'text-anchor':'end','font-size':11,fill:'#A3B3CE'},v.toFixed(0))});
  add('line',{x1:L,x2:W-R,y1:Y(meta),y2:Y(meta),stroke:'#62CF3F','stroke-dasharray':'5 4'});
  add('text',{x:W-R,y:Y(meta)-5,'text-anchor':'end','font-size':11,fill:'#62CF3F'},'Meta');
  if(pesos.length>1)add('polyline',{points:pesos.map(function(p){return X(p.fecha)+','+Y(p.kg)}).join(' '),fill:'none',stroke:'#FF9A1F','stroke-width':2.5,'stroke-linejoin':'round'});
  pesos.forEach(function(p,i){add('circle',{cx:X(p.fecha),cy:Y(p.kg),r:i===pesos.length-1?5:3.5,fill:'#FF6A00'})});
  add('text',{x:L,y:H-6,'font-size':11,fill:'#A3B3CE'},fmt(pesos[0].fecha));
  add('text',{x:W-R,y:H-6,'text-anchor':'end','font-size':11,fill:'#A3B3CE'},fmt(pesos[pesos.length-1].fecha));
  var box=h('div',{class:'chartbox'});box.appendChild(svg);return box;
}

function borrar(coleccion,id){delete S[coleccion][id];render();if(db)db.doc(coleccion+'/'+id).delete().catch(function(){msg='No se pudo borrar.';render()})}
function toggle(arr,v){return arr.indexOf(v)>=0?arr.filter(function(x){return x!==v}):arr.concat([v])}
var CADENAS=/smart ?fit|sports ?world|anytime|gold'?s ?gym|world ?gym|planet ?fitness|energy ?fit|crunch|snap ?fitness|f45|city ?fitness|mega ?gym/i;
var APARATOS_COMUN=['Caminadora','Elíptica','Bicicleta estática','Remo (ergómetro)','Prensa de pierna','Extensión de cuádriceps','Curl femoral','Aductores y abductores','Press de pecho en máquina','Jalón al pecho','Remo sentado en polea','Press de hombro en máquina','Cruce de poleas','Mancuernas','Barra olímpica y discos','Rack de sentadilla','Banco plano y ajustable','Máquina Smith','Kettlebells','Colchonetas'];
var APARATOS_BASICO=['Peso corporal','Mancuernas','Barra con discos','Banco','Bandas elásticas','Colchoneta','Cuerda para saltar'];
var gymUi={res:[],busy:false,nota:''};
function guardarGym(patch){var pf=perfil();guardarPerfil({gym:Object.assign({},pf.gym||{},patch)})}
function elegirGimnasio(item,basico){
  var cad=!basico&&CADENAS.test(item.nombre+' '+(item.lugar||''));
  guardarGym({nombre:item.nombre,lugar:item.lugar||'',cadena:cad?item.nombre:'',fuente:cad?'cadena':'basico',aparatos:(cad?APARATOS_COMUN:APARATOS_BASICO).slice()});
}
function buscarGimnasio(q){
  q=String(q||'').trim();
  if(q.length<3){gymUi.nota='Escribe al menos 3 letras.';gymUi.res=[];render();return}
  if(!gymSearch){elegirGimnasio({nombre:q,lugar:''},true);gymUi.nota='La búsqueda no está disponible. Usaré aparatos básicos.';render();return}
  gymUi.busy=true;gymUi.nota='';gymUi.res=[];render();
  gymSearch(q).then(function(r){
    gymUi.busy=false;gymUi.res=r;
    if(!r.length){elegirGimnasio({nombre:q,lugar:''},true);gymUi.nota='No lo encontré en el mapa. Usaré aparatos básicos; puedes agregar los tuyos.'}
    else gymUi.nota='Elige tu gimnasio:';
    render();
  }).catch(function(){
    gymUi.busy=false;elegirGimnasio({nombre:q,lugar:''},true);
    gymUi.nota='No pude buscar ahora (sin internet o servicio ocupado). Usaré aparatos básicos; puedes agregar los tuyos.';render();
  });
}
function vistaPerfil(){
  var p=perfil(), out=[];
  out.push(h('div',{class:'card hi'},h('h2',{text:'Días libres y de sobreesfuerzo'}),
    h('p',{class:'small mut',text:'Libre es un día sin trabajo o escuela, no sin ejercicio. Ese día puedo ponerte la salida larga o la sesión más fuerte.'}),
    grupo('Libre de trabajo o escuela','libre',p.libres,function(d){guardarPerfil({libres:toggle(p.libres,d),no:p.no.filter(function(x){return x!==d})});render()}),
    grupo('No puedo entrenar','no',p.no,function(d){guardarPerfil({no:toggle(p.no,d),libres:p.libres.filter(function(x){return x!==d}),descanso:p.descanso===d?'':p.descanso});render()}),
    h('div',null,h('div',{class:'small mut',style:'margin-bottom:6px',text:'Día de sobreesfuerzo preferido'}),h('div',{class:'row'},DIAS.filter(function(d){return p.no.indexOf(d)<0}).map(function(d){return h('button',{class:'chip','aria-pressed':String(p.descanso===d),onclick:function(){guardarPerfil({descanso:p.descanso===d?'':d});render()}},d)}))),
    h('label',{for:'carga'},'Carga de tu trabajo en general',(function(){var s=h('select',{id:'carga'},['Ligero','Normal','Pesado'].map(function(o){return h('option',{value:o,text:o,selected:p.carga===o})}));s.addEventListener('change',function(){guardarPerfil({carga:s.value})});return s})())));
  out.push(h('div',{class:'card'},h('h2',{text:'Inicio de mi semana'}),h('p',{class:'small mut',text:'Elige el día en que empieza tu semana de entrenamiento. Las rutinas se arman de ese día a 7 días después.'}),h('label',{for:'inicio'},'La semana empieza el',(function(){var s=h('select',{id:'inicio'},DIAS.map(function(o){return h('option',{value:o,text:o,selected:p.inicioSemana===o})}));s.addEventListener('change',function(){guardarPerfil({inicioSemana:s.value});render()});return s})())));
  var mmodo=p.minutosModo==='personalizado'?'personalizado':'igual';
  var primero=DIAS.map(function(d){return p.minutos[d]}).filter(function(x){return x!=null})[0];
  var cuerpo;
  if(mmodo==='igual'){
    var ti=h('input',{type:'number',id:'mt',min:'0',max:'300',step:'5',inputmode:'numeric',placeholder:'60',value:primero!=null?primero:''});
    ti.addEventListener('change',function(){var m={};if(ti.value!==''){var v=Math.max(0,Math.min(300,parseInt(ti.value,10)||0));DIAS.forEach(function(d){m[d]=v})}guardarPerfil({minutos:m})});
    cuerpo=h('label',{for:'mt'},'Minutos cada día (se aplica a los 7 días)',ti);
  } else cuerpo=h('div',{style:'display:grid;grid-template-columns:repeat(auto-fit,minmax(86px,1fr));gap:10px'},DIAS.map(function(d){
    var i=h('input',{type:'number',id:'m'+d,min:'0',max:'300',step:'5',inputmode:'numeric',placeholder:'60',value:p.minutos[d]!=null?p.minutos[d]:''});
    i.addEventListener('change',function(){var m=Object.assign({},p.minutos);if(i.value==='')delete m[d];else m[d]=Math.max(0,Math.min(300,parseInt(i.value,10)||0));guardarPerfil({minutos:m})});
    return h('label',{for:'m'+d},d,i)}));
  out.push(h('div',{class:'card'},h('h2',{text:'Minutos disponibles por día'}),
    h('div',{class:'row'},[['igual','Mismo tiempo todos los días'],['personalizado','Personalizar por día']].map(function(m){return h('button',{class:'chip','aria-pressed':String(mmodo===m[0]),onclick:function(){guardarPerfil({minutosModo:m[0]});render()}},m[1])})),
    cuerpo));
  var gy=p.gym||{}, gBrazo=gy.brazo||[], gPierna=gy.pierna||[], gAp=gy.aparatos||[];
  var gnom=h('input',{type:'text',id:'gn',maxlength:'80',placeholder:'Ej. Smart Fit Cumbres',value:gy.nombre||''});
  gnom.addEventListener('change',function(){guardarGym({nombre:gnom.value.trim()})});
  gnom.addEventListener('keydown',function(ev){if(ev.key==='Enter'){ev.preventDefault();buscarGimnasio(gnom.value)}});
  var geq=h('textarea',{id:'ge',maxlength:'1500',placeholder:'Ej. mancuernas de 5 a 30 kg, la prensa está descompuesta'},gy.equipo||'');
  geq.addEventListener('change',function(){guardarGym({equipo:geq.value.trim()})});
  var gca=h('input',{type:'text',id:'ga',maxlength:'60',placeholder:'Aparato nuevo o diferente'});
  function agregarAparato(){var v=gca.value.trim();if(!v||gAp.length>=40||gAp.some(function(x){return x.toLowerCase()===v.toLowerCase()}))return;gca.value='';drafts.ga='';guardarGym({aparatos:gAp.concat([v]),fuente:gy.fuente||'manual'});render()}
  gca.addEventListener('keydown',function(ev){if(ev.key==='Enter'){ev.preventDefault();agregarAparato()}});
  var gc=h('div',{class:'card'},h('h2',{text:'Mi gimnasio'}),
    h('p',{class:'small mut',text:'Busca tu gimnasio y cargo sus aparatos. Si no lo encuentro, uso aparatos básicos.'}),
    h('label',{for:'gn'},'Nombre',gnom),
    h('div',{class:'row'},h('button',{disabled:gymUi.busy,onclick:function(){buscarGimnasio(gnom.value)}},gymUi.busy?'Buscando...':'Buscar mi gimnasio')),
    gymUi.nota?h('p',{class:'small mut',role:'status',text:gymUi.nota}):null,
    gymUi.res.map(function(r){return h('button',{class:'res',onclick:function(){elegirGimnasio(r,false);gymUi.res=[];gymUi.nota='';render()}},h('b',{text:r.nombre}),h('span',{class:'small mut',text:r.lugar}))}));
  if(gy.fuente){
    gc.appendChild(h('h3',{text:'Aparatos'}));
    gc.appendChild(h('p',{class:'small mut',text:gy.fuente==='cadena'?'Aparatos comunes de '+(gy.cadena||'tu gimnasio')+'. Toca los que tu sucursal no tenga para quitarlos.':gy.fuente==='basico'?'No lo encontré como cadena, así que uso aparatos básicos. Toca para quitar, o agrega los que sí tengas.':'Tu lista propia. Toca un aparato para quitarlo.'}));
    gc.appendChild(h('div',{class:'row'},gAp.length?gAp.map(function(x,i){return h('button',{class:'chip','aria-pressed':'true','aria-label':'Quitar '+x,onclick:function(){guardarGym({aparatos:gAp.filter(function(_,j){return j!==i})});render()}},x)}):h('span',{class:'small mut',text:'Sin aparatos todavía.'})));
    gc.appendChild(h('label',{for:'ga'},'Agregar aparato',gca));
    gc.appendChild(h('button',{onclick:agregarAparato},'Agregar aparato'));
    gc.appendChild(h('button',{class:'link',onclick:function(){guardarGym({fuente:'basico',cadena:'',aparatos:APARATOS_BASICO.slice()});render()}},'Usar aparatos básicos'));
    gc.appendChild(h('button',{class:'link',onclick:function(){guardarGym({fuente:'manual',aparatos:[]});render()}},'Empezar con mi propia lista (último recurso)'));
  }
  gc.appendChild(grupo('Días de brazo','',gBrazo,function(d){guardarGym({brazo:toggle(gBrazo,d)});render()}));
  gc.appendChild(grupo('Días de pierna','',gPierna,function(d){guardarGym({pierna:toggle(gPierna,d)});render()}));
  gc.appendChild(h('label',{for:'ge'},'Notas del gimnasio (opcional)',geq));
  out.push(gc);
  var por=h('textarea',{id:'porque',placeholder:'La razón por la que haces esto'},p.porque||'');
  por.addEventListener('change',function(){guardarPerfil({porque:por.value.trim()})});
  out.push(h('div',{class:'card'},h('h2',{text:'Mi porqué'}),por,h('p',{class:'small mut',text:'Te lo recuerdo los días de poca energía.'})));
  out.push(tarjetaConexiones());
  if(acct)out.push(h('div',{class:'card'},h('h2',{text:'Cuenta'}),h('p',{class:'small mut',text:acct.email}),
    h('div',{class:'row'},h('button',{onclick:function(){acct.signOut()}},'Cerrar sesión'),h('button',{onclick:function(){acct.signOutAll()}},'Cerrar sesión en todos los dispositivos'))));
  out.push(h('div',{class:'card'},h('h2',{text:'Mis datos'}),h('p',{class:'small mut',text:'Descarga una copia de tu perfil, marcas, semanas, pesos y molestias.'}),
    descargas?h('button',{onclick:function(){descargas.save({filename:'entrenador-respaldo-'+iso(new Date())+'.json',data:JSON.stringify(S,null,2)}).catch(function(){})}},'Descargar respaldo'):h('p',{class:'small mut',text:'La descarga no está disponible en esta vista.'})));
  return out;
}
var SEMAFORO={verde:['ok','Seguro'],amarillo:['warn','Precaución'],rojo:['bad','Riesgoso']};
var ROL={principal:['acc','Principal'],secundaria:['','Secundaria'],pausa:['warn','En pausa'],lograda:['ok','Lograda'],pasada:['','Ya pasó']};
function tarjetaMetas(p){
  var hoy=hoyS(), metas=MT.ordenar(p.metas||[]), avisos=revisarMetas(metas), mp=MT.principal(metas,hoy);
  var c=h('div',{class:'card'},h('h2',{text:'Metas'}));
  function guardarMetas(l,extra){guardarPerfil(Object.assign({metas:l},extra||{}));render()}
  function cambiar(m,patch){return metas.map(function(x){if(MT.clave(x)!==MT.clave(m))return x;var y=Object.assign({},x,patch);Object.keys(y).forEach(function(k){if(y[k]==null)delete y[k]});return y})}
  /* Lograda: libera la siguiente meta y, si fue más larga que tu experiencia, la actualiza. */
  function logro(m){var ex=Object.assign({},p.exp), d=MT.distDe(m);if(d&&MT.esfuerzo(m)>MT.nivelExp(ex))ex.max=d;guardarMetas(cambiar(m,{lograda:hoy}),{exp:ex})}
  if(!expP().max)c.appendChild(h('div',{class:'note',text:'Dime abajo, en Mi experiencia, tu carrera más larga. Mientras tanto reviso tus metas como si fuera tu primera vez en cada distancia.'}));
  if(!metas.length)c.appendChild(h('p',{class:'mut small',text:'Sin metas. La primera que agregues será tu meta principal.'}));
  else if(!mp&&metas.some(function(m){return MT.activa(m,hoy)}))c.appendChild(h('div',{class:'note',text:'No tienes meta principal activa. Elige una con "Hacer principal" para que tu semana se arme hacia ella.'}));
  metas.forEach(function(m){
    var r=MT.rol(m,metas,hoy), k=MT.clave(m), rr=ROL[r], act=r==='principal'||r==='secundaria'||r==='pausa', sf=SEMAFORO[nivelDe(avisos,m)];
    var sub=fmt(m.fecha)+' · '+MT.descripcion(m)+(act?' · faltan '+MT.semanasEntre(hoy,m.fecha)+' semanas':m.lograda?' · lograda el '+fmt(m.lograda):'');
    var fila=h('div',{class:'meta'+(act?'':' pasada')+(r==='principal'?' es-principal':'')},
      h('div',{class:'row sp'},h('div',null,h('b',{text:m.nombre}),h('div',{class:'small mut',text:sub})),
        h('div',{class:'row'},h('span',{class:'pill'+(rr[0]?' '+rr[0]:''),text:rr[1]}),(r==='principal'||r==='secundaria')&&MT.esfuerzo(m)?h('span',{class:'pill '+sf[0],text:sf[1]}):null)));
    if(r==='pausa')fila.appendChild(h('p',{class:'small aviso warn',text:'Es de mayor esfuerzo que tu meta principal ('+mp.nombre+'). No se entrena todavía: se activa cuando pase su fecha o la marques como lograda.'}));
    if(r==='principal'||r==='secundaria')avisos.filter(function(x){return x.clave===k}).forEach(function(x){fila.appendChild(h('p',{class:'small aviso '+(x.nivel==='rojo'?'bad':'warn'),text:x.texto}))});
    var acc=[];
    if(!m.lograda&&m.fecha<=hoy)acc.push(h('button',{class:'link',onclick:function(){logro(m)}},'La logré'));
    if(m.lograda)acc.push(h('button',{class:'link',onclick:function(){guardarMetas(cambiar(m,{lograda:null}))}},'Desmarcar lograda'));
    if(act&&r!=='principal'&&!mp)acc.push(h('button',{class:'link',onclick:function(){var v=MT.puedeSerPrincipal(m,metas,hoy);if(!v.ok){msgMeta=v.razon;render();return}guardarMetas(cambiar(m,{prio:'A'}))}},'Hacer principal'));
    acc.push(h('button',{class:'link','aria-label':'Quitar '+m.nombre,onclick:function(){if(r==='principal'){quitarMeta=k;render();return}guardarMetas(metas.filter(function(x){return MT.clave(x)!==k}))}},'Quitar'));
    fila.appendChild(h('div',{class:'row'},acc));
    if(quitarMeta===k)fila.appendChild(h('div',{class:'alert',role:'alert'},h('b',{text:'¿Quitar tu meta principal? '}),'Se borra su plan y podrás elegir otra.',
      h('div',{class:'row',style:'margin-top:10px'},h('button',{class:'danger',onclick:function(){quitarMeta=null;guardarMetas(metas.filter(function(x){return MT.clave(x)!==k}))}},'Sí, quitarla'),h('button',{onclick:function(){quitarMeta=null;render()}},'Cancelar'))));
    c.appendChild(fila);
  });
  /* formulario */
  var tipo=nuevaMeta.tipo, nm=MT.esfuerzo, lim=mp?MT.esfuerzo(mp):99;
  var nom=h('input',{type:'text',id:'mn',maxlength:'60',placeholder:tipo==='montana'?'Ej. Trail Chipinque':tipo==='triatlon'?'Ej. Ironman 70.3 Monterrey':'Ej. Medio Maratón Monterrey'}),fec=h('input',{type:'date',id:'mf',min:hoy});
  c.appendChild(h('h3',{text:'Nueva meta'}));
  c.appendChild(h('p',{class:'small mut',text:mp?'Será secundaria dentro del plan de '+mp.nombre+'. Con ella activa solo puedes agregar metas de esfuerzo igual o menor ('+MT.descripcion(mp)+' o menos).':'Será tu meta principal: tu semana se arma pensando en ella.'}));
  c.appendChild(h('div',null,h('div',{class:'small mut',style:'margin-bottom:6px',text:'Tipo'}),h('div',{class:'row'},Object.keys(MT.TIPOS).map(function(k){return h('button',{class:'chip','aria-pressed':String(tipo===k),onclick:function(){nuevaMeta={tipo:k,dist:k==='calle'?'21k':k==='triatlon'?'703':null};bloqueo='';msgMeta='';render()}},MT.TIPOS[k].t)}))));
  var mk,md;
  if(tipo==='montana'){
    mk=h('input',{type:'number',id:'mk',min:'1',max:'300',step:'0.5',inputmode:'decimal',placeholder:'Ej. 21'});
    md=h('input',{type:'number',id:'md',min:'0',max:'15000',step:'50',inputmode:'numeric',placeholder:'Ej. 1200'});
    c.appendChild(h('div',{class:'row dos'},h('label',{for:'mk'},'Distancia (km)',mk),h('label',{for:'md'},'Desnivel de subida (m)',md)));
    c.appendChild(h('p',{class:'small mut',text:'El esfuerzo se calcula como km + desnivel/100. Ej.: 21 km con 1,200 m = 33, parecido a un medio maratón.'}));
  } else c.appendChild(h('div',null,h('div',{class:'small mut',style:'margin-bottom:6px',text:'Distancia'}),h('div',{class:'row'},Object.keys(MT.DIST).filter(function(d){return MT.DIST[d].tipo===tipo}).map(function(d){
    var mayor=MT.DIST[d].n>lim;
    return h('button',{class:'chip'+(mayor?' bloq':''),'aria-pressed':String(nuevaMeta.dist===d),title:mayor?'Mayor esfuerzo que tu meta principal':'',onclick:function(){nuevaMeta.dist=d;bloqueo='';render()}},MT.DIST[d].t+(mayor?' · bloqueada':''))}))));
  c.appendChild(h('label',{for:'mn'},'Nombre (opcional)',nom));
  c.appendChild(h('label',{for:'mf'},'Fecha',fec));
  function limpiar(){nom.value='';fec.value='';['mn','mf','mk','md'].forEach(function(i){delete drafts[i]});revisar=null;bloqueo=''}
  function guardarMeta(lista,texto){guardarPerfil({metas:lista});limpiar();msgMeta=texto||'';render()}
  if(bloqueo)c.appendChild(h('div',{class:'alert',role:'alert'},h('b',{text:'No puedes agregar esta meta todavía. '}),bloqueo));
  if(revisar){
    var rojo=revisar.avisos.some(function(x){return x.nivel==='rojo'});
    c.appendChild(h('div',{class:rojo?'alert':'note',role:'alert'},
      h('b',{text:rojo?'Esta meta pone en riesgo tu salud.':'Revisa esto antes de agregarla.'}),
      h('ul',{class:'avisos'},revisar.avisos.map(function(x){var otra=x.clave!==revisar.clave;return h('li',null,otra?h('b',{text:x.clave.split('|').slice(1).join('|')+': '}):null,x.texto)})),
      h('div',{class:'row'},h('button',{onclick:function(){revisar=null;render()}},'Cambiar la meta'),h('button',{class:rojo?'danger':'',onclick:function(){guardarMeta(revisar.lista,revisar.ok)}},'Agregar de todos modos'))));
  } else c.appendChild(h('button',{class:'p',onclick:function(){
    var m={nombre:nom.value.trim(),fecha:fec.value,tipo:tipo};
    if(tipo==='montana'){m.km=Math.round(parseFloat(mk.value)*2)/2;m.desnivel=Math.round(parseFloat(md.value)||0);if(!m.nombre)m.nombre='Montaña '+(m.km||'')+' km'}
    else{m.dist=nuevaMeta.dist;if(!m.nombre)m.nombre=MT.DIST[m.dist].t}
    var v=MT.validar(m,metas,hoy);
    if(!v.ok){if(v.codigo==='mayor'){bloqueo=v.razon;msgMeta=''}else{msgMeta=v.razon;bloqueo=''}render();return}
    bloqueo='';msgMeta='';m.prio=v.rol==='principal'?'A':'B';
    var lista=MT.ordenar(metas.concat([m])), ok=v.rol==='principal'?'Meta principal agregada. Tu plan ya apunta a ella.':'Meta secundaria agregada dentro de tu plan.';
    /* solo los avisos de riesgo que aparecen por agregar esta meta */
    var antes=avisos.map(function(x){return x.clave+x.texto});
    var mios=revisarMetas(lista).filter(function(x){return antes.indexOf(x.clave+x.texto)<0});
    if(mios.length){revisar={lista:lista,avisos:mios,clave:MT.clave(m),ok:ok};render();return}
    guardarMeta(lista,ok);
  }},'Agregar meta'));
  if(msgMeta)c.appendChild(h('p',{class:'small mut',role:'status',text:msgMeta}));
  c.appendChild(h('p',{class:'small mut',text:'Las reglas usan guías generales de entrenamiento. No sustituyen a un médico.'}));
  return c;
}
function tarjetaExperiencia(p){
  var ex=(p.exp||{}).max||'', exM=expP().max;
  return h('div',{class:'card'},h('h2',{text:'Mi experiencia'}),
    exM&&exM!==ex?h('p',{class:'small',text:'Por tus marcas de carrera tomo como más larga: '+(MT.EXP.filter(function(e){return e[0]===exM})[0]||['',''])[1]+'.'}):null,
    h('p',{class:'small mut',text:'¿Cuál es la prueba más larga que has terminado? Con esto reviso si tus metas son seguras. Se actualiza sola cuando marcas una meta como lograda.'}),
    h('div',{class:'row'},MT.EXP.map(function(e){return h('button',{class:'chip','aria-pressed':String(ex===e[0]),onclick:function(){guardarPerfil({exp:Object.assign({},p.exp,{max:e[0]})});render()}},e[1])})),
    (function(){var ec=expP(),i=h('input',{type:'number',id:'lr',min:'0',max:'50',step:'0.5',inputmode:'decimal',placeholder:ec.largaDeMarcas?'De tus marcas: '+ec.larga+' km':'Ej. 8',value:(p.exp||{}).larga||''});
      i.addEventListener('change',function(){var v=parseFloat(i.value);var e=Object.assign({},p.exp);if(!(v>0))delete e.larga;else e.larga=Math.min(50,Math.round(v*2)/2);guardarPerfil({exp:e});render()});
      return h('label',{for:'lr'},'Tu salida más larga del último mes (km)',i,h('span',{class:'small mut',style:'font-weight:400',text:'Con esto tu plan empieza en tu nivel real. Si lo dejas vacío, uso un valor seguro según tu experiencia.'}))})());
}
function objetivos(w){var o=[];if(w.km&&!w.carrera)o.push(w.km+' km');if(w.desnivel)o.push(w.desnivel+' m subida');if(w.bici)o.push(w.bici+' h bici');return o.join(' · ')}
function tarjetaPlan(){
  var hoy=hoyS(), m=metaPrincipal(), rec=MT.recuperacion(metasP(),hoy), c=h('div',{class:'card'},h('h2',{text:'Mi plan'}));
  if(rec)c.appendChild(h('div',{class:'plan-hero'},h('div',{class:'kicker',text:'Después de '+rec.meta.nombre}),h('div',{class:'plan-sem',text:'Recuperación'}),
    h('div',{class:'row'},h('span',{class:'pill ok',text:'Semana '+rec.k+' de '+rec.R})),h('p',{class:'small',text:FASES.recuperacion.f})));
  var pl=m&&planDe(m);
  if(!pl){c.appendChild(h('p',{class:'mut small',text:rec?'Cuando estés listo, agrega tu siguiente meta: será la principal y armo su plan.':m?'Tu meta principal no tiene un tipo y distancia reconocibles, así que no puedo armar fases.':'Agrega una meta y será tu meta principal: armo tu plan por fases (base, desarrollo, afinación y recuperación) hasta la fecha.'}));return c}
  var s=semanaPlan(pl,hoy);
  if(!s){c.appendChild(h('p',{class:'mut small',text:'Tu meta principal ya pasó.'}));return c}
  var f=s.pre?FASES.pre:FASES[s.fase], obj=s.carrera?'':objetivos(s);
  c.appendChild(h('div',{class:'plan-hero'},
    h('div',{class:'kicker',text:'Hacia '+m.nombre+' · '+fmt(m.fecha)}),
    h('div',{class:'plan-sem'},s.pre?h('span',{text:'Empieza en '+s.faltan+(s.faltan===1?' semana':' semanas')}):[h('span',{text:'Semana '+s.k}),h('span',{class:'mut',text:' de '+pl.L})]),
    h('div',{class:'row'},h('span',{class:'pill acc',text:f.t}),s.desc?h('span',{class:'pill',text:'Descarga'}):null,s.carrera?h('span',{class:'pill acc',text:'Semana de la meta'}):null),
    h('p',{class:'small',text:s.carrera?MT.CARRERA:s.desc?MT.DESCARGA:f.f}),
    h('p',{class:'small mut',text:'Disciplinas: '+MT.TIPOS[pl.tipo].enfoque}),
    obj?h('div',{class:'plan-km'},h('span',{class:'num',text:obj}),h('span',{class:'small mut',text:' · sesiones largas '+(s.pre?'máximas por ahora':'de esta semana')})):null));
  /* línea de tiempo: el tono sigue la carga de cada fase */
  var orden=['base','desarrollo','afinacion'], tl=h('div',{class:'fases',role:'img','aria-label':'Fases del plan: '+orden.map(function(x){return FASES[x].t+' '+pl.fases[x]+' semanas'}).join(', ')+', y después recuperación'});
  orden.forEach(function(x){tl.appendChild(h('div',{class:'fs f-'+x,style:'flex:'+pl.fases[x]}))});
  if(!s.pre)tl.appendChild(h('div',{class:'fs-hoy',style:'left:'+((s.k-.5)/pl.L*100)+'%'}));
  c.appendChild(tl);
  c.appendChild(h('div',{class:'leyenda small mut'},orden.map(function(x){return h('span',{class:'f-'+x},h('i'),FASES[x].t+' · '+pl.fases[x])}),h('span',{class:'f-recuperacion'},h('i'),'Recuperación después')));
  if(pl.max<pl.top-.5)c.appendChild(h('div',{class:'note',text:'Con el tiempo que hay, tu salida larga llegará a '+pl.max+' km (lo ideal serían '+pl.top+'). Subirla más rápido aumenta el riesgo de lesión.'}));
  var lunesHoy=iso(monday(new Date()));
  var lista=h('div',{class:'plan-lista'},pl.sem.map(function(w){var esta=!s.pre&&w.k===s.k;
    return h('div',{class:'pl-row'+(esta?' hoy':'')+(w.lunes<lunesHoy?' pasada':'')},h('span',{class:'pl-k',text:'S'+w.k}),h('span',{class:'pl-f'},h('span',{text:FASES[w.fase].t+(w.desc?' · descarga':'')+(w.carrera?' · meta':'')}),h('span',{class:'small mut',text:fmt(w.lunes)})),h('span',{class:'pl-km',text:w.carrera?'Meta':objetivos(w)}))}));
  c.appendChild(h('details',{class:'plan-det'},h('summary',null,h('span',{class:'t',text:'Ver las '+pl.L+' semanas'})),lista));
  c.appendChild(h('p',{class:'small mut',text:'El coach usa la fase y los objetivos de cada semana al generarla.'}));
  return c;
}
/* ---------- marcas y experiencia por disciplina (cálculos en marcas.js) ---------- */
var MARCA0={abierto:false,disc:null,dist:'5k',tipo:'',sent:0,dato:'tiempo',msg:''};
function idSeguro(k){return String(k).replace(/[^A-Za-z0-9]/g,'_')}
function discsMarcas(p){
  var ks=MR.BASE.map(function(x){return x[0]}).concat((p.extras||[]).map(function(n){return 'x:'+n}));
  Object.keys(p.marcas||{}).concat(Object.keys(p.discExp||{})).forEach(function(k){if(ks.indexOf(k)<0)ks.push(k)});
  return ks;
}
function limpiarDraftsMarca(){Object.keys(drafts).forEach(function(k){if(k.indexOf('mr-')===0)delete drafts[k]})}
function valor(id){var e=document.getElementById('mr-'+id);return e?e.value:''}
function guardarMarca(){
  var p=perfil(), u=marcaUi, disc=u.disc;
  if(disc==='nueva'){var n=valor('nombre').trim().slice(0,30);
    if(!n){u.msg='Escribe el nombre de la disciplina.';render();return}
    if(MR.BASE.some(function(b){return b[1].toLowerCase()===n.toLowerCase()})){u.msg='Esa disciplina ya existe arriba.';render();return}
    var ya=(p.extras||[]).filter(function(e){return e.toLowerCase()===n.toLowerCase()})[0];disc='x:'+(ya||n)}
  var nombreEj=valor('ej').trim(), cat=window.Ejercicios&&Ejercicios.lista.filter(function(x){return x.nombre.toLowerCase()===nombreEj.toLowerCase()})[0];
  var r=MR.limpiar(disc,{fecha:valor('fecha')||hoyS(),nota:valor('nota'),sent:u.sent||null,dist:u.dist,tipo:u.tipo,dato:u.dato,
    km:valor('km'),tiempo:valor('tiempo'),ejercicio:nombreEj,ejId:cat&&cat.id,kg:valor('kg'),reps:valor('reps'),m:valor('m'),kmh:valor('kmh'),min:valor('min')},hoyS());
  if(!r.ok){u.msg=r.razon;render();return}
  var todas=Object.assign({},p.marcas), res=MR.agregar(todas[disc],r.marca); todas[disc]=res.lista;
  var patch={marcas:todas};
  if(MR.esPropia(disc)){var nom=disc.slice(2),ext=p.extras||[];if(ext.indexOf(nom)<0&&ext.length<6)patch.extras=ext.concat([nom])}
  /* el perfil tiene tope de 64 KB en la base de datos */
  if(JSON.stringify(Object.assign({},p,patch)).length>60000){u.msg='Tu perfil está casi lleno. Borra algunas marcas viejas antes de agregar más.';render();return}
  guardarPerfil(patch);
  if(res.archivadas.length&&db){var a=Object.assign({},S.archivo),am=Object.assign({},a.marcas);am[disc]=MR.archivar(am[disc],res.archivadas);a.marcas=am;S.archivo=a;
    db.doc('perfil/archivo').set(a).catch(function(){msg='No se pudieron archivar las marcas viejas.';render()})}
  limpiarDraftsMarca();
  marcaUi=Object.assign({},MARCA0,{dato:u.dato,msg:'Marca guardada en '+MR.nombreDisc(disc)+'.'});discAbierta=disc;render();
}
function formMarca(p){
  var u=marcaUi, box=h('div',{class:'marca-form'});
  function chips(opts,sel,fn,extra){return h('div',{class:'row'},opts.map(function(o){return h('button',{class:'chip'+(extra?' '+extra:''),'aria-pressed':String(sel===o[0]),onclick:function(){fn(o[0]);render()}},o[1])}))}
  function campo(id,label,attrs){return h('label',{for:'mr-'+id},label,h('input',Object.assign({id:'mr-'+id},attrs)))}
  function grupoC(t,el){return h('div',null,h('div',{class:'small mut',style:'margin-bottom:6px',text:t}),el)}
  var opciones=discsMarcas(p).map(function(k){return [k,MR.nombreDisc(k)]}).concat([['nueva','Otra…']]);
  box.appendChild(grupoC('¿De qué disciplina?',chips(opciones,u.disc,function(k){if(u.disc!==k)limpiarDraftsMarca();u.disc=k;u.msg=''})));
  if(!u.disc){box.appendChild(h('button',{onclick:function(){marcaUi=Object.assign({},MARCA0);render()}},'Cancelar'));return box}
  var d=u.disc, propia=d==='nueva'||MR.esPropia(d), TXT={type:'text',inputmode:'numeric',autocomplete:'off'}, NUM=function(max,step){return {type:'number',min:'0',max:String(max),step:String(step||'any'),inputmode:'decimal'}};
  if(d==='nueva')box.appendChild(campo('nombre','Nombre de la disciplina',{type:'text',maxlength:'30',placeholder:'Ej. Calistenia'}));
  if(d==='correr'){
    box.appendChild(grupoC('Distancia',chips(MR.DIST_CORRER.map(function(x){return [x[0],x[1]]}),u.dist,function(v){u.dist=v})));
    var fila=[];if(u.dist==='otra')fila.push(campo('km','Kilómetros',Object.assign(NUM(500),{placeholder:'Ej. 15'})));
    fila.push(campo('tiempo','Tiempo (h:mm:ss)',Object.assign({},TXT,{placeholder:'Ej. 28:30'})));
    box.appendChild(h('div',{class:'row dos'},fila));
    box.appendChild(grupoC('Tipo',chips(MR.TIPO_CORRER,u.tipo,function(v){u.tipo=u.tipo===v?'':v})));
  } else if(d==='gym'){
    box.appendChild(campo('ej','Ejercicio',{type:'text',maxlength:'60',list:'mr-ejs',placeholder:'Elige o escribe (ej. Sentadilla)',autocomplete:'off'}));
    if(window.Ejercicios)box.appendChild(h('datalist',{id:'mr-ejs'},Ejercicios.lista.map(function(x){return h('option',{value:x.nombre})})));
    var kg=h('input',Object.assign({id:'mr-kg',placeholder:'Ej. 80'},NUM(600,0.5))), reps=h('input',Object.assign({id:'mr-reps',placeholder:'Ej. 5'},NUM(200,1),{inputmode:'numeric'}));
    var est=h('p',{class:'small mut',role:'status'});
    function prev(){var e=MR.epley(kg.value,reps.value);est.textContent=e&&+reps.value>1?'Máximo estimado (Epley): ~'+e+' kg. Es una estimación.':+reps.value>10?'Con más de 10 repeticiones no calculo máximo estimado.':''}
    kg.addEventListener('input',prev);reps.addEventListener('input',prev);setTimeout(prev);
    box.appendChild(h('div',{class:'row dos'},h('label',{for:'mr-kg'},'Peso (kg)',kg),h('label',{for:'mr-reps'},'Repeticiones',reps)));
    box.appendChild(est);
  } else if(d==='natacion'){
    box.appendChild(h('div',{class:'row dos'},campo('m','Distancia (m)',Object.assign(NUM(20000,25),{placeholder:'Ej. 1000'})),campo('tiempo','Tiempo (h:mm:ss)',Object.assign({},TXT,{placeholder:'Ej. 22:00'}))));
  } else if(d==='bici'){
    box.appendChild(campo('km','Distancia (km)',Object.assign(NUM(1000),{placeholder:'Ej. 40'})));
    box.appendChild(h('div',{class:'row dos'},campo('tiempo','Tiempo (h:mm:ss)',Object.assign({},TXT,{placeholder:'Ej. 1:36:00'})),campo('kmh','o velocidad (km/h)',Object.assign(NUM(90),{placeholder:'Ej. 25'}))));
  } else if(propia){
    box.appendChild(grupoC('¿Qué quieres registrar?',chips(MR.DATOS,u.dato,function(v){u.dato=v})));
    if(u.dato==='tiempo')box.appendChild(campo('tiempo','Tiempo (h:mm:ss)',Object.assign({},TXT,{placeholder:'Ej. 12:30'})));
    if(u.dato==='distancia')box.appendChild(campo('km','Distancia (km)',Object.assign(NUM(1000),{placeholder:'Ej. 5'})));
    if(u.dato==='duracion')box.appendChild(campo('min','Duración (min)',Object.assign(NUM(1440,1),{placeholder:'Ej. 45'})));
    if(u.dato==='pesorep')box.appendChild(h('div',{class:'row dos'},campo('kg','Peso (kg)',Object.assign(NUM(600,0.5),{placeholder:'Ej. 10'})),campo('reps','Repeticiones',Object.assign(NUM(500,1),{placeholder:'Ej. 12'}))));
  }
  box.appendChild(campo('fecha','Fecha',{type:'date',max:hoyS(),value:hoyS()}));
  box.appendChild(grupoC('Cómo me sentí (1 muy mal · 5 excelente)',chips([1,2,3,4,5].map(function(n){return [n,String(n)]}),u.sent,function(v){u.sent=u.sent===v?0:v},'sent')));
  box.appendChild(campo('nota','Nota (opcional)',{type:'text',maxlength:'200',placeholder:propia||d==='gym'?'Ej. hago dominadas, llego a 5':'Ej. con calor, subidas al final'}));
  box.appendChild(h('p',{class:'small mut',text:'Llena solo lo que sepas. Una nota sola también cuenta.'}));
  box.appendChild(h('div',{class:'row'},h('button',{class:'p',onclick:guardarMarca},'Guardar marca'),h('button',{onclick:function(){limpiarDraftsMarca();marcaUi=Object.assign({},MARCA0);render()}},'Cancelar')));
  if(u.msg)box.appendChild(h('p',{class:'small',role:'status',text:u.msg}));
  return box;
}
function fichaDisc(k,f){
  var id=idSeguro(k), box=h('div',{class:'ficha'},h('div',{class:'kicker',text:'Mi experiencia en '+MR.nombreDisc(k).toLowerCase()}));
  function set(patch){var de=Object.assign({},perfil().discExp),x=Object.assign({},de[k],patch);Object.keys(x).forEach(function(z){if(x[z]==null||x[z]==='')delete x[z]});if(Object.keys(x).length)de[k]=x;else delete de[k];guardarPerfil({discExp:de});render()}
  function chips(opts,sel,key){return h('div',{class:'row'},opts.map(function(o){return h('button',{class:'chip sm','aria-pressed':String(sel===o[0]),onclick:function(){var p={};p[key]=sel===o[0]?null:o[0];set(p)}},o[1])}))}
  var t=h('input',{type:'number',id:'fe-'+id+'-t',min:'0',max:'60',step:'1',inputmode:'numeric',placeholder:'Ej. 2',value:f.tiempo||''});
  t.addEventListener('change',function(){var v=parseInt(t.value,10);set({tiempo:v>0?Math.min(v,60):null,unidad:v>0?(f.unidad||'anios'):null})});
  var fr=h('input',{type:'number',id:'fe-'+id+'-f',min:'0',max:'14',step:'1',inputmode:'numeric',placeholder:'Ej. 3',value:f.frec||''});
  fr.addEventListener('change',function(){var v=parseInt(fr.value,10);set({frec:v>0?Math.min(v,14):null})});
  var ul=h('input',{type:'month',id:'fe-'+id+'-u',max:hoyS().slice(0,7),value:f.ultima||''});
  ul.addEventListener('change',function(){set({ultima:/^\d{4}-\d{2}$/.test(ul.value)?ul.value:null})});
  box.appendChild(h('div',{class:'row dos'},h('label',{for:'fe-'+id+'-t'},'Tiempo practicándola',t),h('div',{class:'lbl-chips'},h('span',{class:'small mut',text:'en'}),chips([['meses','Meses'],['anios','Años']],f.unidad||'anios','unidad'))));
  box.appendChild(h('div',{class:'row dos'},h('label',{for:'fe-'+id+'-f'},'Veces por semana',fr),h('div',{class:'lbl-chips'},h('span',{class:'small mut',text:'eso es'}),chips([['actual','Ahora'],['pasada','Antes']],f.frecCuando||'actual','frecCuando'))));
  box.appendChild(h('div',null,h('div',{class:'small mut',style:'margin-bottom:6px',text:'Cómo me siento'}),chips(MR.NIVELES,f.nivel,'nivel')));
  box.appendChild(h('label',{for:'fe-'+id+'-u'},'Última vez que la practiqué',ul));
  return box;
}
function tarjetaMarcas(p){
  if(!marcaUi)marcaUi=Object.assign({},MARCA0);
  var c=h('div',{class:'card'},h('h2',{text:'Marcas y experiencia'}),
    h('p',{class:'small mut',text:'Tus mejores tiempos, pesos y notas por disciplina. El coach recibe solo un resumen de una línea de lo que entrenas esa semana.'}));
  if(marcaUi.abierto)c.appendChild(formMarca(p));
  else{c.appendChild(h('button',{class:'p',onclick:function(){marcaUi=Object.assign({},MARCA0,{abierto:true,dato:marcaUi.dato});render()}},'Agregar marca'));
    if(marcaUi.msg)c.appendChild(h('p',{class:'small mut',role:'status',text:marcaUi.msg}))}
  discsMarcas(p).forEach(function(k){
    var lista=((p.marcas||{})[k]||[]).slice().sort(function(a,b){return a.fecha<b.fecha?1:-1}), ficha=(p.discExp||{})[k]||{}, arch=(((S.archivo||{}).marcas||{})[k]||[]);
    var res=MR.resumen(k,ficha,lista);
    var det=h('details',{class:'disc-det',open:discAbierta===k},h('summary',null,h('span',{class:'t'},h('b',{text:MR.nombreDisc(k)}),h('div',{class:'small mut',text:res?res.slice(res.indexOf(':')+2):'Sin datos todavía'})),h('span',{class:'small mut',text:lista.length?lista.length+(lista.length===1?' marca':' marcas'):''})));
    det.addEventListener('toggle',function(){if(det.open)discAbierta=k;else if(discAbierta===k)discAbierta=null});
    det.appendChild(fichaDisc(k,ficha));
    if(lista.length)det.appendChild(h('div',{class:'mk-lista'},h('div',{class:'kicker',text:'Marcas'}),lista.map(function(m){
      return h('div',{class:'mk-row'},h('div',null,h('div',{text:MR.textoMarca(k,m)}),h('div',{class:'small mut',text:fmt(m.fecha)+(m.fecha.slice(0,4)!==hoyS().slice(0,4)?' '+m.fecha.slice(0,4):'')+(m.sent?' · me sentí '+m.sent+'/5':'')})),
        h('button',{class:'link','aria-label':'Borrar marca del '+fmt(m.fecha),onclick:function(){var t=Object.assign({},perfil().marcas);t[k]=(t[k]||[]).filter(function(x){return x.id!==m.id});if(!t[k].length)delete t[k];guardarPerfil({marcas:t});render()}},'Borrar'))})));
    if(arch.length)det.appendChild(h('p',{class:'small mut',text:arch.length+(arch.length===1?' marca archivada':' marcas archivadas')+' (las más viejas; se guardan '+MR.MAX+' por disciplina).'}));
    c.appendChild(det);
  });
  return c;
}
function tarjetaConexiones(){
  function fila(nombre,que){return h('div',{class:'meta'},h('div',{class:'row sp'},h('b',{text:nombre}),h('span',{class:'pill',text:'Próximamente'})),h('p',{class:'small mut',text:que}),h('button',{disabled:true},'Conectar '+nombre))}
  return h('div',{class:'card'},h('h2',{text:'Conexiones'}),
    fila('Strava','Importar tus carreras y entrenos para que el coach sepa lo que ya hiciste y llene tu historial solo.'),
    fila('Apple Watch','Leer distancia, ritmo y pulso desde Apple Salud. Necesitará un atajo de iPhone o una app nativa.'));
}
function grupo(titulo,clase,sel,fn){return h('div',null,h('div',{class:'small mut',style:'margin-bottom:6px',text:titulo}),h('div',{class:'row'},DIAS.map(function(d){return h('button',{class:'chip '+clase,'aria-pressed':String(sel.indexOf(d)>=0),onclick:function(){fn(d)}},d)})))}

/* ---------- render ---------- */
/* No redibujar mientras hay un dedo o clic en curso: si un guardado termina entre mousedown y mouseup, el botón se reemplazaría y el toque se perdería. */
var pulsando=false, renderPendiente=false;
document.addEventListener('pointerdown',function(){pulsando=true},true);
['pointerup','pointercancel'].forEach(function(ev){document.addEventListener(ev,function(){pulsando=false;if(renderPendiente){renderPendiente=false;setTimeout(render,60)}},true)});
function render(){
  if(pulsando){renderPendiente=true;return}
  var view=document.getElementById('view'), y=window.scrollY;
  view.querySelectorAll('input[id],textarea[id]').forEach(function(e){if(e.type!=='checkbox'&&e.type!=='range')drafts[e.id]=e.value});
  var ae=document.activeElement, keep=ae&&ae.id&&view.contains(ae)?{id:ae.id,s:ae.selectionStart,e:ae.selectionEnd}:null;
  var nodes={hoy:vistaHoy,check:vistaCheck,coach:vistaCoach,prog:vistaProg,perfil:vistaPerfil}[tab]();
  view.replaceChildren.apply(view,nodes);
  view.querySelectorAll('input[id],textarea[id]').forEach(function(e){if(e.type!=='checkbox'&&e.type!=='range'&&drafts[e.id]!==undefined&&drafts[e.id]!==e.value)e.value=drafts[e.id]});
  var nav=document.getElementById('nav');nav.replaceChildren.apply(nav,TABS.map(function(t){
    var b=h('button',{'aria-label':t[1],onclick:function(){tab=t[0];msg='';drafts={};render();window.scrollTo(0,0)}});b.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true">'+ICON[t[0]]+'</svg><span>'+t[1]+'</span>';
    if(tab===t[0])b.setAttribute('aria-current','page');return b}));
  if(keep){var el=document.getElementById(keep.id);if(el){el.focus();try{el.setSelectionRange(keep.s,keep.e)}catch(e){}}}
  window.scrollTo(0,y);
}

function estadoDb(t){var e=document.getElementById('estadoDb');e.dataset.s=t==='Guardado en línea'?'ok':t==='Sin conexión'?'bad':'wait';e.title=t;e.replaceChildren(h('span',{class:'sr',text:t}))}

function subs(){
  var vivo=false;
  function ok(){if(!vivo){vivo=true;estadoDb('Guardado en línea')}}
  db.doc('perfil/yo').onSnapshot(function(s){S.perfil=s.exists?s.data():{};ok();render()},function(){estadoDb('Sin conexión')});
  db.doc('perfil/archivo').onSnapshot(function(s){S.archivo=s.exists?s.data():{};render()},function(){});
  ['semanas','pesos','molestias'].forEach(function(c){db.collection(c).onSnapshot(function(q){var o={};q.docs.forEach(function(d){o[d.id]=d.data()});S[c]=o;ok();render()},function(){estadoDb('Sin conexión')})});
}


function reset(){S={perfil:{},semanas:{},pesos:{},molestias:{},archivo:{}};marcaUi=Object.assign({},MARCA0);discAbierta=null;chat=[];drafts={};msg='';tab='hoy';busy=false;razon=false;lastTriage=null;draftMood=null;revisar=null;msgMeta='';bloqueo='';quitarMeta=null;nuevaMeta={tipo:'calle',dist:'21k'}}
window.EntrenadorApp={
  start:function(b){reset();db=b.db;sample=b.sample;descargas=b.descargas;gymSearch=b.gymSearch||null;acct=b.account||null;estadoDb('Conectando');render();subs()},
  stop:function(){reset();db=null;sample=null;descargas=null;acct=null;var v=document.getElementById('view');v.replaceChildren();var n=document.getElementById('nav');n.replaceChildren()},
  status:estadoDb
};
})();
