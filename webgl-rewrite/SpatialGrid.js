class SpatialGrid {
    constructor(cellSize) {
        this.cellSize = cellSize;
        this.cells = new Map();
        this.queryId = 0;
    }

    getCellKey(x, y) {
        return `${Math.floor(x / this.cellSize)},${Math.floor(y / this.cellSize)}`;
    }

    insert(object) {
        const startX = Math.floor(object.x / this.cellSize);
        const endX = Math.floor((object.x + object.width) / this.cellSize);
        const startY = Math.floor(object.y / this.cellSize);
        const endY = Math.floor((object.y + object.height) / this.cellSize);

        for (let x = startX; x <= endX; x++) {
            for (let y = startY; y <= endY; y++) {
                const key = `${x},${y}`;
                if (!this.cells.has(key)) {
                    this.cells.set(key, []);
                }
                this.cells.get(key).push(object);
            }
        }
    }

    query(object) {
        // Increase the queryId for each query call.
        this.queryId++;
        const startX = Math.floor(object.x / this.cellSize);
        const endX = Math.floor((object.x + object.width) / this.cellSize);
        const startY = Math.floor(object.y / this.cellSize);
        const endY = Math.floor((object.y + object.height) / this.cellSize);
        const result = [];
        for (let x = startX; x <= endX; x++) {
            for (let y = startY; y <= endY; y++) {
                const key = `${x},${y}`;
                if (this.cells.has(key)) {
                    const cell = this.cells.get(key);
                    for (const obj of cell) {
                        // Use a property on the object to mark if it was already added for this query.
                        if (obj._lastQueryId !== this.queryId) {
                            obj._lastQueryId = this.queryId;
                            result.push(obj);
                        }
                    }
                }
            }
        }
        return result;
    }

    clear() {
        this.cells.clear();
    }
}

export default SpatialGrid;
