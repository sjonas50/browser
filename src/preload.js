const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  ai: {
    query: (query, context) => ipcRenderer.invoke('ai:query', query, context),
    loadModel: (modelName) => ipcRenderer.invoke('ai:loadModel', modelName),
    getConfig: () => ipcRenderer.invoke('ai:getConfig')
  },
  storage: {
    get: (key) => ipcRenderer.invoke('storage:get', key),
    set: (key, value) => ipcRenderer.invoke('storage:set', key, value),
  },
  security: {
    checkUrl: (url) => ipcRenderer.invoke('security:checkUrl', url),
  },
  platform: {
    name: process.platform,
    version: process.versions.electron,
  }
});