import React, { createContext, useContext, useState, useEffect } from 'react';
import { setToken } from './api';
import { API_BASE_URL } from './config';

const API = `${API_BASE_URL}/api`;
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [auth, setAuth] = useState({ usuario: null, token: null, esDemo: false, cargando: true });

    // CARGAR SESIÓN Y TEMA AL INICIAR
    useEffect(() => {
        // Cargar Tema
        const savedColor = localStorage.getItem('archipeg-theme');
        if (savedColor) {
            document.documentElement.style.setProperty('--acento-primario', savedColor);
            if (savedColor.startsWith('#')) {
                const r = parseInt(savedColor.slice(1, 3), 16);
                const g = parseInt(savedColor.slice(3, 5), 16);
                const b = parseInt(savedColor.slice(5, 7), 16);
                document.documentElement.style.setProperty('--acento-primario-ho', `rgba(${r}, ${g}, ${b}, 0.2)`);
            }
        }

        const sesionGuardada = localStorage.getItem('archipeg_auth');
        if (sesionGuardada) {
            try {
                const data = JSON.parse(sesionGuardada);
                setToken(data.token);
                setAuth({ ...data, esDemo: false, cargando: false });
            } catch (e) {
                setAuth(prev => ({ ...prev, cargando: false }));
            }
        } else {
            setAuth(prev => ({ ...prev, cargando: false }));
        }
    }, []);

    function actualizarAuth(nuevoEstado) {
        setToken(nuevoEstado.token);
        if (nuevoEstado.token) {
            localStorage.setItem('archipeg_auth', JSON.stringify(nuevoEstado));
        } else {
            localStorage.removeItem('archipeg_auth');
        }
        setAuth({ ...nuevoEstado, cargando: false });
    }

    async function login(email, password) {
        const res = await fetch(`${API}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error al iniciar sesión');
        actualizarAuth({ usuario: data.usuario, token: data.token, esDemo: false });
        return data.usuario;
    }

    async function registro(email, password, systemKey = null) {
        const res = await fetch(`${API}/auth/registro`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, systemKey })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error al registrarse');
        actualizarAuth({ usuario: data.usuario, token: data.token, esDemo: false });
        return data.usuario;
    }

    function entrarDemo() {
        actualizarAuth({ usuario: null, token: null, esDemo: true });
    }

    function logout() {
        actualizarAuth({ usuario: null, token: null, esDemo: false });
    }

    // NUEVO: Sincronizar el perfil con el servidor (ver si ya ha sido aprobado)
    async function refrescarPerfil() {
        if (!auth.token || auth.esDemo) return;
        try {
            const res = await fetch(`${API}/auth/perfil`, {
                headers: { 'Authorization': `Bearer ${auth.token}` }
            });
            if (res.ok) {
                const data = await res.json();
                // Si el estado de aprobación ha cambiado, actualizamos localmente
                if (data.usuario && data.usuario.aprobado !== auth.usuario?.aprobado) {
                    actualizarAuth({ ...auth, usuario: data.usuario });
                }
            }
        } catch (e) { console.error("Error al refrescar perfil:", e); }
    }

    return (
        <AuthContext.Provider value={{ ...auth, login, registro, entrarDemo, logout, refrescarPerfil }}>
            {!auth.cargando && children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}
