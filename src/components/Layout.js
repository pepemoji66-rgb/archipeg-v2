import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Sidebar from './Sidebar';
import './sidebar.css';

const Layout = ({ children }) => {
    const navigate = useNavigate();

    return (
        <div className="app-layout">
            <Sidebar />
            <main className="app-main">
                {/* BARRA SUPERIOR GLOBAL DE NAVEGACIÓN */}
                <div className="app-top-bar">
                    <button className="top-bar-btn" onClick={() => navigate('/galeria-completa')}>🏠 INICIO</button>
                    <button className="top-bar-btn" onClick={() => navigate(-1)}>⬅ ATRÁS</button>
                    <div className="top-bar-spacer"></div>
                    <div className="top-bar-brand">ARCHIPEG SYSTEM</div>
                    <div className="top-bar-spacer"></div>
                    <button className="top-bar-btn" onClick={() => window.location.reload()}>🔄 REFRESCAR SISTEMA</button>
                </div>
                
                <div className="app-content-area" style={{ flex: 1, overflow: 'auto' }}>
                    {children}
                </div>
            </main>
        </div>
    );
};

export default Layout;
