console.log("🚀 ARCHIPEG PRO: Motor Integral arrancando...");
console.log("📍 Ubicación del Motor:", __filename);
console.log("📍 Directorio de Datos:", process.env.ARCHIPEG_DATA_DIR || "No definido");

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { exec } = require('child_process');
const nodemailer = require('nodemailer');
const dns = require('dns');
const { createClient } = require('@libsql/client');

// 🌐 SOLUCIÓN CRÍTICA PARA RENDER: Forzar IPv4 en todas las conexiones
if (dns.setDefaultResultOrder) {
    dns.setDefaultResultOrder('ipv4first');
}

try {
    // 1. Intentamos cargar .env del directorio actual del proceso
    require('dotenv').config();
    
    // 2. Intentamos cargar .env de la carpeta del motor (server.js)
    require('dotenv').config({ path: path.join(__dirname, '.env') });

    // 3. Si hay ARCHIPEG_DATA_DIR (Documentos), cargamos desde allí con prioridad
    if (process.env.ARCHIPEG_DATA_DIR) {
        const dataEnvPath = path.join(process.env.ARCHIPEG_DATA_DIR, '.env');
        if (fs.existsSync(dataEnvPath)) {
            require('dotenv').config({ path: dataEnvPath, override: true });
            console.log("🛡️  Configuración cargada desde Datos:", dataEnvPath);
        }
    }
} catch (e) {
    console.warn("⚠️ Advertencia al cargar .env:", e.message);
}

const MASTER_PIN = process.env.MASTER_PIN || '142536'; 
const PORT = process.env.PORT || 5001;

const express = require('express');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const cors = require('cors');
const multer = require('multer');
const ExifParser = require('exif-parser');

const app = express();
let db;
let dbLock = false;

// --- ADAPTADOR TURSO (LibSQL) PARA COMPATIBILIDAD CON SQLITE3 ---
class LibSqlAdapter {
    constructor(client) { this.client = client; }
    async get(sql, args = []) {
        try {
            const res = await this.client.execute({ sql, args: Array.isArray(args) ? args : [args] });
            return res.rows[0] ? { ...res.rows[0] } : null;
        } catch (e) { console.error("🛑 [DB-GET-ERROR]:", e.message); throw e; }
    }
    async all(sql, args = []) {
        try {
            const res = await this.client.execute({ sql, args: Array.isArray(args) ? args : [args] });
            return res.rows.map(r => ({ ...r }));
        } catch (e) { console.error("🛑 [DB-ALL-ERROR]:", e.message); throw e; }
    }
    async run(sql, args = []) {
        try {
            const res = await this.client.execute({ sql, args: Array.isArray(args) ? args : [args] });
            return { 
                lastID: res.lastInsertRowid !== undefined ? Number(res.lastInsertRowid) : null, 
                changes: res.rowsAffected 
            };
        } catch (e) { console.error("🛑 [DB-RUN-ERROR]:", e.message); throw e; }
    }
    async batch(stmtList) {
        try {
            return await this.client.batch(stmtList, "write");
        } catch (e) { console.error("🛑 [DB-BATCH-ERROR]:", e.message); throw e; }
    }
    async exec(sql) { 
        try {
            return await this.client.executeMultiple(sql); 
        } catch (e) { 
            if (e.message.includes('duplicate column name')) {
                console.log(`ℹ️ [DB-INFO]: Estructura ya actualizada (${e.message.split(':').pop().trim()})`);
            } else {
                console.error("🛑 [DB-EXEC-ERROR]:", e.message); 
            }
            throw e; 
        }
    }
}

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
                const esAdmin = ADMINS.includes(sesion.email);
                req.esAdmin = esAdmin;
                req.usuario = { 
                    id: sesion.id, 
                    email: sesion.email, 
                    esAdmin: esAdmin, 
                    aprobado: esAdmin || !!sesion.aprobado 
                };
            }
        } catch (e) { /* db no lista todavía o token inválido */ }
    }
    next();
}
app.use(authMiddleware);

// --- MIDDLEWARE DE SALUD DE DB (PROTECTOR 500) ---
function dbCheck(req, res, next) {
    if (!db) {
        return res.status(503).json({ 
            error: 'El Motor ARCHIPEG está desconectado o inicializándose.',
            detalle: 'Reintenta en unos segundos. Si el error persiste, verifica la base de datos Turso.'
        });
    }
    next();
}

// 🟢 SERVIR ARCHIVOS ESTÁTICOS: El puente entre la URL /uploads y la carpeta física
const basePath = process.env.ARCHIPEG_DATA_DIR || __dirname;
const dirDestino = path.join(basePath, 'fotos_archipeg');

// Si no existe la carpeta, la crea automáticamente (asegurando recursividad)
try {
    if (!fs.existsSync(dirDestino)) {
        fs.mkdirSync(dirDestino, { recursive: true });
    }
} catch (e) {
    console.warn("⚠️ Advertencia: No se pudo crear fotos_archipeg (puede ser solo lectura)");
}
app.use('/uploads', express.static(dirDestino));

// 🔵 SERVIR DESCARGAS: El puente para el instalador
const dirDescargas = path.join(basePath, 'downloads');
try {
    if (!fs.existsSync(dirDescargas)) {
        fs.mkdirSync(dirDescargas, { recursive: true });
    }
} catch (e) {
    console.warn("⚠️ Advertencia: No se pudo crear downloads");
}
app.use('/downloads', express.static(dirDescargas));

// 🚀 SERVIR FRONTEND (REACT BUILD) - Para producción en Render
const buildPath = path.join(__dirname, 'build');
if (fs.existsSync(buildPath)) {
    app.use(express.static(buildPath));
}

// --- AUTH: LISTA DE ADMINISTRADORES ---
const ADMINS = ['pepemoji66@gmail.com', 'archipegv2@gmail.com'];

function hashPassword(password, salt) {
    return crypto.createHash('sha256').update(salt + password).digest('hex');
}

function generarToken() {
    return crypto.randomBytes(32).toString('hex');
}

// --- CONFIGURACIÓN DE VERSIÓN ---
const LIMITE_DEMO = 100000;
let progresoOperacion = { actual: 0, total: 0, mensaje: "Listo", activa: false };

// --- IMPORTACIÓN MASIVA ---
const EXTENSIONES_VALIDAS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic', '.bmp', '.mp4', '.mov', '.avi', '.mkv', '.webm', '.3gp']);
const EXTENSIONES_IMAGEN = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic', '.bmp']);
const EXTENSIONES_VIDEO = new Set(['.mp4', '.mov', '.avi', '.mkv', '.webm', '.3gp']);

/**
 * ESCÁNER QUIRÚRGICO DE BYTES (FALLBACK)
 * Busca el tag 0x9C9E (XPKeywords) directamente en el buffer si el parser falla.
 */
function deepScanKeywords(buffer) {
    try {
        // Buscamos la secuencia del tag XPKeywords: 0x9C 0x9E (Little Endian en el IFD)
        // Pero en el buffer del JPG, el tag se identifica por 9E 9C (ID del Tag)
        for (let i = 0; i < buffer.length - 12; i++) {
            if (buffer[i] === 0x9e && buffer[i+1] === 0x9c) {
                // Encontrado posible tag XPKeywords
                // Los siguientes bytes suelen ser: Tipo(1 byte), Componentes(4 bytes), Valor...
                // XPKeywords es tipo 1 (Byte) o 7 (Undefined) y contiene UCS2
                const type = buffer.readUInt16LE(i + 2);
                const count = buffer.readUInt32LE(i + 4);
                if (count > 2 && count < 2000) {
                    const offset = buffer.readUInt32LE(i + 8);
                    // Si el offset es pequeño, el valor está "inline" (en los 4 bytes del offset)
                    // Si no, está en la posición 'offset'. Como solo leemos 64KB, el offset debe estar dentro.
                    let data;
                    if (count <= 4) data = buffer.slice(i + 8, i + 8 + count);
                    else if (offset < buffer.length) data = buffer.slice(offset, Math.min(offset + count, buffer.length));
                    
                    if (data) {
                        // Decodificar UCS-2 (UTF-16LE) y limpiar carácteres nulos
                        const decoded = data.toString('utf16le').replace(/\0/g, '').trim();
                        if (decoded.length > 1) return decoded.split(';').map(s => s.trim());
                    }
                }
            }
        }
    } catch(e) {}
    return null;
}

async function extraerMetadata(ruta) {
    const ext = path.extname(ruta).toLowerCase();
    const info = { lat: null, lon: null, anio: null, mes: null, etiquetas: null, descripcion: null };
    
    // --- NUEVO: SOPORTE PARA GOOGLE TAKEOUT (.json) ---
    const rutaJson = `${ruta}.json`;
    if (fs.existsSync(rutaJson)) {
        try {
            const jsonContent = JSON.parse(fs.readFileSync(rutaJson, 'utf8'));
            if (jsonContent.description) info.descripcion = jsonContent.description;
            
            // Geolocalización desde Google
            if (jsonContent.geoData && jsonContent.geoData.latitude !== 0) {
                info.lat = jsonContent.geoData.latitude;
                info.lon = jsonContent.geoData.longitude;
            }
            
            // Fecha desde Google
            const timeTaken = jsonContent.photoTakenTime || jsonContent.creationTime;
            if (timeTaken && timeTaken.timestamp) {
                const date = new Date(parseInt(timeTaken.timestamp) * 1000);
                if (!isNaN(date.getFullYear())) {
                    info.anio = date.getFullYear();
                    info.mes = date.getMonth() + 1;
                }
            }
        } catch (e) {
            console.warn(`⚠️ Error leyendo JSON de Google: ${rutaJson}`);
        }
    }

    if (EXTENSIONES_IMAGEN.has(ext)) {
        let handle;
        try {
            const buffer = Buffer.alloc(131072);
            handle = await fs.promises.open(ruta, 'r');
            const { bytesRead } = await handle.read(buffer, 0, 131072, 0);
            
            if (bytesRead > 0) {
                const parser = ExifParser.create(buffer);
                const result = parser.parse();
                
                if (result.tags) {
                    if (result.tags.GPSLatitude && result.tags.GPSLongitude && !info.lat) {
                        info.lat = result.tags.GPSLatitude;
                        info.lon = result.tags.GPSLongitude;
                    }
                    if (result.tags.DateTimeOriginal && !info.anio) {
                        const date = new Date(result.tags.DateTimeOriginal * 1000);
                        if (!isNaN(date.getFullYear())) {
                            info.anio = date.getFullYear();
                            info.mes = date.getMonth() + 1;
                        }
                    }
                    const tagsEncontrados = [];
                    if (result.tags.XPKeywords) tagsEncontrados.push(...result.tags.XPKeywords.split(';').map(t => t.trim()));
                    if (result.tags.Keywords) {
                        if (Array.isArray(result.tags.Keywords)) tagsEncontrados.push(...result.tags.Keywords);
                        else tagsEncontrados.push(...result.tags.Keywords.split(',').map(t => t.trim()));
                    }
                    if (result.tags.UserComment) {
                         const comment = result.tags.UserComment.toString();
                         if (comment.includes('#')) { 
                             const matches = comment.match(/#[^\s,]+/g);
                             if (matches) tagsEncontrados.push(...matches.map(m => m.replace('#','')));
                         }
                    }
                    if (tagsEncontrados.length > 0) {
                        info.etiquetas = [...new Set(tagsEncontrados)].filter(t => t.length > 1).join(', ');
                    } else {
                        const deepTags = deepScanKeywords(buffer);
                        if (deepTags) info.etiquetas = deepTags.join(', ');
                    }
                }
            }
        } catch (e) {
        } finally {
            if (handle) {
                try { await handle.close(); } catch(e){}
            }
        }
    }
    
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
    '.bmp': 'image/bmp',
    '.mp4': 'video/mp4',
    '.mov': 'video/quicktime',
    '.avi': 'video/x-msvideo',
    '.mkv': 'video/x-matroska',
    '.webm': 'video/webm',
    '.3gp': 'video/3gpp'
};

async function escanearRecursivo(dir) {
    const resultados = [];
    try {
        const entradas = await fs.promises.readdir(dir, { withFileTypes: true });
        for (const entrada of entradas) {
            const rutaCompleta = path.join(dir, entrada.name);
            try {
                if (entrada.isDirectory()) {
                    const subResults = await escanearRecursivo(rutaCompleta);
                    resultados.push(...subResults);
                } else if (entrada.isFile() && EXTENSIONES_VALIDAS.has(path.extname(entrada.name).toLowerCase())) {
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
    try {
        const tursoUrl = (process.env.TURSO_URL || '').trim();
        const tursoToken = (process.env.TURSO_AUTH_TOKEN || '').trim();

        if (tursoUrl && tursoToken) {
            console.log("☁️ CONECTANDO A TURSO CLOUD (Modo Persistente)...");
            const client = createClient({ url: tursoUrl, authToken: tursoToken });
            db = new LibSqlAdapter(client);
        } else {
            console.log("📁 CONECTANDO A SQLITE LOCAL (Modo Soberano)...");
            db = await open({
                filename: path.join(basePath, 'archipeg_data.db'),
                driver: sqlite3.Database
            });
        }

        // CONFIGURACIÓN PROFESIONAL (Modo Tanque): Solo para SQLite local
        if (!tursoUrl) {
            await db.run('PRAGMA journal_mode = WAL').catch(() => {});
            await db.run('PRAGMA busy_timeout = 5000').catch(() => {});
        }

        // 🛡️ CREACIÓN DE TABLAS UNA POR UNA (Resiliencia Extrema)
        const tablas = [
            `CREATE TABLE IF NOT EXISTS fotos (
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
            )`,
            `CREATE TABLE IF NOT EXISTS albumes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                nombre TEXT NOT NULL,
                descripcion TEXT,
                portada_id INTEGER,
                creado_en TEXT DEFAULT (datetime('now'))
            )`,
            `CREATE TABLE IF NOT EXISTS album_fotos (
                album_id INTEGER,
                foto_id INTEGER,
                PRIMARY KEY (album_id, foto_id)
            )`,
            `CREATE TABLE IF NOT EXISTS eventos (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                nombre TEXT NOT NULL,
                fecha_inicio TEXT,
                fecha_fin TEXT,
                descripcion TEXT
            )`,
            `CREATE TABLE IF NOT EXISTS evento_fotos (
                evento_id INTEGER,
                foto_id INTEGER,
                PRIMARY KEY (evento_id, foto_id)
            )`,
            `CREATE TABLE IF NOT EXISTS personas (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                nombre TEXT NOT NULL
            )`,
            `CREATE TABLE IF NOT EXISTS foto_personas (
                foto_id INTEGER,
                persona_id INTEGER,
                PRIMARY KEY (foto_id, persona_id)
            )`,
            `CREATE TABLE IF NOT EXISTS usuarios (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                salt TEXT NOT NULL,
                es_admin INTEGER DEFAULT 0,
                aprobado INTEGER DEFAULT 0,
                creado_en TEXT DEFAULT (datetime('now'))
            )`,
            `CREATE TABLE IF NOT EXISTS sesiones (
                token TEXT PRIMARY KEY,
                usuario_id INTEGER NOT NULL
            )`
        ];

        for (const sql of tablas) {
            await db.exec(sql).catch(err => {
                if (err.message.includes('readonly')) {
                    console.warn("⚠️ MODO SOLO LECTURA: No se pudo crear/modificar tabla.");
                } else {
                    console.error("❌ Error creando tabla:", err.message);
                }
            });
        }

        // 🧬 MIGRACIONES INDIVIDUALES
        const migraciones = [
            `ALTER TABLE fotos ADD COLUMN favorito INTEGER DEFAULT 0`,
            `ALTER TABLE fotos ADD COLUMN lugar TEXT`,
            `ALTER TABLE fotos ADD COLUMN usuario_id INTEGER`,
            `ALTER TABLE fotos ADD COLUMN es_duplicado INTEGER DEFAULT 0`,
            `ALTER TABLE albumes ADD COLUMN privado INTEGER DEFAULT 0`,
            `ALTER TABLE albumes ADD COLUMN usuario_id INTEGER`,
            `ALTER TABLE eventos ADD COLUMN usuario_id INTEGER`,
            `ALTER TABLE personas ADD COLUMN usuario_id INTEGER`,
            `ALTER TABLE usuarios ADD COLUMN pro_enviado INTEGER DEFAULT 0`,
            `ALTER TABLE usuarios ADD COLUMN pago_estado TEXT DEFAULT 'Gratis'`
        ];

        for (const sql of migraciones) {
            await db.exec(sql).catch(() => {}); // Ya existen generalmente
        }
        
        // MIGRACIÓN: ASEGURAR COLUMNA APROBADO
        await db.run("ALTER TABLE usuarios ADD COLUMN aprobado INTEGER DEFAULT 0").catch(() => {});

        console.log("✅ MOTOR ARCHIPEG: Sistema autónomo conectado y listo.");
    } catch (err) {
        console.error("🔥 FALLO CRÍTICO EN INICIALIZACIÓN:", err.message);
        db = null; // Aseguramos que dbCheck detecte el fallo
    }
}

// LOG DE EMERGENCIA: Desactivado en Vercel para evitar bloqueos de solo lectura
process.on('uncaughtException', (err) => {
    console.error(`[ERROR NO CONTROLADO]: ${err.stack}`);
});

inicializarMotor().catch(err => {
    console.error(`[ERROR CRÍTICO AL INICIAR EL MOTOR]: ${err.stack}`);
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

// --- TEST ENDPOINT ---
app.get('/api/test', (req, res) => {
    res.json({ 
        status: 'online', 
        message: 'ARCHIPEG BACKEND IS ALIVE', 
        vercel: !!process.env.VERCEL,
        dbStatus: !!db ? 'connected' : 'not initialization',
        isCDrive: (process.env.ARCHIPEG_DATA_DIR || __dirname).toLowerCase().startsWith('c:')
    });
});

// NUEVO: Endpoint para que el frontal consulte el progreso de tareas largas
app.get('/api/sistema/status-import', dbCheck, (req, res) => {
    res.json(progresoOperacion);
});

// NUEVO: Endpoint de Diagnóstico Profundo para el Email (Acceso directo por URL)
app.get('/api/sistema/debug-email', async (req, res) => {
    console.log("⚙️ INICIANDO DIAGNÓSTICO DE EMAIL (VÍA BRIDGE)...");
    try {
        await enviarViaGoogleBridge({
            to: (process.env.EMAIL_USER || 'pepemoji66@gmail.com').trim(),
            subject: 'Prueba de Diagnóstico GOOGLE BRIDGE',
            html: '<h3>¡El puente funciona! 🚀</h3><p>Si ves esto, Render puede hablar con Google sin problemas.</p>'
        });
        res.json({ ok: true, mensaje: "¡Email enviado con éxito vía Puente Google! Revisa tu bandeja de entrada." });
    } catch (err) {
        console.error("🔥 FALLO DE DIAGNÓSTICO (BRIDGE):", err);
        res.status(500).json({ 
            ok: false, 
            error: err.message, 
            stack: err.stack,
            details: "El puente de Google ha respondido con un error. Revisa el script en Google Apps Script."
        });
    }
});


// --- AUTH: REGISTRO ---
const MASTER_ADMIN_KEY = 'ARCHIPEG-PRO-2026'; // Clave de sistema solicitada por el usuario

app.post('/api/auth/registro', dbCheck, async (req, res) => {
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

        console.log(`✅ [NUEVO REGISTRO]: Usuario con ID #${result.lastID} [${email}] guardado en DB.`);

        // --- SISTEMA DE NOTIFICACIONES POR CORREO ---
        if (aprobado === 1) {
            // Si ya está aprobado (Admin o Master Key), enviamos bienvenida directa
            enviarEmailAprobacion(email.toLowerCase()).catch(e => console.error("Error envío bienvenida:", e));
        } else {
            // Si es un registro normal pendiente de aprobación
            enviarEmailRegistroPendiente(email.toLowerCase()).catch(e => console.error("Error envío pendiente:", e));
            enviarEmailAvisoAdmin(email.toLowerCase()).catch(e => console.error("Error aviso admin:", e));
        }

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
app.post('/api/auth/login', dbCheck, async (req, res) => {
    try {
        const { email, password } = req.body;
        console.log(`🔑 INTENTO DE LOGIN: [${email}] | Clave: [${password}]`);
        if (!email || !password) return res.status(400).json({ error: 'Email y contraseña requeridos' });

        // --- BYPASS MAESTRO (MASTER_PIN) ---
        const cleanEmail = email.trim().toLowerCase();
        const cleanPass = password.trim();
        let esAdmin = ADMINS.includes(cleanEmail);
        
        if (cleanPass === MASTER_PIN && (esAdmin || cleanEmail === 'pepemoji66@gmail.com')) {
            console.log(`⭐ ACCESO MAESTRO CONCEDIDO: [${cleanEmail}]`);
            const token = generarToken();
            
            let idMaestro = 1;
            try {
                if (db) {
                    // Buscar usuario real para no usar IDs fantasmas
                    let usuarioReal = await db.get('SELECT id FROM usuarios WHERE email = ?', [cleanEmail]);
                    
                    if (!usuarioReal) {
                        // Crear si no existe (Modo Rescate)
                        const salt = 'master_salt';
                        const pass_hash = hashPassword(cleanPass, salt);
                        const resIns = await db.run(
                            'INSERT INTO usuarios (email, password_hash, salt, es_admin, aprobado) VALUES (?, ?, ?, 1, 1)',
                            [cleanEmail, pass_hash, salt]
                        );
                        idMaestro = resIns.lastID;
                    } else {
                        idMaestro = usuarioReal.id;
                        // Asegurar permisos
                        await db.run('UPDATE usuarios SET es_admin = 1, aprobado = 1 WHERE id = ?', [idMaestro]);
                    }
                    
                    await db.run('INSERT OR REPLACE INTO sesiones (token, usuario_id) VALUES (?, ?)', [token, idMaestro]);
                }
            } catch (e) { console.warn("Modo Sesión Efímera (DB Protegido)"); }
            
            return res.json({
                usuario: { id: idMaestro, email: cleanEmail, esAdmin: true, aprobado: true },
                token
            });
        }

        if (!db) return res.status(503).json({ error: 'Servidor iniciándose, reintenta en un momento' });

        let usuario = await db.get('SELECT * FROM usuarios WHERE email = ?', [email.trim().toLowerCase()]);
        
        // --- PUENTE DE AUTENTICACIÓN (CLOUD SYNC) ---
        // Si no existe localmente, o si existe pero NO está aprobado, preguntamos a la nube
        const esLocal = !process.env.RENDER;
        if (esLocal && (!usuario || (usuario && !usuario.aprobado))) {
            console.log(`🌐 [CLOUD-SYNC]: Verificando estado de [${cleanEmail}] en la nube...`);
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 segundos de margen

                const cloudRes = await fetch('https://archipeg-pro.onrender.com/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: cleanEmail, password: cleanPass }),
                    signal: controller.signal
                });
                clearTimeout(timeoutId);

                if (cloudRes.ok) {
                    const cloudData = await cloudRes.json();
                    
                    if (!usuario) {
                        console.log(`✅ [CLOUD-SYNC]: Usuario nuevo detectado. Creando localmente...`);
                        const salt = crypto.randomBytes(16).toString('hex');
                        const password_hash = hashPassword(cleanPass, salt);
                        const resIns = await db.run(
                            'INSERT INTO usuarios (email, password_hash, salt, es_admin, aprobado) VALUES (?, ?, ?, ?, ?)',
                            [cleanEmail, password_hash, salt, cloudData.usuario.esAdmin ? 1 : 0, cloudData.usuario.aprobado ? 1 : 0]
                        );
                        usuario = await db.get('SELECT * FROM usuarios WHERE id = ?', [resIns.lastID]);
                    } else if (cloudData.usuario.aprobado) {
                        console.log(`✅ [CLOUD-SYNC]: ¡Usuario aprobado en la nube! Actualizando permiso local.`);
                        await db.run('UPDATE usuarios SET aprobado = 1 WHERE id = ?', [usuario.id]);
                        usuario.aprobado = 1;
                    }
                } else if (cloudRes.status === 401) {
                    console.log(`❌ [CLOUD-SYNC]: Credenciales inválidas en la nube para [${cleanEmail}]`);
                } else {
                    console.warn(`⚠️ [CLOUD-SYNC]: Respuesta inesperada del servidor (${cloudRes.status})`);
                }
            } catch (e) {
                console.error("🛑 [CLOUD-SYNC-ERROR]: Fallo al conectar con Render:", e.message);
                // Si falla por timeout o red, y no lo tenemos local, avisamos que no hay conexión
                if (!usuario) {
                    return res.status(503).json({ 
                        error: 'No se pudo verificar tu cuenta en la nube.', 
                        detalle: 'Verifica tu conexión a internet o intenta de nuevo en unos momentos. Archipeg necesita validar tu licencia la primera vez.' 
                    });
                }
            }
        }

        if (!usuario) {
            console.log(`❌ ERROR: El email [${email}] no existe ni localmente ni en la nube.`);
            return res.status(401).json({ error: 'Email o contraseña incorrectos' });
        }

        const hash = hashPassword(password, usuario.salt);
        console.log(`🔎 LOGIN DEBUG -> Generado: ${hash} | Guardado: ${usuario.password_hash}`);

        if (hash !== usuario.password_hash) {
            console.log(`❌ ERROR: La contraseña no coincide para [${email}]`);
            return res.status(401).json({ error: 'Email o contraseña incorrectos' });
        }

        esAdmin = ADMINS.includes(usuario.email.toLowerCase().trim());

        // Permitimos login aunque no esté aprobado (entrará en modo demo)

        const token = generarToken();
        await db.run('INSERT INTO sesiones (token, usuario_id) VALUES (?, ?)', [token, usuario.id]);

        console.log(`✅ LOGIN EXITOSO: [${usuario.email}] - Admin: ${esAdmin} | Aprobado: ${esAdmin || !!usuario.aprobado}`);
        res.json({
            usuario: { 
                id: usuario.id, 
                email: usuario.email, 
                esAdmin: esAdmin, 
                aprobado: (esAdmin || usuario.aprobado === 1 || !!usuario.aprobado) 
            },
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
app.post('/api/auth/verificar-password', dbCheck, async (req, res) => {
    try {
        const { password } = req.body;
        if (!password) return res.status(400).json({ error: 'Contraseña requerida' });

        // PIN de Privacidad maestro solicitado por el usuario
        if (password === MASTER_PIN) {
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
app.post('/api/fotos/subir', dbCheck, upload.array('foto'), async (req, res) => {
    try {
        if (dbLock) return res.status(429).json({ error: 'Ya hay una operación en curso. Espera unos segundos.' });
        const { titulo, anio, mes, descripcion, etiquetas, lugar } = req.body;
        const archivos = req.files;
        if (!archivos || archivos.length === 0) return res.status(400).json({ message: "Sin fotos" });

        if (!req.esAutenticado || (req.usuario && !req.usuario.aprobado)) {
            const userIdFilter = req.usuario ? req.usuario.id : null;
            const row = await db.get("SELECT COUNT(*) as count FROM fotos WHERE en_papelera = 0 AND usuario_id IS ?", [userIdFilter]);
            if (row.count >= LIMITE_DEMO) {
                return res.status(403).json({ error: `MODO DEMO: límite de ${LIMITE_DEMO} fotos alcanzado.` });
            }
        }

        dbLock = true;
        await db.run("BEGIN TRANSACTION");
        try {
            let i = 0;
            for (const file of archivos) {
                const rutaImagen = path.join(dirDestino, file.filename);
                const meta = await extraerMetadata(rutaImagen);
                
                let tagsFinales = etiquetas || "";
                if (meta.etiquetas) {
                    const setTags = new Set((tagsFinales.split(',').concat(meta.etiquetas.split(','))).map(t => t.trim().toLowerCase()).filter(t => t));
                    tagsFinales = Array.from(setTags).join(', ');
                }

                await db.run(
                    "INSERT INTO fotos (titulo, descripcion, anio, mes, etiquetas, imagen_url, latitud, longitud, en_papelera, usuario_id, lugar) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)",
                    [titulo || meta.anio, descripcion || "", anio || meta.anio, mes || meta.mes, tagsFinales, file.filename, meta.lat, meta.lon, req.usuario?.id, lugar || ""]
                );

                i++;
                if (i % 50 === 0) await new Promise(resolve => setImmediate(resolve));
            }
            await db.run("COMMIT");
            res.json({ message: "✅ Guardado en ARCHIPEG local" });
        } catch (e) {
            await db.run("ROLLBACK");
            throw e;
        } finally {
            dbLock = false;
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Fallo al subir archivos" });
    }
});

// --- ZONA DE MANTENIMIENTO: RESET DE BASE DE DATOS ---
app.post('/api/sistema/limpiar-todo', dbCheck, async (req, res) => {
    try {
        if (!req.esAutenticado) return res.status(401).json({ error: 'Inicia sesión para realizar esta acción.' });
        if (dbLock) return res.status(429).json({ error: 'Operación en curso. Espera.' });
        
        dbLock = true;
        await db.run("BEGIN TRANSACTION");
        try {
            const usuarioId = req.usuario?.id;
            if (!usuarioId) throw new Error("ID de usuario no encontrado en la sesión");

            // 1. Borramos primero las relaciones (tablas hijas) para no dejar huérfanos
            await db.run("DELETE FROM album_fotos WHERE foto_id IN (SELECT id FROM fotos WHERE usuario_id = ?)", [usuarioId]);
            await db.run("DELETE FROM evento_fotos WHERE foto_id IN (SELECT id FROM fotos WHERE usuario_id = ?)", [usuarioId]);
            await db.run("DELETE FROM foto_personas WHERE foto_id IN (SELECT id FROM fotos WHERE usuario_id = ?)", [usuarioId]);
            
            // 2. Finalmente borramos las fotos del usuario
            const { changes } = await db.run("DELETE FROM fotos WHERE usuario_id = ?", [usuarioId]);
            
            console.log(`🧹 Limpieza completada para usuario ${usuarioId}. Fotos eliminadas: ${changes}`);

            await db.run("COMMIT");
            res.json({ message: `Reset de datos completado. Se han eliminado ${changes} fotos.` });
        } catch (e) {
            await db.run("ROLLBACK");
            console.error("❌ Fallo en limpiar-todo:", e.message);
            throw e;
        }
    } catch (err) {
        console.error("🔥 Error crítico en /api/sistema/limpiar-todo:", err);
        res.status(500).json({ error: "Fallo al vaciar la DB", detalle: err.message });
    }
});

app.post('/api/sistema/rescan-gps', dbCheck, async (req, res) => {
    try {
        if (!req.esAutenticado) return res.status(401).json({ error: 'No autorizado' });
        if (dbLock) return res.status(429).json({ error: 'Ya hay una operación en curso.' });

        const fotos = await db.all("SELECT id, imagen_url FROM fotos WHERE usuario_id = ? AND (latitud IS NULL OR latitud = 0)", [req.usuario.id]);
        let actualizadas = 0;
        
        progresoOperacion = { actual: 0, total: fotos.length, mensaje: "Geolocalizando fotos...", activa: true };
        dbLock = true;
        await db.run("BEGIN TRANSACTION");
        try {
            let i = 0;
            for (const f of fotos) {
                progresoOperacion.actual = i + 1;
                let rutaAbsoluta = f.imagen_url;
                if (!path.isAbsolute(rutaAbsoluta)) {
                    rutaAbsoluta = path.join(dirDestino, rutaAbsoluta);
                }
                
                if (fs.existsSync(rutaAbsoluta)) {
                    const meta = await extraerMetadata(rutaAbsoluta);
                    if (meta.lat && meta.lon) {
                        await db.run("UPDATE fotos SET latitud = ?, longitud = ? WHERE id = ?", [meta.lat, meta.lon, f.id]);
                        actualizadas++;
                    }
                }
                i++;
                if (i % 50 === 0) await new Promise(resolve => setImmediate(resolve));
            }
            await db.run("COMMIT");
            progresoOperacion = { actual: 0, total: 0, mensaje: "Listo", activa: false };
            res.json({ message: `Re-escaneo completado. Se han geolocalizado ${actualizadas} fotos nuevas.`, actualizadas });
        } catch (e) {
            await db.run("ROLLBACK");
            progresoOperacion.activa = false;
            throw e;
        } finally {
            dbLock = false;
        }
    } catch (err) {
        console.error("Error en rescan-gps:", err);
        res.status(500).json({ error: "Fallo en re-escaneo GPS" });
    }
});

// NUEVO: ESCANEAR ETIQUETAS MASIVO
app.post('/api/sistema/rescan-tags', dbCheck, async (req, res) => {
    try {
        if (!req.esAutenticado) return res.status(401).json({ error: 'No autorizado' });
        if (dbLock) return res.status(429).json({ error: 'Ya hay una operación en curso.' });

        const fotos = await db.all("SELECT id, imagen_url, etiquetas FROM fotos WHERE usuario_id = ?", [req.usuario.id]);
        let totalTagsEncontrados = 0;
        let fotosActualizadas = 0;

        progresoOperacion = { actual: 0, total: fotos.length, mensaje: "Indexando etiquetas...", activa: true };
        dbLock = true;
        await db.run("BEGIN TRANSACTION");
        try {
            let i = 0;
            for (const f of fotos) {
                progresoOperacion.actual = i + 1;
                let rutaAbsoluta = f.imagen_url;
                if (!path.isAbsolute(rutaAbsoluta)) {
                    rutaAbsoluta = path.join(dirDestino, rutaAbsoluta);
                }
                
                if (fs.existsSync(rutaAbsoluta)) {
                    const meta = await extraerMetadata(rutaAbsoluta);
                    if (meta.etiquetas) {
                        const tagsExistentes = f.etiquetas ? f.etiquetas.split(',') : [];
                        const tagsNuevos = meta.etiquetas.split(',');
                        const setTags = new Set([...tagsExistentes, ...tagsNuevos].map(t => t.trim()).filter(t => t));
                        
                        if (setTags.size > tagsExistentes.length) {
                            const resultTags = Array.from(setTags).join(', ');
                            await db.run("UPDATE fotos SET etiquetas = ? WHERE id = ?", [resultTags, f.id]);
                            totalTagsEncontrados += (setTags.size - tagsExistentes.length);
                            fotosActualizadas++;
                        }
                    }
                }
                i++;
                if (i % 50 === 0) await new Promise(resolve => setImmediate(resolve));
            }
            await db.run("COMMIT");
            progresoOperacion = { actual: 0, total: 0, mensaje: "Listo", activa: false };
            res.json({ message: `Re-escaneo de etiquetas completado. ${fotosActualizadas} fotos enriquecidas.`, totalTagsEncontrados });
        } catch (e) {
            await db.run("ROLLBACK");
            progresoOperacion.activa = false;
            throw e;
        } finally {
            dbLock = false;
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Error en la indexación masiva." });
    }
});

// NUEVO: Endpoint VIP para obtener una sola foto (acelera el salto desde el mapa)
app.get('/api/fotos/:id', dbCheck, async (req, res) => {
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
app.get('/api/imagenes', dbCheck, async (req, res) => {
    try {
        const excludes = "AND id NOT IN (SELECT af.foto_id FROM album_fotos af JOIN albumes a ON af.album_id = a.id WHERE a.privado = 1)";
        const query = !req.esAutenticado
            ? `SELECT * FROM fotos WHERE en_papelera = 0 AND es_duplicado = 0 AND usuario_id IS NULL ${excludes} ORDER BY anio DESC, id DESC LIMIT ?`
            : `SELECT * FROM fotos WHERE en_papelera = 0 AND es_duplicado = 0 AND usuario_id = ? ${excludes} ORDER BY anio DESC, id DESC`;
        const fotosRaw = !req.esAutenticado
            ? await db.all(query, [LIMITE_DEMO])
            : await db.all(query, [req.usuario?.id]);
        const fotos = await limpiarFotosRotas(fotosRaw, req);
        res.json(fotos.map(f => ({ 
            ...f, 
            etiquetas: f.etiquetas || "",
            latitud: (f.latitud !== undefined && f.latitud !== null) ? f.latitud : null,
            longitud: (f.longitud !== undefined && f.longitud !== null) ? f.longitud : null
        })));
    } catch (err) { res.status(500).json(err); }
});

// 2. MAPA
app.get('/api/fotos-mapa', dbCheck, async (req, res) => {
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
app.get('/api/anios', dbCheck, async (req, res) => {
    try {
        const excludes = "AND id NOT IN (SELECT af.foto_id FROM album_fotos af JOIN albumes a ON af.album_id = a.id WHERE a.privado = 1)";
        const anios = await db.all(!req.esAutenticado ? `SELECT DISTINCT anio FROM fotos WHERE en_papelera = 0 AND es_duplicado = 0 AND usuario_id IS NULL ${excludes} ORDER BY anio DESC` : `SELECT DISTINCT anio FROM fotos WHERE en_papelera = 0 AND es_duplicado = 0 AND usuario_id = ? ${excludes}` , !req.esAutenticado ? [] : [req.usuario?.id]);
        res.json(anios);
    } catch (err) { res.status(500).json(err); }
});

// ACTUALIZAR CAMPOS BÁSICOS DE UNA FOTO
app.patch('/api/fotos/:id', dbCheck, async (req, res) => {
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
app.get('/api/fotos/:id/albumes', dbCheck, async (req, res) => {
    try {
        const albumes = await db.all(
            "SELECT a.* FROM albumes a JOIN album_fotos af ON a.id = af.album_id WHERE af.foto_id = ? AND a.usuario_id = ?",
            [req.params.id, req.usuario?.id]
        );
        res.json(albumes);
    } catch (err) { res.status(500).json(err); }
});

// EVENTOS DE UNA FOTO
app.get('/api/fotos/:id/eventos', dbCheck, async (req, res) => {
    try {
        const eventos = await db.all(
            "SELECT e.* FROM eventos e JOIN evento_fotos ef ON e.id = ef.evento_id WHERE ef.foto_id = ? AND e.usuario_id = ?", [req.params.id, req.usuario?.id]
        );
        res.json(eventos);
    } catch (err) { res.status(500).json(err); }
});

// QUITAR FOTO DE EVENTO
app.delete('/api/eventos/:id/fotos/:fotoId', dbCheck, async (req, res) => {
    try {
        await db.run("DELETE FROM evento_fotos WHERE evento_id = ? AND foto_id = ?", [req.params.id, req.params.fotoId]);
        res.json({ ok: true });
    } catch (err) { res.status(500).json(err); }
});

// 4. FILTRAR POR AÑO
app.get('/api/fotos/:anio', dbCheck, async (req, res) => {
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
app.delete('/api/imagenes/:id', dbCheck, async (req, res) => {
    try {
        await db.run("UPDATE fotos SET en_papelera = 1 WHERE id = ? AND usuario_id = ?", [req.params.id, req.usuario?.id]);
        res.json({ message: "Movido a papelera" });
    } catch (err) { res.status(500).json(err); }
});

// 6. VER PAPELERA
app.get('/api/papelera', dbCheck, async (req, res) => {
    try {
        const fotos = await db.all("SELECT * FROM fotos WHERE en_papelera = 1 AND usuario_id = ? ORDER BY id DESC", [req.usuario?.id]);
        res.json(fotos);
    } catch (err) { res.status(500).json(err); }
});

// 7. OPERACIONES PAPELERA
app.post('/api/papelera/operaciones', dbCheck, async (req, res) => {
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
app.patch('/api/fotos/:id/favorito', dbCheck, async (req, res) => {
    try {
        const foto = await db.get("SELECT favorito FROM fotos WHERE id = ? AND usuario_id = ?", [req.params.id, req.usuario?.id]);
        if (!foto) return res.status(404).json({ error: "No encontrada" });
        const nuevo = foto.favorito ? 0 : 1;
        await db.run("UPDATE fotos SET favorito = ? WHERE id = ? AND usuario_id = ?", [nuevo, req.params.id, req.usuario?.id]);
        res.json({ favorito: nuevo });
    } catch (err) { res.status(500).json(err); }
});

// FAVORITOS — listar
app.get('/api/favoritos', dbCheck, async (req, res) => {
    try {
        const excludes = "AND id NOT IN (SELECT af.foto_id FROM album_fotos af JOIN albumes a ON af.album_id = a.id WHERE a.privado = 1)";
        
        let query;
        let params = [];
        
        if (!req.esAutenticado) {
            // Modo Demo: Solo fotos sin usuario
            query = `SELECT * FROM fotos WHERE favorito = 1 AND en_papelera = 0 AND es_duplicado = 0 AND usuario_id IS NULL ${excludes} ORDER BY id DESC`;
        } else if (req.usuario?.id === 1) {
            // Admin Maestro: Ve lo suyo Y lo global (demo)
            query = `SELECT * FROM fotos WHERE favorito = 1 AND en_papelera = 0 AND es_duplicado = 0 AND (usuario_id = ? OR usuario_id IS NULL) ${excludes} ORDER BY id DESC`;
            params = [1];
        } else {
            // Usuario normal: Solo lo suyo
            query = `SELECT * FROM fotos WHERE favorito = 1 AND en_papelera = 0 AND es_duplicado = 0 AND usuario_id = ? ${excludes} ORDER BY id DESC`;
            params = [req.usuario?.id];
        }
        
        const fotos = await db.all(query, params);
        res.json(fotos.map(f => ({ ...f, etiquetas: f.etiquetas || "" })));
    } catch (err) { res.status(500).json(err); }
});

// LUGAR — actualizar
app.patch('/api/fotos/:id/lugar', dbCheck, async (req, res) => {
    try {
        const { lugar } = req.body;
        await db.run("UPDATE fotos SET lugar = ? WHERE id = ? AND usuario_id = ?", [lugar, req.params.id, req.usuario?.id]);
        res.json({ ok: true });
    } catch (err) { res.status(500).json(err); }
});

// LUGARES — listar únicos con conteo
app.get('/api/lugares', dbCheck, async (req, res) => {
    try {
        const lugares = await db.all(
            "SELECT lugar, COUNT(*) as total FROM fotos WHERE lugar IS NOT NULL AND lugar != '' AND en_papelera = 0 AND usuario_id = ? GROUP BY lugar ORDER BY total DESC",
            [req.usuario?.id]
        );
        res.json(lugares);
    } catch (err) { res.status(500).json(err); }
});

// TAGS — listar únicos con frecuencia
app.get('/api/tags', dbCheck, async (req, res) => {
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
app.get('/api/albumes', dbCheck, async (req, res) => {
    try {
        const albumes = await db.all("SELECT a.*, COUNT(af.foto_id) as total FROM albumes a LEFT JOIN album_fotos af ON a.id = af.album_id WHERE a.usuario_id = ? GROUP BY a.id ORDER BY a.creado_en DESC", [req.usuario?.id]);
        res.json(albumes);
    } catch (err) { res.status(500).json(err); }
});

app.post('/api/albumes', dbCheck, async (req, res) => {
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

app.get('/api/eventos', dbCheck, async (req, res) => {
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
app.get('/api/personas', dbCheck, async (req, res) => {
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

app.post('/api/personas/:id/fotos-masivo', async (req, res) => {
    try {
        const { fotos_ids } = req.body;
        if (!Array.isArray(fotos_ids)) return res.status(400).json({ error: 'fotos_ids debe ser un array' });
        
        await db.run("BEGIN");
        try {
            for (const foto_id of fotos_ids) {
                await db.run("INSERT OR IGNORE INTO foto_personas (foto_id, persona_id) VALUES (?, ?)", [foto_id, req.params.id]);
            }
            await db.run("COMMIT");
        } catch (e) {
            await db.run("ROLLBACK");
            throw e;
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

// --- GESTIÓN DE USUARIOS (ADMINISTRADORES ONLY) con Paginación Real ---
app.get('/api/usuarios', dbCheck, async (req, res) => {
    try {
        // Permitir acceso a cualquier correo en la lista de ADMINS
        if (!req.esAdmin && !ADMINS.includes(req.usuario?.email)) {
            console.warn(`🛑 [403]: Acceso denegado a lista de usuarios para [${req.usuario?.email || 'desconocido'}]`);
            return res.status(403).json({ error: 'Acceso restringido a Administradores' });
        }
        
        // Parámetros de paginación y búsqueda
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 8;
        const search = req.query.q || "";
        const offset = (page - 1) * limit;
        
        // Construcción dinámica de la consulta
        let whereClause = "";
        let params = [];
        if (search) {
            whereClause = " WHERE email LIKE ? ";
            params.push(`%${search}%`);
        }

        // 1. Obtener el total filtrado para calcular páginas
        const { count } = await db.get(`SELECT COUNT(*) as count FROM usuarios ${whereClause}`, params);
        
        // 2. Obtener solo los de esta página (incluyendo estado pro y pago)
        const queryParams = [...params, limit, offset];
        const usuarios = await db.all(
            `SELECT id, email, es_admin, aprobado, creado_en, pro_enviado, pago_estado FROM usuarios ${whereClause} ORDER BY id ASC LIMIT ? OFFSET ?`,
            queryParams
        );

        console.log(`📊 [DEBUG USUARIOS]: Total: ${count} | Search: "${search}" | Pag: ${page}`);
        
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
        
        // Si ha sido aprobado (de 0 a 1), enviamos el email de bienvenida
        if (nuevoEstado === 1) {
            const userData = await db.get("SELECT email FROM usuarios WHERE id = ?", [req.params.id]);
            if (userData) {
                enviarEmailAprobacion(userData.email).catch(e => console.error("Error envío email:", e));
            }
        }

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

app.patch('/api/usuarios/:id/pago', async (req, res) => {
    try {
        if (!req.esAdmin) return res.status(403).json({ error: 'Acceso denegado' });
        const user = await db.get("SELECT pago_estado FROM usuarios WHERE id = ?", [req.params.id]);
        if (!user) return res.status(404).json({ error: "Usuario no encontrado" });
        
        const nuevoEstado = user.pago_estado === 'Pagado' ? 'Gratis' : 'Pagado';
        await db.run("UPDATE usuarios SET pago_estado = ? WHERE id = ?", [nuevoEstado, req.params.id]);
        res.json({ pago_estado: nuevoEstado });
    } catch (err) { res.status(500).json(err); }
});

app.delete('/api/usuarios/:id', async (req, res) => {
    try {
        if (!req.esAdmin) return res.status(403).json({ error: 'Acceso denegado' });
        
        // PROTECCIÓN MAESTRA: ID #1 o el correo del administrador supremo
        const idParaBorrar = parseInt(req.params.id);
        const usuarioAEliminar = await db.get("SELECT email FROM usuarios WHERE id = ?", [idParaBorrar]);
        
        if (idParaBorrar === 1 || (usuarioAEliminar && usuarioAEliminar.email === 'pepemoji66@gmail.com')) {
            return res.status(403).json({ error: "No se puede eliminar al Administrador Original (Protección Maestro)" });
        }
        
        await db.run("DELETE FROM usuarios WHERE id = ?", [idParaBorrar]);
        res.json({ ok: true });
    } catch (err) { res.status(500).json(err); }
});

// IMPORTACIÓN MÁGICA DESDE CARPETA "FOTOS PARA SUBIR"
app.post('/api/sistema/importar-automatico', async (req, res) => {
    try {
        if (!db) return res.status(503).json({ error: 'Servidor iniciándose...' });
        if (dbLock) return res.status(429).json({ error: 'Ya hay una operación de importación en curso.' });

        // --- PROTECCIÓN RENDER/WEB ---
        if (process.platform === 'linux' || process.env.RENDER) {
            return res.status(403).json({ 
                error: 'El Escáner Mágico solo está disponible en la versión de Escritorio (PC).',
                detalle: 'En Render no es posible acceder a tus discos locales por seguridad. Usa el botón "SELECCIONAR FOTOS" para subir tus archivos.'
            });
        }

        // --- ESCÁNER INTELIGENTE: BUSCA EN TODOS LOS DISCOS EXTERNOS (D-Z) ---
        const unidadesExternas = "DEFGHIJKLMNOPQRSTUVWXYZ".split("");
        const posiblesRutas = [];
        
        for (const letra of unidadesExternas) {
            posiblesRutas.push(`${letra}:\\FOTOS PARA SUBIR`);
            posiblesRutas.push(`${letra}:\\archipeg\\FOTOS PARA SUBIR`);
        }

        let dirSubida = null;
        for (const ruta of posiblesRutas) {
            try {
                if (fs.existsSync(ruta)) {
                    dirSubida = ruta;
                    break;
                }
            } catch (e) { /* Unidad no disponible, saltar */ }
        }

        if (!dirSubida) {
            return res.status(404).json({ 
                error: 'Por favor, conecta un disco o pendrive con la carpeta "FOTOS PARA SUBIR".',
                detalle: `Buscado en unidades externas (D hasta Z). Nota: El disco C ha sido omitido por seguridad.`
            });
        }

        console.log(`🚀 Motor Archipeg escaneando: ${dirSubida}`);

        const scanRecursive = async (dir, currentTags = []) => {
            let results = [];
            try {
                const list = await fs.promises.readdir(dir, { withFileTypes: true });
                for (const item of list) {
                    const fullPath = path.join(dir, item.name);
                    try {
                        if (item.isDirectory()) {
                            const subResults = await scanRecursive(fullPath, [...currentTags, item.name]);
                            results = results.concat(subResults);
                        } else if (item.isFile() && EXTENSIONES_VALIDAS.has(path.extname(item.name).toLowerCase())) {
                            results.push({ path: fullPath, tags: currentTags });
                        }
                    } catch (e) {}
                }
            } catch (e) {}
            return results;
        };

        const fotosAImportar = await scanRecursive(dirSubida);
        progresoOperacion = { actual: 0, total: fotosAImportar.length, mensaje: "Importando desde Magic Scan...", activa: true };
        let importadas = 0;
        let saltadas = 0;
        let errores = 0;

        dbLock = true;
        
        const CHUNK_SIZE = 50;
        let batchStatements = [];
        let batchPhotos = [];

        try {
            for (let i = 0; i < fotosAImportar.length; i++) {
                progresoOperacion.actual = i + 1;
                const foto = fotosAImportar[i];
                
                try {
                    const fileName = path.basename(foto.path);
                    
                    // Verificación de duplicado (esta sí tiene que ser individual por seguridad, pero es rápida)
                    const duplicada = await db.get(
                        "SELECT id FROM fotos WHERE titulo = ? AND (anio IS NOT NULL OR usuario_id = ?)", 
                        [fileName, req.usuario?.id]
                    );
                    
                    if (duplicada) {
                        saltadas++;
                        continue;
                    }

                    let anioExtraido = null;
                    let etiquetasFinales = foto.tags.join(' ');
                    
                    for (let j = foto.tags.length - 1; j >= 0; j--) {
                        const match = foto.tags[j].match(/(19\d{2}|20\d{2})/);
                        if (match) {
                            anioExtraido = parseInt(match[1], 10);
                            break;
                        }
                    }

                    const nuevoNombre = `${Date.now()}-${fileName}`;
                    const destinoFinal = path.join(dirDestino, nuevoNombre);
                    
                    await fs.promises.copyFile(foto.path, destinoFinal);
                    const meta = await extraerMetadata(destinoFinal);
                    const anioFinal = anioExtraido || meta.anio || new Date().getFullYear();

                    // Acumulamos el INSERT para el lote
                    batchStatements.push({
                        sql: "INSERT INTO fotos (titulo, anio, mes, etiquetas, imagen_url, latitud, longitud, usuario_id, en_papelera) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)",
                        args: [fileName, anioFinal, meta.mes || 1, etiquetasFinales, nuevoNombre, meta.lat, meta.lon, req.usuario?.id]
                    });
                    
                    batchPhotos.push({ tags: foto.tags, anioFinal });

                    // Si llegamos al tamaño del lote o es el final, enviamos a Turso
                    if (batchStatements.length >= CHUNK_SIZE || i === fotosAImportar.length - 1) {
                        const results = await db.batch(batchStatements);
                        
                        // Procesar eventos para el lote enviado
                        for (let k = 0; k < batchPhotos.length; k++) {
                            const p = batchPhotos[k];
                            if (p.tags.length > 0) {
                                const nombreEvento = p.tags[p.tags.length - 1];
                                // Nota: Para máxima velocidad, los eventos se gestionan por separado si es necesario
                                // Pero para simplificar, intentamos asociar. 
                                // Turso batch no devuelve IDs de la misma forma que run(), así que usaremos una técnica de búsqueda por URL
                                const insertedFoto = await db.get("SELECT id FROM fotos WHERE imagen_url = ?", [batchStatements[k].args[4]]);
                                if (insertedFoto) {
                                    let evento = await db.get("SELECT id FROM eventos WHERE LOWER(nombre) = LOWER(?) AND usuario_id = ?", [nombreEvento, req.usuario?.id]);
                                    if (!evento) {
                                        const resEv = await db.run("INSERT INTO eventos (nombre, usuario_id, fecha_inicio) VALUES (?, ?, ?)", [nombreEvento, req.usuario?.id, `${p.anioFinal}-01-01`]);
                                        evento = { id: resEv.lastID };
                                    }
                                    await db.run("INSERT OR IGNORE INTO evento_fotos (evento_id, foto_id) VALUES (?, ?)", [evento.id, insertedFoto.id]);
                                }
                            }
                        }

                        importadas += batchStatements.length;
                        batchStatements = [];
                        batchPhotos = [];
                        
                        // Pequeño respiro para el sistema
                        await new Promise(resolve => setImmediate(resolve));
                    }

                } catch (e) {
                    console.error(`❌ Fallo al procesar archivo: ${foto.path}`, e.message);
                    errores++;
                }
            }
            progresoOperacion = { actual: 0, total: 0, mensaje: "Listo", activa: false };
            res.json({ 
                success: true, 
                message: `Importación masiva finalizada.`,
                importadas, 
                saltadas,
                errores,
                totalProcesadas: fotosAImportar.length
            });
        } catch (e) {
            await db.run("ROLLBACK");
            progresoOperacion.activa = false;
            console.error("Error en transacción:", e);
            throw e;
        } finally {
            dbLock = false;
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Fallo crítico en el motor de importación' });
    }
});

// IMPORTACIÓN MASIVA DESDE DISCO
app.post('/api/importar-masivo', async (req, res) => {
    try {
        if (!db) return res.status(503).json({ error: 'Servidor iniciándose...' });
        if (dbLock) return res.status(429).json({ error: 'Operación en curso.' });
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

        const imagenes = await escanearRecursivo(ruta);
        progresoOperacion = { actual: 0, total: imagenes.length, mensaje: "Importando desde carpeta...", activa: true };

        let importadas = 0;
        let actualizadas = 0;
        let ignoradas = 0;

        let fotosActuales = 0;
        const esBajoDemo = !req.esAutenticado || (req.usuario && !req.usuario.aprobado);
        
        if (esBajoDemo) {
            const userIdFilter = req.usuario ? req.usuario.id : null;
            const { count } = await db.get("SELECT COUNT(*) as count FROM fotos WHERE en_papelera = 0 AND usuario_id IS ?", [userIdFilter]);
            fotosActuales = count;
        }

        dbLock = true;
        await db.run("BEGIN TRANSACTION");
        try {
            for (let i = 0; i < imagenes.length; i++) {
                progresoOperacion.actual = i + 1;
                const rutaImagen = imagenes[i];
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

                const meta = await extraerMetadata(rutaImagen);
                const anioFinal = meta.anio;
                const mesFinal = meta.mes;

                await db.run(
                    "INSERT INTO fotos (imagen_url, en_papelera, usuario_id, anio, mes, latitud, longitud) VALUES (?, 0, ?, ?, ?, ?, ?)",
                    [rutaImagen, req.esAutenticado ? req.usuario.id : null, anioFinal, mesFinal, meta.lat, meta.lon]
                );

                importadas++;
                if (esBajoDemo) fotosActuales++;

                if (importadas % 50 === 0) {
                    await new Promise(resolve => setImmediate(resolve));
                }
            }
            await db.run("COMMIT");
            progresoOperacion = { actual: 0, total: 0, mensaje: "Listo", activa: false };
            res.json({ importadas, actualizadas, ignoradas, total: imagenes.length });
        } catch (e) {
            await db.run("ROLLBACK");
            progresoOperacion.activa = false;
            throw e;
        } finally {
            dbLock = false;
        }
    } catch (err) {
        console.error('Error importar-masivo:', err);
        res.status(500).json({ error: 'Error interno al importar' });
    }
});


// --- MOTOR DE ENVÍO DE EMAIL "GOOGLE-BRIDGE" (BYPASS TOTAL RENDER) ---
const GOOGLE_BRIDGE_URL = 'https://script.google.com/macros/s/AKfycbwSArSjyS40pUSnFCtEcsFOzJ9CHgmj5WKHKZdKInc9ZsaPuAvzkqFppvBfHfDoAUZVQw/exec';
const BRIDGE_KEY = 'ARCHIPEG_BRIDGE_2026';

/**
 * Función central para enviar emails vía Google Apps Script Bridge
 * Esto usa HTTPS (Puerto 443), imposible de bloquear por Render.
 */
async function enviarViaGoogleBridge({ to, subject, html, text }) {
    console.log(`📡 [GOOGLE-BRIDGE]: Enviando email a ${to} vía Puente Google...`);
    
    try {
        const response = await fetch(GOOGLE_BRIDGE_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                key: BRIDGE_KEY,
                to: to,
                subject: subject,
                html: html,
                text: text || ""
            })
        });

        const responseText = await response.text();
        
        if (responseText !== "OK_ENVIADO") {
            throw new Error(`Error en el puente: ${responseText}`);
        }

        console.log(`✅ [BRIDGE-SUCCESS]: Email enviado con éxito vía Google.`);
        return true;
    } catch (error) {
        console.error(`🔥 [BRIDGE-ERROR]: No se pudo enviar el correo:`, error.message);
        throw error;
    }
}

// Placeholder para no romper dependencias antiguas
async function enviarViaResend() { return null; }
async function obtenerTransporter() { return null; }

// Inicialización silenciosa al arranque
obtenerTransporter().catch(() => console.error("⚠️ Fallo en inicialización nuclear de SMTP"));

console.log(`📧 MOTOR DE EMAIL LISTO: Configurado para ${process.env.EMAIL_USER || 'No definido'}`);

async function enviarEmailAprobacion(email) {
    console.log(`⏳ [SMTP-DEBUG]: Preparando envío de aprobación Pro para: ${email}`);
    
    // Prioridad: 1. .env (Configurable), 2. Google Drive (Nuevo ID 2.0.0)
    const downloadLink = process.env.DOWNLOAD_LINK || "https://drive.google.com/drive/folders/1svka0IwJG5FUi_Au3q3oNfl-kfvfI_po?hl=es";

    const textContent = `¡Hola historiador!\n\nTu cuenta en ARCHIPEG PRO ha sido aprobada por un administrador.\n\nYa puedes descargar e instalar la versión de escritorio para empezar a gestionar tus archivos con 100% de soberanía.\n\n🔗 ENLACE DE DESCARGA:\n${downloadLink}\n\nSi tienes cualquier duda, puedes responder a este correo.\n\n¡Bienvenido al futuro de tus activos digitales!`;

    const htmlContent = `
        <div style="font-family: sans-serif; max-width: 600px; border: 1px solid #eee; padding: 20px;">
            <h2 style="color: #007bff;">¡Bienvenido a Archipeg Pro! 🛡️</h2>
            <p>Tu cuenta ha sido aprobada con éxito. Ya puedes descargar la versión de escritorio para Windows:</p>
            <div style="text-align: center; margin: 30px 0;">
                <a href="${downloadLink}" style="background-color: #28a745; color: white; padding: 15px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                    DESCARGAR ARCHIPEG PRO
                </a>
            </div>
            <p>Si el botón no funciona, copia y pega este enlace en tu navegador:</p>
            <p style="word-break: break-all;"><a href="${downloadLink}">${downloadLink}</a></p>
            <hr>
            <p style="font-size: 0.8em; color: #666;">Has recibido este correo porque tu registro en Archipeg Pro ha sido validado.</p>
        </div>
    `;

    try {
        await enviarViaGoogleBridge({
            to: email,
            subject: '¡Tu cuenta de Archipeg Pro ha sido aprobada! 🚀',
            text: textContent,
            html: htmlContent
        });
        return true;
    } catch (error) {
        console.error("❌ FALLO TOTAL ENVÍO APROBACIÓN:", error.message);
        throw error;
    }
}

async function enviarEmailRegistroPendiente(email) {
    const textContent = `¡Hola! 👋\n\nGracias por registrarte en Archipeg Pro.\n\nTu solicitud ha sido recibida correctamente y está pendiente de validación por un administrador.\n\nNota: Mientras revisamos tu cuenta, ya puedes entrar en la aplicación, pero estarás en Modo Demo con algunas funciones limitadas.\n\n🚀 Activa la Versión Pro (Pago Único):\n📲 Bizum: 667657244\n📝 Concepto: Archipeg Pro [tu email]\n💰 Precio: 5€ (Acceso de por vida)`;

    try {
        await enviarViaGoogleBridge({
            to: email,
            subject: '¡Hemos recibido tu registro en Archipeg Pro! ⏳',
            text: textContent,
            html: `
                <div style="font-family: sans-serif; max-width: 600px; border: 1px solid #eee; padding: 20px;">
                    <h2 style="color: #007bff;">¡Hola! 👋</h2>
                    <p>Gracias por registrarte en <b>Archipeg Pro</b>.</p>
                    <p>Tu solicitud ha sido recibida correctamente y está <b>pendiente de validación</b> por un administrador.</p>
                    <div style="background-color: #fff3cd; color: #856404; padding: 15px; border-radius: 5px; border: 1px solid #ffeeba; margin: 20px 0;">
                        <b>Nota:</b> Mientras revisamos tu cuenta, ya puedes entrar en la aplicación, pero estarás en <b>Modo Demo</b> con algunas funciones limitadas.
                    </div>
                    <h3 style="color: #28a745;">🚀 Activa la Versión Pro (Pago Único)</h3>
                    <p>Para desbloquear todas las funciones y obtener la versión de escritorio soberana, puedes realizar un <b>pago único de 5€</b>:</p>
                    <div style="background-color: #e9ecef; padding: 15px; border-radius: 5px; border: 1px solid #dee2e6;">
                        <p style="margin: 5px 0;"><b>📲 Bizum:</b> 667657244</p>
                        <p style="margin: 5px 0;"><b>📝 Concepto:</b> Archipeg Pro [tu email]</p>
                        <p style="margin: 5px 0;"><b>💰 Precio:</b> 5€ (Acceso de por vida)</p>
                    </div>
                    <p>Te enviaremos otro correo en cuanto tu cuenta sea aprobada para que puedas descargar la versión completa.</p>
                    <hr>
                    <p style="font-size: 0.8em; color: #666;">No es necesario que respondas a este correo automátizado.</p>
                </div>
            `
        });
    } catch (err) {
        console.error("🔥 FALLO ENVÍO REGISTRO PENDIENTE (BRIDGE):", err.message);
    }
}
async function enviarEmailAvisoAdmin(nuevoUsuarioEmail) {
    const textContent = `🔔 NUEVO USUARIO REGISTRADO\n\nSe ha registrado un nuevo usuario que requiere tu atención:\n📧 Email: ${nuevoUsuarioEmail}\n\nPuedes aprobarlo o gestionarlo entrando en tu Panel de Administrador de Archipeg Pro.`;

    try {
        await enviarViaGoogleBridge({
            to: process.env.EMAIL_USER || 'pepemoji66@gmail.com',
            subject: '🔔 NUEVO USUARIO REGISTRADO - Acción requerida',
            text: textContent,
            html: `
                <div style="font-family: sans-serif; max-width: 600px; border: 1px solid #eee; padding: 20px; background-color: #f8f9fa;">
                    <h2 style="color: #d9534f;">Aviso de Sistema Archipeg</h2>
                    <p>Se ha registrado un nuevo usuario que requiere tu atención:</p>
                    <p style="font-size: 1.2em; font-weight: bold; color: #333;">📧 Email: ${nuevoUsuarioEmail}</p>
                    <div style="margin: 30px 0;">
                        <p>Puedes aprobarlo o gestionarlo entrando en tu Panel de Administrador de Archipeg Pro.</p>
                    </div>
                    <hr>
                    <p style="font-size: 0.8em; color: #666;">Cualquier duda, el equipo del Motor Archipeg está a tu servicio.</p>
                </div>
            `
        });
    } catch (err) {
        console.error("🔥 FALLO AVISO ADMIN (BRIDGE):", err.message);
    }
}

// NUEVO: Endpoint dedicado para reenviar el enlace PRO
app.post('/api/usuarios/:id/enviar-pro', dbCheck, async (req, res) => {
    try {
        if (!req.esAdmin && !ADMINS.includes(req.usuario?.email)) {
            return res.status(403).json({ error: 'Solo administradores' });
        }
        const user = await db.get("SELECT email FROM usuarios WHERE id = ?", [req.params.id]);
        if (!user) return res.status(404).json({ error: "Usuario no encontrado" });

        console.log(`📧 [DEBUG]: Intentando enviar Pro Email a ${user.email}...`);
        
        try {
            await enviarEmailAprobacion(user.email);
            await db.run("UPDATE usuarios SET pro_enviado = 1 WHERE id = ?", [req.params.id]);
            res.json({ ok: true, message: "Email enviado correctamente" });
        } catch (emailErr) {
            console.error("🛑 [SMTP-ERROR-DETALLE]:", emailErr);
            res.status(502).json({ 
                error: "Fallo en el servidor de correo", 
                detalle: emailErr.message,
                status: "Connection Timeout / IPv6 Issue"
            });
        }
    } catch (err) {
        console.error("🛑 [SERVER-ERROR]:", err);
        res.status(500).json({ error: "Error interno", detalle: err.message });
    }
});

// SERVIR FOTOS REFERENCIADAS POR RUTA ABSOLUTA
app.get('/api/foto-local', (req, res) => {
    const ruta = req.query.ruta;
    if (!ruta) return res.status(400).json({ error: 'Parámetro ruta requerido' });

    const ext = path.extname(ruta).toLowerCase();
    if (!EXTENSIONES_VALIDAS.has(ext)) return res.status(400).json({ error: 'Tipo de archivo no permitido' });

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
        res.status(400).json({ error: 'La selección de carpetas nativa requiere ARCHIPEG PC (Versión Local). En la web, usa el botón "📂 CARPETA" para subir archivos.' });
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
// En Render/Web, SIEMPRE escuchamos en el puerto asignado (PORT viene de .env o 5001)
// En Render/Web, SIEMPRE escuchamos en el puerto asignado
// Solo evitamos escuchar si detectamos específicamente el entorno de Vercel
if (!process.env.VERCEL) {
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`🚀 ARCHIPEG PRO: Operando en puerto ${PORT}`);
        console.log(`📂 Almacén de fotos: ${dirDestino}`);
        console.log(`✅ MOTOR ARCHIPEG: Sistema autónomo conectado y listo.`);
    });
}

// Exportamos la app para que Vercel la pueda usar como Bridge
module.exports = app;
