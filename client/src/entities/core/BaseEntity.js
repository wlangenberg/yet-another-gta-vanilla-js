import { gravity, allEntities } from '../../configuration/constants.js';
import CollisionCore from '../../systems/CollisionCore.js';
import uiManager from '../../systems/UIManager.js';
import { canvas, ctx as gl } from '../../configuration/canvas.js';
// Shared transformation matrices to avoid creating new ones each frame
const modelMatrix = mat4.create();
const transformMatrix = mat4.create();
const tempVec3 = vec3.create();

class BaseEntity extends CollisionCore {
    constructor(options = {}) {
        super();
        // Extract options with defaults
        const {
            id = Date.now() + Math.floor(Math.random() * 1000000),
            x = 0,
            y = 0,
            width = 50,
            height = 50,
            color = [1.0, 1.0, 1.0, 1.0],
            type = 'entity',
            layer = 1,
            velocity = { x: 0, y: 0 },
            rotation = 0,
            direction = 0,
            faceDirection = 1,
            health = 100,
            maxHealth = 100,
            isDead = false
        } = options;
        
        // Basic properties
        this.id = id;
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.color = new Float32Array(color); // Pre-allocate color array
        
        // Physics properties
        this.velocity = { ...velocity }; // Clone to avoid reference issues
        this.friction = 0.75;
        this.airFriction = 0.85;
        this.gravity = gravity;
        this.grounded = true;
        this.hasGravity = true;
        this.hasCollision = true;
        
        // Movement properties
        this.stepHeight = this.height / 3;
        this.lastYMovement = 0;
        this.direction = direction;
        this.faceDirection = faceDirection;
        
        // Entity type and rendering
        this.type = type;
        this.halfWidth = width / 2;
        this.halfHeight = height / 2;
        this.mass = width * height;
        this.sleeping = true;
        this.scale = 1.0;
        
        // Attachment properties
        this.attachedTo = null;
        this.attachmentOffset = { x: 0, y: 0 };
        this.renderLayer = layer;
        this.defaultLayer = layer;
        this.rotation = rotation;
        this.isActive = false;
        
        // Health and damage properties
        this.maxHealth = maxHealth;
        this.health = health;
        this.isDead = isDead;
        this.invulnerable = false;
        this.invulnerabilityTime = 0;
        this.invulnerabilityDuration = 1;
        this.respawnTime = 0;
        this.respawnDuration = 3;
        this.lastDamagedBy = null;
        
        this.updateDimensions();
    }

    init(gl) {
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

    // Interpolation properties
    isInterpolating = false;
    prevX = 0;
    prevY = 0;
    targetX = 0;
    targetY = 0;
    interpolationStartTime = 0;
    interpolationDuration = 100; // ms
    
    // Track last sent state to avoid redundant updates
    lastSentState = {
        x: 0,
        y: 0,
        rotation: 0,
        direction: 0,
        faceDirection: 1,
        velocityX: 0,
        velocityY: 0,
        timestamp: 0
    };
    
    // Threshold for position updates
    updateThreshold = 0.1;
    
    // Minimum time between updates (ms)
    updateInterval = 50;
    
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
        
        // Handle interpolation for remote players
        if (this.isInterpolating && !this.isLocalPlayer) {
            const now = performance.now();
            const elapsed = now - this.interpolationStartTime;
            const progress = Math.min(elapsed / this.interpolationDuration, 1);
            
            // Smooth interpolation using ease-out function
            const t = 1 - Math.pow(1 - progress, 2);
            
            // Update position with interpolation
            this.x = this.prevX + (this.targetX - this.prevX) * t;
            this.y = this.prevY + (this.targetY - this.prevY) * t;
            
            // If interpolation is complete, reset flag
            if (progress >= 1) {
                this.isInterpolating = false;
            }
            
            // Skip the rest of the update for remote players being interpolated
            return;
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
        
        // Send multiplayer updates if this is a networked entity and not sleeping
        this.sendNetworkUpdate();
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
                if ((this.type === 'gun' && obj.isLocalPlayer) || (this.isLocalPlayer && obj.type === 'gun') || (this.ownerId === obj.id)) continue

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
                if ((this.type === 'gun' && obj.isLocalPlayer) || (this.isLocalPlayer && obj.type === 'gun')  || (this.ownerId === obj.id)) continue
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
    
    /**
     * Send network updates for this entity if it's networked and has changed significantly
     */
    sendNetworkUpdate() {
        // Skip if the entity is sleeping and not a player or gun
        if (this.sleeping && !this.isLocalPlayer && this.type !== 'gun') {
            return;
        }
        
        const now = performance.now();
        const timeSinceLastUpdate = now - this.lastSentState.timestamp;
        
        // Skip update if not enough time has passed since last update
        if (timeSinceLastUpdate < this.updateInterval) {
            return;
        }
        
        // Check if the entity has moved enough to warrant an update
        const hasMovedEnough =
            Math.abs(this.lastSentState.x - this.x) > this.updateThreshold ||
            Math.abs(this.lastSentState.y - this.y) > this.updateThreshold;
            
        // For guns, also check rotation changes
        const hasRotationChanged =
            this.rotation !== undefined &&
            Math.abs(this.lastSentState.rotation - this.rotation) > 0.1;
        // if (!hasMovedEnough && !hasRotationChanged) {
        //     return; // Skip update if entity hasn't changed significantly
        // }         
        // Check if direction or face direction has changed
        const hasDirectionChanged =
            this.direction !== undefined &&
            this.lastSentState.direction !== this.direction;
            
        const hasFaceDirectionChanged =
            this.faceDirection !== undefined &&
            this.lastSentState.faceDirection !== this.faceDirection;
            
        // Check if velocity has changed significantly
        const hasVelocityChanged =
            Math.abs(this.lastSentState.velocityX - this.velocity.x) > 0.5 ||
            Math.abs(this.lastSentState.velocityY - this.velocity.y) > 0.5;
            
        // Skip update if entity hasn't changed significantly
        if (!hasMovedEnough && !hasRotationChanged && !hasDirectionChanged &&
            !hasFaceDirectionChanged && !hasVelocityChanged) {
            return;
        }
        
        // Update last sent state
        this.lastSentState = {
            x: this.x,
            y: this.y,
            rotation: this.rotation || 0,
            direction: this.direction || 0,
            faceDirection: this.faceDirection || 1,
            velocityX: this.velocity.x,
            velocityY: this.velocity.y,
            timestamp: now
        };
        
        // Import socket dynamically to avoid circular dependencies
        import('../../systems/sockets.js').then(module => {
            const socket = module.default;
            
            // If this is a gun, send gun attachment update
            if (this.type === 'gun' && this.attachedTo) {
                socket.sendGunAttachment(
                    this.id,
                    this.attachedTo.id,
                    this.attachmentOffset.x,
                    this.attachmentOffset.y,
                    this.rotation || 0
                );
            }
            // If this is the local player, send player update
            else if (this.isLocalPlayer) {
                // For player entities, ensure we're using the server-assigned ID if available
                if (this.serverIdAssigned) {
                    // Make a copy of this object with the correct ID
                    const entityData = { ...this };
                    socket.updatePlayerState(entityData);
                } else {
                    socket.updatePlayerState(this);
                }
            }
        });
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
