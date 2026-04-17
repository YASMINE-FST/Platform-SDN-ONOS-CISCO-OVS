package org.onos.csrmanager;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.onos.csrmanager.collectors.CsrLogsCollector;
import org.onos.csrmanager.collectors.CsrMetricsCollector;
import org.onos.csrmanager.collectors.CsrRoutingCollector;
import org.onos.csrmanager.config.CsrConfigurator;
import org.onos.csrmanager.store.MetricsStore;
import org.onosproject.core.ApplicationId;
import org.onosproject.core.CoreService;
import org.onosproject.net.Device;
import org.onosproject.net.DeviceId;
import org.onosproject.net.device.DeviceService;
import org.onosproject.netconf.NetconfController;
import org.osgi.service.component.annotations.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

/**
 * Point d'entrée OSGi de l'application CsrManager.
 *
 * Cycle de vie :
 *  1. @Activate  → enregistre l'appId, instancie les collecteurs,
 *                   démarre le scheduler de polling (toutes les 30s).
 *  2. Polling     → itère sur tous les devices NETCONF Cisco dans ONOS
 *                   et met à jour le MetricsStore.
 *  3. @Deactivate → arrête le scheduler proprement.
 *
 * Implémente CsrManagerService → accessible depuis CsrWebResource
 * via get(CsrManagerService.class).
 */
@Component(immediate = true, service = CsrManagerService.class)
public class AppComponent implements CsrManagerService {

    private final Logger log = LoggerFactory.getLogger(getClass());
    private static final ObjectMapper MAPPER = new ObjectMapper();

    // ── Intervalle de collecte (secondes) ────────────────────────────
    private static final int POLL_DELAY_S  = 10;   // délai initial
    private static final int POLL_PERIOD_S = 30;   // période de polling

    // ── Services ONOS injectés par OSGi ─────────────────────────────
    @Reference(cardinality = ReferenceCardinality.MANDATORY)
    protected CoreService coreService;

    @Reference(cardinality = ReferenceCardinality.MANDATORY)
    protected NetconfController netconfController;

    @Reference(cardinality = ReferenceCardinality.MANDATORY)
    protected DeviceService deviceService;

    // ── État interne ─────────────────────────────────────────────────
    private ApplicationId appId;
    private ScheduledExecutorService scheduler;

    // Collecteurs (instanciés à l'activation, partagés avec les threads)
    private CsrMetricsCollector metricsCollector;
    private CsrRoutingCollector routingCollector;
    private CsrLogsCollector    logsCollector;
    private CsrConfigurator     configurator;

    // ── Cycle de vie OSGi ────────────────────────────────────────────

    @Activate
    protected void activate() {
        appId = coreService.registerApplication("org.onos.csrmanager");

        metricsCollector = new CsrMetricsCollector(netconfController);
        routingCollector = new CsrRoutingCollector(netconfController);
        logsCollector    = new CsrLogsCollector(netconfController);
        configurator     = new CsrConfigurator(netconfController);

        scheduler = Executors.newSingleThreadScheduledExecutor();
        scheduler.scheduleAtFixedRate(
                this::collectAll,
                POLL_DELAY_S,
                POLL_PERIOD_S,
                TimeUnit.SECONDS
        );

        log.info("CsrManager activé — appId={}, polling={}s", appId.id(), POLL_PERIOD_S);
    }

    @Deactivate
    protected void deactivate() {
        if (scheduler != null) {
            scheduler.shutdownNow();
        }
        log.info("CsrManager désactivé");
    }

    // ── Polling background ───────────────────────────────────────────

    private void collectAll() {
        try {
            deviceService.getDevices().forEach(device -> {
                DeviceId id = device.id();
                if (!id.toString().startsWith("netconf:")) return;
                if (!deviceService.isAvailable(id))        return;

                try {
                    MetricsStore.updateCpu(id,        metricsCollector.getCpu(id));
                    MetricsStore.updateMemory(id,     metricsCollector.getMemory(id));
                    MetricsStore.updateInterfaces(id, metricsCollector.getInterfacesOper(id));
                    MetricsStore.updateRoutes(id,     routingCollector.getRoutes(id));
                    MetricsStore.updateLogs(id,       logsCollector.getSyslog(id, 100));
                    log.debug("Collecte OK pour {}", id);
                } catch (Exception e) {
                    log.warn("Erreur collecte pour {} : {}", id, e.getMessage());
                }
            });
        } catch (Exception e) {
            log.warn("collectAll() erreur globale : {}", e.getMessage());
        }
    }

    // ── Implémentation CsrManagerService ────────────────────────────

    @Override
    public ObjectNode getCpu(DeviceId deviceId) {
        return metricsCollector.getCpu(deviceId);
    }

    @Override
    public ArrayNode getMemory(DeviceId deviceId) {
        return metricsCollector.getMemory(deviceId);
    }

    @Override
    public ArrayNode getProcesses(DeviceId deviceId) {
        return metricsCollector.getProcesses(deviceId);
    }

    @Override
    public ArrayNode getEnvironment(DeviceId deviceId) {
        return metricsCollector.getEnvironment(deviceId);
    }

    @Override
    public ObjectNode getVersion(DeviceId deviceId) {
        return metricsCollector.getVersion(deviceId);
    }

    @Override
    public ArrayNode getInterfacesConfig(DeviceId deviceId) {
        return metricsCollector.getInterfacesConfig(deviceId);
    }

    @Override
    public ArrayNode getInterfacesOper(DeviceId deviceId) {
        return metricsCollector.getInterfacesOper(deviceId);
    }

    @Override
    public ArrayNode getRoutes(DeviceId deviceId) {
        return routingCollector.getRoutes(deviceId);
    }

    @Override
    public ArrayNode getStaticRoutesConfig(DeviceId deviceId) {
        return routingCollector.getStaticRoutesConfig(deviceId);
    }

    @Override
    public ArrayNode getArp(DeviceId deviceId) {
        return routingCollector.getArp(deviceId);
    }

    @Override
    public ArrayNode getOspf(DeviceId deviceId) {
        return routingCollector.getOspf(deviceId);
    }

    @Override
    public ArrayNode getBgp(DeviceId deviceId) {
        return routingCollector.getBgp(deviceId);
    }

    @Override
    public ArrayNode getCdp(DeviceId deviceId) {
        return routingCollector.getCdp(deviceId);
    }

    @Override
    public ObjectNode getNtp(DeviceId deviceId) {
        return routingCollector.getNtp(deviceId);
    }

    @Override
    public ArrayNode getDhcpPools(DeviceId deviceId) {
        return routingCollector.getDhcpPools(deviceId);
    }

    @Override
    public ArrayNode getSyslog(DeviceId deviceId, int limit) {
        return logsCollector.getSyslog(deviceId, limit);
    }

    @Override
    public ObjectNode setHostname(DeviceId deviceId, String hostname) {
        return configurator.setHostname(deviceId, hostname);
    }

    @Override
    public ObjectNode configureInterface(DeviceId deviceId, String name,
                                         String description, Boolean enabled) {
        return configurator.configureInterface(deviceId, name, description, enabled);
    }

    @Override
    public ObjectNode addStaticRoute(DeviceId deviceId,
                                     String prefix, String mask, String nextHop) {
        return configurator.addStaticRoute(deviceId, prefix, mask, nextHop);
    }

    @Override
    public ObjectNode deleteStaticRoute(DeviceId deviceId,
                                        String prefix, String mask, String nextHop) {
        return configurator.deleteStaticRoute(deviceId, prefix, mask, nextHop);
    }

    @Override
    public ObjectNode setNtpServer(DeviceId deviceId, String ntpServer) {
        return configurator.setNtpServer(deviceId, ntpServer);
    }

    @Override
    public ArrayNode getNetconfDevices() {
        ArrayNode arr = MAPPER.createArrayNode();
        deviceService.getDevices().forEach(device -> {
            DeviceId id = device.id();
            if (!id.toString().startsWith("netconf:")) return;
            ObjectNode n = MAPPER.createObjectNode();
            n.put("device_id",  id.toString());
            n.put("available",  deviceService.isAvailable(id));
            n.put("type",       device.type().toString());
            n.put("manufacturer", device.manufacturer());
            n.put("hwVersion",  device.hwVersion());
            n.put("swVersion",  device.swVersion());
            n.put("driver",     device.annotations().value("driver") != null
                                ? device.annotations().value("driver") : "");
            // Parse IP from netconf:IP:PORT
            String[] parts = id.toString().split(":");
            n.put("ip",   parts.length > 1 ? parts[1] : "");
            n.put("port", parts.length > 2 ? parts[2] : "830");
            arr.add(n);
        });
        return arr;
    }

    @Override
    public boolean isDeviceAvailable(DeviceId deviceId) {
        return deviceService.isAvailable(deviceId);
    }
}
