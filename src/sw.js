const CACHE_NAME = "app-shell-v1";
const PRECACHE_ASSETS = [
    "index.html",
    "manifest.json",
    "recursos/estilos/principal.css",
    "recursos/imagenes/galenosv-logo.png",
    "recursos/imagenes/icono_192.png",
    "recursos/imagenes/icono_512.png",
    "js/app.js",
    "js/config.js",
    "js/boundary/busqueda_consulta_model.js",
    "js/boundary/login_model.js",
    "js/boundary/vista_pendiente.js",
    "js/boundary/componentes/autocomplete.js",
    "js/boundary/componentes/buscador_persona.js",
    "js/boundary/componentes/buscador_tipo_documentos.js",
    "js/boundary/componentes/encabezado_app.js",
    "js/boundary/componentes/instalador_app.js",
    "js/boundary/componentes/menu_lateral.js",
    "js/boundary/componentes/notificacion_emergente.js",
    "js/boundary/componentes/pie_app.js",
    "js/boundary/componentes/tarjeta_consulta.js",
    "js/boundary/componentes/tarjeta_simple.js",
    "js/control/clinica_service.js",
    "js/control/consulta_service.js",
    "js/control/default_service.js",
    "js/control/generador_mensajes.js",
    "js/control/gestor_fechas.js",
    "js/control/persona_rol_service.js",
    "js/control/persona_service.js",
    "js/control/procedimiento_service.js",
    "js/control/rol_service.js",
    "js/control/tipo_documento_service.js",
    "js/control/tipo_examen_service.js",
    "js/control/tipo_medio_contacto_service.js",
    "js/entity/default_error.js",
    "js/entity/default_response.js",
    "js/store.js"
];

self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(PRECACHE_ASSETS))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => Promise.all(
                cacheNames
                    .filter((cacheName) =>
                        cacheName.startsWith("app-shell-") || cacheName === "galenosv-v1"
                    )
                    .filter((cacheName) => cacheName !== CACHE_NAME)
                    .map((cacheName) => caches.delete(cacheName))
            ))
            .then(() => self.clients.claim())
    );
});

const isApiRequest = (url) => url.pathname.includes("/api/");

const offlineNavigationResponse = async () => {
    try {
        const cache = await caches.open(CACHE_NAME);
        const appShell = await cache.match(new URL("index.html", self.registration.scope));
        if (appShell) {
            return appShell;
        }
    } catch (error) {
        console.error("No se pudo recuperar el App Shell desde la caché", error);
    }

    return new Response(JSON.stringify({
        message: "No hay conexión y la aplicación no está disponible sin conexión."
    }), {
        status: 503,
        headers: { "Content-Type": "application/json; charset=utf-8" }
    });
};

self.addEventListener("fetch", (event) => {
    const requestUrl = new URL(event.request.url);

    if (
        event.request.method !== "GET" ||
        requestUrl.origin !== self.location.origin ||
        isApiRequest(requestUrl)
    ) {
        return;
    }

    event.respondWith(
        caches.open(CACHE_NAME)
            .then(async (cache) => {
                const cachedResponse = await cache.match(event.request);
                if (cachedResponse) {
                    return cachedResponse;
                }

                if (event.request.mode === "navigate") {
                    const appShell = await cache.match(
                        new URL("index.html", self.registration.scope)
                    );
                    if (appShell) {
                        return appShell;
                    }
                }

                return fetch(event.request);
            })
            .catch((error) => {
                if (event.request.mode === "navigate") {
                    return offlineNavigationResponse();
                }
                throw error;
            })
    );
});
