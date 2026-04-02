import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { useSearchParams, useNavigate } from 'react-router-dom';
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

// Icono neón para la foto seleccionada (más grande y color diferente)
const activeNeonIcon = new L.DivIcon({
    className: 'custom-div-icon',
    html: "<div class='custom-marker-neon active-marker'></div>",
    iconSize: [30, 30],
    iconAnchor: [15, 15]
});

// Componente para ajustar la vista al cargar fotos o ir a una específica
function MapController({ center, zoom, fotoId, markersRef }) {
    const map = useMap();
    
    useEffect(() => {
        if (!center) return;
        
        if (fotoId) {
            // Vuelo suave (flyTo) si venimos buscando una foto concreta
            map.flyTo(center, 18, { animate: true, duration: 1.5 });
            
            // Retraso pequeño para que el vuelo termine o empiece antes de abrir el popup
            const timer = setTimeout(() => {
                const marker = markersRef.current[fotoId];
                if (marker) {
                    marker.openPopup();
                }
            }, 1600);
            return () => clearTimeout(timer);
        } else {
            map.setView(center, zoom);
        }
    }, [center, zoom, map, fotoId, markersRef]);
    
    return null;
}

// NUEVO: Componente para detectar el área visible y filtrar marcadores
function ViewportNotifier({ onBoundsChange }) {
    const map = useMapEvents({
        moveend: () => onBoundsChange(map.getBounds()),
        zoomend: () => onBoundsChange(map.getBounds())
    });
    
    // Al montar (primera carga), notificamos el área inicial
    useEffect(() => {
        onBoundsChange(map.getBounds());
    }, []);

    return null;
}

const Mapa = () => {
    const navigate = useNavigate();
    const { usuario } = useAuth();
    const [searchParams] = useSearchParams();
    const fotoIdUrl = searchParams.get('fotoId');

    const [fotos, setFotos] = useState([]);
    const [cargando, setCargando] = useState(true);
    const [centro, setCentro] = useState([40.4168, -3.7038]); // Madrid por defecto
    const [zoom, setZoom] = useState(5);
    const [visibleBounds, setVisibleBounds] = useState(null);
    
    // Referencias para los marcadores para poder abrir los popups programáticamente
    const markersRef = React.useRef({});

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
        <div className="admin-container" style={{ padding: 0 }}>
            <div style={{ width: '100%', padding: '20px' }}>
                <header className="admin-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px', width: '100%' }}>
                        <h1 className="admin-title">🛰️ MAPA SATELITAL PRO</h1>
                        <span className="section-title" style={{ fontSize: '0.65rem', margin: 0 }}>VISTA GEOGRÁFICA DE ACTIVOS</span>
                        <div style={{ marginLeft: 'auto' }}>
                            <button 
                                className="map-close-floating" 
                                onClick={() => navigate(-1)}
                                title="Cerrar Mapa"
                            >
                                ✕
                            </button>
                        </div>
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
                            preferCanvas={false} // Cambiado a false para poder usar Refs en los marcadores con Popup automáticos
                        >
                            <MapController center={centro} zoom={zoom} fotoId={fotoIdUrl} markersRef={markersRef} />
                            <ViewportNotifier onBoundsChange={setVisibleBounds} />
                            
                            {/* CAPA DE SATÉLITE (ESRI WORLD IMAGERY) */}
                            <TileLayer
                                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                                attribution='&copy; <a href="https://www.esri.com/">Esri</a>, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EBP, and the GIS User Community'
                            />

                            {fotos
                                .filter(f => {
                                    if (!visibleBounds) return true; // Si no hay bounds aún, mostramos todo
                                    // Comprobar si la foto está dentro del área visible (viewport filtering)
                                    return visibleBounds.contains([f.latitud, f.longitud]);
                                })
                                .slice(0, 800) // Límite de seguridad: máximo 800 marcadores simultáneos
                                .map(foto => {
                                const tituloFinal = foto.titulo || (foto.imagen_url ? foto.imagen_url.split(/[\\/]/).pop() : 'FOTO SIN NOMBRE');
                                const urlFinal = getFotoUrl(foto);
                                return (
                                    <Marker 
                                        key={foto.id} 
                                        position={[foto.latitud, foto.longitud]}
                                        icon={String(foto.id) === String(fotoIdUrl) ? activeNeonIcon : neonIcon}
                                        ref={el => { if (el) markersRef.current[foto.id] = el; }}
                                        zIndexOffset={String(foto.id) === String(fotoIdUrl) ? 1000 : 0}
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
