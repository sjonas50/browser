/**
 * Vectra Vector Store Implementation
 * Provides vector storage and similarity search using Vectra with local embeddings
 */

const { LocalIndex } = require('vectra');
const path = require('path');
const fs = require('fs').promises;

class VectraVectorStore {
    constructor(logger) {
        this.logger = logger;
        this.indexes = new Map();
        this.embeddingService = null; // Will be injected
        
        // Configuration
        this.config = {
            persistPath: path.join(process.env.APPDATA || process.env.HOME, '.ai-browser', 'vectra'),
            dimensions: 384 // all-MiniLM-L6-v2 dimension
        };
    }
    
    setEmbeddingService(embeddingService) {
        this.embeddingService = embeddingService;
    }
    
    async initialize() {
        this.logger.info('[VectraVectorStore] Initializing Vectra vector storage...');
        
        try {
            // Ensure storage directory exists
            await fs.mkdir(this.config.persistPath, { recursive: true });
            
            // Load existing indexes
            await this.loadIndexes();
            
            this.logger.info('[VectraVectorStore] Initialized successfully');
        } catch (error) {
            this.logger.error('[VectraVectorStore] Initialization failed:', error);
            throw error;
        }
    }
    
    async loadIndexes() {
        try {
            const dirs = await fs.readdir(this.config.persistPath);
            
            for (const dir of dirs) {
                const indexPath = path.join(this.config.persistPath, dir);
                const stat = await fs.stat(indexPath);
                
                if (stat.isDirectory()) {
                    const index = new LocalIndex(indexPath);
                    
                    if (await index.isIndexCreated()) {
                        this.indexes.set(dir, index);
                        this.logger.info(`[VectraVectorStore] Loaded index: ${dir}`);
                    }
                }
            }
        } catch (error) {
            // Directory might not exist yet
            if (error.code !== 'ENOENT') {
                throw error;
            }
        }
    }
    
    async createCollection(name, metadata = {}) {
        if (this.indexes.has(name)) {
            throw new Error(`Collection '${name}' already exists`);
        }
        
        const indexPath = path.join(this.config.persistPath, name);
        const index = new LocalIndex(indexPath);
        
        await index.createIndex({
            version: 1,
            dimensions: this.config.dimensions,
            metric: 'cosine',
            ...metadata
        });
        
        this.indexes.set(name, index);
        this.logger.info(`[VectraVectorStore] Created collection: ${name}`);
        
        return index;
    }
    
    async getOrCreateCollection(name, metadata = {}) {
        if (this.indexes.has(name)) {
            return this.indexes.get(name);
        }
        
        const indexPath = path.join(this.config.persistPath, name);
        const index = new LocalIndex(indexPath);
        
        if (await index.isIndexCreated()) {
            this.indexes.set(name, index);
            return index;
        }
        
        return await this.createCollection(name, metadata);
    }
    
    async addDocuments(collectionName, documents, metadatas = [], ids = null) {
        if (!this.embeddingService) {
            throw new Error('Embedding service not initialized');
        }
        
        const index = await this.getOrCreateCollection(collectionName);
        
        // Generate IDs if not provided
        if (!ids) {
            ids = documents.map(() => this.generateId());
        }
        
        // Generate embeddings for all documents
        const embeddings = await this.embeddingService.embedBatch(documents);
        
        // Add items to the index one by one
        for (let i = 0; i < documents.length; i++) {
            await index.insertItem({
                id: ids[i],
                vector: embeddings[i],
                metadata: {
                    content: documents[i],
                    ...(metadatas[i] || {})
                }
            });
        }
        
        this.logger.info(`[VectraVectorStore] Added ${documents.length} documents to collection: ${collectionName}`);
        return ids;
    }
    
    async query(collectionName, queryTexts, queryEmbeddings = null, nResults = 5, where = null) {
        const index = this.indexes.get(collectionName);
        if (!index) {
            throw new Error(`Collection '${collectionName}' not found`);
        }
        
        const queryText = Array.isArray(queryTexts) ? queryTexts[0] : queryTexts;
        
        // Generate embedding for query if not provided
        let queryVector = queryEmbeddings;
        if (!queryVector && this.embeddingService) {
            queryVector = await this.embeddingService.embed(queryText);
        }
        
        if (!queryVector) {
            throw new Error('No query embedding provided and embedding service not available');
        }
        
        // Query the index
        const results = await index.queryItems(queryVector, nResults, where);
        
        // Format results for compatibility
        return results.map(result => ({
            id: result.item.id,
            score: 1 - result.score, // Convert distance to similarity
            document: result.item.metadata.content,
            metadata: result.item.metadata
        }));
    }
    
    async deleteDocuments(collectionName, ids) {
        const index = this.indexes.get(collectionName);
        if (!index) {
            throw new Error(`Collection '${collectionName}' not found`);
        }
        
        const idsArray = Array.isArray(ids) ? ids : [ids];
        
        for (const id of idsArray) {
            await index.deleteItem(id);
        }
        
        this.logger.info(`[VectraVectorStore] Deleted ${idsArray.length} documents from collection: ${collectionName}`);
    }
    
    async deleteCollection(name) {
        const index = this.indexes.get(name);
        if (index) {
            await index.deleteIndex();
            this.indexes.delete(name);
            this.logger.info(`[VectraVectorStore] Deleted collection: ${name}`);
        }
    }
    
    async getCollectionStats(name) {
        const index = this.indexes.get(name);
        if (!index) {
            throw new Error(`Collection '${name}' not found`);
        }
        
        const stats = await index.listItems();
        
        return {
            name,
            count: stats.length,
            metadata: {}
        };
    }
    
    async listCollections() {
        const collections = [];
        
        for (const [name, index] of this.indexes.entries()) {
            collections.push({
                name,
                metadata: {}
            });
        }
        
        return collections;
    }
    
    generateId() {
        return `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}

module.exports = VectraVectorStore;