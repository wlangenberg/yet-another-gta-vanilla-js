import { BaseEntity } from "./BaseEntity.js"

class SunWebGL extends BaseEntity {
    constructor(x, y, width, height, canvas, gl) {
        super(x, y, width, height, [1.0, 1.0, 0.0, 1.0], canvas, gl)
        this.gl = gl
        this.shadowLength = 5000
        this.cameraPos = { x: 0, y: 0 }
        this.updateInterval = 1  // update shadows every 5 frames
        this.frameCount = 0
        this.cachedVertices = []
        this.cachedQuads = []
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

    // Compute shadow quads for obstacles (ignoring obstacles with color "green" or the sun itself)
    computeShadowQuads(obstacles) {
        const quads = []
        const sunX = this.x
        const sunY = this.y
        const shadowLength = this.shadowLength

        for (let i = 0; i < obstacles.length; i++) {
            const obs = obstacles[i]
            if (obs === this || obs.color === "green") {
                continue
            }
            const x = obs.x
            const y = obs.y
            const w = obs.width
            const h = obs.height

            if (sunX >= x && sunX <= x + w && sunY >= y && sunY <= y + h) {
                continue
            }

            let silhouette0 = null
            let silhouette1 = null

            if (sunX < x && sunY >= y && sunY <= y + h) {
                silhouette0 = { x: x + w, y: y }
                silhouette1 = { x: x + w, y: y + h }
            }
            else if (sunX > x + w && sunY >= y && sunY <= y + h) {
                silhouette0 = { x: x, y: y }
                silhouette1 = { x: x, y: y + h }
            }
            else if (sunY < y && sunX >= x && sunX <= x + w) {
                silhouette0 = { x: x, y: y + h }
                silhouette1 = { x: x + w, y: y + h }
            }
            else if (sunY > y + h && sunX >= x && sunX <= x + w) {
                silhouette0 = { x: x, y: y }
                silhouette1 = { x: x + w, y: y }
            }
            else {
                if (sunX < x && sunY < y) {
                    const diffX = (x + w) - sunX
                    const diffY = (y + h) - sunY
                    if (diffX > diffY) {
                        silhouette0 = { x: x + w, y: y }
                        silhouette1 = { x: x + w, y: y + h }
                    }
                    else {
                        silhouette0 = { x: x, y: y + h }
                        silhouette1 = { x: x + w, y: y + h }
                    }
                }
                else if (sunX > x + w && sunY < y) {
                    const diffX = sunX - x
                    const diffY = (y + h) - sunY
                    if (diffX > diffY) {
                        silhouette0 = { x: x, y: y }
                        silhouette1 = { x: x, y: y + h }
                    }
                    else {
                        silhouette0 = { x: x, y: y + h }
                        silhouette1 = { x: x + w, y: y + h }
                    }
                }
                else if (sunX < x && sunY > y + h) {
                    const diffX = (x + w) - sunX
                    const diffY = sunY - y
                    if (diffX > diffY) {
                        silhouette0 = { x: x + w, y: y }
                        silhouette1 = { x: x + w, y: y + h }
                    }
                    else {
                        silhouette0 = { x: x, y: y }
                        silhouette1 = { x: x + w, y: y }
                    }
                }
                else if (sunX > x + w && sunY > y + h) {
                    const diffX = sunX - x
                    const diffY = sunY - y
                    if (diffX > diffY) {
                        silhouette0 = { x: x, y: y }
                        silhouette1 = { x: x, y: y + h }
                    }
                    else {
                        silhouette0 = { x: x, y: y }
                        silhouette1 = { x: x + w, y: y }
                    }
                }
            }

            if (silhouette0 && silhouette1) {
                const extended0 = this.extendVertex(silhouette0, sunX, sunY, shadowLength)
                const extended1 = this.extendVertex(silhouette1, sunX, sunY, shadowLength)
                quads.push({
                    v0: silhouette0,
                    v1: silhouette1,
                    v2: extended1,
                    v3: extended0
                })
            }
        }

        return quads
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

        if (this.frameCount % this.updateInterval === 0) {
            const obstacles = allGameObjects.filter(obj => obj !== this)
            const quads = this.computeShadowQuads(obstacles)
            const verts = []
            for (let q of quads) {
                verts.push(q.v0.x, q.v0.y, 0.0,
                           q.v1.x, q.v1.y, 0.0,
                           q.v2.x, q.v2.y, 1.0)
                verts.push(q.v0.x, q.v0.y, 0.0,
                           q.v2.x, q.v2.y, 1.0,
                           q.v3.x, q.v3.y, 1.0)
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
