import { BaseEntity } from "./BaseEntity.js"

class SunWebGL extends BaseEntity {
    constructor(x, y, width, height, canvas, gl) {
        super(x, y, width, height, [1.0, 1.0, 0.0, 1.0], canvas, gl)
        this.gl = gl
        this.shadowLength = 5000
        this.cameraPos = { x: 0, y: 0 }
        // Increase update interval to reduce calculations
        this.updateInterval = 1  // Only update every 5 frames
        this.frameCount = 0
        this.cachedVertices = []
        this.cachedQuads = []
        // Cache for ground segments
        this.groundSegments = []
        this.lastGroundHash = ""
        // Viewport bounds for culling
        this.viewportBounds = { left: 0, right: 0, top: 0, bottom: 0 }
        this.initShaders()
        this.initBuffers()
    }

    initShaders() {
        const gl = this.gl
        // This shader is used to render the shadow geometry into the stencil buffer
        const vsSource = `
            attribute vec2 a_position;
            attribute float a_blur;
            uniform mat4 u_matrix;
            varying float v_blur;
            void main() {
                v_blur = a_blur;
                gl_Position = u_matrix * vec4(a_position, 0.0, 1.0);
            }
        `
        const fsSource = `
            precision mediump float;
            varying float v_blur;
            uniform float u_blurAmount;
            void main() {
                gl_FragColor = vec4(1.0, 1.0, 1.0, 1.0);
            }
        `
        const vShader = this.createShader(gl.VERTEX_SHADER, vsSource)
        const fShader = this.createShader(gl.FRAGMENT_SHADER, fsSource)
        this.shadowProgram = gl.createProgram()
        gl.attachShader(this.shadowProgram, vShader)
        gl.attachShader(this.shadowProgram, fShader)
        gl.linkProgram(this.shadowProgram)
        this.posLoc = gl.getAttribLocation(this.shadowProgram, "a_position")
        this.blurLoc = gl.getAttribLocation(this.shadowProgram, "a_blur")
        this.matrixLoc = gl.getUniformLocation(this.shadowProgram, "u_matrix")
        this.blurAmountLoc = gl.getUniformLocation(this.shadowProgram, "u_blurAmount")
    }

    createShader(type, source) {
        const gl = this.gl
        const shader = gl.createShader(type)
        gl.shaderSource(shader, source)
        gl.compileShader(shader)
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.error(gl.getShaderInfoLog(shader))
            gl.deleteShader(shader)
            return null
        }
        return shader
    }

    initBuffers() {
        const gl = this.gl
        this.shadowBuffer = gl.createBuffer()
    }

    // This quad program is used to darken (multiply) the entire screen in shadowed areas
    createQuadProgram() {
        const gl = this.gl
        const vsSource = `
            attribute vec2 a_position;
            void main() {
                gl_Position = vec4(a_position, 0.0, 1.0);
            }
        `
        const fsSource = `
            precision mediump float;
            uniform float u_shadowFactor;
            void main() {
                gl_FragColor = vec4(u_shadowFactor, u_shadowFactor, u_shadowFactor, 1.0);
            }
        `
        const vShader = this.createShader(gl.VERTEX_SHADER, vsSource)
        const fShader = this.createShader(gl.FRAGMENT_SHADER, fsSource)
        const program = gl.createProgram()
        gl.attachShader(program, vShader)
        gl.attachShader(program, fShader)
        gl.linkProgram(program)
        return program
    }

    // This program can be used later if you want to draw shadow rays (line visualization)
    createLineProgram() {
        const gl = this.gl
        const vsSource = `
            attribute vec2 a_position;
            uniform mat4 u_matrix;
            void main() {
                gl_Position = u_matrix * vec4(a_position, 0.0, 1.0);
            }
        `
        const fsSource = `
            precision mediump float;
            uniform vec4 u_color;
            void main() {
                gl_FragColor = u_color;
            }
        `
        const vShader = this.createShader(gl.VERTEX_SHADER, vsSource)
        const fShader = this.createShader(gl.FRAGMENT_SHADER, fsSource)
        const program = gl.createProgram()
        gl.attachShader(program, vShader)
        gl.attachShader(program, fShader)
        gl.linkProgram(program)
        return program
    }

    // Given a vertex, extend it from the sun by the shadow length
    extendVertex(v, sunX, sunY, shadowLength) {
        let vx = v.x - sunX
        let vy = v.y - sunY
        const len = Math.hypot(vx, vy)
        if (len === 0) {
            return { x: v.x, y: v.y }
        }
        vx /= len
        vy /= len
        return {
            x: v.x + vx * shadowLength,
            y: v.y + vy * shadowLength
        }
    }

    // Fast hash function for ground objects state
    hashGroundObjects(groundObjects) {
        return groundObjects.map(obj => `${obj.x},${obj.y},${obj.width}`).join('|')
    }

    // Optimized ground segment finding with caching
    findGroundSegments(obstacles, forceUpdate = false) {
        const groundObjects = obstacles.filter(obj => obj.isGround || obj.type === 'ground')
            .sort((a, b) => a.x - b.x)

        // Check if ground objects have changed
        const currentHash = this.hashGroundObjects(groundObjects)
        if (!forceUpdate && currentHash === this.lastGroundHash) {
            return this.groundSegments
        }

        this.lastGroundHash = currentHash
        const segments = []
        let currentSegment = []

        for (let obj of groundObjects) {
            if (currentSegment.length === 0) {
                currentSegment.push(obj)
            } else {
                const lastObj = currentSegment[currentSegment.length - 1]
                // Simplified connection check
                if (Math.abs(lastObj.y - obj.y) <= 1 && 
                    Math.abs((lastObj.x + lastObj.width) - obj.x) <= 2) {
                    currentSegment.push(obj)
                } else {
                    segments.push(currentSegment)
                    currentSegment = [obj]
                }
            }
        }

        if (currentSegment.length > 0) {
            segments.push(currentSegment)
        }

        this.groundSegments = segments
        return segments
    }

    // Check if object is in view
    isInView(obj) {
        return !(obj.x + obj.width < this.viewportBounds.left ||
                obj.x > this.viewportBounds.right ||
                obj.y + obj.height < this.viewportBounds.top ||
                obj.y > this.viewportBounds.bottom)
    }

    updateViewportBounds(camera) {
        const margin = this.shadowLength // Add margin for shadows
        this.viewportBounds = {
            left: camera.x - margin,
            right: camera.x + this.canvas.width + margin,
            top: camera.y - margin,
            bottom: camera.y + this.canvas.height + margin
        }
    }

    computeShadowQuads(obstacles) {
        const sunX = this.x
        const sunY = this.y
        const shadowLength = this.shadowLength
        const quads = []

        // Process non-ground objects first
        const obstacleLength = obstacles.length
        for (let i = 0; i < obstacleLength; i++) {
            const obj = obstacles[i]
            if (obj === this || obj.color === "green" || 
                obj.isGround || obj.type === 'ground' || 
                !this.isInView(obj)) {
                continue
            }

            // Skip if sun is inside the object
            if (sunX >= obj.x && sunX <= obj.x + obj.width && 
                sunY >= obj.y && sunY <= obj.y + obj.height) {
                continue
            }

            // Optimized edge detection - only check necessary edges
            if (sunX < obj.x) {
                // Left edge
                this.addQuad(quads, 
                    { x: obj.x, y: obj.y },
                    { x: obj.x, y: obj.y + obj.height },
                    sunX, sunY, shadowLength
                )
            } else if (sunX > obj.x + obj.width) {
                // Right edge
                this.addQuad(quads,
                    { x: obj.x + obj.width, y: obj.y },
                    { x: obj.x + obj.width, y: obj.y + obj.height },
                    sunX, sunY, shadowLength
                )
            }

            // Top edge only if sun is above
            if (sunY < obj.y) {
                this.addQuad(quads,
                    { x: obj.x, y: obj.y },
                    { x: obj.x + obj.width, y: obj.y },
                    sunX, sunY, shadowLength
                )
            }
        }

        // Process ground segments
        const groundSegments = this.findGroundSegments(obstacles)
        for (let segment of groundSegments) {
            if (segment.length === 0) continue

            const startX = segment[0].x
            const endX = segment[segment.length - 1].x + segment[segment.length - 1].width
            const y = segment[0].y

            // Only cast shadow if sun is below the ground and segment is in view
            if (sunY > y && this.isInView({ x: startX, y, width: endX - startX, height: 1 })) {
                this.addQuad(quads,
                    { x: startX, y },
                    { x: endX, y },
                    sunX, sunY, shadowLength
                )
            }
        }

        return quads
    }

    addQuad(quads, start, end, sunX, sunY, shadowLength) {
        const extended0 = this.extendVertex(start, sunX, sunY, shadowLength)
        const extended1 = this.extendVertex(end, sunX, sunY, shadowLength)
        quads.push({
            v0: start,
            v1: end,
            v2: extended1,
            v3: extended0
        })
    }
    setPosition(x, y) {
        this.x = x
        this.y = y
    }

    update(interval, allGameObjects = [], spatialGrid, camera) {
        // No sun movement by default
    }

    computeOrthoMatrix() {
        const l = this.cameraPos.x
        const r = this.cameraPos.x + this.canvas.width
        const t = this.cameraPos.y
        const b = this.cameraPos.y + this.canvas.height
        const n = -1
        const f = 1
        return new Float32Array([
            2 / (r - l),    0,           0,  0,
            0,          2 / (t - b),     0,  0,
            0,          0,   -2 / (f - n),  0,
            -(r + l) / (r - l), -(t + b) / (t - b), -(f + n) / (f - n), 1
        ])
    }

    render(dt, allGameObjects, spatialGrid, camera) {
        super.render(camera.getViewMatrix())
        this.cameraPos.x = camera.x
        this.cameraPos.y = camera.y
        this.frameCount++

        // Update viewport bounds for culling
        this.updateViewportBounds(camera)

        // Only update shadows periodically
        if (this.frameCount % this.updateInterval === 0) {
            const obstacles = allGameObjects.filter(obj => obj !== this)
            const quads = this.computeShadowQuads(obstacles)
            
            // Optimize vertex array creation
            const verts = new Float32Array(quads.length * 18) // 6 vertices * 3 components per quad
            let offset = 0
            
            for (let q of quads) {
                // First triangle
                verts[offset++] = q.v0.x
                verts[offset++] = q.v0.y
                verts[offset++] = 0.0
                verts[offset++] = q.v1.x
                verts[offset++] = q.v1.y
                verts[offset++] = 0.0
                verts[offset++] = q.v2.x
                verts[offset++] = q.v2.y
                verts[offset++] = 1.0
                
                // Second triangle
                verts[offset++] = q.v0.x
                verts[offset++] = q.v0.y
                verts[offset++] = 0.0
                verts[offset++] = q.v2.x
                verts[offset++] = q.v2.y
                verts[offset++] = 1.0
                verts[offset++] = q.v3.x
                verts[offset++] = q.v3.y
                verts[offset++] = 1.0
            }
            
            this.cachedVertices = verts
            this.cachedQuads = quads
        }

        this.drawShadows(this.cachedVertices)
    }

    // This method renders the shadow geometry to the stencil buffer (with depth testing off)
    // and then draws a full-screen quad that multiplies (darkens) the scene in the marked areas.
    drawShadows(vertices) {
        if (!vertices.length) return
        const gl = this.gl

        // Step 1: Render shadow geometry into the stencil buffer.
        // Disable depth test so that shadow geometry marks all pixels (objects or background).
        gl.disable(gl.DEPTH_TEST)
        gl.enable(gl.STENCIL_TEST)
        gl.clear(gl.STENCIL_BUFFER_BIT)
        gl.stencilFunc(gl.ALWAYS, 1, 0xFF)
        gl.stencilOp(gl.REPLACE, gl.REPLACE, gl.REPLACE)
        gl.colorMask(false, false, false, false)
        gl.disable(gl.BLEND)
        gl.bindBuffer(gl.ARRAY_BUFFER, this.shadowBuffer)
        const data = new Float32Array(vertices)
        gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW)
        gl.useProgram(this.shadowProgram)
        const stride = 3 * Float32Array.BYTES_PER_ELEMENT
        gl.enableVertexAttribArray(this.posLoc)
        gl.vertexAttribPointer(this.posLoc, 2, gl.FLOAT, false, stride, 0)
        gl.enableVertexAttribArray(this.blurLoc)
        gl.vertexAttribPointer(this.blurLoc, 1, gl.FLOAT, false, stride, 2 * Float32Array.BYTES_PER_ELEMENT)
        const ortho = this.computeOrthoMatrix()
        gl.uniformMatrix4fv(this.matrixLoc, false, ortho)
        gl.drawArrays(gl.TRIANGLES, 0, data.length / 3)

        // Step 2: Render a full-screen quad that applies a constant darkening factor
        // (using multiplicative blending) to all pixels marked in the stencil.
        gl.colorMask(true, true, true, true)
        gl.stencilFunc(gl.EQUAL, 1, 0xFF)
        gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP)
        gl.enable(gl.BLEND)
        // Use blendFunc( gl.ZERO, gl.SRC_COLOR ) so that the final color becomes:
        // finalColor = dstColor * (quadColor)
        gl.blendFunc(gl.ZERO, gl.SRC_COLOR)
        if (!this.quadProgram) {
            this.quadProgram = this.createQuadProgram()
        }
        gl.useProgram(this.quadProgram)
        if (!this.quadBuffer) {
            this.quadBuffer = gl.createBuffer()
        }
        gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer)
        const quadVertices = new Float32Array([
            -1, -1,
             1, -1,
            -1,  1,
            -1,  1,
             1, -1,
             1,  1
        ])
        gl.bufferData(gl.ARRAY_BUFFER, quadVertices, gl.STATIC_DRAW)
        const posLoc = gl.getAttribLocation(this.quadProgram, "a_position")
        gl.enableVertexAttribArray(posLoc)
        gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0)
        const shadowFactorLoc = gl.getUniformLocation(this.quadProgram, "u_shadowFactor")
        // Adjust this factor (e.g. 0.5 for a darker shadow) as desired.
        gl.uniform1f(shadowFactorLoc, 0.4)
        gl.drawArrays(gl.TRIANGLES, 0, 6)

        gl.disable(gl.STENCIL_TEST)
        gl.disable(gl.BLEND)
        gl.enable(gl.DEPTH_TEST)
    }
}

export default SunWebGL
