// Global variables
let gridSize = 12;
let paintToolSize = 12;
let zoomLevel = 1; // Default zoom level
let ctx, gridCtx;
const rectangles = [];
let isDrawing = false;
let isErasing = false;
let isPanning = false;
let cameraX = 0, cameraY = 0;
let lastMouseX = 0, lastMouseY = 0;


class PaintTool {
  constructor(id, name, color) {
      this.id = id;
      this.name = name;
      this.color = color;
  }

  draw(ctx, x, y, size) {
      console.warn("Draw method should be implemented in subclasses.");
  }
}

class PlayerSpawnTool extends PaintTool {
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


class RectangleTool extends PaintTool {
  constructor() {
      super("rectangle", "Rectangle", "blue");
  }

  draw(ctx, x, y, size) {
      ctx.fillStyle = this.color;
      ctx.fillRect(x, y, size, size);
  }
}

class CircleTool extends PaintTool {
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

const tools = [new RectangleTool(), new CircleTool(), new PlayerSpawnTool()];
const playerSpawns = [];

let selectedTool = tools[0]; // Default selection

function populateToolList() {
  const toolList = document.getElementById("tool-list");
  toolList.innerHTML = "";

  tools.forEach((tool) => {
      const div = document.createElement("div");
      div.classList.add("tool-item");
      div.textContent = tool.name;
      div.style.background = tool.color;
      div.addEventListener("click", () => {
          selectedTool = tool;
      });
      toolList.appendChild(div);
  });
}

document.getElementById("open-tool-panel").addEventListener("click", () => {
  document.getElementById("tool-panel").classList.toggle("hidden");
});

populateToolList();

function initCanvas() {
    const gridCanvas = document.getElementById('gridCanvas');
    const gameCanvas = document.getElementById('gameCanvas');

    gridCanvas.width = gameCanvas.width = window.innerWidth - 200;
    gridCanvas.height = gameCanvas.height = window.innerHeight;

    gridCtx = gridCanvas.getContext('2d');
    ctx = gameCanvas.getContext('2d');

    drawGrid();
    redrawCanvas();
}

// Function to apply zoom
function applyZoom() {
    ctx.setTransform(zoomLevel, 0, 0, zoomLevel, -cameraX * zoomLevel, -cameraY * zoomLevel);
    gridCtx.setTransform(zoomLevel, 0, 0, zoomLevel, -cameraX * zoomLevel, -cameraY * zoomLevel);
    
    drawGrid();
    redrawCanvas();
}

// Function to draw the grid (ONLY on gridCanvas)
function drawGrid() {
    gridCtx.resetTransform(); // Reset to default before drawing
    gridCtx.clearRect(0, 0, gridCtx.canvas.width, gridCtx.canvas.height);
    gridCtx.strokeStyle = '#A9A9A9';
    gridCtx.lineWidth = 1;
    gridCtx.globalAlpha = 1;

    gridCtx.beginPath();

    for (let x = -cameraX % gridSize; x < gridCtx.canvas.width; x += gridSize) {
        gridCtx.moveTo(x, 0);
        gridCtx.lineTo(x, gridCtx.canvas.height);
    }

    for (let y = -cameraY % gridSize; y < gridCtx.canvas.height; y += gridSize) {
        gridCtx.moveTo(0, y);
        gridCtx.lineTo(gridCtx.canvas.width, y);
    }

    gridCtx.stroke();
}

// Function to handle zoom level changes
function setupZoomControl() {
    document.getElementById('zoom-level').addEventListener('input', (event) => {
        zoomLevel = parseFloat(event.target.value);
        applyZoom();
    });
}

// Function to handle user interactions
function handleUserInteractions() {
    const gameCanvas = document.getElementById('gameCanvas');

    gameCanvas.addEventListener('mousedown', (event) => {
        if (event.shiftKey || event.button === 1) {
            isPanning = true;
            lastMouseX = event.clientX;
            lastMouseY = event.clientY;
            return;
        }

        if (event.button === 0) {
            isDrawing = true;
            drawRectangle(event);
        } else if (event.button === 2) {
            isErasing = true;
            removeRectangle(event);
        }
    });

    gameCanvas.addEventListener('mousemove', (event) => {
        if (isPanning) {
            let dx = event.clientX - lastMouseX;
            let dy = event.clientY - lastMouseY;
            cameraX -= dx / zoomLevel;
            cameraY -= dy / zoomLevel;
            lastMouseX = event.clientX;
            lastMouseY = event.clientY;
            drawGrid();
            redrawCanvas();
            applyZoom();
            return;
        }

        if (isDrawing) drawRectangle(event);
        if (isErasing) removeRectangle(event);
    });

    gameCanvas.addEventListener('mouseup', () => {
        isDrawing = false;
        isErasing = false;
        isPanning = false;
    });

    gameCanvas.addEventListener('contextmenu', (event) => {
        event.preventDefault();
    });
}


function drawRectangle(event) {
    const gameCanvas = document.getElementById('gameCanvas');
    const rect = gameCanvas.getBoundingClientRect();

    const x = (event.clientX - rect.left) / zoomLevel + cameraX;
    const y = (event.clientY - rect.top) / zoomLevel + cameraY;

    const rectX = Math.floor(x / paintToolSize) * paintToolSize;
    const rectY = Math.floor(y / paintToolSize) * paintToolSize;

    if (selectedTool.id === "player_spawn") {
        // Check if spawn point already exists at this location
        const exists = playerSpawns.some(spawn => spawn.x === rectX && spawn.y === rectY);
        if (!exists) {
            playerSpawns.push({ x: rectX, y: rectY });
        }
    } else {
        const exists = rectangles.some(r => r.x === rectX && r.y === rectY);
        if (!exists) {
            rectangles.push({ x: rectX, y: rectY, width: paintToolSize, height: paintToolSize, color: selectedTool.color, type: selectedTool.id });
        }
    }

    redrawCanvas();
}



// Function to remove a rectangle while holding right-click
function removeRectangle(event) {
  const gameCanvas = document.getElementById('gameCanvas');
  const rect = gameCanvas.getBoundingClientRect();
  const x = event.clientX - rect.left + cameraX;
  const y = event.clientY - rect.top + cameraY;

  const rectX = Math.floor(x / paintToolSize) * paintToolSize;
  const rectY = Math.floor(y / paintToolSize) * paintToolSize;

  // Find the index of the clicked rectangle
  const index = rectangles.findIndex(r => r.x === rectX && r.y === rectY);
  
  if (index !== -1) {
      rectangles.splice(index, 1); // Remove it from the array
      redrawCanvas(); // Redraw all rectangles
  }
}



function redrawCanvas() {
  ctx.resetTransform();
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  ctx.setTransform(zoomLevel, 0, 0, zoomLevel, -cameraX * zoomLevel, -cameraY * zoomLevel);

  rectangles.forEach(rect => {
      ctx.fillStyle = rect.color;
      ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
  });

  playerSpawns.forEach(spawn => {
      ctx.fillStyle = "green";
      ctx.beginPath();
      ctx.arc(spawn.x + paintToolSize / 2, spawn.y + paintToolSize / 2, paintToolSize / 3, 0, Math.PI * 2);
      ctx.fill();
  });
}

function saveLevel() {
  const levelData = {
      gridSize,
      paintToolSize,
      rectangles: rectangles.map(r => ({
          x: r.x,
          y: r.y,
          width: r.width,
          height: r.height,
          color: r.color,
          type: r.type
      })),
      playerSpawns: playerSpawns.map(spawn => ({ x: spawn.x, y: spawn.y }))
  };

  const jsonString = JSON.stringify(levelData, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'level.json';
  a.click();
  URL.revokeObjectURL(url);
}

function initToolbar() {
  document.getElementById('paint-tool-size').addEventListener('change', (event) => {
      paintToolSize = parseInt(event.target.value);
  });

  document.getElementById('grid-size').addEventListener('change', (event) => {
      gridSize = parseInt(event.target.value);
      drawGrid();
  });

  document.getElementById('grid-color').addEventListener('change', () => {
      drawGrid();
  });

  document.getElementById('save-level').addEventListener('click', saveLevel);
}

// Initialize the level editor
function initLevelEditor() {
    initCanvas();
    initToolbar();
    handleUserInteractions();
    setupZoomControl();
}

// Resize canvases on window resize
window.addEventListener('resize', initCanvas);

// Start the editor
initLevelEditor();
