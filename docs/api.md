# API

Resumen de endpoints principales de FarmaX.

Todas las rutas de negocio requieren sesion activa.

## Auth

| Metodo | Ruta | Descripcion |
| --- | --- | --- |
| POST | `/api/auth/login` | Iniciar sesion |
| POST | `/api/auth/logout` | Cerrar sesion |
| GET | `/api/auth/me` | Consultar usuario autenticado |

## Dashboard

| Metodo | Ruta |
| --- | --- |
| GET | `/api/dashboard/resumen` |
| GET | `/api/dashboard/ultimas-ordenes` |
| GET | `/api/dashboard/ordenes-especiales-recientes` |
| GET | `/api/dashboard/alertas` |
| GET | `/api/dashboard/actividad-reciente` |

## Inventario

| Metodo | Ruta |
| --- | --- |
| GET | `/api/medicamentos` |
| GET | `/api/medicamentos/:id` |
| POST | `/api/medicamentos` |
| PUT | `/api/medicamentos/:id` |
| DELETE | `/api/medicamentos/:id` |
| PATCH | `/api/medicamentos/:id/restaurar` |

## Ordenes

| Metodo | Ruta |
| --- | --- |
| GET | `/api/ordenes` |
| GET | `/api/ordenes/:id` |
| POST | `/api/ordenes` |
| POST | `/api/ordenes/:id/detalle` |
| PUT | `/api/ordenes/detalle/:id` |
| DELETE | `/api/ordenes/detalle/:id` |
| POST | `/api/ordenes/:id/despachar` |
| DELETE | `/api/ordenes/:id` |

## Ordenes Especiales

| Metodo | Ruta |
| --- | --- |
| GET | `/api/ordenes-especiales` |
| POST | `/api/ordenes-especiales` |
| DELETE | `/api/ordenes-especiales/:id` |

## Reportes

| Metodo | Ruta |
| --- | --- |
| GET | `/api/reportes/inventario-general` |
| GET | `/api/reportes/stock-bajo` |
| GET | `/api/reportes/proximos-caducar` |
| GET | `/api/reportes/caducados` |
| GET | `/api/reportes/historial-ordenes` |
| GET | `/api/reportes/consumo-por-area` |
| GET | `/api/reportes/ordenes-especiales` |
| GET | `/api/reportes/excel/*` |

## Usuarios

| Metodo | Ruta |
| --- | --- |
| GET | `/api/usuarios` |
| GET | `/api/usuarios/:id` |
| POST | `/api/usuarios` |
| PUT | `/api/usuarios/:id` |
| DELETE | `/api/usuarios/:id` |

## Configuracion

| Metodo | Ruta |
| --- | --- |
| GET | `/api/configuracion/general` |
| PUT | `/api/configuracion/stock-minimo-global` |
| PUT | `/api/configuracion/dias-alerta-caducidad` |
| GET | `/api/configuracion/areas` |
| POST | `/api/configuracion/areas` |
| PUT | `/api/configuracion/areas/:id` |
| DELETE | `/api/configuracion/areas/:id` |
| GET | `/api/configuracion/presentaciones` |
| POST | `/api/configuracion/presentaciones` |
| PUT | `/api/configuracion/presentaciones/:id` |
| DELETE | `/api/configuracion/presentaciones/:id` |
| GET | `/api/configuracion/backup` |

## Auditoria

| Metodo | Ruta |
| --- | --- |
| GET | `/api/auditoria` |

Filtros disponibles:

- `usuario`
- `modulo`
- `fecha`
