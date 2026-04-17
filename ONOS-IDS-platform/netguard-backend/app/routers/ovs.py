"""
OVS Configuration Router — gestion GUI des Open vSwitch via SSH.

GET    /ovs/bridges                        → liste des bridges
GET    /ovs/bridges/{br}                   → détail (ports, controller, datapath)
POST   /ovs/bridges                        → crée un bridge
DELETE /ovs/bridges/{br}                   → supprime un bridge
POST   /ovs/bridges/{br}/ports             → ajoute un port (avec VLAN optionnel)
DELETE /ovs/bridges/{br}/ports/{port}      → supprime un port
POST   /ovs/bridges/{br}/ports/{port}/vlan → (re)définit le VLAN tag du port
POST   /ovs/bridges/{br}/mirror            → crée un port-mirror (span)
DELETE /ovs/bridges/{br}/mirror/{name}     → supprime un mirror
GET    /ovs/bridges/{br}/flows             → dump OpenFlow flows (ovs-ofctl)
POST   /ovs/bridges/{br}/controller        → attache un controller ONOS
GET    /ovs/history                        → historique des changements (DB)
"""

from __future__ import annotations

import re
import shlex
from datetime import datetime, timezone
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.deps import CurrentUser, RequireAdminOrManager
from app.models import DeviceConfig, User

settings = get_settings()
router = APIRouter(prefix="/ovs", tags=["ovs"])

_SAFE_NAME = re.compile(r"^[A-Za-z0-9_\-]{1,32}$")
_SAFE_VLAN = re.compile(r"^[0-9]{1,4}$")
_SAFE_IFACE_TYPE = {"internal", "vxlan", "gre", "patch", "system", ""}


def _must(valid: bool, message: str) -> None:
    if not valid:
        raise HTTPException(status_code=400, detail=message)


def _safe_name(value: str, label: str) -> str:
    _must(bool(value) and bool(_SAFE_NAME.fullmatch(value)), f"Invalid {label}")
    return value


async def _ssh(command: str, timeout: int = 15) -> dict[str, Any]:
    import paramiko

    try:
        client = paramiko.SSHClient()
        client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        key = paramiko.Ed25519Key(filename=settings.VM_SSH_KEY_PATH)
        client.connect(
            hostname=settings.VM_HOST,
            username=settings.VM_USER,
            pkey=key,
            timeout=10,
        )
        _, stdout, stderr = client.exec_command(command, timeout=timeout)
        exit_code = stdout.channel.recv_exit_status()
        out = stdout.read().decode("utf-8", errors="replace")
        err = stderr.read().decode("utf-8", errors="replace")
        client.close()
        return {
            "output": out,
            "error": err,
            "exit_code": exit_code,
            "success": exit_code == 0,
        }
    except Exception as exc:
        return {
            "output": "",
            "error": str(exc),
            "exit_code": -1,
            "success": False,
        }


async def _run_or_raise(cmd: str) -> str:
    result = await _ssh(cmd)
    if not result["success"]:
        msg = result["error"] or result["output"] or "SSH failed"
        raise HTTPException(status_code=502, detail=msg.strip())
    return result["output"]


async def _persist(
    db: AsyncSession,
    user: User,
    onos_device_id: str,
    config_type: str,
    data: dict[str, Any],
    notes: str | None = None,
) -> None:
    entry = DeviceConfig(
        onos_device_id=onos_device_id,
        config_type=config_type,
        config_data=data,
        applied_by=user.id,
        notes=notes,
    )
    db.add(entry)
    await db.commit()


# ── Schemas ─────────────────────────────────────────────────────────────

class BridgeCreate(BaseModel):
    name: str = Field(..., description="Bridge name, e.g. br0")
    controller: str | None = Field(
        default=None,
        description="Controller URI, e.g. tcp:127.0.0.1:6653",
    )
    datapath_id: str | None = Field(default=None, description="16-hex datapath ID")
    protocols: str | None = Field(
        default="OpenFlow13",
        description="Comma list, e.g. OpenFlow13 or OpenFlow10,OpenFlow13",
    )


class PortCreate(BaseModel):
    name: str
    type: str | None = Field(default=None, description="internal|vxlan|gre|patch|system")
    vlan_tag: int | None = Field(default=None, ge=1, le=4094)
    remote_ip: str | None = Field(default=None, description="vxlan/gre remote IP")
    peer: str | None = Field(default=None, description="patch peer port name")


class PortVlan(BaseModel):
    vlan_tag: int | None = Field(default=None, ge=1, le=4094)


class MirrorCreate(BaseModel):
    name: str
    select_src_port: str
    output_port: str


class ControllerAttach(BaseModel):
    controller: str = Field(..., description="tcp:host:port")


# ── Bridges ─────────────────────────────────────────────────────────────

@router.get("/bridges")
async def list_bridges(_: CurrentUser) -> dict[str, Any]:
    raw = await _run_or_raise("sudo ovs-vsctl list-br")
    bridges = [b.strip() for b in raw.splitlines() if b.strip()]
    details = []
    for br in bridges:
        ports_raw = await _ssh(f"sudo ovs-vsctl list-ports {shlex.quote(br)}")
        ctrl_raw = await _ssh(f"sudo ovs-vsctl get-controller {shlex.quote(br)}")
        dp_raw = await _ssh(
            f"sudo ovs-vsctl get bridge {shlex.quote(br)} datapath_id"
        )
        details.append({
            "name": br,
            "ports": [p for p in ports_raw["output"].splitlines() if p.strip()],
            "controller": ctrl_raw["output"].strip() or None,
            "datapath_id": dp_raw["output"].strip().strip('"') or None,
        })
    return {"bridges": details, "total": len(details)}


@router.get("/bridges/{br}")
async def get_bridge(br: str, _: CurrentUser) -> dict[str, Any]:
    _safe_name(br, "bridge name")
    ports_raw = await _run_or_raise(f"sudo ovs-vsctl list-ports {shlex.quote(br)}")
    ports = [p for p in ports_raw.splitlines() if p.strip()]
    port_details = []
    for p in ports:
        tag = await _ssh(
            f"sudo ovs-vsctl get port {shlex.quote(p)} tag"
        )
        iface_type = await _ssh(
            f"sudo ovs-vsctl get interface {shlex.quote(p)} type"
        )
        port_details.append({
            "name": p,
            "vlan_tag": tag["output"].strip() if tag["success"] else None,
            "type": iface_type["output"].strip().strip('"') if iface_type["success"] else None,
        })
    ctrl = await _ssh(f"sudo ovs-vsctl get-controller {shlex.quote(br)}")
    dpid = await _ssh(
        f"sudo ovs-vsctl get bridge {shlex.quote(br)} datapath_id"
    )
    fail_mode = await _ssh(f"sudo ovs-vsctl get-fail-mode {shlex.quote(br)}")
    protocols = await _ssh(
        f"sudo ovs-vsctl get bridge {shlex.quote(br)} protocols"
    )
    return {
        "name": br,
        "ports": port_details,
        "controller": ctrl["output"].strip() or None,
        "datapath_id": dpid["output"].strip().strip('"') or None,
        "fail_mode": fail_mode["output"].strip() or None,
        "protocols": protocols["output"].strip() or None,
    }


@router.post("/bridges", status_code=201)
async def create_bridge(
    body: BridgeCreate,
    user: Annotated[User, RequireAdminOrManager],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict[str, Any]:
    name = _safe_name(body.name, "bridge name")
    cmd = f"sudo ovs-vsctl --may-exist add-br {shlex.quote(name)}"
    await _run_or_raise(cmd)

    if body.protocols:
        await _run_or_raise(
            f"sudo ovs-vsctl set bridge {shlex.quote(name)} "
            f"protocols={shlex.quote(body.protocols)}"
        )
    if body.datapath_id:
        _must(
            bool(re.fullmatch(r"[0-9a-fA-F]{16}", body.datapath_id)),
            "datapath_id must be 16 hex chars",
        )
        await _run_or_raise(
            f"sudo ovs-vsctl set bridge {shlex.quote(name)} "
            f"other-config:datapath-id={shlex.quote(body.datapath_id)}"
        )
    if body.controller:
        _must(
            body.controller.startswith(("tcp:", "ssl:", "unix:")),
            "controller must start with tcp:/ssl:/unix:",
        )
        await _run_or_raise(
            f"sudo ovs-vsctl set-controller {shlex.quote(name)} "
            f"{shlex.quote(body.controller)}"
        )

    await _persist(
        db, user,
        onos_device_id=f"ovs:{name}",
        config_type="bridge_create",
        data=body.model_dump(),
    )
    return {"name": name, "message": "bridge created"}


@router.delete("/bridges/{br}")
async def delete_bridge(
    br: str,
    user: Annotated[User, RequireAdminOrManager],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict[str, Any]:
    name = _safe_name(br, "bridge name")
    await _run_or_raise(f"sudo ovs-vsctl --if-exists del-br {shlex.quote(name)}")
    await _persist(
        db, user,
        onos_device_id=f"ovs:{name}",
        config_type="bridge_delete",
        data={"name": name},
    )
    return {"name": name, "message": "bridge deleted"}


# ── Ports ───────────────────────────────────────────────────────────────

@router.post("/bridges/{br}/ports", status_code=201)
async def add_port(
    br: str,
    body: PortCreate,
    user: Annotated[User, RequireAdminOrManager],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict[str, Any]:
    bridge = _safe_name(br, "bridge name")
    port = _safe_name(body.name, "port name")
    iface_type = (body.type or "").lower()
    _must(iface_type in _SAFE_IFACE_TYPE, f"Invalid port type '{body.type}'")

    parts = [
        "sudo",
        "ovs-vsctl",
        "--may-exist",
        "add-port",
        shlex.quote(bridge),
        shlex.quote(port),
    ]
    if body.vlan_tag:
        parts.append(f"tag={body.vlan_tag}")

    extras: list[str] = []
    if iface_type:
        extras.append(f"type={iface_type}")
    if iface_type in {"vxlan", "gre"}:
        _must(bool(body.remote_ip), f"{iface_type} requires remote_ip")
        # ipv4 quick sanity
        _must(
            bool(re.fullmatch(r"\d{1,3}(?:\.\d{1,3}){3}", body.remote_ip or "")),
            "remote_ip must be IPv4",
        )
        extras.append(f"options:remote_ip={body.remote_ip}")
    if iface_type == "patch":
        peer = _safe_name(body.peer or "", "peer port")
        extras.append(f"options:peer={peer}")

    if extras:
        parts.append("--")
        parts.append("set")
        parts.append("interface")
        parts.append(shlex.quote(port))
        parts.extend(extras)

    await _run_or_raise(" ".join(parts))

    await _persist(
        db, user,
        onos_device_id=f"ovs:{bridge}",
        config_type="port_add",
        data={"bridge": bridge, **body.model_dump()},
    )
    return {"bridge": bridge, "port": port, "message": "port added"}


@router.delete("/bridges/{br}/ports/{port}")
async def remove_port(
    br: str,
    port: str,
    user: Annotated[User, RequireAdminOrManager],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict[str, Any]:
    bridge = _safe_name(br, "bridge name")
    name = _safe_name(port, "port name")
    await _run_or_raise(
        f"sudo ovs-vsctl --if-exists del-port {shlex.quote(bridge)} {shlex.quote(name)}"
    )
    await _persist(
        db, user,
        onos_device_id=f"ovs:{bridge}",
        config_type="port_remove",
        data={"bridge": bridge, "port": name},
    )
    return {"bridge": bridge, "port": name, "message": "port removed"}


@router.post("/bridges/{br}/ports/{port}/vlan")
async def set_port_vlan(
    br: str,
    port: str,
    body: PortVlan,
    user: Annotated[User, RequireAdminOrManager],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict[str, Any]:
    bridge = _safe_name(br, "bridge name")
    name = _safe_name(port, "port name")
    if body.vlan_tag is None:
        await _run_or_raise(f"sudo ovs-vsctl remove port {shlex.quote(name)} tag {{}}")
        action = "vlan_clear"
    else:
        await _run_or_raise(
            f"sudo ovs-vsctl set port {shlex.quote(name)} tag={body.vlan_tag}"
        )
        action = "vlan_set"

    await _persist(
        db, user,
        onos_device_id=f"ovs:{bridge}",
        config_type=action,
        data={"bridge": bridge, "port": name, "vlan_tag": body.vlan_tag},
    )
    return {
        "bridge": bridge,
        "port": name,
        "vlan_tag": body.vlan_tag,
        "message": action.replace("_", " "),
    }


# ── Mirror / SPAN ───────────────────────────────────────────────────────

@router.post("/bridges/{br}/mirror", status_code=201)
async def create_mirror(
    br: str,
    body: MirrorCreate,
    user: Annotated[User, RequireAdminOrManager],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict[str, Any]:
    bridge = _safe_name(br, "bridge name")
    mirror = _safe_name(body.name, "mirror name")
    src = _safe_name(body.select_src_port, "source port")
    dst = _safe_name(body.output_port, "output port")

    cmd = (
        f"sudo ovs-vsctl -- --id=@p1 get port {shlex.quote(src)} "
        f"-- --id=@p2 get port {shlex.quote(dst)} "
        f"-- --id=@m create mirror name={shlex.quote(mirror)} "
        f"select-src-port=@p1 select-dst-port=@p1 output-port=@p2 "
        f"-- add bridge {shlex.quote(bridge)} mirrors @m"
    )
    await _run_or_raise(cmd)

    await _persist(
        db, user,
        onos_device_id=f"ovs:{bridge}",
        config_type="mirror_create",
        data={"bridge": bridge, **body.model_dump()},
    )
    return {"bridge": bridge, "mirror": mirror, "message": "mirror created"}


@router.delete("/bridges/{br}/mirror/{name}")
async def delete_mirror(
    br: str,
    name: str,
    user: Annotated[User, RequireAdminOrManager],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict[str, Any]:
    bridge = _safe_name(br, "bridge name")
    mirror = _safe_name(name, "mirror name")
    await _run_or_raise(
        f"sudo ovs-vsctl -- --id=@m get mirror {shlex.quote(mirror)} "
        f"-- remove bridge {shlex.quote(bridge)} mirrors @m "
        f"-- --if-exists destroy mirror {shlex.quote(mirror)}"
    )
    await _persist(
        db, user,
        onos_device_id=f"ovs:{bridge}",
        config_type="mirror_delete",
        data={"bridge": bridge, "mirror": mirror},
    )
    return {"bridge": bridge, "mirror": mirror, "message": "mirror deleted"}


# ── Flows (read-only dump via ovs-ofctl) ────────────────────────────────

@router.get("/bridges/{br}/flows")
async def dump_flows(br: str, _: CurrentUser) -> dict[str, Any]:
    bridge = _safe_name(br, "bridge name")
    raw = await _run_or_raise(f"sudo ovs-ofctl -O OpenFlow13 dump-flows {shlex.quote(bridge)}")
    lines = [ln.strip() for ln in raw.splitlines() if ln.strip()]
    return {"bridge": bridge, "flows": lines, "total": len(lines)}


# ── Controller ──────────────────────────────────────────────────────────

@router.post("/bridges/{br}/controller")
async def set_controller(
    br: str,
    body: ControllerAttach,
    user: Annotated[User, RequireAdminOrManager],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict[str, Any]:
    bridge = _safe_name(br, "bridge name")
    _must(
        body.controller.startswith(("tcp:", "ssl:", "unix:")),
        "controller must start with tcp:/ssl:/unix:",
    )
    await _run_or_raise(
        f"sudo ovs-vsctl set-controller {shlex.quote(bridge)} "
        f"{shlex.quote(body.controller)}"
    )
    await _persist(
        db, user,
        onos_device_id=f"ovs:{bridge}",
        config_type="controller_set",
        data={"bridge": bridge, "controller": body.controller},
    )
    return {"bridge": bridge, "controller": body.controller, "message": "controller attached"}


# ── History ─────────────────────────────────────────────────────────────

@router.get("/history")
async def get_history(
    _: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    limit: int = 100,
) -> dict[str, Any]:
    result = await db.execute(
        select(DeviceConfig)
        .where(DeviceConfig.onos_device_id.like("ovs:%"))
        .order_by(desc(DeviceConfig.applied_at))
        .limit(limit)
    )
    rows = result.scalars().all()
    return {
        "history": [
            {
                "id": str(r.id),
                "bridge": (r.onos_device_id or "").removeprefix("ovs:"),
                "action": r.config_type,
                "data": r.config_data,
                "applied_by": str(r.applied_by) if r.applied_by else None,
                "applied_at": r.applied_at.isoformat() if r.applied_at else None,
                "notes": r.notes,
            }
            for r in rows
        ],
        "total": len(rows),
    }
