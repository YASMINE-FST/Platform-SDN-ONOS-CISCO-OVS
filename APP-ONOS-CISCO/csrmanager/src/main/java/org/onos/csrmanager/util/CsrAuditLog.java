package org.onos.csrmanager.util;

import org.onosproject.net.DeviceId;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardOpenOption;
import java.time.Instant;
import java.time.format.DateTimeFormatter;

/**
 * Audit log append-only pour toutes les opérations de configuration
 * poussées via CsrConfigurator (save / backup / restore, hostname,
 * interface, routes statiques, ntp).
 *
 * Fichier : ${karaf.data}/csrmanager/audit.log
 *           (fallback : java.io.tmpdir si karaf.data absent, utile en tests).
 *
 * Format d'une ligne (pipe-séparé pour grep facile) :
 *   2026-04-18T20:05:12.345Z | OK   | action | device_id | details
 *
 * Également exposé : baseDir() que CsrConfigurator utilise pour stocker
 * les fichiers de backup sous backups/.
 */
public final class CsrAuditLog {

    private CsrAuditLog() {}

    private static final Logger log = LoggerFactory.getLogger(CsrAuditLog.class);
    private static final DateTimeFormatter TS = DateTimeFormatter.ISO_INSTANT;

    private static final Path BASE_DIR;
    private static final Path AUDIT_FILE;

    static {
        String base = System.getProperty("karaf.data");
        Path dir = (base != null && !base.isBlank())
                ? Paths.get(base, "csrmanager")
                : Paths.get(System.getProperty("java.io.tmpdir", "/tmp"), "csrmanager");
        BASE_DIR = dir;
        AUDIT_FILE = BASE_DIR.resolve("audit.log");
    }

    /** Racine du stockage de l'application : audit.log + backups/ */
    public static Path baseDir() {
        return BASE_DIR;
    }

    /** Chemin complet du fichier audit.log. */
    public static Path auditFile() {
        return AUDIT_FILE;
    }

    /**
     * Écrit une ligne dans le journal d'audit. Thread-safe (synchronized).
     *
     * @param action   nom de l'opération (ex: "setHostname", "save-config")
     * @param device   device ciblé (peut être null pour une opération globale)
     * @param success  résultat
     * @param details  message libre (erreur NETCONF, paramètres, filename…)
     */
    public static synchronized void record(String action,
                                           DeviceId device,
                                           boolean success,
                                           String details) {
        try {
            Files.createDirectories(BASE_DIR);
            String safeDetails = details == null ? ""
                    : details.replace('\n', ' ').replace('|', '/');
            String line = String.format("%s | %-4s | %s | %s | %s%n",
                    TS.format(Instant.now()),
                    success ? "OK" : "FAIL",
                    action,
                    device == null ? "-" : device.toString(),
                    safeDetails);
            Files.write(AUDIT_FILE, line.getBytes(StandardCharsets.UTF_8),
                    StandardOpenOption.CREATE, StandardOpenOption.APPEND);
        } catch (IOException e) {
            log.warn("Audit write failed ({}): {}", AUDIT_FILE, e.getMessage());
        }
    }
}
