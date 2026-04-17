package org.onos.csrmanager.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.onos.csrmanager.CsrNetconfSession;
import org.onosproject.net.DeviceId;
import org.onosproject.netconf.NetconfController;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Envoie des opérations NETCONF <edit-config> vers le routeur Cisco IOS-XE.
 *
 * Opérations supportées :
 *  - Hostname
 *  - Interface (description, état admin)
 *  - Routes statiques (ajout / suppression)
 *  - Serveur NTP
 *
 * Toutes les méthodes retournent :
 *   { "success": true }   ou   { "success": false, "error": "..." }
 *
 * ═══════════════════════════════════════════════════════════════════
 * IMPORTANT — Format edit-config NETCONF pour Cisco IOS-XE :
 *
 * On passe à session.editConfig() uniquement le contenu du <config>,
 * sans les balises <edit-config> ni <rpc> (ONOS les ajoute).
 *
 * Exemple :
 *   <config>
 *     <native xmlns="http://cisco.com/ns/yang/Cisco-IOS-XE-native">
 *       <hostname>MonRouteur</hostname>
 *     </native>
 *   </config>
 * ═══════════════════════════════════════════════════════════════════
 */
public class CsrConfigurator {

    private final Logger log = LoggerFactory.getLogger(getClass());
    private static final ObjectMapper MAPPER = new ObjectMapper();

    private final NetconfController controller;

    public CsrConfigurator(NetconfController controller) {
        this.controller = controller;
    }

    private CsrNetconfSession session(DeviceId id) {
        return new CsrNetconfSession(controller, id);
    }

    private ObjectNode ok() {
        return MAPPER.createObjectNode().put("success", true);
    }

    private ObjectNode fail(String reason) {
        log.warn("[CsrConfig] Échec : {}", reason);
        ObjectNode n = MAPPER.createObjectNode();
        n.put("success", false);
        n.put("error",   reason);
        return n;
    }

    // ── Hostname ─────────────────────────────────────────────────────
    // YANG : Cisco-IOS-XE-native:native/hostname

    /**
     * Modifie le hostname du routeur.
     *
     * Équivalent IOS : hostname <name>
     */
    public ObjectNode setHostname(DeviceId deviceId, String hostname) {
        if (hostname == null || hostname.isBlank())
            return fail("hostname ne peut pas être vide");

        String config =
            "<config>" +
            "  <native xmlns=\"http://cisco.com/ns/yang/Cisco-IOS-XE-native\">" +
            "    <hostname>" + escapeXml(hostname) + "</hostname>" +
            "  </native>" +
            "</config>";

        boolean ok = session(deviceId).editConfig(config);
        log.info("[CsrConfig] setHostname({}) → {}", hostname, ok ? "OK" : "FAIL");
        return ok ? ok() : fail("edit-config refusé par le routeur");
    }

    // ── Interface ────────────────────────────────────────────────────
    // YANG : ietf-interfaces:interfaces/interface

    /**
     * Modifie la description et/ou l'état admin d'une interface.
     *
     * Équivalent IOS :
     *   interface GigabitEthernet1
     *     description <desc>
     *     no shutdown  /  shutdown
     *
     * @param name        Nom exact de l'interface (ex: "GigabitEthernet1")
     * @param description Nouvelle description, ou null pour ne pas modifier
     * @param enabled     true=no shutdown, false=shutdown, null=ne pas modifier
     */
    public ObjectNode configureInterface(DeviceId deviceId, String name,
                                         String description, Boolean enabled) {
        if (name == null || name.isBlank())
            return fail("Le nom de l'interface est requis");

        StringBuilder iface = new StringBuilder();
        iface.append("<config>");
        iface.append("<interfaces xmlns=\"urn:ietf:params:xml:ns:yang:ietf-interfaces\">");
        iface.append("<interface>");
        iface.append("<name>").append(escapeXml(name)).append("</name>");
        if (description != null)
            iface.append("<description>").append(escapeXml(description)).append("</description>");
        if (enabled != null)
            iface.append("<enabled>").append(enabled).append("</enabled>");
        iface.append("</interface>");
        iface.append("</interfaces>");
        iface.append("</config>");

        boolean ok = session(deviceId).editConfig(iface.toString());
        log.info("[CsrConfig] configureInterface({}) → {}", name, ok ? "OK" : "FAIL");
        return ok ? ok() : fail("edit-config refusé par le routeur");
    }

    // ── Route statique — Ajout ────────────────────────────────────────
    // YANG : Cisco-IOS-XE-native:native/ip/route

    /**
     * Ajoute une route statique.
     *
     * Équivalent IOS : ip route <prefix> <mask> <nextHop>
     */
    public ObjectNode addStaticRoute(DeviceId deviceId,
                                     String prefix, String mask, String nextHop) {
        if (prefix == null || mask == null || nextHop == null)
            return fail("prefix, mask et nextHop sont requis");

        String config =
            "<config>" +
            "  <native xmlns=\"http://cisco.com/ns/yang/Cisco-IOS-XE-native\">" +
            "    <ip><route>" +
            "      <ip-route-interface-forwarding-list>" +
            "        <prefix>" + escapeXml(prefix) + "</prefix>" +
            "        <mask>"   + escapeXml(mask)   + "</mask>" +
            "        <fwd-list><fwd>" + escapeXml(nextHop) + "</fwd></fwd-list>" +
            "      </ip-route-interface-forwarding-list>" +
            "    </route></ip>" +
            "  </native>" +
            "</config>";

        boolean ok = session(deviceId).editConfig(config);
        log.info("[CsrConfig] addStaticRoute({}/{} via {}) → {}",
                 prefix, mask, nextHop, ok ? "OK" : "FAIL");
        return ok ? ok() : fail("edit-config refusé par le routeur");
    }

    // ── Route statique — Suppression ─────────────────────────────────

    /**
     * Supprime une route statique.
     *
     * Utilise l'attribut NETCONF operation="delete".
     */
    public ObjectNode deleteStaticRoute(DeviceId deviceId,
                                        String prefix, String mask, String nextHop) {
        if (prefix == null || mask == null || nextHop == null)
            return fail("prefix, mask et nextHop sont requis");

        String config =
            "<config>" +
            "  <native xmlns=\"http://cisco.com/ns/yang/Cisco-IOS-XE-native\">" +
            "    <ip><route>" +
            "      <ip-route-interface-forwarding-list" +
            "          xmlns:nc=\"urn:ietf:params:xml:ns:netconf:base:1.0\"" +
            "          nc:operation=\"delete\">" +
            "        <prefix>" + escapeXml(prefix) + "</prefix>" +
            "        <mask>"   + escapeXml(mask)   + "</mask>" +
            "        <fwd-list><fwd>" + escapeXml(nextHop) + "</fwd></fwd-list>" +
            "      </ip-route-interface-forwarding-list>" +
            "    </route></ip>" +
            "  </native>" +
            "</config>";

        boolean ok = session(deviceId).editConfig(config);
        log.info("[CsrConfig] deleteStaticRoute({}/{} via {}) → {}",
                 prefix, mask, nextHop, ok ? "OK" : "FAIL");
        return ok ? ok() : fail("edit-config refusé par le routeur");
    }

    // ── NTP ──────────────────────────────────────────────────────────
    // YANG : Cisco-IOS-XE-native:native/ntp

    /**
     * Configure le serveur NTP.
     *
     * Équivalent IOS : ntp server <ip>
     */
    public ObjectNode setNtpServer(DeviceId deviceId, String ntpServer) {
        if (ntpServer == null || ntpServer.isBlank())
            return fail("L'adresse du serveur NTP est requise");

        String config =
            "<config>" +
            "  <native xmlns=\"http://cisco.com/ns/yang/Cisco-IOS-XE-native\">" +
            "    <ntp>" +
            "      <Cisco-IOS-XE-ntp:server" +
            "          xmlns:Cisco-IOS-XE-ntp=" +
            "          \"http://cisco.com/ns/yang/Cisco-IOS-XE-ntp\">" +
            "        <server-list>" +
            "          <ip-address>" + escapeXml(ntpServer) + "</ip-address>" +
            "        </server-list>" +
            "      </Cisco-IOS-XE-ntp:server>" +
            "    </ntp>" +
            "  </native>" +
            "</config>";

        boolean ok = session(deviceId).editConfig(config);
        log.info("[CsrConfig] setNtpServer({}) → {}", ntpServer, ok ? "OK" : "FAIL");
        return ok ? ok() : fail("edit-config refusé par le routeur");
    }

    // ── Utilitaire ───────────────────────────────────────────────────

    /**
     * Échappe les caractères XML spéciaux dans une valeur de nœud texte.
     */
    private static String escapeXml(String value) {
        return value
            .replace("&",  "&amp;")
            .replace("<",  "&lt;")
            .replace(">",  "&gt;")
            .replace("\"", "&quot;")
            .replace("'",  "&apos;");
    }
}
