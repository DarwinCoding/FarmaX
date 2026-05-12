// ============================================================
// server.js - Servidor principal (v3: +Auth +Reportes)
// ============================================================
const express     = require("express");
const path        = require("path");
const session     = require("express-session");
const SQLiteStore = require("connect-sqlite3")(session);

const app  = express();
const PORT = 3000;

app.use(express.json());

// ── Sesiones: guardan quién está logueado ──
app.use(session({
  store: new SQLiteStore({
    db: "farmacia.db",
    dir: path.join(__dirname, "data")
  }),
  secret: "farmacia-clinica-secreto-2024",
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 8 * 60 * 60 * 1000, httpOnly: true }
}));

// ── Middleware: verifica que el usuario esté logueado ──
function requireAuth(req, res, next) {
  if (!req.session.usuario) {
    return res.status(401).json({ error: "No autenticado. Inicia sesión." });
  }
  next();
}

// ── Middleware: verifica que el usuario tenga el rol correcto ──
function requireRol(rol) {
  return (req, res, next) => {
    if (!req.session.usuario) return res.status(401).json({ error: "No autenticado" });
    if (req.session.usuario.rol !== rol) return res.status(403).json({ error: "Acceso denegado. Rol requerido: " + rol });
    next();
  };
}

// ── Archivos estáticos del frontend ──
app.use(express.static(path.join(__dirname, "../frontend")));

// ── Rutas PÚBLICAS (sin login) ──
const authRoutes = require("./routes/auth");
app.use("/api/auth", authRoutes);

// ── Rutas PROTEGIDAS (requieren sesión activa) ──
const medicamentosRoutes = require("./routes/medicamentos");
app.use("/api/medicamentos", requireAuth, medicamentosRoutes);

const ordenesRoutes = require("./routes/ordenes");
app.use("/api/ordenes", requireAuth, ordenesRoutes);

// Solo admin puede gestionar usuarios
const usuariosRoutes = require("./routes/usuarios");
app.use("/api/usuarios", requireAuth, requireRol("admin"), usuariosRoutes);

// Reportes: cualquier usuario autenticado
const reportesRoutes = require("./routes/reportes");
app.use("/api/reportes", requireAuth, reportesRoutes);

// Órdenes especiales:
//   - GET y POST: cualquier usuario autenticado
//   - DELETE: solo admin (verificado dentro de la ruta con middleware)
const ordenesEspecialesRoutes = require("./routes/ordenesEspeciales");

// Middleware que protege DELETE solo para admin, GET y POST para cualquier usuario autenticado
app.use("/api/ordenes-especiales", requireAuth, (req, res, next) => {
  // Si es DELETE, verificamos que sea admin
  if (req.method === "DELETE") {
    return requireRol("admin")(req, res, next);
  }
  // GET y POST pasan sin restricción de rol
  next();
}, ordenesEspecialesRoutes);
// ── Ruta raíz ──
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/index.html"));
});

app.use((req, res) => {
  res.status(404).json({ error: "Ruta no encontrada" });
});

app.listen(PORT, () => {
  console.log("╔══════════════════════════════════════════╗");
  console.log("║  🏥 FARMACIA CLÍNICA - Sistema v4.0      ║");
  console.log("║  +Excel  +Órdenes Especiales             ║");
  console.log("╚══════════════════════════════════════════╝");
  console.log(`\n✅ Servidor en: http://localhost:${PORT}`);
  console.log("   Usuario: admin / Contraseña: admin123\n");
});
