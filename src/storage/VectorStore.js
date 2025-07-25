/**
 * Vector Store Implementation
 * Handles vector storage and similarity search for the knowledge base
 * Uses ChromaDB for persistent vector storage
 */

const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');

class VectorStore {
    constructor(storageManager, logger) {
        this.storageManager = storageManager;
        this.logger = logger;
        
        // In-memory store for development
        // Will be replaced with ChromaDB integration
        this.collections = new Map();
        
        // Configuration
        this.config = {
            persistPath: path.join(process.env.APPDATA || process.env.HOME, '.ai-browser', 'vectors'),
            defaultCollection: 'knowledge_base',
            embeddingDimension: 1536, // OpenAI ada-002 dimension
            maxResults: 100,
            indexType: 'hnsw' // Hierarchical Navigable Small World
        };
        
        this.initialize();
    }
    
    async initialize() {
        this.logger.info('[VectorStore] Initializing vector storage...');
        
        try {
            // Ensure storage directory exists
            await fs.mkdir(this.config.persistPath, { recursive: true });
            
            // Load existing collections
            await this.loadCollections();
            
            // Initialize default collection
            if (!this.collections.has(this.config.defaultCollection)) {
                await this.createCollection(this.config.defaultCollection);
            }
            
            this.logger.info('[VectorStore] Initialized successfully');
        } catch (error) {
            this.logger.error('[VectorStore] Initialization failed:', error);
            throw error;
        }
    }
    
    /**
     * Create a new collection
     */
    async createCollection(name, metadata = {}) {
        if (this.collections.has(name)) {
            throw new Error(`Collection '${name}' already exists`);
        }
        
        const collection = {
            name,
            metadata,
            vectors: new Map(),
            documents: new Map(),
            index: null, // Will hold the actual index structure
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        this.collections.set(name, collection);
        await this.saveCollection(name);
        
        this.logger.info(`[VectorStore] Created collection: ${name}`);
        return collection;
    }
    
    /**
     * Add vectors to a collection
     */
    async addVectors(collectionName, vectors, documents, metadata = []) {
        const collection = this.getCollection(collectionName);
        
        if (vectors.length !== documents.length) {
            throw new Error('Vectors and documents arrays must have the same length');
        }
        
        const ids = [];
        const timestamp = new Date().toISOString();
        
        for (let i = 0; i < vectors.length; i++) {
            const id = crypto.randomBytes(16).toString('hex');
            ids.push(id);
            
            // Store vector
            collection.vectors.set(id, {
                id,
                vector: vectors[i],
                magnitude: this.calculateMagnitude(vectors[i]),
                timestamp
            });
            
            // Store document and metadata
            collection.documents.set(id, {
                id,
                content: documents[i],
                metadata: metadata[i] || {},
                timestamp
            });
        }
        
        // Update index
        await this.updateIndex(collectionName);
        
        // Persist changes
        collection.updatedAt = timestamp;
        await this.saveCollection(collectionName);
        
        this.logger.info(`[VectorStore] Added ${vectors.length} vectors to collection: ${collectionName}`);
        return ids;
    }
    
    /**
     * Perform similarity search
     */
    async similaritySearch(collectionName, queryVector, k = 5, filter = {}) {
        const collection = this.getCollection(collectionName);
        const results = [];
        
        // Calculate similarity with all vectors
        for (const [id, vectorData] of collection.vectors.entries()) {
            const document = collection.documents.get(id);
            
            // Apply filters
            if (!this.matchesFilter(document.metadata, filter)) {
                continue;
            }
            
            // Calculate cosine similarity
            const similarity = this.cosineSimilarity(queryVector, vectorData.vector, vectorData.magnitude);
            
            results.push({
                id,
                score: similarity,
                content: document.content,
                metadata: document.metadata
            });
        }
        
        // Sort by similarity and return top k
        return results
            .sort((a, b) => b.score - a.score)
            .slice(0, Math.min(k, this.config.maxResults));
    }
    
    /**
     * Perform hybrid search (vector + keyword)
     */
    async hybridSearch(collectionName, queryVector, keywords, k = 5, filter = {}) {
        // Get vector search results
        const vectorResults = await this.similaritySearch(collectionName, queryVector, k * 2, filter);
        
        // Score based on keyword matches
        const keywordLower = keywords.toLowerCase().split(/\s+/);
        
        const hybridResults = vectorResults.map(result => {
            const content = result.content.toLowerCase();
            let keywordScore = 0;
            
            // Count keyword matches
            for (const keyword of keywordLower) {
                if (content.includes(keyword)) {
                    keywordScore += 1;
                }
            }
            
            // Normalize keyword score
            keywordScore = keywordScore / keywordLower.length;
            
            // Combine scores (70% vector, 30% keyword)
            const hybridScore = (result.score * 0.7) + (keywordScore * 0.3);
            
            return {
                ...result,
                keywordScore,
                hybridScore
            };
        });
        
        // Sort by hybrid score and return top k
        return hybridResults
            .sort((a, b) => b.hybridScore - a.hybridScore)
            .slice(0, k);
    }
    
    /**
     * Delete vectors from a collection
     */
    async deleteVectors(collectionName, ids) {
        const collection = this.getCollection(collectionName);
        
        for (const id of ids) {
            collection.vectors.delete(id);
            collection.documents.delete(id);
        }
        
        // Update index
        await this.updateIndex(collectionName);
        
        // Persist changes
        collection.updatedAt = new Date().toISOString();
        await this.saveCollection(collectionName);
        
        this.logger.info(`[VectorStore] Deleted ${ids.length} vectors from collection: ${collectionName}`);
    }
    
    /**
     * Get collection
     */
    getCollection(name) {
        const collection = this.collections.get(name);
        if (!collection) {
            throw new Error(`Collection '${name}' not found`);
        }
        return collection;
    }
    
    /**
     * List all collections
     */
    listCollections() {
        return Array.from(this.collections.keys()).map(name => {
            const collection = this.collections.get(name);
            return {
                name,
                vectorCount: collection.vectors.size,
                metadata: collection.metadata,
                createdAt: collection.createdAt,
                updatedAt: collection.updatedAt
            };
        });
    }
    
    /**
     * Calculate vector magnitude for normalization
     */
    calculateMagnitude(vector) {
        return Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    }
    
    /**
     * Calculate cosine similarity between two vectors
     */
    cosineSimilarity(vectorA, vectorB, magnitudeB = null) {
        if (vectorA.length !== vectorB.length) {
            throw new Error('Vectors must have the same dimension');
        }
        
        // Calculate dot product
        let dotProduct = 0;
        for (let i = 0; i < vectorA.length; i++) {
            dotProduct += vectorA[i] * vectorB[i];
        }
        
        // Calculate magnitudes
        const magnitudeA = this.calculateMagnitude(vectorA);
        magnitudeB = magnitudeB || this.calculateMagnitude(vectorB);
        
        // Avoid division by zero
        if (magnitudeA === 0 || magnitudeB === 0) {
            return 0;
        }
        
        // Calculate cosine similarity
        return dotProduct / (magnitudeA * magnitudeB);
    }
    
    /**
     * Check if metadata matches filter
     */
    matchesFilter(metadata, filter) {
        for (const [key, value] of Object.entries(filter)) {
            if (value === null || value === undefined) continue;
            
            // Handle array filters (e.g., { collection: { $in: ['personal', 'work'] } })
            if (typeof value === 'object' && value.$in) {
                if (!value.$in.includes(metadata[key])) {
                    return false;
                }
            }
            // Handle direct value comparison
            else if (metadata[key] !== value) {
                return false;
            }
        }
        return true;
    }
    
    /**
     * Update index for a collection (placeholder for actual indexing)
     */
    async updateIndex(collectionName) {
        // TODO: Implement actual indexing (e.g., HNSW, Annoy, or Faiss)
        // For now, we're using brute-force search
        const collection = this.getCollection(collectionName);
        collection.index = {
            type: 'brute_force',
            updated: new Date().toISOString()
        };
    }
    
    /**
     * Save collection to disk
     */
    async saveCollection(name) {
        const collection = this.collections.get(name);
        if (!collection) return;
        
        const filePath = path.join(this.config.persistPath, `${name}.json`);
        
        // Prepare data for serialization
        const data = {
            name: collection.name,
            metadata: collection.metadata,
            createdAt: collection.createdAt,
            updatedAt: collection.updatedAt,
            vectorCount: collection.vectors.size,
            // Don't save actual vectors in JSON - they should be in a binary format
            // This is just metadata
        };
        
        await fs.writeFile(filePath, JSON.stringify(data, null, 2));
        
        // Save vectors in binary format (more efficient)
        await this.saveVectorsBinary(name, collection);
    }
    
    /**
     * Save vectors in binary format
     */
    async saveVectorsBinary(name, collection) {
        const vectorsPath = path.join(this.config.persistPath, `${name}.vectors`);
        const documentsPath = path.join(this.config.persistPath, `${name}.documents`);
        
        // Convert to binary format
        const vectorsData = [];
        const documentsData = [];
        
        for (const [id, vectorData] of collection.vectors.entries()) {
            vectorsData.push({
                id,
                vector: vectorData.vector,
                magnitude: vectorData.magnitude,
                timestamp: vectorData.timestamp
            });
            
            const doc = collection.documents.get(id);
            documentsData.push({
                id,
                content: doc.content,
                metadata: doc.metadata,
                timestamp: doc.timestamp
            });
        }
        
        // Save as JSON for now (TODO: implement binary format)
        await fs.writeFile(vectorsPath, JSON.stringify(vectorsData));
        await fs.writeFile(documentsPath, JSON.stringify(documentsData));
    }
    
    /**
     * Load collections from disk
     */
    async loadCollections() {
        try {
            const files = await fs.readdir(this.config.persistPath);
            const jsonFiles = files.filter(f => f.endsWith('.json'));
            
            for (const file of jsonFiles) {
                const name = path.basename(file, '.json');
                const filePath = path.join(this.config.persistPath, file);
                
                const data = JSON.parse(await fs.readFile(filePath, 'utf8'));
                
                const collection = {
                    name: data.name,
                    metadata: data.metadata || {},
                    vectors: new Map(),
                    documents: new Map(),
                    index: null,
                    createdAt: data.createdAt,
                    updatedAt: data.updatedAt
                };
                
                // Load vectors and documents
                await this.loadVectorsBinary(name, collection);
                
                this.collections.set(name, collection);
            }
        } catch (error) {
            // Directory might not exist yet
            if (error.code !== 'ENOENT') {
                throw error;
            }
        }
    }
    
    /**
     * Load vectors from binary format
     */
    async loadVectorsBinary(name, collection) {
        try {
            const vectorsPath = path.join(this.config.persistPath, `${name}.vectors`);
            const documentsPath = path.join(this.config.persistPath, `${name}.documents`);
            
            const vectorsData = JSON.parse(await fs.readFile(vectorsPath, 'utf8'));
            const documentsData = JSON.parse(await fs.readFile(documentsPath, 'utf8'));
            
            // Restore vectors
            for (const data of vectorsData) {
                collection.vectors.set(data.id, {
                    id: data.id,
                    vector: data.vector,
                    magnitude: data.magnitude,
                    timestamp: data.timestamp
                });
            }
            
            // Restore documents
            for (const data of documentsData) {
                collection.documents.set(data.id, {
                    id: data.id,
                    content: data.content,
                    metadata: data.metadata,
                    timestamp: data.timestamp
                });
            }
        } catch (error) {
            // Files might not exist yet
            if (error.code !== 'ENOENT') {
                throw error;
            }
        }
    }
    
    /**
     * Get collection statistics
     */
    getStats(collectionName) {
        const collection = this.getCollection(collectionName);
        
        return {
            name: collection.name,
            vectorCount: collection.vectors.size,
            documentCount: collection.documents.size,
            metadata: collection.metadata,
            createdAt: collection.createdAt,
            updatedAt: collection.updatedAt,
            indexType: collection.index?.type || 'none'
        };
    }
}

module.exports = VectorStore;