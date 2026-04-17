package org.onos.csrmanager.rest;

import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.onos.csrmanager.CsrManagerService;
import org.onos.csrmanager.store.MetricsStore;
import org.onosproject.net.DeviceId;
import org.onosproject.rest.AbstractWebResource;

import javax.ws.rs.*;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;
import java.io.InputStream;
import java.util.Deque;

/**
 * Endpoints REST de l'application CsrManager.
 *
 * Contexte de base : /onos/v1/csr  (défini dans pom.xml + web.xml)
 *
 * ┌──────────────────────────────────────────────────────────────────┐
 * │  MÉTRIQUES (lecture)                                             │
 * ├──────────────────────────────────────────────────────────────────┤
 * │  GET  /onos/v1/csr/devices                  — tous les routeurs  │
 * │  GET  /onos/v1/csr/cpu?device=<id>          — CPU utilization    │
 * │  GET  /onos/v1/csr/cpu/history?device=<id>  — historique CPU     │
 * │  GET  /onos/v1/csr/memory?device=<id>       — pools mémoire      │
 * │  GET  /onos/v1/csr/processes?device=<id>    — top processus       │
 * │  GET  /onos/v1/csr/environment?device=<id>  — capteurs           │
 * │  GET  /onos/v1/csr/version?device=<id>      — hostname + version │
 * ├──────────────────────────────────────────────────────────────────┤
 * │  INTERFACES                                                       │
 * ├──────────────────────────────────────────────────────────────────┤
 * │  GET  /onos/v1/csr/interfaces?device=<id>        — config        │
 * │  GET  /onos/v1/csr/interfaces/oper?device=<id>   — opérationnel  │
 * ├──────────────────────────────────────────────────────────────────┤
 * │  ROUTAGE                                                          │
 * ├──────────────────────────────────────────────────────────────────┤
 * │  GET  /onos/v1/csr/routes?device=<id>            — RIB complet   │
 * │  GET  /onos/v1/csr/routes/static?device=<id>     — routes static │
 * │  GET  /onos/v1/csr/arp?device=<id>               — table ARP     │
 * │  GET  /onos/v1/csr/ospf?device=<id>              — OSPF oper     │
 * │  GET  /onos/v1/csr/bgp?device=<id>               — BGP RIB       │
 * │  GET  /onos/v1/csr/cdp?device=<id>               — voisins CDP   │
 * │  GET  /onos/v1/csr/ntp?device=<id>               — statut NTP    │
 * │  GET  /onos/v1/csr/dhcp?device=<id>              — pools DHCP    │
 * ├──────────────────────────────────────────────────────────────────┤
 * │  LOGS                                                             │
 * ├──────────────────────────────────────────────────────────────────┤
 * │  GET  /onos/v1/csr/logs?device=<id>&limit=100    — syslog        │
 * ├──────────────────────────────────────────────────────────────────┤
 * │  CONFIGURATION (écriture)                                        │
 * ├──────────────────────────────────────────────────────────────────┤
 * │  PATCH /onos/v1/csr/config/hostname?device=<id>                  │
 * │  PATCH /onos/v1/csr/config/interface?device=<id>                 │
 * │  POST  /onos/v1/csr/config/routes/static?device=<id>             │
 * │  DELETE /onos/v1/csr/config/routes/static?device=<id>            │
 * │  PATCH /onos/v1/csr/config/ntp?device=<id>                       │
 * ├──────────────────────────────────────────────────────────────────┤
 * │  HEALTH                                                           │
 * ├──────────────────────────────────────────────────────────────────┤
 * │  GET  /onos/v1/csr/health?device=<id>                            │
 * └──────────────────────────────────────────────────────────────────┘
 *
 * Paramètre ?device= : ID ONOS du device, ex: netconf:192.168.1.11:830
 * Si omis, utilise le premier device NETCONF Cisco disponible.
 *
 * Authentification : Basic auth ONOS (onos / rocks) — héritée de ONOS.
 */
@Path("")
public class CsrWebResource extends AbstractWebResource {

    // ── Résolution du DeviceId ────────────────────────────────────────

    /**
     * Retourne le DeviceId depuis le paramètre ?device=
     * ou le premier device NETCONF disponible si absent.
     */
    private DeviceId resolveDevice(String deviceParam) {
        if (deviceParam != null && !deviceParam.isBlank()) {
            return DeviceId.deviceId(deviceParam);
        }
        // Auto-detect : premier device NETCONF dans la liste
        CsrManagerService svc = get(CsrManagerService.class);
        ArrayNode devices = svc.getNetconfDevices();
        if (devices.size() > 0) {
            return DeviceId.deviceId(devices.get(0).get("device_id").asText());
        }
        return DeviceId.deviceId("netconf:192.168.1.11:830");
    }

    private CsrManagerService svc() {
        return get(CsrManagerService.class);
    }

    private Response configResult(ObjectNode result) {
        if (!result.path("success").asBoolean(false)) {
            return Response.status(Response.Status.BAD_GATEWAY).entity(result).build();
        }
        return ok(result).build();
    }

    // ════════════════════════════════════════════════════════════════
    //  DEVICES
    // ════════════════════════════════════════════════════════════════

    @GET @Path("devices")
    @Produces(MediaType.APPLICATION_JSON)
    public Response getDevices() {
        return ok(svc().getNetconfDevices()).build();
    }

    // ════════════════════════════════════════════════════════════════
    //  MÉTRIQUES SYSTÈME
    // ════════════════════════════════════════════════════════════════

    @GET @Path("cpu")
    @Produces(MediaType.APPLICATION_JSON)
    public Response getCpu(@QueryParam("device") String device) {
        return ok(svc().getCpu(resolveDevice(device))).build();
    }

    /** Historique CPU (ring buffer 120 points — 1h à 30s d'intervalle). */
    @GET @Path("cpu/history")
    @Produces(MediaType.APPLICATION_JSON)
    public Response getCpuHistory(@QueryParam("device") String device) {
        DeviceId id = resolveDevice(device);
        Deque<MetricsStore.CpuPoint> history = MetricsStore.getCpuHistory(id);
        ArrayNode arr = mapper().createArrayNode();
        for (MetricsStore.CpuPoint p : history) {
            ObjectNode n = mapper().createObjectNode();
            n.put("ts",           p.timestamp);
            n.put("five_seconds", p.fiveSeconds);
            n.put("one_minute",   p.oneMinute);
            n.put("five_minutes", p.fiveMinutes);
            arr.add(n);
        }
        return ok(arr).build();
    }

    @GET @Path("memory")
    @Produces(MediaType.APPLICATION_JSON)
    public Response getMemory(@QueryParam("device") String device) {
        return ok(svc().getMemory(resolveDevice(device))).build();
    }

    @GET @Path("processes")
    @Produces(MediaType.APPLICATION_JSON)
    public Response getProcesses(@QueryParam("device") String device) {
        return ok(svc().getProcesses(resolveDevice(device))).build();
    }

    @GET @Path("environment")
    @Produces(MediaType.APPLICATION_JSON)
    public Response getEnvironment(@QueryParam("device") String device) {
        return ok(svc().getEnvironment(resolveDevice(device))).build();
    }

    @GET @Path("version")
    @Produces(MediaType.APPLICATION_JSON)
    public Response getVersion(@QueryParam("device") String device) {
        return ok(svc().getVersion(resolveDevice(device))).build();
    }

    // ════════════════════════════════════════════════════════════════
    //  INTERFACES
    // ════════════════════════════════════════════════════════════════

    @GET @Path("interfaces")
    @Produces(MediaType.APPLICATION_JSON)
    public Response getInterfacesConfig(@QueryParam("device") String device) {
        return ok(svc().getInterfacesConfig(resolveDevice(device))).build();
    }

    @GET @Path("interfaces/oper")
    @Produces(MediaType.APPLICATION_JSON)
    public Response getInterfacesOper(@QueryParam("device") String device) {
        return ok(svc().getInterfacesOper(resolveDevice(device))).build();
    }

    // ════════════════════════════════════════════════════════════════
    //  ROUTAGE
    // ════════════════════════════════════════════════════════════════

    @GET @Path("routes")
    @Produces(MediaType.APPLICATION_JSON)
    public Response getRoutes(@QueryParam("device") String device) {
        return ok(svc().getRoutes(resolveDevice(device))).build();
    }

    @GET @Path("routes/static")
    @Produces(MediaType.APPLICATION_JSON)
    public Response getStaticRoutes(@QueryParam("device") String device) {
        return ok(svc().getStaticRoutesConfig(resolveDevice(device))).build();
    }

    @GET @Path("arp")
    @Produces(MediaType.APPLICATION_JSON)
    public Response getArp(@QueryParam("device") String device) {
        return ok(svc().getArp(resolveDevice(device))).build();
    }

    @GET @Path("ospf")
    @Produces(MediaType.APPLICATION_JSON)
    public Response getOspf(@QueryParam("device") String device) {
        return ok(svc().getOspf(resolveDevice(device))).build();
    }

    @GET @Path("bgp")
    @Produces(MediaType.APPLICATION_JSON)
    public Response getBgp(@QueryParam("device") String device) {
        return ok(svc().getBgp(resolveDevice(device))).build();
    }

    @GET @Path("cdp")
    @Produces(MediaType.APPLICATION_JSON)
    public Response getCdp(@QueryParam("device") String device) {
        return ok(svc().getCdp(resolveDevice(device))).build();
    }

    @GET @Path("ntp")
    @Produces(MediaType.APPLICATION_JSON)
    public Response getNtp(@QueryParam("device") String device) {
        return ok(svc().getNtp(resolveDevice(device))).build();
    }

    @GET @Path("dhcp")
    @Produces(MediaType.APPLICATION_JSON)
    public Response getDhcp(@QueryParam("device") String device) {
        return ok(svc().getDhcpPools(resolveDevice(device))).build();
    }

    // ════════════════════════════════════════════════════════════════
    //  LOGS
    // ════════════════════════════════════════════════════════════════

    @GET @Path("logs")
    @Produces(MediaType.APPLICATION_JSON)
    public Response getLogs(
            @QueryParam("device") String device,
            @QueryParam("limit")  @DefaultValue("100") int limit) {
        return ok(svc().getSyslog(resolveDevice(device), limit)).build();
    }

    // ════════════════════════════════════════════════════════════════
    //  HEALTH
    // ════════════════════════════════════════════════════════════════

    @GET @Path("health")
    @Produces(MediaType.APPLICATION_JSON)
    public Response health(@QueryParam("device") String device) {
        DeviceId id        = resolveDevice(device);
        boolean  available = svc().isDeviceAvailable(id);
        ObjectNode n = mapper().createObjectNode();
        n.put("device_id", id.toString());
        n.put("available", available);
        return ok(n).build();
    }

    // ════════════════════════════════════════════════════════════════
    //  CONFIGURATION — HOSTNAME
    // ════════════════════════════════════════════════════════════════

    @PATCH @Path("config/hostname")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public Response setHostname(
            @QueryParam("device") String device,
            InputStream body) {
        ObjectNode req = readTreeFromStream(mapper(), body);
        String hostname = req.path("hostname").asText("").trim();
        if (hostname.isEmpty())
            return Response.status(400)
                    .entity("{\"error\":\"Le champ 'hostname' est requis\"}").build();
        return configResult(svc().setHostname(resolveDevice(device), hostname));
    }

    // ════════════════════════════════════════════════════════════════
    //  CONFIGURATION — INTERFACE
    // ════════════════════════════════════════════════════════════════

    @PATCH @Path("config/interface")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public Response configureInterface(
            @QueryParam("device") String device,
            InputStream body) {
        ObjectNode req  = readTreeFromStream(mapper(), body);
        String name     = req.path("name").asText("").trim();
        String desc     = req.has("description") ? req.get("description").asText() : null;
        Boolean enabled = req.has("enabled")     ? req.get("enabled").asBoolean()  : null;

        if (name.isEmpty())
            return Response.status(400)
                    .entity("{\"error\":\"Le champ 'name' est requis\"}").build();
        if (desc == null && enabled == null)
            return Response.status(400)
                    .entity("{\"error\":\"Au moins 'description' ou 'enabled' requis\"}").build();

        return configResult(svc().configureInterface(resolveDevice(device), name, desc, enabled));
    }

    // ════════════════════════════════════════════════════════════════
    //  CONFIGURATION — ROUTES STATIQUES
    // ════════════════════════════════════════════════════════════════

    @POST @Path("config/routes/static")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public Response addStaticRoute(
            @QueryParam("device") String device,
            InputStream body) {
        ObjectNode req = readTreeFromStream(mapper(), body);
        String prefix  = req.path("prefix").asText("").trim();
        String mask    = req.path("mask").asText("").trim();
        String nextHop = req.path("next_hop").asText("").trim();

        if (prefix.isEmpty() || mask.isEmpty() || nextHop.isEmpty())
            return Response.status(400)
                    .entity("{\"error\":\"prefix, mask et next_hop sont requis\"}").build();

        return configResult(svc().addStaticRoute(resolveDevice(device), prefix, mask, nextHop));
    }

    @DELETE @Path("config/routes/static")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public Response deleteStaticRoute(
            @QueryParam("device") String device,
            InputStream body) {
        ObjectNode req = readTreeFromStream(mapper(), body);
        String prefix  = req.path("prefix").asText("").trim();
        String mask    = req.path("mask").asText("").trim();
        String nextHop = req.path("next_hop").asText("").trim();

        if (prefix.isEmpty() || mask.isEmpty() || nextHop.isEmpty())
            return Response.status(400)
                    .entity("{\"error\":\"prefix, mask et next_hop sont requis\"}").build();

        return configResult(svc().deleteStaticRoute(resolveDevice(device), prefix, mask, nextHop));
    }

    // ════════════════════════════════════════════════════════════════
    //  CONFIGURATION — NTP
    // ════════════════════════════════════════════════════════════════

    @PATCH @Path("config/ntp")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public Response setNtp(
            @QueryParam("device") String device,
            InputStream body) {
        ObjectNode req = readTreeFromStream(mapper(), body);
        String server  = req.path("server").asText("").trim();
        if (server.isEmpty())
            return Response.status(400)
                    .entity("{\"error\":\"Le champ 'server' est requis\"}").build();
        return configResult(svc().setNtpServer(resolveDevice(device), server));
    }

    // ── Helper ────────────────────────────────────────────────────────

    private ObjectNode readTreeFromStream(com.fasterxml.jackson.databind.ObjectMapper m,
                                          InputStream is) {
        try {
            return (ObjectNode) m.readTree(is);
        } catch (Exception e) {
            return m.createObjectNode();
        }
    }
}
