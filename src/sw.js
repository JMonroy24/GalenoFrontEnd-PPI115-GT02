const CACHE = "galenosv-v1";

self.addEventListener("install", (evento) => {
    evento.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (evento) => {
    evento.waitUntil(self.clients.claim());
});

const esApi = (url) => url.pathname.includes("/api/");

const esEstatico = (requesto, url) =>
    requesto.method === "GET" &&
    url.origin === self.location.origin &&
    !esApi(url);

const guardarEnCache = (evento, respuesta) => {
    if (respuesta.ok && respuesta.type === "basic") {
        const copia = respuesta.clone();
        evento.waitUntil(caches.open(CACHE).then((cache) => cache.put(evento.request, copia)));
    }
    return respuesta;
};

const buscarEnCache = (requesto) =>
    caches.open(CACHE)
        .then((cache) => cache.match(requesto))
        .then((respuesta) => respuesta ?? Response.error());

self.addEventListener("fetch", (evento) => {
    const url = new URL(evento.request.url);

    if (!esEstatico(evento.request, url)) {
        return;
    }

    evento.respondWith(
        fetch(evento.request)
            .then((respuesta) => guardarEnCache(evento, respuesta))
            .catch(() => buscarEnCache(evento.request))
    );
});
