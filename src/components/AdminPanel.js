import React, { useState, useEffect } from 'react';
import './admin.css';
import { apiFetch } from '../api';
import { useAuth } from '../AuthContext';

const AdminPanel = () => {
    const { token } = useAuth();

    // --- CONFIGURACIÓN DE RED IP DIRECTA ---
    const API_URL = "http://127.0.0.1:5001/api";
    const URL_BASE_FOTOS = "http://127.0.0.1:5001/uploads/";

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
    const [paginaActual, setPaginaActual] = useState(1);
    const fotosPorPagina = 12;

    const [fotoEnZoom, setFotoEnZoom] = useState(null);
    const [rotacion, setRotacion] = useState(0);

    const getFotoUrl = (foto) => {
        if (!foto || !foto.imagen_url) return 'https://placehold.co/100x100?text=Sin+Dato';
        let rutaLimpia = foto.imagen_url.replace(/\\/g, '/');
        const parteABorrar = "E:/archipeg/FOTOS PARA SUBIR/";
        if (rutaLimpia.includes("E:")) {
            rutaLimpia = rutaLimpia.replace(parteABorrar, "");
        }
        return `${URL_BASE_FOTOS}${encodeURI(rutaLimpia)}`;
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
    }, []);

    const girarFoto = () => setRotacion(prev => (prev + 90) % 360);

    const manejarCambioArchivos = (e) => {
        setArchivos(Array.from(e.target.files).filter(f => f.type.startsWith('image/')));
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

    const fotosFiltradas = fotos.filter(foto => {
        const bAnio = busquedaAnio.toString().trim();
        const bMes = busquedaMes.toString().trim();
        const bTit = busquedaTitulo.toLowerCase().trim();
        const rutaNorm = (foto.imagen_url || "").replace(/\\/g, "/").toLowerCase();
        const coincideAnio = bAnio === "" || (foto.anio && foto.anio.toString() === bAnio) || rutaNorm.includes(`${bAnio}`);
        const coincideMes = bMes === "" || (foto.mes && foto.mes.toString() === bMes);
        const coincideTitulo = bTit === "" || (foto.titulo || "").toLowerCase().includes(bTit);
        return coincideAnio && coincideMes && coincideTitulo;
    });

    const fotosPaginadas = fotosFiltradas.slice((paginaActual - 1) * fotosPorPagina, paginaActual * fotosPorPagina);

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
                    <button
                        onClick={() => window.location.href = '/'}
                        className="btn-volver-neon"
                    >
                        ⬅ VOLVER
                    </button>
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

                        <button type="submit" className="btn-archipeg-main-morado">💾 GUARDAR EN BASE DE DATOS</button>
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
                        <input type="number" placeholder="AÑO" value={busquedaAnio} onChange={(e) => { setBusquedaAnio(e.target.value); setPaginaActual(1); }} className="admin-input" />
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
                                        <td className="td-mini" onClick={() => { setFotoEnZoom(foto); setRotacion(0); }}>
                                            <img src={getFotoUrl(foto)} alt="mini" className="admin-mini-morada" />
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
                </section>
            </main>

            {fotoEnZoom && (
                <div className="archipeg-zoom-overlay" onClick={() => { setFotoEnZoom(null); setRotacion(0); }}>
                    <div className="archipeg-zoom-content" onClick={e => e.stopPropagation()}>
                        <button className="btn-zoom-close-neon" onClick={() => { setFotoEnZoom(null); setRotacion(0); }}>✕</button>

                        <div className="zoom-image-wrapper">
                            <img
                                src={getFotoUrl(fotoEnZoom)}
                                alt="Vista Previa"
                                style={{ transform: `rotate(${rotacion}deg)`, transition: 'transform 0.3s ease' }}
                            />
                        </div>

                        <div className="zoom-sidebar-info">
                            <h3 className="admin-title">{fotoEnZoom.titulo || "SIN TÍTULO"}</h3>
                            <div className="mini-tags-display">
                                {fotoEnZoom.etiquetas ? fotoEnZoom.etiquetas.split(',').map((tag, i) => (
                                    <span key={i} className="tag-badge">{tag.trim()}</span>
                                )) : <span className="tag-badge">S/E</span>}
                            </div>
                            <p className="zoom-desc" style={{ marginTop: '15px', color: '#fff' }}>{fotoEnZoom.descripcion || "Sin descripción técnica."}</p>

                            <div className="zoom-actions-vertical">
                                <button onClick={girarFoto} className="btn-archipeg-action">🔄 GIRAR 90°</button>
                                <button onClick={() => forzarDescarga(getFotoUrl(fotoEnZoom), fotoEnZoom.titulo)} className="btn-archipeg-action">📥 DESCARGAR</button>
                                <button onClick={() => borrarFoto(fotoEnZoom.id)} className="btn-archipeg-action btn-dangerous">🗑️ BORRAR ACTIVO</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminPanel;