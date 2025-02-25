import { LAYERS } from "../../configuration/constants.js";

class PaintTool {
    constructor(id, name, color = "#111111", layer = LAYERS.WORLD) {
        this.id = id;
        this.name = name;
        this.color = color;
        this.layer = layer;
    }

    draw(x, y, color, levelData) {
        console.warn("Draw method should be implemented in subclasses.");
        this.addRectangle(x,y,this.color,levelData)
    }

    addRectangle(x, y, color, levelData) {
        const exists = levelData.rectangles.some(r => r.x === x && r.y === y);
        if (!exists) {
            levelData.rectangles.push({
                x,
                y,
                width: levelData.paintToolSize,
                height: levelData.paintToolSize,
                color,
                type: this.id,
                layer: this.layer,
            });
        }
    }
}

export class RectangleTool extends PaintTool {
    constructor() {
        super("rectangle", "Rectangle", "#111111", LAYERS.WORLD);
    }

    draw(x, y, color, levelData) {
        super.draw(x, y, color, levelData)
    }
}

export class GrassTool extends PaintTool {
    constructor() {
        super("grass", "Grass", "#228B22", LAYERS.WORLD);
    }

    draw(x, y, color, levelData) {
        super.draw(x, y, color, levelData)
    }
}

export class DirtTool extends PaintTool {
    constructor() {
        super("dirt", "Dirt", "#964B00", LAYERS.WORLD);
    }

    draw(x, y, color, levelData) {
        super.draw(x, y, color, levelData)
    }
}

export class StoneTool extends PaintTool {
    constructor() {
        super("stone", "Stone", "#808080", LAYERS.WORLD);
    }

    draw(x, y, color, levelData) {
        super.draw(x, y, color, levelData)
    }
}

export class PlayerSpawnTool extends PaintTool {
    constructor() {
        super("player_spawn", "Player Spawn", "#19853C", LAYERS.WORLD);
    }

    draw(x, y, color, levelData) {
        super.draw(x, y, color, levelData)
    }
}

export class BackgroundObject extends PaintTool {
    constructor() {
        super("background", "Background object", "#964B00", LAYERS.BACKGROUND);
    }

    draw(x, y, color, levelData) {
        super.draw(x, y, color, levelData)
    }
}

export class BackgroundObject2 extends PaintTool {
    constructor() {
        super("background", "Background object grass", "#228B22", LAYERS.BACKGROUND);
    }

    draw(x, y, color, levelData) {
        super.draw(x, y, color, levelData)
    }
}


// FillTool.js
export class FillTool {
    constructor() {
      this.id = "fill";
      this.name = "Fill Tool";
      // This tool will use the active paint tool’s color when filling.
      // (A default is provided in case no paint tool is selected.)
      this.defaultColor = "#000000";
    }
  
    // The draw method uses a simple flood-fill algorithm.
    // It receives the fill color (from the active paint tool) as its third parameter.
    draw(x, y, fillColor, levelData, activePaintTool) {
      const cellSize = levelData.paintToolSize;
      // Get the color currently present at the clicked cell.
      const targetColor = this.getCellColor(x, y, levelData);
      const colorToFill = fillColor || this.defaultColor;
      if (targetColor === colorToFill) return; // nothing to do if already filled
  
      const queue = [];
      const visited = new Set();
      queue.push({ x, y });
  
      while (queue.length > 0) {
        const { x: cx, y: cy } = queue.shift();
        const key = `${cx},${cy}`;
        if (visited.has(key)) continue;
        visited.add(key);
  
        const currentColor = this.getCellColor(cx, cy, levelData);
        if (currentColor !== targetColor) continue;
  
        // If a rectangle exists at the cell, update its color; otherwise, add one.
        const index = levelData.rectangles.findIndex(r => r.x === cx && r.y === cy);
        if (index !== -1) {
          levelData.rectangles[index].color = colorToFill;
        } else {
          levelData.rectangles.push({
            x: cx,
            y: cy,
            width: cellSize,
            height: cellSize,
            color: colorToFill,
            // We mark the cell with the fill tool’s type. You could also use the active paint tool’s id.
            type: "fill",
            layer: activePaintTool.layer
          });
        }
  
        // Add the four neighboring cells (using 4-direction connectivity).
        queue.push({ x: cx - cellSize, y: cy });
        queue.push({ x: cx + cellSize, y: cy });
        queue.push({ x: cx, y: cy - cellSize });
        queue.push({ x: cx, y: cy + cellSize });
      }
    }
  
    // Helper: return the color of the cell at (x,y). If none exists, return the background.
    getCellColor(x, y, levelData) {
      const rect = levelData.rectangles.find(r => r.x === x && r.y === y);
      return rect ? rect.color : (levelData.backgroundColor || "#ffffff");
    }
  }
  