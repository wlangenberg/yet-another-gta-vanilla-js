import { BaseEntity } from "./BaseEntity.js";

class Snow extends BaseEntity {
    constructor(x, y, size, canvas) {
        // White color with slight transparency
        super(x, y, size, size, [1.0, 1.0, 1.0, 0.8], canvas);
        
        this.hasGravity = true;
        this.gravity = 150; // Lighter gravity for snow
        this.velocity.x = (Math.random() - 0.5) * 50; // Random horizontal movement
        this.velocity.y = 30 + Math.random() * 20; // Initial falling speed
        this.active = true;
        this.friction = 0.98; // Air resistance
        this.bounce = 0.1; // Small bounce effect
    }

    update(interval, allEntities, spatialGrid) {
        if (!this.active) return;

        // Add some wind effect
        this.velocity.x += (Math.random() - 0.5) * 2;
        
        // Apply air resistance
        this.velocity.x *= this.friction;
        
        super.update(interval, allEntities, spatialGrid);

        // Deactivate if stopped
        if (this.grounded && Math.abs(this.velocity.y) < 0.1) {
            this.active = false;
        }
    }

    handleCollision(other) {
        if (!this.active) return;
        
        const collision = this.checkCollision(other);
        if (collision) {
            // Resolve collision
            this.y = collision.y;
            this.velocity.y = -this.velocity.y * this.bounce;
            this.grounded = true;
            
            // Slow down horizontal movement on collision
            this.velocity.x *= 0.8;
        }
    }
}

export default Snow;