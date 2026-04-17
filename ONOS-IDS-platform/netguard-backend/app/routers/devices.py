"""
GET  /devices                                        → liste devices           [tous]
POST /devices/sync                                   → sync depuis ONOS        [admin/manager]
GET  /devices/by-onos/{onos_id}/ports                → ports ONOS du device    [tous]
POST /devices/by-onos/{onos_id}/ports/{port}/state   → enable/disable port     [admin/manager]
GET  /devices/{id}                                   → détail device           [tous]
PUT  /devices/{id}                                   → modifie metadata        [admin/manager]
"""

from typing import Annotated
from uuid import UUID

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.deps import CurrentUser, RequireAdminOrManager
from app.models import Device, DeviceStatus, User
from app.schemas import DeviceResponse, DeviceUpdate

settings = get_settings()
router = APIRouter(prefix="/devices", tags=["devices"])


@router.get("", response_model=list[DeviceResponse])
async def list_devices(
    _: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    skip: int = 0,
    limit: int = 100,
):
    """Retourne uniquement les devices actuellement connectés dans ONOS."""
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                f"{settings.ONOS_URL}/onos/v1/devices",
                auth=(settings.ONOS_USER, settings.ONOS_PASSWORD),
            )
            resp.raise_for_status()
            onos_devices = resp.json().get("devices", [])
            
            # IDs des devices actuellement dans ONOS
            live_onos_ids = {od.get("id") for od in onos_devices if od.get("available")}
    except httpx.HTTPError:
        # Si ONOS inaccessible → retourne ce qu'on a en DB
        result = await db.execute(select(Device).offset(skip).limit(limit))
        return result.scalars().all()

    # Retourne uniquement les devices DB qui sont live dans ONOS
    result = await db.execute(select(Device).offset(skip).limit(limit))
    all_devices = result.scalars().all()
    
    return [d for d in all_devices if d.onos_id in live_onos_ids]


@router.post("/sync", status_code=200)
async def sync_devices(
    _: Annotated[User, RequireAdminOrManager],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Sync devices depuis ONOS REST API."""
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                f"{settings.ONOS_URL}/onos/v1/devices",
                auth=(settings.ONOS_USER, settings.ONOS_PASSWORD),
            )
            resp.raise_for_status()
            onos_devices = resp.json().get("devices", [])
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"ONOS inaccessible: {e}")

    synced = 0
    for od in onos_devices:
        onos_id = od.get("id")
        result = await db.execute(
            select(Device).where(Device.onos_id == onos_id)
        )
        device = result.scalar_one_or_none()
        new_status = DeviceStatus.active if od.get("available") else DeviceStatus.inactive
        annotations = od.get("annotations", {})

        # Extrait l'IP depuis les annotations ONOS
        ip_from_annotations = annotations.get("ipaddress") or annotations.get("ipAddress") or annotations.get("managementAddress")

        # Nom lisible : préfère l'annotation name, sinon construit depuis l'IP
        raw_name = annotations.get("name", onos_id)
        if raw_name == onos_id and ip_from_annotations:
            raw_name = f"Router-{ip_from_annotations}"

        if device is None:
            device = Device(
                onos_id=onos_id,
                name=raw_name,
                type=od.get("type"),
                ip_address=ip_from_annotations,
                manufacturer=od.get("mfr"),
                sw_version=od.get("sw"),
                status=new_status,
                ports=od.get("ports", []),
            )
            db.add(device)
        else:
            device.status = new_status
            device.name = raw_name
            device.sw_version = od.get("sw", device.sw_version)
            if ip_from_annotations:
                device.ip_address = ip_from_annotations

        synced += 1

    await db.commit()
    return {"synced": synced, "message": f"{synced} devices synchronisés"}


@router.get("/by-onos/{onos_id:path}/ports")
async def get_device_ports(
    onos_id: str,
    _: CurrentUser,
):
    """Retourne les ports d'un device ONOS (format `of:XXXXXXXXXXXXXXXX`)."""
    async with httpx.AsyncClient(timeout=10) as client:
        try:
            resp = await client.get(
                f"{settings.ONOS_URL}/onos/v1/devices/{onos_id}/ports",
                auth=(settings.ONOS_USER, settings.ONOS_PASSWORD),
            )
            if resp.status_code == 404:
                raise HTTPException(status_code=404, detail="Device not found in ONOS")
            resp.raise_for_status()
            data = resp.json()
        except httpx.HTTPError as e:
            raise HTTPException(status_code=502, detail=f"ONOS error: {e}")

    ports = []
    for p in data.get("ports", []):
        annotations = p.get("annotations", {}) or {}
        ports.append({
            "port": str(p.get("port", "")),
            "isEnabled": bool(p.get("isEnabled", False)),
            "type": p.get("type"),
            "portSpeed": p.get("portSpeed"),
            "name": annotations.get("portName") or annotations.get("name"),
        })
    return {"device": onos_id, "total": len(ports), "ports": ports}


class PortStateUpdate(BaseModel):
    enabled: bool


@router.post("/by-onos/{onos_id:path}/ports/{port}/state")
async def set_device_port_state(
    onos_id: str,
    port: str,
    body: PortStateUpdate,
    _: Annotated[User, RequireAdminOrManager],
):
    """Enable/disable a port's admin state on the ONOS-managed device.

    Uses the ONOS REST API `POST /onos/v1/devices/{id}/portstate/{port}` with
    body `{"enabled": true|false}`.
    """
    async with httpx.AsyncClient(timeout=10) as client:
        try:
            resp = await client.post(
                f"{settings.ONOS_URL}/onos/v1/devices/{onos_id}/portstate/{port}",
                auth=(settings.ONOS_USER, settings.ONOS_PASSWORD),
                json={"enabled": body.enabled},
            )
            if resp.status_code == 404:
                raise HTTPException(status_code=404, detail="Device or port not found")
            resp.raise_for_status()
        except httpx.HTTPError as e:
            raise HTTPException(status_code=502, detail=f"ONOS error: {e}")

    return {
        "device": onos_id,
        "port": port,
        "enabled": body.enabled,
        "message": f"Port {port} {'enabled' if body.enabled else 'disabled'}",
    }


@router.get("/{device_id}", response_model=DeviceResponse)
async def get_device(
    device_id: UUID,
    _: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(select(Device).where(Device.id == device_id))
    device = result.scalar_one_or_none()
    if not device:
        raise HTTPException(status_code=404, detail="Device non trouvé")
    return device


@router.put("/{device_id}", response_model=DeviceResponse)
async def update_device(
    device_id: UUID,
    body: DeviceUpdate,
    _: Annotated[User, RequireAdminOrManager],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(select(Device).where(Device.id == device_id))
    device = result.scalar_one_or_none()
    if not device:
        raise HTTPException(status_code=404, detail="Device non trouvé")

    if body.name is not None:
        device.name = body.name
    if body.location is not None:
        device.location = body.location

    db.add(device)
    await db.commit()
    await db.refresh(device)
    return device