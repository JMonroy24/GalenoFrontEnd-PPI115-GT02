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
const encabezado = document.querySelector("encabezado-app");
const pantallaEstrecha = window.matchMedia("(width <= 50rem)");

/** Devuelve el botón hamburguesa desde el shadow root del encabezado. */
const obtenerBotonMenu = () =>
    encabezado?.shadowRoot?.querySelector("#btnMenu");

/**
 * Abre o cierra el menú lateral actualizando los atributos ARIA.
 * En escritorio el menú es siempre visible, por lo que aria-hidden solo
 * se gestiona cuando la pantalla es estrecha (móvil).
 *
 * @param {boolean} abierto - true para abrir, false para cerrar.
 */
const mostrarMenu = (abierto) => {
    if (!menu) return;
    menu.dataset.menuAbierto = String(abierto);
    // aria-hidden solo tiene sentido en móvil, donde el menú puede ocultarse
    if (pantallaEstrecha.matches) {
        menu.setAttribute("aria-hidden", String(!abierto));
    } else {
        menu.removeAttribute("aria-hidden");
    }
    obtenerBotonMenu()?.setAttribute("aria-expanded", String(abierto));
};

mostrarMenu(false);

// Alternar al hacer clic en el botón hamburguesa
window.addEventListener("alternar-menu", () => {
    mostrarMenu(menu?.dataset.menuAbierto !== "true");
});

// Cerrar al navegar por hash
window.addEventListener("hashchange", () => mostrarMenu(false));

// Cerrar cuando el menú emite "cerrar-menu" (clic en un enlace de nav)
window.addEventListener("cerrar-menu", () => mostrarMenu(false));

// Cerrar al pasar a pantalla de escritorio (y limpiar aria-hidden)
pantallaEstrecha.addEventListener("change", () => mostrarMenu(false));

// Cerrar con Escape (solo en móvil)
window.addEventListener("keydown", (evento) => {
    if (
        evento.key === "Escape" &&
        pantallaEstrecha.matches &&
        menu?.dataset.menuAbierto === "true"
    ) {
        mostrarMenu(false);
        obtenerBotonMenu()?.focus();
    }
});

// Cerrar al hacer clic fuera del menú y el botón hamburguesa
document.addEventListener("click", (evento) => {
    if (
        !pantallaEstrecha.matches ||
        menu?.dataset.menuAbierto !== "true"
    ) return;
    const dentroDelMenu = menu.contains(evento.target) || menu === evento.target;
    const dentroDelEncabezado = encabezado?.contains(evento.target) || encabezado === evento.target;
    if (!dentroDelMenu && !dentroDelEncabezado) {
        mostrarMenu(false);
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
