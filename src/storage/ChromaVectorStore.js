/**
 * ChromaDB Vector Store Implementation
 * Provides vector storage and similarity search using ChromaDB
 */

const { ChromaClient } = require('chromadb');
const { OpenAIEmbeddingFunction } = require('chromadb');
const path = require('path');
const fs = require('fs').promises;

class ChromaVectorStore {
    constructor(logger) {
        this.logger = logger;
        this.client = null;
        this.collections = new Map();
        
        // Configuration
        this.config = {
            persistPath: path.join(process.env.APPDATA || process.env.HOME, '.ai-browser', 'chromadb'),
            embeddingFunction: 'default', // Will use ChromaDB's default embedding
            distance: 'cosine'
        };
    }
    
    async initialize() {
        this.logger.info('[ChromaVectorStore] Initializing ChromaDB...');
        
        try {
            // Ensure storage directory exists
            await fs.mkdir(this.config.persistPath, { recursive: true });
            
            // Initialize ChromaDB client
            this.client = new ChromaClient({
                path: this.config.persistPath
            });
            
            // Load existing collections
            await this.loadCollections();
            
            this.logger.info('[ChromaVectorStore] ChromaDB initialized successfully');
        } catch (error) {
            this.logger.error('[ChromaVectorStore] Initialization failed:', error);
            throw error;
        }
    }
    
    async loadCollections() {
        try {
            const collections = await this.client.listCollections();
            
            for (const collectionInfo of collections) {
                const collection = await this.client.getCollection({
                    name: collectionInfo.name
                });
                this.collections.set(collectionInfo.name, collection);
                this.logger.info(`[ChromaVectorStore] Loaded collection: ${collectionInfo.name}`);
            }
        } catch (error) {
            this.logger.warn('[ChromaVectorStore] No existing collections found');
        }
    }
    
    async createCollection(name, metadata = {}) {
        if (this.collections.has(name)) {
            throw new Error(`Collection '${name}' already exists`);
        }
        
        try {
            const collection = await this.client.createCollection({
                name,
                metadata: {
                    ...metadata,
                    createdAt: new Date().toISOString()
                }
            });
            
            this.collections.set(name, collection);
            this.logger.info(`[ChromaVectorStore] Created collection: ${name}`);
            return collection;
        } catch (error) {
            this.logger.error(`[ChromaVectorStore] Failed to create collection: ${name}`, error);
            throw error;
        }
    }
    
    async getOrCreateCollection(name, metadata = {}) {
        if (this.collections.has(name)) {
            return this.collections.get(name);
        }
        
        try {
            const collection = await this.client.getOrCreateCollection({
                name,
                metadata: {
                    ...metadata,
                    createdAt: new Date().toISOString()
                }
            });
            
            this.collections.set(name, collection);
            return collection;
        } catch (error) {
            this.logger.error(`[ChromaVectorStore] Failed to get/create collection: ${name}`, error);
            throw error;
        }
    }
    
    async addDocuments(collectionName, documents, metadatas = [], ids = null) {
        const collection = await this.getOrCreateCollection(collectionName);
        
        // Generate IDs if not provided
        if (!ids) {
            ids = documents.map(() => this.generateId());
        }
        
        try {
            await collection.add({
                ids,
                documents,
                metadatas: metadatas.length > 0 ? metadatas : undefined
            });
            
            this.logger.info(`[ChromaVectorStore] Added ${documents.length} documents to collection: ${collectionName}`);
            return ids;
        } catch (error) {
            this.logger.error('[ChromaVectorStore] Failed to add documents:', error);
            throw error;
        }
    }
    
    async addEmbeddings(collectionName, embeddings, documents, metadatas = [], ids = null) {
        const collection = await this.getOrCreateCollection(collectionName);
        
        // Generate IDs if not provided
        if (!ids) {
            ids = embeddings.map(() => this.generateId());
        }
        
        try {
            await collection.add({
                ids,
                embeddings,
                documents,
                metadatas: metadatas.length > 0 ? metadatas : undefined
            });
            
            this.logger.info(`[ChromaVectorStore] Added ${embeddings.length} embeddings to collection: ${collectionName}`);
            return ids;
        } catch (error) {
            this.logger.error('[ChromaVectorStore] Failed to add embeddings:', error);
            throw error;
        }
    }
    
    async query(collectionName, queryTexts = null, queryEmbeddings = null, nResults = 5, where = null) {
        const collection = this.collections.get(collectionName);
        if (!collection) {
            throw new Error(`Collection '${collectionName}' not found`);
        }
        
        try {
            const queryParams = {
                nResults
            };
            
            if (queryTexts) {
                queryParams.queryTexts = Array.isArray(queryTexts) ? queryTexts : [queryTexts];
            }
            
            if (queryEmbeddings) {
                queryParams.queryEmbeddings = queryEmbeddings;
            }
            
            if (where) {
                queryParams.where = where;
            }
            
            const results = await collection.query(queryParams);
            
            // Format results for compatibility with our system
            const formattedResults = [];
            
            if (results.ids && results.ids[0]) {
                for (let i = 0; i < results.ids[0].length; i++) {
                    formattedResults.push({
                        id: results.ids[0][i],
                        score: results.distances ? 1 - results.distances[0][i] : 1, // Convert distance to similarity
                        document: results.documents[0][i],
                        metadata: results.metadatas ? results.metadatas[0][i] : {}
                    });
                }
            }
            
            return formattedResults;
        } catch (error) {
            this.logger.error('[ChromaVectorStore] Query failed:', error);
            throw error;
        }
    }
    
    async deleteDocuments(collectionName, ids) {
        const collection = this.collections.get(collectionName);
        if (!collection) {
            throw new Error(`Collection '${collectionName}' not found`);
        }
        
        try {
            await collection.delete({
                ids: Array.isArray(ids) ? ids : [ids]
            });
            
            this.logger.info(`[ChromaVectorStore] Deleted ${ids.length} documents from collection: ${collectionName}`);
        } catch (error) {
            this.logger.error('[ChromaVectorStore] Failed to delete documents:', error);
            throw error;
        }
    }
    
    async deleteCollection(name) {
        try {
            await this.client.deleteCollection({ name });
            this.collections.delete(name);
            this.logger.info(`[ChromaVectorStore] Deleted collection: ${name}`);
        } catch (error) {
            this.logger.error(`[ChromaVectorStore] Failed to delete collection: ${name}`, error);
            throw error;
        }
    }
    
    async getCollectionStats(name) {
        const collection = this.collections.get(name);
        if (!collection) {
            throw new Error(`Collection '${name}' not found`);
        }
        
        try {
            const count = await collection.count();
            const metadata = await collection.metadata;
            
            return {
                name,
                count,
                metadata
            };
        } catch (error) {
            this.logger.error(`[ChromaVectorStore] Failed to get stats for collection: ${name}`, error);
            throw error;
        }
    }
    
    async listCollections() {
        try {
            const collections = await this.client.listCollections();
            return collections.map(col => ({
                name: col.name,
                metadata: col.metadata
            }));
        } catch (error) {
            this.logger.error('[ChromaVectorStore] Failed to list collections:', error);
            throw error;
        }
    }
    
    generateId() {
        return `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    async updateDocument(collectionName, id, document = null, metadata = null, embedding = null) {
        const collection = this.collections.get(collectionName);
        if (!collection) {
            throw new Error(`Collection '${collectionName}' not found`);
        }
        
        try {
            const updateParams = {
                ids: [id]
            };
            
            if (document) {
                updateParams.documents = [document];
            }
            
            if (metadata) {
                updateParams.metadatas = [metadata];
            }
            
            if (embedding) {
                updateParams.embeddings = [embedding];
            }
            
            await collection.update(updateParams);
            this.logger.info(`[ChromaVectorStore] Updated document ${id} in collection: ${collectionName}`);
        } catch (error) {
            this.logger.error('[ChromaVectorStore] Failed to update document:', error);
            throw error;
        }
    }
    
    async getDocument(collectionName, id) {
        const collection = this.collections.get(collectionName);
        if (!collection) {
            throw new Error(`Collection '${collectionName}' not found`);
        }
        
        try {
            const result = await collection.get({
                ids: [id]
            });
            
            if (result.ids && result.ids.length > 0) {
                return {
                    id: result.ids[0],
                    document: result.documents[0],
                    metadata: result.metadatas ? result.metadatas[0] : {}
                };
            }
            
            return null;
        } catch (error) {
            this.logger.error('[ChromaVectorStore] Failed to get document:', error);
            throw error;
        }
    }
}

module.exports = ChromaVectorStore;