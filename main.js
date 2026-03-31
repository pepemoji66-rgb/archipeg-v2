const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { fork } = require('child_process');

let serverProcess;

function createWindow() {
    // --- LÓGICA DE AUTO-ENCENDIDO DEL SERVIDOR ---
    const isDev = !app.isPackaged;

    // Si es el .exe instalado, el server.js se ha extraído a 'app.asar.unpacked'
    const serverScript = isDev
        ? path.join(__dirname, 'server.js')
        : path.join(process.resourcesPath, 'app.asar.unpacked', 'server.js');

    console.log("Arrancando motor en:", serverScript);

    // Asignamos una carpeta de documentos nativa para los datos del cliente
    const docPath = app.getPath('documents');
    const userDataStore = path.join(docPath, 'ArchipegPro');

    serverProcess = fork(serverScript, [], {
        env: { ...process.env, ARCHIPEG_DATA_DIR: userDataStore }
    });

    serverProcess.on('error', (err) => {
        console.error('Fallo crítico en el motor ARCHIPEG:', err);
    });

    const win = new BrowserWindow({
        width: 1300,
        height: 900,
        // Buscamos el logo en la carpeta public
        icon: path.join(__dirname, 'public/logo_archipeg.ico'),
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
    win.webContents.openDevTools();

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