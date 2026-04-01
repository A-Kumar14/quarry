"""
auth_service.py — JWT creation/verification, password hashing, user storage.

Users are stored in data/users.json as a flat list.
No database — consistent with the rest of Quarry's architecture.

Auth is DISABLED if JWT_SECRET is not set in the environment (keeps existing
tests passing without tokens).

All env vars are read lazily (at call time, not at import time) so that
test fixtures can override them via os.environ / monkeypatch.
"""

import hashlib
import json
import logging
import os
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional

import bcrypt
from jose import JWTError, jwt

logger = logging.getLogger(__name__)

JWT_ALGORITHM = "HS256"
USERS_FILE = Path(__file__).parent.parent / "data" / "users.json"


def _prepare_password(password: str) -> bytes:
    """
    SHA-256 hash the password before bcrypt so passwords longer than 72 bytes
    are handled correctly. Returns bytes ready for bcrypt.hash / bcrypt.checkpw.
    """
    return hashlib.sha256(password.encode("utf-8")).digest()


# ── Lazy env-var helpers ──────────────────────────────────────────────────────

def is_auth_enabled() -> bool:
    return bool(os.getenv("JWT_SECRET", ""))

def _jwt_secret() -> str:
    return os.getenv("JWT_SECRET", "")

def _jwt_expire_days() -> int:
    return int(os.getenv("JWT_EXPIRE_DAYS", "30"))

def _dev_bypass_token() -> str:
    return os.getenv("DEV_BYPASS_TOKEN", "")


# ── Brute-force guard (in-memory, resets on restart) ─────────────────────────

_failed: dict[str, list[float]] = {}   # ip -> list of epoch timestamps
MAX_FAILURES = 10
LOCKOUT_SECONDS = 300   # 5 min


def record_failure(ip: str) -> None:
    import time
    _failed.setdefault(ip, []).append(time.time())


def is_locked_out(ip: str) -> bool:
    import time
    now = time.time()
    recent = [t for t in _failed.get(ip, []) if now - t < LOCKOUT_SECONDS]
    _failed[ip] = recent
    return len(recent) >= MAX_FAILURES


def clear_failures(ip: str) -> None:
    _failed.pop(ip, None)


# ── User storage ──────────────────────────────────────────────────────────────

def _load_users() -> list[dict]:
    try:
        with open(USERS_FILE) as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return []


def _save_users(users: list[dict]) -> None:
    USERS_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(USERS_FILE, "w") as f:
        json.dump(users, f, indent=2)


def get_user_by_username(username: str) -> Optional[dict]:
    for u in _load_users():
        if u["username"].lower() == username.lower():
            return u
    return None


def get_user_by_email(email: str) -> Optional[dict]:
    for u in _load_users():
        if u["email"].lower() == email.lower():
            return u
    return None


def create_user(username: str, email: str, password: str) -> dict:
    users = _load_users()
    user = {
        "id": str(uuid.uuid4()),
        "username": username,
        "email": email.lower(),
        "hashed_password": bcrypt.hashpw(_prepare_password(password), bcrypt.gensalt()).decode("utf-8"),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "profile": {
            "role": "",
            "organization": "",
            "beat": "",
            "expertise_level": "",
            "topics_of_focus": [],
            "preferred_source_types": [],
            "onboarded": False,
        },
    }
    users.append(user)
    _save_users(users)
    return _public(user)


def update_user_profile(user_id: str, profile_data: dict) -> Optional[dict]:
    """Merge profile_data into the user's profile field. Returns updated public user."""
    users = _load_users()
    for u in users:
        if u["id"] == user_id:
            if "profile" not in u or not isinstance(u.get("profile"), dict):
                u["profile"] = {}
            # Allowed profile fields
            allowed = {"role", "organization", "beat", "expertise_level",
                       "topics_of_focus", "preferred_source_types", "onboarded"}
            for k, v in profile_data.items():
                if k in allowed:
                    u["profile"][k] = v
            _save_users(users)
            return _public(u)
    return None


def get_user_by_id(user_id: str) -> Optional[dict]:
    for u in _load_users():
        if u["id"] == user_id:
            return u
    return None


def verify_password(plain: str, hashed: str) -> bool:
    hashed_bytes = hashed.encode("utf-8") if isinstance(hashed, str) else hashed
    # Try pre-hashed path (all new accounts)
    try:
        if bcrypt.checkpw(_prepare_password(plain), hashed_bytes):
            return True
    except Exception:
        pass
    # Fallback: accounts created before the SHA-256 pre-hash was introduced
    try:
        return bcrypt.checkpw(plain.encode("utf-8")[:72], hashed_bytes)
    except Exception:
        return False


def _public(user: dict) -> dict:
    """Strip hashed_password before returning to caller."""
    return {k: v for k, v in user.items() if k != "hashed_password"}


# ── JWT ───────────────────────────────────────────────────────────────────────

def create_token(user_id: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=_jwt_expire_days())
    payload = {"sub": user_id, "exp": expire}
    return jwt.encode(payload, _jwt_secret(), algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> Optional[str]:
    """Returns user_id (sub) on success, None on failure."""
    secret = _jwt_secret()
    if not secret:
        return None
    try:
        payload = jwt.decode(token, secret, algorithms=[JWT_ALGORITHM])
        return payload.get("sub")
    except JWTError:
        return None


def get_user_from_token(token: str) -> Optional[dict]:
    user_id = decode_token(token)
    if not user_id:
        return None
    for u in _load_users():
        if u["id"] == user_id:
            return _public(u)
    return None
