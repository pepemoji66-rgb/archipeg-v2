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