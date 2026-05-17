# Backup

FarmaX permite descargar un respaldo manual de la base SQLite.

## Archivo Respaldado

```text
backend/data/farmacia.db
```

## Desde la Aplicacion

Ruta:

```text
Configuracion -> Backup -> Descargar respaldo
```

El archivo se descarga con formato:

```text
backup-farmax-AAAA-MM-DD.db
```

## Permiso Requerido

El usuario debe tener:

```text
descargar_backup
```

Los administradores tienen este permiso automaticamente.

## Recomendaciones

- No guardar backups dentro de `frontend/`.
- No subir backups a GitHub.
- Mantener copias externas al VPS.
- Hacer backup antes de actualizaciones importantes.
