import { LAYERS } from "../configuration/constants.js"
import { BaseEntity } from "./core/BaseEntity.js"


class SunWebGL extends BaseEntity {
    constructor(x, y, width, height, canvas, gl) {
        super(x, y, width, height, [1.0, 1.0, 0.0, 1.0], canvas, gl)
        this.gl = gl
        this.shadowLength = 5000
        this.cameraPos = { x: 0, y: 0 }
        // Increase update interval to reduce calculations
        this.updateInterval = 1  // Only update every frame
        this.frameCount = 0
        this.cachedVertices = []
        this.cachedQuads = []
        // Viewport bounds for culling
        this.viewportBounds = { left: 0, right: 0, top: 0, bottom: 0 }
        this.renderLayer = 0
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

    // This quad program is used to darken (multiply) the entire screen in shadowed areas.
    // We modify the vertex shader so that the quad is drawn with a depth of 1.0.
    createQuadProgram() {
        const gl = this.gl
        const vsSource = `
            attribute vec2 a_position;
            void main() {
                // Draw the quad with a constant depth of 1.0
                gl_Position = vec4(a_position, 1.0, 1.0);
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

    // Check if object is in view
    isInView(obj) {
        return !(obj.x + obj.width < this.viewportBounds.left ||
            obj.x > this.viewportBounds.right ||
            obj.y + obj.height < this.viewportBounds.top ||
            obj.y > this.viewportBounds.bottom)
    }

    updateViewportBounds(camera) {
        const extraBound = 2350
        // Only calculate shadows for objects strictly within the camera view.
        this.viewportBounds = {
            left: camera.x - extraBound,
            right: camera.x + this.canvas.width + extraBound,
            top: camera.y - extraBound,
            bottom: camera.y + this.canvas.height + extraBound
        }
    }

    computeShadowQuads(obstacles) {
        const sunX = this.x
        const sunY = this.y
        const shadowLength = this.shadowLength
        const quads = []
        
        // First, identify ground objects and group them by their y-position
        const groundRows = new Map() // Map<y-position, Array<groundObject>>
        const regularObjects = []

        for (let obj of obstacles) {
            if (obj === this || !this.isInView(obj)) continue;
            
            if (obj.isGround) {
                const key = Math.round(obj.y) // Round to handle floating point imprecision
                if (!groundRows.has(key)) {
                    groundRows.set(key, [])
                }
                groundRows.get(key).push(obj)
            } else {
                regularObjects.push(obj)
            }
        }

        // Process ground objects by rows
        for (let [y, rowObjects] of groundRows) {
            // Sort objects in the row by x-position
            rowObjects.sort((a, b) => a.x - b.x)
            
            // Find continuous segments in the row
            let segments = this.findContinuousSegments(rowObjects)
            
            // Cast shadows for each continuous segment
            for (let segment of segments) {
                this.processGroundSegment(segment, quads, sunX, sunY, shadowLength)
            }
        }

        // Process regular objects
        for (let obj of regularObjects) {
            // Skip if sun is inside the object
            if (
                sunX >= obj.x &&
                sunX <= obj.x + obj.width &&
                sunY >= obj.y &&
                sunY <= obj.y + obj.height
            ) {
                continue
            }

            // Horizontal shadow
            if (sunX < obj.x) {
                this.addQuad(
                    quads,
                    { x: obj.x + obj.width, y: obj.y },
                    { x: obj.x + obj.width, y: obj.y + obj.height },
                    sunX,
                    sunY,
                    shadowLength
                )
            } else if (sunX > obj.x + obj.width) {
                this.addQuad(
                    quads,
                    { x: obj.x, y: obj.y },
                    { x: obj.x, y: obj.y + obj.height },
                    sunX,
                    sunY,
                    shadowLength
                )
            }

            // Vertical shadow
            if (sunY < obj.y) {
                this.addQuad(
                    quads,
                    { x: obj.x, y: obj.y + obj.height },
                    { x: obj.x + obj.width, y: obj.y + obj.height },
                    sunX,
                    sunY,
                    shadowLength
                )
            } else if (sunY > obj.y + obj.height) {
                this.addQuad(
                    quads,
                    { x: obj.x, y: obj.y },
                    { x: obj.x + obj.width, y: obj.y },
                    sunX,
                    sunY,
                    shadowLength
                )
            }
        }
        
        return quads
    }

    findContinuousSegments(rowObjects) {
        if (rowObjects.length === 0) return []
        
        const segments = []
        let currentSegment = [rowObjects[0]]
        
        for (let i = 1; i < rowObjects.length; i++) {
            const current = rowObjects[i]
            const previous = rowObjects[i - 1]
            
            // Check if current object is continuous with previous
            // Allow for a small gap tolerance (e.g., 1 pixel)
            if (Math.abs((previous.x + previous.width) - current.x) <= 1) {
                currentSegment.push(current)
            } else {
                // Start a new segment
                segments.push(currentSegment)
                currentSegment = [current]
            }
        }
        
        // Don't forget to add the last segment
        segments.push(currentSegment)
        return segments
    }

    processGroundSegment(segment, quads, sunX, sunY, shadowLength) {
        if (segment.length === 0) return

        // Calculate segment bounds
        const startObj = segment[0]
        const endObj = segment[segment.length - 1]
        const segmentLeft = startObj.x
        const segmentRight = endObj.x + endObj.width
        const segmentTop = startObj.y
        const segmentBottom = startObj.y + startObj.height

        // Cast shadow based on sun position
        // Horizontal shadows
        if (sunX < segmentLeft) {
            // Sun is to the left
            this.addQuad(
                quads,
                { x: segmentRight, y: segmentTop },
                { x: segmentRight, y: segmentBottom },
                sunX,
                sunY,
                shadowLength
            )
        } else if (sunX > segmentRight) {
            // Sun is to the right
            this.addQuad(
                quads,
                { x: segmentLeft, y: segmentTop },
                { x: segmentLeft, y: segmentBottom },
                sunX,
                sunY,
                shadowLength
            )
        }

        // Vertical shadows
        if (sunY < segmentTop) {
            // Sun is above
            this.addQuad(
                quads,
                { x: segmentLeft, y: segmentBottom },
                { x: segmentRight, y: segmentBottom },
                sunX,
                sunY,
                shadowLength
            )
        } else if (sunY > segmentBottom) {
            // Sun is below
            this.addQuad(
                quads,
                { x: segmentLeft, y: segmentTop },
                { x: segmentRight, y: segmentTop },
                sunX,
                sunY,
                shadowLength
            )
        }
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
        this.cameraPos.x = camera.x
        this.cameraPos.y = camera.y
        this.frameCount++
        // Update viewport bounds for culling using only the camera view
        this.updateViewportBounds(camera)
        // Only update shadows periodically
        if (this.frameCount % this.updateInterval === 0) {
            const obstacles = allGameObjects.filter(obj => obj !== this && obj.renderLayer !== LAYERS.BACKGROUND)
            const quads = this.computeShadowQuads(obstacles)
            // Optimize vertex array creation: 6 vertices per quad, 3 components each
            const verts = new Float32Array(quads.length * 18)
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

    // Render the shadow geometry to the stencil buffer and then darken the marked areas
    drawShadows(vertices) {
        if (!vertices.length) return;
        const gl = this.gl;
    
        // Step 1: Render shadow geometry into the stencil buffer
        gl.enable(gl.DEPTH_TEST);
        gl.depthFunc(gl.ALWAYS); // Always pass depth test
        gl.enable(gl.STENCIL_TEST); // Enable stencil testing
        gl.clear(gl.STENCIL_BUFFER_BIT); // Clear the stencil buffer
        gl.stencilFunc(gl.ALWAYS, 1, 0xFF); // Always pass stencil test
        gl.stencilOp(gl.REPLACE, gl.REPLACE, gl.REPLACE); // Replace stencil buffer value
        gl.colorMask(false, false, false, false); // Disable color writing
    
        // Disable depth writing to preserve the entity depth values
        gl.depthMask(false);
    
        // Bind shadow buffer and upload vertex data
        gl.bindBuffer(gl.ARRAY_BUFFER, this.shadowBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.DYNAMIC_DRAW);
    
        // Use shadow program
        gl.useProgram(this.shadowProgram);
        const stride = 3 * Float32Array.BYTES_PER_ELEMENT;
        gl.enableVertexAttribArray(this.posLoc);
        gl.vertexAttribPointer(this.posLoc, 2, gl.FLOAT, false, stride, 0);
        gl.enableVertexAttribArray(this.blurLoc);
        gl.vertexAttribPointer(this.blurLoc, 1, gl.FLOAT, false, stride, 2 * Float32Array.BYTES_PER_ELEMENT);
    
        // Set orthographic projection matrix
        const ortho = this.computeOrthoMatrix();
        gl.uniformMatrix4fv(this.matrixLoc, false, ortho);
    
        // Draw shadow geometry (stencil gets updated but depth buffer remains unchanged)
        gl.drawArrays(gl.TRIANGLES, 0, vertices.length / 3);
    
        // Re-enable depth writing now that the stencil is set up
        gl.depthMask(true);
    
        // Step 2: Darken areas marked in the stencil buffer only on objects
        gl.colorMask(true, true, true, true); // Enable color writing
        gl.stencilFunc(gl.EQUAL, 1, 0xFF); // Only render where stencil value is 1
        gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP); // Keep stencil values
        gl.depthFunc(gl.GREATER); // Only affect pixels with a depth less than 1.0 (i.e. where entities are)
        gl.enable(gl.BLEND); // Enable blending for darkening effect
        gl.blendFunc(gl.ZERO, gl.SRC_COLOR); // Multiply existing color with shadow factor
    
        // Use quad program for full-screen darkening
        if (!this.quadProgram) {
            this.quadProgram = this.createQuadProgram();
        }
        gl.useProgram(this.quadProgram);
    
        // Bind quad buffer and upload vertex data
        if (!this.quadBuffer) {
            this.quadBuffer = gl.createBuffer();
        }
        gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
        const quadVertices = new Float32Array([
            -1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1
        ]);
        gl.bufferData(gl.ARRAY_BUFFER, quadVertices, gl.STATIC_DRAW);
    
        // Set vertex attribute pointers
        const posLoc = gl.getAttribLocation(this.quadProgram, "a_position");
        gl.enableVertexAttribArray(posLoc);
        gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);
    
        // Set shadow factor uniform
        const shadowFactorLoc = gl.getUniformLocation(this.quadProgram, "u_shadowFactor");
        gl.uniform1f(shadowFactorLoc, 0.4); // Darken by 40%
    
        // Draw full-screen quad (only affecting areas where entities exist)
        gl.drawArrays(gl.TRIANGLES, 0, 6);
    
        // Restore default state
        gl.disable(gl.STENCIL_TEST);
        gl.disable(gl.BLEND);
        gl.depthFunc(gl.LEQUAL); // Re-enable default depth testing for other rendering
    }
    
}

export default SunWebGL
