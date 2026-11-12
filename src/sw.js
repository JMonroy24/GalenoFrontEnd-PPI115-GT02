const CACHE_NAME = "galenosv-app-shell-v15";
const API_PATH = "/resources/v1/";

// Todo lo necesario para arrancar la SPA sin red (App Shell).
const APP_SHELL = [
    "/",
    "/index.html",
    "/manifest.json",
    "/recursos/estilos/principal.css",
    "/recursos/imagenes/galenosv-logo.png",
    "/recursos/imagenes/icono_192.png",
    "/recursos/imagenes/icono_512.png",
    "/js/app.js",
    "/js/boundary/busqueda_consulta_model.js",
    "/js/boundary/componentes/asistente_busqueda.js",
    "/js/boundary/componentes/autocomplete.js",
    "/js/boundary/componentes/autocomplete_cie10.js",
    "/js/boundary/componentes/buscador_persona.js",
    "/js/boundary/componentes/buscador_tipo_doc.js",
    "/js/boundary/componentes/buscador_tipo_documentos.js",
    "/js/boundary/componentes/encabezado_app.js",
    "/js/boundary/componentes/estado_red.js",
    "/js/boundary/componentes/historial_pasos.js",
    "/js/boundary/componentes/instalador_app.js",
    "/js/boundary/componentes/lista_examenes.js",
    "/js/boundary/componentes/menu_lateral.js",
    "/js/boundary/componentes/notificacion_emergente.js",
    "/js/boundary/componentes/pie_app.js",
    "/js/boundary/componentes/stepper_progreso.js",
    "/js/boundary/componentes/tarjeta_consulta.js",
    "/js/boundary/componentes/tarjeta_simple.js",
    "/js/boundary/login_model.js",
    "/js/boundary/vista_pendiente.js",
    "/js/boundary/vistas/atencion_consulta_view.js",
    "/js/boundary/vistas/busqueda_citas_view.js",
    "/js/boundary/vistas/dashboard_view.js",
    "/js/boundary/vistas/login_view.js",
    "/js/config.js",
    "/js/control/auth_service.js",
    "/js/control/cie10_service.js",
    "/js/control/clinica_service.js",
    "/js/control/consulta_service.js",
    "/js/control/default_service.js",
    "/js/control/examen_resultado_service.js",
    "/js/control/generador_mensajes.js",
    "/js/control/gestor_fechas.js",
    "/js/control/orden_examen_service.js",
    "/js/control/persona_rol_service.js",
    "/js/control/persona_service.js",
    "/js/control/procedimiento_service.js",
    "/js/control/rol_service.js",
    "/js/control/tipo_documento_service.js",
    "/js/control/tipo_examen_service.js",
    "/js/control/tipo_medio_contacto_service.js",
    "/js/entity/default_error.js",
    "/js/entity/default_response.js",
    "/js/router.js",
    "/js/routes.js",
    "/js/store.js"
];

const respuestaSinConexion = () => new Response(
    JSON.stringify({
        message: "No hay conexión y el recurso no está disponible sin conexión."
    }),
    {
        status: 503,
        headers: { "Content-Type": "application/json; charset=utf-8" }
    }
);

/**
 * API REST (lecturas): Network First con caché de respaldo.
 * Con red se actualiza la copia; sin red se sirve la última copia guardada.
 */
const networkFirst = async (request) => {
    const cache = await caches.open(CACHE_NAME);

    try {
        const response = await fetch(request);

        if (response && response.ok) {
            await cache.put(request, response.clone());
        }

        return response;
    } catch (error) {
        const cached = await cache.match(request);

        return cached ?? respuestaSinConexion();
    }
};

/**
 * Recursos estáticos del App Shell: Cache First.
 * Se sirve desde caché y solo se consulta la red si no está guardado.
 * Las actualizaciones se publican subiendo CACHE_NAME.
 */
const cacheFirst = async (request) => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);

    if (cached) {
        return cached;
    }

    try {
        const response = await fetch(request);

        if (response && response.ok && response.type === "basic") {
            await cache.put(request, response.clone());
        }

        return response;
    } catch (error) {
        if (request.mode === "navigate") {
            const shell = await cache.match("/index.html");

            if (shell) {
                return shell;
            }
        }

        return respuestaSinConexion();
    }
};

self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(APP_SHELL))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys()
            .then((names) => Promise.all(
                names
                    .filter((name) => name !== CACHE_NAME)
                    .map((name) => caches.delete(name))
            ))
            .then(() => self.clients.claim())
    );
});

self.addEventListener("fetch", (event) => {
    const { request } = event;

    if (request.method !== "GET") {
        return;
    }

    const url = new URL(request.url);

    if (url.pathname.includes(API_PATH)) {
        event.respondWith(networkFirst(request));
    } else if (url.origin === self.location.origin) {
        event.respondWith(cacheFirst(request));
    }
});
