import "./instalador_app.js";
import { authService } from "../../control/auth_service.js";
import { store } from "../../store.js";
import { esRolEmpleado } from '../../entity/rol_empleado.js';
import { idEntidad, idClinicaAsignacion, idRolAsignacion } from '../../entity/flujo_consulta.js';

export default class EncabezadoApp extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: "open" });
        this.alContexto = () => this._actualizarSesion();
    }

    connectedCallback() {
        this.render();
        window.addEventListener("sesion-iniciada", this.alContexto);
        window.addEventListener("sesion-cerrada", this.alContexto);
        store.addEventListener("state-changed", this.alContexto);
    }

    disconnectedCallback() {
        const dialogo = this.shadowRoot.querySelector('#dialogo-rol');
        if (dialogo?.open) dialogo.close();
        window.removeEventListener("sesion-iniciada", this.alContexto);
        window.removeEventListener("sesion-cerrada", this.alContexto);
        store.removeEventListener("state-changed", this.alContexto);
    }

    render() {
        this.shadowRoot.innerHTML = `
            <link rel="stylesheet" href="recursos/estilos/principal.css">
            <style>
                :host {
                    display: block;
                    min-inline-size: 0;
                    container: encabezado / inline-size;
                }

                .barra {
                    display: flex;
                    align-items: center;
                    flex-wrap: wrap;
                    gap: 0.75rem;
                    padding: 0.75rem 1rem;
                    background-color: var(--color-superficie);
                    border-bottom: 1px solid var(--color-borde);
                    color: var(--color-texto);
                }

                #btnMenu {
                    display: none;
                    flex-direction: column;
                    gap: 3px;
                    padding: 0.5rem;
                }

                #btnMenu .linea {
                    display: block;
                    inline-size: 1.125rem;
                    height: 2px;
                    background-color: var(--color-texto);
                }

                .marca {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                }

                .logo {
                    inline-size: 2rem;
                    block-size: 2rem;
                    object-fit: contain;
                }

                .titulo {
                    font-size: 1.125rem;
                    font-weight: 700;
                }

                #textoContexto { min-inline-size: 0; overflow-wrap: anywhere; }
                .contexto {
                    display: flex;
                    align-items: center;
                    flex-wrap: wrap;
                    gap: 0.5rem;
                    margin-inline-start: auto;
                    min-inline-size: 0;
                    flex: 1 1 18rem;
                }

                [hidden] {
                    display: none !important;
                }

                dialog {
                    box-sizing: border-box;
                    margin: auto;
                    inline-size: min(32rem, calc(100% - 2rem));
                    max-block-size: calc(100dvh - 2rem);
                    overflow: auto;
                    padding: 1.5rem;
                    border: 1px solid var(--color-borde, #64748b);
                    border-radius: 0.75rem;
                    color: var(--color-texto, #0f172a);
                    background: var(--color-superficie, #fff);
                }
                dialog:modal { overscroll-behavior: contain; }
                dialog::backdrop {
                    background: rgb(15 23 42 / 0.45);
                    overflow: hidden;
                    overscroll-behavior: contain;
                }
                #form-cambio-rol { display: grid; gap: 0.75rem; }
                #form-cambio-rol h1 { margin: 0; font-size: 1.5rem; }
                #form-cambio-rol select { inline-size: 100%; min-inline-size: 0; font: inherit; min-block-size: 3rem; }
                .acciones-rol { display: flex; flex-wrap: wrap; gap: 0.75rem; justify-content: end; }

                @container encabezado (inline-size <= 50rem) {
                    #btnMenu {
                        display: inline-flex;
                    }
                }
            </style>
            <header class="barra">
                <button id="btnMenu" class="btn" type="button" aria-label="Alternar menú" aria-expanded="false">
                    <span class="linea"></span>
                    <span class="linea"></span>
                    <span class="linea"></span>
                </button>
                <div class="marca">
                    <img class="logo" src="recursos/imagenes/galenosv-logo.png" alt="GalenoSV">
                    <span class="titulo">GalenoSV</span>
                </div>
                <div class="contexto">
                    <span id="textoContexto"></span>
                    <button id="btnCambiarRol" class="btn" type="button">Cambiar rol</button>
                    <button id="btnCerrarSesion" class="btn" type="button">Cerrar sesión</button>
                </div>
                <instalador-app></instalador-app>
            </header>
            <dialog id="dialogo-rol" aria-labelledby="titulo-cambio-rol">
                <form id="form-cambio-rol" method="dialog">
                    <h1 id="titulo-cambio-rol">Cambiar clínica y rol</h1>
                    <label for="clinica-cambio-rol">Clínica</label>
                    <select id="clinica-cambio-rol" name="clinica" required autofocus></select>
                    <label for="asignacion-cambio-rol">Rol</label>
                    <select id="asignacion-cambio-rol" name="rol" required aria-describedby="aviso-cambio-rol"></select>
                    <p id="aviso-cambio-rol" role="status"></p>
                    <div class="acciones-rol">
                        <button class="btn" type="submit" value="cancelar" formnovalidate>Cancelar</button>
                        <button class="btn" id="btnAplicarRol" type="submit" value="aplicar">Aplicar cambio</button>
                    </div>
                </form>
            </dialog>
        `;

        this._actualizarSesion();

        const btnMenu = this.shadowRoot.querySelector("#btnMenu");
        btnMenu.addEventListener("click", () => {
            this.dispatchEvent(new CustomEvent("alternar-menu", {
                bubbles: true,
                composed: true
            }));
        });

        const navegar = (ruta) => {
            this.dispatchEvent(new CustomEvent("navegar", {
                detail: ruta,
                bubbles: true,
                composed: true
            }));
        };

        const btnCambiarRol = this.shadowRoot.querySelector("#btnCambiarRol");
        const btnCerrarSesion = this.shadowRoot.querySelector("#btnCerrarSesion");
        btnCambiarRol.addEventListener("click", () => this._abrirCambioRol());
        this.shadowRoot.querySelector('#clinica-cambio-rol').addEventListener('change', () => this._cargarRolesCambio());
        this.shadowRoot.querySelector('#form-cambio-rol').addEventListener('submit', (evento) => {
            if (evento.submitter?.value === 'cancelar') return;
            evento.preventDefault();
            if (this._aplicarCambioRol()) navegar('dashboard');
        });
        btnCerrarSesion.addEventListener("click", () => {
            if (store.hasActiveSession()) {
                authService.logout();
            }
            navegar("login");
        });
    }

    _asignacionesContexto() {
        const estado = store.getState();
        const usuario = estado.usuario?.perfil ?? estado.usuario?.persona ?? estado.usuario;
        const idPersona = idEntidad(usuario, 'idPersona');
        return (estado.roles ?? []).filter((asignacion) => esRolEmpleado(asignacion)
            && idRolAsignacion(asignacion) != null && idClinicaAsignacion(asignacion) != null
            && String(idRolAsignacion(asignacion)).trim() !== '' && String(idClinicaAsignacion(asignacion)).trim() !== ''
            && (idPersona == null || asignacion.idPersona == null
                || String(idEntidad(asignacion.idPersona, 'idPersona')) === String(idPersona)));
    }

    _abrirCambioRol() {
        if (!store.hasActiveSession()) return;
        const estado = store.getState();
        const select = this.shadowRoot.querySelector('#clinica-cambio-rol');
        const clinicas = new Map();
        for (const asignacion of this._asignacionesContexto()) {
            const id = String(idClinicaAsignacion(asignacion));
            const clinica = asignacion.clinica ?? (typeof asignacion.idClinica === 'object' ? asignacion.idClinica : null);
            const activa = String(idEntidad(estado.clinicaActiva, 'idClinica')) === id ? estado.clinicaActiva : null;
            clinicas.set(id, clinica?.nombre ?? clinica?.nombreClinica ?? clinica?.descripcion
                ?? asignacion.nombreClinica ?? activa?.nombre ?? activa?.nombreClinica ?? `Clínica ${id}`);
        }
        select.replaceChildren(...[...clinicas].map(([id, nombre]) => new Option(nombre, id)));
        const actual = String(idEntidad(estado.clinicaActiva, 'idClinica'));
        if (clinicas.has(actual)) select.value = actual;
        this._cargarRolesCambio();
        const dialogo = this.shadowRoot.querySelector('#dialogo-rol');
        if (!dialogo.open) dialogo.showModal();
    }

    _cargarRolesCambio() {
        const clinica = this.shadowRoot.querySelector('#clinica-cambio-rol').value;
        const select = this.shadowRoot.querySelector('#asignacion-cambio-rol');
        const roles = new Map();
        for (const asignacion of this._asignacionesContexto()) {
            if (String(idClinicaAsignacion(asignacion)) !== clinica) continue;
            const rol = asignacion.rol ?? (typeof asignacion.idRol === 'object' ? asignacion.idRol : asignacion);
            roles.set(String(idRolAsignacion(asignacion)), rol.nombre ?? rol.descripcion ?? asignacion.nombreRol ?? 'Rol');
        }
        select.replaceChildren(...[...roles].map(([id, nombre]) => new Option(nombre, id)));
        const actual = String(idRolAsignacion(store.getState().rolSeleccionado));
        if (roles.has(actual)) select.value = actual;
        this.shadowRoot.querySelector('#btnAplicarRol').disabled = roles.size === 0;
        this.shadowRoot.querySelector('#aviso-cambio-rol').textContent = roles.size === 0
            ? 'No tiene asignaciones activas en esta clínica.'
            : roles.size === 1 ? 'Solo tiene este rol asignado en la clínica seleccionada.'
                : 'Seleccione uno de sus roles activos para trabajar.';
    }

    _aplicarCambioRol() {
        const idClinica = this.shadowRoot.querySelector('#clinica-cambio-rol').value;
        const idRol = this.shadowRoot.querySelector('#asignacion-cambio-rol').value;
        const asignacion = this._asignacionesContexto().find((item) => String(idClinicaAsignacion(item)) === idClinica
            && String(idRolAsignacion(item)) === idRol);
        if (!asignacion) {
            this.shadowRoot.querySelector('#aviso-cambio-rol').textContent = 'La asignación ya no está disponible. Seleccione una asignación activa.';
            return false;
        }
        const activa = store.getState().clinicaActiva;
        const clinica = asignacion.clinica ?? (typeof asignacion.idClinica === 'object' ? asignacion.idClinica : null)
            ?? (String(idEntidad(activa, 'idClinica')) === idClinica ? activa : { idClinica,
                nombre: this.shadowRoot.querySelector('#clinica-cambio-rol').selectedOptions[0].textContent });
        this.shadowRoot.querySelector('#dialogo-rol').close();
        store.setContextoTrabajo(clinica, asignacion);
        return true;
    }

    _actualizarSesion() {
        const escribir = (nodo, texto) => {
            if (nodo.textContent !== texto) nodo.textContent = texto;
        };
        const estado = store.getState();
        let usuario = estado.usuario;
        let contexto = null;
        try {
            usuario ??= JSON.parse(sessionStorage.getItem("usuarioActivo") ?? "null");
            contexto = JSON.parse(sessionStorage.getItem("contexto") ?? "null");
        } catch {
            // El encabezado también debe funcionar sin almacenamiento disponible.
        }

        const textoContexto = this.shadowRoot.querySelector("#textoContexto");
        if (!textoContexto) return;
        const sesionActiva = store.hasActiveSession();
        const dialogo = this.shadowRoot.querySelector('#dialogo-rol');
        if (!sesionActiva && dialogo?.open) dialogo.close();
        this.shadowRoot.querySelector("#btnCambiarRol").hidden = !sesionActiva;
        escribir(this.shadowRoot.querySelector("#btnCerrarSesion"), sesionActiva
            ? "Cerrar sesión" : "Iniciar sesión");
        if (!usuario) {
            escribir(textoContexto, "Sin sesión");
            return;
        }

        const perfil = usuario.perfil ?? usuario.usuario ?? usuario.persona ?? usuario;
        const texto = (valor) => Array.isArray(valor) ? valor.filter(Boolean).join(" ") : String(valor ?? "").trim();
        const nombre = texto(perfil.nombreCompleto)
            || [texto(perfil.nombres ?? perfil.nombre), texto(perfil.apellidos ?? perfil.apellido)]
                .filter(Boolean).join(" ") || "Usuario";
        const clinica = estado.clinicaActiva;
        const rol = estado.rolSeleccionado?.rol
            ?? (typeof estado.rolSeleccionado?.idRol === "object"
                ? estado.rolSeleccionado.idRol : estado.rolSeleccionado);
        const nombreClinica = clinica?.nombre || clinica?.nombreClinica || contexto?.nombreClinica;
        const nombreRol = rol?.nombre || rol?.descripcion || rol?.nombreRol
            || estado.rolSeleccionado?.nombreRol || contexto?.nombreRol;
        escribir(textoContexto, [nombre, nombreClinica, nombreRol].filter(Boolean).join(" / "));
    }
}

customElements.define("encabezado-app", EncabezadoApp);
