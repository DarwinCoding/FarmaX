# VPS

Guia general para operar FarmaX en un VPS con PM2 y Nginx.

## Actualizar Codigo

```bash
cd /ruta/farmax
git pull
npm install
pm2 restart farmax
```

## PM2

Iniciar por primera vez:

```bash
pm2 start backend/server.js --name farmax
pm2 save
```

Reiniciar:

```bash
pm2 restart farmax
```

Ver estado:

```bash
pm2 status
pm2 logs farmax
```

## Nginx

Nginx debe actuar como proxy hacia:

```text
http://localhost:3000
```

Despues de cambios en Nginx:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## Deploy Seguro

Antes de actualizar:

1. Crear backup de `backend/data/farmacia.db`.
2. Ejecutar `git pull`.
3. Ejecutar `npm install` si cambiaron dependencias.
4. Reiniciar PM2.
5. Revisar logs.
