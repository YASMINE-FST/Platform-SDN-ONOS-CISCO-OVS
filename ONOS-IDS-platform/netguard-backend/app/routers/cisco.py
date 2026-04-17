"""
Router for Cisco CSR1000V integration via CsrManager ONOS app
Proxies requests to ONOS CsrManager endpoints
"""

from fastapi import APIRouter, HTTPException, WebSocket
from fastapi.responses import JSONResponse
import httpx
import json
from typing import Optional, List
import logging

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/cisco",
    tags=["cisco"],
    responses={404: {"description": "Not found"}}
)

# Configuration
ONOS_URL = "http://host.docker.internal:8181"  # Pour Docker: accès à l'hôte
ONOS_AUTH = ("onos", "rocks")
CSRMANAGER_BASE = f"{ONOS_URL}/csr/v1"

# Helper function to call CsrManager
async def call_csrmanager(endpoint: str, method: str = "GET", data: dict = None):
    """Call CsrManager endpoint via ONOS"""
    url = f"{CSRMANAGER_BASE}{endpoint}"

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            if method == "GET":
                response = await client.get(url, auth=ONOS_AUTH)
            elif method == "POST":
                response = await client.post(url, json=data, auth=ONOS_AUTH)
            elif method == "PATCH":
                response = await client.patch(url, json=data, auth=ONOS_AUTH)
            elif method == "DELETE":
                response = await client.delete(url, auth=ONOS_AUTH)

            if response.status_code >= 400:
                logger.error(f"CsrManager error: {response.status_code} - {response.text}")
                raise HTTPException(status_code=response.status_code, detail=response.text)

            return response.json()
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="CsrManager timeout")
    except Exception as e:
        logger.error(f"CsrManager call failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# MONITORING ENDPOINTS (GET)
# ============================================================================

@router.get("/devices", summary="List Cisco devices managed by ONOS")
async def get_devices():
    """Get all Cisco devices registered in ONOS"""
    return await call_csrmanager("/devices")


@router.get("/health", summary="Check device health")
async def get_health():
    """Check if device is healthy"""
    return await call_csrmanager("/health")


@router.get("/cpu", summary="Get CPU utilization")
async def get_cpu():
    """Get CPU utilization (5s, 1m, 5m averages)"""
    return await call_csrmanager("/cpu")


@router.get("/cpu/history", summary="Get CPU history")
async def get_cpu_history():
    """Get CPU utilization history (last 120 points)"""
    return await call_csrmanager("/cpu/history")


@router.get("/memory", summary="Get memory pools")
async def get_memory():
    """Get memory pool information"""
    return await call_csrmanager("/memory")


@router.get("/version", summary="Get device version info")
async def get_version():
    """Get device hostname and IOS-XE version"""
    return await call_csrmanager("/version")


@router.get("/interfaces", summary="Get interface configuration")
async def get_interfaces():
    """Get interface configuration"""
    return await call_csrmanager("/interfaces")


@router.get("/interfaces/oper", summary="Get interface operational state")
async def get_interfaces_oper():
    """Get interface operational state and statistics"""
    return await call_csrmanager("/interfaces/oper")


@router.get("/routes", summary="Get routing table")
async def get_routes():
    """Get routing information base (RIB)"""
    return await call_csrmanager("/routes")


@router.get("/routes/static", summary="Get static routes")
async def get_static_routes():
    """Get configured static routes"""
    return await call_csrmanager("/routes/static")


@router.get("/arp", summary="Get ARP table")
async def get_arp():
    """Get Address Resolution Protocol table"""
    return await call_csrmanager("/arp")


@router.get("/ospf", summary="Get OSPF status")
async def get_ospf():
    """Get Open Shortest Path First operational status"""
    return await call_csrmanager("/ospf")


@router.get("/bgp", summary="Get BGP routes")
async def get_bgp():
    """Get Border Gateway Protocol routes"""
    return await call_csrmanager("/bgp")


@router.get("/cdp", summary="Get CDP neighbors")
async def get_cdp():
    """Get Cisco Discovery Protocol neighbors"""
    return await call_csrmanager("/cdp")


@router.get("/ntp", summary="Get NTP status")
async def get_ntp():
    """Get Network Time Protocol status"""
    return await call_csrmanager("/ntp")


@router.get("/dhcp", summary="Get DHCP pools")
async def get_dhcp():
    """Get DHCP pool information"""
    return await call_csrmanager("/dhcp")


@router.get("/processes", summary="Get top processes")
async def get_processes():
    """Get top processes by memory usage"""
    return await call_csrmanager("/processes")


@router.get("/environment", summary="Get environment sensors")
async def get_environment():
    """Get environment sensors (temperature, fans, etc.)"""
    return await call_csrmanager("/environment")


@router.get("/logs", summary="Get syslog messages")
async def get_logs(limit: int = 20):
    """Get syslog messages (limited)"""
    return await call_csrmanager(f"/logs?limit={limit}")


# ============================================================================
# CONFIGURATION ENDPOINTS (PATCH/POST/DELETE)
# ============================================================================

@router.patch("/config/hostname", summary="Set device hostname")
async def set_hostname(hostname: str):
    """Configure device hostname"""
    return await call_csrmanager("/config/hostname", "PATCH", {"hostname": hostname})


@router.patch("/config/interface", summary="Configure interface")
async def configure_interface(
    name: str,
    description: Optional[str] = None,
    enabled: Optional[bool] = None,
    ip: Optional[str] = None,
    mask: Optional[str] = None
):
    """Configure interface settings"""
    data = {"name": name}
    if description:
        data["description"] = description
    if enabled is not None:
        data["enabled"] = enabled
    if ip:
        data["ip"] = ip
    if mask:
        data["mask"] = mask

    return await call_csrmanager("/config/interface", "PATCH", data)


@router.post("/config/routes/static", summary="Add static route")
async def add_static_route(prefix: str, mask: str, next_hop: str, distance: Optional[int] = None):
    """Add a static route"""
    data = {
        "prefix": prefix,
        "mask": mask,
        "next_hop": next_hop
    }
    if distance:
        data["distance"] = distance

    return await call_csrmanager("/config/routes/static", "POST", data)


@router.delete("/config/routes/static", summary="Delete static route")
async def delete_static_route(prefix: str, mask: str, next_hop: str):
    """Delete a static route"""
    data = {
        "prefix": prefix,
        "mask": mask,
        "next_hop": next_hop
    }
    return await call_csrmanager("/config/routes/static", "DELETE", data)


@router.patch("/config/ntp", summary="Configure NTP server")
async def configure_ntp(server: str):
    """Configure NTP server"""
    return await call_csrmanager("/config/ntp", "PATCH", {"server": server})


# ============================================================================
# HEALTH CHECK
# ============================================================================

@router.get("/health/check", summary="Check CsrManager connectivity")
async def health_check():
    """Check if CsrManager is reachable"""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                f"{ONOS_URL}/onos/v1/applications/org.onos.csrmanager",
                auth=ONOS_AUTH
            )
            if response.status_code == 200:
                app_data = response.json()
                return {
                    "status": "healthy",
                    "csrmanager_app": app_data.get("name"),
                    "state": app_data.get("state"),
                    "message": "CsrManager app is active"
                }
            else:
                return {
                    "status": "unhealthy",
                    "message": f"CsrManager app status: {response.status_code}"
                }
    except Exception as e:
        return {
            "status": "error",
            "message": str(e)
        }
