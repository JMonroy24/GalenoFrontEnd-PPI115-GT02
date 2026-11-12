export default class DefaultResponse {
    constructor(items = [], total = -1, first = null, max = null) {
        this.items = items;
        this.datos = items;
        this.total = total;
        this.first = first;
        this.max = max;
    }
}
