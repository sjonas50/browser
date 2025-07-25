// History viewer functionality
class HistoryViewer {
    constructor() {
        this.currentFilter = 'all';
        this.historyData = [];
        this.filteredData = [];
        
        this.initializeElements();
        this.attachEventListeners();
        this.loadHistory();
    }
    
    initializeElements() {
        this.searchInput = document.getElementById('history-search');
        this.historyList = document.getElementById('history-list');
        this.filterButtons = document.querySelectorAll('.filter-btn');
        this.clearButton = document.getElementById('clear-history');
    }
    
    attachEventListeners() {
        // Search functionality
        this.searchInput.addEventListener('input', (e) => {
            this.searchHistory(e.target.value);
        });
        
        // Filter buttons
        this.filterButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.setFilter(e.target.dataset.filter);
            });
        });
        
        // Clear history button
        this.clearButton.addEventListener('click', () => {
            this.confirmClearHistory();
        });
    }
    
    async loadHistory() {
        try {
            // Get history from parent window
            if (window.parent && window.parent.electronAPI) {
                this.historyData = await window.parent.electronAPI.history.get({ limit: 500 });
            } else if (window.electronAPI) {
                this.historyData = await window.electronAPI.history.get({ limit: 500 });
            } else {
                throw new Error('Electron API not available');
            }
            
            this.applyFilter();
        } catch (error) {
            console.error('Failed to load history:', error);
            this.showError('Failed to load history');
        }
    }
    
    setFilter(filter) {
        this.currentFilter = filter;
        
        // Update button states
        this.filterButtons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.filter === filter);
        });
        
        this.applyFilter();
    }
    
    applyFilter() {
        if (this.currentFilter === 'all') {
            this.filteredData = this.historyData;
        } else {
            this.filteredData = this.historyData.filter(item => item.type === this.currentFilter);
        }
        
        this.renderHistory();
    }
    
    searchHistory(query) {
        if (!query) {
            this.applyFilter();
            return;
        }
        
        const searchLower = query.toLowerCase();
        this.filteredData = this.historyData.filter(item => {
            return (item.title && item.title.toLowerCase().includes(searchLower)) ||
                   (item.query && item.query.toLowerCase().includes(searchLower)) ||
                   (item.domain && item.domain.toLowerCase().includes(searchLower));
        });
        
        if (this.currentFilter !== 'all') {
            this.filteredData = this.filteredData.filter(item => item.type === this.currentFilter);
        }
        
        this.renderHistory();
    }
    
    renderHistory() {
        if (this.filteredData.length === 0) {
            this.showEmptyState();
            return;
        }
        
        // Group by date
        const groups = this.groupByDate(this.filteredData);
        
        let html = '';
        for (const [date, items] of Object.entries(groups)) {
            html += `
                <div class="history-group">
                    <h2>${date}</h2>
                    ${items.map(item => this.renderHistoryItem(item)).join('')}
                </div>
            `;
        }
        
        this.historyList.innerHTML = html;
        
        // Add click handlers
        this.historyList.querySelectorAll('.history-item').forEach((el, index) => {
            el.addEventListener('click', () => {
                const item = this.filteredData[index];
                this.openHistoryItem(item);
            });
        });
    }
    
    renderHistoryItem(item) {
        const icon = this.getIcon(item.type);
        const time = this.formatTime(item.timestamp);
        const details = this.getDetails(item);
        
        return `
            <div class="history-item" data-url="${item.url || ''}" data-query="${item.query || ''}">
                <div class="history-icon ${item.type}">${icon}</div>
                <div class="history-content">
                    <h3 class="history-title">${this.escapeHtml(item.title)}</h3>
                    <p class="history-details">${details}</p>
                    ${this.renderMeta(item)}
                </div>
                <div class="history-time">${time}</div>
            </div>
        `;
    }
    
    renderMeta(item) {
        const meta = [];
        
        if (item.type === 'search' && item.results) {
            meta.push(`${item.results.sourcesFound} sources found`);
            if (item.results.hasKnowledgeBase) {
                meta.push('📚 Used knowledge base');
            }
        }
        
        if (item.domain) {
            meta.push(item.domain);
        }
        
        if (meta.length === 0) return '';
        
        return `<div class="history-meta">${meta.join(' • ')}</div>`;
    }
    
    getIcon(type) {
        switch (type) {
            case 'search': return '🔍';
            case 'visit': return '🌐';
            case 'knowledge_document': return '📚';
            default: return '📄';
        }
    }
    
    getDetails(item) {
        if (item.type === 'search') {
            return item.query || 'Search query';
        } else if (item.type === 'visit') {
            return item.domain || item.url || 'Web page';
        } else if (item.type === 'knowledge_document') {
            return `Document: ${item.source || 'Unknown source'}`;
        }
        return '';
    }
    
    groupByDate(items) {
        const groups = {};
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        
        items.forEach(item => {
            const date = new Date(item.timestamp);
            let groupName;
            
            if (this.isSameDay(date, today)) {
                groupName = 'Today';
            } else if (this.isSameDay(date, yesterday)) {
                groupName = 'Yesterday';
            } else if (this.isWithinDays(date, 7)) {
                groupName = this.formatWeekday(date);
            } else {
                groupName = this.formatDate(date);
            }
            
            if (!groups[groupName]) {
                groups[groupName] = [];
            }
            groups[groupName].push(item);
        });
        
        return groups;
    }
    
    isSameDay(date1, date2) {
        return date1.getFullYear() === date2.getFullYear() &&
               date1.getMonth() === date2.getMonth() &&
               date1.getDate() === date2.getDate();
    }
    
    isWithinDays(date, days) {
        const now = new Date();
        const diff = now - date;
        return diff < days * 24 * 60 * 60 * 1000;
    }
    
    formatTime(timestamp) {
        const date = new Date(timestamp);
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        return `${hours}:${minutes}`;
    }
    
    formatWeekday(date) {
        return date.toLocaleDateString('en-US', { weekday: 'long' });
    }
    
    formatDate(date) {
        return date.toLocaleDateString('en-US', { 
            month: 'long', 
            day: 'numeric',
            year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
        });
    }
    
    openHistoryItem(item) {
        if (window.parent && window.parent.browser) {
            if (item.type === 'search' && item.query) {
                // Open search in parent
                window.parent.browser.navigateToUrl(item.query);
            } else if (item.type === 'visit' && item.url) {
                // Open URL in parent
                window.parent.browser.navigateToUrl(item.url);
            }
        }
    }
    
    async confirmClearHistory() {
        if (confirm('Are you sure you want to clear your browsing history? This cannot be undone.')) {
            try {
                if (window.parent && window.parent.electronAPI) {
                    await window.parent.electronAPI.history.clear();
                } else if (window.electronAPI) {
                    await window.electronAPI.history.clear();
                }
                
                this.historyData = [];
                this.filteredData = [];
                this.renderHistory();
            } catch (error) {
                console.error('Failed to clear history:', error);
                alert('Failed to clear history');
            }
        }
    }
    
    showEmptyState() {
        this.historyList.innerHTML = `
            <div class="empty-state">
                <h3>No history found</h3>
                <p>${this.currentFilter === 'all' ? 'Your browsing history will appear here' : `No ${this.currentFilter}es in your history`}</p>
            </div>
        `;
    }
    
    showError(message) {
        this.historyList.innerHTML = `
            <div class="empty-state">
                <h3>Error</h3>
                <p>${message}</p>
            </div>
        `;
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new HistoryViewer();
});