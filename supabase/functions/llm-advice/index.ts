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

// Helper: Render human-friendly summary of blocks for the LLM prompt
function summarizeBlocks(blocks: any[]): string {
  if (!blocks || !Array.isArray(blocks) || blocks.length === 0) {
    return "⚠️ 偵測不到積木設定（No blocks detected）";
  }
  let out = "";
  let motorCt = 0, sensorCt = 0, otherCt = 0;

  for (const b of blocks) {
    // Motor block types
    if (b.type && b.type.toLowerCase().includes("motor")) {
      out += `• 馬達${b.MOTOR || b.PORT || ""} `;
      if (b.SPEED !== undefined) out += `速度${b.SPEED}% `;
      if (b.DIRECTION) out += `方向:${b.DIRECTION} `;
      out += (b.MOTOR || b.PORT || b.SPEED !== undefined || b.DIRECTION) ? "\n" : "";
      motorCt++;
    }
    // Sensor block types
    else if (b.type && b.type.toLowerCase().includes("sensor")) {
      out += `• 感應器${b.SENSOR || ""} 類型:${b.type}`;
      if (b.COLOR) out += ` 顏色:${b.COLOR}`;
      if (b.VALUE !== undefined) out += ` 值:${b.VALUE}`;
      out += "\n";
      sensorCt++;
    }
    // Miscellaneous
    else {
      out += `• 其他積木: ${JSON.stringify(b)}\n`;
      otherCt++;
    }
  }
  
  return (
    (motorCt ? `【偵測到馬達積木:${motorCt}個】\n` : "") +
    (sensorCt ? `【偵測到感應器積木:${sensorCt}個】\n` : "") +
    out.trim()
  );
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

    // Compose the full LLM prompt for OpenAI
    const prompt = `
你是一位親切又懂樂高SPIKE的機器人輔導老師，請根據學生描述與真實積木參數，回覆具體、鼓勵性建議，內容必須依下方積木數值診斷！（不能隨便假設馬達或感應器參數）

【學生描述】
${summary}

【選擇的主要問題/症狀】
${pickedSymptom}

【自動偵測的積木設定】
${blockSummary}

請先根據積木中每個馬達/感應器/參數（如速度、端口、顏色、值）直接針對有待改進的地方給出修正建議。例如：如發現馬達A速度為50%，可以鼓勵學生嘗試提高到90%。如果感應器參數不合或缺少積木，也要直接指出。

請用繁體中文（正體字），語氣簡單、具體又鼓勵，篇幅不超過100字。
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
          { role: "system", content: "You help robotics students debug LEGO SPIKE Prime block code in Traditional Mandarin. Always analyze provided code blocks before answering. Never make up block values." },
          { role: "user", content: prompt }
        ],
        max_tokens: 256,
        temperature: 0.7,
      }),
    });

    const openaiData = await openaiResp.json();
    let advice = "Sorry, I couldn't get advice from the AI.";
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
