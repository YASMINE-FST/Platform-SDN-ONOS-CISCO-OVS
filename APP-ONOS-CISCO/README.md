# CsrManager — Application ONOS pour Cisco IOS-XE

**Projet :** ONOS-CISCO Platform
**Module :** `APP-ONOS / csrmanager`
**ONOS :** 2.7.0  ·  **Java :** 11  ·  **Maven :** 3.6+
**Routeur cible :** Cisco CSR1000V (IOS-XE 16.9.5) — `10.40.182.13:830`
**Bundle ID :** `org.onos.csrmanager`
**Catégorie ONOS GUI :** `Monitoring`
**Origin :** `YASMINE-KIRCH`
**Status actuel :** ✅ Fonctionnel — **19 / 19 endpoints OK** (voir `test_csrmanager_smoke.sh`)

---

## 1. Pourquoi cette application ?

Sans cette app, le dashboard Flask devait parler **directement** au routeur (RESTCONF + SSH).
Avec CsrManager installée dans ONOS, **toute** la communication passe par le SDN controller :

```
        Avant                                 Maintenant (cible)
┌────────┐    RESTCONF/SSH               ┌────────┐    REST           ┌──────────────┐    NETCONF      ┌─────────┐
│ Flask  │ ─────────────────► Cisco      │ Flask  │ ────────────►     │ ONOS         │ ──────────────► │ CSR1000V│
└────────┘                               └────────┘                   │ + CsrManager │                 └─────────┘
                                                                      └──────────────┘
```

Bénéfices :

- **ONOS = unique passerelle** vers tout équipement réseau (modèle SDN propre).
- API REST normalisée — un dashboard, plusieurs routeurs Cisco.
- Historique CPU et cache mémoire dans ONOS (pas dans le dashboard).
- Plus de credentials Cisco côté Flask : seul `onos:rocks` est utilisé.

---

## 2. Architecture interne du bundle

```
ONOS 2.7.0 (Apache Karaf 4.2.9 / OSGi)
└── org.onos.csrmanager   (.oar — Java 11)
    ├── AppComponent.java          @Component OSGi : démarrage, polling 30 s
    ├── CsrManagerService.java     interface du service exposé en OSGi
    ├── CsrNetconfSession.java     wrappeur autour de la session NETCONF d'ONOS
    │
    ├── collectors/
    │   ├── CsrMetricsCollector    CPU, mémoire, processus, interfaces, env, version
    │   ├── CsrRoutingCollector    routes (RIB), routes statiques, ARP, OSPF, BGP, CDP, NTP, DHCP
    │   └── CsrLogsCollector       syslog
    │
    ├── config/
    │   └── CsrConfigurator        edit-config NETCONF : hostname, interface, route statique, NTP
    │
    ├── store/
    │   └── MetricsStore           cache mémoire + ring buffer historique CPU (snapshot thread-safe)
    │
    ├── util/
    │   └── XmlParser              helpers DOM (parse + recherche namespace-agnostic
    │                              avec `descendants()` / `firstDescendant()`)
    │
    └── rest/
        ├── CsrApplication         JAX-RS Application (déclare CsrWebResource + JsonNodeBodyWriter)
        ├── CsrWebResource         endpoints REST sous /csr/v1/
        └── JsonNodeBodyWriter     ⚑ writer Jackson universel pour JsonNode
                                    (fix : ONOS ne sérialise nativement que ObjectNode)
```

**Web context :** `/csr/v1` (déclaré dans `pom.xml` → `<web.context>`).
URL réelle : `http://localhost:8181/csr/v1/...`

---

## 3. Fichiers du module

```
APP-ONOS/
├── README.md                                ← ce fichier
├── test_csrmanager_smoke.sh                 ← smoke test des 19 endpoints
└── csrmanager/
    ├── pom.xml                              ← Maven + onos-app plugin (.oar)
    └── src/
        ├── main/
        │   ├── java/org/onos/csrmanager/
        │   │   ├── AppComponent.java
        │   │   ├── CsrManagerService.java
        │   │   ├── CsrNetconfSession.java
        │   │   ├── collectors/{CsrMetricsCollector,CsrRoutingCollector,CsrLogsCollector}.java
        │   │   ├── config/CsrConfigurator.java
        │   │   ├── store/MetricsStore.java
        │   │   ├── util/XmlParser.java
        │   │   └── rest/{CsrApplication,CsrWebResource,JsonNodeBodyWriter}.java
        │   ├── resources/OSGI-INF/blueprint/shell-config.xml
        │   └── webapp/WEB-INF/web.xml
        └── test/java/org/onos/csrmanager/AppComponentTest.java
```

---

## 4. Build & déploiement

### Compiler le `.oar`

```bash
cd APP-ONOS/csrmanager
mvn clean package -DskipTests
ls target/csrmanager-1.0.0.oar
```

### Installer dans ONOS (REST)

```bash
curl -u onos:rocks \
     -X POST -H "Content-Type: application/octet-stream" \
     --data-binary @target/csrmanager-1.0.0.oar \
     "http://localhost:8181/onos/v1/applications?activate=true"
```

### Vérifier dans ONOS GUI

`http://localhost:8181/onos/ui` → onglet **Applications** :
section **Monitoring** → **CsrManager** par `YASMINE-KIRCH` doit apparaître **ACTIVE**.

### Cycle de re-déploiement

```bash
mvn clean package -DskipTests \
&& curl -u onos:rocks -X POST \
   -H "Content-Type: application/octet-stream" \
   --data-binary @target/csrmanager-1.0.0.oar \
   "http://localhost:8181/onos/v1/applications?activate=true"
```

---

## 5. Référence API REST

**Base URL :** `http://localhost:8181/csr/v1`
**Auth :** Basic `onos:rocks`
**Param commun :** `?device=netconf:10.40.182.13:830` (optionnel — auto-détecté si un seul device NETCONF)

### Endpoints de monitoring (GET)

| Endpoint               | Description                          | Forme du JSON renvoyé                                   |
|------------------------|--------------------------------------|---------------------------------------------------------|
| `GET /devices`         | Tous les routeurs NETCONF d'ONOS     | `[{device_id, ip, port, available, type, ...}]`         |
| `GET /health`          | Disponibilité de la session NETCONF  | `{device_id, available}`                                |
| `GET /cpu`             | Utilisation CPU instantanée          | `{five_seconds, one_minute, five_minutes}`              |
| `GET /cpu/history`     | Historique CPU (ring buffer 120 pts) | `[{ts, five_seconds, one_minute, five_minutes}]`        |
| `GET /memory`          | Pools mémoire                        | `[{name, total, used, free, usage_percent}]`            |
| `GET /processes`       | Top processus RAM                    | `[{pid, name, holding, alloc, freed, net}]`             |
| `GET /environment`     | Capteurs (température, ventilateurs) | `[{name, location, state, current_reading, units}]`     |
| `GET /version`         | Hostname + version IOS-XE            | `{hostname, version}`                                   |
| `GET /interfaces`      | Configuration des interfaces         | `[{name, type, enabled, description, ip, ...}]`         |
| `GET /interfaces/oper` | État opérationnel + compteurs        | `[{name, oper_status, speed, stats:{in_octets,...}}]`   |
| `GET /routes`          | Table de routage (RIB)               | `[{destination, protocol, metric, next_hop}]`           |
| `GET /routes/static`   | Routes statiques configurées         | `[{prefix, mask, next_hop, distance}]`                  |
| `GET /arp`             | Table ARP                            | `[{ip, mac, interface, type}]`                          |
| `GET /ospf`            | OSPF opérationnel                    | `[{router_id, af, areas:[{area_id, neighbors}]}]`       |
| `GET /bgp`             | BGP RIB                              | `[{prefix, next_hop, metric, weight, best}]`            |
| `GET /cdp`             | Voisins CDP                          | `[{device_id, local_intf, platform, ip}]`               |
| `GET /ntp`             | Statut NTP + peers                   | `{synced, stratum, reference_time, peers:[...]}`        |
| `GET /dhcp`            | Pools DHCP                           | `[{pool_name, network, total, leased, usage_pct}]`      |
| `GET /logs?limit=N`    | Syslog (les N dernières lignes)      | `[{severity, facility, message, timestamp}]`            |

### Endpoints de configuration (PATCH / POST / DELETE)

| Endpoint                         | Body JSON                                                                  | Effet                  |
|----------------------------------|----------------------------------------------------------------------------|------------------------|
| `PATCH  /config/hostname`        | `{"hostname":"NomNouv"}`                                                   | Change le hostname     |
| `PATCH  /config/interface`       | `{"name":"GigabitEthernet1","description":"...","enabled":true}`           | Modifie une interface  |
| `POST   /config/routes/static`   | `{"prefix":"10.0.0.0","mask":"255.255.0.0","next_hop":"10.40.182.1"}`      | Ajoute une route       |
| `DELETE /config/routes/static`   | identique au POST                                                          | Supprime la route      |
| `PATCH  /config/ntp`             | `{"server":"pool.ntp.org"}`                                                | Configure serveur NTP  |

---

## 6. Smoke test (19 endpoints)

```bash
cd APP-ONOS
bash test_csrmanager_smoke.sh
```

Sortie attendue (état actuel) :

```
[PASS] app-status         http://localhost:8181/onos/v1/applications/org.onos.csrmanager
[PASS] devices            http://localhost:8181/csr/v1/devices
[PASS] health             http://localhost:8181/csr/v1/health
[PASS] cpu                http://localhost:8181/csr/v1/cpu
[PASS] memory             http://localhost:8181/csr/v1/memory
[PASS] version            http://localhost:8181/csr/v1/version
[PASS] interfaces         http://localhost:8181/csr/v1/interfaces
[PASS] interfaces-oper    http://localhost:8181/csr/v1/interfaces/oper
[PASS] routes             http://localhost:8181/csr/v1/routes
[PASS] arp                http://localhost:8181/csr/v1/arp
[PASS] ospf               http://localhost:8181/csr/v1/ospf
[PASS] bgp                http://localhost:8181/csr/v1/bgp
[PASS] cdp                http://localhost:8181/csr/v1/cdp
[PASS] ntp                http://localhost:8181/csr/v1/ntp
[PASS] dhcp               http://localhost:8181/csr/v1/dhcp
[PASS] processes          http://localhost:8181/csr/v1/processes
[PASS] environment        http://localhost:8181/csr/v1/environment
[PASS] logs               http://localhost:8181/csr/v1/logs?limit=10
[PASS] cpu-history        http://localhost:8181/csr/v1/cpu/history

Summary: 19 passed, 0 failed
```

---

## 7. Modèles YANG utilisés

| Métrique          | YANG Module                              | Namespace                                                          |
|-------------------|------------------------------------------|--------------------------------------------------------------------|
| CPU               | `Cisco-IOS-XE-process-cpu-oper`          | `http://cisco.com/ns/yang/Cisco-IOS-XE-process-cpu-oper`           |
| Mémoire           | `Cisco-IOS-XE-memory-oper`               | `http://cisco.com/ns/yang/Cisco-IOS-XE-memory-oper`                |
| Processus         | `Cisco-IOS-XE-process-memory-oper`       | `http://cisco.com/ns/yang/Cisco-IOS-XE-process-memory-oper`        |
| Interfaces (cfg)  | `ietf-interfaces`                        | `urn:ietf:params:xml:ns:yang:ietf-interfaces`                      |
| Interfaces (oper) | `Cisco-IOS-XE-interfaces-oper`           | `http://cisco.com/ns/yang/Cisco-IOS-XE-interfaces-oper`            |
| Routes (RIB)      | `ietf-routing`                           | `urn:ietf:params:xml:ns:yang:ietf-routing`                         |
| Routes statiques  | `Cisco-IOS-XE-native`                    | `http://cisco.com/ns/yang/Cisco-IOS-XE-native`                     |
| ARP               | `Cisco-IOS-XE-arp-oper`                  | `http://cisco.com/ns/yang/Cisco-IOS-XE-arp-oper`                   |
| OSPF              | `Cisco-IOS-XE-ospf-oper`                 | `http://cisco.com/ns/yang/Cisco-IOS-XE-ospf-oper`                  |
| BGP               | `Cisco-IOS-XE-bgp-oper`                  | `http://cisco.com/ns/yang/Cisco-IOS-XE-bgp-oper`                   |
| CDP               | `Cisco-IOS-XE-cdp-oper`                  | `http://cisco.com/ns/yang/Cisco-IOS-XE-cdp-oper`                   |
| NTP               | `Cisco-IOS-XE-ntp-oper`                  | `http://cisco.com/ns/yang/Cisco-IOS-XE-ntp-oper`                   |
| Syslog            | `Cisco-IOS-XE-syslog-oper`               | `http://cisco.com/ns/yang/Cisco-IOS-XE-syslog-oper`                |
| Environnement     | `Cisco-IOS-XE-environment-oper`          | `http://cisco.com/ns/yang/Cisco-IOS-XE-environment-oper`           |
| DHCP              | `Cisco-IOS-XE-dhcp-oper`                 | `http://cisco.com/ns/yang/Cisco-IOS-XE-dhcp-oper`                  |

---

## 8. Notes de fixes (regression-proofing)

Les corrections clés intégrées dans cette version :

| Fix                                                                 | Cause / symptôme                                                                  |
|---------------------------------------------------------------------|-----------------------------------------------------------------------------------|
| `JsonNodeBodyWriter` ajouté + enregistré dans `CsrApplication`      | Le `JsonBodyWriter` natif d'ONOS n'accepte que `ObjectNode`; tout `ArrayNode` (devices, memory, interfaces, routes, arp, …) renvoyait **HTTP 500** |
| `XmlParser.descendants()` / `firstDescendant()`                     | Plusieurs collecteurs faisaient `firstElement(doc, ...)` (recherche globale) à l'intérieur d'une boucle et renvoyaient **les mêmes valeurs pour toutes les entrées** |
| `CsrRoutingCollector.getRoutes` — fix `r.toString()`                | Appelait `XmlParser.parse(r.toString())` (retournait le hash Java) → parsing silencieusement vide |
| `CsrRoutingCollector.getNtp` — null-guard sur `clock`               | NPE quand le routeur n'a pas de clock élément                                     |
| `MetricsStore.getCpuHistory()` — snapshot synchronisé               | `ConcurrentModificationException` quand le poller écrivait pendant qu'un client lisait |
| `pom.xml` — `category=Monitoring`, `origin=YASMINE-KIRCH`           | App rangée proprement dans la GUI ONOS                                            |

---

## 9. Logs & debug

```bash
# Logs ONOS
tail -f ~/onos/apache-karaf-4.2.9/data/log/karaf.log

# Filtrer CsrManager
tail -f ~/onos/apache-karaf-4.2.9/data/log/karaf.log | grep -i csrmanager

# Activer DEBUG depuis le CLI ONOS
ssh -p 8101 -o HostKeyAlgorithms=+ssh-rsa onos@localhost
onos> log:set DEBUG org.onos.csrmanager
```

Tester un RPC NETCONF directement :

```bash
ssh -p 830 cisco@10.40.182.13 \
    -o HostKeyAlgorithms=+ssh-rsa \
    -o KexAlgorithms=+diffie-hellman-group14-sha1 \
    -s netconf
```

---

## 10. Identifiants de référence

| Élément            | Valeur                                      |
|--------------------|---------------------------------------------|
| ONOS GUI / REST    | `http://localhost:8181/onos/ui` — `onos` / `rocks` |
| ONOS CLI           | `ssh -p 8101 -o HostKeyAlgorithms=+ssh-rsa onos@localhost` |
| Routeur Cisco      | `10.40.182.13` — `cisco` / `cisco123!`      |
| Device ID ONOS     | `netconf:10.40.182.13:830`                  |
| App ID ONOS        | `org.onos.csrmanager`                       |
| Base URL REST      | `http://localhost:8181/csr/v1`              |
| Catégorie GUI      | `Monitoring`                                |
| Origin GUI         | `YASMINE-KIRCH`                             |
