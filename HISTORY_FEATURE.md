# Browser History Feature

The AI Browser now includes comprehensive history tracking for both searches and page visits.

## Features

### 1. Automatic History Storage
- **Search History**: All AI-powered searches are automatically saved with metadata
  - Query text
  - Number of sources found
  - Whether knowledge base was used
  - Timestamp
  
- **Page Visit History**: Regular browsing is tracked (excluding local files)
  - Page URL
  - Page title
  - Domain
  - Timestamp

### 2. History Viewer
Access via Settings (⚙️) → History (📜)

**Features:**
- Filter by type: All, Searches, or Pages
- Search within history
- Group by date (Today, Yesterday, This Week, etc.)
- One-click to revisit any item
- Clear history option

### 3. Privacy Considerations
- History is stored locally using encrypted storage
- Only essential data is saved (no page content)
- URLs are sanitized to extract just the domain
- Local files and special URLs are not tracked

## Usage

### View History
1. Click the Settings button (⚙️) in the navigation bar
2. Select "History" from the menu
3. Browse, search, or filter your history

### Test History
Run this in the browser console:
```javascript
// View recent searches
const searches = await window.browser.getSearchHistory(10);
console.log('Recent searches:', searches);

// View all history
const history = await window.browser.getFullHistory(20);
console.log('Recent history:', history);
```

### Clear History
- Use the "Clear History" button in the history viewer
- Or programmatically: `await window.browser.clearHistory()`

## Implementation Details

### Storage
- Uses `StorageManager` with encrypted storage
- History entries include:
  - `type`: 'search' or 'visit'
  - `title`: Display title
  - `timestamp`: When it occurred
  - Additional metadata based on type

### IPC Handlers
- `history:add` - Add entry to history
- `history:get` - Retrieve history with filters
- `history:search` - Search within history
- `history:clear` - Clear history

### Files
- `/src/ui/history.html` - History viewer UI
- `/src/ui/history.js` - History viewer logic
- `/src/storage/StorageManager.js` - History storage methods
- `/src/ui/renderer.js` - History tracking integration

## Future Enhancements
- Search suggestions in URL bar based on history
- Export/import history
- Advanced analytics and insights
- Sync across devices (with encryption)