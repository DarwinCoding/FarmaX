// ============================================================
// configuracion.js - Configuracion general del sistema
// ============================================================

const API_CONFIGURACION = "/api/configuracion";
let areaEditandoId = null;
let areasActivas = [];
let presentacionEditandoId = null;
let presentacionesActivas = [];

function mostrarMensaje(texto, tipo = "ok") {
  const mensaje = document.getElementById("configuracion-mensaje");
  if (!mensaje) return;
  mensaje.textContent = texto;
  mensaje.style.color = tipo === "error" ? "var(--rojo)" : "var(--verde-oscuro)";
}

function mostrarMensajeAreas(texto, tipo = "ok") {
  const mensaje = document.getElementById("areas-mensaje");
  if (!mensaje) return;
  mensaje.textContent = texto;
  mensaje.style.color = tipo === "error" ? "var(--rojo)" : "var(--verde-oscuro)";
}

function mostrarMensajePresentaciones(texto, tipo = "ok") {
  const mensaje = document.getElementById("presentaciones-mensaje");
  if (!mensaje) return;
  mensaje.textContent = texto;
  mensaje.style.color = tipo === "error" ? "var(--rojo)" : "var(--verde-oscuro)";
}

function mostrarMensajeBackup(texto, tipo = "ok") {
  const mensaje = document.getElementById("backup-mensaje");
  if (!mensaje) return;
  mensaje.textContent = texto;
  mensaje.style.color = tipo === "error" ? "var(--rojo)" : "var(--verde-oscuro)";
}

function esc(texto) {
  const div = document.createElement("div");
  div.textContent = String(texto ?? "");
  return div.innerHTML;
}

function leerCampos() {
  return {
    stock_minimo_global: Number(document.getElementById("stock-minimo-global").value),
    dias_alerta_caducidad: Number(document.getElementById("dias-alerta-caducidad").value)
  };
}

function pintarConfiguracion(config) {
  document.getElementById("stock-minimo-global").value = config.stock_minimo_global;
  document.getElementById("dias-alerta-caducidad").value = config.dias_alerta_caducidad;

  const estado = document.getElementById("configuracion-estado");
  if (estado) estado.textContent = "Configuracion cargada";
}

async function cargarConfiguracion() {
  try {
    const res = await fetch(`${API_CONFIGURACION}/general`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "No se pudo cargar la configuracion");
    pintarConfiguracion(data);
  } catch (err) {
    mostrarMensaje(err.message, "error");
  }
}

async function actualizarValor(endpoint, body) {
  const res = await fetch(`${API_CONFIGURACION}/${endpoint}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "No se pudo guardar la configuracion");
  return data.configuracion;
}

async function guardarConfiguracion() {
  const btn = document.getElementById("btn-guardar-configuracion");
  const config = leerCampos();

  if (!Number.isInteger(config.stock_minimo_global) || config.stock_minimo_global < 0) {
    mostrarMensaje("El stock minimo global debe ser un numero entero mayor o igual a 0.", "error");
    return;
  }

  if (!Number.isInteger(config.dias_alerta_caducidad) || config.dias_alerta_caducidad < 0) {
    mostrarMensaje("Los dias de alerta de caducidad deben ser un numero entero mayor o igual a 0.", "error");
    return;
  }

  btn.disabled = true;
  mostrarMensaje("Guardando...");

  try {
    await actualizarValor("stock-minimo-global", {
      stock_minimo_global: config.stock_minimo_global
    });

    const configuracionActualizada = await actualizarValor("dias-alerta-caducidad", {
      dias_alerta_caducidad: config.dias_alerta_caducidad
    });

    pintarConfiguracion(configuracionActualizada);
    mostrarMensaje("Configuracion guardada correctamente.");
  } catch (err) {
    mostrarMensaje(err.message, "error");
  } finally {
    btn.disabled = false;
  }
}

async function cargarAreas() {
  const tbody = document.getElementById("tabla-areas-body");
  if (!tbody) return;

  try {
    const res = await fetch(`${API_CONFIGURACION}/areas`);
    const areas = await res.json();
    if (!res.ok) throw new Error(areas.error || "No se pudieron cargar las areas");

    areasActivas = areas;

    if (!areasActivas.length) {
      tbody.innerHTML = `<tr><td colspan="2" class="sin-datos">No hay areas activas</td></tr>`;
      return;
    }

    tbody.innerHTML = areasActivas.map(area => `
      <tr>
        <td><strong>${esc(area.nombre)}</strong></td>
        <td class="acciones">
          <button class="btn btn-editar" data-permiso="editar_configuracion" onclick="editarArea(${area.id})">Editar</button>
          <button class="btn btn-archivar" data-permiso="editar_configuracion" onclick="desactivarArea(${area.id})">Desactivar</button>
        </td>
      </tr>
    `).join("");
    if (window.aplicarPermisosVisuales) window.aplicarPermisosVisuales();
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="2" class="sin-datos">${esc(err.message)}</td></tr>`;
  }
}

function limpiarFormularioArea() {
  areaEditandoId = null;
  document.getElementById("area-nombre").value = "";
  document.getElementById("btn-guardar-area").textContent = "Agregar area";
  document.getElementById("btn-cancelar-area").style.display = "none";
}

function editarArea(id) {
  const area = areasActivas.find(a => Number(a.id) === Number(id));
  if (!area) return;

  areaEditandoId = id;
  document.getElementById("area-nombre").value = area.nombre;
  document.getElementById("btn-guardar-area").textContent = "Guardar area";
  document.getElementById("btn-cancelar-area").style.display = "inline-flex";
  mostrarMensajeAreas("");
}

async function guardarArea() {
  const nombre = document.getElementById("area-nombre").value.trim();
  const btn = document.getElementById("btn-guardar-area");

  if (!nombre) {
    mostrarMensajeAreas("El nombre del area es obligatorio.", "error");
    return;
  }

  btn.disabled = true;

  try {
    const url = areaEditandoId
      ? `${API_CONFIGURACION}/areas/${areaEditandoId}`
      : `${API_CONFIGURACION}/areas`;

    const res = await fetch(url, {
      method: areaEditandoId ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "No se pudo guardar el area");

    mostrarMensajeAreas(areaEditandoId ? "Area actualizada correctamente." : "Area agregada correctamente.");
    limpiarFormularioArea();
    await cargarAreas();
  } catch (err) {
    mostrarMensajeAreas(err.message, "error");
  } finally {
    btn.disabled = false;
  }
}

async function desactivarArea(id) {
  const area = areasActivas.find(a => Number(a.id) === Number(id));
  if (!area) return;

  const nombre = area.nombre;
  if (!confirm(`Desactivar el area "${nombre}"?`)) return;

  try {
    const res = await fetch(`${API_CONFIGURACION}/areas/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "No se pudo desactivar el area");

    mostrarMensajeAreas("Area desactivada correctamente.");
    await cargarAreas();
  } catch (err) {
    mostrarMensajeAreas(err.message, "error");
  }
}

async function cargarPresentaciones() {
  const tbody = document.getElementById("tabla-presentaciones-body");
  if (!tbody) return;

  try {
    const res = await fetch(`${API_CONFIGURACION}/presentaciones`);
    const presentaciones = await res.json();
    if (!res.ok) throw new Error(presentaciones.error || "No se pudieron cargar las presentaciones");

    presentacionesActivas = presentaciones;

    if (!presentacionesActivas.length) {
      tbody.innerHTML = `<tr><td colspan="2" class="sin-datos">No hay presentaciones activas</td></tr>`;
      return;
    }

    tbody.innerHTML = presentacionesActivas.map(presentacion => `
      <tr>
        <td><strong>${esc(presentacion.nombre)}</strong></td>
        <td class="acciones">
          <button class="btn btn-editar" data-permiso="editar_configuracion" onclick="editarPresentacion(${presentacion.id})">Editar</button>
          <button class="btn btn-archivar" data-permiso="editar_configuracion" onclick="desactivarPresentacion(${presentacion.id})">Desactivar</button>
        </td>
      </tr>
    `).join("");
    if (window.aplicarPermisosVisuales) window.aplicarPermisosVisuales();
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="2" class="sin-datos">${esc(err.message)}</td></tr>`;
  }
}

function limpiarFormularioPresentacion() {
  presentacionEditandoId = null;
  document.getElementById("presentacion-nombre").value = "";
  document.getElementById("btn-guardar-presentacion").textContent = "Agregar presentacion";
  document.getElementById("btn-cancelar-presentacion").style.display = "none";
}

function editarPresentacion(id) {
  const presentacion = presentacionesActivas.find(p => Number(p.id) === Number(id));
  if (!presentacion) return;

  presentacionEditandoId = id;
  document.getElementById("presentacion-nombre").value = presentacion.nombre;
  document.getElementById("btn-guardar-presentacion").textContent = "Guardar presentacion";
  document.getElementById("btn-cancelar-presentacion").style.display = "inline-flex";
  mostrarMensajePresentaciones("");
}

async function guardarPresentacion() {
  const nombre = document.getElementById("presentacion-nombre").value.trim();
  const btn = document.getElementById("btn-guardar-presentacion");

  if (!nombre) {
    mostrarMensajePresentaciones("El nombre de la presentacion es obligatorio.", "error");
    return;
  }

  btn.disabled = true;

  try {
    const url = presentacionEditandoId
      ? `${API_CONFIGURACION}/presentaciones/${presentacionEditandoId}`
      : `${API_CONFIGURACION}/presentaciones`;

    const res = await fetch(url, {
      method: presentacionEditandoId ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "No se pudo guardar la presentacion");

    mostrarMensajePresentaciones(presentacionEditandoId ? "Presentacion actualizada correctamente." : "Presentacion agregada correctamente.");
    limpiarFormularioPresentacion();
    await cargarPresentaciones();
  } catch (err) {
    mostrarMensajePresentaciones(err.message, "error");
  } finally {
    btn.disabled = false;
  }
}

async function desactivarPresentacion(id) {
  const presentacion = presentacionesActivas.find(p => Number(p.id) === Number(id));
  if (!presentacion) return;

  if (!confirm(`Desactivar la presentacion "${presentacion.nombre}"?`)) return;

  try {
    const res = await fetch(`${API_CONFIGURACION}/presentaciones/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "No se pudo desactivar la presentacion");

    mostrarMensajePresentaciones("Presentacion desactivada correctamente.");
    await cargarPresentaciones();
  } catch (err) {
    mostrarMensajePresentaciones(err.message, "error");
  }
}

async function descargarBackup() {
  const btn = document.getElementById("btn-descargar-backup");
  btn.disabled = true;
  mostrarMensajeBackup("Preparando respaldo...");

  try {
    const res = await fetch(`${API_CONFIGURACION}/backup`);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "No se pudo descargar el respaldo.");
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const enlace = document.createElement("a");
    enlace.href = url;
    enlace.download = `backup-farmax-${new Date().toISOString().split("T")[0]}.db`;
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
    URL.revokeObjectURL(url);

    mostrarMensajeBackup("Respaldo descargado correctamente.");
  } catch (err) {
    mostrarMensajeBackup(err.message, "error");
  } finally {
    btn.disabled = false;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  cargarConfiguracion();
  cargarAreas();
  cargarPresentaciones();

  document.getElementById("btn-guardar-configuracion")
    .addEventListener("click", guardarConfiguracion);

  document.getElementById("btn-guardar-area")
    .addEventListener("click", guardarArea);

  document.getElementById("btn-cancelar-area")
    .addEventListener("click", () => {
      limpiarFormularioArea();
      mostrarMensajeAreas("");
    });

  document.getElementById("btn-guardar-presentacion")
    .addEventListener("click", guardarPresentacion);

  document.getElementById("btn-cancelar-presentacion")
    .addEventListener("click", () => {
      limpiarFormularioPresentacion();
      mostrarMensajePresentaciones("");
    });

  document.getElementById("btn-descargar-backup")
    .addEventListener("click", descargarBackup);
});
