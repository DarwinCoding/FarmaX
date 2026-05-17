// ============================================================
// auditoria.js - Registro centralizado de acciones importantes
// ============================================================

const db = require("./database");

function datosUsuario(req) {
  const usuario = req?.session?.usuario;
  return {
    usuario_id: usuario?.id || null,
    usuario: usuario?.username || "Sistema"
  };
}

function registrarAuditoria(req, accion, modulo, detalle) {
  try {
    const usuario = datosUsuario(req);
    db.prepare(`
      INSERT INTO auditoria (usuario_id, usuario, accion, modulo, detalle)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      usuario.usuario_id,
      usuario.usuario,
      accion,
      modulo,
      detalle || ""
    );
  } catch (err) {
    console.error("Error registrando auditoria:", err.message);
  }
}

module.exports = {
  registrarAuditoria
};
