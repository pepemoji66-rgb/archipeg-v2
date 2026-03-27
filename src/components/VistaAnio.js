import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import './vistaAnio.css';

// El motor ahora apunta a Node (Puerto 5000)
const URL_BASE_FOTOS = "http://localhost:5001/uploads/";

const VistaAnio = () => {
    const { anio } = useParams();
    const [fotos, setFotos] = useState([]);
    const [fotoZoom, setFotoZoom] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        // Llamada al nuevo servidor autónomo
        fetch(`http://localhost:5001/api/fotos/${anio}`)
            .then(res => {
                if (!res.ok) throw new Error("Error al conectar con el motor ARCHIPEG");
                return res.json();
            })
            .then(data => {
                if (data.error) throw new Error(data.error);

                // Ordenamos los datos aquí mismo antes de guardarlos
                const ordenadas = data.sort((a, b) => {
                    return (b.titulo || "").localeCompare(a.titulo || "", undefined, { numeric: true });
                });

                setFotos(ordenadas);
                setError(null); // Limpiamos errores si la carga es buena
            })
            .catch(err => {
                console.error("Error cargando año:", err);
                setError("No se pudieron localizar activos digitales para este periodo.");
            });
    }, [anio]);

    // Función para manejar errores de carga de imágenes individuales
    const handleImgError = (e) => {
        e.target.onerror = null;
        e.target.src = "/logo_archipeg_principal.png"; // Asegúrate de que este logo esté en public/
        e.target.style.opacity = "0.3";
        e.target.style.padding = "20px";
    };

    return (
        <div className="vista-anio-container">
            <header className="vista-header">
                <Link to="/galeria-completa" className="btn-archipeg" style={{ textDecoration: 'none' }}>
                    ← VOLVER AL ARCHIVO
                </Link>
                <h1 className="title-archipeg" style={{ border: 'none' }}>Colección {anio}</h1>
            </header>

            {error && <div className="error-aviso card-archipeg" style={{ color: 'red' }}>{error}</div>}

            <div className="galeria-grid">
                {fotos.length > 0 ? (
                    fotos.map(foto => (
                        <div key={foto.id} className="tarjeta-foto card-archipeg" onClick={() => setFotoZoom(foto)}>
                            <div className="contenedor-img">
                                <img
                                    src={`${URL_BASE_FOTOS}${encodeURIComponent(foto.imagen_url)}`}
                                    alt={foto.titulo}
                                    onError={handleImgError}
                                />
                            </div>
                            <div className="info-foto">
                                <h3>{foto.titulo}</h3>
                                <p className="meta-info-badge">ACTIVO {foto.id}</p>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="sin-fotos card-archipeg">
                        <p>No hay registros para el año {anio} en la base de datos actual.</p>
                    </div>
                )}
            </div>

            {/* ZOOM DE FOTO PROFESIONAL */}
            {fotoZoom && (
                <div className="foto-zoom-overlay" onClick={() => setFotoZoom(null)}>
                    <div className="foto-zoom-contenido" onClick={(e) => e.stopPropagation()}>
                        <button className="boton-cerrar-zoom" onClick={() => setFotoZoom(null)}>×</button>
                        <img
                            src={`${URL_BASE_FOTOS}${encodeURIComponent(fotoZoom.imagen_url)}`}
                            alt={fotoZoom.titulo}
                            onError={handleImgError}
                        />
                        <div className="zoom-info-inferior">
                            <h2 className="title-archipeg">{fotoZoom.titulo}</h2>
                            <p>{fotoZoom.descripcion || "Este activo digital forma parte del archivo histórico ARCHIPEG."}</p>
                            <span className="anio-tag">Año {fotoZoom.anio}</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default VistaAnio;