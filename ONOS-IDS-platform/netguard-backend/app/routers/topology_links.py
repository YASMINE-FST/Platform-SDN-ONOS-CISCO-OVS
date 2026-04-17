import paramiko
import tempfile
import os
from datetime import datetime, timezone
from typing import Annotated

import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.dialects.postgresql import insert

from app.config import get_settings
from app.database import get_db
from app.deps import CurrentUser, RequireAdminOrManager
from app.models import LinkState, User

settings = get_settings()
router = APIRouter(prefix="/topology", tags=["topology"])


def _auth():
    return (settings.ONOS_USER, settings.ONOS_PASSWORD)


def _get_interface_name(device_onos_id: str, port: str) -> str:
    """Convertit ONOS device ID + port en nom d'interface Mininet."""
    # of:0000000000000001 → s1, port 2 → s1-eth2
    device_num = int(device_onos_id[-1])
    return f"s{device_num}-eth{port}"


async def _ssh_toggle_interface(interface: str, enable: bool) -> tuple[bool, str]:
    """Toggle une interface via SSH sur la VM Linux."""
    command = f"sudo ip link set {interface} {'up' if enable else 'down'}"

    try:
        key_path = settings.VM_SSH_KEY_PATH
        ssh = paramiko.SSHClient()
        ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

        private_key = paramiko.Ed25519Key(filename=key_path)
        ssh.connect(
            hostname=settings.VM_HOST,
            username=settings.VM_USER,
            pkey=private_key,
            timeout=10,
        )

        stdin, stdout, stderr = ssh.exec_command(command)
        exit_code = stdout.channel.recv_exit_status()
        error = stderr.read().decode().strip()
        ssh.close()

        if exit_code == 0:
            return True, f"Interface {interface} {'enabled' if enable else 'disabled'}"
        else:
            return False, f"SSH error: {error}"

    except Exception as e:
        return False, f"SSH connection failed: {str(e)}"


@router.get("/links")
async def get_links(
    _: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Liens depuis ONOS + états sauvegardés en DB."""
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                f"{settings.ONOS_URL}/onos/v1/links",
                auth=_auth(),
            )
            resp.raise_for_status()
            onos_links = resp.json().get("links", [])
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"ONOS inaccessible: {e}")

    result = await db.execute(select(LinkState))
    saved = {
        f"{ls.src_device}:{ls.src_port}-{ls.dst_device}:{ls.dst_port}": ls
        for ls in result.scalars().all()
    }

    links = []
    seen = set()
    for lnk in onos_links:
        src_dev = lnk["src"]["device"]
        src_port = lnk["src"]["port"]
        dst_dev = lnk["dst"]["device"]
        dst_port = lnk["dst"]["port"]
        key = f"{src_dev}:{src_port}-{dst_dev}:{dst_port}"
        rev_key = f"{dst_dev}:{dst_port}-{src_dev}:{src_port}"
        if key in seen or rev_key in seen:
            continue
        seen.add(key)
        saved_state = saved.get(key) or saved.get(rev_key)
        links.append({
            "id": key,
            "src_device": src_dev,
            "src_port": src_port,
            "dst_device": dst_dev,
            "dst_port": dst_port,
            "type": lnk.get("type", "DIRECT"),
            "state": lnk.get("state", "ACTIVE"),
            "is_enabled": saved_state.is_enabled if saved_state else True,
            "changed_at": saved_state.changed_at.isoformat() if saved_state else None,
        })

    return {"links": links, "total": len(links)}


@router.post("/links/toggle")
async def toggle_link(
    body: dict,
    current_user: Annotated[User, RequireAdminOrManager],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Active ou désactive un lien via SSH sur la VM Linux."""
    src_device = body.get("src_device")
    src_port = body.get("src_port")
    dst_device = body.get("dst_device")
    dst_port = body.get("dst_port")
    enable = body.get("enable", True)

    if not all([src_device, src_port, dst_device, dst_port]):
        raise HTTPException(
            status_code=400,
            detail="src_device, src_port, dst_device, dst_port required"
        )

    results = []
    errors = []

    # Toggle les interfaces des 2 côtés du lien via SSH
    for device_id, port in [(src_device, src_port), (dst_device, dst_port)]:
        # Skip les IDs host
        if not str(device_id).startswith("of:"):
            continue

        interface = _get_interface_name(str(device_id), str(port))
        success, message = await _ssh_toggle_interface(interface, enable)

        if success:
            results.append(message)
        else:
            errors.append(f"{interface}: {message}")

    # Sauvegarde en DB même si SSH a des erreurs partielles
    stmt = insert(LinkState).values(
        src_device=str(src_device),
        src_port=str(src_port),
        dst_device=str(dst_device),
        dst_port=str(dst_port),
        is_enabled=enable,
        changed_by=current_user.id,
        changed_at=datetime.now(timezone.utc),
    ).on_conflict_do_update(
        index_elements=["src_device", "src_port", "dst_device", "dst_port"],
        set_={
            "is_enabled": enable,
            "changed_by": current_user.id,
            "changed_at": datetime.now(timezone.utc),
        }
    )
    await db.execute(stmt)
    await db.commit()

    return {
        "message": f"Link {'enabled' if enable else 'disabled'} via SSH",
        "interfaces_toggled": results,
        "errors": errors,
        "applied_by": current_user.username,
        "ssh_host": settings.VM_HOST,
    }


@router.get("/links/states")
async def get_link_states(
    _: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(
        select(LinkState).order_by(LinkState.changed_at.desc())
    )
    states = result.scalars().all()
    return {
        "states": [
            {
                "src": f"{s.src_device}:{s.src_port}",
                "dst": f"{s.dst_device}:{s.dst_port}",
                "is_enabled": s.is_enabled,
                "changed_at": s.changed_at.isoformat(),
            }
            for s in states
        ]
    }