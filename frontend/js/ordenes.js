// ============================================================
// ordenes.js - Lógica de Órdenes de Despacho
// ============================================================
// Este archivo es NUEVO y completamente independiente de app.js.
// Solo se carga en ordenes.html.
//
// SECCIONES:
//   1. Variables globales
//   2. Funciones de la API
//   3. Pestaña: Lista de órdenes
//   4. Pestaña: Carrito (orden activa)
//   5. Autocompletado de medicamentos
//   6. Despachar orden
//   7. Toasts y utilidades
//   8. Inicialización
// ============================================================

// ──────────────────────────────────────────────
// 1. VARIABLES GLOBALES
// ──────────────────────────────────────────────

const API_ORDENES      = "/api/ordenes";
const API_MEDICAMENTOS = "/api/medicamentos";

let todosLosMedicamentos = []; // Cache de medicamentos para el autocompletado
let ordenActiva          = null; // La orden que está abierta en el carrito
let medicamentoSeleccionado = null; // Medicamento elegido en el autocompletado

// ──────────────────────────────────────────────
// 2. FUNCIONES DE LA API
// ──────────────────────────────────────────────

async function apiGet(url) {
  const r = await fetch(url);
  if (!r.ok) { const e = await r.json(); throw new Error(e.error); }
  return r.json();
}

async function apiPost(url, datos) {
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(datos)
  });
  if (!r.ok) { const e = await r.json(); throw new Error(e.error); }
  return r.json();
}

async function apiPut(url, datos) {
  const r = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(datos)
  });
  if (!r.ok) { const e = await r.json(); throw new Error(e.error); }
  return r.json();
}

async function apiDelete(url) {
  const r = await fetch(url, { method: "DELETE" });
  if (!r.ok) { const e = await r.json(); throw new Error(e.error); }
  return r.json();
}

// ──────────────────────────────────────────────
// 3. PESTAÑA: LISTA DE ÓRDENES
// ──────────────────────────────────────────────

/**
 * Carga y muestra todas las órdenes en el panel de lista
 */
async function cargarListaOrdenes() {
  const contenedor = document.getElementById("lista-ordenes");
  contenedor.innerHTML = "<p style='color:var(--gris-texto)'>Cargando…</p>";

  try {
    const ordenes = await apiGet(API_ORDENES);

    if (ordenes.length === 0) {
      contenedor.innerHTML = `<div class="sin-ordenes">📭 Aún no hay órdenes creadas</div>`;
      return;
    }

    // Generamos una "tarjeta" por cada orden
    contenedor.innerHTML = ordenes.map(o => {
      const estadoBadge = o.estado === "completada"
        ? `<span class="estado-badge estado-completada">✓ Completada</span>`
        : `<span class="estado-badge estado-pendiente">⏳ Pendiente</span>`;

      const fechaFmt = formatearFecha(o.fecha);

      return `
        <div class="orden-card">
          <div class="orden-card-info">
            <span class="orden-card-titulo">Orden #${o.id} - ${o.area}</span>
            <span class="orden-card-sub">📅 ${fechaFmt} · ${o.total_items} ítem(s)</span>
          </div>
          <div style="display:flex; gap:0.6rem; align-items:center; flex-wrap:wrap">
            ${estadoBadge}
            ${o.estado === "pendiente"
              ? `<button class="btn btn-primario" onclick="abrirOrdenEnCarrito(${o.id})">
                   🛒 Abrir carrito
                 </button>`
              : `<button class="btn btn-secundario" onclick="verResumenOrden(${o.id})">
                   👁 Ver detalle
                 </button>`
            }
          </div>
        </div>`;
    }).join("");

  } catch (err) {
    contenedor.innerHTML = `<div class="sin-ordenes">❌ Error: ${err.message}</div>`;
  }
}

/**
 * Crea una nueva orden y la abre en el carrito
 */
async function crearNuevaOrden() {
  const area = document.getElementById("select-area").value;
  if (!area) {
    mostrarToast("⚠ Selecciona un área primero", "error");
    return;
  }

  try {
    const resultado = await apiPost(API_ORDENES, { area });
    mostrarToast(`✅ Orden #${resultado.id} creada`);

    // Abrimos automáticamente el carrito de la nueva orden
    await abrirOrdenEnCarrito(resultado.id);
  } catch (err) {
    mostrarToast("❌ " + err.message, "error");
  }
}

// ──────────────────────────────────────────────
// 4. PESTAÑA: CARRITO (orden activa)
// ──────────────────────────────────────────────

/**
 * Carga una orden específica y muestra el panel del carrito
 * @param {number} id - ID de la orden a abrir
 */
async function abrirOrdenEnCarrito(id) {
  try {
    ordenActiva = await apiGet(`${API_ORDENES}/${id}`);
    cambiarTab("tab-carrito");
    renderizarCarrito();
  } catch (err) {
    mostrarToast("❌ " + err.message, "error");
  }
}

/**
 * Dibuja el carrito con el detalle de la orden activa
 */
function renderizarCarrito() {
  if (!ordenActiva) {
    document.getElementById("carrito-vacio-msg").style.display = "block";
    document.getElementById("carrito-contenido").style.display = "none";
    return;
  }

  document.getElementById("carrito-vacio-msg").style.display = "none";
  document.getElementById("carrito-contenido").style.display = "block";

  // Encabezado de la orden activa
  document.getElementById("orden-activa-titulo").textContent =
    `Orden #${ordenActiva.id} - ${ordenActiva.area}`;
  document.getElementById("orden-activa-fecha").textContent =
    `📅 ${formatearFecha(ordenActiva.fecha)} · Estado: ${ordenActiva.estado}`;

  // Mostramos u ocultamos el formulario de agregar según el estado
  const esPendiente = ordenActiva.estado === "pendiente";
  document.getElementById("form-agregar-med").style.display = esPendiente ? "block" : "none";
  document.getElementById("btn-despachar").style.display    = esPendiente ? "inline-flex" : "none";

  // ── Tabla del carrito ──
  const tbody = document.getElementById("carrito-body");

  if (ordenActiva.detalle.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="carrito-vacio">
          🛒 Agrega medicamentos usando el buscador de arriba
        </td>
      </tr>`;
  } else {
    tbody.innerHTML = ordenActiva.detalle.map(linea => {
      const stockOk = linea.cantidad_entregada <= linea.stock_actual;
      const claseInput = stockOk ? "" : "error";

      // Si la orden ya está completada, los inputs se deshabilitan
      const disabled = ordenActiva.estado === "completada" ? "disabled" : "";

      return `
        <tr>
          <td>
            <strong>${escaparHTML(linea.nombre)}</strong>
            <br><span style="font-size:0.78rem;color:var(--gris-texto)">${escaparHTML(linea.presentacion)}</span>
          </td>
          <td style="text-align:center">${linea.cantidad_solicitada}</td>
          <td style="text-align:center">
            <!-- Input editable de cantidad entregada -->
            <input
              type="number"
              class="input-entregada ${claseInput}"
              value="${linea.cantidad_entregada}"
              min="0"
              max="${linea.stock_actual}"
              ${disabled}
              onchange="actualizarCantidadEntregada(${linea.id}, this)"
              data-stock="${linea.stock_actual}"
            />
          </td>
          <td style="text-align:center">
            <span style="font-size:0.82rem;color:var(--gris-texto)">
              ${linea.stock_actual} disp.
            </span>
          </td>
          <td>
            ${esPendiente
              ? `<button class="btn btn-eliminar" onclick="eliminarLineaCarrito(${linea.id})">🗑</button>`
              : "-"
            }
          </td>
        </tr>`;
    }).join("");
  }

  // ── Pie del carrito: totales ──
  const totalSolicitado = ordenActiva.detalle.reduce((s, l) => s + l.cantidad_solicitada, 0);
  const totalEntregado  = ordenActiva.detalle.reduce((s, l) => s + l.cantidad_entregada, 0);
  document.getElementById("total-solicitado").textContent = totalSolicitado;
  document.getElementById("total-entregado").textContent  = totalEntregado;
}

/**
 * Agrega un medicamento al carrito de la orden activa
 */
async function agregarMedicamentoAOrden() {
  if (!ordenActiva) {
    mostrarToast("⚠ No hay orden activa", "error");
    return;
  }
  if (!medicamentoSeleccionado) {
    mostrarToast("⚠ Selecciona un medicamento del buscador", "error");
    return;
  }

  const cantidad = Number(document.getElementById("cantidad-solicitar").value);
  if (!cantidad || cantidad <= 0) {
    mostrarToast("⚠ Ingresa una cantidad mayor a 0", "error");
    return;
  }

  try {
    await apiPost(`${API_ORDENES}/${ordenActiva.id}/detalle`, {
      medicamento_id: medicamentoSeleccionado.id,
      cantidad_solicitada: cantidad
    });

    mostrarToast(`✅ ${medicamentoSeleccionado.nombre} agregado al carrito`);

    // Limpiamos el buscador
    document.getElementById("buscador-medicamento").value = "";
    document.getElementById("cantidad-solicitar").value   = "1";
    medicamentoSeleccionado = null;
    cerrarAutocomplete();

    // Recargamos el carrito
    ordenActiva = await apiGet(`${API_ORDENES}/${ordenActiva.id}`);
    renderizarCarrito();
  } catch (err) {
    mostrarToast("❌ " + err.message, "error");
  }
}

/**
 * Actualiza la cantidad entregada cuando el usuario cambia el input
 * @param {number} detalleId - ID de la línea del detalle
 * @param {HTMLElement} input - El elemento input que cambió
 */
async function actualizarCantidadEntregada(detalleId, input) {
  const cantidad = Number(input.value);
  const stockMax = Number(input.dataset.stock);

  // Validación visual inmediata
  if (cantidad > stockMax) {
    input.classList.add("error");
    mostrarToast(`⚠ Solo hay ${stockMax} unidades disponibles`, "error");
    return;
  }
  input.classList.remove("error");

  try {
    await apiPut(`${API_ORDENES}/detalle/${detalleId}`, {
      cantidad_entregada: cantidad
    });

    // Actualizamos los totales sin recargar toda la tabla
    const linea = ordenActiva.detalle.find(l => l.id === detalleId);
    if (linea) linea.cantidad_entregada = cantidad;

    // Solo actualizamos los totales del pie (más eficiente)
    const totalEntregado = ordenActiva.detalle.reduce((s, l) => s + l.cantidad_entregada, 0);
    document.getElementById("total-entregado").textContent = totalEntregado;

  } catch (err) {
    mostrarToast("❌ " + err.message, "error");
  }
}

/**
 * Elimina una línea del carrito
 * @param {number} detalleId - ID de la línea a eliminar
 */
async function eliminarLineaCarrito(detalleId) {
  try {
    await apiDelete(`${API_ORDENES}/detalle/${detalleId}`);
    mostrarToast("🗑 Línea eliminada");

    // Recargamos el carrito
    ordenActiva = await apiGet(`${API_ORDENES}/${ordenActiva.id}`);
    renderizarCarrito();
  } catch (err) {
    mostrarToast("❌ " + err.message, "error");
  }
}

/**
 * Abre una orden completada en modo solo lectura
 */
async function verResumenOrden(id) {
  await abrirOrdenEnCarrito(id);
}

// ──────────────────────────────────────────────
// 5. AUTOCOMPLETADO DE MEDICAMENTOS
// ──────────────────────────────────────────────

/**
 * Filtra los medicamentos mientras el usuario escribe
 */
function manejarBuscadorMed() {
  const texto = document.getElementById("buscador-medicamento").value.trim().toLowerCase();
  medicamentoSeleccionado = null; // Reseteamos la selección al escribir

  if (texto.length < 2) {
    cerrarAutocomplete();
    return;
  }

  // Filtramos el cache local (sin ir al servidor)
  const coincidencias = todosLosMedicamentos.filter(m =>
    m.nombre.toLowerCase().includes(texto) ||
    m.presentacion.toLowerCase().includes(texto)
  ).slice(0, 8); // Máximo 8 sugerencias

  mostrarAutocomplete(coincidencias);
}

/**
 * Muestra la lista desplegable de sugerencias
 */
function mostrarAutocomplete(lista) {
  const dropdown = document.getElementById("autocomplete-lista");

  if (lista.length === 0) {
    dropdown.innerHTML = `<div class="autocomplete-item" style="color:var(--gris-texto)">Sin resultados</div>`;
    dropdown.classList.add("visible");
    return;
  }

  dropdown.innerHTML = lista.map(m => {
    const stockClase = m.stock < 5 ? "stock-bajo" : "";
    return `
      <div class="autocomplete-item" onclick="seleccionarMedicamento(${m.id})">
        <span>
          <strong>${escaparHTML(m.nombre)}</strong>
          <span style="color:var(--gris-texto)"> - ${escaparHTML(m.presentacion)}</span>
        </span>
        <span class="stock-info ${stockClase}">
          ${m.stock < 5 ? "⚠ " : ""}${m.stock} en stock
        </span>
      </div>`;
  }).join("");

  dropdown.classList.add("visible");
}

/**
 * El usuario hizo clic en una sugerencia
 */
function seleccionarMedicamento(id) {
  medicamentoSeleccionado = todosLosMedicamentos.find(m => m.id === id);
  if (!medicamentoSeleccionado) return;

  document.getElementById("buscador-medicamento").value =
    `${medicamentoSeleccionado.nombre} (${medicamentoSeleccionado.presentacion})`;

  cerrarAutocomplete();

  // Ponemos foco en la cantidad para agilizar la entrada
  document.getElementById("cantidad-solicitar").focus();
  document.getElementById("cantidad-solicitar").select();
}

function cerrarAutocomplete() {
  document.getElementById("autocomplete-lista").classList.remove("visible");
}

// ──────────────────────────────────────────────
// 6. DESPACHAR ORDEN
// ──────────────────────────────────────────────

async function despacharOrden() {
  if (!ordenActiva) return;

  // Confirmación antes de despachar
  const confirmar = confirm(
    `¿Confirmas el despacho de la Orden #${ordenActiva.id} (${ordenActiva.area})?\n\n` +
    `Esto descontará del inventario las cantidades entregadas.\n` +
    `Esta acción no se puede deshacer.`
  );
  if (!confirmar) return;

  const btn = document.getElementById("btn-despachar");
  btn.disabled    = true;
  btn.textContent = "⏳ Despachando…";

  try {
    await apiPost(`${API_ORDENES}/${ordenActiva.id}/despachar`, {});
    mostrarToast(`✅ Orden #${ordenActiva.id} despachada. Stock actualizado.`);

    // Recargamos la orden para ver el estado "completada"
    ordenActiva = await apiGet(`${API_ORDENES}/${ordenActiva.id}`);
    renderizarCarrito();

    // También recargamos la lista de órdenes en segundo plano
    cargarListaOrdenes();

  } catch (err) {
    mostrarToast("❌ " + err.message, "error");
    btn.disabled    = false;
    btn.innerHTML   = "📦 Despachar Orden";
  }
}

// ──────────────────────────────────────────────
// NAVEGACIÓN POR TABS (pestañas)
// ──────────────────────────────────────────────

function cambiarTab(tabId) {
  // Desactivamos todas las pestañas y paneles
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("activo"));
  document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("activo"));

  // Activamos la pestaña y panel correspondiente
  document.getElementById(tabId + "-btn").classList.add("activo");
  document.getElementById(tabId + "-panel").classList.add("activo");

  // Si cambiamos a la lista, la actualizamos
  if (tabId === "tab-lista") cargarListaOrdenes();
}

// ──────────────────────────────────────────────
// UTILIDADES - Reutilizamos las mismas funciones
// que en app.js para mantener consistencia
// ──────────────────────────────────────────────

function formatearFecha(fechaStr) {
  if (!fechaStr) return "-";
  const [anio, mes, dia] = fechaStr.split("-");
  return `${dia}/${mes}/${anio}`;
}

function escaparHTML(texto) {
  const div = document.createElement("div");
  div.textContent = String(texto);
  return div.innerHTML;
}

function mostrarToast(mensaje, tipo = "exito") {
  const contenedor = document.getElementById("toast-contenedor");
  const toast = document.createElement("div");
  toast.className = `toast ${tipo === "error" ? "error" : ""}`;
  toast.textContent = mensaje;
  contenedor.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transition = "opacity 0.4s";
    setTimeout(() => toast.remove(), 400);
  }, 3500);
}

// ──────────────────────────────────────────────
// INICIALIZACIÓN
// ──────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", async () => {
  // Cargamos el cache de medicamentos para el autocompletado
  try {
    todosLosMedicamentos = await apiGet(API_MEDICAMENTOS);
  } catch (err) {
    mostrarToast("⚠ No se pudo cargar la lista de medicamentos", "error");
  }

  // Cargamos la lista de órdenes
  cargarListaOrdenes();

  // Buscador de medicamentos
  document.getElementById("buscador-medicamento")
    .addEventListener("input", manejarBuscadorMed);

  // Cerrar autocomplete al hacer clic fuera
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".buscador-med-wrapper")) {
      cerrarAutocomplete();
    }
  });

  // Botón crear orden
  document.getElementById("btn-crear-orden")
    .addEventListener("click", crearNuevaOrden);

  // Botón agregar medicamento al carrito
  document.getElementById("btn-agregar-med")
    .addEventListener("click", agregarMedicamentoAOrden);

  // Botón despachar
  document.getElementById("btn-despachar")
    .addEventListener("click", despacharOrden);

  // Tecla Enter en la cantidad para agregar rápido
  document.getElementById("cantidad-solicitar")
    .addEventListener("keydown", (e) => {
      if (e.key === "Enter") agregarMedicamentoAOrden();
    });

  // Navegación de tabs
  document.getElementById("tab-lista-btn")
    .addEventListener("click", () => cambiarTab("tab-lista"));
  document.getElementById("tab-carrito-btn")
    .addEventListener("click", () => cambiarTab("tab-carrito"));
});

// ── Intercepción de 401 (sesión expirada) ──
const _fetch401 = window.fetch;
window.fetch = async function(...args) {
  const res = await _fetch401(...args);
  if (res.status === 401) window.location.href = "/login.html";
  return res;
};
