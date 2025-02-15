import { BaseEntity } from "./BaseEntity.js"

class SunWebGL extends BaseEntity {
    constructor(x, y, width, height, canvas, gl) {
        super(x, y, width, height, [1.0, 1.0, 0.0, 1.0], canvas, gl)
        this.gl = gl
        // How far to extend each shadow quad
        this.shadowLength = 2000
        // This should be updated externally when the camera moves.
        // For an orthographic camera, cameraPos is the world coordinate of the top-left corner.
        this.cameraPos = { x: 0, y: 0 }
        this.initShaders()
        this.initBuffers()
    }

    initShaders() {
        const gl = this.gl

        // Vertex shader: now uses a transformation matrix to convert world coordinates to clip space.
        const vertexShaderSource = `
            attribute vec2 a_position;
            uniform mat4 u_matrix;
            void main() {
                gl_Position = u_matrix * vec4(a_position, 0.0, 1.0);
            }
        `
        const vertexShader = this.createShader(gl.VERTEX_SHADER, vertexShaderSource)

        // Fragment shader: outputs a semi-transparent dark color.
        const fragmentShaderSource = `
        precision mediump float;
        void main() {
            gl_FragColor = vec4(0.0, 0.0, 0.0, 0.85); // Increase alpha for darker shadows
        }
    `;
        const fragmentShader = this.createShader(gl.FRAGMENT_SHADER, fragmentShaderSource)

        this.shadowShaderProgram = gl.createProgram()
        gl.attachShader(this.shadowShaderProgram, vertexShader)
        gl.attachShader(this.shadowShaderProgram, fragmentShader)
        gl.linkProgram(this.shadowShaderProgram)
        if (!gl.getProgramParameter(this.shadowShaderProgram, gl.LINK_STATUS)) {
            console.error("Shader program failed to link:", gl.getProgramInfoLog(this.shadowShaderProgram))
        }

        this.shadowPositionAttributeLocation = gl.getAttribLocation(this.shadowShaderProgram, "a_position")
        this.matrixUniformLocation = gl.getUniformLocation(this.shadowShaderProgram, "u_matrix")
    }

    createShader(type, source) {
        const gl = this.gl
        const shader = gl.createShader(type)
        gl.shaderSource(shader, source)
        gl.compileShader(shader)
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.error("Shader compile error:", gl.getShaderInfoLog(shader))
            gl.deleteShader(shader)
            return null
        }
        return shader
    }

    initBuffers() {
        const gl = this.gl
        this.shadowVertexBuffer = gl.createBuffer()
    }

    // For each obstacle, compute a shadow quad based on its silhouette edge.
    // Obstacles are assumed to have properties: x, y, width, height.
    computeShadowQuads(obstacles) {
        const quads = []
        const sunPos = { x: this.x, y: this.y }
        obstacles.forEach(obs => {
            if (obs === this || obs.color === "green") return
            // Compute the four corners of the rectangle in world coordinates.
            const v0 = { x: obs.x, y: obs.y }
            const v1 = { x: obs.x + obs.width, y: obs.y }
            const v2 = { x: obs.x + obs.width, y: obs.y + obs.height }
            const v3 = { x: obs.x, y: obs.y + obs.height }
            const vertices = [v0, v1, v2, v3]
            // Compute the obstacle center.
            const center = { x: obs.x + obs.width / 2, y: obs.y + obs.height / 2 }
            // Compute a light vector: from the sun toward the obstacle center.
            let dx = center.x - sunPos.x
            let dy = center.y - sunPos.y
            const mag = Math.hypot(dx, dy)
            if (mag === 0) return
            dx /= mag
            dy /= mag
            // For each vertex, compute the dot product with the light direction.
            // The two vertices with the smallest dot (i.e. farthest from the sun)
            // form the silhouette edge.
            const dots = vertices.map(v => ((v.x - sunPos.x) * dx + (v.y - sunPos.y) * dy))
            let minIndex = 0
            let secondMinIndex = 1
            if (dots[1] < dots[0]) {
                minIndex = 1
                secondMinIndex = 0
            }
            for (let i = 2; i < 4; i++) {
                if (dots[i] < dots[minIndex]) {
                    secondMinIndex = minIndex
                    minIndex = i
                } else if (dots[i] < dots[secondMinIndex]) {
                    secondMinIndex = i
                }
            }
            // Ensure the two chosen vertices are adjacent (in order [0,1,2,3] with 0 adjacent to 3).
            if (!((Math.abs(minIndex - secondMinIndex) === 1) || (Math.abs(minIndex - secondMinIndex) === 3))) {
                const adjacent = [(minIndex + 1) % 4, (minIndex + 3) % 4]
                const dot0 = dots[adjacent[0]]
                const dot1 = dots[adjacent[1]]
                secondMinIndex = dot0 < dot1 ? adjacent[0] : adjacent[1]
            }
            const silhouette = [vertices[minIndex], vertices[secondMinIndex]]
            // For each silhouette vertex, extend it by shadowLength along the direction from the sun.
            const extended = silhouette.map(v => {
                let vx = v.x - sunPos.x
                let vy = v.y - sunPos.y
                const vmag = Math.hypot(vx, vy)
                if (vmag === 0) return { x: v.x, y: v.y }
                vx /= vmag
                vy /= vmag
                return { x: v.x + vx * this.shadowLength, y: v.y + vy * this.shadowLength }
            })
            // Build a quad from the silhouette edge and its extension.
            // Two triangles: [silhouette[0], silhouette[1], extended[1]] and [silhouette[0], extended[1], extended[0]]
            quads.push({ v0: silhouette[0], v1: silhouette[1], v2: extended[1], v3: extended[0] })
        })
        return quads
    }

    // Build an orthographic projection matrix (4x4) from world coordinates to clip space.
    // The matrix maps:
    // left = cameraPos.x, right = cameraPos.x + canvas.width,
    // bottom = cameraPos.y + canvas.height, top = cameraPos.y,
    // near = -1, far = 1.
    computeOrthoMatrix() {
        const l = this.cameraPos.x
        const r = this.cameraPos.x + this.canvas.width
        const t = this.cameraPos.y
        const b = this.cameraPos.y + this.canvas.height
        const n = -1
        const f = 1

        // Column-major order.
        return new Float32Array([
            2 / (r - l), 0, 0, 0,
            0, 2 / (t - b), 0, 0,
            0, 0, -2 / (f - n), 0,
            -(r + l) / (r - l), -(t + b) / (t - b), -(f + n) / (f - n), 1
        ])
    }

    update(interval, allGameObjects = [], spatialGrid, camera) {
        super.update(interval, allGameObjects)
        this.cameraPos.x = camera.x
        this.cameraPos.y = camera.y
        // Filter obstacles: skip self and obstacles with color "green"
        // const obstacles = spatialGrid.query(this)
        const obstacles = allGameObjects.filter(obj => obj !== this && obj.color !== "green")
        const quads = this.computeShadowQuads(obstacles)
        // Build a vertex array (in world coordinates) for all shadow quads.
        const vertices = []
        quads.forEach(quad => {
            // First triangle: v0, v1, v2.
            vertices.push(quad.v0.x, quad.v0.y)
            vertices.push(quad.v1.x, quad.v1.y)
            vertices.push(quad.v2.x, quad.v2.y)
            // Second triangle: v0, v2, v3.
            vertices.push(quad.v0.x, quad.v0.y)
            vertices.push(quad.v2.x, quad.v2.y)
            vertices.push(quad.v3.x, quad.v3.y)
        })
        this.drawShadows(vertices)
    }

    drawShadows(vertices) {
        const gl = this.gl
        if (vertices.length < 6) return
        const vertexArray = new Float32Array(vertices)
        gl.bindBuffer(gl.ARRAY_BUFFER, this.shadowVertexBuffer)
        gl.bufferData(gl.ARRAY_BUFFER, vertexArray, gl.DYNAMIC_DRAW)
        gl.useProgram(this.shadowShaderProgram)
        gl.enableVertexAttribArray(this.shadowPositionAttributeLocation)
        gl.vertexAttribPointer(this.shadowPositionAttributeLocation, 2, gl.FLOAT, false, 0, 0)

        // Compute the orthographic matrix using the current camera position.
        const orthoMatrix = this.computeOrthoMatrix()
        gl.uniformMatrix4fv(this.matrixUniformLocation, false, orthoMatrix)

        // Enable blending for opacity.
        gl.enable(gl.BLEND)
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
        // gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_COLOR);
        // Disable depth testing so shadows appear on top.
        gl.disable(gl.DEPTH_TEST)
        gl.drawArrays(gl.TRIANGLES, 0, vertexArray.length / 2)
        gl.enable(gl.DEPTH_TEST)
    }
}

export default SunWebGL