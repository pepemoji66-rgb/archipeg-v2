import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../api';
import { API_BASE_URL } from '../config';
import './usuarios.css';

const API = `${API_BASE_URL}/api`;

export default function Usuarios() {
    const navigate = useNavigate();
    const [usuarios, setUsuarios] = useState([]);
    const [cargando, setCargando] = useState(false);
    const [totalUsuarios, setTotalUsuarios] = useState(0); 
    const [enviandoEmail, setEnviandoEmail] = useState(null); // ID del usuario al que se envía
    
    // Paginación
    const [paginaActual, setPaginaActual] = useState(1);
    const limite = 8;

    const cargarUsuarios = async (page = 1) => {
        setCargando(true);
        try {
            // Ahora le pedimos al servidor solo la página que queremos
            const res = await apiFetch(`${API}/usuarios?page=${page}&limit=${limite}`);
            if (res.ok) {
                const data = await res.json();
                console.log("📊 [DEBUG USUARIOS FRONTEND]:", data); // LOG CLAVE
                setUsuarios(data.usuarios || []); // Guardamos solo los de esta página
                setTotalUsuarios(data.total || 0); // Guardamos cuantos hay en TOTAL
            }
        } catch (error) {
            console.error("Error al cargar usuarios:", error);
        } finally {
            setCargando(false);
        }
    };

    useEffect(() => {
        cargarUsuarios(paginaActual);
    }, [paginaActual]);

    // --- ACCIONES (Mantienen la lógica pero recargan la página actual si es necesario) ---
    // (Opcional: Si eliminas un usuario, podrías volver a cargarUsuarios(paginaActual))

    const toggleAprobacion = async (id, actual) => {
        try {
            const res = await apiFetch(`${API}/usuarios/${id}/aprobar`, { method: 'PATCH' });
            if (res.ok) {
                const { aprobado } = await res.json();
                setUsuarios(prev => prev.map(u => u.id === id ? { ...u, aprobado } : u));
            }
        } catch (_) {}
    };

    const toggleAdmin = async (id, actual) => {
        const accion = actual ? "quitarle el rol de administrador a" : "hacer administrador a";
        if (!window.confirm(`¿Seguro que quieres ${accion} este usuario?`)) return;

        try {
            const res = await apiFetch(`${API}/usuarios/${id}/admin`, { method: 'PATCH' });
            if (res.ok) {
                const { es_admin } = await res.json();
                setUsuarios(prev => prev.map(u => u.id === id ? { ...u, es_admin } : u));
            }
        } catch (_) {}
    };

    const borrarUsuario = async (id) => {
        if (!window.confirm("¿Seguro que deseas eliminar definitivamente a este usuario?")) return;
        try {
            const res = await apiFetch(`${API}/usuarios/${id}`, { method: 'DELETE' });
            if (res.ok) {
                // Si borramos, mejor recargamos la página para que la lista se reorganice
                cargarUsuarios(paginaActual);
            }
        } catch (_) {}
    };

    const enviarEmailPro = async (id) => {
        setEnviandoEmail(id);
        try {
            const res = await apiFetch(`${API}/usuarios/${id}/enviar-pro`, { method: 'POST' });
            if (res.ok) {
                alert("✅ Correo enviado con éxito con el enlace de descarga.");
            } else {
                const err = await res.json();
                alert("❌ Error al enviar correo: " + (err.error || "Desconocido"));
            }
        } catch (error) {
            alert("❌ Fallo crítico al conectar con el servidor de correo.");
        } finally {
            setEnviandoEmail(null);
        }
    };

    // Cálculos de Paginación REAL (Basados en el total que nos da el servidor)
    const totalPaginas = Math.ceil(totalUsuarios / limite);
    const paginados = usuarios; // Ahora 'usuarios' YA viene filtrado por el servidor

    return (
        <div className="usuarios-container">
            <header className="usuarios-header">
                <div>
                    <button className="btn-volver-neon" onClick={() => navigate('/galeria-completa')}>⬅ VOLVER</button>
                </div>
                <div>
                    <h1 className="usuarios-title">PANEL DE USUARIOS</h1>
                </div>
                <div>
                    <span className="badge badge-role" style={{ fontSize: '1rem' }}>{usuarios.length} REGISTRADOS</span>
                </div>
            </header>

            <main className="usuarios-card">
                {cargando ? (
                    <div style={{ textAlign: 'center', color: '#00ffff' }}>Cargando inteligencia de usuarios...</div>
                ) : (
                    <>
                        <div className="table-responsive">
                            <table className="usuarios-table">
                                <thead>
                                    <tr>
                                        <th>ID / EMAIL</th>
                                        <th>ESTADO</th>
                                        <th>ROL</th>
                                        <th>REGISTRO</th>
                                        <th>ACCIONES DE PODER</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginados.length === 0 ? (
                                        <tr><td colSpan="5" style={{ textAlign: 'center' }}>No hay usuarios</td></tr>
                                    ) : paginados.map(u => (
                                        <tr key={u.id}>
                                            <td>
                                                <strong>#{u.id}</strong> <br/>
                                                {u.email}
                                            </td>
                                            <td>
                                                {u.aprobado === 1 ? (
                                                    <span className="badge badge-green">APROBADO</span>
                                                ) : (
                                                    <span className="badge badge-red">BLOQUEADO</span>
                                                )}
                                            </td>
                                            <td>
                                                {u.es_admin === 1 ? (
                                                    <span className="badge badge-role">ADMINISTRADOR</span>
                                                ) : (
                                                    <span className="badge badge-role-user">USUARIO</span>
                                                )}
                                            </td>
                                            <td>
                                                {new Date(u.creado_en).toLocaleString()}
                                            </td>
                                            <td className="td-acciones">
                                                {/* Aprobar / Bloquear */}
                                                <button 
                                                    className={`btn-usr-action ${u.aprobado === 1 ? 'danger' : ''}`}
                                                    onClick={() => toggleAprobacion(u.id, u.aprobado === 1)}
                                                    disabled={u.id === 1}
                                                >
                                                    {u.aprobado === 1 ? 'BLOQUEAR' : 'APROBAR'}
                                                </button>

                                                {/* Poderes Admin */}
                                                <button 
                                                    className={`btn-usr-action ${u.es_admin === 1 ? 'danger' : 'purple'}`}
                                                    onClick={() => toggleAdmin(u.id, u.es_admin === 1)}
                                                    disabled={u.id === 1}
                                                >
                                                    {u.es_admin === 1 ? 'QUITAR ADMIN' : 'HACER ADMIN'}
                                                </button>

                                                {/* Eliminar (Prohibido para el id 1) */}
                                                <button 
                                                    className="btn-usr-action danger"
                                                    onClick={() => borrarUsuario(u.id)}
                                                    disabled={u.id === 1}
                                                >
                                                    🗑️ ELIMINAR
                                                </button>

                                                {/* ENVIAR ENLACE PRO POR CORREO */}
                                                {u.aprobado === 1 && u.id !== 1 && (
                                                    <button 
                                                        className="btn-usr-action"
                                                        style={{ 
                                                            backgroundColor: enviandoEmail === u.id ? '#666' : '#ffcc00', 
                                                            color: '#000', 
                                                            fontWeight: '900', 
                                                            border: '1px solid #000',
                                                            cursor: enviandoEmail === u.id ? 'wait' : 'pointer'
                                                        }}
                                                        onClick={() => enviarEmailPro(u.id)}
                                                        disabled={enviandoEmail !== null}
                                                    >
                                                        {enviandoEmail === u.id ? '⌛ ENVIANDO...' : '✉️ ENVIAR PRO'}
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Controles de paginación */}
                        {totalPaginas > 1 && (
                            <div className="paginacion-container">
                                <button 
                                    className="paginacion-btn" 
                                    disabled={paginaActual === 1}
                                    onClick={() => setPaginaActual(p => Math.max(1, p - 1))}
                                >
                                    ◀ ANTERIOR
                                </button>
                                <span className="paginacion-info">
                                    PAGINA {paginaActual} DE {totalPaginas}
                                </span>
                                <button 
                                    className="paginacion-btn" 
                                    disabled={paginaActual === totalPaginas}
                                    onClick={() => setPaginaActual(p => Math.min(totalPaginas, p + 1))}
                                >
                                    SIGUIENTE ▶
                                </button>
                            </div>
                        )}
                    </>
                )}
            </main>
        </div>
    );
}
