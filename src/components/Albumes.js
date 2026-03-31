
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './admin.css'; // Usamos el mismo CSS del admin para unificar
import { apiFetch } from '../api';

const API = 'http://localhost:5001/api';

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
            {/* EMPUJE LATERAL PARA EL MENÚ */}
            <div style={{ marginLeft: '240px', width: 'calc(100% - 240px)', padding: '20px' }}>

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
                        <form onSubmit={crear} style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                            <input
                                className="admin-input"
                                placeholder="Nombre del álbum"
                                value={nombre}
                                onChange={e => setNombre(e.target.value)}
                                style={{ flex: 1 }}
                                required
                            />
                            <input
                                className="admin-input"
                                placeholder="Descripción (opcional)"
                                value={descripcion}
                                onChange={e => setDescripcion(e.target.value)}
                                style={{ flex: 2 }}
                            />
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
                        </form>
                    </section>
                )}

                <div className="album-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '20px' }}>
                    {albumes.map(album => (
                        <div key={album.id} className="admin-card"
                            style={{ cursor: 'pointer', transition: '0.3s' }}
                            onClick={() => navigate(`/albumes/${album.id}`)}
                        >
                            <div style={{ fontSize: '2.5rem', marginBottom: '10px', filter: 'drop-shadow(0 0 5px #00ffff)' }}>
                                {album.privado ? '🔒' : '📁'}
                            </div>
                            <h3 className="admin-title" style={{ fontSize: '1.1rem', marginBottom: '5px' }}>{album.nombre.toUpperCase()}</h3>
                            {album.descripcion && <p style={{ fontSize: '0.75rem', color: '#aaa', marginBottom: '10px' }}>{album.descripcion}</p>}

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