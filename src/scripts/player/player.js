import { canvas, ctx, gravity, keys } from '/constants.js';

class Player {
    constructor(x, y, width, height, color) {
        this.id = Math.floor(Math.random() * (2 ** 31)),
        this.name = "Player" + this.id;
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.color = color;
        this.dy = 0;
        this.jumpForce = 10;
        this.maxSpeed = 25;
        this.friction = 0.12;
        this.speed = 0;
        this.direction = 0;
        this.maxAcceleration = 4;
        this.acceleration = 0;
        this.originalHeight = height;
        this.grounded = false;
        this.jumpTimer = 0;
    }

    animate(interval) { 
        this.dy += gravity * interval;
        this.y += this.dy;
        if (this.grounded) this.speed *= interval * this.friction;

        this.speed = this.speed < 0.001 ? 0 : this.speed;
        this.x += Math.min(this.maxSpeed * interval, this.speed) * this.direction;
        
        if (this.jumpTimer > 0) {
            this.jumpTimer--;
            this.dy = -this.jumpForce;
        }

        if (this.y + this.height > canvas.height - 100) {
            this.y = canvas.height - this.height - 100;
            this.grounded = true;
            this.dy = 0;
        }

        this.draw();
    }

    draw() {
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, this.width, this.height);
    }

    move(interval) {
        if (keys['ArrowUp'] && this.grounded) {
            this.jumpTimer = 12;
            this.y -= 10;
            this.grounded = false;
        }
        if (keys['ArrowRight']) {
            if (this.acceleration > 0 && this.direction === -1) {
                this.speed -= this.acceleration;
                if (this.speed < 0) {
                    this.speed = 0;
                    this.acceleration = 0;
                }
                return;
            }

            if (this.grounded) {
                this.direction = 1;
                this.acceleration = Math.min(this.maxAcceleration, this.acceleration + 0.01 * interval);
                this.speed += this.acceleration;
                return;
            }
        }
        if (keys['ArrowLeft']) {
            if (this.acceleration > 0 && this.direction === 1) {
                this.speed -= this.acceleration;
                if (this.speed < 0) {
                    this.speed = Math.abs(this.speed);
                    this.acceleration = 0;
                }
                return;
            } 

            if (this.grounded) {
                this.direction = -1;
                this.acceleration = Math.min(this.maxAcceleration, this.acceleration + 0.01 * interval);
                this.speed += this.acceleration;
                return;
            }
        }
        this.acceleration = 0;
    }
}


export { Player };
