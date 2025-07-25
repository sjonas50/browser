/**
 * Local Vector Store Implementation
 * Provides vector storage and similarity search using local storage
 * This is a simplified implementation that doesn't require a ChromaDB server
 */

const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');

class LocalVectorStore {
    constructor(logger) {
        this.logger = logger;
        this.collections = new Map();
        
        // Configuration
        this.config = {
            persistPath: path.join(process.env.APPDATA || process.env.HOME, '.ai-browser', 'vectors'),
            embeddingDimension: 1536 // OpenAI ada-002 dimension
        };
    }
    
    async initialize() {
        this.logger.info('[LocalVectorStore] Initializing local vector storage...');
        
        try {
            // Ensure storage directory exists
            await fs.mkdir(this.config.persistPath, { recursive: true });
            
            // Load existing collections
            await this.loadCollections();
            
            this.logger.info('[LocalVectorStore] Initialized successfully');
        } catch (error) {
            this.logger.error('[LocalVectorStore] Initialization failed:', error);
            throw error;
        }
    }
    
    async createCollection(name, metadata = {}) {
        if (this.collections.has(name)) {
            throw new Error(`Collection '${name}' already exists`);
        }
        
        const collection = {
            name,
            metadata: {
                ...metadata,
                createdAt: new Date().toISOString()
            },
            documents: new Map(),
            vectors: new Map()
        };
        
        this.collections.set(name, collection);
        await this.saveCollection(name);
        
        this.logger.info(`[LocalVectorStore] Created collection: ${name}`);
        return collection;
    }
    
    async getOrCreateCollection(name, metadata = {}) {
        if (this.collections.has(name)) {
            return this.collections.get(name);
        }
        
        return await this.createCollection(name, metadata);
    }
    
    async addDocuments(collectionName, documents, metadatas = [], ids = null) {
        const collection = await this.getOrCreateCollection(collectionName);
        
        // Generate IDs if not provided
        if (!ids) {
            ids = documents.map(() => this.generateId());
        }
        
        // For now, we'll use a simple text-based similarity
        // In production, you'd want to use actual embeddings
        for (let i = 0; i < documents.length; i++) {
            const id = ids[i];
            const doc = documents[i];
            const metadata = metadatas[i] || {};
            
            collection.documents.set(id, {
                id,
                content: doc,
                metadata,
                timestamp: new Date().toISOString()
            });
            
            // Simple embedding: lowercase words as features
            // This is a placeholder - in production use actual embeddings
            const words = doc.toLowerCase().split(/\s+/).filter(w => w.length > 2);
            collection.vectors.set(id, {
                id,
                features: words,
                norm: Math.sqrt(words.length)
            });
        }
        
        await this.saveCollection(collectionName);
        
        this.logger.info(`[LocalVectorStore] Added ${documents.length} documents to collection: ${collectionName}`);
        return ids;
    }
    
    async query(collectionName, queryTexts, queryEmbeddings = null, nResults = 5, where = null) {
        const collection = this.collections.get(collectionName);
        if (!collection) {
            throw new Error(`Collection '${collectionName}' not found`);
        }
        
        const queryText = Array.isArray(queryTexts) ? queryTexts[0] : queryTexts;
        const queryWords = queryText.toLowerCase().split(/\s+/).filter(w => w.length > 2);
        const querySet = new Set(queryWords);
        
        const results = [];
        
        // Calculate similarity for each document
        for (const [id, doc] of collection.documents.entries()) {
            // Apply filters if provided
            if (where && !this.matchesFilter(doc.metadata, where)) {
                continue;
            }
            
            const vector = collection.vectors.get(id);
            if (!vector) continue;
            
            // Simple similarity: Jaccard similarity of word sets
            const docSet = new Set(vector.features);
            const intersection = new Set([...querySet].filter(x => docSet.has(x)));
            const union = new Set([...querySet, ...docSet]);
            
            const similarity = union.size > 0 ? intersection.size / union.size : 0;
            
            results.push({
                id,
                score: similarity,
                document: doc.content,
                metadata: doc.metadata
            });
        }
        
        // Sort by similarity and return top n
        return results
            .sort((a, b) => b.score - a.score)
            .slice(0, nResults);
    }
    
    async deleteDocuments(collectionName, ids) {
        const collection = this.collections.get(collectionName);
        if (!collection) {
            throw new Error(`Collection '${collectionName}' not found`);
        }
        
        const idsArray = Array.isArray(ids) ? ids : [ids];
        
        for (const id of idsArray) {
            collection.documents.delete(id);
            collection.vectors.delete(id);
        }
        
        await this.saveCollection(collectionName);
        
        this.logger.info(`[LocalVectorStore] Deleted ${idsArray.length} documents from collection: ${collectionName}`);
    }
    
    async deleteCollection(name) {
        this.collections.delete(name);
        
        try {
            const filePath = path.join(this.config.persistPath, `${name}.json`);
            await fs.unlink(filePath);
            this.logger.info(`[LocalVectorStore] Deleted collection: ${name}`);
        } catch (error) {
            this.logger.warn(`[LocalVectorStore] Failed to delete collection file: ${name}`);
        }
    }
    
    async getCollectionStats(name) {
        const collection = this.collections.get(name);
        if (!collection) {
            throw new Error(`Collection '${name}' not found`);
        }
        
        return {
            name,
            count: collection.documents.size,
            metadata: collection.metadata
        };
    }
    
    async listCollections() {
        return Array.from(this.collections.entries()).map(([name, collection]) => ({
            name,
            metadata: collection.metadata
        }));
    }
    
    generateId() {
        return `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    matchesFilter(metadata, filter) {
        for (const [key, value] of Object.entries(filter)) {
            if (value === null || value === undefined) continue;
            
            if (typeof value === 'object' && value.$in) {
                if (!value.$in.includes(metadata[key])) {
                    return false;
                }
            } else if (metadata[key] !== value) {
                return false;
            }
        }
        return true;
    }
    
    async saveCollection(name) {
        const collection = this.collections.get(name);
        if (!collection) return;
        
        const filePath = path.join(this.config.persistPath, `${name}.json`);
        
        // Convert Maps to arrays for JSON serialization
        const data = {
            name: collection.name,
            metadata: collection.metadata,
            documents: Array.from(collection.documents.entries()).map(([id, doc]) => ({
                id,
                ...doc
            })),
            vectors: Array.from(collection.vectors.entries()).map(([id, vec]) => ({
                id,
                ...vec
            }))
        };
        
        await fs.writeFile(filePath, JSON.stringify(data, null, 2));
    }
    
    async loadCollections() {
        try {
            const files = await fs.readdir(this.config.persistPath);
            const jsonFiles = files.filter(f => f.endsWith('.json'));
            
            for (const file of jsonFiles) {
                const name = path.basename(file, '.json');
                const filePath = path.join(this.config.persistPath, file);
                
                try {
                    const data = JSON.parse(await fs.readFile(filePath, 'utf8'));
                    
                    const collection = {
                        name: data.name,
                        metadata: data.metadata || {},
                        documents: new Map(),
                        vectors: new Map()
                    };
                    
                    // Restore documents
                    if (data.documents) {
                        data.documents.forEach(doc => {
                            collection.documents.set(doc.id, {
                                id: doc.id,
                                content: doc.content,
                                metadata: doc.metadata,
                                timestamp: doc.timestamp
                            });
                        });
                    }
                    
                    // Restore vectors
                    if (data.vectors) {
                        data.vectors.forEach(vec => {
                            collection.vectors.set(vec.id, {
                                id: vec.id,
                                features: vec.features,
                                norm: vec.norm
                            });
                        });
                    }
                    
                    this.collections.set(name, collection);
                    this.logger.info(`[LocalVectorStore] Loaded collection: ${name}`);
                } catch (error) {
                    this.logger.error(`[LocalVectorStore] Failed to load collection ${name}:`, error);
                }
            }
        } catch (error) {
            // Directory might not exist yet
            if (error.code !== 'ENOENT') {
                throw error;
            }
        }
    }
}

module.exports = LocalVectorStore;