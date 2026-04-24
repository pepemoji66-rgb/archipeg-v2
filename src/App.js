import React from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './AuthContext';
import Layout from './components/Layout';
import Indice from './components/Indice';
import Galeria from './components/Galeria';
import AdminPanel from './components/AdminPanel';
import Papelera from './components/Papelera';
import VistaAnio from './components/VistaAnio';
import Albumes from './components/Albumes';
import AlbumDetalle from './components/AlbumDetalle';
import Eventos from './components/Eventos';
import Personas from './components/Personas';
import Favoritos from './components/Favoritos';
import './App.css';
import Duplicados from './components/Duplicados';
import Usuarios from './components/Usuarios';
import Mapa from './components/Mapa';
import Presentacion from './components/Presentacion';

const RutaAprobada = ({ children }) => {
    const { usuario } = useAuth();
    if (!usuario || (usuario && !usuario.aprobado && usuario.aprobado !== 1)) return <Navigate to="/galeria-completa" replace />;
    return children;
}

const RutaAdmin = ({ children }) => {
    const { usuario } = useAuth();
    if (!usuario?.esAdmin) return <Navigate to="/galeria-completa" replace />;
    return children;
}

function AppRoutes() {
    const { usuario, esDemo } = useAuth();
    const haySession = usuario !== null || esDemo;

    if (!haySession) {
        return (
            <Routes>
                <Route path="/" element={<Indice />} />
                <Route path="/presentacion" element={<Presentacion />} />
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        );
    }

    return (
        <Layout>
            <Routes>
                <Route path="/" element={<Indice />} />
                <Route path="/galeria" element={<Galeria />} />
                <Route path="/galeria-completa" element={<Galeria />} />
                <Route path="/anio/:anio" element={<VistaAnio />} />
                <Route path="/galeria/:anio" element={<VistaAnio />} />
                <Route path="/duplicados" element={<Duplicados />} />
                <Route path="/admin" element={<RutaAprobada><AdminPanel /></RutaAprobada>} />
                <Route path="/usuarios" element={<RutaAdmin><Usuarios /></RutaAdmin>} />
                <Route path="/papelera" element={<Papelera />} />
                <Route path="/albumes" element={<Albumes />} />
                <Route path="/albumes/:id" element={<AlbumDetalle />} />
                <Route path="/eventos" element={<Eventos />} />
                <Route path="/personas" element={<Personas />} />
                <Route path="/favoritos" element={<Favoritos />} />
                <Route path="/mapa" element={<Mapa />} />
                <Route path="/presentacion" element={<Presentacion />} />
            </Routes>
        </Layout>
    );
}

function App() {
    return (
        <AuthProvider>
            <Router>
                <AppRoutes />
            </Router>
        </AuthProvider>
    );
}

export default App;
