// AI Browser Assistant - True AI-powered browsing experience
// Provides deep search, page analysis, and intelligent browsing

class AIBrowserAssistant {
    constructor(aiHandler) {
        this.aiHandler = aiHandler;
        this.searchCache = new Map();
        this.pageAnalysisCache = new Map();
        this.browsingHistory = [];
        this.searchEngines = {
            google: 'https://www.google.com/search?q=',
            duckduckgo: 'https://duckduckgo.com/?q=',
            bing: 'https://www.bing.com/search?q='
        };
        
        // Initialize search service
        this.initializeSearchService();
    }
    
    async initializeSearchService() {
        try {
            // Try to get the search service from the main process
            if (window.electronAPI && window.electronAPI.search) {
                this.searchService = {
                    search: async (query) => {
                        return await window.electronAPI.search.query(query);
                    }
                };
                console.log('[AIBrowserAssistant] Using main process search service');
            } else {
                console.log('[AIBrowserAssistant] Search service not available, using webview fallback');
            }
        } catch (error) {
            console.error('[AIBrowserAssistant] Failed to initialize search service:', error);
        }
    }

    // Enhanced search that actually fetches and analyzes content
    async performDeepSearch(query, onProgress) {
        const progress = (step, detail) => {
            console.log(`[AIBrowserAssistant] ${step}: ${detail}`);
            if (onProgress) onProgress(step, detail);
        };

        try {
            // Step 1: Understand the query intent
            progress('understanding', `🧠 Understanding your query: "${query}"`);
            const queryAnalysis = await this.analyzeQueryIntent(query);
            progress('intent', `📋 Query type: ${queryAnalysis.type}, Topics: ${queryAnalysis.topics.join(', ')}`);

            // Step 2: Generate search strategy
            progress('planning', `📍 Planning search strategy...`);
            const searchStrategy = await this.generateSearchStrategy(query, queryAnalysis);
            
            // Step 3: Perform multiple searches if needed
            progress('searching', `🔍 Searching across multiple sources...`);
            const searchResults = await this.performMultiSourceSearch(searchStrategy, progress);
            
            // Step 4: Fetch and analyze actual content
            progress('fetching', `📄 Fetching and analyzing web pages...`);
            const analyzedContent = await this.fetchAndAnalyzeContent(searchResults, queryAnalysis, progress);
            
            // Step 5: Synthesize comprehensive answer
            progress('synthesizing', `✨ Creating comprehensive answer...`);
            const finalAnswer = await this.synthesizeDeepAnswer(query, queryAnalysis, analyzedContent);
            
            progress('complete', `🎯 Analysis complete!`);

            return {
                query: query,
                queryAnalysis: queryAnalysis,
                searchStrategy: searchStrategy,
                sources: analyzedContent.sources,
                deepAnswer: finalAnswer,
                suggestions: await this.generateFollowUpSuggestions(query, finalAnswer),
                visualData: this.extractVisualData(analyzedContent)
            };
        } catch (error) {
            console.error('[AIBrowserAssistant] Deep search failed:', error);
            progress('error', `❌ Error: ${error.message}`);
            throw error;
        }
    }

    // Analyze the intent behind the query
    async analyzeQueryIntent(query) {
        const prompt = `Analyze this search query and provide a structured analysis:
Query: "${query}"

Provide your analysis in this exact JSON format:
{
    "type": "one of: factual_question, research_topic, navigation_request, comparison, how_to, opinion_seeking, current_events",
    "topics": ["main topic 1", "main topic 2"],
    "depth_required": "one of: quick_answer, moderate_research, deep_research",
    "time_sensitivity": "one of: current, recent, historical, timeless",
    "suggested_sources": ["source type 1", "source type 2"]
}`;

        try {
            const response = await this.aiHandler.processQuery(prompt, { isAnalysis: true });
            return JSON.parse(response);
        } catch (error) {
            // Fallback analysis
            return {
                type: "factual_question",
                topics: [query],
                depth_required: "moderate_research",
                time_sensitivity: "timeless",
                suggested_sources: ["general_web", "authoritative_sites"]
            };
        }
    }

    // Generate a search strategy based on query analysis
    async generateSearchStrategy(query, queryAnalysis) {
        const strategies = {
            factual_question: [
                `${query} site:wikipedia.org`,
                `${query} explanation`,
                `${query} facts`
            ],
            research_topic: [
                `${query} research papers`,
                `${query} comprehensive guide`,
                `${query} latest developments`
            ],
            how_to: [
                `${query} step by step`,
                `${query} tutorial`,
                `${query} guide`
            ],
            current_events: [
                `${query} news today`,
                `${query} latest updates`,
                `${query} breaking`
            ],
            comparison: [
                `${query} vs comparison`,
                `${query} differences`,
                `${query} pros and cons`
            ]
        };

        const baseStrategy = strategies[queryAnalysis.type] || [`${query}`];
        
        // Add time-based modifiers
        if (queryAnalysis.time_sensitivity === 'current') {
            baseStrategy.push(`${query} ${new Date().getFullYear()}`);
        }

        return {
            queries: baseStrategy,
            sources: queryAnalysis.suggested_sources,
            depth: queryAnalysis.depth_required
        };
    }

    // Perform searches across multiple sources
    async performMultiSourceSearch(strategy, progressCallback) {
        const allResults = [];
        
        // Check if we have search service available
        if (this.searchService) {
            // Use the search API service
            progressCallback('subsearch', `🔎 Using search API service...`);
            
            // Check if we need rate limiting info
            try {
                const providers = await window.electronAPI.search.getProviders();
                const currentProvider = providers[0]; // Assuming first is active
                
                if (currentProvider === 'brave') {
                    progressCallback('info', `ℹ️ Using Brave Search (rate limited to 1 query/second)`);
                }
            } catch (e) {
                // Ignore if can't get provider info
            }
            
            // Sequential search for rate-limited APIs
            for (const searchQuery of strategy.queries) {
                try {
                    const results = await this.searchService.search(searchQuery);
                    progressCallback('subsearch', `🔎 API: "${searchQuery}" - Found ${results.length} results`);
                    allResults.push(...results);
                } catch (error) {
                    console.error('[AIBrowserAssistant] Search API failed:', error);
                    progressCallback('subsearch', `⚠️ Search API failed for: "${searchQuery}"`);
                }
            }
        } else {
            // Fallback to webview-based search
            const searchEngines = ['google', 'duckduckgo'];
            progressCallback('subsearch', `🔎 Using webview fallback (less reliable)...`);
            
            // Perform searches in parallel for better performance
            const searchPromises = [];
            
            for (const searchQuery of strategy.queries) {
                // Search across multiple engines for comprehensive results
                for (const engine of searchEngines) {
                    searchPromises.push(
                        this.fetchSearchResultsFromEngine(searchQuery, engine)
                            .then(results => {
                                progressCallback('subsearch', `🔎 ${engine}: "${searchQuery}" - Found ${results.length} results`);
                                return results;
                            })
                            .catch(err => {
                                console.error(`Search failed for ${engine}:`, err);
                                return [];
                            })
                    );
                }
            }
            
            // Wait for all searches to complete
            const searchBatches = await Promise.all(searchPromises);
            
            // Flatten all results
            for (const batch of searchBatches) {
                allResults.push(...batch);
            }
        }

        // Remove duplicates and rank by relevance
        const uniqueResults = this.deduplicateAndRank(allResults);
        
        progressCallback('found', `📊 Found ${uniqueResults.length} unique sources`);
        
        // If no results found, provide helpful message
        if (uniqueResults.length === 0) {
            progressCallback('warning', `⚠️ No search results found. Consider configuring a search API for better results.`);
            
            // Add a system message
            uniqueResults.push({
                title: 'Configure Search API for Better Results',
                url: '',
                snippet: 'To enable comprehensive web search, add one of these to your .env file: GOOGLE_SEARCH_API_KEY, BRAVE_SEARCH_API_KEY, or use the built-in DuckDuckGo instant answers.',
                source: 'system',
                relevance: 1
            });
        }
        
        return uniqueResults.slice(0, 15); // Top 15 results for deep research
    }

    // Fetch results from a specific search engine
    async fetchSearchResultsFromEngine(searchQuery, engine) {
        const searchUrl = this.searchEngines[engine] + encodeURIComponent(searchQuery);
        
        // Create a hidden webview to fetch real search results
        const searchWebview = document.createElement('webview');
        searchWebview.style.display = 'none';
        searchWebview.setAttribute('preload', 'false');
        searchWebview.setAttribute('nodeintegration', 'false');
        searchWebview.setAttribute('webpreferences', 'contextIsolation=true, javascript=true');
        searchWebview.setAttribute('partition', `persist:search-${engine}`);
        searchWebview.setAttribute('useragent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
        document.body.appendChild(searchWebview);
        
        console.log(`[AIBrowserAssistant] Creating webview for ${engine} search: ${searchUrl}`);

        return new Promise((resolve) => {
            let results = [];
            let resolved = false;
            
            const cleanup = () => {
                if (!resolved) {
                    resolved = true;
                    searchWebview.remove();
                }
            };
            
            searchWebview.addEventListener('did-finish-load', async () => {
                try {
                    const currentUrl = searchWebview.getURL();
                    console.log(`[AIBrowserAssistant] ${engine} search loaded: ${currentUrl}`);
                    
                    // Wait a bit for dynamic content to load
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    
                    // Extract search results based on engine
                    const extractScript = this.getExtractionScript(engine);
                    const extractedResults = await searchWebview.executeJavaScript(extractScript);
                    
                    console.log(`[AIBrowserAssistant] ${engine} extracted ${extractedResults.length} results`);
                    
                    results = extractedResults.map(r => ({
                        ...r,
                        source: engine,
                        searchQuery: searchQuery
                    }));
                } catch (error) {
                    console.error(`[AIBrowserAssistant] Failed to extract ${engine} results:`, error);
                    console.error('Error details:', error.stack);
                }
                
                cleanup();
                resolve(results);
            });
            
            searchWebview.addEventListener('did-fail-load', (event) => {
                console.error(`[AIBrowserAssistant] ${engine} search failed to load:`, {
                    errorCode: event.errorCode,
                    errorDescription: event.errorDescription,
                    validatedURL: event.validatedURL,
                    isMainFrame: event.isMainFrame
                });
                cleanup();
                resolve(results);
            });
            
            // Set a timeout
            setTimeout(() => {
                cleanup();
                resolve(results);
            }, 7000);
            
            // Load the search URL
            searchWebview.src = searchUrl;
        });
    }

    // Get extraction script for specific search engine
    getExtractionScript(engine) {
        const scripts = {
            google: `
                (function() {
                    const results = [];
                    const googleResults = document.querySelectorAll('.g');
                    googleResults.forEach((result, index) => {
                        if (index < 8) {
                            const titleEl = result.querySelector('h3');
                            const linkEl = result.querySelector('a');
                            const snippetEl = result.querySelector('.VwiC3b, .yXK7lf, .lEBKkf');
                            
                            if (titleEl && linkEl && linkEl.href && !linkEl.href.includes('google.com')) {
                                results.push({
                                    title: titleEl.textContent,
                                    url: linkEl.href,
                                    snippet: snippetEl ? snippetEl.textContent : ''
                                });
                            }
                        }
                    });
                    return results;
                })();
            `,
            duckduckgo: `
                (function() {
                    const results = [];
                    const ddgResults = document.querySelectorAll('.result');
                    ddgResults.forEach((result, index) => {
                        if (index < 8) {
                            const titleEl = result.querySelector('.result__title');
                            const linkEl = result.querySelector('.result__url');
                            const snippetEl = result.querySelector('.result__snippet');
                            
                            if (titleEl && linkEl) {
                                const url = linkEl.href || ('https://' + linkEl.textContent.trim());
                                results.push({
                                    title: titleEl.textContent,
                                    url: url,
                                    snippet: snippetEl ? snippetEl.textContent : ''
                                });
                            }
                        }
                    });
                    return results;
                })();
            `,
            bing: `
                (function() {
                    const results = [];
                    const bingResults = document.querySelectorAll('.b_algo');
                    bingResults.forEach((result, index) => {
                        if (index < 8) {
                            const titleEl = result.querySelector('h2 a');
                            const snippetEl = result.querySelector('.b_caption p');
                            
                            if (titleEl && titleEl.href) {
                                results.push({
                                    title: titleEl.textContent,
                                    url: titleEl.href,
                                    snippet: snippetEl ? snippetEl.textContent : ''
                                });
                            }
                        }
                    });
                    return results;
                })();
            `
        };
        
        return scripts[engine] || scripts.google;
    }

    // Fetch actual search results using a headless approach
    async fetchSearchResults(searchQuery) {
        const searchUrl = this.searchEngines.google + encodeURIComponent(searchQuery);
        
        // Create a hidden webview to fetch real search results
        const searchWebview = document.createElement('webview');
        searchWebview.style.display = 'none';
        searchWebview.setAttribute('preload', 'false');
        searchWebview.setAttribute('nodeintegration', 'false');
        searchWebview.setAttribute('partition', 'persist:search');
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
                                if (index < 8) { // Get top 8 results for deep search
                                    const titleEl = result.querySelector('h3');
                                    const linkEl = result.querySelector('a');
                                    const snippetEl = result.querySelector('.VwiC3b, .yXK7lf, .lEBKkf');
                                    
                                    if (titleEl && linkEl && linkEl.href && !linkEl.href.includes('google.com')) {
                                        results.push({
                                            title: titleEl.textContent,
                                            url: linkEl.href,
                                            snippet: snippetEl ? snippetEl.textContent : '',
                                            source: 'google'
                                        });
                                    }
                                }
                            });
                            
                            // If no Google results, try DuckDuckGo format
                            if (results.length === 0) {
                                const ddgResults = document.querySelectorAll('.result');
                                ddgResults.forEach((result, index) => {
                                    if (index < 8) {
                                        const titleEl = result.querySelector('.result__title');
                                        const linkEl = result.querySelector('.result__url');
                                        const snippetEl = result.querySelector('.result__snippet');
                                        
                                        if (titleEl && linkEl) {
                                            const url = linkEl.href || ('https://' + linkEl.textContent);
                                            results.push({
                                                title: titleEl.textContent,
                                                url: url,
                                                snippet: snippetEl ? snippetEl.textContent : '',
                                                source: 'duckduckgo'
                                            });
                                        }
                                    }
                                });
                            }
                            
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

    // Fetch and analyze actual web page content
    async fetchAndAnalyzeContent(searchResults, queryAnalysis, progressCallback) {
        const analyzedPages = [];
        const maxPages = Math.min(searchResults.length, 5); // Analyze top 5 pages
        
        for (let i = 0; i < maxPages; i++) {
            const result = searchResults[i];
            progressCallback('analyzing', `📖 Analyzing page ${i + 1}/${maxPages}: ${result.title}`);
            
            try {
                // Fetch actual page content
                const pageContent = await this.fetchPageContent(result.url);
                if (pageContent) {
                    const pageAnalysis = await this.analyzePage(result, queryAnalysis, pageContent);
                    analyzedPages.push(pageAnalysis);
                }
            } catch (error) {
                console.error(`Failed to analyze ${result.url}:`, error);
            }
        }
        
        return {
            sources: analyzedPages,
            totalAnalyzed: analyzedPages.length
        };
    }

    // Fetch actual page content
    async fetchPageContent(url) {
        return new Promise((resolve) => {
            const webview = document.createElement('webview');
            webview.style.display = 'none';
            webview.setAttribute('preload', 'false');
            webview.setAttribute('nodeintegration', 'false');
            webview.setAttribute('partition', 'persist:fetch');
            document.body.appendChild(webview);

            let resolved = false;
            const cleanup = () => {
                if (!resolved) {
                    resolved = true;
                    webview.remove();
                }
            };

            webview.addEventListener('did-finish-load', async () => {
                try {
                    // Extract text content from the page
                    const content = await webview.executeJavaScript(`
                        (function() {
                            // Remove script and style elements
                            const scripts = document.querySelectorAll('script, style, noscript');
                            scripts.forEach(el => el.remove());
                            
                            // Get main content areas
                            const contentSelectors = [
                                'main', 'article', '[role="main"]', '.content', '#content',
                                '.post', '.entry-content', '.article-body'
                            ];
                            
                            let mainContent = '';
                            for (const selector of contentSelectors) {
                                const element = document.querySelector(selector);
                                if (element) {
                                    mainContent = element.innerText;
                                    break;
                                }
                            }
                            
                            // Fallback to body if no main content found
                            if (!mainContent) {
                                mainContent = document.body.innerText;
                            }
                            
                            // Get meta description
                            const metaDesc = document.querySelector('meta[name="description"]');
                            const description = metaDesc ? metaDesc.content : '';
                            
                            // Limit content length
                            const maxLength = 5000;
                            if (mainContent.length > maxLength) {
                                mainContent = mainContent.substring(0, maxLength) + '...';
                            }
                            
                            return {
                                title: document.title,
                                description: description,
                                content: mainContent,
                                url: window.location.href
                            };
                        })();
                    `);
                    
                    cleanup();
                    resolve(content);
                } catch (error) {
                    console.error('Failed to extract page content:', error);
                    cleanup();
                    resolve(null);
                }
            });

            webview.addEventListener('did-fail-load', () => {
                cleanup();
                resolve(null);
            });

            // Timeout after 10 seconds
            setTimeout(() => {
                cleanup();
                resolve(null);
            }, 10000);

            webview.src = url;
        });
    }

    // Analyze a single page in context of the query
    async analyzePage(pageInfo, queryAnalysis, pageContent) {
        const contentToAnalyze = pageContent ? pageContent.content : pageInfo.snippet;
        const actualTitle = pageContent ? pageContent.title : pageInfo.title;
        
        const prompt = `Analyze this web page content in the context of the user's query.

Query context:
- Topics: ${queryAnalysis.topics.join(', ')}
- Query type: ${queryAnalysis.type}
- Depth required: ${queryAnalysis.depth_required}

Web page:
Title: ${actualTitle}
URL: ${pageInfo.url}
${pageContent && pageContent.description ? `Description: ${pageContent.description}` : ''}

Content:
${contentToAnalyze}

Provide a structured analysis:
1. Key relevant information that answers the query
2. Important facts, data, or insights
3. How credible/authoritative this source appears
4. What aspects of the query this source addresses
5. Any limitations or gaps in the information

Be specific and cite actual content from the page.`;

        const analysis = await this.aiHandler.processQuery(prompt, { 
            isPageAnalysis: true,
            url: pageInfo.url,
            includeKnowledge: true
        });

        return {
            url: pageInfo.url,
            title: actualTitle,
            snippet: pageInfo.snippet,
            analysis: analysis,
            relevance: pageInfo.relevance || 0.8,
            hasFullContent: !!pageContent
        };
    }

    // Synthesize a comprehensive answer from all sources
    async synthesizeDeepAnswer(query, queryAnalysis, analyzedContent) {
        const sourceSummaries = analyzedContent.sources
            .map((s, i) => `Source ${i + 1} (${s.title}): ${s.analysis}`)
            .join('\n\n');

        const prompt = `Create a comprehensive answer to: "${query}"

Query analysis:
- Type: ${queryAnalysis.type}
- Topics: ${queryAnalysis.topics.join(', ')}
- Depth required: ${queryAnalysis.depth_required}

Information from ${analyzedContent.sources.length} analyzed web sources:
${sourceSummaries}

IMPORTANT: Also incorporate any relevant information from the user's personal knowledge base if it was included in the search.

Provide a ${queryAnalysis.depth_required === 'deep_research' ? 'detailed and thorough' : 'clear and concise'} answer that:
1. Directly addresses the query
2. Synthesizes information from all sources (both web and personal knowledge)
3. Clearly distinguishes between web sources and personal knowledge base
4. Highlights key insights and patterns
5. Mentions any important caveats, limitations, or conflicting information
6. Uses clear formatting with sections if appropriate
7. Includes source citations where specific facts are mentioned

Make this a truly helpful, authoritative answer that leverages both internet research and personal knowledge.`;

        return await this.aiHandler.processQuery(prompt, { 
            isSynthesis: true,
            includeKnowledge: true,
            searchQuery: query,
            maxTokens: 2048 
        });
    }

    // Generate follow-up suggestions
    async generateFollowUpSuggestions(query, answer) {
        const prompt = `Based on this query: "${query}"
And the answer provided, suggest 3-4 intelligent follow-up questions or related topics the user might want to explore.

Make suggestions that:
1. Dive deeper into specific aspects
2. Explore related concepts
3. Address potential next steps
4. Consider practical applications

Format as a simple array of strings.`;

        try {
            const response = await this.aiHandler.processQuery(prompt, { isSuggestion: true });
            return response.split('\n').filter(s => s.trim()).slice(0, 4);
        } catch (error) {
            return [
                `Learn more about ${query}`,
                `${query} examples`,
                `${query} best practices`,
                `Related topics to ${query}`
            ];
        }
    }

    // Extract visual data for potential visualization
    extractVisualData(analyzedContent) {
        return {
            sourceCount: analyzedContent.sources.length,
            topicDistribution: this.calculateTopicDistribution(analyzedContent),
            relevanceScores: analyzedContent.sources.map(s => s.relevance),
            timestamp: new Date().toISOString()
        };
    }

    // Helper methods
    deduplicateAndRank(results) {
        // Group by URL to handle duplicates
        const urlMap = new Map();
        
        results.forEach(result => {
            const normalizedUrl = this.normalizeUrl(result.url);
            
            if (!urlMap.has(normalizedUrl)) {
                urlMap.set(normalizedUrl, {
                    ...result,
                    sources: [result.source],
                    searchQueries: [result.searchQuery],
                    occurrences: 1
                });
            } else {
                const existing = urlMap.get(normalizedUrl);
                existing.sources.push(result.source);
                existing.searchQueries.push(result.searchQuery);
                existing.occurrences++;
                
                // Keep the best snippet (longest)
                if (result.snippet && result.snippet.length > (existing.snippet || '').length) {
                    existing.snippet = result.snippet;
                }
            }
        });
        
        // Convert to array and calculate relevance scores
        return Array.from(urlMap.values())
            .map(result => ({
                ...result,
                // Calculate relevance based on multiple factors
                relevance: this.calculateRelevance(result)
            }))
            .sort((a, b) => b.relevance - a.relevance);
    }
    
    normalizeUrl(url) {
        try {
            const parsed = new URL(url);
            // Remove trailing slashes, www, and fragments
            let normalized = parsed.origin + parsed.pathname;
            normalized = normalized.replace(/\/+$/, '');
            normalized = normalized.replace('://www.', '://');
            return normalized.toLowerCase();
        } catch {
            return url.toLowerCase();
        }
    }
    
    calculateRelevance(result) {
        let score = 0;
        
        // More occurrences = higher relevance
        score += result.occurrences * 0.3;
        
        // Found in multiple search engines = higher relevance
        const uniqueSources = new Set(result.sources);
        score += uniqueSources.size * 0.2;
        
        // Domain authority (simple heuristic)
        const authorityDomains = [
            'wikipedia.org', 'github.com', 'stackoverflow.com', 
            'docs.microsoft.com', 'developer.mozilla.org', 'arxiv.org',
            '.edu', '.gov', 'nature.com', 'sciencedirect.com'
        ];
        
        if (authorityDomains.some(domain => result.url.includes(domain))) {
            score += 0.3;
        }
        
        // Has snippet = more relevant
        if (result.snippet && result.snippet.length > 50) {
            score += 0.2;
        }
        
        // Normalize to 0-1 range
        return Math.min(score, 1);
    }

    calculateTopicDistribution(analyzedContent) {
        // Simple topic distribution calculation
        const topics = {};
        analyzedContent.sources.forEach(source => {
            // Extract topics from analysis (simplified)
            const words = source.analysis.toLowerCase().split(/\s+/);
            words.forEach(word => {
                if (word.length > 5) {
                    topics[word] = (topics[word] || 0) + 1;
                }
            });
        });
        return topics;
    }

    // Page assistance features
    async assistWithCurrentPage(webview) {
        if (!webview) return null;

        const url = webview.getURL();
        const title = webview.getTitle();

        // Get page content
        const content = await webview.executeJavaScript(`
            document.body.innerText.substring(0, 5000)
        `);

        const prompt = `As an AI browser assistant, analyze this page and provide:
URL: ${url}
Title: ${title}
Content preview: ${content}

Provide:
1. A brief summary of the page
2. Key takeaways or important information
3. Suggested actions or related searches
4. Any warnings or things to be aware of

Format your response to be helpful for someone browsing this page.`;

        return await this.aiHandler.processQuery(prompt, {
            isPageAssist: true,
            url: url
        });
    }
}

export default AIBrowserAssistant;