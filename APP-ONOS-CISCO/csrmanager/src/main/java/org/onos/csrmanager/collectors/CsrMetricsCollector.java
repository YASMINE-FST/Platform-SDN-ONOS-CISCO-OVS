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
 * Collecte les métriques système du routeur Cisco IOS-XE via NETCONF.
 *
 * Métriques couvertes :
 *  - CPU         → Cisco-IOS-XE-process-cpu-oper
 *  - Mémoire     → Cisco-IOS-XE-memory-oper
 *  - Processus   → Cisco-IOS-XE-process-memory-oper
 *  - Environnement (température, ventilateurs) → Cisco-IOS-XE-environment-oper
 *  - Interfaces config   → ietf-interfaces
 *  - Interfaces opérationnel → Cisco-IOS-XE-interfaces-oper
 *  - Version / Hostname  → Cisco-IOS-XE-native
 *
 * Chaque méthode suit le même schéma :
 *   1. Construire le filtre NETCONF YANG (subtree filter)
 *   2. Appeler session.get() ou session.getConfig()
 *   3. Parser le XML de réponse avec XmlParser
 *   4. Retourner un ObjectNode / ArrayNode Jackson
 */
public class CsrMetricsCollector {

    private final Logger log = LoggerFactory.getLogger(getClass());
    private static final ObjectMapper MAPPER = new ObjectMapper();

    private final NetconfController controller;

    public CsrMetricsCollector(NetconfController controller) {
        this.controller = controller;
    }

    // ── Helpers ──────────────────────────────────────────────────────

    private CsrNetconfSession session(DeviceId deviceId) {
        return new CsrNetconfSession(controller, deviceId);
    }

    private ObjectNode error(String msg) {
        log.warn("[CsrMetrics] {}", msg);
        ObjectNode n = MAPPER.createObjectNode();
        n.put("error", msg);
        return n;
    }

    private ArrayNode errorArray(String msg) {
        log.warn("[CsrMetrics] {}", msg);
        ArrayNode arr = MAPPER.createArrayNode();
        arr.add(MAPPER.createObjectNode().put("error", msg));
        return arr;
    }

    // ── CPU ──────────────────────────────────────────────────────────
    // YANG : Cisco-IOS-XE-process-cpu-oper:cpu-usage/cpu-utilization
    // Équivalent RESTCONF : GET /restconf/data/Cisco-IOS-XE-process-cpu-oper:cpu-usage/cpu-utilization

    public ObjectNode getCpu(DeviceId deviceId) {
        String filter =
            "<cpu-usage xmlns=\"http://cisco.com/ns/yang/Cisco-IOS-XE-process-cpu-oper\">" +
            "  <cpu-utilization/>" +
            "</cpu-usage>";

        String xml = session(deviceId).get(filter);
        if (xml == null) return error("NETCONF session unavailable");

        Document doc = XmlParser.parse(xml);
        Element  cpu = XmlParser.firstElement(doc, "cpu-utilization");

        ObjectNode result = MAPPER.createObjectNode();
        result.put("five_seconds", XmlParser.getInt(cpu, "five-seconds"));
        result.put("one_minute",   XmlParser.getInt(cpu, "one-minute"));
        result.put("five_minutes", XmlParser.getInt(cpu, "five-minutes"));
        return result;
    }

    // ── Mémoire ──────────────────────────────────────────────────────
    // YANG : Cisco-IOS-XE-memory-oper:memory-statistics/memory-statistic

    public ArrayNode getMemory(DeviceId deviceId) {
        String filter =
            "<memory-statistics xmlns=\"http://cisco.com/ns/yang/Cisco-IOS-XE-memory-oper\">" +
            "  <memory-statistic/>" +
            "</memory-statistics>";

        String xml = session(deviceId).get(filter);
        if (xml == null) return errorArray("NETCONF session unavailable");

        Document   doc    = XmlParser.parse(xml);
        List<Element> pools = XmlParser.getElements(doc, "memory-statistic");

        ArrayNode result = MAPPER.createArrayNode();
        for (Element pool : pools) {
            long total = XmlParser.getLong(pool, "total-memory");
            long used  = XmlParser.getLong(pool, "used-memory");
            long free  = XmlParser.getLong(pool, "free-memory");
            ObjectNode n = MAPPER.createObjectNode();
            n.put("name",          XmlParser.getText(pool, "name"));
            n.put("total",         total);
            n.put("used",          used);
            n.put("free",          free);
            n.put("usage_percent", total > 0 ? Math.round(used * 1000.0 / total) / 10.0 : 0.0);
            result.add(n);
        }
        return result;
    }

    // ── Processus ────────────────────────────────────────────────────
    // YANG : Cisco-IOS-XE-process-memory-oper:memory-usage-processes

    public ArrayNode getProcesses(DeviceId deviceId) {
        String filter =
            "<memory-usage-processes " +
            " xmlns=\"http://cisco.com/ns/yang/Cisco-IOS-XE-process-memory-oper\"/>";

        String xml = session(deviceId).get(filter);
        if (xml == null) return errorArray("NETCONF session unavailable");

        Document      doc   = XmlParser.parse(xml);
        List<Element> procs = XmlParser.getElements(doc, "memory-usage-process");

        ArrayNode result = MAPPER.createArrayNode();
        for (Element p : procs) {
            long holding = XmlParser.getLong(p, "holding-memory");
            long alloc   = XmlParser.getLong(p, "allocated-memory");
            long freed   = XmlParser.getLong(p, "freed-memory");
            ObjectNode n = MAPPER.createObjectNode();
            n.put("pid",     XmlParser.getInt(p, "pid"));
            n.put("name",    XmlParser.getText(p, "name"));
            n.put("holding", holding);
            n.put("alloc",   alloc);
            n.put("freed",   freed);
            n.put("net",     alloc - freed);
            result.add(n);
        }
        return result;
    }

    // ── Environnement ────────────────────────────────────────────────
    // YANG : Cisco-IOS-XE-environment-oper:environment-sensors

    public ArrayNode getEnvironment(DeviceId deviceId) {
        String filter =
            "<environment-sensors " +
            " xmlns=\"http://cisco.com/ns/yang/Cisco-IOS-XE-environment-oper\"/>";

        String xml = session(deviceId).get(filter);
        if (xml == null) return errorArray("NETCONF session unavailable");

        Document      doc     = XmlParser.parse(xml);
        List<Element> sensors = XmlParser.getElements(doc, "environment-sensor");

        ArrayNode result = MAPPER.createArrayNode();
        for (Element s : sensors) {
            ObjectNode n = MAPPER.createObjectNode();
            n.put("name",            XmlParser.getText(s, "name"));
            n.put("location",        XmlParser.getText(s, "location"));
            n.put("state",           XmlParser.getText(s, "state"));
            n.put("current_reading", XmlParser.getInt(s, "current-reading"));
            n.put("units",           XmlParser.getText(s, "units"));
            n.put("high_warning",    XmlParser.getInt(s, "high-warning-threshold"));
            n.put("low_warning",     XmlParser.getInt(s, "low-warning-threshold"));
            result.add(n);
        }
        return result;
    }

    // ── Interfaces config ────────────────────────────────────────────
    // YANG : ietf-interfaces:interfaces (configuration)

    public ArrayNode getInterfacesConfig(DeviceId deviceId) {
        String filter =
            "<interfaces xmlns=\"urn:ietf:params:xml:ns:yang:ietf-interfaces\"/>";

        String xml = session(deviceId).getConfig(filter);
        if (xml == null) return errorArray("NETCONF session unavailable");

        Document      doc    = XmlParser.parse(xml);
        List<Element> ifaces = XmlParser.getElements(doc, "interface");

        ArrayNode result = MAPPER.createArrayNode();
        for (Element i : ifaces) {
            ObjectNode n = MAPPER.createObjectNode();
            n.put("name",        XmlParser.getText(i, "name"));
            n.put("type",        XmlParser.getText(i, "type").replace("ianaift:", ""));
            n.put("enabled",     XmlParser.getBool(i, "enabled"));
            n.put("description", XmlParser.getText(i, "description"));
            Element ipv4 = XmlParser.firstDescendant(i, "ipv4");
            Element addr = ipv4 != null ? XmlParser.firstDescendant(ipv4, "address") : null;
            n.put("ip",            addr != null ? XmlParser.getText(addr, "ip") : "");
            n.put("prefix_length", addr != null ? XmlParser.getInt(addr, "prefix-length") : 0);
            n.put("netmask",       addr != null ? XmlParser.getText(addr, "netmask") : "");
            result.add(n);
        }
        return result;
    }

    // ── Interfaces opérationnel ──────────────────────────────────────
    // YANG : Cisco-IOS-XE-interfaces-oper:interfaces

    public ArrayNode getInterfacesOper(DeviceId deviceId) {
        String filter =
            "<interfaces xmlns=\"http://cisco.com/ns/yang/Cisco-IOS-XE-interfaces-oper\"/>";

        String xml = session(deviceId).get(filter);
        if (xml == null) return errorArray("NETCONF session unavailable");

        Document      doc    = XmlParser.parse(xml);
        List<Element> ifaces = XmlParser.getElements(doc, "interface");

        ArrayNode result = MAPPER.createArrayNode();
        for (Element i : ifaces) {
            Element stats = XmlParser.firstDescendant(i, "statistics");

            long inOct    = stats != null ? XmlParser.getLong(stats, "in-octets")  : 0;
            long outOct   = stats != null ? XmlParser.getLong(stats, "out-octets") : 0;
            long inUni    = stats != null ? XmlParser.getLong(stats, "in-unicast-pkts")   : 0;
            long outUni   = stats != null ? XmlParser.getLong(stats, "out-unicast-pkts")  : 0;
            long inErr    = stats != null ? XmlParser.getLong(stats, "in-errors")   : 0;
            long outErr   = stats != null ? XmlParser.getLong(stats, "out-errors")  : 0;

            ObjectNode n = MAPPER.createObjectNode();
            n.put("name",         XmlParser.getText(i, "name"));
            n.put("admin_status", XmlParser.getText(i, "admin-status"));
            n.put("oper_status",  XmlParser.getText(i, "oper-status"));
            n.put("speed",        XmlParser.getLong(i, "speed"));
            n.put("mtu",          XmlParser.getInt(i, "mtu"));
            n.put("ip",           XmlParser.getText(i, "ipv4"));
            n.put("mask",         XmlParser.getText(i, "ipv4-subnet-mask"));
            n.put("description",  XmlParser.getText(i, "description"));
            n.put("phys_address", XmlParser.getText(i, "phys-address"));

            ObjectNode statsNode = MAPPER.createObjectNode();
            statsNode.put("in_octets",   inOct);
            statsNode.put("out_octets",  outOct);
            statsNode.put("in_packets",  inUni);
            statsNode.put("out_packets", outUni);
            statsNode.put("in_errors",   inErr);
            statsNode.put("out_errors",  outErr);
            n.set("stats", statsNode);
            result.add(n);
        }
        return result;
    }

    // ── Version ──────────────────────────────────────────────────────
    // YANG : Cisco-IOS-XE-native:native/version  (get-config running)

    public ObjectNode getVersion(DeviceId deviceId) {
        String filter =
            "<native xmlns=\"http://cisco.com/ns/yang/Cisco-IOS-XE-native\">" +
            "  <version/>" +
            "  <hostname/>" +
            "</native>";

        String xml = session(deviceId).getConfig(filter);
        if (xml == null) return error("NETCONF session unavailable");

        Document   doc    = XmlParser.parse(xml);
        Element    native_ = XmlParser.firstElement(doc, "native");

        ObjectNode result = MAPPER.createObjectNode();
        result.put("hostname", XmlParser.getText(native_, "hostname"));
        result.put("version",  XmlParser.getText(native_, "version"));
        return result;
    }
}
