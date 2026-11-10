export default class defaultResponse {
    constructor(data = [], total = null, first = 0, max = null) {
        this.data = Array.isArray(data) ? data : [];
        this.total = this._numeroSeguro(total, response => response, this.data.length);
        this.first = this._numeroSeguro(first, response => response, 0);
        this.max = this._numeroSeguro(max, response => response, this.data.length);
    }

    get paginaActual() {
        return this.max > 0 ? Math.floor(this.first / this.max) : 0;
    }

    get totalPaginas() {
        return this.max > 0 ? Math.max(1, Math.ceil(this.total / this.max)) : 1;
    }

    get hayPaginaAnterior() {
        return this.first > 0;
    }

    get hayPaginaSiguiente() {
        return this.first + this.data.length < this.total;
    }

    _numeroSeguro(valor, transformar, porDefecto) {
        if (valor === null || valor === undefined || String(valor).trim() === "") {
            return porDefecto;
        }
        const numero = Number(transformar(valor));
        if (!Number.isSafeInteger(numero) || numero < 0) {
            return porDefecto;
        }
        return numero;
    }
}
