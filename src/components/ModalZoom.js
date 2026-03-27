import React, { useState, useEffect } from 'react';
import './modalzoom.css';

const API = 'http://localhost:5001/api';

const ModalZoom = ({ foto, onClose, onNavigate, onBorrar, getFotoUrl, setBusqueda, onFavoritoToggle }) => {
    const [escala, setEscala] = useState(1);
    const [rotacion, setRotacion] = useState(0); // Nuevo estado para el giro
    const [pos, setPos] = useState({ x: 0, y: 0 });
    const [arrastrando, setArrastrando] = useState(false);
    const [inicio, setInicio] = useState({ x: 0, y: 0 });
    const [personas, setPersonas] = useState([]);
    const [fotoLocal, setFotoLocal] = useState(foto);

    useEffect(() => {
        setFotoLocal(foto);
        setEscala(1);
        setRotacion(0); // Resetear giro al cambiar de foto
        setPos({ x: 0, y: 0 });
    }, [foto]);

    useEffect(() => {
        fetch(`${API}/fotos/${foto.id}/personas`).then(r => r.json()).then(setPersonas).catch(() => { });
    }, [foto.id]);

    useEffect(() => {
        const handler = (e) => {
            if (e.key === 'Escape') onClose();
            if (e.key === 'ArrowRight') { setEscala(1); setRotacion(0); setPos({ x: 0, y: 0 }); onNavigate('siguiente'); }
            if (e.key === 'ArrowLeft') { setEscala(1); setRotacion(0); setPos({ x: 0, y: 0 }); onNavigate('anterior'); }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [onNavigate, onClose]);

    const onRueda = (e) => {
        const delta = e.deltaY;
        setEscala(prev => {
            const nueva = delta < 0 ? Math.min(prev + 0.2, 7) : Math.max(prev - 0.2, 1);
            if (nueva === 1) setPos({ x: 0, y: 0 });
            return nueva;
        });
    };

    const girar = () => setRotacion(prev => (prev + 90) % 360);

    const toggleFav = async () => {
        try {
            const res = await fetch(`${API}/fotos/${fotoLocal.id}/favorito`, { method: 'PATCH' });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const { favorito } = await res.json();
            const actualizada = { ...fotoLocal, favorito };
            setFotoLocal(actualizada);
            if (onFavoritoToggle) onFavoritoToggle(actualizada);
        } catch (e) { console.error(e); }
    };

    const descargar = () => {
        const url = getFotoUrl(fotoLocal);
        fetch(url).then(r => r.blob()).then(blob => {
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = fotoLocal.titulo ? `${fotoLocal.titulo}.jpg` : 'foto.jpg';
            a.click();
            URL.revokeObjectURL(a.href);
        }).catch(() => window.open(url, '_blank'));
    };

    const tags = fotoLocal.etiquetas ? fotoLocal.etiquetas.split(',').filter(t => t.trim()) : [];

    return (
        <div className="modal-overlay" onClick={onClose} onWheel={onRueda}>
            <div className="modal-contenido" onClick={e => e.stopPropagation()}>

                {/* BOTÓN CERRAR (Arriba a la derecha, fucsia neón) */}
                <button className="modal-cerrar" onClick={onClose}>×</button>

                {/* IMAGEN CON CONTROL DE ZOOM, ARRASTRE Y GIRO */}
                <div className="modal-imagen-zona"
                    onMouseDown={e => { if (escala > 1) { setArrastrando(true); setInicio({ x: e.clientX - pos.x, y: e.clientY - pos.y }); } }}
                    onMouseMove={e => { if (arrastrando) setPos({ x: e.clientX - inicio.x, y: e.clientY - inicio.y }); }}
                    onMouseUp={() => setArrastrando(false)}
                    onMouseLeave={() => setArrastrando(false)}
                    style={{ cursor: escala > 1 ? (arrastrando ? 'grabbing' : 'grab') : 'default' }}
                >
                    <button className="modal-nav modal-nav-prev" onClick={e => { e.stopPropagation(); setEscala(1); setRotacion(0); setPos({ x: 0, y: 0 }); onNavigate('anterior'); }}>‹</button>

                    <img
                        src={getFotoUrl(fotoLocal)}
                        alt=""
                        draggable="false"
                        style={{
                            transform: `translate(${pos.x}px, ${pos.y}px) scale(${escala}) rotate(${rotacion}deg)`,
                            transition: arrastrando ? 'none' : 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                        }}
                    />

                    <button className="modal-nav modal-nav-next" onClick={e => { e.stopPropagation(); setEscala(1); setRotacion(0); setPos({ x: 0, y: 0 }); onNavigate('siguiente'); }}>›</button>
                </div>

                {/* PANEL LATERAL DE CONTROL NEÓN */}
                <div className="modal-panel">
                    <div className="modal-panel-header">
                        <div className="modal-panel-titulo">{fotoLocal.titulo || 'ARCHIVO NEÓN'}</div>
                        <div className="modal-panel-meta">
                            {fotoLocal.anio && `📅 ${fotoLocal.anio}`}
                            {fotoLocal.lugar && ` · 📍 ${fotoLocal.lugar}`}
                        </div>
                    </div>

                    {fotoLocal.descripcion && (
                        <div className="modal-info-box">
                            <div className="modal-panel-label">Descripción</div>
                            <div className="modal-desc-text">{fotoLocal.descripcion}</div>
                        </div>
                    )}

                    {(tags.length > 0 || personas.length > 0) && (
                        <div className="modal-info-box">
                            <div className="modal-panel-label">Tags / Personas</div>
                            <div className="modal-tags">
                                {tags.map((tag, i) => (
                                    <button key={i} className="modal-tag" onClick={() => { setBusqueda(tag.trim()); onClose(); }}>
                                        #{tag.trim()}
                                    </button>
                                ))}
                                {personas.map(p => <span key={p.id} className="modal-tag">👤 {p.nombre}</span>)}
                            </div>
                        </div>
                    )}

                    {/* ACCIONES - ADIÓS AL FEO, HOLA NEÓN */}
                    <div className="modal-acciones">
                        <button className="btn-accion-modal" onClick={toggleFav}>
                            {fotoLocal.favorito ? '⭐ Favorito' : '☆ Favorito'}
                        </button>

                        <button className="btn-accion-modal" onClick={girar}>
                            🔄 Girar 90°
                        </button>

                        <button className="btn-accion-modal" onClick={descargar}>
                            📥 Descargar
                        </button>

                        <button className="btn-accion-modal btn-borrar-modal" onClick={e => onBorrar(fotoLocal.id, e)}>
                            🗑️ Borrar
                        </button>
                    </div>

                    <div className="modal-zoom-info">
                        ZOOM: {Math.round(escala * 100)}% · ID: {fotoLocal.id}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ModalZoom;