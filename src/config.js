// src/config.js
// Si estamos en desarrollo (localhost), usamos el puerto 5001.
// En producción (Render), las peticiones son relativas al mismo dominio.
const isElectron = window.navigator.userAgent.includes('Electron');
const isDev = window.location.hostname === 'localhost' || isElectron;
export const API_BASE_URL = isDev ? 'http://localhost:5001' : 'https://archipeg-pro.onrender.com';
export const UPLOADS_URL = `${API_BASE_URL}/uploads/`;
export const FOTO_LOCAL_URL = `${API_BASE_URL}/api/foto-local?ruta=`;
