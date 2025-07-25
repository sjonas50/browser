// Claude API Handler for AI functionality
// Uses Anthropic's Claude API for AI queries

const winston = require('winston');
const fetch = require('node-fetch');

class ClaudeHandler {
    constructor() {
        this.apiKey = process.env.ANTHROPIC_API_KEY;
        this.apiUrl = 'https://api.anthropic.com/v1/messages';
        this.model = 'claude-opus-4-20250514';  // Claude 4 Opus - most capable model
        this.maxTokens = 1024;
        
        // Initialize logger
        this.logger = winston.createLogger({
            level: 'debug',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.colorize(),
                winston.format.printf(({ timestamp, level, message, ...meta }) => {
                    const metaStr = Object.keys(meta).length ? `\n${JSON.stringify(meta, null, 2)}` : '';
                    return `[${timestamp}] [AI] ${level}: ${message}${metaStr}`;
                })
            ),
            transports: [
                new winston.transports.Console(),
                new winston.transports.File({ 
                    filename: 'ai-error.log', 
                    level: 'error' 
                }),
                new winston.transports.File({ 
                    filename: 'ai-debug.log' 
                })
            ]
        });
        
        this.logger.info('Claude AI Handler initialized', {
            model: this.model,
            apiKeySet: !!this.apiKey
        });
    }
    
    async processQuery(query, context = {}) {
        const startTime = Date.now();
        this.logger.info('Processing query', { query, context });
        
        if (!this.apiKey) {
            const error = 'ANTHROPIC_API_KEY not set in environment variables';
            this.logger.error(error);
            throw new Error(error);
        }
        
        try {
            // Build the system prompt based on context
            let systemPrompt = 'You are a helpful AI assistant integrated into a web browser. Provide concise, accurate responses.';
            
            if (context.url && context.title) {
                systemPrompt += `\n\nCurrent page: ${context.title} (${context.url})`;
            }
            
            if (context.isSearch) {
                systemPrompt += '\n\nYou are helping with a web search. Be concise and factual.';
            }
            
            // Handle knowledge base context
            let enhancedQuery = query;
            
            if (context.knowledgeOnly) {
                // Only use knowledge base content
                systemPrompt += '\n\nIMPORTANT: Base your response ONLY on the provided knowledge base information. Do not use external knowledge.';
                enhancedQuery = context.knowledgeOnly + '\n\nUser query: ' + query;
            } else if (context.primaryContext) {
                // Prioritize knowledge base content
                systemPrompt += '\n\nIMPORTANT: Prioritize the provided personal knowledge base information in your response.';
                enhancedQuery = context.primaryContext + '\n\nUser query: ' + query;
            } else if (context.knowledgeBase) {
                // Augment with knowledge base
                enhancedQuery = query + '\n' + context.knowledgeBase;
            }
            
            // Add knowledge sources info if available
            if (context.knowledgeSources && context.knowledgeSources.length > 0) {
                systemPrompt += `\n\nKnowledge sources used: ${context.knowledgeSources.map(s => s.title).join(', ')}`;
            }
            
            // Make API request
            const response = await this.makeAPIRequest({
                messages: [
                    {
                        role: 'user',
                        content: enhancedQuery
                    }
                ],
                system: systemPrompt
            });
            
            const elapsed = Date.now() - startTime;
            this.logger.info('Query processed successfully', {
                elapsed: `${elapsed}ms`,
                responseLength: response.length
            });
            
            return response;
        } catch (error) {
            this.logger.error('Failed to process query', {
                error: error.message,
                stack: error.stack,
                query,
                context
            });
            throw error;
        }
    }
    
    async makeAPIRequest(payload) {
        const requestId = Date.now().toString();
        
        this.logger.debug('Making API request', {
            requestId,
            model: this.model,
            messageCount: payload.messages.length
        });
        
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
                    max_tokens: this.maxTokens,
                    ...payload
                })
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                const error = new Error(`Claude API error: ${response.status} ${response.statusText}`);
                error.status = response.status;
                error.data = errorData;
                
                this.logger.error('API request failed', {
                    requestId,
                    status: response.status,
                    statusText: response.statusText,
                    error: errorData
                });
                
                throw error;
            }
            
            const data = await response.json();
            
            this.logger.debug('API request successful', {
                requestId,
                usage: data.usage,
                stopReason: data.stop_reason
            });
            
            return data.content[0].text;
        } catch (error) {
            if (error.status) {
                // API error already logged
                throw error;
            }
            
            // Network or other error
            this.logger.error('Network error during API request', {
                requestId,
                error: error.message,
                stack: error.stack
            });
            
            throw new Error(`Network error: ${error.message}`);
        }
    }
    
    async synthesizeResults(query, aiResponse, webResults) {
        this.logger.info('Synthesizing results', {
            query,
            webResultCount: webResults.length,
            aiResponseLength: aiResponse.length
        });
        
        try {
            // Prepare web results summary
            const webSummary = webResults
                .slice(0, 3)
                .map((r, i) => `${i + 1}. ${r.title}: ${r.snippet}`)
                .join('\n');
            
            const synthesisQuery = `Based on these web search results, provide an updated answer to: "${query}"

Initial AI response: ${aiResponse}

Web search results:
${webSummary}

Provide a comprehensive answer that:
1. Corrects any inaccuracies from the initial response
2. Incorporates relevant information from web results
3. Remains concise and directly answers the question`;
            
            const synthesized = await this.processQuery(synthesisQuery, {
                isSearch: true,
                synthesis: true
            });
            
            this.logger.info('Synthesis completed', {
                originalLength: aiResponse.length,
                synthesizedLength: synthesized.length
            });
            
            return synthesized;
        } catch (error) {
            this.logger.error('Synthesis failed, returning original response', {
                error: error.message
            });
            return aiResponse; // Fallback to original response
        }
    }
    
    // Analyze page content
    async analyzePage(content, query) {
        this.logger.info('Analyzing page content', {
            contentLength: content.length,
            query
        });
        
        try {
            const prompt = `Analyze this web page content and answer: ${query}

Page content (truncated):
${content.substring(0, 2000)}...

Provide a concise answer based on the page content.`;
            
            return await this.processQuery(prompt, {
                isPageAnalysis: true
            });
        } catch (error) {
            this.logger.error('Page analysis failed', {
                error: error.message,
                query
            });
            throw error;
        }
    }
    
    // Get model info
    getModelInfo() {
        return {
            provider: 'Anthropic',
            model: this.model,
            apiKeySet: !!this.apiKey,
            status: this.apiKey ? 'ready' : 'no-api-key'
        };
    }
}

module.exports = ClaudeHandler;