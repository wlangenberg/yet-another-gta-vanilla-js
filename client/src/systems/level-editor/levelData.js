export class LevelData {
    constructor() {
        this.rectangles = [];
        this.playerSpawns = [];
        this.paintToolSize = 12;
    }

    addRectangle(x, y, color, type, layer = 0) {
        const exists = this.rectangles.some(r => r.x === x && r.y === y);
        if (!exists) {
            this.rectangles.push({
                x,
                y,
                width: this.paintToolSize,
                height: this.paintToolSize,
                color,
                type,
                layer
            });
        }
    }

    addPlayerSpawn(x, y) {
        const exists = this.playerSpawns.some(spawn => spawn.x === x && spawn.y === y);
        if (!exists) {
            this.playerSpawns.push({ x, y });
        }
    }

    removeRectangle(x, y) {
        const index = this.rectangles.findIndex(r => r.x === x && r.y === y);
        if (index !== -1) {
            this.rectangles.splice(index, 1);
        }
    }

    setPaintToolSize(size) {
        this.paintToolSize = size;
    }

    exportLevel(backgroundColor) {
        return {
            gridSize: 12,
            paintToolSize: this.paintToolSize,
            playerSpawns: this.playerSpawns.map(spawn => ({ x: spawn.x, y: spawn.y })),
            backgroundColor,
            rectangles: this.rectangles.map(r => ({
                x: r.x,
                y: r.y,
                width: r.width,
                height: r.height,
                color: r.color,
                type: r.type,
                layer: r.layer
            }))
        };
    }
}
