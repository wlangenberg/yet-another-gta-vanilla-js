import { CanvasManager } from './canvas.js';
import { LevelData } from './levelData.js';
import { Renderer } from './renderer.js';
import { InputHandler } from './inputHandler.js';
import * as editorTools from './tools.js';

class LevelEditor {
    constructor() {
        this.canvasManager = new CanvasManager();
        this.levelData = new LevelData();
        this.renderer = new Renderer(this.canvasManager.ctx, this.levelData);
        this.inputHandler = new InputHandler(
            document.getElementById('gameCanvas'),
            this.levelData,
            this.canvasManager,
            this.renderer
        );
        
        this.tools = Object.values(editorTools).map(ToolClass => new ToolClass());
        this.inputHandler.setSelectedTool(this.tools[0]);
        
        this.initUI();
        this.setupEventListeners();
    }

    initUI() {
        this.populateToolList();
        this.canvasManager.initCanvas();
        this.renderer.init(this.canvasManager.ctx)
        this.renderer.redraw(
            this.canvasManager.backgroundColor,
            this.canvasManager.zoomLevel,
            this.canvasManager.cameraX,
            this.canvasManager.cameraY
        );
    }

    populateToolList() {
        const toolList = document.getElementById("tool-list");
        toolList.innerHTML = "";

        this.tools.forEach((tool) => {
            const div = document.createElement("div");
            div.classList.add("tool-item");
            div.textContent = tool.name;
            div.style.background = tool.color;
            div.addEventListener("click", () => {
                this.inputHandler.setSelectedTool(tool);
            });
            toolList.appendChild(div);
        });
    }

    setupEventListeners() {
        document.getElementById('open-tool-panel').addEventListener('click', () => {
            document.getElementById('tool-panel').classList.toggle('hidden');
        });

        document.getElementById('paint-tool-size').addEventListener('change', (event) => {
            this.levelData.setPaintToolSize(parseInt(event.target.value));
        });

        document.getElementById('grid-size').addEventListener('change', (event) => {
            this.canvasManager.setGridSize(parseInt(event.target.value));
        });

        document.getElementById('grid-color').addEventListener('change', (event) => {
            this.canvasManager.setGridColor(event.target.value);
        });

        document.getElementById('background-color').addEventListener('change', (event) => {
            this.canvasManager.setBackgroundColor(event.target.value);
            this.renderer.redraw(
                this.canvasManager.backgroundColor,
                this.canvasManager.zoomLevel,
                this.canvasManager.cameraX,
                this.canvasManager.cameraY
            );
        });

        document.getElementById('toggle-grid').addEventListener('click', () => {
            this.canvasManager.toggleGrid();
        });

        document.getElementById('zoom-level').addEventListener('input', (event) => {
            this.canvasManager.setZoomLevel(parseFloat(event.target.value));
        });

        document.getElementById('save-level').addEventListener('click', () => {
            const levelData = this.levelData.exportLevel(this.canvasManager.backgroundColor);
            const jsonString = JSON.stringify(levelData, null, 2);
            const blob = new Blob([jsonString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'level.json';
            a.click();
            URL.revokeObjectURL(url);
        });

        window.addEventListener('resize', () => this.canvasManager.initCanvas());
    }
}

new LevelEditor();
// Initialize the editor when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // console.log('asdsda')
});