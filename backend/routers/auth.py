"""
auth.py — /auth/* endpoints: register, login, me.

Rate-limited: login is capped at 10 attempts / minute per IP.
"""

import logging
import re
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, field_validator
from slowapi import Limiter
from slowapi.util import get_remote_address

from services.auth_service import (
    is_auth_enabled,
    clear_failures,
    create_token,
    create_user,
    get_user_by_email,
    get_user_by_username,
    get_user_from_token,
    is_locked_out,
    record_failure,
    verify_password,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["auth"])
limiter = Limiter(key_func=get_remote_address)
bearer = HTTPBearer(auto_error=False)

# ── Schemas ───────────────────────────────────────────────────────────────────

class RegisterBody(BaseModel):
    username: str
    email: str
    password: str

    @field_validator("username")
    @classmethod
    def username_valid(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 3 or len(v) > 30:
            raise ValueError("Username must be 3–30 characters")
        if not re.match(r"^[A-Za-z0-9_-]+$", v):
            raise ValueError("Username may only contain letters, numbers, _ and -")
        return v

    @field_validator("email")
    @classmethod
    def email_valid(cls, v: str) -> str:
        v = v.strip().lower()
        if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", v):
            raise ValueError("Invalid email address")
        return v

    @field_validator("password")
    @classmethod
    def password_strong(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v


class LoginBody(BaseModel):
    username: str   # accepts username OR email
    password: str


# ── Helpers ───────────────────────────────────────────────────────────────────

def _require_auth_enabled():
    if not is_auth_enabled():
        raise HTTPException(
            status_code=503,
            detail="Auth is not configured on this server (JWT_SECRET not set)."
        )


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/register", status_code=201)
def register(body: RegisterBody):
    _require_auth_enabled()
    if get_user_by_username(body.username):
        raise HTTPException(status_code=409, detail="Username already taken")
    if get_user_by_email(body.email):
        raise HTTPException(status_code=409, detail="Email already registered")
    user = create_user(body.username, body.email, body.password)
    token = create_token(user["id"])
    return {"token": token, "user": user}


@router.post("/login")
@limiter.limit("10/minute")
def login(request: Request, body: LoginBody):
    _require_auth_enabled()

    ip = get_remote_address(request)
    if is_locked_out(ip):
        raise HTTPException(
            status_code=429,
            detail="Too many failed attempts. Try again in 5 minutes."
        )

    # Accept username or email
    identifier = body.username.strip()
    if "@" in identifier:
        user_record = get_user_by_email(identifier)
    else:
        user_record = get_user_by_username(identifier)

    if not user_record or not verify_password(body.password, user_record["hashed_password"]):
        record_failure(ip)
        # Identical error message prevents username enumeration
        raise HTTPException(status_code=401, detail="Invalid credentials")

    clear_failures(ip)
    from services.auth_service import _public
    token = create_token(user_record["id"])
    return {"token": token, "user": _public(user_record)}


@router.get("/me")
def me(credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)]):
    _require_auth_enabled()
    if not credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")

    # Dev bypass: return the first real user so the app loads without a login prompt
    from services.auth_service import _dev_bypass_token, _load_users, _public
    dev_token = _dev_bypass_token()
    if dev_token and credentials.credentials == dev_token:
        users = _load_users()
        if users:
            return _public(users[0])
        raise HTTPException(status_code=503, detail="No users registered yet")

    user = get_user_from_token(credentials.credentials)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return user
