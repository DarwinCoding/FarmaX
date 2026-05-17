// ============================================================
// usuarios.js - Gestión de usuarios (solo admin)
// ============================================================

const API = "/api/usuarios";
let editandoUsuarioId = null;

const PERMISOS_GRUPOS = [
  {
    titulo: "Inventario",
    permisos: [
      ["Ver inventario", "ver_inventario"],
      ["Crear medicamento", "crear_medicamento"],
      ["Editar medicamento", "editar_medicamento"],
      ["Modificar stock", "modificar_stock"],
      ["Desactivar medicamento", "desactivar_medicamento"]
    ]
  },
  {
    titulo: "Ordenes",
    permisos: [
      ["Ver ordenes", "ver_ordenes"],
      ["Crear ordenes", "crear_ordenes"],
      ["Despachar ordenes", "despachar_ordenes"],
      ["Eliminar ordenes", "eliminar_ordenes"]
    ]
  },
  {
    titulo: "Ordenes Especiales",
    permisos: [
      ["Ver ordenes especiales", "ver_ordenes_especiales"],
      ["Crear ordenes especiales", "crear_ordenes_especiales"],
      ["Eliminar ordenes especiales", "eliminar_ordenes_especiales"]
    ]
  },
  {
    titulo: "Reportes",
    permisos: [
      ["Ver reportes", "ver_reportes"],
      ["Exportar reportes Excel", "exportar_reportes_excel"]
    ]
  },
  {
    titulo: "Usuarios",
    permisos: [
      ["Ver usuarios", "ver_usuarios"],
      ["Crear usuarios", "crear_usuarios"],
      ["Editar usuarios", "editar_usuarios"],
      ["Eliminar usuarios", "eliminar_usuarios"]
    ]
  },
  {
    titulo: "Configuracion",
    permisos: [
      ["Ver configuracion", "ver_configuracion"],
      ["Editar configuracion", "editar_configuracion"],
      ["Descargar backup", "descargar_backup"]
    ]
  },
  {
    titulo: "Dashboard",
    permisos: [
      ["Ver dashboard", "ver_dashboard"]
    ]
  }
];

// ── Utilidades ──
function esc(t) {
  const d = document.createElement("div");
  d.textContent = String(t ?? "");
  return d.innerHTML;
}

function toast(msg, tipo = "ok") {
  const c = document.getElementById("toast-contenedor");
  const t = document.createElement("div");
  t.className = `toast ${tipo === "error" ? "error" : ""}`;
  t.textContent = msg;
  c.appendChild(t);
  setTimeout(() => { t.style.opacity="0"; t.style.transition="opacity .4s"; setTimeout(()=>t.remove(),400); }, 3500);
}

function fmtFecha(str) {
  if (!str) return "-";
  return new Date(str).toLocaleDateString("es-EC", {day:"2-digit",month:"short",year:"numeric"});
}

function puedeAccionUsuario(permiso) {
  return !window.tienePermiso || window.tienePermiso(permiso);
}

function renderPermisosUsuario() {
  const contenedor = document.getElementById("u-permisos-lista");
  if (!contenedor) return;

  contenedor.innerHTML = PERMISOS_GRUPOS.map(grupo => `
    <fieldset class="permisos-grupo">
      <legend>${esc(grupo.titulo)}</legend>
      ${grupo.permisos.map(([label, valor]) => `
        <label class="permiso-check">
          <input type="checkbox" value="${valor}" data-permiso/>
          <span>${esc(label)}</span>
        </label>
      `).join("")}
    </fieldset>
  `).join("");
}

function obtenerPermisosSeleccionados() {
  return [...document.querySelectorAll("[data-permiso]:checked")]
    .map(input => input.value);
}

function marcarPermisos(permisos = []) {
  const seleccionados = new Set(permisos);
  document.querySelectorAll("[data-permiso]").forEach(input => {
    input.checked = seleccionados.has(input.value);
  });
}

function actualizarEstadoPermisos() {
  const rol = document.getElementById("u-rol").value;
  const esAdmin = rol === "admin";
  const aviso = document.getElementById("u-permisos-admin-aviso");
  const lista = document.getElementById("u-permisos-lista");

  if (aviso) aviso.style.display = esAdmin ? "block" : "none";
  if (lista) lista.classList.toggle("permisos-deshabilitados", esAdmin);

  document.querySelectorAll("[data-permiso]").forEach(input => {
    input.disabled = esAdmin;
    if (esAdmin) input.checked = false;
  });
}

// ── Cargar y renderizar usuarios ──
async function cargarUsuarios() {
  const tbody = document.getElementById("tabla-usuarios-body");
  try {
    const lista = await fetch(API).then(r => {
      if (!r.ok) throw new Error("Sin acceso");
      return r.json();
    });

    if (lista.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" class="sin-datos">No hay usuarios</td></tr>`;
      return;
    }

    tbody.innerHTML = lista.map(u => {
      const rolBadge = u.rol === "admin"
        ? `<span class="badge badge-admin" style="padding:.2rem .6rem;border-radius:20px;font-size:.75rem">👑 Admin</span>`
        : `<span class="badge badge-usuario" style="padding:.2rem .6rem;border-radius:20px;font-size:.75rem">👤 Usuario</span>`;

      const esMiUsuario = window.usuarioActual && window.usuarioActual.id === u.id;
      const puedeEditar = !window.tienePermiso || window.tienePermiso("editar_usuarios");
      const puedeEliminar = !window.tienePermiso || window.tienePermiso("eliminar_usuarios");

      return `
        <tr>
          <td style="padding:.75rem 1rem;color:var(--gris-texto);font-size:.85rem">${u.id}</td>
          <td style="padding:.75rem 1rem">
            <strong>${esc(u.username)}</strong>
            ${esMiUsuario ? `<span style="font-size:.75rem;color:var(--verde-claro);margin-left:.4rem">(tú)</span>` : ""}
          </td>
          <td style="padding:.75rem 1rem">${rolBadge}</td>
          <td style="padding:.75rem 1rem;font-size:.82rem;color:var(--gris-texto)">${fmtFecha(u.creado_en)}</td>
          <td style="padding:.75rem 1rem">
            <div style="display:flex;gap:.4rem">
              <button class="btn btn-editar" onclick="abrirEdicionUsuario(${u.id})">✏ Editar</button>
              ${!esMiUsuario
                ? `<button class="btn btn-eliminar" onclick="eliminarUsuario(${u.id}, '${esc(u.username)}')">🗑</button>`
                : `<button class="btn btn-secundario" disabled style="opacity:.4;cursor:default">🗑</button>`
              }
            </div>
          </td>
        </tr>`;
    }).join("");
    if (!puedeAccionUsuario("editar_usuarios")) {
      tbody.querySelectorAll("button[onclick^='abrirEdicionUsuario']").forEach(btn => btn.remove());
    }
    if (!puedeAccionUsuario("eliminar_usuarios")) {
      tbody.querySelectorAll("button[onclick^='eliminarUsuario']").forEach(btn => btn.remove());
    }
    if (window.aplicarPermisosVisuales) window.aplicarPermisosVisuales();
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="5" style="padding:2rem;text-align:center;color:var(--rojo)">❌ ${err.message}</td></tr>`;
  }
}

// ── Modal: abrir para crear ──
function abrirModalNuevoUsuario() {
  editandoUsuarioId = null;
  document.getElementById("modal-usuario-titulo").textContent = "Nuevo Usuario";
  document.getElementById("u-username").value   = "";
  document.getElementById("u-password").value   = "";
  document.getElementById("u-rol").value        = "usuario";
  document.getElementById("u-error").style.display = "none";
  document.getElementById("u-username").removeAttribute("disabled");
  document.getElementById("u-password-hint").style.display = "none";
  marcarPermisos([]);
  actualizarEstadoPermisos();
  mostrarModal();
}

// ── Modal: abrir para editar ──
async function abrirEdicionUsuario(id) {
  editandoUsuarioId = id;
  try {
    const u = await fetch(`${API}/${id}`).then(async r => {
      if (!r.ok) { const e = await r.json(); throw new Error(e.error); }
      return r.json();
    });
    if (!u) return;
    document.getElementById("modal-usuario-titulo").textContent = `Editar Usuario: ${u.username}`;
    document.getElementById("u-username").value  = u.username;
    document.getElementById("u-username").setAttribute("disabled","");
    document.getElementById("u-password").value  = "";
    document.getElementById("u-rol").value       = u.rol;
    document.getElementById("u-error").style.display = "none";
    document.getElementById("u-password-hint").style.display = "inline";
    marcarPermisos(u.permisos || []);
    actualizarEstadoPermisos();
    mostrarModal();
  } catch (err) { toast("❌ " + err.message, "error"); }
}

function mostrarModal() {
  const overlay = document.getElementById("modal-usuario-overlay");
  overlay.style.display = "flex";
}

function cerrarModalUsuario() {
  document.getElementById("modal-usuario-overlay").style.display = "none";
}

// ── Guardar usuario (crear o editar) ──
async function guardarUsuario() {
  const errorDiv = document.getElementById("u-error");
  errorDiv.style.display = "none";

  const username = document.getElementById("u-username").value.trim();
  const password = document.getElementById("u-password").value;
  const rol      = document.getElementById("u-rol").value;
  const permisos = rol === "admin" ? [] : obtenerPermisosSeleccionados();

  try {
    if (editandoUsuarioId === null) {
      // CREAR
      if (!username || !password) {
        errorDiv.textContent = "Usuario y contraseña son obligatorios";
        errorDiv.style.display = "block";
        return;
      }
      await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, rol, permisos })
      }).then(async r => {
        if (!r.ok) { const e = await r.json(); throw new Error(e.error); }
        return r.json();
      });
      toast("✅ Usuario creado");
    } else {
      // EDITAR (solo rol y opcionalmente contraseña)
      const body = { rol, permisos };
      if (password) body.password = password;
      await fetch(`${API}/${editandoUsuarioId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      }).then(async r => {
        if (!r.ok) { const e = await r.json(); throw new Error(e.error); }
        return r.json();
      });
      toast("✅ Usuario actualizado");
    }
    cerrarModalUsuario();
    cargarUsuarios();
  } catch (err) {
    errorDiv.textContent = "❌ " + err.message;
    errorDiv.style.display = "block";
  }
}

// ── Eliminar usuario con confirmación ──
async function eliminarUsuario(id, nombre) {
  if (!confirm(`¿Eliminar al usuario "${nombre}"? Esta acción no se puede deshacer.`)) return;
  try {
    await fetch(`${API}/${id}`, { method: "DELETE" }).then(async r => {
      if (!r.ok) { const e = await r.json(); throw new Error(e.error); }
    });
    toast("🗑 Usuario eliminado");
    cargarUsuarios();
  } catch (err) {
    toast("❌ " + err.message, "error");
  }
}

// ── Cerrar modal al hacer clic fuera ──
document.getElementById("modal-usuario-overlay").addEventListener("click", (e) => {
  if (e.target.id === "modal-usuario-overlay") cerrarModalUsuario();
});

// ── Init ──
document.addEventListener("DOMContentLoaded", () => {
  renderPermisosUsuario();
  document.getElementById("u-rol").addEventListener("change", actualizarEstadoPermisos);
  actualizarEstadoPermisos();
  cargarUsuarios();
});
