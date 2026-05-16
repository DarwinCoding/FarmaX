// frontend/js/dashboard.js

const API = "/api/dashboard";

function fmt(fechaStr) {
  if (!fechaStr) return "-";
  const [a, m, d] = fechaStr.split("-");
  return `${d}/${m}/${a}`;
}

function esc(t) {
  const d = document.createElement("div");
  d.textContent = String(t ?? "");
  return d.innerHTML;
}

// ── Tarjetas de resumen ──
async function cargarResumen() {
  try {
    const data = await fetch(`${API}/resumen`).then(r => r.json());
    document.getElementById("d-activos").textContent    = data.totalActivos;
    document.getElementById("d-stock").textContent      = data.stockBajo;
    document.getElementById("d-caducar").textContent    = data.porCaducar;
    document.getElementById("d-caducados").textContent  = data.caducados;
    document.getElementById("d-ordenes").textContent    = data.totalOrdenes;
    document.getElementById("d-especiales").textContent = data.totalEspeciales;
  } catch (e) {
    console.error("Error resumen:", e);
  }
}

// ── Últimas órdenes ──
async function cargarUltimasOrdenes() {
  const cont = document.getElementById("d-ultimas-ordenes");
  try {
    const data = await fetch(`${API}/ultimas-ordenes`).then(r => r.json());
    if (!data.length) { cont.innerHTML = "<p class='d-empty'>Sin ordenes registradas</p>"; return; }
    cont.innerHTML = `
      <table class="d-tabla">
        <thead><tr><th>#</th><th>Fecha</th><th>Area</th><th>Estado</th></tr></thead>
        <tbody>
          ${data.map(o => `
            <tr>
              <td>${o.id}</td>
              <td>${fmt(o.fecha)}</td>
              <td>${esc(o.area)}</td>
              <td><span class="d-estado d-estado-${o.estado}">${esc(o.estado)}</span></td>
            </tr>`).join("")}
        </tbody>
      </table>`;
  } catch (e) {
    cont.innerHTML = "<p class='d-empty'>Error al cargar</p>";
  }
}

// ── Órdenes especiales recientes ──
async function cargarEspecialesRecientes() {
  const cont = document.getElementById("d-especiales-recientes");
  try {
    const data = await fetch(`${API}/ordenes-especiales-recientes`).then(r => r.json());
    if (!data.length) { cont.innerHTML = "<p class='d-empty'>Sin ordenes especiales</p>"; return; }
    cont.innerHTML = `
      <table class="d-tabla">
        <thead><tr><th>Fecha</th><th>Persona</th><th>Medicamento</th><th>Cant.</th></tr></thead>
        <tbody>
          ${data.map(o => `
            <tr>
              <td>${fmt(o.fecha)}</td>
              <td>${esc(o.nombre_persona)}</td>
              <td>${esc(o.medicamento)}</td>
              <td>${o.cantidad}</td>
            </tr>`).join("")}
        </tbody>
      </table>`;
  } catch (e) {
    cont.innerHTML = "<p class='d-empty'>Error al cargar</p>";
  }
}

// ── Alertas ──
async function cargarAlertas() {
  const cont = document.getElementById("d-alertas");
  try {
    const data = await fetch(`${API}/alertas`).then(r => r.json());
    let html = "";

    if (data.caducados.length) {
      html += `<div class="d-alerta-bloque d-alerta-rojo">
        <strong>Caducados (${data.caducados.length})</strong>
        <ul>${data.caducados.map(m =>
          `<li>${esc(m.nombre)} — venció el ${fmt(m.caducidad)} (hace ${m.dias_vencido} dias)</li>`
        ).join("")}</ul></div>`;
    }

    if (data.stockBajo.length) {
      html += `<div class="d-alerta-bloque d-alerta-rojo">
        <strong>Stock bajo (${data.stockBajo.length})</strong>
        <ul>${data.stockBajo.map(m =>
          `<li>${esc(m.nombre)} — ${m.stock} unidades</li>`
        ).join("")}</ul></div>`;
    }

    if (data.porCaducar.length) {
      html += `<div class="d-alerta-bloque d-alerta-amarillo">
        <strong>Por caducar (${data.porCaducar.length})</strong>
        <ul>${data.porCaducar.map(m =>
          `<li>${esc(m.nombre)} — caduca el ${fmt(m.caducidad)} (${m.dias_restantes} dias)</li>`
        ).join("")}</ul></div>`;
    }

    cont.innerHTML = html || "<p class='d-empty'>Sin alertas activas</p>";
  } catch (e) {
    cont.innerHTML = "<p class='d-empty'>Error al cargar alertas</p>";
  }
}

document.addEventListener("DOMContentLoaded", () => {
  cargarResumen();
  cargarUltimasOrdenes();
  cargarEspecialesRecientes();
  cargarAlertas();
});
