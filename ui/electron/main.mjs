/**
 * Proceso principal de Electron.
 *
 * Es un host más del mismo dashboard: carga el bundle React que Vite dejó en
 * `dist/dashboard/web/` (el mismo que sirve el dev server) y expone la misma
 * fachada `window.pear`, pero sobre IPC en vez de fetch/SSE. Un solo renderer
 * para las dos superficies.
 *
 * La app React vive en `ui/dashboard/`; aquí no hay una línea de interfaz.
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
import { ensurePdfRasterized } from '../../dist/plugins/invoice-ops/image-input.js'
import { shutdownQvacRuntime } from '../../dist/plugins/invoice-ops/qvac-client.js'

const here = path.dirname(fileURLToPath(import.meta.url))
// Sale del bundle de Vite (`npm run ui:build`), no de `ui/`.
const rendererDir = path.join(here, '..', '..', 'dist', 'dashboard', 'web')

let mainWindow = null
const unsubscribers = []

function sendToRenderer(payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('pear:event', payload)
  }
}

async function initHarness() {
  sendToRenderer({ type: 'harness:loading', tool: 'boot', payload: { models: false } })
  await ensureHarnessReady()
  sendToRenderer({ type: 'harness:ready', tool: 'boot', payload: { models: true } })

  const relay = (type) => (tool, payload) =>
    sendToRenderer({ type, tool: tool?.name ?? String(tool), payload: safe(payload) })

  for (const event of ['tool:executing', 'tool:done', 'tool:blocked', 'tool:failed']) {
    unsubscribers.push(onHarnessEvent(event, relay(event)))
  }
}

/**
 * Descarta lo que no sobreviva a la serialización estructurada.
 *
 * Un `Error` se serializa como `{}` — sus campos no son enumerables —, así que
 * el motivo de un `tool:failed` llegaba vacío al renderer. Se extrae a mano,
 * igual que hace el hub SSE del dev server.
 */
function safe(value) {
  if (value instanceof Error) return { error: value.message }
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
    show: false,
    webPreferences: {
      preload: path.join(here, 'preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.loadFile(path.join(rendererDir, 'index.html'))
  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

ipcMain.handle('pear:listTools', async () => listTools())

ipcMain.handle('pear:execute', async (_event, name, params = {}) => {
  if (name === 'parse_invoice' && params && typeof params.filePath === 'string') {
    const rasterized = await ensurePdfRasterized(params.filePath)
    return executeTool(name, { ...params, filePath: rasterized })
  }
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
  process.env.PEARLEDGER_SERVICE_MODE = '1'
  createWindow()
  await initHarness()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('before-quit', (event) => {
  event.preventDefault()
  for (const off of unsubscribers.splice(0)) off()
  shutdownQvacRuntime({ force: true })
    .catch(() => undefined)
    .finally(() => app.exit(0))
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
