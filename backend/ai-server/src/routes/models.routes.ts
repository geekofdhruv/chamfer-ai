import express from 'express';
import { authMiddleware } from '../middleware/auth';
import {
  saveModelMetadata,
  getSavedModels,
  getSavedModel,
  deleteSavedModel,
  markModelUploadPending,
  markModelUploadComplete,
  markModelUploadFailed,
  getLatestModelForSession,
} from '../services/db';
import { uploadTo0G, fetchFrom0G } from '../services/zgStorage';

export const router = express.Router();

router.post('/upload-to-0g', authMiddleware, async (req, res) => {
  try {
    const walletAddress = (req as any).walletAddress;
    const {
      chatSessionId,
      messageOrder,
      name,
      code,
      stlBase64,
      stepBase64,
      glbBase64,
      dimViews,
      parameters,
      inspection,
      boundingBox,
    } = req.body;

    if (!chatSessionId || messageOrder === undefined || !code) {
      res.status(400).json({ error: 'chatSessionId, messageOrder, and code are required' });
      return;
    }

    const modelName = name || `Iteration ${Number(messageOrder) + 1}`;
    const msgOrder = Number(messageOrder);

    console.log(`[0G] Upload request received — session ${chatSessionId} message ${msgOrder}`);

    // SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const sendEvent = (data: Record<string, unknown>) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    await markModelUploadPending(walletAddress, {
      name: modelName,
      chatSessionId,
      messageOrder: msgOrder,
      parameters,
      inspection,
      boundingBox,
    });

    const rootHashes: { code?: string; stl?: string; step?: string; glb?: string; dimViews?: string } = {};
    const txSeqs: { code?: number; stl?: number; step?: number; glb?: number; dimViews?: number } = {};

    try {
      // Upload 1/5: Code
      sendEvent({ type: 'progress', file: 'code', label: 'Code', status: 'uploading', step: 1, total: 5 });
      console.log(`[0G] Upload 1/5 (code) initiated...`);
      const codeResult = await uploadTo0G(code, false);
      rootHashes.code = codeResult.rootHash;
      txSeqs.code = codeResult.txSeq;
      sendEvent({ type: 'progress', file: 'code', label: 'Code', status: 'done', rootHash: codeResult.rootHash, txSeq: codeResult.txSeq, step: 1, total: 5 });
      console.log(`[0G] Upload 1/5 (code) successful: ${rootHashes.code} (seq=${codeResult.txSeq})`);

      // Upload 2/5: STL
      if (stlBase64) {
        sendEvent({ type: 'progress', file: 'stl', label: 'STL', status: 'uploading', step: 2, total: 5 });
        console.log(`[0G] Upload 2/5 (STL) initiated...`);
        const stlResult = await uploadTo0G(stlBase64, true);
        rootHashes.stl = stlResult.rootHash;
        txSeqs.stl = stlResult.txSeq;
        sendEvent({ type: 'progress', file: 'stl', label: 'STL', status: 'done', rootHash: stlResult.rootHash, txSeq: stlResult.txSeq, step: 2, total: 5 });
        console.log(`[0G] Upload 2/5 (STL) successful: ${rootHashes.stl} (seq=${stlResult.txSeq})`);
      } else {
        sendEvent({ type: 'progress', file: 'stl', label: 'STL', status: 'skipped', step: 2, total: 5 });
        console.log(`[0G] Upload 2/5 (STL) skipped — no data`);
      }

      // Upload 3/5: STEP
      if (stepBase64) {
        sendEvent({ type: 'progress', file: 'step', label: 'STEP', status: 'uploading', step: 3, total: 5 });
        console.log(`[0G] Upload 3/5 (STEP) initiated...`);
        const stepResult = await uploadTo0G(stepBase64, true);
        rootHashes.step = stepResult.rootHash;
        txSeqs.step = stepResult.txSeq;
        sendEvent({ type: 'progress', file: 'step', label: 'STEP', status: 'done', rootHash: stepResult.rootHash, txSeq: stepResult.txSeq, step: 3, total: 5 });
        console.log(`[0G] Upload 3/5 (STEP) successful: ${rootHashes.step} (seq=${stepResult.txSeq})`);
      } else {
        sendEvent({ type: 'progress', file: 'step', label: 'STEP', status: 'skipped', step: 3, total: 5 });
        console.log(`[0G] Upload 3/5 (STEP) skipped — no data`);
      }

      // Upload 4/5: GLB
      if (glbBase64) {
        sendEvent({ type: 'progress', file: 'glb', label: 'GLB', status: 'uploading', step: 4, total: 5 });
        console.log(`[0G] Upload 4/5 (GLB) initiated...`);
        const glbResult = await uploadTo0G(glbBase64, true);
        rootHashes.glb = glbResult.rootHash;
        txSeqs.glb = glbResult.txSeq;
        sendEvent({ type: 'progress', file: 'glb', label: 'GLB', status: 'done', rootHash: glbResult.rootHash, txSeq: glbResult.txSeq, step: 4, total: 5 });
        console.log(`[0G] Upload 4/5 (GLB) successful: ${rootHashes.glb} (seq=${glbResult.txSeq})`);
      } else {
        sendEvent({ type: 'progress', file: 'glb', label: 'GLB', status: 'skipped', step: 4, total: 5 });
        console.log(`[0G] Upload 4/5 (GLB) skipped — no data`);
      }

      // Upload 5/5: Dim Views (JSON-serialized)
      if (dimViews && Object.keys(dimViews).length > 0) {
        sendEvent({ type: 'progress', file: 'dimViews', label: 'Dim Views', status: 'uploading', step: 5, total: 5 });
        console.log(`[0G] Upload 5/5 (dim views) initiated...`);
        const dimViewsJson = JSON.stringify(dimViews);
        const dimResult = await uploadTo0G(dimViewsJson, false);
        rootHashes.dimViews = dimResult.rootHash;
        txSeqs.dimViews = dimResult.txSeq;
        sendEvent({ type: 'progress', file: 'dimViews', label: 'Dim Views', status: 'done', rootHash: dimResult.rootHash, txSeq: dimResult.txSeq, step: 5, total: 5 });
        console.log(`[0G] Upload 5/5 (dim views) successful: ${rootHashes.dimViews} (seq=${dimResult.txSeq})`);
      } else {
        sendEvent({ type: 'progress', file: 'dimViews', label: 'Dim Views', status: 'skipped', step: 5, total: 5 });
        console.log(`[0G] Upload 5/5 (dim views) skipped — no data`);
      }

      console.log(`[0G] All uploads complete. Saving metadata to Supabase...`);
      const saved = await markModelUploadComplete(walletAddress, {
        name: modelName,
        rootHashCode: rootHashes.code,
        rootHashStl: rootHashes.stl,
        rootHashStep: rootHashes.step,
        rootHashGlb: rootHashes.glb,
        rootHashDimViews: rootHashes.dimViews,
        parameters,
        inspection,
        boundingBox,
        chatSessionId,
        messageOrder: msgOrder,
      });

      if (saved) {
        console.log(`[0G] Metadata saved to Supabase for session ${chatSessionId} message ${msgOrder}`);
      } else {
        console.error(`[0G] Failed to save metadata to Supabase for session ${chatSessionId} message ${msgOrder}`);
      }

      sendEvent({
        type: 'done',
        success: true,
        message: 'Upload to 0G complete',
        chatSessionId,
        messageOrder: msgOrder,
        uploadStatus: 'complete',
        rootHashes,
        txSeqs,
      });
      res.end();
    } catch (uploadErr) {
      console.error(`[0G] Upload failed:`, uploadErr instanceof Error ? uploadErr.message : String(uploadErr));
      await markModelUploadFailed(walletAddress, {
        name: modelName,
        chatSessionId,
        messageOrder: msgOrder,
        parameters,
        inspection,
        boundingBox,
        error: uploadErr instanceof Error ? uploadErr.message : String(uploadErr),
      });
      sendEvent({
        type: 'error',
        success: false,
        error: uploadErr instanceof Error ? uploadErr.message : String(uploadErr),
        rootHashes,
        txSeqs,
      });
      res.end();
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    res.write(`data: ${JSON.stringify({ type: 'error', error: msg })}\n\n`);
    res.end();
  }
});

router.get('/session/:sessionId/latest', authMiddleware, async (req, res) => {
  try {
    const walletAddress = (req as any).walletAddress;
    const model = await getLatestModelForSession(req.params.sessionId, walletAddress);

    if (!model) {
      res.status(404).json({ error: 'No completed model found for this session' });
      return;
    }

    const [code, stlBase64, stepBase64, glbBase64, dimViewsJson] = await Promise.all([
      model.root_hash_code ? fetchFrom0G(model.root_hash_code, false) : Promise.resolve(undefined),
      model.root_hash_stl ? fetchFrom0G(model.root_hash_stl, true) : Promise.resolve(undefined),
      model.root_hash_step ? fetchFrom0G(model.root_hash_step, true) : Promise.resolve(undefined),
      model.root_hash_glb ? fetchFrom0G(model.root_hash_glb, true) : Promise.resolve(undefined),
      model.root_hash_dim_views ? fetchFrom0G(model.root_hash_dim_views, false) : Promise.resolve(undefined),
    ]);

    let dimViews: Record<string, string> | undefined;
    if (dimViewsJson) {
      try {
        dimViews = JSON.parse(dimViewsJson);
      } catch {
        console.error('[0G] Failed to parse dim views JSON from 0G');
      }
    }

    res.json({
      success: true,
      model: {
        id: model.id,
        name: model.name,
        messageOrder: model.message_order,
        code,
        stlBase64,
        stepBase64,
        glbBase64,
        dimViews,
        parameters: model.parameters || [],
        inspection: model.inspection || null,
        boundingBox: model.bounding_box || null,
        rootHashes: {
          code: model.root_hash_code || undefined,
          stl: model.root_hash_stl || undefined,
          step: model.root_hash_step || undefined,
          glb: model.root_hash_glb || undefined,
          dimViews: model.root_hash_dim_views || undefined,
        },
        uploadStatus: model.upload_status,
        createdAt: model.created_at,
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    res.status(500).json({ error: msg });
  }
});

router.get('/fetch-from-0g/:rootHash', async (req, res) => {
  try {
    const isBase64 = req.query.isBase64 === 'true';
    const dataStr = await fetchFrom0G(req.params.rootHash, isBase64);
    res.json({ success: true, data: dataStr });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    res.status(500).json({ error: msg });
  }
});

router.post('/save', authMiddleware, async (req, res) => {
  try {
    const walletAddress = (req as any).walletAddress;
    const result = await saveModelMetadata(walletAddress, req.body);
    if (!result) {
      res.status(500).json({ error: 'Failed to save model' });
      return;
    }
    res.json({ success: true, ...result });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    res.status(500).json({ error: msg });
  }
});

router.get('/', authMiddleware, async (req, res) => {
  try {
    const walletAddress = (req as any).walletAddress;
    const models = await getSavedModels(walletAddress);
    res.json({ models });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    res.status(500).json({ error: msg });
  }
});

router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const walletAddress = (req as any).walletAddress;
    const model = await getSavedModel(req.params.id, walletAddress);
    if (!model) {
      res.status(404).json({ error: 'Model not found' });
      return;
    }
    res.json({ model });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    res.status(500).json({ error: msg });
  }
});

router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const walletAddress = (req as any).walletAddress;
    const ok = await deleteSavedModel(req.params.id, walletAddress);
    res.json({ success: ok });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    res.status(500).json({ error: msg });
  }
});
