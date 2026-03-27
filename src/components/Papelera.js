import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './admin.css'; // Usamos el CSS maestro

const API_URL_OPERACIONES = "http://localhost:5001/api/papelera/operaciones";
const URL_BASE_FOTOS = "http://localhost:5001/uploads/";

const Papelera = () => {
    const navigate = useNavigate();
    const [fotosBorradas, setFotosBorradas] = useState([]);
    const [seleccionadas, setSeleccionadas] = useState([]);
    const [modoSeleccion, setModoSeleccion] = useState(false);

    const cargarPapelera = () => {
        fetch("http://localhost:5001/api/papelera")
            .then(res => res.json())
            .then(data => setFotosBorradas(data.error ? [] : data))
            .catch(err => console.error("Error al cargar papelera:", err));
    };

    useEffect(() => { cargarPapelera(); }, []);

    const toggleSeleccion = (id) => {
        setSeleccionadas(prev =>
            prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
        );
    };

    const restaurarSeleccionadas = async () => {
        if (!window.confirm(`¿RESTAURAR ${seleccionadas.length} ACTIVOS AL SISTEMA, HERMANO?`)) return;
        for (const id of seleccionadas) {
            await fetch(API_URL_OPERACIONES, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, accion: 'restaurar' })
            });
        }
        resetear();
    };

    const eliminarPermanente = async () => {
        if (!window.confirm(`⚠️ ADVERTENCIA CRÍTICA: SE BORRARÁN ${seleccionadas.length} ARCHIVOS DEL DISCO. ¿PROCEDER?`)) return;
        for (const id of seleccionadas) {
            await fetch(API_URL_OPERACIONES, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, accion: 'eliminar_permanente' })
            });
        }
        resetear();
    };

    const resetear = () => {
        setSeleccionadas([]);
        setModoSeleccion(false);
        cargarPapelera();
    };

    return (
        <div className="admin-container">
            {/* MARGEN PARA EL MENÚ LATERAL */}
            <div style={{ marginLeft: '240px', width: 'calc(100% - 240px)', padding: '20px' }}>

                <header className="admin-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                        <button onClick={() => navigate('/galeria-completa')} className="btn-volver-neon">
                            ⬅ VOLVER
                        </button>
                        <div>
                            <h1 className="admin-title">🗑️ PAPELERA DE RECICLAJE</h1>
                            <span className="section-title" style={{ fontSize: '0.65rem', color: '#ff4444' }}>ZONA DE ELIMINACIÓN TEMPORAL</span>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '10px' }}>
                        {seleccionadas.length > 0 && (
                            <>
                                <button onClick={restaurarSeleccionadas} className="btn-volver-neon" style={{ borderColor: '#00ff88', color: '#00ff88' }}>
                                    🔄 RESTAURAR ({seleccionadas.length})
                                </button>
                                <button onClick={eliminarPermanente} className="btn-volver-neon" style={{ borderColor: '#ff4444', color: '#ff4444' }}>
                                    🔥 PURGAR ({seleccionadas.length})
                                </button>
                            </>
                        )}
                        <button
                            onClick={() => { setModoSeleccion(!modoSeleccion); setSeleccionadas([]); }}
                            className="btn-volver-neon"
                            style={{ opacity: modoSeleccion ? 1 : 0.7 }}
                        >
                            {modoSeleccion ? "✕ CANCELAR" : "⚙️ SELECCIÓN MÚLTIPLE"}
                        </button>
                    </div>
                </header>

                <main style={{ marginTop: '30px' }}>
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                        gap: '20px'
                    }}>
                        {fotosBorradas.map(foto => (
                            <div
                                key={foto.id}
                                className="admin-card"
                                style={{
                                    position: 'relative',
                                    padding: '10px',
                                    border: seleccionadas.includes(foto.id) ? '1px solid #00ffff' : '1px solid #333',
                                    opacity: modoSeleccion && !seleccionadas.includes(foto.id) ? 0.5 : 1,
                                    transition: '0.3s'
                                }}
                                onClick={() => modoSeleccion && toggleSeleccion(foto.id)}
                            >
                                <div style={{
                                    width: '100%',
                                    height: '150px',
                                    overflow: 'hidden',
                                    borderRadius: '4px',
                                    backgroundColor: '#000'
                                }}>
                                    <img
                                        src={`${URL_BASE_FOTOS}${encodeURIComponent(foto.imagen_url)}`}
                                        alt={foto.titulo}
                                        style={{
                                            width: '100%',
                                            height: '100%',
                                            objectFit: 'cover',
                                            filter: 'grayscale(1) contrast(1.2)',
                                            transition: '0.5s'
                                        }}
                                    />
                                </div>

                                <div style={{ marginTop: '10px' }}>
                                    <h4 className="admin-title" style={{ fontSize: '0.8rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {foto.titulo.toUpperCase()}
                                    </h4>
                                    <span className="tag-badge" style={{ fontSize: '0.6rem', color: '#ff4444', border: 'none', padding: 0 }}>
                                        ESTADO: ELIMINADO
                                    </span>
                                </div>

                                {seleccionadas.includes(foto.id) && (
                                    <div style={{
                                        position: 'absolute', top: '5px', right: '5px',
                                        background: '#00ffff', color: '#000', borderRadius: '50%',
                                        width: '20px', height: '20px', display: 'flex',
                                        justifyContent: 'center', alignItems: 'center', fontSize: '12px'
                                    }}>
                                        ✓
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    {fotosBorradas.length === 0 && (
                        <div style={{ textAlign: 'center', padding: '100px', opacity: 0.5 }}>
                            <p className="section-title">LA PAPELERA ESTÁ LIMPIA. EL SISTEMA ESTÁ EN ORDEN.</p>
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
};

export default Papelera;