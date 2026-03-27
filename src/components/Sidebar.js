import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import './sidebar.css';

const API = 'http://localhost:5001/api';

const Sidebar = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const [conteos, setConteos] = useState({ fotos: 0, favoritos: 0, albumes: 0, eventos: 0, personas: 0, lugares: 0 });
    const [busqueda, setBusqueda] = useState('');

    useEffect(() => {
        const cargar = async () => {
            try {
                const [fotos, favs, albs, evs, pers, lugs] = await Promise.all([
                    fetch(`${API}/imagenes`).then(r => r.json()),
                    fetch(`${API}/favoritos`).then(r => r.json()),
                    fetch(`${API}/albumes`).then(r => r.json()),
                    fetch(`${API}/eventos`).then(r => r.json()),
                    fetch(`${API}/personas`).then(r => r.json()),
                    fetch(`${API}/lugares`).then(r => r.json()),
                ]);
                setConteos({
                    fotos: Array.isArray(fotos) ? fotos.length : 0,
                    favoritos: Array.isArray(favs) ? favs.length : 0,
                    albumes: Array.isArray(albs) ? albs.length : 0,
                    eventos: Array.isArray(evs) ? evs.length : 0,
                    personas: Array.isArray(pers) ? pers.length : 0,
                    lugares: Array.isArray(lugs) ? lugs.length : 0,
                });
            } catch (e) { /* servidor no disponible */ }
        };
        cargar();
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
                <div className="sidebar-brand-name">ARCHIPEG<span className="sidebar-brand-dot"> ·</span></div>
                <div className="sidebar-brand-version">v2.0 · DEMO</div>
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

            <nav className="sidebar-nav">
                <div className="sidebar-section-label">Biblioteca</div>
                <Link to="/galeria-completa" className={`sidebar-item ${isActive('/galeria-completa') ? 'active' : ''}`}>
                    <span className="sidebar-item-icon">🖼️</span> Todas las fotos
                    <span className="sidebar-item-badge">{conteos.fotos}</span>
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
                <Link to="/lugares" className={`sidebar-item ${isActive('/lugares') ? 'active' : ''}`}>
                    <span className="sidebar-item-icon">📍</span> Lugares
                    <span className="sidebar-item-badge">{conteos.lugares}</span>
                </Link>

                <div className="sidebar-section-label">Explorar</div>
                <Link to="/tags" className={`sidebar-item ${isActive('/tags') ? 'active' : ''}`}>
                    <span className="sidebar-item-icon">🏷️</span> Tags
                </Link>
                <Link to="/mapa" className={`sidebar-item ${isActive('/mapa') ? 'active' : ''}`}>
                    <span className="sidebar-item-icon">🗺️</span> Mapa
                </Link>

                <div className="sidebar-section-label">Sistema</div>
                <Link to="/admin" className={`sidebar-item ${isActive('/admin') ? 'active' : ''}`}>
                    <span className="sidebar-item-icon">⚙️</span> Gestión
                </Link>
                <Link to="/papelera" className={`sidebar-item ${isActive('/papelera') ? 'active' : ''}`}>
                    <span className="sidebar-item-icon">🗑️</span> Papelera
                </Link>
            </nav>

            <div className="sidebar-bottom">
                <div className="sidebar-demo-info">{conteos.fotos}/{LIMITE} fotos (DEMO)</div>
                <div className="sidebar-demo-bar">
                    <div className="sidebar-demo-bar-fill" style={{ width: `${porcentaje}%` }}></div>
                </div>
                <button className="sidebar-upload-btn" onClick={() => navigate('/admin')}>
                    + SUBIR FOTOS
                </button>
            </div>
        </aside>
    );
};

export default Sidebar;
