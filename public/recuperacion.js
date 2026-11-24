/* Recuperación automática después de una carrera o meta (bloque H).
   Se calcula aquí, antes de llamar al coach: el coach solo recibe una línea y la app aplica las reglas
   a los días que regresa (descanso, sin correr, tope de minutos).
   Sin DOM ni red: la app lo usa (window.Recuperacion) y las pruebas lo revisan (node --test). */
(function(root){
'use strict';
var M=typeof module!=='undefined'&&module.exports?require('./metas.js'):root.Metas;
var MR=typeof module!=='undefined'&&module.exports?require('./marcas.js'):root.Marcas;

/* Conservador / Normal / Exigente: % menos de volumen y días de descanso extra. */
var AGRESIVIDAD={
  conservador:{t:'Conservador',larga:40,normal:25,dias:1},
  normal:{t:'Normal',larga:35,normal:20,dias:0},
  exigente:{t:'Exigente',larga:30,normal:15,dias:-1}
};
function agr(a){return AGRESIVIDAD[a]||AGRESIVIDAD.normal}

function kmMeta(m){
  var t=M.tipoDe(m);
  if(t==='montana')return M.kmEsfuerzo(m);
  if(t==='triatlon')return null;
  var d=M.distDe(m);return MR.KM_DIST[d]||null;
}
function nivelKm(km){return km>=42?4:km>=21?3:km>=10?2:km>0?1:0}

/* Carreras terminadas: metas logradas y resultados de tipo carrera registrados como marca. */
function eventos(perfil){
  var p=perfil||{}, out=[];
  (p.metas||[]).forEach(function(m){
    if(!m.lograda)return; var r=m.resultado||{};
    out.push({fecha:m.lograda,nombre:m.nombre,km:kmMeta(m),n:M.esfuerzo(m),sent:r.sent||null,prevKm:r.prevKm,clave:M.clave(m)});
  });
  var marcas=p.marcas||{};
  Object.keys(marcas).forEach(function(d){(marcas[d]||[]).forEach(function(m){
    if(m.tipo!=='carrera'||m.metaId)return;
    var km=MR.kmMarca(m);
    out.push({fecha:m.fecha,nombre:km?(m.dist==='otra'?'carrera de '+km+' km':MR.DIST_CORRER.filter(function(x){return x[0]===m.dist})[0][1]):'carrera',km:km||null,n:nivelKm(km),sent:m.sent||null,prevKm:m.prevKm});
  })});
  return out.sort(function(a,b){return a.fecha<b.fecha?-1:a.fecha>b.fecha?1:0});
}
/* Carrera más larga antes de esta fecha (para guardarla con el resultado). */
function previaKm(evs,fecha,exp){
  var k=Math.max.apply(null,[0].concat((evs||[]).filter(function(e){return e.fecha<fecha&&e.km}).map(function(e){return e.km})));
  var ex=exp&&MR.KM_DIST[exp.max]; return Math.max(k,ex||0);
}
/* Larga para mí: más que mi carrera más larga anterior, 21 km o más (o un triatlón medio o mayor), o esfuerzo 5 de 5. */
function clasificar(ev,evs,exp){
  var prev=ev.prevKm!=null?ev.prevKm:previaKm(evs,ev.fecha,exp);
  if(ev.sent===5)return 'larga';
  if(ev.n>=3||(ev.km&&ev.km>=21))return 'larga';
  if(ev.km&&ev.km>prev)return 'larga';
  return 'normal';
}
/* La semana de recuperación es la primera que empieza después de la carrera. */
function semanaRec(ev,ini){return M.iso(M.addDays(M.parse(M.inicioSemana(ev.fecha,ini)),7))}
function mas(f,n){return M.iso(M.addDays(M.parse(f),n))}
function r5(x){return Math.round(x/5)*5}

/* Recuperación que toca a la semana que empieza en inicio, o null.
   k=1: semana de recuperación; k=2: regreso gradual (la mitad de la reducción). */
function semana(perfil,inicio,ini,exp){
  var p=perfil||{}, evs=eventos(p), a=agr(p.recuperacion), elegido=null;
  for(var i=evs.length-1;i>=0;i--){
    var e=evs[i], s=semanaRec(e,ini);
    if(s===inicio){elegido={ev:e,k:1};break}
    if(!elegido&&mas(s,7)===inicio)elegido={ev:e,k:2};
  }
  /* los días después de la carrera aplican aunque caigan en la misma semana de la carrera */
  var cerca=evs.filter(function(e){return e.fecha<inicio?mas(e.fecha,4)>=inicio:e.fecha<=mas(inicio,6)}).pop();
  if(!elegido&&!cerca)return null;
  var ev=elegido?elegido.ev:cerca, tipo=clasificar(ev,evs,exp||p.exp);
  var nDesc=tipo==='larga'?Math.max(1,((ev.n>=3||(ev.km||0)>=21)?2:1)+a.dias):0;
  var descanso=[],sinCorrer=[mas(ev.fecha,1)];
  for(var d=1;d<=nDesc;d++){descanso.push(mas(ev.fecha,d));if(sinCorrer.indexOf(mas(ev.fecha,d))<0)sinCorrer.push(mas(ev.fecha,d))}
  var k=elegido?elegido.k:0, red=k===1?a[tipo]:k===2?r5(a[tipo]/2):0;
  return {ev:ev,tipo:tipo,k:k,red:red,descanso:descanso,sinCorrer:sinCorrer,suave:tipo==='normal'?[mas(ev.fecha,1)]:[],
    motivo:k===2?'Regreso gradual después de tu '+ev.nombre+' del '+M.fmt(ev.fecha):'Semana de recuperación después de tu '+ev.nombre+' del '+M.fmt(ev.fecha)};
}
function enSemana(f,inicio){return f>=inicio&&f<=mas(inicio,6)}
/* Minutos máximos de la semana: base (lo planeado antes de la carrera) menos la reducción. */
function maxMin(base,red){return base>0&&red>0?r5(base*(1-red/100)):null}

/* Aplica la recuperación a los días que devuelve el coach. */
function aplicar(dias,rec,inicio,max){
  if(!rec)return dias;
  var out=(dias||[]).map(function(d){
    var o=Object.assign({},d);
    if(rec.descanso.indexOf(o.fecha)>=0){o.tipo='descanso';o.titulo='Descanso completo';o.detalle='Recuperación después de tu '+rec.ev.nombre+'. Duerme, hidrátate y camina un poco si quieres.';o.min=0;delete o.niveles;delete o.ejercicios}
    else if(rec.sinCorrer.indexOf(o.fecha)>=0&&o.tipo==='correr'){o.tipo='descanso';o.titulo='Descanso o movilidad suave';o.detalle='Hoy no se corre: 15 a 20 min de movilidad o caminata suave si te sientes bien.';o.min=0}
    return o;
  });
  if(max){
    var tot=out.reduce(function(s,d){return s+(d.tipo==='descanso'?0:(+d.min||0))},0);
    if(tot>max){var f=max/tot, act=out.filter(function(d){return d.tipo!=='descanso'&&d.min});
      act.forEach(function(d){var v=Math.max(10,Math.floor(d.min*f/5)*5);if(v<d.min){d.min=v;d.detalle=String(d.detalle||'')+' (Recortado por la semana de recuperación.)'}});
      /* nunca por encima del tope: si aún sobra, quita 5 min a la sesión más larga */
      var suma=function(){return act.reduce(function(s,d){return s+d.min},0)};
      for(var g=0;g<100&&suma()>max;g++){var mayor=act.slice().sort(function(a,b){return b.min-a.min})[0];if(mayor.min<=10)break;mayor.min-=5}}
  }
  return out;
}
/* La única línea que recibe el coach. */
function linea(rec,inicio,max){
  if(!rec)return '';
  var DIAS=['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
  var nom=function(f){return DIAS[M.parse(f).getDay()]+' '+M.fmt(f)};
  var sc=rec.sinCorrer.filter(function(f){return enSemana(f,inicio)}), ds=rec.descanso.filter(function(f){return enSemana(f,inicio)});
  var t=[];
  if(rec.k===1)t.push('SEMANA DE RECUPERACIÓN después de '+rec.ev.nombre+' ('+rec.ev.fecha+', carrera '+rec.tipo+' según su historial): '+(max?'máximo '+max+' min en la semana':'volumen '+rec.red+'% menor que antes de la carrera'));
  else if(rec.k===2)t.push('REGRESO GRADUAL después de '+rec.ev.nombre+': '+(max?'máximo '+max+' min en la semana':'volumen '+rec.red+'% menor')+', sube poco a poco hacia el plan');
  else t.push('DESPUÉS DE '+rec.ev.nombre+' ('+rec.ev.fecha+')');
  if(ds.length)t.push('descanso completo el '+ds.map(nom).join(' y '));
  if(sc.length)t.push('sin correr el '+sc.map(nom).join(' y '));
  if(rec.k)t.push('sin ritmos rápidos');
  return t.join(', ')+'.';
}

/* El plan retoma la fase donde iba: cada semana de recuperación insertada antes de la afinación
   recorre un paso los objetivos, sin saltarse semanas. La afinación queda pegada a la fecha de la meta. */
function semanaAjustada(pl,fecha,perfil,ini){
  var s=M.semanaPlan(pl,fecha,ini); if(!s||s.pre)return s;
  var lunes=M.inicioSemana(fecha,ini), af=(pl.sem.filter(function(w){return w.fase==='afinacion'})[0]||{}).lunes||'9999';
  var recs=eventos(perfil).map(function(e){return semanaRec(e,ini)}).filter(function(r,i,a){return a.indexOf(r)===i});
  if(recs.indexOf(lunes)>=0&&lunes<af)return Object.assign({},s,{recuperacion:true});
  if(s.fase==='afinacion')return s;
  /* una recuperación que cae en semana de descarga ya hace de descarga: no recorre nada */
  var shift=recs.filter(function(r){var w=pl.sem.filter(function(x){return x.lunes===r})[0];return r>=pl.inicio&&r<lunes&&r<af&&w&&!w.desc}).length;
  if(!shift)return s;
  var k=Math.max(1,s.k-shift);
  return Object.assign({},pl.sem[k-1],{k:s.k,retoma:k});
}

var API={AGRESIVIDAD:AGRESIVIDAD,eventos:eventos,previaKm:previaKm,clasificar:clasificar,semanaRec:semanaRec,semana:semana,maxMin:maxMin,aplicar:aplicar,linea:linea,semanaAjustada:semanaAjustada};
if(typeof module!=='undefined'&&module.exports)module.exports=API; else root.Recuperacion=API;
})(typeof window!=='undefined'?window:this);
