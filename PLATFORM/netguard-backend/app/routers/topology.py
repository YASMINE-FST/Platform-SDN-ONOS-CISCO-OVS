import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.deps import CurrentUser, RequireAdminOrManager
from app.models import Device, User
from typing import Annotated
settings = get_settings()
router = APIRouter(prefix="/topology", tags=["topology"])


@router.get("")
async def get_topology(
    _: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            devices_resp = await client.get(
                f"{settings.ONOS_URL}/onos/v1/devices",
                auth=(settings.ONOS_USER, settings.ONOS_PASSWORD),
            )
            links_resp = await client.get(
                f"{settings.ONOS_URL}/onos/v1/links",
                auth=(settings.ONOS_USER, settings.ONOS_PASSWORD),
            )
            hosts_resp = await client.get(
                f"{settings.ONOS_URL}/onos/v1/hosts",
                auth=(settings.ONOS_USER, settings.ONOS_PASSWORD),
            )
            devices_resp.raise_for_status()
            links_resp.raise_for_status()

    except httpx.HTTPError:
        result = await db.execute(select(Device))
        devices = result.scalars().all()
        return {
            "nodes": [
                {
                    "id": d.onos_id or str(d.id),
                    "label": d.name,
                    "type": d.type or "SWITCH",
                    "status": d.status,
                    "manufacturer": d.manufacturer,
                    "sw_version": d.sw_version,
                }
                for d in devices
            ],
            "edges": [],
            "hosts": [],
            "source": "db_fallback",
        }

    onos_devices = devices_resp.json().get("devices", [])
    onos_links = links_resp.json().get("links", [])
    onos_hosts = hosts_resp.json().get("hosts", []) if hosts_resp.status_code == 200 else []

    nodes = [
        {
            "id": d["id"],
            "label": d.get("annotations", {}).get("name", d["id"]),
            "type": d.get("type", "SWITCH"),
            "status": "active" if d.get("available") else "inactive",
            "manufacturer": d.get("mfr"),
            "hw_version": d.get("hw"),
            "sw_version": d.get("sw"),
            "serial": d.get("serial"),
            "ports_count": len(d.get("ports", [])),
        }
        for d in onos_devices
    ]

    edges = [
        {
            "id": f"{lnk['src']['device']}-{lnk['src']['port']}-{lnk['dst']['device']}-{lnk['dst']['port']}",
            "source": lnk["src"]["device"],
            "source_port": lnk["src"]["port"],
            "target": lnk["dst"]["device"],
            "target_port": lnk["dst"]["port"],
            "type": lnk.get("type", "DIRECT"),
            "state": lnk.get("state", "ACTIVE"),
        }
        for lnk in onos_links
    ]

    hosts = [
        {
            "id": h.get("id"),
            "mac": h.get("mac"),
            "ip": h.get("ipAddresses", [None])[0],
            "location_device": (
                h.get("locations", [{}])[0].get("elementId")
                if h.get("locations")
                else h.get("location", {}).get("elementId")
            ),
            "location_port": (
                h.get("locations", [{}])[0].get("port")
                if h.get("locations")
                else h.get("location", {}).get("port")
            ),
            "vlan": h.get("vlan"),
        }
        for h in onos_hosts
    ]

    return {
        "nodes": nodes,
        "edges": edges,
        "hosts": hosts,
        "source": "onos_live",
    }


@router.get("/hosts")
async def get_hosts(_: CurrentUser):
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                f"{settings.ONOS_URL}/onos/v1/hosts",
                auth=(settings.ONOS_USER, settings.ONOS_PASSWORD),
            )
            resp.raise_for_status()
            return resp.json().get("hosts", [])
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"ONOS inaccessible: {e}")

@router.get("/stats/ports")
async def get_port_stats(_: CurrentUser):
    """Statistiques des ports (telemetry) depuis ONOS."""
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                f"{settings.ONOS_URL}/onos/v1/statistics/ports",
                auth=(settings.ONOS_USER, settings.ONOS_PASSWORD),
            )
            resp.raise_for_status()
            stats = resp.json().get("statistics", [])

            # Enrichit avec utilization calculée
            result = []
            for device_stats in stats:
                device_id = device_stats.get("device")
                ports = []
                for p in device_stats.get("ports", []):
                    total_bytes = p.get("bytesReceived", 0) + p.get("bytesSent", 0)
                    duration = max(p.get("durationSec", 1), 1)
                    throughput = total_bytes / duration  # bytes/sec
                    # Utilization simulée (10Gbps link)
                    link_capacity = 10_000_000_000 / 8  # 10Gbps en bytes/sec
                    utilization = min(round((throughput / link_capacity) * 100, 2), 100)

                    ports.append({
                        "port": str(p.get("port")),
                        "packetsReceived": p.get("packetsReceived", 0),
                        "packetsSent": p.get("packetsSent", 0),
                        "bytesReceived": p.get("bytesReceived", 0),
                        "bytesSent": p.get("bytesSent", 0),
                        "throughput_bps": round(throughput, 2),
                        "utilization": utilization,
                        "live": True,
                    })
                result.append({
                    "device": device_id,
                    "ports": ports,
                })
            return {"statistics": result}
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"ONOS inaccessible: {e}")


@router.get("/paths/{src}/{dst}")
async def get_path(
    src: str,
    dst: str,
    _: CurrentUser,
):
    """Calcule le chemin ONOS entre deux devices."""
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                f"{settings.ONOS_URL}/onos/v1/paths/{src}/{dst}",
                auth=(settings.ONOS_USER, settings.ONOS_PASSWORD),
            )
            resp.raise_for_status()
            data = resp.json()
            paths = data.get("paths", [])

            if not paths:
                return {"paths": [], "found": False}

            best = paths[0]
            links = best.get("links", [])

            # Extrait les nodes du chemin
            path_nodes = []
            for link in links:
                src_dev = link["src"]["device"]
                if src_dev not in path_nodes:
                    path_nodes.append(src_dev)
            if links:
                path_nodes.append(links[-1]["dst"]["device"])

            # Edge refs
            edge_refs = [
                f"{lnk['src']['device']}-{lnk['src']['port']}-{lnk['dst']['device']}-{lnk['dst']['port']}"
                for lnk in links
            ]

            return {
                "found": True,
                "cost": best.get("cost", 0),
                "paths": [{
                    "nodes": path_nodes,
                    "edge_refs": edge_refs,
                    "links": links,
                    "summary": f"{len(links)} hop{'s' if len(links) > 1 else ''}",
                }],
            }
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"ONOS inaccessible: {e}")


@router.get("/enriched")
async def get_enriched_topology(_: CurrentUser):
    """Single-call topology + ports stats + flow counts per device.

    Returns: nodes, edges, hosts, port_stats, flows_per_device, counters.
    """
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            auth = (settings.ONOS_USER, settings.ONOS_PASSWORD)
            devices_task = client.get(f"{settings.ONOS_URL}/onos/v1/devices", auth=auth)
            links_task = client.get(f"{settings.ONOS_URL}/onos/v1/links", auth=auth)
            hosts_task = client.get(f"{settings.ONOS_URL}/onos/v1/hosts", auth=auth)
            flows_task = client.get(f"{settings.ONOS_URL}/onos/v1/flows", auth=auth)
            stats_task = client.get(f"{settings.ONOS_URL}/onos/v1/statistics/ports", auth=auth)
            topo_task = client.get(f"{settings.ONOS_URL}/onos/v1/topology", auth=auth)

            import asyncio as _aio
            d, l, h, f, s, t = await _aio.gather(
                devices_task, links_task, hosts_task, flows_task, stats_task, topo_task,
                return_exceptions=True,
            )

        def _json(resp, key, default):
            if isinstance(resp, Exception):
                return default
            try:
                return resp.json().get(key, default)
            except Exception:
                return default

        onos_devices = _json(d, "devices", [])
        onos_links = _json(l, "links", [])
        onos_hosts = _json(h, "hosts", [])
        onos_flows = _json(f, "flows", [])
        onos_stats = _json(s, "statistics", [])
        topo = t.json() if not isinstance(t, Exception) else {}

        # Flow counts per device
        flows_by_device: dict[str, dict[str, int]] = {}
        for fl in onos_flows:
            dev = fl.get("deviceId", "")
            entry = flows_by_device.setdefault(dev, {"total": 0, "added": 0, "pending": 0})
            entry["total"] += 1
            state = fl.get("state", "")
            if state == "ADDED":
                entry["added"] += 1
            elif state == "PENDING_ADD":
                entry["pending"] += 1

        # Port stats + utilization
        LINK_CAPACITY = 10_000_000_000 / 8  # 10 Gbps in bytes/sec
        port_stats: dict[str, list[dict]] = {}
        link_utilization: dict[str, dict[str, float]] = {}
        for s_dev in onos_stats:
            dev_id = s_dev.get("device", "")
            ports = []
            for p in s_dev.get("ports", []):
                duration = max(p.get("durationSec", 1), 1)
                total_bytes = p.get("bytesReceived", 0) + p.get("bytesSent", 0)
                throughput = total_bytes / duration
                util = min(round((throughput / LINK_CAPACITY) * 100, 2), 100)
                port_info = {
                    "port": str(p.get("port")),
                    "bytesReceived": p.get("bytesReceived", 0),
                    "bytesSent": p.get("bytesSent", 0),
                    "packetsReceived": p.get("packetsReceived", 0),
                    "packetsSent": p.get("packetsSent", 0),
                    "packetsRxDropped": p.get("packetsRxDropped", 0),
                    "packetsTxDropped": p.get("packetsTxDropped", 0),
                    "packetsRxErrors": p.get("packetsRxErrors", 0),
                    "packetsTxErrors": p.get("packetsTxErrors", 0),
                    "throughput_bps": round(throughput, 2),
                    "utilization": util,
                    "durationSec": duration,
                    "live": True,
                }
                ports.append(port_info)
                link_utilization[f"{dev_id}|{p.get('port')}"] = {
                    "utilization": util,
                    "throughput_bps": throughput,
                }
            port_stats[dev_id] = ports

        # Nodes
        nodes = []
        for d_ in onos_devices:
            dev_id = d_["id"]
            fc = flows_by_device.get(dev_id, {"total": 0, "added": 0, "pending": 0})
            nodes.append({
                "id": dev_id,
                "label": d_.get("annotations", {}).get("name", dev_id),
                "type": d_.get("type", "SWITCH"),
                "status": "active" if d_.get("available") else "inactive",
                "manufacturer": d_.get("mfr"),
                "hw_version": d_.get("hw"),
                "sw_version": d_.get("sw"),
                "serial": d_.get("serial"),
                "chassis_id": d_.get("chassisId"),
                "ports_count": len(port_stats.get(dev_id, [])),
                "flows_count": fc["total"],
                "flows_added": fc["added"],
                "flows_pending": fc["pending"],
            })

        # Edges (with utilization enrichment)
        edges = []
        for lnk in onos_links:
            src_key = f"{lnk['src']['device']}|{lnk['src']['port']}"
            dst_key = f"{lnk['dst']['device']}|{lnk['dst']['port']}"
            src_util = link_utilization.get(src_key, {}).get("utilization", 0)
            dst_util = link_utilization.get(dst_key, {}).get("utilization", 0)
            util = max(src_util, dst_util)
            throughput = max(
                link_utilization.get(src_key, {}).get("throughput_bps", 0),
                link_utilization.get(dst_key, {}).get("throughput_bps", 0),
            )

            edges.append({
                "id": f"{lnk['src']['device']}-{lnk['src']['port']}-{lnk['dst']['device']}-{lnk['dst']['port']}",
                "source": lnk["src"]["device"],
                "source_port": str(lnk["src"]["port"]),
                "target": lnk["dst"]["device"],
                "target_port": str(lnk["dst"]["port"]),
                "type": lnk.get("type", "DIRECT"),
                "state": lnk.get("state", "ACTIVE"),
                "utilization": util,
                "throughput_bps": round(throughput, 2),
                "load_state": (
                    "hot" if util >= 70 else
                    "warm" if util >= 40 else
                    "nominal" if util > 0 else "unknown"
                ),
            })

        # Hosts
        hosts = []
        for hh in onos_hosts:
            locs = hh.get("locations") or [hh.get("location", {})]
            loc = locs[0] if locs else {}
            hosts.append({
                "id": hh.get("id"),
                "mac": hh.get("mac"),
                "ip": (hh.get("ipAddresses") or [None])[0],
                "ipAddresses": hh.get("ipAddresses", []),
                "location_device": loc.get("elementId"),
                "location_port": loc.get("port"),
                "vlan": hh.get("vlan"),
            })

        return {
            "nodes": nodes,
            "edges": edges,
            "hosts": hosts,
            "port_stats": port_stats,
            "counters": {
                "devices": len(nodes),
                "links": len(edges),
                "hosts": len(hosts),
                "flows_total": sum(v["total"] for v in flows_by_device.values()),
                "flows_pending": sum(v["pending"] for v in flows_by_device.values()),
                "clusters": topo.get("clusterCount", 0),
                "hot_links": sum(1 for e in edges if e["utilization"] >= 70),
            },
            "source": "onos_live",
        }
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"ONOS error: {e}")


@router.delete("/links")
async def delete_link(
    body: dict,
    _: Annotated[User, RequireAdminOrManager],
):
    """Supprime un lien dans ONOS."""
    src_device = body.get("src_device")
    src_port = body.get("src_port")
    dst_device = body.get("dst_device")
    dst_port = body.get("dst_port")

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.delete(
                f"{settings.ONOS_URL}/onos/v1/links",
                auth=(settings.ONOS_USER, settings.ONOS_PASSWORD),
                params={
                    "device": src_device,
                    "port": src_port,
                },
            )
            return {
                "message": "Link removal requested",
                "status": resp.status_code,
            }
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"ONOS inaccessible: {e}")