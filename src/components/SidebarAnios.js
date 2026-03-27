/**
 * COMPONENTE: SidebarAnios.js
 * LÓGICA: Filtro cronológico y buscador de años
 */
import React from 'react';

const SidebarAnios = ({ busqueda, setBusqueda, setPaginaActual }) => {

    // Generamos los 57 años (1970 - 2027)
    const listaAnios = Array.from({ length: 57 }, (_, i) => 1970 + i).reverse();

    const seleccionarAnio = (anio) => {
        setBusqueda(anio);
        setPaginaActual(1);
    };

    return (
        <aside className="sidebar-anios">
            <h3 className="sidebar-titulo">Archivo Cronológico</h3>
            <button
                onClick={() => seleccionarAnio("")}
                className="btn-anio-todo"
            >
                ✨ VER TODO
            </button>
            <div className="lista-anios-scroll">
                {listaAnios.map(anio => (
                    <button
                        key={anio}
                        onClick={() => seleccionarAnio(anio.toString())}
                        className={`btn-anio-item ${busqueda === anio.toString() ? 'active' : ''}`}
                    >
                        {anio}
                    </button>
                ))}
            </div>
        </aside>
    );
};

export default SidebarAnios;