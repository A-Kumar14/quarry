const KEY = 'quarry_source_library';

function getDomain(url) {
  try { return new URL(url).hostname.replace('www.', ''); }
  catch { return url; }
}

export function addSourcesToLibrary(sources, query) {
  if (!sources?.length || !query?.trim()) return;
  try {
    const existing = getSourceLibrary();
    const byUrl = new Map(existing.map(s => [s.url, s]));
    for (const src of sources) {
      if (!src.url) continue;
      const prev = byUrl.get(src.url);
      if (prev) {
        if (!prev.queries.includes(query)) {
          prev.queries = [...prev.queries, query].slice(0, 8);
        }
        prev.lastSeen = Date.now();
      } else {
        byUrl.set(src.url, {
          url:      src.url,
          title:    src.title   || '',
          favicon:  src.favicon || '',
          domain:   getDomain(src.url),
          queries:  [query],
          savedAt:  Date.now(),
          lastSeen: Date.now(),
        });
      }
    }
    localStorage.setItem(KEY, JSON.stringify([...byUrl.values()]));
  } catch { /* ignore storage errors */ }
}

export function getSourceLibrary() {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); }
  catch { return []; }
}

export function removeSourceFromLibrary(url) {
  try {
    const lib = getSourceLibrary().filter(s => s.url !== url);
    localStorage.setItem(KEY, JSON.stringify(lib));
  } catch {}
}

export function clearSourceLibrary() {
  try { localStorage.removeItem(KEY); } catch {}
}
