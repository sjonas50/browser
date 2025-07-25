/**
 * Knowledge Base UI Handler
 * Manages the knowledge base sidebar UI and interactions
 */

class KnowledgeBaseHandler {
    constructor(aiHandler) {
        this.aiHandler = aiHandler;
        
        // UI state
        this.isOpen = false;
        this.currentCollection = 'personal';
        this.currentMode = 'permanent'; // permanent or session
        this.useInSearch = true;
        this.searchMode = 'augment'; // augment, priority, only
        this.sessionId = this.generateSessionId();
        
        // Elements
        this.initializeElements();
        this.attachEventListeners();
        
        // Load initial data
        this.loadCollections();
        this.updateStats();
    }
    
    initializeElements() {
        // Sidebar
        this.sidebar = document.getElementById('knowledge-sidebar');
        this.toggleButton = document.getElementById('knowledge-toggle');
        
        // Controls
        this.useKnowledgeCheckbox = document.getElementById('use-knowledge-base');
        this.modeButtons = document.querySelectorAll('.mode-btn');
        this.collectionItems = document.querySelectorAll('.collection-item');
        
        // Search
        this.searchInput = document.getElementById('kb-search-input');
        this.searchButton = document.getElementById('kb-search-btn');
        
        // Lists
        this.collectionsList = document.getElementById('collections-list');
        this.documentsList = document.getElementById('recent-documents');
        
        // Dialog
        this.uploadDialog = document.getElementById('upload-dialog');
        this.fileInput = document.getElementById('file-input');
        this.textInputArea = document.getElementById('text-input-area');
        this.docTitleInput = document.getElementById('doc-title');
        this.docContentInput = document.getElementById('doc-content');
        this.targetCollectionSelect = document.getElementById('target-collection');
        
        // Stats
        this.totalDocsElement = document.getElementById('total-docs');
        this.storageUsedElement = document.getElementById('storage-used');
    }
    
    attachEventListeners() {
        // Toggle sidebar
        if (this.toggleButton) {
            this.toggleButton.addEventListener('click', () => this.toggleSidebar());
        }
        
        // Use knowledge base toggle
        if (this.useKnowledgeCheckbox) {
            this.useKnowledgeCheckbox.addEventListener('change', (e) => {
                this.useInSearch = e.target.checked;
                this.updateSearchSettings();
            });
        }
        
        // Search mode radio buttons
        document.querySelectorAll('input[name="kb-mode"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.searchMode = e.target.value;
                this.updateSearchSettings();
            });
        });
        
        // Storage mode buttons
        this.modeButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.setStorageMode(e.target.closest('.mode-btn').dataset.mode);
            });
        });
        
        // Collection selection
        this.collectionsList.addEventListener('click', (e) => {
            const item = e.target.closest('.collection-item');
            if (item) {
                this.selectCollection(item.dataset.collection);
            }
        });
        
        // Search
        if (this.searchButton) {
            this.searchButton.addEventListener('click', () => this.performSearch());
        }
        
        if (this.searchInput) {
            this.searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.performSearch();
                }
            });
        }
        
        // Add document button
        const addButton = document.getElementById('kb-add');
        if (addButton) {
            addButton.addEventListener('click', () => this.showUploadDialog());
        }
        
        // File input
        if (this.fileInput) {
            this.fileInput.addEventListener('change', (e) => this.handleFileUpload(e));
        }
        
        // Add collection button
        const addCollectionBtn = document.getElementById('add-collection');
        if (addCollectionBtn) {
            addCollectionBtn.addEventListener('click', () => this.createNewCollection());
        }
        
        // Settings button
        const settingsBtn = document.getElementById('kb-settings');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => this.showSettings());
        }
        
        // Close button
        const closeBtn = document.getElementById('kb-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.closeSidebar());
        }
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'K') {
                e.preventDefault();
                this.toggleSidebar();
            }
        });
    }
    
    toggleSidebar() {
        this.isOpen = !this.isOpen;
        this.sidebar.classList.toggle('collapsed');
        
        // Save state
        if (window.electronAPI && window.electronAPI.storage) {
            window.electronAPI.storage.set('knowledgeSidebarOpen', this.isOpen);
        }
        
        // Update documents list when opening
        if (this.isOpen) {
            this.loadRecentDocuments();
        }
    }
    
    closeSidebar() {
        this.isOpen = false;
        this.sidebar.classList.add('collapsed');
        
        // Save state
        if (window.electronAPI && window.electronAPI.storage) {
            window.electronAPI.storage.set('knowledgeSidebarOpen', false);
        }
    }
    
    setStorageMode(mode) {
        this.currentMode = mode;
        
        // Update UI
        this.modeButtons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === mode);
        });
        
        // Update description
        const description = document.getElementById('mode-description');
        if (description) {
            if (mode === 'session') {
                description.textContent = 'Documents are stored temporarily for this session only';
            } else {
                description.textContent = 'Documents are saved permanently in your knowledge base';
            }
        }
    }
    
    selectCollection(collectionId) {
        this.currentCollection = collectionId;
        
        // Update UI
        this.collectionItems.forEach(item => {
            item.classList.toggle('active', item.dataset.collection === collectionId);
        });
        
        // Load documents for this collection
        this.loadRecentDocuments();
    }
    
    async loadCollections() {
        try {
            const stats = await window.electronAPI.knowledgeBase.getStats();
            
            // Update collection counts
            if (stats && stats.collections) {
                Object.entries(stats.collections).forEach(([id, collection]) => {
                    const item = document.querySelector(`[data-collection="${id}"] .collection-count`);
                    if (item) {
                        item.textContent = collection.documents.toString();
                    }
                });
            }
            
            // TODO: Load custom collections
        } catch (error) {
            console.error('Failed to load collections:', error);
        }
    }
    
    async loadRecentDocuments() {
        try {
            // Get documents for current collection using search
            const searchOptions = {
                collections: [this.currentCollection],
                includeSession: false,
                limit: 10
            };
            
            // Search for all documents (empty query returns all)
            const results = await window.electronAPI.knowledgeBase.search('', searchOptions);
            
            if (!results || results.length === 0) {
                this.showEmptyState();
                return;
            }
            
            let html = '';
            results.forEach(result => {
                html += `
                    <div class="document-item" data-id="${result.documentId}">
                        <div class="document-title">${this.escapeHtml(result.title)}</div>
                        <div class="document-meta">
                            ${this.formatDate(result.timestamp)} • ${result.source}
                        </div>
                    </div>
                `;
            });
            
            this.documentsList.innerHTML = html;
            
            // Add click handlers
            this.documentsList.querySelectorAll('.document-item').forEach(item => {
                item.addEventListener('click', () => this.viewDocument(item.dataset.id));
            });
        } catch (error) {
            console.error('Failed to load documents:', error);
            this.showEmptyState();
        }
    }
    
    showEmptyState() {
        this.documentsList.innerHTML = `
            <div class="empty-state">
                <span class="empty-icon">📄</span>
                <p>No documents yet</p>
                <button class="action-btn" onclick="window.knowledgeBase.showUploadDialog()">
                    Add your first document
                </button>
            </div>
        `;
    }
    
    async performSearch() {
        const query = this.searchInput.value.trim();
        if (!query) return;
        
        try {
            // Perform search
            const results = await window.electronAPI.knowledgeBase.search(query, {
                collections: this.currentMode === 'permanent' ? [this.currentCollection] : [],
                includeSession: this.currentMode === 'session',
                sessionId: this.sessionId,
                limit: 20
            });
            
            // Display results
            this.displaySearchResults(results);
        } catch (error) {
            console.error('Knowledge base search failed:', error);
            this.showNotification('Search failed', 'error');
        }
    }
    
    displaySearchResults(results) {
        if (results.length === 0) {
            this.documentsList.innerHTML = `
                <div class="empty-state">
                    <span class="empty-icon">🔍</span>
                    <p>No results found</p>
                </div>
            `;
            return;
        }
        
        let html = '<div class="search-results">';
        results.forEach(result => {
            html += `
                <div class="document-item search-result" data-id="${result.documentId}">
                    <div class="document-title">${this.escapeHtml(result.title)}</div>
                    <div class="document-meta">
                        Score: ${(result.maxScore * 100).toFixed(0)}% • ${result.chunks.length} matches
                    </div>
                    <div class="document-preview">
                        ${this.getPreview(result.chunks[0].content)}
                    </div>
                </div>
            `;
        });
        html += '</div>';
        
        this.documentsList.innerHTML = html;
    }
    
    showUploadDialog() {
        this.uploadDialog.classList.remove('hidden');
    }
    
    hideUploadDialog() {
        this.uploadDialog.classList.add('hidden');
        this.textInputArea.classList.add('hidden');
        this.docTitleInput.value = '';
        this.docContentInput.value = '';
    }
    
    selectFiles() {
        this.fileInput.click();
    }
    
    async handleFileUpload(event) {
        const files = Array.from(event.target.files);
        if (files.length === 0) return;
        
        // Show progress
        this.showUploadProgress(files.length);
        
        let successCount = 0;
        for (const file of files) {
            try {
                const buffer = await this.readFileAsBuffer(file);
                const fileType = this.getFileType(file);
                
                const metadata = {
                    title: file.name,
                    source: 'upload',
                    collection: this.currentMode === 'permanent' ? this.currentCollection : null,
                    session: this.currentMode === 'session' ? this.sessionId : null,
                    type: fileType,
                    fileType: fileType,
                    buffer: buffer,
                    size: file.size
                };
                
                await window.electronAPI.knowledgeBase.addDocument(null, metadata);
                
                successCount++;
                this.updateUploadProgress(successCount, files.length);
                this.showNotification(`Added: ${file.name}`, 'success');
            } catch (error) {
                console.error('Failed to upload file:', error);
                this.showNotification(`Failed to add: ${file.name}`, 'error');
            }
        }
        
        this.hideUploadProgress();
        this.hideUploadDialog();
        this.loadRecentDocuments();
        this.updateStats();
        
        // Clear file input for next use
        event.target.value = '';
    }
    
    async addCurrentPage() {
        const webview = window.browser?.getActiveWebview();
        if (!webview) {
            this.showNotification('No active page to save', 'error');
            return;
        }
        
        try {
            const url = webview.getURL();
            const title = webview.getTitle();
            
            // Get full HTML content for better parsing
            const htmlContent = await webview.executeJavaScript('document.documentElement.outerHTML');
            
            const metadata = {
                title: title || 'Untitled Page',
                source: 'webpage',
                url: url,
                collection: this.currentMode === 'permanent' ? this.currentCollection : null,
                session: this.currentMode === 'session' ? this.sessionId : null,
                type: 'webpage'
            };
            
            // Use addWebPage method for better parsing
            await window.electronAPI.knowledgeBase.addDocument(htmlContent, {
                ...metadata,
                isWebPage: true
            });
            
            this.showNotification('Page saved to knowledge base', 'success');
            this.hideUploadDialog();
            this.loadRecentDocuments();
            this.updateStats();
        } catch (error) {
            console.error('Failed to save page:', error);
            this.showNotification('Failed to save page', 'error');
        }
    }
    
    showTextInput() {
        this.textInputArea.classList.remove('hidden');
        this.docTitleInput.focus();
    }
    
    cancelTextInput() {
        this.textInputArea.classList.add('hidden');
        this.docTitleInput.value = '';
        this.docContentInput.value = '';
    }
    
    async saveTextDocument() {
        const title = this.docTitleInput.value.trim();
        const content = this.docContentInput.value.trim();
        
        if (!title || !content) {
            this.showNotification('Please provide both title and content', 'error');
            return;
        }
        
        try {
            const metadata = {
                title,
                source: 'manual',
                collection: this.currentMode === 'permanent' ? this.targetCollectionSelect.value : null,
                session: this.currentMode === 'session' ? this.sessionId : null,
                type: 'text'
            };
            
            await window.electronAPI.knowledgeBase.addDocument(content, metadata);
            
            this.showNotification('Document saved', 'success');
            this.hideUploadDialog();
            this.loadRecentDocuments();
            this.updateStats();
        } catch (error) {
            console.error('Failed to save document:', error);
            this.showNotification('Failed to save document', 'error');
        }
    }
    
    async createNewCollection() {
        const name = prompt('Enter collection name:');
        if (!name) return;
        
        try {
            const icon = prompt('Enter an emoji icon (optional):') || '📁';
            await window.electronAPI.knowledgeBase.createCollection(name, { icon });
            
            // Reload collections
            await this.loadCollections();
            this.showNotification(`Created collection: ${name}`, 'success');
        } catch (error) {
            console.error('Failed to create collection:', error);
            this.showNotification(error.message, 'error');
        }
    }
    
    updateSearchSettings() {
        // Notify AI handler about knowledge base settings
        if (this.aiHandler) {
            this.aiHandler.setKnowledgeBaseSettings({
                enabled: this.useInSearch,
                mode: this.searchMode,
                currentCollection: this.currentCollection,
                sessionId: this.currentMode === 'session' ? this.sessionId : null
            });
        }
    }
    
    async updateStats() {
        try {
            const stats = await window.electronAPI.knowledgeBase.getStats();
            
            // Calculate total documents
            let totalDocs = 0;
            Object.values(stats.collections).forEach(collection => {
                totalDocs += collection.documents;
            });
            
            // Update UI
            if (this.totalDocsElement) {
                this.totalDocsElement.textContent = totalDocs.toString();
            }
            
            // TODO: Calculate actual storage used
            if (this.storageUsedElement) {
                this.storageUsedElement.textContent = '0 MB';
            }
        } catch (error) {
            console.error('Failed to update stats:', error);
        }
    }
    
    // Utility methods
    generateSessionId() {
        return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    formatDate(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;
        
        if (diff < 60000) return 'Just now';
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
        
        return date.toLocaleDateString();
    }
    
    getPreview(content, maxLength = 150) {
        const preview = content.substring(0, maxLength);
        return this.escapeHtml(preview) + (content.length > maxLength ? '...' : '');
    }
    
    readFileAsBuffer(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                // Keep as ArrayBuffer for IPC transfer
                // The main process will handle conversion if needed
                resolve(e.target.result);
            };
            reader.onerror = reject;
            reader.readAsArrayBuffer(file);
        });
    }
    
    showUploadProgress(totalFiles) {
        // Create progress element if it doesn't exist
        if (!this.progressElement) {
            this.progressElement = document.createElement('div');
            this.progressElement.className = 'upload-progress';
            this.progressElement.innerHTML = `
                <div class="progress-text">Uploading files...</div>
                <div class="progress-bar">
                    <div class="progress-fill"></div>
                </div>
                <div class="progress-status">0 / ${totalFiles} files</div>
            `;
            document.body.appendChild(this.progressElement);
        }
        
        this.progressElement.style.display = 'block';
    }
    
    updateUploadProgress(current, total) {
        if (this.progressElement) {
            const percent = (current / total) * 100;
            this.progressElement.querySelector('.progress-fill').style.width = `${percent}%`;
            this.progressElement.querySelector('.progress-status').textContent = `${current} / ${total} files`;
        }
    }
    
    hideUploadProgress() {
        if (this.progressElement) {
            this.progressElement.style.display = 'none';
        }
    }
    
    getFileType(file) {
        const extension = file.name.split('.').pop().toLowerCase();
        const typeMap = {
            'txt': 'text',
            'md': 'markdown',
            'html': 'html',
            'pdf': 'pdf',
            'json': 'json'
        };
        return typeMap[extension] || 'text';
    }
    
    showNotification(message, type = 'info') {
        // Use browser's notification system
        if (window.browser && window.browser.showNotification) {
            window.browser.showNotification(message, type);
        } else {
            console.log(`[${type}] ${message}`);
        }
    }
    
    showSettings() {
        // TODO: Implement settings dialog
        this.showNotification('Settings coming soon', 'info');
    }
    
    viewDocument(documentId) {
        // TODO: Implement document viewer
        this.showNotification('Document viewer coming soon', 'info');
    }
}

// Export for use in renderer
window.KnowledgeBaseHandler = KnowledgeBaseHandler;

// Make functions available globally for onclick handlers
window.knowledgeBase = {
    showUploadDialog: () => window.knowledgeBaseInstance?.showUploadDialog(),
    hideUploadDialog: () => window.knowledgeBaseInstance?.hideUploadDialog(),
    selectFiles: () => window.knowledgeBaseInstance?.selectFiles(),
    addCurrentPage: () => window.knowledgeBaseInstance?.addCurrentPage(),
    showTextInput: () => window.knowledgeBaseInstance?.showTextInput(),
    cancelTextInput: () => window.knowledgeBaseInstance?.cancelTextInput(),
    saveTextDocument: () => window.knowledgeBaseInstance?.saveTextDocument(),
    importKnowledge: () => window.knowledgeBaseInstance?.showNotification('Import feature coming soon', 'info')
};

export default KnowledgeBaseHandler;