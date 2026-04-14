import { useState, useEffect, useRef } from 'react';
import type { DeepResponse, SessionContext } from '../types/deep';

const API = process.env.REACT_APP_API_URL || 'http://localhost:8000';

interface UseDeepAnalysisResult {
  answer: string | null;
  analysis: DeepResponse['analysis'] | null;
  isLoading: boolean;
  error: string | null;
}

/**
 * Fetches the deep analysis for a query from /deep_analyze.
 * Re-runs whenever `query` changes (and is non-empty).
 * `sessionContext` is passed as-is to the endpoint so the backend
 * can use already-fetched sources instead of re-scraping.
 */
export function useDeepAnalysis(
  query: string,
  sessionContext: SessionContext | null,
): UseDeepAnalysisResult {
  const [answer,   setAnswer]   = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<DeepResponse['analysis'] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  // Abort controller so we cancel in-flight requests when query changes
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!query.trim()) return;

    // Cancel any previous in-flight request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsLoading(true);
    setAnswer(null);
    setAnalysis(null);
    setError(null);

    (async () => {
      try {
        const token = localStorage.getItem('quarry_token') || '';
        const res = await fetch(`${API}/deep_analyze`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token && { Authorization: `Bearer ${token}` }),
          },
          signal: controller.signal,
          body: JSON.stringify({
            query,
            session_context: sessionContext ?? { sources: [] },
          }),
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.detail ?? `HTTP ${res.status}`);
        }

        const data: DeepResponse = await res.json();
        setAnswer(data.answer);
        setAnalysis(data.analysis);
      } catch (err: unknown) {
        if ((err as Error).name === 'AbortError') return; // intentional cancel
        setError((err as Error).message ?? 'Deep analysis failed');
      } finally {
        setIsLoading(false);
      }
    })();

    return () => {
      controller.abort();
    };
  }, [query]); // eslint-disable-line react-hooks/exhaustive-deps

  return { answer, analysis, isLoading, error };
}
