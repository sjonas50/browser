// Test script for knowledge base functionality
const { app } = require('electron');
const path = require('path');
const { StorageManager } = require('./src/storage/StorageManager');
const KnowledgeBaseManager = require('./src/ai/KnowledgeBaseManager');
const winston = require('winston');

// Create logger
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message }) => {
            return `[${timestamp}] ${level}: ${message}`;
        })
    ),
    transports: [
        new winston.transports.Console()
    ]
});

async function testKnowledgeBase() {
    logger.info('Starting knowledge base test...');
    
    try {
        // Initialize managers
        const storageManager = new StorageManager();
        const knowledgeBaseManager = new KnowledgeBaseManager(storageManager, logger);
        
        await storageManager.initialize();
        await knowledgeBaseManager.initialize();
        
        logger.info('Managers initialized successfully');
        
        // Test 1: Add a document
        logger.info('Test 1: Adding a document...');
        const docContent = `
        The AI Browser is an advanced web browser that integrates artificial intelligence 
        to enhance the browsing experience. It features a personal knowledge base that 
        allows users to save and search their own documents and web pages.
        `;
        
        const docId = await knowledgeBaseManager.addDocument(docContent, {
            title: 'AI Browser Overview',
            source: 'manual',
            collection: 'personal'
        });
        
        logger.info(`Document added with ID: ${docId}`);
        
        // Test 2: Search the knowledge base
        logger.info('Test 2: Searching knowledge base...');
        const searchResults = await knowledgeBaseManager.search('AI browser features', {
            collections: ['personal'],
            limit: 5
        });
        
        logger.info(`Found ${searchResults.length} results`);
        searchResults.forEach((result, idx) => {
            logger.info(`Result ${idx + 1}: ${result.title} (score: ${result.maxScore.toFixed(3)})`);
        });
        
        // Test 3: Get stats
        logger.info('Test 3: Getting knowledge base stats...');
        const stats = await knowledgeBaseManager.getStats();
        logger.info('Stats:', JSON.stringify(stats, null, 2));
        
        // Test 4: Create a custom collection
        logger.info('Test 4: Creating custom collection...');
        await knowledgeBaseManager.createCollection('test-collection', {
            icon: '🧪',
            description: 'Test collection for development'
        });
        logger.info('Custom collection created');
        
        // Test 5: Add document to custom collection
        logger.info('Test 5: Adding document to custom collection...');
        await knowledgeBaseManager.addDocument('Test document content', {
            title: 'Test Document',
            source: 'test',
            collection: 'test-collection'
        });
        
        const updatedStats = await knowledgeBaseManager.getStats();
        logger.info('Updated stats:', JSON.stringify(updatedStats, null, 2));
        
        logger.info('All tests completed successfully!');
        
    } catch (error) {
        logger.error('Test failed:', error);
        process.exit(1);
    }
}

// Run test when app is ready
if (require.main === module) {
    app.whenReady().then(() => {
        testKnowledgeBase().then(() => {
            logger.info('Exiting...');
            app.quit();
        });
    });
}