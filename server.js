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
const { exec } = require('child_process');
const ExifParser = require('exif-parser');

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
                'SELECT u.id, u.email, u.es_admin, u.aprobado FROM sesiones s JOIN usuarios u ON s.usuario_id = u.id WHERE s.token = ?',
                [token]
            );
            if (sesion) {
                req.esAutenticado = true;
                req.esAdmin = sesion.es_admin === 1;
                req.usuario = { id: sesion.id, email: sesion.email, aprobado: sesion.aprobado === 1 };
            }
        } catch (e) { /* db no lista todavía */ }
    }
    next();
}
app.use(authMiddleware);

// 🟢 SERVIR ARCHIVOS ESTÁTICOS: El puente entre la URL /uploads y la carpeta física
const basePath = process.env.ARCHIPEG_DATA_DIR || __dirname;
const dirDestino = path.join(basePath, 'fotos_archipeg');

// Si no existe la carpeta, la crea automáticamente (asegurando recursividad)
if (!fs.existsSync(dirDestino)) {
    fs.mkdirSync(dirDestino, { recursive: true });
}
app.use('/uploads', express.static(dirDestino));

// 🔵 SERVIR DESCARGAS: El puente para el instalador
const dirDescargas = path.join(basePath, 'downloads');
if (!fs.existsSync(dirDescargas)) {
    try {
        fs.mkdirSync(dirDescargas, { recursive: true });
    } catch (e) {
        console.error("Error al crear carpeta downloads:", e);
    }
}
app.use('/downloads', express.static(dirDescargas));

// 🚀 SERVIR FRONTEND (REACT BUILD) - Para producción en Render
const buildPath = path.join(__dirname, 'build');
if (fs.existsSync(buildPath)) {
    app.use(express.static(buildPath));
}

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

// --- IMPORTACIÓN MASIVA ---
const EXTENSIONES_IMAGEN = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic', '.bmp']);

function extraerMetadata(ruta) {
    const info = { lat: null, lon: null, anio: null, mes: null };
    let fd;
    try {
        // OPTIMIZACIÓN PRO: Solo leemos los primeros 64KB del archivo (donde reside el EXIF)
        // Esto evita cargar archivos de 5MB+ en memoria, acelerando el proceso x100
        const buffer = Buffer.alloc(65535);
        fd = fs.openSync(ruta, 'r');
        fs.readSync(fd, buffer, 0, 65535, 0);
        
        const parser = ExifParser.create(buffer);
        const result = parser.parse();
        
        if (result.tags) {
            if (result.tags.GPSLatitude && result.tags.GPSLongitude) {
                info.lat = result.tags.GPSLatitude;
                info.lon = result.tags.GPSLongitude;
            }
            if (result.tags.DateTimeOriginal) {
                const date = new Date(result.tags.DateTimeOriginal * 1000);
                if (!isNaN(date.getFullYear())) {
                    info.anio = date.getFullYear();
                    info.mes = date.getMonth() + 1;
                }
            }
        }
    } catch (e) {
        // console.error("Error EXIF:", e.message);
    } finally {
        if (fd !== undefined) {
            try { fs.closeSync(fd); } catch(e){}
        }
    }
    
    // Si falla EXIF, intentamos por FS (lo que ya teníamos)
    if (!info.anio) {
        try {
            const s = fs.statSync(ruta);
            const d = new Date(Math.min(s.mtimeMs, s.ctimeMs, s.birthtimeMs || Infinity));
            if (!isNaN(d.getFullYear())) {
                info.anio = d.getFullYear();
                info.mes = d.getMonth() + 1;
            }
        } catch (e) {}
    }
    return info;
}

const MIME_TIPOS = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.heic': 'image/heic',
    '.bmp': 'image/bmp'
};

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
        filename: path.join(basePath, 'archipeg_data.db'),
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

    // Migraciones para columnas nuevas en fotos (Soporte Multiusuario y Duplicados)
    await db.exec(`ALTER TABLE fotos ADD COLUMN favorito INTEGER DEFAULT 0`).catch(() => {});
    await db.exec(`ALTER TABLE fotos ADD COLUMN lugar TEXT`).catch(() => {});
    await db.exec(`ALTER TABLE fotos ADD COLUMN usuario_id INTEGER`).catch(() => {});
    await db.exec(`ALTER TABLE fotos ADD COLUMN es_duplicado INTEGER DEFAULT 0`).catch(() => {});
    
    await db.exec(`ALTER TABLE albumes ADD COLUMN privado INTEGER DEFAULT 0`).catch(() => {});
    await db.exec(`ALTER TABLE albumes ADD COLUMN usuario_id INTEGER`).catch(() => {});

    await db.exec(`ALTER TABLE eventos ADD COLUMN usuario_id INTEGER`).catch(() => {});
    await db.exec(`ALTER TABLE personas ADD COLUMN usuario_id INTEGER`).catch(() => {});

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
            aprobado INTEGER DEFAULT 0,
            creado_en TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS sesiones (
            token TEXT PRIMARY KEY,
            usuario_id INTEGER NOT NULL
        );
    `);

    // Migración segura para usuarios existentes que no tengan la columna aprobado
    await db.exec(`ALTER TABLE usuarios ADD COLUMN aprobado INTEGER DEFAULT 0`).catch(() => {});

    console.log("✅ MOTOR ARCHIPEG: Sistema autónomo conectado y archivos estáticos listos.");
}

// LOG DE EMERGENCIA: Si el motor falla, escribimos un archivo en la carpeta de datos
const logFile = path.join(basePath, 'error_motor.txt');
process.on('uncaughtException', (err) => {
    const errorText = `[${new Date().toISOString()}] ERROR NO CONTROLADO: ${err.stack}\n`;
    fs.appendFileSync(logFile, errorText);
    console.error(errorText);
    process.exit(1);
});

inicializarMotor().catch(err => {
    const errorText = `[${new Date().toISOString()}] ERROR CRÍTICO AL INICIAR EL MOTOR: ${err.stack}\n`;
    fs.appendFileSync(logFile, errorText);
    console.error(errorText);
    process.exit(1);
});

// --- LIMPIEZA AUTOMÁTICA DE FOTOS ROTAS (OPCIÓN A) ---
// Optimizada: No bloquea al usuario al iterar 10000 promesas simultáneas ni agota los sockets TCP
async function limpiarFotosRotas(fotos, req) {
    if (!req.esAutenticado || !fotos || fotos.length === 0) return fotos;
    
    setImmediate(async () => {
        const idRotas = [];
        for (const f of fotos) {
            let rutaAbsoluta = f.imagen_url;
            if (!rutaAbsoluta) continue;
            if (!path.isAbsolute(rutaAbsoluta)) {
                rutaAbsoluta = path.join(dirDestino, rutaAbsoluta);
            }
            try {
                await fs.promises.access(rutaAbsoluta, fs.constants.F_OK);
            } catch (err) {
                if (err.code === 'ENOENT') {
                    idRotas.push(f.id);
                }
            }
        }
        if (idRotas.length > 0) {
            const batchSize = 100;
            for(let i = 0; i < idRotas.length; i += batchSize) {
                const batch = idRotas.slice(i, i + batchSize);
                const placeholders = batch.map(() => '?').join(',');
                db.run(`DELETE FROM fotos WHERE id IN (${placeholders})`, batch).catch(console.error);
            }
        }
    });
    return fotos;
}

// --- AUTH: REGISTRO ---
const MASTER_ADMIN_KEY = 'ARCHIPEG-PRO-2026'; // Clave de sistema solicitada por el usuario

app.post('/api/auth/registro', async (req, res) => {
    try {
        if (!db) return res.status(503).json({ error: 'Servidor iniciándose, reintenta en un momento' });
        const { email, password, systemKey } = req.body;
        if (!email || !password) return res.status(400).json({ error: 'Email y contraseña requeridos' });

        const esIntentoAdmin = ADMINS.includes(email.toLowerCase());
        const esJose = email.toLowerCase() === 'pepemoji66@gmail.com';
        
        // Si intenta ser admin, validamos la clave maestra (excepto si es Jose para evitar bloqueos)
        if (esIntentoAdmin && !esJose && systemKey !== MASTER_ADMIN_KEY) {
            return res.status(403).json({ error: 'Clave de Sistema incorrecta para registro de Administrador' });
        }

        const existente = await db.get('SELECT id FROM usuarios WHERE email = ?', [email.toLowerCase()]);
        if (existente) return res.status(409).json({ error: 'Este email ya está registrado' });

        const salt = crypto.randomBytes(16).toString('hex');
        const password_hash = hashPassword(password, salt);
        const es_admin = esIntentoAdmin ? 1 : 0;
        const aprobado = (es_admin === 1 || esJose || systemKey === MASTER_ADMIN_KEY) ? 1 : 0;

        const result = await db.run(
            'INSERT INTO usuarios (email, password_hash, salt, es_admin, aprobado) VALUES (?, ?, ?, ?, ?)',
            [email.toLowerCase(), password_hash, salt, es_admin, aprobado]
        );

        const token = generarToken();
        await db.run('INSERT INTO sesiones (token, usuario_id) VALUES (?, ?)', [token, result.lastID]);
        res.status(201).json({ 
            usuario: { id: result.lastID, email: email.toLowerCase(), esAdmin: es_admin === 1, aprobado: aprobado === 1 }, 
            token,
            message: aprobado === 1 ? 'Registro exitoso.' : 'Registro exitoso. Entrando en Modo Demo (Activación pendiente).'
        });
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
        console.log(`🔑 INTENTO DE LOGIN: [${email}] | Clave: [${password}]`);
        if (!email || !password) return res.status(400).json({ error: 'Email y contraseña requeridos' });

        const usuario = await db.get('SELECT * FROM usuarios WHERE email = ?', [email.trim().toLowerCase()]);
        if (!usuario) {
            console.log(`❌ ERROR: El email [${email}] no existe en la base de datos local.`);
            return res.status(401).json({ error: 'Email o contraseña incorrectos' });
        }

        const hash = hashPassword(password, usuario.salt);
        console.log(`🔎 LOGIN DEBUG -> Generado: ${hash} | Guardado: ${usuario.password_hash}`);

        if (hash !== usuario.password_hash) {
            console.log(`❌ ERROR: La contraseña no coincide para [${email}]`);
            return res.status(401).json({ error: 'Email o contraseña incorrectos' });
        }

        // Permitimos login aunque no esté aprobado (entrará en modo demo)

        const token = generarToken();
        await db.run('INSERT INTO sesiones (token, usuario_id) VALUES (?, ?)', [token, usuario.id]);

        res.json({
            usuario: { id: usuario.id, email: usuario.email, esAdmin: usuario.es_admin === 1, aprobado: usuario.aprobado === 1 },
            token
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error al iniciar sesión' });
    }
});

// NUEVO: Endpoint para que el cliente refresque su perfil (ver si ha sido aprobado)
app.get('/api/auth/perfil', (req, res) => {
    if (!req.esAutenticado) return res.status(401).json({ error: 'No autenticado' });
    res.json({ usuario: req.usuario });
});

// --- AUTH: VERIFICAR PASSWORD (PARA ÁLBUMES PRIVADOS) ---
app.post('/api/auth/verificar-password', async (req, res) => {
    try {
        const { password } = req.body;
        if (!password) return res.status(400).json({ error: 'Contraseña requerida' });

        // PIN de Privacidad maestro solicitado por el usuario
        if (password === '121939') {
            return res.json({ ok: true });
        }

        // Si prefieres usar la cuenta o estamos en demo, devolvemos error si no es el PIN exacto.
        return res.status(401).json({ error: 'PIN de acceso denegado' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error interno de validación' });
    }
});

// --- RUTAS API ---

// 0. SUBIR FOTOS
app.post('/api/fotos/subir', upload.array('foto'), async (req, res) => {
    try {
        const { titulo, anio, mes, descripcion, etiquetas, lugar } = req.body;
        const archivos = req.files;
        if (!archivos || archivos.length === 0) return res.status(400).json({ message: "Sin fotos" });

        // LÍMITE DEMO: Tanto para invitados como para usuarios registrados pero NO aprobados
        if (!req.esAutenticado || (req.usuario && !req.usuario.aprobado)) {
            const userIdFilter = req.usuario ? req.usuario.id : null;
            const row = await db.get("SELECT COUNT(*) as count FROM fotos WHERE en_papelera = 0 AND usuario_id IS ?", [userIdFilter]);
            if (row.count >= LIMITE_DEMO) {
                return res.status(403).json({ error: `MODO DEMO: límite de ${LIMITE_DEMO} fotos alcanzado. Paga la suscripción o espera activación.` });
            }
        }

        // --- OPTIMIZACIÓN CRÍTICA: Transacción SQL para que 5.000+ fotos entren de un plumazo ---
        await db.run("BEGIN TRANSACTION");
        try {
            for (const file of archivos) {
                const rutaImagen = path.join(dirDestino, file.filename);
                const meta = extraerMetadata(rutaImagen);
                
                await db.run(
                    "INSERT INTO fotos (titulo, anio, mes, descripcion, etiquetas, imagen_url, latitud, longitud, en_papelera, usuario_id, lugar) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)",
                    [titulo || meta.anio, anio || meta.anio, mes || meta.mes, descripcion, etiquetas || "", file.filename, meta.lat, meta.lon, req.usuario?.id, lugar || ""]
                );
            }
            await db.run("COMMIT");
        } catch (e) {
            await db.run("ROLLBACK");
            throw e;
        }
        res.json({ message: "✅ Guardado en ARCHIPEG local" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Fallo al subir archivos" });
    }
});

// --- ZONA DE MANTENIMIENTO: RESET DE BASE DE DATOS ---
app.post('/api/sistema/limpiar-todo', async (req, res) => {
    try {
        if (!req.esAutenticado || !req.esAdmin) return res.status(403).json({ error: 'Solo Admin' });
        
        await db.run("BEGIN");
        try {
            await db.run("DELETE FROM fotos WHERE usuario_id = ?", [req.usuario?.id]);
            // No borramos álbumes ni eventos para no romper la estructura local, solo las asociaciones de fotos del usuario
            // Nota: Para ser 100% estrictos habría que borrar solo las asociaciones de fotos que pertenecen al usuario
            await db.run("DELETE FROM album_fotos WHERE foto_id IN (SELECT id FROM fotos WHERE usuario_id = ?)", [req.usuario?.id]);
            await db.run("DELETE FROM evento_fotos WHERE foto_id IN (SELECT id FROM fotos WHERE usuario_id = ?)", [req.usuario?.id]);
            await db.run("DELETE FROM foto_personas WHERE foto_id IN (SELECT id FROM fotos WHERE usuario_id = ?)", [req.usuario?.id]);
            
            await db.run("COMMIT");
        } catch (e) {
            await db.run("ROLLBACK");
            throw e;
        }
        res.json({ message: "Reset de tus datos completado" });
    } catch (err) {
        res.status(500).json({ error: "Fallo al vaciar la DB" });
    }
});

app.post('/api/sistema/rescan-gps', async (req, res) => {
    try {
        if (!req.esAutenticado) return res.status(401).json({ error: 'No autorizado' });
        
        // Obtenemos todas las fotos del usuario que NO tienen latitud
        const fotos = await db.all("SELECT id, imagen_url FROM fotos WHERE usuario_id = ? AND (latitud IS NULL OR latitud = 0)", [req.usuario.id]);
        
        let actualizadas = 0;
        
        // --- OPTIMIZACIÓN CRÍTICA: Usar una transacción para evitar 5.700 escrituras individuales ---
        await db.run("BEGIN TRANSACTION");
        try {
            for (const f of fotos) {
                let rutaAbsoluta = f.imagen_url;
                if (!path.isAbsolute(rutaAbsoluta)) {
                    rutaAbsoluta = path.join(dirDestino, rutaAbsoluta);
                }
                
                if (fs.existsSync(rutaAbsoluta)) {
                    const meta = extraerMetadata(rutaAbsoluta);
                    if (meta.lat && meta.lon) {
                        await db.run("UPDATE fotos SET latitud = ?, longitud = ? WHERE id = ?", [meta.lat, meta.lon, f.id]);
                        actualizadas++;
                    }
                }
            }
            await db.run("COMMIT");
        } catch (e) {
            await db.run("ROLLBACK");
            throw e;
        }

        res.json({ message: `Re-escaneo completado. Se han geolocalizado ${actualizadas} fotos nuevas en el mapa satelital.`, actualizadas });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Error en el re-escaneo masivo." });
    }
});

// NUEVO: Endpoint VIP para obtener una sola foto (acelera el salto desde el mapa)
app.get('/api/fotos/:id', async (req, res) => {
    try {
        if (!req.esAutenticado) return res.status(401).json({ error: 'No autorizado' });
        const foto = await db.get("SELECT * FROM fotos WHERE id = ? AND usuario_id = ?", [req.params.id, req.usuario.id]);
        if (!foto) return res.status(404).json({ error: "Foto no encontrada" });
        res.json({ ...foto, etiquetas: foto.etiquetas || "" });
    } catch (err) {
        res.status(500).json({ error: "Fallo al obtener la foto" });
    }
});

// 1. GALERÍA PRINCIPAL
app.get('/api/imagenes', async (req, res) => {
    try {
        const excludes = "AND id NOT IN (SELECT af.foto_id FROM album_fotos af JOIN albumes a ON af.album_id = a.id WHERE a.privado = 1)";
        const query = !req.esAutenticado
            ? `SELECT * FROM fotos WHERE en_papelera = 0 AND es_duplicado = 0 AND usuario_id IS NULL ${excludes} ORDER BY anio DESC, id DESC LIMIT ?`
            : `SELECT * FROM fotos WHERE en_papelera = 0 AND es_duplicado = 0 AND usuario_id = ? ${excludes} ORDER BY anio DESC, id DESC`;
        const fotosRaw = !req.esAutenticado
            ? await db.all(query, [LIMITE_DEMO])
            : await db.all(query, [req.usuario?.id]);
        const fotos = await limpiarFotosRotas(fotosRaw, req);
        res.json(fotos.map(f => ({ ...f, etiquetas: f.etiquetas || "" })));
    } catch (err) { res.status(500).json(err); }
});

// 2. MAPA
app.get('/api/fotos-mapa', async (req, res) => {
    try {
        const excludes = "AND id NOT IN (SELECT af.foto_id FROM album_fotos af JOIN albumes a ON af.album_id = a.id WHERE a.privado = 1)";
        const query = !req.esAutenticado
            ? `SELECT * FROM fotos WHERE latitud IS NOT NULL AND en_papelera = 0 AND es_duplicado = 0 AND usuario_id IS NULL ${excludes} LIMIT ?`
            : `SELECT * FROM fotos WHERE latitud IS NOT NULL AND en_papelera = 0 AND es_duplicado = 0 AND usuario_id = ? ${excludes}`;
        const fotosRaw = !req.esAutenticado
            ? await db.all(query, [LIMITE_DEMO])
            : await db.all(query, [req.usuario?.id]);
        const fotos = await limpiarFotosRotas(fotosRaw, req);
        res.json(fotos);
    } catch (err) { res.status(500).json(err); }
});

// 3. OBTENER AÑOS
app.get('/api/anios', async (req, res) => {
    try {
        const excludes = "AND id NOT IN (SELECT af.foto_id FROM album_fotos af JOIN albumes a ON af.album_id = a.id WHERE a.privado = 1)";
        const anios = await db.all(!req.esAutenticado ? `SELECT DISTINCT anio FROM fotos WHERE en_papelera = 0 AND es_duplicado = 0 AND usuario_id IS NULL ${excludes} ORDER BY anio DESC` : `SELECT DISTINCT anio FROM fotos WHERE en_papelera = 0 AND es_duplicado = 0 AND usuario_id = ? ${excludes}` , !req.esAutenticado ? [] : [req.usuario?.id]);
        res.json(anios);
    } catch (err) { res.status(500).json(err); }
});

// ACTUALIZAR CAMPOS BÁSICOS DE UNA FOTO
app.patch('/api/fotos/:id', async (req, res) => {
    try {
        const { titulo, descripcion, anio, mes, etiquetas, lugar } = req.body;
        await db.run(
            "UPDATE fotos SET titulo = COALESCE(?, titulo), descripcion = COALESCE(?, descripcion), anio = COALESCE(?, anio), mes = COALESCE(?, mes), etiquetas = COALESCE(?, etiquetas), lugar = COALESCE(?, lugar) WHERE id = ? AND usuario_id = ?",
            [titulo, descripcion, anio, mes, etiquetas, lugar, req.params.id, req.usuario?.id]
        );
        res.json({ ok: true });
    } catch (err) { res.status(500).json(err); }
});

// ÁLBUMES DE UNA FOTO
app.get('/api/fotos/:id/albumes', async (req, res) => {
    try {
        const albumes = await db.all(
            "SELECT a.* FROM albumes a JOIN album_fotos af ON a.id = af.album_id WHERE af.foto_id = ? AND a.usuario_id = ?",
            [req.params.id]
        );
        res.json(albumes);
    } catch (err) { res.status(500).json(err); }
});

// EVENTOS DE UNA FOTO
app.get('/api/fotos/:id/eventos', async (req, res) => {
    try {
        const eventos = await db.all(
            "SELECT e.* FROM eventos e JOIN evento_fotos ef ON e.id = ef.evento_id WHERE ef.foto_id = ? AND e.usuario_id = ?", [req.params.id, req.usuario?.id]
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
        const excludes = "AND id NOT IN (SELECT af.foto_id FROM album_fotos af JOIN albumes a ON af.album_id = a.id WHERE a.privado = 1)";
        const query = !req.esAutenticado
            ? `SELECT * FROM fotos WHERE anio = ? AND en_papelera = 0 AND es_duplicado = 0 ${excludes} LIMIT ?`
            : `SELECT * FROM fotos WHERE anio = ? AND en_papelera = 0 AND es_duplicado = 0 AND usuario_id = ? ${excludes}`;
        const fotos = !req.esAutenticado
            ? await db.all(query, [req.params.anio, LIMITE_DEMO])
            : await db.all(query, [req.params.anio, req.usuario?.id]);
        res.json(fotos);
    } catch (err) { res.status(500).json(err); }
});

// 5. MOVER A PAPELERA
app.delete('/api/imagenes/:id', async (req, res) => {
    try {
        await db.run("UPDATE fotos SET en_papelera = 1 WHERE id = ? AND usuario_id = ?", [req.params.id, req.usuario?.id]);
        res.json({ message: "Movido a papelera" });
    } catch (err) { res.status(500).json(err); }
});

// 6. VER PAPELERA
app.get('/api/papelera', async (req, res) => {
    try {
        const fotos = await db.all("SELECT * FROM fotos WHERE en_papelera = 1 AND usuario_id = ? ORDER BY id DESC", [req.usuario?.id]);
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
            await db.run("UPDATE fotos SET en_papelera = 0 WHERE id = ? AND usuario_id = ?", [id, req.usuario?.id]);
        } else {
            await db.run("DELETE FROM fotos WHERE id = ? AND usuario_id = ?", [id, req.usuario?.id]);
        }
    res.json({ message: "Operación realizada" });
    } catch (err) { res.status(500).json(err); }
});

// FAVORITO — toggle
app.patch('/api/fotos/:id/favorito', async (req, res) => {
    try {
        const foto = await db.get("SELECT favorito FROM fotos WHERE id = ? AND usuario_id = ?", [req.params.id, req.usuario?.id]);
        if (!foto) return res.status(404).json({ error: "No encontrada" });
        const nuevo = foto.favorito ? 0 : 1;
        await db.run("UPDATE fotos SET favorito = ? WHERE id = ? AND usuario_id = ?", [nuevo, req.params.id, req.usuario?.id]);
        res.json({ favorito: nuevo });
    } catch (err) { res.status(500).json(err); }
});

// FAVORITOS — listar
app.get('/api/favoritos', async (req, res) => {
    try {
        const fotos = await db.all("SELECT * FROM fotos WHERE favorito = 1 AND en_papelera = 0 AND usuario_id = ? ORDER BY id DESC", [req.usuario?.id]);
        res.json(fotos.map(f => ({ ...f, etiquetas: f.etiquetas || "" })));
    } catch (err) { res.status(500).json(err); }
});

// LUGAR — actualizar
app.patch('/api/fotos/:id/lugar', async (req, res) => {
    try {
        const { lugar } = req.body;
        await db.run("UPDATE fotos SET lugar = ? WHERE id = ? AND usuario_id = ?", [lugar, req.params.id, req.usuario?.id]);
        res.json({ ok: true });
    } catch (err) { res.status(500).json(err); }
});

// LUGARES — listar únicos con conteo
app.get('/api/lugares', async (req, res) => {
    try {
        const lugares = await db.all(
            "SELECT lugar, COUNT(*) as total FROM fotos WHERE lugar IS NOT NULL AND lugar != '' AND en_papelera = 0 AND usuario_id = ? GROUP BY lugar ORDER BY total DESC",
            [req.usuario?.id]
        );
        res.json(lugares);
    } catch (err) { res.status(500).json(err); }
});

// TAGS — listar únicos con frecuencia
app.get('/api/tags', async (req, res) => {
    try {
        const fotos = await db.all("SELECT etiquetas FROM fotos WHERE etiquetas IS NOT NULL AND etiquetas != '' AND en_papelera = 0 AND usuario_id = ?", [req.usuario?.id]);
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
        const albumes = await db.all("SELECT a.*, COUNT(af.foto_id) as total FROM albumes a LEFT JOIN album_fotos af ON a.id = af.album_id WHERE a.usuario_id = ? GROUP BY a.id ORDER BY a.creado_en DESC", [req.usuario?.id]);
        res.json(albumes);
    } catch (err) { res.status(500).json(err); }
});

app.post('/api/albumes', async (req, res) => {
    try {
        const { nombre, descripcion, privado } = req.body;
        if (!nombre) return res.status(400).json({ error: "Nombre requerido" });
        
        // --- EVITAR DUPLICADOS ---
        const existente = await db.get(
            "SELECT id FROM albumes WHERE LOWER(nombre) = LOWER(?) AND usuario_id = ?", 
            [nombre.trim(), req.usuario?.id]
        );
        
        if (existente) {
            return res.json({ id: existente.id, nombre, descripcion, privado, ya_existia: true });
        }

        const valPrivado = privado ? 1 : 0;
        const result = await db.run("INSERT INTO albumes (nombre, descripcion, usuario_id, privado) VALUES (?, ?, ?, ?)", [nombre, descripcion || "", req.usuario?.id, valPrivado]);
        res.json({ id: result.lastID, nombre, descripcion, privado: valPrivado });
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
            "SELECT f.* FROM fotos f JOIN album_fotos af ON f.id = af.foto_id WHERE af.album_id = ? AND f.en_papelera = 0 AND f.usuario_id = ?", [req.params.id, req.usuario?.id]
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

app.post('/api/albumes/:id/fotos-masivo', async (req, res) => {
    try {
        const { fotos_ids } = req.body;
        if (!Array.isArray(fotos_ids)) return res.status(400).json({ error: 'fotos_ids debe ser un array' });
        
        await db.run("BEGIN");
        try {
            for (const foto_id of fotos_ids) {
                await db.run("INSERT OR IGNORE INTO album_fotos (album_id, foto_id) VALUES (?, ?)", [req.params.id, foto_id]);
            }
            await db.run("COMMIT");
        } catch (e) {
            await db.run("ROLLBACK");
            throw e;
        }
        res.json({ ok: true });
    } catch (err) { res.status(500).json(err); }
});

app.delete('/api/albumes/:id/fotos/:fotoId', async (req, res) => {
    try {
        await db.run("DELETE FROM album_fotos WHERE album_id = ? AND foto_id = ?", [req.params.id, req.params.fotoId]);
        res.json({ ok: true });
    } catch (err) { res.status(500).json(err); }
});

app.get('/api/eventos', async (req, res) => {
    try {
        const eventos = await db.all("SELECT e.*, COUNT(ef.foto_id) as total FROM eventos e LEFT JOIN evento_fotos ef ON e.id = ef.evento_id WHERE e.usuario_id = ? GROUP BY e.id ORDER BY e.fecha_inicio DESC", [req.usuario?.id]);
        res.json(eventos);
    } catch (err) { res.status(500).json(err); }
});

app.post('/api/eventos', async (req, res) => {
    try {
        const { nombre, fecha_inicio, fecha_fin, descripcion } = req.body;
        if (!nombre) return res.status(400).json({ error: "Nombre requerido" });

        // --- EVITAR DUPLICADOS ---
        const existente = await db.get(
            "SELECT id FROM eventos WHERE LOWER(nombre) = LOWER(?) AND usuario_id = ?", 
            [nombre.trim(), req.usuario?.id]
        );

        if (existente) {
            return res.json({ id: existente.id, nombre, fecha_inicio, fecha_fin, descripcion, ya_existia: true });
        }

        const result = await db.run("INSERT INTO eventos (nombre, fecha_inicio, fecha_fin, descripcion, usuario_id) VALUES (?, ?, ?, ?, ?)", [nombre, fecha_inicio || "", fecha_fin || "", descripcion || "", req.usuario?.id]);
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
            "SELECT f.* FROM fotos f JOIN evento_fotos ef ON f.id = ef.foto_id WHERE ef.evento_id = ? AND f.en_papelera = 0 AND f.usuario_id = ?", [req.params.id, req.usuario?.id]
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

app.post('/api/eventos/:id/fotos-masivo', async (req, res) => {
    try {
        const { fotos_ids } = req.body;
        if (!Array.isArray(fotos_ids)) return res.status(400).json({ error: 'fotos_ids debe ser un array' });
        
        await db.run("BEGIN");
        try {
            for (const foto_id of fotos_ids) {
                await db.run("INSERT OR IGNORE INTO evento_fotos (evento_id, foto_id) VALUES (?, ?)", [req.params.id, foto_id]);
            }
            await db.run("COMMIT");
        } catch (e) {
            await db.run("ROLLBACK");
            throw e;
        }
        res.json({ ok: true });
    } catch (err) { res.status(500).json(err); }
});

app.post('/api/eventos/:id/auto-scan', async (req, res) => {
    try {
        const evento = await db.get("SELECT * FROM eventos WHERE id = ? AND usuario_id = ?", [req.params.id, req.usuario?.id]);
        if (!evento || !evento.fecha_inicio) return res.status(400).json({ error: "Evento no encontrado o sin fecha de inicio" });
        
        // Asumiendo formato de fecha YYYY-MM-DD
        const [anioInicio, mesInicio, diaInicio] = evento.fecha_inicio.split('-');
        let [anioFin, mesFin, diaFin] = (evento.fecha_fin || evento.fecha_inicio).split('-');
        
        if (!anioInicio || !mesInicio) return res.status(400).json({ error: "Formato de fecha de evento inválido" });

        // Escanear DB: Esto depende de si tienen guardado anio y mes. Si no, habría que extraerlo de algo más elaborado o usar los campos que tenemos.
        // Archipeg extrae "anio" y "mes" al subir/importar. Usaremos esos para coincidencia aproximada, o un escaneo preciso si implementamos fechas completas en fotos.
        // Por ahora, como 'fotos' tiene 'anio' y 'mes', compararemos con esos:
        let query = "SELECT id FROM fotos WHERE en_papelera = 0 AND usuario_id = ? AND anio >= ? AND anio <= ?";
        let bindParams = [req.usuario?.id, parseInt(anioInicio), parseInt(anioFin)];
        
        // Si el inicio y fin ocurren en el mismo año, podemos afinar los meses
        if (anioInicio === anioFin) {
            query += " AND mes >= ? AND mes <= ?";
            bindParams.push(parseInt(mesInicio), parseInt(mesFin));
        }

        const fotosMatcheadas = await db.all(query, bindParams);

        if (fotosMatcheadas.length === 0) return res.json({ asignadas: 0, mensaje: "No hay fotos en ese rango" });

        await db.run("BEGIN");
        try {
            for (const f of fotosMatcheadas) {
                await db.run("INSERT OR IGNORE INTO evento_fotos (evento_id, foto_id) VALUES (?, ?)", [req.params.id, f.id]);
            }
            await db.run("COMMIT");
        } catch (e) {
            await db.run("ROLLBACK");
            throw e;
        }
        res.json({ asignadas: fotosMatcheadas.length });
    } catch (err) { res.status(500).json(err); }
});

// PERSONAS — CRUD
app.get('/api/personas', async (req, res) => {
    try {
        const personas = await db.all("SELECT p.*, COUNT(fp.foto_id) as total FROM personas p LEFT JOIN foto_personas fp ON p.id = fp.persona_id WHERE p.usuario_id = ? GROUP BY p.id ORDER BY p.nombre", [req.usuario?.id]);
        res.json(personas);
    } catch (err) { res.status(500).json(err); }
});

app.post('/api/personas', async (req, res) => {
    try {
        const { nombre } = req.body;
        if (!nombre) return res.status(400).json({ error: "Nombre requerido" });
        const result = await db.run("INSERT INTO personas (nombre, usuario_id) VALUES (?, ?)", [nombre, req.usuario?.id]);
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
            "SELECT f.* FROM fotos f JOIN foto_personas fp ON f.id = fp.persona_id WHERE fp.persona_id = ? AND f.en_papelera = 0 AND f.usuario_id = ?", [req.params.id, req.usuario?.id]
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
            "SELECT p.* FROM personas p JOIN foto_personas fp ON p.id = fp.persona_id WHERE fp.foto_id = ? AND p.usuario_id = ?", [req.params.id, req.usuario?.id]
        );
        res.json(personas);
    } catch (err) { res.status(500).json(err); }
});

// --- GESTIÓN DE USUARIOS (ADMIN ONLY) con Paginación Real ---
app.get('/api/usuarios', async (req, res) => {
    try {
        if (!req.esAdmin) return res.status(403).json({ error: 'Acceso denegado' });
        
        // Parámetros de paginación
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;

        // 1. Obtener el total para calcular páginas en el frontend
        const { count } = await db.get("SELECT COUNT(*) as count FROM usuarios");
        
        // 2. Obtener solo los de esta página
        const usuarios = await db.all(
            "SELECT id, email, es_admin, aprobado, creado_en FROM usuarios ORDER BY id ASC LIMIT ? OFFSET ?",
            [limit, offset]
        );

        res.json({
            usuarios,
            total: count,
            pagina: page,
            paginas: Math.ceil(count / limit)
        });
    } catch (err) { 
        console.error("Error en paginación de usuarios:", err);
        res.status(500).json(err); 
    }
});

app.patch('/api/usuarios/:id/aprobar', async (req, res) => {
    try {
        if (!req.esAdmin) return res.status(403).json({ error: 'Acceso denegado' });
        const user = await db.get("SELECT aprobado FROM usuarios WHERE id = ?", [req.params.id]);
        if (!user) return res.status(404).json({ error: "Usuario no encontrado" });
        
        const nuevoEstado = user.aprobado === 1 ? 0 : 1;
        await db.run("UPDATE usuarios SET aprobado = ? WHERE id = ?", [nuevoEstado, req.params.id]);
        res.json({ aprobado: nuevoEstado });
    } catch (err) { res.status(500).json(err); }
});

app.patch('/api/usuarios/:id/admin', async (req, res) => {
    try {
        if (!req.esAdmin) return res.status(403).json({ error: 'Acceso denegado' });
        const user = await db.get("SELECT es_admin FROM usuarios WHERE id = ?", [req.params.id]);
        if (!user) return res.status(404).json({ error: "Usuario no encontrado" });
        
        const nuevoRol = user.es_admin === 1 ? 0 : 1;
        await db.run("UPDATE usuarios SET es_admin = ? WHERE id = ?", [nuevoRol, req.params.id]);
        res.json({ es_admin: nuevoRol });
    } catch (err) { res.status(500).json(err); }
});

app.delete('/api/usuarios/:id', async (req, res) => {
    try {
        if (!req.esAdmin) return res.status(403).json({ error: 'Acceso denegado' });
        if (req.params.id === "1") return res.status(403).json({ error: "No se puede eliminar el administrador original" });
        
        await db.run("DELETE FROM usuarios WHERE id = ?", [req.params.id]);
        res.json({ ok: true });
    } catch (err) { res.status(500).json(err); }
});

// IMPORTACIÓN MASIVA DESDE DISCO
app.post('/api/importar-masivo', async (req, res) => {
    try {
        if (!db) return res.status(503).json({ error: 'Servidor iniciándose, reintenta en un momento' });
        const { ruta } = req.body;
        if (!ruta) return res.status(400).json({ error: 'La ruta llegó vacía a la base de datos' });

        let stat;
        try { stat = fs.statSync(ruta); } catch (e) {
            console.error("FS stat error:", e);
            return res.status(400).json({ error: 'Ruta inválida en el disco duro o no existe: ' + String(ruta) });
        }
        if (!stat.isDirectory()) {
            return res.status(400).json({ error: 'La ruta seleccionada no es un directorio válido: ' + String(ruta) });
        }

        const imagenes = escanearRecursivo(ruta);

        let importadas = 0;
        let actualizadas = 0;
        let ignoradas = 0;

        let fotosActuales = 0;
        // LÍMITE DEMO: Tanto para invitados como para usuarios registrados pero NO aprobados
        const esBajoDemo = !req.esAutenticado || (req.usuario && !req.usuario.aprobado);
        
        if (esBajoDemo) {
            const userIdFilter = req.usuario ? req.usuario.id : null;
            const { count } = await db.get("SELECT COUNT(*) as count FROM fotos WHERE en_papelera = 0 AND usuario_id IS ?", [userIdFilter]);
            fotosActuales = count;
        }

        // --- OPTIMIZACIÓN CRÍTICA: Transacción para procesar miles de archivos en segundos ---
        await db.run("BEGIN TRANSACTION");
        try {
            for (const rutaImagen of imagenes) {
                // Buscamos si ya existe por ruta y usuario
                const existente = await db.get(
                    req.esAutenticado ? "SELECT id FROM fotos WHERE imagen_url = ? AND usuario_id = ?" : "SELECT id FROM fotos WHERE imagen_url = ? AND usuario_id IS NULL",
                    req.esAutenticado ? [rutaImagen, req.usuario.id] : [rutaImagen]
                );

                if (existente) {
                    actualizadas++;
                    continue;
                }

                if (esBajoDemo && fotosActuales >= LIMITE_DEMO) {
                    ignoradas++;
                    continue;
                }

                const meta = extraerMetadata(rutaImagen);
                const anioFinal = meta.anio;
                const mesFinal = meta.mes;

                await db.run(
                    "INSERT INTO fotos (imagen_url, en_papelera, usuario_id, anio, mes, latitud, longitud) VALUES (?, 0, ?, ?, ?, ?, ?)",
                    [rutaImagen, req.esAutenticado ? req.usuario.id : null, anioFinal, mesFinal, meta.lat, meta.lon]
                );

                importadas++;
                if (esBajoDemo) fotosActuales++;
            }
            await db.run("COMMIT");
        } catch (e) {
            await db.run("ROLLBACK");
            throw e;
        }

        res.json({ importadas, actualizadas, ignoradas, total: imagenes.length });
    } catch (err) {
        console.error('Error importar-masivo:', err);
        res.status(500).json({ error: 'Error interno al importar' });
    }
});

// SERVIR FOTOS REFERENCIADAS POR RUTA ABSOLUTA
app.get('/api/foto-local', (req, res) => {
    const ruta = req.query.ruta;
    if (!ruta) return res.status(400).json({ error: 'Parámetro ruta requerido' });

    const ext = path.extname(ruta).toLowerCase();
    if (!EXTENSIONES_IMAGEN.has(ext)) return res.status(400).json({ error: 'Tipo de archivo no permitido' });

    if (!fs.existsSync(ruta)) return res.status(404).json({ error: 'Archivo no encontrado' });

    res.setHeader('Content-Type', MIME_TIPOS[ext] || 'application/octet-stream');
    const stream = fs.createReadStream(ruta);
    stream.on('error', () => res.status(500).end());
    stream.pipe(res);
});

// DIÁLOGO NATIVO DE SELECCIÓN DE CARPETA (funciona en todos los contextos)
app.get('/api/seleccionar-carpeta', (req, res) => {
    if (process.platform === 'darwin') {
        exec(`osascript -e 'POSIX path of (choose folder)'`, (err, stdout) => {
            if (err) return res.json({ ruta: null });
            res.json({ ruta: stdout.trim() });
        });
    } else if (process.platform === 'win32') {
        const os = require('os');
        const psFile = path.join(os.tmpdir(), 'archipeg_selector.ps1');
        const psCode = `
Add-Type -AssemblyName System.Windows.Forms
$form = New-Object System.Windows.Forms.Form
$form.TopMost = $true
$form.ShowInTaskbar = $false
$form.WindowState = 'Minimized'
$form.Show()
[void]$form.Focus()
$f = New-Object System.Windows.Forms.FolderBrowserDialog
$f.Description = 'Selecciona la carpeta para importar a ARCHIPEG'
if ($f.ShowDialog($form) -eq 'OK') { Write-Output $f.SelectedPath }
$form.Dispose()
        `.trim();
        
        fs.writeFileSync(psFile, psCode);
        
        exec(`powershell -ExecutionPolicy Bypass -File "${psFile}"`, (err, stdout) => {
            try { fs.unlinkSync(psFile); } catch(e){} // limpiar
            
            if (err) return res.json({ ruta: null });
            const ruta = stdout.trim();
            if (!ruta || ruta.includes("Error") || ruta.includes("Exception")) return res.json({ ruta: null });
            res.json({ ruta: ruta });
        });
    } else {
        res.status(501).json({ error: 'Plataforma no soportada' });
    }
});

// RUTA COMODÍN: Para que React Router funcione en producción
app.get('*', (req, res) => {
    const indexPath = path.join(__dirname, 'build', 'index.html');
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        res.status(404).send('Frontend no construido. Ejecuta npm run build.');
    }
});

// --- LANZAMIENTO ---
const PORT = process.env.PORT || 5001;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 ARCHIPEG PRO: Operando en puerto ${PORT}`);
    console.log(`📂 Almacén de fotos: ${dirDestino}`);
});
