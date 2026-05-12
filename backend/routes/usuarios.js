// ============================================================
// routes/usuarios.js - Gestión de usuarios (solo admin)
// ============================================================
// RUTAS (todas protegidas por requireRol("admin") en server.js):
//   GET    /api/usuarios          → listar todos
//   POST   /api/usuarios          → crear nuevo usuario
//   PUT    /api/usuarios/:id      → cambiar rol o contraseña
//   DELETE /api/usuarios/:id      → eliminar (no puede eliminarse a sí mismo)
// ============================================================

const express = require("express");
const router  = express.Router();
const bcrypt  = require("bcryptjs");
const db      = require("../database");

// ── GET /api/usuarios ──
// Devuelve todos los usuarios SIN la contraseña
router.get("/", (req, res) => {
  try {
    const usuarios = db.prepare(
      "SELECT id, username, rol, creado_en FROM usuarios ORDER BY id ASC"
    ).all();
    res.json(usuarios);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/usuarios ──
// Crea un nuevo usuario con contraseña encriptada
router.post("/", (req, res) => {
  try {
    const { username, password, rol } = req.body;

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

    res.status(201).json({ message: "Usuario creado", id: result.lastInsertRowid });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PUT /api/usuarios/:id ──
// Actualiza rol y/o contraseña
router.put("/:id", (req, res) => {
  try {
    const { id } = req.params;
    const { rol, password } = req.body;

    const usuario = db.prepare("SELECT * FROM usuarios WHERE id = ?").get(id);
    if (!usuario) return res.status(404).json({ error: "Usuario no encontrado" });

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

    res.json({ message: "Usuario actualizado" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/usuarios/:id ──
// Elimina un usuario (no puede eliminarse a sí mismo)
router.delete("/:id", (req, res) => {
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
    res.json({ message: "Usuario eliminado" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
