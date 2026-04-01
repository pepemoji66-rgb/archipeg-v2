import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import './admin.css';
import { apiFetch } from '../api';
import { useAuth } from '../AuthContext';
import { API_BASE_URL, UPLOADS_URL, FOTO_LOCAL_URL } from '../config';

const IS_LOCAL = window.location.hostname === 'localhost';

const AdminPanel = () => {
    const { usuario, token } = useAuth();

    // --- CONFIGURACIÓN DE RED ---
    const API_URL = `${API_BASE_URL}/api`;
    const URL_BASE_FOTOS = UPLOADS_URL;
    const URL_FOTO_LOCAL_BASE = FOTO_LOCAL_URL;
    const PLACEHOLDER_IMG = (() => {
        const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'>
            <rect x='2' y='2' width='96' height='96' rx='8' ry='8' fill='#0a0a1a' stroke='#00ffff' stroke-width='2'/>
            <text x='50' y='50' text-anchor='middle' dominant-baseline='middle' font-family='Segoe UI, Arial' font-size='12' fill='#00ffff'>Sin imagen</text>
        </svg>`;
        return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    })();

    const esRutaAbsoluta = (url) =>
        /^[A-Za-z]:[\\\/]/.test(url) || url.startsWith('/');

    const nombreMeses = [
        "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
        "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
    ];

    const [fotos, setFotos] = useState([]);
    const [archivos, setArchivos] = useState([]);
    const [titulo, setTitulo] = useState("");
    const [anio, setAnio] = useState(2026);
    const [etiquetas, setEtiquetas] = useState("");
    const [descripcion, setDescripcion] = useState("");
    const [lugar, setLugar] = useState("");
    const [personas, setPersonas] = useState([]);
    const [personasSeleccionadas, setPersonasSeleccionadas] = useState([]);
    const [albumes, setAlbumes] = useState([]);
    const [albumSeleccionado, setAlbumSeleccionado] = useState("");
    const [mensaje, setMensaje] = useState("");
    const [progreso, setProgreso] = useState(0);

    const [busquedaAnio, setBusquedaAnio] = useState("");
    const [busquedaMes, setBusquedaMes] = useState("");
    const [busquedaTitulo, setBusquedaTitulo] = useState("");
    const [aniosDb, setAniosDb] = useState([]);
    const [paginaActual, setPaginaActual] = useState(1);
    const [inputPage, setInputPage] = useState("1");
    const fotosPorPagina = 12;

    const [fotoEnZoom, setFotoEnZoom] = useState(null);
    const [rotacion, setRotacion] = useState(0);
    const [escalaZoom, setEscalaZoom] = useState(1);
    const zoomWrapperRef = useRef(null);
    // Las variables y función para la navegación de zoom se declaran más abajo para tener acceso a fotosFiltradas

    // --- LÓGICA DE RUTAS CORREGIDA ---
    const getFotoUrl = (foto) => {
        if (!foto || !foto.imagen_url) return PLACEHOLDER_IMG;

        const url = String(foto.imagen_url).trim();
        if (esRutaAbsoluta(url)) {
            // Si la BD guarda ruta absoluta, usamos el endpoint que lee desde disco.
            return `${URL_FOTO_LOCAL_BASE}${encodeURIComponent(url)}`;
        }

        // Si no es ruta absoluta, asumimos que `imagen_url` es el nombre relativo al directorio servido en `/uploads`.
        return `${URL_BASE_FOTOS}${url.replace(/ /g, '%20').replace(/\\/g, '/')}`;
    };

    const cargarFotos = () => {
        apiFetch(`${API_URL}/imagenes`)
            .then(res => res.ok ? res.json() : [])
            .then(data => setFotos(data.sort((a, b) => b.id - a.id)))
            .catch(err => console.error("Error API:", err));
    };

    useEffect(() => {
        cargarFotos();
        apiFetch(`${API_URL}/personas`).then(r => r.json()).then(setPersonas).catch(() => { });
        apiFetch(`${API_URL}/albumes`).then(r => r.json()).then(setAlbumes).catch(() => { });
        apiFetch(`${API_URL}/anios`).then(r => r.json()).then(data => setAniosDb(data.map(a => a.anio).filter(Boolean))).catch(() => { });
    }, []);

    // Bloquear el scroll del fondo cuando el modal de zoom esté abierto
    useEffect(() => {
        const bodyRoot = document.querySelector('body');
        const mainScroll = document.querySelector('.admin-container');
        
        if (fotoEnZoom) {
            bodyRoot.style.overflow = 'hidden';
            if (mainScroll) mainScroll.style.overflow = 'hidden';
        } else {
            bodyRoot.style.overflow = 'auto';
            if (mainScroll) mainScroll.style.overflow = '';
        }
        return () => { 
            bodyRoot.style.overflow = 'auto'; 
            if (mainScroll) mainScroll.style.overflow = '';
        };
    }, [fotoEnZoom]);

    // Sincronizar el input de la página cuando la página actual cambia (p. ej. por las flechas)
    useEffect(() => {
        setInputPage(paginaActual.toString());
    }, [paginaActual]);

    // Controlador nativo para interceptar la rueda del ratón y hacer PREVENT DEFAULT absoluto
    useEffect(() => {
        const handleWheel = (e) => {
            e.preventDefault(); // Esto detiene el scroll de toda la página irrevocablemente
            setEscalaZoom(prev => Math.min(Math.max(0.5, prev - e.deltaY * 0.002), 5));
        };
        const el = zoomWrapperRef.current;
        if (el && fotoEnZoom) {
            el.addEventListener('wheel', handleWheel, { passive: false });
        }
        return () => {
            if (el) el.removeEventListener('wheel', handleWheel);
        };
    }, [fotoEnZoom]);

    const girarFoto = () => setRotacion(prev => (prev + 90) % 360);

    const manejarCambioArchivos = (e) => {
        setArchivos(Array.from(e.target.files).filter(f => f.type.startsWith('image/')));
    };

    // --- FUNCIÓN DE LIMPIEZA TOTAL (BOTÓN DE PÁNICO) ---
    const ejecutarLimpiezaTotal = async () => {
        const confirmacion1 = window.confirm("⚠️ ¿ESTÁS SEGURO, HERMANO?\n\nEsto borrará los registros de las 11.000 fotos de la base de datos, pero NO tocará tus archivos en el disco duro.");
        if (!confirmacion1) return;

        const confirmacion2 = window.confirm("🚨 ÚLTIMA ADVERTENCIA 🚨\n\n¿Seguro que quieres dejar la biblioteca a cero?");
        if (!confirmacion2) return;

        try {
            setMensaje("Vaciando base de datos...");
            const res = await fetch(`${API_URL}/sistema/limpiar-todo`, {
                method: 'POST',
                headers: {
                    'Authorization': token ? `Bearer ${token}` : ''
                }
            });

            if (res.ok) {
                alert("¡Hecho! La biblioteca está vacía. Ya puedes meter las 3.800 reales.");
                setMensaje("✅ Sistema reiniciado.");
                cargarFotos();
            } else {
                alert("Error al limpiar. Revisa que la ruta exista en el server.js");
            }
        } catch (error) {
            alert("Error de conexión con el servidor.");
        }
    };

    const manejarSubida = (e) => {
        e.preventDefault();
        if (archivos.length === 0) return alert("Selecciona fotos válidas, hermano");

        const formData = new FormData();
        archivos.forEach(f => formData.append('foto', f));
        formData.append('titulo', titulo);
        formData.append('anio', anio);
        formData.append('etiquetas', etiquetas);
        formData.append('descripcion', descripcion);
        formData.append('lugar', lugar);

        const xhr = new XMLHttpRequest();
        xhr.open("POST", `${API_URL}/fotos/subir`, true);
        if (token) {
            xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        }

        xhr.upload.addEventListener("progress", (event) => {
            if (event.lengthComputable) setProgreso(Math.round((event.loaded * 100) / event.total));
        });

        xhr.onreadystatechange = async () => {
            if (xhr.readyState === 4 && xhr.status === 200) {
                setMensaje("¡Éxito! Activos guardados en ARCHIPEG");
                const res = await apiFetch(`${API_URL}/imagenes`);
                const actualizadas = await res.json();
                const nuevas = actualizadas.slice(0, archivos.length);

                for (const foto of nuevas) {
                    if (personasSeleccionadas.length > 0) {
                        await apiFetch(`${API_URL}/fotos/${foto.id}/personas`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ persona_ids: personasSeleccionadas })
                        });
                    }
                    if (albumSeleccionado) {
                        await apiFetch(`${API_URL}/albumes/${albumSeleccionado}/fotos`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ foto_id: foto.id })
                        });
                    }
                }
                setTitulo(""); setEtiquetas(""); setLugar(""); setPersonasSeleccionadas([]); setAlbumSeleccionado(""); setArchivos([]); setProgreso(0);
                cargarFotos();
            }
        };
        xhr.send(formData);
    };

    const borrarFoto = async (id) => {
        if (!window.confirm("¿Seguro que quieres enviar este activo a la papelera?")) return;
        try {
            const res = await apiFetch(`${API_URL}/imagenes/${id}`, { method: 'DELETE' });
            if (res.ok) { setFotoEnZoom(null); setRotacion(0); cargarFotos(); }
        } catch (error) { alert("Error de conexión"); }
    };

    const ejecutarImportacionDesdeDisco = async () => {
        try {
            setMensaje("Abriendo selector de Windows...");
            const resRuta = await fetch(`${API_URL}/seleccionar-carpeta`);
            const dataRuta = await resRuta.json();

            if (!dataRuta.ruta) {
                setMensaje("Operación cancelada.");
                return;
            }

            if (!window.confirm(`¿Importar fotos de: ${dataRuta.ruta}?`)) return;

            setMensaje("🚀 Motor trabajando... Escaneando e importando. No cierres el panel.");
            setProgreso(10); // Inicio rápido para dar feedback visual

            // Simulamos un avance pequeño mientras esperamos la respuesta pesada del servidor
            const interval = setInterval(() => {
                setProgreso(prev => (prev < 90 ? prev + 1 : prev));
            }, 500);

            const resImport = await fetch(`${API_URL}/importar-masivo`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': token ? `Bearer ${token}` : ''
                },
                body: JSON.stringify({ ruta: dataRuta.ruta })
            });

            clearInterval(interval);
            const resultado = await resImport.json();

            if (resImport.ok) {
                setProgreso(100);
                setTimeout(() => {
                    alert(`¡ÉXITO!\n- Nuevas: ${resultado.importadas}\n- Ya estaban: ${resultado.actualizadas}\n- Total: ${resultado.total}`);
                    setMensaje("✅ Importación finalizada con éxito.");
                    setProgreso(0);
                    cargarFotos();
                }, 500);
            } else {
                setProgreso(0);
                alert("Error: " + (resultado.error || "Fallo servidor"));
            }
        } catch (error) {
            setProgreso(0);
            alert("Error de conexión con el motor.");
        }
    };

    const ejecutarRescanGPS = async () => {
        if (!window.confirm("🛰️ ¿Quieres re-escanear tus 5.700 fotos para buscar coordenadas GPS?\n\nEsto no borrará nada, solo añadirá los puntos al mapa.")) return;
        
        try {
            setMensaje("🚀 Iniciando radar EXIF... Leyendo archivos del disco.");
            setProgreso(5);
            
            const res = await fetch(`${API_URL}/sistema/rescan-gps`, {
                method: 'POST',
                headers: {
                    'Authorization': token ? `Bearer ${token}` : ''
                }
            });
            
            if (res.ok) {
                const data = await res.json();
                setProgreso(100);
                setTimeout(() => {
                    alert(`🛰️ ¡Radar completado!\n\nSe han geolocalizado ${data.actualizadas} fotos nuevas.`);
                    setMensaje("✅ Escaneo GPS finalizado.");
                    setProgreso(0);
                    cargarFotos();
                }, 500);
            } else {
                setProgreso(0);
                alert("Error al ejecutar el radar.");
            }
        } catch (error) {
            setProgreso(0);
            alert("Error de conexión con el motor.");
        }
    };

    const fotosFiltradas = fotos.filter(foto => {
        const bAnio = busquedaAnio.toString().trim();
        const bMes = busquedaMes.toString().trim();
        const bTit = busquedaTitulo.toLowerCase().trim();
        
        // Volvemos a incluir la ruta del archivo para que fotos sin "anio" en DB puedan ser localizadas por carpeta
        const rutaNorm = (foto.imagen_url || "").replace(/\\/g, "/").toLowerCase();
        const coincideAnio = bAnio === "" || (foto.anio && foto.anio.toString() === bAnio) || rutaNorm.includes(bAnio);
        const coincideMes = bMes === "" || (foto.mes && foto.mes.toString() === bMes);
        const coincideTitulo = bTit === "" || (foto.titulo || "").toLowerCase().includes(bTit) || rutaNorm.includes(bTit);
        
        return coincideAnio && coincideMes && coincideTitulo;
    });

    const totalPaginas = Math.max(1, Math.ceil(fotosFiltradas.length / fotosPorPagina));
    const fotosPaginadas = fotosFiltradas.slice((paginaActual - 1) * fotosPorPagina, paginaActual * fotosPorPagina);

    const idxZoom = fotoEnZoom ? fotosFiltradas.findIndex(f => f.id === fotoEnZoom.id) : -1;
    const prevFoto = idxZoom > 0 ? fotosFiltradas[idxZoom - 1] : null;
    const nextFoto = idxZoom !== -1 && idxZoom < fotosFiltradas.length - 1 ? fotosFiltradas[idxZoom + 1] : null;

    const navegarZoom = (e, targetFoto) => {
        e.stopPropagation();
        if (targetFoto) {
            setFotoEnZoom(targetFoto);
            setRotacion(0);
            setEscalaZoom(1);
        }
    };

    const forzarDescarga = (url, nombre) => {
        fetch(url).then(res => res.blob()).then(blob => {
            const urlBlob = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = urlBlob;
            a.download = nombre || 'archivo_archipeg';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(urlBlob);
        }).catch(() => window.open(url, '_blank'));
    };

    return (
        <div className="admin-container">
            <header className="admin-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                    <button onClick={() => window.location.href = '/'} className="btn-volver-neon">⬅ VOLVER</button>
                    <div>
                        <h1 className="admin-title">GESTIÓN DE ACTIVOS</h1>
                        <span className="section-title" style={{ fontSize: '0.65rem', margin: 0 }}>MOTOR AUTÓNOMO V2.0</span>
                    </div>
                </div>
                <span className="tag-badge">{fotos.length} ACTIVOS EN RED</span>
            </header>

            <main className="admin-content">
                <section className="admin-card">
                    <form onSubmit={manejarSubida}>
                        <h2 className="section-title">➕ INYECTAR NUEVOS ACTIVOS</h2>
                        <div className="form-grid">
                            <input type="text" placeholder="Título" value={titulo} onChange={(e) => setTitulo(e.target.value)} className="admin-input" />
                            <input type="number" value={anio} onChange={(e) => setAnio(e.target.value)} required className="admin-input" />
                            <input type="text" placeholder="Etiquetas" value={etiquetas} onChange={(e) => setEtiquetas(e.target.value)} className="admin-input" />
                            <input type="text" placeholder="Lugar" value={lugar} onChange={(e) => setLugar(e.target.value)} className="admin-input" />
                            <select value={albumSeleccionado} onChange={e => setAlbumSeleccionado(e.target.value)} className="admin-select">
                                <option value="">📁 SIN ÁLBUM</option>
                                {albumes.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
                            </select>
                        </div>
                        <textarea placeholder="Descripción técnica..." value={descripcion} onChange={(e) => setDescripcion(e.target.value)} className="admin-textarea" />

                        {personas.length > 0 && (
                            <div className="mini-tags-display" style={{ margin: '10px 0' }}>
                                {personas.map(p => (
                                    <button key={p.id} type="button"
                                        className={personasSeleccionadas.includes(p.id) ? "tag-badge activa" : "tag-badge"}
                                        style={{ cursor: 'pointer', background: personasSeleccionadas.includes(p.id) ? '#00ffff' : '', color: personasSeleccionadas.includes(p.id) ? '#000' : '' }}
                                        onClick={() => setPersonasSeleccionadas(prev => prev.includes(p.id) ? prev.filter(id => id !== p.id) : [...prev, p.id])}
                                    >
                                        {p.nombre}
                                    </button>
                                ))}
                            </div>
                        )}

                        <div className="file-input-wrapper">
                            <input id="file-upload" type="file" onChange={manejarCambioArchivos} multiple accept="image/*" />
                            <label htmlFor="file-upload" className="btn-file-morado">📂 SELECCIONAR ({archivos.length})</label>
                        </div>

                        {progreso > 0 && (
                            <div className="progreso-container-morado">
                                <div className="progreso-bar-morado" style={{ width: `${progreso}%` }}>{progreso}%</div>
                            </div>
                        )}

                        <div style={{ display: 'flex', gap: '15px', marginTop: '15px', justifyContent: 'center', flexWrap: 'wrap' }}>
                            <button type="submit" className="btn-archipeg-main-morado" style={{ padding: '10px 30px' }}>💾 GUARDAR DB</button>
                            {IS_LOCAL && (
                                <>
                                    <button type="button" className="btn-archipeg-main-morado" style={{ padding: '10px 30px', backgroundColor: '#cf00f1' }} onClick={ejecutarImportacionDesdeDisco}>📂 IMPORTACIÓN DISCO</button>
                                    <button type="button" className="btn-archipeg-main-morado" style={{ padding: '10px 30px', backgroundColor: '#ffaa00', color: '#000' }} onClick={ejecutarRescanGPS}>🛰️ RE-ESCANEAR GPS</button>
                                </>
                            )}
                        </div>
                        {mensaje && <p className="mensaje-feedback-morado">{mensaje}</p>}
                    </form>
                </section>

                <section className="admin-card">
                    <h2 className="section-title">🔍 FILTROS MAESTRO</h2>
                    <div className="admin-controls">
                        <input type="text" placeholder="Buscar título..." value={busquedaTitulo} onChange={(e) => { setBusquedaTitulo(e.target.value); setPaginaActual(1); }} className="admin-input" />
                        <select value={busquedaMes} onChange={(e) => { setBusquedaMes(e.target.value); setPaginaActual(1); }} className="admin-select">
                            <option value="">📅 MESES</option>
                            {nombreMeses.map((mes, index) => <option key={index} value={index + 1}>{mes}</option>)}
                        </select>
                        <input 
                            type="text" 
                            placeholder="AÑO" 
                            list="admin-anios"
                            value={busquedaAnio} 
                            onChange={(e) => { setBusquedaAnio(e.target.value); setPaginaActual(1); }} 
                            className="admin-input" 
                            style={{ maxWidth: '120px' }}
                        />
                        <datalist id="admin-anios">
                            {aniosDb.map(a => <option key={a} value={a} />)}
                        </datalist>
                    </div>

                    <div className="table-responsive">
                        <table className="admin-table">
                            <thead>
                                <tr>
                                    <th>MINI</th>
                                    <th>INFO</th>
                                    <th>FECHA</th>
                                    <th>ACCIONES</th>
                                </tr>
                            </thead>
                            <tbody>
                                {fotosPaginadas.map(foto => (
                                    <tr key={foto.id}>
                                        <td className="td-mini" onClick={() => { setFotoEnZoom(foto); setRotacion(0); setEscalaZoom(1); }}>
                                            <img
                                                src={getFotoUrl(foto)}
                                                alt="mini"
                                                className="admin-mini-morada"
                                                onError={(e) => { e.target.src = PLACEHOLDER_IMG; }}
                                            />
                                        </td>
                                        <td className="td-info">
                                            <span className="foto-titulo">{foto.titulo || "S/T"}</span>
                                            <div className="mini-tags-display">
                                                {foto.etiquetas && foto.etiquetas.split(',').map((tag, idx) => (
                                                    <span key={idx} className="tag-badge">{tag.trim()}</span>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="td-fecha">{foto.mes || '?'}/{foto.anio}</td>
                                        <td className="td-acciones">
                                            <button onClick={() => forzarDescarga(getFotoUrl(foto), foto.titulo)} className="btn-action-icon-morado">📥</button>
                                            <button onClick={() => borrarFoto(foto.id)} className="btn-action-icon-morado btn-borrar">🗑️</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '15px', marginTop: '20px' }}>
                        <button disabled={paginaActual === 1} onClick={() => setPaginaActual(p => p - 1)} className="btn-action-icon-morado" style={{ padding: '5px 15px' }}>◀ ANT</button>
                        
                        <span style={{ color: 'white', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1rem' }}>
                            Página 
                            <input 
                                type="number" 
                                min="1" 
                                max={totalPaginas}
                                value={inputPage} 
                                onChange={(e) => setInputPage(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        let val = parseInt(inputPage, 10);
                                        if (val >= 1 && val <= totalPaginas) setPaginaActual(val);
                                        else setInputPage(paginaActual.toString());
                                    }
                                }}
                                onBlur={() => {
                                    let val = parseInt(inputPage, 10);
                                    if (val >= 1 && val <= totalPaginas) setPaginaActual(val);
                                    else setInputPage(paginaActual.toString());
                                }}
                                className="admin-input"
                                style={{ width: '60px', padding: '5px', textAlign: 'center', appearance: 'textfield' }} 
                            />
                            de {totalPaginas}
                        </span>

                        <button disabled={paginaActual >= totalPaginas} onClick={() => setPaginaActual(p => p + 1)} className="btn-action-icon-morado" style={{ padding: '5px 15px' }}>SIG ▶</button>
                    </div>
                </section>

                {/* --- SECCIÓN DE MANTENIMIENTO (SÓLO ADMIN) --- */}
                {usuario?.esAdmin && (
                    <section className="admin-card" style={{ border: '2px solid #ff0044', background: 'rgba(255, 0, 68, 0.05)', textAlign: 'center' }}>
                        <h2 className="section-title" style={{ color: '#ff0044', justifyContent: 'center' }}>🛠️ ZONA DE MANTENIMIENTO</h2>
                        <p style={{ color: '#ccc', fontSize: '0.8rem', marginBottom: '15px' }}>
                            Usa estas herramientas con precaución. Son operaciones irreversibles sobre la base de datos.
                        </p>
                        <button
                            onClick={ejecutarLimpiezaTotal}
                            className="btn-archipeg-main-morado"
                            style={{ backgroundColor: '#ff0044', fontWeight: 'bold', padding: '15px 40px', fontSize: '1rem' }}
                        >
                            🚨 BORRAR TODOS MIS ACTIVOS (RESET PROPIO)
                        </button>
                    </section>
                )}
            </main>

            {/* MODAL ZOOM CON REACT PORTAL PARA SOLUCIONAR EL CENTRADO */}
            {fotoEnZoom && createPortal(
                <div className="archipeg-zoom-overlay" onClick={() => { setFotoEnZoom(null); setRotacion(0); setEscalaZoom(1); }}>
                    
                    {prevFoto && (
                        <button className="btn-zoom-nav-admin left" onClick={(e) => navegarZoom(e, prevFoto)}>◀</button>
                    )}

                    {nextFoto && (
                        <button className="btn-zoom-nav-admin right" onClick={(e) => navegarZoom(e, nextFoto)}>▶</button>
                    )}

                    <div className="archipeg-zoom-content" onClick={e => e.stopPropagation()}>
                        <button className="btn-zoom-close-neon" onClick={() => { setFotoEnZoom(null); setRotacion(0); setEscalaZoom(1); }}>✕</button>

                        <div className="zoom-image-wrapper" ref={zoomWrapperRef}>
                            <img 
                                src={getFotoUrl(fotoEnZoom)} 
                                alt="Preview" 
                                style={{ transform: `rotate(${rotacion}deg) scale(${escalaZoom})`, transition: 'transform 0.1s ease-out', maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} 
                            />
                        </div>

                        <div className="zoom-sidebar-info">
                            <h3 className="admin-title">{fotoEnZoom.titulo || "S/T"}</h3>
                            <div className="mini-tags-display">
                                {fotoEnZoom.etiquetas ? fotoEnZoom.etiquetas.split(',').map((tag, i) => <span key={i} className="tag-badge">{tag.trim()}</span>) : <span className="tag-badge">S/E</span>}
                            </div>
                            <p className="zoom-desc" style={{ marginTop: '15px', color: '#fff' }}>{fotoEnZoom.descripcion || "Sin descripción."}</p>
                            <div className="zoom-actions-vertical">
                                <span style={{color: '#94a3b8', fontSize: '0.8rem', textAlign: 'center'}}>Usa la rueda del ratón para hacer zoom</span>
                                <button onClick={(e) => { e.stopPropagation(); setEscalaZoom(1); }} className="btn-archipeg-action">🔍 RESTAURAR ZOOM</button>
                                <button onClick={girarFoto} className="btn-archipeg-action">🔄 GIRAR</button>
                                <button onClick={() => forzarDescarga(getFotoUrl(fotoEnZoom), fotoEnZoom.titulo)} className="btn-archipeg-action">📥 DESCARGAR</button>
                                <button onClick={() => borrarFoto(fotoEnZoom.id)} className="btn-archipeg-action btn-dangerous">🗑️ BORRAR</button>
                            </div>
                        </div>
                    </div>
                </div>, 
                document.body
            )}
        </div>
    );
};

export default AdminPanel;