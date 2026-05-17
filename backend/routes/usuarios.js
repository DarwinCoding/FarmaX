// ============================================================
// routes/usuarios.js - Gestión de usuarios (solo admin)
// ============================================================
// RUTAS (todas protegidas por permisos individuales):
//   GET    /api/usuarios          → listar todos
//   GET    /api/usuarios/:id      → obtener un usuario con permisos
//   POST   /api/usuarios          → crear nuevo usuario
//   PUT    /api/usuarios/:id      → cambiar rol, contraseña o permisos
//   DELETE /api/usuarios/:id      → eliminar (no puede eliminarse a sí mismo)
// ============================================================

const express = require("express");
const router  = express.Router();
const bcrypt  = require("bcryptjs");
const db      = require("../database");
const { TODOS_LOS_PERMISOS, obtenerPermisosUsuario } = require("../permisos");
const { requirePermiso } = require("../middleware/permisos");
const { registrarAuditoria } = require("../auditoria");

const permisosValidos = new Set(TODOS_LOS_PERMISOS);

function permisosLimpios(permisos) {
  if (!Array.isArray(permisos)) return [];
  return [...new Set(permisos.filter(permiso => permisosValidos.has(permiso)))];
}

function usuarioSinPassword(usuario) {
  return {
    id: usuario.id,
    username: usuario.username,
    rol: usuario.rol,
    creado_en: usuario.creado_en,
    permisos: obtenerPermisosUsuario(usuario)
  };
}

// Guarda permisos individuales solo para usuarios normales.
// Los admin se resuelven por rol y no necesitan registros activos.
const guardarPermisosUsuario = db.transaction((usuarioId, rol, permisos) => {
  if (!Array.isArray(permisos) && rol !== "admin") return;

  db.prepare("UPDATE usuarios_permisos SET activo = 0 WHERE usuario_id = ?").run(usuarioId);

  if (rol === "admin") return;

  const permisosSeleccionados = permisosLimpios(permisos);
  const existePermiso = db.prepare(`
    SELECT id
    FROM usuarios_permisos
    WHERE usuario_id = ? AND permiso = ?
    LIMIT 1
  `);
  const activarPermiso = db.prepare(`
    UPDATE usuarios_permisos
    SET activo = 1
    WHERE usuario_id = ? AND permiso = ?
  `);
  const insertarPermiso = db.prepare(`
    INSERT INTO usuarios_permisos (usuario_id, permiso, activo)
    VALUES (?, ?, 1)
  `);

  permisosSeleccionados.forEach(permiso => {
    const existente = existePermiso.get(usuarioId, permiso);
    if (existente) {
      activarPermiso.run(usuarioId, permiso);
    } else {
      insertarPermiso.run(usuarioId, permiso);
    }
  });
});

function mismosPermisos(a, b) {
  const uno = [...new Set(a || [])].sort().join("|");
  const dos = [...new Set(b || [])].sort().join("|");
  return uno === dos;
}

// ── GET /api/usuarios ──
// Devuelve todos los usuarios SIN la contraseña
router.get("/", requirePermiso("ver_usuarios"), (req, res) => {
  try {
    const usuarios = db.prepare(
      "SELECT id, username, rol, creado_en FROM usuarios ORDER BY id ASC"
    ).all();
    res.json(usuarios.map(usuarioSinPassword));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/usuarios/:id ──
// Devuelve un usuario individual con sus permisos activos
router.get("/:id", requirePermiso("ver_usuarios"), (req, res) => {
  try {
    const usuario = db.prepare(
      "SELECT id, username, rol, creado_en FROM usuarios WHERE id = ?"
    ).get(req.params.id);

    if (!usuario) return res.status(404).json({ error: "Usuario no encontrado" });

    res.json(usuarioSinPassword(usuario));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/usuarios ──
// Crea un nuevo usuario con contraseña encriptada
router.post("/", requirePermiso("crear_usuarios"), (req, res) => {
  try {
    const { username, password, rol, permisos } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: "Usuario y contraseña son obligatorios" });
    }
    if (!["admin", "usuario"].includes(rol)) {
      return res.status(400).json({ error: "Rol inválido. Use 'admin' o 'usuario'" });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: "La contraseña debe tener al menos 6 caracteres" });
    }

    // Verificamos que el username no esté en uso
    const existe = db.prepare("SELECT id FROM usuarios WHERE username = ?").get(username.trim());
    if (existe) {
      return res.status(409).json({ error: "Ese nombre de usuario ya existe" });
    }

    // Encriptamos la contraseña (saltRounds=10 es el estándar seguro)
    const hash = bcrypt.hashSync(password, 10);

    const result = db.prepare(
      "INSERT INTO usuarios (username, password, rol) VALUES (?, ?, ?)"
    ).run(username.trim(), hash, rol);

    guardarPermisosUsuario(result.lastInsertRowid, rol, permisos);

    const usuarioCreado = db.prepare(
      "SELECT id, username, rol, creado_en FROM usuarios WHERE id = ?"
    ).get(result.lastInsertRowid);
    registrarAuditoria(req, "CREAR", "Usuarios", `Creo usuario: ${username.trim()}`);
    if (rol !== "admin" && permisosLimpios(permisos).length) {
      registrarAuditoria(req, "EDITAR", "Usuarios", `Asigno permisos a ${username.trim()}`);
    }

    res.status(201).json({
      message: "Usuario creado",
      usuario: usuarioSinPassword(usuarioCreado)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PUT /api/usuarios/:id ──
// Actualiza rol y/o contraseña
router.put("/:id", requirePermiso("editar_usuarios"), (req, res) => {
  try {
    const { id } = req.params;
    const { rol, password, permisos } = req.body;

    const usuario = db.prepare("SELECT * FROM usuarios WHERE id = ?").get(id);
    if (!usuario) return res.status(404).json({ error: "Usuario no encontrado" });
    const permisosAntes = obtenerPermisosUsuario(usuario);

    // Construimos la actualización dinámicamente
    if (rol) {
      if (!["admin", "usuario"].includes(rol)) {
        return res.status(400).json({ error: "Rol inválido" });
      }
      db.prepare("UPDATE usuarios SET rol = ? WHERE id = ?").run(rol, id);
    }

    if (password) {
      if (password.length < 6) {
        return res.status(400).json({ error: "La contraseña debe tener al menos 6 caracteres" });
      }
      const hash = bcrypt.hashSync(password, 10);
      db.prepare("UPDATE usuarios SET password = ? WHERE id = ?").run(hash, id);
    }

    const usuarioActualizado = db.prepare(
      "SELECT id, username, rol, creado_en FROM usuarios WHERE id = ?"
    ).get(id);

    guardarPermisosUsuario(id, usuarioActualizado.rol, permisos);
    registrarAuditoria(req, "EDITAR", "Usuarios", `Edito usuario: ${usuarioActualizado.username}`);
    const permisosDespues = obtenerPermisosUsuario(usuarioActualizado);
    if (Array.isArray(permisos) && !mismosPermisos(permisosAntes, permisosDespues)) {
      registrarAuditoria(req, "EDITAR", "Usuarios", `Cambio permisos de ${usuarioActualizado.username}`);
    }

    res.json({
      message: "Usuario actualizado",
      usuario: usuarioSinPassword(usuarioActualizado)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/usuarios/:id ──
// Elimina un usuario (no puede eliminarse a sí mismo)
router.delete("/:id", requirePermiso("eliminar_usuarios"), (req, res) => {
  try {
    const { id } = req.params;
    const { id: miId } = req.session.usuario;

    if (Number(id) === Number(miId)) {
      return res.status(400).json({ error: "No puedes eliminar tu propio usuario" });
    }

    const usuario = db.prepare("SELECT * FROM usuarios WHERE id = ?").get(id);
    if (!usuario) return res.status(404).json({ error: "Usuario no encontrado" });

    // Evitamos eliminar el último admin
    if (usuario.rol === "admin") {
      const totalAdmins = db.prepare("SELECT COUNT(*) as c FROM usuarios WHERE rol = 'admin'").get();
      if (totalAdmins.c <= 1) {
        return res.status(400).json({ error: "No se puede eliminar el único administrador" });
      }
    }

    db.prepare("DELETE FROM usuarios WHERE id = ?").run(id);
    registrarAuditoria(req, "ELIMINAR", "Usuarios", `Elimino usuario: ${usuario.username}`);
    res.json({ message: "Usuario eliminado" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
