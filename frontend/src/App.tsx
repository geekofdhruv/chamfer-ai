import { useState, useRef, useCallback, useEffect } from 'react';
import { PanelLeft, Eye } from 'lucide-react';
import type { Parameter, Message, InspectionData, ClarificationOption, WorkflowStep } from '@/types';
import { API_URL } from '@/lib/constants';

// Components
import { Sidebar } from '@/components/layout/Sidebar';
import { PreviewPanel } from '@/components/layout/PreviewPanel';
import { ChatInput } from '@/components/chat/ChatInput';
import { StreamingMessage } from '@/components/chat/StreamingMessage';
import { ClarificationMessage } from '@/components/chat/ClarificationMessage';
import { ClarificationAnswers } from '@/components/chat/ClarificationAnswers';
import { WorkflowTimeline } from '@/components/chat/WorkflowTimeline';
import { DimViews } from '@/components/chat/DimViews';
import { ParameterPanel } from '@/components/cad/ParameterPanel';
import { ExportSection } from '@/components/cad/ExportSection';
import { CodeSection } from '@/components/cad/CodeSection';
import { SnapshotGallery } from '@/components/cad/SnapshotGallery';
import { InspectionPanel } from '@/components/cad/InspectionPanel';
import { LampContainer } from '@/components/ui/lamp';
import { GlowCard } from '@/components/ui/spotlight-card';
import { ProgressiveFluxLoader } from '@/components/ui/progressive-flux-loader';

// Hooks
import { useAutoScroll } from '@/hooks/useAutoScroll';
import { useParamUpdate } from '@/hooks/useParamUpdate';

// Constants
import { PARAM_PHASES } from '@/lib/constants';

export default function App() {
  // ── State ──
  const [prompt, setPrompt] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [provider, setProvider] = useState('mimo');
  const [parameters, setParameters] = useState<Parameter[]>([]);
  const [currentCode, setCurrentCode] = useState('');
  const [stlUrl, setStlUrl] = useState<string | null>(null);
  const [stlObjectUrl, setStlObjectUrl] = useState<string | null>(null);
  const [stepBase64, setStepBase64] = useState<string | undefined>(undefined);
  const [stlBase64, setStlBase64] = useState<string | undefined>(undefined);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [streamReasoning, setStreamReasoning] = useState('');
  const [reasoningEnabled, setReasoningEnabled] = useState(true);
  const [exportFilename, setExportFilename] = useState('model');
  const [snapshots, setSnapshots] = useState<Record<string, string>>({});
  const [dimViews, setDimViews] = useState<Record<string, string>>({});
  const [inspection, setInspection] = useState<InspectionData | null>(null);

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
    onStlBase64Update: setStlBase64,
    onRevokeUrl: URL.revokeObjectURL,
    onParametersUpdate: setParameters,
    onSnapshotsUpdate: setSnapshots,
    onDimViewsUpdate: setDimViews,
    onInspectionUpdate: setInspection,
  });

  // Cleanup
  useEffect(() => {
    return () => { if (stlObjectUrl) URL.revokeObjectURL(stlObjectUrl); };
  }, [stlObjectUrl]);

  // ── Handlers ──
  const handleGenerate = useCallback(async (answers?: string, overridePrompt?: string) => {
    const activePrompt = overridePrompt ?? prompt;
    if (!activePrompt.trim() || isGenerating) return;

    const isClarificationContinue = !!overridePrompt;
    const userMsg: Message = { role: 'user', content: activePrompt };
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: userMsg.content, provider, history: messages, answers, reasoning: reasoningEnabled }),
      });
      if (!res.ok) throw new Error(`Server error: ${res.status}`);

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '', finalData: any = null, currentEvent = '';
      let clarifyQuestions: ClarificationOption[] | null = null;
      let clarifyPrompt = '';
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
        return [...prev, { role: 'assistant', content: '', provider, steps: [] }];
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
                clarifyPrompt = data.originalPrompt || userMsg.content;
              } else if (currentEvent === 'inspection') {
                liveInspection = data.inspection;
                setInspection(data.inspection);
              } else if (currentEvent === 'snapshots') {
                liveSnapshots = { ...liveSnapshots, ...data.snapshots };
                setSnapshots(prev => ({ ...prev, ...data.snapshots }));
              } else if (currentEvent === 'dim-views') {
                liveDimViews = { ...liveDimViews, ...data.dimViews };
                console.log('[DIM-VIEWS] received', Object.keys(data.dimViews || {}));
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
                // Safety: ensure any running steps are marked done when the final payload arrives
                const remainingRunning = liveSteps.filter(s => s.status === 'running');
                if (remainingRunning.length > 0) {
                  const updated = liveSteps.map(s => s.status === 'running' ? { ...s, status: 'done' as const, detail: s.detail || 'Complete' } : s);
                  updateSteps(updated);
                }
                console.log('[DONE] dimViews keys:', Object.keys(Object.keys(liveDimViews).length > 0 ? liveDimViews : (finalData.dimViews || {})));
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
        // Replace the placeholder with clarification
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
            ? `Generated (best effort) — ${finalData.warning || 'model had issues'}`
            : finalData.visionVerified
            ? `Generated with ${finalData.provider || provider} (vision-verified)`
            : `Generated with ${finalData.provider || provider}`,
          reasoning: finalData.reasoning,
          provider: finalData.provider,
          bestEffort: finalData.bestEffort,
          warning: finalData.warning,
          inspection: finalData.inspection,
          snapshots: finalData.snapshots,
          dimViews: Object.keys(liveDimViews).length > 0 ? liveDimViews : (finalData.dimViews || {}),
          visionVerified: finalData.visionVerified,
          visionFeedback: visionFeedback || undefined,
          steps: liveSteps,
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
          finalData.parameters.forEach((p: Parameter) => { vals[p.name] = p.default; });
          setParamValues(vals);
        }
        setStlBase64(finalData.stlBase64);
        setStepBase64(finalData.stepBase64);
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
      }
    } catch (e: any) {
      const errorMsg = e.message?.includes('Failed to fetch')
        ? 'Cannot connect to server. Make sure ai-server and cad-server are running.'
        : e.message;
      const errorMsgObj: Message = { role: 'assistant', content: `Error: ${errorMsg}`, error: errorMsg };
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
  }, [prompt, isGenerating, provider, messages, stlObjectUrl, reasoningEnabled, setParamValues]);

  const handleClarificationSubmit = useCallback((answers: string, answerList: { question: string; answer: string }[]) => {
    const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
    if (!lastUserMsg) return;
    setMessages(prev => [
      ...prev.filter(m => !m.clarification),
      { role: 'user', content: answers, clarificationAnswers: answerList }
    ]);
    handleGenerate(answers, lastUserMsg.content);
  }, [handleGenerate, messages]);

  const handleNewTask = () => {
    setMessages([]);
    setParameters([]);
    setCurrentCode('');
    setStlUrl(null);
    setStlBase64(undefined);
    setStepBase64(undefined);
    if (stlObjectUrl) URL.revokeObjectURL(stlObjectUrl);
    setStlObjectUrl(null);
    setPrompt('');
    setStreamReasoning('');
    setExportFilename('model');
    setSnapshots({});
    setDimViews({});
    setInspection(null);
    resetParams();
  };

  const hasModel = messages.length > 0 || isGenerating;

  // ── Render ──
  return (
    <div className="flex h-dvh overflow-hidden">
      <Sidebar isOpen={sidebarOpen} onNewTask={handleNewTask} />

      <div className="relative flex-1 overflow-auto bg-adam-bg-dark">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="bg-adam-neutral-800 fixed z-10 h-7 w-7 rounded-md text-adam-text-secondary hover:bg-adam-neutral-700 hover:text-adam-text-primary transition-[left] duration-300 ease-in-out"
          style={{ left: sidebarOpen ? '272px' : '80px', top: '14px' }}
        >
          <PanelLeft className="h-4 w-4 mx-auto" />
        </button>

        <div className={`h-full bg-adam-bg-dark ${sidebarOpen ? 'p-6' : 'p-0'}`}>
          <div className="h-full bg-adam-bg-secondary-dark rounded-xl overflow-hidden flex">

            {!hasModel ? (
              /* ─── Landing ─── */
              <LampContainer className="flex-1 min-h-0">
                <h1 className="mb-8 text-center text-2xl font-medium text-adam-text-primary md:text-3xl">
                  What can VibeCAD help you build today?
                </h1>
                <GlowCard glowColor="blue" customSize className="w-full max-w-2xl">
                  <div className="space-y-4">
                    <ChatInput
                      prompt={prompt} setPrompt={setPrompt} onSubmit={handleGenerate}
                      isGenerating={isGenerating} isFocused={isFocused} setIsFocused={setIsFocused}
                      provider={provider} setProvider={setProvider}
                      placeholder="Start building with VibeCAD..."
                      reasoningEnabled={reasoningEnabled} setReasoningEnabled={setReasoningEnabled}
                      showAnimatedPlaceholder
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
              /* ─── Editor ─── */
              <div className="flex h-full w-full">

                {/* Chat Panel */}
                <div className="flex h-full w-[30%] min-w-[384px] max-w-[550px] flex-col border-r border-adam-neutral-700 bg-adam-bg-secondary-dark shrink-0">
                  <div className="relative flex h-full min-w-0 flex-col border-r border-adam-neutral-700 bg-adam-bg-secondary-dark">
                    <div className="flex items-center justify-between p-3">
                      <span className="text-sm font-medium text-adam-text-primary">Chat</span>
                    </div>
                    <div ref={chatContainerRef} onScroll={handleScroll} className="flex-1 overflow-y-auto px-3 pb-3 space-y-3">
                      {messages.map((msg, i) => (
                        msg.clarification ? (
                          <ClarificationMessage key={i} questions={msg.clarification} onSubmit={handleClarificationSubmit} />
                        ) : (
                          (isGenerating && i === messages.length - 1 && msg.role === 'assistant' && !msg.content) ? null : (
                          <div key={i} className={`rounded-xl p-3 text-sm ${msg.role === 'user' ? 'bg-adam-background-1' : msg.error ? 'bg-red-500/10' : 'bg-adam-background-1'}`}>
                            <div className="text-[10px] text-adam-text-tertiary mb-1 font-medium">
                              {msg.role === 'user' ? 'You' : msg.provider || 'VibeCAD'}
                            </div>
                            {msg.clarificationAnswers && msg.clarificationAnswers.length > 0 ? (
                              <ClarificationAnswers answers={msg.clarificationAnswers} />
                            ) : (
                              <div className="text-adam-text-primary leading-relaxed">{msg.content}</div>
                            )}

                            {/* Workflow Timeline */}
                            {msg.steps && msg.steps.length > 0 && (
                              <WorkflowTimeline steps={msg.steps} reasoning={msg.reasoning} />
                            )}

                            {/* Inline snapshots in chat */}
                            {msg.snapshots && Object.keys(msg.snapshots).length > 0 && (
                              <div className="mt-3 grid grid-cols-3 gap-1.5">
                                {Object.entries(msg.snapshots).filter(([_, svg]) => svg && !svg.includes('error')).map(([view, svg]) => (
                                  <div key={view} className="rounded-lg overflow-hidden border border-adam-neutral-700/50 bg-adam-bg-dark/50">
                                    <div className="h-20 flex items-center justify-center" dangerouslySetInnerHTML={{ __html: svg }} />
                                    <div className="text-center text-[8px] text-adam-text-tertiary py-0.5 uppercase tracking-wider">{view}</div>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Inline 2D dimensional views in chat */}
                            {msg.dimViews && Object.keys(msg.dimViews).length > 0 && (
                              <DimViews dimViews={msg.dimViews} />
                            )}

                            {/* Badges */}
                            <div className="flex flex-wrap gap-2 mt-2">
                              {msg.visionVerified && (
                                <span className="inline-flex items-center gap-1.5 text-[10px] text-emerald-400 bg-emerald-400/10 rounded-full px-2.5 py-1">
                                  <Eye className="h-3 w-3" /> Vision-verified
                                </span>
                              )}
                              {msg.bestEffort && (
                                <span className="inline-flex items-center gap-1.5 text-[10px] text-yellow-400 bg-yellow-400/10 rounded-full px-2.5 py-1">
                                  Best effort
                                </span>
                              )}
                            </div>

                            {msg.warning && (
                              <div className="mt-2 text-[10px] text-yellow-400 bg-yellow-500/10 rounded-md px-2 py-1.5">
                                {msg.warning}
                              </div>
                            )}
                          </div>
                          )
                        )
                      ))}
                      {isGenerating && (
                        <StreamingMessage
                          reasoning={streamReasoning}
                          steps={messages.length > 0 && messages[messages.length - 1].role === 'assistant'
                            ? messages[messages.length - 1].steps
                            : undefined}
                        />
                      )}
                      <div ref={chatEndRef} />
                    </div>
                    <div className="border-t border-adam-neutral-700 p-3">
                      <ChatInput
                        prompt={prompt} setPrompt={setPrompt} onSubmit={handleGenerate}
                        isGenerating={isGenerating} isFocused={isFocused} setIsFocused={setIsFocused}
                        provider={provider} setProvider={setProvider}
                        placeholder="Modify your model..."
                        reasoningEnabled={reasoningEnabled} setReasoningEnabled={setReasoningEnabled}
                      />
                    </div>
                  </div>
                </div>

                {/* Preview Panel */}
                <PreviewPanel
                  stlUrl={stlUrl}
                  paramUpdateKey={paramUpdateKey}
                  isParamUpdating={isParamUpdating}
                  provider={provider}
                />

                {/* Right Panel */}
                <div className="flex h-full w-[320px] max-w-[384px] shrink-0 flex-col overflow-y-auto bg-adam-bg-secondary-dark border-l border-adam-neutral-700">

                  {/* Inspection */}
                  {inspection && <InspectionPanel inspection={inspection} />}

                  {/* Snapshots */}
                  {Object.keys(snapshots).length > 0 && <SnapshotGallery snapshots={snapshots} />}

                  {/* Dimensional Views */}
                  {Object.keys(dimViews).length > 0 && (
                    <div className="p-4 border-b border-adam-neutral-700">
                      <h3 className="text-xs font-semibold text-adam-text-tertiary uppercase tracking-wider mb-3">Dimensional Views</h3>
                      <DimViews dimViews={dimViews} />
                    </div>
                  )}

                  {/* Parameters */}
                  {parameters.length > 0 && (
                    <div className="p-4 border-b border-adam-neutral-700">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-xs font-semibold text-adam-text-tertiary uppercase tracking-wider">Parameters</h3>
                        <span className="text-[10px] text-adam-text-tertiary">{parameters.length} params</span>
                      </div>
                      <ParameterPanel parameters={parameters} values={paramValues} onChange={handleParamChange} />
                      {isParamUpdating && (
                        <div className="mt-3">
                          <ProgressiveFluxLoader phases={PARAM_PHASES} showLabel={false} barClassName="h-1.5" className="gap-0" />
                        </div>
                      )}
                      {paramError && (
                        <div className="mt-2 text-[10px] text-red-400 bg-red-500/10 rounded-md px-2 py-1.5">
                          {paramError}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Export */}
                  <ExportSection
                    stlBase64={stlBase64}
                    stepBase64={stepBase64}
                    exportFilename={exportFilename}
                    setExportFilename={setExportFilename}
                  />

                  {/* Code */}
                  {currentCode && <CodeSection code={currentCode} />}

                  {/* Empty State */}
                  {parameters.length === 0 && !currentCode && (
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
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
