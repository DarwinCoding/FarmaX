# Arquitectura

FarmaX es una aplicacion web monorepo con backend y frontend en el mismo proyecto.

## Frontend

El frontend usa HTML, CSS y JavaScript puro.

Ubicacion principal:

```text
frontend/
```

Pantallas principales:

- `dashboard.html`
- `index.html`
- `ordenes.html`
- `orden-especial.html`
- `reportes.html`
- `usuarios.html`
- `configuracion.html`
- `auditoria.html`

Los scripts viven en:

```text
frontend/js/
```

`auth-guard.js` valida la sesion, expone el usuario actual y aplica permisos visuales.

## Backend

El backend usa Node.js y Express.

Punto de entrada:

```text
backend/server.js
```

Responsabilidades:

- Servir archivos estaticos del frontend.
- Configurar sesiones.
- Registrar rutas API.
- Proteger rutas con autenticacion.

## SQLite

La base de datos usa `better-sqlite3`.

Archivo:

```text
backend/data/farmacia.db
```

La estructura se crea en:

```text
backend/database.js
```

## Sesiones

FarmaX usa:

- `express-session`
- `connect-sqlite3`

La sesion guarda datos minimos del usuario:

- `id`
- `username`
- `rol`

Los permisos se consultan desde la base de datos y se exponen al frontend mediante `/api/auth/me`.
