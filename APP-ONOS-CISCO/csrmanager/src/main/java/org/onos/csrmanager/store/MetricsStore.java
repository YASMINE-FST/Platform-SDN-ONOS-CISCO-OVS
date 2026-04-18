package org.onos.csrmanager.store;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.onosproject.net.DeviceId;

import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Cache en mémoire (thread-safe) pour les métriques collectées.
 *
 * Structure par device :
 *   - Dernière valeur (latest) de chaque métrique
 *   - Historique circulaire des CPU (max 120 points = 1h à 30s)
 *
 * Utilisé par :
 *   - AppComponent (écriture depuis le thread de polling)
 *   - CsrWebResource (lecture depuis les threads HTTP)
 *
 * Règle de mise à jour :
 *   Les nœuds « erreur » renvoyés par les collecteurs (ObjectNode avec un
 *   seul champ "error" ou ArrayNode contenant un seul objet d'erreur) ne
 *   sont PAS cachés — on préfère garder la dernière valeur valide plutôt
 *   que d'empoisonner le cache avec un message d'erreur.
 */
public final class MetricsStore {

    private MetricsStore() {}

    // ── Taille de l'historique CPU ───────────────────────────────────
    private static final int HISTORY_SIZE = 120;   // 120 × 30s = 1 heure

    // ── Stockage existant ────────────────────────────────────────────
    private static final Map<String, ObjectNode>      cpuCache        = new ConcurrentHashMap<>();
    private static final Map<String, ArrayNode>       memoryCache     = new ConcurrentHashMap<>();
    private static final Map<String, ArrayNode>       interfacesCache = new ConcurrentHashMap<>(); // oper
    private static final Map<String, ArrayNode>       routesCache     = new ConcurrentHashMap<>();
    private static final Map<String, ArrayNode>       logsCache       = new ConcurrentHashMap<>();
    private static final Map<String, Deque<CpuPoint>> cpuHistory      = new ConcurrentHashMap<>();

    // ── Stockage additionnel (toutes les métriques read) ─────────────
    private static final Map<String, ArrayNode>  processesCache        = new ConcurrentHashMap<>();
    private static final Map<String, ArrayNode>  environmentCache      = new ConcurrentHashMap<>();
    private static final Map<String, ObjectNode> versionCache          = new ConcurrentHashMap<>();
    private static final Map<String, ArrayNode>  interfacesConfigCache = new ConcurrentHashMap<>();
    private static final Map<String, ArrayNode>  staticRoutesCache     = new ConcurrentHashMap<>();
    private static final Map<String, ArrayNode>  arpCache              = new ConcurrentHashMap<>();
    private static final Map<String, ArrayNode>  ospfCache             = new ConcurrentHashMap<>();
    private static final Map<String, ArrayNode>  bgpCache              = new ConcurrentHashMap<>();
    private static final Map<String, ArrayNode>  cdpCache              = new ConcurrentHashMap<>();
    private static final Map<String, ObjectNode> ntpCache              = new ConcurrentHashMap<>();
    private static final Map<String, ArrayNode>  dhcpCache             = new ConcurrentHashMap<>();

    // ── Détection des nœuds « erreur » ───────────────────────────────

    private static boolean isErrorObject(ObjectNode n) {
        return n == null || (n.has("error") && n.size() == 1);
    }

    private static boolean isErrorArray(ArrayNode a) {
        if (a == null) return true;
        if (a.size() != 1) return false;
        JsonNode only = a.get(0);
        return only != null && only.isObject() && only.has("error") && only.size() == 1;
    }

    // ── Enregistrement (appelé par le polling) ───────────────────────

    public static void updateCpu(DeviceId id, ObjectNode data) {
        if (isErrorObject(data)) return;
        String key = id.toString();
        cpuCache.put(key, data);
        cpuHistory.computeIfAbsent(key, k -> new ArrayDeque<>());
        Deque<CpuPoint> hist = cpuHistory.get(key);
        synchronized (hist) {
            if (hist.size() >= HISTORY_SIZE) hist.pollFirst();
            hist.addLast(new CpuPoint(
                    Instant.now().toString(),
                    data.path("five_seconds").asInt(0),
                    data.path("one_minute").asInt(0),
                    data.path("five_minutes").asInt(0)
            ));
        }
    }

    public static void updateMemory(DeviceId id, ArrayNode data) {
        if (isErrorArray(data)) return;
        memoryCache.put(id.toString(), data);
    }

    public static void updateInterfaces(DeviceId id, ArrayNode data) {
        if (isErrorArray(data)) return;
        interfacesCache.put(id.toString(), data);
    }

    public static void updateRoutes(DeviceId id, ArrayNode data) {
        if (isErrorArray(data)) return;
        routesCache.put(id.toString(), data);
    }

    public static void updateLogs(DeviceId id, ArrayNode data) {
        if (isErrorArray(data)) return;
        logsCache.put(id.toString(), data);
    }

    public static void updateProcesses(DeviceId id, ArrayNode data) {
        if (isErrorArray(data)) return;
        processesCache.put(id.toString(), data);
    }

    public static void updateEnvironment(DeviceId id, ArrayNode data) {
        if (isErrorArray(data)) return;
        environmentCache.put(id.toString(), data);
    }

    public static void updateVersion(DeviceId id, ObjectNode data) {
        if (isErrorObject(data)) return;
        versionCache.put(id.toString(), data);
    }

    public static void updateInterfacesConfig(DeviceId id, ArrayNode data) {
        if (isErrorArray(data)) return;
        interfacesConfigCache.put(id.toString(), data);
    }

    public static void updateStaticRoutes(DeviceId id, ArrayNode data) {
        if (isErrorArray(data)) return;
        staticRoutesCache.put(id.toString(), data);
    }

    public static void updateArp(DeviceId id, ArrayNode data) {
        if (isErrorArray(data)) return;
        arpCache.put(id.toString(), data);
    }

    public static void updateOspf(DeviceId id, ArrayNode data) {
        if (isErrorArray(data)) return;
        ospfCache.put(id.toString(), data);
    }

    public static void updateBgp(DeviceId id, ArrayNode data) {
        if (isErrorArray(data)) return;
        bgpCache.put(id.toString(), data);
    }

    public static void updateCdp(DeviceId id, ArrayNode data) {
        if (isErrorArray(data)) return;
        cdpCache.put(id.toString(), data);
    }

    public static void updateNtp(DeviceId id, ObjectNode data) {
        if (isErrorObject(data)) return;
        ntpCache.put(id.toString(), data);
    }

    public static void updateDhcp(DeviceId id, ArrayNode data) {
        if (isErrorArray(data)) return;
        dhcpCache.put(id.toString(), data);
    }

    // ── Lecture (appelée par le REST) ────────────────────────────────

    public static ObjectNode getCpu(DeviceId id)              { return cpuCache.get(id.toString()); }
    public static ArrayNode  getMemory(DeviceId id)           { return memoryCache.get(id.toString()); }
    public static ArrayNode  getInterfaces(DeviceId id)       { return interfacesCache.get(id.toString()); }
    public static ArrayNode  getRoutes(DeviceId id)           { return routesCache.get(id.toString()); }
    public static ArrayNode  getLogs(DeviceId id)             { return logsCache.get(id.toString()); }
    public static ArrayNode  getProcesses(DeviceId id)        { return processesCache.get(id.toString()); }
    public static ArrayNode  getEnvironment(DeviceId id)      { return environmentCache.get(id.toString()); }
    public static ObjectNode getVersion(DeviceId id)          { return versionCache.get(id.toString()); }
    public static ArrayNode  getInterfacesConfig(DeviceId id) { return interfacesConfigCache.get(id.toString()); }
    public static ArrayNode  getStaticRoutes(DeviceId id)     { return staticRoutesCache.get(id.toString()); }
    public static ArrayNode  getArp(DeviceId id)              { return arpCache.get(id.toString()); }
    public static ArrayNode  getOspf(DeviceId id)             { return ospfCache.get(id.toString()); }
    public static ArrayNode  getBgp(DeviceId id)              { return bgpCache.get(id.toString()); }
    public static ArrayNode  getCdp(DeviceId id)              { return cdpCache.get(id.toString()); }
    public static ObjectNode getNtp(DeviceId id)              { return ntpCache.get(id.toString()); }
    public static ArrayNode  getDhcp(DeviceId id)             { return dhcpCache.get(id.toString()); }

    /**
     * Retourne un snapshot (copie) de l'historique CPU pour un device.
     * On copie sous synchronized pour éviter ConcurrentModificationException
     * pendant l'itération côté HTTP : le polling background écrit sur la
     * Deque originale en parallèle.
     */
    public static Deque<CpuPoint> getCpuHistory(DeviceId id) {
        Deque<CpuPoint> hist = cpuHistory.get(id.toString());
        if (hist == null) return new ArrayDeque<>();
        synchronized (hist) {
            return new ArrayDeque<>(hist);
        }
    }

    // ── Modèle point d'historique ────────────────────────────────────

    public static class CpuPoint {
        public final String timestamp;
        public final int fiveSeconds;
        public final int oneMinute;
        public final int fiveMinutes;

        public CpuPoint(String timestamp, int fiveSeconds, int oneMinute, int fiveMinutes) {
            this.timestamp   = timestamp;
            this.fiveSeconds = fiveSeconds;
            this.oneMinute   = oneMinute;
            this.fiveMinutes = fiveMinutes;
        }
    }
}
