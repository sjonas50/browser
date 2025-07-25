# Personal Knowledge Base Feature

The AI Browser includes a powerful personal knowledge base system that allows users to save, organize, and search their own documents and web pages. This feature integrates seamlessly with the AI assistant to provide enhanced, personalized search results.

## Features

### 1. Document Storage
- **Add Documents**: Save text documents, web pages, PDFs, and more
- **Collections**: Organize documents into collections (Personal, Work, Research, etc.)
- **Session vs Permanent**: Choose between temporary session storage or permanent storage

### 2. Vector Search
- **Semantic Search**: Find documents based on meaning, not just keywords
- **Hybrid Search**: Combines vector similarity with keyword matching
- **Relevance Scoring**: Results are ranked by relevance

### 3. AI Integration (RAG - Retrieval Augmented Generation)
- **Three Modes**:
  - **Augment**: Add knowledge base results to enhance AI responses
  - **Priority**: Prioritize knowledge base content over general knowledge
  - **Only**: Restrict AI to only use information from your knowledge base

### 4. User Interface
- **Knowledge Sidebar**: Accessible via the 📚 button
- **Quick Actions**: Add current page, upload files, or paste text
- **Search Interface**: Search across all your saved knowledge
- **Collection Management**: Create and organize custom collections

## How to Use

### Adding Documents

1. **Current Page**: Click the 📚 button → "Add Document" → "Current Page"
2. **Upload Files**: Click "Add Document" → "Upload Files" → Select files
3. **Manual Entry**: Click "Add Document" → "Add Text" → Enter content

### Searching Knowledge

1. Toggle the knowledge base sidebar with the 📚 button
2. Use the search box to find documents
3. Click on any result to view details

### AI Integration

1. Enable "Use in searches" in the knowledge sidebar
2. Choose your preferred mode:
   - **Augment**: Best for general browsing with personal context
   - **Priority**: Best when your knowledge base has authoritative information
   - **Only**: Best for private/sensitive queries

### Managing Collections

1. Click the "+" next to Collections
2. Enter a name and choose an emoji icon
3. Documents can be assigned to collections when adding them

## Technical Architecture

### Components

1. **KnowledgeBaseManager**: Core logic for document management
2. **VectorStore**: Handles vector embeddings and similarity search
3. **StorageManager**: Persists knowledge base data securely
4. **AIManager**: Integrates RAG capabilities for enhanced AI responses

### Data Flow

1. **Document Addition**:
   ```
   User Input → KnowledgeBaseManager → Chunking → Embedding → VectorStore
   ```

2. **Search Query**:
   ```
   Query → Embedding → VectorStore → Similarity Search → Ranked Results
   ```

3. **AI Integration**:
   ```
   User Query → Knowledge Retrieval → Context Enhancement → Claude API → Response
   ```

### Storage

- **Vectors**: Stored in `~/.ai-browser/vectors/`
- **Metadata**: Stored in encrypted electron-store
- **Documents**: Chunked and indexed for efficient retrieval

## Privacy & Security

- All data is stored locally on your device
- Documents are encrypted at rest
- No data is sent to external servers (except for AI queries when enabled)
- Session storage is automatically cleared when the browser closes

## Future Enhancements

- [ ] ChromaDB integration for better vector storage
- [ ] Support for more file formats (Word, Excel, etc.)
- [ ] Advanced filtering and search operators
- [ ] Knowledge graph visualization
- [ ] Import/export functionality
- [ ] Sync across devices (optional)