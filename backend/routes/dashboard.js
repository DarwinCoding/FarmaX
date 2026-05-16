// backend/routes/dashboard.js
const express = require("express");
const router  = express.Router();
const db      = require("../database");

// GET /api/dashboard/resumen
router.get("/resumen", (req, res) => {
  try {
    const hoy      = new Date();
    const en30dias = new Date(hoy);
    en30dias.setDate(hoy.getDate() + 30);

    const fechaHoy   = hoy.toISOString().split("T")[0];
    const fecha30    = en30dias.toISOString().split("T")[0];

    const totalActivos     = db.prepare("SELECT COUNT(*) as c FROM medicamentos WHERE activo = 1").get().c;
    const stockBajo        = db.prepare("SELECT COUNT(*) as c FROM medicamentos WHERE activo = 1 AND stock < 5").get().c;
    const porCaducar       = db.prepare("SELECT COUNT(*) as c FROM medicamentos WHERE activo = 1 AND caducidad >= ? AND caducidad <= ?").get(fechaHoy, fecha30).c;
    const caducados        = db.prepare("SELECT COUNT(*) as c FROM medicamentos WHERE activo = 1 AND caducidad < ?").get(fechaHoy).c;
    const totalOrdenes     = db.prepare("SELECT COUNT(*) as c FROM ordenes").get().c;
    const totalEspeciales  = db.prepare("SELECT COUNT(*) as c FROM ordenes_especiales").get().c;

    res.json({ totalActivos, stockBajo, porCaducar, caducados, totalOrdenes, totalEspeciales });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/dashboard/ultimas-ordenes
router.get("/ultimas-ordenes", (req, res) => {
  try {
    const ordenes = db.prepare(`
      SELECT id, area, fecha, estado
      FROM ordenes
      ORDER BY id DESC
      LIMIT 5
    `).all();
    res.json(ordenes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/dashboard/ordenes-especiales-recientes
router.get("/ordenes-especiales-recientes", (req, res) => {
  try {
    const datos = db.prepare(`
      SELECT oe.fecha, oe.nombre_persona, oe.cantidad,
             m.nombre AS medicamento
      FROM ordenes_especiales oe
      JOIN medicamentos m ON m.id = oe.medicamento_id
      ORDER BY oe.id DESC
      LIMIT 5
    `).all();
    res.json(datos);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/dashboard/alertas
router.get("/alertas", (req, res) => {
  try {
    const hoy    = new Date();
    const en30   = new Date(hoy);
    en30.setDate(hoy.getDate() + 30);
    const fechaHoy = hoy.toISOString().split("T")[0];
    const fecha30  = en30.toISOString().split("T")[0];

    const stockBajo = db.prepare(`
      SELECT nombre, presentacion, stock
      FROM medicamentos
      WHERE activo = 1 AND stock < 5
      ORDER BY stock ASC
    `).all();

    const porCaducar = db.prepare(`
      SELECT nombre, presentacion, caducidad,
        CAST(julianday(caducidad) - julianday('now') AS INTEGER) AS dias_restantes
      FROM medicamentos
      WHERE activo = 1 AND caducidad >= ? AND caducidad <= ?
      ORDER BY caducidad ASC
    `).all(fechaHoy, fecha30);

    const caducados = db.prepare(`
      SELECT nombre, presentacion, caducidad,
        CAST(julianday('now') - julianday(caducidad) AS INTEGER) AS dias_vencido
      FROM medicamentos
      WHERE activo = 1 AND caducidad < ?
      ORDER BY caducidad ASC
    `).all(fechaHoy);

    res.json({ stockBajo, porCaducar, caducados });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
