# ARCHIPEG v2.0 — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rediseñar ARCHIPEG con estilo Dark Premium, galería Masonry, sidebar fijo y 7 nuevas formas de organización (álbumes, eventos, personas, lugares, años, tags, favoritos).

**Architecture:** Sidebar fijo izquierdo como componente `Layout` que envuelve todas las vistas internas. Nuevas tablas SQLite en el backend + nuevos endpoints REST. El frontend usa CSS `columns` nativo para el masonry y variables CSS globales para el tema Dark Premium.

**Tech Stack:** React 18, React Router v6 (HashRouter), Express, SQLite, CSS nativo (sin librerías de UI adicionales)

---

## Mapa de archivos

### Modificados
- `server.js` — migraciones DB + nuevos endpoints
- `src/App.js` — nuevas rutas + Layout wrapper
- `src/App.css` — variables Dark Premium globales
- `src/components/Galeria.js` — masonry + favorito en card
- `src/components/ModalZoom.js` — estilo Dark Premium + panel info
- `src/components/AdminPanel.js` — nuevos campos (lugar, personas, álbum, favorito)
- `src/components/Indice.js` — rediseño Dark Premium

### Creados
- `src/components/Layout.js` — wrapper con Sidebar para páginas internas
- `src/components/Sidebar.js` — navegación lateral fija
- `src/components/sidebar.css` — estilos del sidebar
- `src/components/Albumes.js` — lista + CRUD de álbumes
- `src/components/AlbumDetalle.js` — vista de un álbum
- `src/components/Eventos.js` — lista + CRUD de eventos
- `src/components/Personas.js` — lista + CRUD de personas
- `src/components/Lugares.js` — lista de lugares únicos
- `src/components/Favoritos.js` — galería de favoritos
- `src/components/Tags.js` — nube de tags + filtro

---

## Tarea 1: Migraciones DB y nuevos endpoints en server.js

**Archivos:**
- Modificar: `server.js`

- [ ] **Paso 1: Añadir las migraciones en `inicializarMotor`**

En `server.js`, dentro de `inicializarMotor()`, después del `CREATE TABLE IF NOT EXISTS fotos`, añadir:

```js
// Migraciones para columnas nuevas en fotos
await db.exec(`ALTER TABLE fotos ADD COLUMN favorito INTEGER DEFAULT 0`).catch(() => {});
await db.exec(`ALTER TABLE fotos ADD COLUMN lugar TEXT`).catch(() => {});

// Nuevas tablas
await db.exec(`
    CREATE TABLE IF NOT EXISTS albumes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL,
        descripcion TEXT,
        portada_id INTEGER,
        creado_en TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS album_fotos (
        album_id INTEGER,
        foto_id INTEGER,
        PRIMARY KEY (album_id, foto_id)
    );
    CREATE TABLE IF NOT EXISTS eventos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL,
        fecha_inicio TEXT,
        fecha_fin TEXT,
        descripcion TEXT
    );
    CREATE TABLE IF NOT EXISTS evento_fotos (
        evento_id INTEGER,
        foto_id INTEGER,
        PRIMARY KEY (evento_id, foto_id)
    );
    CREATE TABLE IF NOT EXISTS personas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS foto_personas (
        foto_id INTEGER,
        persona_id INTEGER,
        PRIMARY KEY (foto_id, persona_id)
    );
`);
```

- [ ] **Paso 2: Añadir endpoints de favorito, lugar y tags**

Añadir antes del bloque `// --- LANZAMIENTO ---`:

```js
// FAVORITO — toggle
app.patch('/api/fotos/:id/favorito', async (req, res) => {
    try {
        const foto = await db.get("SELECT favorito FROM fotos WHERE id = ?", [req.params.id]);
        if (!foto) return res.status(404).json({ error: "No encontrada" });
        const nuevo = foto.favorito ? 0 : 1;
        await db.run("UPDATE fotos SET favorito = ? WHERE id = ?", [nuevo, req.params.id]);
        res.json({ favorito: nuevo });
    } catch (err) { res.status(500).json(err); }
});

// FAVORITOS — listar
app.get('/api/favoritos', async (req, res) => {
    try {
        const fotos = await db.all("SELECT * FROM fotos WHERE favorito = 1 AND en_papelera = 0 ORDER BY id DESC");
        res.json(fotos.map(f => ({ ...f, etiquetas: f.etiquetas || "" })));
    } catch (err) { res.status(500).json(err); }
});

// LUGAR — actualizar
app.patch('/api/fotos/:id/lugar', async (req, res) => {
    try {
        const { lugar } = req.body;
        await db.run("UPDATE fotos SET lugar = ? WHERE id = ?", [lugar, req.params.id]);
        res.json({ ok: true });
    } catch (err) { res.status(500).json(err); }
});

// LUGARES — listar únicos con conteo
app.get('/api/lugares', async (req, res) => {
    try {
        const lugares = await db.all(
            "SELECT lugar, COUNT(*) as total FROM fotos WHERE lugar IS NOT NULL AND lugar != '' AND en_papelera = 0 GROUP BY lugar ORDER BY total DESC"
        );
        res.json(lugares);
    } catch (err) { res.status(500).json(err); }
});

// TAGS — listar únicos con frecuencia
app.get('/api/tags', async (req, res) => {
    try {
        const fotos = await db.all("SELECT etiquetas FROM fotos WHERE etiquetas IS NOT NULL AND etiquetas != '' AND en_papelera = 0");
        const contador = {};
        fotos.forEach(f => {
            f.etiquetas.split(',').forEach(t => {
                const tag = t.trim();
                if (tag) contador[tag] = (contador[tag] || 0) + 1;
            });
        });
        const tags = Object.entries(contador).map(([tag, total]) => ({ tag, total })).sort((a, b) => b.total - a.total);
        res.json(tags);
    } catch (err) { res.status(500).json(err); }
});

// ÁLBUMES — CRUD
app.get('/api/albumes', async (req, res) => {
    try {
        const albumes = await db.all("SELECT a.*, COUNT(af.foto_id) as total FROM albumes a LEFT JOIN album_fotos af ON a.id = af.album_id GROUP BY a.id ORDER BY a.creado_en DESC");
        res.json(albumes);
    } catch (err) { res.status(500).json(err); }
});

app.post('/api/albumes', async (req, res) => {
    try {
        const { nombre, descripcion } = req.body;
        if (!nombre) return res.status(400).json({ error: "Nombre requerido" });
        const result = await db.run("INSERT INTO albumes (nombre, descripcion) VALUES (?, ?)", [nombre, descripcion || ""]);
        res.json({ id: result.lastID, nombre, descripcion });
    } catch (err) { res.status(500).json(err); }
});

app.delete('/api/albumes/:id', async (req, res) => {
    try {
        await db.run("DELETE FROM album_fotos WHERE album_id = ?", [req.params.id]);
        await db.run("DELETE FROM albumes WHERE id = ?", [req.params.id]);
        res.json({ ok: true });
    } catch (err) { res.status(500).json(err); }
});

app.get('/api/albumes/:id/fotos', async (req, res) => {
    try {
        const fotos = await db.all(
            "SELECT f.* FROM fotos f JOIN album_fotos af ON f.id = af.foto_id WHERE af.album_id = ? AND f.en_papelera = 0",
            [req.params.id]
        );
        res.json(fotos.map(f => ({ ...f, etiquetas: f.etiquetas || "" })));
    } catch (err) { res.status(500).json(err); }
});

app.post('/api/albumes/:id/fotos', async (req, res) => {
    try {
        const { foto_id } = req.body;
        await db.run("INSERT OR IGNORE INTO album_fotos (album_id, foto_id) VALUES (?, ?)", [req.params.id, foto_id]);
        res.json({ ok: true });
    } catch (err) { res.status(500).json(err); }
});

app.delete('/api/albumes/:id/fotos/:fotoId', async (req, res) => {
    try {
        await db.run("DELETE FROM album_fotos WHERE album_id = ? AND foto_id = ?", [req.params.id, req.params.fotoId]);
        res.json({ ok: true });
    } catch (err) { res.status(500).json(err); }
});

// EVENTOS — CRUD
app.get('/api/eventos', async (req, res) => {
    try {
        const eventos = await db.all("SELECT e.*, COUNT(ef.foto_id) as total FROM eventos e LEFT JOIN evento_fotos ef ON e.id = ef.evento_id GROUP BY e.id ORDER BY e.fecha_inicio DESC");
        res.json(eventos);
    } catch (err) { res.status(500).json(err); }
});

app.post('/api/eventos', async (req, res) => {
    try {
        const { nombre, fecha_inicio, fecha_fin, descripcion } = req.body;
        if (!nombre) return res.status(400).json({ error: "Nombre requerido" });
        const result = await db.run("INSERT INTO eventos (nombre, fecha_inicio, fecha_fin, descripcion) VALUES (?, ?, ?, ?)", [nombre, fecha_inicio || "", fecha_fin || "", descripcion || ""]);
        res.json({ id: result.lastID, nombre });
    } catch (err) { res.status(500).json(err); }
});

app.delete('/api/eventos/:id', async (req, res) => {
    try {
        await db.run("DELETE FROM evento_fotos WHERE evento_id = ?", [req.params.id]);
        await db.run("DELETE FROM eventos WHERE id = ?", [req.params.id]);
        res.json({ ok: true });
    } catch (err) { res.status(500).json(err); }
});

app.get('/api/eventos/:id/fotos', async (req, res) => {
    try {
        const fotos = await db.all(
            "SELECT f.* FROM fotos f JOIN evento_fotos ef ON f.id = ef.foto_id WHERE ef.evento_id = ? AND f.en_papelera = 0",
            [req.params.id]
        );
        res.json(fotos.map(f => ({ ...f, etiquetas: f.etiquetas || "" })));
    } catch (err) { res.status(500).json(err); }
});

app.post('/api/eventos/:id/fotos', async (req, res) => {
    try {
        const { foto_id } = req.body;
        await db.run("INSERT OR IGNORE INTO evento_fotos (evento_id, foto_id) VALUES (?, ?)", [req.params.id, foto_id]);
        res.json({ ok: true });
    } catch (err) { res.status(500).json(err); }
});

// PERSONAS — CRUD
app.get('/api/personas', async (req, res) => {
    try {
        const personas = await db.all("SELECT p.*, COUNT(fp.foto_id) as total FROM personas p LEFT JOIN foto_personas fp ON p.id = fp.persona_id GROUP BY p.id ORDER BY p.nombre");
        res.json(personas);
    } catch (err) { res.status(500).json(err); }
});

app.post('/api/personas', async (req, res) => {
    try {
        const { nombre } = req.body;
        if (!nombre) return res.status(400).json({ error: "Nombre requerido" });
        const result = await db.run("INSERT INTO personas (nombre) VALUES (?)", [nombre]);
        res.json({ id: result.lastID, nombre });
    } catch (err) { res.status(500).json(err); }
});

app.delete('/api/personas/:id', async (req, res) => {
    try {
        await db.run("DELETE FROM foto_personas WHERE persona_id = ?", [req.params.id]);
        await db.run("DELETE FROM personas WHERE id = ?", [req.params.id]);
        res.json({ ok: true });
    } catch (err) { res.status(500).json(err); }
});

app.get('/api/personas/:id/fotos', async (req, res) => {
    try {
        const fotos = await db.all(
            "SELECT f.* FROM fotos f JOIN foto_personas fp ON f.id = fp.foto_id WHERE fp.persona_id = ? AND f.en_papelera = 0",
            [req.params.id]
        );
        res.json(fotos.map(f => ({ ...f, etiquetas: f.etiquetas || "" })));
    } catch (err) { res.status(500).json(err); }
});

app.post('/api/fotos/:id/personas', async (req, res) => {
    try {
        const { persona_ids } = req.body; // array de IDs
        await db.run("DELETE FROM foto_personas WHERE foto_id = ?", [req.params.id]);
        for (const pid of (persona_ids || [])) {
            await db.run("INSERT OR IGNORE INTO foto_personas (foto_id, persona_id) VALUES (?, ?)", [req.params.id, pid]);
        }
        res.json({ ok: true });
    } catch (err) { res.status(500).json(err); }
});

app.get('/api/fotos/:id/personas', async (req, res) => {
    try {
        const personas = await db.all(
            "SELECT p.* FROM personas p JOIN foto_personas fp ON p.id = fp.persona_id WHERE fp.foto_id = ?",
            [req.params.id]
        );
        res.json(personas);
    } catch (err) { res.status(500).json(err); }
});
```

- [ ] **Paso 3: Verificar que el backend arranca sin errores**

```bash
# Matar backend anterior y relanzar
lsof -ti:5001 | xargs kill -9 2>/dev/null
node server.js &
sleep 2
curl -s http://localhost:5001/api/favoritos
curl -s http://localhost:5001/api/albumes
curl -s http://localhost:5001/api/personas
curl -s http://localhost:5001/api/tags
curl -s http://localhost:5001/api/lugares
```

Salida esperada: `[]` en cada endpoint (tablas vacías).

- [ ] **Paso 4: Commit**

```bash
git add server.js
git commit -m "feat: migraciones DB y nuevos endpoints para albumes, eventos, personas, lugares, tags, favoritos"
```

---

## Tarea 2: Tema Dark Premium global (CSS variables)

**Archivos:**
- Modificar: `src/App.css`

- [ ] **Paso 1: Reemplazar las variables CSS en `src/App.css`**

Reemplazar el bloque `:root { ... }` existente con:

```css
:root {
    --bg-principal: #111111;
    --bg-superficie: #1c1c1e;
    --bg-elevado: #2c2c2e;
    --bg-hover: #3a3a3c;
    --acento: #ff9f0a;
    --acento-suave: rgba(255, 159, 10, 0.15);
    --texto-primario: #f5f5f7;
    --texto-secundario: #888888;
    --borde: #222222;
    --borde-suave: #333333;
    --shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
    --radio: 10px;
    --radio-sm: 6px;
    --font: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

* { box-sizing: border-box; margin: 0; padding: 0; }

body {
    font-family: var(--font) !important;
    background-color: var(--bg-principal) !important;
    color: var(--texto-primario);
    line-height: 1.5;
    overflow-x: hidden;
}

/* Scrollbar personalizado */
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: var(--bg-principal); }
::-webkit-scrollbar-thumb { background: var(--bg-hover); border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: #555; }

/* Utilidades globales */
.btn-acento {
    background: var(--acento);
    color: #000;
    border: none;
    border-radius: var(--radio-sm);
    padding: 9px 18px;
    font-size: 0.8rem;
    font-weight: 700;
    cursor: pointer;
    letter-spacing: 0.02em;
    transition: opacity 0.15s;
}
.btn-acento:hover { opacity: 0.85; }

.btn-ghost {
    background: var(--bg-elevado);
    color: var(--texto-secundario);
    border: none;
    border-radius: var(--radio-sm);
    padding: 7px 14px;
    font-size: 0.78rem;
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
}
.btn-ghost:hover { background: var(--bg-hover); color: var(--texto-primario); }

.btn-peligro {
    background: rgba(255, 59, 48, 0.15);
    color: #ff3b30;
    border: 1px solid rgba(255, 59, 48, 0.3);
    border-radius: var(--radio-sm);
    padding: 7px 14px;
    font-size: 0.78rem;
    cursor: pointer;
}
.btn-peligro:hover { background: rgba(255, 59, 48, 0.25); }

input, textarea, select {
    background: var(--bg-elevado);
    color: var(--texto-primario);
    border: 1px solid var(--borde-suave);
    border-radius: var(--radio-sm);
    padding: 8px 12px;
    font-size: 0.82rem;
    font-family: var(--font);
    outline: none;
    transition: border-color 0.15s;
}
input:focus, textarea:focus, select:focus {
    border-color: var(--acento);
}
input::placeholder, textarea::placeholder { color: var(--texto-secundario); }

.marca-agua-fondo { display: none; }
```

- [ ] **Paso 2: Verificar que el body aplica el fondo oscuro**

Abrir `http://localhost:3000` en el navegador. El fondo debe ser `#111`. Si hay páginas con fondo claro forzado por CSS de componentes, se arreglará en tareas posteriores.

- [ ] **Paso 3: Commit**

```bash
git add src/App.css
git commit -m "feat: tema Dark Premium con variables CSS globales"
```

---

## Tarea 3: Componente Sidebar + Layout wrapper

**Archivos:**
- Crear: `src/components/Sidebar.js`
- Crear: `src/components/sidebar.css`
- Crear: `src/components/Layout.js`
- Modificar: `src/App.js`

- [ ] **Paso 1: Crear `src/components/sidebar.css`**

```css
.sidebar {
    width: 210px;
    min-width: 210px;
    background: #0a0a0a;
    border-right: 1px solid var(--borde);
    display: flex;
    flex-direction: column;
    height: 100vh;
    position: sticky;
    top: 0;
    overflow-y: auto;
    flex-shrink: 0;
}

.sidebar-brand {
    padding: 20px 16px 14px;
    border-bottom: 1px solid var(--borde);
}

.sidebar-brand-name {
    font-size: 0.95rem;
    font-weight: 700;
    color: var(--texto-primario);
    letter-spacing: 0.04em;
}

.sidebar-brand-dot { color: var(--acento); }

.sidebar-brand-version {
    font-size: 0.6rem;
    color: var(--texto-secundario);
    margin-top: 3px;
}

.sidebar-search {
    padding: 12px 12px 6px;
}

.sidebar-search input {
    width: 100%;
    font-size: 0.75rem;
    padding: 7px 10px;
    border-radius: 8px;
    border: none;
    background: var(--bg-elevado);
}

.sidebar-nav {
    padding: 6px 8px;
    flex: 1;
    overflow-y: auto;
}

.sidebar-section-label {
    font-size: 0.58rem;
    color: var(--texto-secundario);
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    padding: 10px 8px 4px;
}

.sidebar-item {
    display: flex;
    align-items: center;
    gap: 9px;
    padding: 7px 8px;
    border-radius: 7px;
    cursor: pointer;
    font-size: 0.77rem;
    color: var(--texto-secundario);
    margin-bottom: 1px;
    text-decoration: none;
    transition: background 0.12s, color 0.12s;
    border: none;
    background: transparent;
    width: 100%;
    text-align: left;
}

.sidebar-item:hover {
    background: var(--bg-elevado);
    color: var(--texto-primario);
}

.sidebar-item.active {
    background: var(--bg-elevado);
    color: var(--texto-primario);
}

.sidebar-item.active .sidebar-item-icon { color: var(--acento); }

.sidebar-item-badge {
    margin-left: auto;
    font-size: 0.62rem;
    padding: 1px 7px;
    border-radius: 10px;
    background: var(--bg-elevado);
    color: var(--texto-secundario);
}

.sidebar-item.active .sidebar-item-badge {
    background: var(--acento-suave);
    color: var(--acento);
}

.sidebar-bottom {
    padding: 12px;
    border-top: 1px solid var(--borde);
}

.sidebar-demo-info {
    font-size: 0.62rem;
    color: var(--texto-secundario);
    margin-bottom: 8px;
    text-align: center;
}

.sidebar-demo-bar {
    background: var(--bg-elevado);
    border-radius: 4px;
    height: 4px;
    margin-bottom: 10px;
    overflow: hidden;
}

.sidebar-demo-bar-fill {
    height: 100%;
    background: var(--acento);
    border-radius: 4px;
    transition: width 0.3s;
}

.sidebar-upload-btn {
    width: 100%;
    background: var(--acento);
    color: #000;
    border: none;
    border-radius: 8px;
    padding: 10px;
    font-size: 0.78rem;
    font-weight: 700;
    cursor: pointer;
    letter-spacing: 0.03em;
    transition: opacity 0.15s;
}

.sidebar-upload-btn:hover { opacity: 0.85; }

/* LAYOUT */
.app-layout {
    display: flex;
    min-height: 100vh;
}

.app-main {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
}
```

- [ ] **Paso 2: Crear `src/components/Sidebar.js`**

```jsx
import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import './sidebar.css';

const API = 'http://localhost:5001/api';

const Sidebar = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const [conteos, setConteos] = useState({ fotos: 0, favoritos: 0, albumes: 0, eventos: 0, personas: 0, lugares: 0 });
    const [busqueda, setBusqueda] = useState('');

    useEffect(() => {
        const cargar = async () => {
            try {
                const [fotos, favs, albs, evs, pers, lugs] = await Promise.all([
                    fetch(`${API}/imagenes`).then(r => r.json()),
                    fetch(`${API}/favoritos`).then(r => r.json()),
                    fetch(`${API}/albumes`).then(r => r.json()),
                    fetch(`${API}/eventos`).then(r => r.json()),
                    fetch(`${API}/personas`).then(r => r.json()),
                    fetch(`${API}/lugares`).then(r => r.json()),
                ]);
                setConteos({
                    fotos: fotos.length,
                    favoritos: favs.length,
                    albumes: albs.length,
                    eventos: evs.length,
                    personas: pers.length,
                    lugares: lugs.length,
                });
            } catch (e) { /* servidor no disponible */ }
        };
        cargar();
    }, [location.pathname]);

    const LIMITE = 50;
    const porcentaje = Math.min((conteos.fotos / LIMITE) * 100, 100);

    const isActive = (path) => location.pathname === path;

    const handleBusqueda = (e) => {
        if (e.key === 'Enter' && busqueda.trim()) {
            navigate(`/galeria-completa?q=${encodeURIComponent(busqueda.trim())}`);
            setBusqueda('');
        }
    };

    return (
        <aside className="sidebar">
            <div className="sidebar-brand">
                <div className="sidebar-brand-name">ARCHIPEG<span className="sidebar-brand-dot"> ·</span></div>
                <div className="sidebar-brand-version">v2.0 · DEMO</div>
            </div>

            <div className="sidebar-search">
                <input
                    type="text"
                    placeholder="🔍 Buscar fotos..."
                    value={busqueda}
                    onChange={e => setBusqueda(e.target.value)}
                    onKeyDown={handleBusqueda}
                />
            </div>

            <nav className="sidebar-nav">
                <div className="sidebar-section-label">Biblioteca</div>
                <Link to="/galeria-completa" className={`sidebar-item ${isActive('/galeria-completa') ? 'active' : ''}`}>
                    <span className="sidebar-item-icon">🖼️</span> Todas las fotos
                    <span className="sidebar-item-badge">{conteos.fotos}</span>
                </Link>
                <Link to="/favoritos" className={`sidebar-item ${isActive('/favoritos') ? 'active' : ''}`}>
                    <span className="sidebar-item-icon">⭐</span> Favoritos
                    <span className="sidebar-item-badge">{conteos.favoritos}</span>
                </Link>

                <div className="sidebar-section-label">Organizar</div>
                <Link to="/albumes" className={`sidebar-item ${isActive('/albumes') ? 'active' : ''}`}>
                    <span className="sidebar-item-icon">📁</span> Álbumes
                    <span className="sidebar-item-badge">{conteos.albumes}</span>
                </Link>
                <Link to="/eventos" className={`sidebar-item ${isActive('/eventos') ? 'active' : ''}`}>
                    <span className="sidebar-item-icon">📅</span> Eventos
                    <span className="sidebar-item-badge">{conteos.eventos}</span>
                </Link>
                <Link to="/personas" className={`sidebar-item ${isActive('/personas') ? 'active' : ''}`}>
                    <span className="sidebar-item-icon">👤</span> Personas
                    <span className="sidebar-item-badge">{conteos.personas}</span>
                </Link>
                <Link to="/lugares" className={`sidebar-item ${isActive('/lugares') ? 'active' : ''}`}>
                    <span className="sidebar-item-icon">📍</span> Lugares
                    <span className="sidebar-item-badge">{conteos.lugares}</span>
                </Link>

                <div className="sidebar-section-label">Explorar</div>
                <Link to="/tags" className={`sidebar-item ${isActive('/tags') ? 'active' : ''}`}>
                    <span className="sidebar-item-icon">🏷️</span> Tags
                </Link>
                <Link to="/mapa" className={`sidebar-item ${isActive('/mapa') ? 'active' : ''}`}>
                    <span className="sidebar-item-icon">🗺️</span> Mapa
                </Link>

                <div className="sidebar-section-label">Sistema</div>
                <Link to="/admin" className={`sidebar-item ${isActive('/admin') ? 'active' : ''}`}>
                    <span className="sidebar-item-icon">⚙️</span> Gestión
                </Link>
                <Link to="/papelera" className={`sidebar-item ${isActive('/papelera') ? 'active' : ''}`}>
                    <span className="sidebar-item-icon">🗑️</span> Papelera
                </Link>
            </nav>

            <div className="sidebar-bottom">
                <div className="sidebar-demo-info">{conteos.fotos}/{LIMITE} fotos (DEMO)</div>
                <div className="sidebar-demo-bar">
                    <div className="sidebar-demo-bar-fill" style={{ width: `${porcentaje}%` }}></div>
                </div>
                <button className="sidebar-upload-btn" onClick={() => navigate('/admin')}>
                    + SUBIR FOTOS
                </button>
            </div>
        </aside>
    );
};

export default Sidebar;
```

- [ ] **Paso 3: Crear `src/components/Layout.js`**

```jsx
import React from 'react';
import Sidebar from './Sidebar';
import './sidebar.css';

const Layout = ({ children }) => (
    <div className="app-layout">
        <Sidebar />
        <main className="app-main">
            {children}
        </main>
    </div>
);

export default Layout;
```

- [ ] **Paso 4: Actualizar `src/App.js` con nuevas rutas y Layout**

```jsx
import React from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Indice from './components/Indice';
import Galeria from './components/Galeria';
import AdminPanel from './components/AdminPanel';
import Papelera from './components/Papelera';
import VistaAnio from './components/VistaAnio';
import Albumes from './components/Albumes';
import AlbumDetalle from './components/AlbumDetalle';
import Eventos from './components/Eventos';
import Personas from './components/Personas';
import Lugares from './components/Lugares';
import Favoritos from './components/Favoritos';
import Tags from './components/Tags';
import './App.css';

const withLayout = (Component) => (props) => (
    <Layout><Component {...props} /></Layout>
);

const GaleriaConLayout = withLayout(Galeria);
const AdminConLayout = withLayout(AdminPanel);
const PapeleraConLayout = withLayout(Papelera);
const VistaAnioConLayout = withLayout(VistaAnio);
const AlbumesConLayout = withLayout(Albumes);
const AlbumDetalleConLayout = withLayout(AlbumDetalle);
const EventosConLayout = withLayout(Eventos);
const PersonasConLayout = withLayout(Personas);
const LugaresConLayout = withLayout(Lugares);
const FavoritosConLayout = withLayout(Favoritos);
const TagsConLayout = withLayout(Tags);

function App() {
    return (
        <Router>
            <Routes>
                <Route path="/" element={<Indice />} />
                <Route path="/galeria-completa" element={<GaleriaConLayout />} />
                <Route path="/anio/:anio" element={<VistaAnioConLayout />} />
                <Route path="/galeria/:anio" element={<VistaAnioConLayout />} />
                <Route path="/admin" element={<AdminConLayout />} />
                <Route path="/papelera" element={<PapeleraConLayout />} />
                <Route path="/albumes" element={<AlbumesConLayout />} />
                <Route path="/albumes/:id" element={<AlbumDetalleConLayout />} />
                <Route path="/eventos" element={<EventosConLayout />} />
                <Route path="/personas" element={<PersonasConLayout />} />
                <Route path="/lugares" element={<LugaresConLayout />} />
                <Route path="/favoritos" element={<FavoritosConLayout />} />
                <Route path="/tags" element={<TagsConLayout />} />
            </Routes>
        </Router>
    );
}

export default App;
```

- [ ] **Paso 5: Crear stubs vacíos para los componentes nuevos** (para que el build no falle)

Crear cada archivo con un componente mínimo. Ejecutar en la terminal:

```bash
for comp in Albumes AlbumDetalle Eventos Personas Lugares Favoritos Tags; do
cat > /Users/franciscovalero/Desktop/proyectos/ARCHIPEG/src/components/${comp}.js << 'EOF'
import React from 'react';
const Component = () => <div style={{padding:'40px',color:'var(--texto-primario)'}}>Cargando...</div>;
export default Component;
EOF
done
```

- [ ] **Paso 6: Verificar que el build no falla**

```bash
cd /Users/franciscovalero/Desktop/proyectos/ARCHIPEG
CI=true npm run build 2>&1 | tail -8
```

Salida esperada: `The build folder is ready to be deployed.`

- [ ] **Paso 7: Commit**

```bash
git add src/components/Sidebar.js src/components/sidebar.css src/components/Layout.js src/App.js src/components/Albumes.js src/components/AlbumDetalle.js src/components/Eventos.js src/components/Personas.js src/components/Lugares.js src/components/Favoritos.js src/components/Tags.js
git commit -m "feat: sidebar fijo + layout wrapper + rutas nuevas"
```

---

## Tarea 4: Galería Masonry con favorito en card

**Archivos:**
- Modificar: `src/components/Galeria.js`
- Modificar: `src/components/galeria.css` (reemplazar por Dark Premium)

- [ ] **Paso 1: Reemplazar `src/components/galeria.css`**

```css
/* ===== GALERÍA DARK PREMIUM ===== */
.galeria-layout {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
    background: var(--bg-principal);
}

.galeria-header {
    padding: 16px 24px;
    border-bottom: 1px solid var(--borde);
    display: flex;
    align-items: center;
    gap: 12px;
    background: var(--bg-principal);
    position: sticky;
    top: 0;
    z-index: 10;
}

.galeria-titulo {
    font-size: 1.05rem;
    font-weight: 600;
    color: var(--texto-primario);
    white-space: nowrap;
}

.galeria-filtros {
    display: flex;
    gap: 8px;
    flex: 1;
    flex-wrap: wrap;
}

.galeria-filtros input,
.galeria-filtros select {
    height: 36px;
    font-size: 0.78rem;
}

.galeria-filtros input { flex: 2; min-width: 140px; }
.galeria-filtros select { flex: 1; min-width: 100px; }

.galeria-acciones {
    display: flex;
    gap: 8px;
}

/* MASONRY */
.masonry-grid {
    padding: 20px 24px;
    column-count: 4;
    column-gap: 12px;
    flex: 1;
}

@media (max-width: 1200px) { .masonry-grid { column-count: 3; } }
@media (max-width: 800px)  { .masonry-grid { column-count: 2; } }
@media (max-width: 480px)  { .masonry-grid { column-count: 1; } }

.foto-card {
    break-inside: avoid;
    margin-bottom: 12px;
    border-radius: var(--radio);
    overflow: hidden;
    position: relative;
    cursor: pointer;
    background: var(--bg-elevado);
    transition: transform 0.15s, box-shadow 0.15s;
}

.foto-card:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow);
}

.foto-card img {
    width: 100%;
    display: block;
    border-radius: var(--radio);
}

.foto-card-overlay {
    position: absolute;
    bottom: 0; left: 0; right: 0;
    background: linear-gradient(transparent, rgba(0,0,0,0.8));
    padding: 28px 10px 10px;
    opacity: 0;
    transition: opacity 0.2s;
    border-radius: 0 0 var(--radio) var(--radio);
}

.foto-card:hover .foto-card-overlay { opacity: 1; }

.foto-card-titulo {
    font-size: 0.75rem;
    font-weight: 600;
    color: #fff;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.foto-card-meta {
    font-size: 0.65rem;
    color: rgba(255,255,255,0.7);
    margin-top: 2px;
}

.foto-card-fav {
    position: absolute;
    top: 8px; right: 8px;
    background: rgba(0,0,0,0.5);
    border: none;
    border-radius: 50%;
    width: 28px; height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.75rem;
    cursor: pointer;
    color: var(--acento);
    transition: background 0.15s, transform 0.1s;
    z-index: 2;
}

.foto-card-fav:hover {
    background: rgba(0,0,0,0.75);
    transform: scale(1.1);
}

.foto-card-seleccionada {
    outline: 2px solid var(--acento);
    outline-offset: -2px;
}

.foto-card-check {
    position: absolute;
    top: 8px; left: 8px;
    background: var(--acento);
    color: #000;
    border-radius: 50%;
    width: 20px; height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.65rem;
    font-weight: 700;
    z-index: 2;
}

/* PAGINACIÓN */
.paginacion {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 8px;
    padding: 16px;
    border-top: 1px solid var(--borde);
}

.paginacion span {
    font-size: 0.8rem;
    color: var(--texto-secundario);
}

/* EMPTY STATE */
.galeria-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 40vh;
    color: var(--texto-secundario);
    gap: 12px;
}

.galeria-empty h3 { font-size: 1rem; font-weight: 500; }
```

- [ ] **Paso 2: Reemplazar `src/components/Galeria.js` completo**

```jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import ModalZoom from './ModalZoom';
import './galeria.css';

const API = 'http://localhost:5001/api';
const URL_FOTOS = 'http://localhost:5001/uploads/';

const getFotoUrl = (foto) => {
    if (!foto?.imagen_url) return '';
    return URL_FOTOS + foto.imagen_url.trim().replace(/ /g, '%20').replace(/\\/g, '/');
};

const normalizar = (str) =>
    str?.toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() || '';

const Galeria = () => {
    const location = useLocation();
    const params = new URLSearchParams(location.search);
    const qInicial = params.get('q') || '';

    const [fotos, setFotos] = useState([]);
    const [busqueda, setBusqueda] = useState(qInicial);
    const [busquedaMes, setBusquedaMes] = useState('');
    const [paginaActual, setPaginaActual] = useState(1);
    const [seleccionadas, setSeleccionadas] = useState([]);
    const [modoSeleccion, setModoSeleccion] = useState(false);
    const [fotoZoom, setFotoZoom] = useState(null);
    const fotosPorPagina = 48;

    const cargar = useCallback(async () => {
        try {
            const res = await fetch(`${API}/imagenes`);
            const data = await res.json();
            setFotos(data);
        } catch (e) { console.error(e); }
    }, []);

    useEffect(() => { cargar(); }, [cargar]);

    const toggleFavorito = async (e, foto) => {
        e.stopPropagation();
        try {
            const res = await fetch(`${API}/fotos/${foto.id}/favorito`, { method: 'PATCH' });
            const { favorito } = await res.json();
            setFotos(prev => prev.map(f => f.id === foto.id ? { ...f, favorito } : f));
        } catch (e) { console.error(e); }
    };

    const borrar = async (id, e) => {
        if (e) e.stopPropagation();
        if (!window.confirm('¿Mover esta foto a la papelera?')) return;
        await fetch(`${API}/imagenes/${id}`, { method: 'DELETE' });
        setFotoZoom(null);
        cargar();
    };

    const borrarSeleccionadas = async () => {
        if (!window.confirm(`¿Mover ${seleccionadas.length} fotos a la papelera?`)) return;
        for (const id of seleccionadas) {
            await fetch(`${API}/imagenes/${id}`, { method: 'DELETE' });
        }
        setSeleccionadas([]);
        setModoSeleccion(false);
        cargar();
    };

    const fotosFiltradas = fotos.filter(f => {
        const bq = normalizar(busqueda).trim();
        const matchTexto = !bq || [f.titulo, f.anio, f.descripcion, f.etiquetas, f.lugar].some(c => normalizar(c).includes(bq));
        const matchMes = !busquedaMes || f.mes?.toString() === busquedaMes;
        return matchTexto && matchMes;
    });

    const totalPaginas = Math.ceil(fotosFiltradas.length / fotosPorPagina);
    const fotosPaginadas = fotosFiltradas.slice((paginaActual - 1) * fotosPorPagina, paginaActual * fotosPorPagina);

    const navegar = (dir) => {
        if (!fotoZoom) return;
        const idx = fotosFiltradas.findIndex(f => f.id === fotoZoom.id);
        const next = dir === 'siguiente'
            ? (idx + 1) % fotosFiltradas.length
            : (idx - 1 + fotosFiltradas.length) % fotosFiltradas.length;
        setFotoZoom(fotosFiltradas[next]);
    };

    const clickCard = (foto) => {
        if (modoSeleccion) {
            setSeleccionadas(prev => prev.includes(foto.id) ? prev.filter(i => i !== foto.id) : [...prev, foto.id]);
        } else {
            setFotoZoom(foto);
        }
    };

    return (
        <div className="galeria-layout">
            <header className="galeria-header">
                <h1 className="galeria-titulo">Todas las fotos</h1>
                <div className="galeria-filtros">
                    <input
                        type="text"
                        placeholder="Buscar por título, año, lugar o tag..."
                        value={busqueda}
                        onChange={e => { setBusqueda(e.target.value); setPaginaActual(1); }}
                    />
                    <select value={busquedaMes} onChange={e => { setBusquedaMes(e.target.value); setPaginaActual(1); }}>
                        <option value="">📅 Todos los meses</option>
                        {['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'].map((m,i) => (
                            <option key={i} value={i+1}>{m}</option>
                        ))}
                    </select>
                </div>
                <div className="galeria-acciones">
                    {seleccionadas.length > 0 && (
                        <button className="btn-peligro" onClick={borrarSeleccionadas}>
                            🗑️ Borrar ({seleccionadas.length})
                        </button>
                    )}
                    <button
                        className="btn-ghost"
                        onClick={() => { setModoSeleccion(m => !m); setSeleccionadas([]); }}
                    >
                        {modoSeleccion ? 'Cancelar' : 'Seleccionar'}
                    </button>
                </div>
            </header>

            {fotosPaginadas.length === 0 ? (
                <div className="galeria-empty">
                    <h3>No hay fotos que coincidan</h3>
                    <button className="btn-ghost" onClick={() => { setBusqueda(''); setBusquedaMes(''); }}>
                        Ver todas
                    </button>
                </div>
            ) : (
                <div className="masonry-grid">
                    {fotosPaginadas.map(foto => (
                        <div
                            key={foto.id}
                            className={`foto-card ${seleccionadas.includes(foto.id) ? 'foto-card-seleccionada' : ''}`}
                            onClick={() => clickCard(foto)}
                        >
                            {modoSeleccion && seleccionadas.includes(foto.id) && (
                                <div className="foto-card-check">✓</div>
                            )}
                            <img src={getFotoUrl(foto)} alt={foto.titulo || ''} loading="lazy" />
                            <button
                                className="foto-card-fav"
                                onClick={e => toggleFavorito(e, foto)}
                                title={foto.favorito ? 'Quitar de favoritos' : 'Añadir a favoritos'}
                            >
                                {foto.favorito ? '⭐' : '☆'}
                            </button>
                            <div className="foto-card-overlay">
                                <div className="foto-card-titulo">{foto.titulo || 'Sin título'}</div>
                                <div className="foto-card-meta">{foto.anio}{foto.lugar ? ` · ${foto.lugar}` : ''}</div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {totalPaginas > 1 && (
                <div className="paginacion">
                    <button className="btn-ghost" disabled={paginaActual === 1} onClick={() => setPaginaActual(p => p - 1)}>← Anterior</button>
                    <span>Página {paginaActual} de {totalPaginas}</span>
                    <button className="btn-ghost" disabled={paginaActual === totalPaginas} onClick={() => setPaginaActual(p => p + 1)}>Siguiente →</button>
                </div>
            )}

            {fotoZoom && (
                <ModalZoom
                    foto={fotoZoom}
                    onClose={() => setFotoZoom(null)}
                    onNavigate={navegar}
                    onBorrar={borrar}
                    getFotoUrl={getFotoUrl}
                    setBusqueda={setBusqueda}
                    onFavoritoToggle={(fotoActualizada) => setFotos(prev => prev.map(f => f.id === fotoActualizada.id ? fotoActualizada : f))}
                />
            )}
        </div>
    );
};

export default Galeria;
```

- [ ] **Paso 3: Verificar manualmente**

Reiniciar el servidor de desarrollo y abrir `http://localhost:3000/#/galeria-completa`. Comprobar:
- Fondo oscuro ✓
- Grid masonry (columnas de ancho variable) ✓
- Botón ⭐ en cada foto ✓
- Al hacer clic en ⭐ cambia de ☆ a ⭐ sin recargar ✓

- [ ] **Paso 4: Commit**

```bash
git add src/components/Galeria.js src/components/galeria.css
git commit -m "feat: galeria masonry Dark Premium con toggle de favorito en card"
```

---

## Tarea 5: Modal Zoom Dark Premium

**Archivos:**
- Modificar: `src/components/ModalZoom.js`
- Modificar: `src/components/modalzoom.css`

- [ ] **Paso 1: Reemplazar `src/components/modalzoom.css`**

```css
.modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.92);
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
}

.modal-contenido {
    background: var(--bg-superficie);
    border: 1px solid var(--borde-suave);
    border-radius: 14px;
    width: 90vw;
    max-width: 1100px;
    max-height: 90vh;
    display: flex;
    overflow: hidden;
    position: relative;
}

.modal-imagen-zona {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #000;
    overflow: hidden;
    position: relative;
    min-height: 300px;
}

.modal-imagen-zona img {
    max-width: 100%;
    max-height: 85vh;
    object-fit: contain;
    user-select: none;
    transition: transform 0.1s ease-out;
}

.modal-nav {
    position: absolute;
    top: 50%; transform: translateY(-50%);
    background: rgba(0,0,0,0.5);
    color: #fff;
    border: none;
    border-radius: 50%;
    width: 38px; height: 38px;
    display: flex; align-items: center; justify-content: center;
    cursor: pointer;
    font-size: 1rem;
    transition: background 0.15s;
    z-index: 2;
}
.modal-nav:hover { background: rgba(0,0,0,0.8); }
.modal-nav-prev { left: 10px; }
.modal-nav-next { right: 10px; }

.modal-panel {
    width: 260px;
    min-width: 260px;
    background: var(--bg-superficie);
    border-left: 1px solid var(--borde);
    padding: 20px 16px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 14px;
}

.modal-cerrar {
    position: absolute;
    top: 12px; right: 278px;
    background: rgba(0,0,0,0.6);
    color: #fff;
    border: none;
    border-radius: 50%;
    width: 30px; height: 30px;
    display: flex; align-items: center; justify-content: center;
    cursor: pointer;
    font-size: 1rem;
    z-index: 3;
}

.modal-panel-titulo {
    font-size: 1rem;
    font-weight: 600;
    color: var(--texto-primario);
    line-height: 1.3;
}

.modal-panel-meta {
    font-size: 0.75rem;
    color: var(--texto-secundario);
}

.modal-panel-label {
    font-size: 0.6rem;
    font-weight: 700;
    letter-spacing: 0.07em;
    text-transform: uppercase;
    color: var(--texto-secundario);
    margin-bottom: 5px;
}

.modal-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
}

.modal-tag {
    background: var(--bg-elevado);
    color: var(--texto-secundario);
    font-size: 0.68rem;
    padding: 3px 9px;
    border-radius: 12px;
    cursor: pointer;
    border: none;
    transition: background 0.12s;
}
.modal-tag:hover { background: var(--bg-hover); color: var(--texto-primario); }

.modal-acciones {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: auto;
}

.modal-zoom-info {
    font-size: 0.62rem;
    color: var(--texto-secundario);
    opacity: 0.7;
    text-align: center;
}
```

- [ ] **Paso 2: Reemplazar `src/components/ModalZoom.js`**

```jsx
import React, { useState, useEffect } from 'react';
import './modalzoom.css';

const API = 'http://localhost:5001/api';

const ModalZoom = ({ foto, onClose, onNavigate, onBorrar, getFotoUrl, setBusqueda, onFavoritoToggle }) => {
    const [escala, setEscala] = useState(1);
    const [pos, setPos] = useState({ x: 0, y: 0 });
    const [arrastrando, setArrastrando] = useState(false);
    const [inicio, setInicio] = useState({ x: 0, y: 0 });
    const [personas, setPersonas] = useState([]);
    const [fotoLocal, setFotoLocal] = useState(foto);

    useEffect(() => { setFotoLocal(foto); setEscala(1); setPos({ x:0, y:0 }); }, [foto]);

    useEffect(() => {
        fetch(`${API}/fotos/${foto.id}/personas`).then(r => r.json()).then(setPersonas).catch(() => {});
    }, [foto.id]);

    useEffect(() => {
        const handler = (e) => {
            if (e.key === 'Escape') onClose();
            if (e.key === 'ArrowRight') { setEscala(1); setPos({x:0,y:0}); onNavigate('siguiente'); }
            if (e.key === 'ArrowLeft') { setEscala(1); setPos({x:0,y:0}); onNavigate('anterior'); }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [onNavigate, onClose]);

    const onRueda = (e) => {
        const delta = e.deltaY;
        setEscala(prev => {
            const nueva = delta < 0 ? Math.min(prev + 0.2, 7) : Math.max(prev - 0.2, 1);
            if (nueva === 1) setPos({ x: 0, y: 0 });
            return nueva;
        });
    };

    const toggleFav = async () => {
        const res = await fetch(`${API}/fotos/${fotoLocal.id}/favorito`, { method: 'PATCH' });
        const { favorito } = await res.json();
        const actualizada = { ...fotoLocal, favorito };
        setFotoLocal(actualizada);
        if (onFavoritoToggle) onFavoritoToggle(actualizada);
    };

    const descargar = () => {
        const url = getFotoUrl(fotoLocal);
        fetch(url).then(r => r.blob()).then(blob => {
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = fotoLocal.titulo ? `${fotoLocal.titulo}.jpg` : 'foto.jpg';
            a.click();
            URL.revokeObjectURL(a.href);
        }).catch(() => window.open(url, '_blank'));
    };

    const tags = fotoLocal.etiquetas ? fotoLocal.etiquetas.split(',').filter(t => t.trim()) : [];

    return (
        <div className="modal-overlay" onClick={onClose} onWheel={onRueda}>
            <div className="modal-contenido" onClick={e => e.stopPropagation()}>

                <button className="modal-cerrar" onClick={onClose}>×</button>

                {/* IMAGEN */}
                <div className="modal-imagen-zona"
                    onMouseDown={e => { if (escala > 1) { setArrastrando(true); setInicio({ x: e.clientX - pos.x, y: e.clientY - pos.y }); }}}
                    onMouseMove={e => { if (arrastrando) setPos({ x: e.clientX - inicio.x, y: e.clientY - inicio.y }); }}
                    onMouseUp={() => setArrastrando(false)}
                    onMouseLeave={() => setArrastrando(false)}
                    style={{ cursor: escala > 1 ? (arrastrando ? 'grabbing' : 'grab') : 'default' }}
                >
                    <button className="modal-nav modal-nav-prev" onClick={e => { e.stopPropagation(); setEscala(1); setPos({x:0,y:0}); onNavigate('anterior'); }}>‹</button>
                    <img
                        src={getFotoUrl(fotoLocal)}
                        alt={fotoLocal.titulo || ''}
                        draggable="false"
                        style={{ transform: `translate(${pos.x}px, ${pos.y}px) scale(${escala})`, transition: arrastrando ? 'none' : 'transform 0.1s' }}
                    />
                    <button className="modal-nav modal-nav-next" onClick={e => { e.stopPropagation(); setEscala(1); setPos({x:0,y:0}); onNavigate('siguiente'); }}>›</button>
                </div>

                {/* PANEL LATERAL */}
                <div className="modal-panel">
                    <div className="modal-panel-titulo">{fotoLocal.titulo || 'Sin título'}</div>
                    <div className="modal-panel-meta">
                        {fotoLocal.anio && `📅 ${fotoLocal.anio}`}
                        {fotoLocal.lugar && ` · 📍 ${fotoLocal.lugar}`}
                    </div>

                    {fotoLocal.descripcion && (
                        <div>
                            <div className="modal-panel-label">Descripción</div>
                            <div style={{ fontSize: '0.78rem', color: 'var(--texto-secundario)', lineHeight: 1.5 }}>{fotoLocal.descripcion}</div>
                        </div>
                    )}

                    {tags.length > 0 && (
                        <div>
                            <div className="modal-panel-label">Tags</div>
                            <div className="modal-tags">
                                {tags.map((tag, i) => (
                                    <button key={i} className="modal-tag" onClick={() => { setBusqueda(tag.trim()); onClose(); }}>
                                        #{tag.trim()}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {personas.length > 0 && (
                        <div>
                            <div className="modal-panel-label">Personas</div>
                            <div className="modal-tags">
                                {personas.map(p => <span key={p.id} className="modal-tag">👤 {p.nombre}</span>)}
                            </div>
                        </div>
                    )}

                    <div className="modal-acciones">
                        <button className="btn-ghost" onClick={toggleFav}>
                            {fotoLocal.favorito ? '⭐ Quitar de favoritos' : '☆ Añadir a favoritos'}
                        </button>
                        <button className="btn-ghost" onClick={descargar}>📥 Descargar</button>
                        <button className="btn-peligro" onClick={e => onBorrar(fotoLocal.id, e)}>🗑️ Mover a papelera</button>
                    </div>

                    <div className="modal-zoom-info">Zoom: {Math.round(escala * 100)}% · ID: {fotoLocal.id}</div>
                </div>
            </div>
        </div>
    );
};

export default ModalZoom;
```

- [ ] **Paso 3: Verificar manualmente**

Abrir una foto en la galería. Comprobar:
- Modal con panel lateral derecho ✓
- Botón de favorito funciona ✓
- Tags clickables filtran la galería ✓
- Teclas ← → navegan ✓
- Escape cierra ✓

- [ ] **Paso 4: Commit**

```bash
git add src/components/ModalZoom.js src/components/modalzoom.css
git commit -m "feat: modal zoom Dark Premium con panel de info lateral"
```

---

## Tarea 6: Favoritos

**Archivos:**
- Modificar: `src/components/Favoritos.js`

- [ ] **Paso 1: Implementar `src/components/Favoritos.js`**

```jsx
import React, { useState, useEffect, useCallback } from 'react';
import ModalZoom from './ModalZoom';
import './galeria.css';

const API = 'http://localhost:5001/api';
const URL_FOTOS = 'http://localhost:5001/uploads/';
const getFotoUrl = (foto) => foto?.imagen_url ? URL_FOTOS + foto.imagen_url.trim().replace(/ /g,'%20') : '';

const Favoritos = () => {
    const [fotos, setFotos] = useState([]);
    const [fotoZoom, setFotoZoom] = useState(null);

    const cargar = useCallback(async () => {
        const res = await fetch(`${API}/favoritos`);
        setFotos(await res.json());
    }, []);

    useEffect(() => { cargar(); }, [cargar]);

    const borrar = async (id) => {
        if (!window.confirm('¿Mover a la papelera?')) return;
        await fetch(`${API}/imagenes/${id}`, { method: 'DELETE' });
        setFotoZoom(null);
        cargar();
    };

    const navegar = (dir) => {
        if (!fotoZoom) return;
        const idx = fotos.findIndex(f => f.id === fotoZoom.id);
        const next = dir === 'siguiente' ? (idx + 1) % fotos.length : (idx - 1 + fotos.length) % fotos.length;
        setFotoZoom(fotos[next]);
    };

    return (
        <div className="galeria-layout">
            <header className="galeria-header">
                <h1 className="galeria-titulo">⭐ Favoritos</h1>
            </header>

            {fotos.length === 0 ? (
                <div className="galeria-empty">
                    <h3>No tienes fotos favoritas todavía</h3>
                    <p style={{ fontSize: '0.82rem', color: 'var(--texto-secundario)' }}>Marca fotos con ⭐ desde la galería</p>
                </div>
            ) : (
                <div className="masonry-grid">
                    {fotos.map(foto => (
                        <div key={foto.id} className="foto-card" onClick={() => setFotoZoom(foto)}>
                            <img src={getFotoUrl(foto)} alt={foto.titulo || ''} loading="lazy" />
                            <div className="foto-card-overlay">
                                <div className="foto-card-titulo">{foto.titulo || 'Sin título'}</div>
                                <div className="foto-card-meta">{foto.anio}</div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {fotoZoom && (
                <ModalZoom
                    foto={fotoZoom}
                    onClose={() => setFotoZoom(null)}
                    onNavigate={navegar}
                    onBorrar={borrar}
                    getFotoUrl={getFotoUrl}
                    setBusqueda={() => {}}
                    onFavoritoToggle={(f) => setFotos(prev => f.favorito ? prev.map(x => x.id === f.id ? f : x) : prev.filter(x => x.id !== f.id))}
                />
            )}
        </div>
    );
};

export default Favoritos;
```

- [ ] **Paso 2: Verificar**

Ir a `/#/favoritos`. Si no hay favoritos debe mostrar el estado vacío. Marcar una foto en la galería y volver — debe aparecer aquí.

- [ ] **Paso 3: Commit**

```bash
git add src/components/Favoritos.js
git commit -m "feat: vista de favoritos"
```

---

## Tarea 7: Álbumes (lista + CRUD + detalle)

**Archivos:**
- Modificar: `src/components/Albumes.js`
- Modificar: `src/components/AlbumDetalle.js`

- [ ] **Paso 1: Implementar `src/components/Albumes.js`**

```jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './galeria.css';

const API = 'http://localhost:5001/api';

const Albumes = () => {
    const [albumes, setAlbumes] = useState([]);
    const [nombre, setNombre] = useState('');
    const [descripcion, setDescripcion] = useState('');
    const [creando, setCreando] = useState(false);
    const navigate = useNavigate();

    const cargar = async () => {
        const res = await fetch(`${API}/albumes`);
        setAlbumes(await res.json());
    };

    useEffect(() => { cargar(); }, []);

    const crear = async (e) => {
        e.preventDefault();
        if (!nombre.trim()) return;
        await fetch(`${API}/albumes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombre: nombre.trim(), descripcion: descripcion.trim() })
        });
        setNombre(''); setDescripcion(''); setCreando(false);
        cargar();
    };

    const eliminar = async (id) => {
        if (!window.confirm('¿Eliminar este álbum? Las fotos no se borrarán.')) return;
        await fetch(`${API}/albumes/${id}`, { method: 'DELETE' });
        cargar();
    };

    return (
        <div className="galeria-layout">
            <header className="galeria-header">
                <h1 className="galeria-titulo">📁 Álbumes</h1>
                <div style={{ marginLeft: 'auto' }}>
                    <button className="btn-acento" onClick={() => setCreando(c => !c)}>
                        {creando ? 'Cancelar' : '+ Nuevo álbum'}
                    </button>
                </div>
            </header>

            {creando && (
                <form onSubmit={crear} style={{ padding: '16px 24px', borderBottom: '1px solid var(--borde)', display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <input placeholder="Nombre del álbum" value={nombre} onChange={e => setNombre(e.target.value)} style={{ flex: 2 }} required />
                    <input placeholder="Descripción (opcional)" value={descripcion} onChange={e => setDescripcion(e.target.value)} style={{ flex: 3 }} />
                    <button type="submit" className="btn-acento">Crear</button>
                </form>
            )}

            <div style={{ padding: '20px 24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '14px' }}>
                {albumes.map(album => (
                    <div key={album.id}
                        style={{ background: 'var(--bg-superficie)', border: '1px solid var(--borde)', borderRadius: 'var(--radio)', padding: '16px', cursor: 'pointer' }}
                        onClick={() => navigate(`/albumes/${album.id}`)}
                    >
                        <div style={{ fontSize: '2rem', marginBottom: '8px' }}>📁</div>
                        <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--texto-primario)', marginBottom: '4px' }}>{album.nombre}</div>
                        {album.descripcion && <div style={{ fontSize: '0.75rem', color: 'var(--texto-secundario)', marginBottom: '6px' }}>{album.descripcion}</div>}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.72rem', color: 'var(--acento)' }}>{album.total || 0} fotos</span>
                            <button className="btn-peligro" style={{ padding: '3px 8px', fontSize: '0.68rem' }}
                                onClick={e => { e.stopPropagation(); eliminar(album.id); }}>
                                🗑️
                            </button>
                        </div>
                    </div>
                ))}

                {albumes.length === 0 && (
                    <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '60px 0', color: 'var(--texto-secundario)' }}>
                        <p>No hay álbumes todavía. Crea uno para organizar tus fotos.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Albumes;
```

- [ ] **Paso 2: Implementar `src/components/AlbumDetalle.js`**

```jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ModalZoom from './ModalZoom';
import './galeria.css';

const API = 'http://localhost:5001/api';
const URL_FOTOS = 'http://localhost:5001/uploads/';
const getFotoUrl = (foto) => foto?.imagen_url ? URL_FOTOS + foto.imagen_url.trim().replace(/ /g,'%20') : '';

const AlbumDetalle = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [fotos, setFotos] = useState([]);
    const [album, setAlbum] = useState(null);
    const [fotoZoom, setFotoZoom] = useState(null);

    const cargar = useCallback(async () => {
        const [albRes, fotosRes] = await Promise.all([
            fetch(`${API}/albumes`),
            fetch(`${API}/albumes/${id}/fotos`)
        ]);
        const albumes = await albRes.json();
        setAlbum(albumes.find(a => a.id === parseInt(id)));
        setFotos(await fotosRes.json());
    }, [id]);

    useEffect(() => { cargar(); }, [cargar]);

    const navegar = (dir) => {
        const idx = fotos.findIndex(f => f.id === fotoZoom.id);
        const next = dir === 'siguiente' ? (idx + 1) % fotos.length : (idx - 1 + fotos.length) % fotos.length;
        setFotoZoom(fotos[next]);
    };

    const borrar = async (fotoId) => {
        if (!window.confirm('¿Mover a la papelera?')) return;
        await fetch(`${API}/imagenes/${fotoId}`, { method: 'DELETE' });
        setFotoZoom(null);
        cargar();
    };

    const quitarDeAlbum = async (fotoId) => {
        await fetch(`${API}/albumes/${id}/fotos/${fotoId}`, { method: 'DELETE' });
        cargar();
    };

    return (
        <div className="galeria-layout">
            <header className="galeria-header">
                <button className="btn-ghost" onClick={() => navigate('/albumes')}>← Álbumes</button>
                <h1 className="galeria-titulo">📁 {album?.nombre || '...'}</h1>
                {album?.descripcion && <span style={{ color: 'var(--texto-secundario)', fontSize: '0.8rem' }}>{album.descripcion}</span>}
            </header>

            {fotos.length === 0 ? (
                <div className="galeria-empty">
                    <h3>Este álbum está vacío</h3>
                    <p style={{ fontSize: '0.82rem', color: 'var(--texto-secundario)' }}>Añade fotos desde el panel de gestión</p>
                </div>
            ) : (
                <div className="masonry-grid">
                    {fotos.map(foto => (
                        <div key={foto.id} className="foto-card" onClick={() => setFotoZoom(foto)}>
                            <img src={getFotoUrl(foto)} alt={foto.titulo || ''} loading="lazy" />
                            <button
                                style={{ position:'absolute', top:8, right:8, background:'rgba(0,0,0,0.5)', border:'none', borderRadius:'50%', width:26, height:26, color:'#fff', cursor:'pointer', fontSize:'0.65rem' }}
                                onClick={e => { e.stopPropagation(); quitarDeAlbum(foto.id); }}
                                title="Quitar del álbum"
                            >✕</button>
                            <div className="foto-card-overlay">
                                <div className="foto-card-titulo">{foto.titulo || 'Sin título'}</div>
                                <div className="foto-card-meta">{foto.anio}</div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {fotoZoom && (
                <ModalZoom foto={fotoZoom} onClose={() => setFotoZoom(null)} onNavigate={navegar}
                    onBorrar={borrar} getFotoUrl={getFotoUrl} setBusqueda={() => {}} />
            )}
        </div>
    );
};

export default AlbumDetalle;
```

- [ ] **Paso 3: Verificar**

Ir a `/#/albumes`. Crear un álbum, hacer clic en él y verificar que carga la vista detalle.

- [ ] **Paso 4: Commit**

```bash
git add src/components/Albumes.js src/components/AlbumDetalle.js
git commit -m "feat: albumes CRUD y vista detalle"
```

---

## Tarea 8: Eventos

**Archivos:**
- Modificar: `src/components/Eventos.js`

- [ ] **Paso 1: Implementar `src/components/Eventos.js`**

```jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import ModalZoom from './ModalZoom';
import './galeria.css';

const API = 'http://localhost:5001/api';
const URL_FOTOS = 'http://localhost:5001/uploads/';
const getFotoUrl = (foto) => foto?.imagen_url ? URL_FOTOS + foto.imagen_url.trim().replace(/ /g,'%20') : '';

const Eventos = () => {
    const [eventos, setEventos] = useState([]);
    const [eventoActivo, setEventoActivo] = useState(null);
    const [fotosEvento, setFotosEvento] = useState([]);
    const [fotoZoom, setFotoZoom] = useState(null);
    const [creando, setCreando] = useState(false);
    const [form, setForm] = useState({ nombre: '', fecha_inicio: '', fecha_fin: '', descripcion: '' });

    const cargar = useCallback(async () => {
        const res = await fetch(`${API}/eventos`);
        setEventos(await res.json());
    }, []);

    useEffect(() => { cargar(); }, [cargar]);

    const abrirEvento = async (ev) => {
        setEventoActivo(ev);
        const res = await fetch(`${API}/eventos/${ev.id}/fotos`);
        setFotosEvento(await res.json());
    };

    const crear = async (e) => {
        e.preventDefault();
        if (!form.nombre.trim()) return;
        await fetch(`${API}/eventos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(form)
        });
        setForm({ nombre: '', fecha_inicio: '', fecha_fin: '', descripcion: '' });
        setCreando(false);
        cargar();
    };

    const eliminar = async (id) => {
        if (!window.confirm('¿Eliminar este evento?')) return;
        await fetch(`${API}/eventos/${id}`, { method: 'DELETE' });
        if (eventoActivo?.id === id) { setEventoActivo(null); setFotosEvento([]); }
        cargar();
    };

    const navegar = (dir) => {
        const idx = fotosEvento.findIndex(f => f.id === fotoZoom.id);
        const next = dir === 'siguiente' ? (idx + 1) % fotosEvento.length : (idx - 1 + fotosEvento.length) % fotosEvento.length;
        setFotoZoom(fotosEvento[next]);
    };

    if (eventoActivo) return (
        <div className="galeria-layout">
            <header className="galeria-header">
                <button className="btn-ghost" onClick={() => { setEventoActivo(null); setFotosEvento([]); }}>← Eventos</button>
                <h1 className="galeria-titulo">📅 {eventoActivo.nombre}</h1>
                {eventoActivo.fecha_inicio && <span style={{ color:'var(--texto-secundario)', fontSize:'0.78rem' }}>{eventoActivo.fecha_inicio} → {eventoActivo.fecha_fin}</span>}
            </header>
            {fotosEvento.length === 0 ? (
                <div className="galeria-empty"><h3>Sin fotos en este evento</h3></div>
            ) : (
                <div className="masonry-grid">
                    {fotosEvento.map(foto => (
                        <div key={foto.id} className="foto-card" onClick={() => setFotoZoom(foto)}>
                            <img src={getFotoUrl(foto)} alt={foto.titulo||''} loading="lazy" />
                            <div className="foto-card-overlay">
                                <div className="foto-card-titulo">{foto.titulo||'Sin título'}</div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
            {fotoZoom && <ModalZoom foto={fotoZoom} onClose={() => setFotoZoom(null)} onNavigate={navegar} onBorrar={async (id) => { await fetch(`${API}/imagenes/${id}`,{method:'DELETE'}); setFotoZoom(null); const r=await fetch(`${API}/eventos/${eventoActivo.id}/fotos`); setFotosEvento(await r.json()); }} getFotoUrl={getFotoUrl} setBusqueda={() => {}} />}
        </div>
    );

    return (
        <div className="galeria-layout">
            <header className="galeria-header">
                <h1 className="galeria-titulo">📅 Eventos</h1>
                <div style={{ marginLeft:'auto' }}>
                    <button className="btn-acento" onClick={() => setCreando(c => !c)}>{creando ? 'Cancelar' : '+ Nuevo evento'}</button>
                </div>
            </header>

            {creando && (
                <form onSubmit={crear} style={{ padding:'16px 24px', borderBottom:'1px solid var(--borde)', display:'flex', gap:'10px', flexWrap:'wrap', alignItems:'center' }}>
                    <input placeholder="Nombre del evento" value={form.nombre} onChange={e => setForm(f=>({...f,nombre:e.target.value}))} required style={{flex:2,minWidth:140}} />
                    <input type="date" value={form.fecha_inicio} onChange={e => setForm(f=>({...f,fecha_inicio:e.target.value}))} style={{flex:1}} />
                    <input type="date" value={form.fecha_fin} onChange={e => setForm(f=>({...f,fecha_fin:e.target.value}))} style={{flex:1}} />
                    <input placeholder="Descripción" value={form.descripcion} onChange={e => setForm(f=>({...f,descripcion:e.target.value}))} style={{flex:3}} />
                    <button type="submit" className="btn-acento">Crear</button>
                </form>
            )}

            <div style={{ padding:'20px 24px', display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(220px,1fr))', gap:'14px' }}>
                {eventos.map(ev => (
                    <div key={ev.id} style={{ background:'var(--bg-superficie)', border:'1px solid var(--borde)', borderRadius:'var(--radio)', padding:'16px', cursor:'pointer' }} onClick={() => abrirEvento(ev)}>
                        <div style={{ fontSize:'1.8rem', marginBottom:'8px' }}>📅</div>
                        <div style={{ fontWeight:600, fontSize:'0.88rem', color:'var(--texto-primario)', marginBottom:'4px' }}>{ev.nombre}</div>
                        {ev.fecha_inicio && <div style={{ fontSize:'0.72rem', color:'var(--texto-secundario)', marginBottom:'6px' }}>{ev.fecha_inicio} → {ev.fecha_fin}</div>}
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                            <span style={{ fontSize:'0.72rem', color:'var(--acento)' }}>{ev.total||0} fotos</span>
                            <button className="btn-peligro" style={{ padding:'3px 8px', fontSize:'0.68rem' }} onClick={e => { e.stopPropagation(); eliminar(ev.id); }}>🗑️</button>
                        </div>
                    </div>
                ))}
                {eventos.length === 0 && <div style={{ gridColumn:'1/-1', textAlign:'center', padding:'60px 0', color:'var(--texto-secundario)' }}><p>No hay eventos todavía.</p></div>}
            </div>
        </div>
    );
};

export default Eventos;
```

- [ ] **Paso 2: Commit**

```bash
git add src/components/Eventos.js
git commit -m "feat: eventos CRUD y vista de fotos por evento"
```

---

## Tarea 9: Personas

**Archivos:**
- Modificar: `src/components/Personas.js`

- [ ] **Paso 1: Implementar `src/components/Personas.js`**

```jsx
import React, { useState, useEffect, useCallback } from 'react';
import ModalZoom from './ModalZoom';
import './galeria.css';

const API = 'http://localhost:5001/api';
const URL_FOTOS = 'http://localhost:5001/uploads/';
const getFotoUrl = (foto) => foto?.imagen_url ? URL_FOTOS + foto.imagen_url.trim().replace(/ /g,'%20') : '';

const Personas = () => {
    const [personas, setPersonas] = useState([]);
    const [personaActiva, setPersonaActiva] = useState(null);
    const [fotos, setFotos] = useState([]);
    const [fotoZoom, setFotoZoom] = useState(null);
    const [nombre, setNombre] = useState('');
    const [creando, setCreando] = useState(false);

    const cargar = useCallback(async () => {
        const res = await fetch(`${API}/personas`);
        setPersonas(await res.json());
    }, []);

    useEffect(() => { cargar(); }, [cargar]);

    const abrirPersona = async (persona) => {
        setPersonaActiva(persona);
        const res = await fetch(`${API}/personas/${persona.id}/fotos`);
        setFotos(await res.json());
    };

    const crear = async (e) => {
        e.preventDefault();
        if (!nombre.trim()) return;
        await fetch(`${API}/personas`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ nombre: nombre.trim() }) });
        setNombre(''); setCreando(false); cargar();
    };

    const eliminar = async (id) => {
        if (!window.confirm('¿Eliminar esta persona?')) return;
        await fetch(`${API}/personas/${id}`, { method:'DELETE' });
        if (personaActiva?.id === id) { setPersonaActiva(null); setFotos([]); }
        cargar();
    };

    const navegar = (dir) => {
        const idx = fotos.findIndex(f => f.id === fotoZoom.id);
        const next = dir === 'siguiente' ? (idx+1) % fotos.length : (idx-1+fotos.length) % fotos.length;
        setFotoZoom(fotos[next]);
    };

    if (personaActiva) return (
        <div className="galeria-layout">
            <header className="galeria-header">
                <button className="btn-ghost" onClick={() => { setPersonaActiva(null); setFotos([]); }}>← Personas</button>
                <h1 className="galeria-titulo">👤 {personaActiva.nombre}</h1>
            </header>
            {fotos.length === 0 ? (
                <div className="galeria-empty"><h3>Sin fotos para esta persona</h3><p style={{fontSize:'0.82rem',color:'var(--texto-secundario)'}}>Asigna personas desde el panel de gestión</p></div>
            ) : (
                <div className="masonry-grid">
                    {fotos.map(foto => (
                        <div key={foto.id} className="foto-card" onClick={() => setFotoZoom(foto)}>
                            <img src={getFotoUrl(foto)} alt={foto.titulo||''} loading="lazy" />
                            <div className="foto-card-overlay"><div className="foto-card-titulo">{foto.titulo||'Sin título'}</div></div>
                        </div>
                    ))}
                </div>
            )}
            {fotoZoom && <ModalZoom foto={fotoZoom} onClose={() => setFotoZoom(null)} onNavigate={navegar} onBorrar={async (id) => { await fetch(`${API}/imagenes/${id}`,{method:'DELETE'}); setFotoZoom(null); const r=await fetch(`${API}/personas/${personaActiva.id}/fotos`); setFotos(await r.json()); }} getFotoUrl={getFotoUrl} setBusqueda={() => {}} />}
        </div>
    );

    return (
        <div className="galeria-layout">
            <header className="galeria-header">
                <h1 className="galeria-titulo">👤 Personas</h1>
                <div style={{ marginLeft:'auto' }}>
                    <button className="btn-acento" onClick={() => setCreando(c=>!c)}>{creando ? 'Cancelar' : '+ Nueva persona'}</button>
                </div>
            </header>

            {creando && (
                <form onSubmit={crear} style={{ padding:'12px 24px', borderBottom:'1px solid var(--borde)', display:'flex', gap:'10px' }}>
                    <input placeholder="Nombre de la persona" value={nombre} onChange={e => setNombre(e.target.value)} required style={{flex:1}} />
                    <button type="submit" className="btn-acento">Crear</button>
                </form>
            )}

            <div style={{ padding:'20px 24px', display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(160px,1fr))', gap:'12px' }}>
                {personas.map(p => (
                    <div key={p.id} style={{ background:'var(--bg-superficie)', border:'1px solid var(--borde)', borderRadius:'var(--radio)', padding:'16px', cursor:'pointer', textAlign:'center' }} onClick={() => abrirPersona(p)}>
                        <div style={{ fontSize:'2rem', marginBottom:'8px' }}>👤</div>
                        <div style={{ fontWeight:600, fontSize:'0.85rem', color:'var(--texto-primario)', marginBottom:'4px' }}>{p.nombre}</div>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                            <span style={{ fontSize:'0.72rem', color:'var(--acento)' }}>{p.total||0} fotos</span>
                            <button className="btn-peligro" style={{ padding:'2px 7px', fontSize:'0.65rem' }} onClick={e => { e.stopPropagation(); eliminar(p.id); }}>🗑️</button>
                        </div>
                    </div>
                ))}
                {personas.length === 0 && <div style={{ gridColumn:'1/-1', textAlign:'center', padding:'60px 0', color:'var(--texto-secundario)' }}><p>No hay personas todavía.</p></div>}
            </div>
        </div>
    );
};

export default Personas;
```

- [ ] **Paso 2: Commit**

```bash
git add src/components/Personas.js
git commit -m "feat: personas CRUD y vista de fotos por persona"
```

---

## Tarea 10: Lugares y Tags

**Archivos:**
- Modificar: `src/components/Lugares.js`
- Modificar: `src/components/Tags.js`

- [ ] **Paso 1: Implementar `src/components/Lugares.js`**

```jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './galeria.css';

const API = 'http://localhost:5001/api';

const Lugares = () => {
    const [lugares, setLugares] = useState([]);
    const navigate = useNavigate();

    useEffect(() => {
        fetch(`${API}/lugares`).then(r => r.json()).then(setLugares).catch(() => {});
    }, []);

    return (
        <div className="galeria-layout">
            <header className="galeria-header">
                <h1 className="galeria-titulo">📍 Lugares</h1>
            </header>

            {lugares.length === 0 ? (
                <div className="galeria-empty">
                    <h3>No hay lugares registrados</h3>
                    <p style={{ fontSize:'0.82rem', color:'var(--texto-secundario)' }}>Añade un lugar a tus fotos desde el panel de gestión</p>
                </div>
            ) : (
                <div style={{ padding:'20px 24px', display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(180px,1fr))', gap:'12px' }}>
                    {lugares.map(l => (
                        <div key={l.lugar}
                            style={{ background:'var(--bg-superficie)', border:'1px solid var(--borde)', borderRadius:'var(--radio)', padding:'16px', cursor:'pointer' }}
                            onClick={() => navigate(`/galeria-completa?q=${encodeURIComponent(l.lugar)}`)}
                        >
                            <div style={{ fontSize:'1.8rem', marginBottom:'8px' }}>📍</div>
                            <div style={{ fontWeight:600, fontSize:'0.88rem', color:'var(--texto-primario)', marginBottom:'4px' }}>{l.lugar}</div>
                            <div style={{ fontSize:'0.72rem', color:'var(--acento)' }}>{l.total} fotos</div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default Lugares;
```

- [ ] **Paso 2: Implementar `src/components/Tags.js`**

```jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './galeria.css';

const API = 'http://localhost:5001/api';

const Tags = () => {
    const [tags, setTags] = useState([]);
    const navigate = useNavigate();

    useEffect(() => {
        fetch(`${API}/tags`).then(r => r.json()).then(setTags).catch(() => {});
    }, []);

    const maxTotal = tags[0]?.total || 1;

    return (
        <div className="galeria-layout">
            <header className="galeria-header">
                <h1 className="galeria-titulo">🏷️ Tags</h1>
            </header>

            {tags.length === 0 ? (
                <div className="galeria-empty">
                    <h3>No hay tags todavía</h3>
                    <p style={{ fontSize:'0.82rem', color:'var(--texto-secundario)' }}>Añade etiquetas a tus fotos desde el panel de gestión</p>
                </div>
            ) : (
                <div style={{ padding:'30px 24px', display:'flex', flexWrap:'wrap', gap:'10px', alignContent:'flex-start' }}>
                    {tags.map(t => {
                        const ratio = t.total / maxTotal;
                        const size = 0.75 + ratio * 0.7;
                        const opacity = 0.5 + ratio * 0.5;
                        return (
                            <button key={t.tag}
                                onClick={() => navigate(`/galeria-completa?q=${encodeURIComponent(t.tag)}`)}
                                style={{
                                    background:'var(--bg-elevado)',
                                    color:`rgba(245,245,247,${opacity})`,
                                    border:'1px solid var(--borde-suave)',
                                    borderRadius:'20px',
                                    padding:`${4 + ratio*4}px ${10 + ratio*6}px`,
                                    fontSize:`${size}rem`,
                                    cursor:'pointer',
                                    transition:'background 0.15s',
                                    fontFamily:'var(--font)'
                                }}
                                onMouseEnter={e => { e.target.style.background='var(--bg-hover)'; e.target.style.color='var(--acento)'; }}
                                onMouseLeave={e => { e.target.style.background='var(--bg-elevado)'; e.target.style.color=`rgba(245,245,247,${opacity})`; }}
                            >
                                #{t.tag} <span style={{ fontSize:'0.65rem', opacity:0.6 }}>({t.total})</span>
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default Tags;
```

- [ ] **Paso 3: Commit**

```bash
git add src/components/Lugares.js src/components/Tags.js
git commit -m "feat: vistas de lugares y nube de tags"
```

---

## Tarea 11: AdminPanel con nuevos campos

**Archivos:**
- Modificar: `src/components/AdminPanel.js`

- [ ] **Paso 1: Añadir estados y campos al formulario de subida**

En `AdminPanel.js`, añadir los nuevos estados después de `const [descripcion, setDescripcion] = useState("");`:

```js
const [lugar, setLugar] = useState("");
const [personas, setPersonas] = useState([]); // lista de personas disponibles
const [personasSeleccionadas, setPersonasSeleccionadas] = useState([]);
const [albumes, setAlbumes] = useState([]);
const [albumSeleccionado, setAlbumSeleccionado] = useState("");
```

- [ ] **Paso 2: Cargar personas y álbumes al montar**

Reemplazar el `useEffect` de `cargarFotos`:

```js
useEffect(() => {
    cargarFotos();
    fetch(`${API_URL}/personas`).then(r => r.json()).then(setPersonas).catch(() => {});
    fetch(`${API_URL}/albumes`).then(r => r.json()).then(setAlbumes).catch(() => {});
}, []);
```

- [ ] **Paso 3: Añadir lugar y personas al FormData en `manejarSubida`**

Dentro de `manejarSubida`, después de `formData.append('descripcion', descripcion);`:

```js
formData.append('lugar', lugar);
```

- [ ] **Paso 4: Tras subida exitosa, asignar personas y álbum**

Reemplazar el bloque `if (xhr.status === 200)` con:

```js
if (xhr.status === 200) {
    setMensaje("¡Éxito! Activos guardados en ARCHIPEG");
    // Re-cargar fotos y asignar personas/álbum a las nuevas fotos
    const fotosRes = await fetch(`${API_URL}/imagenes`);
    const fotasActuales = await fotosRes.json();
    const nuevasFotos = fotasActuales.slice(0, archivos.length);
    for (const foto of nuevasFotos) {
        if (personasSeleccionadas.length > 0) {
            await fetch(`${API_URL}/fotos/${foto.id}/personas`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ persona_ids: personasSeleccionadas })
            });
        }
        if (albumSeleccionado) {
            await fetch(`${API_URL}/albumes/${albumSeleccionado}/fotos`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ foto_id: foto.id })
            });
        }
    }
    setTitulo(""); setEtiquetas(""); setLugar(""); setPersonasSeleccionadas([]); setAlbumSeleccionado(""); setArchivos([]); setProgreso(0);
    cargarFotos();
}
```

- [ ] **Paso 5: Añadir campos al formulario JSX**

Dentro del `<div className="form-grid">`, añadir después del campo de año:

```jsx
<input type="text" placeholder="Lugar (ciudad, país...)" value={lugar} onChange={(e) => setLugar(e.target.value)} className="admin-input" />
<select value={albumSeleccionado} onChange={e => setAlbumSeleccionado(e.target.value)} className="admin-input">
    <option value="">📁 Sin álbum</option>
    {albumes.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
</select>
```

Y añadir el selector de personas (multi-select) después del textarea:

```jsx
{personas.length > 0 && (
    <div style={{ margin: '8px 0' }}>
        <p style={{ fontSize: '0.75rem', color: 'var(--texto-secundario)', marginBottom: '6px' }}>👤 Personas en la foto:</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {personas.map(p => (
                <button key={p.id} type="button"
                    style={{
                        background: personasSeleccionadas.includes(p.id) ? 'var(--acento-suave)' : 'var(--bg-elevado)',
                        color: personasSeleccionadas.includes(p.id) ? 'var(--acento)' : 'var(--texto-secundario)',
                        border: `1px solid ${personasSeleccionadas.includes(p.id) ? 'var(--acento)' : 'var(--borde-suave)'}`,
                        borderRadius: '20px', padding: '4px 12px', fontSize: '0.72rem', cursor: 'pointer'
                    }}
                    onClick={() => setPersonasSeleccionadas(prev => prev.includes(p.id) ? prev.filter(id => id !== p.id) : [...prev, p.id])}
                >
                    {p.nombre}
                </button>
            ))}
        </div>
    </div>
)}
```

- [ ] **Paso 6: Actualizar los estilos del AdminPanel**

Reemplazar el `import './admin.css'` con los estilos globales. En `admin.css`, añadir al principio:

```css
.admin-container { background: var(--bg-principal); min-height: 100vh; color: var(--texto-primario); }
.admin-header { background: var(--bg-principal); border-bottom: 1px solid var(--borde); padding: 14px 24px; display: flex; align-items: center; gap: 16px; }
.admin-title { font-size: 1.05rem; font-weight: 600; color: var(--texto-primario); }
.admin-content { padding: 24px; display: grid; grid-template-columns: 1fr 2fr; gap: 20px; }
.admin-card { background: var(--bg-superficie); border: 1px solid var(--borde); border-radius: var(--radio); padding: 20px; }
.section-title { font-size: 0.88rem; font-weight: 600; color: var(--texto-primario); margin-bottom: 14px; }
.admin-input, .admin-textarea, .admin-select { width: 100%; background: var(--bg-elevado); color: var(--texto-primario); border: 1px solid var(--borde-suave); border-radius: var(--radio-sm); padding: 8px 12px; font-size: 0.8rem; margin-bottom: 8px; }
.admin-input:focus, .admin-textarea:focus { border-color: var(--acento); outline: none; }
.btn-archipeg-main-morado { width: 100%; background: var(--acento); color: #000; border: none; border-radius: var(--radio-sm); padding: 10px; font-weight: 700; font-size: 0.82rem; cursor: pointer; margin-top: 8px; }
.mensaje-feedback-morado { font-size: 0.78rem; margin-top: 8px; color: var(--acento); }
.btn-file-morado { display: inline-block; background: var(--bg-elevado); color: var(--texto-secundario); border: 1px dashed var(--borde-suave); border-radius: var(--radio-sm); padding: 10px 16px; cursor: pointer; font-size: 0.8rem; }
```

- [ ] **Paso 7: Commit**

```bash
git add src/components/AdminPanel.js src/components/admin.css
git commit -m "feat: panel de gestion con campos de lugar, personas y album"
```

---

## Tarea 12: Indice rediseñado Dark Premium

**Archivos:**
- Modificar: `src/components/Indice.js`
- Modificar: `src/components/indice.css`

- [ ] **Paso 1: Reemplazar `src/components/indice.css`**

```css
.indice-page {
    min-height: 100vh;
    background: var(--bg-principal);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40px 24px;
    text-align: center;
}

.indice-logo {
    width: 220px;
    height: auto;
    margin-bottom: 32px;
    opacity: 0.9;
}

.indice-titulo {
    font-size: 3rem;
    font-weight: 700;
    color: var(--texto-primario);
    letter-spacing: 0.04em;
    margin-bottom: 8px;
}

.indice-punto { color: var(--acento); }

.indice-subtitulo {
    font-size: 0.9rem;
    color: var(--texto-secundario);
    letter-spacing: 0.12em;
    text-transform: uppercase;
    margin-bottom: 48px;
}

.indice-botones {
    display: flex;
    gap: 14px;
    flex-wrap: wrap;
    justify-content: center;
    margin-bottom: 48px;
}

.indice-btn-principal {
    background: var(--acento);
    color: #000;
    border: none;
    border-radius: var(--radio);
    padding: 14px 32px;
    font-size: 0.9rem;
    font-weight: 700;
    cursor: pointer;
    text-decoration: none;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    transition: opacity 0.15s;
}
.indice-btn-principal:hover { opacity: 0.85; }

.indice-btn-secundario {
    background: var(--bg-superficie);
    color: var(--texto-primario);
    border: 1px solid var(--borde-suave);
    border-radius: var(--radio);
    padding: 14px 32px;
    font-size: 0.9rem;
    font-weight: 500;
    cursor: pointer;
    text-decoration: none;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    transition: background 0.15s;
}
.indice-btn-secundario:hover { background: var(--bg-elevado); }

.indice-features {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    gap: 12px;
    max-width: 700px;
    width: 100%;
    margin-bottom: 48px;
}

.indice-feature {
    background: var(--bg-superficie);
    border: 1px solid var(--borde);
    border-radius: var(--radio);
    padding: 16px;
    font-size: 0.78rem;
    color: var(--texto-secundario);
}

.indice-feature-icon { font-size: 1.4rem; margin-bottom: 6px; }
.indice-feature-label { color: var(--texto-primario); font-weight: 500; font-size: 0.82rem; }

.indice-footer {
    font-size: 0.7rem;
    color: var(--texto-secundario);
    opacity: 0.6;
}
```

- [ ] **Paso 2: Reemplazar `src/components/Indice.js`**

```jsx
import React from 'react';
import { Link } from 'react-router-dom';
import './indice.css';

const Indice = () => (
    <div className="indice-page">
        <img src="/logo_archipeg_principal.png" alt="ARCHIPEG" className="indice-logo"
            onError={e => { e.target.style.display = 'none'; }} />

        <h1 className="indice-titulo">ARCHIPEG<span className="indice-punto"> ·</span></h1>
        <p className="indice-subtitulo">Gestión y archivo fotográfico profesional</p>

        <div className="indice-botones">
            <Link to="/galeria-completa" className="indice-btn-principal">🖼️ Abrir galería</Link>
            <Link to="/admin" className="indice-btn-secundario">⚙️ Gestión</Link>
        </div>

        <div className="indice-features">
            {[
                { icon: '📁', label: 'Álbumes', desc: 'Colecciones personalizadas' },
                { icon: '📅', label: 'Eventos', desc: 'Grupos con fechas' },
                { icon: '👤', label: 'Personas', desc: 'Etiqueta a tus personas' },
                { icon: '📍', label: 'Lugares', desc: 'Organiza por ubicación' },
                { icon: '⭐', label: 'Favoritos', desc: 'Tus mejores fotos' },
                { icon: '🏷️', label: 'Tags', desc: 'Búsqueda por etiqueta' },
            ].map(f => (
                <div key={f.label} className="indice-feature">
                    <div className="indice-feature-icon">{f.icon}</div>
                    <div className="indice-feature-label">{f.label}</div>
                    <div>{f.desc}</div>
                </div>
            ))}
        </div>

        <p className="indice-footer">ARCHIPEG v2.0 · DEMO — máx. 50 fotos · © 2026 Jose Moreno Jimenez</p>
    </div>
);

export default Indice;
```

- [ ] **Paso 3: Commit**

```bash
git add src/components/Indice.js src/components/indice.css
git commit -m "feat: pantalla de inicio Dark Premium"
```

---

## Tarea 13: Build final y verificación

- [ ] **Paso 1: Reiniciar backend con migraciones aplicadas**

```bash
lsof -ti:5001 | xargs kill -9 2>/dev/null
cd /Users/franciscovalero/Desktop/proyectos/ARCHIPEG
node server.js &
sleep 2
echo "Verificando endpoints..."
curl -s http://localhost:5001/api/favoritos | python3 -c "import sys,json; d=json.load(sys.stdin); print('favoritos OK:', len(d), 'items')"
curl -s http://localhost:5001/api/albumes | python3 -c "import sys,json; d=json.load(sys.stdin); print('albumes OK:', len(d), 'items')"
curl -s http://localhost:5001/api/personas | python3 -c "import sys,json; d=json.load(sys.stdin); print('personas OK:', len(d), 'items')"
curl -s http://localhost:5001/api/tags | python3 -c "import sys,json; d=json.load(sys.stdin); print('tags OK:', len(d), 'items')"
curl -s http://localhost:5001/api/lugares | python3 -c "import sys,json; d=json.load(sys.stdin); print('lugares OK:', len(d), 'items')"
```

- [ ] **Paso 2: Build de producción**

```bash
CI=true npm run build 2>&1 | tail -6
```

Salida esperada: `The build folder is ready to be deployed.` Sin errores de compilación.

- [ ] **Paso 3: Lanzar servidor de producción**

```bash
lsof -ti:3000 | xargs kill -9 2>/dev/null
npx serve -s build -l 3000 > /tmp/archipeg-serve.log 2>&1 &
sleep 5 && open http://localhost:3000
```

- [ ] **Paso 4: Checklist de verificación manual**

Comprobar en el navegador:

- [ ] Home en `/#/` con fondo oscuro y botones funcionales
- [ ] Sidebar visible en `/#/galeria-completa` con todos los enlaces
- [ ] Galería masonry con columnas variables
- [ ] Botón ⭐ en cada foto que persiste al refrescar
- [ ] Modal con panel lateral derecho
- [ ] `/#/favoritos` muestra las fotos marcadas
- [ ] `/#/albumes` permite crear y eliminar álbumes
- [ ] `/#/eventos` permite crear y eliminar eventos
- [ ] `/#/personas` permite crear y eliminar personas
- [ ] `/#/lugares` muestra lugares (requiere fotos con lugar asignado)
- [ ] `/#/tags` muestra nube de tags (requiere fotos con etiquetas)
- [ ] `/#/admin` muestra campos de lugar, personas y álbum
- [ ] Demo badge en sidebar muestra X/50 fotos

- [ ] **Paso 5: Commit final**

```bash
git add -A
git commit -m "feat: ARCHIPEG v2.0 — rediseño Dark Premium completo con todas las organizaciones"
```
