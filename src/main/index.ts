import { app, BrowserWindow, shell } from 'electron'
import { existsSync } from 'node:fs'
import { createConnection } from 'node:net'
import { join } from 'node:path'
import { spawn } from 'node:child_process'

const API_HOST = 'http://127.0.0.1:8090'
const API_PORT = 8090

// start the API server (bundled as out/main/api.js from server/api.ts) on
// launch unless something already answers on :8090 — same contract the old
// PocketBase spawn had, so the renderer, CSP and e2e suites keep working.
function startAPI(): Promise<boolean> {
  return new Promise((resolve) => {
    const probe = createConnection({ host: '127.0.0.1', port: API_PORT })
    probe.once('connect', () => {
      probe.end()
      resolve(true) // already up
    })
    probe.once('error', () => {
      const api = join(__dirname, 'api.js')
      if (!existsSync(api)) {
        resolve(false)
        return
      }
      // ELECTRON_RUN_AS_NODE: run api.js as a plain Node script inside the
      // bundled Electron binary — no system Node needed on the packaged app.
      const child = spawn(process.execPath, [api], {
        stdio: 'ignore',
        detached: false,
        env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
      })
      child.once('error', () => resolve(false))
      const t0 = Date.now()
      const wait = setInterval(async () => {
        try {
          const r = await fetch(API_HOST + '/api/health')
          if (r.ok) {
            clearInterval(wait)
            resolve(true)
            return
          }
        } catch {
          // not up yet — keep polling
        }
        if (Date.now() - t0 > 8000) {
          clearInterval(wait)
          resolve(false)
        }
      }, 250)
    })
  })
}

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1440,
    height: 940,
    minWidth: 1080,
    minHeight: 700,
    backgroundColor: '#101012',
    autoHideMenuBar: true,
    icon: join(__dirname, '../../src/assets/icon.png'),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: join(__dirname, '../preload/index.js'),
    },
  })

  // electron-vite sets ELECTRON_RENDERER_URL in dev (Vite dev server, HMR);
  // packaged/dev-file builds load the bundled renderer.
  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'), {
      query: { v: process.env.npm_package_version || '' },
    })
  }

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) shell.openExternal(url)
    return { action: 'deny' }
  })
}

app.whenReady().then(async () => {
  await startAPI().then((ok) =>
    console.log(ok ? '[naeki-api] API up at ' + API_HOST : '[naeki-api] API NOT available'),
  )
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})