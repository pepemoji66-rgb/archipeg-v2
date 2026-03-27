# Edición de foto desde ModalZoom — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir editar título, año, lugar, descripción, tags, personas y álbum de una foto directamente desde el modal de detalle (`ModalZoom`), sin salir a otra pantalla.

**Architecture:** El panel lateral de `ModalZoom` añade un botón "Editar" que alterna entre modo lectura (actual) y modo edición (formulario). Toda la lógica de edición vive dentro del mismo componente `ModalZoom.js`. El backend recibe dos endpoints nuevos para actualizar campos básicos y consultar álbumes de una foto.

**Tech Stack:** Node.js/Express + SQLite (`server.js`), React (`ModalZoom.js`), CSS custom properties (`modalzoom.css`)

**Spec:** `docs/superpowers/specs/2026-03-26-edicion-foto-modal-design.md`

---

## Mapa de archivos

| Archivo | Cambio |
|---------|--------|
| `server.js` | +2 endpoints: `PATCH /api/fotos/:id` y `GET /api/fotos/:id/albumes` |
| `src/components/ModalZoom.js` | +estados de edición, `entrarModoEdicion`, helpers de tags, `guardar`, render condicional del formulario |
| `src/components/modalzoom.css` | +clases CSS para inputs, selects, tags activos y botón guardar |
| `src/components/Galeria.js` | +prop `onFotoActualizada` en `<ModalZoom>` |
| `src/components/Favoritos.js` | +prop `onFotoActualizada` en `<ModalZoom>` |
| `src/components/AlbumDetalle.js` | +prop `onFotoActualizada` en `<ModalZoom>` |
| `src/components/Eventos.js` | +prop `onFotoActualizada` en `<ModalZoom>` |
| `src/components/Personas.js` | +prop `onFotoActualizada` en `<ModalZoom>` |

---

## Tarea 1: Backend — PATCH /api/fotos/:id

**Archivos:**
- Modificar: `server.js` (añadir después de la línea del endpoint `PATCH /api/fotos/:id/favorito`, ~línea 232)

- [ ] **Paso 1: Añadir el endpoint en server.js**

Busca el bloque del endpoint `PATCH /api/fotos/:id/favorito` (~línea 223). Añade el siguiente bloque **después** de ese endpoint (después del cierre `});`):

```javascript
// FOTO — actualizar campos básicos
app.patch('/api/fotos/:id', async (req, res) => {
    try {
        const { titulo, anio, lugar, etiquetas, descripcion } = req.body;
        await db.run(
            "UPDATE fotos SET titulo = ?, anio = ?, lugar = ?, etiquetas = ?, descripcion = ? WHERE id = ?",
            [titulo, anio, lugar, etiquetas, descripcion, req.params.id]
        );
        res.json({ ok: true });
    } catch (err) { res.status(500).json(err); }
});
```

- [ ] **Paso 2: Arrancar el servidor y verificar con curl**

```bash
node server.js &
curl -s -X PATCH http://localhost:5001/api/fotos/1 \
  -H "Content-Type: application/json" \
  -d '{"titulo":"Test edicion","anio":2024,"lugar":"Madrid","etiquetas":"test","descripcion":"desc test"}'
```

Resultado esperado: `{"ok":true}`

- [ ] **Paso 3: Commit**

```bash
git add server.js
git commit -m "feat: endpoint PATCH /api/fotos/:id para edición de campos básicos"
```

---

## Tarea 2: Backend — GET /api/fotos/:id/albumes

**Archivos:**
- Modificar: `server.js` (añadir junto a los endpoints de álbumes, ~después de línea 332)

- [ ] **Paso 1: Añadir el endpoint en server.js**

Busca el bloque `app.delete('/api/albumes/:id/fotos/:fotoId'` (~línea 327). Añade el siguiente bloque **después** de ese endpoint:

```javascript
// FOTO — obtener álbumes de una foto
app.get('/api/fotos/:id/albumes', async (req, res) => {
    try {
        const albumes = await db.all(
            "SELECT a.* FROM albumes a JOIN album_fotos af ON a.id = af.album_id WHERE af.foto_id = ?",
            [req.params.id]
        );
        res.json(albumes);
    } catch (err) { res.status(500).json(err); }
});
```

- [ ] **Paso 2: Verificar con curl** (el servidor ya debe estar corriendo)

```bash
curl -s http://localhost:5001/api/fotos/1/albumes
```

Resultado esperado: array JSON (puede ser `[]` si la foto no tiene álbum asignado).

- [ ] **Paso 3: Commit**

```bash
git add server.js
git commit -m "feat: endpoint GET /api/fotos/:id/albumes"
```

---

## Tarea 3: ModalZoom — Estados nuevos, entrarModoEdicion y helpers de tags

**Archivos:**
- Modificar: `src/components/ModalZoom.js`

- [ ] **Paso 1: Añadir el prop `onFotoActualizada` a la firma del componente**

Localiza la línea 6:
```javascript
const ModalZoom = ({ foto, onClose, onNavigate, onBorrar, getFotoUrl, setBusqueda, onFavoritoToggle }) => {
```

Reemplázala por:
```javascript
const ModalZoom = ({ foto, onClose, onNavigate, onBorrar, getFotoUrl, setBusqueda, onFavoritoToggle, onFotoActualizada }) => {
```

- [ ] **Paso 2: Añadir los estados nuevos y resetear modo edición al navegar**

Localiza el bloque de `useState` existente (~líneas 7-12):
```javascript
    const [escala, setEscala] = useState(1);
    const [pos, setPos] = useState({ x: 0, y: 0 });
    const [arrastrando, setArrastrando] = useState(false);
    const [inicio, setInicio] = useState({ x: 0, y: 0 });
    const [personas, setPersonas] = useState([]);
    const [fotoLocal, setFotoLocal] = useState(foto);
```

También localiza el `useEffect` de la línea 14:
```javascript
    useEffect(() => { setFotoLocal(foto); setEscala(1); setPos({ x:0, y:0 }); }, [foto]);
```

Reemplaza el bloque de estados **y** ese useEffect por lo siguiente:
```javascript
    const [escala, setEscala] = useState(1);
    const [pos, setPos] = useState({ x: 0, y: 0 });
    const [arrastrando, setArrastrando] = useState(false);
    const [inicio, setInicio] = useState({ x: 0, y: 0 });
    const [personas, setPersonas] = useState([]);
    const [fotoLocal, setFotoLocal] = useState(foto);

    // Modo edición
    const [modoEdicion, setModoEdicion] = useState(false);
    const [editTitulo, setEditTitulo] = useState('');
    const [editAnio, setEditAnio] = useState('');
    const [editLugar, setEditLugar] = useState('');
    const [editDescripcion, setEditDescripcion] = useState('');
    const [editTags, setEditTags] = useState([]);
    const [tagInput, setTagInput] = useState('');
    const [todasPersonas, setTodasPersonas] = useState([]);
    const [personasSeleccionadas, setPersonasSeleccionadas] = useState([]);
    const [todosAlbumes, setTodosAlbumes] = useState([]);
    const [albumActual, setAlbumActual] = useState('');
    const [albumOriginal, setAlbumOriginal] = useState('');
    const [guardando, setGuardando] = useState(false);
```

Y reemplaza el useEffect de la línea 14 por:
```javascript
    useEffect(() => { setFotoLocal(foto); setEscala(1); setPos({ x:0, y:0 }); setModoEdicion(false); }, [foto]);
```

- [ ] **Paso 3: Añadir la función `entrarModoEdicion` y los helpers de tags**

Localiza la función `descargar` (~línea 50). Añade el siguiente bloque **antes** de la línea `const tags = ...` (pero después de `descargar`):

```javascript
    const entrarModoEdicion = async () => {
        setEditTitulo(fotoLocal.titulo || '');
        setEditAnio(fotoLocal.anio || '');
        setEditLugar(fotoLocal.lugar || '');
        setEditDescripcion(fotoLocal.descripcion || '');
        setEditTags(fotoLocal.etiquetas ? fotoLocal.etiquetas.split(',').map(t => t.trim()).filter(Boolean) : []);

        if (todasPersonas.length === 0) {
            const r = await fetch(`${API}/personas`);
            const data = await r.json();
            setTodasPersonas(data);
        }
        if (todosAlbumes.length === 0) {
            const r = await fetch(`${API}/albumes`);
            const data = await r.json();
            setTodosAlbumes(data);
        }

        const r = await fetch(`${API}/fotos/${fotoLocal.id}/albumes`);
        const albsFoto = await r.json();
        const albumId = albsFoto.length > 0 ? String(albsFoto[0].id) : '';
        setAlbumActual(albumId);
        setAlbumOriginal(albumId);

        setPersonasSeleccionadas(personas.map(p => p.id));
        setModoEdicion(true);
    };

    const añadirTag = (texto) => {
        const tag = texto.trim();
        if (tag && !editTags.includes(tag)) {
            setEditTags(prev => [...prev, tag]);
        }
        setTagInput('');
    };

    const quitarTag = (index) => {
        setEditTags(prev => prev.filter((_, i) => i !== index));
    };
```

- [ ] **Paso 4: Verificar que no hay errores de compilación**

```bash
cd /Users/franciscovalero/Desktop/proyectos/ARCHIPEG && npm start
```

La app debe arrancar sin errores en la consola. Abre el modal de cualquier foto — el comportamiento debe ser idéntico al actual (aún no hemos añadido el botón ni el formulario).

- [ ] **Paso 5: Commit**

```bash
git add src/components/ModalZoom.js
git commit -m "feat: estados de edición y entrarModoEdicion en ModalZoom"
```

---

## Tarea 4: ModalZoom — Función guardar + CSS del modo edición

**Archivos:**
- Modificar: `src/components/ModalZoom.js`
- Modificar: `src/components/modalzoom.css`

- [ ] **Paso 1: Añadir la función `guardar` en ModalZoom.js**

Justo después de `quitarTag`, antes de `const tags = ...`, añade:

```javascript
    const guardar = async () => {
        setGuardando(true);
        try {
            await fetch(`${API}/fotos/${fotoLocal.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    titulo: editTitulo,
                    anio: editAnio,
                    lugar: editLugar,
                    etiquetas: editTags.join(','),
                    descripcion: editDescripcion
                })
            });

            await fetch(`${API}/fotos/${fotoLocal.id}/personas`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ persona_ids: personasSeleccionadas })
            });

            if (albumActual !== albumOriginal) {
                if (albumOriginal) {
                    await fetch(`${API}/albumes/${albumOriginal}/fotos/${fotoLocal.id}`, { method: 'DELETE' });
                }
                if (albumActual) {
                    await fetch(`${API}/albumes/${albumActual}/fotos`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ foto_id: fotoLocal.id })
                    });
                }
            }

            const fotoActualizada = {
                ...fotoLocal,
                titulo: editTitulo,
                anio: Number(editAnio),
                lugar: editLugar,
                etiquetas: editTags.join(','),
                descripcion: editDescripcion
            };
            setFotoLocal(fotoActualizada);
            setPersonas(todasPersonas.filter(p => personasSeleccionadas.includes(p.id)));
            if (onFotoActualizada) onFotoActualizada(fotoActualizada);

            setModoEdicion(false);
        } catch (err) {
            console.error('Error al guardar foto:', err);
        } finally {
            setGuardando(false);
        }
    };
```

- [ ] **Paso 2: Añadir clases CSS al final de modalzoom.css**

```css
/* --- MODO EDICIÓN --- */
.modal-edit-input,
.modal-edit-textarea,
.modal-edit-select {
    width: 100%;
    box-sizing: border-box;
    background: var(--bg-elevado);
    border: 1px solid var(--borde-suave);
    border-radius: 6px;
    color: var(--texto-primario);
    font-size: 0.78rem;
    padding: 6px 8px;
    font-family: inherit;
}
.modal-edit-input:focus,
.modal-edit-textarea:focus,
.modal-edit-select:focus {
    outline: none;
    border-color: var(--acento);
}
.modal-edit-textarea { resize: vertical; }
.modal-edit-select { cursor: pointer; }

.modal-tag-activa {
    background: var(--acento-suave) !important;
    color: var(--acento) !important;
    border: 1px solid var(--acento) !important;
}

.modal-tag-edit {
    display: inline-flex;
    align-items: center;
    gap: 3px;
}
.modal-tag-edit-quitar {
    background: none;
    border: none;
    color: inherit;
    cursor: pointer;
    font-size: 0.6rem;
    padding: 0;
    line-height: 1;
    opacity: 0.7;
}
.modal-tag-edit-quitar:hover { opacity: 1; }

.modal-btn-guardar {
    background: var(--acento);
    color: #fff;
    border: none;
    border-radius: 8px;
    padding: 8px 12px;
    font-size: 0.78rem;
    font-weight: 600;
    cursor: pointer;
    transition: opacity 0.15s;
    width: 100%;
}
.modal-btn-guardar:hover { opacity: 0.88; }
.modal-btn-guardar:disabled { opacity: 0.45; cursor: not-allowed; }
```

- [ ] **Paso 3: Verificar compilación**

```bash
npm start
```

Sin errores en consola.

- [ ] **Paso 4: Commit**

```bash
git add src/components/ModalZoom.js src/components/modalzoom.css
git commit -m "feat: función guardar y CSS del modo edición en ModalZoom"
```

---

## Tarea 5: ModalZoom — Formulario de edición (render condicional)

**Archivos:**
- Modificar: `src/components/ModalZoom.js`

- [ ] **Paso 1: Reemplazar el bloque del panel lateral en el JSX**

Localiza el bloque `{/* PANEL LATERAL */}` en el JSX (~línea 88). El bloque completo empieza en `<div className="modal-panel">` y termina antes del cierre de `<div className="modal-contenido">`.

Reemplaza ese bloque completo por:

```jsx
                {/* PANEL LATERAL */}
                {modoEdicion ? (
                    <div className="modal-panel">
                        <div className="modal-panel-titulo">✏️ Editando foto</div>

                        <div>
                            <div className="modal-panel-label">Título</div>
                            <input
                                className="modal-edit-input"
                                value={editTitulo}
                                onChange={e => setEditTitulo(e.target.value)}
                                placeholder="Sin título"
                            />
                        </div>

                        <div style={{ display: 'flex', gap: '8px' }}>
                            <div style={{ flex: '0 0 70px' }}>
                                <div className="modal-panel-label">Año</div>
                                <input
                                    className="modal-edit-input"
                                    type="number"
                                    value={editAnio}
                                    onChange={e => setEditAnio(e.target.value)}
                                />
                            </div>
                            <div style={{ flex: 1 }}>
                                <div className="modal-panel-label">Lugar</div>
                                <input
                                    className="modal-edit-input"
                                    value={editLugar}
                                    onChange={e => setEditLugar(e.target.value)}
                                    placeholder="Ciudad, país..."
                                />
                            </div>
                        </div>

                        <div>
                            <div className="modal-panel-label">Descripción</div>
                            <textarea
                                className="modal-edit-textarea"
                                value={editDescripcion}
                                onChange={e => setEditDescripcion(e.target.value)}
                                rows={3}
                                placeholder="Descripción opcional..."
                            />
                        </div>

                        <div>
                            <div className="modal-panel-label">Tags</div>
                            <div className="modal-tags" style={{ marginBottom: '6px' }}>
                                {editTags.map((tag, i) => (
                                    <span key={i} className="modal-tag modal-tag-edit">
                                        #{tag}
                                        <button
                                            className="modal-tag-edit-quitar"
                                            onClick={() => quitarTag(i)}
                                            title="Quitar tag"
                                        >✕</button>
                                    </span>
                                ))}
                            </div>
                            <input
                                className="modal-edit-input"
                                value={tagInput}
                                onChange={e => setTagInput(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); añadirTag(tagInput); }}}
                                placeholder="Nuevo tag + Enter"
                            />
                        </div>

                        {todasPersonas.length > 0 && (
                            <div>
                                <div className="modal-panel-label">Personas</div>
                                <div className="modal-tags">
                                    {todasPersonas.map(p => (
                                        <button
                                            key={p.id}
                                            className={`modal-tag ${personasSeleccionadas.includes(p.id) ? 'modal-tag-activa' : ''}`}
                                            onClick={() => setPersonasSeleccionadas(prev =>
                                                prev.includes(p.id) ? prev.filter(id => id !== p.id) : [...prev, p.id]
                                            )}
                                        >
                                            👤 {p.nombre}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div>
                            <div className="modal-panel-label">Álbum</div>
                            <select
                                className="modal-edit-select"
                                value={albumActual}
                                onChange={e => setAlbumActual(e.target.value)}
                            >
                                <option value="">📁 Sin álbum</option>
                                {todosAlbumes.map(a => (
                                    <option key={a.id} value={String(a.id)}>{a.nombre}</option>
                                ))}
                            </select>
                        </div>

                        <div className="modal-acciones">
                            <button
                                className="modal-btn-guardar"
                                onClick={guardar}
                                disabled={guardando}
                            >
                                {guardando ? 'Guardando...' : '💾 Guardar cambios'}
                            </button>
                            <button
                                className="btn-ghost"
                                onClick={() => setModoEdicion(false)}
                                disabled={guardando}
                            >
                                Cancelar
                            </button>
                        </div>

                        <div className="modal-zoom-info">ID: {fotoLocal.id}</div>
                    </div>
                ) : (
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
                            <button className="btn-ghost" onClick={entrarModoEdicion}>✏️ Editar</button>
                            <button className="btn-peligro" onClick={e => onBorrar(fotoLocal.id, e)}>🗑️ Mover a papelera</button>
                        </div>

                        <div className="modal-zoom-info">Zoom: {Math.round(escala * 100)}% · ID: {fotoLocal.id}</div>
                    </div>
                )}
```

- [ ] **Paso 2: Verificar en navegador**

Con `npm start` corriendo, abre cualquier foto en el modal:
1. El panel debe mostrar el botón "✏️ Editar" en las acciones
2. Al pulsar "✏️ Editar", el panel debe mostrar el formulario con los campos precargados
3. Al pulsar "Cancelar", debe volver al modo lectura
4. Al editar el título y pulsar "💾 Guardar cambios", el panel debe actualizar el título mostrado

- [ ] **Paso 3: Verificar guardado real**

1. Edita el título de una foto y guarda
2. Cierra el modal y vuelve a abrirlo — el nuevo título debe persistir
3. Asigna una persona y guarda — debe aparecer en el panel de lectura

- [ ] **Paso 4: Commit**

```bash
git add src/components/ModalZoom.js
git commit -m "feat: formulario de edición en ModalZoom con modo lectura/edición"
```

---

## Tarea 6: Componentes padre — Prop onFotoActualizada

**Archivos:**
- Modificar: `src/components/Galeria.js`
- Modificar: `src/components/Favoritos.js`
- Modificar: `src/components/AlbumDetalle.js`
- Modificar: `src/components/Eventos.js`
- Modificar: `src/components/Personas.js`

### Galeria.js

- [ ] **Paso 1: Añadir handler y prop en Galeria.js**

Localiza el bloque `{fotoZoom && (<ModalZoom ...`  (~línea 176). Reemplaza el bloque completo por:

```jsx
            {fotoZoom && (
                <ModalZoom
                    foto={fotoZoom}
                    onClose={() => setFotoZoom(null)}
                    onNavigate={navegar}
                    onBorrar={borrar}
                    getFotoUrl={getFotoUrl}
                    setBusqueda={setBusqueda}
                    onFavoritoToggle={(fotoActualizada) =>
                        setFotos(prev => prev.map(f => f.id === fotoActualizada.id ? fotoActualizada : f))
                    }
                    onFotoActualizada={(fotoActualizada) =>
                        setFotos(prev => prev.map(f => f.id === fotoActualizada.id ? fotoActualizada : f))
                    }
                />
            )}
```

### Favoritos.js

- [ ] **Paso 2: Añadir prop en Favoritos.js**

Localiza el bloque `{fotoZoom && (<ModalZoom ...` en Favoritos.js (~línea 62). Reemplaza el bloque completo por:

```jsx
            {fotoZoom && (
                <ModalZoom
                    foto={fotoZoom}
                    onClose={() => setFotoZoom(null)}
                    onNavigate={navegar}
                    onBorrar={borrar}
                    getFotoUrl={getFotoUrl}
                    setBusqueda={() => {}}
                    onFavoritoToggle={(f) => setFotos(prev => f.favorito ? prev.map(x => x.id === f.id ? f : x) : prev.filter(x => x.id !== f.id))}
                    onFotoActualizada={(fotoActualizada) =>
                        setFotos(prev => prev.map(f => f.id === fotoActualizada.id ? fotoActualizada : f))
                    }
                />
            )}
```

### AlbumDetalle.js

- [ ] **Paso 3: Añadir prop en AlbumDetalle.js**

Localiza el bloque `{fotoZoom && (<ModalZoom ...` en AlbumDetalle.js (~línea 82). Reemplaza el bloque completo por:

```jsx
                {fotoZoom && (
                    <ModalZoom
                        foto={fotoZoom}
                        onClose={() => setFotoZoom(null)}
                        onNavigate={navegar}
                        onBorrar={borrar}
                        getFotoUrl={getFotoUrl}
                        setBusqueda={() => {}}
                        onFotoActualizada={(fotoActualizada) =>
                            setFotos(prev => prev.map(f => f.id === fotoActualizada.id ? fotoActualizada : f))
                        }
                    />
                )}
```

### Eventos.js

- [ ] **Paso 4: Añadir prop en Eventos.js**

Localiza la línea que contiene `{fotoZoom && <ModalZoom foto={fotoZoom}...` en Eventos.js (~línea 81). Reemplaza esa línea por:

```jsx
            {fotoZoom && <ModalZoom
                foto={fotoZoom}
                onClose={() => setFotoZoom(null)}
                onNavigate={navegar}
                onBorrar={async (id) => {
                    await fetch(`${API}/imagenes/${id}`, { method: 'DELETE' });
                    setFotoZoom(null);
                    const r = await fetch(`${API}/eventos/${eventoActivo.id}/fotos`);
                    setFotosEvento(await r.json());
                }}
                getFotoUrl={getFotoUrl}
                setBusqueda={() => {}}
                onFotoActualizada={(fotoActualizada) =>
                    setFotosEvento(prev => prev.map(f => f.id === fotoActualizada.id ? fotoActualizada : f))
                }
            />}
```

### Personas.js

- [ ] **Paso 5: Añadir prop en Personas.js**

Localiza la línea que contiene `{fotoZoom && <ModalZoom foto={fotoZoom}...` en Personas.js (~línea 72). Reemplaza esa línea por:

```jsx
            {fotoZoom && <ModalZoom
                foto={fotoZoom}
                onClose={() => setFotoZoom(null)}
                onNavigate={navegar}
                onBorrar={async (id) => {
                    await fetch(`${API}/imagenes/${id}`, { method: 'DELETE' });
                    setFotoZoom(null);
                    const r = await fetch(`${API}/personas/${personaActiva.id}/fotos`);
                    setFotos(await r.json());
                }}
                getFotoUrl={getFotoUrl}
                setBusqueda={() => {}}
                onFotoActualizada={(fotoActualizada) =>
                    setFotos(prev => prev.map(f => f.id === fotoActualizada.id ? fotoActualizada : f))
                }
            />}
```

- [ ] **Paso 6: Verificar que todos los componentes compilan**

```bash
npm start
```

Sin errores en consola. Navega por Galería, Favoritos, AlbumDetalle, Eventos y Personas — en todos, el modal debe mostrar el botón "✏️ Editar".

- [ ] **Paso 7: Commit final**

```bash
git add src/components/Galeria.js src/components/Favoritos.js src/components/AlbumDetalle.js src/components/Eventos.js src/components/Personas.js
git commit -m "feat: propagar onFotoActualizada en todos los componentes que usan ModalZoom"
```
