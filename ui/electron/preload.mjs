/**
 * Fachada `window.pear` para Electron.
 *
 * Expone EXACTAMENTE la misma forma que `dashboard/web/pear-web.js` expone en
 * el navegador, de modo que un único `app.js` sirva a los dos hosts.
 */
import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('pear', {
  host: 'electron',
  listTools: () => ipcRenderer.invoke('pear:listTools'),
  execute: (name, params) => ipcRenderer.invoke('pear:execute', name, params),
  pickInvoice: () => ipcRenderer.invoke('pear:pickInvoice'),
  onEvent: (handler) => {
    const listener = (_event, payload) => handler(payload)
    ipcRenderer.on('pear:event', listener)
    return () => ipcRenderer.removeListener('pear:event', listener)
  }
})
