import React from 'react';

const Instrucciones = () => {
    // Definimos un color que resalte bien sobre el fondo blanco del modal
    const textoColor = "#333";
    const iconoColor = "#00b4d8"; // Un azul un poco más oscuro para que se vea mejor

    return (
        <div className="card-archipeg" style={{ marginTop: '30px', textAlign: 'left', padding: '25px' }}>
            <h3 className="title-archipeg" style={{ marginBottom: '20px', fontSize: '1.5rem', color: '#000' }}>
                🚀 Guía de Inicio Rápido - Archipeg Pro
            </h3>

            <ul style={{ lineHeight: '1.8', color: textoColor, listStyleType: 'none', paddingLeft: '0' }}>
                <li style={{ marginBottom: '15px', display: 'flex', alignItems: 'flex-start' }}>
                    <span style={{ fontSize: '1.2rem', marginRight: '15px' }}>📂</span>
                    <span><strong>Exploración Selectiva:</strong> Utilice <em>"Galería Completa"</em> para navegar por los activos digitales organizados por años.</span>
                </li>
                <li style={{ marginBottom: '15px', display: 'flex', alignItems: 'flex-start' }}>
                    <span style={{ fontSize: '1.2rem', marginRight: '15px' }}>⚙️</span>
                    <span><strong>Gestión Autónoma:</strong> Acceda al <em>"Panel de Control"</em> para subir fotografías. El motor procesará y renombrará los archivos automáticamente.</span>
                </li>
                <li style={{ marginBottom: '15px', display: 'flex', alignItems: 'flex-start' }}>
                    <span style={{ fontSize: '1.2rem', marginRight: '15px' }}>🔍</span>
                    <span><strong>Búsqueda de Activos:</strong> Filtre por título o año para localizar instantáneamente cualquier registro en la base de datos local.</span>
                </li>
                <li style={{ marginBottom: '15px', display: 'flex', alignItems: 'flex-start' }}>
                    <span style={{ fontSize: '1.2rem', marginRight: '15px' }}>🛡️</span>
                    <span><strong>Seguridad de Datos:</strong> Los archivos se almacenan físicamente en la carpeta <code>/fotos_archipeg</code>, asegurando su integridad sin depender de la nube.</span>
                </li>
            </ul>

            <div style={{
                marginTop: '20px',
                padding: '15px',
                backgroundColor: 'rgba(0, 180, 216, 0.1)',
                borderRadius: '8px',
                borderLeft: '5px solid #00b4d8'
            }}>
                <p style={{ fontSize: '0.9rem', color: '#444', margin: '0', fontStyle: 'italic', fontWeight: '500' }}>
                    * <strong>Aviso de Sistema:</strong> Esta es una versión de evaluación autónoma. El motor ARCHIPEG funciona de forma local en este dispositivo.
                </p>
            </div>
        </div>
    );
};

export default Instrucciones;