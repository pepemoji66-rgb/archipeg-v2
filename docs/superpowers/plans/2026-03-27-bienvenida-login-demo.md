# Bienvenida con Login y Demo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir una pantalla de bienvenida con login, registro y modo demo (50 fotos máximo) a Archipeg, con autenticación por email/contraseña almacenada en SQLite.

**Architecture:** React `AuthContext` almacena `{ usuario, token, esDemo }` en memoria (sin persistencia). El servidor valida credenciales y emite tokens simples. Un middleware en Express lee el header `Authorization` para decidir si aplicar el límite de 50 fotos.

**Tech Stack:** React 19, React Router (HashRouter), Express, SQLite (módulo `sqlite`), Node.js `crypto` (sin dependencias extra).

**Servidor:** `http://localhost:5001` — variable `API` ya definida en los componentes como `http://localhost:5001/api`.

---

## Mapa de archivos

| Acción | Archivo | Responsabilidad |
|--------|---------|----------------|
| Modificar | `server.js` | Añadir tablas, helpers, endpoints y middleware de auth |
| Crear | `src/AuthContext.js` | Estado global de sesión, funciones login/registro/demo/logout |
| Crear | `src/components/Bienvenida.js` | Pantalla landing con formulario login/registro y botón demo |
| Crear | `src/components/bienvenida.css` | Estilos neon de la pantalla de bienvenida |
| Modificar | `src/App.js` | Envolver con `AuthProvider`, redirigir a Bienvenida si no hay sesión |

---

## Task 1: Tablas de auth y helpers de contraseñas en server.js

**Files:**
- Modify: `server.js:1-15` (añadir `require('crypto')`)
- Modify: `server.js:32-36` (añadir constantes ADMINS y helpers)
- Modify: `server.js:55-112` (añadir tablas en `inicializarMotor`)

- [ ] **Step 1: Añadir require de crypto al bloque de requires**

En `server.js`, justo debajo de `const fs = require('fs');` (línea ~15), añadir:

```js
const crypto = require('crypto');
```

- [ ] **Step 2: Añadir constantes y helpers de auth**

Justo después de `let db;` (línea ~32) y antes de `// --- CONFIGURACIÓN DE VERSIÓN ---`, añadir:

```js
// --- AUTENTICACIÓN ---
const ADMINS = ['correodefranciscovalero@gmail.com', 'pepemoji66@gmail.com'];

function hashPassword(password, salt) {
    return crypto.createHash('sha256').update(salt + password).digest('hex');
}

function generarToken() {
    return crypto.randomBytes(32).toString('hex');
}
```

- [ ] **Step 3: Añadir tablas usuarios y sesiones en inicializarMotor**

Dentro de `inicializarMotor()`, después de la última línea del bloque `await db.exec(...)` con `foto_personas` (antes del `console.log`), añadir:

```js
    await db.exec(`
        CREATE TABLE IF NOT EXISTS usuarios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            salt TEXT NOT NULL,
            es_admin INTEGER DEFAULT 0,
            creado_en TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS sesiones (
            token TEXT PRIMARY KEY,
            usuario_id INTEGER NOT NULL
        );
    `);
```

- [ ] **Step 4: Verificar que el servidor arranca sin errores**

```bash
node server.js
```

Esperado: `✅ MOTOR ARCHIPEG: Sistema autónomo conectado y archivos estáticos listos.`

Si hay error de sintaxis, revisar los bloques añadidos.

- [ ] **Step 5: Verificar que las tablas se crearon**

```bash
sqlite3 archipeg_data.db ".tables"
```

Esperado: ver `usuarios` y `sesiones` en la lista.

- [ ] **Step 6: Commit**

```bash
git add server.js
git commit -m "feat: añadir tablas usuarios/sesiones y helpers de auth"
```

---

## Task 2: Endpoint POST /api/auth/registro

**Files:**
- Modify: `server.js` (añadir ruta después de las constantes de versión)

- [ ] **Step 1: Añadir el endpoint de registro**

En `server.js`, justo antes de `// --- RUTAS API ---` o después de `inicializarMotor()`, añadir:

```js
// --- AUTH: REGISTRO ---
app.post('/api/auth/registro', async (req, res) => {
    try {
        if (!db) return res.status(503).json({ error: 'Servidor iniciándose, reintenta en un momento' });
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ error: 'Email y contraseña requeridos' });

        const existente = await db.get('SELECT id FROM usuarios WHERE email = ?', [email]);
        if (existente) return res.status(409).json({ error: 'Este email ya está registrado' });

        const salt = crypto.randomBytes(16).toString('hex');
        const password_hash = hashPassword(password, salt);
        const es_admin = ADMINS.includes(email.toLowerCase()) ? 1 : 0;

        const result = await db.run(
            'INSERT INTO usuarios (email, password_hash, salt, es_admin) VALUES (?, ?, ?, ?)',
            [email.toLowerCase(), password_hash, salt, es_admin]
        );

        const token = generarToken();
        await db.run('INSERT INTO sesiones (token, usuario_id) VALUES (?, ?)', [token, result.lastID]);

        res.json({ usuario: { id: result.lastID, email: email.toLowerCase(), esAdmin: es_admin === 1 }, token });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error al registrar usuario' });
    }
});
```

- [ ] **Step 2: Probar el endpoint con curl**

```bash
curl -s -X POST http://localhost:5001/api/auth/registro \
  -H "Content-Type: application/json" \
  -d '{"email":"prueba@test.com","password":"123456"}' | jq
```

Esperado:
```json
{
  "usuario": { "id": 1, "email": "prueba@test.com", "esAdmin": false },
  "token": "<cadena hex de 64 caracteres>"
}
```

- [ ] **Step 3: Probar registro duplicado**

```bash
curl -s -X POST http://localhost:5001/api/auth/registro \
  -H "Content-Type: application/json" \
  -d '{"email":"prueba@test.com","password":"otraClave"}' | jq
```

Esperado: `{ "error": "Este email ya está registrado" }` con status 409.

- [ ] **Step 4: Probar con email de admin**

```bash
curl -s -X POST http://localhost:5001/api/auth/registro \
  -H "Content-Type: application/json" \
  -d '{"email":"correodefranciscovalero@gmail.com","password":"adminpass"}' | jq
```

Esperado: `"esAdmin": true` en la respuesta.

- [ ] **Step 5: Commit**

```bash
git add server.js
git commit -m "feat: añadir endpoint POST /api/auth/registro"
```

---

## Task 3: Endpoint POST /api/auth/login

**Files:**
- Modify: `server.js` (añadir ruta de login a continuación del registro)

- [ ] **Step 1: Añadir el endpoint de login**

En `server.js`, justo después del endpoint `/api/auth/registro`, añadir:

```js
// --- AUTH: LOGIN ---
app.post('/api/auth/login', async (req, res) => {
    try {
        if (!db) return res.status(503).json({ error: 'Servidor iniciándose, reintenta en un momento' });
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ error: 'Email y contraseña requeridos' });

        const usuario = await db.get('SELECT * FROM usuarios WHERE email = ?', [email.toLowerCase()]);
        if (!usuario) return res.status(401).json({ error: 'Email o contraseña incorrectos' });

        const hash = hashPassword(password, usuario.salt);
        if (hash !== usuario.password_hash) return res.status(401).json({ error: 'Email o contraseña incorrectos' });

        const token = generarToken();
        await db.run('INSERT INTO sesiones (token, usuario_id) VALUES (?, ?)', [token, usuario.id]);

        res.json({
            usuario: { id: usuario.id, email: usuario.email, esAdmin: usuario.es_admin === 1 },
            token
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error al iniciar sesión' });
    }
});
```

- [ ] **Step 2: Probar login correcto**

```bash
curl -s -X POST http://localhost:5001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"prueba@test.com","password":"123456"}' | jq
```

Esperado: `{ "usuario": { ... }, "token": "<hex>" }`

- [ ] **Step 3: Probar login con contraseña incorrecta**

```bash
curl -s -X POST http://localhost:5001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"prueba@test.com","password":"mala"}' | jq
```

Esperado: `{ "error": "Email o contraseña incorrectos" }` con status 401.

- [ ] **Step 4: Commit**

```bash
git add server.js
git commit -m "feat: añadir endpoint POST /api/auth/login"
```

---

## Task 4: Middleware de autenticación + actualizar rutas demo

**Files:**
- Modify: `server.js` — añadir middleware y actualizar rutas `/api/fotos/subir`, `/api/imagenes`, `/api/fotos-mapa`

- [ ] **Step 1: Añadir authMiddleware**

En `server.js`, justo después de `app.use(express.json());` (línea ~21), añadir:

```js
// --- MIDDLEWARE DE AUTENTICACIÓN ---
async function authMiddleware(req, res, next) {
    req.esAutenticado = false;
    req.esAdmin = false;
    if (!db) return next();
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        try {
            const sesion = await db.get(
                'SELECT u.id, u.email, u.es_admin FROM sesiones s JOIN usuarios u ON s.usuario_id = u.id WHERE s.token = ?',
                [token]
            );
            if (sesion) {
                req.esAutenticado = true;
                req.esAdmin = sesion.es_admin === 1;
            }
        } catch (e) { /* db no lista todavía */ }
    }
    next();
}
app.use(authMiddleware);
```

- [ ] **Step 2: Actualizar ruta POST /api/fotos/subir**

Buscar en `server.js` el bloque (línea ~124):
```js
        if (MODO_DEMO) {
            const { count } = await db.get("SELECT COUNT(*) as count FROM fotos WHERE en_papelera = 0");
            if (count >= LIMITE_DEMO) {
                return res.status(403).json({ error: `DEMO: límite de ${LIMITE_DEMO} fotos alcanzado. Actualiza a la versión completa.` });
            }
        }
```

Reemplazarlo por:
```js
        if (!req.esAutenticado) {
            const { count } = await db.get("SELECT COUNT(*) as count FROM fotos WHERE en_papelera = 0");
            if (count >= LIMITE_DEMO) {
                return res.status(403).json({ error: `DEMO: límite de ${LIMITE_DEMO} fotos alcanzado. Regístrate gratis para continuar.` });
            }
        }
```

- [ ] **Step 3: Actualizar ruta GET /api/imagenes**

Buscar (línea ~147):
```js
        const query = MODO_DEMO
            ? "SELECT * FROM fotos WHERE en_papelera = 0 ORDER BY anio DESC, id DESC LIMIT ?"
            : "SELECT * FROM fotos WHERE en_papelera = 0 ORDER BY anio DESC, id DESC";
        const fotos = MODO_DEMO
            ? await db.all(query, [LIMITE_DEMO])
            : await db.all(query);
```

Reemplazar por:
```js
        const query = !req.esAutenticado
            ? "SELECT * FROM fotos WHERE en_papelera = 0 ORDER BY anio DESC, id DESC LIMIT ?"
            : "SELECT * FROM fotos WHERE en_papelera = 0 ORDER BY anio DESC, id DESC";
        const fotos = !req.esAutenticado
            ? await db.all(query, [LIMITE_DEMO])
            : await db.all(query);
```

- [ ] **Step 4: Actualizar ruta GET /api/fotos-mapa**

Buscar (línea ~160):
```js
        const query = MODO_DEMO
            ? "SELECT * FROM fotos WHERE latitud IS NOT NULL AND en_papelera = 0 LIMIT ?"
            : "SELECT * FROM fotos WHERE latitud IS NOT NULL AND en_papelera = 0";
        const fotos = MODO_DEMO
            ? await db.all(query, [LIMITE_DEMO])
            : await db.all(query);
```

Reemplazar por:
```js
        const query = !req.esAutenticado
            ? "SELECT * FROM fotos WHERE latitud IS NOT NULL AND en_papelera = 0 LIMIT ?"
            : "SELECT * FROM fotos WHERE latitud IS NOT NULL AND en_papelera = 0";
        const fotos = !req.esAutenticado
            ? await db.all(query, [LIMITE_DEMO])
            : await db.all(query);
```

- [ ] **Step 5: Verificar con curl que el middleware funciona**

Sin token (demo):
```bash
curl -s http://localhost:5001/api/imagenes | jq length
```
Esperado: número ≤ 50.

Con token válido (reemplaza `<TOKEN>` por el obtenido en el login del Task 3):
```bash
curl -s http://localhost:5001/api/imagenes \
  -H "Authorization: Bearer <TOKEN>" | jq length
```
Esperado: número sin límite (puede ser el mismo si hay menos de 50 fotos).

- [ ] **Step 6: Commit**

```bash
git add server.js
git commit -m "feat: añadir middleware auth y actualizar límites demo por autenticación"
```

---

## Task 5: AuthContext.js en React

**Files:**
- Create: `src/AuthContext.js`

- [ ] **Step 1: Crear src/AuthContext.js**

```js
import React, { createContext, useContext, useState } from 'react';

const API = 'http://localhost:5001/api';
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [auth, setAuth] = useState({ usuario: null, token: null, esDemo: false });

    async function login(email, password) {
        const res = await fetch(`${API}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error al iniciar sesión');
        setAuth({ usuario: data.usuario, token: data.token, esDemo: false });
        return data.usuario;
    }

    async function registro(email, password) {
        const res = await fetch(`${API}/auth/registro`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error al registrarse');
        setAuth({ usuario: data.usuario, token: data.token, esDemo: false });
        return data.usuario;
    }

    function entrarDemo() {
        setAuth({ usuario: null, token: null, esDemo: true });
    }

    function logout() {
        setAuth({ usuario: null, token: null, esDemo: false });
    }

    return (
        <AuthContext.Provider value={{ ...auth, login, registro, entrarDemo, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}
```

- [ ] **Step 2: Verificar que no hay errores de sintaxis**

```bash
node -e "require('./src/AuthContext.js')" 2>&1 || echo "Error de sintaxis detectado"
```

Si hay error, revisar el archivo. Si dice "Cannot use import statement" es normal (es JSX/ESM).

- [ ] **Step 3: Commit**

```bash
git add src/AuthContext.js
git commit -m "feat: añadir AuthContext con login, registro, demo y logout"
```

---

## Task 6: Bienvenida.js + bienvenida.css

**Files:**
- Create: `src/components/Bienvenida.js`
- Create: `src/components/bienvenida.css`

- [ ] **Step 1: Crear src/components/bienvenida.css**

```css
.bienvenida-page {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 32px;
    padding: 24px;
}

.bienvenida-titulo-marco {
    border: 6px solid #ff2d7d;
    box-shadow: 0 0 25px #ff2d7d, inset 0 0 15px rgba(255, 45, 125, 0.3);
    border-radius: 20px;
    padding: 32px 48px;
    text-align: center;
}

.bienvenida-titulo {
    font-size: 2.8rem;
    font-weight: 900;
    letter-spacing: 6px;
    color: #ffffff;
    margin: 0 0 8px 0;
    text-transform: uppercase;
}

.bienvenida-subtitulo {
    font-size: 0.85rem;
    letter-spacing: 3px;
    color: #00f2ff;
    margin: 0;
    text-transform: uppercase;
}

.bienvenida-formulario {
    background: rgba(255, 255, 255, 0.04);
    border: 2px solid #00f2ff;
    box-shadow: 0 0 20px rgba(0, 242, 255, 0.2);
    border-radius: 16px;
    padding: 36px 40px;
    width: 100%;
    max-width: 400px;
    display: flex;
    flex-direction: column;
    gap: 16px;
}

.bienvenida-formulario h2 {
    margin: 0 0 8px 0;
    color: #ffffff;
    font-size: 1.1rem;
    letter-spacing: 2px;
    text-transform: uppercase;
    text-align: center;
}

.bienvenida-input {
    background: rgba(0, 0, 0, 0.4);
    border: 1px solid rgba(0, 242, 255, 0.4);
    border-radius: 8px;
    padding: 12px 16px;
    color: #ffffff;
    font-size: 0.95rem;
    width: 100%;
    box-sizing: border-box;
    outline: none;
    transition: border-color 0.2s;
}

.bienvenida-input:focus {
    border-color: #00f2ff;
    box-shadow: 0 0 8px rgba(0, 242, 255, 0.3);
}

.bienvenida-input::placeholder {
    color: rgba(255, 255, 255, 0.35);
}

.bienvenida-btn-primary {
    background: transparent;
    border: 2px solid #00f2ff;
    color: #00f2ff;
    padding: 12px;
    border-radius: 8px;
    font-size: 0.9rem;
    font-weight: 700;
    letter-spacing: 2px;
    text-transform: uppercase;
    cursor: pointer;
    transition: all 0.2s;
    box-shadow: 0 0 10px rgba(0, 242, 255, 0.3);
}

.bienvenida-btn-primary:hover {
    background: #00f2ff;
    color: #0a0b2e;
    box-shadow: 0 0 20px #00f2ff;
}

.bienvenida-btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.bienvenida-toggle {
    text-align: center;
    font-size: 0.85rem;
    color: rgba(255, 255, 255, 0.5);
}

.bienvenida-toggle button {
    background: none;
    border: none;
    color: #00f2ff;
    cursor: pointer;
    font-size: 0.85rem;
    padding: 0;
    margin-left: 4px;
    text-decoration: underline;
}

.bienvenida-error {
    color: #ff4d4d;
    font-size: 0.82rem;
    text-align: center;
    background: rgba(255, 77, 77, 0.1);
    border: 1px solid rgba(255, 77, 77, 0.3);
    border-radius: 6px;
    padding: 8px 12px;
}

.bienvenida-separador {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    max-width: 400px;
    color: rgba(255, 255, 255, 0.3);
    font-size: 0.8rem;
    letter-spacing: 1px;
}

.bienvenida-separador::before,
.bienvenida-separador::after {
    content: '';
    flex: 1;
    height: 1px;
    background: rgba(255, 255, 255, 0.15);
}

.bienvenida-demo-bloque {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
}

.bienvenida-btn-demo {
    background: transparent;
    border: 2px solid #ff2d7d;
    color: #ff2d7d;
    padding: 10px 32px;
    border-radius: 8px;
    font-size: 0.85rem;
    font-weight: 700;
    letter-spacing: 2px;
    text-transform: uppercase;
    cursor: pointer;
    transition: all 0.2s;
    box-shadow: 0 0 10px rgba(255, 45, 125, 0.2);
}

.bienvenida-btn-demo:hover {
    background: #ff2d7d;
    color: #ffffff;
    box-shadow: 0 0 20px #ff2d7d;
}

.bienvenida-demo-nota {
    font-size: 0.75rem;
    color: rgba(255, 255, 255, 0.35);
    letter-spacing: 1px;
}
```

- [ ] **Step 2: Crear src/components/Bienvenida.js**

```jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import './bienvenida.css';

export default function Bienvenida() {
    const [modo, setModo] = useState('login'); // 'login' | 'registro'
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmar, setConfirmar] = useState('');
    const [error, setError] = useState('');
    const [cargando, setCargando] = useState(false);
    const { login, registro, entrarDemo } = useAuth();
    const navigate = useNavigate();

    const limpiar = () => { setError(''); setPassword(''); setConfirmar(''); };

    const cambiarModo = (nuevoModo) => { setModo(nuevoModo); limpiar(); };

    async function handleSubmit(e) {
        e.preventDefault();
        setError('');

        if (modo === 'registro' && password !== confirmar) {
            setError('Las contraseñas no coinciden');
            return;
        }
        if (password.length < 6) {
            setError('La contraseña debe tener al menos 6 caracteres');
            return;
        }

        setCargando(true);
        try {
            if (modo === 'login') {
                await login(email.trim(), password);
            } else {
                await registro(email.trim(), password);
            }
            navigate('/galeria-completa');
        } catch (err) {
            setError(err.message);
        } finally {
            setCargando(false);
        }
    }

    function handleDemo() {
        entrarDemo();
        navigate('/galeria-completa');
    }

    return (
        <div className="bienvenida-page">
            <div className="bienvenida-titulo-marco">
                <h1 className="bienvenida-titulo">ARCHIPEG<span style={{ color: '#00f2ff' }}> ·</span></h1>
                <p className="bienvenida-subtitulo">Gestión y Archivo Fotográfico</p>
            </div>

            <form className="bienvenida-formulario" onSubmit={handleSubmit}>
                <h2>{modo === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}</h2>

                <input
                    className="bienvenida-input"
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    autoFocus
                />
                <input
                    className="bienvenida-input"
                    type="password"
                    placeholder="Contraseña"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                />
                {modo === 'registro' && (
                    <input
                        className="bienvenida-input"
                        type="password"
                        placeholder="Confirmar contraseña"
                        value={confirmar}
                        onChange={e => setConfirmar(e.target.value)}
                        required
                    />
                )}

                {error && <div className="bienvenida-error">{error}</div>}

                <button className="bienvenida-btn-primary" type="submit" disabled={cargando}>
                    {cargando ? 'Cargando...' : modo === 'login' ? 'INICIAR SESIÓN' : 'REGISTRARSE'}
                </button>

                <div className="bienvenida-toggle">
                    {modo === 'login' ? (
                        <>¿No tienes cuenta?<button type="button" onClick={() => cambiarModo('registro')}>Regístrate</button></>
                    ) : (
                        <>¿Ya tienes cuenta?<button type="button" onClick={() => cambiarModo('login')}>Inicia sesión</button></>
                    )}
                </div>
            </form>

            <div className="bienvenida-separador">o continúa con</div>

            <div className="bienvenida-demo-bloque">
                <button className="bienvenida-btn-demo" onClick={handleDemo}>
                    PROBAR DEMO
                </button>
                <span className="bienvenida-demo-nota">Limitado a 50 fotos · Sin registro</span>
            </div>
        </div>
    );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/Bienvenida.js src/components/bienvenida.css
git commit -m "feat: añadir pantalla de bienvenida con login, registro y demo"
```

---

## Task 7: App.js — AuthProvider y protección de rutas

**Files:**
- Modify: `src/App.js`

- [ ] **Step 1: Reemplazar el contenido completo de src/App.js**

```jsx
import React from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './AuthContext';
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
import Favoritos from './components/Favoritos';
import Tags from './components/Tags';
import Bienvenida from './components/Bienvenida';
import './App.css';

const withLayout = (Component) => (props) => (
    <Layout><Component {...props} /></Layout>
);

const GaleriaL = withLayout(Galeria);
const AdminL = withLayout(AdminPanel);
const PapeleraL = withLayout(Papelera);
const VistaAnioL = withLayout(VistaAnio);
const AlbumesL = withLayout(Albumes);
const AlbumDetalleL = withLayout(AlbumDetalle);
const EventosL = withLayout(Eventos);
const PersonasL = withLayout(Personas);
const FavoritosL = withLayout(Favoritos);
const TagsL = withLayout(Tags);

function RutaAdmin({ children }) {
    const { usuario } = useAuth();
    if (!usuario?.esAdmin) return <Navigate to="/galeria-completa" replace />;
    return children;
}

function AppRoutes() {
    const { usuario, esDemo } = useAuth();
    const haySession = usuario !== null || esDemo;

    if (!haySession) {
        return (
            <Routes>
                <Route path="*" element={<Bienvenida />} />
            </Routes>
        );
    }

    return (
        <Routes>
            <Route path="/" element={<Indice />} />
            <Route path="/galeria-completa" element={<GaleriaL />} />
            <Route path="/anio/:anio" element={<VistaAnioL />} />
            <Route path="/galeria/:anio" element={<VistaAnioL />} />
            <Route path="/admin" element={<RutaAdmin><AdminL /></RutaAdmin>} />
            <Route path="/papelera" element={<PapeleraL />} />
            <Route path="/albumes" element={<AlbumesL />} />
            <Route path="/albumes/:id" element={<AlbumDetalleL />} />
            <Route path="/eventos" element={<EventosL />} />
            <Route path="/personas" element={<PersonasL />} />
            <Route path="/favoritos" element={<FavoritosL />} />
            <Route path="/tags" element={<TagsL />} />
        </Routes>
    );
}

function App() {
    return (
        <AuthProvider>
            <Router>
                <AppRoutes />
            </Router>
        </AuthProvider>
    );
}

export default App;
```

- [ ] **Step 2: Verificar que la app arranca sin errores**

```bash
npm start
```

Esperado: la app abre en el navegador y muestra la pantalla de Bienvenida (no la galería directamente).

- [ ] **Step 3: Probar flujo completo de login**

1. Abrir la app → debe aparecer la pantalla de Bienvenida
2. Introducir email y contraseña de una cuenta ya registrada → pulsar "INICIAR SESIÓN"
3. Debe navegar a `/galeria-completa`
4. Verificar que la galería carga correctamente

- [ ] **Step 4: Probar flujo de registro**

1. Pulsar "Regístrate" en el formulario → aparecen tres campos
2. Rellenar email nuevo, contraseña y confirmar contraseña
3. Pulsar "REGISTRARSE" → debe navegar a la galería
4. Si el email coincide con un admin → comprobar que `/admin` es accesible

- [ ] **Step 5: Probar modo demo**

1. Pulsar "PROBAR DEMO" → debe entrar a la galería sin login
2. La galería muestra máximo 50 fotos

- [ ] **Step 6: Probar protección de /admin**

1. Entrar como usuario NO admin
2. Navegar manualmente a `/#/admin`
3. Esperado: redirigir automáticamente a `/galeria-completa`

4. Entrar como `correodefranciscovalero@gmail.com` o `pepemoji66@gmail.com`
5. Navegar a `/#/admin`
6. Esperado: panel de administración visible

- [ ] **Step 7: Commit final**

```bash
git add src/App.js
git commit -m "feat: integrar AuthProvider y proteger rutas con login/demo/admin"
```

---

## Verificación final

- [ ] El servidor arranca sin errores: `node server.js`
- [ ] La app React muestra Bienvenida al iniciar: `npm start`
- [ ] Login con cuenta existente → acceso a la galería
- [ ] Registro con cuenta nueva → acceso a la galería
- [ ] Demo → galería limitada a 50 fotos
- [ ] Email admin → acceso a `/admin`
- [ ] Email no-admin o demo → `/admin` redirige a `/galeria-completa`
- [ ] Sin sesión → cualquier ruta muestra Bienvenida
