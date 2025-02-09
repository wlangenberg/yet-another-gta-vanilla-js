import { GameObject } from '../../game-object.js'

class Platform extends GameObject {
    constructor(x, y, width, height, color, ctx, hasGravity = false, ) {
        super(x, y, width, height, color, ctx);
        this.hasGravity = hasGravity;
    }

    update(interval, platforms) {
        super.update(interval);
    }
}

export { Platform };
