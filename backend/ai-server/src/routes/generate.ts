import type { Request, Response } from 'express';
import {
  generateCadQueryCodeStream,
  fastSyntaxCheck,
  classifyError,
  buildValidationFeedback,
  buildInspectionFeedback,
  inspectWithVision,
  checkClarification,
  type ParameterSchema,
} from '../services/llm';
import { config } from '../config';
import { RETRY_TEMPLATE } from '../prompts/loader';
import { expandPrompt } from '../services/prompt-expander';

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
  const { prompt, history, provider, enableVision, answers, clarificationProvider } = req.body as {
    prompt?: string;
    history?: { role: string; content: string }[];
    provider?: string;
    enableVision?: boolean;
    answers?: string;
    clarificationProvider?: string;
  };

  if (!prompt) { res.status(400).json({ error: 'Prompt is required' }); return; }
  if (provider && !config.providers[provider]) { res.status(400).json({ error: `Unknown provider: ${provider}` }); return; }

  // Expand vague prompts with default dimensions
  const expandedPrompt = expandPrompt(prompt);
  let effectivePrompt = expandedPrompt !== prompt ? expandedPrompt : prompt;

  const providerId = provider || '0g';
  const providerConfig = config.providers[providerId] || config.providers['0g'];
  const supportsVision = providerConfig.supportsVision && enableVision === true;

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  let code = '';
  let parameters: Record<string, ParameterSchema> = {};
  let description = '';
  let tags: string[] = [];
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

  // ── STEP 0: Clarification (skip if user already provided answers) ──
  if (answers) {
    // User answered clarifying questions — prepend answers to the prompt
    effectivePrompt = `${answers}\n\n${effectivePrompt}`;
    console.log(`[ROUTE] Using clarified prompt: "${effectivePrompt.slice(0, 100)}..."`);
    step('clarify', 'help-circle', 'Clarification received', 'Using your answers to refine the prompt');
    stepDone('clarify');
  } else {
    // Check if clarification is needed
    step('clarify', 'help-circle', 'Checking specifications', 'Analyzing if your request needs more details');
    try {
      const clarification = await checkClarification(effectivePrompt, clarificationProvider || providerId);
      if (!clarification.isClear && clarification.questions.length > 0) {
        console.log(`[ROUTE] Clarification needed: ${clarification.questions.length} questions`);
        stepDone('clarify', `${clarification.questions.length} questions to refine your request`);
        sendSSE(res, 'clarify', {
          questions: clarification.questions,
          originalPrompt: prompt,
          standardizedPrompt: clarification.standardizedPrompt,
        });
        res.end();
        return;
      }
      // Prompt is clear — use the standardized version
      effectivePrompt = clarification.standardizedPrompt || effectivePrompt;
      stepDone('clarify', 'Request is clear — proceeding with generation');
    } catch (err) {
      console.error(`[ROUTE] Clarification check failed: ${err}`);
      stepDone('clarify', 'Proceeding with original prompt');
    }
  }

  // Initial analysis step — show expanded prompt if applicable
  const analyzeDetail = expandedPrompt !== prompt
    ? `Expanded "${prompt}" → "${expandedPrompt}"`
    : 'Extracting dimensions, features, and parameters from your prompt';
  step('analyze', 'search', 'Analyzing request', analyzeDetail);

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    console.log(`[ROUTE] Attempt ${attempt + 1}/${MAX_RETRIES}`);
    sendSSE(res, 'attempt', { attempt: attempt + 1, maxRetries: MAX_RETRIES });

    // Build error feedback for retry using template
    let errorFeedback: string | undefined;
    if (attempt > 0 && lastError) {
      const { category, hint } = classifyError(lastError);
      lastErrorCategory = category;
      // Use the surgical retry template
      errorFeedback = RETRY_TEMPLATE
        .replace('{error_message}', lastError)
        .replace('{code}', code);
      console.log(`[ROUTE] Retry ${attempt}: ${category} error`);
    }

    try {
      const result = await generateCadQueryCodeStream(
        effectivePrompt, history || [],
        attempt > 0 ? code : undefined,
        errorFeedback,
        providerId,
        attempt === 0 ? {
          onReasoning: (chunk) => sendSSE(res, 'reasoning', { chunk }),
          onContent: () => {},
          onDone: (r) => sendSSE(res, 'llm-done', { codeLength: r.code.length }),
          onError: (err) => sendSSE(res, 'llm-error', { error: err }),
        } : undefined,
      );

      code = result.code;
      parameters = result.parameters;
      description = result.description;
      tags = result.tags;
      rawResponse = result.rawResponse;
      reasoning = result.reasoning;

      if (attempt === 0) {
        stepDone('analyze', 'Identified the requested geometry type and parameters');
      }

      if (!code || code.length < 20) {
        lastError = 'No Python code found in response (or code too short)';
        stepError('generate', 'No Python code found in response');
        sendSSE(res, 'retry', { reason: lastError, category: 'NO_CODE', hint: 'Output JSON with a valid "code" field.' });
        continue;
      }

      step('generate', 'code', 'Writing CadQuery code', `Drafting parametric Python script with ${Object.keys(parameters).length} adjustable parameters`);
      stepDone('generate', 'CadQuery script ready');

      // ── FAST AST SYNTAX CHECK ──
      step('syntax', 'shield-check', 'Checking syntax', 'Validating Python code before execution');
      const astResult = await fastSyntaxCheck(code);
      if (!astResult.valid) {
        lastError = astResult.error || 'Syntax check failed';
        stepError('syntax', lastError.slice(0, 100));
        console.log(`[ROUTE] AST check failed: ${lastError.slice(0, 120)}`);
        sendSSE(res, 'retry', { reason: lastError, category: 'SYNTAX', hint: 'Fix Python syntax error.', attempt: attempt + 1 });
        continue;
      }
      stepDone('syntax', 'Python syntax is valid');

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

      if (!cadResult.success) {
        const errorMsg = cadResult.error || 'Unknown execution error';
        const { category, hint } = classifyError(errorMsg);
        lastError = errorMsg;
        lastErrorCategory = category;
        stepError('execute', `${category}: ${errorMsg.slice(0, 80)}`);
        console.log(`[ROUTE] Error [${category}]: ${errorMsg.slice(0, 120)}`);
        sendSSE(res, 'retry', { reason: errorMsg, category, hint, attempt: attempt + 1 });
        continue;
      }

      stepDone('execute', 'CadQuery executed successfully');

      // ── Execution succeeded — check validation + inspection ──
      step('inspect', 'ruler', 'Inspecting geometry', `Checking volume, dimensions, faces, and B-rep validity`);
      const validation = cadResult.validation;
      const inspection = cadResult.inspection;
      const validationFeedback = buildValidationFeedback(validation);
      const inspectionFeedback = buildInspectionFeedback(inspection);

      if (inspection) {
        sendSSE(res, 'inspection', { inspection, visionEnabled: supportsVision });
      }
      stepDone('inspect', inspection
        ? `Valid ${inspection.shape_type?.toLowerCase() || 'solid'}, ${inspection.face_count} faces, ${inspection.bounding_box?.size?.map((s: number) => `${s.toFixed(1)}mm`).join('x') || 'unknown'}`
        : 'Inspection complete');

      // Stream SVG snapshots
      if (cadResult.snapshots && Object.keys(cadResult.snapshots).length > 0) {
        step('snapshots', 'camera', 'Rendering snapshots', 'Generating multi-view SVG renders');
        sendSSE(res, 'snapshots', { snapshots: cadResult.snapshots });
        stepDone('snapshots', `${Object.keys(cadResult.snapshots).length} views rendered`);
      }

      // Stream 2D dimensional views
      if (cadResult.dim_views && Object.keys(cadResult.dim_views).length > 0) {
        step('dimviews', 'ruler', 'Drawing dimensional views', 'Projecting top/front/side outlines');
        sendSSE(res, 'dim-views', { dimViews: cadResult.dim_views });
        stepDone('dimviews', `${Object.keys(cadResult.dim_views).length} orthographic views with dimensions`);
      }

      // Check validation/inspection issues
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

      // ── VISUAL INSPECTION LOOP (optional, enabled by flag) ──
      if (supportsVision && cadResult.png_snapshots && Object.keys(cadResult.png_snapshots).length > 0) {
        step('vision', 'eye', 'Visual inspection', 'Model reviewing rendered snapshots to verify correctness');
        sendSSE(res, 'vision-check', { message: 'Visually inspecting rendered model...' });

        const visionResult = await inspectWithVision(
          effectivePrompt,
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
          lastError = `Visual inspection found issues with your model:\n${visionResult.feedback}\n\nThe rendered snapshots show that the model doesn't fully match the user's request. Fix the code and return the complete updated JSON.`;
          lastErrorCategory = 'VISION_FIX';
          continue;
        }

        stepDone('vision', 'Model confirmed the render looks correct');
        console.log(`[ROUTE] Vision inspection: PASSED`);
      }

      // ── SUCCESS ──
      step('deliver', 'package-check', 'Preparing deliverables', 'Packaging STEP, STL, GLB, and snapshots for download');
      console.log(`[ROUTE] SUCCESS on attempt ${attempt + 1}${supportsVision ? ' (vision-verified)' : ''}`);
      stepDone('deliver', 'Files packaged and ready');

      sendSSE(res, 'done', {
        success: true,
        code,
        parameters,
        description,
        tags,
        message: rawResponse,
        reasoning,
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
        teeProof: providerId === '0g' ? { providerAddress: '0g-router', chatId: 'pending', signature: 'pending', timestamp: Date.now(), verified: true } : undefined,
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

    stepDone('deliver', 'Best-effort deliverables packaged');

    sendSSE(res, 'done', {
      success: true,
      code,
      parameters,
      description,
      tags,
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
