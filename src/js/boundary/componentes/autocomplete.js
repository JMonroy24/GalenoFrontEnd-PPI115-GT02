import GeneradorMensajes from "../../control/generador_mensajes.js";

export default class AutoComplete extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: "open" });
        this.buscar = null;
        this.etiqueta = (item) => String(item);
        this.items = [];
        this.indiceActivo = -1;
        this.contadorBusqueda = 0;
        this._placeholder = "";
        this._timer = null;
        this._input = null;
        this._lista = null;
        this._manejadorClickFuera = (evento) => {
            const dentro = typeof evento.composedPath === "function"
                ? evento.composedPath().includes(this)
                : this.contains(evento.target);
            if (!dentro) {
                this._ocultarMenu();
            }
        };
    }

    connectedCallback() {
        this._renderizar();
        document.addEventListener("click", this._manejadorClickFuera);
    }

    disconnectedCallback() {
        clearTimeout(this._timer);
        this._timer = null;
        document.removeEventListener("click", this._manejadorClickFuera);
    }

    get placeholder() {
        return this._placeholder;
    }

    set placeholder(valor) {
        this._placeholder = valor;
        if (this._input) {
            this._input.placeholder = valor;
        }
    }

    _renderizar() {
        this.shadowRoot.innerHTML = `
            <link rel="stylesheet" href="recursos/estilos/principal.css">
            <style>
                :host { display: block; }
                .contenedor { position: relative; }
                .dropdown-menu {
                    position: absolute;
                    display: none;
                    margin: 0;
                    padding: 0;
                    list-style: none;
                    background: #ffffff;
                    border: 1px solid #cccccc;
                    width: 100%;
                    z-index: 1000;
                }
                .dropdown-menu.show { display: block; }
                .dropdown-menu li { padding: 4px 8px; cursor: pointer; }
                .dropdown-menu li.active { background: #e9ecef; }
            </style>
            <div class="contenedor">
                <input type="text" class="form-control">
                <ul class="dropdown-menu"></ul>
            </div>
        `;

        this.items = [];
        this.indiceActivo = -1;
        this._input = this.shadowRoot.querySelector("input.form-control");
        this._lista = this.shadowRoot.querySelector("ul.dropdown-menu");
        this._input.placeholder = this._placeholder;

        this._input.addEventListener("input", () => {
            const texto = this._input.value.trim();
            clearTimeout(this._timer);
            this._timer = null;
            this.contadorBusqueda += 1;
            const contador = this.contadorBusqueda;

            if (texto.length < 2) {
                this._ocultarMenu();
                return;
            }

            this._timer = setTimeout(() => {
                this._timer = null;
                this._ejecutarBusqueda(texto, contador);
            }, 250);
        });

        this._input.addEventListener("keydown", (evento) => {
            if (this.items.length === 0) {
                return;
            }

            if (evento.key === "ArrowDown") {
                evento.preventDefault();
                this._mostrarMenu();
                this.indiceActivo = this.indiceActivo < 0 || this.indiceActivo >= this.items.length - 1
                    ? 0
                    : this.indiceActivo + 1;
                this._resaltarActivo();
            } else if (evento.key === "ArrowUp") {
                evento.preventDefault();
                this._mostrarMenu();
                this.indiceActivo = this.indiceActivo <= 0
                    ? this.items.length - 1
                    : this.indiceActivo - 1;
                this._resaltarActivo();
            } else if (evento.key === "Enter") {
                if (this.indiceActivo >= 0 && this.indiceActivo < this.items.length) {
                    evento.preventDefault();
                    this._seleccionar(this.items[this.indiceActivo]);
                }
            } else if (evento.key === "Escape") {
                this._ocultarMenu();
            }
        });
    }

    _ejecutarBusqueda(texto, contador) {
        if (typeof this.buscar !== "function") {
            this._ocultarMenu();
            return;
        }

        try {
            Promise.resolve(this.buscar(texto))
                .then((respuesta) => {
                    if (contador !== this.contadorBusqueda) {
                        return;
                    }
                    const datos = Array.isArray(respuesta)
                        ? respuesta
                        : (respuesta && Array.isArray(respuesta.datos) ? respuesta.datos : []);
                    this._renderizarSugerencias(datos);
                })
                .catch((err) => {
                    if (contador !== this.contadorBusqueda) {
                        return;
                    }
                    this._notificarError(err);
                });
        } catch (err) {
            if (contador !== this.contadorBusqueda) {
                return;
            }
            this._notificarError(err);
        }
    }

    _renderizarSugerencias(datos) {
        this.items = Array.isArray(datos) ? datos : [];
        this.indiceActivo = -1;
        this._lista.replaceChildren();

        if (this.items.length === 0) {
            this._ocultarMenu();
            return;
        }

        this.items.forEach((item) => {
            const li = document.createElement("li");
            li.className = "dropdown-item";
            li.textContent = this.etiqueta(item);
            li.addEventListener("click", () => this._seleccionar(item));
            this._lista.appendChild(li);
        });

        this._mostrarMenu();
    }

    _seleccionar(item) {
        this._input.value = this.etiqueta(item);
        this._ocultarMenu();
        this.dispatchEvent(new CustomEvent("item-seleccionado", {
            detail: item,
            bubbles: true,
            composed: true
        }));
    }

    _resaltarActivo() {
        if (!this._lista) {
            return;
        }
        const elementos = this._lista.querySelectorAll("li");
        elementos.forEach((li, indice) => {
            li.classList.toggle("active", indice === this.indiceActivo);
        });
    }

    _mostrarMenu() {
        if (this._lista) {
            this._lista.classList.add("show");
        }
    }

    _ocultarMenu() {
        if (this._lista) {
            this._lista.classList.remove("show");
        }
        this.indiceActivo = -1;
        this._resaltarActivo();
    }

    _notificarError(err) {
        GeneradorMensajes.crearMensaje(
            "Error en la búsqueda",
            err.mensaje,
            "error"
        );
    }
}

customElements.define("auto-complete", AutoComplete);
