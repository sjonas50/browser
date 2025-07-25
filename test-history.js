// Test script for history functionality
// Run this in the browser console to test history storage

async function testHistory() {
    console.log('=== Testing History Functionality ===\n');
    
    // Test 1: Add search to history
    console.log('1. Testing search history...');
    await window.browser.addSearchToHistory('how to build a browser', {
        sources: [{ url: 'example.com' }, { url: 'example2.com' }],
        queryAnalysis: { type: 'how_to' }
    });
    console.log('✓ Added search to history');
    
    // Test 2: Add page visit to history
    console.log('\n2. Testing page visit history...');
    await window.browser.addPageVisitToHistory('https://github.com', 'GitHub');
    console.log('✓ Added page visit to history');
    
    // Test 3: Get search history
    console.log('\n3. Getting search history...');
    const searchHistory = await window.browser.getSearchHistory(5);
    console.log('Search history:', searchHistory);
    
    // Test 4: Get full history
    console.log('\n4. Getting full history...');
    const fullHistory = await window.browser.getFullHistory(10);
    console.log('Full history:', fullHistory);
    
    // Test 5: Search history by query
    console.log('\n5. Searching history...');
    const searchResults = await window.browser.searchHistory('browser');
    console.log('Search results:', searchResults);
    
    console.log('\n=== All tests completed ===');
}

// Run the test
testHistory().catch(console.error);