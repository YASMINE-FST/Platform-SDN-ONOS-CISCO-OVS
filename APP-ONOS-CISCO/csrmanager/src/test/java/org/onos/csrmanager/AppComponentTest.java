package org.onos.csrmanager;

import org.junit.Test;
import org.onos.csrmanager.store.MetricsStore;
import org.onos.csrmanager.util.XmlParser;
import org.w3c.dom.Document;
import org.w3c.dom.Element;

import static org.junit.Assert.*;

/**
 * Tests unitaires — pas de connexion NETCONF réelle.
 * On teste uniquement les utilitaires XML et la logique pure.
 *
 * Pour les tests d'intégration avec ONOS (connexion réelle),
 * voir la section "Tests" du README.md.
 */
public class AppComponentTest {

    // ── Réponses XML NETCONF de test ─────────────────────────────────

    private static final String CPU_XML =
        "<?xml version=\"1.0\" encoding=\"UTF-8\"?>" +
        "<rpc-reply xmlns=\"urn:ietf:params:xml:ns:netconf:base:1.0\">" +
        "  <data>" +
        "    <cpu-usage xmlns=\"http://cisco.com/ns/yang/Cisco-IOS-XE-process-cpu-oper\">" +
        "      <cpu-utilization>" +
        "        <five-seconds>7</five-seconds>" +
        "        <one-minute>4</one-minute>" +
        "        <five-minutes>3</five-minutes>" +
        "      </cpu-utilization>" +
        "    </cpu-usage>" +
        "  </data>" +
        "</rpc-reply>";

    private static final String MEMORY_XML =
        "<?xml version=\"1.0\" encoding=\"UTF-8\"?>" +
        "<rpc-reply xmlns=\"urn:ietf:params:xml:ns:netconf:base:1.0\">" +
        "  <data>" +
        "    <memory-statistics xmlns=\"http://cisco.com/ns/yang/Cisco-IOS-XE-memory-oper\">" +
        "      <memory-statistic>" +
        "        <name>Processor</name>" +
        "        <total-memory>2000000000</total-memory>" +
        "        <used-memory>600000000</used-memory>" +
        "        <free-memory>1400000000</free-memory>" +
        "      </memory-statistic>" +
        "    </memory-statistics>" +
        "  </data>" +
        "</rpc-reply>";

    private static final String HOSTNAME_XML =
        "<?xml version=\"1.0\" encoding=\"UTF-8\"?>" +
        "<rpc-reply xmlns=\"urn:ietf:params:xml:ns:netconf:base:1.0\">" +
        "  <data>" +
        "    <native xmlns=\"http://cisco.com/ns/yang/Cisco-IOS-XE-native\">" +
        "      <hostname>CSR1kv-Lab</hostname>" +
        "      <version>16.9</version>" +
        "    </native>" +
        "  </data>" +
        "</rpc-reply>";

    // ── Tests XmlParser ──────────────────────────────────────────────

    @Test
    public void testParseCpuXml() {
        Document doc = XmlParser.parse(CPU_XML);
        assertNotNull("Document should not be null", doc);

        Element cpu = XmlParser.firstElement(doc, "cpu-utilization");
        assertNotNull("cpu-utilization element should exist", cpu);

        assertEquals(7, XmlParser.getInt(cpu, "five-seconds"));
        assertEquals(4, XmlParser.getInt(cpu, "one-minute"));
        assertEquals(3, XmlParser.getInt(cpu, "five-minutes"));
    }

    @Test
    public void testParseMemoryXml() {
        Document doc = XmlParser.parse(MEMORY_XML);
        assertNotNull(doc);

        Element pool = XmlParser.firstElement(doc, "memory-statistic");
        assertNotNull(pool);

        assertEquals("Processor", XmlParser.getText(pool, "name"));
        assertEquals(2000000000L, XmlParser.getLong(pool, "total-memory"));
        assertEquals(600000000L,  XmlParser.getLong(pool, "used-memory"));
    }

    @Test
    public void testParseHostnameXml() {
        Document doc    = XmlParser.parse(HOSTNAME_XML);
        Element  native_ = XmlParser.firstElement(doc, "native");
        assertNotNull(native_);

        assertEquals("CSR1kv-Lab", XmlParser.getText(native_, "hostname"));
        assertEquals("16.9",       XmlParser.getText(native_, "version"));
    }

    @Test
    public void testParseNullXml() {
        Document doc = XmlParser.parse(null);
        assertNull("null input should return null document", doc);
    }

    @Test
    public void testParseEmptyXml() {
        Document doc = XmlParser.parse("");
        assertNull("empty input should return null document", doc);
    }

    @Test
    public void testGetIntMissing() {
        Document doc  = XmlParser.parse(CPU_XML);
        Element  cpu  = XmlParser.firstElement(doc, "cpu-utilization");
        assertEquals("Missing element should return 0", 0,
                     XmlParser.getInt(cpu, "non-existent-field"));
    }

    @Test
    public void testGetTextMissing() {
        Document doc = XmlParser.parse(CPU_XML);
        Element  cpu = XmlParser.firstElement(doc, "cpu-utilization");
        assertEquals("", XmlParser.getText(cpu, "non-existent"));
    }

    // ── Tests MetricsStore ───────────────────────────────────────────

    @Test
    public void testMetricsStoreHistory() {
        // TODO Semaine 2 : tester updateCpu + getCpuHistory
        // Pour l'instant vérifie juste que le store ne plante pas à froid
        org.onosproject.net.DeviceId id =
            org.onosproject.net.DeviceId.deviceId("netconf:10.0.0.1:830");

        assertNull("Aucune donnée encore dans le store", MetricsStore.getCpu(id));

        java.util.Deque<MetricsStore.CpuPoint> hist = MetricsStore.getCpuHistory(id);
        assertNotNull(hist);
        assertTrue(hist.isEmpty());
    }
}
