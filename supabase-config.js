// ═══════════════════════════════════════════════════════════════
// CONFIGURACIÓN SUPABASE - PARQUE CENTRAL
// ═══════════════════════════════════════════════════════════════

// ⚠️ SUSTITUYE ESTOS VALORES POR LOS TUYOS DE SUPABASE
const SUPABASE_URL = 'https://stzatnubgykvdwjfegfd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN0emF0bnViZ3lrdmR3amZlZ2ZkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkwMTI3NDksImV4cCI6MjEwNDU4ODc0OX0.sHUA7c9oZDCPUpSXOKiRgh4O3NeqXAO9GgXNPnzbggs';

// ✅ CAMBIA AQUÍ EL NOMBRE DE LA TABLA (una sola línea para cambiar todo)
const TABLA_PRINCIPAL = 'incidencias_aux';

// Inicializar cliente de Supabase
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ═══════════════════════════════════════════════════════════════
// ✅ OBTENER TODAS LAS INCIDENCIAS (con paginación para +1000)
// ═══════════════════════════════════════════════════════════════
async function obtenerIncidencias() {
  let todosLosDatos = [];
  let desde = 0;
  const limite = 1000; // Supabase devuelve máximo 1000 por consulta
  
  while (true) {
    const { data, error } = await supabaseClient
      .from(TABLA_PRINCIPAL)
      .select('*')
      .range(desde, desde + limite - 1);
    
    if (error) {
      console.error('Error al obtener datos:', error);
      throw error;
    }
    
    if (!data || data.length === 0) break;
    
    todosLosDatos = todosLosDatos.concat(data);
    
    // Si recibimos menos de 1000, ya no hay más datos
    if (data.length < limite) break;
    
    desde += limite;
  }
  
  return todosLosDatos;
}

// Actualizar una incidencia
async function actualizarIncidencia(id, cambios) {
  const { data, error } = await supabaseClient
    .from(TABLA_PRINCIPAL)
    .update(cambios)
    .eq('id', id);
  
  if (error) {
    console.error('Error al actualizar:', error);
    throw error;
  }
  return data;
}

// Insertar nuevas incidencias
async function insertarIncidencias(datos) {
  const { data, error } = await supabaseClient
    .from(TABLA_PRINCIPAL)
    .insert(datos);
  
  if (error) {
    console.error('Error al insertar:', error);
    throw error;
  }
  return data;
}

// Eliminar una incidencia
async function eliminarIncidencia(id) {
  const { error } = await supabaseClient
    .from(TABLA_PRINCIPAL)
    .delete()
    .eq('id', id);
  
  if (error) {
    console.error('Error al eliminar:', error);
    throw error;
  }
  return true;
}