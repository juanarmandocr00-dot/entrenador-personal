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

var S={perfil:{},semanas:{},pesos:{},molestias:{}};
var db=null, sample=null, tab='hoy', busy=false, msg='', chat=[], draftMood=null, razon=false, lastTriage=null, drafts={}, descargas=null, acct=null;
var ICON={
  hoy:'<path d="M4 11l8-7 8 7v9a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z"/>',
  check:'<path d="M5 12l4 4 10-10"/><rect x="3" y="3" width="18" height="18" rx="4"/>',
  coach:'<path d="M4 5h16v11H9l-5 4z"/>',
  prog:'<path d="M4 19V5M4 19h16M8 15l4-5 3 3 5-7"/>',
  perfil:'<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/>'
};
var TABS=[['hoy','Hoy'],['check','Check-in'],['coach','Coach'],['prog','Progreso'],['perfil','Perfil']];

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
function guardarPerfil(patch){var p=Object.assign({},perfil(),patch);S.perfil=p;if(db)db.doc('perfil/yo').set(p).catch(function(){});}
function semanaActual(){return S.semanas[iso(monday(new Date()))]}
function proximaMeta(){
  var hoy=iso(new Date());
  var m=(perfil().metas||[]).filter(function(x){return x.fecha>=hoy}).sort(function(a,b){return a.fecha<b.fecha?-1:1});
  return m[0]||null;
}
function pesosOrdenados(){return Object.keys(S.pesos).sort().map(function(k){return S.pesos[k]})}

/* ---------- coach ---------- */
var REGLAS=[
 'Eres el entrenador personal de Armando (30 años, Nuevo León, México). Habla en español claro y directo.',
 'No eres médico. Ante dolor o molestia activa, baja la carga y recomienda ver a un médico deportivo o fisioterapeuta; si hay dolor fuerte, hinchazón o no puede apoyar, dile que no entrene y que acuda a un médico.',
 'Armando es supinador y corre con Adidas Duramo SL2. Ritmo de Zona 2: 7:30 por km. Quiere bajar 8 kg o más (empezó el 14 de octubre de 2026).',
 'Gimnasio: Bestia´s Gym. Rutinas con tres niveles: Básica, Media y Alta.',
 'Nunca dupliques la carga por una sesión perdida. Prioridad si hay que elegir: salida larga, luego pierna, luego brazo.',
 'La pierna solo en nivel Básica o Media si cae a menos de 48 horas de la salida larga.',
 'Dos sesiones perdidas seguidas reducen la semana. "No realizada" no es lo mismo que "Descanso".',
 'Día de sobreesfuerzo: es un día libre de su trabajo o escuela, no de ejercicio. Ahí va la salida larga o la sesión más exigente, con tope de seguridad, y el día siguiente va más ligero.',
 'Respeta los días en que no puede entrenar y los minutos disponibles de cada día. No subas el volumen semanal de golpe.',
 'En la semana previa a una carrera baja el volumen y evita sesiones nuevas o muy duras.'
].join('\n');

function contexto(){
  var p=perfil(), sem=semanaActual(), pesos=pesosOrdenados().slice(-8);
  var hoy=new Date(), lim=iso(addDays(hoy,-14));
  var mol=Object.keys(S.molestias).map(function(k){return S.molestias[k]}).filter(function(m){return m.fecha>=lim});
  return REGLAS+'\n\nHoy es '+DIAS[(hoy.getDay()+6)%7]+' '+iso(hoy)+'.\n'
   +'PERFIL: '+JSON.stringify({libres:p.libres,noPuedeEntrenar:p.no,diaSobreesfuerzo:p.descanso,cargaDeTrabajo:p.carga,minutosPorDia:p.minutos,metas:p.metas,gym:p.gym,porque:p.porque})+'\n'
   +'SEMANA ACTUAL: '+JSON.stringify(sem&&sem.dias||[])+'\n'
   +'PESOS RECIENTES: '+JSON.stringify(pesos.map(function(x){return {f:x.fecha,kg:x.kg,animo:x.animo}}))+'\n'
   +'MOLESTIAS RECIENTES: '+JSON.stringify(mol.map(function(m){return {f:m.fecha,zona:m.zona,intensidad:m.intensidad,nivel:m.nivel}}));
}

function planificar(semanaIso,reajuste){
  if(!sample){msg='El coach no está disponible en esta vista.';render();return}
  busy=true;msg='Pensando tu semana. Puede tardar un minuto.';render();
  var inicio=parse(semanaIso), fechas=DIAS.map(function(_,i){var f=addDays(inicio,i);return dayName(f)+' '+iso(f)}).join(', ');
  var desde=reajuste?iso(new Date()):semanaIso;
  var prompt=contexto()+'\n\nTAREA: '+(reajuste?'Reajusta lo que queda de la semana desde '+desde+' inclusive, considerando las sesiones ya hechas o no realizadas.':'Genera la rutina de la semana de entrenamiento que empieza el '+dayName(inicio)+' '+semanaIso+' y termina 6 días después. Armando elige el día de inicio, no tiene que ser lunes.')
   +'\nDías de la semana: '+fechas+'.\nDevuelve SOLO JSON con esta forma: {"resumen":"2 frases","dias":[{"dia":"Lun","fecha":"AAAA-MM-DD","tipo":"correr|gym|descanso","titulo":"corto","detalle":"qué hacer, con ritmos o ejercicios","min":0,"niveles":{"basica":"...","media":"...","alta":"..."}}]}. Incluye un objeto por cada día desde '+desde+'. Los niveles solo en sesiones de gym. Usa "descanso" para días sin entrenar.';
  sample.json(prompt,{modelTier:'default',cache:false}).then(function(r){
    var pf=perfil(), okTipo={correr:1,gym:1,descanso:1}, rango={};
    DIAS.forEach(function(_,i){rango[iso(addDays(inicio,i))]=1});
    var cut=function(v,n){return String(v==null?'':v).slice(0,n)};
    var nuevo=(r&&Array.isArray(r.dias)?r.dias:[]).filter(function(d){return d&&typeof d.fecha==='string'&&rango[d.fecha]&&d.fecha>=desde}).map(function(d){
      var dn=dayName(parse(d.fecha)), t=okTipo[d.tipo]?d.tipo:'descanso', min=Math.max(0,Math.min(300,parseInt(d.min,10)||0)), cap=pf.minutos[dn];
      var o={dia:dn,fecha:d.fecha,tipo:t,titulo:cut(d.titulo,80),detalle:cut(d.detalle,600),min:min};
      if(pf.no.indexOf(dn)>=0||cap===0){o.tipo='descanso';o.titulo='No entrenas';o.detalle='Marcaste este día como no disponible.';o.min=0}
      else if(cap!=null&&min>cap){o.min=cap;o.detalle+=' (Ajustado a tus '+cap+' min disponibles.)'}
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
  }).catch(function(e){busy=false;msg=(e&&e.code==='not_granted')?'Necesitas permitir que la página consulte a Claude para generar la semana.':'No pude generar la semana. Inténtalo otra vez.';render()});
}

function enviarChat(texto){
  if(!sample||!texto.trim())return;
  chat.push({role:'user',content:texto});busy=true;render();
  var turnos=chat.map(function(t,i){return i===0?{role:'user',content:contexto()+'\n\nPREGUNTA: '+t.content}:t});
  sample(turnos,{modelTier:'default',cache:false}).then(function(r){chat.push({role:'assistant',content:r.text});busy=false;render()})
   .catch(function(e){chat.pop();busy=false;msg=(e&&e.code==='not_granted')?'Necesitas permitir que la página consulte a Claude.':'No pude responder. Inténtalo otra vez.';render()});
}

/* ---------- vistas ---------- */
function cuenta(meta){var d=Math.round((parse(meta.fecha)-parse(iso(new Date())))/864e5);return d}

function vistaHoy(){
  var out=[], meta=proximaMeta(), sem=semanaActual(), hoyIso=iso(new Date()), p=perfil();
  if(meta){var n=cuenta(meta);out.push(h('div',{class:'card hi'},h('h2',{text:'Próxima carrera'}),h('div',{class:'row sp'},h('div',null,h('div',{class:'big',text:n===0?'Hoy':String(n)}),h('div',{class:'mut small',text:n===0?'':(n===1?'día':'días')})),h('div',{style:'text-align:right'},h('h3',{text:meta.nombre}),h('div',{class:'mut small',text:fmt(meta.fecha)})))))}
  else out.push(h('div',{class:'card'},h('h3',{text:'Sin carreras próximas'}),h('p',{class:'mut small',text:'Agrega una meta en Perfil.'})));
  var lim3=iso(addDays(new Date(),-3)), mr=Object.keys(S.molestias).map(function(k){return S.molestias[k]}).filter(function(m){return m.fecha>=lim3&&(m.nivel==='urgente'||m.nivel==='pronto')});
  if(mr.length){var urg=mr.some(function(m){return m.nivel==='urgente'}), zs=mr.map(function(m){return m.zona}).filter(function(z,i,a){return a.indexOf(z)===i}).join(', ');
    out.push(h('div',{class:urg?'alert':'note'},h('b',{text:urg?'Molestia urgente reciente. ':'Molestia reciente. '}),(urg?'No entrenes hasta que te revise un médico. ':'Baja la carga y evita impacto. ')+'Zona: '+zs+'.'))}
  if(!p.libres.length&&!p.no.length&&!p.descanso){out.push(h('div',{class:'note'},'Aún no me dices tus días libres. ',h('button',{class:'chip',style:'margin-left:4px',onclick:function(){tab='perfil';render()}},'Configurar')))}
  var hoyDia=sem&&sem.dias.find(function(d){return d.fecha===hoyIso});
  if(hoyDia){
    var c=h('div',{class:'card hi'},h('div',{class:'row sp'},h('h2',{text:'Hoy · '+hoyDia.dia+' '+fmt(hoyDia.fecha)}),estadoPill(hoyDia)),h('h3',{text:hoyDia.titulo}),h('p',{class:'mut',text:hoyDia.detalle}),hoyDia.min?h('div',{class:'small mut',text:hoyDia.min+' min'}):null);
    if(hoyDia.tipo!=='descanso'&&hoyDia.estado==='pendiente'){
      c.appendChild(h('div',{class:'row'},h('button',{class:'p',onclick:function(){marcar(hoyDia.fecha,'hecha')}},'Hecha'),h('button',{onclick:function(){razon=!razon;render()}},'Hoy no pude')));
      if(razon){c.appendChild(h('div',{class:'row'},['Trabajo','Cansancio','Dolor','Clima','Otra'].map(function(m){return h('button',{class:'chip',onclick:function(){razon=false;marcar(hoyDia.fecha,'no_realizada',m);if(m==='Dolor'){tab='check';render()}}},m)})))}
    }
    if(hoyDia.estado==='no_realizada'){c.appendChild(h('p',{class:'small mut',text:'Quedó como no realizada'+(hoyDia.motivo?' ('+hoyDia.motivo+')':'')+'. No se duplica en otro día.'}));
      c.appendChild(h('button',{onclick:function(){planificar(iso(monday(new Date())),true)},disabled:busy},'Reajustar el resto de la semana'))}
    out.push(c);
  }
  out.push(vistaSemana(sem));
  if(msg)out.push(h('div',{class:'note',text:msg}));
  return out;
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
function vistaSemana(sem){
  var lunes=iso(monday(new Date())), sig=iso(addDays(monday(new Date()),7));
  var c=h('div',{class:'card'},h('div',{class:'row sp'},h('h2',{text:'Mi semana'}),sem?h('span',{class:'small mut',text:sem.dias.filter(function(d){return d.estado==='hecha'}).length+' de '+sem.dias.filter(function(d){return d.tipo!=='descanso'}).length+' hechas'}):null));
  if(sem){
    if(sem.resumen)c.appendChild(h('p',{class:'small mut',text:sem.resumen}));
    var p=perfil();
    sem.dias.forEach(function(d){
      var det=h('details',null,h('summary',null,h('span',{class:'d',text:d.dia}),h('span',{class:'t'},h('div',{style:'font-weight:600',text:d.titulo}),h('div',{class:'small mut',text:fmt(d.fecha)+(d.min?' · '+d.min+' min':'')+(d.fecha===p.descanso||d.dia===p.descanso?' · sobreesfuerzo':'')})),estadoPill(d)));
      det.appendChild(h('p',{class:'small',text:d.detalle}));
      if(d.niveles){det.appendChild(h('div',{class:'niv'},[['basica','Básica'],['media','Media'],['alta','Alta']].map(function(n){return d.niveles[n[0]]?h('div',null,h('b',{text:n[1]+': '}),d.niveles[n[0]]):null})))}
      c.appendChild(det);
    });
  } else c.appendChild(h('p',{class:'mut small',text:'Todavía no hay rutina para esta semana.'}));
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
  var pesos=pesosOrdenados().filter(function(x){return x.kg}), out=[];
  var c=h('div',{class:'card hi'},h('h2',{text:'Peso'}));
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
function vistaPerfil(){
  var p=perfil(), out=[];
  out.push(h('div',{class:'card hi'},h('h2',{text:'Días libres y de sobreesfuerzo'}),
    h('p',{class:'small mut',text:'Libre es un día sin trabajo o escuela, no sin ejercicio. Ese día puedo ponerte la salida larga o la sesión más fuerte.'}),
    grupo('Libre de trabajo o escuela','libre',p.libres,function(d){guardarPerfil({libres:toggle(p.libres,d),no:p.no.filter(function(x){return x!==d})});render()}),
    grupo('No puedo entrenar','no',p.no,function(d){guardarPerfil({no:toggle(p.no,d),libres:p.libres.filter(function(x){return x!==d}),descanso:p.descanso===d?'':p.descanso});render()}),
    h('div',null,h('div',{class:'small mut',style:'margin-bottom:6px',text:'Día de sobreesfuerzo preferido'}),h('div',{class:'row'},DIAS.filter(function(d){return p.no.indexOf(d)<0}).map(function(d){return h('button',{class:'chip','aria-pressed':String(p.descanso===d),onclick:function(){guardarPerfil({descanso:p.descanso===d?'':d});render()}},d)}))),
    h('label',{for:'carga'},'Carga de tu trabajo en general',(function(){var s=h('select',{id:'carga'},['Ligero','Normal','Pesado'].map(function(o){return h('option',{value:o,text:o,selected:p.carga===o})}));s.addEventListener('change',function(){guardarPerfil({carga:s.value})});return s})())));
  out.push(h('div',{class:'card'},h('h2',{text:'Inicio de mi semana'}),h('p',{class:'small mut',text:'Elige el día en que empieza tu semana de entrenamiento. Las rutinas se arman de ese día a 7 días después.'}),h('label',{for:'inicio'},'La semana empieza el',(function(){var s=h('select',{id:'inicio'},DIAS.map(function(o){return h('option',{value:o,text:o,selected:p.inicioSemana===o})}));s.addEventListener('change',function(){guardarPerfil({inicioSemana:s.value});render()});return s})())));
  out.push(h('div',{class:'card'},h('h2',{text:'Minutos disponibles por día'}),h('div',{style:'display:grid;grid-template-columns:repeat(auto-fit,minmax(86px,1fr));gap:10px'},DIAS.map(function(d){
    var i=h('input',{type:'number',id:'m'+d,min:'0',max:'300',step:'5',inputmode:'numeric',placeholder:'60',value:p.minutos[d]!=null?p.minutos[d]:''});
    i.addEventListener('change',function(){var m=Object.assign({},p.minutos);if(i.value==='')delete m[d];else m[d]=Math.max(0,Math.min(300,parseInt(i.value,10)||0));guardarPerfil({minutos:m})});
    return h('label',{for:'m'+d},d,i)}))));
  var gy=p.gym||{}, gBrazo=gy.brazo||[], gPierna=gy.pierna||[];
  function guardarGym(patch){guardarPerfil({gym:Object.assign({},p.gym||{},patch)})}
  var gnom=h('input',{type:'text',id:'gn',maxlength:'80',placeholder:'Ej. Bestia´s Gym',value:gy.nombre||''});
  gnom.addEventListener('change',function(){guardarGym({nombre:gnom.value.trim()})});
  var geq=h('textarea',{id:'ge',maxlength:'1500',placeholder:'Ej. Prensa de pierna, jalón al pecho, mancuernas de 5 a 30 kg, barra olímpica...'},gy.equipo||'');
  geq.addEventListener('change',function(){guardarGym({equipo:geq.value.trim()})});
  out.push(h('div',{class:'card'},h('h2',{text:'Mi gimnasio'}),
    h('p',{class:'small mut',text:'Con esto armo tus rutinas de gym: qué días entrenas brazo y pierna, y con qué cuentas.'}),
    h('label',{for:'gn'},'Nombre',gnom),
    grupo('Días de brazo','',gBrazo,function(d){guardarGym({brazo:toggle(gBrazo,d)});render()}),
    grupo('Días de pierna','',gPierna,function(d){guardarGym({pierna:toggle(gPierna,d)});render()}),
    h('label',{for:'ge'},'Máquinas, pesos y equipo disponible',geq)));
  var por=h('textarea',{id:'porque',placeholder:'La razón por la que haces esto'},p.porque||'');
  por.addEventListener('change',function(){guardarPerfil({porque:por.value.trim()})});
  out.push(h('div',{class:'card'},h('h2',{text:'Mi porqué'}),por,h('p',{class:'small mut',text:'Te lo recuerdo los días de poca energía.'})));
  var nom=h('input',{type:'text',id:'mn',placeholder:'Ej. Medio maratón'}),fec=h('input',{type:'date',id:'mf'});
  var metas=(p.metas||[]).slice().sort(function(a,b){return a.fecha<b.fecha?-1:1});
  out.push(h('div',{class:'card'},h('h2',{text:'Metas y carreras'}),
    metas.length?metas.map(function(m,i){return h('div',{class:'row sp'},h('span',null,h('b',{text:m.nombre}),' · '+fmt(m.fecha)),h('button',{class:'chip','aria-label':'Quitar '+m.nombre,onclick:function(){guardarPerfil({metas:metas.filter(function(_,j){return j!==i})});render()}},'Quitar'))}):h('p',{class:'mut small',text:'Sin metas.'}),
    h('label',{for:'mn'},'Nueva meta',nom),h('label',{for:'mf'},'Fecha',fec),
    h('button',{onclick:function(){if(!nom.value.trim()||!fec.value)return;guardarPerfil({metas:metas.concat([{nombre:nom.value.trim(),fecha:fec.value}])});drafts.mn='';drafts.mf='';render()}},'Agregar meta')));
  if(acct)out.push(h('div',{class:'card'},h('h2',{text:'Cuenta'}),h('p',{class:'small mut',text:acct.email}),
    h('div',{class:'row'},h('button',{onclick:function(){acct.signOut()}},'Cerrar sesión'),h('button',{onclick:function(){acct.signOutAll()}},'Cerrar sesión en todos los dispositivos'))));
  out.push(h('div',{class:'card'},h('h2',{text:'Mis datos'}),h('p',{class:'small mut',text:'Descarga una copia de tu perfil, semanas, pesos y molestias.'}),
    descargas?h('button',{onclick:function(){descargas.save({filename:'entrenador-respaldo-'+iso(new Date())+'.json',data:JSON.stringify(S,null,2)}).catch(function(){})}},'Descargar respaldo'):h('p',{class:'small mut',text:'La descarga no está disponible en esta vista.'})));
  return out;
}
function grupo(titulo,clase,sel,fn){return h('div',null,h('div',{class:'small mut',style:'margin-bottom:6px',text:titulo}),h('div',{class:'row'},DIAS.map(function(d){return h('button',{class:'chip '+clase,'aria-pressed':String(sel.indexOf(d)>=0),onclick:function(){fn(d)}},d)})))}

/* ---------- render ---------- */
function render(){
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

function estadoDb(t){var e=document.getElementById('estadoDb');e.textContent=t}

function subs(){
  var vivo=false;
  function ok(){if(!vivo){vivo=true;estadoDb('Guardado en línea')}}
  db.doc('perfil/yo').onSnapshot(function(s){S.perfil=s.exists?s.data():{};ok();render()},function(){estadoDb('Sin conexión')});
  ['semanas','pesos','molestias'].forEach(function(c){db.collection(c).onSnapshot(function(q){var o={};q.docs.forEach(function(d){o[d.id]=d.data()});S[c]=o;ok();render()},function(){estadoDb('Sin conexión')})});
}


function reset(){S={perfil:{},semanas:{},pesos:{},molestias:{}};chat=[];drafts={};msg='';tab='hoy';busy=false;razon=false;lastTriage=null;draftMood=null}
window.EntrenadorApp={
  start:function(b){reset();db=b.db;sample=b.sample;descargas=b.descargas;acct=b.account||null;estadoDb('Conectando');render();subs()},
  stop:function(){reset();db=null;sample=null;descargas=null;acct=null;var v=document.getElementById('view');v.replaceChildren();var n=document.getElementById('nav');n.replaceChildren()},
  status:estadoDb
};
})();
