import { BaseEntity } from "./BaseEntity.js";
import Fragment from "./Fragment.js";
import { keys } from "../constants.js";

class Player extends BaseEntity {
    constructor(canvas, gl, { x = 600, y = 400, isLocalPlayer = true } = {}) {
        const width = 50;
        const height = 50;
        super(x, y, width, height, [0.0, 0.0, 1.0, 1.0], canvas);
        
        this.id = Math.floor(Math.random() * (2 ** 31));
        this.name = "Player" + this.id;
        this.jumpForce = 85525;
        this.maxSpeed = 22225;
        this.friction = 0.82;
        this.airFriction = 0.85;
        this.baseAcceleration = 20.0;
        this.maxAcceleration = 1550;
        this.direction = 0;
        this.grounded = false;
        this.runTime = 0;
        this.movingStartTime = null;
        this.initialBoostFactor = 60;
        this.jumpMomentum = 0;
        this.hasGravity = true;
        this.isLocalPlayer = isLocalPlayer
        this.init(gl);
    }

    update(deltaTime, allEntities, spatialGrid) {
        if (this.isLocalPlayer) this.handleMovement(deltaTime, allEntities);
        super.update(deltaTime, allEntities, spatialGrid);
    }

    handleMovement(interval, entities) {
        const accelerationFactor = this.grounded ? 1 : 0.9;

        if (keys['ArrowUp'] && this.grounded) {
            this.velocity.y = -(this.jumpForce * interval);
            this.grounded = false;
        }

        if (keys['Space']) {
            const playerX = this.x + this.width / 2;
            const playerY = this.y + this.height / 2;
            const radius = 180;
            // Iterate backwards so removals don't affect the loop index.
            for (let i = entities.length - 1; i >= 0; i--) {
                const entity = entities[i];
                if (entity === this || entity?.enableLife) continue;
                // Check that the entity has x, y, width, and height defined.
                if (typeof entity.x !== "number" || typeof entity.y !== "number") continue;
                const entityX = entity.x + entity.width / 2;
                const entityY = entity.y + entity.height / 2;
                const distance = Math.sqrt((playerX - entityX) ** 2 + (playerY - entityY) ** 2);
                // if (distance < radius) {
                //     // Remove the entity and split it into fragments.
                //     entities.splice(i, 1);
                //     const fragments = this.splitEntity(entity);
                //     entities.push(...fragments);
                //     break
                // } else if (distance < (radius + 40)) {
                //     entity.hasGravity = true;
                // }
                if (distance < radius) {
                    entity.velocity.x += (Math.random() - 0.9) * 1112;
                    entity.velocity.y += (Math.random() - 0.9) * 1112;
                    entity.hasGravity = true;
                    // entity.enableLife = true
                }
            }
        }

        const now = performance.now();

        if (keys['ArrowRight']) {
            if (this.direction !== 1) {
                this.runTime = 0;
            }
            this.movingStartTime = now;
            this.direction = 1;
            this.runTime += interval;
        } else if (keys['ArrowLeft']) {
            if (this.direction !== -1) {
                this.runTime = 0;
            }
            this.movingStartTime = now;
            this.direction = -1;
            this.runTime += interval;
        } else {
            this.runTime = 0;
            this.movingStartTime = null;
        }

        let accelerationIncrease = this.baseAcceleration * this.runTime;
        if (this.movingStartTime !== null) {
            accelerationIncrease += this.initialBoostFactor;
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

    splitEntity(entity) {
        const fragments = [];
        // Split the entity into 4 pieces (2x2 grid).
        const newWidth = entity.width / 2;
        const newHeight = entity.height / 2;
        for (let row = 0; row < 2; row++) {
            for (let col = 0; col < 2; col++) {
                const fragmentX = entity.x + col * newWidth;
                const fragmentY = entity.y + row * newHeight;
                const fragment = new Fragment(entity.canvas, entity.gl, {
                    x: fragmentX,
                    y: fragmentY,
                    width: newWidth,
                    height: newHeight,
                    color: Array.from(entity.color)
                });
                // Apply random velocity to scatter the fragments.
                fragment.velocity.x = (Math.random() - 0.9) * 3200;
                fragment.velocity.y = (Math.random() - 0.9) * 3100;
                fragment.hasGravity = true;
                fragments.push(fragment);
            }
        }
        return fragments;
    }
}

export default Player;
