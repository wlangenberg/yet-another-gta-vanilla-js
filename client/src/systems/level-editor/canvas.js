export class CanvasManager {
    constructor() {
        this.gridSize = 12;
        this.showGrid = true;
        this.gridColor = "#cccccc";
        this.backgroundColor = "#ffffff";
        this.zoomLevel = 1;
        this.cameraX = 0;
        this.cameraY = 0;
        
        this.ctx = null;
        this.gridCtx = null;
    }

    initCanvas() {
        const gridCanvas = document.getElementById('gridCanvas');
        const gameCanvas = document.getElementById('gameCanvas');

        gridCanvas.width = gameCanvas.width = window.innerWidth - 200;
        gridCanvas.height = gameCanvas.height = window.innerHeight;

        this.gridCtx = gridCanvas.getContext('2d');
        this.ctx = gameCanvas.getContext('2d');
        this.canvas = gameCanvas
        
        this.drawGrid();
    }

    applyZoom() {
        this.ctx.setTransform(this.zoomLevel, 0, 0, this.zoomLevel, 
            -this.cameraX * this.zoomLevel, -this.cameraY * this.zoomLevel);
        this.gridCtx.setTransform(this.zoomLevel, 0, 0, this.zoomLevel, 
            -this.cameraX * this.zoomLevel, -this.cameraY * this.zoomLevel);
        
        this.drawGrid();
    }

    drawGrid() {
        this.gridCtx.resetTransform();
        this.gridCtx.clearRect(0, 0, this.gridCtx.canvas.width, this.gridCtx.canvas.height);

        if (!this.showGrid) return;

        this.gridCtx.strokeStyle = this.gridColor;
        this.gridCtx.lineWidth = 1;
        this.gridCtx.beginPath();

        for (let x = -this.cameraX % this.gridSize; x < this.gridCtx.canvas.width; x += this.gridSize) {
            this.gridCtx.moveTo(x, 0);
            this.gridCtx.lineTo(x, this.gridCtx.canvas.height);
        }

        for (let y = -this.cameraY % this.gridSize; y < this.gridCtx.canvas.height; y += this.gridSize) {
            this.gridCtx.moveTo(0, y);
            this.gridCtx.lineTo(this.gridCtx.canvas.width, y);
        }

        this.gridCtx.stroke();
    }

    setGridSize(size) {
        this.gridSize = size;
        this.drawGrid();
    }

    setGridColor(color) {
        this.gridColor = color;
        this.drawGrid();
    }

    setBackgroundColor(color) {
        this.backgroundColor = color;
    }

    toggleGrid() {
        this.showGrid = !this.showGrid;
        this.drawGrid();
    }

    setZoomLevel(level) {
        this.zoomLevel = level;
        this.applyZoom();
    }
}