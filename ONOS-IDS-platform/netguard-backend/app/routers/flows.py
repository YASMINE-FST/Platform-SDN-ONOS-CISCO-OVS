"""
GET    /flows/analysis     → stats trafic globales
GET    /flows/top-talkers  → top devices/ports par volume
GET    /flows/protocols    → distribution ETH types
GET    /flows/timeline     → historique trafic (snapshots)
GET    /flows/rules        → flow rules par device
GET    /flows/anomalies    → spikes détectés
POST   /flows/{device_id}  → create flow rule on device   [admin/manager]
DELETE /flows/{device_id}/{flow_id} → delete flow rule     [admin/manager]
"""

from datetime import datetime, timezone
from typing import Annotated, Any

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.config import get_settings
from app.deps import CurrentUser, RequireAdminOrManager

settings = get_settings()
router = APIRouter(prefix="/flows", tags=["flows"])

# Cache pour calculer le delta entre deux appels
_stats_cache: dict = {}
_timeline: list = []  # Snapshots horodatés


def _auth():
    return (settings.ONOS_USER, settings.ONOS_PASSWORD)


def fmtBytes(b: int) -> str:
    for unit in ['B', 'KB', 'MB', 'GB']:
        if b < 1024:
            return f"{b:.1f} {unit}"
        b /= 1024
    return f"{b:.1f} TB"


ETH_TYPES = {
    "0x800":  "IPv4",
    "0x806":  "ARP",
    "0x86dd": "IPv6",
    "0x88cc": "LLDP",
    "0x8942": "ONOS",
    "0x8100": "VLAN",
}

DEVICE_NAMES = {
    "of:0000000000000001": "SW-01 (Core)",
    "of:0000000000000002": "SW-02 (Edge-1)",
    "of:0000000000000003": "SW-03 (Edge-2)",
}


@router.get("/analysis")
async def get_flow_analysis(_: CurrentUser):
    """Stats trafic globales depuis ONOS."""
    global _timeline

    async with httpx.AsyncClient(timeout=10) as client:
        try:
            stats_resp = await client.get(
                f"{settings.ONOS_URL}/onos/v1/statistics/ports",
                auth=_auth(),
            )
            stats_resp.raise_for_status()
            stats_data = stats_resp.json().get("statistics", [])
        except httpx.HTTPError as e:
            raise HTTPException(status_code=502, detail=f"ONOS error: {e}")

    now = datetime.now(timezone.utc)
    total_rx_bytes = 0
    total_tx_bytes = 0
    total_rx_packets = 0
    total_tx_packets = 0
    total_drops = 0
    total_errors = 0
    device_stats = []

    for device_stat in stats_data:
        device_id = device_stat.get("device")
        device_name = DEVICE_NAMES.get(device_id, device_id[-4:] if device_id else "unknown")
        dev_rx = 0
        dev_tx = 0
        dev_packets = 0
        port_details = []

        for port in device_stat.get("ports", []):
            rx = port.get("bytesReceived", 0)
            tx = port.get("bytesSent", 0)
            pkt_rx = port.get("packetsReceived", 0)
            pkt_tx = port.get("packetsSent", 0)
            drops = port.get("packetsRxDropped", 0) + port.get("packetsTxDropped", 0)
            errors = port.get("packetsRxErrors", 0) + port.get("packetsTxErrors", 0)
            duration = max(port.get("durationSec", 1), 1)

            throughput_rx = rx / duration  # bytes/sec
            throughput_tx = tx / duration

            dev_rx += rx
            dev_tx += tx
            dev_packets += pkt_rx + pkt_tx
            total_rx_bytes += rx
            total_tx_bytes += tx
            total_rx_packets += pkt_rx
            total_tx_packets += pkt_tx
            total_drops += drops
            total_errors += errors

            port_details.append({
                "port": str(port.get("port")),
                "bytes_rx": rx,
                "bytes_tx": tx,
                "packets_rx": pkt_rx,
                "packets_tx": pkt_tx,
                "throughput_rx_bps": round(throughput_rx, 2),
                "throughput_tx_bps": round(throughput_tx, 2),
                "drops": drops,
                "errors": errors,
                "duration_sec": duration,
            })

        device_stats.append({
            "device_id": device_id,
            "device_name": device_name,
            "bytes_rx": dev_rx,
            "bytes_tx": dev_tx,
            "total_bytes": dev_rx + dev_tx,
            "total_packets": dev_packets,
            "ports": port_details,
        })

    # Sauvegarde snapshot pour timeline
    snapshot = {
        "timestamp": now.isoformat(),
        "total_bytes": total_rx_bytes + total_tx_bytes,
        "total_packets": total_rx_packets + total_tx_packets,
        "rx_bytes": total_rx_bytes,
        "tx_bytes": total_tx_bytes,
    }
    _timeline.append(snapshot)
    # Garde les 60 derniers snapshots (1h si refresh toutes les minutes)
    _timeline = _timeline[-60:]

    return {
        "timestamp": now.isoformat(),
        "summary": {
            "total_rx_bytes": total_rx_bytes,
            "total_tx_bytes": total_tx_bytes,
            "total_bytes": total_rx_bytes + total_tx_bytes,
            "total_rx_packets": total_rx_packets,
            "total_tx_packets": total_tx_packets,
            "total_drops": total_drops,
            "total_errors": total_errors,
        },
        "devices": sorted(device_stats, key=lambda x: x["total_bytes"], reverse=True),
    }


@router.get("/top-talkers")
async def get_top_talkers(_: CurrentUser):
    """Top devices et ports par volume de trafic."""
    async with httpx.AsyncClient(timeout=10) as client:
        try:
            resp = await client.get(
                f"{settings.ONOS_URL}/onos/v1/statistics/ports",
                auth=_auth(),
            )
            resp.raise_for_status()
            stats = resp.json().get("statistics", [])
        except httpx.HTTPError as e:
            raise HTTPException(status_code=502, detail=f"ONOS error: {e}")

    all_ports = []
    device_totals = []

    for dev in stats:
        device_id = dev.get("device")
        device_name = DEVICE_NAMES.get(device_id, device_id)
        dev_total = 0

        for port in dev.get("ports", []):
            total = port.get("bytesReceived", 0) + port.get("bytesSent", 0)
            duration = max(port.get("durationSec", 1), 1)
            dev_total += total
            all_ports.append({
                "device_id": device_id,
                "device_name": device_name,
                "port": str(port.get("port")),
                "label": f"{device_name} · Port {port.get('port')}",
                "bytes_rx": port.get("bytesReceived", 0),
                "bytes_tx": port.get("bytesSent", 0),
                "total_bytes": total,
                "throughput_bps": round(total / duration, 2),
                "packets": port.get("packetsReceived", 0) + port.get("packetsSent", 0),
            })

        device_totals.append({
            "device_id": device_id,
            "device_name": device_name,
            "total_bytes": dev_total,
        })

    # Top 10 ports par volume
    top_ports = sorted(all_ports, key=lambda x: x["total_bytes"], reverse=True)[:10]
    top_devices = sorted(device_totals, key=lambda x: x["total_bytes"], reverse=True)
    max_bytes = top_ports[0]["total_bytes"] if top_ports else 1

    return {
        "top_ports": [
            {**p, "percentage": round(p["total_bytes"] / max_bytes * 100, 1)}
            for p in top_ports
        ],
        "top_devices": top_devices,
        "max_bytes": max_bytes,
    }


@router.get("/protocols")
async def get_protocol_distribution(_: CurrentUser):
    """Distribution des protocoles depuis les flow rules."""
    async with httpx.AsyncClient(timeout=10) as client:
        try:
            resp = await client.get(
                f"{settings.ONOS_URL}/onos/v1/flows",
                auth=_auth(),
            )
            resp.raise_for_status()
            flows = resp.json().get("flows", [])
        except httpx.HTTPError as e:
            raise HTTPException(status_code=502, detail=f"ONOS error: {e}")

    protocol_stats: dict[str, dict] = {}

    for flow in flows:
        selector = flow.get("selector", {})
        criteria = selector.get("criteria", [])
        packets = flow.get("packets", 0)
        bytes_val = flow.get("bytes", 0)

        for criterion in criteria:
            if criterion.get("type") == "ETH_TYPE":
                eth_type = criterion.get("ethType", "unknown")
                proto_name = ETH_TYPES.get(eth_type, f"Other ({eth_type})")

                if proto_name not in protocol_stats:
                    protocol_stats[proto_name] = {
                        "protocol": proto_name,
                        "eth_type": eth_type,
                        "packets": 0,
                        "bytes": 0,
                        "flows": 0,
                    }
                protocol_stats[proto_name]["packets"] += packets
                protocol_stats[proto_name]["bytes"] += bytes_val
                protocol_stats[proto_name]["flows"] += 1

    total_packets = sum(v["packets"] for v in protocol_stats.values()) or 1
    total_bytes = sum(v["bytes"] for v in protocol_stats.values()) or 1

    protocols = sorted(
        [
            {
                **v,
                "packet_pct": round(v["packets"] / total_packets * 100, 1),
                "bytes_pct": round(v["bytes"] / total_bytes * 100, 1),
            }
            for v in protocol_stats.values()
        ],
        key=lambda x: x["bytes"],
        reverse=True,
    )

    return {
        "protocols": protocols,
        "total_packets": total_packets,
        "total_bytes": total_bytes,
        "total_flows": len(flows),
    }


@router.get("/timeline")
async def get_traffic_timeline(_: CurrentUser):
    """Historique des snapshots trafic."""
    return {
        "timeline": _timeline,
        "count": len(_timeline),
    }


@router.get("/rules")
async def get_flow_rules(
    _: CurrentUser,
    device_id: str | None = None,
):
    """Flow rules OpenFlow par device."""
    async with httpx.AsyncClient(timeout=10) as client:
        try:
            url = f"{settings.ONOS_URL}/onos/v1/flows"
            if device_id:
                url = f"{settings.ONOS_URL}/onos/v1/flows/{device_id}"
            resp = await client.get(url, auth=_auth())
            resp.raise_for_status()
            flows = resp.json().get("flows", [])
        except httpx.HTTPError as e:
            raise HTTPException(status_code=502, detail=f"ONOS error: {e}")

    result = []
    for f in flows:
        # Parse selector
        criteria = f.get("selector", {}).get("criteria", [])
        match_parts = []
        for c in criteria:
            ctype = c.get("type", "")
            if ctype == "ETH_TYPE":
                match_parts.append(f"eth={ETH_TYPES.get(c.get('ethType', ''), c.get('ethType', ''))}")
            elif ctype == "IN_PORT":
                match_parts.append(f"in_port={c.get('port', '')}")
            elif ctype == "IPV4_SRC":
                match_parts.append(f"ip_src={c.get('ip', '')}")
            elif ctype == "IPV4_DST":
                match_parts.append(f"ip_dst={c.get('ip', '')}")
            elif ctype == "IP_PROTO":
                proto = {6: "TCP", 17: "UDP", 1: "ICMP"}.get(c.get("protocol", 0), str(c.get("protocol", "")))
                match_parts.append(f"proto={proto}")
            else:
                match_parts.append(f"{ctype}={c.get('value', '')}")

        # Parse actions
        instructions = f.get("treatment", {}).get("instructions", [])
        action_parts = []
        for inst in instructions:
            itype = inst.get("type", "")
            if itype == "OUTPUT":
                action_parts.append(f"→ port {inst.get('port', '')}")
            elif itype == "DROP":
                action_parts.append("→ DROP")
            elif itype == "NOACTION":
                action_parts.append("→ NOACTION")
            else:
                action_parts.append(f"→ {itype}")

        dev_id = f.get("deviceId", "")
        result.append({
            "id": f.get("id"),
            "device_id": dev_id,
            "device_name": DEVICE_NAMES.get(dev_id, dev_id),
            "state": f.get("state"),
            "priority": f.get("priority"),
            "table": f.get("tableId", 0),
            "life_sec": f.get("life", 0),
            "packets": f.get("packets", 0),
            "bytes": f.get("bytes", 0),
            "is_permanent": f.get("isPermanent", False),
            "app_id": f.get("appId", ""),
            "match": " · ".join(match_parts) or "match-all",
            "action": " ".join(action_parts) or "unknown",
        })

    return {
        "flows": sorted(result, key=lambda x: x["packets"], reverse=True),
        "total": len(result),
    }


@router.get("/anomalies")
async def get_anomalies(_: CurrentUser):
    """Détecte les anomalies de trafic basées sur les drops/errors."""
    async with httpx.AsyncClient(timeout=10) as client:
        try:
            resp = await client.get(
                f"{settings.ONOS_URL}/onos/v1/statistics/ports",
                auth=_auth(),
            )
            resp.raise_for_status()
            stats = resp.json().get("statistics", [])
        except httpx.HTTPError as e:
            raise HTTPException(status_code=502, detail=f"ONOS error: {e}")

    anomalies = []

    for dev in stats:
        device_id = dev.get("device")
        device_name = DEVICE_NAMES.get(device_id, device_id)

        for port in dev.get("ports", []):
            port_num = port.get("port")
            drops = port.get("packetsRxDropped", 0) + port.get("packetsTxDropped", 0)
            errors = port.get("packetsRxErrors", 0) + port.get("packetsTxErrors", 0)
            rx = port.get("packetsReceived", 0)
            tx = port.get("packetsSent", 0)
            total_pkts = rx + tx or 1
            drop_rate = drops / total_pkts * 100

            if drops > 0:
                severity = "critical" if drop_rate > 10 else "high" if drop_rate > 5 else "medium" if drop_rate > 1 else "low"
                anomalies.append({
                    "type": "packet_drops",
                    "severity": severity,
                    "device": device_name,
                    "port": str(port_num),
                    "label": f"{device_name} · Port {port_num}",
                    "drops": drops,
                    "drop_rate": round(drop_rate, 2),
                    "description": f"{drops} packets dropped ({drop_rate:.1f}% drop rate)",
                })

            if errors > 0:
                anomalies.append({
                    "type": "port_errors",
                    "severity": "high",
                    "device": device_name,
                    "port": str(port_num),
                    "label": f"{device_name} · Port {port_num}",
                    "errors": errors,
                    "description": f"{errors} port errors detected",
                })

    return {
        "anomalies": sorted(anomalies, key=lambda x: {"critical": 0, "high": 1, "medium": 2, "low": 3}[x["severity"]]),
        "total": len(anomalies),
        "has_critical": any(a["severity"] == "critical" for a in anomalies),
    }


# ── Flow CRUD ────────────────────────────────────────────────────


class FlowCreatePayload(BaseModel):
    """Payload for creating a flow rule via ONOS REST API."""
    priority: int = 40000
    timeout: int = 0
    isPermanent: bool = True
    appId: str = "org.onosproject.netguard"
    selector: dict[str, Any] = {}
    treatment: dict[str, Any] = {}


@router.post("/{device_id}", status_code=201)
async def create_flow(
    device_id: str,
    body: FlowCreatePayload,
    _: Annotated[None, RequireAdminOrManager],
):
    """Create a new flow rule on a specific device via ONOS."""
    flow_payload = {
        "priority": body.priority,
        "timeout": body.timeout,
        "isPermanent": body.isPermanent,
        "deviceId": device_id,
        "selector": body.selector,
        "treatment": body.treatment,
    }

    async with httpx.AsyncClient(timeout=10) as client:
        try:
            resp = await client.post(
                f"{settings.ONOS_URL}/onos/v1/flows/{device_id}",
                auth=_auth(),
                json={"flows": [flow_payload]},
                params={"appId": body.appId},
            )
            resp.raise_for_status()
            return {
                "success": True,
                "message": "Flow rule created successfully",
                "device_id": device_id,
                "result": resp.json() if resp.content else {},
            }
        except httpx.HTTPError as e:
            raise HTTPException(status_code=502, detail=f"ONOS error: {e}")


@router.delete("/{device_id}/{flow_id}")
async def delete_flow(
    device_id: str,
    flow_id: str,
    _: Annotated[None, RequireAdminOrManager],
):
    """Delete a flow rule from a specific device via ONOS."""
    async with httpx.AsyncClient(timeout=10) as client:
        try:
            resp = await client.delete(
                f"{settings.ONOS_URL}/onos/v1/flows/{device_id}/{flow_id}",
                auth=_auth(),
            )
            if resp.status_code == 404:
                raise HTTPException(status_code=404, detail="Flow rule not found")
            return {
                "success": True,
                "message": "Flow rule deleted successfully",
                "device_id": device_id,
                "flow_id": flow_id,
            }
        except httpx.HTTPStatusError as e:
            raise HTTPException(status_code=502, detail=f"ONOS error: {e}")


@router.get("/devices")
async def get_flow_devices(_: CurrentUser):
    """List devices with their flow rule counts."""
    async with httpx.AsyncClient(timeout=10) as client:
        try:
            dev_resp = await client.get(
                f"{settings.ONOS_URL}/onos/v1/devices",
                auth=_auth(),
            )
            dev_resp.raise_for_status()
            devices = dev_resp.json().get("devices", [])

            flows_resp = await client.get(
                f"{settings.ONOS_URL}/onos/v1/flows",
                auth=_auth(),
            )
            flows_resp.raise_for_status()
            flows = flows_resp.json().get("flows", [])
        except httpx.HTTPError as e:
            raise HTTPException(status_code=502, detail=f"ONOS error: {e}")

    # Count flows per device
    flow_counts: dict[str, int] = {}
    for f in flows:
        did = f.get("deviceId", "")
        flow_counts[did] = flow_counts.get(did, 0) + 1

    return {
        "devices": [
            {
                "id": d.get("id"),
                "type": d.get("type", "SWITCH"),
                "available": d.get("available", False),
                "manufacturer": d.get("mfr", ""),
                "flow_count": flow_counts.get(d.get("id"), 0),
            }
            for d in devices
        ],
    }