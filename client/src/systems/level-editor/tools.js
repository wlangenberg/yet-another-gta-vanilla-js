export class PaintTool {
    constructor(id, name, color) {
        this.id = id;
        this.name = name;
        this.color = color;
    }

    draw(ctx, x, y, size) {
        console.warn("Draw method should be implemented in subclasses.");
    }
}

export class RectangleTool extends PaintTool {
    constructor() {
        super("rectangle", "Rectangle", "blue");
    }

    draw(ctx, x, y, size) {
        ctx.fillStyle = this.color;
        ctx.fillRect(x, y, size, size);
    }
}

export class GrassTool extends PaintTool {
    constructor() {
        super("grass", "Grass", "green");
    }

    draw(ctx, x, y, size) {
        ctx.fillStyle = this.color;
        ctx.fillRect(x, y, size, size);
    }
}

export class DirtTool extends PaintTool {
    constructor() {
        super("dirt", "Dirt", "sandybrown");
    }

    draw(ctx, x, y, size) {
        ctx.fillStyle = this.color;
        ctx.fillRect(x, y, size, size);
    }
}
export class StoneTool extends PaintTool {
    constructor() {
        super("stone", "Stone", "grey");
    }

    draw(ctx, x, y, size) {
        ctx.fillStyle = this.color;
        ctx.fillRect(x, y, size, size);
    }
}

export class CircleTool extends PaintTool {
    constructor() {
        super("circle", "Circle", "red");
    }

    draw(ctx, x, y, size) {
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
        ctx.fill();
    }
}

export class PlayerSpawnTool extends PaintTool {
    constructor() {
        super("player_spawn", "Player Spawn", "green");
    }

    draw(ctx, x, y, size) {
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(x + size / 2, y + size / 2, size / 3, 0, Math.PI * 2);
        ctx.fill();
    }
}


export class BackgroundObject extends PaintTool {
    constructor() {
        super("background", "Background object", "sandybrown");
    }

    draw(ctx, x, y, size) {
        ctx.fillStyle = this.color;
        ctx.fillRect(x, y, size, size);
    }
}

export class BackgroundObject2 extends PaintTool {
    constructor() {
        super("background", "Background object grass", "green");
    }

    draw(ctx, x, y, size) {
        ctx.fillStyle = this.color;
        ctx.fillRect(x, y, size, size);
    }
}