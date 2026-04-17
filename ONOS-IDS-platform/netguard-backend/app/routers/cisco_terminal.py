"""
WebSocket SSH terminal for Cisco devices
Proxies SSH sessions through paramiko to Cisco CSR1000V devices
"""

import asyncio
import json
import logging
import socket
from typing import Optional
import paramiko

from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect, Query
from jose import JWTError
from sqlalchemy import select

from app.config import get_settings
from app.database import AsyncSessionLocal
from app.models import User, UserRole
from app.security import decode_access_token

settings = get_settings()
router = APIRouter(prefix="/api/cisco", tags=["cisco_terminal"])
logger = logging.getLogger(__name__)

# Cisco device SSH credentials (from environment or config)
CISCO_HOST = "192.168.1.1"  # Default - can be overridden via query param
CISCO_PORT = 22
CISCO_USER = "admin"
CISCO_PASSWORD = "cisco"


async def _authenticate_ws(token: Optional[str]) -> Optional[User]:
    """Authenticate WebSocket connection via JWT token"""
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
        from uuid import UUID
        result = await db.execute(select(User).where(User.id == UUID(user_id)))
        user = result.scalar_one_or_none()
        if user and user.is_active and not user.is_locked:
            return user
    return None


def _role_allowed(user: User) -> bool:
    """Check if user has permission to access Cisco terminal"""
    return user.role in (UserRole.admin, UserRole.manager)


async def _run_cisco_ssh_session(
    websocket: WebSocket,
    *,
    host: str,
    port: int = 22,
    username: str = CISCO_USER,
    password: str = CISCO_PASSWORD,
):
    """Bridge paramiko SSH session to WebSocket for Cisco device"""
    loop = asyncio.get_running_loop()
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

    # Connect SSH on a worker thread (blocking)
    def _connect():
        try:
            ssh.connect(
                hostname=host,
                port=port,
                username=username,
                password=password,
                timeout=15,
            )
            logger.info(f"SSH connected to Cisco device {host}:{port}")
            return True
        except Exception as e:
            logger.error(f"SSH connection failed: {e}")
            raise

    try:
        await loop.run_in_executor(None, _connect)
    except Exception as e:
        await websocket.send_json({"error": f"SSH connection failed: {str(e)}"})
        await websocket.close()
        return

    # Open interactive channel
    try:
        chan = ssh.invoke_shell(term="xterm", width=200, height=50)
    except Exception as e:
        await websocket.send_json({"error": f"Failed to open shell: {str(e)}"})
        await websocket.close()
        ssh.close()
        return

    chan.settimeout(1)

    # Message buffer for output
    output_buffer = ""

    try:
        # Read banner/welcome message
        await asyncio.sleep(0.2)
        try:
            banner = chan.recv(4096).decode("utf-8", errors="replace")
            if banner:
                await websocket.send_text(banner)
        except socket.timeout:
            pass

        # WebSocket event loop
        async def _receive_and_send():
            """Read from Cisco device and send to WebSocket"""
            while True:
                try:
                    data = await loop.run_in_executor(
                        None, chan.recv, 4096
                    )
                    if not data:
                        await websocket.send_json({"type": "closed"})
                        break
                    text = data.decode("utf-8", errors="replace")
                    await websocket.send_text(text)
                except socket.timeout:
                    await asyncio.sleep(0.05)
                except Exception as e:
                    logger.warning(f"Recv error: {e}")
                    break

        async def _receive_and_send_input():
            """Receive WebSocket input and send to Cisco device"""
            try:
                while True:
                    data = await websocket.receive_text()
                    # Handle special commands
                    if data.startswith("{") and data.endswith("}"):
                        try:
                            msg = json.loads(data)
                            if msg.get("type") == "resize":
                                cols = msg.get("cols", 200)
                                rows = msg.get("rows", 50)
                                chan.resize_pty(width=cols, height=rows)
                            elif msg.get("type") == "command":
                                cmd = msg.get("command", "")
                                chan.send(cmd + "\n")
                        except json.JSONDecodeError:
                            chan.send(data)
                    else:
                        chan.send(data)
            except WebSocketDisconnect:
                logger.info("WebSocket disconnected")
            except Exception as e:
                logger.warning(f"Send error: {e}")

        # Run both tasks concurrently
        recv_task = asyncio.create_task(_receive_and_send())
        send_task = asyncio.create_task(_receive_and_send_input())

        await asyncio.gather(recv_task, send_task)

    except WebSocketDisconnect:
        logger.info("WebSocket disconnected")
    except Exception as e:
        logger.error(f"Session error: {e}")
        try:
            await websocket.send_json({"error": str(e)})
        except Exception:
            pass
    finally:
        chan.close()
        ssh.close()
        await websocket.close()
        logger.info("SSH session closed")


@router.websocket("/terminal")
async def websocket_cisco_terminal(
    websocket: WebSocket,
    token: Optional[str] = Query(None),
    host: str = Query(CISCO_HOST),
    port: int = Query(CISCO_PORT),
    username: str = Query(CISCO_USER),
    password: str = Query(CISCO_PASSWORD),
):
    """
    WebSocket endpoint for interactive SSH terminal to Cisco device

    Usage:
      ws://localhost:8000/api/cisco/terminal?token=<jwt>&host=192.168.1.1&port=22&username=admin&password=cisco

    Send:
      - Text: raw commands (e.g., "show version\n")
      - JSON: {"type": "resize", "cols": 200, "rows": 50}
      - JSON: {"type": "command", "command": "show interfaces"}

    Receive:
      - Text: terminal output
      - JSON: {"error": "..."}
      - JSON: {"type": "closed"}
    """
    # Authenticate
    user = await _authenticate_ws(token)
    if not user or not _role_allowed(user):
        await websocket.close(code=403, reason="Unauthorized")
        return

    await websocket.accept()
    logger.info(f"User {user.username} connected to Cisco terminal {host}:{port}")

    # Run SSH session
    await _run_cisco_ssh_session(
        websocket,
        host=host,
        port=port,
        username=username,
        password=password,
    )
