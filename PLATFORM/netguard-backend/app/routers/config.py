"""
GET  /config/devices/{onos_id}/ports     → liste ports du device
POST /config/devices/{onos_id}/ports/{port}/toggle → activer/désactiver port
GET  /config/devices/{onos_id}/vlans     → VLANs configurés
POST /config/devices/{onos_id}/vlans     → configurer VLAN
GET  /config/devices/{onos_id}/flows     → flows du device
GET  /config/devices/{onos_id}/history   → historique configs
GET  /config/network                     → config réseau complète ONOS
POST /config/network                     → push config réseau
"""

from datetime import datetime, timezone
from typing import Annotated
from uuid import UUID

import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.deps import CurrentUser, RequireAdminOrManager
from app.models import Device, DeviceConfig, User

settings = get_settings()
router = APIRouter(prefix="/config", tags=["config"])


def _auth():
    return (settings.ONOS_USER, settings.ONOS_PASSWORD)


# ── PORTS ─────────────────────────────────────────────────────

@router.get("/devices/{onos_id}/ports")
async def get_ports(
    onos_id: str,
    _: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Retourne les ports d'un device depuis ONOS + état sauvegardé en DB."""
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                f"{settings.ONOS_URL}/onos/v1/devices/{onos_id}/ports",
                auth=_auth(),
            )
            resp.raise_for_status()
            onos_ports = resp.json().get("ports", [])
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"ONOS inaccessible: {e}")

    # Récupère la config sauvegardée
    result = await db.execute(
        select(DeviceConfig).where(
            DeviceConfig.onos_device_id == onos_id,
            DeviceConfig.config_type == "port",
            DeviceConfig.is_active == True,
        )
    )
    saved_configs = {c.config_data.get("port"): c for c in result.scalars().all()}

    ports = []
    for p in onos_ports:
        port_num = str(p.get("port", ""))
        saved = saved_configs.get(port_num)
        ports.append({
            "port": port_num,
            "is_enabled": p.get("isEnabled", True),
            "type": p.get("type", "COPPER"),
            "speed": p.get("portSpeed", 0),
            "annotations": p.get("annotations", {}),
            "saved_config": saved.config_data if saved else None,
            "last_changed": saved.applied_at.isoformat() if saved else None,
        })

    return {"onos_id": onos_id, "ports": ports}


@router.post("/devices/{onos_id}/ports/{port_number}/toggle")
async def toggle_port(
    onos_id: str,
    port_number: str,
    enable: bool = True,
    current_user: Annotated[User, RequireAdminOrManager] = None,
    db: Annotated[AsyncSession, Depends(get_db)] = None,
):
    """Toggle un port via SSH (ip link set) sur la VM Linux."""
    import paramiko

    # Convertit ONOS device ID en nom de switch Mininet
    # of:0000000000000001 → s1, port 2 → s1-eth2
    try:
        device_num = int(onos_id[-1])
    except (ValueError, IndexError):
        raise HTTPException(status_code=400, detail="Invalid ONOS device ID")

    # Port local = port 0 ou "local" → skip
    if port_number.lower() in ("local", "0"):
        raise HTTPException(status_code=400, detail="Cannot toggle local port")

    interface = f"s{device_num}-eth{port_number}"
    command = f"sudo ip link set {interface} {'up' if enable else 'down'}"

    try:
        ssh = paramiko.SSHClient()
        ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        private_key = paramiko.Ed25519Key(filename=settings.VM_SSH_KEY_PATH)
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

        if exit_code != 0:
            raise HTTPException(status_code=500, detail=f"SSH error: {error}")

        # Sauvegarde historique en DB
        device_result = await db.execute(
            select(Device).where(Device.onos_id == onos_id)
        )
        device = device_result.scalar_one_or_none()
        if device:
            config = DeviceConfig(
                device_id=device.id,
                onos_device_id=onos_id,
                config_type="port",
                config_data={
                    "port": port_number,
                    "interface": interface,
                    "enabled": enable,
                    "command": command,
                },
                applied_by=current_user.id,
                notes=f"Port {port_number} {'enabled' if enable else 'disabled'} via SSH",
                is_active=True,
            )
            db.add(config)
            await db.commit()

        return {
            "message": f"Port {port_number} {'enabled' if enable else 'disabled'} via SSH",
            "interface": interface,
            "command": command,
            "applied_by": current_user.username,
        }

    except paramiko.SSHException as e:
        raise HTTPException(status_code=502, detail=f"SSH failed: {str(e)}")
# ── VLANs ─────────────────────────────────────────────────────

@router.get("/devices/{onos_id}/vlans")
async def get_vlans(
    onos_id: str,
    _: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """VLANs configurés pour ce device (depuis notre DB)."""
    result = await db.execute(
        select(DeviceConfig).where(
            DeviceConfig.onos_device_id == onos_id,
            DeviceConfig.config_type == "vlan",
            DeviceConfig.is_active == True,
        ).order_by(DeviceConfig.applied_at.desc())
    )
    configs = result.scalars().all()
    return {
        "onos_id": onos_id,
        "vlans": [
            {
                "id": str(c.id),
                "vlan_id": c.config_data.get("vlan_id"),
                "name": c.config_data.get("name"),
                "ports": c.config_data.get("ports", []),
                "mode": c.config_data.get("mode", "access"),
                "applied_at": c.applied_at.isoformat(),
                "notes": c.notes,
            }
            for c in configs
        ]
    }


@router.post("/devices/{onos_id}/vlans")
async def configure_vlan(
    onos_id: str,
    body: dict,
    current_user: Annotated[User, RequireAdminOrManager],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    import paramiko

    vlan_id = body.get("vlan_id")
    name = body.get("name", f"VLAN-{vlan_id}")
    ports = body.get("ports", [])
    mode = body.get("mode", "access")
    notes = body.get("notes", "")

    if not vlan_id:
        raise HTTPException(status_code=400, detail="vlan_id required")

    # Convertit ONOS device ID en bridge OVS
    # of:0000000000000003 → s3
    try:
        device_num = int(onos_id[-1])
        bridge = f"s{device_num}"
    except (ValueError, IndexError):
        raise HTTPException(status_code=400, detail="Invalid ONOS device ID")

    ssh_results = []
    ssh_errors = []

    try:
        ssh = paramiko.SSHClient()
        ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        private_key = paramiko.Ed25519Key(filename=settings.VM_SSH_KEY_PATH)
        ssh.connect(
            hostname=settings.VM_HOST,
            username=settings.VM_USER,
            pkey=private_key,
            timeout=10,
        )

        for port_num in ports:
            interface = f"{bridge}-eth{port_num}"

            if mode == "access":
                # Access port : tag le VLAN
                cmds = [
                    f"sudo ovs-vsctl set port {interface} tag={vlan_id}",
                    f"sudo ovs-vsctl set port {interface} vlan_mode=access",
                ]
            else:
                # Trunk port : ajoute le VLAN aux trunks
                cmds = [
                    f"sudo ovs-vsctl set port {interface} trunks={vlan_id}",
                    f"sudo ovs-vsctl set port {interface} vlan_mode=trunk",
                ]

            for cmd in cmds:
                stdin, stdout, stderr = ssh.exec_command(cmd)
                exit_code = stdout.channel.recv_exit_status()
                error = stderr.read().decode().strip()
                if exit_code == 0:
                    ssh_results.append(f"{interface}: {cmd.split('set port')[1].strip()}")
                else:
                    ssh_errors.append(f"{interface}: {error}")

        # Vérifie le résultat dans OVS
        verify_results = []
        for port_num in ports:
            interface = f"{bridge}-eth{port_num}"
            stdin, stdout, stderr = ssh.exec_command(
                f"sudo ovs-vsctl get port {interface} tag trunks vlan_mode"
            )
            output = stdout.read().decode().strip()
            verify_results.append(f"{interface}: {output}")

        ssh.close()

    except paramiko.SSHException as e:
        raise HTTPException(status_code=502, detail=f"SSH failed: {str(e)}")

    # Sauvegarde en DB
    device_result = await db.execute(
        select(Device).where(Device.onos_id == onos_id)
    )
    device = device_result.scalar_one_or_none()

    if device:
        new_config = DeviceConfig(
            device_id=device.id,
            onos_device_id=onos_id,
            config_type="vlan",
            config_data={
                "vlan_id": vlan_id,
                "name": name,
                "ports": ports,
                "mode": mode,
            },
            applied_by=current_user.id,
            notes=notes or f"VLAN {vlan_id} ({mode}) on ports {ports}",
            is_active=True,
        )
        db.add(new_config)
        await db.commit()

    return {
        "message": f"VLAN {vlan_id} configured via SSH on {bridge}",
        "vlan_id": vlan_id,
        "name": name,
        "bridge": bridge,
        "ports": ports,
        "mode": mode,
        "applied": ssh_results,
        "errors": ssh_errors,
        "verification": verify_results,
    }

# ── NETWORK CONFIG ─────────────────────────────────────────────

@router.get("/network")
async def get_network_config(_: CurrentUser):
    """Config réseau complète depuis ONOS."""
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                f"{settings.ONOS_URL}/onos/v1/network/configuration",
                auth=_auth(),
            )
            resp.raise_for_status()
            return resp.json()
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"ONOS inaccessible: {e}")


# ── HISTORY ───────────────────────────────────────────────────

@router.get("/devices/{onos_id}/history")
async def get_config_history(
    onos_id: str,
    _: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    limit: int = 20,
):
    """Historique de toutes les configs appliquées sur ce device."""
    result = await db.execute(
        select(DeviceConfig)
        .where(DeviceConfig.onos_device_id == onos_id)
        .order_by(DeviceConfig.applied_at.desc())
        .limit(limit)
    )
    configs = result.scalars().all()
    return {
        "onos_id": onos_id,
        "history": [
            {
                "id": str(c.id),
                "config_type": c.config_type,
                "config_data": c.config_data,
                "applied_at": c.applied_at.isoformat(),
                "is_active": c.is_active,
                "notes": c.notes,
            }
            for c in configs
        ]
    }

# ── HOSTS CONFIG ──────────────────────────────────────────────

@router.get("/hosts")
async def get_hosts_config(_: CurrentUser):
    """Retourne tous les hosts avec leur config depuis ONOS."""
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                f"{settings.ONOS_URL}/onos/v1/hosts",
                auth=_auth(),
            )
            resp.raise_for_status()
            hosts = resp.json().get("hosts", [])

            return {
                "hosts": [
                    {
                        "id": h.get("id"),
                        "mac": h.get("mac"),
                        "vlan": h.get("vlan"),
                        "ip_addresses": h.get("ipAddresses", []),
                        "location_device": (
                            h.get("locations", [{}])[0].get("elementId")
                            if h.get("locations") else None
                        ),
                        "location_port": (
                            h.get("locations", [{}])[0].get("port")
                            if h.get("locations") else None
                        ),
                        "configured": h.get("configured", False),
                        "suspended": h.get("suspended", False),
                    }
                    for h in hosts
                ]
            }
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"ONOS inaccessible: {e}")


@router.post("/hosts/{host_id}/suspend")
async def suspend_host(
    host_id: str,
    _: Annotated[User, RequireAdminOrManager],
):
    """Suspend/unsuspend un host dans ONOS."""
    # host_id est encodé URL (contient /)
    import urllib.parse
    encoded = urllib.parse.quote(host_id, safe='')
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            # ONOS: DELETE host pour le supprimer temporairement
            resp = await client.delete(
                f"{settings.ONOS_URL}/onos/v1/hosts/{encoded}",
                auth=_auth(),
            )
            return {
                "message": f"Host {host_id} removed from ONOS",
                "status": resp.status_code,
            }
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"ONOS inaccessible: {e}")


@router.post("/hosts/toggle-link")
async def toggle_host_link(
    body: dict,
    current_user: Annotated[User, RequireAdminOrManager],
):
    """Toggle le lien host↔switch via SSH (down/up le port du switch)."""
    import paramiko

    switch_device = body.get("switch_device")
    switch_port = body.get("switch_port")
    enable = body.get("enable", True)

    if not switch_device or not switch_port:
        raise HTTPException(status_code=400, detail="switch_device and switch_port required")

    # Convertit en interface Mininet
    device_num = int(switch_device[-1])
    interface = f"s{device_num}-eth{switch_port}"
    command = f"sudo ip link set {interface} {'up' if enable else 'down'}"

    try:
        ssh = paramiko.SSHClient()
        ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        private_key = paramiko.Ed25519Key(filename=settings.VM_SSH_KEY_PATH)
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
            return {
                "message": f"Host link {'enabled' if enable else 'disabled'}",
                "interface": interface,
                "applied_by": current_user.username,
            }
        else:
            raise HTTPException(status_code=500, detail=f"SSH error: {error}")

    except paramiko.SSHException as e:
        raise HTTPException(status_code=502, detail=f"SSH failed: {str(e)}")