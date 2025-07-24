// AI Sidebar Handler
// Manages the AI assistant sidebar functionality

class AISidebarHandler {
    constructor(aiHandler, aiBrowserAssistant) {
        this.aiHandler = aiHandler;
        this.aiBrowserAssistant = aiBrowserAssistant;
        this.isOpen = false;
        this.chatHistory = [];
        this.insights = [];
        this.currentPageInfo = null;
        
        this.initializeElements();
        this.attachEventListeners();
    }
    
    initializeElements() {
        // Sidebar elements
        this.sidebar = document.getElementById('ai-sidebar');
        this.toggleButton = document.getElementById('sidebar-toggle');
        
        // Chat elements
        this.chatMessages = document.getElementById('chat-messages');
        this.chatInput = document.getElementById('chat-input');
        this.sendButton = document.getElementById('send-chat');
        
        // Quick action buttons
        this.quickActions = document.querySelectorAll('.quick-action-btn');
        
        // Page context elements
        this.contextUrl = document.getElementById('context-url');
        this.wordCount = document.getElementById('word-count');
        this.readingTime = document.getElementById('reading-time');
        
        // Insights list
        this.insightsList = document.getElementById('recent-insights');
    }
    
    attachEventListeners() {
        // Toggle sidebar
        if (this.toggleButton) {
            this.toggleButton.addEventListener('click', () => this.toggleSidebar());
        }
        
        // Chat functionality
        if (this.sendButton) {
            this.sendButton.addEventListener('click', () => this.sendChatMessage());
        }
        
        if (this.chatInput) {
            this.chatInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendChatMessage();
                }
            });
            
            // Auto-resize textarea
            this.chatInput.addEventListener('input', () => {
                this.chatInput.style.height = 'auto';
                this.chatInput.style.height = Math.min(this.chatInput.scrollHeight, 100) + 'px';
            });
        }
        
        // Quick actions
        this.quickActions.forEach(button => {
            button.addEventListener('click', () => {
                const action = button.dataset.action;
                this.handleQuickAction(action);
            });
        });
        
        // Keyboard shortcut for sidebar
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'A') {
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
            window.electronAPI.storage.set('sidebarOpen', this.isOpen);
        }
        
        // Update page context when opening
        if (this.isOpen) {
            this.updatePageContext();
        }
    }
    
    async sendChatMessage() {
        const message = this.chatInput.value.trim();
        if (!message) return;
        
        // Add user message to chat
        this.addChatMessage(message, 'user');
        
        // Clear input
        this.chatInput.value = '';
        this.chatInput.style.height = 'auto';
        
        // Show typing indicator
        const typingId = this.showTypingIndicator();
        
        try {
            // Get current page context
            const webview = this.getCurrentWebview();
            let context = {
                url: 'No page loaded',
                title: 'New Tab',
                content: ''
            };
            
            if (webview) {
                context.url = webview.getURL();
                context.title = webview.getTitle();
                
                // Get page content for context
                try {
                    context.content = await webview.executeJavaScript(
                        `document.body.innerText.substring(0, 3000)`
                    );
                } catch (e) {
                    console.error('Failed to get page content:', e);
                }
            }
            
            // Process query with page context
            const response = await this.aiHandler.processQuery(
                `Context: User is browsing "${context.title}" at ${context.url}.\n\nPage content preview: ${context.content}\n\nUser question: ${message}\n\nProvide a helpful response considering the page context.`,
                { 
                    isChat: true,
                    url: context.url,
                    title: context.title
                }
            );
            
            // Remove typing indicator
            this.removeTypingIndicator(typingId);
            
            // Add AI response
            this.addChatMessage(response, 'ai');
            
            // Save to chat history
            this.chatHistory.push({ user: message, ai: response, timestamp: new Date() });
            
        } catch (error) {
            this.removeTypingIndicator(typingId);
            this.addChatMessage(`Sorry, I encountered an error: ${error.message}`, 'ai');
        }
    }
    
    addChatMessage(content, type) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `chat-message ${type}-message`;
        
        const avatar = document.createElement('div');
        avatar.className = 'message-avatar';
        avatar.textContent = type === 'user' ? '👤' : '🤖';
        
        const messageContent = document.createElement('div');
        messageContent.className = 'message-content';
        messageContent.innerHTML = this.formatMessage(content);
        
        messageDiv.appendChild(avatar);
        messageDiv.appendChild(messageContent);
        
        this.chatMessages.appendChild(messageDiv);
        
        // Scroll to bottom
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }
    
    formatMessage(content) {
        // Convert markdown-like formatting to HTML
        return content
            .replace(/\n\n/g, '</p><p>')
            .replace(/\n/g, '<br>')
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.+?)\*/g, '<em>$1</em>')
            .replace(/`(.+?)`/g, '<code>$1</code>')
            .replace(/^/, '<p>')
            .replace(/$/, '</p>');
    }
    
    showTypingIndicator() {
        const id = Date.now().toString();
        const indicator = document.createElement('div');
        indicator.className = 'chat-message ai-message typing-indicator';
        indicator.id = `typing-${id}`;
        indicator.innerHTML = `
            <div class="message-avatar">🤖</div>
            <div class="message-content">
                <span class="typing-dot"></span>
                <span class="typing-dot"></span>
                <span class="typing-dot"></span>
            </div>
        `;
        this.chatMessages.appendChild(indicator);
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
        return id;
    }
    
    removeTypingIndicator(id) {
        const indicator = document.getElementById(`typing-${id}`);
        if (indicator) indicator.remove();
    }
    
    async handleQuickAction(action) {
        const webview = this.getCurrentWebview();
        if (!webview) {
            this.addChatMessage('Please load a webpage first to use this feature.', 'ai');
            return;
        }
        
        // Show processing
        const typingId = this.showTypingIndicator();
        
        try {
            let response;
            const url = webview.getURL();
            const title = webview.getTitle();
            const content = await webview.executeJavaScript(
                `document.body.innerText.substring(0, 10000)`
            );
            
            switch (action) {
                case 'summarize':
                    response = await this.aiHandler.processQuery(
                        `Summarize this webpage concisely:\nTitle: ${title}\nURL: ${url}\n\nContent: ${content}`,
                        { isSummary: true }
                    );
                    this.addInsight(`📝 Summary of ${title}`, response);
                    break;
                    
                case 'key-points':
                    response = await this.aiHandler.processQuery(
                        `Extract the key points from this webpage:\nTitle: ${title}\n\nContent: ${content}\n\nProvide as a numbered list.`,
                        { isExtraction: true }
                    );
                    this.addInsight(`🔑 Key points from ${title}`, response);
                    break;
                    
                case 'translate':
                    response = await this.aiHandler.processQuery(
                        `Translate the main content of this webpage to English (if not already in English) or Spanish (if in English):\nTitle: ${title}\n\nContent: ${content.substring(0, 2000)}`,
                        { isTranslation: true }
                    );
                    break;
                    
                case 'simplify':
                    response = await this.aiHandler.processQuery(
                        `Explain the content of this webpage in simple terms that anyone can understand:\nTitle: ${title}\n\nContent: ${content}`,
                        { isSimplification: true }
                    );
                    break;
            }
            
            this.removeTypingIndicator(typingId);
            this.addChatMessage(response, 'ai');
            
        } catch (error) {
            this.removeTypingIndicator(typingId);
            this.addChatMessage(`Failed to ${action}: ${error.message}`, 'ai');
        }
    }
    
    updatePageContext() {
        const webview = this.getCurrentWebview();
        if (!webview) {
            this.contextUrl.textContent = 'No page loaded';
            this.wordCount.textContent = '0';
            this.readingTime.textContent = '0 min';
            return;
        }
        
        const url = webview.getURL();
        const title = webview.getTitle();
        
        // Update URL display
        this.contextUrl.textContent = title || url || 'Loading...';
        this.contextUrl.title = url; // Show full URL on hover
        
        // Get word count and reading time
        webview.executeJavaScript(`
            const text = document.body.innerText;
            const wordCount = text.trim().split(/\\s+/).length;
            const readingTime = Math.ceil(wordCount / 200); // 200 words per minute
            ({ wordCount, readingTime });
        `).then(stats => {
            this.wordCount.textContent = stats.wordCount.toLocaleString();
            this.readingTime.textContent = `${stats.readingTime} min`;
        }).catch(error => {
            console.error('Failed to get page stats:', error);
        });
    }
    
    addInsight(title, content) {
        const insight = {
            id: Date.now(),
            title: title,
            content: content,
            timestamp: new Date()
        };
        
        this.insights.unshift(insight);
        
        // Keep only last 10 insights
        if (this.insights.length > 10) {
            this.insights = this.insights.slice(0, 10);
        }
        
        this.renderInsights();
    }
    
    renderInsights() {
        if (this.insights.length === 0) {
            this.insightsList.innerHTML = `
                <div class="empty-state">
                    <span class="empty-icon">💡</span>
                    <p>Your AI insights will appear here</p>
                </div>
            `;
            return;
        }
        
        this.insightsList.innerHTML = this.insights.map(insight => `
            <div class="insight-item" data-id="${insight.id}">
                <div class="insight-title">${insight.title}</div>
                <div class="insight-time">${this.formatTime(insight.timestamp)}</div>
            </div>
        `).join('');
        
        // Add click handlers
        this.insightsList.querySelectorAll('.insight-item').forEach(item => {
            item.addEventListener('click', () => {
                const id = parseInt(item.dataset.id);
                const insight = this.insights.find(i => i.id === id);
                if (insight) {
                    this.addChatMessage(insight.content, 'ai');
                }
            });
        });
    }
    
    formatTime(date) {
        const now = new Date();
        const diff = now - date;
        const minutes = Math.floor(diff / 60000);
        
        if (minutes < 1) return 'Just now';
        if (minutes < 60) return `${minutes}m ago`;
        
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h ago`;
        
        return date.toLocaleDateString();
    }
    
    getCurrentWebview() {
        // Access the browser instance directly
        if (window.browser && window.browser.getActiveWebview) {
            return window.browser.getActiveWebview();
        }
        return null;
    }
    
    // Called when page changes
    onPageChange() {
        if (this.isOpen) {
            this.updatePageContext();
        }
    }
}

// Add typing indicator animation CSS
const style = document.createElement('style');
style.textContent = `
.typing-indicator .message-content {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 12px;
}

.typing-dot {
    width: 8px;
    height: 8px;
    background: var(--text-secondary);
    border-radius: 50%;
    animation: typing 1.4s infinite;
}

.typing-dot:nth-child(2) {
    animation-delay: 0.2s;
}

.typing-dot:nth-child(3) {
    animation-delay: 0.4s;
}

@keyframes typing {
    0%, 60%, 100% {
        opacity: 0.3;
        transform: scale(0.8);
    }
    30% {
        opacity: 1;
        transform: scale(1);
    }
}

.insight-title {
    font-size: 13px;
    color: var(--text-primary);
    margin-bottom: 2px;
}

.insight-time {
    font-size: 11px;
    color: var(--text-secondary);
}
`;
document.head.appendChild(style);

export default AISidebarHandler;