import { gravity } from '../../constants.js';

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

    update(interval, allGameObjects = []) {
        if (this.hasGravity) {
            this.grounded = false;
            this.handleGravity(interval);
            this.x += (Math.abs(this.velocity.x) < 0.1) ? 0 : this.velocity.x * interval;
            this.y += this.velocity.y * interval;
            
            for (let i = 0; i < allGameObjects.length; i++) {
                if (allGameObjects[i] !== this) {
                    allGameObjects[i].handleCollision(this);
                }
            }
        }

        this.draw();
    }

    handleGravity(interval) {
        if (!this.grounded) this.velocity.y += gravity * interval;
    }

    checkCollision(movableObject) {
        return movableObject.x < this.x + this.width &&
               movableObject.x + movableObject.width > this.x &&
               movableObject.y < this.y + this.height &&
               movableObject.y + movableObject.height > this.y;
    }

    handleCollision(movableObject) {
        if (this.checkCollision(movableObject)) {
            const bottomOverlap = movableObject.y + movableObject.height - this.y;
            const topOverlap = this.y + this.height - movableObject.y;

            if (movableObject.velocity.y > 0 && bottomOverlap > 0 && bottomOverlap < movableObject.height * 0.5) {
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
                        movableObject.y = this.y - movableObject.height; // Step up
                    } else {
                        movableObject.x = this.x - movableObject.width; // Stop movement
                        movableObject.velocity.x = 0;
                    }
                } else {
                    // Movable object is on the right side
                    if (movableObject.height - (this.y - movableObject.y) <= movableObject.stepHeight) {
                        movableObject.y = this.y - movableObject.height; // Step up
                    } else {
                        movableObject.x = this.x + this.width; // Stop movement
                        movableObject.velocity.x = 0;
                    }
                }
            }
        }
    }

    draw() {
        this.ctx.fillStyle = this.color;
        this.ctx.fillRect(this.x, this.y, this.width, this.height);
    }
}

export { GameObject };
