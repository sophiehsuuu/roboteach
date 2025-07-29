import { useState, useEffect } from "react";
declare const chrome: any;

// --- Strict keys for error types ---
type ErrorTypeKey = "" | "motor" | "direction" | "not-starting" | "stop" | "sensor" | "other";



const errorAdviceMap: Record<Exclude<ErrorTypeKey, "">, {
  zh: string;
  en: string;
  generic: { zhTips: string; enTips: string; };
}> = {
  "motor": {
    zh: "馬達未啟動",
    en: "Motor Not Moving",
    generic: {
      zhTips: "請檢查馬達積木是否連接且設定啟動動作。\n確保端口匹配與連線正常，或換電池。",
      enTips: "Check if motor blocks are connected & set to start. Ensure matching ports and connections, or try fresh batteries."
    }
  },
  "direction": {
    zh: "機器人方向錯誤",
    en: "Robot Moving Wrong Direction",
    generic: {
      zhTips: "檢查左右馬達設定及順/逆時針。確認有無設定錯誤的方向積木。",
      enTips: "Check left/right motors and clockwise/counterclockwise. Confirm there are no wrong direction blocks."
    }
  },
  "not-starting": {
    zh: "程式未開始",
    en: "Code Not Starting",
    generic: {
      zhTips: "請確認有『開始』積木，並點選執行。",
      enTips: "Make sure you have a 'start' block and click run."
    }
  },
  "stop": {
    zh: "無法停止",
    en: "Can't Stop",
    generic: {
      zhTips: "檢查有無『停止』積木。確認有機會跳出循環。",
      enTips: "Check for stop blocks. Make sure all loops can be exited."
    }
  },
  "sensor": {
    zh: "感應器無反應",
    en: "Sensor Not Responding",
    generic: {
      zhTips: "檢查感應器積木是否設定正確並已插入。",
      enTips: "Check sensor blocks are set and sensor is plugged in."
    }
  },
  "other": {
    zh: "其他／未列出問題",
    en: "Other / Not Listed",
    generic: {
      zhTips: "請簡要描述問題後，使用下方 AI 協助功能。",
      enTips: "Describe your issue, then use 'Ask AI' below."
    }
  }
};

const dropdownOptions: { key: ErrorTypeKey; label: string }[] = [
  { key: "", label: "👇 請選擇遇到的問題 Select an issue" },
  { key: "motor", label: "馬達未啟動 / Motor Not Moving" },
  { key: "direction", label: "機器人方向錯誤 / Wrong Direction" },
  { key: "not-starting", label: "程式未開始 / Code Not Starting" },
  { key: "stop", label: "無法停止 / Can't Stop" },
  { key: "sensor", label: "感應器無反應 / Sensor Not Responding" },
  { key: "other", label: "其他／未列出問題 / Other" }
];

// --- Smart advice helpers ---
function getCustomMotorAdvice(blocks: any[]) {
  if (!blocks?.length) return "";
  const motorBlocks = blocks.filter(b => b.type && b.type.includes("motor"));
  if (!motorBlocks.length) {
    return "❗ 目前積木中沒有任何馬達積木。\nNo motor blocks detected.\n";
  }
  let out = "";
  motorBlocks.forEach(b => {
    out += `• 馬達${b.MOTOR || b.PORT || ""} 速度: ${b.SPEED !== undefined ? b.SPEED + "%" : "未設定"}\n`;
    if (b.SPEED !== undefined && Number(b.SPEED) < 70)
      out += "↳ 速度偏低，建議嘗試設為80%以上。\n(Motor speed is low, recommend setting to 80%+)\n";
    if (!b.MOTOR && !b.PORT)
      out += "↳ 未指定端口，請選擇A/B。\n(No port set, please choose A/B)\n";
  });
  return out;
}
function getCustomDirectionAdvice(blocks: any[]) {
  const motors = blocks.filter(b => b.type && b.type.includes("motor"));
  let advice = "";
  if (motors.length >= 2) {
    const first = motors[0], second = motors[1];
    if (first?.DIRECTION && second?.DIRECTION && first.DIRECTION !== second.DIRECTION)
      advice += "⚠️ 兩個馬達方向設置不同，可能造成原地旋轉。\n(Motors set to opposing directions, may rotate in place.)\n";
  }
  return advice;
}
function getCustomNotStartingAdvice(blocks: any[]) {
  if (!blocks || !blocks.length) return "";
  const hasStart = blocks.some(b => b.type && b.type.toLowerCase().includes("start"));
  if (!hasStart) return "❗ 沒有偵測到『開始』積木。\nNo start block detected.\n";
  return "";
}
function getCustomStopAdvice(blocks: any[]) {
  const forever = blocks.filter(b => b.type && b.type.includes("forever"));
  const stops = blocks.filter(b => /stop/i.test(b.type));
  if (forever.length && !stops.length)
    return "↳ 積木有『永遠』循環但沒有適合的『停止』積木。\n(Has forever loop but no stop block.)\n";
  return "";
}
function getCustomSensorAdvice(blocks: any[]) {
  const sensors = blocks.filter(b => b.type && b.type.includes("sensor"));
  if (!sensors.length)
    return "❗ 沒有偵測到任何感應器積木。\nNo sensor blocks found.\n";
  let out = "";
  sensors.forEach(b => {
    out += `• 感應器${b.SENSOR || ""} 類型: ${b.type}`;
    if (b.COLOR) out += ` 顏色值: ${b.COLOR}`;
    if (b.VALUE) out += ` 讀取值: ${b.VALUE}`;
    out += "\n";
  });
  return out;
}

export default function Popup() {
  const [output, setOutput] = useState('');
  const [selectedError, setSelectedError] = useState<ErrorTypeKey>('');
  const [codeSummary, setCodeSummary] = useState('');
  const [loading, setLoading] = useState(false);
  const [blockText, setBlockText] = useState('');
  const [blockData, setBlockData] = useState<any[]>([]);
  const [debugInfo, setDebugInfo] = useState<string>('');

  // Listen for messages from content script
  useEffect(() => {
    function listener(msg: any) {
      console.log('[SPIKE Advisor Popup] Received message:', msg);
      
      if (msg.type === 'BLOCK_DATA_UPDATE') {
        console.log('[SPIKE Advisor Popup] Updating block data:', msg.data.blocks?.length, 'blocks');
        setBlockData(msg.data.blocks || []);
        setBlockText(msg.data.text || '');
        setDebugInfo(`🔄 Real-time update: ${msg.data.blocks?.length || 0} blocks detected`);
      }
    }

    chrome.runtime.onMessage.addListener(listener);
    
    // Request initial data when popup opens
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs: any[]) => {
      if (tabs[0] && tabs[0].url?.includes('spike.legoeducation.com')) {
        console.log('[SPIKE Advisor Popup] Requesting initial data from content script...');
        chrome.tabs.sendMessage(tabs[0].id, { type: "REQUEST_BLOCKS" }, (response: any) => {
          console.log('[SPIKE Advisor Popup] Received initial response:', response);
          if (response && response.blocks) {
            setBlockData(response.blocks || []);
            setBlockText(response.text || "");
            setDebugInfo(`📊 Initial load: ${response.blocks?.length || 0} blocks`);
          } else {
            setDebugInfo('❌ No response from content script - trying again in 1 second...');
            // Try again after a short delay
            setTimeout(() => {
              chrome.tabs.sendMessage(tabs[0].id, { type: "REQUEST_BLOCKS" }, (retryResponse: any) => {
                console.log('[SPIKE Advisor Popup] Retry response:', retryResponse);
                if (retryResponse && retryResponse.blocks) {
                  setBlockData(retryResponse.blocks || []);
                  setBlockText(retryResponse.text || "");
                  setDebugInfo(`📊 Retry load: ${retryResponse.blocks?.length || 0} blocks`);
                } else {
                  setDebugInfo('❌ Still no response - content script may not be ready');
                }
              });
            }, 1000);
          }
        });
      } else {
        setDebugInfo('⚠️ Not on SPIKE page');
      }
    });

    return () => {
      chrome.runtime.onMessage.removeListener(listener);
    };
  }, []);

  // Manual refresh function
  function handleRefresh() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs: any[]) => {
      if (tabs[0] && tabs[0].url?.includes('spike.legoeducation.com')) {
        chrome.tabs.sendMessage(tabs[0].id, { type: "REQUEST_BLOCKS" }, (response: any) => {
          if (response) {
            setBlockData(response.blocks || []);
            setBlockText(response.text || "");
            setDebugInfo(`🔄 Manual refresh: ${response.blocks?.length || 0} blocks`);
          } else {
            setDebugInfo('❌ No response from content script');
          }
        });
      }
    });
  }

  function handleDropdownChange(e: any) {
    const val = e.target.value as ErrorTypeKey;
    setSelectedError(val);

    let custom = "";
    if (val === "motor") custom = getCustomMotorAdvice(blockData);
    if (val === "direction") custom = getCustomDirectionAdvice(blockData);
    if (val === "not-starting") custom = getCustomNotStartingAdvice(blockData);
    if (val === "stop") custom = getCustomStopAdvice(blockData);
    if (val === "sensor") custom = getCustomSensorAdvice(blockData);

    let zh = "", en = "", zhTips = "", enTips = "";
    if (val && val in errorAdviceMap) {
      const adv = errorAdviceMap[val as keyof typeof errorAdviceMap];
      zh = adv.zh; en = adv.en; zhTips = adv.generic.zhTips; enTips = adv.generic.enTips;
    }

    setOutput(
      `🌟 ${zh}\n` +
      (custom ? `【偵測自程式】\n${custom}` : "") +
      `${zhTips}\n\n—\n` +
      `${en}\n` +
      (custom ? `[From code blocks]\n${custom.replace(/\n/g, " ")}` : "") +
      `${enTips}`
    );
  }

  const handleAskAdvice = async () => {
    setOutput('取得協助中… Getting advice...');
    setLoading(true);
    const codeData = {
      summary: codeSummary,
      pickedSymptom: selectedError,
      blockText,
      blocks: blockData
    };
    try {
      const resp = await fetch('https://rcwulqsdbrptrrtkluhh.supabase.co/functions/v1/llm-advice', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJjd3VscXNkYnJwdHJydGtsdWhoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM2NjM4NzEsImV4cCI6MjA2OTIzOTg3MX0.ajT317ynsqT0OWwOXroU0GggATbebIRcC5F5nAxVTMg'
        },
        body: JSON.stringify({ code: codeData, lang: 'zh-Hant' }),
      });
      const data = await resp.json();
      setOutput(data.advice || 'No advice returned.');
    } catch (err) {
      setOutput('Error fetching advice. Please try again.');
      console.error(err);
    }
    setLoading(false);
  };



  // Render block summary in a cleaner format
  const renderBlockSummary = () => {
    console.log('[SPIKE Advisor Popup] renderBlockSummary called with blockData:', blockData);
    
    if (!blockData || blockData.length === 0) {
      console.log('[SPIKE Advisor Popup] No block data, showing waiting message');
      return <div style={{ color: '#666', fontStyle: 'italic' }}>等待積木資料... (Waiting for block data)</div>;
    }

    console.log('[SPIKE Advisor Popup] Processing', blockData.length, 'blocks');

    // The blocks should already be filtered by the content script, but apply additional filtering if needed
    const workspaceBlocks = blockData.filter((block: any) => {
      // Skip blocks that are outside the visible workspace area (but allow negative x values)
      if (block.x < -2000 || block.y < -2000 || block.x > 10000 || block.y > 10000) {
        return false;
      }
      
      // Skip empty operator blocks (likely palette)
      if (!block.text.trim() && block.id && block.id.includes('operator_')) {
        return false;
      }
      
      return true;
    });

    console.log('[SPIKE Advisor Popup] After filtering:', workspaceBlocks.length, 'workspace blocks');

    if (workspaceBlocks.length === 0) {
      return <div style={{ color: '#666', fontStyle: 'italic' }}>未檢測到積木 (No blocks detected)</div>;
    }

    // Group blocks by category for better organization
    const blocksByCategory: { [key: string]: any[] } = {};
    workspaceBlocks.forEach((block: any) => {
      const category = block.category || 'unknown';
      if (!blocksByCategory[category]) {
        blocksByCategory[category] = [];
      }
      blocksByCategory[category].push(block);
    });

    // Function to get a meaningful block description
    const getBlockDescription = (block: any) => {
      const text = block.text || '';
      const category = block.category || '';
      
      // Handle "when program starts" block specifically - show only the event, not connected blocks
      if (text.includes('when program starts')) {
        return 'When program starts:';
      }
      
      // Handle blocks that might have "when program starts" in their text but are not the event block
      if (category === 'flipperevents') {
        if (text.includes('when program starts')) {
          return 'When program starts:';
        }
        if (text.includes('when')) {
          return `Event - ${text}`;
        }
        return text;
      }
      
      if (category === 'flippermotor') {
        // Motor blocks - need to parse more carefully
        if (text.includes('set speed')) {
          const speedMatch = text.match(/(\d+)/);
          const speed = speedMatch ? speedMatch[1] : '75';
          return `Motor A - set speed to ${speed}%`;
        }
        if (text.includes('run')) {
          // Look for direction indicators
          let direction = '';
          if (text.includes('clockwise') || text.includes('forward')) {
            direction = 'clockwise';
          } else if (text.includes('counterclockwise') || text.includes('backward')) {
            direction = 'counterclockwise';
          } else {
            direction = 'forward'; // default
          }
          
          // Look for amount and unit
          const amountMatch = text.match(/(\d+)/);
          const amount = amountMatch ? amountMatch[1] : '1';
          
          let unit = 'rotations';
          if (text.includes('degrees')) {
            unit = 'degrees';
          } else if (text.includes('seconds')) {
            unit = 'seconds';
          }
          
          return `Motor A - run ${direction} for ${amount} ${unit}`;
        }
        if (text.includes('start motor')) {
          let direction = '';
          if (text.includes('clockwise') || text.includes('forward')) {
            direction = 'clockwise';
          } else if (text.includes('counterclockwise') || text.includes('backward')) {
            direction = 'counterclockwise';
          } else {
            direction = 'forward';
          }
          return `Motor A - start motor ${direction}`;
        }
        if (text.includes('stop motor')) {
          return 'Motor A - stop motor';
        }
        if (text.includes('go shortest path')) {
          return 'Motor A - go shortest path to position';
        }
        if (text.includes('turn for')) {
          const amountMatch = text.match(/(\d+)/);
          const amount = amountMatch ? amountMatch[1] : '1';
          return `Motor A - turn for ${amount} rotations`;
        }
        if (text.includes('go to position')) {
          return 'Motor A - go to position';
        }
        
        // If we just have "A" or basic motor text, try to infer from the block ID or shape
        if (text === 'A' || text.trim() === 'A') {
          // Try to get more context from the block element or ID
          return `Motor A - motor control block`;
        }
        
        return `Motor A - ${text}`;
      }
      
      if (category === 'flippermove') {
        if (text.includes('move')) {
          // Extract direction from the text
          let direction = 'forward';
          if (text.includes('backward') || text.includes('reverse')) {
            direction = 'backward';
          } else if (text.includes('left')) {
            direction = 'left';
          } else if (text.includes('right')) {
            direction = 'right';
          }
          
          // Extract amount and unit
          const amountMatch = text.match(/(\d+)/);
          const amount = amountMatch ? amountMatch[1] : '10';
          
          let unit = 'rotations';
          if (text.includes('degrees')) {
            unit = 'degrees';
          } else if (text.includes('seconds')) {
            unit = 'seconds';
          } else if (text.includes('cm') || text.includes('centimeters')) {
            unit = 'cm';
          }
          
          return `Move ${direction} for ${amount} ${unit}`;
        }
        if (text.includes('start moving')) {
          return 'Start moving';
        }
        if (text.includes('stop moving')) {
          return 'Stop moving';
        }
        if (text.includes('steer')) {
          const direction = text.includes('right') ? 'right' : text.includes('left') ? 'left' : '';
          const angle = text.match(/\d+/)?.[0] || '30';
          return `Steer ${direction} ${angle}°`;
        }
        return text;
      }
      
      if (category === 'flipperlight') {
        if (text.includes('display')) {
          return `Light display - ${text}`;
        }
        if (text.includes('set brightness')) {
          const brightness = text.match(/\d+/)?.[0] || '75';
          return `Set light brightness to ${brightness}%`;
        }
        return `Light - ${text}`;
      }
      
      if (category === 'flippersound') {
        if (text.includes('play sound')) {
          const sound = text.match(/play sound(?: until done)?\s*(.+)/)?.[1] || 'sound';
          return `Play sound: ${sound}`;
        }
        if (text.includes('beep')) {
          const duration = text.match(/\d+/)?.[0] || '60';
          return `Beep for ${duration} seconds`;
        }
        return `Sound - ${text}`;
      }
      
      if (category === 'flippersensors') {
        return `Sensor - ${text}`;
      }
      
      if (category === 'flippercontrol') {
        return `Control - ${text}`;
      }
      
      if (category === 'flipperoperator') {
        return `Operator - ${text}`;
      }
      
      if (category === 'flippervariables') {
        return `Variable - ${text}`;
      }
      
      // Default fallback - clean up the text if it's too long
      if (text.length > 100) {
        // If text is very long, it might be combining multiple blocks
        // Try to extract just the first meaningful part
        const firstPart = text.split(' ').slice(0, 10).join(' ');
        return `${firstPart}...`;
      }
      
      return text || `${category} block`;
    };

    return (
      <div style={{ marginBottom: '20px' }}>
        <h3 style={{ margin: '0 0 10px 0', color: '#333', fontSize: '16px' }}>
          🧩 檢測到的積木設定 (Detected Blocks) ({workspaceBlocks.length})
        </h3>
        
        <div style={{ marginBottom: '10px' }}>
          <button 
            onClick={handleRefresh}
            style={{
              background: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              padding: '6px 12px',
              fontSize: '12px',
              cursor: 'pointer',
              marginRight: '8px'
            }}
          >
            🔄 Refresh
          </button>
          <span style={{ fontSize: '11px', color: '#666' }}>
            Auto-updates when blocks change
          </span>
        </div>
        
        {Object.entries(blocksByCategory).map(([category, blocks]) => (
          <div key={category} style={{ marginBottom: '15px' }}>
            <h4 style={{ 
              margin: '0 0 8px 0', 
              color: '#555', 
              fontSize: '14px',
              fontWeight: '600',
              textTransform: 'capitalize'
            }}>
              {category.replace('flipper', '')} Blocks:
            </h4>
                         {blocks.map((block: any) => (
              <div key={block.id} style={{
                background: '#f8f9fa',
                border: '1px solid #e9ecef',
                borderRadius: '6px',
                padding: '8px 12px',
                marginBottom: '6px',
                fontSize: '13px',
                color: '#495057'
              }}>
                <div style={{ fontWeight: '500', marginBottom: '2px' }}>
                  {getBlockDescription(block)}
                </div>
                <div style={{ 
                  fontSize: '11px', 
                  color: '#6c757d',
                  fontFamily: 'monospace'
                }}>
                  ID: {block.id?.substring(0, 8)}...
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div style={{ width: 400, padding: 16, fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <div style={{ 
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)", 
        color: "white", 
        padding: "12px 16px", 
        borderRadius: "8px 8px 0 0", 
        margin: "-16px -16px 16px -16px",
        textAlign: "center"
      }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>🤖 SPIKE AI Error Advisor</h2>
        <p style={{ margin: "4px 0 0 0", fontSize: 12, opacity: 0.9 }}>
          LEGO SPIKE Prime 智能除錯助手
        </p>
      </div>

      {/* Quick Fix Dropdown */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ 
          color: "#2C3E50", 
          fontSize: 13, 
          margin: "14px 0 8px 0",
          fontWeight: 500
        }}>
          請選擇一項症狀或問題獲得建議：<br />
          Select the issue you are facing to get help.
        </div>
        <select
          style={{
            width: "100%",
            padding: "8px 12px",
            border: "1px solid #BDC3C7",
            borderRadius: 6,
            fontSize: 14,
            fontWeight: 500,
            fontFamily: "inherit"
          }}
          value={selectedError}
          onChange={handleDropdownChange}
        >
          {dropdownOptions.map(opt =>
            <option key={opt.key} value={opt.key}>{opt.label}</option>
          )}
        </select>
        
        {/* Quick Fix Output */}
        {output && !loading && (
          <div style={{
            background: "#f8f9fa",
            border: "1px solid #e9ecef",
            borderRadius: 8,
            padding: 12,
            marginTop: 8,
            fontSize: 13,
            lineHeight: 1.4,
            color: "#2C3E50"
          }}>
            <div style={{ whiteSpace: "pre-wrap" }}>{output}</div>
          </div>
        )}
      </div>

      {/* AI Input Section */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ 
          color: "#2C3E50", 
          fontSize: 13, 
          margin: "10px 0 4px 2px",
          fontWeight: 500
        }}>
          若上述解決方案無法幫助你：<br />
          If the above doesn't help, please describe your situation and ask the AI:
        </div>
        <textarea
          value={codeSummary}
          onChange={(e) => setCodeSummary(e.target.value)}
          placeholder="描述你的問題... / Describe your issue..."
          style={{
            width: "100%",
            height: 60,
            padding: 8,
            border: "1px solid #ddd",
            borderRadius: 6,
            fontSize: 13,
            resize: "vertical",
            fontFamily: "inherit"
          }}
        />
        <button
          onClick={handleAskAdvice}
          disabled={loading || !codeSummary.trim()}
          style={{
            width: "100%",
            padding: "8px 16px",
            marginTop: 6,
            background: loading ? "#ccc" : "#007bff",
            color: "white",
            border: "none",
            borderRadius: 6,
            fontSize: 13,
            cursor: loading ? "not-allowed" : "pointer",
            fontWeight: 500
          }}
        >
          {loading ? "🔄 處理中... / Processing..." : "🤖 提問AI / Ask AI"}
        </button>
      </div>

      {/* AI Advice Display */}
      {output && !loading && selectedError && (
        <div style={{
          background: "#f8f9fa",
          border: "1px solid #e9ecef",
          borderRadius: 8,
          padding: 12,
          marginBottom: 16,
          fontSize: 13,
          lineHeight: 1.4
        }}>
          <h3 style={{ margin: "0 0 8px 0", color: "#495057", fontSize: 14 }}>
            💡 AI 建議 / AI Advice
          </h3>
          <div style={{ whiteSpace: "pre-wrap" }}>{output}</div>
        </div>
      )}

      {/* Block Summary */}
      {renderBlockSummary()}

      {/* Debug Info */}
      {debugInfo && (
        <details style={{
          background: "#fff3cd",
          border: "1px solid #ffeaa7",
          borderRadius: 6,
          padding: 8,
          fontSize: 11,
          marginTop: 8
        }}>
          <summary style={{ cursor: "pointer", color: "#856404", fontWeight: 500 }}>
            🔍 Debug Info
          </summary>
          <div style={{ marginTop: 4, color: "#856404" }}>{debugInfo}</div>
        </details>
      )}

      <style>{`
        .block-summary {
          background: #f8f9fa;
          border: 1px solid #e9ecef;
          border-radius: 8;
          padding: 16;
          margin-bottom: 16;
        }
        
        .block-summary h3 {
          margin: 0 0 12px 0;
          color: #495057;
          font-size: 16;
          font-weight: 600;
        }
        
        .block-summary h4 {
          margin: 16px 0 8px 0;
          color: #495057;
          font-size: 14;
          font-weight: 600;
        }
        
        .blocks-display {
          max-height: 200px;
          overflow-y: auto;
          margin-bottom: 12px;
        }
        
        .block-item {
          background: white;
          border: 1px solid #dee2e6;
          border-radius: 6;
          padding: 8;
          margin-bottom: 6;
          font-size: 12;
        }
        
        .block-header {
          display: flex;
          gap: 8px;
          margin-bottom: 4;
          font-size: 10;
          color: #6c757d;
        }
        
        .block-number {
          font-weight: 600;
          color: #007bff;
        }
        
        .block-category {
          background: #e9ecef;
          padding: 2px 6px;
          border-radius: 3;
          font-weight: 500;
        }
        
        .block-shape {
          background: #f8f9fa;
          padding: 2px 6px;
          border-radius: 3;
          font-style: italic;
        }
        
        .block-content {
          font-size: 13;
          color: #212529;
          margin-bottom: 2;
        }
        
        .block-id {
          font-size: 10;
          color: #6c757d;
          font-family: monospace;
        }
        
        .category-summary {
          background: white;
          border: 1px solid #dee2e6;
          border-radius: 6;
          padding: 12;
        }
        
        .category-item {
          display: flex;
          justify-content: space-between;
          padding: 4px 0;
          font-size: 12;
        }
        
        .category-name {
          font-weight: 500;
          color: #495057;
        }
        
        .category-count {
          background: #007bff;
          color: white;
          padding: 2px 6px;
          border-radius: 10;
          font-size: 10;
          font-weight: 600;
        }
        
        .refresh-btn {
          background: #28a745;
          color: white;
          border: none;
          border-radius: 6;
          padding: 8px 16px;
          font-size: 12;
          cursor: pointer;
          font-weight: 500;
        }
        
        .refresh-btn:hover {
          background: #218838;
        }
      `}</style>
    </div>
  );
}
