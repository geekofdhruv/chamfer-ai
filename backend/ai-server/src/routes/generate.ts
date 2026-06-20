import type { Request, Response } from 'express';
import { generateCadQueryCodeStream, classifyError, buildValidationFeedback, extractClarification } from '../services/llm';
import { config } from '../config';

const MAX_RETRIES = 3;

async function callCadServer(endpoint: string, body: Record<string, unknown>) {
  const res = await fetch(`${config.cadServerUrl}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

function sendSSE(res: Response, event: string, data: unknown) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

interface CadResult {
  success: boolean;
  error?: string;
  parameters?: unknown[];
  has_stl?: boolean;
  has_step?: boolean;
  has_glb?: boolean;
  stl_base64?: string;
  step_base64?: string;
  glb_base64?: string;
  validation?: {
    volume?: number;
    surface_area?: number;
    bounding_box?: { size?: number[] };
    is_valid?: boolean;
    has_volume?: boolean;
    warnings?: string[];
  };
}

export async function handleGenerate(req: Request, res: Response): Promise<void> {
  const { prompt, history, provider, answers, reasoning: reasoningEnabled } = req.body as {
    prompt?: string;
    history?: { role: string; content: string }[];
    provider?: string;
    answers?: string;
    reasoning?: boolean;
  };

  if (!prompt) { res.status(400).json({ error: 'Prompt is required' }); return; }
  if (provider && !config.providers[provider]) { res.status(400).json({ error: `Unknown provider: ${provider}` }); return; }

  // Build the actual prompt — if user answered clarification questions, combine them
  let effectivePrompt = prompt;
  if (answers) {
    effectivePrompt = `${prompt}\n\nUser answers to clarifying questions:\n${answers}`;
  }

  // SSE setup
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  let code = '';
  let rawResponse = '';
  let reasoning = '';
  let lastError = '';

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    console.log(`[ROUTE] Attempt ${attempt + 1}/${MAX_RETRIES}`);
    sendSSE(res, 'attempt', { attempt: attempt + 1, maxRetries: MAX_RETRIES });

    // Build the error message for retry — combine execution error + validation feedback
    let retryError: string | undefined;
    if (attempt > 0 && lastError) {
      retryError = lastError;
    }

    try {
      const result = await generateCadQueryCodeStream(
        effectivePrompt, history || [],
        attempt > 0 ? code : undefined,
        retryError,
        provider,
        reasoningEnabled === false ? undefined : {
          onReasoning: (chunk) => sendSSE(res, 'reasoning', { chunk }),
          onContent: () => {},
          onDone: (r) => sendSSE(res, 'llm-done', { codeLength: r.code.length }),
          onError: (err) => sendSSE(res, 'llm-error', { error: err }),
        },
      );

      code = result.code;
      rawResponse = result.rawResponse;
      reasoning = result.reasoning;

      // ── Check if the LLM is asking for clarification ──
      if (attempt === 0 && !answers) {
        const questions = extractClarification(rawResponse);
        if (questions && questions.length > 0) {
          console.log(`[ROUTE] LLM requested clarification: ${questions.length} questions`);
          sendSSE(res, 'clarify', { questions, originalPrompt: prompt });
          res.end();
          return;
        }
      }

      if (!code) {
        lastError = 'No Python code found in response';
        sendSSE(res, 'retry', { reason: lastError });
        continue;
      }

      // ── Execute on CAD server ──
      sendSSE(res, 'executing', { message: 'Executing CadQuery...' });

      const cadResult = await callCadServer('/execute', { code }) as CadResult;
      console.log(`[ROUTE] CAD result: success=${cadResult.success}`);

      if (!cadResult.success) {
        // ── Execution error — classify and feed back ──
        const errorMsg = cadResult.error || 'Unknown execution error';
        const { category, hint } = classifyError(errorMsg);
        lastError = errorMsg;
        console.log(`[ROUTE] Error [${category}]: ${errorMsg}`);
        sendSSE(res, 'retry', { reason: errorMsg, category, hint });
        continue;
      }

      // ── Execution succeeded — validate geometry ──
      const validation = cadResult.validation;
      const validationFeedback = buildValidationFeedback(validation);

      if (validationFeedback) {
        // ── Validation found issues — feed back as error for repair ──
        console.log(`[ROUTE] Validation warnings: ${validation?.warnings?.length || 0}`);
        lastError = validationFeedback;
        sendSSE(res, 'validation-warning', { warnings: validation?.warnings || [], validation });
        continue;
      }

      // ── SUCCESS — execution + validation both passed ──
      console.log(`[ROUTE] SUCCESS on attempt ${attempt + 1}`);
      console.log(`[ROUTE] Validation: volume=${validation?.volume}, valid=${validation?.is_valid}`);

      sendSSE(res, 'done', {
        success: true,
        code,
        message: rawResponse,
        reasoning,
        parameters: cadResult.parameters || [],
        provider: provider || '0g',
        hasStl: cadResult.has_stl,
        hasStep: cadResult.has_step,
        hasGlb: cadResult.has_glb,
        stlBase64: cadResult.stl_base64,
        stepBase64: cadResult.step_base64,
        glbBase64: cadResult.glb_base64,
        validation,
      });
      res.end();
      return;

    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`[ROUTE] Error: ${msg}`);
      sendSSE(res, 'error', { error: msg });
      res.end();
      return;
    }
  }

  // ── All retries exhausted ──
  // If we have code but it failed validation, still return it as best-effort
  if (code) {
    console.log(`[ROUTE] Returning best-effort result after ${MAX_RETRIES} attempts`);
    sendSSE(res, 'done', {
      success: true,
      code,
      message: rawResponse,
      reasoning,
      parameters: [],
      provider: provider || '0g',
      hasStl: false,
      hasStep: false,
      hasGlb: false,
      bestEffort: true,
      warning: `Model generated but failed validation after ${MAX_RETRIES} attempts. Last error: ${lastError}`,
    });
  } else {
    sendSSE(res, 'error', { error: `Failed after ${MAX_RETRIES} attempts. Last error: ${lastError}` });
  }
  res.end();
}

export async function handleUpdateParams(req: Request, res: Response): Promise<void> {
  try {
    const { code, params } = req.body as { code?: string; params?: Record<string, number> };
    if (!code) { res.status(400).json({ error: 'Code is required' }); return; }
    if (!params) { res.status(400).json({ error: 'Params are required' }); return; }

    console.log(`[PARAMS] Updating with params: ${JSON.stringify(params)}`);
    const cadResult = await callCadServer('/update-params', { code, params }) as CadResult;
    console.log(`[PARAMS] CAD result: success=${cadResult.success}, has_stl=${cadResult.has_stl}, has_step=${cadResult.has_step}`);

    if (!cadResult.success) {
      console.log(`[PARAMS] Error: ${cadResult.error}`);
      res.status(500).json({ success: false, error: cadResult.error });
      return;
    }

    res.json({
      success: true,
      parameters: cadResult.parameters || [],
      hasStl: cadResult.has_stl, hasStep: cadResult.has_step, hasGlb: cadResult.has_glb,
      stlBase64: cadResult.stl_base64, stepBase64: cadResult.step_base64, glbBase64: cadResult.glb_base64,
      validation: cadResult.validation,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[PARAMS] Exception: ${msg}`);
    res.status(500).json({ success: false, error: msg });
  }
}

export function handleListProviders(_req: Request, res: Response): void {
  const providers = Object.entries(config.providers).map(([id, p]) => ({ id, name: id, hasKey: !!p.apiKey }));
  res.json({ providers });
}
