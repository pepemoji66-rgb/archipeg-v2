import React from 'react';

const AcercaDe = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    return (
        <div style={styles.overlay}>
            <div style={styles.modal}>
                <h2 style={styles.title}>ARCHIPEG</h2>
                <p style={styles.version}>Versión 1.0.0 (Estable)</p>

                <div style={styles.divider}></div>

                <p style={styles.text}>
                    Sistema profesional de archivo fotográfico y gestión de activos digitales.
                </p>

                <p style={styles.author}>
                    Desarrollado por:<br />
                    <strong>JOSE MORENO JIMENEZ</strong>
                </p>

                <div style={styles.divider}></div>

                <p style={styles.copyright}>
                    © 2026 ARCHIPEG Software. Todos los derechos reservados.
                    <br />
                    Licencia de uso privado. Prohibida su reproducción.
                </p>

                <button onClick={onClose} className="btn-archipeg" style={styles.button}>
                    Cerrar
                </button>
            </div>
        </div>
    );
};

const styles = {
    overlay: {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(44, 62, 80, 0.7)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 9999,
        backdropFilter: 'blur(4px)'
    },
    modal: {
        background: 'white',
        padding: '40px',
        borderRadius: '20px',
        textAlign: 'center',
        maxWidth: '400px',
        width: '90%',
        boxShadow: '0 15px 35px rgba(0,0,0,0.3)',
        fontFamily: "'Poppins', sans-serif"
    },
    title: {
        margin: '0',
        color: '#007bff',
        letterSpacing: '3px',
        fontWeight: '700'
    },
    version: {
        fontSize: '0.85rem',
        color: '#7f8c8d',
        marginBottom: '10px'
    },
    divider: {
        height: '3px',
        background: 'linear-gradient(to right, #007bff, #2ecc71)',
        margin: '20px auto',
        width: '60%',
        borderRadius: '2px'
    },
    text: {
        fontSize: '1rem',
        color: '#34495e',
        lineHeight: '1.5'
    },
    author: {
        fontSize: '1.1rem',
        color: '#2c3e50',
        margin: '25px 0'
    },
    copyright: {
        fontSize: '0.75rem',
        color: '#bdc3c7',
        lineHeight: '1.4'
    },
    button: {
        marginTop: '20px',
        width: '100%'
    }
};

export default AcercaDe;