"""
GET    /users          → liste tous les users      [admin]
POST   /users          → crée un user              [admin]
GET    /users/me       → profil courant             [tous]
PUT    /users/me/password → change son password    [tous]
GET    /users/{id}     → détail user               [admin]
PUT    /users/{id}     → modifie user              [admin]
DELETE /users/{id}     → supprime user             [admin]
POST   /users/{id}/unlock → déverrouille compte   [admin]
"""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import CurrentUser, RequireAdmin
from app.models import User, UserRole
from app.schemas import (
    ChangePasswordRequest, UserCreate, UserResponse, UserUpdate,
)
from app.security import hash_password, verify_password

router = APIRouter(prefix="/users", tags=["users"])


@router.get("", response_model=list[UserResponse])
async def list_users(
    _: Annotated[User, RequireAdmin],
    db: Annotated[AsyncSession, Depends(get_db)],
    skip: int = 0,
    limit: int = 50,
):
    result = await db.execute(select(User).offset(skip).limit(limit))
    return result.scalars().all()


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    body: UserCreate,
    _: Annotated[User, RequireAdmin],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    # Vérifie doublon
    exists = await db.execute(
        select(User).where(
            (User.email == body.email) | (User.username == body.username)
        )
    )
    if exists.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email ou username déjà utilisé")

    user = User(
        username=body.username,
        email=body.email,
        hashed_password=hash_password(body.password),
        role=UserRole(body.role),
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: CurrentUser):
    return current_user


@router.put("/me/password", status_code=200)
async def change_password(
    body: ChangePasswordRequest,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    if not verify_password(body.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Mot de passe actuel incorrect")
    current_user.hashed_password = hash_password(body.new_password)
    db.add(current_user)
    await db.commit()
    return {"message": "Mot de passe mis à jour"}


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: UUID,
    _: Annotated[User, RequireAdmin],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User non trouvé")
    return user


@router.put("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: UUID,
    body: UserUpdate,
    _: Annotated[User, RequireAdmin],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User non trouvé")

    if body.email is not None:
        user.email = body.email
    if body.role is not None:
        user.role = UserRole(body.role)
    if body.is_active is not None:
        user.is_active = body.is_active

    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@router.delete("/{user_id}", status_code=204)
async def delete_user(
    user_id: UUID,
    current_user: CurrentUser,
    _: Annotated[User, RequireAdmin],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Tu ne peux pas te supprimer toi-même")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User non trouvé")

    await db.delete(user)
    await db.commit()


@router.post("/{user_id}/unlock", status_code=200)
async def unlock_user(
    user_id: UUID,
    _: Annotated[User, RequireAdmin],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User non trouvé")

    user.is_locked = False
    user.failed_attempts = 0
    db.add(user)
    await db.commit()
    return {"message": "Compte déverrouillé"}