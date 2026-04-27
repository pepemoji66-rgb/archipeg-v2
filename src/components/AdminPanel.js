import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useSearchParams } from 'react-router-dom';
import ModalZoom from './ModalZoom';
import './admin.css';
import { apiFetch } from '../api';
import { useAuth } from '../AuthContext';
import { API_BASE_URL, UPLOADS_URL, FOTO_LOCAL_URL } from '../config';

const IS_ELECTRON = window.navigator.userAgent.indexOf('Electron') !== -1;
let electron = null;
if (IS_ELECTRON) {
    try {
        electron = window.require('electron');
    } catch (e) {
        console.error("Error cargando Electron IPC:", e);
    }
}

const IS_LOCAL = window.location.hostname === 'localhost';

const AdminPanel = () => {
    const { usuario, token } = useAuth();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const pUrl = searchParams.get('p') || '1';

    // --- NUEVO ESTADO DE PESTAÑAS (ESTILO ALBOLOTE) ---
    const [activeTab, setActiveTab] = useState('activo'); // 'activo', 'herramientas', 'papelera'

    // --- CONFIGURACIÓN DE RED ---
    const API_URL = `${API_BASE_URL}/api`;
    const URL_BASE_FOTOS = UPLOADS_URL;
    const URL_FOTO_LOCAL_BASE = FOTO_LOCAL_URL;
    const PLACEHOLDER_IMG = (() => {
        const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'>
            <rect x='2' y='2' width='96' height='96' rx='8' ry='8' fill='#0a0a1a' stroke='#00ffff' stroke-width='2'/>
            <text x='50' y='50' text-anchor='middle' dominant-baseline='middle' font-family='Segoe UI, Arial' font-size='12' fill='#00ffff'>Sin imagen</text>
        </svg>`;
        return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    })();

    const esRutaAbsoluta = (url) =>
        /^[A-Za-z]:[\\\/]/.test(url) || url.startsWith('/');

    const nombreMeses = [
        "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
        "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
    ];

    const [fotos, setFotos] = useState([]);
    const [fotosPapelera, setFotosPapelera] = useState([]);
    const [archivos, setArchivos] = useState([]);
    const [titulo, setTitulo] = useState("");
    const [anio, setAnio] = useState(2026);
    const [etiquetas, setEtiquetas] = useState("");
    const [descripcion, setDescripcion] = useState("");
    const [lugar, setLugar] = useState("");
    const [personas, setPersonas] = useState([]);
    const [personasSeleccionadas, setPersonasSeleccionadas] = useState([]);
    const [albumes, setAlbumes] = useState([]);
    const [albumSeleccionado, setAlbumSeleccionado] = useState("");
    const [mensaje, setMensaje] = useState("");
    const [importando, setImportando] = useState(false);
    const [statusImport, setStatusImport] = useState({ actual: 0, total: 0, mensaje: '', activa: false });
    const [progreso, setProgreso] = useState(0);

    // --- CONFIGURACIÓN DE TEXTOS DINÁMICOS (SOBERANÍA DE DATOS) ---
    const modoSoberano = IS_ELECTRON || IS_LOCAL || window.location.port === '5002';

    const [busquedaAnio, setBusquedaAnio] = useState("");
    const [busquedaMes, setBusquedaMes] = useState("");
    const [busquedaTitulo, setBusquedaTitulo] = useState("");
    const [draftBusquedaAnio, setDraftBusquedaAnio] = useState("");
    const [draftBusquedaMes, setDraftBusquedaMes] = useState("");
    const [draftBusquedaTitulo, setDraftBusquedaTitulo] = useState("");
    const [aniosDb, setAniosDb] = useState([]);
    const [paginaActual, setPaginaActual] = useState(parseInt(pUrl) || 1);

    // Sincronizar la URL con la página actual
    useEffect(() => {
        const p = searchParams.get('p');
        if (p !== String(paginaActual)) {
            searchParams.set('p', paginaActual);
            setSearchParams(searchParams, { replace: true });
        }
    }, [paginaActual, searchParams, setSearchParams]);

    const [inputPage, setInputPage] = useState(pUrl);
    const fotosPorPagina = 12;

    const [fotoEnZoom, setFotoEnZoom] = useState(null);
    const [nuevoAlbumRapido, setNuevoAlbumRapido] = useState("");
    const [albumesParaZoom, setAlbumesParaZoom] = useState([]);
    
    // NUEVOS ESTADOS PARA EVENTOS Y UI
    const [eventosParaZoom, setEventosParaZoom] = useState([]);
    const [nuevoEventoRapido, setNuevoEventoRapido] = useState("");

    // ESTADO PARA SELECCIÓN MÚLTIPLE
    const [seleccionados, setSeleccionados] = useState(new Set());
    const [bulkAlbumId, setBulkAlbumId] = useState("");
    const [bulkEventoId, setBulkEventoId] = useState("");
    const [esDiscoC, setEsDiscoC] = useState(false);

    const getFotoUrl = (foto) => {
        if (!foto || !foto.imagen_url) return PLACEHOLDER_IMG;
        const url = String(foto.imagen_url).trim();
        if (esRutaAbsoluta(url)) return `${URL_FOTO_LOCAL_BASE}${encodeURIComponent(url)}`;
        return `${URL_BASE_FOTOS}${url.replace(/ /g, '%20').replace(/\\/g, '/')}`;
    };

    const cargarFotos = () => {
        apiFetch(`${API_URL}/imagenes`)
            .then(res => res.ok ? res.json() : [])
            .then(data => setFotos(data.sort((a, b) => b.id - a.id)))
            .catch(err => console.error("Error API:", err));
    };

    const navegarFoto = (direccion) => {
        const idx = fotosFiltradas.findIndex(f => f.id === fotoEnZoom?.id);
        if (idx === -1) return;
        if (direccion === 'siguiente' && idx < fotosFiltradas.length - 1) setFotoEnZoom(fotosFiltradas[idx + 1]);
        else if (direccion === 'anterior' && idx > 0) setFotoEnZoom(fotosFiltradas[idx - 1]);
    };

    const ejecutarSalto = (e) => {
        if (e.key === 'Enter') {
            const num = parseInt(inputPage);
            if (!isNaN(num) && num > 0 && num <= totalPaginas) {
                setPaginaActual(num);
                setInputPage(num.toString());
            } else {
                setInputPage(paginaActual.toString());
            }
        }
    };

    const cargarPapelera = () => {
        apiFetch(`${API_URL}/papelera`)
            .then(res => res.ok ? res.json() : [])
            .then(setFotosPapelera)
            .catch(() => {});
    };

    useEffect(() => {
        cargarFotos();
        cargarPapelera();
        apiFetch(`${API_URL}/personas`).then(r => r.json()).then(setPersonas).catch(() => { });
        apiFetch(`${API_URL}/albumes`).then(r => r.json()).then(setAlbumes).catch(() => { });
        apiFetch(`${API_URL}/eventos`).then(r => r.json()).then(setEventosParaZoom).catch(() => { });
        apiFetch(`${API_URL}/anios`).then(r => r.json()).then(data => setAniosDb(data.map(a => a.anio).filter(Boolean))).catch(() => { });
        fetch(`${API_URL}/test`).then(res => res.json()).then(data => setEsDiscoC(data.isCDrive)).catch(() => {});
    }, []);

    const ejecutarLimpiezaTotal = async () => {
        const confirm1 = window.confirm("⚠️ ¿ESTÁS SEGURO?\n\nEsto borrará los registros de tus fotos en la base de datos.");
        if (!confirm1) return;
        try {
            setMensaje("Vaciando base de datos...");
            const res = await fetch(`${API_URL}/sistema/limpiar-todo`, { method: 'POST', headers: { 'Authorization': token ? `Bearer ${token}` : '' } });
            if (res.ok) { setMensaje("✅ Índice vaciado."); cargarFotos(); }
        } catch (error) { setMensaje("❌ Error al limpiar."); }
    };

    const manejarSubida = async (e) => {
        e.preventDefault();
        if (archivos.length === 0) return alert("Selecciona fotos");
        const batchSize = 100;
        const totalLotes = Math.ceil(archivos.length / batchSize);
        setProgreso(1);
        for (let i = 0; i < totalLotes; i++) {
            const batch = archivos.slice(i * batchSize, (i + 1) * batchSize);
            const formData = new FormData();
            batch.forEach(f => formData.append('foto', f));
            formData.append('titulo', titulo); formData.append('anio', anio); 
            formData.append('mes', busquedaMes); formData.append('etiquetas', etiquetas);
            formData.append('descripcion', descripcion); formData.append('lugar', lugar);
            try {
                setMensaje(`📤 Subiendo lote ${i + 1}/${totalLotes}...`);
                await fetch(`${API_URL}/fotos/subir`, { method: 'POST', headers: { 'Authorization': token ? `Bearer ${token}` : '' }, body: formData });
                setProgreso(Math.round(((i + 1) / totalLotes) * 100));
            } catch (error) { setMensaje("❌ Error en subida."); return; }
        }
        setMensaje("✅ Importación completa.");
        setArchivos([]); setProgreso(0); cargarFotos();
    };

    const ejecutarImportacionAutomatica = async () => {
        if (!window.confirm("🚀 ¿INICIAR ESCÁNER MÁGICO?\n\nDetectará la carpeta 'FOTOS PARA SUBIR' en tus discos externos.")) return;
        setImportando(true);
        try {
            const res = await apiFetch(`${API_URL}/sistema/importar-automatico`, { method: 'POST' });
            if (res.ok) {
                const data = await res.json();
                setMensaje(`✨ ÉXITO: ${data.importadas} nuevas fotos.`);
                cargarFotos();
            } else {
                const err = await res.json(); alert(`❌ ${err.error}`);
            }
        } catch (error) { 
            setMensaje("❌ Error de conexión");
        } finally {
            setImportando(false);
            setStatusImport({ actual: 0, total: 0, mensaje: '', activa: false });
        }
    };

    const cancelarImportacion = async () => {
        if (!window.confirm("¿Seguro que quieres detener la importación?")) return;
        try {
            await apiFetch(`${API_URL}/sistema/cancelar-import`, { method: 'POST' });
            setImportando(false);
            setStatusImport(prev => ({ ...prev, activa: false }));
            setMensaje("Importación cancelada.");
        } catch (e) { console.error(e); }
    };

    // Polling de estado de importación
    useEffect(() => {
        let interval;
        if (importando) {
            interval = setInterval(async () => {
                try {
                    const res = await apiFetch(`${API_URL}/sistema/status-import`);
                    if (res.ok) {
                        const data = await res.json();
                        setStatusImport(data);
                        if (!data.activa && importando) {
                            setImportando(false);
                        }
                    }
                } catch (e) { console.error(e); }
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [importando]);

    const gestionarPapelera = async (id, accion) => {
        try {
            const res = await apiFetch(`${API_URL}/papelera/operaciones`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, accion })
            });
            if (res.ok) { cargarFotos(); cargarPapelera(); }
        } catch (e) {}
    };

    const aplicarFiltros = () => {
        setBusquedaAnio(draftBusquedaAnio);
        setBusquedaMes(draftBusquedaMes);
        setBusquedaTitulo(draftBusquedaTitulo);
        setPaginaActual(1);
    };

    const limpiarFiltros = () => {
        setDraftBusquedaAnio("");
        setDraftBusquedaMes("");
        setDraftBusquedaTitulo("");
        setBusquedaAnio("");
        setBusquedaMes("");
        setBusquedaTitulo("");
        setPaginaActual(1);
    };

    const manejarSeleccion = (id) => {
        const nuevos = new Set(seleccionados);
        if (nuevos.has(id)) nuevos.delete(id); else nuevos.add(id);
        setSeleccionados(nuevos);
    };

    const fotosFiltradas = fotos.filter(foto => {
        const bAnio = busquedaAnio.toString().trim();
        const bMes = busquedaMes.toString().trim();
        const bTit = busquedaTitulo.toLowerCase().trim();
        const rutaNorm = (foto.imagen_url || "").replace(/\\/g, "/").toLowerCase();
        
        const coincideTexto = bTit === "" || 
                              (foto.titulo || "").toLowerCase().includes(bTit) || 
                              (foto.etiquetas || "").toLowerCase().includes(bTit) || 
                              (foto.lugar || "").toLowerCase().includes(bTit) ||
                              rutaNorm.includes(bTit);

        const coincideAnio = bAnio === "" || (foto.anio && foto.anio.toString() === bAnio) || rutaNorm.includes(bAnio);
        const coincideMes = bMes === "" || (foto.mes && foto.mes.toString() === bMes);

        return coincideTexto && coincideAnio && coincideMes;
    });

    const totalPaginas = Math.max(1, Math.ceil(fotosFiltradas.length / fotosPorPagina));
    const fotosPaginadas = fotosFiltradas.slice((paginaActual - 1) * fotosPorPagina, paginaActual * fotosPorPagina);

    return (
        <div className="admin-container albolote-style">
            {/* 1. HEADER ESTILO ALBOLOTE-NEON */}
            <header className="albolote-header">
                <div className="header-left">
                    <button onClick={() => navigate('/')} className="btn-circle-back">🏠</button>
                    <h1 className="albolote-title">ARCHIPEG <span className="neon-text-alt">ADMIN</span></h1>
                </div>
                <div className="header-right">
                    <button onClick={() => navigate('/galeria')} className="btn-neon-orange">VER GALERÍA</button>
                </div>
            </header>

            {/* 2. TABS SUPERIORES */}
            <nav className="albolote-tabs">
                <button className={`tab-btn ${activeTab === 'activo' ? 'active' : ''}`} onClick={() => setActiveTab('activo')}>
                    📁 ARCHIVO ACTIVO ({fotos.length})
                </button>
                <button className={`tab-btn ${activeTab === 'herramientas' ? 'active' : ''}`} onClick={() => setActiveTab('herramientas')}>
                    🛠️ HERRAMIENTAS
                </button>
                <button className={`tab-btn ${activeTab === 'papelera' ? 'active' : ''}`} onClick={() => setActiveTab('papelera')}>
                    🗑️ PAPELERA ({fotosPapelera.length})
                </button>
            </nav>

            <main className="albolote-main">
                {activeTab === 'activo' && (
                    <>
                        {/* MANTENIMIENTO RÁPIDO */}
                        <section className="albolote-card maintenance">
                            <h2 className="card-label">⚡ MANTENIMIENTO DEL SISTEMA</h2>
                            <div className="maintenance-actions">
                                {modoSoberano ? (
                                    <>
                                        <div className="magic-scan-info-box" style={{marginBottom: '15px', color: '#00ffff', fontSize: '0.9rem', border: '1px dashed #00ffff', padding: '10px', borderRadius: '5px'}}>
                                            💡 <strong>TRUCO MAESTRO:</strong> Si quieres importar todas tus carpetas de golpe, asegúrate de que estén dentro de una carpeta llamada <code>FOTOS PARA SUBIR</code> en tu disco externo y pulsa el botón mágico.
                                        </div>
                                        <button onClick={ejecutarImportacionAutomatica} className="btn-magic-scan">
                                            ✨ MAGIC SCAN (AUTO-DETECT)
                                        </button>
                                        <button onClick={ejecutarLimpiezaTotal} className="btn-panic-clear">
                                            ☢️ VACIAR ÍNDICE
                                        </button>
                                    </>
                                ) : (
                                    <div className="info-render-box">
                                        <p>🌐 <strong>Modo Cloud (Render) Activo:</strong> El Escáner Mágico y vaciado físico están limitados a la versión de Escritorio para proteger tu colección.</p>
                                    </div>
                                )}
                            </div>
                            
                            {importando && (
                                <div className="import-progress-container" style={{ marginTop: '20px', background: 'rgba(0,0,0,0.3)', padding: '15px', borderRadius: '8px', border: '1px solid #00ffff' }}>
                                    <div className="import-progress-info" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                        <span className="import-percentage" style={{ color: '#00ffff', fontWeight: 'bold' }}>🚀 {Math.round((statusImport.actual / statusImport.total) * 100) || 0}%</span>
                                        <span className="import-count" style={{ color: '#fff' }}>({statusImport.actual} / {statusImport.total})</span>
                                        <button className="btn-stop-import" onClick={cancelarImportacion} style={{ background: '#ff4d4d', color: '#fff', border: 'none', padding: '5px 12px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>🛑 DETENER</button>
                                    </div>
                                    <div className="import-progress-bar-bg" style={{ width: '100%', height: '12px', background: 'rgba(255,255,255,0.1)', borderRadius: '6px', overflow: 'hidden' }}>
                                        <div 
                                            className="import-progress-bar-fill" 
                                            style={{ 
                                                width: `${(statusImport.actual / statusImport.total) * 100}%`,
                                                height: '100%',
                                                background: 'linear-gradient(90deg, #00ffff, #ff00ff)',
                                                boxShadow: '0 0 15px #ff00ff',
                                                transition: 'width 0.4s ease'
                                            }}
                                        ></div>
                                    </div>
                                </div>
                            )}

                            {mensaje && <p className="mensaje-status" style={{ marginTop: '10px', color: '#00ffff' }}>{mensaje}</p>}
                        </section>

                        {/* FILTROS Y TABLA */}
                        <section className="albolote-card content">
                            <div className="filter-bar-sleek" style={{ flexWrap: 'wrap' }}>
                                <input 
                                    type="text" 
                                    placeholder="Buscar por título o etiquetas..." 
                                    value={draftBusquedaTitulo} 
                                    onChange={(e) => setDraftBusquedaTitulo(e.target.value)} 
                                    onKeyDown={(e) => e.key === 'Enter' && aplicarFiltros()}
                                    className="sleek-input" 
                                />
                                <input 
                                    type="number" 
                                    placeholder="Año" 
                                    value={draftBusquedaAnio} 
                                    onChange={(e) => setDraftBusquedaAnio(e.target.value)} 
                                    onKeyDown={(e) => e.key === 'Enter' && aplicarFiltros()}
                                    className="sleek-input-small" 
                                />
                                <select 
                                    value={draftBusquedaMes} 
                                    onChange={(e) => setDraftBusquedaMes(e.target.value)} 
                                    className="sleek-select"
                                >
                                    <option value="">Cualquier Mes</option>
                                    {nombreMeses.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
                                </select>
                                <button className="btn-ir-pagi-admin" onClick={aplicarFiltros} style={{padding: '0 20px', height: '45px'}}>🔍 BUSCAR</button>
                                {(busquedaAnio || busquedaMes || busquedaTitulo) && (
                                    <button className="btn-mini-action" onClick={limpiarFiltros} style={{height: '45px', borderColor: '#ff2d7d', color: '#ff2d7d'}}>🧹</button>
                                )}
                            </div>

                            <div className="table-wrapper-clean">
                                <table className="albolote-table">
                                    <thead>
                                        <tr>
                                            <th>MINI</th>
                                            <th>TÍTULO / ETIQUETAS</th>
                                            <th>FECHA</th>
                                            <th>ACCIONES</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {fotosPaginadas.map(f => (
                                            <tr key={f.id}>
                                                <td className="td-mini" onClick={() => setFotoEnZoom(f)} style={{ position: 'relative', cursor: 'pointer' }}>
                                                    {f.imagen_url && (f.imagen_url.toLowerCase().endsWith('.mp4') || f.imagen_url.toLowerCase().endsWith('.mov') || f.imagen_url.toLowerCase().endsWith('.avi') || f.imagen_url.toLowerCase().endsWith('.mkv') || f.imagen_url.toLowerCase().endsWith('.webm') || f.imagen_url.toLowerCase().endsWith('.3gp')) ? (
                                                        <video 
                                                            src={getFotoUrl(f)} 
                                                            className="mini-thumb" 
                                                            muted 
                                                            preload="metadata" 
                                                            onLoadedMetadata={e => e.target.currentTime = 0.5}
                                                            style={{ objectFit: 'cover', background: '#000' }}
                                                        />
                                                    ) : (
                                                        <img src={getFotoUrl(f)} alt="mini" className="mini-thumb" onError={(e) => e.target.src = PLACEHOLDER_IMG} />
                                                    )}
                                                    
                                                    {f.imagen_url && (f.imagen_url.toLowerCase().endsWith('.mp4') || f.imagen_url.toLowerCase().endsWith('.mov') || f.imagen_url.toLowerCase().endsWith('.avi') || f.imagen_url.toLowerCase().endsWith('.mkv') || f.imagen_url.toLowerCase().endsWith('.webm') || f.imagen_url.toLowerCase().endsWith('.3gp')) && (
                                                        <div className="video-badge-mini" style={{
                                                            position: 'absolute', bottom: '5px', right: '5px', background: 'rgba(0,0,0,0.7)', 
                                                            color: '#00ffff', fontSize: '10px', padding: '2px 4px', borderRadius: '3px', border: '1px solid #00ffff'
                                                        }}>VÍDEO</div>
                                                    )}
                                                </td>
                                                <td className="td-info-clean">
                                                    <span className="info-title">
                                                        {f.titulo || "Sin título"}
                                                        {f.latitud && <span title="Tiene coordenadas GPS" style={{marginLeft:'8px', cursor:'help'}}>📍</span>}
                                                    </span>
                                                    <span className="info-tags">{f.etiquetas || "Sin etiquetas"}</span>
                                                </td>
                                                <td className="td-date">{f.mes}/{f.anio}</td>
                                                <td className="td-actions-clean">
                                                    <button onClick={() => apiFetch(`${API_URL}/imagenes/${f.id}`, { method: 'DELETE' }).then(cargarFotos)} className="btn-mini-action">🗑️</button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <div className="pagination-sleek">
                                <button disabled={paginaActual === 1} onClick={() => setPaginaActual(p => p - 1)} className="btn-pag">ANTERIOR</button>
                                <div className="pagi-jump-box">
                                    <span>Página {paginaActual} de {totalPaginas}</span>
                                    <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                                        <input 
                                            type="text" 
                                            inputMode="numeric"
                                            className="sleek-input-jump" 
                                            value={inputPage} 
                                            onChange={(e) => setInputPage(e.target.value.replace(/\D/g, ''))}
                                            onKeyDown={ejecutarSalto}
                                            placeholder="..."
                                        />
                                        <button className="btn-ir-pagi-admin" onClick={() => ejecutarSalto({ key: 'Enter' })}>IR</button>
                                    </div>
                                </div>
                                <button disabled={paginaActual >= totalPaginas} onClick={() => setPaginaActual(p => p + 1)} className="btn-pag">SIGUIENTE</button>
                            </div>
                        </section>
                    </>
                )}

                {activeTab === 'herramientas' && (
                    <div className="tools-grid">
                        <section className="albolote-card tools">
                            <h2 className="card-label">📤 SUBIDA WEB / CONFIGURACIÓN</h2>
                            <form onSubmit={manejarSubida} className="tools-form">
                                <div className="form-row">
                                    <input type="text" placeholder="Título base" value={titulo} onChange={e => setTitulo(e.target.value)} className="sleek-input" />
                                    <input type="number" value={anio} onChange={e => setAnio(e.target.value)} className="sleek-input-small" />
                                </div>
                                <div className="file-box">
                                    <input type="file" multiple onChange={e => setArchivos(Array.from(e.target.files))} id="file-up" style={{display:'none'}} />
                                    <label htmlFor="file-up" className="btn-file-neon">SELECCIONAR FOTOS ({archivos.length})</label>
                                    <div className="sovereignty-info-box" style={{ marginBottom: '15px', textAlign: 'left' }}>
                                        <strong>🛡️ AVISO DE SOBERANÍA</strong>
                                        <p>
                                            Al usar este botón, las fotos <b>se copiarán en la nube</b>. 
                                            Usa esta opción solo para "escaparate" o compartir. Para privacidad total en tu disco duro, 
                                            usa el "Escáner Mágico" en tu PC.
                                        </p>
                                    </div>
                                    <button type="submit" className="btn-neon-purple" disabled={archivos.length===0} style={{marginTop:'15px'}}>INICIAR SUBIDA (COPIA A LA NUBE)</button>
                                </div>
                            </form>
                        </section>
                        
                        <section className="albolote-card tools">
                            <h2 className="card-label">⚙️ TAREAS DE MANTENIMIENTO</h2>
                            <div className="maintenance-buttons-grid">
                                <button onClick={async () => {
                                    setMensaje("🛰️ Geolocalizando..."); setProgreso(1);
                                    let intv = setInterval(async () => {
                                        const r = await fetch(`${API_URL}/sistema/status-import`);
                                        if (r.ok) {
                                            const d = await r.json();
                                            if (d.activa) {
                                                setProgreso(Math.round((d.actual / d.total) * 100));
                                                setMensaje(`🛰️ ${d.mensaje} (${d.actual}/${d.total})`);
                                            }
                                        }
                                    }, 1500);
                                    await apiFetch(`${API_URL}/sistema/rescan-gps`, {method:'POST'});
                                    clearInterval(intv); setProgreso(100); setMensaje("✅ GPS Actualizado");
                                    setTimeout(() => { setProgreso(0); setMensaje(""); }, 2000);
                                }} className="btn-tool">SATÉLITE GPS</button>
                                
                                <button onClick={async () => {
                                    setMensaje("🏷️ Indexando..."); setProgreso(1);
                                    let intv = setInterval(async () => {
                                        const r = await fetch(`${API_URL}/sistema/status-import`);
                                        if (r.ok) {
                                            const d = await r.json();
                                            if (d.activa) {
                                                setProgreso(Math.round((d.actual / d.total) * 100));
                                                setMensaje(`🏷️ ${d.mensaje} (${d.actual}/${d.total})`);
                                            }
                                        }
                                    }, 1500);
                                    await apiFetch(`${API_URL}/sistema/rescan-tags`, {method:'POST'});
                                    clearInterval(intv); setProgreso(100); setMensaje("✅ Tags Indexados");
                                    setTimeout(() => { setProgreso(0); setMensaje(""); }, 2000);
                                }} className="btn-tool">INDEXAR TAGS</button>
                                
                                {usuario?.esAdmin && <button onClick={() => navigate('/usuarios')} className="btn-tool">GESTIÓN USUARIOS</button>}
                            </div>
                        </section>
                    </div>
                )}

                {activeTab === 'papelera' && (
                    <section className="albolote-card content">
                        <h2 className="card-label">🗑️ ELEMENTOS ELIMINADOS</h2>
                        <div className="table-wrapper-clean">
                            <table className="albolote-table">
                                <thead><tr><th>MINI</th><th>NOMBRE</th><th>ACCIONES</th></tr></thead>
                                <tbody>
                                    {fotosPapelera.map(f => (
                                        <tr key={f.id}>
                                            <td className="td-mini"><img src={getFotoUrl(f)} className="mini-thumb" alt="" /></td>
                                            <td>{f.titulo || f.imagen_url}</td>
                                            <td className="td-actions-clean">
                                                <button onClick={() => gestionarPapelera(f.id, 'restaurar')} className="btn-mini-action restore">🔄</button>
                                                <button onClick={() => gestionarPapelera(f.id, 'eliminar_permanente')} className="btn-mini-action delete-perm">❌</button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </section>
                )}
            </main>

            {/* ZOOM MODAL */}
            {fotoEnZoom && (
                <ModalZoom 
                    foto={fotoEnZoom} 
                    onClose={() => setFotoEnZoom(null)} 
                    onNavigate={navegarFoto}
                    getFotoUrl={getFotoUrl}
                    onFavoritoToggle={(updated) => setFotos(prev => prev.map(f => f.id === updated.id ? updated : f))}
                />
            )}
        </div>
    );
};

export default AdminPanel;
