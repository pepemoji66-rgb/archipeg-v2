import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './admin.css'; // Unificamos con el estilo maestro

const API = 'http://localhost:5001/api';

const Lugares = () => {
    const [lugares, setLugares] = useState([]);
    const navigate = useNavigate();

    useEffect(() => {
        fetch(`${API}/lugares`)
            .then(r => r.json())
            .then(setLugares)
            .catch((err) => console.error("Error cargando coordenadas:", err));
    }, []);

    return (
        <div className="admin-container">
            {/* MARGEN PARA EL MENÚ LATERAL */}
            <div style={{ marginLeft: '240px', width: 'calc(100% - 240px)', padding: '20px' }}>

                <header className="admin-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                        <h1 className="admin-title">📍 LUGARES</h1>
                        <span className="section-title" style={{ fontSize: '0.65rem', margin: 0 }}>GEOLOCALIZACIÓN DE ACTIVOS</span>
                    </div>
                    <div className="tag-badge" style={{ borderColor: '#ffaa00', color: '#ffaa00' }}>
                        {lugares.length} PUNTOS DE INTERÉS
                    </div>
                </header>

                {lugares.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '100px', opacity: 0.5 }}>
                        <p className="section-title">NO SE HAN REGISTRADO COORDENADAS EN EL SISTEMA</p>
                        <p style={{ fontSize: '0.75rem', color: '#aaa', marginTop: '10px' }}>
                            ASIGNA UBICACIONES DESDE EL PANEL DE GESTIÓN PARA MAPEAR TU ARCHIVO.
                        </p>
                    </div>
                ) : (
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                        gap: '20px',
                        marginTop: '30px'
                    }}>
                        {lugares.map(l => (
                            <div
                                key={l.lugar}
                                className="admin-card"
                                style={{
                                    cursor: 'pointer',
                                    textAlign: 'center',
                                    transition: '0.3s'
                                }}
                                onClick={() => navigate(`/galeria-completa?q=${encodeURIComponent(l.lugar)}`)}
                            >
                                <div style={{
                                    fontSize: '2.5rem',
                                    marginBottom: '10px',
                                    filter: 'drop-shadow(0 0 8px #ffaa00)'
                                }}>
                                    📍
                                </div>
                                <h3 className="admin-title" style={{ fontSize: '1rem', marginBottom: '10px' }}>
                                    {l.lugar.toUpperCase()}
                                </h3>

                                <div style={{
                                    borderTop: '1px solid #333',
                                    paddingTop: '10px',
                                    marginTop: '10px',
                                    display: 'flex',
                                    justifyContent: 'center'
                                }}>
                                    <span className="tag-badge" style={{ background: 'rgba(255, 170, 0, 0.1)', color: '#ffaa00', border: '1px solid #ffaa00' }}>
                                        {l.total} ACTIVOS DETECTADOS
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Lugares;