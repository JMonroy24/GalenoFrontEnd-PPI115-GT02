import "./boundary/componentes/notificacion_emergente.js";
import "./boundary/componentes/instalador_app.js";
import "./boundary/componentes/encabezado_app.js";
import "./boundary/componentes/menu_lateral.js";
import "./boundary/componentes/pie_app.js";
import "./boundary/vista_pendiente.js";
import "./boundary/login_model.js";
import "./boundary/busqueda_consulta_model.js";
import GeneradorMensajes from "./control/generador_mensajes.js";

const RUTAS = {
    roles: "vista-pendiente",
    tipos_documentos: "vista-pendiente",
    tipos_medios_contactos: "vista-pendiente",
    tipos_examenes: "vista-pendiente",
    examenes: "vista-pendiente",
    procedimientos: "vista-pendiente",
    clinicas: "vista-pendiente",
    personas: "vista-pendiente",
    documentos: "vista-pendiente",
    medios_contactos: "vista-pendiente",
    personas_roles: "vista-pendiente",
    consultas: "busqueda-consulta-model",
    ordenes_examenes: "vista-pendiente",
    resultados: "vista-pendiente",
    login: "login-model"
};

const contenido = document.querySelector("#contenido");
const menu = document.querySelector("menu-lateral");
const encabezado = document.querySelector("encabezado-app");

let hashEsperado = null;

const rutaDesdeHash = () => {
    const id = location.hash.slice(1);
    return RUTAS[id] ? id : "consultas";
};

const navegar = (id) => {
    const solicitada = RUTAS[id] ? id : "consultas";
    const ruta = solicitada;

    contenido.replaceChildren();
    const vista = document.createElement(RUTAS[ruta] ?? "vista-pendiente");
    contenido.appendChild(vista);

    menu.marcarActivo(ruta);

    const enLogin = ruta === "login";
    menu.hidden = enLogin;
    encabezado.hidden = enLogin;
    menu.style.display = enLogin ? "none" : "";
    encabezado.style.display = enLogin ? "none" : "";

    if (location.hash !== `#${ruta}`) {
        hashEsperado = `#${ruta}`;
        location.hash = ruta;
    }
};

window.addEventListener("navegar", (evento) => {
    navegar(evento.detail);
});

window.addEventListener("hashchange", () => {
    const esperado = hashEsperado;
    hashEsperado = null;
    if (location.hash !== esperado) {
        navegar(rutaDesdeHash());
    }
});

window.addEventListener("contexto-seleccionado", () => {
    navegar("consultas");
});

if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch((err) => {
        window.dispatchEvent(GeneradorMensajes.crearMensaje(
            "Error al registrar el service worker",
            err.message,
            "ERROR",
            "app"
        ));
    });
}

navegar(rutaDesdeHash());
