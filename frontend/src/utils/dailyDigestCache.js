const CACHE_PREFIX = 'quarry_daily_digest_cache_v1';

function safeJsonParse(raw, fallback) {
  try { return JSON.parse(raw); } catch { return fallback; }
}

export function buildDailyDigestSignature(profile = {}, beatNames = []) {
  const normalized = {
    role: (profile.role || '').trim().toLowerCase(),
    organization: (profile.organization || '').trim().toLowerCase(),
    beat: (profile.beat || '').trim().toLowerCase(),
    expertise_level: (profile.expertise_level || '').trim().toLowerCase(),
    topics_of_focus: [...(profile.topics_of_focus || [])]
      .map(t => String(t).trim().toLowerCase())
      .filter(Boolean)
      .sort(),
    preferred_source_types: [...(profile.preferred_source_types || [])]
      .map(t => String(t).trim().toLowerCase())
      .filter(Boolean)
      .sort(),
    beats: [...(beatNames || [])]
      .map(t => String(t).trim().toLowerCase())
      .filter(Boolean)
      .sort(),
  };
  return JSON.stringify(normalized);
}

function cacheKey(userId = 'anon') {
  return `${CACHE_PREFIX}:${userId || 'anon'}`;
}

export function getCachedDailyDigest(userId, signature) {
  const key = cacheKey(userId);
  const payload = safeJsonParse(localStorage.getItem(key) || 'null', null);
  if (!payload || typeof payload !== 'object') return null;
  if (payload.signature !== signature) return null;
  if (!payload.data || typeof payload.data !== 'object') return null;
  return payload.data;
}

export function setCachedDailyDigest(userId, signature, data) {
  const key = cacheKey(userId);
  const payload = {
    signature,
    saved_at: Date.now(),
    data,
  };
  try {
    localStorage.setItem(key, JSON.stringify(payload));
  } catch {
    // Ignore storage errors (quota/private mode)
  }
}
