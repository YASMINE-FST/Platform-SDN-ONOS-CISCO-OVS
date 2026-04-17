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
 * Collecte les données de réseau et de routage via NETCONF.
 *
 * Métriques couvertes :
 *  - Routes (RIB)       → ietf-routing
 *  - Routes statiques   → Cisco-IOS-XE-native (get-config)
 *  - ARP                → Cisco-IOS-XE-arp-oper
 *  - OSPF               → Cisco-IOS-XE-ospf-oper
 *  - BGP                → Cisco-IOS-XE-bgp-oper
 *  - CDP                → Cisco-IOS-XE-cdp-oper
 *  - NTP                → Cisco-IOS-XE-ntp-oper
 *  - DHCP pools         → Cisco-IOS-XE-dhcp-oper
 */
public class CsrRoutingCollector {

    private final Logger log = LoggerFactory.getLogger(getClass());
    private static final ObjectMapper MAPPER = new ObjectMapper();

    private final NetconfController controller;

    public CsrRoutingCollector(NetconfController controller) {
        this.controller = controller;
    }

    private CsrNetconfSession session(DeviceId id) {
        return new CsrNetconfSession(controller, id);
    }

    private ArrayNode errorArray(String msg) {
        log.warn("[CsrRouting] {}", msg);
        ArrayNode arr = MAPPER.createArrayNode();
        arr.add(MAPPER.createObjectNode().put("error", msg));
        return arr;
    }

    private ObjectNode errorNode(String msg) {
        log.warn("[CsrRouting] {}", msg);
        return MAPPER.createObjectNode().put("error", msg);
    }

    // ── Routes (RIB) ─────────────────────────────────────────────────
    // YANG : ietf-routing:routing-state

    public ArrayNode getRoutes(DeviceId deviceId) {
        String filter =
            "<routing-state xmlns=\"urn:ietf:params:xml:ns:yang:ietf-routing\"/>";

        String xml = session(deviceId).get(filter);
        if (xml == null) return errorArray("NETCONF session unavailable");

        Document      doc    = XmlParser.parse(xml);
        List<Element> routes = XmlParser.getElements(doc, "route");

        ArrayNode result = MAPPER.createArrayNode();
        for (Element r : routes) {
            Element nh = XmlParser.firstDescendant(r, "next-hop");
            ObjectNode n = MAPPER.createObjectNode();
            n.put("destination", XmlParser.getText(r, "destination-prefix"));
            n.put("protocol",    XmlParser.getText(r, "source-protocol").replace("ietf-routing:", ""));
            n.put("metric",      XmlParser.getInt(r,  "metric"));
            n.put("next_hop",    nh != null ? XmlParser.getText(nh, "next-hop-address") : "");
            n.put("outgoing_interface",
                  nh != null ? XmlParser.getText(nh, "outgoing-interface") : "");
            result.add(n);
        }
        return result;
    }

    // ── Routes statiques (config) ────────────────────────────────────
    // YANG : Cisco-IOS-XE-native:native/ip/route  (get-config running)

    public ArrayNode getStaticRoutesConfig(DeviceId deviceId) {
        String filter =
            "<native xmlns=\"http://cisco.com/ns/yang/Cisco-IOS-XE-native\">" +
            "  <ip><route/></ip>" +
            "</native>";

        String xml = session(deviceId).getConfig(filter);
        if (xml == null) return errorArray("NETCONF session unavailable");

        Document      doc    = XmlParser.parse(xml);
        List<Element> routes = XmlParser.getElements(doc, "ip-route-interface-forwarding-list");

        ArrayNode result = MAPPER.createArrayNode();
        for (Element r : routes) {
            String prefix = XmlParser.getText(r, "prefix");
            String mask   = XmlParser.getText(r, "mask");
            List<Element> fwdList = XmlParser.descendants(r, "fwd-list");
            if (fwdList.isEmpty()) {
                ObjectNode n = MAPPER.createObjectNode();
                n.put("prefix",   prefix);
                n.put("mask",     mask);
                n.put("next_hop", "");
                n.put("distance", 0);
                result.add(n);
                continue;
            }
            for (Element fwd : fwdList) {
                ObjectNode n = MAPPER.createObjectNode();
                n.put("prefix",    prefix);
                n.put("mask",      mask);
                n.put("next_hop",  XmlParser.getText(fwd, "fwd"));
                n.put("distance",  XmlParser.getInt(fwd, "distance-admin"));
                result.add(n);
            }
        }
        return result;
    }

    // ── ARP ──────────────────────────────────────────────────────────
    // YANG : Cisco-IOS-XE-arp-oper:arp-data/arp-vrf

    public ArrayNode getArp(DeviceId deviceId) {
        String filter =
            "<arp-data xmlns=\"http://cisco.com/ns/yang/Cisco-IOS-XE-arp-oper\"/>";

        String xml = session(deviceId).get(filter);
        if (xml == null) return errorArray("NETCONF session unavailable");

        Document      doc     = XmlParser.parse(xml);
        List<Element> entries = XmlParser.getElements(doc, "arp-oper");

        ArrayNode result = MAPPER.createArrayNode();
        for (Element e : entries) {
            ObjectNode n = MAPPER.createObjectNode();
            n.put("ip",        XmlParser.getText(e, "address"));
            n.put("mac",       XmlParser.getText(e, "hardware"));
            n.put("interface", XmlParser.getText(e, "interface"));
            n.put("type",      XmlParser.getText(e, "enctype"));
            result.add(n);
        }
        return result;
    }

    // ── OSPF ─────────────────────────────────────────────────────────
    // YANG : Cisco-IOS-XE-ospf-oper:ospf-oper-data

    public ArrayNode getOspf(DeviceId deviceId) {
        String filter =
            "<ospf-oper-data xmlns=\"http://cisco.com/ns/yang/Cisco-IOS-XE-ospf-oper\"/>";

        String xml = session(deviceId).get(filter);
        if (xml == null) return errorArray("NETCONF session unavailable");

        Document      doc       = XmlParser.parse(xml);
        List<Element> instances = XmlParser.getElements(doc, "ospf-instance");

        ArrayNode result = MAPPER.createArrayNode();
        for (Element inst : instances) {
            ObjectNode n = MAPPER.createObjectNode();
            n.put("router_id", XmlParser.getText(inst, "router-id"));
            n.put("af",        XmlParser.getText(inst, "af"));

            ArrayNode areas = MAPPER.createArrayNode();
            for (Element area : XmlParser.descendants(inst, "ospf-area")) {
                ObjectNode a = MAPPER.createObjectNode();
                a.put("area_id",   XmlParser.getText(area, "area-id"));
                a.put("neighbors", XmlParser.descendants(area, "ospf-neighbor-state").size());
                areas.add(a);
            }
            n.set("areas", areas);
            result.add(n);
        }
        return result;
    }

    // ── BGP ──────────────────────────────────────────────────────────
    // YANG : Cisco-IOS-XE-bgp-oper:bgp-state-data

    public ArrayNode getBgp(DeviceId deviceId) {
        String filter =
            "<bgp-state-data xmlns=\"http://cisco.com/ns/yang/Cisco-IOS-XE-bgp-oper\"/>";

        String xml = session(deviceId).get(filter);
        if (xml == null) return errorArray("NETCONF session unavailable");

        Document      doc     = XmlParser.parse(xml);
        List<Element> entries = XmlParser.getElements(doc, "bgp-route-entry");

        ArrayNode result = MAPPER.createArrayNode();
        for (Element e : entries) {
            List<Element> paths = XmlParser.descendants(e, "bgp-path-entry");
            Element p = paths.isEmpty() ? null : paths.get(0);
            ObjectNode n = MAPPER.createObjectNode();
            n.put("prefix",   XmlParser.getText(e, "prefix"));
            n.put("version",  XmlParser.getInt(e, "version"));
            n.put("next_hop", p != null ? XmlParser.getText(p, "nexthop")   : "");
            n.put("metric",   p != null ? XmlParser.getInt(p, "metric")     : 0);
            n.put("weight",   p != null ? XmlParser.getInt(p, "weight")     : 0);
            n.put("best",     p != null ? XmlParser.getBool(p, "best-path") : false);
            result.add(n);
        }
        return result;
    }

    // ── CDP ──────────────────────────────────────────────────────────
    // YANG : Cisco-IOS-XE-cdp-oper:cdp-neighbor-details

    public ArrayNode getCdp(DeviceId deviceId) {
        String filter =
            "<cdp-neighbor-details " +
            " xmlns=\"http://cisco.com/ns/yang/Cisco-IOS-XE-cdp-oper\"/>";

        String xml = session(deviceId).get(filter);
        if (xml == null) return errorArray("NETCONF session unavailable");

        Document      doc       = XmlParser.parse(xml);
        List<Element> neighbors = XmlParser.getElements(doc, "cdp-neighbor-detail");

        ArrayNode result = MAPPER.createArrayNode();
        for (Element nb : neighbors) {
            ObjectNode n = MAPPER.createObjectNode();
            n.put("device_id",    XmlParser.getText(nb, "device-id"));
            n.put("local_intf",   XmlParser.getText(nb, "local-intf-name"));
            n.put("port_id",      XmlParser.getText(nb, "port-id"));
            n.put("platform",     XmlParser.getText(nb, "platform-name"));
            n.put("capabilities", XmlParser.getText(nb, "capability-codes"));
            n.put("ip",           XmlParser.getText(nb, "mgmt-address"));
            n.put("hold_time",    XmlParser.getInt(nb, "hold-time"));
            result.add(n);
        }
        return result;
    }

    // ── NTP ──────────────────────────────────────────────────────────
    // YANG : Cisco-IOS-XE-ntp-oper:ntp-oper-data

    public ObjectNode getNtp(DeviceId deviceId) {
        String filter =
            "<ntp-oper-data xmlns=\"http://cisco.com/ns/yang/Cisco-IOS-XE-ntp-oper\"/>";

        String xml = session(deviceId).get(filter);
        if (xml == null) return errorNode("NETCONF session unavailable");

        Document doc   = XmlParser.parse(xml);
        Element  clock = XmlParser.firstElement(doc, "system-status");

        ObjectNode result = MAPPER.createObjectNode();
        if (clock != null) {
            result.put("synced",         XmlParser.getText(clock, "clock-state"));
            result.put("stratum",        XmlParser.getInt(clock, "stratum"));
            result.put("reference_time", XmlParser.getText(clock, "reference-time"));
        } else {
            result.put("synced",         "");
            result.put("stratum",        0);
            result.put("reference_time", "");
        }

        ArrayNode peers = MAPPER.createArrayNode();
        XmlParser.getElements(doc, "ntp-association").forEach(assoc -> {
            ObjectNode p = MAPPER.createObjectNode();
            p.put("address",   XmlParser.getText(assoc, "address"));
            p.put("stratum",   XmlParser.getInt(assoc,  "stratum"));
            p.put("delay",     XmlParser.getInt(assoc,  "delay"));
            p.put("offset",    XmlParser.getInt(assoc,  "offset"));
            p.put("selected",  XmlParser.getBool(assoc, "selected-peer"));
            peers.add(p);
        });
        result.set("peers", peers);
        return result;
    }

    // ── DHCP ─────────────────────────────────────────────────────────
    // YANG : Cisco-IOS-XE-dhcp-oper:dhcp-oper-data/dhcpv4-server-oper

    public ArrayNode getDhcpPools(DeviceId deviceId) {
        String filter =
            "<dhcp-oper-data xmlns=\"http://cisco.com/ns/yang/Cisco-IOS-XE-dhcp-oper\">" +
            "  <dhcpv4-server-oper/>" +
            "</dhcp-oper-data>";

        String xml = session(deviceId).get(filter);
        if (xml == null) return errorArray("NETCONF session unavailable");

        Document      doc   = XmlParser.parse(xml);
        List<Element> pools = XmlParser.getElements(doc, "dhcpv4-server-oper");

        ArrayNode result = MAPPER.createArrayNode();
        for (Element pool : pools) {
            long total     = XmlParser.getLong(pool, "total-addresses");
            long leased    = XmlParser.getLong(pool, "leased-addresses");
            long available = XmlParser.getLong(pool, "available-addresses");
            ObjectNode n = MAPPER.createObjectNode();
            n.put("pool_name",  XmlParser.getText(pool, "pool-name"));
            n.put("network",    XmlParser.getText(pool, "network-address"));
            n.put("mask",       XmlParser.getText(pool, "mask"));
            n.put("total",      total);
            n.put("leased",     leased);
            n.put("available",  available);
            n.put("usage_pct",  total > 0 ? Math.round(leased * 1000.0 / total) / 10.0 : 0.0);
            result.add(n);
        }
        return result;
    }
}
