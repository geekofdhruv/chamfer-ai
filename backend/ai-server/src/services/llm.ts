import OpenAI from 'openai';
import { config } from '../config';
import { SYSTEM_PROMPT } from './prompt';
import { CLARIFIER_SYSTEM_PROMPT } from './clarifier-prompt';

// ─── Code Extraction ─────────────────────────────────────────────────
export function extractPythonCode(text: string): string {
  const boxedMatch = text.match(/\\boxed\{```python\n([\s\S]*?)```\}/);
  if (boxedMatch) return boxedMatch[1].trim();
  const codeMatch = text.match(/```python\n([\s\S]*?)```/);
  if (codeMatch) return codeMatch[1].trim();
  return text.trim();
}

// ─── Structured Clarification Extraction ────────────────────────────
export interface ClarificationOption {
  question: string;
  key: string;
  options: string[];
  default: string;
}

export function extractClarification(text: string): ClarificationOption[] | null {
  const match = text.match(/```clarify\n([\s\S]*?)```/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[1].trim());

    // Legacy format: { questions: ["string", "string"] } — check first
    if (parsed.questions && Array.isArray(parsed.questions) && typeof parsed.questions[0] === 'string') {
      return parsed.questions.slice(0, 3).map((q: string, i: number) => ({
        question: q,
        key: `q${i}`,
        options: [],
        default: '',
      }));
    }

    // Structured format: { questions: [{ question, key, options, default }] }
    if (parsed.questions && Array.isArray(parsed.questions)) {
      return parsed.questions.map((q: any) => ({
        question: q.question || q.text || '',
        key: q.key || q.question || '',
        options: Array.isArray(q.options) ? q.options : [],
        default: q.default || q.options?.[0] || '',
      }));
    }
  } catch {}
  return null;
}

// ─── Proactive Clarification Agent ──────────────────────────────────
//
// Always runs before code generation. Uses a cheap model (mimo-v2.5) to
// check if the prompt is clear enough to generate a valid CAD model.
// If ambiguous, returns questions. If clear, returns the standardized prompt.

export interface ClarificationResult {
  isClear: boolean;
  questions?: ClarificationOption[];
  standardizedPrompt: string;
  rawResponse: string;
}

export async function checkClarification(
  prompt: string,
  providerId?: string,
): Promise<ClarificationResult> {
  // Use the cheapest model for clarification
  const clarifyProviderId = 'mimo';
  const provider = config.providers[clarifyProviderId];
  const llm = new OpenAI({ apiKey: provider.apiKey, baseURL: provider.baseUrl });

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: 'system', content: CLARIFIER_SYSTEM_PROMPT },
    { role: 'user', content: `Analyze this CAD generation prompt:\n\n${prompt}` },
  ];

  console.log(`[CLARIFIER] Checking prompt with ${clarifyProviderId}...`);

  try {
    const response = await llm.chat.completions.create({
      model: provider.model,
      messages,
      temperature: 0.1,
    });

    const rawResponse = response.choices[0]?.message?.content || '';
    console.log(`[CLARIFIER] Response length: ${rawResponse.length} chars`);
    console.log(`[CLARIFIER] Response preview: ${rawResponse.slice(0, 300)}`);

    // Parse JSON response
    let parsed: any;
    try {
      // Extract JSON from response (handle ```json blocks)
      const jsonMatch = rawResponse.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/) ||
                         rawResponse.match(/(\{[\s\S]*\})/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[1]);
        console.log(`[CLARIFIER] Parsed JSON:`, JSON.stringify(parsed).slice(0, 200));
      } else {
        console.log(`[CLARIFIER] No JSON found in response`);
      }
    } catch (e) {
      console.log(`[CLARIFIER] Failed to parse JSON: ${e}`);
    }

    if (!parsed) {
      return { isClear: true, standardizedPrompt: prompt, rawResponse };
    }

    // Extract questions first — if questions exist, prompt is ALWAYS ambiguous
    const questions: ClarificationOption[] = (parsed.questions || []).map((q: any) => ({
      question: q.question || '',
      key: q.key || q.question || '',
      options: Array.isArray(q.options) ? q.options : [],
      default: q.default || q.options?.[0] || '',
    }));

    // If model returned questions, treat as ambiguous regardless of is_clear
    if (questions.length > 0) {
      console.log(`[CLARIFIER] Found ${questions.length} clarifying questions`);
      return {
        isClear: false,
        questions,
        standardizedPrompt: prompt,
        rawResponse,
      };
    }

    // No questions — check is_clear flag
    if (parsed.is_clear === true || parsed.is_clear === undefined) {
      return {
        isClear: true,
        standardizedPrompt: parsed.standardized_prompt || prompt,
        rawResponse,
      };
    }

    // is_clear is false but no questions — treat as clear
    return {
      isClear: true,
      standardizedPrompt: parsed.standardized_prompt || prompt,
      rawResponse,
    };
  } catch (e: unknown) {
    const err = e as any;
    console.error(`[CLARIFIER] Error: ${err.message}`);
    // On error, skip clarification and proceed with original prompt
    return { isClear: true, standardizedPrompt: prompt, rawResponse: '' };
  }
}
//
// Instead of generic categories, we parse the actual error message to
// identify the specific failure pattern and give a targeted repair hint
// that tells the LLM exactly what to change.

interface FailureClass {
  category: string;
  hint: string;
  priority: 'critical' | 'high' | 'medium';
}

interface ErrorPattern {
  patterns: string[];
  failure: FailureClass;
}

const ERROR_PATTERNS: ErrorPattern[] = [
  // ── Compound/iterable errors ──
  {
    patterns: ['must be an iterable', 'argument after * must be'],
    failure: {
      category: 'COMPOUND_ITERABLE',
      priority: 'critical',
      hint: 'A function expected a list/tuple but got a single value. Common causes:\n'
        + '1. .translate((x, y, z)) — pass ONE tuple, not three floats\n'
        + '2. .rotate((0,0,0), (0,0,1), 90) — pass two tuples + angle, not individual floats\n'
        + '3. cq.Compound.makeCompound() — pass a list of shapes: [shape1, shape2]\n'
        + '4. .pushPoints() — pass a list of tuples: [(x1,y1), (x2,y2)]\n'
        + 'Check every method call that takes positional args and ensure tuples/lists are used.',
    },
  },

  // ── Build order errors ──
  {
    patterns: ['no pending wires', 'no solid to cut from', 'cannot compound'],
    failure: {
      category: 'BUILD_ORDER',
      priority: 'critical',
      hint: 'You called an operation that needs a solid before creating one. Fix:\n'
        + '1. ALWAYS extrude/create a solid BEFORE cutting, filleting, or boolean ops\n'
        + '2. If drawing a custom profile, call .close() before .extrude()\n'
        + '3. For boolean ops: body1 = create_solid(); body2 = create_solid(); result = body1.cut(body2)',
    },
  },
  {
    patterns: ['no wire to close', 'cannot close wire'],
    failure: {
      category: 'WIRE_NOT_CLOSED',
      priority: 'critical',
      hint: 'You called .close() or .extrude() on an unclosed profile. Fix:\n'
        + '1. Ensure the profile starts with .moveTo() or .moveTo()\n'
        + '2. The last .lineTo() should connect back to the start point, OR call .close() to auto-close\n'
        + '3. Never call .extrude() without .close() on custom profiles',
    },
  },
  {
    patterns: ['no start point specified', 'cannot close'],
    failure: {
      category: 'NO_START_POINT',
      priority: 'critical',
      hint: 'You called .close() without any preceding .moveTo() to set a start point. Fix:\n'
        + '1. ALWAYS start a custom profile with .moveTo(x, y) before any .lineTo() or .close()\n'
        + '2. If using a loop to build points, ensure the first point is set with .moveTo()\n'
        + '3. Example: wp.moveTo(pts[0][0], pts[0][1]); for p in pts[1:]: wp.lineTo(p[0], p[1]); wp.close().extrude(h)\n'
        + '4. Do NOT call .close() on an empty Workplane — build the wire first',
    },
  },

  // ── Fillet/chamfer errors ──
  {
    patterns: ['no suitable edges', 'standard failure: make-fillet', 'standard failure: make-chamfer'],
    failure: {
      category: 'FILLET_CHAMFER',
      priority: 'high',
      hint: 'The fillet/chamfer failed because the radius is too large or no edges match the selector. Fix:\n'
        + '1. Reduce the radius to less than HALF the smallest adjacent face dimension\n'
        + '2. Use a more specific selector: .edges(">Z") for top edges, .edges("%CIRCLE") for circular edges\n'
        + '3. Apply fillets/chamfers LAST — after all cuts and holes\n'
        + '4. If the edge doesn\'t exist, the topology may have changed after a boolean op — reselect by axis/position\n'
        + '5. If all else fails, REMOVE the fillet/chamfer — a valid part without fillets is better than a crashed one',
    },
  },
  {
    patterns: ['all edges failed to fillet'],
    failure: {
      category: 'FILLET_ALL_FAILED',
      priority: 'high',
      hint: 'Every edge selected for filleting failed. The radius is definitely too large. Fix:\n'
        + '1. Set radius = min(face_dimensions) * 0.3 as a safe default\n'
        + '2. Or remove fillets entirely — they are cosmetic, not structural',
    },
  },

  // ── Boolean operation errors ──
  {
    patterns: ['null topods', 'boolean operation failed', 'cut from a null'],
    failure: {
      category: 'BOOLEAN_FAILURE',
      priority: 'critical',
      hint: 'A boolean operation (union/cut/intersect) failed. Common causes:\n'
        + '1. The two solids DON\'T overlap — check positions. For cuts, the tool solid must extend THROUGH the target\n'
        + '2. Overlap the tool by at least 1mm beyond the target surface\n'
        + '3. For through-holes: make the cutting cylinder LONGER than the part thickness (e.g., extrude 3x the depth)\n'
        + '4. Ensure both operands are SOLIDS (not wires/faces) — extrude both before boolean ops',
    },
  },

  // ── API misuse ──
  {
    patterns: ['has no attribute', 'attributeerror'],
    failure: {
      category: 'API_ERROR',
      priority: 'high',
      hint: 'You used a non-existent CadQuery method or attribute. Common mistakes:\n'
        + '1. .scale() does NOT exist on Workplane — multiply coordinates instead\n'
        + '2. Use only documented CadQuery methods\n'
        + '3. Check the CadQuery API reference for correct method signatures',
    },
  },
  {
    patterns: ['cq.math', "module 'cadquery' has no attribute 'math'"],
    failure: {
      category: 'API_ERROR',
      priority: 'high',
      hint: 'NEVER use cq.math — it does not exist. Use Python\'s built-in math module:\n'
        + 'import math; use math.sin(), math.cos(), math.radians(), math.sqrt() etc.',
    },
  },

  // ── Variable errors ──
  {
    patterns: ["'r' not in dir", 'no variable'],
    failure: {
      category: 'MISSING_R',
      priority: 'critical',
      hint: 'The code must assign the final 3D model to variable r. Add:\n'
        + 'r = <your final workplane or shape>',
    },
  },

  // ── Syntax errors ──
  {
    patterns: ['syntaxerror', 'indentationerror'],
    failure: {
      category: 'SYNTAX',
      priority: 'medium',
      hint: 'Python syntax error. Check:\n'
        + '1. Indentation consistency\n'
        + '2. Missing colons after if/for/while/def\n'
        + '3. Unclosed parentheses, brackets, or strings',
    },
  },

  // ── Type errors ──
  {
    patterns: ['typeerror', 'argument', 'takes', 'must be an iterable'],
    failure: {
      category: 'TYPE_ERROR',
      priority: 'high',
      hint: 'Wrong argument types. Common causes:\n'
        + '1. .translate() needs ONE tuple: .translate((x, y, z))\n'
        + '2. .rotate() needs (start, end, angle): .rotate((0,0,0), (0,0,1), 90)\n'
        + '3. Don\'t pass floats where tuples are expected',
    },
  },

  // ── Selector errors ──
  {
    patterns: ['selector', 'no faces', 'no edges'],
    failure: {
      category: 'SELECTOR',
      priority: 'medium',
      hint: 'The selector found no matching faces/edges. Fix:\n'
        + '1. ">Z" selects top face, "<Z" bottom, "|Z" vertical faces\n'
        + '2. "%CIRCLE" selects circular edges\n'
        + '3. If topology changed after boolean op, reselect by axis/position',
    },
  },

  // ── Wire topology errors ──
  {
    patterns: ['wire', 'brep', 'topods', 'standard_failure'],
    failure: {
      category: 'WIRE_TOPOLOGY',
      priority: 'high',
      hint: 'The 2D profile has topology issues. Fix:\n'
        + '1. Ensure .close() is called before .extrude()\n'
        + '2. Check for self-intersecting wires\n'
        + '3. For complex profiles, decompose into simpler shapes and use boolean operations',
    },
  },

  // ── Runtime errors ──
  {
    patterns: ['assert', 'runtimeerror'],
    failure: {
      category: 'RUNTIME',
      priority: 'medium',
      hint: 'CadQuery internal assertion failed. Check:\n'
        + '1. Extrude values are positive\n'
        + '2. Hole diameters are smaller than the face\n'
        + '3. Boolean operands actually overlap',
    },
  },

  // ── Math errors ──
  {
    patterns: ['zerodivision', 'division by zero', 'math domain'],
    failure: {
      category: 'MATH_ERROR',
      priority: 'medium',
      hint: 'Math domain error — likely caused by sqrt of negative, log of zero, or division by zero.\n'
        + 'Check your math expressions and ensure input values are valid.',
    },
  },

  // ── Import errors ──
  {
    patterns: ['import', 'modulenotfounderror'],
    failure: {
      category: 'IMPORT_ERROR',
      priority: 'medium',
      hint: 'Missing import. Only cadquery and math are available.\n'
        + 'Do not import any other modules.',
    },
  },
];

export function classifyError(error: string): { category: string; hint: string; priority: string } {
  const e = error.toLowerCase();

  for (const { patterns, failure } of ERROR_PATTERNS) {
    if (patterns.some(p => e.includes(p))) {
      return { category: failure.category, hint: failure.hint, priority: failure.priority };
    }
  }

  return {
    category: 'UNKNOWN',
    hint: 'An unexpected error occurred. Simplify the geometry — use basic primitives (box, cylinder) and boolean operations instead of complex profiles.',
    priority: 'medium',
  };
}

// ─── Inspection Feedback ─────────────────────────────────────────────
export function buildInspectionFeedback(inspection: any): string {
  if (!inspection) return '';

  const parts: string[] = [];

  if (inspection.errors && inspection.errors.length > 0) {
    parts.push('Geometry inspection found errors:');
    for (const err of inspection.errors) {
      parts.push(`- ${err}`);
    }
  }

  if (inspection.warnings && inspection.warnings.length > 0) {
    parts.push('Geometry inspection warnings:');
    for (const w of inspection.warnings) {
      parts.push(`- ${w}`);
    }
  }

  if (parts.length > 0) {
    parts.push('Fix the code and return the complete updated script.');
  }

  return parts.join('\n');
}

// ─── Validation Feedback ─────────────────────────────────────────────
export function buildValidationFeedback(validation: any): string {
  if (!validation) return '';

  const warnings = validation.warnings || [];
  if (warnings.length === 0) return '';

  const parts: string[] = [];
  parts.push('Geometry validation found issues:');

  if (validation.volume === 0 || !validation.has_volume) {
    parts.push('- The model has ZERO volume. This means the code produced surfaces or wires, not a solid. Ensure you use .extrude(), .revolve(), or .box() to create a solid body.');
  }

  if (validation.bounding_box) {
    const size = validation.bounding_box.size;
    if (size && size.some((s: number) => s > 10000)) {
      parts.push(`- The model is very large (${size.join('x')}mm). Check your units — use millimeters.`);
    }
    if (size && size.some((s: number) => s > 0 && s < 0.01)) {
      parts.push(`- The model is very small (${size.join('x')}mm). Check your units — use millimeters.`);
    }
  }

  if (validation.is_valid === false) {
    parts.push('- The shape is not a valid B-rep solid. This can happen with self-intersecting geometry or incomplete boolean operations.');
  }

  for (const w of warnings) {
    if (!parts.some(p => p.includes(w))) parts.push(`- ${w}`);
  }

  parts.push('Fix the code and return the complete updated script.');
  return parts.join('\n');
}

// ─── LLM Streaming Call ──────────────────────────────────────────────
export interface StreamCallbacks {
  onReasoning: (chunk: string) => void;
  onContent: (chunk: string) => void;
  onDone: (result: { code: string; rawResponse: string; reasoning: string }) => void;
  onError: (error: string) => void;
}

export async function generateCadQueryCodeStream(
  prompt: string,
  history: { role: string; content: string }[] = [],
  previousCode?: string,
  errorFeedback?: string,
  providerId?: string,
  callbacks?: StreamCallbacks,
): Promise<{ code: string; rawResponse: string; reasoning: string }> {
  const provider = config.providers[providerId || '0g'] || config.providers['0g'];
  const llm = new OpenAI({ apiKey: provider.apiKey, baseURL: provider.baseUrl });

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: 'system', content: SYSTEM_PROMPT },
  ];

  for (const msg of history) {
    messages.push({ role: msg.role as 'user' | 'assistant', content: msg.content });
  }

  if (previousCode && errorFeedback) {
    messages.push({ role: 'assistant', content: '```python\n' + previousCode + '\n```' });
    messages.push({
      role: 'user',
      content: errorFeedback,
    });
  } else {
    messages.push({ role: 'user', content: prompt });
  }

  const isZeroG = providerId === '0g';
  console.log(`[LLM] Provider: ${providerId || '0g'}, Model: ${provider.model}, Streaming: true`);
  if (errorFeedback) console.log(`[LLM] Retry with feedback: ${errorFeedback.slice(0, 100)}...`);

  // Declare outside try so catch can access partial results
  let fullContent = '';
  let fullReasoning = '';

  try {
    const stream = await llm.chat.completions.create({
      model: provider.model,
      messages,
      ...(isZeroG ? { max_tokens: 4096 } : {}),
      temperature: 0.1,
      stream: true,
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;
      if (!delta) continue;

      const reasoningChunk = (delta as any)?.reasoning_content;
      if (reasoningChunk) {
        fullReasoning += reasoningChunk;
        callbacks?.onReasoning(reasoningChunk);
      }

      const contentChunk = delta?.content;
      if (contentChunk) {
        fullContent += contentChunk;
        callbacks?.onContent(contentChunk);
      }
    }

    const code = extractPythonCode(fullContent);
    console.log(`[LLM] Stream done. Content: ${fullContent.length} chars, Reasoning: ${fullReasoning.length} chars, Code: ${code.length} chars`);
    callbacks?.onDone({ code, rawResponse: fullContent, reasoning: fullReasoning });
    return { code, rawResponse: fullContent, reasoning: fullReasoning };
  } catch (e: unknown) {
    const err = e as any;
    // Handle stream termination gracefully — return what we have so far
    if (err.message === 'terminated' || err.code === 'ECONNRESET' || err.type === 'aborted') {
      console.error(`[LLM] Stream terminated prematurely — returning partial result`);
      const code = extractPythonCode(fullContent || '');
      const result = { code, rawResponse: fullContent || '', reasoning: fullReasoning || '' };
      callbacks?.onDone(result);
      return result;
    }
    const errorMsg = `${err.constructor.name}: ${err.message}`;
    console.error(`[LLM] ERROR: ${errorMsg}`);
    callbacks?.onError(errorMsg);
    throw err;
  }
}

// ─── Visual Inspection (Vision-Capable Models Only) ──────────────────
//
// When the provider supports vision (e.g., Qwen2.5-Omni), we send the
// rendered PNG snapshots back to the LLM so it can SEE the geometry and
// decide if it matches the user's request. This is the key agentic loop
// that adam.new uses — the LLM self-corrects based on visual feedback.

export interface VisionInspectionResult {
  needsFix: boolean;
  feedback: string;
}

export async function inspectWithVision(
  originalPrompt: string,
  code: string,
  pngSnapshots: Record<string, string>,
  inspection: any,
  providerId: string,
): Promise<VisionInspectionResult> {
  const provider = config.providers[providerId] || config.providers['0g'];

  if (!provider.supportsVision) {
    return { needsFix: false, feedback: 'Vision not supported by provider' };
  }

  const llm = new OpenAI({ apiKey: provider.apiKey, baseURL: provider.baseUrl });

  // Build the inspection summary
  const inspectionSummary = inspection
    ? `Bounding box: ${inspection.bounding_box?.size?.join('x') || 'unknown'}mm, Volume: ${inspection.volume?.toFixed(1) || 'unknown'}mm³, Faces: ${inspection.face_count || 'unknown'}, Valid: ${inspection.is_valid}`
    : 'No inspection data available';

  // Build the vision message with images
  const content: any[] = [
    {
      type: 'text',
      text: `You are reviewing a CAD model generated from this request: "${originalPrompt}"

The CadQuery code that generated it:
\`\`\`python
${code}
\`\`\`

Inspection data: ${inspectionSummary}

Please review the rendered snapshots below and check:
1. Does the geometry match the user's request?
2. Are there any obvious defects (missing features, wrong proportions, etc.)?
3. Does the overall shape make sense?

Respond with:
- "PASS" if the model looks correct
- "FIX: <description>" if you see issues that need fixing`,
    },
  ];

  // Add PNG snapshots as images
  for (const [view, b64] of Object.entries(pngSnapshots)) {
    if (b64 && !b64.includes('error')) {
      content.push({
        type: 'image_url',
        image_url: { url: `data:image/png;base64,${b64}` },
      });
    }
  }

  try {
    const response = await llm.chat.completions.create({
      model: provider.model,
      messages: [{ role: 'user', content }],
      temperature: 0.1,
    });

    const responseText = response.choices[0]?.message?.content || '';
    console.log(`[VISION] Response: ${responseText.slice(0, 200)}`);

    if (responseText.toUpperCase().includes('PASS')) {
      return { needsFix: false, feedback: responseText };
    }

    if (responseText.toUpperCase().includes('FIX')) {
      const fixMatch = responseText.match(/FIX:\s*(.*)/i);
      return { needsFix: true, feedback: fixMatch?.[1]?.trim() || responseText };
    }

    // Ambiguous response — treat as pass
    return { needsFix: false, feedback: responseText };
  } catch (e: unknown) {
    const err = e as any;
    console.error(`[VISION] Error: ${err.message}`);
    return { needsFix: false, feedback: `Vision inspection failed: ${err.message}` };
  }
}
