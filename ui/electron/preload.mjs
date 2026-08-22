import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('pear', {
  listTools: () => ipcRenderer.invoke('pear:listTools'),
  execute: (name, params) => ipcRenderer.invoke('pear:execute', name, params),
  pickPdf: () => ipcRenderer.invoke('pear:pickPdf'),
  onEvent: (handler) => {
    const listener = (_event, payload) => handler(payload)
    ipcRenderer.on('pear:event', listener)
    return () => ipcRenderer.removeListener('pear:event', listener)
  }
})
