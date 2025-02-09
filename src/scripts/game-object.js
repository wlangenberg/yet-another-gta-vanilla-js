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
        this.collisionPadding = 0; // Reduce collision sensitivity
    }

    update(interval, allGameObjects = []) {
        if (this.hasGravity) {
            this.grounded = false;
            this.handleGravity(interval);
            this.x += this.velocity.x * interval;
            this.y += this.velocity.y * interval;
            allGameObjects.forEach(object => object.handleCollision(this));
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
            const bottomOverlap = movableObject.y + movableObject.height - this.y; // How deep into the floor
            const topOverlap = this.y + this.height - movableObject.y; // How deep into the ceiling

            // Movable object is touching it's feet on THIS top side
            if (movableObject.velocity.y > 0 && bottomOverlap > 0 && bottomOverlap < movableObject.height * 0.5) {
                movableObject.y = this.y - movableObject.height;
                movableObject.velocity.y = 0;
                movableObject.grounded = true;
            }
            // Movable object is touching it's head on THIS bottom side
            else if (movableObject.velocity.y < 0 && topOverlap > 0 && topOverlap < movableObject.height * 0.5) {
                movableObject.y = this.y + this.height;
                movableObject.velocity.y = 0;
            }
            // Movable object collides with THIS sides
            else {
                const middleX = this.x + this.width / 2; // Calculate the middle point of this object
                if ( movableObject.x + movableObject.width / 2 < middleX) {
                    // Movable object is on the left side
                    movableObject.x = this.x - movableObject.width;
                } else  {
                    // Movable object is on the right side
                    movableObject.x = this.x + this.width;
                }
                movableObject.velocity.x = 0;
            }
        }
    }

    draw() {
        this.ctx.fillStyle = this.color;
        this.ctx.fillRect(this.x, this.y, this.width, this.height);
    }
}

export { GameObject };
