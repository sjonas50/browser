const { EventEmitter } = require('events');
const ClaudeHandler = require('./claude-handler');
const winston = require('winston');

class AIManager extends EventEmitter {
  constructor() {
    super();
    this.models = new Map();
    this.activeModel = null;
    this.claudeHandler = null;
    this.config = {
      defaultModel: 'claude-opus-4-20250514',  // Claude 4 Opus
      maxTokens: 2048,
      temperature: 0.7,
      useClaudeAPI: true,
      cacheSize: 100
    };
    this.queryCache = new Map();
    
    // Initialize logger
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message }) => {
          return `[${timestamp}] [AIManager] ${level}: ${message}`;
        })
      ),
      transports: [
        new winston.transports.Console()
      ]
    });
  }

  async initialize() {
    this.logger.info('Initializing AI Manager...');
    
    try {
      if (this.config.useClaudeAPI) {
        // Initialize Claude API handler
        this.claudeHandler = new ClaudeHandler();
        this.logger.info('Claude API handler initialized');
      }
      
      this.emit('initialized');
      this.logger.info('AI Manager initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize AI Manager:', error);
      throw error;
    }
  }

  async loadModel(modelName) {
    try {
      console.log(`Loading model: ${modelName}`);
      
      // Model loading will be handled by WebLLM in renderer
      this.activeModel = modelName;
      this.emit('model-loaded', modelName);
      
      return {
        success: true,
        model: modelName,
        message: `Model ${modelName} loaded successfully`
      };
    } catch (error) {
      console.error(`Failed to load model ${modelName}:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async processQuery(query, context = {}) {
    const startTime = Date.now();
    // Check cache first
    const cacheKey = this.generateCacheKey(query, context);
    
    this.logger.info('Processing query', { 
      query: query.substring(0, 50) + '...', 
      hasContext: !!context.url 
    });
    
    if (this.queryCache.has(cacheKey)) {
      this.logger.debug('Returning cached response');
      return this.queryCache.get(cacheKey);
    }

    try {
      // Privacy check
      const sanitizedQuery = this.sanitizeQuery(query);
      
      let response;
      
      if (this.config.useClaudeAPI && this.claudeHandler) {
        // Use Claude API
        this.logger.debug('Using Claude API for query');
        response = await this.claudeHandler.processQuery(sanitizedQuery, context);
      } else {
        // Fallback to local model simulation
        this.logger.warn('Claude API not available, using fallback');
        const complexity = this.assessQueryComplexity(sanitizedQuery);
        const model = this.selectModelByComplexity(complexity);
        const result = await this.runInference(sanitizedQuery, context, model);
        response = result.response;
      }
      
      // Cache response
      this.cacheResponse(cacheKey, response);
      
      const elapsed = Date.now() - startTime;
      this.logger.info(`Query processed in ${elapsed}ms`);
      
      return response;
    } catch (error) {
      this.logger.error('Query processing failed:', error);
      return `Error: ${error.message}. Please check if ANTHROPIC_API_KEY is set.`;
    }
  }

  async runInference(query, context, model) {
    // This will be replaced with actual WebLLM inference
    return {
      success: true,
      response: `AI response to: ${query}`,
      model: model,
      tokens: 0,
      processingTime: 0
    };
  }

  assessQueryComplexity(query) {
    const wordCount = query.split(' ').length;
    
    if (wordCount < 10) return 'simple';
    if (wordCount < 50) return 'medium';
    return 'complex';
  }

  selectModelByComplexity(complexity) {
    const modelMap = {
      'simple': 'Llama-3.2-1B-Instruct',
      'medium': 'Llama-3.2-3B-Instruct',
      'complex': 'Llama-3.1-8B-Instruct'
    };
    
    return modelMap[complexity] || this.config.defaultModel;
  }

  sanitizeQuery(query) {
    // Remove potential PII and sensitive data
    return query
      .replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[SSN]')
      .replace(/\b\d{16}\b/g, '[CARD]')
      .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL]');
  }

  generateCacheKey(query, context) {
    return `${query}-${JSON.stringify(context)}`;
  }

  cacheResponse(key, response) {
    if (this.queryCache.size >= this.config.cacheSize) {
      const firstKey = this.queryCache.keys().next().value;
      this.queryCache.delete(firstKey);
    }
    this.queryCache.set(key, response);
  }

  async shutdown() {
    this.queryCache.clear();
    this.models.clear();
    this.emit('shutdown');
  }
}

module.exports = { AIManager };