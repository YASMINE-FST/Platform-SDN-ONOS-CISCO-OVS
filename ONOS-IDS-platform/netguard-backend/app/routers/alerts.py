"""
GET  /alerts              → liste alerts          [tous]
GET  /alerts/{id}         → détail alert          [tous]
PUT  /alerts/{id}/status  → change status         [admin/manager]
DELETE /alerts/{id}       → supprime alert        [admin]
POST /alerts/test         → crée alert de test    [admin]
"""

from datetime import datetime, timezone
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import CurrentUser, RequireAdmin, RequireAdminOrManager
from app.models import Alert, AlertSeverity, AlertStatus, User
from app.schemas import AlertResponse, AlertStatusUpdate

router = APIRouter(prefix="/alerts", tags=["alerts"])


@router.get("", response_model=list[AlertResponse])
async def list_alerts(
    _: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    skip: int = 0,
    limit: int = 50,
    severity: str | None = Query(None),
    status: str | None = Query(None),
):
    stmt = select(Alert).order_by(Alert.created_at.desc())

    if severity:
        stmt = stmt.where(Alert.severity == AlertSeverity(severity))
    if status:
        stmt = stmt.where(Alert.status == AlertStatus(status))

    result = await db.execute(stmt.offset(skip).limit(limit))
    return result.scalars().all()


@router.get("/{alert_id}", response_model=AlertResponse)
async def get_alert(
    alert_id: UUID,
    _: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(select(Alert).where(Alert.id == alert_id))
    alert = result.scalar_one_or_none()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert non trouvée")
    return alert


@router.put("/{alert_id}/status", response_model=AlertResponse)
async def update_alert_status(
    alert_id: UUID,
    body: AlertStatusUpdate,
    current_user: Annotated[User, RequireAdminOrManager],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(select(Alert).where(Alert.id == alert_id))
    alert = result.scalar_one_or_none()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert non trouvée")

    new_status = AlertStatus(body.status)
    alert.status = new_status

    if body.notes:
        alert.notes = body.notes

    now = datetime.now(timezone.utc)

    if new_status == AlertStatus.acknowledged:
        alert.acknowledged_by = current_user.id
        alert.acknowledged_at = now
    elif new_status == AlertStatus.resolved:
        alert.resolved_by = current_user.id
        alert.resolved_at = now

    db.add(alert)
    await db.commit()
    await db.refresh(alert)
    return alert


@router.delete("/{alert_id}", status_code=204)
async def delete_alert(
    alert_id: UUID,
    _: Annotated[User, RequireAdmin],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(select(Alert).where(Alert.id == alert_id))
    alert = result.scalar_one_or_none()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert non trouvée")
    await db.delete(alert)
    await db.commit()


@router.post("/test", status_code=201)
async def create_test_alert(
    _: Annotated[User, RequireAdmin],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Crée une alert de test pour valider le pipeline."""
    alert = Alert(
        title="[TEST] Port Scan Detected",
        description="Scan de ports détecté depuis 192.168.1.100",
        severity=AlertSeverity.high,
        status=AlertStatus.open,
        source_ip="192.168.1.100",
        destination_ip="10.0.0.1",
        source_port=54321,
        destination_port=22,
        protocol="TCP",
        mitre_tactic="Discovery",
        mitre_technique="T1046 - Network Service Scanning",
    )
    db.add(alert)
    await db.commit()
    await db.refresh(alert)
    return alert