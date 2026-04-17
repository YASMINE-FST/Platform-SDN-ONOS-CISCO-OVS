package org.onos.csrmanager.rest;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import javax.ws.rs.Produces;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.MultivaluedMap;
import javax.ws.rs.ext.MessageBodyWriter;
import javax.ws.rs.ext.Provider;
import java.io.IOException;
import java.io.OutputStream;
import java.lang.annotation.Annotation;
import java.lang.reflect.Type;

/**
 * Sérialiseur générique pour tous les sous-types de Jackson JsonNode
 * (ObjectNode, ArrayNode, ValueNode, ...).
 *
 * ONOS fournit déjà JsonBodyWriter mais il ne déclare writable QUE pour
 * ObjectNode.class — d'où des HTTP 500 dès qu'un endpoint renvoie un
 * ArrayNode (ex: /devices, /memory, /interfaces, /routes, /logs ...).
 *
 * Ce provider est enregistré par CsrApplication.getClasses() et couvre
 * tout JsonNode, ce qui débloque la sérialisation des collections.
 */
@Provider
@Produces(MediaType.APPLICATION_JSON)
public class JsonNodeBodyWriter implements MessageBodyWriter<JsonNode> {

    private final ObjectMapper mapper = new ObjectMapper();

    @Override
    public boolean isWriteable(Class<?> type, Type genericType,
                               Annotation[] annotations, MediaType mediaType) {
        return JsonNode.class.isAssignableFrom(type);
    }

    @Override
    public long getSize(JsonNode node, Class<?> type, Type genericType,
                        Annotation[] annotations, MediaType mediaType) {
        return -1;
    }

    @Override
    public void writeTo(JsonNode node, Class<?> type, Type genericType,
                        Annotation[] annotations, MediaType mediaType,
                        MultivaluedMap<String, Object> httpHeaders,
                        OutputStream entityStream) throws IOException {
        mapper.writer().writeValue(entityStream, node);
        entityStream.flush();
    }
}
