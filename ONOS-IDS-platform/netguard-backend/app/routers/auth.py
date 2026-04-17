"""
POST /auth/login         → credentials → tokens (ou mfa_token si MFA activé)
POST /auth/mfa/verify    → code TOTP   → tokens complets
POST /auth/refresh       → rotate refresh token
POST /auth/logout        → révoque refresh token
GET  /auth/mfa/setup     → génère secret TOTP + QR code
POST /auth/mfa/confirm   → confirme TOTP et active MFA
DELETE /auth/mfa         → désactive MFA
"""

import secrets
from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.deps import CurrentUser, get_client_ip
from app.models import AuditLog, RefreshToken, User
from app.schemas import (
    LoginRequest, MFAConfirmRequest, MFASetupResponse,
    MFAVerifyRequest, RefreshRequest, TokenResponse,
)
from app.security import (
    create_access_token, create_refresh_token, generate_backup_codes,
    generate_mfa_secret, generate_qr_code_base64, get_totp_uri,
    hash_token, verify_backup_code, verify_password, verify_totp,
)

settings = get_settings()
router = APIRouter(prefix="/auth", tags=["auth"])

# Sessions MFA temporaires (en mémoire – suffisant pour dev)
_mfa_pending: dict[str, dict] = {}


# ── HELPERS ───────────────────────────────────────────────────

async def _audit(
    db: AsyncSession, user: User | None,
    action: str, success: bool,
    ip: str | None, request: Request,
):
    db.add(AuditLog(
        user_id=user.id if user else None,
        username=user.username if user else None,
        action=action,
        ip_address=ip,
        user_agent=request.headers.get("user-agent"),
        success=success,
    ))
    await db.commit()


async def _issue_tokens(
    user: User, remember_me: bool,
    ip: str | None, request: Request,
    db: AsyncSession,
) -> "TokenResponse":
    access_token = create_access_token({"sub": str(user.id), "role": user.role})
    raw_refresh = create_refresh_token()
    expires = datetime.now(timezone.utc) + timedelta(
        days=settings.REFRESH_TOKEN_EXPIRE_DAYS if remember_me else 1
    )
    db.add(RefreshToken(
        user_id=user.id,
        token_hash=hash_token(raw_refresh),
        ip_address=ip,
        device_info=request.headers.get("user-agent"),
        expires_at=expires,
    ))
    await db.execute(
        update(User).where(User.id == user.id).values(
            failed_attempts=0,
            last_login=datetime.now(timezone.utc),
            last_login_ip=ip,
        )
    )
    await db.commit()
    return TokenResponse(access_token=access_token, refresh_token=raw_refresh)


# ── ROUTES ────────────────────────────────────────────────────

@router.post("/login", response_model=TokenResponse)
async def login(
    body: LoginRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    ip: Annotated[str | None, Depends(get_client_ip)],
):
    # 1. Cherche l'user par email ou username
    result = await db.execute(
        select(User).where(
            (User.email == body.identifier) | (User.username == body.identifier)
        )
    )
    user = result.scalar_one_or_none()

    # 2. Vérifie password
    if user is None or not verify_password(body.password, user.hashed_password):
        if user:
            new_attempts = user.failed_attempts + 1
            await db.execute(
                update(User).where(User.id == user.id).values(
                    failed_attempts=new_attempts,
                    is_locked=new_attempts >= settings.MAX_LOGIN_ATTEMPTS,
                )
            )
            await db.commit()
        await _audit(db, user, "login_failed", False, ip, request)
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account inactive")
    if user.is_locked:
        raise HTTPException(status_code=403, detail="Account locked – contact admin")

    # 3. MFA requis ?
    if user.mfa_enabled and user.mfa_secret:
        mfa_token = secrets.token_urlsafe(32)
        _mfa_pending[mfa_token] = {
            "user_id": str(user.id),
            "remember_me": body.rememberMe,
        }
        return TokenResponse(
            access_token="",
            refresh_token="",
            mfa_required=True,
            mfa_token=mfa_token,
        )

    # 4. Tokens directs
    tokens = await _issue_tokens(user, body.rememberMe, ip, request, db)
    await _audit(db, user, "login_success", True, ip, request)
    return tokens


@router.post("/mfa/verify", response_model=TokenResponse)
async def mfa_verify(
    body: MFAVerifyRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    ip: Annotated[str | None, Depends(get_client_ip)],
):
    pending = _mfa_pending.pop(body.mfa_token, None)
    if not pending:
        raise HTTPException(status_code=401, detail="Invalid or expired MFA session")

    from uuid import UUID
    result = await db.execute(select(User).where(User.id == UUID(pending["user_id"])))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    # Vérifie TOTP
    if not verify_totp(user.mfa_secret, body.code):
        # Essaie backup code
        valid, remaining = verify_backup_code(body.code, user.mfa_backup_codes or [])
        if not valid:
            await _audit(db, user, "mfa_failed", False, ip, request)
            raise HTTPException(status_code=401, detail="Invalid MFA code")
        await db.execute(
            update(User).where(User.id == user.id).values(mfa_backup_codes=remaining)
        )
        await db.commit()

    tokens = await _issue_tokens(user, pending["remember_me"], ip, request, db)
    await _audit(db, user, "mfa_success", True, ip, request)
    return tokens


@router.post("/refresh", response_model=TokenResponse)
async def refresh_tokens(
    body: RefreshRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    ip: Annotated[str | None, Depends(get_client_ip)],
):
    token_hash = hash_token(body.refresh_token)
    result = await db.execute(
        select(RefreshToken).where(
            RefreshToken.token_hash == token_hash,
            RefreshToken.revoked == False,
            RefreshToken.expires_at > datetime.now(timezone.utc),
        )
    )
    rt = result.scalar_one_or_none()
    if rt is None:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    # Révoque l'ancien (rotation)
    await db.execute(
        update(RefreshToken).where(RefreshToken.id == rt.id).values(revoked=True)
    )
    result2 = await db.execute(select(User).where(User.id == rt.user_id))
    user = result2.scalar_one()
    return await _issue_tokens(user, True, ip, request, db)


@router.post("/logout", status_code=204)
async def logout(
    body: RefreshRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    await db.execute(
        update(RefreshToken)
        .where(RefreshToken.token_hash == hash_token(body.refresh_token))
        .values(revoked=True)
    )
    await db.commit()


@router.get("/mfa/setup", response_model=MFASetupResponse)
async def mfa_setup(
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    secret = generate_mfa_secret()
    uri = get_totp_uri(secret, current_user.username)
    qr = generate_qr_code_base64(uri)
    plain_codes, hashed_codes = generate_backup_codes()

    await db.execute(
        update(User).where(User.id == current_user.id)
        .values(mfa_secret=secret, mfa_backup_codes=hashed_codes)
    )
    await db.commit()
    return MFASetupResponse(
        secret=secret, uri=uri,
        qr_code_base64=qr, backup_codes=plain_codes,
    )


@router.post("/mfa/confirm")
async def mfa_confirm(
    body: MFAConfirmRequest,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    if not current_user.mfa_secret:
        raise HTTPException(status_code=400, detail="Lance /auth/mfa/setup d'abord")
    if not verify_totp(current_user.mfa_secret, body.code):
        raise HTTPException(status_code=400, detail="Code TOTP invalide")
    await db.execute(
        update(User).where(User.id == current_user.id).values(mfa_enabled=True)
    )
    await db.commit()
    return {"message": "MFA activé avec succès"}


@router.delete("/mfa")
async def mfa_disable(
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    await db.execute(
        update(User).where(User.id == current_user.id)
        .values(mfa_enabled=False, mfa_secret=None, mfa_backup_codes=None)
    )
    await db.commit()
    return {"message": "MFA désactivé"}