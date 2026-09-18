import { contextBridge } from 'electron'

/* First preload script — deliberately minimal. The renderer still talks to
   the API over fetch (CSP-allowed); this only exposes safe process facts so
   future React islands can branch on platform without nodeIntegration. */
contextBridge.exposeInMainWorld('naeki', {
  platform: process.platform,
  electron: process.versions.electron ?? '',
})