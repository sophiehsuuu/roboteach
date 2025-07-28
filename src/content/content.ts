// content.ts
// This script runs on https://spike.legoeducation.com/ and extracts SPIKE Prime block code details in real time.

// Helper: Extract all main block fields (type, motor speed, port, sensor values, color, etc.)
function extractSPIKEBlocks() {
  // Find the SPIKE Blockly workspace (confirmed by DevTools: window.Blockly.getMainWorkspace())
  const workspace =
    typeof window !== "undefined" &&
    (window as any).Blockly &&
    typeof (window as any).Blockly.getMainWorkspace === "function"
      ? (window as any).Blockly.getMainWorkspace()
      : null;
  if (!workspace) return { blocks: [], text: "" };

  // Get all blocks
  const blocks = workspace.getAllBlocks(false);

  // Parse structured values from blocks
  const structured = blocks.map((block: any) => {
    const data: Record<string, any> = { type: block.type };
    // Gather commonly used fields (motor, speed, port, direction, sensor, color, value, threshold)
    block.inputList?.forEach((input: any) => {
      input.fieldRow?.forEach((field: any) => {
        if (typeof field.getValue === "function") {
          data[field.name] = field.getValue();
        } else if (typeof field.getText === "function") {
          data[field.name] = field.getText();
        }
      });
    });
    // Pick up extra fields if they exist
    if (block.fields_) {
      Object.keys(block.fields_).forEach((fieldName: string) => {
        const val = block.fields_[fieldName]?.value_;
        if (val !== undefined) data[fieldName] = val;
      });
    }
    return data;
  });

  // Fallback: get visible code area as text (less precise, for debug or AI context)
  const blockArea =
    document.querySelector('.blocklyWorkspace') ||
    document.querySelector('.blocklyMainWorkspaceDiv') ||
    null;
  const blockText = blockArea ? (blockArea as HTMLElement).textContent || "" : "";

  return { blocks: structured, text: blockText };
}

// Regularly send the block data (structured + text) to your popup
setInterval(() => {
  const payload = extractSPIKEBlocks();

  // Send both the structured array AND fallback text to the popup
  chrome.runtime.sendMessage({
    type: "SPIKE_BLOCK_STRUCTURED",
    payload  // { blocks: [...], text: "..." }
  });

  // (Optional) For backwards compatibility
  chrome.runtime.sendMessage({
    type: "SPIKE_BLOCK_UPDATE",
    payload: payload.text
  });
}, 3000);

