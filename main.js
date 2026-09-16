/// <reference path="./src/types.d.ts" />
const { app, BrowserWindow, shell } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const net = require('net');

const API_HOST = 'http://127.0.0.1:8090';
const API_PORT = 8090;

// start the Neon-backed API server (server/api.mjs) on launch unless
// something already answers on :8090 — same contract the old PocketBase
// spawn had, so the renderer, CSP and e2e suites keep working.
function startAPI() {
  return new Promise((resolve) => {
    const probe = net.createConnection({ host: '127.0.0.1', port: API_PORT });
    probe.once('connect', () => { probe.end(); resolve(true); }); // already up
    probe.once('error', () => {
      const server = path.join(__dirname, 'server', 'api.mjs');
      if (!require('fs').existsSync(server)) { resolve(false); return; }
      // ELECTRON_RUN_AS_NODE: run api.mjs as a plain Node script inside the
      // bundled Electron binary — no system Node needed on the packaged app.
      const child = spawn(process.execPath, [server], {
        stdio: 'ignore', detached: false,
        env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
      });
      child.once('error', () => resolve(false));
      const t0 = Date.now();
      const wait = setInterval(async () => {
        try {
          const r = await fetch(API_HOST + '/api/health');
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

  win.loadFile(path.join(__dirname, 'src', 'index.html'), { query: { v: '2.12.0-neon' } });

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(async () => {
  await startAPI().then(ok =>
    console.log(ok ? '[naeki-api] API up at ' + API_HOST : '[naeki-api] API NOT available'));
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });