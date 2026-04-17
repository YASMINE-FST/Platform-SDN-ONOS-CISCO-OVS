"""
Threat Intelligence Engine
──────────────────────────
Sources :
- AbuseIPDB  → score d'abus, rapports, pays, ISP
- GreyNoise  → scanning, bots (gratuit, sans clé)
- Listes noires publiques (Feodo, CINS)
"""

import asyncio
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

import httpx
from sqlalchemy import select, and_, cast
from sqlalchemy.dialects.postgresql import INET as PG_INET
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.config import get_settings
from app.models import Alert, ThreatIntel

logger = logging.getLogger("threat_intel")
settings = get_settings()

PUBLIC_BLOCKLISTS = [
    "https://feodotracker.abuse.ch/downloads/ipblocklist.txt",
    "https://cinsscore.com/list/ci-badguys.txt",
]

ABUSE_CATEGORIES = {
    1: "DNS Compromise", 2: "DNS Poisoning", 3: "Fraud Orders",
    4: "DDoS Attack", 5: "FTP Brute-Force", 6: "Ping of Death",
    7: "Phishing", 8: "Fraud VoIP", 9: "Open Proxy",
    10: "Web Spam", 11: "Email Spam", 12: "Blog Spam",
    13: "VPN IP", 14: "Port Scan", 15: "Hacking",
    16: "SQL Injection", 17: "Spoofing", 18: "Brute Force",
    19: "Bad Web Bot", 20: "Exploited Host", 21: "Web App Attack",
    22: "SSH", 23: "IoT Targeted",
}


def _parse_datetime(value) -> Optional[datetime]:
    """Convertit une string ISO en datetime, retourne None si invalide."""
    if value is None:
        return None
    if isinstance(value, datetime):
        return value
    if isinstance(value, str):
        try:
            return datetime.fromisoformat(value.replace('Z', '+00:00'))
        except (ValueError, AttributeError):
            return None
    return None


class ThreatIntelEngine:
    def __init__(self, session_factory: async_sessionmaker):
        self.session_factory = session_factory
        self._blacklist_cache: set[str] = set()
        self._cache_updated: Optional[datetime] = None
        self.running = False
        self._task: Optional[asyncio.Task] = None

    async def start(self):
        self.running = True
        self._task = asyncio.create_task(self._refresh_loop())
        logger.info("Threat Intel Engine started")

    async def stop(self):
        self.running = False
        if self._task:
            self._task.cancel()

    async def _refresh_loop(self):
        while self.running:
            try:
                await self._refresh_blacklists()
            except Exception as e:
                logger.error(f"TI refresh error: {e}")
            await asyncio.sleep(3600)

    async def _refresh_blacklists(self):
        new_ips: set[str] = set()
        async with httpx.AsyncClient(timeout=30) as client:
            for url in PUBLIC_BLOCKLISTS:
                try:
                    resp = await client.get(url)
                    if resp.status_code == 200:
                        for line in resp.text.splitlines():
                            line = line.strip()
                            if line and not line.startswith("#"):
                                new_ips.add(line.split()[0])
                except Exception:
                    pass
        self._blacklist_cache = new_ips
        self._cache_updated = datetime.now(timezone.utc)
        logger.info(f"TI blacklists refreshed: {len(new_ips)} IPs")

    def is_blacklisted(self, ip: str) -> bool:
        return ip in self._blacklist_cache

    async def check_abuseipdb(self, ip: str) -> dict:
        if not settings.ABUSEIPDB_API_KEY:
            return {}
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.get(
                    "https://api.abuseipdb.com/api/v2/check",
                    headers={
                        "Key": settings.ABUSEIPDB_API_KEY,
                        "Accept": "application/json",
                    },
                    params={
                        "ipAddress": ip,
                        "maxAgeInDays": 90,
                        "verbose": True,
                    },
                )
                if resp.status_code == 200:
                    return resp.json().get("data", {})
        except Exception as e:
            logger.error(f"AbuseIPDB error for {ip}: {e}")
        return {}

    async def check_greynoise(self, ip: str) -> dict:
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.get(
                    f"https://api.greynoise.io/v3/community/{ip}",
                    headers={"Accept": "application/json"},
                )
                if resp.status_code == 200:
                    return resp.json()
        except Exception:
            pass
        return {}

    async def enrich_ip(self, ip: str) -> dict:
        result = {
            "ip": ip,
            "abuse_score": 0,
            "total_reports": 0,
            "country_code": None,
            "isp": None,
            "domain": None,
            "usage_type": None,
            "is_whitelisted": False,
            "is_tor": False,
            "is_vpn": False,
            "is_malicious": False,
            "categories": [],
            "last_reported": None,
            "sources": [],
        }

        # 1. Listes noires publiques
        if self.is_blacklisted(ip):
            result["is_malicious"] = True
            result["abuse_score"] = max(result["abuse_score"], 75)
            result["sources"].append("public_blocklist")

        # 2. AbuseIPDB
        abuse_data = await self.check_abuseipdb(ip)
        if abuse_data:
            result["abuse_score"] = abuse_data.get("abuseConfidenceScore", 0)
            result["total_reports"] = abuse_data.get("totalReports", 0)
            result["country_code"] = abuse_data.get("countryCode")
            result["isp"] = abuse_data.get("isp")
            result["domain"] = abuse_data.get("domain")
            result["usage_type"] = abuse_data.get("usageType")
            result["is_whitelisted"] = abuse_data.get("isWhitelisted", False)
            result["is_tor"] = abuse_data.get("isTor", False)

            cat_ids = []
            for report in abuse_data.get("reports", [])[:10]:
                cat_ids.extend(report.get("categories", []))
            result["categories"] = list({
                ABUSE_CATEGORIES.get(c, str(c))
                for c in set(cat_ids)
            })

            last_rep = abuse_data.get("lastReportedAt")
            if last_rep:
                result["last_reported"] = last_rep

            if result["abuse_score"] >= 25:
                result["is_malicious"] = True

            result["sources"].append("abuseipdb")

        # 3. GreyNoise
        gn_data = await self.check_greynoise(ip)
        if gn_data:
            classification = gn_data.get("classification", "")
            if classification == "malicious":
                result["is_malicious"] = True
                result["abuse_score"] = max(result["abuse_score"], 80)
            elif classification == "benign":
                result["is_malicious"] = False
            result["sources"].append("greynoise")

        return result

    async def enrich_and_save(self, ip: str, db: AsyncSession) -> dict:
        # Vérifie cache < 24h
        result = await db.execute(
            select(ThreatIntel).where(
                and_(
                    ThreatIntel.ip_address == cast(ip, PG_INET),
                    ThreatIntel.enriched_at >= datetime.now(timezone.utc) - timedelta(hours=24),
                )
            )
        )
        existing = result.scalar_one_or_none()
        if existing:
            return {
                "ip": ip,
                "abuse_score": existing.abuse_score,
                "country_code": existing.country_code,
                "isp": existing.isp,
                "is_malicious": existing.is_malicious,
                "is_tor": existing.is_tor,
                "categories": existing.categories or [],
                "cached": True,
            }

        data = await self.enrich_ip(ip)

        # ✅ Fix : convertit last_reported string → datetime
        last_reported = _parse_datetime(data.get("last_reported"))

        stmt = insert(ThreatIntel).values(
            ip_address=cast(ip, PG_INET),
            source="combined",
            abuse_score=data["abuse_score"],
            total_reports=data["total_reports"],
            country_code=data["country_code"],
            isp=data["isp"],
            domain=data["domain"],
            usage_type=data["usage_type"],
            is_whitelisted=data["is_whitelisted"],
            is_tor=data["is_tor"],
            is_vpn=data.get("is_vpn", False),
            is_malicious=data["is_malicious"],
            categories=data["categories"] or None,
            last_reported=last_reported,
            raw_data=data,
            enriched_at=datetime.now(timezone.utc),
        ).on_conflict_do_update(
            index_elements=["ip_address", "source"],
            set_={
                "abuse_score": data["abuse_score"],
                "total_reports": data["total_reports"],
                "is_malicious": data["is_malicious"],
                "categories": data["categories"] or None,
                "raw_data": data,
                "enriched_at": datetime.now(timezone.utc),
            }
        )
        await db.execute(stmt)
        await db.commit()

        return data

    async def enrich_alert(self, alert_id: str, source_ip: str):
        async with self.session_factory() as db:
            data = await self.enrich_and_save(source_ip, db)
            logger.info(
                f"TI enrichment for {source_ip}: "
                f"score={data['abuse_score']} "
                f"malicious={data['is_malicious']}"
            )
            return data