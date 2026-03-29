import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../api';
import './usuarios.css';

const API = 'http://127.0.0.1:5001/api';

export default function Usuarios() {
    const navigate = useNavigate();
    const [usuarios, setUsuarios] = useState([]);
    const [cargando, setCargando] = useState(false);
    
    // Paginación
    const [paginaActual, setPaginaActual] = useState(1);
    const limite = 10;

    const cargarUsuarios = async () => {
        setCargando(true);
        try {
            const res = await apiFetch(`${API}/usuarios`);
            if (res.ok) {
                const data = await res.json();
                setUsuarios(Array.isArray(data) ? data : []);
            }
        } catch (error) {
            console.error("Error al cargar usuarios:", error);
        } finally {
            setCargando(false);
        }
    };

    useEffect(() => {
        cargarUsuarios();
    }, []);

    const toggleAprobacion = async (id, actual) => {
        try {
            const res = await apiFetch(`${API}/usuarios/${id}/aprobar`, { method: 'PATCH' });
            if (res.ok) {
                const { aprobado } = await res.json();
                setUsuarios(prev => prev.map(u => u.id === id ? { ...u, aprobado } : u));
            } else {
                alert("Error al cambiar la aprobación.");
            }
        } catch (_) {
            alert("Error de red.");
        }
    };

    const toggleAdmin = async (id, actual) => {
        const accion = actual ? "quitarle el rol de administrador a" : "hacer administrador a";
        if (!window.confirm(`¿Seguro que quieres ${accion} este usuario?`)) return;

        try {
            const res = await apiFetch(`${API}/usuarios/${id}/admin`, { method: 'PATCH' });
            if (res.ok) {
                const { es_admin } = await res.json();
                setUsuarios(prev => prev.map(u => u.id === id ? { ...u, es_admin } : u));
            } else {
                alert("Error al cambiar el rol.");
            }
        } catch (_) {
            alert("Error de red.");
        }
    };

    const borrarUsuario = async (id) => {
        if (!window.confirm("¿Seguro que deseas eliminar definitivamente a este usuario? Esta acción no se puede deshacer.")) return;
        try {
            const res = await apiFetch(`${API}/usuarios/${id}`, { method: 'DELETE' });
            if (res.ok) {
                setUsuarios(prev => prev.filter(u => u.id !== id));
            } else {
                const err = await res.json();
                alert(err.error || "Error al eliminar usuario.");
            }
        } catch (_) {
            alert("Error de red.");
        }
    };

    // Cálculos de Paginación
    const totalPaginas = Math.ceil(usuarios.length / limite);
    const paginados = useMemo(() => {
        const inicio = (paginaActual - 1) * limite;
        return usuarios.slice(inicio, inicio + limite);
    }, [usuarios, paginaActual, limite]);

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
