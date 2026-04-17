package org.onos.csrmanager.util;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.Node;
import org.w3c.dom.NodeList;
import org.xml.sax.InputSource;

import javax.xml.parsers.DocumentBuilder;
import javax.xml.parsers.DocumentBuilderFactory;
import java.io.StringReader;
import java.util.ArrayList;
import java.util.List;

/**
 * Utilitaires statiques pour parser les réponses XML NETCONF.
 *
 * Les réponses NETCONF arrivent sous la forme :
 * <pre>
 *   <rpc-reply xmlns="urn:ietf:params:xml:ns:netconf:base:1.0">
 *     <data>
 *       <cpu-usage xmlns="http://cisco.com/ns/yang/...">
 *         <cpu-utilization>
 *           <five-seconds>3</five-seconds>
 *           <one-minute>2</one-minute>
 *         </cpu-utilization>
 *       </cpu-usage>
 *     </data>
 *   </rpc-reply>
 * </pre>
 *
 * Les méthodes utilisent getElementsByTagNameNS("*", localName)
 * pour être insensibles aux préfixes de namespace.
 */
public final class XmlParser {

    private static final Logger log = LoggerFactory.getLogger(XmlParser.class);

    private XmlParser() {}

    // ── Parse ────────────────────────────────────────────────────────

    /**
     * Parse une chaîne XML en Document DOM.
     * Retourne null si le XML est null, vide ou malformé.
     */
    public static Document parse(String xml) {
        if (xml == null || xml.isBlank()) return null;
        try {
            DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
            factory.setNamespaceAware(true);
            // Sécurité : désactiver les entités externes
            factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
            DocumentBuilder builder = factory.newDocumentBuilder();
            return builder.parse(new InputSource(new StringReader(xml)));
        } catch (Exception e) {
            log.warn("XmlParser.parse() erreur : {}", e.getMessage());
            return null;
        }
    }

    // ── Accès aux éléments ───────────────────────────────────────────

    /**
     * Retourne la liste de tous les éléments ayant ce nom local (ignore le namespace).
     */
    public static List<Element> getElements(Document doc, String localName) {
        List<Element> result = new ArrayList<>();
        if (doc == null) return result;
        NodeList nodes = doc.getElementsByTagNameNS("*", localName);
        for (int i = 0; i < nodes.getLength(); i++) {
            Node n = nodes.item(i);
            if (n instanceof Element) result.add((Element) n);
        }
        return result;
    }

    /**
     * Retourne le premier élément trouvé par nom local, ou null.
     */
    public static Element firstElement(Document doc, String localName) {
        List<Element> list = getElements(doc, localName);
        return list.isEmpty() ? null : list.get(0);
    }

    /**
     * Retourne le contenu texte du premier enfant direct portant ce nom.
     * Ex : getText(element, "five-seconds") → "3"
     */
    public static String getText(Element parent, String childLocalName) {
        if (parent == null) return "";
        NodeList nodes = parent.getElementsByTagNameNS("*", childLocalName);
        if (nodes.getLength() == 0) return "";
        return nodes.item(0).getTextContent().trim();
    }

    /**
     * Retourne getText converti en int (0 si absent ou invalide).
     */
    public static int getInt(Element parent, String childLocalName) {
        String s = getText(parent, childLocalName);
        if (s.isEmpty()) return 0;
        try { return Integer.parseInt(s); }
        catch (NumberFormatException e) { return 0; }
    }

    /**
     * Retourne getText converti en long (0 si absent ou invalide).
     */
    public static long getLong(Element parent, String childLocalName) {
        String s = getText(parent, childLocalName);
        if (s.isEmpty()) return 0L;
        try { return Long.parseLong(s); }
        catch (NumberFormatException e) { return 0L; }
    }

    /**
     * Retourne getText converti en boolean.
     * "true" / "1" → true, tout autre valeur → false.
     */
    public static boolean getBool(Element parent, String childLocalName) {
        String s = getText(parent, childLocalName);
        return "true".equalsIgnoreCase(s) || "1".equals(s);
    }

    /**
     * Liste tous les éléments enfants directs d'un élément parent
     * portant un nom local donné.
     */
    public static List<Element> childElements(Element parent, String localName) {
        List<Element> result = new ArrayList<>();
        if (parent == null) return result;
        NodeList nodes = parent.getElementsByTagNameNS("*", localName);
        for (int i = 0; i < nodes.getLength(); i++) {
            Node n = nodes.item(i);
            if (n instanceof Element && n.getParentNode() == parent) {
                result.add((Element) n);
            }
        }
        return result;
    }

    /**
     * Liste TOUS les descendants (à n'importe quelle profondeur) d'un
     * élément parent portant un nom local donné. Équivalent à
     * getElementsByTagNameNS("*", name) mais limité au sous-arbre de parent.
     */
    public static List<Element> descendants(Element parent, String localName) {
        List<Element> result = new ArrayList<>();
        if (parent == null) return result;
        NodeList nodes = parent.getElementsByTagNameNS("*", localName);
        for (int i = 0; i < nodes.getLength(); i++) {
            Node n = nodes.item(i);
            if (n instanceof Element) result.add((Element) n);
        }
        return result;
    }

    /**
     * Premier descendant (à n'importe quelle profondeur) ou null.
     */
    public static Element firstDescendant(Element parent, String localName) {
        List<Element> list = descendants(parent, localName);
        return list.isEmpty() ? null : list.get(0);
    }

    /**
     * Retourne le premier enfant direct d'un Element par nom local.
     */
    public static Element firstChild(Element parent, String localName) {
        List<Element> list = childElements(parent, localName);
        return list.isEmpty() ? null : list.get(0);
    }
}
