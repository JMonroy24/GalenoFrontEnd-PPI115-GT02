const STATE_KEYS = ["session", "activeClinic", "selectedRole", "isOnline"];

class Store extends EventTarget {
    constructor() {
        super();
        this.session = null;
        this.activeClinic = null;
        this.selectedRole = null;
        this.isOnline = globalThis.navigator?.onLine ?? true;

        if (typeof window !== "undefined") {
            window.addEventListener("online", () => this.setState("isOnline", true));
            window.addEventListener("offline", () => this.setState("isOnline", false));
        }
    }

    setState(key, value) {
        if (!STATE_KEYS.includes(key)) {
            throw new RangeError(`Estado desconocido: ${key}`);
        }

        this[key] = value;
        this.dispatchEvent(new CustomEvent("change", {
            detail: { key, value }
        }));
    }

    getState() {
        return {
            session: this.session,
            activeClinic: this.activeClinic,
            selectedRole: this.selectedRole,
            isOnline: this.isOnline
        };
    }

    subscribe(callback) {
        this.addEventListener("change", callback);
        return () => this.removeEventListener("change", callback);
    }
}

const store = new Store();

export default store;
