import { BaseEntity } from "./BaseEntity.js"

class SunWebGL extends BaseEntity {
    constructor(x, y, width, height, canvas, gl) {
        super(x, y, width, height, [1.0, 1.0, 0.0, 1.0], canvas, gl)
        this.gl = gl
        this.shadowLength = 5000
        this.cameraPos = { x: 0, y: 0 }
        this.initShaders()
        this.initBuffers()
    }

    initShaders() {
        const gl = this.gl
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
                float t = clamp(v_blur * u_blurAmount, 0.0, 1.0);
                float alpha = mix(0.1, 0.8, t);
                gl_FragColor = vec4(0.0, 0.0, 0.0, alpha);
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

    // Optimized silhouette computation for axis-aligned rectangles.
    // For each obstacle, we determine which edge is furthest from the sun
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

            // Skip if the sun is inside the obstacle
            if (sunX >= x && sunX <= x + w && sunY >= y && sunY <= y + h) {
                continue
            }

            let silhouette0 = null
            let silhouette1 = null

            // Cases when the sun lies directly along one axis
            if (sunX < x && sunY >= y && sunY <= y + h) {
                // Sun is directly left: use the right edge
                silhouette0 = { x: x + w, y: y }
                silhouette1 = { x: x + w, y: y + h }
            }
            else if (sunX > x + w && sunY >= y && sunY <= y + h) {
                // Sun is directly right: use the left edge
                silhouette0 = { x: x, y: y }
                silhouette1 = { x: x, y: y + h }
            }
            else if (sunY < y && sunX >= x && sunX <= x + w) {
                // Sun is directly above: use the bottom edge
                silhouette0 = { x: x, y: y + h }
                silhouette1 = { x: x + w, y: y + h }
            }
            else if (sunY > y + h && sunX >= x && sunX <= x + w) {
                // Sun is directly below: use the top edge
                silhouette0 = { x: x, y: y }
                silhouette1 = { x: x + w, y: y }
            }
            else {
                // Diagonal cases
                if (sunX < x && sunY < y) {
                    // Sun is top-left of the rectangle
                    const diffX = (x + w) - sunX
                    const diffY = (y + h) - sunY
                    if (diffX > diffY) {
                        // Dominant difference is horizontal: choose right edge
                        silhouette0 = { x: x + w, y: y }
                        silhouette1 = { x: x + w, y: y + h }
                    }
                    else {
                        // Otherwise choose bottom edge
                        silhouette0 = { x: x, y: y + h }
                        silhouette1 = { x: x + w, y: y + h }
                    }
                }
                else if (sunX > x + w && sunY < y) {
                    // Sun is top-right
                    const diffX = sunX - x
                    const diffY = (y + h) - sunY
                    if (diffX > diffY) {
                        // Dominant difference is horizontal: choose left edge
                        silhouette0 = { x: x, y: y }
                        silhouette1 = { x: x, y: y + h }
                    }
                    else {
                        // Otherwise choose bottom edge
                        silhouette0 = { x: x, y: y + h }
                        silhouette1 = { x: x + w, y: y + h }
                    }
                }
                else if (sunX < x && sunY > y + h) {
                    // Sun is bottom-left
                    const diffX = (x + w) - sunX
                    const diffY = sunY - y
                    if (diffX > diffY) {
                        // Choose right edge
                        silhouette0 = { x: x + w, y: y }
                        silhouette1 = { x: x + w, y: y + h }
                    }
                    else {
                        // Choose top edge
                        silhouette0 = { x: x, y: y }
                        silhouette1 = { x: x + w, y: y }
                    }
                }
                else if (sunX > x + w && sunY > y + h) {
                    // Sun is bottom-right
                    const diffX = sunX - x
                    const diffY = sunY - y
                    if (diffX > diffY) {
                        // Choose left edge
                        silhouette0 = { x: x, y: y }
                        silhouette1 = { x: x, y: y + h }
                    }
                    else {
                        // Choose top edge
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
            2/(r - l),    0,           0,  0,
            0,          2/(t - b),     0,  0,
            0,          0,   -2/(f - n),  0,
            -(r + l)/(r - l), -(t + b)/(t - b), -(f + n)/(f - n), 1
        ])
    }

    render(dt, allGameObjects, spatialGrid, camera) {
        super.render(camera.getViewMatrix())
        this.cameraPos.x = camera.x
        this.cameraPos.y = camera.y
        const obstacles = allGameObjects.filter(obj => obj !== this)
        const quads = this.computeShadowQuads(obstacles)

        // Build the vertex array for two triangles per quad
        const verts = []
        for (let q of quads) {
            verts.push(q.v0.x, q.v0.y, 0.0,
                       q.v1.x, q.v1.y, 0.0,
                       q.v2.x, q.v2.y, 1.0)
            verts.push(q.v0.x, q.v0.y, 0.0,
                       q.v2.x, q.v2.y, 1.0,
                       q.v3.x, q.v3.y, 1.0)
        }
        this.drawShadows(verts)
    }

    drawShadows(vertices) {
        if (!vertices.length) return
        const gl = this.gl

        // Disable depth test and enable blending for smooth shadows
        gl.disable(gl.DEPTH_TEST)
        gl.enable(gl.BLEND)
        gl.blendFuncSeparate(
            gl.SRC_ALPHA,
            gl.ONE_MINUS_SRC_ALPHA,
            gl.ONE,
            gl.ONE
        )

        const data = new Float32Array(vertices)
        gl.bindBuffer(gl.ARRAY_BUFFER, this.shadowBuffer)
        gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW)

        gl.useProgram(this.shadowProgram)
        const stride = 3 * Float32Array.BYTES_PER_ELEMENT
        gl.enableVertexAttribArray(this.posLoc)
        gl.vertexAttribPointer(this.posLoc, 2, gl.FLOAT, false, stride, 0)
        gl.enableVertexAttribArray(this.blurLoc)
        gl.vertexAttribPointer(this.blurLoc, 1, gl.FLOAT, false, stride, 2 * Float32Array.BYTES_PER_ELEMENT)

        const ortho = this.computeOrthoMatrix()
        gl.uniformMatrix4fv(this.matrixLoc, false, ortho)
        gl.uniform1f(this.blurAmountLoc, 1.0)

        gl.drawArrays(gl.TRIANGLES, 0, data.length / 3)

        gl.blendEquation(gl.FUNC_ADD)
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
        gl.disable(gl.BLEND)
        gl.enable(gl.DEPTH_TEST)
    }
}

export default SunWebGL
