import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import Bienvenida from './Bienvenida';
import { API_BASE_URL } from '../config';
import './landing.css';

const Indice = () => {
    const { usuario, esDemo } = useAuth();
    const haySession = usuario !== null || esDemo;

    const [authModalOpen, setAuthModalOpen] = useState(false);
    const [authMode, setAuthMode] = useState('registro'); 
    const [visitas, setVisitas] = useState(0);

    useEffect(() => {
        // Incrementar y obtener el número de visitas al cargar la página
        fetch(`${API_BASE_URL}/api/visitas/incrementar`, { method: 'POST' })
            .then(res => res.json())
            .then(data => {
                if (data.visitas !== undefined) {
                    setVisitas(data.visitas);
                }
            })
            .catch(err => {
                console.error("Error al registrar visita:", err);
                // Si falla el POST (por ej. CORS o problemas de red), intentamos obtener el contador actual con GET
                fetch(`${API_BASE_URL}/api/visitas`)
                    .then(res => res.json())
                    .then(data => {
                        if (data.visitas !== undefined) {
                            setVisitas(data.visitas);
                        }
                    })
                    .catch(console.error);
            });
    }, []);

    const abrirModal = (modo) => {
        setAuthMode(modo);
        setAuthModalOpen(true);
    };

    const cerrarModal = () => setAuthModalOpen(false);

    return (
        <div className="landing-container">
            {/* TOP NAVIGATION / LOGO AREA */}
            <header className="landing-top-header">
                <div className="landing-logo-box">
                    <img src="logo_archipeg_principal.png" alt="ARCHIPEG LOGO" className="landing-logo-img" />
                    <span className="landing-logo-text">ARCHIPEG <span className="logo-dot">PRO</span></span>
                </div>
                <div className="top-bar-spacer"></div>
                {!haySession && (
                    <button className="btn-login-small" onClick={() => abrirModal('login')}>ENTRAR</button>
                )}
            </header>

            {/* HERO SECTION */}
            <section className="landing-hero">
                <div className="landing-hero-badge">SISTEMA DE ACTIVOS DIGITALES SOBERANO</div>
                <h1 className="landing-hero-title">ARCHIPEG <span className="logo-dot">PRO</span></h1>
                <p className="landing-hero-subtitle" style={{color: '#fff', fontSize: '1.8rem', fontWeight: 600, marginBottom: '15px'}}>
                    Tus activos, tu privacidad, <span style={{color: '#f100ff'}}>bajo tu control.</span>
                </p>
                <p className="landing-hero-subtitle">
                    Organiza y protege miles de fotos, videos y documentos sin subir una sola foto a la nube. 
                    Tus recuerdos permanecen en tu poder físico, nosotros solo le damos la inteligencia.
                </p>
                <div className="landing-ctas">
                    {haySession ? (
                        <>
                            <Link to="/galeria-completa" className="btn-primary-neon">ACCEDER A MI ARCHIVO</Link>
                            <Link to="/presentacion" className="btn-secondary-neon" style={{ border: '1px solid #00ffff', color: '#00ffff' }}>✨ VER PRESENTACIÓN</Link>
                        </>
                    ) : (
                        <>
                            <button className="btn-primary-neon" onClick={() => abrirModal('registro')}>EMPEZAR GRATIS</button>
                            <button className="btn-secondary-neon" onClick={() => abrirModal('login')}>INICIAR SESIÓN</button>
                            <Link to="/presentacion" className="btn-secondary-neon" style={{ border: '1px solid #00ffff', color: '#00ffff', width: '100%', marginTop: '10px', textAlign: 'center' }}>✨ VER PRESENTACIÓN ARCHIPEG</Link>
                            <div style={{width: '100%', textAlign: 'center', marginTop: '15px', color: '#aaa', fontSize: '0.85rem', background: 'rgba(0,0,0,0.4)', padding: '8px', borderRadius: '5px'}}>
                                ⚠️ <b>Aviso:</b> La versión de escritorio es actualmente exclusiva para <b>Windows</b>. Estamos trabajando en la versión para Mac.
                            </div>
                        </>
                    )}
                </div>
            </section>

            {/* DEMO DOWNLOAD SECTION */}
            <section className="landing-demo-download" style={{
                padding: '50px 20px',
                background: 'linear-gradient(90deg, rgba(241, 0, 255, 0.05) 0%, rgba(0, 242, 255, 0.05) 100%)',
                borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                textAlign: 'center',
                position: 'relative'
            }}>
                <div style={{ maxWidth: '800px', margin: '0 auto' }}>
                    <div style={{
                        display: 'inline-block',
                        background: 'rgba(241, 0, 255, 0.15)',
                        color: '#f100ff',
                        padding: '8px 18px',
                        borderRadius: '50px',
                        fontSize: '0.85rem',
                        fontWeight: 'bold',
                        marginBottom: '20px',
                        border: '1px solid rgba(241, 0, 255, 0.3)',
                        textTransform: 'uppercase',
                        letterSpacing: '1px'
                    }}>
                        PRUEBA ARCHIPEG EN TU ORDENADOR
                    </div>
                    <h2 style={{ fontSize: '2.5rem', marginBottom: '15px', fontWeight: '800', textShadow: '0 0 20px rgba(241, 0, 255, 0.2)' }}>
                        Descarga la Demo de Escritorio
                    </h2>
                    <p style={{ color: '#ccc', fontSize: '1.1rem', lineHeight: '1.6', marginBottom: '30px', maxWidth: '650px', margin: '0 auto 30px' }}>
                        Instala Archipeg Pro en tu sistema Windows y pruébalo con tus propias colecciones de fotos locales. 
                        La versión demo tiene habilitadas todas las funciones de organización inteligente con un límite de 50 fotos/activos.
                    </p>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
                        <a 
                            href={`${API_BASE_URL}/downloads/Archipeg Pro Setup 2.3.4.exe`}
                            className="btn-primary-neon"
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '10px',
                                textDecoration: 'none',
                                background: 'linear-gradient(135deg, #00ffff 0%, #f100ff 100%)',
                                boxShadow: '0 0 25px rgba(0, 242, 255, 0.4)',
                                padding: '16px 40px',
                                borderRadius: '12px',
                                fontWeight: '800',
                                fontSize: '1.1rem'
                            }}
                        >
                            📥 DESCARGAR DEMO GRATIS (WINDOWS)
                        </a>
                        <Link 
                            to="/presentacion" 
                            className="btn-secondary-neon" 
                            style={{ 
                                border: '1px solid #00ffff', 
                                color: '#00ffff', 
                                textDecoration: 'none', 
                                padding: '16px 30px',
                                borderRadius: '12px',
                                fontWeight: '800',
                                fontSize: '1.1rem'
                            }}
                        >
                            ✨ VER PRESENTACIÓN
                        </Link>
                    </div>
                    
                    {/* VISITOR COUNTER */}
                    <div style={{ 
                        marginTop: '35px', 
                        fontSize: '0.95rem', 
                        color: '#aaa', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        gap: '10px',
                        background: 'rgba(255, 255, 255, 0.02)',
                        padding: '10px 20px',
                        borderRadius: '30px',
                        width: 'fit-content',
                        margin: '35px auto 0',
                        border: '1px solid rgba(255, 255, 255, 0.05)'
                    }}>
                        <span style={{ fontSize: '1.3rem', filter: 'drop-shadow(0 0 5px rgba(0, 242, 255, 0.5))' }}>👁️</span>
                        <span>Esta página de presentación ha sido mirada por <strong>{visitas}</strong> personas</span>
                    </div>
                </div>
            </section>

            {/* PRIVACY SECTION (The "BOMBAST" argument) */}
            <section className="landing-privacy-box">
                <div className="privacy-visual" style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '10rem', filter: 'drop-shadow(0 0 30px var(--acento-turquesa))' }}>🛡️</div>
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
                        <h3 className="feature-title">Gestión de Personas</h3>
                        <p className="feature-desc">Identifica y agrupa a los protagonistas de tu vida. Crea perfiles locales para organizar tus mejores momentos en familia.</p>
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
                        <div className="feature-icon">📖</div>
                        <h3 className="feature-title">Guía de Inicio Rápido</h3>
                        <p className="feature-desc">
                            1. <b>Importar</b>: Conecta tu disco y escanea. <br/>
                            2. <b>Indexar</b>: Deja que el motor ANALICE. <br/>
                            3. <b>Organizar</b>: Crea álbumes y eventos en un clic.
                        </p>
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
                        <div className="price-value">5€ <span>/ Pago Único</span></div>
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

            {/* THE ARCHIPEG MANIFESTO: CLOUD VS LOCAL */}
            <section className="landing-magic-explanation">
                <div className="magic-card">
                    <div className="magic-header">
                        <span className="magic-icon">✨</span>
                        <h2>LA MAGIA DE ARCHIPEG: ¿NUBE O DISCO?</h2>
                    </div>
                    <div className="magic-grid">
                        <div className="magic-item web">
                            <div className="magic-badge warning">ESTÁS AQUÍ: ESCAPARATE WEB (MÓVIL)</div>
                            <h3>Versión Demo / Nube</h3>
                            <p>
                                Esta web en Render es nuestro <b>Showroom Interactivo</b>. 
                                Sirve para que pruebes la potencia de la interfaz, el mapa y la organización.
                            </p>
                            <ul className="magic-list">
                                <li>⚠️ <b>¿Ves fotos sin el disco?</b> Solo si las has "Subido" (Copia en nube).</li>
                                <li>🌐 <b>Fotos Privadas</b>: No son accesibles desde aquí sin subida previa.</li>
                                <li>☁️ Almacenamiento limitado y gestionado externamente.</li>
                            </ul>
                            <Link to="/presentacion" className="btn-secondary-neon" style={{marginTop: '20px', width: '100%', fontSize: '0.9rem', display: 'inline-block', textDecoration: 'none', textAlign: 'center', border: '1px solid #00ffff'}}>
                                ✨ VER TOUR VIRTUAL (PRESENTACIÓN)
                            </Link>
                        </div>

                        <div className="magic-divider">VS</div>

                        <div className="magic-item local">
                            <div className="magic-badge sovereign">LA VERDADERA MAGIA: VERSIÓN PC (DISCO)</div>
                            <h3>Soberanía Digital Total</h3>
                            <p>
                                La esencia de Archipeg es la <b>Privacidad Absoluta</b>. 
                                Al descargar la aplicación en tu casa, tus fotos nunca salen de tu posesión.
                            </p>
                            <ul className="magic-list">
                                <li>🔒 <b>CERO SUBIDAS</b>: Sin disco conectado, nadie ve nada. Ni nosotros.</li>
                                <li>🚀 <b>100% DISCO</b>: El programa cataloga tu disco duro físico.</li>
                                <li>💎 <b>PROPIEDAD</b>: Tus recuerdos no alimentan IAs ni nubes públicas.</li>
                            </ul>
                            <a 
                                href="mailto:archipegv2@gmail.com?subject=Solicitud de ARCHIPEG PC PRO&body=Hola Jose, me gustaría solicitar la versión de escritorio soberana de Archipeg Pro para mi PC. Mi usuario registrado es: "
                                className="btn-primary-neon" 
                                style={{marginTop: '20px', width: '100%', fontSize: '0.9rem', display: 'inline-block', textDecoration: 'none', textAlign: 'center'}}
                            >
                                SOLICITAR ARCHIPEG PC POR EMAIL ⬇️
                            </a>
                        </div>
                    </div>
                    <div className="magic-footer">
                        "Si no quieres que tus recuerdos estén en internet, no los subas. Úsalos en tu casa con Archipeg PC."
                    </div>
                </div>
            </section>

            {/* DATA PROTECTION & REPORT SECTION */}
            <section className="landing-legal-report">
                <div className="report-card">
                    <div className="report-header">
                        <span className="report-icon">🛡️</span>
                        <h3>INFORME DE SOBERANÍA Y PROTECCIÓN DE DATOS</h3>
                    </div>
                    <div className="report-body">
                        <div className="report-item">
                            <h4>PROPIEDAD ABSOLUTA</h4>
                            <p>Tus activos nunca salen de tu posesión física. Archipeg no tiene acceso a tus archivos originales ni capacidad de transmisión externa.</p>
                        </div>
                        <div className="report-item">
                            <h4>BASE DE DATOS ENCRIPTADA</h4>
                            <p>Toda la metadata, etiquetas y relaciones se guardan en un motor SQL local protegido por tu propia seguridad de sistema operativo.</p>
                        </div>
                        <div className="report-item">
                            <h4>CERO RASTREO</h4>
                            <p>Sin telemetría, sin cookies de seguimiento y sin intercambio de datos con terceros. Privacidad por diseño (Privacy by Design).</p>
                        </div>
                    </div>
                    <div className="report-footer">
                        ESTA APLICACIÓN CUMPLE CON LOS ESTÁNDARES DE PRIVACIDAD MÁS EXIGENTES AL OPERAR EN ENTORNO LOCAL (AIR-GAPPED READY).
                    </div>
                </div>
            </section>

            <footer className="footer-alt">
                <p>ARCHIPEG PRO · EL FUTURO DE TUS RECUERDOS</p>
                <div style={{marginTop: '10px', fontSize: '0.8rem', color: '#888'}}>
                    Soporte oficial: <a href="mailto:archipegv2@gmail.com" style={{color:  'var(--acento-turquesa)' , textDecoration: 'none'}}>archipegv2@gmail.com</a>
                </div>
                <div style={{marginTop: '15px', fontSize: '0.85rem', display: 'flex', gap: '20px', justifyContent: 'center'}}>
                    <Link to="/privacidad" style={{color: '#aaa', textDecoration: 'none'}}>Política de Privacidad</Link>
                    <Link to="/terminos" style={{color: '#aaa', textDecoration: 'none'}}>Términos y Condiciones</Link>
                </div>
                <p style={{marginTop: '15px', fontSize: '0.7rem'}}>© 2026 Jose Moreno Jimenez. Todos los derechos reservados.</p>
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
