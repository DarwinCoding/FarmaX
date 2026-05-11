// ============================================================
// routes/ordenes.js — Rutas de Órdenes de Despacho
// ============================================================
// RUTAS DISPONIBLES:
//   POST   /api/ordenes                    → crear orden nueva
//   GET    /api/ordenes                    → listar todas las órdenes
//   GET    /api/ordenes/:id                → ver una orden con su detalle
//   POST   /api/ordenes/:id/detalle        → agregar medicamento a una orden
//   PUT    /api/detalle/:id                → editar cantidad entregada
//   DELETE /api/detalle/:id                → eliminar línea del detalle
//   POST   /api/ordenes/:id/despachar      → confirmar despacho (descuenta stock)
// ============================================================

const express = require("express");
const router  = express.Router();
const db      = require("../database"); // Misma BD que usa medicamentos.js

// ──────────────────────────────────────────────
// POST /api/ordenes
// Crea una nueva orden vacía (sin detalle todavía)
// ──────────────────────────────────────────────
router.post("/", (req, res) => {
  try {
    const { area } = req.body;

    // Validamos que se envíe el área
    if (!area) {
      return res.status(400).json({ error: "El área es obligatoria" });
    }

    // Solo permitimos áreas conocidas
    const areasValidas = ["Hospitalización", "Quirófano", "Emergencias", "Consulta Externa"];
    if (!areasValidas.includes(area)) {
      return res.status(400).json({ error: "Área no válida" });
    }

    const stmt   = db.prepare("INSERT INTO ordenes (area) VALUES (?)");
    const result = stmt.run(area);

    res.status(201).json({
      message: "Orden creada",
      id: result.lastInsertRowid
    });
  } catch (err) {
    res.status(500).json({ error: "Error al crear orden: " + err.message });
  }
});

// ──────────────────────────────────────────────
// GET /api/ordenes
// Lista todas las órdenes (más recientes primero)
// ──────────────────────────────────────────────
router.get("/", (req, res) => {
  try {
    // Traemos las órdenes junto con cuántos ítems tiene cada una
    const ordenes = db.prepare(`
      SELECT
        o.*,
        COUNT(d.id) AS total_items
      FROM ordenes o
      LEFT JOIN detalle_orden d ON d.orden_id = o.id
      GROUP BY o.id
      ORDER BY o.id DESC
    `).all();

    res.json(ordenes);
  } catch (err) {
    res.status(500).json({ error: "Error al listar órdenes: " + err.message });
  }
});

// ──────────────────────────────────────────────
// GET /api/ordenes/:id
// Devuelve UNA orden con todo su detalle de medicamentos
// ──────────────────────────────────────────────
router.get("/:id", (req, res) => {
  try {
    const { id } = req.params;

    // Buscamos la orden
    const orden = db.prepare("SELECT * FROM ordenes WHERE id = ?").get(id);
    if (!orden) {
      return res.status(404).json({ error: "Orden no encontrada" });
    }

    // Buscamos el detalle de esa orden, incluyendo datos del medicamento
    const detalle = db.prepare(`
      SELECT
        d.id,
        d.orden_id,
        d.medicamento_id,
        d.cantidad_solicitada,
        d.cantidad_entregada,
        m.nombre,
        m.presentacion,
        m.stock AS stock_actual    -- Stock en tiempo real del medicamento
      FROM detalle_orden d
      JOIN medicamentos m ON m.id = d.medicamento_id
      WHERE d.orden_id = ?
      ORDER BY d.id ASC
    `).all(id);

    // Devolvemos la orden con su detalle incrustado
    res.json({ ...orden, detalle });

  } catch (err) {
    res.status(500).json({ error: "Error al obtener orden: " + err.message });
  }
});

// ──────────────────────────────────────────────
// POST /api/ordenes/:id/detalle
// Agrega un medicamento a la orden (una línea del carrito)
// ──────────────────────────────────────────────
router.post("/:id/detalle", (req, res) => {
  try {
    const orden_id = req.params.id;
    const { medicamento_id, cantidad_solicitada } = req.body;

    // Verificamos que la orden exista y esté pendiente
    const orden = db.prepare("SELECT * FROM ordenes WHERE id = ?").get(orden_id);
    if (!orden) {
      return res.status(404).json({ error: "Orden no encontrada" });
    }
    if (orden.estado === "completada") {
      return res.status(400).json({ error: "No se puede modificar una orden ya despachada" });
    }

    // Verificamos que el medicamento exista
    const med = db.prepare("SELECT * FROM medicamentos WHERE id = ?").get(medicamento_id);
    if (!med) {
      return res.status(404).json({ error: "Medicamento no encontrado" });
    }

    // Validamos la cantidad
    if (!cantidad_solicitada || Number(cantidad_solicitada) <= 0) {
      return res.status(400).json({ error: "La cantidad debe ser mayor a 0" });
    }

    // Verificamos si el medicamento YA está en esta orden (evitar duplicados)
    const yaExiste = db.prepare(`
      SELECT id FROM detalle_orden
      WHERE orden_id = ? AND medicamento_id = ?
    `).get(orden_id, medicamento_id);

    if (yaExiste) {
      return res.status(400).json({ error: "Este medicamento ya está en la orden. Edita la cantidad existente." });
    }

    // Insertamos la línea en el detalle
    // La cantidad_entregada empieza igual a la solicitada (se puede ajustar luego)
    const stmt = db.prepare(`
      INSERT INTO detalle_orden (orden_id, medicamento_id, cantidad_solicitada, cantidad_entregada)
      VALUES (?, ?, ?, ?)
    `);
    const result = stmt.run(orden_id, medicamento_id, Number(cantidad_solicitada), Number(cantidad_solicitada));

    res.status(201).json({
      message: "Medicamento agregado a la orden",
      id: result.lastInsertRowid
    });
  } catch (err) {
    res.status(500).json({ error: "Error al agregar detalle: " + err.message });
  }
});

// ──────────────────────────────────────────────
// PUT /api/detalle/:id
// Actualiza la cantidad entregada de una línea del carrito
// ──────────────────────────────────────────────
router.put("/detalle/:id", (req, res) => {
  try {
    const { id } = req.params;
    const { cantidad_entregada } = req.body;

    // Buscamos la línea del detalle y la orden a la que pertenece
    const linea = db.prepare(`
      SELECT d.*, o.estado, m.stock
      FROM detalle_orden d
      JOIN ordenes o ON o.id = d.orden_id
      JOIN medicamentos m ON m.id = d.medicamento_id
      WHERE d.id = ?
    `).get(id);

    if (!linea) {
      return res.status(404).json({ error: "Línea de detalle no encontrada" });
    }
    if (linea.estado === "completada") {
      return res.status(400).json({ error: "No se puede modificar una orden ya despachada" });
    }
    if (Number(cantidad_entregada) < 0) {
      return res.status(400).json({ error: "La cantidad no puede ser negativa" });
    }
    // Validamos que no se entregue más de lo disponible en stock
    if (Number(cantidad_entregada) > linea.stock) {
      return res.status(400).json({
        error: `Stock insuficiente. Solo hay ${linea.stock} unidades disponibles.`
      });
    }

    db.prepare("UPDATE detalle_orden SET cantidad_entregada = ? WHERE id = ?")
      .run(Number(cantidad_entregada), id);

    res.json({ message: "Cantidad actualizada" });
  } catch (err) {
    res.status(500).json({ error: "Error al actualizar detalle: " + err.message });
  }
});

// ──────────────────────────────────────────────
// DELETE /api/ordenes/detalle/:id
// Elimina una línea del carrito
// ──────────────────────────────────────────────
router.delete("/detalle/:id", (req, res) => {
  try {
    const { id } = req.params;

    // Verificamos que la línea exista y la orden esté pendiente
    const linea = db.prepare(`
      SELECT d.*, o.estado
      FROM detalle_orden d
      JOIN ordenes o ON o.id = d.orden_id
      WHERE d.id = ?
    `).get(id);

    if (!linea) {
      return res.status(404).json({ error: "Línea no encontrada" });
    }
    if (linea.estado === "completada") {
      return res.status(400).json({ error: "No se puede modificar una orden ya despachada" });
    }

    db.prepare("DELETE FROM detalle_orden WHERE id = ?").run(id);
    res.json({ message: "Línea eliminada" });
  } catch (err) {
    res.status(500).json({ error: "Error al eliminar línea: " + err.message });
  }
});

// ──────────────────────────────────────────────
// POST /api/ordenes/:id/despachar
// Confirma el despacho: descuenta stock y cierra la orden
//
// ⚠ ESTA ES LA OPERACIÓN MÁS IMPORTANTE:
//   Usamos una "transacción" para que si algo falla en el
//   medio, NADA se guarde (todo o nada). Así no quedan
//   stocks descubiertos por error.
// ──────────────────────────────────────────────
router.post("/:id/despachar", (req, res) => {
  try {
    const { id } = req.params;

    // Verificamos que la orden exista y esté pendiente
    const orden = db.prepare("SELECT * FROM ordenes WHERE id = ?").get(id);
    if (!orden) {
      return res.status(404).json({ error: "Orden no encontrada" });
    }
    if (orden.estado === "completada") {
      return res.status(400).json({ error: "Esta orden ya fue despachada" });
    }

    // Traemos todo el detalle de la orden con el stock actual de cada medicamento
    const detalle = db.prepare(`
      SELECT d.*, m.stock, m.nombre
      FROM detalle_orden d
      JOIN medicamentos m ON m.id = d.medicamento_id
      WHERE d.orden_id = ?
    `).all(id);

    if (detalle.length === 0) {
      return res.status(400).json({ error: "La orden no tiene medicamentos. Agrega al menos uno antes de despachar." });
    }

    // Validación previa: revisamos TODOS los medicamentos antes de tocar el stock
    const errores = [];
    for (const linea of detalle) {
      if (linea.cantidad_entregada > linea.stock) {
        errores.push(`"${linea.nombre}": se quieren entregar ${linea.cantidad_entregada} pero solo hay ${linea.stock} en stock`);
      }
    }

    // Si hay algún error de stock, no despachamos nada
    if (errores.length > 0) {
      return res.status(400).json({
        error: "Stock insuficiente para algunos medicamentos",
        detalle: errores
      });
    }

    // ── Transacción: todo pasa o nada pasa ──
    // db.transaction() crea una función que SQLite ejecuta como bloque atómico.
    const despachar = db.transaction(() => {
      // Descontamos el stock de cada medicamento según la cantidad ENTREGADA
      for (const linea of detalle) {
        if (linea.cantidad_entregada > 0) {
          db.prepare(`
            UPDATE medicamentos
            SET stock = stock - ?
            WHERE id = ?
          `).run(linea.cantidad_entregada, linea.medicamento_id);
        }
      }

      // Marcamos la orden como completada
      db.prepare("UPDATE ordenes SET estado = 'completada' WHERE id = ?").run(id);
    });

    // Ejecutamos la transacción
    despachar();

    res.json({ message: "Orden despachada correctamente. Stock actualizado." });

  } catch (err) {
    res.status(500).json({ error: "Error al despachar: " + err.message });
  }
});

module.exports = router;
