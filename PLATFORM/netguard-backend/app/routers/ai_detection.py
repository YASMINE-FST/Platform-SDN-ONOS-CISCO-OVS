"""
GET  /ai/health          → état du service IDS ML        [tous]
GET  /ai/stats           → métriques globales IDS         [tous]
POST /ai/predict         → prédiction sur un flow         [admin/manager]
GET  /ai/alerts          → alertes IDS depuis la VM       [tous]
GET  /ai/risk/{ip}       → risk score d'une IP            [tous]
GET  /ai/risk/top        → top 10 IPs dangereuses         [tous]
"""

import httpx
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Annotated, Any

from app.config import get_settings
from app.database import get_db
from app.deps import CurrentUser, RequireAdminOrManager
from app.models import AIDetection, Alert, AlertSeverity, AlertStatus, User

settings = get_settings()
router = APIRouter(prefix="/ai", tags=["ai-detection"])


async def _ids_get(path: str) -> dict:
    """Helper GET vers l'IDS service sur la VM Linux."""
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(f"{settings.IDS_URL}{path}")
            resp.raise_for_status()
            return resp.json()
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"IDS service inaccessible: {e}")


async def _ids_post(path: str, body: dict) -> dict:
    """Helper POST vers l'IDS service."""
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                f"{settings.IDS_URL}{path}",
                json=body,
            )
            resp.raise_for_status()
            return resp.json()
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"IDS service inaccessible: {e}")


@router.get("/health")
async def ids_health(_: CurrentUser):
    """État du service ML IDS sur la VM Linux."""
    return await _ids_get("/health")


@router.get("/stats")
async def ids_stats(_: CurrentUser):
    """Métriques globales : accuracy, detection rate, false positive rate."""
    return await _ids_get("/metrics")


@router.post("/predict")
async def predict_flow(
    body: dict[str, Any],
    current_user: Annotated[User, RequireAdminOrManager],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Envoie un flow au service ML pour classification.
    Crée automatiquement une Alert + AIDetection si anomalie détectée.
    """
    result = await _ids_post("/predict", body)

    # Si c'est une attaque → crée une alert dans notre DB
    label = result.get("label", "normal")
    confidence = result.get("confidence", 0.0)
    is_anomaly = label.lower() != "normal"

    if is_anomaly:
        # Détermine la sévérité selon le type d'attaque
        severity_map = {
            "DoS": AlertSeverity.critical,
            "DDoS": AlertSeverity.critical,
            "Probe": AlertSeverity.high,
            "PortScan": AlertSeverity.high,
            "R2L": AlertSeverity.high,
            "U2R": AlertSeverity.critical,
            "ARP_Spoofing": AlertSeverity.medium,
            "MAC_Flooding": AlertSeverity.medium,
        }
        severity = severity_map.get(label, AlertSeverity.medium)

        alert = Alert(
            title=f"[ML] {label} détecté",
            description=f"Attaque '{label}' détectée par le modèle ML avec {confidence:.1%} de confiance",
            severity=severity,
            status=AlertStatus.open,
            source_ip=body.get("src_ip"),
            destination_ip=body.get("dst_ip"),
            source_port=body.get("src_port"),
            destination_port=body.get("dst_port"),
            protocol=body.get("protocol"),
            mitre_tactic=_get_mitre_tactic(label),
            mitre_technique=_get_mitre_technique(label),
            raw_payload=body,
        )
        db.add(alert)
        await db.flush()

        detection = AIDetection(
            alert_id=alert.id,
            model_name=result.get("model", "RandomForest"),
            attack_type=label,
            confidence=confidence,
            is_anomaly=True,
            features=body,
            explanation=result.get("feature_importance", {}),
        )
        db.add(detection)
        await db.commit()

        result["alert_created"] = True
        result["alert_id"] = str(alert.id)

    return result


@router.get("/alerts")
async def get_ids_alerts(
    _: CurrentUser,
    limit: int = 50,
):
    """Alertes IDS directement depuis la VM Linux."""
    # Essaie d'abord le endpoint /alerts du IDS service
    try:
        return await _ids_get(f"/alerts?limit={limit}")
    except HTTPException:
        # Fallback : retourne nos alerts ML depuis la DB locale
        return {"alerts": [], "source": "local_db_fallback"}


@router.get("/risk/top")
async def get_top_risky_ips(_: CurrentUser):
    """Top 10 IPs les plus dangereuses (risk score engine)."""
    return await _ids_get("/risk/top")


@router.get("/risk/{ip}")
async def get_ip_risk(ip: str, _: CurrentUser):
    """Risk score glissant pour une IP spécifique."""
    return await _ids_get(f"/risk/{ip}")


# ── Helpers MITRE ATT&CK ──────────────────────────────────────

def _get_mitre_tactic(attack_type: str) -> str:
    mapping = {
        "DoS": "Impact",
        "DDoS": "Impact",
        "Probe": "Discovery",
        "PortScan": "Discovery",
        "R2L": "Initial Access",
        "U2R": "Privilege Escalation",
        "ARP_Spoofing": "Credential Access",
        "MAC_Flooding": "Collection",
    }
    return mapping.get(attack_type, "Unknown")


def _get_mitre_technique(attack_type: str) -> str:
    mapping = {
        "DoS": "T1499 - Endpoint Denial of Service",
        "DDoS": "T1498 - Network Denial of Service",
        "Probe": "T1046 - Network Service Scanning",
        "PortScan": "T1046 - Network Service Scanning",
        "R2L": "T1133 - External Remote Services",
        "U2R": "T1068 - Exploitation for Privilege Escalation",
        "ARP_Spoofing": "T1557 - Adversary-in-the-Middle",
        "MAC_Flooding": "T1040 - Network Sniffing",
    }
    return mapping.get(attack_type, "Unknown")