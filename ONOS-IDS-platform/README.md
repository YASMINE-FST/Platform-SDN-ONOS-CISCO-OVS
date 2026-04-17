# NetGuard SOC — ONOS-IDS Platform

Plateforme SOC/SDN combinant un backend FastAPI, une base PostgreSQL et un frontend Next.js.
Elle supervise un reseau SDN pilote par ONOS: topologie, devices, ports, VLANs, alertes,
incidents SIEM, Threat Intel, vulnerabilites, MITRE ATT&CK et chatbot LLM.

- Backend: `FastAPI` + `PostgreSQL` (Docker)
- Frontend: `Next.js 16` + `React 19` (Node.js 20)
- Ports: frontend `3000`, backend `8000`, PostgreSQL `5433`

---

## 1. Prerequis

- Docker et Docker Compose
- Node.js 20 (via `nvm`)
- Un fichier `netguard-backend/.env` (voir section 5)
- Un fichier `netguard-frontend/.env.local` avec `NEXT_PUBLIC_API_URL=http://localhost:8000`

---

## 2. Demarrer la plateforme

### 2.1 Backend (API + base de donnees)

```bash
cd ~/Desktop/PLATFORM-SDN-FINAL/Platform-F/ONOS-IDS-platform/netguard-backend
docker compose up -d
```

Verifier:

```bash
curl http://localhost:8000/health
```

Reponse attendue: `{"status":"ok","service":"NetGuard SOC API",...}`

### 2.2 Frontend

```bash
export NVM_DIR="$HOME/.nvm" && . "$NVM_DIR/nvm.sh"
cd ~/Desktop/PLATFORM-SDN-FINAL/Platform-F/ONOS-IDS-platform/netguard-frontend
PATH=~/.nvm/versions/node/v20.20.2/bin:$PATH npm run dev
```

Acces: [http://localhost:3000](http://localhost:3000)

---

## 3. Arreter la plateforme

### 3.1 Arret propre du frontend

```bash
pkill -f "next dev" 2>/dev/null
pkill -f "next-server" 2>/dev/null
fuser -k 3000/tcp 2>/dev/null
```

### 3.2 Arret propre du backend

```bash
cd ~/Desktop/PLATFORM-SDN-FINAL/Platform-F/ONOS-IDS-platform/netguard-backend
docker compose down
```

### 3.3 Tout arreter en une seule commande

```bash
pkill -f "next dev" 2>/dev/null; pkill -f "next-server" 2>/dev/null; fuser -k 3000/tcp 2>/dev/null; \
cd ~/Desktop/PLATFORM-SDN-FINAL/Platform-F/ONOS-IDS-platform/netguard-backend && docker compose down
```

---

## 4. Redemarrer proprement (clean restart)

```bash
# 1) Arret complet
pkill -f "next dev" 2>/dev/null; pkill -f "next-server" 2>/dev/null
fuser -k 3000/tcp 2>/dev/null
cd ~/Desktop/PLATFORM-SDN-FINAL/Platform-F/ONOS-IDS-platform/netguard-backend && docker compose down

# 2) Relance backend
docker compose up -d

# 3) Relance frontend
cd ~/Desktop/PLATFORM-SDN-FINAL/Platform-F/ONOS-IDS-platform/netguard-frontend
PATH=~/.nvm/versions/node/v20.20.2/bin:$PATH npm run dev
```

---

## 5. Variables d'environnement

### 5.1 `netguard-backend/.env`

```env
POSTGRES_USER=netguard
POSTGRES_PASSWORD=netguard_secret
POSTGRES_DB=netguard

DATABASE_URL=postgresql+asyncpg://netguard:netguard_secret@localhost:5433/netguard
SECRET_KEY=change_this_secret_key_please
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7
MFA_ISSUER=NetGuard-SOC
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
MAX_LOGIN_ATTEMPTS=5

ONOS_URL=http://192.168.91.133:8181
ONOS_USER=onos
ONOS_PASSWORD=rocks

VM_HOST=192.168.91.133
VM_USER=wissal
VM_SSH_KEY_PATH=/app/ssh/netguard_key

IDS_URL=http://192.168.91.133:8000
ABUSEIPDB_API_KEY=
GROQ_API_KEY=
GROQ_MODEL=llama-3.3-70b-versatile
```

### 5.2 `netguard-frontend/.env.local`

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

---

## 6. Acces et URLs

| Service   | URL                                              |
| --------- | ------------------------------------------------ |
| Frontend  | <http://localhost:3000>                          |
| API       | <http://localhost:8000>                          |
| API docs  | <http://localhost:8000/docs>                     |
| Health    | <http://localhost:8000/health>                   |
| Postgres  | `localhost:5433` (user netguard)                 |

---

## 7. Diagnostic rapide

### 7.1 Verifier ce qui tourne

```bash
docker ps                                    # conteneurs backend + db
ss -tlnp | grep -E ':(3000|8000|5433)'      # ports ouverts
curl -s http://localhost:8000/health         # etat backend
```

### 7.2 Logs backend

```bash
docker logs netguard_api --tail 100
docker logs netguard_db  --tail 50
```

### 7.3 Erreur frontend "Network error"

Cause la plus frequente: le backend est down ou a crashe.

1. Verifier `curl http://localhost:8000/health`
2. Si KO, regarder `docker logs netguard_api`
3. Relancer: `docker compose restart api`

---

## 8. Creation du premier utilisateur admin

Sans admin, impossible de se connecter au frontend.

```bash
# 1) Generer un hash bcrypt
docker exec -it netguard_api python -c \
  "import bcrypt; print(bcrypt.hashpw(b'Admin@NetGuard1', bcrypt.gensalt()).decode())"

# 2) Inserer dans la base
docker exec -it netguard_db psql -U netguard -d netguard
```

```sql
INSERT INTO users (username, email, hashed_password, role,
                   is_active, is_locked, failed_attempts, mfa_enabled)
VALUES ('admin', 'admin@sdn.local', '<HASH_ICI>',
        'admin', TRUE, FALSE, 0, FALSE);
```

Connexion: `admin@sdn.local` / `Admin@NetGuard1`

---

## 9. Structure du projet

```text
ONOS-IDS-platform/
├── netguard-backend/        FastAPI + PostgreSQL
│   ├── app/                 code applicatif (routers, models, SIEM, TI)
│   ├── db/init.sql          schema initial
│   ├── docker-compose.yml   orchestration backend + db
│   ├── Dockerfile
│   └── .env                 variables backend
└── netguard-frontend/       Next.js 16
    ├── app/                 pages
    ├── components/          UI
    ├── lib/                 clients API
    └── .env.local           NEXT_PUBLIC_API_URL
```

---

## 10. Modules principaux

| Module         | Fonction                                                   |
| -------------- | ---------------------------------------------------------- |
| Dashboard      | synthese alertes, devices, flows, anomalies                |
| Topology       | topologie ONOS, path analysis, toggle de liens, export PDF |
| Metrics        | statistiques ports + export PDF                            |
| Devices        | inventaire et sync ONOS + toggle UP/DOWN des ports         |
| VPLS           | gestion VPLS (list/topology/audit/docs), historique DB     |
| OVS Config     | bridges, ports, VLAN, mirror SPAN, OpenFlow dump           |
| ONOS Apps      | liste + activation + bouton "Activate essentials"          |
| Config         | ports, VLANs, hosts                                        |
| CLI Terminal   | commandes ONOS et SSH autorisees                           |
| Alerts / SIEM  | alertes, correlation, incidents                            |
| Threat Intel   | enrichissement IP (AbuseIPDB, GreyNoise)                   |
| Vulnerability  | scan CVE + scores de risque                                |
| MITRE ATT&CK   | matrice, heatmap, timeline                                 |
| Network Flows  | analyse de flux et anomalies                               |
| SOC Chatbot    | assistant SOC via Groq LLM                                 |
| AI Detection   | passerelle vers service IDS/ML externe                     |
| Audit Trail    | logs, export JSON/CEF, rapport PDF                         |

---

## 11. Dependances externes

Obligatoires pour une experience complete:

- un controleur `ONOS` joignable sur `ONOS_URL`
- une VM Linux avec OVS/Mininet joignable en SSH
- une cle SSH valide dans `netguard-backend/ssh/netguard_key`

Optionnelles:

- `ABUSEIPDB_API_KEY` pour Threat Intel
- `GROQ_API_KEY` pour le chatbot
- un service IDS/ML sur `IDS_URL` pour AI Detection

---

## 12. Demo walkthrough

Scenario recommande (20 min) pour presenter la plateforme.

1. **Boot**
   - Lancer ONOS sur la VM (ou en local) — le backend active automatiquement
     `fwd`, `proxyarp`, `vpls`, `lldpprovider`, `hostprovider`, `netcfghostprovider`,
     `gui2` au demarrage (voir logs `docker logs netguard_api`).
   - `docker compose up -d` (backend) + `npm run dev` (frontend).
2. **Login** : admin@sdn.local / `Admin@NetGuard1`.
3. **Dashboard** : synthese temps reel + navigation a gauche.
4. **ONOS Apps** : bouton "Activate essentials" pour re-jouer l'activation si besoin.
5. **Topology** : vue graphique + bouton Export PDF pour livrable.
6. **Devices** :
   - syncer l'inventaire depuis ONOS,
   - ouvrir le panneau d'un switch, basculer UP/DOWN un port (utilise `POST /devices/by-onos/{id}/ports/{port}/state`).
7. **OVS Config** (menu Network -> OVS Config) :
   - onglet **Bridges** : create `br0`, attacher controller `tcp:127.0.0.1:6653`,
   - onglet **Ports & VLAN** : add port `eth1` avec VLAN 10,
   - onglet **Port Mirror** : creer un mirror `mirror0` pour SPAN,
   - onglet **OpenFlow Dump** : `ovs-ofctl dump-flows br0`,
   - onglet **History** : verifier que tout est persiste en base.
8. **VPLS** : creer un VPLS, ajouter une interface avec `connect point`,
   puis tester `GET /vpls/history`.
9. **Alerts / SIEM / MITRE** : regarder la correlation alertes -> incidents.
10. **Metrics / Audit** : export PDF des rapports.

---

## 13. Schema base de donnees (vue synthetique)

Les tables suivantes sont creees automatiquement au demarrage (via SQLAlchemy `create_all`):

| Table                | Role                                                           |
| -------------------- | -------------------------------------------------------------- |
| users, refresh_tokens| auth + JWT refresh                                             |
| audit_logs           | traces actions utilisateur (login, failed auth...)             |
| devices, flow_rules  | cache inventaire SDN + flows                                   |
| alerts, ai_detections| pipeline IDS / ML                                              |
| siem_rules, siem_events, incidents, incident_alerts | moteur SIEM            |
| threat_intel         | cache enrichissement IP (AbuseIPDB, etc.)                      |
| vulnerability_scans  | resultats scans CVE                                            |
| link_states          | toggles de liens (persistance topologie)                       |
| **device_configs**   | config ports/VLAN + **historique OVS** (`ovs:<br>`) + **VPLS** (`vpls:<name>`) |

Les actions OVS et VPLS sont persistees dans `device_configs` avec un `config_type`
explicite (`bridge_create`, `port_add`, `vlan_set`, `mirror_create`, `vpls_create`, etc.)
— consultables via `GET /ovs/history` et `GET /vpls/history`.

---

## 14. Limites connues

- pas d'admin seed: creation manuelle au premier demarrage (section 8)
- pas de regles SIEM seed: la table `siem_rules` est vide par defaut
- certains etats (sessions MFA, historique CLI, historique chatbot) sont en memoire
  et perdus au redemarrage du backend
- `docker-compose.yml` lance `uvicorn --reload`, configuration de dev
- pas de Dockerfile ni pipeline de deploiement pour le frontend
 