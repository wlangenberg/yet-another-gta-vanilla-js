import { GameObject } from '../../game-object.js'

class Platform extends GameObject {
    constructor(x, y, width, height, color, hasGravity = false, ctx) {
        super(x, y, width, height, color, ctx);
        this.hasGravity = hasGravity;
    }

    update(interval) {
        if (this.hasGravity) {
            this.velocity.y += 0.1 * interval; // Simulate gravity for moving platforms
        }
        super.update(interval);
    }
}

export { Platform };
