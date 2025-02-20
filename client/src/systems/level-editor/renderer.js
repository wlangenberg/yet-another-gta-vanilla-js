export class Renderer {
    constructor(ctx, levelData) {
        this.ctx = ctx;
        this.levelData = levelData;
    }

    init(ctx) {
        this.ctx = ctx
    }

    redraw(backgroundColor, zoomLevel, cameraX, cameraY) {
        this.ctx.resetTransform();
        this.ctx.clearRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height);
        this.ctx.fillStyle = backgroundColor;
        this.ctx.fillRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height);

        this.ctx.setTransform(zoomLevel, 0, 0, zoomLevel, -cameraX * zoomLevel, -cameraY * zoomLevel);

        this.levelData.rectangles.forEach(rect => {
            this.ctx.fillStyle = rect.color;
            this.ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
        });

        this.levelData.playerSpawns.forEach(spawn => {
            this.ctx.fillStyle = "green";
            this.ctx.beginPath();
            this.ctx.arc(
                spawn.x + this.levelData.paintToolSize / 2,
                spawn.y + this.levelData.paintToolSize / 2,
                this.levelData.paintToolSize / 3,
                0,
                Math.PI * 2
            );
            this.ctx.fill();
        });
    }
}