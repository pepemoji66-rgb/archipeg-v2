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

    const limpiar = () => { setEmail(''); setPassword(''); setConfirmar(''); setSystemKey(''); setError(''); };
    const cambiarModo = (nuevoModo) => { limpiar(); setModo(nuevoModo); };

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
                    setTimeout(() => {
                        limpiar();
                        setModo('login');
                    }, 3000);
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
            <div style={{ textAlign: 'center', marginBottom: '15px' }}>
                <img src="logo_archipeg_principal.png" alt="Archipeg" style={{ width: '60px', height: '60px', objectFit: 'contain' }} />
            </div>
            <h2 className="landing-hero-title" style={{ fontSize: '1.5rem', marginBottom: '10px', textAlign: 'center' }}>
                {modo === 'login' ? 'INICIAR SESIÓN' : 'REGISTRO SOBERANO'}
            </h2>
            <p style={{ color: '#888', textAlign: 'center', marginBottom: '20px', fontSize: '0.8rem' }}>
                {modo === 'login' ? 'Entra a tu archivo privado.' : 'Crear una cuenta nueva (requiere aprobación).'}
            </p>

            <form onSubmit={handleSubmit} autoComplete="off" style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <input
                    className="indice-auth-input"
                    type="email"
                    name={modo === 'registro' ? "reg_email" : "login_email"}
                    id={modo === 'registro' ? "reg_email" : "login_email"}
                    placeholder="Tu email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    autoComplete={modo === 'registro' ? "new-password" : "off"}
                    required
                />
                <input
                    className="indice-auth-input"
                    type="password"
                    name={modo === 'registro' ? "reg_pass" : "login_pass"}
                    id={modo === 'registro' ? "reg_pass" : "login_pass"}
                    placeholder="Contraseña"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    autoComplete={modo === 'registro' ? "new-password" : "off"}
                    required
                />
                
                {modo === 'registro' && (
                    <>
                        <input
                            className="indice-auth-input"
                            type="password"
                            name="reg_confirm"
                            id="reg_confirm"
                            placeholder="Repite contraseña"
                            value={confirmar}
                            onChange={e => setConfirmar(e.target.value)}
                            autoComplete="new-password"
                            required
                        />
                        <input
                            className="indice-auth-input"
                            type="text"
                            name="system_key"
                            id="system_key"
                            placeholder="Clave de Sistema (Opcional)"
                            value={systemKey}
                            onChange={e => setSystemKey(e.target.value)}
                            autoComplete="off"
                        />
                        <p style={{ fontSize: '0.7rem', color: '#ffcc00', marginTop: '-5px' }}>
                            * Solo si eres administrador o tienes invitación Pro.
                        </p>
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
