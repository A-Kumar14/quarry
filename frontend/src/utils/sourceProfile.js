const PROFILE_CACHE = new Map();
const API = process.env.REACT_APP_API_URL || 'http://localhost:8000';

export async function getSourceProfile(url) {
  try {
    const domain = new URL(url).hostname.replace(/^www\./, '');
    if (PROFILE_CACHE.has(domain)) return PROFILE_CACHE.get(domain);
    const resp = await fetch(`${API}/api/sources/${domain}`);
    if (!resp.ok) throw new Error('not found');
    const data = await resp.json();
    PROFILE_CACHE.set(domain, data);
    return data;
  } catch {
    return {
      outlet_name: null,
      credibility_tier: 2,
      editorial_lean: 'unknown',
      funding_type: 'unknown',
      country: null,
      state_affiliation: null,
    };
  }
}

export const TIER_COLOR = {
  1: '#22c55e',
  2: '#f97316',
  3: '#ef4444',
};

export const LEAN_LABEL = {
  state_aligned: '⚠ State-backed',
  left: 'Left-leaning',
  center: 'Independent',
  right: 'Right-leaning',
  independent: '✓ Independent',
  unknown: null,
};
