export class InputHandler {
    constructor(canvas, levelData, canvasManager, renderer) {
        this.canvas = canvas;
        this.levelData = levelData;
        this.canvasManager = canvasManager;
        this.renderer = renderer;
        
        this.isDrawing = false;
        this.isErasing = false;
        this.isPanning = false;
        this.lastMouseX = 0;
        this.lastMouseY = 0;
        
        this.selectedTool = null;

        this.selectedTool = null;
        // New property: holds the active (non–fill) paint tool.
        this.activePaintTool = null;
        
        this.setupEventListeners();
    }

    setupEventListeners() {
        this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
        this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
        this.canvas.addEventListener('mouseup', this.handleMouseUp.bind(this));
        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    handleMouseDown(event) {
        if (event.shiftKey || event.button === 1) {
            this.isPanning = true;
            this.lastMouseX = event.clientX;
            this.lastMouseY = event.clientY;
            return;
        }

        if (event.button === 0) {
            this.isDrawing = true;
            this.draw(event);
        } else if (event.button === 2) {
            this.isErasing = true;
            this.erase(event);
        }
    }

    handleMouseMove(event) {
        if (this.isPanning) {
            const dx = event.clientX - this.lastMouseX;
            const dy = event.clientY - this.lastMouseY;
            this.canvasManager.cameraX -= dx / this.canvasManager.zoomLevel;
            this.canvasManager.cameraY -= dy / this.canvasManager.zoomLevel;
            this.lastMouseX = event.clientX;
            this.lastMouseY = event.clientY;
            this.canvasManager.drawGrid();
            this.renderer.redraw(
                this.canvasManager.backgroundColor,
                this.canvasManager.zoomLevel,
                this.canvasManager.cameraX,
                this.canvasManager.cameraY
            );
            return;
        }

        if (this.isDrawing) this.draw(event);
        if (this.isErasing) this.erase(event);
    }

    handleMouseUp() {
        this.isDrawing = false;
        this.isErasing = false;
        this.isPanning = false;
    }

    getGridPosition(event) {
        const rect = this.canvas.getBoundingClientRect();
        const x = (event.clientX - rect.left) / this.canvasManager.zoomLevel + this.canvasManager.cameraX;
        const y = (event.clientY - rect.top) / this.canvasManager.zoomLevel + this.canvasManager.cameraY;

        return {
            x: Math.floor(x / this.levelData.paintToolSize) * this.levelData.paintToolSize,
            y: Math.floor(y / this.levelData.paintToolSize) * this.levelData.paintToolSize
        };
    }

    setActivePaintTool(tool) {
        this.activePaintTool = tool;
      }
      

    setSelectedTool(tool) {
        this.selectedTool = tool;
      }
      

    draw(event) {
        if (!this.selectedTool) return;
        
        const pos = this.getGridPosition(event);
        
        if (this.selectedTool.id === "fill") {
          // Use the active paint tool’s color for filling.
          const fillColor = (this.activePaintTool && this.activePaintTool.color) ? this.activePaintTool.color : "#000000";
          this.selectedTool.draw(pos.x, pos.y, fillColor, this.levelData, this.activePaintTool);
        } else if (this.selectedTool.id === "player_spawn") {
          this.levelData.addPlayerSpawn(pos.x, pos.y);
        } else {
          this.selectedTool.draw(pos.x, pos.y, this.selectedTool.color, this.levelData);
        }
        
        this.renderer.redraw(
          this.canvasManager.backgroundColor,
          this.canvasManager.zoomLevel,
          this.canvasManager.cameraX,
          this.canvasManager.cameraY
        );
    }

    erase(event) {
        const pos = this.getGridPosition(event);
        this.levelData.removeRectangle(pos.x, pos.y);
        this.renderer.redraw(
            this.canvasManager.backgroundColor,
            this.canvasManager.zoomLevel,
            this.canvasManager.cameraX,
            this.canvasManager.cameraY
        );
    }

    setSelectedTool(tool) {
        this.selectedTool = tool;
    }
}