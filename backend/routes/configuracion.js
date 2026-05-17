// ============================================================
// routes/configuracion.js - Configuracion general del sistema
// ============================================================

const express = require("express");
const fs = require("fs");
const path = require("path");
const router = express.Router();
const db = require("../database");
const { requirePermiso, requirePermisoAny } = require("../middleware/permisos");
const { registrarAuditoria } = require("../auditoria");

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

function guardarNumeroConfig(clave, valor) {
  db.prepare(`
    INSERT INTO configuracion (clave, valor)
    VALUES (?, ?)
    ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor
  `).run(clave, String(valor));
}

function validarEnteroNoNegativo(valor, nombreCampo) {
  const numero = Number(valor);
  if (!Number.isInteger(numero) || numero < 0) {
    return { error: `${nombreCampo} debe ser un numero entero mayor o igual a 0.` };
  }
  return { valor: numero };
}

function normalizarNombreArea(nombre) {
  return String(nombre || "").trim();
}

function areaDuplicada(nombre, idIgnorado = null) {
  if (idIgnorado) {
    return db.prepare(`
      SELECT id FROM areas
      WHERE lower(nombre) = lower(?) AND id != ?
    `).get(nombre, idIgnorado);
  }

  return db.prepare(`
    SELECT id FROM areas
    WHERE lower(nombre) = lower(?)
  `).get(nombre);
}

function normalizarNombrePresentacion(nombre) {
  return String(nombre || "").trim();
}

function presentacionDuplicada(nombre, idIgnorado = null) {
  if (idIgnorado) {
    return db.prepare(`
      SELECT id FROM presentaciones
      WHERE lower(nombre) = lower(?) AND id != ?
    `).get(nombre, idIgnorado);
  }

  return db.prepare(`
    SELECT id FROM presentaciones
    WHERE lower(nombre) = lower(?)
  `).get(nombre);
}

function fechaBackup() {
  return new Date().toISOString().split("T")[0];
}

// GET /api/configuracion
// GET /api/configuracion/general
router.get(["/", "/general"], requirePermisoAny(["ver_configuracion", "ver_inventario", "ver_ordenes", "ver_ordenes_especiales"]), (req, res) => {
  try {
    res.json(leerConfiguracionGeneral());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/configuracion/stock-minimo-global
router.put("/stock-minimo-global", requirePermiso("editar_configuracion"), (req, res) => {
  try {
    const validacion = validarEnteroNoNegativo(req.body.stock_minimo_global, "Stock minimo global");
    if (validacion.error) return res.status(400).json({ error: validacion.error });

    guardarNumeroConfig("stock_minimo_global", validacion.valor);
    registrarAuditoria(req, "EDITAR", "Configuracion", `Cambio stock minimo global a ${validacion.valor}`);
    res.json({
      message: "Stock minimo global actualizado",
      configuracion: leerConfiguracionGeneral()
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/configuracion/dias-alerta-caducidad
router.put("/dias-alerta-caducidad", requirePermiso("editar_configuracion"), (req, res) => {
  try {
    const validacion = validarEnteroNoNegativo(req.body.dias_alerta_caducidad, "Dias de alerta de caducidad");
    if (validacion.error) return res.status(400).json({ error: validacion.error });

    guardarNumeroConfig("dias_alerta_caducidad", validacion.valor);
    registrarAuditoria(req, "EDITAR", "Configuracion", `Cambio dias de alerta de caducidad a ${validacion.valor}`);
    res.json({
      message: "Dias de alerta de caducidad actualizados",
      configuracion: leerConfiguracionGeneral()
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/configuracion/areas
router.get("/areas", requirePermisoAny(["ver_configuracion", "ver_ordenes"]), (req, res) => {
  try {
    const areas = db.prepare(`
      SELECT id, nombre, activo
      FROM areas
      WHERE activo = 1
      ORDER BY nombre ASC
    `).all();

    res.json(areas);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/configuracion/areas
router.post("/areas", requirePermiso("editar_configuracion"), (req, res) => {
  try {
    const nombre = normalizarNombreArea(req.body.nombre);
    if (!nombre) return res.status(400).json({ error: "El nombre del area es obligatorio." });
    if (areaDuplicada(nombre)) return res.status(409).json({ error: "Ya existe un area con ese nombre." });

    const result = db.prepare("INSERT INTO areas (nombre, activo) VALUES (?, 1)").run(nombre);
    const area = db.prepare("SELECT id, nombre, activo FROM areas WHERE id = ?").get(result.lastInsertRowid);
    registrarAuditoria(req, "CREAR", "Configuracion", `Creo area: ${nombre}`);
    res.status(201).json(area);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/configuracion/areas/:id
router.put("/areas/:id", requirePermiso("editar_configuracion"), (req, res) => {
  try {
    const { id } = req.params;
    const nombre = normalizarNombreArea(req.body.nombre);

    if (!nombre) return res.status(400).json({ error: "El nombre del area es obligatorio." });

    const area = db.prepare("SELECT id FROM areas WHERE id = ? AND activo = 1").get(id);
    if (!area) return res.status(404).json({ error: "Area no encontrada." });
    if (areaDuplicada(nombre, id)) return res.status(409).json({ error: "Ya existe un area con ese nombre." });

    db.prepare("UPDATE areas SET nombre = ? WHERE id = ?").run(nombre, id);
    registrarAuditoria(req, "EDITAR", "Configuracion", `Edito area #${id}: ${nombre}`);
    res.json(db.prepare("SELECT id, nombre, activo FROM areas WHERE id = ?").get(id));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/configuracion/areas/:id
router.delete("/areas/:id", requirePermiso("editar_configuracion"), (req, res) => {
  try {
    const { id } = req.params;
    const area = db.prepare("SELECT id FROM areas WHERE id = ? AND activo = 1").get(id);
    if (!area) return res.status(404).json({ error: "Area no encontrada." });

    db.prepare("UPDATE areas SET activo = 0 WHERE id = ?").run(id);
    registrarAuditoria(req, "ELIMINAR", "Configuracion", `Desactivo area #${id}`);
    res.json({ message: "Area desactivada correctamente.", id: Number(id) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/configuracion/presentaciones
router.get("/presentaciones", requirePermisoAny(["ver_configuracion", "ver_inventario"]), (req, res) => {
  try {
    const presentaciones = db.prepare(`
      SELECT id, nombre, activo
      FROM presentaciones
      WHERE activo = 1
      ORDER BY nombre ASC
    `).all();

    res.json(presentaciones);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/configuracion/presentaciones
router.post("/presentaciones", requirePermiso("editar_configuracion"), (req, res) => {
  try {
    const nombre = normalizarNombrePresentacion(req.body.nombre);
    if (!nombre) return res.status(400).json({ error: "El nombre de la presentacion es obligatorio." });
    if (presentacionDuplicada(nombre)) return res.status(409).json({ error: "Ya existe una presentacion con ese nombre." });

    const result = db.prepare("INSERT INTO presentaciones (nombre, activo) VALUES (?, 1)").run(nombre);
    const presentacion = db.prepare("SELECT id, nombre, activo FROM presentaciones WHERE id = ?").get(result.lastInsertRowid);
    registrarAuditoria(req, "CREAR", "Configuracion", `Creo presentacion: ${nombre}`);
    res.status(201).json(presentacion);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/configuracion/presentaciones/:id
router.put("/presentaciones/:id", requirePermiso("editar_configuracion"), (req, res) => {
  try {
    const { id } = req.params;
    const nombre = normalizarNombrePresentacion(req.body.nombre);

    if (!nombre) return res.status(400).json({ error: "El nombre de la presentacion es obligatorio." });

    const presentacion = db.prepare("SELECT id FROM presentaciones WHERE id = ? AND activo = 1").get(id);
    if (!presentacion) return res.status(404).json({ error: "Presentacion no encontrada." });
    if (presentacionDuplicada(nombre, id)) return res.status(409).json({ error: "Ya existe una presentacion con ese nombre." });

    db.prepare("UPDATE presentaciones SET nombre = ? WHERE id = ?").run(nombre, id);
    registrarAuditoria(req, "EDITAR", "Configuracion", `Edito presentacion #${id}: ${nombre}`);
    res.json(db.prepare("SELECT id, nombre, activo FROM presentaciones WHERE id = ?").get(id));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/configuracion/presentaciones/:id
router.delete("/presentaciones/:id", requirePermiso("editar_configuracion"), (req, res) => {
  try {
    const { id } = req.params;
    const presentacion = db.prepare("SELECT id FROM presentaciones WHERE id = ? AND activo = 1").get(id);
    if (!presentacion) return res.status(404).json({ error: "Presentacion no encontrada." });

    db.prepare("UPDATE presentaciones SET activo = 0 WHERE id = ?").run(id);
    registrarAuditoria(req, "ELIMINAR", "Configuracion", `Desactivo presentacion #${id}`);
    res.json({ message: "Presentacion desactivada correctamente.", id: Number(id) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/configuracion/backup
// Descarga una copia directa de la base SQLite actual. No modifica la BD.
router.get("/backup", requirePermiso("descargar_backup"), (req, res) => {
  try {
    const dbPath = path.join(__dirname, "..", "data", "farmacia.db");
    if (!fs.existsSync(dbPath)) {
      return res.status(404).json({ error: "No se encontro el archivo de base de datos para respaldar." });
    }

    registrarAuditoria(req, "BACKUP", "Configuracion", "Descargo respaldo manual de la base de datos");
    res.download(dbPath, `backup-farmax-${fechaBackup()}.db`);
  } catch (err) {
    res.status(500).json({ error: "Error al generar el respaldo: " + err.message });
  }
});

module.exports = router;
