# Spec: Pantalla de Bienvenida con Login y Demo — Archipeg

**Fecha:** 2026-03-27
**Estado:** Aprobado

---

## Resumen

Añadir una pantalla de bienvenida (landing) que actúa como barrera de entrada a la aplicación. El usuario puede iniciar sesión, registrarse, o probar la app en modo demo (limitado a 50 fotos). Los usuarios registrados tienen acceso sin límite de fotos. Dos emails son admins hardcodeados con acceso al panel de administración.

---

## Arquitectura

### Frontend (React)

- **`AuthContext.js`** — Contexto global que almacena `{ usuario, token, esDemo }`. Proporciona funciones `login()`, `registro()`, `entrarDemo()`, `logout()`.
- **`Bienvenida.js`** — Pantalla de bienvenida. Contiene el formulario de login/registro (toggle) y el botón de demo. Única ruta pública.
- **`App.js`** — Envuelve toda la app con `AuthProvider`. Si no hay sesión (`usuario === null && esDemo === false`), muestra `Bienvenida` en lugar de las rutas protegidas.

### Backend (server.js)

- **Tabla `usuarios`**: `id, email, password_hash, salt, es_admin, creado_en`
- **Tabla `sesiones`**: `token, usuario_id` — en memoria (se pierde al reiniciar la app)
- **`POST /api/auth/registro`** — Crea usuario, hashea contraseña con SHA-256 + salt, devuelve `{ usuario, token }`
- **`POST /api/auth/login`** — Valida credenciales, devuelve `{ usuario, token }`
- **Middleware auth** — Lee header `Authorization: Bearer <token>`, determina si la petición es autenticada o demo. Establece `req.esAutenticado` y `req.esAdmin`.

---

## Pantalla de Bienvenida (Bienvenida.js)

### Layout

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│              ┌─────────────────────────┐                │
│              │  ARCHIPEG ·             │  ← marco neon  │
│              │  Gestión fotográfica    │    fucsia       │
│              └─────────────────────────┘                │
│                                                         │
│         ┌──────────────────────────────────┐            │
│         │  Email                           │            │
│         │  Contraseña                      │            │
│         │                                  │            │
│         │  [ INICIAR SESIÓN ]  (cian)       │            │
│         │                                  │            │
│         │  ¿No tienes cuenta? Regístrate   │            │
│         └──────────────────────────────────┘            │
│                                                         │
│              ──────── o continúa con ────────           │
│                                                         │
│              [ PROBAR DEMO ]  (fucsia, más pequeño)     │
│              "Limitado a 50 fotos · Sin registro"       │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Comportamiento del formulario

- **Toggle Login/Registro** — mismo componente, sin cambio de ruta. Al pulsar "Regístrate" aparecen campos adicionales: nombre + confirmar contraseña.
- **Estética** — fondo `#0a0b2e`, formulario con borde neon turquesa, botón principal en cian, botón demo en fucsia.
- **Errores inline** — mensajes en rojo bajo el formulario:
  - Login fallido: *"Email o contraseña incorrectos"*
  - Email duplicado: *"Este email ya está registrado"*
  - Contraseñas no coinciden: *"Las contraseñas no coinciden"*

---

## Flujo de datos

### Login exitoso
1. Usuario introduce email + contraseña → `POST /api/auth/login`
2. Servidor valida hash → devuelve `{ usuario: { id, email, esAdmin }, token }`
3. `AuthContext` guarda `{ usuario, token, esDemo: false }`
4. `App.js` detecta sesión válida → renderiza rutas normales

### Registro exitoso
1. Usuario introduce email + contraseña → `POST /api/auth/registro`
2. Servidor crea usuario (con `es_admin = 1` si el email es admin hardcodeado)
3. Devuelve `{ usuario, token }` → mismo flujo que login

### Modo Demo
1. Usuario pulsa "Probar Demo" → `AuthContext` establece `{ usuario: null, token: null, esDemo: true }`
2. App se abre sin token en las llamadas API
3. El servidor aplica `MODO_DEMO = true` → límite de 50 fotos
4. Cuando se alcanza el límite → banner en la UI: *"Demo limitada a 50 fotos — Regístrate gratis para continuar"*

---

## Protección de rutas

| Ruta | Demo | Usuario registrado | Admin |
|------|------|-------------------|-------|
| `/` (Bienvenida) | ✓ | redirige a `/galeria-completa` | redirige a `/galeria-completa` |
| `/galeria-completa` | ✓ | ✓ | ✓ |
| `/admin` | ✗ | ✗ | ✓ |
| resto de rutas | ✓ | ✓ | ✓ |

---

## Admins hardcodeados

Los siguientes emails reciben automáticamente `es_admin = 1` al registrarse:

- `correodefranciscovalero@gmail.com`
- `pepemoji66@gmail.com`

El panel `/admin` verifica `usuario.esAdmin === true`. Si no cumple, redirige a `/galeria-completa`.

---

## Seguridad de contraseñas

- Módulo `crypto` de Node.js (sin dependencias externas)
- Salt aleatorio de 16 bytes generado por usuario
- Hash: `SHA-256(salt + password)`
- Almacenado: `password_hash` + `salt` en tabla `usuarios`

---

## Gestión de sesión

- **Duración:** solo mientras la app Electron está abierta
- **Sin persistencia:** no hay localStorage ni archivo en disco
- **Al cerrar:** AuthContext se destruye, hay que volver a logarse
- **Tokens de sesión:** generados con `crypto.randomBytes(32).toString('hex')`, almacenados en tabla `sesiones` en SQLite (persisten entre reinicios pero el AuthContext no — el usuario tendrá que relogarse de todas formas)

---

## Archivos a crear/modificar

### Crear
- `src/AuthContext.js`
- `src/components/Bienvenida.js`
- `src/components/bienvenida.css`

### Modificar
- `src/App.js` — añadir `AuthProvider`, lógica de rutas protegidas
- `server.js` — añadir tablas, endpoints de auth, middleware

---

## Fuera de alcance

- Sistema de pago / suscripciones (se implementará en el futuro)
- Recuperación de contraseña
- Panel de gestión de usuarios desde el admin (se puede añadir después)
- "Recordarme" / sesión persistente entre reinicios
