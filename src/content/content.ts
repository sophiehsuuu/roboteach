// SPIKE Advisor Content Script
// This script runs on SPIKE Prime pages to detect and analyze Blockly blocks

// Check if we're in a valid extension context
function isExtensionContextValid(): boolean {
  return typeof chrome !== "undefined" && 
         chrome.runtime && 
         chrome.runtime.id !== undefined;
}

// Wait for the page to be fully loaded
function waitForPageReady(): Promise<void> {
  return new Promise((resolve) => {
    if (document.readyState === 'complete') {
      resolve();
    } else {
      window.addEventListener('load', () => resolve());
    }
  });
}

// Wait for Blockly DOM elements to appear
function waitForBlocklyDOM(): Promise<void> {
  return new Promise((resolve, reject) => {
    // Check if elements already exist
    const existingElements = document.querySelectorAll('[data-id][class*="blocklyDraggable"]');
    if (existingElements.length > 0) {
      console.log('[SPIKE Advisor] Found', existingElements.length, 'Blockly DOM elements immediately');
      resolve();
      return;
    }

    // Set up observer to wait for elements
    const observer = new MutationObserver(() => {
      const elements = document.querySelectorAll('[data-id][class*="blocklyDraggable"]');
      if (elements.length > 0) {
        console.log('[SPIKE Advisor] Found', elements.length, 'Blockly DOM elements');
        observer.disconnect();
        resolve();
      }
    });

    // Start observing
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    // Timeout after 15 seconds
    setTimeout(() => {
      observer.disconnect();
      reject(new Error('Timeout waiting for Blockly DOM elements'));
    }, 15000);
  });
}

// Extract blocks directly from DOM elements
function extractBlocksFromDOM(): any[] {
  console.log('[SPIKE Advisor] Extracting blocks from DOM...');
  
  // Find all Blockly block elements
  const blocklyElements = document.querySelectorAll('[data-id][class*="blocklyDraggable"]');
  console.log('[SPIKE Advisor] Found', blocklyElements.length, 'Blockly DOM elements');
  
  const blocks: any[] = [];
  const seenIds = new Set<string>(); // Track seen block IDs to avoid duplicates
  const seenPositions = new Set<string>(); // Track seen positions to avoid duplicates
  
  blocklyElements.forEach((element) => {
    try {
      const dataId = element.getAttribute('data-id');
      const dataShapes = element.getAttribute('data-shapes');
      const dataCategory = element.getAttribute('data-category');
      
      // Get position from transform attribute
      const transform = element.getAttribute('transform');
      let x = 0, y = 0;
      if (transform) {
        const translateMatch = transform.match(/translate\(([^,]+),\s*([^)]+)\)/);
        if (translateMatch) {
          x = parseFloat(translateMatch[1]) || 0;
          y = parseFloat(translateMatch[2]) || 0;
        }
      }
      
      // Create position key for deduplication
      const positionKey = `${Math.round(x)},${Math.round(y)}`;
      
      // Skip if we've already seen this block ID or position
      if (dataId && seenIds.has(dataId)) {
        console.log('[SPIKE Advisor] Skipping duplicate block ID:', dataId);
        return;
      }
      
      if (seenPositions.has(positionKey)) {
        console.log('[SPIKE Advisor] Skipping duplicate position:', positionKey);
        return;
      }
      
      // Get text from this specific block element only
      const textElements = element.querySelectorAll('.blocklyText');
      let fullText = '';
      textElements.forEach((textEl) => {
        const textContent = textEl.textContent || '';
        if (textContent.trim()) {
          if (fullText) fullText += ' ';
          fullText += textContent.trim();
        }
      });
      
      // If no text found, try alternative selectors
      if (!fullText.trim()) {
        const altTextElement = element.querySelector('[data-text]');
        if (altTextElement) {
          fullText = altTextElement.getAttribute('data-text') || '';
        }
      }
      
      // Check if this block is in the workspace (not palette)
      const isInWorkspace = isBlockInWorkspace(element, x, y);
      
      const block = {
        id: dataId,
        type: fullText.trim(),
        category: dataCategory,
        shape: dataShapes,
        x: x,
        y: y,
        text: fullText,
        element: element,
        isInWorkspace: isInWorkspace
      };
      
      if (isInWorkspace) {
        console.log('[SPIKE Advisor] Workspace block:', {
          id: block.id,
          text: block.text,
          x: block.x,
          y: block.y,
          category: block.category,
          shape: block.shape,
          hasConnections: element.querySelector('.blocklyConnection') !== null,
          isVisible: element.getBoundingClientRect().width > 0 && element.getBoundingClientRect().height > 0,
          parentClasses: element.parentElement?.className || 'none',
          rect: element.getBoundingClientRect(),
          computedStyle: {
            display: window.getComputedStyle(element).display,
            visibility: window.getComputedStyle(element).visibility,
            opacity: window.getComputedStyle(element).opacity
          }
        });
        
        // Add to seen IDs and positions to prevent duplicates
        if (dataId) {
          seenIds.add(dataId);
        }
        seenPositions.add(positionKey);
      } else {
        console.log('[SPIKE Advisor] Palette block:', block);
      }
      
      blocks.push(block);
      
    } catch (e) {
      console.log('[SPIKE Advisor] Error extracting block:', e);
    }
  });
  
  // Filter to only workspace blocks
  const workspaceBlocks = blocks.filter(block => block.isInWorkspace);
  console.log('[SPIKE Advisor] Found', workspaceBlocks.length, 'workspace blocks out of', blocks.length, 'total blocks');
  
  // Additional filtering: remove any blocks that might be cached or auto-included
  const visibleBlocks = workspaceBlocks.filter(block => {
    // Skip blocks with very generic or empty text
    if (!block.text || block.text.trim() === '' || block.text.trim() === 'A') {
      console.log('[SPIKE Advisor] Filtering out block with generic text:', block.text);
      return false;
    }
    
    // Skip blocks that are likely cached/auto-included (very small or off-screen)
    if (block.x < -1000 || block.y < -1000 || block.x > 5000 || block.y > 5000) {
      console.log('[SPIKE Advisor] Filtering out off-screen block:', block.text, 'at', block.x, block.y);
      return false;
    }
    
    // Skip blocks that don't have meaningful content
    if (block.text.length < 3) {
      console.log('[SPIKE Advisor] Filtering out block with too short text:', block.text);
      return false;
    }
    
    return true;
  });
  
  console.log('[SPIKE Advisor] After additional filtering:', visibleBlocks.length, 'visible blocks');
  
  return visibleBlocks;
}

// Helper: Check if a block is in the workspace (not palette)
function isBlockInWorkspace(element: Element, x: number, y: number): boolean {
  const blockText = element.querySelector('.blocklyText')?.textContent || '';
  const blockId = element.getAttribute('data-id') || '';
  
  // Method 1: Check if block is in a flyout (palette) - this is the most reliable
  let parent = element.parentElement;
  while (parent) {
    if (parent.classList.contains('blocklyFlyout') || 
        parent.classList.contains('blocklyToolbox') ||
        parent.getAttribute('data-testid') === 'blockly-toolbox' ||
        parent.classList.contains('blocklyToolboxCategory') ||
        parent.classList.contains('blocklyToolboxCategoryContents')) {
      console.log('[SPIKE Advisor] Block in palette container:', parent.className);
      return false;
    }
    parent = parent.parentElement;
  }
  
  // Method 2: Check if block is actually visible and rendered
  const rect = element.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) {
    console.log('[SPIKE Advisor] Block has zero dimensions');
    return false;
  }
  
  // Method 3: Check if block is within the visible viewport
  if (rect.top < 0 || rect.left < 0 || rect.bottom > window.innerHeight || rect.right > window.innerWidth) {
    console.log('[SPIKE Advisor] Block outside viewport:', rect);
    return false;
  }
  
  // Method 4: Check if block is connected to other blocks (workspace blocks are usually connected)
  // Note: We're not using this check anymore as it was causing phantom blocks to be detected
  
  // Method 5: Check for specific workspace blocks (like "when program starts")
  if (blockText.includes('when program starts')) {
    console.log('[SPIKE Advisor] Found "when program starts" block (definitely workspace)');
    return true;
  }
  
  // Method 6: Check if block is in the main workspace area (not toolbox)
  const mainWorkspace = document.querySelector('.blocklyMainWorkspaceDiv');
  if (mainWorkspace) {
    const workspaceRect = mainWorkspace.getBoundingClientRect();
    
    // Check if block is within the main workspace bounds
    if (rect.left >= workspaceRect.left && 
        rect.top >= workspaceRect.top &&
        rect.right <= workspaceRect.right &&
        rect.bottom <= workspaceRect.bottom) {
      console.log('[SPIKE Advisor] Block within main workspace bounds:', blockText);
      return true;
    } else {
      console.log('[SPIKE Advisor] Block outside main workspace bounds:', blockText);
      return false;
    }
  }
  
  // Method 7: Check if block has meaningful content and is not in a flyout
  if (blockText.trim() && blockText.trim().length > 0) {
    // Skip empty operator blocks (likely palette)
    if (!blockText.trim() && blockId.includes('operator_')) {
      console.log('[SPIKE Advisor] Empty operator block in palette:', blockId);
      return false;
    }
    
    // Additional check: make sure the block is actually visible to the user
    const computedStyle = window.getComputedStyle(element);
    if (computedStyle.display === 'none' || computedStyle.visibility === 'hidden' || computedStyle.opacity === '0') {
      console.log('[SPIKE Advisor] Block is hidden:', blockText);
      return false;
    }
    
    // If it has meaningful text and is not in a flyout, it's likely in workspace
    console.log('[SPIKE Advisor] Block with meaningful text (likely workspace):', blockText);
    return true;
  }
  
  console.log('[SPIKE Advisor] Block appears to be in palette:', x, y, blockText);
  return false;
}

// Global variables for real-time monitoring
let blockDetectionObserver: MutationObserver | null = null;
let lastBlockCount = 0;
let detectionTimeout: NodeJS.Timeout | null = null;
let isInitialized = false; // Track if content script is ready

// Function to clear cached data and reset detection state
function clearCachedBlockData() {
  console.log('[SPIKE Advisor] Clearing cached block data...');
  lastBlockCount = 0;
  if (detectionTimeout) {
    clearTimeout(detectionTimeout);
    detectionTimeout = null;
  }
  // Force a fresh detection
  setTimeout(() => {
    updateBlockData();
  }, 100);
}

// Function to start real-time block monitoring
function startRealTimeBlockMonitoring() {
  console.log('[SPIKE Advisor] Starting real-time block monitoring...');
  
  // Stop any existing observer
  if (blockDetectionObserver) {
    blockDetectionObserver.disconnect();
  }
  
  // Create a new MutationObserver to watch for changes
  blockDetectionObserver = new MutationObserver((mutations) => {
    // Check if any mutations are related to Blockly blocks
    const hasBlockChanges = mutations.some(mutation => {
      // Check if any added/removed nodes are Blockly blocks
      const addedBlocks = Array.from(mutation.addedNodes).some(node => 
        node.nodeType === Node.ELEMENT_NODE && 
        (node as Element).getAttribute && 
        (node as Element).getAttribute('data-id') &&
        (node as Element).classList.contains('blocklyDraggable')
      );
      
      const removedBlocks = Array.from(mutation.removedNodes).some(node => 
        node.nodeType === Node.ELEMENT_NODE && 
        (node as Element).getAttribute && 
        (node as Element).getAttribute('data-id') &&
        (node as Element).classList.contains('blocklyDraggable')
      );
      
      // Check if attributes changed on existing blocks
      const attributeChanges = mutation.type === 'attributes' && 
        mutation.target.nodeType === Node.ELEMENT_NODE &&
        (mutation.target as Element).getAttribute('data-id') &&
        (mutation.target as Element).classList.contains('blocklyDraggable');
      
      return addedBlocks || removedBlocks || attributeChanges;
    });
    
    if (hasBlockChanges) {
      console.log('[SPIKE Advisor] Block changes detected, updating...');
      
      // Debounce the update to avoid too many rapid updates
      if (detectionTimeout) {
        clearTimeout(detectionTimeout);
      }
      
      detectionTimeout = setTimeout(() => {
        updateBlockData();
      }, 500); // Wait 500ms after last change before updating
    }
  });
  
  // Start observing the document for changes
  blockDetectionObserver.observe(document.body, {
    childList: true,      // Watch for added/removed nodes
    subtree: true,        // Watch the entire DOM tree
    attributes: true,     // Watch for attribute changes
    attributeFilter: ['data-id', 'transform', 'class'] // Only watch relevant attributes
  });
  
  console.log('[SPIKE Advisor] Real-time monitoring active');
}

// Update block data (called periodically)
async function updateBlockData() {
  if (!isExtensionContextValid()) {
    console.log('[SPIKE Advisor] Extension context not valid, skipping update');
    return;
  }

  try {
    console.log('[SPIKE Advisor] Updating block data...');
    
    // Extract blocks from DOM
    const blocks = extractBlocksFromDOM();
    const workspaceBlocks = blocks.filter(block => block.isInWorkspace);
    
    // Check if block count has changed
    if (workspaceBlocks.length !== lastBlockCount) {
      console.log('[SPIKE Advisor] Block count changed from', lastBlockCount, 'to', workspaceBlocks.length);
      lastBlockCount = workspaceBlocks.length;
      
      // Send updated data to popup
      sendBlockDataToPopup();
    } else {
      console.log('[SPIKE Advisor] Block count unchanged:', workspaceBlocks.length);
    }
    
  } catch (error) {
    console.error('[SPIKE Advisor] Error updating block data:', error);
  }
}

// Send block data to popup (only when extension context is valid)
function sendBlockDataToPopup() {
  if (!isExtensionContextValid()) {
    return;
  }

  try {
    // Get current block data
    const blocks = extractBlocksFromDOM();
    const workspaceBlocks = blocks.filter(block => block.isInWorkspace);
    
    // Create a summary text for the blocks
    const blockText = workspaceBlocks.map(block => block.text).join(' | ');
    
    const data = {
      blocks: workspaceBlocks,
      text: blockText,
      timestamp: Date.now()
    };
    
    console.log('[SPIKE Advisor] Sending', workspaceBlocks.length, 'blocks to popup');
    
    // Send to popup if it's open
    chrome.runtime.sendMessage({
      type: 'BLOCK_DATA_UPDATE',
      data: data
    }).catch(() => {
      // Popup might not be open, that's okay
    });
    
  } catch (error) {
    console.error('[SPIKE Advisor] Error sending block data to popup:', error);
  }
}

// Initialize the script
async function initializeScript() {
  try {
    console.log('[SPIKE Advisor] Initializing content script...');
    
    // Wait for the page to be ready
    await waitForPageReady();
    
    // Wait for Blockly DOM to be available
    await waitForBlocklyDOM();
    
    // Clear any cached data to prevent phantom blocks
    clearCachedBlockData();
    
    // Start real-time monitoring
    startRealTimeBlockMonitoring();
    
    // Set up message listener for popup requests
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message.type === "REQUEST_BLOCKS") {
        console.log('[SPIKE Advisor] Received REQUEST_BLOCKS from popup');
        const currentBlocks = extractBlocksFromDOM();
        const workspaceBlocks = currentBlocks.filter(block => block.isInWorkspace);
        const blockText = workspaceBlocks.map(block => block.text).join(' ');
        
        sendResponse({
          blocks: workspaceBlocks,
          blockText: blockText,
          initialized: isInitialized
        });
      }
    });
    
    isInitialized = true;
    console.log('[SPIKE Advisor] Content script initialized successfully');
    
  } catch (error) {
    console.error('[SPIKE Advisor] Error initializing script:', error);
  }
}

// Start the script when the page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => initializeScript());
} else {
  initializeScript();
} 