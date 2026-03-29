import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../api';
import './duplicados.css';

const API = 'http://localhost:5001/api';
const URL_FOTOS = 'http://localhost:5001/uploads/';
const URL_FOTO_LOCAL = 'http://localhost:5001/api/foto-local?ruta=';

const esRutaAbsoluta = (url) =>
    /^[A-Za-z]:[\\\/]/.test(url) || String(url || '').startsWith('/');

const getFotoUrl = (foto) => {
    if (!foto?.imagen_url) return '';
    const url = String(foto.imagen_url).trim();
    if (esRutaAbsoluta(url)) return URL_FOTO_LOCAL + encodeURIComponent(url);
    return URL_FOTOS + url.replace(/ /g, '%20').replace(/\\/g, '/');
};

const getKey = (foto) => {
    const raw = String(foto?.imagen_url || '').replace(/\\/g, '/').trim();
    if (!raw) return '';
    return raw.split('/').pop().toLowerCase();
};

export default function Duplicados() {
    const navigate = useNavigate();
    const [fotos, setFotos] = useState([]);
    const [seleccionadas, setSeleccionadas] = useState([]);
    const [expandida, setExpandida] = useState(null);
    const [q, setQ] = useState('');
    const [cargando, setCargando] = useState(false);

    // Paginación
    const [paginaActual, setPaginaActual] = useState(1);
    const limitePorPagina = 10;

    useEffect(() => {
        setPaginaActual(1);
    }, [q, fotos]);

    const cargar = async () => {
        setCargando(true);
        try {
            const res = await apiFetch(`${API}/imagenes-todas`);
            const data = await res.json();
            setFotos(Array.isArray(data) ? data : []);
        } catch (_) {
            setFotos([]);
        } finally {
            setCargando(false);
        }
    };

    useEffect(() => { cargar(); }, []);

    const grupos = useMemo(() => {
        const map = new Map();
        for (const f of fotos) {
            const key = getKey(f);
            if (!key) continue;
            const arr = map.get(key) || [];
            arr.push(f);
            map.set(key, arr);
        }
        const out = [];
        for (const [key, arr] of map.entries()) {
            if (arr.length > 1) {
                out.push({ key, items: arr.sort((a, b) => (b.id || 0) - (a.id || 0)) });
            }
        }
        out.sort((a, b) => b.items.length - a.items.length);
        const qn = q.trim().toLowerCase();
        return qn ? out.filter(g => g.key.includes(qn)) : out;
    }, [fotos, q]);

    const totalDuplicadas = useMemo(() => grupos.reduce((acc, g) => acc + g.items.length, 0), [grupos]);

    const gruposPaginados = useMemo(() => {
        const inicio = (paginaActual - 1) * limitePorPagina;
        return grupos.slice(inicio, inicio + limitePorPagina);
    }, [grupos, paginaActual]);
    const totalPaginas = Math.ceil(grupos.length / limitePorPagina);

    const toggle = (id) => {
        setSeleccionadas(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    };

    const seleccionarGrupoMenosUna = (grupoKey) => {
        const g = grupos.find(x => x.key === grupoKey);
        if (!g) return;
        const ids = g.items.map(it => it.id).filter(Boolean);
        const aBorrar = ids.slice(1); // dejamos la primera
        setSeleccionadas(prev => Array.from(new Set([...prev, ...aBorrar])));
    };

    const seleccionarGrupoTodo = (grupoKey) => {
        const g = grupos.find(x => x.key === grupoKey);
        if (!g) return;
        const ids = g.items.map(it => it.id).filter(Boolean);
        setSeleccionadas(prev => Array.from(new Set([...prev, ...ids])));
    };

    const limpiarSeleccion = () => setSeleccionadas([]);

    const borrarSeleccionadas = async () => {
        if (seleccionadas.length === 0) return;
        if (!window.confirm(`¿Mover ${seleccionadas.length} fotos duplicadas a la papelera?`)) return;
        try {
            await Promise.all(seleccionadas.map(id => apiFetch(`${API}/imagenes/${id}`, { method: 'DELETE' })));
            setSeleccionadas([]);
            await cargar();
        } catch (_) { /* noop */ }
    };

    return (
        <div className="duplicados-page">
            <header className="duplicados-header">
                <button className="btn-header-neon" onClick={() => navigate('/galeria-completa')}>⬅ VOLVER</button>
                <div className="duplicados-title-wrap">
                    <h1 className="duplicados-title">DUPLICADOS</h1>
                    <div className="duplicados-sub">
                        {cargando ? 'Analizando...' : `${grupos.length} grupos · ${totalDuplicadas} fotos`}
                    </div>
                </div>

                <div className="duplicados-actions">
                    <input
                        className="input-neon"
                        placeholder="Buscar nombre de archivo..."
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                    />
                    <button className="btn-header-neon btn-fucsia-neon" onClick={limpiarSeleccion} disabled={seleccionadas.length === 0}>
                        LIMPIAR SELECCIÓN
                    </button>
                    <button className="btn-header-neon" onClick={borrarSeleccionadas} disabled={seleccionadas.length === 0}>
                        🗑️ BORRAR ({seleccionadas.length})
                    </button>
                </div>
            </header>

            <main className="duplicados-main">
                {grupos.length === 0 && !cargando && (
                    <div className="duplicados-empty">
                        No hay duplicados detectados (por nombre de archivo).
                    </div>
                )}

                <div className="duplicados-grid">
                    {gruposPaginados.map((g) => {
                        const abierta = expandida === g.key;
                        const cover = g.items[0];
                        const selectedInGroup = g.items.filter(it => seleccionadas.includes(it.id)).length;

                        return (
                            <section key={g.key} className="duplicados-card">
                                <div className="duplicados-card-head">
                                    <div className="duplicados-cover" onClick={() => setExpandida(abierta ? null : g.key)} role="button" tabIndex={0}>
                                        <img src={getFotoUrl(cover)} alt={g.key} loading="lazy" />
                                        <div className="duplicados-badge">{g.items.length}x</div>
                                    </div>
                                    <div className="duplicados-meta">
                                        <div className="duplicados-filename" title={g.key}>{g.key}</div>
                                        <div className="duplicados-meta-sub">
                                            Seleccionadas: {selectedInGroup}/{g.items.length}
                                        </div>
                                        <div className="duplicados-btns">
                                            <button className="dup-btn" onClick={() => seleccionarGrupoMenosUna(g.key)}>
                                                SELEC. -1
                                            </button>
                                            <button className="dup-btn" onClick={() => seleccionarGrupoTodo(g.key)}>
                                                SELEC. TODO
                                            </button>
                                            <button className="dup-btn dup-btn-open" onClick={() => setExpandida(abierta ? null : g.key)}>
                                                {abierta ? 'CERRAR' : 'VER'}
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {abierta && (
                                    <div className="duplicados-items">
                                        {g.items.map((foto) => {
                                            const isSel = seleccionadas.includes(foto.id);
                                            return (
                                                <div
                                                    key={foto.id}
                                                    className={`duplicados-item ${isSel ? 'selected' : ''}`}
                                                    onClick={() => toggle(foto.id)}
                                                    title={foto.titulo || `ID ${foto.id}`}
                                                >
                                                    <img src={getFotoUrl(foto)} alt="" loading="lazy" />
                                                    <div className="duplicados-item-foot">
                                                        <span>#{foto.id}</span>
                                                        <span>{foto.mes || '?'}/{foto.anio || '?'}</span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </section>
                        );
                    })}
                </div>

                {totalPaginas > 1 && (
                    <div className="duplicados-paginacion" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '15px', marginTop: '20px' }}>
                        <button 
                            className="btn-header-neon" 
                            disabled={paginaActual === 1}
                            onClick={() => setPaginaActual(p => Math.max(1, p - 1))}
                        >
                            ◀ ANTERIOR
                        </button>
                        <span style={{ color: '#00ffff', fontFamily: 'monospace' }}>
                            PÁGINA {paginaActual} DE {totalPaginas}
                        </span>
                        <button 
                            className="btn-header-neon" 
                            disabled={paginaActual === totalPaginas}
                            onClick={() => setPaginaActual(p => Math.min(totalPaginas, p + 1))}
                        >
                            SIGUIENTE ▶
                        </button>
                    </div>
                )}
            </main>
        </div>
    );
}

