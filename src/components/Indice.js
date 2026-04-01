import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import Bienvenida from './Bienvenida';
import './landing.css';

const Indice = () => {
    const { usuario, esDemo } = useAuth();
    const haySession = usuario !== null || esDemo;

    const [authModalOpen, setAuthModalOpen] = useState(false);
    const [authMode, setAuthMode] = useState('registro'); 

    const abrirModal = (modo) => {
        setAuthMode(modo);
        setAuthModalOpen(true);
    };

    const cerrarModal = () => setAuthModalOpen(false);

    return (
        <div className="landing-container">
            {/* HERO SECTION */}
            <section className="landing-hero">
                <div className="landing-hero-badge">INTELIGENCIA ARTIFICIAL SOBERANA</div>
                <h1 className="landing-hero-title">Tus recuerdos, tu privacidad, <span style={{color: '#f100ff'}}>para siempre.</span></h1>
                <p className="landing-hero-subtitle">
                    Organiza más de 10.000 activos digitales sin subir una sola foto a la nube. 
                    Archipeg Pro utiliza IA local para indexar tu vida guardando el control total en tu disco duro.
                </p>
                <div className="landing-ctas">
                    {haySession ? (
                        <Link to="/galeria-completa" className="btn-primary-neon">ACCEDER A MI ARCHIVO</Link>
                    ) : (
                        <>
                            <button className="btn-primary-neon" onClick={() => abrirModal('registro')}>EMPEZAR GRATIS</button>
                            <button className="btn-secondary-neon" onClick={() => abrirModal('login')}>INICIAR SESIÓN</button>
                        </>
                    )}
                </div>
            </section>

            {/* PRIVACY SECTION (The "BOMBAST" argument) */}
            <section className="landing-privacy-box">
                <div className="privacy-visual" style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '10rem', filter: 'drop-shadow(0 0 30px #00f2ff)' }}>🛡️</div>
                    <div className="privacy-tag">100% SOBERANÍA DE DATOS</div>
                </div>
                <div className="privacy-content">
                    <h2>Cero subidas a la nube.</h2>
                    <p>
                        A diferencia de otras plataformas, Archipeg nunca te pedirá que subas tus fotos a un servidor externo. 
                        Tus archivos permanecen en tu disco duro o unidad externa. Nosotros solo gestionamos la 
                        inteligencia y la organización en una base de datos segura y cifrada.
                    </p>
                    <div className="privacy-tag">✅ Tus fotos no alimentan modelos de IA públicos.</div>
                    <div className="privacy-tag">✅ Acceso instantáneo sin depender de internet.</div>
                    <div className="privacy-tag">✅ Organización profesional de nivel archivístico.</div>
                </div>
            </section>

            {/* FEATURES GRID */}
            <section className="landing-features-container">
                <div className="section-head">
                    <h2>Potencia de nivel industrial</h2>
                    <p>Herramientas avanzadas para el coleccionismo y la gestión histórica.</p>
                </div>
                
                <div className="features-grid">
                    <div className="feature-card">
                        <div className="feature-icon">👤</div>
                        <h3 className="feature-title">Reconocimiento Facial</h3>
                        <p className="feature-desc">Identifica y agrupa automáticamente a las personas más importantes de tu vida sin enviar sus rostros a servidores externos.</p>
                    </div>
                    <div className="feature-card">
                        <div className="feature-icon">🗺️</div>
                        <h3 className="feature-title">Mapeo Geográfico</h3>
                        <p className="feature-desc">Visualiza tu historia en un mapa interactivo inteligente. Descubre dónde ocurrieron tus mejores momentos.</p>
                    </div>
                    <div className="feature-card">
                        <div className="feature-icon">🧬</div>
                        <h3 className="feature-title">Detector de Duplicados</h3>
                        <p className="feature-desc">Limpia tu archivo de copias innecesarias con nuestro motor de comparación de firmas digitales.</p>
                    </div>
                    <div className="feature-card">
                        <div className="feature-icon">📁</div>
                        <h3 className="feature-title">Álbumes Inteligentes</h3>
                        <p className="feature-desc">Crea colecciones dinámicas y eventos históricos con un solo clic. Organización profesional sin esfuerzo.</p>
                    </div>
                    <div className="feature-card">
                        <div className="feature-icon">🏷️</div>
                        <h3 className="feature-title">Indexación de Tags</h3>
                        <p className="feature-desc">Buscador instantáneo por etiquetas y metadatos. Encuentra cualquier activo en milisegundos.</p>
                    </div>
                    <div className="feature-card">
                        <div className="feature-icon">🔒</div>
                        <h3 className="feature-title">Seguridad Militar</h3>
                        <p className="feature-desc">Protege tus álbumes más sensibles con PIN de seguridad y cifrado de base de datos local.</p>
                    </div>
                </div>
            </section>

            {/* PRICING SECTION (Simulation) */}
            <section className="pricing-section">
                <div className="section-head">
                    <h2>Planes para cada historiador</h2>
                </div>
                <div className="pricing-table">
                    <div className="price-card">
                        <div className="price-tier">PLAN LITE</div>
                        <div className="price-value">0€ <span>/ siempre</span></div>
                        <div className="price-features">
                            <div className="price-feature">✓ Hasta 50 activos inteligentes</div>
                            <div className="price-feature">✓ IA Básica de organización</div>
                            <div className="price-feature">✓ Gestión de Álbumes</div>
                            <div className="price-feature">✓ 1 Usuario</div>
                        </div>
                        <button className="btn-secondary-neon" style={{width:'100%'}} onClick={() => abrirModal('registro')}>Empezar gratis</button>
                    </div>

                    <div className="price-card featured">
                        <div className="price-tier">PLAN PROFESIONAL</div>
                        <div className="price-value">5€ <span>/ año</span></div>
                        <div className="price-features">
                            <div className="price-feature">✓ Activos ilimitados</div>
                            <div className="price-feature">✓ Reconocimiento Facial Avanzado</div>
                            <div className="price-feature">✓ Mapeo Geográfico Completo</div>
                            <div className="price-feature">✓ Soporte Multiusuario</div>
                            <div className="price-feature">✓ Soporte Prioritario</div>
                        </div>
                        <button className="btn-primary-neon" style={{width:'100%'}} onClick={() => abrirModal('registro')}>Obtener Pro ahora</button>
                    </div>
                </div>
            </section>

            <footer className="footer-alt">
                <p>ARCHIPEG PRO · EL FUTURO DE TUS RECUERDOS</p>
                <p style={{marginTop: '10px', fontSize: '0.7rem'}}>© 2026 Jose Moreno Jimenez. Todos los derechos reservados.</p>
                {usuario?.esAdmin && <Link to="/usuarios" style={{color: '#444', textDecoration: 'none', marginLeft: '20px'}}>Dashboard Admin</Link>}
            </footer>

            {/* MODAL AUTH */}
            {authModalOpen && (
                <div className="indice-auth-modal-overlay" onClick={cerrarModal}>
                    <div className="indice-auth-modal-card" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
                        <button className="indice-auth-modal-close" type="button" onClick={cerrarModal} aria-label="Cerrar">✕</button>
                        <Bienvenida key={authMode} initialMode={authMode} onAuthSuccess={() => cerrarModal()} />
                    </div>
                </div>
            )}
        </div>
    );
};

export default Indice;
