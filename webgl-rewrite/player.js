import {BaseEntity} from "./BaseEntity.js"
import { keys } from "../constants.js"
class Player extends BaseEntity {
	constructor(canvas, gl, { x = 600, y = 400}) {
		// Define player width and height
		const width = 50
		const height = 50
		// Set the initial position (e.g., bottom center-ish of the canvas)
		// Player color: blue
		super(x, y, width, height, [0.0, 0.0, 1.0, 1.0], canvas)
		
        this.id = Math.floor(Math.random() * (2 ** 31));
        this.name = "Player" + this.id;
        this.jumpForce = 85525;
        this.maxSpeed = 22225;
        this.friction = 0.82;
        this.airFriction = 0.85;
        this.baseAcceleration = 20.0; // Base acceleration rate
        this.maxAcceleration = 1550;
        this.direction = 0;
        this.grounded = false;
        this.runTime = 0; // Track the time running in one direction
        this.movingStartTime = null; // Track when movement starts
        this.initialBoostFactor = 60; // Factor by which to multiply acceleration during initial boost
        this.jumpMomentum = 0; // Horizontal momentum during jumps
        this.hasGravity = true
		this.init(gl)
	}

	update(deltaTime, allEntities, spatialGrid) {
        this.handleMovement(deltaTime, allEntities);
        super.update(deltaTime, allEntities, spatialGrid)
	}

    handleMovement(interval, platforms) {
        const accelerationFactor = this.grounded ? 1 : 0.9; // Reduce acceleration in the air

        if (keys['ArrowUp'] && this.grounded) {
            console.log('this.jumpForce', this.jumpForce * interval, interval)
            this.velocity.y = -(this.jumpForce * interval);
            this.grounded = false;
        }

        if (keys['Space']) {
            const playerX = this.x + this.width / 2;
            const playerY = this.y + this.height / 2;
            const radius = 80;
            for (const platform of platforms) {
                if (platform === this) continue;
                const platformX = platform.x + platform.width / 2;
                const platformY = platform.y + platform.height / 2;
                const distance = Math.sqrt(
                    (playerX - platformX) ** 2 +
                    (playerY - platformY) ** 2
                )
                if (distance < radius) {
                    platform.y = 1555555;
                }
                if (distance < (radius + 40)) {
                    platform.hasGravity = true;
                }

            }
        }

        const now = performance.now();

        if (keys['ArrowRight']) {
            if (this.direction !== 1) {
                this.runTime = 0; // Reset run time on direction change
            }
            // console.log('WALK')
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

        let accelerationIncrease = this.baseAcceleration * this.runTime; // Gradually increase acceleration with run time

        if (this.movingStartTime !== null) {
            accelerationIncrease += this.initialBoostFactor; // Apply initial speed boost
        }

        const acceleration = Math.min(this.maxAcceleration, accelerationFactor * accelerationIncrease);
        if (this.direction === 1) {
            this.velocity.x += acceleration;
            if (this.velocity.x > this.maxSpeed) this.velocity.x = this.maxSpeed;
        } else if (this.direction === -1) {
            this.velocity.x -= acceleration;
            if (this.velocity.x < -this.maxSpeed) this.velocity.x = -this.maxSpeed;
        }
    }
}


export default Player
