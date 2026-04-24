import React, { useEffect, useState } from 'react';

const SelectorTema = () => {
    const [color, setColor] = useState(localStorage.getItem('archipeg-theme') || '#00f2ff');

    const temas = [
        { nombre: 'Cian', hex: '#00f2ff', rgba: 'rgba(0, 242, 255, 0.2)' },
        { nombre: 'Verde', hex: '#00ff88', rgba: 'rgba(0, 255, 136, 0.2)' },
        { nombre: 'Rojo', hex: '#ff4d4d', rgba: 'rgba(255, 77, 77, 0.2)' },
        { nombre: 'Amarillo', hex: '#ffcc00', rgba: 'rgba(255, 204, 0, 0.2)' },
        { nombre: 'Fucsia', hex: '#f100ff', rgba: 'rgba(241, 0, 255, 0.2)' },
    ];

    useEffect(() => {
        const temaActual = temas.find(t => t.hex === color) || temas[0];
        document.documentElement.style.setProperty('--acento-primario', temaActual.hex);
        document.documentElement.style.setProperty('--acento-primario-ho', temaActual.rgba);
        localStorage.setItem('archipeg-theme', temaActual.hex);
    }, [color]);

    return (
        <div className="selector-tema-container" style={{ padding: '10px', marginTop: '10px' }}>
            <p style={{ fontSize: '0.7rem', color: '#888', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>Personalizar Interfaz</p>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {temas.map(tema => (
                    <div 
                        key={tema.hex}
                        onClick={() => setColor(tema.hex)}
                        style={{
                            width: '24px',
                            height: '24px',
                            borderRadius: '50%',
                            backgroundColor: tema.hex,
                            cursor: 'pointer',
                            border: color === tema.hex ? '2px solid white' : '2px solid transparent',
                            boxShadow: color === tema.hex ? `0 0 10px ${tema.hex}` : 'none',
                            transition: 'all 0.2s ease'
                        }}
                        title={tema.nombre}
                    />
                ))}
            </div>
        </div>
    );
};

export default SelectorTema;
