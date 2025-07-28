// @ts-expect-error Deno global is provided by runtime
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Replace this with your real OpenAI API key in the Supabase env vars
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

// Standard CORS headers for browser/extension calls
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { code, lang } = await req.json();

    // Compose prompt for OpenAI
    const prompt = `
You are a friendly SPIKE Prime robotics coding mentor for middle schoolers.
A student is working in the block coding interface.
The student described: "${code.summary}"
Here are the current code blocks.
${code.blockText}
請特別注意數值、馬達功率、方向等，發現明顯可改進處時，直接指出（例如學生說馬達力量不夠，而程式裏馬達速度只有 50%，你可以建議提高到 90%）。請用繁體中文，語氣鼓勵且具體。
Give simple, encouraging advice (~100 words) about how to solve the issue they raised and analyze their code blocks to help them.
Please reply ONLY in Traditional Mandarin Chinese (繁體中文，正體字), keep answers <100 words.
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
          { role: "system", content: "You help robotics students debug block code." },
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
