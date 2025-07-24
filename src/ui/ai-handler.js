// AI Handler for Renderer Process
// Manages WebLLM integration and AI queries

class AIHandler {
    constructor() {
        this.engine = null;
        this.currentModel = null;
        this.isLoading = false;
        this.modelConfig = {
            'Llama-3.2-1B-Instruct': {
                model_url: 'https://huggingface.co/mlc-ai/Llama-3.2-1B-Instruct-MLC/resolve/main/',
                model_id: 'Llama-3.2-1B-Instruct-q4f16_1-MLC',
                context_window: 8192
            },
            'Llama-3.2-3B-Instruct': {
                model_url: 'https://huggingface.co/mlc-ai/Llama-3.2-3B-Instruct-MLC/resolve/main/',
                model_id: 'Llama-3.2-3B-Instruct-q4f16_1-MLC',
                context_window: 128000
            }
        };
    }

    async initialize() {
        try {
            // Dynamically import WebLLM
            const webllm = await import('@mlc-ai/web-llm');
            
            // Initialize WebLLM engine
            this.engine = await webllm.CreateMLCEngine();
            console.log('WebLLM engine initialized');
            
            // Load default model
            await this.loadModel('Llama-3.2-1B-Instruct');
        } catch (error) {
            console.error('Failed to initialize WebLLM:', error);
            // For now, we'll just log the error and continue
            // The main process AI will be used as fallback
            console.warn('Falling back to main process AI');
        }
    }

    async loadModel(modelName) {
        if (this.isLoading) {
            throw new Error('Model is already loading');
        }

        const config = this.modelConfig[modelName];
        if (!config) {
            throw new Error(`Unknown model: ${modelName}`);
        }

        this.isLoading = true;
        
        try {
            // Show loading progress
            const initProgressCallback = (progress) => {
                console.log(`Loading ${modelName}: ${progress.text}`);
                // Send progress to UI
                window.postMessage({
                    type: 'ai-loading-progress',
                    progress: progress
                }, '*');
            };

            // Load the model
            await this.engine.reload(config.model_id, {
                model_url: config.model_url,
                initProgressCallback: initProgressCallback
            });

            this.currentModel = modelName;
            this.isLoading = false;
            
            console.log(`Model ${modelName} loaded successfully`);
            return true;
        } catch (error) {
            this.isLoading = false;
            console.error(`Failed to load model ${modelName}:`, error);
            throw error;
        }
    }

    async processQuery(query, context = {}) {
        if (!this.engine || !this.currentModel) {
            throw new Error('No model loaded');
        }

        try {
            // Build the prompt with context
            let prompt = this.buildPrompt(query, context);
            
            // Generate response
            const response = await this.engine.chat.completions.create({
                messages: [
                    {
                        role: 'system',
                        content: 'You are a helpful AI assistant integrated into a web browser. Provide concise, helpful responses. If asked to navigate or interact with web pages, explain what the user should do.'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                max_tokens: 500,
                temperature: 0.7
            });

            return response.choices[0].message.content;
        } catch (error) {
            console.error('Failed to process query:', error);
            throw error;
        }
    }

    buildPrompt(query, context) {
        let prompt = query;
        
        // Add page context if available
        if (context.url && context.title) {
            prompt = `Current page: ${context.title} (${context.url})\n\nUser query: ${query}`;
        }
        
        return prompt;
    }

    // Analyze page content
    async analyzePage(content, query) {
        if (!this.engine || !this.currentModel) {
            throw new Error('No model loaded');
        }

        try {
            const prompt = `Analyze the following web page content and answer the user's question.

Page content:
${content.substring(0, 2000)}...

User question: ${query}

Provide a concise, helpful answer based on the page content.`;

            const response = await this.engine.chat.completions.create({
                messages: [
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                max_tokens: 300,
                temperature: 0.7
            });

            return response.choices[0].message.content;
        } catch (error) {
            console.error('Failed to analyze page:', error);
            throw error;
        }
    }

    // Suggest completions for URL bar
    async suggestCompletions(input) {
        if (!this.engine || !this.currentModel) {
            return [];
        }

        try {
            const prompt = `Given the partial URL or search query "${input}", suggest 3 likely completions. Return only the completions, one per line.`;

            const response = await this.engine.chat.completions.create({
                messages: [
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                max_tokens: 50,
                temperature: 0.5
            });

            const suggestions = response.choices[0].message.content
                .split('\n')
                .filter(s => s.trim())
                .slice(0, 3);

            return suggestions;
        } catch (error) {
            console.error('Failed to get suggestions:', error);
            return [];
        }
    }

    // Get model info
    getModelInfo() {
        return {
            currentModel: this.currentModel,
            isLoading: this.isLoading,
            availableModels: Object.keys(this.modelConfig)
        };
    }
}

// Export for use in renderer
export default AIHandler;
window.AIHandler = AIHandler;