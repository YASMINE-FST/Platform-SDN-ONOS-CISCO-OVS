"""
GET  /ti/ip/{ip}          → enrichissement d'une IP    [tous]
GET  /ti/alerts           → alerts enrichies avec TI   [tous]
GET  /ti/malicious        → IPs malveillantes en DB     [tous]
POST /ti/enrich/{alert_id} → enrichit une alert        [admin/manager]
GET  /ti/stats            → stats TI globales           [tous]
"""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import CurrentUser, RequireAdminOrManager
from app.models import Alert, ThreatIntel, User

router = APIRouter(prefix="/ti", tags=["threat-intel"])


@router.get("/ip/{ip}")
async def enrich_ip(
    ip: str,
    request: Request,
    _: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Enrichit une IP avec toutes les sources TI."""
    ti = request.app.state.ti_engine
    data = await ti.enrich_and_save(ip, db)
    return data


@router.post("/enrich/{alert_id}")
async def enrich_alert(
    alert_id: UUID,
    request: Request,
    _: Annotated[User, RequireAdminOrManager],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Enrichit une alert spécifique avec le contexte TI."""
    result = await db.execute(select(Alert).where(Alert.id == alert_id))
    alert = result.scalar_one_or_none()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    if not alert.source_ip:
        raise HTTPException(status_code=400, detail="Alert has no source IP")

    ti = request.app.state.ti_engine
    data = await ti.enrich_and_save(str(alert.source_ip), db)
    return {
        "alert_id": str(alert_id),
        "ip": str(alert.source_ip),
        "ti_data": data,
    }


@router.get("/malicious")
async def get_malicious_ips(
    _: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    limit: int = 50,
):
    """Toutes les IPs malveillantes connues en DB."""
    result = await db.execute(
        select(ThreatIntel)
        .where(ThreatIntel.is_malicious == True)
        .order_by(ThreatIntel.abuse_score.desc())
        .limit(limit)
    )
    ips = result.scalars().all()
    return [
        {
            "ip": str(t.ip_address),
            "abuse_score": t.abuse_score,
            "country_code": t.country_code,
            "isp": t.isp,
            "is_tor": t.is_tor,
            "categories": t.categories or [],
            "enriched_at": t.enriched_at.isoformat(),
        }
        for t in ips
    ]


@router.get("/stats")
async def get_ti_stats(
    _: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    total = await db.scalar(select(func.count(ThreatIntel.id)))
    malicious = await db.scalar(
        select(func.count(ThreatIntel.id))
        .where(ThreatIntel.is_malicious == True)
    )
    tor = await db.scalar(
        select(func.count(ThreatIntel.id))
        .where(ThreatIntel.is_tor == True)
    )
    high_score = await db.scalar(
        select(func.count(ThreatIntel.id))
        .where(ThreatIntel.abuse_score >= 75)
    )

    # Top countries
    country_rows = await db.execute(
        select(ThreatIntel.country_code, func.count(ThreatIntel.id).label("cnt"))
        .where(ThreatIntel.country_code.isnot(None))
        .group_by(ThreatIntel.country_code)
        .order_by(func.count(ThreatIntel.id).desc())
        .limit(10)
    )
    top_countries = [
        {"country": row[0], "count": row[1]}
        for row in country_rows
    ]

    return {
        "total_ips_analyzed": total or 0,
        "malicious_ips": malicious or 0,
        "tor_nodes": tor or 0,
        "high_risk_ips": high_score or 0,
        "top_countries": top_countries,
    }


@router.get("/alerts")
async def get_enriched_alerts(
    _: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    limit: int = 50,
):
    """Alerts avec contexte TI enrichi."""
    result = await db.execute(
        select(Alert, ThreatIntel)
        .outerjoin(
            ThreatIntel,
            and_(
                Alert.source_ip == ThreatIntel.ip_address,
                ThreatIntel.source == "combined",
            )
        )
        .where(Alert.source_ip.isnot(None))
        .order_by(Alert.created_at.desc())
        .limit(limit)
    )
    rows = result.all()

    return [
        {
            "alert_id": str(alert.id),
            "title": alert.title,
            "severity": alert.severity,
            "source_ip": str(alert.source_ip),
            "created_at": alert.created_at.isoformat(),
            "ti": {
                "abuse_score": ti.abuse_score if ti else None,
                "country_code": ti.country_code if ti else None,
                "isp": ti.isp if ti else None,
                "is_malicious": ti.is_malicious if ti else None,
                "is_tor": ti.is_tor if ti else None,
                "categories": ti.categories if ti else [],
            } if ti else None,
        }
        for alert, ti in rows
    ]