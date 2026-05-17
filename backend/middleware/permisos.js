// ============================================================
// middleware/permisos.js - Validacion backend de permisos
// ============================================================

const { usuarioTienePermiso } = require("../permisos");

function requirePermiso(permiso) {
  return (req, res, next) => {
    const usuario = req.session?.usuario;

    if (!usuario) {
      return res.status(401).json({ error: "No autenticado. Inicia sesion." });
    }

    if (usuario.rol === "admin") {
      return next();
    }

    if (!usuarioTienePermiso(usuario, permiso)) {
      return res.status(403).json({
        error: "No tienes permiso para realizar esta accion.",
        permiso_requerido: permiso
      });
    }

    next();
  };
}

function requirePermisoAny(permisos) {
  return (req, res, next) => {
    const usuario = req.session?.usuario;

    if (!usuario) {
      return res.status(401).json({ error: "No autenticado. Inicia sesion." });
    }

    if (usuario.rol === "admin") {
      return next();
    }

    const tieneAlguno = permisos.some(permiso => usuarioTienePermiso(usuario, permiso));
    if (!tieneAlguno) {
      return res.status(403).json({
        error: "No tienes permiso para realizar esta accion.",
        permisos_requeridos: permisos
      });
    }

    next();
  };
}

module.exports = {
  requirePermiso,
  requirePermisoAny
};
