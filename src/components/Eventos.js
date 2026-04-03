import React, { useState, useEffect, useCallback } from 'react';
import ModalZoom from './ModalZoom';
import './admin.css'; // Usamos el CSS del admin para la consistencia neón

import { apiFetch } from '../api';

import { API_BASE_URL, UPLOADS_URL, FOTO_LOCAL_URL } from '../config';

const API = `${API_BASE_URL}/api`;
const URL_FOTOS = UPLOADS_URL;
const URL_FOTO_LOCAL = FOTO_LOCAL_URL;

const esRutaAbsoluta = (url) =>
    /^[A-Za-z]:[\\\/]/.test(url) || String(url || '').startsWith('/');

const getFotoUrl = (foto) => {
    if (!foto?.imagen_url) return '';
    const url = String(foto.imagen_url).trim();
    if (esRutaAbsoluta(url)) {
        return URL_FOTO_LOCAL + encodeURIComponent(url);
    }
    return URL_FOTOS + url.replace(/ /g, '%20').replace(/\\/g, '/');
};

const Eventos = () => {
    const [eventos, setEventos] = useState([]);
    const [eventoActivo, setEventoActivo] = useState(null);
    const [fotosEvento, setFotosEvento] = useState([]);
    const [fotoZoom, setFotoZoom] = useState(null);
    const [creando, setCreando] = useState(false);
    const [form, setForm] = useState({ nombre: '', fecha_inicio: '', fecha_fin: '', descripcion: '' });

    const cargar = useCallback(async () => {
        try {
            const res = await apiFetch(`${API}/eventos`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            setEventos(await res.json());
        } catch (e) { console.error(e); }
    }, []);

    useEffect(() => { cargar(); }, [cargar]);

    const abrirEvento = async (ev) => {
        setEventoActivo(ev);
        const res = await apiFetch(`${API}/eventos/${ev.id}/fotos`);
        setFotosEvento(await res.json());
    };

    const crear = async (e) => {
        e.preventDefault();
        if (!form.nombre.trim()) return;
        await apiFetch(`${API}/eventos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(form)
        });
        setForm({ nombre: '', fecha_inicio: '', fecha_fin: '', descripcion: '' });
        setCreando(false);
        cargar();
    };

    const eliminar = async (id) => {
        if (!window.confirm('¿ELIMINAR ESTE EVENTO?')) return;
        await apiFetch(`${API}/eventos/${id}`, { method: 'DELETE' });
        if (eventoActivo?.id === id) { setEventoActivo(null); setFotosEvento([]); }
        cargar();
    };

    const autoEscanear = async () => {
        if (!eventoActivo) return;
        if (!window.confirm('¿Escanear la biblioteca y añadir fotos que coincidan con las fechas de este evento?')) return;
        try {
            const res = await apiFetch(`${API}/eventos/${eventoActivo.id}/auto-scan`, { method: 'POST' });
            const data = await res.json();
            if (data.error) {
                alert('Error: ' + data.error);
            } else {
                alert(`Escaneo completado. Se añadieron ${data.asignadas} fotos al evento.`);
                abrirEvento(eventoActivo); // Recargar fotos
            }
        } catch (e) {
            console.error(e);
            alert('Error al escanear.');
        }
    };

    const navegar = (dir) => {
        if (!fotoZoom) return;
        const idx = fotosEvento.findIndex(f => f.id === fotoZoom.id);
        const next = dir === 'siguiente' ? (idx + 1) % fotosEvento.length : (idx - 1 + fotosEvento.length) % fotosEvento.length;
        setFotoZoom(fotosEvento[next]);
    };

    // VISTA DE DETALLE DEL EVENTO (FOTOS)
    if (eventoActivo) return (
        <div className="admin-container">
            <div className="admin-layout-wrapper">
                <header className="admin-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                        <button className="btn-volver-neon" onClick={() => { setEventoActivo(null); setFotosEvento([]); }}>
                            ⬅ VOLVER
                        </button>
                        <div>
                            <h1 className="admin-title">📅 {eventoActivo.nombre.toUpperCase()}</h1>
                            {eventoActivo.fecha_inicio && (
                                <span className="section-title" style={{ fontSize: '0.65rem' }}>
                                    SISTEMA TEMPORAL: {eventoActivo.fecha_inicio} → {eventoActivo.fecha_fin}
                                </span>
                            )}
                        </div>
                    </div>
                    {eventoActivo.fecha_inicio && (
                        <button className="btn-volver-neon" style={{ border: '1px solid #00f2ff', color: '#00f2ff' }} onClick={autoEscanear}>
                            🤖 AUTO-ESCANEAR FECHAS
                        </button>
                    )}
                </header>

                {fotosEvento.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '100px', opacity: 0.5 }}>
                        <p className="section-title">SIN ACTIVOS EN ESTE EVENTO</p>
                    </div>
                ) : (
                    <div className="masonry-grid" style={{ marginTop: '20px' }}>
                        {fotosEvento.map(foto => (
                            <div key={foto.id} className="foto-card" onClick={() => setFotoZoom(foto)}>
                                <img src={getFotoUrl(foto)} alt={foto.titulo || ''} loading="lazy" />
                                <div className="foto-card-overlay">
                                    <div className="foto-card-titulo">{foto.titulo || 'SIN TÍTULO'}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {fotoZoom && (
                    <ModalZoom
                        foto={fotoZoom}
                        onClose={() => setFotoZoom(null)}
                        onNavigate={navegar}
                        onBorrar={async (id) => {
                            await apiFetch(`${API}/imagenes/${id}`, { method: 'DELETE' });
                            setFotoZoom(null);
                            const r = await apiFetch(`${API}/eventos/${eventoActivo.id}/fotos`);
                            setFotosEvento(await r.json());
                        }}
                        getFotoUrl={getFotoUrl}
                        setBusqueda={() => { }}
                    />
                )}
            </div>
        </div>
    );

    // VISTA PRINCIPAL DE EVENTOS
    return (
        <div className="admin-container">
            <div className="admin-layout-wrapper">
                <header className="admin-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                        <h1 className="admin-title">📅 EVENTOS</h1>
                        <span className="section-title" style={{ fontSize: '0.65rem', margin: 0 }}>REGISTRO CRONOLÓGICO</span>
                    </div>
                    <button className="btn-volver-neon" onClick={() => setCreando(c => !c)}>
                        {creando ? '✕ CANCELAR' : '+ NUEVO EVENTO'}
                    </button>
                </header>

                {creando && (
                    <section className="admin-card" style={{ marginBottom: '20px' }}>
                        <form onSubmit={crear} style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                            <input className="admin-input" placeholder="Nombre del evento" value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} required style={{ flex: 2, minWidth: 150 }} />
                            <input className="admin-input" type="date" value={form.fecha_inicio} onChange={e => setForm(f => ({ ...f, fecha_inicio: e.target.value }))} style={{ flex: 1 }} />
                            <input className="admin-input" type="date" value={form.fecha_fin} onChange={e => setForm(f => ({ ...f, fecha_fin: e.target.value }))} style={{ flex: 1 }} />
                            <input className="admin-input" placeholder="Descripción técnica" value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} style={{ flex: 3 }} />
                            <button type="submit" className="btn-volver-neon" style={{ border: '1px solid #00ffff', color: '#00ffff' }}>INJECTAR</button>
                        </form>
                    </section>
                )}

                <div className="eventos-grid">
                    {eventos.map(ev => (
                        <div key={ev.id} className="admin-card" style={{ cursor: 'pointer' }} onClick={() => abrirEvento(ev)}>
                            <div style={{ fontSize: '2.5rem', marginBottom: '10px', filter: 'drop-shadow(0 0 5px #ff00ff)' }}>📅</div>
                            <h3 className="admin-title" style={{ fontSize: '1.1rem', marginBottom: '5px' }}>{ev.nombre.toUpperCase()}</h3>
                            {ev.fecha_inicio && (
                                <div style={{ fontSize: '0.72rem', color: '#00ffff', marginBottom: '10px', fontFamily: 'monospace' }}>
                                    [{ev.fecha_inicio}] {'>>'} [{ev.fecha_fin}]
                                </div>
                            )}

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '15px', borderTop: '1px solid #333', paddingTop: '10px' }}>
                                <span className="tag-badge" style={{ background: 'rgba(255, 0, 255, 0.1)', color: '#ff00ff' }}>
                                    {ev.total || 0} ACTIVOS
                                </span>
                                <button className="btn-action-icon-morado btn-borrar" onClick={e => { e.stopPropagation(); eliminar(ev.id); }}>
                                    🗑️
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                {eventos.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '100px', opacity: 0.5 }}>
                        <p className="section-title">NO SE DETECTAN EVENTOS EN EL ARCHIVO</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Eventos;