/**
 * =============================================================================
 * SOFTWARE: ARCHIPEG - Sistema de Gestión de Activos
 * COMPONENTE: Menu.js (Navegación Lateral Dinámica Actualizada)
 * DESARROLLADOR: [JOSE MORENO JIMENEZ]
 * COPYRIGHT © 2026 - TODOS LOS DERECHOS RESERVADOS
 * =============================================================================
 */

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import './menu.css';
import { API_BASE_URL } from '../config';
import { useAuth } from '../AuthContext';
import SelectorTema from './SelectorTema';

const Menu = () => {
    const { usuario } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const [anios, setAnios] = useState([]);

    useEffect(() => {
        axios.get(`${API_BASE_URL}/api/anios`)
            .then(res => {
                const aniosUnicos = res.data.map(item => item.anio).sort((a, b) => b - a);
                setAnios(aniosUnicos);
            })
            .catch(err => console.log("Error al traer los años:", err));
    }, []);

    const cerrarMenu = () => setIsOpen(false);

    return (
        <nav className="menu-container-archipeg">
            {/* Botón Hamburguesa */}
            <div
                className={`hamburguesa-boton ${isOpen ? "active" : ""}`}
                onClick={() => setIsOpen(!isOpen)}
                title="Menú de Navegación"
            >
                <div className="linea"></div>
                <div className="linea"></div>
                <div className="linea"></div>
            </div>

            {/* Panel Lateral */}
            <aside className={`nav-links-archipeg ${isOpen ? "active" : ""}`}>
                <div className="menu-header-logo">
                    <img src="/logo_archipeg_principal.png" alt="Logo" className="logo-mini" />
                    <span className="brand-name">ARCHIPEG</span>
                </div>

                <ul className="lista-enlaces">
                    {/* BIBLIOTECA */}
                    <li className="menu-separador">BIBLIOTECA</li>
                    <li>
                        <Link to="/" onClick={cerrarMenu}>
                            <span className="icon">🏠</span> INICIO
                        </Link>
                    </li>
                    <li>
                        <Link to="/galeria-completa" onClick={cerrarMenu}>
                            <span className="icon">🖼️</span> TODAS LAS FOTOS
                        </Link>
                    </li>
                    <li>
                        <Link to="/presentacion" onClick={cerrarMenu} style={{color: '#00ffff', fontWeight: 'bold'}}>
                            <span className="icon">✨</span> PRESENTACIÓN
                        </Link>
                    </li>
                    <li>
                        <Link to="/duplicados" onClick={cerrarMenu}>
                            <span className="icon">🧬</span> DUPLICADOS
                        </Link>
                    </li>

                    {/* ORGANIZAR - Las nuevas secciones que hemos creado */}
                    <li className="menu-separador">ORGANIZAR</li>
                    <li>
                        <Link to="/albumes" onClick={cerrarMenu}>
                            <span className="icon">📁</span> ÁLBUMES
                        </Link>
                    </li>
                    <li>
                        <Link to="/eventos" onClick={cerrarMenu}>
                            <span className="icon">📅</span> EVENTOS
                        </Link>
                    </li>
                    <li>
                        <Link to="/personas" onClick={cerrarMenu}>
                            <span className="icon">👤</span> PERSONAS
                        </Link>
                    </li>
                    {/* EXPLORAR */}
                    <li className="menu-separador">EXPLORAR</li>
                    <li>
                        <Link to="/tags" onClick={cerrarMenu}>
                            <span className="icon">🏷️</span> TAGS
                        </Link>
                    </li>

                    {/* ARCHIVO HISTÓRICO */}
                    <li className="menu-separador">ARCHIVO POR AÑOS</li>
                    <div className="contenedor-scroll-anios">
                        {anios.length > 0 ? (
                            anios.map((anio) => (
                                <li key={anio}>
                                    <Link to={`/galeria/${anio}`} onClick={cerrarMenu}>
                                        <span className="icon">📂</span> Año {anio}
                                    </Link>
                                </li>
                            ))
                        ) : (
                            <li className="menu-loading">Sincronizando...</li>
                        )}
                    </div>

                    {/* SISTEMA */}
                    <li className="menu-separador">SISTEMA</li>
                    <li>
                        <Link to="/admin" onClick={cerrarMenu} className="link-admin">
                            <span className="icon">⚙️</span> GESTIÓN
                        </Link>
                    </li>
                    {/* Solo mostramos usuarios si es Admin (esto se puede refinar con el contexto de Auth) */}
                    {(usuario?.esAdmin || usuario?.esAdmin === 1) && (
                        <li>
                            <Link to="/usuarios" onClick={cerrarMenu}>
                                <span className="icon">👥</span> USUARIOS
                            </Link>
                        </li>
                    )}
                    <li>
                        <Link to="/papelera" onClick={cerrarMenu}>
                            <span className="icon">🗑️</span> PAPELERA
                        </Link>
                    </li>
                </ul>

                <div className="menu-footer">
                    <SelectorTema />
                    <p style={{marginTop: '15px'}}>Jose Moreno J.</p>
                    <span>v2.0.26 - DEMO</span>
                </div>
            </aside>

            {/* Overlay */}
            {isOpen && <div className="menu-overlay" onClick={cerrarMenu}></div>}
        </nav>
    );
};

export default Menu;
