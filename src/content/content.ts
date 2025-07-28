// This code will run every time you open spike.legoeducation.com

setInterval(() => {
    // Try to find the block workspace (use DevTools to update selector as needed!)
    const blockArea = document.querySelector('.blocklyWorkspace'); // Might need updating!
  
    if (blockArea) {
      const blockText = blockArea.textContent || "";
      // Send the block "raw text" to your extension's popup
      chrome.runtime.sendMessage({ type: "SPIKE_BLOCK_UPDATE", payload: blockText });
    }
  }, 3000); // Check every 3 seconds
  