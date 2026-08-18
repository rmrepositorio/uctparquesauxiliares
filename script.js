// ── Paleta ──
const PALETA = ['#00d4aa','#7c6fe0','#ff6b6b','#ffd166','#06d6a0','#118ab2','#ef476f','#f78c6b','#88d498','#c77dff','#48cae4','#f4a261','#e76f51','#2ec4b6','#e9c46a','#a8dadc','#457b9d','#e63946','#2a9d8f','#f3722c'];
function genColores(n){ return Array.from({length:n},(_,i)=>PALETA[i%PALETA.length]); }

// ── Estado ──
let charts={}, filtrosActivos={}, exclusiones={}, modoOscuro=true, tablaDT;
let historial=[], historialIdx=-1;

function getLegendColor(){ return modoOscuro?'#e0e0f0':'#1a1a2e'; }
function getGridColor()  { return modoOscuro?'rgba(255,255,255,0.07)':'rgba(0,0,0,0.07)'; }

// ── Persistencia ──
function guardarEstado(){
  try{
    const ex={};
    for(const k in exclusiones) ex[k]=[...exclusiones[k]];
    localStorage.setItem('ct_filtros',JSON.stringify(filtrosActivos));
    localStorage.setItem('ct_excl',JSON.stringify(ex));
  }catch(e){}
}
function cargarEstado(){
  try{
    const f=localStorage.getItem('ct_filtros');
    const e=localStorage.getItem('ct_excl');
    if(f) filtrosActivos=JSON.parse(f);
    if(e){ const r=JSON.parse(e); for(const k in r) exclusiones[k]=new Set(r[k]); }
  }catch(e){}
}

// ── Modo claro/oscuro ──
document.getElementById('toggleModo').addEventListener('click',()=>{
  modoOscuro=!modoOscuro;
  document.body.classList.toggle('light-mode',!modoOscuro);
  document.getElementById('toggleModo').textContent=modoOscuro?'☀ Modo claro':'🌙 Modo oscuro';
  const col=getLegendColor(), grid=getGridColor();
  Object.values(charts).forEach(c=>{
    if(c.options.plugins?.legend?.labels) c.options.plugins.legend.labels.color=col;
    if(c.options.scales) Object.values(c.options.scales).forEach(s=>{ if(s.ticks) s.ticks.color=col; if(s.grid) s.grid.color=grid; });
    c.update();
  });
  if(tablaDT) tablaDT.draw(false);
});

// ── Historial ──
function actualizarBotones(){
  document.getElementById('btnAtras').disabled=historialIdx<=0;
  document.getElementById('btnAdelante').disabled=historialIdx>=historial.length-1;
}
function pushHistorial(){
  historial=historial.slice(0,historialIdx+1);
  historial.push(JSON.parse(JSON.stringify(filtrosActivos)));
  historialIdx=historial.length-1;
  actualizarBotones(); guardarEstado();
}
document.getElementById('btnAtras').addEventListener('click',()=>{
  if(historialIdx>0){ historialIdx--; filtrosActivos=JSON.parse(JSON.stringify(historial[historialIdx])); renderTags(); actualizarGraficos(); actualizarBotones(); guardarEstado(); }
});
document.getElementById('btnAdelante').addEventListener('click',()=>{
  if(historialIdx<historial.length-1){ historialIdx++; filtrosActivos=JSON.parse(JSON.stringify(historial[historialIdx])); renderTags(); actualizarGraficos(); actualizarBotones(); guardarEstado(); }
});
document.getElementById('btnLimpiar').addEventListener('click',()=>{
  filtrosActivos={}; exclusiones={}; pushHistorial(); renderTags(); actualizarGraficos();
});

// ── Tags filtros ──
function renderTags(){
  const cont=document.getElementById('filtrosActivos');
  cont.innerHTML='';
  Object.entries(filtrosActivos).forEach(([k,v])=>{
    if(!v) return;
    const t=document.createElement('span'); t.className='filtro-tag';
    t.textContent=`${k}: ${v}  ✕`;
    t.onclick=()=>{ delete filtrosActivos[k]; pushHistorial(); renderTags(); actualizarGraficos(); };
    cont.appendChild(t);
  });
  Object.entries(exclusiones).forEach(([campo,set])=>{
    if(!set.size) return;
    const t=document.createElement('span'); t.className='filtro-tag filtro-excluido';
    t.textContent=`Excluidos ${campo}: ${set.size} ✕`; t.title=[...set].join(', ');
    t.onclick=()=>{ exclusiones[campo]=new Set(); guardarEstado(); renderTags(); actualizarGraficos(); };
    cont.appendChild(t);
  });
}

// ── Menú exclusión ──
function abrirMenuExcl(campo, valores, anchorEl){
  cerrarMenus();
  const menu=document.createElement('div'); menu.id='menuExcl'; menu.className='excl-menu';
  const tit=document.createElement('div'); tit.className='excl-title'; tit.textContent='Filtrar: '+campo; menu.appendChild(tit);
  const bar=document.createElement('div'); bar.className='excl-barra';
  const bT=document.createElement('button'); bT.textContent='✓ Todo'; bT.onclick=()=>menu.querySelectorAll('input').forEach(c=>c.checked=true);
  const bN=document.createElement('button'); bN.textContent='✗ Ninguno'; bN.onclick=()=>menu.querySelectorAll('input').forEach(c=>c.checked=false);
  bar.appendChild(bT); bar.appendChild(bN); menu.appendChild(bar);
  const lista=document.createElement('div'); lista.className='excl-lista';
  const excAct=exclusiones[campo]||new Set();
  valores.forEach(val=>{
    const row=document.createElement('label'); row.className='excl-row';
    const cb=document.createElement('input'); cb.type='checkbox'; cb.value=val; cb.checked=!excAct.has(val);
    const sp=document.createElement('span'); sp.textContent=val;
    row.appendChild(cb); row.appendChild(sp); lista.appendChild(row);
  });
  menu.appendChild(lista);
  const btn=document.createElement('button'); btn.className='excl-aplicar'; btn.textContent='Aplicar';
  btn.onclick=()=>{
    const ex=new Set();
    menu.querySelectorAll('input').forEach(cb=>{ if(!cb.checked) ex.add(cb.value); });
    exclusiones[campo]=ex; guardarEstado(); renderTags(); actualizarGraficos(); cerrarMenus();
  };
  menu.appendChild(btn); document.body.appendChild(menu);
  const r=anchorEl.getBoundingClientRect();
  // Mantener dentro de la ventana
  requestAnimationFrame(()=>{
    const mW=menu.offsetWidth, mH=menu.offsetHeight;
    const top=(r.bottom+4+mH>window.innerHeight) ? Math.max(4,r.top-mH-4) : r.bottom+4;
    const left=(r.left+mW>window.innerWidth) ? Math.max(4,window.innerWidth-mW-8) : r.left;
    menu.style.top=top+'px'; menu.style.left=left+'px';
  });
  setTimeout(()=>document.addEventListener('click',cerrarAlFuera),10);
}
function cerrarAlFuera(e){
  ['menuExcl','menuColumnas'].forEach(id=>{ const m=document.getElementById(id); if(m&&!m.contains(e.target)) m.remove(); });
  document.removeEventListener('click',cerrarAlFuera);
}
function cerrarMenus(){
  ['menuExcl','menuColumnas'].forEach(id=>{ const m=document.getElementById(id); if(m) m.remove(); });
  document.removeEventListener('click',cerrarAlFuera);
}

// ── Cargar JSON ──
fetch('resumen_full.json')
  .then(r=>r.json())
  .then(data=>{
    // Normalizar campos de texto: trim + uppercase
    const CAMPOS_NORM=['FAMILIA AVERIA','FAMILIA','ORIGEN AVISO','TURNO','VHLO','TIPO ORDEN'];
    const normStr=s=>s.toString().trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();
    data.forEach(d=>{
      CAMPOS_NORM.forEach(k=>{ if(d[k]) d[k]=normStr(d[k]); });
      try {
        if(!d['FECHA AVISO']) return;
        const parts=d['FECHA AVISO'].split('/').map(Number);
        if(parts.length!==3 || parts.some(isNaN)) return;
        const fecha=new Date(parts[2],parts[1]-1,parts[0]);
        if(!isNaN(fecha)) d.fechaJS=fecha;
      } catch(e) {}
    });
    window.dataTabla=data;
    cargarEstado();
    inicializarFechas();
    inicializarTabla();
    crearGraficos();
    renderTags();
    actualizarGraficos();
    iniciarResizeAltura();
  })
  .catch(e=>console.error('Error JSON:',e));

// ── Fechas ──
function inicializarFechas(){
  const fechas=window.dataTabla.filter(d=>d.fechaJS && !isNaN(d.fechaJS)).map(d=>d.fechaJS);
  if(!fechas.length) return;
  document.getElementById('fechaInicio').valueAsDate=new Date(Math.min(...fechas));
  document.getElementById('fechaFin').valueAsDate=new Date(Math.max(...fechas));
  document.getElementById('fechaInicio').addEventListener('change',actualizarGraficos);
  document.getElementById('fechaFin').addEventListener('change',actualizarGraficos);
}

// ── Crear gráficos ──
function crearGraficos(){
  const col=getLegendColor(), grid=getGridColor();

  function clickBarra(campo){
    return (evt,elems)=>{
      if(!elems.length) return;
      const val=evt.chart.data.labels[elems[0].index];
      if(filtrosActivos[campo]===val) delete filtrosActivos[campo]; else filtrosActivos[campo]=val;
      pushHistorial(); renderTags(); actualizarGraficos();
    };
  }

  function opsBarra(campo, horiz){
    return {
      responsive:true, maintainAspectRatio:false,
      indexAxis: horiz?'y':'x',
      plugins:{legend:{display:true,position:'bottom',labels:{color:col,boxWidth:12,padding:8,font:{size:10}}}},
      scales:{
        x:{ticks:{color:col,font:{size:10},maxRotation:horiz?0:40},grid:{color:grid}},
        y:{ticks:{color:col,font:{size:10}},grid:{color:grid}}
      },
      onClick:clickBarra(campo)
    };
  }

  charts.familia=new Chart(document.getElementById('graficoFamilia').getContext('2d'),{
    type:'bar', data:{labels:[],datasets:[{label:'Familia Avería',data:[],backgroundColor:[],borderWidth:0,borderRadius:3}]},
    options:opsBarra('FAMILIA AVERIA',true)
  });

  charts.turno=new Chart(document.getElementById('graficoTurno').getContext('2d'),{
    type:'doughnut',
    data:{labels:[],datasets:[{data:[],backgroundColor:[],borderWidth:2,borderColor:modoOscuro?'#1e1e2e':'#f0f4ff'}]},
    options:{
      responsive:true, maintainAspectRatio:false,
      layout:{padding:40},
      plugins:{
        legend:{display:false},
        tooltip:{callbacks:{label:ctx=>{
          const tot=ctx.dataset.data.reduce((a,b)=>a+b,0);
          return ` ${ctx.label}: ${ctx.parsed} (${((ctx.parsed/tot)*100).toFixed(1)}%)`;
        }}}
      },
      onClick:(evt,elems)=>{
        if(!elems.length) return;
        const val=evt.chart.data.labels[elems[0].index];
        if(filtrosActivos['TURNO']===val) delete filtrosActivos['TURNO']; else filtrosActivos['TURNO']=val;
        pushHistorial(); renderTags(); actualizarGraficos();
      }
    },
    plugins:[{
      id:'turnoLabels',
      afterDraw(chart){
        const ctx2=chart.ctx, ds=chart.data.datasets[0], meta=chart.getDatasetMeta(0);
        const tot=ds.data.reduce((a,b)=>a+b,0); if(!tot) return;
        ctx2.save();
        meta.data.forEach((arc,i)=>{
          const val=ds.data[i]; if(!val) return;
          const pct=((val/tot)*100).toFixed(1);
          const lbl=chart.data.labels[i]; if(!lbl) return;
          const ang=(arc.startAngle+arc.endAngle)/2;
          const midR=(arc.innerRadius+arc.outerRadius)/2;
          const cx=arc.x+Math.cos(ang)*midR, cy=arc.y+Math.sin(ang)*midR;
          const outerR=arc.outerRadius+18;
          const lx=arc.x+Math.cos(ang)*outerR, ly=arc.y+Math.sin(ang)*outerR;
          ctx2.beginPath(); ctx2.moveTo(cx,cy); ctx2.lineTo(lx,ly);
          ctx2.strokeStyle='rgba(200,200,200,0.5)'; ctx2.lineWidth=1; ctx2.stroke();
          ctx2.font='bold 11px Inter,sans-serif';
          ctx2.fillStyle=getLegendColor();
          ctx2.textAlign=Math.cos(ang)>=0?'left':'right';
          ctx2.fillText(`${lbl} (${pct}%)`, lx+(Math.cos(ang)>=0?5:-5), ly+4);
        });
        ctx2.restore();
      }
    }]
  });

  charts.origen=new Chart(document.getElementById('graficoOrigen').getContext('2d'),{
    type:'bar', data:{labels:[],datasets:[{label:'Origen Aviso',data:[],backgroundColor:[],borderWidth:0,borderRadius:3}]},
    options:opsBarra('ORIGEN AVISO',false)
  });

  charts.familiaVeh=new Chart(document.getElementById('graficoFamiliaVeh').getContext('2d'),{
    type:'bar', data:{labels:[],datasets:[{label:'Familia Vehículo',data:[],backgroundColor:[],borderWidth:0,borderRadius:3}]},
    options:opsBarra('FAMILIA',true)
  });

  charts.vhlo=new Chart(document.getElementById('graficoVHLO').getContext('2d'),{
    type:'bar', data:{labels:[],datasets:[{label:'Vehículo',data:[],backgroundColor:[],borderWidth:0,borderRadius:3}]},
    options:opsBarra('VHLO',false)
  });

  charts.descripcion=new Chart(document.getElementById('graficoDescripcion').getContext('2d'),{
    type:'bar', data:{labels:[],datasets:[{label:'Descripción Avería',data:[],backgroundColor:[],borderWidth:0,borderRadius:3}]},
    options:{
      responsive:true, maintainAspectRatio:false,
      indexAxis:'y',
      plugins:{legend:{display:true,position:'bottom',labels:{color:col,boxWidth:12,padding:8,font:{size:10}}}},
      scales:{
        x:{ticks:{color:col},grid:{color:grid}},
        y:{ticks:{color:col,font:{size:10}},grid:{color:grid}}
      },
      onClick:(evt,elems)=>{
        if(!elems.length) return;
        const val=evt.chart.data.labels[elems[0].index];
        if(filtrosActivos['_DESCRIPCION_NORM']===val) delete filtrosActivos['_DESCRIPCION_NORM'];
        else filtrosActivos['_DESCRIPCION_NORM']=val;
        pushHistorial(); renderTags(); actualizarGraficos();
      }
    }
  });

  charts.evolucion=new Chart(document.getElementById('graficoEvolucion').getContext('2d'),{
    type:'line', data:{labels:[],datasets:[]},
    options:{
      responsive:true, maintainAspectRatio:false,
      interaction:{mode:'index', intersect:false},
      plugins:{
        legend:{display:true,position:'bottom',labels:{color:col,boxWidth:12,padding:8,font:{size:10}}},
        tooltip:{
          mode:'index', intersect:false,
          callbacks:{
            title: ctx => ctx[0]?.label || '',
            label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y}`
          }
        }
      },
      scales:{x:{ticks:{color:col},grid:{color:grid}},y:{ticks:{color:col},grid:{color:grid}}}
    }
  });

  document.querySelectorAll('.btn-filtro-panel').forEach(btn=>{
    btn.addEventListener('click',e=>{
      e.stopPropagation();
      const campo=btn.dataset.campo;
      const vals=[...new Set(window.dataTabla.map(d=>d[campo]?d[campo].toString().trim().toUpperCase():null).filter(v=>v&&v!=='****'))].sort();
      abrirMenuExcl(campo,vals,btn);
    });
  });
}

// ── Tabla ──
function inicializarTabla(){
  $('#tablaAverias thead').clone(true).appendTo('#tablaAverias thead');
  $('#tablaAverias thead tr:eq(1) th').each(function(i){
    const title=$(this).text();
    $(this).html(`<input type="text" placeholder="${title}" style="width:100%;font-size:11px;padding:2px 4px;background:var(--input-bg);color:var(--input-text);border:1px solid var(--border);border-radius:3px;" />`);
    $('input',this).on('keyup change',function(){ if(tablaDT.column(i).search()!==this.value) tablaDT.column(i).search(this.value).draw(); });
  });

  tablaDT=$('#tablaAverias').DataTable({
    data:[],
    columns:[
      {title:'Vehículo',      data:'VHLO',                   width:'80px'},
      {title:'Familia Veh.',  data:'FAMILIA',                width:'110px'},
      {title:'Familia Avería',data:'FAMILIA AVERIA',         width:'130px'},
      {title:'Descripción',   data:null,                     width:'220px', defaultContent:'-',
        render:function(d,t,row){
          // Buscar campo descripcion con cualquier variante de nombre
          for(const k of Object.keys(row)){
            // Normalizar: quitar tildes, caracteres especiales, pasar a mayúsculas
            const kn=k.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z ]/g,'').trim();
            if(kn==='DESCRIPCION AVERIA'||kn==='DESCRIPCION'){
              const v=row[k];
              if(v&&v.toString().trim()) return `<span title="${v}" style="display:block;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${v}</span>`;
            }
          }
          return '-';
        }},
      {title:'Deficiencias',  data:'DEFICIENCIAS DETECTADAS',width:'180px', defaultContent:'-',
        render:function(d){ return d?`<span title="${d}" style="display:block;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${d}</span>`:'-'; }},
      {title:'Fecha Aviso',   data:'FECHA AVISO',            width:'90px'},
      {title:'Turno',         data:'TURNO',                  width:'70px'},
      {title:'Origen Aviso',  data:'ORIGEN AVISO',           width:'110px'},
      {title:'Tipo Orden',    data:'TIPO ORDEN',             width:'90px'},
      {title:'Conductor',     data:'CONDUCTOR',              width:'100px', defaultContent:'-'},
      {title:'Nº Aviso',      data:null,                     width:'110px', defaultContent:'-',
        render:function(d,t,row){
          for(const k of Object.keys(row)){
            if(k.replace(/[^A-Z ]/g,'').trim()==='N AVISO') return row[k]||'-';
          }
          return '-';
        }}
    ],
    orderCellsTop:true, colReorder:true, scrollX:true, pageLength:25,
    language:{search:'Buscar:',lengthMenu:'Mostrar _MENU_ registros',info:'Mostrando _START_–_END_ de _TOTAL_',paginate:{previous:'‹',next:'›'}}
  });

  if($.fn.colResizable){
    $('#tablaAverias').colResizable({liveDrag:true,gripInnerHtml:"<div class='col-grip'></div>",draggingClass:'col-dragging',minWidth:50});
  }

  const btnAleatorio=document.getElementById('btnAleatorio');
  if(btnAleatorio) btnAleatorio.addEventListener('click',function(){
    window._ordenAleatorio = !window._ordenAleatorio;
    this.textContent = window._ordenAleatorio ? '🔀 Orden original' : '🔀 Orden aleatorio';
    this.style.background = window._ordenAleatorio ? 'var(--accent)' : '';
    this.style.color = window._ordenAleatorio ? 'var(--bg)' : '';
    if(window._ordenAleatorio){
      // Quitar ordenación por columna para que no interfiera
      tablaDT.order([]).draw(false);
      // Barajar el array de datos y recargar
      const data = tablaDT.rows({search:'applied'}).data().toArray();
      for(let i=data.length-1;i>0;i--){
        const j=Math.floor(Math.random()*(i+1));
        [data[i],data[j]]=[data[j],data[i]];
      }
      tablaDT.clear(); tablaDT.rows.add(data); tablaDT.draw(false);
    } else {
      actualizarGraficos();
    }
  });

  document.getElementById('btnColumnas').addEventListener('click',function(e){
    e.stopPropagation();
    let menu=document.getElementById('menuColumnas');
    if(menu){ menu.remove(); return; }
    menu=document.createElement('div'); menu.id='menuColumnas'; menu.className='excl-menu';
    const tit=document.createElement('div'); tit.className='excl-title'; tit.textContent='Columnas visibles'; menu.appendChild(tit);
    const bar=document.createElement('div'); bar.className='excl-barra';
    const bT=document.createElement('button'); bT.textContent='✓ Todas'; bT.onclick=()=>menu.querySelectorAll('input').forEach(cb=>{ cb.checked=true; tablaDT.column(cb.dataset.col).visible(true); });
    const bN=document.createElement('button'); bN.textContent='✗ Ninguna'; bN.onclick=()=>menu.querySelectorAll('input').forEach(cb=>{ cb.checked=false; tablaDT.column(cb.dataset.col).visible(false); });
    bar.appendChild(bT); bar.appendChild(bN); menu.appendChild(bar);
    const lista=document.createElement('div'); lista.className='excl-lista';
    tablaDT.columns().every(function(i){
      const title=$(this.header()).text().trim(); if(!title) return;
      const row=document.createElement('label'); row.className='excl-row';
      const cb=document.createElement('input'); cb.type='checkbox'; cb.dataset.col=i; cb.checked=this.visible();
      cb.addEventListener('change',()=>tablaDT.column(i).visible(cb.checked));
      const sp=document.createElement('span'); sp.textContent=title;
      row.appendChild(cb); row.appendChild(sp); lista.appendChild(row);
    });
    menu.appendChild(lista); document.body.appendChild(menu);
    const r=this.getBoundingClientRect();
    // Mantener dentro de la ventana
  requestAnimationFrame(()=>{
    const mW=menu.offsetWidth, mH=menu.offsetHeight;
    const top=(r.bottom+4+mH>window.innerHeight) ? Math.max(4,r.top-mH-4) : r.bottom+4;
    const left=(r.left+mW>window.innerWidth) ? Math.max(4,window.innerWidth-mW-8) : r.left;
    menu.style.top=top+'px'; menu.style.left=left+'px';
  });
    setTimeout(()=>document.addEventListener('click',cerrarAlFuera),10);
  });
}

// ── Actualizar gráficos ──
function actualizarGraficos(){
  const fi=document.getElementById('fechaInicio').valueAsDate;
  const ff=document.getElementById('fechaFin').valueAsDate;
  const normStr=s=>s.toString().trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();

  let datos=window.dataTabla.filter(d=>{
    if(!d.fechaJS || isNaN(d.fechaJS)) return false;
    if(!fi || !ff) return true; // sin rango = mostrar todo
    return cmpFecha(d.fechaJS,fi)>=0 && cmpFecha(d.fechaJS,ff)<=0;
  });
  for(const k in filtrosActivos){ if(filtrosActivos[k] && k!=='_DESCRIPCION_NORM') datos=datos.filter(d=>d[k] && normStr(d[k])===normStr(filtrosActivos[k])); }
  for(const k in exclusiones){ const ex=exclusiones[k]; if(ex.size) datos=datos.filter(d=>{ const v=d[k]?normStr(d[k]):''; return !ex.has(v); }); }
  // Excluir siempre registros sin vehículo
  datos=datos.filter(d=>d.VHLO && d.VHLO.toString().trim()!=="");
  // Filtro por descripción avería
  if(filtrosActivos['_DESCRIPCION_NORM']) datos=datos.filter(d=>getDescripcion(d)===filtrosActivos['_DESCRIPCION_NORM']);

  [{key:'familia',campo:'FAMILIA AVERIA'},{key:'origen',campo:'ORIGEN AVISO'},{key:'familiaVeh',campo:'FAMILIA'},{key:'vhlo',campo:'VHLO'}]
  .forEach(({key,campo})=>{
    const cnt={};
    datos.forEach(d=>{ const v=d[campo]; if(v&&v!=='****'){ const vn=normStr(v); cnt[vn]=(cnt[vn]||0)+1; } });
    const sorted=Object.entries(cnt).sort((a,b)=>b[1]-a[1]);
    const labels=sorted.map(e=>e[0]), values=sorted.map(e=>e[1]), cols=genColores(labels.length);
    const fv=filtrosActivos[campo] ? normStr(filtrosActivos[campo]) : null;
    const bg=labels.map((l,i)=>fv&&l!==fv?cols[i]+'55':cols[i]);
    const c=charts[key];
    c.data.labels=labels; c.data.datasets[0].data=values; c.data.datasets[0].backgroundColor=bg;
    c.options.plugins.legend.labels.color=getLegendColor();
    c.update();
  });

  // Ranking descripción avería
  if(charts.descripcion){
    const cntD={};
    datos.forEach(d=>{
      const v=getDescripcion(d);
      if(v&&v!=='****') cntD[v]=(cntD[v]||0)+1;
    });
    const sortedD=Object.entries(cntD).sort((a,b)=>b[1]-a[1]).slice(0,30); // top 30
    const labelsD=sortedD.map(e=>e[0]), valuesD=sortedD.map(e=>e[1]);
    const colsD=genColores(labelsD.length);
    const fvD=filtrosActivos['_DESCRIPCION_NORM'];
    charts.descripcion.data.labels=labelsD;
    charts.descripcion.data.datasets[0].data=valuesD;
    charts.descripcion.data.datasets[0].backgroundColor=labelsD.map((l,i)=>fvD&&l!==fvD?colsD[i]+'55':colsD[i]);
    charts.descripcion.options.plugins.legend.labels.color=getLegendColor();
    charts.descripcion.update();
  }

  const ctT={};
  datos.forEach(d=>{ const v=d['TURNO']; if(v&&v!=='****') ctT[v]=(ctT[v]||0)+1; });
  charts.turno.data.labels=Object.keys(ctT);
  charts.turno.data.datasets[0].data=Object.values(ctT);
  charts.turno.data.datasets[0].backgroundColor=genColores(Object.keys(ctT).length);
  charts.turno.data.datasets[0].borderColor=modoOscuro?'#1e1e2e':'#f0f4ff';
  charts.turno.update();

  const evol={};
  datos.forEach(d=>{
    const mes=`${d.fechaJS.getFullYear()}-${String(d.fechaJS.getMonth()+1).padStart(2,'0')}`;
    if(!evol[mes]) evol[mes]={};
    const fam=d['FAMILIA AVERIA'];
    if(fam&&fam!=='****') evol[mes][fam]=(evol[mes][fam]||0)+1;
  });
  const lEv=Object.keys(evol).sort();
  const fams=[...new Set(datos.map(d=>d['FAMILIA AVERIA']).filter(f=>f&&f!=='****'))];
  const cEv=genColores(fams.length);
  charts.evolucion.data.labels=lEv;
  charts.evolucion.data.datasets=fams.map((fam,i)=>({
    label:fam, data:lEv.map(l=>evol[l][fam]||0),
    borderColor:cEv[i], backgroundColor:cEv[i]+'22', fill:false, tension:0.3, pointRadius:3
  }));
  charts.evolucion.options.plugins.legend.labels.color=getLegendColor();
  charts.evolucion.update();

  const datosFiltrados=datos.filter(d=>d.VHLO && d.VHLO.toString().trim()!=="");
  tablaDT.clear(); tablaDT.rows.add(datosFiltrados); tablaDT.draw();

  // Reactivar orden aleatorio si estaba activo
  if(window._ordenAleatorio){
    tablaDT.order([]).draw(false);
    const data=tablaDT.rows({search:'applied'}).data().toArray();
    for(let i=data.length-1;i>0;i--){
      const j=Math.floor(Math.random()*(i+1));
      [data[i],data[j]]=[data[j],data[i]];
    }
    tablaDT.clear(); tablaDT.rows.add(data); tablaDT.draw(false);
  }

  document.getElementById('totalAverias').textContent=datos.length.toLocaleString('es-ES');
  const dias=new Set(datos.filter(d=>d.fechaJS).map(d=>d.fechaJS.toDateString())).size;
  document.getElementById('promedioDiario').textContent=dias?(datos.length/dias).toFixed(1):'0';
  const vc={};
  datos.forEach(d=>{ if(d.VHLO&&d.VHLO!=='****') vc[d.VHLO]=(vc[d.VHLO]||0)+1; });
  document.getElementById('vehiculoTop').textContent=Object.keys(vc).length?Object.keys(vc).reduce((a,b)=>vc[a]>vc[b]?a:b):'-';
}

// ── Helper: obtener valor de descripción normalizando el nombre del campo ──
function getDescripcion(row){
  for(const k of Object.keys(row)){
    const kn=k.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z ]/g,'').trim();
    if(kn==='DESCRIPCION AVERIA'||kn==='DESCRIPCION') return (row[k]||'').toString().trim();
  }
  return '';
}

function cmpFecha(a,b){
  return new Date(a.getFullYear(),a.getMonth(),a.getDate())-new Date(b.getFullYear(),b.getMonth(),b.getDate());
}

// ── Resize altura + anchura — handler global único ──
function iniciarResizeAltura(){
  let panel=null, dir='', startX=0, startY=0, startW=0, startH=0;

  document.querySelectorAll('.resize-handle, .resize-handle-e, .resize-handle-se').forEach(h=>{
    h.addEventListener('mousedown', e=>{
      e.preventDefault();
      e.stopPropagation();
      panel = document.getElementById(h.dataset.panel);
      startX = e.clientX; startY = e.clientY;
      startW = panel.offsetWidth; startH = panel.offsetHeight;
      dir = h.classList.contains('resize-handle-se') ? 'se'
          : h.classList.contains('resize-handle-e')  ? 'e' : 's';
      document.body.style.cursor = dir==='s'?'ns-resize':dir==='e'?'ew-resize':'nwse-resize';
      document.body.style.userSelect='none';
    });
  });

  document.addEventListener('mousemove', e=>{
    if(!panel) return;
    if(dir==='s'||dir==='se'){
      panel.style.height = Math.max(150, startH+(e.clientY-startY))+'px';
    }
    if(dir==='e'||dir==='se'){
      // Resize horizontal: ajustar flex-basis de este panel y el hermano en la misma fila
      const row = panel.closest('.chart-row');
      if(!row || panel.classList.contains('wide')) return;
      const rowW = row.getBoundingClientRect().width;
      const panels = [...row.querySelectorAll('.chart-panel')];
      if(panels.length < 2) return;
      const delta = e.clientX - startX;
      const newW = Math.min(rowW - 214, Math.max(200, startW + delta));
      const sibW = rowW - newW - 14;
      // Aplicar flex-basis para que cada panel ocupe exactamente su ancho
      panel.style.flex = `0 0 ${newW}px`;
      const sib = panels.find(p => p !== panel);
      if(sib) sib.style.flex = `0 0 ${sibW}px`;
    }
  });

  document.addEventListener('mouseup', ()=>{
    if(!panel) return;
    panel=null; dir='';
    document.body.style.cursor='';
    document.body.style.userSelect='';
  });
}
