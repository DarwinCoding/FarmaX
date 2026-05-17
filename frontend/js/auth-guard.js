// ============================================================
// auth-guard.js - Proteccion de paginas frontend
// ============================================================

window.usuarioActual = null;
window.permisosUsuario = [];

window.tienePermiso = function (permiso) {
  if (!permiso) return false;
  if (!window.usuarioActual) return true;
  if (window.usuarioActual && window.usuarioActual.rol === "admin") return true;
  return window.permisosUsuario.includes(permiso);
};

(async function () {
  try {
    const res = await fetch("/api/auth/me");

    if (res.status === 401) {
      window.location.href = "/login.html";
      return;
    }

    const data = await res.json();

    window.usuarioActual = data.usuario;
    window.permisosUsuario = Array.isArray(data.usuario.permisos)
      ? data.usuario.permisos
      : [];

    aplicarPermisos(data.usuario);
  } catch (err) {
    console.error("Error al verificar sesion:", err);
    window.location.href = "/login.html";
  }
})();

function cuandoDomListo(fn) {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", fn);
  } else {
    fn();
  }
}

function tienePermisoAny(listaPermisos) {
  return listaPermisos.some(permiso => window.tienePermiso(permiso.trim()));
}

function puedeVerElemento(el) {
  const permiso = el.dataset.permiso;
  const permisoAny = el.dataset.permisoAny;

  if (permiso && !window.tienePermiso(permiso)) return false;
  if (permisoAny && !tienePermisoAny(permisoAny.split(","))) return false;

  return true;
}

function ocultarElemento(el) {
  el.hidden = true;
  el.dataset.permisoOculto = "1";
  el.style.display = "none";
}

function mostrarElemento(el) {
  if (el.dataset.permisoOculto === "1") {
    el.hidden = false;
    el.style.display = "";
    delete el.dataset.permisoOculto;
  }
}

function permisoPaginaActual() {
  const permisoBody = document.body ? document.body.dataset.permisoPagina : "";
  if (permisoBody) return permisoBody;

  const permisosPorRuta = {
    "/": "ver_inventario",
    "/index.html": "ver_inventario",
    "/dashboard.html": "ver_dashboard",
    "/ordenes.html": "ver_ordenes",
    "/orden-especial.html": "ver_ordenes_especiales",
    "/reportes.html": "ver_reportes",
    "/usuarios.html": "ver_usuarios",
    "/configuracion.html": "ver_configuracion"
  };

  return permisosPorRuta[window.location.pathname] || "";
}

function buscarPrimeraRutaPermitida() {
  const rutas = [
    ["/dashboard.html", "ver_dashboard"],
    ["/", "ver_inventario"],
    ["/ordenes.html", "ver_ordenes"],
    ["/orden-especial.html", "ver_ordenes_especiales"],
    ["/reportes.html", "ver_reportes"],
    ["/configuracion.html", "ver_configuracion"],
    ["/usuarios.html", "ver_usuarios"]
  ];

  const permitida = rutas.find(([, permiso]) => window.tienePermiso(permiso));
  return permitida ? permitida[0] : "";
}

function validarPermisoPagina() {
  if (window.location.pathname === "/auditoria.html") {
    if (window.usuarioActual && window.usuarioActual.rol === "admin") return true;
    window.location.href = "/dashboard.html";
    return false;
  }

  const permiso = permisoPaginaActual();
  if (!permiso || window.tienePermiso(permiso)) return true;

  const destino = buscarPrimeraRutaPermitida();
  if (destino && destino !== window.location.pathname) {
    window.location.href = destino;
    return false;
  }

  const main = document.querySelector("main");
  if (main) {
    main.innerHTML = `
      <div class="card">
        <h2 class="card-titulo">Acceso no disponible</h2>
        <p class="card-descripcion">Tu usuario no tiene permiso para ver esta seccion.</p>
      </div>
    `;
  }
  return false;
}

// Los modulos que pintan botones dinamicos pueden llamar esta funcion
// despues de actualizar su HTML.
window.aplicarPermisosVisuales = function () {
  document.querySelectorAll("[data-solo-admin]").forEach(el => {
    if (window.usuarioActual && window.usuarioActual.rol === "admin") {
      mostrarElemento(el);
    } else {
      ocultarElemento(el);
    }
  });

  document.querySelectorAll("[data-permiso], [data-permiso-any]").forEach(el => {
    if (puedeVerElemento(el)) {
      mostrarElemento(el);
    } else {
      ocultarElemento(el);
    }
  });
};

function aplicarPermisos(usuario) {
  cuandoDomListo(() => {
    const elNombre = document.getElementById("nav-username");
    if (elNombre) elNombre.textContent = usuario.username;

    const elRol = document.getElementById("nav-rol");
    if (elRol) elRol.textContent = usuario.rol === "admin" ? "Admin" : "Usuario";

    if (!validarPermisoPagina()) return;
    window.aplicarPermisosVisuales();
  });
}

function mostrarErrorPermiso(mensaje) {
  const texto = mensaje || "No tienes permiso para realizar esta accion.";
  const contenedor = document.getElementById("toast-contenedor");

  if (contenedor) {
    const toast = document.createElement("div");
    toast.className = "toast error";
    toast.textContent = texto;
    contenedor.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transition = "opacity .4s";
      setTimeout(() => toast.remove(), 400);
    }, 3500);
    return;
  }

  console.warn(texto);
}

const fetchConPermisos = window.fetch.bind(window);
window.fetch = async function (...args) {
  const res = await fetchConPermisos(...args);

  if (res.status === 401) {
    window.location.href = "/login.html";
    return res;
  }

  if (res.status === 403) {
    const data = await res.clone().json().catch(() => ({}));
    mostrarErrorPermiso(data.error);
  }

  return res;
};

window.cerrarSesion = async function () {
  try {
    await fetch("/api/auth/logout", { method: "POST" });
  } catch (_) {}
  window.location.href = "/login.html";
};
