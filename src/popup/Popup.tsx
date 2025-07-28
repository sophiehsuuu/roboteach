import { useState, useEffect } from "react";
// For TypeScript: allow using chrome APIs in Extension context
declare const chrome: any;

const fontsBase = {
  fontFamily: `'Poppins', 'Noto Sans TC', 'Microsoft JhengHei', Arial, Helvetica, sans-serif`
};
const headingStyle = {
  ...fontsBase,
  color: "#2C3E50",
  fontWeight: 700,
  fontSize: 20,
  margin: "8px 0 2px 0",
  lineHeight: "1.2",
};
const subheadingStyle = {
  ...fontsBase,
  color: "#2C3E50",
  fontWeight: 500,
  fontSize: 15,
  marginBottom: 6,
  letterSpacing: 0.5,
};
const areaStyle = {
  background: "#F5F5F5",
  borderRadius: "10px",
  padding: "8px",
  border: "1px solid #E0E0E0",
  marginBottom: 8,
  fontSize: 14,
  color: "#2C3E50",
  width: "100%",
};
const primaryBtn = {
  background: "#4A90E2", color: "#fff", border: "none",
  padding: "9px 18px", borderRadius: 6, fontWeight: 600,
  fontFamily: "Poppins, Arial, sans-serif", cursor: "pointer",
  fontSize: 16, marginTop: 8, marginBottom: 5
};
const secondaryBtn = {
  ...primaryBtn,
  background: "#92BDE7", color: "#2C3E50"
};
const infoMsg = { color: "#FFD54F", fontWeight: 400, margin: "6px 0" };
const normalMsg = { color: "#2C3E50", fontWeight: 400, margin: "6px 0" };

// Dropdown options—add more symptoms as you wish
const errorAdviceMap: Record<string, { zh: string; en: string; zhTips: string; enTips: string }> = {
  "motor": {
    zh: "馬達未啟動",
    en: "Motor Not Moving",
    zhTips: "請檢查馬達積木是否已連接且已設定啟動動作。\n- 確認「馬達啟動」積木和對應馬達端口匹配。\n- 檢查馬達與主機的連接線是否接牢。\n- 嘗試更換電池或重新開機。",
    enTips: "Check if the motor blocks are connected and the motor is set to start.\n- Make sure the 'start motor' block matches the correct port.\n- Ensure all motor cables are firmly connected.\n- Try fresh batteries or restarting the hub.",
  },
  "direction": {
    zh: "機器人方向錯誤",
    en: "Robot Moving Wrong Direction",
    zhTips: "請檢查左右馬達是否設定正確。\n- 嘗試對調馬達端口或調換『順時針/逆時針』設定。\n- 看看是否有『方向』積木設錯。",
    enTips: "Check if left and right motors are set correctly.\n- Try swapping motor ports or changing 'clockwise/counterclockwise' in your blocks.\n- Review if 'direction' blocks are correct.",
  },
  "not-starting": {
    zh: "程式未開始",
    en: "Code Not Starting",
    zhTips: "請確認有『開始』積木且正確連接。\n- 試著按下執行/開始鍵。\n- 檢查是否有分岔或未連通的積木。",
    enTips: "Make sure you have a 'start' block properly connected.\n- Click the run/start button in SPIKE.\n- Check for any unconnected or orphaned blocks.",
  },
  "stop": {
    zh: "無法停止",
    en: "Can't Stop",
    zhTips: "請檢查是否有適當的『停止』積木。\n- 加入『停止所有馬達』積木在正確的位置。\n- 檢查循環積木是否可以跳出/結束。",
    enTips: "Check for the correct 'stop' blocks.\n- Add 'stop all motors' block in the right place.\n- Make sure any loops can be exited/stopped.",
  },
  "sensor": {
    zh: "感應器無反應",
    en: "Sensor Not Responding",
    zhTips: "請確認感應器已正確插入並選用對應的感應器積木。\n- 檢查程式中是否有讀取感應器的積木。\n- 嘗試換插孔或重新插拔感應器。",
    enTips: "Ensure the sensor is connected and the correct sensor block is used.\n- Check for any blocks reading the sensor value.\n- Try plugging the sensor into different ports.",
  },
  "other": {
    zh: "其他／未列出問題",
    en: "Other / Not Listed",
    zhTips: "請簡要描述你的問題，然後點選下方『AI協助』，讓AI老師為你提供個人化建議。",
    enTips: "Describe your problem briefly and use 'Ask AI' below for personalized help!",
  }
};

const dropdownOptions = [
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
  const [selectedError, setSelectedError] = useState('');
  const [codeSummary, setCodeSummary] = useState('');
  const [loading, setLoading] = useState(false);
  const [blockText, setBlockText] = useState("");

  // Listen for block updates from content script (for future use)
  useEffect(() => {
    function listener(msg: any) {
      if (msg.type === "SPIKE_BLOCK_UPDATE") {
        setBlockText(msg.payload);
      }
    }
    if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.onMessage) {
      chrome.runtime.onMessage.addListener(listener);
      return () => chrome.runtime.onMessage.removeListener(listener);
    }
  }, []);

  // When dropdown changes, show relevant built-in advice
  function handleDropdownChange(e: any) {
    const val = e.target.value;
    setSelectedError(val);
    setOutput(
      val && errorAdviceMap[val]
        ? `🌟 ${errorAdviceMap[val].zh}\n${errorAdviceMap[val].zhTips}\n\n—\n${errorAdviceMap[val].en}\n${errorAdviceMap[val].enTips}`
        : ""
    );
  }

  // LLM handler for open-ended AI help
  const handleAskAdvice = async () => {
    setOutput('取得協助中… Getting advice...');
    setLoading(true);
    const codeData = {
      summary: codeSummary,
      pickedSymptom: selectedError,
      blockText
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

  return (
    <div style={{
      ...fontsBase,
      width: 336, minHeight: 480, background: "#F5F5F5", borderRadius: 18,
      boxShadow: "0 4px 24px rgba(44,62,80,0.12)", padding: "18px 20px 10px 20px"
    }}>
      <div style={{ textAlign: "center", marginBottom: 8 }}>
        <img src="../../../icons/robo48.png" width={44} style={{ borderRadius: "50%" }} alt="Avatar" />
      </div>
      <div style={headingStyle}>歡迎來到 RoboYouth Taiwan!</div>
      <div style={subheadingStyle}>問題小助手 • Error Helper</div>

      <div style={{ ...fontsBase, color: "#2C3E50", fontSize: 13, margin: "14px 0 8px 0" }}>
        請選擇一項症狀或問題獲得建議：<br />Select the issue you are facing to get help.
      </div>
      <select
        style={{ ...areaStyle, fontWeight: 500, fontSize: 15 }}
        value={selectedError}
        onChange={handleDropdownChange}
      >
        {dropdownOptions.map(opt =>
          <option key={opt.key} value={opt.key}>{opt.label}</option>
        )}
      </select>
      <div style={{
        ...fontsBase,
        color: "#4A90E2",
        fontWeight: 500,
        margin: "10px 0 4px 2px"
      }}>
        {selectedError && selectedError !== "other" && "💡 常見解決方案 (Quick Fix Tips):"}
        {selectedError === "other" && "請用下方AI協助區提問"}
      </div>

      <div style={{ color: "#2C3E50", fontSize: 14, minHeight: 62, whiteSpace: "pre-line", marginBottom: 2 }}>
        {output && !loading && <div style={normalMsg}>{output}</div>}
        {loading && <div style={infoMsg}>分析中… Processing…</div>}
      </div>

      <div style={{
        borderTop: "1px solid #E0E0E0", paddingTop: 10, marginTop: 6, marginBottom: 2, fontSize: 13
      }}>
         若上述解決方案無法幫助你：
         <br />If the above doesn't help, please describe your situation and ask the AI:
         <textarea
          placeholder="描述你遇到的狀況 Describe your issue (可用中文或英文)"
          style={{ ...areaStyle, height: 44, resize: "vertical", fontSize: 14 }}
          value={codeSummary}
          onChange={e => setCodeSummary(e.target.value)}
        />
        <button
          style={{ ...secondaryBtn, background: "#fff", color: "#4A90E2", marginTop: 6, border: "1px solid #92BDE7"}}
          onClick={() =>
            chrome.windows.create({
              url: chrome.runtime.getURL("src/popup/index.html"),
              type: "popup",
              width: 380,
              height: 550
            })
          }
        >
          📌 將 AI 小助手固定為視窗<br/>Pin AI Advisor as Window
        </button>

        <button style={secondaryBtn} onClick={handleAskAdvice} disabled={loading || !codeSummary.trim()}>
          🤖 提問AI／Ask AI
        </button>
      </div>
      <div style={{
        fontSize: 11, color: "#8fa6b6", marginTop: 16,
        textAlign: "center", letterSpacing: 0.3
      }}>
        Powered by RoboYouth Taiwan • OpenAI<br />
        <span style={{ color: "#92BDE7" }}>
          Support: roboyouth.tw
        </span>
      </div>
    </div>

    
  );
}
