// ============================================================
// reportes.js — Lógica del módulo de reportes
// ============================================================

const API = "/api/reportes";

// ── Utilidades ──
function fmt(fecha) {
  if (!fecha) return "—";
  const [a,m,d] = fecha.split("-");
  return `${d}/${m}/${a}`;
}
function esc(t) {
  const d = document.createElement("div");
  d.textContent = String(t ?? "");
  return d.innerHTML;
}
function badge(clase, texto) {
  return `<span class="badge ${clase}" style="padding:.2rem .55rem;border-radius:20px;font-size:.75rem;font-weight:700">${texto}</span>`;
}
function toast(msg, tipo = "ok") {
  const c = document.getElementById("toast-contenedor");
  const t = document.createElement("div");
  t.className = `toast ${tipo === "error" ? "error" : ""}`;
  t.textContent = msg;
  c.appendChild(t);
  setTimeout(() => { t.style.opacity="0"; t.style.transition="opacity .4s"; setTimeout(()=>t.remove(),400); }, 3500);
}

// ── Cambiar pestaña activa ──
let tabActual = "inventario";

function cambiarTab(nombre) {
  tabActual = nombre;
  document.querySelectorAll(".reporte-tab-btn").forEach((b,i) => {
    const tabs = ["inventario","stock-bajo","por-caducar","caducados","historial","consumo","ordenes-especiales"];
    b.classList.toggle("activo", tabs[i] === nombre);
  });
  document.querySelectorAll(".reporte-panel").forEach(p => p.classList.remove("activo"));
  document.getElementById("panel-" + nombre).classList.add("activo");

  // Cargamos el reporte al cambiar de pestaña
  const cargadores = {
    "inventario": cargarInventario,
    "stock-bajo": cargarStockBajo,
    "por-caducar": cargarPorCaducar,
    "caducados": cargarCaducados,
    "historial": cargarHistorial,
    "consumo": cargarConsumo,
    "ordenes-especiales": cargarOrdenesEspecialesReporte
  };
  cargadores[nombre]?.();
}

// ── 1. Inventario general ──
async function cargarInventario() {
  const cont = document.getElementById("tabla-inventario-general");
  cont.innerHTML = "<p style='color:var(--gris-texto)'>Cargando…</p>";
  try {
    const data = await fetch(API + "/inventario-general").then(r => r.json());
    if (data.length === 0) { cont.innerHTML = "<p style='color:var(--gris-texto);padding:1rem'>Sin datos</p>"; return; }
    cont.innerHTML = `
      <div style="overflow-x:auto">
      <table style="width:100%;border-collapse:collapse;font-size:.88rem">
        <thead style="background:var(--verde-oscuro);color:white">
          <tr>
            <th style="padding:.7rem 1rem;text-align:left">Nombre</th>
            <th style="padding:.7rem 1rem">Presentación</th>
            <th style="padding:.7rem 1rem">Stock</th>
            <th style="padding:.7rem 1rem">Estado stock</th>
            <th style="padding:.7rem 1rem">Caducidad</th>
            <th style="padding:.7rem 1rem">Estado cad.</th>
            <th style="padding:.7rem 1rem">Lote</th>
          </tr>
        </thead>
        <tbody>
          ${data.map(m => {
            const bs = m.estado_stock === "Sin stock" ? "badge-stock-bajo" : m.estado_stock === "Stock bajo" ? "badge-stock-bajo" : "badge-normal";
            const bc = m.estado_caducidad === "Caducado" ? "badge-caducado" : m.estado_caducidad === "Por caducar" ? "badge-por-caducar" : "badge-vigente";
            return `<tr style="border-bottom:1px solid var(--gris-borde)">
              <td style="padding:.65rem 1rem"><strong>${esc(m.nombre)}</strong></td>
              <td style="padding:.65rem 1rem">${esc(m.presentacion)}</td>
              <td style="padding:.65rem 1rem;text-align:center">${m.stock}</td>
              <td style="padding:.65rem 1rem">${badge(bs, m.estado_stock)}</td>
              <td style="padding:.65rem 1rem">${fmt(m.caducidad)}</td>
              <td style="padding:.65rem 1rem">${badge(bc, m.estado_caducidad)}</td>
              <td style="padding:.65rem 1rem;color:var(--gris-texto)">${esc(m.lote)}</td>
            </tr>`;
          }).join("")}
        </tbody>
      </table></div>
      <p style="margin-top:.8rem;font-size:.8rem;color:var(--gris-texto)">${data.length} medicamentos en total</p>`;
  } catch (e) { cont.innerHTML = `<p style="color:var(--rojo)">❌ Error: ${e.message}</p>`; }
}

// ── 2. Stock bajo ──
async function cargarStockBajo() {
  const cont = document.getElementById("tabla-stock-bajo");
  cont.innerHTML = "<p style='color:var(--gris-texto)'>Cargando…</p>";
  try {
    const data = await fetch(API + "/stock-bajo").then(r => r.json());
    document.getElementById("res-stock-bajo").textContent = data.length;
    if (data.length === 0) { cont.innerHTML = `<p style="padding:2rem;text-align:center;color:var(--gris-texto)">✅ Todos los medicamentos tienen stock suficiente</p>`; return; }
    cont.innerHTML = `
      <div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:.88rem">
        <thead style="background:var(--verde-oscuro);color:white">
          <tr>
            <th style="padding:.7rem 1rem;text-align:left">Nombre</th>
            <th style="padding:.7rem 1rem">Presentación</th>
            <th style="padding:.7rem 1rem;text-align:center">Stock</th>
            <th style="padding:.7rem 1rem">Lote</th>
            <th style="padding:.7rem 1rem">Caducidad</th>
          </tr>
        </thead>
        <tbody>
          ${data.map(m => `
            <tr style="background:var(--rojo-suave);border-bottom:1px solid #fad7d3">
              <td style="padding:.65rem 1rem"><strong>${esc(m.nombre)}</strong></td>
              <td style="padding:.65rem 1rem">${esc(m.presentacion)}</td>
              <td style="padding:.65rem 1rem;text-align:center">
                ${badge("badge-stock-bajo", m.stock + " uds")}
              </td>
              <td style="padding:.65rem 1rem;color:var(--gris-texto)">${esc(m.lote)}</td>
              <td style="padding:.65rem 1rem">${fmt(m.caducidad)}</td>
            </tr>`).join("")}
        </tbody>
      </table></div>
      <p style="margin-top:.8rem;font-size:.8rem;color:var(--rojo);font-weight:600">⚠ ${data.length} medicamentos con stock bajo</p>`;
  } catch (e) { cont.innerHTML = `<p style="color:var(--rojo)">❌ ${e.message}</p>`; }
}

// ── 3. Próximos a caducar ──
async function cargarPorCaducar() {
  const cont = document.getElementById("tabla-por-caducar");
  cont.innerHTML = "<p style='color:var(--gris-texto)'>Cargando…</p>";
  try {
    const data = await fetch(API + "/proximos-caducar").then(r => r.json());
    document.getElementById("res-por-caducar").textContent = data.length;
    if (data.length === 0) { cont.innerHTML = `<p style="padding:2rem;text-align:center;color:var(--gris-texto)">✅ Ningún medicamento vence en los próximos 30 días</p>`; return; }
    cont.innerHTML = `
      <div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:.88rem">
        <thead style="background:var(--verde-oscuro);color:white">
          <tr>
            <th style="padding:.7rem 1rem;text-align:left">Nombre</th>
            <th style="padding:.7rem 1rem">Presentación</th>
            <th style="padding:.7rem 1rem;text-align:center">Stock</th>
            <th style="padding:.7rem 1rem">Caducidad</th>
            <th style="padding:.7rem 1rem;text-align:center">Días restantes</th>
            <th style="padding:.7rem 1rem">Lote</th>
          </tr>
        </thead>
        <tbody>
          ${data.map(m => {
            const urgente = m.dias_restantes <= 7;
            const fondo = urgente ? "background:var(--rojo-suave)" : "background:var(--amarillo-suave)";
            return `<tr style="${fondo};border-bottom:1px solid var(--gris-borde)">
              <td style="padding:.65rem 1rem"><strong>${esc(m.nombre)}</strong></td>
              <td style="padding:.65rem 1rem">${esc(m.presentacion)}</td>
              <td style="padding:.65rem 1rem;text-align:center">${m.stock}</td>
              <td style="padding:.65rem 1rem">${fmt(m.caducidad)}</td>
              <td style="padding:.65rem 1rem;text-align:center">
                ${badge(urgente ? "badge-caducado" : "badge-por-caducar", m.dias_restantes + " días")}
              </td>
              <td style="padding:.65rem 1rem;color:var(--gris-texto)">${esc(m.lote)}</td>
            </tr>`;
          }).join("")}
        </tbody>
      </table></div>
      <p style="margin-top:.8rem;font-size:.8rem;color:var(--amarillo);font-weight:600">⏰ ${data.length} medicamentos por caducar pronto</p>`;
  } catch (e) { cont.innerHTML = `<p style="color:var(--rojo)">❌ ${e.message}</p>`; }
}

// ── 4. Caducados ──
async function cargarCaducados() {
  const cont = document.getElementById("tabla-caducados");
  cont.innerHTML = "<p style='color:var(--gris-texto)'>Cargando…</p>";
  try {
    const data = await fetch(API + "/caducados").then(r => r.json());
    document.getElementById("res-caducados").textContent = data.length;
    if (data.length === 0) { cont.innerHTML = `<p style="padding:2rem;text-align:center;color:var(--gris-texto)">✅ No hay medicamentos caducados</p>`; return; }
    cont.innerHTML = `
      <div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:.88rem">
        <thead style="background:var(--rojo);color:white">
          <tr>
            <th style="padding:.7rem 1rem;text-align:left">Nombre</th>
            <th style="padding:.7rem 1rem">Presentación</th>
            <th style="padding:.7rem 1rem;text-align:center">Stock</th>
            <th style="padding:.7rem 1rem">Venció el</th>
            <th style="padding:.7rem 1rem;text-align:center">Días vencido</th>
            <th style="padding:.7rem 1rem">Lote</th>
          </tr>
        </thead>
        <tbody>
          ${data.map(m => `
            <tr style="background:var(--rojo-suave);border-bottom:1px solid #fad7d3">
              <td style="padding:.65rem 1rem"><strong>${esc(m.nombre)}</strong></td>
              <td style="padding:.65rem 1rem">${esc(m.presentacion)}</td>
              <td style="padding:.65rem 1rem;text-align:center">${m.stock}</td>
              <td style="padding:.65rem 1rem">${fmt(m.caducidad)}</td>
              <td style="padding:.65rem 1rem;text-align:center">
                ${badge("badge-caducado", m.dias_vencido + " días")}
              </td>
              <td style="padding:.65rem 1rem;color:var(--gris-texto)">${esc(m.lote)}</td>
            </tr>`).join("")}
        </tbody>
      </table></div>
      <p style="margin-top:.8rem;font-size:.8rem;color:var(--rojo);font-weight:600">🚨 ${data.length} medicamentos CADUCADOS — retirar del inventario</p>`;
  } catch (e) { cont.innerHTML = `<p style="color:var(--rojo)">❌ ${e.message}</p>`; }
}

// ── 5. Historial de órdenes ──
async function cargarHistorial() {
  const cont = document.getElementById("tabla-historial");
  cont.innerHTML = "<p style='color:var(--gris-texto)'>Cargando…</p>";
  try {
    const fi = document.getElementById("hist-fecha-inicio").value;
    const ff = document.getElementById("hist-fecha-fin").value;
    let url = API + "/historial-ordenes";
    const params = [];
    if (fi) params.push("fecha_inicio=" + fi);
    if (ff) params.push("fecha_fin=" + ff);
    if (params.length) url += "?" + params.join("&");

    const data = await fetch(url).then(r => r.json());
    document.getElementById("res-ordenes").textContent = data.length;

    if (data.length === 0) { cont.innerHTML = `<p style="padding:2rem;text-align:center;color:var(--gris-texto)">Sin órdenes en el período seleccionado</p>`; return; }

    cont.innerHTML = data.map(o => {
      const estadoBadge = o.estado === "completada"
        ? badge("badge-vigente", "✓ Completada")
        : badge("badge-por-caducar", "⏳ Pendiente");
      const filaDetalle = o.detalle.length === 0
        ? `<tr><td colspan="4" style="text-align:center;padding:.5rem;color:var(--gris-texto)">Sin medicamentos</td></tr>`
        : o.detalle.map(d => `
          <tr>
            <td style="padding:.4rem .8rem">${esc(d.nombre)} <span style="font-size:.78rem;color:var(--gris-texto)">(${esc(d.presentacion)})</span></td>
            <td style="padding:.4rem .8rem;text-align:center">${d.cantidad_solicitada}</td>
            <td style="padding:.4rem .8rem;text-align:center">${d.cantidad_entregada}</td>
          </tr>`).join("");
      return `
        <div style="border:1px solid var(--gris-borde);border-radius:10px;margin-bottom:1rem;overflow:hidden">
          <div style="background:var(--gris-claro);padding:.8rem 1rem;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:.5rem">
            <div>
              <strong>Orden #${o.id}</strong> — ${esc(o.area)}
              <span style="font-size:.8rem;color:var(--gris-texto);margin-left:.5rem">${fmt(o.fecha)}</span>
            </div>
            <div style="display:flex;gap:.6rem;align-items:center">
              ${estadoBadge}
              <span style="font-size:.8rem;color:var(--gris-texto)">${o.total_items} ítems · ${o.total_entregado} uds entregadas</span>
            </div>
          </div>
          <table style="width:100%;border-collapse:collapse;font-size:.85rem">
            <thead style="background:rgba(10,74,58,.06)">
              <tr>
                <th style="padding:.4rem .8rem;text-align:left;font-size:.75rem">Medicamento</th>
                <th style="padding:.4rem .8rem;text-align:center;font-size:.75rem">Solicitado</th>
                <th style="padding:.4rem .8rem;text-align:center;font-size:.75rem">Entregado</th>
              </tr>
            </thead>
            <tbody>${filaDetalle}</tbody>
          </table>
        </div>`;
    }).join("");
  } catch (e) { cont.innerHTML = `<p style="color:var(--rojo)">❌ ${e.message}</p>`; }
}

function limpiarFiltroHistorial() {
  document.getElementById("hist-fecha-inicio").value = "";
  document.getElementById("hist-fecha-fin").value = "";
  cargarHistorial();
}

// ── 6. Consumo por área ──
async function cargarConsumo() {
  const cont = document.getElementById("tabla-consumo");
  cont.innerHTML = "<p style='color:var(--gris-texto)'>Cargando…</p>";
  try {
    const fi = document.getElementById("con-fecha-inicio").value;
    const ff = document.getElementById("con-fecha-fin").value;
    let url = API + "/consumo-por-area";
    const params = [];
    if (fi) params.push("fecha_inicio=" + fi);
    if (ff) params.push("fecha_fin=" + ff);
    if (params.length) url += "?" + params.join("&");

    const data = await fetch(url).then(r => r.json());
    const { por_area, top_medicamentos } = data;

    let html = "";

    // Tabla de consumo por área
    if (por_area.length === 0) {
      html += `<p style="padding:1.5rem;text-align:center;color:var(--gris-texto)">Sin datos de consumo en el período</p>`;
    } else {
      html += `
        <h3 style="font-family:var(--fuente-titulo);color:var(--verde-oscuro);margin-bottom:1rem">Consumo por área</h3>
        <div style="overflow-x:auto;margin-bottom:1.5rem"><table style="width:100%;border-collapse:collapse;font-size:.88rem">
          <thead style="background:var(--verde-oscuro);color:white">
            <tr>
              <th style="padding:.7rem 1rem;text-align:left">Área</th>
              <th style="padding:.7rem 1rem;text-align:center">Órdenes</th>
              <th style="padding:.7rem 1rem;text-align:center">Unidades entregadas</th>
              <th style="padding:.7rem 1rem;text-align:center">Medicamentos distintos</th>
            </tr>
          </thead>
          <tbody>
            ${por_area.map(a => `
              <tr style="border-bottom:1px solid var(--gris-borde)">
                <td style="padding:.65rem 1rem"><strong>${esc(a.area)}</strong></td>
                <td style="padding:.65rem 1rem;text-align:center">${a.total_ordenes}</td>
                <td style="padding:.65rem 1rem;text-align:center;font-size:1.05rem;font-weight:700;color:var(--verde-oscuro)">${a.total_unidades ?? 0}</td>
                <td style="padding:.65rem 1rem;text-align:center">${a.medicamentos_distintos}</td>
              </tr>`).join("")}
          </tbody>
        </table></div>`;
    }

    // Top 10 medicamentos más despachados
    if (top_medicamentos.length > 0) {
      const maxVal = top_medicamentos[0].total_entregado || 1;
      html += `
        <h3 style="font-family:var(--fuente-titulo);color:var(--verde-oscuro);margin-bottom:1rem">🏆 Top medicamentos despachados</h3>
        <div style="display:flex;flex-direction:column;gap:.5rem">
          ${top_medicamentos.map((m, i) => {
            const pct = Math.round((m.total_entregado / maxVal) * 100);
            return `
              <div style="display:flex;align-items:center;gap:.8rem">
                <span style="width:1.4rem;text-align:right;font-size:.8rem;color:var(--gris-texto);font-weight:700">${i+1}</span>
                <div style="flex:1">
                  <div style="font-size:.88rem;font-weight:600">${esc(m.nombre)} <span style="font-weight:400;color:var(--gris-texto)">${esc(m.presentacion)}</span></div>
                  <div style="background:var(--gris-borde);border-radius:4px;height:8px;margin-top:.3rem;overflow:hidden">
                    <div style="background:var(--verde-claro);height:100%;width:${pct}%;transition:width .4s"></div>
                  </div>
                </div>
                <span style="font-size:.88rem;font-weight:700;color:var(--verde-oscuro);white-space:nowrap">${m.total_entregado} uds</span>
              </div>`;
          }).join("")}
        </div>`;
    }

    cont.innerHTML = html || `<p style="padding:1.5rem;text-align:center;color:var(--gris-texto)">Sin datos</p>`;
  } catch (e) { cont.innerHTML = `<p style="color:var(--rojo)">❌ ${e.message}</p>`; }
}

function limpiarFiltroConsumo() {
  document.getElementById("con-fecha-inicio").value = "";
  document.getElementById("con-fecha-fin").value = "";
  cargarConsumo();
}

// ── Carga inicial: resumen + primer tab ──
document.addEventListener("DOMContentLoaded", async () => {
  // Cargamos todos los datos para el resumen de tarjetas
  try {
    const [inv, sb, pc, cad, hist] = await Promise.all([
      fetch(API + "/inventario-general").then(r => r.json()),
      fetch(API + "/stock-bajo").then(r => r.json()),
      fetch(API + "/proximos-caducar").then(r => r.json()),
      fetch(API + "/caducados").then(r => r.json()),
      fetch(API + "/historial-ordenes").then(r => r.json())
    ]);
    document.getElementById("res-total").textContent      = inv.length;
    document.getElementById("res-stock-bajo").textContent = sb.length;
    document.getElementById("res-por-caducar").textContent= pc.length;
    document.getElementById("res-caducados").textContent  = cad.length;
    document.getElementById("res-ordenes").textContent    = hist.length;
  } catch (_) {}

  // Cargamos el primer tab
  cargarInventario();
});

// ── FUNCIONES DE DESCARGA A EXCEL ───────────────────────────

// Descarga Excel simple (sin filtros de fecha)
function descargarExcel(tipo) {
  // Redirigimos al endpoint de backend que genera el .xlsx
  window.location.href = `/api/reportes/excel/${tipo}`;
}

// Descarga Excel con filtros de fecha (historial y consumo)
function descargarExcelFiltrado(tipo, idDesde, idHasta) {
  const desde = document.getElementById(idDesde).value;
  const hasta = document.getElementById(idHasta).value;
  let url = `/api/reportes/excel/${tipo}`;
  const params = [];
  if (desde) params.push("fecha_inicio=" + desde);
  if (hasta) params.push("fecha_fin=" + hasta);
  if (params.length) url += "?" + params.join("&");
  window.location.href = url;
}

// Descarga Excel de órdenes especiales con todos sus filtros
function descargarExcelOE() {
  const desde  = document.getElementById("oe-rep-fecha-inicio").value;
  const hasta  = document.getElementById("oe-rep-fecha-fin").value;
  const tipo   = document.getElementById("oe-rep-tipo").value;
  const nombre = document.getElementById("oe-rep-nombre").value.trim();
  let url = "/api/reportes/excel/ordenes-especiales";
  const params = [];
  if (desde)  params.push("fecha_inicio=" + desde);
  if (hasta)  params.push("fecha_fin=" + hasta);
  if (tipo)   params.push("tipo_persona=" + encodeURIComponent(tipo));
  if (nombre) params.push("nombre_persona=" + encodeURIComponent(nombre));
  if (params.length) url += "?" + params.join("&");
  window.location.href = url;
}

// ── REPORTE: Órdenes Especiales ──────────────────────────────
async function cargarOrdenesEspecialesReporte() {
  const cont = document.getElementById("tabla-ordenes-especiales-reporte");
  cont.innerHTML = "<p style='color:var(--gris-texto)'>Cargando…</p>";
  try {
    const desde  = document.getElementById("oe-rep-fecha-inicio").value;
    const hasta  = document.getElementById("oe-rep-fecha-fin").value;
    const tipo   = document.getElementById("oe-rep-tipo").value;
    const nombre = document.getElementById("oe-rep-nombre").value.trim();

    let url = API + "/ordenes-especiales";
    const params = [];
    if (desde)  params.push("fecha_inicio=" + desde);
    if (hasta)  params.push("fecha_fin=" + hasta);
    if (tipo)   params.push("tipo_persona=" + encodeURIComponent(tipo));
    if (nombre) params.push("nombre_persona=" + encodeURIComponent(nombre));
    if (params.length) url += "?" + params.join("&");

    const data = await fetch(url).then(r => r.json());

    if (data.length === 0) {
      cont.innerHTML = `<p style="color:var(--gris-texto);padding:1.5rem;text-align:center">Sin órdenes especiales en el período seleccionado.</p>`;
      return;
    }

    cont.innerHTML = `
      <div style="overflow-x:auto">
      <table style="width:100%;border-collapse:collapse;font-size:.88rem">
        <thead style="background:var(--verde-oscuro);color:white">
          <tr>
            <th style="padding:.7rem 1rem;text-align:left">Fecha</th>
            <th style="padding:.7rem 1rem;text-align:left">Nombre</th>
            <th style="padding:.7rem 1rem;text-align:left">Tipo</th>
            <th style="padding:.7rem 1rem;text-align:left">Medicamento</th>
            <th style="padding:.7rem 1rem;text-align:center">Cantidad</th>
            <th style="padding:.7rem 1rem;text-align:left">Observación</th>
          </tr>
        </thead>
        <tbody>
          ${data.map(o => `
            <tr style="border-bottom:1px solid var(--gris-borde)">
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
            </tr>
          `).join("")}
        </tbody>
      </table></div>
      <p style="margin-top:.8rem;font-size:.8rem;color:var(--gris-texto)">${data.length} registros</p>
    `;
  } catch (e) {
    cont.innerHTML = `<p style="color:var(--rojo)">❌ Error: ${e.message}</p>`;
  }
}

function limpiarFiltrosOE() {
  document.getElementById("oe-rep-fecha-inicio").value = "";
  document.getElementById("oe-rep-fecha-fin").value    = "";
  document.getElementById("oe-rep-tipo").value         = "";
  document.getElementById("oe-rep-nombre").value       = "";
  cargarOrdenesEspecialesReporte();
}
