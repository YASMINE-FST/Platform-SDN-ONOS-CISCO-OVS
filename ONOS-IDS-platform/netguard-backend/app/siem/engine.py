"""
SIEM Correlation Engine
─────────────────────────────────────────────────────────────
Worker qui tourne en arrière-plan et corrèle les événements :
- Surveille les nouvelles alerts toutes les 30 secondes
- Applique les règles de corrélation
- Crée des incidents si les seuils sont dépassés
- Enrichit les alerts avec le contexte SIEM
"""

import asyncio
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import select, func, and_, update
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.models import (
    Alert, AlertSeverity, Incident, IncidentAlert,
    SIEMRule, SIEMEvent, AuditLog
)

logger = logging.getLogger("siem.engine")


class SIEMEngine:
    def __init__(self, session_factory: async_sessionmaker):
        self.session_factory = session_factory
        self.running = False
        self._task: Optional[asyncio.Task] = None

    async def start(self):
        self.running = True
        self._task = asyncio.create_task(self._run_loop())
        logger.info("SIEM Engine started")

    async def stop(self):
        self.running = False
        if self._task:
            self._task.cancel()
        logger.info("SIEM Engine stopped")

    async def _run_loop(self):
        while self.running:
            try:
                async with self.session_factory() as db:
                    await self._process_cycle(db)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"SIEM Engine error: {e}")
            await asyncio.sleep(30)  # Cycle toutes les 30 secondes

    async def _process_cycle(self, db: AsyncSession):
        """Un cycle de corrélation complet."""
        rules_result = await db.execute(
            select(SIEMRule).where(SIEMRule.is_active == True)
        )
        rules = rules_result.scalars().all()

        for rule in rules:
            await self._apply_rule(db, rule)

        await db.commit()

    async def _apply_rule(self, db: AsyncSession, rule: SIEMRule):
        """Applique une règle de corrélation."""
        now = datetime.now(timezone.utc)
        window_start = now - timedelta(minutes=rule.time_window_minutes)

        if rule.condition_type == "alert_count":
            await self._rule_alert_count(db, rule, window_start, now)

        elif rule.condition_type == "same_source_ip":
            await self._rule_same_source_ip(db, rule, window_start, now)

        elif rule.condition_type == "login_failure":
            await self._rule_login_failure(db, rule, window_start, now)

        elif rule.condition_type == "multi_attack_type":
            await self._rule_multi_attack(db, rule, window_start, now)

    # ── Règle 1 : Burst d'alerts par sévérité ────────────────
    async def _rule_alert_count(
        self, db: AsyncSession, rule: SIEMRule,
        window_start: datetime, now: datetime
    ):
        from sqlalchemy import String
        
        stmt = select(Alert).where(Alert.created_at >= window_start)
        
        if rule.severity_filter:
            stmt = stmt.where(
                Alert.severity == rule.severity_filter
            )
        
        result = await db.execute(stmt)
        alerts = result.scalars().all()

        if len(alerts) >= rule.threshold:
            existing = await db.execute(
                select(Incident).where(
                    and_(
                        Incident.title.contains(rule.name),
                        Incident.created_at >= window_start,
                        Incident.status != "resolved",
                    )
                )
            )
            if existing.scalar_one_or_none():
                return

            await self._create_incident(
                db,
                title=f"[SIEM] {rule.name.replace('_', ' ').title()} — {len(alerts)} alerts in {rule.time_window_minutes}min",
                description=rule.description or f"Rule '{rule.name}' triggered: {len(alerts)} alerts detected",
                severity=rule.incident_severity,
                alerts=alerts,
                rule_name=rule.name,
            )
            logger.warning(f"SIEM Rule '{rule.name}' triggered → Incident created ({len(alerts)} alerts)")
    # ── Règle 2 : Même IP source ──────────────────────────────
    async def _rule_same_source_ip(
        self, db: AsyncSession, rule: SIEMRule,
        window_start: datetime, now: datetime
    ):
        from sqlalchemy import cast, Text
        
        stmt = (
            select(
                cast(Alert.source_ip, Text).label("src_ip"),
                func.count(Alert.id).label("cnt")
            )
            .where(
                and_(
                    Alert.created_at >= window_start,
                    Alert.source_ip.isnot(None),
                )
            )
            .group_by(Alert.source_ip)
            .having(func.count(Alert.id) >= rule.threshold)
        )
        result = await db.execute(stmt)
        rows = result.all()

        for row in rows:
            source_ip = str(row.src_ip)
            
            existing = await db.execute(
                select(Incident).where(
                    and_(
                        Incident.title.contains(source_ip),
                        Incident.created_at >= window_start,
                        Incident.status != "resolved",
                    )
                )
            )
            if existing.scalar_one_or_none():
                continue

            alerts_result = await db.execute(
                select(Alert).where(
                    and_(
                        Alert.created_at >= window_start,
                        Alert.source_ip.isnot(None),
                    )
                )
            )
            alerts = alerts_result.scalars().all()

            await self._create_incident(
                db,
                title=f"[SIEM] Persistent Threat from {source_ip} — {row.cnt} alerts",
                description=f"IP {source_ip} triggered {row.cnt} alerts in {rule.time_window_minutes} minutes",
                severity=rule.incident_severity,
                alerts=alerts,
                rule_name=rule.name,
                source_ips=[source_ip],
            )
            logger.warning(f"SIEM: Persistent threat from {source_ip}")

    # ── Règle 3 : Brute force (login failures) ────────────────
    async def _rule_login_failure(
        self, db: AsyncSession, rule: SIEMRule,
        window_start: datetime, now: datetime
    ):
        stmt = (
            select(
                AuditLog.ip_address,
                AuditLog.username,
                func.count(AuditLog.id).label("cnt")
            )
            .where(
                and_(
                    AuditLog.action == "login_failed",
                    AuditLog.created_at >= window_start,
                    AuditLog.ip_address.isnot(None),
                )
            )
            .group_by(AuditLog.ip_address, AuditLog.username)
            .having(func.count(AuditLog.id) >= rule.threshold)
        )
        result = await db.execute(stmt)
        rows = result.all()

        for row in rows:
            source_ip = str(row.ip_address) if row.ip_address else "unknown"
            existing = await db.execute(
                select(Incident).where(
                    and_(
                        Incident.title.contains("Brute Force"),
                        Incident.title.contains(source_ip),
                        Incident.created_at >= window_start,
                        Incident.status != "resolved",
                    )
                )
            )
            if existing.scalar_one_or_none():
                continue

            await self._create_incident(
                db,
                title=f"[SIEM] Brute Force Attack from {source_ip} — {row.cnt} failed logins",
                description=f"IP {source_ip} attempted {row.cnt} failed logins for user '{row.username}'",
                severity=rule.incident_severity,
                alerts=[],
                rule_name=rule.name,
                source_ips=[source_ip],
            )
            logger.warning(f"SIEM: Brute force from {source_ip} ({row.cnt} attempts)")

    # ── Règle 4 : Multi-type attack (APT) ────────────────────
    async def _rule_multi_attack(
        self, db: AsyncSession, rule: SIEMRule,
        window_start: datetime, now: datetime
    ):
        stmt = (
            select(
                Alert.source_ip,
                func.array_agg(Alert.mitre_tactic.distinct()).label("tactics"),
                func.count(Alert.id).label("cnt"),
            )
            .where(
                and_(
                    Alert.created_at >= window_start,
                    Alert.source_ip.isnot(None),
                    Alert.mitre_tactic.isnot(None),
                )
            )
            .group_by(Alert.source_ip)
            .having(func.count(Alert.mitre_tactic.distinct()) >= rule.threshold)
        )
        result = await db.execute(stmt)
        rows = result.all()

        for row in rows:
            source_ip = str(row.source_ip)
            tactics = [t for t in (row.tactics or []) if t]

            existing = await db.execute(
                select(Incident).where(
                    and_(
                        Incident.title.contains("APT"),
                        Incident.title.contains(source_ip),
                        Incident.created_at >= window_start,
                        Incident.status != "resolved",
                    )
                )
            )
            if existing.scalar_one_or_none():
                continue

            alerts_result = await db.execute(
                select(Alert).where(
                    and_(
                        Alert.created_at >= window_start,
                        Alert.source_ip == row.source_ip,
                    )
                )
            )
            alerts = alerts_result.scalars().all()

            await self._create_incident(
                db,
                title=f"[SIEM] APT Detected from {source_ip} — {len(tactics)} MITRE tactics",
                description=f"Multi-vector attack from {source_ip}: {', '.join(tactics)}",
                severity=rule.incident_severity,
                alerts=alerts,
                rule_name=rule.name,
                source_ips=[source_ip],
                mitre_tactics=tactics,
            )
            logger.warning(f"SIEM: APT detected from {source_ip} — tactics: {tactics}")

    # ── Créateur d'incidents ──────────────────────────────────
    async def _create_incident(
        self,
        db: AsyncSession,
        title: str,
        description: str,
        severity: str,
        alerts: list,
        rule_name: str,
        source_ips: list[str] | None = None,
        mitre_tactics: list[str] | None = None,
    ):
        # Collecte les métadonnées des alerts
        all_source_ips = source_ips or []
        all_tactics = mitre_tactics or []
        all_techniques = []
        all_attack_types = []

        for alert in alerts:
            if alert.source_ip and str(alert.source_ip) not in all_source_ips:
                all_source_ips.append(str(alert.source_ip))
            if alert.mitre_tactic and alert.mitre_tactic not in all_tactics:
                all_tactics.append(alert.mitre_tactic)
            if alert.mitre_technique and alert.mitre_technique not in all_techniques:
                all_techniques.append(alert.mitre_technique)

        incident = Incident(
            title=title,
            description=description,
            severity=severity,
            status="open",
            alert_count=len(alerts),
            source_ips=all_source_ips or None,
            attack_types=all_attack_types or None,
            mitre_tactics=all_tactics or None,
            mitre_techniques=all_techniques or None,
            first_seen=datetime.now(timezone.utc),
            last_seen=datetime.now(timezone.utc),
        )
        db.add(incident)
        await db.flush()

        # Lie les alerts à l'incident
        for alert in alerts:
            db.add(IncidentAlert(
                incident_id=incident.id,
                alert_id=alert.id,
            ))

        # Crée un événement SIEM
        db.add(SIEMEvent(
            event_type="incident_created",
            source="siem_engine",
            severity=severity,
            title=title,
            details={
                "rule": rule_name,
                "alert_count": len(alerts),
                "source_ips": all_source_ips,
            },
        ))

        logger.info(f"Incident created: {title}")

    # ── Méthode publique pour enregistrer un événement ───────
    async def record_event(
        self,
        event_type: str,
        source: str,
        severity: str,
        title: str,
        details: dict | None = None,
        source_ip: str | None = None,
        alert_id=None,
        user_id=None,
    ):
        async with self.session_factory() as db:
            event = SIEMEvent(
                event_type=event_type,
                source=source,
                severity=severity,
                title=title,
                details=details or {},
                source_ip=source_ip,
                alert_id=alert_id,
                user_id=user_id,
            )
            db.add(event)
            await db.commit()