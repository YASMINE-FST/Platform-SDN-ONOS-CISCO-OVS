package org.onos.csrmanager;

import org.onosproject.net.DeviceId;
import org.onosproject.netconf.DatastoreId;
import org.onosproject.netconf.NetconfController;
import org.onosproject.netconf.NetconfDevice;
import org.onosproject.netconf.NetconfException;
import org.onosproject.netconf.NetconfSession;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Helper pour obtenir et utiliser la session NETCONF d'un device ONOS.
 *
 * Usage dans un collecteur :
 * <pre>
 *   CsrNetconfSession sess = new CsrNetconfSession(controller, deviceId);
 *   String xml = sess.get(filterXml);          // <get> operational
 *   String xml = sess.getConfig(filterXml);    // <get-config> running
 *   sess.editConfig(configXml);                // <edit-config>
 * </pre>
 *
 * ONOS gère déjà la connexion SSH vers le routeur.
 * On utilise la session déjà établie — pas besoin d'ouvrir un nouveau SSH.
 */
public class CsrNetconfSession {

    private final Logger log = LoggerFactory.getLogger(getClass());

    private final NetconfController controller;
    private final DeviceId          deviceId;

    public CsrNetconfSession(NetconfController controller, DeviceId deviceId) {
        this.controller = controller;
        this.deviceId   = deviceId;
    }

    // ── Accès à la session ───────────────────────────────────────────

    /**
     * Retourne la session NETCONF active, ou null si le device n'est pas disponible.
     */
    public NetconfSession session() {
        NetconfDevice dev = controller.getDevicesMap().get(deviceId);
        if (dev == null) {
            log.warn("Device {} non trouvé dans NetconfController", deviceId);
            return null;
        }
        try {
            return dev.getSession();
        } catch (Exception e) {
            log.warn("Impossible d'obtenir la session pour {} : {}", deviceId, e.getMessage());
            return null;
        }
    }

    // ── Requêtes NETCONF ─────────────────────────────────────────────

    /**
     * Envoie un RPC <get> avec le filtre fourni.
     * Retourne le XML de réponse ou null en cas d'erreur.
     *
     * @param filterXml  Contenu du <filter type="subtree">…</filter>
     *                   (sans les balises <get> et <filter>, juste le contenu YANG)
     */
    public String get(String filterXml) {
        NetconfSession s = session();
        if (s == null) return null;
        try {
            // ONOS wrappe automatiquement dans <rpc><get><filter>...</filter></get></rpc>
            return s.get(filterXml, null);
        } catch (NetconfException e) {
            log.warn("NETCONF get error [{} ] : {}", deviceId, e.getMessage());
            return null;
        }
    }

    /**
     * Envoie un RPC <get-config source="running"> avec filtre.
     *
     * @param filterXml  Contenu du filtre (YANG subtree)
     */
    public String getConfig(String filterXml) {
        NetconfSession s = session();
        if (s == null) return null;
        try {
            return s.getConfig(DatastoreId.RUNNING, filterXml);
        } catch (NetconfException e) {
            log.warn("NETCONF get-config error [{}] : {}", deviceId, e.getMessage());
            return null;
        }
    }

    /**
     * Envoie un RPC <edit-config target="running"> avec la config fournie.
     *
     * @param configXml  Contenu INTERNE du <config>…</config>
     *                   (sans les balises <config>, <edit-config> ni <rpc>)
     * @return true si succès
     */
    public boolean editConfig(String configXml) {
        String reply = editConfigReply(configXml);
        return isSuccessfulReply(reply);
    }

    /**
     * Envoie un <edit-config> et retourne le XML brut de la réponse.
     *
     * @param configXml         Contenu INTERNE du <config>…</config>
     * @param defaultOperation  Optionnel, ex: "merge" ou "replace"
     * @return XML complet du rpc-reply, ou null en cas d'erreur locale ONOS/NETCONF
     */
    public String editConfigReply(String configXml, String defaultOperation) {
        NetconfSession s = session();
        if (s == null) return null;
        String payload = configXml == null ? "" : configXml.trim();
        try {
            StringBuilder rpc = new StringBuilder();
            rpc.append("<edit-config>\n");
            rpc.append("<target><running/></target>\n");
            if (defaultOperation != null && !defaultOperation.isBlank()) {
                rpc.append("<default-operation>")
                   .append(defaultOperation)
                   .append("</default-operation>\n");
            }
            rpc.append("<config xmlns:nc=\"urn:ietf:params:xml:ns:netconf:base:1.0\">\n");
            rpc.append(payload);
            rpc.append("\n</config>\n");
            rpc.append("</edit-config>\n");
            return s.doWrappedRpc(rpc.toString());
        } catch (NetconfException e) {
            log.warn("NETCONF edit-config error [{}] : {}", deviceId, e.getMessage());
            return null;
        }
    }

    public String editConfigReply(String configXml) {
        return editConfigReply(configXml, null);
    }

    /**
     * Envoie un RPC complet (doWrappedRpc).
     * Utilisé pour les RPCs non-standards (ex: save-config, discard-changes).
     *
     * @param rpcContent  Corps du RPC (sans les balises <rpc>)
     */
    public String doRpc(String rpcContent) {
        NetconfSession s = session();
        if (s == null) return null;
        try {
            return s.doWrappedRpc(rpcContent);
        } catch (NetconfException e) {
            log.warn("NETCONF rpc error [{}] : {}", deviceId, e.getMessage());
            return null;
        }
    }

    // ── DeviceId ─────────────────────────────────────────────────────

    public DeviceId deviceId() {
        return deviceId;
    }

    public boolean isAvailable() {
        return session() != null;
    }

    private boolean isSuccessfulReply(String replyXml) {
        if (replyXml == null || replyXml.isBlank()) {
            return false;
        }
        if (!replyXml.contains("<rpc-error>")) {
            return true;
        }
        if (replyXml.contains("<ok/>")) {
            return true;
        }
        return replyXml.contains("<error-severity>warning</error-severity>");
    }
}
