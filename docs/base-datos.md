# Base de Datos

FarmaX usa SQLite mediante `better-sqlite3`.

Archivo:

```text
backend/data/farmacia.db
```

## Tablas Principales

### usuarios

Usuarios del sistema.

Campos principales:

- `id`
- `username`
- `password`
- `rol`
- `creado_en`

### usuarios_permisos

Permisos individuales por usuario normal.

Relacion:

- `usuario_id` referencia `usuarios.id`

### medicamentos

Inventario de medicamentos.

Campos principales:

- `id`
- `nombre`
- `presentacion`
- `stock`
- `caducidad`
- `lote`
- `activo`
- `creado_en`

### ordenes

Ordenes de despacho.

Campos principales:

- `id`
- `area`
- `fecha`
- `estado`

### detalle_orden

Medicamentos incluidos en una orden.

Relaciones:

- `orden_id` referencia `ordenes.id`
- `medicamento_id` referencia `medicamentos.id`

### ordenes_especiales

Entregas especiales a medicos o personal.

Relacion:

- `medicamento_id` referencia `medicamentos.id`

### configuracion

Valores globales del sistema.

Claves actuales:

- `stock_minimo_global`
- `dias_alerta_caducidad`

### areas

Areas configurables para ordenes.

Campos:

- `id`
- `nombre`
- `activo`

### presentaciones

Presentaciones configurables para medicamentos.

Campos:

- `id`
- `nombre`
- `activo`

### auditoria

Historial de acciones importantes.

Campos:

- `id`
- `usuario_id`
- `usuario`
- `accion`
- `modulo`
- `detalle`
- `fecha`

## Relaciones Clave

- Un usuario puede tener muchos permisos.
- Una orden puede tener muchas lineas de detalle.
- Cada linea de detalle pertenece a un medicamento.
- Una orden especial descuenta stock de un medicamento.
- La auditoria guarda acciones asociadas al usuario que las ejecuto.
