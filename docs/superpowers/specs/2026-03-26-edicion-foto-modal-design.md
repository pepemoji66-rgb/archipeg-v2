# Diseño: Edición de datos de foto desde ModalZoom

**Fecha:** 2026-03-26
**Estado:** Aprobado

---

## Objetivo

Permitir editar todos los datos de organización de una foto (título, año, lugar, descripción, tags, personas, álbum) directamente desde el modal de detalle de foto (`ModalZoom`), sin salir a otra pantalla.

---

## Experiencia de usuario

El panel lateral del modal (modo lectura actual) añade un botón **"✏️ Editar"** al final de la sección de acciones. Al pulsarlo, el panel se transforma en un formulario de edición. La imagen sigue visible a la izquierda en todo momento. Al pulsar "Guardar" o "Cancelar", el panel vuelve al modo lectura con los datos actualizados.

### Estados del panel

- **Modo lectura** (estado por defecto): muestra título, año, lugar, descripción, tags, personas y acciones (favorito, descargar, borrar, editar).
- **Modo edición**: muestra formulario con todos los campos editables, botones Guardar y Cancelar.

---

## Campos editables

Formulario en scroll continuo dentro del panel lateral:

| Campo | Tipo de control |
|-------|----------------|
| Título | `<input type="text">` |
| Año | `<input type="number">` |
| Lugar | `<input type="text">` |
| Descripción | `<textarea>` |
| Tags/etiquetas | Chips con ✕ para quitar + input para añadir nuevo tag (Enter confirma) |
| Personas | Chips toggle: se muestran todas las personas, las asignadas resaltadas; pulsar activa/desactiva |
| Álbum | `<select>` con todos los álbumes disponibles (asignación a un álbum) |

---

## Cambios en backend (`server.js`)

### Endpoints nuevos

**`PATCH /api/fotos/:id`**
- Body: `{ titulo, anio, lugar, etiquetas, descripcion }`
- Actualiza los campos básicos de la foto en la tabla `fotos`
- Responde: `{ ok: true }`

**`GET /api/fotos/:id/albumes`**
- Devuelve los álbumes a los que pertenece la foto
- Query: `SELECT a.* FROM albumes a JOIN album_fotos af ON a.id = af.album_id WHERE af.foto_id = ?`
- Responde: array de objetos álbum `[{ id, nombre }]`

### Endpoints existentes reutilizados

- `POST /api/fotos/:id/personas` — reemplaza las personas de la foto (body: `{ persona_ids: [...] }`)
- `GET /api/fotos/:id/personas` — ya usado en ModalZoom
- `POST /api/albumes/:id/fotos` — añade foto al álbum (body: `{ foto_id }`)
- `DELETE /api/albumes/:id/fotos/:fotoId` — quita foto del álbum
- `GET /api/albumes` — lista todos los álbumes (ya cargado en AdminPanel)
- `GET /api/personas` — lista todas las personas (ya cargado en AdminPanel)

---

## Cambios en frontend (`ModalZoom.js`)

### Estados nuevos

```js
const [modoEdicion, setModoEdicion] = useState(false);
const [editTitulo, setEditTitulo] = useState('');
const [editAnio, setEditAnio] = useState('');
const [editLugar, setEditLugar] = useState('');
const [editDescripcion, setEditDescripcion] = useState('');
const [editTags, setEditTags] = useState([]);       // array de strings
const [tagInput, setTagInput] = useState('');
const [todasPersonas, setTodasPersonas] = useState([]);
const [personasSeleccionadas, setPersonasSeleccionadas] = useState([]); // IDs
const [todosAlbumes, setTodosAlbumes] = useState([]);
const [albumActual, setAlbumActual] = useState('');  // ID del álbum o ''
const [albumOriginal, setAlbumOriginal] = useState(''); // para detectar cambio
const [guardando, setGuardando] = useState(false);
```

### Carga de datos al entrar en modo edición

Al pulsar "✏️ Editar":
1. Precargar los campos con los valores actuales de `fotoLocal`
2. Si `todasPersonas` está vacío, fetch a `GET /api/personas`
3. Si `todosAlbumes` está vacío, fetch a `GET /api/albumes`
4. Fetch `GET /api/fotos/:id/albumes` para conocer el álbum actual
5. `setModoEdicion(true)`

### Flujo de guardado

Al pulsar "Guardar":
1. `setGuardando(true)`
2. `PATCH /api/fotos/:id` con `{ titulo, anio, lugar, etiquetas: editTags.join(','), descripcion }`
3. `POST /api/fotos/:id/personas` con `{ persona_ids: personasSeleccionadas }`
4. Si `albumActual !== albumOriginal`:
   - Si `albumOriginal`: `DELETE /api/albumes/:albumOriginal/fotos/:fotoId`
   - Si `albumActual`: `POST /api/albumes/:albumActual/fotos` con `{ foto_id }`
5. Actualizar `fotoLocal` con los nuevos valores
6. Actualizar `personas` (estado de personas mostradas en modo lectura)
7. Propagar cambio al padre via callback `onFotoActualizada` (nuevo prop)
8. `setModoEdicion(false)`, `setGuardando(false)`

### Prop nuevo en ModalZoom

```js
// Notifica al padre que los datos de la foto han cambiado
onFotoActualizada: (fotoActualizada) => void
```

El padre (Galeria, VistaAnio, Favoritos, etc.) actualiza su lista local de fotos con la foto modificada.

---

## Archivos afectados

| Archivo | Cambio |
|---------|--------|
| `server.js` | Añadir `PATCH /api/fotos/:id` y `GET /api/fotos/:id/albumes` |
| `src/components/ModalZoom.js` | Añadir modo edición, estados, formulario y lógica de guardado |
| `src/components/Galeria.js` | Pasar prop `onFotoActualizada` a ModalZoom |
| `src/components/Favoritos.js` | Pasar prop `onFotoActualizada` a ModalZoom |
| `src/components/AlbumDetalle.js` | Pasar prop `onFotoActualizada` a ModalZoom |
| `src/components/Eventos.js` | Pasar prop `onFotoActualizada` a ModalZoom |
| `src/components/Personas.js` | Pasar prop `onFotoActualizada` a ModalZoom |

---

## Fuera de alcance

- Cambiar la imagen de la foto
- Crear nuevas personas o álbumes desde el modal (solo asignar existentes)
- Asignación a múltiples álbumes simultáneos
- Asignación a eventos desde el modal
