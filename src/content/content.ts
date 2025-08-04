// SPIKE Advisor Content Script - Visual Workspace Block Detection
// This script runs on SPIKE Prime pages to detect ONLY blocks in the visible workspace

console.log('[SPIKE Advisor] 🚀 NEW CONTENT SCRIPT LOADED - VERSION 2.0 - BLOCKLY API INTEGRATION');
console.log('[SPIKE Advisor] 📅 Loaded at:', new Date().toISOString());

// Check if we're in a valid extension context
function isExtensionContextValid(): boolean {
  return typeof chrome !== "undefined" && 
         chrome.runtime && 
         chrome.runtime.id !== undefined;
}

// Enhanced function to extract blocks using Blockly API with hierarchical structure
function extractBlocklyHierarchy(): any {
  console.log('[SPIKE Advisor] 🎯 Extracting Blockly hierarchy using API...');
  console.log('[SPIKE Advisor] 🌐 Current page URL:', window.location.href);
  console.log('[SPIKE Advisor] 🌐 Available global objects with "block":', Object.keys(window).filter(k => k.toLowerCase().includes('block')));
  
  try {
    // Try to access Blockly workspace through various methods
    let workspace = null;
    
    // Method 1: Check for global Blockly object
    if (typeof (window as any).Blockly !== 'undefined') {
      const Blockly = (window as any).Blockly;
      workspace = Blockly.getMainWorkspace();
      console.log('[SPIKE Advisor] ✅ Found Blockly via window.Blockly');
      console.log('[SPIKE Advisor] 🔧 Blockly methods:', Object.getOwnPropertyNames(Blockly).slice(0, 10));
    }
    
    // Method 2: Check for workspace in various locations
    if (!workspace) {
      const possibleWorkspaces = [
        (window as any).workspace,
        (window as any).blocklyWorkspace,
        (window as any).Blockly?.workspace,
        (window as any).app?.workspace,
        (window as any).Blockly?.getMainWorkspace?.(),
        (window as any).editor?.workspace, // SPIKE Prime might use this
        (window as any).spike?.workspace   // SPIKE Prime specific
      ];
      
      for (const ws of possibleWorkspaces) {
        if (ws && typeof ws.getAllBlocks === 'function') {
          workspace = ws;
          console.log('[SPIKE Advisor] ✅ Found workspace via alternative method');
          break;
        }
      }
    }
    
    if (!workspace) {
      console.log('[SPIKE Advisor] ❌ Could not access Blockly workspace, falling back to visual extraction');
      console.log('[SPIKE Advisor] 🔍 Available global objects:', Object.keys(window).filter(k => k.toLowerCase().includes('block')));
      console.log('[SPIKE Advisor] 🔍 Window.Blockly:', typeof (window as any).Blockly);
      return extractVisibleWorkspaceBlocksVisual();
    }
    
    console.log('[SPIKE Advisor] 🎉 Successfully accessed Blockly workspace');
    console.log('[SPIKE Advisor] 🔧 Workspace type:', typeof workspace);
    console.log('[SPIKE Advisor] 🔧 Workspace methods:', Object.getOwnPropertyNames(workspace).slice(0, 10));
    
    // Get all top-level blocks (blocks without parents)
    const allBlocks = workspace.getAllBlocks();
    const topLevelBlocks = allBlocks.filter((block: any) => !block.getParent());
    
    console.log(`[SPIKE Advisor] 📊 Found ${allBlocks.length} total blocks, ${topLevelBlocks.length} top-level`);
    console.log('[SPIKE Advisor] 🧩 Block types found:', allBlocks.map((b: any) => b.type).slice(0, 5));
    
    // Build hierarchical structure
    const hierarchy = {
      programStructure: buildProgramStructure(topLevelBlocks),
      flatBlocks: allBlocks.map((block: any) => extractBlockData(block)),
      blockTree: topLevelBlocks.map((block: any) => buildBlockTree(block)),
      pseudoCode: generatePseudoCode(topLevelBlocks)
    };
    
    console.log('[SPIKE Advisor] 🌳 Built hierarchical structure:', hierarchy);
    return hierarchy;
    
  } catch (error) {
    console.error('[SPIKE Advisor] ❌ Error accessing Blockly API:', error);
    return extractVisibleWorkspaceBlocksVisual();
  }
}

// Build a tree structure for a block and its children
function buildBlockTree(block: any): any {
  const blockData = extractBlockData(block);
  
  // Get children blocks
  const children: any[] = [];
  
  // For IF blocks, explicitly capture then/else branches
  // Enhanced SPIKE Prime if/then detection
  const isIfBlock = block.type === 'controls_if' || 
                   block.type === 'control_if' ||
                   block.getFieldValue?.('OP') === 'IF' ||
                   (block.type && (block.type.includes('if') || block.type.includes('condition'))) ||
                   (blockData.text && blockData.text.toLowerCase().includes('if') && blockData.text.toLowerCase().includes('then'));
  
  if (isIfBlock) {
    const thenBranch = block.getInput?.('DO')?.connection?.targetBlock() || 
                      block.getInput?.('STATEMENT')?.connection?.targetBlock();
    const elseBranch = block.getInput?.('ELSE')?.connection?.targetBlock();
    
    if (thenBranch) {
      children.push({
        branch: 'then',
        blocks: buildSequence(thenBranch)
      });
    }
    
    if (elseBranch) {
      children.push({
        branch: 'else', 
        blocks: buildSequence(elseBranch)
      });
    }
  } else {
    // For other blocks, get regular children
    const nextBlock = block.getNextBlock?.();
    if (nextBlock) {
      children.push(buildBlockTree(nextBlock));
    }
    
    // Get nested statement blocks
    const inputList = block.inputList || [];
    for (const input of inputList) {
      if (input.type === 5) { // STATEMENT_INPUT
        const connectedBlock = input.connection?.targetBlock();
        if (connectedBlock) {
          children.push(buildBlockTree(connectedBlock));
        }
      }
    }
  }
  
  return {
    ...blockData,
    children: children,
    nestingLevel: getNestingLevel(block),
    isTopLevel: !block.getParent()
  };
}

// Build a sequence of connected blocks
function buildSequence(startBlock: any): any[] {
  const sequence: any[] = [];
  let currentBlock = startBlock;
  
  while (currentBlock) {
    sequence.push(buildBlockTree(currentBlock));
    currentBlock = currentBlock.getNextBlock?.();
  }
  
  return sequence;
}

// Extract block data using Blockly API
function extractBlockData(block: any): any {
  const blockType = block.type || 'unknown';
  let text = '';
  
  // Extract text from block fields
  const fieldValues = [];
  
  // Get field values
  if (block.getFieldValue) {
    try {
      // Common field names in SPIKE blocks
      const commonFields = ['TEXT', 'VALUE', 'SPEED', 'MOTOR', 'SENSOR', 'COLOR', 'DISTANCE'];
      for (const fieldName of commonFields) {
        try {
          const value = block.getFieldValue(fieldName);
          if (value !== null && value !== undefined && value !== '') {
            fieldValues.push(`${fieldName}:${value}`);
          }
        } catch (e) {
          // Field doesn't exist, continue
        }
      }
    } catch (e) {
      console.warn('[SPIKE Advisor] Could not extract field values:', e);
    }
  }
  
  // Build human-readable text
  text = generateBlockText(block, blockType);
  
  return {
    id: block.id || `block_${Math.random().toString(36).substr(2, 9)}`,
    type: blockType,
    category: getBlockCategory(blockType),
    text: text,
    fieldValues: fieldValues,
    isTopLevel: !block.getParent(),
    hasChildren: (block.getChildren?.()?.length || 0) > 0,
    nextBlock: block.getNextBlock?.()?.id || null,
    parentBlock: block.getParent?.()?.id || null
  };
}

// Generate human-readable text for a block
function generateBlockText(block: any, blockType: string): string {
  try {
    // Handle different block types
    switch (blockType) {
      case 'event_whenprogramstarts':
        return 'when program starts';
        
      case 'control_if':
      case 'controls_if':
        return 'if (condition) then (action)';
        
      case 'motion_motor_on':
        const motor = block.getFieldValue?.('MOTOR') || 'A';
        const speed = block.getFieldValue?.('SPEED') || '75';
        return `Motor ${motor}: set speed to ${speed}%`;
        
      case 'motion_motor_run_for':
        const rotations = block.getFieldValue?.('ROTATIONS') || '10';
        return `Move forward for ${rotations} rotations`;
        
      case 'motion_stop':
        return 'Stop moving';
        
      case 'sensing_color':
        const sensor = block.getFieldValue?.('SENSOR') || 'A';
        const color = block.getFieldValue?.('COLOR') || 'red';
        return `Sensor ${sensor}: is color ${color}`;
        
      default:
        // Fallback: try to extract text from the block
        const blockText = block.toString?.() || block.type || 'unknown block';
        return blockText.replace(/[^\w\s:%-]/g, '').trim();
    }
  } catch (e) {
    console.warn('[SPIKE Advisor] Error generating block text:', e);
    return blockType || 'unknown block';
  }
}

// Get nesting level of a block
function getNestingLevel(block: any): number {
  let level = 0;
  let parent = block.getParent?.();
  
  while (parent) {
    level++;
    parent = parent.getParent?.();
  }
  
  return level;
}

// Get block category based on type
function getBlockCategory(blockType: string): string {
  if (blockType.includes('event')) return 'flipperevents';
  if (blockType.includes('motion') || blockType.includes('motor')) return 'flippermotor';
  if (blockType.includes('control') || blockType.includes('if')) return 'flippercontrol';
  if (blockType.includes('sensing') || blockType.includes('sensor')) return 'sensors';
  if (blockType.includes('sound')) return 'flippersound';
  if (blockType.includes('light')) return 'flipperlight';
  return 'unknown';
}

// Generate pseudo-code representation
function generatePseudoCode(topLevelBlocks: any[]): string {
  let pseudoCode = '';
  
  for (const block of topLevelBlocks) {
    pseudoCode += generateBlockPseudoCode(block, 0) + '\n';
  }
  
  return pseudoCode;
}

// Generate pseudo-code for a single block and its children
function generateBlockPseudoCode(block: any, indentLevel: number): string {
  const indent = '  '.repeat(indentLevel);
  const blockText = generateBlockText(block, block.type);
  let pseudoCode = indent + blockText;
  
  // Handle IF blocks specially - Enhanced SPIKE Prime detection
  const isIfBlock = block.type === 'controls_if' || 
                   block.type === 'control_if' ||
                   block.getFieldValue?.('OP') === 'IF' ||
                   (block.type && (block.type.includes('if') || block.type.includes('condition'))) ||
                   (blockText && blockText.toLowerCase().includes('if') && blockText.toLowerCase().includes('then'));
  
  if (isIfBlock) {
    const thenBranch = block.getInput?.('DO')?.connection?.targetBlock() || 
                      block.getInput?.('STATEMENT')?.connection?.targetBlock();
    const elseBranch = block.getInput?.('ELSE')?.connection?.targetBlock();
    
    if (thenBranch) {
      pseudoCode += ':\n';
      let currentBlock = thenBranch;
      while (currentBlock) {
        pseudoCode += generateBlockPseudoCode(currentBlock, indentLevel + 1) + '\n';
        currentBlock = currentBlock.getNextBlock?.();
      }
    }
    
    if (elseBranch) {
      pseudoCode += indent + 'else:\n';
      let currentBlock = elseBranch;
      while (currentBlock) {
        pseudoCode += generateBlockPseudoCode(currentBlock, indentLevel + 1) + '\n';
        currentBlock = currentBlock.getNextBlock?.();
      }
    }
  } else {
    // Handle next blocks in sequence
    const nextBlock = block.getNextBlock?.();
    if (nextBlock) {
      pseudoCode += '\n' + generateBlockPseudoCode(nextBlock, indentLevel);
    }
  }
  
  return pseudoCode;
}

// Build high-level program structure
function buildProgramStructure(topLevelBlocks: any[]): any {
  const structure = {
    entryPoints: [],
    conditionals: [],
    loops: [],
    sequences: []
  };
  
  for (const block of topLevelBlocks) {
    analyzeBlockStructure(block, structure);
  }
  
  return structure;
}

// Analyze block structure recursively
function analyzeBlockStructure(block: any, structure: any): void {
  const blockType = block.type;
  
  if (blockType.includes('event')) {
    structure.entryPoints.push(generateBlockText(block, blockType));
  } else if (blockType.includes('if') || blockType.includes('control')) {
    structure.conditionals.push(generateBlockText(block, blockType));
  } else if (blockType.includes('repeat') || blockType.includes('forever')) {
    structure.loops.push(generateBlockText(block, blockType));
  }
  
  // Recursively analyze children
  const children = block.getChildren?.() || [];
  for (const child of children) {
    analyzeBlockStructure(child, structure);
  }
  
  const nextBlock = block.getNextBlock?.();
  if (nextBlock) {
    analyzeBlockStructure(nextBlock, structure);
  }
}

// Fallback to visual extraction if Blockly API fails
// Helper function to extract clean text from an element
/* REMOVED - no longer used
function extractTextFromElement(element: Element): string {
  // Get text content but filter out nested block text
  const walker = document.createTreeWalker(
    element,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: function(node) {
        // Only accept direct text nodes
        return node.parentElement === element ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    }
  );
  
  const textParts: string[] = [];
  let node;
  while (node = walker.nextNode()) {
    const text = node.textContent?.trim();
    if (text && text.length > 0) {
      textParts.push(text);
    }
  }
  
  return textParts.join(' ').trim();
}
*/

// Note: extractNestedConditionals functionality moved to inline processing
/* REMOVED - old function moved to inline processing
function extractNestedConditionals_OLD(element: Element): any[] {
  
  console.log(`[SPIKE Advisor] 🔍 Found ${controlBlocks.length} control blocks to analyze for nested conditionals`);
  
  for (const controlBlock of controlBlocks) {
    const blockText = extractTextFromElement(controlBlock);
    console.log(`[SPIKE Advisor] 🔍 Analyzing control block:`, blockText);
    
    // Enhanced conditional detection - check for nested sensor/action structure FIRST
    const sensorElements = controlBlock.querySelectorAll('[data-category="flippersensors"], [data-category="sensors"]');
    const actionElements = controlBlock.querySelectorAll('[data-category="flippermove"], [data-category="movement"], [data-category="flippermotor"]');
    
    // If we have nested sensor and action blocks, this is definitely a conditional
    const hasNestedStructure = sensorElements.length > 0 && actionElements.length > 0;
    
    // Check if this is an if/then control block - but prioritize structural detection
    const hasIfThen = blockText.toLowerCase().includes('if') && blockText.toLowerCase().includes('then');
    const hasQuestionMark = blockText.includes('?'); // SPIKE Prime uses ? for conditionals
    
    // CRITICAL: Prioritize structural detection over text analysis
    const isConditional = hasNestedStructure || hasIfThen || hasQuestionMark;
    
    console.log(`[SPIKE Advisor] 🔍 Conditional detection:`, {
      hasIfThen,
      hasQuestionMark, 
      hasNestedStructure,
      sensorCount: sensorElements.length,
      actionCount: actionElements.length,
      isConditional
    });
    
    if (isConditional) {
      console.log(`[SPIKE Advisor] ✅ Detected conditional control block`);
      
      // Use the elements we already found
      const sensorBlocks = sensorElements;
      const actionBlocks = actionElements;
      console.log(`[SPIKE Advisor] 🔍 Using ${sensorBlocks.length} sensor blocks and ${actionBlocks.length} action blocks inside control`);
      
      let sensorCondition = '';
      let action = '';
      
      // Extract sensor condition with visual color detection - prioritize actual sensor block
      for (const sensorBlock of sensorBlocks) {
        const sensorData = getBlockOwnTextAndColor(sensorBlock);
        const sensorText = sensorData.text;
        const detectedColor = sensorData.color;
        console.log(`[SPIKE Advisor] 🔍 NESTED SENSOR DEBUG:`, {
          text: sensorText,
          visualColor: detectedColor,
          elementTag: sensorBlock.tagName,
          elementId: sensorBlock.getAttribute('data-id'),
          elementCategory: sensorBlock.getAttribute('data-category')
        });
        
        // Debug: Check all color-related attributes in this nested sensor block
        const fills = Array.from(sensorBlock.querySelectorAll('*')).map(el => el.getAttribute('fill')).filter(Boolean);
        console.log(`[SPIKE Advisor] 🎨 Fill attributes in nested sensor:`, fills);
        
        if (sensorText.includes('color') || sensorText.includes('distance') || sensorText.includes('pressed')) {
          // Start with the original text
          sensorCondition = sensorText;
          
          // CRITICAL: Prioritize the sensor block's own visual color detection
          // The sensor block itself should have the correct color, don't use parent's potentially contaminated color
          
          // If we detected a visual color from the sensor block itself, use it
          if (detectedColor && sensorText.includes('color')) {
            // Extract the sensor port
            const portMatch = sensorText.match(/([A-F])/);
            if (portMatch) {
              // Reconstruct the sensor condition with the visual color
              sensorCondition = `Sensor ${portMatch[1]} is color ${detectedColor}`;
              console.log(`[SPIKE Advisor] 🎨 Reconstructed sensor condition with visual color: ${sensorCondition}`);
            } else {
              // Fallback: replace any existing color words
              sensorCondition = sensorText.replace(/(red|blue|green|yellow|white|black|pink)/gi, detectedColor);
              console.log(`[SPIKE Advisor] 🔄 Replaced color in sensor text: ${sensorCondition}`);
            }
          }
          
          console.log(`[SPIKE Advisor] ✅ Final sensor condition:`, sensorCondition);
          break;
        }
      }
      
      // Extract action
      for (const actionBlock of actionBlocks) {
        const actionData = getBlockOwnTextAndColor(actionBlock);
        const actionText = actionData.text;
        console.log(`[SPIKE Advisor] 🔍 Checking action block:`, actionText);
        if (actionText.includes('move') || actionText.includes('rotation') || actionText.includes('motor')) {
          action = actionText;
          console.log(`[SPIKE Advisor] ✅ Found action:`, action);
          break;
        }
      }
      
      // If we found both sensor and action, create enhanced conditional
      if (sensorCondition && action) {
        console.log('[SPIKE Advisor] 🔧 Creating conditional from:', { sensorCondition, action });
        
        // Parse sensor condition
        const portMatch = sensorCondition.match(/([A-F])/);
        const colorMatch = sensorCondition.match(/(red|blue|green|yellow|white|black|pink)/i);
        
        console.log('[SPIKE Advisor] 🔍 Parsed from sensor condition:', { 
          port: portMatch?.[1], 
          color: colorMatch?.[1] 
        });
        
        // Parse action
        const rotationMatch = action.match(/(\d+)/);
        
        if (portMatch && colorMatch) {
          let enhancedAction = 'action';
          if (rotationMatch && action.includes('rotation')) {
            enhancedAction = `move for ${rotationMatch[1]} rotations`;
          } else if (action.includes('move')) {
            enhancedAction = 'move';
          } else if (action.includes('motor')) {
            enhancedAction = 'start motor';
          }
          
          const detectedColor = colorMatch[1].toLowerCase();
          const sensorPort = portMatch[1];
          const combinedText = `if Sensor ${sensorPort} is color ${detectedColor} then ${enhancedAction}`;
          
          conditionalBlocks.push({
            id: controlBlock.getAttribute('data-id') || 'nested-conditional',
            text: combinedText,
            category: 'flippercontrol',
            type: 'enhanced_conditional',
            x: parseFloat(controlBlock.getAttribute('transform')?.match(/translate\(([^,]+)/)?.[1] || '0'),
            y: parseFloat(controlBlock.getAttribute('transform')?.match(/translate\([^,]+,([^)]+)/)?.[1] || '0'),
            isInWorkspace: true,
            isEnhancedConditional: true
          });
          
          console.log('[SPIKE Advisor] 🎯 Final conditional created:', combinedText);
          console.log('[SPIKE Advisor] 📋 Components: sensor:', sensorCondition, 'action:', action);
          console.log('[SPIKE Advisor] 🎨 Color used:', detectedColor, 'Port:', sensorPort);
        } else {
          console.log('[SPIKE Advisor] ❌ Failed to parse conditional - missing port or color:', { portMatch, colorMatch });
        }
      }
    }
  }
  
  return conditionalBlocks;
}
*/

function extractVisibleWorkspaceBlocksVisual(): any[] {
  console.log('[SPIKE Advisor] 🎯 Falling back to visual extraction...');
  
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
    '.blocklyBlockCanvas .blocklyDraggable',  // Primary: Draggable blocks in canvas
    '.blocklyBlockCanvas g[data-id]:not([data-id=""])',  // Secondary: Elements with data-id in canvas
    'g.blocklyDraggable',  // Fallback: Any draggable group
    '.blocklyDraggable',   // Fallback: Any draggable element
    '[data-id]',           // Last resort: Any element with data-id
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
  
  // Note: Nested conditionals are now handled directly in the main processing loop below
  const nestedConditionals: any[] = []; // Keep empty for isPartOfConditional check
  console.log(`[SPIKE Advisor] 🎯 Enhanced conditional processing will be handled in main loop`);
  
  // FIRST PASS: Check existing categories and assign only if missing
  console.log(`[SPIKE Advisor] 🔄 First pass: Checking categories on ${blockElements.length} elements`);
  let existingCategories = 0;
  let assignedCategories = 0;
  
  blockElements.forEach((element, index) => {
    const dataCategory = element.getAttribute('data-category');
    if (dataCategory) {
      existingCategories++;
      console.log(`[SPIKE Advisor] ✅ Element ${index} already has data-category="${dataCategory}"`);
    } else {
      const text = element.textContent || '';
      const determinedCategory = detectBlockCategory(text);
      element.setAttribute('data-category', determinedCategory);
      assignedCategories++;
      console.log(`[SPIKE Advisor] 🏷️ Assigned data-category="${determinedCategory}" to element ${index}: "${text.substring(0, 30)}"`);
    }
  });
  
  console.log(`[SPIKE Advisor] 📊 Category summary: ${existingCategories} existing, ${assignedCategories} assigned`);

  // SECOND PASS: Process each element 
  console.log(`[SPIKE Advisor] 🔄 Second pass: Processing elements with categories assigned`);
  blockElements.forEach((element, index) => {
    console.log(`[SPIKE Advisor] 🚀 STARTING PROCESSING for element ${index} (category: ${element.getAttribute('data-category')})`);
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
      // Also exclude blocks that are already part of extracted conditionals
      const isPartOfConditional = nestedConditionals.some(conditional => {
        const conditionalElement = mainWorkspaceSvg.querySelector(`[data-id="${conditional.id}"]`);
        return conditionalElement && conditionalElement.contains(element);
      });
      
      // Extract category before filtering check
      const dataCategory = element.getAttribute('data-category');
      
      const isValidWorkspaceBlock = (
        rect.width > 10 &&
        rect.height > 10 &&
        element.textContent &&
        element.textContent.trim().length > 0 &&
        !isPartOfConditional
      );
      
      // Special case: Always allow control blocks through, even if they fail normal filtering
      const isControlBlock = dataCategory === 'control';
      
      // DEBUG: Log filtering details for all elements
      console.log(`[SPIKE Advisor] 🔍 Element ${index} filtering check:`, {
        dataCategory,
        isControlBlock,
        size: `${rect.width}x${rect.height}`,
        hasText: !!element.textContent,
        textLength: element.textContent?.trim().length || 0,
        isPartOfConditional,
        isValidWorkspaceBlock,
        willProcess: isValidWorkspaceBlock || isControlBlock
      });
      
      // Extract meaningful information from the block
      const dataId = element.getAttribute('data-id');
      
      // SPECIAL DEBUG: Track control blocks specifically
      if (dataCategory === 'control') {
        console.log(`[SPIKE Advisor] 🎮 CONTROL BLOCK FOUND in filtering - Element ${index}:`, {
          id: dataId,
          text: element.textContent?.substring(0, 50),
          willProcess: isValidWorkspaceBlock || isControlBlock,
          filterDetails: { isValidWorkspaceBlock, isControlBlock, isPartOfConditional }
        });
      }
      
      if (!isValidWorkspaceBlock && !isControlBlock) {
        console.log(`[SPIKE Advisor] ❌ Filtering out element ${index}: category="${dataCategory}" size(${rect.width}x${rect.height}) text="${element.textContent?.substring(0, 20)}"`);
        return;
      }
      
      if (isControlBlock) {
        console.log(`[SPIKE Advisor] 🎮 Control block allowed through filter: size(${rect.width}x${rect.height})`);
      }
      
      // Special handling for control blocks - check for nested conditional structure
      if (dataCategory === 'control') {
        console.log(`[SPIKE Advisor] 🎮 CONTROL BLOCK PROCESSING STARTED for element ${index}:`);
        console.log(`[SPIKE Advisor] 🎮 Control block text: "${element.textContent?.substring(0, 50)}"`);
        console.log(`[SPIKE Advisor] 🎮 Control block ID: ${dataId}`);
        
        // Look for nested sensor and action blocks
        const sensorElements = element.querySelectorAll('[data-category="flippersensors"], [data-category="sensors"]');
        const actionElements = element.querySelectorAll('[data-category="flippermove"], [data-category="movement"], [data-category="flippermotor"]');
        
        console.log(`[SPIKE Advisor] 🔎 Found nested elements:`, {
          sensors: Array.from(sensorElements).map(s => ({ category: s.getAttribute('data-category'), text: s.textContent?.substring(0, 30) })),
          actions: Array.from(actionElements).map(a => ({ category: a.getAttribute('data-category'), text: a.textContent?.substring(0, 30) }))
        });
        
        console.log(`[SPIKE Advisor] 🔍 Control block analysis:`, {
          sensorCount: sensorElements.length,
          actionCount: actionElements.length,
          hasNestedStructure: sensorElements.length > 0 && actionElements.length > 0
        });
        
        // If this is a conditional with nested blocks, create enhanced description
        if (sensorElements.length > 0 && actionElements.length > 0) {
          let enhancedText = 'if ';
          let conditionalColor = null;
          
          // Process sensor conditions
          for (const sensorElement of sensorElements) {
            const sensorData = getBlockOwnTextAndColor(sensorElement);
            console.log(`[SPIKE Advisor] 🎯 Sensor in control:`, sensorData);
            
            if (sensorData.text) {
              // Handle color sensors (have both text and color)
              if (sensorData.color) {
                enhancedText += sensorData.text.replace(sensorData.color, sensorData.color);
                conditionalColor = sensorData.color;
              } 
              // Handle reflection/distance sensors - need special parsing
              else {
                let sensorCondition = sensorData.text;
                
                // Parse reflection sensor: "A 50 reflection < % ? white" → "A reflection < 50%"
                if (sensorCondition.includes('reflection')) {
                  const portMatch = sensorCondition.match(/([A-F])/);
                  const numberMatch = sensorCondition.match(/(\d+)/);
                  const operatorMatch = sensorCondition.match(/([<>]=?)/);
                  
                  if (portMatch && numberMatch && operatorMatch) {
                    sensorCondition = `${portMatch[1]} reflection ${operatorMatch[1]} ${numberMatch[1]}%`;
                    console.log(`[SPIKE Advisor] 🔧 Formatted reflection sensor: "${sensorCondition}"`);
                  }
                }
                // Parse distance sensor: similar logic if needed
                else if (sensorCondition.includes('closer')) {
                  const portMatch = sensorCondition.match(/([A-F])/);
                  const numberMatch = sensorCondition.match(/(\d+)/);
                  
                  if (portMatch && numberMatch) {
                    sensorCondition = `${portMatch[1]} is closer than ${numberMatch[1]} cm`;
                    console.log(`[SPIKE Advisor] 🔧 Formatted distance sensor: "${sensorCondition}"`);
                  }
                }
                
                enhancedText += sensorCondition;
                console.log(`[SPIKE Advisor] 📊 Non-color sensor: "${sensorCondition}"`);
              }
            }
          }
          
          enhancedText += ' then ';
          
          // Process action blocks
          for (const actionElement of actionElements) {
            const actionData = getBlockOwnTextAndColor(actionElement);
            console.log(`[SPIKE Advisor] ⚡ Action in control:`, actionData);
            
            if (actionData.text) {
              let actionCondition = actionData.text;
              
              // Clean up action text: "A start motor white" → "start motor"
              if (actionCondition.includes('start motor')) {
                actionCondition = 'start motor';
                console.log(`[SPIKE Advisor] 🔧 Formatted action: "${actionCondition}"`);
              }
              // Handle other action types
              else if (actionCondition.includes('move') || actionCondition.includes('forward')) {
                const speedMatch = actionCondition.match(/(\d+)/);
                if (speedMatch) {
                  actionCondition = `move forward for ${speedMatch[1]} seconds`;
                } else {
                  actionCondition = 'move forward';
                }
                console.log(`[SPIKE Advisor] 🔧 Formatted move action: "${actionCondition}"`);
              }
              // Remove extra color words and port letters from any action
              else {
                actionCondition = actionCondition
                  .replace(/\b[A-F]\s+/g, '') // Remove port letters like "A "
                  .replace(/\s+(white|red|blue|green|yellow)\s*/g, ' ') // Remove color words
                  .trim()
                  .replace(/\s+/g, ' '); // Normalize whitespace
                console.log(`[SPIKE Advisor] 🔧 Cleaned action text: "${actionCondition}"`);
              }
              
              enhancedText += actionCondition;
            }
          }
          
          console.log(`[SPIKE Advisor] ✅ Enhanced control block: "${enhancedText}"`);
          
          // Use the enhanced text and color
          const text = enhancedText;
          const visualColor = conditionalColor;
          
          // Continue with the enhanced block data...
          if (text && text.trim().length > 2) {
            // Use enhanced text directly without cleaning - it's already properly formatted
            const finalText = text.trim();
            
            console.log(`[SPIKE Advisor] 📝 Using enhanced text directly: "${finalText}"`);
            
            blocks.push({
              id: dataId || `block_${Date.now()}_${index}`,
              type: 'flippercontrol', // Use flippercontrol for proper UI categorization
              category: 'flippercontrol', // Ensure category is also set
              text: finalText,
              color: visualColor,
              position: `(${Math.round(rect.left)}, ${Math.round(rect.top)})`,
              size: `${Math.round(rect.width)}x${Math.round(rect.height)}`
            });
            
            console.log(`[SPIKE Advisor] ✅ Valid enhanced control block: {type: 'control', text: '${finalText.substring(0, 30)}...', position: '(${Math.round(rect.left)}, ${Math.round(rect.top)})', size: '${Math.round(rect.width)}x${Math.round(rect.height)}'}`);
          }
          
          console.log(`[SPIKE Advisor] 🛑 Skipping normal processing for enhanced control block ID: ${dataId}`);
          return; // Skip normal processing for this control block
        }
      }
      
      // Get text more selectively - only from immediate text nodes, not nested blocks
      console.log(`[SPIKE Advisor] 📝 Starting normal processing for element: ${dataCategory} ID: ${dataId}`);
      const textData = getBlockOwnTextAndColor(element);
      const text = textData.text;
      const visualColor = textData.color;
      
      // Debug color detection
      if (text.includes('color') && visualColor) {
        console.log(`[SPIKE Advisor] 🎨 Visual color detection: "${text}" -> visual color: ${visualColor}`);
      }
      
      // Special debugging for yellow color detection
      if (text.includes('color') && text.toLowerCase().includes('yellow')) {
        console.log(`[SPIKE Advisor] 🟡 YELLOW DEBUG: text="${text}", visualColor="${visualColor}"`);
        
        // Check if this element has any yellow-related colors
        const allElements = element.querySelectorAll('*');
        for (const el of allElements) {
          const fill = el.getAttribute('fill');
          const style = (el as HTMLElement).style.color || (el as HTMLElement).style.backgroundColor;
          if (fill && (fill.includes('yellow') || fill.includes('#ff') || fill.includes('rgb'))) {
            console.log(`[SPIKE Advisor] 🔍 Found fill attribute:`, fill);
          }
          if (style && (style.includes('yellow') || style.includes('#ff'))) {
            console.log(`[SPIKE Advisor] 🔍 Found style color:`, style);
          }
        }
      }
      const detectedColor = textData.color;
      
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
      
      // Get the already-assigned category from first pass
      const determinedCategory = dataCategory || detectBlockCategory(text);
      
      // Create block data
      const blockData = {
        id: dataId || `workspace_block_${index}`,
        type: dataCategory || detectBlockType(text),
        category: determinedCategory,
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
      console.log(`[SPIKE Advisor] ✅ COMPLETED processing element ${index} (category: ${dataCategory})`);
      
    } catch (error) {
      console.error(`[SPIKE Advisor] ❌ CRITICAL ERROR processing element ${index}:`, {
        error,
        element: {
          dataId: element.getAttribute('data-id'),
          dataCategory: element.getAttribute('data-category'),
          text: element.textContent?.substring(0, 30)
        },
        stack: error instanceof Error ? error.stack : 'No stack trace'
      });
      console.log(`[SPIKE Advisor] 🔄 Continuing with next element...`);
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
  
  // Prioritize color swatches over UI elements
  const colorCandidates: Array<{element: Element, color: string, priority: number}> = [];
  
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
      if (colorName) {
        // Calculate priority: smaller elements (likely color swatches) get higher priority
        const bbox = colorEl.getBoundingClientRect();
        const area = bbox.width * bbox.height;
        
        let priority = 0;
        // Circles are very likely to be color swatches
        if (colorEl.tagName === 'circle') priority += 100;
        // Small rectangles are likely color swatches  
        if (colorEl.tagName === 'rect' && area < 500) priority += 50;
        // Larger areas get lower priority (likely UI elements)
        priority -= Math.floor(area / 100);
        
        // Boost priority for specific sensor colors (red, green, yellow, etc.)
        if (['red', 'green', 'yellow', 'pink', 'white', 'black'].includes(colorName)) {
          priority += 30;
        }
        // Reduce priority for common UI colors
        if (['blue', 'light blue'].includes(colorName)) {
          priority -= 20;
        }
        
        colorCandidates.push({
          element: colorEl,
          color: colorName,
          priority: priority
        });
        
        console.log('[SPIKE Advisor] 🎨 Color candidate:', colorName, 'priority:', priority, 'area:', Math.round(area));
      }
    }
  });
  
  // Sort by priority and take the highest priority color
  if (colorCandidates.length > 0) {
    colorCandidates.sort((a, b) => b.priority - a.priority);
    detectedColor = colorCandidates[0].color;
    textParts.push(detectedColor);
    console.log('[SPIKE Advisor] ✅ Final detected color:', detectedColor, '(from', colorCandidates.length, 'candidates)');
    console.log('[SPIKE Advisor] 📊 All candidates:', colorCandidates.map(c => `${c.color}(${c.priority})`).join(', '));
  }
    
  // Also check style attribute for color information - but only if no priority-based color found
  if (!detectedColor) {
    colorElements.forEach(colorEl => {
      const style = colorEl.getAttribute('style');
      if (style && style.includes('fill:')) {
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
  }
  
  // If no .blocklyText found, try to get text from immediate children only
  if (textParts.length === 0) {
    // More restrictive approach - only get text from immediate child elements
    // This avoids cross-contamination from nested blocks
    const directTextElements = Array.from(element.children).flatMap(child => {
      // Only look 1-2 levels deep to avoid nested block content
      const texts: string[] = [];
      
      // Check the direct child
      if (child.textContent && child.textContent.trim()) {
        const childText = child.textContent.trim();
        // Skip if it looks like it contains nested block content (multiple sentences/actions)
        if (!(childText.includes('if') && childText.includes('move')) && childText.split(/[.!?]/).length <= 2) {
          texts.push(childText);
        }
      }
      
      // Check immediate grandchildren but be very selective
      Array.from(child.children).forEach(grandchild => {
        if (grandchild.tagName === 'text' || grandchild.classList.contains('blocklyText')) {
          const grandchildText = grandchild.textContent?.trim();
          if (grandchildText && grandchildText.length > 0 && grandchildText.length < 50) {
            texts.push(grandchildText);
          }
        }
      });
      
      return texts;
    });
    
    // Filter and clean the collected texts
    directTextElements.forEach(text => {
      if (text && text.length > 0 && !text.includes('blockly')) {
        // Skip text that looks like it's from multiple blocks combined
        const wordCount = text.split(/\s+/).length;
        if (wordCount <= 15) { // Reasonable limit for a single block's text
          textParts.push(text);
        } else {
          console.log('[SPIKE Advisor] ⚠️ Skipping overly long text (likely from multiple blocks):', text.substring(0, 50) + '...');
        }
      }
    });
    
    // Fallback: if still no text, use the more permissive tree walker but with stricter depth
    if (textParts.length === 0) {
      const walker = document.createTreeWalker(
        element,
        NodeFilter.SHOW_TEXT,
        {
          acceptNode: (node) => {
            // Very restrictive - only depth 1-2 to avoid nested content
            const depth = getNodeDepth(node, element);
            return depth <= 2 ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
          }
        }
      );
      
      let node;
      while (node = walker.nextNode()) {
        const text = node.textContent?.trim();
        if (text && text.length > 0 && text.length < 30 && !text.includes('blockly')) {
          textParts.push(text);
        }
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
    '#ffed4a': 'yellow',
    '#ffeaa7': 'yellow',
    '#fdcb6e': 'yellow',
    '#f1c40f': 'yellow',
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
        
        // Yellow: rgb(255, 227, 96) and variations
        // Enhanced yellow detection for various SPIKE Prime yellow shades
        if (r > 240 && g > 200 && b > 70 && b < 150) return 'yellow';
        if (r > 220 && g > 200 && g < 255 && b > 40 && b < 120) return 'yellow';
        
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
  
  // PRIORITY: Enhanced if-then detection - MUST come before motor detection to avoid miscategorization
  if (lowerText.includes('if') && (lowerText.includes('then') || lowerText.includes('color') || lowerText.includes('closer') || lowerText.includes('reflection') || lowerText.includes('pressed') || lowerText.includes('tilted') || lowerText.includes('button'))) return 'flippercontrol';
  if (lowerText.includes('closer than') && lowerText.includes('then')) return 'flippercontrol';
  // Handle SPIKE Prime specific conditional patterns
  if (lowerText.match(/if\s+[a-f]\s+is\s+color/)) return 'flippercontrol'; // "if A is color red ? then"
  if (lowerText.match(/if\s+[a-f]\s+reflection/)) return 'flippercontrol'; // "if A reflection > 50 ? then"  
  if (lowerText.match(/if\s+[a-f]\s+is\s+closer/)) return 'flippercontrol'; // "if A is closer than 15 cm ? then"
  if (lowerText.match(/if\s+[a-f]\s+is\s+pressed/)) return 'flippercontrol'; // "if A is pressed ? then"
  if (lowerText.match(/if\s+is\s+tilted/)) return 'flippercontrol'; // "if is tilted up ? then"
  if (lowerText.match(/if\s+is\s+\w+\s+button\s+pressed/)) return 'flippercontrol'; // "if is left button pressed ? then"
  // Additional conditional patterns that might include motor keywords but are still conditionals
  if (lowerText.includes('if') && lowerText.includes('motor') && lowerText.includes('then')) return 'flippercontrol';
  
  // All sensor types (based on SPIKE Prime sensor blocks)
  if (lowerText.includes('closer than') && !lowerText.includes('if')) return 'sensors'; // distance sensor
  if (lowerText.includes('is color') || lowerText.includes('color') || lowerText.includes('reflection') || lowerText.includes('reflected light')) return 'sensors'; // color/reflection sensor
  if (lowerText.includes('is pressed') || lowerText.includes('pressure')) return 'sensors'; // force/pressure sensor
  if (lowerText.includes('tilted') || lowerText.includes('front') || lowerText.includes('up') || lowerText.includes('shaken') || lowerText.includes('pitch') || lowerText.includes('yaw') || lowerText.includes('angle')) return 'sensors'; // IMU sensor
  if (lowerText.includes('distance')) return 'sensors'; // distance sensor
  if (lowerText.includes('button') && lowerText.includes('pressed')) return 'sensors'; // button sensor
  if (lowerText.includes('timer') && !lowerText.includes('if') && !lowerText.includes('then')) return 'sensors'; // timer
  
  if ((lowerText.includes('motor') || lowerText.includes('speed') || lowerText.includes('start motor')) && !lowerText.includes('if') && !lowerText.includes('then')) return 'flippermotor';
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
    console.log('[SPIKE Advisor] 🔍 Parsing if-then block text:', cleaned);
    
    if (cleaned.includes('closer than')) {
      const portMatch = cleaned.match(/([A-F])/);
      const distanceMatch = cleaned.match(/(\d+)/);
      const distance = distanceMatch ? distanceMatch[1] : 'unknown';
      const port = portMatch ? portMatch[1] : 'unknown';
      cleaned = `if Sensor ${port} closer than ${distance}%`;
    } else if (cleaned.includes('color')) {
      // Handle if-then with color sensor and various actions
      // Enhanced pattern matching for "A is color red" vs "Sensor A is color red"
      const portMatch = cleaned.match(/(?:Sensor\s+)?([A-F])(?:\s+is|\s+:|:)/i) || cleaned.match(/([A-F])/);
      const textColorMatch = cleaned.match(/(red|blue|light blue|green|yellow|white|black|pink|no color)/i);
      
      // Prioritize visually detected color over text color
      const finalColor = detectedColor || (textColorMatch ? textColorMatch[1] : null);
      
      // Detect different action types - check both current block and next connected blocks
      let action = 'action';
      
      // First check if action is in the current block text
      if (cleaned.includes('stop motor')) {
        action = 'stop motor';
      } else if (cleaned.includes('move') && cleaned.includes('rotation')) {
        // Extract rotation count for move action within if-then
        const moveRotationsMatch = cleaned.match(/move.*?for\s+(\d+)\s+rotation/);
        const allNumbers = cleaned.match(/\d+/g);
        
        if (moveRotationsMatch) {
          action = `move for ${moveRotationsMatch[1]} rotations`;
        } else if (allNumbers && allNumbers.length > 1) {
          // Filter out sensor port (single letter A-F) and look for rotation numbers
          const rotationCandidates = allNumbers.filter(n => parseInt(n) > 1);
          if (rotationCandidates.length > 0) {
            action = `move for ${rotationCandidates[0]} rotations`;
            console.log('[SPIKE Advisor] 🎯 Extracted rotation from if-then:', rotationCandidates[0]);
          } else {
            action = 'move';
          }
        } else {
          action = 'move';
        }
      } else if (cleaned.includes('start motor')) {
        action = 'start motor';
      } else {
        // If no action found in current block, this might be a separate if/then structure
        // where the action is in a connected block. Check for generic patterns.
        if (cleaned.includes('move') || cleaned.includes('forward') || cleaned.includes('rotation')) {
          action = 'move';
        } else if (cleaned.includes('motor')) {
          action = 'motor action';
        }
      }
      
      if (portMatch && finalColor) {
        cleaned = `if Sensor ${portMatch[1]} is color ${finalColor.toLowerCase()} then ${action}`;
        console.log('[SPIKE Advisor] ✅ If-block used color:', finalColor, '(detected:', detectedColor, ', text:', textColorMatch?.[1], ')');
      } else if (portMatch) {
        cleaned = `if Sensor ${portMatch[1]} is color (unknown) then ${action}`;
        console.log('[SPIKE Advisor] ⚠️ If-block: Port detected but no color found for:', portMatch[1]);
      } else {
        // Try alternative patterns for SPIKE Prime format
        const altMatch = cleaned.match(/([A-F])\s+is\s+color\s+(red|blue|green|yellow|white|black)/i);
        if (altMatch) {
          cleaned = `if Sensor ${altMatch[1]} is color ${altMatch[2].toLowerCase()} then ${action}`;
          console.log('[SPIKE Advisor] ✅ Alternative if-block pattern matched:', altMatch[1], altMatch[2]);
        } else {
          cleaned = `if color condition then ${action}`;
        }
      }
    } else {
      cleaned = 'if (condition) then (action)';
    }
  } else if (cleaned.includes('closer than') && !cleaned.includes('if')) {
    // Handle distance sensor blocks
    const portMatch = cleaned.match(/([A-F])/);
    const distanceMatch = cleaned.match(/(\d+)/);
    const distance = distanceMatch ? distanceMatch[1] : 'unknown';
    const port = portMatch ? portMatch[1] : 'unknown';
    cleaned = `Sensor ${port}: closer than ${distance}%`;
    } else if (cleaned.includes('distance')) {
    // Handle distance sensor blocks (alternative format)
    const portMatch = cleaned.match(/([A-F])/);
    const port = portMatch ? portMatch[1] : 'unknown';
    cleaned = `Sensor ${port}: distance`;
    } else if (cleaned.includes('is pressed')) {
    // Handle touch/force sensor blocks
    const portMatch = cleaned.match(/([A-F])/);
    const port = portMatch ? portMatch[1] : 'unknown';
    cleaned = `Sensor ${port}: is pressed`;
    } else if (cleaned.includes('pressure')) {
    // Handle pressure sensor blocks
    const portMatch = cleaned.match(/([A-F])/);
    const port = portMatch ? portMatch[1] : 'unknown';
    cleaned = `Sensor ${port}: pressure`;
    } else if (cleaned.includes('tilted')) {
    // Handle IMU tilt sensor
    cleaned = `IMU: is tilted`;
    } else if (cleaned.includes('shaken')) {
    // Handle IMU shake sensor
    cleaned = `IMU: is shaken`;
    } else if (cleaned.includes('pitch') && cleaned.includes('angle')) {
    // Handle IMU pitch angle
    cleaned = `IMU: pitch angle`;
    } else if (cleaned.includes('yaw') && cleaned.includes('angle')) {
    // Handle IMU yaw angle
    cleaned = `IMU: yaw angle`;
    } else if (cleaned.includes('front') && cleaned.includes('up')) {
    // Handle IMU orientation
    cleaned = `IMU: is front up`;
    } else if (cleaned.includes('is color') || (cleaned.includes('color') && cleaned.match(/[A-F]/))) {
    // Handle color sensor blocks specifically
    const portMatch = cleaned.match(/([A-F])/);
    
    // First try to use the visually detected color, then fall back to text color
    const textColorMatch = cleaned.match(/(red|blue|light blue|green|yellow|white|black|pink|no color)/i);
    const finalColor = detectedColor || (textColorMatch ? textColorMatch[1] : null);
    
    // If we have both port and color, use them
    if (portMatch && finalColor) {
      cleaned = `Sensor ${portMatch[1]}: is color ${finalColor.toLowerCase()}`;
      console.log('[SPIKE Advisor] ✅ Used color:', finalColor, '(detected:', detectedColor, ', text:', textColorMatch?.[1], ')');
    } else if (portMatch) {
      // If we have port but no detected color, indicate unknown
      cleaned = `Sensor ${portMatch[1]}: is color (unknown)`;
      console.log('[SPIKE Advisor] ⚠️ Port detected but no color found for:', portMatch[1]);
    } else {
      cleaned = 'color sensor';
    }
    } else if (cleaned.includes('reflection')) {
    // Handle reflection sensor blocks - preserve percentage and operator
    const portMatch = cleaned.match(/([A-F])/);
    const numberMatch = cleaned.match(/(\d+)/);
    const operatorMatch = cleaned.match(/([<>]=?)/);
    const port = portMatch ? portMatch[1] : 'unknown';
    
    if (numberMatch && operatorMatch) {
      cleaned = `Sensor ${port}: reflection ${operatorMatch[1]} ${numberMatch[1]}%`;
    } else {
      cleaned = `Sensor ${port}: reflection`;
    }
    } else if (cleaned.includes('reflected light')) {
    // Handle reflected light sensor blocks
    const portMatch = cleaned.match(/([A-F])/);
    const port = portMatch ? portMatch[1] : 'unknown';
    cleaned = `Sensor ${port}: reflected light`;
  } else if (cleaned.includes('start motor')) {
    // Handle start motor blocks
    const motorMatch = cleaned.match(/([A-F])/);
    const directionMatch = cleaned.match(/(forward|backward)/);
    if (motorMatch) {
      const direction = directionMatch ? directionMatch[1] : 'forward';
      cleaned = `Motor ${motorMatch[1]}: start motor ${direction}`;
    }
  } else if (cleaned.includes('move') && cleaned.includes('for') && cleaned.includes('rotation')) {
    // Handle move for rotations blocks - be more specific to avoid wrong numbers
    console.log('[SPIKE Advisor] 🔍 Parsing move block text:', cleaned);
    
    // Try to match "for X rotations" pattern specifically
    let rotationsMatch = cleaned.match(/for\s+(\d+)\s+rotation/);
    
    // If not found, try "move for X" pattern
    if (!rotationsMatch) {
      rotationsMatch = cleaned.match(/move.*?for\s+(\d+)/);
    }
    
    // If still not found, try broader pattern but prefer larger numbers (more likely to be rotations)
    if (!rotationsMatch) {
      const allNumbers = cleaned.match(/\d+/g);
      console.log('[SPIKE Advisor] 🔢 All numbers found in move block:', allNumbers);
      
      if (allNumbers && allNumbers.length > 0) {
        // Prefer numbers > 1 (more likely to be rotations than sensor ports)
        const rotationCandidates = allNumbers.filter(n => parseInt(n) > 1);
        const rotations = rotationCandidates.length > 0 ? rotationCandidates[0] : allNumbers[allNumbers.length - 1];
        console.log('[SPIKE Advisor] ✅ Selected rotation value:', rotations);
        cleaned = `Move forward for ${rotations} rotations`;
      } else {
        cleaned = `Move forward for unknown rotations`;
      }
    } else {
      const rotations = rotationsMatch[1];
      console.log('[SPIKE Advisor] ✅ Found rotation value via pattern:', rotations);
      cleaned = `Move forward for ${rotations} rotations`;
    }
  }
  
  return cleaned;
}

// Cache for last sent blocks to avoid unnecessary updates
let lastBlocksHash: string = '';

// Create a hash of blocks for comparison (similar to popup logic)
function createBlocksHash(blocks: any[]): string {
  if (!blocks || blocks.length === 0) return 'empty';
  
  // Create a stable hash using block texts and positions
  const blockData = blocks
    .map(block => `${block.text || ''}::${block.type || ''}::${Math.round(block.x || 0)}::${Math.round(block.y || 0)}`)
    .filter(data => data.length > 0)
    .sort(); // Sort to make order-independent
  
  return blockData.join('||');
}

// Send block data to popup only if blocks have changed
function sendBlockDataToPopup(blocks: any[], hierarchy?: any) {
  if (!isExtensionContextValid()) return;
  
  try {
    const currentHash = createBlocksHash(blocks);
    
    // Only send if blocks have actually changed
    if (currentHash === lastBlocksHash) {
      console.log(`[SPIKE Advisor] 📊 No changes detected (${blocks.length} blocks) - skipping update`);
      return;
    }
    
    const data = {
      blocks: blocks,
      hierarchy: hierarchy,
      text: blocks.map(b => b.text).join(' | '),
      timestamp: Date.now(),
      method: hierarchy?.pseudoCode ? 'Blockly API Detection' : 'Visual Workspace Detection'
    };
    
    chrome.runtime.sendMessage({
      type: 'BLOCK_DATA_UPDATE',
      data: data
    }).catch(() => {
      // Popup might not be open, that's okay
    });
    
    // Update the cache
    lastBlocksHash = currentHash;
    
    console.log(`[SPIKE Advisor] ✅ Sent ${blocks.length} blocks to popup (changes detected)`);
    console.log(`[SPIKE Advisor] 🔑 New hash: ${currentHash.substring(0, 100)}...`);
  } catch (error) {
    console.error('[SPIKE Advisor] ❌ Error sending block data:', error);
  }
}

// Main detection and monitoring
function startVisualBlockDetection() {
  console.log('[SPIKE Advisor] 🚀 Starting visual workspace block detection...');
  
  const performDetection = () => {
    const hierarchy = extractBlocklyHierarchy();
    // Send both hierarchical data and flat blocks for compatibility
    const blocks = hierarchy.flatBlocks || hierarchy;
    sendBlockDataToPopup(blocks, hierarchy);
  };
  
  // Initial detection after a delay
  setTimeout(performDetection, 2000);
  
  // Set up periodic monitoring every 1 second (faster scanning as requested)
  setInterval(performDetection, 1000);
  
  // Set up message listener for manual refresh
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === "REQUEST_BLOCKS") {
      console.log('[SPIKE Advisor] 🔄 Manual refresh requested - bypassing cache');
      const hierarchy = extractBlocklyHierarchy();
      const currentBlocks = hierarchy.flatBlocks || hierarchy;
      
      // For manual refresh, always send data and update cache
      const currentHash = createBlocksHash(currentBlocks);
      lastBlocksHash = currentHash;
      
      sendResponse({
        blocks: currentBlocks,
        hierarchy: hierarchy,
        text: currentBlocks.map((b: any) => b.text).join(' | '),
        timestamp: Date.now(),
        method: hierarchy?.pseudoCode ? 'Blockly API Detection' : 'Visual Workspace Detection'
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

// Background workspace monitoring for smart suggestions
let lastBlockHash = '';
let monitoringActive = false;

// Helper function to extract current blocks from workspace
function getCurrentBlocks() {
  const hierarchy = extractBlocklyHierarchy();
  return hierarchy.flatBlocks || hierarchy;
}

function startWorkspaceMonitoring() {
  if (monitoringActive) return;
  
  monitoringActive = true;
  console.log('[SPIKE Advisor] 🎯 Starting workspace monitoring for smart suggestions');
  
  // Monitor for changes every 5 seconds
  const monitorInterval = setInterval(() => {
    if (!window.location.href.includes('spike.legoeducation.com')) {
      clearInterval(monitorInterval);
      monitoringActive = false;
      return;
    }
    
    // Extract current blocks
    const blocks = getCurrentBlocks();
    if (blocks.length === 0) return;
    
    // Create hash of current blocks
    const currentHash = blocks.map((b: any) => b.text || '').sort().join('::');
    
    // Check if blocks changed significantly
    if (currentHash !== lastBlockHash && lastBlockHash !== '') {
      console.log('[SPIKE Advisor] 📝 Workspace changed, triggering smart suggestions');
      
      // Send message to popup for smart suggestions
      chrome.runtime.sendMessage({
        type: 'WORKSPACE_CHANGED',
        blocks: blocks,
        lastAction: 'block_modified'
      });
    }
    
    lastBlockHash = currentHash;
  }, 5000); // Check every 5 seconds
  
  // Also monitor for DOM mutations (more responsive)
  const observer = new MutationObserver((mutations) => {
    let hasRelevantChanges = false;
    
    mutations.forEach((mutation) => {
      if (mutation.type === 'childList' || mutation.type === 'attributes') {
        // Check if changes are in blockly workspace
        const target = mutation.target as Element;
        if (target.closest && (
          target.closest('.blocklyBlockCanvas') ||
          target.closest('.blocklyWorkspace') ||
          target.className?.includes('blockly')
        )) {
          hasRelevantChanges = true;
        }
      }
    });
    
    if (hasRelevantChanges) {
      // Debounce: wait 2 seconds before processing
      clearTimeout((window as any).smartSuggestionsTimeout);
      (window as any).smartSuggestionsTimeout = setTimeout(() => {
        const blocks = getCurrentBlocks();
        if (blocks.length > 0) {
          console.log('[SPIKE Advisor] 🔄 DOM mutation detected, updating suggestions');
          chrome.runtime.sendMessage({
            type: 'WORKSPACE_CHANGED',
            blocks: blocks,
            lastAction: 'dom_mutation'
          });
        }
      }, 2000);
    }
  });
  
  // Start observing
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['data-id', 'class']
  });
  
  console.log('[SPIKE Advisor] ✅ Workspace monitoring active');
}

function stopWorkspaceMonitoring() {
  monitoringActive = false;
  console.log('[SPIKE Advisor] ⏹️ Workspace monitoring stopped');
}

// Enhanced message listener for new features
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  console.log('[SPIKE Advisor] 📨 Received message:', message);
  
  switch (message.type) {
    case "REQUEST_BLOCKS":
      const blocks = getCurrentBlocks();
      console.log(`[SPIKE Advisor] 📋 Sending ${blocks.length} blocks to popup`);
      sendResponse({ blocks: blocks });
      
      // Start monitoring when popup requests blocks
      if (blocks.length > 0) {
        startWorkspaceMonitoring();
      }
      break;
      
    case "START_MONITORING":
      startWorkspaceMonitoring();
      sendResponse({ success: true });
      break;
      
    case "STOP_MONITORING":
      stopWorkspaceMonitoring();
      sendResponse({ success: true });
      break;
      
    case "GET_CURRENT_BLOCKS":
      sendResponse({ blocks: getCurrentBlocks() });
      break;
      
    default:
      console.log('[SPIKE Advisor] ❓ Unknown message type:', message.type);
  }
  
  return true; // Keep message channel open for async response
});

// Start when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
} 