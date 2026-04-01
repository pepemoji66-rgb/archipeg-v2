import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import './bienvenida.css';

export default function Bienvenida({ initialMode = 'login' }) {
    const [modo, setModo] = useState(initialMode); // 'login' | 'registro'
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmar, setConfirmar] = useState('');
    const [error, setError] = useState('');
    const [systemKey, setSystemKey] = useState('');
    const [cargando, setCargando] = useState(false);
    const { login, registro, entrarDemo } = useAuth();
    const navigate = useNavigate();
    const [mensajeExito, setMensajeExito] = useState('');

    const limpiar = () => { setError(''); setMensajeExito(''); setPassword(''); setConfirmar(''); setSystemKey(''); };

    const cambiarModo = (nuevoModo) => { setModo(nuevoModo); limpiar(); };

    async function handleSubmit(e) {
        e.preventDefault();
        setError('');

        if (modo === 'registro' && password !== confirmar) {
            setError('Las contraseñas no coinciden');
            return;
        }
        if (password.length < 6) {
            setError('La contraseña debe tener al menos 6 caracteres');
            return;
        }

        setCargando(true);
        try {
            if (modo === 'login') {
                await login(email.trim(), password);
                navigate('/galeria-completa');
            } else {
                const resData = await registro(email.trim(), password, systemKey.trim());
                if (resData && !resData.token) { // Si no hay token, es que está pendiente de aprobación
                    setMensajeExito(resData.message || 'Registro completado. Un administrador debe aprobar tu cuenta.');
                    setEmail(''); setPassword(''); setConfirmar(''); setSystemKey('');
                } else {
                    navigate('/galeria-completa');
                }
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setCargando(false);
        }
    }

    function handleDemo() {
        entrarDemo();
        navigate('/galeria-completa');
    }

    return (
        <div className="bienvenida-page">
            <div className="bienvenida-titulo-marco">
                <h1 className="bienvenida-titulo">ARCHIPEG<span style={{ color: '#00f2ff' }}> ·</span></h1>
                <p className="bienvenida-subtitulo">Gestión y Archivo Fotográfico</p>
            </div>

            <form className="bienvenida-formulario" onSubmit={handleSubmit} autoComplete="off">
                <h2>{modo === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}</h2>

                <input
                    className="bienvenida-input"
                    type="email"
                    name="archipeg_user_email"
                    autoComplete="new-password"
                    placeholder="Email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    autoFocus
                />
                <input
                    className="bienvenida-input"
                    type="password"
                    name="archipeg_user_pass"
                    autoComplete="new-password"
                    placeholder="Contraseña"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                />
                {modo === 'registro' && (
                    <>
                        <input
                            className="bienvenida-input"
                            type="password"
                            name="archipeg_user_pass_confirm"
                            autoComplete="new-password"
                            placeholder="Confirmar contraseña"
                            value={confirmar}
                            onChange={e => setConfirmar(e.target.value)}
                            required
                        />
                        <div style={{ marginTop: '10px', fontSize: '0.8em', color: '#00f2ff', textAlign: 'left', width: '100%', paddingLeft: '5px' }}>
                            ¿Eres Administrador? Ingresa la Clave de Sistema:
                        </div>
                        <input
                            className="bienvenida-input"
                            type="password"
                            name="archipeg_system_key"
                            autoComplete="new-password"
                            placeholder="Clave de Sistema (Opcional)"
                            value={systemKey}
                            onChange={e => setSystemKey(e.target.value)}
                        />
                    </>
                )}

                {error && <div className="bienvenida-error">{error}</div>}
                {mensajeExito && (
                    <div style={{
                        marginTop: '15px',
                        padding: '12px',
                        background: 'rgba(0, 255, 128, 0.1)',
                        border: '1px solid #00ff80',
                        color: '#00ff80',
                        borderRadius: '6px',
                        fontSize: '0.85rem',
                        textAlign: 'center',
                        boxShadow: '0 0 10px rgba(0, 255, 128, 0.2)'
                    }}>
                        {mensajeExito}
                    </div>
                )}

                <button className="bienvenida-btn-primary" type="submit" disabled={cargando}>
                    {cargando ? 'Cargando...' : modo === 'login' ? 'INICIAR SESIÓN' : 'REGISTRARSE'}
                </button>

                <div className="bienvenida-toggle">
                    {modo === 'login' ? (
                        <>¿No tienes cuenta?<button type="button" onClick={() => cambiarModo('registro')}>Regístrate</button></>
                    ) : (
                        <>¿Ya tienes cuenta?<button type="button" onClick={() => cambiarModo('login')}>Inicia sesión</button></>
                    )}
                </div>
            </form>

            <div className="bienvenida-separador">o continúa con</div>

            <div className="bienvenida-demo-bloque">
                <button className="bienvenida-btn-demo" onClick={handleDemo}>
                    PROBAR DEMO
                </button>
                <span className="bienvenida-demo-nota">Limitado a 50 fotos · Sin registro</span>
            </div>
        </div>
    );
}
