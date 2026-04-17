"""
GET /mitre/matrix    → matrice complète avec techniques détectées
GET /mitre/heatmap   → fréquence par technique/tactique
GET /mitre/timeline  → timeline d'attaque chronologique
GET /mitre/summary   → résumé des tactiques actives
"""

from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import CurrentUser
from app.models import Alert, Incident

router = APIRouter(prefix="/mitre", tags=["mitre"])

# ── Matrice MITRE ATT&CK complète ────────────────────────────
MITRE_MATRIX = {
    "Reconnaissance": [
        "T1595 - Active Scanning",
        "T1596 - Search Open Databases",
        "T1597 - Search Closed Sources",
        "T1598 - Phishing for Information",
    ],
    "Resource Development": [
        "T1583 - Acquire Infrastructure",
        "T1584 - Compromise Infrastructure",
        "T1585 - Establish Accounts",
    ],
    "Initial Access": [
        "T1190 - Exploit Public-Facing Application",
        "T1133 - External Remote Services",
        "T1566 - Phishing",
        "T1078 - Valid Accounts",
    ],
    "Execution": [
        "T1059 - Command and Scripting Interpreter",
        "T1203 - Exploitation for Client Execution",
        "T1072 - Software Deployment Tools",
    ],
    "Persistence": [
        "T1098 - Account Manipulation",
        "T1136 - Create Account",
        "T1543 - Create or Modify System Process",
        "T1078 - Valid Accounts",
    ],
    "Privilege Escalation": [
        "T1068 - Exploitation for Privilege Escalation",
        "T1078 - Valid Accounts",
        "T1134 - Access Token Manipulation",
    ],
    "Defense Evasion": [
        "T1562 - Impair Defenses",
        "T1070 - Indicator Removal",
        "T1036 - Masquerading",
    ],
    "Credential Access": [
        "T1110 - Brute Force",
        "T1555 - Credentials from Password Stores",
        "T1557 - Adversary-in-the-Middle",
        "T1040 - Network Sniffing",
    ],
    "Discovery": [
        "T1046 - Network Service Scanning",
        "T1135 - Network Share Discovery",
        "T1057 - Process Discovery",
        "T1018 - Remote System Discovery",
        "T1082 - System Information Discovery",
    ],
    "Lateral Movement": [
        "T1210 - Exploitation of Remote Services",
        "T1534 - Internal Spearphishing",
        "T1570 - Lateral Tool Transfer",
    ],
    "Collection": [
        "T1040 - Network Sniffing",
        "T1039 - Data from Network Shared Drive",
        "T1041 - Exfiltration Over C2 Channel",
    ],
    "Command and Control": [
        "T1071 - Application Layer Protocol",
        "T1095 - Non-Application Layer Protocol",
        "T1572 - Protocol Tunneling",
    ],
    "Exfiltration": [
        "T1041 - Exfiltration Over C2 Channel",
        "T1048 - Exfiltration Over Alternative Protocol",
        "T1567 - Exfiltration Over Web Service",
    ],
    "Impact": [
        "T1498 - Network Denial of Service",
        "T1499 - Endpoint Denial of Service",
        "T1485 - Data Destruction",
        "T1491 - Defacement",
    ],
}


@router.get("/matrix")
async def get_matrix(
    _: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    days: int = 30,
):
    """Retourne la matrice MITRE avec les techniques détectées."""
    since = datetime.now(timezone.utc) - timedelta(days=days)

    # Récupère toutes les alerts avec MITRE info
    result = await db.execute(
        select(
            Alert.mitre_tactic,
            Alert.mitre_technique,
            func.count(Alert.id).label("count"),
        )
        .where(
            Alert.created_at >= since,
            Alert.mitre_tactic.isnot(None),
        )
        .group_by(Alert.mitre_tactic, Alert.mitre_technique)
    )
    detected = {
        (row.mitre_tactic, row.mitre_technique): row.count
        for row in result.all()
    }

    # Construit la matrice
    matrix = []
    for tactic, techniques in MITRE_MATRIX.items():
        tactic_data = {
            "tactic": tactic,
            "techniques": [],
            "total_hits": 0,
        }
        for technique in techniques:
            # Cherche si cette technique est détectée
            hits = 0
            for (t_tactic, t_technique), count in detected.items():
                if t_tactic == tactic or (t_technique and technique.split(" - ")[0] in (t_technique or "")):
                    hits = count
                    break

            tactic_data["techniques"].append({
                "id": technique.split(" - ")[0],
                "name": technique.split(" - ", 1)[1] if " - " in technique else technique,
                "full": technique,
                "hits": hits,
                "detected": hits > 0,
            })
            tactic_data["total_hits"] += hits

        matrix.append(tactic_data)

    return {
        "matrix": matrix,
        "period_days": days,
        "total_detected_techniques": sum(1 for t in matrix for tech in t["techniques"] if tech["detected"]),
        "total_tactics_active": sum(1 for t in matrix if t["total_hits"] > 0),
    }


@router.get("/heatmap")
async def get_heatmap(
    _: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    days: int = 30,
):
    """Heatmap par tactique et technique."""
    since = datetime.now(timezone.utc) - timedelta(days=days)

    result = await db.execute(
        select(
            Alert.mitre_tactic,
            Alert.mitre_technique,
            func.count(Alert.id).label("count"),
        )
        .where(
            Alert.created_at >= since,
            Alert.mitre_tactic.isnot(None),
        )
        .group_by(Alert.mitre_tactic, Alert.mitre_technique)
        .order_by(desc(func.count(Alert.id)))
    )
    rows = result.all()

    # Par tactique
    by_tactic: dict[str, int] = {}
    by_technique: list[dict] = []

    for row in rows:
        tactic = row.mitre_tactic or "Unknown"
        by_tactic[tactic] = by_tactic.get(tactic, 0) + row.count
        by_technique.append({
            "tactic": tactic,
            "technique": row.mitre_technique or "Unknown",
            "count": row.count,
        })

    max_count = max((r["count"] for r in by_technique), default=1)

    return {
        "by_tactic": [
            {"tactic": k, "count": v, "intensity": round(v / max(by_tactic.values(), default=1), 2)}
            for k, v in sorted(by_tactic.items(), key=lambda x: x[1], reverse=True)
        ],
        "by_technique": [
            {**r, "intensity": round(r["count"] / max_count, 2)}
            for r in by_technique
        ],
        "max_count": max_count,
    }


@router.get("/timeline")
async def get_timeline(
    _: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    days: int = 7,
):
    """Timeline chronologique des techniques détectées."""
    since = datetime.now(timezone.utc) - timedelta(days=days)

    result = await db.execute(
        select(Alert)
        .where(
            Alert.created_at >= since,
            Alert.mitre_tactic.isnot(None),
        )
        .order_by(Alert.created_at.desc())
        .limit(100)
    )
    alerts = result.scalars().all()

    return {
        "timeline": [
            {
                "id": str(a.id),
                "title": a.title,
                "severity": a.severity,
                "tactic": a.mitre_tactic,
                "technique": a.mitre_technique,
                "source_ip": str(a.source_ip) if a.source_ip else None,
                "timestamp": a.created_at.isoformat(),
            }
            for a in alerts
        ]
    }


@router.get("/summary")
async def get_summary(
    _: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Résumé rapide des tactiques actives."""
    result = await db.execute(
        select(
            Alert.mitre_tactic,
            func.count(Alert.id).label("count"),
        )
        .where(Alert.mitre_tactic.isnot(None))
        .group_by(Alert.mitre_tactic)
        .order_by(desc(func.count(Alert.id)))
    )

    tactics = [
        {"tactic": row.mitre_tactic, "count": row.count}
        for row in result.all()
    ]

    return {
        "active_tactics": len(tactics),
        "tactics": tactics,
        "most_active": tactics[0]["tactic"] if tactics else None,
    }