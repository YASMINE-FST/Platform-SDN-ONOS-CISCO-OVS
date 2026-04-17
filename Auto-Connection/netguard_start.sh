#!/bin/bash
# NetGuard — auto-register Cisco router(s) into ONOS and keep ports synced.
#
# Reads routers from netguard_config.json (sibling file), pushes the
# NETCONF device into ONOS via /onos/v1/network/configuration, then
# launches netguard_autodeploy.py for periodic port sync (every 60s).
set -e

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"
CONFIG="$SCRIPT_DIR/netguard_config.json"
ONOS_URL="http://localhost:8181"
ONOS_AUTH="onos:rocks"

echo "=== NetGuard Startup ==="

echo "[1/4] Waiting for ONOS on port 8181..."
until nc -z localhost 8181 2>/dev/null; do
    echo "  still waiting..."
    sleep 5
done
echo "  ONOS is up."

echo "[2/4] Activating required ONOS apps..."
for app in org.onosproject.netconf org.onosproject.drivers org.onosproject.drivers.netconf; do
    curl -s -X POST "$ONOS_URL/onos/v1/applications/$app/active" -u "$ONOS_AUTH" > /dev/null
    echo "  - $app"
done

echo "[3/4] Registering router(s) from $CONFIG..."
sleep 3
python3 - <<PYEOF
import json, requests
cfg = json.load(open("$CONFIG"))
onos = cfg["onos"]
for r in cfg["routers"]:
    dev_id = f"netconf:{r['ip']}:{r['port']}"
    payload = {"devices": {dev_id: {
        "netconf": {
            "ip": r["ip"], "port": r["port"],
            "username": r["username"], "password": r["password"],
            "connect-timeout": 30, "reply-timeout": 60, "idle-timeout": 300
        },
        "basic": {
            "driver": "netconf", "type": "ROUTER",
            "manufacturer": "Cisco",
            "hwVersion": r.get("hw","CSR1000V"),
            "swVersion": r.get("sw","IOS-XE")
        }}}}
    res = requests.post(f"{onos['url']}/onos/v1/network/configuration",
                        json=payload, auth=(onos["username"], onos["password"]))
    print(f"  -> {dev_id}: HTTP {res.status_code}")
PYEOF

echo "[4/4] Starting port-sync loop (netguard_autodeploy.py)..."
sleep 3
nohup python3 "$SCRIPT_DIR/netguard_autodeploy.py" \
      > "$SCRIPT_DIR/netguard_autodeploy.log" 2>&1 &
echo "  PID: $!"

sleep 8
DEVICES=$(curl -s -u "$ONOS_AUTH" "$ONOS_URL/onos/v1/devices" \
    | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('devices',[])))" 2>/dev/null || echo "?")
echo
echo "============================================================"
echo "  NetGuard ready — $DEVICES device(s) registered in ONOS"
echo "  Logs: tail -f $SCRIPT_DIR/netguard_autodeploy.log"
echo "============================================================"
