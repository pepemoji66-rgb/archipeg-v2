import React, { useState, useEffect } from 'react';
import './admin.css'; // Estilo unificado ARCHIPEG

const API = 'http://localhost:5001/api';

const Mapa = () => {
    const [lugares, setLugares] = useState([]);
    const [cargando, setCargando] = useState(true);

    useEffect(() => {
        fetch(`${API}/lugares`)
            .then(r => r.json())
            .then(data => {
                setLugares(Array.isArray(data) ? data : []);
                setCargando(false);
            })
            .catch(() => setCargando(false));
    }, []);

    return (
        <div className="admin-container">
            {/* MARGEN PARA EL MENÚ LATERAL */}
            <div style={{ marginLeft: '240px', width: 'calc(100% - 240px)', padding: '20px' }}>

                <header className="admin-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                        <h1 className="admin-title">🗺️ MAPA DE ACTIVOS</h1>
                        <span className="section-title" style={{ fontSize: '0.65rem', margin: 0 }}>REGISTRO GEOGRÁFICO</span>
                    </div>
                </header>

                <p className="section-title" style={{ marginBottom: '24px', opacity: 0.8 }}>
                    LOCALIZACIONES DETECTADAS EN EL ARCHIVO FOTOGRÁFICO
                </p>

                {cargando ? (
                    <div style={{ textAlign: 'center', padding: '50px' }}>
                        <p className="section-title" style={{ color: '#ffaa00' }}>ESCANEANDO COORDENADAS...</p>
                    </div>
                ) : lugares.length === 0 ? (
                    <div className="admin-card" style={{
                        textAlign: 'center',
                        padding: '60px',
                        borderStyle: 'dashed'
                    }}>
                        <div style={{ fontSize: '3rem', marginBottom: '15px', filter: 'drop-shadow(0 0 10px #ffaa00)' }}>📍</div>
                        <h3 className="admin-title">SIN REGISTROS DE UBICACIÓN</h3>
                        <p style={{ fontSize: '0.8rem', color: '#666', marginTop: '10px' }}>
                            EL CAMPO "LUGAR" NO HA SIDO DETECTADO EN NINGÚN ACTIVO.
                        </p>
                    </div>
                ) : (
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                        gap: '15px'
                    }}>
                        {lugares.map((lugar, i) => (
                            <div key={i} className="admin-card" style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '15px',
                                borderLeft: '3px solid #ffaa00'
                            }}>
                                <span style={{ fontSize: '1.5rem', filter: 'drop-shadow(0 0 5px #ffaa00)' }}>📍</span>
                                <div>
                                    <div className="admin-title" style={{ fontSize: '0.9rem' }}>
                                        {(lugar.nombre || lugar).toUpperCase()}
                                    </div>
                                    {lugar.total && (
                                        <div style={{ fontSize: '0.7rem', color: '#ffaa00', fontFamily: 'monospace', marginTop: '4px' }}>
                                            {lugar.total} FOTO{lugar.total !== 1 ? 'S' : ''} DETECTADAS
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* FOOTER DE PRÓXIMA INTEGRACIÓN */}
                <div style={{
                    marginTop: '40px',
                    padding: '25px',
                    background: 'rgba(255, 170, 0, 0.05)',
                    border: '1px dashed rgba(255, 170, 0, 0.3)',
                    borderRadius: 'var(--radio)',
                    textAlign: 'center'
                }}>
                    <span style={{
                        color: '#ffaa00',
                        fontSize: '0.75rem',
                        letterSpacing: '2px',
                        fontWeight: 'bold'
                    }}>
                        SISTEMA DE MAPEO INTERACTIVO: [EN DESARROLLO...]
                    </span>
                </div>
            </div>
        </div>
    );
};

export default Mapa;