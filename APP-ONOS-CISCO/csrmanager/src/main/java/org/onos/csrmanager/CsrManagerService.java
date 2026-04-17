package org.onos.csrmanager;

import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.onosproject.net.DeviceId;

/**
 * Service OSGi exposé par AppComponent.
 * CsrWebResource l'obtient via get(CsrManagerService.class).
 *
 * Chaque méthode retourne un ObjectNode ou ArrayNode Jackson
 * prêt à être sérialisé en JSON par le endpoint REST.
 */
public interface CsrManagerService {

    // ── Métriques système ────────────────────────────────────────────
    ObjectNode getCpu(DeviceId deviceId);
    ArrayNode  getMemory(DeviceId deviceId);
    ArrayNode  getProcesses(DeviceId deviceId);
    ArrayNode  getEnvironment(DeviceId deviceId);
    ObjectNode getVersion(DeviceId deviceId);

    // ── Interfaces ───────────────────────────────────────────────────
    ArrayNode  getInterfacesConfig(DeviceId deviceId);
    ArrayNode  getInterfacesOper(DeviceId deviceId);

    // ── Réseau / Routage ─────────────────────────────────────────────
    ArrayNode  getRoutes(DeviceId deviceId);
    ArrayNode  getStaticRoutesConfig(DeviceId deviceId);
    ArrayNode  getArp(DeviceId deviceId);
    ArrayNode  getOspf(DeviceId deviceId);
    ArrayNode  getBgp(DeviceId deviceId);
    ArrayNode  getCdp(DeviceId deviceId);
    ObjectNode getNtp(DeviceId deviceId);

    // ── DHCP ─────────────────────────────────────────────────────────
    ArrayNode  getDhcpPools(DeviceId deviceId);

    // ── Logs ─────────────────────────────────────────────────────────
    ArrayNode  getSyslog(DeviceId deviceId, int limit);

    // ── Configuration (write) ────────────────────────────────────────
    ObjectNode setHostname(DeviceId deviceId, String hostname);
    ObjectNode configureInterface(DeviceId deviceId, String name,
                                  String description, Boolean enabled);
    ObjectNode addStaticRoute(DeviceId deviceId,
                              String prefix, String mask, String nextHop);
    ObjectNode deleteStaticRoute(DeviceId deviceId,
                                 String prefix, String mask, String nextHop);
    ObjectNode setNtpServer(DeviceId deviceId, String ntpServer);

    // ── Utilitaires ──────────────────────────────────────────────────
    /** Liste tous les devices NETCONF Cisco enregistrés dans ONOS. */
    ArrayNode  getNetconfDevices();

    /** Health-check : retourne true si la session NETCONF est active. */
    boolean isDeviceAvailable(DeviceId deviceId);
}
