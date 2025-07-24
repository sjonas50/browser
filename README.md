# AI Browser - Powered by The Attic AI

An intelligent web browser that combines traditional browsing with advanced AI capabilities, providing a seamless experience for both web navigation and AI-powered search.

![AI Browser](https://img.shields.io/badge/Powered%20by-The%20Attic%20AI-blue)
![Electron](https://img.shields.io/badge/Built%20with-Electron-47848F)
![License](https://img.shields.io/badge/License-MIT-green)

## ✨ Features

### 🤖 AI-Powered Search
- **Deep Search**: Ask any question and get comprehensive, multi-source answers
- **Intelligent Analysis**: AI analyzes and synthesizes information from multiple sources
- **Natural Language**: Just type your question - no special syntax required

### 💬 AI Sidebar Assistant
- **Page Analysis**: Get instant summaries and insights about any webpage
- **Quick Actions**: One-click summarization, key points extraction, translation, and simplification
- **Contextual Chat**: Ask questions about the current page content
- **Reading Time**: See word count and estimated reading time

### 🌐 Traditional Browsing
- **Tab Management**: Multiple tabs with smooth switching
- **Navigation Controls**: Back, forward, reload, and URL bar
- **Security Protection**: Built-in security checks and warnings
- **Privacy First**: Local processing when possible

### ⚡ Performance
- **Fast Loading**: Optimized for speed with intelligent caching
- **Parallel Processing**: Multiple operations handled simultaneously
- **Smooth UI**: Responsive interface with modern animations

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
ANTHROPIC_API_KEY=your_api_key_here
```

4. Run the browser:
```bash
npm run dev
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
3. Get comprehensive answers from multiple sources

### Browse Websites
1. Type any URL in the address bar
2. Navigate normally with full browser features
3. Use AI assistant for any page

### AI Sidebar
1. Click the 🤖 button in the address bar
2. Select "Toggle AI Sidebar"
3. Use quick actions or chat about the page

### Keyboard Shortcuts
- `Ctrl/Cmd + T`: New tab
- `Ctrl/Cmd + W`: Close tab
- `Ctrl/Cmd + L`: Focus address bar
- `Ctrl/Cmd + K`: AI command bar
- `Ctrl/Cmd + Shift + A`: Toggle sidebar
- `Ctrl/Cmd + R`: Reload page

## 🏗️ Architecture

### Project Structure
```
Browser/
├── src/
│   ├── main/
│   │   ├── index.js          # Main process entry
│   │   ├── preload.js        # Preload script
│   │   └── managers/         # Core managers
│   ├── ui/
│   │   ├── index.html        # Main UI
│   │   ├── renderer.js       # UI logic
│   │   ├── styles.css        # Styling
│   │   ├── welcome.html      # Welcome page
│   │   ├── search.html       # Search page
│   │   └── ai-*.js          # AI components
│   ├── ai/
│   │   └── claude-handler.js # AI integration
│   ├── security/
│   │   └── security-manager.js
│   └── storage/
│       └── storage-manager.js
├── package.json
├── README.md
└── .env.example
```

### Key Components

#### Main Process
- **WindowManager**: Handles browser windows
- **StorageManager**: Persistent data storage
- **SecurityManager**: URL and content security
- **AIManager**: AI model integration

#### Renderer Process
- **BrowserRenderer**: Core UI controller
- **ClaudeAIHandler**: AI API integration
- **AIBrowserAssistant**: Deep search functionality
- **AISidebarHandler**: Sidebar interactions

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

## 🛡️ Security

- **HTTPS Enforcement**: Warns about insecure connections
- **Tracker Blocking**: Blocks known tracking domains
- **Ad Blocking**: Optional ad blocking
- **Isolated Contexts**: Each tab runs in isolation
- **No Remote Code**: All JS runs locally

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
- Developed by [The Attic AI](https://www.theattic.ai/)

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/ai-browser/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/ai-browser/discussions)
- **Email**: support@theattic.ai

## 🚦 Roadmap

- [ ] Voice search integration
- [ ] AI-powered bookmarks
- [ ] Smart history search
- [ ] Extension support
- [ ] Mobile companion app
- [ ] Collaborative browsing
- [ ] AI writing assistant
- [ ] Advanced privacy tools

---

**Made with ❤️ by The Attic AI**