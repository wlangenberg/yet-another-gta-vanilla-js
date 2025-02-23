import { gravity, allEntities } from '../../configuration/constants.js';
import CollisionCore from '../../systems/CollisionCore.js';

// Shared transformation matrices to avoid creating new ones each frame
const modelMatrix = mat4.create();
const transformMatrix = mat4.create();
const tempVec3 = vec3.create();

class BaseEntity extends CollisionCore {
    // Static initialization for shared resources
    static {
        this.initialized = false;
        this.vertexBuffer = null;
        this.textureCoordBuffer = null;
        this.program = null;
        this.positionLocation = null;
        this.textureCoordLocation = null;
        this.transformMatrixLocation = null;
        this.colorLocation = null;
        this.samplerLocation = null;
        this.useTextureLocation = null;
    }

    // Attachment properties
    attachedTo = null;
    attachmentOffset = { x: 0, y: 0 };
    constructor(x, y, width, height, color, canvas, type) {
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
        this.renderLayer = 0; // Default layer
        this.defaultLayer = 0; // Store the default layer for this entity
        this.rotation = 0;
        this.updateDimensions();
    }

    init(gl) {
        this.gl = gl;
        
        // Only initialize shared resources once
        if (BaseEntity.initialized) return;
        
        this.initSharedResources(gl);
        BaseEntity.initialized = true;
    }

    initSharedResources(gl) {
        // Create and cache shared vertex buffer
        BaseEntity.vertexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, BaseEntity.vertexBuffer);
        gl.bufferData(
            gl.ARRAY_BUFFER,
            new Float32Array([
                -0.5, -0.5,
                 0.5, -0.5,
                 0.5,  0.5,
                -0.5,  0.5
            ]),
            gl.STATIC_DRAW
        );
    
        // Create and cache texture coordinate buffer
        BaseEntity.textureCoordBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, BaseEntity.textureCoordBuffer);
        gl.bufferData(
            gl.ARRAY_BUFFER,
            new Float32Array([
                0.0, 0.0,
                1.0, 0.0,
                1.0, 1.0,
                0.0, 1.0
            ]),
            gl.STATIC_DRAW
        );
    
        // Create and cache shared shader program
        const program = gl.createProgram();
        gl.attachShader(
            program,
            this.createShader(
                gl,
                gl.VERTEX_SHADER,
                `
                attribute vec2 position;
                attribute vec2 aTextureCoord;
                uniform mat4 transformMatrix;
                varying vec2 vTextureCoord;
                
                void main() {
                    gl_Position = transformMatrix * vec4(position, 0.0, 1.0);
                    vTextureCoord = aTextureCoord;
                }
                `
            )
        );
        gl.attachShader(
            program,
            this.createShader(
                gl,
                gl.FRAGMENT_SHADER,
                `
                precision mediump float;
                uniform vec4 uColor;
                uniform sampler2D uSampler;
                uniform bool useTexture;
                varying vec2 vTextureCoord;
                
                void main() {
                    if (useTexture) {
                        vec4 texColor = texture2D(uSampler, vTextureCoord);
                        if (texColor.a < 0.1) discard;
                        gl_FragColor = texColor;
                    } else {
                        gl_FragColor = uColor;
                    }
                }
                `
            )
        );
        gl.linkProgram(program);
    
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            console.error('Shader program initialization failed:', gl.getProgramInfoLog(program));
            return;
        }
    
        BaseEntity.program = program;
        BaseEntity.positionLocation = gl.getAttribLocation(program, 'position');
        BaseEntity.textureCoordLocation = gl.getAttribLocation(program, 'aTextureCoord');
        BaseEntity.transformMatrixLocation = gl.getUniformLocation(program, 'transformMatrix');
        BaseEntity.colorLocation = gl.getUniformLocation(program, 'uColor');
        BaseEntity.samplerLocation = gl.getUniformLocation(program, 'uSampler');
        BaseEntity.useTextureLocation = gl.getUniformLocation(program, 'useTexture');
    }

    setRenderLayer(layer) {
        this.renderLayer = layer;
    }

    resetRenderLayer() {
        this.renderLayer = this.defaultLayer;
    }
    

    createShader(gl, type, source) {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.error('Shader compilation failed:', gl.getShaderInfoLog(shader));
            gl.deleteShader(shader);
            return null;
        }
        
        return shader;
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

    }

    update(interval, allEntities, spatialGrid) {
        if (this.attachedTo) {
            // Update position based on attached entity
            this.x = this.attachedTo.x + this.attachmentOffset.x;
            this.y = this.attachedTo.y + this.attachmentOffset.y;
            return;
        }

        if (!this.name) {
            if (Math.abs(this.velocity.x) < 1 && Math.abs(this.velocity.y) < 1) {
                this.lastYMovement += interval;
            } else if (this.sleeping)  {
                //!Warning ACTIVATING NEARBY OBJECTS, PERFORMANT HEAVY
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
                    }
                }

            }
            if (this.lastYMovement > 3 && Math.abs(this.velocity.y) < 0.1) {
                this.sleeping = true;
                this.grounded = true;
                this.hasGravity = false;
                this.lastYMovement = 0;
                return;
            }              
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
                    // obj.hasCollision = true
                    // obj.lastYMovement = 0 
                    if (this.velocity.x > 0) {
                        obj.velocity.x = pushFactor;
                    } else if (this.velocity.x < 0) {
                        obj.velocity.x = -pushFactor;
                    }
                }
                
                if (this.testStepHeight(obj, spatialGrid)) {
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

    render(viewProjectionMatrix) {
        const gl = this.gl;
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        
        gl.useProgram(BaseEntity.program);
    
        // Reset and update model matrix
        mat4.identity(modelMatrix);
    
        // Calculate scaling factors based on the entity's hitbox dimensions
        let scaleX = this.visualWidth;
        let scaleY = this.visualHeight;
    
        // Handle animation scaling
        if (this.animationController) {
            const currentAnimation = this.animationController.animations.get(this.animationController.currentAnimation);
            const currentFrame = this.animationController.getCurrentFrame();
            
            if (currentFrame && currentAnimation) {
                if (currentFrame.width && currentFrame.height) {
                    const textureAspectRatio = currentFrame.width / currentFrame.height;
                    const entityAspectRatio = this.visualWidth / this.visualHeight;
    
                    if (textureAspectRatio > entityAspectRatio) {
                        scaleY = this.visualWidth / textureAspectRatio;
                    } else {
                        scaleX = this.visualHeight * textureAspectRatio;
                    }
    
                    if (currentAnimation.flipped) {
                        scaleX = -scaleX;
                    }
                }
            }
        }

        // Position translation
        if (this.name) {
            vec3.set(tempVec3, this.x + this.halfWidth, this.y + this.halfHeight + 10, 0);
        } else {
            vec3.set(tempVec3, this.x + this.halfWidth, this.y + this.halfHeight, 0);
        }
        mat4.translate(modelMatrix, modelMatrix, tempVec3);

        // Apply rotation if it exists
        if (this.rotation) {
            mat4.rotateZ(modelMatrix, modelMatrix, this.rotation);
        }
    
        // Apply the calculated scaling
        vec3.set(tempVec3, scaleX, scaleY, 1);
        mat4.scale(modelMatrix, modelMatrix, tempVec3);
    
        // Multiply model matrix with view projection matrix
        mat4.multiply(transformMatrix, viewProjectionMatrix, modelMatrix);
        gl.uniformMatrix4fv(BaseEntity.transformMatrixLocation, false, transformMatrix);
    
        if (this.animationController) {
            const texture = this.animationController.getCurrentTexture();
            if (texture) {
                gl.uniform1i(BaseEntity.useTextureLocation, 1);
                gl.activeTexture(gl.TEXTURE0);
                gl.bindTexture(gl.TEXTURE_2D, texture);
                gl.uniform1i(BaseEntity.samplerLocation, 0);
            } else {
                gl.uniform1i(BaseEntity.useTextureLocation, 0);
                gl.uniform4fv(BaseEntity.colorLocation, this.color);
            }
        } else {
            gl.uniform1i(BaseEntity.useTextureLocation, 0);
            gl.uniform4fv(BaseEntity.colorLocation, this.color);
        }
    
        gl.bindBuffer(gl.ARRAY_BUFFER, BaseEntity.vertexBuffer);
        gl.enableVertexAttribArray(BaseEntity.positionLocation);
        gl.vertexAttribPointer(BaseEntity.positionLocation, 2, gl.FLOAT, false, 0, 0);
    
        gl.bindBuffer(gl.ARRAY_BUFFER, BaseEntity.textureCoordBuffer);
        gl.enableVertexAttribArray(BaseEntity.textureCoordLocation);
        gl.vertexAttribPointer(BaseEntity.textureCoordLocation, 2, gl.FLOAT, false, 0, 0);
    
        gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);
        
        gl.disable(gl.BLEND);
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

    setScale(scale) {
        this.scale = scale;
        this.updateDimensions();
    }
}

export { BaseEntity };
