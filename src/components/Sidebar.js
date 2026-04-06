import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { apiFetch } from '../api';
import { API_BASE_URL } from '../config';

const API = `${API_BASE_URL}/api`;

const Sidebar = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { usuario, esDemo, logout, refrescarPerfil } = useAuth();
    const [conteos, setConteos] = useState({ fotos: 0, favoritos: 0, albumes: 0, eventos: 0, personas: 0 });
    const [busqueda, setBusqueda] = useState('');

    useEffect(() => {
        if (!usuario && !esDemo) return;
        // Refrescar perfil para ver si ya ha sido aprobado
        if (usuario && !usuario.aprobado) refrescarPerfil();

        const cargar = async () => {
            try {
                const [fotos, favs, albs, evs, pers] = await Promise.all([
                    apiFetch(`${API}/imagenes`).then(r => r.json()),
                    apiFetch(`${API}/favoritos`).then(r => r.json()),
                    apiFetch(`${API}/albumes`).then(r => r.json()),
                    apiFetch(`${API}/eventos`).then(r => r.json()),
                    apiFetch(`${API}/personas`).then(r => r.json()),
                ]);
                setConteos({
                    fotos: Array.isArray(fotos) ? fotos.length : 0,
                    favoritos: Array.isArray(favs) ? favs.length : 0,
                    albumes: Array.isArray(albs) ? albs.length : 0,
                    eventos: Array.isArray(evs) ? evs.length : 0,
                    personas: Array.isArray(pers) ? pers.length : 0,
                });
            } catch (e) { /* servidor no disponible */ }
        };
        cargar();
    }, [location.pathname]);

    const navRef = useRef(null);

    // PERSISTENCIA DE SCROLL: Asegura que el botón activo esté visible
    useEffect(() => {
        if (navRef.current && window.innerWidth <= 768) {
            const activeItem = navRef.current.querySelector('.sidebar-item.active');
            if (activeItem) {
                // Pequeño timeout para asegurar que el DOM se ha actualizado con la clase .active
                setTimeout(() => {
                    activeItem.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                }, 100);
            }
        }
    }, [location.pathname]);

    const LIMITE = 50;
    const porcentaje = Math.min((conteos.fotos / LIMITE) * 100, 100);
    const isActive = (path) => location.pathname === path;

    const handleBusqueda = (e) => {
        if (e.key === 'Enter' && busqueda.trim()) {
            navigate(`/galeria-completa?q=${encodeURIComponent(busqueda.trim())}`);
            setBusqueda('');
        }
    };

    return (
        <aside className="sidebar">
            <div className="sidebar-brand">
                <img src="logo_archipeg_principal.png" alt="Logo" style={{ width: '40px', height: '40px', marginBottom: '10px', objectFit: 'contain' }} />
                <div className="sidebar-brand-name">ARCHIPEG<span className="sidebar-brand-dot"> ·</span></div>
                {esDemo && <div className="sidebar-brand-version">DEMO</div>}
            </div>

            <div className="sidebar-search">
                <input
                    type="text"
                    placeholder="🔍 Buscar fotos..."
                    value={busqueda}
                    onChange={e => setBusqueda(e.target.value)}
                    onKeyDown={handleBusqueda}
                />
            </div>

            <nav className="sidebar-nav" ref={navRef}>
                <div className="sidebar-section-label">General</div>
                <Link to="/galeria-completa" className={`sidebar-item ${isActive('/galeria-completa') ? 'active' : ''}`}>
                    <span className="sidebar-item-icon">🏠</span> Inicio / Galería
                </Link>
                <button 
                    className="sidebar-item" 
                    style={{ background: 'none', border: 'none', width: '100%', cursor: 'pointer', textAlign: 'left' }}
                    onClick={() => window.location.reload()}
                >
                    <span className="sidebar-item-icon">🔄</span> Refrescar Sistema
                </button>

                <div className="sidebar-section-label">Biblioteca</div>
                <Link to="/duplicados" className={`sidebar-item ${isActive('/duplicados') ? 'active' : ''}`}>
                    <span className="sidebar-item-icon">🧬</span> Duplicados
                </Link>
                <Link to="/favoritos" className={`sidebar-item ${isActive('/favoritos') ? 'active' : ''}`}>
                    <span className="sidebar-item-icon">⭐</span> Favoritos
                    <span className="sidebar-item-badge">{conteos.favoritos}</span>
                </Link>

                <div className="sidebar-section-label">Organizar</div>
                <Link to="/albumes" className={`sidebar-item ${isActive('/albumes') ? 'active' : ''}`}>
                    <span className="sidebar-item-icon">📁</span> Álbumes
                    <span className="sidebar-item-badge">{conteos.albumes}</span>
                </Link>
                <Link to="/eventos" className={`sidebar-item ${isActive('/eventos') ? 'active' : ''}`}>
                    <span className="sidebar-item-icon">📅</span> Eventos
                    <span className="sidebar-item-badge">{conteos.eventos}</span>
                </Link>
                <Link to="/personas" className={`sidebar-item ${isActive('/personas') ? 'active' : ''}`}>
                    <span className="sidebar-item-icon">👤</span> Personas
                    <span className="sidebar-item-badge">{conteos.personas}</span>
                </Link>

                <div className="sidebar-section-label">Explorar</div>
                <Link to="/mapa" className={`sidebar-item ${isActive('/mapa') ? 'active' : ''}`}>
                    <span className="sidebar-item-icon">📍</span> Mapa Satelital
                </Link>

                <div className="sidebar-section-label">Sistema</div>
                <Link to="/admin" className={`sidebar-item ${isActive('/admin') ? 'active' : ''}`}>
                    <span className="sidebar-item-icon">⚙️</span> Gestión
                </Link>
                {usuario?.email === 'pepemoji66@gmail.com' && (
                    <Link to="/usuarios" className={`sidebar-item ${isActive('/usuarios') ? 'active' : ''}`}>
                        <span className="sidebar-item-icon">👥</span> Usuarios
                    </Link>
                )}
                <Link to="/papelera" className={`sidebar-item ${isActive('/papelera') ? 'active' : ''}`}>
                    <span className="sidebar-item-icon">🗑️</span> Papelera
                </Link>
            </nav>

            <div className="sidebar-bottom">
                {usuario && !usuario.aprobado && (
                    <div className="sidebar-demo-warning" style={{ backgroundColor: 'rgba(255, 68, 0, 0.2)', border: '1px solid #ff4400', padding: '10px', borderRadius: '4px', marginBottom: '15px', textAlign: 'center', fontSize: '0.75rem', color: '#ffcc00' }}>
                        ⚠️ MODO DEMO: ESPERANDO ACTIVACIÓN
                        <br/>(Límite: 50 fotos)
                    </div>
                )}

                {usuario && usuario.aprobado === 1 && (
                    <a 
                        href="/downloads/Archipeg_Setup.exe" 
                        download 
                        className="sidebar-upload-btn btn-descargar-app" 
                        style={{ 
                            marginBottom: '15px', 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center', 
                            gap: '8px', 
                            textDecoration: 'none',
                            background: 'linear-gradient(90deg, #00ffff, #ff00ff)',
                            color: '#000',
                            fontWeight: '900',
                            boxShadow: '0 0 15px rgba(0, 255, 255, 0.5)'
                        }}
                    >
                        🚀 DESCARGAR VERSIÓN PRO (PC)
                    </a>
                )}

                {esDemo ? (
                    <>
                        <div className="sidebar-demo-info">{conteos.fotos}/{LIMITE} fotos (DEMO)</div>
                        <div className="sidebar-demo-bar">
                            <div className="sidebar-demo-bar-fill" style={{ width: `${porcentaje}%` }}></div>
                        </div>
                    </>
                ) : (
                    <div className="sidebar-demo-info">{conteos.fotos} fotos</div>
                )}
                {usuario && (
                    <button className="sidebar-upload-btn" onClick={() => navigate('/admin')}>
                        + GESTIÓN VISUAL
                    </button>
                )}
                {usuario && (
                    <button className="sidebar-upload-btn" style={{ marginTop: '6px', background: 'transparent', border: '1px solid #555', color: '#aaa' }} onClick={logout}>
                        Cerrar sesión
                    </button>
                )}
            </div>
        </aside>
    );
};

export default Sidebar;
