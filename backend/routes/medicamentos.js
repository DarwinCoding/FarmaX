// ============================================================
// routes/medicamentos.js - Rutas CRUD para medicamentos
// ============================================================
// Aquí definimos qué pasa cuando el frontend llama a la API.
// CRUD = Create (crear), Read (leer), Update (editar), Delete (eliminar)
//
// Rutas disponibles:
//   GET    /api/medicamentos         → listar todos
//   GET    /api/medicamentos/:id     → obtener uno por ID
//   POST   /api/medicamentos         → crear nuevo
//   PUT    /api/medicamentos/:id     → editar uno existente
//   DELETE /api/medicamentos/:id     → eliminar uno
// ============================================================

const express = require("express");
const router = express.Router();       // Router es como un mini-servidor para este grupo de rutas
const db = require("../database");     // Importamos la conexión a la base de datos

// ──────────────────────────────────────────────
// GET /api/medicamentos
// Devuelve TODOS los medicamentos ordenados por nombre
// ──────────────────────────────────────────────
router.get("/", (req, res) => {
  try {
    // .prepare() crea una consulta SQL lista para ejecutar
    const stmt = db.prepare("SELECT * FROM medicamentos ORDER BY nombre ASC");
    const medicamentos = stmt.all(); // .all() devuelve un array con todos los resultados
    res.json(medicamentos);          // Enviamos la respuesta en formato JSON
  } catch (err) {
    // Si algo falla, enviamos un error 500 (error de servidor)
    res.status(500).json({ error: "Error al obtener medicamentos: " + err.message });
  }
});

// ──────────────────────────────────────────────
// GET /api/medicamentos/:id
// Devuelve UN medicamento por su ID
// ──────────────────────────────────────────────
router.get("/:id", (req, res) => {
  try {
    const { id } = req.params; // Extraemos el ID de la URL (ej: /api/medicamentos/3)
    const stmt = db.prepare("SELECT * FROM medicamentos WHERE id = ?");
    const medicamento = stmt.get(id); // .get() devuelve un solo resultado o undefined

    if (!medicamento) {
      // Si no se encontró, devolvemos error 404 (no encontrado)
      return res.status(404).json({ error: "Medicamento no encontrado" });
    }

    res.json(medicamento);
  } catch (err) {
    res.status(500).json({ error: "Error al buscar medicamento: " + err.message });
  }
});

// ──────────────────────────────────────────────
// POST /api/medicamentos
// Crea un NUEVO medicamento
// El frontend envía los datos en el cuerpo (body) de la petición
// ──────────────────────────────────────────────
router.post("/", (req, res) => {
  try {
    // Extraemos los campos que llegaron en el body del request
    const { nombre, presentacion, stock, caducidad, lote } = req.body;

    // Validación básica: todos los campos son obligatorios
    if (!nombre || !presentacion || stock === undefined || !caducidad || !lote) {
      return res.status(400).json({ error: "Todos los campos son obligatorios" });
    }

    // Validamos que el stock sea un número positivo
    if (isNaN(stock) || Number(stock) < 0) {
      return res.status(400).json({ error: "El stock debe ser un número mayor o igual a 0" });
    }

    // Insertamos el nuevo medicamento en la base de datos
    // Los "?" son parámetros seguros (evitan inyección SQL)
    const stmt = db.prepare(`
      INSERT INTO medicamentos (nombre, presentacion, stock, caducidad, lote)
      VALUES (?, ?, ?, ?, ?)
    `);

    const result = stmt.run(nombre.trim(), presentacion.trim(), Number(stock), caducidad, lote.trim());

    // Respondemos con el ID del nuevo registro y código 201 (Created)
    res.status(201).json({
      message: "Medicamento agregado exitosamente",
      id: result.lastInsertRowid
    });
  } catch (err) {
    res.status(500).json({ error: "Error al crear medicamento: " + err.message });
  }
});

// ──────────────────────────────────────────────
// PUT /api/medicamentos/:id
// Actualiza un medicamento EXISTENTE por su ID
// ──────────────────────────────────────────────
router.put("/:id", (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, presentacion, stock, caducidad, lote } = req.body;

    // Verificamos que el medicamento exista antes de editarlo
    const existe = db.prepare("SELECT id FROM medicamentos WHERE id = ?").get(id);
    if (!existe) {
      return res.status(404).json({ error: "Medicamento no encontrado" });
    }

    // Validación de campos
    if (!nombre || !presentacion || stock === undefined || !caducidad || !lote) {
      return res.status(400).json({ error: "Todos los campos son obligatorios" });
    }

    if (isNaN(stock) || Number(stock) < 0) {
      return res.status(400).json({ error: "El stock debe ser un número mayor o igual a 0" });
    }

    // Actualizamos el registro
    const stmt = db.prepare(`
      UPDATE medicamentos
      SET nombre = ?, presentacion = ?, stock = ?, caducidad = ?, lote = ?
      WHERE id = ?
    `);

    stmt.run(nombre.trim(), presentacion.trim(), Number(stock), caducidad, lote.trim(), id);

    res.json({ message: "Medicamento actualizado exitosamente" });
  } catch (err) {
    res.status(500).json({ error: "Error al actualizar medicamento: " + err.message });
  }
});

// ──────────────────────────────────────────────
// DELETE /api/medicamentos/:id
// Elimina un medicamento por su ID
// ──────────────────────────────────────────────
router.delete("/:id", (req, res) => {
  try {
    const { id } = req.params;

    // Verificamos que exista antes de eliminar
    const existe = db.prepare("SELECT id FROM medicamentos WHERE id = ?").get(id);
    if (!existe) {
      return res.status(404).json({ error: "Medicamento no encontrado" });
    }

    const stmt = db.prepare("DELETE FROM medicamentos WHERE id = ?");
    stmt.run(id);

    res.json({ message: "Medicamento eliminado exitosamente" });
  } catch (err) {
    res.status(500).json({ error: "Error al eliminar medicamento: " + err.message });
  }
});

// Exportamos el router para usarlo en server.js
module.exports = router;
