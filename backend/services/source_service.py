"""
services/source_service.py — In-memory source profile database.
Loaded once at startup from backend/data/sources.json.
No database — just a dict keyed by domain.
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass, asdict
from functools import lru_cache


@dataclass
class SourceProfile:
    outlet_name: str
    domain: str
    country: str
    language: str
    funding_type: str    # state | private | ngo | nonprofit | public_broadcaster | unknown
    editorial_lean: str  # left | center | right | state_aligned | independent | unknown
    credibility_tier: int  # 1 (highest) | 2 | 3
    state_affiliation: str | None


@lru_cache(maxsize=1)
def _load_profiles() -> dict[str, SourceProfile]:
    path = os.path.join(os.path.dirname(__file__), '..', 'data', 'sources.json')
    with open(path) as f:
        data = json.load(f)
    return {entry['domain']: SourceProfile(**entry) for entry in data}


def _unknown_profile(domain: str) -> SourceProfile:
    return SourceProfile(
        outlet_name=domain or 'Unknown',
        domain=domain,
        country='Unknown',
        language='en',
        funding_type='unknown',
        editorial_lean='unknown',
        credibility_tier=2,
        state_affiliation=None,
    )


def get_source_profile(url: str) -> SourceProfile:
    """Parse domain from URL and return profile, or unknown default."""
    try:
        from urllib.parse import urlparse
        domain = urlparse(url).hostname or ''
        domain = domain.removeprefix('www.')
    except Exception:
        domain = url

    if not domain:
        return _unknown_profile('')

    profiles = _load_profiles()

    if domain in profiles:
        return profiles[domain]

    # Subdomain fallback: try progressively shorter suffixes
    parts = domain.split('.')
    for i in range(1, len(parts)):
        parent = '.'.join(parts[i:])
        if parent in profiles:
            return profiles[parent]

    return _unknown_profile(domain)


def profile_to_dict(p: SourceProfile) -> dict:
    return asdict(p)
