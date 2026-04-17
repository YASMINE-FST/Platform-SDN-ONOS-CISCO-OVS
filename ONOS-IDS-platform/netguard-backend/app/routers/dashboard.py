"""
GET /dashboard/stats     → stats globales         [tous]
GET /dashboard/timeline  → alerts par heure       [tous]
GET /dashboard/overview  → ONOS overview enrichi  [tous]
"""

from datetime import datetime, timedelta, timezone
from typing import Annotated

import httpx
from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.deps import CurrentUser
from app.models import AIDetection, Alert, AlertSeverity, AlertStatus, Device, DeviceStatus, FlowRule
from app.schemas import DashboardStats

settings = get_settings()

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/stats", response_model=DashboardStats)
async def get_stats(
    _: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    # ── Alerts ────────────────────────────────────────────────
    total_alerts = await db.scalar(select(func.count(Alert.id)))
    open_alerts = await db.scalar(
        select(func.count(Alert.id)).where(Alert.status == AlertStatus.open)
    )
    critical_alerts = await db.scalar(
        select(func.count(Alert.id)).where(Alert.severity == AlertSeverity.critical)
    )

    # ── Alerts par severity ───────────────────────────────────
    severity_rows = await db.execute(
        select(Alert.severity, func.count(Alert.id))
        .group_by(Alert.severity)
    )
    alerts_by_severity = {row[0].value: row[1] for row in severity_rows}

    # S'assure que toutes les severities sont présentes
    for s in ["critical", "high", "medium", "low", "info"]:
        alerts_by_severity.setdefault(s, 0)

    # ── Devices ───────────────────────────────────────────────
    total_devices = await db.scalar(select(func.count(Device.id)))
    active_devices = await db.scalar(
        select(func.count(Device.id)).where(Device.status == DeviceStatus.active)
    )

    # ── Flows ─────────────────────────────────────────────────
    total_flows = await db.scalar(select(func.count(FlowRule.id)))

    # ── AI anomalies dernières 24h ────────────────────────────
    since = datetime.now(timezone.utc) - timedelta(hours=24)
    anomalies_24h = await db.scalar(
        select(func.count(AIDetection.id)).where(
            AIDetection.is_anomaly == True,
            AIDetection.created_at >= since,
        )
    )

    return DashboardStats(
        total_alerts=total_alerts or 0,
        open_alerts=open_alerts or 0,
        critical_alerts=critical_alerts or 0,
        total_devices=total_devices or 0,
        active_devices=active_devices or 0,
        total_flows=total_flows or 0,
        anomalies_24h=anomalies_24h or 0,
        alerts_by_severity=alerts_by_severity,
    )


@router.get("/timeline")
async def get_timeline(
    _: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    hours: int = 24,
):
    """Retourne le nombre d'alerts par heure sur les X dernières heures."""
    since = datetime.now(timezone.utc) - timedelta(hours=hours)

    rows = await db.execute(
        select(
            func.date_trunc("hour", Alert.created_at).label("hour"),
            func.count(Alert.id).label("count"),
        )
        .where(Alert.created_at >= since)
        .group_by("hour")
        .order_by("hour")
    )

    return [
        {
            "hour": row.hour.isoformat(),
            "count": row.count,
        }
        for row in rows
    ]


def _auth():
    return (settings.ONOS_USER, settings.ONOS_PASSWORD)


@router.get("/overview")
async def get_overview(
    _: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    ONOS controller overview: cluster, apps, intents, links, hosts,
    plus DB-based alert/device/flow counts.
    """
    onos_data: dict = {}

    async with httpx.AsyncClient(timeout=8) as client:
        # Fetch ONOS data in parallel - graceful degradation
        endpoints = {
            "cluster": "/onos/v1/cluster",
            "devices": "/onos/v1/devices",
            "links": "/onos/v1/links",
            "hosts": "/onos/v1/hosts",
            "apps": "/onos/v1/applications",
            "flows": "/onos/v1/flows",
            "intents": "/onos/v1/intents",
        }
        for key, path in endpoints.items():
            try:
                resp = await client.get(
                    f"{settings.ONOS_URL}{path}",
                    auth=_auth(),
                )
                if resp.status_code == 200:
                    onos_data[key] = resp.json()
            except httpx.HTTPError:
                onos_data[key] = {}

    # Cluster
    cluster_nodes = onos_data.get("cluster", {}).get("nodes", [])
    cluster_online = sum(1 for n in cluster_nodes if n.get("status") == "ACTIVE")

    # Devices
    onos_devices = onos_data.get("devices", {}).get("devices", [])
    available_devices = sum(1 for d in onos_devices if d.get("available"))

    # Links
    onos_links = onos_data.get("links", {}).get("links", [])

    # Hosts
    onos_hosts = onos_data.get("hosts", {}).get("hosts", [])

    # Apps
    onos_apps = onos_data.get("apps", {}).get("applications", [])
    active_apps = sum(1 for a in onos_apps if a.get("state") == "ACTIVE")

    # Flows
    onos_flows = onos_data.get("flows", {}).get("flows", [])

    # Intents
    onos_intents = onos_data.get("intents", {}).get("intents", [])
    installed_intents = sum(1 for i in onos_intents if i.get("state") == "INSTALLED")
    failed_intents = sum(1 for i in onos_intents if i.get("state") == "FAILED")

    # DB alerts
    total_alerts = await db.scalar(select(func.count(Alert.id))) or 0
    open_alerts = await db.scalar(
        select(func.count(Alert.id)).where(Alert.status == AlertStatus.open)
    ) or 0
    critical_alerts = await db.scalar(
        select(func.count(Alert.id)).where(Alert.severity == AlertSeverity.critical)
    ) or 0

    # Health score (simple heuristic)
    health_score = 100
    if len(onos_devices) > 0:
        unavail_pct = (len(onos_devices) - available_devices) / len(onos_devices) * 100
        health_score -= int(unavail_pct * 0.5)
    if critical_alerts > 0:
        health_score -= min(30, critical_alerts * 5)
    if failed_intents > 0:
        health_score -= min(20, failed_intents * 5)
    health_score = max(0, health_score)

    return {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "controller": {
            "url": settings.ONOS_URL,
            "reachable": bool(onos_data.get("cluster")),
        },
        "cluster": {
            "total": len(cluster_nodes),
            "online": cluster_online,
            "nodes": [
                {
                    "id": n.get("id"),
                    "ip": n.get("ip"),
                    "status": n.get("status"),
                }
                for n in cluster_nodes
            ],
        },
        "devices": {
            "total": len(onos_devices),
            "available": available_devices,
        },
        "links": {
            "total": len(onos_links),
        },
        "hosts": {
            "total": len(onos_hosts),
        },
        "applications": {
            "total": len(onos_apps),
            "active": active_apps,
        },
        "flows": {
            "total": len(onos_flows),
        },
        "intents": {
            "total": len(onos_intents),
            "installed": installed_intents,
            "failed": failed_intents,
        },
        "alerts": {
            "total": total_alerts,
            "open": open_alerts,
            "critical": critical_alerts,
        },
        "health": {
            "score": health_score,
            "status": "healthy" if health_score >= 80 else "degraded" if health_score >= 50 else "critical",
        },
    }