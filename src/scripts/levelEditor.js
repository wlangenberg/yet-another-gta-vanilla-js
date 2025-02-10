// Logic for rendering the grid
function renderGrid() {
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const gridSize = 12;
  const width = canvas.width;
  const height = canvas.height;

  for (let x = 0; x < width; x += gridSize) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
  }
  for (let y = 0; y < height; y += gridSize) {
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
  }
  ctx.strokeStyle = '#ccc';
  ctx.stroke();
}

const rectangles = [];
// Logic for handling user interactions
function handleUserInteractions() {
  const canvas = document.getElementById('gameCanvas');
  let isDrawing = false;

  canvas.addEventListener('mousedown', (event) => {
    isDrawing = true;
    drawRectangle(event.clientX, event.clientY);
  });

  canvas.addEventListener('mousemove', (event) => {
    if (isDrawing) {
      drawRectangle(event.clientX, event.clientY);
    }
  });

  canvas.addEventListener('mouseup', () => {
    isDrawing = false;
  });
}

// Function to save the level to a JSON file
function saveLevel() {
  const levelData = {
    rectangles: rectangles.map(rect => ({
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height
    }))
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

// Function to draw a rectangle
function drawRectangle(x, y) {
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const gridSize = 12;

  const rectX = Math.floor(x / gridSize) * gridSize;
  const rectY = Math.floor(y / gridSize) * gridSize;

  ctx.fillStyle = 'rgba(0, 128, 255, 0.5)';
  ctx.fillRect(rectX, rectY, gridSize, gridSize);

  rectangles.push({ x: rectX, y: rectY, width: gridSize, height: gridSize });
}

// Initialization function
function initLevelEditor() {
  renderGrid();
  handleUserInteractions();

  document.getElementById('save-level').addEventListener('click', () => {
    saveLevel()
  })
}
initLevelEditor()