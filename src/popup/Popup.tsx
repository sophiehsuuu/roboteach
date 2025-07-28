import { useState, useEffect } from "react";
declare const chrome: any;

// --- Strict keys for error types ---
type ErrorTypeKey = "" | "motor" | "direction" | "not-starting" | "stop" | "sensor" | "other";

// --- Styles ---
const fontsBase = {
  fontFamily: `'Poppins', 'Noto Sans TC', 'Microsoft JhengHei', Arial, Helvetica, sans-serif`
};
const headingStyle = {
  ...fontsBase, color: "#2C3E50", fontWeight: 700, fontSize: 20, margin: "8px 0 2px 0", lineHeight: "1.2"
};
const subheadingStyle = {
  ...fontsBase, color: "#2C3E50", fontWeight: 500, fontSize: 15, marginBottom: 6, letterSpacing: 0.5
};
const areaStyle = {
  background: "#F5F5F5", borderRadius: "10px", padding: "8px", border: "1px solid #E0E0E0", marginBottom: 8,
  fontSize: 14, color: "#2C3E50", width: "100%"
};
const secondaryBtn = {
  background: "#92BDE7", color: "#2C3E50", border: "none",
  padding: "9px 18px", borderRadius: 6, fontWeight: 600,
  fontFamily: "Poppins, Arial, sans-serif", cursor: "pointer",
  fontSize: 16, marginTop: 8, marginBottom: 5
};
const infoMsg = { color: "#FFD54F", fontWeight: 400, margin: "6px 0" };
const normalMsg = { color: "#2C3E50", fontWeight: 400, margin: "6px 0" };

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

  useEffect(() => {
    function listener(msg: any) {
      if (msg.type === "SPIKE_BLOCK_STRUCTURED") {
        setBlockData(msg.payload.blocks || []);
        setBlockText(msg.payload.text || "");
      } else if (msg.type === "SPIKE_BLOCK_UPDATE") {
        setBlockText(msg.payload);
      }
    }
    if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.onMessage) {
      chrome.runtime.onMessage.addListener(listener);
      return () => chrome.runtime.onMessage.removeListener(listener);
    }
  }, []);

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

  function renderBlockSummary() {
    if (!blockData?.length) return null;
    return (
      <details style={{
        background: "#F5FAFF", border: "1px solid #BFE6FF", borderRadius: 7, padding: 7, fontSize: 12, marginBottom: 8
      }}>
        <summary style={{ cursor: "pointer", color: "#2293e8", fontWeight: 500, marginBottom: 2 }}>
          🧩 檢測到的積木設定 (Detected Blocks) {blockData.length > 0 ? `(${blockData.length})` : ""}
        </summary>
        <div style={{ fontFamily: "monospace", whiteSpace: "pre", maxHeight: 80, overflow: "auto" }}>
          {blockData.map((b, i) =>
            `#${i + 1}: ${JSON.stringify(b)}\n`
          )}
        </div>
      </details>
    );
  }

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
      {renderBlockSummary()}
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
          Support: roboyouthtaiwan@gmail.com
        </span>
      </div>
    </div>
  );
}
