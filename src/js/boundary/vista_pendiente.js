export default class VistaPendiente extends HTMLElement {
    connectedCallback() {
        this.textContent = "Pantalla en construcción";
    }
}

customElements.define("vista-pendiente", VistaPendiente);
