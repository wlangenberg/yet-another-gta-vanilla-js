import Gun from "../entities/player/Gun.js";

class EntityBatchRenderer {
    constructor(gl) {
        this.gl = gl;
        this.useWebGL2 = (typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext);
        if (!this.useWebGL2) {
            this.instancingExt = gl.getExtension('ANGLE_instanced_arrays');
            if (!this.instancingExt) {
                throw new Error("Instancing not supported in this browser");
            }
        }
        this.instances = new Map(); // Map of texture to instances
        // Create a vertex buffer for a unit quad.
        this.vertexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
        gl.bufferData(
            gl.ARRAY_BUFFER,
            new Float32Array([
                -0.5, -0.5,
                 0.5, -0.5,
                 0.5,  0.5,
                -0.5,  0.5
            ]),
            gl.STATIC_DRAW
        );
        // Create an instance buffer for per-instance data.
        this.instanceBuffer = gl.createBuffer();
        // Initialize shader program.
        this.program = this.initShaderProgram(gl);
    }

    initShaderProgram(gl) {
        let vsSource, fsSource;
        if (this.useWebGL2) {
            vsSource = `#version 300 es
            in vec2 aPosition;
            in mat4 aInstanceMatrix;
            in vec4 aInstanceColor;
            uniform mat4 uViewProjectionMatrix;
            out vec4 vColor;
            out vec2 vTexCoord;
            void main() {
                vec4 worldPos = aInstanceMatrix * vec4(aPosition, 0.0, 1.0);
                gl_Position = uViewProjectionMatrix * worldPos;
                vColor = aInstanceColor;
                // Convert vertex positions (range -0.5 to 0.5) to texture coordinates (0.0 to 1.0)
                vTexCoord = aPosition + vec2(0.5, 0.5);
            }`;
            fsSource = `#version 300 es
            precision mediump float;
            in vec4 vColor;
            in vec2 vTexCoord;
            uniform sampler2D uSampler;
            uniform bool uUseTexture;
            out vec4 fragColor;
            void main() {
                if(uUseTexture) {
                    vec4 texColor = texture(uSampler, vTexCoord);
                    if(texColor.a < 0.1) discard;
                    fragColor = texColor * vColor;
                } else {
                    fragColor = vColor;
                }
            }`;
        } else {
            // For WebGL1 with ANGLE_instanced_arrays.
            vsSource = `
            attribute vec2 aPosition;
            attribute vec4 aInstanceMatrix0;
            attribute vec4 aInstanceMatrix1;
            attribute vec4 aInstanceMatrix2;
            attribute vec4 aInstanceMatrix3;
            attribute vec4 aInstanceColor;
            uniform mat4 uViewProjectionMatrix;
            varying vec4 vColor;
            varying vec2 vTexCoord;
            void main() {
                mat4 aInstanceMatrix = mat4(aInstanceMatrix0, aInstanceMatrix1, aInstanceMatrix2, aInstanceMatrix3);
                vec4 worldPos = aInstanceMatrix * vec4(aPosition, 0.0, 1.0);
                gl_Position = uViewProjectionMatrix * worldPos;
                vColor = aInstanceColor;
                vTexCoord = aPosition + vec2(0.5, 0.5);
            }`;
            fsSource = `
            precision mediump float;
            varying vec4 vColor;
            varying vec2 vTexCoord;
            uniform sampler2D uSampler;
            uniform bool uUseTexture;
            void main() {
                if(uUseTexture) {
                    vec4 texColor = texture2D(uSampler, vTexCoord);
                    if(texColor.a < 0.1) discard;
                    gl_FragColor = texColor * vColor;
                } else {
                    gl_FragColor = vColor;
                }
            }`;
        }
        const vertexShader = this.loadShader(gl, gl.VERTEX_SHADER, vsSource);
        const fragmentShader = this.loadShader(gl, gl.FRAGMENT_SHADER, fsSource);
        const shaderProgram = gl.createProgram();
        gl.attachShader(shaderProgram, vertexShader);
        gl.attachShader(shaderProgram, fragmentShader);
        gl.linkProgram(shaderProgram);
        if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
            console.error('Shader program initialization failed:', gl.getProgramInfoLog(shaderProgram));
            return null;
        }
        return shaderProgram;
    }

    loadShader(gl, type, source) {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.error('Error compiling shader:', gl.getShaderInfoLog(shader));
            gl.deleteShader(shader);
            return null;
        }
        return shader;
    }

    // Begin a new batch.
    begin() {
        this.instances.clear();
    }

    // Submit an entity. This now checks for an animation texture.
    submit(entity) {
        const transform = mat4.create();
    
        // Compute the center position
        const offsetY = entity.name ? 10 : 0;
        const tx = entity.x + entity.halfWidth;
        const ty = entity.y + entity.halfHeight + offsetY;
        mat4.translate(transform, transform, [tx, ty, 0]);
    
        // Apply rotation if available (rotates around the entity center, since the quad is centered at (0,0))
        if (entity.rotation) {
            mat4.rotateZ(transform, transform, entity.rotation);
        }
    
        // Determine scaling based on the entity's visual dimensions and animation properties.
        let scaleX = entity.visualWidth;
        let scaleY = entity.visualHeight;
        
        let texture = null;
        if (entity.animationController) {
            const currentAnimation = entity.animationController.animations.get(entity.animationController.currentAnimation);
            const currentFrame = entity.animationController.getCurrentFrame();
            
            if (currentFrame && currentAnimation) {
                texture = entity.animationController.getCurrentTexture();
                
                if (currentFrame.width && currentFrame.height) {
                    const textureAspectRatio = currentFrame.width / currentFrame.height;
                    const entityAspectRatio = entity.visualWidth / entity.visualHeight;
        
                    if (textureAspectRatio > entityAspectRatio) {
                        scaleY = entity.visualWidth / textureAspectRatio;
                    } else {
                        scaleX = entity.visualHeight * textureAspectRatio;
                    }
                    
                    if (currentAnimation.flipped && entity instanceof Gun) {
                        scaleY = -scaleY;
                    } else if (currentAnimation.flipped) {
                        scaleX = -scaleX;
                    }
                }
            }
        }
        
        // Apply scaling after rotation.
        mat4.scale(transform, transform, [scaleX, scaleY, 1]);
    
        // Group instances by texture
        const textureKey = texture || 'no_texture';
        if (!this.instances.has(textureKey)) {
            this.instances.set(textureKey, []);
        }
        
        this.instances.get(textureKey).push({
            matrix: transform,
            color: entity.color,
            texture: texture
        });
    }
    
    

    flush(viewProjectionMatrix) {
        // Render each group of instances with the same texture
        for (const [textureKey, instances] of this.instances) {
            if (instances.length > 0) {
                const useTexture = textureKey !== 'no_texture';
                this.drawInstances(viewProjectionMatrix, instances, useTexture, instances[0].texture);
            }
        }
    }

    drawInstances(viewProjectionMatrix, instances, useTexture, texture) {
        const gl = this.gl;
        gl.useProgram(this.program);

        // Bind vertex buffer and set attributes
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
        const posLoc = gl.getAttribLocation(this.program, 'aPosition');
        gl.enableVertexAttribArray(posLoc);
        gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

        // Prepare instance data
        const numInstances = instances.length;
        const instanceData = new Float32Array(numInstances * 20);
        for (let i = 0; i < numInstances; i++) {
            instanceData.set(instances[i].matrix, i * 20);
            instanceData.set(instances[i].color, i * 20 + 16);
        }

        // Buffer instance data
        gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, instanceData, gl.DYNAMIC_DRAW);

        const stride = 20 * 4;

        if (this.useWebGL2) {
            // Set up WebGL2 attributes
            const matrixLoc = gl.getAttribLocation(this.program, 'aInstanceMatrix');
            for (let i = 0; i < 4; i++) {
                const loc = matrixLoc + i;
                gl.enableVertexAttribArray(loc);
                gl.vertexAttribPointer(loc, 4, gl.FLOAT, false, stride, i * 16);
                gl.vertexAttribDivisor(loc, 1);
            }
            const colorLoc = gl.getAttribLocation(this.program, 'aInstanceColor');
            gl.enableVertexAttribArray(colorLoc);
            gl.vertexAttribPointer(colorLoc, 4, gl.FLOAT, false, stride, 16 * 4);
            gl.vertexAttribDivisor(colorLoc, 1);
        } else {
            // Set up WebGL1 attributes with ANGLE extension
            const ext = this.instancingExt;
            const matrixLoc0 = gl.getAttribLocation(this.program, 'aInstanceMatrix0');
            const matrixLoc1 = gl.getAttribLocation(this.program, 'aInstanceMatrix1');
            const matrixLoc2 = gl.getAttribLocation(this.program, 'aInstanceMatrix2');
            const matrixLoc3 = gl.getAttribLocation(this.program, 'aInstanceMatrix3');
            const colorLoc = gl.getAttribLocation(this.program, 'aInstanceColor');

            // Enable attributes and set divisors
            [matrixLoc0, matrixLoc1, matrixLoc2, matrixLoc3, colorLoc].forEach((loc, i) => {
                gl.enableVertexAttribArray(loc);
                gl.vertexAttribPointer(loc, 4, gl.FLOAT, false, stride, i * 16);
                ext.vertexAttribDivisorANGLE(loc, 1);
            });
        }

        // Set uniforms
        gl.uniformMatrix4fv(gl.getUniformLocation(this.program, 'uViewProjectionMatrix'), false, viewProjectionMatrix);
        gl.uniform1i(gl.getUniformLocation(this.program, 'uUseTexture'), useTexture ? 1 : 0);

        // Set up texturing
        if (useTexture && texture) {
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.uniform1i(gl.getUniformLocation(this.program, 'uSampler'), 0);
        }

        // Draw instances
        if (this.useWebGL2) {
            gl.drawArraysInstanced(gl.TRIANGLE_FAN, 0, 4, numInstances);
        } else {
            this.instancingExt.drawArraysInstancedANGLE(gl.TRIANGLE_FAN, 0, 4, numInstances);
        }

        // Clean up
        if (this.useWebGL2) {
            const matrixLoc = gl.getAttribLocation(this.program, 'aInstanceMatrix');
            const colorLoc = gl.getAttribLocation(this.program, 'aInstanceColor');
            for (let i = 0; i < 4; i++) {
                gl.vertexAttribDivisor(matrixLoc + i, 0);
            }
            gl.vertexAttribDivisor(colorLoc, 0);
        } else {
            const locations = [
                gl.getAttribLocation(this.program, 'aInstanceMatrix0'),
                gl.getAttribLocation(this.program, 'aInstanceMatrix1'),
                gl.getAttribLocation(this.program, 'aInstanceMatrix2'),
                gl.getAttribLocation(this.program, 'aInstanceMatrix3'),
                gl.getAttribLocation(this.program, 'aInstanceColor')
            ];
            locations.forEach(loc => {
                this.instancingExt.vertexAttribDivisorANGLE(loc, 0);
            });
        }
    }
}

export default EntityBatchRenderer;
