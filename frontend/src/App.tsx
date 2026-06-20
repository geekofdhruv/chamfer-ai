import { useState, useRef, useCallback, useEffect } from 'react';
import { PanelLeft } from 'lucide-react';
import type { Parameter, Message } from '@/types';
import { API_URL } from '@/lib/constants';

// Components
import { Sidebar } from '@/components/layout/Sidebar';
import { PreviewPanel } from '@/components/layout/PreviewPanel';
import { ChatInput } from '@/components/chat/ChatInput';
import { StreamingMessage } from '@/components/chat/StreamingMessage';
import { ClarificationMessage } from '@/components/chat/ClarificationMessage';
import { ParameterPanel } from '@/components/cad/ParameterPanel';
import { ExportSection } from '@/components/cad/ExportSection';
import { CodeSection } from '@/components/cad/CodeSection';
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
  const [provider, setProvider] = useState('mimo-flash');
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

  // Refs for streaming
  const reasoningBufferRef = useRef('');
  const reasoningRafRef = useRef<number | null>(null);

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
  });

  // Cleanup
  useEffect(() => {
    return () => { if (stlObjectUrl) URL.revokeObjectURL(stlObjectUrl); };
  }, [stlObjectUrl]);

  // ── Handlers ──
  const handleGenerate = useCallback(async (answers?: string, overridePrompt?: string) => {
    const activePrompt = overridePrompt ?? prompt;
    if (!activePrompt.trim() || isGenerating) return;

    const userMsg: Message = { role: 'user', content: activePrompt };
    setMessages(prev => [...prev, userMsg]);
    setPrompt('');
    setIsGenerating(true);
    setStreamReasoning('');
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
      let clarifyQuestions: string[] | null = null;
      let clarifyPrompt = '';

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
              } else if (currentEvent === 'done') {
                finalData = data;
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
        setMessages(prev => [...prev, { role: 'assistant', content: '', clarification: clarifyQuestions }]);
        setIsGenerating(false);
        setStreamReasoning('');
        reasoningBufferRef.current = '';
        if (reasoningRafRef.current) { cancelAnimationFrame(reasoningRafRef.current); reasoningRafRef.current = null; }
        return;
      }

      // Handle success
      if (finalData) {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: `Generated with ${finalData.provider || provider}`,
          reasoning: finalData.reasoning,
          provider: finalData.provider,
        }]);
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
      }
    } catch (e: any) {
      const errorMsg = e.message?.includes('Failed to fetch')
        ? 'Cannot connect to server. Make sure ai-server and cad-server are running.'
        : e.message;
      setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${errorMsg}`, error: errorMsg }]);
    } finally {
      setIsGenerating(false);
      setStreamReasoning('');
      reasoningBufferRef.current = '';
      if (reasoningRafRef.current) { cancelAnimationFrame(reasoningRafRef.current); reasoningRafRef.current = null; }
    }
  }, [prompt, isGenerating, provider, messages, stlObjectUrl, reasoningEnabled, setParamValues]);

  const handleClarificationSubmit = useCallback((answers: string) => {
    const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
    if (!lastUserMsg) return;
    setMessages(prev => prev.filter(m => !m.clarification));
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
                          <div key={i} className={`rounded-xl p-3 text-sm ${msg.role === 'user' ? 'bg-adam-background-1' : msg.error ? 'bg-red-500/10' : 'bg-adam-background-1'}`}>
                            <div className="text-[10px] text-adam-text-tertiary mb-1 font-medium">
                              {msg.role === 'user' ? 'You' : msg.provider || 'VibeCAD'}
                            </div>
                            <div className="text-adam-text-primary leading-relaxed">{msg.content}</div>
                            {msg.reasoning && reasoningEnabled && (
                              <details className="mt-2">
                                <summary className="text-[10px] text-adam-text-tertiary cursor-pointer hover:text-adam-text-secondary">
                                  Show reasoning ({msg.reasoning.length} chars)
                                </summary>
                                <div className="mt-1 text-[11px] text-adam-text-tertiary bg-adam-bg-dark rounded-lg p-2 max-h-48 overflow-y-auto whitespace-pre-wrap font-mono">
                                  {msg.reasoning}
                                </div>
                              </details>
                            )}
                          </div>
                        )
                      ))}
                      {isGenerating && <StreamingMessage reasoning={streamReasoning} />}
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
