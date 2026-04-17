package org.onos.csrmanager.rest;

import org.onlab.rest.AbstractWebApplication;
import org.osgi.service.component.annotations.Component;

import javax.ws.rs.core.Application;

import java.util.Set;

/**
 * JAX-RS Application — enregistre CsrWebResource dans ONOS.
 *
 * Le contexte REST est défini dans pom.xml :
 *   <web.context>/onos/v1/csr</web.context>
 *
 * Tous les endpoints seront donc disponibles sous :
 *   http://localhost:8181/onos/v1/csr/...
 */
@Component(immediate = true, service = Application.class)
public class CsrApplication extends AbstractWebApplication {

    @Override
    public Set<Class<?>> getClasses() {
        return getClasses(CsrWebResource.class, JsonNodeBodyWriter.class);
    }
}
