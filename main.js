const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const path = require('path');
const { fork } = require('child_process');
const fs = require('fs');

// --- MENÚ EN ESPAÑOL PARA ARCHIPEG ---
const menuTemplate = [
    {
        label: 'Archivo',
        submenu: [
            { label: 'Salir', role: 'quit' }
        ]
    },
    {
        label: 'Edición',
        submenu: [
            { label: 'Deshacer', role: 'undo' },
            { label: 'Rehacer', role: 'redo' },
            { type: 'separator' },
            { label: 'Cortar', role: 'cut' },
            { label: 'Copiar', role: 'copy' },
            { label: 'Pegar', role: 'paste' },
            { label: 'Seleccionar todo', role: 'selectAll' }
        ]
    },
    {
        label: 'Vista',
        submenu: [
            { label: 'Recargar', role: 'reload' },
            { label: 'Forzar recarga', role: 'forceReload' },
            { label: 'Herramientas de desarrollo', role: 'toggleDevTools' },
            { type: 'separator' },
            { label: 'Aumentar zoom', role: 'zoomIn' },
            { label: 'Restablecer zoom', role: 'resetZoom' },
            { label: 'Reducir zoom', role: 'zoomOut' },
            { type: 'separator' },
            { label: 'Pantalla completa', role: 'togglefullscreen' }
        ]
    },
    {
        label: 'Ventana',
        submenu: [
            { label: 'Minimizar', role: 'minimize' },
            { label: 'Cerrar', role: 'close' }
        ]
    },
    {
        label: 'Ayuda',
        submenu: [
            {
                label: 'Acerca de ARCHIPEG',
                click: async () => {
                    dialog.showMessageBox({
                        title: 'Acerca de',
                        message: 'ARCHIPEG PRO V2.0',
                        detail: 'Copyright © 2026 - Jose Moreno Jimenez\nGestión Fotográfica Profesional'
                    });
                }
            }
        ]
    }
];

let serverProcess;

function createWindow() {
    const isDev = !app.isPackaged;
    let userDataStore;

    // Ubicación del motor (server.js) - Ahora siempre dentro del paquete
    const serverScript = path.join(__dirname, 'server.js');

    if (isDev) {
        userDataStore = __dirname;
    } else {
        const appPath = app.getPath('exe');
        const drive = appPath.substring(0, 3).toUpperCase();
        
        if (drive === 'C:\\') {
            userDataStore = path.join(app.getPath('documents'), 'ArchipegPro');
        } else {
            userDataStore = path.join(path.dirname(appPath), 'Archipeg_Storage');
        }
    }

    // Aseguramos que la carpeta de destino exista antes de arrancar el motor
    const fs = require('fs');
    if (!fs.existsSync(userDataStore)) {
        fs.mkdirSync(userDataStore, { recursive: true });
    }

    console.log("🚀 ARRANCANDO MOTOR ARCHIPEG...");
    console.log("📍 Script:", serverScript);
    console.log("💾 Datos en:", userDataStore);

    if (!fs.existsSync(serverScript)) {
        dialog.showErrorBox("Fallo de Inicio", `No se encontró el motor en: ${serverScript}`);
    }

    // Usamos el proceso de Electron para el fork si es posible, asegurando soporte ASAR
    serverProcess = fork(serverScript, [], {
        env: { 
            ...process.env, 
            ARCHIPEG_DATA_DIR: userDataStore,
            ELECTRON_RUN_AS_NODE: '1' 
        },
        stdio: ['inherit', 'inherit', 'pipe', 'ipc']
    });

    let errorMensaje = "";
    serverProcess.stderr.on('data', (data) => {
        errorMensaje += data.toString();
        console.error(`[MOTOR ERR] ${data}`);
    });

    serverProcess.on('error', (err) => {
        console.error('Fallo crítico en el motor ARCHIPEG:', err);
    });

    serverProcess.on('exit', (code) => {
        if (code !== 0 && code !== null) {
            const msg = errorMensaje || "Error desconocido en el proceso de fondo.";
            dialog.showErrorBox("Motor Detenido", `El motor se cerró (Código ${code}).\n\nDetalle del error:\n${msg}`);
        }
    });

    Menu.setApplicationMenu(Menu.buildFromTemplate(menuTemplate));
    const win = new BrowserWindow({
        width: 1300,
        height: 900,
        // Buscamos el logo en la carpeta public (ahora en PNG para que no falle)
        icon: path.join(__dirname, 'public/logo_archipeg_principal.png'),
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: true,
            contextIsolation: false,
            webSecurity: false
        }
    });

    // Cargamos el build de React
    const indexPath = path.join(__dirname, 'build', 'index.html');
    win.loadFile(indexPath);

    // Abrimos consola para cazar errores en vivo
    // win.webContents.openDevTools();

    win.on('closed', () => {
        if (serverProcess) serverProcess.kill();
    });
}

ipcMain.handle('seleccionar-carpeta', async () => {
    const result = await dialog.showOpenDialog({ properties: ['openDirectory'] });
    return result.canceled ? null : result.filePaths[0];
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (serverProcess) serverProcess.kill();
    if (process.platform !== 'darwin') app.quit();
});