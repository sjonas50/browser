# AI Browser

An intelligent web browser that combines traditional browsing with advanced AI capabilities, personal knowledge management, and comprehensive search functionality.

![AI Browser](https://img.shields.io/badge/Powered%20by-Claude%20AI-blue)
![Electron](https://img.shields.io/badge/Built%20with-Electron-47848F)
![License](https://img.shields.io/badge/License-MIT-green)

## ✨ Key Features

### 🤖 AI-Powered Deep Search
- **Multi-Source Research**: Searches across multiple search engines simultaneously
- **Intelligent Synthesis**: AI analyzes and combines information from web sources and your personal knowledge base
- **Natural Language**: Just type your question - no special syntax required
- **Knowledge Base Integration**: Searches your personal documents alongside web results

### 📚 Personal Knowledge Base
- **Local RAG System**: Retrieval-Augmented Generation with vector embeddings
- **Document Support**: Upload PDFs, text files, markdown, and HTML documents
- **Web Page Saving**: Save any webpage to your knowledge base with one click
- **Smart Bookmarks**: Bookmarks are integrated with your knowledge base
- **Semantic Search**: Find information using natural language, not just keywords

### 💬 AI Sidebar Assistant
- **Page Analysis**: Get instant summaries and insights about any webpage
- **Quick Actions**: Summarize, extract key points, translate, or simplify content
- **Contextual Chat**: Ask questions about the current page
- **Reading Metrics**: Word count and estimated reading time

### 📜 Browsing History
- **Smart History**: Automatically tracks searches and page visits
- **Advanced Filtering**: Filter by searches, page visits, or all activity
- **Search Within History**: Find anything you've previously searched or visited
- **Privacy-First**: All history is stored locally with encryption

### 🌐 Traditional Browsing
- **Tab Management**: Multiple tabs with smooth switching
- **Navigation Controls**: Back, forward, reload, and home
- **Security Protection**: Built-in security checks and phishing warnings
- **Modern UI**: Dark theme with responsive design

### 🔍 Search Engine Integration
- **Multiple Providers**: Support for Google, Brave Search, and DuckDuckGo
- **Rate Limiting**: Automatic handling of API rate limits
- **Fallback Options**: Gracefully degrades if APIs are unavailable

## 🚀 Getting Started

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn
- Git

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/ai-browser.git
cd ai-browser
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
Create a `.env` file in the root directory:
```env
# Required for AI features
ANTHROPIC_API_KEY=your_anthropic_api_key_here

# Optional: For enhanced web search (choose one)
GOOGLE_SEARCH_API_KEY=your_google_api_key_here
GOOGLE_SEARCH_ENGINE_ID=your_search_engine_id_here
# OR
BRAVE_SEARCH_API_KEY=your_brave_api_key_here
```

See [SEARCH_API_SETUP.md](SEARCH_API_SETUP.md) for detailed search API configuration.

4. Run the browser:
```bash
npm start
```

### Building for Production

```bash
# Build for current platform
npm run build

# Build for specific platform
npm run build:mac
npm run build:win
npm run build:linux
```

## 🎯 Usage

### AI Search
1. Type any question in the address bar
2. The AI will automatically detect queries vs URLs
3. Get comprehensive answers from multiple web sources
4. Results include both web information and your personal knowledge base

### Personal Knowledge Base
1. Click Settings (⚙️) → Knowledge Base (📚)
2. Upload documents or save web pages
3. Add bookmarks or create text notes
4. Your knowledge is automatically searched with every query

### Browse Websites
1. Type any URL in the address bar
2. Navigate normally with full browser features
3. Save interesting pages to your knowledge base
4. View your browsing history anytime

### AI Sidebar
1. Click the 🤖 button or use the sidebar toggle
2. Get instant page summaries and insights
3. Ask questions about the current page
4. Use quick actions for common tasks

### View History
1. Click Settings (⚙️) → History (📜)
2. Filter by searches or page visits
3. Search within your history
4. Click any item to revisit it

### Keyboard Shortcuts
- `Ctrl/Cmd + T`: New tab
- `Ctrl/Cmd + W`: Close tab
- `Ctrl/Cmd + L`: Focus address bar
- `Ctrl/Cmd + K`: AI command bar
- `Ctrl/Cmd + Shift + A`: Toggle sidebar
- `Ctrl/Cmd + R`: Reload page
- `Ctrl/Cmd + D`: Bookmark current page

## 🏗️ Architecture

### Project Structure
```
Browser/
├── src/
│   ├── main.js               # Main process entry
│   ├── preload.js            # Preload script
│   ├── ui/
│   │   ├── index.html        # Main UI
│   │   ├── renderer.js       # UI logic
│   │   ├── styles.css        # Styling
│   │   ├── welcome.html      # Welcome page
│   │   ├── search.html       # New tab search page
│   │   ├── history.html      # History viewer
│   │   ├── ai-*.js          # AI components
│   │   └── knowledge-*.html  # Knowledge base UI
│   ├── ai/
│   │   ├── AIManager.js      # AI orchestration
│   │   ├── claude-handler.js # Claude API integration
│   │   ├── EmbeddingService.js # Local embeddings
│   │   └── KnowledgeBaseManager.js # RAG system
│   ├── security/
│   │   └── SecurityManager.js # Security checks
│   ├── storage/
│   │   ├── StorageManager.js # Encrypted storage
│   │   └── VectraVectorStore.js # Vector database
│   └── services/
│       └── search-service.js # Web search APIs
├── package.json
├── README.md
├── SETUP_GUIDE.md
├── SEARCH_API_SETUP.md
└── .env.example
```

### Key Components

#### Main Process
- **AIManager**: Orchestrates AI operations and knowledge base
- **StorageManager**: Encrypted persistent storage with history
- **SecurityManager**: URL validation and phishing protection
- **KnowledgeBaseManager**: Local RAG system with vector search
- **SearchService**: Multi-provider web search integration

#### Renderer Process
- **BrowserRenderer**: Core UI controller with history tracking
- **ClaudeAIHandler**: Claude API integration
- **AIBrowserAssistant**: Deep search with multi-source synthesis
- **AISidebarHandler**: Contextual page assistance
- **KnowledgeBaseHandler**: Document management UI

## 🔧 Configuration

### Settings
Settings are stored in:
- **Windows**: `%APPDATA%/ai-browser/settings.json`
- **macOS**: `~/Library/Application Support/ai-browser/settings.json`
- **Linux**: `~/.config/ai-browser/settings.json`

### Security Settings
```json
{
  "security": {
    "blockTrackers": true,
    "blockAds": true,
    "httpsOnly": false,
    "customBlocklist": []
  }
}
```

## 🛡️ Security & Privacy

- **Local First**: Knowledge base and history stored locally with encryption
- **HTTPS Enforcement**: Warns about insecure connections
- **Phishing Protection**: Checks URLs against known phishing sites
- **Tracker Blocking**: Blocks known tracking domains
- **Isolated Contexts**: Each tab runs in isolation
- **No Cloud Sync**: Your data stays on your device
- **Encrypted Storage**: Sensitive data encrypted at rest

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with [Electron](https://www.electronjs.org/)
- AI powered by [Anthropic Claude](https://www.anthropic.com/)
- Vector search by [Vectra](https://github.com/Stevenic/vectra)
- Local embeddings by [Transformers.js](https://github.com/xenova/transformers.js)

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/ai-browser/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/ai-browser/discussions)

## 🚦 Roadmap

### In Progress
- [x] Personal knowledge base with RAG
- [x] Smart browsing history
- [x] Multi-source web search

### Planned
- [ ] Voice search integration
- [ ] Search suggestions from history
- [ ] History export/import
- [ ] Extension support
- [ ] Mobile companion app
- [ ] Collaborative browsing
- [ ] AI writing assistant
- [ ] Advanced privacy tools
- [ ] MCP (Model Context Protocol) integration

## 📚 Documentation

- [Setup Guide](SETUP_GUIDE.md) - Detailed installation instructions
- [Search API Setup](SEARCH_API_SETUP.md) - Configure web search providers
- [History Feature](HISTORY_FEATURE.md) - Using the history system

---

**Made with ❤️ by The Attic AI**