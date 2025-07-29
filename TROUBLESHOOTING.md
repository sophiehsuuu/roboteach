# SPIKE AI Error Advisor - Troubleshooting Guide

## Quick Fixes for Common Issues

### 1. "Detected Blocks" Panel Not Showing

**Symptoms:**
- The 🧩 檢測到的積木設定 panel doesn't appear in the popup
- No block data is displayed

**Solutions (in order of likelihood):**

#### A. Extension Not Reloaded After Build
```bash
# 1. Build the extension
npm run build

# 2. In Chrome:
# - Go to chrome://extensions/
# - Find "RoboLearn SPIKE AI Error Advisor"
# - Click the refresh/reload button 🔄
# - Or toggle the extension off and on
```

#### B. Content Script Not Running
**Check if content script is loaded:**
1. Open SPIKE page (https://spike.legoeducation.com/)
2. Open DevTools (F12)
3. Look for console messages starting with `[SPIKE Advisor]`
4. You should see: `[SPIKE Advisor] Content script loaded and running`

**If no messages appear:**
- Check manifest.json points to correct JS file: `"js": ["src/content/content.js"]`
- Verify the file exists in `dist/src/content/content.js`
- Reload the extension

#### C. Not on SPIKE Page
- Ensure you're on https://spike.legoeducation.com/
- The extension only works on this domain
- Check the popup shows "⚠️ Not on SPIKE page" status

#### D. Manual Refresh
- Click the "🔄 重新整理 / Refresh" button in the popup
- This forces a manual request to the content script

### 2. Block Data Not Detected

**Symptoms:**
- Content script is running but no blocks are found
- Console shows "Found 0 blocks"

**Solutions:**

#### A. Check Blockly Workspace
```javascript
// In SPIKE page DevTools console, run:
console.log('Blockly available:', typeof window.Blockly !== 'undefined');
console.log('Workspace:', window.Blockly?.getMainWorkspace());
console.log('All blocks:', window.Blockly?.getMainWorkspace()?.getAllBlocks(false));
```

#### B. Page Not Fully Loaded
- Wait for the SPIKE page to fully load
- Try refreshing the page
- Ensure you have blocks in the workspace

#### C. Different Blockly Structure
- The extension expects `window.Blockly.getMainWorkspace()`
- If SPIKE uses a different structure, update `content.ts`

### 3. AI Advice Not Working

**Symptoms:**
- "Ask AI" button doesn't return advice
- Error messages in popup

**Solutions:**

#### A. Check Supabase Function
1. Verify the function is deployed: `supabase/functions/llm-advice/`
2. Check environment variables: `OPENAI_API_KEY`
3. Test the endpoint directly:
```bash
curl -X POST https://rcwulqsdbrptrrtkluhh.supabase.co/functions/v1/llm-advice \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{"code":{"summary":"test","pickedSymptom":"motor","blockText":"","blocks":[]},"lang":"zh-Hant"}'
```

#### B. Network Issues
- Check browser network tab for failed requests
- Verify CORS headers are correct
- Check if the API key is valid

### 4. Build Issues

**TypeScript Errors:**
```bash
# Fix TypeScript errors
npm run lint
# Then fix any errors before building
npm run build
```

**Missing Files:**
- Ensure all source files exist
- Check `vite.config.ts` is configured correctly
- Verify `manifest.json` references correct paths

## Debug Information

### Content Script Logs
Look for these messages in SPIKE page DevTools console:
```
[SPIKE Advisor] Content script loaded and running
[SPIKE Advisor] Found X blocks
[SPIKE Advisor] Extracted X structured blocks
[SPIKE Advisor] Initial block data sent
```

### Popup Logs
Look for these messages in popup DevTools console:
```
[Popup] Received message: SPIKE_BLOCK_STRUCTURED
[Popup] Block data received: [...]
```

### Block Data Structure
Expected block data format:
```javascript
{
  type: "spike_move_motor",
  MOTOR: "A",
  SPEED: 75,
  DIRECTION: "forward",
  x: 100,
  y: 200
}
```

## Extension Architecture

### File Structure
```
src/
├── content/
│   └── content.ts          # Extracts blocks from SPIKE page
├── popup/
│   ├── Popup.tsx          # Main UI component
│   └── index.html         # Popup entry point
└── main.tsx               # App entry point

dist/                       # Built extension files
├── manifest.json          # Chrome extension manifest
├── src/
│   ├── content/
│   │   └── content.js     # Built content script
│   └── popup/
│       ├── index.html     # Built popup
│       └── index.js       # Built popup script
└── icons/                 # Extension icons

supabase/
└── functions/
    └── llm-advice/
        └── index.ts       # AI advice backend
```

### Message Flow
1. **Content Script** → extracts blocks every 3 seconds
2. **Content Script** → sends `SPIKE_BLOCK_STRUCTURED` message to popup
3. **Popup** → receives and displays block data
4. **Popup** → sends block data + user question to Supabase function
5. **Supabase Function** → calls OpenAI API with enhanced prompt
6. **Popup** → displays AI advice

### Key Features
- **Real-time block extraction** from SPIKE workspace
- **Enhanced block categorization** (motor, sensor, control, etc.)
- **Improved LLM prompts** that reference actual block values
- **Debug panel** showing detected blocks and status
- **Manual refresh** button for troubleshooting
- **Comprehensive error handling** and logging

## Maintenance

### Regular Tasks
1. **Update block types** in `content.ts` if SPIKE adds new blocks
2. **Test on different SPIKE pages** to ensure compatibility
3. **Monitor AI responses** for accuracy and relevance
4. **Check for SPIKE interface changes** that might break extraction

### Performance Optimization
- Content script runs every 3 seconds (adjustable in `content.ts`)
- Block data is cached in popup state
- Only sends data when blocks change
- Efficient block categorization and analysis

### Security Considerations
- API keys stored securely in Supabase environment
- CORS properly configured for extension requests
- No sensitive data logged to console
- Input validation on all user inputs

## Support

For issues not covered here:
1. Check browser console for error messages
2. Verify extension is properly built and loaded
3. Test on a fresh SPIKE page
4. Contact: roboyouthtaiwan@gmail.com 