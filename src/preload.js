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
  knowledgeBase: {
    addDocument: (content, metadata) => ipcRenderer.invoke('kb:addDocument', content, metadata),
    search: (query, options) => ipcRenderer.invoke('kb:search', query, options),
    getStats: () => ipcRenderer.invoke('kb:getStats'),
    createCollection: (name, metadata) => ipcRenderer.invoke('kb:createCollection', name, metadata),
    updateSettings: (settings) => ipcRenderer.invoke('kb:updateSettings', settings),
  },
  search: {
    query: (query, options) => ipcRenderer.invoke('search:query', query, options),
    getProviders: () => ipcRenderer.invoke('search:getProviders'),
    setProvider: (provider) => ipcRenderer.invoke('search:setProvider', provider),
  },
  history: {
    add: (entry) => ipcRenderer.invoke('history:add', entry),
    get: (options) => ipcRenderer.invoke('history:get', options),
    clear: (olderThan) => ipcRenderer.invoke('history:clear', olderThan),
    search: (query) => ipcRenderer.invoke('history:search', query),
  },
  platform: {
    name: process.platform,
    version: process.versions.electron,
  }
});