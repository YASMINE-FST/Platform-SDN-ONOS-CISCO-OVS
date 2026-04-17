#!/usr/bin/env python3
"""
================================================================================
 LABORATOIRE SDN — DHCP OPTION 43 POUR DÉCOUVERTE DU CONTRÔLEUR ONOS
================================================================================

 OBJECTIF DU LAB:
 ─────────────────
 Démontrer comment un switch OpenFlow peut découvrir automatiquement
 l'adresse IP du contrôleur SDN (ONOS) grâce au DHCP Option 43.

 CONCEPT DHCP OPTION 43 — EXPLICATION:
 ───────────────────────────────────────
 Normalement, quand on configure un switch OpenFlow, il faut lui indiquer
 manuellement l'adresse du contrôleur SDN (ex: ovs-vsctl set-controller ...).

 Avec le DHCP Option 43 (Vendor Specific Information), le serveur DHCP
 peut envoyer automatiquement cette information à n'importe quel équipement
 qui fait une requête DHCP. Ainsi:

   1. Le switch démarre et envoie un DHCP DISCOVER (broadcast)
   2. Le serveur DHCP répond avec un DHCP OFFER contenant:
        - Une adresse IP pour le switch
        - L'Option 43 = "tcp:172.18.0.1:6653" (adresse du contrôleur ONOS)
   3. Le switch reçoit l'Option 43 et se connecte automatiquement à ONOS
   4. ONOS découvre le switch sans configuration manuelle !

 POURQUOI C'EST UTILE ?
 ───────────────────────
 Dans un vrai réseau avec des centaines de switches, configurer manuellement
 l'adresse du contrôleur sur chaque switch serait impossible. Le DHCP Option 43
 permet un déploiement "zero-touch" : les switches se configurent tout seuls.

 ARCHITECTURE DU LAB:
 ─────────────────────
                    ┌─────────────────────────┐
                    │    CONTRÔLEUR ONOS      │
                    │    172.18.0.1:6653      │
                    │  (tourne dans Docker)   │
                    └────────────┬────────────┘
                                 │ OpenFlow 1.3
                                 │ (les switches se connectent ici)
                    ─────────────────────────────
                         RÉSEAU MININET (virtuel)
                    ─────────────────────────────
                                 │
                              ┌──┴──┐
                              │ s1  │  Switch central
                              └──┬──┘
                    ┌────────────┼────────────┐
                 ┌──┴──┐     ┌──┴──┐     ┌──┴──┐     ┌──┴──┐
                 │ s2  │     │ s3  │     │ s4  │     │ s5  │
                 └──┬──┘     └──┬──┘     └──┬──┘     └──┬──┘
               h1,h2         h3,h4       h5,h6          h7

                    ┌─────────────────────┐
                    │  d (Serveur DHCP)   │  connecté a s1
                    │  IP: 10.0.0.254     │  donne les IPs aux hosts
                    │  Option 43: ONOS    │  ET l'adresse du controleur
                    └─────────────────────┘

 FLUX DU LAB (etape par etape):
 ────────────────────────────────
  [1] Mininet cree 5 switches OVS + 8 hosts (7 clients + 1 serveur DHCP)
  [2] Le serveur DHCP (dnsmasq) demarre sur le host 'd' avec Option 43
  [3] Chaque host client envoie un DHCP DISCOVER
  [4] dnsmasq repond avec une IP + Option 43 contenant l'IP d'ONOS
  [5] Les switches OVS sont configures pour contacter ONOS
  [6] ONOS voit apparaitre les 5 switches et les 7 hosts
  [7] pingall fonctionne grace aux flow rules installees par ONOS (fwd app)

 TECHNOLOGIES UTILISEES:
 ────────────────────────
  Mininet     : emulateur de reseau SDN
  OVS         : Open vSwitch (implementation switch OpenFlow)
  OpenFlow 1.3: protocole entre switch et controleur SDN
  ONOS        : controleur SDN (Open Network Operating System)
  dnsmasq     : serveur DHCP leger qui supporte Option 43
  dhclient    : client DHCP sur chaque host

================================================================================
"""

from mininet.topo import Topo
from mininet.net import Mininet
from mininet.node import RemoteController, OVSSwitch
from mininet.cli import CLI
from mininet.log import setLogLevel, info
from mininet.link import TCLink
import time


# ══════════════════════════════════════════════════════════════════════════════
# CONFIGURATION GLOBALE
# ══════════════════════════════════════════════════════════════════════════════
# Ces variables centralisent toute la configuration du lab.
# Si tu changes l'IP d'ONOS ou le port, modifie uniquement ici.

ONOS_IP          = '172.18.0.1'   # IP du controleur ONOS (dans Docker)
ONOS_PORT        = 6653            # Port OpenFlow standard (6653 = OF1.3)
DHCP_SERVER_IP   = '10.0.0.254'   # IP statique du serveur DHCP
DHCP_RANGE_START = '10.0.0.100'   # Debut du pool DHCP pour les clients
DHCP_RANGE_END   = '10.0.0.200'   # Fin du pool DHCP pour les clients
DHCP_LEASE_TIME  = '600s'         # Duree du bail DHCP (10 minutes)


# ══════════════════════════════════════════════════════════════════════════════
# CLASSE : Switch OpenFlow 1.3
# ══════════════════════════════════════════════════════════════════════════════

class OVSSwitch13(OVSSwitch):
    """
    Switch OVS force en OpenFlow 1.3.

    POURQUOI OpenFlow 1.3 ?
    ───────────────────────
    ONOS supporte plusieurs versions d'OpenFlow, mais la version 1.3 est
    recommandee car elle apporte des fonctionnalites importantes comme:
      - Les groupes de flux (group tables)
      - Les metres (rate limiting)
      - Le pipeline multi-tables

    Sans cette classe, Mininet utiliserait OpenFlow 1.0 par defaut,
    ce qui causerait des problemes de compatibilite avec ONOS.
    """
    def __init__(self, name, **params):
        # On appelle le constructeur parent en ajoutant le protocole OF1.3
        OVSSwitch.__init__(self, name, protocols='OpenFlow13', **params)


# ══════════════════════════════════════════════════════════════════════════════
# CLASSE : Definition de la topologie
# ══════════════════════════════════════════════════════════════════════════════

class TopoWithDHCP(Topo):
    """
    Topologie maillee avec 5 switches, 7 clients DHCP et 1 serveur DHCP.

    STRUCTURE DE LA TOPOLOGIE:
    ───────────────────────────
    - s1 est le switch central (hub de la topologie)
    - s2, s3, s4, s5 sont connectes a s1 (etoile)
    - Des liens supplementaires creent une maille (redondance)
    - Le serveur DHCP 'd' est connecte a s1
    - Les clients sont repartis: h1,h2->s2 | h3,h4->s3 | h5,h6->s4 | h7->s5

    POURQUOI UNE TOPOLOGIE MAILLEE ?
    ─────────────────────────────────
    La maille cree des boucles reseau, ce qui permet de tester:
      - Le Spanning Tree Protocol (STP) gere par ONOS
      - La redondance des chemins
      - La capacite d'ONOS a choisir le meilleur chemin
    """

    def build(self, bandwidth=100, delay='2ms'):
        """
        Construit la topologie.

        Parametres des liens (link_opts):
          - bw=100    : bande passante de 100 Mbps sur chaque lien
          - delay=2ms : delai de propagation de 2ms (simule un vrai reseau)
          - use_htb   : utilise HTB (Hierarchical Token Bucket) pour la QoS
        """
        link_opts = dict(bw=bandwidth, delay=delay, use_htb=True)

        # ── Creation des 5 switches ──────────────────────────────────────────
        # addSwitch() cree un switch OVS virtuel dans Mininet
        # Le nom (s1, s2...) sera utilise comme identifiant dans ONOS
        switches = []
        for i in range(1, 6):
            s = self.addSwitch(f's{i}')
            switches.append(s)
        # Resultat: switches[0]=s1, switches[1]=s2, ..., switches[4]=s5

        # ── Creation du serveur DHCP ─────────────────────────────────────────
        # ip=None car on configurera l'IP manuellement en mode statique
        # Le host 'd' aura l'IP fixe 10.0.0.254 (definie dans setup_dhcp_server)
        dhcp_server = self.addHost('d', ip=None)

        # ── Creation des 7 clients DHCP ──────────────────────────────────────
        # ip=None car ils recevront leur IP automatiquement via DHCP
        # C'est le coeur du lab : ces hosts obtiennent tout via DHCP Option 43
        clients = []
        for i in range(1, 8):
            client = self.addHost(f'h{i}', ip=None)
            clients.append(client)

        # ── Liens entre switches (topologie maillee) ─────────────────────────
        # Premier niveau : s1 connecte a tous (topologie en etoile)
        for i in range(2, 6):
            self.addLink(switches[0], switches[i-1], **link_opts)
            # Cree: s1-s2, s1-s3, s1-s4, s1-s5

        # Deuxieme niveau : liens entre switches peripheriques (maille)
        # Ces liens creent des boucles -> ONOS/STP doit les gerer
        self.addLink(switches[1], switches[2], **link_opts)  # s2-s3
        self.addLink(switches[2], switches[3], **link_opts)  # s3-s4
        self.addLink(switches[3], switches[4], **link_opts)  # s4-s5
        self.addLink(switches[4], switches[1], **link_opts)  # s5-s2
        self.addLink(switches[1], switches[3], **link_opts)  # s2-s4
        self.addLink(switches[2], switches[4], **link_opts)  # s3-s5

        # ── Connexion des hosts aux switches ─────────────────────────────────
        # Le serveur DHCP est sur s1 (switch central)
        # Ainsi il peut repondre aux DISCOVER de tous les clients
        self.addLink(dhcp_server, switches[0], **link_opts)   # d  -> s1

        # Clients repartis sur les switches peripheriques
        self.addLink(clients[0],  switches[1], **link_opts)   # h1 -> s2
        self.addLink(clients[1],  switches[1], **link_opts)   # h2 -> s2
        self.addLink(clients[2],  switches[2], **link_opts)   # h3 -> s3
        self.addLink(clients[3],  switches[2], **link_opts)   # h4 -> s3
        self.addLink(clients[4],  switches[3], **link_opts)   # h5 -> s4
        self.addLink(clients[5],  switches[3], **link_opts)   # h6 -> s4
        self.addLink(clients[6],  switches[4], **link_opts)   # h7 -> s5


# ══════════════════════════════════════════════════════════════════════════════
# FONCTION : Configuration du serveur DHCP avec Option 43
# ══════════════════════════════════════════════════════════════════════════════

def setup_dhcp_server(host):
    """
    Configure et demarre dnsmasq sur le host 'd' en tant que serveur DHCP.

    C'EST LA FONCTION CLE DU LAB — OPTION 43 EXPLIQUEE:
    ─────────────────────────────────────────────────────
    Le DHCP Option 43 (RFC 2132) permet au serveur DHCP d'envoyer des
    informations specifiques au fournisseur (vendor-specific) a ses clients.

    Dans le contexte SDN/OpenFlow:
      - L'Option 43 contient l'adresse du controleur: "tcp:172.18.0.1:6653"
      - Quand un switch OVS recoit cette option, il sait ou trouver ONOS
      - Le switch etablit alors automatiquement la connexion OpenFlow

    Format de l'Option 43 pour OVS/ONOS:
      "tcp:<IP_ONOS>:<PORT_ONOS>"
      exemple: "tcp:172.18.0.1:6653"

    ECHANGE DHCP COMPLET AVEC OPTION 43:
    ─────────────────────────────────────
    Client                          Serveur DHCP (dnsmasq)
       |                                   |
       |--- DHCP DISCOVER (broadcast) ---->|  "Je cherche un serveur DHCP"
       |                                   |
       |<-- DHCP OFFER --------------------|  "Voici l'IP 10.0.0.102
       |    + Option 43: tcp:172.18.0.1:6653   ET l'adresse du controleur"
       |                                   |
       |--- DHCP REQUEST ----------------->|  "Je veux bien cette IP"
       |                                   |
       |<-- DHCP ACK ----------------------|  "C'est confirme !"
       |                                   |
    bound to 10.0.0.102              Bail enregistre
    Option 43 recu = adresse ONOS

    CONFIGURATION dnsmasq:
    ──────────────────────
    dnsmasq est un serveur DHCP/DNS leger tres utilise en reseau.
    Les options configurees:
      - dhcp-range   : plage d'IP a distribuer (.100 a .200)
      - dhcp-option=1: masque de sous-reseau (255.255.255.0 = /24)
      - dhcp-option=3: passerelle par defaut (le serveur DHCP lui-meme)
      - dhcp-option=6: serveur DNS (8.8.8.8 = Google DNS)
      - dhcp-option=43: NOTRE OPTION CLE -> adresse du controleur ONOS
    """
    info("\n" + "─"*55 + "\n")
    info("ETAPE CLE: CONFIGURATION SERVEUR DHCP + OPTION 43\n")
    info("─"*55 + "\n")

    iface = f'{host.name}-eth0'  # Interface reseau du serveur DHCP

    # ── Assignation de l'IP statique au serveur DHCP ─────────────────────────
    # Le serveur DHCP doit avoir une IP fixe pour pouvoir repondre aux clients
    # On vide d'abord l'interface puis on assigne 10.0.0.254
    host.cmd(f'ip addr flush dev {iface} 2>/dev/null')
    host.cmd(f'ip addr add {DHCP_SERVER_IP}/24 dev {iface}')
    host.cmd(f'ip link set {iface} up')
    info(f"   OK IP statique assignee au serveur: {DHCP_SERVER_IP}/24\n")

    # ── Construction de la chaine Option 43 ──────────────────────────────────
    # C'est la valeur qui sera envoyee dans chaque reponse DHCP
    # Le client (switch ou host) lira cette valeur pour connaitre ONOS
    onos_str = f"tcp:{ONOS_IP}:{ONOS_PORT}"
    info(f"   OPTION 43 = '{onos_str}'\n")
    info(f"   -> Chaque client DHCP recevra l'adresse d'ONOS\n")

    # ── Fichier de configuration dnsmasq ─────────────────────────────────────
    # Chaque ligne est une directive dnsmasq
    config_lines = [
        f"interface={iface}",
        # Ecouter uniquement sur cette interface (pas sur lo ou eth0 du systeme)

        f"bind-interfaces",
        # Ne pas ecouter sur d'autres interfaces

        f"dhcp-range={DHCP_RANGE_START},{DHCP_RANGE_END},255.255.255.0,{DHCP_LEASE_TIME}",
        # Distribuer des IPs de 10.0.0.100 a 10.0.0.200
        # Masque /24 (255.255.255.0), bail de 10 minutes

        f"dhcp-option=1,255.255.255.0",
        # Option 1 = Subnet Mask envoye au client

        f"dhcp-option=3,{DHCP_SERVER_IP}",
        # Option 3 = Default Gateway (passerelle par defaut)
        # On met l'IP du serveur DHCP lui-meme comme gateway

        f"dhcp-option=6,8.8.8.8",
        # Option 6 = DNS Server (Google DNS pour la resolution externe)

        f"dhcp-option=43,{onos_str}",
        # *** OPTION 43 = VENDOR SPECIFIC INFORMATION ***
        # C'est l'option cle de ce lab !
        # Elle envoie "tcp:172.18.0.1:6653" a chaque client
        # Un switch compatible OpenFlow lira cette option
        # et se connectera automatiquement au controleur ONOS

        f"log-queries",
        # Logger toutes les requetes DNS dans /tmp/dnsmasq.log

        f"log-dhcp",
        # Logger tous les echanges DHCP (DISCOVER, OFFER, REQUEST, ACK)
    ]

    # Ecriture du fichier de config ligne par ligne
    # (methode plus fiable que le heredoc dans Mininet)
    host.cmd('rm -f /tmp/dnsmasq.conf')
    for line in config_lines:
        host.cmd(f"echo '{line}' >> /tmp/dnsmasq.conf")

    # ── Demarrage de dnsmasq ──────────────────────────────────────────────────
    # On tue toute instance precedente pour eviter les conflits sur le port 67
    host.cmd('pkill -9 dnsmasq 2>/dev/null; sleep 1')
    # Demarrage en arriere-plan, tous les logs dans /tmp/dnsmasq.log
    host.cmd('dnsmasq -C /tmp/dnsmasq.conf --no-daemon > /tmp/dnsmasq.log 2>&1 &')

    info(f"   OK dnsmasq demarre (port 67 UDP)\n")
    info(f"   Pool: {DHCP_RANGE_START} a {DHCP_RANGE_END}\n")
    info(f"   Option 43 (ONOS): {onos_str}\n")
    info(f"   Logs: tail -f /tmp/dnsmasq.log\n")
    info("\n")

    # Attendre que dnsmasq soit bien demarre avant de lancer les clients
    time.sleep(3)


# ══════════════════════════════════════════════════════════════════════════════
# FONCTION : Demarrage des clients DHCP
# ══════════════════════════════════════════════════════════════════════════════

def setup_dhcp_clients(hosts):
    """
    Lance le client DHCP (dhclient) sur chaque host client.

    PROCESSUS DHCP EN 4 ETAPES (DORA):
    ────────────────────────────────────
    1. DISCOVER : le client envoie un broadcast sur 255.255.255.255:67
                  "Est-ce qu'il y a un serveur DHCP ici ?"
    2. OFFER    : dnsmasq repond avec une IP + Option 43 (adresse ONOS)
    3. REQUEST  : le client confirme qu'il veut cette IP
    4. ACK      : le serveur confirme -> l'IP est assignee (bound)

    Dans les logs dhclient on voit:
      DHCPDISCOVER on h1-eth0 to 255.255.255.255 port 67
      DHCPOFFER of 10.0.0.102 from 10.0.0.254
      DHCPREQUEST for 10.0.0.102 on h1-eth0
      DHCPACK of 10.0.0.102 from 10.0.0.254
      bound to 10.0.0.102  <- IP assignee avec succes

    POURQUOI UN TIMEOUT DE 20 SECONDES ?
    ──────────────────────────────────────
    Dans un reseau avec des boucles (topologie maillee), le STP doit d'abord
    bloquer les ports redondants avant que le trafic puisse circuler.
    Ce processus prend environ 15 secondes. Si on lance dhclient trop tot,
    les DISCOVER se perdent en boucle et les clients n'ont pas d'IP.
    Le timeout de 20s garantit que le STP est stabilise avant DHCP.
    """
    info("─"*55 + "\n")
    info("ETAPE: DEMARRAGE CLIENTS DHCP (processus DORA)\n")
    info("─"*55 + "\n")

    # ── Lancement parallele de tous les clients ───────────────────────────────
    # On lance tous les dhclient en meme temps (&) pour gagner du temps
    # Chaque client enverra son propre DHCP DISCOVER
    for host in hosts:
        iface = f'{host.name}-eth0'
        # Vider l'ancienne config IP si elle existe
        host.cmd(f'ip addr flush dev {iface} 2>/dev/null')
        # Lancer dhclient en arriere-plan (-v = verbose pour les logs)
        host.cmd(f'dhclient -v {iface} > /tmp/dhclient_{host.name}.log 2>&1 &')
        info(f"   {host.name}: DHCP DISCOVER envoye...\n")

    # ── Attente du processus DHCP ─────────────────────────────────────────────
    # 20 secondes pour laisser le temps au STP de converger ET au DHCP de finir
    info(f"\n   Attente 20s (STP convergence + echange DHCP)...\n")
    time.sleep(20)

    # ── Verification et relance si necessaire ────────────────────────────────
    # Certains hosts peuvent rater le premier DHCP a cause du STP
    # On relance dhclient de facon synchrone (sans &) pour les hosts sans IP
    info("\n   Verification - relance si IP manquante...\n")
    for host in hosts:
        iface = f'{host.name}-eth0'
        # Lire l'IP actuelle de l'interface
        ip = host.cmd(
            f'ip addr show {iface} | grep "inet " | awk \'{{print $2}}\' | cut -d/ -f1'
        ).strip()

        if not ip or len(ip) < 7:
            # Pas d'IP -> relancer dhclient en mode synchrone (sans &)
            # Cette fois on attend la reponse avant de continuer
            info(f"   RELANCE: {host.name} sans IP -> nouveau dhclient...\n")
            host.cmd(f'pkill dhclient 2>/dev/null; sleep 1')
            host.cmd(f'dhclient {iface} > /tmp/dhclient_{host.name}_retry.log 2>&1')
            time.sleep(8)
            ip = host.cmd(
                f'ip addr show {iface} | grep "inet " | awk \'{{print $2}}\' | cut -d/ -f1'
            ).strip()

        if ip and len(ip) > 6:
            info(f"   OK {host.name}: IP obtenue via DHCP -> {ip}\n")
        else:
            info(f"   ECHEC {host.name}: pas d'IP (verifier dnsmasq)\n")

    info("\n")


# ══════════════════════════════════════════════════════════════════════════════
# FONCTION : Configuration /etc/hosts pour resolution de noms
# ══════════════════════════════════════════════════════════════════════════════

def configure_hosts_etc_hosts(hosts, dhcp_server_ip):
    """
    Remplit /etc/hosts sur chaque host avec les IPs de tous les autres.

    POURQUOI CETTE FONCTION EST NECESSAIRE:
    ─────────────────────────────────────────
    Quand Mininet execute 'pingall', il utilise les noms des hosts (h1, h2...)
    pour construire les commandes ping. Mais ces noms ne sont pas resolus
    automatiquement car il n'y a pas de vrai serveur DNS dans ce lab.

    Sans cette fonction:
      ping h7 -> "ping: h7: Temporary failure in name resolution" ECHEC

    Avec cette fonction:
      /etc/hosts contient "10.0.0.108 h7"
      ping h7 -> resolu en 10.0.0.108 -> fonctionne OK

    On collecte d'abord les IPs de tous les hosts, puis on les ecrit
    dans /etc/hosts de chaque host. Ainsi chaque host connait l'IP
    de tous ses voisins -> pingall fonctionne par nom ET par IP.

    On ajoute aussi une route par defaut sur chaque host pour que
    le trafic soit route correctement vers la passerelle (serveur DHCP).
    """
    info("─"*55 + "\n")
    info("ETAPE: CONFIGURATION /etc/hosts (resolution de noms)\n")
    info("─"*55 + "\n")

    # ── Collecte des IPs de tous les hosts ───────────────────────────────────
    host_ips = {}

    # Le serveur DHCP a une IP statique connue d'avance
    host_ips['d'] = dhcp_server_ip

    # Pour les clients, on lit leur IP depuis leur interface reseau
    for host in hosts:
        iface = f'{host.name}-eth0'
        ip = host.cmd(
            f'ip addr show {iface} | grep "inet " | awk \'{{print $2}}\' | cut -d/ -f1'
        ).strip()
        if ip and len(ip) > 6:
            host_ips[host.name] = ip
        else:
            info(f"   ATTENTION: {host.name} sans IP, ignore dans /etc/hosts\n")

    info(f"   IPs collectees: {host_ips}\n\n")

    # ── Ecriture dans /etc/hosts de chaque host ───────────────────────────────
    for host in hosts:
        # Supprimer les anciennes entrees 10.0.0.x pour eviter les doublons
        host.cmd("sed -i '/^10\\.0\\.0\\./d' /etc/hosts 2>/dev/null")

        # Ajouter chaque paire IP -> nom dans /etc/hosts
        # Format: "10.0.0.102 h1"
        for name, ip in host_ips.items():
            host.cmd(f"echo '{ip} {name}' >> /etc/hosts")

        # Ajouter une route par defaut via le serveur DHCP
        # Cela permet a chaque host d'avoir une passerelle valide
        # pour le trafic qui sort du reseau 10.0.0.0/24
        host.cmd(f'ip route add default via {dhcp_server_ip} 2>/dev/null || true')

    info("   OK /etc/hosts configure sur tous les hosts\n")
    info("   OK Route par defaut ajoutee (via 10.0.0.254)\n")
    info("   -> pingall par nom ET par IP va fonctionner\n\n")


# ══════════════════════════════════════════════════════════════════════════════
# FONCTION : Configuration des switches OVS vers ONOS
# ══════════════════════════════════════════════════════════════════════════════

def configure_switches(net):
    """
    Configure les switches OVS pour se connecter au controleur ONOS.

    NOTE IMPORTANTE SUR L'OPTION 43 ET LES SWITCHES OVS DANS MININET:
    ───────────────────────────────────────────────────────────────────
    Dans ce lab, les switches Mininet sont des processus OVS sur Linux,
    pas de vrais equipements physiques reseau.

    OVS sous Linux ne lit PAS automatiquement l'Option 43 DHCP pour
    configurer son controleur (contrairement aux vrais switches physiques
    comme Cisco, HP, etc. qui supportent cette fonctionnalite nativement).

    En PRODUCTION (vrais switches physiques compatibles OpenFlow):
      Etape 1: Switch demarre
      Etape 2: Switch envoie DHCP DISCOVER
      Etape 3: Serveur repond avec IP + Option 43 = "tcp:ONOS_IP:6653"
      Etape 4: Switch lit Option 43 -> se connecte AUTOMATIQUEMENT a ONOS
      Etape 5: ONOS voit le switch (zero configuration manuelle !)

    Dans notre EMULATION Mininet:
      - On DEMONTRE le concept Option 43 sur les HOSTS (h1 a h7)
      - Les hosts recoivent bien l'Option 43 via DHCP
      - On configure ensuite manuellement les switches OVS (cette fonction)
      - Resultat equivalent: ONOS voit les 5 switches et les 7 hosts

    FAIL-MODE SECURE:
    ─────────────────
    "fail-mode=secure" signifie que si le switch perd la connexion avec ONOS,
    il bloque tout le trafic (comportement SDN pur).
    Sans controleur = pas de trafic. C'est la philosophie SDN :
    le switch est "stupide", il execute uniquement ce qu'ONOS lui dit de faire.
    """
    info("─"*55 + "\n")
    info("ETAPE: CONNEXION SWITCHES OVS -> CONTROLEUR ONOS\n")
    info("─"*55 + "\n")
    info(f"   Controleur cible: tcp:{ONOS_IP}:{ONOS_PORT}\n\n")

    # Configurer chaque switch pour pointer vers ONOS
    for switch in net.switches:
        # Definir le controleur OpenFlow du switch
        # ovs-vsctl set-controller = commande OVS pour definir le controleur
        switch.cmd(f'ovs-vsctl set-controller {switch.name} tcp:{ONOS_IP}:{ONOS_PORT}')

        # Activer le mode securise: sans ONOS = tout bloque
        switch.cmd(f'ovs-vsctl set bridge {switch.name} fail-mode=secure')

        info(f"   {switch.name} -> tcp:{ONOS_IP}:{ONOS_PORT} [fail-mode=secure]\n")

    # Attendre qu'ONOS etablisse les sessions OpenFlow avec les switches
    # ONOS doit: detecter le switch, negocier OF1.3, installer les flows de base
    info(f"\n   Attente 8s (negociation OpenFlow avec ONOS)...\n")
    time.sleep(8)

    # ── Verification des connexions ───────────────────────────────────────────
    info("\n   VERIFICATION CONNEXIONS OPENFLOW:\n")
    connected = 0
    for switch in net.switches:
        # ovs-vsctl show affiche "is_connected: true" si le switch est
        # bien connecte au controleur ONOS via le protocole OpenFlow
        status = switch.cmd('ovs-vsctl show')
        if "is_connected: true" in status:
            info(f"   OK {switch.name} -> CONNECTE a ONOS\n")
            connected += 1
        else:
            info(f"   ECHEC {switch.name} -> NON CONNECTE (verifier ONOS)\n")

    info(f"\n   Resultat: {connected}/{len(net.switches)} switches connectes\n\n")


# ══════════════════════════════════════════════════════════════════════════════
# FONCTION : Affichage du recapitulatif final
# ══════════════════════════════════════════════════════════════════════════════

def show_final_status(hosts, dhcp_server):
    """
    Affiche un tableau recapitulatif de tous les hosts et leur IP.
    Permet de verifier d'un coup d'oeil que tout est bien configure.
    """
    info("\n")
    info("╔" + "═"*55 + "╗\n")
    info("║" + "         RECAPITULATIF FINAL".center(55) + "║\n")
    info("╚" + "═"*55 + "╝\n\n")

    info(f"   {'HOST':<8} {'IP ASSIGNEE':<20} {'SOURCE'}\n")
    info(f"   {'─'*8} {'─'*20} {'─'*20}\n")

    # Ligne pour le serveur DHCP (IP statique)
    info(f"   {'d':<8} {DHCP_SERVER_IP:<20} Statique (serveur DHCP)\n")

    # Lignes pour les clients (IP obtenue via DHCP + Option 43)
    all_ok = True
    for host in hosts:
        iface = f'{host.name}-eth0'
        ip = host.cmd(
            f'ip addr show {iface} | grep "inet " | awk \'{{print $2}}\' | cut -d/ -f1'
        ).strip()
        if ip and len(ip) > 6:
            info(f"   {host.name:<8} {ip:<20} DHCP + Option 43\n")
        else:
            info(f"   {host.name:<8} {'N/A':<20} ECHEC DHCP\n")
            all_ok = False

    if all_ok:
        info("\n   SUCCES: Tous les hosts ont leur IP via DHCP !\n")
        info("   Option 43 transmise: tcp:" + ONOS_IP + ":" + str(ONOS_PORT) + "\n")
        info("   -> Verifier dans ONOS: onos> hosts\n")
    else:
        info("\n   ATTENTION: certains hosts sans IP\n")
        info("   Commande: mininet> hX dhclient hX-eth0\n")
    info("\n")


# ══════════════════════════════════════════════════════════════════════════════
# FONCTION PRINCIPALE : Orchestration complete du lab
# ══════════════════════════════════════════════════════════════════════════════

def run_topology():
    """
    Fonction principale qui orchestre toutes les etapes du lab.

    ORDRE D'EXECUTION ET LOGIQUE:
    ──────────────────────────────
    1. Creer la topologie Mininet (switches + hosts + liens)
    2. Demarrer le reseau (les processus OVS sont lances)
    3. Configurer le serveur DHCP avec Option 43   <- ETAPE CLE
    4. Lancer les clients DHCP (ils recoivent IP + Option 43)
    5. Configurer /etc/hosts pour la resolution de noms
    6. Connecter les switches OVS a ONOS
    7. Afficher le statut final
    8. Ouvrir le CLI Mininet pour les tests interactifs
    """
    info("\n")
    info("╔" + "═"*55 + "╗\n")
    info("║" + "  LAB SDN: DHCP OPTION 43 -> CONTROLEUR ONOS  ".center(55) + "║\n")
    info("╚" + "═"*55 + "╝\n\n")
    info(f"   Objectif: decouverte automatique d'ONOS via DHCP Option 43\n\n")
    info(f"   ONOS:         tcp:{ONOS_IP}:{ONOS_PORT}\n")
    info(f"   Serveur DHCP: {DHCP_SERVER_IP}\n")
    info(f"   Pool DHCP:    {DHCP_RANGE_START} -> {DHCP_RANGE_END}\n\n")

    # ── ETAPE 1 : Creation de la topologie ───────────────────────────────────
    info("ETAPE 1: Creation de la topologie Mininet...\n")
    topo = TopoWithDHCP()

    # ── ETAPE 2 : Creation du reseau Mininet ─────────────────────────────────
    # RemoteController : pointe vers ONOS deja lance dans Docker
    # OVSSwitch13      : switches avec OpenFlow 1.3 (compatible ONOS)
    # TCLink           : liens avec controle de bande passante et delai
    # autoSetMacs      : adresses MAC auto (00:00:00:00:00:01, 02, etc.)
    # waitConnected    : attendre que tous les switches soient connectes
    net = Mininet(
        topo=topo,
        controller=lambda name: RemoteController(name, ip=ONOS_IP, port=ONOS_PORT),
        switch=OVSSwitch13,
        link=TCLink,
        autoSetMacs=True,
        waitConnected=True
    )

    # ── ETAPE 3 : Demarrage du reseau ─────────────────────────────────────────
    net.start()
    info("\n   OK Reseau Mininet demarre\n\n")

    # Recuperer les references des hosts par leur nom
    dhcp_server = net.get('d')                          # Le serveur DHCP
    clients = [net.get(f'h{i}') for i in range(1, 8)]  # Les 7 clients

    # ── ETAPE 4 : Serveur DHCP avec Option 43 ────────────────────────────────
    # C'est ici qu'on configure l'Option 43 = adresse ONOS
    # Apres cette etape, dnsmasq est pret a repondre aux DISCOVER
    setup_dhcp_server(dhcp_server)

    # ── ETAPE 5 : Clients DHCP ───────────────────────────────────────────────
    # Les hosts envoient DISCOVER et recoivent IP + Option 43
    # Apres cette etape, chaque host a une IP dans 10.0.0.100-200
    setup_dhcp_clients(clients)

    # ── ETAPE 6 : Resolution de noms ─────────────────────────────────────────
    # Permet pingall par nom (h1 ping h7) et non seulement par IP
    # Ajoute aussi les routes par defaut sur chaque host
    configure_hosts_etc_hosts(clients, DHCP_SERVER_IP)

    # ── ETAPE 7 : Connexion switches -> ONOS ─────────────────────────────────
    # Configure OVS et verifie que ONOS voit bien les 5 switches
    configure_switches(net)

    # ── ETAPE 8 : Affichage du recapitulatif ─────────────────────────────────
    show_final_status(clients, dhcp_server)

    # ── Instructions pour utiliser le CLI ────────────────────────────────────
    info("╔" + "═"*55 + "╗\n")
    info("║" + "         MININET CLI - COMMANDES UTILES".center(55) + "║\n")
    info("╚" + "═"*55 + "╝\n\n")
    info("   TESTS DE CONNECTIVITE:\n")
    info("   mininet> pingall                  <- tester tous les hosts\n")
    info("   mininet> h1 ping h7 -c 3          <- ping h1 vers h7 par nom\n")
    info("   mininet> h1 ping 10.0.0.108 -c 3  <- ping par IP directe\n\n")
    info("   DIAGNOSTICS DHCP (verifier Option 43):\n")
    info("   mininet> d cat /tmp/dnsmasq.log   <- logs serveur DHCP\n")
    info("   mininet> h1 cat /tmp/dhclient_h1.log <- logs client DHCP h1\n")
    info("   mininet> h2 dhclient h2-eth0      <- relancer DHCP sur h2\n\n")
    info("   INFOS RESEAU:\n")
    info("   mininet> h1 ifconfig              <- voir IP de h1\n")
    info("   mininet> h1 cat /etc/hosts        <- voir la table de noms\n")
    info("   mininet> sh ovs-vsctl show        <- statut connexion ONOS\n")
    info("   mininet> iperf h1 h7              <- test bande passante\n\n")
    info("   DANS ONOS (autre terminal):\n")
    info("   onos> devices   <- voir les 5 switches connectes\n")
    info("   onos> hosts     <- voir les 7 hosts avec IPs DHCP\n")
    info("   onos> flows     <- voir les flow rules (installes par fwd)\n")
    info("   onos> links     <- voir les liens entre switches\n\n")
    info("   mininet> exit   <- quitter le lab\n")
    info("═"*57 + "\n\n")

    # ── Ouverture du CLI Mininet interactif ───────────────────────────────────
    CLI(net)

    # ── Nettoyage propre a la sortie ─────────────────────────────────────────
    info("\n   Nettoyage en cours...\n")
    dhcp_server.cmd('pkill -9 dnsmasq 2>/dev/null')  # Arreter serveur DHCP
    for host in clients:
        host.cmd('pkill -9 dhclient 2>/dev/null')    # Arreter clients DHCP
    net.stop()                                        # Arreter Mininet
    info("   OK Lab termine proprement.\n")


# ══════════════════════════════════════════════════════════════════════════════
# POINT D'ENTREE DU SCRIPT
# ══════════════════════════════════════════════════════════════════════════════

if __name__ == '__main__':
    # setLogLevel('info') affiche les messages info() de Mininet dans le terminal
    # Autres niveaux disponibles:
    #   'debug'   -> tres verbeux (tout afficher, utile pour debug)
    #   'warning' -> peu verbeux (seulement les erreurs importantes)
    #   'info'    -> niveau normal (recommande pour ce lab)
    setLogLevel('info')
    run_topology()
