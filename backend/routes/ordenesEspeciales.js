// ============================================================
// routes/ordenesEspeciales.js - Órdenes Especiales (Nuevo módulo)
// ============================================================
// RUTAS:
//   GET    /api/ordenes-especiales           → lista todas las órdenes especiales
//   POST   /api/ordenes-especiales           → crea una orden especial y descuenta stock
//   DELETE /api/ordenes-especiales/:id       → elimina (solo admin)
// ============================================================

const express = require("express");
const router  = express.Router();
const db      = require("../database");

// ── GET /api/ordenes-especiales ──────────────────────────────
// Devuelve todas las órdenes especiales con el nombre del medicamento
router.get("/", (req, res) => {
  try {
    const ordenes = db.prepare(`
      SELECT
        oe.id,
        oe.nombre_persona,
        oe.tipo_persona,
        oe.cantidad,
        oe.fecha,
        oe.observacion,
        oe.creado_en,
        m.nombre   AS medicamento_nombre,
        m.presentacion
      FROM ordenes_especiales oe
      JOIN medicamentos m ON m.id = oe.medicamento_id
      ORDER BY oe.fecha DESC, oe.id DESC
    `).all();

    res.json(ordenes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/ordenes-especiales ────────────────────────────
// Crea una orden especial y descuenta del stock
router.post("/", (req, res) => {
  // Extraemos los campos del cuerpo de la petición
  const { nombre_persona, tipo_persona, medicamento_id, cantidad, fecha, observacion } = req.body;

  // ── Validaciones básicas ──
  if (!nombre_persona || !nombre_persona.trim()) {
    return res.status(400).json({ error: "El nombre de la persona es obligatorio." });
  }
  if (!tipo_persona || !["médico", "personal"].includes(tipo_persona)) {
    return res.status(400).json({ error: "El tipo de persona debe ser 'médico' o 'personal'." });
  }
  if (!medicamento_id) {
    return res.status(400).json({ error: "El medicamento es obligatorio." });
  }
  if (!cantidad || cantidad <= 0) {
    return res.status(400).json({ error: "La cantidad debe ser mayor a 0." });
  }
  if (!fecha) {
    return res.status(400).json({ error: "La fecha es obligatoria." });
  }

  try {
    // Verificamos que el medicamento exista
    const medicamento = db.prepare("SELECT * FROM medicamentos WHERE id = ?").get(medicamento_id);
    if (!medicamento) {
      return res.status(404).json({ error: "Medicamento no encontrado." });
    }

    // Verificamos que haya stock suficiente
    if (medicamento.stock < cantidad) {
      return res.status(400).json({
        error: `Stock insuficiente. Disponible: ${medicamento.stock}, solicitado: ${cantidad}.`
      });
    }

    // Usamos una transacción para que todo se ejecute junto (o nada)
    // Si algo falla, no se descuenta el stock ni se guarda la orden
    const transaccion = db.transaction(() => {
      // 1. Descontar stock
      db.prepare("UPDATE medicamentos SET stock = stock - ? WHERE id = ?")
        .run(cantidad, medicamento_id);

      // 2. Guardar la orden especial
      const resultado = db.prepare(`
        INSERT INTO ordenes_especiales (nombre_persona, tipo_persona, medicamento_id, cantidad, fecha, observacion)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        nombre_persona.trim(),
        tipo_persona,
        medicamento_id,
        cantidad,
        fecha,
        observacion || null  // observacion es opcional
      );

      return resultado.lastInsertRowid;
    });

    const nuevoId = transaccion();

    // Devolvemos la orden recién creada
    const nueva = db.prepare(`
      SELECT oe.*, m.nombre AS medicamento_nombre, m.presentacion
      FROM ordenes_especiales oe
      JOIN medicamentos m ON m.id = oe.medicamento_id
      WHERE oe.id = ?
    `).get(nuevoId);

    res.status(201).json(nueva);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/ordenes-especiales/:id ──────────────────────
// Elimina una orden especial (solo admin, verificado en server.js)
router.delete("/:id", (req, res) => {
  const { id } = req.params;

  try {
    // Verificamos que la orden exista antes de eliminar
    const orden = db.prepare("SELECT * FROM ordenes_especiales WHERE id = ?").get(id);
    if (!orden) {
      return res.status(404).json({ error: "Orden especial no encontrada." });
    }

    // NOTA: No reponemos el stock al eliminar (decisión de diseño).
    // Si necesitas reponer stock al borrar, descomenta las líneas siguientes:
    // db.prepare("UPDATE medicamentos SET stock = stock + ? WHERE id = ?")
    //   .run(orden.cantidad, orden.medicamento_id);

    db.prepare("DELETE FROM ordenes_especiales WHERE id = ?").run(id);
    res.json({ mensaje: "Orden especial eliminada correctamente.", id: Number(id) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
