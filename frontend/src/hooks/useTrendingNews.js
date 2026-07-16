import { useState, useEffect, useCallback } from 'react';

const API = process.env.REACT_APP_API_URL || 'http://localhost:8000';

export const FALLBACK_SUGGESTIONS = [
  { title: 'Latest breakthroughs in quantum computing' },
  { title: 'How does RAG work in AI systems?' },
  { title: 'Best open source LLMs in 2026' },
  { title: 'Explain transformer attention mechanisms' },
  { title: 'FastAPI vs Flask for production APIs' },
  { title: 'Top AI coding assistants compared' },
];

/** Live trending headlines from /explore/trending-news with static fallback. */
export function useTrendingNews() {
  const [articles, setArticles] = useState(FALLBACK_SUGGESTIONS);
  const [trending, setTrending] = useState(false);
  const [spinning, setSpinning] = useState(false);

  const fetchTrending = useCallback(async (force = false) => {
    setSpinning(true);
    try {
      const url = force
        ? `${API}/explore/trending-news?max=6&force=true`
        : `${API}/explore/trending-news?max=6`;
      const res  = await fetch(url);
      if (!res.ok) throw new Error('trending error');
      const data = await res.json();
      const arts = (data.articles || []).filter(a => a.title).slice(0, 6);
      if (arts.length >= 3) { setArticles(arts); setTrending(true); }
    } catch { /* silent fallback */ }
    finally { setSpinning(false); }
  }, []);

  useEffect(() => { fetchTrending(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return { articles, trending, spinning, refetch: () => fetchTrending(true) };
}
