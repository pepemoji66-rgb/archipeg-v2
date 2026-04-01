import React, { useState, useEffect, useCallback } from 'react';
import ModalZoom from './ModalZoom';
import './admin.css'; // Unificamos con el estilo neón del admin

import { API_BASE_URL, UPLOADS_URL } from '../config';

const API = `${API_BASE_URL}/api`;
const URL_FOTOS = UPLOADS_URL;
const getFotoUrl = (foto) => foto?.imagen_url ? URL_FOTOS + foto.imagen_url.trim().replace(/ /g, '%20') : '';

const Personas = () => {
    const [personas, setPersonas] = useState([]);
    const [personaActiva, setPersonaActiva] = useState(null);
    const [fotos, setFotos] = useState([]);
    const [fotoZoom, setFotoZoom] = useState(null);
    const [nombre, setNombre] = useState('');
    const [creando, setCreando] = useState(false);

    const cargar = useCallback(async () => {
        try {
            const res = await fetch(`${API}/personas`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            setPersonas(await res.json());
        } catch (e) { console.error(e); }
    }, []);

    useEffect(() => { cargar(); }, [cargar]);

    const abrirPersona = async (persona) => {
        setPersonaActiva(persona);
        const res = await fetch(`${API}/personas/${persona.id}/fotos`);
        setFotos(await res.json());
    };

    const crear = async (e) => {
        e.preventDefault();
        if (!nombre.trim()) return;
        await fetch(`${API}/personas`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombre: nombre.trim() })
        });
        setNombre(''); setCreando(false); cargar();
    };

    const eliminar = async (id) => {
        if (!window.confirm('¿ELIMINAR ESTE REGISTRO BIOMÉTRICO?')) return;
        await fetch(`${API}/personas/${id}`, { method: 'DELETE' });
        if (personaActiva?.id === id) { setPersonaActiva(null); setFotos([]); }
        cargar();
    };

    const navegar = (dir) => {
        if (!fotoZoom) return;
        const idx = fotos.findIndex(f => f.id === fotoZoom.id);
        const next = dir === 'siguiente' ? (idx + 1) % fotos.length : (idx - 1 + fotos.length) % fotos.length;
        setFotoZoom(fotos[next]);
    };

    // VISTA DETALLE: FOTOS DE LA PERSONA
    if (personaActiva) return (
        <div className="admin-container">
            <div style={{ marginLeft: '240px', width: 'calc(100% - 240px)', padding: '20px' }}>
                <header className="admin-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                        <button className="btn-volver-neon" onClick={() => { setPersonaActiva(null); setFotos([]); }}>
                            ⬅ VOLVER
                        </button>
                        <div>
                            <h1 className="admin-title">👤 {personaActiva.nombre.toUpperCase()}</h1>
                            <span className="section-title" style={{ fontSize: '0.65rem' }}>SUJETO IDENTIFICADO</span>
                        </div>
                    </div>
                </header>

                {fotos.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '100px', opacity: 0.5 }}>
                        <p className="section-title">SIN ACTIVOS VINCULADOS A ESTA IDENTIDAD</p>
                    </div>
                ) : (
                    <div className="masonry-grid" style={{ marginTop: '20px' }}>
                        {fotos.map(foto => (
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
                            await fetch(`${API}/imagenes/${id}`, { method: 'DELETE' });
                            setFotoZoom(null);
                            const r = await fetch(`${API}/personas/${personaActiva.id}/fotos`);
                            setFotos(await r.json());
                        }}
                        getFotoUrl={getFotoUrl}
                        setBusqueda={() => { }}
                    />
                )}
            </div>
        </div>
    );

    // VISTA PRINCIPAL: LISTADO DE PERSONAS
    return (
        <div className="admin-container">
            <div style={{ marginLeft: '240px', width: 'calc(100% - 240px)', padding: '20px' }}>
                <header className="admin-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                        <h1 className="admin-title">👤 PERSONAS</h1>
                        <span className="section-title" style={{ fontSize: '0.65rem', margin: 0 }}>BASE DE DATOS DE SUJETOS</span>
                    </div>
                    <button className="btn-volver-neon" onClick={() => setCreando(c => !c)}>
                        {creando ? '✕ CANCELAR' : '+ NUEVA PERSONA'}
                    </button>
                </header>

                {creando && (
                    <section className="admin-card" style={{ marginBottom: '20px' }}>
                        <form onSubmit={crear} style={{ display: 'flex', gap: '15px' }}>
                            <input
                                className="admin-input"
                                placeholder="Nombre completo del sujeto"
                                value={nombre}
                                onChange={e => setNombre(e.target.value)}
                                required
                                style={{ flex: 1 }}
                            />
                            <button type="submit" className="btn-volver-neon" style={{ border: '1px solid #00ffff', color: '#00ffff' }}>
                                REGISTRAR
                            </button>
                        </form>
                    </section>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '20px' }}>
                    {personas.map(p => (
                        <div key={p.id} className="admin-card" style={{ cursor: 'pointer', textAlign: 'center' }} onClick={() => abrirPersona(p)}>
                            <div style={{ fontSize: '3rem', marginBottom: '10px', filter: 'drop-shadow(0 0 8px #00ffff)' }}>👤</div>
                            <h3 className="admin-title" style={{ fontSize: '1rem', marginBottom: '10px' }}>{p.nombre.toUpperCase()}</h3>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '15px', borderTop: '1px solid #333', paddingTop: '10px' }}>
                                <span className="tag-badge" style={{ background: 'rgba(0, 255, 255, 0.1)', color: '#00ffff' }}>
                                    {p.total || 0} ACTIVOS
                                </span>
                                <button className="btn-action-icon-morado btn-borrar" onClick={e => { e.stopPropagation(); eliminar(p.id); }}>
                                    🗑️
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                {personas.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '100px', opacity: 0.5 }}>
                        <p className="section-title">SISTEMA VACÍO: NO HAY PERSONAS REGISTRADAS</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Personas;