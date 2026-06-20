import type { Request, Response } from 'express';
import {
  generateCadQueryCodeStream,
  classifyError,
  buildValidationFeedback,
  buildInspectionFeedback,
  extractClarification,
  inspectWithVision,
} from '../services/llm';
import { config } from '../config';

const MAX_RETRIES = 4;

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
  inspection?: {
    shape_type?: string;
    face_count?: number;
    edge_count?: number;
    vertex_count?: number;
    volume?: number;
    surface_area?: number;
    has_volume?: boolean;
    is_valid?: boolean;
    is_solid?: boolean;
    bounding_box?: { size?: number[]; min?: number[]; max?: number[]; center?: number[] };
    center_of_mass?: number[];
    warnings?: string[];
    errors?: string[];
    all_clear?: boolean;
  };
  snapshots?: Record<string, string>;
  png_snapshots?: Record<string, string>;
  dim_views?: Record<string, string>;
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

  const providerId = provider || '0g';
  const providerConfig = config.providers[providerId] || config.providers['0g'];
  const supportsVision = providerConfig.supportsVision;

  let effectivePrompt = prompt;
  if (answers) {
    effectivePrompt = `${prompt}\n\nUser answers to clarifying questions:\n${answers}`;
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  let code = '';
  let rawResponse = '';
  let reasoning = '';
  let lastError = '';
  let lastErrorCategory = '';

  // ── Helper to emit structured workflow steps ──
  const step = (id: string, icon: string, label: string, detail: string, status: 'running' | 'done' | 'error' = 'running') => {
    sendSSE(res, 'step', { id, icon, label, detail, status });
  };
  const stepDone = (id: string, detail?: string) => {
    sendSSE(res, 'step', { id, status: 'done', detail });
  };
  const stepError = (id: string, detail: string) => {
    sendSSE(res, 'step', { id, status: 'error', detail });
  };

  // Initial analysis step
  step('analyze', 'search', 'Analyzing request', 'Extracting dimensions, features, and parameters from your prompt');

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    console.log(`[ROUTE] Attempt ${attempt + 1}/${MAX_RETRIES}`);
    sendSSE(res, 'attempt', { attempt: attempt + 1, maxRetries: MAX_RETRIES });

    // ── Build error feedback for retry ──
    let errorFeedback: string | undefined;
    if (attempt > 0 && lastError) {
      const { category, hint, priority } = classifyError(lastError);
      lastErrorCategory = category;
      errorFeedback = `Your previous code failed with a ${category} error (priority: ${priority}):\n\nERROR: ${lastError}\n\nREPAIR HINT:\n${hint}\n\nFix the code and return the complete updated script. Make the SMALLEST change that fixes the error — do not rewrite the entire model.`;
    }

    try {
      const result = await generateCadQueryCodeStream(
        effectivePrompt, history || [],
        attempt > 0 ? code : undefined,
        errorFeedback,
        providerId,
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

      if (attempt === 0) {
        stepDone('analyze', 'Identified the requested geometry type and parameters');
      }

      // ── Check for clarification request ──
      if (attempt === 0 && !answers) {
        const clarification = extractClarification(rawResponse);
        if (clarification && clarification.length > 0) {
          step('clarify', 'help-circle', 'Clarifying details', `Asking ${clarification.length} questions to fill missing critical specs`);
          console.log(`[ROUTE] LLM requested clarification: ${clarification.length} questions`);
          sendSSE(res, 'clarify', { questions: clarification, originalPrompt: prompt });
          res.end();
          return;
        }
      }

      if (!code || code.length < 20) {
        lastError = 'No Python code found in response (or code too short)';
        stepError('generate', 'No Python code found in response');
        sendSSE(res, 'retry', { reason: lastError, category: 'NO_CODE', hint: 'Output only Python code in a ```python block.' });
        continue;
      }

      step('generate', 'code', 'Writing CadQuery code', `Drafting parametric Python script with named parameters and export calls`);
      stepDone('generate', 'CadQuery script ready');

      // ── Execute on CAD server ──
      const wantSvgSnapshots = attempt === 0 || attempt === MAX_RETRIES - 1;
      const wantPngSnapshots = supportsVision;
      step('execute', 'cpu', 'Executing CadQuery', `Running code in sandbox${wantPngSnapshots ? ' and rendering snapshots for visual inspection' : ''}`);
      sendSSE(res, 'executing', {
        message: `Executing CadQuery...${wantPngSnapshots ? ' (with visual inspection)' : wantSvgSnapshots ? ' (rendering snapshots)' : ''}`,
        visionEnabled: supportsVision,
      });

      const cadResult = await callCadServer('/execute', {
        code,
        render_snapshots: wantSvgSnapshots,
        render_png: wantPngSnapshots,
        render_dim_views: true,
      }) as CadResult;

      console.log(`[ROUTE] CAD result: success=${cadResult.success}`);
      console.log(`[ROUTE] dim_views keys: ${Object.keys(cadResult.dim_views || {}).join(',') || 'NONE'}`);
      console.log(`[ROUTE] snapshots keys: ${Object.keys(cadResult.snapshots || {}).join(',') || 'NONE'}`);

      if (!cadResult.success) {
        const errorMsg = cadResult.error || 'Unknown execution error';
        const { category, hint, priority } = classifyError(errorMsg);
        lastError = errorMsg;
        lastErrorCategory = category;
        stepError('execute', `${category}: ${errorMsg.slice(0, 80)}`);
        console.log(`[ROUTE] Error [${category}] (${priority}): ${errorMsg.slice(0, 120)}`);
        sendSSE(res, 'retry', { reason: errorMsg, category, hint, priority, attempt: attempt + 1 });
        continue;
      }

      stepDone('execute', 'CadQuery executed successfully');

      // ── Execution succeeded — check validation + inspection ──
      step('inspect', 'ruler', 'Inspecting geometry', `Checking volume, dimensions, faces, and B-rep validity`);
      const validation = cadResult.validation;
      const inspection = cadResult.inspection;
      const validationFeedback = buildValidationFeedback(validation);
      const inspectionFeedback = buildInspectionFeedback(inspection);

      // ── Stream inspection data to frontend ──
      if (inspection) {
        sendSSE(res, 'inspection', { inspection, visionEnabled: supportsVision });
      }
      // Always mark the inspection step done so the timeline never gets stuck
      stepDone('inspect', inspection
        ? `Valid ${inspection.shape_type?.toLowerCase() || 'solid'}, ${inspection.face_count} faces, ${inspection.bounding_box?.size?.map((s: number) => `${s.toFixed(1)}mm`).join('x') || 'unknown'}`
        : 'Inspection complete');

      // ── Stream SVG snapshots to frontend ──
      if (cadResult.snapshots && Object.keys(cadResult.snapshots).length > 0) {
        step('snapshots', 'camera', 'Rendering snapshots', 'Generating multi-view SVG renders for visual review');
        sendSSE(res, 'snapshots', { snapshots: cadResult.snapshots });
        stepDone('snapshots', `${Object.keys(cadResult.snapshots).length} views rendered`);
      }

      // ── Stream 2D dimensional views to frontend ──
      if (cadResult.dim_views && Object.keys(cadResult.dim_views).length > 0) {
        step('dimviews', 'ruler', 'Drawing dimensional views', 'Projecting top/front/side outlines with overall dimensions');
        sendSSE(res, 'dim-views', { dimViews: cadResult.dim_views });
        stepDone('dimviews', `${Object.keys(cadResult.dim_views).length} orthographic views with dimensions`);
      }

      // ── Check if validation or inspection found critical issues ──
      const hasInspectionErrors = inspection?.errors && inspection.errors.length > 0;
      const hasValidationWarnings = validationFeedback.length > 0;

      if (hasInspectionErrors || hasValidationWarnings) {
        const allFeedback = [inspectionFeedback, validationFeedback]
          .filter(f => f.length > 0)
          .join('\n\n');

        if (allFeedback.length > 0 && attempt < MAX_RETRIES - 1) {
          console.log(`[ROUTE] Validation/inspection issues — feeding back to LLM`);
          step('repair', 'wrench', 'Repairing model', `Fixing ${inspection?.errors?.length || 0} geometry issues and retrying`);
          lastError = allFeedback;
          sendSSE(res, 'validation-warning', {
            warnings: validation?.warnings || [],
            inspection,
          });
          continue;
        }
      }

      // ── VISUAL INSPECTION LOOP (vision-capable providers only) ──
      if (supportsVision && cadResult.png_snapshots && Object.keys(cadResult.png_snapshots).length > 0) {
        step('vision', 'eye', 'Visual inspection', 'Model reviewing rendered snapshots to verify correctness');
        sendSSE(res, 'vision-check', { message: 'Visually inspecting rendered model...' });

        const visionResult = await inspectWithVision(
          prompt,
          code,
          cadResult.png_snapshots,
          inspection,
          providerId,
        );

        sendSSE(res, 'vision-result', {
          needsFix: visionResult.needsFix,
          feedback: visionResult.feedback,
        });

        if (visionResult.needsFix && attempt < MAX_RETRIES - 1) {
          console.log(`[ROUTE] Vision inspection: NEEDS_FIX — ${visionResult.feedback.slice(0, 120)}`);
          step('vision', 'eye', 'Visual inspection', `Model found issues: ${visionResult.feedback.slice(0, 60)}`, 'error');
          lastError = `Visual inspection found issues with your model:\n${visionResult.feedback}\n\nThe rendered snapshots show that the model doesn't fully match the user's request. Fix the code and return the complete updated script.`;
          lastErrorCategory = 'VISION_FIX';
          continue;
        }

        stepDone('vision', 'Model confirmed the render looks correct');
        console.log(`[ROUTE] Vision inspection: PASSED`);
      }

      // ── SUCCESS — everything passed (including visual inspection if enabled) ──
      step('deliver', 'package-check', 'Preparing deliverables', 'Packaging STEP, STL, GLB, and snapshots for download');
      console.log(`[ROUTE] SUCCESS on attempt ${attempt + 1}${supportsVision ? ' (vision-verified)' : ''}`);
      console.log(`[ROUTE] Inspection: ${inspection?.bounding_box?.size?.join('x')}mm, ${inspection?.face_count} faces, valid=${inspection?.is_valid}`);
      stepDone('deliver', 'Files packaged and ready');

      sendSSE(res, 'done', {
        success: true,
        code,
        message: rawResponse,
        reasoning,
        parameters: cadResult.parameters || [],
        provider: providerId,
        hasStl: cadResult.has_stl,
        hasStep: cadResult.has_step,
        hasGlb: cadResult.has_glb,
        stlBase64: cadResult.stl_base64,
        stepBase64: cadResult.step_base64,
        glbBase64: cadResult.glb_base64,
        validation,
        inspection,
        snapshots: cadResult.snapshots || {},
        dimViews: cadResult.dim_views || {},
        visionVerified: supportsVision,
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
  if (code) {
    console.log(`[ROUTE] Returning best-effort result after ${MAX_RETRIES} attempts. Last error: ${lastErrorCategory}`);
    let bestEffortData: any = {};
    try {
      const finalResult = await callCadServer('/execute', {
        code,
        render_snapshots: true,
        render_png: false,
        render_dim_views: true,
      }) as CadResult;
      if (finalResult.success) {
        bestEffortData = {
          hasStl: finalResult.has_stl,
          hasStep: finalResult.has_step,
          hasGlb: finalResult.has_glb,
          stlBase64: finalResult.stl_base64,
          stepBase64: finalResult.step_base64,
          glbBase64: finalResult.glb_base64,
          parameters: finalResult.parameters || [],
          validation: finalResult.validation,
          inspection: finalResult.inspection,
          snapshots: finalResult.snapshots || {},
          dimViews: finalResult.dim_views || {},
        };
        if (finalResult.inspection) sendSSE(res, 'inspection', { inspection: finalResult.inspection });
        if (finalResult.snapshots) sendSSE(res, 'snapshots', { snapshots: finalResult.snapshots });
        if (finalResult.dim_views) sendSSE(res, 'dim-views', { dimViews: finalResult.dim_views });
      }
    } catch {}

    // Mark any remaining workflow steps as done before the final payload
    stepDone('deliver', 'Best-effort deliverables packaged');

    sendSSE(res, 'done', {
      success: true,
      code,
      message: rawResponse,
      reasoning,
      provider: providerId,
      bestEffort: true,
      warning: `Model generated but had issues after ${MAX_RETRIES} attempts. Last error category: ${lastErrorCategory}.`,
      ...bestEffortData,
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
    const cadResult = await callCadServer('/update-params', {
      code,
      params,
      render_snapshots: true,
      render_png: false,
      render_dim_views: true,
    }) as CadResult;
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
      inspection: cadResult.inspection,
      snapshots: cadResult.snapshots || {},
      dimViews: cadResult.dim_views || {},
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[PARAMS] Exception: ${msg}`);
    res.status(500).json({ success: false, error: msg });
  }
}

export function handleListProviders(_req: Request, res: Response): void {
  const providers = Object.entries(config.providers).map(([id, p]) => ({
    id,
    name: id,
    hasKey: !!p.apiKey,
    supportsVision: p.supportsVision,
  }));
  res.json({ providers });
}
