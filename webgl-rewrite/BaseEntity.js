import { gravity } from './constants.js'

class BaseEntity {
    constructor(x, y, width, height, color, canvas) {
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
        this.hasGravity = true
    }

    init(gl) {
        this.gl = gl
        this.setupBuffers()
        this.setupShaders()
    }

    update(interval, allEntites) {
        this.grounded = false
        this.handleGravity(interval)
        this.x += Math.abs(this.velocity.x) < 100 ? 0 : this.velocity.x * interval
        this.y += this.velocity.y * interval
        
        for (const obj of allEntites) {
            if (obj !== this && this.checkBroadPhaseCollision(obj)) {
                obj.handleCollision(this)
            }
        }
        // this.render()  // Render is now handled externally with viewProjectionMatrix
    }

    setupBuffers() {
        const gl = this.gl
        this.vertexBuffer = gl.createBuffer()
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer)
        // Define a unit square (centered at 0,0) that will be scaled in render()
        const vertices = new Float32Array([
            -0.5, -0.5,
             0.5, -0.5,
             0.5,  0.5,
            -0.5,  0.5
        ])
        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW)
    }

    setupShaders() {
        const gl = this.gl
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
        this.vertexShader = this.createShader(gl, gl.VERTEX_SHADER, vertexShaderSource)
        this.fragmentShader = this.createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource)
        this.program = gl.createProgram()
        gl.attachShader(this.program, this.vertexShader)
        gl.attachShader(this.program, this.fragmentShader)
        gl.linkProgram(this.program)
        if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
            console.error('Unable to initialize the shader program: ' + gl.getProgramInfoLog(this.program))
            return null
        }
        this.positionLocation = gl.getAttribLocation(this.program, 'position')
        this.transformMatrixLocation = gl.getUniformLocation(this.program, 'transformMatrix')
        this.colorLocation = gl.getUniformLocation(this.program, 'uColor')
    }

    createShader(gl, type, source) {
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

    render(viewProjectionMatrix) {
        const gl = this.gl
        gl.useProgram(this.program)
        
        // Create a model matrix based on the entity's world position and size (in pixels)
        const modelMatrix = mat4.create()
        // Translate by the entity's center (if x and y are the top-left, add half the width and height)
        mat4.translate(modelMatrix, modelMatrix, vec3.fromValues(this.x + this.width / 2, this.y + this.height / 2, 0))
        // Scale to the entity's width and height
        mat4.scale(modelMatrix, modelMatrix, vec3.fromValues(this.width, this.height, 1))

        // Multiply view-projection and model matrices to form the final transform
        const transformMatrix = mat4.create()
        mat4.multiply(transformMatrix, viewProjectionMatrix, modelMatrix)
        
        gl.uniformMatrix4fv(this.transformMatrixLocation, false, transformMatrix)
        gl.uniform4fv(this.colorLocation, this.color)
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer)
        gl.enableVertexAttribArray(this.positionLocation)
        gl.vertexAttribPointer(this.positionLocation, 2, gl.FLOAT, false, 0, 0)
        gl.drawArrays(gl.TRIANGLE_FAN, 0, 4)
    }

    handleGravity(interval) {
        if (!this.grounded) {
            this.velocity.y += this.gravity * interval
        }
    }

    checkCollision(movableObject) {
        return !(
            movableObject.x >= this.x + this.width ||
            movableObject.x + movableObject.width <= this.x ||
            movableObject.y >= this.y + this.height ||
            movableObject.y + movableObject.height <= this.y
        )
    }

    checkBroadPhaseCollision(other) {
        const expandedX = this.velocity.x > 0 ? this.x : this.x + this.velocity.x
        const expandedY = this.velocity.y > 0 ? this.y : this.y + this.velocity.y
        const expandedWidth = this.velocity.x > 0 ? this.width + this.velocity.x : this.width - this.velocity.x
        const expandedHeight = this.velocity.y > 0 ? this.height + this.velocity.y : this.height - this.velocity.y

        return !(
            other.x >= expandedX + expandedWidth ||
            other.x + other.width <= expandedX ||
            other.y >= expandedY + expandedHeight ||
            other.y + other.height <= expandedY
        )
    }

    handleCollision(movableObject) {
        if (!this.checkCollision(movableObject)) {
            return
        }

        const bottomOverlap = movableObject.y + movableObject.height - this.y
        const topOverlap = this.y + this.height - movableObject.y

        if (movableObject.velocity.y > 0 && bottomOverlap > 0 && bottomOverlap < movableObject.height) {
            movableObject.y = this.y - movableObject.height
            movableObject.velocity.y = 0
            movableObject.grounded = true
        } 
        else if (movableObject.velocity.y < 0 && topOverlap > 0 && topOverlap < movableObject.height * 0.5) {
            movableObject.y = this.y + this.height
            movableObject.velocity.y = 0
        } 
        else {
            const middleX = this.x + this.width / 2
            if (movableObject.x + movableObject.width / 2 < middleX) {
                if (movableObject.height - (this.y - movableObject.y) <= movableObject.stepHeight) {
                    movableObject.velocity.y -= 0.005
                } 
                else {
                    movableObject.x = this.x - movableObject.width
                    if (this.hasGravity) {
                        this.velocity.x += movableObject.velocity.x
                    }
                    movableObject.velocity.x = 0
                }
            } 
            else {
                if (movableObject.height - (this.y - movableObject.y) <= movableObject.stepHeight) {
                    movableObject.velocity.y -= 0.005
                } 
                else {
                    movableObject.x = this.x + this.width
                    if (this.hasGravity) {
                        this.velocity.x += movableObject.velocity.x
                    }
                    movableObject.velocity.x = 0
                }
            }
        }
    }
}

export { BaseEntity }
