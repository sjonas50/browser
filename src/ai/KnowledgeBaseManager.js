/**
 * Knowledge Base Manager
 * Manages document storage, retrieval, and search for the personal knowledge base
 */

const VectraVectorStore = require('../storage/VectraVectorStore');
const EmbeddingService = require('./EmbeddingService');
const DocumentParser = require('./DocumentParser');
const crypto = require('crypto');

class KnowledgeBaseManager {
    constructor(storageManager, logger) {
        this.storageManager = storageManager;
        this.logger = logger;
        this.vectorStore = new VectraVectorStore(logger);
        this.embeddingService = new EmbeddingService(logger);
        this.documentParser = new DocumentParser(logger);
        
        // Collection names
        this.COLLECTIONS = {
            PERSONAL: 'personal',
            WORK: 'work',
            RESEARCH: 'research',
            BOOKMARKS: 'bookmarks',
            BROWSING: 'browsing'
        };
        
        // Document storage
        this.documents = new Map(); // In-memory cache
        this.sessions = new Map(); // Session-based storage
        
        // Configuration
        this.config = {
            chunkSize: 1000, // Characters per chunk
            chunkOverlap: 200, // Overlap between chunks
            maxChunkSize: 2000,
            minChunkSize: 100
        };
    }
    
    async initialize() {
        this.logger.info('[KnowledgeBase] Initializing knowledge base...');
        
        try {
            // Initialize embedding service first
            await this.embeddingService.initialize();
            
            // Connect embedding service to vector store
            this.vectorStore.setEmbeddingService(this.embeddingService);
            
            // Initialize vector store
            await this.vectorStore.initialize();
            
            // Create default collections
            for (const collectionName of Object.values(this.COLLECTIONS)) {
                await this.vectorStore.getOrCreateCollection(collectionName, {
                    description: `Default ${collectionName} collection`
                });
            }
            
            // Load document metadata from storage
            await this.loadDocumentMetadata();
            
            this.logger.info('[KnowledgeBase] Initialized successfully');
        } catch (error) {
            this.logger.error('[KnowledgeBase] Initialization failed:', error);
            throw error;
        }
    }
    
    /**
     * Add a document to the knowledge base
     */
    async addDocument(content, metadata = {}) {
        const documentId = this.generateDocumentId();
        const timestamp = new Date().toISOString();
        
        try {
            // Parse document if it's a file buffer
            let parsedContent = content;
            let documentData = {
                title: metadata.title || 'Untitled Document',
                content: parsedContent,
                wordCount: 0
            };
            
            if (metadata.buffer && metadata.fileType) {
                documentData = await this.documentParser.parseBuffer(
                    metadata.buffer, 
                    metadata.fileType, 
                    metadata.title
                );
                parsedContent = documentData.content;
            } else if (typeof content === 'string') {
                documentData.wordCount = this.countWords(content);
            }
            
            // Create document object
            const document = {
                id: documentId,
                title: documentData.title,
                content: parsedContent,
                source: metadata.source || 'manual',
                url: metadata.url,
                collection: metadata.collection || this.COLLECTIONS.PERSONAL,
                session: metadata.session,
                timestamp,
                type: metadata.type || 'text',
                wordCount: documentData.wordCount,
                metadata: {
                    ...metadata,
                    ...documentData.metadata
                }
            };
            
            // Chunk the document
            const chunks = await this.chunkDocument(parsedContent, document.type);
            
            // Store in vector database
            const collectionName = metadata.session ? 
                `session_${metadata.session}` : 
                document.collection;
            
            const chunkIds = [];
            const chunkDocuments = [];
            const chunkMetadatas = [];
            
            chunks.forEach((chunk, index) => {
                const chunkId = `${documentId}_chunk_${index}`;
                chunkIds.push(chunkId);
                chunkDocuments.push(chunk.content);
                chunkMetadatas.push({
                    documentId,
                    chunkIndex: index,
                    title: document.title,
                    source: document.source,
                    timestamp,
                    startChar: chunk.startChar,
                    endChar: chunk.endChar
                });
            });
            
            await this.vectorStore.addDocuments(
                collectionName,
                chunkDocuments,
                chunkMetadatas,
                chunkIds
            );
            
            // Store document metadata
            if (metadata.session) {
                this.addToSession(metadata.session, document);
            } else {
                this.documents.set(documentId, document);
                await this.saveDocumentMetadata();
            }
            
            // Track in storage manager
            await this.storageManager.addDocumentToHistory(document);
            
            this.logger.info(`[KnowledgeBase] Added document: ${document.title} (${chunks.length} chunks)`);
            
            return documentId;
        } catch (error) {
            this.logger.error('[KnowledgeBase] Failed to add document:', error);
            throw error;
        }
    }
    
    /**
     * Add a webpage to the knowledge base
     */
    async addWebPage(url, htmlContent, metadata = {}) {
        try {
            const parsedPage = await this.documentParser.parseWebPage(url, htmlContent);
            
            return await this.addDocument(parsedPage.content, {
                ...metadata,
                title: parsedPage.title,
                url: url,
                source: 'webpage',
                type: 'html',
                pageMetadata: parsedPage.metadata
            });
        } catch (error) {
            this.logger.error('[KnowledgeBase] Failed to add webpage:', error);
            throw error;
        }
    }
    
    /**
     * Add a bookmark
     */
    async addBookmark(url, title, metadata = {}) {
        try {
            const bookmarkDoc = {
                url,
                title,
                notes: metadata.notes || '',
                tags: metadata.tags || [],
                favicon: metadata.favicon
            };
            
            return await this.addDocument(
                `${title}\n${url}\n${metadata.notes || ''}`,
                {
                    ...metadata,
                    title,
                    url,
                    source: 'bookmark',
                    collection: this.COLLECTIONS.BOOKMARKS,
                    type: 'bookmark'
                }
            );
        } catch (error) {
            this.logger.error('[KnowledgeBase] Failed to add bookmark:', error);
            throw error;
        }
    }
    
    /**
     * Search the knowledge base
     */
    async search(query, options = {}) {
        const {
            collections = [this.COLLECTIONS.PERSONAL],
            includeSession = false,
            sessionId = null,
            limit = 10,
            scoreThreshold = 0.5
        } = options;
        
        try {
            const searchCollections = [...collections];
            
            // Add session collection if requested
            if (includeSession && sessionId) {
                searchCollections.push(`session_${sessionId}`);
            }
            
            // Search each collection
            const allResults = [];
            
            for (const collectionName of searchCollections) {
                try {
                    const results = await this.vectorStore.query(
                        collectionName,
                        query,
                        null,
                        limit
                    );
                    
                    allResults.push(...results);
                } catch (error) {
                    // Collection might not exist
                    this.logger.debug(`Collection ${collectionName} not found`);
                }
            }
            
            // Sort by score and filter by threshold
            const filteredResults = allResults
                .filter(result => result.score >= scoreThreshold)
                .sort((a, b) => b.score - a.score)
                .slice(0, limit);
            
            // Group by document
            const documentResults = new Map();
            
            for (const result of filteredResults) {
                const docId = result.metadata.documentId;
                
                if (!documentResults.has(docId)) {
                    documentResults.set(docId, {
                        documentId: docId,
                        title: result.metadata.title,
                        source: result.metadata.source,
                        timestamp: result.metadata.timestamp,
                        chunks: [],
                        maxScore: 0
                    });
                }
                
                const docResult = documentResults.get(docId);
                docResult.chunks.push({
                    content: result.document,
                    score: result.score,
                    chunkIndex: result.metadata.chunkIndex
                });
                docResult.maxScore = Math.max(docResult.maxScore, result.score);
            }
            
            // Convert to array and sort by max score
            const finalResults = Array.from(documentResults.values())
                .sort((a, b) => b.maxScore - a.maxScore);
            
            this.logger.info(`[KnowledgeBase] Search found ${finalResults.length} documents`);
            
            return finalResults;
        } catch (error) {
            this.logger.error('[KnowledgeBase] Search failed:', error);
            throw error;
        }
    }
    
    /**
     * Get a document by ID
     */
    async getDocument(documentId) {
        // Check memory cache first
        if (this.documents.has(documentId)) {
            return this.documents.get(documentId);
        }
        
        // Check sessions
        for (const session of this.sessions.values()) {
            const doc = session.documents.find(d => d.id === documentId);
            if (doc) return doc;
        }
        
        return null;
    }
    
    /**
     * Delete a document
     */
    async deleteDocument(documentId) {
        const document = await this.getDocument(documentId);
        if (!document) {
            throw new Error(`Document ${documentId} not found`);
        }
        
        try {
            // Delete from vector store
            const collectionName = document.session ? 
                `session_${document.session}` : 
                document.collection;
            
            // Get all chunk IDs for this document
            const stats = await this.vectorStore.getCollectionStats(collectionName);
            const chunkIds = [];
            for (let i = 0; i < 100; i++) { // Assume max 100 chunks
                chunkIds.push(`${documentId}_chunk_${i}`);
            }
            
            await this.vectorStore.deleteDocuments(collectionName, chunkIds);
            
            // Remove from memory
            if (document.session) {
                this.removeFromSession(document.session, documentId);
            } else {
                this.documents.delete(documentId);
                await this.saveDocumentMetadata();
            }
            
            this.logger.info(`[KnowledgeBase] Deleted document: ${documentId}`);
        } catch (error) {
            this.logger.error('[KnowledgeBase] Failed to delete document:', error);
            throw error;
        }
    }
    
    /**
     * Create a new collection
     */
    async createCollection(name, metadata = {}) {
        if (Object.values(this.COLLECTIONS).includes(name)) {
            throw new Error(`Collection '${name}' already exists as a default collection`);
        }
        
        await this.vectorStore.createCollection(name, metadata);
        this.logger.info(`[KnowledgeBase] Created collection: ${name}`);
    }
    
    /**
     * Get knowledge base statistics
     */
    async getStats() {
        try {
            const collections = await this.vectorStore.listCollections();
            const stats = {
                totalDocuments: this.documents.size,
                collections: {}
            };
            
            for (const collection of collections) {
                const collStats = await this.vectorStore.getCollectionStats(collection.name);
                stats.collections[collection.name] = {
                    documents: collStats.count,
                    metadata: collection.metadata
                };
            }
            
            // Add session stats
            let sessionDocs = 0;
            this.sessions.forEach(session => {
                sessionDocs += session.documents.length;
            });
            stats.sessionDocuments = sessionDocs;
            stats.activeSessions = this.sessions.size;
            
            return stats;
        } catch (error) {
            this.logger.error('[KnowledgeBase] Failed to get stats:', error);
            throw error;
        }
    }
    
    /**
     * Chunk a document into smaller pieces
     */
    async chunkDocument(content, type = 'text') {
        // Use the embedding service's chunking method which respects token limits
        const chunkTexts = this.embeddingService.chunkText(
            content, 
            this.config.chunkSize, 
            this.config.chunkOverlap
        );
        
        const chunks = [];
        let currentPosition = 0;
        
        for (const chunkText of chunkTexts) {
            const startChar = content.indexOf(chunkText, currentPosition);
            const endChar = startChar + chunkText.length;
            
            chunks.push({
                content: chunkText,
                startChar,
                endChar
            });
            
            currentPosition = startChar + chunkText.length;
        }
        
        return chunks;
    }
    
    /**
     * Session management
     */
    addToSession(sessionId, document) {
        if (!this.sessions.has(sessionId)) {
            this.sessions.set(sessionId, {
                id: sessionId,
                documents: [],
                createdAt: new Date().toISOString()
            });
        }
        
        this.sessions.get(sessionId).documents.push(document);
    }
    
    removeFromSession(sessionId, documentId) {
        const session = this.sessions.get(sessionId);
        if (session) {
            session.documents = session.documents.filter(d => d.id !== documentId);
            if (session.documents.length === 0) {
                this.sessions.delete(sessionId);
            }
        }
    }
    
    clearSession(sessionId) {
        this.sessions.delete(sessionId);
        // TODO: Also clear from vector store
    }
    
    /**
     * Storage management
     */
    async loadDocumentMetadata() {
        try {
            const kb = await this.storageManager.getKnowledgeBase();
            
            // Load documents from collections
            if (kb.collections) {
                Object.entries(kb.collections).forEach(([collectionId, collection]) => {
                    if (collection.documents) {
                        collection.documents.forEach(doc => {
                            this.documents.set(doc.id, doc);
                        });
                    }
                });
            }
        } catch (error) {
            this.logger.warn('[KnowledgeBase] No existing metadata found');
        }
    }
    
    async saveDocumentMetadata() {
        try {
            const collections = {};
            
            // Group documents by collection
            this.documents.forEach(doc => {
                const collectionId = doc.collection || this.COLLECTIONS.PERSONAL;
                if (!collections[collectionId]) {
                    collections[collectionId] = {
                        documents: []
                    };
                }
                collections[collectionId].documents.push({
                    id: doc.id,
                    title: doc.title,
                    source: doc.source,
                    timestamp: doc.timestamp,
                    wordCount: doc.wordCount
                });
            });
            
            await this.storageManager.updateKnowledgeBase({ collections });
        } catch (error) {
            this.logger.error('[KnowledgeBase] Failed to save metadata:', error);
        }
    }
    
    /**
     * Utility methods
     */
    generateDocumentId() {
        return crypto.randomBytes(16).toString('hex');
    }
    
    countWords(text) {
        return text.trim().split(/\s+/).filter(word => word.length > 0).length;
    }
    
    /**
     * Export documents
     */
    async exportDocuments(collectionName = null) {
        const documents = [];
        
        this.documents.forEach(doc => {
            if (!collectionName || doc.collection === collectionName) {
                documents.push(doc);
            }
        });
        
        return {
            version: '1.0',
            exportDate: new Date().toISOString(),
            documents
        };
    }
    
    /**
     * Import documents
     */
    async importDocuments(data) {
        if (!data.documents || !Array.isArray(data.documents)) {
            throw new Error('Invalid import data format');
        }
        
        const imported = [];
        
        for (const doc of data.documents) {
            try {
                const docId = await this.addDocument(doc.content, {
                    title: doc.title,
                    source: doc.source || 'import',
                    collection: doc.collection,
                    type: doc.type,
                    url: doc.url,
                    importedFrom: data.exportDate
                });
                imported.push(docId);
            } catch (error) {
                this.logger.error(`Failed to import document: ${doc.title}`, error);
            }
        }
        
        this.logger.info(`[KnowledgeBase] Imported ${imported.length}/${data.documents.length} documents`);
        return imported;
    }
}

module.exports = KnowledgeBaseManager;