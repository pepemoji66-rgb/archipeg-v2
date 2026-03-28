# Importación Masiva de Disco — Diseño

**Fecha:** 2026-03-28
**Estado:** Aprobado por el usuario

---

## Resumen

Añadir a ARCHIPEG una funcionalidad de importación masiva que permita a cualquier usuario (admin, registrado y demo) seleccionar un disco completo o carpeta del sistema de archivos local mediante un diálogo nativo de Electron, escanear recursivamente todas las imágenes y registrarlas en la base de datos como referencias a su ubicación original (sin copiar los archivos).

---

## Decisiones de diseño

| Dimensión | Decisión |
|-----------|----------|
| Acceso | Todos los usuarios: admin, registrado y demo |
| Límite demo | Se aplica `LIMITE_DEMO` (50 fotos totales en DB) |
| Almacenamiento | Referencia por ruta absoluta (no copia) |
| Selección de ruta | Diálogo nativo Electron via IPC (`dialog.showOpenDialog`) |
| Escaneo | Recursivo: entra en todas las subcarpetas |
| Duplicados | Si `imagen_url` ya existe en DB → UPDATE (conserva metadatos) |
| Extensiones | `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`, `.heic`, `.bmp` |
| Ubicación UI | Galería principal (`/galeria-completa`) — accesible a todos |

---

## Arquitectura

### Flujo completo

```
[Usuario] clic "📂 SELECCIONAR DISCO/CARPETA"
    │
    └── ipcRenderer.invoke('seleccionar-carpeta')
                │
        [main.js — ipcMain.handle]
                └── dialog.showOpenDialog({ properties: ['openDirectory'] })
                            └── devuelve ruta o null (si cancelado)

[Galería muestra ruta seleccionada]

[Usuario] clic "⚡ IMPORTAR TODAS"
    │
    └── POST /api/importar-masivo { ruta: "D:\\" }
                │
        [server.js]
                ├── Escanea recursivamente con fs
                ├── Filtra extensiones de imagen
                ├── Por cada archivo:
                │     - imagen_url existe → UPDATE (solo imagen_url, preserva metadatos)
                │     - no existe → INSERT con ruta absoluta
                ├── Respeta LIMITE_DEMO para usuarios no autenticados
                └── Devuelve { importadas, actualizadas, ignoradas, total }

[Galería] recarga y muestra todas las fotos
```

### Servir fotos referenciadas

Las fotos importadas tienen `imagen_url` con ruta absoluta (ej: `D:\Fotos\2024\foto.jpg`).

```
GET /api/foto-local?ruta=<ruta_absoluta_encoded>
    └── fs.createReadStream(ruta) → pipe con Content-Type correcto
    └── Solo accesible desde localhost (validación de ruta)
```

`getFotoUrl` en el frontend detecta el tipo de URL:
- `imagen_url` empieza por letra de unidad (`C:\`, `D:\`) o por `/` (ruta Unix absoluta) → usa `/api/foto-local?ruta=`
- En cualquier otro caso → usa `/uploads/` (comportamiento actual)

---

## Componentes afectados

### `main.js`
- Añadir `ipcMain.handle('seleccionar-carpeta', ...)` con `dialog.showOpenDialog`

### `server.js`
- Nuevo endpoint `POST /api/importar-masivo`
- Nuevo endpoint `GET /api/foto-local`

### `src/components/Galeria.js`
- Barra de importación masiva en la parte superior
- `getFotoUrl` actualizado para detectar rutas absolutas

### `src/api.js` (o equivalente)
- Sin cambios necesarios

---

## UI — Barra de importación masiva

```
┌─────────────────────────────────────────────────────────────┐
│  📂 SELECCIONAR DISCO/CARPETA   D:\Fotos\   ⚡ IMPORTAR     │
│  ⏳ Importando... (esto puede tardar varios minutos)         │
│  ✅ 1203 importadas · 12 actualizadas · 3 ignoradas         │
└─────────────────────────────────────────────────────────────┘
```

- El botón "IMPORTAR" se desactiva si no hay ruta seleccionada
- Durante la importación se muestra un spinner (la operación es síncrona en el backend; no hay streaming de progreso intermedio)
- Al terminar, mensaje de resumen visible en pantalla y recarga automática de la galería
- El botón respeta el estilo visual existente (neon/dark del proyecto)

---

## Endpoint `POST /api/importar-masivo`

**Request:**
```json
{ "ruta": "D:\\" }
```

**Comportamiento:**
1. Valida que `ruta` existe y es un directorio
2. Escanea recursivamente con `fs.readdirSync`
3. Para usuarios no autenticados (demo): cuenta fotos actuales en DB; si ya hay `>= LIMITE_DEMO`, rechaza con 403
4. Para cada imagen encontrada:
   - Busca en DB por `imagen_url = ruta_absoluta_archivo`
   - Si existe: se cuenta como "actualizada" (la referencia ya está registrada; no se modifican los metadatos existentes como título, año, etiquetas)
   - Si no existe: `INSERT INTO fotos (imagen_url, en_papelera) VALUES (?, 0)`
5. Para demo: detiene la inserción al llegar al límite, continúa contando el resto como `ignoradas`

**Response:**
```json
{
  "importadas": 1203,
  "actualizadas": 12,
  "ignoradas": 3,
  "total": 1218
}
```

---

## Endpoint `GET /api/foto-local`

**Request:**
```
GET /api/foto-local?ruta=D%3A%5CFotos%5C2024%5Cfoto.jpg
```

**Comportamiento:**
1. Decodifica `ruta`
2. Verifica que el archivo existe con `fs.existsSync`
3. Detecta MIME type por extensión
4. Devuelve el archivo con `fs.createReadStream` + `Content-Type` correcto
5. Si no existe: 404

---

## Manejo de errores

| Situación | Respuesta |
|-----------|-----------|
| Ruta no existe o no es directorio | 400: "Ruta inválida o no existe" |
| Sin permisos de lectura | 500: "Sin permiso para leer la ruta" |
| Demo en límite | 403: mensaje de límite existente |
| Foto local no encontrada | 404 en `/api/foto-local` |
| IPC cancelado (usuario cierra diálogo) | null, UI no hace nada |

---

## Consideraciones de seguridad

- `/api/foto-local` solo acepta peticiones desde `localhost` (header `Host` o `Origin`)
- No se expone ninguna ruta fuera de lo que el usuario seleccionó intencionalmente
- La ruta recibida en `importar-masivo` se valida con `fs.statSync` antes de escanear
