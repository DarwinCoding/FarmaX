// ============================================================
// orden-especial.js — Lógica del módulo de Órdenes Especiales
// ============================================================

const API_OE   = "/api/ordenes-especiales";
const API_MEDS = "/api/medicamentos";

// ── Guardar referencia al medicamento seleccionado ──
let medicamentoSeleccionado = null;

// ── Utilidades ──────────────────────────────────────────────

// Formatea fecha YYYY-MM-DD a DD/MM/YYYY
function fmt(fecha) {
  if (!fecha) return "—";
  const [a, m, d] = fecha.split("-");
  return `${d}/${m}/${a}`;
}

// Escapa caracteres especiales HTML para evitar XSS
function esc(t) {
  const d = document.createElement("div");
  d.textContent = String(t ?? "");
  return d.innerHTML;
}

// Muestra una notificación flotante tipo "toast"
function toast(msg, tipo = "ok") {
  const c = document.getElementById("toast-contenedor");
  const t = document.createElement("div");
  t.className = `toast ${tipo === "error" ? "error" : ""}`;
  t.textContent = msg;
  c.appendChild(t);
  setTimeout(() => {
    t.style.opacity = "0";
    t.style.transition = "opacity .4s";
    setTimeout(() => t.remove(), 400);
  }, 3500);
}

// Obtiene el rol del usuario actual desde la sesión
function obtenerRolActual() {
  // El auth-guard guarda info en sessionStorage
  try {
    const info = JSON.parse(sessionStorage.getItem("usuario") || "{}");
    return info.rol || "";
  } catch (_) {
    return "";
  }
}

// ── Autocompletado de medicamentos ──────────────────────────

// Lista de medicamentos cargada una sola vez al inicio
let listaMedicamentos = [];

async function cargarMedicamentos() {
  try {
    listaMedicamentos = await fetch(API_MEDS).then(r => r.json());
  } catch (_) {
    listaMedicamentos = [];
  }
}

function buscarMedicamento(texto) {
  const caja = document.getElementById("oe-autocomplete");
  const idInput = document.getElementById("oe-medicamento-id");

  if (!texto.trim()) {
    caja.style.display = "none";
    medicamentoSeleccionado = null;
    idInput.value = "";
    document.getElementById("oe-stock-info").textContent = "";
    return;
  }

  const termino = texto.toLowerCase();
  const resultados = listaMedicamentos.filter(m =>
    m.nombre.toLowerCase().includes(termino) ||
    m.presentacion.toLowerCase().includes(termino)
  ).slice(0, 8); // máximo 8 sugerencias

  if (resultados.length === 0) {
    caja.innerHTML = `<div style="padding:.7rem 1rem;color:var(--gris-texto);font-size:.88rem">Sin resultados</div>`;
    caja.style.display = "block";
    return;
  }

  caja.innerHTML = resultados.map(m => `
    <div
      onclick="seleccionarMedicamento(${m.id})"
      style="
        padding:.65rem 1rem;
        cursor:pointer;
        font-size:.88rem;
        border-bottom:1px solid var(--gris-borde);
        transition:background .15s;
      "
      onmouseover="this.style.background='var(--gris-claro)'"
      onmouseout="this.style.background=''"
    >
      <strong>${esc(m.nombre)}</strong>
      <span style="color:var(--gris-texto)"> — ${esc(m.presentacion)}</span>
      <span style="float:right;color:${m.stock < 5 ? 'var(--rojo)' : 'var(--verde-oscuro)'};font-weight:700">
        Stock: ${m.stock}
      </span>
    </div>
  `).join("");

  caja.style.display = "block";
}

function seleccionarMedicamento(id) {
  medicamentoSeleccionado = listaMedicamentos.find(m => m.id === id);
  if (!medicamentoSeleccionado) return;

  document.getElementById("oe-med-busqueda").value =
    `${medicamentoSeleccionado.nombre} — ${medicamentoSeleccionado.presentacion}`;
  document.getElementById("oe-medicamento-id").value = id;
  document.getElementById("oe-autocomplete").style.display = "none";
  document.getElementById("oe-stock-info").textContent =
    `Stock actual: ${medicamentoSeleccionado.stock} unidades`;
}

// Cerrar autocomplete al hacer clic fuera
document.addEventListener("click", (e) => {
  const caja = document.getElementById("oe-autocomplete");
  if (caja && !caja.contains(e.target) && e.target.id !== "oe-med-busqueda") {
    caja.style.display = "none";
  }
});

// ── Registrar orden especial ─────────────────────────────────
async function registrarOrden() {
  const nombre_persona = document.getElementById("oe-nombre").value.trim();
  const tipo_persona   = document.getElementById("oe-tipo").value;
  const medicamento_id = document.getElementById("oe-medicamento-id").value;
  const cantidad       = parseInt(document.getElementById("oe-cantidad").value, 10);
  const fecha          = document.getElementById("oe-fecha").value;
  const observacion    = document.getElementById("oe-observacion").value.trim();

  // Validaciones del lado del cliente (el servidor también valida)
  if (!nombre_persona) return toast("Ingrese el nombre de la persona.", "error");
  if (!tipo_persona)   return toast("Seleccione el tipo de persona.", "error");
  if (!medicamento_id) return toast("Seleccione un medicamento.", "error");
  if (!cantidad || cantidad <= 0) return toast("Ingrese una cantidad válida.", "error");
  if (!fecha)          return toast("Seleccione la fecha.", "error");

  try {
    const resp = await fetch(API_OE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre_persona, tipo_persona, medicamento_id, cantidad, fecha, observacion })
    });
    const data = await resp.json();

    if (!resp.ok) return toast(data.error || "Error al registrar.", "error");

    toast("✅ Orden especial registrada correctamente.");
    limpiarFormulario();
    await cargarMedicamentos(); // actualizar stock en memoria
    await cargarHistorial();
  } catch (e) {
    toast("Error de conexión: " + e.message, "error");
  }
}

// ── Limpiar formulario ───────────────────────────────────────
function limpiarFormulario() {
  document.getElementById("oe-nombre").value = "";
  document.getElementById("oe-tipo").value = "";
  document.getElementById("oe-med-busqueda").value = "";
  document.getElementById("oe-medicamento-id").value = "";
  document.getElementById("oe-cantidad").value = "";
  document.getElementById("oe-fecha").value = "";
  document.getElementById("oe-observacion").value = "";
  document.getElementById("oe-stock-info").textContent = "";
  document.getElementById("oe-autocomplete").style.display = "none";
  medicamentoSeleccionado = null;
}

// ── Cargar historial ─────────────────────────────────────────
async function cargarHistorial() {
  const cont = document.getElementById("tabla-ordenes-especiales");
  cont.innerHTML = "<p style='color:var(--gris-texto)'>Cargando…</p>";

  try {
    const data = await fetch(API_OE).then(r => r.json());
    const esAdmin = obtenerRolActual() === "admin";

    if (data.length === 0) {
      cont.innerHTML = `<p style="color:var(--gris-texto);padding:1.5rem;text-align:center">Sin órdenes especiales registradas.</p>`;
      return;
    }

    cont.innerHTML = `
      <div style="overflow-x:auto">
      <table style="width:100%;border-collapse:collapse;font-size:.88rem">
        <thead style="background:var(--verde-oscuro);color:white">
          <tr>
            <th style="padding:.7rem 1rem;text-align:left">#</th>
            <th style="padding:.7rem 1rem;text-align:left">Fecha</th>
            <th style="padding:.7rem 1rem;text-align:left">Nombre</th>
            <th style="padding:.7rem 1rem;text-align:left">Tipo</th>
            <th style="padding:.7rem 1rem;text-align:left">Medicamento</th>
            <th style="padding:.7rem 1rem;text-align:center">Cantidad</th>
            <th style="padding:.7rem 1rem;text-align:left">Observación</th>
            ${esAdmin ? '<th style="padding:.7rem 1rem;text-align:center">Acción</th>' : ""}
          </tr>
        </thead>
        <tbody>
          ${data.map(o => `
            <tr style="border-bottom:1px solid var(--gris-borde)">
              <td style="padding:.65rem 1rem;color:var(--gris-texto)">${o.id}</td>
              <td style="padding:.65rem 1rem">${fmt(o.fecha)}</td>
              <td style="padding:.65rem 1rem"><strong>${esc(o.nombre_persona)}</strong></td>
              <td style="padding:.65rem 1rem">
                <span style="
                  background:${o.tipo_persona === 'médico' ? '#e0f2fe' : '#fef3c7'};
                  color:${o.tipo_persona === 'médico' ? '#0369a1' : '#92400e'};
                  padding:.2rem .55rem;border-radius:20px;font-size:.75rem;font-weight:700
                ">${esc(o.tipo_persona)}</span>
              </td>
              <td style="padding:.65rem 1rem">
                ${esc(o.medicamento_nombre)}
                <span style="font-size:.78rem;color:var(--gris-texto)">(${esc(o.presentacion)})</span>
              </td>
              <td style="padding:.65rem 1rem;text-align:center;font-weight:700;color:var(--verde-oscuro)">${o.cantidad}</td>
              <td style="padding:.65rem 1rem;color:var(--gris-texto);font-size:.83rem">${esc(o.observacion) || "—"}</td>
              ${esAdmin ? `
                <td style="padding:.65rem 1rem;text-align:center">
                  <button
                    onclick="eliminarOrden(${o.id})"
                    style="background:var(--rojo);color:white;border:none;border-radius:6px;padding:.3rem .7rem;cursor:pointer;font-size:.8rem"
                  >🗑 Eliminar</button>
                </td>
              ` : ""}
            </tr>
          `).join("")}
        </tbody>
      </table></div>
      <p style="margin-top:.8rem;font-size:.8rem;color:var(--gris-texto)">${data.length} órdenes en total</p>
    `;
  } catch (e) {
    cont.innerHTML = `<p style="color:var(--rojo)">❌ Error: ${e.message}</p>`;
  }
}

// ── Eliminar orden (solo admin) ──────────────────────────────
async function eliminarOrden(id) {
  if (!confirm(`¿Confirmas que deseas eliminar la orden especial #${id}?\nEsta acción no se puede deshacer.`)) return;

  try {
    const resp = await fetch(`${API_OE}/${id}`, { method: "DELETE" });
    const data = await resp.json();

    if (!resp.ok) return toast(data.error || "Error al eliminar.", "error");

    toast("🗑 Orden especial eliminada.");
    await cargarHistorial();
  } catch (e) {
    toast("Error de conexión: " + e.message, "error");
  }
}

// ── Inicialización ───────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  // Ponemos la fecha de hoy por defecto en el campo fecha
  const hoy = new Date().toISOString().split("T")[0];
  document.getElementById("oe-fecha").value = hoy;

  // Cargamos la lista de medicamentos para el autocompletado
  await cargarMedicamentos();

  // Cargamos el historial
  await cargarHistorial();
});
