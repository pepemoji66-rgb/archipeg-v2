import React, { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { apiFetch } from '../api';
import ModalZoom from './ModalZoom';
import './galeria.css';
import { API_BASE_URL, UPLOADS_URL, FOTO_LOCAL_URL } from '../config';

const API = `${API_BASE_URL}/api`;
const URL_FOTOS = UPLOADS_URL;
const URL_FOTO_LOCAL = FOTO_LOCAL_URL;
const IS_LOCAL = window.location.hostname === 'localhost';

const esRutaAbsoluta = (url) =>
    /^[A-Za-z]:[\\\/]/.test(url) || url.startsWith('/');

const getFotoUrl = (foto) => {
    if (!foto?.imagen_url) return '';
    const url = foto.imagen_url.trim();
    if (esRutaAbsoluta(url)) {
        return URL_FOTO_LOCAL + encodeURIComponent(url);
    }
    return URL_FOTOS + url.replace(/ /g, '%20').replace(/\\/g, '/');
};

const esVideo = (url) => {
    if (!url) return false;
    const ext = url.split('.').pop().toLowerCase();
    return ['mp4', 'mov', 'avi', 'mkv', 'webm', '3gp'].includes(ext);
};

const normalizar = (str) =>
    str?.toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() || '';

const Galeria = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const params = new URLSearchParams(location.search);
    const qInicial = params.get('q') || '';
    const anioInicial = params.get('anio') || '';
    const mesInicial = params.get('mes') || '';
    const fotoIdUrl = params.get('fotoId');
    const pUrl = params.get('p') || '1';

    const [fotos, setFotos] = useState([]);
    const [busqueda, setBusqueda] = useState(qInicial);
    const [busquedaMes, setBusquedaMes] = useState(mesInicial);
    const [busquedaAnio, setBusquedaAnio] = useState(anioInicial);
    
    // Estados intermedios (borradores) para no filtrar hasta no darle a Aceptar
    const [draftBusqueda, setDraftBusqueda] = useState(qInicial);
    const [draftBusquedaMes, setDraftBusquedaMes] = useState(mesInicial);
    const [draftBusquedaAnio, setDraftBusquedaAnio] = useState(anioInicial);
    
    const [aniosDb, setAniosDb] = useState([]);

    const [paginaActual, setPaginaActual] = useState(parseInt(pUrl) || 1);
    const [saltoInput, setSaltoInput] = useState('');
    const [seleccionadas, setSeleccionadas] = useState([]);
    const [modoSeleccion, setModoSeleccion] = useState(false);
    const [fotoZoom, setFotoZoom] = useState(null);
    const [rutaImport, setRutaImport] = useState('');
    const [importando, setImportando] = useState(false);
    const [resultadoImport, setResultadoImport] = useState(null);

    // Nuevos estados para asignar a álbum
    const [mostrarAsignarAlbum, setMostrarAsignarAlbum] = useState(false);
    const [albumesDisponibles, setAlbumesDisponibles] = useState([]);
    const [nuevoAlbumBatch, setNuevoAlbumBatch] = useState('');
    const [nuevoAlbumBatchPrivado, setNuevoAlbumBatchPrivado] = useState(false);

    // Nuevos estados para asignar a evento
    const [mostrarAsignarEvento, setMostrarAsignarEvento] = useState(false);
    const [eventosDisponibles, setEventosDisponibles] = useState([]);
    const [nuevoEventoBatch, setNuevoEventoBatch] = useState('');

    // Nuevos estados para asignar a persona
    const [mostrarAsignarPersona, setMostrarAsignarPersona] = useState(false);
    const [personasDisponibles, setPersonasDisponibles] = useState([]);
    const [nuevaPersonaBatch, setNuevaPersonaBatch] = useState('');

    const [soloFavoritos, setSoloFavoritos] = useState(false);

    const fotosPorPagina = 15;

    // Sincronizar la URL con la página actual
    useEffect(() => {
        const p = params.get('p');
        if (p !== String(paginaActual)) {
            params.set('p', paginaActual);
            navigate({ search: params.toString() }, { replace: true });
        }
    }, [paginaActual, navigate, params]);

    const fotosFiltradas = React.useMemo(() => {
        return fotos.filter(f => {
            const bq = normalizar(busqueda).trim();
            const matchTexto = !bq || [f.titulo, f.anio, f.descripcion, f.etiquetas, f.lugar].some(c => normalizar(c).includes(bq));
            const matchMes = !busquedaMes || f.mes?.toString() === busquedaMes;
            
            const bAnioStr = busquedaAnio ? busquedaAnio.toString() : "";
            const rutaNorm = (f.imagen_url || "").replace(/\\/g, "/").toLowerCase();
            const matchAnio = !bAnioStr || f.anio?.toString() === bAnioStr || rutaNorm.includes(bAnioStr);
            
            const matchFavorito = !soloFavoritos || f.favorito === 1;

            return matchTexto && matchMes && matchAnio && matchFavorito;
        });
    }, [fotos, busqueda, busquedaMes, busquedaAnio, soloFavoritos]);

    const totalPaginas = Math.ceil(fotosFiltradas.length / fotosPorPagina);
    const fotosPaginadas = fotosFiltradas.slice((paginaActual - 1) * fotosPorPagina, paginaActual * fotosPorPagina);

    const cargar = useCallback(async () => {
        try {
            const [resFotos, resAnios] = await Promise.all([
                apiFetch(`${API}/imagenes`),
                apiFetch(`${API}/anios`)
            ]);
            
            if (resFotos.ok) {
                const data = await resFotos.json();
                setFotos(Array.isArray(data) ? data : []);
            }
            if (resAnios.ok) {
                const anios = await resAnios.json();
                setAniosDb(anios.map(a => a.anio).filter(Boolean));
            }
        } catch (e) { console.error(e); }
    }, []);

    const seleccionarCarpeta = async () => {
        try {
            let ruta = null;
            if (window.ipcRenderer) {
                ruta = await window.ipcRenderer.invoke('seleccionar-carpeta');
            } else {
                const res = await apiFetch(`${API}/seleccionar-carpeta`);
                const data = await res.json();
                ruta = data.ruta;
            }
            if (ruta) {
                setRutaImport(ruta);
                setResultadoImport(null);
            }
        } catch (e) {
            console.error('Error seleccionando carpeta:', e);
        }
    };

    const importarMasivo = async () => {
        if (!rutaImport) return;
        setImportando(true);
        setResultadoImport(null);
        try {
            const res = await apiFetch(`${API}/importar-masivo`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ruta: rutaImport })
            });
            const data = await res.json();
            if (res.ok) {
                setResultadoImport(data);
                await cargar();
            } else {
                setResultadoImport({ error: data.error });
            }
        } catch (_) {
            setResultadoImport({ error: 'Error de conexión' });
        } finally {
            setImportando(false);
        }
    };

    useEffect(() => {
        if (mostrarAsignarAlbum) {
            apiFetch(`${API}/albumes`).then(r => r.json()).then(setAlbumesDisponibles).catch(console.error);
        }
    }, [mostrarAsignarAlbum]);

    const asignarAAlbum = async (albumId) => {
        try {
            await apiFetch(`${API}/albumes/${albumId}/fotos-masivo`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fotos_ids: seleccionadas })
            });
            setMostrarAsignarAlbum(false);
            setSeleccionadas([]);
            setModoSeleccion(false);
            cargar(); // Refrescar porque si se asigna a uno privado, desaparecen de aquí
        } catch (e) {
            console.error(e);
        }
    };

    useEffect(() => {
        if (mostrarAsignarEvento) {
            apiFetch(`${API}/eventos`).then(r => r.json()).then(setEventosDisponibles).catch(console.error);
        }
    }, [mostrarAsignarEvento]);

    const asignarAEvento = async (eventoId) => {
        try {
            await apiFetch(`${API}/eventos/${eventoId}/fotos-masivo`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fotos_ids: seleccionadas })
            });
            setMostrarAsignarEvento(false);
            setSeleccionadas([]);
            setModoSeleccion(false);
        } catch (e) {
            console.error(e);
        }
    };

    useEffect(() => {
        if (mostrarAsignarPersona) {
            apiFetch(`${API}/personas`).then(r => r.json()).then(setPersonasDisponibles).catch(console.error);
        }
    }, [mostrarAsignarPersona]);

    const asignarAPersona = async (personaId) => {
        try {
            await apiFetch(`${API}/personas/${personaId}/fotos-masivo`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fotos_ids: seleccionadas })
            });
            setMostrarAsignarPersona(false);
            setSeleccionadas([]);
            setModoSeleccion(false);
        } catch (e) {
            console.error(e);
        }
    };

    const crearAlbumYAsignar = async () => {
        if (!nuevoAlbumBatch.trim()) return;
        try {
            const res = await apiFetch(`${API}/albumes`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nombre: nuevoAlbumBatch.trim(), privado: nuevoAlbumBatchPrivado })
            });
            const nuevo = await res.json();
            // Actualizar lista local de álbumes disponibles
            setAlbumesDisponibles(prev => {
                if (prev.some(a => a.id === nuevo.id)) return prev;
                return [nuevo, ...prev];
            });
            await asignarAAlbum(nuevo.id);
            setNuevoAlbumBatch('');
            setNuevoAlbumBatchPrivado(false);
            // asignarAAlbum ya llama a cargar(), que ocultará las fotos si era privado.
        } catch (e) { console.error(e); }
    };

    const crearEventoYAsignar = async () => {
        if (!nuevoEventoBatch.trim()) return;
        try {
            const res = await apiFetch(`${API}/eventos`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nombre: nuevoEventoBatch.trim() })
            });
            const nuevo = await res.json();
            // Actualizar lista local de eventos disponibles
            setEventosDisponibles(prev => {
                if (prev.some(e => e.id === nuevo.id)) return prev;
                return [nuevo, ...prev];
            });
            await asignarAEvento(nuevo.id);
            setNuevoEventoBatch('');
        } catch (e) {
            console.error(e);
        }
    };

    const crearPersonaYAsignar = async () => {
        if (!nuevaPersonaBatch.trim()) return;
        try {
            const res = await apiFetch(`${API}/personas`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nombre: nuevaPersonaBatch.trim() })
            });
            const nuevo = await res.json();
            // Actualizar lista local
            setPersonasDisponibles(prev => {
                if (prev.some(p => p.id === nuevo.id)) return prev;
                return [nuevo, ...prev];
            });
            await asignarAPersona(nuevo.id);
            setNuevaPersonaBatch('');
        } catch (e) {
            console.error(e);
        }
    };

    const navegarFoto = (direccion) => {
        const idx = fotosFiltradas.findIndex(f => f.id === fotoZoom?.id);
        if (idx === -1) return;
        if (direccion === 'siguiente' && idx < fotosFiltradas.length - 1) setFotoZoom(fotosFiltradas[idx + 1]);
        else if (direccion === 'anterior' && idx > 0) setFotoZoom(fotosFiltradas[idx - 1]);
    };

    const manejarClicFoto = (foto) => {
        if (modoSeleccion) {
            setSeleccionadas(prev =>
                prev.includes(foto.id)
                    ? prev.filter(id => id !== foto.id)
                    : [...prev, foto.id]
            );
        } else {
            setFotoZoom(foto);
        }
    };

    const borrarFoto = async (id) => {
        if (!window.confirm('¿Mover esta foto a la papelera?')) return;
        try {
            await apiFetch(`${API}/imagenes/${id}`, { method: 'DELETE' });
            setFotoZoom(null);
            await cargar();
        } catch (e) { console.error(e); }
    };

    useEffect(() => {
        if (fotoIdUrl && (!fotoZoom || String(fotoZoom.id) !== String(fotoIdUrl))) {
            apiFetch(`${API}/fotos/${fotoIdUrl}`)
                .then(r => r.json())
                .then(f => {
                    if (f && f.id) {
                        setFotoZoom(f);
                        setModoSeleccion(false);
                    }
                })
                .catch(err => console.error("Error en túnel VIP:", err));
        }
    }, [fotoIdUrl]);

    useEffect(() => {
        cargar(); 
    }, [cargar]);

    useEffect(() => {
        if (fotoIdUrl && fotos.length > 0 && fotoZoom) {
            const idx = fotosFiltradas.findIndex(x => x.id === fotoZoom.id);
            if (idx !== -1) {
                const pag = Math.floor(idx / fotosPorPagina) + 1;
                if (pag !== paginaActual) setPaginaActual(pag);
            }
        }
    }, [fotos, fotoZoom, fotoIdUrl, fotosFiltradas, paginaActual]);

    // FUNCIÓN DE DESCARGA MAESTRA (Forzada por Blob)
    const descargarSeleccionadas = async () => {
        console.log("Iniciando descarga de:", seleccionadas);

        for (const id of seleccionadas) {
            const foto = fotos.find(f => f.id === id);
            if (!foto) continue;

            try {
                const url = getFotoUrl(foto);
                const respuesta = await fetch(url);
                const blob = await respuesta.blob();
                const urlBlob = window.URL.createObjectURL(blob);

                const link = document.createElement('a');
                link.href = urlBlob;
                link.download = foto.imagen_url.split('/').pop() || `archipeg_${id}.jpg`;

                document.body.appendChild(link);
                link.click();

                // Limpieza
                document.body.removeChild(link);
                window.URL.revokeObjectURL(urlBlob);

                // Delay para no saturar el stack de descargas del navegador
                await new Promise(r => setTimeout(r, 300));
            } catch (err) {
                console.error("Error al descargar la foto:", id, err);
            }
        }
    };

    const borrarSeleccionadas = async () => {
        if (!window.confirm(`¿Mover ${seleccionadas.length} fotos a la papelera?`)) return;
        try {
            await Promise.all(
                seleccionadas.map(id => apiFetch(`${API}/imagenes/${id}`, { method: 'DELETE' }))
            );
            setSeleccionadas([]);
            setModoSeleccion(false);
            cargar();
        } catch (e) { console.error(e); }
    };

    const toggleFavorito = async (e, foto) => {
        e.stopPropagation();
        try {
            const res = await apiFetch(`${API}/fotos/${foto.id}/favorito`, { method: 'PATCH' });
            const { favorito } = await res.json();
            setFotos(prev => prev.map(f => f.id === foto.id ? { ...f, favorito } : f));
        } catch (e) { console.error(e); }
    };

    const ejecutarSalto = (e) => {
        if (e.key === 'Enter') {
            const num = parseInt(saltoInput);
            if (num > 0 && num <= totalPaginas) {
                setPaginaActual(num);
                setSaltoInput('');
            }
        }
    };

    const aplicarFiltros = () => {
        setBusqueda(draftBusqueda);
        setBusquedaAnio(draftBusquedaAnio);
        setBusquedaMes(draftBusquedaMes);
        setPaginaActual(1);
    };

    const limpiarFiltros = () => {
        setDraftBusqueda('');
        setDraftBusquedaAnio('');
        setDraftBusquedaMes('');
        setBusqueda('');
        setBusquedaAnio('');
        setBusquedaMes('');
        setSoloFavoritos(false);
        setPaginaActual(1);
    };

    return (
        <div className="galeria-layout">
            <header className="galeria-header">
                <button className="btn-header-neon" onClick={() => navigate('/')}>🏠 INICIO</button>
                <h1 className="galeria-titulo">ARCHIVO FOTOGRÁFICO</h1>

                <div className="galeria-filtros" style={{display: 'flex', gap: '10px', alignItems: 'center'}}>
                    <button 
                        className={`btn-header-neon ${soloFavoritos ? 'btn-active-fucsia' : ''}`} 
                        onClick={() => { setSoloFavoritos(!soloFavoritos); setPaginaActual(1); }}
                        title="Ver solo favoritos"
                        style={{ fontSize: '1.2rem', padding: '5px 12px', borderColor: soloFavoritos ? 'var(--fucsia-neon)' : 'var(--oro-neon)', color: soloFavoritos ? '#fff' : 'var(--oro-neon)' }}
                    >
                        {soloFavoritos ? '⭐' : '☆'}
                    </button>
                    <input
                        type="text"
                        className="input-neon"
                        placeholder="Buscar..."
                        value={draftBusqueda}
                        onChange={e => setDraftBusqueda(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && aplicarFiltros()}
                    />
                    <input
                        type="text"
                        className="input-neon"
                        style={{ width: '100px' }}
                        placeholder="AÑO"
                        list="galeria-anios"
                        value={draftBusquedaAnio}
                        onChange={(e) => setDraftBusquedaAnio(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && aplicarFiltros()}
                        aria-label="Filtrar por año"
                    />
                    <datalist id="galeria-anios">
                        {aniosDb.map(a => <option key={a} value={a} />)}
                    </datalist>
                    <select
                        className="select-neon"
                        value={draftBusquedaMes}
                        onChange={(e) => setDraftBusquedaMes(e.target.value)}
                        aria-label="Filtrar por mes"
                    >
                        <option value="">MES</option>
                        {Array.from({ length: 12 }).map((_, i) => (
                            <option key={i + 1} value={String(i + 1)}>{String(i + 1).padStart(2, '0')}</option>
                        ))}
                    </select>

                    <button
                        type="button"
                        className="btn-header-neon"
                        onClick={aplicarFiltros}
                        title="Ejecutar búsqueda"
                    >
                        🔍 BUSCAR
                    </button>

                    {(busqueda || busquedaAnio || busquedaMes) && (
                        <button
                            type="button"
                            className="btn-header-neon btn-fucsia-neon"
                            onClick={limpiarFiltros}
                            title="Limpiar filtros"
                        >
                            LIMPIAR
                        </button>
                    )}
                </div>

                <div className="galeria-acciones">
                    <button
                        className={`btn-header-neon ${modoSeleccion ? 'btn-active-fucsia' : ''}`}
                        onClick={() => { setModoSeleccion(!modoSeleccion); setSeleccionadas([]); }}
                    >
                        {modoSeleccion ? '❌ CANCELAR' : '🔍 SELECCIONAR'}
                    </button>
                </div>
            </header>

            {/* BARRA DE HERRAMIENTAS SELECCIÓN */}
            <div className={`batch-action-bar ${modoSeleccion && seleccionadas.length > 0 ? 'active' : ''}`}>
                <span className="batch-info">{seleccionadas.length} ITEMS SELECCIONADOS</span>
                <div className="batch-buttons">
                    <button className="btn-batch btn-action-icon-morado" style={{ border: '1px solid #7a00ff', color: '#7a00ff' }} onClick={() => setMostrarAsignarAlbum(true)}>
                        📁 AÑADIR A ÁLBUM
                    </button>
                    <button className="btn-batch btn-action-icon-morado" style={{ border: '1px solid #00ffff', color: '#00ffff' }} onClick={() => setMostrarAsignarEvento(true)}>
                        📅 AÑADIR A EVENTO
                    </button>
                    <button className="btn-batch btn-action-icon-morado" style={{ border: '1px solid #ffcc00', color: '#ffcc00' }} onClick={() => setMostrarAsignarPersona(true)}>
                        👤 AÑADIR A PERSONA
                    </button>
                    <button className="btn-batch btn-download" onClick={descargarSeleccionadas}>
                        📥 DESCARGAR
                    </button>
                    <button className="btn-batch btn-delete" onClick={borrarSeleccionadas}>
                        🗑️ BORRAR
                    </button>
                </div>
            </div>

            {/* BARRA DE IMPORTACIÓN MASIVA - SOLO EN LOCAL */}
            {IS_LOCAL && (
                <div className="import-bar">
                    <button className="btn-import" onClick={seleccionarCarpeta} disabled={importando}>
                        📂 SELECCIONAR DISCO/CARPETA
                    </button>
                    {rutaImport && (
                        <span className="import-ruta" title={rutaImport}>{rutaImport}</span>
                    )}
                    {rutaImport && (
                        <button
                            className="btn-import btn-import-action"
                            onClick={importarMasivo}
                            disabled={importando}
                        >
                            {importando ? '⏳ Importando...' : '⚡ IMPORTAR TODAS'}
                        </button>
                    )}
                    {resultadoImport && !resultadoImport.error && (
                        <span className="import-resultado">
                            ✅ {resultadoImport.importadas} importadas · {resultadoImport.actualizadas} actualizadas · {resultadoImport.ignoradas} ignoradas
                        </span>
                    )}
                    {resultadoImport?.error && (
                        <span className="import-error">❌ {resultadoImport.error}</span>
                    )}
                </div>
            )}

            <main className="masonry-grid">
                {fotosPaginadas.map(foto => {
                    const isSelected = seleccionadas.includes(foto.id);
                    return (
                        <div
                            key={foto.id}
                            className={`foto-card ${isSelected ? 'foto-card-seleccionada' : ''}`}
                            onClick={() => manejarClicFoto(foto)}
                        >
                            {esVideo(foto.imagen_url) ? (
                                <video 
                                    src={getFotoUrl(foto)} 
                                    className="foto-galeria-img video-thumb"
                                    muted
                                    preload="metadata"
                                    onLoadedMetadata={e => e.target.currentTime = 0.5} // Pequeño truco para forzar el frame
                                    onMouseOver={e => e.currentTarget.play()}
                                    onMouseOut={e => { e.currentTarget.pause(); e.currentTarget.currentTime = 0.5; }}
                                />
                            ) : (
                                <img 
                                    src={getFotoUrl(foto)} 
                                    className="foto-galeria-img" 
                                    alt={foto.titulo} 
                                    loading="lazy" 
                                />
                            )}
                            
                            {esVideo(foto.imagen_url) && (
                                <div className="video-badge">▶ VÍDEO</div>
                            )}

                            {/* Checkmark Neón */}
                            {modoSeleccion && (
                                <div className={`select-badge ${isSelected ? 'selected' : ''}`}>
                                    {isSelected ? '✓' : ''}
                                </div>
                            )}

                            {!modoSeleccion && (
                                <div className="foto-card-actions">
                                    <button className="foto-card-fav" onClick={e => toggleFavorito(e, foto)} title={foto.favorito ? "Quitar de favoritos" : "Añadir a favoritos"}>
                                        {foto.favorito ? '⭐' : '☆'}
                                    </button>
                                    {foto.latitud && (
                                        <button className="foto-card-map" onClick={e => { e.stopPropagation(); navigate(`/mapa?fotoId=${foto.id}`); }} title="Ver en Mapa">
                                            📍
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </main>

            <footer className="footer-paginacion">
                <div className="paginacion-controles">
                    <button className="btn-pagi-flecha" disabled={paginaActual === 1} onClick={() => setPaginaActual(p => p - 1)}>« ANTERIOR</button>
                    <div className="pagi-salto-zona">
                        <span className="pagi-info">PÁGINA {paginaActual} DE {totalPaginas}</span>
                        <div className="input-salto-wrapper">
                            <input
                                type="text"
                                inputMode="numeric"
                                className="input-salto-neon"
                                value={saltoInput}
                                onChange={e => setSaltoInput(e.target.value.replace(/\D/g, ''))}
                                 onKeyDown={ejecutarSalto}
                                placeholder="..."
                            />
                            <button className="btn-ir-pagi" onClick={() => ejecutarSalto({ key: 'Enter' })}>IR</button>
                        </div>
                    </div>
                    <button className="btn-pagi-flecha" disabled={paginaActual === totalPaginas} onClick={() => setPaginaActual(p => p + 1)}>SIGUIENTE »</button>
                </div>
            </footer>

            {fotoZoom && !modoSeleccion && (
                <ModalZoom
                    foto={fotoZoom}
                    onClose={() => setFotoZoom(null)}
                    onNavigate={navegarFoto}
                    onBorrar={borrarFoto}
                    getFotoUrl={getFotoUrl}
                    setBusqueda={setBusqueda}
                    onFavoritoToggle={(fAct) => setFotos(prev => prev.map(f => f.id === fAct.id ? fAct : f))}
                />
            )}

            {/* MODAL ASIGNAR A ÁLBUM */}
            {mostrarAsignarAlbum && (
                <div className="modal-overlay" onClick={() => setMostrarAsignarAlbum(false)}>
                    <div className="modal-contenido" onClick={e => e.stopPropagation()} style={{ display: 'block', padding: '30px', minWidth: '380px', maxWidth: '450px', backgroundColor: '#0a0a0f', border: '2px solid var(--acento-turquesa)', borderRadius: '12px', boxShadow: '0 0 20px rgba(0,242,255,0.4)', color: '#fff' }}>
                        <h2 className="galeria-titulo" style={{ fontSize: '1.2rem', marginBottom: '20px', textAlign: 'center' }}>📂 AÑADIR A ÁLBUM</h2>
                        <p style={{ textAlign: 'center', marginBottom: '20px', color: '#aaa', fontSize: '0.9rem' }}>Vas a mover {seleccionadas.length} foto(s)</p>
                        
                        <div style={{ maxHeight: '200px', overflowY: 'auto', marginBottom: '20px' }}>
                            {albumesDisponibles.map(a => (
                                <button key={a.id} className="btn-header-neon" style={{ display: 'block', width: '100%', marginBottom: '10px', textAlign: 'left', padding: '12px' }} onClick={() => asignarAAlbum(a.id)}>
                                    {a.privado ? '🔒 ' : '📁 '} {a.nombre.toUpperCase()}
                                </button>
                            ))}
                            {albumesDisponibles.length === 0 && <p style={{ color: '#aaa', fontSize: '0.9rem', textAlign: 'center', padding: '20px' }}>No tienes álbumes creados</p>}
                        </div>

                        <div style={{ borderTop: '1px solid #333', paddingTop: '20px' }}>
                            <h3 style={{ fontSize: '0.9rem', color:  'var(--acento-turquesa)' , marginBottom: '15px' }}>O crear uno nuevo:</h3>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '10px' }}>
                                <input className="input-neon" value={nuevoAlbumBatch} onChange={e => setNuevoAlbumBatch(e.target.value)} placeholder="Nombre del nuevo álbum..." style={{ flex: 1 }} />
                                <button 
                                    className="btn-volver-neon" 
                                    onClick={() => setNuevoAlbumBatchPrivado(!nuevoAlbumBatchPrivado)} 
                                    title={nuevoAlbumBatchPrivado ? "Será Privado" : "Hacer Privado"} 
                                    style={{ 
                                        border: `1px solid ${nuevoAlbumBatchPrivado ? '#ff2d7d' :  'var(--acento-turquesa)' }`, 
                                        color: nuevoAlbumBatchPrivado ? '#ff2d7d' :  'var(--acento-turquesa)' ,
                                        boxShadow: nuevoAlbumBatchPrivado ? '0 0 10px #ff2d7d' : 'none'
                                    }}
                                >
                                    {nuevoAlbumBatchPrivado ? '🔒' : '🔓'}
                                </button>
                                <button className="btn-volver-neon" onClick={crearAlbumYAsignar} style={{ color:  'var(--acento-turquesa)' , borderColor:  'var(--acento-turquesa)'  }}>+</button>
                            </div>
                        </div>

                        <div style={{ textAlign: 'center', marginTop: '25px' }}>
                            <button className="btn-volver-neon" onClick={() => setMostrarAsignarAlbum(false)} style={{ borderColor: '#555', color: '#aaa' }}>✕ CANCELAR</button>
                        </div>
                    </div>
                </div>
            )}
            {/* MODAL ASIGNAR A EVENTO */}
            {mostrarAsignarEvento && (
                <div className="modal-overlay" onClick={() => setMostrarAsignarEvento(false)}>
                    <div className="modal-contenido" onClick={e => e.stopPropagation()} style={{ display: 'block', padding: '30px', minWidth: '380px', maxWidth: '450px', backgroundColor: '#0a0a0f', border: '2px solid var(--acento-turquesa)', borderRadius: '12px', boxShadow: '0 0 20px rgba(0,242,255,0.4)', color: '#fff' }}>
                        <h2 className="galeria-titulo" style={{ fontSize: '1.2rem', marginBottom: '20px', textAlign: 'center' }}>📅 AÑADIR A EVENTO</h2>
                        <p style={{ textAlign: 'center', marginBottom: '20px', color: '#aaa', fontSize: '0.9rem' }}>Vas a asignar {seleccionadas.length} foto(s)</p>
                        
                        <div style={{ maxHeight: '200px', overflowY: 'auto', marginBottom: '20px' }}>
                            {eventosDisponibles.map(a => (
                                <button key={a.id} className="btn-header-neon" style={{ display: 'block', width: '100%', marginBottom: '10px', textAlign: 'left', padding: '12px' }} onClick={() => asignarAEvento(a.id)}>
                                    📅 {a.nombre.toUpperCase()} {a.fecha_inicio ? `(${a.fecha_inicio})` : ''}
                                </button>
                            ))}
                            {eventosDisponibles.length === 0 && <p style={{ color: '#aaa', fontSize: '0.9rem', textAlign: 'center', padding: '20px' }}>No tienes eventos creados</p>}
                        </div>

                        <div style={{ borderTop: '1px solid #333', paddingTop: '20px' }}>
                            <h3 style={{ fontSize: '0.9rem', color:  'var(--acento-turquesa)' , marginBottom: '15px' }}>O crear uno nuevo:</h3>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '10px' }}>
                                <input className="input-neon" value={nuevoEventoBatch} onChange={e => setNuevoEventoBatch(e.target.value)} placeholder="Nombre del evento (fechas luego en su gestor)" style={{ flex: 1 }} />
                                <button className="btn-volver-neon" onClick={crearEventoYAsignar} style={{ color:  'var(--acento-turquesa)' , borderColor:  'var(--acento-turquesa)'  }}>+</button>
                            </div>
                        </div>

                        <div style={{ textAlign: 'center', marginTop: '25px' }}>
                            <button className="btn-volver-neon" onClick={() => setMostrarAsignarEvento(false)} style={{ borderColor: '#555', color: '#aaa' }}>✕ CANCELAR</button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL ASIGNAR A PERSONA */}
            {mostrarAsignarPersona && (
                <div className="modal-overlay" onClick={() => setMostrarAsignarPersona(false)}>
                    <div className="modal-contenido" onClick={e => e.stopPropagation()} style={{ display: 'block', padding: '30px', minWidth: '380px', maxWidth: '450px', backgroundColor: '#0a0a0f', border: '2px solid #ffcc00', borderRadius: '12px', boxShadow: '0 0 20px rgba(255,204,0,0.4)', color: '#fff' }}>
                        <h2 className="galeria-titulo" style={{ fontSize: '1.2rem', marginBottom: '20px', textAlign: 'center' }}>👤 VINCULAR PERSONA</h2>
                        <p style={{ textAlign: 'center', marginBottom: '20px', color: '#aaa', fontSize: '0.9rem' }}>Vas a identificar {seleccionadas.length} foto(s)</p>
                        
                        <div style={{ maxHeight: '200px', overflowY: 'auto', marginBottom: '20px' }}>
                            {personasDisponibles.map(p => (
                                <button key={p.id} className="btn-header-neon" style={{ display: 'block', width: '100%', marginBottom: '10px', textAlign: 'left', padding: '12px', borderColor: '#ffcc00', color: '#ffcc00' }} onClick={() => asignarAPersona(p.id)}>
                                    👤 {p.nombre.toUpperCase()}
                                </button>
                            ))}
                            {personasDisponibles.length === 0 && <p style={{ color: '#aaa', fontSize: '0.9rem', textAlign: 'center', padding: '20px' }}>No hay sujetos registrados</p>}
                        </div>

                        <div style={{ borderTop: '1px solid #333', paddingTop: '20px' }}>
                            <h3 style={{ fontSize: '0.9rem', color: '#ffcc00', marginBottom: '15px' }}>O registrar nuevo sujeto:</h3>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '10px' }}>
                                <input className="input-neon" value={nuevaPersonaBatch} onChange={e => setNuevaPersonaBatch(e.target.value)} placeholder="Nombre completo..." style={{ flex: 1, borderColor: '#ffcc00' }} />
                                <button className="btn-volver-neon" onClick={crearPersonaYAsignar} style={{ color: '#ffcc00', borderColor: '#ffcc00' }}>+</button>
                            </div>
                        </div>

                        <div style={{ textAlign: 'center', marginTop: '25px' }}>
                            <button className="btn-volver-neon" onClick={() => setMostrarAsignarPersona(false)} style={{ borderColor: '#555', color: '#aaa' }}>✕ CANCELAR</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Galeria;
