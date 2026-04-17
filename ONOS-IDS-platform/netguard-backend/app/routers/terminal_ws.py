"""
WebSocket interactive PTY sessions.

Endpoints:
  WS   /cli/ws/ubuntu              → interactive shell on the Linux VM
  WS   /cli/ws/onos                → SSH to ONOS Karaf (port 8101)

OVS configuration is exposed only through the ONOS REST API (see
`routers/config.py` and `routers/flows.py`). No raw OVS console is exposed.
"""

import asyncio
import json
from typing import Annotated, Optional
from uuid import UUID

import paramiko
from fastapi import APIRouter, HTTPException, Query, WebSocket, WebSocketDisconnect
from jose import JWTError
from sqlalchemy import select

from app.config import get_settings
from app.database import AsyncSessionLocal
from app.deps import CurrentUser
from app.models import User, UserRole
from app.security import decode_access_token

settings = get_settings()
router = APIRouter(prefix="/cli", tags=["cli"])


# ── Auth helper for WebSocket (token passed via query string) ─────────
async def _authenticate_ws(token: Optional[str]) -> Optional[User]:
    if not token:
        return None
    try:
        payload = decode_access_token(token)
        user_id = payload.get("sub")
        if not user_id:
            return None
    except JWTError:
        return None

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(User.id == UUID(user_id)))
        user = result.scalar_one_or_none()
        if user and user.is_active and not user.is_locked:
            return user
    return None


def _role_allowed(user: User) -> bool:
    return user.role in (UserRole.admin, UserRole.manager)


# ── List OVS bridges ──────────────────────────────────────────────────
@router.get("/ovs/bridges")
async def list_ovs_bridges(_: CurrentUser):
    """Return the list of OVS bridges on the VM via `sudo ovs-vsctl list-br`."""
    try:
        ssh = paramiko.SSHClient()
        ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        key = paramiko.Ed25519Key(filename=settings.VM_SSH_KEY_PATH)
        ssh.connect(
            hostname=settings.VM_HOST,
            username=settings.VM_USER,
            pkey=key,
            timeout=10,
        )
        _, stdout, _ = ssh.exec_command("sudo ovs-vsctl list-br", timeout=10)
        output = stdout.read().decode("utf-8", errors="replace").strip()
        ssh.close()

        bridges = [b.strip() for b in output.splitlines() if b.strip()]
        return {"bridges": bridges, "count": len(bridges)}
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"VM SSH error: {e}")


# ── PTY session runner ────────────────────────────────────────────────
async def _run_pty_session(
    websocket: WebSocket,
    *,
    host: str,
    port: int,
    username: str,
    password: Optional[str] = None,
    key_path: Optional[str] = None,
    banner: str = "",
    initial_commands: list[str] | None = None,
):
    """Bridge a paramiko interactive shell to a WebSocket."""
    loop = asyncio.get_running_loop()
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

    # Connect SSH on a worker thread (blocking)
    def _connect():
        if key_path:
            pkey = paramiko.Ed25519Key(filename=key_path)
            ssh.connect(hostname=host, port=port, username=username, pkey=pkey, timeout=15)
        else:
            ssh.connect(
                hostname=host, port=port, username=username, password=password,
                timeout=15, look_for_keys=False, allow_agent=False,
            )
        return ssh.invoke_shell(term="xterm-256color", width=120, height=32)

    try:
        channel = await loop.run_in_executor(None, _connect)
    except Exception as e:
        await websocket.send_text(f"\r\n\x1b[31m[connection error] {e}\x1b[0m\r\n")
        await websocket.close()
        return

    channel.settimeout(0.0)

    if banner:
        await websocket.send_text(banner)

    # Run initial commands (OVS helper banner, etc.)
    if initial_commands:
        for cmd in initial_commands:
            try:
                channel.send(cmd + "\n")
            except Exception:
                pass
            await asyncio.sleep(0.05)

    async def reader():
        """Read from SSH channel → send to WebSocket."""
        try:
            while True:
                if channel.closed or channel.exit_status_ready():
                    break
                if channel.recv_ready():
                    data = channel.recv(4096)
                    if not data:
                        break
                    await websocket.send_bytes(data)
                else:
                    await asyncio.sleep(0.02)
        except Exception:
            pass

    async def writer():
        """Read from WebSocket → send to SSH channel."""
        try:
            while True:
                msg = await websocket.receive()
                if msg.get("type") == "websocket.disconnect":
                    break
                if "bytes" in msg and msg["bytes"] is not None:
                    channel.send(msg["bytes"])
                elif "text" in msg and msg["text"] is not None:
                    text = msg["text"]
                    # Control messages: {"type":"resize","cols":N,"rows":N}
                    if text.startswith("{"):
                        try:
                            data = json.loads(text)
                            if data.get("type") == "resize":
                                cols = int(data.get("cols", 120))
                                rows = int(data.get("rows", 32))
                                channel.resize_pty(width=cols, height=rows)
                                continue
                        except Exception:
                            pass
                    channel.send(text)
        except WebSocketDisconnect:
            pass
        except Exception:
            pass

    try:
        await asyncio.gather(reader(), writer())
    finally:
        try:
            channel.close()
        except Exception:
            pass
        try:
            ssh.close()
        except Exception:
            pass


# ── Ubuntu VM shell ───────────────────────────────────────────────────
@router.websocket("/ws/ubuntu")
async def ws_ubuntu(websocket: WebSocket, token: Annotated[str | None, Query()] = None):
    await websocket.accept()
    user = await _authenticate_ws(token)
    if not user or not _role_allowed(user):
        await websocket.send_text("\r\n\x1b[31m[auth failed — admin/manager required]\x1b[0m\r\n")
        await websocket.close(code=4403)
        return

    banner = (
        "\x1b[36m╔════════════════════════════════════════════════╗\x1b[0m\r\n"
        f"\x1b[36m║  Ubuntu VM — {settings.VM_USER}@{settings.VM_HOST:<28}║\x1b[0m\r\n"
        "\x1b[36m╚════════════════════════════════════════════════╝\x1b[0m\r\n"
    )
    await _run_pty_session(
        websocket,
        host=settings.VM_HOST, port=22, username=settings.VM_USER,
        key_path=settings.VM_SSH_KEY_PATH, banner=banner,
    )


# ── ONOS Karaf shell ──────────────────────────────────────────────────
@router.websocket("/ws/onos")
async def ws_onos(websocket: WebSocket, token: Annotated[str | None, Query()] = None):
    await websocket.accept()
    user = await _authenticate_ws(token)
    if not user or not _role_allowed(user):
        await websocket.send_text("\r\n\x1b[31m[auth failed — admin/manager required]\x1b[0m\r\n")
        await websocket.close(code=4403)
        return

    # Extract ONOS host from ONOS_URL (http://192.168.91.133:8181 → 192.168.91.133)
    onos_host = settings.ONOS_URL.replace("http://", "").replace("https://", "").split(":")[0]

    banner = (
        "\x1b[36m╔════════════════════════════════════════════════╗\x1b[0m\r\n"
        f"\x1b[36m║  ONOS Karaf CLI — {onos_host:<28}║\x1b[0m\r\n"
        "\x1b[36m║  Type 'help' for commands, Ctrl+D to exit     ║\x1b[0m\r\n"
        "\x1b[36m╚════════════════════════════════════════════════╝\x1b[0m\r\n"
    )
    await _run_pty_session(
        websocket,
        host=onos_host, port=8101, username="karaf", password="karaf",
        banner=banner,
    )


# ── OVS bridge-scoped shell ───────────────────────────────────────────
@router.websocket("/ws/ovs")
async def ws_ovs(
    websocket: WebSocket,
    token: Annotated[str | None, Query()] = None,
    bridge: Annotated[str | None, Query()] = None,
):
    await websocket.accept()
    user = await _authenticate_ws(token)
    if not user or not _role_allowed(user):
        await websocket.send_text("\r\n\x1b[31m[auth failed — admin/manager required]\x1b[0m\r\n")
        await websocket.close(code=4403)
        return

    if not bridge or not bridge.replace("-", "").replace("_", "").isalnum():
        await websocket.send_text("\r\n\x1b[31m[bridge name required and must be alphanumeric]\x1b[0m\r\n")
        await websocket.close(code=4400)
        return

    banner = (
        "\x1b[36m╔════════════════════════════════════════════════════╗\x1b[0m\r\n"
        f"\x1b[36m║  OVS Console — bridge: \x1b[33m{bridge:<20}\x1b[36m        ║\x1b[0m\r\n"
        "\x1b[36m║  \x1b[0m\x1b[2m$BR is set to the bridge name\x1b[0m\x1b[36m                    ║\x1b[0m\r\n"
        "\x1b[36m║  \x1b[0m\x1b[2mTry: ovs-show, ovs-flows, ovs-ports, ovs-help\x1b[0m\x1b[36m   ║\x1b[0m\r\n"
        "\x1b[36m╚════════════════════════════════════════════════════╝\x1b[0m\r\n"
    )

    # Inject helper aliases at startup
    setup_cmds = [
        f"export BR={bridge}",
        "alias ovs-show='sudo ovs-vsctl show'",
        "alias ovs-flows='sudo ovs-ofctl -O OpenFlow13 dump-flows $BR'",
        "alias ovs-ports='sudo ovs-ofctl -O OpenFlow13 show $BR'",
        "alias ovs-stats='sudo ovs-ofctl -O OpenFlow13 dump-ports $BR'",
        "alias ovs-groups='sudo ovs-ofctl -O OpenFlow13 dump-groups $BR'",
        "alias ovs-help='echo \"ovs-show | ovs-flows | ovs-ports | ovs-stats | ovs-groups\"'",
        "clear && ovs-help",
    ]

    await _run_pty_session(
        websocket,
        host=settings.VM_HOST, port=22, username=settings.VM_USER,
        key_path=settings.VM_SSH_KEY_PATH, banner=banner,
        initial_commands=setup_cmds,
    )
