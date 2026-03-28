import React, { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import ModalZoom from './ModalZoom';
import './galeria.css';
import { apiFetch } from '../api';

const API = 'http://localhost:5001/api';
const URL_FOTOS = 'http://localhost:5001/uploads/';
const URL_FOTO_LOCAL = 'http://localhost:5001/api/foto-local?ruta=';

const esRutaAbsoluta = (url) =>
    /^[A-Za-z]:[\\\/]/.test(url) || url.startsWith('/');

const getFotoUrl = (foto) => {
    if (!foto?.imagen_url) return '';
    const url = foto.imagen_url.trim();
    if (esRutaAbsoluta(url)) {
        return URL_FOTO_LOCAL + encodeURIComponent(url);
    }
    return URL_FOTOS + url.replace(/ /g, '%20').replace(/\\/g, '/');
};

const normalizar = (str) =>
    str?.toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() || '';

const Galeria = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const params = new URLSearchParams(location.search);
    const qInicial = params.get('q') || '';

    const [fotos, setFotos] = useState([]);
    const [busqueda, setBusqueda] = useState(qInicial);
    const [busquedaMes, setBusquedaMes] = useState('');
    const [paginaActual, setPaginaActual] = useState(1);
    const [saltoInput, setSaltoInput] = useState('');
    const [seleccionadas, setSeleccionadas] = useState([]);
    const [modoSeleccion, setModoSeleccion] = useState(false);
    const [fotoZoom, setFotoZoom] = useState(null);
    const [rutaImport, setRutaImport] = useState('');
    const [importando, setImportando] = useState(false);
    const [resultadoImport, setResultadoImport] = useState(null);

    const fotosPorPagina = 15;

    const cargar = useCallback(async () => {
        try {
            const res = await apiFetch(`${API}/imagenes`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            setFotos(Array.isArray(data) ? data : []);
        } catch (e) { console.error(e); }
    }, []);

    const seleccionarCarpeta = async () => {
        try {
            let ruta = null;
            if (window.ipcRenderer) {
                ruta = await window.ipcRenderer.invoke('seleccionar-carpeta');
            } else {
                const res = await apiFetch(`${API}/seleccionar-carpeta`);
                const data = await res.json();
                ruta = data.ruta;
            }
            if (ruta) {
                setRutaImport(ruta);
                setResultadoImport(null);
            }
        } catch (e) {
            console.error('Error seleccionando carpeta:', e);
        }
    };

    const importarMasivo = async () => {
        if (!rutaImport) return;
        setImportando(true);
        setResultadoImport(null);
        try {
            const res = await apiFetch(`${API}/importar-masivo`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ruta: rutaImport })
            });
            const data = await res.json();
            if (res.ok) {
                setResultadoImport(data);
                await cargar();
            } else {
                setResultadoImport({ error: data.error });
            }
        } catch (_) {
            setResultadoImport({ error: 'Error de conexión' });
        } finally {
            setImportando(false);
        }
    };

    useEffect(() => { cargar(); }, [cargar]);

    const borrarFoto = async (id) => {
        if (!window.confirm('¿Mover esta foto a la papelera?')) return;
        try {
            await apiFetch(`${API}/imagenes/${id}`, { method: 'DELETE' });
            setFotoZoom(null);
            await cargar();
        } catch (e) { console.error(e); }
    };

    const navegarFoto = (direccion) => {
        const idx = fotosFiltradas.findIndex(f => f.id === fotoZoom?.id);
        if (idx === -1) return;
        if (direccion === 'siguiente' && idx < fotosFiltradas.length - 1) setFotoZoom(fotosFiltradas[idx + 1]);
        else if (direccion === 'anterior' && idx > 0) setFotoZoom(fotosFiltradas[idx - 1]);
    };

    // LÓGICA DE CLIC: Seleccionar o Zoom
    const manejarClicFoto = (foto) => {
        if (modoSeleccion) {
            setSeleccionadas(prev =>
                prev.includes(foto.id)
                    ? prev.filter(id => id !== foto.id)
                    : [...prev, foto.id]
            );
        } else {
            // Solo abrimos zoom si NO estamos seleccionando
            setFotoZoom(foto);
        }
    };

    // FUNCIÓN DE DESCARGA MAESTRA (Forzada por Blob)
    const descargarSeleccionadas = async () => {
        console.log("Iniciando descarga de:", seleccionadas);

        for (const id of seleccionadas) {
            const foto = fotos.find(f => f.id === id);
            if (!foto) continue;

            try {
                const url = getFotoUrl(foto);
                const respuesta = await fetch(url);
                const blob = await respuesta.blob();
                const urlBlob = window.URL.createObjectURL(blob);

                const link = document.createElement('a');
                link.href = urlBlob;
                link.download = foto.imagen_url.split('/').pop() || `archipeg_${id}.jpg`;

                document.body.appendChild(link);
                link.click();

                // Limpieza
                document.body.removeChild(link);
                window.URL.revokeObjectURL(urlBlob);

                // Delay para no saturar el stack de descargas del navegador
                await new Promise(r => setTimeout(r, 300));
            } catch (err) {
                console.error("Error al descargar la foto:", id, err);
            }
        }
    };

    const borrarSeleccionadas = async () => {
        if (!window.confirm(`¿Mover ${seleccionadas.length} fotos a la papelera?`)) return;
        try {
            await Promise.all(
                seleccionadas.map(id => apiFetch(`${API}/imagenes/${id}`, { method: 'DELETE' }))
            );
            setSeleccionadas([]);
            setModoSeleccion(false);
            cargar();
        } catch (e) { console.error(e); }
    };

    const toggleFavorito = async (e, foto) => {
        e.stopPropagation();
        try {
            const res = await apiFetch(`${API}/fotos/${foto.id}/favorito`, { method: 'PATCH' });
            const { favorito } = await res.json();
            setFotos(prev => prev.map(f => f.id === foto.id ? { ...f, favorito } : f));
        } catch (e) { console.error(e); }
    };

    const ejecutarSalto = (e) => {
        if (e.key === 'Enter') {
            const num = parseInt(saltoInput);
            if (num > 0 && num <= totalPaginas) {
                setPaginaActual(num);
                setSaltoInput('');
            }
        }
    };

    const fotosFiltradas = fotos.filter(f => {
        const bq = normalizar(busqueda).trim();
        const matchTexto = !bq || [f.titulo, f.anio, f.descripcion, f.etiquetas, f.lugar].some(c => normalizar(c).includes(bq));
        const matchMes = !busquedaMes || f.mes?.toString() === busquedaMes;
        return matchTexto && matchMes;
    });

    const totalPaginas = Math.ceil(fotosFiltradas.length / fotosPorPagina);
    const fotosPaginadas = fotosFiltradas.slice((paginaActual - 1) * fotosPorPagina, paginaActual * fotosPorPagina);

    return (
        <div className="galeria-layout">
            <header className="galeria-header">
                <button className="btn-header-neon" onClick={() => navigate('/')}>🏠 INICIO</button>
                <h1 className="galeria-titulo">ARCHIVO FOTOGRÁFICO</h1>

                <div className="galeria-filtros">
                    <input
                        type="text"
                        className="input-neon"
                        placeholder="Buscar..."
                        value={busqueda}
                        onChange={e => setBusqueda(e.target.value)}
                    />
                </div>

                <div className="galeria-acciones">
                    <button
                        className={`btn-header-neon ${modoSeleccion ? 'btn-active-fucsia' : ''}`}
                        onClick={() => { setModoSeleccion(!modoSeleccion); setSeleccionadas([]); }}
                    >
                        {modoSeleccion ? '❌ CANCELAR' : '🔍 SELECCIONAR'}
                    </button>
                </div>
            </header>

            {/* BARRA DE HERRAMIENTAS SELECCIÓN */}
            <div className={`batch-action-bar ${modoSeleccion && seleccionadas.length > 0 ? 'active' : ''}`}>
                <span className="batch-info">{seleccionadas.length} ITEMS SELECCIONADOS</span>
                <div className="batch-buttons">
                    <button className="btn-batch btn-download" onClick={descargarSeleccionadas}>
                        📥 DESCARGAR
                    </button>
                    <button className="btn-batch btn-delete" onClick={borrarSeleccionadas}>
                        🗑️ BORRAR
                    </button>
                </div>
            </div>

            {/* BARRA DE IMPORTACIÓN MASIVA */}
            <div className="import-bar">
                <button className="btn-import" onClick={seleccionarCarpeta} disabled={importando}>
                    📂 SELECCIONAR DISCO/CARPETA
                </button>
                {rutaImport && (
                    <span className="import-ruta" title={rutaImport}>{rutaImport}</span>
                )}
                {rutaImport && (
                    <button
                        className="btn-import btn-import-action"
                        onClick={importarMasivo}
                        disabled={importando}
                    >
                        {importando ? '⏳ Importando...' : '⚡ IMPORTAR TODAS'}
                    </button>
                )}
                {resultadoImport && !resultadoImport.error && (
                    <span className="import-resultado">
                        ✅ {resultadoImport.importadas} importadas · {resultadoImport.actualizadas} actualizadas · {resultadoImport.ignoradas} ignoradas
                    </span>
                )}
                {resultadoImport?.error && (
                    <span className="import-error">❌ {resultadoImport.error}</span>
                )}
            </div>

            <main className="masonry-grid">
                {fotosPaginadas.map(foto => {
                    const isSelected = seleccionadas.includes(foto.id);
                    return (
                        <div
                            key={foto.id}
                            className={`foto-card ${isSelected ? 'foto-card-seleccionada' : ''}`}
                            onClick={() => manejarClicFoto(foto)}
                        >
                            <img src={getFotoUrl(foto)} alt="" loading="lazy" />

                            {/* Checkmark Neón */}
                            {modoSeleccion && (
                                <div className={`select-badge ${isSelected ? 'selected' : ''}`}>
                                    {isSelected ? '✓' : ''}
                                </div>
                            )}

                            {!modoSeleccion && (
                                <button className="foto-card-fav" onClick={e => toggleFavorito(e, foto)}>
                                    {foto.favorito ? '⭐' : '☆'}
                                </button>
                            )}
                        </div>
                    );
                })}
            </main>

            <footer className="footer-paginacion">
                <div className="paginacion-controles">
                    <button className="btn-pagi-flecha" disabled={paginaActual === 1} onClick={() => setPaginaActual(p => p - 1)}>« ANTERIOR</button>
                    <div className="pagi-salto-zona">
                        <span className="pagi-info">PÁGINA {paginaActual} DE {totalPaginas}</span>
                        <div className="input-salto-wrapper">
                            <input
                                type="number"
                                className="input-salto-neon"
                                value={saltoInput}
                                onChange={e => setSaltoInput(e.target.value)}
                                onKeyDown={ejecutarSalto}
                                placeholder="..."
                            />
                        </div>
                    </div>
                    <button className="btn-pagi-flecha" disabled={paginaActual === totalPaginas} onClick={() => setPaginaActual(p => p + 1)}>SIGUIENTE »</button>
                </div>
            </footer>

            {fotoZoom && !modoSeleccion && (
                <ModalZoom
                    foto={fotoZoom}
                    onClose={() => setFotoZoom(null)}
                    onNavigate={navegarFoto}
                    onBorrar={borrarFoto}
                    getFotoUrl={getFotoUrl}
                    setBusqueda={setBusqueda}
                    onFavoritoToggle={(fAct) => setFotos(prev => prev.map(f => f.id === fAct.id ? fAct : f))}
                />
            )}
        </div>
    );
};

export default Galeria;