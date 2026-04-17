"""
POST /chatbot/message    → envoie un message au SOC chatbot
GET  /chatbot/history    → historique des conversations
POST /chatbot/analyze    → analyse une alert spécifique
POST /chatbot/clear      → efface l'historique
"""

from datetime import datetime, timezone
from typing import Annotated
import httpx

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.deps import CurrentUser
from app.models import Alert, Incident, ThreatIntel
from sqlalchemy import cast
from sqlalchemy.dialects.postgresql import INET as PG_INET

settings = get_settings()
router = APIRouter(prefix="/chatbot", tags=["chatbot"])

# Historique en mémoire par session (en prod → Redis)
_conversations: dict[str, list[dict]] = {}

SYSTEM_PROMPT = """You are NetGuard SOC Assistant, an expert cybersecurity analyst specialized in:
- SDN (Software Defined Networking) security with ONOS controller
- Intrusion Detection Systems (IDS) and ML-based threat detection
- MITRE ATT&CK framework analysis
- Incident response and threat hunting
- Network forensics and threat intelligence

You have access to the NetGuard SOC platform context.
Always respond in the same language as the user (French or English).
Be concise, technical, and actionable. Format responses with clear sections when needed.
When analyzing alerts or incidents, always reference MITRE ATT&CK techniques when relevant.
Provide specific remediation steps for detected threats."""


async def call_groq(messages: list[dict]) -> str:
    """Appelle l'API Groq."""
    if not settings.GROQ_API_KEY:
        raise HTTPException(status_code=503, detail="Groq API key not configured")

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {settings.GROQ_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": settings.GROQ_MODEL,
                "messages": messages,
                "max_tokens": 1024,
                "temperature": 0.3,
            },
        )
        if resp.status_code != 200:
            raise HTTPException(status_code=502, detail=f"Groq error: {resp.text}")

        return resp.json()["choices"][0]["message"]["content"]


async def build_context(db: AsyncSession) -> str:
    """Construit le contexte SOC pour le chatbot."""
    # Dernières alerts
    alerts_result = await db.execute(
        select(Alert)
        .where(Alert.status == "open")
        .order_by(desc(Alert.created_at))
        .limit(5)
    )
    alerts = alerts_result.scalars().all()

    # Derniers incidents
    incidents_result = await db.execute(
        select(Incident)
        .where(Incident.status != "resolved")
        .order_by(desc(Incident.created_at))
        .limit(3)
    )
    incidents = incidents_result.scalars().all()

    # IPs malveillantes
    ti_result = await db.execute(
        select(ThreatIntel)
        .where(ThreatIntel.is_malicious == True)
        .order_by(ThreatIntel.abuse_score.desc())
        .limit(5)
    )
    malicious_ips = ti_result.scalars().all()

    context = f"""
=== CURRENT SOC CONTEXT ===

OPEN ALERTS ({len(alerts)}):
"""
    for a in alerts:
        context += f"- [{a.severity.upper()}] {a.title} | src:{a.source_ip} | MITRE:{a.mitre_tactic}/{a.mitre_technique}\n"

    context += f"\nACTIVE INCIDENTS ({len(incidents)}):\n"
    for i in incidents:
        context += f"- [{i.severity.upper()}] {i.title} | {i.alert_count} alerts | tactics:{i.mitre_tactics}\n"

    context += f"\nKNOWN MALICIOUS IPs ({len(malicious_ips)}):\n"
    for ip in malicious_ips:
        context += f"- {ip.ip_address} | score:{ip.abuse_score} | {ip.country_code} | {ip.isp}\n"

    context += "\n=== END CONTEXT ===\n"
    return context


@router.post("/message")
async def send_message(
    body: dict,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Envoie un message au SOC chatbot."""
    user_message = body.get("message", "").strip()
    session_id = str(current_user.id)

    if not user_message:
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    # Initialise la conversation
    if session_id not in _conversations:
        _conversations[session_id] = []

    # Construit le contexte SOC
    soc_context = await build_context(db)

    # Construit les messages
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT + "\n" + soc_context},
        *_conversations[session_id][-10:],  # Garde les 10 derniers messages
        {"role": "user", "content": user_message},
    ]

    # Appelle Groq
    response = await call_groq(messages)

    # Sauvegarde dans l'historique
    _conversations[session_id].append({"role": "user", "content": user_message})
    _conversations[session_id].append({"role": "assistant", "content": response})

    return {
        "message": response,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "model": settings.GROQ_MODEL,
    }


@router.post("/analyze")
async def analyze_alert(
    body: dict,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Analyse une alert spécifique avec le LLM."""
    alert_id = body.get("alert_id")
    if not alert_id:
        raise HTTPException(status_code=400, detail="alert_id required")

    from uuid import UUID
    result = await db.execute(select(Alert).where(Alert.id == UUID(alert_id)))
    alert = result.scalar_one_or_none()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    # TI pour l'IP source
    ti_context = ""
    if alert.source_ip:
        ti_result = await db.execute(
            select(ThreatIntel).where(
                ThreatIntel.ip_address == cast(str(alert.source_ip), PG_INET)
            )
        )
        ti = ti_result.scalar_one_or_none()
        if ti:
            ti_context = f"""
Threat Intelligence for {alert.source_ip}:
- Abuse Score: {ti.abuse_score}/100
- Country: {ti.country_code}
- ISP: {ti.isp}
- Is Malicious: {ti.is_malicious}
- Is Tor: {ti.is_tor}
- Categories: {ti.categories}
"""

    prompt = f"""Analyze this security alert and provide:
1. **Threat Assessment**: What is happening and how severe is it?
2. **MITRE ATT&CK**: Confirm/expand the technique mapping
3. **Attack Pattern**: What is the attacker trying to do?
4. **Immediate Actions**: What should the SOC analyst do NOW?
5. **Investigation Steps**: What to look for next?

ALERT DETAILS:
- Title: {alert.title}
- Severity: {alert.severity}
- Status: {alert.status}
- Source IP: {alert.source_ip}
- Destination IP: {alert.destination_ip}
- Protocol: {alert.protocol}
- Source Port: {alert.source_port}
- Destination Port: {alert.destination_port}
- MITRE Tactic: {alert.mitre_tactic}
- MITRE Technique: {alert.mitre_technique}
- Description: {alert.description}
{ti_context}"""

    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": prompt},
    ]

    response = await call_groq(messages)

    return {
        "alert_id": alert_id,
        "analysis": response,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/history")
async def get_history(current_user: CurrentUser):
    """Historique de la conversation."""
    session_id = str(current_user.id)
    history = _conversations.get(session_id, [])
    return {
        "history": [
            {
                "role": msg["role"],
                "content": msg["content"],
            }
            for msg in history
        ],
        "count": len(history),
    }


@router.post("/clear")
async def clear_history(current_user: CurrentUser):
    """Efface l'historique."""
    session_id = str(current_user.id)
    _conversations.pop(session_id, None)
    return {"message": "History cleared"}