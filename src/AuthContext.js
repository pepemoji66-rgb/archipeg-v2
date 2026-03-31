import React, { createContext, useContext, useState, useEffect } from 'react';
import { setToken } from './api';

const API = 'http://localhost:5001/api';
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [auth, setAuth] = useState({ usuario: null, token: null, esDemo: false, cargando: true });

    // CARGAR SESIÓN AL INICIAR
    useEffect(() => {
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

    return (
        <AuthContext.Provider value={{ ...auth, login, registro, entrarDemo, logout }}>
            {!auth.cargando && children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}
