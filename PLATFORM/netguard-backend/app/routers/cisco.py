"""
Router for Cisco CSR1000V integration via the ONOS CsrManager app.
"""

import logging
from typing import Optional

import httpx
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from app.config import get_settings

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/cisco",
    tags=["cisco"],
    responses={404: {"description": "Not found"}},
)

settings = get_settings()
ONOS_URL = settings.ONOS_URL
ONOS_AUTH = (settings.ONOS_USER, settings.ONOS_PASSWORD)
CSRMANAGER_BASE = f"{ONOS_URL}/csr/v1"


class HostnamePayload(BaseModel):
    hostname: str


class InterfaceConfigPayload(BaseModel):
    name: str
    description: Optional[str] = None
    enabled: Optional[bool] = None
    ip: Optional[str] = None
    mask: Optional[str] = None


class StaticRoutePayload(BaseModel):
    prefix: str
    mask: str
    next_hop: str
    distance: Optional[int] = None


class NtpConfigPayload(BaseModel):
    server: Optional[str] = None
    servers: list[str] = Field(default_factory=list)


def _device_params(device: Optional[str] = None, **params):
    result = {key: value for key, value in params.items() if value is not None}
    if device:
        result["device"] = device
    return result


async def call_csrmanager(
    endpoint: str,
    *,
    method: str = "GET",
    data: Optional[dict] = None,
    params: Optional[dict] = None,
):
    """Call a CsrManager endpoint via ONOS."""
    url = f"{CSRMANAGER_BASE}{endpoint}"

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.request(
                method,
                url,
                auth=ONOS_AUTH,
                params=params,
                json=data,
            )

            if response.status_code >= 400:
                logger.error("CsrManager error: %s - %s", response.status_code, response.text)
                detail = response.text
                try:
                    error_payload = response.json()
                    if isinstance(error_payload, dict):
                        detail = (
                            error_payload.get("error")
                            or error_payload.get("message")
                            or error_payload.get("detail")
                            or detail
                        )
                except ValueError:
                    pass
                raise HTTPException(status_code=response.status_code, detail=detail)

            return response.json()
    except HTTPException:
        raise
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="CsrManager timeout")
    except Exception as e:
        logger.error("CsrManager call failed: %s", str(e))
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# MONITORING ENDPOINTS (GET)
# ============================================================================

@router.get("/devices", summary="List Cisco devices managed by ONOS")
async def get_devices():
    """Get all Cisco devices registered in ONOS"""
    return await call_csrmanager("/devices")


@router.get("/health", summary="Check device health")
async def get_health(device: Optional[str] = Query(default=None)):
    """Check if device is healthy"""
    return await call_csrmanager("/health", params=_device_params(device))


@router.get("/cpu", summary="Get CPU utilization")
async def get_cpu(device: Optional[str] = Query(default=None)):
    """Get CPU utilization (5s, 1m, 5m averages)"""
    return await call_csrmanager("/cpu", params=_device_params(device))


@router.get("/cpu/history", summary="Get CPU history")
async def get_cpu_history(device: Optional[str] = Query(default=None)):
    """Get CPU utilization history (last 120 points)"""
    return await call_csrmanager("/cpu/history", params=_device_params(device))


@router.get("/memory", summary="Get memory pools")
async def get_memory(device: Optional[str] = Query(default=None)):
    """Get memory pool information"""
    return await call_csrmanager("/memory", params=_device_params(device))


@router.get("/version", summary="Get device version info")
async def get_version(device: Optional[str] = Query(default=None)):
    """Get device hostname and IOS-XE version"""
    return await call_csrmanager("/version", params=_device_params(device))


@router.get("/interfaces", summary="Get interface configuration")
async def get_interfaces(device: Optional[str] = Query(default=None)):
    """Get interface configuration"""
    return await call_csrmanager("/interfaces", params=_device_params(device))


@router.get("/interfaces/oper", summary="Get interface operational state")
async def get_interfaces_oper(device: Optional[str] = Query(default=None)):
    """Get interface operational state and statistics"""
    return await call_csrmanager("/interfaces/oper", params=_device_params(device))


@router.get("/routes", summary="Get routing table")
async def get_routes(device: Optional[str] = Query(default=None)):
    """Get routing information base (RIB)"""
    return await call_csrmanager("/routes", params=_device_params(device))


@router.get("/routes/static", summary="Get static routes")
async def get_static_routes(device: Optional[str] = Query(default=None)):
    """Get configured static routes"""
    return await call_csrmanager("/routes/static", params=_device_params(device))


@router.get("/arp", summary="Get ARP table")
async def get_arp(device: Optional[str] = Query(default=None)):
    """Get Address Resolution Protocol table"""
    return await call_csrmanager("/arp", params=_device_params(device))


@router.get("/ospf", summary="Get OSPF status")
async def get_ospf(device: Optional[str] = Query(default=None)):
    """Get Open Shortest Path First operational status"""
    return await call_csrmanager("/ospf", params=_device_params(device))


@router.get("/bgp", summary="Get BGP routes")
async def get_bgp(device: Optional[str] = Query(default=None)):
    """Get Border Gateway Protocol routes"""
    return await call_csrmanager("/bgp", params=_device_params(device))


@router.get("/cdp", summary="Get CDP neighbors")
async def get_cdp(device: Optional[str] = Query(default=None)):
    """Get Cisco Discovery Protocol neighbors"""
    return await call_csrmanager("/cdp", params=_device_params(device))


@router.get("/ntp", summary="Get NTP status")
async def get_ntp(device: Optional[str] = Query(default=None)):
    """Get Network Time Protocol status"""
    return await call_csrmanager("/ntp", params=_device_params(device))


@router.get("/dhcp", summary="Get DHCP pools")
async def get_dhcp(device: Optional[str] = Query(default=None)):
    """Get DHCP pool information"""
    return await call_csrmanager("/dhcp", params=_device_params(device))


@router.get("/processes", summary="Get top processes")
async def get_processes(device: Optional[str] = Query(default=None)):
    """Get top processes by memory usage"""
    return await call_csrmanager("/processes", params=_device_params(device))


@router.get("/environment", summary="Get environment sensors")
async def get_environment(device: Optional[str] = Query(default=None)):
    """Get environment sensors (temperature, fans, etc.)"""
    return await call_csrmanager("/environment", params=_device_params(device))


@router.get("/logs", summary="Get syslog messages")
async def get_logs(limit: int = 20, device: Optional[str] = Query(default=None)):
    """Get syslog messages (limited)"""
    return await call_csrmanager("/logs", params=_device_params(device, limit=limit))


# ============================================================================
# CONFIGURATION ENDPOINTS (PATCH/POST/DELETE)
# ============================================================================

@router.patch("/config/hostname", summary="Set device hostname")
async def set_hostname(
    payload: HostnamePayload,
    device: Optional[str] = Query(default=None),
):
    """Configure device hostname"""
    return await call_csrmanager(
        "/config/hostname",
        method="PATCH",
        data=payload.model_dump(),
        params=_device_params(device),
    )


@router.patch("/config/interface", summary="Configure interface")
async def configure_interface(
    payload: InterfaceConfigPayload,
    device: Optional[str] = Query(default=None),
):
    """Configure interface settings"""
    data = payload.model_dump(exclude_none=True)
    return await call_csrmanager(
        "/config/interface",
        method="PATCH",
        data=data,
        params=_device_params(device),
    )


@router.post("/config/routes/static", summary="Add static route")
async def add_static_route(
    payload: StaticRoutePayload,
    device: Optional[str] = Query(default=None),
):
    """Add a static route"""
    data = payload.model_dump(exclude_none=True)
    return await call_csrmanager(
        "/config/routes/static",
        method="POST",
        data=data,
        params=_device_params(device),
    )


@router.delete("/config/routes/static", summary="Delete static route")
async def delete_static_route(
    payload: StaticRoutePayload,
    device: Optional[str] = Query(default=None),
):
    """Delete a static route"""
    data = payload.model_dump(exclude={"distance"})
    return await call_csrmanager(
        "/config/routes/static",
        method="DELETE",
        data=data,
        params=_device_params(device),
    )


@router.patch("/config/ntp", summary="Configure NTP server")
async def configure_ntp(
    payload: NtpConfigPayload,
    device: Optional[str] = Query(default=None),
):
    """Configure NTP server"""
    server = payload.server or next((server for server in payload.servers if server.strip()), None)
    if not server:
        raise HTTPException(status_code=400, detail="server is required")

    return await call_csrmanager(
        "/config/ntp",
        method="PATCH",
        data={"server": server},
        params=_device_params(device),
    )


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
                auth=ONOS_AUTH,
            )
            if response.status_code == 200:
                app_data = response.json()
                return {
                    "status": "healthy",
                    "csrmanager_app": app_data.get("name"),
                    "state": app_data.get("state"),
                    "message": "CsrManager app is active",
                }
            else:
                return {
                    "status": "unhealthy",
                    "message": f"CsrManager app status: {response.status_code}",
                }
    except Exception as e:
        return {
            "status": "error",
            "message": str(e),
        }
