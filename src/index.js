import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App'; // Busca a App.js en la misma carpeta
import './index.css';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
);

// Registrar el Service Worker para PWA
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').then(registration => {
            console.log('SW registrado con éxito:', registration.scope);
        }).catch(err => {
            console.log('Fallo al registrar SW:', err);
        });
    });
}
