// src/api.js
// Almacén simple del token en módulo compartido
let _token = null;

export function setToken(token) {
    _token = token;
}

export function apiFetch(url, options = {}) {
    const headers = { ...(options.headers || {}) };
    if (_token) {
        headers['Authorization'] = `Bearer ${_token}`;
    }
    return fetch(url, { ...options, headers });
}
