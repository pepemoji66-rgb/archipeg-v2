# ARCHIPEG v2.0 — Diseño de Rediseño UX/UI

**Fecha:** 2026-03-25
**Estado:** Aprobado por el usuario

---

## Resumen

Rediseño completo de la interfaz de ARCHIPEG: nuevo estilo visual Dark Premium, galería Masonry, sidebar de navegación fijo, y 7 nuevas formas de organización de fotos.

---

## Decisiones de diseño

| Dimensión | Decisión |
|-----------|----------|
| Estilo visual | Dark Premium: fondo #111, superficies #1c1c1e/#2c2c2e, acento ámbar #ff9f0a |
| Layout galería | Masonry (columnas de ancho fijo, alto variable — estilo Pinterest) |
| Navegación | Sidebar fijo izquierdo, siempre visible |
| Organización | Todas: álbumes, eventos, personas, lugares, años, tags, favoritos |

---

## Paleta de colores

| Rol | Color |
|-----|-------|
| Fondo principal | `#111111` |
| Superficie (sidebar, cards) | `#1c1c1e` |
| Elevado (inputs, items) | `#2c2c2e` |
| Hover | `#3a3a3c` |
| Acento principal | `#ff9f0a` (ámbar) |
| Texto principal | `#f5f5f7` |
| Texto secundario | `#888888` |
| Bordes | `#222222` / `#333333` |

---

## Arquitectura de navegación (Sidebar)

```
ARCHIPEG ·
v2.0 · DEMO

[🔍 Buscar fotos...]

── Biblioteca ──
  🖼️ Todas las fotos      [count]
  ⭐ Favoritos             [count]

── Organizar ──
  📁 Álbumes              [count]
  📅 Eventos              [count]
  👤 Personas             [count]
  📍 Lugares              [count]
  📅 Años                 [count]
  🏷️ Tags

── Explorar ──
  🗺️ Mapa

── Sistema ──
  ⚙️ Gestión
  🗑️ Papelera

[+ SUBIR FOTOS]  ← botón ámbar fijo en el bottom
```

---

## Nuevas funcionalidades

### 1. Álbumes
- CRUD de álbumes con nombre y descripción opcional
- Asignar/desasignar fotos a un álbum desde el modal de zoom
- Una foto puede pertenecer a múltiples álbumes
- Vista de álbum: header con nombre + grid masonry de sus fotos
- Tabla nueva en BD: `albumes (id, nombre, descripcion, portada_id, creado_en)`
- Tabla relación: `album_fotos (album_id, foto_id)`

### 2. Eventos
- CRUD de eventos con nombre, fecha_inicio, fecha_fin
- Asignar fotos a un evento
- Vista de evento: barra de fechas + grid masonry
- Tabla nueva: `eventos (id, nombre, fecha_inicio, fecha_fin, descripcion)`
- Tabla relación: `evento_fotos (evento_id, foto_id)`

### 3. Personas
- CRUD de personas con nombre
- Etiquetar personas en cada foto (campo `personas` en tabla fotos como JSON array de IDs)
- Vista de persona: todas las fotos en las que aparece
- Tabla nueva: `personas (id, nombre)`
- Tabla relación: `foto_personas (foto_id, persona_id)`

### 4. Lugares
- Campo `lugar` (texto libre: ciudad, país) en tabla fotos
- Vista de lugares: lista de lugares únicos con conteo de fotos
- Al hacer clic en un lugar → galería filtrada por ese lugar
- Mapa mejorado con marcadores agrupados (clusters)

### 5. Años
- Ya existe como filtro. Se eleva a sección propia en el sidebar.
- Vista de año: header grande con el año + grid masonry de todas las fotos de ese año
- Sidebar muestra los años que tienen fotos (dinámico desde `/api/anios`)

### 6. Tags mejorados
- Autocompletado al escribir en el campo de tags (sugerencias de tags ya usados)
- Filtro por múltiples tags simultáneos (AND)
- Vista de nube de tags en sección "Tags" del sidebar
- Endpoint `/api/tags` que devuelve todos los tags únicos con su frecuencia

### 7. Favoritos
- Campo `favorito INTEGER DEFAULT 0` en tabla fotos
- Toggle de favorito con estrella en cada card de la galería (sin abrir modal)
- Vista "Favoritos" en sidebar muestra solo fotos marcadas
- Endpoint `PATCH /api/fotos/:id/favorito`

---

## Galería Masonry

- CSS `columns` nativo (sin librería externa)
- 4 columnas en desktop, 2 en tablet, 1 en móvil
- Cada card muestra: imagen, overlay con título/año al hover, botón de favorito
- Click en card → modal de zoom (igual que ahora, pero con estilo Dark Premium)

---

## Modal de zoom (actualizado)

El modal actual se mantiene con estas mejoras de UX:
- Fondo más oscuro y bordes redondeados
- Panel lateral derecho con: título, descripción, año, lugar, personas etiquetadas, tags, álbumes
- Botones de acción: Favorito, Descargar, Borrar, Asignar a álbum

---

## Panel de subida (Gestión)

El panel actual se mantiene. Se añaden campos:
- **Lugar** (texto libre)
- **Personas** (multi-select de la lista de personas existentes)
- **Álbum** (opcional, asignar al subir)
- **Favorito** (checkbox)

---

## Base de datos — cambios

```sql
-- Añadir a tabla fotos existente:
ALTER TABLE fotos ADD COLUMN favorito INTEGER DEFAULT 0;
ALTER TABLE fotos ADD COLUMN lugar TEXT;

-- Nuevas tablas:
CREATE TABLE albumes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  portada_id INTEGER,
  creado_en TEXT DEFAULT (datetime('now'))
);

CREATE TABLE album_fotos (
  album_id INTEGER,
  foto_id INTEGER,
  PRIMARY KEY (album_id, foto_id)
);

CREATE TABLE eventos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  fecha_inicio TEXT,
  fecha_fin TEXT,
  descripcion TEXT
);

CREATE TABLE evento_fotos (
  evento_id INTEGER,
  foto_id INTEGER,
  PRIMARY KEY (evento_id, foto_id)
);

CREATE TABLE personas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL
);

CREATE TABLE foto_personas (
  foto_id INTEGER,
  persona_id INTEGER,
  PRIMARY KEY (foto_id, persona_id)
);
```

---

## Nuevos endpoints API

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/tags` | Todos los tags únicos con frecuencia |
| PATCH | `/api/fotos/:id/favorito` | Toggle favorito |
| PATCH | `/api/fotos/:id/lugar` | Actualizar lugar |
| GET | `/api/albumes` | Listar álbumes |
| POST | `/api/albumes` | Crear álbum |
| DELETE | `/api/albumes/:id` | Eliminar álbum |
| POST | `/api/albumes/:id/fotos` | Añadir foto a álbum |
| DELETE | `/api/albumes/:id/fotos/:fotoId` | Quitar foto de álbum |
| GET | `/api/eventos` | Listar eventos |
| POST | `/api/eventos` | Crear evento |
| DELETE | `/api/eventos/:id` | Eliminar evento |
| POST | `/api/eventos/:id/fotos` | Añadir foto a evento |
| GET | `/api/personas` | Listar personas |
| POST | `/api/personas` | Crear persona |
| POST | `/api/fotos/:id/personas` | Asignar personas a foto |
| GET | `/api/lugares` | Lugares únicos con conteo |

---

## Componentes React nuevos/modificados

| Componente | Estado | Cambio |
|-----------|--------|--------|
| `App.js` | Modificar | Nuevas rutas: /albumes, /albumes/:id, /eventos, /personas, /lugares, /favoritos, /tags |
| `Sidebar.js` | **Nuevo** | Sidebar fijo con toda la navegación |
| `Galeria.js` | Modificar | Grid masonry, botón favorito en card, filtros mejorados |
| `ModalZoom.js` | Modificar | Panel lateral con info completa, asignar álbum |
| `AdminPanel.js` | Modificar | Nuevos campos: lugar, personas, álbum, favorito |
| `Albumes.js` | **Nuevo** | Lista de álbumes + CRUD |
| `AlbumDetalle.js` | **Nuevo** | Vista de un álbum con sus fotos |
| `Eventos.js` | **Nuevo** | Lista de eventos + CRUD |
| `Personas.js` | **Nuevo** | Lista de personas + CRUD |
| `Lugares.js` | **Nuevo** | Lista de lugares únicos |
| `Favoritos.js` | **Nuevo** | Galería filtrada a favoritos |
| `Tags.js` | **Nuevo** | Nube de tags, filtro por tag |

---

## Límite demo

- `MODO_DEMO = true` en server.js
- `LIMITE_DEMO = 50` fotos activas
- El sidebar muestra un indicador de progreso: "9/50 fotos"
- Al llegar al límite: aviso visible en sidebar y bloqueo en panel de subida

---

## Fuera de alcance (v2.0)

- Autenticación / multi-usuario
- Subida por arrastrar y soltar (drag & drop)
- Reconocimiento facial automático
- Compartir álbumes públicamente
