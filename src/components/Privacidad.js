import React from 'react';
import { Link } from 'react-router-dom';

const Privacidad = () => {
    return (
        <div style={{ padding: '40px 20px', maxWidth: '800px', margin: '0 auto', color: '#fff', fontFamily: 'Outfit, sans-serif' }}>
            <h1 style={{ color: 'var(--acento-turquesa)', marginBottom: '30px' }}>Política de Privacidad</h1>
            
            <section style={{ marginBottom: '30px', lineHeight: '1.6', color: '#ccc' }}>
                <h2 style={{ color: '#fff', fontSize: '1.4rem', marginBottom: '15px' }}>1. Información General</h2>
                <p>
                    En ARCHIPEG PRO nos tomamos tu privacidad muy en serio. Esta política describe cómo recopilamos, usamos y protegemos tu información personal cuando utilizas nuestra aplicación web y de escritorio.
                </p>
            </section>

            <section style={{ marginBottom: '30px', lineHeight: '1.6', color: '#ccc' }}>
                <h2 style={{ color: '#fff', fontSize: '1.4rem', marginBottom: '15px' }}>2. Datos que Recopilamos</h2>
                <p>
                    Para proporcionarte el servicio, únicamente recopilamos los datos estrictamente necesarios para tu registro y autenticación:
                </p>
                <ul style={{ paddingLeft: '20px', marginTop: '10px' }}>
                    <li>Dirección de correo electrónico (para el login y notificaciones).</li>
                    <li>Contraseña (almacenada de forma segura y encriptada).</li>
                </ul>
                <p style={{ marginTop: '10px', fontWeight: 'bold', color: '#f100ff' }}>
                    IMPORTANTE: ARCHIPEG PRO es un software soberano. Nunca subimos, leemos ni almacenamos tus fotografías, vídeos ni documentos en nuestros servidores. Todo el procesamiento de archivos ocurre de forma 100% local en tu propio ordenador.
                </p>
            </section>

            <section style={{ marginBottom: '30px', lineHeight: '1.6', color: '#ccc' }}>
                <h2 style={{ color: '#fff', fontSize: '1.4rem', marginBottom: '15px' }}>3. Uso de la Información</h2>
                <p>
                    Utilizamos tu correo electrónico exclusivamente para proporcionarte acceso a tu cuenta, informarte sobre actualizaciones críticas de seguridad del software y procesar la validación de tu licencia (Pro).
                </p>
            </section>

            <section style={{ marginBottom: '30px', lineHeight: '1.6', color: '#ccc' }}>
                <h2 style={{ color: '#fff', fontSize: '1.4rem', marginBottom: '15px' }}>4. Pagos y Terceros</h2>
                <p>
                    Los pagos son procesados de forma segura a través de nuestro proveedor de pagos, Stripe. Nosotros no tenemos acceso ni almacenamos los datos de tu tarjeta de crédito. Stripe tiene su propia política de privacidad aplicable a dicha transacción.
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

export default Privacidad;
