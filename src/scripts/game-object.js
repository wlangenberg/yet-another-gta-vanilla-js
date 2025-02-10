import { gravity } from '../../constants.js';

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


class GameObject {
    constructor(x, y, width, height, color, ctx, hasGravity) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.color = color;
        this.velocity = { x: 0, y: 0 };
        this.ctx = ctx;
        this.hasGravity = hasGravity;
        this.stepHeight = this.height / 4; // Maximum step-up height
    }

    update(interval, allGameObjects = [], spatialGrid) {
        if (this.hasGravity) {
            this.grounded = false;
            this.handleGravity(interval);
            this.x += (Math.abs(this.velocity.x) < 0.1) ? 0 : this.velocity.x * interval;
            this.y += this.velocity.y * interval;
            
            const nearbyObjects = spatialGrid.query(this);
            for (const obj of nearbyObjects) {
                if (obj !== this && this.checkBroadPhaseCollision(obj)) {
                    obj.handleCollision(this);
                }
            }
            
        }

        this.draw();
    }

    handleGravity(interval) {
        if (!this.grounded) this.velocity.y += gravity * interval;
    }

    checkCollision(movableObject) {
        return !(movableObject.x >= this.x + this.width || 
            movableObject.x + movableObject.width <= this.x || 
            movableObject.y >= this.y + this.height || 
            movableObject.y + movableObject.height <= this.y);
    }

    checkBroadPhaseCollision(other) {
        const expandedX = this.velocity.x > 0 ? this.x : this.x + this.velocity.x;
        const expandedY = this.velocity.y > 0 ? this.y : this.y + this.velocity.y;
        const expandedWidth = this.velocity.x > 0 ? this.width + this.velocity.x : this.width - this.velocity.x;
        const expandedHeight = this.velocity.y > 0 ? this.height + this.velocity.y : this.height - this.velocity.y;

        return !(other.x >= expandedX + expandedWidth || 
                 other.x + other.width <= expandedX || 
                 other.y >= expandedY + expandedHeight || 
                 other.y + other.height <= expandedY);
    }

    handleCollision(movableObject) {
        if (!this.checkCollision(movableObject)) return;

        const bottomOverlap = movableObject.y + movableObject.height - this.y;
        const topOverlap = this.y + this.height - movableObject.y;

        if (movableObject.velocity.y > 0 && bottomOverlap > 0 && bottomOverlap < movableObject.height) {
            movableObject.y = this.y - movableObject.height;
            movableObject.velocity.y = 0;
            movableObject.grounded = true;
        } 
        else if (movableObject.velocity.y < 0 && topOverlap > 0 && topOverlap < movableObject.height * 0.5) {
            movableObject.y = this.y + this.height;
            movableObject.velocity.y = 0;
        } 
        else {
            const middleX = this.x + this.width / 2;
            if (movableObject.x + movableObject.width / 2 < middleX) {
                // Movable object is on the left side
                if (movableObject.height - (this.y - movableObject.y) <= movableObject.stepHeight) {
                    // movableObject.y = this.y - movableObject.height; // Step up
                    movableObject.velocity.y -= 0.005; // Step up
                } else {
                    movableObject.x = this.x - movableObject.width; // Stop movement
                    if (this.hasGravity) {
                        this.velocity.x += movableObject.velocity.x;
                    }
                    movableObject.velocity.x = 0;
                }
            } else {
                // Movable object is on the right side
                if (movableObject.height - (this.y - movableObject.y) <= movableObject.stepHeight) {
                    movableObject.velocity.y -= 0.005; // Step up
                } else {
                    movableObject.x = this.x + this.width; // Stop movement
                    if (this.hasGravity) {
                        this.velocity.x += movableObject.velocity.x;
                    }
                    movableObject.velocity.x = 0;
                }
            }
        }
    }

    draw() {
        this.ctx.fillStyle = this.color;
        // Just for test right now, might change later, this could be good to use on ground etc later... on players/enemies it might be weird
        const BUFFER = 0.5;
        this.ctx.fillRect(this.x - BUFFER, this.y - BUFFER, this.width + BUFFER * 2, this.height + BUFFER * 2);
        // this.ctx.fillRect(this.x, this.y, this.width, this.height); // Old draw
        
    }
}

export { GameObject, SpatialGrid };
