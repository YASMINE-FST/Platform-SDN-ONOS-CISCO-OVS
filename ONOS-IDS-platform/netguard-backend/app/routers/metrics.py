"""
Network Metrics & Performance
GET /metrics/devices          → Device-level metrics (RX/TX)         [tous]
GET /metrics/performance      → Network-wide performance summary     [tous]
GET /metrics/heatmap          → Top links heatmap                    [tous]
GET /metrics/cluster          → ONOS cluster health                  [tous]
GET /metrics/intents          → Network intents summary              [tous]
"""

import httpx
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException

from app.config import get_settings
from app.deps import CurrentUser

settings = get_settings()
router = APIRouter(prefix="/metrics", tags=["metrics"])


def _auth():
    return (settings.ONOS_USER, settings.ONOS_PASSWORD)


@router.get("/devices")
async def get_device_metrics(_: CurrentUser):
    """Device-level metrics: RX/TX bytes, packets, port counts from ONOS."""
    async with httpx.AsyncClient(timeout=10) as client:
        try:
            dev_resp = await client.get(
                f"{settings.ONOS_URL}/onos/v1/devices",
                auth=_auth(),
            )
            dev_resp.raise_for_status()
            devices = dev_resp.json().get("devices", [])

            stats_resp = await client.get(
                f"{settings.ONOS_URL}/onos/v1/statistics/ports",
                auth=_auth(),
            )
            stats_resp.raise_for_status()
            stats = stats_resp.json().get("statistics", [])
        except httpx.HTTPError as e:
            raise HTTPException(status_code=502, detail=f"ONOS error: {e}")

    # Build device lookup
    dev_map = {}
    for d in devices:
        dev_map[d.get("id")] = {
            "device_id": d.get("id"),
            "type": d.get("type", "SWITCH"),
            "available": d.get("available", False),
            "manufacturer": d.get("mfr", ""),
            "hw_version": d.get("hw", ""),
            "sw_version": d.get("sw", ""),
        }

    metrics = []
    for dev_stat in stats:
        device_id = dev_stat.get("device")
        ports = dev_stat.get("ports", [])
        total_rx = sum(p.get("bytesReceived", 0) for p in ports)
        total_tx = sum(p.get("bytesSent", 0) for p in ports)
        total_rx_pkts = sum(p.get("packetsReceived", 0) for p in ports)
        total_tx_pkts = sum(p.get("packetsSent", 0) for p in ports)
        live_ports = sum(1 for p in ports if p.get("isEnabled", False))

        info = dev_map.get(device_id, {})
        metrics.append({
            "device_id": device_id,
            "type": info.get("type", "SWITCH"),
            "available": info.get("available", True),
            "manufacturer": info.get("manufacturer", ""),
            "sw_version": info.get("sw_version", ""),
            "total_ports": len(ports),
            "live_ports": live_ports,
            "total_rx_bytes": total_rx,
            "total_tx_bytes": total_tx,
            "total_rx_packets": total_rx_pkts,
            "total_tx_packets": total_tx_pkts,
            "total_bytes": total_rx + total_tx,
            "ports": [
                {
                    "port": str(p.get("port")),
                    "rx_bytes": p.get("bytesReceived", 0),
                    "tx_bytes": p.get("bytesSent", 0),
                    "rx_packets": p.get("packetsReceived", 0),
                    "tx_packets": p.get("packetsSent", 0),
                    "rx_dropped": p.get("packetsRxDropped", 0),
                    "tx_dropped": p.get("packetsTxDropped", 0),
                    "duration_sec": p.get("durationSec", 0),
                }
                for p in ports
            ],
        })

    return {
        "source": "onos",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "metrics": sorted(metrics, key=lambda m: m["total_bytes"], reverse=True),
    }


@router.get("/performance")
async def get_network_performance(_: CurrentUser):
    """Network-wide performance summary from ONOS port statistics."""
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

    total_rx = 0
    total_tx = 0
    total_rx_pkts = 0
    total_tx_pkts = 0
    total_drops = 0
    total_errors = 0
    port_count = 0

    for dev_stat in stats:
        for port in dev_stat.get("ports", []):
            total_rx += port.get("bytesReceived", 0)
            total_tx += port.get("bytesSent", 0)
            total_rx_pkts += port.get("packetsReceived", 0)
            total_tx_pkts += port.get("packetsSent", 0)
            total_drops += port.get("packetsRxDropped", 0) + port.get("packetsTxDropped", 0)
            total_errors += port.get("packetsRxErrors", 0) + port.get("packetsTxErrors", 0)
            port_count += 1

    avg_utilization = min(100, round(((total_rx + total_tx) / max(port_count * 1e9, 1)) * 100))

    return {
        "source": "onos",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "summary": {
            "total_rx_bytes": total_rx,
            "total_tx_bytes": total_tx,
            "total_bytes": total_rx + total_tx,
            "total_rx_packets": total_rx_pkts,
            "total_tx_packets": total_tx_pkts,
            "total_drops": total_drops,
            "total_errors": total_errors,
            "port_count": port_count,
            "device_count": len(stats),
        },
        "throughput": {
            "rx_bytes_per_sec": round(total_rx / 15, 2),
            "tx_bytes_per_sec": round(total_tx / 15, 2),
        },
        "utilization": {
            "average": avg_utilization,
        },
        "health": {
            "score": max(0, 100 - (total_drops * 2) - (total_errors * 5)),
            "drops_pct": round(total_drops / max(total_rx_pkts + total_tx_pkts, 1) * 100, 3),
            "errors_pct": round(total_errors / max(total_rx_pkts + total_tx_pkts, 1) * 100, 3),
        },
    }


@router.get("/heatmap")
async def get_network_heatmap(_: CurrentUser):
    """Top links by throughput for heatmap visualization."""
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

    links = []
    for dev_stat in stats:
        device_id = dev_stat.get("device", "")
        for port in dev_stat.get("ports", []):
            rx = port.get("bytesReceived", 0)
            tx = port.get("bytesSent", 0)
            throughput = rx + tx
            duration = max(port.get("durationSec", 1), 1)
            links.append({
                "device_id": device_id,
                "device_short": device_id[-4:] if device_id else "????",
                "port": str(port.get("port")),
                "id": f"{device_id}:{port.get('port')}",
                "label": f"{device_id[-4:]}:port-{port.get('port')}",
                "rx_bytes": rx,
                "tx_bytes": tx,
                "throughput": throughput,
                "throughput_bps": round(throughput / duration, 2),
            })

    top_links = sorted(links, key=lambda x: x["throughput"], reverse=True)[:15]
    max_throughput = top_links[0]["throughput"] if top_links else 1

    return {
        "source": "onos",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "topLinks": [
            {
                **link,
                "utilization": round(link["throughput"] / max_throughput * 100),
            }
            for link in top_links
        ],
        "totalLinks": len(links),
    }


@router.get("/cluster")
async def get_cluster_health(_: CurrentUser):
    """ONOS cluster nodes and health status."""
    async with httpx.AsyncClient(timeout=10) as client:
        try:
            resp = await client.get(
                f"{settings.ONOS_URL}/onos/v1/cluster",
                auth=_auth(),
            )
            resp.raise_for_status()
            data = resp.json()
        except httpx.HTTPError as e:
            raise HTTPException(status_code=502, detail=f"ONOS error: {e}")

    nodes = data.get("nodes", [])
    online = sum(1 for n in nodes if n.get("status") == "ACTIVE")

    return {
        "source": "onos",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "cluster": {
            "totalNodes": len(nodes),
            "onlineNodes": online,
            "offlineNodes": len(nodes) - online,
            "masterNode": data.get("onos"),
            "nodes": [
                {
                    "id": n.get("id"),
                    "ip": n.get("ip"),
                    "status": n.get("status"),
                    "lastUpdated": n.get("lastUpdated"),
                }
                for n in nodes
            ],
        },
    }


@router.get("/intents")
async def get_intents(_: CurrentUser):
    """Network intents summary from ONOS."""
    async with httpx.AsyncClient(timeout=10) as client:
        try:
            resp = await client.get(
                f"{settings.ONOS_URL}/onos/v1/intents",
                auth=_auth(),
            )
            resp.raise_for_status()
            data = resp.json()
        except httpx.HTTPError as e:
            raise HTTPException(status_code=502, detail=f"ONOS error: {e}")

    intents = data.get("intents", [])
    installed = sum(1 for i in intents if i.get("state") == "INSTALLED")
    failed = sum(1 for i in intents if i.get("state") == "FAILED")

    return {
        "source": "onos",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "summary": {
            "total": len(intents),
            "installed": installed,
            "failed": failed,
            "other": len(intents) - installed - failed,
        },
        "intents": [
            {
                "id": i.get("id"),
                "type": i.get("type", "point-to-point"),
                "state": i.get("state"),
                "appId": i.get("appId"),
                "key": i.get("key"),
            }
            for i in intents[:50]
        ],
    }
