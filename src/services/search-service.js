/**
 * Search Service
 * Provides web search capabilities through various APIs
 * This replaces the webview scraping approach with proper API integration
 */

const fetch = require('node-fetch');

class SearchService {
    constructor() {
        // For now, we'll use DuckDuckGo's instant answer API (no key required)
        // In production, you'd want to use Google Custom Search API or Bing Search API
        this.searchProviders = {
            duckduckgo: {
                name: 'DuckDuckGo',
                endpoint: 'https://api.duckduckgo.com/',
                requiresKey: false,
                rateLimit: null
            },
            // Google Custom Search (requires API key)
            google: {
                name: 'Google',
                endpoint: 'https://www.googleapis.com/customsearch/v1',
                requiresKey: true,
                apiKey: process.env.GOOGLE_SEARCH_API_KEY,
                cx: process.env.GOOGLE_SEARCH_ENGINE_ID,
                rateLimit: null
            },
            // Brave Search API (requires API key)
            brave: {
                name: 'Brave',
                endpoint: 'https://api.search.brave.com/res/v1/web/search',
                requiresKey: true,
                apiKey: process.env.BRAVE_SEARCH_API_KEY,
                rateLimit: {
                    requestsPerSecond: 1,
                    lastRequestTime: 0
                }
            }
        };
        
        // Check if Brave API key is available and set it as default
        if (process.env.BRAVE_SEARCH_API_KEY) {
            this.activeProvider = 'brave';
            console.log('[SearchService] Brave Search API detected, setting as default provider');
        } else {
            this.activeProvider = 'duckduckgo'; // Default to free option
        }
    }

    /**
     * Perform a web search using the configured provider
     */
    async search(query, options = {}) {
        const provider = this.searchProviders[this.activeProvider];
        
        // Apply rate limiting if configured
        if (provider.rateLimit) {
            await this.enforceRateLimit(provider);
        }
        
        console.log(`[SearchService] Searching with ${provider.name}: "${query}"`);
        
        try {
            switch (this.activeProvider) {
                case 'duckduckgo':
                    return await this.searchDuckDuckGo(query, options);
                case 'google':
                    return await this.searchGoogle(query, options);
                case 'brave':
                    return await this.searchBrave(query, options);
                default:
                    throw new Error(`Unknown search provider: ${this.activeProvider}`);
            }
        } catch (error) {
            console.error(`[SearchService] Search failed:`, error);
            // Fallback to DuckDuckGo if other providers fail
            if (this.activeProvider !== 'duckduckgo') {
                console.log('[SearchService] Falling back to DuckDuckGo');
                return await this.searchDuckDuckGo(query, options);
            }
            throw error;
        }
    }

    /**
     * Enforce rate limiting for providers that require it
     */
    async enforceRateLimit(provider) {
        if (!provider.rateLimit) return;
        
        const now = Date.now();
        const timeSinceLastRequest = now - provider.rateLimit.lastRequestTime;
        const minInterval = 1000 / provider.rateLimit.requestsPerSecond;
        
        if (timeSinceLastRequest < minInterval) {
            const waitTime = minInterval - timeSinceLastRequest;
            console.log(`[SearchService] Rate limit: waiting ${waitTime}ms before next request`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }
        
        provider.rateLimit.lastRequestTime = Date.now();
    }

    /**
     * Search using DuckDuckGo Instant Answer API
     * Note: This is limited but doesn't require an API key
     */
    async searchDuckDuckGo(query, options = {}) {
        const params = new URLSearchParams({
            q: query,
            format: 'json',
            no_html: '1',
            skip_disambig: '1'
        });

        const response = await fetch(`https://api.duckduckgo.com/?${params}`);
        const data = await response.json();

        const results = [];

        // Extract instant answer if available
        if (data.AbstractText) {
            results.push({
                title: data.Heading || query,
                snippet: data.AbstractText,
                url: data.AbstractURL || '',
                source: 'duckduckgo_instant'
            });
        }

        // Extract related topics
        if (data.RelatedTopics) {
            data.RelatedTopics.forEach((topic, index) => {
                if (topic.Text && index < 5) {
                    results.push({
                        title: topic.Text.split(' - ')[0] || query,
                        snippet: topic.Text,
                        url: topic.FirstURL || '',
                        source: 'duckduckgo_related'
                    });
                }
            });
        }

        // If no results, we need to inform the user to use a proper search API
        if (results.length === 0) {
            console.log('[SearchService] DuckDuckGo returned no results. Consider using Google or Brave Search API.');
            
            // Return a message explaining the limitation
            results.push({
                title: 'Search API Required',
                snippet: 'To perform comprehensive web searches, please configure a search API (Google Custom Search or Brave Search) in your environment variables.',
                url: '',
                source: 'system_message'
            });
        }

        return results;
    }

    /**
     * Search using Google Custom Search API
     * Requires: GOOGLE_SEARCH_API_KEY and GOOGLE_SEARCH_ENGINE_ID
     */
    async searchGoogle(query, options = {}) {
        const provider = this.searchProviders.google;
        
        if (!provider.apiKey || !provider.cx) {
            throw new Error('Google Search API key or Search Engine ID not configured');
        }

        const params = new URLSearchParams({
            key: provider.apiKey,
            cx: provider.cx,
            q: query,
            num: options.limit || 10
        });

        const response = await fetch(`${provider.endpoint}?${params}`);
        
        if (!response.ok) {
            throw new Error(`Google Search API error: ${response.status}`);
        }

        const data = await response.json();

        return (data.items || []).map(item => ({
            title: item.title,
            snippet: item.snippet,
            url: item.link,
            source: 'google'
        }));
    }

    /**
     * Search using Brave Search API
     * Requires: BRAVE_SEARCH_API_KEY
     */
    async searchBrave(query, options = {}) {
        const provider = this.searchProviders.brave;
        
        if (!provider.apiKey) {
            throw new Error('Brave Search API key not configured');
        }

        const params = new URLSearchParams({
            q: query,
            count: options.limit || 10
        });

        const response = await fetch(`${provider.endpoint}?${params}`, {
            headers: {
                'Accept': 'application/json',
                'X-Subscription-Token': provider.apiKey
            }
        });

        if (!response.ok) {
            throw new Error(`Brave Search API error: ${response.status}`);
        }

        const data = await response.json();

        return (data.web?.results || []).map(item => ({
            title: item.title,
            snippet: item.description,
            url: item.url,
            source: 'brave'
        }));
    }

    /**
     * Check which search providers are available
     */
    getAvailableProviders() {
        const available = [];
        
        for (const [key, provider] of Object.entries(this.searchProviders)) {
            if (!provider.requiresKey) {
                available.push(key);
            } else if (provider.apiKey) {
                available.push(key);
            }
        }
        
        return available;
    }

    /**
     * Set the active search provider
     */
    setProvider(providerName) {
        if (!this.searchProviders[providerName]) {
            throw new Error(`Unknown provider: ${providerName}`);
        }
        
        const provider = this.searchProviders[providerName];
        if (provider.requiresKey && !provider.apiKey) {
            throw new Error(`${provider.name} requires an API key`);
        }
        
        this.activeProvider = providerName;
        console.log(`[SearchService] Switched to ${provider.name}`);
    }
}

module.exports = SearchService;