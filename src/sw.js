const CACHE_NAME = "galenosv-app-shell-v14";

const APP_SHELL = [
    "/index.html",
    "/manifest.json",
    "/recursos/estilos/principal.css",
    "/recursos/imagenes/galenosv-logo.png",
    "/recursos/imagenes/icono_192.png",
    "/recursos/imagenes/icono_512.png",
    "/js/app.js",
    "/js/config.js",
    "/js/routes.js",
    "/js/router.js",
    "/js/store.js",
    "/js/boundary/vistas/busqueda_citas_view.js",
    "/js/boundary/vistas/login_view.js",
    "/js/boundary/vistas/dashboard_view.js",
    "/js/boundary/vistas/atencion_consulta_view.js",
    "/js/boundary/componentes/asistente_busqueda.js",
    "/js/boundary/componentes/autocomplete.js",
    "/js/boundary/componentes/autocomplete_cie10.js",
    "/js/boundary/componentes/buscador_tipo_doc.js",
    "/js/boundary/componentes/encabezado_app.js",
    "/js/boundary/componentes/historial_pasos.js",
    "/js/boundary/componentes/instalador_app.js",
    "/js/boundary/componentes/menu_lateral.js",
    "/js/boundary/componentes/notificacion_emergente.js",
    "/js/boundary/componentes/pie_app.js",
    "/js/boundary/componentes/stepper_progreso.js",
    "/js/boundary/componentes/tarjeta_consulta.js",
    "/js/boundary/componentes/tarjeta_simple.js",
    "/js/control/auth_service.js",
    "/js/control/cie10_service.js",
    "/js/control/clinica_service.js",
    "/js/control/consulta_service.js",
    "/js/control/default_service.js",
    "/js/control/examen_resultado_service.js",
    "/js/control/generador_mensajes.js",
    "/js/control/gestor_fechas.js",
    "/js/control/persona_rol_service.js",
    "/js/control/orden_examen_service.js",
    "/js/control/persona_service.js",
    "/js/control/procedimiento_service.js",
    "/js/control/rol_service.js",
    "/js/control/tipo_documento_service.js",
    "/js/control/tipo_examen_service.js",
    "/js/control/tipo_medio_contacto_service.js",
    "/js/entity/default_error.js",
    "/js/entity/default_response.js"
];

const offlineFallback = () => new Response(
    JSON.stringify({
        message: "No hay conexión y el recurso no está disponible sin conexión."
    }),
    {
        status: 503,
        headers: { "Content-Type": "application/json; charset=utf-8" }
    }
);

const networkFirst = async (request) => {
    const cache = await caches.open(CACHE_NAME);

    try {
        const response = await fetch(request);

        if (response && response.ok) {
            await cache.put(request, response.clone());
        }

        return response;
    } catch (error) {
        const cachedResponse = await cache.match(request);

        if (cachedResponse) {
            return cachedResponse;
        }

        if (request.mode === "navigate") {
            const appShell = await cache.match("/index.html");

            if (appShell) {
                return appShell;
            }
        }

        return offlineFallback();
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
            .then((cacheNames) => Promise.all(
                cacheNames
                    .filter((cacheName) => cacheName !== CACHE_NAME)
                    .map((cacheName) => caches.delete(cacheName))
            ))
            .then(() => self.clients.claim())
    );
});

self.addEventListener("fetch", (event) => {
    if (event.request.method !== "GET") {
        return;
    }

    event.respondWith(networkFirst(event.request));
});
