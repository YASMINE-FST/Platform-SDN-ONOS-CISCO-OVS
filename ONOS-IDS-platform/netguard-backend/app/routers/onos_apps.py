"""
GET    /onos/apps              → liste des apps ONOS       [tous]
POST   /onos/apps/{name}/activate   → active une app      [admin]
DELETE /onos/apps/{name}/activate   → désactive une app   [admin]
GET    /onos/apps/{name}            → détail app           [tous]
"""

import httpx
from fastapi import APIRouter, Depends, HTTPException
from typing import Annotated

from app.config import get_settings
from app.deps import CurrentUser, RequireAdmin
from app.models import User

settings = get_settings()
router = APIRouter(prefix="/onos/apps", tags=["onos-apps"])

ONOS_AUTH = None  # défini dynamiquement


# Apps auto-activées au démarrage (valeur SDN réelle sur OVS)
ESSENTIAL_APPS = [
    "org.onosproject.openflow",            # provider OpenFlow
    "org.onosproject.fwd",                  # reactive forwarding
    "org.onosproject.proxyarp",             # ARP proxy
    "org.onosproject.hostprovider",         # host discovery
    "org.onosproject.lldpprovider",         # topology discovery
    "org.onosproject.vpls",                 # VPLS service
    "org.onosproject.netcfghostprovider",   # host netcfg provider
    "org.onosproject.drivers",              # device drivers
    "org.onosproject.gui2",                 # ONOS web GUI
]


def _auth():
    return (settings.ONOS_USER, settings.ONOS_PASSWORD)


async def activate_essentials() -> dict:
    """Active en best-effort la liste ESSENTIAL_APPS via REST ONOS."""
    results: dict[str, str] = {}
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            for app in ESSENTIAL_APPS:
                try:
                    resp = await client.post(
                        f"{settings.ONOS_URL}/onos/v1/applications/{app}/active",
                        auth=_auth(),
                    )
                    results[app] = "ACTIVE" if resp.status_code < 400 else f"HTTP {resp.status_code}"
                except Exception as e:
                    results[app] = f"error: {e}"
    except Exception as e:
        return {"ok": False, "error": str(e), "results": results}
    return {"ok": True, "results": results}


@router.get("")
async def list_apps(_: CurrentUser):
    """Liste toutes les applications ONOS avec leur état."""
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                f"{settings.ONOS_URL}/onos/v1/applications",
                auth=_auth(),
            )
            resp.raise_for_status()
            apps = resp.json().get("applications", [])

            # Enrichit avec des catégories utiles
            categorized = []
            for app in apps:
                categorized.append({
                    "id": app.get("id"),
                    "name": app.get("name"),
                    "version": app.get("version"),
                    "state": app.get("state"),          # ACTIVE / INSTALLED
                    "category": app.get("category"),
                    "description": app.get("description"),
                    "origin": app.get("origin"),
                    "permissions": app.get("permissions", []),
                    "required_apps": app.get("requiredApps", []),
                })
            return {"apps": categorized, "total": len(categorized)}
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"ONOS inaccessible: {e}")


@router.get("/{app_name}")
async def get_app(app_name: str, _: CurrentUser):
    """Détail d'une application ONOS."""
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                f"{settings.ONOS_URL}/onos/v1/applications/{app_name}",
                auth=_auth(),
            )
            resp.raise_for_status()
            return resp.json()
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"ONOS inaccessible: {e}")


@router.post("/essentials/activate")
async def activate_essential_apps(_: Annotated[User, RequireAdmin]):
    """Active d'un coup toutes les apps ONOS essentielles pour la plateforme SDN."""
    result = await activate_essentials()
    return {
        "requested": ESSENTIAL_APPS,
        **result,
    }


@router.get("/essentials")
async def list_essential_apps(_: Annotated[User, RequireAdmin]):
    """Liste les apps considérées 'essentielles' + leur état actuel."""
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                f"{settings.ONOS_URL}/onos/v1/applications",
                auth=_auth(),
            )
            resp.raise_for_status()
            apps = {a.get("name"): a.get("state") for a in resp.json().get("applications", [])}
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"ONOS inaccessible: {e}")
    return {
        "essentials": [
            {"name": name, "state": apps.get(name, "NOT_INSTALLED")}
            for name in ESSENTIAL_APPS
        ]
    }


@router.post("/{app_name}/activate")
async def activate_app(
    app_name: str,
    _: Annotated[User, RequireAdmin],
):
    """Active une application ONOS. [admin only]"""
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                f"{settings.ONOS_URL}/onos/v1/applications/{app_name}/active",
                auth=_auth(),
            )
            resp.raise_for_status()
            return {"message": f"App '{app_name}' activée", "status": "ACTIVE"}
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"ONOS inaccessible: {e}")


@router.delete("/{app_name}/activate")
async def deactivate_app(
    app_name: str,
    _: Annotated[User, RequireAdmin],
):
    """Désactive une application ONOS. [admin only]"""
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.delete(
                f"{settings.ONOS_URL}/onos/v1/applications/{app_name}/active",
                auth=_auth(),
            )
            resp.raise_for_status()
            return {"message": f"App '{app_name}' désactivée", "status": "INSTALLED"}
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"ONOS inaccessible: {e}")