from typing import Annotated
from uuid import UUID

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import User, UserRole
from app.security import decode_access_token

bearer_scheme = HTTPBearer(auto_error=True)

async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(bearer_scheme)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> User:
    exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_access_token(credentials.credentials)
        user_id: str = payload.get("sub")
        if user_id is None:
            raise exc
    except JWTError:
        raise exc

    result = await db.execute(select(User).where(User.id == UUID(user_id)))
    user = result.scalar_one_or_none()

    if user is None:
        raise exc
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Inactive user")
    if user.is_locked:
        raise HTTPException(status_code=403, detail="Account locked")

    return user

def require_roles(*roles: UserRole):
    async def _check(
        current_user: Annotated[User, Depends(get_current_user)]
    ) -> User:
        if current_user.role not in roles:
            raise HTTPException(
                status_code=403,
                detail=f"Role '{current_user.role}' not authorised",
            )
        return current_user
    return _check

# ── Shorthands ────────────────────────────────────────────────
CurrentUser = Annotated[User, Depends(get_current_user)]
RequireAdmin = Depends(require_roles(UserRole.admin))
RequireAdminOrManager = Depends(require_roles(UserRole.admin, UserRole.manager))

async def get_client_ip(request: Request) -> str | None:
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else None