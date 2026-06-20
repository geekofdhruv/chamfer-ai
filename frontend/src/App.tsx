import { Canvas, useLoader } from '@react-three/fiber';
import { OrbitControls, Grid, Environment } from '@react-three/drei';
import { useState, useRef, useCallback, useEffect } from 'react';
import * as THREE from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { Plus, PanelLeft, ArrowUp, Loader2, Download, HelpCircle, Brain, Copy, Check } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { ProgressiveFluxLoader } from '@/components/ui/progressive-flux-loader';
import { LampContainer } from '@/components/ui/lamp';
import { GlowCard } from '@/components/ui/spotlight-card';

const API_URL = '';

const PROVIDERS = [
  { id: 'mimo-flash', name: 'Flash', desc: 'Fast' },
  { id: 'mimo-pro', name: 'Pro', desc: 'Quality' },
  { id: '0g', name: '0G', desc: 'Decentralized' },
];

const PLACEHOLDER_PROMPTS = [
  "make me a gear with 12 teeth",
  "design a mounting bracket",
  "create a spring coil",
  "build a phone stand",
  "make a pipe connector",
  "design a gear knob",
  "create a box with rounded edges",
  "make a mechanical pulley",
];

// ─── Animated Placeholder ────────────────────────────────────────────
function AnimatedPlaceholder({ visible }: { visible: boolean }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!visible) return;
    const interval = setInterval(() => {
      setIndex(prev => (prev + 1) % PLACEHOLDER_PROMPTS.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [visible]);

  if (!visible) return null;

  return (
    <div className="absolute left-4 top-4 pointer-events-none select-none">
      <AnimatePresence mode="wait">
        <motion.span
          key={index}
          className="text-sm text-adam-text-tertiary"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.3 }}
        >
          {PLACEHOLDER_PROMPTS[index]}
        </motion.span>
      </AnimatePresence>
    </div>
  );
}

// ─── Parameter Update Phases ─────────────────────────────────────────
const PARAM_PHASES = [
  { at: 0, label: "rebuilding geometry" },
  { at: 40, label: "applying parameters" },
  { at: 75, label: "generating mesh" },
  { at: 100, label: "complete" },
];

interface Parameter { name: string; default: number; min: number; max: number; step: number; }
interface Message { role: 'user' | 'assistant'; content: string; reasoning?: string; provider?: string; error?: string; clarification?: string[]; }

// ─── Inline Clarification Message ─────────────────────────────────────
function ClarificationMessage({ questions, onSubmit }: { questions: string[]; onSubmit: (answers: string) => void }) {
  const [answers, setAnswers] = useState<string[]>(questions.map(() => ''));
  const [autoDecide, setAutoDecide] = useState<boolean[]>(questions.map(() => false));

  const toggleAutoDecide = (idx: number) => {
    setAutoDecide(prev => { const next = [...prev]; next[idx] = !next[idx]; return next; });
    if (!autoDecide[idx]) {
      setAnswers(prev => { const next = [...prev]; next[idx] = ''; return next; });
    }
  };

  const handleSubmit = () => {
    const formatted = questions.map((q, i) => {
      const a = autoDecide[i] ? '(let model decide)' : (answers[i] || '(not specified)');
      return `Q: ${q}\nA: ${a}`;
    }).join('\n');
    onSubmit(formatted);
  };

  const handleAllDecide = () => {
    setAutoDecide(questions.map(() => true));
    setAnswers(questions.map(() => ''));
  };

  return (
    <div className="rounded-xl p-3 text-sm bg-adam-background-1 border border-adam-blue/30">
      <div className="text-[10px] text-adam-blue mb-2 font-medium flex items-center gap-1.5">
        <HelpCircle className="h-3.5 w-3.5" /> VibeCAD needs more details
      </div>
      <div className="space-y-3 mb-3">
        {questions.map((q, i) => (
          <div key={i}>
            <label className="text-xs text-adam-text-secondary mb-1 block">{q}</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={autoDecide[i] ? '' : answers[i]}
                onChange={e => { const next = [...answers]; next[i] = e.target.value; setAnswers(next); }}
                onKeyDown={e => { if (e.key === 'Enter' && i === questions.length - 1) handleSubmit(); }}
                placeholder={autoDecide[i] ? 'Model will decide...' : 'Type your answer...'}
                disabled={autoDecide[i]}
                className={`flex-1 border rounded-lg px-3 py-1.5 text-sm outline-none transition-colors ${
                  autoDecide[i]
                    ? 'bg-adam-bg-dark/50 border-adam-neutral-700 text-adam-text-tertiary cursor-not-allowed'
                    : 'bg-adam-bg-dark border-adam-neutral-700 text-adam-text-primary focus:border-adam-blue placeholder:text-adam-text-tertiary'
                }`}
                autoFocus={i === 0}
              />
              <button
                onClick={() => toggleAutoDecide(i)}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium whitespace-nowrap transition-colors ${
                  autoDecide[i]
                    ? 'bg-adam-blue/20 text-adam-blue border border-adam-blue/40'
                    : 'bg-adam-neutral-800 text-adam-text-tertiary border border-adam-neutral-700 hover:bg-adam-neutral-700 hover:text-adam-text-secondary'
                }`}
                title={autoDecide[i] ? 'Click to type your own answer' : 'Let the model pick a reasonable value'}
              >
                {autoDecide[i] ? 'Auto' : 'Auto'}
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <button
          onClick={handleAllDecide}
          className="flex-1 rounded-lg border border-adam-neutral-700 px-3 py-1.5 text-xs text-adam-text-secondary hover:bg-adam-neutral-800 transition-colors"
        >
          Let model decide all
        </button>
        <button
          onClick={handleSubmit}
          className="flex-1 rounded-lg bg-adam-blue px-3 py-1.5 text-xs text-white hover:bg-adam-blue/80 transition-colors font-medium"
        >
          Generate
        </button>
      </div>
    </div>
  );
}

// ─── STL Model ───────────────────────────────────────────────────────
function STLModel({ url, updating }: { url: string; updating: boolean }) {
  const geometry = useLoader(STLLoader, url);
  const ref = useRef<THREE.Mesh>(null);
  useEffect(() => {
    if (ref.current && geometry) {
      geometry.computeVertexNormals();
      const box = new THREE.Box3().setFromBufferAttribute(geometry.attributes.position as THREE.BufferAttribute);
      const center = box.getCenter(new THREE.Vector3());
      geometry.translate(-center.x, -center.y, -center.z);
    }
  }, [geometry]);
  return (
    <mesh ref={ref} geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial color="#888" metalness={0.3} roughness={0.4} transparent={updating} opacity={updating ? 0.4 : 1} />
    </mesh>
  );
}

// ─── Sidebar ─────────────────────────────────────────────────────────
function Sidebar({ isOpen, onNewTask }: { isOpen: boolean; onNewTask: () => void }) {
  return (
    <div className={`${isOpen ? 'w-64' : 'w-16'} flex h-full flex-shrink-0 flex-col bg-adam-bg-dark transition-all duration-300 ease-in-out`}>
      <div className="p-4">
        <button className="flex w-full items-center" onClick={onNewTask}>
          {isOpen ? (
            <span className="text-lg font-bold text-adam-text-primary tracking-tight">VibeCAD</span>
          ) : (
            <span className="text-lg font-bold text-adam-text-primary tracking-tight">V</span>
          )}
        </button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col">
        <div className={`${isOpen ? 'px-4' : 'px-2'} py-2`}>
          <div className={isOpen ? 'ml-[9px]' : 'ml-0'}>
            <button
              onClick={onNewTask}
              className={`${isOpen
                ? 'flex w-[216px] items-center justify-start gap-2 rounded-full border border-adam-blue bg-adam-background-1 px-4 py-3 text-adam-neutral-200 hover:bg-adam-blue/40 hover:text-adam-text-primary'
                : 'flex h-[30px] w-[30px] items-center justify-center rounded-lg border-2 border-adam-blue bg-adam-bg-dark p-[2px] text-adam-neutral-200 shadow-adam hover:bg-adam-blue/40'
              } mb-4 transition-colors`}
            >
              <Plus className="h-5 w-5" />
              {isOpen && <span className="text-sm font-semibold tracking-tight">New Creation</span>}
            </button>
          </div>
        </div>
        <div className="flex-1" />
        <div className={`${isOpen ? 'px-4' : 'px-2'} py-4`}>
          {isOpen ? (
            <div className="text-[10px] text-adam-text-tertiary leading-relaxed">
              Powered by 0G Compute<br />+ Xiaomi MiMo
            </div>
          ) : (
            <div className="w-8 h-8 rounded-full bg-adam-blue/20 flex items-center justify-center mx-auto">
              <div className="w-2 h-2 rounded-full bg-adam-blue animate-pulse" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Provider Selector ───────────────────────────────────────────────
function ProviderSelector({ selected, onSelect }: { selected: string; onSelect: (id: string) => void }) {
  return (
    <div className="flex gap-1.5">
      {PROVIDERS.map(p => (
        <button
          key={p.id}
          onClick={() => onSelect(p.id)}
          className={`flex-1 rounded-lg px-2 py-1 text-[11px] text-center transition-all ${
            selected === p.id
              ? 'bg-adam-blue/20 text-adam-blue font-medium'
              : 'bg-adam-neutral-800 text-adam-text-tertiary hover:bg-adam-neutral-700 hover:text-adam-text-secondary'
          }`}
        >
          {p.name}
        </button>
      ))}
    </div>
  );
}

// ─── Parameter Panel ─────────────────────────────────────────────────
function ParameterPanel({ parameters, values, onChange }: { parameters: Parameter[]; values: Record<string, number>; onChange: (name: string, value: number) => void }) {
  if (parameters.length === 0) return null;
  return (
    <div className="space-y-2">
      {parameters.map(p => {
        const val = values[p.name] ?? p.default;
        const pct = ((val - p.min) / (p.max - p.min)) * 100;
        return (
          <div key={p.name} className="group rounded-lg bg-adam-bg-dark border border-adam-neutral-700 hover:border-adam-neutral-500 transition-colors">
            <div className="px-3 pt-2.5 pb-1">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] text-adam-text-secondary font-medium tracking-wide">{p.name.replace(/_/g, ' ')}</span>
                <span className="text-[11px] text-adam-blue font-mono font-semibold tabular-nums">{val.toFixed(1)}</span>
              </div>
              <div className="relative h-5 flex items-center">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full h-1 rounded-full bg-adam-neutral-700 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-adam-blue/80 to-adam-blue transition-all duration-75"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
                <input
                  type="range"
                  min={p.min}
                  max={p.max}
                  step={p.step}
                  value={val}
                  onChange={e => onChange(p.name, parseFloat(e.target.value))}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div
                  className="absolute w-3.5 h-3.5 rounded-full bg-white shadow-md border-2 border-adam-blue pointer-events-none transition-transform group-hover:scale-110"
                  style={{ left: `calc(${pct}% - 7px)` }}
                />
              </div>
            </div>
            <div className="flex justify-between px-3 pb-2 pt-0.5">
              <span className="text-[9px] text-adam-text-tertiary font-mono">{p.min}</span>
              <span className="text-[9px] text-adam-text-tertiary font-mono">{p.max}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Chat Input ──────────────────────────────────────────────────────
function ChatInput({ prompt, setPrompt, onSubmit, isGenerating, isFocused, setIsFocused, provider, setProvider, placeholder, reasoningEnabled, setReasoningEnabled, showAnimatedPlaceholder }: {
  prompt: string; setPrompt: (v: string) => void; onSubmit: () => void; isGenerating: boolean;
  isFocused: boolean; setIsFocused: (v: boolean) => void; provider: string; setProvider: (v: string) => void;
  placeholder: string; reasoningEnabled: boolean; setReasoningEnabled: (v: boolean) => void;
  showAnimatedPlaceholder?: boolean;
}) {
  return (
    <div className={`relative rounded-2xl border-2 transition-all duration-300 ${isFocused ? 'border-adam-blue shadow-[inset_0px_0px_8px_0px_rgba(0,0,0,0.08)]' : 'border-adam-neutral-700 shadow-[inset_0px_0px_8px_0px_rgba(0,0,0,0.08)] hover:border-adam-neutral-400'} bg-adam-background-2`}>
      {showAnimatedPlaceholder && !prompt && !isFocused && (
        <AnimatedPlaceholder visible />
      )}
      <textarea
        className="w-full bg-transparent p-4 text-sm text-adam-text-primary resize-none outline-none placeholder:text-adam-text-tertiary"
        rows={3}
        placeholder={showAnimatedPlaceholder ? '' : placeholder}
        value={prompt}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        onChange={e => setPrompt(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSubmit(); } }}
      />
      <div className="flex items-center justify-between px-4 pb-3">
        <div className="flex items-center gap-2 flex-1 max-w-[300px]">
          <ProviderSelector selected={provider} onSelect={setProvider} />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setReasoningEnabled(!reasoningEnabled)}
            className={`flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] transition-all ${
              reasoningEnabled
                ? 'bg-adam-blue/20 text-adam-blue'
                : 'bg-adam-neutral-800 text-adam-text-tertiary hover:bg-adam-neutral-700'
            }`}
            title={reasoningEnabled ? 'Reasoning ON — model thinks before generating' : 'Reasoning OFF — faster generation'}
          >
            <Brain className="h-3 w-3" />
            {reasoningEnabled ? 'Think' : 'Fast'}
          </button>
          <button
            onClick={() => onSubmit()}
            disabled={isGenerating || !prompt.trim()}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-adam-blue text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-adam-blue/80 transition-colors"
          >
            <ArrowUp className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Streaming Message ───────────────────────────────────────────────
function StreamingMessage({ reasoning }: { reasoning: string }) {
  return (
    <div className="bg-adam-background-1 rounded-xl p-3 text-sm">
      <div className="flex items-center gap-2 mb-2">
        <div className="text-[10px] text-adam-text-tertiary font-medium">Generating...</div>
        <div className="flex gap-1">
          <span className="w-1 h-1 bg-adam-text-secondary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-1 h-1 bg-adam-text-secondary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="w-1 h-1 bg-adam-text-secondary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
      {reasoning && (
        <details open className="mt-1">
          <summary className="text-[10px] text-adam-text-tertiary cursor-pointer hover:text-adam-text-secondary transition-colors mb-1">
            Thinking... ({reasoning.length} chars)
          </summary>
          <div className="text-[11px] text-adam-text-tertiary bg-adam-bg-dark rounded-lg p-2 leading-relaxed max-h-60 overflow-y-auto whitespace-pre-wrap font-mono">
            {reasoning}
          </div>
        </details>
      )}
    </div>
  );
}

// ─── Main App ────────────────────────────────────────────────────────
export default function App() {
  const [prompt, setPrompt] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [provider, setProvider] = useState('mimo-flash');
  const [parameters, setParameters] = useState<Parameter[]>([]);
  const [paramValues, setParamValues] = useState<Record<string, number>>({});
  const [currentCode, setCurrentCode] = useState('');
  const [stlUrl, setStlUrl] = useState<string | null>(null);
  const [stlObjectUrl, setStlObjectUrl] = useState<string | null>(null);
  const [stepBase64, setStepBase64] = useState<string | undefined>(undefined);
  const [stlBase64, setStlBase64] = useState<string | undefined>(undefined);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [streamReasoning, setStreamReasoning] = useState('');
  const [isParamUpdating, setIsParamUpdating] = useState(false);
  const [paramUpdateKey, setParamUpdateKey] = useState(0);
  const [reasoningEnabled, setReasoningEnabled] = useState(true);
  const [exportFilename, setExportFilename] = useState('model');
  const paramDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);
  const reasoningBufferRef = useRef('');
  const reasoningRafRef = useRef<number | null>(null);
  const [copied, setCopied] = useState(false);
  const copiedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const paramValuesRef = useRef(paramValues);
  const [paramError, setParamError] = useState<string | null>(null);

  useEffect(() => { return () => { if (stlObjectUrl) URL.revokeObjectURL(stlObjectUrl); }; }, [stlObjectUrl]);
  useEffect(() => { paramValuesRef.current = paramValues; }, [paramValues]);

  const scrollToBottom = useCallback(() => {
    const el = chatContainerRef.current;
    if (!el) return;
    isNearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    if (isNearBottomRef.current) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, streamReasoning, scrollToBottom]);

  const handleGenerate = useCallback(async (answers?: string, overridePrompt?: string) => {
    const activePrompt = overridePrompt ?? prompt;
    if (!activePrompt.trim() || isGenerating) return;
    const userMsg: Message = { role: 'user', content: activePrompt };
    setMessages(prev => [...prev, userMsg]);
    setPrompt(''); setIsGenerating(true); setStreamReasoning('');
    reasoningBufferRef.current = '';
    if (reasoningRafRef.current) { cancelAnimationFrame(reasoningRafRef.current); reasoningRafRef.current = null; }
    try {
      const res = await fetch(`${API_URL}/api/generate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
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
        const lines = buffer.split('\n'); buffer = lines.pop() || '';
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
              }
              else if (currentEvent === 'clarify') { clarifyQuestions = data.questions; clarifyPrompt = data.originalPrompt || userMsg.content; }
              else if (currentEvent === 'done') finalData = data;
              else if (currentEvent === 'error') throw new Error(data.error);
            } catch (e: any) { if (e.message && !e.message.includes('JSON')) throw e; }
            currentEvent = '';
          }
        }
      }

      // ── Handle clarification request ──
      if (clarifyQuestions && clarifyQuestions.length > 0 && !finalData) {
        setMessages(prev => [...prev, { role: 'assistant', content: '', clarification: clarifyQuestions }]);
        setIsGenerating(false);
        setStreamReasoning('');
        reasoningBufferRef.current = '';
        if (reasoningRafRef.current) { cancelAnimationFrame(reasoningRafRef.current); reasoningRafRef.current = null; }
        return;
      }

      if (finalData) {
        setMessages(prev => [...prev, { role: 'assistant', content: `Generated with ${finalData.provider || provider}`, reasoning: finalData.reasoning, provider: finalData.provider }]);
        if (finalData.code) setCurrentCode(finalData.code);
        if (finalData.parameters) {
          setParameters(finalData.parameters);
          const vals: Record<string, number> = {};
          finalData.parameters.forEach((p: Parameter) => { vals[p.name] = p.default; });
          setParamValues(vals);
        }
        setStlBase64(finalData.stlBase64); setStepBase64(finalData.stepBase64);
        if (finalData.stlBase64 && finalData.hasStl) {
          const bytes = Uint8Array.from(atob(finalData.stlBase64), c => c.charCodeAt(0));
          const blob = new Blob([bytes], { type: 'application/octet-stream' });
          const url = URL.createObjectURL(blob);
          if (stlObjectUrl) URL.revokeObjectURL(stlObjectUrl);
          setStlObjectUrl(url); setStlUrl(url);
        }
      }
    } catch (e: any) {
      const errorMsg = e.message?.includes('Failed to fetch') ? 'Cannot connect to server. Make sure ai-server and cad-server are running.' : e.message;
      setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${errorMsg}`, error: errorMsg }]);
    } finally {
      setIsGenerating(false); setStreamReasoning('');
      reasoningBufferRef.current = '';
      if (reasoningRafRef.current) { cancelAnimationFrame(reasoningRafRef.current); reasoningRafRef.current = null; }
    }
  }, [prompt, isGenerating, provider, messages, stlObjectUrl]);

  const handleClarificationSubmit = useCallback((answers: string) => {
    const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
    if (!lastUserMsg) return;
    setMessages(prev => prev.filter(m => !m.clarification));
    handleGenerate(answers, lastUserMsg.content);
  }, [handleGenerate, messages]);

  const handleParamChange = useCallback((name: string, value: number) => {
    const newVals = { ...paramValuesRef.current, [name]: value };
    setParamValues(newVals);
    paramValuesRef.current = newVals;
    setParamError(null);
    if (paramDebounceRef.current) clearTimeout(paramDebounceRef.current);
    paramDebounceRef.current = setTimeout(async () => {
      setIsParamUpdating(true);
      try {
        const res = await fetch(`${API_URL}/api/update-params`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: currentCode, params: newVals }) });
        const data = await res.json();
        console.log('[PARAMS] Update response:', { success: data.success, hasStl: data.hasStl, hasStep: data.hasStep, error: data.error });
        if (!data.success) {
          setParamError(data.error || 'Update failed');
          return;
        }
        if (data.stlBase64) {
          const bytes = Uint8Array.from(atob(data.stlBase64), c => c.charCodeAt(0));
          const blob = new Blob([bytes], { type: 'application/octet-stream' });
          const url = URL.createObjectURL(blob);
          if (stlObjectUrl) URL.revokeObjectURL(stlObjectUrl);
          setStlObjectUrl(url); setStlUrl(url);
          setStlBase64(data.stlBase64);
        }
        if (data.stepBase64) setStepBase64(data.stepBase64);
        if (data.parameters?.length) {
          setParameters(data.parameters);
          const vals: Record<string, number> = {};
          data.parameters.forEach((p: Parameter) => { vals[p.name] = newVals[p.name] ?? p.default; });
          setParamValues(prev => ({ ...prev, ...vals }));
        }
        setParamUpdateKey(k => k + 1);
      } catch (e) { console.error('Param update failed:', e); setParamError(String(e)); }
      finally { setIsParamUpdating(false); }
    }, 300);
  }, [currentCode, stlObjectUrl]);

  const handleNewTask = () => {
    setMessages([]); setParameters([]); setParamValues({}); setCurrentCode('');
    setStlUrl(null); setStlBase64(undefined); setStepBase64(undefined);
    if (stlObjectUrl) URL.revokeObjectURL(stlObjectUrl);
    setStlObjectUrl(null); setPrompt(''); setStreamReasoning('');
    setExportFilename('model'); setParamError(null);
    reasoningBufferRef.current = '';
    if (reasoningRafRef.current) { cancelAnimationFrame(reasoningRafRef.current); reasoningRafRef.current = null; }
  };

  const hasModel = messages.length > 0 || isGenerating;

  return (
    <div className="flex h-dvh overflow-hidden">
      {/* Sidebar */}
      <Sidebar isOpen={sidebarOpen} onNewTask={handleNewTask} />

      {/* Main */}
      <div className="relative flex-1 overflow-auto bg-adam-bg-dark">
        {/* Toggle */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="bg-adam-neutral-800 fixed z-10 h-7 w-7 rounded-md text-adam-text-secondary hover:bg-adam-neutral-700 hover:text-adam-text-primary transition-[left] duration-300 ease-in-out"
          style={{ left: sidebarOpen ? '272px' : '80px', top: '14px' }}
        >
          <PanelLeft className="h-4 w-4 mx-auto" />
        </button>

        <div className={`h-full bg-adam-bg-dark ${sidebarOpen ? 'p-6 pt-6' : 'p-0'}`}>
          <div className="h-full bg-adam-bg-secondary-dark rounded-xl overflow-hidden flex">

            {!hasModel ? (
              /* ─── Prompt View (Landing) ─── */
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
              /* ─── Editor View (3 panels) ─── */
              <div className="flex h-full w-full">

                {/* Chat Panel */}
                <div className="flex h-full w-[30%] min-w-[384px] max-w-[550px] flex-col border-r border-adam-neutral-700 bg-adam-bg-secondary-dark shrink-0">
                  <div className="relative flex h-full min-w-0 flex-col border-r border-adam-neutral-700 bg-adam-bg-secondary-dark">
                    {/* Header */}
                    <div className="flex items-center justify-between p-3">
                      <span className="text-sm font-medium text-adam-text-primary">Chat</span>
                    </div>
                    {/* Messages */}
                    <div ref={chatContainerRef} onScroll={() => { const el = chatContainerRef.current; if (el) isNearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120; }} className="flex-1 overflow-y-auto px-3 pb-3 space-y-3">
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
                    {/* Input */}
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
                <div className="flex-1 flex h-full w-full items-center justify-center bg-[#292828] relative">
                    <Canvas camera={{ position: [80, 80, 80], fov: 45 }} gl={{ preserveDrawingBuffer: true, antialias: true }} shadows className="w-full h-full">
                      <ambientLight intensity={0.4} />
                      <directionalLight position={[50, 50, 50]} intensity={1.2} castShadow />
                      <directionalLight position={[-30, 20, -20]} intensity={0.3} />
                      <Environment preset="city" />
                      <Grid args={[200, 200]} cellSize={5} cellThickness={0.5} cellColor="#333" sectionSize={50} sectionThickness={1} sectionColor="#555" fadeDistance={300} infiniteGrid />
                      {stlUrl && <STLModel key={`${stlUrl}-${paramUpdateKey}`} url={stlUrl} updating={isParamUpdating} />}
                      <OrbitControls enableDamping dampingFactor={0.1} />
                    </Canvas>
                    {!stlUrl && (
                      <div className="absolute flex items-center justify-center pointer-events-none">
                        <span className="text-sm text-adam-text-secondary">Send a message to start creating</span>
                      </div>
                    )}
                    {stlUrl && (
                      <div className="absolute top-3 left-3 glass-effect rounded-lg px-3 py-1.5 text-[10px] text-adam-text-secondary">
                        Generated by {provider}
                      </div>
                    )}
                    {isParamUpdating && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="glass-effect rounded-xl px-8 py-6 w-80">
                          <ProgressiveFluxLoader
                            phases={PARAM_PHASES}
                            showLabel
                            className="gap-3"
                            barClassName="h-2"
                            textClassName="text-sm"
                          />
                        </div>
                      </div>
                    )}
                </div>

                {/* Parameters Panel */}
                <div className="flex h-full w-[320px] max-w-[384px] shrink-0 flex-col overflow-y-auto bg-adam-bg-secondary-dark border-l border-adam-neutral-700">

                  {/* Parameters Section */}
                  {parameters.length > 0 && (
                    <div className="p-4 border-b border-adam-neutral-700">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-xs font-semibold text-adam-text-tertiary uppercase tracking-wider">Parameters</h3>
                        <span className="text-[10px] text-adam-text-tertiary">{parameters.length} params</span>
                      </div>
                      <ParameterPanel parameters={parameters} values={paramValues} onChange={handleParamChange} />
                      {isParamUpdating && (
                        <div className="mt-3">
                          <ProgressiveFluxLoader
                            phases={PARAM_PHASES}
                            showLabel={false}
                            barClassName="h-1.5"
                            className="gap-0"
                          />
                        </div>
                      )}
                      {paramError && (
                        <div className="mt-2 text-[10px] text-red-400 bg-red-500/10 rounded-md px-2 py-1.5">
                          {paramError}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Export Section */}
                  {(stlBase64 || stepBase64) && (
                    <div className="p-4 border-b border-adam-neutral-700">
                      <GlowCard glowColor="purple" customSize className="w-full">
                        <h3 className="text-xs font-semibold text-adam-text-tertiary uppercase tracking-wider mb-3">Export</h3>
                        <div className="mb-3">
                          <label className="text-[10px] text-adam-text-tertiary mb-1 block">Filename</label>
                          <input
                            type="text"
                            value={exportFilename}
                            onChange={e => setExportFilename(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ''))}
                            className="w-full bg-adam-bg-dark border border-adam-neutral-700 rounded-lg px-3 py-1.5 text-xs text-adam-text-primary outline-none focus:border-adam-blue transition-colors"
                            placeholder="model"
                          />
                        </div>
                        <div className="flex gap-2">
                          {stlBase64 && (
                            <button
                              onClick={() => {
                                const bytes = Uint8Array.from(atob(stlBase64), c => c.charCodeAt(0));
                                const blob = new Blob([bytes], { type: 'application/octet-stream' });
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement('a'); a.href = url; a.download = `${exportFilename || 'model'}.stl`; a.click();
                                URL.revokeObjectURL(url);
                              }}
                              className="flex items-center gap-1.5 rounded-lg border border-adam-neutral-700 bg-adam-bg-dark px-3 py-2 text-xs text-adam-text-secondary hover:bg-adam-neutral-800 hover:text-adam-text-primary transition-colors flex-1 justify-center"
                            >
                              <Download className="h-3.5 w-3.5" /> STL
                            </button>
                          )}
                          {stepBase64 && (
                            <button
                              onClick={() => {
                                const bytes = Uint8Array.from(atob(stepBase64), c => c.charCodeAt(0));
                                const blob = new Blob([bytes], { type: 'application/octet-stream' });
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement('a'); a.href = url; a.download = `${exportFilename || 'model'}.step`; a.click();
                                URL.revokeObjectURL(url);
                              }}
                              className="flex items-center gap-1.5 rounded-lg border border-adam-neutral-700 bg-adam-bg-dark px-3 py-2 text-xs text-adam-text-secondary hover:bg-adam-neutral-800 hover:text-adam-text-primary transition-colors flex-1 justify-center"
                            >
                              <Download className="h-3.5 w-3.5" /> STEP
                            </button>
                          )}
                        </div>
                      </GlowCard>
                    </div>
                  )}

                  {/* Code Section */}
                  {currentCode && (
                    <div className="p-4 flex-1 min-h-0">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-xs font-semibold text-adam-text-tertiary uppercase tracking-wider">Generated Code</h3>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(currentCode);
                            setCopied(true);
                            if (copiedTimeoutRef.current) clearTimeout(copiedTimeoutRef.current);
                            copiedTimeoutRef.current = setTimeout(() => setCopied(false), 2000);
                          }}
                          className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] text-adam-text-tertiary hover:text-adam-text-secondary hover:bg-adam-neutral-800 transition-colors"
                        >
                          {copied ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
                          {copied ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                      <pre className="text-[11px] text-adam-text-secondary bg-adam-bg-dark rounded-lg p-3 overflow-auto max-h-[calc(100vh-400px)] font-mono leading-relaxed border border-adam-neutral-700">
                        {currentCode}
                      </pre>
                    </div>
                  )}

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
