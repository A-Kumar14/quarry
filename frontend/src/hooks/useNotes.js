import { useCallback, useEffect, useMemo, useState } from 'react';

const API = process.env.REACT_APP_API_URL || 'http://localhost:8000';
const DOCUMENTS_KEY = 'quarry_documents';

function safeJsonParse(raw, fallback) {
  try { return JSON.parse(raw); } catch { return fallback; }
}

function normalizeTopic(topic) {
  if (Array.isArray(topic)) return topic.map(t => String(t || '').trim()).filter(Boolean);
  if (typeof topic === 'string') {
    const value = topic.trim();
    return value ? [value] : [];
  }
  return [];
}

function normalizeLocalNote(doc = {}) {
  const updatedAt = typeof doc.updatedAt === 'number'
    ? new Date(doc.updatedAt).toISOString()
    : (doc.updatedAt || new Date().toISOString());
  const createdAt = typeof doc.createdAt === 'number'
    ? new Date(doc.createdAt).toISOString()
    : (doc.createdAt || updatedAt);

  return {
    id: String(doc.id || ''),
    title: String(doc.title || 'Untitled note'),
    body: String(doc.content || doc.body || ''),
    topic: normalizeTopic(doc.topic),
    createdAt,
    updatedAt,
  };
}

function writeLocalNotes(notes) {
  const docs = notes.map(n => ({
    id: n.id,
    title: n.title || 'Untitled note',
    content: n.body || '',
    topic: normalizeTopic(n.topic),
    createdAt: Date.parse(n.createdAt || '') || Date.now(),
    updatedAt: Date.parse(n.updatedAt || '') || Date.now(),
    wordCount: String(n.body || '').split(/\s+/).filter(Boolean).length,
  }));
  localStorage.setItem(DOCUMENTS_KEY, JSON.stringify(docs));
}

export function useNotes() {
  const [notes, setNotes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const readLocal = useCallback(() => {
    const raw = safeJsonParse(localStorage.getItem(DOCUMENTS_KEY) || '[]', []);
    const normalized = raw
      .map(normalizeLocalNote)
      .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
    return normalized;
  }, []);

  const refresh = useCallback(() => {
    try {
      setNotes(readLocal());
      setError('');
    } catch {
      setError('Unable to load notes');
    } finally {
      setIsLoading(false);
    }
  }, [readLocal]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === DOCUMENTS_KEY) refresh();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [refresh]);

  const createNote = useCallback(async (payload = {}) => {
    const now = new Date().toISOString();
    const note = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2),
      title: String(payload.title || 'Untitled note'),
      body: String(payload.body || ''),
      topic: normalizeTopic(payload.topic),
      createdAt: now,
      updatedAt: now,
    };
    const next = [note, ...notes];
    setNotes(next);
    writeLocalNotes(next);
    return note;
  }, [notes]);

  const updateNote = useCallback(async (id, patch = {}) => {
    let updated = null;
    const next = notes.map((note) => {
      if (note.id !== id) return note;
      updated = {
        ...note,
        ...patch,
        topic: patch.topic ? normalizeTopic(patch.topic) : note.topic,
        updatedAt: new Date().toISOString(),
      };
      return updated;
    });
    setNotes(next);
    writeLocalNotes(next);
    return updated;
  }, [notes]);

  const getSuggestionPayload = useMemo(() => (
    notes.map(n => ({
      id: n.id,
      title: n.title,
      body: n.body,
      topic: n.topic,
    }))
  ), [notes]);

  const fetchSuggestions = useCallback(async () => {
    const resp = await fetch(`${API}/notes/suggestions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes: getSuggestionPayload }),
    });
    if (!resp.ok) throw new Error('suggestions_failed');
    const data = await resp.json();
    return Array.isArray(data?.suggestions) ? data.suggestions : [];
  }, [getSuggestionPayload]);

  return {
    notes,
    isLoading,
    error,
    refresh,
    createNote,
    updateNote,
    fetchSuggestions,
  };
}
