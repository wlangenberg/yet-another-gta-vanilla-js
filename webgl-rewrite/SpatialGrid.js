class SpatialGrid {
    constructor(cellSize) {
        this.cellSize = cellSize;
        this.cells = new Map();
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
        const startX = Math.floor(object.x / this.cellSize);
        const endX = Math.floor((object.x + object.width) / this.cellSize);
        const startY = Math.floor(object.y / this.cellSize);
        const endY = Math.floor((object.y + object.height) / this.cellSize);

        const nearbyObjects = new Set();

        for (let x = startX; x <= endX; x++) {
            for (let y = startY; y <= endY; y++) {
                const key = `${x},${y}`;
                if (this.cells.has(key)) {
                    for (const obj of this.cells.get(key)) {
                        nearbyObjects.add(obj);
                    }
                }
            }
        }

        return [...nearbyObjects]; // Convert set back to an array
    }

    clear() {
        this.cells.clear();
    }
}

export default SpatialGrid