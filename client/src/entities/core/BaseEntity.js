import { gravity, allEntities } from '../../configuration/constants.js';
import CollisionCore from '../../systems/CollisionCore.js';
import uiManager from '../../systems/UIManager.js';

// Shared transformation matrices to avoid creating new ones each frame
const modelMatrix = mat4.create();
const transformMatrix = mat4.create();
const tempVec3 = vec3.create();

class BaseEntity extends CollisionCore {
    constructor(x, y, width, height, color, canvas, type, layer) {
        super();
        this.id = allEntities.length + 1;
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.color = new Float32Array(color); // Pre-allocate color array
        this.canvas = canvas;
        this.gl = null;
        this.velocity = { x: 0, y: 0 };
        this.friction = 0.75;
        this.airFriction = 0.85;
        this.gravity = gravity;
        this.grounded = true;
        this.hasGravity = true;
        this.hasCollision = true
        // Set a default stepHeight (in pixels) for stepping up small ledges.
        this.stepHeight = this.height / 3;
        this.lastYMovement = 0;
        this.type = type
        // Cache half dimensions for render calculations
        this.halfWidth = width / 2;
        this.halfHeight = height / 2;

        // Add mass property based on area (this can be customized as needed)
        this.mass = width * height;

        // Sleeping state flag for optimization.
        // When true, the update function returns immediately unless a moving neighbor wakes it.
        this.sleeping = true;
        this.scale = 1.0; 

        // Initialize attachment properties
        this.attachedTo = null;
        this.attachmentOffset = { x: 0, y: 0 };
        this.renderLayer = layer ?? 1; // Default layer
        this.defaultLayer = 1; // Store the default layer for this entity
        this.rotation = 0;
        this.isActive = false;
        
        // Health and damage properties
        this.maxHealth = 100;
        this.health = this.maxHealth;
        this.isDead = false;
        this.invulnerable = false;
        this.invulnerabilityTime = 0;
        this.invulnerabilityDuration = 1; // 1 second of invulnerability after taking damage
        this.respawnTime = 0;
        this.respawnDuration = 3; // 3 seconds to respawn
        this.lastDamagedBy = null; // Track who last damaged this entity
        
        this.updateDimensions();
    }

    init(gl) {
        this.gl = gl;
    }

    setRenderLayer(layer) {
        this.renderLayer = layer;
    }

    resetRenderLayer() {
        this.renderLayer = this.defaultLayer;
    }
    
    resolveOverlap(spatialGrid) {
        const nearbyObjects = spatialGrid.query(this);
        for (const obj of nearbyObjects) {
            if (obj === this || (obj.type === 'background')) continue;
            if (CollisionCore.staticCheckCollision(this, obj)) {
                // Compute overlap distances on each axis.
                const overlapLeft = (this.x + this.width) - obj.x;
                const overlapRight = (obj.x + obj.width) - this.x;
                const overlapTop = (this.y + this.height) - obj.y;
                const overlapBottom = (obj.y + obj.height) - this.y;

                // Choose the smallest penetration axis.
                const minOverlapX = Math.abs(overlapLeft) < Math.abs(overlapRight) ? overlapLeft : -overlapRight;
                const minOverlapY = Math.abs(overlapTop) < Math.abs(overlapBottom) ? overlapTop : -overlapBottom;

                if (Math.abs(minOverlapX) < Math.abs(minOverlapY)) {
                    this.x -= minOverlapX;
                } else {
                    this.y -= minOverlapY;
                    if (minOverlapY < 0) {
                        this.grounded = true;
                    }
                }
            }
        }
    }

    onCollision(hitEntity, allEntities) {
        // Handle damage from bullets
        if (hitEntity.type === 'bullet' && !this.invulnerable && !this.isDead) {
            this.takeDamage(hitEntity.damage, hitEntity);
        }
    }

    update(interval, allEntities, spatialGrid) {
        // Handle death and respawn
        if (this.isDead) {
            if (this.respawnTime > 0) {
                this.respawnTime -= interval;
                if (this.respawnTime <= 0) {
                    this.respawn();
                }
            }
            return;
        }
        
        // Handle invulnerability
        if (this.invulnerable) {
            this.invulnerabilityTime -= interval;
            if (this.invulnerabilityTime <= 0) {
                this.invulnerable = false;
            }
        }
        
        if (this.attachedTo) {
            // Update position based on attached entity
            this.x = this.attachedTo.x + this.attachmentOffset.x;
            this.y = this.attachedTo.y + this.attachmentOffset.y;
            return;
        }

        if (!this.name && this.isActive) {
            if (Math.abs(this.velocity.x) < 1 && Math.abs(this.velocity.y) < 1) {
                this.lastYMovement += interval;
            } else if (Math.abs(this.velocity.x) > 1 && Math.abs(this.velocity.y) > 1)  {
                // this.sleeping = true
                // // //!Warning ACTIVATING NEARBY OBJECTS, PERFORMANT HEAVY
                const radius = this.width;
                const queryBox = {
                    x: this.x - radius,
                    y: this.y - radius,
                    width: this.width + radius * 2,
                    height: this.height + radius * 2
                };
                
                const nearbyObjects = spatialGrid.query(queryBox);
                for (const nearbyObject of nearbyObjects) {
                    // Calculate actual distance between object centers
                    const centerX = this.x + this.width / 2;
                    const centerY = this.y + this.height / 2;
                    const objCenterX = nearbyObject.x + nearbyObject.width / 2;
                    const objCenterY = nearbyObject.y + nearbyObject.height / 2;
                    
                    const distanceX = centerX - objCenterX;
                    const distanceY = centerY - objCenterY;
                    const distance = Math.sqrt(distanceX * distanceX + distanceY * distanceY);
                    
                    // Wake up objects within the radius
                    if (distance <= radius) {
                        nearbyObject.hasGravity = true
                        nearbyObject.sleeping = false;
                        nearbyObject.isActive = true;
                    }
                }

            }
            if (this.lastYMovement > 3 && Math.abs(this.velocity.y) < 1.1 && Math.abs(this.velocity.x) < 1.1) {
                this.sleeping = true;
                this.grounded = true;
                this.hasGravity = false;
                this.isActive = false;
                this.lastYMovement = 0;
                return;
            }              
        } else if (this.lastYMovement > 3) {
            this.sleeping = true;
            this.grounded = true;
            this.hasGravity = false;
            this.isActive = false;
        }
        
        // Apply gravity.
        if (this.hasGravity) this.applyGravity(interval);
        
        // Only update entities affected by gravity.
        if (!this.hasCollision || (this.sleeping && !this.name)) {
            this.y += this.velocity.y * interval
            this.x += this.velocity.x * interval
            return
        }

        // Handle movement and collisions.
        this.handleVelocityOptimized(interval, spatialGrid, allEntities);
        // Apply friction.
        this.applyFriction();
    }

    applyGravity(interval) {
        this.velocity.y += this.gravity * interval;
    }

    testStepHeight(collidedObject, spatialGrid) {
        if (this.name) {
            // Try to step up before canceling horizontal movement
            const candidateStep = (this.y + this.height) - collidedObject.y;
            if (candidateStep > 0 && candidateStep <= this.stepHeight) {
                // Temporarily move up by step height
                this.y -= candidateStep;
                
                // Check if this new position is valid
                const stepCheckObjects = spatialGrid.query(this);
                let stepCollision = false;
                
                for (const obj of stepCheckObjects) {
                    if (obj !== this && obj !== collidedObject && obj.hasCollision && !obj.damage && 
                        CollisionCore.staticCheckCollision(this, obj)) {
                        stepCollision = true;
                        break;
                    }
                }
                
                if (!stepCollision) {
                    // If no collision in stepped up position, allow the horizontal movement
                    this.grounded = true;
                    // collidedX = false;
                    return true
                } else {
                    // If step up failed, restore original y position
                    this.y += candidateStep;
                }
            }
        }
    }

    handleVelocityOptimized(interval, spatialGrid, allEntities) {
        let dx = this.velocity.x * interval;
        let dy = this.velocity.y * interval;
    
        // Attempt horizontal movement first
        this.x += dx;
        let collidedX = false;
        let collidedObject = null;
        const objectsX = spatialGrid.query(this);
        
        for (const obj of objectsX) {
            if (obj !== this && obj.hasCollision && obj.type !== 'bullet'  && CollisionCore.staticCheckCollision(this, obj)) {
                if ((this.type === 'gun' && obj.isLocalPlayer) || (this.isLocalPlayer && obj.type === 'gun')) continue

                collidedX = true;
                collidedObject = obj;
                this.onCollision(obj, allEntities);
    
                // Simple pushing logic
                if (obj.mass && this.mass && (!obj.sleeping || obj.isFragment)) {
                    const pushFactor = Math.min(Math.abs(this.velocity.x) * (this.mass / obj.mass), 1000); // Cap maximum push speed
                    obj.sleeping = false
                    obj.hasGravity = true
                    obj.isActive = true
                    // obj.hasCollision = true
                    // obj.lastYMovement = 0 
                    if (this.velocity.x > 0) {
                        obj.velocity.x = pushFactor;
                    } else if (this.velocity.x < 0) {
                        obj.velocity.x = -pushFactor;
                    }
                }
                
                if (this.isLocalPlayer && this.testStepHeight(obj, spatialGrid)) {
                    collidedX = false;
                }
                break;
            }
        }
    
        if (collidedX) {
            this.x -= dx;
            this.velocity.x = 0;
        }
    
        // Attempt vertical movement
        this.y += dy;
        let collidedY = false;
        const objectsY = spatialGrid.query(this);
        
        for (const obj of objectsY) {
            if (obj !== this && obj.hasCollision && obj.type !== 'bullet' && CollisionCore.staticCheckCollision(this, obj)) {
                if ((this.type === 'gun' && obj.isLocalPlayer) || (this.isLocalPlayer && obj.type === 'gun')) continue
                collidedY = true;
                this.onCollision(obj, allEntities);
                
                // Simple vertical pushing logic
                if (obj.mass && this.mass && (!obj.sleeping || obj.isFragment)) {
                    // console.log('PUSH', obj.mass, this.mass, obj, this)
                    const pushFactor = Math.min(Math.abs(this.velocity.y) * (this.mass / obj.mass), 1000);
                    obj.sleeping = false
                    obj.hasGravity = true
                    obj.isActive = true
                    if (this.velocity.y > 0) {
                        obj.velocity.y += pushFactor;
                    } else if (this.velocity.y < 0) {
                        obj.velocity.y -= pushFactor;
                    }
                }
                break;
            }
        }
    
        if (collidedY) {
            this.y -= dy;
            this.velocity.y = 0;
            if (dy > 0) {
                this.grounded = true;
            } else {
                this.grounded = false;
            }
        }
    }

    applyFriction() {
        if (this.grounded) {
            this.velocity.x *= this.friction;
        } else {
            this.velocity.x *= this.airFriction;
        }
        // If the velocity is very small, set it to 0.
        if (Math.abs(this.velocity.x) < 0.01) {
            this.velocity.x = 0;
        }
    }

    setScale(scale) {
        this.scale = scale;
        this.updateDimensions();
    }



    updateDimensions() {
        // Update hitbox dimensions
        this.halfWidth = this.width / 2;
        this.halfHeight = this.height / 2;
        
        // Update visual dimensions
        this.visualWidth = this.width * this.scale;
        this.visualHeight = this.height * this.scale;
        
        // Update mass based on physical dimensions
        this.mass = this.width * this.height;
    }
    
    takeDamage(amount, source) {
        if (this.invulnerable || this.isDead) return;
        
        this.health -= amount;
        this.lastDamagedBy = source;
        
        // Set invulnerability
        this.invulnerable = true;
        this.invulnerabilityTime = this.invulnerabilityDuration;
        
        // Check for death
        if (this.health <= 0) {
            this.die();
        }
    }
    
    die() {
        this.isDead = true;
        this.health = 0;
        this.hasCollision = false;
        
        // If this entity is a player and has a killer, record the kill
        if (this.name && this.name.includes('Player') && this.lastDamagedBy && this.lastDamagedBy.attachedTo) {
            const killer = this.lastDamagedBy.attachedTo;
            if (killer && killer.name && killer.name.includes('Player')) {
                // If there's a game mode active, record the kill
                if (window.gameMode && window.gameMode.isActive) {
                    window.gameMode.recordKill(killer.id, this.id);
                }
            }
        }
        
        // Start respawn timer if this is a player
        if (this.name && this.name.includes('Player')) {
            this.respawnTime = this.respawnDuration;
        }
    }
    
    respawn() {
        // Reset health and state
        this.health = this.maxHealth;
        this.isDead = false;
        this.hasCollision = true;
        this.invulnerable = true;
        this.invulnerabilityTime = 2; // 2 seconds of spawn protection
        
        // If this is a player, move to a spawn point
        if (this.name && this.name.includes('Player')) {
            // Find a spawn point
            fetch('assets/levels/level.json')
                .then(response => response.json())
                .then(levelData => {
                    if (levelData.playerSpawns && levelData.playerSpawns.length > 0) {
                        const randomSpawn = levelData.playerSpawns[Math.floor(Math.random() * levelData.playerSpawns.length)];
                        this.x = randomSpawn.x;
                        this.y = randomSpawn.y;
                        this.velocity.x = 0;
                        this.velocity.y = 0;
                    }
                })
                .catch(error => console.error('Error loading level for respawn:', error));
        }
    }
    
    heal(amount) {
        if (this.isDead) return;
        
        this.health = Math.min(this.health + amount, this.maxHealth);
    }

}

export { BaseEntity };
