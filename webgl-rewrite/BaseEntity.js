import { gravity } from './constants.js'
import CollisionCore from './CollisionCore.js'

// Shared transformation matrices to avoid creating new ones each frame
const modelMatrix = mat4.create()
const transformMatrix = mat4.create()
const tempVec3 = vec3.create()

class BaseEntity extends CollisionCore {
    // Static initialization for shared resources
    static {
        this.initialized = false
        this.vertexBuffer = null
        this.program = null
        this.positionLocation = null
        this.transformMatrixLocation = null
        this.colorLocation = null
    }

    constructor(x, y, width, height, color, canvas) {
        super()
        this.x = x
        this.y = y
        this.width = width
        this.height = height
        this.color = new Float32Array(color) // Pre-allocate color array
        this.canvas = canvas
        this.gl = null
        this.velocity = { x: 0, y: 0 }
        this.gravity = gravity
        this.onGround = false
        this.hasGravity = false
        
        // Cache half dimensions for render calculations
        this.halfWidth = width / 2
        this.halfHeight = height / 2
    }

    init(gl) {
        this.gl = gl
        
        // Only initialize shared resources once
        if (BaseEntity.initialized) return
        
        this.initSharedResources(gl)
        BaseEntity.initialized = true
    }

    initSharedResources(gl) {
        // Create and cache shared vertex buffer
        BaseEntity.vertexBuffer = gl.createBuffer()
        gl.bindBuffer(gl.ARRAY_BUFFER, BaseEntity.vertexBuffer)
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
            -0.5, -0.5,
             0.5, -0.5,
             0.5,  0.5,
            -0.5,  0.5
        ]), gl.STATIC_DRAW)

        // Create and cache shared shader program
        const program = gl.createProgram()
        gl.attachShader(
            program,
            this.createShader(gl, gl.VERTEX_SHADER, `
                attribute vec2 position;
                uniform mat4 transformMatrix;
                void main() {
                    gl_Position = transformMatrix * vec4(position, 0.0, 1.0);
                }
            `)
        )
        gl.attachShader(
            program,
            this.createShader(gl, gl.FRAGMENT_SHADER, `
                precision mediump float;
                uniform vec4 uColor;
                void main() {
                    gl_FragColor = uColor;
                }
            `)
        )
        gl.linkProgram(program)
        
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            console.error('Shader program initialization failed:', gl.getProgramInfoLog(program))
            return
        }

        BaseEntity.program = program
        BaseEntity.positionLocation = gl.getAttribLocation(program, 'position')
        BaseEntity.transformMatrixLocation = gl.getUniformLocation(program, 'transformMatrix')
        BaseEntity.colorLocation = gl.getUniformLocation(program, 'uColor')
    }

    createShader(gl, type, source) {
        const shader = gl.createShader(type)
        gl.shaderSource(shader, source)
        gl.compileShader(shader)
        
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.error('Shader compilation failed:', gl.getShaderInfoLog(shader))
            gl.deleteShader(shader)
            return null
        }
        
        return shader
    }

    update(interval, allEntities, spatialGrid) {
        if (!this.hasGravity) return

        this.grounded = false
        
        // Update physics
        if (!this.grounded) {
            this.velocity.y += this.gravity * interval
        }
        
        // Only update position if there's significant movement
        if (Math.abs(this.velocity.x) >= 100) {
            this.x += this.velocity.x * interval
        }
        this.y += this.velocity.y * interval

        // Collision detection with spatial partitioning
        const nearbyObjects = spatialGrid.query(this)
        for (const obj of nearbyObjects) {
            if (obj !== this && this.checkBroadPhaseCollision(obj)) {
                obj.handleCollision(this)
            }
        }
    }

    render(viewProjectionMatrix) {
        const gl = this.gl
        gl.useProgram(BaseEntity.program)
        
        // Reset and update model matrix
        mat4.identity(modelMatrix)
        vec3.set(tempVec3, this.x + this.halfWidth, this.y + this.halfHeight, 0)
        mat4.translate(modelMatrix, modelMatrix, tempVec3)
        vec3.set(tempVec3, this.width, this.height, 1)
        mat4.scale(modelMatrix, modelMatrix, tempVec3)
        
        // Calculate final transform
        mat4.multiply(transformMatrix, viewProjectionMatrix, modelMatrix)
        
        // Set uniforms and draw
        gl.uniformMatrix4fv(BaseEntity.transformMatrixLocation, false, transformMatrix)
        gl.uniform4fv(BaseEntity.colorLocation, this.color)
        
        gl.bindBuffer(gl.ARRAY_BUFFER, BaseEntity.vertexBuffer)
        gl.enableVertexAttribArray(BaseEntity.positionLocation)
        gl.vertexAttribPointer(BaseEntity.positionLocation, 2, gl.FLOAT, false, 0, 0)
        gl.drawArrays(gl.TRIANGLE_FAN, 0, 4)
    }
}

export { BaseEntity }