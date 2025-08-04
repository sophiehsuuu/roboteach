// @ts-expect-error Deno global is provided by runtime
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// OpenAI API key (set securely in env on Supabase)
// @ts-ignore - Deno is provided by Supabase runtime
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

// Types for new API endpoints
interface NaturalLanguageRequest {
  prompt: string;
  mode: 'blocks' | 'python';
  context?: string; // Optional existing code context
}

interface SmartSuggestionsRequest {
  currentCode: any[];
  lastAction?: string;
  codeType: 'blocks' | 'python';
}

interface ChatbotRequest {
  message: string;
  currentCode: any[];
  conversationHistory?: Array<{role: 'user' | 'assistant', content: string}>;
}

// Handler for natural language to code generation
async function handleNaturalLanguageToBlocks(req: Request, headers: any): Promise<Response> {
  try {
    const { prompt, mode = 'blocks', context = '' }: NaturalLanguageRequest = await req.json();
    
    console.log('[Natural Language] Converting prompt to code:', { prompt, mode });
    
    const systemPrompt = `You are a LEGO SPIKE Prime programming expert. Convert natural language instructions into ${mode === 'blocks' ? 'visual block descriptions' : 'Python code'}.

SPIKE Prime Capabilities:
- Motors: set_motor_speed(port, speed), run_motor_for_time(port, time), run_motor_for_rotations(port, rotations)
- Sensors: get_color(port), get_reflection(port), get_distance(port), is_pressed(port)
- Movement: move_straight(distance), turn_left(degrees), turn_right(degrees)
- Control: if/else conditions, loops (forever, repeat N times), wait commands
- Display: show_image(), show_text(), clear_display()
- Sound: play_sound(), beep()

For block mode: Describe the sequence of blocks needed in Traditional Chinese.
For Python mode: Generate clean, educational SPIKE Prime Python code with comments.

User request: "${prompt}"
${context ? `\nExisting code context: ${context}` : ''}

Respond with:
1. Generated code (blocks description or Python)
2. Brief explanation of what it does (in Traditional Chinese)
3. Any assumptions made
4. Suggested improvements or alternatives`;

    const openaiResp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt }
        ],
        max_tokens: 1000,
        temperature: 0.3,
      }),
    });

    const openaiData = await openaiResp.json();
    const generatedCode = openaiData.choices[0]?.message?.content || "無法生成代碼";

    console.log('[Natural Language] Generated code:', generatedCode);

    return new Response(
      JSON.stringify({ 
        success: true, 
        generatedCode,
        mode,
        prompt 
      }),
      { headers: { ...headers, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[Natural Language] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...headers, 'Content-Type': 'application/json' } }
    );
  }
}

// Handler for smart code suggestions
async function handleSmartSuggestions(req: Request, headers: any): Promise<Response> {
  try {
    const { currentCode, lastAction, codeType }: SmartSuggestionsRequest = await req.json();
    
    console.log('[Smart Suggestions] Analyzing code for suggestions:', { currentCode: currentCode.length, lastAction, codeType });
    
    const codeAnalysis = currentCode.map(block => `${block.category}: ${block.text}`).join('\n');
    
    const systemPrompt = `You are a SPIKE Prime programming tutor. Analyze the current code and provide smart suggestions for improvements, next steps, or common patterns.

Current Code:
${codeAnalysis}

Last Action: ${lastAction || 'Unknown'}

Provide 3-5 specific, actionable suggestions in this JSON format:
{
  "suggestions": [
    {
      "type": "improvement|addition|fix",
      "title": "Short title in Traditional Chinese",
      "description": "Detailed explanation in Traditional Chinese",
      "priority": "high|medium|low",
      "blockTypes": ["relevant", "block", "categories"],
      "code": "Example code or block description"
    }
  ],
  "nextSteps": ["What the student should consider doing next"],
  "commonPatterns": ["Related programming patterns they might want to learn"]
}

Focus on educational value and practical robotics applications.`;

    const openaiResp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Analyze this SPIKE Prime code and provide suggestions: ${codeAnalysis}` }
        ],
        max_tokens: 800,
        temperature: 0.4,
      }),
    });

    const openaiData = await openaiResp.json();
    let suggestions;
    
    try {
      suggestions = JSON.parse(openaiData.choices[0]?.message?.content || '{"suggestions": [], "nextSteps": [], "commonPatterns": []}');
    } catch (parseError) {
      // Fallback if JSON parsing fails
      suggestions = {
        suggestions: [
          {
            type: "improvement",
            title: "分析你的程式",
            description: openaiData.choices[0]?.message?.content || "無法分析代碼",
            priority: "medium",
            blockTypes: ["control"],
            code: ""
          }
        ],
        nextSteps: ["繼續開發你的機器人程式"],
        commonPatterns: ["基礎感應器控制", "馬達運動控制"]
      };
    }

    console.log('[Smart Suggestions] Generated suggestions:', suggestions);

    return new Response(
      JSON.stringify({ 
        success: true, 
        ...suggestions,
        timestamp: new Date().toISOString()
      }),
      { headers: { ...headers, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[Smart Suggestions] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...headers, 'Content-Type': 'application/json' } }
    );
  }
}

// Handler for chatbot conversations
async function handleChatbot(req: Request, headers: any): Promise<Response> {
  try {
    const { message, currentCode, conversationHistory = [] }: ChatbotRequest = await req.json();
    
    console.log('[Chatbot] Processing message:', { message, codeBlocks: currentCode.length });
    
    const codeContext = currentCode.map(block => `${block.category}: ${block.text}`).join('\n');
    
    const systemPrompt = `You are a friendly, knowledgeable SPIKE Prime programming tutor. Help students with their robotics programming questions.

Current Student's Code:
${codeContext || 'No code provided'}

Guidelines:
1. Be encouraging and educational
2. Explain concepts clearly for students
3. Reference their current code when relevant
4. Suggest specific improvements with examples
5. Use Traditional Chinese (繁體中文)
6. Keep responses concise but helpful
7. If they ask about errors, help debug step by step
8. Encourage experimentation and learning

Conversation History:
${conversationHistory.map(msg => `${msg.role}: ${msg.content}`).join('\n')}

Student Question: ${message}`;

    const openaiResp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST", 
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          ...conversationHistory.slice(-6), // Keep last 6 messages for context
          { role: "user", content: message }
        ],
        max_tokens: 500,
        temperature: 0.6,
      }),
    });

    const openaiData = await openaiResp.json();
    const response = openaiData.choices[0]?.message?.content || "抱歉，我無法理解你的問題。請再試一次。";

    console.log('[Chatbot] Generated response:', response);

    return new Response(
      JSON.stringify({ 
        success: true, 
        response,
        timestamp: new Date().toISOString(),
        conversationId: Math.random().toString(36).substring(7)
      }),
      { headers: { ...headers, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[Chatbot] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...headers, 'Content-Type': 'application/json' } }
    );
  }
}

// Diagnostic reasoning framework for behavioral analysis
function generateDiagnosticInsights(blocks: any[]): string {
  if (!blocks || blocks.length === 0) {
    return "⚠️ 無法分析程式行為 - 未偵測到積木";
  }

  let insights = "\n【機器人行為診斷分析】\n";

  // 1. Motor Configuration Analysis
  const motorAnalysis = analyzeMotorConfiguration(blocks);
  if (motorAnalysis) insights += motorAnalysis;

  // 2. Program Flow Analysis  
  const flowAnalysis = analyzeProgramFlow(blocks);
  if (flowAnalysis) insights += flowAnalysis;

  // 3. Sensor Integration Analysis
  const sensorAnalysis = analyzeSensorIntegration(blocks);
  if (sensorAnalysis) insights += sensorAnalysis;

  // 4. Common Behavioral Issues Detection
  const behaviorIssues = detectBehavioralIssues(blocks);
  if (behaviorIssues) insights += behaviorIssues;

  return insights;
}

function analyzeMotorConfiguration(blocks: any[]): string {
  console.log('[Backend] analyzeMotorConfiguration called with blocks:', blocks.map(b => ({ text: b.text, category: b.category })));
  
  // NEW APPROACH: Parse the exact text patterns we're seeing
  const motorBlocks = blocks.filter(b => {
    if (!b.text) return false;
    
    const text = b.text;
    
    // Look for the EXACT patterns we see in the logs:
    // "Motor A: set speed to 75%"
    // "Motor B: set speed to 75%" 
    // "A stop motor blue"
    // "if Motor A is color red then stop motor"
    
    const isMotorBlock = (
      // Pattern: "Motor A: set speed to 75%"
      /^Motor [A-F]: set speed to \d+%$/i.test(text) ||
      // Pattern: "A stop motor" 
      /^[A-F] stop motor/i.test(text) ||
      // Pattern: "Motor A: ..."
      /^Motor [A-F]:/i.test(text) ||
      // Pattern: "if Motor A ... then stop motor"
      /if Motor [A-F].*stop motor/i.test(text) ||
      // Category-based detection
      b.category === 'flippermotor'
    );
    
    console.log('[Backend] Block text:', b.text, '-> isMotorBlock:', isMotorBlock);
    return isMotorBlock;
  });

  if (motorBlocks.length === 0) {
    return "• 馬達配置: ⚠️ 未發現馬達控制積木 → 機器人不會移動\n";
  }

  let analysis = "• 馬達配置分析:\n";
  
  // Extract motor ports and speeds - NEW TARGETED APPROACH
  const motorData = new Map();
  motorBlocks.forEach(block => {
    const text = block.text;
    let port: string | null = null;
    let speed: number | null = null;
    let actions: string[] = [];
    
    // Parse "Motor A: set speed to 75%" pattern
    const setSpeedMatch = text.match(/^Motor ([A-F]): set speed to (\d+)%$/i);
    if (setSpeedMatch) {
      port = setSpeedMatch[1].toUpperCase();
      speed = parseInt(setSpeedMatch[2]);
      actions.push('set_speed');
      console.log('[Motor Analysis] SET SPEED DETECTED:', port, speed);
    }
    
    // Parse "A stop motor" pattern  
    const stopMotorMatch = text.match(/^([A-F]) stop motor/i);
    if (stopMotorMatch) {
      port = stopMotorMatch[1].toUpperCase();
      actions.push('stop');
      console.log('[Motor Analysis] STOP MOTOR DETECTED:', port);
    }
    
    // Parse "if Motor A is color red then stop motor" pattern
    const conditionalMatch = text.match(/if Motor ([A-F]).*stop motor/i);
    if (conditionalMatch) {
      port = conditionalMatch[1].toUpperCase();
      actions.push('conditional_stop');
      console.log('[Motor Analysis] CONDITIONAL STOP DETECTED:', port);
    }
    
    // Store the motor data
    if (port) {
      if (!motorData.has(port)) {
        motorData.set(port, { speeds: [], actions: [], text: [] });
      }
      const data = motorData.get(port);
      if (speed !== null) data.speeds.push(speed);
      data.actions.push(...actions);
      data.text.push(text);
      
      console.log('[Motor Analysis] STORED DATA for Motor', port, ':', data);
    }
  });

  console.log('[Motor Analysis] Final motor data collected:', Array.from(motorData.entries()));
  
  // Analyze motor configuration for common issues
  const motorPorts = Array.from(motorData.keys());
  
  if (motorData.size > 0) {
    analysis += `  ✅ 發現 ${motorData.size} 個馬達配置: ${motorPorts.join(', ')}\n`;
    for (const [port, data] of motorData) {
      analysis += `    - 馬達${port}: `;
      if (data.speeds.length > 0) {
        analysis += `速度已設定為 ${data.speeds.join(', ')}%, `;
      }
      if (data.actions.length > 0) {
        analysis += `動作: ${data.actions.join(', ')}`;
      }
      analysis += `\n`;
      // Show original block text for verification
      if (data.text.length > 0) {
        analysis += `      原始積木: ${data.text.join('; ')}\n`;
      }
    }
  } else {
    analysis += "  ⚠️ 未發現任何馬達積木\n";
  }
  
  if (motorPorts.length === 1) {
    analysis += "  - ⚠️ 只有單一馬達 → 可能導致機器人原地轉圈\n";
  } else if (motorPorts.length >= 2) {
    // Check for balanced motor configuration
    const leftMotor = motorData.get('A') || motorData.get('B');
    const rightMotor = motorData.get('C') || motorData.get('E') || motorData.get('F');
    
    if (leftMotor && rightMotor) {
      const leftSpeeds = leftMotor.speeds;
      const rightSpeeds = rightMotor.speeds;
      
      if (leftSpeeds.length > 0 && rightSpeeds.length > 0) {
        const avgLeftSpeed = leftSpeeds.reduce((a, b) => a + b, 0) / leftSpeeds.length;
        const avgRightSpeed = rightSpeeds.reduce((a, b) => a + b, 0) / rightSpeeds.length;
        
        if (Math.abs(avgLeftSpeed - avgRightSpeed) > 20) {
          analysis += `  - ⚠️ 馬達速度不平衡 (${avgLeftSpeed.toFixed(0)}% vs ${avgRightSpeed.toFixed(0)}%) → 機器人會轉彎\n`;
        } else {
          analysis += `  - ✅ 馬達速度平衡 (${avgLeftSpeed.toFixed(0)}%, ${avgRightSpeed.toFixed(0)}%)\n`;
        }
      }
    }
  }

  // Check for low speed issues
  const allSpeeds = Array.from(motorData.values()).flatMap(data => data.speeds);
  if (allSpeeds.length > 0) {
    const maxSpeed = Math.max(...allSpeeds);
    if (maxSpeed < 30) {
      analysis += "  - ⚠️ 馬達速度偏低 → 機器人可能無力移動\n";
    }
  }

  return analysis;
}

function analyzeProgramFlow(blocks: any[]): string {
  let analysis = "• 程式流程分析:\n";
  
  // Check for start block
  const hasStartBlock = blocks.some(b => 
    b.text && (b.text.includes('when program starts') || b.text.includes('程式開始'))
  );
  
  if (!hasStartBlock) {
    analysis += "  - ⚠️ 缺少程式開始積木 → 程式可能不會執行\n";
  }

  // Check for infinite loops
  const hasForeverLoop = blocks.some(b => 
    b.text && (b.text.includes('forever') || b.text.includes('永遠重複'))
  );
  
  const hasFiniteLoop = blocks.some(b => 
    b.text && (b.text.includes('repeat') || b.text.includes('重複'))
  );

  if (hasForeverLoop && !hasFiniteLoop) {
    analysis += "  - ⚠️ 偵測到無限循環 → 機器人會持續執行直到手動停止\n";
  }

  // Check for stop conditions
  const hasStopBlock = blocks.some(b => 
    b.text && (b.text.includes('stop') || b.text.includes('停止'))
  );

  if (hasForeverLoop && !hasStopBlock) {
    analysis += "  - ⚠️ 無限循環中無停止條件 → 機器人可能無法控制停止\n";
  }

  return analysis;
}

function analyzeSensorIntegration(blocks: any[]): string {
  const sensorBlocks = blocks.filter(b => 
    b.text && (b.text.includes('sensor') || b.text.includes('when') || b.text.includes('wait') || b.text.includes('感應'))
  );

  if (sensorBlocks.length === 0) {
    return "• 感應器整合: 未使用感應器 → 機器人只會執行預設動作\n";
  }

  let analysis = "• 感應器整合分析:\n";
  
  // Check if sensors are used for control flow
  const motorBlocks = blocks.filter(b => b.text && b.text.includes('Motor'));
  const sensorControlled = sensorBlocks.some(block => {
    // Check if sensor is connected to motor actions in program flow
    const sensorIndex = blocks.indexOf(block);
    return motorBlocks.some(motorBlock => {
      const motorIndex = blocks.indexOf(motorBlock);
      return Math.abs(motorIndex - sensorIndex) <= 2; // Close proximity in block sequence
    });
  });

  if (!sensorControlled) {
    analysis += "  - ⚠️ 感應器未連接到馬達控制 → 感應器資料可能被忽略\n";
  }

  return analysis;
}

function detectBehavioralIssues(blocks: any[]): string {
  let issues = "• 常見行為問題檢測:\n";
  let foundIssues = false;

  // Issue 1: Robot turning in circles
  const motorBlocks = blocks.filter(b => b.text && b.text.includes('Motor'));
  const motorDirections = motorBlocks.map(b => {
    if (b.text.includes('forward')) return 'forward';
    if (b.text.includes('backward')) return 'backward';
    return 'unknown';
  });

  const oppositeDirections = motorDirections.filter(d => d === 'forward').length > 0 && 
                           motorDirections.filter(d => d === 'backward').length > 0;

  if (oppositeDirections) {
    issues += "  - 🔄 可能原因「轉圈」: 偵測到相反方向的馬達設定\n";
    foundIssues = true;
  }

  // Issue 2: Robot not moving
  const hasMotorAction = blocks.some(b => 
    b.text && (b.text.includes('run') || b.text.includes('move') || b.text.includes('set speed'))
  );

  if (!hasMotorAction) {
    issues += "  - 🚫 可能原因「不移動」: 未發現馬達動作指令\n";
    foundIssues = true;
  }

  // Issue 3: Wrong distance/timing
  const hasTimingValues = blocks.some(b => {
    const numbers = b.text?.match(/\d+/g);
    return numbers && numbers.some(n => parseInt(n) > 100); // Suspiciously high values
  });

  if (hasTimingValues) {
    issues += "  - 📏 可能原因「距離錯誤」: 偵測到異常高的數值設定\n";
    foundIssues = true;
  }

  return foundIssues ? issues : "";
}

// Helper: Generate structured program flow for better AI understanding
function generateProgramFlow(blocks: any[]): string {
  if (!blocks || !Array.isArray(blocks) || blocks.length === 0) {
    return "⚠️ 偵測不到積木設定（No blocks detected）";
  }

  let flow = "【程式邏輯流程】\n";
  
  // Identify key components
  const eventBlocks = blocks.filter(b => b.text && b.text.includes('when program starts'));
  const motorBlocks = blocks.filter(b => b.text && b.text.includes('Motor') && b.text.includes('set speed'));
  const moveBlocks = blocks.filter(b => b.text && (b.text.includes('move') || b.text.includes('rotations')));
  const ifBlocks = blocks.filter(b => b.text && b.text.includes('if'));
  const sensorBlocks = blocks.filter(b => b.text && b.text.includes('Sensor'));
  const stopBlocks = blocks.filter(b => b.text && (b.text.includes('stop moving') || b.text.includes('stop motor')));
  
  // Generate logical flow
  if (eventBlocks.length > 0) {
    flow += "when program starts:\n";
  }
  
  if (motorBlocks.length > 0) {
    motorBlocks.forEach(motor => {
      const speedMatch = motor.text.match(/(\d+)%/);
      const portMatch = motor.text.match(/Motor ([A-F])/);
      if (portMatch && speedMatch) {
        flow += `  set Motor ${portMatch[1]} speed to ${speedMatch[1]}%\n`;
      }
    });
  }
  
  // Enhanced conditional logic handling: treat move blocks as part of if/then/else structure
  if (ifBlocks.length > 0) {
    ifBlocks.forEach(ifBlock => {
      if (ifBlock.text.includes('Sensor') && ifBlock.text.includes('color')) {
        const sensorMatch = ifBlock.text.match(/Sensor ([A-F])/);
        const colorMatch = ifBlock.text.match(/(red|blue|green|yellow|white|black)/i);
        if (sensorMatch) {
          flow += `  if Sensor ${sensorMatch[1]} detects`;
          if (colorMatch) {
            flow += ` color ${colorMatch[1].toLowerCase()}:\n`;
          } else {
            flow += ` specified color:\n`;
          }
          
          // Add THEN branch actions
          if (stopBlocks.length > 0) {
            flow += `    then: stop motor\n`;
          }
          
          // Add ELSE branch actions - if there are move blocks AND stop blocks, 
          // move blocks likely go in the else branch (based on visual nesting)
          if (moveBlocks.length > 0 && stopBlocks.length > 0) {
            flow += `    else:\n`;
            moveBlocks.forEach(move => {
              const rotMatch = move.text.match(/(\d+)/);
              if (rotMatch) {
                flow += `      move forward ${rotMatch[1]} rotations\n`;
              }
            });
          }
        }
      } else if (ifBlock.text.includes('closer than')) {
        const sensorMatch = ifBlock.text.match(/Sensor ([A-F])/);
        const distMatch = ifBlock.text.match(/(\d+)/);
        if (sensorMatch && distMatch) {
          flow += `  if Sensor ${sensorMatch[1]} closer than ${distMatch[1]}%:\n`;
          if (stopBlocks.length > 0) {
            flow += `    then: stop moving\n`;
          }
          if (moveBlocks.length > 0 && stopBlocks.length > 0) {
            flow += `    else:\n`;
            moveBlocks.forEach(move => {
              const rotMatch = move.text.match(/(\d+)/);
              if (rotMatch) {
                flow += `      move forward ${rotMatch[1]} rotations\n`;
              }
            });
          }
        }
      }
    });
  } else if (moveBlocks.length > 0) {
    // If no conditional blocks, treat move blocks as sequential
    moveBlocks.forEach(move => {
      const rotMatch = move.text.match(/(\d+)/);
      if (rotMatch) {
        flow += `  move forward ${rotMatch[1]} rotations\n`;
      }
    });
  }
  
  // Add logic inference section
  if (ifBlocks.length > 0 && moveBlocks.length > 0 && stopBlocks.length > 0) {
    flow += "\n【推論邏輯】\n";
    flow += "偵測到條件判斷結構：感應器觸發→停止馬達(THEN)→移動指令(ELSE)\n";
    flow += "移動積木可能位於條件判斷的ELSE分支中\n";
  }
  
  return flow;
}

// Helper: Render human-friendly summary of blocks for the LLM prompt
function summarizeBlocks(blocks: any[]): string {
  if (!blocks || !Array.isArray(blocks) || blocks.length === 0) {
    return "⚠️ 偵測不到積木設定（No blocks detected）";
  }
  
  let out = "";
  let hasStartBlock = false;
  let hasMotorBlocks = false;
  let hasSensorBlocks = false;
  let hasControlBlocks = false;
  
  // Check if we have logical structure data
  const hasStructureData = blocks.some(b => b.nextBlock || b.childBlocks || b.nestingLevel !== undefined);
  
  if (hasStructureData) {
    out += "【程式邏輯結構分析】\n";
    
    // Find top-level blocks (program entry points)
    const topLevelBlocks = blocks.filter(b => b.isTopLevel);
    if (topLevelBlocks.length > 0) {
      out += `• 程式入口點: ${topLevelBlocks.length}個 (${topLevelBlocks.map(b => b.text).join(', ')})\n`;
    }
    
    // Analyze control flow with enhanced Blockly data
    const controlBlocks = blocks.filter(b => b.type && b.type.includes('controls_'));
    if (controlBlocks.length > 0) {
      out += `• 控制結構: ${controlBlocks.length}個\n`;
      controlBlocks.forEach(b => {
        out += `  - ${b.text} (巢狀層級: ${b.nestingLevel}, 連接數: ${b.connectionCount})\n`;
        if (b.childBlocks && b.childBlocks.length > 0) {
          out += `    包含: ${b.childBlocks.map(c => c.type).join(', ')}\n`;
        }
        // Add Blockly-specific analysis
        if (b.blocklyMetadata) {
          const meta = b.blocklyMetadata;
          if (meta.isStatement) out += `    (語句積木 - 可連接上下)\n`;
          else if (meta.isValue) out += `    (數值積木 - 可插入其他積木)\n`;
          else if (meta.isTerminal) out += `    (終端積木 - 程式結束點)\n`;
        }
      });
    }
    
    // Check for infinite loops
    const foreverBlocks = blocks.filter(b => b.type && b.type.includes('forever'));
    if (foreverBlocks.length > 0) {
      out += `• ⚠️ 發現無限循環: ${foreverBlocks.length}個\n`;
    }
    
    // Check for unreachable code using enhanced connection data
    const unreachableBlocks = blocks.filter(b => !b.isTopLevel && !b.previousBlock && b.connectionCount === 0);
    if (unreachableBlocks.length > 0) {
      out += `• ⚠️ 可能無法執行的積木: ${unreachableBlocks.length}個 (無連接)\n`;
    }
    
    // Analyze block types using Blockly metadata
    const statementBlocks = blocks.filter(b => b.blocklyMetadata?.isStatement);
    const valueBlocks = blocks.filter(b => b.blocklyMetadata?.isValue);
    const terminalBlocks = blocks.filter(b => b.blocklyMetadata?.isTerminal);
    
    if (statementBlocks.length > 0 || valueBlocks.length > 0 || terminalBlocks.length > 0) {
      out += `• 積木類型分析:\n`;
      if (statementBlocks.length > 0) out += `  - 語句積木: ${statementBlocks.length}個\n`;
      if (valueBlocks.length > 0) out += `  - 數值積木: ${valueBlocks.length}個\n`;
      if (terminalBlocks.length > 0) out += `  - 終端積木: ${terminalBlocks.length}個\n`;
    }
    
    out += "\n";
  }

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
    
    // First try standard type categorization
    for (const [category, types] of Object.entries(BLOCK_TYPE_CATEGORIES)) {
      if (b.type && types.some(type => b.type.includes(type))) {
        categorized[category].push(b);
        isCategorized = true;
        break;
      }
    }
    
    // Enhanced categorization based on text content and category
    if (!isCategorized) {
      const text = b.text || '';
      const category = b.category || '';
      
      // Motor blocks
      if (category === 'flippermotor' || 
          text.includes('motor') || 
          text.includes('Motor') ||
          text.includes('set speed') ||
          text.includes('go shortest path') ||
          text.includes('stop motor') ||
          (text.match(/^[A-F]\s/) && (text.includes('stop') || text.includes('go') || text.includes('position')))) {
        categorized.motor.push(b);
        isCategorized = true;
      }
      // Sensor blocks  
      else if (category === 'sensors' || 
               text.includes('Sensor') || 
               text.includes('is color') || text.includes('color') || text.includes('reflection') || text.includes('reflected light') || // color sensor
               text.includes('closer than') || text.includes('distance') || // distance sensor
               text.includes('is pressed') || text.includes('pressure') || // touch/force sensor
               text.includes('tilted') || text.includes('front') || text.includes('up') || text.includes('shaken') || text.includes('pitch') || text.includes('yaw') || text.includes('angle')) { // IMU sensor
        categorized.sensor.push(b);
        isCategorized = true;
      }
      // Control blocks
      else if (category === 'flippercontrol' || 
               text.includes('if') || 
               text.includes('forever') || 
               text.includes('repeat')) {
        categorized.control.push(b);
        isCategorized = true;
      }
    }
    
    if (!isCategorized) {
      categorized.other.push(b);
    }
  }

  // Motor blocks analysis with smart flags
  if (categorized.motor.length > 0) {
    hasMotorBlocks = true;
    out += `【馬達積木 (${categorized.motor.length}個)】\n`;
    categorized.motor.forEach((b, i) => {
      out += `  ${i + 1}. 馬達${b.MOTOR || b.PORT || "未知端口"}`;
      if (b.SPEED !== undefined) {
        const speed = parseInt(b.SPEED);
        out += ` 速度:${b.SPEED}%`;
        if (speed < 50) out += ` (⚠️ 速度偏低，建議80%以上)`;
        else if (speed > 100) out += ` (⚠️ 速度超出範圍)`;
      } else {
        out += ` 速度:未設定 (⚠️ 需要設定速度)`;
      }
      if (b.DIRECTION) out += ` 方向:${b.DIRECTION}`;
      if (b.DURATION) out += ` 時間:${b.DURATION}`;
      if (b.POSITION) out += ` 位置:${b.POSITION}`;
      out += "\n";
    });
  }

  // Sensor blocks analysis with smart flags
  if (categorized.sensor.length > 0) {
    hasSensorBlocks = true;
    out += `【感應器積木 (${categorized.sensor.length}個)】\n`;
    categorized.sensor.forEach((b, i) => {
      out += `  ${i + 1}. ${b.type}`;
      if (b.SENSOR) out += ` 感應器:${b.SENSOR}`;
      if (b.COLOR) out += ` 顏色:${b.COLOR}`;
      if (b.DISTANCE) out += ` 距離:${b.DISTANCE}cm`;
      if (b.FORCE) out += ` 力道:${b.FORCE}`;
      if (b.GESTURE) out += ` 手勢:${b.GESTURE}`;
      if (b.OPERATOR) out += ` 運算:${b.OPERATOR}`;
      out += "\n";
    });
  }

  // Control blocks analysis with smart flags
  if (categorized.control.length > 0) {
    hasControlBlocks = true;
    out += `【控制積木 (${categorized.control.length}個)】\n`;
    categorized.control.forEach((b, i) => {
      out += `  ${i + 1}. ${b.type}`;
      if (b.type.includes('repeat')) {
        if (b.TIMES) out += ` 次數:${b.TIMES}`;
        else out += ` (⚠️ 未設定重複次數)`;
      }
      if (b.type.includes('while') || b.type.includes('until')) {
        if (b.MODE) out += ` 模式:${b.MODE}`;
        else out += ` (⚠️ 未設定條件)`;
      }
      if (b.type.includes('if')) {
        out += ` (條件判斷積木)`;
      }
      out += "\n";
    });
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
  }

  // Other blocks
  if (categorized.other.length > 0) {
    out += `【其他積木 (${categorized.other.length}個)】\n`;
    categorized.other.forEach((b, i) => {
      out += `  ${i + 1}. ${b.type} - ${JSON.stringify(b)}\n`;
    });
  }

  // Add smart warnings at the end
  const warnings: string[] = [];
  if (!hasMotorBlocks) warnings.push("⚠️ 未發現馬達積木");
  if (!hasSensorBlocks) warnings.push("⚠️ 未發現感應器積木");
  if (!hasControlBlocks) warnings.push("⚠️ 未發現控制積木（如重複、條件判斷）");
  
  if (warnings.length > 0) {
    out += `\n【程式結構提醒】\n${warnings.join('\n')}`;
  }
  
  return out.trim();
}

// Language-specific prompt generator
function getLanguageSpecificPrompt(pickedSymptom: string, lang: string, summary: string, programFlow: string, blockSummary: string, blockAnalysis: any, diagnosticInsights: string): string {
  const languagePrompts: any = {
    'en': {
      'natural-language-generation': `【Block Code Generator】
You are a LEGO SPIKE Prime programming expert. Students describe their desired robot behavior in natural language, please generate new block program instructions for them.

**Important: This is new program generation, not existing program analysis!**

**Student Requirement**: ${summary}

**Generation Format**:
🎯 **Program Goal**: [Brief description of the function to be implemented]

📋 **Complete Block Sequence**:
1. **Event Block**: "when program starts"
2. **Motor Block**: "set motor A speed to 75%"
3. **Movement Block**: "motor A forward 10 rotations"
4. **Sensor Block**: [if needed] "wait for color sensor to detect red"
5. **Control Block**: [if needed] "if...then..."
6. **Stop Block**: "stop all motors"

⚙️ **Setup Suggestions**:
- Motor ports: A, B
- Speed suggestion: 75%
- Movement distance: specific values
- Sensor ports: suggested ports

💡 **Usage Instructions**:
1. Drag and drop the above blocks to workspace in order
2. Connect blocks to form complete program
3. Set suggested parameter values
4. Test and adjust

**Format requirement**: Use English, provide specific, executable block instructions, focus on generating new programs.`,
      'smart-suggestions': `【Smart Program Suggestions Mode】
You are a professional SPIKE Prime programming mentor. Analyze the student's current block program and provide 3-5 specific, feasible improvement suggestions.

**Analysis Focus**:
1. **Program Completeness**: Check if key blocks are missing (start, sensor, motor, control)
2. **Logic Optimization**: if/then structure, loop usage, condition settings are reasonable
3. **Parameter Adjustment**: motor speed, sensor threshold, time settings, etc.
4. **Function Extension**: Based on existing blocks, suggest next functions to try
5. **Common Issues**: Preventive suggestions to avoid common programming errors

**Output Format**:
For each suggestion:
• **Suggestion Title**: Concise description of improvement point
• **Specific Explanation**: Detailed explanation of why this improvement is needed
• **Implementation Steps**: How to add or modify blocks
• **Expected Effect**: What improvement this modification will bring

Keep suggestions practical and specific, suitable for student's programming level. Respond in English.`,
      'chatbot-conversation': `【AI Teaching Assistant Conversation Mode】
You are a friendly, professional SPIKE Prime programming instructor. Students are having a conversation with you, please respond to their questions in an educational, encouraging way.

**Conversation Guidelines**:
1. **Friendly Interaction**: Respond to students with warm, encouraging tone
2. **Education-Oriented**: Not just answer questions, but guide learning
3. **Reference Existing Code**: Provide specific suggestions based on student's current block program
4. **Step-by-Step Guidance**: If it's error diagnosis, provide step-by-step solution steps
5. **Experiment Encouragement**: Encourage students to try and experiment
6. **Concise and Clear**: Keep responses within 100 words, but provide substantial help

**Current Student Block Program**: If relevant, please reference and specifically point out
**Student Question**: Please directly respond to student's questions, such as "Why won't the robot move?", "How to make the robot turn?" etc.

Respond in English, tone should be friendly and educational.`,
      'program-summary': `【Program Summary Request】
You are a professional LEGO SPIKE block programming teaching assistant. Please summarize in 1-2 sentences what this program will do logically. Be sure to describe the key process and the causal relationship of conditional judgments:

**Logic Flow Analysis Requirements**:
1. **Identify Program Execution Order**: Start → Initial Action → Condition Judgment → Branch Action
2. **Important**: If sensor blocks and control blocks (if/then) are detected simultaneously, it means the program already has complete conditional logic, do not suggest adding more
3. **Conditional Logic Focus**:
   - ✅ Correct: "When sensor A detects red, stop moving, otherwise continue forward 10 rotations"
   - ✅ Correct: "Robot moves forward, if distance sensor detects obstacle then turn"
   - ❌ Wrong: "Robot stops moving. Sensor A detects red" (separate descriptions)
   - ❌ Wrong: "Suggest adding sensor condition trigger" (when sensor and condition blocks already exist)
4. **Must Explain Elements**:
   - Initial action (motor speed, direction)
   - Condition trigger (what sensor detects)
   - Condition result (what if branch does)
   - Alternative behavior (what else branch does)
   - Loop logic (forever, repeat, etc.)

1. Analyze the program's execution order and logic flow
2. Describe the robot's specific behavior and parameters (speed, direction, time, etc.)
3. **Focus on analyzing conditional logic**: If there's if/then/else structure, use conditional sentences to describe causal relationships
4. **Identify trigger conditions**: How sensors trigger specific motor or movement behaviors
5. Use simple, understandable English descriptions suitable for students
6. Avoid abstract words like "series of", "various", etc., be specific about actions
7. **Absolutely avoid separating condition and result descriptions**

**High-Quality Examples (Describing Complete Logic Flow)**:
✅ Excellent Summary:
- "When the program starts, motors A and B will move forward 10 rotations at 75% speed. If sensor A detects red, stop immediately, otherwise continue forward another 10 rotations"
- "Robot starts and moves forward. When distance sensor detects obstacle within 15cm, turn, then repeat this cycle"
- "Dual motors move forward at 50% speed. When touch sensor is pressed, stop for 3 seconds then continue forward"`
    },
    'zh-TW': {
      'natural-language-generation': `【積木程式生成器】
你是LEGO SPIKE Prime程式設計專家。學生用自然語言描述了他們想要的機器人行為，請為他們生成全新的積木程式指令。

**重要：這是新程式生成，不是現有程式分析！**

**學生需求**：${summary}

**生成格式**：
🎯 **程式目標**：[簡述要實現的功能]

📋 **完整積木序列**：
1. **事件積木**：「程式開始時」
2. **馬達積木**：「設定馬達A速度為75%」
3. **移動積木**：「馬達A前進10圈」
4. **感應器積木**：[如需要] 「等待顏色感應器檢測到紅色」
5. **控制積木**：[如需要] 「如果...則...」
6. **停止積木**：「停止所有馬達」

⚙️ **設定建議**：
- 馬達端口：A, B
- 速度建議：75%
- 移動距離：具體數值
- 感應器端口：建議端口

💡 **使用說明**：
1. 依序拖拉上述積木到工作區
2. 連接積木形成完整程式
3. 設定建議的參數數值
4. 測試並調整

**格式要求**：用繁體中文，提供具體、可執行的積木指令，專注於生成新程式。`,
      'smart-suggestions': `【智能程式建議模式】
你是專業的SPIKE Prime程式導師。分析學生當前的積木程式，提供3-5個具體、可行的改進建議。

**分析重點：**
1. **程式完整性**：檢查是否缺少關鍵積木（啟動、感應器、馬達、控制）
2. **邏輯優化**：if/then結構、循環使用、條件設定是否合理
3. **參數調整**：馬達速度、感應器閾值、時間設定等
4. **功能擴展**：基於現有積木，建議下一步可以嘗試的功能
5. **常見問題**：預防性建議，避免常見的程式錯誤

**輸出格式**：
針對每個建議：
• **建議標題**：簡潔描述改進點
• **具體說明**：詳細解釋為什麼需要這個改進
• **實作步驟**：如何添加或修改積木
• **預期效果**：這樣修改後會有什麼改善

保持建議實用、具體，適合學生的程式水平。用繁體中文回應。`,
      'chatbot-conversation': `【AI助教對話模式】
你是一位友善、專業的SPIKE Prime程式指導老師。學生正在和你進行對話，請以教育性、鼓勵性的方式回應他們的問題。

**對話指導原則：**
1. **友善互動**：用溫暖、鼓勵的語氣回應學生
2. **教育導向**：不只解答問題，更要引導學習
3. **參考現有代碼**：結合學生當前的積木程式提供具體建議
4. **逐步指導**：如果是錯誤診斷，請提供step-by-step的解決步驟
5. **實驗鼓勵**：鼓勵學生嘗試和實驗
6. **簡潔明確**：保持回應在100字內，但要有實質幫助

**當前學生積木程式**：如有相關性請參考並具體指出
**學生問題**：請直接回應學生的疑問，如"為什麼機器人不會動？"、"如何讓機器人轉彎？"等

用繁體中文回應，語氣要親切教學。`,
      'program-summary': `【程式摘要要求】
你是專業的樂高SPIKE積木程式助教，請用1-2句話總結這個程式在邏輯上會做什麼。務必描述關鍵流程和條件判斷的因果關係：

**邏輯流程分析要求：**
1. **識別程式執行順序**：啟動→初始動作→條件判斷→分支動作
2. **重要：如果同時偵測到感應器積木和控制積木(if/then)，說明程式已經有完整的條件邏輯，不要建議添加**
3. **條件邏輯重點**：
   - ✅ 正確："當感應器A偵測到紅色時停止移動，否則繼續前進10圈"
   - ✅ 正確："機器人前進，如果距離感應器檢測到障礙物則轉向"
   - ❌ 錯誤："機器人停止移動。感應器A偵測紅色" (分開描述)
   - ❌ 錯誤："建議添加感應器條件觸發" (當感應器和條件積木已存在時)
4. **必須說明的要素**：
   - 初始動作（馬達速度、方向）
   - 條件觸發（感應器偵測什麼）
   - 條件結果（if分支做什麼）
   - 替代行為（else分支做什麼）
   - 循環邏輯（forever、repeat等）

1. 分析程式的執行順序和邏輯流程
2. 描述機器人的具體行為和參數（速度、方向、時間等）
3. **重點分析條件邏輯：如果有if/then/else結構，用條件句描述因果關係**
4. **識別觸發條件：感應器如何觸發特定的馬達或移動行為**
5. 用簡單易懂的中文描述，適合學生理解
6. 避免用"一連串"、"各種"等抽象詞彙，要具體說明動作
7. **絕對避免將條件和結果分開描述**

**高品質範例（描述完整邏輯流程）：**
✅ 優秀摘要：
- "當程式開始時，馬達A與B會以75%速度前進10圈，如果感應器A偵測到紅色則立刻停止，否則繼續再前進10圈"
- "機器人啟動後前進，當距離感應器檢測到15cm內障礙物時轉向，然後重複此循環"
- "雙馬達以50%速度前進，觸碰感應器被按下時停止3秒後繼續前進"`
    }
  };

  // For other languages, use English as fallback
  const prompts = languagePrompts[lang] || languagePrompts['en'];
  
  // Return the appropriate prompt based on pickedSymptom
  if (pickedSymptom === 'natural-language-generation') {
    return prompts['natural-language-generation'];
  } else if (pickedSymptom === 'smart-suggestions') {
    return prompts['smart-suggestions'];
  } else if (pickedSymptom === 'chatbot-conversation') {
    return prompts['chatbot-conversation'];
  } else if (pickedSymptom === 'program-summary') {
    return prompts['program-summary'];
  } else {
    // Default diagnostic prompt
    return `你是一位親切又懂樂高SPIKE的機器人輔導老師，專長是根據學生的實際積木數值和機器人行為症狀來進行診斷分析，給明確、鼓勵性的修正建議。

【診斷方法論】
【SPIKE Prime積木知識庫】
✅ **感應器積木**: 顏色感應器(檢測特定顏色)、反射感應器(檢測光線強度百分比 如"reflection < 50%")、距離感應器(檢測物體距離)、壓力感應器(檢測按壓)、陀螺儀(檢測傾斜/搖晃)
✅ **馬達積木**: 設定速度、啟動馬達(順時針/逆時針)、移動特定距離/角度、停止馬達
✅ **控制積木**: if/then條件判斷、forever永久迴圈、repeat重複迴圈、wait等待
✅ **事件積木**: 程式開始觸發、按鈕按下觸發
✅ **常見組合**: "if 感應器條件 then 馬達動作" 是最基本的互動程式結構

你要像醫生診斷病人一樣，根據「症狀」→「可能原因」→「具體解決方案」的邏輯來分析：

1. 行為症狀分析：學生描述的機器人行為問題
2. 技術原因診斷：從積木設定中找出可能的根本原因  
3. 解決方案建議：提供具體的積木修改建議

【重要規則】
1. 只能根據下方提供的真實積木參數進行診斷
2. 絕對不能假設或猜測任何積木參數值
3. 如果學生描述的問題與實際積木設定不符，請指出差異
4. 如果缺少相關積木，請建議添加對應積木
5. 用繁體中文（正體字），語氣簡單、具體又鼓勵
6. 重點關注機器人的實際行為表現，而非單純的積木檢查
7. **增強型積木檢測優先**：請優先參考「增強型積木檢測」中顯示的具體積木內容和數量進行分析
8. **感應器檢測規則**：如果「增強型積木檢測」中顯示有感應器積木（如"Sensor A: is color red"或"Sensor A: reflection < 50%"），絕對不要說感應器未指定或缺少感應器
9. **控制流程識別**：如果看到包含"if...then"的控制積木，要認知這是完整的條件判斷結構，不是缺少控制積木
10. **禁止誤判規則**：如果「控制積木」顯示有任何數量>0，絕對不能說"缺少控制積木"或"沒有控制邏輯"，應該分析現有控制邏輯
11. **條件重複檢查**：如果控制積木已包含某感應器條件（如"reflection < 50%"），絕對不要建議添加相同的感應器條件
12. **現有邏輯解析**：優先分析已存在的if/then結構，不要當作缺少邏輯來處理

【學生描述的問題/症狀】
${summary}

【選擇的主要問題類型】
${pickedSymptom}

【程式邏輯流程結構】
${programFlow}

【積木偵測摘要】
${blockSummary}

【增強型積木檢測】
• 馬達積木: ${blockAnalysis.motors.length}個 ${blockAnalysis.motors.length > 0 ? '✅' : '⚠️'}
  ${blockAnalysis.motors.map(b => `- ${b.text}`).join('\n  ')}
• 感應器積木: ${blockAnalysis.sensors.length}個 ${blockAnalysis.sensors.length > 0 ? '✅' : '⚠️'}
  ${blockAnalysis.sensors.map(b => `- ${b.text}`).join('\n  ')}
  ${blockAnalysis.sensors.length > 0 ? '\n**重要**: 已偵測到感應器設定，請檢查是否已正確連接到條件控制積木中' : ''}
• 事件積木: ${blockAnalysis.events.length}個 ${blockAnalysis.events.length > 0 ? '✅' : '⚠️'}
  ${blockAnalysis.events.map(b => `- ${b.text}`).join('\n  ')}
• 控制積木: ${blockAnalysis.control.length}個 ${blockAnalysis.control.length > 0 ? '✅' : '⚠️'}
  ${blockAnalysis.control.map(b => `- ${b.text}`).join('\n  ')}
• 移動積木: ${blockAnalysis.movement.length}個 ${blockAnalysis.movement.length > 0 ? '✅' : '⚠️'}
  ${blockAnalysis.movement.map(b => `- ${b.text}`).join('\n  ')}

${diagnosticInsights}`;
  }
}

serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const endpoint = url.pathname.split('/').pop();

    // Route to different handlers based on endpoint
    switch (endpoint) {
      case 'natural-language-to-blocks':
        return await handleNaturalLanguageToBlocks(req, corsHeaders);
      case 'smart-suggestions':
        return await handleSmartSuggestions(req, corsHeaders);
      case 'chatbot':
        return await handleChatbot(req, corsHeaders);
      default:
        // Default to original block analysis
        return await handleBlockAnalysis(req, corsHeaders);
    }
  } catch (error) {
    console.error("Error in main handler:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Original block analysis handler (now extracted to function)
async function handleBlockAnalysis(req: Request, headers: any): Promise<Response> {
  try {
    const { code, lang } = await req.json();

    // Unpack parameters
    const summary: string = code.summary || "";
    const pickedSymptom: string = code.pickedSymptom || ""; // dropdown selection label
    const blockText: string = code.blockText || "";
    const blocks: any[] = code.blocks || [];
    const hierarchy: any = code.hierarchy || null;

    // Use Blockly hierarchy if available, otherwise generate from blocks
    const programFlow = hierarchy?.pseudoCode || generateProgramFlow(blocks);
    const blockSummary = summarizeBlocks(blocks);
    
    console.log('[HIERARCHY DEBUG] Received hierarchy:', hierarchy);
    console.log('[HIERARCHY DEBUG] Using program flow:', programFlow?.substring(0, 100) + '...');
    
    // Generate diagnostic insights
    const diagnosticInsights = generateDiagnosticInsights(blocks);

    // ENHANCED OVERRIDE: Comprehensive block type detection
    const blockAnalysis = {
      motors: blocks.filter(b => b.text && (
        /Motor [A-F]: set speed to \d+%/.test(b.text) ||
        /^[A-F] stop motor/.test(b.text) ||
        b.text.includes('Motor') ||
        b.category === 'flippermotor'
      )),
      sensors: blocks.filter(b => b.text && (
        /Sensor [A-F] is color/.test(b.text) ||
        b.text.includes('Sensor') ||
        b.text.includes('is color') || b.text.includes('color') || b.text.includes('reflection') || b.text.includes('reflected light') || // color sensor
        b.text.includes('closer than') || b.text.includes('distance') || // distance sensor
        b.text.includes('is pressed') || b.text.includes('pressure') || // touch/force sensor
        b.text.includes('tilted') || b.text.includes('front') || b.text.includes('up') || b.text.includes('shaken') || b.text.includes('pitch') || b.text.includes('yaw') || b.text.includes('angle') || // IMU sensor
        b.category === 'sensors' || b.category === 'flippersensors'
      )),
      events: blocks.filter(b => b.text && (
        b.text.includes('when program starts') ||
        b.text.includes('when button') ||
        b.text.includes('when') ||
        b.category === 'flipperevents'
      )),
      control: blocks.filter(b => b.text && (
        b.text.includes('if') ||
        b.text.includes('Control: if') ||
        b.text.includes('forever') ||
        b.text.includes('repeat') ||
        b.text.includes('while') ||
        b.category === 'flippercontrol' ||
        b.category === 'control'
      )),
      movement: blocks.filter(b => b.text && (
        b.text.includes('Move forward') ||
        (b.text.includes('move') && !b.text.includes('if')) ||  // Exclude conditional blocks
        b.text.includes('rotations') ||
        b.text.includes('degrees') ||
        (b.text.includes('stop moving') && !b.text.includes('if')) ||  // Only pure stop blocks
        (b.text.includes('Stop moving') && !b.text.includes('if')) ||
        b.text.includes('go forward') ||
        b.text.includes('go backward') ||
        b.text.includes('turn') ||
        b.category === 'movement'
      )),
      lights: blocks.filter(b => b.text && (
        b.text.includes('light') ||
        b.text.includes('LED') ||
        b.text.includes('color')
      ))
    };
    
    console.log('[ENHANCED DEBUG] Block analysis:', {
      motors: blockAnalysis.motors.length,
      sensors: blockAnalysis.sensors.length, 
      events: blockAnalysis.events.length,
      control: blockAnalysis.control.length,
      movement: blockAnalysis.movement.length,
      lights: blockAnalysis.lights.length
    });
    console.log('[ENHANCED DEBUG] Motor blocks:', blockAnalysis.motors.map(b => b.text));
    console.log('[ENHANCED DEBUG] Sensor blocks:', blockAnalysis.sensors.map(b => b.text));
    console.log('[ENHANCED DEBUG] Event blocks:', blockAnalysis.events.map(b => b.text));
    
    // CRITICAL: Track sensor detection status for caching consistency 
    console.log(`[SENSOR STATUS] ${blockAnalysis.sensors.length > 0 ? '✅ SENSORS DETECTED' : '❌ NO SENSORS DETECTED'} - Count: ${blockAnalysis.sensors.length}`);
    if (blockAnalysis.sensors.length > 0) {
      console.log('[SENSOR STATUS] Detected sensor details:', blockAnalysis.sensors.map(s => ({ text: s.text, category: s.category })));
    }
    
    // Special debugging for sensor detection
    console.log('[SENSOR DEBUG] All blocks being analyzed:', blocks.map(b => ({ text: b.text, category: b.category })));
    console.log('[SENSOR DEBUG] Sensor filter results:', blocks.filter(b => b.text && (
      /Sensor [A-F] is color/.test(b.text) ||
      b.text.includes('Sensor') ||
      b.text.includes('is color') || b.text.includes('color') || b.text.includes('reflection') || b.text.includes('reflected light') ||
      b.text.includes('closer than') || b.text.includes('distance') ||
      b.text.includes('is pressed') || b.text.includes('pressure') ||
      b.text.includes('tilted') || b.text.includes('front') || b.text.includes('up') || b.text.includes('shaken') || b.text.includes('pitch') || b.text.includes('yaw') || b.text.includes('angle') ||
      b.category === 'sensors'
    )).map(b => ({ text: b.text, category: b.category })));

    // Debug: Show the actual data being sent to AI
    console.log('[AI PROMPT DEBUG] Sensor count being sent to AI:', blockAnalysis.sensors.length);
    console.log('[AI PROMPT DEBUG] Sensor texts being sent to AI:', blockAnalysis.sensors.map(b => `- ${b.text}`));
    console.log('[AI PROMPT DEBUG] Control count being sent to AI:', blockAnalysis.control.length);
    console.log('[AI PROMPT DEBUG] Control texts being sent to AI:', blockAnalysis.control.map(b => `- ${b.text}`));
    console.log('[AI PROMPT DEBUG] Movement count being sent to AI:', blockAnalysis.movement.length);
    console.log('[AI PROMPT DEBUG] Movement texts being sent to AI:', blockAnalysis.movement.map(b => `- ${b.text}`));
    console.log('[AI PROMPT DEBUG] Is this a program summary request?', pickedSymptom === 'program-summary');
    
    // Analyze if sensors and conditions are already connected
    const hasSensors = blockAnalysis.sensors.length > 0;
    const hasConditionals = blockAnalysis.control.length > 0 && blockAnalysis.control.some(b => b.text.includes('if'));
    console.log('[AI PROMPT DEBUG] Has sensors:', hasSensors, 'Has conditionals:', hasConditionals);

    // Use language-specific prompt generation
    const prompt = getLanguageSpecificPrompt(pickedSymptom, lang, summary, programFlow, blockSummary, blockAnalysis, diagnosticInsights);
    // End of conditional prompt structure

    // CRITICAL DEBUG: Track exactly what the AI is seeing for caching consistency
    console.log(`[AI PROMPT DEBUG] Sending to AI - Sensor count: ${blockAnalysis.sensors.length}`);
    console.log(`[AI PROMPT DEBUG] Sensor section in prompt:`, {
      sensorCount: blockAnalysis.sensors.length,
      sensorTexts: blockAnalysis.sensors.map(s => s.text),
      hasWarning: blockAnalysis.sensors.length > 0 ? 'YES - 重要: 已偵測到感應器設定' : 'NO WARNING'
    });

    // Call OpenAI API
    const openaiResp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { 
            role: "system", 
            content: `You are an expert LEGO SPIKE Prime robotics instructor who diagnoses robot behavior issues using systematic analysis. 

CORE METHODOLOGY:
1. SYMPTOM ANALYSIS: Identify what the robot is actually doing (turning in circles, not moving, wrong distance, etc.)
2. ROOT CAUSE DIAGNOSIS: Find the technical reason in the block configuration
3. SOLUTION RECOMMENDATION: Suggest specific block changes

BEHAVIORAL DIAGNOSTIC FRAMEWORK:
- "Robot turning in circles" → Check motor directions, speeds, port assignments
- "Robot not moving" → Check for movement blocks, motor speeds, program start blocks  
- "Robot stops unexpectedly" → Check for stop blocks, infinite loops, sensor conditions
- "Wrong distance/timing" → Check numerical values, units, loop counts
- "Not responding to sensors" → Check sensor placement in program flow, sensor-motor connections

CONDITIONAL LOGIC ANALYSIS:
- Always describe sensor-motor relationships as cause-effect conditions
- Use conditional phrases: "when sensor detects X, then motor does Y"
- Avoid separating sensor detection from motor actions
- Identify if/then/else structures and explain the complete control flow

RESPONSE RULES:
- Always connect observed behavior to specific block configurations
- Reference actual detected values (motor speeds, ports, directions)  
- Never guess parameters not provided in blocks
- **Focus on the cause-effect relationship between code and robot behavior**
- **For conditional logic: Use "when...then" or "if...then" sentence structures**
- **Avoid listing components separately - show their logical relationships**
- **CRITICAL: If sensor blocks are detected in "增強型積木檢測" section, never claim sensors are missing or unspecified**
- **If sensor blocks exist but aren't working, analyze their integration with control flow instead**
- Use Traditional Mandarin, be encouraging and specific
- Limit responses to 150 characters for main advice, 40 characters for summaries` 
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
    console.error("Error in block analysis:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...headers, 'Content-Type': 'application/json' } }
    );
  }
}
