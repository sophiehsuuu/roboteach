// @ts-expect-error Deno global is provided by runtime
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// OpenAI API key (set securely in env on Supabase)
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

// Standard CORS headers for browser/extension calls
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Enhanced block field mapping for better analysis
const BLOCK_TYPE_CATEGORIES = {
  motor: ['spike_move_motor', 'spike_move_motor_for', 'spike_move_motor_to_position', 'spike_start_motor', 'spike_stop_motor'],
  sensor: ['spike_wait_for_color', 'spike_wait_for_distance', 'spike_wait_for_force', 'spike_wait_for_gesture', 'spike_wait_for_touch', 'spike_wait_until_color', 'spike_wait_until_distance', 'spike_wait_until_force', 'spike_wait_until_gesture', 'spike_wait_until_touch'],
  control: ['controls_repeat_ext', 'controls_whileUntil', 'controls_if', 'controls_if_mutator'],
  display: ['spike_display_show_image', 'spike_display_show_text', 'spike_display_clear'],
  sound: ['spike_sound_play_note', 'spike_sound_play_sound', 'spike_sound_start_beep', 'spike_sound_stop'],
  variables: ['variables_set', 'variables_get'],
  math: ['math_number', 'math_arithmetic'],
  logic: ['logic_compare', 'logic_operation', 'logic_boolean', 'logic_negate']
};

// Helper: Render human-friendly summary of blocks for the LLM prompt
function summarizeBlocks(blocks: any[]): string {
  if (!blocks || !Array.isArray(blocks) || blocks.length === 0) {
    return "⚠️ 偵測不到積木設定（No blocks detected）";
  }
  
  let out = "";
  let motorCt = 0, sensorCt = 0, controlCt = 0, displayCt = 0, soundCt = 0, variableCt = 0, mathCt = 0, logicCt = 0, otherCt = 0;

  // Group blocks by category
  const categorized: Record<string, any[]> = {
    motor: [],
    sensor: [],
    control: [],
    display: [],
    sound: [],
    variables: [],
    math: [],
    logic: [],
    other: []
  };

  for (const b of blocks) {
    let isCategorized = false;
    for (const [category, types] of Object.entries(BLOCK_TYPE_CATEGORIES)) {
      if (b.type && types.some(type => b.type.includes(type))) {
        categorized[category].push(b);
        isCategorized = true;
        break;
      }
    }
    if (!isCategorized) {
      categorized.other.push(b);
    }
  }

  // Motor blocks analysis
  if (categorized.motor.length > 0) {
    out += `【馬達積木 (${categorized.motor.length}個)】\n`;
    categorized.motor.forEach((b, i) => {
      out += `  ${i + 1}. ${b.type}`;
      if (b.MOTOR || b.PORT) out += ` 端口:${b.MOTOR || b.PORT}`;
      if (b.SPEED !== undefined) out += ` 速度:${b.SPEED}%`;
      if (b.DIRECTION) out += ` 方向:${b.DIRECTION}`;
      if (b.DURATION) out += ` 時間:${b.DURATION}`;
      if (b.POSITION) out += ` 位置:${b.POSITION}`;
      out += "\n";
    });
    motorCt = categorized.motor.length;
  }

  // Sensor blocks analysis
  if (categorized.sensor.length > 0) {
    out += `【感應器積木 (${categorized.sensor.length}個)】\n`;
    categorized.sensor.forEach((b, i) => {
      out += `  ${i + 1}. ${b.type}`;
      if (b.SENSOR) out += ` 感應器:${b.SENSOR}`;
      if (b.COLOR) out += ` 顏色:${b.COLOR}`;
      if (b.DISTANCE) out += ` 距離:${b.DISTANCE}`;
      if (b.FORCE) out += ` 力道:${b.FORCE}`;
      if (b.GESTURE) out += ` 手勢:${b.GESTURE}`;
      if (b.OPERATOR) out += ` 運算:${b.OPERATOR}`;
      out += "\n";
    });
    sensorCt = categorized.sensor.length;
  }

  // Control blocks analysis
  if (categorized.control.length > 0) {
    out += `【控制積木 (${categorized.control.length}個)】\n`;
    categorized.control.forEach((b, i) => {
      out += `  ${i + 1}. ${b.type}`;
      if (b.TIMES) out += ` 次數:${b.TIMES}`;
      if (b.MODE) out += ` 模式:${b.MODE}`;
      out += "\n";
    });
    controlCt = categorized.control.length;
  }

  // Display blocks analysis
  if (categorized.display.length > 0) {
    out += `【顯示積木 (${categorized.display.length}個)】\n`;
    categorized.display.forEach((b, i) => {
      out += `  ${i + 1}. ${b.type}`;
      if (b.IMAGE) out += ` 圖片:${b.IMAGE}`;
      if (b.TEXT) out += ` 文字:${b.TEXT}`;
      out += "\n";
    });
    displayCt = categorized.display.length;
  }

  // Sound blocks analysis
  if (categorized.sound.length > 0) {
    out += `【聲音積木 (${categorized.sound.length}個)】\n`;
    categorized.sound.forEach((b, i) => {
      out += `  ${i + 1}. ${b.type}`;
      if (b.NOTE) out += ` 音符:${b.NOTE}`;
      if (b.DURATION) out += ` 時間:${b.DURATION}`;
      if (b.SOUND) out += ` 音效:${b.SOUND}`;
      out += "\n";
    });
    soundCt = categorized.sound.length;
  }

  // Variables analysis
  if (categorized.variables.length > 0) {
    out += `【變數積木 (${categorized.variables.length}個)】\n`;
    categorized.variables.forEach((b, i) => {
      out += `  ${i + 1}. ${b.type}`;
      if (b.VAR) out += ` 變數:${b.VAR}`;
      if (b.VALUE !== undefined) out += ` 值:${b.VALUE}`;
      out += "\n";
    });
    variableCt = categorized.variables.length;
  }

  // Math blocks analysis
  if (categorized.math.length > 0) {
    out += `【數學積木 (${categorized.math.length}個)】\n`;
    categorized.math.forEach((b, i) => {
      out += `  ${i + 1}. ${b.type}`;
      if (b.NUM !== undefined) out += ` 數字:${b.NUM}`;
      if (b.OP) out += ` 運算:${b.OP}`;
      if (b.A !== undefined) out += ` A:${b.A}`;
      if (b.B !== undefined) out += ` B:${b.B}`;
      out += "\n";
    });
    mathCt = categorized.math.length;
  }

  // Logic blocks analysis
  if (categorized.logic.length > 0) {
    out += `【邏輯積木 (${categorized.logic.length}個)】\n`;
    categorized.logic.forEach((b, i) => {
      out += `  ${i + 1}. ${b.type}`;
      if (b.OP) out += ` 運算:${b.OP}`;
      if (b.A !== undefined) out += ` A:${b.A}`;
      if (b.B !== undefined) out += ` B:${b.B}`;
      if (b.BOOL !== undefined) out += ` 布林:${b.BOOL}`;
      out += "\n";
    });
    logicCt = categorized.logic.length;
  }

  // Other blocks
  if (categorized.other.length > 0) {
    out += `【其他積木 (${categorized.other.length}個)】\n`;
    categorized.other.forEach((b, i) => {
      out += `  ${i + 1}. ${b.type} - ${JSON.stringify(b)}\n`;
    });
    otherCt = categorized.other.length;
  }
  
  return out.trim();
}

serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { code, lang } = await req.json();

    // Unpack parameters
    const summary: string = code.summary || "";
    const pickedSymptom: string = code.pickedSymptom || ""; // dropdown selection label
    const blockText: string = code.blockText || "";
    const blocks: any[] = code.blocks || [];

    // Summarize blocks (for the LLM prompt)
    const blockSummary = summarizeBlocks(blocks);

    // Compose the enhanced LLM prompt for OpenAI
    const prompt = `
你是一位親切又懂樂高SPIKE的機器人輔導老師。請根據學生描述與真實積木參數，回覆具體、鼓勵性建議。

【重要規則】
1. 只能根據下方提供的真實積木參數進行診斷
2. 絕對不能假設或猜測任何積木參數值
3. 如果學生描述的問題與實際積木設定不符，請指出差異
4. 如果缺少相關積木，請建議添加對應積木
5. 用繁體中文（正體字），語氣簡單、具體又鼓勵

【學生描述】
${summary}

【選擇的主要問題/症狀】
${pickedSymptom}

【自動偵測的積木設定】
${blockSummary}

【診斷要求】
請根據上述積木設定，針對學生描述的問題進行分析：
1. 檢查馬達設定：端口、速度、方向是否正確
2. 檢查感應器設定：類型、參數、條件是否合適
3. 檢查程式結構：是否有開始、循環、停止等控制積木
4. 如果發現參數問題（如速度太低、方向錯誤），請具體指出並建議修正
5. 如果缺少必要積木，請建議添加

請用繁體中文回覆，篇幅不超過150字，要具體指出問題所在。
`;

    // Call OpenAI API
    const openaiResp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages: [
          { 
            role: "system", 
            content: "You help robotics students debug LEGO SPIKE Prime block code in Traditional Mandarin. Always analyze provided code blocks before answering. Never make up block values. If a parameter is not provided in the blocks, ask the student to add the missing block or check their code." 
          },
          { role: "user", content: prompt }
        ],
        max_tokens: 300,
        temperature: 0.7,
      }),
    });

    const openaiData = await openaiResp.json();
    let advice = "抱歉，我無法取得AI建議。";
    try {
      advice = openaiData.choices?.[0]?.message?.content?.trim() || advice;
    } catch { /* fallback already set */ }

    return new Response(JSON.stringify({ advice }), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      }
    });
  }
});
