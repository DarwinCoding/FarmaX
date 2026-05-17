// ============================================================
// app.js - Lógica principal del frontend
// ============================================================
// Este archivo se comunica con la API del backend
// y actualiza la interfaz según las acciones del usuario.
//
// SECCIONES:
//   1. Configuración y variables globales
//   2. Funciones de la API (fetch al backend)
//   3. Renderizado de la tabla
//   4. Sistema de alertas
//   5. Formulario (agregar / editar)
//   6. Modal de confirmación
//   7. Toast de notificaciones
//   8. Buscador
//   9. Inicialización
// ============================================================

// ──────────────────────────────────────────────
// 1. CONFIGURACIÓN Y VARIABLES GLOBALES
// ──────────────────────────────────────────────

// URL base de nuestra API en el backend
const API_URL = "/api/medicamentos";

// Guardamos aquí todos los medicamentos cargados desde el servidor
let medicamentos = [];

// ID del medicamento que estamos editando (null = modo "agregar")
let editandoId = null;

// Filtro activo del inventario: "activos" | "archivados" | "todos"
let filtroActual = "activos";

let configuracionInventario = {
  stock_minimo_global: 5,
  dias_alerta_caducidad: 30
};

let presentacionesInventario = [];

const PRESENTACIONES_RESPALDO = [
  "Tableta",
  "Ampolla",
  "Frasco",
  "Caja",
  "Unidad",
  "Cápsula",
  "Jarabe",
  "Crema",
  "Solución"
];

// ──────────────────────────────────────────────
// 2. FUNCIONES DE LA API
// Todas usan fetch() para hablar con el backend
// ──────────────────────────────────────────────

async function cargarConfiguracionInventario() {
  try {
    const res = await fetch("/api/configuracion/general");
    if (!res.ok) return;
    configuracionInventario = await res.json();
    actualizarTextosConfiguracion();
  } catch (_) {
    // Si falla, se conservan los defaults locales.
  }
}

function actualizarTextosConfiguracion() {
  const leyendaStock = document.getElementById("leyenda-stock-bajo");
  if (leyendaStock) {
    leyendaStock.textContent = `Stock bajo (<${configuracionInventario.stock_minimo_global} unidades)`;
  }

  const leyendaCaducidad = document.getElementById("leyenda-caducidad");
  if (leyendaCaducidad) {
    leyendaCaducidad.textContent = `Caduca en <${configuracionInventario.dias_alerta_caducidad} dias o ya caduco`;
  }
}

async function cargarPresentacionesInventario() {
  try {
    const res = await fetch("/api/configuracion/presentaciones");
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "No se pudieron cargar las presentaciones");
    presentacionesInventario = data.length ? data.map(p => p.nombre) : PRESENTACIONES_RESPALDO;
  } catch (_) {
    presentacionesInventario = PRESENTACIONES_RESPALDO;
  }

  pintarSelectPresentaciones();
}

function pintarSelectPresentaciones(valorSeleccionado = "") {
  const select = document.getElementById("presentacion");
  if (!select) return;

  const opciones = [...presentacionesInventario];
  if (valorSeleccionado && !opciones.includes(valorSeleccionado)) {
    opciones.push(valorSeleccionado);
  }

  select.innerHTML = `
    <option value="" disabled ${valorSeleccionado ? "" : "selected"}>Seleccionar...</option>
    ${opciones.map(nombre => `
      <option value="${escaparHTML(nombre)}" ${nombre === valorSeleccionado ? "selected" : ""}>
        ${escaparHTML(nombre)}
      </option>
    `).join("")}
  `;
}

/**
 * Carga todos los medicamentos desde el backend
 * y actualiza la variable global `medicamentos`
 */
async function cargarMedicamentos() {
  try {
    const respuesta = await fetch(`${API_URL}?filtro=${filtroActual}`);

    if (!respuesta.ok) {
      throw new Error("Error al conectar con el servidor");
    }

    medicamentos = await respuesta.json();
    renderizarTabla(medicamentos);
    // Solo mostramos alertas en vista de activos
    if (filtroActual === "activos") {
      actualizarAlertas(medicamentos);
    } else {
      const banner = document.getElementById("banner-alertas");
      banner.classList.remove("visible");
      banner.innerHTML = "";
    }
  } catch (err) {
    mostrarToast("❌ No se pudo conectar con el servidor", "error");
    console.error(err);
  }
}

/**
 * Cambia el filtro de inventario y recarga la tabla
 * @param {string} nuevoFiltro - "activos" | "archivados" | "todos"
 */
function cambiarFiltro(nuevoFiltro) {
  filtroActual = nuevoFiltro;

  // Actualizamos estilo visual de los botones de filtro
  document.querySelectorAll(".btn-filtro").forEach(btn => {
    btn.classList.toggle("activo", btn.dataset.filtro === nuevoFiltro);
  });

  cargarMedicamentos();
}

/**
 * Envía un nuevo medicamento al backend (POST)
 * @param {Object} datos - Campos del medicamento
 */
async function crearMedicamento(datos) {
  const respuesta = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" }, // Le decimos que enviamos JSON
    body: JSON.stringify(datos)                        // Convertimos el objeto a texto JSON
  });

  if (!respuesta.ok) {
    const error = await respuesta.json();
    throw new Error(error.error || "Error al guardar");
  }

  return await respuesta.json();
}

/**
 * Actualiza un medicamento existente (PUT)
 * @param {number} id   - ID del medicamento a editar
 * @param {Object} datos - Campos actualizados
 */
async function actualizarMedicamento(id, datos) {
  const respuesta = await fetch(`${API_URL}/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(datos)
  });

  if (!respuesta.ok) {
    const error = await respuesta.json();
    throw new Error(error.error || "Error al actualizar");
  }

  return await respuesta.json();
}

/**
 * Archiva un medicamento (soft delete — pone activo=0)
 * @param {number} id - ID del medicamento a archivar
 */
async function eliminarMedicamento(id) {
  const respuesta = await fetch(`${API_URL}/${id}`, {
    method: "DELETE"
  });

  if (!respuesta.ok) {
    const error = await respuesta.json();
    throw new Error(error.error || "Error al archivar");
  }

  return await respuesta.json();
}

/**
 * Restaura un medicamento archivado (pone activo=1)
 * @param {number} id - ID del medicamento a restaurar
 */
async function restaurarMedicamento(id) {
  const respuesta = await fetch(`${API_URL}/${id}/restaurar`, {
    method: "PATCH"
  });

  if (!respuesta.ok) {
    const error = await respuesta.json();
    throw new Error(error.error || "Error al restaurar");
  }

  return await respuesta.json();
}

// ──────────────────────────────────────────────
// 3. RENDERIZADO DE LA TABLA
// ──────────────────────────────────────────────

/**
 * Dibuja la tabla de medicamentos en el HTML
 * @param {Array} lista - Array de medicamentos a mostrar
 */
function renderizarTabla(lista) {
  const tbody = document.getElementById("tabla-body");
  const contador = document.getElementById("contador-resultados");

  // Actualizamos el texto del contador
  contador.textContent = `${lista.length} medicamento${lista.length !== 1 ? "s" : ""}`;

  // Si no hay medicamentos, mostramos un mensaje
  if (lista.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="sin-datos">
          📭 No hay medicamentos registrados
        </td>
      </tr>`;
    return;
  }

  // Construimos el HTML de cada fila
  tbody.innerHTML = lista.map(med => {
    // Calculamos los días hasta que caduca
    const diasParaCaducar = calcularDias(med.caducidad);
    const stockBajo       = med.stock < configuracionInventario.stock_minimo_global;
    const porCaducar      = diasParaCaducar >= 0 && diasParaCaducar <= configuracionInventario.dias_alerta_caducidad;
    const caducado        = diasParaCaducar < 0;

    // Clases CSS según el estado del medicamento
    let clasesFila = "";
    if (stockBajo)  clasesFila += " alerta-stock";
    if (porCaducar || caducado) clasesFila += " alerta-caducidad";

    // Badge de estado del medicamento
    let badge = "";
    if (caducado) {
      badge = `<span class="badge badge-stock-bajo">⚠ Caducado</span>`;
    } else if (porCaducar) {
      badge = `<span class="badge badge-por-caducar">⏰ ${diasParaCaducar}d</span>`;
    } else {
      badge = `<span class="badge badge-ok">✓ OK</span>`;
    }

    // Badge de stock
    let badgeStock = "";
    if (stockBajo) {
      badgeStock = `<span class="badge badge-stock-bajo">⚠ Bajo</span>`;
    }

    // Formateamos la fecha para mostrarla más legible
    const fechaFormateada = formatearFecha(med.caducidad);

    // Botones de acción según el estado del medicamento
    let botonesAccion = "";
    if (med.activo === 0) {
      // Medicamento archivado: solo mostrar Restaurar
      botonesAccion = `
        <button class="btn btn-restaurar" data-permiso="desactivar_medicamento" onclick="confirmarRestaurar(${med.id}, '${escaparHTML(med.nombre)}')">
          ♻ Restaurar
        </button>`;
    } else {
      // Medicamento activo: Editar + Archivar
      botonesAccion = `
        <button class="btn btn-editar" data-permiso="editar_medicamento" onclick="abrirEdicion(${med.id})">
          ✏ Editar
        </button>
        <button class="btn btn-archivar" data-permiso="desactivar_medicamento" onclick="confirmarEliminar(${med.id}, '${escaparHTML(med.nombre)}')">
          📦 Archivar
        </button>`;
    }

    return `
      <tr class="${clasesFila}" data-id="${med.id}">
        <td><strong>${escaparHTML(med.nombre)}</strong></td>
        <td>${escaparHTML(med.presentacion)}</td>
        <td>
          ${med.stock}
          ${badgeStock}
        </td>
        <td>${fechaFormateada} ${badge}</td>
        <td>${escaparHTML(med.lote)}</td>
        <td class="acciones">
          ${botonesAccion}
        </td>
      </tr>`;
  }).join("");

  if (window.aplicarPermisosVisuales) window.aplicarPermisosVisuales();
}

// ──────────────────────────────────────────────
// 4. SISTEMA DE ALERTAS (banner superior)
// ──────────────────────────────────────────────

/**
 * Revisa los medicamentos y muestra el banner de alertas
 * @param {Array} lista - Todos los medicamentos
 */
function actualizarAlertas(lista) {
  const banner = document.getElementById("banner-alertas");

  // Separamos los medicamentos según su problema
  const stockBajo   = lista.filter(m => m.stock < configuracionInventario.stock_minimo_global);
  const porCaducar  = lista.filter(m => {
    const dias = calcularDias(m.caducidad);
    return dias >= 0 && dias <= configuracionInventario.dias_alerta_caducidad;
  });
  const caducados   = lista.filter(m => calcularDias(m.caducidad) < 0);

  // Combinamos caducados y próximos a caducar
  const problemasCaducidad = [...caducados, ...porCaducar];

  // Si no hay alertas, ocultamos el banner
  if (stockBajo.length === 0 && problemasCaducidad.length === 0) {
    banner.classList.remove("visible");
    banner.innerHTML = "";
    return;
  }

  let html = "";

  // Alerta de stock bajo
  if (stockBajo.length > 0) {
    html += `
      <div class="alerta-seccion rojo">
        <div class="alerta-titulo rojo">🚨 Stock bajo (menos de ${configuracionInventario.stock_minimo_global} unidades)</div>
        <ul class="alerta-lista">
          ${stockBajo.map(m => `<li><strong>${m.nombre}</strong> - ${m.stock} unidades</li>`).join("")}
        </ul>
      </div>`;
  }

  // Alerta de caducidad
  if (problemasCaducidad.length > 0) {
    html += `
      <div class="alerta-seccion amarillo">
        <div class="alerta-titulo amarillo">⏰ Medicamentos próximos a caducar o caducados</div>
        <ul class="alerta-lista">
          ${problemasCaducidad.map(m => {
            const dias = calcularDias(m.caducidad);
            const etiqueta = dias < 0
              ? `<strong style="color:var(--rojo)">CADUCADO</strong>`
              : `vence en ${dias} días`;
            return `<li><strong>${m.nombre}</strong> - ${etiqueta} (${formatearFecha(m.caducidad)})</li>`;
          }).join("")}
        </ul>
      </div>`;
  }

  banner.innerHTML = html;
  banner.classList.add("visible");
}

// ──────────────────────────────────────────────
// 5. FORMULARIO - AGREGAR / EDITAR
// ──────────────────────────────────────────────

/**
 * Maneja el envío del formulario (crea o actualiza)
 */
async function manejarFormulario(evento) {
  evento.preventDefault(); // Evitamos que la página se recargue

  // Recogemos los valores del formulario
  const datos = {
    nombre:       document.getElementById("nombre").value.trim(),
    presentacion: document.getElementById("presentacion").value,
    stock:        Number(document.getElementById("stock").value),
    caducidad:    document.getElementById("caducidad").value,
    lote:         document.getElementById("lote").value.trim()
  };

  // Validación extra: nombre no puede estar vacío
  if (!datos.nombre) {
    mostrarToast("⚠ El nombre no puede estar vacío", "error");
    return;
  }

  try {
    if (editandoId !== null) {
      // MODO EDICIÓN: actualizamos el medicamento existente
      await actualizarMedicamento(editandoId, datos);
      mostrarToast("✅ Medicamento actualizado correctamente");
      cancelarEdicion();
    } else {
      // MODO AGREGAR: creamos uno nuevo
      await crearMedicamento(datos);
      mostrarToast("✅ Medicamento agregado correctamente");
    }

    limpiarFormulario();
    await cargarMedicamentos(); // Recargamos la tabla

  } catch (err) {
    mostrarToast("❌ " + err.message, "error");
  }
}

/**
 * Carga los datos de un medicamento en el formulario para editarlo
 * @param {number} id - ID del medicamento a editar
 */
function abrirEdicion(id) {
  // Buscamos el medicamento en el array local (sin ir al servidor)
  const med = medicamentos.find(m => m.id === id);
  if (!med) return;

  // Guardamos el ID que estamos editando
  editandoId = id;

  // Llenamos el formulario con los datos del medicamento
  document.getElementById("nombre").value       = med.nombre;
  pintarSelectPresentaciones(med.presentacion);
  document.getElementById("stock").value        = med.stock;
  document.getElementById("caducidad").value    = med.caducidad;
  document.getElementById("lote").value         = med.lote;

  // Cambiamos el título y botón del formulario
  document.getElementById("form-titulo").textContent = "✏ Editar Medicamento";
  document.getElementById("btn-guardar").textContent = "💾 Guardar Cambios";
  document.getElementById("btn-guardar").dataset.permiso = "editar_medicamento";
  document.getElementById("btn-cancelar").style.display = "inline-flex";
  if (window.aplicarPermisosVisuales) window.aplicarPermisosVisuales();

  // Hacemos scroll hacia el formulario para que el usuario lo vea
  document.getElementById("seccion-formulario").scrollIntoView({ behavior: "smooth" });
}

/**
 * Cancela la edición y regresa al modo "agregar"
 */
function cancelarEdicion() {
  editandoId = null;
  limpiarFormulario();
  pintarSelectPresentaciones();
  document.getElementById("form-titulo").textContent   = "➕ Agregar Medicamento";
  document.getElementById("btn-guardar").textContent   = "💊 Guardar Medicamento";
  document.getElementById("btn-guardar").dataset.permiso = "crear_medicamento";
  document.getElementById("btn-cancelar").style.display = "none";
  if (window.aplicarPermisosVisuales) window.aplicarPermisosVisuales();
}

/**
 * Limpia todos los campos del formulario
 */
function limpiarFormulario() {
  document.getElementById("form-medicamento").reset();
}

// ──────────────────────────────────────────────
// 6. MODAL DE CONFIRMACIÓN PARA ELIMINAR
// ──────────────────────────────────────────────

let idParaEliminar = null;   // ID para archivar
let idParaRestaurar = null; // ID para restaurar

/**
 * Muestra el modal de confirmación para ARCHIVAR un medicamento
 */
function confirmarEliminar(id, nombre) {
  idParaEliminar = id;
  idParaRestaurar = null;
  document.getElementById("modal-nombre").textContent = nombre;
  document.getElementById("modal-mensaje").textContent =
    "Este medicamento dejará de aparecer en el inventario activo, pero seguirá existiendo para mantener el historial y reportes. ¿Deseas continuar?";
  document.getElementById("btn-modal-si").textContent = "📦 Sí, archivar";
  document.getElementById("modal-overlay").classList.add("visible");
}

/**
 * Muestra el modal de confirmación para RESTAURAR un medicamento
 */
function confirmarRestaurar(id, nombre) {
  idParaRestaurar = id;
  idParaEliminar = null;
  document.getElementById("modal-nombre").textContent = nombre;
  document.getElementById("modal-mensaje").textContent =
    "Este medicamento volverá a aparecer en el inventario activo. ¿Deseas continuar?";
  document.getElementById("btn-modal-si").textContent = "♻ Sí, restaurar";
  document.getElementById("modal-overlay").classList.add("visible");
}

/**
 * El usuario confirmó la acción del modal
 */
async function confirmarEliminarSi() {
  try {
    if (idParaEliminar !== null) {
      await eliminarMedicamento(idParaEliminar);
      mostrarToast("📦 Medicamento archivado");
    } else if (idParaRestaurar !== null) {
      await restaurarMedicamento(idParaRestaurar);
      mostrarToast("✅ Medicamento restaurado al inventario");
    }
    await cargarMedicamentos();
  } catch (err) {
    mostrarToast("❌ " + err.message, "error");
  } finally {
    cerrarModal();
  }
}

/**
 * El usuario canceló: cerramos el modal
 */
function cerrarModal() {
  idParaEliminar = null;
  idParaRestaurar = null;
  document.getElementById("modal-overlay").classList.remove("visible");
}

// ──────────────────────────────────────────────
// 7. TOAST - Notificaciones en la esquina
// ──────────────────────────────────────────────

/**
 * Muestra una notificación temporal en la esquina inferior derecha
 * @param {string} mensaje - Texto del mensaje
 * @param {string} tipo    - "exito" (verde) o "error" (rojo)
 */
function mostrarToast(mensaje, tipo = "exito") {
  const contenedor = document.getElementById("toast-contenedor");

  const toast = document.createElement("div");
  toast.className = `toast ${tipo === "error" ? "error" : ""}`;
  toast.textContent = mensaje;

  contenedor.appendChild(toast);

  // El toast desaparece después de 3.5 segundos
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transition = "opacity 0.4s";
    setTimeout(() => toast.remove(), 400);
  }, 3500);
}

// ──────────────────────────────────────────────
// 8. BUSCADOR EN TIEMPO REAL
// ──────────────────────────────────────────────

/**
 * Filtra la tabla según lo que escribe el usuario
 */
function filtrarTabla() {
  const texto = document.getElementById("buscador").value.toLowerCase().trim();

  if (!texto) {
    // Si está vacío, mostramos todos
    renderizarTabla(medicamentos);
    return;
  }

  // Filtramos por nombre, presentación o lote
  const filtrados = medicamentos.filter(m =>
    m.nombre.toLowerCase().includes(texto) ||
    m.presentacion.toLowerCase().includes(texto) ||
    m.lote.toLowerCase().includes(texto)
  );

  renderizarTabla(filtrados);
}

// ──────────────────────────────────────────────
// UTILIDADES
// ──────────────────────────────────────────────

/**
 * Calcula cuántos días faltan (o pasaron) para la fecha dada
 * Retorna un número negativo si ya caducó
 * @param {string} fechaStr - Fecha en formato "YYYY-MM-DD"
 */
function calcularDias(fechaStr) {
  const hoy    = new Date();
  hoy.setHours(0, 0, 0, 0); // Reseteamos la hora para comparar solo fechas
  const fecha  = new Date(fechaStr + "T00:00:00"); // Evitamos problemas de zona horaria
  const diff   = fecha - hoy;
  return Math.ceil(diff / (1000 * 60 * 60 * 24)); // Convertimos ms a días
}

/**
 * Formatea una fecha "YYYY-MM-DD" a "DD/MM/YYYY"
 */
function formatearFecha(fechaStr) {
  if (!fechaStr) return "-";
  const [anio, mes, dia] = fechaStr.split("-");
  return `${dia}/${mes}/${anio}`;
}

/**
 * Escapa caracteres especiales para evitar problemas de HTML
 * (seguridad básica contra XSS)
 */
function escaparHTML(texto) {
  const div = document.createElement("div");
  div.textContent = String(texto);
  return div.innerHTML;
}

// ──────────────────────────────────────────────
// 9. INICIALIZACIÓN
// Se ejecuta cuando la página termina de cargar
// ──────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", async () => {
  await cargarConfiguracionInventario();
  await cargarPresentacionesInventario();

  // Cargamos los medicamentos al iniciar
  cargarMedicamentos();

  // Conectamos el formulario a la función que lo maneja
  document.getElementById("form-medicamento")
    .addEventListener("submit", manejarFormulario);

  // Conectamos el buscador
  document.getElementById("buscador")
    .addEventListener("input", filtrarTabla);

  // Botón cancelar edición
  document.getElementById("btn-cancelar")
    .addEventListener("click", cancelarEdicion);

  // Botones del modal
  document.getElementById("btn-modal-si")
    .addEventListener("click", confirmarEliminarSi);

  document.getElementById("btn-modal-no")
    .addEventListener("click", cerrarModal);

  // Cerrar modal al hacer clic fuera de él
  document.getElementById("modal-overlay")
    .addEventListener("click", (e) => {
      if (e.target.id === "modal-overlay") cerrarModal();
    });
});

// ── Intercepción de respuestas 401 (sesión expirada) ──
// Si el servidor devuelve 401, mandamos al login.
// Se agrega al final de app.js sin modificar nada existente.
const _fetchOriginal = window.fetch;
window.fetch = async function(...args) {
  const res = await _fetchOriginal(...args);
  if (res.status === 401) {
    window.location.href = "/login.html";
  }
  return res;
};
