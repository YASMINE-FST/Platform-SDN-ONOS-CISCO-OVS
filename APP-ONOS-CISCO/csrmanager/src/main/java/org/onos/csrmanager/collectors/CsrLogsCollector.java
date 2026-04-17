package org.onos.csrmanager.collectors;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.onos.csrmanager.CsrNetconfSession;
import org.onos.csrmanager.util.XmlParser;
import org.onosproject.net.DeviceId;
import org.onosproject.netconf.NetconfController;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.w3c.dom.Document;
import org.w3c.dom.Element;

import java.util.List;

/**
 * Collecte les logs syslog du routeur Cisco IOS-XE via NETCONF.
 *
 * YANG : Cisco-IOS-XE-syslog-oper:syslog-data/syslog-messages
 *
 * Format d'un message retourné :
 * {
 *   "severity":  "warning",
 *   "facility":  "SYS",
 *   "process":   "OSPF",
 *   "msg_name":  "ADJCHG",
 *   "message":   "Process 1, Nbr 10.0.0.2 on GigabitEthernet1 from LOADING to FULL",
 *   "timestamp": "2024-01-15T10:30:00.000Z",
 *   "sequence":  12345
 * }
 */
public class CsrLogsCollector {

    private final Logger log = LoggerFactory.getLogger(getClass());
    private static final ObjectMapper MAPPER = new ObjectMapper();

    private final NetconfController controller;

    public CsrLogsCollector(NetconfController controller) {
        this.controller = controller;
    }

    private CsrNetconfSession session(DeviceId id) {
        return new CsrNetconfSession(controller, id);
    }

    // ── Syslog ───────────────────────────────────────────────────────
    // YANG : Cisco-IOS-XE-syslog-oper:syslog-data

    /**
     * Retourne les derniers messages syslog du routeur.
     *
     * @param deviceId  ID du device ONOS (ex: netconf:192.168.1.11:830)
     * @param limit     Nombre maximum de messages à retourner
     */
    public ArrayNode getSyslog(DeviceId deviceId, int limit) {
        // Chemin 1 : sous-chemin messages
        String filter1 =
            "<syslog-data xmlns=\"http://cisco.com/ns/yang/Cisco-IOS-XE-syslog-oper\">" +
            "  <syslog-messages/>" +
            "</syslog-data>";

        String xml = session(deviceId).get(filter1);

        // Chemin 2 : racine complète (certaines versions IOS-XE)
        if (xml == null || xml.isBlank()) {
            String filter2 =
                "<syslog-data xmlns=\"http://cisco.com/ns/yang/Cisco-IOS-XE-syslog-oper\"/>";
            xml = session(deviceId).get(filter2);
        }

        if (xml == null) {
            log.warn("[CsrLogs] NETCONF session unavailable pour {}", deviceId);
            ArrayNode arr = MAPPER.createArrayNode();
            arr.add(MAPPER.createObjectNode().put("error", "NETCONF session unavailable"));
            return arr;
        }

        Document      doc      = XmlParser.parse(xml);
        List<Element> messages = XmlParser.getElements(doc, "syslog-message");

        // Tronquer aux <limit> derniers messages
        int start = Math.max(0, messages.size() - limit);
        List<Element> slice = messages.subList(start, messages.size());

        ArrayNode result = MAPPER.createArrayNode();
        // Ordre chronologique inversé (plus récent en premier)
        for (int i = slice.size() - 1; i >= 0; i--) {
            Element m = slice.get(i);
            ObjectNode n = MAPPER.createObjectNode();
            n.put("severity",  XmlParser.getText(m, "severity"));
            n.put("facility",  XmlParser.getText(m, "facility"));
            n.put("process",   XmlParser.getText(m, "process-name"));
            n.put("msg_name",  XmlParser.getText(m, "msg-name"));
            n.put("message",   XmlParser.getText(m, "msg"));
            n.put("timestamp", XmlParser.getText(m, "time-stamp"));
            n.put("sequence",  XmlParser.getLong(m, "sequence-num"));
            result.add(n);
        }

        log.debug("[CsrLogs] {} messages récupérés pour {}", result.size(), deviceId);
        return result;
    }
}
