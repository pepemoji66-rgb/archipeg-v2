import React from 'react';
import { Link } from 'react-router-dom';
import '../App.css';

const Indice = () => (
    <div className="indice-page">
        {/* EL MARCO NEÓN DEL TÍTULO - IGUAL QUE TU CAPTURA */}
        <div className="indice-marco-titulo">
            <h1 className="indice-titulo">ARCHIPEG<span className="indice-punto"> ·</span></h1>
            <p className="indice-subtitulo">GESTIÓN Y ARCHIVO FOTOGRÁFICO PROFESIONAL</p>
        </div>

        {/* LOS BOTONES PRINCIPALES QUE BRILLAN Y SALTAN */}
        <div className="indice-botones">
            <Link to="/galeria-completa" className="btn-neon cian">GALERÍA COMPLETA</Link>
            <Link to="/admin" className="btn-neon fucsia">ADMINISTRACIÓN</Link>
        </div>

        {/* LAS 6 SECCIONES EN FILA O 3x2 */}
        <div className="indice-features">
            {[
                { icon: '📁', label: 'Álbumes', desc: 'Colecciones', path: '/albumes' },
                { icon: '📅', label: 'Eventos', desc: 'Fechas', path: '/eventos' },
                { icon: '👤', label: 'Personas', desc: 'Etiquetado', path: '/personas' },
                { icon: '⭐', label: 'Favoritos', desc: 'Mejores', path: '/favoritos' },
                { icon: '🏷️', label: 'Tags', desc: 'Etiquetas', path: '/tags' },
            ].map(f => (
                <Link to={f.path} key={f.label} className="indice-feature-card">
                    <div className="indice-feature-icon">{f.icon}</div>
                    <div className="indice-feature-label">{f.label}</div>
                    <div className="indice-feature-desc">{f.desc}</div>
                </Link>
            ))}
        </div>

        <p className="indice-footer">ARCHIPEG · © 2026 Jose Moreno Jimenez</p>
    </div>
);

export default Indice;