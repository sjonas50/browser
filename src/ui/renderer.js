// AI-Powered Browser Renderer Process
// Handles UI interactions and communication with main process

class BrowserRenderer {
    constructor() {
        this.tabs = new Map();
        this.activeTabId = null;
        this.commandBarVisible = false;
        this.aiResponseVisible = false;
        this.aiHandler = null;
        this.searchHandler = null;
        this.sidebarHandler = null;
        
        this.initializeElements();
        this.attachEventListeners();
        this.initializeAI();
        this.createNewTab();
    }
    
    async initializeAI() {
        try {
            // Load Claude AI handler module
            const script = document.createElement('script');
            script.type = 'module';
            script.textContent = `
                import ClaudeAIHandler from './claude-ai-handler.js';
                window.ClaudeAIHandler = ClaudeAIHandler;
                window.dispatchEvent(new Event('ai-handler-loaded'));
            `;
            document.head.appendChild(script);
            
            // Wait for AI handler to load
            await new Promise((resolve) => {
                window.addEventListener('ai-handler-loaded', resolve, { once: true });
            });
            
            // Initialize Claude AI
            this.aiHandler = new window.ClaudeAIHandler();
            await this.aiHandler.initialize();
            
            // Initialize AI browser assistant for true AI experience
            const AIBrowserAssistant = (await import('./ai-browser-assistant.js')).default;
            this.aiBrowserAssistant = new AIBrowserAssistant(this.aiHandler);
            
            // Keep search handler for URL detection
            const SearchHandler = (await import('./search-handler.js')).default;
            this.searchHandler = new SearchHandler(this.aiHandler);
            
            // Initialize AI Sidebar
            const AISidebarHandler = (await import('./ai-sidebar-handler.js')).default;
            this.sidebarHandler = new AISidebarHandler(this.aiHandler, this.aiBrowserAssistant);
            
            // The sidebar handler is already exposed through window.browser
            
            this.updateAIStatus('AI: Ready');
            console.log('AI initialized successfully');
        } catch (error) {
            console.error('Failed to initialize AI:', error);
            this.updateAIStatus('AI: Error');
            this.showNotification('Failed to initialize AI assistant', 'error');
        }
    }
    
    initializeElements() {
        // Helper function to safely get element
        const getElement = (id) => {
            const element = document.getElementById(id);
            if (!element) {
                console.warn(`Element not found: ${id}`);
            }
            return element;
        };
        
        // Navigation elements
        this.backBtn = getElement('back-btn');
        this.forwardBtn = getElement('forward-btn');
        this.reloadBtn = getElement('reload-btn');
        this.urlBar = getElement('url-bar');
        this.aiBtn = getElement('ai-assist-btn');
        
        // Tab elements
        this.tabsContainer = getElement('tabs-container');
        this.newTabBtn = getElement('new-tab-btn');
        this.webviewContainer = getElement('webview-container');
        
        // AI elements
        this.commandBar = getElement('ai-command-bar');
        this.commandInput = getElement('ai-input');
        this.aiResponse = getElement('ai-overlay');
        this.responseContent = getElement('ai-response-content');
        this.closeResponseBtn = getElement('close-ai-overlay');
        
        // Status elements - status bar doesn't have a status-text element
        this.statusBar = getElement('status-bar');
        this.statusText = null; // We'll create this dynamically if needed
        this.securityIndicator = getElement('security-indicator');
        this.privacyIndicator = getElement('privacy-indicator');
    }
    
    attachEventListeners() {
        // Navigation controls
        if (this.backBtn) this.backBtn.addEventListener('click', () => this.navigateBack());
        if (this.forwardBtn) this.forwardBtn.addEventListener('click', () => this.navigateForward());
        if (this.reloadBtn) this.reloadBtn.addEventListener('click', () => this.reload());
        if (this.urlBar) {
            this.urlBar.addEventListener('keypress', async (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    await this.navigate(this.urlBar.value);
                }
            });
        }
        
        // AI controls
        if (this.aiBtn) {
            this.aiBtn.addEventListener('click', () => this.showAIMenu());
        }
        if (this.commandInput) {
            this.commandInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.processAICommand();
            });
            this.commandInput.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') this.hideCommandBar();
            });
        }
        if (this.closeResponseBtn) this.closeResponseBtn.addEventListener('click', () => this.hideAIResponse());
        
        // Tab controls
        if (this.newTabBtn) this.newTabBtn.addEventListener('click', () => this.createNewTab());
        
        // Global keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                switch(e.key) {
                    case 't': e.preventDefault(); this.createNewTab(); break;
                    case 'w': e.preventDefault(); this.closeCurrentTab(); break;
                    case 'l': e.preventDefault(); this.urlBar.focus(); break;
                    case 'k': e.preventDefault(); this.toggleCommandBar(); break;
                    case 'r': e.preventDefault(); this.reload(); break;
                }
            }
        });
    }
    
    // Tab Management
    createNewTab(url = null) {
        // Use welcome page as default for new tabs
        if (!url) {
            // Use relative path that works in renderer process
            url = './welcome.html';
        }
        if (!this.tabsContainer || !this.webviewContainer) {
            console.error('Tab or webview container not found');
            return null;
        }
        
        const tabId = Date.now().toString();
        const tab = {
            id: tabId,
            title: 'New Tab',
            url: url,
            canGoBack: false,
            canGoForward: false
        };
        
        console.log('Creating new tab:', tabId, url);
        
        // Create tab element
        const tabElement = document.createElement('div');
        tabElement.className = 'tab';
        tabElement.dataset.tabId = tabId;
        tabElement.innerHTML = `
            <span class="tab-title">New Tab</span>
            <button class="tab-close" data-tab-id="${tabId}">×</button>
        `;
        
        // Create webview
        const webview = document.createElement('webview');
        webview.className = 'browser-view';
        webview.dataset.tabId = tabId;
        webview.setAttribute('src', url);
        webview.setAttribute('nodeintegration', 'false');
        webview.setAttribute('webpreferences', 'contextIsolation=true');
        webview.setAttribute('partition', `persist:tab-${tabId}`);
        
        // Allow loading local files for welcome page
        if (url && url.includes('welcome.html')) {
            webview.setAttribute('allowpopups', 'true');
        }
        
        // Make webview visible by default
        webview.style.width = '100%';
        webview.style.height = '100%';
        
        // Add event listeners
        tabElement.addEventListener('click', () => this.switchToTab(tabId));
        tabElement.querySelector('.tab-close').addEventListener('click', (e) => {
            e.stopPropagation();
            this.closeTab(tabId);
        });
        
        // Webview events
        webview.addEventListener('did-start-loading', () => this.onLoadStart(tabId));
        webview.addEventListener('did-stop-loading', () => this.onLoadStop(tabId));
        webview.addEventListener('did-fail-load', (e) => this.onLoadError(tabId, e));
        webview.addEventListener('page-title-updated', (e) => this.updateTabTitle(tabId, e.title));
        webview.addEventListener('did-navigate', (e) => this.onNavigate(tabId, e.url));
        webview.addEventListener('new-window', (e) => this.handleNewWindow(e));
        
        // Intercept navigation to handle special URLs
        webview.addEventListener('will-navigate', (e) => {
            if (e.url === 'browser://newtab-search') {
                e.preventDefault();
                // Create new tab with search page
                this.createNewTab('./search.html');
            } else if (e.url.startsWith('search://')) {
                e.preventDefault();
                // Extract the search query
                const query = decodeURIComponent(e.url.substring('search://'.length));
                // Navigate to perform the search
                this.navigate(query);
            }
        });
        
        // Store tab data
        this.tabs.set(tabId, tab);
        
        // Add to DOM
        if (this.newTabBtn && this.newTabBtn.parentNode === this.tabsContainer) {
            this.tabsContainer.insertBefore(tabElement, this.newTabBtn);
        } else {
            this.tabsContainer.appendChild(tabElement);
        }
        this.webviewContainer.appendChild(webview);
        
        console.log('Tab created, switching to it');
        
        // Switch to new tab
        this.switchToTab(tabId);
        
        // Notify sidebar of page change
        if (this.sidebarHandler) {
            this.sidebarHandler.onPageChange();
        }
        
        return tabId;
    }
    
    switchToTab(tabId) {
        // Hide all webviews and deactivate tabs
        this.tabs.forEach((tab, id) => {
            const tabElement = document.querySelector(`[data-tab-id="${id}"]`);
            const webview = this.webviewContainer.querySelector(`webview[data-tab-id="${id}"]`);
            
            if (tabElement) tabElement.classList.remove('active');
            if (webview) webview.style.display = 'none';
        });
        
        // Show selected webview and activate tab
        const tabElement = document.querySelector(`[data-tab-id="${tabId}"]`);
        const webview = this.webviewContainer.querySelector(`webview[data-tab-id="${tabId}"]`);
        
        if (tabElement) tabElement.classList.add('active');
        if (webview) {
            webview.style.display = 'flex';
            const tab = this.tabs.get(tabId);
            if (tab) {
                // Show empty URL bar for welcome page and about:blank
                if (tab.url === 'about:blank' || tab.url.includes('welcome.html')) {
                    this.urlBar.value = '';
                } else {
                    this.urlBar.value = tab.url;
                }
                this.updateNavigationButtons(tab);
            }
        }
        
        this.activeTabId = tabId;
        
        // Notify sidebar of page change
        if (this.sidebarHandler) {
            this.sidebarHandler.onPageChange();
        }
    }
    
    closeTab(tabId) {
        if (this.tabs.size === 1) {
            // Don't close the last tab, just navigate to welcome page
            this.navigate('./welcome.html');
            return;
        }
        
        // Remove tab and webview
        const tabElement = document.querySelector(`[data-tab-id="${tabId}"]`);
        const webview = this.webviewContainer.querySelector(`webview[data-tab-id="${tabId}"]`);
        
        if (tabElement) tabElement.remove();
        if (webview) webview.remove();
        
        this.tabs.delete(tabId);
        
        // Switch to another tab if this was active
        if (this.activeTabId === tabId) {
            const remainingTabs = Array.from(this.tabs.keys());
            if (remainingTabs.length > 0) {
                this.switchToTab(remainingTabs[remainingTabs.length - 1]);
            }
        }
    }
    
    closeCurrentTab() {
        if (this.activeTabId) {
            this.closeTab(this.activeTabId);
        }
    }
    
    updateTabTitle(tabId, title) {
        const tab = this.tabs.get(tabId);
        if (tab) {
            tab.title = title || 'New Tab';
            const tabElement = document.querySelector(`[data-tab-id="${tabId}"] .tab-title`);
            if (tabElement) {
                tabElement.textContent = tab.title;
                tabElement.title = tab.title;
            }
        }
    }
    
    // Navigation
    async navigate(url) {
        console.log('Navigate called with:', url);
        if (!url) return;
        
        const webview = this.getActiveWebview();
        if (!webview) {
            console.error('No active webview found');
            return;
        }
        
        // Process URL
        let processedUrl = url.trim();
        
        // Check if AI search is enabled and this is a search query
        console.log('Search handler:', this.searchHandler);
        console.log('Is search query:', this.searchHandler ? this.searchHandler.isSearchQuery(processedUrl) : 'No handler');
        
        if (this.searchHandler && this.searchHandler.isSearchQuery(processedUrl)) {
            console.log('Performing AI search for:', processedUrl);
            // Show loading state
            this.updateStatus('AI is searching...');
            
            // Create progress display
            let progressHTML = '<div class="ai-search-progress">';
            progressHTML += '<h3>🤖 AI Search Progress</h3>';
            progressHTML += '<div class="progress-steps"></div>';
            progressHTML += '</div>';
            this.showAIResponse(progressHTML, 'info');
            
            // Progress callback to update UI
            const updateProgress = (step, detail) => {
                const stepsContainer = this.responseContent.querySelector('.progress-steps');
                if (stepsContainer) {
                    const stepElement = document.createElement('div');
                    stepElement.className = 'progress-step';
                    stepElement.innerHTML = `
                        <span class="step-time">${new Date().toLocaleTimeString()}</span>
                        <span class="step-detail">${detail}</span>
                    `;
                    stepsContainer.appendChild(stepElement);
                    
                    // Auto-scroll to bottom
                    stepsContainer.scrollTop = stepsContainer.scrollHeight;
                }
            };
            
            try {
                // Perform true AI-powered deep search
                const searchData = await this.aiBrowserAssistant.performDeepSearch(processedUrl, updateProgress);
                
                // Display comprehensive results
                this.displayDeepSearchResults(searchData);
                
                // Don't navigate away - keep the AI results visible
                this.updateStatus('AI search completed');
                
                // Update URL bar to show we performed an AI search
                this.urlBar.value = `ai://search/${encodeURIComponent(processedUrl)}`;
                
            } catch (error) {
                console.error('AI deep search failed:', error);
                // Fallback to showing error in AI response
                this.showAIResponse(`
                    <div class="ai-error">
                        <h3>❌ Search Failed</h3>
                        <p>${error.message}</p>
                        <p>Would you like to perform a regular web search instead?</p>
                        <button onclick="window.browser.performRegularSearch('${processedUrl.replace(/'/g, "\\'")}')">
                            Search on Google
                        </button>
                    </div>
                `, 'error');
            }
        } else {
            // Regular URL navigation
            if (!processedUrl.startsWith('http://') && !processedUrl.startsWith('https://') && 
                !processedUrl.startsWith('about:') && !processedUrl.startsWith('./') && 
                !processedUrl.startsWith('file://')) {
                // It's a domain without protocol
                processedUrl = 'https://' + processedUrl;
            }
            
            // Skip security check for local files
            if (processedUrl.startsWith('./') || processedUrl.startsWith('file://') || processedUrl.includes('welcome.html')) {
                webview.loadURL(processedUrl);
                // Don't show local file paths in URL bar
                if (processedUrl.includes('welcome.html')) {
                    this.urlBar.value = '';
                } else {
                    this.urlBar.value = processedUrl;
                }
            } else {
                // Check security before navigation
                const result = await window.electronAPI.security.checkUrl(processedUrl);
                console.log('[Navigate] Security check result:', result);
                
                if (result.error) {
                    this.showNotification(`Invalid URL: ${result.error}`, 'error');
                } else if (result.recommendation === 'allow' || result.riskScore < 0.5) {
                    webview.loadURL(processedUrl);
                    this.urlBar.value = processedUrl;
                
                // Show security status
                if (!result.checks.isSecure) {
                    this.showNotification('⚠️ This site is not using HTTPS', 'warning');
                }
            } else {
                // Show detailed reason for blocking
                let blockReason = 'Security risk detected';
                if (result.checks.isMalicious) blockReason = 'Malicious site detected';
                else if (result.checks.isTracker) blockReason = 'Tracker detected';
                else if (result.checks.isAd) blockReason = 'Advertisement site';
                else if (result.riskScore > 0.5) blockReason = `High risk score: ${(result.riskScore * 100).toFixed(0)}%`;
                
                this.showNotification(`🛡️ Blocked: ${blockReason}`, 'error');
            }
            }
        }
    }
    
    // Display deep AI search results
    displayDeepSearchResults(searchData) {
        let htmlContent = '<div class="ai-deep-search-results">';
        
        // Header with query understanding
        htmlContent += `
            <div class="search-header">
                <h2>🤖 AI Deep Search: "${searchData.query}"</h2>
                <div class="query-analysis">
                    <span class="query-type">Type: ${searchData.queryAnalysis.type.replace(/_/g, ' ')}</span>
                    <span class="query-depth">Depth: ${searchData.queryAnalysis.depth_required.replace(/_/g, ' ')}</span>
                </div>
            </div>
        `;
        
        // Main answer section
        htmlContent += `
            <div class="deep-answer-section">
                <h3>📚 Comprehensive Answer</h3>
                <div class="deep-answer-content">
                    ${this.formatAIAnswer(searchData.deepAnswer)}
                </div>
            </div>
        `;
        
        // Sources section
        if (searchData.sources && searchData.sources.length > 0) {
            htmlContent += `
                <div class="sources-section">
                    <h3>📍 Sources Analyzed (${searchData.sources.length})</h3>
                    <div class="sources-list">
            `;
            
            searchData.sources.forEach((source, index) => {
                htmlContent += `
                    <div class="source-item">
                        <div class="source-header">
                            <span class="source-number">${index + 1}</span>
                            <span class="source-title">${source.title}</span>
                        </div>
                        <div class="source-analysis">${source.analysis}</div>
                        <a href="#" onclick="window.browser.navigateToUrl('${source.url}'); return false;" class="source-link">
                            Visit source →
                        </a>
                    </div>
                `;
            });
            
            htmlContent += '</div></div>';
        }
        
        // Follow-up suggestions
        if (searchData.suggestions && searchData.suggestions.length > 0) {
            htmlContent += `
                <div class="suggestions-section">
                    <h3>💡 Explore Further</h3>
                    <div class="suggestion-chips">
            `;
            
            searchData.suggestions.forEach(suggestion => {
                htmlContent += `
                    <button class="suggestion-chip" onclick="window.browser.navigate('${suggestion.replace(/'/g, "\\'")}')">
                        ${suggestion}
                    </button>
                `;
            });
            
            htmlContent += '</div></div>';
        }
        
        // Visual insights
        if (searchData.visualData) {
            htmlContent += `
                <div class="insights-section">
                    <h3>📊 Search Insights</h3>
                    <div class="insights-grid">
                        <div class="insight-item">
                            <span class="insight-label">Sources Analyzed</span>
                            <span class="insight-value">${searchData.visualData.sourceCount}</span>
                        </div>
                        <div class="insight-item">
                            <span class="insight-label">Topics Covered</span>
                            <span class="insight-value">${searchData.queryAnalysis.topics.length}</span>
                        </div>
                        <div class="insight-item">
                            <span class="insight-label">Analysis Time</span>
                            <span class="insight-value">${new Date().toLocaleTimeString()}</span>
                        </div>
                    </div>
                </div>
            `;
        }
        
        htmlContent += '</div>';
        
        this.showAIResponse(htmlContent, 'deep-search');
    }
    
    // Format AI answer with proper markdown and structure
    formatAIAnswer(answer) {
        // Convert markdown-style formatting to HTML
        return answer
            .replace(/^### (.+)$/gm, '<h4>$1</h4>')
            .replace(/^## (.+)$/gm, '<h3>$1</h3>')
            .replace(/^# (.+)$/gm, '<h2>$1</h2>')
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.+?)\*/g, '<em>$1</em>')
            .replace(/^- (.+)$/gm, '<li>$1</li>')
            .replace(/^(\d+)\. (.+)$/gm, '<li>$2</li>')
            .replace(/\n\n/g, '</p><p>')
            .replace(/^<li>/gm, '<ul><li>')
            .replace(/<\/li>\n(?!<li>)/g, '</li></ul>')
            .replace(/^(?!<[hpul])/gm, '<p>')
            .replace(/(?<![>])\n$/gm, '</p>');
    }
    
    // Helper method for regular search fallback
    performRegularSearch(query) {
        const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
        const webview = this.getActiveWebview();
        if (webview) {
            webview.loadURL(searchUrl);
            this.urlBar.value = searchUrl;
            this.hideAIResponse();
        }
    }
    
    // Navigate to a specific URL
    navigateToUrl(url) {
        const webview = this.getActiveWebview();
        if (webview) {
            webview.loadURL(url);
            this.urlBar.value = url;
            this.hideAIResponse();
        }
    }
    
    // Display AI search results (keeping old method for compatibility)
    displaySearchResults(sections, searchUrl) {
        let htmlContent = '<div class="ai-search-results">';
        
        sections.forEach(section => {
            if (section.type === 'thought-process') {
                htmlContent += `
                    <div class="search-section thought-process">
                        <h3>${section.title}</h3>
                        <div class="thought-steps">
                `;
                section.steps.forEach((step, index) => {
                    htmlContent += `
                        <div class="thought-step">
                            <span class="step-number">${index + 1}</span>
                            <span class="step-name">${step.step}:</span>
                            <span class="step-content">${step.content}</span>
                        </div>
                    `;
                });
                htmlContent += '</div></div>';
            } else if (section.type === 'ai-answer') {
                htmlContent += `
                    <div class="search-section ai-answer">
                        <h3>${section.title}</h3>
                        <p>${section.content}</p>
                    </div>
                `;
            } else if (section.type === 'web-results') {
                htmlContent += `
                    <div class="search-section web-results">
                        <h3>${section.title}</h3>
                        <ul>
                `;
                section.results.forEach(result => {
                    htmlContent += `
                        <li>
                            <a href="${result.url}" target="_blank">${result.title}</a>
                            <p>${result.snippet}</p>
                        </li>
                    `;
                });
                htmlContent += '</ul></div>';
            } else if (section.type === 'search-more') {
                htmlContent += `
                    <div class="search-section search-more">
                        <a href="${section.url}" class="search-more-link">${section.content} →</a>
                    </div>
                `;
            } else if (section.type === 'error') {
                htmlContent += `
                    <div class="search-section error">
                        <p>${section.content}</p>
                        <a href="${section.url}" class="error-link">Search manually →</a>
                    </div>
                `;
            }
        });
        
        htmlContent += '</div>';
        
        this.responseContent.innerHTML = htmlContent;
        this.aiResponse.classList.add('visible');
        this.aiResponseVisible = true;
        
        // Add click handlers for links
        this.responseContent.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const url = link.getAttribute('href');
                if (url) {
                    this.navigate(url);
                    this.hideAIResponse();
                }
            });
        });
    }
    
    navigateBack() {
        const webview = this.getActiveWebview();
        if (webview && webview.canGoBack()) {
            webview.goBack();
        }
    }
    
    navigateForward() {
        const webview = this.getActiveWebview();
        if (webview && webview.canGoForward()) {
            webview.goForward();
        }
    }
    
    reload() {
        const webview = this.getActiveWebview();
        if (webview) {
            webview.reload();
        }
    }
    
    // AI Integration
    showAIMenu() {
        const menuHTML = `
            <div class="ai-menu">
                <h3>🤖 AI Assistant</h3>
                <div class="ai-menu-options">
                    <button class="ai-menu-item" onclick="window.browser.toggleAISidebar()">
                        <span class="ai-menu-icon">💬</span>
                        <div class="ai-menu-text">
                            <strong>Toggle AI Sidebar</strong>
                            <small>Open/close the AI assistant sidebar</small>
                        </div>
                    </button>
                    <button class="ai-menu-item" onclick="window.browser.analyzeCurrentPage()">
                        <span class="ai-menu-icon">📄</span>
                        <div class="ai-menu-text">
                            <strong>Analyze This Page</strong>
                            <small>Get AI insights about the current page</small>
                        </div>
                    </button>
                    <button class="ai-menu-item" onclick="window.browser.showCommandBar()">
                        <span class="ai-menu-icon">💬</span>
                        <div class="ai-menu-text">
                            <strong>Ask About Page</strong>
                            <small>Ask questions about current content</small>
                        </div>
                    </button>
                    <button class="ai-menu-item" onclick="window.browser.summarizePage()">
                        <span class="ai-menu-icon">📝</span>
                        <div class="ai-menu-text">
                            <strong>Summarize Page</strong>
                            <small>Get a quick summary of the content</small>
                        </div>
                    </button>
                    <button class="ai-menu-item" onclick="window.browser.extractKeyPoints()">
                        <span class="ai-menu-icon">🔑</span>
                        <div class="ai-menu-text">
                            <strong>Extract Key Points</strong>
                            <small>Find the main takeaways</small>
                        </div>
                    </button>
                </div>
            </div>
        `;
        
        this.showAIResponse(menuHTML, 'menu');
    }
    
    async analyzeCurrentPage() {
        const webview = this.getActiveWebview();
        if (!webview) {
            this.showNotification('No page to analyze', 'error');
            return;
        }
        
        this.showAIResponse('🔍 Analyzing current page...', 'info');
        
        try {
            const analysis = await this.aiBrowserAssistant.assistWithCurrentPage(webview);
            this.showAIResponse(`
                <div class="page-analysis">
                    <h3>📊 Page Analysis</h3>
                    <div class="analysis-content">
                        ${this.formatAIAnswer(analysis)}
                    </div>
                    <button onclick="window.browser.hideAIResponse()" class="close-analysis">Close</button>
                </div>
            `, 'analysis');
        } catch (error) {
            this.showAIResponse(`❌ Analysis failed: ${error.message}`, 'error');
        }
    }
    
    async summarizePage() {
        const webview = this.getActiveWebview();
        if (!webview) {
            this.showNotification('No page to summarize', 'error');
            return;
        }
        
        this.showAIResponse('📝 Creating summary...', 'info');
        
        try {
            const url = webview.getURL();
            const title = webview.getTitle();
            const content = await webview.executeJavaScript(`document.body.innerText.substring(0, 10000)`);
            
            const summary = await this.aiHandler.processQuery(
                `Provide a concise summary of this webpage:\nTitle: ${title}\nURL: ${url}\n\nContent: ${content}\n\nSummarize the main points in 3-5 bullet points.`,
                { isSummary: true }
            );
            
            this.showAIResponse(`
                <div class="page-summary">
                    <h3>📝 Page Summary</h3>
                    <h4>${title}</h4>
                    <div class="summary-content">
                        ${this.formatAIAnswer(summary)}
                    </div>
                    <button onclick="window.browser.hideAIResponse()" class="close-analysis">Close</button>
                </div>
            `, 'summary');
        } catch (error) {
            this.showAIResponse(`❌ Summary failed: ${error.message}`, 'error');
        }
    }
    
    async extractKeyPoints() {
        const webview = this.getActiveWebview();
        if (!webview) {
            this.showNotification('No page to analyze', 'error');
            return;
        }
        
        this.showAIResponse('🔑 Extracting key points...', 'info');
        
        try {
            const content = await webview.executeJavaScript(`document.body.innerText.substring(0, 10000)`);
            
            const keyPoints = await this.aiHandler.processQuery(
                `Extract the most important key points from this content. Focus on actionable insights, important facts, and main conclusions.\n\nContent: ${content}\n\nProvide the key points as a numbered list.`,
                { isExtraction: true }
            );
            
            this.showAIResponse(`
                <div class="key-points">
                    <h3>🔑 Key Points</h3>
                    <div class="points-content">
                        ${this.formatAIAnswer(keyPoints)}
                    </div>
                    <button onclick="window.browser.hideAIResponse()" class="close-analysis">Close</button>
                </div>
            `, 'keypoints');
        } catch (error) {
            this.showAIResponse(`❌ Extraction failed: ${error.message}`, 'error');
        }
    }
    
    toggleCommandBar() {
        if (this.commandBarVisible) {
            this.hideCommandBar();
        } else {
            this.showCommandBar();
        }
    }
    
    showCommandBar() {
        this.commandBar.classList.remove('hidden');
        this.commandInput.focus();
        this.commandBarVisible = true;
    }
    
    hideCommandBar() {
        this.commandBar.classList.add('hidden');
        this.commandInput.value = '';
        this.commandBarVisible = false;
    }
    
    async processAICommand() {
        const query = this.commandInput.value.trim();
        if (!query) return;
        
        this.hideCommandBar();
        this.showAIResponse('Processing your request...');
        
        try {
            // Get current page context
            const webview = this.getActiveWebview();
            const context = {
                url: webview ? webview.getURL() : '',
                title: webview ? webview.getTitle() : ''
            };
            
            // Use local AI handler first
            let response;
            if (this.aiHandler) {
                response = await this.aiHandler.processQuery(query, context);
            } else {
                // Fallback to main process AI
                response = await window.electronAPI.ai.query(query, context);
            }
            
            this.showAIResponse(response);
            
            // Handle special commands
            if (query.toLowerCase().includes('navigate to') || query.toLowerCase().includes('go to')) {
                const urlMatch = query.match(/(?:navigate to|go to)\s+(.+)/i);
                if (urlMatch) {
                    this.navigate(urlMatch[1]);
                }
            }
            
            // Handle page analysis requests
            if (query.toLowerCase().includes('analyze') || query.toLowerCase().includes('summarize')) {
                await this.analyzeCurrentPage(query);
            }
        } catch (error) {
            this.showAIResponse(`Error: ${error.message}`, 'error');
        }
    }
    
    async analyzeCurrentPage(query) {
        const webview = this.getActiveWebview();
        if (!webview || !this.aiHandler) return;
        
        try {
            // Get page content
            const content = await webview.executeJavaScript(`
                document.body.innerText.substring(0, 3000)
            `);
            
            const analysis = await this.aiHandler.analyzePage(content, query);
            this.showAIResponse(analysis);
        } catch (error) {
            console.error('Failed to analyze page:', error);
        }
    }
    
    showAIResponse(content, type = 'info') {
        if (typeof content === 'string' && !content.includes('<')) {
            this.responseContent.textContent = content;
        } else {
            this.responseContent.innerHTML = content;
        }
        this.aiResponse.classList.remove('hidden');
        this.aiResponse.dataset.type = type;
        this.aiResponseVisible = true;
    }
    
    hideAIResponse() {
        this.aiResponse.classList.add('hidden');
        this.aiResponseVisible = false;
    }
    
    // Helpers
    getActiveWebview() {
        if (!this.activeTabId) return null;
        return this.webviewContainer.querySelector(`webview[data-tab-id="${this.activeTabId}"]`);
    }
    
    updateNavigationButtons(tab) {
        const webview = this.getActiveWebview();
        if (webview) {
            this.backBtn.disabled = !webview.canGoBack();
            this.forwardBtn.disabled = !webview.canGoForward();
        }
    }
    
    // Event handlers
    onLoadStart(tabId) {
        this.updateStatus('Loading...');
        const tabElement = document.querySelector(`[data-tab-id="${tabId}"]`);
        if (tabElement) {
            tabElement.classList.add('loading');
        }
    }
    
    onLoadStop(tabId) {
        this.updateStatus('');
        const tabElement = document.querySelector(`[data-tab-id="${tabId}"]`);
        if (tabElement) {
            tabElement.classList.remove('loading');
        }
        
        // Update navigation buttons
        if (tabId === this.activeTabId) {
            const tab = this.tabs.get(tabId);
            if (tab) {
                this.updateNavigationButtons(tab);
            }
        }
    }
    
    onLoadError(tabId, error) {
        this.updateStatus(`Failed to load: ${error.errorDescription}`);
        this.showNotification(`Failed to load page: ${error.errorDescription}`, 'error');
    }
    
    onNavigate(tabId, url) {
        const tab = this.tabs.get(tabId);
        if (tab) {
            tab.url = url;
            if (tabId === this.activeTabId) {
                // Don't show search.html in URL bar
                if (!url.includes('search.html')) {
                    this.urlBar.value = url;
                } else {
                    this.urlBar.value = '';
                }
                
                // Notify sidebar of page change
                if (this.sidebarHandler) {
                    this.sidebarHandler.onPageChange();
                }
            }
        }
        
        // Update security indicator
        this.updateSecurityIndicator(url);
    }
    
    handleNewWindow(event) {
        event.preventDefault();
        
        // Check if it's a popup or new tab
        if (event.disposition === 'new-window' || event.disposition === 'foreground-tab') {
            this.createNewTab(event.url);
        }
    }
    
    updateStatus(text) {
        // Create status text element if it doesn't exist
        if (!this.statusText && this.statusBar) {
            this.statusText = document.createElement('span');
            this.statusText.id = 'status-text';
            this.statusText.style.marginRight = '10px';
            this.statusBar.insertBefore(this.statusText, this.statusBar.firstChild);
        }
        
        if (this.statusText) {
            this.statusText.textContent = text;
        }
    }
    
    updateSecurityIndicator(url) {
        if (url.startsWith('https://')) {
            this.securityIndicator.textContent = '🔒 Secure';
            this.securityIndicator.className = 'security-indicator secure';
        } else if (url.startsWith('http://')) {
            this.securityIndicator.textContent = '⚠️ Not Secure';
            this.securityIndicator.className = 'security-indicator insecure';
        } else {
            this.securityIndicator.textContent = '';
            this.securityIndicator.className = 'security-indicator';
        }
    }
    
    updateAIStatus(status) {
        const aiStatus = document.getElementById('ai-status');
        if (aiStatus) {
            aiStatus.textContent = status;
        }
    }
    
    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        
        // Add to DOM
        document.body.appendChild(notification);
        
        // Auto-remove after 3 seconds
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }
    
    // Toggle AI Sidebar
    toggleAISidebar() {
        if (this.sidebarHandler) {
            this.sidebarHandler.toggleSidebar();
            this.hideAIResponse(); // Close AI menu
        }
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.browser = new BrowserRenderer();
});

// Suppress non-critical errors
window.addEventListener('error', (event) => {
    if (event.message && event.message.includes('dragEvent is not defined')) {
        event.preventDefault();
        return;
    }
    console.error('Unhandled error:', event.error);
});