/**
 * Fachada `window.pear` para Electron.
 *
 * Implementa el mismo contrato que `ui/dashboard/src/lib/pear-web.ts` implementa
 * para el navegador (`PearBridge`, en `ui/dashboard/src/lib/types.ts`), de modo que un
 * único bundle React sirva a los dos hosts.
 *
 * Se expone antes de que corra una línea de React: `lib/bridge.ts` mira si
 * `window.pear` ya existe y, si no, construye la versión HTTP + SSE.
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
