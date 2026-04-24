import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import './modalzoom.css';
import { API_BASE_URL } from '../config';
import { apiFetch } from '../api';

const API = `${API_BASE_URL}/api`;

const ModalZoom = ({ foto, onClose, onNavigate, onBorrar, getFotoUrl, setBusqueda, onFavoritoToggle }) => {
    const navigate = useNavigate();
    const [escala, setEscala] = useState(1);
    const [rotacion, setRotacion] = useState(0); // Nuevo estado para el giro
    const [pos, setPos] = useState({ x: 0, y: 0 });
    const [arrastrando, setArrastrando] = useState(false);
    const [inicio, setInicio] = useState({ x: 0, y: 0 });
    const [personas, setPersonas] = useState([]);
    const [fotoLocal, setFotoLocal] = useState(foto);
    const [modoEdicion, setModoEdicion] = useState(false);
    const [editData, setEditData] = useState({});
    const [todosAlbumes, setTodosAlbumes] = useState([]);
    const [todosEventos, setTodosEventos] = useState([]);
    const [todasPersonas, setTodasPersonas] = useState([]);
    const [albumsActuales, setAlbumsActuales] = useState([]);
    const [eventosActuales, setEventosActuales] = useState([]);
    const [nuevaPersona, setNuevaPersona] = useState('');
    const [nuevoAlbum, setNuevoAlbum] = useState('');
    const [nuevoAlbumPrivado, setNuevoAlbumPrivado] = useState(false);
    const [nuevoEvento, setNuevoEvento] = useState('');
    const [nuevoTag, setNuevoTag] = useState('');
    const [menuOpcionesAbierto, setMenuOpcionesAbierto] = useState(false);

    useEffect(() => {
        setFotoLocal(foto);
        setEscala(1);
        setRotacion(0); // Resetear giro al cambiar de foto
        setPos({ x: 0, y: 0 });
        setModoEdicion(false);
        setEditData({
            titulo: foto.titulo || '',
            descripcion: foto.descripcion || '',
            anio: foto.anio || '',
            mes: foto.mes || '',
            etiquetas: foto.etiquetas || '',
            lugar: foto.lugar || '',
        });
    }, [foto]);

    useEffect(() => {
        apiFetch(`${API}/fotos/${foto.id}/personas`).then(r => r.json()).then(setPersonas).catch(() => { });
    }, [foto.id]);

    useEffect(() => {
        Promise.all([
            apiFetch(`${API}/albumes`).then(r => r.json()),
            apiFetch(`${API}/eventos`).then(r => r.json()),
            apiFetch(`${API}/personas`).then(r => r.json()),
            apiFetch(`${API}/fotos/${foto.id}/albumes`).then(r => r.json()),
            apiFetch(`${API}/fotos/${foto.id}/eventos`).then(r => r.json()),
        ]).then(([albumes, eventos, personas, albumsFoto, eventosFoto]) => {
            setTodosAlbumes(albumes);
            setTodosEventos(eventos);
            setTodasPersonas(personas);
            setAlbumsActuales(albumsFoto);
            setEventosActuales(eventosFoto);
        }).catch(() => { });
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
            const res = await apiFetch(`${API}/fotos/${fotoLocal.id}/favorito`, { method: 'PATCH' });
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

    const guardarEdicion = async () => {
        try {
            // 1. Actualizar campos básicos
            await apiFetch(`${API}/fotos/${fotoLocal.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    titulo: editData.titulo || null,
                    descripcion: editData.descripcion || null,
                    anio: editData.anio ? parseInt(editData.anio) : null,
                    mes: editData.mes ? parseInt(editData.mes) : null,
                    etiquetas: editData.etiquetas || null,
                    lugar: editData.lugar || null,
                })
            });

            // 2. Actualizar personas (el endpoint reemplaza todas)
            const personasSelIds = editData.personas_ids || personas.map(p => p.id);
            await apiFetch(`${API}/fotos/${fotoLocal.id}/personas`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ persona_ids: personasSelIds })
            });

            // 3. Actualizar álbumes: añadir nuevos, quitar eliminados
            const albumsAntes = albumsActuales.map(a => a.id);
            const albumsDespues = editData.albums_ids || albumsAntes;
            for (const id of albumsDespues.filter(id => !albumsAntes.includes(id))) {
                await apiFetch(`${API}/albumes/${id}/fotos`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ foto_id: fotoLocal.id })
                });
            }
            for (const id of albumsAntes.filter(id => !albumsDespues.includes(id))) {
                await apiFetch(`${API}/albumes/${id}/fotos/${fotoLocal.id}`, { method: 'DELETE' });
            }

            // 4. Actualizar eventos
            const eventosAntes = eventosActuales.map(e => e.id);
            const eventosDespues = editData.eventos_ids || eventosAntes;
            for (const id of eventosDespues.filter(id => !eventosAntes.includes(id))) {
                await apiFetch(`${API}/eventos/${id}/fotos`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ foto_id: fotoLocal.id })
                });
            }
            for (const id of eventosAntes.filter(id => !eventosDespues.includes(id))) {
                await apiFetch(`${API}/eventos/${id}/fotos/${fotoLocal.id}`, { method: 'DELETE' });
            }

            // 5. Actualizar estado local
            setFotoLocal(prev => ({
                ...prev,
                titulo: editData.titulo,
                descripcion: editData.descripcion,
                anio: editData.anio,
                mes: editData.mes,
                etiquetas: editData.etiquetas,
                lugar: editData.lugar,
            }));
            setAlbumsActuales(todosAlbumes.filter(a => (editData.albums_ids || albumsAntes).includes(a.id)));
            setEventosActuales(todosEventos.filter(e => (editData.eventos_ids || eventosAntes).includes(e.id)));

            // Recargar personas
            const nuevasPersonas = await apiFetch(`${API}/fotos/${fotoLocal.id}/personas`).then(r => r.json());
            setPersonas(nuevasPersonas);

            setModoEdicion(false);
        } catch (e) { console.error('Error guardando:', e); }
    };

    const crearPersona = async () => {
        if (!nuevaPersona.trim()) return;
        try {
            const res = await apiFetch(`${API}/personas`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nombre: nuevaPersona.trim() }) });
            const nueva = await res.json();
            setTodasPersonas(prev => [...prev, nueva]);
            setNuevaPersona('');
        } catch (e) { console.error(e); }
    };

    const borrarPersona = async (id) => {
        if (!window.confirm('¿Eliminar esta persona del sistema? Se quitará de todas las fotos.')) return;
        try {
            await apiFetch(`${API}/personas/${id}`, { method: 'DELETE' });
            setTodasPersonas(prev => prev.filter(p => p.id !== id));
            setEditData(d => ({ ...d, personas_ids: (d.personas_ids !== undefined ? d.personas_ids : personas.map(p => p.id)).filter(pid => pid !== id) }));
        } catch (e) { console.error(e); }
    };

    const crearAlbum = async () => {
        if (!nuevoAlbum.trim()) return;
        try {
            const res = await apiFetch(`${API}/albumes`, { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' }, 
                body: JSON.stringify({ nombre: nuevoAlbum.trim(), privado: nuevoAlbumPrivado }) 
            });
            const nuevo = await res.json();
            
            // ASOCIACIÓN AUTOMÁTICA
            await apiFetch(`${API}/albumes/${nuevo.id}/fotos`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ foto_id: fotoLocal.id })
            });

            // Evitar duplicados en la lista local si el álbum ya existía
            setTodosAlbumes(prev => {
                if (prev.some(a => a.id === nuevo.id)) return prev;
                // Lo ponemos al principio para que el usuario lo vea inmediatamente
                return [nuevo, ...prev];
            });

            const r = await apiFetch(`${API}/fotos/${fotoLocal.id}/albumes`);
            setAlbumsActuales(await r.json());
            setNuevoAlbum('');
            setNuevoAlbumPrivado(false);
        } catch (e) { console.error(e); }
    };

    const borrarAlbum = async (id) => {
        if (!window.confirm('¿Eliminar este álbum del sistema? Las fotos no se borrarán.')) return;
        try {
            await apiFetch(`${API}/albumes/${id}`, { method: 'DELETE' });
            setTodosAlbumes(prev => prev.filter(a => a.id !== id));
            setEditData(d => ({ ...d, albums_ids: (d.albums_ids !== undefined ? d.albums_ids : albumsActuales.map(a => a.id)).filter(aid => aid !== id) }));
        } catch (e) { console.error(e); }
    };

    const crearEvento = async () => {
        if (!nuevoEvento.trim()) return;
        try {
            const res = await apiFetch(`${API}/eventos`, { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' }, 
                body: JSON.stringify({ nombre: nuevoEvento.trim() }) 
            });
            const nuevo = await res.json();
            
            // ASOCIACIÓN AUTOMÁTICA
            await apiFetch(`${API}/eventos/${nuevo.id}/fotos`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ foto_id: fotoLocal.id })
            });

            // Evitar duplicados en la lista local
            setTodosEventos(prev => {
                if (prev.some(e => e.id === nuevo.id)) return prev;
                // Lo ponemos al principio para visibilidad inmediata
                return [nuevo, ...prev];
            });

            const r = await apiFetch(`${API}/fotos/${fotoLocal.id}/eventos`);
            setEventosActuales(await r.json());
            setNuevoEvento('');
        } catch (e) { console.error(e); }
    };

    const añadirAEventoRapido = async (eventoId) => {
        if (!eventoId) return;
        try {
            await apiFetch(`${API}/eventos/${eventoId}/fotos`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ foto_id: fotoLocal.id })
            });
            const r = await apiFetch(`${API}/fotos/${fotoLocal.id}/eventos`);
            setEventosActuales(await r.json());
        } catch (e) { console.error(e); }
    };

    const borrarEvento = async (id) => {
        if (!window.confirm('¿Eliminar este evento del sistema? Las fotos no se borrarán.')) return;
        try {
            await apiFetch(`${API}/eventos/${id}`, { method: 'DELETE' });
            setTodosEventos(prev => prev.filter(e => e.id !== id));
            setEditData(d => ({ ...d, eventos_ids: (d.eventos_ids !== undefined ? d.eventos_ids : eventosActuales.map(e => e.id)).filter(eid => eid !== id) }));
        } catch (e) { console.error(e); }
    };

    const agregarTag = () => {
        if (!nuevoTag.trim()) return;
        const actuales = (editData.etiquetas || '').split(',').filter(t => t.trim());
        if (!actuales.map(t => t.toLowerCase()).includes(nuevoTag.trim().toLowerCase())) {
            setEditData(d => ({ ...d, etiquetas: [...actuales, nuevoTag.trim()].join(', ') }));
        }
        setNuevoTag('');
    };

    const quitarTag = (tag) => {
        const actuales = (editData.etiquetas || '').split(',').filter(t => t.trim() && t.trim().toLowerCase() !== tag.toLowerCase());
        setEditData(d => ({ ...d, etiquetas: actuales.join(', ') }));
    };

    const tags = fotoLocal.etiquetas ? fotoLocal.etiquetas.split(',').filter(t => t.trim()) : [];

    return createPortal(
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
                        onDragStart={e => e.preventDefault()}
                        style={{
                            transform: `translate(${pos.x}px, ${pos.y}px) scale(${escala}) rotate(${rotacion}deg)`,
                            transition: arrastrando ? 'none' : 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                            userSelect: 'none',
                            WebkitUserDrag: 'none'
                        }}
                    />

                    <button className="modal-nav modal-nav-next" onClick={e => { e.stopPropagation(); setEscala(1); setRotacion(0); setPos({ x: 0, y: 0 }); onNavigate('siguiente'); }}>›</button>
                </div>

                {/* PANEL LATERAL DE CONTROL NEÓN */}
                <div className="modal-panel">
                    <div className="modal-panel-header">
                        <div className="modal-panel-titulo">{fotoLocal.titulo || 'SIN TÍTULO'}</div>
                        <div className="modal-panel-meta">
                            {fotoLocal.anio && `📅 ${fotoLocal.anio}`}
                            {fotoLocal.lugar && ` · 📍 ${fotoLocal.lugar}`}
                        </div>
                    </div>

                    {modoEdicion && (
                        <div className="modal-edit-panel">
                            <div className="modal-panel-label">Título</div>
                            <input className="modal-edit-input" value={editData.titulo} onChange={e => setEditData(d => ({...d, titulo: e.target.value}))} placeholder="Título..." />

                            <div className="modal-panel-label">Año / Mes</div>
                            <div style={{display:'flex', gap:'6px'}}>
                                <input className="modal-edit-input" type="number" value={editData.anio} onChange={e => setEditData(d => ({...d, anio: e.target.value}))} placeholder="Año" style={{flex:1}} />
                                <select className="modal-edit-input" value={editData.mes} onChange={e => setEditData(d => ({...d, mes: e.target.value}))} style={{flex:1}}>
                                    <option value="">Mes</option>
                                    {['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'].map((m,i) => (
                                        <option key={i+1} value={i+1}>{m}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="modal-panel-label">Tags</div>
                            <div className="modal-edit-tags-container">
                                {(editData.etiquetas || '').split(',').filter(t => t.trim()).map((tag, i) => (
                                    <span key={i} className="modal-edit-tag-pill">
                                        #{tag.trim()}
                                        <button onClick={() => quitarTag(tag.trim())}>×</button>
                                    </span>
                                ))}
                            </div>
                            <div className="modal-edit-create-row">
                                <input className="modal-edit-input" value={nuevoTag} onChange={e => setNuevoTag(e.target.value)} placeholder="Nuevo tag..." onKeyDown={e => e.key === 'Enter' && agregarTag()} style={{flex:1}} />
                                <button className="modal-edit-create-btn" onClick={agregarTag}>+</button>
                            </div>

                            <div className="modal-panel-label">Lugar</div>
                            <input className="modal-edit-input" value={editData.lugar} onChange={e => setEditData(d => ({...d, lugar: e.target.value}))} placeholder="Lugar..." />

                            <div className="modal-panel-label">Descripción</div>
                            <textarea className="modal-edit-input" value={editData.descripcion} onChange={e => setEditData(d => ({...d, descripcion: e.target.value}))} placeholder="Descripción..." rows={2} style={{resize:'vertical'}} />

                            <div className="modal-panel-label">Personas</div>
                            <div className="modal-edit-checks">
                                {todasPersonas.map(p => {
                                    const personasIds = editData.personas_ids !== undefined ? editData.personas_ids : personas.map(x => x.id);
                                    const checked = personasIds.includes(p.id);
                                    return (
                                        <div key={p.id} className="modal-edit-item-row">
                                            <label className="modal-edit-check-label" style={{flex:1}}>
                                                <input type="checkbox" checked={checked} onChange={() => {
                                                    const ids = personasIds.includes(p.id)
                                                        ? personasIds.filter(id => id !== p.id)
                                                        : [...personasIds, p.id];
                                                    setEditData(d => ({...d, personas_ids: ids}));
                                                }} />
                                                {p.nombre}
                                            </label>
                                            <button className="modal-edit-delete-btn" onClick={() => borrarPersona(p.id)} title="Eliminar persona">×</button>
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="modal-edit-create-row">
                                <input className="modal-edit-input" value={nuevaPersona} onChange={e => setNuevaPersona(e.target.value)} placeholder="Nueva persona..." onKeyDown={e => e.key === 'Enter' && crearPersona()} style={{flex:1}} />
                                <button className="modal-edit-create-btn" onClick={crearPersona}>+</button>
                            </div>

                            <div className="modal-panel-label">Álbumes</div>
                            <div className="modal-edit-checks">
                                {todosAlbumes.map(a => {
                                    const albumIds = editData.albums_ids !== undefined ? editData.albums_ids : albumsActuales.map(x => x.id);
                                    const checked = albumIds.includes(a.id);
                                    return (
                                        <div key={a.id} className="modal-edit-item-row">
                                            <label className="modal-edit-check-label" style={{flex:1}}>
                                                <input type="checkbox" checked={checked} onChange={() => {
                                                    const ids = albumIds.includes(a.id)
                                                        ? albumIds.filter(id => id !== a.id)
                                                        : [...albumIds, a.id];
                                                    setEditData(d => ({...d, albums_ids: ids}));
                                                }} />
                                                {a.privado ? '🔒 ' : ''}{a.nombre}
                                            </label>
                                            <button className="modal-edit-delete-btn" onClick={() => borrarAlbum(a.id)} title="Eliminar álbum">×</button>
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="modal-edit-create-row">
                                <input className="modal-edit-input" value={nuevoAlbum} onChange={e => setNuevoAlbum(e.target.value)} placeholder="Nuevo álbum..." onKeyDown={e => e.key === 'Enter' && crearAlbum()} style={{flex:1}} />
                                <button className="modal-edit-create-btn" onClick={() => setNuevoAlbumPrivado(!nuevoAlbumPrivado)} title={nuevoAlbumPrivado ? "Álbum Privado activo" : "Hacer Privado"} style={{ opacity: nuevoAlbumPrivado ? 1 : 0.4 }}>🔒</button>
                                <button className="modal-edit-create-btn" onClick={crearAlbum}>+</button>
                            </div>

                            <div className="modal-panel-label">Eventos</div>
                            <div className="modal-edit-checks">
                                {todosEventos.map(ev => {
                                    const evIds = editData.eventos_ids !== undefined ? editData.eventos_ids : eventosActuales.map(x => x.id);
                                    const checked = evIds.includes(ev.id);
                                    return (
                                        <div key={ev.id} className="modal-edit-item-row">
                                            <label className="modal-edit-check-label" style={{flex:1}}>
                                                <input type="checkbox" checked={checked} onChange={() => {
                                                    const ids = evIds.includes(ev.id)
                                                        ? evIds.filter(id => id !== ev.id)
                                                        : [...evIds, ev.id];
                                                    setEditData(d => ({...d, eventos_ids: ids}));
                                                }} />
                                                {ev.nombre}
                                            </label>
                                            <button className="modal-edit-delete-btn" onClick={() => borrarEvento(ev.id)} title="Eliminar evento">×</button>
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="modal-edit-create-row">
                                <input className="modal-edit-input" value={nuevoEvento} onChange={e => setNuevoEvento(e.target.value)} placeholder="Nuevo evento..." onKeyDown={e => e.key === 'Enter' && crearEvento()} style={{flex:1}} />
                                <button className="modal-edit-create-btn" onClick={crearEvento}>+</button>
                            </div>

                            <button className="btn-accion-modal" style={{marginTop:'8px', background:'var(--acento, var(--acento-turquesa))', color:'#000', fontWeight:'bold'}} onClick={guardarEdicion}>
                                Guardar cambios
                            </button>
                        </div>
                    )}
  
                    {/* ORGANIZACIÓN RÁPIDA (ÁLBUMES) - FUERA DE EDICIÓN PARA MÁS VELOCIDAD */}
                    {/* ORGANIZACIÓN RÁPIDA (ÁLBUMES Y EVENTOS) - REFACTORIZADO */}
                    {!modoEdicion && (
                        <div className="modal-info-box" style={{ background: 'rgba(0, 255, 255, 0.05)', border: '1px solid rgba(0, 255, 255, 0.2)', padding:'12px', borderRadius:'10px' }}>
                            <div className="organizador-zoom-box">
                                {/* ÁLBUMES */}
                                <div style={{ marginBottom: '15px' }}>
                                    <div className="modal-panel-label" style={{ color: 'var(--acento, var(--acento-turquesa))', marginBottom: '5px', fontSize:'0.7rem' }}>📁 ÁLBUM</div>
                                    <select 
                                        className="modal-edit-input" 
                                        style={{ width: '100%', marginBottom: '5px' }}
                                        onChange={async (e) => {
                                            const albumId = e.target.value;
                                            if (!albumId) return;
                                            await apiFetch(`${API}/albumes/${albumId}/fotos`, {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({ foto_id: fotoLocal.id })
                                            });
                                            const r = await apiFetch(`${API}/fotos/${fotoLocal.id}/albumes`);
                                            setAlbumsActuales(await r.json());
                                        }}
                                        value=""
                                    >
                                        <option value="" disabled>Seleccionar álbum...</option>
                                        {todosAlbumes.map(a => <option key={a.id} value={a.id}>{a.nombre.toUpperCase()}</option>)}
                                    </select>
                                    <div style={{ display: 'flex', gap: '5px' }}>
                                        <input className="modal-edit-input" style={{ flex: 1, fontSize: '0.75rem' }} placeholder="Nuevo álbum..." value={nuevoAlbum} onChange={e => setNuevoAlbum(e.target.value)} onKeyDown={e => e.key === 'Enter' && crearAlbum()} />
                                        <button className="modal-edit-create-btn" onClick={crearAlbum}>+</button>
                                    </div>
                                </div>

                                {/* EVENTOS */}
                                <div>
                                    <div className="modal-panel-label" style={{ color: '#ff00ff', marginBottom: '5px', fontSize:'0.7rem' }}>🎭 EVENTO</div>
                                    <select 
                                        className="modal-edit-input" 
                                        style={{ width: '100%', marginBottom: '5px' }}
                                        onChange={(e) => añadirAEventoRapido(e.target.value)}
                                        value=""
                                    >
                                        <option value="" disabled>Seleccionar evento...</option>
                                        {todosEventos.map(ev => <option key={ev.id} value={ev.id}>{ev.nombre.toUpperCase()}</option>)}
                                    </select>
                                    <div style={{ display: 'flex', gap: '5px' }}>
                                        <input className="modal-edit-input" style={{ flex: 1, fontSize: '0.75rem' }} placeholder="Nuevo evento..." value={nuevoEvento} onChange={e => setNuevoEvento(e.target.value)} onKeyDown={e => e.key === 'Enter' && crearEvento()} />
                                        <button className="modal-edit-create-btn" onClick={crearEvento} style={{background:'#ff00ff'}}>+</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {fotoLocal.descripcion && (
                        <div className="modal-info-box">
                            <div className="modal-panel-label">Descripción</div>
                            <div className="modal-desc-text">{fotoLocal.descripcion}</div>
                        </div>
                    )}

                    {(tags.length > 0 || personas.length > 0 || albumsActuales.length > 0 || eventosActuales.length > 0) && (
                        <div className="modal-info-box">
                            <div className="modal-panel-label">Categorías / Tags</div>
                            <div className="modal-tags">
                                {albumsActuales.map(a => <span key={a.id} className="modal-tag" style={{ border: '1px solid #00ff55', color: '#00ff55' }}>📁 {a.nombre}</span>)}
                                {eventosActuales.map(ev => <span key={ev.id} className="modal-tag" style={{ border: '1px solid #ff00ff', color: '#ff00ff' }}>🎭 {ev.nombre}</span>)}
                                {tags.map((tag, i) => <button key={i} className="modal-tag" onClick={() => { setBusqueda(tag.trim()); onClose(); }}>#{tag.trim()}</button>)}
                                {personas.map(p => <span key={p.id} className="modal-tag">👤 {p.nombre}</span>)}
                            </div>
                        </div>
                    )}

                    <div style={{ marginTop: 'auto', textAlign: 'center', opacity: 0.5, fontSize: '0.7rem' }}>
                        Usa la rueda para zoom · Flechas para navegar
                    </div>
                </div>
            </div>

            {/* LAS ACCIONES FLOTANTES (REEMPLAZO DE LA BARRA DE BOTONES) */}
            <div className="modal-floating-actions" style={{ position: 'absolute', top: '20px', left: '20px', zIndex: 10000 }}>
                 <div style={{ position: 'relative' }}>
                    <button 
                        className="btn-cerrar-modal" 
                        style={{ position: 'static', background: 'rgba(10,11,46,0.8)', border: '1px solid #00ffff', boxShadow: '0 0 10px rgba(0,255,255,0.2)' }}
                        onClick={(e) => { e.stopPropagation(); setMenuOpcionesAbierto(!menuOpcionesAbierto); }}
                    >
                        ⋮
                    </button>
                    
                    {menuOpcionesAbierto && (
                        <div className="zoom-floating-menu" 
                             onClick={e => e.stopPropagation()} 
                             style={{ position: 'absolute', top: '50px', left: 0, background: '#0a0a1a', border: '1px solid #00ffff', borderRadius: '8px', zIndex: 10001, minWidth: '180px', padding: '5px', boxShadow: '0 0 20px rgba(0,255,255,0.4)', animation: 'fadeInScale 0.2s ease-out' }}
                        >
                            <button onClick={() => { setEscala(1); setPos({ x: 0, y: 0 }); setMenuOpcionesAbierto(false); }} className="floating-menu-btn">🔍 Restaurar Zoom</button>
                            <button onClick={() => { girar(); setMenuOpcionesAbierto(false); }} className="floating-menu-btn">🔄 Girar 90°</button>
                            {fotoLocal.latitud && (
                                <button onClick={() => { navigate(`/mapa?fotoId=${fotoLocal.id}`); setMenuOpcionesAbierto(false); }} className="floating-menu-btn" style={{ color: 'var(--acento, var(--acento-turquesa))' }}>📍 Ver en Mapa</button>
                            )}
                            <button onClick={() => { toggleFav(); setMenuOpcionesAbierto(false); }} className="floating-menu-btn">
                                {fotoLocal.favorito ? "⭐ Quitar Favorito" : "🌑 Marcar Favorito"}
                            </button>
                            <button onClick={() => { setModoEdicion(true); setMenuOpcionesAbierto(false); }} className="floating-menu-btn">✏️ Editar Datos</button>
                            <button onClick={() => { descargar(); setMenuOpcionesAbierto(false); }} className="floating-menu-btn">📥 Descargar</button>
                            <button onClick={() => { onBorrar(fotoLocal.id); setMenuOpcionesAbierto(false); }} className="floating-menu-btn" style={{ color: '#ff0044' }}>🗑️ Borrar Activo</button>
                        </div>
                    )}
                 </div>
            </div>
            
            <div className="modal-zoom-info">
                ZOOM: {Math.round(escala * 100)}% · ID: {fotoLocal.id}
            </div>
        </div>,
        document.body
    );
};

export default ModalZoom;
