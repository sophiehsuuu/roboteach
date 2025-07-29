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
      else if (category === 'flippersensors' || 
               text.includes('Sensor') || 
               text.includes('is color') || 
               text.includes('closer than')) {
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
        b.text.includes('is color') ||
        b.text.includes('closer than') ||
        b.category === 'flippersensors'
      )),
      events: blocks.filter(b => b.text && (
        b.text.includes('when program starts') ||
        b.text.includes('when button') ||
        b.text.includes('when') ||
        b.category === 'flipperevents'
      )),
      control: blocks.filter(b => b.text && (
        b.text.includes('if') ||
        b.text.includes('forever') ||
        b.text.includes('repeat') ||
        b.text.includes('while') ||
        b.category === 'flippercontrol' ||
        b.category === 'control'
      )),
      movement: blocks.filter(b => b.text && (
        b.text.includes('Move forward') ||
        b.text.includes('rotations') ||
        b.text.includes('degrees')
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

    // Compose the enhanced LLM prompt for OpenAI
    const prompt = `
你是一位親切又懂樂高SPIKE的機器人輔導老師，專長是根據學生的實際積木數值和機器人行為症狀來進行診斷分析，給明確、鼓勵性的修正建議。

【診斷方法論】
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

【學生描述的問題/症狀】
${summary}

【選擇的主要問題類型】
${pickedSymptom}

【積木偵測摘要】
${blockSummary}

【增強型積木檢測】
• 馬達積木: ${blockAnalysis.motors.length}個 ${blockAnalysis.motors.length > 0 ? '✅' : '⚠️'}
  ${blockAnalysis.motors.map(b => `- ${b.text}`).join('\n  ')}
• 感應器積木: ${blockAnalysis.sensors.length}個 ${blockAnalysis.sensors.length > 0 ? '✅' : '⚠️'}
  ${blockAnalysis.sensors.map(b => `- ${b.text}`).join('\n  ')}
• 事件積木: ${blockAnalysis.events.length}個 ${blockAnalysis.events.length > 0 ? '✅' : '⚠️'}
  ${blockAnalysis.events.map(b => `- ${b.text}`).join('\n  ')}
• 控制積木: ${blockAnalysis.control.length}個 ${blockAnalysis.control.length > 0 ? '✅' : '⚠️'}
  ${blockAnalysis.control.map(b => `- ${b.text}`).join('\n  ')}
• 移動積木: ${blockAnalysis.movement.length}個 ${blockAnalysis.movement.length > 0 ? '✅' : '⚠️'}
  ${blockAnalysis.movement.map(b => `- ${b.text}`).join('\n  ')}

${diagnosticInsights}

${pickedSymptom === 'program-summary' ? `
【程式摘要要求】
請用1-2句話簡潔描述這個程式會讓機器人做什麼：

**重要提醒：請仔細檢查增強型積木檢測中的所有馬達和感應器**
- 如果看到多個馬達（如Motor A和Motor B），都要在摘要中提及
- 如果有感應器和條件判斷，請說明其控制邏輯
- 如果有forever循環，請說明重複的動作

1. 分析程式的執行順序和邏輯流程
2. 描述機器人的具體行為和參數（速度、方向、時間等）
3. 如果有循環或條件判斷，請說明其作用
4. 用簡單易懂的中文描述，適合學生理解
5. 避免用"一連串"、"各種"等抽象詞彙，要具體說明動作

範例：
- "機器人啟動後馬達A、B同時以75%速度啟動，A重複前進1圈，感應器偵測紅色時停止"
- "機器人會無限循環：馬達前進，感應器偵測到障礙物時轉向"
- "機器人執行：雙馬達前進，感應器控制停止條件"

請用繁體中文回覆，不超過50字，**必須提及所有偵測到的馬達和重要邏輯**。
` : `
【診斷要求】
請根據上述積木設定，針對學生描述的問題進行分析：
1. 檢查馬達設定：端口、速度、方向是否正確
2. 檢查感應器設定：類型、參數、條件是否合適
3. 檢查程式結構：是否有開始、循環、停止等控制積木
4. 如果發現參數問題（如速度太低、方向錯誤），請具體指出並建議修正
5. 如果缺少必要積木，請建議添加

【邏輯分析要求】
如果偵測到程式邏輯結構，請額外分析：
1. 程式是否有明確的入口點（如"when program starts"）
2. 是否有無限循環可能導致程式卡住
3. 是否有無法執行的積木（沒有連接的積木）
4. 控制結構的巢狀層級是否合理
5. 積木的執行順序是否符合預期

重點：
- 不能猜測積木沒包含的數值
- 若偵測到馬達速度或感應器值，請直接在建議中引用
- 如缺少關鍵積木，請直接提示對方補上
- 如果發現邏輯問題（無限循環、無法執行的積木），請明確指出

請用繁體中文回覆，篇幅不超過150字，要具體指出問題所在。
`}
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

RESPONSE RULES:
- Always connect observed behavior to specific block configurations
- Reference actual detected values (motor speeds, ports, directions)  
- Never guess parameters not provided in blocks
- Focus on the cause-effect relationship between code and robot behavior
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
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      }
    });
  }
});
