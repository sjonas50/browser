/**
 * Document Parser
 * Handles parsing of various document formats for the knowledge base
 */

const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const marked = require('marked');
const TurndownService = require('turndown');
const { parse: parseHtml } = require('node-html-parser');
const fs = require('fs').promises;
const path = require('path');

class DocumentParser {
    constructor(logger) {
        this.logger = logger;
        this.turndown = new TurndownService({
            headingStyle: 'atx',
            codeBlockStyle: 'fenced'
        });
        
        // Supported file types
        this.supportedTypes = {
            'pdf': this.parsePDF.bind(this),
            'txt': this.parseText.bind(this),
            'md': this.parseMarkdown.bind(this),
            'html': this.parseHTML.bind(this),
            'htm': this.parseHTML.bind(this),
            'docx': this.parseDocx.bind(this),
            'json': this.parseJSON.bind(this)
        };
    }
    
    /**
     * Parse a document from file path
     */
    async parseFile(filePath) {
        const ext = path.extname(filePath).toLowerCase().substring(1);
        const parser = this.supportedTypes[ext];
        
        if (!parser) {
            throw new Error(`Unsupported file type: ${ext}`);
        }
        
        try {
            const buffer = await fs.readFile(filePath);
            const result = await parser(buffer, filePath);
            
            return {
                ...result,
                originalPath: filePath,
                fileType: ext,
                fileName: path.basename(filePath)
            };
        } catch (error) {
            this.logger.error(`Failed to parse file: ${filePath}`, error);
            throw error;
        }
    }
    
    /**
     * Parse a document from buffer
     */
    async parseBuffer(buffer, fileType, fileName = 'unknown') {
        const parser = this.supportedTypes[fileType];
        
        if (!parser) {
            throw new Error(`Unsupported file type: ${fileType}`);
        }
        
        try {
            const result = await parser(buffer, fileName);
            
            return {
                ...result,
                fileType,
                fileName
            };
        } catch (error) {
            this.logger.error(`Failed to parse buffer: ${fileName}`, error);
            throw error;
        }
    }
    
    /**
     * Parse PDF files
     */
    async parsePDF(buffer, fileName) {
        try {
            const data = await pdfParse(buffer);
            
            return {
                title: data.info?.Title || fileName,
                content: data.text,
                metadata: {
                    pages: data.numpages,
                    info: data.info,
                    version: data.version
                },
                wordCount: this.countWords(data.text)
            };
        } catch (error) {
            this.logger.error('PDF parsing failed:', error);
            throw new Error(`Failed to parse PDF: ${error.message}`);
        }
    }
    
    /**
     * Parse plain text files
     */
    async parseText(buffer, fileName) {
        const content = buffer.toString('utf-8');
        
        return {
            title: fileName,
            content,
            metadata: {
                encoding: 'utf-8',
                size: buffer.length
            },
            wordCount: this.countWords(content)
        };
    }
    
    /**
     * Parse Markdown files
     */
    async parseMarkdown(buffer, fileName) {
        const content = buffer.toString('utf-8');
        const html = marked.parse(content);
        
        // Extract title from first heading if available
        const titleMatch = content.match(/^#\s+(.+)$/m);
        const title = titleMatch ? titleMatch[1] : fileName;
        
        return {
            title,
            content,
            html,
            metadata: {
                format: 'markdown',
                hasCode: content.includes('```'),
                headings: this.extractHeadings(content)
            },
            wordCount: this.countWords(content)
        };
    }
    
    /**
     * Parse HTML files
     */
    async parseHTML(buffer, fileName) {
        const html = buffer.toString('utf-8');
        const root = parseHtml(html);
        
        // Extract title
        const titleElement = root.querySelector('title');
        const h1Element = root.querySelector('h1');
        const title = titleElement?.text || h1Element?.text || fileName;
        
        // Extract main content
        const mainContent = root.querySelector('main') || 
                          root.querySelector('article') || 
                          root.querySelector('body') || 
                          root;
        
        // Convert to markdown for better text processing
        const markdown = this.turndown.turndown(mainContent.innerHTML || mainContent.text);
        
        return {
            title,
            content: markdown,
            html: mainContent.innerHTML || mainContent.text,
            metadata: {
                format: 'html',
                hasImages: root.querySelectorAll('img').length > 0,
                links: this.extractLinks(root)
            },
            wordCount: this.countWords(markdown)
        };
    }
    
    /**
     * Parse DOCX files
     */
    async parseDocx(buffer, fileName) {
        try {
            const result = await mammoth.extractRawText({ buffer });
            const content = result.value;
            
            // Also get HTML for better structure preservation
            const htmlResult = await mammoth.convertToHtml({ buffer });
            const html = htmlResult.value;
            
            return {
                title: fileName,
                content,
                html,
                metadata: {
                    format: 'docx',
                    messages: result.messages
                },
                wordCount: this.countWords(content)
            };
        } catch (error) {
            this.logger.error('DOCX parsing failed:', error);
            throw new Error(`Failed to parse DOCX: ${error.message}`);
        }
    }
    
    /**
     * Parse JSON files
     */
    async parseJSON(buffer, fileName) {
        try {
            const content = buffer.toString('utf-8');
            const data = JSON.parse(content);
            
            // Convert to readable format
            const formatted = JSON.stringify(data, null, 2);
            
            return {
                title: fileName,
                content: formatted,
                data,
                metadata: {
                    format: 'json',
                    keys: Object.keys(data),
                    type: Array.isArray(data) ? 'array' : 'object'
                },
                wordCount: this.countWords(formatted)
            };
        } catch (error) {
            this.logger.error('JSON parsing failed:', error);
            throw new Error(`Failed to parse JSON: ${error.message}`);
        }
    }
    
    /**
     * Parse web page content
     */
    async parseWebPage(url, htmlContent) {
        try {
            const root = parseHtml(htmlContent);
            
            // Remove script and style elements
            root.querySelectorAll('script, style, noscript').forEach(el => el.remove());
            
            // Extract metadata
            const title = root.querySelector('title')?.text || 
                         root.querySelector('h1')?.text || 
                         'Untitled Page';
            
            const description = root.querySelector('meta[name="description"]')?.getAttribute('content') || '';
            const author = root.querySelector('meta[name="author"]')?.getAttribute('content') || '';
            
            // Extract main content
            const mainContent = root.querySelector('main') || 
                              root.querySelector('article') || 
                              root.querySelector('[role="main"]') ||
                              root.querySelector('.content') ||
                              root.querySelector('#content') ||
                              root.querySelector('body') || 
                              root;
            
            // Convert to markdown
            const markdown = this.turndown.turndown(mainContent.innerHTML || mainContent.text);
            
            return {
                title,
                content: markdown,
                url,
                metadata: {
                    description,
                    author,
                    format: 'webpage',
                    hasImages: root.querySelectorAll('img').length > 0,
                    links: this.extractLinks(root)
                },
                wordCount: this.countWords(markdown)
            };
        } catch (error) {
            this.logger.error('Web page parsing failed:', error);
            throw new Error(`Failed to parse web page: ${error.message}`);
        }
    }
    
    /**
     * Extract headings from markdown
     */
    extractHeadings(markdown) {
        const headings = [];
        const regex = /^(#{1,6})\s+(.+)$/gm;
        let match;
        
        while ((match = regex.exec(markdown)) !== null) {
            headings.push({
                level: match[1].length,
                text: match[2]
            });
        }
        
        return headings;
    }
    
    /**
     * Extract links from HTML
     */
    extractLinks(root) {
        const links = [];
        root.querySelectorAll('a[href]').forEach(link => {
            const href = link.getAttribute('href');
            if (href && !href.startsWith('#')) {
                links.push({
                    text: link.text,
                    href
                });
            }
        });
        return links;
    }
    
    /**
     * Count words in text
     */
    countWords(text) {
        return text.trim().split(/\s+/).filter(word => word.length > 0).length;
    }
    
    /**
     * Check if file type is supported
     */
    isSupported(fileType) {
        return fileType in this.supportedTypes;
    }
    
    /**
     * Get list of supported file types
     */
    getSupportedTypes() {
        return Object.keys(this.supportedTypes);
    }
}

module.exports = DocumentParser;