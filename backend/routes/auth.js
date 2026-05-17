// ============================================================
// routes/auth.js - Login, Logout y verificación de sesión
// ============================================================
// RUTAS:
//   POST /api/auth/login    → iniciar sesión
//   POST /api/auth/logout   → cerrar sesión
//   GET  /api/auth/me       → saber quién está logueado
// ============================================================

const express  = require("express");
const router   = express.Router();
const bcrypt   = require("bcryptjs");  // Para verificar la contraseña encriptada
const db       = require("../database");
const { obtenerPermisosUsuario } = require("../permisos");
const { registrarAuditoria } = require("../auditoria");

function usuarioConPermisos(usuario) {
  return {
    ...usuario,
    usuario: usuario.username,
    permisos: obtenerPermisosUsuario(usuario)
  };
}

// ──────────────────────────────────────────────
// POST /api/auth/login
// El frontend envía { username, password }
// Si son correctos, creamos la sesión
// ──────────────────────────────────────────────
router.post("/login", (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: "Usuario y contraseña son obligatorios" });
  }

  // Buscamos el usuario en la BD
  const usuario = db.prepare("SELECT * FROM usuarios WHERE username = ?").get(username.trim());

  if (!usuario) {
    // No revelamos si el usuario existe o no (seguridad)
    return res.status(401).json({ error: "Usuario o contraseña incorrectos" });
  }

  // bcrypt.compareSync compara la contraseña plana con el hash guardado
  const passwordCorrecta = bcrypt.compareSync(password, usuario.password);

  if (!passwordCorrecta) {
    return res.status(401).json({ error: "Usuario o contraseña incorrectos" });
  }

  // Guardamos en la sesión solo lo necesario (nunca la contraseña)
  req.session.usuario = {
    id:       usuario.id,
    username: usuario.username,
    rol:      usuario.rol
  };

  registrarAuditoria(req, "LOGIN", "Login", "Inicio de sesion");

  res.json({
    message:  "Sesión iniciada correctamente",
    usuario:  usuarioConPermisos(req.session.usuario)
  });
});

// ──────────────────────────────────────────────
// POST /api/auth/logout
// Destruye la sesión del servidor
// ──────────────────────────────────────────────
router.post("/logout", (req, res) => {
  registrarAuditoria(req, "LOGOUT", "Login", "Cierre de sesion");
  req.session.destroy((err) => {
    if (err) return res.status(500).json({ error: "Error al cerrar sesión" });
    res.clearCookie("connect.sid"); // Borramos la cookie del navegador
    res.json({ message: "Sesión cerrada" });
  });
});

// ──────────────────────────────────────────────
// GET /api/auth/me
// El frontend lo llama al cargar para saber
// si el usuario ya tiene sesión activa
// ──────────────────────────────────────────────
router.get("/me", (req, res) => {
  if (!req.session.usuario) {
    return res.status(401).json({ autenticado: false });
  }
  res.json({
    autenticado: true,
    usuario: usuarioConPermisos(req.session.usuario)
  });
});

module.exports = router;
