"""
routers/sources.py — Source profile lookup endpoint.
"""

from fastapi import APIRouter
from services.source_service import get_source_profile, profile_to_dict

router = APIRouter(tags=["sources"])


@router.get("/api/sources/{domain:path}")
async def get_source(domain: str):
    """Return source profile for a domain. Always returns a profile (never 404)."""
    # Strip leading www. if passed directly
    domain = domain.removeprefix("www.")
    profile = get_source_profile(domain)
    return profile_to_dict(profile)
