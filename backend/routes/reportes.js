// ============================================================
// routes/reportes.js - Módulo de reportes
// ============================================================
// RUTAS:
//   GET /api/reportes/inventario-general    → todos los medicamentos
//   GET /api/reportes/stock-bajo            → stock bajo segun configuracion
//   GET /api/reportes/proximos-caducar      → caducan segun configuracion
//   GET /api/reportes/caducados             → ya caducaron
//   GET /api/reportes/historial-ordenes     → todas las órdenes con detalle
//   GET /api/reportes/consumo-por-area      → totales entregados por área
//
// Parámetros opcionales de query (para historial):
//   ?fecha_inicio=YYYY-MM-DD&fecha_fin=YYYY-MM-DD
// ============================================================

const express = require("express");
const router  = express.Router();
const db      = require("../database");
const { requirePermiso } = require("../middleware/permisos");

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

// ── 1. Inventario general ──
router.use("/excel", requirePermiso("exportar_reportes_excel"));
router.use(requirePermiso("ver_reportes"));

router.get("/inventario-general", (req, res) => {
  try {
    const config = leerConfiguracionGeneral();
    const datos = db.prepare(`
      SELECT
        id, nombre, presentacion, stock, caducidad, lote, creado_en,
        CASE
          WHEN stock = 0 THEN 'Sin stock'
          WHEN stock < ? THEN 'Stock bajo'
          ELSE 'Normal'
        END AS estado_stock,
        CASE
          WHEN date(caducidad) < date('now') THEN 'Caducado'
          WHEN julianday(caducidad) - julianday('now') <= ? THEN 'Por caducar'
          ELSE 'Vigente'
        END AS estado_caducidad
      FROM medicamentos
      ORDER BY nombre ASC
    `).all(config.stock_minimo_global, config.dias_alerta_caducidad);
    res.json({ datos, configuracion: config });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── 2. Stock bajo (segun configuracion) ──
router.get("/stock-bajo", (req, res) => {
  try {
    const config = leerConfiguracionGeneral();
    const datos = db.prepare(`
      SELECT id, nombre, presentacion, stock, lote, caducidad
      FROM medicamentos
      WHERE stock < ?
      ORDER BY stock ASC
    `).all(config.stock_minimo_global);
    res.json({ datos, configuracion: config });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── 3. Proximos a caducar (segun configuracion, sin caducados) ──
router.get("/proximos-caducar", (req, res) => {
  try {
    const config = leerConfiguracionGeneral();
    const datos = db.prepare(`
      SELECT
        id, nombre, presentacion, stock, caducidad, lote,
        CAST(julianday(caducidad) - julianday('now') AS INTEGER) AS dias_restantes
      FROM medicamentos
      WHERE date(caducidad) >= date('now')
        AND julianday(caducidad) - julianday('now') <= ?
      ORDER BY caducidad ASC
    `).all(config.dias_alerta_caducidad);
    res.json({ datos, configuracion: config });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── 4. Medicamentos caducados ──
router.get("/caducados", (req, res) => {
  try {
    const datos = db.prepare(`
      SELECT
        id, nombre, presentacion, stock, caducidad, lote,
        CAST(julianday('now') - julianday(caducidad) AS INTEGER) AS dias_vencido
      FROM medicamentos
      WHERE date(caducidad) < date('now')
      ORDER BY caducidad ASC
    `).all();
    res.json(datos);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── 5. Historial de órdenes (con filtro de fechas opcional) ──
router.get("/historial-ordenes", (req, res) => {
  try {
    // Leemos los filtros opcionales de la URL (?fecha_inicio=...&fecha_fin=...)
    const { fecha_inicio, fecha_fin } = req.query;

    let whereClause = "";
    const params = [];

    if (fecha_inicio && fecha_fin) {
      whereClause = "WHERE o.fecha BETWEEN ? AND ?";
      params.push(fecha_inicio, fecha_fin);
    } else if (fecha_inicio) {
      whereClause = "WHERE o.fecha >= ?";
      params.push(fecha_inicio);
    } else if (fecha_fin) {
      whereClause = "WHERE o.fecha <= ?";
      params.push(fecha_fin);
    }

    // Traemos órdenes con sus totales
    const ordenes = db.prepare(`
      SELECT
        o.id,
        o.area,
        o.fecha,
        o.estado,
        COUNT(d.id)                      AS total_items,
        COALESCE(SUM(d.cantidad_solicitada), 0) AS total_solicitado,
        COALESCE(SUM(d.cantidad_entregada),  0) AS total_entregado
      FROM ordenes o
      LEFT JOIN detalle_orden d ON d.orden_id = o.id
      ${whereClause}
      GROUP BY o.id
      ORDER BY o.fecha DESC, o.id DESC
    `).all(...params);

    // Para cada orden, traemos el detalle de medicamentos
    const stmt = db.prepare(`
      SELECT
        d.medicamento_id,
        m.nombre,
        m.presentacion,
        d.cantidad_solicitada,
        d.cantidad_entregada
      FROM detalle_orden d
      JOIN medicamentos m ON m.id = d.medicamento_id
      WHERE d.orden_id = ?
    `);

    const resultado = ordenes.map(o => ({
      ...o,
      detalle: stmt.all(o.id)
    }));

    res.json(resultado);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── 6. Consumo por área ──
router.get("/consumo-por-area", (req, res) => {
  try {
    const { fecha_inicio, fecha_fin } = req.query;

    let filtroFecha = "";
    const params = [];

    if (fecha_inicio && fecha_fin) {
      filtroFecha = "AND o.fecha BETWEEN ? AND ?";
      params.push(fecha_inicio, fecha_fin);
    }

    // Total entregado por área
    const porArea = db.prepare(`
      SELECT
        o.area,
        COUNT(DISTINCT o.id)           AS total_ordenes,
        SUM(d.cantidad_entregada)      AS total_unidades,
        COUNT(DISTINCT d.medicamento_id) AS medicamentos_distintos
      FROM ordenes o
      JOIN detalle_orden d ON d.orden_id = o.id
      WHERE o.estado = 'completada'
      ${filtroFecha}
      GROUP BY o.area
      ORDER BY total_unidades DESC
    `).all(...params);

    // Top 5 medicamentos más despachados (global)
    const topMedicamentos = db.prepare(`
      SELECT
        m.nombre,
        m.presentacion,
        SUM(d.cantidad_entregada) AS total_entregado
      FROM detalle_orden d
      JOIN medicamentos m ON m.id = d.medicamento_id
      JOIN ordenes o ON o.id = d.orden_id
      WHERE o.estado = 'completada'
      ${filtroFecha}
      GROUP BY d.medicamento_id
      ORDER BY total_entregado DESC
      LIMIT 10
    `).all(...params);

    res.json({ por_area: porArea, top_medicamentos: topMedicamentos });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

// ============================================================
// EXPORTACIONES A EXCEL - Usando ExcelJS
// ============================================================
// Estas rutas generan y descargan archivos .xlsx
// ============================================================

const ExcelJS = require("exceljs");

// Función auxiliar: aplica estilo de encabezado verde a una fila
function estiloEncabezado(fila) {
  fila.eachCell(celda => {
    celda.fill   = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0A4A3A" } };
    celda.font   = { color: { argb: "FFFFFFFF" }, bold: true, size: 11 };
    celda.alignment = { vertical: "middle", horizontal: "center" };
  });
  fila.height = 22;
}

// Función auxiliar: ajusta el ancho de columnas automáticamente
function autoAncho(hoja) {
  hoja.columns.forEach(col => {
    let max = col.header ? col.header.length : 10;
    col.eachCell({ includeEmpty: false }, celda => {
      const len = celda.value ? String(celda.value).length : 0;
      if (len > max) max = len;
    });
    col.width = Math.min(max + 4, 40);
  });
}

// ── EXCEL 1: Inventario general ──────────────────────────────
router.get("/excel/inventario-general", async (req, res) => {
  try {
    const config = leerConfiguracionGeneral();
    const datos = db.prepare(`
      SELECT id, nombre, presentacion, stock, caducidad, lote, creado_en,
        CASE WHEN stock = 0 THEN 'Sin stock' WHEN stock < ? THEN 'Stock bajo' ELSE 'Normal' END AS estado_stock,
        CASE WHEN date(caducidad) < date('now') THEN 'Caducado' WHEN julianday(caducidad) - julianday('now') <= ? THEN 'Por caducar' ELSE 'Vigente' END AS estado_caducidad
      FROM medicamentos ORDER BY nombre ASC
    `).all(config.stock_minimo_global, config.dias_alerta_caducidad);

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Inventario General");

    ws.columns = [
      { header: "ID",              key: "id",               },
      { header: "Nombre",          key: "nombre",           },
      { header: "Presentación",    key: "presentacion",     },
      { header: "Stock",           key: "stock",            },
      { header: "Estado Stock",    key: "estado_stock",     },
      { header: "Caducidad",       key: "caducidad",        },
      { header: "Estado Caducidad",key: "estado_caducidad", },
      { header: "Lote",            key: "lote",             },
      { header: "Creado En",       key: "creado_en",        },
    ];

    estiloEncabezado(ws.getRow(1));
    datos.forEach(fila => ws.addRow(fila));
    autoAncho(ws);

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=inventario_general.xlsx");
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── EXCEL 2: Stock bajo ──────────────────────────────────────
router.get("/excel/stock-bajo", async (req, res) => {
  try {
    const config = leerConfiguracionGeneral();
    const datos = db.prepare(`
      SELECT id, nombre, presentacion, stock, lote, caducidad
      FROM medicamentos WHERE stock < ? ORDER BY stock ASC
    `).all(config.stock_minimo_global);

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Stock Bajo");

    ws.columns = [
      { header: "ID",           key: "id",           },
      { header: "Nombre",       key: "nombre",       },
      { header: "Presentación", key: "presentacion", },
      { header: "Stock",        key: "stock",        },
      { header: "Lote",         key: "lote",         },
      { header: "Caducidad",    key: "caducidad",    },
    ];

    estiloEncabezado(ws.getRow(1));
    datos.forEach(fila => ws.addRow(fila));
    autoAncho(ws);

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=stock_bajo.xlsx");
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── EXCEL 3: Medicamentos por caducar ───────────────────────
router.get("/excel/proximos-caducar", async (req, res) => {
  try {
    const config = leerConfiguracionGeneral();
    const datos = db.prepare(`
      SELECT id, nombre, presentacion, stock, caducidad, lote,
        CAST(julianday(caducidad) - julianday('now') AS INTEGER) AS dias_restantes
      FROM medicamentos
      WHERE date(caducidad) >= date('now') AND julianday(caducidad) - julianday('now') <= ?
      ORDER BY caducidad ASC
    `).all(config.dias_alerta_caducidad);

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Por Caducar");

    ws.columns = [
      { header: "ID",             key: "id",             },
      { header: "Nombre",         key: "nombre",         },
      { header: "Presentación",   key: "presentacion",   },
      { header: "Stock",          key: "stock",          },
      { header: "Caducidad",      key: "caducidad",      },
      { header: "Días Restantes", key: "dias_restantes", },
      { header: "Lote",           key: "lote",           },
    ];

    estiloEncabezado(ws.getRow(1));
    datos.forEach(fila => ws.addRow(fila));
    autoAncho(ws);

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=medicamentos_por_caducar.xlsx");
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── EXCEL 4: Medicamentos caducados ─────────────────────────
router.get("/excel/caducados", async (req, res) => {
  try {
    const datos = db.prepare(`
      SELECT id, nombre, presentacion, stock, caducidad, lote,
        CAST(julianday('now') - julianday(caducidad) AS INTEGER) AS dias_vencido
      FROM medicamentos
      WHERE date(caducidad) < date('now') ORDER BY caducidad ASC
    `).all();

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Caducados");

    ws.columns = [
      { header: "ID",           key: "id",           },
      { header: "Nombre",       key: "nombre",       },
      { header: "Presentación", key: "presentacion", },
      { header: "Stock",        key: "stock",        },
      { header: "Caducidad",    key: "caducidad",    },
      { header: "Días Vencido", key: "dias_vencido", },
      { header: "Lote",         key: "lote",         },
    ];

    estiloEncabezado(ws.getRow(1));
    datos.forEach(fila => ws.addRow(fila));
    autoAncho(ws);

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=caducados.xlsx");
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── EXCEL 5: Historial de órdenes ───────────────────────────
router.get("/excel/historial-ordenes", async (req, res) => {
  try {
    const { fecha_inicio, fecha_fin } = req.query;
    let where = "";
    const params = [];
    if (fecha_inicio && fecha_fin) { where = "WHERE o.fecha BETWEEN ? AND ?"; params.push(fecha_inicio, fecha_fin); }
    else if (fecha_inicio) { where = "WHERE o.fecha >= ?"; params.push(fecha_inicio); }
    else if (fecha_fin)    { where = "WHERE o.fecha <= ?"; params.push(fecha_fin); }

    // Traemos todas las líneas de detalle con info de la orden
    const filas = db.prepare(`
      SELECT
        o.id AS orden_id, o.area, o.fecha, o.estado,
        m.nombre AS medicamento, m.presentacion,
        d.cantidad_solicitada, d.cantidad_entregada
      FROM ordenes o
      LEFT JOIN detalle_orden d ON d.orden_id = o.id
      LEFT JOIN medicamentos m ON m.id = d.medicamento_id
      ${where}
      ORDER BY o.fecha DESC, o.id DESC
    `).all(...params);

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Historial Órdenes");

    ws.columns = [
      { header: "Orden ID",          key: "orden_id",            },
      { header: "Área",              key: "area",                },
      { header: "Fecha",             key: "fecha",               },
      { header: "Estado",            key: "estado",              },
      { header: "Medicamento",       key: "medicamento",         },
      { header: "Presentación",      key: "presentacion",        },
      { header: "Cant. Solicitada",  key: "cantidad_solicitada", },
      { header: "Cant. Entregada",   key: "cantidad_entregada",  },
    ];

    estiloEncabezado(ws.getRow(1));
    filas.forEach(fila => ws.addRow(fila));
    autoAncho(ws);

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=historial_ordenes.xlsx");
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── EXCEL 6: Consumo por área ────────────────────────────────
router.get("/excel/consumo-por-area", async (req, res) => {
  try {
    const { fecha_inicio, fecha_fin } = req.query;
    let filtro = "";
    const params = [];
    if (fecha_inicio && fecha_fin) { filtro = "AND o.fecha BETWEEN ? AND ?"; params.push(fecha_inicio, fecha_fin); }

    const filas = db.prepare(`
      SELECT
        o.area, o.fecha,
        m.nombre AS medicamento, m.presentacion,
        d.cantidad_entregada
      FROM ordenes o
      JOIN detalle_orden d ON d.orden_id = o.id
      JOIN medicamentos m ON m.id = d.medicamento_id
      WHERE o.estado = 'completada'
      ${filtro}
      ORDER BY o.area, o.fecha DESC
    `).all(...params);

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Consumo por Área");

    ws.columns = [
      { header: "Área",              key: "area",               },
      { header: "Fecha",             key: "fecha",              },
      { header: "Medicamento",       key: "medicamento",        },
      { header: "Presentación",      key: "presentacion",       },
      { header: "Cant. Entregada",   key: "cantidad_entregada", },
    ];

    estiloEncabezado(ws.getRow(1));
    filas.forEach(fila => ws.addRow(fila));
    autoAncho(ws);

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=consumo_por_area.xlsx");
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── EXCEL 7: Órdenes especiales ──────────────────────────────
router.get("/excel/ordenes-especiales", async (req, res) => {
  try {
    const { fecha_inicio, fecha_fin, tipo_persona, nombre_persona } = req.query;
    let condiciones = [];
    const params = [];

    if (fecha_inicio && fecha_fin) { condiciones.push("oe.fecha BETWEEN ? AND ?"); params.push(fecha_inicio, fecha_fin); }
    else if (fecha_inicio) { condiciones.push("oe.fecha >= ?"); params.push(fecha_inicio); }
    else if (fecha_fin)    { condiciones.push("oe.fecha <= ?"); params.push(fecha_fin); }
    if (tipo_persona)   { condiciones.push("oe.tipo_persona = ?");        params.push(tipo_persona); }
    if (nombre_persona) { condiciones.push("oe.nombre_persona LIKE ?");   params.push("%" + nombre_persona + "%"); }

    const where = condiciones.length ? "WHERE " + condiciones.join(" AND ") : "";

    const datos = db.prepare(`
      SELECT oe.id, oe.fecha, oe.nombre_persona, oe.tipo_persona,
        m.nombre AS medicamento, m.presentacion, oe.cantidad, oe.observacion
      FROM ordenes_especiales oe
      JOIN medicamentos m ON m.id = oe.medicamento_id
      ${where}
      ORDER BY oe.fecha DESC, oe.id DESC
    `).all(...params);

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Órdenes Especiales");

    ws.columns = [
      { header: "ID",           key: "id",             },
      { header: "Fecha",        key: "fecha",          },
      { header: "Nombre",       key: "nombre_persona", },
      { header: "Tipo",         key: "tipo_persona",   },
      { header: "Medicamento",  key: "medicamento",    },
      { header: "Presentación", key: "presentacion",   },
      { header: "Cantidad",     key: "cantidad",       },
      { header: "Observación",  key: "observacion",    },
    ];

    estiloEncabezado(ws.getRow(1));
    datos.forEach(fila => ws.addRow(fila));
    autoAncho(ws);

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=ordenes_especiales.xlsx");
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── REPORTE 7: Órdenes Especiales (datos JSON) ───────────────
router.get("/ordenes-especiales", (req, res) => {
  try {
    const { fecha_inicio, fecha_fin, tipo_persona, nombre_persona } = req.query;
    let condiciones = [];
    const params = [];

    if (fecha_inicio && fecha_fin) { condiciones.push("oe.fecha BETWEEN ? AND ?"); params.push(fecha_inicio, fecha_fin); }
    else if (fecha_inicio) { condiciones.push("oe.fecha >= ?"); params.push(fecha_inicio); }
    else if (fecha_fin)    { condiciones.push("oe.fecha <= ?"); params.push(fecha_fin); }
    if (tipo_persona)   { condiciones.push("oe.tipo_persona = ?");       params.push(tipo_persona); }
    if (nombre_persona) { condiciones.push("oe.nombre_persona LIKE ?");  params.push("%" + nombre_persona + "%"); }

    const where = condiciones.length ? "WHERE " + condiciones.join(" AND ") : "";

    const datos = db.prepare(`
      SELECT oe.id, oe.fecha, oe.nombre_persona, oe.tipo_persona,
        m.nombre AS medicamento_nombre, m.presentacion, oe.cantidad, oe.observacion
      FROM ordenes_especiales oe
      JOIN medicamentos m ON m.id = oe.medicamento_id
      ${where}
      ORDER BY oe.fecha DESC, oe.id DESC
    `).all(...params);

    res.json(datos);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
