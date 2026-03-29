import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import Bienvenida from './Bienvenida';
import '../App.css';
import './indice-auth.css';

const Indice = () => {
    const { usuario, esDemo } = useAuth();
    const haySession = usuario !== null || esDemo;

    const [authModalOpen, setAuthModalOpen] = useState(false);
    const [authMode, setAuthMode] = useState('registro'); // 'login' | 'registro'

    const abrirModal = (modo) => {
        setAuthMode(modo);
        setAuthModalOpen(true);
    };

    const cerrarModal = () => setAuthModalOpen(false);

    return (
        <div className="indice-page">
            {/* EL MARCO NEÓN DEL TÍTULO - IGUAL QUE TU CAPTURA */}
            <div className="indice-marco-titulo">
                <h1 className="indice-titulo">ARCHIPEG<span className="indice-punto"> ·</span></h1>
                <p className="indice-subtitulo">GESTIÓN Y ARCHIVO FOTOGRÁFICO PROFESIONAL</p>
            </div>

            {/* LOS BOTONES PRINCIPALES QUE BRILLAN Y SALTAN */}
            <div className="indice-botones">
                {haySession ? (
                    <>
                        <Link to="/galeria-completa" className="btn-neon">GALERÍA COMPLETA</Link>
                        <Link to="/admin" className="btn-neon" style={{ borderColor: '#ff2d7d', boxShadow: '0 0 20px #ff2d7d', background: '#ff2d7d !important', color: '#000 !important' }}>ADMINISTRACIÓN</Link>
                    </>
                ) : (
                    <>
                        <button type="button" className="btn-neon" onClick={() => abrirModal('login')}>
                            GALERÍA COMPLETA
                        </button>
                        <button
                            type="button"
                            className="btn-neon"
                            onClick={() => abrirModal('login')}
                            style={{ borderColor: '#ff2d7d', boxShadow: '0 0 20px #ff2d7d', background: '#ff2d7d !important', color: '#000 !important' }}
                        >
                            ADMINISTRACIÓN
                        </button>
                    </>
                )}
            </div>

            {/* CTA Registro/Login (pedido explícito) */}
            {!haySession && (
                <div className="indice-auth-cta" role="region" aria-label="Acceso">
                    <button type="button" className="indice-auth-btn indice-auth-btn-registro" onClick={() => abrirModal('registro')}>
                        📝 REGISTRO
                    </button>
                    <button type="button" className="indice-auth-btn indice-auth-btn-login" onClick={() => abrirModal('login')}>
                        🔑 LOGIN
                    </button>
                    <div className="indice-auth-nota">
                        Pulsa una opción para abrir el formulario.
                    </div>
                </div>
            )}

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

            {/* MODAL AUTH */}
            {authModalOpen && (
                <div className="indice-auth-modal-overlay" onClick={cerrarModal}>
                    <div className="indice-auth-modal-card" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
                        <button className="indice-auth-modal-close" type="button" onClick={cerrarModal} aria-label="Cerrar">✕</button>
                        <Bienvenida initialMode={authMode} />
                    </div>
                </div>
            )}
        </div>
    );
};

export default Indice;