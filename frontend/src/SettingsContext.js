import { createContext, useContext, useEffect, useState } from 'react';

const DEFAULTS = {
  showCalendar:           true,
  financeAutoDetect:      true,
  deepModeDefault:        false,
  deepResearchDefault:    false,
  deepResearchDepth:      'standard',   // 'quick' | 'standard' | 'thorough'
  showResearchProgress:   true,
  defaultModel:           'openai/gpt-4o',
  resumeLastStory:        false,
};

function load() {
  try {
    const v = JSON.parse(localStorage.getItem('quarry_settings') || 'null');
    return v && typeof v === 'object' ? { ...DEFAULTS, ...v } : DEFAULTS;
  } catch { return DEFAULTS; }
}

function persist(obj) {
  try { localStorage.setItem('quarry_settings', JSON.stringify(obj)); } catch {}
}

const Ctx = createContext(null);

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(load);

  const set = (key, value) =>
    setSettings(prev => {
      const next = { ...prev, [key]: value };
      persist(next);
      return next;
    });

  return <Ctx.Provider value={{ settings, set }}>{children}</Ctx.Provider>;
}

export function useSettings() {
  return useContext(Ctx);
}

/** Returns the topbar height in px, measured live via ResizeObserver. Falls back to 64. */
export function useTopOffset() {
  const [h, setH] = useState(64);
  useEffect(() => {
    const el = document.getElementById('app-topbar');
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setH(e.contentRect.height));
    ro.observe(el);
    setH(el.getBoundingClientRect().height);
    return () => ro.disconnect();
  }, []);
  return h;
}
