# 💊 Farmacia Clínica — Sistema de Inventario

Sistema web local para administrar el inventario de medicamentos de una farmacia dentro de una clínica.

---

## 📁 Estructura del proyecto

```
farmacia-clinica/
│
├── package.json              ← Dependencias del proyecto (Node.js)
│
├── backend/
│   ├── server.js             ← Servidor Express (punto de entrada)
│   ├── database.js           ← Configuración de SQLite
│   ├── data/
│   │   └── farmacia.db       ← Base de datos (se crea automáticamente)
│   └── routes/
│       └── medicamentos.js   ← Rutas CRUD de la API
│
└── frontend/
    ├── index.html            ← Página principal
    ├── css/
    │   └── style.css         ← Estilos
    └── js/
        └── app.js            ← Lógica del frontend
```

---

## 🚀 Cómo ejecutar el proyecto

### Requisitos previos

Necesitas tener instalado **Node.js** (versión 16 o superior).

Puedes verificarlo en la terminal con:
```bash
node --version
```

Si no lo tienes, descárgalo desde: https://nodejs.org

---

### Paso 1 — Descargar / copiar el proyecto

Coloca la carpeta `farmacia-clinica` en cualquier lugar de tu computadora.

---

### Paso 2 — Abrir una terminal en la carpeta del proyecto

- **Windows**: Clic derecho dentro de la carpeta → "Abrir en Terminal"
- **Mac/Linux**: `cd ruta/hacia/farmacia-clinica`

---

### Paso 3 — Instalar dependencias

```bash
npm install
```

Esto descarga las librerías necesarias (Express, SQLite, cors).
Solo necesitas hacerlo la primera vez.

---

### Paso 4 — Iniciar el servidor

```bash
npm start
```

Verás en la terminal:
```
✅ Base de datos lista en: .../backend/data/farmacia.db
╔════════════════════════════════════════╗
║   🏥 FARMACIA CLÍNICA — Sistema v1.0   ║
╚════════════════════════════════════════╝

✅ Servidor corriendo en: http://localhost:3000
```

---

### Paso 5 — Abrir la aplicación

Abre tu navegador y visita:

```
http://localhost:3000
```

¡Listo! 🎉

---

### Para detener el servidor

Presiona `Ctrl + C` en la terminal.

---

## 🔌 API — Referencia de endpoints

| Método | URL                        | Acción                    |
|--------|----------------------------|---------------------------|
| GET    | /api/medicamentos          | Listar todos              |
| GET    | /api/medicamentos/:id      | Obtener uno por ID        |
| POST   | /api/medicamentos          | Crear nuevo               |
| PUT    | /api/medicamentos/:id      | Editar existente          |
| DELETE | /api/medicamentos/:id      | Eliminar                  |

---

## ⚠️ Sistema de alertas

- 🟥 **Rojo**: medicamentos con stock menor a 5 unidades
- 🟨 **Amarillo**: medicamentos que caducan en menos de 30 días o ya caducaron
- Las alertas aparecen en el banner superior y se resaltan en la tabla

---

## 🛠 Modo desarrollo (recarga automática)

Si quieres que el servidor se reinicie automáticamente al editar archivos:

```bash
npm run dev
```

Requiere `nodemon` (ya incluido en las dependencias de desarrollo).
