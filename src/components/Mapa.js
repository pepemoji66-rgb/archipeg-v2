import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useSearchParams } from 'react-router-dom';
import 'leaflet/dist/leaflet.css';
import { apiFetch } from '../api';
import { useAuth } from '../AuthContext';
import { API_BASE_URL, UPLOADS_URL } from '../config';
import './mapa-interactivo.css';
import './admin.css';

const API = `${API_BASE_URL}/api`;

// Icono neón personalizado para los marcadores
const neonIcon = new L.DivIcon({
    className: 'custom-div-icon',
    html: "<div class='custom-marker-neon'></div>",
    iconSize: [20, 20],
    iconAnchor: [10, 10]
});

// Componente para ajustar la vista al cargar fotos
function ChangeView({ center, zoom }) {
    const map = useMap();
    useEffect(() => {
        if (center) map.setView(center, zoom);
    }, [center, zoom, map]);
    return null;
}

const Mapa = () => {
    const { usuario } = useAuth();
    const [searchParams] = useSearchParams();
    const fotoIdUrl = searchParams.get('fotoId');

    const [fotos, setFotos] = useState([]);
    const [cargando, setCargando] = useState(true);
    const [centro, setCentro] = useState([40.4168, -3.7038]); // Madrid por defecto
    const [zoom, setZoom] = useState(5);

    useEffect(() => {
        apiFetch(`${API}/fotos-mapa`)
            .then(r => r.json())
            .then(data => {
                const validas = Array.isArray(data) ? data.filter(f => f.latitud && f.longitud) : [];
                setFotos(validas);
                
                if (fotoIdUrl) {
                    const f = validas.find(x => String(x.id) === String(fotoIdUrl));
                    if (f) {
                        setCentro([f.latitud, f.longitud]);
                        setZoom(16);
                        setCargando(false);
                        return; 
                    }
                }

                if (validas.length > 0) {
                    setCentro([validas[0].latitud, validas[0].longitud]);
                    setZoom(12);
                }
                setCargando(false);
            })
            .catch(() => setCargando(false));
    }, [fotoIdUrl]);

    const getFotoUrl = (foto) => {
        if (!foto || !foto.imagen_url) return '';
        const ruta = foto.imagen_url.trim();
        // Si es una ruta absoluta (empieza por C: o /), usamos el endpoint de foto-local
        if (ruta.includes(':') || ruta.startsWith('/') || ruta.startsWith('\\')) {
            return `${API}/foto-local?ruta=${encodeURIComponent(ruta)}`;
        }
        // Si es una subida normal, usamos la carpeta de uploads
        return UPLOADS_URL + ruta.replace(/ /g, '%20');
    };

    return (
        <div className="admin-container">
            <div style={{ marginLeft: '240px', width: 'calc(100% - 240px)', padding: '20px' }}>
                <header className="admin-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                        <h1 className="admin-title">🛰️ MAPA SATELITAL PRO</h1>
                        <span className="section-title" style={{ fontSize: '0.65rem', margin: 0 }}>VISTA GEOGRÁFICA DE ACTIVOS</span>
                    </div>
                </header>

                <div className="mapa-outer-container">
                    {cargando ? (
                        <div style={{ height: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <p className="admin-title" style={{ color: '#ffaa00' }}>SINCRONIZANDO SATÉLITES...</p>
                        </div>
                    ) : (
                        <MapContainer 
                            center={centro} 
                            zoom={zoom} 
                            className="mapa-leaflet-container"
                            zoomControl={true}
                        >
                            <ChangeView center={centro} zoom={zoom} />
                            
                            {/* CAPA DE SATÉLITE (ESRI WORLD IMAGERY) */}
                            <TileLayer
                                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                                attribution='&copy; <a href="https://www.esri.com/">Esri</a>, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EBP, and the GIS User Community'
                            />

                            {fotos.map(foto => {
                                const tituloFinal = foto.titulo || (foto.imagen_url ? foto.imagen_url.split(/[\\/]/).pop() : 'FOTO SIN NOMBRE');
                                const urlFinal = getFotoUrl(foto);
                                return (
                                    <Marker 
                                        key={foto.id} 
                                        position={[foto.latitud, foto.longitud]}
                                        icon={neonIcon}
                                    >
                                        <Popup minWidth={220} className="map-photo-popup">
                                            <div className="map-popup-card" style={{minHeight: '200px'}}>
                                                <div className="map-photo-title">{tituloFinal.toUpperCase()}</div>
                                                <div className="map-popup-img-container" style={{background: '#000', marginBottom: '8px'}}>
                                                    {urlFinal ? (
                                                        <img 
                                                            src={urlFinal} 
                                                            alt={tituloFinal}
                                                            className="map-popup-img" 
                                                            style={{width: '100%', height: '140px', objectFit: 'cover', display: 'block'}}
                                                        />
                                                    ) : (
                                                        <div style={{height: '140px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#444'}}>🖼️ SIN IMAGEN</div>
                                                    )}
                                                </div>
                                                <div className="map-photo-meta-row" style={{marginBottom: '10px'}}>
                                                    <span>📍 {foto.lugar || 'Ubicación'}</span>
                                                    <span>📅 {foto.anio || '????'}</span>
                                                </div>
                                                <button 
                                                    className="map-popup-btn"
                                                    style={{width: '100%', cursor: 'pointer'}}
                                                    onClick={() => {
                                                        const galeriaUrl = `#/galeria-completa?fotoId=${foto.id}`;
                                                        window.location.hash = galeriaUrl;
                                                    }}
                                                >
                                                    🔍 VER EN GALERÍA
                                                </button>
                                            </div>
                                        </Popup>
                                    </Marker>
                                );
                            })}
                        </MapContainer>
                    )}
                </div>

                <div style={{ marginTop: '20px', color: '#888', fontSize: '0.75rem', textAlign: 'center' }}>
                    * LAS COORDENADAS SON PROCESADAS DESDE LOS METADATOS EXIF DE TUS ARCHIVOS LOCALES.
                </div>
            </div>
        </div>
    );
};

export default Mapa;
