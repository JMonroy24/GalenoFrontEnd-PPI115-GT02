import "./boundary/componentes/notificacion_emergente.js";
import "./boundary/componentes/instalador_app.js";
import "./boundary/componentes/encabezado_app.js";
import "./boundary/componentes/menu_lateral.js";
import "./boundary/componentes/pie_app.js";
import "./boundary/vista_pendiente.js";
import "./boundary/login_model.js";
import "./boundary/busqueda_consulta_model.js";
import "./boundary/vistas/busqueda_citas_view.js";
import "./boundary/vistas/dashboard_view.js";
import "./boundary/vistas/atencion_consulta_view.js";
import "./boundary/vistas/login_view.js";
import GeneradorMensajes from "./control/generador_mensajes.js";
import { initRouter, navigate } from "./router.js";
import "./boundary/componentes/estado_red.js";

initRouter({ containerSelector: "#contenido" });

window.addEventListener("navegar", (evento) => {
    navigate(evento.detail);
});

window.addEventListener("contexto-seleccionado", () => {
    navigate("buscar-citas");
});

if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch((err) => {
        GeneradorMensajes.crearMensaje(
            "Error al registrar el service worker",
            err.message,
            "error"
        );
    });
}
