import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ModalZoom from './ModalZoom';
import './galeria.css';
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

const AlbumDetalle = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [fotos, setFotos] = useState([]);
    const [album, setAlbum] = useState(null);
    const [fotoZoom, setFotoZoom] = useState(null);
    const [accesoConcedido, setAccesoConcedido] = useState(false);
    const [password, setPassword] = useState('');
    const [errorPwd, setErrorPwd] = useState('');

    const cargar = useCallback(async () => {
        try {
            const albRes = await apiFetch(`${API}/albumes`);
            const albumes = await albRes.json();
            const a = albumes.find(a => a.id === parseInt(id));
            setAlbum(a);

            if (!a) return;

            if (!a.privado) {
                setAccesoConcedido(true);
                const fotosRes = await apiFetch(`${API}/albumes/${id}/fotos`);
                setFotos(await fotosRes.json());
            }
        } catch (e) { console.error(e); }
    }, [id]);

    const intentarDesbloquear = async (e) => {
        e.preventDefault();
        try {
            const res = await apiFetch(`${API}/auth/verificar-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password })
            });

            if (res.ok) {
                setAccesoConcedido(true);
                setErrorPwd('');
                const fotosRes = await apiFetch(`${API}/albumes/${id}/fotos`);
                setFotos(await fotosRes.json());
            } else {
                setErrorPwd('Contraseña / PIN incorrecto');
                setTimeout(() => setErrorPwd(''), 3000);
            }
        } catch (e) { console.error(e); }
    };

    useEffect(() => { cargar(); }, [cargar]);

    const navegar = (dir) => {
        if (!fotoZoom) return;
        const idx = fotos.findIndex(f => f.id === fotoZoom.id);
        const next = dir === 'siguiente' ? (idx + 1) % fotos.length : (idx - 1 + fotos.length) % fotos.length;
        setFotoZoom(fotos[next]);
    };

    const borrar = async (fotoId) => {
        if (!window.confirm('¿Mover a la papelera?')) return;
        await apiFetch(`${API}/imagenes/${fotoId}`, { method: 'DELETE' });
        setFotoZoom(null);
        cargar();
    };

    const quitarDeAlbum = async (fotoId) => {
        await apiFetch(`${API}/albumes/${id}/fotos/${fotoId}`, { method: 'DELETE' });
        cargar();
    };

    return (
        <div className="galeria-layout">
            <header className="galeria-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                    <button className="btn-header-neon btn-fucsia-neon" onClick={() => navigate('/albumes')} style={{ padding: '5px 15px' }}>
                        ← VOLVER
                    </button>
                    <h1 className="galeria-titulo">{album?.privado ? '🔒 ' : '📁 '}{album?.nombre || '...'}</h1>
                </div>
                {album?.descripcion && <span style={{ color: '#00f2ff', fontSize: '0.9rem', fontWeight: 'bold' }}>{album.descripcion.toUpperCase()}</span>}
            </header>

            {!accesoConcedido && album?.privado ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', color: '#00f2ff' }}>
                    <div style={{ fontSize: '4rem', marginBottom: '20px', filter: 'drop-shadow(0 0 10px #00f2ff)' }}>🔒</div>
                    <h2 style={{ fontSize: '1.5rem', marginBottom: '30px' }}>ESTE ÁLBUM ES PRIVADO</h2>
                    <form onSubmit={intentarDesbloquear} style={{ display: 'flex', flexDirection: 'column', gap: '15px', alignItems: 'center' }}>
                        <input
                            type="password"
                            placeholder="PIN de seguridad..."
                            className="input-neon"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            autoFocus
                            style={{ textAlign: 'center', width: '250px' }}
                        />
                        <button type="submit" className="btn-volver-neon" style={{ width: '250px' }}>DESBLOQUEAR</button>
                    </form>
                    {errorPwd && <p style={{ color: '#ff0055', marginTop: '15px' }}>{errorPwd}</p>}
                </div>
            ) : fotos.length === 0 ? (
                <div className="galeria-empty">
                    <h3>Este álbum está vacío</h3>
                    <p style={{ fontSize: '0.82rem', color: 'var(--texto-secundario)' }}>Añade fotos desde el panel de gestión o galería</p>
                </div>
            ) : (
                <div className="masonry-grid">
                    {fotos.map(foto => (
                        <div key={foto.id} className="foto-card" onClick={() => setFotoZoom(foto)}>
                            <img src={getFotoUrl(foto)} alt={foto.titulo || ''} loading="lazy" />
                            <button
                                style={{ position:'absolute', top:8, right:8, background:'rgba(0,0,0,0.5)', border:'none', borderRadius:'50%', width:26, height:26, color:'#fff', cursor:'pointer', fontSize:'0.65rem' }}
                                onClick={e => { e.stopPropagation(); quitarDeAlbum(foto.id); }}
                                title="Quitar del álbum"
                            >✕</button>
                            <div className="foto-card-overlay">
                                <div className="foto-card-titulo">{foto.titulo || 'Sin título'}</div>
                                <div className="foto-card-meta">{foto.anio}</div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {fotoZoom && (
                <ModalZoom foto={fotoZoom} onClose={() => setFotoZoom(null)} onNavigate={navegar}
                    onBorrar={borrar} getFotoUrl={getFotoUrl} setBusqueda={() => {}} />
            )}
        </div>
    );
};

export default AlbumDetalle;
