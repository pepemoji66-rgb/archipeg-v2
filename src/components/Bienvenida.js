import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import './landing.css'; // Reutilizamos los estilos del nuevo diseño

export default function Bienvenida({ initialMode = 'login', onAuthSuccess }) {
    const [modo, setModo] = useState(initialMode); // 'login' | 'registro'
    const [email, setEmail] = useState(() => initialMode === 'login' ? (localStorage.getItem('archipeg_remembered_email') || '') : '');
    const [password, setPassword] = useState(() => initialMode === 'login' ? (localStorage.getItem('archipeg_remembered_password') || '') : '');
    const [confirmar, setConfirmar] = useState('');
    const [error, setError] = useState('');
    const [systemKey, setSystemKey] = useState('');
    const [cargando, setCargando] = useState(false);
    const [recordar, setRecordar] = useState(true);
    const { login, registro } = useAuth();
    const navigate = useNavigate();

    const cambiarModo = (nuevoModo) => {
        setError('');
        setConfirmar('');
        setSystemKey('');
        if (nuevoModo === 'registro') {
            setEmail('');
            setPassword('');
        } else {
            setEmail(localStorage.getItem('archipeg_remembered_email') || '');
            setPassword(localStorage.getItem('archipeg_remembered_password') || '');
        }
        setModo(nuevoModo);
    };

    async function handleSubmit(e) {
        e.preventDefault();
        setError('');
        if (modo === 'registro' && password !== confirmar) return setError('Las contraseñas no coinciden');
        if (password.length < 6) return setError('Mínimo 6 caracteres');

        setCargando(true);
        try {
            if (modo === 'login') {
                await login(email.trim().toLowerCase(), password);
                if (recordar) {
                    localStorage.setItem('archipeg_remembered_email', email);
                    localStorage.setItem('archipeg_remembered_password', password);
                } else {
                    localStorage.removeItem('archipeg_remembered_email');
                    localStorage.removeItem('archipeg_remembered_password');
                }
                if (onAuthSuccess) onAuthSuccess();
                navigate('/galeria-completa');
            } else {
                const resData = await registro(email.trim().toLowerCase(), password, '');
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
            setError(err.message);
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
                
                {modo === 'login' && (
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ccc', fontSize: '0.85rem', cursor: 'pointer', userSelect: 'none', paddingLeft: '2px' }}>
                        <input
                            type="checkbox"
                            checked={recordar}
                            onChange={e => setRecordar(e.target.checked)}
                            style={{ accentColor: 'var(--acento-turquesa)', width: '16px', height: '16px', cursor: 'pointer' }}
                        />
                        Recordar mi contraseña
                    </label>
                )}
                
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
                    </>
                )}

                {error && <div style={{ color: '#ff4444', fontSize: '0.75rem', textAlign: 'center', background: 'rgba(255,0,0,0.1)', padding: '8px', borderRadius: '5px' }}>{error}</div>}

                <div className="sovereignty-info-box">
                    <strong>🛡️ SOBERANÍA DIGITAL</strong>
                    <p>
                        Tus fotos y vídeos originales <b>nunca</b> se suben a esta web. Permanecen en tu disco duro. 
                        Esta cuenta de nube solo sirve para gestionar tu catálogo y álbumes compartidos.
                    </p>
                </div>

                <button className="btn-primary-neon" type="submit" disabled={cargando} style={{ width: '100%', marginTop: '10px' }}>
                    {cargando ? 'VALIDANDO...' : modo === 'login' ? 'ENTRAR AHORA' : 'CONSEGUIR MI CUENTA'}
                </button>

                <div style={{ textAlign: 'center', marginTop: '20px' }}>
                    {modo === 'login' ? (
                        <button type="button" onClick={() => cambiarModo('registro')} style={{ background: 'transparent', border: '1px solid var(--acento-turquesa)', color: 'var(--acento-turquesa)', padding: '8px 20px', borderRadius: '5px', cursor: 'pointer', width: '100%' }}>
                            ¿No tienes cuenta? CREAR CUENTA
                        </button>
                    ) : (
                        <button type="button" onClick={() => cambiarModo('login')} style={{ background: 'transparent', border: '1px solid #aaa', color: '#ccc', padding: '8px 20px', borderRadius: '5px', cursor: 'pointer', width: '100%' }}>
                            ⬅️ Volver a Iniciar Sesión
                        </button>
                    )}
                </div>
            </form>
        </div>
    );
}
