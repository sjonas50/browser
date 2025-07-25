# AI Browser Setup Guide

## Prerequisites

1. **Node.js** (v18 or higher)
   - Check version: `node --version`
   - Download from: https://nodejs.org/

2. **npm** (comes with Node.js)
   - Check version: `npm --version`

## Installation Steps

### 1. Install Dependencies

```bash
# Install all required packages
npm install
```

This will install:
- Electron (the browser framework)
- Transformers.js (for local embeddings)
- Vectra (vector database)
- PDF parsing libraries
- And all other dependencies

### 2. Set Up Environment Variables

```bash
# Copy the example environment file
cp .env.example .env

# Edit the .env file and add your Anthropic API key
# You need to replace 'your_api_key_here' with your actual key
```

**Get your Anthropic API key:**
1. Go to https://console.anthropic.com/
2. Sign up or log in
3. Go to API Keys section
4. Create a new key
5. Copy it to your `.env` file

Your `.env` file should look like:
```
ANTHROPIC_API_KEY=sk-ant-api03-xxxxxxxxxxxxx
NODE_ENV=development
DEBUG=true
```

### 3. Run the Application

```bash
# Start the AI Browser
npm start
```

## First Launch

On first launch:
1. The embedding model will be downloaded (~80MB)
2. This happens only once and is cached locally
3. The download progress will be shown in the console
4. Initial startup may take 10-30 seconds

## Troubleshooting

### Common Issues

1. **"Cannot find module" errors**
   - Run `npm install` again
   - Delete `node_modules` and run `npm install`

2. **API Key errors**
   - Make sure your `.env` file exists
   - Verify your API key is correct
   - Check that the key starts with `sk-ant-api03-`

3. **Electron not starting**
   - Try `npm run start:direct` instead
   - Check if port 3000 is available

4. **Model download fails**
   - Check your internet connection
   - The model needs ~80MB download
   - Try deleting `~/.cache/huggingface` and restart

### Platform-Specific Notes

**Windows:**
- You might need to run as Administrator
- Windows Defender might flag Electron (it's safe)

**macOS:**
- You might need to allow the app in Security preferences
- First launch might be slow due to macOS verification

**Linux:**
- You might need to install additional dependencies:
  ```bash
  sudo apt-get install libgtk-3-0 libnotify4 libnss3 libxss1 libxtst6 xdg-utils
  ```

## Features to Test

1. **Knowledge Base:**
   - Click Settings → Knowledge Base
   - Upload a text file or PDF
   - Search for content from the file

2. **AI Assistant:**
   - Click the AI button (🤖)
   - Ask questions about web pages
   - Try "Summarize this page"

3. **Smart Search:**
   - Type a question in the URL bar
   - Press Ctrl+Space for AI search

## Development Mode

For development with hot reload:
```bash
npm run dev
```

## Building for Distribution

To create a packaged app:
```bash
npm run build
```

This will create platform-specific packages in the `dist` folder.