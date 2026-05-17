# Permisos

FarmaX combina roles y permisos individuales.

## Roles

Roles actuales:

- `admin`
- `usuario`

## Admin

Todo usuario con `rol = admin` tiene todos los permisos automaticamente, aunque no existan registros en `usuarios_permisos`.

## Usuario Normal

Los usuarios normales obtienen permisos desde:

```text
usuarios_permisos
```

Cada permiso tiene:

- usuario asociado
- nombre del permiso
- estado activo

## Middleware

El backend usa:

```js
requirePermiso("nombre_permiso")
```

Reglas:

- Sin sesion: `401`
- Admin: permitido
- Usuario sin permiso: `403`
- Usuario con permiso: continua

Tambien existe:

```js
requirePermisoAny(["permiso_a", "permiso_b"])
```

Se usa para lecturas compartidas que necesita mas de un modulo.

## Flujo

1. El usuario inicia sesion.
2. `/api/auth/me` devuelve usuario y permisos.
3. El frontend aplica permisos visuales.
4. El backend valida permisos reales en rutas criticas.

## Frontend

`frontend/js/auth-guard.js` expone:

```js
window.usuarioActual
window.permisosUsuario
window.tienePermiso("permiso")
```

Tambien soporta:

```html
data-permiso="ver_reportes"
data-permiso-any="permiso1,permiso2"
```
