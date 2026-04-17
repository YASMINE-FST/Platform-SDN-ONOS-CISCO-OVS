"""
POST /cli/ssh      → exécute une commande SSH sur la VM Linux
POST /cli/onos     → exécute une commande ONOS via REST
GET  /cli/history  → historique des commandes
"""

import asyncio
from datetime import datetime, timezone
from typing import Annotated

import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.deps import CurrentUser, RequireAdminOrManager
from app.models import User

settings = get_settings()
router = APIRouter(prefix="/cli", tags=["cli"])

# Historique en mémoire (par user)
_cli_history: dict[str, list[dict]] = {}

# Commandes SSH autorisées (whitelist sécurité)
SSH_ALLOWED_PREFIXES = [
    "ping", "ip link", "ip addr", "ip route", "ifconfig",
    "ovs-vsctl", "ovs-ofctl", "ovs-appctl",
    "sudo ip link", "sudo ovs-vsctl", "sudo ovs-ofctl",
    "cat /proc/net", "netstat", "ss -",
    "mn --version", "echo",
]

# Commandes ONOS supportées
ONOS_COMMANDS = {
    "devices":   ("GET",    "/onos/v1/devices"),
    "links":     ("GET",    "/onos/v1/links"),
    "hosts":     ("GET",    "/onos/v1/hosts"),
    "flows":     ("GET",    "/onos/v1/flows"),
    "ports":     ("GET",    "/onos/v1/devices/{arg}/ports"),
    "apps":      ("GET",    "/onos/v1/applications?active=true"),
    "topology":  ("GET",    "/onos/v1/topology"),
    "intents":   ("GET",    "/onos/v1/intents"),
    "clusters":  ("GET",    "/onos/v1/topology/clusters"),
    "paths":     ("GET",    "/onos/v1/paths/{arg1}/{arg2}"),
    "stats":     ("GET",    "/onos/v1/statistics/ports"),
}


def _is_allowed(command: str) -> bool:
    cmd = command.strip().lower()
    return any(cmd.startswith(prefix.lower()) for prefix in SSH_ALLOWED_PREFIXES)


async def _exec_ssh(command: str, timeout: int = 15) -> dict:
    """Exécute une commande SSH sur la VM Linux."""
    import paramiko
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
        stdin, stdout, stderr = ssh.exec_command(command, timeout=timeout)
        exit_code = stdout.channel.recv_exit_status()
        output = stdout.read().decode('utf-8', errors='replace')
        error = stderr.read().decode('utf-8', errors='replace')
        ssh.close()

        return {
            "output": output or error or "(no output)",
            "exit_code": exit_code,
            "success": exit_code == 0,
        }
    except Exception as e:
        return {
            "output": f"SSH Error: {str(e)}",
            "exit_code": -1,
            "success": False,
        }


async def _exec_onos(command: str) -> dict:
    """Exécute une commande ONOS via REST API."""
    parts = command.strip().split()
    if not parts:
        return {"output": "Empty command", "success": False}

    cmd = parts[0].lower()
    args = parts[1:] if len(parts) > 1 else []

    # Commandes spéciales
    if cmd == "help":
        cmds = "\n".join([f"  {k:<12} {v[1]}" for k, v in ONOS_COMMANDS.items()])
        return {"output": f"Available ONOS commands:\n{cmds}", "success": True}

    if cmd not in ONOS_COMMANDS:
        return {
            "output": f"Unknown command '{cmd}'. Type 'help' for available commands.",
            "success": False,
        }

    method, path_template = ONOS_COMMANDS[cmd]

    # Remplace les arguments dans le path
    path = path_template
    if "{arg}" in path and args:
        path = path.replace("{arg}", args[0])
    elif "{arg1}" in path and len(args) >= 2:
        path = path.replace("{arg1}", args[0]).replace("{arg2}", args[1])
    elif "{arg}" in path or "{arg1}" in path:
        return {"output": f"Command '{cmd}' requires arguments", "success": False}

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.request(
                method,
                f"{settings.ONOS_URL}{path}",
                auth=(settings.ONOS_USER, settings.ONOS_PASSWORD),
            )
            import json
            data = resp.json()

            # Formatage lisible
            output = _format_onos_output(cmd, data)
            return {"output": output, "success": resp.status_code < 400}
    except Exception as e:
        return {"output": f"ONOS Error: {str(e)}", "success": False}


def _format_onos_output(cmd: str, data: dict) -> str:
    """Formate la sortie ONOS de manière lisible."""
    import json

    if cmd == "devices":
        devices = data.get("devices", [])
        if not devices:
            return "No devices found"
        lines = [f"{'ID':<40} {'Type':<10} {'Status':<10} {'SW Version'}"]
        lines.append("-" * 80)
        for d in devices:
            lines.append(
                f"{d.get('id',''):<40} "
                f"{d.get('type',''):<10} "
                f"{d.get('available','')!s:<10} "
                f"{d.get('swVersion','')}"
            )
        return "\n".join(lines)

    elif cmd == "hosts":
        hosts = data.get("hosts", [])
        if not hosts:
            return "No hosts found"
        lines = [f"{'ID':<45} {'IP':<16} {'MAC':<20} {'Location'}"]
        lines.append("-" * 95)
        for h in hosts:
            ip = h.get("ipAddresses", [""])[0]
            loc = h.get("locations", [{}])[0]
            location = f"{loc.get('elementId','')[-4:]}:p{loc.get('port','')}"
            lines.append(
                f"{h.get('id',''):<45} {ip:<16} "
                f"{h.get('mac',''):<20} {location}"
            )
        return "\n".join(lines)

    elif cmd == "links":
        links = data.get("links", [])
        if not links:
            return "No links found"
        lines = [f"{'Source':<35} {'Destination':<35} {'Type':<10} {'State'}"]
        lines.append("-" * 90)
        for l in links:
            src = f"{l['src']['device'][-4:]}:p{l['src']['port']}"
            dst = f"{l['dst']['device'][-4:]}:p{l['dst']['port']}"
            lines.append(
                f"{src:<35} {dst:<35} "
                f"{l.get('type',''):<10} {l.get('state','')}"
            )
        return "\n".join(lines)

    elif cmd == "flows":
        flows = data.get("flows", [])
        if not flows:
            return "No flows found"
        lines = [f"Total flows: {len(flows)}"]
        # Groupe par device
        by_device: dict = {}
        for f in flows:
            dev = f.get("deviceId", "unknown")[-4:]
            by_device.setdefault(dev, []).append(f)
        for dev, dflows in by_device.items():
            lines.append(f"\nDevice ...{dev}: {len(dflows)} flows")
            for f in dflows[:5]:  # Max 5 par device
                lines.append(
                    f"  [{f.get('priority','?')}] "
                    f"{f.get('state','?')} "
                    f"table:{f.get('tableId','?')}"
                )
        return "\n".join(lines)

    elif cmd == "topology":
        return (
            f"Devices:  {data.get('deviceCount', 0)}\n"
            f"Links:    {data.get('linkCount', 0)}\n"
            f"Clusters: {data.get('clusterCount', 0)}\n"
            f"Hosts:    {data.get('hostCount', 0)}"
        )

    elif cmd == "stats":
        stats = data.get("statistics", [])
        if not stats:
            return "No statistics available"
        lines = [f"{'Device':<45} {'Port':<6} {'RX Bytes':<15} {'TX Bytes'}"]
        lines.append("-" * 80)
        for s in stats:
            dev = s.get("device", "")
            for p in s.get("ports", []):
                lines.append(
                    f"{dev:<45} {str(p.get('port','')):<6} "
                    f"{str(p.get('bytesReceived',0)):<15} "
                    f"{str(p.get('bytesSent',0))}"
                )
        return "\n".join(lines)

    else:
        import json
        return json.dumps(data, indent=2)


# ── Routes ────────────────────────────────────────────────────

@router.post("/ssh")
async def exec_ssh_command(
    body: dict,
    current_user: Annotated[User, RequireAdminOrManager],
):
    """Exécute une commande SSH sur la VM Linux."""
    command = body.get("command", "").strip()
    if not command:
        raise HTTPException(status_code=400, detail="Command required")

    if not _is_allowed(command):
        raise HTTPException(
            status_code=403,
            detail=f"Command not allowed. Allowed: {', '.join(SSH_ALLOWED_PREFIXES[:5])}..."
        )

    result = await _exec_ssh(command)

    # Historique
    user_id = str(current_user.id)
    _cli_history.setdefault(user_id, []).append({
        "type": "ssh",
        "command": command,
        "output": result["output"][:500],
        "success": result["success"],
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })
    # Garde les 50 dernières commandes
    _cli_history[user_id] = _cli_history[user_id][-50:]

    return {
        "command": command,
        "type": "ssh",
        "host": settings.VM_HOST,
        **result,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@router.post("/onos")
async def exec_onos_command(
    body: dict,
    current_user: Annotated[User, RequireAdminOrManager],
):
    """Exécute une commande ONOS via REST API."""
    command = body.get("command", "").strip()
    if not command:
        raise HTTPException(status_code=400, detail="Command required")

    result = await _exec_onos(command)

    user_id = str(current_user.id)
    _cli_history.setdefault(user_id, []).append({
        "type": "onos",
        "command": command,
        "output": result["output"][:500],
        "success": result["success"],
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })
    _cli_history[user_id] = _cli_history[user_id][-50:]

    return {
        "command": command,
        "type": "onos",
        **result,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/history")
async def get_history(current_user: CurrentUser):
    """Historique des commandes."""
    user_id = str(current_user.id)
    return {"history": list(reversed(_cli_history.get(user_id, [])))}


@router.delete("/history")
async def clear_history(current_user: CurrentUser):
    """Efface l'historique."""
    user_id = str(current_user.id)
    _cli_history.pop(user_id, None)
    return {"message": "History cleared"}