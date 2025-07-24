const { app, BrowserWindow, session, ipcMain } = require('electron');
const path = require('path');
const { AIManager } = require('./ai/AIManager');
const { StorageManager } = require('./storage/StorageManager');
const { SecurityManager } = require('./security/SecurityManager');

let mainWindow;
let aiManager;
let storageManager;
let securityManager;

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

  // Initialize services
  await aiManager.initialize();
  await storageManager.initialize();
  await securityManager.initialize();

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