import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import './presentacion.css';

const Presentacion = () => {
    const navigate = useNavigate();
    const [currentSlide, setCurrentSlide] = useState(0);
    const audioRef = useRef(null);
    const [audioStarted, setAudioStarted] = useState(false);

    const slides = [
        {
            title: "ARCHIPEG PRO",
            text: "Donde la tecnología se encuentra con tus recuerdos más valiosos. Redescubre tu historia personal con inteligencia y elegancia.",
            bg: "/presentacion_hero.png",
            type: "hero"
        },
        {
            title: "EL MAPA DE TU VIDA",
            text: "Cada foto tiene un lugar. Visualiza tus viajes y momentos especiales geolocalizados en un mapa interactivo de alta resolución.",
            bg: "https://images.unsplash.com/photo-1526778548025-fa2f459cd5c1?auto=format&fit=crop&q=80&w=2000",
            type: "content"
        },
        {
            title: "EVENTOS AUTOMÁTICOS",
            text: "No pierdas tiempo organizando. Archipeg agrupa tus fotos por fechas y eventos de forma inteligente, creando una línea de tiempo perfecta.",
            bg: "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&q=80&w=2000",
            type: "content"
        },
        {
            title: "MAGIC SCAN",
            text: "La herramienta definitiva. Conecta un USB con tus fotos y Archipeg hará todo el trabajo sucio por ti: importar, organizar y fechar.",
            bg: "https://images.unsplash.com/photo-1563986768609-322da13575f3?auto=format&fit=crop&q=80&w=2000",
            type: "magic"
        },
        {
            title: "¿LISTO PARA EMPEZAR?",
            text: "Tu archivo digital está esperando. Toma el control total de tu legado visual hoy mismo.",
            bg: "/presentacion_hero.png",
            type: "final"
        }
    ];

    useEffect(() => {
        const timer = setInterval(() => {
            if (currentSlide < slides.length - 1) {
                setCurrentSlide(prev => prev + 1);
            }
        }, 8000); // Cambiar cada 8 segundos

        return () => clearInterval(timer);
    }, [currentSlide, slides.length]);

    const startExperience = () => {
        if (audioRef.current) {
            audioRef.current.play().catch(e => console.log("Auto-play blocked, waiting for interaction"));
            setAudioStarted(true);
        }
        if (currentSlide === slides.length - 1) {
            navigate('/galeria');
        } else {
            setCurrentSlide(prev => prev + 1);
        }
    };

    return (
        <div className="presentacion-container" onClick={() => !audioStarted && startExperience()}>
            <audio ref={audioRef} src="/presentacion.mp3" loop />
            
            {slides.map((slide, index) => (
                <div key={index} className={`slide ${index === currentSlide ? 'active' : ''}`}>
                    <img src={slide.bg} alt="bg" className="slide-bg" />
                    
                    <div className="slide-content glass-panel">
                        <h1 className="slide-title">{slide.title}</h1>
                        <div className="neon-line"></div>
                        <p className="slide-text" style={{opacity: 1}}>{slide.text}</p>
                        
                        {slide.type === 'magic' && (
                            <div className="instruction-grid">
                                <div className="instruction-item">
                                    <span className="step-number">01</span>
                                    <p>Conecta tu USB o Disco Externo al PC.</p>
                                </div>
                                <div className="instruction-item">
                                    <span className="step-number">02</span>
                                    <p>Crea la carpeta <strong>FOTOS PARA SUBIR</strong>.</p>
                                </div>
                                <div className="instruction-item">
                                    <span className="step-number">03</span>
                                    <p>Pulsa <strong>MAGIC SCAN</strong> en el panel Admin.</p>
                                </div>
                            </div>
                        )}

                        {index === slides.length - 1 && (
                            <button className="btn-start" style={{opacity: 1}} onClick={(e) => {
                                e.stopPropagation();
                                navigate('/galeria');
                            }}>
                                ENTRAR A LA GALERÍA
                            </button>
                        )}
                    </div>
                </div>
            ))}

            <div className="controls">
                {slides.map((_, index) => (
                    <div 
                        key={index} 
                        className={`dot ${index === currentSlide ? 'active' : ''}`}
                        onClick={(e) => {
                            e.stopPropagation();
                            setCurrentSlide(index);
                        }}
                    />
                ))}
            </div>

            {!audioStarted && (
                <div className="click-overlay" style={{
                    position: 'absolute',
                    top: 0, left: 0, width: '100%', height: '100%',
                    background: 'rgba(0,0,0,0.5)',
                    display: 'flex', justifyContent: 'center', alignItems: 'center',
                    zIndex: 10000, pointerEvents: 'none'
                }}>
                    <p style={{fontSize: '1.2rem', color: '#00ffff', animation: 'fadeIn 1s infinite alternate'}}>
                        HAGA CLICK PARA INICIAR LA EXPERIENCIA
                    </p>
                </div>
            )}
        </div>
    );
};

export default Presentacion;
