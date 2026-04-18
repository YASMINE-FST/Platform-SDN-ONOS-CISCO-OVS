package org.onos.csrmanager.rest;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.onos.csrmanager.CsrManagerService;
import org.onos.csrmanager.store.MetricsStore;
import org.onosproject.net.DeviceId;
import org.onosproject.rest.AbstractWebResource;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.ws.rs.*;
import javax.ws.rs.WebApplicationException;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;
import java.io.InputStream;
import java.util.Deque;
import java.util.function.Supplier;

/**
 * Endpoints REST de l'application CsrManager.
 *
 * Contexte de base : /csr/v1 (défini dans pom.xml + web.xml).
 *
 * ─────────────────────────────────────────────────────────────────────
 *  MODÈLE DE LECTURE : cache-first
 * ─────────────────────────────────────────────────────────────────────
 *   Tous les GET suivent la même logique :
 *     1. Résoudre le DeviceId (paramètre ?device=… ou auto-détection).
 *     2. Si ?fresh=true          → appel NETCONF direct (bypass cache).
 *     3. Sinon si cache non-null → retour direct depuis MetricsStore.
 *     4. Sinon                   → fallback NETCONF + log INFO.
 *
 *   Conséquence : la plupart des requêtes sont servies en microsecondes
 *   depuis le cache peuplé toutes les 30 s par AppComponent.collectAll().
 *
 * ─────────────────────────────────────────────────────────────────────
 *  COMPATIBILITÉ
 * ─────────────────────────────────────────────────────────────────────
 *   - Mêmes chemins, mêmes formats JSON que la version précédente.
 *   - ?fresh=true est OPTIONNEL (omis = cache-first).
 *   - Endpoints config (PATCH / POST / DELETE) : inchangés, toujours live.
 *   - /cpu/history : inchangé (lit déjà MetricsStore).
 *   - /devices et /health : inchangés (fournis par l'ONOS DeviceService).
 */
@Path("")
public class CsrWebResource extends AbstractWebResource {

    private static final Logger log = LoggerFactory.getLogger(CsrWebResource.class);

    // ── Résolution du DeviceId ────────────────────────────────────────

    /**
     * Résout le DeviceId à utiliser depuis le paramètre ?device=… ou par
     * auto-sélection via l'ONOS DeviceService.
     *
     *   Cas 1 — paramètre fourni : on valide qu'il correspond à un device
     *           NETCONF réellement enregistré dans ONOS.
     *             ► trouvé      → on le retourne
     *             ► inconnu     → 400 (WebApplicationException)
     *
     *   Cas 2 — paramètre absent :
     *             ► 0 device    → null (mode dev — voir noDevice())
     *             ► 1 device    → auto-sélection silencieuse (compat existante)
     *             ► N devices   → 400, paramètre ?device requis
     *
     * En mode « 0 device » on retourne null plutôt qu'une 404 afin que
     * l'application reste utilisable en développement / tests locaux
     * quand aucun CSR1000V n'est encore provisionné. Les endpoints
     * détectent ce cas et renvoient un 200 avec un corps d'erreur explicite
     * via noDevice().
     */
    private DeviceId resolveDevice(String deviceParam) {
        ArrayNode devs = svc().getNetconfDevices();

        // Mode dev : aucun routeur NETCONF → on signale l'absence au caller
        // via null. Si un paramètre ?device= est quand même fourni, on
        // préfère le 400 « device inconnu » qui est plus informatif.
        if (devs.size() == 0 && (deviceParam == null || deviceParam.isBlank())) {
            return null;
        }

        if (deviceParam != null && !deviceParam.isBlank()) {
            String requested = deviceParam.trim();
            for (int i = 0; i < devs.size(); i++) {
                if (requested.equals(devs.get(i).path("device_id").asText())) {
                    return DeviceId.deviceId(requested);
                }
            }
            throw new WebApplicationException(errorJson(400,
                    "device '" + requested + "' inconnu dans ONOS. "
                            + "Voir GET /csr/v1/devices"));
        }

        if (devs.size() > 1) {
            throw new WebApplicationException(errorJson(400,
                    "Plusieurs devices NETCONF disponibles — "
                            + "précisez le paramètre ?device=<id>. "
                            + "Voir GET /csr/v1/devices"));
        }
        return DeviceId.deviceId(devs.get(0).path("device_id").asText());
    }

    /**
     * Réponse standard pour le mode « aucun device NETCONF connecté ».
     * HTTP 200 + corps JSON `{"error": "No NETCONF device connected"}`.
     * L'application reste donc navigable côté dashboard / tests.
     */
    private Response noDevice() {
        log.info("[csr-rest] no NETCONF device — returning dev-mode stub");
        return Response.ok(
                "{\"error\":\"No NETCONF device connected\"}",
                MediaType.APPLICATION_JSON).build();
    }

    private static Response errorJson(int status, String msg) {
        String body = "{\"error\":\""
                + msg.replace("\\", "\\\\").replace("\"", "\\\"")
                + "\"}";
        return Response.status(status)
                .type(MediaType.APPLICATION_JSON)
                .entity(body)
                .build();
    }

    private CsrManagerService svc() {
        return get(CsrManagerService.class);
    }

    private boolean isFresh(Boolean fresh) {
        return Boolean.TRUE.equals(fresh);
    }

    /**
     * Cache-first avec fallback NETCONF.
     *
     * @param id      device ciblé (pour le log)
     * @param metric  nom de la métrique (pour le log)
     * @param fresh   true → force l'appel NETCONF (bypass cache)
     * @param cached  valeur lue dans MetricsStore (peut être null)
     * @param live    supplier qui appelle le collecteur NETCONF
     */
    private JsonNode cacheOrFetch(DeviceId id, String metric, boolean fresh,
                                  JsonNode cached, Supplier<? extends JsonNode> live) {
        if (fresh) {
            log.info("[csr-rest] device={} metric={} → NETCONF (fresh=true)", id, metric);
            return live.get();
        }
        if (cached == null) {
            log.info("[csr-rest] device={} metric={} → NETCONF (cache miss)", id, metric);
            return live.get();
        }
        return cached;
    }

    private Response configResult(ObjectNode result) {
        if (!result.path("success").asBoolean(false)) {
            return Response.status(Response.Status.BAD_GATEWAY).entity(result).build();
        }
        return ok(result).build();
    }

    // ════════════════════════════════════════════════════════════════
    //  DEVICES  (fourni par ONOS DeviceService — pas de cache local)
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
    public Response getCpu(@QueryParam("device") String device,
                           @QueryParam("fresh")  Boolean fresh) {
        DeviceId id = resolveDevice(device);
        if (id == null) return noDevice();
        JsonNode data = cacheOrFetch(id, "cpu", isFresh(fresh),
                                     MetricsStore.getCpu(id),
                                     () -> svc().getCpu(id));
        return ok(data).build();
    }

    /** Historique CPU (ring buffer 120 points — 1h à 30s d'intervalle). */
    @GET @Path("cpu/history")
    @Produces(MediaType.APPLICATION_JSON)
    public Response getCpuHistory(@QueryParam("device") String device) {
        DeviceId id = resolveDevice(device);
        if (id == null) return noDevice();
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
    public Response getMemory(@QueryParam("device") String device,
                              @QueryParam("fresh")  Boolean fresh) {
        DeviceId id = resolveDevice(device);
        if (id == null) return noDevice();
        JsonNode data = cacheOrFetch(id, "memory", isFresh(fresh),
                                     MetricsStore.getMemory(id),
                                     () -> svc().getMemory(id));
        return ok(data).build();
    }

    @GET @Path("processes")
    @Produces(MediaType.APPLICATION_JSON)
    public Response getProcesses(@QueryParam("device") String device,
                                 @QueryParam("fresh")  Boolean fresh) {
        DeviceId id = resolveDevice(device);
        if (id == null) return noDevice();
        JsonNode data = cacheOrFetch(id, "processes", isFresh(fresh),
                                     MetricsStore.getProcesses(id),
                                     () -> svc().getProcesses(id));
        return ok(data).build();
    }

    @GET @Path("environment")
    @Produces(MediaType.APPLICATION_JSON)
    public Response getEnvironment(@QueryParam("device") String device,
                                   @QueryParam("fresh")  Boolean fresh) {
        DeviceId id = resolveDevice(device);
        if (id == null) return noDevice();
        JsonNode data = cacheOrFetch(id, "environment", isFresh(fresh),
                                     MetricsStore.getEnvironment(id),
                                     () -> svc().getEnvironment(id));
        return ok(data).build();
    }

    @GET @Path("version")
    @Produces(MediaType.APPLICATION_JSON)
    public Response getVersion(@QueryParam("device") String device,
                               @QueryParam("fresh")  Boolean fresh) {
        DeviceId id = resolveDevice(device);
        if (id == null) return noDevice();
        JsonNode data = cacheOrFetch(id, "version", isFresh(fresh),
                                     MetricsStore.getVersion(id),
                                     () -> svc().getVersion(id));
        return ok(data).build();
    }

    // ════════════════════════════════════════════════════════════════
    //  INTERFACES
    // ════════════════════════════════════════════════════════════════

    @GET @Path("interfaces")
    @Produces(MediaType.APPLICATION_JSON)
    public Response getInterfacesConfig(@QueryParam("device") String device,
                                        @QueryParam("fresh")  Boolean fresh) {
        DeviceId id = resolveDevice(device);
        if (id == null) return noDevice();
        JsonNode data = cacheOrFetch(id, "interfaces", isFresh(fresh),
                                     MetricsStore.getInterfacesConfig(id),
                                     () -> svc().getInterfacesConfig(id));
        return ok(data).build();
    }

    @GET @Path("interfaces/oper")
    @Produces(MediaType.APPLICATION_JSON)
    public Response getInterfacesOper(@QueryParam("device") String device,
                                      @QueryParam("fresh")  Boolean fresh) {
        DeviceId id = resolveDevice(device);
        if (id == null) return noDevice();
        JsonNode data = cacheOrFetch(id, "interfaces/oper", isFresh(fresh),
                                     MetricsStore.getInterfaces(id),
                                     () -> svc().getInterfacesOper(id));
        return ok(data).build();
    }

    // ════════════════════════════════════════════════════════════════
    //  ROUTAGE
    // ════════════════════════════════════════════════════════════════

    @GET @Path("routes")
    @Produces(MediaType.APPLICATION_JSON)
    public Response getRoutes(@QueryParam("device") String device,
                              @QueryParam("fresh")  Boolean fresh) {
        DeviceId id = resolveDevice(device);
        if (id == null) return noDevice();
        JsonNode data = cacheOrFetch(id, "routes", isFresh(fresh),
                                     MetricsStore.getRoutes(id),
                                     () -> svc().getRoutes(id));
        return ok(data).build();
    }

    @GET @Path("routes/static")
    @Produces(MediaType.APPLICATION_JSON)
    public Response getStaticRoutes(@QueryParam("device") String device,
                                    @QueryParam("fresh")  Boolean fresh) {
        DeviceId id = resolveDevice(device);
        if (id == null) return noDevice();
        JsonNode data = cacheOrFetch(id, "routes/static", isFresh(fresh),
                                     MetricsStore.getStaticRoutes(id),
                                     () -> svc().getStaticRoutesConfig(id));
        return ok(data).build();
    }

    @GET @Path("arp")
    @Produces(MediaType.APPLICATION_JSON)
    public Response getArp(@QueryParam("device") String device,
                           @QueryParam("fresh")  Boolean fresh) {
        DeviceId id = resolveDevice(device);
        if (id == null) return noDevice();
        JsonNode data = cacheOrFetch(id, "arp", isFresh(fresh),
                                     MetricsStore.getArp(id),
                                     () -> svc().getArp(id));
        return ok(data).build();
    }

    @GET @Path("ospf")
    @Produces(MediaType.APPLICATION_JSON)
    public Response getOspf(@QueryParam("device") String device,
                            @QueryParam("fresh")  Boolean fresh) {
        DeviceId id = resolveDevice(device);
        if (id == null) return noDevice();
        JsonNode data = cacheOrFetch(id, "ospf", isFresh(fresh),
                                     MetricsStore.getOspf(id),
                                     () -> svc().getOspf(id));
        return ok(data).build();
    }

    @GET @Path("bgp")
    @Produces(MediaType.APPLICATION_JSON)
    public Response getBgp(@QueryParam("device") String device,
                           @QueryParam("fresh")  Boolean fresh) {
        DeviceId id = resolveDevice(device);
        if (id == null) return noDevice();
        JsonNode data = cacheOrFetch(id, "bgp", isFresh(fresh),
                                     MetricsStore.getBgp(id),
                                     () -> svc().getBgp(id));
        return ok(data).build();
    }

    @GET @Path("cdp")
    @Produces(MediaType.APPLICATION_JSON)
    public Response getCdp(@QueryParam("device") String device,
                           @QueryParam("fresh")  Boolean fresh) {
        DeviceId id = resolveDevice(device);
        if (id == null) return noDevice();
        JsonNode data = cacheOrFetch(id, "cdp", isFresh(fresh),
                                     MetricsStore.getCdp(id),
                                     () -> svc().getCdp(id));
        return ok(data).build();
    }

    @GET @Path("ntp")
    @Produces(MediaType.APPLICATION_JSON)
    public Response getNtp(@QueryParam("device") String device,
                           @QueryParam("fresh")  Boolean fresh) {
        DeviceId id = resolveDevice(device);
        if (id == null) return noDevice();
        JsonNode data = cacheOrFetch(id, "ntp", isFresh(fresh),
                                     MetricsStore.getNtp(id),
                                     () -> svc().getNtp(id));
        return ok(data).build();
    }

    @GET @Path("dhcp")
    @Produces(MediaType.APPLICATION_JSON)
    public Response getDhcp(@QueryParam("device") String device,
                            @QueryParam("fresh")  Boolean fresh) {
        DeviceId id = resolveDevice(device);
        if (id == null) return noDevice();
        JsonNode data = cacheOrFetch(id, "dhcp", isFresh(fresh),
                                     MetricsStore.getDhcp(id),
                                     () -> svc().getDhcpPools(id));
        return ok(data).build();
    }

    // ════════════════════════════════════════════════════════════════
    //  LOGS
    //
    //  Le polling collecte toujours 100 entrées. Si le client demande
    //  limit <= taille cachée on tranche, sinon on rappelle NETCONF.
    // ════════════════════════════════════════════════════════════════

    @GET @Path("logs")
    @Produces(MediaType.APPLICATION_JSON)
    public Response getLogs(@QueryParam("device") String device,
                            @QueryParam("limit")  @DefaultValue("100") int limit,
                            @QueryParam("fresh")  Boolean fresh) {
        DeviceId id = resolveDevice(device);
        if (id == null) return noDevice();
        boolean forceLive = isFresh(fresh);
        ArrayNode cached = MetricsStore.getLogs(id);

        if (!forceLive && cached != null && limit <= cached.size()) {
            ArrayNode slice = mapper().createArrayNode();
            int end = Math.min(limit, cached.size());
            for (int i = 0; i < end; i++) slice.add(cached.get(i));
            return ok(slice).build();
        }

        String why = forceLive ? "fresh=true"
                : cached == null ? "cache miss"
                : "limit=" + limit + " > cache=" + cached.size();
        log.info("[csr-rest] device={} metric=logs → NETCONF ({})", id, why);
        return ok(svc().getSyslog(id, limit)).build();
    }

    // ════════════════════════════════════════════════════════════════
    //  HEALTH  (toujours live — reflète l'état réel de la session)
    // ════════════════════════════════════════════════════════════════

    @GET @Path("health")
    @Produces(MediaType.APPLICATION_JSON)
    public Response health(@QueryParam("device") String device) {
        DeviceId id        = resolveDevice(device);
        if (id == null) return noDevice();
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
        DeviceId id = resolveDevice(device);
        if (id == null) return noDevice();
        return configResult(svc().setHostname(id, hostname));
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

        DeviceId id = resolveDevice(device);
        if (id == null) return noDevice();
        return configResult(svc().configureInterface(id, name, desc, enabled));
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

        DeviceId id = resolveDevice(device);
        if (id == null) return noDevice();
        return configResult(svc().addStaticRoute(id, prefix, mask, nextHop));
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

        DeviceId id = resolveDevice(device);
        if (id == null) return noDevice();
        return configResult(svc().deleteStaticRoute(id, prefix, mask, nextHop));
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
        DeviceId id = resolveDevice(device);
        if (id == null) return noDevice();
        return configResult(svc().setNtpServer(id, server));
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
