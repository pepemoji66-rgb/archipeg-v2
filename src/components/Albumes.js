import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../api';
import { API_BASE_URL } from '../config';

const API = `${API_BASE_URL}/api`;

const Albumes = () => {
    const [albumes, setAlbumes] = useState([]);
    const [nombre, setNombre] = useState('');
    const [descripcion, setDescripcion] = useState('');
    const [privado, setPrivado] = useState(false);
    const [creando, setCreando] = useState(false);
    const navigate = useNavigate();

    const cargar = async () => {
        try {
            const res = await apiFetch(`${API}/albumes`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            setAlbumes(await res.json());
        } catch (e) { console.error(e); }
    };

    useEffect(() => { cargar(); }, []);

    const crear = async (e) => {
        e.preventDefault();
        if (!nombre.trim()) return;
        await apiFetch(`${API}/albumes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombre: nombre.trim(), descripcion: descripcion.trim(), privado })
        });
        setNombre(''); setDescripcion(''); setPrivado(false); setCreando(false);
        cargar();
    };

    const eliminar = async (id) => {
        if (!window.confirm('¿Eliminar este álbum? Las fotos no se borrarán.')) return;
        await apiFetch(`${API}/albumes/${id}`, { method: 'DELETE' });
        cargar();
    };

    return (
        <div className="admin-container">
            <div className="admin-layout-wrapper">
                <header className="admin-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                        <h1 className="admin-title">📁 ÁLBUMES</h1>
                        <span className="section-title" style={{ fontSize: '0.65rem', margin: 0 }}>ORGANIZACIÓN DE ACTIVOS</span>
                    </div>
                    <button className="btn-volver-neon" onClick={() => setCreando(c => !c)}>
                        {creando ? '✕ CANCELAR' : '+ NUEVO ÁLBUM'}
                    </button>
                </header>

                {creando && (
                    <section className="admin-card" style={{ marginBottom: '20px' }}>
                        <form onSubmit={crear} style={{ display: 'flex', gap: '15px', alignItems: 'center', flexWrap: 'wrap' }}>
                            <input
                                className="admin-input"
                                placeholder="Nombre del álbum"
                                value={nombre}
                                onChange={e => setNombre(e.target.value)}
                                style={{ flex: '1 1 200px' }}
                                required
                            />
                            <input
                                className="admin-input"
                                placeholder="Descripción"
                                value={descripcion}
                                onChange={e => setDescripcion(e.target.value)}
                                style={{ flex: '2 1 300px' }}
                            />
                            <div style={{ display: 'flex', gap: '10px', width: '100%', justifyContent: 'center', marginTop: '10px' }}>
                                <button
                                    type="button"
                                    onClick={() => setPrivado(!privado)}
                                    className="btn-volver-neon"
                                    style={{
                                        border: `1px solid ${privado ? '#ff0055' : '#00ffff'}`,
                                        color: privado ? '#ff0055' : '#00ffff',
                                        boxShadow: privado ? '0 0 10px #ff0055' : 'none'
                                    }}
                                >
                                    {privado ? '🔒 PRIVADO (ON)' : '🔓 PÚBLICO (OFF)'}
                                </button>
                                <button type="submit" className="btn-volver-neon" style={{ border: '1px solid #00ffff', color: '#00ffff' }}>
                                    + CREAR ÁLBUM
                                </button>
                            </div>
                        </form>
                    </section>
                )}

                <div className="album-grid">
                    {albumes.map(album => (
                        <div key={album.id} className="admin-card"
                            style={{ cursor: 'pointer', transition: '0.3s' }}
                            onClick={() => navigate(`/albumes/${album.id}`)}
                        >
                            <div style={{ fontSize: '2.5rem', marginBottom: '10px', textAlign: 'center', filter: 'drop-shadow(0 0 5px #00ffff)' }}>
                                {album.privado ? '🔒' : '📁'}
                            </div>
                            <h3 className="admin-title" style={{ fontSize: '1.1rem', marginBottom: '5px', textAlign: 'center' }}>{album.nombre.toUpperCase()}</h3>
                            {album.descripcion && <p style={{ fontSize: '0.75rem', color: '#aaa', marginBottom: '10px', textAlign: 'center' }}>{album.descripcion}</p>}

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '15px', borderTop: '1px solid #333', paddingTop: '10px' }}>
                                <span className="tag-badge" style={{ background: 'rgba(0, 255, 255, 0.1)', color: '#00ffff' }}>
                                    {album.total || 0} ACTIVOS
                                </span>
                                <button className="btn-action-icon-morado btn-borrar"
                                    onClick={e => { e.stopPropagation(); eliminar(album.id); }}>
                                    🗑️
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                {albumes.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '100px', opacity: 0.5 }}>
                        <p className="section-title">NO SE DETECTAN ÁLBUMES EN EL SISTEMA</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Albumes;
