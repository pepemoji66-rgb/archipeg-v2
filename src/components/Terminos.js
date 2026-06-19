import React from 'react';
import { Link } from 'react-router-dom';

const Terminos = () => {
    return (
        <div style={{ padding: '40px 20px', maxWidth: '800px', margin: '0 auto', color: '#fff', fontFamily: 'Outfit, sans-serif' }}>
            <h1 style={{ color: 'var(--acento-turquesa)', marginBottom: '30px' }}>Términos y Condiciones</h1>
            
            <section style={{ marginBottom: '30px', lineHeight: '1.6', color: '#ccc' }}>
                <h2 style={{ color: '#fff', fontSize: '1.4rem', marginBottom: '15px' }}>1. Aceptación de los Términos</h2>
                <p>
                    Al acceder y utilizar ARCHIPEG PRO, aceptas estar sujeto a estos Términos y Condiciones. Si no estás de acuerdo con alguna parte de los términos, no podrás acceder al servicio.
                </p>
            </section>

            <section style={{ marginBottom: '30px', lineHeight: '1.6', color: '#ccc' }}>
                <h2 style={{ color: '#fff', fontSize: '1.4rem', marginBottom: '15px' }}>2. Descripción del Servicio</h2>
                <p>
                    ARCHIPEG PRO es un software de gestión de activos digitales que opera principalmente en un entorno local (aplicación de escritorio). Ofrecemos una versión web (PWA) de acceso remoto y una versión descargable para Windows (.exe).
                </p>
            </section>

            <section style={{ marginBottom: '30px', lineHeight: '1.6', color: '#ccc' }}>
                <h2 style={{ color: '#fff', fontSize: '1.4rem', marginBottom: '15px' }}>3. Compras y Pagos</h2>
                <p>
                    El pago para acceder a las funciones PRO es un pago único. Todas las transacciones se procesan a través de Stripe. No se garantizan reembolsos una vez que el software de escritorio ha sido descargado, salvo excepciones dictadas por la ley del consumidor aplicable.
                </p>
            </section>

            <section style={{ marginBottom: '30px', lineHeight: '1.6', color: '#ccc' }}>
                <h2 style={{ color: '#fff', fontSize: '1.4rem', marginBottom: '15px' }}>4. Licencia de Uso</h2>
                <p>
                    Se te concede una licencia personal, no exclusiva e intransferible para usar el software. No está permitido revender, distribuir ni realizar ingeniería inversa de la aplicación ARCHIPEG PRO.
                </p>
            </section>

            <section style={{ marginBottom: '30px', lineHeight: '1.6', color: '#ccc' }}>
                <h2 style={{ color: '#fff', fontSize: '1.4rem', marginBottom: '15px' }}>5. Limitación de Responsabilidad</h2>
                <p>
                    Dado que ARCHIPEG PRO opera en tu entorno local, no somos responsables de la pérdida de archivos, daños en el disco duro u otros problemas derivados del mal uso de la aplicación o del estado físico de tu hardware. Recomendamos siempre mantener copias de seguridad de tus archivos importantes.
                </p>
            </section>

            <div style={{ marginTop: '50px', textAlign: 'center' }}>
                <Link to="/" style={{ color: 'var(--acento-turquesa)', textDecoration: 'none', fontWeight: 'bold', padding: '10px 20px', border: '1px solid var(--acento-turquesa)', borderRadius: '8px' }}>
                    VOLVER A LA PÁGINA PRINCIPAL
                </Link>
            </div>
        </div>
    );
};

export default Terminos;
