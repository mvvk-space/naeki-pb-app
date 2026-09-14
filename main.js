/// <reference path="./src/types.d.ts" />
const { app, BrowserWindow, shell } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const net = require('net');
const fs = require('fs');

const PB_HOST = 'http://127.0.0.1:8090';
// DEMO: project-local so the seeded DB is shared with the app. In production
// move this to app.getPath('userData') so uninstalls clean up.
const PB_DIR = path.join(__dirname, 'pb_data');

// start PocketBase on launch unless something already answers on :8090
function startPB() {
  return new Promise((resolve) => {
    const probe = net.createConnection({ host: '127.0.0.1', port: 8090 });
    probe.once('connect', () => { probe.end(); resolve(true); }); // already up
    probe.once('error', async () => {
      fs.mkdirSync(PB_DIR, { recursive: true });
      const bin = path.join(__dirname, 'pocketbase'); // bundled next to main.js
      if (!fs.existsSync(bin)) { resolve(false); return; }
      const pb = spawn(bin, ['serve', '--http=127.0.0.1:8090', '--dir=' + PB_DIR],
        { stdio: 'ignore', detached: false });
      pb.once('error', () => resolve(false));
      // wait for health (also covers the "already up" probe path)
      const t0 = Date.now();
      const wait = setInterval(async () => {
        try {
          const r = await fetch(PB_HOST + '/api/health');
          if (r.ok) { clearInterval(wait); resolve(true); return; }
        } catch {}
        if (Date.now() - t0 > 8000) { clearInterval(wait); resolve(false); }
      }, 250);
    });
  });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1440, height: 940, minWidth: 1080, minHeight: 700,
    backgroundColor: '#101012', autoHideMenuBar: true,
    icon: path.join(__dirname, 'src', 'assets', 'icon.png'),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false
    },
  });

  win.loadFile(path.join(__dirname, 'src', 'index.html'), { query: { v: '2.11.0-pb' } });

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(async () => {
  await startPB().then(ok =>
    console.log(ok ? '[naeki-pb] PocketBase up at ' + PB_HOST : '[naeki-pb] PocketBase NOT available'));
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
