import { ctx } from '/constants.js';

class Platform {
    constructor(x, y, width, height, color) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.color = color;
    }

    draw() {
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, this.width, this.height);
    }

    checkCollision(player) {
        return player.x < this.x + this.width &&
               player.x + player.width > this.x &&
               player.y < this.y + this.height &&
               player.y + player.height > this.y;
    }

    handleCollision(player) {
        if (this.checkCollision(player)) {
            // Top collision
            if (player.dy > 0 && player.y + player.height > this.y) {
                player.y = this.y - player.height;
                player.dy = 0;
                player.grounded = true;
            }
            // Bottom collision
            else if (player.dy < 0 && player.y < this.y + this.height) {
                player.y = this.y + this.height;
                player.dy = 0;
            }
            // Side collisions
            else {
                if (player.x < this.x) {
                    player.x = this.x - player.width;
                } else {
                    player.x = this.x + this.width;
                }
                player.speed = 0;
            }
        }
    }
}

export { Platform };
