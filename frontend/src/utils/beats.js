// Keep storage key for backward compatibility with existing local data.
const BEATS_KEY = 'quarry_beats';

export function getBeats() {
  try { return JSON.parse(localStorage.getItem(BEATS_KEY) || '[]'); }
  catch { return []; }
}

export function saveBeat(beat) {
  const beats = getBeats();
  const idx = beats.findIndex(b => b.id === beat.id);
  if (idx >= 0) beats[idx] = beat;
  else beats.push(beat);
  try { localStorage.setItem(BEATS_KEY, JSON.stringify(beats)); }
  catch {}
}

// Topic-oriented aliases (preferred in new UI code).
export const getTopics = getBeats;
export const saveTopic = saveBeat;
export const deleteTopic = deleteBeat;
export const incrementTopicActivity = incrementBeatActivity;

export function deleteBeat(id) {
  try {
    localStorage.setItem(BEATS_KEY, JSON.stringify(getBeats().filter(b => b.id !== id)));
  } catch {}
}

// Called on every search query. Matches query text against each topic's keywords.
// Increments investigationCount and updates lastActiveAt for any matching topics.
export function incrementBeatActivity(query) {
  if (!query) return;
  const q = query.toLowerCase();
  const beats = getBeats();
  let changed = false;
  const updated = beats.map(beat => {
    const matches = (beat.keywords || []).some(kw => kw && q.includes(kw.toLowerCase()));
    if (!matches) return beat;
    changed = true;
    return { ...beat, investigationCount: (beat.investigationCount || 0) + 1, lastActiveAt: Date.now() };
  });
  if (changed) {
    try { localStorage.setItem(BEATS_KEY, JSON.stringify(updated)); }
    catch {}
  }
}
