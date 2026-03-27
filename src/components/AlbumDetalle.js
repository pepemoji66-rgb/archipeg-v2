import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ModalZoom from './ModalZoom';
import './galeria.css';

const API = 'http://localhost:5001/api';
const URL_FOTOS = 'http://localhost:5001/uploads/';
const getFotoUrl = (foto) => foto?.imagen_url ? URL_FOTOS + foto.imagen_url.trim().replace(/ /g,'%20') : '';

const AlbumDetalle = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [fotos, setFotos] = useState([]);
    const [album, setAlbum] = useState(null);
    const [fotoZoom, setFotoZoom] = useState(null);

    const cargar = useCallback(async () => {
        try {
            const [albRes, fotosRes] = await Promise.all([
                fetch(`${API}/albumes`),
                fetch(`${API}/albumes/${id}/fotos`)
            ]);
            const albumes = await albRes.json();
            setAlbum(albumes.find(a => a.id === parseInt(id)));
            setFotos(await fotosRes.json());
        } catch (e) { console.error(e); }
    }, [id]);

    useEffect(() => { cargar(); }, [cargar]);

    const navegar = (dir) => {
        if (!fotoZoom) return;
        const idx = fotos.findIndex(f => f.id === fotoZoom.id);
        const next = dir === 'siguiente' ? (idx + 1) % fotos.length : (idx - 1 + fotos.length) % fotos.length;
        setFotoZoom(fotos[next]);
    };

    const borrar = async (fotoId) => {
        if (!window.confirm('¿Mover a la papelera?')) return;
        await fetch(`${API}/imagenes/${fotoId}`, { method: 'DELETE' });
        setFotoZoom(null);
        cargar();
    };

    const quitarDeAlbum = async (fotoId) => {
        await fetch(`${API}/albumes/${id}/fotos/${fotoId}`, { method: 'DELETE' });
        cargar();
    };

    return (
        <div className="galeria-layout">
            <header className="galeria-header">
                <button className="btn-ghost" onClick={() => navigate('/albumes')}>← Álbumes</button>
                <h1 className="galeria-titulo">📁 {album?.nombre || '...'}</h1>
                {album?.descripcion && <span style={{ color: 'var(--texto-secundario)', fontSize: '0.8rem' }}>{album.descripcion}</span>}
            </header>

            {fotos.length === 0 ? (
                <div className="galeria-empty">
                    <h3>Este álbum está vacío</h3>
                    <p style={{ fontSize: '0.82rem', color: 'var(--texto-secundario)' }}>Añade fotos desde el panel de gestión</p>
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
