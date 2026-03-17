const HIGH_TLDS = new Set(['gov', 'edu']);

const HIGH_DOMAINS = new Set([
  'bbc.com',
  'reuters.com',
  'nytimes.com',
  'theguardian.com',
  'apnews.com',
  'bloomberg.com',
  'nature.com',
  'wikipedia.org',
  'techcrunch.com',
  'wired.com',
  'economist.com',
  'ft.com',
  'wsj.com',
  'arxiv.org',
  'ncbi.nlm.nih.gov',
  'scholar.google.com',
]);

function parseHostname(url) {
  if (!url || typeof url !== 'string') return null;
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return null;
  }
}

export function getSourceQuality(url) {
  const host = parseHostname(url);

  if (!host || host === 'localhost' || host === '127.0.0.1' || host === '::1') {
    return 'unknown';
  }

  if (HIGH_DOMAINS.has(host)) return 'high';

  for (const domain of HIGH_DOMAINS) {
    if (host.endsWith('.' + domain)) return 'high';
  }

  const tld = host.split('.').pop();
  if (HIGH_TLDS.has(tld)) return 'high';

  return 'medium';
}

export const QUALITY_COLOR = {
  high:    '#22c55e',
  medium:  '#f97316',
  unknown: '#9ca3af',
};
