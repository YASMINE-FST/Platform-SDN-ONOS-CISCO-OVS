# Platform SDN — ONOS / Cisco / OVS

Plateforme de supervision SDN multi-vendor, construite autour du contrôleur **ONOS**,
permettant de gérer et monitorer des équipements **Cisco CSR1000V** (via NETCONF)
et des **Open vSwitch** (via OVSDB/OpenFlow) depuis une interface unifiée.

Projet de fin d'études (PFE) — supervision, configuration et terminal SSH intégré.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   Next.js Frontend (3000)                    │
│         Topology · Metrics · Cisco/OVS Config · SSH         │
└──────────────────────────┬──────────────────────────────────┘
                           │ REST + WebSocket
┌──────────────────────────▼──────────────────────────────────┐
│                FastAPI Backend (8000)                        │
│   devices · metrics · cisco · ovs · terminal · cli · ...    │
└───────┬──────────────────┬──────────────────┬───────────────┘
        │ REST             │ /csr/v1          │ OVSDB/CLI
┌───────▼────────┐ ┌───────▼──────────┐ ┌─────▼──────────────┐
│  ONOS (8181)   │ │ CSRManager (ONOS │ │ Open vSwitch       │
│  REST + gNMI   │ │   Java app)      │ │                    │
└────────────────┘ └───────┬──────────┘ └────────────────────┘
                           │ NETCONF
                   ┌───────▼──────────┐
                   │ Cisco CSR1000V   │
                   └──────────────────┘
```

### Composants

| Dossier                       | Rôle                                                  |
| ----------------------------- | ----------------------------------------------------- |
| `APP-ONOS-CISCO/csrmanager/`  | App ONOS Java (Maven) — bridge NETCONF vers Cisco CSR |
| `ONOS-IDS-platform/netguard-backend/`  | API FastAPI (Python 3.11+)                   |
| `ONOS-IDS-platform/netguard-frontend/` | Dashboard Next.js 16 / React 19             |
| `Auto-Connection/`            | Scripts d'auto-déploiement (connection helper)        |

---

## Quickstart

### Prérequis

- Docker + Docker Compose
- Node 20+ (frontend local)
- Python 3.11+ (backend local)
- Java 11 + Maven (uniquement pour recompiler l'app ONOS)

### Démarrage rapide (Docker)

```bash
cd ONOS-IDS-platform
docker compose up -d
```

Services :
- Frontend : <http://localhost:3000>
- Backend  : <http://localhost:8000/docs>
- Postgres : localhost:5433

### Démarrage manuel

```bash
# Backend
cd ONOS-IDS-platform/netguard-backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# Frontend
cd ONOS-IDS-platform/netguard-frontend
npm install
npm run dev
```

### ONOS + CSRManager

ONOS tourne en local (`localhost:8181`, user `onos/rocks`). Pour installer l'app CSR :

```bash
cd APP-ONOS-CISCO/csrmanager
mvn clean install -DskipTests
onos-app localhost install! target/csrmanager-1.0.0.oar
```

---

## Fonctionnalités (MVP)

**Core (fonctionnel)**
- Topologie temps réel (ONOS)
- Métriques (CPU, mémoire, interfaces)
- Inventaire des équipements
- Configuration Cisco CSR (interfaces, routage, logs)
- Configuration OVS (bridges, ports, VLAN, mirrors, OpenFlow dump)
- Terminal SSH interactif (Cisco, Ubuntu VM, ONOS Karaf)

**Beta / désactivé** (à l'état d'ébauche dans le sidebar)
- SIEM · MITRE ATT&CK · Threat Intel · Vulnerability
- AI Detection · Network Flows · VPLS · SOC Chatbot
- Alerts

---

## Auth

JWT avec refresh tokens (sessionStorage côté client). Rôles : `admin`, `manager`, `viewer`.
Les actions de configuration (Cisco/OVS) exigent `admin` ou `manager`.

---

## Stack

- **Frontend** : Next.js 16, React 19, Tailwind CSS, xterm.js, D3 (topologie)
- **Backend** : FastAPI, SQLAlchemy async, paramiko (SSH), httpx (ONOS REST)
- **Base** : PostgreSQL 16 (Docker)
- **Contrôleur** : ONOS 2.7+
- **Équipements cibles** : Cisco CSR1000V (IOS-XE), Open vSwitch 2.x+

---

## Licence

Projet académique — usage pédagogique.
