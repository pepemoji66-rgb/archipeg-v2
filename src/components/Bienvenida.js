import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import './landing.css'; // Reutilizamos los estilos del nuevo diseño

export default function Bienvenida({ initialMode = 'login', onAuthSuccess }) {
    const [modo, setModo] = useState(initialMode); // 'login' | 'registro'
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmar, setConfirmar] = useState('');
    const [error, setError] = useState('');
    const [systemKey, setSystemKey] = useState('');
    const [cargando, setCargando] = useState(false);
    const { login, registro } = useAuth();
    const navigate = useNavigate();

    const limpiar = () => { setError(''); setPassword(''); setConfirmar(''); setSystemKey(''); };
    const cambiarModo = (nuevoModo) => { setModo(nuevoModo); limpiar(); };

    async function handleSubmit(e) {
        e.preventDefault();
        setError('');
        if (modo === 'registro' && password !== confirmar) return setError('Las contraseñas no coinciden');
        if (password.length < 6) return setError('Mínimo 6 caracteres');

        setCargando(true);
        try {
            if (modo === 'login') {
                await login(email.trim().toLowerCase(), password);
                if (onAuthSuccess) onAuthSuccess();
                navigate('/galeria-completa');
            } else {
                const resData = await registro(email.trim().toLowerCase(), password, systemKey.trim());
                if (resData && !resData.token) {
                    setError('PENDIENTE: Un administrador debe aprobar tu cuenta.');
                } else {
                    if (onAuthSuccess) onAuthSuccess();
                    navigate('/galeria-completa');
                }
            }
        } catch (err) {
            setError('Error: Email o contraseña incorrectos');
        } finally {
            setCargando(false);
        }
    }

    return (
        <div className="indice-auth-content">
            <h2 className="landing-hero-title" style={{ fontSize: '1.5rem', marginBottom: '10px', textAlign: 'center' }}>
                {modo === 'login' ? 'INICIAR SESIÓN' : 'CREAR CUENTA'}
            </h2>
            <p style={{ color: '#888', textAlign: 'center', marginBottom: '20px', fontSize: '0.8rem' }}>
                {modo === 'login' ? 'Bienvenido de nuevo a tu archivo privado.' : 'Únete a la soberanía digital de Archipeg.'}
            </p>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <input
                    className="indice-auth-input"
                    type="email"
                    placeholder="Tu email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                />
                <input
                    className="indice-auth-input"
                    type="password"
                    placeholder="Contraseña"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                />
                
                {modo === 'registro' && (
                    <>
                        <input
                            className="indice-auth-input"
                            type="password"
                            placeholder="Repite contraseña"
                            value={confirmar}
                            onChange={e => setConfirmar(e.target.value)}
                            required
                        />
                        <input
                            className="indice-auth-input"
                            type="password"
                            placeholder="Clave de Sistema (Opcional)"
                            value={systemKey}
                            onChange={e => setSystemKey(e.target.value)}
                        />
                    </>
                )}

                {error && <div style={{ color: '#ff4444', fontSize: '0.75rem', textAlign: 'center', background: 'rgba(255,0,0,0.1)', padding: '8px', borderRadius: '5px' }}>{error}</div>}

                <button className="btn-primary-neon" type="submit" disabled={cargando} style={{ width: '100%', marginTop: '10px' }}>
                    {cargando ? 'VALIDANDO...' : modo === 'login' ? 'ENTRAR AHORA' : 'CONSEGUIR MI CUENTA'}
                </button>

                <div style={{ textAlign: 'center', marginTop: '15px', fontSize: '0.8rem', color: '#666' }}>
                    {modo === 'login' ? (
                        <>¿Nuevo en Archipeg? <span onClick={() => cambiarModo('registro')} style={{ color: '#00f2ff', cursor: 'pointer' }}>Regístrate gratis</span></>
                    ) : (
                        <>¿Ya tienes cuenta? <span onClick={() => cambiarModo('login')} style={{ color: '#00f2ff', cursor: 'pointer' }}>Inicia sesión</span></>
                    )}
                </div>
            </form>
        </div>
    );
}
