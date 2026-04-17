import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional
from io import BytesIO
import base64

import bcrypt
import pyotp
import qrcode
from jose import JWTError, jwt

from app.config import get_settings

settings = get_settings()

# ── PASSWORD ──────────────────────────────────────────────────
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())

# ── JWT ───────────────────────────────────────────────────────
def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update({"exp": expire, "type": "access"})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

def create_refresh_token() -> str:
    return secrets.token_urlsafe(64)

def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()

def decode_access_token(token: str) -> dict:
    payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    if payload.get("type") != "access":
        raise JWTError("Invalid token type")
    return payload

# ── MFA / TOTP ────────────────────────────────────────────────
def generate_mfa_secret() -> str:
    return pyotp.random_base32()

def get_totp_uri(secret: str, username: str) -> str:
    return pyotp.TOTP(secret).provisioning_uri(
        name=username,
        issuer_name=settings.MFA_ISSUER
    )

def generate_qr_code_base64(uri: str) -> str:
    img = qrcode.make(uri)
    buf = BytesIO()
    img.save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode()

def verify_totp(secret: str, code: str) -> bool:
    return pyotp.TOTP(secret).verify(code, valid_window=1)

def generate_backup_codes(count: int = 8) -> tuple[list[str], list[str]]:
    plain = [secrets.token_hex(4).upper() for _ in range(count)]
    hashed = [hashlib.sha256(c.encode()).hexdigest() for c in plain]
    return plain, hashed

def verify_backup_code(code: str, hashed_codes: list[str]) -> tuple[bool, list[str]]:
    h = hashlib.sha256(code.upper().encode()).hexdigest()
    if h in hashed_codes:
        remaining = [c for c in hashed_codes if c != h]
        return True, remaining
    return False, hashed_codes