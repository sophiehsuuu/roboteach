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
  const [isBlockPanelCollapsed, setIsBlockPanelCollapsed] = useState<boolean>(false);
  const [aiSummary, setAiSummary] = useState<string>('');
  
  // New AI features state
  const [naturalLanguagePrompt, setNaturalLanguagePrompt] = useState<string>('');
  const [generatedCode, setGeneratedCode] = useState<string>('');
  const [isGeneratingCode, setIsGeneratingCode] = useState<boolean>(false);
  const [smartSuggestions, setSmartSuggestions] = useState<any[]>([]);
  const [chatHistory, setChatHistory] = useState<Array<{role: 'user' | 'assistant', content: string}>>([]);
  const [chatInput, setChatInput] = useState<string>('');
  const [isChatLoading, setIsChatLoading] = useState<boolean>(false);
  const [activeAITab, setActiveAITab] = useState<'chat' | 'suggestions' | 'natural' | null>(null);
  const [isDebugCollapsed, setIsDebugCollapsed] = useState<boolean>(true);
  
  // Persistent cache that survives component remounts
  const getAiSummaryCache = (): {[key: string]: string} => {
    try {
      const cached = sessionStorage.getItem('spike-ai-summary-cache');
      return cached ? JSON.parse(cached) : {};
    } catch {
      return {};
    }
  };
  
  const setAiSummaryCache = (cache: {[key: string]: string}) => {
    try {
      sessionStorage.setItem('spike-ai-summary-cache', JSON.stringify(cache));
    } catch {
      // Ignore storage errors
    }
  };

  // Debug: Log when component mounts/unmounts
  useEffect(() => {
    console.log('[SPIKE Advisor] 🔄 Component mounted/remounted');
    return () => {
      console.log('[SPIKE Advisor] 💥 Component unmounting');
    };
  }, []);

  // Helper function to create a simple hash of block content for comparison
  function createBlocksHash(blocks: any[]): string {
    if (!blocks || blocks.length === 0) return 'empty';
    
    // Create a super-stable hash using ONLY the text content (most stable property)
    const blockTexts = blocks
      .map(block => (block.text || '').trim())
      .filter(text => text.length > 0)
      .sort(); // Sort to make order-independent
    
    const hash = blockTexts.join('::');
    console.log('[SPIKE Advisor] 📝 Super-stable hash from texts:', blockTexts);
    console.log('[SPIKE Advisor] 🔑 Hash (first 100 chars):', hash.substring(0, 100) + '...');
    console.log('[SPIKE Advisor] 📊 Block count:', blocks.length);
    return hash;
  }

  // Modified function to only generate AI summary when blocks actually change
  function generateAISummaryIfChanged(blocks: any[], hierarchy?: any) {
    const newHash = createBlocksHash(blocks);
    
    console.log('[SPIKE Advisor] Hash comparison:');
    const currentCache = getAiSummaryCache();
    console.log('  Cache keys:', Object.keys(currentCache).length);
    console.log('  Current hash: ', newHash.substring(0, 50) + '...');
    
    // PRIORITY 1: Check cache first - if we have this exact configuration, use it
    if (currentCache[newHash]) {
      console.log('[SPIKE Advisor] 🎯 Using cached AI summary - no API call needed');
      console.log('[SPIKE Advisor] 📋 Cached summary:', currentCache[newHash]);
      setAiSummary(currentCache[newHash]);
      return;
    }
    
    // PRIORITY 2: Only generate if this is truly a new configuration
          console.log('[SPIKE Advisor] 🔄 New block configuration detected - generating AI summary');
      generateAISummary(blocks, hierarchy);
    }

  // Listen for messages from content script
  useEffect(() => {
    function listener(msg: any) {
      console.log('[SPIKE Advisor Popup] Received message:', msg);
      
      if (msg.type === 'BLOCK_DATA_UPDATE') {
        console.log('[SPIKE Advisor Popup] Updating block data:', msg.data.blocks?.length, 'blocks');
        console.log('[SPIKE Advisor Popup] Hierarchy data:', msg.data.hierarchy);
        // Store hierarchy globally for cache clearing
        (window as any).__lastHierarchy = msg.data.hierarchy;
        setBlockData(msg.data.blocks || []);
        setBlockText(msg.data.text || '');
        setDebugInfo(`🔄 Blocks changed: ${msg.data.blocks?.length || 0} blocks detected`);
        // Generate AI summary only when blocks actually change
        generateAISummaryIfChanged(msg.data.blocks || [], msg.data.hierarchy);
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
            console.log('[SPIKE Advisor Popup] Initial response hierarchy:', response.hierarchy);
            setBlockData(response.blocks || []);
            setBlockText(response.text || "");
            setDebugInfo(`📊 Initial load: ${response.blocks?.length || 0} blocks`);
            // Generate AI summary on initial load
            generateAISummaryIfChanged(response.blocks || [], response.hierarchy);
          } else {
            setDebugInfo('❌ No response from content script - trying again in 1 second...');
            // Try again after a short delay
            setTimeout(() => {
              chrome.tabs.sendMessage(tabs[0].id, { type: "REQUEST_BLOCKS" }, (retryResponse: any) => {
                console.log('[SPIKE Advisor Popup] Retry response:', retryResponse);
                if (retryResponse && retryResponse.blocks) {
                  console.log('[SPIKE Advisor Popup] Retry response hierarchy:', retryResponse.hierarchy);
                  setBlockData(retryResponse.blocks || []);
                  setBlockText(retryResponse.text || "");
                  setDebugInfo(`📊 Retry load: ${retryResponse.blocks?.length || 0} blocks`);
                  // Generate AI summary on retry load
                  generateAISummaryIfChanged(retryResponse.blocks || [], retryResponse.hierarchy);
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

  // Generate structured block text that preserves hierarchical relationships
  function generateStructuredBlockText(blocks: any[], hierarchy?: any): string {
    if (!blocks || blocks.length === 0) return '';
    
    // Group blocks by category and identify control flow
    const eventBlocks = blocks.filter(b => b.category === 'flipperevents');
    const controlBlocks = blocks.filter(b => b.category === 'flippercontrol');
    const motorBlocks = blocks.filter(b => b.category === 'flippermotor');
    const moveBlocks = blocks.filter(b => b.category === 'movement' || b.category === 'move');
    const sensorBlocks = blocks.filter(b => b.category === 'sensors');
    const lightBlocks = blocks.filter(b => b.category === 'flipperlight');
    const soundBlocks = blocks.filter(b => b.category === 'flippersound');
    
    let structuredText = '';
    
    // Start with events
    if (eventBlocks.length > 0) {
      structuredText += `程式入口: ${eventBlocks.map(b => b.text).join(', ')}\n`;
    }
    
    // Add motor setup
    if (motorBlocks.length > 0) {
      structuredText += `馬達設定: ${motorBlocks.map(b => b.text).join(', ')}\n`;
    }
    
    // Add movement actions (not inside conditions)
    const standaloneMove = moveBlocks.filter(b => !b.text.includes('if'));
    if (standaloneMove.length > 0) {
      structuredText += `移動動作: ${standaloneMove.map(b => b.text).join(', ')}\n`;
    }
    
    // Add conditional logic (this is key!)
    if (controlBlocks.length > 0) {
      structuredText += `條件控制邏輯:\n`;
      controlBlocks.forEach(block => {
        if (block.text.includes('if') && block.text.includes('then')) {
          structuredText += `  - ${block.text}\n`;
        } else {
          structuredText += `  - ${block.text}\n`;
        }
      });
    }
    
    // Add sensor blocks (if not already covered in control blocks)
    const standaloneSensors = sensorBlocks.filter(b => !controlBlocks.some(c => c.text.includes(b.text)));
    if (standaloneSensors.length > 0) {
      structuredText += `感應器狀態: ${standaloneSensors.map(b => b.text).join(', ')}\n`;
    }
    
    // Add other blocks
    if (lightBlocks.length > 0) {
      structuredText += `燈光效果: ${lightBlocks.map(b => b.text).join(', ')}\n`;
    }
    
    if (soundBlocks.length > 0) {
      structuredText += `聲音效果: ${soundBlocks.map(b => b.text).join(', ')}\n`;
    }
    
    // If hierarchy data is available, use it to show structure
    if (hierarchy && hierarchy.pseudoCode) {
      structuredText += `\n程式結構:\n${hierarchy.pseudoCode}`;
    }
    
    console.log('[SPIKE Advisor] 📋 Generated structured text:', structuredText);
    return structuredText;
  }

  // Generate AI summary of what the code does
  async function generateAISummary(blocks: any[], hierarchy?: any) {
    if (!blocks || blocks.length === 0) {
      setAiSummary('等待積木資料... (Waiting for block data)');
      return;
    }

    try {
          console.log('[AI Summary] 📋 Generating summary for blocks:', blocks);
    console.log('[AI Summary] 📝 Block texts being sent:', blocks.map(b => b.text));
    console.log('[AI Summary] 🏷️ Block categories being sent:', blocks.map(b => b.category));
    console.log('[AI Summary] 🌳 Hierarchy data:', hierarchy);
    console.log('[AI Summary] 🔍 Full block data being sent:', JSON.stringify(blocks, null, 2));
      setAiSummary('正在生成摘要... (Generating summary...)');
      
      const response = await fetch('https://rcwulqsdbrptrrtkluhh.supabase.co/functions/v1/llm-advice', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJjd3VscXNkYnJwdHJydGtsdWhoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM2NjM4NzEsImV4cCI6MjA2OTIzOTg3MX0.ajT317ynsqT0OWwOXroU0GggATbebIRcC5F5nAxVTMg'
        },
        body: JSON.stringify({
          code: {
            summary: "請分析這個程式的邏輯並用簡短的中文描述機器人會做什麼。特別注意條件控制（if-then）和感應器觸發的邏輯結構。",
            pickedSymptom: "program-summary",
            blockText: generateStructuredBlockText(blocks, hierarchy),
            blocks: blocks,
            hierarchy: hierarchy
          },
          lang: "zh-Hant"
        })
      });

      console.log('[AI Summary] Response status:', response.status);
      const data = await response.json();
      console.log('[AI Summary] Response data:', data);
      
      if (data.advice) {
        setAiSummary(data.advice);
        
        // Cache the AI summary for this block configuration
        const currentHash = createBlocksHash(blocks);
        const currentCache = getAiSummaryCache();
        setAiSummaryCache({
          ...currentCache,
          [currentHash]: data.advice
        });
        console.log('[AI Summary] ✅ Cached AI summary for hash:', currentHash.substring(0, 50) + '...');
      } else {
        console.error('[AI Summary] No advice in response:', data);
        setAiSummary('無法生成摘要 (Unable to generate summary)');
      }
    } catch (error) {
      console.error('[AI Summary] Error generating AI summary:', error);
      setAiSummary('摘要生成失敗 (Summary generation failed)');
    }
  }

  // Natural Language to Code Generation - Using proven working AI backend
  const generateCodeFromPrompt = async () => {
    if (!naturalLanguagePrompt.trim()) return;
    
    setIsGeneratingCode(true);
    setGeneratedCode('正在生成代碼... (Generating code...)');
    
    try {
      // Use the SAME proven working backend as "Ask AI"
      const response = await fetch('https://rcwulqsdbrptrrtkluhh.supabase.co/functions/v1/llm-advice', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJjd3VscXNkYnJwdHJydGtsdWhoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM2NjM4NzEsImV4cCI6MjA2OTIzOTg3MX0.ajT317ynsqT0OWwOXroU0GggATbebIRcC5F5nAxVTMg'
        },
        body: JSON.stringify({
          code: {
            summary: `學生的自然語言需求: "${naturalLanguagePrompt}"\n\n請生成全新的積木程式來實現這個功能。`,
            pickedSymptom: "natural-language-generation",
            blockText: `新程式生成需求: ${naturalLanguagePrompt}`,
            blocks: [] // Don't send existing blocks to avoid confusion
          },
          lang: 'zh-Hant'
        })
      });

      const data = await response.json();
      if (data.advice) {
        setGeneratedCode(data.advice);
      } else {
        setGeneratedCode('代碼生成失敗 (Code generation failed)');
      }
    } catch (error) {
      console.error('[Natural Language] Error:', error);
      setGeneratedCode('代碼生成失敗 (Code generation failed)');
    } finally {
      setIsGeneratingCode(false);
    }
  };

  // Smart Code Suggestions - Using proven working AI backend
  const fetchSmartSuggestions = async () => {
    if (!blockData.length) return;
    
    try {
      // Use the SAME proven working backend as "Ask AI"
      const response = await fetch('https://rcwulqsdbrptrrtkluhh.supabase.co/functions/v1/llm-advice', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJjd3VscXNkYnJwdHJydGtsdWhoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM2NjM4NzEsImV4cCI6MjA2OTIzOTg3MX0.ajT317ynsqT0OWwOXroU0GggATbebIRcC5F5nAxVTMg'
        },
        body: JSON.stringify({
          code: {
            summary: `智能建議分析: 請分析學生的當前程式並提供3-5個具體改進建議\n\n當前積木: ${blockData.map(b => `${b.category}: ${b.text}`).join(', ')}`,
            pickedSymptom: "smart-suggestions",
            blockText: blockData.map(b => `${b.category}: ${b.text}`).join(' | '),
            blocks: blockData
          },
          lang: 'zh-Hant'
        })
      });

      const data = await response.json();
      if (data.advice) {
        // Parse the advice as smart suggestions
        const suggestionsText = data.advice;
        
        // Create a simple suggestion format
        const suggestions = [
          {
            type: "analysis",
            title: "智能建議分析",
            description: suggestionsText,
            priority: "medium",
            blockTypes: ["analysis"],
            code: ""
          }
        ];
        
        setSmartSuggestions(suggestions);
      }
    } catch (error) {
      console.error('[Smart Suggestions] Error:', error);
    }
  };

  // Chatbot Conversation - Using the proven working AI backend
  const sendChatMessage = async () => {
    if (!chatInput.trim()) return;
    
    const userMessage = chatInput.trim();
    setChatInput('');
    setIsChatLoading(true);
    
    // Add user message to history
    const newHistory = [...chatHistory, { role: 'user' as const, content: userMessage }];
    setChatHistory(newHistory);
    
    try {
      // Use the SAME proven working backend as "Ask AI" 
      const response = await fetch('https://rcwulqsdbrptrrtkluhh.supabase.co/functions/v1/llm-advice', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJjd3VscXNkYnJwdHJydGtsdWhoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM2NjM4NzEsImV4cCI6MjA2OTIzOTg3MX0.ajT317ynsqT0OWwOXroU0GggATbebIRcC5F5nAxVTMg'
        },
        body: JSON.stringify({
          code: {
            summary: `學生問題: ${userMessage}\n\n對話歷史:\n${newHistory.slice(-4).map(msg => `${msg.role === 'user' ? '學生' : 'AI'}: ${msg.content}`).join('\n')}`,
            pickedSymptom: "chatbot-conversation", 
            blockText: blockData.map(b => `${b.category}: ${b.text}`).join(' | '),
            blocks: blockData
          },
          lang: 'zh-Hant'
        })
      });

      const data = await response.json();
      if (data.advice) {
        setChatHistory([...newHistory, { role: 'assistant', content: data.advice }]);
      } else {
        setChatHistory([...newHistory, { role: 'assistant', content: '抱歉，我無法回應你的問題。請再試一次。' }]);
      }
    } catch (error) {
      console.error('[Chatbot] Error:', error);
      setChatHistory([...newHistory, { role: 'assistant', content: '連接失敗，請檢查網路連線。' }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  // Pin as Window functionality
  const pinAsWindow = () => {
    const currentUrl = chrome.runtime.getURL('src/popup/index.html');
    chrome.windows.create({
      url: currentUrl,
      type: 'popup',
      width: 450,
      height: 700,
      focused: true
    });
    // Close current popup
    window.close();
  };

  // Auto-fetch suggestions when blocks change
  useEffect(() => {
    if (blockData.length > 0 && activeAITab === 'suggestions') {
      fetchSmartSuggestions();
    }
  }, [blockData, activeAITab]);

  // Listen for workspace changes from content script
  useEffect(() => {
    const handleWorkspaceChanges = (message: any, _sender: any, _sendResponse: any) => {
      if (message.type === 'WORKSPACE_CHANGED') {
        console.log('[AI Features] 📝 Workspace changed, updating blocks and suggestions');
        
        // Update block data
        setBlockData(message.blocks || []);
        
        // Auto-trigger suggestions if panel is open
        if (activeAITab === 'suggestions') {
          setTimeout(() => {
            fetchSmartSuggestions();
          }, 1000);
        }
        
        // Auto-generate AI summary if blocks changed significantly
        if (message.blocks && message.blocks.length > 0) {
          setTimeout(() => {
            generateAISummary(message.blocks, null);
          }, 2000);
        }
      }
    };

    // Add listener
    chrome.runtime.onMessage.addListener(handleWorkspaceChanges);
    
    // Cleanup
    return () => {
      chrome.runtime.onMessage.removeListener(handleWorkspaceChanges);
    };
  }, [activeAITab]);

  // Manual refresh function
  function handleRefresh() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs: any[]) => {
      if (tabs[0] && tabs[0].url?.includes('spike.legoeducation.com')) {
        chrome.tabs.sendMessage(tabs[0].id, { type: "REQUEST_BLOCKS" }, (response: any) => {
          if (response) {
            setBlockData(response.blocks || []);
            setBlockText(response.text || "");
            setDebugInfo(`🔄 Manual refresh: ${response.blocks?.length || 0} blocks found`);
            // Generate AI summary only when blocks actually change
            generateAISummaryIfChanged(response.blocks || [], response.hierarchy);
          } else {
            setDebugInfo('❌ No response from content script');
          }
        });
      }
    });
  }

  // Clear AI cache function
  function clearAiCache() {
    console.log('[SPIKE Advisor] 🗑️ Clearing AI summary cache');
    setAiSummaryCache({});
    sessionStorage.removeItem('spike-ai-summary-cache');
    setAiSummary('');
    // Force regeneration with current blocks
    if (blockData.length > 0) {
      console.log('[SPIKE Advisor] 🔄 Forcing fresh AI summary generation');
      // Generate with hierarchy data from the last message
      generateAISummary(blockData, (window as any).__lastHierarchy);
    }
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
      
      // Skip blocks with very short or meaningless text
      if (block.text.length < 3) {
        return false;
      }
      
      // Skip blocks that seem to be phantom/duplicate (check for sensible content)
      if (block.text.includes('when closer than') && !block.text.includes('sensor')) {
        return false;
      }
      
      // Only keep blocks that are actually marked as being in workspace
      if (block.isInWorkspace === false) {
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
      const type = block.type || '';
      
      // Handle specific block types with simplified descriptions
      if (type === 'event_start' || text.includes('when program starts')) {
        return 'Event: when program starts';
      }
      
      if (type === 'motor_speed' && block.motor && block.speed) {
        return `Motor ${block.motor}: set speed to ${block.speed}%`;
      }
      
      if (type === 'control_forever') {
        return 'Control: forever loop';
      }
      
      if (type === 'light_on' && block.duration) {
        return `Light: turn on for ${block.duration} seconds`;
      }
      
      // Handle blocks that might have "when program starts" in their text but are not the event block
      if (category === 'flipperevents') {
        if (text.includes('when program starts')) {
          // Always return just the event, regardless of any extra text
          return 'Event: when program starts';
        }
        if (text.includes('when')) {
          return `Event: ${text}`;
        }
        return `Event: ${text}`;
      }
      
      if (category === 'flippermotor') {
        // Motor blocks - need to parse more carefully
        // Extract motor port (A, B, C, etc.) from text
        const motorMatch = text.match(/\b([A-F])\b/);
        const motorPort = motorMatch ? motorMatch[1] : 'A';
        
        if (text.includes('set speed')) {
          // Multiple approaches to extract speed
          let speed = null;
          
          // Method 1: Look for pattern "set speed to NUMBER"
          const setSpeedMatch = text.match(/set speed to\s+(-?\d+)/);
          if (setSpeedMatch) {
            speed = setSpeedMatch[1];
          }
          
          // Method 2: Look for just a number near "set speed"
          if (!speed) {
            const numberMatch = text.match(/(-?\d+)/);
            if (numberMatch) {
              speed = numberMatch[1];
            }
          }
          
          // Method 3: Default fallback
          if (!speed) {
            speed = '75';
          }
          
          return `Motor ${motorPort}: set speed to ${speed}%`;
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
          
          return `Motor ${motorPort}: run ${direction} for ${amount} ${unit}`;
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
          return `Motor ${motorPort}: start motor ${direction}`;
        }
        if (text.includes('stop motor')) {
          return `Motor ${motorPort}: stop motor`;
        }
        if (text.includes('go shortest path')) {
          return `Motor ${motorPort}: go shortest path to position`;
        }
        if (text.includes('turn for')) {
          const amountMatch = text.match(/(\d+)/);
          const amount = amountMatch ? amountMatch[1] : '1';
          return `Motor ${motorPort}: turn for ${amount} rotations`;
        }
        if (text.includes('go to position')) {
          return `Motor ${motorPort}: go to position`;
        }
        
        // If we just have a motor port letter, try to infer the action
        if (text.trim().match(/^[A-F]$/)) {
          return `Motor ${motorPort}: motor control block`;
        }
        
        return `Motor ${motorPort}: ${text}`;
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
      
      if (category === 'sensors') {
        return text; // Text is already formatted as "Sensor A is color red"
      }
      
      if (category === 'flippercontrol') {
        if (text.includes('forever')) {
          return 'Control: forever loop';
        }
        if (text.includes('repeat')) {
          const countMatch = text.match(/(\d+)/);
          const count = countMatch ? countMatch[1] : '';
          return `Control: repeat ${count} times`;
        }
        if (text.includes('if')) {
          // If this is an enhanced conditional with specific text, preserve it
          if (text.includes('then') && (
            text.includes('sensor') || text.includes('Sensor') ||
            text.includes('reflection') || text.includes('color') || 
            text.includes('closer') || text.includes('pressed') ||
            text.includes('motor') || text.includes('move')
          )) {
            return `Control: ${text}`;
          }
          return 'Control: if condition';
        }
        if (text.includes('wait')) {
          return 'Control: wait';
        }
        return `Control: ${text}`;
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
        {/* Collapsible Header */}
        <div 
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            cursor: 'pointer',
            padding: '8px 0',
            borderBottom: '1px solid #e9ecef'
          }}
          onClick={() => setIsBlockPanelCollapsed(!isBlockPanelCollapsed)}
        >
          <h3 style={{ margin: '0', color: '#333', fontSize: '16px' }}>
            🧩 檢測到的積木設定 (Detected Blocks) ({workspaceBlocks.length})
          </h3>
          <span style={{ fontSize: '14px', color: '#666' }}>
            {isBlockPanelCollapsed ? '▼' : '▲'}
          </span>
        </div>
        
        {/* AI Summary */}
        {!isBlockPanelCollapsed && (
          <div style={{ 
            margin: '10px 0', 
            padding: '10px', 
            background: '#e3f2fd', 
            border: '1px solid #2196f3', 
            borderRadius: '6px',
            fontSize: '13px',
            color: '#1565c0'
          }}>
            <div style={{ fontWeight: '600', marginBottom: '5px' }}>
              🤖 AI 程式摘要 (AI Program Summary):
            </div>
            <div>{aiSummary || '正在生成摘要... (Generating summary...)'}</div>
          </div>
        )}
        
        {/* Collapsible Content */}
        {!isBlockPanelCollapsed && (
          <>
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
              <button 
                onClick={clearAiCache}
                style={{
                  background: '#ffc107',
                  color: '#212529',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '6px 12px',
                  fontSize: '12px',
                  cursor: 'pointer',
                  marginRight: '8px'
                }}
                title="Clear AI cache and regenerate summary"
              >
                🗑️ Clear Cache
              </button>
              <span style={{ fontSize: '11px', color: '#666' }}>
                Smart updates: only when blocks change
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
          </>
        )}
      </div>
    );
  };

  return (
    <div style={{ width: 400, padding: 16, fontFamily: "system-ui, -apple-system, sans-serif" }}>
      {/* Header with Pin Button */}
      <div style={{ 
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)", 
        color: "white", 
        padding: "12px 16px", 
        borderRadius: "8px 8px 0 0", 
        margin: "-16px -16px 16px -16px",
        position: "relative"
      }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>🤖 SPIKE AI Error Advisor</h2>
        <p style={{ margin: "4px 0 0 0", fontSize: 12, opacity: 0.9 }}>
          LEGO SPIKE Prime 智能除錯助手
        </p>
        
        {/* Pin as Window Button */}
        <button
          onClick={pinAsWindow}
          style={{
            position: "absolute",
            top: "12px",
            right: "12px",
            background: "rgba(255,255,255,0.2)",
            border: "1px solid rgba(255,255,255,0.3)",
            borderRadius: "4px",
            color: "white",
            padding: "4px 8px",
            fontSize: "11px",
            cursor: "pointer",
            fontWeight: "500"
          }}
          title="Pin as separate window"
        >
          📌 Pin
        </button>
      </div>

      {/* AI Assistant Panel - TOP SECTION */}
      <div style={{ marginBottom: 16, border: "2px solid #667eea", borderRadius: "8px", padding: "12px" }}>
        <h3 style={{ margin: "0 0 12px 0", fontSize: "16px", color: "#667eea", display: "flex", alignItems: "center" }}>
          🤖 AI 助手 / AI Assistant
        </h3>
        
        {/* AI Feature Tabs */}
        <div style={{ display: "flex", gap: "4px", marginBottom: "16px", flexWrap: "wrap" }}>
          <button
            onClick={() => setActiveAITab(activeAITab === 'chat' ? null : 'chat')}
            style={{
              background: activeAITab === 'chat' ? '#667eea' : '#f8f9fa',
              color: activeAITab === 'chat' ? 'white' : '#333',
              border: '1px solid #ddd',
              borderRadius: '6px',
              padding: '8px 12px',
              fontSize: '12px',
              cursor: 'pointer',
              fontWeight: '500',
              flex: '1'
            }}
          >
            💬 AI 聊天 | AI Chat
          </button>
          <button
            onClick={() => setActiveAITab(activeAITab === 'suggestions' ? null : 'suggestions')}
            style={{
              background: activeAITab === 'suggestions' ? '#28a745' : '#f8f9fa',
              color: activeAITab === 'suggestions' ? 'white' : '#333',
              border: '1px solid #ddd',
              borderRadius: '6px',
              padding: '8px 12px',
              fontSize: '12px',
              cursor: 'pointer',
              fontWeight: '500',
              flex: '1'
            }}
          >
            💡 智能建議 | AI Suggestions
          </button>
          <button
            onClick={() => setActiveAITab(activeAITab === 'natural' ? null : 'natural')}
            style={{
              background: activeAITab === 'natural' ? '#007bff' : '#f8f9fa',
              color: activeAITab === 'natural' ? 'white' : '#333',
              border: '1px solid #ddd',
              borderRadius: '6px',
              padding: '8px 12px',
              fontSize: '12px',
              cursor: 'pointer',
              fontWeight: '500',
              flex: '1'
            }}
          >
            🧩 自然語言編程 | Natural Language to Code
          </button>
        </div>

        {/* AI Chat Interface */}
        {activeAITab === 'chat' && (
          <div style={{ 
            background: '#fffacd', 
            border: '1px solid #ffd700', 
            borderRadius: '8px', 
            padding: '12px'
          }}>
            <div style={{
              background: 'white',
              border: '1px solid #ddd',
              borderRadius: '4px',
              height: '200px',
              overflowY: 'auto',
              padding: '8px',
              marginBottom: '8px'
            }}>
              {chatHistory.length === 0 ? (
                <div style={{ color: '#666', fontSize: '12px', textAlign: 'center', padding: '20px' }}>
                  問我任何關於SPIKE Prime編程的問題！
                </div>
              ) : (
                chatHistory.map((msg, index) => (
                  <div key={index} style={{
                    marginBottom: '8px',
                    padding: '6px',
                    borderRadius: '4px',
                    background: msg.role === 'user' ? '#e3f2fd' : '#f5f5f5',
                    fontSize: '12px'
                  }}>
                    <div style={{ fontWeight: 'bold', marginBottom: '2px' }}>
                      {msg.role === 'user' ? '你：' : 'AI：'}
                    </div>
                    <div>{msg.content}</div>
                  </div>
                ))
              )}
              {isChatLoading && (
                <div style={{ color: '#666', fontSize: '12px', fontStyle: 'italic' }}>
                  AI 正在思考中...
                </div>
              )}
            </div>
            
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendChatMessage()}
                placeholder="問問題，例如：為什麼我的機器人不會轉彎？"
                style={{
                  flex: 1,
                  padding: '6px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '12px'
                }}
              />
              <button
                onClick={sendChatMessage}
                disabled={!chatInput.trim() || isChatLoading}
                style={{
                  background: '#ffc107',
                  color: 'black',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '6px 12px',
                  fontSize: '12px',
                  cursor: 'pointer',
                  opacity: (!chatInput.trim() || isChatLoading) ? 0.6 : 1
                }}
              >
                發送
              </button>
            </div>
          </div>
        )}

        {/* Smart Suggestions Interface */}
        {activeAITab === 'suggestions' && (
          <div style={{ 
            background: '#f0fff0', 
            border: '1px solid #90ee90', 
            borderRadius: '8px', 
            padding: '12px'
          }}>
            <button
              onClick={fetchSmartSuggestions}
              style={{
                background: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                padding: '6px 12px',
                fontSize: '12px',
                cursor: 'pointer',
                marginBottom: '12px'
              }}
            >
              🔄 獲取建議
            </button>
            
            {smartSuggestions.length > 0 ? (
              <div>
                {smartSuggestions.map((suggestion, index) => (
                  <div key={index} style={{
                    background: 'white',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    padding: '8px',
                    marginBottom: '8px',
                    fontSize: '12px'
                  }}>
                    <div style={{ fontWeight: 'bold', color: '#006600', marginBottom: '4px' }}>
                      {suggestion.title}
                    </div>
                    <div style={{ color: '#333' }}>
                      {suggestion.description}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ margin: 0, fontSize: '12px', color: '#666' }}>
                點擊上方按鈕獲取智能建議
              </p>
            )}
          </div>
        )}

        {/* Natural Language to Code Interface */}
        {activeAITab === 'natural' && (
          <div style={{ 
            background: '#f0f8ff', 
            border: '1px solid #b3d9ff', 
            borderRadius: '8px', 
            padding: '12px'
          }}>
            <p style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#666' }}>
              用自然語言描述你想要的機器人行為，AI 會為你生成對應的積木代碼。
            </p>
            <textarea
              value={naturalLanguagePrompt}
              onChange={(e) => setNaturalLanguagePrompt(e.target.value)}
              placeholder="例如：讓機器人前進直到顏色感應器檢測到紅色，然後停止..."
              style={{
                width: '100%',
                height: '60px',
                padding: '8px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '12px',
                resize: 'vertical',
                fontFamily: 'inherit'
              }}
            />
            <button
              onClick={generateCodeFromPrompt}
              disabled={!naturalLanguagePrompt.trim() || isGeneratingCode}
              style={{
                background: '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                padding: '6px 12px',
                fontSize: '12px',
                cursor: 'pointer',
                marginTop: '8px',
                opacity: (!naturalLanguagePrompt.trim() || isGeneratingCode) ? 0.6 : 1
              }}
            >
              {isGeneratingCode ? '生成中...' : '生成積木代碼'}
            </button>
            {generatedCode && (
              <div style={{
                background: 'white',
                border: '1px solid #ddd',
                borderRadius: '4px',
                padding: '8px',
                marginTop: '8px',
                fontSize: '12px',
                whiteSpace: 'pre-wrap'
              }}>
                {generatedCode}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Quick Issue Troubleshooting - MIDDLE SECTION */}
      <div style={{ marginBottom: 16 }}>
        <h3 style={{ margin: "0 0 12px 0", fontSize: "14px", color: "#2C3E50" }}>📋 常見問題 / Common Troubles</h3>

        {/* Quick Issue Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
          {dropdownOptions.slice(1).map(opt => (
            <button
              key={opt.key}
              onClick={() => {
                setSelectedError(opt.key as ErrorTypeKey);
                handleDropdownChange({ target: { value: opt.key } } as any);
              }}
              style={{
                background: selectedError === opt.key ? '#667eea' : '#f8f9fa',
                color: selectedError === opt.key ? 'white' : '#333',
                border: '1px solid #ddd',
                borderRadius: '6px',
                padding: '8px',
                fontSize: '11px',
                cursor: 'pointer',
                textAlign: 'center',
                fontWeight: '500'
              }}
            >
              {opt.label.includes('/') ? opt.label.split(' / ')[0] : opt.label}
            </button>
          ))}
        </div>
        
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

      {/* Footer */}
      <div style={{
        marginTop: '24px',
        padding: '16px',
        background: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)',
        borderRadius: '8px',
        border: '1px solid #dee2e6',
        textAlign: 'center'
      }}>
        <div style={{ 
          fontSize: '14px', 
          fontWeight: '600', 
          color: '#495057',
          marginBottom: '8px'
        }}>
          RoboYouth Taiwan
        </div>
        <div style={{ 
          fontSize: '12px', 
          color: '#6c757d',
          marginBottom: '4px'
        }}>
          Created by Sophie Hsu
        </div>
        <div style={{ 
          fontSize: '11px', 
          color: '#868e96',
          marginBottom: '6px'
        }}>
          Beta version 0.1
        </div>
        <div style={{ 
          fontSize: '11px', 
          color: '#007bff',
          fontWeight: '500'
        }}>
          Support: roboyouthtaiwan@gmail.com
        </div>
      </div>

      {/* Detected Blocks & Debug Info - COLLAPSIBLE SECTION */}
      <div style={{ marginBottom: 16 }}>
        <button
          onClick={() => setIsDebugCollapsed(!isDebugCollapsed)}
          style={{
            background: '#f8f9fa',
            border: '1px solid #ddd',
            borderRadius: '6px',
            padding: '8px 12px',
            fontSize: '12px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            width: '100%',
            justifyContent: 'space-between'
          }}
        >
          <span>🔍 偵測的積木與除錯資訊 / Detected Blocks & Debug Info</span>
          <span>{isDebugCollapsed ? '▼' : '▲'}</span>
        </button>
        
        {!isDebugCollapsed && (
          <div style={{ marginTop: '12px' }}>
            {/* Block Summary */}
            {blockData && blockData.length > 0 && (
              <div style={{
                background: "#f8f9fa",
                border: "1px solid #e9ecef",
                borderRadius: 8,
                padding: 12,
                marginBottom: 12,
                fontSize: 13,
                lineHeight: 1.4
              }}>
                <h3 style={{ margin: "0 0 8px 0", color: "#495057", fontSize: 14 }}>
                  🧩 檢測到的積木設定 (Detected Blocks) ({blockData.length})
                </h3>
                
                {/* Manual Refresh Button */}
                <div style={{ marginBottom: '8px' }}>
                  <button
                    onClick={handleRefresh}
                    className="refresh-btn"
                    style={{
                      background: '#28a745',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '6px 12px',
                      fontSize: '12px',
                      cursor: 'pointer',
                      marginRight: '8px'
                    }}
                  >
                    🔄 Refresh
                  </button>
                  <button
                    onClick={clearAiCache}
                    style={{
                      background: '#dc3545',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '6px 12px',
                      fontSize: '12px',
                      cursor: 'pointer'
                    }}
                  >
                    🗑️ Clear Cache
                  </button>
                  <span style={{ fontSize: '11px', color: '#666', marginLeft: '8px' }}>
                    Smart updates: only when blocks change
                  </span>
                </div>

                {renderBlockSummary()}
              </div>
            )}

            {/* AI Summary */}
            {aiSummary && (
              <div style={{
                background: "#e3f2fd",
                border: "1px solid #2196f3",
                borderRadius: 8,
                padding: 12,
                marginBottom: 12,
                fontSize: 13,
                lineHeight: 1.4
              }}>
                <h3 style={{ margin: "0 0 8px 0", color: "#1976d2", fontSize: 14 }}>
                  🤖 AI 程式摘要 (AI Program Summary):
                </h3>
                <div style={{ whiteSpace: "pre-wrap" }}>{aiSummary}</div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer Section */}
      <div style={{
        borderTop: '1px solid #e9ecef',
        paddingTop: '12px',
        textAlign: 'center',
        fontSize: '11px',
        color: '#868e96',
        marginTop: '20px'
      }}>
        <div style={{ marginBottom: '6px' }}>
          Beta version 0.2 - Enhanced with AI Assistant
        </div>
        <div style={{ 
          fontSize: '11px', 
          color: '#007bff',
          fontWeight: '500'
        }}>
          Support: roboyouthtaiwan@gmail.com
        </div>
      </div>

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
