// ============================================================
// auth-guard.js — Protección de páginas frontend
// ============================================================
// Cada página protegida carga este script PRIMERO.
// Si el usuario no tiene sesión activa, lo redirige al login.
//
// También expone:
//   window.usuarioActual  → datos del usuario logueado
//   window.cerrarSesion() → función para hacer logout
// ============================================================

(async function () {
  try {
    const res = await fetch("/api/auth/me");

    if (res.status === 401) {
      // No hay sesión: redirigir al login
      window.location.href = "/login.html";
      return;
    }

    const data = await res.json();

    // Guardamos el usuario en una variable global accesible por todos los scripts
    window.usuarioActual = data.usuario;

    // Aplicamos restricciones de UI según el rol
    aplicarPermisos(data.usuario);

  } catch (err) {
    console.error("Error al verificar sesión:", err);
    window.location.href = "/login.html";
  }
})();

/**
 * Oculta o muestra elementos según el rol del usuario.
 * Cualquier elemento con data-rol="admin" solo es visible para admins.
 */
function aplicarPermisos(usuario) {
  // Cuando el DOM esté listo, ocultamos elementos restringidos
  document.addEventListener("DOMContentLoaded", () => {
    // Actualizamos el nombre de usuario en el navbar
    const elNombre = document.getElementById("nav-username");
    if (elNombre) elNombre.textContent = usuario.username;

    const elRol = document.getElementById("nav-rol");
    if (elRol) {
      elRol.textContent = usuario.rol === "admin" ? "👑 Admin" : "👤 Usuario";
    }

    // Ocultamos elementos que solo son para admin
    if (usuario.rol !== "admin") {
      document.querySelectorAll("[data-solo-admin]").forEach(el => {
        el.style.display = "none";
      });
    }
  });
}

/**
 * Cierra la sesión y redirige al login
 */
window.cerrarSesion = async function () {
  try {
    await fetch("/api/auth/logout", { method: "POST" });
  } catch (_) {}
  window.location.href = "/login.html";
};
