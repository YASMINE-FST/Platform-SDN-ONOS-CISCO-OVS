"""
GET /audit/logs         → logs d'audit paginés        [admin/manager]
GET /audit/stats        → stats globales               [admin/manager]
GET /audit/export       → export JSON/CEF              [admin]
GET /audit/report/pdf   → rapport PDF                  [admin]
"""

import io
from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse, JSONResponse
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import CurrentUser, RequireAdmin, RequireAdminOrManager
from app.models import AuditLog, User, Alert, Incident, SIEMEvent

router = APIRouter(prefix="/audit", tags=["audit"])


# ── LOGS ──────────────────────────────────────────────────────

@router.get("/logs")
async def get_audit_logs(
    _: Annotated[User, RequireAdminOrManager],
    db: Annotated[AsyncSession, Depends(get_db)],
    skip: int = 0,
    limit: int = 100,
    action: str | None = None,
    username: str | None = None,
    success: bool | None = None,
    days: int = 7,
):
    since = datetime.now(timezone.utc) - timedelta(days=days)
    stmt = select(AuditLog).where(AuditLog.created_at >= since)

    if action:
        stmt = stmt.where(AuditLog.action == action)
    if username:
        stmt = stmt.where(AuditLog.username == username)
    if success is not None:
        stmt = stmt.where(AuditLog.success == success)

    stmt = stmt.order_by(desc(AuditLog.created_at)).offset(skip).limit(limit)
    result = await db.execute(stmt)
    logs = result.scalars().all()

    return [
        {
            "id": log.id,
            "username": log.username,
            "action": log.action,
            "ip_address": str(log.ip_address) if log.ip_address else None,
            "user_agent": log.user_agent,
            "success": log.success,
            "details": log.details,
            "created_at": log.created_at.isoformat(),
        }
        for log in logs
    ]


# ── STATS ─────────────────────────────────────────────────────

@router.get("/stats")
async def get_audit_stats(
    _: Annotated[User, RequireAdminOrManager],
    db: Annotated[AsyncSession, Depends(get_db)],
    days: int = 7,
):
    since = datetime.now(timezone.utc) - timedelta(days=days)

    # Total logs
    total = await db.scalar(
        select(func.count(AuditLog.id)).where(AuditLog.created_at >= since)
    )
    failed = await db.scalar(
        select(func.count(AuditLog.id)).where(
            AuditLog.created_at >= since,
            AuditLog.success == False,
        )
    )

    # Par action
    action_rows = await db.execute(
        select(AuditLog.action, func.count(AuditLog.id).label("cnt"))
        .where(AuditLog.created_at >= since)
        .group_by(AuditLog.action)
        .order_by(desc(func.count(AuditLog.id)))
        .limit(10)
    )
    by_action = [{"action": r[0], "count": r[1]} for r in action_rows]

    # Par user
    user_rows = await db.execute(
        select(AuditLog.username, func.count(AuditLog.id).label("cnt"))
        .where(
            AuditLog.created_at >= since,
            AuditLog.username.isnot(None),
        )
        .group_by(AuditLog.username)
        .order_by(desc(func.count(AuditLog.id)))
        .limit(10)
    )
    by_user = [{"username": r[0], "count": r[1]} for r in user_rows]

    # Top IPs
    ip_rows = await db.execute(
        select(AuditLog.ip_address, func.count(AuditLog.id).label("cnt"))
        .where(
            AuditLog.created_at >= since,
            AuditLog.ip_address.isnot(None),
        )
        .group_by(AuditLog.ip_address)
        .order_by(desc(func.count(AuditLog.id)))
        .limit(10)
    )
    by_ip = [{"ip": str(r[0]), "count": r[1]} for r in ip_rows]

    # Login failures
    login_failures = await db.scalar(
        select(func.count(AuditLog.id)).where(
            AuditLog.created_at >= since,
            AuditLog.action == "login_failed",
        )
    )

    return {
        "period_days": days,
        "total_events": total or 0,
        "failed_events": failed or 0,
        "login_failures": login_failures or 0,
        "success_rate": round((1 - (failed or 0) / max(total or 1, 1)) * 100, 1),
        "by_action": by_action,
        "by_user": by_user,
        "top_ips": by_ip,
    }


# ── EXPORT JSON/CEF ───────────────────────────────────────────

@router.get("/export")
async def export_logs(
    _: Annotated[User, RequireAdmin],
    db: Annotated[AsyncSession, Depends(get_db)],
    days: int = 7,
    format: str = "json",
):
    since = datetime.now(timezone.utc) - timedelta(days=days)
    result = await db.execute(
        select(AuditLog)
        .where(AuditLog.created_at >= since)
        .order_by(desc(AuditLog.created_at))
    )
    logs = result.scalars().all()

    if format == "cef":
        # Common Event Format (SIEM standard)
        lines = []
        for log in logs:
            cef = (
                f"CEF:0|NetGuard|SOC|1.0|{log.action}|{log.action}|"
                f"{'3' if not log.success else '1'}|"
                f"src={log.ip_address or 'unknown'} "
                f"suser={log.username or 'unknown'} "
                f"outcome={'success' if log.success else 'failure'} "
                f"rt={int(log.created_at.timestamp() * 1000)}"
            )
            lines.append(cef)

        content = "\n".join(lines)
        return StreamingResponse(
            io.StringIO(content),
            media_type="text/plain",
            headers={"Content-Disposition": f"attachment; filename=netguard_audit_{days}d.cef"},
        )

    else:
        import json
        data = [
            {
                "id": log.id,
                "timestamp": log.created_at.isoformat(),
                "username": log.username,
                "action": log.action,
                "ip_address": str(log.ip_address) if log.ip_address else None,
                "success": log.success,
                "details": log.details,
            }
            for log in logs
        ]
        content = json.dumps(data, indent=2, default=str)
        return StreamingResponse(
            io.StringIO(content),
            media_type="application/json",
            headers={"Content-Disposition": f"attachment; filename=netguard_audit_{days}d.json"},
        )


# ── PDF REPORT ────────────────────────────────────────────────

@router.get("/report/pdf")
async def generate_pdf_report(
    _: Annotated[User, RequireAdmin],
    db: Annotated[AsyncSession, Depends(get_db)],
    days: int = 7,
):
    """Génère un rapport PDF complet du SOC."""
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import cm
    from reportlab.platypus import (
        SimpleDocTemplate, Paragraph, Spacer, Table,
        TableStyle, HRFlowable
    )
    from reportlab.lib.enums import TA_CENTER, TA_LEFT

    since = datetime.now(timezone.utc) - timedelta(days=days)
    now = datetime.now(timezone.utc)

    # Collecte les données
    total_alerts = await db.scalar(select(func.count(Alert.id)))
    open_alerts = await db.scalar(
        select(func.count(Alert.id)).where(Alert.status == "open")
    )
    critical_alerts = await db.scalar(
        select(func.count(Alert.id)).where(Alert.severity == "critical")
    )
    total_incidents = await db.scalar(select(func.count(Incident.id)))
    open_incidents = await db.scalar(
        select(func.count(Incident.id)).where(Incident.status != "resolved")
    )
    total_events = await db.scalar(
        select(func.count(AuditLog.id)).where(AuditLog.created_at >= since)
    )
    login_failures = await db.scalar(
        select(func.count(AuditLog.id)).where(
            AuditLog.action == "login_failed",
            AuditLog.created_at >= since,
        )
    )

    # Dernières alerts
    alerts_result = await db.execute(
        select(Alert).order_by(desc(Alert.created_at)).limit(10)
    )
    recent_alerts = alerts_result.scalars().all()

    # Derniers incidents
    incidents_result = await db.execute(
        select(Incident).order_by(desc(Incident.created_at)).limit(5)
    )
    recent_incidents = incidents_result.scalars().all()

    # Tactics
    tactics_result = await db.execute(
        select(Alert.mitre_tactic, func.count(Alert.id).label("cnt"))
        .where(Alert.mitre_tactic.isnot(None))
        .group_by(Alert.mitre_tactic)
        .order_by(desc(func.count(Alert.id)))
    )
    tactics = tactics_result.all()

    # Génère le PDF
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=A4,
        rightMargin=2*cm, leftMargin=2*cm,
        topMargin=2*cm, bottomMargin=2*cm,
    )

    styles = getSampleStyleSheet()
    story = []

    # Couleurs NetGuard
    CYAN = colors.HexColor("#0891b2")
    DARK = colors.HexColor("#0f172a")
    SLATE = colors.HexColor("#1e293b")
    RED = colors.HexColor("#ef4444")
    GREEN = colors.HexColor("#22c55e")
    ORANGE = colors.HexColor("#f97316")

    # Styles
    title_style = ParagraphStyle(
        "Title", parent=styles["Title"],
        textColor=CYAN, fontSize=24, spaceAfter=6,
        alignment=TA_CENTER,
    )
    subtitle_style = ParagraphStyle(
        "Subtitle", parent=styles["Normal"],
        textColor=colors.HexColor("#64748b"),
        fontSize=10, alignment=TA_CENTER, spaceAfter=20,
    )
    section_style = ParagraphStyle(
        "Section", parent=styles["Heading1"],
        textColor=CYAN, fontSize=14,
        spaceBefore=16, spaceAfter=8,
        borderPad=4,
    )
    body_style = ParagraphStyle(
        "Body", parent=styles["Normal"],
        fontSize=9, textColor=colors.HexColor("#334155"),
        spaceAfter=4,
    )

    # ── Header ────────────────────────────────────────────────
    story.append(Spacer(1, 0.5*cm))
    story.append(Paragraph("🛡 NetGuard SOC", title_style))
    story.append(Paragraph("Security Operations Center — Report", subtitle_style))
    story.append(Paragraph(
        f"Period: Last {days} days | Generated: {now.strftime('%Y-%m-%d %H:%M UTC')}",
        subtitle_style,
    ))
    story.append(HRFlowable(width="100%", thickness=2, color=CYAN, spaceAfter=16))

    # ── Executive Summary ─────────────────────────────────────
    story.append(Paragraph("Executive Summary", section_style))

    summary_data = [
        ["Metric", "Value", "Status"],
        ["Total Alerts", str(total_alerts or 0), ""],
        ["Open Alerts", str(open_alerts or 0), "⚠ ATTENTION" if (open_alerts or 0) > 0 else "✓ OK"],
        ["Critical Alerts", str(critical_alerts or 0), "🔴 CRITICAL" if (critical_alerts or 0) > 0 else "✓ OK"],
        ["Total Incidents", str(total_incidents or 0), ""],
        ["Open Incidents", str(open_incidents or 0), "⚠ ATTENTION" if (open_incidents or 0) > 0 else "✓ OK"],
        ["Audit Events", str(total_events or 0), f"Last {days} days"],
        ["Login Failures", str(login_failures or 0), "⚠ ATTENTION" if (login_failures or 0) > 3 else "✓ OK"],
    ]

    summary_table = Table(summary_data, colWidths=[7*cm, 4*cm, 6*cm])
    summary_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), CYAN),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 10),
        ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor("#f8fafc")),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor("#f1f5f9")]),
        ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 1), (-1, -1), 9),
        ('ALIGN', (1, 0), (1, -1), 'CENTER'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
    ]))
    story.append(summary_table)
    story.append(Spacer(1, 0.5*cm))

    # ── MITRE Tactics ─────────────────────────────────────────
    if tactics:
        story.append(Paragraph("MITRE ATT&CK — Active Tactics", section_style))
        tactic_data = [["Tactic", "Alert Count"]]
        for t in tactics:
            tactic_data.append([t[0] or "Unknown", str(t[1])])

        tactic_table = Table(tactic_data, colWidths=[10*cm, 4*cm])
        tactic_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#7c3aed")),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 10),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor("#f5f3ff")]),
            ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 1), (-1, -1), 9),
            ('ALIGN', (1, 0), (1, -1), 'CENTER'),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
            ('TOPPADDING', (0, 0), (-1, -1), 5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
            ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ]))
        story.append(tactic_table)
        story.append(Spacer(1, 0.5*cm))

    # ── Recent Alerts ─────────────────────────────────────────
    story.append(Paragraph("Recent Security Alerts", section_style))
    alert_data = [["Time", "Title", "Severity", "Status", "Source IP"]]
    for a in recent_alerts:
        alert_data.append([
            a.created_at.strftime("%m/%d %H:%M"),
            (a.title[:35] + "...") if len(a.title) > 35 else a.title,
            str(a.severity).upper(),
            str(a.status),
            str(a.source_ip) if a.source_ip else "-",
        ])

    alert_table = Table(alert_data, colWidths=[2.5*cm, 6.5*cm, 2*cm, 2.5*cm, 3.5*cm])
    alert_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#dc2626")),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 9),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor("#fff1f2")]),
        ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 1), (-1, -1), 8),
        ('ALIGN', (2, 0), (3, -1), 'CENTER'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
    ]))
    story.append(alert_table)
    story.append(Spacer(1, 0.5*cm))

    # ── Incidents ─────────────────────────────────────────────
    if recent_incidents:
        story.append(Paragraph("Active Incidents", section_style))
        inc_data = [["Created", "Title", "Severity", "Alerts", "Status"]]
        for i in recent_incidents:
            inc_data.append([
                i.created_at.strftime("%m/%d %H:%M"),
                (i.title[:40] + "...") if len(i.title) > 40 else i.title,
                str(i.severity).upper(),
                str(i.alert_count),
                str(i.status),
            ])

        inc_table = Table(inc_data, colWidths=[2.5*cm, 7*cm, 2*cm, 1.5*cm, 2.5*cm])
        inc_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), ORANGE),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 9),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor("#fff7ed")]),
            ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 1), (-1, -1), 8),
            ('ALIGN', (2, 0), (-1, -1), 'CENTER'),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
            ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ]))
        story.append(inc_table)
        story.append(Spacer(1, 0.5*cm))

    # ── Footer ────────────────────────────────────────────────
    story.append(HRFlowable(width="100%", thickness=1, color=CYAN, spaceBefore=16))
    story.append(Paragraph(
        f"NetGuard SOC Platform — Confidential | {now.strftime('%Y-%m-%d %H:%M UTC')}",
        ParagraphStyle("Footer", parent=styles["Normal"],
                       fontSize=7, textColor=colors.HexColor("#94a3b8"),
                       alignment=TA_CENTER),
    ))

    doc.build(story)
    buffer.seek(0)

    filename = f"netguard_report_{now.strftime('%Y%m%d')}_{days}d.pdf"
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )