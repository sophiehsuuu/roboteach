// SPIKE Advisor Content Script - Visual Workspace Block Detection
// This script runs on SPIKE Prime pages to detect ONLY blocks in the visible workspace

// Check if we're in a valid extension context
function isExtensionContextValid(): boolean {
  return typeof chrome !== "undefined" && 
         chrome.runtime && 
         chrome.runtime.id !== undefined;
}

// Main function to extract ONLY blocks visible in the main workspace
function extractVisibleWorkspaceBlocks(): any[] {
  console.log('[SPIKE Advisor] 🎯 Extracting ONLY visible workspace blocks...');
  
  const blocks: any[] = [];
  
  // Debug: Find different possible workspace containers
  const workspaceContainers = [
    '.blocklyMainWorkspaceDiv svg',
    '.blocklyMainWorkspaceDiv',
    '.blocklySvg',
    '.blocklyWorkspace',
    '#blocklyDiv svg',
    '#blocklyDiv'
  ];
  
  let mainWorkspaceSvg: Element | null = null;
  
  for (const selector of workspaceContainers) {
    const element = document.querySelector(selector);
    if (element) {
      console.log(`[SPIKE Advisor] ✅ Found workspace using selector: ${selector}`);
      mainWorkspaceSvg = element;
      break;
    } else {
      console.log(`[SPIKE Advisor] ❌ No element found for: ${selector}`);
    }
  }
  
  if (!mainWorkspaceSvg) {
    console.log('[SPIKE Advisor] ❌ Could not find any workspace container');
    // Try to find any blockly-related elements
    const allBlocklyElements = document.querySelectorAll('[class*="blockly"], [id*="blockly"]');
    console.log(`[SPIKE Advisor] 🔍 Found ${allBlocklyElements.length} elements with 'blockly' in class/id:`);
    allBlocklyElements.forEach((el, i) => {
      console.log(`  ${i + 1}. ${el.tagName}.${el.className} #${el.id}`);
    });
    return [];
  }
  
  const workspaceRect = mainWorkspaceSvg.getBoundingClientRect();
  console.log('[SPIKE Advisor] 📐 Main workspace bounds:', {
    left: workspaceRect.left,
    top: workspaceRect.top,
    width: workspaceRect.width,
    height: workspaceRect.height
  });
  
  // Try different selectors to find blocks
  const blockSelectors = [
    'g[data-id]:not([data-id=""])',
    'g.blocklyDraggable', 
    '.blocklyDraggable',
    '[data-id]',
    'g[transform]',
    '.blocklyBlockCanvas g'
  ];
  
  let blockElements: NodeListOf<Element> | null = null;
  let usedSelector = '';
  
  for (const selector of blockSelectors) {
    const elements = mainWorkspaceSvg.querySelectorAll(selector);
    if (elements.length > 0) {
      console.log(`[SPIKE Advisor] ✅ Found ${elements.length} elements using selector: ${selector}`);
      blockElements = elements;
      usedSelector = selector;
      break;
    } else {
      console.log(`[SPIKE Advisor] ❌ No elements found for: ${selector}`);
    }
  }
  
  if (!blockElements || blockElements.length === 0) {
    console.log('[SPIKE Advisor] ❌ Could not find any block elements');
    // Try searching in the entire document as fallback
    const allElements = document.querySelectorAll('[data-id], .blocklyDraggable');
    console.log(`[SPIKE Advisor] 🔍 Fallback: Found ${allElements.length} elements in entire document`);
    if (allElements.length > 0) {
      console.log('[SPIKE Advisor] 🔄 Using document-wide search as fallback');
      blockElements = allElements;
      usedSelector = 'document fallback';
    } else {
      return [];
    }
  }
  
  console.log(`[SPIKE Advisor] 🔍 Processing ${blockElements.length} elements from: ${usedSelector}`);
  
  blockElements.forEach((element, index) => {
    try {
      const rect = element.getBoundingClientRect();
      
      // Debug: Log all elements we find
      console.log(`[SPIKE Advisor] 🔍 Element ${index}:`, {
        tag: element.tagName,
        classes: element.className,
        dataId: element.getAttribute('data-id'),
        dataCategory: element.getAttribute('data-category'),
        text: element.textContent?.substring(0, 50) + '...',
        size: `${rect.width}x${rect.height}`,
        position: `(${rect.left}, ${rect.top})`
      });
      
      // Temporarily relaxed filtering - just require some size and text
      const isValidWorkspaceBlock = (
        rect.width > 10 &&
        rect.height > 10 &&
        element.textContent &&
        element.textContent.trim().length > 0
      );
      
      if (!isValidWorkspaceBlock) {
        console.log(`[SPIKE Advisor] ❌ Filtering out element ${index}: size(${rect.width}x${rect.height}) text="${element.textContent?.substring(0, 20)}"`);
        return;
      }
      
      // Extract meaningful information from the block
      const dataId = element.getAttribute('data-id');
      
      // Get text more selectively - only from immediate text nodes, not nested blocks
      const textData = getBlockOwnTextAndColor(element);
      const text = textData.text;
      const detectedColor = textData.color;
      const dataCategory = element.getAttribute('data-category');
      
      // Skip blocks without meaningful content
      if (!text || text.length < 2) {
        console.log(`[SPIKE Advisor] ❌ Skipping block with no text: "${text}"`);
        return;
      }
      
      // Skip meaningless/invalid blocks
      if (isMeaninglessBlock(text)) {
        console.log(`[SPIKE Advisor] ❌ Skipping meaningless block: "${text}"`);
        return;
      }
      
      // Create block data
      const blockData = {
        id: dataId || `workspace_block_${index}`,
        type: dataCategory || detectBlockType(text),
        category: dataCategory || detectBlockCategory(text),
        text: cleanBlockText(text, detectedColor),
        x: rect.left - workspaceRect.left,
        y: rect.top - workspaceRect.top,
        width: rect.width,
        height: rect.height,
        isInWorkspace: true
      };
      
      console.log(`[SPIKE Advisor] ✅ Valid workspace block ${blocks.length + 1}:`, {
        type: blockData.type,
        text: blockData.text.substring(0, 40) + '...',
        position: `(${Math.round(blockData.x)}, ${Math.round(blockData.y)})`,
        size: `${Math.round(blockData.width)}x${Math.round(blockData.height)}`
      });
      
      blocks.push(blockData);
      
    } catch (error) {
      console.warn(`[SPIKE Advisor] ⚠️ Error processing element ${index}:`, error);
    }
  });
  
  console.log(`[SPIKE Advisor] 🎉 Successfully extracted ${blocks.length} visible workspace blocks`);
  return blocks;
}

// Helper function to detect block type from text content
function detectBlockType(text: string): string {
  const lowerText = text.toLowerCase();
  
  if (lowerText.includes('when program starts')) return 'event_start';
  if (lowerText.includes('set speed') && lowerText.includes('motor')) return 'motor_speed';
  if (lowerText.includes('run') && lowerText.includes('motor')) return 'motor_run';
  if (lowerText.includes('forever')) return 'control_forever';
  if (lowerText.includes('repeat')) return 'control_repeat';
  if (lowerText.includes('turn on') && lowerText.includes('second')) return 'light_on';
  if (lowerText.includes('move') && lowerText.includes('rotation')) return 'movement_move';
  if (lowerText.includes('start moving')) return 'movement_start';
  if (lowerText.includes('stop moving')) return 'movement_stop';
  
  return 'unknown';
}

// Helper function to get only the block's own text, not nested children text
function getBlockOwnTextAndColor(element: Element): { text: string; color: string | null } {
  // Strategy: Get text from direct text nodes and .blocklyText elements within this block,
  // but avoid text from deeply nested child blocks
  
  const textParts: string[] = [];
  let detectedColor: string | null = null;
  
  // Look for .blocklyText elements (these usually contain the block's display text)
  const textElements = element.querySelectorAll('.blocklyText');
  textElements.forEach(textEl => {
    const text = textEl.textContent?.trim();
    if (text && text.length > 0) {
      textParts.push(text);
    }
  });
  
  // Also look for color indicators - check for colored elements that might represent color values
  // Use a broader search including ANY element with fill attribute
  const colorElements = element.querySelectorAll('[fill]:not([fill="none"]):not([fill=""])');
  console.log('[SPIKE Advisor] 🔍 Found', colorElements.length, 'color elements in block');
  
  // Also check for "no color" indicators
  const noColorElements = element.querySelectorAll('.lls-color-selector__outer.no-color, .is-current');
  if (noColorElements.length > 0) {
    console.log('[SPIKE Advisor] 🔍 Found potential no-color indicator');
    textParts.push('no color');
    detectedColor = 'no color';
  }
  
  colorElements.forEach(colorEl => {
    const fill = colorEl.getAttribute('fill');
    const style = colorEl.getAttribute('style');
    
    console.log('[SPIKE Advisor] 🎨 Found color element:', {
      tag: colorEl.tagName,
      fill: fill,
      style: style,
      classes: colorEl.className
    });
    
    if (fill) {
      const colorName = getColorName(fill);
      if (colorName && !detectedColor) {
        console.log('[SPIKE Advisor] ✅ Detected color:', colorName);
        detectedColor = colorName;
        textParts.push(colorName);
      }
    }
    
    // Also check style attribute for color information
    if (style && style.includes('fill:') && !detectedColor) {
      const styleColorMatch = style.match(/fill:\s*([^;]+)/);
      if (styleColorMatch) {
        const styleColor = styleColorMatch[1].trim();
        const colorName = getColorName(styleColor);
        if (colorName) {
          console.log('[SPIKE Advisor] ✅ Detected color from style:', colorName);
          detectedColor = colorName;
          textParts.push(colorName);
        }
      }
    }
  });
  
  // If no .blocklyText found, try to get text from immediate children only
  if (textParts.length === 0) {
    // Get text from direct text nodes and immediate child text elements
    const walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
          // Only accept text nodes that are close to the root element
          const depth = getNodeDepth(node, element);
          return depth <= 3 ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
        }
      }
    );
    
    let node;
    while (node = walker.nextNode()) {
      const text = node.textContent?.trim();
      if (text && text.length > 0 && !text.includes('blockly')) {
        textParts.push(text);
      }
    }
  }
  
  // Join and clean the text
  let result = textParts.join(' ').trim();
  
  // Remove duplicates and clean up
  const words = result.split(/\s+/).filter((word, index, arr) => 
    word.length > 0 && arr.indexOf(word) === index
  );
  
  const finalText = words.join(' ');
  
  console.log('[SPIKE Advisor] 📝 Extracted text parts:', textParts);
  console.log('[SPIKE Advisor] 📝 Final text:', finalText);
  console.log('[SPIKE Advisor] 🎨 Detected color:', detectedColor);
  
  return { text: finalText, color: detectedColor };
}

// Helper function to get the depth of a node relative to root
function getNodeDepth(node: Node, root: Element): number {
  let depth = 0;
  let current = node.parentNode;
  while (current && current !== root && depth < 10) {
    depth++;
    current = current.parentNode;
  }
  return depth;
}

// Helper function to convert hex/rgb colors to readable color names
function getColorName(fill: string): string | null {
  const colorMap: { [key: string]: string } = {
    // SPIKE Prime exact colors from CSS inspection
    // Red
    '#ff000c': 'red',
    '#ff0000': 'red',
    
    // Pink - rgb(231, 0, 167)
    '#e700a7': 'pink',
    
    // Dark Blue - rgb(0, 144, 245) 
    '#0090f5': 'blue',
    '#0000ff': 'blue',
    
    // Light Blue - rgb(119, 232, 255)
    '#77e8ff': 'light blue',
    
    // Green - rgb(0, 168, 69)
    '#00a845': 'green',
    '#00ff00': 'green',
    
    // Yellow - rgb(255, 227, 96)
    '#ffe360': 'yellow',
    '#ffff00': 'yellow',
    
    // White - rgb(255, 255, 255)
    '#ffffff': 'white',
    
    // Black - rgb(0, 0, 0)
    '#000000': 'black',
    
    // Additional common variations
    '#ff4444': 'red',
    '#cc0000': 'red',
    '#4444ff': 'blue',
    '#0066cc': 'blue',
    '#44ff44': 'green',
    '#00cc00': 'green',
    '#ffff44': 'yellow',
    '#ffd700': 'yellow',
    '#f5f5f5': 'white',
    '#333333': 'black'
  };
  
  const normalizedFill = fill.toLowerCase().trim();
  
  console.log('[SPIKE Advisor] 🔍 Color analysis for:', fill, '→ normalized:', normalizedFill);
  
  // Direct match
  if (colorMap[normalizedFill]) {
    console.log('[SPIKE Advisor] ✅ Direct color match:', normalizedFill, '→', colorMap[normalizedFill]);
    return colorMap[normalizedFill];
  } else {
    console.log('[SPIKE Advisor] ❌ No direct match for:', normalizedFill);
    console.log('[SPIKE Advisor] 📋 Available colors:', Object.keys(colorMap).slice(0, 10));
  }
  
      // Try to match RGB values
    if (normalizedFill.startsWith('rgb')) {
      const rgbMatch = normalizedFill.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
      if (rgbMatch) {
        const [, r, g, b] = rgbMatch.map(Number);
        
        console.log('[SPIKE Advisor] 🔍 Analyzing RGB:', { r, g, b });
        
        // SPIKE Prime exact RGB color detection (based on CSS values)
        
        // Pink: rgb(231, 0, 167)
        if (r > 220 && g < 20 && b > 150 && b < 180) return 'pink';
        
        // Red: rgb(255, 0, 12) or similar high red
        if (r > 240 && g < 30 && b < 30) return 'red';
        
        // Dark Blue: rgb(0, 144, 245)
        if (r < 30 && g > 130 && g < 160 && b > 230) return 'blue';
        
        // Light Blue: rgb(119, 232, 255)
        if (r > 100 && r < 140 && g > 220 && b > 240) return 'light blue';
        
        // Green: rgb(0, 168, 69)  
        if (r < 30 && g > 150 && g < 180 && b > 60 && b < 80) return 'green';
        
        // Yellow: rgb(255, 227, 96)
        if (r > 240 && g > 220 && b > 80 && b < 110) return 'yellow';
        
        // White: rgb(255, 255, 255)
        if (r > 240 && g > 240 && b > 240) return 'white';
        
        // Black: rgb(0, 0, 0)
        if (r < 30 && g < 30 && b < 30) return 'black';
        
        // Fallback: General color detection
        if (r > 180 && g < 100 && b < 100) return 'red';
        if (r < 100 && g < 100 && b > 180) return 'blue';
        if (r < 100 && g > 180 && b < 100) return 'green';
        if (r > 180 && g > 180 && b < 100) return 'yellow';
        
        console.log('[SPIKE Advisor] ❌ No RGB color match for:', { r, g, b });
      }
    }
  
  return null;
}

// Helper function to check if a block is meaningless and should be filtered out
function isMeaninglessBlock(text: string): boolean {
  const trimmedText = text.trim().toLowerCase();
  
  // Skip blocks that are just numbers and colors (like "0 white")
  if (/^\d+\s+(white|black|red|blue|green|yellow|pink)$/i.test(trimmedText)) {
    return true;
  }
  
  // Skip blocks that are just single numbers or colors
  if (/^\d+$/i.test(trimmedText) || /^(white|black|red|blue|green|yellow|pink)$/i.test(trimmedText)) {
    return true;
  }
  
  // Skip blocks with only non-alphanumeric characters
  if (!/[a-zA-Z0-9]/.test(trimmedText)) {
    return true;
  }
  
  // Skip blocks that are too short and don't contain meaningful words
  if (trimmedText.length < 4 && !['if', 'go', 'run', 'stop'].includes(trimmedText)) {
    return true;
  }
  
  // Skip blocks that look like UI elements or tool tips
  if (trimmedText.includes('blockly') || trimmedText.includes('tooltip') || trimmedText.includes('flyout')) {
    return true;
  }
  
  return false;
}

// Helper function to detect block category from text content
function detectBlockCategory(text: string): string {
  const lowerText = text.toLowerCase();
  
  if (lowerText.includes('when') && lowerText.includes('start')) return 'flipperevents';
  if (lowerText.includes('if') || (lowerText.includes('closer than') && lowerText.includes('then'))) return 'flippercontrol';
  if (lowerText.includes('closer than') && !lowerText.includes('if')) return 'flippersensors';
  if (lowerText.includes('motor') || lowerText.includes('speed') || lowerText.includes('start motor')) return 'flippermotor';
  if (lowerText.includes('move') || lowerText.includes('rotation')) return 'movement';
  if (lowerText.includes('forever') || lowerText.includes('repeat')) return 'flippercontrol';
  if (lowerText.includes('light') || lowerText.includes('turn on')) return 'flipperlight';
  if (lowerText.includes('sound') || lowerText.includes('beep')) return 'flippersound';
  
  return 'unknown';
}

// Helper function to clean and format block text
function cleanBlockText(text: string, detectedColor?: string | null): string {
  // Remove extra whitespace and normalize
  let cleaned = text.replace(/\s+/g, ' ').trim();
  
  // Handle specific SPIKE Prime block patterns
  if (cleaned.includes('when program starts')) {
    cleaned = 'when program starts';
  } else if (cleaned.includes('set speed')) {
    // Extract motor and speed: "B set speed to 75 %"
    const motorMatch = cleaned.match(/([A-F])/);
    const speedMatch = cleaned.match(/(\d+)/);
    if (motorMatch && speedMatch) {
      cleaned = `Motor ${motorMatch[1]}: set speed to ${speedMatch[1]}%`;
    }
  } else if (cleaned.includes('forever')) {
    cleaned = 'forever';
  } else if (cleaned.includes('repeat') && cleaned.includes('10')) {
    cleaned = 'repeat 10 times';
  } else if (cleaned.includes('turn on') && cleaned.includes('second')) {
    const timeMatch = cleaned.match(/(\d+)/);
    const time = timeMatch ? timeMatch[1] : '2';
    cleaned = `turn on for ${time} seconds`;
  } else if (cleaned.includes('if') || cleaned.includes('then')) {
    // Handle conditional blocks - extract the complete if-then structure
    if (cleaned.includes('closer than')) {
      const distanceMatch = cleaned.match(/(\d+)/);
      const distance = distanceMatch ? distanceMatch[1] : 'unknown';
      cleaned = `if sensor closer than ${distance}%`;
    } else if (cleaned.includes('color') && cleaned.includes('stop motor')) {
      // Handle if-then with color sensor and motor action
      const motorMatch = cleaned.match(/([A-F])/);
      const colorMatch = cleaned.match(/(red|blue|light blue|green|yellow|white|black|pink|no color)/i);
      if (motorMatch && colorMatch) {
        cleaned = `if Motor ${motorMatch[1]} is color ${colorMatch[1].toLowerCase()} then stop motor`;
      } else if (motorMatch) {
        cleaned = `if Motor ${motorMatch[1]} is color (unknown) then stop motor`;
      } else {
        cleaned = 'if color condition then stop motor';
      }
    } else {
      cleaned = 'if (condition) then (action)';
    }
  } else if (cleaned.includes('closer than') && !cleaned.includes('if')) {
    // Handle sensor blocks separately
    const distanceMatch = cleaned.match(/(\d+)/);
    const distance = distanceMatch ? distanceMatch[1] : 'unknown';
    cleaned = `sensor: closer than ${distance}%`;
    } else if (cleaned.includes('is color') || (cleaned.includes('color') && cleaned.match(/[A-F]/))) {
    // Handle color sensor blocks specifically
    const motorMatch = cleaned.match(/([A-F])/);
    
    // First try to use the visually detected color, then fall back to text color
    const textColorMatch = cleaned.match(/(red|blue|light blue|green|yellow|white|black|pink|no color)/i);
    const finalColor = detectedColor || (textColorMatch ? textColorMatch[1] : null);
    
    // If we have both motor and color, use them
    if (motorMatch && finalColor) {
      cleaned = `Sensor ${motorMatch[1]} is color ${finalColor.toLowerCase()}`;
      console.log('[SPIKE Advisor] ✅ Used color:', finalColor, '(detected:', detectedColor, ', text:', textColorMatch?.[1], ')');
    } else if (motorMatch) {
      // If we have motor but no detected color, indicate unknown
      cleaned = `Sensor ${motorMatch[1]} is color (unknown)`;
      console.log('[SPIKE Advisor] ⚠️ Motor detected but no color found for:', motorMatch[1]);
    } else {
      cleaned = 'color sensor';
    }
  } else if (cleaned.includes('start motor')) {
    // Handle start motor blocks
    const motorMatch = cleaned.match(/([A-F])/);
    const directionMatch = cleaned.match(/(forward|backward)/);
    if (motorMatch) {
      const direction = directionMatch ? directionMatch[1] : 'forward';
      cleaned = `Motor ${motorMatch[1]}: start motor ${direction}`;
    }
  } else if (cleaned.includes('move') && cleaned.includes('for') && cleaned.includes('rotation')) {
    // Handle move for rotations blocks
    const rotationsMatch = cleaned.match(/(\d+)/);
    const rotations = rotationsMatch ? rotationsMatch[1] : 'unknown';
    cleaned = `Move forward for ${rotations} rotations`;
  }
  
  return cleaned;
}

// Send block data to popup
function sendBlockDataToPopup(blocks: any[]) {
  if (!isExtensionContextValid()) return;
  
  try {
    const data = {
      blocks: blocks,
      text: blocks.map(b => b.text).join(' | '),
      timestamp: Date.now(),
      method: 'Visual Workspace Detection'
    };
    
    chrome.runtime.sendMessage({
      type: 'BLOCK_DATA_UPDATE',
      data: data
    }).catch(() => {
      // Popup might not be open, that's okay
    });
    
    console.log(`[SPIKE Advisor] ✅ Sent ${blocks.length} blocks to popup (via Visual Detection)`);
  } catch (error) {
    console.error('[SPIKE Advisor] ❌ Error sending block data:', error);
  }
}

// Main detection and monitoring
function startVisualBlockDetection() {
  console.log('[SPIKE Advisor] 🚀 Starting visual workspace block detection...');
  
  const performDetection = () => {
    const blocks = extractVisibleWorkspaceBlocks();
    sendBlockDataToPopup(blocks);
  };
  
  // Initial detection after a delay
  setTimeout(performDetection, 2000);
  
  // Set up periodic monitoring every 3 seconds
  setInterval(performDetection, 3000);
  
  // Set up message listener for manual refresh
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === "REQUEST_BLOCKS") {
      console.log('[SPIKE Advisor] 🔄 Manual refresh requested');
      const currentBlocks = extractVisibleWorkspaceBlocks();
      sendResponse({
        blocks: currentBlocks,
        text: currentBlocks.map(b => b.text).join(' | '),
        timestamp: Date.now()
      });
    }
  });
}

// Initialize the script
function initialize() {
  if (!isExtensionContextValid()) {
    console.log('[SPIKE Advisor] ❌ Extension context not valid, skipping initialization');
    return;
  }
  
  console.log('[SPIKE Advisor] 🎯 Content script loaded - Visual Workspace Detection');
  
  // Start detection after DOM is ready
  setTimeout(startVisualBlockDetection, 1000);
}

// Start when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
} 