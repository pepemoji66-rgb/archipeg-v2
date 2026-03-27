/**
 * =============================================================================
 * SOFTWARE: ARCHIPEG PRO - MOTOR INTEGRAL AUTÓNOMO
 * COPYRIGHT © 2026 - JOSE MORENO JIMENEZ
 * =============================================================================
 */

const express = require('express');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();

// --- MIDDLEWARES ---
app.use(cors());
app.use(express.json());

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

// 🟢 LA PIEZA QUE FALTABA: Servir archivos estáticos
// Esto crea el puente entre la URL /uploads y tu carpeta física
const dirDestino = path.join(__dirname, 'fotos_archipeg');
app.use('/uploads', express.static(dirDestino));

// Si no existe la carpeta, la crea automáticamente
if (!fs.existsSync(dirDestino)) {
    fs.mkdirSync(dirDestino, { recursive: true });
}

let db;

// --- AUTENTICACIÓN ---
const ADMINS = ['correodefranciscovalero@gmail.com', 'pepemoji66@gmail.com'];

function hashPassword(password, salt) {
    return crypto.createHash('sha256').update(salt + password).digest('hex');
}

function generarToken() {
    return crypto.randomBytes(32).toString('hex');
}

// --- CONFIGURACIÓN DE VERSIÓN ---
const LIMITE_DEMO = 50;

// --- CONFIGURACIÓN DE MULTER ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, dirDestino),
    filename: (req, file, cb) => {
        // Guardamos con timestamp para evitar nombres duplicados
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage: storage });

// --- INICIALIZACIÓN DEL MOTOR SQLITE ---
async function inicializarMotor() {
    db = await open({
        filename: path.join(__dirname, 'archipeg_data.db'),
        driver: sqlite3.Database
    });

    await db.exec(`
        CREATE TABLE IF NOT EXISTS fotos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            titulo TEXT,
            descripcion TEXT,
            anio INTEGER,
            mes INTEGER,
            etiquetas TEXT,
            imagen_url TEXT,
            latitud REAL,
            longitud REAL,
            en_papelera INTEGER DEFAULT 0
        )
    `);

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

    console.log("✅ MOTOR ARCHIPEG: Sistema autónomo conectado y archivos estáticos listos.");
}
inicializarMotor();

// --- AUTH: REGISTRO ---
app.post('/api/auth/registro', async (req, res) => {
    try {
        if (!db) return res.status(503).json({ error: 'Servidor iniciándose, reintenta en un momento' });
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ error: 'Email y contraseña requeridos' });

        const existente = await db.get('SELECT id FROM usuarios WHERE email = ?', [email.toLowerCase()]);
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

// --- RUTAS API ---

// 0. SUBIR FOTOS
app.post('/api/fotos/subir', upload.array('foto'), async (req, res) => {
    try {
        const { titulo, anio, descripcion, etiquetas } = req.body;
        const archivos = req.files;
        if (!archivos || archivos.length === 0) return res.status(400).json({ message: "Sin fotos" });

        if (!req.esAutenticado) {
            const { count } = await db.get("SELECT COUNT(*) as count FROM fotos WHERE en_papelera = 0");
            if (count >= LIMITE_DEMO) {
                return res.status(403).json({ error: `DEMO: límite de ${LIMITE_DEMO} fotos alcanzado. Regístrate gratis para continuar.` });
            }
        }

        for (const file of archivos) {
            await db.run(
                "INSERT INTO fotos (titulo, anio, descripcion, etiquetas, imagen_url, en_papelera) VALUES (?, ?, ?, ?, ?, 0)",
                [titulo, anio, descripcion, etiquetas || "", file.filename]
            );
        }
        res.json({ message: "✅ Guardado en ARCHIPEG local" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Fallo al subir archivos" });
    }
});

// 1. GALERÍA PRINCIPAL
app.get('/api/imagenes', async (req, res) => {
    try {
        const query = !req.esAutenticado
            ? "SELECT * FROM fotos WHERE en_papelera = 0 ORDER BY anio DESC, id DESC LIMIT ?"
            : "SELECT * FROM fotos WHERE en_papelera = 0 ORDER BY anio DESC, id DESC";
        const fotos = !req.esAutenticado
            ? await db.all(query, [LIMITE_DEMO])
            : await db.all(query);
        res.json(fotos.map(f => ({ ...f, etiquetas: f.etiquetas || "" })));
    } catch (err) { res.status(500).json(err); }
});

// 2. MAPA
app.get('/api/fotos-mapa', async (req, res) => {
    try {
        const query = !req.esAutenticado
            ? "SELECT * FROM fotos WHERE latitud IS NOT NULL AND en_papelera = 0 LIMIT ?"
            : "SELECT * FROM fotos WHERE latitud IS NOT NULL AND en_papelera = 0";
        const fotos = !req.esAutenticado
            ? await db.all(query, [LIMITE_DEMO])
            : await db.all(query);
        res.json(fotos);
    } catch (err) { res.status(500).json(err); }
});

// 3. OBTENER AÑOS
app.get('/api/anios', async (req, res) => {
    try {
        const anios = await db.all("SELECT DISTINCT anio FROM fotos WHERE en_papelera = 0 ORDER BY anio DESC");
        res.json(anios);
    } catch (err) { res.status(500).json(err); }
});

// ACTUALIZAR CAMPOS BÁSICOS DE UNA FOTO
app.patch('/api/fotos/:id', async (req, res) => {
    try {
        const { titulo, descripcion, anio, mes, etiquetas, lugar } = req.body;
        await db.run(
            "UPDATE fotos SET titulo = COALESCE(?, titulo), descripcion = COALESCE(?, descripcion), anio = COALESCE(?, anio), mes = COALESCE(?, mes), etiquetas = COALESCE(?, etiquetas), lugar = COALESCE(?, lugar) WHERE id = ?",
            [titulo, descripcion, anio, mes, etiquetas, lugar, req.params.id]
        );
        res.json({ ok: true });
    } catch (err) { res.status(500).json(err); }
});

// ÁLBUMES DE UNA FOTO
app.get('/api/fotos/:id/albumes', async (req, res) => {
    try {
        const albumes = await db.all(
            "SELECT a.* FROM albumes a JOIN album_fotos af ON a.id = af.album_id WHERE af.foto_id = ?",
            [req.params.id]
        );
        res.json(albumes);
    } catch (err) { res.status(500).json(err); }
});

// EVENTOS DE UNA FOTO
app.get('/api/fotos/:id/eventos', async (req, res) => {
    try {
        const eventos = await db.all(
            "SELECT e.* FROM eventos e JOIN evento_fotos ef ON e.id = ef.evento_id WHERE ef.foto_id = ?",
            [req.params.id]
        );
        res.json(eventos);
    } catch (err) { res.status(500).json(err); }
});

// QUITAR FOTO DE EVENTO
app.delete('/api/eventos/:id/fotos/:fotoId', async (req, res) => {
    try {
        await db.run("DELETE FROM evento_fotos WHERE evento_id = ? AND foto_id = ?", [req.params.id, req.params.fotoId]);
        res.json({ ok: true });
    } catch (err) { res.status(500).json(err); }
});

// 4. FILTRAR POR AÑO
app.get('/api/fotos/:anio', async (req, res) => {
    try {
        const query = !req.esAutenticado
            ? "SELECT * FROM fotos WHERE anio = ? AND en_papelera = 0 LIMIT ?"
            : "SELECT * FROM fotos WHERE anio = ? AND en_papelera = 0";
        const fotos = !req.esAutenticado
            ? await db.all(query, [req.params.anio, LIMITE_DEMO])
            : await db.all(query, [req.params.anio]);
        res.json(fotos);
    } catch (err) { res.status(500).json(err); }
});

// 5. MOVER A PAPELERA
app.delete('/api/imagenes/:id', async (req, res) => {
    try {
        await db.run("UPDATE fotos SET en_papelera = 1 WHERE id = ?", [req.params.id]);
        res.json({ message: "Movido a papelera" });
    } catch (err) { res.status(500).json(err); }
});

// 6. VER PAPELERA
app.get('/api/papelera', async (req, res) => {
    try {
        const fotos = await db.all("SELECT * FROM fotos WHERE en_papelera = 1 ORDER BY id DESC");
        res.json(fotos);
    } catch (err) { res.status(500).json(err); }
});

// 7. OPERACIONES PAPELERA
app.post('/api/papelera/operaciones', async (req, res) => {
    try {
        const { id, accion } = req.body;
        if (!['restaurar', 'eliminar_permanente'].includes(accion)) {
            return res.status(400).json({ error: "Acción inválida. Use 'restaurar' o 'eliminar_permanente'" });
        }
        if (accion === 'restaurar') {
            await db.run("UPDATE fotos SET en_papelera = 0 WHERE id = ?", [id]);
        } else {
            await db.run("DELETE FROM fotos WHERE id = ?", [id]);
        }
        res.json({ message: "Operación realizada" });
    } catch (err) { res.status(500).json(err); }
});

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
        await db.run("BEGIN");
        try {
            await db.run("DELETE FROM album_fotos WHERE album_id = ?", [req.params.id]);
            await db.run("DELETE FROM albumes WHERE id = ?", [req.params.id]);
            await db.run("COMMIT");
        } catch (e) {
            await db.run("ROLLBACK");
            throw e;
        }
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
        await db.run("BEGIN");
        try {
            await db.run("DELETE FROM evento_fotos WHERE evento_id = ?", [req.params.id]);
            await db.run("DELETE FROM eventos WHERE id = ?", [req.params.id]);
            await db.run("COMMIT");
        } catch (e) {
            await db.run("ROLLBACK");
            throw e;
        }
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
        await db.run("BEGIN");
        try {
            await db.run("DELETE FROM foto_personas WHERE persona_id = ?", [req.params.id]);
            await db.run("DELETE FROM personas WHERE id = ?", [req.params.id]);
            await db.run("COMMIT");
        } catch (e) {
            await db.run("ROLLBACK");
            throw e;
        }
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
        const { persona_ids } = req.body;
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

// --- LANZAMIENTO ---
const PORT = 5001;
app.listen(PORT, () => {
    console.log(`🚀 ARCHIPEG PRO: Operando en http://localhost:${PORT}`);
    console.log(`📂 Almacén de fotos: ${dirDestino}`);
});