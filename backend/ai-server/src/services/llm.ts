import OpenAI from 'openai';
import { config } from '../config';
import { SYSTEM_PROMPT } from './prompt';

export function extractPythonCode(text: string): string {
  const boxedMatch = text.match(/\\boxed\{```python\n([\s\S]*?)```\}/);
  if (boxedMatch) return boxedMatch[1].trim();
  const codeMatch = text.match(/```python\n([\s\S]*?)```/);
  if (codeMatch) return codeMatch[1].trim();
  return text.trim();
}

export function extractClarification(text: string): string[] | null {
  const match = text.match(/```clarify\n([\s\S]*?)```/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[1].trim());
    if (parsed.questions && Array.isArray(parsed.questions)) {
      return parsed.questions.slice(0, 3);
    }
  } catch {}
  return null;
}

// ─── Error Classification ─────────────────────────────────────────────
export function classifyError(error: string): { category: string; hint: string } {
  const e = error.toLowerCase();

  if (e.includes('no pending wires') || e.includes('no solid') || e.includes('cannot compound')) {
    return { category: 'BUILD_ORDER', hint: 'You must extrude/create a solid BEFORE cutting or boolean operations. Add .close() before .extrude() when drawing custom profiles.' };
  }
  if (e.includes('no suitable edges') || e.includes('fillet') || e.includes('chamfer')) {
    return { category: 'FILLET_CHAMFER', hint: 'The fillet/chamfer radius is too large for the edge. Either reduce the radius to less than half the edge length, use a different edge selector, or remove the fillet/chamfer entirely.' };
  }
  if (e.includes('null topods') || e.includes('boolean') || e.includes('cut from')) {
    return { category: 'BOOLEAN_FAILURE', hint: 'A boolean operation (cut/union/intersect) failed. Check that the two solids actually overlap. Try overshooting the tool solid by 1mm beyond the target face.' };
  }
  if (e.includes('has no attribute') || e.includes('attributeerror')) {
    return { category: 'API_ERROR', hint: 'You used a non-existent CadQuery method. Check the API: .scale() does not exist on Workplane (multiply coordinates instead). Use only documented methods.' };
  }
  if (e.includes('cq.math') || e.includes('module \'cadquery\' has no attribute \'math\'')) {
    return { category: 'API_ERROR', hint: 'NEVER use cq.math. Use Python\'s built-in math module: import math and use math.sin, math.cos, math.radians, etc.' };
  }
  if (e.includes('no variable') || e.includes("'r' not in dir")) {
    return { category: 'MISSING_R', hint: 'The code must assign the final 3D model to variable r. Add: r = <your final workplane>' };
  }
  if (e.includes('syntaxerror') || e.includes('indentationerror')) {
    return { category: 'SYNTAX', hint: 'Python syntax error. Check indentation, missing colons, unclosed parentheses.' };
  }
  if (e.includes('typeerror') || e.includes('argument') || e.includes('takes') || e.includes('must be an iterable')) {
    return { category: 'TYPE_ERROR', hint: 'Wrong argument types. You passed a single float where a tuple/list is expected. Common causes: .rotate() needs (start, end, angle) as (tuple, tuple, float), .translate() needs (x, y, z) as a single tuple, .add() keyword args only. Check every method call signature.' };
  }
  if (e.includes('selector') || e.includes('no faces') || e.includes('no edges')) {
    return { category: 'SELECTOR', hint: 'The selector found no matching faces/edges. Try different selectors: ">Z" (top), "<Z" (bottom), "|Z" (vertical), "%CIRCLE" (circular edges).' };
  }
  if (e.includes('wire') || e.includes('brep') || e.includes('topods') || e.includes('standard_failure')) {
    return { category: 'WIRE_TOPOLOGY', hint: 'The 2D profile has topology issues — likely self-intersecting wires or an unclosed profile. Ensure .close() is called before .extrude(). For complex profiles, decompose into simpler shapes and use boolean operations.' };
  }
  if (e.includes('assert') || e.includes('runtimeerror')) {
    return { category: 'RUNTIME', hint: 'CadQuery internal assertion failed. This usually means invalid geometry operations — check that extrude values are positive, hole diameters are smaller than the face, and boolean operands actually overlap.' };
  }
  if (e.includes('zerodivision') || e.includes('division by zero') || e.includes('math domain')) {
    return { category: 'MATH_ERROR', hint: 'Math domain error — likely caused by sqrt of negative, log of zero, or division by zero in trigonometric calculations. Check your math expressions and ensure input values are valid.' };
  }
  if (e.includes('import') || e.includes('modulenotfounderror')) {
    return { category: 'IMPORT_ERROR', hint: 'Missing import. Only cadquery and math are available. Do not import any other modules.' };
  }
  return { category: 'UNKNOWN', hint: 'An unexpected error occurred. Simplify the geometry — use basic primitives (box, cylinder) and boolean operations instead of complex profiles.' };
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
  errorMessage?: string,
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

  if (previousCode && errorMessage) {
    messages.push({ role: 'assistant', content: '```python\n' + previousCode + '\n```' });

    // Classify the error and provide a targeted repair hint
    const { category, hint } = classifyError(errorMessage);
    messages.push({
      role: 'user',
      content: `Your code failed with a ${category} error:\n\n${errorMessage}\n\nRepair hint: ${hint}\n\nFix the code and return the complete updated script.`,
    });
  } else {
    messages.push({ role: 'user', content: prompt });
  }

  const isZeroG = providerId === '0g';
  console.log(`[LLM] Provider: ${providerId || '0g'}, Model: ${provider.model}, Streaming: true`);
  if (errorMessage) console.log(`[LLM] Retry — Error category: ${classifyError(errorMessage).category}`);

  try {
    const stream = await llm.chat.completions.create({
      model: provider.model,
      messages,
      ...(isZeroG ? { max_tokens: 2048 } : {}),
      temperature: 0.1,
      stream: true,
    });

    let fullContent = '';
    let fullReasoning = '';

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
    const errorMsg = `${err.constructor.name}: ${err.message}`;
    console.error(`[LLM] ERROR: ${errorMsg}`);
    callbacks?.onError(errorMsg);
    throw err;
  }
}
