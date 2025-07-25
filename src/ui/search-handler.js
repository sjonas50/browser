// AI-Powered Search Handler
// Combines local AI, web search, and result synthesis

class SearchHandler {
    constructor(aiHandler) {
        this.aiHandler = aiHandler;
        this.searchEngines = {
            google: 'https://www.google.com/search?q=',
            duckduckgo: 'https://duckduckgo.com/?q=',
            bing: 'https://www.bing.com/search?q='
        };
        this.activeSearchEngine = 'google';
    }

    // Determine if input is a search query or URL
    isSearchQuery(input) {
        const trimmed = input.trim();
        
        // Check for explicit protocols
        if (/^(https?:\/\/|ftp:\/\/|file:\/\/)/i.test(trimmed)) {
            return false;
        }
        
        // Check for localhost addresses
        if (/^localhost(:\d+)?/i.test(trimmed)) {
            return false;
        }
        
        // Check for IP addresses
        if (/^(\d{1,3}\.){3}\d{1,3}(:\d+)?/.test(trimmed)) {
            return false;
        }
        
        // Check if it looks like a domain - much more permissive
        // Pattern: optional www, domain name, dot, TLD (2+ letters), optional path
        const domainPattern = /^(www\.)?[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}(\/.*)?$/i;
        
        if (domainPattern.test(trimmed)) {
            console.log(`[SearchHandler] Detected as URL: ${trimmed}`);
            return false;
        }
        
        // Check for file paths
        if (/^[a-zA-Z]:\\|^\//.test(trimmed)) {
            return false;
        }
        
        // If it has spaces, it's definitely a search
        if (trimmed.includes(' ')) {
            console.log(`[SearchHandler] Detected as search (has spaces): ${trimmed}`);
            return true;
        }
        
        // If it has a dot and no spaces, check more carefully
        if (trimmed.includes('.')) {
            // Split by dots and check structure
            const parts = trimmed.split('.');
            
            // If there are at least 2 parts and the last part is 2+ letters, it's likely a domain
            if (parts.length >= 2 && /^[a-zA-Z]{2,}$/.test(parts[parts.length - 1])) {
                console.log(`[SearchHandler] Detected as URL (domain-like): ${trimmed}`);
                return false;
            }
        }
        
        // Everything else is treated as a search
        console.log(`[SearchHandler] Detected as search query: ${trimmed}`);
        return true;
    }

    // Process AI-powered search
    async processAISearch(query, onProgress) {
        const progress = (step, detail) => {
            console.log(`[SearchHandler] ${step}: ${detail}`);
            if (onProgress) onProgress(step, detail);
        };

        try {
            // Step 1: Get initial AI response with knowledge base context
            progress('analyzing', `🤔 Analyzing your question: "${query}"`);
            progress('knowledge-search', `📚 Searching your personal knowledge base...`);
            
            // This will go through the main process AIManager which includes knowledge base
            const initialResponse = await this.aiHandler.processQuery(
                `Answer this question concisely: ${query}`,
                { 
                    isSearch: true,
                    includeKnowledge: true,
                    searchQuery: query 
                }
            );
            progress('initial-response', `✅ Initial AI response generated with knowledge base context`);

            // Step 2: Perform web search
            progress('searching', `🔍 Searching the web for: "${query}"`);
            const searchResults = await this.performWebSearch(query);
            progress('search-complete', `📊 Found ${searchResults.length} relevant results`);

            // Step 3: Synthesize results
            progress('synthesizing', `🧠 Comparing AI answer with web results...`);
            const finalAnswer = await this.synthesizeResults(
                query,
                initialResponse,
                searchResults
            );
            progress('complete', `✨ Analysis complete!`);

            return {
                query: query,
                aiResponse: initialResponse,
                webResults: searchResults,
                finalAnswer: finalAnswer,
                searchUrl: this.getSearchUrl(query),
                steps: [
                    { step: 'Initial Analysis', content: initialResponse },
                    { step: 'Web Results', content: `Found ${searchResults.length} sources` },
                    { step: 'Final Answer', content: finalAnswer }
                ]
            };
        } catch (error) {
            console.error('AI search failed:', error);
            progress('error', `❌ Error: ${error.message}`);
            // Fallback to regular web search
            return {
                query: query,
                error: error.message,
                searchUrl: this.getSearchUrl(query)
            };
        }
    }

    // Perform web search and extract results
    async performWebSearch(query) {
        const searchUrl = this.getSearchUrl(query);
        
        // Create a hidden webview to fetch search results
        const searchWebview = document.createElement('webview');
        searchWebview.style.display = 'none';
        searchWebview.setAttribute('preload', 'false');
        searchWebview.setAttribute('nodeintegration', 'false');
        document.body.appendChild(searchWebview);

        return new Promise((resolve) => {
            let results = [];
            
            searchWebview.addEventListener('did-finish-load', async () => {
                try {
                    // Extract search results from the page
                    const extractedResults = await searchWebview.executeJavaScript(`
                        (function() {
                            const results = [];
                            
                            // Google search results
                            const googleResults = document.querySelectorAll('.g');
                            googleResults.forEach((result, index) => {
                                if (index < 5) { // Get top 5 results
                                    const titleEl = result.querySelector('h3');
                                    const linkEl = result.querySelector('a');
                                    const snippetEl = result.querySelector('.VwiC3b, .yXK7lf');
                                    
                                    if (titleEl && linkEl) {
                                        results.push({
                                            title: titleEl.textContent,
                                            url: linkEl.href,
                                            snippet: snippetEl ? snippetEl.textContent : ''
                                        });
                                    }
                                }
                            });
                            
                            // DuckDuckGo results
                            const ddgResults = document.querySelectorAll('.result');
                            ddgResults.forEach((result, index) => {
                                if (index < 5) {
                                    const titleEl = result.querySelector('.result__title');
                                    const linkEl = result.querySelector('.result__url');
                                    const snippetEl = result.querySelector('.result__snippet');
                                    
                                    if (titleEl && linkEl) {
                                        results.push({
                                            title: titleEl.textContent,
                                            url: linkEl.href || linkEl.textContent,
                                            snippet: snippetEl ? snippetEl.textContent : ''
                                        });
                                    }
                                }
                            });
                            
                            return results;
                        })();
                    `);
                    
                    results = extractedResults;
                } catch (error) {
                    console.error('Failed to extract search results:', error);
                }
                
                // Clean up
                searchWebview.remove();
                resolve(results);
            });
            
            searchWebview.addEventListener('did-fail-load', () => {
                searchWebview.remove();
                resolve(results);
            });
            
            // Set a timeout
            setTimeout(() => {
                searchWebview.remove();
                resolve(results);
            }, 5000);
            
            // Load the search URL
            searchWebview.src = searchUrl;
        });
    }

    // Synthesize AI response with web results
    async synthesizeResults(query, aiResponse, webResults) {
        if (!this.aiHandler || webResults.length === 0) {
            return aiResponse;
        }

        try {
            // Prepare web results summary
            const webSummary = webResults
                .slice(0, 3)
                .map((r, i) => `${i + 1}. ${r.title}: ${r.snippet}`)
                .join('\n');

            // Ask AI to synthesize
            const synthesisPrompt = `
Original question: ${query}

Your initial answer (which may include personal knowledge base information): ${aiResponse}

Top web search results:
${webSummary}

Based on the web results AND any personal knowledge base information, provide an updated, comprehensive answer that:
1. Prioritizes information from the personal knowledge base when available
2. Corrects any inaccuracies using web results
3. Adds relevant information from the web results
4. Clearly distinguishes between personal knowledge and web sources
5. Remains concise and directly answers the question

Updated answer:`;

            const synthesizedAnswer = await this.aiHandler.processQuery(
                synthesisPrompt,
                { 
                    isSearch: true, 
                    synthesis: true,
                    includeKnowledge: true,
                    searchQuery: query
                }
            );

            return synthesizedAnswer;
        } catch (error) {
            console.error('Failed to synthesize results:', error);
            return aiResponse; // Fallback to initial response
        }
    }

    // Get search URL for the query
    getSearchUrl(query) {
        const encoded = encodeURIComponent(query);
        return this.searchEngines[this.activeSearchEngine] + encoded;
    }

    // Format search results for display
    formatSearchResults(searchData) {
        if (searchData.error) {
            return [{
                type: 'error',
                content: `Search failed: ${searchData.error}. Click here to search manually.`,
                url: searchData.searchUrl
            }];
        }

        const sections = [];

        // Thought process section
        if (searchData.steps) {
            sections.push({
                type: 'thought-process',
                title: '🧠 AI Thought Process',
                steps: searchData.steps,
                hasKnowledgeBase: searchData.usedKnowledgeBase
            });
        }

        // AI Answer section
        if (searchData.finalAnswer) {
            sections.push({
                type: 'ai-answer',
                title: searchData.usedKnowledgeBase ? '✨ Final Answer (📚 + 🌐)' : '✨ Final Answer',
                content: searchData.finalAnswer,
                sources: searchData.knowledgeSources
            });
        }

        // Knowledge base results section
        if (searchData.knowledgeResults && searchData.knowledgeResults.length > 0) {
            sections.push({
                type: 'knowledge-results',
                title: '📚 From Your Knowledge Base',
                results: searchData.knowledgeResults
            });
        }

        // Web results section
        if (searchData.webResults && searchData.webResults.length > 0) {
            sections.push({
                type: 'web-results',
                title: '🔍 Web Sources',
                results: searchData.webResults.slice(0, 3)
            });
        }

        // Search more link
        sections.push({
            type: 'search-more',
            content: 'View all web search results',
            url: searchData.searchUrl
        });

        return sections;
    }
}

export default SearchHandler;