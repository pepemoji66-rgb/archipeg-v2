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

    const cargar = useCallback(async () => {
        try {
            const res = await apiFetch(`${API}/favoritos`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            setFotos(await res.json());
        } catch (e) { console.error(e); }
    }, []);

    useEffect(() => { cargar(); }, [cargar]);

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
        <div className="galeria-layout" style={{ padding: '0 20px 20px' }}>
            <header className="galeria-header">
                <button className="btn-header-neon" onClick={() => window.history.back()}>⬅ ATRÁS</button>
                <h1 className="galeria-titulo">⭐ Favoritos</h1>
            </header>

            {fotos.length === 0 ? (
                <div className="galeria-empty">
                    <h3>No tienes fotos favoritas todavía</h3>
                    <p style={{ fontSize: '0.82rem', color: 'var(--texto-secundario)' }}>Marca fotos con ⭐ desde la galería</p>
                </div>
            ) : (
                <div className="masonry-grid">
                    {fotos.map(foto => (
                        <div key={foto.id} className="foto-card" onClick={() => setFotoZoom(foto)}>
                            <img src={getFotoUrl(foto)} alt={foto.titulo || ''} loading="lazy" />
                            <div className="foto-card-overlay">
                                <div className="foto-card-titulo">{foto.titulo || 'Sin título'}</div>
                                <div className="foto-card-meta">{foto.anio}</div>
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
