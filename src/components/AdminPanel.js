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
    const [searchParams, setSearchParams] = useSearchParams();
    const pUrl = searchParams.get('p') || '1';

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
    const [progreso, setProgreso] = useState(0);

    // --- CONFIGURACIÓN DE TEXTOS DINÁMICOS (SOBERANÍA DE DATOS) ---
    const modoSoberano = IS_ELECTRON || IS_LOCAL;
    const labelFotos = modoSoberano ? `🛡️ MODO PRIVADO: IMPORTAR FOTOS A MI DISCO (SIN INTERNET)` : `⚠️ MODO INTERNET: SUBIR FOTOS A LA WEB (NO PRIVADO)`;
    const labelCarpeta = modoSoberano ? "🛡️ IMPORTAR CARPETA A DISCO (LOCAL)" : "⚠️ SUBIR CARPETA A LA WEB (INTERNET)";
    const labelGuardar = modoSoberano ? "🛡️ GUARDAR EN MI PC (100% SOBERANO)" : "☁️ SUBIR A LA NUBE DE RENDER (PÚBLICO)";

    const [busquedaAnio, setBusquedaAnio] = useState("");
    const [busquedaMes, setBusquedaMes] = useState("");
    const [busquedaTitulo, setBusquedaTitulo] = useState("");
    const [aniosDb, setAniosDb] = useState([]);
    const [paginaActual, setPaginaActual] = useState(parseInt(pUrl) || 1);

    // Sincronizar la URL con la página actual
    useEffect(() => {
        const p = searchParams.get('p');
        if (p !== String(paginaActual)) {
            searchParams.set('p', paginaActual);
            // navigate({ search: searchParams.toString() }, { replace: true });
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
    const [menuOpcionesAbierto, setMenuOpcionesAbierto] = useState(false);

    // ESTADO PARA SELECCIÓN MÚLTIPLE
    const [seleccionados, setSeleccionados] = useState(new Set());
    const [bulkAlbumId, setBulkAlbumId] = useState("");
    const [bulkEventoId, setBulkEventoId] = useState("");

    const zoomWrapperRef = useRef(null);
    // Las variables y función para la navegación de zoom se declaran más abajo para tener acceso a fotosFiltradas

    // --- LÓGICA DE RUTAS CORREGIDA ---
    const getFotoUrl = (foto) => {
        if (!foto || !foto.imagen_url) return PLACEHOLDER_IMG;

        const url = String(foto.imagen_url).trim();
        if (esRutaAbsoluta(url)) {
            // Si la BD guarda ruta absoluta, usamos el endpoint que lee desde disco.
            return `${URL_FOTO_LOCAL_BASE}${encodeURIComponent(url)}`;
        }

        // Si no es ruta absoluta, asumimos que `imagen_url` es el nombre relativo al directorio servido en `/uploads`.
        return `${URL_BASE_FOTOS}${url.replace(/ /g, '%20').replace(/\\/g, '/')}`;
    };

    const cargarFotos = () => {
        apiFetch(`${API_URL}/imagenes`)
            .then(res => res.ok ? res.json() : [])
            .then(data => setFotos(data.sort((a, b) => b.id - a.id)))
            .catch(err => console.error("Error API:", err));
    };

    useEffect(() => {
        cargarFotos();
        cargarCatalogosZoom();
        apiFetch(`${API_URL}/personas`).then(r => r.json()).then(setPersonas).catch(() => { });
        apiFetch(`${API_URL}/albumes`).then(r => r.json()).then(setAlbumes).catch(() => { });
        apiFetch(`${API_URL}/eventos`).then(r => r.json()).then(setEventosParaZoom).catch(() => { });
        apiFetch(`${API_URL}/anios`).then(r => r.json()).then(data => setAniosDb(data.map(a => a.anio).filter(Boolean))).catch(() => { });
    }, []);

    // Bloquear el scroll del fondo cuando el modal de zoom esté abierto
    useEffect(() => {
        const bodyRoot = document.getElementById('root') || document.querySelector('body');
        const mainScroll = document.querySelector('.admin-container');
        
        if (fotoEnZoom) {
            bodyRoot.style.overflow = 'hidden';
            if (mainScroll) mainScroll.style.overflow = 'hidden';
            // REFRESCO AUTOMÁTICO DE ÁLBUMES AL ABRIR EL ZOOM PARA NO PERDER NUEVOS ÁLBUMES
            cargarCatalogosZoom();
        } else {
            bodyRoot.style.overflow = 'auto';
            if (mainScroll) mainScroll.style.overflow = '';
        }
        return () => { 
            bodyRoot.style.overflow = 'auto'; 
            if (mainScroll) mainScroll.style.overflow = '';
        };
    }, [fotoEnZoom]);

    // Sincronizar el input de la página cuando la página actual cambia (p. ej. por las flechas)
    useEffect(() => {
        setInputPage(paginaActual.toString());
    }, [paginaActual]);

    const cargarCatalogosZoom = () => {
        apiFetch(`${API_URL}/albumes`).then(r => r.json()).then(setAlbumesParaZoom).catch(() => { });
        apiFetch(`${API_URL}/eventos`).then(r => r.json()).then(setEventosParaZoom).catch(() => { });
    };

    const añadirAAlbumRapido = async (albumId) => {
        if (!fotoEnZoom || !albumId) return;
        try {
            const res = await apiFetch(`${API_URL}/albumes/${albumId}/fotos`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ foto_id: fotoEnZoom.id })
            });
            if (res.ok) {
                setMensaje("✅ Activo añadido al álbum.");
                setTimeout(() => setMensaje(""), 2000);
            }
        } catch (e) { console.error(e); }
    };

    const crearAlbumRapido = async () => {
        if (!nuevoAlbumRapido.trim()) return;
        try {
            const res = await apiFetch(`${API_URL}/albumes`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nombre: nuevoAlbumRapido.trim() })
            });
            if (res.ok) {
                const nuevo = await res.json();
                setAlbumesParaZoom(prev => {
                    if (prev.some(a => a.id === nuevo.id)) return prev;
                    return [...prev, nuevo];
                });
                await añadirAAlbumRapido(nuevo.id);
                setNuevoAlbumRapido("");
            }
        } catch (e) { console.error(e); }
    };

    const añadirAEventoRapido = async (eventoId) => {
        if (!fotoEnZoom || !eventoId) return;
        try {
            const res = await apiFetch(`${API_URL}/eventos/${eventoId}/fotos`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ foto_id: fotoEnZoom.id })
            });
            if (res.ok) {
                setMensaje("✅ Activo añadido al evento.");
                setTimeout(() => setMensaje(""), 2000);
            }
        } catch (e) { console.error(e); }
    };

    const crearEventoRapido = async () => {
        if (!nuevoEventoRapido.trim()) return;
        try {
            const res = await apiFetch(`${API_URL}/eventos`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nombre: nuevoEventoRapido.trim() })
            });
            if (res.ok) {
                const nuevo = await res.json();
                setEventosParaZoom(prev => {
                    if (prev.some(e => e.id === nuevo.id)) return prev;
                    return [...prev, nuevo];
                });
                await añadirAEventoRapido(nuevo.id);
                setNuevoEventoRapido("");
            }
        } catch (e) { console.error(e); }
    };

    const manejarCambioArchivos = (e) => {
        setArchivos(Array.from(e.target.files).filter(f => f.type.startsWith('image/')));
    };

    // --- FUNCIÓN DE LIMPIEZA TOTAL (BOTÓN DE PÁNICO) ---
    const ejecutarLimpiezaTotal = async () => {
        const confirmacion1 = window.confirm("⚠️ ¿ESTÁS SEGURO, HERMANO?\n\nEsto borrará los registros de las 11.000 fotos de la base de datos, pero NO tocará tus archivos en el disco duro.");
        if (!confirmacion1) return;

        const confirmacion2 = window.confirm("🚨 ÚLTIMA ADVERTENCIA 🚨\n\n¿Seguro que quieres dejar la biblioteca a cero?");
        if (!confirmacion2) return;

        try {
            setMensaje("Vaciando base de datos...");
            const res = await fetch(`${API_URL}/sistema/limpiar-todo`, {
                method: 'POST',
                headers: {
                    'Authorization': token ? `Bearer ${token}` : ''
                }
            });

            if (res.ok) {
                alert("¡Hecho! La biblioteca está vacía. Ya puedes meter las 3.800 reales.");
                setMensaje("✅ Sistema reiniciado.");
                cargarFotos();
            } else {
                alert("Error al limpiar. Revisa que la ruta exista en el server.js");
            }
        } catch (error) {
            alert("Error de conexión con el servidor.");
        }
    };

    const manejarSubida = async (e) => {
        e.preventDefault();
        if (archivos.length === 0) return alert("Selecciona fotos válidas, hermano");

        const batchSize = 200; // Lote más grande ahora que tenemos transacciones estables en el server
        const totalLotes = Math.ceil(archivos.length / batchSize);
        setProgreso(1);
        setMensaje(`🚀 Iniciando carga por lotes (0/${archivos.length})`);

        for (let i = 0; i < totalLotes; i++) {
            const batch = archivos.slice(i * batchSize, (i + 1) * batchSize);
            const formData = new FormData();
            batch.forEach(f => formData.append('foto', f));
            formData.append('titulo', titulo);
            formData.append('anio', anio);
            formData.append('mes', busquedaMes);
            formData.append('etiquetas', etiquetas);
            formData.append('descripcion', descripcion);
            formData.append('lugar', lugar);

            try {
                setMensaje(`📤 Cargando lote ${i + 1} de ${totalLotes}...`);
                const res = await fetch(`${API_URL}/fotos/subir`, {
                    method: 'POST',
                    headers: { 'Authorization': token ? `Bearer ${token}` : '' },
                    body: formData
                });

                if (!res.ok) throw new Error("Fallo en el lote " + (i + 1));
                setProgreso(Math.round(((i + 1) / totalLotes) * 100));
            } catch (error) {
                alert("❌ Falló la subida en el lote " + (i + 1));
                setMensaje("⚠️ Error en la subida masiva.");
                return;
            }
        }

        setMensaje("¡Éxito! Todos los activos guardados en ARCHIPEG");
        setProgreso(100);
        setTimeout(() => {
            setTitulo(""); setEtiquetas(""); setLugar(""); setPersonasSeleccionadas([]); setAlbumSeleccionado(""); setArchivos([]); setProgreso(0);
            cargarFotos();
        }, 1000);
    };

    const borrarFoto = async (id) => {
        if (!window.confirm("¿Seguro que quieres enviar este activo a la papelera?")) return;
        try {
            const res = await apiFetch(`${API_URL}/imagenes/${id}`, { method: 'DELETE' });
            if (res.ok) { setFotoEnZoom(null); setRotacion(0); cargarFotos(); }
        } catch (error) { alert("Error de conexión"); }
    };

    const ejecutarImportacionDesdeDisco = async () => {
        try {
            // --- ADVERTENCIA DE SOBERANÍA DE DATOS ---
            if (!electron && !IS_LOCAL) {
                const mensajeWeb = `⚠️ ATENCIÓN: ESTÁS EN LA VERSIÓN WEB (INTERNET)\n\nLa magia de ARCHIPEG es la privacidad total en TU DISCO DURO LOCAL.\nSi importas fotos aquí, se subirán a INTERNET (nube de Render).\n\nPara máxima soberanía, te recomendamos usar ARCHIPEG PC.\n¿Quieres continuar con la subida a INTERNET?`;
                if (!window.confirm(mensajeWeb)) return;
            }

            setMensaje("Abriendo selector...");
            let rutaSeleccionada = null;

            if (electron) {
                rutaSeleccionada = await electron.ipcRenderer.invoke('seleccionar-carpeta');
            } else if (IS_LOCAL) {
                // Solo intentamos el selector del servidor si estamos en LOCAL
                const resRuta = await fetch(`${API_URL}/seleccionar-carpeta`);
                const dataRuta = await resRuta.json();
                rutaSeleccionada = dataRuta.ruta;
            } else {
                // En Render/Web, el selector del servidor fallará (501). 
                // Avisamos al usuario que use el nuevo botón de Carpeta Web.
                alert("El selector de carpetas nativo solo funciona en la Versión PC.\n\nUsa el nuevo botón '📂 CARPETA' que hemos añadido arriba para subir carpetas completas desde la web.");
                setMensaje("Usa el botón de CARPETA WEB arriba.");
                return;
            }
            if (!rutaSeleccionada) {
                setMensaje("Operación cancelada.");
                return;
            }

            if (!window.confirm(`¿Importar fotos de: ${rutaSeleccionada}?`)) return;

            setMensaje("🚀 Motor ARCHIPEG trabajando al máximo... No cierres el panel.");
            setProgreso(10);

            // Simulamos un avance pequeño mientras esperamos la respuesta pesada del servidor
            const interval = setInterval(() => {
                setProgreso(prev => (prev < 90 ? prev + 1 : prev));
            }, 500);

            const resImport = await fetch(`${API_URL}/importar-masivo`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': token ? `Bearer ${token}` : ''
                },
                body: JSON.stringify({ ruta: rutaSeleccionada })
            });

            clearInterval(interval);
            let resultado;
            try {
                resultado = await resImport.json();
            } catch (e) {
                resultado = { error: "Respuesta del servidor no válida" };
            }
            if (resImport.ok) {
                setProgreso(100);
                setTimeout(() => {
                    alert(`¡ÉXITO!\n- Nuevas: ${resultado.importadas}\n- Ya estaban: ${resultado.actualizadas}\n- Total: ${resultado.total}`);
                    setMensaje("✅ Importación finalizada con éxito.");
                    setProgreso(0);
                    cargarFotos();
                }, 500);
            } else {
                setProgreso(0);
                alert("❌ ERROR EN EL MOTOR: " + (resultado.error || "Fallo crítico en la importación"));
                setMensaje("⚠️ Falló la importación.");
            }
        } catch (error) {
            setProgreso(0);
            console.error(error);
            alert("❌ ERROR DE CONEXIÓN: No se pudo contactar con el motor de ARCHIPEG.");
        }
    };

    const ejecutarRescanGPS = async () => {
        if (!window.confirm("🛰️ ¿Quieres re-escanear tus 5.700 fotos para buscar coordenadas GPS?\n\nEsto no borrará nada, solo añadirá los puntos al mapa.")) return;
        
        try {
            setMensaje("🚀 Iniciando radar EXIF... Leyendo archivos del disco.");
            setProgreso(5);
            
            const res = await fetch(`${API_URL}/sistema/rescan-gps`, {
                method: 'POST',
                headers: {
                    'Authorization': token ? `Bearer ${token}` : ''
                }
            });
            
            if (res.ok) {
                const data = await res.json();
                setProgreso(100);
                setTimeout(() => {
                    alert(`🛰️ ¡Radar completado!\n\nSe han geolocalizado ${data.actualizadas} fotos nuevas.`);
                    setMensaje("✅ Escaneo GPS finalizado.");
                    setProgreso(0);
                    cargarFotos();
                }, 500);
            } else {
                setProgreso(0);
                alert("Error al ejecutar el radar.");
            }
        } catch (error) {
            setProgreso(0);
            alert("Error de conexión con el motor.");
        }
    };

    const manejarSeleccion = (id) => {
        const nuevos = new Set(seleccionados);
        if (nuevos.has(id)) nuevos.delete(id);
        else nuevos.add(id);
        setSeleccionados(nuevos);
    };

    const seleccionarTodo = () => {
        if (seleccionados.size === fotosPaginadas.length) {
            setSeleccionados(new Set());
        } else {
            setSeleccionados(new Set(fotosPaginadas.map(f => f.id)));
        }
    };

    const ejecutarAccionMasiva = async (tipo) => {
        const ids = Array.from(seleccionados);
        if (ids.length === 0) return;
        
        let targetId = tipo === 'album' ? bulkAlbumId : bulkEventoId;
        if (!targetId) return alert(`Selecciona un ${tipo === 'album' ? 'álbum' : 'evento'} primero.`);

        setMensaje(`Procesando ${ids.length} activos...`);
        let exitos = 0;

        for (const id of ids) {
            try {
                const endpoint = tipo === 'album' 
                    ? `${API_URL}/albumes/${targetId}/fotos` 
                    : `${API_URL}/eventos/${targetId}/fotos`;
                
                const res = await apiFetch(endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ foto_id: id })
                });
                if (res.ok) exitos++;
            } catch (e) { console.error(e); }
        }

        setMensaje(`✅ ${exitos} activos vinculados correctamente.`);
        setSeleccionados(new Set());
        setTimeout(() => setMensaje(""), 3000);
    };

    const ejecutarRescanTags = async () => {
        if (!window.confirm("¿QUIERES QUE ARCHIPEG ESCANEE DE NUEVO TUS 5.000 FOTOS EN BUSCA DE ETIQUETAS INTERNAS? (XPKeywords, Keywords, etc.)")) return;
        setMensaje("Buscando etiquetas en metadatos... esto puede tardar.");
        try {
            const res = await apiFetch(`${API_URL}/sistema/rescan-tags`, { method: 'POST' });
            const data = await res.json();
            setMensaje(`✅ ${data.message}`);
            // Recargar fotos para ver resultados
            const r = await apiFetch(`${API_URL}/imagenes`);
            const nuevas = await r.json();
            setFotos(nuevas);
        } catch (e) {
            setMensaje("❌ Error en la indexación masiva.");
        }
        setTimeout(() => setMensaje(""), 6000);
    };

    const fotosFiltradas = fotos.filter(foto => {
        const bAnio = busquedaAnio.toString().trim();
        const bMes = busquedaMes.toString().trim();
        const bTit = busquedaTitulo.toLowerCase().trim();
        
        // Volvemos a incluir la ruta del archivo para que fotos sin "anio" en DB puedan ser localizadas por carpeta
        const rutaNorm = (foto.imagen_url || "").replace(/\\/g, "/").toLowerCase();
        const coincideAnio = bAnio === "" || (foto.anio && foto.anio.toString() === bAnio) || rutaNorm.includes(bAnio);
        const coincideMes = bMes === "" || (foto.mes && foto.mes.toString() === bMes);
        const coincideTitulo = bTit === "" || (foto.titulo || "").toLowerCase().includes(bTit) || rutaNorm.includes(bTit);
        
        return coincideAnio && coincideMes && coincideTitulo;
    });

    const totalPaginas = Math.max(1, Math.ceil(fotosFiltradas.length / fotosPorPagina));
    const fotosPaginadas = fotosFiltradas.slice((paginaActual - 1) * fotosPorPagina, paginaActual * fotosPorPagina);

    const navegarZoom = (dir) => {
        if (!fotoEnZoom) return;
        const idx = fotosFiltradas.findIndex(f => f.id === fotoEnZoom.id);
        const next = dir === 'siguiente' ? (idx + 1) % fotosFiltradas.length : (idx - 1 + fotosFiltradas.length) % fotosFiltradas.length;
        setFotoEnZoom(fotosFiltradas[next]);
    };

    const forzarDescarga = (url, nombre) => {
        fetch(url).then(res => res.blob()).then(blob => {
            const urlBlob = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = urlBlob;
            a.download = nombre || 'archivo_archipeg';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(urlBlob);
        }).catch(() => window.open(url, '_blank'));
    };

    return (
        <div className="admin-container">
            {/* BANNER DE SOBERANÍA DE DATOS (MÁXIMA CLARIDAD) */}
            <div style={{
                background: modoSoberano ? 'rgba(0, 255, 128, 0.1)' : 'rgba(255, 45, 125, 0.1)',
                border: `1px solid ${modoSoberano ? '#00ff80' : '#ff2d7d'}`,
                padding: '12px',
                borderRadius: '8px',
                marginBottom: '20px',
                textAlign: 'center',
                color: modoSoberano ? '#00ff80' : '#ff2d7d',
                fontWeight: 'bold',
                fontSize: '0.9rem',
                boxShadow: `0 0 15px ${modoSoberano ? 'rgba(0, 255, 128, 0.2)' : 'rgba(255, 45, 125, 0.2)'}`
            }}>
                {modoSoberano 
                    ? "🛡️ MODO SOBERANO ACTIVO: Tus fotos están seguras en este PC y NUNCA salen a Internet." 
                    : "⚠️ MODO ESCAPARATE WEB: Las fotos que subas aquí se guardarán en la nube de Render (Internet)."}
            </div>

            <header className="admin-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                    <button onClick={() => window.location.href = '/'} className="btn-volver-neon">⬅ VOLVER</button>
                    <div>
                        <h1 className="admin-title">GESTIÓN DE ACTIVOS V2.1-FIX</h1>
                        <span className="section-title" style={{ fontSize: '0.65rem', margin: 0 }}>MOTOR AUTÓNOMO V2.1 - OPTIMIZADO</span>
                    </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                    <span className="tag-badge">{fotos.length} ACTIVOS EN RED</span>
                    {(!usuario || !usuario.aprobado) && (
                        <div className="demo-banner-small" style={{ fontSize: '0.7rem', color: '#ff2d7d', marginTop: '5px' }}>
                            ⚠️ MODO DEMO: Activa en <a href="mailto:archipegv2@gmail.com" style={{color: '#ff2d7d'}}>archipegv2@gmail.com</a>
                        </div>
                    )}
                </div>
            </header>

            <main className="admin-content">
                <section className="admin-card">
                    <form onSubmit={manejarSubida}>
                        <h2 className="section-title">➕ INYECTAR NUEVOS ACTIVOS</h2>
                        <div className="form-grid">
                            <input type="text" placeholder="Título" value={titulo} onChange={(e) => setTitulo(e.target.value)} className="admin-input" />
                            <input type="number" value={anio} onChange={(e) => setAnio(e.target.value)} required className="admin-input" />
                            <input type="text" placeholder="Etiquetas" value={etiquetas} onChange={(e) => setEtiquetas(e.target.value)} className="admin-input" />
                            <input type="text" placeholder="Lugar" value={lugar} onChange={(e) => setLugar(e.target.value)} className="admin-input" />
                            <select value={albumSeleccionado} onChange={e => setAlbumSeleccionado(e.target.value)} className="admin-select">
                                <option value="">📁 SIN ÁLBUM</option>
                                {albumes.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
                            </select>
                        </div>
                        <textarea placeholder="Descripción técnica..." value={descripcion} onChange={(e) => setDescripcion(e.target.value)} className="admin-textarea" />

                        {personas.length > 0 && (
                            <div className="mini-tags-display" style={{ margin: '10px 0' }}>
                                {personas.map(p => (
                                    <button key={p.id} type="button"
                                        className={personasSeleccionadas.includes(p.id) ? "tag-badge activa" : "tag-badge"}
                                        style={{ cursor: 'pointer', background: personasSeleccionadas.includes(p.id) ? '#00ffff' : '', color: personasSeleccionadas.includes(p.id) ? '#000' : '' }}
                                        onClick={() => setPersonasSeleccionadas(prev => prev.includes(p.id) ? prev.filter(id => id !== p.id) : [...prev, p.id])}
                                    >
                                        {p.nombre}
                                    </button>
                                ))}
                            </div>
                        )}

                        <div className="file-input-wrapper" style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
                            <input id="file-upload" type="file" onChange={manejarCambioArchivos} multiple accept="image/*" />
                            <label htmlFor="file-upload" className="btn-file-morado">{labelFotos} ({archivos.length})</label>
                            
                            <input id="folder-upload" type="file" onChange={manejarCambioArchivos} webkitdirectory="" directory="" multiple accept="image/*" style={{ display: 'none' }} />
                            <label htmlFor="folder-upload" className="btn-file-morado" style={{ background: 'linear-gradient(135deg, #0088ff 0%, #00f2ff 100%)' }}>{labelCarpeta}</label>
                        </div>

                        {progreso > 0 && (
                            <div className="progreso-container-morado">
                                <div className="progreso-bar-morado" style={{ width: `${progreso}%` }}>{progreso}%</div>
                            </div>
                        )}

                        <div className="admin-controls" style={{ justifyContent: 'center', marginTop: '20px' }}>
                            <button type="button" onClick={ejecutarRescanGPS} className="btn-archipeg-action" style={{ borderColor: '#ffaa00', color: '#ffaa00' }}>
                                🛰️ RE-ESCANEAR GPS (MAPA)
                            </button>
                            <button type="button" onClick={ejecutarRescanTags} className="btn-archipeg-action" style={{ borderColor: '#00ccff', color: '#00ccff' }}>
                                🏷️ RE-ESCANEAR TAGS (IA)
                            </button>
                        </div>

                        <div style={{ display: 'flex', gap: '15px', marginTop: '15px', justifyContent: 'center', flexWrap: 'wrap' }}>
                            <button type="submit" className="btn-archipeg-main-morado" style={{ padding: '10px 30px' }}>{labelGuardar}</button>
                            <button 
                                type="button" 
                                className="btn-archipeg-main-morado" 
                                style={{ 
                                    padding: '10px 30px', 
                                    backgroundColor: (!electron && !IS_LOCAL) ? '#333' : '#cf00f1',
                                    borderColor: (!electron && !IS_LOCAL) ? '#555' : '#00ffff',
                                    color: (!electron && !IS_LOCAL) ? '#888' : '#00ffff',
                                    cursor: (!electron && !IS_LOCAL) ? 'not-allowed' : 'pointer'
                                }} 
                                onClick={ejecutarImportacionDesdeDisco}
                                disabled={!electron && !IS_LOCAL}
                            >
                                {(!electron && !IS_LOCAL) ? '🔒 IMPORTACIÓN DISCO (SÓLO PC)' : '📂 IMPORTAR DISCO DURO'}
                            </button>
                        </div>
                        {mensaje && <p className="mensaje-feedback-morado">{mensaje}</p>}
                    </form>
                </section>

                <section className="admin-card">
                    <h2 className="section-title">🔍 FILTROS MAESTRO</h2>
                    <div className="admin-controls">
                        <input type="text" placeholder="Buscar título..." value={busquedaTitulo} onChange={(e) => { setBusquedaTitulo(e.target.value); setPaginaActual(1); }} className="admin-input" />
                        <select value={busquedaMes} onChange={(e) => { setBusquedaMes(e.target.value); setPaginaActual(1); }} className="admin-select">
                            <option value="">📅 MESES</option>
                            {nombreMeses.map((mes, index) => <option key={index} value={index + 1}>{mes}</option>)}
                        </select>
                        <input 
                            type="text" 
                            placeholder="AÑO" 
                            list="admin-anios"
                            value={busquedaAnio} 
                            onChange={(e) => { setBusquedaAnio(e.target.value); setPaginaActual(1); }} 
                            className="admin-input" 
                            style={{ maxWidth: '120px' }}
                        />
                        <datalist id="admin-anios">
                            {aniosDb.map(a => <option key={a} value={a} />)}
                        </datalist>
                    </div>

                    <div className="table-responsive">
                        <table className="admin-table">
                            <thead>
                                <tr>
                                    <th>
                                        <input 
                                            type="checkbox" 
                                            checked={fotosPaginadas.length > 0 && seleccionados.size === fotosPaginadas.length} 
                                            onChange={seleccionarTodo}
                                            className="admin-checkbox-main"
                                        />
                                    </th>
                                    <th>MINI</th>
                                    <th>INFO</th>
                                    <th>FECHA</th>
                                    <th>ACCIONES</th>
                                </tr>
                            </thead>
                            <tbody>
                                {fotosPaginadas.map(foto => (
                                    <tr key={foto.id} className={seleccionados.has(foto.id) ? "row-selected" : ""}>
                                        <td>
                                            <input 
                                                type="checkbox" 
                                                checked={seleccionados.has(foto.id)} 
                                                onChange={() => manejarSeleccion(foto.id)}
                                                className="admin-checkbox"
                                            />
                                        </td>
                                        <td className="td-mini" onClick={() => setFotoEnZoom(foto)}>
                                            <img
                                                src={getFotoUrl(foto)}
                                                alt="mini"
                                                className="admin-mini-morada"
                                                onError={(e) => { e.target.src = PLACEHOLDER_IMG; }}
                                            />
                                        </td>
                                        <td className="td-info">
                                            <span className="foto-titulo">{foto.titulo || "S/T"}</span>
                                            <div className="mini-tags-display">
                                                {foto.etiquetas && foto.etiquetas.split(',').map((tag, idx) => (
                                                    <span key={idx} className="tag-badge">{tag.trim()}</span>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="td-fecha">{foto.mes || '?'}/{foto.anio}</td>
                                        <td className="td-acciones">
                                            <button onClick={() => forzarDescarga(getFotoUrl(foto), foto.titulo)} className="btn-action-icon-morado" title="Descargar">📥</button>
                                            {foto.latitud && (
                                                <button onClick={() => navigate(`/mapa?fotoId=${foto.id}`)} className="btn-action-icon-morado" title="Ver en Mapa">📍</button>
                                            )}
                                            <button onClick={() => borrarFoto(foto.id)} className="btn-action-icon-morado btn-borrar" title="Mover a Papelera">🗑️</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '15px', marginTop: '20px' }}>
                        <button disabled={paginaActual === 1} onClick={() => { setPaginaActual(p => p - 1); setSeleccionados(new Set()); }} className="btn-action-icon-morado" style={{ padding: '5px 15px' }}>◀ ANT</button>
                        
                        <span style={{ color: 'white', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1rem' }}>
                            Página 
                            <input 
                                type="number" 
                                min="1" 
                                max={totalPaginas}
                                value={inputPage} 
                                onChange={(e) => setInputPage(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        let val = parseInt(inputPage, 10);
                                        if (val >= 1 && val <= totalPaginas) setPaginaActual(val);
                                        else setInputPage(paginaActual.toString());
                                    }
                                }}
                                onBlur={() => {
                                    let val = parseInt(inputPage, 10);
                                    if (val >= 1 && val <= totalPaginas) setPaginaActual(val);
                                    else setInputPage(paginaActual.toString());
                                }}
                                className="admin-input"
                                style={{ width: '60px', padding: '5px', textAlign: 'center', appearance: 'textfield' }} 
                            />
                            de {totalPaginas}
                        </span>

                        <button disabled={paginaActual >= totalPaginas} onClick={() => { setPaginaActual(p => p + 1); }} className="btn-action-icon-morado" style={{ padding: '5px 15px' }}>SIG ▶</button>
                    </div>
                </section>

                {/* --- SECCIÓN DE MANTENIMIENTO (SÓLO ADMIN) --- */}
                {usuario?.esAdmin && (
                    <section className="admin-card" style={{ border: '2px solid #ff0044', background: 'rgba(255, 0, 68, 0.05)', textAlign: 'center' }}>
                        <h2 className="section-title" style={{ color: '#ff0044', justifyContent: 'center' }}>🛠️ ZONA DE MANTENIMIENTO</h2>
                        <p style={{ color: '#ccc', fontSize: '0.8rem', marginBottom: '15px' }}>
                            Usa estas herramientas con precaución. Son operaciones irreversibles sobre la base de datos.
                        </p>
                        <button
                            onClick={ejecutarLimpiezaTotal}
                            className="btn-archipeg-main-morado"
                            style={{ backgroundColor: '#ff0044', fontWeight: 'bold', padding: '15px 40px', fontSize: '1rem' }}
                        >
                            🚨 BORRAR TODOS MIS ACTIVOS (RESET PROPIO)
                        </button>
                    </section>
                )}

                {/* BARRA DE ACCIONES MASIVAS (FUERA DE LAS CARDS PARA EVITAR CLIPPING) */}
                {seleccionados.size > 0 && (
                    <div className="bulk-actions-bar">
                        <div className="bulk-info">
                            <span>{seleccionados.size} SELECCIONADOS</span>
                            <button className="btn-clear-selection" onClick={() => setSeleccionados(new Set())}>✕</button>
                        </div>
                        <div className="bulk-controls">
                            <div className="bulk-group">
                                <select className="admin-select" value={bulkAlbumId} onChange={e => setBulkAlbumId(e.target.value)}>
                                    <option value="">📁 ELEGIR ÁLBUM...</option>
                                    {albumes.map(a => <option key={a.id} value={a.id}>{a.nombre.toUpperCase()}</option>)}
                                </select>
                                <button className="btn-bulk-action" onClick={() => ejecutarAccionMasiva('album')}>AÑADIR A ÁLBUM</button>
                            </div>
                            <div className="bulk-divider"></div>
                            <div className="bulk-group">
                                <select className="admin-select" value={bulkEventoId} onChange={e => setBulkEventoId(e.target.value)}>
                                    <option value="">🎭 ELEGIR EVENTO...</option>
                                    {eventosParaZoom.map(ev => <option key={ev.id} value={ev.id}>{ev.nombre.toUpperCase()}</option>)}
                                </select>
                                <button className="btn-bulk-action" style={{ background: '#ff00ff' }} onClick={() => ejecutarAccionMasiva('evento')}>AÑADIR A EVENTO</button>
                            </div>
                        </div>
                    </div>
                )}
            </main>

            {fotoEnZoom && (
                <ModalZoom
                    foto={fotoEnZoom}
                    onClose={() => setFotoEnZoom(null)}
                    onNavigate={navegarZoom}
                    onBorrar={borrarFoto}
                    getFotoUrl={getFotoUrl}
                    setBusqueda={(q) => { setBusquedaTitulo(q); setPaginaActual(1); setFotoEnZoom(null); }}
                    onFavoritoToggle={(updated) => {
                        setFotos(prev => prev.map(f => f.id === updated.id ? updated : f));
                    }}
                />
            )}
        </div>
    );
};

export default AdminPanel;