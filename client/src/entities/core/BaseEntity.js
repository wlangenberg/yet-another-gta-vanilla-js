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
        this.program = null;
        this.positionLocation = null;
        this.transformMatrixLocation = null;
        this.colorLocation = null;
    }

    constructor(x, y, width, height, color, canvas) {
        super();
        this.id = allEntities.length + 1
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
        this.hasGravity = false;
        // Set a default stepHeight (in pixels) for stepping up small ledges.
        this.stepHeight = this.height / 3;
        this.lastYMovement = 0
        
        // Cache half dimensions for render calculations
        this.halfWidth = width / 2;
        this.halfHeight = height / 2;

        // Add mass property based on area (this can be customized as needed)
        this.mass = width * height;

        // Sleeping state flag for optimization.
        // When true, the update function returns immediately unless a moving neighbor wakes it.
        this.sleeping = true;
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

        // Create and cache shared shader program
        const program = gl.createProgram();
        gl.attachShader(
            program,
            this.createShader(
                gl,
                gl.VERTEX_SHADER,
                `
                attribute vec2 position;
                uniform mat4 transformMatrix;
                void main() {
                    gl_Position = transformMatrix * vec4(position, 0.0, 1.0);
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
                void main() {
                    gl_FragColor = uColor;
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
        BaseEntity.transformMatrixLocation = gl.getUniformLocation(program, 'transformMatrix');
        BaseEntity.colorLocation = gl.getUniformLocation(program, 'uColor');
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
            if (obj === this) continue;
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


    update(interval, allEntities, spatialGrid) {
        if (!this.name) {
            if (Math.abs(this.velocity.x) < 1 && Math.abs(this.velocity.y) < 1) {
                this.lastYMovement += interval
            } else {
                this.sleeping = false
            }
            if (this.lastYMovement > 2 && Math.abs(this.velocity.y) < 0.1) {
                this.sleeping = true;
                this.grounded = true
                this.lastYMovement = 0
                return
            }              

        }

        // Only update entities affected by gravity.
        if (!this.hasGravity || (this.sleeping && !this.name)) return;

        // Apply gravity.
        this.applyGravity(interval);

        // Handle movement and collisions.
        if (this.name) {
            this.handleVelocity(interval, spatialGrid);
        } else {
            this.handleVelocityOptimized(interval, spatialGrid)
        }
        // Apply friction.
        this.applyFriction();
        if (this.name) {
            // If the entity's velocity is negligible after updates, put it to sleep.
            this.resolveOverlap(spatialGrid);

        }
    }

    applyGravity(interval) {
        this.velocity.y += this.gravity * interval;
    }

    handleVelocityOptimized(interval, spatialGrid) {
        let dx = this.velocity.x * interval;
        let dy = this.velocity.y * interval;

        // Attempt horizontal movement
        this.x += dx;
        let collidedX = false;
        const objectsX = spatialGrid.query(this);
        for (const obj of objectsX) {
            if (obj !== this && CollisionCore.staticCheckCollision(this, obj)) {
                collidedX = true;
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
            if (obj !== this && CollisionCore.staticCheckCollision(this, obj)) {
                collidedY = true;
                break;
            }
        }
        if (collidedY) {
            this.y -= dy;
            this.velocity.y = 0;
            this.grounded = true;
        }
    }


    handleVelocity(interval, spatialGrid) {
        let remainingTime = interval;
        const maxIterations = 10;
        for (let i = 0; i < maxIterations; i++) {
            let earliestCollisionTime = 1;
            let collisionResult = null;
            let collisionObject = null;
            const nearbyObjects = spatialGrid.query(this);
            for (const obj of nearbyObjects) {
                if (obj !== this) {
                    const broadphaseBox = {
                        x: this.velocity.x > 0 ? this.x : this.x + this.velocity.x * remainingTime,
                        y: this.velocity.y > 0 ? this.y : this.y + this.velocity.y * remainingTime,
                        width: this.velocity.x > 0 ? this.width + this.velocity.x * remainingTime : this.width - this.velocity.x * remainingTime,
                        height: this.velocity.y > 0 ? this.height + this.velocity.y * remainingTime : this.height - this.velocity.y * remainingTime
                    };
                    if (!CollisionCore.staticCheckCollision(broadphaseBox, obj)) {
                        continue;
                    }
                    const result = this.sweptAABB(obj, remainingTime);
                    if (result.collision && result.entryTime < earliestCollisionTime) {
                        earliestCollisionTime = result.entryTime;
                        collisionResult = result;
                        collisionObject = obj;
                    }
                }
            }
            if (!collisionResult) {
                // No collision detected; move normally for the remaining time.
                this.x += this.velocity.x * remainingTime;
                this.y += this.velocity.y * remainingTime;
                break;
            }

            // StepHeight logic: if the collision is horizontal and within the stepHeight threshold,
            // attempt to step up the ledge.
            if (collisionResult.normalX !== 0 && collisionResult.normalY === 0 && this.stepHeight > 0) {
                const candidateStep = (this.y + this.height) - collisionObject.y;
                if (candidateStep > 0 && candidateStep <= this.stepHeight) {
                    const candidate = {
                        x: this.x,
                        y: this.y - candidateStep,
                        width: this.width,
                        height: this.height
                    };
                    if (!CollisionCore.staticCheckCollision(candidate, collisionObject)) {
                        this.y -= candidateStep;
                        this.grounded = true;
                        continue;
                    }
                }
            }

            // Move to the collision point.
            this.x += this.velocity.x * earliestCollisionTime * remainingTime;
            this.y += this.velocity.y * earliestCollisionTime * remainingTime;

            // Mass-based collision response only when there is an actual velocity change (e.g., a push).
            if (collisionObject && typeof collisionObject.mass !== "undefined") {
                const normal = { x: collisionResult.normalX, y: collisionResult.normalY };
                const relVelX = this.velocity.x - collisionObject.velocity.x;
                const relVelY = this.velocity.y - collisionObject.velocity.y;
                const relVelAlongNormal = relVelX * normal.x + relVelY * normal.y;
                if (Math.abs(relVelAlongNormal) > 0.01) {
                    const m1 = this.mass;
                    const m2 = collisionObject.mass;
                    const v1 = { x: this.velocity.x, y: this.velocity.y };
                    const v2 = { x: collisionObject.velocity.x, y: collisionObject.velocity.y };
                    const v1n = v1.x * normal.x + v1.y * normal.y;
                    const v2n = v2.x * normal.x + v2.y * normal.y;
                    const v1t = { x: v1.x - v1n * normal.x, y: v1.y - v1n * normal.y };
                    const v2t = { x: v2.x - v2n * normal.x, y: v2.y - v2n * normal.y };
                    const v1nAfter = (v1n * (m1 - m2) + 2 * m2 * v2n) / (m1 + m2);
                    const v2nAfter = (v2n * (m2 - m1) + 2 * m1 * v1n) / (m1 + m2);
                    // this.velocity.x = v1t.x + v1nAfter * normal.x;
                    // this.velocity.y = v1t.y + v1nAfter * normal.y;
                    collisionObject.velocity.x = v2t.x + v2nAfter * normal.x;
                    collisionObject.velocity.y = v2t.y + v2nAfter * normal.y;
                } else {
                    // If there is no significant push, fallback to sliding along the surface.
                    const dot = this.velocity.x * normal.x + this.velocity.y * normal.y;
                    this.velocity.x = this.velocity.x - dot * normal.x;
                    this.velocity.y = this.velocity.y - dot * normal.y;
                }
            } else {
                // Fallback to simple sliding if mass is not defined.
                const dot = this.velocity.x * collisionResult.normalX + this.velocity.y * collisionResult.normalY;
                this.velocity.x = this.velocity.x - dot * collisionResult.normalX;
                this.velocity.y = this.velocity.y - dot * collisionResult.normalY;
            }

            const dot = this.velocity.x * collisionResult.normalX + this.velocity.y * collisionResult.normalY;
            this.velocity.x = this.velocity.x - dot * collisionResult.normalX;
            this.velocity.y = this.velocity.y - dot * collisionResult.normalY;

            if (collisionResult.normalY === -1) {
                this.grounded = true;
            }

            remainingTime = remainingTime * (1 - earliestCollisionTime);
            if (remainingTime < 0.001) break;
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

    render(viewProjectionMatrix) {
        const gl = this.gl;
        gl.useProgram(BaseEntity.program);
        
        // Reset and update model matrix.
        mat4.identity(modelMatrix);
        vec3.set(tempVec3, this.x + this.halfWidth, this.y + this.halfHeight, 0);
        mat4.translate(modelMatrix, modelMatrix, tempVec3);
        vec3.set(tempVec3, this.width, this.height, 1);
        mat4.scale(modelMatrix, modelMatrix, tempVec3);
        
        // Calculate final transform.
        mat4.multiply(transformMatrix, viewProjectionMatrix, modelMatrix);
        
        // Set uniforms and draw.
        gl.uniformMatrix4fv(BaseEntity.transformMatrixLocation, false, transformMatrix);
        gl.uniform4fv(BaseEntity.colorLocation, this.color);
        
        gl.bindBuffer(gl.ARRAY_BUFFER, BaseEntity.vertexBuffer);
        gl.enableVertexAttribArray(BaseEntity.positionLocation);
        gl.vertexAttribPointer(BaseEntity.positionLocation, 2, gl.FLOAT, false, 0, 0);
        gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);
    }
}

export { BaseEntity };
