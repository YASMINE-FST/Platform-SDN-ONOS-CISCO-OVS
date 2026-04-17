
import paramiko, requests, time, json, re

import os
_BASE = os.path.dirname(os.path.abspath(__file__))
with open(os.path.join(_BASE, "netguard_config.json")) as f:
    CONFIG = json.load(f)

ONOS = CONFIG["onos"]
SYNC_INTERVAL = 60

def register_router(router):
    device_id = f"netconf:{router['ip']}:{router['port']}"
    payload = {
        "devices": {
            device_id: {
                "netconf": {
                    "ip": router["ip"],
                    "port": router["port"],
                    "username": router["username"],
                    "password": router["password"],
                    "connect-timeout": 30,
                    "reply-timeout": 60,
                    "idle-timeout": 300
                },
                "basic": {
                    "driver": "netconf",
                    "type": "ROUTER",
                    "manufacturer": "Cisco",
                    "hwVersion": router["hw"],
                    "swVersion": router["sw"]
                }
            }
        }
    }
    r = requests.post(
        f"{ONOS['url']}/onos/v1/network/configuration",
        json=payload,
        auth=(ONOS["username"], ONOS["password"]),
        headers={"Content-Type": "application/json"}
    )
    return r.status_code

def get_interfaces(router):
    try:
        ssh = paramiko.SSHClient()
        ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        ssh.connect(
            router["ip"], port=router["ssh_port"],
            username=router["username"], password=router["password"],
            look_for_keys=False, allow_agent=False, timeout=10
        )
        _, stdout, _ = ssh.exec_command("show ip interface brief")
        output = stdout.read().decode()
        ssh.close()
        interfaces = []
        port_num = 0
        valid_iface = re.compile(
            r'^(GigabitEthernet|FastEthernet|TenGigabitEthernet|Serial|Tunnel|Vlan|Ethernet)\S*',
            re.IGNORECASE
        )
        valid_ip = re.compile(r'^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$')
        for line in output.splitlines():
            parts = line.split()
            if len(parts) < 5:
                continue
            if not valid_iface.match(parts[0]):
                continue
            if "Loopback" in parts[0]:
                continue
            ip = parts[1] if valid_ip.match(parts[1]) else "unassigned"
            interfaces.append({
                "port_num": port_num,
                "name": parts[0],
                "ip": ip,
                "enabled": parts[4] == "up"
            })
            port_num += 1
        return interfaces
    except Exception as e:
        print(f"  SSH error {router['ip']}: {e}")
        return []

def push_ports(router, interfaces):
    device_id = f"netconf:{router['ip']}:{router['port']}"
    ports = {}
    for i in interfaces:
        ports[str(i["port_num"])] = {
            "speed": 1000,
            "enabled": i["enabled"],
            "number": i["port_num"],
            "type": "copper",
            "name": i["name"],
            "annotations": {"portName": i["name"], "ipAddress": i["ip"]}
        }
    r = requests.post(
        f"{ONOS['url']}/onos/v1/network/configuration",
        json={"devices": {device_id: {"ports": ports}}},
        auth=(ONOS["username"], ONOS["password"]),
        headers={"Content-Type": "application/json"}
    )
    return r.status_code

def is_online(router):
    device_id = f"netconf:{router['ip']}:{router['port']}"
    try:
        r = requests.get(
            f"{ONOS['url']}/onos/v1/devices/{device_id}",
            auth=(ONOS["username"], ONOS["password"])
        )
        return r.status_code == 200 and r.json().get("available", False)
    except:
        return False

print("=" * 50)
print(f"  NetGuard Auto-Deploy — {len(CONFIG['routers'])} routeur(s)")
print("=" * 50)

print("\n[INIT] Enregistrement initial...")
for router in CONFIG["routers"]:
    s = register_router(router)
    print(f"  {router['ip']}: {'OK' if s in [200,207] else 'ERREUR'} ({s})")

time.sleep(5)

while True:
    print(f"\n[{time.strftime('%H:%M:%S')}] Sync {len(CONFIG['routers'])} routeur(s)...")
    for router in CONFIG["routers"]:
        print(f"  -> {router['ip']}")
        if not is_online(router):
            print("     Re-enregistrement...")
            register_router(router)
            time.sleep(3)
        ifaces = get_interfaces(router)
        if ifaces:
            s = push_ports(router, ifaces)
            print(f"     Ports: {[i['name'] for i in ifaces]} -> ONOS OK")
        else:
            print("     Aucune interface")
    time.sleep(SYNC_INTERVAL)
