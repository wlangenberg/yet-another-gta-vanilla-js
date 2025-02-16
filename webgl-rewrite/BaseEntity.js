import { gravity } from './constants.js'
import CollisionCore from './CollisionCore.js'

class BaseEntity extends CollisionCore {
    constructor(x, y, width, height, color, canvas) {
        super()
        this.x = x
        this.y = y
        this.width = width
        this.height = height
        this.color = color
        this.canvas = canvas
        this.gl = null
        this.velocity = { x: 0, y: 0 }
        this.gravity = gravity
        this.onGround = false
        this.hasGravity = false
    }

    init(gl) {
        this.gl = gl
        // Enable depth testing
        // gl.enable(gl.DEPTH_TEST)
        // gl.depthFunc(gl.LEQUAL)

        // Create and cache shared vertex buffer
        if (!BaseEntity.vertexBuffer) {
            BaseEntity.vertexBuffer = gl.createBuffer()
            gl.bindBuffer(gl.ARRAY_BUFFER, BaseEntity.vertexBuffer)
            const vertices = new Float32Array([
                -0.5, -0.5,
                 0.5, -0.5,
                 0.5,  0.5,
                -0.5,  0.5
            ])
            gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW)
        }
        // Create and cache shared shader program and its locations
        if (!BaseEntity.program) {
            const vertexShaderSource = `
                attribute vec2 position;
                uniform mat4 transformMatrix;
                void main() {
                    gl_Position = transformMatrix * vec4(position, 0.0, 1.0);
                }
            `
            const fragmentShaderSource = `
                precision mediump float;
                uniform vec4 uColor;
                void main() {
                    gl_FragColor = uColor;
                }
            `
            const vertexShader = BaseEntity.createShader(gl, gl.VERTEX_SHADER, vertexShaderSource)
            const fragmentShader = BaseEntity.createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource)
            const program = gl.createProgram()
            gl.attachShader(program, vertexShader)
            gl.attachShader(program, fragmentShader)
            gl.linkProgram(program)
            if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
                console.error('Unable to initialize the shader program: ' + gl.getProgramInfoLog(program))
                return null
            }
            BaseEntity.program = program
            BaseEntity.positionLocation = gl.getAttribLocation(program, 'position')
            BaseEntity.transformMatrixLocation = gl.getUniformLocation(program, 'transformMatrix')
            BaseEntity.colorLocation = gl.getUniformLocation(program, 'uColor')
        }
    }

    static createShader(gl, type, source) {
        const shader = gl.createShader(type)
        gl.shaderSource(shader, source)
        gl.compileShader(shader)
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.error('An error occurred compiling the shaders: ' + gl.getShaderInfoLog(shader))
            gl.deleteShader(shader)
            return null
        }
        return shader
    }

    update(interval, allEntites, spatialGrid) {
        if (this.hasGravity) {

            this.grounded = false
            this.handleGravity(interval)
            this.x += Math.abs(this.velocity.x) < 100 ? 0 : this.velocity.x * interval
            this.y += this.velocity.y * interval

            const nearbyObjects = spatialGrid.query(this);
            for (const obj of nearbyObjects) {
                if (obj !== this && this.checkBroadPhaseCollision(obj)) {
                    obj.handleCollision(this);
                }
            }

        }
    }

    render(viewProjectionMatrix) {
        const gl = this.gl
        gl.useProgram(BaseEntity.program)
        
        // Create model matrix based on world position and size (in pixels)
        const modelMatrix = mat4.create()
        // Translate by the center (if x/y are top-left, add half width/height)
        mat4.translate(modelMatrix, modelMatrix, vec3.fromValues(this.x + this.width / 2, this.y + this.height / 2, 0))
        // Scale to the entity's dimensions
        mat4.scale(modelMatrix, modelMatrix, vec3.fromValues(this.width, this.height, 1))
        
        // Multiply view-projection and model matrices to get the final transform
        const transformMatrix = mat4.create()
        mat4.multiply(transformMatrix, viewProjectionMatrix, modelMatrix)
        
        gl.uniformMatrix4fv(BaseEntity.transformMatrixLocation, false, transformMatrix)
        gl.uniform4fv(BaseEntity.colorLocation, this.color)
        gl.bindBuffer(gl.ARRAY_BUFFER, BaseEntity.vertexBuffer)
        gl.enableVertexAttribArray(BaseEntity.positionLocation)
        gl.vertexAttribPointer(BaseEntity.positionLocation, 2, gl.FLOAT, false, 0, 0)
        gl.drawArrays(gl.TRIANGLE_FAN, 0, 4)
    }

    handleGravity(interval) {
        if (!this.grounded) {
            this.velocity.y += this.gravity * interval
        }
    }
}

export { BaseEntity }
