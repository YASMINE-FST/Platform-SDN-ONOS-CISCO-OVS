package org.onos.csrmanager.store;

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
 */
public final class MetricsStore {

    private MetricsStore() {}

    // ── Taille de l'historique CPU ───────────────────────────────────
    private static final int HISTORY_SIZE = 120;   // 120 × 30s = 1 heure

    // ── Stockage ─────────────────────────────────────────────────────

    private static final Map<String, ObjectNode>          cpuCache        = new ConcurrentHashMap<>();
    private static final Map<String, ArrayNode>           memoryCache     = new ConcurrentHashMap<>();
    private static final Map<String, ArrayNode>           interfacesCache = new ConcurrentHashMap<>();
    private static final Map<String, ArrayNode>           routesCache     = new ConcurrentHashMap<>();
    private static final Map<String, ArrayNode>           logsCache       = new ConcurrentHashMap<>();
    private static final Map<String, Deque<CpuPoint>>     cpuHistory      = new ConcurrentHashMap<>();

    // ── Enregistrement (appelé par le polling) ───────────────────────

    public static void updateCpu(DeviceId id, ObjectNode data) {
        if (data == null) return;
        String key = id.toString();
        cpuCache.put(key, data);
        // Historique
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
        if (data == null) return;
        memoryCache.put(id.toString(), data);
    }

    public static void updateInterfaces(DeviceId id, ArrayNode data) {
        if (data == null) return;
        interfacesCache.put(id.toString(), data);
    }

    public static void updateRoutes(DeviceId id, ArrayNode data) {
        if (data == null) return;
        routesCache.put(id.toString(), data);
    }

    public static void updateLogs(DeviceId id, ArrayNode data) {
        if (data == null) return;
        logsCache.put(id.toString(), data);
    }

    // ── Lecture (appelée par le REST) ────────────────────────────────

    public static ObjectNode getCpu(DeviceId id) {
        return cpuCache.get(id.toString());
    }

    public static ArrayNode getMemory(DeviceId id) {
        return memoryCache.get(id.toString());
    }

    public static ArrayNode getInterfaces(DeviceId id) {
        return interfacesCache.get(id.toString());
    }

    public static ArrayNode getRoutes(DeviceId id) {
        return routesCache.get(id.toString());
    }

    public static ArrayNode getLogs(DeviceId id) {
        return logsCache.get(id.toString());
    }

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
