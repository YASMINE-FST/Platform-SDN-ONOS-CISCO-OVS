from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.config import get_settings
from app.database import engine, AsyncSessionLocal
from app.models import Base
from app.routers import (
    auth, users, devices, alerts, dashboard,
    topology, onos_apps, ai_detection,
    config, topology_links, siem, threat_intel,
    mitre, chatbot, audit, vulnerability, cli, flows,
    vpls, metrics, terminal_ws, ovs, cisco, cisco_terminal,
)
from app.siem.engine import SIEMEngine
from app.threat_intel.ti_engine import ThreatIntelEngine

settings = get_settings()
siem_engine = SIEMEngine(AsyncSessionLocal)
ti_engine = ThreatIntelEngine(AsyncSessionLocal)


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await siem_engine.start()
    await ti_engine.start()
    # Best-effort: activate essential ONOS apps at startup (non-blocking on failure).
    try:
        from app.routers.onos_apps import activate_essentials
        import logging
        result = await activate_essentials()
        logging.getLogger("uvicorn").info(
            "ONOS essential apps activation: %s", result
        )
    except Exception as e:
        import logging
        logging.getLogger("uvicorn").warning("ONOS auto-activation skipped: %s", e)
    yield
    await siem_engine.stop()
    await ti_engine.stop()
    await engine.dispose()


app = FastAPI(
    title="NetGuard SOC API",
    version="1.0.0",
    description="SDN Security Operations Center – FastAPI Backend",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(devices.router)
app.include_router(alerts.router)
app.include_router(dashboard.router)
app.include_router(topology.router)
app.include_router(onos_apps.router)
app.include_router(ai_detection.router)
app.include_router(config.router)
app.include_router(topology_links.router)
app.include_router(siem.router)
app.include_router(threat_intel.router)
app.include_router(mitre.router)
app.include_router(chatbot.router)
app.include_router(audit.router)
app.include_router(vulnerability.router)
app.include_router(cli.router)
app.include_router(flows.router)
app.include_router(vpls.router)
app.include_router(metrics.router)
app.include_router(terminal_ws.router)
app.include_router(ovs.router)
app.include_router(cisco.router)
app.include_router(cisco_terminal.router)

app.state.siem_engine = siem_engine
app.state.ti_engine = ti_engine


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "service": "NetGuard SOC API",
        "siem": "running" if siem_engine.running else "stopped",
        "ti": "running" if ti_engine.running else "stopped",
    }