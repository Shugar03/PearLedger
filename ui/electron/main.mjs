import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  ensureHarnessReady,
  executeTool,
  listTools,
  onHarnessEvent
} from '../../dist/harness/ipc-bridge.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rendererDir = path.join(__dirname, '..', 'renderer')

let mainWindow = null

function sendHarnessEvent(payload) {
  mainWindow?.webContents.send('pear:event', payload)
}

async function initHarness() {
  await ensureHarnessReady()
  onHarnessEvent('tool:executing', (tool, params) => {
    sendHarnessEvent({ type: 'tool:executing', tool: tool.name, params })
  })
  onHarnessEvent('tool:done', (tool, result) => {
    sendHarnessEvent({ type: 'tool:done', tool: tool.name, result })
  })
  onHarnessEvent('tool:blocked', (tool, params) => {
    sendHarnessEvent({ type: 'tool:blocked', tool: tool.name, params })
  })
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 760,
    minWidth: 960,
    minHeight: 640,
    title: 'PearLedger',
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.loadFile(path.join(rendererDir, 'index.html'))
}

ipcMain.handle('pear:listTools', async () => {
  await ensureHarnessReady()
  return listTools().map((t) => ({
    name: t.name,
    plugin: t.plugin,
    description: t.description
  }))
})

ipcMain.handle('pear:execute', async (_event, name, params = {}) => {
  return executeTool(name, params)
})

ipcMain.handle('pear:pickPdf', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Seleccionar factura PDF',
    properties: ['openFile'],
    filters: [{ name: 'PDF', extensions: ['pdf'] }]
  })
  if (result.canceled || result.filePaths.length === 0) return null
  return result.filePaths[0]
})

app.whenReady().then(async () => {
  await initHarness()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
