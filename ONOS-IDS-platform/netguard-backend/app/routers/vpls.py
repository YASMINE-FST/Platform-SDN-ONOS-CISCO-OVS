"""
VPLS (Virtual Private LAN Service) Management
GET  /vpls/app-status                        → VPLS app status          [tous]
POST /vpls/activate                          → Activate VPLS app        [admin/manager]
GET  /vpls                                   → List VPLS networks       [tous]
POST /vpls                                   → Create VPLS network      [admin/manager]
DELETE /vpls/{name}                          → Delete VPLS network      [admin/manager]
POST /vpls/{name}/interfaces                 → Add interface            [admin/manager]
DELETE /vpls/{name}/interfaces/{iface}       → Remove interface         [admin/manager]
"""

from typing import Annotated, Any

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.deps import CurrentUser, RequireAdminOrManager
from app.models import DeviceConfig, User

settings = get_settings()
router = APIRouter(prefix="/vpls", tags=["vpls"])


def _auth():
    return (settings.ONOS_USER, settings.ONOS_PASSWORD)


async def _log(
    db: AsyncSession,
    user: User,
    vpls_name: str,
    action: str,
    data: dict[str, Any],
) -> None:
    db.add(DeviceConfig(
        onos_device_id=f"vpls:{vpls_name}",
        config_type=action,
        config_data=data,
        applied_by=user.id,
    ))
    await db.commit()


class VPLSCreate(BaseModel):
    name: str
    encapsulation: str = "NONE"  # NONE, VLAN, MPLS
    interfaces: list[str] = []


class VPLSInterfaceAdd(BaseModel):
    name: str
    connect_point: str | None = None   # format of:XXXXXXXXXXXXXXXX/N
    ips: list[str] | None = None       # CIDR list
    mac: str | None = None
    vlan: str | None = None


@router.get("/app-status")
async def vpls_app_status(_: CurrentUser):
    """Check if VPLS app is installed and active in ONOS."""
    async with httpx.AsyncClient(timeout=10) as client:
        try:
            resp = await client.get(
                f"{settings.ONOS_URL}/onos/v1/applications/org.onosproject.vpls",
                auth=_auth(),
            )
            if resp.status_code == 404:
                return {
                    "appId": "org.onosproject.vpls",
                    "active": False,
                    "state": "NOT_INSTALLED",
                    "version": None,
                }
            resp.raise_for_status()
            data = resp.json()
            return {
                "appId": "org.onosproject.vpls",
                "active": data.get("state") == "ACTIVE",
                "state": data.get("state", "UNKNOWN"),
                "version": data.get("version"),
            }
        except httpx.HTTPError as e:
            raise HTTPException(status_code=502, detail=f"ONOS error: {e}")


@router.post("/activate")
async def activate_vpls(_: Annotated[None, RequireAdminOrManager]):
    """Activate the VPLS application in ONOS."""
    async with httpx.AsyncClient(timeout=10) as client:
        try:
            resp = await client.post(
                f"{settings.ONOS_URL}/onos/v1/applications/org.onosproject.vpls/active",
                auth=_auth(),
            )
            return {"message": "VPLS app activation requested successfully"}
        except httpx.HTTPError as e:
            raise HTTPException(status_code=502, detail=f"ONOS error: {e}")


@router.get("")
async def list_vpls(_: CurrentUser):
    """List all VPLS networks. Checks app status first."""
    async with httpx.AsyncClient(timeout=10) as client:
        # Check if VPLS app is active
        app_active = False
        try:
            app_resp = await client.get(
                f"{settings.ONOS_URL}/onos/v1/applications/org.onosproject.vpls",
                auth=_auth(),
            )
            if app_resp.status_code == 200:
                app_active = app_resp.json().get("state") == "ACTIVE"
        except httpx.HTTPError:
            pass

        if not app_active:
            return {
                "source": "onos",
                "total": 0,
                "vpls": [],
                "appActive": False,
            }

        try:
            resp = await client.get(
                f"{settings.ONOS_URL}/onos/vpls",
                auth=_auth(),
            )
            resp.raise_for_status()
            data = resp.json()
            # ONOS vpls endpoint can return different shapes
            items = data if isinstance(data, list) else data.get("vpls", data.get("vplss", data.get("services", [])))
            if not isinstance(items, list):
                items = []
            return {
                "source": "onos",
                "total": len(items),
                "vpls": items,
                "appActive": True,
            }
        except httpx.HTTPError as e:
            raise HTTPException(status_code=502, detail=f"ONOS error: {e}")


@router.post("", status_code=201)
async def create_vpls(
    body: VPLSCreate,
    user: Annotated[User, RequireAdminOrManager],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Create a new VPLS network."""
    payload: dict[str, Any] = {
        "name": body.name,
        "encapsulation": body.encapsulation,
    }
    if body.interfaces:
        payload["interfaces"] = body.interfaces

    async with httpx.AsyncClient(timeout=10) as client:
        try:
            resp = await client.post(
                f"{settings.ONOS_URL}/onos/vpls",
                auth=_auth(),
                json=payload,
            )
            await _log(db, user, body.name, "vpls_create", payload)
            return {
                "message": "VPLS service created successfully",
                "result": resp.json() if resp.content else {},
            }
        except httpx.HTTPError as e:
            raise HTTPException(status_code=502, detail=f"ONOS error: {e}")


@router.delete("/{name}")
async def delete_vpls(
    name: str,
    user: Annotated[User, RequireAdminOrManager],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Delete a VPLS network."""
    async with httpx.AsyncClient(timeout=10) as client:
        try:
            resp = await client.delete(
                f"{settings.ONOS_URL}/onos/vpls/{name}",
                auth=_auth(),
            )
            await _log(db, user, name, "vpls_delete", {"name": name})
            return {"message": f"VPLS service '{name}' deleted successfully"}
        except httpx.HTTPError as e:
            raise HTTPException(status_code=502, detail=f"ONOS error: {e}")


@router.post("/{name}/interfaces", status_code=201)
async def add_vpls_interface(
    name: str,
    body: VPLSInterfaceAdd,
    user: Annotated[User, RequireAdminOrManager],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Add an interface to a VPLS network.

    When connect_point / ips / mac / vlan are provided, the ONOS VPLS payload
    is enriched with the standard `connect point` field (space is required by
    the ONOS REST schema).
    """
    iface_payload: dict[str, Any] = {"name": body.name}
    if body.connect_point:
        iface_payload["connect point"] = body.connect_point
    if body.ips:
        iface_payload["ips"] = body.ips
    if body.mac:
        iface_payload["mac"] = body.mac
    if body.vlan:
        iface_payload["vlan"] = body.vlan

    async with httpx.AsyncClient(timeout=10) as client:
        try:
            resp = await client.post(
                f"{settings.ONOS_URL}/onos/vpls/interfaces/{name}",
                auth=_auth(),
                json=iface_payload,
            )
            await _log(db, user, name, "vpls_interface_add", iface_payload)
            return {
                "message": f"Interface added to VPLS '{name}' successfully",
                "result": resp.json() if resp.content else {},
            }
        except httpx.HTTPError as e:
            raise HTTPException(status_code=502, detail=f"ONOS error: {e}")


@router.delete("/{name}/interfaces/{interface_name}")
async def remove_vpls_interface(
    name: str,
    interface_name: str,
    user: Annotated[User, RequireAdminOrManager],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Remove an interface from a VPLS network."""
    async with httpx.AsyncClient(timeout=10) as client:
        try:
            resp = await client.delete(
                f"{settings.ONOS_URL}/onos/vpls/interface/{name}/{interface_name}",
                auth=_auth(),
            )
            await _log(db, user, name, "vpls_interface_remove", {"interface": interface_name})
            return {"message": f"Interface '{interface_name}' removed from VPLS '{name}'"}
        except httpx.HTTPError as e:
            raise HTTPException(status_code=502, detail=f"ONOS error: {e}")


@router.get("/history")
async def vpls_history(
    _: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    limit: int = 100,
):
    """Historique des mutations VPLS (persisté côté serveur)."""
    result = await db.execute(
        select(DeviceConfig)
        .where(DeviceConfig.onos_device_id.like("vpls:%"))
        .order_by(desc(DeviceConfig.applied_at))
        .limit(limit)
    )
    rows = result.scalars().all()
    return {
        "history": [
            {
                "id": str(r.id),
                "vpls_name": (r.onos_device_id or "").removeprefix("vpls:"),
                "action": r.config_type,
                "data": r.config_data,
                "applied_by": str(r.applied_by) if r.applied_by else None,
                "applied_at": r.applied_at.isoformat() if r.applied_at else None,
            }
            for r in rows
        ],
        "total": len(rows),
    }
