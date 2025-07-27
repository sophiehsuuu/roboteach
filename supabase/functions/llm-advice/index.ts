// @ts-expect-error Deno global is provided by runtime

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Make sure to set your OpenAI API key as an environment variable (see below!)
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

serve(async (req) => {
  const { code, lang } = await req.json();

  // 1. Compose the prompt for the LLM
  const prompt = `
You are a friendly SPIKE Prime robotics coding mentor for middle schoolers.
A student is working in the block coding interface. Their code (as JSON):
${JSON.stringify(code)}
They need help in this language: ${lang}.
Give simple, encouraging advice (~100 words) about what common block errors you see and what to try next.
`;

  // 2. Make a POST request to the OpenAI API
  const openaiResp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-3.5-turbo", // or "gpt-4" if you have access
      messages: [
        { role: "system", content: "You help robotics students debug block code." },
        { role: "user", content: prompt }
      ],
      max_tokens: 256,
      temperature: 0.7,
    }),
  });

  const openaiData = await openaiResp.json();

  // Get reply text (handle possible errors)
  let advice = "Sorry, I couldn't get advice from the AI.";
  try {
    advice =
      openaiData.choices?.[0]?.message?.content?.trim() ||
      advice;
  } catch {
    // fallback message already set
  }

  return new Response(JSON.stringify({ advice }), {
    headers: { "Content-Type": "application/json" }
  });
});
