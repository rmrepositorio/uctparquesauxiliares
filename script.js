// ═══════════════════════════════════════════════════════════════
// CONTROL TRÁFICO - PARQUE CENTRAL - script.js
// ✅ Adaptado para leer tabla: incidencias_aux
// ═══════════════════════════════════════════════════════════════

const PALETA = ['#00d4aa','#7c6fe0','#ff6b6b','#ffd166','#06d6a0','#118ab2','#ef476f','#f78c6b','#88d498','#c77dff','#48cae4','#f4a261','#e76f51','#2ec4b6','#e9c46a','#a8dadc','#457b9d','#e63946','#2a9d8f','#f3722c'];

const MAPA_TIPO_ORDEN = { 'L02': 'Accidente', 'L05': 'Golpe / Mal Uso' };
const ETIQUETA_AVERIA = 'Avería';

// ✅ CONFIGURACIÓN: Cambia aquí el nombre de la tabla si necesitas otra
const TABLA_PRINCIPAL = 'incidencias_aux';

let tablaDT = null;
let charts = {};
let datosOriginales = [];
let filtrosActivos = {};
let exclusiones = {};
let historial = [];
let historialIdx = -1;
let modoOscuro = localStorage.getItem('ct_modo') !== 'light';

// ═══════════════════════════════════════════════════════════════
// FUNCIONES AUXILIARES
// ═══════════════════════════════════════════════════════════════

function getEtiquetaTipoOrden(codigo) {
  const cod = (codigo || '').toString().trim().toUpperCase();
  if (!cod || cod === '****') return null;
  return MAPA_TIPO_ORDEN[cod] || ETIQUETA_AVERIA;
}

function getCodigosParaEtiqueta(etiqueta) {
  if (etiqueta === 'Accidente') return ['L02'];
  if (etiqueta === 'Golpe / Mal Uso') return ['L05'];
  if (etiqueta === ETIQUETA_AVERIA) return { modo: 'resto' };
  return [];
}

function getSubfamiliaTrasera(vhlo, familia) {
  if (familia && familia.toUpperCase().includes('MINICOMPACTADOR')) return 'MINICOMPACTADORES';
  const n = parseInt(vhlo);
  if (isNaN(n)) return null;
  if (n === 140 || n === 146) return 'MEDIANOS';
  if (n >= 142 && n <= 183) return '2 EJES';
  if (n >= 1170 && n <= 1172) return 'ECONIC ELECTRICOS';
  if (n >= 1173 && n <= 1179) return 'VOLVO';
  return null;
}

function getSubfamiliaLateral(vhlo) {
  const n = parseInt(vhlo);
  if (isNaN(n)) return null;
  if (n >= 1100 && n <= 1121) return 'FARID ANTIGUOS';
  if (n >= 1135 && n <= 1138) return 'FARID NUEVOS';
  if (n >= 1130 && n <= 1334) return 'OMB';
  if (n >= 3100 && n <= 3123) return 'WASTERRENT';
  if (n >= 1121 && n <= 1128) return 'AMS';
  return null;
}

function normStr(s) {
  return s ? s.toString().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase() : '';
}

function getDescripcion(row) {
  const clavesPosibles = ['DESCRIPCION AVERIA', 'DESCRIPCION', 'descripcion_averia'];
  for (const k of Object.keys(row)) {
    const kn = k.toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z ]/g, '').trim();
    if (clavesPosibles.some(c => kn === c)) {
      return (row[k] || '').toString().trim();
    }
  }
  return '';
}

function genColores(n) {
  const cols = [];
  for (let i = 0; i < n; i++) cols.push(PALETA[i % PALETA.length]);
  return cols;
}

function getLegendColor() {
  return modoOscuro ? '#e0e0e0' : '#333';
}

function parseFecha(fechaStr) {
  if (!fechaStr) return null;
  const parts = fechaStr.split('/').map(Number);
  if (parts.length === 3 && !parts.some(isNaN)) {
    return new Date(parts[2], parts[1] - 1, parts[0]);
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════
// CARGA DE DATOS DESDE SUPABASE (tabla: incidencias_aux)
// ═══════════════════════════════════════════════════════════════

async function cargarDatos() {
  try {
    let todosLosDatos = [];
    let desde = 0;
    const limite = 1000;
    
    while (true) {
      const { data, error } = await supabaseClient
        .from(TABLA_PRINCIPAL)  // ✅ USA LA VARIABLE
        .select('*')
        .range(desde, desde + limite - 1)
        .order('id', { ascending: true });
      
      if (error) throw error;
      if (!data || data.length === 0) break;
      
      todosLosDatos = todosLosDatos.concat(data);
      if (data.length < limite) break;
      desde += limite;
    }
    
    console.log(`✅ Cargados ${todosLosDatos.length} registros de ${TABLA_PRINCIPAL}`);
    
    // Normalizar datos
    datosOriginales = todosLosDatos.map(d => {
      const fechaJS = parseFecha(d.fecha_aviso);
      return {
        'FAMILIA': d.familia ? normStr(d.familia) : '',
        'VHLO': d.vhlo ? normStr(d.vhlo) : '',
        'CONDUCTOR': d.conductor || '',
        'FAMILIA AVERIA': d.familia_averia ? normStr(d.familia_averia) : '',
        'DEFICIENCIAS DETECTADAS': d.deficiencias ? normStr(d.deficiencias) : '',
        'DESCRIPCION AVERIA': d.descripcion_averia || '',
        'FOTO': d.foto || '',
        'FECHA AVISO': d.fecha_aviso || '',
        'HORA': d.hora || '',
        'TURNO': d.turno || '',
        'N AVISO': d.n_aviso || '',
        'AVISO ANTIGUO': d.aviso_antiguo || '',
        'ORIGEN AVISO': d.origen_aviso ? normStr(d.origen_aviso) : '',
        'TIPO ORDEN': d.tipo_orden ? normStr(d.tipo_orden) : '',
        'COLUMNA1': d.columna1 || '',
        'COLUMNA2': d.columna2 || '',
        'COLUMNA3': d.columna3 || '',
        'COLUMNA4': d.columna4 || '',
        fechaJS: fechaJS
      };
    }).filter(d => d['VHLO'] && d['VHLO'] !== '' && d.fechaJS && !isNaN(d.fechaJS));
    
    window.dataTabla = datosOriginales;
    
    if (!tablaDT) inicializarTabla();
    cargarEstado();
    inicializarFechas();
    crearGraficos();
    renderTags();
    actualizarGraficos();
    iniciarResizeAltura();
    
  } catch (e) {
    console.error('Error cargando datos:', e);
    alert('Error al cargar datos: ' + e.message);
  }
}

// ═══════════════════════════════════════════════════════════════
// INICIALIZAR FECHAS
// ═══════════════════════════════════════════════════════════════

function inicializarFechas() {
  const fechas = datosOriginales.filter(d => d.fechaJS && !isNaN(d.fechaJS)).map(d => d.fechaJS);
  if (!fechas.length) return;
  
  document.getElementById('fechaInicio').valueAsDate = new Date(Math.min(...fechas));
  document.getElementById('fechaFin').valueAsDate = new Date(Math.max(...fechas));
  
  document.getElementById('fechaInicio').addEventListener('change', actualizarGraficos);
  document.getElementById('fechaFin').addEventListener('change', actualizarGraficos);
}

// ═══════════════════════════════════════════════════════════════
// INICIALIZAR TABLA
// ═══════════════════════════════════════════════════════════════

function inicializarTabla() {
  tablaDT = $('#tablaAverias').DataTable({
    data: [],
    columns: [
      { title: 'Vehículo', data: 'VHLO', width: '80px' },
      { title: 'Familia Veh.', data: 'FAMILIA', width: '110px' },
      { title: 'Familia Avería', data: 'FAMILIA AVERIA', width: '130px' },
      { title: 'Descripción', data: null, width: '220px', defaultContent: '-',
        render: function(d, t, row) {
          const desc = getDescripcion(row);
          if (desc) return `<span title="${desc}" style="display:block;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${desc}</span>`;
          return '-';
        }
      },
      { title: 'Deficiencias', data: 'DEFICIENCIAS DETECTADAS', width: '180px', defaultContent: '-',
        render: function(d) {
          return d ? `<span title="${d}" style="display:block;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${d}</span>` : '-';
        }
      },
      { title: 'Fecha Aviso', data: 'FECHA AVISO', width: '90px' },
      { title: 'Turno', data: 'TURNO', width: '70px' },
      { title: 'Origen Aviso', data: 'ORIGEN AVISO', width: '110px' },
      { title: 'Tipo Orden', data: 'TIPO ORDEN', width: '90px' },
      { title: 'Conductor', data: 'CONDUCTOR', width: '100px', defaultContent: '-' },
      { 
        title: 'Nº Aviso', 
        data: null, 
        width: '110px', 
        defaultContent: '-',
        render: function(d, t, row) {
          // ✅ 1. Buscar por clave exacta mapeada
          if (row['N AVISO'] !== undefined && row['N AVISO'] !== null && row['N AVISO'] !== '') {
            return row['N AVISO'];
          }
          
          // ✅ 2. Buscar por clave de Supabase (snake_case)
          if (row.n_aviso !== undefined && row.n_aviso !== null && row.n_aviso !== '') {
            return row.n_aviso;
          }
          
          // ✅ 3. Buscar por clave con 2 espacios
          if (row['N  AVISO'] !== undefined && row['N  AVISO'] !== '') return row['N  AVISO'];
          
          // ✅ 4. Fallback: buscar por patrón flexible
          for (const k of Object.keys(row)) {
            const kNorm = k.toString()
              .toUpperCase()
              .replace(/_/g, ' ')
              .replace(/\s+/g, ' ')
              .trim();
            if (kNorm === 'N AVISO') return row[k] || '-';
          }
          
          return '-';
        }
      }
    ],
    orderCellsTop: true,
    colReorder: true,
    scrollX: true,
    pageLength: 25,
    lengthChange: true,
    order: [[5, 'desc']],
    dom: '<"top"lf>rt<"bottom"ip><"clear">',
    language: {
      search: 'Buscar:',
      lengthMenu: 'Mostrar _MENU_ registros',
      info: 'Mostrando _START_ – _END_ de _TOTAL_ registros',
      infoEmpty: 'Mostrando 0 – 0 de 0 registros',
      infoFiltered: '(filtrado de _MAX_ registros totales)',
      zeroRecords: 'No se encontraron resultados',
      emptyTable: 'No hay datos disponibles en la tabla',
      paginate: { previous: '‹ Ant', next: 'Sig ›' },
      loadingRecords: 'Cargando...',
      processing: 'Procesando...'
    },
    lengthMenu: [[10, 25, 50, 100, 200, -1], [10, 25, 50, 100, 200, "Todos"]],
    drawCallback: function() {
      setTimeout(crearInputPaginaManual, 100);
    }
  });
}

// ═══════════════════════════════════════════════════════════════
// INPUT DE PÁGINA MANUAL
// ═══════════════════════════════════════════════════════════════

function crearInputPaginaManual() {
  const paginacion = document.querySelector('#tablaAverias_paginate');
  if (!paginacion) return;
  
  const existingWrap = document.getElementById('paginaManualWrap');
  if (existingWrap) existingWrap.remove();
  
  const wrap = document.createElement('span');
  wrap.id = 'paginaManualWrap';
  wrap.className = 'pagina-manual';
  
  const total = tablaDT.page.info().pages;
  const pagActual = tablaDT.page.info().page + 1;
  
  wrap.innerHTML = `<span>Ir a:</span><input type="number" id="inputPagina" min="1" max="${total}" value="${pagActual}"><button id="btnIrPagina">Ir</button><span class="total-pag">de <strong id="totalPaginas">${total}</strong></span>`;
  
  paginacion.appendChild(wrap);
  
  const input = document.getElementById('inputPagina');
  const btn = document.getElementById('btnIrPagina');
  
  function irAPagina() {
    let num = parseInt(input.value);
    const totalPages = tablaDT.page.info().pages;
    
    if (isNaN(num) || num < 1) {
      input.value = 1;
      tablaDT.page(0).draw(false);
      return;
    }
    if (num > totalPages) {
      input.value = totalPages;
      tablaDT.page(totalPages - 1).draw(false);
      return;
    }
    
    tablaDT.page(num - 1).draw(false);
    setTimeout(() => {
      input.focus();
      input.select();
    }, 100);
  }
  
  input.addEventListener('focus', () => input.select());
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      irAPagina();
    }
  });
  btn.addEventListener('click', e => {
    e.preventDefault();
    irAPagina();
  });
}

$('#tablaAverias').on('draw.dt', function() {
  setTimeout(crearInputPaginaManual, 100);
});

setTimeout(crearInputPaginaManual, 500);

// ═══════════════════════════════════════════════════════════════
// CREAR GRÁFICOS
// ═══════════════════════════════════════════════════════════════

function crearGraficos() {
  const ctxFamilia = document.getElementById('chartFamilia')?.getContext('2d');
  const ctxVehiculo = document.getElementById('chartVehiculo')?.getContext('2d');
  const ctxEvolucion = document.getElementById('chartEvolucion')?.getContext('2d');
  const ctxDescripcion = document.getElementById('chartDescripcion')?.getContext('2d');
  const ctxCargaLateral = document.getElementById('chartCargaLateral')?.getContext('2d');
  const ctxCargaTrasera = document.getElementById('chartCargaTrasera')?.getContext('2d');
  
  if (ctxFamilia) {
    charts.familia = new Chart(ctxFamilia, {
      type: 'doughnut',
      data: { labels: [], datasets: [{ data: [], backgroundColor: [] }] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'right', labels: { color: getLegendColor(), font: { size: 11 } } }
        }
      }
    });
  }
  
  if (ctxVehiculo) {
    charts.vehiculo = new Chart(ctxVehiculo, {
      type: 'bar',
      data: { labels: [], datasets: [{ data: [], backgroundColor: '#00d4aa' }] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: getLegendColor(), font: { size: 10 } }, grid: { color: modoOscuro ? '#333' : '#e0e0e0' } },
          y: { ticks: { color: getLegendColor() }, grid: { color: modoOscuro ? '#333' : '#e0e0e0' } }
        }
      }
    });
  }
  
  if (ctxEvolucion) {
    charts.evolucion = new Chart(ctxEvolucion, {
      type: 'line',
      data: { labels: [], datasets: [] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top', labels: { color: getLegendColor(), font: { size: 10 } } }
        },
        scales: {
          x: { ticks: { color: getLegendColor(), font: { size: 10 } }, grid: { color: modoOscuro ? '#333' : '#e0e0e0' } },
          y: { ticks: { color: getLegendColor() }, grid: { color: modoOscuro ? '#333' : '#e0e0e0' } }
        }
      }
    });
  }
  
  if (ctxDescripcion) {
    charts.descripcion = new Chart(ctxDescripcion, {
      type: 'bar',
      data: { labels: [], datasets: [{ data: [], backgroundColor: '#7c6fe0' }] },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: getLegendColor() }, grid: { color: modoOscuro ? '#333' : '#e0e0e0' } },
          y: { ticks: { color: getLegendColor(), font: { size: 10 } }, grid: { color: modoOscuro ? '#333' : '#e0e0e0' } }
        }
      }
    });
  }
  
  if (ctxCargaLateral) {
    charts.cargaLateral = new Chart(ctxCargaLateral, {
      type: 'bar',
      data: { labels: [], datasets: [{ data: [], backgroundColor: [], borderColor: modoOscuro ? '#0f0f1a' : '#f0f4ff', borderWidth: 1 }] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: getLegendColor(), font: { size: 10 } }, grid: { color: modoOscuro ? '#333' : '#e0e0e0' } },
          y: { ticks: { color: getLegendColor() }, grid: { color: modoOscuro ? '#333' : '#e0e0e0' } }
        }
      }
    });
  }
  
  if (ctxCargaTrasera) {
    charts.cargaTrasera = new Chart(ctxCargaTrasera, {
      type: 'bar',
      data: { labels: [], datasets: [{ data: [], backgroundColor: [], borderColor: modoOscuro ? '#0f0f1a' : '#f0f4ff', borderWidth: 1 }] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: getLegendColor(), font: { size: 10 } }, grid: { color: modoOscuro ? '#333' : '#e0e0e0' } },
          y: { ticks: { color: getLegendColor() }, grid: { color: modoOscuro ? '#333' : '#e0e0e0' } }
        }
      }
    });
  }
}

// ═══════════════════════════════════════════════════════════════
// ACTUALIZAR GRÁFICOS
// ═══════════════════════════════════════════════════════════════

function actualizarGraficos() {
  const fi = document.getElementById('fechaInicio').valueAsDate;
  const ff = document.getElementById('fechaFin').valueAsDate;
  
  let datos = datosOriginales.filter(d => {
    if (!d.fechaJS || isNaN(d.fechaJS)) return false;
    if (!fi || !ff) return true;
    const dDate = new Date(d.fechaJS.getFullYear(), d.fechaJS.getMonth(), d.fechaJS.getDate());
    const fiDate = new Date(fi.getFullYear(), fi.getMonth(), fi.getDate());
    const ffDate = new Date(ff.getFullYear(), ff.getMonth(), ff.getDate());
    return dDate >= fiDate && dDate <= ffDate;
  });
  
  // Aplicar exclusiones
  for (const campo in exclusiones) {
    if (exclusiones[campo].size) {
      datos = datos.filter(d => !exclusiones[campo].has((d[campo] || '').toString().trim().toUpperCase()));
    }
  }
  
  // Aplicar filtros activos
  const camposDirectos = ['FAMILIA AVERIA', 'FAMILIA', 'ORIGEN AVISO', 'TURNO', 'VHLO', 'TIPO ORDEN', 'CONDUCTOR', 'DEFICIENCIAS DETECTADAS'];
  for (const k in filtrosActivos) {
    if (!filtrosActivos[k]) continue;
    if (k.startsWith('_')) continue;
    if (!camposDirectos.includes(k)) continue;
    datos = datos.filter(d => d[k] && d[k].toString().trim().toUpperCase() === filtrosActivos[k].toString().trim().toUpperCase());
  }
  
  // Filtro de tipo orden por etiqueta
  if (filtrosActivos['_TIPO_ORDEN_LABEL']) {
    const etiqueta = filtrosActivos['_TIPO_ORDEN_LABEL'];
    const mapping = getCodigosParaEtiqueta(etiqueta);
    if (mapping && mapping.modo === 'resto') {
      datos = datos.filter(d => {
        const cod = (d['TIPO ORDEN'] || '').toString().trim().toUpperCase();
        return cod && cod !== 'L02' && cod !== 'L05' && cod !== '****';
      });
    } else if (Array.isArray(mapping) && mapping.length) {
      datos = datos.filter(d => mapping.includes((d['TIPO ORDEN'] || '').toString().trim().toUpperCase()));
    }
  }
  
  // Filtro de recurrencia
  if (filtrosActivos['_REINCIDENCIA']) {
    const tipo = filtrosActivos['_REINCIDENCIA'];
    const vhCountBase = {};
    datos.forEach(d => {
      const v = d['VHLO'];
      if (!v || v === '****') return;
      vhCountBase[v] = (vhCountBase[v] || 0) + 1;
    });
    if (tipo === 'unicos') {
      const unicosSet = new Set(Object.entries(vhCountBase).filter(([_, n]) => n === 1).map(([v, _]) => v));
      datos = datos.filter(d => unicosSet.has(d['VHLO']));
    } else if (tipo === 'reincidentes') {
      const reincidentesSet = new Set(Object.entries(vhCountBase).filter(([_, n]) => n >= 2).map(([v, _]) => v));
      datos = datos.filter(d => reincidentesSet.has(d['VHLO']));
    }
  }
  
  // Filtro de subfamilia trasera
  if (filtrosActivos['_SUBFAMILIA_TRASERA']) {
    const subFam = filtrosActivos['_SUBFAMILIA_TRASERA'];
    datos = datos.filter(d => getSubfamiliaTrasera(d['VHLO'], d['FAMILIA']) === subFam);
  }
  
  // Filtro de subfamilia lateral
  if (filtrosActivos['_SUBFAMILIA_LATERAL']) {
    const subFam = filtrosActivos['_SUBFAMILIA_LATERAL'];
    datos = datos.filter(d => getSubfamiliaLateral(d['VHLO']) === subFam);
  }
  
  // Actualizar tabla
  if (tablaDT) {
    tablaDT.clear();
    tablaDT.rows.add(datos);
    tablaDT.draw();
  }
  
  // Actualizar estadísticas
  document.getElementById('totalAverias').textContent = datos.length.toLocaleString('es-ES');
  const dias = new Set(datos.filter(d => d.fechaJS).map(d => d.fechaJS.toDateString())).size;
  document.getElementById('promedioDiario').textContent = dias ? (datos.length / dias).toFixed(1) : '0';
  
  const vc = {};
  datos.forEach(d => { if (d['VHLO'] && d['VHLO'] !== '***') vc[d['VHLO']] = (vc[d['VHLO']] || 0) + 1; });
  document.getElementById('vehiculoTop').textContent = Object.keys(vc).length ? Object.keys(vc).reduce((a, b) => vc[a] > vc[b] ? a : b) : '-';
  
  // Gráfico Familia Avería
  if (charts.familia) {
    const cntF = {};
    datos.forEach(d => { const v = d['FAMILIA AVERIA']; if (v && v !== '****') cntF[v] = (cntF[v] || 0) + 1; });
    const sorted = Object.entries(cntF).sort((a, b) => b[1] - a[1]);
    const labels = sorted.map(e => e[0]);
    const values = sorted.map(e => e[1]);
    const cols = genColores(labels.length);
    
    charts.familia.data.labels = labels;
    charts.familia.data.datasets[0].data = values;
    charts.familia.data.datasets[0].backgroundColor = cols;
    charts.familia.options.plugins.legend.labels.color = getLegendColor();
    charts.familia.update();
  }
  
  // Gráfico Vehículo
  if (charts.vehiculo) {
    const cntV = {};
    datos.forEach(d => { const v = d['VHLO']; if (v && v !== '****') cntV[v] = (cntV[v] || 0) + 1; });
    const sorted = Object.entries(cntV).sort((a, b) => b[1] - a[1]).slice(0, 20);
    const labels = sorted.map(e => e[0]);
    const values = sorted.map(e => e[1]);
    
    charts.vehiculo.data.labels = labels;
    charts.vehiculo.data.datasets[0].data = values;
    charts.vehiculo.data.datasets[0].backgroundColor = '#00d4aa';
    charts.vehiculo.options.scales.x.ticks.color = getLegendColor();
    charts.vehiculo.options.scales.y.ticks.color = getLegendColor();
    charts.vehiculo.update();
  }
  
  // Gráfico Evolución
  if (charts.evolucion) {
    const evol = {};
    datos.forEach(d => {
      const mes = `${d.fechaJS.getFullYear()}-${String(d.fechaJS.getMonth() + 1).padStart(2, '0')}`;
      if (!evol[mes]) evol[mes] = {};
      const fam = d['FAMILIA AVERIA'];
      if (fam && fam !== '') evol[mes][fam] = (evol[mes][fam] || 0) + 1;
    });
    const lEv = Object.keys(evol).sort();
    const fams = [...new Set(datos.map(d => d['FAMILIA AVERIA']).filter(f => f && f !== ''))];
    const cEv = genColores(fams.length);
    
    charts.evolucion.data.labels = lEv;
    charts.evolucion.data.datasets = fams.map((fam, i) => ({
      label: fam,
      data: lEv.map(l => evol[l][fam] || 0),
      borderColor: cEv[i],
      backgroundColor: cEv[i] + '22',
      fill: true,
      tension: 0.3
    }));
    charts.evolucion.options.plugins.legend.labels.color = getLegendColor();
    charts.evolucion.options.scales.x.ticks.color = getLegendColor();
    charts.evolucion.options.scales.y.ticks.color = getLegendColor();
    charts.evolucion.update();
  }
  
  // Gráfico Descripción
  if (charts.descripcion) {
    const cntD = {};
    datos.forEach(d => { const v = getDescripcion(d); if (v && v !== '****') cntD[v] = (cntD[v] || 0) + 1; });
    const sortedD = Object.entries(cntD).sort((a, b) => b[1] - a[1]).slice(0, 30);
    const labelsD = sortedD.map(e => e[0]);
    const valuesD = sortedD.map(e => e[1]);
    
    charts.descripcion.data.labels = labelsD;
    charts.descripcion.data.datasets[0].data = valuesD;
    charts.descripcion.data.datasets[0].backgroundColor = '#7c6fe0';
    charts.descripcion.options.scales.x.ticks.color = getLegendColor();
    charts.descripcion.options.scales.y.ticks.color = getLegendColor();
    charts.descripcion.update();
  }
  
  // Gráficos de carga lateral y trasera
  const datosLateral = datos.filter(d => d['FAMILIA'] && d['FAMILIA'].toUpperCase().includes('CARGA LATERAL'));
  const datosTrasera = datos.filter(d => d['FAMILIA'] && d['FAMILIA'].toUpperCase().includes('CARGA TRASERA'));
  
  if (charts.cargaLateral && datosLateral.length) {
    const cntL = {};
    const vhlosL = {};
    datosLateral.forEach(d => {
      const sub = getSubfamiliaLateral(d['VHLO']);
      if (sub) {
        cntL[sub] = (cntL[sub] || 0) + 1;
        if (!vhlosL[sub]) vhlosL[sub] = new Set();
        vhlosL[sub].add(d['VHLO']);
      }
    });
    const labL = Object.keys(cntL).sort();
    const colL = genColores(labL.length);
    
    charts.cargaLateral.data.labels = labL;
    charts.cargaLateral.data.datasets[0].data = labL.map(sub => cntL[sub]);
    charts.cargaLateral.data.datasets[0].backgroundColor = colL;
    charts.cargaLateral.data.datasets[0].borderColor = modoOscuro ? '#0f0f1a' : '#f0f4ff';
    charts.cargaLateral.update();
  }
  
  if (charts.cargaTrasera && datosTrasera.length) {
    const cntT = {};
    const vhlosT = {};
    datosTrasera.forEach(d => {
      const sub = getSubfamiliaTrasera(d['VHLO'], d['FAMILIA']);
      if (sub) {
        cntT[sub] = (cntT[sub] || 0) + 1;
        if (!vhlosT[sub]) vhlosT[sub] = new Set();
        vhlosT[sub].add(d['VHLO']);
      }
    });
    const labT = Object.keys(cntT).sort();
    const colT = genColores(labT.length);
    
    charts.cargaTrasera.data.labels = labT;
    charts.cargaTrasera.data.datasets[0].data = labT.map(sub => cntT[sub]);
    charts.cargaTrasera.data.datasets[0].backgroundColor = colT;
    charts.cargaTrasera.data.datasets[0].borderColor = modoOscuro ? '#0f0f1a' : '#f0f4ff';
    charts.cargaTrasera.update();
  }
}

// ═══════════════════════════════════════════════════════════════
// MENÚS DE FILTROS
// ═══════════════════════════════════════════════════════════════

document.querySelectorAll('.btn-filtro[data-campo]').forEach(btn => {
  btn.addEventListener('click', function(e) {
    e.stopPropagation();
    const campo = this.dataset.campo;
    abrirMenuFiltro(campo, this);
  });
});

document.querySelectorAll('.btn-filtro[data-campo-especial]').forEach(btn => {
  btn.addEventListener('click', function(e) {
    e.stopPropagation();
    const especial = this.dataset.campoEspecial;
    if (especial === 'recurrencia') abrirMenuRecurrencia(this);
    else if (especial === 'subfamilia_trasera') abrirMenuSubfamiliaTrasera(this);
    else if (especial === 'subfamilia_lateral') abrirMenuSubfamiliaLateral(this);
  });
});

function abrirMenuFiltro(campo, anchorEl) {
  cerrarMenus();
  const valores = [...new Set(window.dataTabla.map(d => (d[campo] || '').toString().trim().toUpperCase()).filter(v => v && v !== '' && v !== '****'))].sort();
  
  const menu = document.createElement('div');
  menu.id = 'menuExcl';
  menu.className = 'excl-menu';
  
  const tit = document.createElement('div');
  tit.className = 'excl-title';
  tit.textContent = 'Filtrar: ' + campo.replace('_', ' ');
  menu.appendChild(tit);
  
  const bar = document.createElement('div');
  bar.className = 'excl-barra';
  const bT = document.createElement('button');
  bT.textContent = '✓ Todas';
  bT.onclick = () => menu.querySelectorAll('input').forEach(cb => cb.checked = true);
  const bN = document.createElement('button');
  bN.textContent = '✗ Ninguna';
  bN.onclick = () => menu.querySelectorAll('input').forEach(cb => cb.checked = false);
  bar.appendChild(bT);
  bar.appendChild(bN);
  menu.appendChild(bar);
  
  const lista = document.createElement('div');
  lista.className = 'excl-lista';
  const excAct = exclusiones[campo] || new Set();
  
  valores.forEach(val => {
    const row = document.createElement('label');
    row.className = 'excl-row';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.value = val;
    cb.checked = !excAct.has(val);
    const sp = document.createElement('span');
    sp.textContent = val;
    row.appendChild(cb);
    row.appendChild(sp);
    lista.appendChild(row);
  });
  
  menu.appendChild(lista);
  
  const btn = document.createElement('button');
  btn.className = 'excl-aplicar';
  btn.textContent = 'Aplicar';
  btn.onclick = () => {
    const ex = new Set();
    menu.querySelectorAll('input').forEach(cb => { if (!cb.checked) ex.add(cb.value); });
    exclusiones[campo] = ex;
    pushHistorial();
    renderTags();
    actualizarGraficos();
    cerrarMenus();
  };
  menu.appendChild(btn);
  
  document.body.appendChild(menu);
  
  const r = anchorEl.getBoundingClientRect();
  requestAnimationFrame(() => {
    const mW = menu.offsetWidth, mH = menu.offsetHeight;
    const top = (r.bottom + 4 + mH > window.innerHeight) ? Math.max(4, r.top - mH - 4) : r.bottom + 4;
    const left = (r.left + mW > window.innerWidth) ? Math.max(4, window.innerWidth - mW - 8) : r.left;
    menu.style.top = top + 'px';
    menu.style.left = left + 'px';
  });
  
  setTimeout(() => document.addEventListener('click', cerrarAlFuera), 10);
}

function abrirMenuRecurrencia(anchorEl) {
  cerrarMenus();
  const menu = document.createElement('div');
  menu.id = 'menuExcl';
  menu.className = 'excl-menu';
  
  const tit = document.createElement('div');
  tit.className = 'excl-title';
  tit.textContent = 'Filtrar por Recurrencia';
  menu.appendChild(tit);
  
  const lista = document.createElement('div');
  lista.className = 'excl-lista';
  const opciones = [
    { valor: '', texto: '🔄 Todos (sin filtro)' },
    { valor: 'unicos', texto: '✅ Únicos (1 avería)' },
    { valor: 'reincidentes', texto: '⚠️ Reincidentes (≥2 averías)' }
  ];
  
  opciones.forEach(op => {
    const row = document.createElement('label');
    row.className = 'excl-row';
    const rb = document.createElement('input');
    rb.type = 'radio';
    rb.name = 'recurrencia';
    rb.value = op.valor;
    rb.checked = (filtrosActivos['_REINCIDENCIA'] || '') === op.valor;
    const sp = document.createElement('span');
    sp.textContent = op.texto;
    row.appendChild(rb);
    row.appendChild(sp);
    lista.appendChild(row);
  });
  
  menu.appendChild(lista);
  
  const btn = document.createElement('button');
  btn.className = 'excl-aplicar';
  btn.textContent = 'Aplicar';
  btn.onclick = () => {
    const selected = menu.querySelector('input[name="recurrencia"]:checked');
    if (selected && selected.value) filtrosActivos['_REINCIDENCIA'] = selected.value;
    else delete filtrosActivos['_REINCIDENCIA'];
    pushHistorial();
    renderTags();
    actualizarGraficos();
    cerrarMenus();
  };
  menu.appendChild(btn);
  
  document.body.appendChild(menu);
  posicionarMenu(menu, anchorEl);
  setTimeout(() => document.addEventListener('click', cerrarAlFuera), 10);
}

function abrirMenuSubfamiliaTrasera(anchorEl) {
  cerrarMenus();
  const subfamilias = [...new Set(window.dataTabla.map(d => getSubfamiliaTrasera(d['VHLO'], d['FAMILIA'])).filter(s => s))].sort();
  
  const menu = document.createElement('div');
  menu.id = 'menuExcl';
  menu.className = 'excl-menu';
  
  const tit = document.createElement('div');
  tit.className = 'excl-title';
  tit.textContent = 'Filtrar: Subfamilia Trasera';
  menu.appendChild(tit);
  
  const lista = document.createElement('div');
  lista.className = 'excl-lista';
  
  const rowAll = document.createElement('label');
  rowAll.className = 'excl-row';
  const rbAll = document.createElement('input');
  rbAll.type = 'radio';
  rbAll.name = 'subf_trasera';
  rbAll.value = '';
  rbAll.checked = !filtrosActivos['_SUBFAMILIA_TRASERA'];
  const spAll = document.createElement('span');
  spAll.textContent = '🔄 Todas';
  rowAll.appendChild(rbAll);
  rowAll.appendChild(spAll);
  lista.appendChild(rowAll);
  
  subfamilias.forEach(sub => {
    const row = document.createElement('label');
    row.className = 'excl-row';
    const rb = document.createElement('input');
    rb.type = 'radio';
    rb.name = 'subf_trasera';
    rb.value = sub;
    rb.checked = filtrosActivos['_SUBFAMILIA_TRASERA'] === sub;
    const sp = document.createElement('span');
    sp.textContent = sub;
    row.appendChild(rb);
    row.appendChild(sp);
    lista.appendChild(row);
  });
  
  menu.appendChild(lista);
  
  const btn = document.createElement('button');
  btn.className = 'excl-aplicar';
  btn.textContent = 'Aplicar';
  btn.onclick = () => {
    const selected = menu.querySelector('input[name="subf_trasera"]:checked');
    if (selected && selected.value) filtrosActivos['_SUBFAMILIA_TRASERA'] = selected.value;
    else delete filtrosActivos['_SUBFAMILIA_TRASERA'];
    pushHistorial();
    renderTags();
    actualizarGraficos();
    cerrarMenus();
  };
  menu.appendChild(btn);
  
  document.body.appendChild(menu);
  posicionarMenu(menu, anchorEl);
  setTimeout(() => document.addEventListener('click', cerrarAlFuera), 10);
}

function abrirMenuSubfamiliaLateral(anchorEl) {
  cerrarMenus();
  const subfamilias = [...new Set(window.dataTabla.map(d => getSubfamiliaLateral(d['VHLO'])).filter(s => s))].sort();
  
  const menu = document.createElement('div');
  menu.id = 'menuExcl';
  menu.className = 'excl-menu';
  
  const tit = document.createElement('div');
  tit.className = 'excl-title';
  tit.textContent = 'Filtrar: Subfamilia Lateral';
  menu.appendChild(tit);
  
  const lista = document.createElement('div');
  lista.className = 'excl-lista';
  
  const rowAll = document.createElement('label');
  rowAll.className = 'excl-row';
  const rbAll = document.createElement('input');
  rbAll.type = 'radio';
  rbAll.name = 'subf_lateral';
  rbAll.value = '';
  rbAll.checked = !filtrosActivos['_SUBFAMILIA_LATERAL'];
  const spAll = document.createElement('span');
  spAll.textContent = '🔄 Todas';
  rowAll.appendChild(rbAll);
  rowAll.appendChild(spAll);
  lista.appendChild(rowAll);
  
  subfamilias.forEach(sub => {
    const row = document.createElement('label');
    row.className = 'excl-row';
    const rb = document.createElement('input');
    rb.type = 'radio';
    rb.name = 'subf_lateral';
    rb.value = sub;
    rb.checked = filtrosActivos['_SUBFAMILIA_LATERAL'] === sub;
    const sp = document.createElement('span');
    sp.textContent = sub;
    row.appendChild(rb);
    row.appendChild(sp);
    lista.appendChild(row);
  });
  
  menu.appendChild(lista);
  
  const btn = document.createElement('button');
  btn.className = 'excl-aplicar';
  btn.textContent = 'Aplicar';
  btn.onclick = () => {
    const selected = menu.querySelector('input[name="subf_lateral"]:checked');
    if (selected && selected.value) filtrosActivos['_SUBFAMILIA_LATERAL'] = selected.value;
    else delete filtrosActivos['_SUBFAMILIA_LATERAL'];
    pushHistorial();
    renderTags();
    actualizarGraficos();
    cerrarMenus();
  };
  menu.appendChild(btn);
  
  document.body.appendChild(menu);
  posicionarMenu(menu, anchorEl);
  setTimeout(() => document.addEventListener('click', cerrarAlFuera), 10);
}

function posicionarMenu(menu, anchorEl) {
  const r = anchorEl.getBoundingClientRect();
  requestAnimationFrame(() => {
    const mW = menu.offsetWidth, mH = menu.offsetHeight;
    const top = (r.bottom + 4 + mH > window.innerHeight) ? Math.max(4, r.top - mH - 4) : r.bottom + 4;
    const left = (r.left + mW > window.innerWidth) ? Math.max(4, window.innerWidth - mW - 8) : r.left;
    menu.style.top = top + 'px';
    menu.style.left = left + 'px';
  });
}

function cerrarMenus() {
  const m = document.getElementById('menuExcl');
  if (m) m.remove();
}

function cerrarAlFuera(e) {
  const m = document.getElementById('menuExcl');
  if (m && !m.contains(e.target)) m.remove();
  document.removeEventListener('click', cerrarAlFuera);
}

// ═══════════════════════════════════════════════════════════════
// TAGS DE FILTROS ACTIVOS
// ═══════════════════════════════════════════════════════════════

function renderTags() {
  const cont = document.getElementById('filtrosActivos');
  cont.innerHTML = '';
  
  const etiquetasEspeciales = {
    '_TIPO_ORDEN_LABEL': 'Tipo Orden',
    '_REINCIDENCIA': 'Recurrencia',
    '_SUBFAMILIA_TRASERA': 'Subfamilia Trasera',
    '_SUBFAMILIA_LATERAL': 'Subfamilia Lateral'
  };
  
  Object.entries(filtrosActivos).forEach(([k, v]) => {
    if (!v) return;
    const t = document.createElement('span');
    t.className = 'filtro-tag';
    const nombre = etiquetasEspeciales[k] || k.replace('_', ' ');
    t.textContent = `${nombre}: ${v} ✕`;
    t.onclick = () => {
      delete filtrosActivos[k];
      pushHistorial();
      renderTags();
      actualizarGraficos();
    };
    cont.appendChild(t);
  });
  
  Object.entries(exclusiones).forEach(([campo, set]) => {
    if (!set.size) return;
    const t = document.createElement('span');
    t.className = 'filtro-tag filtro-excluido';
    t.textContent = `Excluidos ${campo.replace('_', ' ')}: ${set.size} ✕`;
    t.title = [...set].join(', ');
    t.onclick = () => {
      exclusiones[campo] = new Set();
      pushHistorial();
      renderTags();
      actualizarGraficos();
    };
    cont.appendChild(t);
  });
}

// ═══════════════════════════════════════════════════════════════
// HISTORIAL ATRÁS/ADELANTE
// ═══════════════════════════════════════════════════════════════

function pushHistorial() {
  historial = historial.slice(0, historialIdx + 1);
  historial.push({
    filtrosActivos: JSON.parse(JSON.stringify(filtrosActivos)),
    exclusiones: Object.fromEntries(Object.entries(exclusiones).map(([k, v]) => [k, [...v]]))
  });
  historialIdx = historial.length - 1;
  actualizarBotones();
}

function actualizarBotones() {
  document.getElementById('btnAtras').disabled = historialIdx <= 0;
  document.getElementById('btnAdelante').disabled = historialIdx >= historial.length - 1;
}

document.getElementById('btnAtras').addEventListener('click', () => {
  if (historialIdx > 0) {
    historialIdx--;
    const estado = historial[historialIdx];
    filtrosActivos = JSON.parse(JSON.stringify(estado.filtrosActivos));
    exclusiones = {};
    for (const k in estado.exclusiones) exclusiones[k] = new Set(estado.exclusiones[k]);
    renderTags();
    actualizarGraficos();
    actualizarBotones();
  }
});

document.getElementById('btnAdelante').addEventListener('click', () => {
  if (historialIdx < historial.length - 1) {
    historialIdx++;
    const estado = historial[historialIdx];
    filtrosActivos = JSON.parse(JSON.stringify(estado.filtrosActivos));
    exclusiones = {};
    for (const k in estado.exclusiones) exclusiones[k] = new Set(estado.exclusiones[k]);
    renderTags();
    actualizarGraficos();
    actualizarBotones();
  }
});

// ═══════════════════════════════════════════════════════════════
// CONTROLES
// ═══════════════════════════════════════════════════════════════

document.getElementById('btnLimpiar').addEventListener('click', () => {
  filtrosActivos = {};
  exclusiones = {};
  pushHistorial();
  renderTags();
  actualizarGraficos();
});

document.getElementById('btnAleatorio').addEventListener('click', () => {
  window._ordenAleatorio = true;
  actualizarGraficos();
});

document.getElementById('btnResetOrden').addEventListener('click', () => {
  window._ordenAleatorio = false;
  actualizarGraficos();
});

// ═══════════════════════════════════════════════════════════════
// MODO CLARO/OSCURO
// ═══════════════════════════════════════════════════════════════

document.getElementById('toggleModo').addEventListener('click', () => {
  modoOscuro = !modoOscuro;
  document.body.classList.toggle('light-mode', !modoOscuro);
  document.getElementById('toggleModo').textContent = modoOscuro ? '☀ Modo claro' : '🌙 Modo oscuro';
  localStorage.setItem('ct_modo', modoOscuro ? 'dark' : 'light');
  
  Object.values(charts).forEach(c => {
    if (c) {
      if (c.options.plugins.legend) c.options.plugins.legend.labels.color = getLegendColor();
      if (c.options.scales) {
        if (c.options.scales.x) c.options.scales.x.ticks.color = getLegendColor();
        if (c.options.scales.y) c.options.scales.y.ticks.color = getLegendColor();
      }
      c.update();
    }
  });
});

document.getElementById('toggleModo').textContent = modoOscuro ? '☀ Modo claro' : '🌙 Modo oscuro';

// ═══════════════════════════════════════════════════════════════
// CARGAR ESTADO GUARDADO
// ═══════════════════════════════════════════════════════════════

function cargarEstado() {
  const estado = localStorage.getItem('ct_estado');
  if (estado) {
    try {
      const parsed = JSON.parse(estado);
      if (parsed.filtrosActivos) filtrosActivos = parsed.filtrosActivos;
      if (parsed.exclusiones) {
        exclusiones = {};
        for (const k in parsed.exclusiones) exclusiones[k] = new Set(parsed.exclusiones[k]);
      }
    } catch (e) {}
  }
}

function guardarEstado() {
  localStorage.setItem('ct_estado', JSON.stringify({ filtrosActivos, exclusiones }));
}

// ═══════════════════════════════════════════════════════════════
// RESIZE ALTURA GRÁFICOS
// ═══════════════════════════════════════════════════════════════

function iniciarResizeAltura() {
  const observer = new ResizeObserver(() => {
    Object.values(charts).forEach(c => { if (c) c.resize(); });
  });
  
  document.querySelectorAll('.chart-container').forEach(el => observer.observe(el));
}

// ═══════════════════════════════════════════════════════════════
// INICIALIZACIÓN
// ═══════════════════════════════════════════════════════════════

pushHistorial();
cargarDatos();