import { useState, useRef, useCallback, useEffect, Fragment } from 'react';
import { Eye, PanelLeftClose, PanelRightClose, PanelLeftOpen, PanelRightOpen, Save } from 'lucide-react';
import { NutIcon } from '@/components/hardware/NutIcon';
import type { PanelImperativeHandle } from 'react-resizable-panels';
import type { Parameter, Message, InspectionData, ClarificationOption, WorkflowStep, SessionListItem, Specification } from '@/types';
import { API_URL, CHAT_ENDPOINTS, MODEL_ENDPOINTS } from '@/lib/constants';
import { useAuth } from '@/hooks/useAuth';
// Components
import { HeaderAuth } from '@/components/auth/HeaderAuth';
import { Sidebar } from '@/components/layout/Sidebar';
import { PreviewPanel } from '@/components/layout/PreviewPanel';
import { ChatInput } from '@/components/chat/ChatInput';
import { StreamingMessage } from '@/components/chat/StreamingMessage';
import { ClarificationMessage } from '@/components/chat/ClarificationMessage';
import { MessageBubble } from '@/components/chat/MessageBubble';
import { DimViews } from '@/components/chat/DimViews';
import { RootHashes } from '@/components/chat/RootHashes';
import type { RootHashData, TxSeqData } from '@/components/chat/RootHashes';
import { ParameterPanel } from '@/components/cad/ParameterPanel';
import { ExportSection } from '@/components/cad/ExportSection';
import { CodeSection } from '@/components/cad/CodeSection';
import { SnapshotGallery } from '@/components/cad/SnapshotGallery';
import { InspectionPanel } from '@/components/cad/InspectionPanel';
import { LampContainer } from '@/components/ui/lamp';
import { GlowCard } from '@/components/ui/spotlight-card';
import { ProgressiveFluxLoader } from '@/components/ui/progressive-flux-loader';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { cn } from '@/lib/utils';

// Hooks
import { useAutoScroll } from '@/hooks/useAutoScroll';
import { useParamUpdate } from '@/hooks/useParamUpdate';

// Constants
import { PARAM_PHASES, getProviderDisplayName } from '@/lib/constants';

export default function App() {
  const auth = useAuth();

  const authHeaders = useCallback((): Record<string, string> => {
    return auth.isConnected ? { 'Authorization': `Bearer ${auth.getAuthHeader()}` } : {};
  }, [auth.isConnected, auth.getAuthHeader]);

  // State
  const [prompt, setPrompt] = useState('');
  const [chatSessionId, setChatSessionId] = useState<string | null>(null);
  const [chatSessions, setChatSessions] = useState<SessionListItem[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [provider, setProvider] = useState('mimo-pro');
  const [parameters, setParameters] = useState<Record<string, ParameterSchema>>({});
  const [currentCode, setCurrentCode] = useState('');
  const [stlUrl, setStlUrl] = useState<string | null>(null);
  const [stlObjectUrl, setStlObjectUrl] = useState<string | null>(null);
  const [stepBase64, setStepBase64] = useState<string | undefined>(undefined);
  const [stlBase64, setStlBase64] = useState<string | undefined>(undefined);
  const [glbBase64, setGlbBase64] = useState<string | undefined>(undefined);
  const [latestMessageOrder, setLatestMessageOrder] = useState<number | null>(null);
  const [hasUnsavedParamIteration, setHasUnsavedParamIteration] = useState(false);
  const [isStoringIteration, setIsStoringIteration] = useState(false);
  const [modelStorageStatus, setModelStorageStatus] = useState<string | null>(null);
  const [rootHashes, setRootHashes] = useState<RootHashData | null>(null);
  const [rootHashesLoading, setRootHashesLoading] = useState(false);
  const [txSeqs, setTxSeqs] = useState<TxSeqData | null>(null);
  const [uploadProgress, setUploadProgress] = useState<Record<string, { status: string; rootHash?: string; txSeq?: number }> | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [streamReasoning, setStreamReasoning] = useState('');
  const [reasoningEnabled, setReasoningEnabled] = useState(true);
  const [exportFilename, setExportFilename] = useState('model');
  const [snapshots, setSnapshots] = useState<Record<string, string>>({});
  const [dimViews, setDimViews] = useState<Record<string, string>>({});
  const [inspection, setInspection] = useState<InspectionData | null>(null);
  const [collapsed, setCollapsed] = useState({ chat: false, preview: false, right: false });
  const [panelAnimating, setPanelAnimating] = useState(false);
  const [rotatingKey, setRotatingKey] = useState<'chat' | 'right' | null>(null);

  // Refs for collapsible panels
  const chatPanelRef = useRef<PanelImperativeHandle | null>(null);
  const previewPanelRef = useRef<PanelImperativeHandle | null>(null);
  const rightPanelRef = useRef<PanelImperativeHandle | null>(null);

  const togglePanel = useCallback((key: 'chat' | 'preview' | 'right', ref: React.RefObject<PanelImperativeHandle | null>) => {
    const panel = ref.current;
    if (!panel) return;
    const willCollapse = !panel.isCollapsed();
    setCollapsed(c => ({ ...c, [key]: willCollapse }));
    setPanelAnimating(true);
    if (key !== 'preview') setRotatingKey(key);
    window.requestAnimationFrame(() => {
      if (willCollapse) panel.collapse();
      else panel.expand();
    });
    window.setTimeout(() => {
      setPanelAnimating(false);
      if (key !== 'preview') setRotatingKey(null);
    }, 700);
  }, []);

  // Refs for streaming
  const reasoningBufferRef = useRef('');
  const reasoningRafRef = useRef<number | null>(null);
  const assistantMessageIdRef = useRef<number | null>(null);

  // Hooks
  const { chatEndRef, chatContainerRef, handleScroll } = useAutoScroll([messages, streamReasoning]);

  const {
    paramValues, setParamValues, isParamUpdating, paramUpdateKey,
    paramError, handleParamChange, resetParams,
  } = useParamUpdate({
    currentCode,
    stlObjectUrl,
    onStlUpdate: setStlUrl,
    onStepUpdate: setStepBase64,
    onGlbBase64Update: setGlbBase64,
    onStlBase64Update: setStlBase64,
    onRevokeUrl: URL.revokeObjectURL,
    onParametersUpdate: setParameters,
    onSnapshotsUpdate: setSnapshots,
    onDimViewsUpdate: setDimViews,
    onInspectionUpdate: setInspection,
    onUpdateComplete: (data) => {
      if (data.stlBase64) setStlBase64(data.stlBase64);
      if (data.stepBase64) setStepBase64(data.stepBase64);
      if (data.glbBase64) setGlbBase64(data.glbBase64);
      setHasUnsavedParamIteration(true);
      setModelStorageStatus(null);
    },
    getAuthHeaders: authHeaders,
  });

  // Cleanup
  useEffect(() => {
    return () => { if (stlObjectUrl) URL.revokeObjectURL(stlObjectUrl); };
  }, [stlObjectUrl]);

  const saveCurrentSession = useCallback(() => {
    if (!auth.isConnected || messages.length === 0) return;
    const allMsgs = messages.map(m => ({
      role: m.role,
      content: m.content,
      specifications: m.specifications,
      provider: m.provider,
    }));
    fetch(`${API_URL}${CHAT_ENDPOINTS.SAVE}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ sessionId: chatSessionId, messages: allMsgs, parameters }),
    }).catch(() => {});
  }, [messages, chatSessionId, parameters, auth.isConnected, authHeaders]);

  const uploadModelTo0G = useCallback(async (model: {
    sessionId: string;
    messageOrder: number;
    name: string;
    code: string;
    stlBase64?: string;
    stepBase64?: string;
    glbBase64?: string;
    dimViews?: Record<string, string>;
    parameters?: Parameter[];
    inspection?: InspectionData | null;
    boundingBox?: { size?: number[] };
  }) => {
    console.log(`[0G] Frontend: upload initiated for session ${model.sessionId} message ${model.messageOrder}`);
    setRootHashesLoading(true);
    setRootHashes(null);
    setTxSeqs(null);
    setUploadProgress({});

    const res = await fetch(`${API_URL}${MODEL_ENDPOINTS.UPLOAD_0G}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({
        chatSessionId: model.sessionId,
        messageOrder: model.messageOrder,
        name: model.name,
        code: model.code,
        stlBase64: model.stlBase64,
        stepBase64: model.stepBase64,
        glbBase64: model.glbBase64,
        dimViews: model.dimViews,
        parameters: model.parameters,
        inspection: model.inspection,
        boundingBox: model.boundingBox,
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      console.error(`[0G] Frontend: upload failed — ${data.error || res.status}`);
      setRootHashesLoading(false);
      setUploadProgress(null);
      throw new Error(data.error || `0G upload request failed: ${res.status}`);
    }

    // Read SSE stream
    const reader = res.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let buffer = '';
    let finalData: any = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === 'progress') {
              setUploadProgress(prev => ({
                ...prev,
                [data.file]: { status: data.status, rootHash: data.rootHash, txSeq: data.txSeq },
              }));
            } else if (data.type === 'done') {
              finalData = data;
              if (data.rootHashes) {
                setRootHashes(data.rootHashes);
                if (data.txSeqs) setTxSeqs(data.txSeqs);
              }
            } else if (data.type === 'error') {
              setRootHashesLoading(false);
              setUploadProgress(null);
              throw new Error(data.error);
            }
          } catch (e: any) {
            if (e.message && !e.message.includes('JSON')) throw e;
          }
        }
      }
    }

    setRootHashesLoading(false);
    setUploadProgress(null);
    console.log(`[0G] Frontend: upload successful`);
    return finalData;
  }, [authHeaders]);

  const storeCurrentIteration = useCallback(async () => {
    if (!chatSessionId || latestMessageOrder === null || !currentCode) return;
    setIsStoringIteration(true);
    setModelStorageStatus('Starting 0G upload...');
    try {
      await uploadModelTo0G({
        sessionId: chatSessionId,
        messageOrder: latestMessageOrder,
        name: `Iteration ${latestMessageOrder + 1}`,
        code: currentCode,
        stlBase64,
        stepBase64,
        glbBase64,
        dimViews,
        parameters,
        inspection,
        boundingBox: inspection?.bounding_box,
      });
      setHasUnsavedParamIteration(false);
      setModelStorageStatus('0G storage complete');
    } catch (err) {
      setModelStorageStatus(err instanceof Error ? err.message : String(err));
    } finally {
      setIsStoringIteration(false);
    }
  }, [
    chatSessionId,
    latestMessageOrder,
    currentCode,
    stlBase64,
    stepBase64,
    glbBase64,
    dimViews,
    parameters,
    inspection,
    uploadModelTo0G,
  ]);

  const handleLoadSession = useCallback(async (sessionId: string) => {
    if (isGenerating) {
      console.log('[LOAD] blocked: is generating');
      return;
    }
    if (chatSessionId === sessionId) {
      console.log('[LOAD] blocked: same session', sessionId);
      return;
    }
    if (messages.length > 0 && chatSessionId && auth.isConnected) {
      saveCurrentSession();
    }
    try {
      console.log('[LOAD] fetching session:', sessionId);
      const res = await fetch(`${API_URL}${CHAT_ENDPOINTS.HISTORY(sessionId)}`, {
        headers: { 'Authorization': `Bearer ${auth.address || ''}` },
      });
      console.log('[LOAD] response status:', res.status);
      if (!res.ok) return;
      const data = await res.json();
      const { session } = data;
      if (!session) {
        console.log('[LOAD] no session data');
        return;
      }
      console.log('[LOAD] loaded session:', session.title, session.messages?.length, 'messages');
      setChatSessionId(session.id);
      setMessages(session.messages || []);
      setCurrentCode('');
      setLatestMessageOrder(null);
      setHasUnsavedParamIteration(false);
      setModelStorageStatus(null);
      setParameters(session.parameters || []);
      if (session.parameters?.length) {
        const vals: Record<string, number> = {};
        session.parameters.forEach((p: Parameter) => { vals[p.name] = p.default; });
        setParamValues(vals);
      }
      setSnapshots({});
      setDimViews({});
      setStlUrl(null);
      setStlBase64(undefined);
      setStepBase64(undefined);
      setGlbBase64(undefined);
      setRootHashes(null);
      setTxSeqs(null);
      setRootHashesLoading(false);

      try {
        const modelRes = await fetch(`${API_URL}${MODEL_ENDPOINTS.LATEST_FOR_SESSION(session.id)}`, {
          headers: { 'Authorization': `Bearer ${auth.address || ''}` },
        });
        if (modelRes.ok) {
          const modelData = await modelRes.json();
          const model = modelData.model;

          setLatestMessageOrder(typeof model.messageOrder === 'number' ? model.messageOrder : null);
          setCurrentCode(model.code || '');
          setStlBase64(model.stlBase64);
          setStepBase64(model.stepBase64);
          setGlbBase64(model.glbBase64);
          if (model.rootHashes) {
            console.log('[0G] Frontend: restored root hashes from Supabase:', model.rootHashes);
            setRootHashes(model.rootHashes);
            setRootHashesLoading(false);
          } else {
            setRootHashes(null);
      setTxSeqs(null);
          }
          if (model.parameters?.length) {
            setParameters(model.parameters);
            const modelVals: Record<string, number> = {};
            model.parameters.forEach((p: Parameter) => { modelVals[p.name] = p.default; });
            setParamValues(modelVals);
          }
          if (model.inspection) setInspection(model.inspection);
          if (model.dimViews && Object.keys(model.dimViews).length > 0) {
            setDimViews(model.dimViews);
            setMessages(prev => {
              const next = [...prev];
              for (let j = next.length - 1; j >= 0; j--) {
                if (next[j].role === 'assistant') {
                  next[j] = { ...next[j], dimViews: model.dimViews };
                  break;
                }
              }
              return next;
            });
          }

          if (model.stlBase64) {
            const bytes = Uint8Array.from(atob(model.stlBase64), c => c.charCodeAt(0));
            const blob = new Blob([bytes], { type: 'application/octet-stream' });
            const url = URL.createObjectURL(blob);
            if (stlObjectUrl) URL.revokeObjectURL(stlObjectUrl);
            setStlObjectUrl(url);
            setStlUrl(url);
          }
        }
      } catch (err) {
        console.error('[0G] latest model restore failed:', err);
      }
    } catch (err) {
      console.error('[LOAD] error:', err);
    }
  }, [isGenerating, chatSessionId, messages, auth.isConnected, auth.address, saveCurrentSession, setParamValues, stlObjectUrl]);

  // Keep latest handleLoadSession in a ref to avoid stale closure
  const handleLoadSessionRef = useRef(handleLoadSession);
  useEffect(() => {
    handleLoadSessionRef.current = handleLoadSession;
  }, [handleLoadSession]);

  // Fetch sessions on connect and auto-load latest (runs once per wallet connect)
  useEffect(() => {
    if (!auth.isConnected || !auth.address) return;
    fetch(`${API_URL}${CHAT_ENDPOINTS.SESSIONS}`, {
      headers: { 'Authorization': `Bearer ${auth.address}` },
    }).then(r => r.json()).then(d => {
      setChatSessions(d.sessions || []);
    }).catch(() => {});
  }, [auth.isConnected, auth.address]);

  // Sync profile to Supabase on wallet connect
  useEffect(() => {
    if (!auth.isConnected || !auth.address) return;
    fetch(`${API_URL}/api/auth/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${auth.address}` },
    }).catch(() => {});
  }, [auth.isConnected, auth.address]);

  // Handlers
  const handleGenerate = useCallback(async (answers?: string, overridePrompt?: string, answerList?: Specification[]) => {
    const activePrompt = overridePrompt ?? prompt;
    if (!activePrompt.trim() || isGenerating) return;
    if (!auth.isConnected) { setPrompt(''); return; }

    const isClarificationContinue = !!overridePrompt;
    const userMsg: Message = { role: 'user', content: activePrompt, timestamp: Date.now() };
    const answerMsg: Message | null = answers && answerList
      ? { role: 'user', content: answers, specifications: answerList, timestamp: Date.now() }
      : null;
    if (!isClarificationContinue) {
      setMessages(prev => [...prev, userMsg]);
    }
    setPrompt('');
    setIsGenerating(true);
    setStreamReasoning('');
    setSnapshots({});
    setDimViews({});
    setInspection(null);
    reasoningBufferRef.current = '';
    if (reasoningRafRef.current) { cancelAnimationFrame(reasoningRafRef.current); reasoningRafRef.current = null; }

    try {
      const res = await fetch(`${API_URL}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ prompt: userMsg.content, provider, history: messages, answers, reasoning: reasoningEnabled }),
      });
      if (!res.ok) throw new Error(`Server error: ${res.status}`);

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '', finalData: any = null, currentEvent = '';
      let clarifyQuestions: ClarificationOption[] | null = null;
      let liveInspection: InspectionData | null = null;
      let liveSnapshots: Record<string, string> = {};
      let liveDimViews: Record<string, string> = {};
      let visionFeedback: string | null = null;
      let visionVerified = false;
      let liveSteps: WorkflowStep[] = [];
      assistantMessageIdRef.current = null;

      // Add a placeholder assistant message that will accumulate steps during generation
      setMessages(prev => {
        assistantMessageIdRef.current = prev.length;
        return [...prev, { role: 'assistant', content: '', provider, steps: [], timestamp: Date.now() }];
      });

      const updateSteps = (steps: WorkflowStep[]) => {
        liveSteps = steps;
        if (assistantMessageIdRef.current !== null) {
          setMessages(prev => {
            const next = [...prev];
            if (next[assistantMessageIdRef.current!]) {
              next[assistantMessageIdRef.current!] = { ...next[assistantMessageIdRef.current!], steps };
            }
            return next;
          });
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('event: ')) { currentEvent = line.slice(7).trim(); continue; }
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (currentEvent === 'reasoning') {
                reasoningBufferRef.current += (data.chunk || '');
                if (!reasoningRafRef.current) {
                  reasoningRafRef.current = requestAnimationFrame(() => {
                    setStreamReasoning(reasoningBufferRef.current);
                    reasoningRafRef.current = null;
                  });
                }
              } else if (currentEvent === 'clarify') {
                clarifyQuestions = data.questions;
              } else if (currentEvent === 'inspection') {
                liveInspection = data.inspection;
                setInspection(data.inspection);
              } else if (currentEvent === 'snapshots') {
                liveSnapshots = { ...liveSnapshots, ...data.snapshots };
                setSnapshots(prev => ({ ...prev, ...data.snapshots }));
              } else if (currentEvent === 'dim-views') {
                liveDimViews = { ...liveDimViews, ...data.dimViews };
                setDimViews(prev => ({ ...prev, ...data.dimViews }));
              } else if (currentEvent === 'vision-check') {
                setInspection(prev => prev ? { ...prev, visionChecking: true } as any : prev);
              } else if (currentEvent === 'vision-result') {
                visionFeedback = data.feedback;
                visionVerified = !data.needsFix;
                setInspection(prev => prev ? { ...prev, visionChecking: false, visionVerified: !data.needsFix, visionFeedback: data.feedback } as any : prev);
              } else if (currentEvent === 'step') {
                const existingIndex = liveSteps.findIndex(s => s.id === data.id);
                if (existingIndex >= 0) {
                  const updated = [...liveSteps];
                  updated[existingIndex] = {
                    ...updated[existingIndex],
                    status: data.status || updated[existingIndex].status,
                    detail: data.detail ?? updated[existingIndex].detail,
                    label: data.label || updated[existingIndex].label,
                    icon: data.icon || updated[existingIndex].icon,
                    timestamp: Date.now(),
                  };
                  updateSteps(updated);
                } else {
                  const newStep: WorkflowStep = {
                    id: data.id,
                    icon: data.icon || 'code',
                    label: data.label || data.id,
                    detail: data.detail || '',
                    status: data.status || 'running',
                    timestamp: Date.now(),
                  };
                  updateSteps([...liveSteps, newStep]);
                }
              } else if (currentEvent === 'validation-warning') {
                if (data.inspection) {
                  liveInspection = data.inspection;
                  setInspection(data.inspection);
                }
              } else if (currentEvent === 'done') {
                finalData = data;
                if (data.inspection) setInspection(data.inspection);
                if (data.snapshots) setSnapshots(data.snapshots);
                if (data.visionVerified) visionVerified = true;
                const remainingRunning = liveSteps.filter(s => s.status === 'running');
                if (remainingRunning.length > 0) {
                  const updated = liveSteps.map(s => s.status === 'running' ? { ...s, status: 'done' as const, detail: s.detail || 'Complete' } : s);
                  updateSteps(updated);
                }
              } else if (currentEvent === 'error') {
                throw new Error(data.error);
              }
            } catch (e: any) {
              if (e.message && !e.message.includes('JSON')) throw e;
            }
            currentEvent = '';
          }
        }
      }

      // Handle clarification
      if (clarifyQuestions && clarifyQuestions.length > 0 && !finalData) {
        setMessages(prev => {
          const next = [...prev];
          if (assistantMessageIdRef.current !== null && next[assistantMessageIdRef.current]) {
            next[assistantMessageIdRef.current] = { role: 'assistant', content: '', clarification: clarifyQuestions! };
          } else {
            next.push({ role: 'assistant', content: '', clarification: clarifyQuestions! });
          }
          return next;
        });
        setIsGenerating(false);
        setStreamReasoning('');
        reasoningBufferRef.current = '';
        if (reasoningRafRef.current) { cancelAnimationFrame(reasoningRafRef.current); reasoningRafRef.current = null; }
        return;
      }

      // Handle success
      if (finalData) {
        const assistantMsg: Message = {
          role: 'assistant',
          content: finalData.bestEffort
            ? `Generated (best effort) - ${finalData.warning || 'model had issues'}`
            : finalData.visionVerified
            ? `Generated with ${getProviderDisplayName(finalData.provider || provider)} (vision-verified)`
            : `Generated with ${getProviderDisplayName(finalData.provider || provider)}`,
          provider: finalData.provider,
          dimViews: Object.keys(liveDimViews).length > 0 ? liveDimViews : (finalData.dimViews || {}),
          visionVerified: finalData.visionVerified,
          visionFeedback: visionFeedback || undefined,
          teeProof: finalData.teeProof,
          steps: liveSteps,
          timestamp: Date.now(),
        };
        setMessages(prev => {
          const next = [...prev];
          if (assistantMessageIdRef.current !== null && next[assistantMessageIdRef.current]) {
            next[assistantMessageIdRef.current] = assistantMsg;
          } else {
            next.push(assistantMsg);
          }
          return next;
        });
        if (finalData.code) setCurrentCode(finalData.code);
        if (finalData.parameters) {
          setParameters(finalData.parameters);
          const vals: Record<string, number> = {};
          Object.entries(finalData.parameters).forEach(([name, schema]) => {
            if (typeof schema.default === 'number') {
              vals[name] = schema.default;
            }
          });
          setParamValues(vals);
        }
        setStlBase64(finalData.stlBase64);
        setStepBase64(finalData.stepBase64);
        setGlbBase64(finalData.glbBase64);
        setHasUnsavedParamIteration(false);
        if (finalData.stlBase64 && finalData.hasStl) {
          const bytes = Uint8Array.from(atob(finalData.stlBase64), c => c.charCodeAt(0));
          const blob = new Blob([bytes], { type: 'application/octet-stream' });
          const url = URL.createObjectURL(blob);
          if (stlObjectUrl) URL.revokeObjectURL(stlObjectUrl);
          setStlObjectUrl(url);
          setStlUrl(url);
        }
        if (finalData.inspection) setInspection(finalData.inspection);
        if (finalData.snapshots) setSnapshots(finalData.snapshots);
        setDimViews(Object.keys(liveDimViews).length > 0 ? liveDimViews : (finalData.dimViews || {}));

        // Auto-save chat session
        if (auth.isConnected) {
          try {
            const saveSourceMessages = isClarificationContinue
              ? [...messages, ...(answerMsg ? [answerMsg] : []), assistantMsg]
              : [...messages, userMsg, assistantMsg];
            const allMessages = saveSourceMessages.map(m => ({
              role: m.role,
              content: m.content,
              specifications: m.specifications,
              provider: m.provider,
            }));
            const saveRes = await fetch(`${API_URL}${CHAT_ENDPOINTS.SAVE}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', ...authHeaders() },
              body: JSON.stringify({
                sessionId: chatSessionId,
                messages: allMessages,
                parameters: finalData.parameters,
              }),
            });
            if (saveRes.ok) {
              const saveData = await saveRes.json();
              const savedSessionId = saveData.sessionId || chatSessionId;
              const savedMessageOrder = typeof saveData.latestMessageOrder === 'number'
                ? saveData.latestMessageOrder
                : null;

              if (saveData.sessionId) setChatSessionId(saveData.sessionId);
              setLatestMessageOrder(savedMessageOrder);

              if (savedSessionId && savedMessageOrder !== null && finalData.code) {
                setModelStorageStatus('Starting 0G upload...');
                uploadModelTo0G({
                  sessionId: savedSessionId,
                  messageOrder: savedMessageOrder,
                  name: `Iteration ${savedMessageOrder + 1}`,
                  code: finalData.code,
                  stlBase64: finalData.stlBase64,
                  stepBase64: finalData.stepBase64,
                  glbBase64: finalData.glbBase64,
                  dimViews: Object.keys(liveDimViews).length > 0 ? liveDimViews : (finalData.dimViews || {}),
                  parameters: finalData.parameters,
                  inspection: finalData.inspection,
                  boundingBox: finalData.inspection?.bounding_box,
                })
                  .then(() => setModelStorageStatus('0G storage complete'))
                  .catch(err => setModelStorageStatus(err instanceof Error ? err.message : String(err)));
              }
            }
          } catch {}
        }
      }
    } catch (e: any) {
      const errorMsg = e.message?.includes('Failed to fetch')
        ? 'Cannot connect to server. Make sure ai-server and cad-server are running.'
        : e.message;
      const errorMsgObj: Message = { role: 'assistant', content: `Error: ${errorMsg}`, error: errorMsg, timestamp: Date.now() };
      setMessages(prev => {
        const next = [...prev];
        if (assistantMessageIdRef.current !== null && next[assistantMessageIdRef.current]) {
          next[assistantMessageIdRef.current] = errorMsgObj;
        } else {
          next.push(errorMsgObj);
        }
        return next;
      });
    } finally {
      setIsGenerating(false);
      setStreamReasoning('');
      reasoningBufferRef.current = '';
      if (reasoningRafRef.current) { cancelAnimationFrame(reasoningRafRef.current); reasoningRafRef.current = null; }
    }
  }, [prompt, isGenerating, provider, messages, stlObjectUrl, reasoningEnabled, setParamValues, auth.isConnected, authHeaders, chatSessionId, uploadModelTo0G]);

  const handleClarificationSubmit = useCallback((answers: string, answerList: { question: string; answer: string }[]) => {
    const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
    if (!lastUserMsg) return;
    setMessages(prev => [
      ...prev.filter(m => !m.clarification),
      { role: 'user', content: answers, clarificationAnswers: answerList, timestamp: Date.now() }
    ]);
    handleGenerate(answers, lastUserMsg.content, answerList);
  }, [handleGenerate, messages]);

  const handleNewTask = useCallback(() => {
    if (messages.length > 0 && chatSessionId && auth.isConnected) {
      saveCurrentSession();
    }
    setMessages([]);
    setParameters({});
    setCurrentCode('');
    setStlUrl(null);
    setStlBase64(undefined);
    setStepBase64(undefined);
    setGlbBase64(undefined);
    if (stlObjectUrl) URL.revokeObjectURL(stlObjectUrl);
    setStlObjectUrl(null);
    setPrompt('');
    setStreamReasoning('');
    setExportFilename('model');
    setSnapshots({});
    setDimViews({});
    setInspection(null);
    setChatSessionId(null);
    setLatestMessageOrder(null);
    setHasUnsavedParamIteration(false);
    setModelStorageStatus(null);
    setRootHashes(null);
      setTxSeqs(null);
    setRootHashesLoading(false);
    resetParams();
  }, [messages, chatSessionId, auth.isConnected, stlObjectUrl, saveCurrentSession, resetParams]);

  const hasModel = messages.length > 0 || isGenerating;

  // Render
  return (
    <div className="flex h-dvh overflow-hidden">
      <Sidebar
        isOpen={sidebarOpen}
        onNewTask={handleNewTask}
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        walletAddress={auth.address}
        isConnected={auth.isConnected}
        isAuthLoading={auth.isLoading}
        onConnect={() => auth.connect()}
        onDisconnect={() => auth.disconnect()}
        sessions={chatSessions}
        activeSessionId={chatSessionId}
        onSelectSession={handleLoadSession}
      />

      <div className="relative flex-1 overflow-auto bg-adam-bg-dark">
        <div className="absolute top-4 right-6 z-50">
          <HeaderAuth />
        </div>
        <div className={`h-full bg-adam-bg-dark ${sidebarOpen ? 'p-6' : 'p-0'}`}>
          <div className="h-full bg-adam-bg-secondary-dark rounded-xl overflow-hidden flex relative">

            {!hasModel ? (
              <LampContainer className="flex-1 min-h-0">
                <h1 className="mb-8 text-center text-2xl font-medium text-adam-text-primary md:text-3xl">
                  What can Chamfer AI help you build today?
                </h1>
                <GlowCard glowColor="blue" customSize className="w-full max-w-2xl">
                  <div className="space-y-4">
                    <ChatInput
                      prompt={prompt} setPrompt={setPrompt} onSubmit={handleGenerate}
                      isGenerating={isGenerating} isFocused={isFocused} setIsFocused={setIsFocused}
                      provider={provider} setProvider={setProvider}
                      placeholder="Start building with Chamfer AI..."
                      reasoningEnabled={reasoningEnabled} setReasoningEnabled={setReasoningEnabled}
                      showAnimatedPlaceholder
                      isConnected={auth.isConnected}
                    />
                    <div className="flex flex-wrap justify-center gap-2">
                      <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-sm text-adam-text-secondary">
                        Powered by <span className="font-medium text-adam-blue">0G Compute</span>
                      </span>
                      <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-sm text-adam-text-secondary">
                        CadQuery <span className="font-medium text-adam-blue">Python</span>
                      </span>
                    </div>
                  </div>
                </GlowCard>
              </LampContainer>
            ) : (
              <>
              <ResizablePanelGroup direction="horizontal" autoSaveId="chamfer-ai-editor-v3" className={cn('h-full w-full', panelAnimating && 'panel-animated')}>

                <ResizablePanel
                  panelRef={chatPanelRef}
                  collapsible
                  collapsedSize={0}
                  minSize={20}
                  maxSize={500}
                  defaultSize={30}
                  order={1}
                  onResize={size => {
                    if (panelAnimating) return;
                    if (size.asPercentage < 0.5) setCollapsed(c => c.chat ? c : { ...c, chat: true });
                    else if (size.asPercentage > 1) setCollapsed(c => !c.chat ? c : { ...c, chat: false });
                  }}
                  className="bg-adam-bg-secondary-dark"
                >
                  <div className="relative flex h-full min-w-0 flex-col border-r border-adam-neutral-700/40 bg-adam-bg-secondary-dark">
                    {/* Chat header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-adam-neutral-700/40 bg-gradient-to-b from-white/[0.02] to-transparent">
                      <div className="flex items-center gap-2">
                        <div className={`w-1.5 h-1.5 rounded-full ${isGenerating ? 'bg-adam-blue animate-pulse' : 'bg-adam-neutral-600'}`} />
                        <span className="text-sm font-semibold text-adam-text-primary">Chat</span>
                      </div>
                      <span className="text-[10px] text-adam-text-tertiary/70 tabular-nums">
                        {messages.filter(m => !m.clarification).length} messages
                      </span>
                    </div>

                    {/* Message list */}
                    <div ref={chatContainerRef} onScroll={handleScroll} className="chat-scroll flex-1 overflow-y-auto px-3 py-3 space-y-2.5">
                      {messages.map((msg, i) => (
                        msg.clarification ? (
                          <ClarificationMessage key={i} questions={msg.clarification} onSubmit={handleClarificationSubmit} isGenerating={isGenerating} />
                        ) : (
                          (isGenerating && i === messages.length - 1 && msg.role === 'assistant' && !msg.content) ? null : (
                            <Fragment key={i}>
                              <MessageBubble message={msg} />
                              {msg.role === 'assistant' && i === messages.length - 1 && (
                                <RootHashes hashes={rootHashes} txSeqs={txSeqs} loading={rootHashesLoading} progress={uploadProgress} />
                              )}
                            </Fragment>
                          )
                        )
                      ))}
                      {isGenerating && (
                        <StreamingMessage
                          steps={messages.length > 0 && messages[messages.length - 1].role === 'assistant'
                            ? messages[messages.length - 1].steps
                            : undefined}
                          reasoning={streamReasoning}
                        />
                      )}
                      <div ref={chatEndRef} />
                    </div>

                    {/* Input dock */}
                    <div className="border-t border-adam-neutral-700/40 p-3 bg-gradient-to-t from-white/[0.01] to-transparent">
                      <ChatInput
                        prompt={prompt} setPrompt={setPrompt} onSubmit={handleGenerate}
                        isGenerating={isGenerating} isFocused={isFocused} setIsFocused={setIsFocused}
                        provider={provider} setProvider={setProvider}
                        placeholder="Modify your model..."
                        reasoningEnabled={reasoningEnabled} setReasoningEnabled={setReasoningEnabled}
                        isConnected={auth.isConnected}
                      />
                    </div>
                  </div>
                </ResizablePanel>

                <ResizableHandle>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      togglePanel('chat', chatPanelRef);
                    }}
                    title={collapsed.chat ? 'Show chat' : 'Hide chat'}
                    className="absolute top-1/2 left-full -translate-y-1/2 h-7 w-7 glass-hud rounded-md flex items-center justify-center text-adam-text-secondary hover:text-adam-blue hover:bg-adam-blue/15 transition-colors pointer-events-auto cursor-pointer outline-none"
                  >
                    <NutIcon className="h-4 w-4" spinning={rotatingKey === 'chat'} />
                  </button>
                </ResizableHandle>

                <ResizablePanel
                  panelRef={previewPanelRef}
                  collapsible
                  collapsedSize={0}
                  minSize={30}
                  defaultSize={45}
                  order={2}
                  onResize={size => {
                    if (panelAnimating) return;
                    if (size.asPercentage < 0.5) setCollapsed(c => c.preview ? c : { ...c, preview: true });
                    else if (size.asPercentage > 1) setCollapsed(c => !c.preview ? c : { ...c, preview: false });
                  }}
                >
                  <PreviewPanel
                    stlUrl={stlUrl}
                    paramUpdateKey={paramUpdateKey}
                    isParamUpdating={isParamUpdating}
                    provider={provider}
                    isCollapsed={collapsed.preview}
                  />
                </ResizablePanel>

                <ResizableHandle>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      togglePanel('right', rightPanelRef);
                    }}
                    title={collapsed.right ? 'Show inspect' : 'Hide inspect'}
                    className="absolute top-1/2 left-0 -translate-x-full -translate-y-1/2 h-7 w-7 glass-hud rounded-md flex items-center justify-center text-adam-text-secondary hover:text-adam-blue hover:bg-adam-blue/15 transition-colors pointer-events-auto cursor-pointer outline-none"
                  >
                    <NutIcon className="h-4 w-4" spinning={rotatingKey === 'right'} />
                  </button>
                </ResizableHandle>

                <ResizablePanel
                  panelRef={rightPanelRef}
                  collapsible
                  collapsedSize={0}
                  minSize={300}
                  defaultSize={26}
                  maxSize={400}
                  order={3}
                  onResize={size => {
                    if (panelAnimating) return;
                    if (size.asPercentage < 0.5) setCollapsed(c => c.right ? c : { ...c, right: true });
                    else if (size.asPercentage > 1) setCollapsed(c => !c.right ? c : { ...c, right: false });
                  }}
                  className="bg-adam-bg-secondary-dark"
                >
                  <div className="flex h-full flex-col relative">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-adam-neutral-700/40 bg-gradient-to-b from-white/[0.02] to-transparent">
                      <span className="text-xs font-semibold text-adam-text-tertiary uppercase tracking-wider">Inspect</span>
                      {inspection && (
                        <div className="flex items-center gap-1.5">
                          <div className={`w-1.5 h-1.5 rounded-full ${inspection.all_clear ? 'bg-emerald-400/60' : 'bg-yellow-400/60'}`} />
                          <span className="text-[10px] text-adam-text-tertiary/70">{inspection.all_clear ? 'All clear' : 'Issues'}</span>
                        </div>
                      )}
                    </div>
                    <div className="chat-scroll flex-1 overflow-y-auto">
                      {/* Inspection */}
                      {inspection && <InspectionPanel inspection={inspection} />}

                      {Object.keys(snapshots).length > 0 && <SnapshotGallery snapshots={snapshots} />}

                      {Object.keys(dimViews).length > 0 && (
                        <div className="p-4 border-b border-adam-neutral-700/40">
                          <h3 className="text-xs font-semibold text-adam-text-tertiary/80 uppercase tracking-wider mb-3">Dimensional Views</h3>
                          <DimViews dimViews={dimViews} />
                        </div>
                      )}

                      {/* Parameters */}
                      {Object.keys(parameters).length > 0 && (
                        <div className="p-4 border-b border-adam-neutral-700/40">
                          <div className="flex items-center justify-between mb-3">
                            <h3 className="text-xs font-semibold text-adam-text-tertiary/80 uppercase tracking-wider">Parameters</h3>
                            <span className="text-[10px] text-adam-text-tertiary/60 tabular-nums">{Object.keys(parameters).length} params</span>
                          </div>
                          <ParameterPanel parameters={parameters} values={paramValues} onChange={handleParamChange} />
                          {isParamUpdating && (
                            <div className="mt-3">
                              <ProgressiveFluxLoader phases={PARAM_PHASES} showLabel={false} barClassName="h-1.5" className="gap-0" />
                            </div>
                          )}
                          {paramError && (
                            <div className="mt-2 flex items-start gap-2 text-[11px] text-red-400/90 bg-red-500/[0.06] rounded-lg px-3 py-2 ring-1 ring-red-500/10">
                              {paramError}
                            </div>
                          )}
                          {hasUnsavedParamIteration && currentCode && (
                            <button
                              type="button"
                              onClick={storeCurrentIteration}
                              disabled={isStoringIteration || !chatSessionId || latestMessageOrder === null}
                              className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-adam-blue/50 bg-adam-blue/10 px-3 py-2 text-xs font-medium text-adam-blue transition-colors hover:bg-adam-blue/20 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <Save className="h-3.5 w-3.5" />
                              {isStoringIteration ? 'Starting 0G storage...' : 'Store this iteration'}
                            </button>
                          )}
                          {modelStorageStatus && (
                            <div className="mt-2 text-[10px] text-adam-text-tertiary bg-adam-neutral-800/60 rounded-md px-2 py-1.5">
                              {modelStorageStatus}
                            </div>
                          )}
                        </div>
                      )}

                      <ExportSection
                        stlBase64={stlBase64}
                        stepBase64={stepBase64}
                        exportFilename={exportFilename}
                        setExportFilename={setExportFilename}
                      />

                      {currentCode && <CodeSection code={currentCode} />}

                      {/* Empty State */}
                      {Object.keys(parameters).length === 0 && !currentCode && (
                        <div className="flex-1 flex items-center justify-center p-6">
                          <div className="text-center">
                            <div className="w-10 h-10 rounded-full bg-adam-neutral-800 flex items-center justify-center mx-auto mb-3">
                              <svg className="w-5 h-5 text-adam-text-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 0 1-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 0 1 4.5 0m0 0v5.714a2.25 2.25 0 0 0 .659 1.591L19 14.5M14.25 3.104c.251.023.501.05.75.082M19 14.5l-2.47 2.47a2.25 2.25 0 0 1-1.59.659H9.06a2.25 2.25 0 0 1-1.591-.659L5 14.5m14 0V17a2.25 2.25 0 0 1-2.25 2.25H7.25A2.25 2.25 0 0 1 5 17v-2.5" />
                              </svg>
                            </div>
                            <p className="text-xs text-adam-text-tertiary">Generate a model to see parameters and code</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </ResizablePanel>
              </ResizablePanelGroup>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
