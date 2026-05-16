// backend/routes/dashboard.js
const express = require("express");
const router  = express.Router();
const db      = require("../database");

const DEFAULTS = {
  stock_minimo_global: 5,
  dias_alerta_caducidad: 30
};

function leerNumeroConfig(clave) {
  const fila = db.prepare("SELECT valor FROM configuracion WHERE clave = ?").get(clave);
  const valor = Number(fila?.valor);
  return Number.isFinite(valor) ? valor : DEFAULTS[clave];
}

function leerConfiguracionGeneral() {
  return {
    stock_minimo_global: leerNumeroConfig("stock_minimo_global"),
    dias_alerta_caducidad: leerNumeroConfig("dias_alerta_caducidad")
  };
}

// GET /api/dashboard/resumen
router.get("/resumen", (req, res) => {
  try {
    const config = leerConfiguracionGeneral();
    const hoy      = new Date();
    const fechaAlerta = new Date(hoy);
    fechaAlerta.setDate(hoy.getDate() + config.dias_alerta_caducidad);

    const fechaHoy   = hoy.toISOString().split("T")[0];
    const fechaLimite = fechaAlerta.toISOString().split("T")[0];

    const totalActivos     = db.prepare("SELECT COUNT(*) as c FROM medicamentos WHERE activo = 1").get().c;
    const stockBajo        = db.prepare("SELECT COUNT(*) as c FROM medicamentos WHERE activo = 1 AND stock < ?").get(config.stock_minimo_global).c;
    const porCaducar       = db.prepare("SELECT COUNT(*) as c FROM medicamentos WHERE activo = 1 AND caducidad >= ? AND caducidad <= ?").get(fechaHoy, fechaLimite).c;
    const caducados        = db.prepare("SELECT COUNT(*) as c FROM medicamentos WHERE activo = 1 AND caducidad < ?").get(fechaHoy).c;
    const totalOrdenes     = db.prepare("SELECT COUNT(*) as c FROM ordenes").get().c;
    const totalEspeciales  = db.prepare("SELECT COUNT(*) as c FROM ordenes_especiales").get().c;

    res.json({ totalActivos, stockBajo, porCaducar, caducados, totalOrdenes, totalEspeciales, configuracion: config });
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
    const config = leerConfiguracionGeneral();
    const hoy    = new Date();
    const fechaAlerta = new Date(hoy);
    fechaAlerta.setDate(hoy.getDate() + config.dias_alerta_caducidad);
    const fechaHoy = hoy.toISOString().split("T")[0];
    const fechaLimite = fechaAlerta.toISOString().split("T")[0];

    const stockBajo = db.prepare(`
      SELECT nombre, presentacion, stock
      FROM medicamentos
      WHERE activo = 1 AND stock < ?
      ORDER BY stock ASC
    `).all(config.stock_minimo_global);

    const porCaducar = db.prepare(`
      SELECT nombre, presentacion, caducidad,
        CAST(julianday(caducidad) - julianday('now') AS INTEGER) AS dias_restantes
      FROM medicamentos
      WHERE activo = 1 AND caducidad >= ? AND caducidad <= ?
      ORDER BY caducidad ASC
    `).all(fechaHoy, fechaLimite);

    const caducados = db.prepare(`
      SELECT nombre, presentacion, caducidad,
        CAST(julianday('now') - julianday(caducidad) AS INTEGER) AS dias_vencido
      FROM medicamentos
      WHERE activo = 1 AND caducidad < ?
      ORDER BY caducidad ASC
    `).all(fechaHoy);

    res.json({ stockBajo, porCaducar, caducados, configuracion: config });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
