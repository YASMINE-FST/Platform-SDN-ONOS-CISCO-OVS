"""
GET  /siem/incidents          → liste incidents        [tous]
GET  /siem/incidents/{id}     → détail incident        [tous]
PUT  /siem/incidents/{id}     → update status/assign   [admin/manager]
GET  /siem/events             → événements SIEM raw    [tous]
GET  /siem/stats              → stats SIEM globales    [tous]
GET  /siem/rules              → règles de corrélation  [admin]
PUT  /siem/rules/{id}         → activer/désactiver     [admin]
POST /siem/trigger            → force un cycle SIEM    [admin]
"""

from datetime import datetime, timezone
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import CurrentUser, RequireAdmin, RequireAdminOrManager
from app.models import (
    Incident, IncidentAlert, SIEMRule, SIEMEvent,
    Alert, User
)

router = APIRouter(prefix="/siem", tags=["siem"])


# ── INCIDENTS ─────────────────────────────────────────────────

@router.get("/incidents")
async def list_incidents(
    _: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    status: str | None = None,
    severity: str | None = None,
    skip: int = 0,
    limit: int = 50,
):
    stmt = select(Incident).order_by(desc(Incident.created_at))
    if status:
        stmt = stmt.where(Incident.status == status)
    if severity:
        stmt = stmt.where(Incident.severity == severity)
    result = await db.execute(stmt.offset(skip).limit(limit))
    incidents = result.scalars().all()

    return [
        {
            "id": str(i.id),
            "title": i.title,
            "description": i.description,
            "severity": i.severity,
            "status": i.status,
            "alert_count": i.alert_count,
            "source_ips": i.source_ips or [],
            "mitre_tactics": i.mitre_tactics or [],
            "mitre_techniques": i.mitre_techniques or [],
            "first_seen": i.first_seen.isoformat() if i.first_seen else None,
            "last_seen": i.last_seen.isoformat() if i.last_seen else None,
            "created_at": i.created_at.isoformat(),
        }
        for i in incidents
    ]


@router.get("/incidents/{incident_id}")
async def get_incident(
    incident_id: UUID,
    _: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(select(Incident).where(Incident.id == incident_id))
    incident = result.scalar_one_or_none()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")

    # Récupère les alerts liées
    alerts_result = await db.execute(
        select(Alert)
        .join(IncidentAlert, IncidentAlert.alert_id == Alert.id)
        .where(IncidentAlert.incident_id == incident_id)
        .order_by(desc(Alert.created_at))
    )
    alerts = alerts_result.scalars().all()

    return {
        "id": str(incident.id),
        "title": incident.title,
        "description": incident.description,
        "severity": incident.severity,
        "status": incident.status,
        "alert_count": incident.alert_count,
        "source_ips": incident.source_ips or [],
        "attack_types": incident.attack_types or [],
        "mitre_tactics": incident.mitre_tactics or [],
        "mitre_techniques": incident.mitre_techniques or [],
        "notes": incident.notes,
        "first_seen": incident.first_seen.isoformat() if incident.first_seen else None,
        "last_seen": incident.last_seen.isoformat() if incident.last_seen else None,
        "created_at": incident.created_at.isoformat(),
        "alerts": [
            {
                "id": str(a.id),
                "title": a.title,
                "severity": a.severity,
                "status": a.status,
                "source_ip": str(a.source_ip) if a.source_ip else None,
                "mitre_tactic": a.mitre_tactic,
                "created_at": a.created_at.isoformat(),
            }
            for a in alerts
        ],
    }


@router.put("/incidents/{incident_id}")
async def update_incident(
    incident_id: UUID,
    body: dict,
    current_user: Annotated[User, RequireAdminOrManager],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(select(Incident).where(Incident.id == incident_id))
    incident = result.scalar_one_or_none()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")

    if "status" in body:
        incident.status = body["status"]
        if body["status"] == "resolved":
            incident.resolved_at = datetime.now(timezone.utc)
    if "notes" in body:
        incident.notes = body["notes"]
    if "assigned_to" in body:
        incident.assigned_to = body["assigned_to"]
    if "severity" in body:
        incident.severity = body["severity"]

    db.add(incident)
    await db.commit()
    return {"message": "Incident updated", "id": str(incident_id)}


# ── EVENTS ────────────────────────────────────────────────────

@router.get("/events")
async def list_events(
    _: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    skip: int = 0,
    limit: int = 100,
    event_type: str | None = None,
):
    stmt = select(SIEMEvent).order_by(desc(SIEMEvent.created_at))
    if event_type:
        stmt = stmt.where(SIEMEvent.event_type == event_type)
    result = await db.execute(stmt.offset(skip).limit(limit))
    events = result.scalars().all()

    return [
        {
            "id": e.id,
            "event_type": e.event_type,
            "source": e.source,
            "severity": e.severity,
            "title": e.title,
            "details": e.details,
            "source_ip": str(e.source_ip) if e.source_ip else None,
            "created_at": e.created_at.isoformat(),
        }
        for e in events
    ]


# ── STATS ─────────────────────────────────────────────────────

@router.get("/stats")
async def get_siem_stats(
    _: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    total_incidents = await db.scalar(select(func.count(Incident.id)))
    open_incidents = await db.scalar(
        select(func.count(Incident.id)).where(Incident.status == "open")
    )
    critical_incidents = await db.scalar(
        select(func.count(Incident.id)).where(Incident.severity == "critical")
    )
    total_events = await db.scalar(select(func.count(SIEMEvent.id)))

    # Incidents par sévérité
    sev_rows = await db.execute(
        select(Incident.severity, func.count(Incident.id))
        .group_by(Incident.severity)
    )
    by_severity = {row[0]: row[1] for row in sev_rows}
    for s in ["critical", "high", "medium", "low"]:
        by_severity.setdefault(s, 0)

    # Incidents par status
    status_rows = await db.execute(
        select(Incident.status, func.count(Incident.id))
        .group_by(Incident.status)
    )
    by_status = {row[0]: row[1] for row in status_rows}

    # Top source IPs (depuis les incidents)
    top_ips_result = await db.execute(
        select(Incident.source_ips).where(
            Incident.source_ips.isnot(None)
        ).limit(50)
    )
    ip_counter: dict[str, int] = {}
    for row in top_ips_result:
        for ip in (row[0] or []):
            ip_counter[ip] = ip_counter.get(ip, 0) + 1
    top_ips = sorted(ip_counter.items(), key=lambda x: x[1], reverse=True)[:10]

    return {
        "total_incidents": total_incidents or 0,
        "open_incidents": open_incidents or 0,
        "critical_incidents": critical_incidents or 0,
        "total_events": total_events or 0,
        "incidents_by_severity": by_severity,
        "incidents_by_status": by_status,
        "top_source_ips": [{"ip": ip, "count": cnt} for ip, cnt in top_ips],
    }


# ── RULES ─────────────────────────────────────────────────────

@router.get("/rules")
async def list_rules(
    _: Annotated[User, RequireAdmin],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(select(SIEMRule))
    rules = result.scalars().all()
    return [
        {
            "id": str(r.id),
            "name": r.name,
            "description": r.description,
            "is_active": r.is_active,
            "condition_type": r.condition_type,
            "threshold": r.threshold,
            "time_window_minutes": r.time_window_minutes,
            "severity_filter": r.severity_filter,
            "incident_severity": r.incident_severity,
        }
        for r in rules
    ]


@router.put("/rules/{rule_id}")
async def update_rule(
    rule_id: UUID,
    body: dict,
    _: Annotated[User, RequireAdmin],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(select(SIEMRule).where(SIEMRule.id == rule_id))
    rule = result.scalar_one_or_none()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")

    if "is_active" in body:
        rule.is_active = body["is_active"]
    if "threshold" in body:
        rule.threshold = body["threshold"]
    if "time_window_minutes" in body:
        rule.time_window_minutes = body["time_window_minutes"]

    db.add(rule)
    await db.commit()
    return {"message": "Rule updated"}


# ── TRIGGER MANUEL ────────────────────────────────────────────

@router.post("/trigger")
async def trigger_siem_cycle(
    request: Request,
    _: Annotated[User, RequireAdmin],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Force un cycle de corrélation immédiat."""
    siem = request.app.state.siem_engine
    await siem._process_cycle(db)
    await db.commit()
    return {"message": "SIEM cycle triggered successfully"}