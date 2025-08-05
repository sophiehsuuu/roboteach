import { useState, useEffect } from "react";
declare const chrome: any;

// --- Strict keys for error types ---
type ErrorTypeKey = "" | "motor" | "direction" | "not-starting" | "stop" | "sensor" | "other";



const errorAdviceMap: Record<Exclude<ErrorTypeKey, "">, {
  zh: string;
  en: string;
  whatWentWrong: { zh: string; en: string; };
  howToFix: { zh: string; en: string; };
  whatToExpect: { zh: string; en: string; };
}> = {
  "motor": {
    zh: "馬達未啟動",
    en: "Motor Not Moving",
    whatWentWrong: {
      zh: "❗ 機器人馬達沒有動作。可能原因包含缺少積木、連接不良或速度太低。",
      en: "❗ The robot's motors aren't moving. This often happens when a block is missing, motors aren't connected, or speed is set too low."
    },
    howToFix: {
      zh: "檢查接線： 馬達線是否確實插在A、B端口？\n積木檢查： 是否有「設置馬達A速度75%」與「啟動馬達」或「前進」積木？\n速度設定： 請將速度提高至70%以上。\n端口檢查： 積木設定端口與馬達連線一致嗎？\n實地測試： 按下「執行」。沒動？嘗試換一個端口或馬達。",
      en: "Check connections: Make sure motor cables are firmly plugged into Port A and Port B on your hub.\nBlock check: Confirm your code includes blocks that set the motor speed (like \"set motor A speed to 75%\") and \"start motor\" or \"move forward.\"\nSpeed: Set the speed to at least 70% for best results—low speeds may not move the robot.\nPort match: Is your code using the same port as the cable?\nRun a Test: Press \"Run.\" If nothing moves, try swapping the cable to another port and update your code."
    },
    whatToExpect: {
      zh: "成功時馬達應該會轉動。\n還是不行？檢查積木順序或請AI助理協助細查。",
      en: "The robot should move forward.\nIf not, review your blocks for missing actions or try another motor.\nStill not working? Tap \"Ask AI\" below for step-by-step diagnostics."
    }
  },
  "direction": {
    zh: "機器人方向錯誤",
    en: "Robot Moving Wrong Direction",
    whatWentWrong: {
      zh: "↩️ 機器人原地轉圈或倒退。",
      en: "↩️ The robot spins in place or moves backward."
    },
    howToFix: {
      zh: "檢查馬達方向： 兩個馬達都應設為「前進」。\n積木順序檢查： 是否混用「前進」與「後退」？\n修正範例： A、B都設「前進」。\n再測試一次。",
      en: "Check motor direction settings: Both motors should be set to the same direction (e.g., both \"forward\").\nReview block order: Are you mixing \"forward\" and \"backward\"/\"reverse\" blocks?\nFix rotation direction: Example:\n[set motor A forward]\n[set motor B forward]\nTest again: Does the robot now move straight?"
    },
    whatToExpect: {
      zh: "如果還是錯誤，請檢查端口設定或請AI助理協助。",
      en: "The robot should drive straight.\nIf it still spins, check for mismatched ports or blocks.\nNeed more help? Use \"Ask AI\" below."
    }
  },
  "not-starting": {
    zh: "程式未開始",
    en: "Code Not Starting",
    whatWentWrong: {
      zh: "⏯️ 程式按下「執行」沒反應。",
      en: "⏯️ The program doesn't run when you click \"Run.\""
    },
    howToFix: {
      zh: "檢查開始積木： 最上方應有「當程式開始」積木。\n積木連接完整： 所有指令應串在一起。\n再次執行測試。",
      en: "Check for a start block: Make sure you have a \"when program starts\" block at the very top of your code.\nNo gaps: Blocks must be connected smoothly from the start block.\nTest: Press \"Run\" again after corrections."
    },
    whatToExpect: {
      zh: "程式應正常開始。仍無法啟動請求助AI助理。",
      en: "The program should start running automatically.\nIf nothing happens, double-check the order of your blocks.\nStill stuck? Ask the AI for more help."
    }
  },
  "stop": {
    zh: "無法停止",
    en: "Can't Stop",
    whatWentWrong: {
      zh: "🔄 機器人不會停止，可能陷入無限循環。",
      en: "🔄 The robot never stops—maybe stuck in a forever loop."
    },
    howToFix: {
      zh: "檢查循環結構： 若用「永遠」循環，需配合停止條件（如感測器觸發時「停止所有馬達」）。\n加入停止積木： 例如 [如果按鈕被按下 → 停止所有馬達]\n用「直到...」： 建議用「重複直到」達到停機條件。",
      en: "Check loop structure: If you use a \"forever\" loop, ensure there's a way to stop (like an \"if sensor pressed, stop all motors\" inside your loop).\nAdd a stop block: Example:\n[if touch sensor pressed → stop all motors]\nUse \"repeat until\" for finite actions: For stop-on-sensor, consider \"repeat until [sensor]\" instead of \"forever.\""
    },
    whatToExpect: {
      zh: "程式應在條件達成時停止。如仍不會停，請求助AI。",
      en: "The robot should halt when your stop condition is met.\nIf it keeps running, recheck your loop/block logic.\nStill looping? Use \"Ask AI\" for custom help."
    }
  },
  "sensor": {
    zh: "感應器無反應",
    en: "Sensor Not Responding",
    whatWentWrong: {
      zh: "🛰️ 感應器沒反應。機器人沒有偵測到線、物體或按鈕。",
      en: "🛰️ Sensors don't seem to work. Your robot isn't reacting to lines, objects, or buttons."
    },
    howToFix: {
      zh: "檢查線與端口： 感應器需正確插入對應端口。\n積木檢查： 程式要包含感應器積木（如「如果顏色感應器感測到藍色」）。\n感應器類型正確： 積木與硬體要對應（顏色、距離、按鈕等）。\n用簡單範例測試。",
      en: "Check cable & port: Is your sensor properly connected to the port used in your code?\nBlock presence: Make sure your program includes relevant sensor blocks (e.g., \"when color sensor detects blue...\").\nCorrect sensor type: Are you using the correct block for your hardware (color, distance, touch)?\nTest with simple program: Try a one-block test to check sensor status."
    },
    whatToExpect: {
      zh: "正常時會有反應。如果還是無效，換端口或感應器試試。\n仍無法解決？請詢問AI助理。",
      en: "Robot should react to sensor triggers.\nNot working? Sensors or wiring may be faulty—try another port or sensor.\nStill no luck? Describe your issue for AI help below."
    }
  },
  "other": {
    zh: "其他／未列出問題",
    en: "Other / Not Listed",
    whatWentWrong: {
      zh: "🤔 其他無法分類的問題。",
      en: "🤔 You have a different or complex problem."
    },
    howToFix: {
      zh: "請在上方輸入框說明問題。\n按「詢問AI」讓助理針對你的程式給專屬解方。",
      en: "Please describe your issue clearly in the box above.\nClick \"Ask AI\" so our assistant can analyze your code and help you with a personalized step-by-step solution."
    },
    whatToExpect: {
      zh: "AI 會分析並提供專屬建議！",
      en: "You'll get an AI-powered diagnosis and fix."
    }
  }
};

// Function to get bilingual labels
const getBilingualLabel = (key: string, selectedLang: string) => {
  const labels: any = {
    "": {
      en: "👇 Select an issue",
      'zh-TW': "👇 請選擇遇到的問題 / Select an issue",
      'zh-CN': "👇 请选择遇到的问题 / Select an issue",
      es: "👇 Selecciona un problema / Select an issue",
      hi: "👇 समस्या चुनें / Select an issue",
      ar: "👇 اختر مشكلة / Select an issue",
      pt: "👇 Selecione um problema / Select an issue",
      bn: "👇 সমস্যা নির্বাচন করুন / Select an issue",
      ru: "👇 Выберите проблему / Select an issue",
      fr: "👇 Sélectionnez un problème / Select an issue",
      id: "👇 Pilih masalah / Select an issue"
    },
    motor: {
      en: "Motor Not Moving",
      'zh-TW': "馬達未啟動 / Motor Not Moving",
      'zh-CN': "马达未启动 / Motor Not Moving",
      es: "Motor No Se Mueve / Motor Not Moving",
      hi: "मोटर नहीं चल रहा / Motor Not Moving",
      ar: "المحرك لا يتحرك / Motor Not Moving",
      pt: "Motor Não Se Move / Motor Not Moving",
      bn: "মোটর চলছে না / Motor Not Moving",
      ru: "Мотор Не Движется / Motor Not Moving",
      fr: "Moteur Ne Bouge Pas / Motor Not Moving",
      id: "Motor Tidak Bergerak / Motor Not Moving"
    },
    direction: {
      en: "Wrong Direction",
      'zh-TW': "機器人方向錯誤 / Wrong Direction",
      'zh-CN': "机器人方向错误 / Wrong Direction",
      es: "Dirección Incorrecta / Wrong Direction",
      hi: "गलत दिशा / Wrong Direction",
      ar: "اتجاه خاطئ / Wrong Direction",
      pt: "Direção Errada / Wrong Direction",
      bn: "ভুল দিক / Wrong Direction",
      ru: "Неправильное Направление / Wrong Direction",
      fr: "Mauvaise Direction / Wrong Direction",
      id: "Arah Salah / Wrong Direction"
    },
    "not-starting": {
      en: "Code Not Starting",
      'zh-TW': "程式未開始 / Code Not Starting",
      'zh-CN': "程序未开始 / Code Not Starting",
      es: "Código No Inicia / Code Not Starting",
      hi: "कोड शुरू नहीं हो रहा / Code Not Starting",
      ar: "الكود لا يبدأ / Code Not Starting",
      pt: "Código Não Inicia / Code Not Starting",
      bn: "কোড শুরু হচ্ছে না / Code Not Starting",
      ru: "Код Не Запускается / Code Not Starting",
      fr: "Code Ne Démarre Pas / Code Not Starting",
      id: "Kode Tidak Mulai / Code Not Starting"
    },
    stop: {
      en: "Can't Stop",
      'zh-TW': "無法停止 / Can't Stop",
      'zh-CN': "无法停止 / Can't Stop",
      es: "No Puede Parar / Can't Stop",
      hi: "रुक नहीं सकता / Can't Stop",
      ar: "لا يمكن التوقف / Can't Stop",
      pt: "Não Consegue Parar / Can't Stop",
      bn: "থামতে পারছে না / Can't Stop",
      ru: "Не Может Остановиться / Can't Stop",
      fr: "Ne Peut Pas S'Arrêter / Can't Stop",
      id: "Tidak Bisa Berhenti / Can't Stop"
    },
    sensor: {
      en: "Sensor Not Responding",
      'zh-TW': "感應器無反應 / Sensor Not Responding",
      'zh-CN': "传感器无反应 / Sensor Not Responding",
      es: "Sensor No Responde / Sensor Not Responding",
      hi: "सेंसर जवाब नहीं दे रहा / Sensor Not Responding",
      ar: "المستشعر لا يستجيب / Sensor Not Responding",
      pt: "Sensor Não Responde / Sensor Not Responding",
      bn: "সেন্সর সাড়া দিচ্ছে না / Sensor Not Responding",
      ru: "Датчик Не Отвечает / Sensor Not Responding",
      fr: "Capteur Ne Répond Pas / Sensor Not Responding",
      id: "Sensor Tidak Merespons / Sensor Not Responding"
    },
    other: {
      en: "Other / Not Listed",
      'zh-TW': "其他／未列出問題 / Other",
      'zh-CN': "其他／未列出问题 / Other",
      es: "Otro / No Listado / Other",
      hi: "अन्य / सूचीबद्ध नहीं / Other",
      ar: "أخرى / غير مدرجة / Other",
      pt: "Outro / Não Listado / Other",
      bn: "অন্যান্য / তালিকাভুক্ত নয় / Other",
      ru: "Другое / Не Указано / Other",
      fr: "Autre / Non Répertorié / Other",
      id: "Lainnya / Tidak Terdaftar / Other"
    }
  };
  
  return labels[key]?.[selectedLang] || labels[key]?.en || key;
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



export default function Popup() {
  const [output, setOutput] = useState('');
  const [selectedError, setSelectedError] = useState<ErrorTypeKey>('');



  const [blockData, setBlockData] = useState<any[]>([]);
  const [debugInfo, setDebugInfo] = useState<string>('');
  const [isBlockPanelCollapsed, setIsBlockPanelCollapsed] = useState<boolean>(false);
  const [aiSummary, setAiSummary] = useState<string>('');
  
  // New AI features state
  const [naturalLanguagePrompt, setNaturalLanguagePrompt] = useState<string>('');
  const [generatedCode, setGeneratedCode] = useState<string>('');
  const [isGeneratingCode, setIsGeneratingCode] = useState<boolean>(false);
  const [chatHistory, setChatHistory] = useState<Array<{role: 'user' | 'assistant', content: string}>>([]);
  const [chatInput, setChatInput] = useState<string>('');
  const [isChatLoading, setIsChatLoading] = useState<boolean>(false);
  const [activeAITab, setActiveAITab] = useState<'chat' | 'natural' | null>(null);
  const [isDebugCollapsed, setIsDebugCollapsed] = useState<boolean>(true);
  const [selectedLanguage, setSelectedLanguage] = useState<'en' | 'zh-TW'>(() => {
    const saved = localStorage.getItem('spike-ai-language');
    return (saved as any) || 'zh-TW';
  });
  const [stickyMode, setStickyMode] = useState(() => {
    const saved = localStorage.getItem('spike-ai-sticky-mode');
    return saved === 'true';
  });
  
  // Language text helper - expanded for all languages
  const getText = (texts: any) => {
    return texts[selectedLanguage] || texts.en;
  };

  // AI Prompts in different languages
  const getAIPrompts = () => {
    const prompts: any = {
      'en': {
        programAnalysis: "Please analyze this program's logic and briefly describe in English what the robot will do. Pay special attention to conditional controls (if-then) and sensor-triggered logic structures.",
        naturalLanguageGeneration: (prompt: string) => `IMPORTANT: Respond in English only. Do not use any other language.

Student's natural language requirement: "${prompt}"

Please generate a completely new block program to implement this functionality. Follow these rules for 'move until condition then stop' patterns:

1. Use a 'repeat until' control block with the movement block inside the loop
2. Place the stop command outside and after the loop
3. Do NOT add any more movement blocks after the stop
4. Ensure robot actions actually STOP once the condition is met

Example pattern:
- Event Block: 'when program starts'
- Motor Block: 'set motors A and B speed to 70%'
- Control Block: 'repeat until distance sensor < 10cm'
- Motor Block: 'move motors A and B forward 1 rotation'
- Stop Block: 'stop all motors'

Generate the block sequence in English:`,

        chatConversation: (userMessage: string, history: any[], currentBlocks: any[], aiSummary: string) => `You are a helpful AI assistant for LEGO SPIKE Prime programming. Answer the student's question directly and specifically based on their current program.

Student's current question: ${userMessage}

CURRENT PROGRAM CONTEXT:
${aiSummary ? `Program Summary: ${aiSummary}` : 'No program summary available'}

Current Blocks Detected: ${currentBlocks?.length || 0} blocks
${currentBlocks?.length > 0 ? currentBlocks.map(b => `- ${b.category}: ${b.text}`).slice(0, 10).join('\n') : 'No blocks detected'}

Previous conversation:
${history.map(msg => `${msg.role === 'user' ? 'Student' : 'AI'}: ${msg.content}`).join('\n')}

Instructions:
- Answer based on the student's ACTUAL program shown above
- If they ask about speed, look at their current motor blocks and suggest specific improvements
- If they ask about movement, reference their actual movement blocks
- If they ask about sensors, check their sensor blocks
- Use the program context to give relevant, specific advice
- Use clear, simple language with proper line breaks
- Do NOT use markdown formatting like ** or *
- Focus on their actual question and their actual code`
      },
      'zh-TW': {
        programAnalysis: "請分析這個程式的邏輯並用簡短的中文描述機器人會做什麼。特別注意條件控制（if-then）和感應器觸發的邏輯結構。",
        naturalLanguageGeneration: (prompt: string) => `重要：請用繁體中文回答。不要使用其他語言。

學生的自然語言需求: "${prompt}"

請生成全新的積木程式來實現這個功能。對於「移動直到條件然後停止」的模式，請遵循以下規則：

1. 使用「重複直到」控制積木，將移動積木放在迴圈內
2. 將停止命令放在迴圈外和迴圈後
3. 停止後不要添加任何更多移動積木
4. 確保機器人動作在條件滿足時確實停止

範例模式：
- 事件積木：「當程式開始時」
- 馬達積木：「設定馬達 A 和 B 速度為 70%」
- 控制積木：「重複直到距離感應器 < 10cm」
- 馬達積木：「馬達 A 和 B 向前移動 1 圈」
- 停止積木：「停止所有馬達」

用繁體中文生成積木序列：`,

        chatConversation: (userMessage: string, history: any[], currentBlocks: any[], aiSummary: string) => `你是一個幫助LEGO SPIKE Prime編程的AI助手。根據學生當前的程式直接且具體地回答問題。

學生當前的問題: ${userMessage}

當前程式內容:
${aiSummary ? `程式摘要: ${aiSummary}` : '沒有程式摘要'}

檢測到的積木: ${currentBlocks?.length || 0} 個積木
${currentBlocks?.length > 0 ? currentBlocks.map(b => `- ${b.category}: ${b.text}`).slice(0, 10).join('\n') : '沒有檢測到積木'}

之前的對話:
${history.map(msg => `${msg.role === 'user' ? '學生' : 'AI'}: ${msg.content}`).join('\n')}

指示:
- 根據學生上方顯示的實際程式來回答
- 如果詢問速度，檢查他們當前的馬達積木並建議具體改進
- 如果詢問移動，參考他們實際的移動積木
- 如果詢問感應器，檢查他們的感應器積木
- 使用程式內容給出相關、具體的建議
- 使用清晰、簡單的語言和適當的換行
- 不要使用markdown格式如 ** 或 *
- 專注於他們的實際問題和實際代碼`
      }
    };
    
    // Return the prompts for the selected language, fallback to English
    return prompts[selectedLanguage] || prompts['en'];

  };
  
  // Convert UI language to API language format
  const getApiLanguage = () => {
    const languageMap = {
      'en': 'en',
      'zh-TW': 'zh-TW'
    };
    return languageMap[selectedLanguage] || 'en';
  };
  
  // Save language preference
  useEffect(() => {
    localStorage.setItem('spike-ai-language', selectedLanguage);
  }, [selectedLanguage]);

  // Save sticky mode preference and handle sticky behavior
  useEffect(() => {
    localStorage.setItem('spike-ai-sticky-mode', stickyMode.toString());
  }, [stickyMode]);

  // Handle beforeunload to inform about developer tools method
  useEffect(() => {
    if (stickyMode) {
      const handleBeforeUnload = () => {
        localStorage.setItem('spike-ai-show-dev-tools-tip', 'true');
      };
      
      window.addEventListener('beforeunload', handleBeforeUnload);
      return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }
  }, [stickyMode]);

  // Toggle sticky mode
  const toggleStickyMode = () => {
    setStickyMode(!stickyMode);
  };



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

  // Function to create a simple hash of block content for comparison
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

        setDebugInfo(`🔄 ${getText({
          en: `Blocks changed: ${msg.data.blocks?.length || 0} blocks detected`,
          'zh-TW': `積木已變更：偵測到 ${msg.data.blocks?.length || 0} 個積木`
        })}`);
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
      setAiSummary(getText({
        en: 'Waiting for block data...',
        'zh-TW': '等待積木資料...'
      }));
      return;
    }

    try {
          console.log('[AI Summary] 📋 Generating summary for blocks:', blocks);
    console.log('[AI Summary] 📝 Block texts being sent:', blocks.map(b => b.text));
    console.log('[AI Summary] 🏷️ Block categories being sent:', blocks.map(b => b.category));
    console.log('[AI Summary] 🌳 Hierarchy data:', hierarchy);
    console.log('[AI Summary] 🔍 Full block data being sent:', JSON.stringify(blocks, null, 2));
      setAiSummary(getText({
        en: 'Generating summary...',
        'zh-TW': '正在生成摘要...'
      }));
      
      const response = await fetch('https://rcwulqsdbrptrrtkluhh.supabase.co/functions/v1/llm-advice', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJjd3VscXNkYnJwdHJydGtsdWhoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM2NjM4NzEsImV4cCI6MjA2OTIzOTg3MX0.ajT317ynsqT0OWwOXroU0GggATbebIRcC5F5nAxVTMg'
        },
        body: JSON.stringify({
          code: {
            summary: getAIPrompts().programAnalysis,
            pickedSymptom: "program-summary",
            blockText: generateStructuredBlockText(blocks, hierarchy),
            blocks: blocks,
            hierarchy: hierarchy
          },
          lang: getApiLanguage()
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
        setAiSummary(getText({
          en: 'Unable to generate summary',
          'zh-TW': '無法生成摘要'
        }));
      }
    } catch (error) {
      console.error('[AI Summary] Error generating AI summary:', error);
      setAiSummary(getText({
        en: 'Summary generation failed',
        'zh-TW': '摘要生成失敗'
      }));
    }
  }

  // Natural Language to Code Generation - Using proven working AI backend
  const generateCodeFromPrompt = async () => {
    if (!naturalLanguagePrompt.trim()) return;
    
    setIsGeneratingCode(true);
    setGeneratedCode(getText({
      en: 'Generating code...',
      'zh-TW': '正在生成代碼...'
    }));
    
    try {
      // Clear any existing AI cache to ensure fresh response
      clearAiCache();
      
      const currentLanguage = getApiLanguage();
      const currentPrompt = getAIPrompts().naturalLanguageGeneration(naturalLanguagePrompt);
      
      console.log('[Natural Language] 🌍 Current language:', selectedLanguage);
      console.log('[Natural Language] 🔤 API language:', currentLanguage);
      console.log('[Natural Language] 📝 Prompt being sent:', currentPrompt);
      
      // Use the SAME proven working backend as "Ask AI"
      const response = await fetch('https://rcwulqsdbrptrrtkluhh.supabase.co/functions/v1/llm-advice', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJjd3VscXNkYnJwdHJydGtsdWhoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM2NjM4NzEsImV4cCI6MjA2OTIzOTg3MX0.ajT317ynsqT0OWwOXroU0GggATbebIRcC5F5nAxVTMg'
        },
        body: JSON.stringify({
          code: {
            summary: currentPrompt,
            pickedSymptom: "natural-language-generation",
            blockText: `${getText({
              en: 'New program generation request:',
              'zh-TW': '新程式生成需求:',
              'zh-CN': '新程序生成需求:',
              es: 'Solicitud de generación de programa:',
              hi: 'नया प्रोग्राम जनरेशन अनुरोध:',
              ar: 'طلب إنشاء برنامج جديد:',
              pt: 'Solicitação de geração de programa:',
              bn: 'নতুন প্রোগ্রাম জেনারেশন অনুরোধ:',
              ru: 'Запрос на генерацию программы:',
              fr: 'Demande de génération de programme:',
              id: 'Permintaan pembuatan program baru:'
            })} ${naturalLanguagePrompt}`,
            blocks: [] // Don't send existing blocks to avoid confusion
          },
          lang: currentLanguage,
          timestamp: Date.now() // Add timestamp to prevent caching
        })
      });

      console.log('[Natural Language] 📡 Response status:', response.status);
      const data = await response.json();
      console.log('[Natural Language] 📄 Response data:', data);
      
      if (data.advice) {
        setGeneratedCode(data.advice);
      } else {
        setGeneratedCode(getText({
          en: 'Code generation failed',
          'zh-TW': '代碼生成失敗',
          'zh-CN': '代码生成失败',
          es: 'Falló la generación de código',
          hi: 'कोड जनरेशन विफल',
          ar: 'فشل إنشاء الكود',
          pt: 'Falha na geração de código',
          bn: 'কোড জেনারেশন ব্যর্থ',
          ru: 'Ошибка генерации кода',
          fr: 'Échec de la génération de code',
          id: 'Pembuatan kode gagal'
        }));
      }
    } catch (error) {
      console.error('[Natural Language] Error:', error);
      setGeneratedCode(getText({
        en: 'Code generation failed',
        'zh-TW': '代碼生成失敗',
        'zh-CN': '代码生成失败',
        es: 'Falló la generación de código',
        hi: 'कोड जनरेशन विफल',
        ar: 'فشل إنشاء الكود',
        pt: 'Falha na geração de código',
        bn: 'কোড জেনারেশন ব্যর্থ',
        ru: 'Ошибка генерации кода',
        fr: 'Échec de la génération de code',
        id: 'Pembuatan kode gagal'
      }));
    } finally {
      setIsGeneratingCode(false);
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
      const currentLanguage = getApiLanguage();
      const currentPrompt = getAIPrompts().chatConversation(userMessage, newHistory.slice(-4), blockData, aiSummary);
      
      console.log('[Chat] 🌍 Current language:', selectedLanguage);
      console.log('[Chat] 🔤 API language:', currentLanguage);
      console.log('[Chat] 📝 Prompt being sent:', currentPrompt);
      
      // Use the SAME proven working backend as "Ask AI" 
      const response = await fetch('https://rcwulqsdbrptrrtkluhh.supabase.co/functions/v1/llm-advice', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJjd3VscXNkYnJwdHJydGtsdWhoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM2NjM4NzEsImV4cCI6MjA2OTIzOTg3MX0.ajT317ynsqT0OWwOXroU0GggATbebIRcC5F5nAxVTMg'
        },
        body: JSON.stringify({
          code: {
            summary: currentPrompt,
            pickedSymptom: "chatbot-conversation", 
            blockText: blockData.map(b => `${b.category}: ${b.text}`).join(' | '),
            blocks: blockData
          },
          lang: currentLanguage,
          timestamp: Date.now() // Add timestamp to prevent caching
        })
      });

      console.log('[Chat] 📡 Response status:', response.status);
      const data = await response.json();
      console.log('[Chat] 📄 Response data:', data);
      
      if (data.advice) {
        setChatHistory([...newHistory, { role: 'assistant', content: data.advice }]);
      } else {
        setChatHistory([...newHistory, { role: 'assistant', content: getText({
          en: 'Sorry, I cannot respond to your question. Please try again.',
          'zh-TW': '抱歉，我無法回應你的問題。請再試一次。',
          'zh-CN': '抱歉，我无法回应你的问题。请再试一次。',
          es: 'Lo siento, no puedo responder a tu pregunta. Por favor, inténtalo de nuevo.',
          hi: 'क्षमा करें, मैं आपके प्रश्न का उत्तर नहीं दे सकता। कृपया पुनः प्रयास करें।',
          ar: 'عذراً، لا أستطيع الرد على سؤالك. يرجى المحاولة مرة أخرى.',
          pt: 'Desculpe, não posso responder à sua pergunta. Por favor, tente novamente.',
          bn: 'দুঃখিত, আমি আপনার প্রশ্নের উত্তর দিতে পারি না। অনুগ্রহ করে আবার চেষ্টা করুন।',
          ru: 'Извините, я не могу ответить на ваш вопрос. Пожалуйста, попробуйте еще раз.',
          fr: 'Désolé, je ne peux pas répondre à votre question. Veuillez réessayer.',
          id: 'Maaf, saya tidak dapat menjawab pertanyaan Anda. Silakan coba lagi.'
        })}]);
      }
    } catch (error) {
      console.error('[Chatbot] Error:', error);
      setChatHistory([...newHistory, { role: 'assistant', content: getText({
        en: 'Connection failed, please check your internet connection.',
        'zh-TW': '連接失敗，請檢查網路連線。',
        'zh-CN': '连接失败，请检查网络连接。',
        es: 'Conexión fallida, por favor verifica tu conexión a internet.',
        hi: 'कनेक्शन विफल, कृपया अपना इंटरनेट कनेक्शन जांचें।',
        ar: 'فشل الاتصال، يرجى التحقق من اتصال الإنترنت الخاص بك.',
        pt: 'Falha na conexão, verifique sua conexão com a internet.',
        bn: 'সংযোগ ব্যর্থ, অনুগ্রহ করে আপনার ইন্টারনেট সংযোগ পরীক্ষা করুন।',
        ru: 'Ошибка подключения, проверьте подключение к интернету.',
        fr: 'Échec de la connexion, veuillez vérifier votre connexion Internet.',
        id: 'Koneksi gagal, silakan periksa koneksi internet Anda.'
      })}]);
    } finally {
      setIsChatLoading(false);
    }
  };





  // Listen for workspace changes from content script
  useEffect(() => {
    const handleWorkspaceChanges = (message: any, _sender: any, _sendResponse: any) => {
      if (message.type === 'WORKSPACE_CHANGED') {
        console.log('[AI Features] 📝 Workspace changed, updating blocks and suggestions');
        
        // Update block data
        setBlockData(message.blocks || []);
        

        
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

    if (val && val in errorAdviceMap) {
      const adv = errorAdviceMap[val as keyof typeof errorAdviceMap];
      const lang = selectedLanguage === 'zh-TW' ? 'zh' : 'en';
      
      setOutput(
        `🌟 ${adv[lang]}\n\n` +
        `❓ ${getText({
          en: 'What Went Wrong:',
          'zh-TW': '發生了什麼？'
        })}\n` +
        `${adv.whatWentWrong[lang]}\n\n` +
        `🔧 ${getText({
          en: 'How to Fix:',
          'zh-TW': '解決方法：'
        })}\n` +
        `${adv.howToFix[lang]}\n\n` +
        `✅ ${getText({
          en: 'What to Expect / Next Steps:',
          'zh-TW': '然後呢？'
        })}\n` +
        `${adv.whatToExpect[lang]}`
      );
    } else {
      setOutput('');
    }
  }





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
            🧩 {getText({
              en: 'Detected Blocks',
              'zh-TW': '檢測到的積木設定 (Detected Blocks)'
            })} ({workspaceBlocks.length})
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
              🤖 {getText({
                en: 'AI Program Summary',
                'zh-TW': 'AI 程式摘要 (AI Program Summary)'
              })}:
            </div>
            <div>{aiSummary || getText({
              en: 'Generating summary...',
              'zh-TW': '正在生成摘要... (Generating summary...)'
            })}</div>
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
    <div style={{ 
      width: 480, 
      padding: 20, 
      fontFamily: "'Inter', 'Nunito', system-ui, -apple-system, sans-serif",
      background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
      minHeight: '100vh',
      boxSizing: 'border-box',
      borderRadius: '16px',
      overflow: 'hidden'
    }}>
      {/* CSS Variables for consistent theming */}
      <style>{`
        :root {
          --primary-color: #667eea;
          --primary-light: #a5b4fc;
          --primary-dark: #4f46e5;
          --secondary-color: #10b981;
          --accent-color: #f59e0b;
          --text-primary: #1e293b;
          --text-secondary: #64748b;
          --text-muted: #94a3b8;
          --bg-primary: #ffffff;
          --bg-secondary: #f8fafc;
          --bg-accent: #fef3c7;
          --border-color: #e2e8f0;
          --border-radius: 12px;
          --border-radius-sm: 8px;
          --shadow-sm: 0 1px 3px rgba(0,0,0,0.1);
          --shadow-md: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06);
          --shadow-lg: 0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05);
          --shadow-xl: 0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04);
          --spacing-xs: 4px;
          --spacing-sm: 8px;
          --spacing-md: 16px;
          --spacing-lg: 24px;
          --spacing-xl: 32px;
          --transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }
        
        .modern-card {
          background: var(--bg-primary);
          border-radius: var(--border-radius);
          box-shadow: var(--shadow-md);
          border: 1px solid var(--border-color);
          transition: var(--transition);
        }
        
        .modern-card:hover {
          box-shadow: var(--shadow-lg);
          transform: translateY(-1px);
        }
        
        .modern-button {
          background: linear-gradient(135deg, var(--primary-color) 0%, var(--primary-dark) 100%);
          color: white;
          border: none;
          border-radius: var(--border-radius-sm);
          padding: 10px 16px;
          font-weight: 600;
          font-size: 14px;
          cursor: pointer;
          transition: var(--transition);
          box-shadow: var(--shadow-sm);
        }
        
        .modern-button:hover {
          transform: translateY(-1px);
          box-shadow: var(--shadow-md);
        }
        
        .modern-button:active {
          transform: translateY(0);
        }
        
        .modern-button.secondary {
          background: linear-gradient(135deg, var(--secondary-color) 0%, #059669 100%);
        }
        
        .modern-button.accent {
          background: linear-gradient(135deg, var(--accent-color) 0%, #d97706 100%);
        }
        
        .pill-tab {
          background: var(--bg-secondary);
          color: var(--text-secondary);
          border: 2px solid var(--border-color);
          border-radius: 50px;
          padding: 8px 16px;
          font-weight: 500;
          cursor: pointer;
          transition: var(--transition);
          display: flex;
          align-items: center;
          gap: 6px;
        }
        
        .pill-tab:hover {
          background: var(--primary-light);
          color: white;
          border-color: var(--primary-color);
          transform: translateY(-1px);
        }
        
        .pill-tab.active {
          background: linear-gradient(135deg, var(--primary-color) 0%, var(--primary-dark) 100%);
          color: white;
          border-color: var(--primary-color);
          box-shadow: var(--shadow-md);
        }
        
        .section-title {
          font-size: 18px;
          font-weight: 700;
          color: var(--text-primary);
          margin: 0 0 var(--spacing-md) 0;
          display: flex;
          align-items: center;
          gap: var(--spacing-sm);
        }
        
        .section-subtitle {
          font-size: 14px;
          color: var(--text-secondary);
          margin: var(--spacing-xs) 0 var(--spacing-md) 0;
          line-height: 1.5;
        }
        
        .smooth-collapse {
          transition: var(--transition);
          overflow: hidden;
        }
        
        .fade-in {
          animation: fadeIn 0.3s ease-in-out;
        }
        
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        .bounce-in {
          animation: bounceIn 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55);
        }
        
        @keyframes bounceIn {
          0% { transform: scale(0.3); opacity: 0; }
          50% { transform: scale(1.05); }
          70% { transform: scale(0.9); }
          100% { transform: scale(1); opacity: 1; }
        }
        
        .loading-pulse {
          animation: pulse 1.5s ease-in-out infinite;
        }
        
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        
        .slide-in {
          animation: slideIn 0.3s ease-out;
        }
        
        @keyframes slideIn {
          from { transform: translateY(-10px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        
        .scale-in {
          animation: scaleIn 0.2s ease-out;
        }
        
        @keyframes scaleIn {
          from { transform: scale(0.95); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
      `}</style>
      {/* Sticky Mode Notification */}
      {stickyMode && (
        <div style={{
          position: 'absolute',
          top: '4px',
          left: '16px',
          right: '16px',
          background: 'rgba(255, 193, 7, 0.1)',
          border: '1px solid rgba(255, 193, 7, 0.5)',
          borderRadius: '6px',
          padding: '6px 8px',
          fontSize: '10px',
          color: '#856404',
          textAlign: 'center',
          fontWeight: '500',
          zIndex: 1000
        }}>
          💡 {getText({
            en: 'Sticky Mode: Right-click this popup → "Inspect" to keep it open permanently!',
            'zh-TW': '置頂模式：右鍵點擊此彈窗 → "檢查" 來永久保持開啟！'
          })}
        </div>
      )}
      
      {/* Close Button (only in sticky mode) */}
      {stickyMode && (
        <button
          onClick={() => setStickyMode(false)}
          style={{
            position: 'absolute',
            top: stickyMode ? '25px' : '8px',
            right: '8px',
            background: 'rgba(220, 53, 69, 0.9)',
            border: 'none',
            borderRadius: '50%',
            color: 'white',
            width: '20px',
            height: '20px',
            fontSize: '12px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1001,
            fontWeight: 'bold'
          }}
          title="Close Sticky Mode"
        >
          ×
        </button>
      )}
      {/* Header with Pin Button */}
      <div style={{ 
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)", 
        color: "white", 
        padding: "20px 24px", 
        borderRadius: "16px 16px 0 0", 
        margin: stickyMode ? "20px -20px 24px -20px" : "-20px -20px 24px -20px",
        position: "relative",
        boxShadow: "var(--shadow-xl)",
        borderBottom: "3px solid rgba(255,255,255,0.1)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        flexWrap: "wrap",
        gap: "12px"
      }}>
        <div style={{ flex: "1", minWidth: "0" }}>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: '-0.5px', lineHeight: '1.2' }}>
            {getText({
              en: '🤖 RoboCoach: SPIKE Prime AI Assistant',
              'zh-TW': '🤖 RoboCoach: SPIKE Prime AI 助手'
            })}
          </h2>
          <p style={{ margin: "8px 0 0 0", fontSize: 14, opacity: 0.95, fontWeight: 400, lineHeight: '1.3' }}>
            {getText({
              en: 'LEGO SPIKE Prime AI Programming Assistant',
                              'zh-TW': 'LEGO SPIKE Prime AI 編程助手'
            })}
          </p>
        </div>
        
        <div style={{
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          alignItems: "flex-end",
          flexShrink: 0
        }}>
          {/* Sticky Mode & Pin Buttons */}
          <div style={{
            display: "flex",
            gap: "8px"
          }}>
            {/* Sticky Mode Button */}
            <button
              onClick={toggleStickyMode}
              style={{
                background: stickyMode ? "rgba(16, 185, 129, 0.9)" : "rgba(255,255,255,0.15)",
                border: "2px solid rgba(255,255,255,0.3)",
                borderRadius: "8px",
                color: "white",
                padding: "6px 12px",
                fontSize: "12px",
                cursor: "pointer",
                fontWeight: "600",
                transition: "all 0.2s ease",
                backdropFilter: "blur(10px)"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }}
              title={stickyMode ? "Exit Sticky Mode" : "Show instructions to keep popup open"}
            >
              {stickyMode ? "📍 Sticky" : "📍 Stick"}
            </button>


          </div>
          
          {/* Language Dropdown */}
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <select
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value as 'en' | 'zh-TW')}
              style={{
                background: 'var(--bg-primary)',
                border: '2px solid var(--border-color)',
                borderRadius: 'var(--border-radius-sm)',
                padding: '8px 12px',
                fontSize: '12px',
                fontWeight: '600',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                transition: 'var(--transition)',
                boxShadow: 'var(--shadow-sm)',
                minWidth: '140px'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = 'var(--primary-color)';
                e.target.style.boxShadow = 'var(--shadow-md)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = 'var(--border-color)';
                e.target.style.boxShadow = 'var(--shadow-sm)';
              }}
            >
              <option value="en">🇺🇸 English</option>
              <option value="zh-TW">🇹🇼 繁體中文</option>
            </select>
          </div>
        </div>
      </div>

      {/* AI Assistant Panel - TOP SECTION */}
      <main className="modern-card" style={{ 
        marginBottom: 24, 
        padding: 24,
        border: "3px solid var(--primary-color)",
        boxShadow: "var(--shadow-xl)",
        position: "relative",
        overflow: "hidden"
      }}>
        {/* Elevated effect background */}
        <div style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "4px",
          background: "linear-gradient(90deg, var(--primary-color) 0%, var(--primary-light) 50%, var(--primary-color) 100%)",
          borderRadius: "var(--border-radius) var(--border-radius) 0 0"
        }} />
        
        <h3 className="section-title" style={{ color: "var(--primary-color)", fontSize: "20px" }}>
          {getText({
            en: '🤖 AI Assistant',
            'zh-TW': '🤖 AI 助手'
          })}
        </h3>
        
        {/* AI Feature Tabs */}
        <div style={{ display: "flex", gap: "12px", marginBottom: "24px", flexWrap: "wrap" }}>
          <button
            onClick={() => setActiveAITab(activeAITab === 'chat' ? null : 'chat')}
            className={`pill-tab ${activeAITab === 'chat' ? 'active' : ''}`}
            style={{
              flex: '1',
              minWidth: '120px',
              justifyContent: 'center'
            }}
          >
            💬 {getText({
              en: 'AI Chat',
              'zh-TW': 'AI 聊天 / AI Chat',
              'zh-CN': 'AI 聊天 / AI Chat',
              es: 'Chat IA / AI Chat',
              hi: 'AI चैट / AI Chat',
              ar: 'دردشة الذكاء الاصطناعي / AI Chat',
              pt: 'Chat IA / AI Chat',
              bn: 'AI চ্যাট / AI Chat',
              ru: 'ИИ Чат / AI Chat',
              fr: 'Chat IA / AI Chat',
              id: 'Chat AI / AI Chat'
            })}
          </button>
          <button
            onClick={() => setActiveAITab(activeAITab === 'natural' ? null : 'natural')}
            className={`pill-tab ${activeAITab === 'natural' ? 'active' : ''}`}
            style={{
              flex: '1',
              minWidth: '120px',
              justifyContent: 'center'
            }}
          >
            🧩 {getText({
              en: 'Code Generator',
              'zh-TW': '程式編程 / Code Generation'
            })}
          </button>
        </div>

        {/* AI Chat Interface */}
        {activeAITab === 'chat' && (
          <div style={{ 
            background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)', 
            border: '2px solid #f59e0b', 
            borderRadius: '16px', 
            padding: '20px',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
          }}>
            <div style={{
              background: 'white',
              border: '2px solid #e5e7eb',
              borderRadius: '12px',
              height: '220px',
              overflowY: 'auto',
              padding: '16px',
              marginBottom: '16px',
              boxShadow: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)'
            }}>
              {chatHistory.length === 0 ? (
                <div style={{ 
                  color: '#4a5568', 
                  fontSize: '16px', 
                  textAlign: 'center', 
                  padding: '40px 20px',
                  fontWeight: '500',
                  lineHeight: '1.6',
                  background: 'linear-gradient(135deg, #f7fafc 0%, #edf2f7 100%)',
                  borderRadius: '12px',
                  border: '2px dashed #cbd5e0',
                  margin: '10px 0'
                }}>
                  <div style={{ fontSize: '24px', marginBottom: '12px' }}>🤖</div>
                  <div style={{ marginBottom: '8px' }}>
                    {getText({
                      en: 'Ask me any questions about SPIKE Prime programming!',
                      'zh-TW': '問我任何關於SPIKE Prime編程的問題！'
                    })}
                  </div>
                  <div style={{ fontSize: '13px', color: '#718096', fontWeight: '400' }}>
                    {getText({
                      en: 'I can help with debugging, code generation, and programming concepts',
                      'zh-TW': '我可以幫助除錯、代碼生成和編程概念'
                    })}
                  </div>
                </div>
              ) : (
                chatHistory.map((msg, index) => (
                  <div key={index} style={{
                    marginBottom: '12px',
                    padding: '12px',
                    borderRadius: '12px',
                    background: msg.role === 'user' 
                      ? 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)' 
                      : 'linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)',
                    fontSize: '14px',
                    border: msg.role === 'user' 
                      ? '1px solid #93c5fd' 
                      : '1px solid #d1d5db',
                    boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
                    position: 'relative'
                  }}>
                    <div style={{ 
                      fontWeight: '600', 
                      marginBottom: '6px',
                      color: msg.role === 'user' ? '#1e40af' : '#374151',
                      fontSize: '12px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>
                      {msg.role === 'user' ? getText({
                        en: 'You',
                        'zh-TW': '你'
                      }) : getText({
                        en: 'AI Assistant',
                        'zh-TW': 'AI 助手'
                      })}
                    </div>
                    <div style={{ 
                      lineHeight: '1.5',
                      color: msg.role === 'user' ? '#1e3a8a' : '#1f2937'
                    }}>
                      {msg.content}
                    </div>
                  </div>
                ))
              )}
              {isChatLoading && (
                <div className="loading-pulse" style={{ 
                  color: '#6b7280', 
                  fontSize: '14px', 
                  fontStyle: 'italic',
                  padding: '16px',
                  background: 'linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%)',
                  borderRadius: '12px',
                  border: '2px dashed #d1d5db',
                  margin: '12px 0',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)'
                }}>
                  <span style={{ fontSize: '18px' }}>🤔</span>
                  <span style={{ fontWeight: '500' }}>
                    {getText({
                      en: 'AI is thinking...',
                      'zh-TW': 'AI 正在思考中...'
                    })}
                  </span>
                </div>
              )}
            </div>
            
            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
              <textarea
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && sendChatMessage()}
                placeholder={getText({
                  en: "Ask a question, e.g., Why won't my robot turn?",
                  'zh-TW': "問問題，例如：為什麼我的機器人不會轉彎？"
                })}
                style={{
                  flex: 1,
                  padding: '14px 16px',
                  border: '2px solid #e5e7eb',
                  borderRadius: '12px',
                  fontSize: '14px',
                  minHeight: '60px',
                  maxHeight: '120px',
                  resize: 'vertical',
                  fontFamily: 'inherit',
                  lineHeight: '1.5',
                  boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
                  transition: 'all 0.2s ease',
                  outline: 'none'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#3b82f6';
                  e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#e5e7eb';
                  e.target.style.boxShadow = '0 1px 3px 0 rgba(0, 0, 0, 0.1)';
                }}
              />
              <button
                onClick={sendChatMessage}
                disabled={!chatInput.trim() || isChatLoading}
                style={{
                  background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '12px',
                  padding: '14px 20px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  opacity: (!chatInput.trim() || isChatLoading) ? 0.6 : 1,
                  transition: 'all 0.2s ease',
                  boxShadow: '0 2px 4px 0 rgba(0, 0, 0, 0.1)',
                  minWidth: '80px'
                }}
                onMouseEnter={(e) => {
                  if (chatInput.trim() && !isChatLoading) {
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = '0 4px 8px 0 rgba(0, 0, 0, 0.15)';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 2px 4px 0 rgba(0, 0, 0, 0.1)';
                }}
              >
                {isChatLoading ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span className="loading-pulse">⏳</span>
                    {getText({
                      en: 'Sending...',
                      'zh-TW': '發送中...'
                    })}
                  </span>
                ) : (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    📤 {getText({
                      en: 'Send',
                      'zh-TW': '發送'
                    })}
                  </span>
                )}
              </button>
            </div>
          </div>
        )}



        {/* Natural Language to Code Interface */}
        {activeAITab === 'natural' && (
          <div style={{ 
            background: '#f0f8ff', 
            border: '1px solid #b3d9ff', 
            borderRadius: '8px', 
            padding: '20px',
            textAlign: 'center'
          }}>
            <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#666', textAlign: 'center', lineHeight: '1.5' }}>
              {getText({
            en: 'Describe the robot behavior you want in natural language, and AI will generate the corresponding block code for you. For "move until condition then stop" patterns, the AI will create proper loop structures.',
            'zh-TW': '用自然語言描述你想要的機器人行為，AI 會為你生成對應的積木代碼。對於「移動直到條件然後停止」的模式，AI 會創建適當的迴圈結構。 / Describe the robot behavior you want in natural language, and AI will generate the corresponding block code for you.',
            'zh-CN': '用自然语言描述你想要的机器人行为，AI 会为你生成对应的积木代码。对于「移动直到条件然后停止」的模式，AI 会创建适当的循环结构。 / Describe the robot behavior you want in natural language, and AI will generate the corresponding block code for you.',
            es: 'Describe el comportamiento del robot que deseas en lenguaje natural, y la IA generará el código de bloques correspondiente para ti. Para patrones de "mover hasta condición luego parar", la IA creará estructuras de bucle apropiadas. / Describe the robot behavior you want in natural language, and AI will generate the corresponding block code for you.',
            hi: 'प्राकृतिक भाषा में वांछित रोबोट व्यवहार का वर्णन करें, और AI आपके लिए संबंधित ब्लॉक कोड बनाएगा। "शर्त तक चलें फिर रुकें" पैटर्न के लिए, AI उचित लूप संरचनाएं बनाएगा। / Describe the robot behavior you want in natural language, and AI will generate the corresponding block code for you.',
            ar: 'صف سلوك الروبوت المطلوب باللغة الطبيعية، وسيولد الذكاء الاصطناعي كود الكتل المقابل لك. لأنماط "التحرك حتى الشرط ثم التوقف"، سينشئ الذكاء الاصطناعي هياكل حلقة مناسبة. / Describe the robot behavior you want in natural language, and AI will generate the corresponding block code for you.',
            pt: 'Descreva o comportamento do robô que você quer em linguagem natural, e a IA gerará o código de blocos correspondente para você. Para padrões de "mover até condição então parar", a IA criará estruturas de loop apropriadas. / Describe the robot behavior you want in natural language, and AI will generate the corresponding block code for you.',
            bn: 'প্রাকৃতিক ভাষায় আপনার পছন্দের রোবট আচরণ বর্ণনা করুন, এবং AI আপনার জন্য সংশ্লিষ্ট ব্লক কোড তৈরি করবে। "শর্ত পর্যন্ত চলুন তারপর থামুন" প্যাটার্নের জন্য, AI উপযুক্ত লুপ কাঠামো তৈরি করবে। / Describe the robot behavior you want in natural language, and AI will generate the corresponding block code for you.',
            ru: 'Опишите желаемое поведение робота на естественном языке, и ИИ сгенерирует соответствующий блочный код для вас. Для паттернов "двигаться до условия затем остановиться" ИИ создаст соответствующие структуры циклов. / Describe the robot behavior you want in natural language, and AI will generate the corresponding block code for you.',
            fr: 'Décrivez le comportement du robot souhaité en langage naturel, et l\'IA générera le code de blocs correspondant pour vous. Pour les modèles "se déplacer jusqu\'à condition puis arrêter", l\'IA créera des structures de boucle appropriées. / Describe the robot behavior you want in natural language, and AI will generate the corresponding block code for you.',
            id: 'Deskripsikan perilaku robot yang Anda inginkan dalam bahasa alami, dan AI akan menghasilkan kode blok yang sesuai untuk Anda. Untuk pola "bergerak sampai kondisi lalu berhenti", AI akan membuat struktur loop yang tepat. / Describe the robot behavior you want in natural language, and AI will generate the corresponding block code for you.'
          })}
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
              <textarea
                value={naturalLanguagePrompt}
                onChange={(e) => setNaturalLanguagePrompt(e.target.value)}
                placeholder={getText({
                  en: "Example: Drive forward until color sensor detects red, then stop...",
                  'zh-TW': "例如：讓機器人前進直到顏色感應器檢測到紅色，然後停止...",
                  'zh-CN': "例如：让机器人前进直到颜色传感器检测到红色，然后停止...",
                  es: "Ejemplo: Conducir hacia adelante hasta que el sensor de color detecte rojo, luego parar...",
                  hi: "उदाहरण: आगे चलें जब तक कि रंग सेंसर लाल का पता न लगाए, फिर रुकें...",
                  ar: "مثال: قم بالقيادة للأمام حتى يكتشف مستشعر اللون اللون الأحمر، ثم توقف...",
                  pt: "Exemplo: Dirigir para frente até que o sensor de cor detecte vermelho, depois parar...",
                  bn: "উদাহরণ: সামনে চালান যতক্ষণ না রঙ সেন্সর লাল সনাক্ত করে, তারপর থামুন...",
                  ru: "Пример: Двигаться вперед, пока датчик цвета не обнаружит красный, затем остановиться...",
                  fr: "Exemple: Avancer jusqu'à ce que le capteur de couleur détecte le rouge, puis s'arrêter...",
                  id: "Contoh: Maju sampai sensor warna mendeteksi merah, lalu berhenti..."
                })}
                style={{
                  width: '90%',
                  maxWidth: '400px',
                  height: '60px',
                  padding: '12px',
                  border: '2px solid #ddd',
                  borderRadius: '8px',
                  fontSize: '13px',
                  resize: 'vertical',
                  fontFamily: 'inherit',
                  textAlign: 'center'
                }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <button
                onClick={generateCodeFromPrompt}
                disabled={!naturalLanguagePrompt.trim() || isGeneratingCode}
                style={{
                  background: '#007bff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '10px 20px',
                  fontSize: '13px',
                  cursor: 'pointer',
                  fontWeight: '600',
                  opacity: (!naturalLanguagePrompt.trim() || isGeneratingCode) ? 0.6 : 1,
                  transition: 'all 0.2s ease',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                }}
              >
                {isGeneratingCode ? getText({
                  en: 'Generating...',
                  'zh-TW': '生成中...',
                  'zh-CN': '生成中...',
                  es: 'Generando...',
                  hi: 'बन रहा है...',
                  ar: 'يتم التوليد...',
                  pt: 'Gerando...',
                  bn: 'তৈরি হচ্ছে...',
                  ru: 'Генерация...',
                  fr: 'Génération...',
                  id: 'Menghasilkan...'
                }) : getText({
                  en: 'Generate Block Code',
                  'zh-TW': '生成積木代碼',
                  'zh-CN': '生成积木代码',
                  es: 'Generar Código de Bloques',
                  hi: 'ब्लॉक कोड बनाएं',
                  ar: 'إنشاء كود الكتل',
                  pt: 'Gerar Código de Blocos',
                  bn: 'ব্লক কোড তৈরি করুন',
                  ru: 'Сгенерировать Блочный Код',
                  fr: 'Générer le Code de Blocs',
                  id: 'Hasilkan Kode Blok'
                })}
              </button>
            </div>
            {generatedCode && (
              <div style={{
                background: 'white',
                border: '2px solid #ddd',
                borderRadius: '8px',
                padding: '20px',
                marginTop: '16px',
                fontSize: '13px',
                whiteSpace: 'pre-wrap',
                textAlign: 'left',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                maxWidth: '90%',
                margin: '16px auto 0 auto',
                lineHeight: '1.6'
              }}>
                {generatedCode
                  .split('\n').map((line, index) => {
                    // Process markdown formatting
                    const processedLine = line
                      .replace(/\*\*(.*?)\*\*/g, (_, text) => text) // Remove ** ** but keep the text
                      .replace(/\*\*\*/g, ''); // Remove any remaining ***
                    
                    // Make section headers bold
                    if (processedLine.includes('Program Goal') || 
                        processedLine.includes('Complete Block Sequence') || 
                        processedLine.includes('Recommended Settings') || 
                        processedLine.includes('Usage Instructions') ||
                        processedLine.includes('程序目標') ||
                        processedLine.includes('完整積木序列') ||
                        processedLine.includes('推薦設定') ||
                        processedLine.includes('使用說明')) {
                      return (
                        <div key={index} style={{
                          fontWeight: 'bold',
                          fontSize: '14px',
                          color: 'var(--primary-color)',
                          marginTop: index > 0 ? '16px' : '0',
                          marginBottom: '8px',
                          borderBottom: '2px solid var(--border-color)',
                          paddingBottom: '4px'
                        }}>
                          {processedLine}
                        </div>
                      );
                    }
                    // Make numbered items stand out
                    else if (processedLine.match(/^\d+\./)) {
                      return (
                        <div key={index} style={{
                          fontWeight: '600',
                          color: 'var(--text-primary)',
                          marginLeft: '16px',
                          marginBottom: '4px'
                        }}>
                          {processedLine}
                        </div>
                      );
                    }
                    // Regular text
                    else {
                      return (
                        <div key={index} style={{
                          color: 'var(--text-secondary)',
                          marginBottom: '4px'
                        }}>
                          {processedLine}
                        </div>
                      );
                    }
                  })}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Quick Issue Troubleshooting - MIDDLE SECTION */}
      <section className="modern-card" style={{ marginBottom: 24, padding: 20 }}>
        <h3 className="section-title">
          📋 {getText({
            en: 'Quick Troubleshooting',
            'zh-TW': '快速故障排除 / Quick Troubleshooting',
            'zh-CN': '快速故障排除 / Quick Troubleshooting',
            es: 'Solución Rápida de Problemas / Quick Troubleshooting',
            hi: 'त्वरित समस्या निवारण / Quick Troubleshooting',
            ar: 'استكشاف سريع للأخطاء / Quick Troubleshooting',
            pt: 'Solução Rápida de Problemas / Quick Troubleshooting',
            bn: 'দ্রুত সমস্যা সমাধান / Quick Troubleshooting',
            ru: 'Быстрое Устранение Неполадок / Quick Troubleshooting',
            fr: 'Dépannage Rapide / Quick Troubleshooting',
            id: 'Troubleshooting Cepat / Quick Troubleshooting'
          })}
        </h3>

        {/* Quick Issue Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
          {dropdownOptions.slice(1).map(opt => (
            <button
              key={opt.key}
              onClick={() => {
                setSelectedError(opt.key as ErrorTypeKey);
                handleDropdownChange({ target: { value: opt.key } } as any);
              }}
              className={`modern-button ${selectedError === opt.key ? 'active' : 'secondary'}`}
              style={{
                background: selectedError === opt.key ? 'var(--primary-color)' : 'var(--bg-secondary)',
                color: selectedError === opt.key ? 'white' : 'var(--text-primary)',
                border: `2px solid ${selectedError === opt.key ? 'var(--primary-color)' : 'var(--border-color)'}`,
                borderRadius: 'var(--border-radius-sm)',
                padding: '12px 8px',
                fontSize: '12px',
                cursor: 'pointer',
                textAlign: 'center',
                fontWeight: '600',
                transition: 'var(--transition)',
                minHeight: '44px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              {getBilingualLabel(opt.key, selectedLanguage)}
            </button>
          ))}
        </div>
      </section>

      {/* Troubleshooting Advice Display */}
      {output && selectedError && (
        <section className="modern-card" style={{
          background: "linear-gradient(135deg, var(--bg-primary) 0%, var(--bg-secondary) 100%)",
          border: "2px solid var(--secondary-color)",
          borderRadius: "var(--border-radius)",
          padding: 20,
          marginBottom: 24,
          fontSize: 14,
          lineHeight: 1.6,
          boxShadow: "var(--shadow-lg)"
        }}>
          <h3 className="section-title" style={{ color: "var(--secondary-color)", fontSize: "18px" }}>
            💡 {getText({
              en: 'Troubleshooting Guide',
              'zh-TW': '故障排除指南 / Troubleshooting Guide',
              'zh-CN': '故障排除指南 / Troubleshooting Guide',
              es: 'Guía de Solución de Problemas / Troubleshooting Guide',
              hi: 'समस्या निवारण गाइड / Troubleshooting Guide',
              ar: 'دليل استكشاف الأخطاء / Troubleshooting Guide',
              pt: 'Guia de Solução de Problemas / Troubleshooting Guide',
              bn: 'সমস্যা সমাধান গাইড / Troubleshooting Guide',
              ru: 'Руководство по Устранению Неполадок / Troubleshooting Guide',
              fr: 'Guide de Dépannage / Troubleshooting Guide',
              id: 'Panduan Troubleshooting / Troubleshooting Guide'
            })}
          </h3>
          <div style={{ 
            whiteSpace: "pre-wrap", 
            color: "var(--text-primary)",
            fontSize: "13px",
            lineHeight: "1.7"
          }}>{output}</div>
        </section>
      )}



      {/* Detected Blocks & Debug Info - COLLAPSIBLE SECTION */}
      <section className="modern-card" style={{ marginBottom: 24 }}>
        <button
          onClick={() => setIsDebugCollapsed(!isDebugCollapsed)}
          className="modern-button"
          style={{
            background: 'var(--bg-secondary)',
            border: '2px solid var(--border-color)',
            borderRadius: 'var(--border-radius-sm)',
            padding: '16px 20px',
            fontSize: '14px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            width: '100%',
            justifyContent: 'space-between',
            fontWeight: '600',
            color: 'var(--text-primary)',
            transition: 'var(--transition)',
            boxShadow: 'var(--shadow-sm)'
          }}
        >
          <span>
            {getText({
              en: '🔍 Debug Info & Detected Blocks',
              'zh-TW': '🔍 除錯資訊與偵測積木',
              'zh-CN': '🔍 调试信息与检测积木',
              es: '🔍 Info de Depuración y Bloques Detectados',
              hi: '🔍 डिबग जानकारी और खोजे गए ब्लॉक',
              ar: '🔍 معلومات التشخيص والكتل المكتشفة',
              pt: '🔍 Info de Depuração e Blocos Detectados',
              bn: '🔍 ডিবাগ তথ্য এবং খুঁজে পাওয়া ব্লক',
              ru: '🔍 Отладочная Информация и Обнаруженные Блоки',
              fr: '🔍 Info de Débogage et Blocs Détectés',
              id: '🔍 Info Debug & Blok Terdeteksi'
            })}
          </span>
          <span>{isDebugCollapsed ? '▼' : '▲'}</span>
        </button>
        
        {!isDebugCollapsed && (
          <div className="smooth-collapse fade-in" style={{ marginTop: '16px', padding: '0 16px' }}>
            {/* Debug Info */}
            {debugInfo && (
              <div className="modern-card" style={{
                background: "var(--bg-accent)",
                border: "2px solid var(--accent-color)",
                borderRadius: "var(--border-radius)",
                padding: 16,
                marginBottom: 16,
                fontSize: 13,
                color: "var(--text-primary)",
                lineHeight: 1.5,
                boxShadow: "var(--shadow-sm)",
                maxWidth: "calc(100% - 32px)",
                margin: "0 auto 16px auto"
              }}>
                <h3 className="section-title" style={{ color: "var(--accent-color)", fontSize: "16px" }}>
                  🔍 {getText({
                    en: 'Debug Information',
                    'zh-TW': '除錯資訊 / Debug Information',
                    'zh-CN': '调试信息 / Debug Information',
                    es: 'Información de Depuración / Debug Information',
                    hi: 'डिबग जानकारी / Debug Information',
                    ar: 'معلومات التشخيص / Debug Information',
                    pt: 'Informações de Depuração / Debug Information',
                    bn: 'ডিবাগ তথ্য / Debug Information',
                    ru: 'Отладочная Информация / Debug Information',
                    fr: 'Informations de Débogage / Debug Information',
                    id: 'Informasi Debug / Debug Information'
                  })}
                </h3>
                <div style={{ whiteSpace: "pre-wrap" }}>{debugInfo}</div>
              </div>
            )}

            {/* Block Summary */}
            <div style={{ padding: '0 8px' }}>
              {renderBlockSummary()}
            </div>
          </div>
        )}
      </section>

      {/* Footer */}
      <footer className="modern-card" style={{
        marginTop: '32px',
        padding: '24px',
        background: 'linear-gradient(135deg, var(--bg-primary) 0%, var(--bg-secondary) 100%)',
        borderRadius: 'var(--border-radius)',
        border: '2px solid var(--border-color)',
        textAlign: 'center',
        boxShadow: 'var(--shadow-lg)'
      }}>
        {/* RoboYouth Logo */}
        <div style={{
          marginBottom: '16px',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center'
        }}>
          <div style={{
            width: '48px',
            height: '48px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '50%',
            overflow: 'hidden',
            boxShadow: 'var(--shadow-md)',
            border: '2px solid var(--primary-light)'
          }}>
            <img 
              src="../../icons/robo48.png"
              alt="RoboYouth Logo" 
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain'
              }}
            />
          </div>
        </div>
        
        <div style={{ 
          fontSize: '16px', 
          fontWeight: '700', 
          color: 'var(--text-primary)',
          marginBottom: '12px',
          letterSpacing: '-0.5px'
        }}>
          RoboYouth Taiwan
        </div>
        <div style={{ 
          fontSize: '13px', 
          color: 'var(--text-secondary)',
          marginBottom: '8px',
          fontWeight: '500'
        }}>
          {getText({
            en: 'Created by Sophie Hsu',
            'zh-TW': '由 Sophie Hsu 創建',
            'zh-CN': '由 Sophie Hsu 创建',
            es: 'Creado por Sophie Hsu',
            hi: 'Sophie Hsu द्वारा बनाया गया',
            ar: 'أنشأته Sophie Hsu',
            pt: 'Criado por Sophie Hsu',
            bn: 'Sophie Hsu দ্বারা তৈরি',
            ru: 'Создано Sophie Hsu',
            fr: 'Créé par Sophie Hsu',
            id: 'Dibuat oleh Sophie Hsu'
          })}
        </div>
        <div style={{ 
          fontSize: '12px', 
          color: 'var(--text-muted)',
          marginBottom: '12px',
          fontWeight: '400'
        }}>
          {getText({
            en: 'Beta version 0.1',
            'zh-TW': '測試版本 0.1',
            'zh-CN': '测试版本 0.1',
            es: 'Versión Beta 0.1',
            hi: 'बीटा संस्करण 0.1',
            ar: 'الإصدار التجريبي 0.1',
            pt: 'Versão Beta 0.1',
            bn: 'বিটা সংস্করণ 0.1',
            ru: 'Бета версия 0.1',
            fr: 'Version Bêta 0.1',
            id: 'Versi Beta 0.1'
          })}
        </div>
        <div style={{ 
          fontSize: '12px', 
          color: 'var(--primary-color)',
          fontWeight: '600',
          padding: '8px 16px',
          background: 'var(--bg-secondary)',
          borderRadius: 'var(--border-radius-sm)',
          display: 'inline-block',
          border: '1px solid var(--border-color)'
        }}>
          {getText({
            en: 'Support: roboyouthtaiwan@gmail.com',
            'zh-TW': '支援：roboyouthtaiwan@gmail.com',
            'zh-CN': '支持：roboyouthtaiwan@gmail.com',
            es: 'Soporte: roboyouthtaiwan@gmail.com',
            hi: 'सहायता: roboyouthtaiwan@gmail.com',
            ar: 'الدعم: roboyouthtaiwan@gmail.com',
            pt: 'Suporte: roboyouthtaiwan@gmail.com',
            bn: 'সহায়তা: roboyouthtaiwan@gmail.com',
            ru: 'Поддержка: roboyouthtaiwan@gmail.com',
            fr: 'Support: roboyouthtaiwan@gmail.com',
            id: 'Dukungan: roboyouthtaiwan@gmail.com'
          })}
        </div>
      </footer>

      <style>{`
        .block-summary {
          background: var(--bg-primary);
          border: 2px solid var(--border-color);
          border-radius: var(--border-radius);
          padding: 20px;
          margin-bottom: 16px;
          box-shadow: var(--shadow-sm);
          transition: var(--transition);
          max-width: calc(100% - 16px);
          margin-left: auto;
          margin-right: auto;
        }
        
        .block-summary:hover {
          box-shadow: var(--shadow-md);
          transform: translateY(-1px);
        }
        
        .block-summary h3 {
          margin: 0 0 16px 0;
          color: var(--text-primary);
          font-size: 18px;
          font-weight: 700;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        
        .block-summary h4 {
          margin: 20px 0 12px 0;
          color: var(--text-primary);
          font-size: 16px;
          font-weight: 600;
          border-bottom: 2px solid var(--border-color);
          padding-bottom: 8px;
        }
        
        .block-summary p {
          margin: 8px 0;
          color: var(--text-secondary);
          font-size: 14px;
          line-height: 1.5;
        }
        
        .block-summary .block-item {
          background: var(--bg-secondary);
          border: 1px solid var(--border-color);
          border-radius: var(--border-radius-sm);
          padding: 12px;
          margin: 8px 0;
          font-size: 13px;
          color: var(--text-primary);
          transition: var(--transition);
        }
        
        .block-summary .block-item:hover {
          background: var(--primary-light);
          color: white;
          transform: translateX(4px);
        }
        
        .block-summary .refresh-clear {
          display: flex;
          gap: 12px;
          margin-top: 16px;
        }
        
        .block-summary .refresh-clear button {
          background: var(--primary-color);
          color: white;
          border: none;
          border-radius: var(--border-radius-sm);
          padding: 8px 16px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: var(--transition);
          box-shadow: var(--shadow-sm);
        }
        
        .block-summary .refresh-clear button:hover {
          background: var(--primary-dark);
          transform: translateY(-1px);
          box-shadow: var(--shadow-md);
        }
        
        .block-summary .refresh-clear button:active {
          transform: translateY(0);
        }
      `}</style>
    </div>
  );
}
