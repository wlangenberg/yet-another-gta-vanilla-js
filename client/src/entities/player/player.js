#!/usr/bin/env node
import { BaseEntity } from "../core/BaseEntity.js";
import Fragment from "../fragments/Fragment.js";
import Gun from "./Gun.js"; // Import the new Gun class
import { keys, allEntities, STATE, LAYERS } from "../../configuration/constants.js";
import uiManager from "../../systems/UIManager.js";
import { Animation, AnimationController } from "../../systems/Animation.js";
import { canvas, ctx as gl } from "../../configuration/canvas.js";

class Player extends BaseEntity {
    constructor(options = {}) {
        // Extract options with defaults
        const {
            x = 600,
            y = 400,
            isLocalPlayer = true,
            id = Date.now() + Math.floor(Math.random() * 1000000),
            width = 20,
            height = 64,
            direction = 0,
            faceDirection = 1,
            health = 100,
            maxHealth = 100,
            isDead = false
        } = options;

        // Call parent constructor with options
        super({
            id,
            x,
            y,
            width,
            height,
            color: [1.0, 1.0, 1.0, 1.0],
            type: 'player',
            layer: 1,
            direction,
            faceDirection,
            health,
            maxHealth,
            isDead
        });
        this.name = "Player" + (this.id ? this.id.toString().substring(0, 6) : "");
        this.jumpForce = 85525;
        this.maxSpeed = 22225;
        this.friction = 0.82;
        this.airFriction = 0.85;
        this.baseAcceleration = 20.0;
        this.maxAcceleration = 1550;
        this.grounded = false;
        this.runTime = 0;
        this.movingStartTime = null;
        this.initialBoostFactor = 60;
        this.jumpMomentum = 0;
        this.hasGravity = true;
        this.isLocalPlayer = isLocalPlayer;
        this.animationController = new AnimationController();
        this.showHitbox = true;
        this.animationsPromise = this.loadAnimations(gl);
        this.equippedWeapon = null;
        this.mousePosition = { x: 0, y: 0 };
        this.worldMousePosition = { x: 0, y: 0 };
        this.shooting = false;
        this.sleeping = false;
        this.hasCollision = true;
        this.rightMouseDownTime = null;
        this.rightMousePressDuration = 0;
        
        // Flag to track if the server has assigned an ID
        this.serverIdAssigned = !isLocalPlayer;
        
        // Override default health values for player
        this.maxHealth = maxHealth;
        this.health = health;
        this.respawnDuration = 3; // 3 seconds to respawn
        
        if (this.isLocalPlayer) {
            this.setupMouseTracking();
            this.setupShooting();
            this.setupCursorChange();
        }
    }

    // Generate a unique ID using timestamp and random number
    generateUniqueId() {
        // Combine timestamp with a random string to ensure uniqueness
        const timestamp = Date.now();
        const random = Math.floor(Math.random() * 1000000);
        // Use a numeric ID for better compatibility with server
        return parseInt(`${timestamp}${random}`.substring(0, 9));
    }

    setupCursorChange() {
        window.addEventListener('mousemove', () => {
            if (this.equippedWeapon) {
                canvas.style.cursor = 'crosshair'; // Change cursor to aim when a weapon is equipped
            } else {
                canvas.style.cursor = 'default'; // Reset cursor to default when no weapon is equipped
            }
        });
    }

    setupMouseTracking() {
        window.addEventListener('mousemove', (e) => {
            const rect = canvas.getBoundingClientRect();
            this.mousePosition = {
                x: e.clientX - rect.left,
                y: e.clientY - rect.top
            };
            this.updateWorldMousePosition();
            
            // Get player's center position in screen coordinates
            const camera = window.camera;
            const playerScreenX = this.x + this.width/2 - camera.x;
            
            // Update direction based on mouse position relative to player
            if (this.mousePosition.x > playerScreenX) {
                this.faceDirection = 1;
                this.animationController.setFlipped(false);
            } else {
                this.faceDirection = -1;
                this.animationController.setFlipped(true);
            }
        });
    }
    

    updateWorldMousePosition() {
        // Get the camera position from the game's camera
        const camera = window.camera;
        
        // Convert screen coordinates to world coordinates
        this.worldMousePosition = {
            x: this.mousePosition.x + camera.x,
            y: this.mousePosition.y + camera.y
        };
    }

    async loadAnimations(gl) {
        try {
            // Load idle animation
            const idleFrames = Array.from({ length: 4 }, (_, i) => `assets/images/man/idle2/_${i}.png`);
            const idleAnimation = new Animation(gl, idleFrames, 0.2); // 0.2 seconds per frame
            await idleAnimation.loadFrames(idleFrames);
            
            // Load run animation
            const runFrames = Array.from({ length: 6 }, (_, i) => `assets/images/man/run2/_${i}.png`);
            const runAnimation = new Animation(gl, runFrames, 0.1); // 0.1 seconds per frame
            await runAnimation.loadFrames(runFrames);
            
            const { height, width } = idleAnimation.frames?.[0] ?? {};
            
            this.height = 70;
            this.width = 50;
            this.setScale(8);
            
            // Add animations to controller
            this.animationController.addAnimation('idle', idleAnimation);
            this.animationController.addAnimation('run', runAnimation);
            
            // Set initial animation
            this.animationController.play('idle');
            
            console.log(`Player ${this.id} animations loaded successfully`);
        } catch (error) {
            console.error(`Error loading animations for player ${this.id}:`, error);
        }
    }

    setupShooting() {
        window.addEventListener('mousedown', (e) => {
            if (e.button === 0) { // Left mouse click
                this.shooting = true;
            } else if (e.button === 2) { // Right mouse click
                if (this.equippedWeapon) {
                    // Start tracking the right mouse button press time
                    this.rightMouseDownTime = performance.now();
                }
            }
        });

        window.addEventListener('mouseup', (e) => {
            if (e.button === 0) {
                this.shooting = false;
            } else if (e.button === 2) {
                if (this.equippedWeapon) {
                    this.rightMousePressDuration = performance.now() - this.rightMouseDownTime;
                    this.rightMouseDownTime = null;

                    // Calculate charge strength
                    const maxChargeTime = 1000; // Max 1 second charge
                    const chargeTime = Math.min(this.rightMousePressDuration, maxChargeTime);
                    const strength = (chargeTime / maxChargeTime) * 2500; // Max 2500 velocity

                    // Get throw direction from gun rotation
                    const angle = this.equippedWeapon.rotation;
                    const direction = {
                        x: Math.cos(angle),
                        y: Math.sin(angle)
                    };

                    // Apply velocity with player's current momentum
                    this.equippedWeapon.velocity.x = direction.x * strength + this.velocity.x * 0.5;
                    this.equippedWeapon.velocity.y = direction.y * strength + this.velocity.y * 0.5;

                    // Reset weapon properties
                    // this.equippedWeapon.friction = 0.99;
                    this.equippedWeapon.airFriction = 0.99;
                    this.equippedWeapon.attachedTo = null;
                    this.equippedWeapon.hasGravity = true;
                    this.equippedWeapon.grounded = false
                    this.equippedWeapon.sleeping = false;
                    this.equippedWeapon.type = 'background';

                    this.dropItem(this.equippedWeapon);
                    this.equippedWeapon = null;
                } else {
                    this.handleWeaponPickup(allEntities);
                }
            }
        });

        window.addEventListener('contextmenu', (e) => {
            e.preventDefault();
        });
    }

    update(deltaTime, allEntities, spatialGrid) {
        // If player is dead, only handle respawn logic
        if (this.isDead) {
            super.update(deltaTime, allEntities, spatialGrid);
            return;
        }
        
        if (this.isLocalPlayer) {
            this.handleMovement(deltaTime, allEntities);
            this.updateWorldMousePosition(); // Update world mouse position every frame
            this.updateGunRotation();
            if (this.shooting) {
                this.shoot();
            }
            
            // Set network update properties for local player
            this.updateThreshold = 0.05; // More sensitive threshold for player
            this.updateInterval = 16; // More frequent updates (~60 per second)
        } else {
            // For remote players, apply a simple prediction based on velocity
            // This helps smooth movement between updates
            if (!this.isInterpolating && !this.isDead) {
                // Apply velocity-based prediction for remote players
                this.x += this.velocity.x * deltaTime;
                this.y += this.velocity.y * deltaTime;
                
                // Apply gravity and friction similar to local player
                if (this.hasGravity) {
                    this.velocity.y += this.gravity * deltaTime;
                }
                
                if (this.grounded) {
                    this.velocity.x *= this.friction;
                } else {
                    this.velocity.x *= this.airFriction;
                }
                
                // If velocity is very small, set it to 0
                if (Math.abs(this.velocity.x) < 0.01) {
                    this.velocity.x = 0;
                }
            }
        }
        
        this.animationController.update(deltaTime);
        super.update(deltaTime, allEntities, spatialGrid);
        
        // Update health bar if this is a player
        if (window.camera) {
            uiManager.updateHealthBar(this, window.camera);
        }
    }
    
    die() {
        super.die();
        
        // Drop weapon if player dies
        if (this.equippedWeapon) {
            this.dropItem(this.equippedWeapon);
            this.equippedWeapon = null;
        }
        
        // Show death message if this is the local player
        if (this.isLocalPlayer) {
            let message = "You died!";
            if (this.lastDamagedBy && this.lastDamagedBy.attachedTo) {
                message = `You were killed by ${this.lastDamagedBy.attachedTo.name}!`;
            }
            uiManager.showGameModeMessage(message, 2000);
        }
    }
    
    respawn() {
        super.respawn();
        
        // Show respawn message if this is the local player
        if (this.isLocalPlayer) {
            uiManager.showGameModeMessage("Respawned!", 1000);
        }
    }

    handleMovement(interval, entities) {
        const accelerationFactor = this.grounded ? 1 : 0.9;
        if ((keys['ArrowUp'] || keys['KeyW']) && this.grounded) {
            this.velocity.y = -(this.jumpForce * interval);
            this.grounded = false;
        }

        if (keys['ArrowRight'] || keys['KeyD']) {
            if (this.direction !== 1) {
                this.runTime = 0;
            }
            this.movingStartTime = performance.now();
            this.direction = 1;
            this.runTime += interval;
            this.animationController.play('run');
        } else if (keys['ArrowLeft'] || keys['KeyA']) {
            if (this.direction !== -1) {
                this.runTime = 0;
            }
            this.movingStartTime = performance.now();
            this.direction = -1;
            this.runTime += interval;
            this.animationController.play('run');
        } else {
            this.runTime = 0;
            this.movingStartTime = null;
            this.animationController.play('idle');
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
    updateGunRotation() {
        if (this.equippedWeapon) {
            // Determine attachment parameters and base angle based on player's direction.
            let attachmentOffset, scaleX, scaleY, baseAngle;
            if (this.faceDirection === 1) { // Facing right.
                attachmentOffset = { x: 10, y: this.height / 4 };
                scaleX = 2;
                scaleY = 2;
                baseAngle = 0;
                this.equippedWeapon.animationController.setFlipped(false);
            } else { // Facing left.
                attachmentOffset = { x: -10, y: this.height /4 };
                scaleX = 2;
                scaleY = 2; // Use positive scale; rely on sprite flipping.
                baseAngle = Math.PI;
                this.equippedWeapon.animationController.setFlipped(true);
            }
            
            // Update the gun's attachment parameters.
            this.equippedWeapon.attachmentOffset = attachmentOffset;
            this.equippedWeapon.setScale(scaleX, scaleY);
            
            // Compute the gun's world position using the updated offset.
            const gunX = this.x + attachmentOffset.x;
            const gunY = this.y + attachmentOffset.y + this.height / 4;

            
            // Calculate the raw angle from the gun to the mouse.
            const angle = Math.atan2(this.worldMousePosition.y - gunY, this.worldMousePosition.x - gunX);
            
            // Compute the relative angle between the raw angle and the player's base angle using a robust method.
            let relativeAngle = Math.atan2(Math.sin(angle - baseAngle), Math.cos(angle - baseAngle));
            
            // Clamp the relative angle so that it stays within -90° to +90° (i.e. -π/2 to π/2).
            relativeAngle = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, relativeAngle));
            
            // The final gun angle is the base angle plus the clamped relative angle.
            const finalAngle = baseAngle + relativeAngle;
            
            // Only update if rotation has changed significantly
            if (Math.abs(this.equippedWeapon.rotation - finalAngle) > 0.1) {
                this.equippedWeapon.rotation = finalAngle;
                
                // Network updates will be handled by the gun's sendNetworkUpdate method
                // which is called during its update cycle
            }
        }
    }

    handleWeaponPickup(entities) {
        const playerX = this.x + this.width / 2;
        const playerY = this.y + this.height / 2;
        const radius = 80;

        for (let i = entities.length - 1; i >= 0; i--) {
            const entity = entities[i];
            if (entity instanceof Gun && typeof entity.x === "number" && typeof entity.y === "number") {
                const entityX = entity.x + entity.width / 2;
                const entityY = entity.y + entity.height / 2;
                const distance = Math.sqrt((playerX - entityX) ** 2 + (playerY - entityY) ** 2);
                
                if (distance < radius && this.equippedWeapon !== entity) {
                    this.equippedWeapon = entity;
                    this.pickupItem(entity)
                    entity.hasGravity = false
                    entity.sleeping = true
                    entity.type = 'background'
                    break;
                }
            }
        }
    }

    pickupItem(item) {
        if (this.equippedWeapon) {
            // Detach the current weapon
            this.equippedWeapon.attachedTo = null;
        }
        this.equippedWeapon = item;
        if (item) {
            // Attach the new weapon to the player's hand
            item.attachedTo = this;
            item.attachmentOffset = { x: 30, y: -20 }; // Adjust these values based on your art
            
            // Network updates will be handled by the gun's sendNetworkUpdate method
            // which is called during its update cycle
        }

        if (item instanceof Gun) {
            item.onPickup(this);
        }
    }

    dropItem(item) {
        if (item instanceof Gun) {
            item.onDrop();
        }
    }

    shoot() {
        if (this.equippedWeapon) {
            this.equippedWeapon.shoot(); // Call the shoot method of the equipped weapon
        } else {
            console.log('No weapon equipped');
        }
    }
}
export default Player;
