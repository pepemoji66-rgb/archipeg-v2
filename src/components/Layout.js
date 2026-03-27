import React from 'react';
import Sidebar from './Sidebar';
import './sidebar.css';

const Layout = ({ children }) => (
    <div className="app-layout">
        <Sidebar />
        <main className="app-main">
            {children}
        </main>
    </div>
);

export default Layout;
