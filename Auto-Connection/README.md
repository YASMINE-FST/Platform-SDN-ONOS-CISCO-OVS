# Guide ONOS + Cisco CSR1kv — Commandes Essentielles

**Environnement :**
- ONOS : `localhost:8181`
- Routeur Cisco CSR1000V : `192.168.1.11` (VM)
- Utilisateur routeur : `cisco` / `cisco123!`

---

## 1. ONOS — Démarrage & Arrêt

```bash
su - sdn 
#password : onos 
cd ~/onos

# Arrêter ONOS
./bin/onos-service stop

# Démarrer ONOS
sleep 10
./bin/onos-service start

# Vérifier que ONOS est actif (port 8181)
nc -z localhost 8181 && echo "ONOS UP" || echo "ONOS DOWN"
```

---

## 2. ONOS — Accès UI & CLI

**Interface Web :**
```
http://localhost:8181/onos/ui
Utilisateur : onos
Mot de passe : rocks
```

**CLI SSH :**
```bash
ssh -p 8101 -o HostKeyAlgorithms=+ssh-rsa -o PubkeyAcceptedAlgorithms=+ssh-rsa onos@localhost
# Mot de passe : rocks
```

---

## 3. Routeur Cisco — Accès SSH

```bash
ssh cisco@192.168.1.11
# Mot de passe : cisco123!
```

---

## 4. Vérification de l'Environnement

### Routeur Cisco accessible ?
```bash
# Ping
ping -c 3 192.168.1.11

# SSH
ssh cisco@192.168.1.11

# NETCONF (port 830)
nc -zv 192.168.1.11 830
```

### ONOS actif ?
```bash
curl -s -u onos:rocks http://localhost:8181/onos/v1/applications | python3 -m json.tool | head -20
```

### NetGuard (Python) actif ?
```bash
pgrep -a -f netguard_autodeploy.py && echo "NetGuard EN COURS" || echo "NetGuard ARRÊTÉ"
```

---

## 5. Configuration NETCONF sur le Routeur Cisco (IOS-XE)

A faire une seule fois sur le routeur :

```
enable
configure terminal
netconf-yang
aaa new-model
aaa authentication login default local
username cisco privilege 15 password cisco123!
end
```

Vérifier que NETCONF est actif :
```
show netconf-yang status
```

---

## 6. NetGuard — Démarrage, Arrêt & Logs

### Démarrer NetGuard
```bash
cd /home/yasmine/Desktop/ONOS-CISCO/ONOS-CISCO/Auto-Connection
bash netguard_start.sh
```

### Arrêter NetGuard
```bash
pkill -f netguard_autodeploy.py
```

### Vérifier l'état de NetGuard
```bash
pgrep -a -f netguard_autodeploy.py
```

### Suivre les logs en temps réel
```bash
tail -f /home/yasmine/Desktop/ONOS-CISCO/ONOS-CISCO/Auto-Connection/netguard_autodeploy.log
```

### Vider les logs
```bash
> /home/yasmine/Desktop/ONOS-CISCO/ONOS-CISCO/Auto-Connection/netguard_autodeploy.log
```

---

## 7. ONOS — Gestion des Devices

### Voir tous les devices (REST)
```bash
curl -s -u onos:rocks http://localhost:8181/onos/v1/devices | python3 -m json.tool
```

### Voir un device spécifique (REST)
```bash
curl -s -u onos:rocks "http://localhost:8181/onos/v1/devices/netconf:192.168.1.11:830" | python3 -m json.tool
```

### Voir tous les devices (CLI ONOS)
```
onos@root > devices
```

### Voir la configuration réseau (CLI ONOS)
```
onos@root > netcfg
```

---

## 8. ONOS — Ajouter un Device Manuellement

```bash
curl -X POST \
  http://localhost:8181/onos/v1/network/configuration \
  -H "Content-Type: application/json" \
  -u onos:rocks \
  -d '{
    "devices": {
      "netconf:192.168.1.11:830": {
        "netconf": {
          "ip": "192.168.1.11",
          "port": 830,
          "username": "cisco",
          "password": "cisco123!",
          "connect-timeout": 30,
          "reply-timeout": 60,
          "idle-timeout": 300
        },
        "basic": {
          "driver": "netconf",
          "type": "ROUTER",
          "manufacturer": "Cisco",
          "hwVersion": "CSR1000V",
          "swVersion": "IOS-XE"
        }
      }
    }
  }'
```

---

## 9. ONOS — Supprimer un Device

### Via CLI ONOS
```
onos@root > device-remove netconf:192.168.1.11:830
```

### Via REST — Supprimer un device spécifique
```bash
curl -s -X DELETE -u onos:rocks \
  "http://localhost:8181/onos/v1/devices/netconf:192.168.1.11:830"
```

### Via REST — Supprimer la config netcfg d'un device
```bash
curl -s -X DELETE -u onos:rocks \
  "http://localhost:8181/onos/v1/network/configuration/devices/netconf:192.168.1.11:830"
```

### Via REST — Supprimer TOUS les devices
```bash
curl -u onos:rocks -X DELETE \
  http://localhost:8181/onos/v1/network/configuration/devices
```

---

## 10. Procédure de Reset Complet

A faire quand les ports ou devices sont en cache et affichent des données incorrectes :

```bash
# 1. Supprimer le device du CLI ONOS
#    onos@root > device-remove netconf:192.168.1.11:830

# 2. Supprimer la config netcfg via REST
curl -s -X DELETE -u onos:rocks \
  "http://localhost:8181/onos/v1/network/configuration/devices/netconf:192.168.1.11:830"

# 3. Arrêter NetGuard
pkill -f netguard_autodeploy.py

# 4. Vider les logs
> /home/yasmine/Desktop/ONOS-CISCO/ONOS-CISCO/Auto-Connection/netguard_autodeploy.log

# 5. Attendre 5 secondes
sleep 5

# 6. Relancer NetGuard
cd /home/yasmine/Desktop/ONOS-CISCO/ONOS-CISCO/Auto-Connection
bash netguard_start.sh

# 7. Vérifier
curl -s -u onos:rocks http://localhost:8181/onos/v1/devices | python3 -m json.tool
```

---

## 11. Résumé — État du Système en Un Coup d'Oeil

```bash
echo "=== ONOS ===" && nc -z localhost 8181 && echo "UP" || echo "DOWN"
echo "=== NetGuard ===" && pgrep -a -f netguard_autodeploy.py || echo "ARRÊTÉ"
echo "=== Routeur Cisco ===" && ping -c 1 -W 2 192.168.1.11 && echo "ACCESSIBLE" || echo "INJOIGNABLE"
echo "=== Devices ONOS ===" && curl -s -u onos:rocks http://localhost:8181/onos/v1/devices | python3 -c "import sys,json; d=json.load(sys.stdin)['devices']; print(f'{len(d)} device(s): {[x[\"id\"] for x in d]}')"
```
