import { createContext, useContext, useState } from 'react';

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

/** Returns the total top offset (px). No fixed global bars remain. */
export function useTopOffset() {
  return 0;
}
