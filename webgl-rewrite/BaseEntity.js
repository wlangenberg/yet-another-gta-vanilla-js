import { gravity } from './constants.js'
import CollisionCore from './CollisionCore.js'

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
        this.grounded = false;
        this.hasGravity = false;
        // Set a default stepHeight (in pixels) for stepping up small ledges.
        this.stepHeight = this.height/3;
        
        // Cache half dimensions for render calculations
        this.halfWidth = width / 2;
        this.halfHeight = height / 2;
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

    // This method resolves any lingering overlap after collision resolution.
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

    // Main update function now calls separate functions for physics, movement, and collision.
    update(interval, allEntities, spatialGrid) {
        if (!this.hasGravity) return;

        // Apply gravity to the vertical velocity.
        this.applyGravity(interval);

        // Handle movement with collision resolution.
        this.handleVelocity(interval, spatialGrid);

        // Apply friction to slow horizontal movement to zero.
        this.applyFriction();

        // After collision resolution, correct any overlapping.
        this.resolveOverlap(spatialGrid);
    }

    applyGravity(interval) {
        this.velocity.y += this.gravity * interval;
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

            // Normal collision resolution:
            this.x += this.velocity.x * earliestCollisionTime * remainingTime;
            this.y += this.velocity.y * earliestCollisionTime * remainingTime;

            // Adjust velocity by sliding along the collision surface.
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
