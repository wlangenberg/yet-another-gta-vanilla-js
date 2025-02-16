// SkyGradient.js
/**
 * A WebGL-based SkyGradient that dynamically adjusts based on the sun's Y position,
 * and draws blinking stars during night.
 *
 * We draw a pair of triangles that fill the entire clip space in the vertex shader,
 * and use a fragment shader that smoothly interpolates between top and bottom colors.
 * Additionally, during night a procedural star field is overlaid that slowly blinks.
 */

import { SUN_NIGHT_THRESHOLD } from './constants.js'

class SkyGradient {
    constructor(gl, sun) {
        this.gl = gl
        this.sun = sun

        // Define day and night colors for the sky
        this.dayTopColor = [0.53, 0.81, 0.98, 1.0]    // ~ #87CEEB (top)
        this.dayBottomColor = [1.0, 1.0, 1.0, 1.0]      // ~ #FFFFFF (bottom)
        this.nightTopColor = [0.0, 0.0, 0.1, 1.0]       // dark blue at night
        this.nightBottomColor = [0.0, 0.0, 0.0, 1.0]    // black

        // Current colors used in the shader
        this.currentTopColor = [0.53, 0.81, 0.98, 1.0]
        this.currentBottomColor = [1.0, 1.0, 1.0, 1.0]
        // Night intensity: 1.0 means full night, 0.0 means full day
        this.nightIntensity = 0.0

        // Create the shader program
        this.program = this.createShaderProgram()

        // Look up attribute and uniform locations
        this.aPositionLocation = this.gl.getAttribLocation(this.program, 'a_position')
        this.uTopColorLocation = this.gl.getUniformLocation(this.program, 'u_topColor')
        this.uBottomColorLocation = this.gl.getUniformLocation(this.program, 'u_bottomColor')
        this.uTimeLocation = this.gl.getUniformLocation(this.program, 'u_time')
        this.uNightIntensityLocation = this.gl.getUniformLocation(this.program, 'u_nightIntensity')

        // Create a buffer for two triangles that fill clip space
        this.buffer = this.gl.createBuffer()
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.buffer)
        const vertices = new Float32Array([
            -1.0, -1.0,
             1.0, -1.0,
            -1.0,  1.0,

            -1.0,  1.0,
             1.0, -1.0,
             1.0,  1.0
        ])
        this.gl.bufferData(this.gl.ARRAY_BUFFER, vertices, this.gl.STATIC_DRAW)
    }

    /**
     * update() should be called each frame before draw().
     * It calculates the blend factor based on the sun's Y position and updates
     * the sky colors and night intensity.
     */
    update() {
        const { y } = this.sun

        // Define blend range: sun at or below SUN_NIGHT_THRESHOLD is full night,
        // sun at or above 0 is full day.
        const minY = SUN_NIGHT_THRESHOLD
        const maxY = 0

        let factor = (y - minY) / (maxY - minY)
        if (factor < 0) factor = 0
        if (factor > 1) factor = 1

        // Interpolate colors between night and day
        this.currentTopColor = this.lerpColor(this.nightTopColor, this.dayTopColor, factor)
        this.currentBottomColor = this.lerpColor(this.nightBottomColor, this.dayBottomColor, factor)

        // Night intensity is the inverse of day factor
        this.nightIntensity = 1 - factor
    }

    /**
     * draw() renders the sky gradient and overlays blinking stars if it's night.
     */
    draw() {
        this.gl.useProgram(this.program)

        // Bind the buffer and set up the attribute
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.buffer)
        this.gl.enableVertexAttribArray(this.aPositionLocation)
        this.gl.vertexAttribPointer(this.aPositionLocation, 2, this.gl.FLOAT, false, 0, 0)

        // Pass uniforms for sky colors
        this.gl.uniform4fv(this.uTopColorLocation, this.currentTopColor)
        this.gl.uniform4fv(this.uBottomColorLocation, this.currentBottomColor)

        // Pass time uniform (in seconds) for blinking animation
        const currentTime = performance.now() / 1000
        this.gl.uniform1f(this.uTimeLocation, currentTime)
        // Pass night intensity so stars only appear at night
        this.gl.uniform1f(this.uNightIntensityLocation, this.nightIntensity)

        // Draw the two triangles (full-screen quad)
        this.gl.drawArrays(this.gl.TRIANGLES, 0, 6)
    }

    // Linear interpolation between two RGBA colors
    lerpColor(colorA, colorB, t) {
        return [
            colorA[0] + (colorB[0] - colorA[0]) * t,
            colorA[1] + (colorB[1] - colorA[1]) * t,
            colorA[2] + (colorB[2] - colorA[2]) * t,
            colorA[3] + (colorB[3] - colorA[3]) * t
        ]
    }

    createShaderProgram() {
        const vertexSrc = `
            attribute vec2 a_position;
            varying vec2 v_texCoord;

            void main() {
                // Convert from clip space [-1..1] to [0..1] range
                v_texCoord = (a_position + 1.0) * 0.5;
                gl_Position = vec4(a_position, 0.0, 1.0);
            }
        `
        const fragmentSrc = `
            precision mediump float;
            varying vec2 v_texCoord;
            uniform vec4 u_topColor;
            uniform vec4 u_bottomColor;
            uniform float u_time;
            uniform float u_nightIntensity;

            // Simple pseudo-random function based on a vec2 input
            float random(vec2 st) {
                return fract(sin(dot(st, vec2(12.9898,78.233))) * 43758.5453123);
            }

            void main() {
                // Compute the base sky color by vertical interpolation
                vec4 skyColor = mix(u_bottomColor, u_topColor, v_texCoord.y);

                // Initialize star intensity to zero
                float starIntensity = 0.0;
                // Set the star density scale
                float scale = 100.0;
                // Determine grid cell based on the fragment coordinate
                vec2 grid = floor(v_texCoord * scale);
                float rnd = random(grid);
                // If the random value exceeds a threshold, this cell contains a star
                if (rnd > 0.97) {
                    // Compute a random star center within the grid cell
                    vec2 starCenter = (grid + vec2(random(grid + 0.1), random(grid + 0.2))) / scale;
                    float dist = distance(v_texCoord, starCenter);
                    // Define star size (radius)
                    float starSize = 0.005;
                    // Compute brightness based on distance from star center
                    float brightness = smoothstep(starSize, 0.0, dist);
                    // Apply a slow blinking effect with a random phase per star
                    float blink = 0.5 + 0.5 * sin(u_time * 0.5 + rnd * 10.0);
                    starIntensity = brightness * blink;
                }

                // Overlay stars on the sky, modulated by the night intensity
                vec4 finalColor = skyColor + vec4(vec3(starIntensity * u_nightIntensity), 0.0);
                gl_FragColor = finalColor;
            }
        `
        const vs = this.compileShader(vertexSrc, this.gl.VERTEX_SHADER)
        const fs = this.compileShader(fragmentSrc, this.gl.FRAGMENT_SHADER)

        const program = this.gl.createProgram()
        this.gl.attachShader(program, vs)
        this.gl.attachShader(program, fs)
        this.gl.linkProgram(program)

        const success = this.gl.getProgramParameter(program, this.gl.LINK_STATUS)
        if (!success) {
            console.error('Failed to link program:', this.gl.getProgramInfoLog(program))
            this.gl.deleteProgram(program)
            return null
        }
        return program
    }

    compileShader(source, type) {
        const shader = this.gl.createShader(type)
        this.gl.shaderSource(shader, source)
        this.gl.compileShader(shader)
        const success = this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)
        if (!success) {
            console.error('Could not compile shader:', this.gl.getShaderInfoLog(shader))
            this.gl.deleteShader(shader)
            return null
        }
        return shader
    }
}

export default SkyGradient
