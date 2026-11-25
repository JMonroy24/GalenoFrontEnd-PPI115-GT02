import "./boundary/componentes/notificacion_emergente.js";
import "./boundary/componentes/encabezado_app.js";
import "./boundary/componentes/menu_lateral.js";
import "./boundary/componentes/pie_app.js";
import "./boundary/vistas/busqueda_citas_view.js";
import "./boundary/vistas/dashboard_view.js";
import "./boundary/vistas/atencion_consulta_view.js";
import "./boundary/vistas/login_view.js";
import "./boundary/vistas/detalle_consulta_view.js";
import GeneradorMensajes from "./control/generador_mensajes.js";
import { initRouter, navigate } from "./router.js";
import "./boundary/componentes/estado_red.js";

initRouter({ containerSelector: "#contenido" });

const menu = document.querySelector("menu-lateral");
const botonMenu = document.querySelector("encabezado-app")?.shadowRoot?.querySelector("#btnMenu");
const pantallaEstrecha = window.matchMedia("(width <= 50rem)");
const mostrarMenu = (abierto) => {
    if (menu) menu.dataset.menuAbierto = String(abierto);
    botonMenu?.setAttribute("aria-expanded", String(abierto));
};
mostrarMenu(false);
window.addEventListener("alternar-menu", () => {
    mostrarMenu(menu?.dataset.menuAbierto !== "true");
});
window.addEventListener("hashchange", () => mostrarMenu(false));
pantallaEstrecha.addEventListener("change", () => mostrarMenu(false));
window.addEventListener("keydown", (evento) => {
    if (evento.key === "Escape" && pantallaEstrecha.matches && menu?.dataset.menuAbierto === "true") {
        mostrarMenu(false);
        botonMenu?.focus();
    }
});

window.addEventListener("navegar", (evento) => {
    navigate(evento.detail);
});

if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js", { updateViaCache: "none" }).catch((err) => {
        GeneradorMensajes.crearMensaje(
            "Error al registrar el service worker",
            err.message,
            "error"
        );
    });
}
