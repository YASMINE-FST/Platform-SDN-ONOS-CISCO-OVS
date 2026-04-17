#!/usr/bin/env python3
"""
Looped Packet Topology - for STP testing and loop detection.
Creates a topology with intentional loops that STP must break.
Version corrigée pour fonctionner avec ONOS.
"""

from mininet.topo import Topo
from mininet.net import Mininet
from mininet.node import RemoteController, OVSSwitch
from mininet.cli import CLI
from mininet.log import setLogLevel, info
from mininet.link import TCLink
import sys


class OVSSwitch13(OVSSwitch):
    """OVS Switch forcé en OpenFlow 1.3 (NÉCESSAIRE POUR ONOS)"""
    def __init__(self, name, **params):
        OVSSwitch.__init__(self, name, protocols='OpenFlow13', **params)


class PktTopoWithLoop(Topo):
    """
    Triangle loop topology:
      h3- s1 --- s4 -h4
        /       /
       s2-----s3
       |      |
       h1     h2

    Also adds h3 directly to s1.
    """

    def build(self, bandwidth=100, delay='2ms'):
        link_opts = dict(bw=bandwidth, delay=delay, use_htb=True)

        s1 = self.addSwitch('s1')
        s2 = self.addSwitch('s2')
        s3 = self.addSwitch('s3')

        h1 = self.addHost('h1', ip='10.0.0.1/24')
        h2 = self.addHost('h2', ip='10.0.0.2/24')
        h3 = self.addHost('h3', ip='10.0.0.3/24')

        # Loop: s1-s2-s3-s1
        self.addLink(s2, s3, **link_opts)
        self.addLink(s3, s1, **link_opts)

        # Hosts
        self.addLink(h1, s2, **link_opts)
        self.addLink(h2, s3, **link_opts)
        self.addLink(h3, s1, **link_opts)


class MeshTopo(Topo):
    """
    Full mesh of 4 switches with multiple hosts.
    Tests complex STP scenarios and ML routing with multiple paths.
    """

    def build(self, bandwidth=100, delay='1ms'):
        link_opts = dict(bw=bandwidth, delay=delay, use_htb=True)

        switches = [self.addSwitch(f's{i}') for i in range(1, 5)]
        hosts = [self.addHost(f'h{i}', ip=f'10.0.0.{i}/24') for i in range(1, 5)]

        # Attach hosts
        for h, s in zip(hosts, switches):
            self.addLink(h, s, **link_opts)

        # Full mesh (creates many loops)
        for i in range(len(switches)):
            for j in range(i + 1, len(switches)):
                self.addLink(switches[i], switches[j], **link_opts)


def run_loop(controller_ip='172.18.0.1', controller_port=6653):
    """Version corrigée avec les bons paramètres pour ONOS"""
    info("\n" + "="*60 + "\n")
    info("🔄 TOPOLOGIE AVEC BOUCLE POUR TEST STP\n")
    info("   - Triangle: s1-s2-s3-s1\n")
    info(f"   - Contrôleur: {controller_ip}:{controller_port}\n")
    info("="*60 + "\n")
    
    topo = PktTopoWithLoop()
    net = Mininet(
        topo=topo,
        controller=lambda name: RemoteController(name, ip=controller_ip, port=controller_port),
        switch=OVSSwitch13,  # ← UTILISER OVSSwitch13 au lieu de OVSSwitch
        link=TCLink,
        autoSetMacs=True,
        waitConnected=True
    )
    
    net.start()
    info("\n✅ Réseau démarré\n")
    
    # Vérifier la connexion des switches à ONOS
    info("\n🔍 Vérification des connexions ONOS:\n")
    for switch in net.switches:
        result = switch.cmd('ovs-vsctl show')
        if "is_connected: true" in result:
            info(f"   ✅ {switch.name} CONNECTÉ à ONOS\n")
        else:
            info(f"   ❌ {switch.name} NON CONNECTÉ\n")
            info(f"      Vérifier que ONOS est bien démarré\n")
    
    info("\n" + "="*60 + "\n")
    info("🖥️  MININET CLI\n")
    info("Commandes à tester:\n")
    info("   mininet> pingall\n")
    info("   mininet> h1 ping h2\n")
    info("   mininet> h1 ping h3\n")
    info("   mininet> sh ovs-vsctl show\n")
    info("   mininet> dpctl dump-flows\n")
    info("="*60 + "\n")
    
    CLI(net)
    net.stop()
    info("\n✅ Test terminé\n")


def run_mesh(controller_ip='172.18.0.1', controller_port=6653):
    """Lance la topologie mesh avec ONOS"""
    info("\n" + "="*60 + "\n")
    info("🔗 TOPOLOGIE MAILLE COMPLÈTE\n")
    info("   - 4 switches en mesh complet\n")
    info(f"   - Contrôleur: {controller_ip}:{controller_port}\n")
    info("="*60 + "\n")
    
    topo = MeshTopo()
    net = Mininet(
        topo=topo,
        controller=lambda name: RemoteController(name, ip=controller_ip, port=controller_port),
        switch=OVSSwitch13,  # ← UTILISER OVSSwitch13
        link=TCLink,
        autoSetMacs=True,
        waitConnected=True
    )
    
    net.start()
    info("\n✅ Réseau démarré\n")
    
    # Vérifier la connexion
    for switch in net.switches:
        result = switch.cmd('ovs-vsctl show')
        if "is_connected: true" in result:
            info(f"   ✅ {switch.name} CONNECTÉ\n")
        else:
            info(f"   ❌ {switch.name} NON CONNECTÉ\n")
    
    CLI(net)
    net.stop()


if __name__ == '__main__':
    setLogLevel('info')
    
    # Par défaut, lance la topologie avec boucle
    # Change les paramètres si ton ONOS est sur une autre IP
    ONOS_IP = '172.18.0.1'  # IP du conteneur Docker ONOS
    ONOS_PORT = 6653
    
    # Tu peux choisir quelle topologie lancer
    # run_loop(ONOS_IP, ONOS_PORT)
    run_mesh(ONOS_IP, ONOS_PORT)  # ou run_loop()

# Pour pouvoir utiliser mn --custom
topos = {
    'loop': PktTopoWithLoop,
    'mesh': MeshTopo,
}
