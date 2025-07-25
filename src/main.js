const { app, BrowserWindow, session, ipcMain } = require('electron');
const path = require('path');
const { AIManager } = require('./ai/AIManager');
const { StorageManager } = require('./storage/StorageManager');
const { SecurityManager } = require('./security/SecurityManager');
const KnowledgeBaseManager = require('./ai/KnowledgeBaseManager');
const SearchService = require('./services/search-service');

let mainWindow;
let aiManager;
let storageManager;
let securityManager;
let knowledgeBaseManager;
let searchService;

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      webviewTag: true,
      sandbox: true
    },
    titleBarStyle: 'hiddenInset',
    frame: process.platform !== 'darwin',
    backgroundColor: '#1a1a1a'
  });

  // Initialize managers
  aiManager = new AIManager();
  storageManager = new StorageManager();
  securityManager = new SecurityManager();
  knowledgeBaseManager = new KnowledgeBaseManager(storageManager, aiManager.logger);
  searchService = new SearchService();

  // Initialize services
  await aiManager.initialize();
  await storageManager.initialize();
  await securityManager.initialize();
  await knowledgeBaseManager.initialize();
  
  // Connect knowledge base to AI manager
  aiManager.setKnowledgeBaseManager(knowledgeBaseManager);
  
  // Log available search providers
  const availableProviders = searchService.getAvailableProviders();
  console.log('[Main] Available search providers:', availableProviders);

  // Set up security policies
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    const decision = securityManager.analyzeRequest(details);
    callback(decision);
  });

  // Load the browser UI
  mainWindow.loadFile(path.join(__dirname, 'ui/index.html'));
  
  // Open DevTools in development mode
  if (process.env.NODE_ENV === 'development' || process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
  
  // Handle webview permission requests
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    // Deny dangerous permissions by default
    const deniedPermissions = ['media', 'geolocation', 'notifications', 'midiSysex', 'pointerLock', 'fullscreen'];
    if (deniedPermissions.includes(permission)) {
      callback(false);
    } else {
      callback(true);
    }
  });
  
  // Configure webview tag security
  app.on('web-contents-created', (event, contents) => {
    contents.on('will-attach-webview', (event, webPreferences, params) => {
      // Strip away preload scripts if unused or verify their path
      delete webPreferences.preload;
      delete webPreferences.preloadURL;
      
      // Force webview security settings
      webPreferences.contextIsolation = true;
      webPreferences.nodeIntegration = false;
      webPreferences.sandbox = true;
    });
  });
}

// IPC handlers for AI operations
ipcMain.handle('ai:query', async (event, query, context) => {
  return await aiManager.processQuery(query, context);
});

ipcMain.handle('ai:loadModel', async (event, modelName) => {
  return await aiManager.loadModel(modelName);
});

ipcMain.handle('ai:getConfig', async (event) => {
  return {
    apiKey: process.env.ANTHROPIC_API_KEY,
    model: aiManager.config.defaultModel,
    useClaudeAPI: aiManager.config.useClaudeAPI
  };
});

// IPC handlers for storage operations
ipcMain.handle('storage:get', async (event, key) => {
  return await storageManager.get(key);
});

ipcMain.handle('storage:set', async (event, key, value) => {
  return await storageManager.set(key, value);
});

// IPC handlers for security operations
ipcMain.handle('security:checkUrl', async (event, url) => {
  return await securityManager.checkUrl(url);
});

// IPC handlers for knowledge base operations
ipcMain.handle('kb:addDocument', async (event, content, metadata) => {
  // Convert ArrayBuffer to Buffer if needed
  if (metadata && metadata.buffer && metadata.buffer instanceof ArrayBuffer) {
    metadata.buffer = Buffer.from(metadata.buffer);
  }
  
  // Handle webpage parsing if needed
  if (metadata && metadata.isWebPage && metadata.url) {
    return await knowledgeBaseManager.addWebPage(metadata.url, content, metadata);
  }
  return await knowledgeBaseManager.addDocument(content, metadata);
});

ipcMain.handle('kb:search', async (event, query, options) => {
  return await knowledgeBaseManager.search(query, options);
});

ipcMain.handle('kb:getStats', async (event) => {
  return await knowledgeBaseManager.getStats();
});

ipcMain.handle('kb:createCollection', async (event, name, metadata) => {
  return await knowledgeBaseManager.createCollection(name, metadata);
});

ipcMain.handle('kb:updateSettings', async (event, settings) => {
  aiManager.updateKnowledgeSettings(settings);
  return true;
});

// IPC handlers for search operations
ipcMain.handle('search:query', async (event, query, options) => {
  try {
    return await searchService.search(query, options);
  } catch (error) {
    console.error('[Search IPC] Search failed:', error);
    return [];
  }
});

ipcMain.handle('search:getProviders', async (event) => {
  return searchService.getAvailableProviders();
});

ipcMain.handle('search:setProvider', async (event, provider) => {
  try {
    searchService.setProvider(provider);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// IPC handlers for history operations
ipcMain.handle('history:add', async (event, entry) => {
  return await storageManager.addToHistory(entry);
});

ipcMain.handle('history:get', async (event, options) => {
  const history = await storageManager.get('history', true) || [];
  
  if (options && options.type) {
    // Filter by type
    return history.filter(entry => entry.type === options.type);
  }
  
  if (options && options.limit) {
    // Limit results
    return history.slice(0, options.limit);
  }
  
  return history;
});

ipcMain.handle('history:clear', async (event, olderThan) => {
  return await storageManager.clearHistory(olderThan);
});

ipcMain.handle('history:search', async (event, query) => {
  const history = await storageManager.get('history', true) || [];
  const searchLower = query.toLowerCase();
  
  return history.filter(entry => 
    (entry.title && entry.title.toLowerCase().includes(searchLower)) ||
    (entry.query && entry.query.toLowerCase().includes(searchLower)) ||
    (entry.domain && entry.domain.toLowerCase().includes(searchLower))
  );
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Enhanced security settings
app.on('web-contents-created', (event, contents) => {
  contents.on('will-navigate', (event, navigationUrl) => {
    const parsedUrl = new URL(navigationUrl);
    if (!securityManager.isUrlSafe(parsedUrl)) {
      event.preventDefault();
    }
  });

  contents.on('new-window', (event, navigationUrl) => {
    event.preventDefault();
  });
});