# Search API Setup Guide

The AI Browser's deep search functionality requires a search API to work properly. By default, it uses DuckDuckGo's instant answer API which is limited. For comprehensive web search, you need to configure one of the following:

## Option 1: Google Custom Search API (Recommended)

1. **Get a Google API Key:**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select existing
   - Enable "Custom Search API"
   - Create credentials (API Key)

2. **Create a Custom Search Engine:**
   - Go to [Programmable Search Engine](https://programmablesearchengine.google.com/)
   - Create a new search engine
   - Add sites to search (or enable "Search the entire web")
   - Get your Search Engine ID (cx)

3. **Configure in .env:**
   ```
   GOOGLE_SEARCH_API_KEY=your_google_api_key_here
   GOOGLE_SEARCH_ENGINE_ID=your_search_engine_id_here
   ```

## Option 2: Brave Search API

1. **Get Brave Search API Key:**
   - Go to [Brave Search API](https://brave.com/search/api/)
   - Sign up for an account
   - Get your API key

2. **Configure in .env:**
   ```
   BRAVE_SEARCH_API_KEY=your_brave_api_key_here
   ```

3. **Rate Limiting:**
   - Brave Search has a rate limit of 1 query per second
   - The search service automatically handles this with delays
   - Multiple searches will be performed sequentially, not in parallel
   - You'll see "Rate limit: waiting Xms" messages in the console

## Option 3: Use Default (Limited)

Without configuration, the browser uses DuckDuckGo's instant answer API which:
- Doesn't require an API key
- Provides limited results
- Works for basic queries only

## Troubleshooting Search Issues

### No Results Found
- Check console logs for errors
- Verify API keys are correct
- Ensure you have internet connectivity
- Try a simple query like "weather"

### Webview Search Fallback
If you see "Using webview fallback", the search API isn't configured properly. The webview method:
- Is less reliable
- May be blocked by search engines
- Can trigger CAPTCHAs
- Returns fewer results

### Rate Limits
- Google: 100 queries/day (free tier)
- Brave: Varies by plan
- DuckDuckGo: No hard limit but fair use

## Testing Your Setup

1. Start the browser: `npm start`
2. Type a search query in the URL bar
3. Check the console for search provider info
4. Look for results in the AI response

## Future: MCP Integration

The Model Context Protocol (MCP) will eventually provide a standardized way for Claude to access web search. Currently, MCP is only available in Claude Desktop app, not through the API.

For updates on MCP API availability, check:
- https://modelcontextprotocol.io/
- https://docs.anthropic.com/en/docs/agents-and-tools/mcp