export class DefaultResponse {
    constructor(items = [], total = 0, first = 0, max = 0) {
        const safeItems = Array.isArray(items) ? items : [];

        this.items = safeItems;
        this.datos = safeItems;
        this.total = total;
        this.first = first;
        this.max = max;
    }
}

export default DefaultResponse;
