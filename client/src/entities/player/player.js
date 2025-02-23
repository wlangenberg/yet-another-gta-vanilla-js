#!/usr/bin/env node
import { BaseEntity } from "../core/BaseEntity.js";
import Fragment from "../fragments/Fragment.js";
import Gun from "./Gun.js"; // Import the new Gun class
import { keys, ctx as gl, allEntities, canvas, STATE, LAYERS } from "../../configuration/constants.js";
import { Animation, AnimationController } from "../../systems/Animation.js";

class Player extends BaseEntity {
    constructor(canvas, gl, { x = 600, y = 400, isLocalPlayer = true } = {}) {
        const width = 20;
        const height = 64;

        super(x, y, width, height, [1.0, 1.0, 1.0, 1.0], canvas);
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
        this.animationController = new AnimationController();
        this.showHitbox = true
        this.animationsPromise = this.loadAnimations(gl)
        this.equippedWeapon = null;
        this.renderLayer = 1;
        this.mousePosition = { x: 0, y: 0 };
        this.worldMousePosition = { x: 0, y: 0 };
        this.shooting = false
        this.sleeping = false
        this.hasCollision = true
        this.faceDirection = 1;
        this.rightMouseDownTime = null;
        this.rightMousePressDuration = 0;
        if (this.isLocalPlayer) {
            this.setupMouseTracking();
            this.setupShooting();
            this.setupCursorChange();
        }
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
            const rect = this.canvas.getBoundingClientRect();
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
        // Load idle animation
        const idleFrames = Array.from({ length: 4 }, (_, i) => `assets/images/man/idle2/_${i}.png`);
        const idleAnimation = new Animation(gl, idleFrames, 0.2); // 0.2 seconds per frame
        await idleAnimation.loadFrames(idleFrames)
        
        // Load run animation
        const runFrames = Array.from({ length: 6 }, (_, i) => `assets/images/man/run2/_${i}.png`);
        const runAnimation = new Animation(gl, runFrames, 0.1); // 0.1 seconds per frame
        await runAnimation.loadFrames(runFrames)
        
        const { height, width } = idleAnimation.frames?.[0] ?? {}
        
        this.height = 70
        this.width = 50
        this.setScale(8)
        // Add animations to controller
        this.animationController.addAnimation('idle', idleAnimation);
        this.animationController.addAnimation('run', runAnimation);
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
        if (this.isLocalPlayer) {
            this.handleMovement(deltaTime, allEntities);
            this.updateWorldMousePosition(); // Update world mouse position every frame
            this.updateGunRotation();
            if (this.shooting) {
                this.shoot();
            }
        }
        this.animationController.update(deltaTime);
        super.update(deltaTime, allEntities, spatialGrid);
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
            this.equippedWeapon.rotation = finalAngle;
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
