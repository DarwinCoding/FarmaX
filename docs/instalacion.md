# Instalacion

Guia para ejecutar FarmaX en un entorno local.

## Requisitos

- Node.js 20 o compatible
- npm
- Git

## Pasos

```bash
git clone <repositorio>
cd farmacia-clinica
npm install
npm start
```

Abrir en el navegador:

```text
http://localhost:3000
```

## Usuario Inicial

```text
Usuario: admin
Clave: admin123
```

## Modo Desarrollo

```bash
npm run dev
```

Usa `nodemon` para reiniciar el servidor cuando cambia el backend.

## Base de Datos Local

La base SQLite se crea automaticamente en:

```text
backend/data/farmacia.db
```

No es necesario crear tablas manualmente. `backend/database.js` prepara la estructura al iniciar el servidor.
