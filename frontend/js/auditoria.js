// ============================================================
// auditoria.js - Consulta de historial de acciones
// ============================================================

const API_AUDITORIA = "/api/auditoria";

function esc(texto) {
  const div = document.createElement("div");
  div.textContent = String(texto ?? "");
  return div.innerHTML;
}

function parametrosFiltros() {
  const params = new URLSearchParams();
  const usuario = document.getElementById("auditoria-usuario").value.trim();
  const modulo = document.getElementById("auditoria-modulo").value;
  const fecha = document.getElementById("auditoria-fecha").value;

  if (usuario) params.set("usuario", usuario);
  if (modulo) params.set("modulo", modulo);
  if (fecha) params.set("fecha", fecha);

  return params.toString();
}

async function cargarAuditoria() {
  const tbody = document.getElementById("auditoria-body");
  const query = parametrosFiltros();
  const url = query ? `${API_AUDITORIA}?${query}` : API_AUDITORIA;

  try {
    const res = await fetch(url);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "No se pudo cargar la auditoria");

    if (!data.length) {
      tbody.innerHTML = `<tr><td colspan="5" class="sin-datos">Sin acciones registradas</td></tr>`;
      return;
    }

    tbody.innerHTML = data.map(item => `
      <tr>
        <td>${esc(item.fecha)}</td>
        <td><strong>${esc(item.usuario)}</strong></td>
        <td>${esc(item.accion)}</td>
        <td>${esc(item.modulo)}</td>
        <td>${esc(item.detalle)}</td>
      </tr>
    `).join("");
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="5" class="sin-datos">${esc(err.message)}</td></tr>`;
  }
}

function limpiarFiltros() {
  document.getElementById("auditoria-usuario").value = "";
  document.getElementById("auditoria-modulo").value = "";
  document.getElementById("auditoria-fecha").value = "";
  cargarAuditoria();
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("btn-auditoria-filtrar").addEventListener("click", cargarAuditoria);
  document.getElementById("btn-auditoria-limpiar").addEventListener("click", limpiarFiltros);
  cargarAuditoria();
});
