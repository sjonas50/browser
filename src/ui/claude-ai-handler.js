// Claude AI Handler for Renderer Process
// Uses Anthropic's Claude API directly from the browser

class ClaudeAIHandler {
    constructor() {
        this.apiKey = null; // Will be fetched from main process
        this.apiUrl = 'https://api.anthropic.com/v1/messages';
        this.model = 'claude-opus-4-20250514';  // Claude 4 Opus - most capable model
        this.isInitialized = false;
        this.debugMode = true;
    }

    async initialize() {
        console.log('[ClaudeAI] Initializing Claude AI Handler...');
        
        try {
            // Get API key from main process
            const config = await window.electronAPI.ai.getConfig();
            this.apiKey = config.apiKey;
            
            if (!this.apiKey) {
                throw new Error('ANTHROPIC_API_KEY not configured');
            }
            
            this.isInitialized = true;
            console.log('[ClaudeAI] Initialized successfully', {
                model: this.model,
                apiKeySet: !!this.apiKey
            });
            
            return true;
        } catch (error) {
            console.error('[ClaudeAI] Initialization failed:', error);
            this.isInitialized = false;
            throw error;
        }
    }

    async processQuery(query, context = {}) {
        const startTime = Date.now();
        
        if (!this.isInitialized) {
            console.error('[ClaudeAI] Not initialized');
            throw new Error('Claude AI not initialized');
        }
        
        console.log('[ClaudeAI] Processing query:', {
            query: query.substring(0, 100) + '...',
            context
        });
        
        try {
            // First try to use the main process API
            const response = await window.electronAPI.ai.query(query, context);
            
            const elapsed = Date.now() - startTime;
            console.log(`[ClaudeAI] Query processed in ${elapsed}ms`);
            
            return response;
        } catch (error) {
            console.error('[ClaudeAI] Failed to process query:', error);
            
            // Fallback to direct API call if main process fails
            if (this.apiKey) {
                console.log('[ClaudeAI] Attempting direct API call...');
                return await this.directAPICall(query, context);
            }
            
            throw error;
        }
    }

    async directAPICall(query, context) {
        console.log('[ClaudeAI] Making direct API call');
        
        // Build the system prompt
        let systemPrompt = 'You are a helpful AI assistant integrated into a web browser. Provide concise, accurate responses.';
        
        if (context.url && context.title) {
            systemPrompt += `\n\nCurrent page: ${context.title} (${context.url})`;
        }
        
        try {
            const response = await fetch(this.apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': this.apiKey,
                    'anthropic-version': '2023-06-01'
                },
                body: JSON.stringify({
                    model: this.model,
                    max_tokens: 1024,
                    messages: [
                        {
                            role: 'user',
                            content: query
                        }
                    ],
                    system: systemPrompt
                })
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.error('[ClaudeAI] API error:', response.status, errorData);
                throw new Error(`Claude API error: ${response.status}`);
            }
            
            const data = await response.json();
            console.log('[ClaudeAI] Direct API call successful', {
                usage: data.usage,
                stopReason: data.stop_reason
            });
            
            return data.content[0].text;
        } catch (error) {
            console.error('[ClaudeAI] Direct API call failed:', error);
            throw error;
        }
    }

    async analyzePage(content, query) {
        console.log('[ClaudeAI] Analyzing page content', {
            contentLength: content.length,
            query
        });
        
        const prompt = `Analyze this web page content and answer: ${query}

Page content (truncated):
${content.substring(0, 2000)}...

Provide a concise answer based on the page content.`;
        
        return await this.processQuery(prompt, { isPageAnalysis: true });
    }

    async synthesizeResults(query, aiResponse, webResults) {
        console.log('[ClaudeAI] Synthesizing results', {
            query,
            webResultCount: webResults.length
        });
        
        const webSummary = webResults
            .slice(0, 3)
            .map((r, i) => `${i + 1}. ${r.title}: ${r.snippet}`)
            .join('\n');
        
        const synthesisPrompt = `Based on these web search results, provide an updated answer to: "${query}"

Initial AI response: ${aiResponse}

Web search results:
${webSummary}

Provide a comprehensive answer that:
1. Corrects any inaccuracies from the initial response
2. Incorporates relevant information from web results
3. Remains concise and directly answers the question`;
        
        return await this.processQuery(synthesisPrompt, { 
            isSearch: true, 
            synthesis: true 
        });
    }

    getModelInfo() {
        return {
            provider: 'Anthropic Claude 4 Opus',
            model: this.model,
            isInitialized: this.isInitialized,
            status: this.isInitialized ? 'ready' : 'not-initialized'
        };
    }
}

export default ClaudeAIHandler;