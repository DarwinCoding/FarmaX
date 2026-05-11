// ============================================================
// database.js — Configuración y creación de la base de datos
// ============================================================
// Este archivo se encarga de:
//   1. Crear (o abrir) el archivo SQLite "farmacia.db"
//   2. Crear la tabla "medicamentos" si aún no existe
//   3. Exportar la conexión para usarla en las rutas
// ============================================================

const Database = require("better-sqlite3");
const bcrypt = require("bcryptjs");
const path = require("path");

// La base de datos se guarda en la carpeta "backend/data/"
// __dirname es la carpeta donde está este archivo
const DB_PATH = path.join(__dirname, "data", "farmacia.db");

// Abrimos (o creamos) el archivo de base de datos
const db = new Database(DB_PATH);

// Activamos las claves foráneas por buenas prácticas
db.pragma("journal_mode = WAL"); // Mejora el rendimiento con múltiples lecturas

// Creamos la tabla si no existe.
// "IF NOT EXISTS" evita un error si ya fue creada antes.
db.exec(`
  CREATE TABLE IF NOT EXISTS medicamentos (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,  -- ID único, se incrementa solo
    nombre      TEXT    NOT NULL,                   -- Nombre del medicamento
    presentacion TEXT   NOT NULL,                   -- Tabletas, jarabe, cápsulas, etc.
    stock       INTEGER NOT NULL DEFAULT 0,         -- Cantidad disponible en inventario
    caducidad   TEXT    NOT NULL,                   -- Fecha en formato YYYY-MM-DD
    lote        TEXT    NOT NULL,                   -- Número o código de lote
    creado_en   TEXT    DEFAULT (datetime('now'))   -- Fecha/hora de registro
  )
`);

// ──────────────────────────────────────────────
// NUEVAS TABLAS — Órdenes de Despacho (Fase 2)
// Se agregan aquí para compartir la misma conexión
// y el mismo archivo de base de datos.
// ──────────────────────────────────────────────

// Tabla principal de órdenes
db.exec(`
  CREATE TABLE IF NOT EXISTS ordenes (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    area      TEXT NOT NULL,                        -- "Hospitalización" o "Quirófano"
    fecha     TEXT DEFAULT (date('now')),            -- Fecha en formato YYYY-MM-DD
    estado    TEXT NOT NULL DEFAULT 'pendiente'      -- "pendiente" o "completada"
  )
`);

// Tabla de detalle: cada línea de medicamento dentro de una orden
db.exec(`
  CREATE TABLE IF NOT EXISTS detalle_orden (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    orden_id            INTEGER NOT NULL,            -- A qué orden pertenece
    medicamento_id      INTEGER NOT NULL,            -- Qué medicamento es
    cantidad_solicitada INTEGER NOT NULL DEFAULT 0,  -- Cuánto se pidió
    cantidad_entregada  INTEGER NOT NULL DEFAULT 0,  -- Cuánto se entregó realmente
    FOREIGN KEY (orden_id)       REFERENCES ordenes(id)       ON DELETE CASCADE,
    FOREIGN KEY (medicamento_id) REFERENCES medicamentos(id)  ON DELETE RESTRICT
  )
`);

// ──────────────────────────────────────────────
// NUEVA TABLA — Órdenes Especiales (Fase 4)
// Registra entregas a médicos o personal que se cobran aparte
// y descuenta del stock general.
// ──────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS ordenes_especiales (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre_persona TEXT    NOT NULL,                    -- Nombre del médico o personal
    tipo_persona   TEXT    NOT NULL,                    -- 'médico' o 'personal'
    medicamento_id INTEGER NOT NULL,                    -- Referencia al medicamento
    cantidad       INTEGER NOT NULL,                    -- Unidades entregadas
    fecha          TEXT    NOT NULL,                    -- Fecha de la entrega YYYY-MM-DD
    observacion    TEXT,                                -- Nota opcional
    creado_en      TEXT    DEFAULT (datetime('now')),   -- Registro automático
    FOREIGN KEY (medicamento_id) REFERENCES medicamentos(id)
  )
`);

console.log("✅ Base de datos lista en:", DB_PATH);

// Exportamos la conexión para usarla en otros archivos
module.exports = db;

// ──────────────────────────────────────────────
// NUEVAS TABLAS — Fase 3: Usuarios y Sesiones
// ──────────────────────────────────────────────

// Tabla de usuarios del sistema
db.exec(`
  CREATE TABLE IF NOT EXISTS usuarios (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    username   TEXT NOT NULL UNIQUE,          -- Nombre de usuario (único)
    password   TEXT NOT NULL,                 -- Contraseña encriptada con bcrypt
    rol        TEXT NOT NULL DEFAULT 'usuario', -- "admin" o "usuario"
    creado_en  TEXT DEFAULT (datetime('now'))
  )
`);

// ──────────────────────────────────────────────
// CREAR USUARIO ADMIN INICIAL
// Solo se crea si no existe ya un admin.
// La contraseña "admin123" ya está encriptada
// con bcrypt (generada con bcryptjs.hashSync).
// ──────────────────────────────────────────────
const hash = bcrypt.hashSync("admin123", 10);

const adminExistente = db
  .prepare("SELECT * FROM usuarios WHERE username = ?")
  .get("admin");

if (adminExistente) {
  db.prepare(`
    UPDATE usuarios 
    SET password = ?, rol = ?
    WHERE username = ?
  `).run(hash, "admin", "admin");
} else {
  db.prepare(`
    INSERT INTO usuarios (username, password, rol)
    VALUES (?, ?, ?)
  `).run("admin", hash, "admin");
}

console.log("✅ Usuario admin listo: admin / admin123");
