// Complete test script for knowledge base functionality
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

async function testCompleteKnowledgeBase() {
    logger.info('Starting complete knowledge base test...');
    
    try {
        // Initialize managers
        const storageManager = new StorageManager();
        const knowledgeBaseManager = new KnowledgeBaseManager(storageManager, logger);
        
        await storageManager.initialize();
        await knowledgeBaseManager.initialize();
        
        logger.info('✅ Managers initialized successfully');
        
        // Test 1: Add a text document
        logger.info('\n📝 Test 1: Adding a text document...');
        const textDocId = await knowledgeBaseManager.addDocument(
            `This is a comprehensive guide to building AI-powered browsers.
            The browser integrates advanced artificial intelligence capabilities
            to enhance the browsing experience. Features include semantic search,
            intelligent suggestions, and personal knowledge management.`,
            {
                title: 'AI Browser Guide',
                source: 'manual',
                collection: 'research'
            }
        );
        logger.info(`✅ Text document added with ID: ${textDocId}`);
        
        // Test 2: Add a bookmark
        logger.info('\n⭐ Test 2: Adding a bookmark...');
        const bookmarkId = await knowledgeBaseManager.addBookmark(
            'https://example.com/ai-research',
            'AI Research Papers',
            {
                notes: 'Great collection of AI research papers',
                tags: ['ai', 'research', 'papers']
            }
        );
        logger.info(`✅ Bookmark added with ID: ${bookmarkId}`);
        
        // Test 3: Add webpage content
        logger.info('\n🌐 Test 3: Adding webpage content...');
        const htmlContent = `
            <html>
            <head><title>Machine Learning Basics</title></head>
            <body>
                <h1>Introduction to Machine Learning</h1>
                <p>Machine learning is a subset of artificial intelligence that
                enables systems to learn and improve from experience.</p>
                <h2>Types of Learning</h2>
                <ul>
                    <li>Supervised Learning</li>
                    <li>Unsupervised Learning</li>
                    <li>Reinforcement Learning</li>
                </ul>
            </body>
            </html>
        `;
        const webpageId = await knowledgeBaseManager.addWebPage(
            'https://example.com/ml-basics',
            htmlContent,
            {
                collection: 'research'
            }
        );
        logger.info(`✅ Webpage added with ID: ${webpageId}`);
        
        // Test 4: Search functionality
        logger.info('\n🔍 Test 4: Testing search functionality...');
        const searchResults = await knowledgeBaseManager.search('machine learning AI', {
            collections: ['research', 'bookmarks'],
            limit: 5
        });
        
        logger.info(`✅ Found ${searchResults.length} results:`);
        searchResults.forEach((result, idx) => {
            logger.info(`  ${idx + 1}. ${result.title} (score: ${result.maxScore.toFixed(3)})`);
            logger.info(`     Chunks: ${result.chunks.length}`);
        });
        
        // Test 5: Session storage
        logger.info('\n🕒 Test 5: Testing session storage...');
        const sessionId = 'test_session_123';
        const sessionDocId = await knowledgeBaseManager.addDocument(
            'This is a temporary session document for testing.',
            {
                title: 'Session Test Document',
                source: 'manual',
                session: sessionId
            }
        );
        logger.info(`✅ Session document added with ID: ${sessionDocId}`);
        
        // Search including session
        const sessionResults = await knowledgeBaseManager.search('session document', {
            includeSession: true,
            sessionId: sessionId,
            limit: 5
        });
        logger.info(`✅ Session search found ${sessionResults.length} results`);
        
        // Test 6: Get statistics
        logger.info('\n📊 Test 6: Getting knowledge base statistics...');
        const stats = await knowledgeBaseManager.getStats();
        logger.info('✅ Knowledge Base Statistics:');
        logger.info(`  Total documents: ${stats.totalDocuments}`);
        logger.info(`  Session documents: ${stats.sessionDocuments}`);
        logger.info(`  Active sessions: ${stats.activeSessions}`);
        logger.info('  Collections:');
        Object.entries(stats.collections).forEach(([name, data]) => {
            logger.info(`    - ${name}: ${data.documents} documents`);
        });
        
        // Test 7: Document export
        logger.info('\n📤 Test 7: Testing document export...');
        const exportData = await knowledgeBaseManager.exportDocuments('research');
        logger.info(`✅ Exported ${exportData.documents.length} documents from research collection`);
        
        // Test 8: Custom collection
        logger.info('\n📁 Test 8: Creating custom collection...');
        await knowledgeBaseManager.createCollection('my-projects', {
            icon: '🚀',
            description: 'Personal project documentation'
        });
        logger.info('✅ Custom collection created');
        
        // Test 9: Document deletion
        logger.info('\n🗑️ Test 9: Testing document deletion...');
        await knowledgeBaseManager.deleteDocument(sessionDocId);
        logger.info('✅ Document deleted successfully');
        
        // Final stats
        logger.info('\n📊 Final Statistics:');
        const finalStats = await knowledgeBaseManager.getStats();
        logger.info(`  Total documents: ${finalStats.totalDocuments}`);
        
        logger.info('\n✅ All tests completed successfully!');
        
    } catch (error) {
        logger.error('❌ Test failed:', error);
        process.exit(1);
    }
}

// Run test when app is ready
if (require.main === module) {
    app.whenReady().then(() => {
        testCompleteKnowledgeBase().then(() => {
            logger.info('Exiting...');
            app.quit();
        });
    });
}