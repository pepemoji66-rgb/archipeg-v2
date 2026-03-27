import React, { createContext, useContext, useState } from 'react';
import { setToken } from './api';

const API = 'http://localhost:5001/api';
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [auth, setAuth] = useState({ usuario: null, token: null, esDemo: false });

    function actualizarAuth(nuevoEstado) {
        setToken(nuevoEstado.token);
        setAuth(nuevoEstado);
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

    async function registro(email, password) {
        const res = await fetch(`${API}/auth/registro`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
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
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}
