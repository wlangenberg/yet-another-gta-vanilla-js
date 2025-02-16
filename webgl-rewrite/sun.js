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

	computeShadowQuads(obstacles) {
		const quads = []
		const sunPos = { x: this.x, y: this.y }

		obstacles.forEach(obs => {
			if (obs === this || obs.color === "green") return

			const v0 = { x: obs.x, y: obs.y }
			const v1 = { x: obs.x + obs.width, y: obs.y }
			const v2 = { x: obs.x + obs.width, y: obs.y + obs.height }
			const v3 = { x: obs.x, y: obs.y + obs.height }
			const vertices = [v0, v1, v2, v3]

			const center = {
				x: obs.x + obs.width / 2,
				y: obs.y + obs.height / 2
			}

			let dx = center.x - sunPos.x
			let dy = center.y - sunPos.y
			const mag = Math.hypot(dx, dy)
			if (mag === 0) return
			dx /= mag
			dy /= mag

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

			if (!(
				Math.abs(minIndex - secondMinIndex) === 1
				|| Math.abs(minIndex - secondMinIndex) === 3
			)) {
				const adjacent = [(minIndex + 1) % 4, (minIndex + 3) % 4]
				const dot0 = dots[adjacent[0]]
				const dot1 = dots[adjacent[1]]
				secondMinIndex = dot0 < dot1 ? adjacent[0] : adjacent[1]
			}

			const silhouette = [
				vertices[minIndex],
				vertices[secondMinIndex]
			]

			const extended = silhouette.map(v => {
				let vx = v.x - sunPos.x
				let vy = v.y - sunPos.y
				const vmag = Math.hypot(vx, vy)
				if (vmag === 0) {
					return { x: v.x, y: v.y }
				}
				vx /= vmag
				vy /= vmag
				return {
					x: v.x + vx * this.shadowLength,
					y: v.y + vy * this.shadowLength
				}
			})

			quads.push({
				v0: silhouette[0],
				v1: silhouette[1],
				v2: extended[1],
				v3: extended[0]
			})
		})

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
			2/(r-l),    0,           0,  0,
			0,          2/(t-b),     0,  0,
			0,          0,   -2/(f-n),  0,
			-(r+l)/(r-l), -(t+b)/(t-b), -(f+n)/(f-n), 1
		])
	}

	render(dt, allGameObjects, spatialGrid, camera) {
		super.render(camera.getViewMatrix())
		this.cameraPos.x = camera.x
		this.cameraPos.y = camera.y
		const obstacles = allGameObjects.filter(obj => obj !== this)
		const quads = this.computeShadowQuads(obstacles)

		const verts = []
		for (let q of quads) {
			// Triangle 1: silhouette vertex (blur 0.0), silhouette vertex (blur 0.0), extended vertex (blur 1.0)
			verts.push(q.v0.x, q.v0.y, 0.0,
					   q.v1.x, q.v1.y, 0.0,
					   q.v2.x, q.v2.y, 1.0)
			// Triangle 2: silhouette vertex (blur 0.0), extended vertex (blur 1.0), extended vertex (blur 1.0)
			verts.push(q.v0.x, q.v0.y, 0.0,
					   q.v2.x, q.v2.y, 1.0,
					   q.v3.x, q.v3.y, 1.0)
		}
		this.drawShadows(verts)
	}

	drawShadows(vertices) {
		if (!vertices.length) return
		const gl = this.gl

		// Disable depth so shadows draw on top
		gl.disable(gl.DEPTH_TEST)

		// Enable blending
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
		// Setup attribute pointers: position (2 floats) and blur (1 float)
		const stride = 3 * Float32Array.BYTES_PER_ELEMENT
		gl.enableVertexAttribArray(this.posLoc)
		gl.vertexAttribPointer(this.posLoc, 2, gl.FLOAT, false, stride, 0)
		gl.enableVertexAttribArray(this.blurLoc)
		gl.vertexAttribPointer(this.blurLoc, 1, gl.FLOAT, false, stride, 2 * Float32Array.BYTES_PER_ELEMENT)

		const ortho = this.computeOrthoMatrix()
		gl.uniformMatrix4fv(this.matrixLoc, false, ortho)

		// Set blur amount uniform (1.0 gives a linear fade from 0.3 to 0)
		gl.uniform1f(this.blurAmountLoc, 1.0)

		gl.drawArrays(gl.TRIANGLES, 0, data.length / 3)

		gl.blendEquation(gl.FUNC_ADD)
		gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
		gl.disable(gl.BLEND)
		gl.enable(gl.DEPTH_TEST)
	}
}

export default SunWebGL
