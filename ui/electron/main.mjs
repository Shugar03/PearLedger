/**
 * Proceso principal de Electron.
 *
 * Es un host más del mismo dashboard: sirve `dist/dashboard/web` y expone la
 * misma fachada `window.pear` que la versión web, pero sobre IPC en vez de
 * fetch/SSE. Un solo renderer para las dos superficies.
 */

import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  ensureHarnessReady,
  executeTool,
  listTools,
  onHarnessEvent
} from '../../dist/ipc/bridge.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const rendererDir = path.join(here, '..', '..', 'dist', 'dashboard', 'web')

let mainWindow = null
const unsubscribers = []

function sendToRenderer(payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('pear:event', payload)
  }
}

async function initHarness() {
  await ensureHarnessReady()

  // El objeto Tool lleva el handler (una función), que no es serializable por
  // IPC: solo se retransmite el nombre.
  const relay = (type) => (tool, payload) =>
    sendToRenderer({ type, tool: tool?.name ?? String(tool), payload: safe(payload) })

  for (const event of ['tool:executing', 'tool:done', 'tool:blocked', 'tool:failed']) {
    unsubscribers.push(onHarnessEvent(event, relay(event)))
  }
}

/** Descarta lo que no sobreviva a la serialización estructurada. */
function safe(value) {
  try {
    return JSON.parse(JSON.stringify(value ?? null))
  } catch {
    return String(value)
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 760,
    minWidth: 960,
    minHeight: 640,
    title: 'PearLedger',
    backgroundColor: '#0f1115',
    webPreferences: {
      preload: path.join(here, 'preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  mainWindow.loadFile(path.join(rendererDir, 'index.html'))
  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

ipcMain.handle('pear:listTools', async () => listTools())

ipcMain.handle('pear:execute', async (_event, name, params = {}) => {
  return executeTool(name, params)
})

ipcMain.handle('pear:pickInvoice', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Seleccionar factura',
    properties: ['openFile'],
    filters: [
      { name: 'Facturas', extensions: ['pdf', 'png', 'jpg', 'jpeg'] },
      { name: 'Todos', extensions: ['*'] }
    ]
  })
  return result.canceled || result.filePaths.length === 0 ? null : result.filePaths[0]
})

app.whenReady().then(async () => {
  await initHarness()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  for (const off of unsubscribers.splice(0)) off()
  if (process.platform !== 'darwin') app.quit()
})
