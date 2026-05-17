// ============================================================
// permisos.js - Infraestructura base de permisos por usuario
// ============================================================

const db = require("./database");

const TODOS_LOS_PERMISOS = [
  "ver_inventario",
  "crear_medicamento",
  "editar_medicamento",
  "modificar_stock",
  "desactivar_medicamento",
  "ver_ordenes",
  "crear_ordenes",
  "despachar_ordenes",
  "eliminar_ordenes",
  "ver_ordenes_especiales",
  "crear_ordenes_especiales",
  "eliminar_ordenes_especiales",
  "ver_reportes",
  "exportar_reportes_excel",
  "ver_usuarios",
  "crear_usuarios",
  "editar_usuarios",
  "eliminar_usuarios",
  "ver_configuracion",
  "editar_configuracion",
  "descargar_backup",
  "ver_dashboard"
];

function obtenerPermisosUsuario(usuario) {
  if (!usuario) return [];
  if (usuario.rol === "admin") return [...TODOS_LOS_PERMISOS];

  return db.prepare(`
    SELECT permiso
    FROM usuarios_permisos
    WHERE usuario_id = ? AND activo = 1
    ORDER BY permiso ASC
  `).all(usuario.id).map(fila => fila.permiso);
}

function usuarioTienePermiso(usuario, permiso) {
  if (!usuario || !permiso) return false;
  if (usuario.rol === "admin") return true;
  return obtenerPermisosUsuario(usuario).includes(permiso);
}

module.exports = {
  TODOS_LOS_PERMISOS,
  obtenerPermisosUsuario,
  usuarioTienePermiso
};
