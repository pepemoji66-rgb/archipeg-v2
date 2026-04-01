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
import Tags from './components/Tags';
import './App.css';
import Duplicados from './components/Duplicados';
import Usuarios from './components/Usuarios';
import Mapa from './components/Mapa';

const withLayout = (Component) => (props) => (
    <Layout><Component {...props} /></Layout>
);

const GaleriaL = withLayout(Galeria);
const AdminL = withLayout(AdminPanel);
const PapeleraL = withLayout(Papelera);
const VistaAnioL = withLayout(VistaAnio);
const AlbumesL = withLayout(Albumes);
const AlbumDetalleL = withLayout(AlbumDetalle);
const EventosL = withLayout(Eventos);
const PersonasL = withLayout(Personas);
const FavoritosL = withLayout(Favoritos);
const TagsL = withLayout(Tags);
const DuplicadosL = withLayout(Duplicados);
const UsuariosL = withLayout(Usuarios);
const MapaL = withLayout(Mapa);

function RutaAdmin({ children }) {
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
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        );
    }

    return (
        <Routes>
            <Route path="/" element={<Indice />} />
            <Route path="/galeria" element={<GaleriaL />} />
            <Route path="/galeria-completa" element={<GaleriaL />} />
            <Route path="/anio/:anio" element={<VistaAnioL />} />
            <Route path="/galeria/:anio" element={<VistaAnioL />} />
            <Route path="/duplicados" element={<DuplicadosL />} />
            <Route path="/admin" element={<AdminL />} />
            <Route path="/usuarios" element={<RutaAdmin><UsuariosL /></RutaAdmin>} />
            <Route path="/papelera" element={<PapeleraL />} />
            <Route path="/albumes" element={<AlbumesL />} />
            <Route path="/albumes/:id" element={<AlbumDetalleL />} />
            <Route path="/eventos" element={<EventosL />} />
            <Route path="/personas" element={<PersonasL />} />
            <Route path="/favoritos" element={<FavoritosL />} />
            <Route path="/tags" element={<TagsL />} />
            <Route path="/mapa" element={<MapaL />} />
        </Routes>
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
