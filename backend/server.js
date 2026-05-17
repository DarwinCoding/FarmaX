// ============================================================
// server.js - Servidor principal FarmaX
// ============================================================

const express = require("express");
const path = require("path");
const session = require("express-session");
const SQLiteStore = require("connect-sqlite3")(session);

const app = express();
const PORT = 3000;

app.use(express.json());

// Sesiones: guardan quien esta logueado.
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

function requireAuth(req, res, next) {
  if (!req.session.usuario) {
    return res.status(401).json({ error: "No autenticado. Inicia sesion." });
  }
  next();
}

app.use(express.static(path.join(__dirname, "../frontend")));

const authRoutes = require("./routes/auth");
app.use("/api/auth", authRoutes);

const medicamentosRoutes = require("./routes/medicamentos");
app.use("/api/medicamentos", requireAuth, medicamentosRoutes);

const ordenesRoutes = require("./routes/ordenes");
app.use("/api/ordenes", requireAuth, ordenesRoutes);

const usuariosRoutes = require("./routes/usuarios");
app.use("/api/usuarios", requireAuth, usuariosRoutes);

const reportesRoutes = require("./routes/reportes");
app.use("/api/reportes", requireAuth, reportesRoutes);

const ordenesEspecialesRoutes = require("./routes/ordenesEspeciales");
app.use("/api/ordenes-especiales", requireAuth, ordenesEspecialesRoutes);

const dashboardRoutes = require("./routes/dashboard");
app.use("/api/dashboard", requireAuth, dashboardRoutes);

const configuracionRoutes = require("./routes/configuracion");
app.use("/api/configuracion", requireAuth, configuracionRoutes);

const auditoriaRoutes = require("./routes/auditoria");
app.use("/api/auditoria", requireAuth, auditoriaRoutes);

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/index.html"));
});

app.use((req, res) => {
  res.status(404).json({ error: "Ruta no encontrada" });
});

app.listen(PORT, () => {
  console.log(`Servidor FarmaX en http://localhost:${PORT}`);
  console.log("Usuario inicial: admin / admin123");
});
