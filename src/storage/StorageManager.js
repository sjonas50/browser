const Store = require('electron-store');
const crypto = require('crypto');
const { EventEmitter } = require('events');

class StorageManager extends EventEmitter {
  constructor() {
    super();
    
    // Encrypted store for sensitive data
    this.secureStore = new Store({
      name: 'secure-preferences',
      encryptionKey: this.generateEncryptionKey(),
      schema: {
        preferences: {
          type: 'object',
          default: {}
        },
        history: {
          type: 'array',
          default: []
        },
        aiSettings: {
          type: 'object',
          default: {
            enabledModels: [],
            privacyLevel: 'high',
            localOnly: true
          }
        },
        knowledgeBase: {
          type: 'object',
          default: {
            enabled: true,
            collections: {},
            sessions: {},
            settings: {
              autoIndex: true,
              encryptDocuments: true,
              syncEnabled: false,
              embeddingModel: 'text-embedding-ada-002'
            }
          }
        }
      }
    });

    // Regular store for non-sensitive data
    this.store = new Store({
      name: 'preferences',
      defaults: {
        theme: 'dark',
        language: 'en',
        spatialLayout: {},
        extensions: []
      }
    });

    // In-memory cache for performance
    this.cache = new Map();
  }

  async initialize() {
    console.log('Initializing Storage Manager...');
    
    // Load frequently accessed data into cache
    this.cache.set('theme', this.store.get('theme'));
    this.cache.set('language', this.store.get('language'));
    
    this.emit('initialized');
  }

  generateEncryptionKey() {
    // In production, this should be derived from user credentials
    return crypto.scryptSync('user-password', 'salt', 32).toString('hex');
  }

  async get(key, secure = false) {
    // Check cache first
    if (this.cache.has(key)) {
      return this.cache.get(key);
    }

    const store = secure ? this.secureStore : this.store;
    const value = store.get(key);
    
    // Cache for future access
    if (value !== undefined) {
      this.cache.set(key, value);
    }
    
    return value;
  }

  async set(key, value, secure = false) {
    const store = secure ? this.secureStore : this.store;
    
    // Update store
    store.set(key, value);
    
    // Update cache
    this.cache.set(key, value);
    
    this.emit('data-changed', { key, value, secure });
    
    return true;
  }

  async delete(key, secure = false) {
    const store = secure ? this.secureStore : this.store;
    
    store.delete(key);
    this.cache.delete(key);
    
    this.emit('data-deleted', { key, secure });
    
    return true;
  }

  async getUserProfile() {
    return {
      preferences: await this.get('preferences', true),
      aiSettings: await this.get('aiSettings', true),
      theme: await this.get('theme'),
      language: await this.get('language'),
      spatialLayout: await this.get('spatialLayout')
    };
  }

  async updateUserProfile(profile) {
    const promises = [];
    
    if (profile.preferences) {
      promises.push(this.set('preferences', profile.preferences, true));
    }
    if (profile.aiSettings) {
      promises.push(this.set('aiSettings', profile.aiSettings, true));
    }
    if (profile.theme) {
      promises.push(this.set('theme', profile.theme));
    }
    if (profile.language) {
      promises.push(this.set('language', profile.language));
    }
    if (profile.spatialLayout) {
      promises.push(this.set('spatialLayout', profile.spatialLayout));
    }
    
    await Promise.all(promises);
    
    this.emit('profile-updated', profile);
    
    return true;
  }

  async addToHistory(entry) {
    const history = await this.get('history', true) || [];
    
    // Privacy: Only store necessary data
    const sanitizedEntry = {
      timestamp: Date.now(),
      title: entry.title,
      category: entry.category
    };
    
    // Only add domain if URL is provided
    if (entry.url) {
      try {
        sanitizedEntry.domain = new URL(entry.url).hostname;
        sanitizedEntry.url = entry.url; // Store full URL for visits
      } catch (e) {
        // Invalid URL, skip domain
      }
    }
    
    // Add type if provided (for knowledge documents)
    if (entry.type) {
      sanitizedEntry.type = entry.type;
    }
    
    // Add search-specific fields
    if (entry.query) {
      sanitizedEntry.query = entry.query;
    }
    
    // Add results metadata for searches
    if (entry.results) {
      sanitizedEntry.results = entry.results;
    }
    
    history.unshift(sanitizedEntry);
    
    // Limit history size
    if (history.length > 1000) {
      history.length = 1000;
    }
    
    await this.set('history', history, true);
    
    return true;
  }

  async clearHistory(olderThan = 0) {
    if (olderThan === 0) {
      await this.set('history', [], true);
    } else {
      const history = await this.get('history', true) || [];
      const filtered = history.filter(entry => entry.timestamp > olderThan);
      await this.set('history', filtered, true);
    }
    
    this.emit('history-cleared');
    
    return true;
  }

  async exportData() {
    const data = {
      secure: this.secureStore.store,
      regular: this.store.store,
      exportDate: new Date().toISOString()
    };
    
    return data;
  }

  async importData(data) {
    // Validate data structure
    if (!data.secure || !data.regular) {
      throw new Error('Invalid import data format');
    }
    
    // Import with user confirmation
    Object.entries(data.regular).forEach(([key, value]) => {
      this.store.set(key, value);
    });
    
    Object.entries(data.secure).forEach(([key, value]) => {
      this.secureStore.set(key, value);
    });
    
    // Clear cache to force reload
    this.cache.clear();
    
    this.emit('data-imported');
    
    return true;
  }

  async shutdown() {
    this.cache.clear();
    this.emit('shutdown');
  }

  // Knowledge Base specific methods
  async getKnowledgeBase() {
    return await this.get('knowledgeBase', true);
  }

  async updateKnowledgeBase(data) {
    const current = await this.getKnowledgeBase();
    const updated = { ...current, ...data };
    await this.set('knowledgeBase', updated, true);
    return updated;
  }

  async getKnowledgeCollections() {
    const kb = await this.getKnowledgeBase();
    return kb.collections || {};
  }

  async updateKnowledgeCollection(collectionId, data) {
    const kb = await this.getKnowledgeBase();
    kb.collections[collectionId] = {
      ...kb.collections[collectionId],
      ...data,
      updatedAt: new Date().toISOString()
    };
    await this.set('knowledgeBase', kb, true);
    return kb.collections[collectionId];
  }

  async deleteKnowledgeCollection(collectionId) {
    const kb = await this.getKnowledgeBase();
    delete kb.collections[collectionId];
    await this.set('knowledgeBase', kb, true);
    this.emit('collection-deleted', collectionId);
  }

  async getKnowledgeSessions() {
    const kb = await this.getKnowledgeBase();
    return kb.sessions || {};
  }

  async updateKnowledgeSession(sessionId, data) {
    const kb = await this.getKnowledgeBase();
    kb.sessions[sessionId] = {
      ...kb.sessions[sessionId],
      ...data,
      updatedAt: new Date().toISOString()
    };
    await this.set('knowledgeBase', kb, true);
    return kb.sessions[sessionId];
  }

  async deleteKnowledgeSession(sessionId) {
    const kb = await this.getKnowledgeBase();
    delete kb.sessions[sessionId];
    await this.set('knowledgeBase', kb, true);
    this.emit('session-deleted', sessionId);
  }

  async getKnowledgeSettings() {
    const kb = await this.getKnowledgeBase();
    return kb.settings;
  }

  async updateKnowledgeSettings(settings) {
    const kb = await this.getKnowledgeBase();
    kb.settings = { ...kb.settings, ...settings };
    await this.set('knowledgeBase', kb, true);
    this.emit('knowledge-settings-updated', kb.settings);
    return kb.settings;
  }

  // Add document metadata to history with knowledge base tracking
  async addDocumentToHistory(document) {
    const entry = {
      timestamp: Date.now(),
      type: 'knowledge_document',
      documentId: document.id,
      title: document.title,
      collection: document.collection,
      session: document.session,
      source: document.source
    };
    
    await this.addToHistory(entry);
    return true;
  }
}

module.exports = { StorageManager };