import React, { useState, useEffect, useCallback } from 'react';
import ModalZoom from './ModalZoom';
import './galeria.css';

import { apiFetch } from '../api';
import { API_BASE_URL, UPLOADS_URL, FOTO_LOCAL_URL } from '../config';

const API = `${API_BASE_URL}/api`;
const URL_FOTOS = UPLOADS_URL;
const URL_FOTO_LOCAL = FOTO_LOCAL_URL;

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

const Favoritos = () => {
    const [fotos, setFotos] = useState([]);
    const [fotoZoom, setFotoZoom] = useState(null);

    // ESTADOS PARA SELECCIÓN MASIVA
    const [modoSeleccion, setModoSeleccion] = useState(false);
    const [seleccionadas, setSeleccionadas] = useState([]);

    // MODALES ASIGNACIÓN
    const [mostrarAsignarAlbum, setMostrarAsignarAlbum] = useState(false);
    const [albumesDisponibles, setAlbumesDisponibles] = useState([]);
    const [nuevoAlbumBatch, setNuevoAlbumBatch] = useState('');

    const [mostrarAsignarEvento, setMostrarAsignarEvento] = useState(false);
    const [eventosDisponibles, setEventosDisponibles] = useState([]);
    const [nuevoEventoBatch, setNuevoEventoBatch] = useState('');

    const [mostrarAsignarPersona, setMostrarAsignarPersona] = useState(false);
    const [personasDisponibles, setPersonasDisponibles] = useState([]);
    const [nuevaPersonaBatch, setNuevaPersonaBatch] = useState('');

    const cargar = useCallback(async () => {
        try {
            const res = await apiFetch(`${API}/favoritos`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            setFotos(await res.json());
        } catch (e) { console.error(e); }
    }, []);

    useEffect(() => { cargar(); }, [cargar]);

    useEffect(() => {
        if (mostrarAsignarAlbum) apiFetch(`${API}/albumes`).then(r => r.json()).then(setAlbumesDisponibles).catch(console.error);
    }, [mostrarAsignarAlbum]);

    useEffect(() => {
        if (mostrarAsignarEvento) apiFetch(`${API}/eventos`).then(r => r.json()).then(setEventosDisponibles).catch(console.error);
    }, [mostrarAsignarEvento]);

    useEffect(() => {
        if (mostrarAsignarPersona) apiFetch(`${API}/personas`).then(r => r.json()).then(setPersonasDisponibles).catch(console.error);
    }, [mostrarAsignarPersona]);

    const toggleSeleccion = (id) => {
        setSeleccionadas(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    };

    const asignarAAlbum = async (albumId) => {
        try {
            await apiFetch(`${API}/albumes/${albumId}/fotos-masivo`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fotos_ids: seleccionadas })
            });
            finalizarAccion();
        } catch (e) { console.error(e); }
    };

    const asignarAEvento = async (eventoId) => {
        try {
            await apiFetch(`${API}/eventos/${eventoId}/fotos-masivo`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fotos_ids: seleccionadas })
            });
            finalizarAccion();
        } catch (e) { console.error(e); }
    };

    const asignarAPersona = async (personaId) => {
        try {
            await apiFetch(`${API}/personas/${personaId}/fotos-masivo`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fotos_ids: seleccionadas })
            });
            finalizarAccion();
        } catch (e) { console.error(e); }
    };

    const finalizarAccion = () => {
        setMostrarAsignarAlbum(false);
        setMostrarAsignarEvento(false);
        setMostrarAsignarPersona(false);
        setSeleccionadas([]);
        setModoSeleccion(false);
    };

    const borrar = async (id) => {
        if (!window.confirm('¿Mover a la papelera?')) return;
        await apiFetch(`${API}/imagenes/${id}`, { method: 'DELETE' });
        setFotoZoom(null);
        cargar();
    };

    const navegar = (dir) => {
        if (!fotoZoom) return;
        const idx = fotos.findIndex(f => f.id === fotoZoom.id);
        const next = dir === 'siguiente' ? (idx + 1) % fotos.length : (idx - 1 + fotos.length) % fotos.length;
        setFotoZoom(fotos[next]);
    };

    return (
        <div className="galeria-layout" style={{ padding: '0 10px 20px' }}>
            <header className="galeria-header" style={{ flexWrap: 'wrap', gap: '10px' }}>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button className="btn-header-neon" onClick={() => window.history.back()}>⬅ ATRÁS</button>
                    <h1 className="galeria-titulo" style={{ fontSize: 'clamp(1.2rem, 5vw, 2rem)' }}>⭐ Favoritos</h1>
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

            {fotos.length === 0 ? (
                <div className="galeria-empty">
                    <h3>No tienes fotos favoritas todavía</h3>
                    <p style={{ fontSize: '0.82rem', color: 'var(--texto-secundario)' }}>Marca fotos con ⭐ desde la galería</p>
                </div>
            ) : (
                <div className="masonry-grid">
                    {fotos.map(foto => (
                        <div 
                            key={foto.id} 
                            className={`foto-card ${seleccionadas.includes(foto.id) ? 'seleccionada' : ''}`} 
                            onClick={() => modoSeleccion ? toggleSeleccion(foto.id) : setFotoZoom(foto)}
                        >
                            <img src={getFotoUrl(foto)} alt={foto.titulo || ''} loading="lazy" />
                            {modoSeleccion && (
                                <div className="checkbox-seleccion">
                                    {seleccionadas.includes(foto.id) ? '✅' : ''}
                                </div>
                            )}
                            <div className="foto-card-overlay">
                                <div className="foto-card-titulo">{foto.titulo || 'Sin título'}</div>
                                <div className="foto-card-meta">{foto.anio}</div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* BARRA DE ACCIONES MASIVAS */}
            {modoSeleccion && seleccionadas.length > 0 && (
                <div className="batch-action-bar">
                    <div className="batch-info">
                        <span>{seleccionadas.length} seleccionadas</span>
                        <button className="btn-batch-clear" onClick={() => setSeleccionadas([])}>✕</button>
                    </div>
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
                    </div>
                </div>
            )}

            {/* MODALES DE ASIGNACIÓN (REUTILIZADOS) */}
            {mostrarAsignarAlbum && (
                <div className="modal-overlay" onClick={() => setMostrarAsignarAlbum(false)}>
                    <div className="modal-contenido" onClick={e => e.stopPropagation()} style={{ display: 'block', padding: '30px', minWidth: '350px', backgroundColor: '#0a0a0f', border: '2px solid #7a00ff', borderRadius: '12px', color: '#fff' }}>
                        <h2 className="galeria-titulo" style={{ fontSize: '1.2rem', marginBottom: '20px', textAlign: 'center' }}>📁 ORGANIZAR FAVORITOS</h2>
                        <div style={{ maxHeight: '200px', overflowY: 'auto', marginBottom: '20px' }}>
                            {albumesDisponibles.map(a => (
                                <button key={a.id} className="btn-header-neon" style={{ display: 'block', width: '100%', marginBottom: '10px', textAlign: 'left', padding: '12px', borderColor: '#7a00ff', color: '#7a00ff' }} onClick={() => asignarAAlbum(a.id)}>
                                    📁 {a.nombre.toUpperCase()}
                                </button>
                            ))}
                        </div>
                        <div style={{ textAlign: 'center' }}>
                            <button className="btn-volver-neon" onClick={() => setMostrarAsignarAlbum(false)} style={{ borderColor: '#555', color: '#aaa' }}>✕ CANCELAR</button>
                        </div>
                    </div>
                </div>
            )}

            {mostrarAsignarEvento && (
                <div className="modal-overlay" onClick={() => setMostrarAsignarEvento(false)}>
                    <div className="modal-contenido" onClick={e => e.stopPropagation()} style={{ display: 'block', padding: '30px', minWidth: '350px', backgroundColor: '#0a0a0f', border: '2px solid #00ffff', borderRadius: '12px', color: '#fff' }}>
                        <h2 className="galeria-titulo" style={{ fontSize: '1.2rem', marginBottom: '20px', textAlign: 'center' }}>📅 VINCULAR A EVENTO</h2>
                        <div style={{ maxHeight: '200px', overflowY: 'auto', marginBottom: '20px' }}>
                            {eventosDisponibles.map(ev => (
                                <button key={ev.id} className="btn-header-neon" style={{ display: 'block', width: '100%', marginBottom: '10px', textAlign: 'left', padding: '12px', borderColor: '#00ffff', color: '#00ffff' }} onClick={() => asignarAEvento(ev.id)}>
                                    📅 {ev.nombre.toUpperCase()}
                                </button>
                            ))}
                        </div>
                        <div style={{ textAlign: 'center' }}>
                            <button className="btn-volver-neon" onClick={() => setMostrarAsignarEvento(false)} style={{ borderColor: '#555', color: '#aaa' }}>✕ CANCELAR</button>
                        </div>
                    </div>
                </div>
            )}

            {mostrarAsignarPersona && (
                <div className="modal-overlay" onClick={() => setMostrarAsignarPersona(false)}>
                    <div className="modal-contenido" onClick={e => e.stopPropagation()} style={{ display: 'block', padding: '30px', minWidth: '350px', backgroundColor: '#0a0a0f', border: '2px solid #ffcc00', borderRadius: '12px', color: '#fff' }}>
                        <h2 className="galeria-titulo" style={{ fontSize: '1.2rem', marginBottom: '20px', textAlign: 'center' }}>👤 VINCULAR A PERSONA</h2>
                        <div style={{ maxHeight: '200px', overflowY: 'auto', marginBottom: '20px' }}>
                            {personasDisponibles.map(p => (
                                <button key={p.id} className="btn-header-neon" style={{ display: 'block', width: '100%', marginBottom: '10px', textAlign: 'left', padding: '12px', borderColor: '#ffcc00', color: '#ffcc00' }} onClick={() => asignarAPersona(p.id)}>
                                    👤 {p.nombre.toUpperCase()}
                                </button>
                            ))}
                        </div>
                        <div style={{ textAlign: 'center' }}>
                            <button className="btn-volver-neon" onClick={() => setMostrarAsignarPersona(false)} style={{ borderColor: '#555', color: '#aaa' }}>✕ CANCELAR</button>
                        </div>
                    </div>
                </div>
            )}

            {fotoZoom && (
                <ModalZoom
                    foto={fotoZoom}
                    onClose={() => setFotoZoom(null)}
                    onNavigate={navegar}
                    onBorrar={borrar}
                    getFotoUrl={getFotoUrl}
                    setBusqueda={() => {}}
                    onFavoritoToggle={(f) => setFotos(prev => f.favorito ? prev.map(x => x.id === f.id ? f : x) : prev.filter(x => x.id !== f.id))}
                />
            )}
        </div>
    );
};

export default Favoritos;
