import { useState, useRef, useCallback } from 'react';
import type { ParameterSchema } from '@/types';
import { API_URL } from '@/lib/constants';

interface UseParamUpdateOptions {
  currentCode: string;
  stlObjectUrl: string | null;
  onStlUpdate: (url: string) => void;
  onStepUpdate: (base64: string) => void;
  onStlBase64Update: (base64: string) => void;
  onRevokeUrl: (url: string) => void;
  onParametersUpdate: (params: Record<string, ParameterSchema>) => void;
}

export function useParamUpdate({
  currentCode,
  stlObjectUrl,
  onStlUpdate,
  onStepUpdate,
  onStlBase64Update,
  onRevokeUrl,
  onParametersUpdate,
}: UseParamUpdateOptions) {
  const [paramValues, setParamValues] = useState<Record<string, number>>({});
  const [isParamUpdating, setIsParamUpdating] = useState(false);
  const [paramUpdateKey, setParamUpdateKey] = useState(0);
  const [paramError, setParamError] = useState<string | null>(null);
  const paramDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const paramValuesRef = useRef(paramValues);

  // Keep ref in sync
  const updateParamValues = useCallback((vals: Record<string, number> | ((prev: Record<string, number>) => Record<string, number>)) => {
    setParamValues(prev => {
      const next = typeof vals === 'function' ? vals(prev) : vals;
      paramValuesRef.current = next;
      return next;
    });
  }, []);

  const handleParamChange = useCallback((name: string, value: number) => {
    const newVals = { ...paramValuesRef.current, [name]: value };
    updateParamValues(newVals);
    setParamError(null);

    if (paramDebounceRef.current) clearTimeout(paramDebounceRef.current);

    paramDebounceRef.current = setTimeout(async () => {
      setIsParamUpdating(true);
      try {
        const res = await fetch(`${API_URL}/api/update-params`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: currentCode, params: newVals }),
        });
        const data = await res.json();

        if (!data.success) {
          setParamError(data.error || 'Update failed');
          return;
        }

        if (data.stlBase64) {
          const bytes = Uint8Array.from(atob(data.stlBase64), c => c.charCodeAt(0));
          const blob = new Blob([bytes], { type: 'application/octet-stream' });
          const url = URL.createObjectURL(blob);
          if (stlObjectUrl) onRevokeUrl(stlObjectUrl);
          onStlUpdate(url);
          onStlBase64Update(data.stlBase64);
        }

        if (data.stepBase64) onStepUpdate(data.stepBase64);

        if (data.parameters) {
          const paramsObj = Array.isArray(data.parameters)
            ? Object.fromEntries(data.parameters.map((p: any) => [p.name, p]))
            : data.parameters;
          onParametersUpdate(paramsObj);
          const vals: Record<string, number> = {};
          Object.entries(paramsObj).forEach(([name, schema]: [string, any]) => {
            if (typeof schema.default === 'number') {
              vals[name] = newVals[name] ?? schema.default;
            }
          });
          updateParamValues(prev => ({ ...prev, ...vals }));
        }

        setParamUpdateKey(k => k + 1);
      } catch (e) {
        console.error('Param update failed:', e);
        setParamError(String(e));
      } finally {
        setIsParamUpdating(false);
      }
    }, 300);
  }, [currentCode, stlObjectUrl, updateParamValues, onStlUpdate, onStepUpdate, onStlBase64Update, onRevokeUrl, onParametersUpdate]);

  const resetParams = useCallback(() => {
    updateParamValues({});
    setParamError(null);
    setParamUpdateKey(0);
    if (paramDebounceRef.current) clearTimeout(paramDebounceRef.current);
  }, [updateParamValues]);

  return {
    paramValues,
    setParamValues: updateParamValues,
    isParamUpdating,
    paramUpdateKey,
    paramError,
    handleParamChange,
    resetParams,
  };
}
