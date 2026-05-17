// ============================================================
// routes/auditoria.js - Consulta del historial de auditoria
// ============================================================

const express = require("express");
const router = express.Router();
const db = require("../database");

function requireAdmin(req, res, next) {
  if (!req.session.usuario) {
    return res.status(401).json({ error: "No autenticado. Inicia sesion." });
  }
  if (req.session.usuario.rol !== "admin") {
    return res.status(403).json({ error: "Solo administradores pueden ver auditoria." });
  }
  next();
}

router.get("/", requireAdmin, (req, res) => {
  try {
    const { usuario, modulo, fecha } = req.query;
    const condiciones = [];
    const params = [];

    if (usuario) {
      condiciones.push("usuario LIKE ?");
      params.push(`%${usuario}%`);
    }
    if (modulo) {
      condiciones.push("modulo = ?");
      params.push(modulo);
    }
    if (fecha) {
      condiciones.push("date(fecha) = date(?)");
      params.push(fecha);
    }

    const where = condiciones.length ? `WHERE ${condiciones.join(" AND ")}` : "";
    const acciones = db.prepare(`
      SELECT id, usuario_id, usuario, accion, modulo, detalle, fecha
      FROM auditoria
      ${where}
      ORDER BY id DESC
      LIMIT 200
    `).all(...params);

    res.json(acciones);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
