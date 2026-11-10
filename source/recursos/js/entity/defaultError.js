export default class defaultError {
    constructor(message, error) {
        this.name = "defaultError";
        this.message = message;
        this.error = error;
    }

    get causa() {
        return this.error;
    }

    get estado() {
        return this.error && this.error.status ? this.error.status : null;
    }

    toString() {
        return this.message;
    }
}
