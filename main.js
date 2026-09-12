const { app, BrowserWindow, shell } = require('electron');
const path = require('path');

function createWindow () {
  const win = new BrowserWindow({
    width: 1440,
    height: 940,
    minWidth: 1080,
    minHeight: 700,
    backgroundColor: '#101012',
    autoHideMenuBar: true,
    icon: path.join(__dirname, 'src', 'assets', 'icon.png'),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  // renderer is the shared src/ core — same files the PWA serves
  win.loadFile(path.join(__dirname, 'src', 'index.html'), { query: { v: '1.8.0' } });

  // open external links (maps, line, etc.) in the default browser
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});