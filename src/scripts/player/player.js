import { canvas, ctx, gravity, keys } from '/constants.js';

class Player {
    constructor(x, y, width, height, color) {
        this.id = Math.floor(Math.random() * (2 ** 31));
        this.name = "Player" + this.id;
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.color = color;
        this.dy = 0;
        this.jumpForce = 3;
        this.maxSpeed = 25;
        this.friction = 0.75;
        this.speed = 0;
        this.baseAcceleration = 0.002; // Base acceleration rate
        this.airFriction = 0.90;
        this.direction = 0;
        this.grounded = false;
        this.runTime = 0; // Track the time running in one direction
        this.movingStartTime = null; // Track when movement starts
        this.initialBoostDuration = 10; // Duration of initial speed boost (in milliseconds)
        this.initialBoostFactor = 0.1; // Factor by which to multiply acceleration during initial boost
    }

    animate(interval, platforms) {
        this.handleGravity(interval);
        this.handleSpeed(interval);
        this.groundedCheck(platforms);
        this.move(interval);
        this.draw();
    }

    handleSpeed(interval) {
        if (this.grounded) {
            this.speed *= this.friction;
        } else {
            this.speed *= this.airFriction; // Slightly reduced friction in the air
        }
        
        if (Math.abs(this.speed) < 0.1) this.speed = 0; // Stop when speed is very low
        this.x += this.speed * interval;
    }

    handleGravity(interval) {
        this.dy += gravity * interval;
        this.y += this.dy;
    }

    groundedCheck(platforms) {
        // Reset grounded state before checking collisions
        this.grounded = false;
        if (platforms) {
            platforms.forEach(platform => platform.handleCollision(this));
        }
    }

    draw() {
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, this.width, this.height);
    }

    move(interval) {
        const accelerationFactor = this.grounded ? 1 : 0.5; // Reduce acceleration in the air

        if (keys['ArrowUp'] && this.grounded) {
            this.dy = -(this.jumpForce * interval);
            this.grounded = false;
        }

        const now = performance.now();

        if (keys['ArrowRight']) {
            if (this.direction !== 1) {
                this.runTime = 0; // Reset run time on direction change
            }
            this.movingStartTime = now; // Record the start of movement
            this.direction = 1;
            this.runTime += interval;
        } else if (keys['ArrowLeft']) {
            if (this.direction !== -1) {
                this.runTime = 0; // Reset run time on direction change
            }
            this.movingStartTime = now; // Record the start of movement
            this.direction = -1;
            this.runTime += interval;
        } else {
            this.runTime = 0; // Reset run time when no key is pressed
            this.movingStartTime = null; // Clear moving start time
        }

        let accelerationIncrease = this.baseAcceleration * (1 + this.runTime / 50); // Gradually increase acceleration with run time

        if (this.movingStartTime !== null) {
            accelerationIncrease += this.initialBoostFactor; // Apply initial speed boost
        }

        const acceleration = accelerationFactor * accelerationIncrease;

        if (this.direction === 1) {
            this.speed += acceleration;
            if (this.speed > this.maxSpeed) this.speed = this.maxSpeed;
        } else if (this.direction === -1) {
            this.speed -= acceleration;
            if (this.speed < -this.maxSpeed) this.speed = -this.maxSpeed;
        }
    }
}

export { Player };