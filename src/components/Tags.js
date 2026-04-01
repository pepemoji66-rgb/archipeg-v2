import { API_BASE_URL } from '../config';

const API = `${API_BASE_URL}/api`;

const Tags = () => {
    const [tags, setTags] = useState([]);
    const navigate = useNavigate();

    useEffect(() => {
        apiFetch(`${API}/tags`)
            .then(r => r.json())
            .then(setTags)
            .catch((err) => console.error("Error en el escaneo de etiquetas:", err));
    }, []);

    const maxTotal = tags[0]?.total || 1;

    return (
        <div className="admin-container">
            {/* MARGEN PARA EL MENÚ LATERAL */}
            <div style={{ marginLeft: '240px', width: 'calc(100% - 240px)', padding: '20px' }}>

                <header className="admin-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                        <h1 className="admin-title">🏷️ TAGS</h1>
                        <span className="section-title" style={{ fontSize: '0.65rem', margin: 0 }}>INDEXACIÓN DE METADATOS</span>
                    </div>
                    <div className="tag-badge" style={{ borderColor: '#00ffff', color: '#00ffff' }}>
                        {tags.length} ETIQUETAS DETECTADAS
                    </div>
                </header>

                {tags.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '100px', opacity: 0.5 }}>
                        <p className="section-title">NO SE HAN ENCONTRADO ETIQUETAS EN EL SISTEMA</p>
                        <p style={{ fontSize: '0.75rem', color: '#aaa', marginTop: '10px' }}>
                            AÑADE TAGS A TUS FOTOS DESDE EL PANEL DE GESTIÓN PARA INDEXAR EL CONTENIDO.
                        </p>
                    </div>
                ) : (
                    <div className="admin-card" style={{
                        marginTop: '30px',
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '15px',
                        padding: '30px',
                        justifyContent: 'center',
                        background: 'rgba(10, 10, 15, 0.5)'
                    }}>
                        {tags.map(t => {
                            const ratio = t.total / maxTotal;
                            const size = 0.8 + ratio * 1.2; // Tamaño dinámico ARCHIPEG
                            const brightness = 60 + (ratio * 40); // Más luz si es más común

                            return (
                                <button
                                    key={t.tag}
                                    className="btn-volver-neon"
                                    onClick={() => navigate(`/galeria-completa?q=${encodeURIComponent(t.tag)}`)}
                                    style={{
                                        fontSize: `${size}rem`,
                                        padding: `${8 + ratio * 8}px ${15 + ratio * 10}px`,
                                        borderColor: `rgba(0, 255, 255, ${0.3 + ratio * 0.7})`,
                                        color: `hsl(180, 100%, ${brightness}%)`,
                                        textTransform: 'uppercase',
                                        letterSpacing: '1px',
                                        backgroundColor: 'transparent',
                                        transition: 'all 0.3s ease'
                                    }}
                                    onMouseEnter={e => {
                                        e.target.style.boxShadow = '0 0 20px #00ffff';
                                        e.target.style.backgroundColor = 'rgba(0, 255, 255, 0.1)';
                                    }}
                                    onMouseLeave={e => {
                                        e.target.style.boxShadow = 'none';
                                        e.target.style.backgroundColor = 'transparent';
                                    }}
                                >
                                    #{t.tag}
                                    <span style={{
                                        fontSize: '0.7rem',
                                        marginLeft: '8px',
                                        opacity: 0.5,
                                        fontFamily: 'monospace'
                                    }}>
                                        [{t.total}]
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Tags;