# Importación Masiva de Disco — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir a cualquier usuario seleccionar un disco o carpeta local mediante diálogo nativo Electron e importar masivamente todas las imágenes como referencias a sus rutas originales.

**Architecture:** IPC Electron en `main.js` abre el diálogo nativo; `Galeria.js` invoca `ipcRenderer` y muestra la barra de importación; `server.js` escanea recursivamente y registra rutas absolutas en SQLite; un nuevo endpoint sirve las fotos referenciadas por `fs.createReadStream`.

**Tech Stack:** Electron 41 (ipcMain/ipcRenderer/dialog), Express (Node.js), SQLite, React 18 (CRA), CSS variables neón existentes.

---

## Mapa de archivos

| Archivo | Cambio |
|---------|--------|
| `main.js` | Añadir `ipcMain` + `dialog`; registrar handler `seleccionar-carpeta` |
| `server.js` | Añadir función `escanearRecursivo`, endpoint `POST /api/importar-masivo`, endpoint `GET /api/foto-local` |
| `src/components/Galeria.js` | Actualizar `getFotoUrl`; añadir estados y handlers de importación; añadir JSX barra de importación |
| `src/components/galeria.css` | Añadir estilos `.import-bar` y clases relacionadas |

---

## Tarea 1: IPC handler en main.js

**Archivos:**
- Modificar: `main.js`

- [ ] **Paso 1: Leer el archivo actual**

Verificar que `main.js` importa solo `{ app, BrowserWindow }` de electron.

- [ ] **Paso 2: Añadir ipcMain y dialog al require**

En `main.js`, reemplazar la línea:
```js
const { app, BrowserWindow } = require('electron');
```
por:
```js
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
```

- [ ] **Paso 3: Registrar el handler IPC antes de app.whenReady()**

Añadir justo antes de `app.whenReady().then(createWindow);`:
```js
ipcMain.handle('seleccionar-carpeta', async () => {
    const result = await dialog.showOpenDialog({ properties: ['openDirectory'] });
    return result.canceled ? null : result.filePaths[0];
});
```

- [ ] **Paso 4: Verificar manualmente**

Arrancar con `npm run electron-dev`. Abrir la consola de DevTools y ejecutar:
```js
const { ipcRenderer } = require('electron');
ipcRenderer.invoke('seleccionar-carpeta').then(r => console.log('ruta:', r));
```
Debe abrirse el diálogo del OS y devolver la ruta seleccionada (o `null` si se cancela).

- [ ] **Paso 5: Commit**

```bash
git add main.js
git commit -m "feat: añadir IPC handler seleccionar-carpeta con dialog nativo"
```

---

## Tarea 2: Endpoint POST /api/importar-masivo en server.js

**Archivos:**
- Modificar: `server.js`

- [ ] **Paso 1: Añadir constante de extensiones e helper de escaneo**

Justo después de la constante `LIMITE_DEMO = 50` en `server.js`, añadir:
```js
// --- IMPORTACIÓN MASIVA ---
const EXTENSIONES_IMAGEN = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic', '.bmp']);

function escanearRecursivo(dir) {
    const resultados = [];
    try {
        const entradas = fs.readdirSync(dir, { withFileTypes: true });
        for (const entrada of entradas) {
            const rutaCompleta = path.join(dir, entrada.name);
            try {
                if (entrada.isDirectory()) {
                    resultados.push(...escanearRecursivo(rutaCompleta));
                } else if (entrada.isFile() && EXTENSIONES_IMAGEN.has(path.extname(entrada.name).toLowerCase())) {
                    resultados.push(rutaCompleta);
                }
            } catch (_) { /* sin permiso, se ignora */ }
        }
    } catch (_) { /* directorio inaccesible, se ignora */ }
    return resultados;
}
```

- [ ] **Paso 2: Añadir el endpoint POST /api/importar-masivo**

Justo antes del comentario `// --- LANZAMIENTO ---` al final de `server.js`, añadir:
```js
// IMPORTACIÓN MASIVA DESDE DISCO
app.post('/api/importar-masivo', async (req, res) => {
    try {
        const { ruta } = req.body;
        if (!ruta) return res.status(400).json({ error: 'Ruta requerida' });

        let stat;
        try { stat = fs.statSync(ruta); } catch (_) {
            return res.status(400).json({ error: 'Ruta inválida o no existe' });
        }
        if (!stat.isDirectory()) {
            return res.status(400).json({ error: 'La ruta debe ser un directorio' });
        }

        const imagenes = escanearRecursivo(ruta);

        let importadas = 0;
        let actualizadas = 0;
        let ignoradas = 0;

        let fotosActuales = 0;
        if (!req.esAutenticado) {
            const { count } = await db.get("SELECT COUNT(*) as count FROM fotos WHERE en_papelera = 0");
            fotosActuales = count;
        }

        for (const rutaImagen of imagenes) {
            if (!req.esAutenticado && fotosActuales >= LIMITE_DEMO) {
                ignoradas++;
                continue;
            }

            const existente = await db.get("SELECT id FROM fotos WHERE imagen_url = ?", [rutaImagen]);
            if (existente) {
                actualizadas++;
            } else {
                await db.run("INSERT INTO fotos (imagen_url, en_papelera) VALUES (?, 0)", [rutaImagen]);
                importadas++;
                if (!req.esAutenticado) fotosActuales++;
            }
        }

        res.json({ importadas, actualizadas, ignoradas, total: imagenes.length });
    } catch (err) {
        console.error('Error importar-masivo:', err);
        res.status(500).json({ error: 'Error interno al importar' });
    }
});
```

- [ ] **Paso 3: Verificar manualmente con curl**

Con el servidor corriendo (`node server.js`), ejecutar:
```bash
curl -s -X POST http://localhost:5001/api/importar-masivo \
  -H "Content-Type: application/json" \
  -d '{"ruta": "/tmp"}' | python3 -m json.tool
```
Debe devolver un JSON con `importadas`, `actualizadas`, `ignoradas`, `total`.

Probar con ruta inválida:
```bash
curl -s -X POST http://localhost:5001/api/importar-masivo \
  -H "Content-Type: application/json" \
  -d '{"ruta": "/ruta/que/no/existe"}' | python3 -m json.tool
```
Debe devolver `{"error": "Ruta inválida o no existe"}` con status 400.

- [ ] **Paso 4: Commit**

```bash
git add server.js
git commit -m "feat: añadir endpoint POST /api/importar-masivo con escaneo recursivo"
```

---

## Tarea 3: Endpoint GET /api/foto-local en server.js

**Archivos:**
- Modificar: `server.js`

- [ ] **Paso 1: Añadir mapa de MIME types**

Justo después de la constante `EXTENSIONES_IMAGEN` añadida en la tarea anterior, añadir:
```js
const MIME_TIPOS = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.heic': 'image/heic',
    '.bmp': 'image/bmp'
};
```

- [ ] **Paso 2: Añadir el endpoint GET /api/foto-local**

Justo después del endpoint `POST /api/importar-masivo`, añadir:
```js
// SERVIR FOTOS REFERENCIADAS POR RUTA ABSOLUTA
app.get('/api/foto-local', (req, res) => {
    const ruta = req.query.ruta;
    if (!ruta) return res.status(400).json({ error: 'Parámetro ruta requerido' });

    if (!fs.existsSync(ruta)) return res.status(404).json({ error: 'Archivo no encontrado' });

    const ext = path.extname(ruta).toLowerCase();
    res.setHeader('Content-Type', MIME_TIPOS[ext] || 'application/octet-stream');
    fs.createReadStream(ruta).pipe(res);
});
```

- [ ] **Paso 3: Verificar manualmente**

Con el servidor corriendo, abrir en el navegador (o curl):
```
http://localhost:5001/api/foto-local?ruta=/ruta/a/cualquier/imagen.jpg
```
Debe mostrarse la imagen. Con ruta inexistente debe devolver 404.

- [ ] **Paso 4: Commit**

```bash
git add server.js
git commit -m "feat: añadir endpoint GET /api/foto-local para servir fotos referenciadas"
```

---

## Tarea 4: Actualizar getFotoUrl en Galeria.js

**Archivos:**
- Modificar: `src/components/Galeria.js` (líneas 8-13)

- [ ] **Paso 1: Actualizar las constantes y la función getFotoUrl**

Reemplazar las líneas actuales:
```js
const API = 'http://localhost:5001/api';
const URL_FOTOS = 'http://localhost:5001/uploads/';

const getFotoUrl = (foto) => {
    if (!foto?.imagen_url) return '';
    return URL_FOTOS + foto.imagen_url.trim().replace(/ /g, '%20').replace(/\\/g, '/');
};
```
por:
```js
const API = 'http://localhost:5001/api';
const URL_FOTOS = 'http://localhost:5001/uploads/';
const URL_FOTO_LOCAL = 'http://localhost:5001/api/foto-local?ruta=';

const esRutaAbsoluta = (url) =>
    /^[A-Za-z]:[\\\/]/.test(url) || url.startsWith('/');

const getFotoUrl = (foto) => {
    if (!foto?.imagen_url) return '';
    const url = foto.imagen_url.trim();
    if (esRutaAbsoluta(url)) {
        return URL_FOTO_LOCAL + encodeURIComponent(url);
    }
    return URL_FOTOS + url.replace(/ /g, '%20').replace(/\\/g, '/');
};
```

- [ ] **Paso 2: Verificar que las fotos existentes siguen mostrándose**

En la app, navegar a Galería. Las fotos ya importadas deben seguir apareciendo correctamente (sus `imagen_url` son solo nombres de archivo, no rutas absolutas, así que siguen usando `/uploads/`).

- [ ] **Paso 3: Commit**

```bash
git add src/components/Galeria.js
git commit -m "feat: actualizar getFotoUrl para soportar rutas absolutas via /api/foto-local"
```

---

## Tarea 5: Barra de importación masiva en Galeria.js

**Archivos:**
- Modificar: `src/components/Galeria.js`

- [ ] **Paso 1: Añadir estados de importación**

Dentro del componente `Galeria`, justo después de `const [fotoZoom, setFotoZoom] = useState(null);`, añadir:
```js
const [rutaImport, setRutaImport] = useState('');
const [importando, setImportando] = useState(false);
const [resultadoImport, setResultadoImport] = useState(null);
```

- [ ] **Paso 2: Añadir handlers de importación**

Justo después de la función `cargar`, añadir:
```js
const seleccionarCarpeta = async () => {
    try {
        const { ipcRenderer } = window.require('electron');
        const ruta = await ipcRenderer.invoke('seleccionar-carpeta');
        if (ruta) {
            setRutaImport(ruta);
            setResultadoImport(null);
        }
    } catch (e) {
        console.error('IPC no disponible:', e);
    }
};

const importarMasivo = async () => {
    if (!rutaImport) return;
    setImportando(true);
    setResultadoImport(null);
    try {
        const res = await apiFetch(`${API}/importar-masivo`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ruta: rutaImport })
        });
        const data = await res.json();
        if (res.ok) {
            setResultadoImport(data);
            cargar();
        } else {
            setResultadoImport({ error: data.error });
        }
    } catch (_) {
        setResultadoImport({ error: 'Error de conexión' });
    } finally {
        setImportando(false);
    }
};
```

- [ ] **Paso 3: Añadir JSX de la barra de importación**

En el JSX del componente, justo antes de `<main className="masonry-grid">`, insertar:
```jsx
{/* BARRA DE IMPORTACIÓN MASIVA */}
<div className="import-bar">
    <button className="btn-import" onClick={seleccionarCarpeta} disabled={importando}>
        📂 SELECCIONAR DISCO/CARPETA
    </button>
    {rutaImport && (
        <span className="import-ruta" title={rutaImport}>{rutaImport}</span>
    )}
    {rutaImport && (
        <button
            className="btn-import btn-import-action"
            onClick={importarMasivo}
            disabled={importando}
        >
            {importando ? '⏳ Importando...' : '⚡ IMPORTAR TODAS'}
        </button>
    )}
    {resultadoImport && !resultadoImport.error && (
        <span className="import-resultado">
            ✅ {resultadoImport.importadas} importadas · {resultadoImport.actualizadas} actualizadas · {resultadoImport.ignoradas} ignoradas
        </span>
    )}
    {resultadoImport?.error && (
        <span className="import-error">❌ {resultadoImport.error}</span>
    )}
</div>
```

- [ ] **Paso 4: Verificar en la app**

Con la app corriendo, ir a `/galeria-completa`. Debe verse la barra de importación debajo del header y encima de la galería. El botón "SELECCIONAR DISCO/CARPETA" debe aparecer. Si se hace clic, debe abrirse el diálogo nativo del OS.

- [ ] **Paso 5: Commit**

```bash
git add src/components/Galeria.js
git commit -m "feat: añadir barra de importación masiva en Galería para todos los usuarios"
```

---

## Tarea 6: Estilos CSS de la barra de importación

**Archivos:**
- Modificar: `src/components/galeria.css`

- [ ] **Paso 1: Añadir estilos al final de galeria.css**

Añadir al final del archivo:
```css
/* =============================================================================
   BARRA DE IMPORTACIÓN MASIVA
   ============================================================================= */

.import-bar {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 20px;
    background: rgba(0, 242, 255, 0.04);
    border-bottom: 1px solid rgba(0, 242, 255, 0.15);
    flex-wrap: wrap;
}

.btn-import {
    padding: 8px 16px;
    background: transparent;
    border: 1px solid var(--cian-neon);
    color: var(--cian-neon);
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.8rem;
    font-weight: bold;
    letter-spacing: 0.05em;
    font-family: inherit;
    transition: background 0.2s, box-shadow 0.2s;
}

.btn-import:hover:not(:disabled) {
    background: rgba(0, 242, 255, 0.08);
    box-shadow: 0 0 10px rgba(0, 242, 255, 0.25);
}

.btn-import:disabled {
    opacity: 0.45;
    cursor: not-allowed;
}

.btn-import-action {
    border-color: #ff9f0a;
    color: #ff9f0a;
}

.btn-import-action:hover:not(:disabled) {
    background: rgba(255, 159, 10, 0.08);
    box-shadow: 0 0 10px rgba(255, 159, 10, 0.25);
}

.import-ruta {
    color: rgba(255, 255, 255, 0.6);
    font-size: 0.78rem;
    font-family: monospace;
    background: rgba(255, 255, 255, 0.04);
    padding: 4px 10px;
    border-radius: 4px;
    max-width: 320px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.import-resultado {
    color: #4ade80;
    font-size: 0.8rem;
    font-weight: bold;
}

.import-error {
    color: #f87171;
    font-size: 0.8rem;
    font-weight: bold;
}
```

- [ ] **Paso 2: Verificar visualmente**

En la app, la barra de importación debe verse integrada con el estilo neón del resto de la galería: fondo oscuro con borde cian sutil, botones con borde cian/ámbar, texto de ruta en monospace.

- [ ] **Paso 3: Commit final**

```bash
git add src/components/galeria.css
git commit -m "feat: estilos neón para barra de importación masiva"
```

---

## Verificación final de integración

- [ ] Arrancar la app: `npm run electron-dev` (asegurarse de que `server.js` está corriendo también)
- [ ] Ir a Galería (`/galeria-completa`)
- [ ] Hacer clic en `📂 SELECCIONAR DISCO/CARPETA` → debe abrir el diálogo nativo
- [ ] Seleccionar una carpeta con imágenes → la ruta aparece en la barra
- [ ] Hacer clic en `⚡ IMPORTAR TODAS` → spinner de "Importando..."
- [ ] Al terminar: mensaje `✅ N importadas · N actualizadas · N ignoradas`
- [ ] Las fotos importadas aparecen en la galería, cargadas desde `/api/foto-local`
- [ ] Repetir la importación con la misma carpeta → todas deben marcarse como "actualizadas" (0 importadas nuevas)
- [ ] Con usuario demo: importar más de 50 fotos → las que excedan deben quedar como "ignoradas"
