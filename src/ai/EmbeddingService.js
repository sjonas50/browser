/**
 * Embedding Service
 * Handles local embedding generation using Transformers.js
 */

class EmbeddingService {
    constructor(logger) {
        this.logger = logger;
        this.pipeline = null;
        this.extractor = null;
        this.modelName = 'Xenova/all-MiniLM-L6-v2';
        this.dimensions = 384;
        this.maxTokens = 256; // Model's max token limit
        this.initialized = false;
    }
    
    async initialize() {
        if (this.initialized) return;
        
        this.logger.info('[EmbeddingService] Initializing embedding model...');
        
        try {
            // Dynamically import the ES module
            const transformers = await import('@xenova/transformers');
            this.pipeline = transformers.pipeline;
            
            // Create feature extraction pipeline
            this.extractor = await this.pipeline(
                'feature-extraction', 
                this.modelName,
                { 
                    quantized: true, // Use quantized model for faster loading
                    progress_callback: (progress) => {
                        if (progress.status === 'downloading') {
                            this.logger.info(`[EmbeddingService] Downloading model: ${Math.round(progress.progress)}%`);
                        }
                    }
                }
            );
            
            // Mark as initialized before testing to avoid recursion
            this.initialized = true;
            
            // Test the model with a sample embedding
            const testEmbedding = await this.embed('test');
            if (!testEmbedding || testEmbedding.length !== this.dimensions) {
                throw new Error(`Invalid embedding dimensions: expected ${this.dimensions}, got ${testEmbedding?.length}`);
            }
            
            this.logger.info('[EmbeddingService] Embedding model initialized successfully');
        } catch (error) {
            this.logger.error('[EmbeddingService] Failed to initialize:', error);
            throw error;
        }
    }
    
    /**
     * Generate embedding for a single text
     */
    async embed(text) {
        if (!this.initialized) {
            await this.initialize();
        }
        
        if (!text || typeof text !== 'string') {
            throw new Error('Invalid text input for embedding');
        }
        
        // Truncate text if too long
        const truncatedText = this.truncateText(text);
        
        try {
            // Generate embedding with mean pooling and normalization
            const output = await this.extractor(truncatedText, { 
                pooling: 'mean', 
                normalize: true 
            });
            
            // Convert to array
            return Array.from(output.data);
        } catch (error) {
            this.logger.error('[EmbeddingService] Embedding generation failed:', error);
            throw error;
        }
    }
    
    /**
     * Generate embeddings for multiple texts
     */
    async embedBatch(texts) {
        if (!this.initialized) {
            await this.initialize();
        }
        
        if (!Array.isArray(texts)) {
            texts = [texts];
        }
        
        const embeddings = [];
        
        // Process in batches to avoid memory issues
        const batchSize = 10;
        for (let i = 0; i < texts.length; i += batchSize) {
            const batch = texts.slice(i, i + batchSize);
            
            // Truncate each text
            const truncatedBatch = batch.map(text => this.truncateText(text));
            
            try {
                // Generate embeddings for the batch
                const output = await this.extractor(truncatedBatch, { 
                    pooling: 'mean', 
                    normalize: true 
                });
                
                // Convert to nested array
                const batchEmbeddings = output.tolist();
                embeddings.push(...batchEmbeddings);
                
                // Log progress
                if (texts.length > batchSize) {
                    const progress = Math.min(100, Math.round(((i + batch.length) / texts.length) * 100));
                    this.logger.debug(`[EmbeddingService] Batch embedding progress: ${progress}%`);
                }
            } catch (error) {
                this.logger.error(`[EmbeddingService] Batch embedding failed at index ${i}:`, error);
                throw error;
            }
        }
        
        return embeddings;
    }
    
    /**
     * Calculate cosine similarity between two embeddings
     */
    cosineSimilarity(embedding1, embedding2) {
        if (embedding1.length !== embedding2.length) {
            throw new Error('Embeddings must have the same dimensions');
        }
        
        let dotProduct = 0;
        let norm1 = 0;
        let norm2 = 0;
        
        for (let i = 0; i < embedding1.length; i++) {
            dotProduct += embedding1[i] * embedding2[i];
            norm1 += embedding1[i] * embedding1[i];
            norm2 += embedding2[i] * embedding2[i];
        }
        
        norm1 = Math.sqrt(norm1);
        norm2 = Math.sqrt(norm2);
        
        if (norm1 === 0 || norm2 === 0) {
            return 0;
        }
        
        return dotProduct / (norm1 * norm2);
    }
    
    /**
     * Truncate text to fit within model's token limit
     */
    truncateText(text) {
        if (!text) return '';
        
        // Simple character-based truncation (roughly 4 chars per token)
        const maxChars = this.maxTokens * 4;
        
        if (text.length <= maxChars) {
            return text;
        }
        
        // Truncate at word boundary
        const truncated = text.substring(0, maxChars);
        const lastSpace = truncated.lastIndexOf(' ');
        
        if (lastSpace > maxChars * 0.8) {
            return truncated.substring(0, lastSpace);
        }
        
        return truncated;
    }
    
    /**
     * Split text into chunks for embedding
     */
    chunkText(text, chunkSize = 200, overlap = 50) {
        if (!text || text.length <= chunkSize) {
            return [text];
        }
        
        const chunks = [];
        let start = 0;
        
        while (start < text.length) {
            let end = start + chunkSize;
            
            // Try to break at sentence or word boundary
            if (end < text.length) {
                // Look for sentence boundary
                const sentenceEnd = text.lastIndexOf('.', end);
                if (sentenceEnd > start + chunkSize * 0.8) {
                    end = sentenceEnd + 1;
                } else {
                    // Look for word boundary
                    const wordEnd = text.lastIndexOf(' ', end);
                    if (wordEnd > start + chunkSize * 0.8) {
                        end = wordEnd;
                    }
                }
            }
            
            chunks.push(text.substring(start, Math.min(end, text.length)).trim());
            start = end - overlap;
        }
        
        return chunks.filter(chunk => chunk.length > 0);
    }
    
    /**
     * Get model information
     */
    getModelInfo() {
        return {
            name: this.modelName,
            dimensions: this.dimensions,
            maxTokens: this.maxTokens,
            initialized: this.initialized
        };
    }
}

module.exports = EmbeddingService;